import type { Context } from 'hono';
import QRCode from 'qrcode';
import type { SignParams } from '@cuberoot/shared/payment';
import * as alipay from '../payment/alipay.js';
import * as wechat from '../payment/wechat.js';
import { PlatformApiError, badRequest } from './errors.js';

export const PLATFORM_PAYMENT_PROVIDERS = ['alipay', 'wechat'] as const;
export type PlatformPaymentProvider = (typeof PLATFORM_PAYMENT_PROVIDERS)[number];

const API_ORIGIN = process.env.PUBLIC_API_ORIGIN || 'https://api.cuberoot.me';
const SITE_ORIGIN = process.env.PUBLIC_SITE_ORIGIN || 'https://cuberoot.me';

export function paymentAvailability(): Record<PlatformPaymentProvider, boolean> {
  return {
    alipay: alipay.alipayConfigured(),
    wechat: wechat.wechatConfigured(),
  };
}

export async function createProviderPayment(input: {
  provider: PlatformPaymentProvider;
  clientType: 'pc' | 'wap';
  orderNo: string;
  returnOrderNo?: string;
  amountCents: number;
  currency: string;
  subject: string;
  payerIp: string;
}): Promise<{ checkoutUrl?: string; qrCodeDataUrl?: string }> {
  if (input.currency !== 'CNY') badRequest('Online payment currently supports CNY only');
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) badRequest('Invalid payment amount');
  const notifyUrl = `${API_ORIGIN}/v1/platform/payments/${input.provider}/notify`;
  const returnUrl = `${SITE_ORIGIN}/platform/orders/${encodeURIComponent(input.returnOrderNo ?? input.orderNo)}`;

  if (input.provider === 'alipay') {
    if (!alipay.alipayConfigured()) {
      throw new PlatformApiError('PAYMENT_NOT_CONFIGURED', 503, 'Alipay is not configured');
    }
    return {
      checkoutUrl: alipay.createAlipayCheckoutUrl({
        outTradeNo: input.orderNo,
        amountCents: input.amountCents,
        subject: input.subject.slice(0, 120),
        clientType: input.clientType,
        notifyUrl,
        returnUrl,
      }),
    };
  }

  if (!wechat.wechatConfigured()) {
    throw new PlatformApiError('PAYMENT_NOT_CONFIGURED', 503, 'WeChat Pay is not configured');
  }
  if (input.clientType === 'wap') {
    return {
      checkoutUrl: await wechat.createWechatH5({
        outTradeNo: input.orderNo,
        amountCents: input.amountCents,
        description: input.subject.slice(0, 120),
        notifyUrl,
        payerClientIp: input.payerIp,
      }),
    };
  }
  const codeUrl = await wechat.createWechatNative({
    outTradeNo: input.orderNo,
    amountCents: input.amountCents,
    description: input.subject.slice(0, 120),
    notifyUrl,
  });
  return { qrCodeDataUrl: await QRCode.toDataURL(codeUrl, { margin: 1, width: 240 }) };
}

export interface VerifiedPaymentEvent {
  provider: PlatformPaymentProvider;
  eventId: string;
  providerTransactionId: string;
  orderNo: string;
  paid: boolean;
  amountCents: number;
  currency: string;
  merchantId: string;
  raw: unknown;
}

export async function verifyProviderNotification(
  c: Context,
  provider: PlatformPaymentProvider,
): Promise<VerifiedPaymentEvent> {
  if (provider === 'alipay') return verifyAlipayNotification(c);
  return verifyWechatNotification(c);
}

async function verifyAlipayNotification(c: Context): Promise<VerifiedPaymentEvent> {
  if (!alipay.alipayConfigured()) {
    throw new PlatformApiError('PAYMENT_NOT_CONFIGURED', 503, 'Alipay is not configured');
  }
  const params = await readFormOrJson(c);
  if (!alipay.verifyAlipayNotify(params)) {
    throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'Alipay signature verification failed');
  }
  const appId = String(params.app_id ?? '');
  if (!appId || appId !== process.env.ALIPAY_APP_ID) {
    throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'Alipay merchant identity mismatch');
  }
  const amountCents = decimalAmountToCents(params.total_amount);
  const transactionId = String(params.trade_no ?? '');
  const orderNo = String(params.out_trade_no ?? '');
  if (!transactionId || !orderNo) {
    throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'Alipay notification is incomplete');
  }
  const status = String(params.trade_status ?? '').toUpperCase();
  return {
    provider: 'alipay',
    eventId: transactionId,
    providerTransactionId: transactionId,
    orderNo,
    paid: status === 'TRADE_SUCCESS' || status === 'TRADE_FINISHED',
    amountCents,
    currency: 'CNY',
    merchantId: appId,
    raw: params,
  };
}

async function verifyWechatNotification(c: Context): Promise<VerifiedPaymentEvent> {
  if (!wechat.wechatConfigured()) {
    throw new PlatformApiError('PAYMENT_NOT_CONFIGURED', 503, 'WeChat Pay is not configured');
  }
  const rawBody = await c.req.text();
  const result = wechat.handleWechatCallback(rawBody, {
    serial: c.req.header('Wechatpay-Serial'),
    timestamp: c.req.header('Wechatpay-Timestamp'),
    nonce: c.req.header('Wechatpay-Nonce'),
    signature: c.req.header('Wechatpay-Signature'),
  });
  if (!result.ok || !result.raw || typeof result.raw !== 'object') {
    throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'WeChat Pay verification failed');
  }
  const raw = result.raw as Record<string, unknown>;
  const appId = String(raw.appid ?? '');
  const merchantId = String(raw.mchid ?? '');
  if (!appId || appId !== process.env.WECHAT_APPID || !merchantId || merchantId !== process.env.WECHAT_MCHID) {
    throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'WeChat Pay merchant identity mismatch');
  }
  const amount = raw.amount;
  const amountCents = amount && typeof amount === 'object'
    ? Number((amount as Record<string, unknown>).total)
    : Number.NaN;
  const currency = amount && typeof amount === 'object'
    ? String((amount as Record<string, unknown>).currency ?? '')
    : '';
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || !currency) {
    throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'WeChat Pay amount is invalid');
  }
  const transactionId = String(result.txn ?? '');
  const orderNo = String(result.outTradeNo ?? '');
  if (!transactionId || !orderNo) {
    throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'WeChat Pay notification is incomplete');
  }
  return {
    provider: 'wechat',
    eventId: transactionId,
    providerTransactionId: transactionId,
    orderNo,
    paid: result.paid === true,
    amountCents,
    currency,
    merchantId,
    raw,
  };
}

async function readFormOrJson(c: Context): Promise<SignParams & { sign?: string; sign_type?: string }> {
  const result: Record<string, string> = {};
  try {
    const body = await c.req.parseBody();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') result[key] = value;
    }
  } catch {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      for (const [key, value] of Object.entries(body)) result[key] = String(value);
    } catch {
      throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'Payment notification is unreadable');
    }
  }
  return result;
}

function decimalAmountToCents(value: unknown): number {
  const text = String(value ?? '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'Payment amount is invalid');
  }
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) {
    throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'Payment amount is invalid');
  }
  return cents;
}
