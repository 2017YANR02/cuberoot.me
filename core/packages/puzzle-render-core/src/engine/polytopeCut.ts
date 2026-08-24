/**
 * Shared convex-polytope geometry for the PLANAR-CUT /sim puzzles (helicopter, megaminx,
 * …): build a piece as the intersection of half-spaces (cube/dodecahedron faces + the
 * turn cut planes), then optionally round it (Minkowski opening) for the soft-pillow body.
 * Pure three.js — no CSG (see csgCut.ts for the sphere-cut puzzles).
 *
 * A piece is `∩ { n·x ≤ d }`. Make the moving side of each cut a `−n·x ≤ −cut` half-space
 * (i.e. `n·x ≥ cut`) and the stationary side `n·x ≤ cut`; because a turn's cut plane is ⊥
 * its rotation axis it is invariant under the turn, so the moving cell maps to itself →
 * constructive zero interpenetration (see sim-add-puzzle skill, "零穿模不变式").
 */
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Half-space n·x ≤ d (n need not be unit; d in world units). */
export interface Plane { n: [number, number, number]; d: number }

/** The point where three planes meet (n·x = d each), or null if near-parallel. */
export function solve3(p: Plane, q: Plane, r: Plane): THREE.Vector3 | null {
  const A = [p.n, q.n, r.n], b = [p.d, q.d, r.d];
  const det = (M: number[][]): number =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
    - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
    + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det(A);
  if (Math.abs(D) < 1e-9) return null;
  const col = (i: number): number[][] => A.map((row, k) => row.map((val, j) => (j === i ? b[k] : val)));
  return new THREE.Vector3(det(col(0)) / D, det(col(1)) / D, det(col(2)) / D);
}

/** Vertices of the convex polytope ∩{planes} (n·x ≤ d): every feasible triple-intersection. */
export function polytopeVerts(planes: Plane[]): THREE.Vector3[] {
  const EPS = 1e-3;
  const feasible = (v: THREE.Vector3): boolean =>
    planes.every((p) => p.n[0] * v.x + p.n[1] * v.y + p.n[2] * v.z <= p.d + EPS);
  const verts: THREE.Vector3[] = [];
  for (let i = 0; i < planes.length; i++)
    for (let j = i + 1; j < planes.length; j++)
      for (let k = j + 1; k < planes.length; k++) {
        const v = solve3(planes[i], planes[j], planes[k]);
        if (v && feasible(v) && !verts.some((w) => w.distanceTo(v) < 1e-3)) verts.push(v);
      }
  return verts;
}

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
const FIB = fibonacciSphere(26);

/**
 * Sharp convex body = the polytope ∩{planes}, hulled + smoothed.
 */
export function sharpSolid(planes: Plane[]): THREE.BufferGeometry {
  let geom: THREE.BufferGeometry = new ConvexGeometry(polytopeVerts(planes));
  geom.deleteAttribute('normal');
  geom.deleteAttribute('uv');
  geom = mergeVertices(geom);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Smoothly rounded solid = Minkowski opening of ∩{planes} by radius r: erode every plane
 * inward by r, sphere-sample r around each eroded vertex, convex-hull, smooth normals. The
 * opening ⊆ the original cell, so zero-interpenetration is preserved. Falls back to the
 * sharp hull if the cell is too small to erode.
 */
export function roundedSolid(planes: Plane[], r: number): THREE.BufferGeometry {
  const eroded = polytopeVerts(planes.map((p) => ({ n: p.n, d: p.d - r })));
  const pts: THREE.Vector3[] = [];
  if (eroded.length >= 4) {
    for (const ev of eroded) for (const dir of FIB) pts.push(ev.clone().addScaledVector(dir, r));
  } else {
    pts.push(...polytopeVerts(planes)); // too small to round — keep sharp
  }
  let geom: THREE.BufferGeometry = new ConvexGeometry(pts);
  geom.deleteAttribute('normal');
  geom.deleteAttribute('uv');
  geom = mergeVertices(geom);
  geom.computeVertexNormals();
  return geom;
}
