import {describe,it,expect,vi} from 'vitest';
import {requestSiteAssistant,assistantImageHistory} from '@/lib/site-assistant-request';
import { assistantResponseError } from '@/lib/site-assistant-errors';
import { SITE_ASSISTANT_BODY_BYTES, SITE_ASSISTANT_IMAGE_BYTES, SITE_ASSISTANT_QUESTION_MAX_LENGTH, SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH, type AssistantImage, type AssistantMessage } from '@cuberoot/shared/site-assistant';

const request={question:'明年世锦赛在哪里办',lang:'zh' as const,timeZone:'America/Los_Angeles',history:[]};
const image:AssistantImage={mediaType:'image/png',data:'fixture'};
it('retains complete recent image groups and marks older omitted images',()=>{
  const history=assistantImageHistory([
    {role:'user',content:'old',images:[image,image]}, {role:'assistant',content:'old reply'},
    {role:'user',content:'new',images:[image]},
  ],[image]);
  expect(history[0].images).toBeUndefined();
  expect(history[0].content).toContain('omitted');
  expect(history[1].content).toBe('old reply');
  expect(history[2].images).toEqual([image]);
});
it('bounds long follow-up context, including omitted image notices, without mutating visible turns',()=>{
  const content='x'.repeat(SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH+1000);
  const messages=[{role:'user' as const,content,images:[image,image]}, {role:'assistant' as const,content}];
  const history=assistantImageHistory(messages,[image,image,image]);
  expect(history.map(message=>message.content.length)).toEqual([SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH,SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH]);
  expect(history[0].content).toContain('Earlier attached images omitted');
  expect(history[1].content).toContain('Earlier message truncated');
  expect(messages[0].content).toBe(content);
  expect(messages[0].images).toHaveLength(2);
});
it('keeps maximum-size current images and whole recent turns within the real request body budget',async()=>{
  const fullImage:AssistantImage={mediaType:'image/png',data:'A'.repeat(SITE_ASSISTANT_IMAGE_BYTES*4/3)};
  const images=[fullImage,fullImage,fullImage];
  const earlier:AssistantMessage[]=Array.from({length:5},()=>[
    {role:'user' as const,content:'问'.repeat(SITE_ASSISTANT_QUESTION_MAX_LENGTH)},
    {role:'assistant' as const,content:'答'.repeat(SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH)},
  ]).flat();
  const history=assistantImageHistory(earlier,images);
  expect(history).toEqual(earlier.slice(-4));
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({answer:'ok',sources:[]}));
  await requestSiteAssistant('/v1/site-assistant',{...request,question:'问'.repeat(SITE_ASSISTANT_QUESTION_MAX_LENGTH),thinking:'deep',images,history},{},fetcher);
  const body=String(fetcher.mock.calls[0][1]?.body);
  expect(new TextEncoder().encode(body).length).toBeLessThanOrEqual(SITE_ASSISTANT_BODY_BYTES);
  expect(JSON.parse(body).images).toEqual(images);
});
it('accounts for JSON escapes without truncating the current question or images',async()=>{
  const images:AssistantImage[]=Array.from({length:3},()=>({mediaType:'image/png',data:'A'.repeat(SITE_ASSISTANT_IMAGE_BYTES*4/3)}));
  const question='\u0001'.repeat(SITE_ASSISTANT_QUESTION_MAX_LENGTH);
  const history:AssistantMessage[]=Array.from({length:2},()=>[
    {role:'user' as const,content:'\u0001'.repeat(SITE_ASSISTANT_QUESTION_MAX_LENGTH)},
    {role:'assistant' as const,content:'\u0001'.repeat(SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH)},
  ]).flat();
  const input={...request,question,images,history};
  expect(new TextEncoder().encode(JSON.stringify(input)).length).toBeGreaterThan(SITE_ASSISTANT_BODY_BYTES);
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({answer:'ok',sources:[]}));
  await requestSiteAssistant('/v1/site-assistant',input,{},fetcher);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const body=String(fetcher.mock.calls[0][1]?.body);
  expect(new TextEncoder().encode(body).length).toBeLessThanOrEqual(SITE_ASSISTANT_BODY_BYTES);
  expect(JSON.parse(body)).toEqual({...input,history:[]});
  expect(input.history).toHaveLength(4);
});
it('rejects oversized current content before any paid call instead of silently dropping it',async()=>{
  const fetcher=vi.fn<typeof fetch>();
  const input={...request,images:[{...image,data:'A'.repeat(SITE_ASSISTANT_BODY_BYTES)}]};
  const response=await requestSiteAssistant('/v1/site-assistant',input,{},fetcher);
  expect(response.status).toBe(413);
  const failure=await response.json();
  expect(failure).toEqual({error:'request_too_large'});
  expect(assistantResponseError(response,failure)).toBe('request_too_large');
  expect(fetcher).not.toHaveBeenCalled();
  expect(input.images[0].data).toHaveLength(SITE_ASSISTANT_BODY_BYTES);
});
it('never retries or silently discards an image on an older API',async()=>{
  for(const body of [{...request,images:[image]},{...request,history:[{role:'user' as const,content:'photo',images:[image]}]}]){
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({error:'invalid_question'},{status:400}));
    expect(await (await requestSiteAssistant('/v1/site-assistant',body,{},fetcher)).json()).toEqual({error:'vision_unavailable'});
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});
describe('assistant rolling deployment compatibility',()=>{
  it('drops only thinking on schema rejection while preserving trace IDs, images and streaming',async()=>{
    const done=new Response('stream',{headers:{'Content-Type':'text/event-stream'}});
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({error:'invalid_question'},{status:400})).mockResolvedValueOnce(done);
    const body={...request,thinking:'deep' as const,images:[image],conversationId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',parentId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'};
    const signal=new AbortController().signal;
    expect(await requestSiteAssistant('/v1/site-assistant',body,{signal,headers:{Accept:'text/event-stream'}},fetcher)).toBe(done);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const {thinking:_,...compatible}=body;
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual(compatible);
    expect(fetcher.mock.calls[1][1]).toMatchObject({signal,headers:{Accept:'text/event-stream'}});
  });
  it('never retries thinking preferences after the API has accepted or rejected paid work',async()=>{
    const response=Response.json({error:'model_unavailable'},{status:503});
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response);
    expect(await requestSiteAssistant('/v1/site-assistant',{...request,thinking:'deep'},{},fetcher)).toBe(response);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retries an old schema exactly once without losing question, history, auth or streaming',async()=>{
    const done=new Response('stream',{status:200,headers:{'Content-Type':'text/event-stream'}});
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({error:'invalid_question'},{status:400})).mockResolvedValueOnce(done);
    const signal=new AbortController().signal;
    const result=await requestSiteAssistant('/v1/site-assistant',request,{signal,headers:{Authorization:'test-auth',Accept:'text/event-stream'}},fetcher);
    expect(result).toBe(done);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual(request);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({question:request.question,lang:'zh',history:[]});
    expect(fetcher.mock.calls[1][1]).toMatchObject({signal,headers:{Authorization:'test-auth',Accept:'text/event-stream'}});
  });
  it.each([200,401,403,429,503,504])('does not retry an accepted request or another error: %s',async status=>{
    const response=Response.json({error:'invalid_question'},{status});
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response);
    expect(await requestSiteAssistant('/v1/site-assistant',request,{},fetcher)).toBe(response);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retains unrelated 400 bodies for the caller and does not retry twice',async()=>{
    const response=Response.json({error:'another_error'},{status:400});
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response);
    expect(await requestSiteAssistant('/v1/site-assistant',request,{},fetcher)).toBe(response);
    expect(await response.json()).toEqual({error:'another_error'});
    expect(fetcher).toHaveBeenCalledTimes(1);
    const rejected=vi.fn<typeof fetch>().mockResolvedValue(Response.json({error:'invalid_question'},{status:400}));
    expect((await requestSiteAssistant('/v1/site-assistant',request,{},rejected)).status).toBe(400);
    expect(rejected).toHaveBeenCalledTimes(2);
  });
});

it('removes only trace metadata for an older API while preserving image, timezone and auth',async()=>{
  const done=Response.json({answer:'ok',sources:[]});
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({error:'invalid_question'},{status:400})).mockResolvedValueOnce(done);
  const body={...request,images:[image],conversationId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'};
  const response=await requestSiteAssistant('/v1/site-assistant',body,{headers:{Authorization:'fixture'}},fetcher);
  expect(response).toBe(done);expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({...request,images:[image]});
  expect(fetcher.mock.calls[1][1]?.headers).toEqual({Authorization:'fixture'});
});
