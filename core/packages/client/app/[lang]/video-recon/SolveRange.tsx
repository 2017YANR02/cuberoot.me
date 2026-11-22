import { ChevronLeft, ChevronRight } from '@app-foundation/icons/lucide';
import { Tooltip } from '@/components/Tooltip';
import { VideoTrimTimeline } from '@/components/VideoTrimTimeline';
import { useT } from '@/hooks/useT';
import { timecode } from '@/lib/video-recon/engine/solve-range';
import type { VideoWorkspace } from '@/lib/video-recon/workspace';

export function SolveRange({ view, workspace, onBegin, fixedScramble }: {
  view: ReturnType<VideoWorkspace['getSnapshot']>;
  workspace: VideoWorkspace;
  onBegin: () => void;
  fixedScramble?: boolean;
}) {
  const t = useT();
  const { solveStart, solveEnd, duration, thumbnails, position, sourceFps } = view;
  const start = t('开始', 'Start');
  const end = t('结束', 'End');
  return <section className="video-recon-setup">
    <div className="video-recon-section-heading">
      <h3>{t('选择还原区间', 'Select the solve range')}</h3>
      <span className="video-recon-muted">{timecode(solveStart)} → {timecode(solveEnd)}</span>
    </div>
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
      <label className="video-recon-inline-label">{t('开始时间（秒）', 'Start time (s)')}
        <input key={`start-${solveStart}`} type="number" min={0} max={solveEnd} step="0.01" defaultValue={solveStart.toFixed(2)}
          onBlur={event => {
            if (event.currentTarget.value) workspace.changeTrim('start', event.currentTarget.valueAsNumber);
          }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      </label>
      <label className="video-recon-inline-label">{t('结束时间（秒）', 'End time (s)')}
        <input key={`end-${solveEnd}`} type="number" min={solveStart} max={duration} step="0.01" defaultValue={solveEnd.toFixed(2)}
          onBlur={event => {
            if (event.currentTarget.value) workspace.changeTrim('end', event.currentTarget.valueAsNumber);
          }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      </label>
    </div>
    <label className="video-recon-field">{t('打乱', 'Scramble')}
      <input type="text" value={view.initialScramble} onChange={event => workspace.setScramble(event.currentTarget.value)}
        readOnly={fixedScramble} autoComplete="off" autoCapitalize="none" spellCheck={false} />
    </label>
    <div className="video-recon-section-heading">
      <p className="video-recon-muted">{t('区间开头需包含第一步之前的清晰魔方画面。', 'Include a clear view of the cube before the first move.')}</p>
      <button type="button" className="btn-primary" onClick={onBegin}
        disabled={view.status !== 'ready' || view.cropLoading || !!view.cropPreview || !view.initialScramble.trim()}>
        {t('开始复盘', 'Reconstruct')}
      </button>
    </div>
  </section>;
}
