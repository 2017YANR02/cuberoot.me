/**
 * WCA-spec scrambles via `cubing/scramble`. cubing.js's scramblers are
 * maintained by the same author as tnoodle (Lucas Garron) and produce the
 * same official WCA-compliant output for all 17 events — exposed here as a
 * single async entry point. Accepts either short keys ('3x3', 'pyra', 'mega'…)
 * or WCA ids ('333', 'pyram', 'minx'…).
 *
 * Performance: cubing/scramble runs in a Web Worker but the first 4x4 (and
 * other random-state events) call pays ~3s to BFS-build the pruning tables;
 * subsequent warm calls are 200-800ms. We layer three tricks on top:
 *   1. `setSearchDebug({ scramblePrefetchLevel: 'immediate' })` — cubing's
 *      built-in 1-deep prefetch starts the next scramble in the worker the
 *      instant the previous one resolves (default 'auto' waits 1s idle).
 *   2. `prewarmScramble(event)` — fire one scramble in the background when
 *      the user lands on /scramble/gen, so the cold init runs in parallel
 *      with the user configuring events.
 *   3. `pooledScramble(event)` — small in-memory pool (POOL_SIZE per event)
 *      kept warm between user actions. The pool refills in background; up
 *      to POOL_SIZE first scrambles of a batch are popped instantly.
 */
import { randomScrambleForEvent } from 'cubing/scramble';
import { setSearchDebug } from 'cubing/search';
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
  '333fm', '333oh', '333mbf',
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
// Keep up to POOL_SIZE pre-generated scrambles per event hot in memory. The
// cubing worker serializes scramble work anyway, so a larger pool doesn't
// run faster — it just absorbs bursty UI demand (clicking Generate, switching
// events, opening Comp mode with 5+ events).
const POOL_SIZE = 3;
const pool = new Map<string, string[]>();
const refilling = new Map<string, Promise<void>>();

async function refillPool(wcaId: string): Promise<void> {
  const cur = pool.get(wcaId) ?? [];
  pool.set(wcaId, cur);
  while (cur.length < POOL_SIZE) {
    const alg = await randomScrambleForEvent(wcaId);
    cur.push(formatScramble(wcaId, alg.toString()));
  }
}

function scheduleRefill(wcaId: string): void {
  if (refilling.has(wcaId)) return;
  const p = refillPool(wcaId).finally(() => refilling.delete(wcaId));
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
    scheduleRefill(wcaId);
  }
}

/**
 * Pop one scramble from the pool if available, otherwise fall back to a
 * direct cubing call. Either way, schedules a refill so the next caller
 * stays warm. Same return shape as `tnoodleRandomScramble`.
 */
export async function pooledScramble(event: string): Promise<string | null> {
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
  const alg = await randomScrambleForEvent(wcaId);
  return formatScramble(wcaId, alg.toString());
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
