import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ alipay: vi.fn(), wechat: vi.fn(), h5: vi.fn(), checkout: vi.fn() }));
vi.mock('../src/payment/alipay.js', () => ({ alipayConfigured: () => true, queryAlipayTrade: mocks.alipay, createAlipayCheckoutUrl: mocks.checkout }));
vi.mock('../src/payment/wechat.js', () => ({ wechatConfigured: () => true, wechatH5Configured: () => true, wechatMiniProgramPayConfigured: () => false,
  queryWechatOrder: mocks.wechat, createWechatH5: mocks.h5, isWechatPaymentAppId: (id: string) => id === 'fixture-app' }));
vi.mock('../src/utils/account.js', () => ({ findUserByIdentity: vi.fn() }));
vi.mock('../src/utils/wechat_miniprogram.js', () => ({ wechatMiniProgramConfigured: () => false }));
import { createProviderPayment, orderPaymentChannels, queryProviderPayment } from '../src/platform/payment.js';

describe('platform payment provider verification', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('ALIPAY_APP_ID', 'fixture-alipay'); vi.stubEnv('WECHAT_MCHID', 'fixture-merchant'); });
  afterEach(() => vi.unstubAllEnvs());
  const wechat = () => ({ paid: true, txn: 'wx-transaction', raw: { out_trade_no: 'order-A1', transaction_id: 'wx-transaction',
    appid: 'fixture-app', mchid: 'fixture-merchant', trade_state: 'SUCCESS', amount: { total: 5800, currency: 'CNY' } } });
  it('normalizes verified WeChat and Alipay query results into settlement events', async () => {
    mocks.wechat.mockResolvedValue(wechat());
    expect(await queryProviderPayment('wechat', 'order-A1')).toMatchObject({ provider: 'wechat', eventId: 'query:wx-transaction', orderNo: 'order-A1', amountCents: 5800, currency: 'CNY', merchantId: 'fixture-merchant' });
    mocks.alipay.mockResolvedValue({ paid: true, txn: 'ali-transaction', raw: { alipay_trade_query_response: {
      out_trade_no: 'order-A1', trade_no: 'ali-transaction', trade_status: 'TRADE_SUCCESS', total_amount: '58.00' } } });
    expect(await queryProviderPayment('alipay', 'order-A1')).toMatchObject({ provider: 'alipay', eventId: 'query:ali-transaction', amountCents: 5800, currency: 'CNY', merchantId: 'fixture-alipay' });
  });
  it.each([{ out_trade_no: 'other' }, { mchid: 'other' }, { appid: 'other' }, { transaction_id: 'other' },
    { trade_state: 'NOTPAY' }, { amount: { total: 5800, currency: 'USD' } }, { amount: { total: 58.5, currency: 'CNY' } }])('rejects mismatched query evidence: %j', async mismatch => {
    const result = wechat(); mocks.wechat.mockResolvedValue({ ...result, raw: { ...result.raw, ...mismatch } });
    await expect(queryProviderPayment('wechat', 'order-A1')).rejects.toMatchObject({ code: 'PROVIDER_VERIFICATION_FAILED' });
  });
  it('does not settle missing/unpaid trades or absorb provider verification errors', async () => {
    mocks.alipay.mockResolvedValue(null); expect(await queryProviderPayment('alipay', 'order-A1')).toBeNull();
    mocks.wechat.mockResolvedValue({ paid: false }); expect(await queryProviderPayment('wechat', 'order-A1')).toBeNull();
    mocks.wechat.mockRejectedValue(new Error('invalid signature')); await expect(queryProviderPayment('wechat', 'order-A1')).rejects.toThrow('invalid signature');
  });
  it('returns only supported currency channels and preserves the localized H5 return URL', async () => {
    expect(Object.values(orderPaymentChannels('USD'))).toEqual([false, false, false, false]);
    mocks.h5.mockResolvedValue('https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=fixture');
    const result = await createProviderPayment({ provider: 'wechat', clientType: 'wap', orderNo: 'order-A1', returnOrderNo: 'order',
      amountCents: 5800, currency: 'CNY', subject: 'Fixture', payerIp: '127.0.0.1', lang: 'zh' });
    const url = new URL(result.checkoutUrl!);
    expect(url.searchParams.get('prepay_id')).toBe('fixture');
    expect(new URL(url.searchParams.get('redirect_url')!).pathname).toBe('/zh/platform/orders/order');
    expect(mocks.h5).toHaveBeenCalledWith(expect.objectContaining({ outTradeNo: 'order-A1', amountCents: 5800 }));
  });
});
