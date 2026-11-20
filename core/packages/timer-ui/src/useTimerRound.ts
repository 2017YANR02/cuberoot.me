import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startTimerRound, timerRoundSolves, type TimerRoundBoundary, type RoundConfig, type Solve } from '@cuberoot/shared/timer';

/** A round is a view over history; deleting older solves must not shift its boundary. */
export function useTimerRound(solves: Solve[], config: RoundConfig, context: string) {
  const [boundary, setBoundary] = useState<TimerRoundBoundary | null>(null);
  const current = useRef({ solves, context });
  current.current = { solves, context };
  const reset = useCallback(() => setBoundary(null), []);
  useEffect(reset, [context, reset]);
  const start = useCallback(() => setBoundary(startTimerRound(current.current.solves, current.current.context)), []);
  const roundSolves = useMemo(() => timerRoundSolves(solves, config, context, boundary), [solves, config, context, boundary]);
  return { solves: roundSolves, start, reset };
}
