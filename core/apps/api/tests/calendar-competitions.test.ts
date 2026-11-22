import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: async () => ({ wcaId: '2017ROOT01', name: 'Test' }), checkRateLimit: () => {},
}));
vi.mock('../src/utils/notify.js', () => ({ notify: async () => {} }));
import { calendarRoutes } from '../src/routes/calendar.js';
import { query, sql } from '../src/db/connection.js';

// Run only against a dedicated disposable database, never a user's development data.
describe.skipIf(process.env.CALENDAR_TEST_DATABASE !== '1')('personal calendar (PostgreSQL)', () => {
  const input = { id: 'Ningbo2026', title: 'Ningbo Open 2026', startDate: '2026-10-31', endDate: '2026-11-01', location: 'Ningbo' };
  const add = (restore = false, competitions = [input], owner = '2017ROOT01') => calendarRoutes.request('/calendar/competitions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ competitions, restore, owner, tz: 'America/Los_Angeles' }),
  });
  const write = (path: string, method: string, body: object) => calendarRoutes.request(`/calendar/${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  beforeAll(async () => {
    if (!process.env.DB_NAME?.startsWith('calendar_test_')) throw new Error('Dedicated calendar_test_ database required');
    for (const name of ['0099_calendar.sql', '0101_calendar_imports.sql', '0299_calendar_competitions.sql']) {
      await sql.unsafe(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
    }
    await query('CREATE TABLE app_users (id BIGINT PRIMARY KEY, wca_id TEXT, display_name TEXT, avatar_url TEXT)');
    const [calendar] = await query<{ id: string }>(`INSERT INTO calendars (owner_key, tz, created_at, updated_at)
      VALUES ('2017ROOT01', 'UTC', 1, 1) RETURNING id`);
    await query(`INSERT INTO calendar_events (calendar_id, owner_key, tz, start_ms, end_ms, created_at, updated_at)
      VALUES (?, '2017ROOT01', 'UTC', 1, 2, 1, 1)`, [calendar.id]);
    await sql.unsafe(readFileSync(new URL('../migrations/0351_calendar_event_status.sql', import.meta.url), 'utf8'));
    expect(await query('SELECT status FROM calendar_events')).toEqual([{ status: 'confirmed' }]);
  });
  beforeEach(async () => { await query('TRUNCATE calendars, calendar_competitions RESTART IDENTITY CASCADE'); });
  afterAll(async () => { await sql.end(); });
  it('coalesces concurrent registration/follow/manual imports with exclusive local midnights', async () => {
    const responses = await Promise.all([add(), add(), add(true)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    const rows = await query<{ start_ms: string; end_ms: string }>('SELECT start_ms, end_ms FROM calendar_events');
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].start_ms)).toBe(Date.parse('2026-10-31T07:00:00Z'));
    expect(Number(rows[0].end_ms)).toBe(Date.parse('2026-11-02T08:00:00Z'));
  });
  it('adopts an existing event from another calendar without losing notes or edits', async () => {
    await add();
    await query('DELETE FROM calendar_competitions');
    const [cal] = await query<{ id: string }>(`INSERT INTO calendars (owner_key, name, tz, created_at, updated_at)
      VALUES ('2017ROOT01', 'Imported', 'UTC', 1, 1) RETURNING id`);
    const description = `Travel notes\r\nhttps://www.worldcubeassociation.org/competitions/${input.id}\r\nBring timer`;
    await query("UPDATE calendar_events SET calendar_id = ?, title = '我的比赛', description = ?, reminders = '30,60'", [cal.id, description]);
    expect((await add()).status).toBe(200);
    const events = await query<{ title: string; description: string; reminders: string; calendar_id: string }>('SELECT * FROM calendar_events');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: '我的比赛', description, reminders: '30,60', calendar_id: cal.id });
  });
  it('respects deletion until explicitly added again', async () => {
    await add();
    await query('DELETE FROM calendar_events');
    expect((await add()).status).toBe(200);
    expect(await query('SELECT id FROM calendar_events')).toHaveLength(0);
    expect((await add(true)).status).toBe(200);
    expect(await query('SELECT id FROM calendar_events')).toHaveLength(1);
  });
  it('does not adopt another owner’s event and rejects a stale account request', async () => {
    await add();
    await query('DELETE FROM calendar_competitions');
    await query("UPDATE calendar_events SET owner_key = '2018ROOT01'");
    expect((await add()).status).toBe(200);
    expect(await query('SELECT id FROM calendar_events')).toHaveLength(2);
    expect((await add(false, [input], '2018ROOT01')).status).toBe(409);
  });

  it('preserves status on a time edit and shares a tentative recurrence override without private details', async () => {
    const boot = await (await calendarRoutes.request('/calendar/bootstrap')).json();
    expect(boot.supportsEventStatus).toBe(true);
    const start = Date.now();
    const draft = { calendarId: boot.calendars[0].id, title: 'Private title', description: 'Private note', location: 'Private place', start, end: start + 3600_000, rrule: 'FREQ=DAILY;COUNT=3' };
    const { event: series } = await (await write('events', 'POST', draft)).json();
    expect(series.status).toBe('confirmed');

    const occurrenceMs = start + 86_400_000;
    const { event: override } = await (await write(`events/${series.id}?scope=this`, 'PATCH', {
      occurrenceMs, start: occurrenceMs, end: occurrenceMs + 3600_000, status: 'tentative',
    })).json();
    const { event: moved } = await (await write(`events/${override.id}`, 'PATCH', { end: occurrenceMs + 5400_000 })).json();
    expect(moved).toMatchObject({ status: 'tentative', end: occurrenceMs + 5400_000 });

    const share = `calendar/public/${boot.share.token}`;
    const publicUrl = `/${share}?from=${start - 1}&to=${start + 4 * 86_400_000}`;
    await write('share', 'PUT', { enabled: true, detail: 'full' });
    const full = await (await calendarRoutes.request(publicUrl)).json();
    expect(full.events).toMatchObject([{ status: 'confirmed', title: draft.title }, { status: 'tentative', title: draft.title }]);

    await write('share', 'PUT', { detail: 'busy' });
    const redacted = await (await calendarRoutes.request(publicUrl)).json();
    expect(redacted.events).toMatchObject(['confirmed', 'tentative'].map(status => ({ status, title: '', description: '', location: '', guests: [], reminders: [] })));
    const feed = await (await calendarRoutes.request(`/${share}/ics`)).text();
    expect(feed).toContain('SUMMARY:Busy\r\nSTATUS:CONFIRMED');
    expect(feed).toContain('SUMMARY:Tentative time\r\nSTATUS:TENTATIVE');
    expect(feed).not.toContain('Private');
    expect(feed.match(new RegExp(`UID:cal-${series.id}@cuberoot\\.me`, 'g'))).toHaveLength(2);

    const { event: confirmed } = await (await write(`events/${override.id}`, 'PATCH', { status: 'confirmed' })).json();
    expect(confirmed.status).toBe('confirmed');
  });
});
