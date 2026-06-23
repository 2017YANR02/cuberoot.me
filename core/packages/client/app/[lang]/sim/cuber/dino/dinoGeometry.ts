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

/** Cube half-side (world units). Frames like a ~3x3 in the shared camera rig. */
export const H = Cubelet.SIZE * 2; // 128

/** Cut-plane offset as a fraction of H. 1.2 leaves a clean gap between pieces. */
export const CUT = 1.2;

/** Sticker lift above the body face (world units). */
const STICKER_LIFT = 1.2;
/** How far the colored triangle is inset from the body tetra's face edges. */
const STICKER_INSET = 0.1; // fraction toward the triangle centroid

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

  // Body: the solid tetra (4 verts, 4 triangular faces). BufferGeometry, all faces.
  const v = wedge.verts;
  const faces4 = tetraFaces(v);
  const pos: number[] = [];
  for (const [a, b, c] of faces4) {
    pos.push(v[a].x, v[a].y, v[a].z, v[b].x, v[b].y, v[b].z, v[c].x, v[c].y, v[c].z);
  }
  const bodyGeom = new THREE.BufferGeometry();
  bodyGeom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bodyGeom.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
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
    const sGeom = new THREE.BufferGeometry();
    sGeom.setAttribute('position', new THREE.Float32BufferAttribute(
      [sp[0].x, sp[0].y, sp[0].z, sp[1].x, sp[1].y, sp[1].z, sp[2].x, sp[2].y, sp[2].z], 3,
    ));
    sGeom.computeVertexNormals();
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

/** The 4 faces of a tetra (vertex-index triples), wound consistently outward. */
function tetraFaces(v: THREE.Vector3[]): Array<[number, number, number]> {
  // centroid for outward winding
  const c = new THREE.Vector3();
  for (const p of v) c.add(p);
  c.multiplyScalar(0.25);
  const combos: Array<[number, number, number]> = [
    [0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3],
  ];
  return combos.map(([a, b, d]) => {
    const ab = v[b].clone().sub(v[a]);
    const ad = v[d].clone().sub(v[a]);
    const n = ab.cross(ad);
    const outward = v[a].clone().sub(c);
    return (n.dot(outward) >= 0 ? [a, b, d] : [a, d, b]) as [number, number, number];
  });
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
