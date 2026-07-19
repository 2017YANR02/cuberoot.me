/**
 * Pyraminx geometry — pure three.js builders, no scene/camera concerns.
 *
 * Model: a regular tetrahedron whose 4 vertices are the cube corners with an even
 * number of minus signs — V0=(1,1,1), V1=(1,-1,-1), V2=(-1,1,-1), V3=(-1,-1,1),
 * scaled by PYRA_A. For each vertex axis the cut coord t_k = V_k·x runs from -A (the
 * opposite face) to 3A (the vertex). Two cuts per axis at t_k = A/3 (the corner/turn
 * cut) and 5A/3 (the tip cut) — exactly the depths in cubing.js's pyraminx def
 * `t v 0.333 v 1.667` (PG's `v` param = t_k with this unit-cube tetra). The convex
 * cells:
 *   • tip k    = tetra ∩ {t_k ≥ 5A/3}                       (4, 3 stickers each)
 *   • corner k = tetra ∩ {A/3 ≤ t_k ≤ 5A/3} ∩ {t_j ≤ A/3 ∀ j≠k}   (4, 3 stickers)
 *   • edge k,j = tetra ∩ {t_k,t_j ≥ A/3} ∩ {t_k,t_j ≤ 5A/3} ∩ {t_l ≤ A/3 (others)} (6, 2 stickers)
 * 14 pieces, 36 facelets = 4 faces × 9 (verified offline in scratchpad/pyra_cells.mjs:
 * every facelet comes out a triangle, so we reuse dino's rounded-triangle stickers).
 *
 * Like dino, each piece is a pivot at the origin; the pivot's quaternion is the
 * source of truth for orientation (a turn left-multiplies R(vertexAxis, ±120°)).
 * Planar cuts ⊥ the vertex axes are invariant under that turn ⇒ constructive zero
 * interpenetration (moving pieces keep t_k ≥ A/3, the fixed body stays t_k ≤ A/3).
 */
import * as THREE from 'three';
import { SIZE } from '../define';
import { CUBE_FILL } from '@/lib/cube-colors';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeSticker } from '../stickerGeom';

/** Tetra circumradius-ish scale (world units); frames like a ~3x3 in the shared rig. */
export const PYRA_A = SIZE * 1.5;

const TIP_CUT = (5 / 3) * PYRA_A;
const COR_CUT = (1 / 3) * PYRA_A;
const FACE_T = -PYRA_A; // tetra face plane: V_m·x = -A

/** The 4 vertex directions (unnormalized, |V|²=3). */
export const VDIR: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
];

/** The 6 edges as vertex-index pairs, in a fixed slot order 0..5. */
export const EDGE_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
];

/** Face m (opposite vertex m) → fill color, WCA-consistent with the vertex letters
 *  U/L/R/B (face X touches every vertex except its opposite): D↔U yellow, R↔L red,
 *  L↔R blue, F↔B green — the standard scheme (green front, red right, blue left,
 *  yellow down in the default pose). CUBE_FILL keys are cube faces, reused for hue. */
const FACE_COLOR: Record<number, number> = {
  0: hex(CUBE_FILL.D), // D face (opp U) yellow
  1: hex(CUBE_FILL.R), // R face (opp L) red
  2: hex(CUBE_FILL.B), // L face (opp R) blue
  3: hex(CUBE_FILL.F), // F face (opp B) green
};

function hex(s: string): number { return parseInt(s.replace('#', ''), 16); }

/** Display rotation: bring V0=(1,1,1) to +Y (apex up), then yaw +135° about Y so the
 *  U-R edge faces the camera — R vertex front, L back-left, B back-right (azimuths
 *  0°/−120°/+120°, exact). The visible faces are then F {U,L,R} (green) front-left and
 *  R {U,R,B} (red) front-right: the standard pyraminx pose, matching the WCA holding
 *  the vertex letters imply. Applied to the whole cube group, not the pieces. */
export const APEX_UP_QUAT = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(0, 1, 0), 3 * Math.PI / 4)
  .multiply(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 1, 1).normalize(), new THREE.Vector3(0, 1, 0),
  ));

/** Unit twist axis for vertex k. */
export function vertexAxis(k: number): THREE.Vector3 {
  return new THREE.Vector3(...VDIR[k]).normalize();
}

const STICKER_LIFT = 0.2;
const STICKER_DEPTH = 1.5;
/** Absolute inset (world units) of the colored triangle from the cell-face edges —
 *  just a thin dark seam. Kept SMALL so each face's sticker nearly fills it and OCCLUDES
 *  the perpendicular (side) stickers that would otherwise peek out of the V-groove at
 *  the sharp tetra dihedral and bleed color onto neighbors. Pair with low body rounding
 *  (narrow grooves) + low sticker protrusion (flat-ish) for a clean single-color face. */
const STICKER_INSET_DIST = 0.6;
const STICKER_CORNER_R = 0.16;
const BODY_ROUND = 1;
/** Each piece is shrunk toward its own centroid by this factor, opening a uniform
 *  gap to its neighbours so the dark core shows through as a thick seam — without
 *  enlarging the sticker inset (which would expose the perpendicular side stickers in
 *  the deep V-groove and bleed colour). 1 = no gap; smaller = wider seams. */
const PIECE_SHRINK = 0.9;
const BODY_COLOR = 0x141414;

const bodyMat = new THREE.MeshPhongMaterial({
  color: BODY_COLOR, specular: 0x222222, shininess: 25, side: THREE.DoubleSide,
});
function stickerMat(color: number): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({ color, specular: 0x444444, shininess: 60, side: THREE.DoubleSide });
}

interface Plane { n: [number, number, number]; rhs: number } // n·x ≤ rhs
const dot3 = (n: readonly number[], v: THREE.Vector3): number => n[0] * v.x + n[1] * v.y + n[2] * v.z;

function solve3(p: Plane, q: Plane, r: Plane): THREE.Vector3 | null {
  const A = [p.n, q.n, r.n]; const b = [p.rhs, q.rhs, r.rhs];
  const det = (M: number[][]): number =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
    - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
    + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det(A); if (Math.abs(D) < 1e-9) return null;
  const col = (i: number): number[][] => A.map((row, r2) => row.map((val, c) => (c === i ? b[r2] : val)));
  return new THREE.Vector3(det(col(0)) / D, det(col(1)) / D, det(col(2)) / D);
}

/** Vertices of the convex cell = feasible intersections of every plane triple. */
function cellVerts(planes: Plane[]): THREE.Vector3[] {
  const EPS = 1e-3;
  const ok = (v: THREE.Vector3): boolean => planes.every((p) => dot3(p.n, v) <= p.rhs + EPS);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < planes.length; i++)
    for (let j = i + 1; j < planes.length; j++)
      for (let k = j + 1; k < planes.length; k++) {
        const v = solve3(planes[i], planes[j], planes[k]);
        if (v && ok(v) && !out.some((w) => w.distanceTo(v) < 1e-3)) out.push(v);
      }
  return out;
}

function fibonacciSphere(n: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = []; const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2; const r = Math.sqrt(Math.max(0, 1 - y * y)); const t = ga * i;
    out.push(new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r));
  }
  return out;
}

/** Smoothly rounded convex body = Minkowski opening of the cell (erode every face by
 *  BODY_ROUND, sphere-sample the eroded vertices, hull, smooth). The opening ⊆ the
 *  cell, so the cut-plane zero-interpenetration is unaffected. */
function roundedBody(planes: Plane[]): THREE.BufferGeometry {
  const norm = planes.map((p) => {
    const L = Math.hypot(p.n[0], p.n[1], p.n[2]);
    return { n: [p.n[0] / L, p.n[1] / L, p.n[2] / L] as [number, number, number], rhs: p.rhs / L - BODY_ROUND };
  });
  const EPS = 1e-3;
  const ok = (v: THREE.Vector3): boolean => norm.every((p) => dot3(p.n, v) <= p.rhs + EPS);
  const ev: THREE.Vector3[] = [];
  for (let i = 0; i < norm.length; i++)
    for (let j = i + 1; j < norm.length; j++)
      for (let k = j + 1; k < norm.length; k++) {
        const v = solve3(norm[i], norm[j], norm[k]);
        if (v && ok(v) && !ev.some((w) => w.distanceTo(v) < 1e-3)) ev.push(v);
      }
  const fib = fibonacciSphere(26);
  const pts: THREE.Vector3[] = [];
  for (const e of ev) for (const d of fib) pts.push(e.clone().addScaledVector(d, BODY_ROUND));
  let geom: THREE.BufferGeometry = new ConvexGeometry(pts);
  geom.deleteAttribute('normal'); geom.deleteAttribute('uv');
  geom = mergeVertices(geom); geom.computeVertexNormals();
  return geom;
}

/** Rounded-corner triangle sticker on the plane through p0/p1/p2 (already inset +
 *  lifted) — same soft pillow as dino/NxN stickers. */
function roundedTriSticker(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, normal: THREE.Vector3): THREE.BufferGeometry {
  const n = normal.clone().normalize();
  const u = new THREE.Vector3().subVectors(p1, p0).normalize();
  const w = new THREE.Vector3().crossVectors(n, u).normalize();
  const origin = p0;
  const to2 = (p: THREE.Vector3): THREE.Vector2 => { const d = p.clone().sub(origin); return new THREE.Vector2(d.dot(u), d.dot(w)); };
  const C = [to2(p0), to2(p1), to2(p2)];
  const minEdge = Math.min(C[0].distanceTo(C[1]), C[1].distanceTo(C[2]), C[2].distanceTo(C[0]));
  const r = minEdge * STICKER_CORNER_R;
  const trimA = (i: number): THREE.Vector2 => C[i].clone().add(C[(i + 2) % 3].clone().sub(C[i]).normalize().multiplyScalar(r));
  const trimB = (i: number): THREE.Vector2 => C[i].clone().add(C[(i + 1) % 3].clone().sub(C[i]).normalize().multiplyScalar(r));
  const shape = new THREE.Shape();
  const b0 = trimB(0); shape.moveTo(b0.x, b0.y);
  for (const i of [1, 2, 0]) { const aa = trimA(i), bb = trimB(i); shape.lineTo(aa.x, aa.y); shape.quadraticCurveTo(C[i].x, C[i].y, bb.x, bb.y); }
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, { depth: STICKER_DEPTH, bevelEnabled: false, curveSegments: 8 });
  geom.applyMatrix4(new THREE.Matrix4().makeBasis(u, w, n).setPosition(origin));
  return geom;
}

/** Build the plane set defining one piece's convex cell. */
function piecePlanes(kind: 'tip' | 'corner' | 'edge', a: number, b = -1): Plane[] {
  const faces: Plane[] = VDIR.map((V) => ({ n: [-V[0], -V[1], -V[2]], rhs: PYRA_A })); // V·x ≥ -A
  const negV = (k: number): [number, number, number] => [-VDIR[k][0], -VDIR[k][1], -VDIR[k][2]];
  const posV = (k: number): [number, number, number] => [VDIR[k][0], VDIR[k][1], VDIR[k][2]];
  if (kind === 'tip') {
    return [...faces, { n: negV(a), rhs: -TIP_CUT }]; // t_a ≥ 5A/3
  }
  if (kind === 'corner') {
    const P: Plane[] = [...faces, { n: negV(a), rhs: -COR_CUT }, { n: posV(a), rhs: TIP_CUT }];
    for (let j = 0; j < 4; j++) if (j !== a) P.push({ n: posV(j), rhs: COR_CUT });
    return P;
  }
  // edge a,b
  const P: Plane[] = [...faces,
    { n: negV(a), rhs: -COR_CUT }, { n: negV(b), rhs: -COR_CUT },
    { n: posV(a), rhs: TIP_CUT }, { n: posV(b), rhs: TIP_CUT }];
  for (let l = 0; l < 4; l++) if (l !== a && l !== b) P.push({ n: posV(l), rhs: COR_CUT });
  return P;
}

/** Faces (vertex-opposite indices) a piece shows a sticker on. */
function pieceFaces(kind: 'tip' | 'corner' | 'edge', a: number, b = -1): number[] {
  if (kind === 'edge') return [0, 1, 2, 3].filter((m) => m !== a && m !== b);
  return [0, 1, 2, 3].filter((m) => m !== a); // tip/corner near vertex a → 3 faces not opposite-... = faces containing a
}

export interface PyraPieceBuild {
  pivot: THREE.Object3D;
  group: THREE.Group;
  /** Home-pose centroid (world units) — used to detect which turn layer an edge is
   *  currently in (rotate by the pivot quaternion, then test V_k·c ≥ A/3). */
  center: THREE.Vector3;
}

/** Build one piece (tip/corner/edge) as a black rounded body + colored triangle
 *  stickers, parented to a pivot at the origin. */
export function buildPyraPiece(kind: 'tip' | 'corner' | 'edge', a: number, b = -1): PyraPieceBuild {
  const planes = piecePlanes(kind, a, b);
  const verts = cellVerts(planes);
  const center = verts.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, verts.length));
  const group = new THREE.Group();

  const bodyMesh = new THREE.Mesh(roundedBody(planes), bodyMat);
  bodyMesh.userData.simRole = 'body';
  group.add(bodyMesh);

  for (const m of pieceFaces(kind, a, b)) {
    // Face m (opposite vertex m) sits at V_m·x = -A, so its OUTWARD normal is -V_m
    // (pointing away from the puzzle interior); stickers lift/extrude along it.
    const nrm = new THREE.Vector3(...VDIR[m]).negate().normalize();
    const onFace = verts.filter((v) => Math.abs(dot3(VDIR[m], v) - FACE_T) < 1e-2);
    if (onFace.length < 3) continue;
    const tri = onFace.slice(0, 3);
    const centroid = tri[0].clone().add(tri[1]).add(tri[2]).multiplyScalar(1 / 3);
    const lift = nrm.clone().multiplyScalar(STICKER_LIFT);
    // Move each corner toward the centroid by an absolute distance (clamped well short
    // of the centroid), then lift along the outward normal — keeps the sticker inside
    // the eroded body top regardless of triangle size.
    const inset = (p: THREE.Vector3): THREE.Vector3 => {
      const toC = centroid.clone().sub(p);
      const d = Math.min(STICKER_INSET_DIST, toC.length() * 0.5);
      return p.clone().add(toC.setLength(d)).add(lift);
    };
    const sGeom = roundedTriSticker(inset(tri[0]), inset(tri[1]), inset(tri[2]), nrm);
    group.add(makeSticker(sGeom, stickerMat(FACE_COLOR[m]), bodyMat, { simStickerNormal: nrm.clone(), pyraFace: m }));
  }

  // Shrink the whole piece toward its home centroid: world = pivot · ((1−s)·c + s·p).
  // The centroid rotates with the piece (correct), points pull in toward it → uniform
  // gaps to neighbours that reveal the dark core as a thick, bleed-free seam.
  group.scale.setScalar(PIECE_SHRINK);
  group.position.copy(center).multiplyScalar(1 - PIECE_SHRINK);

  const pivot = new THREE.Object3D();
  pivot.add(group);
  return { pivot, group, center };
}

/** Flat near-black, unlit — so the core reads as a clean dark void through the inter-
 *  piece gaps (lit phong would shade it grey and look like a peeking ball). */
const coreMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });

/** Inner core: a sphere (rotation-invariant → never interpenetrates a turning piece),
 *  radius < the inscribed-sphere so it only shows black through the grooves. */
export function buildCore(): THREE.Mesh {
  // Just under the inscribed-sphere radius (face distance = A/√3 ≈ 0.577A) so the dark
  // core fills the gaps where pieces separate (esp. the face centre) without poking
  // past a face. Rotation-invariant, so it never interpenetrates a turn.
  const geom = new THREE.SphereGeometry(PYRA_A * 0.56, 32, 24);
  const mesh = new THREE.Mesh(geom, coreMat);
  mesh.userData.simRole = 'core';
  return mesh;
}

export { bodyMat as PYRA_BODY_MAT };
