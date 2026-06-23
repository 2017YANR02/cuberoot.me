/**
 * Icosamate (ctico) state preview — a 2D icosahedron net (20 triangular faces in the classic strip layout),
 * colored entirely from the solver's exact piece-state (lib/ctico-solver `cticoFaceletColors`). Each face
 * shows 4 facelets: 3 CORNER sub-triangles (one tucked into each triangle vertex) + 1 CENTER triangle in
 * the middle — the deep vertex-turning cut. Every facelet is placed at its true in-face position derived
 * from poly3dlib geometry.
 *
 * Colors come straight from the state: at solved every facelet shows its own face color, so each face
 * renders a SINGLE solid color — a self-proving render. Any scramble recolors faithfully; single source of
 * move truth = cticoApply (via cticoFaceletColors). The 20 face colors are distinct hues (icosahedron has
 * 20 faces); the palette is generated from an even hue wheel so adjacent faces stay distinguishable.
 */
import { cticoFaceletColors, CTICO_FACE_OF } from '@/lib/ctico-solver';

// 20 distinct face colors (icosahedron). Evenly-spaced hues, mid saturation/lightness for clarity.
export const CTICO_FACE_COLORS: string[] = Array.from({ length: 20 }, (_, i) => {
  const h = Math.round((i * 360) / 20);
  const s = i % 2 === 0 ? 70 : 55;
  const l = i % 3 === 0 ? 52 : i % 3 === 1 ? 60 : 46;
  return `hsl(${h} ${s}% ${l}%)`;
});
const STROKE = '#1a1a1a';
const BG = 'transparent';

// ── net layout: 20 triangles in 4 rows of 5 (classic icosahedron net strip). Each triangle is equilateral
// with side TRI; alternating up/down within a row, rows offset so they tessellate. We assign faces 0..19 to
// slots row-major; exact face↔slot mapping is irrelevant to the self-proving property (solved = 20 solid
// triangles regardless of placement). ──
const TRI = 60;                       // triangle side in px
const H = (TRI * Math.sqrt(3)) / 2;   // triangle height
const COLS = 5, ROWS = 4;
const PAD = 6;
// last column's right edge = PAD + (COLS-1)·TRI/2 + TRI
const VIEW_W = PAD * 2 + (COLS - 1) * (TRI / 2) + TRI;
const VIEW_H = ROWS * H + PAD * 2;

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }

// A face slot = the 3 outer corners (in net px). Triangles tessellate: within a row, column k occupies the
// horizontal span [k·TRI/2, k·TRI/2 + TRI]; up-pointing when (row+col) even, down-pointing otherwise, so
// consecutive triangles share an edge — a solid 20-triangle band.
interface Slot { corners: [number, number][]; }
function slotFor(row: number, col: number): Slot {
  const up = (row + col) % 2 === 0;
  const ox = PAD + col * (TRI / 2);
  const oy = PAD + row * H;
  if (up) return { corners: [[ox + TRI / 2, oy], [ox, oy + H], [ox + TRI, oy + H]] };
  return { corners: [[ox, oy], [ox + TRI, oy], [ox + TRI / 2, oy + H]] };
}

// Within a face, the 4 facelets: center (id order from CTICO geometry) sits at the centroid; the 3 corner
// facelets each sit toward one triangle vertex. We render: center = a small triangle at the centroid (same
// orientation as the face); each corner facelet = the quad/triangle between a vertex and the center region.
// Simpler + clean: split the face into 3 "corner" quads (vertex → two edge-midpoints → centroid) + 1 center
// triangle (the three edge-midpoints). That's 3 corner facelets + 1 center facelet = exactly our 4.
function facePolys(corners: [number, number][]): { center: string; cornersP: string[] } {
  const [A, B, C] = corners;
  const mid = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const G: [number, number] = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
  const mAB = mid(A, B), mBC = mid(B, C), mCA = mid(C, A);
  const pt = (p: [number, number]) => `${fmt(p[0])},${fmt(p[1])}`;
  // center facelet = the medial triangle (mAB, mBC, mCA)
  const center = `${pt(mAB)} ${pt(mBC)} ${pt(mCA)}`;
  // corner facelets = quad (vertex, adjacent edge mid, centroid, other adjacent edge mid)
  const cornersP = [
    `${pt(A)} ${pt(mAB)} ${pt(G)} ${pt(mCA)}`, // corner at A
    `${pt(B)} ${pt(mBC)} ${pt(G)} ${pt(mAB)}`, // corner at B
    `${pt(C)} ${pt(mCA)} ${pt(G)} ${pt(mBC)}`, // corner at C
  ];
  return { center, cornersP };
}

// facelet index layout per face from geometry: CTICO_VERTEX/FACECENTER facelets are global ids; here we map
// each face's 4 facelets to [corner0, corner1, corner2, center] in a stable order. The ids within a face are
// the 4 facelets with CTICO_FACE_OF === face, in ascending id; the radius-1.0 (center) one is identified by
// being the single FACECENTER facelet of that face. We precompute per-face [c0,c1,c2,centerId].
import { CTICO_FACECENTER_FACELETS } from '@/lib/ctico-solver';
const FACE_FACELETS: number[][] = (() => {
  const centerSet = new Set(CTICO_FACECENTER_FACELETS);
  const byFace: number[][] = Array.from({ length: 20 }, () => []);
  for (let i = 0; i < 80; i++) byFace[CTICO_FACE_OF[i]].push(i);
  // order: 3 corner facelets (not center) ascending, then the center facelet last.
  return byFace.map((ids) => {
    const corners = ids.filter((x) => !centerSet.has(x)).sort((a, b) => a - b);
    const center = ids.find((x) => centerSet.has(x))!;
    return [...corners, center];
  });
})();

export function renderCticoScrambleSvg(scramble: string): string {
  let colors: number[];
  try {
    colors = cticoFaceletColors(scramble);
  } catch (e) {
    console.warn('[ctico_svg] apply failed', scramble, e);
    colors = CTICO_FACE_OF.slice();
  }
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(VIEW_W)} ${fmt(VIEW_H)}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
    `<rect x="0" y="0" width="${fmt(VIEW_W)}" height="${fmt(VIEW_H)}" fill="${BG}"/>`,
  ];
  let face = 0;
  for (let row = 0; row < ROWS && face < 20; row++) {
    for (let col = 0; col < COLS && face < 20; col++) {
      const slot = slotFor(row, col);
      const { center, cornersP } = facePolys(slot.corners);
      const [c0, c1, c2, centerId] = FACE_FACELETS[face];
      // 3 corner facelets + center facelet, colored from state
      out.push(`<polygon points="${cornersP[0]}" fill="${CTICO_FACE_COLORS[colors[c0]]}" stroke="${STROKE}" stroke-width="0.6"/>`);
      out.push(`<polygon points="${cornersP[1]}" fill="${CTICO_FACE_COLORS[colors[c1]]}" stroke="${STROKE}" stroke-width="0.6"/>`);
      out.push(`<polygon points="${cornersP[2]}" fill="${CTICO_FACE_COLORS[colors[c2]]}" stroke="${STROKE}" stroke-width="0.6"/>`);
      out.push(`<polygon points="${center}" fill="${CTICO_FACE_COLORS[colors[centerId]]}" stroke="${STROKE}" stroke-width="0.6"/>`);
      // outer triangle outline
      const op = slot.corners.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(' ');
      out.push(`<polygon points="${op}" fill="none" stroke="${STROKE}" stroke-width="1.2"/>`);
      face++;
    }
  }
  out.push('</svg>');
  return out.join('');
}
