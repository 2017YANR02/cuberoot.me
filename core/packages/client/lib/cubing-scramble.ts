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
import { cstimerScramble444 } from './cstimer-444';
import { fetch555Scramble, fetch555ScrambleBatch } from './scramble-555-server';
import { get555Mode, on555ModeChange } from './scramble-555-mode';
import { get333Mode, on333ModeChange } from './scramble-333-mode';
import { m2pScramble333 } from './m2p-scramble';
import { wcaPocketScramble, optimalPocketScramble } from './pocket-scramble';
import { get222Mode, on222ModeChange } from './scramble-222-mode';
import { toWcaEventId } from './wca-events';

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

// cubing.js `twizzleEvents` 里非 WCA 但已支持 random-state 打乱的项目。
// 跟 https://experiments.cubing.net/cubing.js/mark3 暴露的对齐。
// id 形态保持 cubing.js 一致(redi_cube / master_tetraminx 等下划线),
// EventIcon 把它们映到 cubing-icons 的 `unofficial-*` class。
export const TWIZZLE_NONWCA_EVENTS = [
  'fto', 'master_tetraminx', 'kilominx', 'redi_cube', 'baby_fto',
] as const;

/**
 * 非 WCA 事件的 (id → cubing-icons class) 对照。EventIcon 和 WcaEventSelector
 * 的 `appendEvents` prop 都从这里读,避免对照表两份易漂。
 * 注意 cubing.js id 跟 cubing-icons class 短名不完全一致(`redi_cube`→`unofficial-redi`)。
 */
export const TWIZZLE_NONWCA_APPEND: ReadonlyArray<{ id: string; iconClass: string }> = [
  { id: 'fto', iconClass: 'unofficial-fto' },
  { id: 'master_tetraminx', iconClass: 'unofficial-mtetram' },
  { id: 'kilominx', iconClass: 'unofficial-kilominx' },
  { id: 'redi_cube', iconClass: 'unofficial-redi' },
  { id: 'baby_fto', iconClass: 'unofficial-baby_fto' },
];

const SUPPORTED = new Set<string>([...TNOODLE_WCA_EVENTS, ...TWIZZLE_NONWCA_EVENTS]);

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

/**
 * Random-move kilominx scrambler. Bypasses cubing.js's `randomKilominxScramble`
 * because that solver (xyzzy/kilosolver.js) needs ~1 minute + a few hundred MB
 * to build lookup tables on first call — completely unusable in a browser tab.
 *
 * Output matches WCA megaminx scramble format: 7 lines × 10 alternating R/D
 * moves with random ± suffix + a U / U' at end of each line. Same notation /
 * geometry as megaminx; kilominx (corner-only) uses the same face turns.
 * Author of xyzzy/kilosolver says hybrid/random-move is "good enough for
 * non-competition purposes" — and kilominx isn't a WCA event anyway.
 */
function randomMoveKilominxScramble(): string {
  const lines: string[] = [];
  for (let row = 0; row < 7; row++) {
    const tokens: string[] = [];
    for (let i = 0; i < 10; i++) {
      const face = i % 2 === 0 ? 'R' : 'D';
      const dir = Math.random() < 0.5 ? '++' : '--';
      tokens.push(face + dir);
    }
    tokens.push(Math.random() < 0.5 ? 'U' : "U'");
    lines.push(tokens.join(' '));
  }
  return lines.join('\n');
}

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
// FMC 每个 scramble ~0.5–3s(cubing.js 跑 kociemba solver 验证"非平凡",偶发慢)。
// Mo3 一次 Generate 抽 3 个,默认 pool=3 一次点完就空。下次点在 refill 完成前 = cold。
// 6 = 一次 Mo3 + 一发缓冲;refill 跑在后台不阻塞。
const POOL_SIZE_333FM = 6;
function poolSizeFor(wcaId: string): number {
  if (wcaId === '444') return POOL_SIZE_444;
  if (wcaId === '555') return POOL_SIZE_555;
  if (wcaId === '333fm') return POOL_SIZE_333FM;
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

// Same problem for 333 mode switching (wca ↔ m2p): scrambles cached from
// one engine should not be served after the user switches engines, since
// length distribution is slightly different. Clear the relevant pools.
on333ModeChange(() => {
  pool.set('333', []);
  pool.set('333ft', []);
  refilling.delete('333');
  refilling.delete('333ft');
});

// 2x2 口径切换(wca 11 步 ↔ optimal):两种输出长度不同,清掉 222 pool 免混入旧口径。
on222ModeChange(() => {
  pool.set('222', []);
  refilling.delete('222');
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
  // 2x2: cubing.js 0.63 把 222 路由到 WASM twips,generator 是 U/F/L/R 四面 —— 出的打乱含 L,
  // 违反 WCA 4b3(二阶固定 DBL 角,只用 U/R/F)。改走站内 TNoodle 移植(lib/pocket-scramble):
  // wca = 恰好 11 步、握位代价最小(与赛场一致);optimal = HTM 最短 + Q|H,同样握位代价最小。
  if (wcaId === '222') return get222Mode() === 'optimal' ? optimalPocketScramble() : wcaPocketScramble();
  // kilominx 走自带 random-move,绕开 cubing.js 那个要 1 分钟建表的 random-state solver。
  if (wcaId === 'kilominx') return randomMoveKilominxScramble();
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
  // 3x3 engine selector — user can opt in to min2phase-rust (cs0x7f's Kociemba,
  // ~10x faster than cubing.js's TS impl, same algorithm family, ±0.1 avg-len).
  // Only the bare 3x3 scramble format is swapped — 333bf/333mbf keep their
  // cubing.js-specific extended notation paths.
  if (cubingId === '333' && get333Mode() === 'm2p') {
    return m2pScramble333();
  }
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
  if (wcaId === '555' && get555Mode() === 'rs') {
    // Streaming SSE batch — one TCP connection, push scrambles to pool as
    // each parallel solver finishes. Falls through to Promise.all fan-out
    // below if the batch endpoint errors (e.g. older deploys without /batch).
    const startGen = pool555Generation;
    try {
      while (cur.length < target) {
        const need = target - cur.length;
        let yielded = 0;
        for await (const raw of fetch555ScrambleBatch(need)) {
          if (startGen !== pool555Generation) return;
          cur.push(formatScramble(wcaId, raw));
          yielded++;
        }
        if (yielded === 0) break; // 0 results = server bug or fallback path
      }
      if (cur.length >= target) return;
    } catch (err) {
      console.warn('[555-rs batch] failed, falling back:', err);
    }
  }
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
 * probably need a scramble soon (e.g. /scramble/gen, /alg trainer). The first
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
    if (n >= 2 && n <= 300) return randomMoveScrambleNxN(n);
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
  // Cold path for 5x5 random-state: instead of each caller firing its own
  // single fetch, wait for the in-flight batch SSE refill to push scrambles
  // to pool — N concurrent callers (Generate-N click) share ONE batch SSE,
  // daemon 调用从 2N (N single + N batch refill) 缩到 N。
  // Bench:Generate(5) cold-click 17.6s → ~6s (server 3 worker, ~3s/solve)。
  if (wcaId === '555' && get555Mode() === 'rs') {
    scheduleRefill(wcaId);
    const startGen = pool555Generation;
    const start = Date.now();
    const MAX_WAIT_MS = 45_000;
    while (Date.now() - start < MAX_WAIT_MS) {
      if (startGen !== pool555Generation) break;
      const p = pool.get(wcaId);
      if (p && p.length > 0) {
        const s = p.shift()!;
        pool.set(wcaId, p);
        return s;
      }
      // refill 结束且仍未轮到我们 → 走 fall-through single fetch (其余
      // 等待者会再触发一轮 refill, 拿那一波)
      if (!refilling.has(wcaId)) break;
      await new Promise<void>((r) => setTimeout(r, 60));
    }
  }
  // Fall-through cold path (其它 event,或 555-rs refill 失败/排在批后位):
  // 单条 fetch + 顺手 schedule 一次 refill 保温下一击。
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
