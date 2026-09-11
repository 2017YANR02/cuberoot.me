'use client';
import SharedReconstructReport, { type ReconstructReportProps } from '@cuberoot/timer-ui/reconstruct-report';
import { useWebReconstructHost } from './useWebReconstructHost';
export type { ReconstructReportProps } from '@cuberoot/timer-ui/reconstruct-report';

export default function ReconstructReport(props: ReconstructReportProps) {
  const host = useWebReconstructHost();
  return <SharedReconstructReport {...props} host={host} />;
}
