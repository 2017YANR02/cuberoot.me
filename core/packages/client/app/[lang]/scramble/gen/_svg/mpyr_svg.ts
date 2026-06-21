/**
 * Master Pyraminx (大金字塔 / mpyrso) scramble preview — a 4-face triangular NET
 * derived from the true cubie state.
 *
 * The Master Pyraminx is a tetrahedron: 4 triangular faces, each subdivided into
 * 16 small triangles (an order-4 triangle: rows of 1,3,5,7). cstimer's MpyrCubie
 * tracks 13 body facelets per face (the 3 corner-TIP triangles are trivial and
 * excluded from the cubie model). We compute the 52 body facelet colors via
 * lib/mpyr-solver `mpyrFacelets` (a faithful port of cstimer's MpyrCubie apply),
 * then paint each face's 13 body triangles from state + draw the 3 tip triangles
 * in their solved corner color. Solved → every face is a single color
 * (self-certifying). This is the §4 soft-preview schematic — geometry is a clean
 * order-4 triangle net, not a pixel-exact reproduction of cstimer's image.
 *
 * Colors: cstimer Master Pyraminx faces are F/R/D/L (4 colors); we use distinct
 * data hues (not UI grey) so a scrambled state is legible.
 */

import { mpyrFacelets } from '@/lib/mpyr-solver';

// Face order in the facelet array = F, R, D, L (each 13 slots: 0..12).
const FACE_COLORS = ['#16a34a', '#2563eb', '#eab308', '#dc2626']; // F green, R blue, D yellow, L red

const SQRT3 = Math.sqrt(3);
const SIZE = 30;   // length of a small-triangle side region
const GAP = 6;

interface Pt { x: number; y: number; }

/**
 * The 16 small triangles of an order-4 triangle, as polygons in a unit triangle
 * with apex at top. Rows top→bottom have 1,3,5,7 triangles; within a row the
 * triangles alternate up/down. We index them 0..15 in reading order (row-major).
 *
 * Slot mapping: cstimer's 13 body facelets occupy the 13 NON-tip triangles; the 3
 * tip triangles are the up-pointing corners of the big triangle (top apex, bottom-
 * left, bottom-right). We list the 16 triangles, mark which are tips, and assign
 * body facelet slots 0..12 to the non-tip ones in reading order.
 */
interface Tri { poly: [number, number][]; tip: number; } // tip = -1 if body, else corner id

function buildFaceTriangles(pointUp: boolean): Tri[] {
  // Big triangle vertices (apex up). Side length = 4*SIZE. Height = 4*SIZE*√3/2.
  const side = 4 * SIZE;
  const height = side * SQRT3 / 2;
  // Apex top, base bottom (point-up). For point-down faces we flip vertically.
  const A: Pt = { x: side / 2, y: 0 };          // apex
  const B: Pt = { x: 0, y: height };            // bottom-left
  const C: Pt = { x: side, y: height };         // bottom-right

  // Barycentric lerp helper across the triangle by (i,j) lattice (rows of small tris).
  // Row r (0=top) has 2r+1 small triangles. Vertices on a triangular grid:
  // point P(r,k) = A + (B-A)*(r/4) + (C-B)*(k/4) for k in 0..r along that row.
  const P = (r: number, k: number): Pt => ({
    x: A.x + (B.x - A.x) * (r / 4) + (C.x - B.x) * (k / 4),
    y: A.y + (B.y - A.y) * (r / 4) + (C.y - B.y) * (k / 4),
  });

  const tris: Tri[] = [];
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k <= r; k++) {
      // up-pointing triangle in this cell: P(r,k), P(r+1,k), P(r+1,k+1)
      tris.push({ poly: [pt(P(r, k)), pt(P(r + 1, k)), pt(P(r + 1, k + 1))], tip: -1 });
      // down-pointing triangle (exists when k < r): P(r,k), P(r,k+1)... but
      // cell pairs: between up-tris there is a down-tri sharing the top edge.
      if (k < r) {
        tris.push({ poly: [pt(P(r, k)), pt(P(r, k + 1)), pt(P(r + 1, k + 1))], tip: -1 });
      }
    }
  }
  // tris now has 1 + 3 + 5 + 7 = 16 entries in row-major order. Tip triangles are
  // the up-pointing corners: index 0 (apex), the bottom-left up-tri (first of row
  // 3), and the bottom-right up-tri (last up-tri of row 3).
  // Row offsets: row0 →[0], row1 →[1,2,3], row2 →[4,5,6,7,8], row3 →[9..15].
  // Apex = 0. Bottom-left corner up-tri = first of row3 = index 9. Bottom-right = 15.
  tris[0].tip = 0;
  tris[9].tip = 1;
  tris[15].tip = 2;

  if (!pointUp) {
    // flip vertically about the centroid for point-down faces
    let maxY = 0;
    for (const t of tris) for (const p of t.poly) maxY = Math.max(maxY, p[1]);
    for (const t of tris) for (const p of t.poly) p[1] = maxY - p[1];
  }
  return tris;
}

function pt(p: Pt): [number, number] { return [p.x, p.y]; }
function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }

/** Color a face's 16 triangles: body slots 0..12 from state, 3 tips = corner color. */
function paintFace(
  out: string[],
  tris: Tri[],
  ox: number,
  oy: number,
  faceColors: number[],   // 13 body facelet color indices (0..3) for this face
  faceColorBase: number,  // the face's own solved color index (for tip triangles)
) {
  let bodySlot = 0;
  for (const t of tris) {
    let colorIdx: number;
    if (t.tip >= 0) {
      colorIdx = faceColorBase; // tips are trivial → draw the face's solved color
    } else {
      colorIdx = faceColors[bodySlot++] ?? faceColorBase;
    }
    const fill = FACE_COLORS[colorIdx] ?? '#888';
    const d = `M${t.poly.map((p) => `${fmt(p[0] + ox)},${fmt(p[1] + oy)}`).join(' L')} Z`;
    out.push(`<path d="${d}" fill="${fill}" stroke="#111" stroke-width="1" stroke-linejoin="round"/>`);
  }
}

/**
 * Render a Master Pyraminx scramble as a 4-face unfolded net SVG (transparent bg).
 * Layout: F (center, point-up) with R / L flanking and D below — a standard
 * tetrahedron net. Colors derived from the true state; solved = single color/face.
 */
export function renderMpyrScrambleSvg(scramble: string): string {
  let facelets: number[];
  try {
    facelets = mpyrFacelets(scramble);
  } catch (e) {
    console.warn('[mpyr_svg] mpyrFacelets failed', scramble, e);
    facelets = mpyrFacelets('');
  }
  // split into 4 faces of 13 (face order F,R,D,L)
  const faceState = (f: number) => facelets.slice(f * 13, f * 13 + 13);

  const up = buildFaceTriangles(true);
  const down = buildFaceTriangles(false);
  const side = 4 * SIZE;
  const height = side * SQRT3 / 2;

  // Four faces laid out as separate, non-overlapping cells (same spirit as the
  // pyraminx_svg net): F point-up center-top; D point-down center-bottom; L / R
  // point-down flanking. Each face bbox = side × height.
  const halfSide = side / 2;
  const w = 3 * side + 4 * GAP;
  const h = 2 * height + 3 * GAP;
  const cx = w / 2;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(w)} ${fmt(h)}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`);
  // F (green), point-up — center, top row.
  paintFace(out, up, cx - halfSide, GAP, faceState(0), 0);
  // D (yellow), point-down — center, bottom row.
  paintFace(out, down, cx - halfSide, 2 * GAP + height, faceState(2), 2);
  // L (red), point-down — left, top row.
  paintFace(out, down, GAP, GAP, faceState(3), 3);
  // R (blue), point-down — right, top row.
  paintFace(out, down, w - GAP - side, GAP, faceState(1), 1);
  out.push('</svg>');
  return out.join('');
}
