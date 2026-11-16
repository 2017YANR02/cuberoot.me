import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { assistantQueueStore, type QueueTransaction } from '../src/utils/site_assistant_queue.js';
import { transactionQuery, type QueryRunner } from '../src/db/connection.js';
import { createAssistantQueueWorker } from '../src/utils/site_assistant_worker.js';
import { checkpointAssistantTool, assistantExecutionBoundary } from '../src/utils/site_assistant_execution.js';
import { assistantStage } from '../src/utils/site_assistant_diagnostics.js';
import { createSiteAssistantRoutes } from '../src/routes/site_assistant.js';
import type { AssistantDurableInput } from '@cuberoot/shared/site-assistant';
const enabled=process.env.ASSISTANT_ANALYSIS_PG_TEST==='1' && process.env.DB_HOST==='127.0.0.1' && process.env.DB_NAME==='assistant_monitor_test';
const schema=`queue_${randomUUID().replaceAll('-','')}`;
const options={host:'127.0.0.1',port:Number(process.env.DB_PORT ?? 5433),username:process.env.DB_USER ?? 'postgres',database:'assistant_monitor_test',max:4};
const admin=postgres({...options,max:1}),db=postgres({...options,connection:{search_path:schema}});
const run:QueryRunner=async<T>(statement:string,params:unknown[]=[])=>{
  let n=0;return await db.unsafe(statement.replace(/\?/g,()=>`$${++n}`),params as never[]) as unknown as T[];
};
const tx:QueueTransaction=async fn=>await db.begin(async connection=>fn(transactionQuery(connection))) as never;
const store=assistantQueueStore(run,tx);
const input=(question='original scope'):AssistantDurableInput=>({question,lang:'en',provider:'bailian',thinking:'auto',timeZone:'UTC',history:[]});
const config=()=>({key:'fixture',baseUrl:'https://model.invalid',model:'fixture'});
const reserve=async()=>({allowed:true,retryAfter:0});
const result={evidence:{value:42},sources:[{id:'saved',title:'Saved',href:'/about',read:true}],artifacts:[]};
const gate=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};};
describe.skipIf(!enabled)('durable assistant inbox and checkpoints',()=>{
  beforeAll(async()=>{await admin.unsafe(`CREATE SCHEMA ${schema}`);await db.unsafe('CREATE TABLE app_users(id BIGINT PRIMARY KEY); INSERT INTO app_users VALUES (7),(8),(9)');await db.unsafe(await readFile(new URL('../migrations/0335_assistant_durable_queue.sql',import.meta.url),'utf8'));});
  afterAll(async()=>{await db.end();await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
  it('accepts exactly once across workers, owns every read and preserves ordered steering',async()=>{
    const conversation=randomUUID(),id=randomUUID(),steer=randomUUID();
    const other=assistantQueueStore(run,tx);
    await Promise.all([store.enqueue(7,conversation,id,'queue',input()),other.enqueue(7,conversation,id,'queue',input())]);
    await other.enqueue(7,conversation,steer,'steer',input('only averages'));
    const snapshot=(await store.snapshot(7,conversation))!;
    expect(snapshot.messages.map(m=>m.id)).toEqual([id,steer]);
    expect(snapshot.messages[1]).toMatchObject({targetId:id,state:'queued'});
    expect(await store.snapshot(8,conversation)).toBeUndefined();
    await expect(other.enqueue(8,conversation,randomUUID(),'queue',input())).rejects.toThrow('not_found');
    await expect(other.enqueue(7,conversation,id,'queue',input('changed'))).rejects.toThrow('message_conflict');
    await store.control(7,conversation,'stop');
  });
  it('fences completion against new instructions and serializes queued tasks',async()=>{
    const conversation=randomUUID(),id=randomUUID(),next=randomUUID(),steer=randomUUID();
    await store.enqueue(7,conversation,id,'queue',input());
    const claims=await Promise.all([store.claim(),assistantQueueStore(run,tx).claim()]);
    expect(claims.filter(Boolean)).toHaveLength(1);const claim=claims.find(Boolean)!;
    await store.enqueue(7,conversation,next,'queue',input('next task'));
    await store.enqueue(7,conversation,steer,'steer',input('correction'));
    expect(await store.finish(claim,Number(claim.message.sequence),{answer:'obsolete',sources:[]})).toBe('steered');
    const current=await store.inspect(claim);await store.acknowledge(claim,current.revision);
    expect(await store.finish(claim,current.revision,{answer:'corrected',sources:[]})).toBe('completed');
    const second=(await store.claim())!;expect(second.message.id).toBe(next);
    await store.finish(second,(await store.inspect(second)).revision,{answer:'next',sources:[]});
  });
  it('keeps stop pending until settlement, pauses the queue, and resumes the saved task',async()=>{
    const conversation=randomUUID(),id=randomUUID(),next=randomUUID();
    await store.enqueue(7,conversation,id,'queue',input());const claim=(await store.claim())!;
    await store.update(claim,{checkpoints:{key:{at:Date.now(),result}}});
    await store.enqueue(7,conversation,next,'queue',input('queued'));
    await store.control(7,conversation,'stop');
    await expect(store.control(7,conversation,'resume')).rejects.toThrow('still_stopping');
    expect(await store.claim()).toBeUndefined();
    expect(await store.finish(claim,(await store.inspect(claim)).revision,{answer:'late',sources:[]})).toBe('stopped');
    expect((await store.snapshot(7,conversation))?.messages[0].answer).toBeUndefined();
    await store.control(7,conversation,'resume');
    const resumed=(await store.claim())!;expect(resumed.message.id).toBe(id);expect(resumed.message.checkpoints.key.result).toEqual(result);
    await store.control(7,conversation,'stop');await store.finish(resumed,(await store.inspect(resumed)).revision);
  });
  it('recovers an expired worker with a new lease and rejects its late checkpoint and answer',async()=>{
    const conversation=randomUUID(),id=randomUUID();await store.enqueue(7,conversation,id,'queue',input());
    const old=(await store.claim())!;await store.update(old,{checkpoints:{key:{at:Date.now(),result}}});
    await run("UPDATE site_assistant_conversations SET lease_until=NOW()-INTERVAL '1 second' WHERE id=?",[conversation]);
    const recovered=(await assistantQueueStore(run,tx).claim())!;
    expect(recovered.message.id).toBe(id);expect(recovered.message.attempts).toBe(2);expect(recovered.message.checkpoints.key.result).toEqual(result);
    await expect(store.update(old,{answer:{answer:'late',sources:[]}})).rejects.toThrow('lease_lost');
    await expect(store.finish(old,Number(old.message.sequence),{answer:'late',sources:[]})).rejects.toThrow('lease_lost');
    await store.finish(recovered,(await store.inspect(recovered)).revision,{answer:'recovered',sources:[]});
  });
  it('applies multiple updates at a boundary, reuses completed reads, and runs the next task afterwards',async()=>{
    const conversation=randomUUID(),id=randomUUID(),ready=gate(),release=gate();
    const read=vi.fn(async()=>structuredClone(result));let calls=0;const questions:string[]=[];
    const answer=vi.fn(async(...args:Parameters<typeof import('../src/utils/site_assistant.js').answerSiteQuestion>)=>{
      questions.push(args[0]);calls++;
      await assistantStage('tool',()=>checkpointAssistantTool({tool:'glossary',query:'same'},read),0,'glossary');
      if(calls===1){ready.resolve();await release.promise;await assistantExecutionBoundary();}
      if(args[0].includes('correction'))await assistantStage('tool',()=>checkpointAssistantTool({tool:'glossary',query:'changed'},read),0,'glossary');
      return {answer:args[0],sources:[]};
    });
    const worker=createAssistantQueueWorker({store,answer,config,reserve,authorize:async()=> '2099TEST01'});
    await store.enqueue(7,conversation,id,'queue',input());await worker.kick();await ready.promise;
    await store.enqueue(7,conversation,randomUUID(),'steer',input('only averages'));
    await store.enqueue(7,conversation,randomUUID(),'steer',input('correction: 2025'));
    const next=randomUUID();await store.enqueue(7,conversation,next,'queue',input('next task'));
    release.resolve();await vi.waitFor(async()=>expect((await store.snapshot(7,conversation))?.messages.at(-1)?.state).toBe('completed'));
    const snapshot=(await store.snapshot(7,conversation))!;
    expect(questions).toHaveLength(3);expect(questions[1]).toContain('original scope');expect(questions[1]).toContain('only averages');expect(questions[1]).toContain('correction: 2025');expect(questions[2]).toBe('next task');
    expect(read).toHaveBeenCalledTimes(3); // initial + changed arguments + isolated next task
    expect(snapshot.messages[0].progress.some(step=>step.reused)).toBe(true);
    expect(snapshot.messages.slice(1,3).every(message=>message.state==='applied')).toBe(true);
    await worker.idle();
  });
  it('does not cache failed evidence',async()=>{
    const conversation=randomUUID(),id=randomUUID(),ready=gate(),release=gate();let calls=0;
    const read=vi.fn(async()=>calls===1?{...result,evidence:{notEvidence:true},outcome:{state:'temporary_failure' as const}}:result);
    const answer=vi.fn(async()=>{calls++;await checkpointAssistantTool({tool:'glossary',query:'same'},read);if(calls===1){ready.resolve();await release.promise;await assistantExecutionBoundary();}return {answer:'done',sources:[]};});
    const worker=createAssistantQueueWorker({store,answer,config,reserve,authorize:async()=> '2099TEST01'});
    await store.enqueue(7,conversation,id,'queue',input());await worker.kick();await ready.promise;
    await store.enqueue(7,conversation,randomUUID(),'steer',input('retry'));release.resolve();
    await vi.waitFor(async()=>expect((await store.snapshot(7,conversation))?.messages[0].state).toBe('completed'));expect(read).toHaveBeenCalledTimes(2);await worker.idle();
  });
  it('a replacement worker reuses a saved tool and refreshes an expired checkpoint',async()=>{
    const conversation=randomUUID(),id=randomUUID(),ready=gate();
    const read=vi.fn(async()=>structuredClone(result));
    const first=createAssistantQueueWorker({store,config,reserve,authorize:async()=> '2099TEST01',answer:async(...args)=>{
      await assistantStage('tool',()=>checkpointAssistantTool({tool:'glossary',query:'same'},read),0,'glossary');
      ready.resolve();await new Promise<void>(resolve=>args[3].addEventListener('abort',()=>resolve(),{once:true}));
      args[3].throwIfAborted();return {answer:'stale',sources:[]};
    }});
    await store.enqueue(7,conversation,id,'queue',input());const stop=first.start();await ready.promise;await stop();
    expect((await store.snapshot(7,conversation))?.recovering).toBe(true);
    const secondReady=gate();
    const second=createAssistantQueueWorker({store,config,reserve,authorize:async()=> '2099TEST01',answer:async(...args)=>{
      await assistantStage('tool',()=>checkpointAssistantTool({tool:'glossary',query:'same'},read),0,'glossary');
      secondReady.resolve();await new Promise<void>(resolve=>args[3].addEventListener('abort',()=>resolve(),{once:true}));args[3].throwIfAborted();return {answer:'stale',sources:[]};
    }});
    const stopSecond=second.start();await secondReady.promise;
    expect(read).toHaveBeenCalledTimes(1);
    expect((await store.snapshot(7,conversation))?.messages[0].progress.some(p=>p.reused)).toBe(true);
    await stopSecond();
    const rows=await run<{checkpoints:Record<string,{at:number;result:unknown}>}>('SELECT checkpoints FROM site_assistant_messages WHERE id=?',[id]);
    for(const value of Object.values(rows[0].checkpoints))value.at=Date.now()-300_001;
    await run('UPDATE site_assistant_messages SET checkpoints=?::text::jsonb WHERE id=?',[JSON.stringify(rows[0].checkpoints),id]);
    const third=createAssistantQueueWorker({store,config,reserve,authorize:async()=> '2099TEST01',answer:async()=>{
      await checkpointAssistantTool({tool:'glossary',query:'same'},read);return {answer:'recovered',sources:[]};
    }});
    await third.kick();await vi.waitFor(async()=>expect((await store.snapshot(7,conversation))?.messages[0].state).toBe('completed'));
    expect(read).toHaveBeenCalledTimes(2);await third.idle();
  });
  it('pauses after repeated crashes and rechecks access before a restored model call',async()=>{
    const conversation=randomUUID(),id=randomUUID();await store.enqueue(7,conversation,id,'queue',input());
    for(let attempt=0;attempt<3;attempt++){const claim=(await store.claim())!;await store.abandon(claim);}
    expect(await store.claim()).toBeUndefined();expect((await store.snapshot(7,conversation))?.paused).toBe(true);
    await store.control(7,conversation,'resume');
    const answer=vi.fn(),worker=createAssistantQueueWorker({store,config,reserve,answer,authorize:async()=>{throw new Error('revoked');}});
    await worker.kick();await vi.waitFor(async()=>expect((await store.snapshot(7,conversation))?.messages[0].state).toBe('error'));
    expect(answer).not.toHaveBeenCalled();expect((await store.snapshot(7,conversation))?.paused).toBe(true);await worker.idle();
  });
  it('restores completed image context and ordered corrections for a queued follow-up',async()=>{
    const conversation=randomUUID(),first=randomUUID(),second=randomUUID(),attachmentId=randomUUID();
    await store.enqueue(7,conversation,first,'queue',{...input('photo question'),images:[{mediaType:'image/png',data:'',attachmentId}]});
    const claim=(await store.claim())!;
    await store.enqueue(7,conversation,randomUUID(),'steer',input('only the visible cube'));
    await store.finish(claim,(await store.inspect(claim)).revision,{answer:'verified image answer',sources:[]});
    await store.enqueue(7,conversation,second,'queue',input('what about its colors?'));
    const answer=vi.fn(async()=>({answer:'done',sources:[]}));
    const worker=createAssistantQueueWorker({store,config,reserve,answer,authorize:async()=> '2099TEST01',attachment:async(uid,id)=>{expect(uid).toBe(7);expect(id).toBe(attachmentId);return {mediaType:'image/png',data:'fixture',attachmentId:id};}});
    await worker.kick();await vi.waitFor(async()=>expect((await store.snapshot(7,conversation))?.messages.at(-1)?.state).toBe('completed'));
    const history=(answer.mock.calls as unknown as unknown[][])[0][5] as Array<{content:string;images?:unknown[]}>;
    expect(history[0].content).toContain('only the visible cube');expect(history[0].images).toEqual([{mediaType:'image/png',data:'fixture',attachmentId}]);
    await worker.idle();
  });
  it('records first progress and first answer before throttling draft persistence',async()=>{
    const conversation=randomUUID(),id=randomUUID(),progress=vi.fn(),text=vi.fn(),finish=vi.fn();
    const monitor={id:randomUUID(),ready:vi.fn(),progress,text,finish,run:<T>(fn:()=>Promise<T>)=>fn()};
    const worker=createAssistantQueueWorker({store,config,reserve,authorize:async()=> '2099TEST01',monitor:async()=>monitor,answer:async(...args)=>{
      await args[7]?.({type:'progress',progress:{id:1,phase:'model',state:'running',elapsedMs:1}});
      await args[7]?.({type:'answer',answer:'first',sources:[]});
      await args[7]?.({type:'answer',answer:'first and second',sources:[]});
      return {answer:'complete',sources:[]};
    }});
    await store.enqueue(7,conversation,id,'queue',input());await worker.kick();
    await vi.waitFor(async()=>expect((await store.snapshot(7,conversation))?.messages[0].state).toBe('completed'));
    expect(progress).toHaveBeenCalledTimes(1);expect(text.mock.calls).toEqual([['first'],['first and second'],['complete']]);expect(finish).toHaveBeenCalledWith('success',undefined,{answer:'complete',sources:[]});await worker.idle();
  });
  it('acknowledges a durable HTTP receipt without coupling execution to the request signal',async()=>{
    const conversation=randomUUID(),id=randomUUID(),kick=vi.fn(async()=>{});
    const app=createSiteAssistantRoutes({answer:vi.fn(),config,now:Date.now,reserve,authenticate:async()=>({uid:7,wcaId:'2099TEST01'}),queue:{store,worker:{kick}}});
    const controller=new AbortController();
    const url=`/site-assistant/conversations/${conversation}/messages`,body=JSON.stringify({id,mode:'queue',input:input()});
    expect((await app.request(url,{method:'POST',body,signal:controller.signal})).status).toBe(202);controller.abort();
    expect((await app.request(url,{method:'POST',body})).status).toBe(202);
    const snapshot=await (await app.request(`/site-assistant/conversations/${conversation}`)).json();expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]).not.toHaveProperty('checkpoints');
    expect((await app.request(`/site-assistant/conversations/${conversation}?after=${snapshot.revision}`)).status).toBe(304);
    await store.control(7,conversation,'stop');
    const changed=await (await app.request(`/site-assistant/conversations/${conversation}?after=${snapshot.revision}`)).json();
    expect(changed.revision).toBeGreaterThan(snapshot.revision);expect(changed.paused).toBe(true);
  });
  it('cascades private content on account deletion and reaps abandoned stops',async()=>{
    const conversation=randomUUID(),id=randomUUID();await store.enqueue(9,conversation,id,'queue',input('private'));
    const claim=(await store.claim())!;await store.control(9,conversation,'stop');
    await run("UPDATE site_assistant_conversations SET lease_until=NOW()-INTERVAL '1 second' WHERE id=?",[conversation]);
    expect((await store.snapshot(9,conversation))?.activeId).toBeUndefined();
    expect((await store.snapshot(9,conversation))?.messages[0].state).toBe('stopped');
    await expect(store.update(claim,{answer:{answer:'late',sources:[]}})).rejects.toThrow('lease_lost');
    await run('DELETE FROM app_users WHERE id=9');expect(await store.snapshot(9,conversation)).toBeUndefined();
    expect(await run('SELECT id FROM site_assistant_messages WHERE id=?',[id])).toEqual([]);
  });
});
