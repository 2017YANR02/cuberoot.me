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
