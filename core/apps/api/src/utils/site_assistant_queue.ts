import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AssistantAnswer, AssistantDeliveryMode, AssistantDurableInput, AssistantProgress, AssistantQueueSnapshot, AssistantQueuedMessage } from '@cuberoot/shared/site-assistant';
import { sql, query, withTransaction, type QueryRunner } from '../db/connection.js';
import type { ToolResult } from './site_assistant_tools.js';

export type Checkpoint = { at: number; result: ToolResult };
type Conversation = {lease_active:boolean|null;revision:string;id:string;user_id:number;paused:boolean;lease:string|null;lease_until:Date|null;active_id:string|null};
type Message = {id:string;conversation_id:string;sequence:string;target_id:string|null;mode:AssistantDeliveryMode;state:AssistantQueuedMessage['state'];payload:AssistantDurableInput;country:string|null;answer:AssistantAnswer|null;progress:AssistantProgress[];checkpoints:Record<string,Checkpoint>;error:AssistantQueuedMessage['error']|null;request_id:string|null;attempts:number;created_at:Date;updated_at:Date};
export type AssistantClaim = { conversationId:string; uid:number; lease:string; poolStartMs?:number; message:Message };
export type QueueTransaction = typeof withTransaction;
export class AssistantQueueConflict extends Error {}
const queueChannel='cuberoot_assistant_queue_revision';
const notifyRevision=" RETURNING pg_notify('"+queueChannel+"',user_id::text||'/'||id::text)";

type ListenForRevisions=(notify:(key:string)=>void,ready:()=>void)=>Promise<unknown>;
export function assistantQueueStore(run:QueryRunner=query, transaction:QueueTransaction=withTransaction,
  listen:ListenForRevisions|undefined=run===query ? (notify,ready)=>sql.listen(queueChannel,notify,ready) : undefined) {
  // One LISTEN connection per server. NOTIFY is delivered only after COMMIT;
  // ownership stays with the authenticated snapshot, never the notification.
  let listening:Promise<unknown>|undefined;
  const changes=new EventEmitter();
  function changed(uid:number,id:string) { changes.emit(uid+'/'+id); }
  const mutate=async<T>(uid:number,id:string,write:()=>Promise<T>)=>{
    const result=await write();
    changed(uid,id);
    return result;
  };
  const locked=async(tx:QueryRunner,uid:number,id:string)=>{
    const row=(await tx<Conversation>('SELECT *,lease_until>NOW() AS lease_active FROM site_assistant_conversations WHERE id=? AND user_id=? FOR UPDATE',[id,uid]))[0];
    if(!row)throw new AssistantQueueConflict('not_found');
    return row;
  };
  const owned=async(tx:QueryRunner,claim:AssistantClaim)=>{
    const row=await locked(tx,claim.uid,claim.conversationId);
    if(row.lease!==claim.lease || row.active_id!==claim.message.id || !row.lease_active)throw new AssistantQueueConflict('lease_lost');
    return row;
  };
  return {
    subscribe(uid:number,id:string,listener:()=>void) {
      const key=uid+'/'+id;
      changes.on(key,listener);
      if(listen && !listening) {
        listening=listen(key=>{if(/^\d+\/[0-9a-f-]{36}$/i.test(key))changes.emit(key);},()=>{
          // Catch commits between the initial snapshot and LISTEN, or during reconnect.
          for(const key of changes.eventNames())changes.emit(key);
        }).catch(()=>{listening=undefined;});
      }
      return ()=>{changes.off(key,listener);};
    },
    async enqueue(uid:number,conversationId:string,id:string,mode:AssistantDeliveryMode,payload:AssistantDurableInput,country?:string) {
      payload=JSON.parse(JSON.stringify(payload));
      return mutate(uid,conversationId,()=>transaction(async tx=>{
        await tx('INSERT INTO site_assistant_conversations(id,user_id) VALUES (?,?) ON CONFLICT DO NOTHING',[conversationId,uid]);
        const conversation=await locked(tx,uid,conversationId);
        const existing=(await tx<Message>('SELECT * FROM site_assistant_messages WHERE id=?',[id]))[0];
        if(existing) {
          if(existing.conversation_id!==conversationId || JSON.stringify(existing.payload)!==JSON.stringify(payload) && !sameJson(existing.payload,payload) || existing.mode!==mode)throw new AssistantQueueConflict('message_conflict');
          return id;
        }
        const count=(await tx<{count:string}>('SELECT COUNT(*) FROM site_assistant_messages WHERE conversation_id=?',[conversationId]))[0];
        if(Number(count.count)>=100)throw new AssistantQueueConflict('conversation_full');
        // Attach steering to the active task, or the oldest queued task if its worker has not claimed it yet.
        const target=mode==='steer' && !conversation.paused ? conversation.active_id ?? (await tx<{id:string}>("SELECT id FROM site_assistant_messages WHERE conversation_id=? AND state='queued' AND target_id IS NULL ORDER BY sequence LIMIT 1",[conversationId]))[0]?.id : undefined;
        if(target) {
          const updates=await tx<Message>('SELECT id,sequence,payload FROM site_assistant_messages WHERE id=? OR target_id=? ORDER BY sequence',[target,target]);
          const all=[...updates.map(row=>row.payload),payload];
          if(all.length>9 || all.reduce((n,value)=>n+value.question.length,0)>24000 || all.flatMap(value=>value.images ?? []).length>3 || all.flatMap(value=>value.references ?? []).length>9 || all.flatMap(value=>value.references ?? []).reduce((n,reference)=>n+reference.selectedText.length,0)>36000)throw new AssistantQueueConflict('steering_full');
          if(updates[0]?.payload.provider!==payload.provider)throw new AssistantQueueConflict('provider_conflict');
        }
        await tx(`INSERT INTO site_assistant_messages(id,conversation_id,target_id,mode,state,payload,country) VALUES (?,?,?,?,?,?::text::jsonb,?)`,[id,conversationId,target ?? null,mode,'queued',JSON.stringify(payload),country ?? null]);
        await tx('UPDATE site_assistant_conversations SET revision=revision+1,updated_at=NOW() WHERE id=?'+notifyRevision,[conversationId]);
        return id;
      }));
    },
    async owns(uid:number,id:string) {
      const rows=await run('SELECT 1 FROM site_assistant_conversations WHERE id=? AND user_id=?',[id,uid]);
      return rows.length>0;
    },
    async revision(uid:number,id:string) {
      const rows=await run<{revision:string}>('SELECT CASE WHEN active_id IS NOT NULL AND (lease_until IS NULL OR lease_until<=NOW()) THEN NULL ELSE revision END AS revision FROM site_assistant_conversations WHERE id=? AND user_id=?',[id,uid]);
      return rows[0]?.revision!=null?Number(rows[0].revision):undefined;
    },
    async snapshot(uid:number,id:string,previous?:AssistantQueueSnapshot):Promise<AssistantQueueSnapshot|undefined> {
      // A single transaction snapshot under the conversation lock prevents mixed generations.
      return transaction(async tx=>{
        const rows=await tx<Conversation>('SELECT *,lease_until>NOW() AS lease_active FROM site_assistant_conversations WHERE id=? AND user_id=? FOR UPDATE',[id,uid]);
        const c=rows[0];if(!c)return;
        if(c.paused && c.active_id && !c.lease_active) {
          await tx("UPDATE site_assistant_messages SET state='stopped',updated_at=NOW() WHERE id=? AND state='running'",[c.active_id]);
          await tx('UPDATE site_assistant_conversations SET revision=revision+1,lease=NULL,lease_until=NULL,active_id=NULL WHERE id=?'+notifyRevision,[id]);
          c.active_id=null;c.lease=null;c.lease_until=null;c.revision=String(Number(c.revision)+1);
        }
        // Only a server-held, owner-checked stream snapshot is passed here.
        // Completed and applied rows are immutable. Queued, stopped and errored
        // rows may change on claim, resume or recovery, even without a new ID.
        const prior=previous?.conversationId===id ? previous : undefined;
        const mutable=prior?.messages.filter(row=>row.state!=='completed' && row.state!=='applied').map(row=>row.id);
        const filter=prior ? ' AND (sequence>? OR id=ANY(?::uuid[]))' : '';
        const args=prior ? [id,prior.messages.at(-1)?.sequence ?? 0,mutable] : [id];
        const messages=await tx<Message>("SELECT id,sequence,target_id,mode,state,payload-'history' AS payload,answer,progress,error,request_id,attempts,created_at,updated_at FROM site_assistant_messages WHERE conversation_id=?"+filter+" ORDER BY sequence",args);
        const updated=messages.map(m=>({id:m.id,sequence:Number(m.sequence),targetId:m.target_id ?? undefined,mode:m.mode,state:m.state,input:{...m.payload,history:[]},answer:m.answer ?? undefined,progress:m.progress,error:m.error ?? undefined,requestId:m.request_id ?? undefined,attempts:m.attempts,createdAt:new Date(m.created_at).getTime(),updatedAt:new Date(m.updated_at).getTime()}));
        const merged=new Map(prior?.messages.map(row=>[row.id,row]));
        for (const row of updated)merged.set(row.id,row);
        return {conversationId:id,revision:Number(c.revision),paused:c.paused,activeId:c.active_id ?? undefined,recovering:!!c.active_id && !c.lease_active,messages:[...merged.values()]};
      });
    },
    async control(uid:number,id:string,action:'stop'|'resume') {
      await mutate(uid,id,()=>transaction(async tx=>{
        const c=await locked(tx,uid,id);
        if(action==='resume' && c.active_id && c.lease_active)throw new AssistantQueueConflict('still_stopping');
        await tx('UPDATE site_assistant_conversations SET revision=revision+1,paused=?,updated_at=NOW() WHERE id=?'+notifyRevision,[action==='stop',id]);
        if(action==='resume') {
          // Resume only the most recent unfinished task; never replay completed answers.
          await tx(`UPDATE site_assistant_messages SET state='queued',error=NULL,attempts=0,updated_at=NOW() WHERE id=(SELECT id FROM site_assistant_messages WHERE conversation_id=? AND target_id IS NULL AND state IN ('stopped','error') ORDER BY sequence DESC LIMIT 1)`,[id]);
          await tx('UPDATE site_assistant_conversations SET revision=revision+1,lease=NULL,lease_until=NULL,active_id=NULL WHERE id=?'+notifyRevision,[id]);
        } else if(!c.lease_active) {
          await tx("UPDATE site_assistant_messages SET state='stopped',updated_at=NOW() WHERE id=? AND state='running'",[c.active_id]);
          await tx('UPDATE site_assistant_conversations SET revision=revision+1,lease=NULL,lease_until=NULL,active_id=NULL WHERE id=?'+notifyRevision,[id]);
        }
      }));
    },
    async claim():Promise<AssistantClaim|undefined> {
      for(;;){
        const requested=performance.now();
        const claim=await transaction(async tx=>{
          const poolStartMs=Math.round(performance.now()-requested);
          const c=(await tx<Conversation>(`SELECT * FROM site_assistant_conversations c WHERE NOT paused AND (lease_until IS NULL OR lease_until<=NOW()) AND EXISTS(SELECT 1 FROM site_assistant_messages m WHERE m.conversation_id=c.id AND m.target_id IS NULL AND m.state IN ('queued','running')) ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 1`))[0];
          if(!c)return;
          const m=(await tx<Message>(`SELECT * FROM site_assistant_messages WHERE conversation_id=? AND target_id IS NULL AND state IN ('queued','running') ORDER BY sequence LIMIT 1 FOR UPDATE`,[c.id]))[0];
          if(m.attempts>=3) {
            await tx("UPDATE site_assistant_messages SET state='error',error='unavailable',updated_at=NOW() WHERE id=?",[m.id]);
            await tx('UPDATE site_assistant_conversations SET revision=revision+1,paused=TRUE,lease=NULL,lease_until=NULL,active_id=NULL WHERE id=?'+notifyRevision,[c.id]);
            return {exhausted:c} as const;
          }
          const lease=randomUUID();
          await tx("UPDATE site_assistant_conversations SET revision=revision+1,lease=?,lease_until=NOW()+INTERVAL '45 seconds',active_id=?,updated_at=NOW() WHERE id=?"+notifyRevision,[lease,m.id,c.id]);
          const [claimed]=await tx<{updated_at:Date}>("UPDATE site_assistant_messages SET state='running',attempts=attempts+1,error=NULL,answer=NULL,updated_at=NOW() WHERE id=? RETURNING updated_at",[m.id]);
          return {conversationId:c.id,uid:Number(c.user_id),lease,poolStartMs,message:{...m,updated_at:claimed.updated_at,state:'running' as const,attempts:m.attempts+1}};
        });
        if(!claim)return;
        if('exhausted' in claim && claim.exhausted){
          changed(claim.exhausted.user_id,claim.exhausted.id);
          continue;
        }
        changed(claim.uid,claim.conversationId);
        return claim;
      }
    },
    async heartbeat(claim:AssistantClaim) {
      const rows=await run<{paused:boolean}>("UPDATE site_assistant_conversations SET lease_until=NOW()+INTERVAL '45 seconds' WHERE id=? AND user_id=? AND active_id=? AND lease=? AND lease_until>NOW() RETURNING paused",[claim.conversationId,claim.uid,claim.message.id,claim.lease]);
      if (!rows.length) throw new AssistantQueueConflict('lease_lost');
      return rows[0].paused;
    },
    async inspect(claim:AssistantClaim) {
      return transaction(async tx=>{
        const c=await owned(tx,claim);
        await tx("UPDATE site_assistant_conversations SET lease_until=NOW()+INTERVAL '45 seconds' WHERE id=?",[c.id]);
        const messages=await tx<Message>('SELECT id,sequence,payload FROM site_assistant_messages WHERE id=? OR target_id=? ORDER BY sequence',[claim.message.id,claim.message.id]);
        return {paused:c.paused,messages,revision:Number(messages.at(-1)!.sequence)};
      });
    },
    async abandon(claim:AssistantClaim) {
      await transaction(async tx=>{await owned(tx,claim);await tx('UPDATE site_assistant_conversations SET revision=revision+1,lease_until=NOW() WHERE id=?'+notifyRevision,[claim.conversationId]);});
    },
    async acknowledge(claim:AssistantClaim,revision:number) {
      await mutate(claim.uid,claim.conversationId,()=>transaction(async tx=>{await owned(tx,claim);await tx("UPDATE site_assistant_messages SET state='applied',updated_at=NOW() WHERE target_id=? AND sequence<=? AND state='queued'",[claim.message.id,revision]);await tx('UPDATE site_assistant_conversations SET revision=revision+1 WHERE id=?'+notifyRevision,[claim.conversationId]);}));
    },
    async update(claim:AssistantClaim,patch:{answer?:AssistantAnswer;progress?:AssistantProgress[];checkpoints?:Record<string,Checkpoint>;requestId?:string}) {
      const visible=patch.answer!==undefined || patch.progress!==undefined || !!patch.requestId;
      const write=()=>transaction(async tx=>{
        await owned(tx,claim);
        const fields:string[]=[],values:unknown[]=[];
        for(const key of ['answer','progress','checkpoints'] as const)if(patch[key]!==undefined){fields.push(`${key}=?::text::jsonb`);values.push(JSON.stringify(patch[key]));}
        if(patch.requestId){fields.push('request_id=?');values.push(patch.requestId);}
        if(fields.length)await tx(`UPDATE site_assistant_messages SET ${fields.join(',')}${visible?',updated_at=NOW()':''} WHERE id=?`,[...values,claim.message.id]);
        if(visible)await tx('UPDATE site_assistant_conversations SET revision=revision+1 WHERE id=?'+notifyRevision,[claim.conversationId]);
      });
      if (visible) await mutate(claim.uid,claim.conversationId,write);
      else await write();
    },
    async finish(claim:AssistantClaim,revision:number,result?:AssistantAnswer,error?:AssistantQueuedMessage['error']) {
      return mutate(claim.uid,claim.conversationId,()=>transaction(async tx=>{
        const c=await owned(tx,claim);
        const latest=(await tx<{sequence:string}>('SELECT sequence FROM site_assistant_messages WHERE id=? OR target_id=? ORDER BY sequence DESC LIMIT 1',[claim.message.id,claim.message.id]))[0];
        if(!c.paused && Number(latest.sequence)!==revision)return 'steered' as const;
        const state=c.paused?'stopped':result?'completed':'error';
        await tx('UPDATE site_assistant_messages SET state=?,answer=COALESCE(?::text::jsonb,answer),error=?,updated_at=NOW() WHERE id=?',[state,c.paused?null:result?JSON.stringify(result):null,state==='stopped'?null:error ?? null,claim.message.id]);
        // A failed reply is terminal for that message; eligible follow-ups
        // may still run. Pause the conversation for an explicit stop or
        // when the account can no longer use the assistant.
        const pause=c.paused || state==='error' && (error==='account_forbidden' || error==='wca_link_required' || error==='login_required');
        await tx('UPDATE site_assistant_conversations SET revision=revision+1,paused=?,lease=NULL,lease_until=NULL,active_id=NULL,updated_at=NOW() WHERE id=?'+notifyRevision,[pause,c.id]);
        return state;
      }));
    },
    async history(claim:AssistantClaim) {
      return run<Message & {updates:AssistantDurableInput[]}>("SELECT m.*,COALESCE((SELECT jsonb_agg(u.payload ORDER BY u.sequence) FROM site_assistant_messages u WHERE u.target_id=m.id),'[]'::jsonb) AS updates FROM site_assistant_messages m WHERE m.conversation_id=? AND m.sequence<? AND m.target_id IS NULL AND m.state='completed' ORDER BY m.sequence DESC LIMIT 5",[claim.conversationId,claim.message.sequence]);
    },
    async prune() {
      // Retain paused/recoverable tasks for 30 days, never prune a live lease.
      await run("DELETE FROM site_assistant_conversations WHERE updated_at<NOW()-INTERVAL '30 days' AND (lease_until IS NULL OR lease_until<=NOW())");
    },
  };
}
function sameJson(a:unknown,b:unknown):boolean {
  if(a===b)return true;
  if(!a || !b || typeof a!=='object' || typeof b!=='object')return false;
  const x=a as Record<string,unknown>,y=b as Record<string,unknown>;
  return Object.keys(x).length===Object.keys(y).length && Object.keys(x).every(key=>Object.hasOwn(y,key)&&sameJson(x[key],y[key]));
}
