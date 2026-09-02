import { Alg } from 'cubing/alg';
import { equivalentClean333Scramble } from './equivalent-clean-333';

const HTM_TOKEN = /^[URFDLB][2']?$/;

export function firstBadHtmToken(scramble: string): string | null {
  const bad = scramble.trim().split(/\s+/).filter(Boolean).find((token) => !HTM_TOKEN.test(token));
  return bad ?? null;
}

export async function normalizeCloudOptimal333Input(scramble: string): Promise<string> {
  const normalized = scramble.trim().replace(/\s+/g, ' ');
  if (!firstBadHtmToken(normalized)) return normalized;
  const equivalent = await equivalentClean333Scramble(normalized);
  if (!equivalent || firstBadHtmToken(equivalent)) {
    throw new Error('could not convert 3x3 scramble to plain HTM');
  }
  return equivalent;
}

export type CloudOptimalScramblePhase =
  | { phase: 'loading' }
  | { phase: 'queued'; ahead: number }
  | { phase: 'solving' };

export interface CloudOptimalScrambleResult {
  scramble: string;
  moves: number;
}

export interface CloudOptimalScrambleRequest {
  url: string;
  headers?: HeadersInit;
  fetcher?: typeof fetch;
  onPhase?: (phase: CloudOptimalScramblePhase) => void;
  signal?: AbortSignal;
}

export class CloudOptimalScrambleHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CloudOptimalScrambleHttpError';
  }
}

/** Shared protocol; hosts inject only their API URL and authentication headers. */
export async function requestCloudOptimalScramble(
  scramble: string,
  request: CloudOptimalScrambleRequest,
): Promise<CloudOptimalScrambleResult> {
  if (request.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const input = await normalizeCloudOptimal333Input(scramble);
  if (request.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const response = await (request.fetcher ?? fetch)(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ scrambles: [input] }),
    signal: request.signal,
  });
  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
    throw new CloudOptimalScrambleHttpError(
      response.status,
      error.error || `HTTP ${response.status}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator: number;
    while ((separator = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      const payload = JSON.parse(data) as {
        i?: number;
        solution?: string;
        error?: string;
        ahead?: number;
      };
      if (event === 'loading') request.onPhase?.({ phase: 'loading' });
      else if (event === 'queued') request.onPhase?.({ phase: 'queued', ahead: payload.ahead ?? 0 });
      else if (event === 'solving') request.onPhase?.({ phase: 'solving' });
      else if (event === 'error') throw new Error(payload.error || 'solve failed');
      else if (typeof payload.i === 'number' && typeof payload.solution === 'string') {
        const optimal = new Alg(payload.solution).invert().toString().replace(/2'/g, '2');
        return {
          scramble: optimal,
          moves: optimal.trim().split(/\s+/).filter(Boolean).length,
        };
      }
    }
  }
  throw new Error('stream ended without a solution');
}
