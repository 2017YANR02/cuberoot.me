/** Legacy WeChat entrusted-payment contracts use APIv2, not the Native APIv3 key. */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';

type Fields = Record<string, string>;
export interface PapayContract {
  appid: string;
  mch_id: string;
  plan_id: string;
  contract_code: string;
  contract_id: string | null;
}
export interface PapayNotification extends PapayContract { openid: string }
export type ContractState = 'pending' | 'active' | 'terminated';
export class PapayUnavailable extends Error {
  constructor() { super('subscription management unavailable'); }
}

export function papayConfig() {
  const appid = process.env.WECHAT_PAPAY_APPID || '';
  const mchId = process.env.WECHAT_PAPAY_MCHID || '';
  const key = process.env.WECHAT_PAPAY_API_V2_KEY || '';
  if (!/^wx[a-zA-Z0-9]{16}$/.test(appid) || !/^\d+$/.test(mchId) || !/^[a-zA-Z0-9]{32}$/.test(key)) {
    throw new PapayUnavailable();
  }
  return { appid, mchId, key };
}
const config = papayConfig;
export function papayConfigured(): boolean {
  try { config(); return true; } catch { return false; }
}

// The provider's v2 contract endpoints require this MD5 signature (not password hashing).
export function signPapay(fields: Fields, key: string): string {
  const canonical = Object.keys(fields).filter((k) => k !== 'sign' && fields[k] !== '').sort()
    .map((k) => `${k}=${fields[k]}`).join('&');
  return createHash('md5').update(`${canonical}&key=${key}`, 'utf8').digest('hex').toUpperCase();
}

function parseFlatXml(xml: string): Fields {
  // Flat signed XML only. Reject entities/DTD, duplicate fields, attributes and nested data.
  if (Buffer.byteLength(xml) > 65536 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) {
    throw new Error('invalid subscription response');
  }
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: false,
    ignoreDeclaration: true }).parse(xml) as Record<string, unknown>;
  const fields = parsed.xml;
  // WeChat pretty-prints responses. Ignore only inter-element XML whitespace;
  // keep signed field values untouched and reject non-whitespace mixed content.
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    const text = (fields as Record<string, unknown>)['#text'];
    if (typeof text === 'string' && /^[\t\r\n ]*$/.test(text)) {
      delete (fields as Record<string, unknown>)['#text'];
    }
  }
  if (Object.keys(parsed).length !== 1 || !fields || typeof fields !== 'object' || Array.isArray(fields)
    || Object.entries(fields).some(([k, v]) => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k) || typeof v !== 'string')) {
    throw new Error('invalid subscription response');
  }
  return fields as Fields;
}

function parseSignedPapayXml(xml: string, key: string): Fields {
  const result = parseFlatXml(xml);
  if (!/^[A-F0-9]{32}$/.test(result.sign || '')
    || !timingSafeEqual(Buffer.from(result.sign), Buffer.from(signPapay(result, key)))) {
    // Never trust an unsigned error as evidence that a contract no longer exists.
    throw new Error('unverified subscription response');
  }
  return result;
}

async function readResponse(response: Response): Promise<string> {
  if (!response.ok || !response.body) throw new PapayUnavailable();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) throw new PapayUnavailable();
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}

export const PAPAY_CONTRACT_NOTIFY = 'https://api.cuberoot.me/v1/membership/subscriptions/wechat/notify';
export const PAPAY_PAYMENT_NOTIFY = 'https://api.cuberoot.me/v1/membership/subscriptions/wechat/payment-notify';

/** Client receives a signed, immutable authorization request, never the merchant secret. */
export function createPapayMiniEnrollment(contract: PapayContract, serial: string, displayAccount: string) {
  const { appid, mchId, key } = config();
  const requestSerial = Number(serial);
  if (contract.appid !== appid || contract.mch_id !== mchId
    || !Number.isSafeInteger(requestSerial) || requestSerial <= 0) throw new PapayUnavailable();
  const fields: Fields = { appid, mch_id: mchId, plan_id: contract.plan_id,
    contract_code: contract.contract_code, request_serial: serial,
    contract_display_account: displayAccount, notify_url: PAPAY_CONTRACT_NOTIFY,
    timestamp: String(Math.floor(Date.now() / 1000)) };
  return { appId: 'wxbd687630cd02ce1d', path: 'pages/index/index',
    extraData: { ...fields, sign: signPapay(fields, key), request_serial: requestSerial, timestamp: Number(fields.timestamp) } };
}

/** The H5 response is unsigned; only its HTTPS WeChat redirect is consumed, never entitlement. */
export async function createPapayEnrollment(contract: PapayContract, serial: string, clientip: string): Promise<string> {
  const { appid, mchId, key } = config();
  if (contract.appid !== appid || contract.mch_id !== mchId || !isIP(clientip)) throw new PapayUnavailable();
  const fields: Fields = { appid, mch_id: mchId, plan_id: contract.plan_id,
    contract_code: contract.contract_code, request_serial: serial,
    contract_display_account: `CubeRoot ${contract.contract_code.slice(-12)}`, notify_url: PAPAY_CONTRACT_NOTIFY,
    version: '1.0', sign_type: 'MD5', timestamp: String(Math.floor(Date.now() / 1000)), clientip };
  fields.sign = signPapay(fields, key);
  const response = await fetch(`https://api.mch.weixin.qq.com/papay/h5entrustweb?${new URLSearchParams(fields)}`, {
    signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  const result = parseFlatXml(await readResponse(response));
  if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') throw new PapayUnavailable();
  const url = new URL(result.redirect_url);
  if (url.protocol !== 'https:' || url.hostname !== 'payapp.weixin.qq.com' || url.username || url.password || url.port) {
    throw new PapayUnavailable();
  }
  return url.href;
}

async function paymentRequest(action: 'pappayapply' | 'orderquery', fields: Fields): Promise<Fields> {
  const { appid, mchId, key } = config();
  const request = { ...fields, appid, mch_id: mchId, nonce_str: randomBytes(16).toString('hex') };
  const response = await fetch(`https://api.mch.weixin.qq.com/pay/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    body: new XMLBuilder().build({ xml: { ...request, sign: signPapay(request, key) } }),
    signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  const result = parsePapayResponse(await readResponse(response), key);
  if (result.appid !== appid || result.mch_id !== mchId) throw new PapayUnavailable();
  return result;
}

/** Acceptance is not proof of payment. A lost response must be reconciled using the SAME order. */
export async function applyPapayDebit(contract: PapayContract, orderNo: string, cents: number): Promise<void> {
  const { appid, mchId } = config();
  if (contract.appid !== appid || contract.mch_id !== mchId || !contract.contract_id
    || !Number.isSafeInteger(cents) || cents <= 0 || !/^[a-zA-Z0-9]{1,32}$/.test(orderNo)) throw new PapayUnavailable();
  await paymentRequest('pappayapply', { contract_id: contract.contract_id, out_trade_no: orderNo,
    total_fee: String(cents), fee_type: 'CNY', trade_type: 'PAP', body: 'CubeRoot 会员自动续费', notify_url: PAPAY_PAYMENT_NOTIFY });
}

export async function queryPapayDebit(orderNo: string): Promise<Fields> {
  const result = await paymentRequest('orderquery', { out_trade_no: orderNo });
  if (result.out_trade_no !== orderNo) throw new PapayUnavailable();
  return result;
}

export function verifyPapayPaymentNotification(xml: string): Fields {
  const { appid, mchId, key } = config();
  const result = parsePapayResponse(xml, key);
  if (result.appid !== appid || result.mch_id !== mchId || result.trade_type !== 'PAP' || !result.out_trade_no) {
    throw new PapayUnavailable();
  }
  return result;
}

export function parsePapayResponse(xml: string, key: string): Fields {
  const result = parseSignedPapayXml(xml, key);
  if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') {
    throw new Error('unverified subscription response');
  }
  return result;
}

/** Notifications omit appid; use only our configured app and an existing saved contract. */
export function verifyPapayNotification(xml: string): PapayNotification {
  const { appid, mchId, key } = config();
  const fields = parsePapayResponse(xml, key);
  if (fields.mch_id !== mchId || (fields.appid && fields.appid !== appid)
    || !fields.plan_id || !fields.contract_code || !fields.contract_id || !fields.openid
    || !fields.operate_time || !['ADD', 'DELETE'].includes(fields.change_type)) {
    throw new Error('subscription notification binding mismatch');
  }
  return { appid, mch_id: mchId, plan_id: fields.plan_id,
    contract_code: fields.contract_code, contract_id: fields.contract_id, openid: fields.openid };
}

async function request(action: 'querycontract' | 'deletecontract', contract: PapayContract): Promise<Fields> {
  const { appid, mchId, key } = config();
  if (contract.appid !== appid || contract.mch_id !== mchId) throw new PapayUnavailable();
  const fields: Fields = { appid, mch_id: mchId, version: '1.0', plan_id: contract.plan_id,
    contract_code: contract.contract_code };
  if (action === 'deletecontract') fields.contract_termination_remark = '用户在会员管理页面主动取消自动续费';
  fields.sign = signPapay(fields, key);
  const response = await fetch(`https://api.mch.weixin.qq.com/papay/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    body: new XMLBuilder().build({ xml: fields }), signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  const result = parsePapayResponse(await readResponse(response), key);
  if (result.appid !== appid || result.mch_id !== mchId || result.plan_id !== contract.plan_id
    || result.contract_code !== contract.contract_code || !result.contract_id
    || (contract.contract_id && result.contract_id !== contract.contract_id)) {
    throw new Error('subscription response binding mismatch');
  }
  return result;
}

export async function queryPapayContract(contract: PapayContract, expectedOpenid?: string): Promise<{ state: ContractState; contractId: string }> {
  const result = await request('querycontract', contract);
  if (expectedOpenid !== undefined && result.openid !== expectedOpenid) {
    throw new Error('subscription response binding mismatch');
  }
  const states: Record<string, ContractState> = { '0': 'active', '1': 'terminated', '9': 'pending' };
  if (!Object.hasOwn(states, result.contract_state)) throw new Error('unknown subscription state');
  const state = states[result.contract_state];
  return { state, contractId: result.contract_id };
}

export async function cancelPapayContract(contract: PapayContract): Promise<{ state: 'terminated'; contractId: string }> {
  const result = await request('deletecontract', contract);
  // A successful, signed and bound deletion response is the provider's confirmation.
  return { state: 'terminated', contractId: result.contract_id };
}
