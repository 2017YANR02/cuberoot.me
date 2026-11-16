import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSiteAssistantRoutes } from '../src/routes/site_assistant.js';
import { assistantConfig, type AssistantConfig } from '../src/utils/site_assistant.js';
import { createAssistantModel } from '../src/utils/site_assistant_model.js';
import { ASSISTANT_OPENAI_RESPONSES_PATH, ASSISTANT_OPENAI_MODEL, verifyAssistantOpenAI } from '@cuberoot/shared/site-assistant-openai';
function modelResponse(value: unknown) {
  const output = Array.isArray(value)
    ? value.map((call, index) => ({ type: 'function_call', id: `fc_${index}`, call_id: `call_${index}`, name: call.tool, arguments: JSON.stringify(Object.fromEntries(Object.entries(call).filter(([key]) => key !== 'tool'))) }))
    : [{ type: 'message', id: 'msg_fixture', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [] }] }];
  return Response.json({ id: 'resp_fixture', object: 'response', created_at: 1, status: 'completed', model: ASSISTANT_OPENAI_MODEL, output, usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } });
}

const relaySecret = 'fixture-relay-secret-at-least-32-characters';
const openai: AssistantConfig = { provider: 'openai', key: relaySecret, baseUrl: 'https://fixture.vercel.app/api/site-assistant/openai', model: ASSISTANT_OPENAI_MODEL, visitorCountry: 'US' };
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function routes(country: string | null) {
  const answer = vi.fn().mockResolvedValue({ answer: 'ok', sources: [], artifacts: [] });
  const reserve = vi.fn().mockResolvedValue({ allowed: true, retryAfter: 60 });
  const locate = vi.fn().mockResolvedValue(country);
  const config = vi.fn((_vision = false, provider?: 'bailian' | 'openai') => provider === 'openai' ? { ...openai } : { key: 'bailian', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.8-flash' });
  return { answer, reserve, locate, config, app: createSiteAssistantRoutes({ answer, config, country: locate, reserve, authenticate: async () => ({ uid: 1, wcaId: '2017YANR02' }), now: Date.now }) };
}

describe('assistant provider admission', () => {
  it.each(['CN', 'HK', 'MO', 'RU', 'IR', 'UA', null])('denies OpenAI for %s before quota or model calls, regardless of forged country headers', async country => {
    const { app, answer, reserve, locate } = routes(country);
    const response = await app.request('/site-assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': '1.2.3.4', 'x-vercel-ip-country': 'US', 'cf-ipcountry': 'US', 'x-assistant-country': 'US' }, body: JSON.stringify({ question: 'hi', lang: 'en', provider: 'openai' }) });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'provider_region_unavailable' });
    expect(locate).toHaveBeenCalledWith('1.2.3.4');
    expect(answer).not.toHaveBeenCalled(); expect(reserve).not.toHaveBeenCalled();
  });
  it('admits supported visitors and binds the verified region to the model config', async () => {
    const { app, answer, reserve } = routes('us');
    expect((await app.request('/site-assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'hi', lang: 'en', provider: 'openai' }) })).status).toBe(200);
    expect(answer.mock.calls[0][2]).toMatchObject({ provider: 'openai', visitorCountry: 'US' });
    expect(reserve).toHaveBeenCalledTimes(1);
  });
  it('keeps Bailian available without GeoIP and does not share-cache provider choices', async () => {
    const { app, answer, config } = routes(null);
    const choices = await app.request('/site-assistant/providers');
    expect(choices.headers.get('cache-control')).toBe('private, no-store');
    expect(await choices.json()).toEqual({ providers: ['bailian'] });
    const result = await app.request('/site-assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'hi', lang: 'zh' }) });
    expect(result.status).toBe(200); expect(config).toHaveBeenLastCalledWith(false, 'bailian'); expect(answer).toHaveBeenCalledTimes(1);
  });
  it('shows OpenAI only where eligible and configured', async () => {
    const { app, config } = routes('US');
    expect(await (await app.request('/site-assistant/providers')).json()).toEqual({ providers: ['bailian', 'openai'] });
    config.mockImplementation((_vision, provider) => provider === 'openai' ? null! : { key: 'test', baseUrl: 'https://example.com', model: 'test' });
    expect(await (await app.request('/site-assistant/providers')).json()).toEqual({ providers: ['bailian'] });
  });
  it('requires explicit activation and a Vercel origin without sending the OpenAI key to Hangzhou', () => {
    vi.stubEnv('SITE_ASSISTANT_OPENAI_ENABLED', '0');
    vi.stubEnv('OPENAI_API_KEY', 'must-not-be-used-here');
    vi.stubEnv('SITE_ASSISTANT_OPENAI_RELAY_SECRET', relaySecret);
    vi.stubEnv('SITE_ASSISTANT_OPENAI_RELAY_ORIGIN', 'https://fixture.vercel.app');
    expect(assistantConfig(false, 'openai')).toBeNull();
    vi.stubEnv('SITE_ASSISTANT_OPENAI_ENABLED', '1');
    expect(assistantConfig(true, 'openai')).toMatchObject({ key: relaySecret, provider: 'openai', model: ASSISTANT_OPENAI_MODEL });
    vi.stubEnv('SITE_ASSISTANT_OPENAI_RELAY_ORIGIN', 'https://google-api.cuberoot.me');
    expect(assistantConfig(false, 'openai')?.baseUrl).toBe('https://google-api.cuberoot.me/api/site-assistant/openai');
    for (const origin of ['https://www.cuberoot.me', 'https://cuberoot.me', 'https://google-api.cuberoot.me.evil.com', 'http://fixture.vercel.app', 'https://fixture.vercel.app/?target=elsewhere', 'https://fixture.vercel.app@evil.com']) {
      vi.stubEnv('SITE_ASSISTANT_OPENAI_RELAY_ORIGIN', origin);
      expect(assistantConfig(false, 'openai')).toBeNull();
    }
  });
});

it.each([false, true])('uses Responses with tools and signed continuation when thinking=%s', async thinking => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(modelResponse([{ tool: 'navigation', query: 'timer' }]))
    .mockResolvedValueOnce(modelResponse({ answer: 'Ready', sourceIds: [] }));
  const model = createAssistantModel(openai, fetcher, AbortSignal.timeout(5000), 'navigation Find a page');
  const base = { system: 'Help the user.', context: {}, finalOnly: false, thinking, effort: 'high' as const, maxTokens: 4096 };
  const plan = await model.complete(base);
  expect(plan.calls).toHaveLength(1);
  model.record(plan.calls[0], { answer: 'timer' });
  expect((await model.complete({ ...base, finalOnly: true })).answer).toBe('Ready');
  for (const [url, init] of fetcher.mock.calls) {
    expect(url).toBe(openai.baseUrl + '/responses');
    const headers = new Headers(init?.headers), body = String(init?.body), wire = JSON.parse(body);
    expect(headers.has('authorization')).toBe(false);
    expect(await verifyAssistantOpenAI(relaySecret, 'US', body, headers.get('x-assistant-proof')!, Date.now(), ASSISTANT_OPENAI_RESPONSES_PATH)).toBe(true);
    expect(wire).toMatchObject({ model: ASSISTANT_OPENAI_MODEL, store: false, reasoning: { effort: thinking ? 'high' : 'none' }, text: { format: { type: 'json_schema' } } });
    expect(wire.enable_thinking).toBeUndefined();
    expect(wire.max_output_tokens).toBe(4096);
  }
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).input.some((m: { type: string }) => m.type === 'function_call_output')).toBe(true);
});

it('streams an OpenAI image answer with bounded reasoning and propagates cancellation', async () => {
  const json = JSON.stringify({ answer: 'A cube.', sourceIds: [] });
  const frame = (value: object) => `data: ${JSON.stringify(value)}\n\n`;
  const output = { type: 'message', id: 'msg_fixture', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: json, annotations: [] }] };
  const events = [
    { type: 'response.created', response: { id: 'resp_fixture', model: ASSISTANT_OPENAI_MODEL, created_at: 1 } },
    { type: 'response.output_item.added', output_index: 0, item: { ...output, content: [] } },
    { type: 'response.content_part.added', item_id: 'msg_fixture', output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } },
    { type: 'response.output_text.delta', item_id: 'msg_fixture', output_index: 0, content_index: 0, delta: json },
    { type: 'response.output_item.done', output_index: 0, item: output },
    { type: 'response.completed', response: { id: 'resp_fixture', status: 'completed', output: [output], usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } } },
  ];
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(events.map(frame).join(''), { headers: { 'Content-Type': 'text/event-stream' } }));
  const controller = new AbortController();
  const model = createAssistantModel(openai, fetcher, controller.signal, '', [], [{ mediaType: 'image/png', data: 'aGVsbG8=' }]);
  const onText = vi.fn().mockResolvedValue(undefined);
  expect((await model.complete({ system: 'Describe the image.', context: {}, finalOnly: true, thinking: true, effort: 'high', maxTokens: 999999, onText })).answer).toBe('A cube.');
  const wire = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(wire).toMatchObject({ stream: true, reasoning: { effort: 'high' }, max_output_tokens: 16384 });
  expect(wire.input.at(-1).content).toContainEqual({ type: 'input_image', image_url: 'data:image/png;base64,aGVsbG8=' });
  expect(onText).toHaveBeenLastCalledWith(json);
  expect(fetcher.mock.calls[0][1]?.signal).toBe(controller.signal);
});
