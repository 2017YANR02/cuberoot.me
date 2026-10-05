// One verified XCross table per acquisition, shared by every solver worker.
const BASE = '/tools/solver/rust-cross';
const TABLES_BASE = 'https://static.cuberoot.me/tools/solver/rust-cross/tables';
const TV = 'tv=1';
// Worker, glue and WASM must change versions together; table contents are unchanged.
const V = 'v=20261004a';
export { BASE, TABLES_BASE, TV, V };

let hostTablesBase: string | undefined;
/** Installed hosts bundle executable workers but download the canonical data tables. */
export function configureStageSolverTables(base: string): void { hostTablesBase = base; }
export function tablesBaseUrl(): string {
  const base = hostTablesBase ?? TABLES_BASE;
  return typeof location === 'undefined' ? base : new URL(base, location.href).href;
}

export interface XCrossProgress {
  phase: 'cache' | 'racing' | 'ready';
  loaded: number;
  total: number;
  generation: 'waiting' | 'running' | 'verifying' | 'failed';
  download: 'waiting' | 'running' | 'verifying' | 'failed';
  source?: 'cache' | 'download' | 'generated';
}
const progressFns = new Set<(p: XCrossProgress) => void>();
let progress: XCrossProgress | null = null;
function emit(p: XCrossProgress): void {
  progress = p;
  for (const fn of progressFns) fn(p);
}
export function onXCrossProgress(fn: (p: XCrossProgress) => void): () => void {
  progressFns.add(fn);
  if (progress) fn(progress);
  return () => { progressFns.delete(fn); };
}

interface Acquisition {
  promise: Promise<ArrayBuffer>;
  consumers: number;
  settled: boolean;
  cancel(): void;
}
let current: Acquisition | null = null;
const aborted = () => new DOMException('XCross table acquisition cancelled', 'AbortError');

function start(): Acquisition {
  let resolve!: (bytes: ArrayBuffer) => void;
  let reject!: (error: Error) => void;
  const workers = new Map<string, Worker>();
  const errors = new Map<string, string>();
  let generatorStarted = false;
  let cacheTimer: ReturnType<typeof setTimeout>;
  let finishTimer: ReturnType<typeof setTimeout>;
  const run: Acquisition = {
    promise: new Promise((res, rej) => { resolve = res; reject = rej; }),
    consumers: 0, settled: false,
    cancel() {
      if (run.settled) return;
      run.settled = true;
      cleanup();
      reject(aborted());
    },
  };
  function cleanup() {
    clearTimeout(cacheTimer);
    clearTimeout(finishTimer);
    for (const worker of workers.values()) worker.terminate();
    workers.clear();
    if (current === run) { current = null; progress = null; }
  }
  function failed(mode: string, error: string) {
    if (run.settled || errors.has(mode)) return;
    errors.set(mode, error);
    workers.get(mode)?.terminate();
    workers.delete(mode);
    emit({ ...progress!, [mode === 'generate' ? 'generation' : 'download']: 'failed' });
    if (mode === 'download') generate();
    if (errors.size === 2) {
      run.settled = true;
      cleanup();
      reject(new Error(`XCross: ${[...errors.values()].join('; ')}`));
    }
  }
  function launch(mode: 'download' | 'generate') {
    try {
      const worker = new Worker(`${BASE}/xcross-table-worker.js?${V}`, { type: 'module' });
      workers.set(mode, worker);
      worker.onerror = (event) => failed(mode, event.message || `${mode} worker failed`);
      worker.onmessageerror = () => failed(mode, `${mode} message failed`);
      worker.onmessage = ({ data: m }) => {
        if (m.type === 'stored' && run.settled) { cleanup(); return; }
        if (run.settled) return;
        if (m.type === 'cache_miss') { generate(); return; }
        if (m.type === 'error') { failed(mode, m.error); return; }
        if (m.type === 'progress') {
          emit({ ...progress!, phase: 'racing', ...m.progress });
        } else if (m.type === 'ready') {
          run.settled = true;
          clearTimeout(cacheTimer);
          for (const [otherMode, other] of workers) {
            if (otherMode !== mode) { other.terminate(); workers.delete(otherMode); }
          }
          emit({ ...progress!, phase: 'ready', source: m.source });
          resolve(m.bytes);
          // Keep the winner alive only to persist its verified result. A denied/full
          // cache never delays solving; also bound browsers with stalled storage.
          finishTimer = setTimeout(cleanup, 5000);
          worker.postMessage({ type: 'persist' });
        }
      };
      worker.postMessage({
        type: 'start', mode,
        tableUrl: `${tablesBaseUrl()}/pt_cross_C4E0.bin.gz?${TV}`,
        glueUrl: new URL(`${BASE}/cross_solver.js?${V}`, location.href).href,
        wasmUrl: new URL(`${BASE}/cross_solver_bg.wasm?${V}`, location.href).href,
      });
    } catch (error) { failed(mode, String(error)); }
  }
  function generate() {
    if (generatorStarted || run.settled) return;
    generatorStarted = true;
    clearTimeout(cacheTimer);
    emit({ ...progress!, phase: 'racing', generation: 'running' });
    launch('generate');
  }
  emit({ phase: 'cache', loaded: 0, total: 0, generation: 'waiting', download: 'waiting' });
  // Cache lookup gets a small head start, not an unbounded storage dependency.
  cacheTimer = setTimeout(generate, 200);
  queueMicrotask(() => { if (!run.settled) launch('download'); });
  return run;
}

/** Cache first, then download versus generation. Each caller can cancel without
 * cancelling another pool's request. Only a complete, SHA-256 verified table wins. */
export function claimXCrossTable(signal: AbortSignal): Promise<ArrayBuffer> {
  if (signal.aborted) return Promise.reject(aborted());
  const run = current ?? (current = start());
  run.consumers++;
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = () => {
      if (done) return false;
      done = true;
      signal.removeEventListener('abort', cancel);
      run.consumers--;
      return true;
    };
    const cancel = () => {
      if (!finish()) return;
      reject(aborted());
      if (!run.consumers) run.cancel();
    };
    signal.addEventListener('abort', cancel, { once: true });
    run.promise.then(
      (bytes) => { if (finish()) resolve(bytes); },
      (error) => { if (finish()) reject(error); },
    );
  });
}
