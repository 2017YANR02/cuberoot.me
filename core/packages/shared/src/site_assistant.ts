export const SITE_ASSISTANT_DAILY_LIMIT = 1000;
export const SITE_ASSISTANT_TIMEOUT_MS = 30_000;
export type AssistantErrorCode = 'login_required' | 'wca_link_required' | 'account_forbidden' | 'daily_limit' | 'busy' | 'verification_required' | 'source_verification_required' | 'timeout' | 'network' | 'model_unavailable' | 'source_unavailable' | 'unavailable';
export interface AssistantSource { id: string; title: string; href: string; read: boolean }
export interface AssistantTable {
  kind: 'table'; title: string; columns: string[]; rows: string[][];
  /** One canonical source link for each row, supplied by the data adapter. */
  links?: string[];
}
export interface AssistantChart {
  kind: 'progress'; title: string; event: string; metric: 'single' | 'average';
  points: Array<{ date: string; value: number; label: string; person: string }>;
}
export type AssistantArtifact = AssistantTable | AssistantChart;
export interface AssistantAnswer {
  answer: string; sources: AssistantSource[]; artifacts?: AssistantArtifact[];
  /** Existing site destinations selected from navigation tool evidence. */
  actions?: Array<{ id: string; title: string; href: string }>;
}
export interface AssistantMessage { role: 'user' | 'assistant'; content: string }

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
