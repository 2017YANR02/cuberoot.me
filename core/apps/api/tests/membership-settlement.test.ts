import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryRunner } from '../src/db/connection.js';
import { signXunhupay } from '@cuberoot/shared/payment';

const state = vi.hoisted(() => ({ db: null as unknown, alipayQuery: vi.fn(), wechatQuery: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({
  query: async (text: string, params: unknown[] = []) => {
    let i = 0;
    return (state.db as ReturnType<typeof postgres>).unsafe(text.replace(/\?/g, () => `$${++i}`), params as never[]);
  },
  withTransaction: async (run: (query: QueryRunner) => Promise<unknown>) => (state.db as ReturnType<typeof postgres>).begin(async tx => run(async <T>(text: string, params: unknown[] = []) => {
    let i = 0;
    return await tx.unsafe(text.replace(/\?/g, () => `$${++i}`), params as never[]) as unknown as T[];
  })),
}));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: async () => ({ wcaId: '2017TEST01', name: 'Fixture' }), requireAdmin: async () => ({}), checkRateLimit: () => {},
}));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: () => '127.0.0.1' }));
vi.mock('../src/utils/membership.js', () => ({ hasActiveMembership: async () => false }));
vi.mock('../src/payment/alipay.js', () => ({ alipayConfigured: () => true, queryAlipayTrade: state.alipayQuery, verifyAlipayNotify: () => true }));
vi.mock('../src/payment/wechat.js', () => ({ wechatConfigured: () => true, wechatH5Configured: () => false, queryWechatOrder: state.wechatQuery }));
vi.mock('../src/payment/airwallex.js', () => ({ airwallexAccountId: () => 'aw-merchant', airwallexChannelEnabled: () => false }));
import { grantMembershipInTransaction, membershipPaymentEvidence, settleMembershipPayment, type MembershipPayment } from '../src/payment/membership-settlement.js';
import { withTransaction } from '../src/db/connection.js';

const merchants = (provider: string) => ({ alipay: 'ali-app', wechat: 'wx-merchant', xunhupay: 'xhp-app', airwallex: 'aw-merchant' })[provider];
const merchant = (provider: string) => merchants(provider) || '';
const evidence = (overrides: Partial<MembershipPayment> = {}): MembershipPayment => ({ provider: 'wechat', orderNo: 'order-1', transactionId: 'tx-1',
  merchantId: 'wx-merchant', amountMinor: 1000, currency: 'CNY', raw: { verified: true }, ...overrides });

// These always run without PostgreSQL, while the transaction suite below requires an explicitly isolated database.
describe('membership authenticated payment evidence', () => {
  it('normalizes each authenticated provider without rounding monetary inputs', () => {
    expect(membershipPaymentEvidence('wechat', { mchid: 'wx-merchant', trade_state: 'SUCCESS', out_trade_no: 'o', transaction_id: 't', amount: { total: 1001, currency: 'CNY' } }, 'wx-merchant').amountMinor).toBe(1001);
    expect(membershipPaymentEvidence('alipay', { app_id: 'ali-app', trade_status: 'TRADE_SUCCESS', out_trade_no: 'o', trade_no: 't', total_amount: '10.01' }, 'ali-app').amountMinor).toBe(1001);
    expect(membershipPaymentEvidence('alipay', { alipay_trade_query_response: { trade_status: 'TRADE_FINISHED', out_trade_no: 'o', trade_no: 't', total_amount: '10.01' } }, 'ali-app').amountMinor).toBe(1001);
    expect(membershipPaymentEvidence('xunhupay', { appid: 'xhp-app', status: 'OD', trade_order_id: 'o', transaction_id: 't', total_fee: '10.01' }, 'xhp-app').amountMinor).toBe(1001);
    expect(membershipPaymentEvidence('airwallex', { account_id: 'aw-merchant', data: { object: { status: 'SUCCEEDED', merchant_order_id: 'o', id: 't', amount: 10.01, currency: 'CNY' } } }, 'aw-merchant').amountMinor).toBe(1001);
  });
  it.each(['10.001', 'NaN', '-1', '0', '1e2'])('rejects invalid provider amount %s', total_amount => {
    expect(() => membershipPaymentEvidence('alipay', { app_id: 'ali-app', trade_status: 'TRADE_SUCCESS', out_trade_no: 'o', trade_no: 't', total_amount }, 'ali-app')).toThrow();
  });
  it('does not turn mismatched merchants, nonpaid states or incomplete records into a settlement', () => {
    const row = { app_id: 'other', trade_status: 'TRADE_SUCCESS', out_trade_no: 'o', trade_no: 't', total_amount: '10.01' };
    expect(() => membershipPaymentEvidence('alipay', row, 'ali-app')).toThrow();
    expect(() => membershipPaymentEvidence('alipay', { ...row, app_id: 'ali-app', trade_status: 'WAIT_BUYER_PAY' }, 'ali-app')).toThrow();
    expect(() => membershipPaymentEvidence('xunhupay', { status: 'OD' }, 'xhp-app')).toThrow();
  });
});

const databaseUrl = process.env.MEMBERSHIP_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)('membership settlement with real isolated PostgreSQL transactions', () => {
  const schema = `membership_settlement_${randomUUID().replaceAll('-', '')}`;
  let admin: ReturnType<typeof postgres>, db: ReturnType<typeof postgres>;
  let routes: typeof import('../src/routes/membership.js')['membershipRoutes'];
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/membership_payment_test') throw new Error('Dedicated loopback membership_payment_test database required');
    admin = postgres(databaseUrl!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    db = postgres(databaseUrl!, { max: 12, connection: { search_path: schema, timezone: 'UTC', statement_timeout: 10000 }, onnotice: () => {} });
    state.db = db;
    await db.unsafe(`CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;`);
    await db.unsafe(readFileSync(new URL('../migrations/0046_membership.sql', import.meta.url), 'utf8'));
    await db.unsafe(`INSERT INTO membership_plans(slug,name_zh,name_en,period,period_count,price_cents) VALUES('daily','日','Daily','day',1,1000)`);
    vi.stubEnv('ALIPAY_APP_ID', 'ali-app'); vi.stubEnv('WECHAT_MCHID', 'wx-merchant');
    vi.stubEnv('XUNHUPAY_APPID', 'xhp-app'); vi.stubEnv('XUNHUPAY_APPSECRET', 'synthetic-xhp-secret');
    routes = (await import('../src/routes/membership.js')).membershipRoutes;
  }, 30000);
  afterAll(async () => {
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
    await db?.end();
    if (admin) { await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`); await admin.end(); }
  });
  beforeEach(async () => {
    await db.unsafe('TRUNCATE memberships, membership_orders');
    await db.unsafe("UPDATE membership_plans SET period='day', period_count=1 WHERE slug='daily'");
    state.alipayQuery.mockReset(); state.wechatQuery.mockReset();
  });
  async function order(no = 'order-1', provider = 'wechat', txn: string | null = null) {
    await db.unsafe(`INSERT INTO membership_orders(out_trade_no,wca_id,name,plan_slug,amount_cents,currency,provider,provider_txn,pay_channel)
      VALUES($1,'2017TEST01','Fixture','daily',1000,'CNY',$2,$3,'wechat')`, [no, provider, txn]);
  }
  const settle = (value = evidence()) => settleMembershipPayment(value, merchant);
  async function pending(no = 'order-1') {
    expect((await db.unsafe('SELECT status FROM membership_orders WHERE out_trade_no=$1', [no]))[0].status).toBe('pending');
    expect(await db.unsafe('SELECT * FROM memberships')).toHaveLength(0);
  }

  it('settles once and handles exact repeated notifications without granting twice', async () => {
    await order();
    expect(await settle()).toBe('settled');
    const first = (await db.unsafe('SELECT expires_at FROM memberships'))[0].expires_at;
    expect(await settle()).toBe('duplicate');
    expect((await db.unsafe('SELECT expires_at FROM memberships'))[0].expires_at).toEqual(first);
  });
  it.each([
    { amountMinor: 999 }, { amountMinor: 1001 }, { amountMinor: 0 }, { amountMinor: 1000.1 },
    { currency: 'USD' }, { provider: 'alipay' as const, merchantId: 'ali-app' }, { merchantId: 'another-merchant' },
    { orderNo: 'unknown-order' }, { transactionId: '' },
  ])('rejects mismatched local payment expectations %# before changing either state', async override => {
    await order(); await expect(settle(evidence(override))).rejects.toThrow(); await pending();
  });
  it('rejects a provider transaction different from the already bound intent', async () => {
    await order('order-1', 'wechat', 'bound-tx');
    await expect(settle()).rejects.toThrow(); await pending();
  });
  it('does not change expired or failed orders', async () => {
    await order(); await db.unsafe("UPDATE membership_orders SET status='failed'");
    await expect(settle()).rejects.toThrow();
    expect((await db.unsafe('SELECT status FROM membership_orders'))[0].status).toBe('failed');
    expect(await db.unsafe('SELECT * FROM memberships')).toHaveLength(0);
  });
  it('serializes concurrent duplicate notifications and grants exactly once', async () => {
    await order();
    const results = await Promise.all(Array.from({ length: 10 }, () => settle()));
    expect(results.filter(result => result === 'settled')).toHaveLength(1);
    expect(results.filter(result => result === 'duplicate')).toHaveLength(9);
    expect(await db.unsafe('SELECT * FROM memberships')).toHaveLength(1);
  });
  it('rejects concurrent reuse of one provider transaction across different local orders', async () => {
    await order(); await order('order-2');
    const results = await Promise.allSettled([settle(), settle(evidence({ orderNo: 'order-2' }))]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(await db.unsafe("SELECT * FROM membership_orders WHERE status='paid'")).toHaveLength(1);
  });
  it('preserves both extensions when two independent payments settle for the same member', async () => {
    await order(); await order('order-2');
    await db.unsafe("INSERT INTO memberships(wca_id,name,plan_slug,expires_at,source) VALUES('2017TEST01','Fixture','daily','2030-01-01T00:00:00Z','manual')");
    await Promise.all([settle(), settle(evidence({ orderNo: 'order-2', transactionId: 'tx-2' }))]);
    expect((await db.unsafe('SELECT expires_at FROM memberships'))[0].expires_at.toISOString()).toBe('2030-01-03T00:00:00.000Z');
    expect(await db.unsafe("SELECT * FROM membership_orders WHERE status='paid'")).toHaveLength(2);
  });
  it('serializes first purchases even before a member row exists', async () => {
    await order(); await order('order-2');
    await Promise.all([settle(), settle(evidence({ orderNo: 'order-2', transactionId: 'tx-2' }))]);
    const [row] = await db.unsafe("SELECT expires_at > NOW() + INTERVAL '47 hours' AS extended_twice FROM memberships");
    expect(row.extended_twice).toBe(true);
    expect(await db.unsafe('SELECT * FROM memberships')).toHaveLength(1);
  });
  it('rolls back the paid flag on an entitlement storage failure and permits a later retry', async () => {
    await order();
    await db.unsafe(`CREATE FUNCTION fixture_fail_grant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture grant failure'; END $$;
      CREATE TRIGGER fixture_fail_grant BEFORE INSERT ON memberships FOR EACH ROW EXECUTE FUNCTION fixture_fail_grant();`);
    try { await expect(settle()).rejects.toThrow('fixture grant failure'); await pending(); }
    finally { await db.unsafe('DROP TRIGGER fixture_fail_grant ON memberships; DROP FUNCTION fixture_fail_grant()'); }
    expect(await settle()).toBe('settled');
  });
  it('rolls back when the historical plan cannot grant a valid period', async () => {
    await order(); await db.unsafe("UPDATE membership_plans SET period='invalid' WHERE slug='daily'");
    await expect(settle()).rejects.toThrow('Invalid membership period'); await pending();
  });
  it('uses the order price snapshot even if the sale price changes', async () => {
    await order(); await db.unsafe("UPDATE membership_plans SET price_cents=9900 WHERE slug='daily'");
    expect(await settle()).toBe('settled');
  });
  it('preserves a manual extension racing with a paid extension', async () => {
    await order();
    await db.unsafe("INSERT INTO memberships(wca_id,name,plan_slug,expires_at,source) VALUES('2017TEST01','Fixture','daily','2030-01-01T00:00:00Z','manual')");
    await Promise.all([settle(), withTransaction(run => grantMembershipInTransaction(run, {
      wcaId: '2017TEST01', name: 'Fixture', plan: { slug: 'daily', period: 'day', period_count: 1 }, source: 'manual', orderNo: null,
    }))]);
    expect((await db.unsafe('SELECT expires_at FROM memberships'))[0].expires_at.toISOString()).toBe('2030-01-03T00:00:00.000Z');
  });
  it('rolls back a manual paid order if its entitlement cannot be stored', async () => {
    await db.unsafe(`CREATE FUNCTION fixture_fail_manual() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture manual failure'; END $$;
      CREATE TRIGGER fixture_fail_manual BEFORE INSERT ON memberships FOR EACH ROW EXECUTE FUNCTION fixture_fail_manual();`);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await routes.request('/membership/admin/grant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wcaId: '2017TEST01', plan: 'daily' }) });
      expect(response.status).toBe(500);
      expect(await db.unsafe('SELECT * FROM membership_orders')).toHaveLength(0);
      expect(await db.unsafe('SELECT * FROM memberships')).toHaveLength(0);
    } finally { errorLog.mockRestore(); await db.unsafe('DROP TRIGGER fixture_fail_manual ON memberships; DROP FUNCTION fixture_fail_manual()'); }
  });
  it('does not downgrade a lifetime member and shares the same lock with manual grants', async () => {
    await order();
    await withTransaction(run => grantMembershipInTransaction(run, { wcaId: '2017TEST01', name: 'Fixture', plan: { slug: 'lifetime', period: 'lifetime', period_count: 1 }, source: 'manual', orderNo: null }));
    await settle();
    expect((await db.unsafe('SELECT expires_at FROM memberships'))[0].expires_at).toBeNull();
  });

  const xhpCallback = (overrides: Record<string, string> = {}) => {
    const params: Record<string, string> = { appid: 'xhp-app', trade_order_id: 'order-1', transaction_id: 'xhp-tx', status: 'OD', total_fee: '10.00', ...overrides };
    params.hash = signXunhupay(params, 'synthetic-xhp-secret', value => createHash('md5').update(value).digest('hex'));
    return routes.request('/membership/notify/xunhupay', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  };
  it('keeps valid signed Xunhupay callbacks working and rejects an unknown app ID', async () => {
    await order('order-1', 'xunhupay');
    expect(await (await xhpCallback({ appid: 'unrecognized-app' })).text()).toBe('fail'); await pending();
    expect(await (await xhpCallback()).text()).toBe('success');
    expect((await db.unsafe('SELECT status FROM membership_orders'))[0].status).toBe('paid');
  });
  it('does not acknowledge a signed Xunhupay callback with the wrong amount or another provider order', async () => {
    await order('order-1', 'xunhupay');
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await xhpCallback({ total_fee: '0.01' })).status).toBe(500); await pending();
      await db.unsafe("UPDATE membership_orders SET provider='wechat'");
      expect((await xhpCallback()).status).toBe(500); await pending();
    } finally { errorLog.mockRestore(); }
  });
  it('never queries an unauthenticated Xunhupay response to grant membership', async () => {
    await order('order-1', 'xunhupay');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"data":{"status":"OD"}}'));
    vi.stubGlobal('fetch', fetchMock);
    const response = await routes.request('/membership/orders/order-1');
    expect(response.status).toBe(200); expect((await response.json()).status).toBe('pending');
    expect(fetchMock).not.toHaveBeenCalled(); await pending();
  });
  it('active query compensation rejects wrong amount then fulfills a matching authenticated result', async () => {
    await order('order-1', 'alipay');
    const raw = { alipay_trade_query_response: { trade_status: 'TRADE_SUCCESS', out_trade_no: 'order-1', trade_no: 'ali-tx', total_amount: '0.01' } };
    state.alipayQuery.mockResolvedValue({ paid: true, txn: 'ali-tx', raw });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await (await routes.request('/membership/orders/order-1')).json()).status).toBe('pending'); await pending();
      raw.alipay_trade_query_response.total_amount = '10.00';
      expect((await (await routes.request('/membership/orders/order-1')).json()).status).toBe('paid');
    } finally { errorLog.mockRestore(); }
  });
});
