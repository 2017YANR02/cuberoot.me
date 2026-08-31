/**
 * Skewb state model + scramble preview SVG, ported from
 * D:\cube\tnoodle-lib\scrambles\src\main\java\org\worldcubeassociation\tnoodle\puzzle\SkewbPuzzle.java
 *
 * 6 faces (URFDLB) × 5 stickers (1 center diamond + 4 outer triangles).
 * Layout (unfold):
 *
 *           +---+
 *           | U |
 *   +---+---+---+---+
 *   | L | F | R | B |
 *   +---+---+---+---+
 *           | D |
 *           +---+
 *
 * The 6 face transforms in `getFaceTrans()` skew the unit square (-1..1) into
 * each face's hexagonal projection in the net.
 *
 * State values are STICKER IDS (`face * 5 + slot`); the color index is `id / 5`
 * (origin face). Same permutation as the old color-index model, but the id also
 * carries piece identity so `mask` travels with the piece.
 */
import type { MaskRenderOptions, StickerId } from '@/lib/puzzle-image/mask-core';
import { SkewbState } from '@cuberoot/puzzle-solvers/skewb';

export { SkewbState } from '@cuberoot/puzzle-solvers/skewb';

export const SKEWB_DEFAULT_COLORS: Record<string, string> = {
  // Tnoodle SkewbPuzzle.java defaultColorScheme
  U: '#FFFFFF',
  R: '#0000FF',
  F: '#FF0000',
  D: '#FFFF00',
  L: '#00FF00',
  B: '#FF8000',
};

export const SKEWB_FACE_LABELS = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const FACE_LABELS = SKEWB_FACE_LABELS;
export const SKEWB_STICKERS_PER_FACE = 5;

/** Sticker id (`U0`..`B4`) for a state value / canonical `face * 5 + slot`. */
export function skewbStickerId(v: number): StickerId {
  return `${FACE_LABELS[Math.floor(v / 5)]}${v % 5}`;
}

const PIECE_SIZE = 30;
const GAP = 3;
const SQ3D2 = Math.sqrt(3) / 2;
const STROKE_W = 1;             // svglite default stroke

// ─── Geometry: 6 face affine transforms (mirror tnoodle's getFaceTrans) ─

interface XForm { a: number; b: number; c: number; d: number; e: number; f: number; }

function faceTransforms(): XForm[] {
  const p = PIECE_SIZE;
  const g = GAP;
  return [
    // 0 = U
    { a: p * SQ3D2, b: -p / 2, c: p * SQ3D2, d: p / 2, e: (p * 4 + g * 1.5) * SQ3D2, f: p },
    // 1 = R
    { a: p * SQ3D2, b: -p / 2, c: 0,         d: p,     e: (p * 7 + g * 3) * SQ3D2,   f: p * 1.5 },
    // 2 = F
    { a: p * SQ3D2, b: -p / 2, c: 0,         d: p,     e: (p * 5 + g * 2) * SQ3D2,   f: p * 2.5 + 0.5 * g },
    // 3 = D
    { a: 0,         b: p,      c: -p * SQ3D2, d: -p / 2, e: (p * 3 + g) * SQ3D2,     f: p * 4.5 + 1.5 * g },
    // 4 = L
    { a: p * SQ3D2, b: p / 2,  c: 0,         d: p,     e: (p * 3 + g) * SQ3D2,       f: p * 2.5 + 0.5 * g },
    // 5 = B
    { a: p * SQ3D2, b: p / 2,  c: 0,         d: p,     e: p * SQ3D2,                 f: p * 1.5 },
  ];
}

/** Apply tnoodle-style 6-component affine transform. */
function tx(t: XForm, x: number, y: number): [number, number] {
  return [t.a * x + t.c * y + t.e, t.b * x + t.d * y + t.f];
}

/** 5 sticker outlines on a face, in the -1..1 unit square coordinate system. */
const STICKER_PATHS: Array<Array<[number, number]>> = [
  [[-1, 0], [0, 1], [1, 0], [0, -1]],         // 0 = center diamond
  [[-1, 0], [-1, -1], [0, -1]],               // 1 = top-left triangle
  [[0, -1], [1, -1], [1, 0]],                 // 2 = top-right triangle
  [[-1, 0], [-1, 1], [0, 1]],                 // 3 = bottom-left triangle
  [[0, 1], [1, 1], [1, 0]],                   // 4 = bottom-right triangle
];

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

export interface SkewbNetCell {
  face: number;
  slot: number;
  /** `face * 5 + slot` —— 与 lib/skewb-solver 的 facelet 下标同一套。 */
  index: number;
  points: Array<[number, number]>;
}

export interface SkewbNetGeometry {
  width: number;
  height: number;
  cells: SkewbNetCell[];
}

/**
 * 展开图的 30 块多边形(净几何,不含颜色)。预览图与交互画板(`_InteractiveSkewbNet`)共用
 * 这一份 —— 画板要给每块挂点击事件,所以不能只有拼好的 SVG 字符串。
 */
export function skewbNetGeometry(): SkewbNetGeometry {
  const trans = faceTransforms();
  const cells: SkewbNetCell[] = [];
  for (let face = 0; face < 6; face++) {
    for (let slot = 0; slot < SKEWB_STICKERS_PER_FACE; slot++) {
      cells.push({
        face,
        slot,
        index: face * SKEWB_STICKERS_PER_FACE + slot,
        points: STICKER_PATHS[slot].map(([x, y]) => tx(trans[face], x, y)),
      });
    }
  }
  return {
    width: Math.ceil((3 * GAP + 8 * PIECE_SIZE + 1) * SQ3D2),
    height: Math.ceil(2 * GAP + 6 * PIECE_SIZE + 1),
    cells,
  };
}

/** Render a skewb scramble preview SVG (transparent background). */
export function renderSkewbScrambleSvg(
  scramble: string,
  colors: Record<string, string> = SKEWB_DEFAULT_COLORS,
  opts?: MaskRenderOptions,
): string {
  const state = new SkewbState();
  try { state.applyAlgorithm(scramble); } catch (e) {
    console.warn('[skewb_svg] applyAlgorithm failed', scramble, e);
  }

  const scheme: string[] = FACE_LABELS.map((f) => colors[f] ?? SKEWB_DEFAULT_COLORS[f]);

  const { width: w, height: h, cells } = skewbNetGeometry();

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`);

  for (const cell of cells) {
    const id = state.image[cell.face][cell.slot] ?? 0;
    const masked = opts?.mask?.ids.has(skewbStickerId(id)) ?? false;
    const fill = masked ? opts!.mask!.color : (scheme[Math.floor(id / 5)] ?? '#888');
    const sid = opts?.stickerIds ? ` data-sid="${FACE_LABELS[cell.face]}${cell.slot}"` : '';
    const d = `M${cell.points.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(' L')} Z`;
    out.push(`<path d="${d}" fill="${fill}"${sid} stroke="#000" stroke-width="${STROKE_W}" stroke-linejoin="round"/>`);
  }
  out.push('</svg>');
  return out.join('');
}
