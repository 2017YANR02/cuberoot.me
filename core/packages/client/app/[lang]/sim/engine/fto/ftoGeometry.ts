/**
 * FTO geometry — pure three.js (planar octahedron cut → solid wedges, no CSG).
 *
 * The solid is a regular octahedron = ∩ of its 8 face half-spaces (FACE_NORMAL[f]·x ≤ R_IN).
 * Each face is a ±120° turn; its cut plane FACE_NORMAL[f]·x = CUT (= R_IN/3, the `o f 0.333`
 * deep cut whose planes meet at every face centre) is ⊥ the turn axis → invariant → zero
 * interpenetration. Every cell is the convex polytope  octahedron ∩ {8 cut half-spaces} —
 * cap side (·x ≥ CUT) for a chosen subset of faces, stationary side (·x ≤ CUT) for the rest.
 * Enumerating all 256 sign patterns and keeping the non-degenerate cells yields exactly:
 *   • 6 corners  (cap of 4 faces, 4 stickers — an octahedron vertex)
 *   • 12 edges   (cap of 2 faces, 2 stickers)
 *   • 24 centres (cap of 3 faces, 1 sticker — two orbits of 12)
 *   • 9 internal/core cells (no sticker → rendered black; the cap-of-nothing core never moves)
 * = a full tiling (no voids when a face lifts). Validated offline in .tmp/fto/sweep2.mjs.
 *
 * Each cell is a pivot at the origin; its quaternion is the source of truth for its pose (a
 * turn left-multiplies R(faceNormal, ±120°)). Body = the rounded cell; stickers = raised,
 * grooved, rounded tiles on the cap facets with body-dark side walls. Colours come from the
 * vendored PuzzleGeometry octahedron scheme (the same source twizzle renders FTO from), keyed
 * by PG face name → pixel-match between the cubing.js and engine renderers.
 */
import * as THREE from 'three';
import { SIZE } from '../define';
import { FACE_NORMAL, FACE_PG } from './ftoState';
import { roundedSolid, polytopeVerts, type Plane } from '../polytopeCut';
import { defaultPlatonicColorSchemes } from '@/lib/puzzle-geometry/colors';
import {
  offsetInward, roundCorners, extrudeOntoFace, makeSticker, polyArea2, type V2,
} from '../stickerGeom';

/** Octahedron inradius (origin → face plane) in world units. Circumradius = √3·R_IN. */
export const R_IN = SIZE * 1.85; // ≈ 118  → circumradius ≈ 205, framed like megaminx
/** Deep face cut: R_IN/3 along the face normal (PG `o f 0.333`; cuts meet at face centres). */
const CUT = R_IN / 3;

const BODY_ROUND = 2.5;        // body corner/edge round radius (world units)
const STICKER_LIFT = 0.6;      // raise above body face to clear z-fighting
const STICKER_DEPTH = 3.5;     // extruded thickness → raised "pillow"
const STICKER_INSET = SIZE * 0.035;  // inward groove width (world units)
// Corner-round setback. MUST stay > STICKER_INSET (skill pitfall #12): offsetInward shrinks
// the rounded corner's arc by INSET, so if the arc radius ≤ INSET it inverts into a spike.
const STICKER_ROUND = SIZE * 0.085;
const BODY_COLOR = 0x0a0a0a;

// FTO face colours = the EXACT cubing.js / twizzle octahedron scheme (the 8-face platonic
// solid → the vendored puzzle-geometry's `8` scheme), pulled by PG face name into our face
// order. Same source twizzle renders from, so every face matches pixel-for-pixel.
const PG_OCTA_SCHEME = defaultPlatonicColorSchemes()[8] as Record<string, string>;
export const FTO_COLORS: number[] = FACE_PG.map((name) => parseInt(PG_OCTA_SCHEME[name].slice(1), 16));

// ── materials ─────────────────────────────────────────────────────────────────────
const bodyMat = new THREE.MeshPhongMaterial({
  color: BODY_COLOR, specular: 0x0c0c0c, shininess: 18, side: THREE.DoubleSide,
});
const stickerMats: THREE.MeshPhongMaterial[] = FTO_COLORS.map((color) =>
  new THREE.MeshPhongMaterial({ color, specular: 0x444444, shininess: 60, side: THREE.DoubleSide }));
export { bodyMat as FTO_BODY_MAT };

const _n = (f: number): THREE.Vector3 => new THREE.Vector3(...FACE_NORMAL[f]); // already unit
/** Unit twist axis (world) for face f — used by the cube/drag for the 120° rotation. */
export function faceAxisVec(f: number): THREE.Vector3 { return _n(f); }

// ── piece cells (octahedron ∩ cut half-spaces) ──────────────────────────────────────
/** Half-spaces bounding a cell that is cap-side of `capFaces` (·x ≥ CUT there), stationary
 *  side (·x ≤ CUT) elsewhere, inside the octahedron (·x ≤ R_IN every face). */
function cellPlanes(capFaces: readonly number[]): Plane[] {
  const planes: Plane[] = [];
  for (let f = 0; f < 8; f++) {
    const [nx, ny, nz] = FACE_NORMAL[f];
    planes.push({ n: [nx, ny, nz], d: R_IN });                  // outer octahedron face
  }
  for (let f = 0; f < 8; f++) {
    const [nx, ny, nz] = FACE_NORMAL[f];
    if (capFaces.includes(f)) planes.push({ n: [-nx, -ny, -nz], d: -CUT }); // ·x ≥ CUT (cap)
    else planes.push({ n: [nx, ny, nz], d: CUT });                          // ·x ≤ CUT (stay)
  }
  return planes;
}

/** ≥4 vertices spanning 3D (a real solid cell, not a face/edge sliver). */
function has3dVolume(vs: THREE.Vector3[]): boolean {
  if (vs.length < 4) return false;
  const o = vs[0];
  const m = vs.slice(1).map((v) => v.clone().sub(o));
  for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) {
    const c = new THREE.Vector3().crossVectors(m[i], m[j]);
    if (c.length() < 1e-4) continue;
    for (let k = 0; k < m.length; k++) if (Math.abs(c.dot(m[k])) > 1e-3) return true;
  }
  return false;
}

// ── stickers ────────────────────────────────────────────────────────────────────────
/** Raised, grooved, rounded sticker for the cell's facet on face `faceIdx`, or null if the
 *  cell does not reach that outer face with a real polygon (≥3 verts). */
function facetSticker(verts: THREE.Vector3[], faceIdx: number): THREE.Mesh | null {
  const n = _n(faceIdx);
  const facet = verts.filter((v) => Math.abs(v.dot(n) - R_IN) < 0.5);
  if (facet.length < 3) return null;
  let u = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  u = u.sub(n.clone().multiplyScalar(u.dot(n))).normalize();
  const w = new THREE.Vector3().crossVectors(n, u).normalize();
  const centroid = facet.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / facet.length);
  const pts2 = facet.map((p): V2 => { const d = p.clone().sub(centroid); return [d.dot(u), d.dot(w)]; });
  pts2.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  let poly: V2[] = pts2;
  if (polyArea2(poly) < 0) poly = poly.slice().reverse();
  poly = offsetInward(roundCorners(poly, STICKER_ROUND), STICKER_INSET);
  if (poly.length < 3) return null;
  const origin = centroid.clone().add(n.clone().multiplyScalar(STICKER_LIFT));
  const geo = extrudeOntoFace(poly, { u, v: w, n, origin }, STICKER_DEPTH);
  return makeSticker(geo, stickerMats[faceIdx], bodyMat, { simStickerNormal: n.clone(), ftoFace: faceIdx });
}

export interface FtoPieceBuild {
  pivot: THREE.Object3D;
  group: THREE.Group;
  /** Home-pose centroid (local), for live cap detection + complete. */
  center: THREE.Vector3;
  /** Face indices this piece shows a sticker on (empty = internal black cell). */
  stickerFaces: number[];
  /** The cap-of-nothing core cell (never moves). */
  isCore: boolean;
}

/** Build one cell: rounded body + one sticker per reached cap facet, on an origin pivot. */
function buildCell(capFaces: number[], verts: THREE.Vector3[]): FtoPieceBuild {
  const planes = cellPlanes(capFaces);
  const group = new THREE.Group();
  const isCore = capFaces.length === 0;
  const body = new THREE.Mesh(roundedSolid(planes, BODY_ROUND), bodyMat);
  body.userData.simRole = isCore ? 'core' : 'body';
  group.add(body);
  const stickerFaces: number[] = [];
  for (const f of capFaces) {
    const s = facetSticker(verts, f);
    if (s) { group.add(s); stickerFaces.push(f); }
  }
  const center = verts.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / verts.length);
  const pivot = new THREE.Object3D();
  pivot.add(group);
  pivot.userData.ftoCenter = center.clone();
  pivot.userData.ftoStickerFaces = stickerFaces.slice();
  return { pivot, group, center, stickerFaces, isCore };
}

/** Enumerate + build all 51 cells (42 visible + 9 black internal/core). One-time on mount. */
export function buildFtoPieces(): FtoPieceBuild[] {
  const out: FtoPieceBuild[] = [];
  for (let mask = 0; mask < 256; mask++) {
    const cap: number[] = [];
    for (let f = 0; f < 8; f++) if (mask & (1 << f)) cap.push(f);
    const verts = polytopeVerts(cellPlanes(cap));
    if (!has3dVolume(verts)) continue;
    out.push(buildCell(cap, verts));
  }
  return out;
}
