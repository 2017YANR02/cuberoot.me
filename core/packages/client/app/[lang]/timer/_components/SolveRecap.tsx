'use client';
import SharedSolveRecap, { type SolveRecapProps } from '@cuberoot/timer-ui/solve-recap';
import { useWebReconstructHost } from './useWebReconstructHost';
export type { SolveRecapProps } from '@cuberoot/timer-ui/solve-recap';
export default function SolveRecap(props: Omit<SolveRecapProps, 'host'>) {
  const host = useWebReconstructHost();
  return <SharedSolveRecap {...props} host={host} />;
}
