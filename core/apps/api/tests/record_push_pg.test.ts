import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let sql: ReturnType<typeof postgres>;
const schema = `record_push_test_${randomUUID().replaceAll('-', '')}`;
const placeholders = (statement: string) => { let index = 0; return statement.replace(/\?/g, () => `$${++index}`); };
const mocks = vi.hoisted(() => ({ send: vi.fn(), apns: vi.fn(), owner: 'u1', authenticated: true }));
vi.mock('../src/db/connection.js', () => ({
  query: (statement: string, values: never[] = []) => sql.unsafe(placeholders(statement), values),
  withTransaction: (work: (query: (statement: string, values?: never[]) => unknown) => Promise<unknown>) =>
    sql.begin(tx => work((statement, values = []) => tx.unsafe(placeholders(statement), values))),
}));
vi.mock('../src/utils/apns.js', async importOriginal => ({ ...await importOriginal<typeof import('../src/utils/apns.js')>(), apnsConfig: () => ({}), sendApnsRecord: mocks.apns }));
vi.mock('../src/utils/getui.js', () => ({ getuiConfig: (app: string) => app === 'me.cuberoot.app' ? {} : null, sendRecordPush: mocks.send }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: async () => {
  if (!mocks.authenticated) throw new HTTPException(401);
  return { wcaId: mocks.owner };
} }));
vi.mock('../src/utils/notify.js', () => ({ rememberLang: vi.fn(), verifyUnsubToken: vi.fn() }));
vi.mock('../src/utils/account.js', () => ({ publicUserIdsForOwnerKeys: vi.fn() }));
import { notificationRoutes } from '../src/routes/notifications';
import { sweepRecordPush } from '../src/utils/record_push';
import { defaultCompetitionNotificationPreferences } from '@cuberoot/shared/competition-notifications';
const device = { installationId: randomUUID(), secret: 'a'.repeat(64), appId: 'me.cuberoot.app', clientId: '0123456789abcdef' };
const request = (method: string, body: unknown) => notificationRoutes.request('/notifications/push/device', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe.skipIf(process.env.RECORD_PUSH_TEST_PG !== '1')('record push migration, ownership and queue (PostgreSQL)', () => {
  beforeAll(async () => {
    sql = postgres({ host: '127.0.0.1', port: 5433, user: 'postgres', password: 'dev', database: 'cuberoot_db', max: 2, connection: { search_path: schema } });
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe(`CREATE TABLE app_users (id BIGINT PRIMARY KEY, wca_id TEXT, merged_into_user_id BIGINT);
      CREATE TABLE notifications (id BIGSERIAL PRIMARY KEY, user_key TEXT, kind TEXT, title TEXT, excerpt TEXT, link TEXT, dedupe_key TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
      INSERT INTO app_users VALUES (1, '2017TEST01', NULL), (2, NULL, NULL);`);
    await sql.unsafe(await readFile(new URL('../migrations/0239_record_push.sql', import.meta.url), 'utf8'));
    await sql.unsafe(await readFile(new URL('../migrations/0255_ios_record_push.sql', import.meta.url), 'utf8'));
    await sql.unsafe(await readFile(new URL('../migrations/0318_competition_push.sql', import.meta.url), 'utf8'));
    await sql.unsafe('CREATE TABLE comp_follows (wca_id TEXT, comp_id TEXT, created_at BIGINT)');
    await sql.unsafe(await readFile(new URL('../migrations/0317_competition_notifications.sql', import.meta.url), 'utf8'));
  });
  afterAll(async () => {
    if (sql) { await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await sql.end(); }
  });
  it('requires login to bind but supports secret-only revocation after logout', async () => {
    mocks.authenticated = false;
    expect((await request('PUT', device)).status).toBe(401);
    mocks.authenticated = true;
    expect((await request('PUT', device)).status).toBe(200);
    expect((await request('PUT', { ...device, secret: 'b'.repeat(64) })).status).toBe(409);
    expect((await request('DELETE', { installationId: device.installationId, secret: 'b'.repeat(64) })).status).toBe(200);
    expect(await sql`SELECT user_id FROM notification_push_devices`).toEqual([{ user_id: '1' }]);
    expect((await request('PUT', { ...device, installationId: randomUUID() })).status).toBe(409);
  });
  it('ignores old and foreign records, retries transient failure and never resends accepted rows', async () => {
    await sql`INSERT INTO notifications (user_key, kind, title, excerpt, link, created_at) VALUES
      ('u1', 'wca_record', 'Old', '', '/wca/comp/Test2026', NOW() - INTERVAL '2 minutes'),
      ('u2', 'wca_record', 'Foreign', '', '/wca/comp/Test2026', NOW()),
      ('2017TEST01', 'wca_record', 'New', '3.54 PR', '/wca/comp/Test2026', NOW())`;
    mocks.send.mockRejectedValueOnce(new Error('secret provider payload'));
    await sweepRecordPush();
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(await sql`SELECT attempts, accepted_at, last_error FROM notification_push_deliveries`).toEqual([
      { attempts: 1, accepted_at: null, last_error: 'Push attempt failed' },
    ]);
    await sweepRecordPush();
    expect(mocks.send).toHaveBeenCalledTimes(1);
    await sql`UPDATE notification_push_deliveries SET next_attempt_at = NOW()`;
    mocks.send.mockResolvedValue(undefined);
    await sweepRecordPush();
    await sweepRecordPush();
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect((await sql`SELECT attempts FROM notification_push_deliveries`)[0].attempts).toBe(2);
  });
  it('switches accounts without replaying the previous owner and cascades device revocation', async () => {
    mocks.owner = 'u2';
    expect((await request('PUT', device)).status).toBe(200);
    await sweepRecordPush();
    expect(mocks.send).toHaveBeenCalledTimes(2);
    mocks.authenticated = false;
    expect((await request('DELETE', { installationId: device.installationId, secret: device.secret })).status).toBe(200);
    expect(await sql`SELECT * FROM notification_push_devices`).toHaveLength(0);
    expect(await sql`SELECT * FROM notification_push_deliveries`).toHaveLength(0);
  });
  it('isolates APNs environments, dispatches only records and removes invalid devices', async () => {
    mocks.authenticated = true;
    mocks.owner = 'u1';
    const apple = { ...device, installationId: randomUUID(), clientId: 'ab'.repeat(32), provider: 'apns', environment: 'sandbox' };
    expect((await request('PUT', apple)).status).toBe(200);
    expect((await request('PUT', { ...apple, installationId: randomUUID(), environment: 'production' })).status).toBe(200);
    await sql`INSERT INTO notifications (user_key, kind, title, excerpt, link) VALUES
      ('u1', 'wca_record', 'iOS', 'PR', '/wca/comp/Test2026'),
      ('u1', 'comp_reg', 'Not a record', '', '/wca/comp/Test2026')`;
    mocks.apns.mockResolvedValue(undefined);
    await sweepRecordPush();
    expect(mocks.apns).toHaveBeenCalledTimes(2);
    expect(mocks.apns.mock.calls.map(call => call[1]).sort()).toEqual(['production', 'sandbox']);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    await sql`INSERT INTO notifications (user_key, kind, title, excerpt, link) VALUES ('u1', 'wca_record', 'Next', 'PR', '/wca/comp/Test2026')`;
    const { ApnsError } = await import('../src/utils/apns');
    mocks.apns.mockRejectedValue(new ApnsError(410, 'Unregistered'));
    await sweepRecordPush();
    expect(await sql`SELECT * FROM notification_push_devices`).toHaveLength(0);
    expect(await sql`SELECT * FROM notification_push_deliveries`).toHaveLength(0);
  });

  async function competitionFixture(systemPush = true) {
    await sql`TRUNCATE notification_push_devices, notifications, competition_notification_preferences, comp_follows CASCADE`;
    mocks.send.mockReset().mockResolvedValue(undefined);
    mocks.apns.mockReset().mockResolvedValue(undefined);
    mocks.authenticated = true; mocks.owner = 'u1';
    const prefs = { ...defaultCompetitionNotificationPreferences(), announcements: true, systemPush,
      registrationOpenMinutes: 10, registrationCloseMinutes: 10 };
    await sql`INSERT INTO competition_notification_preferences VALUES (1, ${sql.json(prefs)}, NOW() - INTERVAL '2 hours')`;
    for (const target of [device, { ...device, installationId: randomUUID(), clientId: 'newandroiddevice', pushVersion: 2 },
      { ...device, installationId: randomUUID(), clientId: 'cc'.repeat(32), provider: 'apns', environment: 'sandbox', pushVersion: 2 }]) {
      expect((await request('PUT', target)).status).toBe(200);
    }
    await sql`UPDATE notification_push_devices SET bound_at = NOW() - INTERVAL '1 hour'`;
    await sql`INSERT INTO comp_follows VALUES ('u1', 'Test2026', ${Date.now() - 7_200_000})`;
  }
  it('requires competition opt-in and version 2 on both providers; upgrade does not replay', async () => {
    await competitionFixture(false);
    await sql`INSERT INTO notifications (user_key, kind, title, excerpt, link, dedupe_key)
      VALUES ('u1', 'comp_announcement', 'Announced', '', '/wca/comp/Test2026', 'Test2026')`;
    await sweepRecordPush();
    expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.apns).not.toHaveBeenCalled();
    await sql`UPDATE competition_notification_preferences SET preferences = preferences || '{"systemPush":true}'::jsonb`;
    await sweepRecordPush(); await sweepRecordPush();
    expect(mocks.send).toHaveBeenCalledTimes(1); expect(mocks.apns).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][1]).toMatchObject({ kind: 'comp_announcement', pushVersion: 2, recipientUid: '1' });
    expect((await request('PUT', { ...device, pushVersion: 2 })).status).toBe(200);
    await sweepRecordPush(); expect(mocks.send).toHaveBeenCalledTimes(1);
    // Setting changes also exclude inbox messages created before enabling push.
    await sql`UPDATE competition_notification_preferences SET updated_at = NOW()`;
    await sql`DELETE FROM notification_push_deliveries`;
    await sweepRecordPush(); expect(mocks.apns).toHaveBeenCalledTimes(1);
  });
  it('bounds opening/closing expiry and rechecks official schedule, follow and opt-out on retries', async () => {
    for (const kind of ['comp_registration_open', 'comp_registration_close'] as const) {
      await competitionFixture();
      const at = Date.now() + 570_000;
      const comp = { id: 'Test2026', name: 'Test', cancelled_at: null as string | null,
        registration_open: new Date(kind === 'comp_registration_open' ? at : at - 86_400_000).toISOString(),
        registration_close: new Date(kind === 'comp_registration_close' ? at : at + 86_400_000).toISOString() };
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(comp))));
      await sql`INSERT INTO notifications (user_key, kind, title, excerpt, link, dedupe_key)
        VALUES ('u1', ${kind}, 'Reminder', '', '/wca/comp/Test2026', ${`Test2026:${kind}:${at}:10`})`;
      mocks.send.mockRejectedValue(new Error('offline')); mocks.apns.mockRejectedValue(new Error('offline'));
      await sweepRecordPush();
      expect(mocks.send).toHaveBeenCalledTimes(1); expect(mocks.apns).toHaveBeenCalledTimes(1);
      expect(mocks.send.mock.calls[0][1].expiresAt).toBe(at);
      await sql`UPDATE notification_push_deliveries SET next_attempt_at = NOW()`;
      comp.cancelled_at = new Date().toISOString();
      await sweepRecordPush(); expect(mocks.send).toHaveBeenCalledTimes(1);
      expect(await sql`SELECT id FROM notification_push_deliveries WHERE attempts < 5`).toHaveLength(0);
      comp.cancelled_at = null;
      await sql`UPDATE notification_push_deliveries SET attempts = 1, next_attempt_at = NOW()`;
      await sql`DELETE FROM comp_follows`;
      await sweepRecordPush(); expect(mocks.apns).toHaveBeenCalledTimes(1);
      await sql`INSERT INTO comp_follows VALUES ('u1', 'Test2026', ${Date.now() - 7_200_000})`;
      await sql`UPDATE competition_notification_preferences SET preferences = preferences || '{"systemPush":false}'::jsonb`;
      await sweepRecordPush(); expect(mocks.apns).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    }
  });

});
