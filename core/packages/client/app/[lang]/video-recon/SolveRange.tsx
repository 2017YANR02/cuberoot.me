import { useT } from '@/hooks/useT';
import { timecode } from '@/lib/video-recon/engine/solve-range';
import type { VideoWorkspace } from '@/lib/video-recon/workspace';

export function SolveRange({ view, workspace }: { view: ReturnType<VideoWorkspace['getSnapshot']>; workspace: VideoWorkspace }) {
  const t = useT();
  const { solveStart, solveEnd, duration, sourceFps, thumbnails } = view;
  const start = t('开始', 'Start');
  const end = t('结束', 'End');
  const step = Math.min(0.001, 1 / (sourceFps || 30));
  return <section className="video-recon-setup">
    <div className="video-recon-section-heading">
      <h3>{t('选择还原区间', 'Select the solve range')}</h3>
      <span className="video-recon-muted">{timecode(solveStart)} → {timecode(solveEnd)}</span>
    </div>
    <div className="video-recon-thumbnails" aria-hidden="true">
      {Array.from({ length: 10 }, (_, index) => <div key={index}>
        {/* Thumbnails are browser-generated object URLs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumbnails[index] && <img src={thumbnails[index]} alt="" />}
      </div>)}
      <div className="video-recon-clip-selection"
        style={{ left: `${duration ? solveStart / duration * 100 : 0}%`, right: `${duration ? (1 - solveEnd / duration) * 100 : 0}%` }} />
    </div>
    <div className="video-recon-trim-controls">
      <label className="video-recon-range">
        <span>{start}</span>
        <input type="range" min={0} max={duration} step={step} value={solveStart}
          onChange={event => workspace.changeTrim('start', Number(event.currentTarget.value))} />
        <span>{timecode(solveStart)}</span>
      </label>
      <label className="video-recon-range">
        <span>{end}</span>
        <input type="range" min={0} max={duration} step={step} value={solveEnd}
          onChange={event => workspace.changeTrim('end', Number(event.currentTarget.value))} />
        <span>{timecode(solveEnd)}</span>
      </label>
    </div>
    <div className="video-recon-actions">
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
    <label className="video-recon-field">{t('初始打乱', 'Initial scramble')}
      <input type="text" value={view.initialScramble} onChange={event => workspace.setScramble(event.currentTarget.value)}
        placeholder="R U R′ U′ …" autoComplete="off" autoCapitalize="none" spellCheck={false} />
    </label>
    <div className="video-recon-section-heading">
      <p className="video-recon-muted">{t('区间开头需包含第一步之前的清晰魔方画面。', 'Include a clear view of the cube before the first move.')}</p>
      <button type="button" className="btn-primary" onClick={() => void workspace.beginReconstruction()}
        disabled={view.status !== 'ready' || view.cropLoading || !!view.cropPreview || !view.initialScramble.trim()}>
        {t('开始复盘', 'Reconstruct')}
      </button>
    </div>
  </section>;
}
