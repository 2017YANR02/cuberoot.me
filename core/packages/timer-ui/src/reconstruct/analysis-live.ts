import type { TimerSettingCopy } from '@cuberoot/shared/timer/settings-contract';
import type { ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { MethodId } from '@cuberoot/shared/timer/reconstruct/methods';
import type { createReconstructionAnalyzer } from './analysis-core';
import { confirmedReconPrefix, isAnalysisContinuation } from './analysis-protocol';
import type { AnalysisInput, AnalysisSnapshot } from './analysis-protocol';

export const TIMER_LIVE_SOLUTION_COPY = { zh: '实时解法', en: 'Live solution' };

export function liveReconstructionStage(
  method: MethodId,
  segments: AnalysisInput['text']['segs'] | null | undefined,
  text: ReconTextResult | null,
  localize: (copy: TimerSettingCopy) => string,
) {
  const label = method !== 'cfop' ? (text?.currentStage ? localize(text.currentStage) : '…')
    : segments?.ollEndIdx != null ? 'PLL'
      : segments?.f2lEndIdx != null ? 'OLL'
        : segments?.crossEndIdx != null ? `F2L-${Math.min(4, (text?.lines.filter(line => line.kind === 'f2l').length ?? 0) + 1)}`
          : 'Cross';
  return { label, moves: text?.lines.find(line => line.key === 'tail')?.moves.join(' ') || '…' };
}

/** Finish the current snapshot, then analyze the newest one. Continuous turns
 * must not repeatedly terminate a worker before it can publish stage labels. */
export function createLiveReconstructionStream(
  listener: (input: AnalysisInput, snapshot: AnalysisSnapshot) => void,
  analyzer: Pick<ReturnType<typeof createReconstructionAnalyzer>, 'subscribe'>,
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
    const request = prefix?.lines.length ? { ...input,
      confirmedMethod: confirmed?.snapshot.method ?? confirmed?.input.text.method,
      text: { ...input.text, confirmed: prefix } } : input;
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
