import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';
import type { PayrollMonth } from '@cuberoot/shared/workspace-planning';
import { createWorkspaceService, type Identity } from '../src/workspace/service';
import type { QueryRunner } from '../src/db/connection';

const database = process.env.WORKSPACE_TEST_DATABASE_URL;
const suite = database ? describe : describe.skip;
suite('workspace monthly payroll (PostgreSQL)', () => {
  const sql = postgres(database!, {max: 1});
  const runner = (client: typeof sql): QueryRunner => async <T>(text: string, params: unknown[] = []) => {
    let index = 0;
    return await client.unsafe(text.replace(/\?/g, () => `$${++index}`), params as never[]) as unknown as T[];
  };
  const q = runner(sql);
  const service = createWorkspaceService(q, async run => await sql.begin(tx => run(runner(tx as unknown as typeof sql))) as never);
  const identity = (uid: number, isAdmin = false): Identity => ({uid, isAdmin, name: `User ${uid}`});
  const owner = identity(1, true), alice = identity(2), bob = identity(3), admin = identity(4, true);
  const month = '2025-12';
  const list = (actor: Identity, filter = '', workMonth = month) => service.get(actor, 'payroll',
    new URLSearchParams(filter ? {month: workMonth, userId: filter} : {month: workMonth})) as Promise<PayrollMonth>;
  beforeAll(async () => {
    await q('CREATE SCHEMA payroll_fixture');
    await q('SET search_path TO payroll_fixture');
    await q('CREATE TABLE app_users(id BIGINT PRIMARY KEY,display_name TEXT,is_admin BOOLEAN,forum_banned BOOLEAN DEFAULT FALSE,merged_into_user_id BIGINT,wca_id TEXT)');
    await q("INSERT INTO app_users(id,display_name,is_admin,wca_id) VALUES (1,'Owner',TRUE,?),(2,'Alice',FALSE,NULL),(3,'Bob',FALSE,NULL),(4,'Admin',TRUE,NULL)", [ADMIN_WCA_IDS[0]]);
    for (const file of ['0217_role_preview', '0281_workspace', '0282_workspace_account_deletion', '0284_workspace_admin_access',
      '0340_workspace_member_requests', '0344_workspace_project_tasks', '0345_workspace_payroll']) {
      await sql.unsafe(readFileSync(new URL(`../migrations/${file}.sql`, import.meta.url),'utf8'));
    }
    for (const user of [alice, bob]) {
      await service.post(owner, 'member', {userId: user.uid, name: user.name, role: 'member', active: true});
    }
  });
  afterAll(async () => {
    await q('DROP SCHEMA payroll_fixture CASCADE');
    await sql.end();
  });

  it('isolates rates and attendance while version-checking half-day approval, rate corrections and payment', async () => {
    const userId = alice.uid;
    const rate = {userId, effectiveFrom:'2025-12-01', dailyRateCents:30001};
    const attendance = (actor: Identity, date: string, halfDays: number, version?: number) =>
      service.post(actor, 'payroll-attendance', {userId, date, halfDays, version}) as Promise<{version: number}>;
    const confirm = (entries: {date: string; version: number}[]) =>
      service.post(owner, 'payroll-attendance-approve', {userId, month, entries});
    await expect(service.post(admin, 'payroll-rate', rate)).rejects.toMatchObject({status:403});
    await service.post(owner, 'payroll-rate', rate);
    await expect(attendance(bob, '2025-12-02', 1)).rejects.toMatchObject({status:403});
    await expect(list(admin, String(userId))).rejects.toMatchObject({status:403});
    expect((await list(bob)).rows.map(row => row.userId)).toEqual([bob.uid]);
    const first = await attendance(alice, '2025-12-02', 1);
    expect(await list(alice)).toMatchObject({payDate:'2026-01-15', closed:true, rows:[
      {onsiteCents:0, attendance:[{amountCents:15001, approved:false}]},
    ]});
    const approved = await attendance(owner, '2025-12-02', 1, first.version);
    expect(approved.version).toBeGreaterThan(first.version);
    await expect(attendance(alice, '2025-12-02', 2, approved.version)).rejects.toMatchObject({status:403});
    const date = '2025-12-03';
    const day = await attendance(alice, date, 2);
    await attendance(alice, date, 0, day.version);
    const replacement = await attendance(alice, date, 2);
    expect(replacement.version).toBeGreaterThan(day.version);
    await expect(attendance(owner, date, 1, day.version)).rejects.toMatchObject({status:409});
    const second = await attendance(alice, '2025-12-04', 1);
    await expect(service.post(owner, 'payroll-paid', {userId, month, expectedTotalCents:15001})).rejects.toMatchObject({status:409});
    await service.post(owner, 'payroll-rate', {...rate, dailyRateCents:40000});
    await expect(confirm([{date, version:replacement.version}, {date:'2025-12-04', version:second.version}])).rejects.toMatchObject({status:409});
    const {attendance: days} = (await list(alice)).rows[0];
    expect(days.map(({amountCents}) => amountCents)).toEqual([15001, 40000, 20000]);
    await confirm(days.filter(row => !row.approved).map(({date, version}) => ({date, version})));
    const {totalCents} = (await list(alice)).rows[0];
    expect(totalCents).toBe(75001);
    await expect(service.post(owner, 'payroll-paid', {userId, month, expectedTotalCents:totalCents - 1})).rejects.toMatchObject({status:409});
    const receipt = await service.post(owner, 'payroll-paid', {userId, month, expectedTotalCents:totalCents});
    expect(receipt).toMatchObject({paidAt:expect.any(String)});
    expect(await service.post(owner, 'payroll-paid', {userId, month, expectedTotalCents:totalCents})).toEqual(receipt);
    await expect(attendance(owner, '2025-12-05', 1)).rejects.toMatchObject({status:409});
    await service.post(owner, 'member', {userId, name:alice.name, role:'member', active:false});
    expect((await list(owner, String(userId))).rows[0]).toMatchObject({totalCents, ...receipt as object});
    await expect(list(alice)).rejects.toMatchObject({status:403});
    await q('DELETE FROM app_users WHERE id=?', [userId]);
    expect((await list(owner, String(userId))).rows).toEqual([]);
    for (const table of ['workspace_payroll_rates','workspace_payroll_attendance','workspace_payroll_payments']) {
      expect(await q(`SELECT 1 FROM ${table} WHERE user_id=?`, [userId])).toEqual([]);
    }
  });

  it('automatically groups project fees and confirmed bonuses by business acceptance month', async () => {
    const yearEnd = randomUUID(), nextYear = randomUUID(), incomplete = randomUUID();
    for (const [id, accepted] of [[yearEnd,'2025-12-31T15:59:00Z'], [nextYear,'2025-12-31T16:00:00Z'], [incomplete,null]] as const) {
      await q(`INSERT INTO workspace_project_tasks(id,user_id,title,due_date,criteria,amount_cents,bonus_cents,status,accepted_at)
        VALUES (?,?,'Project','2025-12-01','Confirm delivery',100000,15000,?,?)`, [id, bob.uid, accepted ? 'accepted' : 'submitted', accepted]);
    }
    const december = await list(bob);
    expect(december.rows).toMatchObject([{projects:[{id:yearEnd, acceptedDate:'2025-12-31'}],
      projectCents:100000, bonusCents:15000, totalCents:115000}]);
    const january = await list(bob, '', '2026-01');
    expect(january.rows).toMatchObject([{projects:[{id:nextYear, acceptedDate:'2026-01-01'}], totalCents:115000}]);
    expect(january.payDate).toBe('2026-02-15');
    expect((await list(admin)).rows).toMatchObject([{projects:[], totalCents:0}]);
  });
});
