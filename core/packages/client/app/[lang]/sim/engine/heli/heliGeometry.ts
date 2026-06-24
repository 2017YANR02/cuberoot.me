/**
 * Helicopter Cube geometry — pure three.js builders (planar cut → solid wedges, no CSG).
 *
 * Model (verified in .tmp/heli against cstimer poly3dlib, the solver's oracle): a cube
 * [-H,H]^3 cut by 12 planes, one per edge: for edge axis a (unit, = sum of the edge's
 * two face normals) the plane is  a·x = √0.5·H. A move twists everything on the cap side
 * (a·x ≥ √0.5·H) by 180° about a. Because that plane is ⊥ the rotation axis it is
 * invariant under the turn, so the cap region maps to itself → ZERO interpenetration
 * (proven for every piece across the turn in .tmp/heli/verify.mjs).
 *
 * Each of the 32 pieces (8 corners + 24 wings) is the convex cell  cube ∩ {12 edge
 * half-spaces} — cap side for the edges that move it, stationary side for the rest:
 *   • corner piece (at cube corner C): cap for the 3 edges meeting at C → a 5-vertex
 *     tent {C, 3 adjacent edge-midpoints, C/2}; shows 3 corner-triangle stickers.
 *   • wing piece (face triangle): cap for its 2 edges → a tetrahedron; shows 1 sticker.
 * The black body is the rounded (Minkowski-opened) cell; the colored stickers are raised
 * extruded rounded triangles on the cube faces. A fixed central core polytope fills the
 * middle so a 180° opening shows solid black, not void. Piece indices (corner 0..7, wing
 * 0..23) + facelet→face match lib/heli-solver, so solved shows each face one color.
 *
 * Each piece pivot sits at the origin; its quaternion is the source of truth for the
 * piece's current orientation (a twist left-multiplies R(edgeAxis, 180°)).
 */
import * as THREE from 'three';
import { SIZE } from '../define';
import { CUBE_FILL } from '@/lib/cube-colors';
import { HELI_CORNERS, HELI_FACE_OF } from '@/lib/heli-solver';
import { EDGE_AXIS, EDGE_MID } from './heliState';
import { roundedSolid, type Plane } from '../polytopeCut';
import { makeSticker } from '../stickerGeom';

/** Cube half-side (world units) — same scale as Dino so the shared camera frames it. */
export const H = SIZE * 2; // 128
/** Edge cut distance along the (unit) edge axis, in world units. */
const CUT = Math.SQRT1_2 * H; // √0.5 · H

// Sticker styling (world units / fractions), matched to the Dino pillow look.
const STICKER_LIFT = 0.6;     // raise above body face to clear z-fighting
const STICKER_DEPTH = 5;      // extruded thickness → raised "pillow"
const STICKER_INSET = 0.055;  // fraction toward the triangle centroid → black groove
const STICKER_CORNER_R = 0.14;// corner-round radius as a fraction of the shortest edge
const BODY_ROUND = 6;         // body corner/edge round radius (world units)

const BODY_COLOR = 0x141414;

const FACE_LETTER = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const FACE_UNIT: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], [-1, 0, 0], [0, 0, -1],
];
function hex(s: string): number { return parseInt(s.replace('#', ''), 16); }
/** WCA fill color (0xRRGGBB) per face index 0..5 = U R F D L B. */
const FACE_COLOR: number[] = FACE_LETTER.map((l) => hex(CUBE_FILL[l]));

/** Per-wing [faceIdx, edge1, edge2] — the wing's face + its 2 cap edges. Emitted from
 *  the poly3dlib extraction (.tmp/heli/emit.mjs), cross-checked against the extracted
 *  facelet triangles; depends on poly3dlib's facelet ordering so it's a table. */
export const WING_EDGES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [0, 0, 1], [0, 0, 3], [0, 2, 3], [1, 1, 5], [1, 1, 4], [1, 4, 9], [1, 5, 9],
  [2, 0, 4], [2, 0, 7], [2, 4, 8], [2, 7, 8], [3, 8, 9], [3, 8, 11], [3, 9, 10], [3, 10, 11],
  [4, 3, 7], [4, 3, 6], [4, 7, 11], [4, 6, 11], [5, 2, 5], [5, 2, 6], [5, 5, 10], [5, 6, 10],
];

/** Cube corner (world coords) of corner piece ci, derived from its 3 facelet faces. */
export const CORNER_POS: ReadonlyArray<THREE.Vector3> = HELI_CORNERS.map((fls) => {
  const p = new THREE.Vector3();
  for (const fl of fls) {
    const u = FACE_UNIT[HELI_FACE_OF[fl]];
    p.add(new THREE.Vector3(u[0], u[1], u[2]));
  }
  return p.multiplyScalar(H); // each axis is exactly ±1 → ±H
});

const _edgeAxisV = EDGE_AXIS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
const _edgeMidV = EDGE_MID.map(([x, y, z]) => new THREE.Vector3(x * H, y * H, z * H));

/** Unit twist axis (world) for edge e — used by the cube/drag for the 180° rotation. */
export function edgeAxisVec(e: number): THREE.Vector3 { return _edgeAxisV[e].clone(); }

// ── convex cell geometry (cube ∩ half-spaces) — polytope solver + Minkowski rounding
// shared in ../polytopeCut (also used by megaminx). ──────────────────────────────────
function bodyPlanes(capEdges: ReadonlyArray<number>): Plane[] {
  const planes: Plane[] = [
    { n: [1, 0, 0], d: H }, { n: [-1, 0, 0], d: H },
    { n: [0, 1, 0], d: H }, { n: [0, -1, 0], d: H },
    { n: [0, 0, 1], d: H }, { n: [0, 0, -1], d: H },
  ];
  for (let e = 0; e < 12; e++) {
    const [ax, ay, az] = EDGE_AXIS[e];
    if (capEdges.includes(e)) planes.push({ n: [-ax, -ay, -az], d: -CUT }); // a·x ≥ CUT
    else planes.push({ n: [ax, ay, az], d: CUT });                          // a·x ≤ CUT
  }
  return planes;
}

// ── materials ───────────────────────────────────────────────────────────────────────
const bodyMat = new THREE.MeshPhongMaterial({
  color: BODY_COLOR, specular: 0x222222, shininess: 25, side: THREE.DoubleSide,
});
const stickerMats: THREE.MeshPhongMaterial[] = FACE_COLOR.map((color) =>
  new THREE.MeshPhongMaterial({ color, specular: 0x444444, shininess: 60, side: THREE.DoubleSide }),
);

/**
 * Raised, rounded-corner, extruded triangle sticker through p0/p1/p2 on `normal`'s
 * face (already inset + lifted). Builds a 2D rounded-triangle Shape in the face's
 * in-plane basis (quadraticCurveTo corners, like the NxN/Dino stickers), extrudes for
 * a pillow, maps back to 3D.
 */
function triSticker(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, normal: THREE.Vector3): THREE.BufferGeometry {
  const n = normal.clone().normalize();
  const u = new THREE.Vector3().subVectors(p1, p0).normalize();
  const w = new THREE.Vector3().crossVectors(n, u).normalize();
  const origin = p0;
  const to2 = (p: THREE.Vector3): THREE.Vector2 => {
    const d = p.clone().sub(origin);
    return new THREE.Vector2(d.dot(u), d.dot(w));
  };
  const C = [to2(p0), to2(p1), to2(p2)];
  const minEdge = Math.min(C[0].distanceTo(C[1]), C[1].distanceTo(C[2]), C[2].distanceTo(C[0]));
  const r = minEdge * STICKER_CORNER_R;
  const trimA = (i: number): THREE.Vector2 => C[i].clone().add(C[(i + 2) % 3].clone().sub(C[i]).normalize().multiplyScalar(r));
  const trimB = (i: number): THREE.Vector2 => C[i].clone().add(C[(i + 1) % 3].clone().sub(C[i]).normalize().multiplyScalar(r));
  const shape = new THREE.Shape();
  const b0 = trimB(0);
  shape.moveTo(b0.x, b0.y);
  for (const i of [1, 2, 0]) {
    const a = trimA(i), b = trimB(i);
    shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(C[i].x, C[i].y, b.x, b.y);
  }
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, { depth: STICKER_DEPTH, bevelEnabled: false, curveSegments: 6 });
  geom.applyMatrix4(new THREE.Matrix4().makeBasis(u, w, n).setPosition(origin));
  return geom;
}

/** Build one colored triangle sticker mesh from its 3 cube-surface verts + face. */
function stickerMesh(tri: THREE.Vector3[], faceIdx: number): THREE.Mesh {
  const nrm = FACE_UNIT[faceIdx];
  const normal = new THREE.Vector3(nrm[0], nrm[1], nrm[2]);
  const centroid = new THREE.Vector3().add(tri[0]).add(tri[1]).add(tri[2]).multiplyScalar(1 / 3);
  const lift = normal.clone().multiplyScalar(STICKER_LIFT);
  const sp = tri.map((p) => p.clone().lerp(centroid, STICKER_INSET).add(lift));
  // black-walls invariant (caps colored, walls body-dark) → grazing-angle grooves stay visible.
  return makeSticker(triSticker(sp[0], sp[1], sp[2], normal), stickerMats[faceIdx], bodyMat, { simStickerNormal: normal.clone() });
}

export interface PieceBuild { pivot: THREE.Object3D; group: THREE.Group; }

/** The 3 edges meeting at cube corner C (world coords). */
function edgesAtCorner(C: THREE.Vector3): number[] {
  const s = [Math.sign(C.x), Math.sign(C.y), Math.sign(C.z)];
  const out: number[] = [];
  for (let e = 0; e < 12; e++) {
    const m = EDGE_MID[e];
    if ((m[0] === 0 || Math.sign(m[0]) === s[0]) &&
        (m[1] === 0 || Math.sign(m[1]) === s[1]) &&
        (m[2] === 0 || Math.sign(m[2]) === s[2])) out.push(e);
  }
  return out; // exactly the 3 edges adjacent to C
}

/** Build corner piece ci: rounded body + 3 corner-triangle stickers, parented to a
 *  pivot at the origin (home pose). */
export function buildCornerPiece(ci: number): PieceBuild {
  const C = CORNER_POS[ci];
  const group = new THREE.Group();
  const body = new THREE.Mesh(roundedSolid(bodyPlanes(edgesAtCorner(C)), BODY_ROUND), bodyMat);
  body.userData.simRole = 'body';
  group.add(body);
  // 3 stickers: one per shown face, triangle = {C, C with each in-face coord zeroed}.
  for (let k = 0; k < 3; k++) {
    const fl = HELI_CORNERS[ci][k];
    const faceIdx = HELI_FACE_OF[fl];
    const axis = faceIdx === 0 || faceIdx === 3 ? 1 : faceIdx === 1 || faceIdx === 4 ? 0 : 2; // face normal axis
    const inFace = [0, 1, 2].filter((a) => a !== axis);
    const m1 = C.clone(); m1.setComponent(inFace[0], 0);
    const m2 = C.clone(); m2.setComponent(inFace[1], 0);
    group.add(stickerMesh([C.clone(), m1, m2], faceIdx));
  }
  const pivot = new THREE.Object3D();
  pivot.add(group);
  pivot.userData.heliCorner = ci;
  return { pivot, group };
}

/** Build wing piece wi: rounded tetra body + 1 sticker {face-center, mid(e1), mid(e2)}. */
export function buildWingPiece(wi: number): PieceBuild {
  const [faceIdx, e1, e2] = WING_EDGES[wi];
  const group = new THREE.Group();
  const body = new THREE.Mesh(roundedSolid(bodyPlanes([e1, e2]), BODY_ROUND), bodyMat);
  body.userData.simRole = 'body';
  group.add(body);
  const fc = FACE_UNIT[faceIdx];
  const tri = [new THREE.Vector3(fc[0] * H, fc[1] * H, fc[2] * H), _edgeMidV[e1].clone(), _edgeMidV[e2].clone()];
  group.add(stickerMesh(tri, faceIdx));
  const pivot = new THREE.Object3D();
  pivot.add(group);
  pivot.userData.heliWing = wi;
  return { pivot, group };
}

/**
 * Fixed central core = the polytope cube ∩ {a·x ≤ √0.5·H for every edge} (rounded).
 * It is on the stationary side of every edge plane, so every 180° turn (which preserves
 * a·x) leaves it untouched → never interpenetrates a moving piece. Fills the middle so a
 * turn's opening reads as solid black, not void.
 */
export function buildCore(): THREE.Mesh {
  const mesh = new THREE.Mesh(roundedSolid(bodyPlanes([]), BODY_ROUND), bodyMat);
  mesh.userData.simRole = 'core';
  return mesh;
}

export { bodyMat as HELI_BODY_MAT };
