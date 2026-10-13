'use client';

import './PlaybackScrubber.css';

/** Shared alg-playback progress scrubber — one native `<input type="range">` styled
 *  consistently (accent-color fill) so every cube-playback surface (recon's
 *  ReconPlayerBase, /sim's engine-mode playback bar) renders the same control
 *  instead of each hand-rolling its own. */
export default function PlaybackScrubber({
  step, total, onScrub, disabled, className, ariaLabel, segmentEnds,
}: {
  step: number;
  total: number;
  segmentEnds?: readonly number[];
  onScrub: (n: number) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const max = Math.max(total, 1);
  const pct = `${Math.max(0, Math.min(100, (step / max) * 100))}%`;
  const boundaries = [...new Set(segmentEnds)].filter(n => n > 0 && n < total).sort((a, b) => a - b);
  // Paint gaps on the track; masking it would also clip WebKit's native thumb.
  const stops = boundaries.flatMap(n => {
    const position = `${n / max * 100}%`;
    return [`transparent calc(${position} - 2px)`, `var(--background) calc(${position} - 2px)`,
      `var(--background) calc(${position} + 2px)`, `transparent calc(${position} + 2px)`];
  });
  return (
    <input
      type="range"
      className={className ? `playback-scrubber ${className}` : 'playback-scrubber'}
      style={{ ['--pct' as string]: pct, ['--segment-gaps' as string]: stops.length ? `linear-gradient(to right, transparent, ${stops.join(', ')}, transparent)` : 'linear-gradient(transparent, transparent)' }}
      min={0}
      max={max}
      value={step}
      disabled={disabled ?? total === 0}
      onChange={(e) => onScrub(Number(e.target.value))}
      aria-label={ariaLabel ?? 'Scrub'}
    />
  );
}
