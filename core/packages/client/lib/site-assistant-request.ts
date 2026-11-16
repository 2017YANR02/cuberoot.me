import { apiUrl, assistantStreamApiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { sessionFetch } from '@/lib/session-fetch';
import type { AssistantBrowserTiming, AssistantProvider } from '@cuberoot/shared/site-assistant';
import type { AssistantRunState } from '@cuberoot/shared/site-assistant';
import { SITE_ASSISTANT_ARTIFACT_FORMAT, SITE_ASSISTANT_BODY_BYTES, SITE_ASSISTANT_MAX_IMAGES, SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH, boundAssistantHistory, type AssistantMessage, type AssistantImage, type AssistantThinkingMode } from '@cuberoot/shared/site-assistant';

interface AssistantRequest {
  runId?: string;
  references?: import('@cuberoot/shared/site-assistant').AssistantReference[];
  conversationId?: string; parentId?: string; retryOf?: string;
  question:string;
  images?:AssistantImage[];
  lang:'zh'|'en';
  history:AssistantMessage[];
  timeZone:string;
  thinking?:AssistantThinkingMode;
  provider?:AssistantProvider;
}

/** A schema rejection happens before quota/model work, so this retry is safe. */
export async function requestSiteAssistant(url:string,request:AssistantRequest,init:RequestInit,fetcher:typeof fetch=sessionFetch):Promise<Response> {
  url += `${url.includes('?') ? '&' : '?'}artifactFormat=${SITE_ASSISTANT_ARTIFACT_FORMAT}`;
  request={...request,history:boundAssistantHistory(request.history)};
  const encoder=new TextEncoder();
  let body=JSON.stringify(request);
  // JSON escaping can use six bytes per character. Enforce the actual wire
  // budget, removing only older complete history, never the current message.
  while(encoder.encode(body).byteLength>SITE_ASSISTANT_BODY_BYTES) {
    if(!request.history.length) return Response.json({error:'request_too_large'},{status:413});
    request={...request,history:boundAssistantHistory(request.history.slice(1))};
    body=JSON.stringify(request);
  }
  // Compatibility retries only remove fields from this bounded request.
  let response=await fetcher(url,{...init,method:'POST',body});
  if(response.status!==400)return response;
  let failure=await response.clone().json().catch(()=>null);
  if(failure?.error!=='invalid_question')return response;
  // Never downgrade task control or silently discard explicit quotations.
  if(request.runId || request.references?.length) return response;
  // Never send an explicit OpenAI question to another provider on an old API.
  if (request.provider === 'openai') return Response.json({ error: 'provider_unavailable' }, { status: 503 });
  if (request.provider === 'bailian') {
    const { provider: _provider, ...compatible } = request;
    request = compatible;
    response = await fetcher(url, { ...init, method: 'POST', body: JSON.stringify(request) });
    if (response.status !== 400) return response;
    failure = await response.clone().json().catch(() => null);
    if (failure?.error !== 'invalid_question') return response;
  }
  // Thinking was added after conversation tracking. Preserve trace IDs and images
  // on servers that already support them but do not yet accept this preference.
  if (request.thinking) {
    const { thinking: _thinking, ...compatible } = request;
    request = compatible;
    response = await fetcher(url, { ...init, method: 'POST', body: JSON.stringify(request) });
    if (response.status !== 400) return response;
    failure = await response.clone().json().catch(() => null);
    if (failure?.error !== 'invalid_question') return response;
  }
  if (request.conversationId) {
    const { conversationId: _conversation, parentId: _parent, retryOf: _retry, ...compatible } = request;
    response = await fetcher(url, { ...init, method: 'POST', body: JSON.stringify(compatible) });
    if (response.status !== 400) return response;
    failure = await response.clone().json().catch(() => null);
    if (failure?.error !== 'invalid_question') return response;
  }
  // An older server cannot understand images; never silently drop them or retry.
  if(request.images?.length || request.history.some(message=>message.images?.length)) return Response.json({error:'vision_unavailable'},{status:503});
  const {timeZone:_,conversationId:_conversation,parentId:_parent,retryOf:_retry,...legacyRequest}=request;
  return fetcher(url,{...init,method:'POST',body:JSON.stringify(legacyRequest)});
}

/** Keep recent turns and whole image groups within one bounded multimodal request. */
export function assistantImageHistory(history: AssistantMessage[], currentImages: AssistantImage[]): AssistantMessage[] {
  let remaining = SITE_ASSISTANT_MAX_IMAGES - currentImages.length;
  const recent = history.slice(-10).reverse().map(message => {
    // A long draft or generated answer must not invalidate the next request.
    // Mark omitted text so the model does not assume it has the whole document.
    const omitted='\n[Earlier message truncated; ask for the omitted text if needed.]';
    if(message.content.length>SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH) message={...message,content:message.content.slice(0,SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH-omitted.length)+omitted};
    if (!message.images?.length) return message;
    if (message.role === 'user' && message.images.length <= remaining) {
      remaining -= message.images.length;
      return message;
    }
    const note='\n[Earlier attached images omitted; ask the user to reattach if needed.]';
    return { role: message.role, content: message.content.slice(0,SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH-note.length)+note };
  }).reverse();
  return boundAssistantHistory(recent);
}

export type AssistantFeedback = 'helpful' | 'incorrect' | 'irrelevant' | 'bad_source' | 'bad_link' | 'other';
export async function sendAssistantEvent(id: string, event: { type: 'feedback'; value: AssistantFeedback | null } | { type: 'click'; kind: 'action' | 'source'; id: string } | { type: 'timing'; timing: AssistantBrowserTiming }) {
  return handleApi(await sessionFetch(apiUrl(`/v1/site-assistant/requests/${id}/events`), { method: 'POST', headers: authHeaders(), body: JSON.stringify(event), keepalive: true }));
}

/** A transport abort is not a server acknowledgement. Keep the answer stream open
 * until the owned run reaches a terminal state (including a completion race). */
export async function cancelAssistantRun(id: string, conversationId: string, fetcher: typeof fetch = sessionFetch): Promise<AssistantRunState> {
  const signal=AbortSignal.timeout(20_000);
  const url=`${assistantStreamApiUrl()}/runs/${id}`;
  let response=await fetcher(`${url}/cancel`, {method:'POST',headers:authHeaders(),body:JSON.stringify({conversationId}),signal});
  for (;;) {
    if(!response.ok) throw new Error('cancel_unconfirmed');
    const {state}=await response.json() as {state:AssistantRunState};
    if(['completed','cancelled','error','interrupted'].includes(state))return state;
    if(state!=='running' && state!=='stopping')throw new Error('invalid_run_state');
    await new Promise(resolve=>setTimeout(resolve,250));
    signal.throwIfAborted();
    response=await fetcher(url,{headers:authHeaders(),signal,cache:'no-store'});
  }
}
