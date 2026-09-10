import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { competitionOrderContext, competitionResultSummary, requireCompetitionManager, validateCompetitionAttempt, validateCompetitionAttempts } from '../src/platform/competitions.js';
import type { PlatformDb } from '../src/platform/db.js';

describe('competition input rules',()=>{
  it('uses canonical round arithmetic including penalties, rounded Ao5 and two failures',()=>{
    const attempts=[1000,1100,1201,1301,1400].map(centiseconds=>({centiseconds,penalty:'none'}));
    expect(competitionResultSummary(attempts)).toEqual({averageCentiseconds:1201,bestCentiseconds:1000});
    attempts[0]={centiseconds:1000,penalty:'+2'};
    expect(competitionResultSummary(attempts)).toEqual({averageCentiseconds:1234,bestCentiseconds:1100});
    expect(competitionResultSummary([{centiseconds:null,penalty:'DNF'},{centiseconds:null,penalty:'DNS'},...attempts.slice(2)])).toEqual({averageCentiseconds:null,bestCentiseconds:1201});
  });
  it('rejects fabricated units, invalid penalties and incomplete averages',()=>{
    for(const raw of [{centiseconds:0,penalty:'none'},{centiseconds:1.2,penalty:'none'},{centiseconds:123,penalty:'DNF'},{centiseconds:null,penalty:'+2'},{centiseconds:100,penalty:'approved'}]){
      expect(()=>validateCompetitionAttempt(raw)).toThrow();
    }
    expect(validateCompetitionAttempt({centiseconds:1234,penalty:'+2'})).toEqual({centiseconds:1234,penalty:'+2'});
    expect(validateCompetitionAttempt({centiseconds:null,penalty:'DNS'})).toEqual({centiseconds:null,penalty:'DNS'});
    expect(()=>validateCompetitionAttempts([])).toThrow('Exactly five');
  });
});

// Opt-in: isolated schema on developer PG; never connects to production or alters existing tables.
const databaseUrl=process.env.COMPETITION_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)('competition migration and concurrent registration on PostgreSQL',()=>{
  const schema=`competition_test_${randomUUID().replaceAll('-','')}`;
  let admin:ReturnType<typeof postgres>; let db:ReturnType<typeof postgres>;
  const org=randomUUID(),otherOrg=randomUUID(),event=randomUUID(),ticket=randomUUID(),session=randomUUID();
  beforeAll(async()=>{
    const url=new URL(databaseUrl!);
    if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Competition integration tests require loopback PostgreSQL');
    admin=postgres(databaseUrl!,{max:1});
    await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    db=postgres(databaseUrl!,{max:4,connection:{search_path:schema}});
    await db.unsafe(`
      CREATE TABLE app_users(id BIGINT PRIMARY KEY);
      CREATE TABLE organizations(id UUID PRIMARY KEY,status TEXT NOT NULL);
      CREATE TABLE organization_members(organization_id UUID,user_id BIGINT,status TEXT,role TEXT);
      CREATE TABLE platform_events(id UUID PRIMARY KEY,status TEXT,starts_at TIMESTAMPTZ,ends_at TIMESTAMPTZ);
      CREATE TABLE platform_event_ticket_types(id UUID PRIMARY KEY,event_id UUID NOT NULL REFERENCES platform_events(id),amount_minor BIGINT DEFAULT 0,status TEXT DEFAULT 'active');
      CREATE TABLE platform_payment_attempts(id UUID PRIMARY KEY);
      CREATE TABLE platform_event_registrations(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),event_id UUID NOT NULL REFERENCES platform_events(id),user_id BIGINT REFERENCES app_users(id),status TEXT NOT NULL,quantity INTEGER NOT NULL DEFAULT 1);
    `);
    await db.unsafe(readFileSync(new URL('../migrations/0224_online_competitions.sql',import.meta.url),'utf8'));
    await db.unsafe(readFileSync(new URL('../migrations/0227_competition_device_reports.sql',import.meta.url),'utf8'));
    await db.unsafe(`INSERT INTO app_users(id) VALUES(1),(2),(3),(4),(5),(6),(99);
      INSERT INTO organizations VALUES('${org}','active'),('${otherOrg}','active');
      INSERT INTO organization_members VALUES('${org}',1,'active','owner'),('${otherOrg}',2,'active','owner');
      INSERT INTO platform_events VALUES('${event}','published',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '3 hours');
      INSERT INTO platform_competitions(event_id,organization_id,registration_opens_at,registration_closes_at,commission_bps,settlement_days,settlement_anchor) VALUES('${event}','${org}',NOW()-INTERVAL '1 day',NOW()+INTERVAL '30 minutes',0,0,'finalized');
      INSERT INTO platform_event_ticket_types(id,event_id,competition_project,competition_device) VALUES('${ticket}','${event}','333','ordinary');
      INSERT INTO platform_competition_sessions(id,event_id,starts_at,ends_at,capacity,supervisor_user_id) VALUES('${session}','${event}',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '2 hours',1,99);
    `);
  },30_000);
  afterAll(async()=>{
    await db?.end();
    if(admin){await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}
  });
  const context=(userId:number)=>({eventId:event,ticketId:ticket,quantity:1,userId,sessionId:session,device:'ordinary'});
  async function reserve(userId:number){
    return db.begin(async(tx)=>{
      const result=await competitionOrderContext(tx as unknown as PlatformDb,context(userId));
      await tx.unsafe(`INSERT INTO platform_event_registrations(event_id,user_id,status,competition_session_id,competition_project)
        VALUES($1::uuid,$2,'reserved',$3::uuid,$4)`,[event,userId,session,String(result!.project)]);
      return result;
    });
  }
  it('validates migration and serializes the last seat across concurrent users',async()=>{
    const results=await Promise.allSettled([reserve(3),reserve(4)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
    const rows=await db.unsafe(`SELECT COUNT(*)::integer AS n FROM platform_event_registrations WHERE status='reserved'`);
    expect(rows[0].n).toBe(1);
  });
  it('releases capacity for cancel and refund while preserving historical registration',async()=>{
    await db.unsafe(`UPDATE platform_event_registrations SET status='cancelled'`);
    await expect(reserve(5)).resolves.toMatchObject({commissionBps:0,settlementDays:0});
    await db.unsafe(`UPDATE platform_event_registrations SET status='refunded' WHERE user_id=5`);
    await expect(reserve(6)).resolves.toMatchObject({project:'333'});
    expect((await db.unsafe(`SELECT COUNT(*)::integer AS n FROM platform_event_registrations`))[0].n).toBe(3);
  });
  it('blocks duplicate project, multi-quantity, wrong device and supervisor self-entry',async()=>{
    await expect(reserve(6)).rejects.toThrow('already have');
    for(const change of [{quantity:2},{device:'smart'},{sessionId:undefined},{userId:99}]){
      await expect(db.begin(tx=>competitionOrderContext(tx as unknown as PlatformDb,{...context(1),...change}))).rejects.toThrow();
    }
  });
  it('database uniqueness protects same user/project across sessions',async()=>{
    await expect(db.unsafe(`INSERT INTO platform_event_registrations(event_id,user_id,status,competition_session_id,competition_project)
      VALUES($1::uuid,6,'confirmed',$2::uuid,'333')`,[event,session])).rejects.toMatchObject({code:'23505'});
  });
  it('denies cross-organization and inactive manager access',async()=>{
    const actor={userId:2,ownerKey:'test',wcaId:null,displayName:'test',isAdmin:false,viaApiKey:false};
    await expect(requireCompetitionManager(db as unknown as PlatformDb,actor,event)).rejects.toThrow('organizer access');
    await expect(requireCompetitionManager(db as unknown as PlatformDb,{...actor,userId:1},event)).resolves.toMatchObject({organization_id:org});
    await db.unsafe(`UPDATE organization_members SET status='suspended' WHERE user_id=1`);
    await expect(requireCompetitionManager(db as unknown as PlatformDb,{...actor,userId:1},event)).rejects.toThrow('organizer access');
  });
  it('binds exactly one device run to a real issued attempt under concurrent starts',async()=>{
    const registration=randomUUID();
    await db.unsafe(`INSERT INTO platform_event_registrations(id,event_id,user_id,status,competition_session_id,competition_project) VALUES($1,$2,5,'cancelled',$3,'333')`,[registration,event,session]);
    await expect(db.unsafe(`INSERT INTO platform_competition_device_reports(registration_id,attempt_number,reported_by) VALUES($1,1,5)`,[registration])).rejects.toMatchObject({code:'23503'});
    await db.unsafe(`INSERT INTO platform_competition_attempts(registration_id,attempt_number,scramble) VALUES($1,1,'R U')`,[registration]);
    const runs=await Promise.all([1,2].map(()=>db.unsafe(`INSERT INTO platform_competition_device_reports(registration_id,attempt_number,reported_by) VALUES($1,1,5) ON CONFLICT DO NOTHING RETURNING run_id`,[registration])));
    expect(runs.flat()).toHaveLength(1);
    const updates=await Promise.all([1,2].map(()=>db.unsafe(`UPDATE platform_competition_device_reports SET report='{"durationMs":1000}'::jsonb,reported_at=NOW() WHERE registration_id=$1 AND report IS NULL RETURNING run_id`,[registration])));
    expect(updates.flat()).toHaveLength(1);
  });
});
