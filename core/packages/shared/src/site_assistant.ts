export const SITE_ASSISTANT_DAILY_LIMIT = 1000;
export { resolveAssistantTime, resolveAssistantYears } from './site_assistant_time';
export const SITE_ASSISTANT_TIMEOUT_MS = 60_000;
/** Match the question and history limits accepted by the assistant API. */
export const SITE_ASSISTANT_QUESTION_MAX_LENGTH = 8000;
export const SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH = 12000;
export const SITE_ASSISTANT_ANSWER_MAX_LENGTH = 12000;
export type AssistantThinkingMode = 'auto' | 'fast' | 'deep';
export function assistantTimeoutMs(mode: AssistantThinkingMode = 'auto'): number {
  return mode === 'fast' ? 30_000 : mode === 'deep' ? 90_000 : SITE_ASSISTANT_TIMEOUT_MS;
}
export const SITE_ASSISTANT_MAX_IMAGES = 3;
export const SITE_ASSISTANT_IMAGE_BYTES = 768 * 1024;
export const SITE_ASSISTANT_BODY_BYTES = 3_300_000;
export interface AssistantImage { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }
export type AssistantErrorCode = 'request_too_large' | 'invalid_image' | 'vision_unavailable' | 'login_required' | 'wca_link_required' | 'account_forbidden' | 'daily_limit' | 'busy' | 'verification_required' | 'source_verification_required' | 'timeout' | 'network' | 'model_unavailable' | 'source_unavailable' | 'unavailable';
export interface AssistantSource { id: string; title: string; href: string; read: boolean }
/** Render only adapter-verified source metadata. Never apply this to model-authored links. */
export function isAssistantSourceHref(href: string): boolean {
  if (href.length > 2000 || /[\\\s\u0000-\u001f]/.test(href)) return false;
  if (/^\/(?!\/)/.test(href)) return true;
  try {
    const url = new URL(href), host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.')
      || host.includes(':') || /^[\d.]+$/.test(host) || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host)) return false;
    return ![...url.searchParams.keys()].some(key => /^(?:accesstoken|apikey|password|passwd|secret|authorization|token|auth|session|key|signature)$/i.test(key.replace(/[-_]/g, '')));
  } catch { return false; }
}
export interface AssistantTable {
  kind: 'table'; title: string; columns: string[]; rows: string[][];
  /** One canonical source link for each row, supplied by the data adapter. */
  links?: string[];
  /** Additional canonical links by row and column; null supplies no cell-specific link. */
  cellLinks?: Array<Array<string | null>>;
  /** Semantic presentation supplied by the adapter, independent of translated headers. */
  columnKinds?: Array<'text' | 'country' | 'date'>;
}
export interface AssistantChart {
  kind: 'progress'; title: string; event: string; metric: 'single' | 'average';
  points: Array<{ date: string; value: number; label: string; person: string }>;
}
export type AssistantArtifact = AssistantTable | AssistantChart;
export interface AssistantAnswer {
  answer: string; sources: AssistantSource[]; artifacts?: AssistantArtifact[];
  /** Verified destinations selected from site catalogs or public data adapters. */
  actions?: Array<{ id: string; title: string; href: string }>;
}
export interface AssistantMessage { role: 'user' | 'assistant'; content: string; images?: AssistantImage[] }
/** Keep recent complete turns within a bounded context, without summarizing away user meaning. */
export function boundAssistantHistory(history: AssistantMessage[]): AssistantMessage[] {
  const recent = history.slice(-10);
  let size = recent.reduce((sum, message) => sum + message.content.length, 0);
  while (recent.length && size > 40_000) size -= recent.shift()!.content.length;
  if (recent[0]?.role === 'assistant') recent.shift();
  return recent;
}

export type AssistantStatus = { phase: 'planning' | 'querying' | 'writing'; tool?: string };
export type AssistantStreamEvent =
  | { type: 'status'; status: AssistantStatus }
  | { type: 'answer'; answer: string; sources: AssistantSource[] }
  | { type: 'done'; result: AssistantAnswer }
  | { type: 'error'; error: AssistantErrorCode };

/** Bounded SSE reader shared by the provider adapter and the browser client. */
export async function* readAssistantEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      size += value?.byteLength ?? 0;
      if (size > 8_000_000) throw new Error('assistant stream too large');
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      // Normalize CRLF only once a complete line has arrived (CR can split chunks).
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (data) yield data;
      }
      if (done) break;
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
}
