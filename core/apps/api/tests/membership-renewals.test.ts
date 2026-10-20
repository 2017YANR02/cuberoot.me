import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryRunner } from '../src/db/connection.js';

const state = vi.hoisted(() => ({ db: null as unknown, apply: vi.fn(), query: vi.fn(), enroll: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({
  query: async (text: string, params: unknown[] = []) => {
    let n = 0;
    return (state.db as ReturnType<typeof postgres>).unsafe(text.replace(/\?/g, () => `$${++n}`), params as never[]);
  },
  withTransaction: async (run: (query: QueryRunner) => Promise<unknown>) => (state.db as ReturnType<typeof postgres>).begin(async tx => run(async <T>(text: string, params: unknown[] = []) => {
    let n = 0;
    return await tx.unsafe(text.replace(/\?/g, () => `$${++n}`), params as never[]) as unknown as T[];
  })),
}));
vi.mock('../src/payment/wechat-papay.js', async importOriginal => ({
  ...await importOriginal<typeof import('../src/payment/wechat-papay.js')>(),
  applyPapayDebit: state.apply, queryPapayDebit: state.query, createPapayEnrollment: state.enroll,
  queryPapayContract: async () => ({ state: 'active', contractId: 'wx-contract' }),
}));
vi.mock('../src/payment/membership-payment-notify.js', () => ({ notifyMembershipPayment: vi.fn() }));
import { enrollMembership } from '../src/payment/membership-enrollment.js';
import { runMembershipRenewalsOnce, reconcileRenewalDebit } from '../src/payment/membership-renewals.js';
import { renewalReleased, RENEWAL_TERMS_VERSION } from '../src/payment/membership-renewal-policy.js';
import { settleMembershipPayment } from '../src/payment/membership-settlement.js';

it('requires approval for BOTH exact templates plus an explicit launch and H5 permission', () => {
  const enabled = { WECHAT_PAPAY_MONTHLY_APPROVED: '225492', WECHAT_PAPAY_YEARLY_APPROVED: '225493',
    WECHAT_PAPAY_H5_APPROVED: 'true', WECHAT_PAPAY_RELEASE_ENABLED: 'true' };
  expect(renewalReleased(enabled)).toBe(true);
  for (const key of Object.keys(enabled)) expect(renewalReleased({ ...enabled, [key]: '' })).toBe(false);
  expect(renewalReleased({ ...enabled, WECHAT_PAPAY_YEARLY_APPROVED: '225492' })).toBe(false);
});

const databaseUrl = process.env.MEMBERSHIP_PAYMENT_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)('renewal lifecycle in isolated PostgreSQL, synthetic provider only', () => {
  const schema = `renewal_${randomUUID().replaceAll('-', '')}`;
  let admin: ReturnType<typeof postgres>, db: ReturnType<typeof postgres>;
  const consent = { planSlug: 'monthly_auto_renew', agreed: true, priceCents: 2999, termsVersion: RENEWAL_TERMS_VERSION };
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (url.hostname !== '127.0.0.1' || url.pathname !== '/membership_payment_test') throw new Error('Dedicated loopback database required');
    admin = postgres(databaseUrl!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    db = postgres(databaseUrl!, { max: 8, connection: { search_path: schema, timezone: 'UTC', statement_timeout: 10000 }, onnotice: () => {} });
    state.db = db;
    await db.unsafe(`CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;
      CREATE TABLE app_users(id int PRIMARY KEY, wca_id text, display_name text, merged_into_user_id int);
      INSERT INTO app_users VALUES (1, '2017TEST01', 'Fixture', NULL);`);
    for (const file of ['0046_membership.sql', '0181_enterprise_membership_plans.sql', '0222_membership_contracts.sql', '0276_membership_renewal_pipeline.sql', '0283_enterprise_membership_renewal.sql']) {
      await db.unsafe(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
    }
    await db.unsafe(`INSERT INTO membership_plans(slug,name_zh,name_en,period,price_cents,active) VALUES
      ('monthly_auto_renew','月','Month','month',2999,false), ('yearly_auto_renew','年','Year','year',29900,false)`);
  });
  beforeEach(async () => {
    vi.unstubAllEnvs();
    await db.unsafe('TRUNCATE membership_renewal_debits, membership_contracts, membership_orders, memberships');
    vi.stubEnv('WECHAT_PAPAY_APPID', 'wx0123456789abcdef'); vi.stubEnv('WECHAT_PAPAY_MCHID', '1234567890');
    vi.stubEnv('WECHAT_PAPAY_API_V2_KEY', '0123456789abcdef0123456789abcdef');
    vi.stubEnv('WECHAT_PAPAY_MONTHLY_APPROVED', '225492'); vi.stubEnv('WECHAT_PAPAY_YEARLY_APPROVED', '225493');
    for (const name of ['H5_APPROVED', 'RELEASE_ENABLED', 'DEBIT_ENABLED', 'SYNC_ENABLED']) vi.stubEnv(`WECHAT_PAPAY_${name}`, 'true');
    state.apply.mockReset().mockResolvedValue(undefined);
    state.enroll.mockReset().mockResolvedValue('https://payapp.weixin.qq.com/fixture');
    state.query.mockReset().mockImplementation(async no => ({ trade_state: 'ACCEPT', out_trade_no: no }));
  });
  afterAll(async () => {
    vi.unstubAllEnvs(); await db?.end();
    if (admin) { await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`); await admin.end(); }
  });
  it.each([
    ['enterprise_monthly_auto_renew', 'MONTHLY', '345001', 29900],
  ] as const)('settles %s with its own template, amount and enterprise entitlement', async (planSlug, cadence, id, priceCents) => {
    await expect(enrollMembership('2017TEST01', { ...consent, planSlug, priceCents }, '127.0.0.1')).rejects.toThrow();
    vi.stubEnv(`WECHAT_PAPAY_ENTERPRISE_${cadence}_PLAN_ID`, id);
    vi.stubEnv(`WECHAT_PAPAY_ENTERPRISE_${cadence}_APPROVED`, id);
    await enrollMembership('2017TEST01', { ...consent, planSlug, priceCents }, '127.0.0.1');
    await db.unsafe("UPDATE membership_contracts SET state='active', contract_id='enterprise-contract', verified_at=now()");
    await runMembershipRenewalsOnce();
    expect(state.apply).toHaveBeenCalledTimes(1);
    const [order] = await db.unsafe('SELECT * FROM membership_orders');
    expect(order.amount_cents).toBe(priceCents);
    const [contract] = await db.unsafe('SELECT * FROM membership_contracts');
    expect(contract.plan_id).toBe(id);
    state.query.mockResolvedValue({ trade_state: 'SUCCESS', trade_type: 'PAP', total_fee: String(priceCents), fee_type: 'CNY', transaction_id: 'enterprise-transaction' });
    expect(await reconcileRenewalDebit(order.out_trade_no)).toBe(true);
    const [member] = await db.unsafe('SELECT * FROM memberships');
    expect(member.plan_slug).toBe(planSlug);
  });
  async function activated() {
    const result = await enrollMembership('2017TEST01', consent, '127.0.0.1');
    await db.unsafe("UPDATE membership_contracts SET state='active', contract_id='wx-contract', verified_at=now()");
    return result;
  }
  function paid() {
    state.query.mockImplementation(async no => ({ trade_state: 'SUCCESS', out_trade_no: no, trade_type: 'PAP',
      total_fee: '2999', fee_type: 'CNY', transaction_id: `tx${no}` }));
  }
  it('private signing never charges until separately enabled and never submits a second cycle', async () => {
    await activated();
    vi.stubEnv('WECHAT_PAPAY_RELEASE_ENABLED', 'false');
    vi.stubEnv('WECHAT_PAPAY_SIGNING_CHANNEL', 'miniprogram');
    vi.stubEnv('WECHAT_PAPAY_APPID', 'wx1f92ba91b7e42015');
    vi.stubEnv('WECHAT_MINI_APP_ID', 'wx1f92ba91b7e42015');
    vi.stubEnv('WECHAT_MINI_APP_SECRET', 'fixture');
    vi.stubEnv('WECHAT_PAPAY_PILOT_ENABLED', 'true');
    vi.stubEnv('WECHAT_PAPAY_PILOT_OWNER', '2017TEST01');
    vi.stubEnv('WECHAT_PAPAY_PILOT_UNTIL', new Date(Date.now() + 3600000).toISOString());
    vi.stubEnv('WECHAT_PAPAY_PILOT_DEBIT_ENABLED', 'false');
    await runMembershipRenewalsOnce();
    expect(state.apply).not.toHaveBeenCalled();
    await db.unsafe("UPDATE membership_contracts SET appid='wx1f92ba91b7e42015'");
    vi.stubEnv('WECHAT_PAPAY_PILOT_DEBIT_ENABLED', 'true');
    await runMembershipRenewalsOnce();
    expect(state.apply).toHaveBeenCalledTimes(1);
    await db.unsafe("UPDATE membership_contracts SET debit_cycle=1,next_debit_at=now()-interval '1 day'");
    await runMembershipRenewalsOnce();
    expect(state.apply).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });
  it('closed gate creates no contract and never contacts WeChat', async () => {
    vi.stubEnv('WECHAT_PAPAY_YEARLY_APPROVED', '');
    await expect(enrollMembership('2017TEST01', consent, '127.0.0.1')).rejects.toThrow();
    expect(await db.unsafe('SELECT * FROM membership_contracts')).toHaveLength(0);
    expect(state.enroll).not.toHaveBeenCalled();
  });
  it('reuses a pending reservation and rejects stale price or missing consent', async () => {
    const a = await enrollMembership('2017TEST01', consent, '127.0.0.1');
    const b = await enrollMembership('2017TEST01', consent, '127.0.0.1');
    expect(a.subscriptionId).toBe(b.subscriptionId);
    for (const override of [{ agreed: false }, { priceCents: 1 }, { termsVersion: 'old' }]) {
      await expect(enrollMembership('2017TEST01', { ...consent, ...override }, '127.0.0.1')).rejects.toThrow();
    }
    expect(await db.unsafe('SELECT * FROM membership_contracts')).toHaveLength(1);
  });
  it('acceptance and timeouts never grant benefits or submit a second debit', async () => {
    await activated(); state.apply.mockRejectedValueOnce(new Error('timeout'));
    await runMembershipRenewalsOnce(); await runMembershipRenewalsOnce();
    expect(state.apply).toHaveBeenCalledTimes(1);
    expect(await db.unsafe('SELECT * FROM memberships')).toHaveLength(0);
    expect((await db.unsafe('SELECT status FROM membership_renewal_debits'))[0].status).toBe('submitted');
  });
  it('concurrent duplicate notifications grant once, then the next cycle uses another order', async () => {
    await activated(); await runMembershipRenewalsOnce(); paid();
    const no = (await db.unsafe('SELECT out_trade_no FROM membership_renewal_debits'))[0].out_trade_no;
    expect(await Promise.all(Array.from({ length: 4 }, () => reconcileRenewalDebit(no)))).toEqual([true, true, true, true]);
    expect((await db.unsafe('SELECT debit_cycle FROM membership_contracts'))[0].debit_cycle).toBe(1);
    const expiry = (await db.unsafe('SELECT expires_at FROM memberships'))[0].expires_at;
    await reconcileRenewalDebit(no);
    expect((await db.unsafe('SELECT expires_at FROM memberships'))[0].expires_at).toEqual(expiry);
    await db.unsafe("UPDATE memberships SET expires_at=now()+interval '23 hours'");
    await db.unsafe("UPDATE membership_contracts SET next_debit_at=now()-interval '1 minute'");
    await runMembershipRenewalsOnce();
    expect(state.apply).toHaveBeenCalledTimes(2);
    expect(await db.unsafe('SELECT * FROM membership_renewal_debits')).toHaveLength(2);
  });
  it('committed cancellation prevents new debits', async () => {
    await activated();
    await db.unsafe('UPDATE membership_contracts SET cancellation_requested_at=now()');
    await runMembershipRenewalsOnce(); expect(state.apply).not.toHaveBeenCalled();
  });
  it('honors a paid submitted debit after termination without scheduling another charge', async () => {
    await activated(); await runMembershipRenewalsOnce(); paid();
    const no = (await db.unsafe('SELECT out_trade_no FROM membership_renewal_debits'))[0].out_trade_no;
    await db.unsafe("UPDATE membership_contracts SET state='terminated', cancellation_requested_at=now()");
    expect(await reconcileRenewalDebit(no)).toBe(true);
    await runMembershipRenewalsOnce();
    expect(state.apply).toHaveBeenCalledTimes(1);
    expect(await db.unsafe('SELECT * FROM memberships')).toHaveLength(1);
  });
  it('stores the annual template and amount independently of the monthly template', async () => {
    await enrollMembership('2017TEST01', { ...consent, planSlug: 'yearly_auto_renew', priceCents: 29900 }, '127.0.0.1');
    const [contract] = await db.unsafe('SELECT plan_id, price_cents, period FROM membership_contracts');
    expect(contract).toMatchObject({ plan_id: '225493', price_cents: 29900, period: 'year' });
  });
  it('rejects a paid result with the wrong amount without changing membership', async () => {
    await activated(); await runMembershipRenewalsOnce();
    const no = (await db.unsafe('SELECT out_trade_no FROM membership_renewal_debits'))[0].out_trade_no;
    state.query.mockResolvedValue({ trade_state: 'SUCCESS', trade_type: 'PAP', total_fee: '1', transaction_id: 'bad', fee_type: 'CNY' });
    await expect(reconcileRenewalDebit(no)).rejects.toThrow('mismatch');
    expect(await db.unsafe('SELECT * FROM memberships')).toHaveLength(0);
  });
  it('cannot fulfill a recurring order through the one-time payment handler', async () => {
    await activated(); await runMembershipRenewalsOnce();
    const no = (await db.unsafe('SELECT out_trade_no FROM membership_renewal_debits'))[0].out_trade_no;
    await expect(settleMembershipPayment({ provider: 'wechat', orderNo: no, transactionId: 'generic',
      merchantId: '1234567890', amountMinor: 2999, currency: 'CNY', raw: {} }, () => '1234567890')).rejects.toThrow();
    expect(await db.unsafe('SELECT * FROM memberships')).toHaveLength(0);
  });
});
