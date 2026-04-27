/**
 * BLD memo split — for blindfolded events, lets the user mark the moment they
 * finish memorizing so we can record memo / execution as separate splits.
 *
 * Inputs:
 *   - `phase` from useTimer
 *   - `displayMs` (live elapsed during running)
 *   - `enabled` — only true when the active event is BLD AND the setting is on
 *   - manual mark via `markMemo()` (typically bound to Enter)
 *
 * Output:
 *   - `memoMs`: undefined while memorizing, set when split is taken
 *   - `extractFinal(timeMs)`: returns the {memoMs} payload to attach to the
 *     recorded Solve. Caller calls this when the timer transitions to 'stopped'.
 *     Resets internal state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimerPhase } from './useTimer';

export interface BldMemoHandle {
  /** Memo split if taken, undefined otherwise. */
  memoMs: number | undefined;
  /** Mark "memo done" *now*. First call wins; subsequent calls no-op. */
  markMemo(): void;
  /** Called by parent when the timer stops; returns final BLD payload (or
   *  undefined if no split was taken). Clears internal state. */
  extractFinal(): { memoMs: number } | undefined;
}

interface UseBldMemoOpts {
  phase: TimerPhase;
  displayMs: number;
  enabled: boolean;
}

export function useBldMemo(opts: UseBldMemoOpts): BldMemoHandle {
  const { phase, displayMs, enabled } = opts;

  const [memoMs, setMemoMs] = useState<number | undefined>(undefined);
  const memoMsRef = useRef<number | undefined>(undefined);

  const displayMsRef = useRef(0);
  useEffect(() => { displayMsRef.current = displayMs; }, [displayMs]);

  // Reset whenever a new solve begins.
  useEffect(() => {
    if (phase === 'running') {
      memoMsRef.current = undefined;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMemoMs(undefined);
    }
  }, [phase]);

  const markMemo = useCallback(() => {
    if (!enabled) return;
    if (memoMsRef.current !== undefined) return; // first wins
    const m = displayMsRef.current;
    memoMsRef.current = m;
    setMemoMs(m);
  }, [enabled]);

  const extractFinal = useCallback((): { memoMs: number } | undefined => {
    const m = memoMsRef.current;
    memoMsRef.current = undefined;
    setMemoMs(undefined);
    return m === undefined ? undefined : { memoMs: m };
  }, []);

  return { memoMs, markMemo, extractFinal };
}
