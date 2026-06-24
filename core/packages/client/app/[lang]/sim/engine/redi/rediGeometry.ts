/**
 * Redi Cube geometry — pure three.js builders. No scene/camera concerns.
 *
 * Face pattern (the real Redi, verified against the cubing.js redi_cube net + the
 * grubiks render): each face is a 3×3 grid of SQUARES — 4 corner squares + 4 edge
 * squares — and the centre cell is split by an X into 4 triangles, each belonging
 * to the adjacent edge piece. So per face = 4 corner stickers (squares) + 4 edge
 * stickers (pentagons = an edge square + a triangular "roof" reaching the face
 * centre); the 4 roofs meet at the centre. There is NO centre piece.
 *
 * 3D model (GRID = the corner third, faces at ±H):
 *  - CORNER (8): a rounded cubie occupying [±GRID, ±H]^3 near its vertex — 3 square
 *    stickers, one per adjacent face. Its body diagonal is the cube's body diagonal
 *    through the origin, so a ±120° twist about that axis maps the cubie to itself
 *    (the 3 stickers cycle) — it twists in place.
 *  - EDGE (12): a rounded "tent" spanning the middle third of its cube edge — the
 *    convex hull of its two pentagon stickers (one per adjacent face, each = the
 *    edge square + a roof to the face centre). Cycled in ±120° 3-cycles by its two
 *    end corners (the Dino edge behaviour).
 *  - CORE: a small black sphere filling the hidden centre (rotation-invariant, never
 *    interpenetrates a moving cap), shown only through the thin inter-piece grooves.
 *
 * Note on turning: unlike the Dino's planar diagonal cut, the square Redi faces are
 * not bounded by a single rotation-invariant plane, so a corner turn lifts its cap
 * (corner + 3 edges) outward and rotates it — exactly like a real Redi where the
 * pieces rise off the surface mid-turn. Small inter-piece gaps (sticker inset +
 * rounded, slightly-shrunk bodies) keep that motion clean.
 *
 * Every piece pivot sits at the origin; its quaternion is the source of truth for
 * orientation (twists left-multiply R(axis, ±120°)).
 */
import * as THREE from 'three';
import { SIZE } from '../define';
import { CUBE_FILL } from '@/lib/cube-colors';
import { EDGE_NAMES, CORNER_AXIS, type EdgeName } from './rediState';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeSticker } from '../stickerGeom';

/** Cube half-side (world units). Frames like a ~3x3 in the shared camera rig. */
export const H = SIZE * 2; // 128

/** Grid line position (the corner third): corner squares span [GRID, H], edge
 *  squares span [−GRID, GRID], the centre cell is [−GRID, GRID]². H/3 gives the
 *  even 3×3 look of the real Redi. */
const GRID = H / 3;

/** Sticker lift above the body face — just clears z-fighting; visible thickness
 *  comes from STICKER_DEPTH. */
const STICKER_LIFT = 0.5;
/** Extruded sticker thickness — a raised pillow like the NxN stickers. */
const STICKER_DEPTH = 6;
/** Inset of the colored polygon from the piece face edges (fraction toward the
 *  facelet centroid) — the thin black groove between pieces (the cut lines + X). */
const STICKER_INSET = 0.07;
/** Corner-rounding radius as a fraction of the facelet's shortest edge. */
const STICKER_CORNER_R = 0.16;
/** Body round radius (world units): bodies are the Minkowski-opening of their
 *  vertex hull (erode toward centroid by r, dilate by an r-sphere), giving smooth
 *  rounded pieces that also leave a small gap so a lifted cap reads cleanly. */
const BODY_ROUND = 7;

const BODY_COLOR = 0x141414;

/** Face letter → fill color (WCA). */
export const REDI_FACE_COLOR: Record<string, number> = {
  U: hex(CUBE_FILL.U), D: hex(CUBE_FILL.D), F: hex(CUBE_FILL.F),
  B: hex(CUBE_FILL.B), L: hex(CUBE_FILL.L), R: hex(CUBE_FILL.R),
};

function hex(s: string): number { return parseInt(s.replace('#', ''), 16); }

/** Unit body-diagonal axis for a corner sign-triple. */
export function cornerAxis(sx: number, sy: number, sz: number): THREE.Vector3 {
  return new THREE.Vector3(sx, sy, sz).normalize();
}

/** Face letter → outward unit normal. */
const FACE_NORMAL: Record<string, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1, 0), D: new THREE.Vector3(0, -1, 0),
  R: new THREE.Vector3(1, 0, 0), L: new THREE.Vector3(-1, 0, 0),
  F: new THREE.Vector3(0, 0, 1), B: new THREE.Vector3(0, 0, -1),
};

// axis index: x=0 (R/L), y=1 (U/D), z=2 (F/B)
const AXIS_OF: Record<string, number> = { R: 0, L: 0, U: 1, D: 1, F: 2, B: 2 };
const SIGN_OF: Record<string, number> = { R: 1, U: 1, F: 1, L: -1, D: -1, B: -1 };
const FACE_LETTER = [['L', 'R'], ['D', 'U'], ['B', 'F']]; // [axis][sign<0?0:1]

function faceLetter(axis: number, sign: number): string {
  return FACE_LETTER[axis][sign > 0 ? 1 : 0];
}

/** Build a Vector3 from per-axis values. */
function vec(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

// ---------------------------------------------------------------------------
// Rounded body + sticker helpers (shared by corner + edge)
// ---------------------------------------------------------------------------

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
 * Black body with smoothly ROUNDED corners + edges: the Minkowski opening of the
 * convex hull of `verts`. Erode each vertex toward the centroid by r, sphere-sample
 * radius r around each, convex-hull, then smooth normals. The opening ⊆ the original
 * hull, so the body sits just inside its sticker silhouette (a thin black groove).
 */
function roundedBody(verts: THREE.Vector3[]): THREE.BufferGeometry {
  const c = new THREE.Vector3();
  for (const v of verts) c.add(v);
  c.multiplyScalar(1 / verts.length);
  const fib = fibonacciSphere(24);
  const pts: THREE.Vector3[] = [];
  for (const v of verts) {
    const toC = c.clone().sub(v);
    const d = Math.min(BODY_ROUND, toC.length() * 0.45);
    const ev = v.clone().add(toC.setLength(d));
    for (const dir of fib) pts.push(ev.clone().addScaledVector(dir, BODY_ROUND));
  }
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
  return new THREE.MeshPhongMaterial({
    color, specular: 0x444444, shininess: 60, side: THREE.DoubleSide,
  });
}

/**
 * Rounded-corner N-gon sticker on the plane through the given coplanar verts
 * (ordered around their boundary). Builds a 2D rounded polygon Shape
 * (`quadraticCurveTo` at each corner like the NxN makeStickerShape), extrudes it
 * for a raised pillow, and maps back to 3D.
 */
function roundedPolySticker(pts: THREE.Vector3[], normal: THREE.Vector3): THREE.BufferGeometry {
  const n = normal.clone().normalize();
  const origin = pts[0];
  const u = new THREE.Vector3().subVectors(pts[1], pts[0]).normalize();
  const w = new THREE.Vector3().crossVectors(n, u).normalize();
  const to2 = (p: THREE.Vector3): THREE.Vector2 => {
    const d = p.clone().sub(origin);
    return new THREE.Vector2(d.dot(u), d.dot(w));
  };
  const C = pts.map(to2);
  const N = C.length;
  let minEdge = Infinity;
  for (let i = 0; i < N; i++) minEdge = Math.min(minEdge, C[i].distanceTo(C[(i + 1) % N]));
  const r = minEdge * STICKER_CORNER_R;
  const trimA = (i: number): THREE.Vector2 =>
    C[i].clone().add(C[(i + N - 1) % N].clone().sub(C[i]).normalize().multiplyScalar(r));
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

/** Build a colored sticker mesh from an ordered face polygon (inset toward its
 *  centroid + lifted along the face normal so it sits just above the body). */
function buildSticker(poly: THREE.Vector3[], face: string): THREE.Mesh {
  const centroid = new THREE.Vector3();
  for (const v of poly) centroid.add(v);
  centroid.multiplyScalar(1 / poly.length);
  const lift = FACE_NORMAL[face].clone().multiplyScalar(STICKER_LIFT);
  const inset = poly.map((p) => p.clone().lerp(centroid, STICKER_INSET).add(lift));
  // makeSticker bakes in the black-walls invariant (caps colored, side walls body-dark)
  // so grazing-angle grooves stay visible — see stickerGeom.ts / sim-add-puzzle skill.
  return makeSticker(roundedPolySticker(inset, FACE_NORMAL[face]), stickerMat(REDI_FACE_COLOR[face]), bodyMat, { rediFace: face });
}

export interface PieceBuild {
  pivot: THREE.Object3D;
  group: THREE.Group;
}

// ---------------------------------------------------------------------------
// Corner piece: a rounded cubie with 3 square stickers
// ---------------------------------------------------------------------------

/**
 * Build one corner piece (corner index): a rounded cubie near its vertex with 3
 * square stickers. The cubie spans [s·GRID, s·H] on each axis (s = the axis sign),
 * so its body diagonal is the cube's body diagonal through the origin and a ±120°
 * twist about it cycles the 3 stickers in place.
 */
export function buildCornerMesh(corner: number): PieceBuild {
  const s = CORNER_AXIS[corner];
  // box [lo,hi] per axis (lo/hi ordered so lo < hi)
  const lo = [0, 1, 2].map((i) => (s[i] > 0 ? GRID : -H));
  const hi = [0, 1, 2].map((i) => (s[i] > 0 ? H : -GRID));
  const verts: THREE.Vector3[] = [];
  for (const ax of [lo[0], hi[0]]) for (const ay of [lo[1], hi[1]]) for (const az of [lo[2], hi[2]])
    verts.push(vec(ax, ay, az));

  const group = new THREE.Group();
  const body = new THREE.Mesh(roundedBody(verts), bodyMat);
  body.userData.simRole = 'body';
  group.add(body);

  // 3 square stickers, one per outer face (coord == s[axis]·H).
  for (let axis = 0; axis < 3; axis++) {
    const face = faceLetter(axis, s[axis]);
    const onFace = verts.filter((v) => Math.abs(v.getComponent(axis) - s[axis] * H) < 1e-6);
    group.add(buildSticker(orderInPlane(onFace, FACE_NORMAL[face]), face));
  }

  const pivot = new THREE.Object3D();
  pivot.add(group);
  pivot.userData.rediCornerId = corner;
  return { pivot, group };
}

/** Order coplanar verts CCW around their centroid in the face plane. */
function orderInPlane(pts: THREE.Vector3[], normal: THREE.Vector3): THREE.Vector3[] {
  const c = new THREE.Vector3();
  for (const v of pts) c.add(v);
  c.multiplyScalar(1 / pts.length);
  const u = new THREE.Vector3().subVectors(pts[0], c).normalize();
  const w = new THREE.Vector3().crossVectors(normal, u).normalize();
  return pts.slice().sort((a, b) =>
    Math.atan2(a.clone().sub(c).dot(w), a.clone().sub(c).dot(u))
    - Math.atan2(b.clone().sub(c).dot(w), b.clone().sub(c).dot(u)));
}

// ---------------------------------------------------------------------------
// Edge piece: a rounded tent with 2 pentagon stickers
// ---------------------------------------------------------------------------

/** The two faces an edge shows + its free (running) axis, from its name. */
function edgeAxes(name: EdgeName): { fa: number; fs: number; ga: number; gs: number; free: number } {
  const fs1 = name[0], fs2 = name[1];
  const a1 = AXIS_OF[fs1], a2 = AXIS_OF[fs2];
  const free = [0, 1, 2].find((a) => a !== a1 && a !== a2)!;
  return { fa: a1, fs: SIGN_OF[fs1], ga: a2, gs: SIGN_OF[fs2], free };
}

/** Make a 3D point by setting each axis value. */
function ptOn(faceAxis: number, faceVal: number, otherAxis: number, otherVal: number, freeAxis: number, freeVal: number): THREE.Vector3 {
  const c = [0, 0, 0];
  c[faceAxis] = faceVal; c[otherAxis] = otherVal; c[freeAxis] = freeVal;
  return vec(c[0], c[1], c[2]);
}

/**
 * One face's pentagon (5 ordered verts): the edge square [−GRID,GRID]×[GRID,H] on
 * this face plus a roof to the face centre. `fa/fs` = this face's axis/sign, `ga/gs`
 * = the OTHER shown face's axis/sign (the in-plane "depth" direction), `free` = the
 * edge's running axis.
 */
function edgePentagon(fa: number, fs: number, ga: number, gs: number, free: number): THREE.Vector3[] {
  return [
    ptOn(fa, fs * H, ga, gs * H, free, -GRID), // edge corner, left
    ptOn(fa, fs * H, ga, gs * H, free, GRID),  // edge corner, right
    ptOn(fa, fs * H, ga, gs * GRID, free, GRID), // inner right
    ptOn(fa, fs * H, ga, 0, free, 0),          // roof tip = face centre
    ptOn(fa, fs * H, ga, gs * GRID, free, -GRID), // inner left
  ];
}

/**
 * Build one edge piece (slot index): a rounded tent (convex hull of its two pentagon
 * stickers) with the 2 pentagon stickers raised on the two faces.
 */
export function buildEdgeMesh(slot: number): PieceBuild {
  const name = EDGE_NAMES[slot];
  const { fa, fs, ga, gs, free } = edgeAxes(name);
  const pentP = edgePentagon(fa, fs, ga, gs, free); // on face (fa,fs)
  const pentQ = edgePentagon(ga, gs, fa, fs, free); // on face (ga,gs)

  const group = new THREE.Group();
  const body = new THREE.Mesh(roundedBody([...pentP, ...pentQ]), bodyMat);
  body.userData.simRole = 'body';
  group.add(body);

  group.add(buildSticker(pentP, faceLetter(fa, fs)));
  group.add(buildSticker(pentQ, faceLetter(ga, gs)));

  const pivot = new THREE.Object3D();
  pivot.add(group);
  pivot.userData.rediEdgeSlot = slot;
  return { pivot, group };
}

/**
 * Solid black core sphere: invariant under every rotation, so it never
 * interpenetrates a moving cap. Fills the hidden centre and shows black only
 * through the thin inter-piece grooves (a Redi has no centre piece).
 */
export function buildCore(): THREE.Mesh {
  const geom = new THREE.SphereGeometry(GRID * 1.35, 32, 24);
  const mesh = new THREE.Mesh(geom, bodyMat);
  mesh.userData.simRole = 'core';
  return mesh;
}

export { bodyMat as REDI_BODY_MAT };
