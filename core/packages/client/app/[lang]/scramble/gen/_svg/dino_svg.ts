/**
 * Dino Cube (恐龙魔方 / dinoso) scramble preview — a 6-face unfolded CUBE NET.
 *
 * The Dino Cube is a cube: 6 square faces, each carrying 4 edge stickers (one per
 * side). We draw the standard cross net (U on top; L F R B middle row; D bottom)
 * and split each face square into 4 triangles by its two diagonals — the up /
 * right / down / left triangle. Each triangle is one dino edge sticker. Colors
 * come from lib/dino-solver `dinoStickers` (a faithful 24-sticker model of
 * cstimer's dino, cross-checked move-for-move against cstimer's edge permutation),
 * so the preview is derived from the true state. Solved → every face is a single
 * color (self-certifying).
 *
 * Colors: cstimer Dino faces are U/D/F/R/B/L (6 colors); we use distinct data
 * hues (not UI grey) so a scrambled state is legible.
 */

import { dinoStickers } from '@/lib/dino-solver';

// Face order in the sticker model = U D F R B L. Standard speedcube-ish hues.
const FACE_COLORS = [
  '#eab308', // U yellow
  '#f8fafc', // D white
  '#16a34a', // F green
  '#dc2626', // R red
  '#2563eb', // B blue
  '#f97316', // L orange
];

// For each face (U D F R B L), the sticker id (into the 24-array) sitting on each
// net side, order [up, right, down, left]. Derived from the dino edge→face model
// (each face has exactly one sticker per side).
const FACE_SIDE_STICKERS: ReadonlyArray<[number, number, number, number]> = [
  /* U */ [6, 0, 2, 4],
  /* D */ [10, 8, 14, 12],
  /* F */ [3, 16, 11, 19],
  /* R */ [1, 22, 9, 17],
  /* B */ [7, 20, 15, 23],
  /* L */ [5, 18, 13, 21],
];

const CELL = 34;   // face square side
const GAP = 4;     // gap between faces

// Cross-net grid position (col, row) of each face: U(1,0) L(0,1) F(1,1) R(2,1) B(3,1) D(1,2).
const FACE_GRID: ReadonlyArray<[number, number]> = [
  /* U */ [1, 0],
  /* D */ [1, 2],
  /* F */ [1, 1],
  /* R */ [2, 1],
  /* B */ [3, 1],
  /* L */ [0, 1],
];

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }

// The 4 corner-to-center triangles of a CELL×CELL square at (ox,oy).
// Order = up, right, down, left (matching FACE_SIDE_STICKERS).
function sideTriangles(ox: number, oy: number): [number, number][][] {
  const c: [number, number] = [ox + CELL / 2, oy + CELL / 2];
  const tl: [number, number] = [ox, oy];
  const tr: [number, number] = [ox + CELL, oy];
  const br: [number, number] = [ox + CELL, oy + CELL];
  const bl: [number, number] = [ox, oy + CELL];
  return [
    [tl, tr, c],  // up
    [tr, br, c],  // right
    [br, bl, c],  // down
    [bl, tl, c],  // left
  ];
}

/**
 * Render a Dino Cube scramble as a 6-face unfolded cross-net SVG (transparent bg).
 * Colors derived from the true state; solved = single color per face.
 */
export function renderDinoScrambleSvg(scramble: string): string {
  let stickers: number[];
  try { stickers = dinoStickers(scramble); }
  catch (e) { console.warn('[dino_svg] dinoStickers failed', scramble, e); stickers = dinoStickers(''); }

  const cols = 4, rows = 3;
  const w = cols * CELL + (cols + 1) * GAP;
  const h = rows * CELL + (rows + 1) * GAP;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(w)} ${fmt(h)}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`);

  for (let face = 0; face < 6; face++) {
    const [gx, gy] = FACE_GRID[face];
    const ox = GAP + gx * (CELL + GAP);
    const oy = GAP + gy * (CELL + GAP);
    const tris = sideTriangles(ox, oy);
    const sides = FACE_SIDE_STICKERS[face];
    for (let side = 0; side < 4; side++) {
      const colorIdx = stickers[sides[side]] ?? face;
      const fill = FACE_COLORS[colorIdx] ?? '#888';
      const d = `M${tris[side].map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(' L')} Z`;
      out.push(`<path d="${d}" fill="${fill}" stroke="#111" stroke-width="0.8" stroke-linejoin="round"/>`);
    }
    // face outline
    out.push(`<rect x="${fmt(ox)}" y="${fmt(oy)}" width="${CELL}" height="${CELL}" fill="none" stroke="#111" stroke-width="1.2"/>`);
  }

  out.push('</svg>');
  return out.join('');
}
