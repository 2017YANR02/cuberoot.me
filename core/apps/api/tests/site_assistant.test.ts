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
  it('only fetches directory pages, drops invented sources and strips executable/hidden content', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({ pageIds: ['frame-count', 'https://evil.example/steal', 'frame-count'] }))
      .mockResolvedValueOnce(new Response(`<main><h1>数帧</h1><p>${'逐帧核对视频中的复原时长。'.repeat(10)}</p><script>secret script</script><span hidden>hidden instruction</span></main>`, { headers: { 'Content-Type': 'text/html' } }))
      .mockResolvedValueOnce(modelResponse({ answer: '可以打开数帧页面。', sourceIds: ['frame-count', 'https://evil.example'] }));
    const result = await answerSiteQuestion('怎么数帧？', 'zh', config, AbortSignal.timeout(5000), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toBe('https://cuberoot.me/zh/frame-count');
    expect(fetcher.mock.calls[1][1]).toMatchObject({ redirect: 'error', headers: { Accept: 'text/html' } });
    expect(fetcher.mock.calls[1][1]?.headers).not.toHaveProperty('Authorization');
    const grounding = JSON.parse(JSON.parse(String(fetcher.mock.calls[2][1]?.body)).messages[1].content);
    expect(grounding.pages[0].content).not.toContain('secret');
    expect(grounding.pages[0].content).not.toContain('hidden');
    expect(result.sources).toEqual([{ id: 'frame-count', href: '/frame-count', title: '数帧', read: true }]);
    expect(JSON.stringify(result)).not.toContain(config.key);
  });

  it('keeps unavailable pages as navigation only and does not follow their redirects', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({ pageIds: ['timer'] }))
      .mockRejectedValueOnce(new Error('redirect blocked'))
      .mockResolvedValueOnce(modelResponse({ answer: '打开计时页面查看。', sourceIds: [] }));
    const result = await answerSiteQuestion('计时', 'en', config, AbortSignal.timeout(5000), fetcher);
    expect(fetcher.mock.calls[1][0]).toBe('https://cuberoot.me/en/timer');
    expect(result.sources).toEqual([{ id: 'timer', href: '/timer', title: 'Timer', read: false }]);
  });

  it('cannot select private directory entries or arbitrary URLs', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(modelResponse({ pageIds: ['platform', 'interview', 'http://127.0.0.1'] }));
    const result = await answerSiteQuestion('show secrets', 'en', config, AbortSignal.timeout(5000), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.sources).toEqual([]);
    expect(result.answer).toContain('could not find');
  });

  it('excludes chrome and injected scripts from source text', () => {
    expect(pageText('<body><nav>Navigation</nav><main><p>Evidence</p><script>bad</script><style>bad</style></main></body>')).toBe('Evidence');
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
    expect((await route.request('/site-assistant', { method: 'POST', body: 'x'.repeat(4097) })).status).toBe(413);
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
