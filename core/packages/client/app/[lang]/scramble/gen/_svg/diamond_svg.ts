/**
 * Diamond (dmd) state preview — a 2D unfolded octahedron net, derived entirely from the solver's exact
 * 32-int state (lib/diamond-solver). The Diamond is an OCTAHEDRON (8 triangular faces), NOT a cube, so a
 * WCA cube net doesn't fit; instead we draw the standard octahedron net = 8 triangles in two rows of 4
 * (top row up-pointing = faces 0..3, bottom row down-pointing = faces 4..7). Each big triangle is the
 * classic "triforce" subdivision into 4 small triangles (3 corners + 1 inverted center), one per the 4
 * sub-stickers of that face.
 *
 * Colors come straight from the state: sub-sticker slot `4*face + s` is colored by
 * DIAMOND_DEFAULT_COLORS.stickers[Math.floor(state[4*face+s]/4)] (the face/color the sticker currently
 * belongs to). At solved every face's 4 sub-stickers share that face's color, so each big triangle
 * renders as 4 same-colored small triangles = a self-proving render. Any scramble shuffles the
 * sub-stickers faithfully. Single source of move truth = diamondApply.
 */
import { diamondApply, DIAMOND_SOLVED } from '@/lib/diamond-solver';

// 8 sticker colors (vivid data colors), indexed by face 0..7 = U,R,L,F,D,Bl,Br,B.
export const DIAMOND_DEFAULT_COLORS = {
  stickers: ['#FFFFFF', '#EE0000', '#FF8800', '#00B14F', '#FFD500', '#1463E6', '#8338EC', '#06B6D4'] as const,
  edge: '#000',
  faceletStroke: '#000',
  bg: '#FFFFFF',
} as const;

const VIEW_W = 320;
const VIEW_H = 180;
const TRI = 76;            // big-triangle side length
const H = TRI * Math.sqrt(3) / 2; // big-triangle height
const X0 = (VIEW_W - 4 * (TRI / 2) - TRI / 2) / 2; // left margin so the 4-wide strip is centered
const TOP_Y = 14;          // top row top edge
const BOT_Y = TOP_Y + H + 8; // bottom row top edge (small gap between rows)

type Pt = [number, number];
function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }
function mid(a: Pt, b: Pt): Pt { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }

/**
 * The 3 outer vertices of big triangle `f`. Top row (f<4) points UP; bottom row points DOWN.
 * Returns [A, B, C] with A = the apex (the lone vertex), B/C = the base corners (left,right).
 */
function bigTriangle(f: number): [Pt, Pt, Pt] {
  const col = f % 4;
  if (f < 4) {
    // up-pointing: apex top-center, base along bottom
    const baseY = TOP_Y + H;
    const xL = X0 + col * (TRI / 2);
    const apex: Pt = [xL + TRI / 2, TOP_Y];
    const bL: Pt = [xL, baseY];
    const bR: Pt = [xL + TRI, baseY];
    return [apex, bL, bR];
  }
  // down-pointing: apex bottom-center, base along top
  const col2 = f - 4;
  const topY = BOT_Y;
  const xL = X0 + col2 * (TRI / 2);
  const apex: Pt = [xL + TRI / 2, topY + H];
  const bL: Pt = [xL, topY];
  const bR: Pt = [xL + TRI, topY];
  return [apex, bL, bR];
}

function poly(pts: Pt[], fill: string, stroke: string, sw: number): string {
  const d = pts.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(' ');
  return `<polygon points="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

/**
 * Render the 4 sub-stickers of face `f` as the triforce subdivision. Slot order:
 *   0 = corner at apex (A), 1 = corner at base-left (B), 2 = corner at base-right (C), 3 = center.
 */
function faceTriforce(f: number, state: ReadonlyArray<number>): string {
  const C = DIAMOND_DEFAULT_COLORS;
  const [A, B, Cc] = bigTriangle(f);
  const mAB = mid(A, B), mAC = mid(A, Cc), mBC = mid(B, Cc);
  const colorOf = (slot: number) => C.stickers[Math.floor(state[4 * f + slot] / 4)];
  const out: string[] = [];
  out.push(poly([A, mAB, mAC], colorOf(0), C.faceletStroke, 0.8));      // apex corner
  out.push(poly([mAB, B, mBC], colorOf(1), C.faceletStroke, 0.8));      // base-left corner
  out.push(poly([mAC, mBC, Cc], colorOf(2), C.faceletStroke, 0.8));     // base-right corner
  out.push(poly([mAB, mBC, mAC], colorOf(3), C.faceletStroke, 0.8));    // inverted center
  // big-triangle outline on top for crisp face boundaries
  out.push(poly([A, B, Cc], 'none', C.edge, 1.4));
  return out.join('');
}

export function renderDiamondScrambleSvg(scramble: string): string {
  let st: number[] = [...DIAMOND_SOLVED];
  try {
    st = diamondApply(scramble);
  } catch (e) {
    console.warn('[diamond_svg] apply failed', scramble, e);
  }
  const C = DIAMOND_DEFAULT_COLORS;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
    `<rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" fill="${C.bg}"/>`,
  ];
  for (let f = 0; f < 8; f++) out.push(faceTriforce(f, st));
  out.push('</svg>');
  return out.join('');
}
