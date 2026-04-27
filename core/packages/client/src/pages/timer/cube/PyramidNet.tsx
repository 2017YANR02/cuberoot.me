/**
 * Pyraminx net preview.
 *
 * A pyraminx has 4 triangular faces (U, L, R, B) of 9 small triangles each
 * (4 up-pointing + 5 down-pointing for a side-3 triangle subdivided into
 * 9 = 3² sub-triangles).
 *
 * For a "preview" we don't simulate the full pyraminx. Instead we render
 * the net of a SOLVED pyraminx with each face in WCA-suggested colours
 * (U=yellow, F=green, R=red, L=blue per common convention; we keep our
 * WCA palette but assign Pyraminx-faces to it). This still gives the
 * user a visual stand-in for the puzzle. A future revision can hook this
 * up to a pyraminx state simulator.
 */

import type { JSX } from 'react';

const PYRAMINX_COLORS = {
  U: '#FFD500', // yellow on top
  F: '#009B48', // green front
  L: '#0046AD', // blue left
  R: '#B71234', // red right
};

interface PyramidNetProps {
  scramble?: string;
  size?: number;
  className?: string;
}

const STROKE = '#1a1a1a';

export default function PyramidNet(props: PyramidNetProps): JSX.Element {
  const size = props.size ?? 18;
  // Each face is an equilateral triangle with side N*size where N=3.
  const N = 3;
  const side = size * N;
  const h = side * Math.sqrt(3) / 2;

  // Layout: F triangle in middle. L, R, U triangles flipped against F's
  // edges to form the standard "petal" net (a bigger triangle with three
  // little triangles folded in).
  // Simpler: 4 triangles side by side in a row (A B C D).
  const padding = 4;
  const totalW = padding * 2 + 4 * side + 3 * 6;
  const totalH = padding * 2 + h + 4;

  function triangle(x: number, y: number, color: string, label: string): JSX.Element {
    // Equilateral triangle pointing up from (x, y+h) base.
    const subTriangles: JSX.Element[] = [];
    // Subdivide into N² = 9 sub-triangles. Use barycentric grid.
    // Up-pointing sub-triangles indexed by (row, col).
    const dx = side / N;
    const dy = h / N;
    for (let row = 0; row < N; row++) {
      // Row 'row' from the top. Number of up-tris in this row: N - row.
      const rowY = y + row * dy;
      for (let col = 0; col < N - row; col++) {
        // Up-pointing sub-triangle at position (row, col) in this row.
        const xOffset = (row * dx) / 2 + col * dx;
        const ax = x + xOffset;
        const ay = rowY;
        // Up-pointing: vertices (ax + dx/2, ay), (ax, ay + dy), (ax + dx, ay + dy).
        subTriangles.push(
          <polygon
            key={`u-${label}-${row}-${col}`}
            points={`${ax + dx / 2},${ay} ${ax},${ay + dy} ${ax + dx},${ay + dy}`}
            fill={color}
            stroke={STROKE}
            strokeWidth={1}
          />,
        );
        // Down-pointing sub-triangle to its right (only if col < N-row-1).
        if (col < N - row - 1) {
          subTriangles.push(
            <polygon
              key={`d-${label}-${row}-${col}`}
              points={`${ax + dx},${ay + dy} ${ax + dx / 2},${ay} ${ax + dx * 1.5},${ay}`}
              fill={color}
              stroke={STROKE}
              strokeWidth={1}
            />,
          );
        }
      }
    }
    return <g key={label}>{subTriangles}</g>;
  }

  const faces: Array<[keyof typeof PYRAMINX_COLORS, number]> = [
    ['L', 0], ['F', 1], ['R', 2], ['U', 3],
  ];
  // Suppress unused-var: we keep `scramble` in the prop signature for API
  // parity, even though the simulator is a stub.
  void props.scramble;

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
      {faces.map(([f, idx]) => {
        const x = padding + idx * (side + 6);
        const y = padding;
        return triangle(x, y, PYRAMINX_COLORS[f], f);
      })}
    </svg>
  );
}
