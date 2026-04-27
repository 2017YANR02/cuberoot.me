/** Skewb net preview — applies scramble to render actual sticker state. */

import type { JSX } from 'react';
import { applySkewbScramble, type SkewbFace, type SkewbSticker } from './skewb_state.ts';

const COLORS: Record<SkewbFace, string> = {
  U: '#FFFFFF', // white
  D: '#FFD500', // yellow
  F: '#009B48', // green
  B: '#0046AD', // blue
  L: '#FF5800', // orange
  R: '#B71234', // red
};

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

  function blockOrigin(face: SkewbFace): { x: number; y: number } {
    const col = face === 'L' ? 0 : face === 'F' ? 1 : face === 'R' ? 2 : face === 'B' ? 3 : 1;
    const row = face === 'U' ? 0 : face === 'D' ? 2 : 1;
    return {
      x: 1 + col * (size + sectionGap),
      y: 1 + row * (size + sectionGap),
    };
  }

  const state = applySkewbScramble(props.scramble ?? '');

  function skewbFace(face: SkewbFace): JSX.Element {
    const o = blockOrigin(face);
    const stickers: SkewbSticker[] = state[face];
    // Sticker indices: 0=TL, 1=TR, 2=BR, 3=BL, 4=center diamond
    const x0 = o.x, y0 = o.y, x1 = o.x + size, y1 = o.y + size;
    const cx = o.x + size / 2, cy = o.y + size / 2;
    return (
      <g key={face}>
        {/* TL corner triangle */}
        <polygon points={`${x0},${y0} ${cx},${y0} ${cx},${cy} ${x0},${cy}`} fill={COLORS[stickers[0]]} stroke={STROKE} strokeWidth={1} />
        {/* TR corner triangle */}
        <polygon points={`${cx},${y0} ${x1},${y0} ${x1},${cy} ${cx},${cy}`} fill={COLORS[stickers[1]]} stroke={STROKE} strokeWidth={1} />
        {/* BR corner triangle */}
        <polygon points={`${cx},${cy} ${x1},${cy} ${x1},${y1} ${cx},${y1}`} fill={COLORS[stickers[2]]} stroke={STROKE} strokeWidth={1} />
        {/* BL corner triangle */}
        <polygon points={`${x0},${cy} ${cx},${cy} ${cx},${y1} ${x0},${y1}`} fill={COLORS[stickers[3]]} stroke={STROKE} strokeWidth={1} />
        {/* center diamond on top */}
        <polygon points={`${cx},${y0} ${x1},${cy} ${cx},${y1} ${x0},${cy}`} fill={COLORS[stickers[4]]} stroke={STROKE} strokeWidth={1} />
      </g>
    );
  }

  const order: SkewbFace[] = ['U', 'L', 'F', 'R', 'B', 'D'];

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
