import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST as responsesPOST } from '@/app/api/site-assistant/openai/responses/route';
import { POST } from '@/app/api/site-assistant/openai/chat/completions/route';
import { ASSISTANT_OPENAI_RESPONSES_PATH, ASSISTANT_OPENAI_MODEL, assistantOpenAICountrySupported, signAssistantOpenAI, verifyAssistantOpenAI } from '@cuberoot/shared/site-assistant-openai';

const secret = 'fixture-server-relay-secret-at-least-32-chars';
const body = JSON.stringify({ model: ASSISTANT_OPENAI_MODEL, store: false, max_completion_tokens: 4096, messages: [{ role: 'user', content: 'hi' }], stream: true });
beforeEach(() => { vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_REGION', 'iad1'); vi.stubEnv('SITE_ASSISTANT_OPENAI_RELAY_SECRET', secret); vi.stubEnv('OPENAI_API_KEY', 'fixture-openai-key'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function request(text = body, country = 'US') {
  const proof = await signAssistantOpenAI(secret, country, text);
  return new Request('https://fixture.vercel.app/api/site-assistant/openai/chat/completions', { method: 'POST', body: text, headers: { 'x-assistant-country': country, 'x-assistant-proof': proof } });
}

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
it.each([null, '', 'CN', 'HK', 'MO', 'RU', 'IR', 'KP', 'UA', 'ZZ', 'US, CN'])('does not infer eligibility for %s', country => {
  expect(assistantOpenAICountrySupported(country)).toBe(false);
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
