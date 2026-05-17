/**
 * Main-thread RPC wrapper around `scramble_444_worker.ts`. Returns a Promise
 * that resolves to a WCA-spec 4x4 scramble string (~44 wide-notation moves).
 *
 * One singleton worker — Threephase pruning tables (~30 MB) build once on
 * first request and persist for the page session. Multiple concurrent calls
 * queue inside the worker (the underlying solver is synchronous).
 */
let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (s: string) => void; reject: (e: Error) => void }>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./scramble_444_worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; moves?: string; error?: string }>) => {
    const { id, moves, error } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (error) p.reject(new Error(error));
    else p.resolve(moves ?? '');
  };
  worker.onerror = (e) => {
    // Reject every in-flight call so callers don't hang forever.
    for (const [id, p] of pending) {
      pending.delete(id);
      p.reject(new Error(e.message || 'worker error'));
    }
  };
  return worker;
}

export function cstimerScramble444(): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ensureWorker().postMessage({ id, type: 'scramble' });
  });
}
