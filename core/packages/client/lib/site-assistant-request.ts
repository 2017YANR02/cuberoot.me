import { sessionFetch } from '@/lib/session-fetch';
import { SITE_ASSISTANT_MAX_IMAGES, type AssistantMessage, type AssistantImage } from '@cuberoot/shared/site-assistant';

interface AssistantRequest {
  question:string;
  images?:AssistantImage[];
  lang:'zh'|'en';
  history:AssistantMessage[];
  timeZone:string;
}

/** A schema rejection happens before quota/model work, so this retry is safe. */
export async function requestSiteAssistant(url:string,request:AssistantRequest,init:RequestInit,fetcher:typeof fetch=sessionFetch):Promise<Response> {
  const response=await fetcher(url,{...init,method:'POST',body:JSON.stringify(request)});
  if(response.status!==400)return response;
  const failure=await response.clone().json().catch(()=>null);
  if(failure?.error!=='invalid_question')return response;
  // An older server cannot understand images; never silently drop them or retry.
  if(request.images?.length || request.history.some(message=>message.images?.length)) return Response.json({error:'vision_unavailable'},{status:503});
  const {timeZone:_,...legacyRequest}=request;
  return fetcher(url,{...init,method:'POST',body:JSON.stringify(legacyRequest)});
}

/** Keep recent turns and whole image groups within one bounded multimodal request. */
export function assistantImageHistory(history: AssistantMessage[], currentImages: AssistantImage[]): AssistantMessage[] {
  let remaining = SITE_ASSISTANT_MAX_IMAGES - currentImages.length;
  return history.slice(-10).reverse().map(message => {
    if (!message.images?.length) return message;
    if (message.role === 'user' && message.images.length <= remaining) {
      remaining -= message.images.length;
      return message;
    }
    return { role: message.role, content: message.content + '\n[Earlier attached images omitted; ask the user to reattach if needed.]' };
  }).reverse();
}
