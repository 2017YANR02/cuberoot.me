/**
 * 3x3x6 cuboid (336) state preview SVG — a flat net whose colors come straight from the solver's own
 * 90-facelet model (lib/cuboid336-solver `cuboid336Apply`), so move semantics have a single source of truth
 * and the solved cube renders with every face uniform (a self-proving net, no external color table). The two
 * square caps (U/D, 3x3) sit above/below the front; the four tall side faces (L F R B, each 3 wide x 6 tall)
 * form a horizontal band — the genuine 3x3x6 shape (non-square sides).
 *
 *  Net (cell grid, 12 cols x 12 rows):
 *        . . . U U U . . . . . .        rows 0-2  (U cap, 3x3, over F)
 *        L L L F F F R R R B B B        row 3   (y=5, top band row)
 *        L L L F F F R R R B B B        row 4   (y=4)
 *        L L L F F F R R R B B B        row 5   (y=3)
 *        L L L F F F R R R B B B        row 6   (y=2)
 *        L L L F F F R R R B B B        row 7   (y=1)
 *        L L L F F F R R R B B B        row 8   (y=0, bottom band row)
 *        . . . D D D . . . . . .        rows 9-11  (D cap, 3x3, under F)
 *
 * Colors: U white, D yellow, F green, B blue, R red, L orange. Notation matches cstimer 336 exactly
 * (U U' U2 u u' u2 3u 3u' 3u2 R2 L2 M2 F2 B2 S2) — same parser as lib/cuboid336-solver.
 */
import { cuboid336Apply } from '@/lib/cuboid336-solver';

// face codes U D R L F B = 0..5 (same order as the solver's FACE_CODE)
export const CUBOID336_DEFAULT_COLORS: string[] = [
  '#FFFFFF', // 0 U white
  '#FFD500', // 1 D yellow
  '#EE0000', // 2 R red
  '#FF8000', // 3 L orange
  '#00B14F', // 4 F green
  '#1463E6', // 5 B blue
];
const STROKE = '#000';
const S = 18; // cell size

// Net cell (col,row) for each of the 90 facelets, in the solver's sticker enumeration order.
// Generated from the 3D geometry (one sticker per surface facelet); verified collision-free.
const STICKER_CELL: ReadonlyArray<readonly [number, number]> = [
  [3, 9], [0, 8], [3, 8], [3, 10], [1, 8], [3, 11], [2, 8], [11, 8], [0, 7], [3, 7], [1, 7], [2, 7], [11, 7],
  [0, 6], [3, 6], [1, 6], [2, 6], [11, 6], [0, 5], [3, 5], [1, 5], [2, 5], [11, 5], [0, 4], [3, 4], [1, 4],
  [2, 4], [11, 4], [3, 2], [0, 3], [3, 3], [3, 1], [1, 3], [3, 0], [2, 3], [11, 3], [4, 9], [4, 8], [4, 10],
  [4, 11], [10, 8], [4, 7], [10, 7], [4, 6], [10, 6], [4, 5], [10, 5], [4, 4], [10, 4], [4, 2], [4, 3], [4, 1],
  [4, 0], [10, 3], [5, 9], [8, 8], [5, 8], [5, 10], [7, 8], [5, 11], [6, 8], [9, 8], [8, 7], [5, 7], [7, 7],
  [6, 7], [9, 7], [8, 6], [5, 6], [7, 6], [6, 6], [9, 6], [8, 5], [5, 5], [7, 5], [6, 5], [9, 5], [8, 4],
  [5, 4], [7, 4], [6, 4], [9, 4], [5, 2], [8, 3], [5, 3], [5, 1], [7, 3], [5, 0], [6, 3], [9, 3],
];

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }
function rect(col: number, row: number, fill: string): string {
  return `<rect x="${fmt(col * S)}" y="${fmt(row * S)}" width="${fmt(S)}" height="${fmt(S)}" fill="${fill}" stroke="${STROKE}" stroke-width="1"/>`;
}

export function renderCuboid336ScrambleSvg(scramble: string, colors: string[] = CUBOID336_DEFAULT_COLORS): string {
  let faceCodes: Uint8Array;
  try {
    faceCodes = cuboid336Apply(scramble);
  } catch (e) {
    console.warn('[cuboid336_svg] apply failed', scramble, e);
    // fall back to solved colors so a bad token still renders something sane
    const solved = new Uint8Array(STICKER_CELL.length);
    faceCodes = solved.map(() => 0); // will be overwritten below if apply worked
    try { faceCodes = cuboid336Apply(''); } catch { /* ignore */ }
  }

  const cols = 12, rows = 12;
  const totalW = cols * S, totalH = rows * S;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
  ];
  for (let i = 0; i < STICKER_CELL.length; i++) {
    const [c, r] = STICKER_CELL[i];
    out.push(rect(c, r, colors[faceCodes[i]] ?? colors[0]));
  }
  out.push('</svg>');
  return out.join('');
}
