import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import postgres from 'postgres';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('../src/db/connection.js',()=>({query:mocks.query}));
vi.mock('../src/utils/recon_helpers.js',()=>({requireAuth:async()=>({uid:7}),checkRateLimit:()=>{}}));
vi.mock('../src/utils/analytics_helpers.js',()=>({getIp:()=> '127.0.0.1'}));
import {siteAssistantSharesRoutes as app} from '../src/routes/site_assistant_shares.js';

const enabled=process.env.ASSISTANT_SHARE_PG_TEST==='1' && process.env.DB_HOST==='127.0.0.1' && process.env.DB_NAME==='assistant_dev';
const schema=`share_versions_${randomUUID().replaceAll('-','')}`;
const options={host:'127.0.0.1',port:Number(process.env.DB_PORT ?? 5433),username:'postgres',database:'assistant_dev',max:1};
const admin=postgres(options),db=postgres({...options,connection:{search_path:schema}});
const requestId=randomUUID(),oldId='legacyshareabcdefghijklmn'.slice(0,24);
const post=(answer:string)=>app.request('/site-assistant/shares',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,question:'公式 🧩',answer})});
describe.skipIf(!enabled)('versioned share migrations and real PostgreSQL route',()=>{
  beforeAll(async()=>{
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    await db.unsafe('CREATE TABLE app_users(id BIGINT PRIMARY KEY); INSERT INTO app_users VALUES(7); CREATE TABLE site_assistant_requests(id UUID PRIMARY KEY,user_id BIGINT)');
    await db`INSERT INTO site_assistant_requests VALUES(${requestId},7)`;
    await db.unsafe(await readFile(new URL('../migrations/0294_assistant_message_shares.sql',import.meta.url),'utf8'));
    await db`INSERT INTO site_assistant_shares(id,user_id,request_id,question,answer) VALUES(${oldId},7,${requestId},'公式 🧩','original')`;
    await db.unsafe(await readFile(new URL('../migrations/0325_assistant_share_versions.sql',import.meta.url),'utf8'));
    mocks.query.mockImplementation(async(statement:string,params:unknown[]=[])=>{let n=0;return db.unsafe(statement.replace(/\?/g,()=>`$${++n}`),params as never[]);});
  });
  afterAll(async()=>{await db.end();await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
  it('preserves legacy URLs and hashes, reuses identical snapshots and keeps revised snapshots independent',async()=>{
    const [legacy]=await db`SELECT snapshot_hash FROM site_assistant_shares WHERE id=${oldId}`;
    const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
    expect(legacy.snapshot_hash).toBe(`${hash('公式 🧩')}:${hash('original')}`);
    expect(await (await post('original')).json()).toEqual({id:oldId});
    const changed=await (await post('new formula')).json() as {id:string};
    expect(changed.id).not.toBe(oldId);
    expect(await (await post('new formula')).json()).toEqual(changed);
    expect(await (await app.request(`/site-assistant/shares/${oldId}`)).json()).toEqual({question:'公式 🧩',answer:'original'});
    expect(await (await app.request(`/site-assistant/shares/${changed.id}`)).json()).toEqual({question:'公式 🧩',answer:'new formula'});
    expect((await app.request(`/site-assistant/shares/${oldId}`,{method:'DELETE'})).status).toBe(200);
    expect((await app.request(`/site-assistant/shares/${oldId}`)).status).toBe(404);
    expect((await app.request(`/site-assistant/shares/${changed.id}`)).status).toBe(200);
  });
});
