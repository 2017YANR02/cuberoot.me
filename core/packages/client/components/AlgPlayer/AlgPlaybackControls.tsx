'use client';

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useT } from '@/hooks/useT';

export default function AlgPlaybackControls({
  step,
  count,
  playing,
  onStepChange,
  onScrub,
  onPlayingChange,
  mode = 'full',
  onReplay,
}: {
  step: number;
  count: number;
  playing: boolean;
  onStepChange: (step: number) => void;
  onScrub?: (step: number) => void;
  onPlayingChange: (playing: boolean) => void;
  mode?: 'full' | 'replay';
  onReplay?: () => void;
}) {
  const t = useT();
  const atEnd = step >= count;
  const seek = (next: number) => {
    onPlayingChange(false);
    onStepChange(Math.max(0, Math.min(count, next)));
  };
  const scrub = (next: number) => {
    onPlayingChange(false);
    (onScrub ?? onStepChange)(Math.max(0, Math.min(count, next)));
  };

  if (mode === 'replay') {
    return (
      <div className="alg-sim-controls is-replay-only">
        <button
          type="button"
          className="alg-sim-btn"
          onClick={onReplay ?? (() => {
            onStepChange(0);
            onPlayingChange(true);
          })}
          disabled={count === 0}
          title={t('重播', 'Replay')}
          aria-label={t('重播', 'Replay')}
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="alg-sim-controls">
      <button type="button" className="alg-sim-btn" onClick={() => seek(0)} disabled={step === 0} title={t('回到起点', 'Back to start')}>
        <SkipBack size={14} />
      </button>
      <button type="button" className="alg-sim-btn" onClick={() => seek(step - 1)} disabled={step === 0} title={t('上一步', 'Previous move')}>
        <ChevronLeft size={14} />
      </button>
      <button
        type="button"
        className="alg-sim-btn is-primary"
        onClick={() => {
          if (atEnd) onStepChange(0);
          onPlayingChange(!playing);
        }}
        disabled={count === 0}
        title={playing ? t('暂停', 'Pause') : t('播放', 'Play')}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button type="button" className="alg-sim-btn" onClick={() => seek(step + 1)} disabled={atEnd} title={t('下一步', 'Next move')}>
        <ChevronRight size={14} />
      </button>
      <button type="button" className="alg-sim-btn" onClick={() => seek(count)} disabled={atEnd} title={t('走到最后', 'Jump to the end')}>
        <SkipForward size={14} />
      </button>
      <input
        type="range"
        className="alg-sim-scrub"
        min={0}
        max={count}
        value={step}
        onChange={(event) => scrub(Number(event.target.value))}
        aria-label={t('进度', 'Progress')}
      />
      <span className="alg-sim-count">{step}/{count}</span>
    </div>
  );
}
