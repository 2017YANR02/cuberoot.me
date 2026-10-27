import { afterEach, describe, expect, it, vi } from 'vitest';
import { assistantRerankConfig, rerankKnowledge } from '../src/utils/site_assistant_rerank.js';
import { startAssistantMonitor } from '../src/utils/site_assistant_monitor.js';
const chunks = Array.from({ length: 8 }, (_, i) => ({ id: `id${i}`, documentId: `zh:/page${i}`, lang: 'zh' as const, href: `/page${i}`, title: `Title ${i}`, content: `Content ${i}`, fingerprint: String(i) }));
const signal = () => new AbortController().signal;
const enable = () => {
  vi.stubEnv('SITE_ASSISTANT_RERANK_ENABLED', '1');
  vi.stubEnv('SITE_ASSISTANT_RERANK_API_KEY', 'test-only');
  vi.stubEnv('SITE_ASSISTANT_RERANK_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
};
afterEach(() => vi.unstubAllEnvs());
describe('optional bounded reranking', () => {
  it('does not call the provider by default or with six or fewer unique passages', async () => {
    vi.stubEnv('SITE_ASSISTANT_RERANK_ENABLED', '0');
    const fetcher = vi.fn();
    expect(await rerankKnowledge('query', chunks, signal(), fetcher)).toEqual(chunks.slice(0, 6));
    enable();
    expect(await rerankKnowledge('query', [chunks[0], chunks[0]], signal(), fetcher)).toEqual([chunks[0]]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('validates trusted origins before sending keys', async () => {
    enable();
    for (const base of ['https://evil.test', 'https://dashscope.aliyuncs.com.evil.test', 'http://dashscope.aliyuncs.com', 'https://name:pw@dashscope.aliyuncs.com', 'https://dashscope.aliyuncs.com/?key=x']) {
      vi.stubEnv('SITE_ASSISTANT_RERANK_BASE_URL', base);
      expect(() => assistantRerankConfig()).toThrow();
      const fetcher = vi.fn();
      expect(await rerankKnowledge('query', chunks, signal(), fetcher)).toEqual(chunks.slice(0, 6));
      expect(fetcher).not.toHaveBeenCalled();
    }
  });
  it('preserves source identities and records verified rerank usage separately', async () => {
    enable();
    const run = vi.fn().mockResolvedValue([]);
    const monitor = await startAssistantMonitor({ uid: 1, question: 'test', lang: 'zh', model: 'fixture', streaming: false, imageCount: 0, historyCount: 0 }, run);
    const fetcher = vi.fn(async (_url: any, init: any) => {
      expect(init.redirect).toBe('error');
      const body = JSON.parse(init.body);
      expect(body.parameters).toEqual({ top_n: 6, return_documents: false });
      expect(body.input.documents).toHaveLength(8);
      return Response.json({ output: { results: [7, 6, 5, 4, 3, 2].map((index, n) => ({ index, relevance_score: 1 - n / 10, document: { href: 'https://evil.test', text: 'forged' } })) }, usage: { total_tokens: 42 } });
    });
    const result = await monitor.run(() => rerankKnowledge('query', chunks, signal(), fetcher));
    expect(result).toEqual([7, 6, 5, 4, 3, 2].map(i => chunks[i]));
    await monitor.finish('success', undefined, { answer: 'ok', sources: [] });
    const metrics = run.mock.calls.find(([statement]) => statement.startsWith('UPDATE'))![1][7];
    expect(metrics).toMatchObject({ reranks: [{ tokens: 42, candidates: 8, status: 'success', tariff: { version: 'bailian-rerank-beijing-2026-10-26' } }], cost: { grossCny: 0.000021, unpricedCalls: 0 } });
  });
  it.each(['denied', 'duplicate', 'out-of-range', 'truncated', 'oversized', 'timeout'])('falls back without retry on %s', async reason => {
    enable();
    const fetcher = vi.fn(async () => {
      if (reason === 'denied') return new Response('', { status: 403 });
      if (reason === 'timeout') throw new DOMException('timeout', 'TimeoutError');
      if (reason === 'oversized') return new Response('x'.repeat(64_001));
      const indices = reason === 'duplicate' ? [0, 0, 2, 3, 4, 5] : reason === 'out-of-range' ? [0, 1, 2, 3, 4, 99] : [0, 1];
      return Response.json({ output: { results: indices.map(index => ({ index, relevance_score: 0.5 })) } });
    });
    expect(await rerankKnowledge('query', chunks, signal(), fetcher)).toEqual(chunks.slice(0, 6));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('propagates caller cancellation instead of returning a fallback answer', async () => {
    enable();
    const controller = new AbortController();
    const fetcher = vi.fn(async () => { controller.abort(); throw new DOMException('aborted', 'AbortError'); });
    await expect(rerankKnowledge('query', chunks, controller.signal, fetcher)).rejects.toThrow();
  });
});
