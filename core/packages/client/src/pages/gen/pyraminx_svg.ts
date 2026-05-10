/**
 * Pyraminx state model + scramble preview SVG, ported from
 * D:\cube\tnoodle-lib\scrambles\src\main\java\org\worldcubeassociation\tnoodle\puzzle\PyraminxPuzzle.java
 *
 * Pure string SVG output (no DOM, no async); identical layout to TNoodle's
 * `drawScramble` so the PDF preview matches an official tnoodle sheet.
 *
 * Sticker layout (per face, 9 stickers):
 *
 *           0
 *         /\
 *        /1 \
 *       /----\
 *      / 2 |8 \
 *     /----+----\
 *    /3|4| 5|6|7 \
 *   /----+----+----\
 *
 * Move semantics (uppercase = full face turn + tip; lowercase = tip-only):
 *   U / L / R / B  → axes 0..3, each a 120° rotation of the matching tip side.
 */
export const PYRA_DEFAULT_COLORS: Record<string, string> = {
  // Tnoodle PyraminxPuzzle.java defaultColorScheme
  F: '#00FF00',  // green
  D: '#FFFF00',  // yellow
  L: '#FF0000',  // red
  R: '#0000FF',  // blue
};

const FACE_LABELS = ['F', 'D', 'L', 'R'] as const;

const PIECE_SIZE = 30;          // tnoodle pieceSize
const GAP = 5;                  // tnoodle gap
const SQRT3 = Math.sqrt(3);
const STROKE_W = 1;             // svglite default

class PyraminxState {
  // image[face][sticker] = color index (0..3) where index → FACE_LABELS[index]
  image: number[][];

  constructor() {
    this.image = Array.from({ length: 4 }, (_, i) => Array(9).fill(i));
  }

  private static swap3(arr: number[][], f1: number, s1: number, f2: number, s2: number, f3: number, s3: number) {
    const t = arr[f1][s1];
    arr[f1][s1] = arr[f2][s2];
    arr[f2][s2] = arr[f3][s3];
    arr[f3][s3] = t;
  }

  /** Tnoodle PyraminxState.turn(s, image) — 120° body turn around tip `s`. */
  private turnBody(s: number) {
    const im = this.image;
    switch (s) {
      case 0: // U
        PyraminxState.swap3(im, 0, 8, 3, 8, 2, 2);
        PyraminxState.swap3(im, 0, 1, 3, 1, 2, 4);
        PyraminxState.swap3(im, 0, 2, 3, 2, 2, 5);
        break;
      case 1: // L
        PyraminxState.swap3(im, 2, 8, 1, 2, 0, 8);
        PyraminxState.swap3(im, 2, 7, 1, 1, 0, 7);
        PyraminxState.swap3(im, 2, 5, 1, 8, 0, 5);
        break;
      case 2: // R
        PyraminxState.swap3(im, 3, 8, 0, 5, 1, 5);
        PyraminxState.swap3(im, 3, 7, 0, 4, 1, 4);
        PyraminxState.swap3(im, 3, 5, 0, 2, 1, 2);
        break;
      case 3: // B
        PyraminxState.swap3(im, 1, 8, 2, 2, 3, 5);
        PyraminxState.swap3(im, 1, 7, 2, 1, 3, 4);
        PyraminxState.swap3(im, 1, 5, 2, 8, 3, 2);
        break;
    }
    this.turnTipOnly(s);
  }

  private turnTipOnly(s: number) {
    const im = this.image;
    switch (s) {
      case 0: PyraminxState.swap3(im, 0, 0, 3, 0, 2, 3); break;
      case 1: PyraminxState.swap3(im, 0, 6, 2, 6, 1, 0); break;
      case 2: PyraminxState.swap3(im, 0, 3, 1, 3, 3, 6); break;
      case 3: PyraminxState.swap3(im, 1, 6, 2, 0, 3, 3); break;
    }
  }

  applyMove(token: string) {
    if (!token) return;
    const m = /^([ulrbULRB])(['2]?)$/.exec(token.trim());
    if (!m) return;
    const ch = m[1];
    const dir = m[2] === "'" ? 2 : 1;   // ' = inverse = 2 turns; double = also 2; default = 1
    const isTip = ch === ch.toLowerCase();
    const axis = 'ulrb'.indexOf(ch.toLowerCase());
    if (axis < 0) return;
    for (let i = 0; i < dir; i++) {
      if (isTip) this.turnTipOnly(axis);
      else this.turnBody(axis);
    }
  }

  applyAlgorithm(scramble: string) {
    for (const tok of scramble.split(/\s+/).filter(Boolean)) this.applyMove(tok);
  }
}

// ─── Geometry helpers (mirror tnoodle's `triangle()` + `drawTriangle()`) ──

interface Triangle {
  vx: [number, number, number];
  vy: [number, number, number];
}

/** Equilateral triangle with circumradius √3·pieceSize, centered at origin. */
function makeTriangle(pointUp: boolean, pieceSize: number): Triangle {
  const rad = SQRT3 * pieceSize;
  const baseAngs = [7 / 6, 11 / 6, 1 / 2];
  const vx: [number, number, number] = [0, 0, 0];
  const vy: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const a = (baseAngs[i] + (pointUp ? 1 / 3 : 0)) * Math.PI;
    vx[i] = rad * Math.cos(a);
    vy[i] = rad * Math.sin(a);
  }
  return { vx, vy };
}

interface Pt { x: number; y: number; }

function intersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt {
  const det = (a: number, b: number, c: number, d: number) => a * d - b * c;
  const d1 = det(p1.x, p1.y, p2.x, p2.y);
  const d2 = det(p3.x, p3.y, p4.x, p4.y);
  const denom = det(p1.x - p2.x, p1.y - p2.y, p3.x - p4.x, p3.y - p4.y);
  return {
    x: det(d1, p1.x - p2.x, d2, p3.x - p4.x) / denom,
    y: det(d1, p1.y - p2.y, d2, p3.y - p4.y) / denom,
  };
}

function drawTriangle(out: string[], cx: number, cy: number, pointUp: boolean, faceState: number[], pieceSize: number, scheme: string[]): void {
  const tri = makeTriangle(pointUp, pieceSize);
  const xpoints = [tri.vx[0] + cx, tri.vx[1] + cx, tri.vx[2] + cx];
  const ypoints = [tri.vy[0] + cy, tri.vy[1] + cy, tri.vy[2] + cy];

  // 1/3, 2/3 split points along each edge (i → (i+1)%3)
  const xs = new Array<number>(6);
  const ys = new Array<number>(6);
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    xs[i]     = (1 / 3) * xpoints[j] + (2 / 3) * xpoints[i];
    ys[i]     = (1 / 3) * ypoints[j] + (2 / 3) * ypoints[i];
    xs[i + 3] = (2 / 3) * xpoints[j] + (1 / 3) * xpoints[i];
    ys[i + 3] = (2 / 3) * ypoints[j] + (1 / 3) * ypoints[i];
  }

  const center = intersect(
    { x: xs[0], y: ys[0] }, { x: xs[4], y: ys[4] },
    { x: xs[2], y: ys[2] }, { x: xs[3], y: ys[3] },
  );

  // 9 sub-triangles (mirrors tnoodle's drawTriangle ps[0..8] construction).
  const polys: Array<[number, number][]> = [];
  for (let i = 0; i < 3; i++) {
    // ps[3i]:  corner triangle at vertex i
    polys.push([
      [xpoints[i], ypoints[i]],
      [xs[i], ys[i]],
      [xs[3 + ((i + 2) % 3)], ys[3 + ((i + 2) % 3)]],
    ]);
    // ps[3i+1]: inner triangle xs[i] → xs[3+(i+2)%3] → center
    polys.push([
      [xs[i], ys[i]],
      [xs[3 + ((i + 2) % 3)], ys[3 + ((i + 2) % 3)]],
      [center.x, center.y],
    ]);
    // ps[3i+2]: inner triangle xs[i] → xs[i+3] → center
    polys.push([
      [xs[i], ys[i]],
      [xs[i + 3], ys[i + 3]],
      [center.x, center.y],
    ]);
  }

  for (let i = 0; i < polys.length; i++) {
    const colorIdx = faceState[i] ?? 0;
    const fill = scheme[colorIdx] ?? '#888';
    const d = `M${polys[i].map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(' L')} Z`;
    out.push(`<path d="${d}" fill="${fill}" stroke="#000" stroke-width="${STROKE_W}" stroke-linejoin="round"/>`);
  }
}

function fmt(n: number): string {
  // 3 decimal places; trim trailing zeros.
  return Number(n.toFixed(3)).toString();
}

/** Render a pyraminx scramble preview SVG (transparent background). */
export function renderPyraScrambleSvg(scramble: string, colors: Record<string, string> = PYRA_DEFAULT_COLORS): string {
  const state = new PyraminxState();
  try { state.applyAlgorithm(scramble); } catch (e) {
    console.warn('[pyraminx_svg] applyAlgorithm failed', scramble, e);
  }

  const scheme: string[] = FACE_LABELS.map((f) => colors[f] ?? PYRA_DEFAULT_COLORS[f]);

  // Tnoodle preferredSize: width = 6*pieceSize + 4*gap; height = 3*sqrt(3)*pieceSize + 3*gap
  const w = 6 * PIECE_SIZE + 4 * GAP;
  const h = 3 * SQRT3 * PIECE_SIZE + 3 * GAP;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(w)} ${fmt(h)}">`);
  // Tnoodle drawMinx face origins (centroids of each unfolded triangle)
  // F (face 0): top-center, point-up
  drawTriangle(out, 2 * GAP + 3 * PIECE_SIZE, GAP + SQRT3 * PIECE_SIZE,         true,  state.image[0], PIECE_SIZE, scheme);
  // D (face 1): bottom-center, point-down
  drawTriangle(out, 2 * GAP + 3 * PIECE_SIZE, 2 * GAP + 2 * SQRT3 * PIECE_SIZE, false, state.image[1], PIECE_SIZE, scheme);
  // L (face 2): upper-left, point-down
  drawTriangle(out, GAP + 1.5 * PIECE_SIZE,    GAP + 0.5 * SQRT3 * PIECE_SIZE,  false, state.image[2], PIECE_SIZE, scheme);
  // R (face 3): upper-right, point-down
  drawTriangle(out, 3 * GAP + 4.5 * PIECE_SIZE, GAP + 0.5 * SQRT3 * PIECE_SIZE, false, state.image[3], PIECE_SIZE, scheme);
  out.push('</svg>');
  return out.join('');
}
