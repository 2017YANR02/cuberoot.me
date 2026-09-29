import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { roundAttempts, type RoundConfig, type Solve } from '@cuberoot/shared/timer';

/** A round is a view over history; deleting older solves must not shift its boundary. */
export function useTimerRound(solves: Solve[], config: RoundConfig, context: string) {
  const [boundary, setBoundary] = useState<{ context: string; ids: Set<string> } | null>(null);
  const current = useRef({ solves, context });
  current.current = { solves, context };
  const reset = useCallback(() => setBoundary(null), []);
  useEffect(reset, [context, reset]);
  const start = useCallback(() => setBoundary({
    context: current.current.context,
    ids: new Set(current.current.solves.map(solve => solve.id)),
  }), []);
  const roundSolves = useMemo(() => {
    if (!config.on) return [];
    const size = roundAttempts(config.format);
    return boundary?.context === context
      ? solves.filter(solve => !boundary.ids.has(solve.id)).slice(0, size)
      : solves.slice(-size);
  }, [solves, config.on, config.format, boundary, context]);
  return { solves: roundSolves, start, reset };
}
