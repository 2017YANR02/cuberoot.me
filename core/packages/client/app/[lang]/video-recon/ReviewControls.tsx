import PlaybackBar from '@cuberoot/timer-ui/PlaybackBar';
import { useT } from '@/hooks/useT';
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '@/lib/video-recon/engine/playback-timing';
import { timecode } from '@/lib/video-recon/engine/solve-range';

interface Props {
  playing: boolean;
  speed: PlaybackSpeed;
  end: number;
  position: number;
  index: number;
  length: number;
  origin?: number;
  label?: string;
  disabled?: boolean;
  onPlay: () => void;
  onSpeed: (speed: PlaybackSpeed) => void;
  onSeekIndex: (index: number) => void;
  onStep: (direction: -1 | 1) => void;
}

export function ReviewControls({
  playing, speed, end, position, index, length, origin = 0, label, disabled,
  onPlay, onSpeed, onSeekIndex, onStep,
}: Props) {
  const t = useT();
  const last = Math.max(0, length - 1);
  return <div className="video-recon-transport" role={label ? 'group' : undefined} aria-label={label}>
    <PlaybackBar layout="wide" step={Math.max(0, index)} total={last} playing={playing} disabled={disabled}
      onScrub={onSeekIndex} onSkipStart={() => onSeekIndex(0)} onSkipEnd={() => onSeekIndex(last)}
      onStepBack={() => onStep(-1)} onStepForward={() => onStep(1)} onTogglePlay={onPlay}
      leading={<span className="video-recon-muted video-recon-transport-time">{timecode(position - origin)} / {timecode(end - origin)}</span>}
      trailing={<label className="video-recon-inline-label video-recon-transport-speed">
        <select className="video-recon-speed-select" aria-label={t('速度', 'Speed')} value={speed} disabled={disabled || !length}
          onChange={event => onSpeed(Number(event.currentTarget.value) as PlaybackSpeed)}>
          {PLAYBACK_SPEEDS.map(value => <option value={value} key={value}>{value}×</option>)}
        </select>
      </label>}
      labels={{
        skipStart: t('回到起点', 'Skip to start'), stepBack: t('上一帧', 'Previous frame'),
        play: t('播放', 'Play'), pause: t('暂停', 'Pause'), stepForward: t('下一帧', 'Next frame'),
        skipEnd: t('跳到末尾', 'Skip to end'), scrub: t('拖动播放进度', 'Scrub playback'),
      }} />
  </div>;
}
