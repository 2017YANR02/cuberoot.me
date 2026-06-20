/**
 * 2×2×3 Tower (2×2×3) state preview SVG — a flat cuboid net whose colors come straight from a
 * full 32-sticker model driven by the same four moves the solver uses. Because every move is a
 * physical sticker permutation (validated U⁴=D⁴=R²=F²=identity) applied to an array seeded with
 * each sticker's home face color, the solved cube renders with every face uniform — a self-proving
 * net, no external color truth.
 *
 * Net layout (cell grid; U is 2×2 on top, the L/F/R/B side faces form a 2-wide × 3-tall band, the
 * middle row of which is the 1×2×2 middle layer, and D is 2×2 at the bottom):
 *     . . U U . . . .
 *     . . U U . . . .
 *     L L F F R R B B
 *     L L F F R R B B   ← middle layer row
 *     L L F F R R B B
 *     . . D D . . . .
 *     . . D D . . . .
 *
 * The sticker model + the four base-move permutations were generated from real 3D rotations of the
 * cstimer 2×2×3 geometry (U = −90° about +y on the top layer reproducing circle(0,1,2,3), D = +90°
 * about +y on the bottom layer, R2 = 180° about +x, F2 = 180° about +z reproducing the
 * circle(2,5)(3,6) / circle(0,5)(3,4) corner swaps). Scramble notation matches cstimer exactly
 * (U U2 U' D D2 D' R2 F2) — same parser as lib/cuboid223-solver.
 */

// face ids U R F B L D = 0..5
export const CUBOID223_DEFAULT_COLORS: string[] = [
  '#FFFFFF', // 0 U white
  '#EE0000', // 1 R red
  '#00B14F', // 2 F green
  '#1463E6', // 3 B blue
  '#FF8000', // 4 L orange
  '#FFD500', // 5 D yellow
];
const STROKE = '#000';
const S = 22; // cell size

// 32 stickers, each carrying its home face id and net (col,row). Generated from the 3D model.
const STICKER_FACE: ReadonlyArray<number> = [
  0, 4, 2, 0, 4, 3, 0, 1, 3, 0, 1, 2, 5, 4, 2, 5, 1, 2, 5, 1, 3, 5, 4, 3, 4, 2, 1, 2, 1, 3, 4, 3,
];
const STICKER_CELL: ReadonlyArray<readonly [number, number]> = [
  [2, 1], [1, 2], [2, 2], [2, 0], [0, 2], [7, 2], [3, 0], [5, 2], [6, 2], [3, 1], [4, 2], [3, 2],
  [2, 5], [1, 4], [2, 4], [3, 5], [4, 4], [3, 4], [3, 6], [5, 4], [6, 4], [2, 6], [0, 4], [7, 4],
  [1, 3], [2, 3], [4, 3], [3, 3], [5, 3], [6, 3], [0, 3], [7, 3],
];

// Base-move sticker permutations: PERM[i] = source index whose color moves into slot i (new = old∘perm).
const U_PERM: ReadonlyArray<number> = [9, 11, 10, 0, 2, 1, 3, 5, 4, 6, 8, 7, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
const D_PERM: ReadonlyArray<number> = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 21, 23, 22, 12, 14, 13, 15, 17, 16, 18, 20, 19, 24, 25, 26, 27, 28, 29, 30, 31];
const R_PERM: ReadonlyArray<number> = [0, 1, 2, 3, 4, 5, 15, 16, 17, 18, 19, 20, 12, 13, 14, 6, 7, 8, 9, 10, 11, 21, 22, 23, 24, 25, 28, 29, 26, 27, 30, 31];
const F_PERM: ReadonlyArray<number> = [15, 16, 17, 3, 4, 5, 6, 7, 8, 12, 13, 14, 9, 10, 11, 0, 1, 2, 18, 19, 20, 21, 22, 23, 26, 27, 24, 25, 28, 29, 30, 31];
const BASE_PERM = [U_PERM, D_PERM, R_PERM, F_PERM];

// 8 scramble move variants → (base index 0..3, power). Matches lib/cuboid223-solver MOVES order.
interface MoveDef { name: string; base: number; pow: number; }
const MOVES: ReadonlyArray<MoveDef> = [
  { name: 'U', base: 0, pow: 1 }, { name: 'U2', base: 0, pow: 2 }, { name: "U'", base: 0, pow: 3 },
  { name: 'D', base: 1, pow: 1 }, { name: 'D2', base: 1, pow: 2 }, { name: "D'", base: 1, pow: 3 },
  { name: 'R2', base: 2, pow: 1 }, { name: 'F2', base: 3, pow: 1 },
];
const MOVE_BY_NAME = new Map<string, MoveDef>(MOVES.map((m) => [m.name, m]));

function applyBase(colors: number[], base: number): number[] {
  const perm = BASE_PERM[base];
  return perm.map((src) => colors[src]);
}

function applyScramble(scramble: string): number[] {
  let colors = STICKER_FACE.slice();
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    const mv = MOVE_BY_NAME.get(tok);
    if (!mv) throw new Error(`bad: ${tok}`);
    for (let k = 0; k < mv.pow; k++) colors = applyBase(colors, mv.base);
  }
  return colors;
}

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }
function rect(col: number, row: number, fill: string): string {
  return `<rect x="${fmt(col * S)}" y="${fmt(row * S)}" width="${fmt(S)}" height="${fmt(S)}" fill="${fill}" stroke="${STROKE}" stroke-width="1"/>`;
}

export function renderCuboid223ScrambleSvg(scramble: string, colors: string[] = CUBOID223_DEFAULT_COLORS): string {
  let faceColors = STICKER_FACE.slice();
  try {
    faceColors = applyScramble(scramble);
  } catch (e) {
    console.warn('[cuboid223_svg] apply failed', scramble, e);
  }

  const cols = 8, rows = 7;
  const totalW = cols * S, totalH = rows * S;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
  ];
  for (let i = 0; i < STICKER_CELL.length; i++) {
    const [c, r] = STICKER_CELL[i];
    out.push(rect(c, r, colors[faceColors[i]] ?? colors[0]));
  }
  out.push('</svg>');
  return out.join('');
}
