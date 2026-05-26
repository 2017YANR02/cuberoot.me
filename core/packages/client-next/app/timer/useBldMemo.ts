/**
 * BLD memo split — lets the user mark the moment they finish memorizing on
 * blindfolded events. Memo split time is attached to the recorded Solve.
 *
 * Bound to Enter key. First mark wins; subsequent calls no-op until next solve.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimerPhase } from './useTimer';

export interface BldMemoHandle {
  memoMs: number | undefined;
  markMemo: () => void;
  extractFinal: () => { memoMs: number } | undefined;
}

interface Opts {
  phase: TimerPhase;
  displayMs: number;
  enabled: boolean;
}

export function useBldMemo(opts: Opts): BldMemoHandle {
  const { phase, displayMs, enabled } = opts;

  const [memoMs, setMemoMs] = useState<number | undefined>(undefined);
  const memoMsRef = useRef<number | undefined>(undefined);
  const displayMsRef = useRef(0);
  useEffect(() => { displayMsRef.current = displayMs; }, [displayMs]);

  useEffect(() => {
    if (phase === 'running') {
      memoMsRef.current = undefined;
      setMemoMs(undefined);
    }
  }, [phase]);

  const markMemo = useCallback(() => {
    if (!enabled) return;
    if (memoMsRef.current !== undefined) return;
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

export function isBldEvent(eventId: string): boolean {
  return eventId === '333bld' || eventId === '444bld' || eventId === '555bld' || eventId === '333mbld';
}
