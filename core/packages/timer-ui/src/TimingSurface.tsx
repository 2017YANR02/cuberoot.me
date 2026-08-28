/**
 * Shared presentation-only timing canvas for the website and Capacitor App.
 *
 * Timing, scrambles, persistence, routing and native capabilities remain in
 * their host adapters. This component owns only the common DOM structure and
 * state-driven presentation contract.
 */

import {
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
      <div className="timing-surface-core">
        <div className="timer-display-wrap">
          <div
            ref={digitsRef}
            className={`timer-display ${colorClass}`}
            style={{ fontSize }}
          >
            {digits}
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
