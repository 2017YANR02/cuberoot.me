/**
 * FTO drag-to-turn.
 *
 * Pointerdown raycasts the whole cube. Hitting ANY cell (visible or black) starts a pending
 * drag; missing falls back to view rotation (SimPage). On the first pointermove past a small
 * threshold we resolve which FACE to turn and in which direction from the drag vector (the
 * candidate faces = the faces whose cap currently contains the hit piece), then fire the
 * whole 120° move (discrete — like a real FTO, a turn is all-or-nothing).
 *
 * Pure-geometric: there's no discrete slot table; the hit pivot carries its home centre
 * (userData.ftoCenter) and the cube reads its live cap faces. Scoring + partial-turn helpers
 * are shared in cuberDrag; this file is just the FTO raycast → candidate-face logic.
 */
import * as THREE from 'three';
import type FtoCube from './FtoCube';
import { FACE_NORMAL, type FtoMove } from './ftoState';
import { scoreCornerTwist } from '../cuberDrag';

export { applyPartial as ftoApplyPartial, snapBack as ftoSnapBack } from '../cuberDrag';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _axis = new THREE.Vector3();

/** Result of a successful pick: the hit world point + candidate face indices (0..7). */
export interface FtoPickHit {
  point: THREE.Vector3;
  candidates: number[];
}

/**
 * Raycast the cube. Returns the hit point + candidate faces, or null if the pointer missed
 * every cell (SimPage then orbits). Walks up to the owning pivot and reads the faces whose
 * cap currently contains it (corner → 4, edge → 2, centre → 3; core → all 8).
 */
export function ftoPickHit(
  cube: FtoCube,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): FtoPickHit | null {
  _ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
  scene.updateMatrixWorld();
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObject(cube, true);
  if (hits.length === 0) return null;
  const point = hits[0].point.clone();
  // Walk up from the hit mesh to the pivot directly parented to the cube.
  let obj: THREE.Object3D | null = hits[0].object;
  while (obj && obj.parent && obj.parent !== cube) obj = obj.parent;
  const pivot = obj && obj.parent === cube ? obj : null;
  const candidates = pivot ? cube.capFacesOf(pivot) : [0, 1, 2, 3, 4, 5, 6, 7];
  return { point, candidates };
}

/** A resolved drag: the move to fire + the drag-aligned screen tangent (for live "hold
 *  partial turn" tracking). */
export interface FtoLivePlan {
  move: FtoMove;
  tangentX: number;
  tangentY: number;
}

/**
 * Resolve a pick + the screen drag vector (dx,dy in CSS px, y down) into the face move AND
 * the drag-aligned screen tangent. Null if no candidate face aligns with the drag. The
 * cube rotates `dir·120°` about the (local) +face normal directly, so `score.dir` IS the
 * engine move.dir (no turn-sense remap).
 */
export function ftoResolveLive(
  cube: FtoCube,
  hit: FtoPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): FtoLivePlan | null {
  scene.updateMatrixWorld();
  const originWorld = new THREE.Vector3().setFromMatrixPosition(cube.matrixWorld);
  const score = scoreCornerTwist(
    hit.candidates,
    (face) => {
      const a = FACE_NORMAL[face];
      return _axis.set(a[0], a[1], a[2]).normalize().transformDirection(scene.matrixWorld);
    },
    hit.point, originWorld, dxPx, dyPx, camera, width, height, 0.2,
  );
  if (!score) return null;
  return { move: { face: score.corner, dir: score.dir }, tangentX: score.tangentX, tangentY: score.tangentY };
}

/** Back-compat discrete-fire path: just the move (no live tracking). */
export function ftoResolveMove(
  cube: FtoCube,
  hit: FtoPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): FtoMove | null {
  return ftoResolveLive(cube, hit, scene, camera, dxPx, dyPx, width, height)?.move ?? null;
}
