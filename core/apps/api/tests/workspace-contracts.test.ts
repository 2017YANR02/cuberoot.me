import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import StarterKit from '@tiptap/starter-kit';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { encodeStateAsUpdate } from 'yjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';
import { createWorkspaceService, type Identity } from '../src/workspace/service';
import type { QueryRunner } from '../src/db/connection';

const database = process.env.WORKSPACE_TEST_DATABASE_URL;
const suite = database ? describe : describe.skip;
suite('private employee contracts (PostgreSQL)', () => {
  const sql = postgres(database!, {max: 1});
  const runner = (client: typeof sql): QueryRunner => async <T>(text: string, params: unknown[] = []) => {
    let n = 0; return await client.unsafe(text.replace(/\?/g, () => `$${++n}`), params as never[]) as unknown as T[];
  };
  const q = runner(sql);
  const service = createWorkspaceService(q, async run => await sql.begin(tx => run(runner(tx as unknown as typeof sql))) as never);
  const identity = (uid: number, isAdmin = false): Identity => ({uid, isAdmin, name: `User ${uid}`});
  const owner = identity(1, true), alice = identity(2), bob = identity(3), admin = identity(4, true), manager = identity(5);
  const id = randomUUID();
  const input = {userId: 2, title: 'Intern agreement', filename: 'agreement.pdf', base64: Buffer.from('%PDF-1.7\nprivate contract').toString('base64'), version: 0};
  beforeAll(async () => {
    await q('CREATE SCHEMA contracts_fixture'); await q('SET search_path TO contracts_fixture');
    await q('CREATE TABLE app_users(id BIGINT PRIMARY KEY,display_name TEXT,is_admin BOOLEAN,forum_banned BOOLEAN DEFAULT FALSE,merged_into_user_id BIGINT,wca_id TEXT)');
    await q("INSERT INTO app_users(id,display_name,is_admin,wca_id) VALUES (1,'Owner',TRUE,?),(2,'Alice',FALSE,NULL),(3,'Bob',FALSE,NULL),(4,'Ordinary admin',TRUE,NULL),(5,'Manager',FALSE,NULL),(6,'Role test: admin',TRUE,NULL)", [ADMIN_WCA_IDS[0]]);
    for (const file of ['0217_role_preview','0281_workspace','0282_workspace_account_deletion','0284_workspace_admin_access','0339_workspace_contracts', '0340_workspace_member_requests','0342_workspace_contract_drafts','0344_workspace_project_tasks','0345_workspace_payroll']) await sql.unsafe(readFileSync(new URL('../migrations/'+file+'.sql',import.meta.url),'utf8'));
    await q("INSERT INTO role_preview_profiles (actor_user_id,role,user_id) VALUES (1,'admin',6)");
    for (const user of [alice,bob,manager]) await service.post(owner, 'member', {userId: user.uid, name: user.name, role: user.uid === 5 ? 'manager' : 'member', active: true});
  });
  afterAll(async () => { await q('DROP SCHEMA contracts_fixture CASCADE'); await sql.end(); });
  it('keeps project amounts private, independent and unchanged after late delivery', async () => {
    const id = randomUUID();
    const moreId = randomUUID();
    const stats = { id, userId: alice.uid, version: 0, title: 'Deliver release', dueDate: '2020-01-02',
      criteria: 'Preview and verify the main flow.', amountCents: 100000, bonusCents: 15000 };
    const list = (who: Identity) => service.get(who, 'project-tasks', new URLSearchParams());
    const save = (who: Identity, body = stats) => service.post(who, 'project-task', body);
    const move = (who: Identity, decision: string, version: number) => service.post(who, 'project-task-status', {id, decision, version});
    await expect(save(admin)).rejects.toMatchObject({status:403});
    await expect(save(owner, {...stats, dueDate:'2020-02-31'})).rejects.toThrow();
    await expect(save(owner, {...stats, amountCents:1000.1})).rejects.toThrow();
    await expect(save(owner, {...stats, userId:6})).rejects.toMatchObject({status:400});
    await save(owner);
    await save(owner, {...stats, id:moreId, title:'More complex project', amountCents:200000, bonusCents:0});
    for (const who of [bob, admin, manager]) {
      expect(await list(who)).toMatchObject({tasks:[], assignees:[], canManage:false});
      await expect(move(who,'agree',1)).rejects.toMatchObject({status:404});
    }
    await expect(move(owner,'agree',1)).rejects.toMatchObject({status:404});
    await expect(move(owner,'accept',1)).rejects.toMatchObject({status:409});
    await move(alice,'agree',1);
    await expect(save(owner, {...stats, version:2, userId:bob.uid})).rejects.toMatchObject({status:409});
    await save(owner, {...stats, version:2, dueDate:'2020-01-15'});
    await expect(move(alice,'submit',2)).rejects.toMatchObject({status:409});
    await expect(move(alice,'submit',3)).rejects.toMatchObject({status:409});
    await move(alice,'agree',3);
    await move(alice,'submit',4);
    await expect(move(alice,'accept',5)).rejects.toMatchObject({status:403});
    await move(owner,'return',5);
    await move(alice,'submit',6);
    await move(owner,'accept',7);
    await expect(move(owner,'accept',7)).rejects.toMatchObject({status:409});
    await expect(save(owner, {...stats, version:8})).rejects.toMatchObject({status:409});
    for (const who of [alice, owner]) expect(await list(who)).toMatchObject({tasks: expect.arrayContaining([
      expect.objectContaining({id, status:'accepted', dueDate:'2020-01-15', amountCents:100000, bonusCents:15000}),
      expect.objectContaining({id:moreId, status:'proposed', amountCents:200000, bonusCents:0}),
    ])});
    expect(await q('SELECT 1 FROM workspace_project_tasks WHERE id=? AND accepted_at IS NOT NULL', [id])).toHaveLength(1);
  });
  it('filters metadata and bytes by account, with no ordinary-admin or manager bypass', async () => {
    const created = await service.post(owner, 'contract-upload', input) as {id: string};
    const actual = new URLSearchParams({id: created.id, version: '1'});
    for (const actor of [bob,admin,manager]) {
      const list = await service.get(actor, 'contracts', new URLSearchParams()) as {contracts: unknown[]; canManage: boolean; members: unknown[]};
      expect(list).toMatchObject({contracts: [], canManage: false, members: []});
      await expect(service.contractFile(actor, actual)).rejects.toMatchObject({status: 404});
      await expect(service.get(actor, 'contract-versions', actual)).rejects.toMatchObject({status: 404});
      await expect(service.post(actor, 'contract-upload', {...input, isSuperAdmin: true})).rejects.toMatchObject({status: 403});
    }
    for (const actor of [owner,alice]) {
      const list = await service.get(actor, 'contracts', new URLSearchParams()) as {contracts: unknown[]};
      expect(list.contracts).toHaveLength(1);
      expect((await service.contractFile(actor, actual)).data.toString()).toBe(Buffer.from(input.base64, 'base64').toString());
    }
    await expect(service.post(alice, 'contract-upload', {...input, userId: alice.uid})).rejects.toMatchObject({status: 403});
  });
  it('preserves original revisions, rejects stale or reassigned revisions, and rolls back invalid writes', async () => {
    await expect(service.post(owner, 'contract-upload', {...input, id, version: 0})).rejects.toMatchObject({status:404});
    const created = await service.post(owner, 'contract-upload', {...input, title: 'Versioned'}) as {id: string};
    const revision = {...input, id: created.id, title: 'Versioned', version: 1, base64: Buffer.from('%PDF-1.7\nrevision two').toString('base64')};
    await service.post(owner, 'contract-upload', revision);
    await expect(service.post(owner, 'contract-upload', revision)).rejects.toMatchObject({status: 409});
    await expect(service.post(owner, 'contract-upload', {...revision, version: 2, userId: 3})).rejects.toMatchObject({status: 400});
    for (const version of [1,2]) {
      const file = await service.contractFile(alice, new URLSearchParams({id:created.id, version:String(version)}));
      expect(file.data.toString()).toBe(Buffer.from(version === 1 ? input.base64 : revision.base64,'base64').toString());
    }
    const before = await q('SELECT id FROM workspace_contracts');
    await expect(service.post(owner, 'contract-upload', {...input, filename:'evil.html'})).rejects.toMatchObject({status:400});
    await expect(service.post(owner, 'contract-upload', {...input, userId:999})).rejects.toMatchObject({status:400});
    expect(await q('SELECT id FROM workspace_contracts')).toHaveLength(before.length);
    const [user] = await q<{wca_id:string}>('SELECT wca_id FROM app_users WHERE id=1');
    await q('UPDATE app_users SET wca_id=NULL WHERE id=1');
    await expect(service.contractFile(owner, new URLSearchParams({id:created.id,version:'1'}))).rejects.toMatchObject({status:404});
    await q('UPDATE app_users SET wca_id=? WHERE id=1',[user.wca_id]);
    await q('DELETE FROM app_users WHERE id=2');
    expect(await q('SELECT 1 FROM workspace_project_tasks WHERE user_id=2')).toHaveLength(0);
    expect(await q('SELECT * FROM workspace_contracts')).toHaveLength(0);
    expect(await q('SELECT * FROM workspace_contract_versions')).toHaveLength(0);
  });
  it('copies only permitted templates and publishes a private, version-checked snapshot once', async () => {
    await q(`CREATE TABLE collaborative_documents (id UUID PRIMARY KEY,title TEXT,owner_key TEXT,kind TEXT,general_access TEXT,ydoc_state BYTEA,updated_at TIMESTAMPTZ DEFAULT NOW())`);
    const source = {type:'doc', content:[{type:'paragraph', content:[{type:'text', text:'Template employee: ______'}]}]};
    const ydoc = TiptapTransformer.toYdoc(source, 'default', [StarterKit]);
    const bytes = Buffer.from(encodeStateAsUpdate(ydoc));
    ydoc.destroy();
    const templateId = randomUUID(), sharedId = randomUUID(), unrelatedId = randomUUID();
    const templateTitle = 'Internship Agreement Template';
    await q(`INSERT INTO collaborative_documents(id,title,owner_key,kind,general_access,ydoc_state)
      VALUES (?,?,?,'document','restricted',?),(?,?,?,'document','anyone',?),(?,'Meeting notes',?,'document','restricted',?)`,
      [templateId, templateTitle, ADMIN_WCA_IDS[0], bytes, sharedId, templateTitle, ADMIN_WCA_IDS[0], bytes, unrelatedId, ADMIN_WCA_IDS[0], bytes]);
    const recipient = bob;
    const input = {templateId, userId: recipient.uid, title:'Intern agreement from template'};
    const get = (identity: Identity, action: string, params: Record<string,string> = {}) => service.get(identity, action, new URLSearchParams(params));
    expect(await get(owner, 'contract-drafts')).toMatchObject({templates:[{id:templateId,title:templateTitle}]});
    const {members} = await get(owner, 'contracts') as {members: {userId: number}[]};
    expect(members.map(member => member.userId)).toContain(recipient.uid);
    expect(members.map(member => member.userId)).not.toContain(6);
    await expect(service.post(owner, 'contract-upload', {userId:6, title:input.title, filename:'test.pdf', version:0,
      base64:Buffer.from('%PDF-1.7\nfixture').toString('base64')})).rejects.toMatchObject({status:400});
    await expect(service.post(owner, 'contract-draft-create', {...input, userId:6})).rejects.toMatchObject({status:400});
    await expect(service.post(owner, 'contract-draft-create', {...input, templateId: sharedId})).rejects.toMatchObject({status:404});
    await expect(service.post(owner, 'contract-draft-create', {...input, templateId: unrelatedId})).rejects.toMatchObject({status:404});
    await expect(service.post(admin, 'contract-draft-create', input)).rejects.toMatchObject({status:403});
    const draft = await service.post(owner, 'contract-draft-create', input) as {id:string; version:number; content:unknown};
    expect(draft.content).toEqual(source);
    await expect(get(recipient, 'contract-draft', {id:draft.id})).rejects.toMatchObject({status:403});
    expect(await get(recipient, 'contracts')).toMatchObject({contracts:[]});
    const edited = {type:'doc', content:[{type:'paragraph', content:[{type:'text', text:'Template employee: Bob'}]}]};
    const saved = await service.post(owner, 'contract-draft-save', {...draft, title:input.title, content:edited});
    expect(saved).toEqual({version:2});
    expect(await get(owner, 'contract-draft', {id:draft.id})).toMatchObject({content:edited});
    expect(await q('SELECT ydoc_state FROM collaborative_documents WHERE id=?', [templateId])).toEqual([{ydoc_state:bytes}]);
    const file = {filename:'agreement.docx', base64:Buffer.from('504b0304','hex').toString('base64')};
    const payroll = {effectiveFrom:'2026-11-01', endsOn:'2027-01-30', dailyRateCents:30000};
    const publish = {id:draft.id, version:2, title:input.title, ...file, payroll};
    await expect(service.post(owner, 'contract-draft-publish', {...publish, version:1})).rejects.toMatchObject({status:409});
    await expect(service.post(owner, 'contract-draft-publish', {...publish, base64:'abcd'})).rejects.toMatchObject({status:400});
    expect(await get(owner, 'contract-draft', {id:draft.id})).toMatchObject({version:2});
    await expect(service.post(admin, 'contract-draft-publish', publish)).rejects.toMatchObject({status:403});
    expect(await service.post(owner, 'contract-draft-publish', {...publish, userId:manager.uid})).toEqual({id:draft.id,version:1});
    expect(await service.post(owner, 'contract-draft-publish', {...publish, payroll:{...payroll, dailyRateCents:90000}})).toEqual({id:draft.id,version:1});
    expect(await q(`SELECT user_id::int AS "userId",effective_from::text AS "effectiveFrom",ends_on::text AS "endsOn",
      daily_rate_cents AS "dailyRateCents" FROM workspace_payroll_rates`)).toEqual([{userId:recipient.uid, ...payroll}]);
    await expect(get(owner, 'contract-draft', {id:draft.id})).rejects.toMatchObject({status:404});
    expect(await get(recipient, 'contracts')).toMatchObject({contracts:[{id:draft.id,userId:recipient.uid,version:1}]});
    const query = new URLSearchParams({id:draft.id,version:'1'});
    expect((await service.contractFile(recipient, query)).data.toString('base64')).toBe(file.base64);
    await expect(service.contractFile(manager, query)).rejects.toMatchObject({status:404});
    const discarded = await service.post(owner, 'contract-draft-create', input) as {id:string; version:number};
    await expect(service.post(recipient, 'contract-draft-delete', discarded)).rejects.toMatchObject({status:403});
    await expect(service.post(owner, 'contract-draft-delete', {...discarded, version:2})).rejects.toMatchObject({status:409});
    await service.post(owner, 'contract-draft-delete', discarded);
    await expect(get(owner, 'contract-draft', {id:discarded.id})).rejects.toMatchObject({status:404});
  });

});
