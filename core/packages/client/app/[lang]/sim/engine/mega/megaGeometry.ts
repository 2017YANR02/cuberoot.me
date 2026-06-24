/**
 * Megaminx geometry — pure three.js (planar dodecahedron cut → solid wedges, no CSG).
 *
 * The solid is a regular dodecahedron = ∩ of its 12 face half-spaces (FACE_NORMAL[f]·x ≤
 * R_IN). A face turn rotates the shallow shell on the cap side of that face's cut plane
 * (FACE_NORMAL[f]·x = CUT, ⊥ the turn axis → invariant → zero interpenetration). Each of
 * the 62 pieces is the convex cell  dodecahedron ∩ {12 cut half-spaces} — cap side
 * (·x ≥ CUT) for the faces the piece shows, stationary side (·x ≤ CUT) for the rest:
 *   • corner (3 faces): 3 stickers · edge (2 faces): 2 stickers · center (1 face): 1.
 * Body = the rounded (Minkowski-opened) cell; stickers = raised, grooved, rounded tiles on
 * the cap faces with body-dark side walls (so grazing-angle grooves stay visible). A fixed
 * central core fills the middle so a turn's opening reads solid black, not void.
 *
 * Each piece pivot sits at the origin; its quaternion is the source of truth for the piece's
 * current orientation (a turn left-multiplies R(faceNormal, ±72°)). Indexing matches
 * megaState (corner 0..19, edge 0..29, center = face 0..11).
 */
import * as THREE from 'three';
import { SIZE } from '../define';
import { FACE_NORMAL, CORNER_FACES, EDGE_FACES } from './megaState';
import { roundedSolid, polytopeVerts, type Plane } from '../polytopeCut';
import {
  offsetInward, roundCorners, extrudeOntoFace, makeSticker, polyArea2, type V2,
} from '../stickerGeom';

/** Dodecahedron inradius (face-center distance) in world units — framed by the shared camera. */
export const R_IN = SIZE * 2.4; // ≈ 154
/** Face cut depth along the (unit) face normal. Matches PG's `megaminx` `d f 0.7`. */
const CUT = R_IN * 0.7;

const BODY_ROUND = 2.5;        // body corner/edge round radius (world units)
const STICKER_LIFT = 0.6;      // raise above body face to clear z-fighting
const STICKER_DEPTH = 3.5;     // extruded thickness → raised "pillow"
const STICKER_INSET = SIZE * 0.022;  // inward groove width (world units) — thin megaminx seam
const STICKER_ROUND = SIZE * 0.04;   // corner-round setback (world units)
const BODY_COLOR = 0x141414;

// Standard 12-color megaminx scheme, indexed by face (U,F,L,BL,BR,R,C,A,I,BF,E,D).
const MEGA_COLORS = [
  0xf5f5f5, // 0  U  white
  0x1fa82a, // 1  F  green
  0x7e3fbf, // 2  L  purple
  0xf7d108, // 3  BL yellow
  0x1565e0, // 4  BR blue
  0xe02424, // 5  R  red
  0x9aa0a6, // 6  C  gray
  0x8ce060, // 7  A  light green
  0xf08000, // 8  I  orange
  0xff7fb0, // 9  BF pink
  0x36c5e8, // 10 E  sky
  0xc9a26a, // 11 D  tan
];

// ── materials ─────────────────────────────────────────────────────────────────────
const bodyMat = new THREE.MeshPhongMaterial({
  color: BODY_COLOR, specular: 0x0c0c0c, shininess: 18, side: THREE.DoubleSide,
});
const stickerMats: THREE.MeshPhongMaterial[] = MEGA_COLORS.map((color) =>
  new THREE.MeshPhongMaterial({ color, specular: 0x444444, shininess: 60, side: THREE.DoubleSide }),
);
export { bodyMat as MEGA_BODY_MAT };

const _n = (f: number): THREE.Vector3 => new THREE.Vector3(...FACE_NORMAL[f]);
/** Unit twist axis (world) for face f — used by the cube/drag for the 72° rotation. */
export function faceAxisVec(f: number): THREE.Vector3 { return _n(f); }

// ── piece cells (dodecahedron ∩ cut half-spaces) ────────────────────────────────────
/** Half-spaces bounding a piece that shows `capFaces` (cap side of those cuts, stationary
 *  side of the rest), inside the dodecahedron. */
function piecePlanes(capFaces: readonly number[]): Plane[] {
  const planes: Plane[] = [];
  for (let f = 0; f < 12; f++) {
    const [nx, ny, nz] = FACE_NORMAL[f];
    planes.push({ n: [nx, ny, nz], d: R_IN }); // dodecahedron outer face
  }
  for (let f = 0; f < 12; f++) {
    const [nx, ny, nz] = FACE_NORMAL[f];
    if (capFaces.includes(f)) planes.push({ n: [-nx, -ny, -nz], d: -CUT }); // ·x ≥ CUT (cap)
    else planes.push({ n: [nx, ny, nz], d: CUT });                          // ·x ≤ CUT (stationary)
  }
  return planes;
}

// ── stickers ────────────────────────────────────────────────────────────────────────
/** Raised, grooved, rounded sticker for the piece's facet on face `faceIdx`. `facet` =
 *  the piece's polytope verts lying on that face's plane. */
function facetSticker(facet: THREE.Vector3[], faceIdx: number): THREE.Mesh | null {
  if (facet.length < 3) return null;
  const n = _n(faceIdx).normalize();
  let u = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  u = u.sub(n.clone().multiplyScalar(u.dot(n))).normalize();
  const w = new THREE.Vector3().crossVectors(n, u).normalize();
  const centroid = facet.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / facet.length);
  const pts2 = facet.map((p): V2 => { const d = p.clone().sub(centroid); return [d.dot(u), d.dot(w)]; });
  pts2.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0])); // CCW order around centroid
  let poly: V2[] = pts2;
  if (polyArea2(poly) < 0) poly = poly.slice().reverse();
  poly = offsetInward(roundCorners(poly, STICKER_ROUND), STICKER_INSET);
  if (poly.length < 3) return null;
  const origin = centroid.clone().add(n.clone().multiplyScalar(STICKER_LIFT));
  const geo = extrudeOntoFace(poly, { u, v: w, n, origin }, STICKER_DEPTH);
  return makeSticker(geo, stickerMats[faceIdx], bodyMat, { simStickerNormal: n.clone() });
}

export interface PieceBuild { pivot: THREE.Object3D; group: THREE.Group; }

/** Build one piece: rounded body + one sticker per cap face, parented to an origin pivot. */
function buildPiece(capFaces: readonly number[], userData: Record<string, unknown>): PieceBuild {
  const planes = piecePlanes(capFaces);
  const group = new THREE.Group();
  const body = new THREE.Mesh(roundedSolid(planes, BODY_ROUND), bodyMat);
  body.userData.simRole = 'body';
  group.add(body);
  const sharp = polytopeVerts(planes);
  for (const f of capFaces) {
    const facet = sharp.filter((v) => v.dot(_n(f)) > R_IN - 0.5);
    const s = facetSticker(facet, f);
    if (s) group.add(s);
  }
  const pivot = new THREE.Object3D();
  pivot.add(group);
  Object.assign(pivot.userData, userData);
  return { pivot, group };
}

export function buildCornerPiece(id: number): PieceBuild {
  return buildPiece(CORNER_FACES[id], { megaCornerId: id });
}
export function buildEdgePiece(id: number): PieceBuild {
  return buildPiece(EDGE_FACES[id], { megaEdgeId: id });
}
export function buildCenterPiece(face: number): PieceBuild {
  return buildPiece([face], { megaCenterFace: face });
}

/** Fixed central core = dodecahedron ∩ {·x ≤ CUT for every face} (rounded). On the
 *  stationary side of every cut → every turn leaves it untouched. Fills the middle so a
 *  turn's opening reads solid black, not void. */
export function buildCore(): THREE.Mesh {
  const mesh = new THREE.Mesh(roundedSolid(piecePlanes([]), BODY_ROUND), bodyMat);
  mesh.userData.simRole = 'core';
  return mesh;
}
