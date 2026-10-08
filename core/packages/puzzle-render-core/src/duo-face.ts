/**
 * Pyraminx Duo's approved face partition, shared by the 3D shell and the SVG net.
 * A same-facing centre triangle and three concave six-sided corner patches.
 * The 0.40 centre/outer side ratio was approved in the 2026-10-08 outline review;
 * it is an appearance parameter, not a measured manufacturing dimension.
 * Reference: https://www.jaapsch.net/puzzles/pyraduo.htm
 */
import { CUBE_FILL } from './support/cube-colors';

export type DuoPoint2 = readonly [number, number];
export const DUO_CENTRE_RATIO = 0.4;
export const DUO_FACE_HEIGHT = Math.sqrt(3) / 2;
export const DUO_OUTER_TRIANGLE: readonly DuoPoint2[] = [
  [0.5, 0], [0, DUO_FACE_HEIGHT], [1, DUO_FACE_HEIGHT],
];
const [A, B, C] = DUO_OUTER_TRIANGLE;
const middle: DuoPoint2 = [0.5, DUO_FACE_HEIGHT * 2 / 3];
const central = DUO_OUTER_TRIANGLE.map(([x, y]): DuoPoint2 => [
  middle[0] + (x - middle[0]) * DUO_CENTRE_RATIO,
  middle[1] + (y - middle[1]) * DUO_CENTRE_RATIO,
]);
const [a, b, c] = central;
const midpoint = (p: DuoPoint2, q: DuoPoint2): DuoPoint2 => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
const Mab = midpoint(A, B), Mac = midpoint(A, C), Mbc = midpoint(B, C);
const mab = midpoint(a, b), mac = midpoint(a, c), mbc = midpoint(b, c);

export interface DuoFacePatch {
  /** Local face vertex 0/1/2, or null for the central triangle. */
  vertex: number | null;
  polygon: readonly DuoPoint2[];
}

export const DUO_FACE_PATCHES: readonly DuoFacePatch[] = [
  { vertex: 0, polygon: [A, Mab, mab, a, mac, Mac] },
  { vertex: 1, polygon: [B, Mbc, mbc, b, mab, Mab] },
  { vertex: 2, polygon: [C, Mac, mac, c, mbc, Mbc] },
  { vertex: null, polygon: central },
];

/** Opposite U/L/R/B: yellow bottom, blue right, red left, green front. */
export const DUO_FACE_COLORS: readonly string[] = [CUBE_FILL.D, CUBE_FILL.B, CUBE_FILL.R, CUBE_FILL.F];

/** Barycentric placement of a normalized face point onto an arbitrary triangle. */
export function duoFaceWeights([x, y]: DuoPoint2): readonly [number, number, number] {
  const bottom = y / DUO_FACE_HEIGHT;
  return [1 - bottom, bottom / 2 + 0.5 - x, bottom / 2 - 0.5 + x];
}
