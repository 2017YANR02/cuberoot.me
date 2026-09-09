import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { cancelPapayContract, papayConfigured, parsePapayResponse, queryPapayContract, signPapay, verifyPapayNotification } from '../src/payment/wechat-papay.js';

const key = '192006250b4c09247ec02edce69f6a2d';
const contract = { appid: 'wxd930ea5d5a258f4f', mch_id: '10000100', plan_id: '123', contract_code: 'own-order', contract_id: 'wx-contract' };
const responseFields = { return_code: 'SUCCESS', result_code: 'SUCCESS', ...contract, contract_state: '0' };
const xml = (fields: Record<string, string>) => new XMLBuilder().build({ xml: { ...fields, sign: signPapay(fields, key) } });
const fetchMock = vi.fn();

describe('WeChat APIv2 entrusted-payment contract transport', () => {
  beforeEach(() => {
    vi.stubEnv('WECHAT_PAPAY_APPID', contract.appid);
    vi.stubEnv('WECHAT_PAPAY_MCHID', contract.mch_id);
    vi.stubEnv('WECHAT_PAPAY_API_V2_KEY', key);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset().mockImplementation(async () => new Response(xml(responseFields)));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('matches the official MD5 example exactly', () => {
    expect(signPapay({ appid: contract.appid, mch_id: contract.mch_id, device_info: '1000', body: 'test', nonce_str: 'ibuaiVcKdpRxkhJA' }, key))
      .toBe('9A0A8659F005D6984697E2CA0A9CF3B7');
  });
  it.each([['0', 'active'], ['1', 'terminated'], ['9', 'pending']])('maps state %s to %s', async (code, state) => {
    fetchMock.mockResolvedValueOnce(new Response(xml({ ...responseFields, contract_state: code })));
    expect(await queryPapayContract(contract)).toEqual({ state, contractId: contract.contract_id });
  });
  it('sends a signed v2 deletion with the saved template/code, not v3 credentials', async () => {
    expect(await cancelPapayContract(contract)).toEqual({ state: 'terminated', contractId: contract.contract_id });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mch.weixin.qq.com/papay/deletecontract');
    expect(init.redirect).toBe('error');
    const fields = new XMLParser({ parseTagValue: false }).parse(init.body).xml;
    expect(fields.version).toBe('1.0');
    expect(fields.contract_code).toBe(contract.contract_code);
    expect(fields.plan_id).toBe(contract.plan_id);
    expect(fields.contract_termination_remark).toBeTruthy();
    expect(fields.sign).toBe(signPapay(fields, key));
  });
  it.each(['appid', 'mch_id', 'plan_id', 'contract_code', 'contract_id'])('rejects a signed response for another %s', async (field) => {
    fetchMock.mockResolvedValueOnce(new Response(xml({ ...responseFields, [field]: 'other' })));
    await expect(cancelPapayContract(contract)).rejects.toThrow('binding mismatch');
  });
  it('does not treat missing-contract errors, unsigned responses or unknown states as cancellation', async () => {
    fetchMock.mockResolvedValueOnce(new Response(xml({ ...responseFields, result_code: 'FAIL', err_code: 'CONTRACTNOTEXIST' })));
    await expect(cancelPapayContract(contract)).rejects.toThrow('unverified');
    fetchMock.mockResolvedValueOnce(new Response('<xml><return_code>FAIL</return_code></xml>'));
    await expect(queryPapayContract(contract)).rejects.toThrow('unverified');
    fetchMock.mockResolvedValueOnce(new Response(xml({ ...responseFields, contract_state: '99' })));
    await expect(queryPapayContract(contract)).rejects.toThrow('unknown');
    for (const state of ['constructor', 'toString', '__proto__']) {
      fetchMock.mockResolvedValueOnce(new Response(xml({ ...responseFields, contract_state: state })));
      await expect(queryPapayContract(contract)).rejects.toThrow('unknown');
    }
  });
  it.each([
    '<!DOCTYPE xml [<!ENTITY x "value">]><xml><sign>&x;</sign></xml>',
    '<xml><sign>one</sign><sign>two</sign></xml>',
    '<xml><sign><nested>value</nested></sign></xml>',
    '<xml attr="x"><sign>value</sign></xml>',
    '<xml><sign>unclosed</xml>',
    '<xml><sign>' + 'x'.repeat(65536) + '</sign></xml>',
  ])('rejects malformed, duplicated or oversized XML', (body) => {
    expect(() => parsePapayResponse(body, key)).toThrow();
  });
  it('rejects tampering even when both success codes remain', () => {
    expect(() => parsePapayResponse(xml(responseFields).replace('own-order', 'tampered'), key)).toThrow('unverified');
  });
  it('fails closed when dedicated v2 configuration is absent or mismatched', async () => {
    vi.stubEnv('WECHAT_PAPAY_API_V2_KEY', '');
    expect(papayConfigured()).toBe(false);
    await expect(cancelPapayContract(contract)).rejects.toThrow('unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv('WECHAT_PAPAY_API_V2_KEY', key);
    await expect(cancelPapayContract({ ...contract, appid: 'other' })).rejects.toThrow('unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects HTTP errors and transport failures', async () => {
    fetchMock.mockResolvedValueOnce(new Response('error', { status: 503 }));
    await expect(queryPapayContract(contract)).rejects.toThrow();
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    await expect(cancelPapayContract(contract)).rejects.toThrow('timeout');
  });
  it.each(['ADD', 'DELETE'])('verifies %s notifications without an appid field', (change_type) => {
    const { appid: _appid, ...binding } = contract;
    expect(verifyPapayNotification(xml({ ...binding, return_code: 'SUCCESS', result_code: 'SUCCESS', openid: 'provider-user', change_type,
      operate_time: '2026-09-09 12:00:00' }))).toEqual({ ...contract, openid: 'provider-user' });
  });
  it.each(['mch_id', 'appid', 'change_type'])('rejects wrong notification %s', (field) => {
    expect(() => verifyPapayNotification(xml({ ...contract, return_code: 'SUCCESS', result_code: 'SUCCESS', openid: 'provider-user', change_type: 'ADD',
      operate_time: '2026-09-09 12:00:00', [field]: 'other' }))).toThrow();
  });
  it('compares the notification user against the signed query response', async () => {
    for (const openid of ['', 'another-user']) {
      fetchMock.mockResolvedValueOnce(new Response(xml({ ...responseFields, openid })));
      await expect(queryPapayContract(contract, 'provider-user')).rejects.toThrow('binding mismatch');
    }
    fetchMock.mockResolvedValueOnce(new Response(xml({ ...responseFields, openid: 'provider-user' })));
    expect(await queryPapayContract(contract, 'provider-user')).toEqual({ state: 'active', contractId: contract.contract_id });
  });
  it.each(['plan_id', 'contract_code', 'contract_id', 'openid', 'operate_time', 'return_code', 'result_code'])('rejects absent notification %s', (field) => {
    expect(() => verifyPapayNotification(xml({ ...contract, return_code: 'SUCCESS', result_code: 'SUCCESS', openid: 'provider-user', change_type: 'ADD',
      operate_time: '2026-09-09 12:00:00', [field]: '' }))).toThrow();
  });
});
