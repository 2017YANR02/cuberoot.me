'use client';

/**
 * RangeSlider — dual-thumb min–max range slider (two circular handles on one
 * track). Built from two stacked native `<input type="range">` so it stays
 * keyboard- and touch-accessible; the inputs pass pointer events through to the
 * track (pointer-events:none) while only the thumbs stay interactive, so both
 * handles are grabbable. The filled segment between the thumbs is painted via
 * the --rs-lo / --rs-hi custom props.
 *
 * Discrete by default (step=1). `value` is always [lo, hi] with lo <= hi; the
 * setters clamp so the handles can't cross. Style follows theme tokens
 * (--accent fill/thumb), so it adapts to light/dark and palette themes.
 */
import './RangeSlider.css';

export interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  /** Tick values to label under the track (e.g. [0, 7, 14]). */
  marks?: number[];
  /** Format a value for the aria text / marks (e.g. n => `${n} 步`). */
  formatValue?: (n: number) => string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function RangeSlider({
  min, max, step = 1, value, onChange, marks, formatValue, ariaLabel, disabled,
}: RangeSliderProps) {
  const [lo, hi] = value;
  const span = max - min || 1;
  const pct = (n: number) => `${((n - min) / span) * 100}%`;
  const fmt = formatValue ?? ((n: number) => String(n));
  const setLo = (n: number) => onChange([Math.min(Math.max(n, min), hi), hi]);
  const setHi = (n: number) => onChange([lo, Math.max(Math.min(n, max), lo)]);

  return (
    <div
      className={`range-slider${disabled ? ' is-disabled' : ''}`}
      style={{ ['--rs-lo' as string]: pct(lo), ['--rs-hi' as string]: pct(hi) }}
    >
      <div className="range-slider-rail">
        <div className="range-slider-fill" />
      </div>
      <input
        type="range"
        className="range-slider-input range-slider-input-lo"
        min={min} max={max} step={step} value={lo} disabled={disabled}
        onChange={(e) => setLo(Number(e.target.value))}
        aria-label={ariaLabel ? `${ariaLabel} — min` : 'minimum'}
        aria-valuetext={fmt(lo)}
      />
      <input
        type="range"
        className="range-slider-input range-slider-input-hi"
        min={min} max={max} step={step} value={hi} disabled={disabled}
        onChange={(e) => setHi(Number(e.target.value))}
        aria-label={ariaLabel ? `${ariaLabel} — max` : 'maximum'}
        aria-valuetext={fmt(hi)}
      />
      {marks && marks.length > 0 && (
        <div className="range-slider-marks" aria-hidden="true">
          {marks.map((m) => (
            <span key={m} className="range-slider-mark" style={{ left: pct(m) }}>{fmt(m)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
