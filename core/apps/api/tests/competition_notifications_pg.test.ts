import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCompetitionNotificationPreferences as defaults } from '@cuberoot/shared/competition-notifications';

let sql: ReturnType<typeof postgres>;
const schema = `competition_notify_${randomUUID().replaceAll('-', '')}`;
const mocks = vi.hoisted(() => ({ authenticated: true, owner: 'u1', fetch: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: (statement: string, values: never[] = []) => {
  let i = 0; return sql.unsafe(statement.replace(/\?/g, () => `$${++i}`), values);
} }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'local-fixture-only' }));
vi.mock('../src/utils/email.js', () => ({ emailConfigured: () => false, sendEmail: vi.fn() }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: async () => {
  if (!mocks.authenticated) throw new HTTPException(401);
  return { wcaId: mocks.owner };
} }));
vi.mock('../src/utils/account.js', () => ({ publicUserIdsForOwnerKeys: async () => new Map() }));
import { notificationRoutes } from '../src/routes/notifications';
import { observeCompetitionAnnouncements, sweepCompetitionRegistrationReminders } from '../src/utils/competition_notifications';

const request = (method: string, preferences?: unknown) => notificationRoutes.request('/notifications/competitions', {
  method, headers: { 'Content-Type': 'application/json' }, ...(preferences ? { body: JSON.stringify(preferences) } : {}),
});
const recent = (offset: number) => new Date(Date.now() + offset).toISOString();
const announcement = () => ({ id: 'Fixture2026', name: 'Fixture 2026', name_zh: '本地比赛', country: 'cn', city: 'Shanghai',
  start_date: '2026-12-01', end_date: '2026-12-02', events: ['333'], announced_at: recent(-60_000) });
const prefs = { ...defaults(), announcements: true, regions: ['AS'], registrationOpenMinutes: 10 as const, registrationCloseMinutes: 60 as const };
const schedule = () => ({ id: 'Fixture2026', name: 'Fixture 2026', cancelled_at: null,
  registration_open: recent(9 * 60_000), registration_close: recent(86_400_000) });
async function subscribed() {
  await request('PUT', prefs);
  await sql`UPDATE competition_notification_preferences SET updated_at = NOW() - INTERVAL '2 days'`;
  await sql`INSERT INTO comp_follows VALUES ('u1', 'Fixture2026', ${Date.now() - 86_400_000}) ON CONFLICT DO NOTHING`;
}
async function resetChecks() { await sql`DELETE FROM competition_registration_checks`; }

describe.skipIf(process.env.COMPETITION_NOTIFICATIONS_TEST_PG !== '1')('competition notifications with PostgreSQL', () => {
  beforeAll(async () => {
    sql = postgres({ host: '127.0.0.1', port: 5433, user: 'postgres', password: 'dev', database: 'cuberoot_db', max: 2,
      connection: { search_path: schema } });
    await sql.unsafe(`CREATE SCHEMA "${schema}";
      CREATE TABLE app_users (id BIGINT PRIMARY KEY, wca_id TEXT, lang TEXT, created_at TIMESTAMPTZ DEFAULT NOW() - INTERVAL '5 days', merged_into_user_id BIGINT);
      INSERT INTO app_users (id, lang) VALUES (1, 'zh'), (2, 'en');`);
    for (const file of ['0070_notifications.sql', '0045_comp_follows.sql', '0317_competition_notifications.sql']) {
      await sql.unsafe(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
    }
    const dedupe = (await readFile(new URL('../migrations/0158_teaching_conversations.sql', import.meta.url), 'utf8')).split('CREATE TABLE teaching_conversations')[0];
    await sql.unsafe(dedupe);
    vi.stubGlobal('fetch', mocks.fetch);
  });
  beforeEach(async () => {
    mocks.owner = 'u1'; mocks.authenticated = true; mocks.fetch.mockReset();
    await sql`TRUNCATE competition_notification_preferences, competition_announcement_events, competition_registration_checks, comp_follows, notifications`;
    await sql`UPDATE app_users SET merged_into_user_id = NULL`;
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    if (sql) { await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await sql.end(); }
  });
  it('requires authentication, rejects invalid input, isolates users, and preserves no-op subscription time', async () => {
    mocks.authenticated = false;
    expect((await request('GET')).status).toBe(401);
    expect((await request('PUT', prefs)).status).toBe(401);
    mocks.authenticated = true;
    expect(await (await request('GET')).json()).toMatchObject({ preferences: defaults() });
    expect((await request('PUT', { ...prefs, regions: ['zz'] })).status).toBe(400);
    expect((await request('PUT', { ...prefs, user_id: 2 })).status).toBe(400);
    await subscribed();
    const before = await sql`SELECT updated_at FROM competition_notification_preferences`;
    expect((await request('PUT', prefs)).status).toBe(200);
    expect(await sql`SELECT updated_at FROM competition_notification_preferences`).toEqual(before);
    mocks.owner = 'u2';
    expect(await (await request('GET')).json()).toMatchObject({ preferences: defaults() });
  });
  it('writes matching announcements once, exposes unread inbox entries, and never backfills new subscriptions', async () => {
    await subscribed();
    mocks.owner = 'u2'; await request('PUT', prefs); mocks.owner = 'u1';
    const comp = announcement();
    await observeCompetitionAnnouncements([comp]);
    await observeCompetitionAnnouncements([comp]);
    expect(await sql`SELECT user_key, kind, title, link FROM notifications`).toEqual([
      { user_key: 'u1', kind: 'comp_announcement', title: '本地比赛', link: '/wca/comp/Fixture2026' },
    ]);
    expect(await (await notificationRoutes.request('/notifications/unread')).json()).toEqual({ count: 1 });
    const inbox = await (await notificationRoutes.request('/notifications')).json();
    expect(inbox).toMatchObject([{ kind: 'comp_announcement', read: false }]);
    expect((await notificationRoutes.request('/notifications/read', { method: 'POST', body: JSON.stringify({ ids: [inbox[0].id] }) })).status).toBe(200);
    expect(await (await notificationRoutes.request('/notifications/unread')).json()).toEqual({ count: 0 });
  });
  it('recovers an interrupted announcement without duplicate recipients and excludes cancelled/missing snapshots', async () => {
    await subscribed();
    const comp = announcement(); await observeCompetitionAnnouncements([comp]);
    await sql`UPDATE competition_announcement_events SET processed_at = NULL`;
    await observeCompetitionAnnouncements([]);
    expect((await sql`SELECT processed_at FROM competition_announcement_events`)[0].processed_at).toBeNull();
    await observeCompetitionAnnouncements([comp]);
    expect(await sql`SELECT * FROM notifications`).toHaveLength(1);
    await sql`TRUNCATE notifications, competition_announcement_events`;
    await request('PUT', { ...prefs, announcements: false });
    await observeCompetitionAnnouncements([{ ...comp, announced_at: recent(1000) }]);
    expect(await sql`SELECT * FROM notifications`).toHaveLength(0);
  });
  it('never marks unseen messages read when given an empty or malformed ID list', async () => {
    await subscribed(); await observeCompetitionAnnouncements([announcement()]);
    for (const body of ['{', 'null', '{"ids":"all"}', '{"ids":[-1]}']) {
      expect((await notificationRoutes.request('/notifications/read', { method: 'POST', body })).status).toBe(400);
    }
    expect((await notificationRoutes.request('/notifications/read', { method: 'POST', body: '{"ids":[]}' })).status).toBe(200);
    expect(await (await notificationRoutes.request('/notifications/unread')).json()).toEqual({ count: 1 });
    mocks.owner = 'u2';
    const [n] = await sql`SELECT id FROM notifications`;
    await notificationRoutes.request('/notifications/read', { method: 'POST', body: JSON.stringify({ ids: [Number(n.id)] }) });
    expect((await sql`SELECT read_at FROM notifications`)[0].read_at).toBeNull();
  });
  it('fresh-checks schedules and deduplicates reminders across repeated scans', async () => {
    await subscribed(); const comp = schedule();
    mocks.fetch.mockImplementation(async () => Response.json(comp));
    await sweepCompetitionRegistrationReminders(); await resetChecks(); await sweepCompetitionRegistrationReminders();
    expect(await sql`SELECT user_key, kind FROM notifications`).toEqual([{ user_key: 'u1', kind: 'comp_registration_open' }]);
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://www.worldcubeassociation.org/api/v0/competitions/Fixture2026');
    await resetChecks(); await sql`DELETE FROM comp_follows`;
    mocks.fetch.mockClear(); await sweepCompetitionRegistrationReminders();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('fails closed on stale source errors, cancellation, schedule changes and disabling while fetching', async () => {
    await subscribed();
    for (const response of [new Response('', { status: 503 }), Response.json({ ...schedule(), cancelled_at: recent(-1000) }),
      Response.json({ ...schedule(), registration_open: recent(3_600_000) }), Response.json({ id: 'Other2026' })]) {
      mocks.fetch.mockResolvedValueOnce(response); await resetChecks(); await sweepCompetitionRegistrationReminders();
    }
    expect(await sql`SELECT * FROM notifications`).toHaveLength(0);
    mocks.fetch.mockImplementationOnce(async () => { await request('PUT', defaults()); return Response.json(schedule()); });
    await resetChecks(); await sweepCompetitionRegistrationReminders();
    expect(await sql`SELECT * FROM notifications`).toHaveLength(0);
  });
  it('does not send for merged accounts; deleting an account cascades its preferences', async () => {
    await subscribed(); await sql`UPDATE app_users SET merged_into_user_id = 2 WHERE id = 1`;
    await observeCompetitionAnnouncements([announcement()]); await sweepCompetitionRegistrationReminders();
    expect(await sql`SELECT * FROM notifications`).toHaveLength(0); expect(mocks.fetch).not.toHaveBeenCalled();
    await sql`DELETE FROM app_users WHERE id = 1`;
    expect(await sql`SELECT * FROM competition_notification_preferences`).toHaveLength(0);
  });
});
