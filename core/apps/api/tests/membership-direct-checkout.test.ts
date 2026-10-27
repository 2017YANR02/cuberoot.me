import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), alipay: vi.fn(), wechat: vi.fn(), official: true }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: () => ({ wcaId: '2017TEST01', name: 'Test' }), requireAdmin: vi.fn(), checkRateLimit: vi.fn() }));
vi.mock('../src/payment/alipay.js', () => ({ alipayConfigured: () => mocks.official, createAlipayCheckoutUrl: mocks.alipay }));
vi.mock('../src/payment/wechat.js', () => ({ wechatH5Configured: () => mocks.official, wechatConfigured: () => mocks.official, createWechatH5: mocks.wechat }));
import { membershipRoutes } from '../src/routes/membership';

beforeEach(() => {
  vi.clearAllMocks(); mocks.official = true;
  mocks.query.mockImplementation(async (sql: string) => sql.includes('FROM membership_plans') ? [{ slug: 'monthly', name_zh: '月度', price_cents: 2999, currency: 'CNY' }] : []);
  mocks.alipay.mockReturnValue('https://openapi.alipay.com/gateway.do?signed=fixture');
  mocks.wechat.mockResolvedValue('https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=fixture');
});
const order = (body: object) => membershipRoutes.request('/membership/orders', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ plan: 'monthly', channel: 'wechat', clientType: 'wap', language: 'zh', checkoutContext: 'android-direct', ...body }),
});
it('rejects enterprise checkout before creating an order or calling a provider', async () => {
  expect((await order({ plan: 'enterprise_monthly' })).status).toBe(403);
  expect(mocks.query.mock.calls.some(([sql]) => sql.includes('INSERT'))).toBe(false);
  expect(mocks.wechat).not.toHaveBeenCalled();
});
it('allows verified enterprise managers to purchase', async () => {
  mocks.query.mockImplementation(async (sql: string) => sql.includes('AS eligible') ? [{ eligible: true }]
    : sql.includes('FROM membership_plans') ? [{ slug: 'enterprise_monthly', name_zh: '企业月度会员', price_cents: 39900, currency: 'CNY' }] : []);
  expect((await order({ plan: 'enterprise_monthly' })).status).toBe(200);
  expect(mocks.wechat).toHaveBeenCalledTimes(1);
});
it('uses the existing order pipeline and a return page that makes no payment claim', async () => {
  const response = await order({ channel: 'alipay' });
  expect(response.status).toBe(200);
  expect(mocks.alipay).toHaveBeenCalledWith(expect.objectContaining({ clientType: 'wap', returnUrl: 'https://cuberoot.me/zh/membership/checkout?returned=1' }));
  expect(mocks.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO membership_orders'))).toBe(true);
  expect(mocks.query.mock.calls.some(([sql]) => sql.includes('UPDATE memberships'))).toBe(false);
});
it('preserves WeChat prepay parameters and encodes the merchant return URL', async () => {
  const response = await order({}); expect(response.status).toBe(200);
  const result = await response.json() as { url: string };
  const url = new URL(result.url);
  expect(url.searchParams.get('prepay_id')).toBe('fixture');
  expect(url.searchParams.get('redirect_url')).toBe('https://cuberoot.me/zh/membership/checkout?returned=1');
});
it('keeps the normal web Alipay return flow', async () => {
  await order({ channel: 'alipay', checkoutContext: undefined });
  expect(mocks.alipay.mock.calls[0][0].returnUrl).toMatch(/^https:\/\/cuberoot.me\/zh\/membership\?paid=/);
});
it.each([{ clientType: 'pc' }, { channel: 'card_global' }, { channel: 'card_cn' }])('rejects unsupported direct checkout before creating an order: %j', async body => {
  expect((await order(body)).status).toBe(400);
  expect(mocks.query.mock.calls.some(([sql]) => sql.includes('INSERT'))).toBe(false);
});
it('does not downgrade direct checkout to an unapproved provider', async () => {
  mocks.official = false;
  expect((await order({})).status).toBe(400);
  expect(mocks.query.mock.calls.some(([sql]) => sql.includes('INSERT'))).toBe(false);
});
