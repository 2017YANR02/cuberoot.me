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
    await q("INSERT INTO app_users(id,display_name,is_admin,wca_id) VALUES (1,'Owner',TRUE,?),(2,'Alice',FALSE,NULL),(3,'Bob',FALSE,NULL),(4,'Ordinary admin',TRUE,NULL),(5,'Manager',FALSE,NULL)", [ADMIN_WCA_IDS[0]]);
    for (const file of ['0281_workspace','0282_workspace_account_deletion','0284_workspace_admin_access','0339_workspace_contracts', '0340_workspace_member_requests','0342_workspace_contract_drafts']) await sql.unsafe(readFileSync(new URL('../migrations/'+file+'.sql',import.meta.url),'utf8'));
    for (const user of [alice,bob,manager]) await service.post(owner, 'member', {userId: user.uid, name: user.name, role: user.uid === 5 ? 'manager' : 'member', active: true});
  });
  afterAll(async () => { await q('DROP SCHEMA contracts_fixture CASCADE'); await sql.end(); });
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
    expect(await q('SELECT * FROM workspace_contracts')).toHaveLength(0);
    expect(await q('SELECT * FROM workspace_contract_versions')).toHaveLength(0);
  });
  it('copies only permitted templates and publishes a private, version-checked snapshot once', async () => {
    await q(`CREATE TABLE collaborative_documents (id UUID PRIMARY KEY,title TEXT,owner_key TEXT,kind TEXT,general_access TEXT,ydoc_state BYTEA,updated_at TIMESTAMPTZ DEFAULT NOW())`);
    const source = {type:'doc', content:[{type:'paragraph', content:[{type:'text', text:'Template employee: ______'}]}]};
    const ydoc = TiptapTransformer.toYdoc(source, 'default', [StarterKit]);
    const bytes = Buffer.from(encodeStateAsUpdate(ydoc));
    ydoc.destroy();
    const templateId = randomUUID(), sharedId = randomUUID();
    await q("INSERT INTO collaborative_documents(id,title,owner_key,kind,general_access,ydoc_state) VALUES (?,'Template',?,'document','restricted',?),(?,'Shared',?,'document','anyone',?)", [templateId, ADMIN_WCA_IDS[0], bytes, sharedId, ADMIN_WCA_IDS[0], bytes]);
    const recipient = bob;
    const input = {templateId, userId: recipient.uid, title:'Intern agreement from template'};
    const get = (identity: Identity, action: string, params: Record<string,string> = {}) => service.get(identity, action, new URLSearchParams(params));
    expect(await get(owner, 'contract-drafts')).toMatchObject({templates:[{id:templateId,title:'Template'}]});
    await expect(service.post(owner, 'contract-draft-create', {...input, templateId: sharedId})).rejects.toMatchObject({status:404});
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
    const publish = {id:draft.id, version:2, title:input.title, ...file};
    await expect(service.post(owner, 'contract-draft-publish', {...publish, version:1})).rejects.toMatchObject({status:409});
    await expect(service.post(owner, 'contract-draft-publish', {...publish, base64:'abcd'})).rejects.toMatchObject({status:400});
    expect(await get(owner, 'contract-draft', {id:draft.id})).toMatchObject({version:2});
    await expect(service.post(admin, 'contract-draft-publish', publish)).rejects.toMatchObject({status:403});
    expect(await service.post(owner, 'contract-draft-publish', {...publish, userId:manager.uid})).toEqual({id:draft.id,version:1});
    expect(await service.post(owner, 'contract-draft-publish', publish)).toEqual({id:draft.id,version:1});
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
