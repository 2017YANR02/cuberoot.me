/**
 * Dino Cube geometry — pure three.js builders. No scene/camera concerns.
 *
 * Model (verified in .tmp/dino): a cube [-H, H]^3. Each corner C ∈ {-1,1}^3 has a
 * flat cut plane  C·v = CUT·H  (the real Dino cut: "diagonally through the square
 * faces, cutting off triangular pyramidal corners"). Each EDGE piece is the convex
 * solid  cube ∩ {C1·v ≥ CUT·H} ∩ {C2·v ≥ CUT·H}  for its two end corners — which
 * works out to a TETRAHEDRON: two vertices on the cube edge it straddles, plus one
 * apex on each of the two faces it shows (the triangular sticker apex, near each
 * face center). CUT is chosen so the 12 wedges are disjoint (zero interpenetration:
 * a twist about C keeps every moving point's C·v invariant, so the moving pieces
 * never cross the cut plane into the fixed body — proven for all 8 corners across
 * the full turn in .tmp/dino/verify_v2.mjs).
 *
 * Each piece pivot sits at the origin; its quaternion is the source of truth for
 * the piece's current orientation (twists left-multiply R(axis, ±120°)). The cube
 * body (black) is one tetra mesh per piece; the two triangular stickers are thin
 * raised tris on the piece's two faces.
 */
import * as THREE from 'three';
import Cubelet from '../cubelet';
import { CUBE_FILL } from '@/lib/cube-colors';
import { EDGE_NAMES, type EdgeName } from './dinoState';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Cube half-side (world units). Frames like a ~3x3 in the shared camera rig. */
export const H = Cubelet.SIZE * 2; // 128

/** Cut-plane offset as a fraction of H. Zero-interpenetration requires CUT ≥ 1.0
 *  (moving pieces have C·v ≥ CUT·H; the stationary peak is (2−CUT)·H, so the two
 *  are disjoint iff CUT ≥ 1.0). The visible diagonal face "X" is the cut-off corner
 *  gap = (CUT−1)·H per edge end — 1.07 gives a thin Dino-like seam with a safe
 *  margin above 1.0; don't drop below ~1.03 or pieces visibly scrape on a turn. */
export const CUT = 1.07;

/** Sticker lift above the body face (world units) — just enough to clear z-fighting
 *  with the body's own face; the visible thickness comes from STICKER_DEPTH. */
const STICKER_LIFT = 0.5;
/** Extruded sticker thickness (world units) — gives the facelet a raised "pillow"
 *  like the NxN ExtrudeGeometry stickers, not a flat plane. */
const STICKER_DEPTH = 6;
/** How far the colored triangle is inset from the body tetra's face edges — just a
 *  thin black outline around each sticker. The big diagonal "X" is the CUT gap,
 *  not this; keep this small so adjacent stickers nearly meet. */
const STICKER_INSET = 0.04; // fraction toward the triangle centroid
/** Corner-rounding radius as a fraction of the triangle's shortest edge — gives the
 *  triangular facelets the same soft "pillow" look as the NxN rounded-square stickers
 *  (cubelet.ts `makeStickerShape`), instead of raw sharp points. */
const STICKER_CORNER_R = 0.16;
/** Body corner/edge ROUND radius (world units) — the sharp tetra is replaced by its
 *  rounded version (r-eroded tetra then dilated by a sphere of radius r), so a tilted
 *  piece shows a smooth rounded body in the opening, not a sharp spike or a flat
 *  chamfer facet. The rounding only removes material (opening ⊆ original tetra), so
 *  the cut-plane zero-interpenetration is unaffected. */
const BODY_ROUND = 9;

const BODY_COLOR = 0x141414;

/** Face letter → fill color (WCA). Dino shows 4 triangles per face, all one color
 *  in the solved state. */
export const DINO_FACE_COLOR: Record<string, number> = {
  U: hex(CUBE_FILL.U),
  D: hex(CUBE_FILL.D),
  F: hex(CUBE_FILL.F),
  B: hex(CUBE_FILL.B),
  L: hex(CUBE_FILL.L),
  R: hex(CUBE_FILL.R),
};

function hex(s: string): number {
  return parseInt(s.replace('#', ''), 16);
}

/** Unit body-diagonal axis for a corner sign-triple. */
export function cornerAxis(sx: number, sy: number, sz: number): THREE.Vector3 {
  return new THREE.Vector3(sx, sy, sz).normalize();
}

/** Face letter → outward unit normal. */
const FACE_NORMAL: Record<string, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
};

/** Edge name → its (x,y,z) sign vector with one zero coord (×H = its midpoint). */
function edgeVec(name: EdgeName): [number, number, number] {
  let x = 0, y = 0, z = 0;
  if (name.includes('U')) y = 1; if (name.includes('D')) y = -1;
  if (name.includes('R')) x = 1; if (name.includes('L')) x = -1;
  if (name.includes('F')) z = 1; if (name.includes('B')) z = -1;
  return [x, y, z];
}

/** The two corner sign-triples at the ends of an edge (the edge's zero coord = ±1). */
function edgeCorners(name: EdgeName): Array<[number, number, number]> {
  const [x, y, z] = edgeVec(name);
  const free = x === 0 ? 0 : y === 0 ? 1 : 2;
  const base: [number, number, number] = [x, y, z];
  const c1 = base.slice() as [number, number, number]; c1[free] = 1;
  const c2 = base.slice() as [number, number, number]; c2[free] = -1;
  return [c1, c2];
}

export interface WedgeGeom {
  /** The 4 tetra vertices in world coords (home pose). */
  verts: THREE.Vector3[];
  /** The two faces this edge shows (e.g. ['U','F'] for UF). */
  faces: [string, string];
  /** For each shown face, the 3 vertex indices (into verts) of its sticker triangle. */
  faceTris: [[number, number, number], [number, number, number]];
}

/**
 * Compute one edge wedge's tetrahedron analytically: intersect the cube with the
 * two corner cut planes and keep the vertices satisfying all constraints. Returns
 * the 4 verts and which of them lie on each of the two shown faces.
 */
export function wedgeGeometry(name: EdgeName): WedgeGeom {
  const corners = edgeCorners(name);
  const d = CUT * H;
  // Bounding planes as n·v ≤ rhs.
  const planes: Array<{ n: [number, number, number]; rhs: number }> = [
    { n: [1, 0, 0], rhs: H }, { n: [-1, 0, 0], rhs: H },
    { n: [0, 1, 0], rhs: H }, { n: [0, -1, 0], rhs: H },
    { n: [0, 0, 1], rhs: H }, { n: [0, 0, -1], rhs: H },
    { n: [-corners[0][0], -corners[0][1], -corners[0][2]], rhs: -d },
    { n: [-corners[1][0], -corners[1][1], -corners[1][2]], rhs: -d },
  ];
  const EPS = 1e-5;
  const feasible = (v: THREE.Vector3): boolean =>
    planes.every((p) => p.n[0] * v.x + p.n[1] * v.y + p.n[2] * v.z <= p.rhs + EPS);
  const verts: THREE.Vector3[] = [];
  for (let i = 0; i < planes.length; i++)
    for (let j = i + 1; j < planes.length; j++)
      for (let k = j + 1; k < planes.length; k++) {
        const v = solve3(planes[i], planes[j], planes[k]);
        if (!v) continue;
        if (feasible(v) && !verts.some((w) => w.distanceTo(v) < 1e-4)) verts.push(v);
      }
  // The two shown faces (e.g. UF → U, F).
  const facesArr: string[] = [];
  if (name.includes('U')) facesArr.push('U'); if (name.includes('D')) facesArr.push('D');
  if (name.includes('R')) facesArr.push('R'); if (name.includes('L')) facesArr.push('L');
  if (name.includes('F')) facesArr.push('F'); if (name.includes('B')) facesArr.push('B');
  const faces: [string, string] = [facesArr[0], facesArr[1]];

  const triFor = (face: string): [number, number, number] => {
    const nrm = FACE_NORMAL[face];
    const idx: number[] = [];
    verts.forEach((v, i) => {
      // on the face plane v·normal == H
      if (Math.abs(v.dot(nrm) - H) < 1e-3) idx.push(i);
    });
    return [idx[0], idx[1], idx[2]];
  };
  const faceTris: [[number, number, number], [number, number, number]] = [
    triFor(faces[0]), triFor(faces[1]),
  ];
  return { verts, faces, faceTris };
}

function solve3(
  p: { n: [number, number, number]; rhs: number },
  q: { n: [number, number, number]; rhs: number },
  r: { n: [number, number, number]; rhs: number },
): THREE.Vector3 | null {
  const A = [p.n, q.n, r.n];
  const b = [p.rhs, q.rhs, r.rhs];
  const det = (M: number[][]): number =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
    - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
    + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det(A);
  if (Math.abs(D) < 1e-9) return null;
  const Ax = [[b[0], A[0][1], A[0][2]], [b[1], A[1][1], A[1][2]], [b[2], A[2][1], A[2][2]]];
  const Ay = [[A[0][0], b[0], A[0][2]], [A[1][0], b[1], A[1][2]], [A[2][0], b[2], A[2][2]]];
  const Az = [[A[0][0], A[0][1], b[0]], [A[1][0], A[1][1], b[1]], [A[2][0], A[2][1], b[2]]];
  return new THREE.Vector3(det(Ax) / D, det(Ay) / D, det(Az) / D);
}

const bodyMat = new THREE.MeshPhongMaterial({
  color: BODY_COLOR, specular: 0x222222, shininess: 25, side: THREE.DoubleSide,
});

function stickerMat(color: number): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({
    color, specular: 0x444444, shininess: 60, side: THREE.DoubleSide,
  });
}

/**
 * Rounded-corner triangle sticker on the plane through p0/p1/p2 (already inset +
 * lifted, so coplanar just outside the body face). Builds a 2D rounded-triangle
 * Shape (`quadraticCurveTo` at each corner, like the NxN `makeStickerShape`) in the
 * face's in-plane basis, then maps it back to 3D — so dino facelets get the same
 * soft pillow corners as the NxN stickers instead of sharp points.
 */
function roundedTriSticker(
  p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, normal: THREE.Vector3,
): THREE.BufferGeometry {
  const n = normal.clone().normalize();
  const u = new THREE.Vector3().subVectors(p1, p0).normalize();
  const w = new THREE.Vector3().crossVectors(n, u).normalize(); // in-plane, ⊥ u
  const origin = p0;
  const to2 = (p: THREE.Vector3): THREE.Vector2 => {
    const d = p.clone().sub(origin);
    return new THREE.Vector2(d.dot(u), d.dot(w));
  };
  const C = [to2(p0), to2(p1), to2(p2)];
  const minEdge = Math.min(C[0].distanceTo(C[1]), C[1].distanceTo(C[2]), C[2].distanceTo(C[0]));
  const r = minEdge * STICKER_CORNER_R;
  // trimA = point on the edge entering corner i (from i−1); trimB = leaving (to i+1).
  const trimA = (i: number): THREE.Vector2 =>
    C[i].clone().add(C[(i + 2) % 3].clone().sub(C[i]).normalize().multiplyScalar(r));
  const trimB = (i: number): THREE.Vector2 =>
    C[i].clone().add(C[(i + 1) % 3].clone().sub(C[i]).normalize().multiplyScalar(r));
  const shape = new THREE.Shape();
  const b0 = trimB(0);
  shape.moveTo(b0.x, b0.y);
  for (const i of [1, 2, 0]) {
    const a = trimA(i), b = trimB(i);
    shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(C[i].x, C[i].y, b.x, b.y);
  }
  shape.closePath();
  // Extrude for a raised pillow (matches NxN); the shape's z=0 face sits at the
  // (lifted) body plane and the colored top is STICKER_DEPTH outward along n.
  const geom = new THREE.ExtrudeGeometry(shape, { depth: STICKER_DEPTH, bevelEnabled: false, curveSegments: 8 });
  geom.applyMatrix4(new THREE.Matrix4().makeBasis(u, w, n).setPosition(origin));
  return geom;
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

/**
 * A tetra body with smoothly ROUNDED corners + edges (not a flat chamfer). Builds
 * the rounded solid as the Minkowski sum of the r-eroded tetra with a sphere of
 * radius r: erode each face inward by r → 4 eroded verts, sphere-sample radius r
 * around each, convex-hull, then smooth normals. Morphological opening ⊆ the original
 * tetra, so it stays inside the wedge (zero-interpenetration unaffected).
 */
function roundedTetraBody(v: THREE.Vector3[]): THREE.BufferGeometry {
  // 4 outward face planes (n·x = d, inside = n·x ≤ d); face k is opposite vertex k.
  const faceVerts: Array<[number, number, number]> = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]];
  const planes = faceVerts.map(([a, b, cc], k) => {
    let n = new THREE.Vector3().subVectors(v[b], v[a]).cross(new THREE.Vector3().subVectors(v[cc], v[a])).normalize();
    let d = n.dot(v[a]);
    if (n.dot(v[k]) > d) { n = n.negate(); d = -d; } // orient so the opposite vertex is inside
    return { n, d };
  });
  const fib = fibonacciSphere(28);
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 4; k++) {
    // eroded vertex k = intersection of the 3 faces adjacent to vertex k, each pushed in by r
    const adj = [0, 1, 2, 3].filter((m) => m !== k);
    const ev = solve3(
      { n: [planes[adj[0]].n.x, planes[adj[0]].n.y, planes[adj[0]].n.z], rhs: planes[adj[0]].d - BODY_ROUND },
      { n: [planes[adj[1]].n.x, planes[adj[1]].n.y, planes[adj[1]].n.z], rhs: planes[adj[1]].d - BODY_ROUND },
      { n: [planes[adj[2]].n.x, planes[adj[2]].n.y, planes[adj[2]].n.z], rhs: planes[adj[2]].d - BODY_ROUND },
    );
    if (!ev) continue;
    for (const d of fib) pts.push(ev.clone().addScaledVector(d, BODY_ROUND));
  }
  let geom: THREE.BufferGeometry = new ConvexGeometry(pts);
  geom.deleteAttribute('normal');
  geom.deleteAttribute('uv');
  geom = mergeVertices(geom);
  geom.computeVertexNormals(); // smooth (averaged) normals → reads as a rounded surface
  return geom;
}

export interface PieceBuild {
  pivot: THREE.Object3D;
  group: THREE.Group;
}

/**
 * Build one edge piece (slot index `slot`): a black tetra body + two raised
 * colored triangular stickers, all parented to a pivot at the origin. The piece
 * geometry is in absolute world coords (home pose); the pivot's quaternion (set
 * later by the cube) rotates the whole piece about the origin = about a corner's
 * body diagonal.
 */
export function buildPieceMesh(slot: number): PieceBuild {
  const name = EDGE_NAMES[slot];
  const wedge = wedgeGeometry(name);
  const group = new THREE.Group();

  // Body: a ROUNDED tetra (see roundedTetraBody) — smooth rounded corners + edges so
  // a tilted piece shows a soft body in the opening, not a sharp spike. The rounded
  // solid is a subset of the wedge, so zero-interpenetration still holds.
  const v = wedge.verts;
  const bodyMesh = new THREE.Mesh(roundedTetraBody(v), bodyMat);
  bodyMesh.userData.simRole = 'body';
  group.add(bodyMesh);

  // Stickers: one raised triangle per shown face, inset toward its centroid, lifted
  // along the face normal so it sits just above the body.
  for (let f = 0; f < 2; f++) {
    const face = wedge.faces[f];
    const tri = wedge.faceTris[f];
    const p0 = v[tri[0]], p1 = v[tri[1]], p2 = v[tri[2]];
    const cx = (p0.x + p1.x + p2.x) / 3, cy = (p0.y + p1.y + p2.y) / 3, cz = (p0.z + p1.z + p2.z) / 3;
    const centroid = new THREE.Vector3(cx, cy, cz);
    const lift = FACE_NORMAL[face].clone().multiplyScalar(STICKER_LIFT);
    const inset = (p: THREE.Vector3): THREE.Vector3 =>
      p.clone().lerp(centroid, STICKER_INSET).add(lift);
    const sp = [inset(p0), inset(p1), inset(p2)];
    const sGeom = roundedTriSticker(sp[0], sp[1], sp[2], FACE_NORMAL[face]);
    const sMesh = new THREE.Mesh(sGeom, stickerMat(DINO_FACE_COLOR[face]));
    sMesh.userData.simRole = 'sticker';
    sMesh.userData.dinoFace = face;
    group.add(sMesh);
  }

  const pivot = new THREE.Object3D();
  pivot.add(group);
  pivot.userData.dinoSlot = slot;
  return { pivot, group };
}

/**
 * Build the solid black inner core: a SPHERE centered at the origin.
 *
 * A sphere is invariant under every rotation, so it can never interpenetrate a
 * moving wedge regardless of which corner is turned (constructive zero
 * interpenetration for the core, same idea as the cut planes for the wedges).
 * Radius < H keeps it inside the cube silhouette; it shows black through the
 * inter-piece grooves (and stands in for the puzzle's hidden corner mechanism,
 * which the literature describes as "fixed to the core"). This replaces explicit
 * corner-cap solids — those would be the cube's corner pyramids MINUS the wedges,
 * a non-convex shape that, modeled naively as C·v ≥ CUT·H, would instead CONTAIN
 * the wedges and overlap them.
 */
export function buildCore(): THREE.Mesh {
  const geom = new THREE.SphereGeometry(H * 0.92, 32, 24);
  const mesh = new THREE.Mesh(geom, bodyMat);
  mesh.userData.simRole = 'core';
  return mesh;
}

export { bodyMat as DINO_BODY_MAT };
