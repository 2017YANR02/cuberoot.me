/** CubeRoot configuration adapter for the independently versioned payment client. */
import { createWechatPayClient } from '@app-foundation/payments/wechat';

function configuration() {
  return {
    appId: process.env.WECHAT_APPID || '',
    merchantId: process.env.WECHAT_MCHID || '',
    apiV3Key: process.env.WECHAT_API_V3_KEY || '',
    certificateSerial: process.env.WECHAT_CERT_SERIAL || '',
    privateKey: process.env.WECHAT_PRIVATE_KEY || '',
    platformPublicKeyId: process.env.WECHAT_PLATFORM_PUBKEY_ID || '',
    platformPublicKey: process.env.WECHAT_PLATFORM_PUBKEY || '',
    h5Enabled: process.env.WECHAT_H5_ENABLED === 'true',
    miniAppId: process.env.WECHAT_MINI_APP_ID?.trim() || '',
    miniPayEnabled: process.env.WECHAT_MINI_PAY_ENABLED === 'true',
    apiBase: process.env.WECHAT_API_BASE || 'https://api.mch.weixin.qq.com',
  };
}

export function wechatConfigured(): boolean {
  const config = configuration();
  return Boolean(config.appId && config.merchantId && Buffer.byteLength(config.apiV3Key, 'utf8') === 32
    && config.certificateSerial && config.privateKey.trim()
    && config.platformPublicKeyId.startsWith('PUB_KEY_ID_') && config.platformPublicKey.trim());
}

/** H5 and Mini Program Pay are separate merchant products and remain opt-in. */
export function wechatH5Configured(): boolean {
  return wechatConfigured() && configuration().h5Enabled;
}

export function wechatMiniProgramPayConfigured(): boolean {
  const config = configuration();
  return wechatConfigured() && Boolean(config.miniAppId) && config.miniPayEnabled;
}

export function isWechatPaymentAppId(appId: string): boolean {
  const config = configuration();
  return Boolean(appId) && (appId === config.appId || (wechatMiniProgramPayConfigured() && appId === config.miniAppId));
}

// Construction is lazy: an unconfigured optional provider must not prevent API startup.
// The fetch proxy also resolves the current transport for isolated tests.
function client() {
  if (!wechatConfigured()) throw new Error('WeChat Pay is not configured');
  return createWechatPayClient(configuration(), { fetch: (input, init) => fetch(input, init) });
}

export interface WechatMiniProgramPayment {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
}

export async function createWechatMiniProgram(opts: {
  outTradeNo: string; amountCents: number; description: string; notifyUrl: string; openid: string;
}): Promise<WechatMiniProgramPayment> {
  if (!wechatMiniProgramPayConfigured()) throw new Error('WeChat Mini Program Pay is not configured');
  return client().createMiniProgram(opts);
}

export async function createWechatNative(opts: {
  outTradeNo: string; amountCents: number; description: string; notifyUrl: string;
}): Promise<string> {
  return client().createNative(opts);
}

export async function createWechatH5(opts: {
  outTradeNo: string; amountCents: number; description: string; notifyUrl: string; payerClientIp: string;
}): Promise<string> {
  if (!wechatH5Configured()) throw new Error('WeChat H5 Pay is not configured');
  return client().createH5(opts);
}

/** Transport and verification errors propagate; null means a verified missing order. */
export async function queryWechatOrder(outTradeNo: string): Promise<{ paid: boolean; txn?: string; raw: unknown } | null> {
  return client().queryOrder(outTradeNo);
}

export async function createWechatRefund(input: {
  transactionId: string; refundNo: string; amountMinor: number; totalMinor: number; reason: string;
}): Promise<Record<string, unknown>> {
  return client().createRefund(input);
}

export async function queryWechatRefund(refundNo: string): Promise<Record<string, unknown> | null> {
  return client().queryRefund(refundNo);
}

interface WechatSignatureHeaders {
  serial?: string; timestamp?: string; nonce?: string; signature?: string;
}

export function verifyWechatSignature(headers: WechatSignatureHeaders, rawBody: string): boolean {
  try { return client().verifySignature(headers, rawBody); } catch { return false; }
}

/** Verify, decrypt and check merchant identity before exposing the notification. */
export function handleWechatCallback(rawBody: string, headers: WechatSignatureHeaders): {
  ok: boolean; outTradeNo?: string; paid?: boolean; txn?: string; raw?: unknown;
} {
  try {
    const raw = client().parseNotification(rawBody, headers);
    return {
      ok: true,
      outTradeNo: typeof raw.out_trade_no === 'string' ? raw.out_trade_no : undefined,
      paid: raw.trade_state === 'SUCCESS',
      txn: typeof raw.transaction_id === 'string' ? raw.transaction_id : undefined,
      raw,
    };
  } catch { return { ok: false }; }
}
