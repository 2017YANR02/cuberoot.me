import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let sql: ReturnType<typeof postgres>;
const schema = `record_push_test_${randomUUID().replaceAll('-', '')}`;
const placeholders = (statement: string) => { let index = 0; return statement.replace(/\?/g, () => `$${++index}`); };
const mocks = vi.hoisted(() => ({ send: vi.fn(), owner: 'u1', authenticated: true }));
vi.mock('../src/db/connection.js', () => ({
  query: (statement: string, values: never[] = []) => sql.unsafe(placeholders(statement), values),
  withTransaction: (work: (query: (statement: string, values?: never[]) => unknown) => Promise<unknown>) =>
    sql.begin(tx => work((statement, values = []) => tx.unsafe(placeholders(statement), values))),
}));
vi.mock('../src/utils/getui.js', () => ({ getuiConfig: (app: string) => app === 'me.cuberoot.app' ? {} : null, sendRecordPush: mocks.send }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: async () => {
  if (!mocks.authenticated) throw new HTTPException(401);
  return { wcaId: mocks.owner };
} }));
vi.mock('../src/utils/notify.js', () => ({ rememberLang: vi.fn(), verifyUnsubToken: vi.fn() }));
vi.mock('../src/utils/account.js', () => ({ publicUserIdsForOwnerKeys: vi.fn() }));
import { notificationRoutes } from '../src/routes/notifications';
import { sweepRecordPush } from '../src/utils/record_push';
const device = { installationId: randomUUID(), secret: 'a'.repeat(64), appId: 'me.cuberoot.app', clientId: '0123456789abcdef' };
const request = (method: string, body: unknown) => notificationRoutes.request('/notifications/push/device', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe.skipIf(process.env.RECORD_PUSH_TEST_PG !== '1')('record push migration, ownership and queue (PostgreSQL)', () => {
  beforeAll(async () => {
    sql = postgres({ host: '127.0.0.1', port: 5433, user: 'postgres', password: 'dev', database: 'cuberoot_db', max: 2, connection: { search_path: schema } });
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe(`CREATE TABLE app_users (id BIGINT PRIMARY KEY, wca_id TEXT);
      CREATE TABLE notifications (id BIGSERIAL PRIMARY KEY, user_key TEXT, kind TEXT, title TEXT, excerpt TEXT, link TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
      INSERT INTO app_users VALUES (1, '2017TEST01'), (2, NULL);`);
    await sql.unsafe(await readFile(new URL('../migrations/0239_record_push.sql', import.meta.url), 'utf8'));
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
});
