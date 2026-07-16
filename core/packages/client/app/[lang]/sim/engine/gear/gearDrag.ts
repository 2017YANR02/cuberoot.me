/**
 * Gear Cube drag-to-turn.
 *
 * Pointerdown raycasts the whole cube. Hitting ANY piece starts a pending drag;
 * missing falls back to view rotation (handled by CornerTurnGesture). On the first
 * pointermove past a threshold we resolve WHICH face to flip and in which direction
 * from the drag vector, then fire one whole 180° flip (discrete — like the real
 * puzzle, a flip is all-or-nothing).
 *
 * Candidate moves per hit piece = the faces whose move displaces it:
 *  - a corner: its 3 faces;
 *  - a gear: its 2 faces + its ring's primary equator face (U/R/F — the middle
 *    also moves under the opposite face's flip, but that's the same physical slab
 *    motion, so one representative avoids a scoring tie);
 *  - a center: its own face + the primary faces of the two rings it rides;
 *  - the core: U/R/F.
 * Scoring reuses the shared tangential-projection math (cuberDrag.scoreCornerTwist)
 * with the face's outward axis: a positive alignment along +(axis × r) is a
 * counter-clockwise flip = the primed token, so amt = −dir.
 */
import * as THREE from 'three';
import type GearCube from './GearCube';
import { FACE_AXIS, CORNER_POS, RING_SLOT_POS, CENTER_POS, type GearMove } from './gearState';
import { scoreCornerTwist } from '../cuberDrag';

export { applyPartial as gearApplyPartial, snapBack as gearSnapBack } from '../cuberDrag';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _axis = new THREE.Vector3();

/** Result of a successful pick: the hit world point + candidate face indices. */
export interface GearPickHit {
  point: THREE.Vector3;
  candidates: number[];
}

interface GearPieceTag { type: 'corner' | 'gear' | 'center' | 'core'; ring?: number; id: number; }

const dotAxis = (p: readonly [number, number, number], f: number): number =>
  FACE_AXIS[f][0] * p[0] + FACE_AXIS[f][1] * p[1] + FACE_AXIS[f][2] * p[2];

/** Faces (0..5) whose move displaces the piece in its CURRENT slot. */
function candidateFaces(cube: GearCube, tag: GearPieceTag): number[] {
  if (tag.type === 'corner') {
    const p = CORNER_POS[cube.cornerSlotOf(tag.id)];
    return [0, 1, 2, 3, 4, 5].filter((f) => dotAxis(p, f) > 0);
  }
  if (tag.type === 'gear') {
    const r = tag.ring!;
    const p = RING_SLOT_POS[r][cube.gearSlotOf(r, tag.id)];
    const faces = [0, 1, 2, 3, 4, 5].filter((f) => dotAxis(p, f) > 0);
    faces.push(r); // ring r's primary equator face: 0=U, 1=R, 2=F
    return faces;
  }
  if (tag.type === 'center') {
    const slot = cube.centerSlotOf(tag.id);
    const p = CENTER_POS[slot];
    const out = [0, 1, 2, 3, 4, 5].filter((f) => dotAxis(p, f) > 0); // its own face
    // + the primary faces of the two rings whose middle slab it rides (axis ⊥ ring axis;
    // ring r's primary face index = r since U/R/F axes are the ring axes in order)
    for (const r of [0, 1, 2]) if (dotAxis(p, r) === 0) out.push(r);
    return out;
  }
  return [0, 1, 2]; // core: any slab
}

/** Raycast the cube; null = missed every piece (caller orbits the view). */
export function gearPickHit(
  cube: GearCube,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): GearPickHit | null {
  _ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
  scene.updateMatrixWorld();
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObject(cube, true);
  if (hits.length === 0) return null;
  const point = hits[0].point.clone();
  let obj: THREE.Object3D | null = hits[0].object;
  let tag: GearPieceTag | null = null;
  while (obj && obj !== (cube as THREE.Object3D)) {
    if (obj.userData && obj.userData.gearPiece) { tag = obj.userData.gearPiece as GearPieceTag; break; }
    obj = obj.parent;
  }
  if (!tag) return { point, candidates: [0, 1, 2] };
  return { point, candidates: candidateFaces(cube, tag) };
}

export interface GearLivePlan {
  move: GearMove;
  tangentX: number;
  tangentY: number;
}

/** Resolve a pick + screen drag (dx,dy CSS px, y down) into a single-flip move and
 *  the drag-aligned screen tangent (live hold-partial tracking). */
export function gearResolveLive(
  cube: GearCube,
  hit: GearPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): GearLivePlan | null {
  scene.updateMatrixWorld();
  const originWorld = new THREE.Vector3().setFromMatrixPosition(cube.matrixWorld);
  const score = scoreCornerTwist(
    hit.candidates,
    (f) => _axis.set(FACE_AXIS[f][0], FACE_AXIS[f][1], FACE_AXIS[f][2]).transformDirection(scene.matrixWorld),
    hit.point, originWorld, dxPx, dyPx, camera, width, height, 0.2,
  );
  if (!score) return null;
  // dir=+1 = drag along +(axis × r) = counter-clockwise seen from outside = primed.
  return { move: { face: score.corner, amt: score.dir === 1 ? -1 : 1 }, tangentX: score.tangentX, tangentY: score.tangentY };
}

/** Discrete-fire path: just the move. */
export function gearResolveMove(
  cube: GearCube,
  hit: GearPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): GearMove | null {
  return gearResolveLive(cube, hit, scene, camera, dxPx, dyPx, width, height)?.move ?? null;
}
