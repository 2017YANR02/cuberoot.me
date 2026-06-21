/**
 * 2×3×3 Domino (233) state preview SVG — a flat cuboid net whose colors come straight from a full
 * 42-sticker model driven by the same five base moves the solver uses (U, R2, L2, F2, B2). Because
 * every move is a physical sticker permutation (validated U⁴ = R2² = L2² = F2² = B2² = identity)
 * applied to an array seeded with each sticker's home-face color, the solved cube renders with every
 * face uniform — a self-proving net, no external color truth.
 *
 * Net layout (cell grid; U is the 3×3 on top, the L/F/R/B side faces form a 2-row band, D is the
 * 3×3 at the bottom):
 *       . . . U U U . . . . . .
 *       . . . U U U . . . . . .
 *       . . . U U U . . . . . .
 *       L L L F F F R R R B B B   ← side band, top row
 *       L L L F F F R R R B B B   ← side band, bottom row
 *       . . . D D D . . . . . .
 *       . . . D D D . . . . . .
 *       . . . D D D . . . . . .
 *
 * The sticker model + the five base-move permutations were generated from real 3D rotations of the
 * cstimer 2×3×3 geometry (U = +90° about +y on the top layer; R2/L2 = 180° about ±x on the right/left
 * slabs; F2/B2 = 180° about ±z on the front/back slabs). Scramble notation matches cstimer exactly
 * (U U' U2 R2 L2 F2 B2) — same parser semantics as lib/cuboid233-solver.
 */

// face ids U D F B R L = 0..5
export const CUBOID233_DEFAULT_COLORS: string[] = [
  '#FFFFFF', // 0 U white
  '#FFD500', // 1 D yellow
  '#00B14F', // 2 F green
  '#1463E6', // 3 B blue
  '#EE0000', // 4 R red
  '#FF8000', // 5 L orange
];
const STROKE = '#000';
const S = 18; // cell size

// 42 stickers, each carrying its home face id and net (col,row). Generated from the 3D model.
const STICKER_FACE: ReadonlyArray<number> = [
  1, 5, 3, 1, 5, 1, 5, 2, 0, 5, 3, 0, 5, 0, 5, 2, 1, 3, 1, 1, 2, 0, 3, 0, 0, 2, 1, 4, 3, 1, 4, 1, 4, 2, 0, 4, 3, 0, 4, 0, 4, 2,
];
const STICKER_CELL: ReadonlyArray<readonly [number, number]> = [
  [3, 7], [0, 4], [9, 4], [3, 6], [1, 4], [3, 5], [2, 4], [3, 4], [3, 0], [0, 3], [9, 3], [3, 1], [1, 3], [3, 2], [2, 3], [3, 3],
  [4, 7], [10, 4], [4, 6], [4, 5], [4, 4], [4, 0], [10, 3], [4, 1], [4, 2], [4, 3], [5, 7], [8, 4], [11, 4], [5, 6], [7, 4],
  [5, 5], [6, 4], [5, 4], [5, 0], [8, 3], [11, 3], [5, 1], [7, 3], [5, 2], [6, 3], [5, 3],
];

// Base-move sticker permutations: PERM[i] = source index whose color moves into slot i (new = old∘perm).
const U_PERM: ReadonlyArray<number> = [0, 1, 2, 3, 4, 5, 6, 7, 34, 36, 35, 21, 22, 8, 10, 9, 16, 17, 18, 19, 20, 37, 38, 23, 11, 12, 26, 27, 28, 29, 30, 31, 32, 33, 39, 41, 40, 24, 25, 13, 15, 14];
const R2_PERM: ReadonlyArray<number> = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 39, 40, 41, 37, 38, 34, 35, 36, 31, 32, 33, 29, 30, 26, 27, 28];
const L2_PERM: ReadonlyArray<number> = [13, 14, 15, 11, 12, 8, 9, 10, 5, 6, 7, 3, 4, 0, 1, 2, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41];
const F2_PERM: ReadonlyArray<number> = [0, 1, 2, 3, 4, 39, 40, 41, 8, 9, 10, 11, 12, 31, 32, 33, 16, 17, 18, 24, 25, 21, 22, 23, 19, 20, 26, 27, 28, 29, 30, 13, 14, 15, 34, 35, 36, 37, 38, 5, 6, 7];
const B2_PERM: ReadonlyArray<number> = [34, 35, 36, 3, 4, 5, 6, 7, 26, 27, 28, 11, 12, 13, 14, 15, 21, 22, 18, 19, 20, 16, 17, 23, 24, 25, 8, 9, 10, 29, 30, 31, 32, 33, 0, 1, 2, 37, 38, 39, 40, 41];
const BASE_PERM = [U_PERM, R2_PERM, L2_PERM, F2_PERM, B2_PERM];

// 7 scramble move variants → (base index 0..4, power). Matches lib/cuboid233-solver MOVES order.
interface MoveDef { name: string; base: number; pow: number; }
const MOVES: ReadonlyArray<MoveDef> = [
  { name: 'U', base: 0, pow: 1 }, { name: "U'", base: 0, pow: 3 }, { name: 'U2', base: 0, pow: 2 },
  { name: 'R2', base: 1, pow: 1 }, { name: 'L2', base: 2, pow: 1 }, { name: 'F2', base: 3, pow: 1 }, { name: 'B2', base: 4, pow: 1 },
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

export function renderCuboid233ScrambleSvg(scramble: string, colors: string[] = CUBOID233_DEFAULT_COLORS): string {
  let faceColors = STICKER_FACE.slice();
  try {
    faceColors = applyScramble(scramble);
  } catch (e) {
    console.warn('[cuboid233_svg] apply failed', scramble, e);
  }

  const cols = 12, rows = 8;
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
