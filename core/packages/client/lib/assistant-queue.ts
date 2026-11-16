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
