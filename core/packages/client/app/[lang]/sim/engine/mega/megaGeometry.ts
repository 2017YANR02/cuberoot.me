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
import { FACE_NORMAL, FACE_NAME, CORNER_FACES, EDGE_FACES } from './megaState';
import { roundedSolid, polytopeVerts, type Plane } from '../polytopeCut';
import { defaultPlatonicColorSchemes } from '@/lib/puzzle-geometry/colors';
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
const STICKER_INSET = SIZE * 0.04;   // inward groove width (world units) — bold megaminx seam
// Corner-round setback. MUST stay comfortably larger than STICKER_INSET: offsetInward shrinks
// the rounded corner's arc by INSET, so if the arc radius ≤ INSET the arc inverts into an
// outward spike (skill pitfall #12). Keeping ROUND ≈ 2.3× INSET leaves margin at acute corners.
const STICKER_ROUND = SIZE * 0.09;
const BODY_COLOR = 0x0a0a0a;         // near-black so the bold grooves read as crisp twizzle seams

// Megaminx face colours = the EXACT cubing.js / twizzle scheme. The dodecahedron is the
// 12-face platonic solid, so its colours are the vendored puzzle-geometry's `12` scheme,
// pulled by face name into our FACE_NAME order — same source twizzle renders from, so every
// face matches twizzle.net pixel-for-pixel (U white, F dark green, L purple, … D gray).
const PG_DODECA_SCHEME = defaultPlatonicColorSchemes()[12] as Record<string, string>;
const MEGA_COLORS: number[] = FACE_NAME.map(
  (name) => parseInt(PG_DODECA_SCHEME[name].slice(1), 16),
);

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
