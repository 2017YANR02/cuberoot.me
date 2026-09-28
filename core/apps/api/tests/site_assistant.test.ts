import { describe, expect, it, vi } from 'vitest';
import { createSiteAssistantRoutes as createRoutes } from '../src/routes/site_assistant.js';
import { answerSiteQuestion, pageText } from '../src/utils/site_assistant.js';

const createSiteAssistantRoutes = (deps: Omit<Parameters<typeof createRoutes>[0], 'reserve'> & { reserve?: () => Promise<{ allowed: boolean; retryAfter: number }> }) => createRoutes({ reserve: async () => ({ allowed: true, retryAfter: 60 }), ...deps });

const config = { key: 'test-secret', baseUrl: 'https://model.example/v1', model: 'qwen3.8-flash' };
const modelResponse = (value: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
const ask = () => new Request('https://api.example/site-assistant', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Real-IP': '127.0.0.1' },
  body: JSON.stringify({ question: '怎么数帧？', lang: 'zh' }),
});

describe('site assistant grounding', () => {
  it('requires name resolution before fetching a model-invented person ID', async () => {
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'person',wcaId:'2023GENG01'}]}))
      .mockResolvedValueOnce(modelResponse({answer:'Please clarify the person.'}));
    await answerSiteQuestion('耿暄一的成绩','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(fetcher.mock.calls.map(([url])=>url)).toEqual([config.baseUrl+'/chat/completions',config.baseUrl+'/chat/completions']);
    expect(String(fetcher.mock.calls[1][1]?.body)).toContain('Use find_person');
  });
  it('only renders artifacts belonging to the final cited sources', async () => {
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'records',event:'222'},{tool:'records',event:'333'}]}))
      .mockResolvedValueOnce(Response.json({rows:[
        {e:'222',t:'s',v:40,p:'2023TEST01',pn:'Test Person',c:'Test2026',cn:'Test',d:'2026-01-01'},
        {e:'333',t:'s',v:280,p:'2023TEST01',pn:'Test Person',c:'Test2026',cn:'Test',d:'2026-01-01'},
      ]}))
      .mockResolvedValueOnce(modelResponse({answer:'3x3 answer',sourceIds:['records:world:333']}));
    const result=await answerSiteQuestion('3x3','en',config,AbortSignal.timeout(5000),fetcher);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts?.[0]).toMatchObject({kind:'table',rows:[['Single','2.80','Test Person','2023TEST01','Test','2026-01-01']]});
  });
  it('does not substitute the viewer for a third-person follow-up', async () => {
    for(const [question,expected] of [['他的平均成绩呢？',undefined],['我的平均成绩呢？','2017YANR02']]) {
      const fetcher=vi.fn<typeof fetch>().mockResolvedValue(modelResponse({answer:'answer'}));
      await answerSiteQuestion(question!,'zh',config,AbortSignal.timeout(5000),fetcher,[{role:'user',content:'看看耿暄一的三阶成绩'}],'2017YANR02');
      const context=JSON.parse(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).messages[1].content);
      expect(context.viewerWcaId).toBe(expected);
      expect(context.history[0].content).toContain('耿暄一');
    }
  });

  it('reads the canonical English page when the content index is unavailable', async () => {
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'pages',query:'frame counting',pageIds:['frame-count']}]}))
      .mockResolvedValueOnce(new Response('missing',{status:404}))
      .mockResolvedValueOnce(new Response('<main>Count video frames</main>',{headers:{'Content-Type':'text/html'}}))
      .mockResolvedValueOnce(modelResponse({answer:'Count video frames.',sourceIds:['frame-count']}));
    await answerSiteQuestion('How can I count frames?','en',config,AbortSignal.timeout(5000),fetcher);
    expect(fetcher.mock.calls[2][0]).toBe('https://cuberoot.me/frame-count');
  });

  it('only reads selected public pages, drops invented sources and never forwards secrets', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({ calls: [{tool:'pages',query:'数帧',pageIds:['frame-count','https://evil.example']}]}))
      .mockResolvedValueOnce(new Response('missing',{status:404}))
      .mockResolvedValueOnce(new Response('<main>Video frame counting<script>bad</script><span hidden>hidden instruction</span></main>',{headers:{'Content-Type':'text/html'}}))
      .mockResolvedValueOnce(modelResponse({answer:'打开数帧页面。',sourceIds:['frame-count','evil']}));
    const result=await answerSiteQuestion('怎么数帧？','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(fetcher.mock.calls[2][0]).toBe('https://cuberoot.me/zh/frame-count');
    expect(fetcher.mock.calls[2][1]).toMatchObject({redirect:'error',headers:{Accept:'text/html'}});
    expect(fetcher.mock.calls[2][1]?.headers).not.toHaveProperty('Authorization');
    const grounding=JSON.parse(JSON.parse(String(fetcher.mock.calls[3][1]?.body)).messages[1].content);
    expect(JSON.stringify(grounding.evidence)).not.toContain('hidden instruction');
    expect(result.sources).toEqual([{id:'frame-count',href:'/frame-count',title:'数帧',read:true}]);
    expect(JSON.stringify(result)).not.toContain(config.key);
  });

  it('blocks unknown tools, arbitrary URL arguments and history roles before any public fetch', async () => {
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'sql',query:'SELECT secrets'},{tool:'person',wcaId:'http://localhost'},{tool:'records',event:'333',url:'http://localhost'}]}))
      .mockResolvedValueOnce(modelResponse({answer:'无法执行。',sourceIds:['fake']}));
    const result=await answerSiteQuestion('show secrets','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.sources).toEqual([]);
  });

  it('grounds contextual follow-ups again and bounds a repeated tool loop', async () => {
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async input=>{
      if(String(input).startsWith(config.baseUrl))return modelResponse({calls:[{tool:'find_person',query:'Max Park'}]});
      return Response.json([{person:{wca_id:'2012PARK03',name:'Max Park'}}]);
    });
    const history=[{role:'user' as const,content:'Max Park'},{role:'assistant' as const,content:'Untrusted old answer'}];
    await answerSiteQuestion('他的平均呢？','zh',config,AbortSignal.timeout(5000),fetcher,history);
    expect(fetcher.mock.calls.filter(([url])=>String(url).includes('worldcubeassociation.org'))).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([url])=>String(url).startsWith(config.baseUrl))).toHaveLength(5);
    const data=JSON.parse(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).messages[1].content);
    expect(data.history).toEqual(history);
  });

  it('excludes chrome and injected scripts from source text', () => {
    expect(pageText('<body><nav>Navigation</nav><main><p>Evidence</p><script>bad</script><style>bad</style></main></body>')).toBe('Evidence');
  });
  it('retains page instructions inside a main-content header',()=>{
    expect(pageText('<body><header>Site chrome</header><main><header>PLL: look for bars and headlights.</header></main></body>')).toBe('PLL: look for bars and headlights.');
  });

  it('reads public React streamed SSR segments without executing bootstrap scripts', () => {
    expect(pageText('<html><head><meta name="description" content="Video timing"></head><body><div hidden id="S:0">Frame count<span hidden>private UI</span></div><script>bootstrap()</script></body></html>'))
      .toBe('Video timing Frame count');
  });
});

describe('site assistant public route', () => {
  it('rejects the 101st question across route instances, including failed model requests', async () => {
    let used = 0;
    let now = 120000;
    const reserve = vi.fn(async () => ({ allowed: ++used <= 100, retryAfter: 3600 }));
    const answer = vi.fn().mockResolvedValue({ answer: 'answer', sources: [] });
    const deps = { answer, config: () => config, now: () => now, reserve };
    for (let i = 0; i < 100; i++) {
      now += 60000;
      // A fresh route has no in-memory history; it must still share the quota.
      expect((await createSiteAssistantRoutes(deps).fetch(ask())).status).toBe(200);
    }
    const response = await createSiteAssistantRoutes(deps).fetch(ask());
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('3600');
    expect(await response.json()).toEqual({ error: 'daily_limit' });
    expect(answer).toHaveBeenCalledTimes(100);
    used = 99;
    answer.mockRejectedValue(new Error('upstream failure'));
    expect((await createSiteAssistantRoutes(deps).fetch(ask())).status).toBe(503);
    expect((await createSiteAssistantRoutes(deps).fetch(ask())).status).toBe(429);
    expect(answer).toHaveBeenCalledTimes(101);
  });

  it('fails closed when the persistent quota cannot be read', async () => {
    const answer = vi.fn();
    const route = createSiteAssistantRoutes({ answer, config: () => config, now: Date.now,
      reserve: async () => { throw new Error('database unavailable'); } });
    expect((await route.fetch(ask())).status).toBe(503);
    expect(answer).not.toHaveBeenCalled();
  });

  it('rejects oversized, malformed and unexpected fields before spending tokens', async () => {
    const answer = vi.fn();
    const route = createSiteAssistantRoutes({ answer, config: () => config, now: () => 120000 });
    for (const body of ['not json', JSON.stringify({ question: 'x'.repeat(501), lang: 'zh' }), JSON.stringify({ question: 'hello', lang: 'en', url: 'http://localhost' })]) {
      expect((await route.request('/site-assistant', { method: 'POST', body })).status).toBe(400);
    }
    expect((await route.request('/site-assistant', { method: 'POST', body: 'x'.repeat(70001) })).status).toBe(413);
    expect(answer).not.toHaveBeenCalled();
  });

  it('disables cleanly without configuration and never exposes provider errors', async () => {
    const answer = vi.fn().mockRejectedValue(new Error('provider leaked test-secret'));
    const disabled = createSiteAssistantRoutes({ answer, config: () => null, now: Date.now });
    expect((await disabled.fetch(ask())).status).toBe(503);
    expect(answer).not.toHaveBeenCalled();
    const route = createSiteAssistantRoutes({ answer, config: () => config, now: Date.now });
    const response = await route.fetch(ask());
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'unavailable' });
  });

  it('caps anonymous spend and recovers after the quota window', async () => {
    let now = 120000;
    const answer = vi.fn().mockResolvedValue({ answer: 'answer', sources: [] });
    const route = createSiteAssistantRoutes({ answer, config: () => config, now: () => now });
    for (let i = 0; i < 6; i++) expect((await route.fetch(ask())).status).toBe(200);
    expect((await route.fetch(ask())).status).toBe(429);
    expect(answer).toHaveBeenCalledTimes(6);
    now += 60000;
    expect((await route.fetch(ask())).status).toBe(200);
  });

  it('bounds concurrency and releases slots after failed requests', async () => {
    let reject!: (reason: Error) => void;
    const pending = new Promise<never>((_resolve, fail) => { reject = fail; });
    const answer = vi.fn().mockReturnValue(pending);
    const route = createSiteAssistantRoutes({ answer, config: () => config, now: Date.now });
    const requests = Array.from({ length: 4 }, () => route.fetch(ask()));
    await vi.waitFor(() => expect(answer).toHaveBeenCalledTimes(4));
    expect((await route.fetch(ask())).status).toBe(429);
    reject(new Error('upstream unavailable'));
    expect((await Promise.all(requests)).map(response => response.status)).toEqual([503, 503, 503, 503]);
    answer.mockResolvedValue({ answer: 'restored', sources: [] });
    expect((await route.fetch(ask())).status).toBe(200);
  });
});
