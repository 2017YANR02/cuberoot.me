import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null as unknown, paymentOrder: '', refund: vi.fn() }));
// Only identity and provider I/O are simulated: retain the real SQL driver and fulfillment helpers.
vi.mock('../src/db/connection.js', () => ({ get sql() { return state.db; } }));
vi.mock('../src/platform/auth.js', () => ({
  requirePlatformActor: async () => ({ userId: 3, ownerKey: 'user:3', displayName: 'Entrant', isAdmin: false, viaApiKey: false, wcaId: null }),
  requirePlatformAdmin: async () => ({ userId: 1, ownerKey: 'user:1', displayName: 'Admin', isAdmin: true, viaApiKey: false, wcaId: null }),
}));
vi.mock('../src/platform/payment.js', () => ({
  PLATFORM_PAYMENT_PROVIDERS: ['wechat', 'alipay'],
  createProviderPayment: async (input: { orderNo: string }) => { state.paymentOrder = input.orderNo; return { checkoutUrl: 'https://example.invalid/fixture-payment' }; },
  verifyProviderNotification: async () => ({ provider: 'wechat', eventId: 'fixture-paid', providerTransactionId: 'fixture-transaction', orderNo: state.paymentOrder,
    paid: true, amountCents: 1000, currency: 'CNY', merchantId: 'fixture-merchant', raw: { fixture: true } }),
}));
vi.mock('../src/platform/refund_provider.js', () => ({ assertRefundProvider: () => undefined, runProviderRefund: state.refund }));
import { platformCommerceRoutes } from '../src/routes/platform_commerce.js';
import { platformRefundRoutes } from '../src/routes/platform_refunds.js';
import { competitionSettlement } from '../src/platform/competition_settlement.js';
import type { PlatformDb } from '../src/platform/db.js';

const app = new Hono().route('/v1/platform', platformCommerceRoutes).route('/v1', platformRefundRoutes);
const databaseUrl = process.env.COMPETITION_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('paid competition refund with real PostgreSQL fulfillment', () => {
  const schema = `competition_refund_${randomUUID().replaceAll('-', '')}`;
  const org = randomUUID(), event = randomUUID(), ticket = randomUUID(), session = randomUUID();
  let admin: ReturnType<typeof postgres>, db: ReturnType<typeof postgres>;
  const migration = (name: string) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
  const post = (path: string, body: unknown = {}, key = randomUUID()) => app.request(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body),
  });
  const statement = () => competitionSettlement(db as unknown as PlatformDb, event);
  beforeAll(async () => {
    if (!['localhost', '127.0.0.1'].includes(new URL(databaseUrl!).hostname)) throw new Error('Loopback PostgreSQL required');
    vi.stubEnv('WECHAT_MCHID', 'fixture-merchant');
    admin = postgres(databaseUrl!, { max: 1, onnotice: () => undefined }); await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    db = postgres(databaseUrl!, { max: 4, connection: { search_path: schema } }); state.db = db;
    await db.unsafe(`CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;
      CREATE TABLE app_users(id BIGINT PRIMARY KEY);
      CREATE TABLE teacher_directory_entries(id BIGINT PRIMARY KEY);`);
    await db.unsafe(migration('0142_teaching_foundation.sql').split('CREATE TABLE student_profiles')[0]);
    for (const name of ['0167_platform_core.sql', '0224_online_competitions.sql', '0226_competition_settlement_ledger.sql', '0228_platform_provider_refunds.sql']) await db.unsafe(migration(name));
    await db.unsafe(`INSERT INTO app_users VALUES(1),(2),(3);
      INSERT INTO organizations(id,slug,name,created_by_user_id) VALUES('${org}','refund-test','Refund test',1);
      INSERT INTO organization_members(organization_id,user_id,role,joined_at) VALUES('${org}',1,'owner',NOW()),('${org}',2,'teacher',NOW());
      INSERT INTO platform_events(id,slug,title_zh,title_en,status,starts_at,ends_at,timezone,published_at) VALUES('${event}','refund-test','退款测试','Refund test','published',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '3 hours','Asia/Shanghai',NOW());
      INSERT INTO platform_competitions(event_id,organization_id,registration_opens_at,registration_closes_at,commission_bps,settlement_days,settlement_anchor) VALUES('${event}','${org}',NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 minutes',1000,0,'finalized');
      INSERT INTO platform_event_ticket_types(id,event_id,code,title_zh,title_en,amount_minor,currency,capacity,competition_project,competition_device) VALUES('${ticket}','${event}','333','三阶','3x3',1000,'CNY',1,'333','ordinary');
      INSERT INTO platform_competition_sessions(id,event_id,starts_at,ends_at,capacity,supervisor_user_id) VALUES('${session}','${event}',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '2 hours',1,2);`);
  }, 60_000);
  afterAll(async () => {
    vi.unstubAllEnvs(); await db?.end();
    if (admin) { await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`); await admin.end(); }
  });

  it('preserves entry while pending, reverses once on success, and makes replay harmless', async () => {
    const created = await post('/v1/platform/orders', { clientOrderKey: randomUUID(), items: [{ sellableType: 'event_ticket', eventTicketTypeId: ticket, quantity: 1, competitionSessionId: session, device: 'ordinary' }] });
    const order = await created.json(); expect(created.status, JSON.stringify(order)).toBe(201); expect(order.status).toBe('pending_payment');
    const payment = await post(`/v1/platform/orders/${order.id}/payment-attempts`, { provider: 'wechat', clientType: 'pc' });
    expect(payment.status, JSON.stringify(await payment.json())).toBe(201);
    const paid = await post('/v1/platform/payments/wechat/notify'); expect(paid.status, await paid.text()).toBe(200);
    const [registration] = await db.unsafe(`SELECT r.id,r.status,r.competition_video_generation FROM platform_event_registrations r JOIN platform_order_items i ON i.id=r.order_item_id WHERE i.order_id=$1`, [order.id]);
    expect(registration.status).toBe('confirmed');
    expect((await db.unsafe(`SELECT sold_quantity,reserved_quantity FROM platform_event_ticket_types WHERE id=$1`, [ticket]))[0]).toMatchObject({ sold_quantity: 1, reserved_quantity: 0 });
    expect(await statement()).toMatchObject({ organizerAmountMinor: '900', netCollectedMinor: '1000' });
    // Seed a previously completed external transfer to exercise refund-after-settlement reconciliation.
    const { transfers: _transfers, ...snapshot } = await statement();
    await db.unsafe(`INSERT INTO platform_competition_settlement_ledger(event_id,entry_type,amount_minor,provider_reference_hash,transferred_at,statement_snapshot,actor_user_id,actor_key)
      VALUES($1,'payout',900,'fixture-prior-transfer',NOW(),$2::jsonb,1,'user:1')`, [event, snapshot]);
    const requested = await post(`/v1/platform/orders/${order.id}/refund-requests`, { reasonCode: 'entrant_requested' });
    const refund = await requested.json(); expect(requested.status, JSON.stringify(refund)).toBe(201);
    const listed = await app.request(`/v1/platform/orders/${order.id}/refunds`); expect(listed.status).toBe(200); expect((await listed.json()).items[0].id).toBe(refund.id);
    state.refund.mockResolvedValueOnce({ id: 'fixture-refund', status: 'pending', providerStatus: 'PROCESSING' });
    const approved = await post(`/v1/admin/refunds/${refund.id}/approve`);
    expect(approved.status).toBe(200); expect(await approved.json()).toMatchObject({ status: 'pending', amountMinor: '1000', failureCode: null, providerStatus: 'PROCESSING' });
    expect((await db.unsafe(`SELECT status FROM platform_event_registrations WHERE id=$1`, [registration.id]))[0].status).toBe('confirmed');
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_fulfillment_ledger WHERE entry_type='reversal'`))[0].n).toBe(0);
    expect((await statement()).transfers).toHaveLength(1);

    state.refund.mockResolvedValue({ id: 'fixture-refund', status: 'succeeded', providerStatus: 'SUCCESS' });
    const refreshed = await post(`/v1/admin/refunds/${refund.id}/refresh`);
    expect(refreshed.status).toBe(200);
    const refreshedBody = await refreshed.json();
    expect(refreshedBody).toMatchObject({ status: 'succeeded', failureCode: null });
    const [after] = await db.unsafe(`SELECT status,competition_video_generation FROM platform_event_registrations WHERE id=$1`, [registration.id]);
    expect(after.status).toBe('refunded'); expect(after.competition_video_generation).not.toBe(registration.competition_video_generation);
    expect((await db.unsafe(`SELECT sold_quantity,reserved_quantity FROM platform_event_ticket_types WHERE id=$1`, [ticket]))[0]).toMatchObject({ sold_quantity: 0, reserved_quantity: 0 });
    expect((await db.unsafe(`SELECT status FROM platform_orders WHERE id=$1`, [order.id]))[0].status).toBe('refunded');
    expect((await db.unsafe(`SELECT status FROM platform_payment_attempts WHERE order_id=$1`, [order.id]))[0].status).toBe('refunded');
    expect(await statement()).toMatchObject({ organizerAmountMinor: '0', netCollectedMinor: '0', refundedMinor: '1000', outstandingMinor: '-900', transferStatus: 'reconciliation_required' });
    const replay = await post(`/v1/admin/refunds/${refund.id}/refresh`); expect(replay.status).toBe(200); expect((await replay.json()).status).toBe('succeeded');
    expect(state.refund).toHaveBeenCalledTimes(2);
    expect(state.refund.mock.calls[1][0].requestId).toBe(state.refund.mock.calls[0][0].requestId);
    const repeatedPayment = await post('/v1/platform/payments/wechat/notify'); expect(repeatedPayment.status).toBe(200);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n,COALESCE(SUM(delta_quantity),0)::integer total FROM platform_fulfillment_ledger WHERE entry_type='reversal'`))[0]).toMatchObject({ n: 1, total: -1 });
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_competition_settlement_ledger WHERE entry_type='adjustment'`))[0].n).toBe(1);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_audit_events WHERE action='commerce.refund.completed'`))[0].n).toBe(1);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_outbox_events WHERE event_type='platform.order.refunded'`))[0].n).toBe(1);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_fulfillment_ledger WHERE jsonb_typeof(metadata)<>'object'`))[0].n).toBe(0);
    expect((await db.unsafe(`SELECT competition_video_generation FROM platform_event_registrations WHERE id=$1`, [registration.id]))[0].competition_video_generation).toBe(after.competition_video_generation);
  }, 60_000);

  it('expires an unpaid replacement entry, frees its reserved seat, and replays once', async () => {
    const created = await post('/v1/platform/orders', { clientOrderKey: randomUUID(), items: [{ sellableType: 'event_ticket', eventTicketTypeId: ticket, quantity: 1, competitionSessionId: session, device: 'ordinary' }] });
    const order = await created.json(); expect(created.status, JSON.stringify(order)).toBe(201);
    expect((await db.unsafe(`SELECT reserved_quantity FROM platform_event_ticket_types WHERE id=$1`, [ticket]))[0].reserved_quantity).toBe(1);
    const payment = await post(`/v1/platform/orders/${order.id}/payment-attempts`, { provider: 'wechat', clientType: 'pc' }); expect(payment.status).toBe(201);
    await db.unsafe(`UPDATE platform_orders SET created_at=NOW()-INTERVAL '31 minutes' WHERE id=$1`, [order.id]);
    const key = randomUUID();
    const expired = await post('/v1/platform/admin/orders/expire-reservations', { limit: 10 }, key);
    expect(expired.status, await expired.clone().text()).toBe(200); expect(await expired.json()).toMatchObject({ expiredOrders: 1, expiredAttempts: 0 });
    const replay = await post('/v1/platform/admin/orders/expire-reservations', { limit: 10 }, key);
    expect(replay.status).toBe(200); expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    expect((await db.unsafe(`SELECT status FROM platform_orders WHERE id=$1`, [order.id]))[0].status).toBe('cancelled');
    expect((await db.unsafe(`SELECT r.status FROM platform_event_registrations r JOIN platform_order_items i ON i.id=r.order_item_id WHERE i.order_id=$1`, [order.id]))[0].status).toBe('cancelled');
    expect((await db.unsafe(`SELECT status,failure_code FROM platform_payment_attempts WHERE order_id=$1`, [order.id]))[0]).toMatchObject({ status: 'cancelled', failure_code: 'reservation_expired' });
    expect((await db.unsafe(`SELECT sold_quantity,reserved_quantity FROM platform_event_ticket_types WHERE id=$1`, [ticket]))[0]).toMatchObject({ sold_quantity: 0, reserved_quantity: 0 });
    const audits = await db.unsafe(`SELECT metadata FROM platform_audit_events WHERE action='commerce.order.expire_reservations'`);
    expect(audits).toHaveLength(1); expect(audits[0].metadata).toEqual({ expiredOrders: 1, expiredAttempts: 0, limit: 10 });
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_outbox_events WHERE event_type='platform.order.reservation_expired'`))[0].n).toBe(1);
  }, 60_000);
});
