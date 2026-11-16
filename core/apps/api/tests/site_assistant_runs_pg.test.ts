import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import type { QueryRunner } from '../src/db/connection.js';
import { assistantRunStore } from '../src/utils/site_assistant_runs.js';
import { createSiteAssistantRoutes } from '../src/routes/site_assistant.js';

const enabled=process.env.ASSISTANT_ANALYSIS_PG_TEST==='1' && process.env.DB_HOST==='127.0.0.1' && process.env.DB_NAME==='assistant_monitor_test';
const schema=`runs_${randomUUID().replaceAll('-','')}`;
const options={host:'127.0.0.1',port:Number(process.env.DB_PORT ?? 5433),username:process.env.DB_USER ?? 'postgres',database:'assistant_monitor_test',max:2};
const admin=postgres(options),db=postgres({...options,connection:{search_path:schema}});
const run:QueryRunner=async<T>(statement:string,params:unknown[]=[])=>{
  let n=0;return await db.unsafe(statement.replace(/\?/g,()=>`$${++n}`),params as never[]) as unknown as T[];
};
const store=assistantRunStore(run);
describe.skipIf(!enabled)('durable assistant run control',()=>{
  beforeAll(async()=>{
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    await db.unsafe('CREATE TABLE app_users(id BIGINT PRIMARY KEY); INSERT INTO app_users VALUES (7),(8)');
    await db.unsafe(await readFile(new URL('../migrations/0334_assistant_run_control.sql',import.meta.url),'utf8'));
  });
  afterAll(async()=>{await db.end();await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
  it('serializes separate workers and fences a late answer after cancellation',async()=>{
    const conversation=randomUUID(),first=randomUUID(),second=randomUUID(),other=assistantRunStore(run);
    expect(await store.start(7,conversation,first)).toBe(true);
    expect(await other.start(7,conversation,second)).toBe(false);
    expect(await other.cancel(7,conversation,first)).toBe('stopping');
    expect(await store.finish(7,first,'completed')).toBe('cancelled');
    expect(await other.start(7,conversation,second)).toBe(true);
    expect(await store.cancel(7,conversation,first)).toBe('cancelled');
    expect(await other.read(7,second)).toBe('running');
    await other.finish(7,second,'completed');
    expect(await other.cancel(7,conversation,second)).toBe('completed');
  });
  it('is idempotent, isolates owners and conversations, and preserves early cancellation',async()=>{
    const id=randomUUID(),conversation=randomUUID();
    expect(await store.cancel(7,conversation,id)).toBe('cancelled');
    expect(await store.start(7,conversation,id)).toBe(false);
    expect(await store.cancel(8,conversation,id)).toBeUndefined();
    expect(await store.cancel(7,randomUUID(),id)).toBeUndefined();
    expect(await store.read(8,id)).toBeUndefined();
    expect(await store.cancel(7,conversation,id)).toBe('cancelled');
  });
  it('expires abandoned runs without claiming they stopped and rejects their late completion',async()=>{
    const id=randomUUID(),conversation=randomUUID();
    await store.start(7,conversation,id);
    await run("UPDATE site_assistant_runs SET expires_at=NOW()-INTERVAL '1 second' WHERE id=?",[id]);
    expect(await store.read(7,id)).toBe('interrupted');
    expect(await store.finish(7,id,'completed')).toBe('interrupted');
    expect(await store.start(7,conversation,randomUUID())).toBe(true);
  });
  it('acknowledges only after execution settles, keeps drafts, and blocks a successor until then',async()=>{
    let release!:()=>void,aborted=false;
    const cleanup=new Promise<void>(resolve=>{release=resolve;});
    const conversationId=randomUUID(),runId=randomUUID();
    const answer=vi.fn(async(...args:Parameters<typeof import('../src/utils/site_assistant.js').answerSiteQuestion>)=>{
      const signal=args[3],emit=args[7];
      await emit?.({type:'answer',answer:'unverified draft',sources:[]});
      await new Promise<void>(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve();},{once:true}));
      await cleanup;
      signal.throwIfAborted();
      return {answer:'late answer',sources:[]};
    });
    const deps={runs:store,config:()=>({key:'fixture',baseUrl:'https://model.invalid',model:'fixture'}),now:Date.now,
      authenticate:async()=>({uid:7,wcaId:'2099TEST01'}),reserve:async()=>({allowed:true,retryAfter:0}),answer};
    const app=createSiteAssistantRoutes(deps),other=createSiteAssistantRoutes(deps);
    const reference={messageId:'old:assistant',messageVersion:3,role:'assistant',sourceStatus:'partial',selectedText:'Exact quotation'};
    const response=await app.request('/site-assistant',{method:'POST',headers:{Accept:'text/event-stream'},body:JSON.stringify({question:'only averages',lang:'en',runId,conversationId,references:[reference],history:[{role:'user',content:'2020–2025 China 3x3'}]})});
    const body=response.text();
    await vi.waitFor(()=>expect(answer).toHaveBeenCalledTimes(1));
    expect(answer.mock.calls[0][5]).toEqual([{role:'user',content:'2020–2025 China 3x3'}]);
    expect(answer.mock.calls[0][13]).toEqual([reference]);
    const cancel=await other.request(`/site-assistant/runs/${runId}/cancel`,{method:'POST',body:JSON.stringify({conversationId})});
    expect(await cancel.json()).toEqual({state:'stopping'});
    await vi.waitFor(()=>expect(aborted).toBe(true));
    expect(await store.read(7,runId)).toBe('stopping');
    expect(await store.start(7,conversationId,randomUUID())).toBe(false);
    release();
    const events=await body;
    expect(events).toContain('unverified draft');
    expect(events).toContain('"type":"cancelled"');
    expect(events).not.toContain('"type":"done"');
    expect(await store.read(7,runId)).toBe('cancelled');
    expect(await store.start(7,conversationId,randomUUID())).toBe(true);
  });
});
