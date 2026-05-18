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
