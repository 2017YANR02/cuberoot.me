/*
 * trainer_pool — buffered scrambles for the random source's difficulty (see ./trainer-source).
 *
 * Same shape as wca_pool, for the same reason: producing one is asynchronous (a worker generates
 * the state, min2phase turns it into notation) while the timer's scramble dispatcher is
 * synchronous. `peekTrainer` hands over a ready one or '' — never a scramble of the wrong
 * difficulty — and SoloView fills the gap via `nextTrainer` while showing a spinner.
 *
 * Two things this file exists to get right, both learned the hard way:
 *
 *  1. ONE request in flight, ever. The worker is single-threaded and processes messages FIFO, so
 *     a settings drag that fires ten specs would queue ten generations — each able to occupy the
 *     worker for seconds — and the spec the user actually stopped on would come out last. Instead
 *     the pump asks for one batch, and when it comes back it looks at what is wanted NOW. Stale
 *     work is bounded by one batch, not by how fast the user moves a slider.
 *
 *  2. Table builds are NOT a separate request. The worker builds a stage's tables inside the
 *     `gen` it needs them for (before any sampling clock starts), so the build lands in the one
 *     request the user is actually waiting on. A standalone "warm" op looked cheaper but had no
 *     supersede: dragging through the stage dropdown queued a build per stage — up to a minute of
 *     work for stages nobody wanted — ahead of the one that was.
 *
 *  3. "Nothing came back" is not "does not exist". The worker separates the two (`verdict`):
 *     'empty' is a proof and latches; 'budget' (cold tables, a rare window, a loaded machine) is
 *     retried and reported as "still looking". Latching on a spent budget is what turned a cold
 *     XXCross build into a permanent, and false, "this difficulty cannot be generated".
 */

import { trainerSpecKey, type TrainerSpec } from '@/lib/cross-trainer';
import { cubieToFacelet } from '@/lib/cube-facelet';
import { m2pScrambleForFacelets, prewarmM2p } from '@/lib/m2p-scramble';
import type { CubieCube } from './kociemba/cube';
import type { GenVerdict } from './trainer.worker';

/** How many scrambles to keep queued ahead of the user. */
const TARGET = 3;
/** One worker round trip generates this many states (the table build is paid once per stage). */
const BATCH = 3;
/** Wall clock the worker may spend searching per batch, excluding the table build. */
const GEN_BUDGET_MS = 3000;
/** Consecutive fruitless batches before we stop burning CPU and tell the user it is too rare. */
const MAX_TRIES = 4;
/** A request that takes longer than this means a wedged worker, not a slow one. */
const REQ_TIMEOUT_MS = 90_000;

export type TrainerStatus = 'idle' | 'working' | 'ready' | 'empty' | 'rare';

interface Buffer {
  key: string;
  spec: TrainerSpec | null;
  queue: string[];
  /** Proven: no cube has this difficulty. Latches — the user must change the window. */
  empty: boolean;
  /** MAX_TRIES batches came back with nothing but no proof. Retryable. */
  rare: boolean;
  tries: number;
}

const emptyBuffer = (): Buffer => ({ key: '', spec: null, queue: [], empty: false, rare: false, tries: 0 });
let buf: Buffer = emptyBuffer();

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => { for (const l of [...listeners]) l(); };

/** Subscribe to buffer changes (a scramble arrived, or the status changed). */
export function onTrainerChange(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// ── worker plumbing ──────────────────────────────────────────────────────────────────────────

interface ResOk {
  id: number; ok: true;
  states: CubieCube[]; depths: number[];
  verdict?: GenVerdict; notation?: string | null; frame?: string;
}
interface ResErr { id: number; ok: false; err: string }

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: ResOk) => void; reject: (e: Error) => void; timer: number }>();

function dropWorker(err: string): void {
  for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error(err)); }
  pending.clear();
  worker?.terminate();
  worker = null;   // the next request builds a fresh one — a dead worker must not wedge the pool
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./trainer.worker.ts', import.meta.url), { type: 'module' });
  w.addEventListener('message', (ev: MessageEvent<ResOk | ResErr>) => {
    const r = ev.data;
    const p = pending.get(r.id);
    if (!p) return;
    pending.delete(r.id);
    clearTimeout(p.timer);
    if (r.ok) p.resolve(r);
    else p.reject(new Error(r.err));
  });
  w.addEventListener('error', (e) => dropWorker(e.message || 'trainer worker error'));
  worker = w;
  return w;
}

function ask(msg: Record<string, unknown>): Promise<ResOk> {
  const w = getWorker();
  const id = nextId++;
  return new Promise<ResOk>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      dropWorker('trainer worker timed out');
      reject(new Error('timeout'));
    }, REQ_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, ...msg });
  });
}

// ── case metadata (what makes this a trainer: which case, how long, and the answer) ───────────

export interface TrainerMeta {
  spec: TrainerSpec;
  /** Optimal length of the stage for this state — the difficulty actually delivered. */
  depth: number;
  state: CubieCube;
}

/** Keyed by the scramble text, exactly like wca_pool's meta — bounded so it cannot grow. */
const metaByScramble = new Map<string, TrainerMeta>();
const META_MAX = 60;

function rememberMeta(scramble: string, meta: TrainerMeta): void {
  metaByScramble.set(scramble, meta);
  if (metaByScramble.size > META_MAX) {
    const oldest = metaByScramble.keys().next().value;
    if (oldest !== undefined) metaByScramble.delete(oldest);
  }
}

/** The case behind a scramble this pool produced, or null if it came from elsewhere. */
export function trainerMetaFor(scramble: string): TrainerMeta | null {
  return metaByScramble.get(scramble) ?? null;
}

/** An optimal solution of the stage, plus which colour/slot it solves. Computed on demand. */
export async function solveTrainerCase(
  scramble: string, isZh: boolean,
): Promise<{ notation: string; frame: string } | null> {
  const meta = metaByScramble.get(scramble);
  if (!meta) return null;
  const res = await ask({ op: 'solve', spec: meta.spec, state: meta.state, isZh }).catch(() => null);
  // `null` = the solver could not answer; '' = a real 0-move answer (the stage is already solved).
  if (!res || res.notation === null || res.notation === undefined) return null;
  return { notation: res.notation, frame: res.frame ?? '' };
}

// ── buffer ───────────────────────────────────────────────────────────────────────────────────

/** Point the pool at a spec (resetting the buffer when it really changed). Non-mutating readers below. */
function want(spec: TrainerSpec): Buffer {
  const key = trainerSpecKey(spec);
  if (buf.key !== key) { buf = { ...emptyBuffer(), key, spec }; notify(); }
  else buf.spec = spec;
  return buf;
}

/**
 * The difficulty source is off / not applicable. Without this an `awaitTrainer` promise for the
 * spec we just abandoned would never settle (nothing calls notify again) and would hold its
 * listener for the life of the page — one per toggle.
 */
export function releaseTrainer(): void {
  if (!buf.key) return;
  buf = emptyBuffer();
  notify();
}

let pumping = false;

/**
 * Keep the current spec's queue topped up, one worker request at a time. Re-reads the desired
 * spec after every round trip, so changing the settings mid-flight costs at most one stale batch.
 */
async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    for (;;) {
      const b = buf;
      const spec = b.spec;
      if (!spec || b.empty || b.rare || b.queue.length >= TARGET) break;
      const key = b.key;
      let res: ResOk;
      try {
        res = await ask({ op: 'gen', spec, count: BATCH, budgetMs: GEN_BUDGET_MS });
      } catch {
        if (buf.key !== key) continue;          // the settings moved on — nothing to report
        buf.tries += 1;                          // worker died or timed out: bounded retry
        if (buf.tries >= MAX_TRIES) { buf.rare = true; notify(); break; }
        continue;
      }
      if (buf.key !== key) continue;             // stale batch, throw it away and serve what is wanted
      if (res.verdict === 'empty' && res.states.length === 0) { buf.empty = true; notify(); break; }
      if (res.states.length === 0) {
        buf.tries += 1;
        if (buf.tries >= MAX_TRIES) { buf.rare = true; notify(); break; }
        continue;
      }
      buf.tries = 0;
      // Notation is min2phase's job: the scramble must BUILD the state we generated.
      const scrambles = await Promise.all(
        res.states.map((st) => m2pScrambleForFacelets(cubieToFacelet(st)).catch(() => '')),
      );
      if (buf.key !== key) continue;
      let added = 0;
      scrambles.forEach((s, i) => {
        if (!s) return;
        buf.queue.push(s);
        rememberMeta(s, { spec, depth: res.depths[i], state: res.states[i] });
        added++;
      });
      if (!added) {                              // every conversion failed — do not spin on it
        buf.tries += 1;
        if (buf.tries >= MAX_TRIES) { buf.rare = true; notify(); break; }
        continue;
      }
      notify();
    }
  } finally {
    pumping = false;
  }
}

/** Start the worker + WASM and fill the buffer ahead of demand. */
export function prefetchTrainer(spec: TrainerSpec): void {
  if (typeof window === 'undefined') return;
  prewarmM2p();
  want(spec);
  void pump();
}

/** Status of this spec's buffer. Pure read. */
export function trainerStatus(spec: TrainerSpec): TrainerStatus {
  if (buf.key !== trainerSpecKey(spec)) return 'idle';
  if (buf.queue.length) return 'ready';
  if (buf.empty) return 'empty';
  if (buf.rare) return 'rare';
  return 'working';
}

/** Take a buffered scramble, or '' while one is still being generated. */
export function peekTrainer(spec: TrainerSpec): string {
  const b = want(spec);
  const s = b.queue.shift() ?? '';
  void pump();
  return s;
}

/**
 * Resolve once a scramble for this spec exists (or the spec is proven empty / gave up).
 * Nothing is removed from the queue — the caller takes it with `peekTrainer` when it is ready to
 * show it, so a cancelled await cannot drop a scramble on the floor.
 */
export function awaitTrainer(spec: TrainerSpec): Promise<TrainerStatus> {
  const key = trainerSpecKey(spec);
  want(spec);
  void pump();
  const settled = (): TrainerStatus | null => {
    if (buf.key !== key) return 'idle';
    const st = trainerStatus(spec);
    return st === 'working' ? null : st;
  };
  const now = settled();
  if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    const off = onTrainerChange(() => {
      const st = settled();
      if (st) { off(); resolve(st); }
    });
  });
}

/** Retry a spec the pool gave up on ("too rare"), e.g. because the user asked for it again. */
export function retryTrainer(spec: TrainerSpec): void {
  if (buf.key !== trainerSpecKey(spec)) return;
  buf.rare = false;
  buf.tries = 0;
  void pump();
}

/** Test/util hook: drop the buffer and the worker. */
export function _resetTrainerPool(): void {
  buf = emptyBuffer();
  dropWorker('reset');
  listeners.clear();
}
