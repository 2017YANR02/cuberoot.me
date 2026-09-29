import { emptyAnalysis } from './analysis-protocol';
import type { AnalysisInput, AnalysisRequest, AnalysisResponse, AnalysisSnapshot } from './analysis-protocol';
export type { AnalysisInput, AnalysisRequest, AnalysisResponse, AnalysisSnapshot } from './analysis-protocol';

type Listener = (snapshot: AnalysisSnapshot) => void;
interface AnalysisWorker {
  onmessage: ((event: MessageEvent<AnalysisResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: AnalysisRequest): void;
  terminate(): void;
}
interface Job {
  id: number;
  key: string;
  input: AnalysisInput;
  listeners: Set<Listener>;
  snapshot: AnalysisSnapshot;
  failed: boolean;
}

/** A single reusable worker preserves solver tables between solves. Only
 * completed, successful results enter the bounded content-keyed LRU cache. */
export function createReconstructionAnalyzer(createWorker: () => AnalysisWorker) {
  const cache = new Map<string, AnalysisSnapshot>();
  const jobs = new Map<string, Job>();
  let worker: AnalysisWorker | null = null;
  let active: Job | null = null;
  let nextId = 0;
  let pumpTimer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  function terminate() {
    clearTimeout(deadline);
    clearTimeout(idleTimer);
    worker?.terminate();
    worker = null;
  }
  function notify(job: Job) {
    for (const listener of job.listeners) listener(job.snapshot);
  }
  function schedule() {
    clearTimeout(pumpTimer);
    // Also absorbs React StrictMode's subscribe/unsubscribe/subscribe cycle.
    pumpTimer = setTimeout(pump, 0);
  }
  function finish(job: Job) {
    clearTimeout(deadline);
    job.snapshot = { ...job.snapshot, status: job.failed ? 'error' : 'complete' };
    jobs.delete(job.key);
    active = null;
    if (!job.failed) {
      cache.set(job.key, job.snapshot);
      if (cache.size > 8) cache.delete(cache.keys().next().value!);
    }
    notify(job);
    schedule();
  }
  function fail(job: Job) {
    terminate();
    job.failed = true;
    finish(job);
  }
  function pump() {
    if (active) return;
    const job = jobs.values().next().value as Job | undefined;
    if (!job) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(terminate, 60_000);
      return;
    }
    active = job;
    clearTimeout(idleTimer);
    try {
      worker ??= createWorker();
      worker.onmessage = ({ data }) => {
        // Ignore late messages from a cancelled/replaced request or worker.
        if (active !== job || data.id !== job.id) return;
        if (data.error) {
          job.failed = true;
          console.warn('[reconstruct] worker analysis failed:', data.error);
        }
        if (data.patch) job.snapshot = { ...job.snapshot, ...data.patch };
        if (data.done) finish(job);
        else notify(job);
      };
      worker.onerror = () => { if (active === job) fail(job); };
      worker.onmessageerror = () => { if (active === job) fail(job); };
      deadline = setTimeout(() => { if (active === job) fail(job); }, 60_000);
      worker.postMessage({ id: job.id, input: job.input });
    } catch { fail(job); }
  }

  return {
    subscribe(input: AnalysisInput, listener: Listener): () => void {
      // Include all physical moves, timestamps, orientation and metric inputs;
      // a corrected solve must never reuse the old solve's analysis.
      const key = JSON.stringify(input);
      const cached = cache.get(key);
      if (cached) {
        cache.delete(key);
        cache.set(key, cached);
        listener(cached);
        return () => {};
      }
      let job = jobs.get(key);
      if (!job) {
        job = { id: ++nextId, key, input, listeners: new Set(), snapshot: emptyAnalysis(), failed: false };
        jobs.set(key, job);
      }
      // Each subscription owns its cleanup even if a callback is reused.
      const subscriber: Listener = snapshot => listener(snapshot);
      job.listeners.add(subscriber);
      listener(job.snapshot);
      schedule();
      return () => {
        job.listeners.delete(subscriber);
        if (job.listeners.size || jobs.get(key) !== job) return;
        jobs.delete(key);
        if (active === job) {
          terminate();
          active = null;
        }
        schedule();
      };
    },
    dispose() {
      clearTimeout(pumpTimer);
      terminate();
      active = null;
      jobs.clear();
      cache.clear();
    },
  };
}

export const reconstructionAnalyzer = createReconstructionAnalyzer(() => (
  new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
));
