/**
 * Redi Cube drag-to-turn.
 *
 * Pointerdown raycasts the whole cube. Hitting ANY piece (or the core) starts a
 * pending drag; missing falls back to view rotation (handled by SimPage). On the
 * first pointermove past a small threshold we resolve which corner to twist and in
 * which direction from the drag vector, then fire the whole 120° move (discrete).
 *
 * The tangential-projection scoring + partial-turn helpers are shared in cuberDrag;
 * this file is just the Redi-specific raycast → candidate-corner logic. Candidates:
 * an EDGE piece → the 2 corners adjacent to its CURRENT slot; a CORNER piece → only
 * its own corner (corners never permute); the core → all 8.
 */
import * as THREE from 'three';
import type RediCube from './RediCube';
import { CORNER_AXIS, CORNER_CYCLE, type RediMove } from './rediState';
import { cornersOfSlot, scoreCornerTwist } from '../cuberDrag';

export { applyPartial as rediApplyPartial, snapBack as rediSnapBack } from '../cuberDrag';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _axis = new THREE.Vector3();

/** Result of a successful pick: the hit world point + candidate corner indices. */
export interface RediPickHit {
  point: THREE.Vector3;
  candidates: number[];
}

/**
 * Raycast the cube. Returns the hit point + candidate corners, or null if the
 * pointer missed every piece (SimPage then orbits).
 */
export function rediPickHit(
  cube: RediCube,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): RediPickHit | null {
  _ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
  scene.updateMatrixWorld();
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObject(cube, true);
  if (hits.length === 0) return null;
  const hit = hits[0];
  const point = hit.point.clone();

  // Walk up from the hit mesh to find the owning pivot (carries rediEdgeSlot =
  // pieceId, or rediCornerId).
  let obj: THREE.Object3D | null = hit.object;
  let edgePieceId = -1;
  let cornerId = -1;
  while (obj && obj !== cube) {
    if (obj.userData && typeof obj.userData.rediEdgeSlot === 'number') { edgePieceId = obj.userData.rediEdgeSlot; break; }
    if (obj.userData && typeof obj.userData.rediCornerId === 'number') { cornerId = obj.userData.rediCornerId; break; }
    obj = obj.parent;
  }
  if (cornerId >= 0) return { point, candidates: [cornerId] };
  if (edgePieceId >= 0) {
    const slot = cube.state.edges.indexOf(edgePieceId);
    return { point, candidates: cornersOfSlot(slot, CORNER_CYCLE) };
  }
  // core hit — any corner is a candidate
  return { point, candidates: [0, 1, 2, 3, 4, 5, 6, 7] };
}

/** A resolved drag: the move to fire + the screen-space unit tangent oriented ALONG
 *  the drag, so projecting later drag onto it advances the turn 0→full. */
export interface RediLivePlan {
  move: RediMove;
  tangentX: number;
  tangentY: number;
}

/**
 * Resolve a pick + the screen drag vector (dx,dy in CSS px, y down) into the move
 * AND the drag-aligned screen tangent (see cuberDrag.scoreCornerTwist). Null if no
 * candidate corner aligns with the drag.
 */
export function rediResolveLive(
  cube: RediCube,
  hit: RediPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): RediLivePlan | null {
  scene.updateMatrixWorld();
  const originWorld = new THREE.Vector3().setFromMatrixPosition(cube.matrixWorld);
  const score = scoreCornerTwist(
    hit.candidates,
    (corner) => {
      const a = CORNER_AXIS[corner];
      return _axis.set(a[0], a[1], a[2]).normalize().transformDirection(scene.matrixWorld);
    },
    hit.point, originWorld, dxPx, dyPx, camera, width, height, 0.2,
  );
  if (!score) return null;
  return { move: { corner: score.corner, dir: score.dir }, tangentX: score.tangentX, tangentY: score.tangentY };
}

/** Back-compat discrete-fire path: just the move (no live tracking). */
export function rediResolveMove(
  cube: RediCube,
  hit: RediPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): RediMove | null {
  return rediResolveLive(cube, hit, scene, camera, dxPx, dyPx, width, height)?.move ?? null;
}
