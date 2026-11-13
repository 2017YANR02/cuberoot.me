import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import postgres from 'postgres';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import type {QueryRunner} from '../src/db/connection.js';
import {createSiteAssistantRoutes} from '../src/routes/site_assistant.js';
import {rememberAssistantContext,restoreAssistantContext,type AssistantContext} from '../src/utils/site_assistant_context.js';
import {startAssistantMonitor,cleanAssistantMonitoring} from '../src/utils/site_assistant_monitor.js';
import {applyAssistantCompletion} from '../src/utils/site_assistant_outbox.js';

const enabled=process.env.ASSISTANT_ANALYSIS_PG_TEST==='1' && process.env.DB_HOST==='127.0.0.1' && process.env.DB_NAME==='assistant_monitor_test';
const schema=`context_${randomUUID().replaceAll('-','')}`;
const options={host:'127.0.0.1',port:Number(process.env.DB_PORT ?? 5433),username:process.env.DB_USER ?? 'postgres',database:'assistant_monitor_test',max:1};
const admin=postgres(options),db=postgres({...options,connection:{search_path:schema}});
const run:QueryRunner=async<T>(statement:string,params:unknown[]=[])=>{
  let n=0;return await db.unsafe(statement.replace(/\?/g,()=>`$${++n}`),params as never[]) as unknown as T[];
};
const source={id:'rankings',title:'Fixture rankings',href:'/wca/results',read:true};
const table={kind:'table' as const,title:'Fixture',columns:['Rank','Name','WCA ID'],rows:[['1','Example','2099TEST01']]};
const answer=()=>rememberAssistantContext({answer:'Fixture [[rankings]]',sources:[source],artifacts:[table]},[
  {call:{tool:'rankings',event:'333',type:'single',country:'',year:2026,limit:1},result:{evidence:{event:'333',updated:'2026-11-01'},sources:[source],artifacts:[table]}},
]);

describe.skipIf(!enabled)('private context PostgreSQL and route lifecycle',()=>{
  beforeAll(async()=>{
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    await db.unsafe('CREATE TABLE app_users(id BIGINT PRIMARY KEY); INSERT INTO app_users VALUES (7),(8)');
    for(const migration of ['0277_assistant_monitoring','0326_assistant_context'])await db.unsafe(await readFile(new URL(`../migrations/${migration}.sql`,import.meta.url),'utf8'));
  });
  afterAll(async()=>{await db.end();await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
  it('persists through JSON, restores through SSE, and rejects another owner or branch',async()=>{
    let uid=7;const restored:Array<AssistantContext|undefined>=[];
    const app=createSiteAssistantRoutes({
      config:()=>({key:'fixture',baseUrl:'https://model.invalid',model:'fixture'}),now:Date.now,
      authenticate:async()=>({uid,wcaId:'2099TEST01'}),reserve:async()=>({allowed:true,retryAfter:0}),
      contextQuery:run,monitor:input=>startAssistantMonitor(input,run),
      answer:async(...args)=>{restored.push(args[12]);return answer();},
    });
    const conversationId=randomUUID();
    const post=(body:object,stream=false)=>app.request('/site-assistant',{method:'POST',headers:{'Content-Type':'application/json',...(stream?{Accept:'text/event-stream'}:{})},body:JSON.stringify({question:'Fixture query',lang:'en',conversationId,...body})});
    const first=await post({});expect(first.status).toBe(200);
    const parentId=first.headers.get('X-Assistant-Request-Id')!;
    expect(await first.json()).not.toHaveProperty('assistant_context');
    const [row]=await db`SELECT * FROM site_assistant_requests WHERE id=${parentId}`;
    expect(row.assistant_context.observations[0].tables[0].rows).toEqual(table.rows);
    expect(row.response).not.toHaveProperty('observations');
    const next=await post({parentId},true),events=await next.text();
    expect(events).toContain('"type":"done"');expect(events).not.toContain('"observations"');expect(events).not.toContain('assistant_context');
    expect(restored.at(-1)?.observations[0].tables[0].rows).toEqual(table.rows);
    uid=8;expect((await post({parentId})).status).toBe(200);expect(restored.at(-1)).toBeUndefined();
    uid=7;expect((await post({parentId,conversationId:randomUUID()})).status).toBe(200);expect(restored.at(-1)).toBeUndefined();
    expect((await post({parentId,assistant_context:row.assistant_context})).status).toBe(400);
    await db`UPDATE site_assistant_requests SET status='cancelled' WHERE id=${parentId}`;
    expect(await restoreAssistantContext(run,7,conversationId,parentId)).toBeUndefined();
    await db`UPDATE site_assistant_requests SET status='success',scope='index' WHERE id=${parentId}`;
    expect(await restoreAssistantContext(run,7,conversationId,parentId)).toBeUndefined();
    await db`UPDATE site_assistant_requests SET scope='chat',started_at=NOW()-INTERVAL '31 days',question=NULL,answer=NULL,response=NULL WHERE id=${parentId}`;
    expect(await restoreAssistantContext(run,7,conversationId,parentId)).toBeUndefined();
    await cleanAssistantMonitoring(run);
    expect((await db`SELECT assistant_context FROM site_assistant_requests WHERE id=${parentId}`)[0].assistant_context).toBeNull();
  });
  it('cascades account deletion and does not resurrect memory from a delayed completion',async()=>{
    const monitor=await startAssistantMonitor({uid:8,question:'Fixture',lang:'en',model:'fixture',streaming:false,imageCount:0,historyCount:0},run);
    await monitor.finish('success',undefined,answer());
    await db`DELETE FROM app_users WHERE id=8`;
    const now=new Date().toISOString();
    await applyAssistantCompletion({id:monitor.id,createdAt:now,params:['success',null,now,1,null,'Fixture',{}, {},{version:1},monitor.id]},run);
    expect(await db`SELECT id FROM site_assistant_requests WHERE user_id=8 OR id=${monitor.id}`).toHaveLength(0);
  });
});
