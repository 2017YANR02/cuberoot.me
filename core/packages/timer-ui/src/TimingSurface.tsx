/**
 * Shared presentation-only timing canvas for the website and Capacitor App.
 *
 * Timing, scrambles, persistence, routing and native capabilities remain in
 * their host adapters. This component owns only the common DOM structure and
 * state-driven presentation contract.
 */

import {
  useLayoutEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';

export interface TimingSurfaceProps {
  phase: 'idle' | 'inspecting' | 'holding' | 'ready' | 'running' | 'stopped';
  colorClass: string;
  fontSize: string;
  digits: ReactNode;
  digitsRef?: RefObject<HTMLDivElement | null>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  scrambleSlot?: ReactNode;
  cornerSlot?: ReactNode;
  children?: ReactNode;
  digitsCorner?: ReactNode;
  className?: string;
  interactive?: boolean;
  ariaLabel?: string;
  onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onMouseDown?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onMouseUp?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export default function TimingSurface({
  phase,
  colorClass,
  fontSize,
  digits,
  digitsRef,
  surfaceRef,
  scrambleSlot,
  cornerSlot,
  children,
  digitsCorner,
  className,
  interactive = false,
  ariaLabel,
  onContextMenu,
  onMouseDown,
  onMouseUp,
  onPointerCancel,
  onPointerDown,
  onPointerUp,
}: TimingSurfaceProps) {
  const running = phase === 'running';
  const coreRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const core = coreRef.current;
    const readout = readoutRef.current;
    if (!core || !readout) return;
    let frame: number | null = null;
    const fit = () => {
      frame = null;
      const previous = Number(readout.style.getPropertyValue('--timer-readout-fit')) || 1;
      const measuredWidth = readout.getBoundingClientRect().width;
      const naturalWidth = measuredWidth / previous;
      // Leave one CSS pixel per side for fractional glyph/layout rounding.
      const available = Math.max(0, core.clientWidth - 2);
      if (naturalWidth <= 0 || available <= 0) return;
      // Font layout rounds individual glyph/span widths to subpixels. Chasing
      // that noise can alternate fit ratios forever, triggering one observer
      // and layout per frame even for a stopped timer. This tolerance is well
      // inside the two-pixel safety margin and does not hide any digit.
      if (Math.abs(Math.min(naturalWidth, available) - measuredWidth) <= 0.25) return;
      // Retain the host's chosen font/size; shrink only if the complete time
      // would overflow. Undo the previous fit when measuring so the readout
      // can also grow again after rotation or returning to a shorter time.
      const next = Math.floor(Math.min(1, available / naturalWidth) * 1_000_000) / 1_000_000;
      if (Math.abs(next - previous) > 0.000001) readout.style.setProperty('--timer-readout-fit', String(next));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (frame === null) frame = requestAnimationFrame(fit);
    });
    // Actual width changes (digit count, font loading, viewport) drive fitting,
    // not every timer tick. A same-width 12.34 → 12.35 causes no layout work.
    observer.observe(core);
    observer.observe(readout);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div
      ref={surfaceRef}
      aria-label={ariaLabel}
      className={`timing-surface${running ? ' surface--running' : ''}${className ? ` ${className}` : ''}`}
      data-timer-pad={interactive ? '' : undefined}
      onContextMenu={onContextMenu}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <div className="timing-surface-core" ref={coreRef}>
        <div className="timer-display-wrap">
          <div
            ref={digitsRef}
            className={`timer-display ${colorClass}`}
            style={{ fontSize }}
          >
            <span className="timer-display-value" ref={readoutRef}>{digits}</span>
          </div>
          {digitsCorner && <div className="timer-display-corner surface-chrome">{digitsCorner}</div>}
        </div>
        <div className="timing-surface-sub">
          {children}
          {scrambleSlot && <div className="timing-surface-scramble surface-chrome">{scrambleSlot}</div>}
          {cornerSlot && <div className="timing-surface-cube surface-chrome">{cornerSlot}</div>}
        </div>
      </div>
    </div>
  );
}
