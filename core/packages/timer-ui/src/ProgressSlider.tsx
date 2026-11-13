'use client';

import { useCallback, useEffect, useRef } from 'react';
import './progress-slider.css';

export interface ProgressSliderProps {
  value: number;
  min?: number;
  max: number;
  step?: number | 'any';
  /** Arrow-key increment, in the same units as value. */
  keyboardStep?: number;
  onChange: (value: number) => void;
  onInteractionStart?: () => void;
  /** Also ends on pointer cancellation or focus loss; playback policy belongs to the caller. */
  onInteractionEnd?: () => void;
  onCommit?: (value: number) => void;
  segmentEnds?: readonly number[];
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
  formatValue?: (value: number) => string;
}

const adjustmentKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

/** Controlled single-value slider. Values can represent time, steps, or any numeric progress. */
export default function ProgressSlider({ value, min = 0, max, step = 1, keyboardStep,
  onChange, onInteractionStart, onInteractionEnd, onCommit, segmentEnds, disabled = false,
  className, ariaLabel, formatValue }: ProgressSliderProps) {
  const validRange = Number.isFinite(min) && Number.isFinite(max) && max > min;
  const lower = Number.isFinite(min) ? min : 0;
  const upper = validRange ? max : lower + 1;
  const inactive = disabled || !validRange;
  const clamp = (n: number) => Math.max(lower, Math.min(upper, Number.isFinite(n) ? n : lower));
  const current = clamp(value);
  const increment = step === 'any' ? 'any' : Number.isFinite(step) && step > 0 ? step : 1;
  const interaction = useRef<{ pointerId?: number; value: number; changed: boolean } | null>(null);
  const finish = useCallback(() => {
    const active = interaction.current;
    if (!active) return;
    interaction.current = null;
    if (active.changed) onCommit?.(active.value);
    onInteractionEnd?.();
  }, [onCommit, onInteractionEnd]);
  useEffect(() => {
    const release = (event: PointerEvent) => {
      if (interaction.current?.pointerId === event.pointerId) finish();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', finish);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', finish);
    };
  }, [finish]);
  useEffect(() => { if (inactive) finish(); }, [inactive, finish]);
  const begin = (pointerId?: number) => {
    if (inactive || interaction.current) return;
    interaction.current = { pointerId, value: current, changed: false };
    onInteractionStart?.();
  };
  const change = (next: number) => {
    if (inactive) return;
    const bounded = clamp(next);
    if (interaction.current) {
      interaction.current.value = bounded;
      interaction.current.changed = true;
    }
    onChange(bounded);
    // Assistive technology can change the native input without pointer/key events.
    if (!interaction.current) onCommit?.(bounded);
  };
  const stops = [...new Set(segmentEnds)].filter(n => n > lower && n < upper).sort((a, b) => a - b).flatMap(n => {
    const position = `${(n - lower) / (upper - lower) * 100}%`;
    return [`transparent calc(${position} - 2px)`, `var(--background) calc(${position} - 2px)`,
      `var(--background) calc(${position} + 2px)`, `transparent calc(${position} + 2px)`];
  });
  return <input type="range" className={`progress-slider${className ? ` ${className}` : ''}`}
    style={{ ['--pct' as string]: `${(current - lower) / (upper - lower) * 100}%`,
      ['--segment-gaps' as string]: stops.length ? `linear-gradient(to right, transparent, ${stops.join(', ')}, transparent)` : 'linear-gradient(transparent, transparent)' }}
    min={lower} max={upper} step={increment} value={current} disabled={inactive}
    aria-label={ariaLabel} aria-valuetext={formatValue?.(current)}
    onChange={event => change(Number(event.target.value))}
    onPointerDown={event => { if (event.button === 0) begin(event.pointerId); }}
    onKeyDown={event => {
      if (!adjustmentKeys.has(event.key) || inactive) return;
      begin();
      if (keyboardStep === undefined || !Number.isFinite(keyboardStep) || keyboardStep <= 0) return;
      event.preventDefault();
      const previous = interaction.current?.value ?? current;
      const amount = keyboardStep * (event.key.startsWith('Page') ? 10 : 1);
      const next = event.key === 'Home' ? lower : event.key === 'End' ? upper
        : previous + (['ArrowLeft', 'ArrowDown', 'PageDown'].includes(event.key) ? -amount : amount);
      change(increment === 'any' || event.key === 'End' ? next : lower + Math.round((next - lower) / increment) * increment);
    }}
    onKeyUp={event => { if (adjustmentKeys.has(event.key) && interaction.current?.pointerId === undefined) finish(); }}
    onBlur={finish} />;
}
