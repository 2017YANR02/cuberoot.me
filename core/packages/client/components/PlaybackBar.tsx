'use client';

import { type ReactNode } from 'react';
import { Play, Pause, SkipBack, SkipForward, Undo2, Redo2 } from 'lucide-react';
import PlaybackScrubber from './PlaybackScrubber';
import './PlaybackBar.css';

/**
 * PlaybackBar — the shared alg-playback control bar for every cube-playback
 * surface (recon's ReconPlayerBase, /sim's engine-mode playback). Twizzle-style
 * two-row layout (alpha.twizzle.net/edit): the scrubber + progress sit on top,
 * the transport buttons underneath. Both surfaces render this exact bar so they
 * stay pixel-identical — don't hand-roll a per-page control row.
 *
 * `leading` / `trailing` slot extra controls into the button row (used by /sim
 * for the stickering + anchor selects); recon passes neither.
 */

export interface PlaybackBarLabels {
  skipStart: string;
  stepBack: string;
  play: string;
  pause: string;
  stepForward: string;
  skipEnd: string;
  scrub: string;
}

const DEFAULT_LABELS: PlaybackBarLabels = {
  skipStart: 'Skip to start',
  stepBack: 'Step back',
  play: 'Play',
  pause: 'Pause',
  stepForward: 'Step forward',
  skipEnd: 'Skip to end',
  scrub: 'Scrub',
};

export default function PlaybackBar({
  step, total, playing,
  onScrub, onSkipStart, onStepBack, onTogglePlay, onStepForward, onSkipEnd,
  leading, trailing, labels,
}: {
  step: number;
  total: number;
  playing: boolean;
  onScrub: (n: number) => void;
  onSkipStart: () => void;
  onStepBack: () => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onSkipEnd: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  labels?: Partial<PlaybackBarLabels>;
}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const atStart = step <= 0;
  const atEnd = step >= total;
  const empty = total === 0;
  // Fraction of the way along the track the thumb sits, so the value bubble can
  // float directly above it (native <input type=range> gives no thumb hook — the
  // calc offsets by the thumb width so the label tracks the thumb centre exactly).
  const frac = step / Math.max(total, 1);
  return (
    <div className="playback-bar">
      <div className="playback-bar-scrub">
        <span
          className="playback-bar-bubble"
          style={{ left: `calc(${frac} * (100% - var(--pb-thumb)) + var(--pb-thumb) / 2)` }}
        >
          {step}
        </span>
        <PlaybackScrubber step={step} total={total} onScrub={onScrub} disabled={empty} ariaLabel={L.scrub} />
      </div>
      <div className="playback-bar-controls">
        {leading}
        <button type="button" className="playback-bar-btn" onClick={onSkipStart} disabled={atStart} title={L.skipStart} aria-label={L.skipStart}><SkipBack size={14} /></button>
        <button type="button" className="playback-bar-btn" onClick={onStepBack} disabled={atStart} title={L.stepBack} aria-label={L.stepBack}><Undo2 size={14} /></button>
        <button type="button" className="playback-bar-btn" onClick={onTogglePlay} disabled={empty} title={playing ? L.pause : L.play} aria-label={playing ? L.pause : L.play}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
        <button type="button" className="playback-bar-btn" onClick={onStepForward} disabled={atEnd} title={L.stepForward} aria-label={L.stepForward}><Redo2 size={14} /></button>
        <button type="button" className="playback-bar-btn" onClick={onSkipEnd} disabled={atEnd} title={L.skipEnd} aria-label={L.skipEnd}><SkipForward size={14} /></button>
        {trailing}
      </div>
    </div>
  );
}
