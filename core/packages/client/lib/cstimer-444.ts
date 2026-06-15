/**
 * 4x4 random-state pool — cs0x7f's Threephase via `cstimer_module`, sharded
 * across N Web Workers so multi-scramble bursts get real parallelism.
 *
 * Solver is single-threaded inside one worker (~200ms warm per scramble),
 * so a 50-scramble batch on one worker takes ~10s wall. With 4 workers
 * each handling ~12-13 scrambles, wall drops to ~3s after cold start.
 *
 * Cold cost: pruning tables (~30MB) build on first request per worker
 * (~1.5s each), all in parallel if you `cstimerScramble444Prewarm()`.
 *
 * Memory cost: ~30MB × WORKER_COUNT — capped at 4 to keep total under
 * ~150MB even on lower-end laptops. hardwareConcurrency-aware below.
 */
'use client';

const MAX_WORKERS = 4;
const WORKER_COUNT = (() => {
  if (typeof navigator === 'undefined') return 1;
  const hc = navigator.hardwareConcurrency ?? 2;
  // Leave at least 2 cores for the main thread + browser; cap at MAX_WORKERS.
  // Each worker holds ~30MB of pruning tables (~120MB at cap). Pushing past 4
  // doesn't help much (50 scrambles ÷ 4 ≈ 13/worker × 200ms = 2.5s wall is
  // already close to the per-call solver floor) and bench showed it actually
  // hurts because cstimer workers contend with cubing.js's worker for the
  // 3x3 / 5x5 paths during cold pruning-table builds.
  return Math.min(MAX_WORKERS, Math.max(1, hc - 2));
})();

interface Pending {
  id: number;
  resolve: (s: string) => void;
  reject: (e: Error) => void;
}

interface Slot {
  worker: Worker;
  busy: boolean;
  current: Pending | null;
}

const slots: Slot[] = [];
const queue: Pending[] = [];
let nextId = 1;

function makeSlot(): Slot {
  const w = new Worker(new URL('./scramble-444-worker.ts', import.meta.url), { type: 'module' });
  const slot: Slot = { worker: w, busy: false, current: null };
  w.onmessage = (e: MessageEvent<{ id: number; moves?: string; error?: string }>) => {
    const { id, moves, error } = e.data;
    const p = slot.current;
    slot.busy = false;
    slot.current = null;
    if (p && p.id === id) {
      if (error) p.reject(new Error(error));
      else p.resolve(moves ?? '');
    }
    pump();
  };
  w.onerror = (e) => {
    const p = slot.current;
    slot.busy = false;
    slot.current = null;
    if (p) p.reject(new Error(e.message || 'worker error'));
    pump();
  };
  return slot;
}

function ensureSlots(): void {
  while (slots.length < WORKER_COUNT) slots.push(makeSlot());
}

function pump(): void {
  ensureSlots();
  while (queue.length > 0) {
    const free = slots.find((s) => !s.busy);
    if (!free) return;
    const p = queue.shift()!;
    free.busy = true;
    free.current = p;
    free.worker.postMessage({ id: p.id, type: 'scramble' });
  }
}

export function cstimerScramble444(): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    queue.push({ id, resolve, reject });
    pump();
  });
}

/**
 * Spin up every worker and fire one warm-up scramble per slot in parallel.
 * Each worker pays ~1.5s to build pruning tables; doing them concurrently
 * means the user's batch is hot the moment the last cold worker finishes,
 * not after WORKER_COUNT × 1.5s of serial waits.
 *
 * Call once on /scramble/gen mount — additional calls are cheap (workers
 * already warm just answer with a fresh scramble that goes into the pool).
 */
export function cstimerScramble444Prewarm(): Promise<string[]> {
  ensureSlots();
  return Promise.all(Array.from({ length: WORKER_COUNT }, () => cstimerScramble444()));
}

/** Visible to cubingScramble.ts so it can size POOL_SIZE to keep every worker fed. */
export const CSTIMER_444_WORKER_COUNT = WORKER_COUNT;
