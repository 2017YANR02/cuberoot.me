/**
 * Analytic Rex face tiling (pure 2D) — the TRUE circular-arc outline of every region on
 * one cube face, grooved + rounded, so the colored stickers are smooth curves with real
 * thickness (extruded in rexGeometry). The generic arc / round primitives live in
 * ../stickerGeom; this file is just the Rex-specific topology.
 *
 * One face is the square [-1,1]². The 4 corner spheres of that face cut it as 4 CIRCLES,
 * one per corner: circle for corner (sx,sy) is centred at S·(sx,sy) with radius
 * ρ = √((S+1)²+(S−1)²) — it passes through the face's two ADJACENT corners, so the four
 * circles pair up into two vesica lenses (one per diagonal) whose overlap is the centre.
 * Membership gives the tiling: inside all 4 = CENTRE (a 4-arc star, axis tips at ±d),
 * inside 3 = PETAL (curved triangle at each corner), inside 2 = EDGE (a kite at each edge
 * midpoint: cube edge + 2 arcs → the centre vertex). d = √(S²+2) − S.
 *
 * Grooving = the Ivy method (NOT a miter offset of sampled points, which spikes at sharp
 * vertices — pitfall #12): every boundary curve is offset CONCENTRICALLY (an arc on a
 * circle the region is inside → radius ρ−w; outside → ρ+w; the cube-edge line → moved in
 * by w), and each VERTEX is recomputed as the exact intersection of its two offset curves.
 * Then the acute tips are rounded (roundCorners) so they read soft, not as needles.
 */
import { type V2, arcPts, circleIntersect, roundCorners } from '../stickerGeom';

const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const hyp = (a: V2): number => Math.hypot(a[0], a[1]);

export interface RexRegion {
  kind: 'center' | 'petal' | 'edge';
  /** Keyed position in face coords: centre [0,0]; petal corner (±1,±1); edge side (±1,0)/(0,±1). */
  pos: V2;
  /** Outline in [-1,1]² math coords, grooved + rounded. */
  pts: V2[];
}

// A boundary segment: an arc on circle centred `c`, or the straight cube edge `coord` ⟂ `axis`.
type ArcSeg = { c: V2 };
type LineSeg = { axis: 0 | 1; coord: number };
type Seg = ArcSeg | LineSeg;
const isArc = (s: Seg): s is ArcSeg => 'c' in s;

interface RegionDef { kind: RexRegion['kind']; pos: V2; verts: V2[]; segs: Seg[]; }

// Grooved (offset) form of a segment: arc → its centre + offset radius; line → offset coord.
type GArc = { arc: true; c: V2; r: number };
type GLine = { arc: false; axis: 0 | 1; coord: number };
type GSeg = GArc | GLine;

/** Nearest of two circle/line intersections to `near` — picks the right vertex branch. */
function intersect(a: GSeg, b: GSeg, near: V2): V2 {
  if (a.arc && b.arc) {
    const [i0, i1] = circleIntersect(a.c, a.r, b.c, b.r);
    return hyp(sub(i0, near)) <= hyp(sub(i1, near)) ? i0 : i1;
  }
  const arc = (a.arc ? a : b) as GArc;
  const line = (a.arc ? b : a) as GLine;
  const other = line.axis === 0 ? 1 : 0;
  const root = Math.sqrt(Math.max(0, arc.r * arc.r - (line.coord - arc.c[line.axis]) ** 2));
  const mk = (o: number): V2 => (line.axis === 0 ? [line.coord, o] : [o, line.coord]);
  const p1 = mk(arc.c[other] + root), p2 = mk(arc.c[other] - root);
  return hyp(sub(p1, near)) <= hyp(sub(p2, near)) ? p1 : p2;
}

/** Concentric-groove + sample + round one region. */
function buildOutline(def: RegionDef, rho: number, w: number, round: number, seg: number): V2[] {
  const { verts, segs } = def;
  const m = verts.length;
  const cen: V2 = [verts.reduce((s, v) => s + v[0], 0) / m, verts.reduce((s, v) => s + v[1], 0) / m];
  const g: GSeg[] = segs.map((s) => isArc(s)
    ? { arc: true, c: s.c, r: hyp(sub(cen, s.c)) < rho ? rho - w : rho + w }
    : { arc: false, axis: s.axis, coord: s.coord - Math.sign(s.coord) * w });
  // each vertex i = intersection of the two offset segments meeting there, near the original.
  const gv = verts.map((v, i) => intersect(g[(i - 1 + m) % m], g[i], v));
  const out: V2[] = [];
  for (let i = 0; i < m; i++) {
    const s = g[i];
    if (s.arc) out.push(...arcPts(s.c, gv[i], gv[(i + 1) % m], seg));
    else out.push(gv[i]); // straight cube edge: just its start vertex
  }
  return round > 0 ? roundCorners(out, round) : out;
}

/** Build all 9 region defs of a Rex face (geometry of the 4 corner circles + vertices). */
function rexFaceDefs(S: number): { defs: RegionDef[]; d: number } {
  const d = Math.sqrt(S * S + 2) - S;            // centre-vertex offset on each axis
  const C = (sx: number, sy: number): V2 => [sx * S, sy * S]; // corner-sphere centre
  const Vx = (sx: number): V2 => [sx * d, 0];    // centre vertex on x axis
  const Vy = (sy: number): V2 => [0, sy * d];    // on y axis
  const K = (sx: number, sy: number): V2 => [sx, sy]; // face corner
  const defs: RegionDef[] = [];

  // CENTRE: VE→VN→VW→VS, each arc on the diagonally-opposite corner's circle.
  defs.push({
    kind: 'center', pos: [0, 0],
    verts: [Vx(1), Vy(1), Vx(-1), Vy(-1)],
    segs: [{ c: C(-1, -1) }, { c: C(1, -1) }, { c: C(1, 1) }, { c: C(-1, 1) }],
  });
  // PETALS: corner K → arc C(-sx,sy) → Vx → arc C(-sx,-sy) → Vy → arc C(sx,-sy) → K.
  for (const sx of [1, -1] as const) for (const sy of [1, -1] as const) {
    defs.push({
      kind: 'petal', pos: K(sx, sy),
      verts: [K(sx, sy), Vx(sx), Vy(sy)],
      segs: [{ c: C(-sx, sy) }, { c: C(-sx, -sy) }, { c: C(sx, -sy) }],
    });
  }
  // EDGES on ±x: K(sx,1) → arc C(-sx,1) → Vx → arc C(-sx,-1) → K(sx,-1) → cube edge x=sx → back.
  for (const sx of [1, -1] as const) {
    defs.push({
      kind: 'edge', pos: [sx, 0],
      verts: [K(sx, 1), Vx(sx), K(sx, -1)],
      segs: [{ c: C(-sx, 1) }, { c: C(-sx, -1) }, { axis: 0, coord: sx }],
    });
  }
  // EDGES on ±y: K(1,sy) → arc C(1,-sy) → Vy → arc C(-1,-sy) → K(-1,sy) → cube edge y=sy → back.
  for (const sy of [1, -1] as const) {
    defs.push({
      kind: 'edge', pos: [0, sy],
      verts: [K(1, sy), Vy(sy), K(-1, sy)],
      segs: [{ c: C(1, -sy) }, { c: C(-1, -sy) }, { axis: 1, coord: sy }],
    });
  }
  return { defs, d };
}

/** Build all 9 regions of a Rex face (1 centre + 4 petals + 4 edges), grooved + rounded. */
export function rexFaceRegions(S: number, groove: number, round = 0.07, seg = 16): RexRegion[] {
  const rho = Math.sqrt((S + 1) ** 2 + (S - 1) ** 2);
  const { defs } = rexFaceDefs(S);
  return defs.map((def) => ({ kind: def.kind, pos: def.pos, pts: buildOutline(def, rho, groove, round, seg) }));
}
