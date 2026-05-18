/**
 * 5x5 random-state scramble fetcher — calls /v1/scramble/555-rs on api.cuberoot.me,
 * which is backed by a Java cube555 daemon (see core/cube555-daemon/).
 *
 * The actual pooling / prewarm / refill cadence lives in `cubingScramble.ts`
 * (same Map-keyed-by-wcaId pool as 444/cubing.js). This module is intentionally
 * just one `fetch + parse + timeout` call so the pool can compose it freely.
 *
 * On any error (network / 503 / timeout) the caller catches and falls back to
 * cubing.js's WCA random-move 60 — so a backend outage degrades quality but
 * never breaks /scramble/gen.
 */
import { apiUrl } from './api_base';

// 35s > daemon's 30s in-flight timeout, so a real solver hang shows the
// daemon-side error message instead of an opaque client-side AbortError.
const FETCH_TIMEOUT_MS = 35_000;

interface ScrambleResponse {
  scramble?: string;
  error?: string;
}

/** One random-state 5x5 scramble from the server. Throws on any failure. */
export async function fetch555Scramble(): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl('/v1/scramble/555-rs'), { signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as ScrambleResponse;
    if (!json.scramble) throw new Error(json.error || 'empty scramble in response');
    return json.scramble;
  } finally {
    clearTimeout(timer);
  }
}

/** Cheap ping — does the daemon report ready yet? Used by /scramble/gen UX
 *  to show a "warming up" hint before first call if it's still cold. */
export async function fetch555Ready(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/v1/scramble/555-rs/ready'));
    if (!res.ok) return false;
    const json = (await res.json()) as { ready?: boolean };
    return !!json.ready;
  } catch {
    return false;
  }
}

/**
 * Streaming batch fetch. Server-side accepts count=1..12 and emits one SSE
 * `data:` event per finished solve, in any order (worker parallelism). On
 * any per-item failure server emits `event: error`; on terminal completion
 * `event: done`. We yield successful scrambles only; caller handles partial
 * fills by checking yielded count vs requested.
 *
 * Single open TCP connection saves TLS+HTTP setup vs N parallel fetches
 * and lets the pool refill stream scrambles in as the solver finishes each
 * (vs Promise.all blocking until the slowest).
 */
const BATCH_FETCH_TIMEOUT_MS = 60_000;
const BATCH_MAX = 12;

export async function* fetch555ScrambleBatch(
  count: number,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const n = Math.max(1, Math.min(BATCH_MAX, Math.floor(count)));
  const ctrl = new AbortController();
  const onAbort = (): void => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => ctrl.abort(), BATCH_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl(`/v1/scramble/555-rs/batch?count=${n}`), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!res.body) throw new Error('no body');
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let event = 'message';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '');
        buf = buf.slice(nl + 1);
        if (line === '') { event = 'message'; continue; }
        if (line.startsWith('event:')) { event = line.slice(6).trim(); continue; }
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (event === 'done' || event === 'error') continue;
        try {
          const obj = JSON.parse(payload) as { scramble?: string };
          if (obj.scramble) yield obj.scramble;
        } catch {
          // malformed line — skip
        }
      }
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
