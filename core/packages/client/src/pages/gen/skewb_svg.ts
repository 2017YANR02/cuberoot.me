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
 */
export const SKEWB_DEFAULT_COLORS: Record<string, string> = {
  // Tnoodle SkewbPuzzle.java defaultColorScheme
  U: '#FFFFFF',
  R: '#0000FF',
  F: '#FF0000',
  D: '#FFFF00',
  L: '#00FF00',
  B: '#FF8000',
};

const FACE_LABELS = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const PIECE_SIZE = 30;
const GAP = 3;
const SQ3D2 = Math.sqrt(3) / 2;
const STROKE_W = 1;             // svglite default stroke

/**
 * Skewb state — TNOODLE convention (matches tnoodle SkewbPuzzle.java exactly).
 * Used for ScramblePreview2D + tnoodle_pdf, since tnoodle is the WCA scrambler
 * and its printed scramble image must match the state that tnoodle simulates.
 *
 * Tnoodle's 4 named axis corners: R=DRF, U=URB, L=DLB, B=DRB.
 * (Differs from WCA Regulations #12h reading — for that, see SkewbStateWCA in
 * skewb_pyramid_svg.ts which the visualcube top view uses.)
 */
export class SkewbState {
  // image[face][sticker], face 0..5 = U R F D L B; sticker 0..4 (0=center, 1..4=corners)
  image: number[][] = Array.from({ length: 6 }, (_, i) => Array(5).fill(i));

  private static swap3(arr: number[][], f1: number, s1: number, f2: number, s2: number, f3: number, s3: number) {
    const t = arr[f1][s1];
    arr[f1][s1] = arr[f2][s2];
    arr[f2][s2] = arr[f3][s3];
    arr[f3][s3] = t;
  }

  /** Tnoodle SkewbState.turn — axes 0=R, 1=U, 2=L, 3=B. */
  private turnOnce(axis: number) {
    const im = this.image;
    switch (axis) {
      case 0: // R
        SkewbState.swap3(im, 2, 0, 3, 0, 1, 0);
        SkewbState.swap3(im, 2, 4, 3, 2, 1, 3);
        SkewbState.swap3(im, 2, 2, 3, 1, 1, 4);
        SkewbState.swap3(im, 2, 3, 3, 4, 1, 1);
        SkewbState.swap3(im, 4, 4, 5, 3, 0, 4);
        break;
      case 1: // U
        SkewbState.swap3(im, 0, 0, 1, 0, 5, 0);
        SkewbState.swap3(im, 0, 2, 1, 2, 5, 1);
        SkewbState.swap3(im, 0, 4, 1, 4, 5, 2);
        SkewbState.swap3(im, 0, 1, 1, 1, 5, 3);
        SkewbState.swap3(im, 4, 1, 2, 2, 3, 4);
        break;
      case 2: // L
        SkewbState.swap3(im, 4, 0, 5, 0, 3, 0);
        SkewbState.swap3(im, 4, 3, 5, 4, 3, 3);
        SkewbState.swap3(im, 4, 1, 5, 3, 3, 1);
        SkewbState.swap3(im, 4, 4, 5, 2, 3, 4);
        SkewbState.swap3(im, 2, 3, 0, 1, 1, 4);
        break;
      case 3: // B
        SkewbState.swap3(im, 1, 0, 3, 0, 5, 0);
        SkewbState.swap3(im, 1, 4, 3, 4, 5, 3);
        SkewbState.swap3(im, 1, 3, 3, 3, 5, 1);
        SkewbState.swap3(im, 1, 2, 3, 2, 5, 4);
        SkewbState.swap3(im, 0, 2, 2, 4, 4, 3);
        break;
    }
  }

  applyMove(token: string) {
    if (!token) return;
    const m = /^([RULBrulb])(['2]?)$/.exec(token.trim());
    if (!m) return;
    const ch = m[1].toUpperCase();
    const dir = m[2] === "'" ? 2 : 1;     // ' = inverse = 2 powers of order-3 turn
    const axis = 'RULB'.indexOf(ch);
    if (axis < 0) return;
    for (let i = 0; i < dir; i++) this.turnOnce(axis);
  }

  applyAlgorithm(scramble: string) {
    for (const tok of scramble.split(/\s+/).filter(Boolean)) this.applyMove(tok);
  }
}

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

/** Render a skewb scramble preview SVG (transparent background). */
export function renderSkewbScrambleSvg(scramble: string, colors: Record<string, string> = SKEWB_DEFAULT_COLORS): string {
  const state = new SkewbState();
  try { state.applyAlgorithm(scramble); } catch (e) {
    console.warn('[skewb_svg] applyAlgorithm failed', scramble, e);
  }

  const scheme: string[] = FACE_LABELS.map((f) => colors[f] ?? SKEWB_DEFAULT_COLORS[f]);

  const w = Math.ceil((3 * GAP + 8 * PIECE_SIZE + 1) * SQ3D2);
  const h = Math.ceil(2 * GAP + 6 * PIECE_SIZE + 1);
  const trans = faceTransforms();

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">`);

  for (let face = 0; face < 6; face++) {
    const t = trans[face];
    const stickers = state.image[face];
    for (let i = 0; i < 5; i++) {
      const colorIdx = stickers[i] ?? 0;
      const fill = scheme[colorIdx] ?? '#888';
      const pts = STICKER_PATHS[i].map(([x, y]) => tx(t, x, y));
      const d = `M${pts.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(' L')} Z`;
      out.push(`<path d="${d}" fill="${fill}" stroke="#000" stroke-width="${STROKE_W}" stroke-linejoin="round"/>`);
    }
  }
  out.push('</svg>');
  return out.join('');
}
