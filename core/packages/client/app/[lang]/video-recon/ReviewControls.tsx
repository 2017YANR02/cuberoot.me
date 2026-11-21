import { ChevronLeft, ChevronRight, Pause, Play } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '@/lib/video-recon/engine/playback-timing';
import { timecode } from '@/lib/video-recon/engine/solve-range';

interface Props {
  playing: boolean;
  speed: PlaybackSpeed;
  start: number;
  end: number;
  position: number;
  index: number;
  length: number;
  origin?: number;
  disabled?: boolean;
  onPlay: () => void;
  onSpeed: (speed: PlaybackSpeed) => void;
  onSeek: (timestamp: number) => void;
  onStep: (direction: -1 | 1) => void;
}

export function ReviewControls({
  playing, speed, start, end, position, index, length, origin = 0, disabled,
  onPlay, onSpeed, onSeek, onStep,
}: Props) {
  const t = useT();
  const previous = t('上一帧', 'Previous frame');
  const next = t('下一帧', 'Next frame');
  return <div className="video-recon-transport">
    <div className="video-recon-actions">
      <button type="button" className="btn-secondary" disabled={disabled || length < 2} onClick={onPlay}>
        {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {playing ? t('暂停', 'Pause') : t('播放', 'Play')}
      </button>
      <label className="video-recon-inline-label">
        {t('速度', 'Speed')}
        <select value={speed} disabled={disabled} onChange={event => onSpeed(Number(event.currentTarget.value) as PlaybackSpeed)}>
          {PLAYBACK_SPEEDS.map(value => <option value={value} key={value}>{value}×</option>)}
        </select>
      </label>
    </div>
    <label className="video-recon-range">
      <span>{timecode(Math.max(0, position - origin))}</span>
      <input className="video-recon-range-input" type="range" aria-label={t('回放位置', 'Playback position')} min={start} max={end}
        step={0.001} value={position} disabled={disabled || length < 2}
        onChange={event => onSeek(Number(event.currentTarget.value))} />
      <span>{timecode(Math.max(0, end - origin))}</span>
    </label>
    <div className="video-recon-actions">
      <button type="button" className="btn-secondary" aria-label={previous} disabled={disabled || index <= 0} onClick={() => onStep(-1)}>
        <ChevronLeft size={16} aria-hidden />
      </button>
      <span className="video-recon-muted">{t('帧', 'Frame')} {Math.max(0, index + 1)} / {length}</span>
      <button type="button" className="btn-secondary" aria-label={next} disabled={disabled || index >= length - 1 || !length} onClick={() => onStep(1)}>
        <ChevronRight size={16} aria-hidden />
      </button>
    </div>
  </div>;
}
