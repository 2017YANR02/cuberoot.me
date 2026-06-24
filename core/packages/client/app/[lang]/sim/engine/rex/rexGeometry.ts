/**
 * Rex Cube geometry — pure three.js builders (no scene/camera concerns).
 *
 * The Rex cube is a cube cut by 8 SPHERES, one per corner. Sphere i is centred on
 * corner i's body-diagonal axis at s·Vᵢ and has the radius that makes it pass through
 * corner i's 3 adjacent cube vertices — so the curved cuts MEET at the cube corners
 * (no corner piece; the petals reach the vertices) exactly like the real LanLan Rex.
 * Because each sphere is centred ON its corner axis, a 120° twist about that axis
 * leaves the sphere invariant ⇒ the moving cap (everything inside sphere i) slides
 * past the stationary pieces (subtracted out of sphere i) with ZERO interpenetration
 * — the Ivy construction, here with all 8 corners (see .tmp/rex/sphere2.mjs).
 *
 * Each piece BODY is the exact cell of the 8-sphere arrangement, built by true CSG:
 * cube ∩ (the spheres it is INSIDE) − (the spheres it is OUTSIDE). Membership is
 * 4 spheres for a centre, 3 for a petal, 2 for an edge. A thin colored STICKER —
 * the body's own outer face triangles, inset + raised — sits on top, so the black
 * body shows as the grooves of a real Rex. The sphere mesh is oriented so a 120°
 * turn is an exact symmetry of its tessellation (alignedSphereGeo), so the cut
 * surface is invariant under the turn (verified ~1e-7).
 */
import * as THREE from 'three';
import { Brush, Evaluator } from 'three-bvh-csg';
import { SIZE, COLORS } from '../define';
import { CORNER_AXIS, EDGE_MID, PETAL_FACE, PETAL_CORNER, FACE_LETTERS } from './rexState';
import { rexFaceRegions, type RexRegion } from './rexFacePaths';
import { cubeFaceBasis, extrudeOntoFace, makeSticker, type FaceBasis } from '../stickerGeom';
import { alignedSphereGeo, cutCell } from '../csgCut';

/** Cube half-side (world units). Frames like a ~3x3 in the shared camera rig (corners
 *  reach H√3 ≈ 3.46·SIZE, same as Dino/Redi). */
export const H = SIZE * 2;
/** Sphere-centre offset along each corner axis (× the corner vertex). Tunes the cut:
 *  bigger ⇒ smaller centre diamond / larger petals. 1.3 matches the LanLan look. */
const S = 1.3;
/** Icosphere subdivision for the cutting spheres. Only the thin grooves between the
 *  (analytic, smooth) stickers expose the body's curved cut now, so 5 is plenty. */
const SPHERE_DETAIL = 5;

// Stickers are built ANALYTICALLY (rexFacePaths) as true circular-arc outlines, then
// EXTRUDED so they are smooth + have real thickness (a raised tile, not a scraped sheet).
const STICKER_DEPTH = SIZE * 0.13;  // tile thickness (raised above the body face)
const STICKER_LIFT = SIZE * 0.01;   // tiny extra gap above the body (clears z-fight)
const STICKER_GROOVE = 0.032;       // inward offset in face units → the black groove
const BODY_COLOR = 0x141414;

/** Face index 0..5 = U,D,F,B,L,R → outward unit normal. */
const FACE_NORMAL: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [-1, 0, 0], [1, 0, 0],
];

// ---- cutting spheres ----------------------------------------------------------
/** Corner vertices in world coords (±H). */
const VERTS = CORNER_AXIS.map(([x, y, z]) => new THREE.Vector3(x * H, y * H, z * H));
/** A vertex one cube-edge away from vertex `i` (differs in exactly one coord). */
function adjacentVertexIndex(i: number): number {
  const a = CORNER_AXIS[i];
  for (let j = 0; j < 8; j++) {
    const b = CORNER_AXIS[j];
    let diff = 0;
    for (let k = 0; k < 3; k++) if (a[k] !== b[k]) diff++;
    if (diff === 1) return j;
  }
  return -1;
}
/** Sphere centre (= s·Vᵢ, on the corner axis) and radius² (through adjacent vertex). */
const SPH = VERTS.map((V, i) => {
  const center = V.clone().multiplyScalar(S);
  const R2 = center.distanceToSquared(VERTS[adjacentVertexIndex(i)]);
  return { center, R: Math.sqrt(R2), R2 };
});
/** Which spheres contain a world point (its CSG membership). */
function membership(p: THREE.Vector3): number[] {
  const out: number[] = [];
  for (let i = 0; i < 8; i++) if (p.distanceToSquared(SPH[i].center) < SPH[i].R2 - 1e-3) out.push(i);
  return out;
}

// ---- CSG body builder (shared sphere orientation + cell boolean in ../csgCut) ----
const ev = new Evaluator();
ev.useGroups = false; // one material per body → a single merged group
const _cubeBrush = new Brush(new THREE.BoxGeometry(2 * H, 2 * H, 2 * H));
_cubeBrush.updateMatrixWorld();
const _sphereBrushes = SPH.map((s, i) => {
  const b = new Brush(alignedSphereGeo(s.R, VERTS[i].clone().normalize(), SPHERE_DETAIL));
  b.position.copy(s.center);
  b.updateMatrixWorld();
  return b;
});

const bodyMat = new THREE.MeshPhongMaterial({
  color: BODY_COLOR, specular: 0x222222, shininess: 25, side: THREE.DoubleSide,
});
function stickerMat(color: string): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({ color, specular: 0x444444, shininess: 60, side: THREE.DoubleSide });
}

/** Build a piece body = cube ∩ (inside spheres) − (outside spheres), from a rep point. */
function buildBody(rep: THREE.Vector3): THREE.BufferGeometry {
  return cutCell(ev, _cubeBrush, _sphereBrushes, membership(rep));
}

export type RexPieceType = 'center' | 'petal' | 'edge';
export interface RexPieceBuild {
  type: RexPieceType;
  id: number;
  pivot: THREE.Object3D;
  group: THREE.Group;
  /** Faces this piece shows a sticker on (for drag / debug). */
  faces: number[];
}

/** Build one piece BODY (CSG solid) parented to a pivot at the origin. Stickers are
 *  added afterward, per face, from the analytic outlines (attachStickers). */
function buildBodyPiece(type: RexPieceType, id: number, rep: THREE.Vector3): RexPieceBuild {
  const group = new THREE.Group();
  const body = new THREE.Mesh(buildBody(rep), bodyMat);
  body.userData.simRole = 'body';
  group.add(body);
  const pivot = new THREE.Object3D();
  pivot.add(group);
  pivot.userData.rexType = type;
  pivot.userData.rexId = id;
  return { type, id, pivot, group, faces: [] };
}

const col = (face: number): string => COLORS[FACE_LETTERS[face]];

/** Centre piece i: shows on face i (its home face). Rep = face centre. */
function centerRep(face: number): THREE.Vector3 {
  return new THREE.Vector3(...FACE_NORMAL[face]).multiplyScalar(H * 0.999);
}
/** Petal id: home face PETAL_FACE[id], at corner PETAL_CORNER[id]. Rep = the corner
 *  pulled in to 0.6 on the in-plane axes, on the face plane. */
function petalRep(id: number): THREE.Vector3 {
  const face = PETAL_FACE[id], corner = PETAL_CORNER[id];
  const axis = FACE_NORMAL[face].findIndex((v) => v !== 0);
  const cs = CORNER_AXIS[corner];
  const v = new THREE.Vector3(cs[0] * H * 0.6, cs[1] * H * 0.6, cs[2] * H * 0.6);
  v.setComponent(axis, FACE_NORMAL[face][axis] * H * 0.999);
  return v;
}
/** Edge id: rep near the cube-edge midpoint (pushed just inside). */
function edgeRep(id: number): THREE.Vector3 {
  const m = EDGE_MID[id];
  return new THREE.Vector3(m[0] * H * 0.985, m[1] * H * 0.985, m[2] * H * 0.985);
}

// ---- analytic stickers: smooth true-arc outlines, extruded for real thickness --------
/** World sign-triple (±1/0 per axis) of the face-plane point at 2D face coord (a,b). */
function tripleAt(b: FaceBasis, a: number, bb: number): [number, number, number] {
  const p = b.u.clone().multiplyScalar(a).add(b.v.clone().multiplyScalar(bb)).add(b.n);
  return [Math.round(p.x), Math.round(p.y), Math.round(p.z)];
}
const sameVec = (p: readonly number[], q: readonly number[]): boolean => p[0] === q[0] && p[1] === q[1] && p[2] === q[2];

/** Extrude one region outline into a colored sticker tile mapped onto face f's plane. */
function buildSticker(region: RexRegion, b: FaceBasis, color: string): THREE.Mesh {
  const outline = region.pts.map(([a, bb]): [number, number] => [a * H, bb * H]);
  const origin = b.n.clone().multiplyScalar(H + STICKER_LIFT);
  const geo = extrudeOntoFace(outline, { u: b.u, v: b.v, n: b.n, origin }, STICKER_DEPTH);
  // black-walls invariant (caps colored, walls body-dark) → grazing-angle grooves stay
  // visible. attachStickers adds rexType/rexId/rexFace userData on top.
  return makeSticker(geo, stickerMat(color), bodyMat);
}

/** Attach each face's 9 analytic stickers (1 centre + 4 petals + 4 edges) to the
 *  matching piece groups, resolving region→piece from the shared geometry tables. */
function attachStickers(centers: RexPieceBuild[], petals: RexPieceBuild[], edges: RexPieceBuild[]): void {
  const template = rexFaceRegions(S, STICKER_GROOVE);
  for (let f = 0; f < 6; f++) {
    const b = cubeFaceBasis(FACE_NORMAL[f]);
    const color = col(f);
    for (const region of template) {
      let piece: RexPieceBuild;
      if (region.kind === 'center') {
        piece = centers[f];
      } else if (region.kind === 'petal') {
        const corner = CORNER_AXIS.findIndex((c) => sameVec(c, tripleAt(b, region.pos[0], region.pos[1])));
        piece = petals[PETAL_FACE.findIndex((pf, i) => pf === f && PETAL_CORNER[i] === corner)];
      } else {
        piece = edges[EDGE_MID.findIndex((m) => sameVec(m, tripleAt(b, region.pos[0], region.pos[1])))];
      }
      const mesh = buildSticker(region, b, color);
      mesh.userData.simRole = 'sticker';
      mesh.userData.rexType = piece.type;
      mesh.userData.rexId = piece.id;
      mesh.userData.rexFace = f;
      piece.group.add(mesh);
      piece.faces.push(f);
    }
  }
}

export interface RexBuild {
  centers: RexPieceBuild[];
  petals: RexPieceBuild[];
  edges: RexPieceBuild[];
}

/** Build all 42 pieces (6 centres + 24 petals + 12 edges): CSG bodies + analytic
 *  extruded stickers. A few hundred ms of CSG, done once when Rex is first mounted. */
export function buildRexPieces(): RexBuild {
  const centers = Array.from({ length: 6 }, (_, i) => buildBodyPiece('center', i, centerRep(i)));
  const petals = Array.from({ length: 24 }, (_, i) => buildBodyPiece('petal', i, petalRep(i)));
  const edges = Array.from({ length: 12 }, (_, i) => buildBodyPiece('edge', i, edgeRep(i)));
  attachStickers(centers, petals, edges);
  return { centers, petals, edges };
}

/** Solid black core sphere: invariant under every rotation, so it never
 *  interpenetrates a moving cap. Fills the hidden centre, shows only through grooves. */
export function buildCore(): THREE.Mesh {
  const geom = new THREE.SphereGeometry(H * 0.5, 24, 18);
  const mesh = new THREE.Mesh(geom, bodyMat);
  mesh.userData.simRole = 'core';
  return mesh;
}

export { bodyMat as REX_BODY_MAT };
