import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { XMLBuilder } from 'fast-xml-parser';

const mocks = vi.hoisted(() => ({ query: vi.fn(), tx: vi.fn(), remote: vi.fn(), cancel: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query,
  withTransaction: (run: (tx: unknown) => unknown) => run(mocks.tx) }));
vi.mock('../src/payment/wechat-papay.js', async (original) => ({
  ...await original<typeof import('../src/payment/wechat-papay.js')>(),
  queryPapayContract: mocks.remote, cancelPapayContract: mocks.cancel,
}));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: vi.fn(), checkRateLimit: vi.fn() }));
import { membershipSubscriptionRoutes } from '../src/routes/membership_subscriptions.js';
import { signPapay } from '../src/payment/wechat-papay.js';

const key = '192006250b4c09247ec02edce69f6a2d';
const binding = { appid: 'wxd930ea5d5a258f4f', mch_id: '10000100', plan_id: '123',
  contract_code: 'ownorder', contract_id: 'wx-contract' };
let row: Record<string, unknown>;
function notification(change_type = 'DELETE') {
  const { appid: _appid, ...fields } = binding;
  const payload = { ...fields, return_code: 'SUCCESS', result_code: 'SUCCESS', change_type, openid: 'wx-user', operate_time: '2026-09-09 12:00:00' };
  return new XMLBuilder().build({ xml: { ...payload, sign: signPapay(payload, key) } });
}
const send = (body = notification()) => membershipSubscriptionRoutes.request('/membership/subscriptions/wechat/notify', {
  method: 'POST', headers: { 'Content-Type': 'application/xml' }, body,
});

describe('signed contract notifications reconcile only trusted existing ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('WECHAT_PAPAY_APPID', binding.appid);
    vi.stubEnv('WECHAT_PAPAY_MCHID', binding.mch_id);
    vi.stubEnv('WECHAT_PAPAY_API_V2_KEY', key);
    row = { ...binding, id: 'saved-id', wca_id: 'u42', state: 'active', cancellation_requested_at: null };
    mocks.query.mockImplementation(async () => [{ ...row }]);
    mocks.tx.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('UPDATE')) { row.state = params[0]; row.contract_id = params[1]; }
      return [{ ...row }];
    });
    mocks.remote.mockResolvedValue({ state: 'terminated', contractId: binding.contract_id });
  });
  afterEach(() => vi.unstubAllEnvs());
  it('acknowledges only after verified provider state has been saved; does not debit or change benefits', async () => {
    const response = await send();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Type')).toContain('application/xml');
    expect(await response.text()).toContain('[CDATA[SUCCESS]]');
    expect(row.state).toBe('terminated');
    expect(mocks.remote).toHaveBeenCalledWith(expect.objectContaining(binding), 'wx-user');
    expect(mocks.cancel).not.toHaveBeenCalled();
    for (const [sql] of [...mocks.tx.mock.calls, ...mocks.query.mock.calls]) {
      expect(sql).not.toMatch(/INSERT|membership_orders|UPDATE memberships\b/);
    }
  });
  it('does not treat DELETE itself as proof when current provider state is active', async () => {
    mocks.remote.mockResolvedValueOnce({ state: 'active', contractId: binding.contract_id });
    expect(await (await send()).text()).toContain('[CDATA[SUCCESS]]');
    expect(row.state).toBe('active');
  });
  it('repeated DELETE and late ADD cannot resurrect a terminated contract', async () => {
    await send();
    await send();
    expect(await (await send(notification('ADD'))).text()).toContain('[CDATA[SUCCESS]]');
    expect(row.state).toBe('terminated');
    expect(mocks.remote).toHaveBeenCalledTimes(1);
  });
  it('requests retry without creating unknown records', async () => {
    mocks.query.mockResolvedValueOnce([]);
    expect(await (await send()).text()).toContain('[CDATA[FAIL]]');
    expect(mocks.tx).not.toHaveBeenCalled();
  });
  it.each(['appid', 'mch_id', 'plan_id', 'contract_code', 'contract_id'])('rechecks %s under lock', async (field) => {
    row[field] = 'other';
    expect(await (await send()).text()).toContain('[CDATA[FAIL]]');
    expect(mocks.remote).not.toHaveBeenCalled();
  });
  it('rejects tampering before accessing the database', async () => {
    expect(await (await send(notification().replace('ownorder', 'tampered'))).text()).toContain('[CDATA[FAIL]]');
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('requests retry on provider failure and DB contention without claiming success', async () => {
    mocks.remote.mockRejectedValueOnce(new Error('offline'));
    expect(await (await send()).text()).toContain('[CDATA[FAIL]]');
    expect(row.state).toBe('active');
    mocks.tx.mockRejectedValueOnce(new Error('lock unavailable'));
    expect(await (await send()).text()).toContain('[CDATA[FAIL]]');
  });
  it('requests retry if persisting the provider result fails', async () => {
    mocks.tx.mockImplementation(async (sql: string) => {
      if (sql.startsWith('UPDATE')) throw new Error('database unavailable');
      return [{ ...row }];
    });
    expect(await (await send()).text()).toContain('[CDATA[FAIL]]');
  });
  it('caps oversized request bodies before verification or DB work', async () => {
    const response = await send('x'.repeat(65537));
    expect(response.status).toBe(413);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
