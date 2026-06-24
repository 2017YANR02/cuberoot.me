/**
 * Unit-square Ivy face geometry (SVG path-d), ported from the static generator
 * (skills/image-to-svg/cube_svg.py) and the project's net renderer
 * (app/.../scramble/gen/_svg/ivy_svg.ts).
 *
 * A face = a unit square cut by TWO arcs (radius = edge), each centered at one
 * of the two turning corners; they sweep between the two non-turning corners,
 * carving a center "eye" lens + two petals. IvyCube maps these onto the 3D cube
 * faces (SVGLoader -> ExtrudeGeometry).
 */
import { circleIntersect } from '../stickerGeom';

export type Corner = 'a' | 'b' | 'c' | 'd'; // a=(0,0) b=(1,0) c=(0,1) d=(1,1)

const LC: Record<Corner, [number, number]> = {
  a: [0, 0], b: [1, 0], c: [0, 1], d: [1, 1],
};

/** SVG sweep flag (large-arc=0) for the minor arc centered at `c` from p1->p2
 *  bulging away from the center (toward the face interior). SVG y is down. */
function arcSweep(c: [number, number], p1: [number, number], p2: [number, number]): 0 | 1 {
  const a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]);
  const a2 = Math.atan2(p2[1] - c[1], p2[0] - c[0]);
  const mid = (sweep: 0 | 1): [number, number] => {
    let da = a2 - a1;
    if (sweep === 1) { if (da < 0) da += 2 * Math.PI; } else if (da > 0) { da -= 2 * Math.PI; }
    const am = a1 + da / 2;
    return [c[0] + Math.cos(am), c[1] + Math.sin(am)];
  };
  const cm: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const dir = [cm[0] - c[0], cm[1] - c[1]];
  const score = (sweep: 0 | 1): number => {
    const m = mid(sweep);
    return (m[0] - cm[0]) * dir[0] + (m[1] - cm[1]) * dir[1];
  };
  return score(1) > score(0) ? 1 : 0;
}

const n = (x: number): string => Number(x.toFixed(4)).toString();

export interface FacePaths {
  /** center "eye" lens path-d */
  lens: string;
  /** petal at turning corner turn[0] / turn[1] */
  petals: [string, string];
}

/** Build the 3 region path-d strings for a face whose TWO turning corners are
 *  `turn` (the other two are the lens tips). */
export function facePaths(turn: [Corner, Corner]): FacePaths {
  const t = turn.map((k) => LC[k]) as [number, number][];
  const non = (['a', 'b', 'c', 'd'] as Corner[]).filter((k) => !turn.includes(k)).map((k) => LC[k]);
  const [n1, n2] = non as [[number, number], [number, number]];
  const s = t.map((tc) => arcSweep(tc, n1, n2));
  const A = (sweep: number, p: [number, number]) => `A 1 1 0 0 ${sweep} ${n(p[0])} ${n(p[1])}`;
  const lens = `M ${n(n1[0])} ${n(n1[1])} ${A(s[0], n2)} ${A(1 - s[1], n1)} Z`;
  const petals: [string, string] = [
    `M ${n(t[0][0])} ${n(t[0][1])} L ${n(n1[0])} ${n(n1[1])} ${A(s[1], n2)} L ${n(t[0][0])} ${n(t[0][1])} Z`,
    `M ${n(t[1][0])} ${n(t[1][1])} L ${n(n1[0])} ${n(n1[1])} ${A(s[0], n2)} L ${n(t[1][0])} ${n(t[1][1])} Z`,
  ];
  return { lens, petals };
}

const d2 = (p: [number, number], q: [number, number]): number => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;

/** Like facePaths, but opens an EVEN-WIDTH groove of radial width `w` between the
 *  lens and each petal while keeping EVERY curved edge a TRUE circular arc (radius
 *  centered on a turning corner — never a scaled/elliptical approximation; this is
 *  a hard requirement). The petals stay the real arcs (radius 1, reaching the
 *  non-turning corners); only the lens shrinks to concentric arcs at radius 1-w,
 *  its tips pulled back to where the two shrunk circles meet. Groove = the annular
 *  gap [1-w, 1] about each turning corner, bounded by two concentric true circles. */
export function facePathsGrooved(turn: [Corner, Corner], w: number): FacePaths {
  const t = turn.map((k) => LC[k]) as [number, number][];
  const non = (['a', 'b', 'c', 'd'] as Corner[]).filter((k) => !turn.includes(k)).map((k) => LC[k]);
  const [n1, n2] = non as [[number, number], [number, number]];
  const s = t.map((tc) => arcSweep(tc, n1, n2));
  const A = (r: number, sweep: number, p: [number, number]) => `A ${n(r)} ${n(r)} 0 0 ${sweep} ${n(p[0])} ${n(p[1])}`;
  // Petals: unchanged real arcs (radius 1), tangent to the cube edges at n1/n2.
  const petals: [string, string] = [
    `M ${n(t[0][0])} ${n(t[0][1])} L ${n(n1[0])} ${n(n1[1])} ${A(1, s[1], n2)} L ${n(t[0][0])} ${n(t[0][1])} Z`,
    `M ${n(t[1][0])} ${n(t[1][1])} L ${n(n1[0])} ${n(n1[1])} ${A(1, s[0], n2)} L ${n(t[1][0])} ${n(t[1][1])} Z`,
  ];
  // Lens: concentric arcs at radius 1-w about the SAME turning corners; new tips
  // = circle(t0,1-w) ∩ circle(t1,1-w), the one near each non-turning corner.
  const r = 1 - w;
  const [i0, i1] = circleIntersect(t[0], r, t[1], r);
  const tipA = d2(i0, n1) < d2(i1, n1) ? i0 : i1; // near n1
  const tipB = d2(i0, n2) < d2(i1, n2) ? i0 : i1; // near n2
  const lens = `M ${n(tipA[0])} ${n(tipA[1])} ${A(r, s[0], tipB)} ${A(r, 1 - s[1], tipA)} Z`;
  return { lens, petals };
}
