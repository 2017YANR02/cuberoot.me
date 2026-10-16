import { emptyAnalysis } from './analysis-protocol';
import type { AnalysisInput, AnalysisRequest, AnalysisResponse, AnalysisSnapshot } from './analysis-protocol';
export type { AnalysisInput, AnalysisRequest, AnalysisResponse, AnalysisSnapshot } from './analysis-protocol';

type Listener = (snapshot: AnalysisSnapshot) => void;
export interface AnalysisWorker {
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
  skipText: boolean;
}

/** A single reusable worker preserves solver tables between solves. Text is
 * cached independently of reference scoring; full snapshots require success. */
export function createReconstructionAnalyzer(createWorker: () => AnalysisWorker) {
  const cache = new Map<string, AnalysisSnapshot>();
  const textCache = new Map<string, NonNullable<AnalysisSnapshot['text']>>();
  const liveResults = new Map<string, { input: AnalysisInput; text: NonNullable<AnalysisSnapshot['text']>; targetKey?: string }>();
  const jobs = new Map<string, Job>();
  let worker: AnalysisWorker | null = null;
  let active: Job | null = null;
  let nextId = 0;
  let pumpTimer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  function initialSnapshot(input: AnalysisInput, attemptId?: string): AnalysisSnapshot {
    const exact = textCache.get(JSON.stringify(input.text));
    if (exact) return { ...emptyAnalysis(), text: exact };
    const live = attemptId ? liveResults.get(attemptId) : undefined;
    if (!live) return emptyAnalysis();
    const key = JSON.stringify(input);
    if (live.targetKey && live.targetKey !== key) return emptyAnalysis();
    const before = live.input.text.physical ?? live.input.text;
    const after = input.text.physical ?? input.text;
    // Only an explicit same-attempt handoff can reuse a prefix. Edits, another
    // scramble, changed timestamps or a different viewing frame cannot use it.
    if (before.scramble !== after.scramble || !before.moves.length
      || before.moves.length > after.moves.length
      || live.input.text.viewRotation !== input.text.viewRotation
      || live.input.text.method !== input.text.method
      || live.input.text.language !== input.text.language
      || !before.moves.every((move, i) => move.m === after.moves[i].m && move.ts === after.moves[i].ts)) return emptyAnalysis();
    live.targetKey = key;
    return { ...emptyAnalysis(), text: live.text, provisional: true };
  }

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
        if (data.patch) {
          job.snapshot = { ...job.snapshot, ...data.patch };
          if (data.patch.text) {
            job.snapshot.provisional = false;
            const textKey = JSON.stringify(job.input.text);
            textCache.delete(textKey);
            textCache.set(textKey, data.patch.text);
            if (textCache.size > 8) textCache.delete(textCache.keys().next().value!);
          }
        }
        if (data.done) finish(job);
        else notify(job);
      };
      worker.onerror = () => { if (active === job) fail(job); };
      worker.onmessageerror = () => { if (active === job) fail(job); };
      deadline = setTimeout(() => { if (active === job) fail(job); }, 60_000);
      worker.postMessage({ id: job.id, input: job.input, skipText: job.skipText });
    } catch { fail(job); }
  }

  return {
    exportCache: () => [...cache],
    importCache(entries: Array<[string, AnalysisSnapshot]>) {
      for (const [key, value] of entries.slice(-8)) {
        if (value.status === 'complete' && value.text) cache.set(key, value);
      }
    },
    rememberLive(attemptId: string, input: AnalysisInput, snapshot: AnalysisSnapshot) {
      if (!snapshot.text || snapshot.provisional) return;
      liveResults.delete(attemptId);
      liveResults.set(attemptId, { input, text: snapshot.text });
      if (liveResults.size > 8) liveResults.delete(liveResults.keys().next().value!);
    },
    handoff(fromAttemptId: string, toSolveId: string) {
      const live = liveResults.get(fromAttemptId);
      liveResults.delete(fromAttemptId);
      liveResults.delete(toSolveId);
      if (live) liveResults.set(toSolveId, live);
    },
    peek(input: AnalysisInput, attemptId?: string): AnalysisSnapshot {
      return cache.get(JSON.stringify(input)) ?? initialSnapshot(input, attemptId);
    },
    subscribe(input: AnalysisInput, listener: Listener, attemptId?: string): () => void {
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
        const snapshot = initialSnapshot(input, attemptId);
        job = { id: ++nextId, key, input, listeners: new Set(), snapshot, failed: false,
          skipText: Boolean(snapshot.text && !snapshot.provisional) };
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
      textCache.clear();
      liveResults.clear();
    },
  };
}

