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
 *
 * Overlap handling: with two stacked inputs only the topmost thumb under the
 * cursor is grabbable, and a thumb on top can move only one way (hi is clamped
 * >= lo, lo <= hi) — so overlapping or adjacent thumbs would get stuck. We float
 * whichever thumb the cursor is nearer to (when they overlap, by which side of
 * the thumb the cursor is on) on every pointer move, so grabbing the left side
 * drags left and the right side drags right. Keyboard stays unaffected.
 */
import { useRef } from 'react';
import './RangeSlider.css';

export interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  /** Tick values to label under the track (e.g. [0, 7, 14]). */
  marks?: number[];
  /** Highlight marks that fall inside the selected [lo, hi] range (accent + bold). */
  markHighlight?: boolean;
  /** Format a value for the aria text / marks (e.g. n => `${n} 步`). */
  formatValue?: (n: number) => string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function RangeSlider({
  min, max, step = 1, value, onChange, marks, markHighlight, formatValue, ariaLabel, disabled,
}: RangeSliderProps) {
  const [lo, hi] = value;
  const span = max - min || 1;
  const pct = (n: number) => `${((n - min) / span) * 100}%`;
  const fmt = formatValue ?? ((n: number) => String(n));
  const setLo = (n: number) => onChange([Math.min(Math.max(n, min), hi), hi]);
  const setHi = (n: number) => onChange([lo, Math.max(Math.min(n, max), lo)]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const loRef = useRef<HTMLInputElement>(null);
  const hiRef = useRef<HTMLInputElement>(null);

  // Put the thumb the cursor is nearest to on top so it (not its buried twin)
  // receives the grab. When the thumbs overlap their pixel positions are equal,
  // so the tie-break by cursor side decides direction: cursor left of the thumb
  // → lo on top (drags left); right → hi on top (drags right). Set imperatively
  // (not via React state) so it lands before the pending pointerdown grabs.
  const floatNearestThumb = (clientX: number) => {
    const loEl = loRef.current, hiEl = hiRef.current, wrap = wrapRef.current;
    if (!loEl || !hiEl || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const xOf = (n: number) => rect.left + ((n - min) / span) * rect.width;
    const dLo = Math.abs(clientX - xOf(lo));
    const dHi = Math.abs(clientX - xOf(hi));
    const loOnTop = dLo < dHi || (dLo === dHi && clientX <= xOf(lo));
    loEl.style.zIndex = loOnTop ? '4' : '2';
    hiEl.style.zIndex = loOnTop ? '3' : '5';
  };

  return (
    <div
      ref={wrapRef}
      className={`range-slider${disabled ? ' is-disabled' : ''}`}
      style={{ ['--rs-lo' as string]: pct(lo), ['--rs-hi' as string]: pct(hi) }}
      onPointerMove={(e) => floatNearestThumb(e.clientX)}
      onPointerDown={(e) => floatNearestThumb(e.clientX)}
    >
      <div className="range-slider-rail">
        <div className="range-slider-fill" />
      </div>
      <input
        ref={loRef}
        type="range"
        className="range-slider-input range-slider-input-lo"
        min={min} max={max} step={step} value={lo} disabled={disabled}
        onChange={(e) => setLo(Number(e.target.value))}
        aria-label={ariaLabel ? `${ariaLabel} — min` : 'minimum'}
        aria-valuetext={fmt(lo)}
      />
      <input
        ref={hiRef}
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
            <span
              key={m}
              className={`range-slider-mark${markHighlight && m >= lo && m <= hi ? ' is-in' : ''}`}
              style={{ left: pct(m) }}
            >{fmt(m)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
