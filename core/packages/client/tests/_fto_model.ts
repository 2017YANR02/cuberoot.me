/**
 * Pure-TS twin of FtoCube's pure-geometric algorithm (no three.js) — for the geometry
 * regression + PG-bridge certification tests. Re-derives the octahedron cell enumeration
 * from the engine's FACE_NORMAL and turns pieces with the SAME rule FtoCube uses (rotate
 * the cap-side cells ±120° about the face normal). `solved` = every piece's quaternion is
 * the identity (strict — all pieces home AND oriented), which equals the PG group identity.
 */
import { FACE_NORMAL, type FtoMove } from '@/app/[lang]/sim/engine/fto/ftoState';

type V3 = [number, number, number];
const N = FACE_NORMAL as readonly V3[];
const R_IN = 1, CUT = R_IN / 3, TURN = (2 * Math.PI) / 3;

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

interface Plane { n: V3; d: number }
function solve3(p: Plane, q: Plane, r: Plane): V3 | null {
  const M = [p.n, q.n, r.n], b = [p.d, q.d, r.d];
  const det = (m: number[][]): number =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d0 = det(M as number[][]);
  if (Math.abs(d0) < 1e-9) return null;
  const col = (i: number): number[][] => (M as number[][]).map((row, k) => row.map((v, j) => (j === i ? b[k] : v)));
  return [det(col(0)) / d0, det(col(1)) / d0, det(col(2)) / d0];
}
function polytopeVerts(planes: Plane[]): V3[] {
  const EPS = 1e-6, out: V3[] = [];
  const feas = (v: V3): boolean => planes.every((p) => p.n[0] * v[0] + p.n[1] * v[1] + p.n[2] * v[2] <= p.d + EPS);
  for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) for (let k = j + 1; k < planes.length; k++) {
    const v = solve3(planes[i], planes[j], planes[k]);
    if (v && feas(v) && !out.some((w) => Math.hypot(w[0] - v[0], w[1] - v[1], w[2] - v[2]) < 1e-5)) out.push(v);
  }
  return out;
}
function has3dVolume(vs: V3[]): boolean {
  if (vs.length < 4) return false;
  const o = vs[0], m = vs.slice(1).map((v) => sub(v, o));
  for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) {
    const c = cross(m[i], m[j]);
    if (Math.hypot(...c) < 1e-4) continue;
    for (let k = 0; k < m.length; k++) if (Math.abs(dot(c, m[k])) > 1e-3) return true;
  }
  return false;
}
function facetArea(vs: V3[], f: number): number {
  const on = vs.filter((v) => Math.abs(dot(N[f], v) - R_IN) < 1e-4);
  if (on.length < 3) return 0;
  const c = on.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]] as V3, [0, 0, 0] as V3).map((x) => x / on.length) as V3;
  let u = cross(N[f], [0, 1, 0]); if (Math.hypot(...u) < 1e-3) u = cross(N[f], [1, 0, 0]);
  const ul = Math.hypot(...u); u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const w = cross(N[f], u);
  on.sort((a, b) => Math.atan2(dot(sub(a, c), w), dot(sub(a, c), u)) - Math.atan2(dot(sub(b, c), w), dot(sub(b, c), u)));
  let area = 0;
  for (let i = 0; i < on.length; i++) { const a = sub(on[i], c), b = sub(on[(i + 1) % on.length], c); area += Math.hypot(...cross(a, b)) / 2; }
  return area;
}
function cellPlanes(cap: number[]): Plane[] {
  const planes: Plane[] = [];
  for (let f = 0; f < 8; f++) planes.push({ n: N[f] as V3, d: R_IN });
  for (let f = 0; f < 8; f++) cap.includes(f)
    ? planes.push({ n: [-N[f][0], -N[f][1], -N[f][2]], d: -CUT })
    : planes.push({ n: N[f] as V3, d: CUT });
  return planes;
}

// quaternion (x,y,z,w)
type Q = [number, number, number, number];
function qAxis(axis: V3, angle: number): Q {
  const h = angle / 2, s = Math.sin(h);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)];
}
function qMul(a: Q, b: Q): Q {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
function qRot(q: Q, v: V3): V3 {
  const t: V3 = [2 * (q[1] * v[2] - q[2] * v[1]), 2 * (q[2] * v[0] - q[0] * v[2]), 2 * (q[0] * v[1] - q[1] * v[0])];
  return [v[0] + q[3] * t[0] + (q[1] * t[2] - q[2] * t[1]), v[1] + q[3] * t[1] + (q[2] * t[0] - q[0] * t[2]), v[2] + q[3] * t[2] + (q[0] * t[1] - q[1] * t[0])];
}
const qAngle = (q: Q): number => 2 * Math.acos(Math.min(1, Math.abs(q[3])));

export interface FtoPiece { cap: number[]; stickerFaces: number[]; home: V3; q: Q }

/** Enumerate all 51 cells (42 visible + 9 internal/core), home pose. */
export function enumerateCells(): FtoPiece[] {
  const out: FtoPiece[] = [];
  for (let mask = 0; mask < 256; mask++) {
    const cap: number[] = [];
    for (let f = 0; f < 8; f++) if (mask & (1 << f)) cap.push(f);
    const vs = polytopeVerts(cellPlanes(cap));
    if (!has3dVolume(vs)) continue;
    const center = vs.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]] as V3, [0, 0, 0] as V3).map((x) => x / vs.length) as V3;
    const stickerFaces = cap.filter((f) => facetArea(vs, f) > 1e-4);
    out.push({ cap, stickerFaces, home: center, q: [0, 0, 0, 1] });
  }
  return out;
}

export class FtoModel {
  pieces = enumerateCells();
  get visible(): FtoPiece[] { return this.pieces.filter((p) => p.stickerFaces.length > 0); }
  /** Pieces currently in face f's cap (live centre on the cap side). */
  capPieces(f: number): FtoPiece[] {
    return this.pieces.filter((p) => dot(N[f], qRot(p.q, p.home)) > CUT);
  }
  apply(m: FtoMove): void {
    const delta = qAxis(N[m.face] as V3, m.dir * TURN);
    for (const p of this.pieces) if (dot(N[m.face], qRot(p.q, p.home)) > CUT) p.q = qMul(delta, p.q);
  }
  applyAll(moves: FtoMove[]): void { for (const m of moves) this.apply(m); }
  reset(): void { for (const p of this.pieces) p.q = [0, 0, 0, 1]; }
  /** Strict solved: every piece home AND oriented (== PG group identity). */
  get solved(): boolean { return this.pieces.every((p) => qAngle(p.q) < 1e-3); }
  /** Minimum |n_f·centre − CUT| over (piece, face) — the cap-membership margin (must be ≫0
   *  so runtime membership is unambiguous). */
  minCutMargin(): number {
    let min = Infinity;
    for (const p of this.pieces) for (let f = 0; f < 8; f++) min = Math.min(min, Math.abs(dot(N[f], p.home) - CUT));
    return min;
  }
}
