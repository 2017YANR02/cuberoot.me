/** Local-only integration fixture. Run with a disposable PostgreSQL database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveAssistantCompletion, replayAssistantCompletions, replayAssistantFaults } from '../../src/utils/site_assistant_outbox.js';
import { checkAssistantAlerts } from '../../src/utils/site_assistant_monitor_jobs.js';
import { createSiteAssistantRoutes } from '../../src/routes/site_assistant.js';
import { readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import type { QueryRunner } from '../../src/db/connection.js';
import { startAssistantMonitor, cleanAssistantMonitoring, recordAssistantModel } from '../../src/utils/site_assistant_monitor.js';
import { createAdminAssistantRoutes } from '../../src/routes/admin_assistant.js';

if (process.env.DB_NAME !== 'assistant_monitor_test' || process.env.DB_HOST !== '127.0.0.1') throw new Error('Dedicated local assistant_monitor_test database required');
const schema = `monitor_${randomUUID().replaceAll('-', '')}`;
const options = { host: '127.0.0.1', port: Number(process.env.DB_PORT), username: process.env.DB_USER, database: 'assistant_monitor_test', max: 2 };
const admin = postgres(options);
await admin.unsafe(`CREATE SCHEMA ${schema}`);
const db = postgres({ ...options, connection: { search_path: schema } });
const run: QueryRunner = async <T>(statement: string, params: unknown[] = []) => {
  let n = 0;
  return await db.unsafe(statement.replace(/\?/g, () => `$${++n}`), params as never[]) as unknown as T[];
};
try {
  await db.unsafe('CREATE TABLE app_users (id BIGINT PRIMARY KEY)');
  await db.unsafe(await readFile(new URL('../../migrations/0277_assistant_monitoring.sql', import.meta.url), 'utf8'));
  await db`INSERT INTO app_users VALUES (7),(8)`;
  await db`UPDATE site_assistant_monitor_state SET enabled_at=NOW()-INTERVAL '3 days'`;
  const recorder = await startAssistantMonitor({ uid: 7, question: 'PLL navigation', lang: 'en', model: 'test', streaming: true, imageCount: 0, historyCount: 0 }, run);
  await recorder.run(async () => {
    recordAssistantModel('test', true)({ inputTokens: 10, outputTokens: 5, totalTokens: 15, inputTokenDetails: { noCacheTokens: 8, cacheReadTokens: 2, cacheWriteTokens: undefined }, outputTokenDetails: { textTokens: 3, reasoningTokens: 2 } });
    recorder.text('Answer');
  });
  await recorder.finish('success', undefined, { answer: 'Open PLL', sources: [], actions: [{ id: 'pll', title: 'PLL', href: '/alg/3x3/pll' }] });
  const first = (await db`SELECT * FROM site_assistant_requests`)[0];
  assert.equal(first.response.actions[0].href, '/alg/3x3/pll');
  assert.equal(first.metrics.models[0].input, 10);
  await db`UPDATE site_assistant_requests SET duration_ms=1000`;
  const second = randomUUID(), expired = randomUUID(), ancient = randomUUID(), stale = randomUUID();
  await db`INSERT INTO site_assistant_requests (id,user_id,status,lang,model,streaming,question,answer,duration_ms,started_at) VALUES
    (${second},8,'success','en','test',false,'OLL navigation','Open OLL',3000,NOW()),
    (${expired},7,'error','en','test',false,'expired secret','expired answer',NULL,NOW()-INTERVAL '31 days'),
    (${ancient},7,'success','en','test',false,'old text','old answer',NULL,NOW()-INTERVAL '91 days'),
    (${stale},7,'running','en','test',false,'pending',NULL,NULL,NOW()-INTERVAL '3 minutes')`;
  const app = createAdminAssistantRoutes({ authorize: async () => ({uid:7}), runQuery: run });
  const read = async (path: string) => { const response = await app.request('/admin/assistant/' + path); assert.equal(response.status, 200); return response.json(); };
  const summary = await read('summary?days=7');
  assert.equal(summary.totals.requests, 3); assert.equal(summary.totals.users, 2);
  assert.equal(summary.totals.avg_ms, 2000); assert.equal(summary.totals.p50_ms, 2000); assert.equal(summary.totals.p95_ms, 2900);
  assert.equal(summary.models[0].input_tokens, 10); assert.equal(summary.models[0].missing_usage, 0);
  assert.equal(summary.daily.reduce((n: number, r: { requests: number }) => n + r.requests, 0), 3);
  assert.equal(summary.daily.length, 4); assert.equal(summary.daily[0].requests, 0);
  const midnight = (await db`SELECT ((NOW() AT TIME ZONE 'Asia/Shanghai')::date::timestamp AT TIME ZONE 'Asia/Shanghai') AS value`)[0].value;
  for (const offset of [-1000, 0]) await db`INSERT INTO site_assistant_requests (id,user_id,status,lang,model,streaming,started_at)
    VALUES (${randomUUID()},7,'cancelled','en','test',false,${new Date(new Date(midnight).getTime()+offset)})`;
  const boundary = await read('summary?days=7');
  assert.equal(boundary.daily.at(-1).requests, 4); assert.equal(boundary.daily.at(-2).requests, 1);
  assert.equal((await read('requests?days=90&q=expired')).total, 0);
  assert.equal((await read('requests?days=7&q=PLL')).total, 1);
  const old = await read(`requests/${expired}`); assert.equal(old.question, null); assert.equal(old.answer, null); assert.equal(old.content_expired, true);
  assert.equal((await app.request(`/admin/assistant/requests/${ancient}`)).status, 404);
  let uid=8;
  const events=createSiteAssistantRoutes({ config:()=>null,now:Date.now,reserve:async()=>({allowed:true,retryAfter:0}),authenticate:async()=>({uid,wcaId:'2017YANR02'}),answer:async()=>({answer:'test',sources:[]}),eventsQuery:run });
  const event=(body:unknown)=>events.request(`/site-assistant/requests/${first.id}/events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await event({type:'feedback',value:'incorrect'})).status,404);
  uid=7;
  assert.equal((await event({type:'feedback',value:'incorrect'})).status,200);
  assert.equal((await event({type:'feedback',value:'incorrect'})).status,200);
  assert.equal((await event({type:'click',kind:'action',id:'forged'})).status,404);
  assert.equal((await event({type:'click',kind:'action',id:'pll'})).status,200);
  assert.equal((await event({type:'click',kind:'action',id:'pll'})).status,200);
  assert.equal(Object.keys((await db`SELECT clicked_actions FROM site_assistant_requests WHERE id=${first.id}`)[0].clicked_actions).length,1);
  const review=await app.request(`/admin/assistant/requests/${first.id}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'confirmed',note:'password=private'})});
  assert.equal(review.status,200);
  const reviewed=await read(`requests/${first.id}`);
  assert.equal(reviewed.review_status,'confirmed');assert.equal(reviewed.review_note,'password=[redacted]');assert.equal(reviewed.reviewed_by,'uid:7');
  assert.equal((await read('requests?feedback=unreviewed')).total,0);
  const insight=await read('insights?days=7');assert.equal(insight.cost.clicked,1);assert.equal(insight.feedback[0].requests,1);
  assert.ok(insight.audit.some((a:{action:string;actor:string})=>a.action==='review:confirmed'&&a.actor==='uid:7'));
  const child=await startAssistantMonitor({uid:7,question:'follow up',lang:'en',model:'test',streaming:false,imageCount:0,historyCount:2,conversationId:first.conversation_id,parentId:first.id,retryOf:second},run);
  await child.finish('success',undefined,{answer:'ok',sources:[]});
  const childRow=(await db`SELECT parent_id,retry_of FROM site_assistant_requests WHERE id=${child.id}`)[0];
  assert.equal(childRow.parent_id,first.id);assert.equal(childRow.retry_of,null); // Foreign user's ID is not linked.
  assert.equal((await read(`requests?conversation=${first.conversation_id}&user=7`)).total,2);
  assert.equal((await read(`requests?conversation=${first.conversation_id}&user=8`)).total,0);
  const outbox=await mkdtemp(join(tmpdir(),'assistant-outbox-test-'));
  try {
    const failed=await startAssistantMonitor({uid:7,question:'journal',lang:'en',model:'test',streaming:false,imageCount:0,historyCount:0},run);
    const completion={id:failed.id,createdAt:new Date().toISOString(),params:['success',null,new Date().toISOString(),100,null,'recovered',null,{cost:{grossCny:0,unpricedCalls:0}},failed.id]};
    await saveAssistantCompletion(completion,outbox);
    await assert.rejects(replayAssistantCompletions(async()=>{throw new Error('DB unavailable');},outbox));
    assert.equal((await readdir(outbox)).length,1);
    assert.equal(await replayAssistantCompletions(run,outbox),0);
    assert.equal((await db`SELECT answer FROM site_assistant_requests WHERE id=${failed.id}`)[0].answer,'recovered');
    assert.equal(await replayAssistantCompletions(run,outbox),0);
    // A deleted request/account is never resurrected by an old journal entry.
    await saveAssistantCompletion(completion,outbox);await db`DELETE FROM site_assistant_requests WHERE id=${failed.id}`;
    await replayAssistantCompletions(run,outbox);
    assert.equal((await db`SELECT id FROM site_assistant_requests WHERE id=${failed.id}`).length,0);
    await saveAssistantCompletion({...completion,createdAt:new Date(Date.now()-31*86400_000).toISOString()},outbox);
    await assert.rejects(replayAssistantCompletions(async()=>{throw new Error('DB unavailable');},outbox));
    const scrubbed=JSON.parse(await readFile(join(outbox,failed.id+'.json'),'utf8'));assert.equal(scrubbed.params[5],null);assert.equal(scrubbed.params[6],null);
    const faultId=randomUUID();await writeFile(join(outbox,faultId+'.fault'),JSON.stringify({id:faultId,failures:2,at:new Date(Date.now()-3600_000).toISOString()}));
    await replayAssistantFaults(run,outbox);await replayAssistantFaults(run,outbox);
    assert.equal(Number((await db`SELECT failed_writes FROM site_assistant_monitor_state`)[0].failed_writes),2);
  } finally { await rm(outbox,{recursive:true,force:true}); }
  const delivered:unknown[]=[];const deliver=async(value:unknown)=>{delivered.push(value);};
  await checkAssistantAlerts(run,2,deliver);await checkAssistantAlerts(run,2,deliver);
  assert.equal(delivered.length,1);
  await checkAssistantAlerts(run,0,deliver);assert.equal(delivered.length,2);
  await cleanAssistantMonitoring(run);
  assert.equal((await db`SELECT status FROM site_assistant_requests WHERE id=${stale}`)[0].status, 'interrupted');
  assert.equal((await db`SELECT question FROM site_assistant_requests WHERE id=${expired}`)[0].question, null);
  assert.equal((await db`SELECT * FROM site_assistant_requests WHERE id=${ancient}`).length, 0);
  const archive=(await db`SELECT metrics FROM site_assistant_daily WHERE day=(NOW() AT TIME ZONE 'Asia/Shanghai')::date-91`)[0];
  assert.equal(archive.metrics.requests,1);
  await cleanAssistantMonitoring(run);
  assert.deepEqual((await db`SELECT metrics FROM site_assistant_daily WHERE day=(NOW() AT TIME ZONE 'Asia/Shanghai')::date-91`)[0].metrics,archive.metrics);
  if (process.env.ASSISTANT_MONITOR_UI_FIXTURE) await writeFile(process.env.ASSISTANT_MONITOR_UI_FIXTURE, JSON.stringify({summary:await read('summary'),insights:await read('insights'),requests:await read('requests'),detail:await read(`requests/${first.id}`)}));
  await db`DELETE FROM app_users WHERE id=7`;
  assert.equal((await db`SELECT * FROM site_assistant_requests WHERE user_id=7`).length, 0);
  assert.equal((await db`SELECT * FROM site_assistant_requests WHERE user_id=8`).length, 1);
  console.log('PASS: real PG migration, JSONB, metrics, percentiles, search, expiry, cleanup and account-deletion cascade.');
} finally {
  await db.end(); await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
}
