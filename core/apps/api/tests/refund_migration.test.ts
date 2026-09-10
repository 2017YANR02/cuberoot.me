import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';
const url=process.env.COMPETITION_TEST_DATABASE_URL;
describe.skipIf(!url)('provider refund migration on isolated PostgreSQL',()=>{
  it('preserves existing refunds and enforces a unique provider request number',async()=>{
    if(!['localhost','127.0.0.1'].includes(new URL(url!).hostname))throw Error('Loopback PostgreSQL required');
    const schema=`refund_${randomUUID().replaceAll('-','')}`;
    const admin=postgres(url!,{max:1});let db:ReturnType<typeof postgres>|undefined;
    try {
      await admin.unsafe(`CREATE SCHEMA "${schema}"`);db=postgres(url!,{max:1,connection:{search_path:schema}});
      await db.unsafe(`CREATE TABLE platform_refunds(id UUID DEFAULT gen_random_uuid(),provider TEXT,status TEXT,
        order_id UUID,payment_attempt_id UUID,order_item_id UUID,amount_minor BIGINT,currency TEXT,reason_code TEXT);
        INSERT INTO platform_refunds(provider,status) VALUES('wechat','succeeded')`);
      await db.unsafe(readFileSync(new URL('../migrations/0228_platform_provider_refunds.sql',import.meta.url),'utf8'));
      await db.unsafe(`CREATE TRIGGER platform_refunds_guard BEFORE UPDATE ON platform_refunds
        FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_refund()`);
      const old=await db.unsafe(`SELECT merchant_request_id,approved_at FROM platform_refunds`);
      expect(old[0]).toEqual({merchant_request_id:null,approved_at:null});
      await db.unsafe(`INSERT INTO platform_refunds(provider,status,merchant_request_id) VALUES('wechat','pending','same')`);
      await expect(db.unsafe(`INSERT INTO platform_refunds(provider,status,merchant_request_id) VALUES('wechat','pending','same')`)).rejects.toMatchObject({code:'23505'});
      expect(await db.unsafe(`SELECT COUNT(*)::int AS count FROM platform_refunds`)).toMatchObject([{count:2}]);
      await db.unsafe(`UPDATE platform_refunds SET approved_at=NOW(),status='failed' WHERE merchant_request_id='same'`);
      await db.unsafe(`UPDATE platform_refunds SET status='pending' WHERE merchant_request_id='same'`);
      await expect(db.unsafe(`UPDATE platform_refunds SET merchant_request_id='different' WHERE merchant_request_id='same'`)).rejects.toThrow('immutable');
      await db.unsafe(`UPDATE platform_refunds SET status='succeeded' WHERE merchant_request_id='same'`);
      await expect(db.unsafe(`UPDATE platform_refunds SET status='pending' WHERE merchant_request_id='same'`)).rejects.toThrow('invalid platform refund status transition');
    } finally {await db?.end();await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.end();}
  },30_000);
});
