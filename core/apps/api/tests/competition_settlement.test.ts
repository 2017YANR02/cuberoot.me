import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { competitionSettlement, reconcileCompetitionSettlement } from '../src/platform/competition_settlement.js';
import type { PlatformDb } from '../src/platform/db.js';

const databaseUrl=process.env.COMPETITION_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)('competition settlement on isolated PostgreSQL',()=>{
  const schema=`settlement_test_${randomUUID().replaceAll('-','')}`;
  const event=randomUUID(),registration=randomUUID(),order=randomUUID(),item=randomUUID();
  let admin:ReturnType<typeof postgres>,db:ReturnType<typeof postgres>;
  const actor={userId:1,ownerKey:'test',wcaId:null,displayName:'test',isAdmin:true,viaApiKey:false};
  beforeAll(async()=>{
    if(!['localhost','127.0.0.1'].includes(new URL(databaseUrl!).hostname))throw Error('Loopback PostgreSQL required');
    admin=postgres(databaseUrl!,{max:1});await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    db=postgres(databaseUrl!,{max:1,connection:{search_path:schema}});
    await db.unsafe(`CREATE TABLE app_users(id BIGINT PRIMARY KEY);
      CREATE TABLE platform_events(id UUID PRIMARY KEY,ends_at TIMESTAMPTZ);
      CREATE TABLE platform_competitions(event_id UUID PRIMARY KEY,commission_bps INTEGER,settlement_days INTEGER,settlement_anchor TEXT,finalized_at TIMESTAMPTZ);
      CREATE TABLE platform_orders(id UUID PRIMARY KEY,status TEXT);
      CREATE TABLE platform_order_items(id UUID PRIMARY KEY,order_id UUID,line_total_amount_minor BIGINT);
      CREATE TABLE platform_event_registrations(id UUID PRIMARY KEY,event_id UUID,order_item_id UUID);
      CREATE TABLE platform_competition_disputes(registration_id UUID,resolved_at TIMESTAMPTZ);
      CREATE TABLE platform_refunds(order_id UUID,order_item_id UUID,amount_minor BIGINT,status TEXT);
      CREATE TABLE platform_audit_events(actor_user_id BIGINT,actor_key TEXT,action TEXT,resource_type TEXT,resource_id UUID,outcome TEXT,metadata JSONB);
      INSERT INTO app_users VALUES(1);
      INSERT INTO platform_events VALUES('${event}',NOW()-INTERVAL '2 days');
      INSERT INTO platform_competitions VALUES('${event}',1000,0,'finalized',NOW()-INTERVAL '1 day');
      INSERT INTO platform_orders VALUES('${order}','paid');
      INSERT INTO platform_order_items VALUES('${item}','${order}',1001);
      INSERT INTO platform_event_registrations VALUES('${registration}','${event}','${item}');`);
    await db.unsafe(readFileSync(new URL('../migrations/0226_competition_settlement_ledger.sql',import.meta.url),'utf8'));
  });
  afterAll(async()=>{await db?.end();if(admin){await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}});
  const statement=()=>competitionSettlement(db as unknown as PlatformDb,event);
  it('calculates rounded commission and blocks pending refunds and disputes',async()=>{
    expect(await statement()).toMatchObject({eligible:true,netCollectedMinor:'1001',platformFeeMinor:'100',organizerAmountMinor:'901',outstandingMinor:'901'});
    await db.unsafe(`INSERT INTO platform_refunds VALUES($1::uuid,NULL,100,'pending')`,[order]);
    expect((await statement()).eligible).toBe(false);
    await db.unsafe(`UPDATE platform_refunds SET status='failed'; INSERT INTO platform_competition_disputes VALUES('${registration}',NULL)`);
    expect((await statement()).eligible).toBe(false);
    await db.unsafe(`UPDATE platform_competition_disputes SET resolved_at=NOW()`);
    expect((await statement()).eligible).toBe(true);
  });
  it('freezes paid snapshot, appends refund adjustment once, and reconciles recovered funds',async()=>{
    const {transfers:_transfers,...snapshot}=await statement();
    await db.unsafe(`INSERT INTO platform_competition_settlement_ledger(event_id,entry_type,amount_minor,provider_reference_hash,transferred_at,statement_snapshot,actor_user_id,actor_key)
      VALUES($1::uuid,'payout',901,'paid-reference',NOW(),$2::jsonb,1,'test')`,[event,snapshot]);
    expect(await statement()).toMatchObject({transferStatus:'recorded',outstandingMinor:'0',transferredMinor:'901'});
    await db.begin(async tx=>{
      await tx.unsafe(`SELECT event_id FROM platform_competitions WHERE event_id=$1::uuid FOR UPDATE`,[event]);
      await tx.unsafe(`UPDATE platform_refunds SET status='succeeded'; UPDATE platform_orders SET status='partially_refunded'`);
      await reconcileCompetitionSettlement(tx as unknown as PlatformDb,event,actor);
      await reconcileCompetitionSettlement(tx as unknown as PlatformDb,event,actor);
    });
    const adjusted=await statement();
    expect(adjusted).toMatchObject({organizerAmountMinor:'811',outstandingMinor:'-90',transferStatus:'reconciliation_required'});
    expect(adjusted.transfers).toHaveLength(2);
    expect(adjusted.transfers[0].statementSnapshot).toMatchObject({organizerAmountMinor:'901'});
    expect(adjusted.transfers[1].entryType).toBe('adjustment');
    const {transfers:_rows,...recoverySnapshot}=adjusted;
    await db.unsafe(`INSERT INTO platform_competition_settlement_ledger(event_id,entry_type,amount_minor,provider_reference_hash,transferred_at,statement_snapshot,actor_user_id,actor_key)
      VALUES($1::uuid,'recovery',90,'recovered-reference',NOW(),$2::jsonb,1,'test')`,[event,recoverySnapshot]);
    expect(await statement()).toMatchObject({transferStatus:'recorded',outstandingMinor:'0',transferredMinor:'811',reconciliationRequired:false});
    expect((await db.unsafe(`SELECT COUNT(*)::integer AS n FROM platform_audit_events`))[0].n).toBe(1);
  });
});
