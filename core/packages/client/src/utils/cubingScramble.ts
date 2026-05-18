/**
 * WCA-spec scrambles. 16 of 17 events come from `cubing/scramble` (Lucas
 * Garron); 4x4 is routed to cs0x7f's Threephase via `cstimer_module` in our
 * own Web Worker pool — cubing.js vendors the exact same JS but wraps it in
 * a single worker + prepends a random-state 3x3 solve per call, which costs
 * ~50-200ms of solver work we can skip. The worker pool further gives 4x4
 * real parallelism, ~3-4x faster on bursty 50-scramble batches.
 *
 * Three layers on top:
 *   1. `setSearchDebug({ scramblePrefetchLevel: 'immediate' })` — cubing's
 *      built-in 1-deep prefetch starts the next scramble the instant the
 *      current one resolves (default 'auto' waits 1s idle).
 *   2. `prewarmScramble(event)` — fire pool refills in the background when
 *      the user lands on /scramble/gen, so the ~1.5-3s cold pruning-table
 *      build runs in parallel with the user configuring events (and for
 *      4x4 every worker builds its table at the same time).
 *   3. `pooledScramble(event)` — in-memory pool kept warm between actions.
 *      4x4 pool is sized to keep every worker fed (worker_count + 2);
 *      other events stay at 3 since their solver is single-worker anyway.
 */
import { randomScrambleForEvent } from 'cubing/scramble';
import { setSearchDebug } from 'cubing/search';
import { cstimerScramble444 } from './cstimer_444';
import { fetch555Scramble } from './scramble_555_server';
import { get555Mode, on555ModeChange } from './scramble_555_mode';
import { toWcaEventId } from './wca_events';

// Tell cubing.js to start the next prefetched scramble the instant the
// current one resolves (default 'auto' waits 1s idle). For user-cadence
// generation (click → look → click again) this makes the 2nd+ click feel
// instant for free.
try {
  setSearchDebug({ scramblePrefetchLevel: 'immediate' });
} catch {
  // setSearchDebug should always succeed but never let it crash module init.
}

export const TNOODLE_WCA_EVENTS = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '444bf', '555bf',
  '333fm', '333oh', '333ft', '333mbf', '333mbo',
  'clock', 'minx', 'pyram', 'skewb', 'sq1',
] as const;

const SUPPORTED = new Set<string>(TNOODLE_WCA_EVENTS);

export function isTnoodleSupportedEvent(event: string): boolean {
  return SUPPORTED.has(toWcaEventId(event));
}

/**
 * NxN random-move scrambler for N>=8, modeled after cubing.js's 5/6/7
 * (which are also random-move per WCA, not random-state — there's no solver
 * for those sizes either).
 *
 * - Length: WCA arithmetic 60/80/100 for 5/6/7 → linear 20*(N-2) for N>=8.
 *   N=8 → 120, N=10 → 160, N=20 → 360, N=100 → 1960.
 * - Output: cubing.js / WCA wide notation (`R`, `Rw`, `3Rw'`, `5Rw2`).
 *   Compatible with cubing.js Alg parser AND huazhechen TwistNode parser.
 * - Reduction rules (same as tnoodle/cubing.js):
 *   - reject same face as previous (no `R R`)
 *   - reject same axis as previous *and* the one before (no `R L R` pattern,
 *     which is strictly equivalent to a shorter sequence)
 * - Depth uniform random 1..floor(N/2); suffix uniform '' / "'" / "2".
 */
const SCRAMBLE_FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
const SCRAMBLE_AXIS_OF: Record<string, number> = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };
const SCRAMBLE_SUFFIXES = ['', "'", '2'] as const;

export function randomMoveScrambleNxN(N: number): string {
  if (N < 2) return '';
  const length = N >= 5 ? 20 * (N - 2) : Math.max(20, 9 * N);
  const maxDepth = Math.max(1, Math.floor(N / 2));
  const moves: string[] = [];
  let prevAxis = -1;
  let prevPrevAxis = -1;
  let prevFace = '';
  while (moves.length < length) {
    const face = SCRAMBLE_FACES[Math.floor(Math.random() * 6)];
    const axis = SCRAMBLE_AXIS_OF[face];
    if (face === prevFace) continue;
    if (axis === prevAxis && axis === prevPrevAxis) continue;
    const depth = 1 + Math.floor(Math.random() * maxDepth);
    const suffix = SCRAMBLE_SUFFIXES[Math.floor(Math.random() * SCRAMBLE_SUFFIXES.length)];
    const prefix = depth >= 3 ? String(depth) : '';
    const wide = depth >= 2 ? 'w' : '';
    moves.push(`${prefix}${face}${wide}${suffix}`);
    prevPrevAxis = prevAxis;
    prevAxis = axis;
    prevFace = face;
  }
  return moves.join(' ');
}

// ── App-level pool ──────────────────────────────────────────────────────
// Keep up to poolSizeFor(event) pre-generated scrambles per event hot in
// memory. Sized per event so 4x4 (multi-worker) gets a larger pool to make
// the common count=1..25 cases pop instantly; other events stay at 3 since
// their solver is single-worker and a larger pool wouldn't run any faster.
const DEFAULT_POOL_SIZE = 3;
// 4x4 pool spans the largest practical Generate count (the COUNT_PRESETS
// chip set tops out at 50, but most users pick 1/5/12/25). 25 means cold
// page load → click count≤25 → instant. count=50 still benefits: 25 pop
// instant, remaining 25 split across WORKER_COUNT workers in ~1-1.5s.
// Memory cost is tiny — 25 ~100-byte strings — the real cost is ~3s of
// background CPU during /scramble/gen mount, which the user notices
// far less than waiting after they click Generate.
const POOL_SIZE_444 = 25;
// 5x5 random-state is server-side (Java daemon on cuberoot.me) with 4 internal
// workers. Each fetch costs ~1.5s server CPU + network RTT, so we keep a
// modest pool of 5 — enough to make count≤5 instant from /scramble/gen and
// not so deep that prewarming wastes server CPU for an unwatched tab. Larger
// batches (count=12/25) still benefit since 5 pop instant and the rest stream
// in via the parallel-refill branch below.
const POOL_SIZE_555 = 5;
function poolSizeFor(wcaId: string): number {
  if (wcaId === '444') return POOL_SIZE_444;
  if (wcaId === '555') return POOL_SIZE_555;
  return DEFAULT_POOL_SIZE;
}

const pool = new Map<string, string[]>();
const refilling = new Map<string, Promise<void>>();

// 555 mode toggle bumps this generation;in-flight refills check it before
// pushing into the pool so old-mode results can't pollute a freshly-cleared
// pool. Without this, switching random-state ↔ random-move mid-prewarm would
// leak wrong-mode scrambles into the pool.
let pool555Generation = 0;
on555ModeChange(() => {
  pool555Generation++;
  pool.set('555', []);
  refilling.delete('555');
});

/**
 * Engine selector: 444 goes through cs0x7f's Threephase via cstimer_module
 * (in our own Web Worker pool, no wrapping overhead). Everything else stays
 * on cubing/scramble. cubing.js's wrapper does an extra random-state 3x3
 * solve per 4x4 call which we skip, plus we get N-way parallelism from
 * the worker pool.
 */
async function generateScramble(wcaId: string): Promise<string> {
  if (wcaId === '444') return cstimerScramble444();
  // 5x5: user picks random-state (cube555 daemon, ~70 moves) or random-move
  // (cubing.js WCA-spec 60). Mode persisted in localStorage; flips clear the
  // pool via the listener above. random-state fetch fails (backend down /
  // timeout) silently fall through to random-move so /scramble/gen never
  // breaks — degraded quality but still serviceable.
  if (wcaId === '555' && get555Mode() === 'rs') {
    try {
      return await fetch555Scramble();
    } catch (err) {
      console.warn('[555-rs] fetch failed, falling back to random-move:', err);
    }
  }
  // 333ft / 333mbo use identical scrambles to 333 / 333mbf — cubing/scramble
  // doesn't ship scramblers for these retired events, so map to 333.
  const cubingId = wcaId === '333ft' || wcaId === '333mbo' ? '333' : wcaId;
  const alg = await randomScrambleForEvent(cubingId);
  return alg.toString();
}

async function refillPool(wcaId: string): Promise<void> {
  const cur = pool.get(wcaId) ?? [];
  pool.set(wcaId, cur);
  const target = poolSizeFor(wcaId);
  // 4x4 has a Web Worker pool that runs in parallel; 5x5 has a server-side
  // 4-thread daemon. Both benefit from firing N fetches concurrently so every
  // worker fills a slot in one batch wall, instead of serializing through one
  // pipe. Other events single-thread inside one cubing/scramble worker, so
  // parallelism there only adds scheduling overhead without faster output.
  if (wcaId === '444' || wcaId === '555') {
    while (cur.length < target) {
      const need = target - cur.length;
      const startGen = wcaId === '555' ? pool555Generation : 0;
      const batch = await Promise.all(
        Array.from({ length: need }, () => generateScramble(wcaId)),
      );
      // 555 mode changed mid-batch → toss results, the post-change listener
      // already replaced `cur` with [] and we'd otherwise repopulate it with
      // stale scrambles. Exit so the new mode's refill (scheduled by
      // the listener clearing 'refilling') gets a clean slate.
      if (wcaId === '555' && startGen !== pool555Generation) return;
      for (const raw of batch) cur.push(formatScramble(wcaId, raw));
    }
    return;
  }
  while (cur.length < target) {
    const raw = await generateScramble(wcaId);
    cur.push(formatScramble(wcaId, raw));
  }
}

function scheduleRefill(wcaId: string): void {
  if (refilling.has(wcaId)) return;
  // Mark immediately so the dedup guard covers an entire synchronous burst
  // of pops, but defer the actual refill work to a macrotask so any in-
  // flight Generate-N call gets its direct-generate scrambles queued into
  // the cstimer worker pool BEFORE the refill adds its own. Workers
  // process FIFO, so this is the difference between count=50 finishing
  // in (50/N) × solver_ms vs (100/N) × solver_ms.
  const p = (async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
    try { await refillPool(wcaId); } finally { refilling.delete(wcaId); }
  })();
  refilling.set(wcaId, p);
}

/**
 * Prewarm: kick off scramble generation for one or more events in the
 * background. Call this when the user navigates to a route that will
 * probably need a scramble soon (e.g. /scramble/gen, /trainer). The first
 * 4x4 / 5x5 call builds heavy pruning tables (~3s) — moving that into idle
 * time eliminates the perceived "I clicked Generate, why is it stuck?" delay.
 */
export function prewarmScramble(...events: string[]): void {
  const list = events.length > 0 ? events : ['333'];
  for (const ev of list) {
    const wcaId = toWcaEventId(ev);
    if (!SUPPORTED.has(wcaId)) continue;
    // 4x4 refill fires POOL_SIZE_444 (≥ worker count + 2) scrambles in
    // parallel, so every worker picks one and builds its pruning table
    // concurrently with the others — no extra prewarm call needed.
    scheduleRefill(wcaId);
  }
}

/**
 * Pop one scramble from the pool if available, otherwise fall back to a
 * direct cubing call. Either way, schedules a refill so the next caller
 * stays warm. Same return shape as `tnoodleRandomScramble`.
 */
/** `nxn<N>` synthetic ids (N ≥ 8) for high-order NxN beyond WCA's 7x7 ceiling. */
const NXN_HIGH_RE = /^nxn(\d+)$/;

export async function pooledScramble(event: string): Promise<string | null> {
  // High-order NxN: route directly to the random-move generator. No pool —
  // generation is cheap (no solver), and pool refills are unnecessary.
  const nxnHigh = NXN_HIGH_RE.exec(event);
  if (nxnHigh) {
    const n = parseInt(nxnHigh[1], 10);
    if (n >= 2 && n <= 50) return randomMoveScrambleNxN(n);
    return null;
  }
  const wcaId = toWcaEventId(event);
  if (!SUPPORTED.has(wcaId)) return null;
  const cur = pool.get(wcaId);
  if (cur && cur.length > 0) {
    const s = cur.shift()!;
    pool.set(wcaId, cur);
    scheduleRefill(wcaId);
    return s;
  }
  // Cold path: nothing pooled. Fire a direct call AND start a background
  // refill so the next caller is warm.
  scheduleRefill(wcaId);
  const raw = await generateScramble(wcaId);
  return formatScramble(wcaId, raw);
}

/** Megaminx layout fixup — see comment in tnoodleRandomScramble below. */
function formatScramble(wcaId: string, raw: string): string {
  if (wcaId !== 'minx' || raw.includes('\n')) return raw;
  const tokens = raw.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur: string[] = [];
  for (const tok of tokens) {
    cur.push(tok);
    if (/^U['+]?$/.test(tok)) {
      lines.push(cur.join(' '));
      cur = [];
    }
  }
  if (cur.length) lines.push(cur.join(' '));
  return lines.join('\n');
}

// All existing call sites go through the pool — first POOL_SIZE scrambles
// of any batch (or after any idle period) pop instantly; megaminx output
// is reformatted by formatScramble inside pooledScramble.
export const tnoodleRandomScramble = pooledScramble;
