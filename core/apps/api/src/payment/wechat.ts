/**
 * 官方微信支付 APIv3 —— Native(PC 扫码,返回 code_url)+ H5(手机浏览器,返回 h5_url)。
 * 签名 SHA256-RSA2048;回调报文 AEAD_AES_256_GCM 解密(APIv3 密钥为对称密钥)。
 *
 * 资质:营业执照(个人独资企业可开),无对公账户可用法人本人银行卡走认证。appid 须与商户号绑定。
 * 待签消息体构造在 @cuberoot/shared/payment(纯函数,有单测);本模块只做 node:crypto + HTTP。
 *
 * 安全:API 应答与回调都必须用 Wechatpay-Serial 对应的微信支付公钥验签;
 * 回调验签通过后再用 APIv3 密钥做 AEAD 解密。
 */
import { createSign, createVerify, createDecipheriv, randomUUID } from 'node:crypto';
import { buildWechatV3Message, buildWechatV3VerifyMessage } from '@cuberoot/shared/payment';

const BASE = process.env.WECHAT_API_BASE || 'https://api.mch.weixin.qq.com';
const APPID = process.env.WECHAT_APPID || '';
const MCHID = process.env.WECHAT_MCHID || '';
const API_V3_KEY = process.env.WECHAT_API_V3_KEY || ''; // 32 字节
const CERT_SERIAL = process.env.WECHAT_CERT_SERIAL || '';
const PRIVATE_KEY = normalizePem(process.env.WECHAT_PRIVATE_KEY || '', 'PRIVATE KEY');
const PLATFORM_PUBKEY_ID = process.env.WECHAT_PLATFORM_PUBKEY_ID || '';
const PLATFORM_PUBKEY = normalizePem(process.env.WECHAT_PLATFORM_PUBKEY || '', 'PUBLIC KEY');
const H5_ENABLED = process.env.WECHAT_H5_ENABLED === 'true';
const MAX_SIGNATURE_AGE_SECONDS = 300;

export function wechatConfigured(): boolean {
  return Boolean(
    APPID
    && MCHID
    && API_V3_KEY.length === 32
    && CERT_SERIAL
    && PRIVATE_KEY
    && PLATFORM_PUBKEY_ID.startsWith('PUB_KEY_ID_')
    && PLATFORM_PUBKEY,
  );
}

/** H5 是独立签约产品，只有商户平台已开通并显式启用时才可下单。 */
export function wechatH5Configured(): boolean {
  return wechatConfigured() && H5_ENABLED;
}

function normalizePem(raw: string, type: 'PRIVATE KEY' | 'PUBLIC KEY'): string {
  const s = raw.trim();
  if (!s) return '';
  if (s.includes('-----BEGIN')) return s.replace(/\\n/g, '\n');
  const body = s.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') ?? s;
  return `-----BEGIN ${type}-----\n${body}\n-----END ${type}-----`;
}

function sign(content: string): string {
  return createSign('RSA-SHA256').update(content, 'utf8').sign(PRIVATE_KEY, 'base64');
}

// Authorization 头:WECHATPAY2-SHA256-RSA2048 mchid,nonce_str,signature,timestamp,serial_no。
function authToken(method: string, urlPath: string, body: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID().replace(/-/g, '').toUpperCase();
  const signature = sign(buildWechatV3Message({ method, urlPath, timestamp, nonce, body }));
  return `WECHATPAY2-SHA256-RSA2048 mchid="${MCHID}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${CERT_SERIAL}"`;
}

async function apiRequest(
  method: 'GET' | 'POST',
  urlPath: string,
  bodyObj?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const body = bodyObj != null ? JSON.stringify(bodyObj) : '';
  const res = await fetch(BASE + urlPath, {
    method,
    headers: {
      Authorization: authToken(method, urlPath, body),
      'Wechatpay-Serial': PLATFORM_PUBKEY_ID,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'cuberoot-membership/1.0',
    },
    body: method === 'GET' ? undefined : body,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  const signatureOk = verifyWechatSignature({
    serial: res.headers.get('Wechatpay-Serial') ?? undefined,
    timestamp: res.headers.get('Wechatpay-Timestamp') ?? undefined,
    nonce: res.headers.get('Wechatpay-Nonce') ?? undefined,
    signature: res.headers.get('Wechatpay-Signature') ?? undefined,
  }, text);
  if (!signatureOk) throw new Error(`wechat response signature verification failed (${res.status})`);
  let json: Record<string, unknown> = {};
  try { json = text ? (JSON.parse(text) as Record<string, unknown>) : {}; } catch { /* 非 JSON */ }
  return { status: res.status, json };
}

/** Native 下单(PC 扫码):返回 code_url(weixin:// 串,前端生成二维码)。 */
export async function createWechatNative(opts: {
  outTradeNo: string;
  amountCents: number;
  description: string;
  notifyUrl: string;
}): Promise<string> {
  const { status, json } = await apiRequest('POST', '/v3/pay/transactions/native', {
    appid: APPID, mchid: MCHID,
    description: opts.description,
    out_trade_no: opts.outTradeNo,
    notify_url: opts.notifyUrl,
    amount: { total: opts.amountCents, currency: 'CNY' },
  });
  if (status !== 200 || typeof json.code_url !== 'string') {
    throw new Error(`wechat native ${status}: ${JSON.stringify(json)}`);
  }
  return json.code_url;
}

/** H5 下单(手机浏览器,非微信内):返回 h5_url(直接跳转)。 */
export async function createWechatH5(opts: {
  outTradeNo: string;
  amountCents: number;
  description: string;
  notifyUrl: string;
  payerClientIp: string;
}): Promise<string> {
  const { status, json } = await apiRequest('POST', '/v3/pay/transactions/h5', {
    appid: APPID, mchid: MCHID,
    description: opts.description,
    out_trade_no: opts.outTradeNo,
    notify_url: opts.notifyUrl,
    amount: { total: opts.amountCents, currency: 'CNY' },
    scene_info: { payer_client_ip: opts.payerClientIp, h5_info: { type: 'Wap' } },
  });
  if (status !== 200 || typeof json.h5_url !== 'string') {
    throw new Error(`wechat h5 ${status}: ${JSON.stringify(json)}`);
  }
  return json.h5_url;
}

/** 主动查单(轮询补偿)。 */
export async function queryWechatOrder(
  outTradeNo: string,
): Promise<{ paid: boolean; txn?: string; raw: unknown } | null> {
  const urlPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(MCHID)}`;
  try {
    const { status, json } = await apiRequest('GET', urlPath);
    if (status !== 200) return null;
    const state = String(json.trade_state ?? '').toUpperCase();
    return {
      paid: state === 'SUCCESS',
      txn: typeof json.transaction_id === 'string' ? json.transaction_id : undefined,
      raw: json,
    };
  } catch {
    return null;
  }
}

interface WechatResource { ciphertext: string; nonce: string; associated_data?: string }

// AEAD_AES_256_GCM 解密:key=APIv3密钥(32B),iv=resource.nonce(12B),aad=associated_data,
// 密文 base64 解码后末 16 字节为 authTag。
function decryptResource(res: WechatResource): string {
  const key = Buffer.from(API_V3_KEY, 'utf8');
  const cipherBuf = Buffer.from(res.ciphertext, 'base64');
  const authTag = cipherBuf.subarray(cipherBuf.length - 16);
  const data = cipherBuf.subarray(0, cipherBuf.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(res.nonce, 'utf8'));
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(res.associated_data ?? '', 'utf8'));
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

interface WechatSignatureHeaders {
  serial?: string;
  timestamp?: string;
  nonce?: string;
  signature?: string;
}

/** 用 Wechatpay-Serial 对应的微信支付公钥验 API 应答或回调签名。 */
export function verifyWechatSignature(
  headers: WechatSignatureHeaders,
  rawBody: string,
): boolean {
  const { serial, timestamp, nonce, signature } = headers;
  if (!PLATFORM_PUBKEY || !PLATFORM_PUBKEY_ID || serial !== PLATFORM_PUBKEY_ID) return false;
  if (!timestamp || !nonce || !signature) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isInteger(timestampNumber)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > MAX_SIGNATURE_AGE_SECONDS) return false;
  const message = buildWechatV3VerifyMessage({ timestamp, nonce, body: rawBody });
  try {
    return createVerify('RSA-SHA256').update(message, 'utf8').verify(PLATFORM_PUBKEY, signature, 'base64');
  } catch {
    return false;
  }
}

/**
 * 处理支付回调:验签(选配)→ GCM 解密 → 解出订单。
 * 返回 ok=false 时调用方应回 FAIL 且不入账。
 */
export function handleWechatCallback(
  rawBody: string,
  headers: WechatSignatureHeaders,
): { ok: boolean; outTradeNo?: string; paid?: boolean; txn?: string; raw?: unknown } {
  if (!verifyWechatSignature(headers, rawBody)) return { ok: false };
  let envelope: { resource?: WechatResource };
  try { envelope = JSON.parse(rawBody) as { resource?: WechatResource }; } catch { return { ok: false }; }
  if (!envelope.resource?.ciphertext) return { ok: false };

  let decrypted: Record<string, unknown>;
  try {
    decrypted = JSON.parse(decryptResource(envelope.resource)) as Record<string, unknown>;
  } catch {
    return { ok: false }; // 解密失败 = 报文不可信
  }
  const outTradeNo = typeof decrypted.out_trade_no === 'string' ? decrypted.out_trade_no : undefined;
  const paid = String(decrypted.trade_state ?? '').toUpperCase() === 'SUCCESS';
  return {
    ok: true,
    outTradeNo,
    paid,
    txn: typeof decrypted.transaction_id === 'string' ? decrypted.transaction_id : undefined,
    raw: decrypted,
  };
}
