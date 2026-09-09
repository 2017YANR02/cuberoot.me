/** Legacy WeChat entrusted-payment contracts use APIv2, not the Native APIv3 key. */
import { createHash, timingSafeEqual } from 'node:crypto';
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

function config() {
  const appid = process.env.WECHAT_PAPAY_APPID || '';
  const mchId = process.env.WECHAT_PAPAY_MCHID || '';
  const key = process.env.WECHAT_PAPAY_API_V2_KEY || '';
  if (!/^wx[a-zA-Z0-9]{16}$/.test(appid) || !/^\d+$/.test(mchId) || !/^[a-zA-Z0-9]{32}$/.test(key)) {
    throw new PapayUnavailable();
  }
  return { appid, mchId, key };
}
export function papayConfigured(): boolean {
  try { config(); return true; } catch { return false; }
}

// The provider's v2 contract endpoints require this MD5 signature (not password hashing).
export function signPapay(fields: Fields, key: string): string {
  const canonical = Object.keys(fields).filter((k) => k !== 'sign' && fields[k] !== '').sort()
    .map((k) => `${k}=${fields[k]}`).join('&');
  return createHash('md5').update(`${canonical}&key=${key}`, 'utf8').digest('hex').toUpperCase();
}

function parseSignedPapayXml(xml: string, key: string): Fields {
  // Flat signed XML only. Reject entities/DTD, duplicate fields, attributes and nested data.
  if (Buffer.byteLength(xml) > 65536 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) {
    throw new Error('invalid subscription response');
  }
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: false,
    ignoreDeclaration: true }).parse(xml) as Record<string, unknown>;
  const fields = parsed.xml;
  if (Object.keys(parsed).length !== 1 || !fields || typeof fields !== 'object' || Array.isArray(fields)
    || Object.entries(fields).some(([k, v]) => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k) || typeof v !== 'string')) {
    throw new Error('invalid subscription response');
  }
  const result = fields as Fields;
  if (!/^[A-F0-9]{32}$/.test(result.sign || '')
    || !timingSafeEqual(Buffer.from(result.sign), Buffer.from(signPapay(result, key)))) {
    // Never trust an unsigned error as evidence that a contract no longer exists.
    throw new Error('unverified subscription response');
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
  if (!response.ok) throw new Error('subscription provider unavailable');
  // Bound streaming response size as well as the XML parser's input size.
  const reader = response.body?.getReader();
  if (!reader) throw new Error('empty subscription response');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) throw new Error('oversized subscription response');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const result = parsePapayResponse(Buffer.concat(chunks).toString('utf8'), key);
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
