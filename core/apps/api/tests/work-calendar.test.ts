import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { beforeAll, afterAll, expect, it, describe } from 'vitest';
import { createWorkspaceService, type Identity, type Transaction } from '../src/workspace/service';
import type { QueryRunner } from '../src/db/connection';
import { workPatternInput } from '../src/workspace/work-calendar';
import { expandWorkCalendar, type WorkCalendarData } from '@cuberoot/shared/workspace-planning';

it('rejects overlapping hours, fractional hours, invalid zones and forged owners', () => {
  const base = { version: 0, from: '2026-11-15', tz: 'Asia/Shanghai', slots: [{ weekday: 2, startHour: 10, endHour: 19 }] };
  expect(workPatternInput.safeParse(base).success).toBe(true);
  for (const input of [{ ...base, userId: 9 }, { ...base, tz: 'Fake/Zone' }, { ...base, slots: [...base.slots, { weekday: 2, startHour: 18, endHour: 20 }] }, { ...base, slots: [{ weekday: 2, startHour: 10.5, endHour: 19 }] }]) expect(workPatternInput.safeParse(input).success).toBe(false);
});

const suite = process.env.WORKSPACE_TEST_DATABASE_URL ? describe : describe.skip;
suite('work calendar PostgreSQL permissions and persistence', () => {
  const sql = postgres(process.env.WORKSPACE_TEST_DATABASE_URL!, { max: 1 });
  const schema = `work_calendar_${randomUUID().replaceAll('-', '')}`;
  const runner = (client: typeof sql): QueryRunner => async <T>(text: string, params: unknown[] = []) => {
    let i = 0; return await client.unsafe(text.replace(/\?/g, () => `$${++i}`), params as never[]) as unknown as T[];
  };
  const q = runner(sql);
  const tx: Transaction = async run => await sql.begin(client => run(runner(client as unknown as typeof sql))) as never;
  const service = createWorkspaceService(q, tx);
  const root: Identity = { uid: 1, name: 'Root', isAdmin: true };
  const alice: Identity = { uid: 2, name: 'Alice', isAdmin: true };
  const staff: Identity = { uid: 3, name: 'Staff', isAdmin: false };
  const window = new URLSearchParams({ from: '2026-10-25', to: '2026-12-01' });
  const get = (actor = root) => service.get(actor, 'work-calendar', window) as Promise<WorkCalendarData>;
  let id: string;
  beforeAll(async () => {
    await sql.unsafe(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
    await sql.unsafe("CREATE TABLE app_users(id BIGINT PRIMARY KEY, display_name TEXT, is_admin BOOLEAN, wca_id TEXT, merged_into_user_id BIGINT, forum_banned BOOLEAN DEFAULT FALSE); INSERT INTO app_users(id,display_name,is_admin,wca_id) VALUES(1,'Root',FALSE,'2017YANR02'),(2,'Alice',TRUE,NULL),(3,'Staff',FALSE,NULL)");
    for (const migration of ['0281_workspace', '0282_workspace_account_deletion', '0284_workspace_admin_access', '0291_workspace_checklists', '0292_workspace_schedules', '0293_workspace_remove_checklist_categories', '0331_workspace_work_calendar', '0332_workspace_remove_projects']) await sql.unsafe(readFileSync(new URL(`../migrations/${migration}.sql`, import.meta.url), 'utf8'));
    await service.post(root, 'member', { userId: 3, name: 'Staff', role: 'manager', active: true });
  });
  afterAll(async () => { await sql.unsafe(`DROP SCHEMA ${schema} CASCADE`); await sql.end(); });
  it('shares only administrator schedules; staff/manager cannot read or write', async () => {
    const saved = await service.post(alice, 'work-pattern', { version: 0, from: '2026-10-25', tz: 'America/Los_Angeles', slots: [{ weekday: 0, startHour: 16, endHour: 20 }, { weekday: 2, startHour: 10, endHour: 19 }, { weekday: 6, startHour: 10, endHour: 19 }] }) as { id: string };
    id = saved.id;
    const data = await get();
    expect(data.members.map(m => m.userId)).toEqual([1, 2]);
    expect(data.periods[0].slots).toHaveLength(3);
    await expect(get(staff)).rejects.toMatchObject({ status: 403 });
    await expect(service.post(staff, 'work-pattern', {})).rejects.toMatchObject({ status: 403 });
    const expanded = expandWorkCalendar(data, Date.parse('2026-10-25T00:00Z'), Date.parse('2026-11-03T00:00Z'));
    expect(expanded.find(e => e.date === '2026-10-25')?.start).toBe(Date.parse('2026-10-25T23:00Z'));
    expect(expanded.find(e => e.date === '2026-11-01')?.start).toBe(Date.parse('2026-11-02T00:00Z'));
  });
  it('prevents even root from changing another person and rejects stale writes', async () => {
    await expect(service.post(root, 'work-exception', { version: 0, periodId: id, date: '2026-11-17', slots: [] })).rejects.toMatchObject({ status: 404 });
    await service.post(alice, 'work-exception', { version: 1, periodId: id, date: '2026-11-17', slots: [] });
    await expect(service.post(alice, 'work-exception', { version: 1, periodId: id, date: '2026-11-17', slots: null })).rejects.toMatchObject({ status: 409 });
    expect((await get()).exceptions[0].slots).toEqual([]);
    await service.post(alice, 'work-exception', { version: 2, periodId: id, date: '2026-11-17', slots: null });
    expect((await get()).exceptions).toEqual([]);
  });
  it('preserves history when replacing future weekly patterns and handles midnight', async () => {
    await service.post(alice, 'work-pattern', { version: 3, from: '2026-11-16', tz: 'Asia/Shanghai', slots: [{ weekday: 2, startHour: 22, endHour: 24 }] });
    const data = await get();
    expect(data.periods.map(p => [p.from, p.until])).toEqual([['2026-10-25', '2026-11-16'], ['2026-11-16', null]]);
    const events = expandWorkCalendar(data, Date.parse('2026-11-16'), Date.parse('2026-11-19'));
    expect(events.map(e => e.date)).toEqual(['2026-11-15', '2026-11-17']);
    expect(events[1].end).toBe(Date.parse('2026-11-17T16:00Z'));
  });
  it('revokes access from current database roles and cascades deleted account plans', async () => {
    await q('UPDATE app_users SET is_admin=FALSE WHERE id=2');
    await expect(get(alice)).rejects.toMatchObject({ status: 403 });
    expect((await get()).periods).toEqual([]);
    await q('DELETE FROM app_users WHERE id=2');
    expect(await q('SELECT * FROM workspace_work_calendars')).toEqual([]);
    expect(await q('SELECT * FROM workspace_work_periods')).toEqual([]);
  });
});
