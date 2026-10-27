import { z } from 'zod';
import type { KnowledgeChunk } from './site_assistant_knowledge.js';
import { recordAssistantRerank } from './site_assistant_monitor.js';

/** Opt-in until a held-out comparison justifies latency and cost. */
export function assistantRerankConfig() {
  if (process.env.SITE_ASSISTANT_RERANK_ENABLED !== '1') return null;
  if (!!process.env.SITE_ASSISTANT_RERANK_API_KEY !== !!process.env.SITE_ASSISTANT_RERANK_BASE_URL) throw new Error('Configure rerank key and base URL together');
  const key = process.env.SITE_ASSISTANT_RERANK_API_KEY || process.env.SITE_ASSISTANT_EMBEDDING_API_KEY || process.env.SITE_ASSISTANT_API_KEY;
  const base = process.env.SITE_ASSISTANT_RERANK_BASE_URL || process.env.SITE_ASSISTANT_EMBEDDING_BASE_URL || process.env.SITE_ASSISTANT_BASE_URL;
  if (!key || !base) return null;
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || !(url.hostname === 'dashscope.aliyuncs.com' || /^ws-[a-z0-9]+\.cn-beijing\.maas\.aliyuncs\.com$/.test(url.hostname))) throw new Error('Unsupported rerank endpoint');
  return { key, endpoint: `${url.origin}/api/v1/services/rerank/text-rerank/text-rerank`, model: 'qwen3-rerank' };
}

const responseSchema = z.object({
  output: z.object({ results: z.array(z.object({ index: z.number().int().nonnegative(), relevance_score: z.number().finite().min(0).max(1) })).max(6) }),
  usage: z.object({ total_tokens: z.number().int().nonnegative() }).optional(),
});

/** Public passages only. Preserve caller-owned IDs and URLs; ignore provider text. */
export async function rerankKnowledge(query: string, candidates: KnowledgeChunk[], signal: AbortSignal,
  fetcher: typeof fetch = fetch, timeoutMs = 2500): Promise<KnowledgeChunk[]> {
  signal.throwIfAborted();
  const unique = [...new Map(candidates.map(chunk => [chunk.id, chunk])).values()].slice(0, 40);
  const fallback = unique.slice(0, 6);
  if (unique.length <= 6 || !query.trim()) return fallback;
  let config: ReturnType<typeof assistantRerankConfig>;
  try { config = assistantRerankConfig(); } catch { return fallback; }
  if (!config) return fallback;
  const started = performance.now();
  const finish = recordAssistantRerank(config.model, unique.length, new URL(config.endpoint).origin);
  let tokens: number | undefined;
  try {
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, Math.min(5000, timeoutMs)))]);
    const response = await fetcher(config.endpoint, {
      method: 'POST', redirect: 'error', signal: deadline,
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, input: { query: query.slice(0, 500), documents: unique.map(chunk => `${chunk.title}\n${chunk.content}`.slice(0, 2000)) }, parameters: { top_n: 6, return_documents: false } }),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`http_${response.status}`); }
    if (!response.body) throw new Error('invalid_response');
    const reader = response.body.getReader();
    let bytes = 0, text = '';
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 64_000) throw new Error('invalid_response');
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    const parsed = responseSchema.parse(JSON.parse(text));
    tokens = parsed.usage?.total_tokens;
    const results = parsed.output.results;
    if (results.length !== 6 || new Set(results.map(r => r.index)).size !== 6 || results.some(r => r.index >= unique.length)) throw new Error('invalid_response');
    signal.throwIfAborted();
    finish('success', Math.round(performance.now() - started), tokens);
    // RRF and rerank scores use different scales. Never overwrite an RRF score.
    return [...results].sort((a, b) => b.relevance_score - a.relevance_score).map(r => unique[r.index]);
  } catch (error) {
    const reason = signal.aborted ? 'cancelled' : error instanceof Error && /^http_\d{3}$/.test(error.message) ? error.message
      : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'invalid_or_unavailable';
    finish(reason, Math.round(performance.now() - started), tokens);
    signal.throwIfAborted();
    return fallback;
  }
}
