'use client';

import './PlaybackScrubber.css';

/** Shared alg-playback progress scrubber — one native `<input type="range">` styled
 *  consistently (accent-color fill) so every cube-playback surface (recon's
 *  ReconPlayerBase, /sim's engine-mode playback bar) renders the same control
 *  instead of each hand-rolling its own. */
export default function PlaybackScrubber({
  step, total, onScrub, disabled, className, ariaLabel,
}: {
  step: number;
  total: number;
  onScrub: (n: number) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type="range"
      className={className ? `playback-scrubber ${className}` : 'playback-scrubber'}
      min={0}
      max={Math.max(total, 1)}
      value={step}
      disabled={disabled ?? total === 0}
      onChange={(e) => onScrub(Number(e.target.value))}
      aria-label={ariaLabel ?? 'Scrub'}
    />
  );
}
