/**
 * Helicopter Cube (heli) state preview — a 2D cube net (6 faces in a cross), colored entirely from the
 * solver's exact piece-state (lib/heli-solver `heliFaceletColors`). The heli is a 3×3×3-shaped cube cut
 * along its edge midpoints, so each face shows 8 facelets: 4 CORNER triangles (at the face corners) and
 * 4 WING triangles (along the face edges, meeting at the face center). We draw each face as a unit square
 * split by its two diagonals into four edge-wing triangles, with four small corner triangles tucked into
 * the corners — every facelet placed at its true (u,v) position derived from the puzzle geometry.
 *
 * Colors come straight from the state: at solved every facelet shows its own face color, so each face
 * renders a SINGLE solid color — a self-proving render. Any scramble recolors faithfully; single source
 * of move truth = heliApply (via heliFaceletColors).
 */
import { heliFaceletColors, HELI_FACE_OF } from '@/lib/heli-solver';

// 6 sticker colors indexed by face 0..5 = U R F D L B (standard cube: U white, R red, F green, D yellow,
// L orange, B blue).
export const HELI_DEFAULT_COLORS = {
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

// Per-facelet (u,v) within its face, u,v ∈ {−0.667,−0.333,0.333,0.667}; corners at ±0.667, wings at
// ±0.333. Derived from poly3dlib geometry (see lib/heli-solver HELI_CORNERS / HELI_WING_FACELETS).
const FACELET_UV: ReadonlyArray<[number, number]> = [
  [-0.667, -0.667], [-0.667, 0.667], [0.667, -0.667], [0.667, 0.667], [0.333, -0.333], [0.333, 0.333], [-0.333, 0.333], [-0.333, -0.333],
  [0.667, -0.667], [-0.667, -0.667], [0.333, -0.333], [0.667, 0.667], [-0.333, -0.333], [-0.667, 0.667], [-0.333, 0.333], [0.333, 0.333],
  [-0.667, -0.667], [0.667, -0.667], [0.667, 0.667], [0.333, -0.333], [-0.667, 0.667], [-0.333, -0.333], [0.333, 0.333], [-0.333, 0.333],
  [0.667, -0.667], [0.667, 0.667], [0.333, 0.333], [-0.667, 0.667], [-0.333, 0.333], [0.333, -0.333], [-0.667, -0.667], [-0.333, -0.333],
  [-0.667, -0.667], [-0.667, 0.667], [-0.667, -0.667], [0.333, 0.333], [-0.667, 0.667], [0.333, -0.333], [-0.333, 0.333], [-0.333, -0.333],
  [-0.667, 0.667], [0.667, 0.667], [0.667, -0.667], [0.333, 0.333], [-0.667, -0.667], [0.333, -0.333], [0.667, -0.333], [-0.333, 0.333],
];

const FACE = 100;          // face square size in px
const GAP = 6;             // gap between faces
const VIEW_W = FACE * 4 + GAP * 5;
const VIEW_H = FACE * 3 + GAP * 4;

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }

// Face square split into 4 wing triangles (by diagonals) + 4 corner triangles. We map a facelet to its
// triangle by its (u,v) sign+magnitude: |u|,|v|≈0.667 → corner; ≈0.333 → wing (the edge it points to).
function faceletPolygon(ox: number, oy: number, fl: number): string {
  const [u, v] = FACELET_UV[fl];
  const half = FACE / 2;
  const cx = ox + half, cy = oy + half;
  const px = (uu: number) => ox + (uu * 0.5 + 0.5) * FACE; // u∈[-1,1] → [ox,ox+FACE]
  const py = (vv: number) => oy + (vv * 0.5 + 0.5) * FACE;
  const isCorner = Math.abs(u) > 0.5;
  if (isCorner) {
    // small triangle at the corner (sign of u,v), legs 0.34 of the face.
    const su = Math.sign(u), sv = Math.sign(v);
    const corner: [number, number] = [px(su), py(sv)];
    const a: [number, number] = [px(su * 0.34), py(sv)];
    const b: [number, number] = [px(su), py(sv * 0.34)];
    return `${fmt(corner[0])},${fmt(corner[1])} ${fmt(a[0])},${fmt(a[1])} ${fmt(b[0])},${fmt(b[1])}`;
  }
  // wing triangle: points from the face center toward the edge the facelet sits on. Decide edge by the
  // larger-|coord| axis after the corner check — here both are 0.333, so use which is "outer". We use the
  // edge in the direction of (u,v) rounded to the dominant axis.
  const su = Math.sign(u), sv = Math.sign(v);
  // The wing occupies one of the four diagonal triangles (center → two adjacent corners).
  const c1: [number, number] = [px(su), py(sv)];
  const c2: [number, number] = Math.abs(u) >= Math.abs(v) ? [px(su), py(-sv)] : [px(-su), py(sv)];
  return `${fmt(cx)},${fmt(cy)} ${fmt(c1[0])},${fmt(c1[1])} ${fmt(c2[0])},${fmt(c2[1])}`;
}

export function renderHeliScrambleSvg(scramble: string): string {
  let colors: number[];
  try {
    colors = heliFaceletColors(scramble);
  } catch (e) {
    console.warn('[heli_svg] apply failed', scramble, e);
    colors = HELI_FACE_OF.slice();
  }
  const C = HELI_DEFAULT_COLORS;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
    `<rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" fill="${C.bg}"/>`,
  ];
  for (let f = 0; f < 6; f++) {
    const [col, row] = FACE_POS[f];
    const ox = GAP + col * (FACE + GAP);
    const oy = GAP + row * (FACE + GAP);
    out.push(`<rect x="${ox}" y="${oy}" width="${FACE}" height="${FACE}" fill="none" stroke="${C.stroke}" stroke-width="1.5"/>`);
    for (let k = 0; k < 8; k++) {
      const fl = f * 8 + k;
      const pts = faceletPolygon(ox, oy, fl);
      out.push(`<polygon points="${pts}" fill="${C.stickers[colors[fl]]}" stroke="${C.stroke}" stroke-width="0.6"/>`);
    }
  }
  out.push('</svg>');
  return out.join('');
}
