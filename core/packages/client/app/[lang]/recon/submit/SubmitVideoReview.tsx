'use client';

import dynamic from 'next/dynamic';
import ReconCaptionEditor from './ReconCaptionDialog';
import '../../video-recon/video-recon.css';
import type { VideoReviewSurface } from '../../video-recon/VideoReconClient';
import type { VerifiedVideoDraft } from '../../video-recon/VideoSolveAnalysis';

const VideoReconWorkspace = dynamic(() => import('../../video-recon/VideoReconClient').then(m => m.VideoReconWorkspace));

interface Props {
  file: File;
  event?: string;
  solution: string;
  scramble: string;
  captionScramble: string;
  canAnalyze: boolean;
  recognition?: VerifiedVideoDraft;
  onReady: (result?: VerifiedVideoDraft) => void;
  onApply?: (result: VerifiedVideoDraft) => void;
  onUse?: (file: File, draft?: VerifiedVideoDraft) => void;
}

export default function SubmitVideoReview({ file, event, solution, scramble, captionScramble, canAnalyze,
  recognition, onReady, onApply, onUse }: Props) {
  function captions(review?: VideoReviewSurface) {
    const draft = review?.verifiedDraft;
    const timed = draft ?? recognition;
    return <ReconCaptionEditor file={file} review={review} event={event} solution={draft?.solution ?? solution}
      recognition={timed} scramble={captionScramble || timed?.inferredScramble || ''}
      onApply={draft && onApply ? () => onApply(draft) : undefined}
      onUse={onUse ? video => onUse(video, draft) : undefined} />;
  }
  if (!canAnalyze) return captions();
  return <VideoReconWorkspace mode="detector" submission={{ file, scramble, captions, onReady, onApply }} />;
}
