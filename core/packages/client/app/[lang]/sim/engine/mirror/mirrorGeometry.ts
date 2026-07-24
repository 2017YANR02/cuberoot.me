// Mirror Cube (Bump Cube) geometry tables — 3x3 and 2x2.
//
// A mirror cube IS a standard NxN — same logical state, same turns, same scrambles.
// The only difference is geometry: the layers along each axis have UNEQUAL thickness,
// so every cubie is a distinct cuboid. Solved, the pieces still pack into a perfect
// cube; scrambling carries each cubie's fixed shape to a foreign slot, making the
// surface bumpy (you solve by shape, not colour).
//
// We keep the logical layer (index/vector/turns/scramble — see engine/nxn) perfectly
// UNIFORM, and apply non-uniform thickness only at render time:
//   renderMatrix(cubie) = compose(C + R·(center0 − C), R, scale0)
// where R = cubie.quaternion (accumulated rotation), center0 / scale0 come from the
// cubie's ORIGINAL slot (its fixed shape), and C is the core (see below). A slice turn
// animates as R_slice · renderMatrix, which is again a valid renderMatrix of the new
// state — no popping.
//
// MECHANISM. A mirror cube is a standard mechanism whose outer shell is OFFSET from the
// core: the cut planes sit at the stock spacing around the core, and the cube shell is
// slid off-centre by `CORE_OFFSET`. So the core — the point all three turn axes pass
// through — is NOT the bounding-box centre, and a face turn must pivot there (turning
// about the box centre would translate the face centre, which no real cube does).
// Everything sticking out past a cut plane is decoration and is free to be asymmetric;
// that is exactly what makes a scrambled mirror cube bumpy.
//
// The offset is expressed as a fraction of the WHOLE edge, so every order shares one
// eccentricity: a 2x2 mirror is the 3x3's core shifted by the same amount in world
// units, bulges the same amount when scrambled (camera framing constants need no
// per-order tuning), and reads as the same family of puzzle. Grounded in real 2x2
// mirror blocks, whose layer ratios (~1.2–1.9 : 1) are milder than the 3x3's.
import { SIZE } from '../define';

/** Core offset from the cube's geometric centre along x / y / z, as a fraction of the
 *  whole edge. Positive = the core sits toward R / U / F, so the L / D / B layers are
 *  the THICK ones (matches the cstimer mirror-blocks scramble image and the
 *  /scramble/gen mirror_blocks_svg heights). */
const CORE_OFFSET = [0.05, 0.15, 0.10] as const;

/** Layer thicknesses along one axis, in cubie units (sum = order). The shell offset
 *  fattens the first layer and thins the last by the same amount; every layer in
 *  between keeps the stock thickness 1.
 *  order 3 → x [1.15, 1, 0.85]  y [1.45, 1, 0.55]  z [1.3, 1, 0.7]  (classic 3x3 mirror)
 *  order 2 → x [1.10, 0.90]     y [1.30, 0.70]     z [1.2, 0.8] */
export function layerThickness(order: number, axis: number): number[] {
  const d = CORE_OFFSET[axis] * order;
  const t = new Array<number>(order).fill(1);
  t[0] = 1 + d;
  t[order - 1] = 1 - d;
  return t;
}

// Layer center along one axis, in SIZE units, with the whole cube centered at 0.
// center_i = (Σ thickness[0..i-1]) + thickness[i]/2 − order/2.
function layerCenters(t: number[], order: number): number[] {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < t.length; i++) {
    out.push((acc + t[i] / 2 - order / 2) * SIZE);
    acc += t[i];
  }
  return out;
}

export interface MirrorTables {
  /** cubie index → cuboid center (x,y,z), in cube-local units (SIZE), origin-centered. */
  center(index: number): [number, number, number];
  /** cubie index → cuboid scale (sx,sy,sz) relative to the unit SIZE frame box. */
  scale(index: number): [number, number, number];
  /** The core: the single point all three turn axes pass through, in the same
   *  cube-local units. Every layer turn pivots here, not at the origin. */
  pivot(): [number, number, number];
}

/** Build the per-cubie center/scale lookups for an order-`order` mirror cube (2 or 3). */
export function mirrorTables(order: number): MirrorTables {
  const order2 = order * order;
  const T = [layerThickness(order, 0), layerThickness(order, 1), layerThickness(order, 2)];
  const C = [layerCenters(T[0], order), layerCenters(T[1], order), layerCenters(T[2], order)];
  const lx = (i: number) => i % order;
  const ly = (i: number) => Math.floor((i % order2) / order);
  const lz = (i: number) => Math.floor(i / order2);
  return {
    center: (i) => [C[0][lx(i)], C[1][ly(i)], C[2][lz(i)]],
    scale: (i) => [T[0][lx(i)], T[1][ly(i)], T[2][lz(i)]],
    // = the shell offset in local units. For an odd order this lands exactly on the
    // centre cubie's centre; for an even order it lands on the single cut plane's
    // triple intersection — the corner all 8 cubies share.
    pivot: () => [
      CORE_OFFSET[0] * order * SIZE,
      CORE_OFFSET[1] * order * SIZE,
      CORE_OFFSET[2] * order * SIZE,
    ],
  };
}
