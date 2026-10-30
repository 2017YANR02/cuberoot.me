'use client';

import { type ReactNode } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, PictureInPicture2 } from 'lucide-react';
import PlaybackScrubber from './PlaybackScrubber';
import './PlaybackBar.css';

/**
 * PlaybackBar — the shared alg-playback control bar for every cube-playback
 * surface (recon's ReconPlayerBase, /sim and AlgPlayer). Twizzle-style
 * two-row layout (alpha.twizzle.net/edit): the scrubber + progress sit on top,
 * the transport buttons underneath. All surfaces render this exact bar so they
 * stay pixel-identical — don't hand-roll a per-page control row.
 *
 * `leading` / `trailing` slot the shared stage, anchor and back-view controls
 * into the button row for both /sim and reconstruction playback.
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

/** Shared simulator/reconstruction anchor and back-view controls. */
export function PlaybackAnchorSelect({ atEnd, onChange, disabled, label, startLabel, endLabel }: {
  atEnd: boolean; onChange(atEnd: boolean): void; disabled?: boolean;
  label: string; startLabel: string; endLabel: string;
}) {
  return <select className="playback-bar-anchor" value={atEnd ? 'algorithm' : 'moves'} disabled={disabled}
    aria-label={label} onChange={event => onChange(event.target.value === 'algorithm')}>
    <option value="moves">{startLabel}</option><option value="algorithm">{endLabel}</option>
  </select>;
}

export function PlaybackBackViewButton({ visible, toggle = true, onClick, showLabel, hideLabel }: {
  visible: boolean; toggle?: boolean; onClick(): void; showLabel: string; hideLabel: string;
}) {
  return <button type="button" className="playback-bar-btn" aria-pressed={toggle ? visible : undefined}
    onClick={onClick} aria-label={visible ? hideLabel : showLabel}>
    <PictureInPicture2 size={14} />
  </button>;
}

export default function PlaybackBar({
  step, total, playing, disabled = false,
  onScrub, onSkipStart, onStepBack, onTogglePlay, onStepForward, onSkipEnd,
  leading, trailing, labels, stepMarkers, layout = 'compact', segmentEnds, segmentCounts,
}: {
  step: number;
  total: number;
  segmentEnds?: readonly number[];
  /** Display counts can differ from playback indices (e.g. rotations cost zero). */
  segmentCounts?: readonly number[];
  playing: boolean;
  disabled?: boolean;
  onScrub: (n: number) => void;
  onSkipStart: () => void;
  onStepBack: () => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onSkipEnd: () => void;
  layout?: 'compact' | 'wide';
  leading?: ReactNode;
  trailing?: ReactNode;
  labels?: Partial<PlaybackBarLabels>;
  /** Move counts at the boundaries of teaching stages. */
  stepMarkers?: readonly number[];
}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const atStart = disabled || step <= 0;
  const atEnd = disabled || step >= total;
  const empty = disabled || total === 0;
  // Fraction of the way along the track the thumb sits, so the value bubble can
  // float directly above it (native <input type=range> gives no thumb hook — the
  // calc offsets by the thumb width so the label tracks the thumb centre exactly).
  const frac = step / Math.max(total, 1);
  return (
    <div className={`playback-bar${layout === 'wide' ? ' playback-bar--wide' : ''}`}>
      <div className={`playback-bar-scrub${segmentCounts?.length && !empty ? ' has-segment-counts' : ''}`}>
        {!empty && segmentEnds?.map((end, index) => {
          const start = segmentEnds[index - 1] ?? 0;
          const count = segmentCounts?.[index];
          if (count === undefined || end <= start) return null;
          return <span key={end} className="playback-bar-bubble playback-bar-segment-count"
            style={{ left: `calc(${(start + end) / (2 * total)} * (100% - var(--pb-thumb)) + var(--pb-thumb) / 2)` }}>
            {count}
          </span>;
        })}
        <span
          className="playback-bar-bubble"
          style={{ left: `calc(${frac} * (100% - var(--pb-thumb)) + var(--pb-thumb) / 2)` }}
        >
          {step}
        </span>
        <PlaybackScrubber step={step} total={total} segmentEnds={segmentEnds} onScrub={onScrub} disabled={empty} ariaLabel={L.scrub} />
        {stepMarkers && !empty && <div className="playback-bar-markers" aria-hidden="true">
          {stepMarkers.map(position => <span
            key={position}
            className="playback-bar-marker"
            data-step={position}
            data-complete={position <= step}
            data-current={position === step}
            style={{ left: `${position / total * 100}%` }}
          />)}
        </div>}
      </div>
      <div className="playback-bar-controls">
        {leading}
        <button type="button" className="playback-bar-btn" onClick={onSkipStart} disabled={atStart} title={L.skipStart} aria-label={L.skipStart}><SkipBack size={14} /></button>
        <button type="button" className="playback-bar-btn" onClick={onStepBack} disabled={atStart} title={L.stepBack} aria-label={L.stepBack}><ChevronLeft size={14} /></button>
        <button type="button" className="playback-bar-btn" onClick={onTogglePlay} disabled={empty} title={playing ? L.pause : L.play} aria-label={playing ? L.pause : L.play}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
        <button type="button" className="playback-bar-btn" onClick={onStepForward} disabled={atEnd} title={L.stepForward} aria-label={L.stepForward}><ChevronRight size={14} /></button>
        <button type="button" className="playback-bar-btn" onClick={onSkipEnd} disabled={atEnd} title={L.skipEnd} aria-label={L.skipEnd}><SkipForward size={14} /></button>
        {trailing}
      </div>
    </div>
  );
}

