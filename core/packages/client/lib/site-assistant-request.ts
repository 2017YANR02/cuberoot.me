import type { AssistantMessage } from '@cuberoot/shared/site-assistant';

interface AssistantRequest {
  question:string;
  lang:'zh'|'en';
  history:AssistantMessage[];
  timeZone:string;
}

/** A schema rejection happens before quota/model work, so this retry is safe. */
export async function requestSiteAssistant(url:string,request:AssistantRequest,init:RequestInit,fetcher:typeof fetch=fetch):Promise<Response> {
  const response=await fetcher(url,{...init,method:'POST',body:JSON.stringify(request)});
  if(response.status!==400)return response;
  const failure=await response.clone().json().catch(()=>null);
  if(failure?.error!=='invalid_question')return response;
  const {timeZone:_,...legacyRequest}=request;
  return fetcher(url,{...init,method:'POST',body:JSON.stringify(legacyRequest)});
}
