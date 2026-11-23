import { readAssistantEvents } from '@cuberoot/shared/site-assistant';
import { assistantStreamApiUrl } from './api-base';
import { authHeaders } from './admin-api';
import { sessionFetch } from './session-fetch';
import { assistantResponseError } from './site-assistant-errors';
import type { AssistantDeliveryMode, AssistantDurableInput, AssistantErrorCode, AssistantQueueSnapshot } from '@cuberoot/shared/site-assistant';
export class AssistantQueueError extends Error {
  constructor(public code:AssistantErrorCode,public detail?:string){super(detail ?? code);}
}
export async function assistantQueueRequest(conversationId:string,action:''|'messages'|'stop'|'resume'='',body?:{id:string;mode:AssistantDeliveryMode;input:AssistantDurableInput},signal?:AbortSignal,fetcher:typeof fetch=sessionFetch,after?:number):Promise<AssistantQueueSnapshot|{id:string}|undefined> {
  const response=await fetcher(`${assistantStreamApiUrl()}/conversations/${conversationId}${action?`/${action}`:''}${!action && after!==undefined?`?after=${after}`:''}`,{method:action?'POST':'GET',headers:authHeaders(),body:body?JSON.stringify(body):undefined,signal:signal ?? AbortSignal.timeout(20_000),cache:'no-store'});
  if(response.status===304)return;
  const data=await response.json().catch(()=>null);
  if(response.status===404 && !action)return;
  if(!response.ok)throw new AssistantQueueError(assistantResponseError(response,data),data?.error);
  if(!action || action==='stop' || action==='resume') {
    if(!data || data.conversationId!==conversationId || !Array.isArray(data.messages))throw new AssistantQueueError('network');
  } else if(data?.id!==body?.id)throw new AssistantQueueError('network');
  return data;
}

/** A notification only wakes the authenticated snapshot reader. */
export async function watchAssistantQueue(id:string,signal:AbortSignal,onChange:()=>void) {
  const response=await sessionFetch(assistantStreamApiUrl()+'/conversations/'+id,{
    headers:{...authHeaders(false),Accept:'text/event-stream'},signal,cache:'no-store',
  });
  if(!response.ok || !response.body || !response.headers.get('Content-Type')?.includes('text/event-stream')) {
    await response.body?.cancel();
    return;
  }
  for await(const message of readAssistantEvents(response.body)) {
    if(message==='changed')onChange();
  }
}
