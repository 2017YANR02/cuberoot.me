'use client';

/**
 * TimingSurface — presentation-only timing canvas for the redesigned shell.
 *
 * It owns NO timing logic. It renders the giant digits + a scramble slot
 * (top) + a corner cube net + state-driven color via the --timer-* tokens,
 * and applies the `.surface--running` distraction-free fade when phase is
 * 'running'. Solo drives it via React state (children); Battle (Phase 3) can
 * later write innerHTML directly into the digits node via `digitsRef`.
 *
 * The surface is the press target: the host wires native pointer/mouse/touch
 * listeners onto `surfaceRef` (so the existing shouldIgnoreTimerTarget guard
 * + passive:false preventDefault are preserved). This component only forwards
 * the refs and lays things out.
 */

import { type ReactNode, type RefObject } from 'react';

export interface TimingSurfaceProps {
  /** Engine phase — drives color tokens + the distraction-free fade. */
  phase: 'idle' | 'inspecting' | 'holding' | 'ready' | 'running' | 'stopped';
  /** State-color class suffix (e.g. 'holding' | 'ready' | 'running' |
   *  'inspection-warn-8' | 'dnf' | ''). Computed by the host from phase +
   *  inspection thresholds + penalty so this stays presentational. */
  colorClass: string;
  /** Inline font-size for the digits (honors user font scale). */
  fontSize: string;
  /** The digits text (Solo path). Ignored when `digitsRef` consumer writes
   *  innerHTML directly (Battle path) — Solo always passes a string. */
  digits: ReactNode;
  /** Imperative handle to the digits node so Battle can write innerHTML with
   *  zero per-tick React render. Solo leaves it untouched (React owns text). */
  digitsRef?: RefObject<HTMLDivElement | null>;
  /** Ref to the whole press surface — host attaches pointer listeners here. */
  surfaceRef: RefObject<HTMLDivElement | null>;
  /** Scramble slot (top). Host renders the mono click-to-copy strip. */
  scrambleSlot?: ReactNode;
  /** Cube-net slot. Rendered centered directly under the digits (Battle-style)
   *  as the first item of the sub area. Host renders CubePreview / toggle. */
  cornerSlot?: ReactNode;
  /** Hint / sub-content below the digits (idle hint, stage splits, quick
   *  actions, rank badge, target indicator…). */
  children?: ReactNode;
  /** Extra class on the surface (e.g. target overshot / pulse). */
  className?: string;
  /** Pointer handlers (mouse fallback) — host owns the guard logic. */
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void;
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
  className,
  onMouseDown,
  onMouseUp,
}: TimingSurfaceProps) {
  const running = phase === 'running';
  return (
    <div
      ref={surfaceRef}
      className={`timing-surface${running ? ' surface--running' : ''}${className ? ` ${className}` : ''}`}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      <div className="timing-surface-core">
        <div
          ref={digitsRef}
          className={`timer-display ${colorClass}`}
          style={{ fontSize }}
        >
          {digits}
        </div>
        {/* Sub-content floats below the digits (absolutely positioned in CSS)
            so the giant readout never shifts as the phase swaps what's here.
            Order: phase children (rank / quick actions / target) → scramble →
            cube net, so the scramble sits directly above its preview image. */}
        <div className="timing-surface-sub">
          {children}
          {scrambleSlot && <div className="timing-surface-scramble surface-chrome">{scrambleSlot}</div>}
          {cornerSlot && <div className="timing-surface-cube surface-chrome">{cornerSlot}</div>}
        </div>
      </div>
    </div>
  );
}
