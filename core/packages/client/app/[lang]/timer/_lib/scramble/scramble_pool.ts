/**
 * scramble_pool — background buffer of locally-generated scrambles so the NEXT
 * scramble is ready instantly when the user finishes a solve (seamless hand-off,
 * no visible "generating" gap). One buffer for the current generation context
 * (event + CN mode); refilled during browser idle time. Mirrors wca_pool but for
 * the local generateScramble() path.
 *
 * Timing safety: random-state events (4x4 / sq1 / 4BLD) take ~100-300ms to
 * generate, and useTimer reads performance.now() *inside* the keypress handler —
 * so a generation that blocks the main thread during a solve would corrupt the
 * recorded time. The caller passes a `canGen()` gate that is only true in
 * non-timing phases (idle / stopped / inspecting); refills pause otherwise and
 * resume on the next take()/warm() (which fire between solves). Fast events
 * (<1ms) are unaffected either way. Generation never runs during holding / ready
 * / running, so solve start/stop timestamps are never delayed.
 *
 * Not used in deterministic seeded-sync mode (pre-generating ahead would advance
 * the shared seed counter out of consumption order) — the caller falls back to a
 * direct synchronous generate there, and canGen() also returns false when seeded.
 */

// How many scrambles to keep queued ahead of the user.
const TARGET = 5;

// Single buffer for the current context. A new key (event / CN mode change)
// discards it, so a stale-context scramble is never served.
let buf: { key: string; queue: string[] } = { key: '', queue: [] };
let scheduled = false;

function runIdle(fn: () => void): void {
  const g = globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void };
  if (typeof g.requestIdleCallback === 'function') g.requestIdleCallback(fn, { timeout: 1500 });
  else setTimeout(fn, 50);
}

function scheduleRefill(key: string, gen: () => string, canGen: () => boolean): void {
  if (scheduled) return;
  if (buf.key === key && buf.queue.length >= TARGET) return;
  scheduled = true;
  runIdle(() => {
    scheduled = false;
    if (buf.key !== key || buf.queue.length >= TARGET) return; // context changed / full
    if (!canGen()) return; // unsafe phase (mid-solve) or seeded → resume on next take()/warm()
    try { buf.queue.push(gen()); } catch { /* generator threw — just skip this tick */ }
    scheduleRefill(key, gen, canGen); // one per idle tick keeps each main-thread block short
  });
}

/** Take a buffered scramble for `key` (or generate one synchronously if the
 *  buffer is dry / the context just changed), then top the buffer back up. */
export function takeScramble(key: string, gen: () => string, canGen: () => boolean): string {
  let s: string;
  if (buf.key === key && buf.queue.length > 0) {
    s = buf.queue.shift()!;
  } else {
    buf = { key, queue: [] }; // context changed or dry → fresh buffer for this key
    s = gen();
  }
  scheduleRefill(key, gen, canGen);
  return s;
}

/** Warm the buffer for `key` ahead of demand (e.g. on event / context change),
 *  without consuming a scramble. */
export function warmScramblePool(key: string, gen: () => string, canGen: () => boolean): void {
  if (buf.key !== key) buf = { key, queue: [] };
  scheduleRefill(key, gen, canGen);
}

/** Test/util hook: drop the buffer (used by unit tests for isolation). */
export function _resetScramblePool(): void {
  buf = { key: '', queue: [] };
  scheduled = false;
}
