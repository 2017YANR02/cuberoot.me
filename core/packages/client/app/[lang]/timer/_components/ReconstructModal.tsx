'use client';
import SharedReconstructModal, { type ReconstructModalProps } from '@cuberoot/timer-ui/reconstruct-modal';
import { useWebReconstructHost } from './useWebReconstructHost';

export default function ReconstructModal(props: Omit<ReconstructModalProps, 'host'>) {
  const host = useWebReconstructHost();
  return <SharedReconstructModal {...props} host={host} />;
}
