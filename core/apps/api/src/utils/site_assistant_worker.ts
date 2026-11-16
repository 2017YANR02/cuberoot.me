import { assistantOpenAICountrySupported } from '@cuberoot/shared/site-assistant-openai';
import { restoreAssistantContext } from './site_assistant_context.js';
import { query } from '../db/connection.js';
import { assistantAnswerHistory, assistantTimeoutMs, boundAssistantHistory, type AssistantAnswer, type AssistantProgress, type AssistantStreamEvent } from '@cuberoot/shared/site-assistant';
import { BANNED_WCA_IDS } from '@cuberoot/shared/admin';
import { answerSiteQuestion, assistantConfig } from './site_assistant.js';
import { assistantQueueStore, type AssistantClaim, type Checkpoint } from './site_assistant_queue.js';
import { AssistantSteered, markAssistantToolReused, withAssistantExecution } from './site_assistant_execution.js';
import { withAssistantProgress } from './site_assistant_progress.js';
import { assistantFailureCode, AssistantFailure } from './site_assistant_diagnostics.js';
import { resolveAssistantImages, readAssistantAttachment } from './site_assistant_attachments.js';
import { reserveAssistantQuestion } from './site_assistant_quota.js';
import { startAssistantMonitor } from './site_assistant_monitor.js';
import { assistantToolOutcome } from './site_assistant_evidence.js';
import { getUserById } from './account.js';

export function createAssistantQueueWorker(deps:{
  store:ReturnType<typeof assistantQueueStore>; answer:typeof answerSiteQuestion; config:typeof assistantConfig;
  authorize:(uid:number)=>Promise<string>; reserve:typeof reserveAssistantQuestion;
  attachment?:typeof readAssistantAttachment; monitor?:typeof startAssistantMonitor;
}) {
  let scanning=false,rescan=false,closed=false;
  const tasks=new Set<Promise<void>>();
  const controllers=new Set<AbortController>();
  async function execute(claim:AssistantClaim) {
    const lifetime=new AbortController();controllers.add(lifetime);
    let poll:ReturnType<typeof setTimeout>|undefined,done=false;
    const watch=async()=>{
      try { if((await deps.store.inspect(claim)).paused)lifetime.abort('user_cancel'); }
      catch { lifetime.abort('lease_lost'); }
      if(!done && !lifetime.signal.aborted)poll=setTimeout(()=>void watch(),750);
    };
    poll=setTimeout(()=>void watch(),750);
    let revision=Number(claim.message.sequence);
    let progress:AssistantProgress[]=claim.message.progress.map(p=>p.state==='running'?{...p,state:'error'}:p);
    const checkpoints:Record<string,Checkpoint>={...claim.message.checkpoints};
    try {
      for(let pass=0;pass<10;pass++) {
        const current=await deps.store.inspect(claim);
        revision=current.revision;
        if(current.paused || lifetime.signal.aborted) {await deps.store.finish(claim,revision);return;}
        const wcaId=await deps.authorize(claim.uid);
        const inputs=current.messages.map(message=>message.payload);
        const input=inputs[0];
        const question=inputs.length===1?input.question:input.question+'\n\n'+inputs.slice(1).map((update,index)=>`[User update ${index+1}; later updates take precedence]\n${update.question}`).join('\n\n');
        const refreshRequested=/重新(?:查|读|获取)|重查|刷新|实时|最新|不要复用|\b(?:recheck|refresh|live|latest|fetch again|read again|up.to.date)\b/i.test(question);
        const references=inputs.flatMap(value=>value.references ?? []);
        const savedImages=inputs.flatMap(value=>value.images ?? []);
        const historyRows=(await deps.store.history(claim)).reverse();
        let history=boundAssistantHistory(historyRows.length ? historyRows.flatMap(row=>[
          {role:'user' as const,images:[row.payload,...row.updates].flatMap(value=>value.images ?? []),content:[row.payload,...row.updates].map(value=>value.question+(value.references?.length?'\nUser-provided quotes (unverified): '+JSON.stringify(value.references):'')).join('\n[Later user update]\n')},
          {role:'assistant' as const,content:row.answer?assistantAnswerHistory(row.answer,'https://cuberoot.me'):''},
        ]) : input.history);
        let imageBudget=3-savedImages.length;
        history=[...history].reverse().map(message=>{
          if(!message.images?.length)return message;
          if(message.images.length<=imageBudget){imageBudget-=message.images.length;return message;}
          return {role:message.role,content:message.content+'\n[Earlier images omitted; request them again if needed.]'};
        }).reverse();
        const parentId=historyRows.at(-1)?.request_id;
        const priorContext=parentId?await restoreAssistantContext(query,claim.uid,claim.conversationId,parentId).catch(()=>undefined):undefined;
        const config=deps.config(!!savedImages.length || history.some(m=>!!m.images?.length),input.provider);
        if(!config)throw new AssistantFailure('provider_unavailable');
        if(input.provider==='openai') {
          if(!assistantOpenAICountrySupported(claim.message.country))throw new AssistantFailure('provider_region_unavailable');
          config.visitorCountry=claim.message.country!;
        }
        const step=new AbortController();
        const signal=AbortSignal.any([lifetime.signal,step.signal,AbortSignal.timeout(assistantTimeoutMs(input.thinking)-2000)]);
        const images=await resolveAssistantImages(claim.uid,savedImages,deps.attachment ?? readAssistantAttachment);
        const resolvedHistory=await Promise.all(history.map(async message=>({...message,...(message.images?{images:await resolveAssistantImages(claim.uid,message.images,deps.attachment ?? readAssistantAttachment)}:{})})));
        signal.throwIfAborted();
        if(!(await deps.reserve()).allowed)throw new AssistantFailure('daily_limit');
        const started=performance.now();
        const monitor=await deps.monitor?.({uid:claim.uid,startedAt:started,question,lang:input.lang,model:config.model,streaming:true,imageCount:images.length,historyCount:history.length,conversationId:claim.conversationId,parentId:parentId ?? undefined,thinking:input.thinking});
        if(monitor)await deps.store.update(claim,{requestId:monitor.id});
        let lastDraftWrite=0;
        const emit=async(event:AssistantStreamEvent)=>{
          signal.throwIfAborted();
          if(event.type==='progress') {
            monitor?.progress?.();
            progress=[...progress.filter(p=>p.id!==event.progress.id),event.progress].slice(-128);
            await deps.store.update(claim,{progress});
          } else if(event.type==='answer') {
            monitor?.text?.(event.answer);
            if(performance.now()-lastDraftWrite<250 && event.answer)return;
            lastDraftWrite=performance.now();
            // Keep the latest draft, but commit a final answer only under the inbox fence.
            await deps.store.update(claim,{answer:{answer:event.answer,sources:event.sources}});
          }
        };
        const boundary=async()=>{
          signal.throwIfAborted();
          const latest=await deps.store.inspect(claim);
          if(latest.paused){lifetime.abort('user_cancel');signal.throwIfAborted();}
          if(latest.revision!==revision){const error=new AssistantSteered();step.abort(error);throw error;}
        };
        try {
          await boundary();
          await deps.store.acknowledge(claim,revision);
          const run=()=>withAssistantExecution({boundary,messages:inputs.map(value=>value.question),bindings:JSON.stringify({lang:input.lang,timeZone:input.timeZone,day:new Date().toISOString().slice(0,10),wcaId}),scope:JSON.stringify({question,lang:input.lang,history,references,images:savedImages,priorContext}),tool:async(_call,key,read)=>{
            const cached=checkpoints[key];
            if(!refreshRequested && cached && Date.now()-cached.at<300_000 && Date.now()>=cached.at)return markAssistantToolReused(structuredClone(cached.result));
            const result=await read();
            signal.throwIfAborted();
            const evidence=result.evidence as Record<string,unknown>|null;
            if(!evidence?.notEvidence && !evidence?.error && !evidence?.contextIncomplete && ['success','empty'].includes(assistantToolOutcome(result).state)) {
              const bounded=result;
              // Do not turn an incomplete clipped result into a reusable success.
              const serialized=JSON.stringify(bounded);
              if(Buffer.byteLength(serialized)<70_000) {
                for(const [old,value] of Object.entries(checkpoints))if(Date.now()-value.at>=300_000)delete checkpoints[old];
                while(Object.keys(checkpoints).length>=10)delete checkpoints[Object.keys(checkpoints)[0]];
                checkpoints[key]={at:Date.now(),result:bounded};
                while(Buffer.byteLength(JSON.stringify(checkpoints))>350_000)delete checkpoints[Object.keys(checkpoints)[0]];
                await deps.store.update(claim,{checkpoints});
              }
            }
            return result;
          }},()=>withAssistantProgress(emit,signal,started,()=>deps.answer(question,input.lang,config,signal,undefined,resolvedHistory,wcaId,emit,input.timeZone,images,input.thinking,{},priorContext,references),Math.max(0,...progress.map(p=>p.id))));
          monitor?.ready?.();
          const answer:AssistantAnswer=await (monitor?monitor.run(run):run());
          signal.throwIfAborted();
          const outcome=await deps.store.finish(claim,revision,answer);
          if(outcome==='completed')monitor?.text?.(answer.answer);
          await monitor?.finish(outcome==='completed'?'success':'cancelled',undefined,outcome==='completed'?answer:undefined);
          if(outcome==='steered')continue;
          return;
        } catch(error) {
          await monitor?.finish(step.signal.reason instanceof AssistantSteered || lifetime.signal.reason==='user_cancel'?'cancelled':'error',assistantFailureCode(error));
          if(step.signal.reason instanceof AssistantSteered)continue;
          throw error;
        }
      }
      throw new AssistantFailure('busy');
    } catch(error) {
      // A dead worker cannot overwrite a replacement's checkpoint or final answer.
      if(lifetime.signal.reason==='shutdown')await deps.store.abandon(claim).catch(()=>{});
      else {
        const latest=await deps.store.inspect(claim).catch(()=>undefined);
        if(latest)await deps.store.finish(claim,latest.revision,undefined,assistantFailureCode(error)).catch(()=>{});
      }
    } finally {done=true;clearTimeout(poll);controllers.delete(lifetime);}
  }
  const kick=async()=>{
    if(closed)return;
    if(scanning){rescan=true;return;}
    scanning=true;
    try {
      do {
        rescan=false;
        // Each conversation has its own database lease. An unrelated conversation
        // must not wait for another user's model request to finish.
        while(!closed) {
          const claim=await deps.store.claim();if(!claim)break;
          const task=execute(claim);tasks.add(task);
          void task.finally(()=>{tasks.delete(task);if(!closed)void kick().catch(()=>{});});
        }
      } while(rescan && !closed);
    } finally {scanning=false;}
  };
  return {
    kick:()=>kick().catch(()=>{}),
    start() {
      const timer=setInterval(()=>void kick().catch(()=>{}),2000);timer.unref();
      const retention=setInterval(()=>void deps.store.prune().catch(()=>{}),3600_000);retention.unref();
      void kick().catch(()=>{});
      return async()=>{closed=true;clearInterval(timer);clearInterval(retention);for(const c of controllers)c.abort('shutdown');await Promise.allSettled(tasks);};
    },
    async idle(){await Promise.allSettled(tasks);},
  };
}
export const durableAssistantStore=assistantQueueStore();
export const durableAssistantWorker=createAssistantQueueWorker({store:durableAssistantStore,answer:answerSiteQuestion,config:assistantConfig,reserve:reserveAssistantQuestion,monitor:startAssistantMonitor,authorize:async uid=>{
  const account=await getUserById(uid);
  if(!account?.wca_id || !/^\d{4}[A-Z]{4}\d{2}$/.test(account.wca_id))throw new AssistantFailure('wca_link_required');
  if(BANNED_WCA_IDS.includes(account.wca_id))throw new AssistantFailure('account_forbidden');
  return account.wca_id;
}});
