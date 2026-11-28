import type { ReactNode } from 'react';
import PlaybackBar, { PlaybackSpeedSelect } from '@cuberoot/timer-ui/PlaybackBar';
import { VideoFrameStepButtons, type VideoFrameStep } from '@/components/video/VideoFrameStepButtons';
import { VideoPlaybackControls, type useVideoControlsVisibility } from '@/components/video/VideoPlaybackControls';
import { useT } from '@/hooks/useT';
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '@/lib/video-recon/engine/playback-timing';
import { timecode } from '@/lib/video-recon/engine/solve-range';

export interface ReviewControlsProps {
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
}: ReviewControlsProps) {
  const t = useT();
  const last = Math.max(0, length - 1);
  return <div className="video-recon-transport" role={label ? 'group' : undefined} aria-label={label}>
    <PlaybackBar layout="wide" step={Math.max(0, index)} total={last} playing={playing} disabled={disabled}
      onScrub={onSeekIndex} onSkipStart={() => onSeekIndex(0)} onSkipEnd={() => onSeekIndex(last)}
      onStepBack={() => onStep(-1)} onStepForward={() => onStep(1)} onTogglePlay={onPlay}
      leading={<span className="video-recon-muted video-recon-transport-time">{timecode(position - origin)} / {timecode(end - origin)}</span>}
      trailing={<PlaybackSpeedSelect className="video-recon-transport-speed" label={t('播放倍速', 'Playback speed')}
        value={speed} options={PLAYBACK_SPEEDS} disabled={disabled || !length} onChange={onSpeed} />}
      labels={{
        skipStart: t('回到起点', 'Skip to start'), stepBack: t('上一帧', 'Previous frame'),
        play: t('播放', 'Play'), pause: t('暂停', 'Pause'), stepForward: t('下一帧', 'Next frame'),
        skipEnd: t('跳到末尾', 'Skip to end'), scrub: t('拖动播放进度', 'Scrub playback'),
      }} />
  </div>;
}

export type ReviewPlayback = Omit<ReviewControlsProps, 'onStep'> & {
  filmstrip?: ReactNode;
  onStep: (delta: VideoFrameStep) => void;
};

export function ReviewPlaybackOverlay({ playback, visibility, keepVisible, settingsButton }: {
  playback: ReviewPlayback;
  visibility: ReturnType<typeof useVideoControlsVisibility>;
  keepVisible: boolean;
  settingsButton?: ReactNode;
}) {
  const t = useT();
  const { playing, speed, index, length, position, end, origin = 0, onPlay, onSeekIndex, onStep, onSpeed } = playback;
  const last = Math.max(0, length - 1);
  return <VideoPlaybackControls filmstrip={playback.filmstrip} playing={playing} visibility={visibility} keepVisible={keepVisible}
    position={index} total={last} step={1} time={`${timecode(position - origin)} / ${timecode(end - origin)}`}
    onSeek={onSeekIndex} onPlay={onPlay} playDisabled={!last}
    actions={<>
      {settingsButton}
      <VideoFrameStepButtons onStep={onStep} active={!!last && !playback.disabled}
        atStart={index <= 0} atEnd={index >= last} />
      <PlaybackSpeedSelect label={t('播放倍速', 'Playback speed')} options={PLAYBACK_SPEEDS} value={speed} onChange={onSpeed} disabled={!length} />
    </>} />;
}
