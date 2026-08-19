'use client';

import { RotateCcw } from 'lucide-react';
import PlaybackBar from '@/components/PlaybackBar';
import { useT } from '@/hooks/useT';

type FullControlsProps = {
  mode?: 'full';
  step: number;
  count: number;
  playing: boolean;
  onScrub: (step: number) => void;
  onStepBack: () => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
};

type ReplayControlsProps = {
  mode: 'replay';
  count: number;
  onReplay: () => void;
};

export default function AlgPlaybackControls(props: FullControlsProps | ReplayControlsProps) {
  const t = useT();

  if (props.mode === 'replay') {
    return (
      <div className="playback-bar-controls">
        <button
          type="button"
          className="playback-bar-btn"
          onClick={props.onReplay}
          disabled={props.count === 0}
          title={t('重播', 'Replay')}
          aria-label={t('重播', 'Replay')}
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <PlaybackBar
      step={props.step}
      total={props.count}
      playing={props.playing}
      onScrub={props.onScrub}
      onSkipStart={() => props.onScrub(0)}
      onStepBack={props.onStepBack}
      onTogglePlay={props.onTogglePlay}
      onStepForward={props.onStepForward}
      onSkipEnd={() => props.onScrub(props.count)}
      labels={{
        skipStart: t('回到起点', 'Skip to start'),
        stepBack: t('上一步', 'Step back'),
        play: t('播放', 'Play'),
        pause: t('暂停', 'Pause'),
        stepForward: t('下一步', 'Step forward'),
        skipEnd: t('跳到末尾', 'Skip to end'),
        scrub: t('拖动播放进度', 'Scrub playback'),
      }}
    />
  );
}
