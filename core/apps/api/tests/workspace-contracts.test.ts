import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
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
    for (const file of ['0281_workspace','0282_workspace_account_deletion','0284_workspace_admin_access','0339_workspace_contracts', '0340_workspace_member_requests']) await sql.unsafe(readFileSync(new URL('../migrations/'+file+'.sql',import.meta.url),'utf8'));
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
});
