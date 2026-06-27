// Mirror Cube (Bump Cube) geometry tables.
//
// A mirror cube IS a standard 3x3 — same logical state, same turns, same scrambles.
// The only difference is geometry: the 3 layers along each axis have UNEQUAL
// thickness, so every cubie is a distinct cuboid. Solved, the pieces still pack into
// a perfect cube; scrambling carries each cubie's fixed shape to a foreign slot,
// making the surface bumpy (you solve by shape, not colour).
//
// We keep the logical layer (index/vector/turns/scramble — see engine/nxn) perfectly
// UNIFORM, and apply non-uniform thickness only at render time:
//   renderMatrix(cubie) = compose(R · center0, R, scale0)
// where R = cubie.quaternion (accumulated rotation), and center0 / scale0 come from
// the cubie's ORIGINAL slot (its fixed shape). A slice turn animates as R_slice ·
// renderMatrix, which is again a valid renderMatrix of the new state — no popping.
//
// Layer thicknesses (sum = 3 per axis; classic mirror-cube ratios — matches the
// offsets in /scramble/gen mirror_blocks_svg.ts HEIGHTS 0.15 / 0.45 / 0.3). Index i
// of each axis follows engine/nxn (i = index%3 for x, etc.); i=0 is the L / D / B
// (negative) side, which is the THICK side per the cstimer scramble image.
import { SIZE } from '../define';

const T_X = [1.15, 1, 0.85]; // L .. R
const T_Y = [1.45, 1, 0.55]; // D .. U
const T_Z = [1.3, 1, 0.7];   // B .. F

// Layer center along one axis, in SIZE units, with the whole cube centered at 0.
// center_i = (Σ thickness[0..i-1]) + thickness[i]/2 − 1.5  (1.5 = half of total 3).
function layerCenters(t: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < t.length; i++) {
    out.push((acc + t[i] / 2 - 1.5) * SIZE);
    acc += t[i];
  }
  return out;
}
const C_X = layerCenters(T_X);
const C_Y = layerCenters(T_Y);
const C_Z = layerCenters(T_Z);

export interface MirrorTables {
  /** cubie index → cuboid center (x,y,z), in cube-local units (SIZE), origin-centered. */
  center(index: number): [number, number, number];
  /** cubie index → cuboid scale (sx,sy,sz) relative to the unit SIZE frame box. */
  scale(index: number): [number, number, number];
}

/** Build the per-cubie center/scale lookups for an order-3 mirror cube. `order` is a
 *  parameter only for symmetry with the NxN engine — a mirror cube is always 3. */
export function mirrorTables(order = 3): MirrorTables {
  const order2 = order * order;
  const lx = (i: number) => i % order;
  const ly = (i: number) => Math.floor((i % order2) / order);
  const lz = (i: number) => Math.floor(i / order2);
  return {
    center: (i) => [C_X[lx(i)], C_Y[ly(i)], C_Z[lz(i)]],
    scale: (i) => [T_X[lx(i)], T_Y[ly(i)], T_Z[lz(i)]],
  };
}
