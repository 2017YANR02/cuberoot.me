import {expect,it,vi} from 'vitest';
import {createAssistantQueueWorker} from '../src/utils/site_assistant_worker.js';
import type {AssistantClaim,assistantQueueStore} from '../src/utils/site_assistant_queue.js';
import type {AssistantProgress} from '@cuberoot/shared/site-assistant';
import {AssistantFailure} from '../src/utils/site_assistant_diagnostics.js';
import * as champions from '../src/utils/site_assistant_champions.js';
const claim=(uid:number):AssistantClaim=>({uid,conversationId:`conversation-${uid}`,lease:`lease-${uid}`,message:{id:`message-${uid}`,conversation_id:`conversation-${uid}`,sequence:String(uid),target_id:null,mode:'queue',state:'running',payload:{question:`question-${uid}`,lang:'en',provider:'bailian',thinking:'auto',timeZone:'UTC',history:[]},country:null,answer:null,progress:[],checkpoints:{},error:null,request_id:null,attempts:1,created_at:new Date(),updated_at:new Date()}});
const gate=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};};
function fixture(claims:AssistantClaim[]) {
  const pending=[...claims];
  const store={claim:vi.fn(async()=>pending.shift()),inspect:vi.fn(async(c:AssistantClaim)=>({paused:false,revision:Number(c.message.sequence),messages:[c.message]})),history:vi.fn(async()=>[]),acknowledge:vi.fn(),update:vi.fn(),finish:vi.fn(async()=> 'completed'),abandon:vi.fn(),prune:vi.fn()} as unknown as ReturnType<typeof assistantQueueStore>;
  return {store,pending};
}
it('starts every independent conversation while other users are still waiting for models',async()=>{
  const {store,pending}=fixture(Array.from({length:12},(_,i)=>claim(i+1)));
  const release=gate(),authorize=vi.fn(async(uid:number)=>`2099TEST${String(uid).padStart(2,'0')}`);
  const answer=vi.fn(async(question:string)=>{await release.promise;return {answer:question,sources:[]};});
  const worker=createAssistantQueueWorker({store,answer,authorize,config:()=>({key:'fixture',model:'fixture',baseUrl:'https://model.invalid'}),reserve:async()=>({allowed:true,retryAfter:0})});
  try {
    await worker.kick();
    await vi.waitFor(()=>expect(answer).toHaveBeenCalledTimes(12));
    expect(store.finish).not.toHaveBeenCalled();
    pending.push(claim(13));await worker.kick();
    await vi.waitFor(()=>expect(answer).toHaveBeenCalledTimes(13));
    expect(authorize.mock.calls.map(([uid])=>uid)).toEqual(Array.from({length:13},(_,i)=>i+1));
    expect(answer.mock.calls.map(([question])=>question)).toEqual(Array.from({length:13},(_,i)=>`question-${i+1}`));
  } finally {release.resolve();await worker.idle();}
  expect(store.finish).toHaveBeenCalledTimes(13);
});
it('does not lose an enqueue notification during an empty claim scan',async()=>{
  const {store,pending}=fixture([]),scan=gate();
  vi.mocked(store.claim).mockImplementationOnce(async()=>{await scan.promise;return undefined;});
  const answer=vi.fn(async()=>({answer:'done',sources:[]}));
  const worker=createAssistantQueueWorker({store,answer,authorize:async()=> '2099TEST01',config:()=>({key:'fixture',model:'fixture',baseUrl:'https://model.invalid'}),reserve:async()=>({allowed:true,retryAfter:0})});
  const initial=worker.kick();pending.push(claim(1));await worker.kick();scan.resolve();await initial;await worker.idle();
  expect(answer).toHaveBeenCalledTimes(1);
});
it('runs a standalone championship query without a model while preserving the normal provider guard',async()=>{
  const direct=claim(1),contextual=claim(2);
  const question='最近 WCA 官方比赛中，三阶速拧近 3 个月夺冠最多的人是谁？';
  direct.message.payload.question=contextual.message.payload.question=question;
  contextual.message.payload.history=[{role:'user',content:'只看中国的比赛'}];
  const {store}=fixture([direct,contextual]);
  const answer=vi.fn(),reserve=vi.fn(async()=>({allowed:true,retryAfter:0}));
  const result={answer:'Counted official results',sources:[]};
  const stats=vi.spyOn(champions,'runRecentChampionQuery').mockResolvedValue(result);
  const worker=createAssistantQueueWorker({store,answer,authorize:async()=>'2099TEST01',reserve,config:()=>null});
  try {
    await worker.kick();await worker.idle();
    expect(answer).not.toHaveBeenCalled();
    expect(stats).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(store.finish).toHaveBeenCalledWith(direct,1,result);
    expect(store.finish).toHaveBeenCalledWith(contextual,2,undefined,'provider_unavailable');
  } finally {stats.mockRestore();}
});
it('persists sequential snapshots when parallel steps finish out of order',async()=>{
  const job=claim(1),{store}=fixture([job]),release=gate();
  vi.mocked(store.update).mockImplementationOnce(async()=>{await release.promise;});
  const worker=createAssistantQueueWorker({store,authorize:async()=>'2099TEST01',reserve:async()=>({allowed:true,retryAfter:0}),
    config:()=>({key:'fixture',model:'fixture',baseUrl:'https://model.invalid'}),
    answer:async(_q,_lang,_config,_signal,_fetcher,_history,_id,emit)=>{
      const tool:AssistantProgress={id:1,phase:'tool',tool:'person',state:'running',elapsedMs:1};
      const model:AssistantProgress={id:2,phase:'model',activity:'write',state:'running',elapsedMs:2};
      await Promise.all([tool,model,{...tool,state:'complete' as const}].map(progress=>emit?.({type:'progress',progress})));
      return {answer:'done',sources:[]};
    }});
  try {
    await worker.kick();
    await vi.waitFor(()=>expect(store.update).toHaveBeenCalledTimes(1));
    expect(store.finish).not.toHaveBeenCalled();
  } finally {release.resolve();await worker.idle();}
  const progress=vi.mocked(store.update).mock.calls.map(([,patch])=>patch.progress);
  expect(progress).toMatchObject([[{id:1,state:'running'}],[{id:1,state:'running'},{id:2,state:'running'}],
    [{id:1,state:'complete'},{id:2,state:'running',activity:'write'}]]);
});
it('isolates a failed account check and a failed model from another conversation',async()=>{
  const {store}=fixture([claim(1),claim(2),claim(3)]),release=gate();
  const answer=vi.fn(async(question:string)=>{
    if(question==='question-2')throw new AssistantFailure('model_unavailable');
    await release.promise;return {answer:question,sources:[]};
  });
  const worker=createAssistantQueueWorker({store,answer,authorize:async uid=>{
    if(uid===1)throw new AssistantFailure('wca_link_required');
    return `2099TEST${String(uid).padStart(2,'0')}`;
  },config:()=>({key:'fixture',model:'fixture',baseUrl:'https://model.invalid'}),reserve:async()=>({allowed:true,retryAfter:0})});
  try {
    await worker.kick();
    await vi.waitFor(()=>expect(store.finish).toHaveBeenCalledTimes(2));
    expect(answer.mock.calls.map(([question])=>question)).toEqual(['question-2','question-3']);
    expect(store.finish).toHaveBeenCalledWith(expect.objectContaining({uid:1}),1,undefined,'wca_link_required');
    expect(store.finish).toHaveBeenCalledWith(expect.objectContaining({uid:2}),2,undefined,'model_unavailable');
  } finally {release.resolve();await worker.idle();}
  expect(store.finish).toHaveBeenCalledWith(expect.objectContaining({uid:3}),3,{answer:'question-3',sources:[]});
});

it('persists the verified formula card before the rest of the answer finishes',async()=>{
  const job=claim(1),{store}=fixture([job]),release=gate();
  const preview={answer:'T',sources:[],artifacts:[{kind:'algorithms' as const,version:1 as const,puzzle:'3x3' as const,set:'pll',title:'PLL',display:'both' as const,offset:0,total:1,
    cards:[{caseId:17,name:'T',puzzle:'3x3' as const,set:'pll',href:'/alg/3x3/pll#T',alg:"R U R'",sticker:{kind:'raw' as const,tag:'',attrs:{}},alternative:0,alternativeCount:1}]}]};
  const worker=createAssistantQueueWorker({store,authorize:async()=>'2099TEST01',reserve:async()=>({allowed:true,retryAfter:0}),
    config:()=>({key:'fixture',model:'fixture',baseUrl:'https://model.invalid'}),
    answer:async(_q,_lang,_config,_signal,_fetcher,_history,_id,emit)=>{
      await emit?.({type:'answer',...preview});
      await release.promise;
      return {...preview,answer:'Complete'};
    }});
  try {
    await worker.kick();
    await vi.waitFor(()=>expect(store.update).toHaveBeenCalledWith(job,{answer:preview}));
    expect(store.finish).not.toHaveBeenCalled();
  } finally {release.resolve();await worker.idle();}
  expect(store.finish).toHaveBeenCalledWith(job,1,{...preview,answer:'Complete'});
});
