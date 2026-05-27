/**
 * Multi-stage CFOP timer.
 *
 * Tracks elapsed time at the moment each CFOP stage is *first* completed
 * during a running solve. PLL is set automatically when the timer stops.
 *
 * Inputs:
 *   - `phase` from useTimer (we listen for 'idle'/'running'/'stopped' transitions)
 *   - `displayMs` (live elapsed during running)
 *   - manual marks via `markStage('cross' | 'f2l' | 'oll')`
 *   - automatic marks: caller can poll `consumeFromState(faces)` after each
 *     bluetooth move; we detect stage transitions and record the time.
 *
 * Output:
 *   - `liveStages`: snapshot of current splits (re-renders when a mark lands)
 *   - `extractFinal(timeMs)`: return the {cross,f2l,oll,pll} payload to attach
 *     to the recorded Solve. Caller calls this when the timer transitions to
 *     'stopped' with the final timeMs. Resets internal buffers.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { detectCfopStage, stageRank } from './cube/cfop_detect';
import type { CfopStage } from './cube/cfop_detect';
import type { CubeFaces } from './cube/state';
import type { TimerPhase } from './useTimer';

export type ManualStage = 'cross' | 'f2l' | 'oll';

export interface MultiStageHandle {
  /** Live splits for the running solve. PLL is filled on stop. */
  liveStages: { cross?: number; f2l?: number; oll?: number };
  /** Manually mark a stage as completed *now* (relative to solve start). */
  markStage(stage: ManualStage): void;
  /** Feed a fresh cube state — auto-marks stages that just got reached. */
  consumeFromState(faces: CubeFaces): void;
  /** Called by parent when the timer stops; returns final stage payload and
   *  clears internal buffers for the next solve. */
  extractFinal(finalMs: number): NonNullable<import('./types').Solve['stages']>;
}

interface UseMultiStageOpts {
  /** Current timer phase from useTimer. */
  phase: TimerPhase;
  /** Live elapsed ms (only meaningful while phase==='running'). */
  displayMs: number;
  /** Whether multistage tracking is active for this event. */
  enabled: boolean;
}

export function useMultiStage(opts: UseMultiStageOpts): MultiStageHandle {
  const { phase, displayMs, enabled } = opts;

  const [liveStages, setLiveStages] = useState<MultiStageHandle['liveStages']>({});

  const stagesRef = useRef<MultiStageHandle['liveStages']>({});
  const lastDetectedRef = useRef<CfopStage>('scrambled');
  const displayMsRef = useRef(0);
  useEffect(() => { displayMsRef.current = displayMs; }, [displayMs]);

  // Reset whenever we ENTER the running phase (i.e. begin a fresh solve).
  // The setState-in-effect lint warning is suppressed because resetting on a
  // phase boundary is exactly the legitimate use case for this pattern.
  useEffect(() => {
    if (phase === 'running') {
      stagesRef.current = {};
      lastDetectedRef.current = 'scrambled';
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveStages({});
    }
  }, [phase]);

  const setIfMissing = useCallback((stage: ManualStage, ms: number) => {
    if (!enabled) return;
    if (stagesRef.current[stage] !== undefined) return; // first sample wins
    stagesRef.current = { ...stagesRef.current, [stage]: ms };
    setLiveStages(stagesRef.current);
  }, [enabled]);

  const markStage = useCallback((stage: ManualStage) => {
    if (phase !== 'running') return;
    setIfMissing(stage, displayMsRef.current);
  }, [phase, setIfMissing]);

  const consumeFromState = useCallback((faces: CubeFaces) => {
    if (!enabled || phase !== 'running') return;
    const stage = detectCfopStage(faces);
    const lastRank = stageRank(lastDetectedRef.current);
    const newRank = stageRank(stage);
    if (newRank <= lastRank) return; // no advancement
    // Backfill any missing stages between (lastRank, newRank] in one go —
    // the user might have slammed cross+F2L together (e.g. a cross-into-XCross).
    const order: ManualStage[] = ['cross', 'f2l', 'oll'];
    for (const s of order) {
      if (stageRank(s) <= newRank) setIfMissing(s, displayMsRef.current);
    }
    lastDetectedRef.current = stage;
  }, [enabled, phase, setIfMissing]);

  const extractFinal = useCallback((finalMs: number): NonNullable<import('./types').Solve['stages']> => {
    const out: NonNullable<import('./types').Solve['stages']> = {
      ...stagesRef.current,
      pll: finalMs,
    };
    stagesRef.current = {};
    lastDetectedRef.current = 'scrambled';
    setLiveStages({});
    return out;
  }, []);

  return { liveStages, markStage, consumeFromState, extractFinal };
}
