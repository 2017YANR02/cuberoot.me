import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const monitor = vi.hoisted(() => ({ model: vi.fn(), search: vi.fn(), retrieval: vi.fn() }));
vi.mock('../src/utils/site_assistant_monitor.js', async importOriginal => {
  const original = await importOriginal<typeof import('../src/utils/site_assistant_monitor.js')>();
  return { ...original, recordAssistantModel: () => monitor.model, recordAssistantSearch: () => monitor.search, recordAssistantRetrieval: monitor.retrieval };
});
import { assistantSearchProtectedTerms, assistantWebAvailable, assistantWebConfig, searchAssistantWeb } from '../src/utils/site_assistant_web.js';

const controller = () => new AbortController();
const config = () => {
  vi.stubEnv('SITE_ASSISTANT_API_KEY', 'sk-test-fixture-key-1234567890');
  vi.stubEnv('SITE_ASSISTANT_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
};
const source = (index = 1, href = 'https://example.org/official-update') => ({ index, title: `Official announcement ${index}`, url: href });
const frames = (sources: unknown[], synthesis = 'An update was published [ref_1].', finish = 'stop', relevant = true) => [
  { output: { search_info: { search_results: sources }, choices: [{ message: { content: [] } }] } },
  { output: { choices: [{ message: { content: [{ text: JSON.stringify({ relevant, summary: synthesis }) }] }, finish_reason: finish }] }, usage: { input_tokens: 200, output_tokens: 40, total_tokens: 240, plugins: { search: { count: 1 } } } },
];
const stream = (values: unknown[]) => new Response(values.map(value => `data:${JSON.stringify(value)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
const call = { tool: 'web_search' as const, query: 'WCA official news', recency: 'week' as const };

describe('assistant public web search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of ['SITE_ASSISTANT_WEB_ENABLED','SITE_ASSISTANT_WEB_API_KEY','SITE_ASSISTANT_WEB_BASE_URL','SITE_ASSISTANT_WEB_MODEL','SITE_ASSISTANT_VISION_API_KEY','SITE_ASSISTANT_VISION_BASE_URL','SITE_ASSISTANT_API_KEY','SITE_ASSISTANT_BASE_URL']) vi.stubEnv(key, '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('keeps keys on an exact trusted provider and never mixes half configured pairs', () => {
    config();
    expect(assistantWebConfig()).toMatchObject({ model: 'qwen3.8-flash', endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' });
    vi.stubEnv('SITE_ASSISTANT_WEB_API_KEY', 'different-secret');
    expect(assistantWebAvailable()).toBe(false);
    vi.stubEnv('SITE_ASSISTANT_WEB_BASE_URL', 'https://ws-demo.cn-beijing.maas.aliyuncs.com/compatible-mode/v1');
    expect(assistantWebAvailable()).toBe(true);
    for (const base of ['https://dashscope.aliyuncs.com.evil.test/compatible-mode/v1','https://user@dashscope.aliyuncs.com/compatible-mode/v1','http://dashscope.aliyuncs.com/compatible-mode/v1','https://dashscope.aliyuncs.com:8443/compatible-mode/v1','https://api.deepseek.com/v1','https://dashscope.aliyuncs.com/other']) {
      vi.stubEnv('SITE_ASSISTANT_WEB_BASE_URL', base);
      expect(assistantWebAvailable()).toBe(false);
    }
  });

  it('forces native search, uses actual metadata for citations, and records model and search usage', async () => {
    config();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(stream(frames([source()])));
    const result = await searchAssistantWeb(call, 'zh', { signal: controller().signal, fetcher, today: '2026-10-23' });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
    expect(init).toMatchObject({ redirect: 'error', method: 'POST', headers: { 'X-DashScope-SSE': 'enable' } });
    const request = JSON.parse(String(init?.body));
    expect(request.parameters).toMatchObject({ enable_search: true, enable_thinking: false, incremental_output: true, max_tokens: 1200, search_options: { forced_search: true, enable_source: true, enable_citation: true, search_strategy: 'turbo' } });
    expect(request.input.messages[1].content).toEqual([{ text: call.query }]);
    expect(JSON.stringify(request)).not.toContain('sk-test');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({ href: 'https://example.org/official-update', read: true });
    expect(result.evidence).toMatchObject({ status: 'ok', dateFilterEnforced: false, sources: [{ publishedAt: null, snippet: null }] });
    expect((result.evidence as { synthesis: string }).synthesis).toContain(`[${result.sources[0].id}]`);
    expect(monitor.model).toHaveBeenCalledWith(expect.objectContaining({ inputTokens: 200, outputTokens: 40 }));
    expect(monitor.search).toHaveBeenCalledWith(1);
    expect(monitor.retrieval).toHaveBeenCalledWith(expect.objectContaining({ mode: 'web' }));
  });

  it('does not promote unrelated search metadata when the provider finds no matching evidence', async () => {
    config();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(stream(frames([source()], 'No matching news, but here are unrelated stories [ref_1].', 'stop', false)));
    const result = await searchAssistantWeb(call, 'en', { signal: controller().signal, fetcher });
    expect(result.sources).toEqual([]);
    expect(result.evidence).toMatchObject({ status: 'unavailable', reason: 'no_relevant_evidence' });
    expect(JSON.stringify(result)).not.toContain('unrelated stories');
  });

  it.each([
    ['missing_search_sources', [], 'Looks certain [ref_1]. https://invented.example/story'],
    ['missing_citations', [source()], 'Looks certain but has no matched citations.'],
    ['missing_citations', [source()], 'An answer [ref_7].'],
  ])('does not disguise model memory as searched evidence (%s)', async (reason, sources, synthesis) => {
    config();
    const result = await searchAssistantWeb(call, 'en', { signal: controller().signal, fetcher: vi.fn().mockResolvedValue(stream(frames(sources as unknown[], synthesis as string))) });
    expect(result.sources).toEqual([]);
    expect(result.evidence).toMatchObject({ status: 'unavailable', reason });
    expect(JSON.stringify(result)).not.toContain('Looks certain');
  });

  it('caps and deduplicates cited sources, excludes unsafe URLs, and never promotes prose URLs', async () => {
    config();
    const sources = Array.from({ length: 8 }, (_, i) => source(i + 1, `https://example.org/${i}`));
    sources.push(source(9, 'https://127.0.0.1/private'), source(10, 'https://user:secret@example.org/private'), source(11, 'https://example.org/0'));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(stream(frames(sources, sources.map(s => `A fact [ref_${s.index}].`).join('\n') + '\nhttps://invented.example/path')));
    const result = await searchAssistantWeb(call, 'en', { signal: controller().signal, fetcher });
    expect(result.sources).toHaveLength(6);
    expect(result.sources.every(s => s.href.startsWith('https://example.org/'))).toBe(true);
    expect(JSON.stringify(result.evidence)).not.toContain('https://invented.example');
    expect((result.evidence as { synthesis: string }).synthesis).not.toContain('[unavailable source]');
  });

  it('drops unsupported paragraphs and their unused metadata, rather than leaving uncited factual claims', async () => {
    config();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(stream(frames([source(),source(2, 'https://example.org/second')], 'Uncited claim.\nVerified fact [ref_1].\nUnsupported fact [ref_2][ref_99].')));
    const result = await searchAssistantWeb(call, 'en', { signal: controller().signal, fetcher });
    expect(result.sources).toHaveLength(1);
    expect((result.evidence as { synthesis: string }).synthesis).toBe(`Verified fact [${result.sources[0].id}].`);
  });

  it.each(['api_key=secret-value','Bearer secret-token','sk-1234567890123456','please find me@example.org','call +1 415 555 1234','https://localhost/admin','https://example.org?token=secret','data:image/png;base64,abc','a'.repeat(150),'x'.repeat(301)])('rejects private or oversized query before a paid call: %s', async query => {
    config();
    const fetcher = vi.fn<typeof fetch>();
    const result = await searchAssistantWeb({ ...call, query }, 'en', { signal: controller().signal, fetcher });
    expect(result.evidence).toMatchObject({ status: 'unavailable', reason: 'public_query_required' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(monitor.model).not.toHaveBeenCalled();
  });

  it('keeps known identity and credentials extracted from context out of public search', async () => {
    config();
    const protectedTerms = assistantSearchProtectedTerms(['My API-Key="private-value-123". Password: swordfish', 'Bearer session-secret-123'], '2017YANR02');
    expect(protectedTerms).toEqual(expect.arrayContaining(['2017YANR02','private-value-123','swordfish','session-secret-123']));
    const fetcher = vi.fn<typeof fetch>();
    for (const query of ['2017YANR02 current results', 'search private-value-123', 'swordfish problems', 'session-secret-123']) {
      const result = await searchAssistantWeb({ ...call, query }, 'en', { signal: controller().signal, fetcher, protectedTerms });
      expect(result.evidence).toMatchObject({ status: 'unavailable', reason: 'public_query_required' });
      expect(JSON.stringify(result)).not.toContain('swordfish');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('offers an explicit unavailable result when configuration is disabled', async () => {
    config(); vi.stubEnv('SITE_ASSISTANT_WEB_ENABLED', '0');
    const fetcher = vi.fn<typeof fetch>();
    const result = await searchAssistantWeb(call, 'en', { signal: controller().signal, fetcher });
    expect(result.evidence).toMatchObject({ status: 'unavailable', reason: 'not_configured' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not return truncated or oversized provider output as factual evidence', async () => {
    config();
    for (const response of [stream(frames([source()], 'Truncated [ref_1]', 'length')), stream([{ padding: 'x'.repeat(512_001) }])]) {
      const result = await searchAssistantWeb(call, 'en', { signal: controller().signal, fetcher: vi.fn().mockResolvedValue(response) });
      expect(result.sources).toEqual([]);
      expect(result.evidence).toMatchObject({ status: 'unavailable' });
    }
  });

  it('does not expose provider errors or retry denied requests', async () => {
    config();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('secret upstream body', { status: 403 }));
    const result = await searchAssistantWeb(call, 'en', { signal: controller().signal, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.evidence).toMatchObject({ status: 'unavailable', reason: 'provider_access' });
    expect(JSON.stringify(result)).not.toContain('secret upstream');
  });

  it('preserves caller cancellation instead of converting it into a search result', async () => {
    config();
    const abort = controller(); abort.abort(new Error('User cancelled'));
    const fetcher = vi.fn<typeof fetch>();
    await expect(searchAssistantWeb(call, 'en', { signal: abort.signal, fetcher })).rejects.toThrow('User cancelled');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
