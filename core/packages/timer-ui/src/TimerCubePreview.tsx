'use client';

/**
 * Top-level scramble preview dispatcher.
 *
 * All puzzles route through TimerScramblePreview. It uses cubing.js for the
 * supported 2D/3D puzzles and the canonical SVG renderers for SQ1/Megaminx/Duo/Magic/Sphere.
 * NxN-class events (333oh / 333bld / 333fm / 444bld / 555bld / etc.) reuse
 * their base size's scrambler. Relays show only the 3x3 sub-scramble.
 *
 *   pyra / skewb / sq1 / mega / clock                    → shared preview
 *   222/333/444/555/666/777 + their bld/oh/fm variants   → shared preview
 *   fto / redi / kilominx                               → shared preview
 *   sphere                                              → spherical 3x3 SVG
 *   r3 / r4 / r5                                         → 3x3 of first sub
 *   custom                                               → best-effort 3x3
 *   magic / mmagic                                      → practice start pattern
 *   other unsupported ids                               → blank "no preview"
 */

import { timerEventNxnSize, type EventId } from '@cuberoot/shared/timer';
import type { JSX } from 'react';

import { TimerScramblePreview, timerScramblePreviewAspect } from './TimerScramblePreview';

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
    const prefix = /^\s*3x3/i.exec(line);
    if (!prefix) continue;
    const tail = line.slice(prefix[0].length);
    const rest = tail.trimStart().replace(/^[:.-]/, '').trimStart();
    if (rest && !/[\r\n\u2028\u2029]/.test(rest)) return rest;
    // Greedy whitespace/separator parsing must leave the same final character
    // as the former (.+) capture when the line contains no move text.
    if (!tail.trim().replace(/^[:.-]/, '') && tail && !/[\r\n\u2028\u2029]/.test(tail.at(-1)!)) return tail.at(-1)!;
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

function previewEvent(event: EventId): EventId | null {
  // Sphere uses 3x3 moves but keeps its actual spherical preview.
  if (event === 'sphere') return event;
  const nxn = baseNxnEvent(event);
  if (nxn !== null) return nxn;
  switch (event) {
    case 'pyra': case 'skewb': case 'sq1': case 'mega': case 'clock':
    case 'pyraminx_duo': case 'magic': case 'mmagic': case 'fto': case 'redi': case 'kilominx':
      return event;
    case 'r3': case 'r4': case 'r5': case 'custom':
      return '333';
    default:
      return null;
  }
}

/** Same event normalization and state-dependent aspect as the actual preview. */
export function timerCubePreviewAspect(event: EventId, scramble?: string | null): number {
  const target = previewEvent(event);
  return target === null ? 8 / 5 : timerScramblePreviewAspect(target, scramble ?? '') ?? 8 / 5;
}

export function TimerCubePreview(props: TimerCubePreviewProps): JSX.Element {
  const { ariaLabel, event, fill, scramble, visualization, height } = props;
  const size = props.size;
  const className = props.className;
  const v = visualization;
  // NoPreview is a w8×h5 svg; derive its base unit from a numeric target height
  // (a CSS-string height can't drive the svg, so fall back to the size prop).
  const noPreviewSize = typeof height === 'number' ? Math.round(height / 5) : size;

  const target = previewEvent(event);
  if (target === null) {
    return <NoPreview ariaLabel={ariaLabel} fill={fill} size={noPreviewSize} className={className} />;
  }
  const previewScramble = event === 'r3' || event === 'r4' || event === 'r5'
    ? firstNxnScramble(scramble)
    : scramble;
  return <TimerScramblePreview ariaLabel={ariaLabel} event={target} fill={fill} scramble={previewScramble} size={size} height={height} className={className} visualization={v} />;
}
