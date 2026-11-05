import type { Context } from 'hono';
import QRCode from 'qrcode';
import type { SignParams } from '@cuberoot/shared/payment';
import * as alipay from '../payment/alipay.js';
import * as wechat from '../payment/wechat.js';
import { findUserByIdentity } from '../utils/account.js';
import { exchangeWechatMiniProgramCode, wechatMiniProgramConfigured } from '../utils/wechat_miniprogram.js';
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

export function orderPaymentChannels(currency: string) {
  return {
    alipay: currency === 'CNY' && alipay.alipayConfigured(),
    wechatNative: currency === 'CNY' && wechat.wechatConfigured(),
    wechatH5: currency === 'CNY' && wechat.wechatH5Configured(),
    wechatMiniProgram: currency === 'CNY' && wechat.wechatMiniProgramPayConfigured() && wechatMiniProgramConfigured(),
  };
}

export async function createProviderPayment(input: {
  provider: PlatformPaymentProvider;
  clientType: 'pc' | 'wap' | 'miniprogram';
  orderNo: string;
  returnOrderNo?: string;
  amountCents: number;
  currency: string;
  subject: string;
  payerIp: string;
  miniProgramCode?: string;
  payerUserId?: number;
  lang?: 'en' | 'zh';
}): Promise<{ checkoutUrl?: string; qrCodeDataUrl?: string; requestPayment?: wechat.WechatMiniProgramPayment }> {
  if (input.currency !== 'CNY') badRequest('Online payment currently supports CNY only');
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) badRequest('Invalid payment amount');
  const notifyUrl = `${API_ORIGIN}/v1/platform/payments/${input.provider}/notify`;
  const returnUrl = `${SITE_ORIGIN}${input.lang === 'zh' ? '/zh' : ''}/platform/orders/${encodeURIComponent(input.returnOrderNo ?? input.orderNo)}`;

  if (input.clientType === 'miniprogram') {
    if (input.provider !== 'wechat') badRequest('Mini Program payment requires WeChat Pay');
    if (!wechat.wechatMiniProgramPayConfigured() || !wechatMiniProgramConfigured()) {
      throw new PlatformApiError('PAYMENT_NOT_CONFIGURED', 503, 'WeChat Mini Program Pay is not configured');
    }
    if (!input.miniProgramCode || input.miniProgramCode.length > 512 || !input.payerUserId) {
      badRequest('Mini Program login code and payer are required');
    }
    let identity;
    try { identity = await exchangeWechatMiniProgramCode(input.miniProgramCode); }
    catch { throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'WeChat login expired; try again'); }
    const account = identity.unionid ? await findUserByIdentity('wechat', identity.unionid) : null;
    if (!account || account.id !== input.payerUserId) {
      throw new PlatformApiError('FORBIDDEN', 403, 'WeChat identity does not match the signed-in account');
    }
    return { requestPayment: await wechat.createWechatMiniProgram({
      outTradeNo: input.orderNo, amountCents: input.amountCents,
      description: input.subject.slice(0, 120), notifyUrl, openid: identity.openid,
    }) };
  }

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
    if (!wechat.wechatH5Configured()) {
      throw new PlatformApiError('PAYMENT_NOT_CONFIGURED', 503, 'WeChat H5 Pay is not configured');
    }
    const checkoutUrl = new URL(await wechat.createWechatH5({
        outTradeNo: input.orderNo,
        amountCents: input.amountCents,
        description: input.subject.slice(0, 120),
        notifyUrl,
        payerClientIp: input.payerIp,
      }));
    checkoutUrl.searchParams.set('redirect_url', returnUrl);
    return { checkoutUrl: checkoutUrl.href };
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
  closed?: boolean;
  amountCents: number;
  currency: string;
  merchantId: string;
  raw: unknown;
}

/** Only authenticated provider queries can recover a missed notification. */
export async function queryProviderPayment(provider: PlatformPaymentProvider, orderNo: string): Promise<VerifiedPaymentEvent | null> {
  const result = provider === 'alipay'
    ? await alipay.queryAlipayTrade(orderNo)
    : await wechat.queryWechatOrder(orderNo);
  if (!result?.paid) return null;
  const envelope = result.raw as Record<string, unknown> | null;
  const raw = provider === 'alipay' ? envelope?.alipay_trade_query_response as Record<string, unknown> | undefined : envelope;
  if (!raw || raw.out_trade_no !== orderNo || !result.txn) {
    throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'Queried payment identity mismatch');
  }
  const merchantId = provider === 'alipay' ? process.env.ALIPAY_APP_ID : process.env.WECHAT_MCHID;
  let amountCents: number;
  let currency: string;
  if (provider === 'alipay') {
    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(String(raw.trade_status)) || raw.trade_no !== result.txn) {
      throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'Queried Alipay payment is not settled');
    }
    amountCents = decimalAmountToCents(raw.total_amount);
    currency = 'CNY';
  } else {
    if (!wechat.isWechatPaymentAppId(String(raw.appid)) || raw.mchid !== merchantId
      || raw.trade_state !== 'SUCCESS' || raw.transaction_id !== result.txn) {
      throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'Queried WeChat payment identity mismatch');
    }
    const amount = raw.amount as Record<string, unknown> | undefined;
    amountCents = Number(amount?.total);
    currency = String(amount?.currency ?? '');
  }
  if (!merchantId || !Number.isSafeInteger(amountCents) || amountCents <= 0 || currency !== 'CNY') {
    throw new PlatformApiError('PROVIDER_VERIFICATION_FAILED', 403, 'Queried payment amount is invalid');
  }
  return { provider, eventId: `query:${result.txn}`, providerTransactionId: result.txn,
    orderNo, paid: true, amountCents, currency, merchantId, raw };
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
    eventId: String(params.notify_id),
    providerTransactionId: transactionId,
    orderNo,
    paid: status === 'TRADE_SUCCESS' || status === 'TRADE_FINISHED',
    closed: status === 'TRADE_CLOSED',
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
  if (!wechat.isWechatPaymentAppId(appId) || !merchantId || merchantId !== process.env.WECHAT_MCHID) {
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
    closed: ['CLOSED', 'REVOKED', 'PAYERROR'].includes(String(raw.trade_state)),
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
