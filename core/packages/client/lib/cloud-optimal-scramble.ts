/**
 * cloudOptimalScramble — derive the optimal-length scramble reaching the same
 * state as a given scramble, via the server-side opt6 solver.
 *
 * POSTs to /v1/scramble/optimal-solve (the same endpoint /scramble/solver's
 * "cloud" mode + 求打乱(最优) use — see app/[lang]/scramble/solver/_Cube3Solver.tsx),
 * streams the optimal *solution* for the given scramble via SSE, then inverts it:
 * the fewest-move sequence that solves a state is, by definition, also the
 * fewest-move scramble that reaches it. Feed it a fast/random-state scramble
 * (e.g. tnoodleRandomScramble('333')) to get a truly optimal-length scramble for
 * a uniformly random state — that's what /sim's "optimal scramble" button and
 * /scramble/solver's 求打乱(最优) flow both do; this is the one shared client
 * implementation of the protocol so neither has to re-parse the SSE stream.
 *
 * 3x3-only (the endpoint only serves the 3x3 opt6 table) and login-gated
 * (requireAuth server-side — throws with the server's error message on 401).
 */
import { Alg } from 'cubing/alg';
import { streamApiUrl } from './api-base';
import { authHeaders } from './admin-api';

const HTM_TOKEN = /^[URFDLB][2']?$/;

/** First token that isn't a plain HTM face turn (U R F D L B, optional 2/'), or
 *  null if `scramble` is entirely plain HTM — what the cloud endpoint accepts. */
export function firstBadHtmToken(scramble: string): string | null {
  const bad = scramble.trim().split(/\s+/).filter(Boolean).find((tok) => !HTM_TOKEN.test(tok));
  return bad ?? null;
}

export type CloudOptimalScramblePhase =
  | { phase: 'loading' }
  | { phase: 'queued'; ahead: number }
  | { phase: 'solving' };

export interface CloudOptimalScrambleResult {
  /** The optimal-length scramble reaching the same state as the input scramble. */
  scramble: string;
  moves: number;
}

export async function cloudOptimalScramble(
  scramble: string,
  onPhase?: (p: CloudOptimalScramblePhase) => void,
  signal?: AbortSignal,
): Promise<CloudOptimalScrambleResult> {
  const res = await fetch(streamApiUrl('/v1/scramble/optimal-solve'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ scrambles: [scramble] }),
    signal,
  });
  if (!res.ok || !res.body) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let ev = 'message';
      let data = '';
      for (const ln of block.split('\n')) {
        if (ln.startsWith('event:')) ev = ln.slice(6).trim();
        else if (ln.startsWith('data:')) data += ln.slice(5).trim();
      }
      if (!data) continue;
      const obj = JSON.parse(data) as {
        i?: number; solution?: string; error?: string; ahead?: number;
      };
      if (ev === 'loading') onPhase?.({ phase: 'loading' });
      else if (ev === 'queued') onPhase?.({ phase: 'queued', ahead: obj.ahead ?? 0 });
      else if (ev === 'solving') onPhase?.({ phase: 'solving' });
      else if (ev === 'error') throw new Error(obj.error || 'solve failed');
      else if (typeof obj.i === 'number' && typeof obj.solution === 'string') {
        // min2phase prints inverted doubles as `R2'`; `R2` reads cleaner for a scramble.
        const optimal = new Alg(obj.solution).invert().toString().replace(/2'/g, '2');
        const moves = optimal.trim().split(/\s+/).filter(Boolean).length;
        return { scramble: optimal, moves };
      }
    }
  }
  throw new Error('stream ended without a solution');
}
