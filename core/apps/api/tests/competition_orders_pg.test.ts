import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const state=vi.hoisted(()=>({db:null as unknown}));
// Preserve the actual SQL driver, transaction, idempotency and fulfillment code.
vi.mock('../src/db/connection.js',()=>({get sql(){return state.db;}}));
vi.mock('../src/platform/auth.js',()=>({
  requirePlatformActor:async(c:{req:{header:(name:string)=>string|undefined}})=>({userId:Number(c.req.header('Test-User')??3),ownerKey:`user:${c.req.header('Test-User')??3}`,displayName:'Test entrant',isAdmin:false,viaApiKey:false,wcaId:null}),
  requirePlatformAdmin:async()=>{throw new Error('No admin in order fixture');},
}));
import { platformCommerceRoutes } from '../src/routes/platform_commerce.js';
import { platformCompetitionRoutes } from '../src/routes/platform_competitions.js';
const app=new Hono().route('/v1/platform',platformCommerceRoutes).route('/v1',platformCompetitionRoutes);
const databaseUrl=process.env.COMPETITION_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('real competition order HTTP and PostgreSQL transaction',()=>{
  const schema=`competition_order_${randomUUID().replaceAll('-','')}`;
  const org=randomUUID(),event=randomUUID(),ticket=randomUUID(),session=randomUUID();
  let admin:ReturnType<typeof postgres>,db:ReturnType<typeof postgres>;
  const migration=(name:string)=>readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8');
  beforeAll(async()=>{
    if(!['localhost','127.0.0.1'].includes(new URL(databaseUrl!).hostname))throw new Error('Loopback PostgreSQL required');
    admin=postgres(databaseUrl!,{max:1,onnotice:()=>{}});await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    db=postgres(databaseUrl!,{max:4,connection:{search_path:schema}});state.db=db;
    await db.unsafe(`CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;
      CREATE TABLE app_users(id BIGINT PRIMARY KEY);
      CREATE TABLE teacher_directory_entries(id BIGINT PRIMARY KEY);`);
    await db.unsafe(migration('0142_teaching_foundation.sql').split('CREATE TABLE student_profiles')[0]);
    await db.unsafe(migration('0167_platform_core.sql'));
    await db.unsafe(migration('0224_online_competitions.sql'));
    await db.unsafe(`INSERT INTO app_users VALUES(1),(2),(3),(4);
      INSERT INTO organizations(id,slug,name,created_by_user_id) VALUES('${org}','order-test','Order test',1);
      INSERT INTO organization_members(organization_id,user_id,role,joined_at) VALUES('${org}',1,'owner',NOW()),('${org}',2,'teacher',NOW());
      INSERT INTO platform_events(id,slug,title_zh,title_en,status,starts_at,ends_at,timezone,published_at) VALUES('${event}','order-test','订单测试','Order test','published',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '3 hours','Asia/Shanghai',NOW());
      INSERT INTO platform_competitions(event_id,organization_id,registration_opens_at,registration_closes_at,commission_bps,settlement_days,settlement_anchor) VALUES('${event}','${org}',NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 minutes',0,0,'finalized');
      INSERT INTO platform_event_ticket_types(id,event_id,code,title_zh,title_en,amount_minor,currency,capacity,competition_project,competition_device) VALUES('${ticket}','${event}','333','三阶','3x3',0,'CNY',1,'333','ordinary');
      INSERT INTO platform_competition_sessions(id,event_id,starts_at,ends_at,capacity,supervisor_user_id) VALUES('${session}','${event}',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '2 hours',1,2);`);
  },60_000);
  afterAll(async()=>{await db?.end();if(admin){await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}});
  const request=(user:number,key:string,clientOrderKey:string)=>app.request('/v1/platform/orders',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key,'Test-User':String(user)},body:JSON.stringify({clientOrderKey,items:[{sellableType:'event_ticket',eventTicketTypeId:ticket,quantity:1,competitionSessionId:session,device:'ordinary'}]})});
  it('returns project arrays, registration dates and numeric zero prices in both lists',async()=>{
    for(const path of ['/v1/platform/competitions','/v1/platform/competitions/manage']){
      const response=await app.request(path,{headers:{'Test-User':'1'}});expect(response.status).toBe(200);
      const data=await response.json();expect(data.competitions).toHaveLength(1);
      expect(data.competitions[0]).toMatchObject({id:event,projects:[{id:ticket,project:'333',device:'ordinary',amountMinor:0,currency:'CNY',capacity:1}]});
      expect(Date.parse(data.competitions[0].registrationClosesAt)).toBeGreaterThan(Date.parse(data.competitions[0].registrationOpensAt));
    }
  });
  it('fulfills a free entry with object snapshots and replays exactly once',async()=>{
    const key=randomUUID(),clientKey=randomUUID();
    const response=await request(3,key,clientKey);
    const body=await response.json();expect(response.status,JSON.stringify(body)).toBe(201);expect(body.status).toBe('fulfilled');
    const orderNumber=(await db.unsafe(`SELECT order_number FROM platform_orders WHERE id=$1`,[body.id]))[0].order_number;
    for(const identifier of [body.id,orderNumber]) {
      const detail=await app.request(`/v1/platform/orders/${identifier}`,{headers:{'Test-User':'3'}});
      expect(detail.status).toBe(200);expect(await detail.json()).toMatchObject({id:body.id,status:'fulfilled',items:[{sellableType:'event_ticket'}]});
      expect((await app.request(`/v1/platform/orders/${identifier}`,{headers:{'Test-User':'4'}})).status).toBe(404);
    }
    const replay=await request(3,key,clientKey);expect(replay.status).toBe(201);expect(await replay.json()).toEqual(body);expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    const rows=await db.unsafe(`SELECT o.status,jsonb_typeof(o.pricing_snapshot) pricing_type,jsonb_typeof(i.sellable_snapshot) item_type,jsonb_typeof(i.revenue_share_snapshot) share_type,r.status registration_status FROM platform_orders o JOIN platform_order_items i ON i.order_id=o.id JOIN platform_event_registrations r ON r.order_item_id=i.id WHERE o.id=$1`,[body.id]);
    expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({status:'fulfilled',pricing_type:'object',item_type:'object',share_type:'array',registration_status:'confirmed'});
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_orders`))[0].n).toBe(1);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_fulfillment_ledger WHERE entry_type='grant'`))[0].n).toBe(1);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_outbox_events WHERE jsonb_typeof(payload)<>'object'`))[0].n).toBe(0);
  },30_000);
  it('rejects duplicate project and last-seat oversell through the actual order endpoint',async()=>{
    const duplicate=await request(3,randomUUID(),randomUUID());expect(duplicate.status).toBe(409);
    const full=await request(4,randomUUID(),randomUUID());expect(full.status).toBe(409);
    expect((await db.unsafe(`SELECT COUNT(*)::integer n FROM platform_orders`))[0].n).toBe(1);
  },30_000);
  it('stores only authoritative five-attempt results as JSON arrays and ranks the round',async()=>{
    const registration=(await db.unsafe(`SELECT id,competition_video_generation generation FROM platform_event_registrations WHERE user_id=3`))[0];
    await db.unsafe(`UPDATE platform_events SET starts_at=NOW()-INTERVAL '1 minute' WHERE id=$1`,[event]);
    await db.unsafe(`UPDATE platform_competition_sessions SET starts_at=NOW()-INTERVAL '1 minute' WHERE id=$1`,[session]);
    await db.unsafe(`UPDATE platform_event_registrations SET checked_in_at=NOW() WHERE id=$1`,[registration.id]);
    const finish=(user:number)=>app.request(`/v1/platform/competitions/registrations/${registration.id}/result`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID(),'Test-User':String(user)},body:'{}'});
    expect((await finish(3)).status).toBe(403);
    expect((await finish(2)).status).toBe(400);
    await db.unsafe(`INSERT INTO platform_competition_attempts(registration_id,attempt_number,scramble,centiseconds,penalty,recorded_by,recorded_at) SELECT $1,n,'R U',900+n*100,'none',2,NOW() FROM generate_series(1,5) AS n`,[registration.id]);
    expect((await finish(2)).status).toBe(200);
    const recorded=(await db.unsafe(`SELECT status,competition_video_generation generation,jsonb_typeof(competition_attempts) json_type FROM platform_event_registrations WHERE id=$1`,[registration.id]))[0];
    expect(recorded.status).toBe('attended');expect(recorded.json_type).toBe('array');expect(recorded.generation).not.toBe(registration.generation);
    const results=await (await app.request(`/v1/platform/competitions/${event}/results`)).json();
    expect(results.results).toHaveLength(1);expect(results.results[0]).toMatchObject({averageCentiseconds:1200,bestCentiseconds:1000,rank:1});
  },30_000);
});
