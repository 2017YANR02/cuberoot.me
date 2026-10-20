import { createReconstructionAnalyzer } from './analysis-core';
import { confirmedReconPrefix, isAnalysisContinuation } from './analysis-protocol';
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
  let confirmed: { input: AnalysisInput; snapshot: AnalysisSnapshot } | null = null;
  let busy = false;
  let disposed = false;
  let unsubscribe: (() => void) | undefined;
  let next: ReturnType<typeof setTimeout> | undefined;

  function pump() {
    if (disposed || busy || !pending) return;
    const input = pending;
    pending = null;
    busy = true;
    const prefix = confirmed && isAnalysisContinuation(confirmed.input, input) && confirmed.snapshot.text
      ? confirmedReconPrefix(confirmed.input.text, confirmed.snapshot.text) : undefined;
    const request = prefix?.lines.length ? { ...input, text: { ...input.text, confirmed: prefix } } : input;
    unsubscribe = analyzer.subscribe(request, snapshot => {
      if (disposed) return;
      // Publish only the corrected result, never the replaceable draft.
      if (snapshot.status === 'complete' && snapshot.text) {
        confirmed = { input, snapshot };
        listener(input, snapshot);
      } else if (snapshot.status === 'error' || !snapshot.text) listener(input, snapshot);
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
