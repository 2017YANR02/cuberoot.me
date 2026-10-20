import { createReconstructionAnalyzer } from './analysis-core';
import type { AnalysisInput, AnalysisSnapshot } from './analysis-protocol';
export { createReconstructionAnalyzer } from './analysis-core';
export type { AnalysisInput, AnalysisRequest, AnalysisResponse, AnalysisSnapshot } from './analysis-protocol';

export const reconstructionAnalyzer = createReconstructionAnalyzer(() => (
  new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
));

/** Finish the current snapshot, then analyze the newest one. Continuous turns
 * must not repeatedly terminate a worker before it can publish stage labels. */
export function createLiveReconstructionStream(
  listener: (input: AnalysisInput, snapshot: AnalysisSnapshot) => void,
  analyzer = reconstructionAnalyzer,
) {
  let pending: AnalysisInput | null = null;
  let busy = false;
  let disposed = false;
  let unsubscribe: (() => void) | undefined;
  let next: ReturnType<typeof setTimeout> | undefined;

  function pump() {
    if (disposed || busy || !pending) return;
    const input = pending;
    pending = null;
    busy = true;
    unsubscribe = analyzer.subscribe(input, snapshot => {
      if (disposed) return;
      listener(input, snapshot);
      if (snapshot.status !== 'pending') {
        // Cached subscriptions may complete synchronously, before subscribe
        // returns its cleanup. Defer the handoff in both cases.
        next = setTimeout(() => {
          unsubscribe?.();
          unsubscribe = undefined;
          busy = false;
          pump();
        }, 0);
      }
    });
  }

  return {
    update(input: AnalysisInput) {
      if (disposed) return;
      pending = input;
      pump();
    },
    dispose() {
      disposed = true;
      pending = null;
      clearTimeout(next);
      unsubscribe?.();
    },
  };
}
