import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST as responsesPOST } from '@/app/api/site-assistant/openai/responses/route';
import { POST } from '@/app/api/site-assistant/openai/chat/completions/route';
import { readFileSync } from 'node:fs';
import { ASSISTANT_OPENAI_RESPONSES_PATH, ASSISTANT_OPENAI_MODEL, signAssistantOpenAI, verifyAssistantOpenAI } from '@cuberoot/shared/site-assistant-openai';

const secret = 'fixture-server-relay-secret-at-least-32-chars';
const body = JSON.stringify({ model: ASSISTANT_OPENAI_MODEL, store: false, max_completion_tokens: 4096, messages: [{ role: 'user', content: 'hi' }], stream: true });
beforeEach(() => { vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_REGION', 'iad1'); vi.stubEnv('SITE_ASSISTANT_OPENAI_RELAY_SECRET', secret); vi.stubEnv('OPENAI_API_KEY', 'fixture-openai-key'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function request(text = body, country = '') {
  const proof = await signAssistantOpenAI(secret, country, text);
  return new Request('https://fixture.vercel.app/api/site-assistant/openai/chat/completions', { method: 'POST', body: text, headers: { ...(country ? { 'x-assistant-country': country } : {}), 'x-assistant-proof': proof } });
}

it.each(['chat/completions','responses'] as const)('opts the %s relay into runtime cancellation and forwards abort before the first chunk',async protocol=>{
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  expect(config.functions[`app/api/site-assistant/openai/${protocol}/route.ts`].supportsCancellation).toBe(true);
  const controller=new AbortController();
  let signal:AbortSignal|undefined;
  const fetcher=vi.fn(async(_url:unknown,init:RequestInit)=>{
    signal=init.signal!;
    return await new Promise<Response>((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(signal!.reason),{once:true}));
  });
  vi.stubGlobal('fetch',fetcher);
  const text=protocol==='responses' ? JSON.stringify({model:ASSISTANT_OPENAI_MODEL,store:false,max_output_tokens:4096,input:[{role:'user',content:'hi'}],stream:true}) : body;
  const path=protocol==='responses' ? ASSISTANT_OPENAI_RESPONSES_PATH : undefined;
  const proof=await signAssistantOpenAI(secret,'US',text,Date.now(),path);
  const pending=(protocol==='responses'?responsesPOST:POST)(new Request('https://fixture/api',{method:'POST',body:text,signal:controller.signal,headers:{'x-assistant-country':'US','x-assistant-proof':proof}}));
  await vi.waitFor(()=>expect(signal).toBeDefined());
  controller.abort();
  await pending;
  expect(signal!.aborted).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('rejects altered bodies, countries, expired signatures and missing signatures', async () => {
  const proof = await signAssistantOpenAI(secret, 'US', body, 1_800_000_000_000);
  expect(await verifyAssistantOpenAI(secret, 'US', body, proof, 1_800_000_000_000)).toBe(true);
  expect(await verifyAssistantOpenAI(secret, 'CA', body, proof, 1_800_000_000_000)).toBe(false);
  expect(await verifyAssistantOpenAI(secret, 'US', body + ' ', proof, 1_800_000_000_000)).toBe(false);
  expect(await verifyAssistantOpenAI(secret, 'US', body, proof, 1_800_000_060_000)).toBe(false);
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect((await POST(new Request('https://fixture/api', { method: 'POST', body }))).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
it('fails closed outside the pinned US runtime, including the Hangzhou standalone build', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  vi.stubEnv('VERCEL', '');
  expect((await POST(await request())).status).toBe(503);
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_REGION', 'hkg1');
  expect((await POST(await request())).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});
it('streams only to the fixed OpenAI endpoint and never forwards relay credentials', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('data: {"ok":true}\n\n', { headers: { 'Content-Type': 'text/event-stream' } }));
  vi.stubGlobal('fetch', fetcher);
  const result = await POST(await request());
  expect(result.status).toBe(200);
  expect(await result.text()).toContain('data:');
  expect(result.headers.get('cache-control')).toBe('private, no-store');
  expect(fetcher.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
  expect(fetcher.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer fixture-openai-key', 'Content-Type': 'application/json' });
});
it('rejects unapproved models and unbounded token requests even with a valid signature', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  for (const override of [{ model: 'other-model' }, { max_completion_tokens: 999999 }, { store: true }]) {
    expect((await POST(await request(JSON.stringify({ ...JSON.parse(body), ...override })))).status).toBe(400);
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it('accepts a signed request without a visitor country', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})));
  const signed = await request();
  expect(signed.headers.has('x-assistant-country')).toBe(false);
  expect((await POST(signed)).status).toBe(200);
});

it('relays reasoning plus tools through Responses and binds signatures to the endpoint', async () => {
  const text = JSON.stringify({ model: ASSISTANT_OPENAI_MODEL, store: false, max_output_tokens: 8192, input: [{ role: 'user', content: 'hi' }], reasoning: { effort: 'high' }, tools: [], stream: true });
  const proof = await signAssistantOpenAI(secret, 'US', text, Date.now(), ASSISTANT_OPENAI_RESPONSES_PATH);
  const signedRequest = () => new Request('https://fixture' + ASSISTANT_OPENAI_RESPONSES_PATH, { method: 'POST', body: text, headers: { 'x-assistant-country': 'US', 'x-assistant-proof': proof } });
  const fetcher = vi.fn().mockResolvedValue(new Response('data: {}\n\n')); vi.stubGlobal('fetch', fetcher);
  expect((await POST(signedRequest())).status).toBe(403);
  expect((await responsesPOST(await request(text))).status).toBe(403);
  expect((await responsesPOST(signedRequest())).status).toBe(200);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses');
  expect(fetcher.mock.calls[0][1].body).toBe(text);
});
