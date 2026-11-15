import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';

const mocks = vi.hoisted(() => ({ query: vi.fn(), tx: vi.fn(), cancel: vi.fn(), remoteQuery: vi.fn(), configured: vi.fn(),
  checkoutAvailable: vi.fn(() => false), checkout: vi.fn(), checkoutStatus: vi.fn() }));
vi.mock('../src/payment/membership-checkout.js', () => ({ refreshMembershipCheckouts: vi.fn(), membershipCheckoutAvailable: mocks.checkoutAvailable,
  createMembershipCheckout: mocks.checkout, getMembershipCheckout: mocks.checkoutStatus }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query, withTransaction: (run: (tx: unknown) => unknown) => run(mocks.tx) }));
vi.mock('../src/payment/wechat-papay.js', () => ({ cancelPapayContract: mocks.cancel, queryPapayContract: mocks.remoteQuery, papayConfigured: mocks.configured }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: async (c: { req: { header: (name: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'Bearer owner') throw new HTTPException(401);
    return { wcaId: 'u42' };
  }, checkRateLimit: vi.fn(),
}));
import { membershipSubscriptionRoutes } from '../src/routes/membership_subscriptions.js';

const id = '12345678-1234-1234-1234-123456789012';
let row: Record<string, unknown>;
function request(method: string, path: string, body?: unknown, auth = true) {
  return membershipSubscriptionRoutes.request('/membership/subscriptions' + path, { method,
    headers: { ...(auth ? { Authorization: 'Bearer owner' } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const cancel = (body: unknown = { confirm: true }) => request('POST', `/${id}/cancel`, body);

describe('payment enrollment checkout API', () => {
  const orderNo = 'C' + 'a'.repeat(30);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configured.mockReturnValue(true);
    mocks.checkoutAvailable.mockReturnValue(true);
    mocks.checkout.mockResolvedValue({ outTradeNo: orderNo, tradeType: 'NATIVE', checkoutUrl: 'weixin://wxpay/s/fixture' });
  });
  it('requires authentication for creation and status, and gates new sales', async () => {
    expect((await request('POST', '/checkout', {}, false)).status).toBe(401);
    expect((await request('GET', `/checkout/${orderNo}`, undefined, false)).status).toBe(401);
    mocks.checkoutAvailable.mockReturnValue(false);
    expect((await request('POST', '/checkout', {})).status).toBe(503);
    expect(mocks.checkout).not.toHaveBeenCalled();
    expect(mocks.checkoutStatus).not.toHaveBeenCalled();
  });
  it('returns an uncached Native QR using the shared checkout response contract', async () => {
    const res = await request('POST', '/checkout', { agreed: true });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ outTradeNo: orderNo, channel: 'wechat', provider: 'wechat', qrcode: expect.stringMatching(/^data:image\/png;base64,/) });
    expect(mocks.checkout).toHaveBeenCalledWith('u42', { agreed: true }, expect.any(String));
  });
  it('returns H5 to the local subscription page, ignoring a supplied redirect', async () => {
    mocks.checkout.mockResolvedValueOnce({ outTradeNo: orderNo, tradeType: 'MWEB', checkoutUrl: 'https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=fixture' });
    const res = await request('POST', '/checkout', { language: 'zh', redirect_url: 'https://untrusted.example' });
    const url = new URL((await res.json()).url);
    expect(new URL(url.searchParams.get('redirect_url')!).pathname).toBe('/zh/membership/subscription');
    expect(url.href).not.toContain('untrusted.example');
  });
  it('keeps owned status queries available after sales close and hides missing orders', async () => {
    mocks.checkoutAvailable.mockReturnValue(false);
    mocks.checkoutStatus.mockResolvedValueOnce({ status: 'paid', paymentVerified: true, subscription: { state: 'pending' } }).mockResolvedValueOnce(null);
    expect((await request('GET', '/checkout/bad')).status).toBe(404);
    expect(mocks.checkoutStatus).not.toHaveBeenCalled();
    expect((await request('GET', `/checkout/${orderNo}`)).status).toBe(200);
    expect(mocks.checkoutStatus).toHaveBeenCalledWith('u42', orderNo);
    expect((await request('GET', `/checkout/${orderNo}`)).status).toBe(404);
  });
});

describe('owned membership cancellation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    row = { id, wca_id: 'u42', appid: 'app', mch_id: 'merchant', plan_id: 'template', contract_code: 'code', contract_id: 'provider-id',
      plan_slug: 'monthly_auto_renew', price_cents: 2999, currency: 'CNY', period: 'month', period_count: 1,
      state: 'active', cancellation_requested_at: null, verified_at: null, created_at: '2026-09-09T00:00:00Z' };
    mocks.configured.mockReturnValue(true);
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('UPDATE')) row.cancellation_requested_at = '2026-09-09T01:00:00Z';
      return [{ ...row }];
    });
    mocks.tx.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('COALESCE')) row.cancellation_requested_at = '2026-09-09T01:00:00Z';
      else if (sql.startsWith('UPDATE')) { row.state = params[0]; row.contract_id = params[1]; row.verified_at = '2026-09-09T02:00:00Z'; }
      return [{ ...row }];
    });
    mocks.cancel.mockResolvedValue({ state: 'terminated', contractId: 'provider-id' });
    mocks.remoteQuery.mockResolvedValue({ state: 'active', contractId: 'provider-id' });
  });
  it('requires authentication before querying or writing any contract', async () => {
    expect((await request('GET', '', undefined, false)).status).toBe(401);
    expect((await request('POST', `/${id}/cancel`, { confirm: true }, false)).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it.each([{}, { confirm: false }, { confirm: 'true' }, null])('requires explicit confirmation %j', async (body) => {
    expect((await cancel(body)).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rejects malformed ids and hides another owner exactly like an absent record', async () => {
    expect((await request('POST', '/bad/cancel', { confirm: true })).status).toBe(400);
    mocks.tx.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce([]);
    expect((await cancel()).status).toBe(404);
    expect(mocks.tx).toHaveBeenLastCalledWith(expect.stringContaining('AND wca_id = ?'), [id, 'u42']);
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it('commits cancellation intent before calling WeChat; returns only public fields and never changes paid benefits', async () => {
    mocks.cancel.mockImplementation(async () => {
      expect(row.cancellation_requested_at).not.toBeNull();
      return { state: 'terminated', contractId: 'provider-id' };
    });
    const res = await cancel();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const { subscription } = await res.json();
    expect(subscription.state).toBe('terminated');
    expect(subscription.cancellationRequested).toBe(true);
    for (const field of ['wca_id', 'appid', 'mch_id', 'plan_id', 'contract_id', 'contract_code']) expect(subscription).not.toHaveProperty(field);
    for (const [sql] of [...mocks.query.mock.calls, ...mocks.tx.mock.calls]) {
      expect(sql).not.toMatch(/(?:UPDATE|DELETE FROM) memberships\b/);
      expect(sql).not.toContain('membership_orders');
    }
  });
  it('returns 202 rather than claiming success after both remote calls time out', async () => {
    mocks.cancel.mockRejectedValueOnce(new Error('timeout'));
    mocks.remoteQuery.mockRejectedValueOnce(new Error('timeout'));
    const res = await cancel();
    expect(res.status).toBe(202);
    expect((await res.json()).subscription).toMatchObject({ state: 'active', cancellationRequested: true, syncStatus: 'unavailable' });
    expect(row.state).toBe('active');
  });
  it('recovers a lost deletion reply by querying the verified terminal state', async () => {
    mocks.cancel.mockRejectedValueOnce(new Error('reply lost'));
    mocks.remoteQuery.mockResolvedValueOnce({ state: 'terminated', contractId: 'provider-id' });
    expect((await cancel()).status).toBe(200);
    expect(row.state).toBe('terminated');
  });
  it('is idempotent after confirmed termination, including when configuration is removed', async () => {
    row.state = 'terminated';
    mocks.configured.mockReturnValue(false);
    expect((await cancel()).status).toBe(200);
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it('retains intent and returns 503 when provider configuration is missing', async () => {
    mocks.configured.mockReturnValue(false);
    expect((await cancel()).status).toBe(503);
    expect(row.cancellation_requested_at).not.toBeNull();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it('allows pending-contract cancellation', async () => {
    row.state = 'pending';
    expect((await cancel()).status).toBe(200);
  });
  it('refresh discovers WeChat-side termination without sending a cancellation', async () => {
    mocks.remoteQuery.mockResolvedValueOnce({ state: 'terminated', contractId: 'provider-id' });
    const res = await request('GET', '');
    expect(res.status).toBe(200);
    expect((await res.json()).subscriptions[0].state).toBe('terminated');
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('WHERE wca_id = ?'), ['u42']);
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it('preserves the old state but flags a failed refresh, and distinguishes an empty local list', async () => {
    mocks.remoteQuery.mockRejectedValueOnce(new Error('offline'));
    expect((await (await request('GET', '')).json()).subscriptions[0]).toMatchObject({ state: 'active', syncStatus: 'unavailable' });
    mocks.query.mockResolvedValueOnce([]);
    expect(await (await request('GET', '')).json()).toEqual({ subscriptions: [], managementAvailable: true });
  });
  it('a terminal row observed under lock cannot be overwritten by a stale list snapshot', async () => {
    mocks.tx.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce([{ ...row, state: 'terminated' }]);
    expect((await (await request('GET', '')).json()).subscriptions[0].state).toBe('terminated');
    expect(mocks.remoteQuery).not.toHaveBeenCalled();
  });
  it('limits DB lock queues and reports contention without claiming a cancellation', async () => {
    mocks.tx.mockRejectedValueOnce(Object.assign(new Error('lock unavailable'), { code: '55P03' }));
    const res = await cancel();
    expect(res.status).toBe(503);
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.tx).toHaveBeenCalledWith("SET LOCAL lock_timeout = '1000ms'");
    expect(res.headers.get('Retry-After')).toBe('2');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
