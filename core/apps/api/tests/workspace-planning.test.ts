import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWorkspaceService, type Identity, type Transaction } from '../src/workspace/service';
import type { QueryRunner } from '../src/db/connection';

// Explicit disposable database only. Optional PGlite is a local test harness, not an app dependency.
const pgUrl = process.env.WORKSPACE_TEST_DATABASE_URL;
const embeddedModule = process.env.WORKSPACE_TEST_PGLITE_MODULE;
const suite = pgUrl || embeddedModule ? describe : describe.skip;
suite('workspace shared planning persistence', () => {
  let q: QueryRunner;
  let exec: (sql: string) => Promise<unknown>;
  let close: () => Promise<void>;
  let transaction: Transaction;
  let service: ReturnType<typeof createWorkspaceService>;
  const admin: Identity = { uid: 1, isAdmin: true, name: 'Admin' };
  const alice: Identity = { uid: 2, isAdmin: false, name: 'Alice' };
  const bob: Identity = { uid: 3, isAdmin: false, name: 'Bob' };
  const outsider: Identity = { uid: 4, isAdmin: false, name: 'Outside' };
  let aliceId: number, bobId: number;
  const project = randomUUID();
  const schema = `workspace_planning_${randomUUID().replaceAll('-', '')}`;
  const sqlParams = (sql: string) => { let n = 0; return sql.replace(/\?/g, () => `$${++n}`); };
  beforeAll(async () => {
    if (pgUrl) {
      const sql = postgres(pgUrl, { max: 1 });
      const runner = (client: typeof sql): QueryRunner => async <T>(text: string, params: unknown[] = []) => await client.unsafe(sqlParams(text), params as never[]) as unknown as T[];
      q = runner(sql); exec = text => sql.unsafe(text); close = () => sql.end();
      transaction = async run => await sql.begin(tx => run(runner(tx as unknown as typeof sql))) as never;
    } else {
      const { PGlite } = await import(/* @vite-ignore */ embeddedModule!);
      const db = new PGlite();
      q = async <T>(text: string, params: unknown[] = []) => (await db.query(sqlParams(text), params)).rows as T[];
      exec = text => db.exec(text); close = () => db.close();
      transaction = run => db.transaction((tx: { query: (text: string, params: unknown[]) => Promise<{ rows: unknown[] }> }) => run(async <T>(text: string, params: unknown[] = []) => (await tx.query(sqlParams(text), params)).rows as T[]));
    }
    await exec(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
    await exec('CREATE TABLE app_users(id BIGINT PRIMARY KEY,display_name TEXT,is_admin BOOLEAN,forum_banned BOOLEAN DEFAULT FALSE,merged_into_user_id BIGINT,wca_id TEXT)');
    await exec("INSERT INTO app_users(id,display_name,is_admin) VALUES (1,'Admin',TRUE),(2,'Alice',FALSE),(3,'Bob',FALSE),(4,'Outside',FALSE)");
    for (const file of ['0281_workspace', '0282_workspace_account_deletion', '0284_workspace_admin_access', '0289_workspace_checklists', '0290_workspace_schedules']) {
      await exec(readFileSync(new URL(`../migrations/${file}.sql`, import.meta.url), 'utf8'));
    }
    service = createWorkspaceService(q, transaction);
    aliceId = (await service.post(admin, 'member', { userId: 2, name: 'Alice', role: 'manager', active: true })).id as number;
    bobId = (await service.post(admin, 'member', { userId: 3, name: 'Bob', role: 'member', active: true })).id as number;
    await service.post(admin, 'member', { userId: 4, name: 'Outside', role: 'manager', active: true });
    await service.post(admin, 'project', { id: project, version: 0, name: 'Project', url: '', active: true, memberIds: [aliceId, bobId] });
  }, 30000);
  afterAll(async () => { if (exec) await exec(`DROP SCHEMA ${schema} CASCADE`); await close?.(); });
  const checklist = (projectId: string | null = project) => ({ id: randomUUID(), projectId, version: 0, name: 'Release', category: 'Product', active: true, items: [{ id: randomUUID(), text: 'Review', done: false }] });

  it('persists shared checklists, permits member completion, rejects stale writes and scope changes', async () => {
    const input = checklist();
    await service.post(alice, 'checklist', input);
    expect(await service.get(bob, 'checklists', new URLSearchParams())).toMatchObject({ checklists: [{ id: input.id, version: 1, canEdit: true, items: input.items }] });
    const done = { ...input, version: 1, items: input.items.map(item => ({ ...item, done: true })) };
    await service.post(bob, 'checklist', done);
    await expect(service.post(alice, 'checklist', done)).rejects.toMatchObject({ status: 409 });
    await expect(service.post(alice, 'checklist', { ...done, version: 2, projectId: null })).rejects.toMatchObject({ status: 409 });
    expect(await service.get(outsider, 'checklists', new URLSearchParams())).toMatchObject({ checklists: [], categories: [] });
    await expect(service.post(outsider, 'checklist', { ...done, version: 2 })).rejects.toMatchObject({ status: 404 });
    await expect(service.post(outsider, 'checklist', { ...input, projectId: null })).rejects.toMatchObject({ code: '23505' });
    expect(await service.get(alice, 'checklists', new URLSearchParams())).toMatchObject({ checklists: [{ version: 2, items: [{ done: true }] }] });
  });

  it('retains report hours and revision snapshots across older clients', async () => {
    const input = { id: randomUUID(), projectId: null, version: 0, workDate: '2026-10-19', status: 'submitted', visibility: 'company', progress: 'Done', resultUrl: '', help: '', next: '', startHour: 9, endHour: 18 };
    await service.post(alice, 'report', input);
    const { startHour, endHour, ...legacy } = input;
    await service.post(alice, 'report', { ...legacy, version: 1 });
    expect(await service.get(alice, 'detail', new URLSearchParams({ id: input.id }))).toMatchObject({ report: { startHour: 9, endHour: 18 }, revisions: [{ snapshot: { startHour: 9, endHour: 18 } }, { snapshot: { startHour: 9, endHour: 18 } }] });
    await expect(service.post(alice, 'report', { ...input, version: 2, startHour: 18, endHour: 9 })).rejects.toThrow();
    expect(await service.get(alice, 'detail', new URLSearchParams({ id: input.id }))).toHaveProperty('report.version', 2);
  });

  it('restricts schedule edits to assigned managers, persists edits and rejects invalid timelines', async () => {
    const task = { id: randomUUID(), group: 'Product', name: 'Build', owner: '', start: '2026-12-30', end: '2027-01-02', kind: 'task', progress: 50 };
    const input = { id: randomUUID(), name: 'Plan', projectId: project, version: 0, active: true, tasks: [task] };
    await expect(service.post(bob, 'schedule', input)).rejects.toMatchObject({ status: 403 });
    await expect(service.post(outsider, 'schedule', input)).rejects.toMatchObject({ status: 403 });
    await service.post(alice, 'schedule', input);
    expect(await service.get(bob, 'schedules', new URLSearchParams())).toMatchObject({ schedules: [{ canEdit: false, tasks: [task] }] });
    expect(await service.get(outsider, 'schedules', new URLSearchParams({ id: input.id }))).toMatchObject({ schedules: [], selected: null });
    await service.post(admin, 'schedule', { ...input, version: 1, tasks: [{ ...task, progress: 100 }] });
    await expect(service.post(alice, 'schedule', { ...input, version: 1 })).rejects.toMatchObject({ status: 409 });
    for (const tasks of [[{ ...task, end: '2026-02-31' }], [{ ...task, kind: 'milestone' }], [{ ...task, progress: 101 }], [task, task], [{ ...task, end: '2030-01-01' }]]) {
      await expect(service.post(alice, 'schedule', { ...input, version: 2, tasks })).rejects.toThrow();
    }
    expect(await service.get(alice, 'schedules', new URLSearchParams())).toMatchObject({ schedules: [{ version: 2, tasks: [{ progress: 100 }] }] });
  });

  it('rejects malformed items and protects archived projects and revoked members', async () => {
    const input = checklist();
    await expect(service.post(alice, 'checklist', { ...input, items: [input.items[0], input.items[0]] })).rejects.toThrow();
    await service.post(admin, 'project', { id: project, version: 1, name: 'Project', url: '', active: false, memberIds: [aliceId, bobId] });
    await expect(service.post(bob, 'checklist', input)).rejects.toMatchObject({ status: 403 });
    expect(await service.get(bob, 'checklists', new URLSearchParams())).toMatchObject({ checklists: [{ canEdit: false }] });
    const schedules = await service.get(alice, 'schedules', new URLSearchParams()) as { schedules: { id: string; version: number }[] };
    expect(schedules).toMatchObject({ schedules: [{ canEdit: false }] });
    await expect(service.post(alice, 'schedule', { ...schedules.schedules[0], active: true })).rejects.toMatchObject({ status: 403 });
    await service.post(admin, 'member', { userId: 3, name: 'Bob', role: 'member', active: false });
    await expect(service.get(bob, 'checklists', new URLSearchParams())).rejects.toMatchObject({ status: 403 });
  });

  it('preserves shared company content after its author account is deleted', async () => {
    const input = checklist(null);
    await service.post(alice, 'checklist', input);
    await q('DELETE FROM app_users WHERE id=?', [alice.uid]);
    expect(await service.get(outsider, 'checklists', new URLSearchParams())).toMatchObject({ checklists: [{ id: input.id }] });
    await expect(service.get(alice, 'checklists', new URLSearchParams())).rejects.toMatchObject({ status: 401 });
  });

  it('bounds list responses and filters categories before pagination', async () => {
    for (let index = 0; index < 22; index++) await service.post(outsider, 'checklist', { ...checklist(null), category: 'Paging', name: `List ${index}` });
    const first = await service.get(outsider, 'checklists', new URLSearchParams({ category: 'Paging' })) as { checklists: { id: string }[]; hasMore: boolean };
    const second = await service.get(outsider, 'checklists', new URLSearchParams({ category: 'Paging', page: '2' })) as typeof first;
    expect(first.checklists).toHaveLength(20); expect(first.hasMore).toBe(true);
    expect(second.checklists).toHaveLength(2); expect(second.hasMore).toBe(false);
    expect(new Set([...first.checklists, ...second.checklists].map(row => row.id)).size).toBe(22);
    await expect(service.get(outsider, 'checklists', new URLSearchParams({ page: '-1' }))).rejects.toThrow();
  });
});
