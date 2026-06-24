/**
 * Skewb geometry — pure three.js builders. No scene/camera concerns.
 *
 * Model (deep-cut corner-turning): a cube [-H,H]^3 cut by 4 planes through the
 * centre, each ⊥ a body diagonal. Pieces:
 *   - 8 corner pieces (keep a real cube corner; sticker = a corner TRIANGLE per face)
 *   - 6 centre pieces (square pyramid toward the core; sticker = a DIAMOND on its face)
 * Each piece = cube ∩ (4 cut half-spaces), with every cut offset by SEAM from the
 * centre on the piece's side. Zero-interpenetration: for a twist about diagonal n_k,
 * the moving cap (pieces with n_k·rep>0) all live in {n_k·v ≥ SEAM} and the stationary
 * pieces in {n_k·v ≤ −SEAM}; the rotation keeps n_k·v invariant, so a 2·SEAM gap stays
 * open across the cut plane the whole turn (true for all 8 grips — see skewbState orbits).
 *
 * Each piece pivot sits at the origin; its quaternion is the source of truth for the
 * piece's current pose (twists left-multiply R(axis, ±120°) via CornerTurnCube). Body
 * = one rounded convex mesh (black); stickers = raised rounded polygons with black side
 * walls (makeSticker), same soft-pillow look as the NxN / dino facelets.
 */
import * as THREE from 'three';
import { SIZE } from '../define';
import { CUBE_FILL } from '@/lib/cube-colors';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeSticker } from '../stickerGeom';
import { CORNER_AXIS, CENTER_AXIS } from './skewbState';

/** Cube half-side (world units) — frames like the other engine puzzles. */
export const H = SIZE * 2; // 128

/** Cut offset from centre along each diagonal (world units). Piece bodies stop SEAM
 *  short of the deep cut on their side → a 2·SEAM seam opens between moving/stationary
 *  caps on every turn (zero-interpenetration). */
export const SEAM = 3.2;

const STICKER_LIFT = 0.5;      // clear z-fight with the body face
const STICKER_DEPTH = 6;       // raised pillow thickness
const STICKER_INSET = 0.07;    // fraction toward the face-polygon centroid (black outline)
const STICKER_CORNER_R = 0.18; // rounded-corner radius, fraction of shortest edge
const BODY_ROUND = 8;          // body corner/edge round radius (world units)

const BODY_COLOR = 0x141414;

export const SKEWB_FACE_COLOR: Record<string, number> = {
  U: hex(CUBE_FILL.U), D: hex(CUBE_FILL.D), F: hex(CUBE_FILL.F),
  B: hex(CUBE_FILL.B), L: hex(CUBE_FILL.L), R: hex(CUBE_FILL.R),
};
function hex(s: string): number { return parseInt(s.replace('#', ''), 16); }

const FACE_NORMAL: Record<string, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1, 0), D: new THREE.Vector3(0, -1, 0),
  R: new THREE.Vector3(1, 0, 0), L: new THREE.Vector3(-1, 0, 0),
  F: new THREE.Vector3(0, 0, 1), B: new THREE.Vector3(0, 0, -1),
};
const FACE_LETTERS = ['U', 'D', 'F', 'B', 'R', 'L'] as const;

/** The 4 cut-plane unit normals (the 4 body diagonals; the other 4 corners are −these). */
const DIAGS: THREE.Vector3[] = [
  new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, -1),
  new THREE.Vector3(1, -1, 1), new THREE.Vector3(-1, 1, 1),
].map((v) => v.normalize());

interface Plane { n: THREE.Vector3; d: number; } // inside = n·v ≤ d

/** Bounding planes of the piece whose representative outward direction is `rep`
 *  (a corner or face-centre direction): 6 cube faces + 4 cut planes (offset by SEAM
 *  onto rep's side of each diagonal). All normals unit, so `d` is a true distance. */
function piecePlanes(rep: THREE.Vector3): Plane[] {
  const planes: Plane[] = FACE_LETTERS.map((f) => ({ n: FACE_NORMAL[f].clone(), d: H }));
  for (const diag of DIAGS) {
    const s = rep.dot(diag) > 0 ? 1 : -1; // which side of this cut the piece is on
    // piece is on {s·(diag·v) ≥ SEAM} ⟺ (−s·diag)·v ≤ −SEAM
    planes.push({ n: diag.clone().multiplyScalar(-s), d: -SEAM });
  }
  return planes;
}

function solve3(p: Plane, q: Plane, r: Plane): THREE.Vector3 | null {
  const A = [[p.n.x, p.n.y, p.n.z], [q.n.x, q.n.y, q.n.z], [r.n.x, r.n.y, r.n.z]];
  const b = [p.d, q.d, r.d];
  const det = (M: number[][]): number =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
    - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
    + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det(A);
  if (Math.abs(D) < 1e-9) return null;
  const col = (c: number): number[][] => A.map((row, i) => row.map((val, j) => (j === c ? b[i] : val)));
  return new THREE.Vector3(det(col(0)) / D, det(col(1)) / D, det(col(2)) / D);
}

/** Enumerate the polytope vertices of a set of half-spaces (triple-plane intersections
 *  kept iff feasible). */
function polytopeVerts(planes: Plane[]): THREE.Vector3[] {
  const EPS = 1e-4 * H;
  const feasible = (v: THREE.Vector3): boolean => planes.every((p) => p.n.dot(v) <= p.d + EPS);
  const verts: THREE.Vector3[] = [];
  for (let i = 0; i < planes.length; i++)
    for (let j = i + 1; j < planes.length; j++)
      for (let k = j + 1; k < planes.length; k++) {
        const v = solve3(planes[i], planes[j], planes[k]);
        if (v && feasible(v) && !verts.some((w) => w.distanceTo(v) < 1e-3)) verts.push(v);
      }
  return verts;
}

/** Evenly-spread unit directions on a sphere (Fibonacci lattice). */
function fibonacciSphere(n: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const t = ga * i;
    out.push(new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r));
  }
  return out;
}

/** A convex body with smoothly ROUNDED corners + edges = Minkowski opening of the
 *  polytope: push every bounding plane in by r, re-enumerate the eroded vertices,
 *  sphere-sample radius r around each, convex-hull, smooth normals. The opening ⊆ the
 *  original polytope, so zero-interpenetration is unaffected. (General version of the
 *  dino tetra rounding — works for the corner & centre polytopes alike.) */
function roundedBody(planes: Plane[]): THREE.BufferGeometry {
  const inner = planes.map((p) => ({ n: p.n, d: p.d - BODY_ROUND }));
  const ev = polytopeVerts(inner);
  const fib = fibonacciSphere(26);
  const pts: THREE.Vector3[] = [];
  for (const v of ev) for (const dir of fib) pts.push(v.clone().addScaledVector(dir, BODY_ROUND));
  let geom: THREE.BufferGeometry = new ConvexGeometry(pts);
  geom.deleteAttribute('normal');
  geom.deleteAttribute('uv');
  geom = mergeVertices(geom);
  geom.computeVertexNormals();
  return geom;
}

const bodyMat = new THREE.MeshPhongMaterial({
  color: BODY_COLOR, specular: 0x222222, shininess: 25, side: THREE.DoubleSide,
});
function stickerMat(color: number): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({ color, specular: 0x444444, shininess: 60, side: THREE.DoubleSide });
}

/** Order coplanar points CCW (right-handed wrt the face normal) around their centroid. */
function orderCCW(pts: THREE.Vector3[], normal: THREE.Vector3): THREE.Vector3[] {
  const n = normal.clone().normalize();
  const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
  const u = pts[0].clone().sub(c).normalize();
  const w = new THREE.Vector3().crossVectors(n, u).normalize();
  return pts.slice().sort((a, b) =>
    Math.atan2(a.clone().sub(c).dot(w), a.clone().sub(c).dot(u))
    - Math.atan2(b.clone().sub(c).dot(w), b.clone().sub(c).dot(u)));
}

/**
 * Rounded-corner polygon sticker through coplanar `pts` (ordered CCW, already inset +
 * lifted just outside the body face). Builds a 2D rounded outline (quadraticCurveTo at
 * each corner, like the NxN / dino stickers) in the face's in-plane basis, extrudes for
 * thickness, maps back to 3D. Works for triangles (corners) and the diamond (centres).
 */
function roundedPolySticker(pts: THREE.Vector3[], normal: THREE.Vector3): THREE.BufferGeometry {
  const N = pts.length;
  const n = normal.clone().normalize();
  const u = pts[1].clone().sub(pts[0]).normalize();
  const w = new THREE.Vector3().crossVectors(n, u).normalize();
  const origin = pts[0];
  const C = pts.map((p) => {
    const d = p.clone().sub(origin);
    return new THREE.Vector2(d.dot(u), d.dot(w));
  });
  let minEdge = Infinity;
  for (let i = 0; i < N; i++) minEdge = Math.min(minEdge, C[i].distanceTo(C[(i + 1) % N]));
  const r = minEdge * STICKER_CORNER_R;
  const trimA = (i: number): THREE.Vector2 =>
    C[i].clone().add(C[(i - 1 + N) % N].clone().sub(C[i]).normalize().multiplyScalar(r));
  const trimB = (i: number): THREE.Vector2 =>
    C[i].clone().add(C[(i + 1) % N].clone().sub(C[i]).normalize().multiplyScalar(r));
  const shape = new THREE.Shape();
  const b0 = trimB(0);
  shape.moveTo(b0.x, b0.y);
  for (let s = 1; s <= N; s++) {
    const i = s % N;
    const a = trimA(i), b = trimB(i);
    shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(C[i].x, C[i].y, b.x, b.y);
  }
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, { depth: STICKER_DEPTH, bevelEnabled: false, curveSegments: 8 });
  geom.applyMatrix4(new THREE.Matrix4().makeBasis(u, w, n).setPosition(origin));
  return geom;
}

export interface PieceBuild { pivot: THREE.Object3D; group: THREE.Group; }

/** Build one piece (corner or centre) at its home location: a rounded black body +
 *  one raised colored sticker per cube face it shows, parented to a pivot at the origin. */
function buildPiece(rep: THREE.Vector3, slotTag: { key: string; value: number }): PieceBuild {
  const planes = piecePlanes(rep);
  const verts = polytopeVerts(planes);
  const group = new THREE.Group();

  const bodyMesh = new THREE.Mesh(roundedBody(planes), bodyMat);
  bodyMesh.userData.simRole = 'body';
  group.add(bodyMesh);

  // For each cube face the piece touches, gather its verts → the visible sticker polygon.
  for (const f of FACE_LETTERS) {
    const nrm = FACE_NORMAL[f];
    const onFace = verts.filter((v) => Math.abs(v.dot(nrm) - H) < 0.5);
    if (onFace.length < 3) continue;
    const poly = orderCCW(onFace, nrm);
    const centroid = poly.reduce((a, p) => a.add(p.clone()), new THREE.Vector3()).multiplyScalar(1 / poly.length);
    const lift = nrm.clone().multiplyScalar(STICKER_LIFT);
    const sp = poly.map((p) => p.clone().lerp(centroid, STICKER_INSET).add(lift));
    const sGeom = roundedPolySticker(sp, nrm);
    group.add(makeSticker(sGeom, stickerMat(SKEWB_FACE_COLOR[f]), bodyMat, { skewbFace: f, simStickerNormal: nrm.clone() }));
  }

  const pivot = new THREE.Object3D();
  pivot.add(group);
  pivot.userData[slotTag.key] = slotTag.value;
  return { pivot, group };
}

/** Build corner piece `slot` (0..7). */
export function buildCornerMesh(slot: number): PieceBuild {
  const [x, y, z] = CORNER_AXIS[slot];
  return buildPiece(new THREE.Vector3(x, y, z).multiplyScalar(H), { key: 'skewbCorner', value: slot });
}

/** Build centre piece `slot` (0..5). */
export function buildCenterMesh(slot: number): PieceBuild {
  const [x, y, z] = CENTER_AXIS[slot];
  return buildPiece(new THREE.Vector3(x, y, z).multiplyScalar(H), { key: 'skewbCenter', value: slot });
}

/** Solid black inner core (rotation-invariant sphere) — backs the deep seams + stands
 *  in for the hidden ball mechanism. */
export function buildCore(): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(H * 0.5, 32, 24), bodyMat);
  mesh.userData.simRole = 'core';
  return mesh;
}

export { bodyMat as SKEWB_BODY_MAT };
