'use client';

import { TimerSolveDetailModal } from '@cuberoot/timer-ui';
import ReconstructActions from '@cuberoot/timer-ui/reconstruct-actions';
import { SolveRecapBodyPlaceholder } from '@cuberoot/timer-ui/solve-recap-placeholder';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { ReconSnapshot } from '@cuberoot/shared/recon-ground-truth';

import { tr } from '@/i18n/tr';
import { onIdle } from '@/lib/on-idle';

import CubePreview from '../_lib/cube/CubePreview';
import { useWebReconstructHost } from './useWebReconstructHost';
import type { Penalty, Solve } from '../_lib/types';

/** Keep the 200 KB reconstruction chain in its own Web-only chunk. */
const ReconstructReport = dynamic(() => import('./ReconstructReport'), {
  ssr: false,
  loading: SolveRecapBodyPlaceholder,
});

interface Props {
  closeRequested?: boolean;
  history?: Solve[];
  index: number;
  isZh: boolean;
  moveTargets?: { id: string; name: string }[];
  onChangeComment?: (text: string) => void;
  onChangePenalty?: (penalty: Penalty) => void;
  onClose: () => void;
  onDelete?: () => void;
  onDisplayed?: () => void;
  onMoveToSession?: (targetSessionId: string) => void;
  onReconFeedback?: (ok: boolean | undefined) => void;
  onUseScramble?: (scramble: string) => void;
  solve: Solve;
  title?: string;
  reportStatus?: ReactNode;
  sourceVideo?: ReactNode;
}

/** Web adapter: native preview/report slots around the one shared detail UI. */
export default function SolveModal({
  closeRequested = false,
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
  title,
  reportStatus,
  sourceVideo,
}: Props) {
  const hasMoves = !reportStatus && solve.event !== 'pll-chain' && (solve.moves?.length ?? 0) > 0;
  const reconstructHost = useWebReconstructHost();
  const [review, setReview] = useState<{ id: string; snapshot: ReconSnapshot | null } | null>(null);
  const receiveReview = useCallback((snapshot: ReconSnapshot | null) => setReview({ id: solve.id, snapshot }), [solve.id]);
  const [localCloseRequested, setLocalCloseRequested] = useState(false);
  const handleUseScramble = onUseScramble && ((scramble: string) => {
    onUseScramble(scramble);
    setLocalCloseRequested(true);
  });

  // The report owns several nested lazy chunks. Start those downloads together
  // after the detail opens instead of serially waiting for each child mount.
  useEffect(() => {
    if (!hasMoves) return;
    return onIdle(() => {
      void import('@cuberoot/timer-ui/SimCubeView');
      void import('@cuberoot/puzzle-render-core/sim/mountSimWorld');
    }, { timeout: 500 });
  }, [hasMoves]);

  return (
    <TimerSolveDetailModal
      closeRequested={closeRequested || localCloseRequested}
      fullHeaderActions={hasMoves && !title ? (
        <ReconstructActions
          host={reconstructHost}
          onUseScramble={handleUseScramble}
          placement="detail"
          solve={solve}
          snapshot={review?.id === solve.id ? review.snapshot : null}
        />
      ) : undefined}
      index={index}
      title={title}
      localize={tr}
      moveTargets={moveTargets}
      onChangeComment={onChangeComment}
      onChangePenalty={onChangePenalty}
      onClose={onClose}
      onDelete={onDelete}
      onEntered={onDisplayed}
      onMoveToSession={onMoveToSession}
      onUseScramble={handleUseScramble}
      preview={solve.event !== 'pll-chain' ? <CubePreview event={solve.event} scramble={solve.scramble} size={14} /> : undefined}
      report={reportStatus || hasMoves || sourceVideo ? <>
        {!title && solve.videoReconstruction && (reportStatus || solve.videoReconstruction === 'solved') && <strong>{tr({ zh: '视频复盘', en: 'Video reconstruction' })}</strong>}
        {reportStatus}
        {hasMoves && (
        <ReconstructReport
          history={history}
          hideActions
          hideDate
          pendingFallback={<SolveRecapBodyPlaceholder />}
          isZh={isZh}
          onReconFeedback={onReconFeedback}
          onReviewSnapshot={receiveReview}
          onUseScramble={handleUseScramble}
          solve={solve}
        />)}
        {sourceVideo}
      </> : undefined}
      solve={solve}
    />
  );
}
