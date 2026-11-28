import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useT } from '@/hooks/useT';
import './video-recon-progress.css';

export function VideoFrameProgressRing({ progress, label }: { progress: number; label: string }) {
  return <svg className="video-frame-progress-ring" role="progressbar" aria-label={label}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
    <rect x="1" y="1" rx="9" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress} />
  </svg>;
}

export function videoFileFrameProgress(view?: { videoInputComplete: boolean; solveStart: number; solveEnd: number; position: number }) {
  if (!view || view.videoInputComplete || view.solveEnd <= view.solveStart) return;
  return Math.max(0, Math.min(99, Math.floor(100 * (view.position - view.solveStart) / (view.solveEnd - view.solveStart))));
}

export function VideoReconProgress({ label, value, detail, showTrack = false, showPercentage = true }: {
  label: string; value?: number; detail?: string; showTrack?: boolean; showPercentage?: boolean;
}) {
  if (value === undefined && !showTrack) return <LoadingIndicator>{label}</LoadingIndicator>;
  return <div className="video-recon-progress">
    <div className="video-recon-progress-heading">
      <span role="status">{label}</span>
      {showPercentage && value !== undefined && <strong aria-hidden="true">{detail ? `${detail} · ` : ''}{value}%</strong>}
    </div>
    <progress aria-label={label} aria-valuetext={value !== undefined && detail ? `${detail} · ${value}%` : undefined} max={100} value={value} />
  </div>;
}

export function VideoReconAnalysisProgress({ value, onFrame = false }: { value?: number; onFrame?: boolean }) {
  const t = useT();
  const label = value === undefined ? t('生成复盘...', 'Generating reconstruction...') : t('分析视频...', 'Analyzing video...');
  if (onFrame) return <>
    <VideoFrameProgressRing label={label} progress={value ?? 100} />
    {value !== undefined && <span aria-hidden="true" className="video-analysis-runner" style={{ offsetDistance: `${value}%` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Preserve the animated SVG rig. */}
      <img src="/deskpet/rootbeast-run.svg?v=1" width="48" height="48" alt="" draggable={false} />
    </span>}
  </>;
  return <VideoReconProgress label={label} value={value} showTrack showPercentage={false} />;
}
