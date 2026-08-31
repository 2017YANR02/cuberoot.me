import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

export const orderedDragRange = (anchor: number, moving: number): [number, number] => (
  moving <= anchor ? [moving, anchor] : [anchor, moving]
);

export interface TimerRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  marks?: number[];
  markHighlight?: boolean;
  formatValue?: (value: number) => string;
  ariaLabel?: string;
  disabled?: boolean;
  allowed?: number[];
}

/** Accessible dual-thumb slider shared by Web, Android and iOS timer UI. */
export function TimerRangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  marks,
  markHighlight,
  formatValue,
  ariaLabel,
  disabled,
  allowed,
}: TimerRangeSliderProps) {
  const [lo, hi] = value;
  const span = max - min || 1;
  const percent = (item: number) => `${((item - min) / span) * 100}%`;
  const format = formatValue ?? ((item: number) => String(item));
  const allowedSet = allowed?.length ? new Set(allowed) : null;
  const ceiling = allowedSet ? Math.min(Math.max(...allowed!), max) : max;
  const floor = allowedSet ? Math.max(Math.min(...allowed!), min) : min;
  const snap = (item: number, from: number): number => {
    if (!allowedSet || allowedSet.has(item)) return item;
    let best = from;
    let bestDistance = Infinity;
    for (const candidate of allowed!) {
      const distance = Math.abs(candidate - item) * 2
        + ((candidate - item) * Math.sign(item - from) < 0 ? 1 : 0);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    return best;
  };
  const setLo = (item: number) => onChange([Math.min(Math.max(snap(item, lo), floor), hi), hi]);
  const setHi = (item: number) => onChange([lo, Math.max(Math.min(snap(item, hi), ceiling), lo)]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const loRef = useRef<HTMLInputElement>(null);
  const hiRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ pointerId: number; anchor: number; moving: number } | null>(null);
  const nearestThumb = (clientX: number): 'lo' | 'hi' | null => {
    const loElement = loRef.current;
    const hiElement = hiRef.current;
    const wrap = wrapRef.current;
    if (!loElement || !hiElement || !wrap) return null;
    const bounds = wrap.getBoundingClientRect();
    const xOf = (item: number) => bounds.left + ((item - min) / span) * bounds.width;
    const loDistance = Math.abs(clientX - xOf(lo));
    const hiDistance = Math.abs(clientX - xOf(hi));
    return loDistance < hiDistance || (loDistance === hiDistance && clientX <= xOf(lo)) ? 'lo' : 'hi';
  };
  const floatNearestThumb = (clientX: number) => {
    const loElement = loRef.current;
    const hiElement = hiRef.current;
    if (!loElement || !hiElement) return;
    const loOnTop = nearestThumb(clientX) === 'lo';
    loElement.style.zIndex = loOnTop ? '4' : '2';
    hiElement.style.zIndex = loOnTop ? '3' : '5';
  };
  const valueAt = (clientX: number): number => {
    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return min;
    const raw = min + ((clientX - bounds.left) / bounds.width) * span;
    const stepped = min + Math.round((raw - min) / step) * step;
    return Math.min(Math.max(Number(stepped.toFixed(12)), min), max);
  };
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (event.target !== loRef.current && event.target !== hiRef.current) return;
    const thumb = nearestThumb(event.clientX);
    if (!thumb) return;
    const moving = thumb === 'lo' ? lo : hi;
    dragRef.current = { pointerId: event.pointerId, anchor: thumb === 'lo' ? hi : lo, moving };
    (thumb === 'lo' ? loRef.current : hiRef.current)?.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      floatNearestThumb(event.clientX);
      return;
    }
    const moving = snap(valueAt(event.clientX), drag.moving);
    drag.moving = moving;
    onChange(orderedDragRange(drag.anchor, moving));
  };
  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    floatNearestThumb(event.clientX);
  };

  return (
    <div
      className={`range-slider${disabled ? ' is-disabled' : ''}`}
      onLostPointerCapture={() => { dragRef.current = null; }}
      onPointerCancel={stopDrag}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      ref={wrapRef}
      style={{ ['--rs-lo' as string]: percent(lo), ['--rs-hi' as string]: percent(hi) }}
    >
      <div className="range-slider-rail">
        <div className="range-slider-fill" />
        {ceiling < max && <div className="range-slider-cap" style={{ left: percent(ceiling) }} />}
      </div>
      <input
        aria-label={ariaLabel ? `${ariaLabel} — min` : 'minimum'}
        aria-valuemax={ceiling}
        aria-valuetext={format(lo)}
        className="range-slider-input range-slider-input-lo"
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => setLo(Number(event.target.value))}
        ref={loRef}
        step={step}
        type="range"
        value={lo}
      />
      <input
        aria-label={ariaLabel ? `${ariaLabel} — max` : 'maximum'}
        aria-valuemax={ceiling}
        aria-valuetext={format(hi)}
        className="range-slider-input range-slider-input-hi"
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => setHi(Number(event.target.value))}
        ref={hiRef}
        step={step}
        type="range"
        value={hi}
      />
      {marks && marks.length > 0 && (
        <div aria-hidden="true" className="range-slider-marks">
          {marks.map((mark) => (
            <span
              className={`range-slider-mark${markHighlight && mark >= lo && mark <= hi ? ' is-in' : ''}${allowedSet && !allowedSet.has(mark) ? ' is-out' : ''}`}
              key={mark}
              style={{ left: percent(mark) }}
            >{format(mark)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
