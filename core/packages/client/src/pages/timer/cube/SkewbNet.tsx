/**
 * Skewb net preview (stub).
 *
 * A skewb's faces are split into 5 stickers each: a central diamond and
 * four triangular corner stickers. Six faces total. We render a "T" net
 * like a 2x2 cube would have, but with the diamond+corner stickering for
 * each face. The state shown is solved (no scramble simulation).
 */

import type { JSX } from 'react';
import { WCA_COLORS } from './colors.ts';
import type { Face } from './moves.ts';

interface SkewbNetProps {
  scramble?: string;
  size?: number;
  className?: string;
}

const STROKE = '#1a1a1a';

export default function SkewbNet(props: SkewbNetProps): JSX.Element {
  const size = props.size ?? 36;
  const sectionGap = 4;
  const cols = 4;
  const rows = 3;
  const totalW = cols * size + (cols - 1) * sectionGap + 2;
  const totalH = rows * size + (rows - 1) * sectionGap + 2;

  function blockOrigin(face: Face): { x: number; y: number } {
    const col = face === 'L' ? 0 : face === 'F' ? 1 : face === 'R' ? 2 : face === 'B' ? 3 : 1;
    const row = face === 'U' ? 0 : face === 'D' ? 2 : 1;
    return {
      x: 1 + col * (size + sectionGap),
      y: 1 + row * (size + sectionGap),
    };
  }

  function skewbFace(face: Face): JSX.Element {
    const o = blockOrigin(face);
    const c = WCA_COLORS[face];
    // Outer square as 4 corner triangles + central diamond, all the same
    // colour for solved state.
    const x0 = o.x, y0 = o.y, x1 = o.x + size, y1 = o.y + size;
    const cx = o.x + size / 2, cy = o.y + size / 2;
    return (
      <g key={face}>
        {/* corner triangles */}
        <polygon points={`${x0},${y0} ${x1},${y0} ${cx},${cy}`} fill={c} stroke={STROKE} strokeWidth={1} />
        <polygon points={`${x1},${y0} ${x1},${y1} ${cx},${cy}`} fill={c} stroke={STROKE} strokeWidth={1} />
        <polygon points={`${x1},${y1} ${x0},${y1} ${cx},${cy}`} fill={c} stroke={STROKE} strokeWidth={1} />
        <polygon points={`${x0},${y1} ${x0},${y0} ${cx},${cy}`} fill={c} stroke={STROKE} strokeWidth={1} />
      </g>
    );
  }

  void props.scramble;
  const order: Face[] = ['U', 'L', 'F', 'R', 'B', 'D'];

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={props.className}
      style={{ display: 'block' }}
      role="img"
      aria-label="skewb net preview"
    >
      {order.map(skewbFace)}
    </svg>
  );
}
