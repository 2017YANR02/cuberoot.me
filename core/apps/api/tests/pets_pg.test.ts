import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
let sql: ReturnType<typeof postgres>;
const schema = `pet_care_${randomUUID().replaceAll('-','')}`;
const rewrite=(s:string)=>{let i=0;return s.replace(/\?/g,()=>`$${++i}`);};
vi.mock('../src/db/connection.js',()=>({
  withTransaction: (run: (query: (s:string,p?:never[])=>unknown)=>unknown) => sql.begin(tx=>run((s,p=[])=>tx.unsafe(rewrite(s),p))),
}));
vi.mock('../src/utils/app_user_auth.js',()=>({
  requireAppUserId: (c:{req:{header:(key:string)=>string}})=>{
    const token=c.req.header('Authorization');
    if(!/^Bearer [12]$/.test(token??''))throw new HTTPException(401);
    return Number(token.slice(7));
  },
}));
let app:Hono;
const call=(path:string,uid:number|null=1,body?:unknown)=>app.request(`/v1/pets/${path}`,{
  method:body===undefined?'GET':'POST',headers:{...(uid?{Authorization:`Bearer ${uid}`} : {}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),
});
describe.skipIf(process.env.DESKPET_TEST_PG!=='1')('account pet adoption and care (PostgreSQL)',()=>{
  beforeAll(async()=>{
    sql=postgres({host:'127.0.0.1',port:Number(process.env.DESKPET_TEST_PORT??5433),user:'postgres',password:'dev',database:process.env.DESKPET_TEST_DB??'cuberoot_db',max:5,connection:{search_path:schema}});
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe('CREATE TABLE app_users (id BIGINT PRIMARY KEY, merged_into_user_id BIGINT); INSERT INTO app_users VALUES (1,NULL),(2,NULL)');
    for(const migration of ['0235_deskpet_catalog.sql','0236_pet_adoptions.sql'])await sql.unsafe(await readFile(new URL(`../migrations/${migration}`,import.meta.url),'utf8'));
    const {petRoutes}=await import('../src/routes/pets.js');app=new Hono().route('/v1',petRoutes);
  });
  afterAll(async()=>{if(sql){await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await sql.end();}});
  it('requires login and adoption, rejects hidden pets, and never accepts a client owner or care record',async()=>{
    expect((await call('mine',null)).status).toBe(401);
    expect((await call('rootbeast/adopt',null,{})).status).toBe(401);
    expect((await call('rootbeast/care',2,{action:'feed'})).status).toBe(403);
    for(const id of ['fox','unknown'])expect((await call(`${id}/adopt`,1,{})).status).toBe(404);
    const first=await call('rootbeast/adopt',1,{userId:2,care:{bond:999999}});
    expect(first.status).toBe(200);expect(first.headers.get('Cache-Control')).toBe('no-store');
    expect((await first.json()).care.bond).toBe(0);
    expect(await (await call('mine',2)).json()).toEqual([]);
    expect((await call('rootbeast/care',1,{action:'arbitrary'})).status).toBe(400);
  });
  it('serializes simultaneous care, caps daily XP, persists through reloads and makes re-adoption idempotent',async()=>{
    const results=await Promise.all(Array.from({length:5},()=>call('rootbeast/care',1,{action:'feed'}).then(r=>r.json())));
    expect(results.filter(r=>r.accepted)).toHaveLength(1);
    expect(results.filter(r=>r.gained)).toHaveLength(1);
    expect((await (await call('mine')).json())[0].care.bond).toBe(1);
    const again=await (await call('rootbeast/adopt',1,{})).json();expect(again.care.bond).toBe(1);
    for(const action of ['pet','play','rest'])expect((await (await call('rootbeast/care',1,{action})).json()).gained).toBe(true);
    expect((await (await call('mine')).json())[0].care.bond).toBe(4);
    await sql.unsafe("UPDATE user_pets SET care=jsonb_set(care,'{lastAction}','{}'::jsonb) WHERE user_id=1");
    const repeat=await (await call('rootbeast/care',1,{action:'feed'})).json();
    expect(repeat.accepted).toBe(true);expect(repeat.gained).toBe(false);expect(repeat.pet.care.bond).toBe(4);
  });
  it('honors catalog changes after adoption and rejects stale merged identities',async()=>{
    await sql.unsafe('UPDATE deskpet_catalog SET entries=$1',[sql.json([{id:'rootbeast',locked:true,removed:false}])]);
    expect((await call('rootbeast/care',1,{action:'pet'})).status).toBe(404);
    expect((await call('rootbeast/adopt',1,{})).status).toBe(404);
    await sql.unsafe('UPDATE deskpet_catalog SET entries=$1',[sql.json([{id:'fox',locked:false,removed:false}])]);
    expect((await call('fox/adopt',2,{})).status).toBe(200);
    await sql.unsafe('UPDATE app_users SET merged_into_user_id=1 WHERE id=2');
    expect((await call('fox/adopt',2,{})).status).toBe(401);
    expect((await call('mine',2)).status).toBe(401);
    await sql.unsafe('DELETE FROM app_users WHERE id=2');
    expect(await sql.unsafe('SELECT * FROM user_pets WHERE user_id=2')).toHaveLength(0);
  });
});
