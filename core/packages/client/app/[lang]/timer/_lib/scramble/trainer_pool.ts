/*
 * trainer_pool — buffered scrambles for the random source's difficulty (see ./trainer-source).
 *
 * Same shape as wca_pool, for the same reason: producing one is asynchronous (a worker
 * generates the state, min2phase turns it into notation), while the timer's scramble
 * dispatcher is synchronous. `peekTrainer` hands over a ready one or '' — never a scramble of
 * the wrong difficulty — and SoloView fills the gap via `nextTrainer` while showing a spinner.
 *
 * A spec whose window is unreachable (say a 10-move XCross that is colour-neutral) is recorded
 * as *confirmed empty* instead of being retried forever, so the UI can say so.
 */

import { trainerSpecKey, type TrainerSpec } from '@/lib/cross-trainer';
import { cubieToFacelet } from '@/lib/cube-facelet';
import { m2pScrambleForFacelets, prewarmM2p } from '@/lib/m2p-scramble';
import type { CubieCube } from './kociemba/cube';

/** How many scrambles to keep queued ahead of the user. */
const TARGET = 3;
/** One worker round trip generates this many states (table build is paid once per spec). */
const BATCH = 3;

interface Buffer {
  key: string;
  queue: string[];
  /** The worker returned short → this window has no states (or the budget ran out). */
  empty: boolean;
  filling: Promise<void> | null;
}

let buf: Buffer = { key: '', queue: [], empty: false, filling: null };

// ── worker plumbing ──────────────────────────────────────────────────────────────────────────

interface ResOk { id: number; ok: true; states: CubieCube[]; depths: number[]; notation?: string; frame?: string }
interface ResErr { id: number; ok: false; err: string }

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: ResOk) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./trainer.worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (ev: MessageEvent<ResOk | ResErr>) => {
    const r = ev.data;
    const p = pending.get(r.id);
    if (!p) return;
    pending.delete(r.id);
    if (r.ok) p.resolve(r);
    else p.reject(new Error(r.err));
  });
  worker.addEventListener('error', (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'trainer worker error'));
    pending.clear();
  });
  return worker;
}

function askWorker(spec: TrainerSpec, count: number): Promise<ResOk> {
  const w = getWorker();
  const id = nextId++;
  return new Promise<ResOk>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, op: 'gen', spec, count });
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
export async function solveTrainerCase(scramble: string, isZh: boolean): Promise<{ notation: string; frame: string } | null> {
  const meta = metaByScramble.get(scramble);
  if (!meta) return null;
  const w = getWorker();
  const id = nextId++;
  const res = await new Promise<ResOk>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, op: 'solve', spec: meta.spec, state: meta.state, isZh });
  }).catch(() => null);
  if (!res || !res.notation) return null;
  return { notation: res.notation, frame: res.frame ?? '' };
}

// ── buffer ───────────────────────────────────────────────────────────────────────────────────

function bufferFor(spec: TrainerSpec): Buffer {
  const key = trainerSpecKey(spec);
  if (buf.key !== key) buf = { key, queue: [], empty: false, filling: null };
  return buf;
}

function fill(spec: TrainerSpec): Promise<void> {
  const b = bufferFor(spec);
  if (b.filling) return b.filling;
  if (b.empty || b.queue.length >= TARGET) return Promise.resolve();
  const key = b.key;
  b.filling = (async () => {
    try {
      const res = await askWorker(spec, BATCH);
      if (buf.key !== key) return; // spec changed while generating
      if (res.states.length === 0) { buf.empty = true; return; }
      // Notation is min2phase's job: the scramble must BUILD the state we generated.
      const scrambles = await Promise.all(
        res.states.map((st) => m2pScrambleForFacelets(cubieToFacelet(st)).catch(() => '')),
      );
      if (buf.key !== key) return;
      scrambles.forEach((s, i) => {
        if (!s) return;
        buf.queue.push(s);
        rememberMeta(s, { spec, depth: res.depths[i], state: res.states[i] });
      });
    } catch {
      /* worker / wasm failure — leave the queue as it is; the next take retries */
    } finally {
      if (buf.key === key) buf.filling = null;
    }
  })();
  return b.filling;
}

/** Start the worker + WASM and fill the buffer ahead of demand. */
export function prefetchTrainer(spec: TrainerSpec): void {
  if (typeof window === 'undefined') return;
  prewarmM2p();
  void fill(spec);
}

/** Is a scramble for this spec available right now (no await)? */
export function hasTrainerScramble(spec: TrainerSpec): boolean {
  return bufferFor(spec).queue.length > 0;
}

/** True once the worker has confirmed this window produces nothing. */
export function isTrainerSourceEmpty(spec: TrainerSpec): boolean {
  const b = bufferFor(spec);
  return b.empty && b.queue.length === 0;
}

/** Take a buffered scramble, or '' while one is still being generated. */
export function peekTrainer(spec: TrainerSpec): string {
  const b = bufferFor(spec);
  const s = b.queue.shift() ?? '';
  void fill(spec);
  return s;
}

/** Await one real scramble. Resolves to '' only when the window is genuinely empty. */
export async function nextTrainer(spec: TrainerSpec): Promise<string> {
  const key = trainerSpecKey(spec);
  for (let attempt = 0; attempt < 3; attempt++) {
    const b = bufferFor(spec);
    if (b.queue.length > 0) { const s = b.queue.shift()!; void fill(spec); return s; }
    if (b.empty) return '';
    await fill(spec);
    if (buf.key !== key) return '';
  }
  return '';
}

/** Test/util hook: drop the buffer and the worker. */
export function _resetTrainerPool(): void {
  buf = { key: '', queue: [], empty: false, filling: null };
  worker?.terminate();
  worker = null;
  pending.clear();
}
