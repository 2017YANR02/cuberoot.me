import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWorkspaceService, type Identity, type Transaction } from '../src/workspace/service';
import type { QueryRunner } from '../src/db/connection';
import { checklistInput, planningService } from '../src/workspace/planning';

describe('workspace planning JSON parameter encoding', () => {
  it.each(['checklist', 'schedule'] as const)('keeps %s arrays through the production driver on create and update', async kind => {
    const driver = postgres(); // No connection: exercise the installed production serializer.
    const id = randomUUID();
    let old: { id: string; version: number } | undefined;
    let expected: unknown[] = [];
    const q: QueryRunner = async <T>(text: string, params: unknown[] = []) => {
      if (text.startsWith('SELECT')) return (old ? [old] : []) as T[];
      const inserting = text.startsWith('INSERT');
      const index = inserting ? 2 : 1;
      const encoded = driver.options.serializers[3802](params[index]);
      expect(JSON.parse(String(encoded))).toEqual(expected);
      old = { id, version: (old?.version ?? 0) + 1 };
      return [];
    };
    const service = planningService(q, {
      manager: true,
      audit: async () => {},
      fail: message => { throw new Error(message); },
    });
    const item = kind === 'checklist'
      ? { id: randomUUID(), text: 'Review', done: false }
      : { id: randomUUID(), group: 'Product', name: 'Build', owner: '', start: '2026-10-25', end: '2026-10-25', kind: 'task', progress: 0 };
    try {
      for (const [version, entries] of [[], [item], []].entries()) {
        expected = entries;
        const input = { id, name: 'Plan', active: true, version };
        if (kind === 'checklist') await service.saveChecklist({ ...input, items: entries });
        else await service.saveSchedule({ ...input, tasks: entries });
      }
    } finally { await driver.end(); }
  });
});

it('accepts named checklists without categories and ignores legacy category input', () => {
  const input = { id: randomUUID(), name: 'Release', version: 0, active: true, items: [] };
  expect(checklistInput.parse(input)).toEqual(input);
  expect(checklistInput.parse({ ...input, category: 'Old group' })).toEqual(input);
});

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
  const legacyChecklist = randomUUID();
  const legacyProject = randomUUID(), legacyReportA = randomUUID(), legacyReportB = randomUUID();
  const legacyItems = [{ id: randomUUID(), text: 'Keep this task', done: true }];
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
      // PGlite otherwise accepts pre-encoded JSON strings, masking postgres.js double encoding.
      const driver = postgres();
      const db = new PGlite({ serializers: {
        114: driver.options.serializers[114], 3802: driver.options.serializers[3802],
      } });
      q = async <T>(text: string, params: unknown[] = []) => (await db.query(sqlParams(text), params)).rows as T[];
      exec = text => db.exec(text); close = async () => { await db.close(); await driver.end(); };
      transaction = run => db.transaction((tx: { query: (text: string, params: unknown[]) => Promise<{ rows: unknown[] }> }) => run(async <T>(text: string, params: unknown[] = []) => (await tx.query(sqlParams(text), params)).rows as T[]));
    }
    await exec(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
    await exec('CREATE TABLE app_users(id BIGINT PRIMARY KEY,display_name TEXT,is_admin BOOLEAN,forum_banned BOOLEAN DEFAULT FALSE,merged_into_user_id BIGINT,wca_id TEXT)');
    await exec("INSERT INTO app_users(id,display_name,is_admin) VALUES (1,'Admin',TRUE),(2,'Alice',FALSE),(3,'Bob',FALSE),(4,'Outside',FALSE)");
    for (const file of ['0281_workspace', '0282_workspace_account_deletion', '0284_workspace_admin_access', '0291_workspace_checklists', '0292_workspace_schedules']) {
      await exec(readFileSync(new URL(`../migrations/${file}.sql`, import.meta.url), 'utf8'));
    }
    await q("INSERT INTO workspace_checklists(id,project_id,name,category,items,active,version,created_at,updated_at) VALUES (?,NULL,'Legacy','Old group',?,FALSE,7,1,2)", [legacyChecklist, legacyItems]);
    await exec(readFileSync(new URL('../migrations/0293_workspace_remove_checklist_categories.sql', import.meta.url), 'utf8'));
    await q("INSERT INTO workspace_projects(id,name,version,created_at) VALUES (?,'Retired project',1,1)",[legacyProject]);
    const [legacyMember] = await q<{id:number}>("INSERT INTO workspace_members(user_id,name,role) VALUES (4,'Outside','manager') RETURNING id");
    await q('INSERT INTO workspace_project_members(project_id,member_id) VALUES (?,?)',[legacyProject,legacyMember.id]);
    await q('UPDATE workspace_checklists SET project_id=? WHERE id=?',[legacyProject,legacyChecklist]);
    for (const [id, projectId] of [[legacyReportA,legacyProject],[legacyReportB,null]]) {
      await q("INSERT INTO workspace_reports(id,member_id,project_id,work_date,status,visibility,version,payload,created_at,updated_at) VALUES (?,?,?,'2026-01-01','submitted','company',1,?,1,1)",[id,legacyMember.id,projectId,{progress:'Keep original report'}]);
      await q('INSERT INTO workspace_revisions(report_id,version,snapshot,created_at) VALUES (?,1,?,1)',[id,{projectId,projectName:'Retired project',projectActive:true,progress:'Keep original revision'}]);
    }
    await exec(readFileSync(new URL('../migrations/0332_workspace_remove_projects.sql', import.meta.url), 'utf8'));
    await exec(readFileSync(new URL('../migrations/0337_workspace_checklist_sections.sql', import.meta.url), 'utf8'));
    service = createWorkspaceService(q, transaction);
    aliceId = (await service.post(admin, 'member', { userId: 2, name: 'Alice', role: 'manager', active: true })).id as number;
    bobId = (await service.post(admin, 'member', { userId: 3, name: 'Bob', role: 'member', active: true })).id as number;
    await service.post(admin, 'member', { userId: 4, name: 'Outside', role: 'manager', active: true });
  }, 30000);
  afterAll(async () => { if (exec) await exec(`DROP SCHEMA ${schema} CASCADE`); await close?.(); });
  const checklist = () => ({ id: randomUUID(), version: 0, name: 'Release', active: true, items: [{ id: randomUUID(), text: 'Review', done: false }] });

  it('removes categories and projects while retaining checklist content and versions', async () => {
    const [row] = await q('SELECT * FROM workspace_checklists WHERE id=?', [legacyChecklist]);
    expect(row).toMatchObject({ id: legacyChecklist, name: 'Legacy', items: legacyItems, active: false, version: 7, created_at: 1, updated_at: 2 });
    expect(row).not.toHaveProperty('category');
    expect(row).not.toHaveProperty('project_id');
  });

  it('removes project tables and metadata without merging same-day reports', async () => {
    expect(await q('SELECT id FROM workspace_reports WHERE id=ANY(?::uuid[]) ORDER BY id',[[legacyReportA,legacyReportB]])).toHaveLength(2);
    expect(await q('SELECT snapshot FROM workspace_revisions WHERE report_id=ANY(?::uuid[])',[[legacyReportA,legacyReportB]])).toEqual([{snapshot:{progress:'Keep original revision'}},{snapshot:{progress:'Keep original revision'}}]);
    expect(await q("SELECT to_regclass('workspace_projects') AS projects,to_regclass('workspace_project_members') AS members")).toEqual([{projects:null,members:null}]);
    await expect(service.get(admin,'projects',new URLSearchParams())).rejects.toMatchObject({status:404});
    await expect(service.post(admin,'project',{})).rejects.toMatchObject({status:404});
  });

  it('persists shared checklists, permits member completion, rejects stale writes across the whole workspace', async () => {
    const input = checklist();
    await service.post(alice, 'checklist', input);
    expect(await service.get(bob, 'checklists', new URLSearchParams())).toMatchObject({ checklists: [{ id: input.id, version: 1, canEdit: true, items: input.items }] });
    const done = { ...input, version: 1, items: input.items.map(item => ({ ...item, done: true })) };
    await service.post(bob, 'checklist', done);
    await expect(service.post(alice, 'checklist', done)).rejects.toMatchObject({ status: 409 });
    expect(await service.get(outsider, 'checklists', new URLSearchParams())).toMatchObject({ checklists: expect.arrayContaining([expect.objectContaining({ id: input.id })]) });
    const response = await service.get(bob, 'checklists', new URLSearchParams());
    expect(response).not.toHaveProperty('categories');
    expect(response).not.toHaveProperty('checklists.0.category');
    expect(await service.get(alice, 'checklists', new URLSearchParams())).toMatchObject({ checklists: [{ version: 2, items: [{ done: true }] }] });
  });

  it('stores empty explicit categories and never classifies text prefixes', async () => {
    const category = { id: randomUUID(), name: '/recon' };
    const input = { ...checklist(), categories: [category] };
    input.items[0].text = '/recon literal text';
    await service.post(alice, 'checklist', input);
    expect((await q('SELECT items,categories FROM workspace_checklists WHERE id=?', [input.id]))[0]).toEqual({ items: input.items, categories: [category] });
    await expect(service.post(alice, 'checklist', { ...input, version: 1, categories: undefined })).rejects.toMatchObject({ status: 409 });
    await expect(service.post(alice, 'checklist', { ...input, version: 1, items: [{ ...input.items[0], categoryId: randomUUID() }] })).rejects.toThrow();
    await expect(service.post(alice, 'checklist', { ...input, version: 1, categories: [category, category] })).rejects.toThrow();
    await service.post(alice, 'checklist-delete', { id: input.id, version: 1 });
  });

  it('moves across lists atomically with stale version and identity protection', async () => {
    const category = { id: randomUUID(), name: 'Destination' };
    const source = { ...checklist(), categories: [], items: [
      { id: randomUUID(), text: '/recon keep literal', done: false },
      { id: randomUUID(), text: 'Hidden archived', done: true, archived: true },
    ] };
    const target = { ...checklist(), categories: [category], items: [] };
    await service.post(alice, 'checklist', source);
    await service.post(alice, 'checklist', target);
    const move = { id: source.id, version: 1, targetId: target.id, targetVersion: 1, itemIds: source.items.map(item => item.id), categoryId: category.id };
    await expect(service.post(bob, 'checklist-move', { ...move, targetVersion: 0 })).rejects.toMatchObject({ status: 409 });
    await expect(service.post(bob, 'checklist-move', { ...move, categoryId: randomUUID() })).rejects.toMatchObject({ status: 400 });
    await expect(service.post(bob, 'checklist-move', { ...move, itemIds: [randomUUID()] })).rejects.toMatchObject({ status: 400 });
    expect((await q<{ items: unknown }>('SELECT items FROM workspace_checklists WHERE id=?', [source.id]))[0].items).toEqual(source.items);
    await service.post(bob, 'checklist-move', move);
    expect((await q<{ items: unknown }>('SELECT items FROM workspace_checklists WHERE id=?', [source.id]))[0].items).toEqual([]);
    const moved = source.items.map(item => ({ ...item, categoryId: category.id }));
    expect((await q<{ items: unknown }>('SELECT items FROM workspace_checklists WHERE id=?', [target.id]))[0].items).toEqual(moved);
    await expect(service.post(alice, 'checklist', { ...target, version: 2, categories: [], items: moved })).rejects.toThrow();
    await service.post(alice, 'checklist', { ...target, version: 2, categories: [], items: [] });
    expect((await q('SELECT items,categories FROM workspace_checklists WHERE id=?', [target.id]))[0]).toEqual({ items: [], categories: [] });
    await expect(service.post(bob, 'checklist-move', move)).rejects.toMatchObject({ status: 409 });
    await service.post(alice, 'checklist-delete', { id: source.id, version: 2 });
    await service.post(alice, 'checklist-delete', { id: target.id, version: 3 });
  });

  it('deletes entire checklists with access, version and audit checks', async () => {
    const input = checklist();
    await service.post(alice, 'checklist', input);
    await expect(service.post(bob, 'checklist-delete', { id: input.id, version: 0 })).rejects.toMatchObject({ status: 409 });
    expect(await q('SELECT id FROM workspace_checklists WHERE id=?', [input.id])).toHaveLength(1);
    expect(await service.post(bob, 'checklist-delete', { id: input.id, version: 1 })).toEqual({ id: input.id });
    expect(await q('SELECT id FROM workspace_checklists WHERE id=?', [input.id])).toHaveLength(0);
    expect(await q("SELECT target FROM workspace_audit WHERE action='checklist.delete' AND target=?", [input.id])).toEqual([{ target: input.id }]);
    expect(await q('SELECT id FROM workspace_checklists WHERE id=?', [legacyChecklist])).toHaveLength(1);
    await expect(service.post(bob, 'checklist-delete', { id: input.id, version: 1 })).rejects.toMatchObject({ status: 404 });
  });

  it('retains report hours and revision snapshots across older clients', async () => {
    const input = { id: randomUUID(), version: 0, workDate: '2026-10-19', status: 'submitted', visibility: 'company', progress: 'Done', resultUrl: '', help: '', next: '', startHour: 9, endHour: 18 };
    await service.post(alice, 'report', input);
    const { startHour, endHour, ...legacy } = input;
    await service.post(alice, 'report', { ...legacy, version: 1 });
    expect(await service.get(alice, 'detail', new URLSearchParams({ id: input.id }))).toMatchObject({ report: { startHour: 9, endHour: 18 }, revisions: [{ snapshot: { startHour: 9, endHour: 18 } }, { snapshot: { startHour: 9, endHour: 18 } }] });
    await expect(service.post(alice, 'report', { ...input, version: 2, startHour: 18, endHour: 9 })).rejects.toThrow();
    expect(await service.get(alice, 'detail', new URLSearchParams({ id: input.id }))).toHaveProperty('report.version', 2);
  });

  it('restricts schedule edits to managers, persists edits and rejects invalid timelines', async () => {
    const task = { id: randomUUID(), group: 'Product', name: 'Build', owner: '', start: '2026-12-30', end: '2027-01-02', kind: 'task', progress: 50 };
    const input = { id: randomUUID(), name: 'Plan', version: 0, active: true, tasks: [task] };
    await expect(service.post(bob, 'schedule', input)).rejects.toMatchObject({ status: 403 });
    await service.post(alice, 'schedule', input);
    expect(await service.get(bob, 'schedules', new URLSearchParams())).toMatchObject({ schedules: [{ canEdit: false, tasks: [task] }] });
    expect(await service.get(outsider, 'schedules', new URLSearchParams({ id: input.id }))).toMatchObject({ schedules: [{ id: input.id }], selected: { id: input.id } });
    await service.post(admin, 'schedule', { ...input, version: 1, tasks: [{ ...task, progress: 100 }] });
    await expect(service.post(alice, 'schedule', { ...input, version: 1 })).rejects.toMatchObject({ status: 409 });
    for (const tasks of [[{ ...task, end: '2026-02-31' }], [{ ...task, kind: 'milestone' }], [{ ...task, progress: 101 }], [task, task], [{ ...task, end: '2030-01-01' }]]) {
      await expect(service.post(alice, 'schedule', { ...input, version: 2, tasks })).rejects.toThrow();
    }
    expect(await service.get(alice, 'schedules', new URLSearchParams())).toMatchObject({ schedules: [{ version: 2, tasks: [{ progress: 100 }] }] });
  });

  it('restricts schedule deletion to authorized managers with version and audit checks', async () => {
    const input = { id: randomUUID(), name: 'Disposable plan', version: 0, active: true, tasks: [{ id: randomUUID(), group: 'Release', name: 'Ship', owner: '', start: '2026-10-25', end: '2026-10-25', kind: 'milestone', progress: 0 }] };
    await service.post(alice, 'schedule', input);
    await expect(service.post(bob, 'schedule-delete', { id: input.id, version: 1 })).rejects.toMatchObject({ status: 403 });
    await expect(service.post(alice, 'schedule-delete', { id: input.id, version: 0 })).rejects.toMatchObject({ status: 409 });
    expect(await q('SELECT id FROM workspace_schedules WHERE id=?', [input.id])).toHaveLength(1);
    expect(await service.post(alice, 'schedule-delete', { id: input.id, version: 1 })).toEqual({ id: input.id });
    expect(await q('SELECT id FROM workspace_schedules WHERE id=?', [input.id])).toHaveLength(0);
    expect(await q("SELECT target FROM workspace_audit WHERE action='schedule.delete' AND target=?", [input.id])).toEqual([{ target: input.id }]);
    await expect(service.post(alice, 'schedule-delete', { id: input.id, version: 1 })).rejects.toMatchObject({ status: 404 });
    const company = { ...input, id: randomUUID(), active: false };
    await service.post(alice, 'schedule', company);
    await service.post(admin, 'schedule-delete', { id: company.id, version: 1 });
    expect(await q('SELECT id FROM workspace_schedules WHERE id=?', [company.id])).toHaveLength(0);
  });

  it('rejects malformed items and revoked members', async () => {
    const input = checklist();
    await expect(service.post(alice, 'checklist', { ...input, items: [input.items[0], input.items[0]] })).rejects.toThrow();
    await service.post(admin, 'member', { userId: 3, name: 'Bob', role: 'member', active: false });
    await expect(service.get(bob, 'checklists', new URLSearchParams())).rejects.toMatchObject({ status: 403 });
    await expect(service.post(bob, 'checklist-delete', {id:input.id,version:0})).rejects.toMatchObject({ status: 403 });
  });

  it('preserves shared company content after its author account is deleted', async () => {
    const input = checklist();
    await service.post(alice, 'checklist', input);
    await q('DELETE FROM app_users WHERE id=?', [alice.uid]);
    expect(await service.get(outsider, 'checklists', new URLSearchParams())).toMatchObject({ checklists: expect.arrayContaining([expect.objectContaining({ id: input.id })]) });
    await expect(service.get(alice, 'checklists', new URLSearchParams())).rejects.toMatchObject({ status: 401 });
  });

  it('paginates named lists without filtering by obsolete category parameters', async () => {
    const before = await service.get(outsider, 'checklists', new URLSearchParams()) as { checklists: { id: string }[]; hasMore: boolean };
    for (let index = 0; index < 22; index++) await service.post(outsider, 'checklist', { ...checklist(null), name: `List ${index}` });
    const first = await service.get(outsider, 'checklists', new URLSearchParams({ category: 'obsolete' })) as typeof before;
    const second = await service.get(outsider, 'checklists', new URLSearchParams({ page: '2' })) as typeof first;
    expect(first.checklists).toHaveLength(20); expect(first.hasMore).toBe(true);
    expect(second.checklists).toHaveLength(before.checklists.length + 2); expect(second.hasMore).toBe(false);
    expect(new Set([...first.checklists, ...second.checklists].map(row => row.id)).size).toBe(before.checklists.length + 22);
    await expect(service.get(outsider, 'checklists', new URLSearchParams({ page: '-1' }))).rejects.toThrow();
  });
});
