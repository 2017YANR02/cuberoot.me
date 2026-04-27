/**
 * Top-level scramble preview dispatcher.
 *
 * Picks the appropriate renderer for an event:
 *
 *   222/333/444/555/666/777            → CubeNet (NxN)
 *   333oh/333bld/333ni/333fm/333mr     → CubeNet 3×3
 *   444bld/555bld/666bld/777bld        → CubeNet matching size (BLD scrambles
 *                                        contain the same NxN tokens + Rw/Uw
 *                                        orientation moves; we apply them all)
 *   pyra                               → PyramidNet (stub)
 *   skewb                              → SkewbNet (stub)
 *   sq1                                → Sq1Net (placeholder)
 *   mega                               → MegaminxNet (stub)
 *   clock                              → ClockFace (stub)
 *   r3 / r4 / r5                       → CubeNet 3×3 of the relay's first
 *                                        scramble (best-effort)
 *   cross/f2l/ll/oll/pll/coll/cmll/zbll/eg1/eg2 → CubeNet 3×3
 *   custom                             → CubeNet 3×3 if scramble looks like NxN
 *                                        notation, else blank
 *   magic / mmagic                     → blank "no preview"
 */

import type { JSX } from 'react';
import type { EventId } from '../types.ts';
import CubeNet from './CubeNet.tsx';
import { nxnSizeForEvent } from './colors.ts';
import PyramidNet from './PyramidNet.tsx';
import SkewbNet from './SkewbNet.tsx';
import MegaminxNet from './MegaminxNet.tsx';
import Sq1Net from './Sq1Net.tsx';
import ClockFace from './ClockFace.tsx';

interface CubePreviewProps {
  event: EventId;
  scramble: string;
  size?: number;
  className?: string;
  /** Optional override of the WCA color scheme. Currently passed through to
   * the NxN renderer; other puzzles ignore it (they use solved-state stubs). */
  colors?: Partial<Record<'U'|'D'|'F'|'B'|'L'|'R', string>>;
}

function NoPreview({ size = 14, className }: { size?: number; className?: string }): JSX.Element {
  const w = size * 8;
  const h = size * 5;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      style={{ display: 'block' }}
      role="img"
      aria-label="no preview available"
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
  // Relay scrambles in cstimer typically look like:
  //   "2x2: U R F U2..."
  //   "3x3: R U R'..."
  // We just grab everything; the parser ignores tokens it doesn't know.
  // For 3x3-only relay rendering we strip lines that obviously belong to
  // bigger cubes and keep the 3x3 line if labelled. Best-effort heuristic.
  const lines = s.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*3x3\s*[:.-]?\s*(.+)$/i);
    if (m) return m[1];
  }
  // Otherwise fall back to the whole scramble (parser is forgiving).
  return s;
}

export default function CubePreview(props: CubePreviewProps): JSX.Element {
  const { event, scramble, colors } = props;
  const size = props.size;
  const className = props.className;

  // NxN cubes (including BLD / OH / FM / variants).
  if (nxnSizeForEvent(event) !== null) {
    return <CubeNet event={event} scramble={scramble} size={size} className={className} colors={colors} />;
  }

  switch (event) {
    case 'pyra':
      return <PyramidNet scramble={scramble} size={size} className={className} />;
    case 'skewb':
      return <SkewbNet scramble={scramble} size={size} className={className} />;
    case 'sq1':
      return <Sq1Net scramble={scramble} size={size} className={className} />;
    case 'mega':
      return <MegaminxNet scramble={scramble} size={size} className={className} />;
    case 'clock':
      return <ClockFace scramble={scramble} size={size} className={className} />;
    case 'r3':
    case 'r4':
    case 'r5':
      return <CubeNet event="333" scramble={firstNxnScramble(scramble)} size={size} className={className} colors={colors} />;
    case 'custom':
      // Best-effort: try to render as 3x3.
      return <CubeNet event="333" scramble={scramble} size={size} className={className} colors={colors} />;
    case 'magic':
    case 'mmagic':
      return <NoPreview size={size} className={className} />;
    default:
      return <NoPreview size={size} className={className} />;
  }
}
