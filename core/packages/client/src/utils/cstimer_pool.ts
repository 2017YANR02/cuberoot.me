/**
 * Shared cstimer Web Worker pool. All cstimer-routed events
 * (333/444/555/666/777/2x2/clock/minx/pyram/skewb/sq1/bld/oh/fm) share
 * these N workers — each worker's cstimer instance lazily builds and
 * caches a pruning table per scramble type on first request, so mixing
 * types across one pool is fine and keeps total worker count bounded
 * regardless of how many events the user picks.
 *
 * Worker cap = hardwareConcurrency - 2 (min 1, max 8). Leaves cores for
 * main thread + browser. 8 was retuned 2026-05-17 after lazy SVG previews
 * + content-visibility shifted the bottleneck back onto the solver for
 * 444/sq1/333: at count=1000 the e2e walltime drops further with 6-8
 * workers (333 ~2× faster, 444 ~1.7× faster) without regressing other
 * events. Cap at 8 because cstimer 444wca stops scaling past that and
 * pruning-table RAM (~20-30MB per worker per type) starts to matter.
 *
 * Memory: each worker grows by ~1-30MB per scramble type it has answered.
 * Worst case (all 16 routed events touched on every worker): ~150-300MB.
 * Acceptable on any modern laptop; typical use touches 1-3 events.
 *
 * Why one shared pool instead of per-event pools: pre-refactor we ran
 * separate 4-worker pools for 333 and 444. With 2 events that's 8 cstimer
 * workers competing for ~6 usable cores, which thrashed. A single pool
 * means total cstimer workers is always ≤ 4, no matter how many events.
 */

const MAX_WORKERS = 8;
export const CSTIMER_WORKER_COUNT = (() => {
  if (typeof navigator === 'undefined') return 1;
  const hc = navigator.hardwareConcurrency ?? 2;
  return Math.min(MAX_WORKERS, Math.max(1, hc - 2));
})();

export interface CstimerSpec {
  /** cstimer scramble type, e.g. '333', '444wca', 'sqrs'. */
  type: string;
  /** length parameter; 0 for random-state, N for random-move N moves. */
  length: number;
}

interface Pending {
  id: number;
  spec: CstimerSpec;
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
  const w = new Worker(new URL('./scramble_cstimer_worker.ts', import.meta.url), { type: 'module' });
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
    if (p) p.reject(new Error(e.message || 'cstimer worker error'));
    pump();
  };
  return slot;
}

function ensureSlots(): void {
  while (slots.length < CSTIMER_WORKER_COUNT) slots.push(makeSlot());
}

function pump(): void {
  ensureSlots();
  while (queue.length > 0) {
    const free = slots.find((s) => !s.busy);
    if (!free) return;
    const p = queue.shift()!;
    free.busy = true;
    free.current = p;
    free.worker.postMessage({ id: p.id, spec: p.spec });
  }
}

export function cstimerScramble(spec: CstimerSpec): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    queue.push({ id, spec, resolve, reject });
    pump();
  });
}

/**
 * Spin up every worker and fire one warm-up scramble per slot in parallel
 * for the given spec. Each worker pays its first-call pruning-table build
 * cost (~100ms-3s depending on event); doing them concurrently amortizes
 * to one max-of-N wait instead of N sequential waits.
 *
 * Call from page mount for whichever event is most likely to be used
 * first (typically 333 on /scramble/gen). Other events warm lazily on
 * first refill.
 */
export function cstimerPrewarm(spec: CstimerSpec): Promise<string[]> {
  ensureSlots();
  return Promise.all(Array.from({ length: CSTIMER_WORKER_COUNT }, () => cstimerScramble(spec)));
}
