/**
 * Curvy Copter (helicv) state preview — a 2D cube net (6 faces in a cross), colored entirely from the
 * solver's exact piece-state (lib/helicv-solver `helicvFaceletColors`). Unlike the Helicopter Cube,
 * the curvy cuts give each face 12 facelets: 4 CORNER triangles (at the face corners), 4 EDGE "petals"
 * (the curvy-copter pieces, hugging each face edge), and 4 inner FACE pieces forming a central pinwheel.
 * Every facelet is placed at its true (u,v) position derived from the puzzle geometry
 * (lib/helicv-solver HELICV_*_FACELETS + HELICV_UV-equivalent layout).
 *
 * Colors come straight from the state: at solved every facelet shows its own face color, so each face
 * renders a SINGLE solid color — a self-proving render. Any scramble recolors faithfully; single source
 * of move truth = helicvApply (via helicvFaceletColors).
 */
import { helicvFaceletColors, HELICV_FACE_OF } from '@/lib/helicv-solver';

// 6 sticker colors indexed by face 0..5 = U R F D L B (standard cube: U white, R red, F green, D yellow,
// L orange, B blue).
export const HELICV_DEFAULT_COLORS = {
  stickers: ['#FFFFFF', '#EE0000', '#00B14F', '#FFD500', '#FF8800', '#1463E6'] as const,
  stroke: '#000',
  bg: '#FFFFFF',
} as const;

// Net layout: face cross positions (col,row) in face-units, classic unfolded cube.
//        U
//      L F R B
//        D
const FACE_POS: Record<number, [number, number]> = {
  0: [1, 0], // U
  4: [0, 1], // L
  2: [1, 1], // F
  1: [2, 1], // R
  5: [3, 1], // B
  3: [1, 2], // D
};

// Per-facelet (u,v) within its face plane, u,v ∈ [-1,1]. Derived from poly3dlib geometry: corners at
// ≈±0.735, edges on an axis at ≈±0.754 (the petals), face pieces at ≈±0.384 (the inner pinwheel). Order
// matches the 72 facelet ids (12 per face, faces 0..5). Generated once from makePuzzle, then frozen.
const FACELET_UV: ReadonlyArray<[number, number]> = [
  [-0.735, -0.735], [-0.735, 0.735], [0.735, -0.735], [0.735, 0.735], [-0.754, 0], [0.754, 0], [0, -0.754], [0, 0.754], [0.384, -0.384], [0.384, 0.384], [-0.384, 0.384], [-0.384, -0.384],
  [0.735, -0.735], [0.735, 0.735], [0.384, -0.384], [-0.735, -0.735], [0.384, 0.384], [-0.735, 0.735], [0.754, 0], [-0.754, 0], [0, -0.754], [0, 0.754], [-0.384, 0.384], [-0.384, -0.384],
  [-0.735, 0.735], [0.735, 0.735], [0.735, -0.735], [0.384, 0.384], [-0.735, -0.735], [-0.384, 0.384], [0.384, -0.384], [0, -0.754], [0, 0.754], [-0.754, 0], [0.754, 0], [-0.384, -0.384],
  [0.735, -0.735], [0.735, 0.735], [0.384, 0.384], [-0.735, 0.735], [-0.384, 0.384], [0.384, -0.384], [-0.735, -0.735], [0.754, 0], [-0.754, 0], [0, 0.754], [0, -0.754], [-0.384, -0.384],
  [0.735, -0.735], [0.735, 0.735], [-0.735, 0.735], [0.384, 0.384], [-0.735, -0.735], [0.384, -0.384], [-0.384, 0.384], [-0.384, -0.384], [0, 0.754], [0, -0.754], [0.754, 0], [-0.754, 0],
  [-0.735, 0.735], [0.735, -0.735], [0.735, 0.735], [0.384, 0.384], [-0.735, -0.735], [-0.384, 0.384], [0.384, -0.384], [-0.754, 0], [0.754, 0], [-0.384, -0.384], [0, 0.754], [0, -0.754],
];

const FACE = 100;          // face square size in px
const GAP = 6;             // gap between faces
const VIEW_W = FACE * 4 + GAP * 5;
const VIEW_H = FACE * 3 + GAP * 4;

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }

// Map a facelet to its polygon by its (u,v): |u|,|v|≈0.735 → corner triangle; one axis ≈0.754 (other 0)
// → edge petal (a kite from the edge midpoint toward center); else (≈0.384) → inner face-piece triangle
// (one quadrant of the central pinwheel, center → edge midpoint → corner-ward).
function faceletPolygon(ox: number, oy: number, fl: number): string {
  const [u, v] = FACELET_UV[fl];
  const half = FACE / 2;
  const cx = ox + half, cy = oy + half;
  const px = (uu: number) => ox + (uu * 0.5 + 0.5) * FACE; // u∈[-1,1] → [ox,ox+FACE]
  const py = (vv: number) => oy + (vv * 0.5 + 0.5) * FACE;
  const au = Math.abs(u), av = Math.abs(v);
  if (au > 0.6 && av > 0.6) {
    // corner triangle at (sign u, sign v).
    const su = Math.sign(u), sv = Math.sign(v);
    const corner: [number, number] = [px(su), py(sv)];
    const a: [number, number] = [px(su * 0.4), py(sv)];
    const b: [number, number] = [px(su), py(sv * 0.4)];
    return `${fmt(corner[0])},${fmt(corner[1])} ${fmt(a[0])},${fmt(a[1])} ${fmt(b[0])},${fmt(b[1])}`;
  }
  if (au > 0.6 || av > 0.6) {
    // edge petal: a kite hugging the edge in the dominant axis direction. The petal spans the middle of
    // the edge and tapers toward center — drawn as a quad (edge-left, edge-mid-out, edge-right, inner).
    const horiz = au > av; // u dominant ⇒ on left/right edge; else top/bottom edge
    if (horiz) {
      const su = Math.sign(u);
      const eOut = px(su), eIn = px(su * 0.4);
      return `${fmt(eOut)},${fmt(py(-0.4))} ${fmt(eOut)},${fmt(py(0.4))} ${fmt(eIn)},${fmt(py(0.18))} ${fmt(eIn)},${fmt(py(-0.18))}`;
    }
    const sv = Math.sign(v);
    const eOut = py(sv), eIn = py(sv * 0.4);
    return `${fmt(px(-0.4))},${fmt(eOut)} ${fmt(px(0.4))},${fmt(eOut)} ${fmt(px(0.18))},${fmt(eIn)} ${fmt(px(-0.18))},${fmt(eIn)}`;
  }
  // inner face-piece: one quadrant triangle of the central pinwheel: center → toward (su,0) → toward
  // (su, sv) inner. Use the (u,v) signs to pick the quadrant.
  const su = Math.sign(u), sv = Math.sign(v);
  const c1: [number, number] = [px(su * 0.4), py(sv * 0.18)];
  const c2: [number, number] = [px(su * 0.18), py(sv * 0.4)];
  return `${fmt(cx)},${fmt(cy)} ${fmt(c1[0])},${fmt(c1[1])} ${fmt(c2[0])},${fmt(c2[1])}`;
}

export function renderHelicvScrambleSvg(scramble: string): string {
  let colors: number[];
  try {
    colors = helicvFaceletColors(scramble);
  } catch (e) {
    console.warn('[helicv_svg] apply failed', scramble, e);
    colors = HELICV_FACE_OF.slice();
  }
  const C = HELICV_DEFAULT_COLORS;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
    `<rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" fill="${C.bg}"/>`,
  ];
  for (let f = 0; f < 6; f++) {
    const [col, row] = FACE_POS[f];
    const ox = GAP + col * (FACE + GAP);
    const oy = GAP + row * (FACE + GAP);
    out.push(`<rect x="${ox}" y="${oy}" width="${FACE}" height="${FACE}" fill="none" stroke="${C.stroke}" stroke-width="1.5"/>`);
    for (let k = 0; k < 12; k++) {
      const fl = f * 12 + k;
      const pts = faceletPolygon(ox, oy, fl);
      out.push(`<polygon points="${pts}" fill="${C.stickers[colors[fl]]}" stroke="${C.stroke}" stroke-width="0.6"/>`);
    }
  }
  out.push('</svg>');
  return out.join('');
}
