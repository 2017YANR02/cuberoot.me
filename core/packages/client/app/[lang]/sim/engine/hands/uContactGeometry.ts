/** Diagnostic geometry only: ideal cubie boxes, nominal sticker rectangles.
 * Never writes a pose, cube state, material, or animation clock. Units are cube-local U.
 */
import * as THREE from 'three';
import type Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { FACE, SIZE } from '@cuberoot/puzzle-render-core/engine/define';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import type { HandModel } from './handModel';

export type Vec3 = [number, number, number];
const HALF = SIZE / 2;
const NEAR = 2.5;
// Face numbering follows the engine, never cubing.js/visualcube numbering.
const FACE_AXES = [
  { face: FACE.L, name: 'L', axis: 0, sign: -1, u: 2, v: 1 },
  { face: FACE.R, name: 'R', axis: 0, sign: 1, u: 2, v: 1 },
  { face: FACE.D, name: 'D', axis: 1, sign: -1, u: 0, v: 2 },
  { face: FACE.U, name: 'U', axis: 1, sign: 1, u: 0, v: 2 },
  { face: FACE.B, name: 'B', axis: 2, sign: -1, u: 0, v: 1 },
  { face: FACE.F, name: 'F', axis: 2, sign: 1, u: 0, v: 1 },
] as const;

export interface DiagnosticPiece {
  initial: number;
  matrix: THREE.Matrix4;
  faces: readonly number[];
}
export interface FingerPoint { vertex: number; point: THREE.Vector3; pad: boolean }
export interface ContactCandidate {
  pieceInitial: number;
  homePiece: string;
  localFace: string;
  stickerId: string;
  gapU: number;
  distanceToRectangleU: number;
  edgeMarginU: number;
  region: 'nominal-sticker' | 'border-or-outside';
  contact: boolean;
  witnessVertex: number;
  pointCube: Vec3;
  pointPiece: Vec3;
  uvU: [number, number];
  normalCube: Vec3;
  currentFace: string | null;
  currentSlot: string | null;
}
export interface ContactMeasurement {
  state: 'contact' | 'separated' | 'penetrating' | 'unavailable';
  nearest: ContactCandidate | null;
  contacts: ContactCandidate[];
  penetration: { depthU: number; vertex: number | null; pieceInitial: number | null };
  fingerVertices: number;
  padVertices: number;
}

function homePiece(initial: number): string {
  const x = initial % 3, y = Math.floor(initial / 3) % 3, z = Math.floor(initial / 9);
  return `${y === 2 ? 'U' : y === 0 ? 'D' : ''}${z === 2 ? 'F' : z === 0 ? 'B' : ''}${x === 2 ? 'R' : x === 0 ? 'L' : ''}`;
}

/** Maps an aligned physical sticker to its current slot; oblique faces have no six-face slot. */
function slotOf(matrix: THREE.Matrix4, normal: THREE.Vector3): { currentFace: string | null; currentSlot: string | null } {
  const f = FACE_AXES.find(a => normal.getComponent(a.axis) * a.sign > 1 - 1e-7);
  if (!f) return { currentFace: null, currentSlot: null };
  const center = new THREE.Vector3().setFromMatrixPosition(matrix);
  const xyz = center.toArray().map(v => Math.round(v / SIZE) + 1);
  if (xyz.some((v, i) => v < 0 || v > 2 || Math.abs(center.getComponent(i) / SIZE - (v - 1)) > 1e-6)
    || xyz[f.axis] !== (f.sign > 0 ? 2 : 0)) return { currentFace: f.name, currentSlot: null };
  return { currentFace: f.name, currentSlot: engineHomeSid(xyz[0] + 3 * xyz[1] + 9 * xyz[2], f.face, 3) };
}

export function readDiagnosticPieces(cube: Cube): DiagnosticPiece[] {
  const pieces: DiagnosticPiece[] = [];
  for (const c of cube.initials.values()) {
    const matrix = cube.instancedRenderer.getCubeletRenderMatrix(c.initial, new THREE.Matrix4());
    if (!matrix) continue;
    pieces.push({ initial: c.initial, matrix,
      faces: FACE_AXES.filter(f => c.initialColors[f.face] != null).map(f => f.face) });
  }
  return pieces;
}

/** Dominant bone attribution matches the existing home probe. Distal palmar half is a pad proxy. */
export class IndexSkinSampler {
  private vertices: { index: number; distal: boolean }[] = [];
  private mesh: THREE.SkinnedMesh;
  constructor(private model: HandModel) {
    const mesh = model.meshes.find(m => (m as THREE.SkinnedMesh).isSkinnedMesh) as THREE.SkinnedMesh | undefined;
    if (!mesh) throw new Error('Right hand has no skinned mesh');
    this.mesh = mesh;
    const indices = mesh.geometry.getAttribute('skinIndex');
    const weights = mesh.geometry.getAttribute('skinWeight');
    for (let i = 0; i < indices.count; i++) {
      let dominant = 0;
      for (let k = 1; k < 4; k++) if (weights.getComponent(i, k) > weights.getComponent(i, dominant)) dominant = k;
      const name = mesh.skeleton.bones[indices.getComponent(i, dominant)]?.name ?? '';
      if (!name.startsWith('index-finger-')) continue;
      this.vertices.push({ index: i, distal: name.includes('distal') || name.endsWith('-tip') });
    }
  }

  sample(cube: Cube): FingerPoint[] {
    // Refresh transform caches only, after the rig has applied its own pose corrective.
    cube.updateWorldMatrix(true, false);
    this.model.group.updateWorldMatrix(true, false);
    // SkinnedMesh refreshes its attached bind inverse in updateMatrixWorld, not
    // updateWorldMatrix. Without this, sampling before render can apply a newly
    // rotated grip twice (or use the previous frame's inverse).
    this.model.group.updateMatrixWorld(true);
    const toCube = cube.matrixWorld.clone().invert();
    const toTip = this.model.fingers.index.tip.matrixWorld.clone().invert();
    const position = this.mesh.geometry.getAttribute('position');
    const p = new THREE.Vector3(), tipLocal = new THREE.Vector3();
    return this.vertices.map(({ index, distal }) => {
      p.fromBufferAttribute(position, index);
      this.mesh.applyBoneTransform(index, p);
      p.applyMatrix4(this.mesh.matrixWorld);
      tipLocal.copy(p).applyMatrix4(toTip);
      return { vertex: index, pad: distal && tipLocal.z >= 0, point: p.clone().applyMatrix4(toCube) };
    });
  }
}

/** Finite face rectangles prevent an infinite-plane distance from claiming edge contact.
 * Penetration is all index-skin vertices against all current cubie boxes, including moving slices.
 */
export function measureIndexContact(points: FingerPoint[], pieces: DiagnosticPiece[], stickerHalf = 28): ContactMeasurement {
  const candidates: ContactCandidate[] = [];
  const contacts: ContactCandidate[] = [];
  const penetration: ContactMeasurement['penetration'] = { depthU: 0, vertex: null, pieceInitial: null };
  const local = new THREE.Vector3();
  for (const piece of pieces) {
    const inverse = piece.matrix.clone().invert();
    const best = new Map<number, { distance: number; point: FingerPoint; local: THREE.Vector3; gap: number; margin: number }>();
    const touching: typeof best = new Map();
    for (const p of points) {
      local.copy(p.point).applyMatrix4(inverse);
      const depth = HALF - Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z));
      if (depth > penetration.depthU) Object.assign(penetration, { depthU: depth, vertex: p.vertex, pieceInitial: piece.initial });
      if (!p.pad) continue;
      for (const f of FACE_AXES) {
        if (!piece.faces.includes(f.face)) continue;
        const gap = local.getComponent(f.axis) * f.sign - HALF;
        const u = Math.abs(local.getComponent(f.u)), v = Math.abs(local.getComponent(f.v));
        const margin = stickerHalf - Math.max(u, v);
        const distance = Math.hypot(gap, Math.max(0, u - stickerHalf), Math.max(0, v - stickerHalf));
        const witness = { distance, point: p, local: local.clone(), gap, margin };
        if (distance < (best.get(f.face)?.distance ?? Infinity)) best.set(f.face, witness);
        // A closer penetrating / border vertex must not hide another valid pad contact.
        if (margin >= 0 && gap >= 0 && gap <= NEAR && distance < (touching.get(f.face)?.distance ?? Infinity)) {
          touching.set(f.face, witness);
        }
      }
    }
    for (const f of FACE_AXES) {
      const b = best.get(f.face);
      if (!b) continue;
      const normal = new THREE.Vector3().setComponent(f.axis, f.sign).transformDirection(piece.matrix);
      const candidate = (b: NonNullable<ReturnType<typeof best.get>>): ContactCandidate => ({ pieceInitial: piece.initial, homePiece: homePiece(piece.initial), localFace: f.name,
        stickerId: engineHomeSid(piece.initial, f.face, 3), gapU: b.gap, distanceToRectangleU: b.distance,
        edgeMarginU: b.margin, region: b.margin >= 0 ? 'nominal-sticker' : 'border-or-outside',
        contact: b.margin >= 0 && b.gap >= 0 && b.gap <= NEAR,
        witnessVertex: b.point.vertex, pointCube: b.point.point.toArray(), pointPiece: b.local.toArray(),
        uvU: [b.local.getComponent(f.u), b.local.getComponent(f.v)], normalCube: normal.toArray(),
        ...slotOf(piece.matrix, normal) });
      candidates.push(candidate(b));
      const touch = touching.get(f.face);
      if (touch) contacts.push(candidate(touch));
    }
  }
  candidates.sort((a, b) => a.distanceToRectangleU - b.distanceToRectangleU);
  return { state: penetration.depthU > 0 ? 'penetrating' : contacts.length ? 'contact' : candidates.length ? 'separated' : 'unavailable',
    nearest: candidates[0] ?? null, contacts, penetration,
    fingerVertices: points.length, padVertices: points.filter(p => p.pad).length };
}

export interface MaterialAnchor { pieceInitial: number; stickerId: string; face: string; vertex: number; local: Vec3; startedInContact: boolean }
export function contactAnchor(measurement: ContactMeasurement): MaterialAnchor | null {
  const c = measurement.contacts.toSorted((a, b) => a.distanceToRectangleU - b.distanceToRectangleU)[0] ?? measurement.nearest;
  // Save a proximity anchor even when outside the diagnostic contact band, but never call it no-slip contact.
  return c ? { pieceInitial: c.pieceInitial, stickerId: c.stickerId, face: c.localFace,
    vertex: c.witnessVertex, local: c.pointPiece, startedInContact: c.contact } : null;
}

export function measureMaterialSlip(anchor: MaterialAnchor | null, points: FingerPoint[], pieces: DiagnosticPiece[], measurement: ContactMeasurement, stickerHalf = 28) {
  if (!anchor) return null;
  const point = points.find(p => p.vertex === anchor.vertex), piece = pieces.find(p => p.initial === anchor.pieceInitial);
  const face = FACE_AXES.find(f => f.name === anchor.face);
  if (!point || !piece || !face) return null;
  const local = point.point.clone().applyMatrix4(piece.matrix.clone().invert());
  const displacement = Math.hypot(local.getComponent(face.u) - anchor.local[face.u], local.getComponent(face.v) - anchor.local[face.v]);
  const contact = measurement.contacts.find(c => c.stickerId === anchor.stickerId);
  const gap = local.getComponent(face.axis) * face.sign - HALF;
  const margin = stickerHalf - Math.max(Math.abs(local.getComponent(face.u)), Math.abs(local.getComponent(face.v)));
  const anchorInContact = margin >= 0 && gap >= 0 && gap <= NEAR;
  return { referenceStickerId: anchor.stickerId, vertex: anchor.vertex,
    tangentialDisplacementU: displacement,
    startedInContact: anchor.startedInContact,
    anchorGapU: gap,
    anchorEdgeMarginU: margin,
    anchorInContact,
    contactAtBothCheckpoints: anchor.startedInContact && anchorInContact,
    contactOnReference: !!contact,
    // Net displacement of a fixed skin vertex, not integrated frictional slip or a proof of no rolling.
    meaning: 'net fixed-skin-point displacement; contact flags at checkpoints do not prove continuous contact or distinguish sliding from rolling' };
}
