import * as wechat from '../payment/wechat.js';
import * as airwallex from '../payment/airwallex.js';
import * as alipay from '../payment/alipay.js';
import { PlatformApiError } from './errors.js';

export interface RefundProviderInput {
  provider: string; merchantAccount: string; transactionId: string; requestId: string;
  refundId?: string | null; amountMinor: number; totalMinor: number; currency: string; reason: string;
}
export interface RefundProviderResult {
  id: string; status: 'pending' | 'succeeded' | 'failed'; providerStatus: string;
}

export function assertRefundProvider(input: RefundProviderInput): void {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1
    || !Number.isSafeInteger(input.totalMinor) || input.amountMinor > input.totalMinor
    || !/^[A-Za-z0-9_-]{1,64}$/.test(input.requestId) || !input.transactionId) {
    throw new PlatformApiError('INVALID_STATE', 409, 'Invalid refund payment snapshot');
  }
  const configured = input.provider === 'wechat'
    ? wechat.wechatConfigured() && input.merchantAccount === process.env.WECHAT_MCHID && input.currency === 'CNY'
    : input.provider === 'airwallex'
      ? airwallex.airwallexConfigured() && input.merchantAccount === airwallex.airwallexAccountId() && input.currency === 'CNY'
      : input.provider === 'alipay'
        ? alipay.alipayConfigured() && input.merchantAccount === process.env.ALIPAY_APP_ID && input.currency === 'CNY'
        : false;
  if (!configured) throw new PlatformApiError('PAYMENT_NOT_CONFIGURED', 503,
    'Automatic refund is unavailable for this payment provider or merchant account');
}

export function verifyRefundResponse(input: RefundProviderInput, raw: Record<string, unknown>): RefundProviderResult {
  let id: string, status: string, amount: number, currency: string, request: unknown, transaction: unknown;
  if (input.provider === 'wechat') {
    const value = raw.amount as Record<string, unknown> | undefined;
    id = String(raw.refund_id ?? ''); status = String(raw.status ?? '');
    amount = Number(value?.refund); currency = String(value?.currency ?? '');
    request = raw.out_refund_no; transaction = raw.transaction_id;
    if (Number(value?.total) !== input.totalMinor) throw new Error('Refund total does not match payment');
  } else if(input.provider === 'alipay') {
    id=input.requestId; status=String(raw.refund_status ?? '');
    amount=Number(raw.refund_amount)*100;currency='CNY';
    request=raw.out_request_no;transaction=raw.trade_no;
  } else {
    id = String(raw.id ?? ''); status = String(raw.status ?? '');
    amount = Number(raw.amount) * 100; currency = String(raw.currency ?? '');
    request = raw.request_id; transaction = raw.payment_intent_id;
  }
  if (!id || id.length > 200 || request !== input.requestId || transaction !== input.transactionId
    || !Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount))
    || Math.abs(amount - input.amountMinor) > 0.000001 || currency !== input.currency
    || (input.refundId && input.refundId !== id)) throw new Error('Refund response does not match approved payment');
  const succeeded = input.provider === 'wechat' ? status === 'SUCCESS' : input.provider === 'alipay' ? status === 'REFUND_SUCCESS' : status === 'SUCCEEDED';
  const failed = input.provider === 'wechat' ? status === 'CLOSED' : status === 'FAILED';
  const pending = input.provider === 'wechat' ? ['PROCESSING','ABNORMAL'].includes(status) : input.provider === 'alipay' ? !status : ['RECEIVED', 'ACCEPTED'].includes(status);
  if (!succeeded && !failed && !pending) throw new Error('Unknown refund provider state');
  return { id, status: succeeded ? 'succeeded' : failed ? 'failed' : 'pending', providerStatus: status };
}

export async function runProviderRefund(input: RefundProviderInput, allowCreate: boolean): Promise<RefundProviderResult | null> {
  assertRefundProvider(input);
  let raw = input.provider === 'wechat'
    ? await wechat.queryWechatRefund(input.requestId)
    : input.provider === 'alipay' ? await alipay.queryAlipayRefund(input.transactionId,input.requestId)
      : await airwallex.queryAirwallexRefund({ paymentIntentId: input.transactionId, requestId: input.requestId, refundId: input.refundId });
  if (!raw && allowCreate) raw = input.provider === 'wechat'
    ? await wechat.createWechatRefund({ transactionId: input.transactionId, refundNo: input.requestId,
      amountMinor: input.amountMinor, totalMinor: input.totalMinor, reason: input.reason })
    : input.provider === 'alipay' ? await alipay.createAlipayRefund({transactionId:input.transactionId,requestId:input.requestId,
      amountMinor:input.amountMinor,reason:input.reason})
      : await airwallex.createAirwallexRefund({ paymentIntentId: input.transactionId, requestId: input.requestId,
        amountMinor: input.amountMinor, reason: input.reason });
  return raw ? verifyRefundResponse(input, raw) : null;
}
