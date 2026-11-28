import { useEffect, useRef } from 'react';
import { loadMotionBlob } from '@/lib/deskpet-motion';
import { ROOTBEAST_RECON_REACTIONS } from '@/lib/deskpet-rootbeast';
import type { VideoWorkspace } from '@/lib/video-recon/workspace';

type Reaction = keyof typeof ROOTBEAST_RECON_REACTIONS;
type Result = { id: number | string; outcome: Reaction };
type View = ReturnType<VideoWorkspace['getSnapshot']>;

export function videoReconReaction(view: View | null, hasMoves: boolean, verified: boolean | undefined): Result | undefined {
  if (!view) return;
  if (view.activeTab === 'detector' && view.sourceKind === 'video' && view.fileReviewId !== undefined) {
    const id = view.fileReviewId;
    if (!view.trimming && view.reconstructionComplete) {
      if (!view.cubeSolved || !hasMoves || view.searchError) return { id, outcome: 'failure' };
      // Move search can finish before notation and scramble verification.
      if (verified !== undefined) return { id, outcome: verified ? 'success' : 'failure' };
    } else if (view.mediaError || view.status === 'error') {
      return { id, outcome: 'failure' };
    }
  }
  if (view.activeTab === 'record' && view.cameraRecordingAttempt && !view.recordingReview) {
    const id = view.cameraRecordingAttempt;
    if (view.cameraRecordingPhase === 'complete') return { id, outcome: 'success' };
    // A failed live pass with a usable file automatically retries. A cancelled
    // retry has no verdict; only a finished file review sets recovered to false.
    if (view.cameraRecordingPhase === 'error' && (!view.cameraRecordingFile || view.cameraRecordingRecovered === false)) {
      return { id, outcome: 'failure' };
    }
  }
}

export function VideoReconResultPet({ result }: { result?: Result }) {
  const frame = useRef<HTMLImageElement>(null);
  // Returning to a previous result must not replay its celebration.
  const lastShown = useRef<{ file?: number | string; recording?: number | string }>({});
  const id = result?.id;
  const clip = result && ROOTBEAST_RECON_REACTIONS[result.outcome];
  useEffect(() => {
    const image = frame.current;
    if (!image || !clip || id === undefined) return;
    const source = typeof id === 'number' ? 'file' : 'recording';
    if (lastShown.current[source] === id || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let active = true;
    let url: string | undefined;
    let finish: number | undefined;
    const clear = () => {
      window.clearTimeout(finish);
      if (url) URL.revokeObjectURL(url);
      url = undefined;
      image.hidden = true;
      image.removeAttribute('src');
    };
    const reveal = () => {
      lastShown.current[source] = id;
      image.hidden = false;
      finish = window.setTimeout(clear, clip.durationMs);
    };
    image.addEventListener('load', reveal);
    image.addEventListener('error', clear);
    void loadMotionBlob(clip.src).then(blob => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      image.src = url;
    }).catch(() => { if (active) clear(); });
    return () => {
      active = false;
      image.removeEventListener('load', reveal);
      image.removeEventListener('error', clear);
      clear();
    };
  }, [clip, id]);
  if (!clip) return null;
  // eslint-disable-next-line @next/next/no-img-element -- Each play needs a fresh SVG document timeline.
  return <img key={id} ref={frame} hidden aria-hidden="true" alt="" draggable={false} className="video-recon-result-pet"
    style={{ animationDuration: `${clip.durationMs}ms` }} />;
}
