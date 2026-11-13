import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAssistantEvents, type AssistantStreamEvent } from '@cuberoot/shared/site-assistant';
import { withAssistantProgress } from '../src/utils/site_assistant_progress.js';
import { assistantStage, AssistantFailure } from '../src/utils/site_assistant_diagnostics.js';
import { createSiteAssistantRoutes } from '../src/routes/site_assistant.js';
import { startAssistantMonitor, recordAssistantModel } from '../src/utils/site_assistant_monitor.js';

afterEach(()=>vi.restoreAllMocks());
const config={key:'fixture',baseUrl:'https://fixture.invalid',model:'fixture'};
const deps={config:()=>config,now:Date.now,reserve:async()=>({allowed:true,retryAfter:60}),authenticate:async()=>({uid:7,wcaId:'2017YANR02'})};

describe('assistant execution progress',()=>{
  it('streams real steps without exposing tool arguments, evidence or private reasoning and preserves JSON/SSE answers',async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});
    const answer=async()=>{
      await assistantStage('tool',async()=>({evidence:{secret:'private fixture'},sources:[{id:'a',read:true},{id:'a',read:true},{id:'b',read:false}]}),0,'pages');
      await assistantStage('review',async()=>({privateReasoning:'private fixture'}),1);
      return {answer:'Verified answer.',sources:[]};
    };
    const app=createSiteAssistantRoutes({...deps,answer});
    const response=await app.request('/site-assistant',{method:'POST',headers:{Accept:'text/event-stream'},body:JSON.stringify({question:'Explain',lang:'en'})});
    const events:AssistantStreamEvent[]=[];
    for await(const raw of readAssistantEvents(response.body!))events.push(JSON.parse(raw));
    const progress=events.filter(e=>e.type==='progress').map(e=>e.progress);
    expect(progress.map(p=>[p.id,p.phase,p.state])).toEqual([[1,'tool','running'],[1,'tool','complete'],[2,'review','running'],[2,'review','complete']]);
    expect(progress[1].sourceCount).toBe(1);
    expect(JSON.stringify(events)).not.toContain('private fixture');
    const json=await app.request('/site-assistant',{method:'POST',body:JSON.stringify({question:'Explain',lang:'en'})});
    expect(events.at(-1)).toEqual({type:'done',result:await json.json()});
  });
  it('marks incomplete and failed reads honestly, and does not emit late completion after cancellation',async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});
    const events:AssistantStreamEvent[]=[];const controller=new AbortController();
    await withAssistantProgress(async e=>{events.push(e);},controller.signal,performance.now(),async()=>{
      await assistantStage('tool',async()=>({evidence:{notEvidence:true}}),0,'pages');
      await expect(assistantStage('tool',async()=>{throw new AssistantFailure('source_unavailable');},0,'news')).rejects.toMatchObject({code:'source_unavailable'});
      await assistantStage('model',async()=>{controller.abort();return 'late';});
    });
    expect(events.filter(e=>e.type==='progress').map(e=>e.progress.state)).toEqual(['running','partial','running','error','running']);
  });
  it('isolates concurrent requests and adds no progress events to JSON consumers',async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});
    const a:AssistantStreamEvent[]=[],b:AssistantStreamEvent[]=[];
    await Promise.all([['pages',a],['person',b]].map(async([name,events])=>withAssistantProgress(async e=>{(events as AssistantStreamEvent[]).push(e);},new AbortController().signal,performance.now(),()=>assistantStage('tool',async()=>{await Promise.resolve();return {};},0,name as string))));
    expect(a.filter(e=>e.type==='progress').every(e=>e.progress.tool==='pages' && e.progress.id===1)).toBe(true);
    expect(b.filter(e=>e.type==='progress').every(e=>e.progress.tool==='person' && e.progress.id===1)).toBe(true);
    expect(await withAssistantProgress(undefined,new AbortController().signal,0,async()=>42)).toBe(42);
  });
  it('records model wait and text latency separately, without treating reasoning as answer text',async()=>{
    let time=100;vi.spyOn(performance,'now').mockImplementation(()=>time);
    const query=vi.fn().mockResolvedValue([]);
    const monitor=await startAssistantMonitor({uid:7,question:'fixture',lang:'en',model:'fixture',streaming:true,imageCount:0,historyCount:0},query);
    monitor.run(()=>{const usage=recordAssistantModel('fixture',true);time=150;usage.chunk('start');time=200;usage.chunk('reasoning-delta');time=350;usage.chunk('text-delta');time=500;usage();});
    await monitor.finish('success',undefined,{answer:'Final',sources:[]});
    const metrics=query.mock.calls.find(([sql])=>sql.startsWith('UPDATE'))![1][7];
    expect(metrics.models[0]).toMatchObject({firstActivityMs:100,firstTextMs:250,durationMs:400});
  });
});

describe('browser timing ownership and validation',()=>{
  const id='00000000-0000-4000-8000-000000000001';
  const timing={firstProgressMs:20,firstAnswerMs:80,responseMs:100,visibleMs:116,renderDelayMs:16,wasHidden:false,transport:'sse'};
  const request=(value:unknown)=>({method:'POST',body:JSON.stringify({type:'timing',timing:value})});
  it('stores only numeric timing metadata on an owned successful request, without overwriting existing measurements',async()=>{
    const eventsQuery=vi.fn().mockResolvedValue([{id}]);
    const app=createSiteAssistantRoutes({...deps,answer:async()=>({answer:'',sources:[]}),eventsQuery});
    expect((await app.request(`/site-assistant/requests/${id}/events`,request(timing))).status).toBe(200);
    const [sql,params]=eventsQuery.mock.calls[0];
    expect(sql).toContain("status='success'");expect(sql).toContain("NOT jsonb_exists");
    expect(sql.match(/\?/g)).toHaveLength(3);expect(params).toEqual([timing,id,7]);
    eventsQuery.mockResolvedValue([]);
    expect((await app.request(`/site-assistant/requests/${id}/events`,request(timing))).status).toBe(404);
  });
  it('rejects impossible, unbounded and extra fields before writing',async()=>{
    const eventsQuery=vi.fn();const app=createSiteAssistantRoutes({...deps,answer:async()=>({answer:'',sources:[]}),eventsQuery});
    for(const value of [{...timing,visibleMs:90},{...timing,firstAnswerMs:150},{...timing,visibleMs:700000},{...timing,question:'private'}, {...timing,renderDelayMs:0}]) {
      expect((await app.request(`/site-assistant/requests/${id}/events`,request(value))).status).toBe(400);
    }
    expect(eventsQuery).not.toHaveBeenCalled();
  });
});
