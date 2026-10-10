import { APICallError, embedMany } from 'ai';
import { setTimeout as delay } from 'node:timers/promises';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { KNOWLEDGE_DIMENSIONS } from './site_assistant_knowledge.js';

export function assistantEmbeddingConfig() {
  const key = process.env.SITE_ASSISTANT_EMBEDDING_API_KEY || process.env.SITE_ASSISTANT_API_KEY;
  const baseUrl = process.env.SITE_ASSISTANT_EMBEDDING_BASE_URL || process.env.SITE_ASSISTANT_BASE_URL;
  if (!key || !baseUrl) return null;
  const url = new URL(baseUrl);
  // A chat-provider key must never follow a redirect or be sent to another provider.
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || !(url.hostname === 'dashscope.aliyuncs.com' || /^ws-[a-z0-9]+\.cn-beijing\.maas\.aliyuncs\.com$/.test(url.hostname))) throw new Error('Unsupported embedding endpoint');
  const model = process.env.SITE_ASSISTANT_EMBEDDING_MODEL || 'text-embedding-v4';
  return { key, baseUrl: baseUrl.replace(/\/$/, ''), model, identity: `${url.origin}:${model}:${KNOWLEDGE_DIMENSIONS}` };
}
export async function embedKnowledge(texts: string[], signal: AbortSignal, fetcher: typeof fetch = fetch, options: { timeoutMs?: number; maxRetries?: number } = {}): Promise<number[][]> {
  const config = assistantEmbeddingConfig();
  if (!config) throw new Error('Embedding provider is not configured');
  if (!texts.length || texts.length > 10 || texts.some(text => text.length > 2000)) throw new Error('Embedding batch exceeds its budget');
  const boundedFetch: typeof fetch = async (input, init) => {
    const response = await fetcher(input, { ...init, redirect: 'error' });
    if (!response.body) throw new Error('Empty embedding response');
    let bytes = 0;
    return new Response(response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({ transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > 1_000_000) throw new Error('Embedding response exceeds its budget');
      controller.enqueue(chunk);
    } })), { status: response.status, headers: response.headers });
  };
  const provider = createOpenAICompatible({ name: 'bailian', apiKey: config.key, baseURL: config.baseUrl, fetch: boundedFetch });
  const retries=options.maxRetries ?? 0;
  for(let attempt=0; ; attempt++) {
    signal.throwIfAborted();
    try {
      const result = await embedMany({ model: provider.embeddingModel(config.model), values: texts, dimensions: KNOWLEDGE_DIMENSIONS,
        maxRetries: 0, maxParallelCalls: 1, abortSignal: AbortSignal.any([signal, AbortSignal.timeout(options.timeoutMs ?? 8000)]) });
      if (result.embeddings.length !== texts.length || result.embeddings.some(vector => vector.length !== KNOWLEDGE_DIMENSIONS || vector.some(value => !Number.isFinite(value)) || !vector.some(value => value !== 0))) throw new Error('Invalid embedding vector');
      return result.embeddings;
    } catch(error) {
      signal.throwIfAborted();
      // Per-attempt timeouts are transient offline failures, but caller cancellation
      // and access/validation errors must never be retried. One shared retry budget.
      const retryable=APICallError.isInstance(error) ? error.isRetryable : error instanceof Error && error.name==='TimeoutError';
      if(attempt>=retries || !retryable) throw error;
      await delay(250 * 2**attempt,undefined,{signal});
    }
  }
}
