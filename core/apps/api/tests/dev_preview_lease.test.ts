import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const mock=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('../src/db/connection.js',()=>({query:mock.query}));
import { devPreviewLeaseRoutes } from '../src/routes/dev_preview_lease';

// Explicit disposable local PG database; never fall back to the application DB.
const url=process.env.PREVIEW_TEST_DATABASE_URL;
const schema=`preview_lease_test_${process.pid}`;
const app=new Hono().route('/lease',devPreviewLeaseRoutes);
let db:ReturnType<typeof postgres>;
const post=(path:string,body:unknown={},lease='')=>app.request('/lease'+(path==='/'?'':path),{method:'POST',headers:{'Content-Type':'application/json','X-Preview-Lease':lease},body:JSON.stringify(body)});
describe.skipIf(!url)('PostgreSQL worker coordination',()=>{
  beforeAll(async()=>{
    if(!/^postgres:\/\/[^/]*127\.0\.0\.1:55437\/preview_lease_test$/.test(url!))throw Error('Use the dedicated local test database on port 55437');
    db=postgres(url!);await db.unsafe(`CREATE SCHEMA ${schema}`);
    const migration=readFileSync(new URL('../migrations/0336_dev_preview_worker_lease.sql',import.meta.url),'utf8').replaceAll('dev_preview_worker',`${schema}.dev_preview_worker`);
    await db.unsafe(migration);
    mock.query.mockImplementation(async(sql:string,params:never[])=>{
      let i=0;return db.unsafe(sql.replaceAll('dev_preview_worker',`${schema}.dev_preview_worker`).replace(/\?/g,()=>`$${++i}`),params);
    });
  });
  afterAll(async()=>{if(db){await db.unsafe(`DROP SCHEMA ${schema} CASCADE`);await db.end();}});
  it('elects one of two Macs, resumes its checkpoint after expiry, and rejects stale writes',async()=>{
    const responses=await Promise.all([post('/',{worker:'mini'}),post('/',{worker:'mbp'})]);
    expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
    const first=await responses.find(r=>r.status===200)!.json();
    const checkpoint={requestId:'pending-request',baseSha:'a'.repeat(40),commits:{http:'b'.repeat(40)}};
    expect((await post('/checkpoint',checkpoint,first.lease)).status).toBe(200);
    expect((await post('/renew',{},first.lease)).status).toBe(200);
    await db.unsafe(`UPDATE ${schema}.dev_preview_worker SET expires_at=NOW()-INTERVAL '1 second'`);
    const second=await (await post('/',{worker:'replacement'})).json();
    expect(second.checkpoint).toEqual(checkpoint);
    for(const path of ['/renew','/checkpoint','/release'])expect((await post(path,{},first.lease)).status).toBe(409);
    expect((await post('/release',{},second.lease)).status).toBe(200);
    const third=await (await post('/',{worker:'mini'})).json();
    expect(third.checkpoint).toEqual(checkpoint);
  });
});
