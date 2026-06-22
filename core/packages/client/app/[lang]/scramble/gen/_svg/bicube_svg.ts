/**
 * Bicube (bic) state preview — a 2D net of the four faces cstimer models (U / F / L / R), colored
 * ENTIRELY from the solver's exact 23-element sticker state (lib/bicube-solver). The Bicube is a
 * bandaged 3×3×3 cube; cstimer only exposes these four faces (9 stickers each). We lay them out as a
 * partial unfolded net — U on top, then L · F · R in a row — and paint every one of the 9 cells per face
 * with the data-color of its current sticker. Bandaged 2×1×1 blocks just show up as adjacent same-colored
 * cells (they share a color label). Single source of move truth = bicApply; at solved the layout is a
 * fixed canonical pattern (self-proving), and any scramble repaints faithfully.
 *
 * The 12 color labels (0..11; label 0 = the single "hinge" sticker) map to 12 distinct data colors.
 */
import { bicApply, BIC_SOLVED } from '@/lib/bicube-solver';

// 12 distinct sticker data-colors, indexed by color label 0..11. Label 0 (hinge) gets a neutral dark so
// it reads as the "pivot"; the rest are clear, well-separated hues (puzzle sticker hex, like skewb/cm2).
export const BIC_DEFAULT_COLORS = {
  stickers: [
    '#2B2B2B', // 0 hinge (dark pivot)
    '#EE0000', // 1 red
    '#FF8800', // 2 orange
    '#FFD500', // 3 yellow
    '#00B14F', // 4 green
    '#1463E6', // 5 blue
    '#FFFFFF', // 6 white
    '#8338EC', // 7 purple
    '#F72585', // 8 pink
    '#00C2C7', // 9 cyan
    '#A3E635', // 10 lime
    '#B5651D', // 11 brown
  ] as const,
  stroke: '#000',
  bg: '#FFFFFF',
} as const;

// d[face] = the 9 sticker indices of each face (same as solver / cstimer), grid-mapped to a 3×3 below.
const D: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 2, 5, 8, 7, 6, 3, 4], // U
  [6, 7, 8, 13, 20, 19, 18, 11, 12], // F
  [0, 3, 6, 11, 18, 17, 16, 9, 10], // L
  [8, 5, 2, 15, 22, 21, 20, 13, 14], // R
];
// cstimer's d[] lists stickers in cycle order (corner,edge,corner,…,centre). Map them onto a 3×3 grid
// (row-major positions 0..8) so the centre [index 8] sits at grid centre (4) and the ring is in order.
// ring order around the face = grid positions [0,1,2,5,8,7,6,3], centre = 4.
const RING_GRID = [0, 1, 2, 5, 8, 7, 6, 3];
function faceGrid(state: ReadonlyArray<number>, face: number): number[] {
  const di = D[face];
  const grid = new Array<number>(9);
  for (let k = 0; k < 8; k++) grid[RING_GRID[k]] = state[di[k]];
  grid[4] = state[di[8]]; // centre
  return grid;
}

const CELL = 18;
const FACE_W = CELL * 3;
const GAP = 6;
// Net: U on top (col 1), then row L(col0) F(col1) R(col2).
//   row0:        [   U   ]
//   row1: [ L ][ F ][ R ]
const ORIGIN_X = 8;
const ORIGIN_Y = 8;
const faceOrigin = (col: number, row: number): [number, number] => [
  ORIGIN_X + col * (FACE_W + GAP),
  ORIGIN_Y + row * (FACE_W + GAP),
];
const PLACEMENT: Record<number, [number, number]> = {
  0: faceOrigin(1, 0), // U
  2: faceOrigin(0, 1), // L
  1: faceOrigin(1, 1), // F
  3: faceOrigin(2, 1), // R
};
const VIEW_W = ORIGIN_X * 2 + FACE_W * 3 + GAP * 2;
const VIEW_H = ORIGIN_Y * 2 + FACE_W * 2 + GAP;

function faceSvg(state: ReadonlyArray<number>, face: number): string {
  const [ox, oy] = PLACEMENT[face];
  const grid = faceGrid(state, face);
  const C = BIC_DEFAULT_COLORS;
  const out: string[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const label = grid[r * 3 + c];
      const fill = C.stickers[label] ?? '#888888';
      const x = ox + c * CELL;
      const y = oy + r * CELL;
      out.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${fill}" stroke="${C.stroke}" stroke-width="1"/>`);
    }
  }
  return out.join('');
}

export function renderBicScrambleSvg(scramble: string): string {
  let st: number[] = [...BIC_SOLVED];
  try {
    st = bicApply(scramble);
  } catch (e) {
    console.warn('[bicube_svg] apply failed', scramble, e);
  }
  const C = BIC_DEFAULT_COLORS;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
    `<rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" fill="${C.bg}"/>`,
  ];
  for (const face of [0, 2, 1, 3]) out.push(faceSvg(st, face));
  out.push('</svg>');
  return out.join('');
}
