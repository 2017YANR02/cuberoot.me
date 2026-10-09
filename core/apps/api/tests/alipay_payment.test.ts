import { createSign, createVerify, generateKeyPairSync } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const merchant = generateKeyPairSync('rsa', { modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const provider = generateKeyPairSync('rsa', { modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
let alipay: typeof import('../src/payment/alipay.js');

beforeAll(async () => {
  vi.stubEnv('ALIPAY_APP_ID', 'test-alipay-app');
  vi.stubEnv('ALIPAY_PRIVATE_KEY', merchant.privateKey);
  vi.stubEnv('ALIPAY_PUBLIC_KEY', provider.publicKey);
  vi.stubEnv('ALIPAY_GATEWAY', 'https://openapi.alipay.com/gateway.do');
  vi.stubEnv('ALIPAY_SELLER_ID', 'test-seller');
  alipay = await import('../src/payment/alipay.js');
});
afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function content(params: Record<string, string>, exclude: string[]) {
  return Object.keys(params).filter(key => !exclude.includes(key) && params[key] !== '')
    .sort().map(key => `${key}=${params[key]}`).join('&');
}
function notification(overrides: Record<string, string> = {}) {
  const params: Record<string, string> = { app_id: 'test-alipay-app', seller_id: 'test-seller', notify_id: 'notification-test',
    out_trade_no: 'order-test', trade_no: 'provider-tx', trade_status: 'TRADE_SUCCESS',
    total_amount: '12.34', sign_type: 'RSA2', ...overrides };
  params.sign = createSign('RSA-SHA256').update(content(params, ['sign', 'sign_type'])).sign(provider.privateKey, 'base64');
  return params;
}
function signedResponse(method: string, payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  const sign = createSign('RSA-SHA256').update(raw).sign(provider.privateKey, 'base64');
  return new Response(`{"${method.replaceAll('.', '_')}_response":${raw},"sign":${JSON.stringify(sign)}}`, { status: 200 });
}

describe('shared Alipay configuration adapter', () => {
  it.each(['pc', 'wap'] as const)('preserves the %s checkout contract and signs with its own merchant', (clientType) => {
    const url = new URL(alipay.createAlipayCheckoutUrl({ outTradeNo: 'order-test', amountCents: 1234,
      subject: 'Checkout', clientType, notifyUrl: 'https://example.com/notify', returnUrl: 'https://example.com/return' }));
    const params = Object.fromEntries(url.searchParams);
    expect(url.origin).toBe('https://openapi.alipay.com');
    expect(params.method).toBe(clientType === 'pc' ? 'alipay.trade.page.pay' : 'alipay.trade.wap.pay');
    expect(JSON.parse(params.biz_content)).toMatchObject({ out_trade_no: 'order-test', total_amount: '12.34' });
    expect(createVerify('RSA-SHA256').update(content(params, ['sign'])).verify(merchant.publicKey, params.sign, 'base64')).toBe(true);
  });

  it('accepts only a verified notification for the configured merchant', () => {
    expect(alipay.verifyAlipayNotify(notification())).toBe(true);
    expect(alipay.verifyAlipayNotify(notification({ app_id: 'another-app' }))).toBe(false);
    expect(alipay.verifyAlipayNotify(notification({ seller_id: 'another-seller' }))).toBe(false);
    expect(alipay.verifyAlipayNotify(notification({ notify_id: '' }))).toBe(false);
    expect(alipay.verifyAlipayNotify(notification({ total_amount: '0' }))).toBe(false);
    expect(alipay.verifyAlipayNotify({ ...notification(), total_amount: '99.00' })).toBe(false);
  });

  it('retains the verified query envelope expected by existing callers', async () => {
    const payload = { code: '10000', out_trade_no: 'order-test', trade_no: 'provider-tx', trade_status: 'TRADE_SUCCESS', total_amount: '12.34' };
    const fetchMock = vi.fn().mockResolvedValue(signedResponse('alipay.trade.query', payload));
    vi.stubGlobal('fetch', fetchMock);
    expect(await alipay.queryAlipayTrade('order-test')).toEqual({ paid: true, txn: 'provider-tx', raw: expect.objectContaining({ alipay_trade_query_response: payload }) });
    expect(new URLSearchParams(fetchMock.mock.calls[0][1].body).get('method')).toBe('alipay.trade.query');
  });

  it('rejects an unsigned successful query rather than returning a paid or missing trade', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ alipay_trade_query_response: {
      code: '10000', trade_status: 'TRADE_SUCCESS', trade_no: 'forged',
    } }), { status: 200 })));
    await expect(alipay.queryAlipayTrade('order-test')).rejects.toThrow(/signature/i);
  });

  it('returns null for a verified missing trade', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(signedResponse('alipay.trade.query', { code: '40004', sub_code: 'ACQ.TRADE_NOT_EXIST' })));
    expect(await alipay.queryAlipayTrade('order-test')).toBeNull();
  });

  it('verifies refund identity through a follow-up query using the stable request id', async () => {
    const refund = { code: '10000', trade_no: 'provider-tx', out_request_no: 'stable-refund', refund_status: 'REFUND_SUCCESS', refund_amount: '12.34' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(signedResponse('alipay.trade.refund', { code: '10000', trade_no: 'provider-tx', fund_change: 'N', refund_fee: '12.34' }))
      .mockResolvedValueOnce(signedResponse('alipay.trade.fastpay.refund.query', refund));
    vi.stubGlobal('fetch', fetchMock);
    expect(await alipay.createAlipayRefund({ transactionId: 'provider-tx', requestId: 'stable-refund', amountMinor: 1234, reason: 'Cancelled' })).toEqual(refund);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      expect(JSON.parse(new URLSearchParams(call[1].body).get('biz_content')!)).toMatchObject({ trade_no: 'provider-tx', out_request_no: 'stable-refund' });
    }
  });

  it('keeps an unconfigured provider disabled without startup failure', async () => {
    const previous = process.env.ALIPAY_PRIVATE_KEY;
    vi.stubEnv('ALIPAY_PRIVATE_KEY', '');
    try {
      expect(alipay.alipayConfigured()).toBe(false);
      expect(alipay.verifyAlipayNotify(notification())).toBe(false);
      await expect(alipay.queryAlipayTrade('order-test')).rejects.toThrow('not configured');
    } finally { vi.stubEnv('ALIPAY_PRIVATE_KEY', previous); }
  });
});
