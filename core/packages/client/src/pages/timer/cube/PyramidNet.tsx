/** Pyraminx net preview — applies scramble to render actual sticker state. */

import type { JSX } from 'react';
import { applyPyraScramble, type PyraFace, type PyraSticker } from './pyraminx_state.ts';

const COLORS: Record<PyraFace, string> = {
  D: '#FFD500', // yellow
  F: '#009B48', // green
  L: '#0046AD', // blue
  R: '#B71234', // red
};

const STROKE = '#1a1a1a';

interface PyramidNetProps {
  scramble?: string;
  size?: number;
  className?: string;
}

export default function PyramidNet(props: PyramidNetProps): JSX.Element {
  const size = props.size ?? 18;
  const N = 3;
  const side = size * N;
  const h = side * Math.sqrt(3) / 2;
  const padding = 4;
  const totalW = padding * 2 + 4 * side + 3 * 6;
  const totalH = padding * 2 + h + 4;

  const state = applyPyraScramble(props.scramble ?? '');

  function triangle(x: number, y: number, stickers: PyraSticker[], label: string): JSX.Element {
    const subs: JSX.Element[] = [];
    const dx = side / N;
    const dy = h / N;
    // Walk in our index order: row 0 (1 up-tri), row 1 (up,down,up), row 2 (up,down,up,down,up).
    let idx = 0;
    for (let row = 0; row < N; row++) {
      const rowY = y + row * dy;
      for (let col = 0; col < N - row; col++) {
        const xOffset = (row * dx) / 2 + col * dx;
        const ax = x + xOffset;
        const ay = rowY;
        // Up-tri
        subs.push(
          <polygon
            key={`u-${label}-${row}-${col}`}
            points={`${ax + dx / 2},${ay} ${ax},${ay + dy} ${ax + dx},${ay + dy}`}
            fill={COLORS[stickers[idx]]}
            stroke={STROKE}
            strokeWidth={1}
          />,
        );
        idx++;
        if (col < N - row - 1) {
          // Down-tri to its right
          subs.push(
            <polygon
              key={`d-${label}-${row}-${col}`}
              points={`${ax + dx},${ay + dy} ${ax + dx / 2},${ay} ${ax + dx * 1.5},${ay}`}
              fill={COLORS[stickers[idx]]}
              stroke={STROKE}
              strokeWidth={1}
            />,
          );
          idx++;
        }
      }
    }
    return <g key={label}>{subs}</g>;
  }

  // Wait — the index order in my model is (per face):
  //   row0:        [0]
  //   row1:      [1 2 3]
  //   row2:    [4 5 6 7 8]
  // The render walks: row 0 emits up at idx 0; row 1 emits up(1), down(2), up(3); row 2: up(4), down(5), up(6), down(7), up(8).
  // The render walk above emits up then down (if exists) per (row, col). Let me trace:
  //   row=0, col=0: up-tri (idx 0). col < N-row-1 = 0-1 < 0 → false, no down.
  //   row=1, col=0: up-tri (idx 1). col < 1 → 0<1 true: down-tri (idx 2).
  //   row=1, col=1: up-tri (idx 3). col<1 → 1<1 false, no down.
  //   row=2, col=0: up (4). col<2 → 0<2 true: down (5).
  //   row=2, col=1: up (6). col<2 → 1<2 true: down (7).
  //   row=2, col=2: up (8). col<2 → 2<2 false, no down.
  // ✓ matches indexing.

  // 4 faces in net: L, F, R, D (in row).
  const faces: Array<[PyraFace, number]> = [
    ['L', 0], ['F', 1], ['R', 2], ['D', 3],
  ];

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={props.className}
      style={{ display: 'block' }}
      role="img"
      aria-label="pyraminx net preview"
    >
      {faces.map(([f, col]) => {
        const x = padding + col * (side + 6);
        const y = padding;
        return triangle(x, y, state[f], f);
      })}
    </svg>
  );
}
