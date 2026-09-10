import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PlatformApiError } from '../src/platform/errors.js';
import { competitionInteger } from '../src/platform/competitions.js';
const state=vi.hoisted(()=>({actor:{userId:1,ownerKey:'1',isAdmin:false},db:null as unknown}));
vi.mock('../src/platform/auth.js',()=>({requirePlatformActor:async()=>state.actor,requirePlatformAdmin:async()=>{if(!state.actor.isAdmin)throw new PlatformApiError('FORBIDDEN',403,'Admin required');return state.actor;}}));
vi.mock('../src/platform/db.js',()=>({
  platformDb:()=>state.db,
  platformQuery:async(db:{unsafe:(sql:string,params:unknown[])=>Promise<unknown>},sql:string,params:unknown[]=[])=>db.unsafe(sql,params),
  withIdempotency:async(_c:unknown,_a:unknown,_s:unknown,_b:unknown,run:(db:unknown)=>Promise<unknown>)=>(state.db as ReturnType<typeof postgres>).begin(run),
  sendMutation:(c:{json:(body:unknown,status:number)=>Response},result:{body:unknown;status:number})=>c.json(result.body,result.status),
}));
import { platformOrganizerApplicationRoutes } from '../src/routes/platform_organizer_applications.js';
const app=new Hono().route('/v1',platformOrganizerApplicationRoutes),base='/v1/platform/organizer-applications';
const post=(path:string,body:unknown)=>app.request(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
describe('competition API numeric serialization',()=>{
  it('preserves zero fees and bigint IDs as safe numbers, refusing lossy values',()=>{
    expect(competitionInteger('0')).toBe(0);expect(competitionInteger('1234')).toBe(1234);expect(competitionInteger(16)).toBe(16);
    for(const raw of ['9007199254740993',-1,null,'',1.2,'1e3'])expect(()=>competitionInteger(raw)).toThrow();
  });
});
const databaseUrl=process.env.COMPETITION_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)('organizer approval transaction and authorization on PostgreSQL',()=>{
  const schema=`organizer_test_${randomUUID().replaceAll('-','')}`,existing=randomUUID();
  let admin:ReturnType<typeof postgres>,db:ReturnType<typeof postgres>;
  beforeAll(async()=>{
    if(!['localhost','127.0.0.1'].includes(new URL(databaseUrl!).hostname))throw new Error('Loopback PostgreSQL required');
    admin=postgres(databaseUrl!,{max:1});await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    db=postgres(databaseUrl!,{max:4,connection:{search_path:schema}});state.db=db;
    await db.unsafe(`CREATE TABLE app_users(id BIGINT PRIMARY KEY);
      CREATE TABLE organizations(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),slug TEXT UNIQUE NOT NULL,name TEXT NOT NULL,status TEXT DEFAULT 'active',created_by_user_id BIGINT REFERENCES app_users);
      CREATE TABLE organization_members(organization_id UUID REFERENCES organizations,user_id BIGINT REFERENCES app_users,role TEXT,status TEXT,joined_at TIMESTAMPTZ,PRIMARY KEY(organization_id,user_id));
      INSERT INTO app_users VALUES(1),(2),(3),(99);
      INSERT INTO organizations(id,slug,name) VALUES('${existing}','existing-school','Existing school');
      INSERT INTO organization_members VALUES('${existing}',2,'owner','active',NOW());`);
    await db.unsafe(readFileSync(new URL('../migrations/0229_organizer_applications.sql',import.meta.url),'utf8'));
  },45_000);
  afterAll(async()=>{await db?.end();if(admin){await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}});
  let firstId:string;
  it('does not grandfather teaching organizations and rejects foreign organization applications',async()=>{
    state.actor={userId:1,ownerKey:'1',isAdmin:false};
    expect((await post('',{organizationId:existing,contact:'private contact',description:'Online events'})).status).toBe(403);
    const me=await (await app.request(base+'/me')).json();expect(me.eligibleOrganizationIds).toEqual([]);
  });
  it('serializes duplicate applications and creates no organization before admin approval',async()=>{
    const body={name:'New organizer',slug:'new-organizer',contact:'private contact',description:'Online events'};
    const replies=await Promise.all([post('',body),post('',body)]);
    expect(replies.map(r=>r.status).sort()).toEqual([201,409]);
    firstId=(await replies.find(r=>r.status===201)!.json()).application.id;
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM organizations`))[0].n).toBe(1);
    expect((await app.request(base+'/review-queue')).status).toBe(403);
    expect((await post(`/${firstId}/review`,{decision:'approve'})).status).toBe(403);
    state.actor={userId:3,ownerKey:'3',isAdmin:false};expect((await (await app.request(base+'/me')).json()).applications).toEqual([]);
  });
  it('serializes concurrent approvals into exactly one organization and owner',async()=>{
    state.actor={userId:99,ownerKey:'99',isAdmin:true};
    const replies=await Promise.all([post(`/${firstId}/review`,{decision:'approve'}),post(`/${firstId}/review`,{decision:'approve'})]);
    expect(replies.map(r=>r.status).sort()).toEqual([200,409]);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM organizations WHERE slug='new-organizer' AND competition_organizer_approved_at IS NOT NULL`))[0].n).toBe(1);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM organization_members WHERE user_id=1 AND role='owner' AND status='active'`))[0].n).toBe(1);
    state.actor={userId:1,ownerKey:'1',isAdmin:false};expect((await (await app.request(base+'/me')).json()).eligibleOrganizationIds).toHaveLength(1);
  });
  it('reuses an existing organization and checks membership again on approval',async()=>{
    state.actor={userId:2,ownerKey:'2',isAdmin:false};
    const reply=await post('',{organizationId:existing,contact:'School contact',description:'Supervised online events'});expect(reply.status).toBe(201);
    const id=(await reply.json()).application.id;
    await db.unsafe(`UPDATE organization_members SET status='suspended' WHERE user_id=2`);
    state.actor={userId:99,ownerKey:'99',isAdmin:true};expect((await post(`/${id}/review`,{decision:'approve'})).status).toBe(409);
    await db.unsafe(`UPDATE organization_members SET status='active' WHERE user_id=2`);
    const approved=await post(`/${id}/review`,{decision:'approve'});expect(approved.status).toBe(200);expect((await approved.json()).application.organizationId).toBe(existing);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM organizations`))[0].n).toBe(2);
  });
  it('requires a rejection reason and permits a new application after rejection',async()=>{
    state.actor={userId:3,ownerKey:'3',isAdmin:false};const body={name:'Third',slug:'third',contact:'Contact',description:'Events'};
    const id=(await (await post('',body)).json()).application.id;
    state.actor={userId:99,ownerKey:'99',isAdmin:true};expect((await post(`/${id}/review`,{decision:'reject'})).status).toBe(400);
    expect((await post(`/${id}/review`,{decision:'reject',note:'Please clarify supervision staffing'})).status).toBe(200);
    state.actor={userId:3,ownerKey:'3',isAdmin:false};expect((await post('',body)).status).toBe(201);
  });
});
