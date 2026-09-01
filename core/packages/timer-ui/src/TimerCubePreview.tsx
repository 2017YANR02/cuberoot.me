'use client';

/**
 * Top-level scramble preview dispatcher.
 *
 * All puzzles route through TimerScramblePreview. It uses cubing.js for the
 * supported 2D/3D puzzles and the canonical SVG renderers for SQ1/Megaminx.
 * NxN-class events (333oh / 333bld / 333fm / 444bld / 555bld / etc.) reuse
 * their base size's scrambler. Relays show only the 3x3 sub-scramble.
 *
 *   pyra / skewb / sq1 / mega / clock                    → shared preview
 *   222/333/444/555/666/777 + their bld/oh/fm variants   → shared preview
 *   fto                                                  → shared preview
 *   r3 / r4 / r5                                         → 3x3 of first sub
 *   custom                                               → best-effort 3x3
 *   magic / mmagic + the other non-WCA ids               → blank "no preview"
 */

import { timerEventNxnSize, type EventId } from '@cuberoot/shared/timer';
import type { JSX } from 'react';

import { TimerScramblePreview } from './TimerScramblePreview';

export interface TimerCubePreviewProps {
  event: EventId;
  scramble: string;
  size?: number;
  /** Fix the rendered height across all puzzles (px number or CSS length
   *  string for fluid sizing) — see TimerScramblePreview. */
  height?: number | string;
  className?: string;
  /** Forwarded to TimerScramblePreview. Default 2D. */
  visualization?: '2D' | '3D';
  ariaLabel?: string;
  /** Fill a host-owned responsive box. */
  fill?: boolean;
}

function NoPreview({ ariaLabel, fill, size = 14, className }: { ariaLabel?: string; fill?: boolean; size?: number; className?: string }): JSX.Element {
  const w = size * 8;
  const h = size * 5;
  return (
    <svg
      width={fill ? '100%' : w}
      height={fill ? '100%' : h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      style={{ display: 'block' }}
      role="img"
      aria-label={ariaLabel ?? 'no preview available'}
    >
      <rect x={0} y={0} width={w} height={h} fill="#1c1c1c" rx={4} />
      <text
        x={w / 2}
        y={h / 2}
        fill="#888"
        fontSize={Math.round(size * 0.9)}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="ui-sans-serif,system-ui,sans-serif"
      >
        no preview
      </text>
    </svg>
  );
}

/**
 * Extract the first NxN-cube scramble from a multi-line/relay scramble.
 * Used by relay events whose scramble contains multiple sub-scrambles.
 */
function firstNxnScramble(s: string): string {
  const lines = s.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*3x3\s*[:.-]?\s*(.+)$/i);
    if (m) return m[1];
  }
  return s;
}

/** Map any NxN-class event id to its base nxn event id (for scramble-display). */
function baseNxnEvent(event: EventId): EventId | null {
  const n = timerEventNxnSize(event);
  if (n === null) return null;
  switch (n) {
    case 2: return '222';
    case 3: return '333';
    case 4: return '444';
    case 5: return '555';
    case 6: return '666';
    case 7: return '777';
    default: return null;
  }
}

export function TimerCubePreview(props: TimerCubePreviewProps): JSX.Element {
  const { ariaLabel, event, fill, scramble, visualization, height } = props;
  const size = props.size;
  const className = props.className;
  const v = visualization;
  // NoPreview is a w8×h5 svg; derive its base unit from a numeric target height
  // (a CSS-string height can't drive the svg, so fall back to the size prop).
  const noPreviewSize = typeof height === 'number' ? Math.round(height / 5) : size;

  // NxN family (incl. BLD / OH / FM / MR / NI variants) → shared preview
  // with the matching base nxn id.
  const baseNxn = baseNxnEvent(event);
  if (baseNxn !== null) {
    return <TimerScramblePreview ariaLabel={ariaLabel} event={baseNxn} fill={fill} scramble={scramble} size={size} height={height} className={className} visualization={v} />;
  }

  switch (event) {
    case 'pyra':
    case 'skewb':
    case 'sq1':
    case 'mega':
    case 'clock':
    // FTO is the one non-WCA puzzle where csTimer's scramble notation is also
    // valid cubing.js notation (verified in tests/timer_nonwca_scramble.test.ts,
    // which applies every generated scramble to cubing.js's `fto` KPuzzle).
    //
    // The others deliberately fall through to the "no preview" box rather than
    // risk drawing a wrong cube: kilominx / redi have a cubing.js puzzle but a
    // DIFFERENT notation (csTimer emits corner grips like `DBL` / lowercase
    // `r`, which cubing.js rejects — an unparseable alg would silently render a
    // SOLVED puzzle), and gear / ivy / mpyram have no cubing.js puzzle at all.
    case 'fto':
      return <TimerScramblePreview ariaLabel={ariaLabel} event={event} fill={fill} scramble={scramble} size={size} height={height} className={className} visualization={v} />;
    case 'r3':
    case 'r4':
    case 'r5':
      return <TimerScramblePreview ariaLabel={ariaLabel} event="333" fill={fill} scramble={firstNxnScramble(scramble)} size={size} height={height} className={className} visualization={v} />;
    case 'custom':
      return <TimerScramblePreview ariaLabel={ariaLabel} event="333" fill={fill} scramble={scramble} size={size} height={height} className={className} visualization={v} />;
    case 'magic':
    case 'mmagic':
      return <NoPreview ariaLabel={ariaLabel} fill={fill} size={noPreviewSize} className={className} />;
    default:
      return <NoPreview ariaLabel={ariaLabel} fill={fill} size={noPreviewSize} className={className} />;
  }
}
