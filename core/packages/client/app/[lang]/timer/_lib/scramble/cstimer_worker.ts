/**
 * Bridge to the vendored csTimer scramble engine, running in a Web Worker.
 *
 * `public/scramble_module.js` is csTimer's Closure-compiled scramble bundle
 * (the same file /battle already loads). It is worker-aware: when evaluated in
 * a WorkerGlobalScope its own `execWorker` branch installs a `kernel` shim with
 * the default colour props AND a `self.onmessage` handler speaking csTimer's
 * native protocol
 *
 *     -> [reqId, 'scramble', [scramblerKey, length]]
 *     <- [reqId, 'scramble', scrambleText]
 *
 * so `new Worker('/scramble_module.js')` needs no wrapper script of our own.
 *
 * Why a worker and not /battle's main-thread `<script>` route: these are
 * random-STATE scramblers driven by IDA*. Measured on this machine, one FTO
 * scramble costs 1-3 s and Master Pyraminx ~5 s cold — on the main thread that
 * is a multi-second freeze of a *timer*, and it would land inside the same
 * keypress path `useTimer` measures with performance.now(). Off-thread it costs
 * nothing observable.
 *
 * Why not `lib/cstimer-scramble.ts` (the /scramble/gen worker, which drives the
 * same upstream engine from `tools/cstimer-scramble/`): that vendored subset is
 * missing `ftosolver.js` / `mgmsolver.js`, so its `ftoso` / `klmso` entries
 * throw `ftosolver is not defined`. The prebuilt bundle in public/ contains
 * them, which is exactly why /battle uses it.
 */

/** csTimer scramblers may return `undefined` while a prune table is still being
 *  built; upstream's UI just re-asks. We do the same, bounded. */
const MAX_RETRY = 40;
const RETRY_DELAY_MS = 250;
/** Nothing here should take a minute; fail loudly rather than hang a caller. */
const REQUEST_TIMEOUT_MS = 60_000;

type Pending = { resolve: (s: string) => void; reject: (e: Error) => void; timer: number };

let worker: Worker | null = null;
let nextReqId = 1;
const pending = new Map<number, Pending>();

function failAll(err: Error): void {
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(err);
  }
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;
  // Classic worker: the bundle is an IIFE over globals, not an ES module.
  worker = new Worker('/scramble_module.js');
  worker.onmessage = (e: MessageEvent) => {
    const data = e.data;
    if (!Array.isArray(data)) return;
    const [reqId, , result] = data as [number, string, unknown];
    const slot = pending.get(reqId);
    if (!slot) return;
    pending.delete(reqId);
    clearTimeout(slot.timer);
    slot.resolve(typeof result === 'string' ? result : '');
  };
  worker.onerror = (e) => {
    failAll(new Error(e.message || 'scramble worker error'));
  };
  return worker;
}

/** True once the worker has been created (i.e. the engine is loading/loaded). */
export function isCstimerWorkerStarted(): boolean {
  return worker !== null;
}

/** Create the worker (and start downloading the engine) without asking for a
 *  scramble. Safe to call repeatedly; no-op after the first call. */
export function warmCstimerWorker(): void {
  if (typeof window === 'undefined') return;
  try { getWorker(); } catch { /* no Worker support — callers degrade to '' */ }
}

function request(key: string, length: number): Promise<string> {
  const w = getWorker();
  const reqId = nextReqId++;
  return new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(reqId);
      reject(new Error(`cstimer scramble timed out: ${key}`));
    }, REQUEST_TIMEOUT_MS);
    pending.set(reqId, { resolve, reject, timer });
    w.postMessage([reqId, 'scramble', [key, length]]);
  });
}

/**
 * One scramble from the csTimer scrambler registered under `key`
 * (e.g. 'ftoso'). `length` is only meaningful for random-move scramblers;
 * random-state ones ignore it. Resolves to '' only if the engine is missing —
 * never a fabricated scramble.
 */
export async function cstimerWorkerScramble(key: string, length = 0): Promise<string> {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return '';
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const out = (await request(key, length)).trim();
    if (out.length > 0) return out;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  throw new Error(`cstimer scrambler produced nothing: ${key}`);
}

/** Test/util hook: drop the worker so the next call starts a fresh engine. */
export function _resetCstimerWorker(): void {
  failAll(new Error('worker reset'));
  worker?.terminate();
  worker = null;
}
