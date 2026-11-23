import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useT } from '@/hooks/useT';
import './video-recon-progress.css';

export function videoFileFrameProgress(view?: { videoInputComplete: boolean; solveStart: number; solveEnd: number; position: number }) {
  if (!view || view.videoInputComplete || view.solveEnd <= view.solveStart) return;
  return Math.max(0, Math.min(99, Math.floor(100 * (view.position - view.solveStart) / (view.solveEnd - view.solveStart))));
}

export function VideoReconProgress({ label, value, detail, showTrack = false }: {
  label: string; value?: number; detail?: string; showTrack?: boolean;
}) {
  if (value === undefined && !showTrack) return <LoadingIndicator>{label}</LoadingIndicator>;
  return <div className="video-recon-progress">
    <div className="video-recon-progress-heading">
      <span role="status">{label}</span>
      {value !== undefined && <strong aria-hidden="true">{detail ? `${detail} · ` : ''}{value}%</strong>}
    </div>
    <progress aria-label={label} aria-valuetext={value !== undefined && detail ? `${detail} · ${value}%` : undefined} max={100} value={value} />
  </div>;
}

export function VideoReconAnalysisProgress({ value }: { value?: number }) {
  const t = useT();
  const label = value === undefined ? t('生成复盘...', 'Generating reconstruction...') : t('分析视频...', 'Analyzing video...');
  return <VideoReconProgress label={label} value={value} showTrack />;
}
