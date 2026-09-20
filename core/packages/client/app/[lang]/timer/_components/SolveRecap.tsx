'use client';

import { useEffect, useState } from 'react';
import SharedSolveRecap, { type SolveRecapProps } from '@cuberoot/timer-ui/solve-recap';
import SolveRecapPlaceholder from '@cuberoot/timer-ui/solve-recap-placeholder';
import { useWebReconstructHost } from './useWebReconstructHost';

export type { SolveRecapProps } from '@cuberoot/timer-ui/solve-recap';

export default function SolveRecap(props: Omit<SolveRecapProps, 'host'>) {
  const host = useWebReconstructHost();
  const solveId = props.solve.id;
  const [revealedSolveId, setRevealedSolveId] = useState<string | null>(null);

  useEffect(() => {
    const revealFrame = requestAnimationFrame(() => setRevealedSolveId(solveId));
    return () => cancelAnimationFrame(revealFrame);
  }, [solveId]);

  if (revealedSolveId !== props.solve.id) return <SolveRecapPlaceholder />;
  return <SharedSolveRecap {...props} host={host} />;
}
