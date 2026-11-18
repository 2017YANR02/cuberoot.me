import { readFileSync } from 'node:fs';
import { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createWorkspaceService, type Identity } from '../src/workspace/service';
import type { QueryRunner } from '../src/db/connection';

// Explicit, disposable PostgreSQL only; never fall back to application DB settings.
const database = process.env.WORKSPACE_TEST_DATABASE_URL;
const suite = database ? describe : describe.skip;
suite('independent CubeRoot workspace',()=>{
  const sql=postgres(database!,{max:1});
  const runner=(client:typeof sql):QueryRunner=>async<T>(text:string,params:unknown[]=[])=>{
    let n=0; return await client.unsafe(text.replace(/\?/g,()=>`$${++n}`),params as never[]) as unknown as T[];
  };
  const q=runner(sql);
  const service=createWorkspaceService(q, async run=>await sql.begin(tx=>run(runner(tx as unknown as typeof sql))) as never);
  const admin:Identity={uid:1,isAdmin:true,name:'Owner'};
  const alice:Identity={uid:2,isAdmin:false,name:'Alice'};
  const bob:Identity={uid:3,isAdmin:false,name:'Bob'};
  const unassigned:Identity={uid:4,isAdmin:false,name:'Unassigned'};
  let aliceId:number,bobId:number; let report:string;
  const input=(id:string,status='draft')=>({id,version:0,workDate:'2026-10-19',status,visibility:'company',progress:'Delivered',resultUrl:'https://example.com/result',help:'',next:''});
  beforeAll(async()=>{
    await q('CREATE SCHEMA workspace_fixture');await q('SET search_path TO workspace_fixture');
    await q('CREATE TABLE app_users(id BIGINT PRIMARY KEY,display_name TEXT,is_admin BOOLEAN,forum_banned BOOLEAN DEFAULT FALSE,merged_into_user_id BIGINT,wca_id TEXT)');
    await q("INSERT INTO app_users(id,display_name,is_admin) VALUES (1,'Owner',TRUE),(2,'Alice',FALSE),(3,'Bob',FALSE),(4,'Unassigned',FALSE)");
    await sql.unsafe(readFileSync(new URL('../migrations/0281_workspace.sql',import.meta.url),'utf8'));
    await sql.unsafe(readFileSync(new URL('../migrations/0282_workspace_account_deletion.sql',import.meta.url),'utf8'));
    await sql.unsafe(readFileSync(new URL('../migrations/0284_workspace_admin_access.sql',import.meta.url),'utf8'));
    for (const file of ['0291_workspace_checklists','0292_workspace_schedules','0293_workspace_remove_checklist_categories','0332_workspace_remove_projects','0337_workspace_checklist_sections','0338_workspace_announcement', '0340_workspace_member_requests']) await sql.unsafe(readFileSync(new URL('../migrations/'+file+'.sql',import.meta.url),'utf8'));
    // A separate application's account record is not in CubeRoot app_users.
    await q('CREATE SCHEMA other_application');await q('CREATE TABLE other_application.employees(id INT PRIMARY KEY,name TEXT)');await q("INSERT INTO other_application.employees VALUES (99,'External employee')");
    aliceId=(await service.post(admin,'member',{userId:2,name:'Alice',role:'member',active:true})).id as number;
    bobId=(await service.post(admin,'member',{userId:3,name:'Bob',role:'member',active:true})).id as number;
  });
  afterAll(async()=>{await q('DROP SCHEMA workspace_fixture CASCADE');await q('DROP SCHEMA other_application CASCADE');await sql.end();});
  it('lets signed-in applicants request access and only administrators review it', async () => {
    const applicant: Identity = {uid: 88002, isAdmin: false, name: 'Untrusted token name'};
    const reviewer: Identity = {uid: 88003, isAdmin: true, name: 'Reviewer'};
    await q("INSERT INTO app_users(id,display_name,is_admin) VALUES (88002,'New colleague',FALSE),(88003,'Reviewer',TRUE)");
    const get = (identity: Identity, action: string) => service.get(identity, action, new URLSearchParams());
    const pending = async () => (await get(reviewer, 'member-requests') as {requests: {id: string; userId: string; name: string}[]}).requests;
    expect(await get(applicant, 'member-request')).toEqual({status:'none'});
    await expect(get({...applicant, uid:99}, 'member-request')).rejects.toMatchObject({status:401});
    await expect(get(applicant, 'session')).rejects.toMatchObject({status:403});
    expect(await service.post(applicant, 'member-request', {userId: unassigned.uid, role:'manager'})).toEqual({status:'pending'});
    expect(await get(unassigned, 'member-request')).toEqual({status:'none'});
    const [request] = await pending();
    expect(request).toMatchObject({userId:String(applicant.uid), name:'New colleague'});
    await service.post(applicant, 'member-request', {});
    expect(await pending()).toEqual([request]);
    await expect(get(applicant, 'session')).rejects.toMatchObject({status:403});
    await expect(get(alice, 'member-requests')).rejects.toMatchObject({status:403});
    await expect(service.post(alice, 'member-request-decision', {id:request.id, decision:'approved'})).rejects.toMatchObject({status:403});
    await service.post(reviewer, 'member-request-decision', {id:request.id, decision:'rejected'});
    expect(await get(applicant, 'member-request')).toEqual({status:'rejected'});
    await service.post(applicant, 'member-request', {});
    const [retry] = await pending();
    expect(retry.id).not.toBe(request.id);
    await expect(service.post(reviewer, 'member-request-decision', {id:request.id, decision:'approved'})).rejects.toMatchObject({status:409});
    await service.post(reviewer, 'member-request-decision', {id:retry.id, decision:'approved', role:'manager'});
    expect(await get(applicant, 'session')).toMatchObject({actor:{kind:'staff', role:'member', name:'New colleague'}});
    expect(await get(applicant, 'member-request')).toEqual({status:'enabled'});
    expect(await pending()).toEqual([]);
    expect(await q('SELECT action FROM workspace_audit WHERE target=?', [retry.id])).toEqual([{action:'member-request.approved'}]);
    await q('DELETE FROM app_users WHERE id=?', [applicant.uid]);
    expect(await q('SELECT id FROM workspace_member_requests WHERE user_id=?', [applicant.uid])).toEqual([]);
    await q('DELETE FROM app_users WHERE id=?', [reviewer.uid]);
  });
  it('shares announcements between administrators and rejects other readers, stale writes and invalid input', async () => {
    await q("INSERT INTO app_users(id,display_name,is_admin) VALUES (88001,'Second admin',TRUE)");
    const second = { uid: 88001, isAdmin: true, name: 'Second admin' };
    expect(await service.get(admin, 'announcement', new URLSearchParams())).toMatchObject({ lines: [], version: 0, canEdit: true });
    await expect(service.get(alice, 'announcement', new URLSearchParams())).rejects.toMatchObject({ status: 403 });
    await expect(service.post(alice, 'announcement', { lines: ['not allowed'], version: 0 })).rejects.toMatchObject({ status: 403 });
    const first = await service.post(admin, 'announcement', { lines: ['First reminder', 'Second reminder'], version: 0 });
    expect(first).toMatchObject({ lines: ['First reminder', 'Second reminder'], version: 1 });
    expect(await service.get(second, 'announcement', new URLSearchParams())).toMatchObject(first);
    await service.post(second, 'announcement', { lines: ['Updated by another admin'], version: 1 });
    await expect(service.post(admin, 'announcement', { lines: ['Stale draft'], version: 1 })).rejects.toMatchObject({ status: 409 });
    expect(await service.get(admin, 'announcement', new URLSearchParams())).toMatchObject({ lines: ['Updated by another admin'], version: 2 });
    await expect(service.post(admin, 'announcement', { lines: ['x'.repeat(501)], version: 2 })).rejects.toThrow();
    const writes = await Promise.allSettled([service.post(admin, 'announcement', { lines: ['A'], version: 2 }), service.post(second, 'announcement', { lines: ['B'], version: 2 })]);
    expect(writes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(writes.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(await service.post(admin, 'announcement', { lines: [], version: 3 })).toMatchObject({ lines: [], version: 4 });
    expect(await q("SELECT action FROM workspace_audit WHERE action='announcement.save'")).toHaveLength(4);
    await q('DELETE FROM workspace_members WHERE user_id=88001');
    await q('DELETE FROM app_users WHERE id=88001');
  });
  it('keeps existing WCA administrator access without a duplicate employee grant',async()=>{
    await q('UPDATE app_users SET wca_id=?,is_admin=FALSE WHERE id=1',[[...ADMIN_WCA_IDS][0]]);
    expect(await service.get(admin,'session',new URLSearchParams())).toHaveProperty('actor.kind','admin');
    await q('UPDATE app_users SET wca_id=NULL,is_admin=TRUE WHERE id=1');
  });
  it('automatically grants all admins a stable employee identity while retaining management',async()=>{
    await q("INSERT INTO app_users(id,display_name,is_admin,wca_id) VALUES (5,'WCA admin',FALSE,?),(6,'DB admin',TRUE,NULL)",[[...ADMIN_WCA_IDS][0]]);
    const session=await service.get(admin,'session',new URLSearchParams()) as {actor:{kind:string};employee:{id:number}};
    const again=await service.get(admin,'session',new URLSearchParams()) as typeof session;
    expect(again.employee.id).toBe(session.employee.id);
    expect(await q('SELECT user_id::int AS uid FROM workspace_members WHERE admin_access ORDER BY user_id')).toEqual([{uid:1},{uid:5},{uid:6}]);
    const id=randomUUID();await service.post(admin,'report',{...input(id),progress:'Admin work'});
    expect(await service.get(admin,'detail',new URLSearchParams({id}))).toMatchObject({report:{memberId:session.employee.id},revisions:[{version:1}]});
    await expect(service.get({uid:6,isAdmin:true,name:'DB admin'},'detail',new URLSearchParams({id}))).rejects.toMatchObject({status:404});
    await service.post(admin,'report',{...input(id,'submitted'),version:1,progress:'Admin work'});
    expect(await service.get(admin,'reports',new URLSearchParams({mine:'true'}))).toMatchObject({reports:[{id}]});
    await expect(service.post({uid:6,isAdmin:true,name:'DB admin'},'report',{...input(id,'submitted'),version:2})).rejects.toMatchObject({status:403});
    // Derived access disappears with administrator status; explicit grants survive.
    await service.post(admin,'member',{userId:5,name:'Explicit',role:'member',active:true});
    await q('UPDATE app_users SET is_admin=FALSE,wca_id=NULL WHERE id IN (5,6)');
    await expect(service.get({uid:6,isAdmin:true,name:'Former'},'session',new URLSearchParams())).rejects.toMatchObject({status:403});
    expect(await service.get({uid:5,isAdmin:true,name:'Former'},'session',new URLSearchParams())).toHaveProperty('actor.kind','staff');
    await expect(service.post({uid:5,isAdmin:true,name:'Former'},'member',{userId:4,name:'Other',role:'manager',active:true})).rejects.toMatchObject({status:403});
  });
  it('requires CubeRoot identity and an explicit employee grant',async()=>{
    await expect(service.get(unassigned,'session',new URLSearchParams())).rejects.toMatchObject({status:403});
    await expect(service.get({uid:99,isAdmin:true,name:'External'},'session',new URLSearchParams())).rejects.toMatchObject({status:401});
    await expect(service.post(alice,'member',{userId:4,name:'Other',role:'manager',active:true})).rejects.toMatchObject({status:403});
    expect(await q('SELECT * FROM other_application.employees')).toEqual([{id:99,name:'External employee'}]);
  });
  it('resolves existing admin reports, directories and both comment identities from the current account',async()=>{
    const user:Identity={uid:7,isAdmin:true,name:'尾号5007'};
    await q("INSERT INTO app_users(id,display_name,is_admin) VALUES (7,'尾号5007',TRUE)");
    const session=await service.get(user,'session',new URLSearchParams()) as {employee:{id:number}};
    const id=randomUUID();
    await service.post(user,'report',{...input(id,'submitted'),progress:'Admin identity regression'});
    const adminComment=randomUUID(),staffComment=randomUUID();
    await service.post(user,'comment',{id:adminComment,reportId:id,body:'Admin comment'});
    await service.post({...user,isAdmin:false},'comment',{id:staffComment,reportId:id,body:'Staff comment'});
    for(const currentName of ['Lang Yuan (袁朗)','Updated account name']) {
      await q('UPDATE app_users SET display_name=? WHERE id=7',[currentName]);
      // The author does not have to log in again; an unrelated reader sees the new name.
      for(const reader of [admin,alice]) {
        expect(await service.get(reader,'session',new URLSearchParams())).toMatchObject({directory:expect.arrayContaining([{id:session.employee.id,name:currentName,active:true}])});
        expect(await service.get(reader,'reports',new URLSearchParams({memberId:String(session.employee.id)}))).toMatchObject({reports:[{id,name:currentName}]});
        expect(await service.get(reader,'detail',new URLSearchParams({id}))).toMatchObject({report:{name:currentName},comments:expect.arrayContaining([{id:adminComment,name:currentName,body:'Admin comment',createdAt:expect.any(Number)},{id:staffComment,name:currentName,body:'Staff comment',createdAt:expect.any(Number)}])});
      }
      expect(await service.get(user,'session',new URLSearchParams())).toMatchObject({actor:{name:currentName},employee:{id:session.employee.id,name:currentName}});
      expect(await service.get(admin,'members',new URLSearchParams())).toMatchObject({members:expect.arrayContaining([expect.objectContaining({userId:7,name:currentName})])});
    }
    // No profile copying or history rewriting is required to repair old records.
    expect(await q('SELECT name FROM workspace_members WHERE user_id=7')).toEqual([{name:'尾号5007'}]);
    expect(await q('SELECT name FROM workspace_comments WHERE report_id=?',[id])).toEqual([{name:'尾号5007'},{name:'尾号5007'}]);
    await q('UPDATE app_users SET display_name=? WHERE id=7',['']);
    expect(await service.get(user,'session',new URLSearchParams())).toMatchObject({actor:{name:'7'},employee:{name:'7'}});
    await q('DELETE FROM app_users WHERE id=7');
    expect(await service.get(admin,'detail',new URLSearchParams({id}))).toMatchObject({report:{name:'—'},comments:[{name:'—'},{name:'—'}]});
  });
  it('retains explicit employee names through account renames and temporary admin access',async()=>{
    const user:Identity={uid:8,isAdmin:false,name:'Account nickname'};
    await q("INSERT INTO app_users(id,display_name,is_admin) VALUES (8,'Account nickname',FALSE)");
    const member=await service.post(admin,'member',{userId:8,name:'Work name',role:'member',active:true});
    const id=randomUUID();await service.post(user,'report',{...input(id,'submitted'),progress:'Employee identity regression'});
    await service.post(user,'comment',{id:randomUUID(),reportId:id,body:'Employee comment'});
    await q("UPDATE app_users SET display_name='New account name' WHERE id=8");
    expect(await service.get(user,'session',new URLSearchParams())).toMatchObject({actor:{name:'Work name'}});
    expect(await service.get(admin,'detail',new URLSearchParams({id}))).toMatchObject({report:{name:'Work name'},comments:[{name:'Work name'}]});
    await q('UPDATE app_users SET is_admin=TRUE WHERE id=8');
    expect(await service.get({...user,isAdmin:true},'session',new URLSearchParams())).toMatchObject({employee:{id:member.id,name:'New account name'}});
    await q('UPDATE app_users SET is_admin=FALSE WHERE id=8');
    expect(await service.get(user,'session',new URLSearchParams())).toMatchObject({actor:{name:'Work name'}});
    expect(await q('SELECT name FROM workspace_members WHERE user_id=8')).toEqual([{name:'Work name'}]);
    await q('DELETE FROM app_users WHERE id=8');
  });
  it('keeps drafts and revision history private, then exposes only submitted records',async()=>{
    report=randomUUID();await service.post(alice,'report',input(report));
    await expect(service.get(bob,'detail',new URLSearchParams({id:report}))).rejects.toMatchObject({status:404});
    await expect(service.get(admin,'detail',new URLSearchParams({id:report}))).rejects.toMatchObject({status:404});
    await service.post(alice,'report',{...input(report,'submitted'),version:1});
    const detail=await service.get(bob,'detail',new URLSearchParams({id:report}));expect(detail).toMatchObject({report:{status:'submitted'},revisions:[]});
    await expect(service.post(bob,'report',{...input(report,'submitted'),version:2})).rejects.toMatchObject({status:403});
    await expect(service.post(alice,'report',{...input(report),version:2})).rejects.toMatchObject({status:409});
    await expect(service.post(alice,'report',{...input(report,'submitted'),version:1})).rejects.toMatchObject({status:409});
  });
  it('allows only the database-verified super administrator to manage other authors, drafts and submitted records',async()=>{
    const root:Identity={uid:9,isAdmin:true,name:'Root'};
    await q('INSERT INTO app_users(id,display_name,is_admin,wca_id) VALUES (9,?,FALSE,?)',['Root',ADMIN_WCA_IDS[0]]);
    expect(await service.get(root,'session',new URLSearchParams())).toMatchObject({actor:{canManageReports:true},employee:{canManageReports:true}});
    expect(await service.get(admin,'session',new URLSearchParams())).toMatchObject({actor:{canManageReports:false}});
    const id=randomUUID();const draft={...input(id),memberId:bobId,workDate:'2026-10-18',progress:'Delegated draft'};
    await expect(service.post(admin,'report',{...draft,canManageReports:true})).rejects.toMatchObject({status:403});
    await expect(service.post({...alice,isAdmin:true},'report',{...draft,canManageReports:true})).rejects.toMatchObject({status:403});
    await service.post(root,'report',draft);
    expect(await service.get(root,'reports',new URLSearchParams({memberId:String(bobId)}))).toMatchObject({reports:expect.arrayContaining([expect.objectContaining({id,status:'draft',canEdit:true,canDelete:true})])});
    await expect(service.get(admin,'detail',new URLSearchParams({id}))).rejects.toMatchObject({status:404});
    await expect(service.post(admin,'report-delete',{id,version:1})).rejects.toMatchObject({status:404});
    expect(await service.get(bob,'detail',new URLSearchParams({id}))).toMatchObject({report:{memberId:bobId,canEdit:true},revisions:[{version:1}]});
    expect(await q("SELECT actor FROM workspace_audit WHERE target=? AND action='report.save'",[id])).toEqual([{actor:'admin:9'}]);
    await service.post(root,'report',{...draft,status:'submitted',version:1});
    await service.post(bob,'comment',{id:randomUUID(),reportId:id,body:'My report'});
    expect(await service.get(admin,'detail',new URLSearchParams({id}))).toMatchObject({report:{canEdit:false,canDelete:false},revisions:[]});
    await expect(service.post(admin,'report',{...draft,status:'submitted',version:2})).rejects.toMatchObject({status:403});
    await expect(service.post(admin,'report-delete',{id,version:2})).rejects.toMatchObject({status:403});
    await expect(service.post(root,'report',{...draft,memberId:aliceId,status:'submitted',version:2})).rejects.toMatchObject({status:409});
    const revised={...draft,workDate:'2026-10-17',status:'submitted',visibility:'managers',version:2,progress:'Root correction'};
    await service.post(root,'report',revised);
    expect(await service.get(root,'detail',new URLSearchParams({id}))).toMatchObject({report:{memberId:bobId,name:'Bob',workDate:'2026-10-17',version:3,canEdit:true,canDelete:true},revisions:[{version:3},{version:2},{version:1}]});
    expect(await service.get(bob,'detail',new URLSearchParams({id}))).toMatchObject({report:{canEdit:true,canDelete:true}});
    await expect(service.post(root,'report',revised)).rejects.toMatchObject({status:409});
    await expect(service.post(root,'report-delete',{id,version:2})).rejects.toMatchObject({status:409});
    // Revocation takes effect without trusting the caller's stale admin flag.
    await q('UPDATE app_users SET wca_id=NULL,is_admin=TRUE WHERE id=9');
    await expect(service.post(root,'report-delete',{id,version:3})).rejects.toMatchObject({status:403});
    await q('UPDATE app_users SET wca_id=? WHERE id=9',[ADMIN_WCA_IDS[0]]);
    await service.post(root,'report-delete',{id,version:3});
    for(const table of ['workspace_reports','workspace_comments','workspace_revisions'])expect(await q(`SELECT * FROM ${table} WHERE ${table==='workspace_reports'?'id':'report_id'}=?`,[id])).toEqual([]);
    expect(await q("SELECT actor,action FROM workspace_audit WHERE target=? AND action='report.delete'",[id])).toEqual([{actor:'admin:9',action:'report.delete'}]);
    await expect(service.post(root,'report',revised)).rejects.toMatchObject({status:409});
    await expect(service.get(root,'detail',new URLSearchParams({id}))).rejects.toMatchObject({status:404});
    await q('DELETE FROM app_users WHERE id=9');
  });
  it('allows authors to edit and delete their own submitted records with version checks',async()=>{
    const id=randomUUID();const draft={...input(id,'submitted'),workDate:'2026-10-16',progress:'Author work'};
    await service.post(alice,'report',draft);
    expect(await service.get(alice,'reports',new URLSearchParams({memberId:String(aliceId)}))).toMatchObject({reports:expect.arrayContaining([expect.objectContaining({id,canEdit:true,canDelete:true})])});
    await service.post(alice,'report',{...draft,version:1,progress:'Author correction'});
    await expect(service.post(bob,'report-delete',{id,version:2})).rejects.toMatchObject({status:403});
    await expect(service.post(alice,'report-delete',{id,version:1})).rejects.toMatchObject({status:409});
    await service.post(alice,'report-delete',{id,version:2});
    await expect(service.get(alice,'detail',new URLSearchParams({id}))).rejects.toMatchObject({status:404});
  });
  it('makes comment retries idempotent and rejects collisions',async()=>{
    const c={id:randomUUID(),reportId:report,body:'Reviewed'};await service.post(bob,'comment',c);await service.post(bob,'comment',c);
    await expect(service.post(alice,'comment',c)).rejects.toMatchObject({status:409});
    const detail=await service.get(alice,'detail',new URLSearchParams({id:report}));expect(detail).toHaveProperty('comments.length',1);
  });
  it('checks current employee access before searches and rejects removed project endpoints',async()=>{
    await expect(service.get(admin,'projects',new URLSearchParams())).rejects.toMatchObject({status:404});
    await expect(service.post(admin,'project',{})).rejects.toMatchObject({status:404});
    expect(await service.get(bob,'reports',new URLSearchParams({search:'Delivered'}))).toMatchObject({reports:expect.arrayContaining([expect.objectContaining({id:report})])});
    await service.post(admin,'member',{userId:2,name:'Alice',role:'member',active:false});
    await expect(service.get(alice,'session',new URLSearchParams())).rejects.toMatchObject({status:403});
  });
  it('deletes private drafts and credentials while retaining anonymous submitted team history',async()=>{
    await service.post(admin,'member',{userId:2,name:'Alice',role:'member',active:true});
    const draft=randomUUID();await service.post(alice,'report',{...input(draft),});
    await q('DELETE FROM app_users WHERE id=2');
    expect(await q('SELECT id FROM workspace_reports WHERE id=?',[draft])).toEqual([]);
    expect(await q('SELECT report_id FROM workspace_revisions WHERE report_id=?',[report])).toEqual([]);
    expect(await q('SELECT user_id,name,active FROM workspace_members WHERE id=?',[aliceId])).toEqual([{user_id:null,name:'—',active:false}]);
    expect(await service.get(admin,'detail',new URLSearchParams({id:report}))).toHaveProperty('report.name','—');
    await expect(service.get(alice,'session',new URLSearchParams())).rejects.toMatchObject({status:401});
    expect(await q('SELECT * FROM other_application.employees')).toEqual([{id:99,name:'External employee'}]);
  });

});
