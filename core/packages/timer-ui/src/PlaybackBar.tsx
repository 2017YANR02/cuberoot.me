'use client';

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, PictureInPicture2 } from 'lucide-react';
import { Tooltip } from './Tooltip';
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

export function PlaybackSpeedSelect<T extends number>({
  value, options, onChange, label, disabled, className,
}: {
  value: T;
  options: readonly T[];
  onChange: (speed: T) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return <select className={className ? `playback-speed-select ${className}` : 'playback-speed-select'}
    aria-label={label} value={value} disabled={disabled} onChange={event => {
      const speed = options[event.currentTarget.selectedIndex];
      if (speed !== undefined) onChange(speed);
    }}>
    {options.map(speed => <option key={speed} value={speed}>{speed}×</option>)}
  </select>;
}

export function PlaybackBackViewButton({ visible, toggle = true, onClick, showLabel, hideLabel, buttonRef }: {
  visible: boolean; toggle?: boolean; onClick(): void; showLabel: string; hideLabel: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const label = visible ? hideLabel : showLabel;
  return <Tooltip content={label}>{tip => <button {...tip} ref={buttonRef} type="button" className="playback-bar-btn playback-bar-backview-btn" aria-pressed={toggle ? visible : undefined}
    onClick={onClick} aria-label={label}>
    <PictureInPicture2 size={14} aria-hidden="true">
      {visible && <path d="m2 2 20 20" />}
    </PictureInPicture2>
  </button>}</Tooltip>;
}

export function resolveBackViewOptions<T extends { backView: boolean; hint: boolean }>(
  options: T, preferred: 'backView' | 'hint' = 'backView',
): T {
  if (!options.backView || !options.hint) return options;
  return preferred === 'backView' ? { ...options, hint: false } : { ...options, backView: false };
}

/** Keep the frame measurable with visibility:hidden when closed. */
export function useBackViewMotion(
  frameRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<HTMLElement | null> | undefined,
  visible: boolean,
  enabled: boolean,
  fallbackAnchorRef?: RefObject<HTMLElement | null>,
) {
  const animationRef = useRef<Animation | null>(null);
  const wasVisible = useRef(visible);

  useLayoutEffect(() => {
    const changed = wasVisible.current !== visible;
    wasVisible.current = visible;
    const animation = animationRef.current;
    if (!enabled) {
      animation?.cancel();
      animationRef.current = null;
      return;
    }
    if (!changed) return;

    const frame = frameRef.current;
    const anchor = anchorRef?.current ?? fallbackAnchorRef?.current;
    // Start from the current pose when a click interrupts the transition.
    const current = frame && animation?.playState === 'running' ? getComputedStyle(frame) : null;
    const interrupted = current ? { transform: current.transform, opacity: current.opacity } : null;
    animation?.cancel();
    animationRef.current = null;
    if (!frame || !anchor || typeof frame.animate !== 'function' ||
        matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const from = anchor.getBoundingClientRect();
    const to = frame.getBoundingClientRect();
    if (!from.width || !from.height || !to.width || !to.height) return;

    const x = from.left + from.width / 2 - (to.left + to.width / 2);
    const y = from.top + from.height / 2 - (to.top + to.height / 2);
    const scale = Math.min(from.width / to.width, from.height / to.height);
    const collapsed = { transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity: 0 };
    const expanded = { transform: 'translate(0, 0) scale(1)', opacity: 1 };
    const start = interrupted ?? (visible ? collapsed : expanded);
    const end = visible ? expanded : collapsed;
    animationRef.current = frame.animate([
      { ...start, visibility: 'visible', transformOrigin: 'center' },
      { ...end, visibility: 'visible', transformOrigin: 'center' },
    ], { duration: 260, easing: visible ? 'cubic-bezier(.22, 1, .36, 1)' : 'cubic-bezier(.4, 0, .8, .4)' });
  }, [frameRef, anchorRef, fallbackAnchorRef, visible, enabled]);

  useLayoutEffect(() => () => animationRef.current?.cancel(), []);
  return animationRef;
}

export default function PlaybackBar({
  step, total, playing, disabled = false,
  onScrub, onSkipStart, onStepBack, onTogglePlay, onStepForward, onSkipEnd,
  leading, trailing, labels, stepMarkers, layout = 'compact', segmentEnds, segmentCounts, scrubValueText,
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
  layout?: 'compact' | 'wide' | 'balanced';
  leading?: ReactNode;
  trailing?: ReactNode;
  labels?: Partial<PlaybackBarLabels>;
  scrubValueText?: string;
  /** Move counts at the boundaries of teaching stages. */
  stepMarkers?: readonly number[];
}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const atStart = disabled || step <= 0;
  const atEnd = disabled || step >= total;
  const empty = disabled || total === 0;
  const hasSegmentCounts = !!segmentCounts?.length && !empty;
  const layoutClass = layout === 'compact' ? '' : ' playback-bar--wide';
  const balancedClass = layout === 'balanced' ? ' playback-bar--balanced' : '';
  return (
    <div className={`playback-bar${layoutClass}${balancedClass}`}>
      <div className={`playback-bar-scrub${hasSegmentCounts ? ' playback-bar-scrub--counts' : ''}`}>
        {!empty && segmentEnds?.map((end, index) => {
          const start = segmentEnds[index - 1] ?? 0;
          const count = segmentCounts?.[index];
          if (count === undefined || end <= start) return null;
          return <span key={end} className="playback-bar-bubble playback-bar-segment-count"
            style={{ left: `calc(${(start + end) / (2 * total)} * (100% - var(--pb-thumb)) + var(--pb-thumb) / 2)` }}>
            {count}
          </span>;
        })}
        <PlaybackScrubber step={step} total={total} segmentEnds={segmentEnds} onScrub={onScrub}
          disabled={empty} ariaLabel={L.scrub} ariaValueText={scrubValueText} part="seek" />
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
      <div className="playback-bar-controls" part="controls">
        {leading}
        {([
          ['start', L.skipStart, SkipBack, onSkipStart, atStart],
          ['previous', L.stepBack, ChevronLeft, onStepBack, atStart],
          ['play', playing ? L.pause : L.play, playing ? Pause : Play, onTogglePlay, empty],
          ['next', L.stepForward, ChevronRight, onStepForward, atEnd],
          ['end', L.skipEnd, SkipForward, onSkipEnd, atEnd],
        ] as const).map(([part, label, Icon, onClick, inactive]) => (
          <Tooltip key={part} content={label}>{tip => (
            <button {...tip} type="button" className="playback-bar-btn" part={part}
              onClick={onClick} disabled={inactive} aria-label={label}><Icon size={14} /></button>
          )}</Tooltip>
        ))}
        {trailing}
      </div>
    </div>
  );
}

