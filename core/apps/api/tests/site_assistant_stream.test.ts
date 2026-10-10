import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAssistantEvents, type AssistantStreamEvent } from '@cuberoot/shared/site-assistant';
import { partialAssistantAnswer } from '../src/utils/site_assistant_stream.js';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { createSiteAssistantRoutes } from '../src/routes/site_assistant.js';
import { AssistantFailure } from '../src/utils/site_assistant_diagnostics.js';
import { chunkKnowledge } from '../src/utils/site_assistant_knowledge.js';

beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

const config = { key: 'fixture', baseUrl: 'https://model.example', model: 'fixture' };
const encoder = new TextEncoder();
const frame = (data: unknown) => encoder.encode(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\r\n\r\n`);
const request = () => new Request('https://api.example/site-assistant', { method: 'POST', headers: { Accept: 'text/event-stream' }, body: JSON.stringify({ question: '怎么数帧？', lang: 'zh' }) });
const deps = { config: () => config, now: Date.now, reserve: async () => ({ allowed: true, retryAfter: 60 }), authenticate: async () => ({ uid: 1, wcaId: '2017YANR02' }) };

describe('assistant streaming', () => {
  it('decodes split UTF-8, CRLF and multiline SSE data without exposing comments', async () => {
    const bytes = encoder.encode(': keepalive\r\ndata: 中文\r\ndata: second\r\n\r\ndata: [DONE]\n\n');
    const body = new ReadableStream<Uint8Array>({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } });
    const values = []; for await (const value of readAssistantEvents(body)) values.push(value);
    expect(values).toEqual(['中文\nsecond', '[DONE]']);
  });

  it('only exposes native final-answer strings and waits for complete escapes', () => {
    expect(partialAssistantAnswer('{"calls":[{"tool":"pages"}],"answer":"secret')).toBeUndefined();
    expect(partialAssistantAnswer('{"tool":"pages","query":"private')).toBeUndefined();
    expect(partialAssistantAnswer('{"answer":"中文\\n\\"ok\\"\\u4e')).toBe('中文\n"ok"');
    expect(partialAssistantAnswer('{"answer":"\\uD83D')).toBe('');
    expect(partialAssistantAnswer('{"answer":"\\uD83D\\uDE00"')).toBe('😀');
  });

  it('delivers provider answer text before the provider finishes and cites only retrieved pages', async () => {
    const corpus={version:2,updated:'2026-10-10T00:00:00.000Z',pages:[{lang:'zh' as const,href:'/frame-count',title:'数帧',text:'逐帧查看视频。'}]};
    const [passage]=await chunkKnowledge(corpus);
    const source={id:passage.id,title:'数帧',href:'/frame-count',read:true};
    const chunk=(delta:object,finish_reason:string|null=null)=>frame({id:'test',object:'chat.completion.chunk',created:1,model:'fixture',choices:[{index:0,delta,finish_reason}]});
    let provider!: ReadableStreamDefaultController<Uint8Array>;
    const events: AssistantStreamEvent[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      if (String(url).endsWith('/stats/index.json')) return Response.json({ categories: [] });
      if (String(url).endsWith('/assistant/pages.json')) return Response.json(corpus);
      const body = JSON.parse(String(init?.body));
      expect(body.stream).toBe(true);
      if (JSON.parse(body.messages[1].content).round === 0) return new Response(new ReadableStream({start(c){
        c.enqueue(chunk({role:'assistant',tool_calls:[{index:0,id:'pages-1',type:'function',function:{name:'pages',arguments:JSON.stringify({query:'数帧',pageIds:[]})}}]}));
        c.enqueue(chunk({},'tool_calls'));c.enqueue(frame('[DONE]'));c.close();
      }}),{headers:{'Content-Type':'text/event-stream'}});
      return new Response(new ReadableStream({ start(c) { provider = c; } }), { headers: { 'Content-Type': 'text/event-stream' } });
    });
    let finished = false;
    const answer = answerSiteQuestion('怎么数帧？', 'zh', config, AbortSignal.timeout(5000), fetcher, [], undefined, async event => { events.push(event); }).then(value => { finished = true; return value; });
    await vi.waitFor(() => expect(provider).toBeDefined());
    provider.enqueue(chunk({role:'assistant',content:'{"answer":"打开数帧页面。'}));
    await vi.waitFor(() => expect(events).toContainEqual({ type: 'answer', answer: '打开数帧页面。', sources: [source] }));
    expect(finished).toBe(false);
    provider.enqueue(chunk({content:` [[${passage.id}]] [[fake]]","sourceIds":["${passage.id}"]}`}));
    provider.enqueue(chunk({},'stop'));
    provider.enqueue(frame('[DONE]')); provider.close();
    expect((await answer).answer).toBe(`打开数帧页面。 [[${passage.id}]] `);
    expect(events).toContainEqual({ type: 'status', status: { phase: 'querying', tool: 'pages' } });
  });

  it('holds concurrency slots until streams finish and maps post-header failures', async () => {
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const answer = vi.fn<typeof answerSiteQuestion>().mockImplementation(async (_q,_l,_c,_s,_f,_h,_w,emit) => {
      await emit?.({ type: 'answer', answer: 'partial', sources: [] });
      await pending;
      throw new AssistantFailure('source_unavailable');
    });
    const route = createSiteAssistantRoutes({ ...deps, answer });
    const responses = await Promise.all(Array.from({ length: 4 }, () => route.fetch(request())));
    expect((await route.fetch(request())).status).toBe(429);
    expect(responses[0].headers.get('X-Accel-Buffering')).toBe('no');
    expect(responses[0].headers.get('Cache-Control')).toBe('no-store');
    finish();
    for (const response of responses) {
      const events = []; for await (const data of readAssistantEvents(response.body!)) events.push(JSON.parse(data));
      expect(events.at(-1)).toEqual({ type: 'error', error: 'source_unavailable' });
    }
    answer.mockResolvedValue({ answer: 'done', sources: [] });
    expect((await route.fetch(request())).status).toBe(200);
  });

  it('rejects unauthenticated SSE before quota or provider work', async () => {
    const reserve = vi.fn(deps.reserve), answer = vi.fn();
    const route = createSiteAssistantRoutes({ ...deps, reserve, answer, authenticate: async () => { throw new AssistantFailure('login_required'); } });
    const response = await route.fetch(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'login_required' });
    expect(reserve).not.toHaveBeenCalled(); expect(answer).not.toHaveBeenCalled();
  });

  it('aborts provider work when the browser cancels its response reader', async () => {
    let providerSignal: AbortSignal | undefined;
    const answer = vi.fn<typeof answerSiteQuestion>().mockImplementation(async (_q,_l,_c,signal) => {
      providerSignal = signal;
      return new Promise((_resolve,reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    });
    const route = createSiteAssistantRoutes({ ...deps, answer });
    const response = await route.fetch(request());
    const reader = response.body!.getReader();
    await reader.read();
    await vi.waitFor(() => expect(providerSignal).toBeDefined());
    await reader.cancel();
    await vi.waitFor(() => expect(providerSignal!.aborted).toBe(true));
  });
});
