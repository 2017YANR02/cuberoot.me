'use client';

import { TimerSolveDetailModal } from '@cuberoot/timer-ui';
import ReconstructActions from '@cuberoot/timer-ui/reconstruct-actions';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';

import { tr } from '@/i18n/tr';
import { onIdle } from '@/lib/on-idle';

import CubePreview from '../_lib/cube/CubePreview';
import { useWebReconstructHost } from './useWebReconstructHost';
import type { Penalty, Solve } from '../_lib/types';

/** Keep the 200 KB reconstruction chain in its own Web-only chunk. */
const ReconstructReport = dynamic(() => import('./ReconstructReport'), { ssr: false });

interface Props {
  history?: Solve[];
  index: number;
  isZh: boolean;
  moveTargets?: { id: string; name: string }[];
  onChangeComment: (text: string) => void;
  onChangePenalty: (penalty: Penalty) => void;
  onClose: () => void;
  onDelete: () => void;
  onDisplayed?: () => void;
  onMoveToSession?: (targetSessionId: string) => void;
  onReconFeedback?: (ok: boolean | undefined) => void;
  onUseScramble?: (scramble: string) => void;
  solve: Solve;
}

/** Web adapter: native preview/report slots around the one shared detail UI. */
export default function SolveModal({
  history,
  index,
  isZh,
  moveTargets,
  onChangeComment,
  onChangePenalty,
  onClose,
  onDelete,
  onDisplayed,
  onMoveToSession,
  onReconFeedback,
  onUseScramble,
  solve,
}: Props) {
  const hasMoves = (solve.moves?.length ?? 0) > 0;
  const reconstructHost = useWebReconstructHost();
  const handleUseScramble = onUseScramble && ((scramble: string) => {
    onUseScramble(scramble);
    onClose();
  });

  // The dynamic wrapper can exist before this component has painted. Arm move
  // gestures only after two frames so loading turns cannot dismiss the recap.
  useEffect(() => {
    if (!onDisplayed) return;
    let visibleFrame = 0;
    const mountedFrame = window.requestAnimationFrame(() => {
      visibleFrame = window.requestAnimationFrame(onDisplayed);
    });
    return () => {
      window.cancelAnimationFrame(mountedFrame);
      if (visibleFrame) window.cancelAnimationFrame(visibleFrame);
    };
  }, [onDisplayed, solve.id]);

  // The report owns several nested lazy chunks. Start those downloads together
  // after the detail opens instead of serially waiting for each child mount.
  useEffect(() => {
    if (!hasMoves) return;
    return onIdle(() => {
      void import('@cuberoot/timer-ui/SimCubeView');
      void import('@cuberoot/puzzle-render-core/sim/mountSimWorld');
      void import('@cuberoot/shared/recon/oll-lookup').then((module) => module.prewarmOllTable());
      void import('@cuberoot/shared/recon/pll-lookup').then((module) => module.prewarmPllTable());
    }, { timeout: 500 });
  }, [hasMoves]);

  return (
    <TimerSolveDetailModal
      fullHeaderActions={hasMoves ? (
        <ReconstructActions
          host={reconstructHost}
          onUseScramble={handleUseScramble}
          placement="detail"
          solve={solve}
        />
      ) : undefined}
      index={index}
      localize={tr}
      moveTargets={moveTargets}
      onChangeComment={onChangeComment}
      onChangePenalty={onChangePenalty}
      onClose={onClose}
      onDelete={onDelete}
      onMoveToSession={onMoveToSession}
      preview={<CubePreview event={solve.event} scramble={solve.scramble} size={14} />}
      report={hasMoves ? (
        <ReconstructReport
          history={history}
          hideActions
          hideDate
          isZh={isZh}
          onReconFeedback={onReconFeedback}
          onUseScramble={handleUseScramble}
          solve={solve}
        />
      ) : undefined}
      solve={solve}
    />
  );
}
