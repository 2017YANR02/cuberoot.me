'use client';

import { TimerSolveDetailModal } from '@cuberoot/timer-ui';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';

import { tr } from '@/i18n/tr';
import { onIdle } from '@/lib/on-idle';

import CubePreview from '../_lib/cube/CubePreview';
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
  onMoveToSession,
  onReconFeedback,
  onUseScramble,
  solve,
}: Props) {
  const hasMoves = (solve.moves?.length ?? 0) > 0;

  // The report owns several nested lazy chunks. Start those downloads together
  // after the detail opens instead of serially waiting for each child mount.
  useEffect(() => {
    if (!hasMoves) return;
    return onIdle(() => {
      void import('@/components/sim-embed/SimCubeView');
      void import('@/components/sim-embed/mountSimWorld');
      void import('@/lib/oll_lookup').then((module) => module.prewarmOllTable());
      void import('@/lib/pll_lookup').then((module) => module.prewarmPllTable());
    }, { timeout: 500 });
  }, [hasMoves]);

  return (
    <TimerSolveDetailModal
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
          hideDate
          isZh={isZh}
          onReconFeedback={onReconFeedback}
          onUseScramble={onUseScramble && ((scramble) => {
            onUseScramble(scramble);
            onClose();
          })}
          solve={solve}
        />
      ) : undefined}
      solve={solve}
    />
  );
}
