import { ChevronLeft, ChevronRight } from '@app-foundation/icons/lucide';
import BoolToggle from '@/components/BoolToggle';
import { Tooltip } from '@/components/Tooltip';
import { VideoTrimTimeline } from '@/components/VideoTrimTimeline';
import { useT } from '@/hooks/useT';
import { timecode } from '@/lib/video-recon/engine/solve-range';
import type { VideoWorkspace } from '@/lib/video-recon/workspace';

export function SolveRange({ view, workspace, onBegin, showScramble = true, timerScramble }: {
  view: ReturnType<VideoWorkspace['getSnapshot']>;
  workspace: VideoWorkspace;
  onBegin: () => void;
  showScramble?: boolean;
  timerScramble?: string;
}) {
  const t = useT();
  const { solveStart, solveEnd, duration, thumbnails, position, sourceFps } = view;
  const start = t('开始', 'Start');
  const end = t('结束', 'End');
  return <section className="video-recon-setup">
    <VideoTrimTimeline total={duration} start={solveStart} end={solveEnd} position={position}
      timeLabel={timecode(position)} step={1 / (sourceFps || 30)}
      labels={{ start, end, seek: t('视频进度', 'Video position') }}
      onSeek={workspace.previewSelection} onTrim={(side, timestamp) => workspace.changeTrim(side === 'left' ? 'start' : 'end', timestamp)}
      thumbnails={Array.from({ length: 10 }, (_, index) => (
        <div className="video-timeline-thumb" key={index}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Browser-generated object URLs. */}
          {thumbnails[index] && <img src={thumbnails[index]} alt="" draggable={false} />}
        </div>
      ))} />
    <div className="video-recon-actions">
      {([-1, 1] as const).map(direction => {
        const label = direction < 0 ? t('上一帧', 'Previous frame') : t('下一帧', 'Next frame');
        return <Tooltip key={direction} content={label}>{tip =>
          <button {...tip} type="button" className="btn-secondary" aria-label={label}
            disabled={view.cropLoading || !!view.cropPreview}
            onClick={() => workspace.stepPreview(direction)}>
            {direction < 0 ? <ChevronLeft size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
          </button>
        }</Tooltip>;
      })}
      <label className="video-recon-inline-label">{t('开始（秒）', 'Start (s)')}
        <input key={`start-${solveStart}`} type="number" min={0} max={solveEnd} step="0.01" defaultValue={solveStart.toFixed(2)}
          onBlur={event => {
            if (event.currentTarget.value) workspace.changeTrim('start', event.currentTarget.valueAsNumber);
          }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      </label>
      <label className="video-recon-inline-label">{t('结束（秒）', 'End (s)')}
        <input key={`end-${solveEnd}`} type="number" min={solveStart} max={duration} step="0.01" defaultValue={solveEnd.toFixed(2)}
          onBlur={event => {
            if (event.currentTarget.value) workspace.changeTrim('end', event.currentTarget.valueAsNumber);
          }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      </label>
    </div>
    {timerScramble && <BoolToggle className="video-recon-scramble-toggle"
      label={t('使用计时器当前打乱', 'Use the current timer scramble')}
      value={view.initialScramble === timerScramble}
      onChange={enabled => workspace.setScramble(enabled ? timerScramble : '')} />}
    {showScramble && <label className="video-recon-field">{t('打乱（选填）', 'Scramble (optional)')}
      <input type="text" value={view.initialScramble} onChange={event => workspace.setScramble(event.currentTarget.value)}
        autoComplete="off" autoCapitalize="none" spellCheck={false} />
    </label>}
    <button type="button" className="btn-primary video-recon-start" onClick={onBegin}
      disabled={view.status !== 'ready' || view.cropLoading || !!view.cropPreview}>
      {t('开始复盘', 'Reconstruct')}
    </button>
  </section>;
}
