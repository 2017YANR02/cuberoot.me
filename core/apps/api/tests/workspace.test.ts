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
  let aliceId:number,bobId:number; const project=randomUUID();let report:string;
  const input=(id:string,status='draft')=>({id,projectId:project,version:0,workDate:'2026-10-19',status,visibility:'company',progress:'Delivered',resultUrl:'https://example.com/result',help:'',next:''});
  beforeAll(async()=>{
    await q('CREATE SCHEMA workspace_fixture');await q('SET search_path TO workspace_fixture');
    await q('CREATE TABLE app_users(id BIGINT PRIMARY KEY,display_name TEXT,is_admin BOOLEAN,forum_banned BOOLEAN DEFAULT FALSE,merged_into_user_id BIGINT,wca_id TEXT)');
    await q("INSERT INTO app_users(id,display_name,is_admin) VALUES (1,'Owner',TRUE),(2,'Alice',FALSE),(3,'Bob',FALSE),(4,'Unassigned',FALSE)");
    await sql.unsafe(readFileSync(new URL('../migrations/0281_workspace.sql',import.meta.url),'utf8'));
    await sql.unsafe(readFileSync(new URL('../migrations/0282_workspace_account_deletion.sql',import.meta.url),'utf8'));
    await sql.unsafe(readFileSync(new URL('../migrations/0284_workspace_admin_access.sql',import.meta.url),'utf8'));
    // A separate application's account record is not in CubeRoot app_users.
    await q('CREATE SCHEMA other_application');await q('CREATE TABLE other_application.employees(id INT PRIMARY KEY,name TEXT)');await q("INSERT INTO other_application.employees VALUES (99,'External employee')");
    aliceId=(await service.post(admin,'member',{userId:2,name:'Alice',role:'member',active:true})).id as number;
    bobId=(await service.post(admin,'member',{userId:3,name:'Bob',role:'member',active:true})).id as number;
    await service.post(admin,'project',{id:project,version:0,name:'CubeRoot',url:'https://cuberoot.me',active:true,memberIds:[aliceId,bobId]});
  });
  afterAll(async()=>{await q('DROP SCHEMA workspace_fixture CASCADE');await q('DROP SCHEMA other_application CASCADE');await sql.end();});
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
    const id=randomUUID();await service.post(admin,'report',{...input(id),projectId:null,progress:'Admin work'});
    expect(await service.get(admin,'detail',new URLSearchParams({id}))).toMatchObject({report:{memberId:session.employee.id},revisions:[{version:1}]});
    await expect(service.get({uid:6,isAdmin:true,name:'DB admin'},'detail',new URLSearchParams({id}))).rejects.toMatchObject({status:404});
    await service.post(admin,'report',{...input(id,'submitted'),projectId:null,version:1,progress:'Admin work'});
    expect(await service.get(admin,'reports',new URLSearchParams({mine:'true'}))).toMatchObject({reports:[{id}]});
    await expect(service.post({uid:6,isAdmin:true,name:'DB admin'},'report',{...input(id,'submitted'),projectId:null,version:2})).rejects.toMatchObject({status:403});
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
    await service.post(user,'report',{...input(id,'submitted'),projectId:null,progress:'Admin identity regression'});
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
    const id=randomUUID();await service.post(user,'report',{...input(id,'submitted'),projectId:null,progress:'Employee identity regression'});
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
  it('allows only the database-verified super administrator to manage other authors, drafts and archived records',async()=>{
    const root:Identity={uid:9,isAdmin:true,name:'Root'};
    await q('INSERT INTO app_users(id,display_name,is_admin,wca_id) VALUES (9,?,FALSE,?)',['Root',ADMIN_WCA_IDS[0]]);
    expect(await service.get(root,'session',new URLSearchParams())).toMatchObject({actor:{canManageReports:true},employee:{canManageReports:true}});
    expect(await service.get(admin,'session',new URLSearchParams())).toMatchObject({actor:{canManageReports:false}});
    const id=randomUUID();const draft={...input(id),memberId:bobId,projectId:null,workDate:'2026-10-18',progress:'Delegated draft'};
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
    const archived=randomUUID();await service.post(root,'project',{id:archived,version:0,name:'Archive',url:'',active:false,memberIds:[bobId]});
    const revised={...draft,projectId:archived,workDate:'2026-10-17',status:'submitted',visibility:'managers',version:2,progress:'Root correction'};
    await service.post(root,'report',revised);
    expect(await service.get(root,'detail',new URLSearchParams({id}))).toMatchObject({report:{memberId:bobId,name:'Bob',projectId:archived,workDate:'2026-10-17',version:3,canEdit:true,canDelete:true},revisions:[{version:3},{version:2},{version:1}]});
    expect(await service.get(bob,'detail',new URLSearchParams({id}))).toMatchObject({report:{canEdit:false,canDelete:false}});
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
    const id=randomUUID();const draft={...input(id,'submitted'),projectId:null,workDate:'2026-10-16',progress:'Author work'};
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
  it('checks membership before search, applies removal and archived write restrictions',async()=>{
    await service.post(admin,'project',{id:project,version:1,name:'CubeRoot',url:'',active:true,memberIds:[aliceId]});
    expect(await service.get(bob,'reports',new URLSearchParams({search:'Delivered'}))).toMatchObject({reports:[]});
    await expect(service.get(bob,'detail',new URLSearchParams({id:report}))).rejects.toMatchObject({status:404});
    await service.post(admin,'project',{id:project,version:2,name:'CubeRoot',url:'',active:false,memberIds:[aliceId]});
    await expect(service.post(alice,'comment',{id:randomUUID(),reportId:report,body:'Late'})).rejects.toMatchObject({status:403});
    expect(await service.get(alice,'detail',new URLSearchParams({id:report}))).toHaveProperty('report.projectActive',false);
    await service.post(admin,'member',{userId:2,name:'Alice',role:'member',active:false});
    await expect(service.get(alice,'session',new URLSearchParams())).rejects.toMatchObject({status:403});
  });
  it('deletes private drafts and credentials while retaining anonymous submitted team history',async()=>{
    await service.post(admin,'member',{userId:2,name:'Alice',role:'member',active:true});
    const draft=randomUUID();await service.post(alice,'report',{...input(draft),projectId:null});
    await q('DELETE FROM app_users WHERE id=2');
    expect(await q('SELECT id FROM workspace_reports WHERE id=?',[draft])).toEqual([]);
    expect(await q('SELECT report_id FROM workspace_revisions WHERE report_id=?',[report])).toEqual([]);
    expect(await q('SELECT member_id FROM workspace_project_members WHERE member_id=?',[aliceId])).toEqual([]);
    expect(await q('SELECT user_id,name,active FROM workspace_members WHERE id=?',[aliceId])).toEqual([{user_id:null,name:'—',active:false}]);
    expect(await service.get(admin,'detail',new URLSearchParams({id:report}))).toHaveProperty('report.name','—');
    await expect(service.get(alice,'session',new URLSearchParams())).rejects.toMatchObject({status:401});
    expect(await q('SELECT * FROM other_application.employees')).toEqual([{id:99,name:'External employee'}]);
  });

});
