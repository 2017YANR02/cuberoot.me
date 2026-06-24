/**
 * Dino Cube drag-to-turn.
 *
 * Pointerdown raycasts the whole cube. Hitting ANY piece (or the core) starts a
 * pending drag; missing falls back to view rotation (handled by SimPage). On the
 * first pointermove past a small threshold we resolve which corner to twist and in
 * which direction from the drag vector, then fire the whole 120° move (discrete —
 * like a real Dino, a twist is all-or-nothing).
 *
 * The tangential-projection scoring + partial-turn helpers are shared in cuberDrag;
 * this file is just the Dino-specific raycast → candidate-corner logic.
 */
import * as THREE from 'three';
import type DinoCube from './DinoCube';
import { CORNER_AXIS, CORNER_CYCLE, type DinoMove } from './dinoState';
import { cornersOfSlot, scoreCornerTwist } from '../cuberDrag';

export { applyPartial as dinoApplyPartial, snapBack as dinoSnapBack } from '../cuberDrag';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _axis = new THREE.Vector3();

/** Result of a successful pick: the hit world point + candidate corner indices. */
export interface DinoPickHit {
  /** Hit point in world space. */
  point: THREE.Vector3;
  /** Corner indices (0..7) that can move the hit piece. */
  candidates: number[];
}

/**
 * Raycast the cube. Returns the hit point + candidate corners, or null if the
 * pointer missed every piece (SimPage then orbits). Hitting the core returns all
 * 8 corners as candidates (any could be intended); a sticker/body returns the 2
 * corners adjacent to that piece's current slot.
 */
export function dinoPickHit(
  cube: DinoCube,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): DinoPickHit | null {
  _ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
  scene.updateMatrixWorld();
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObject(cube, true);
  if (hits.length === 0) return null;
  const hit = hits[0];
  const point = hit.point.clone();

  // Walk up from the hit mesh to find the owning pivot (carries dinoSlot = pieceId).
  let obj: THREE.Object3D | null = hit.object;
  let pieceId = -1;
  while (obj && obj !== cube) {
    if (obj.userData && typeof obj.userData.dinoSlot === 'number') {
      pieceId = obj.userData.dinoSlot as number;
      break;
    }
    obj = obj.parent;
  }
  if (pieceId < 0) {
    // core hit — any corner is a candidate
    return { point, candidates: [0, 1, 2, 3, 4, 5, 6, 7] };
  }
  // current slot of this piece = where perm maps it
  const slot = cube.perm.indexOf(pieceId);
  return { point, candidates: cornersOfSlot(slot, CORNER_CYCLE) };
}

/** A resolved drag: the move to fire + the screen-space unit tangent oriented
 *  ALONG the drag, so projecting later drag onto it advances the turn 0→full (for
 *  live "hold partial turn" tracking). */
export interface DinoLivePlan {
  move: DinoMove;
  tangentX: number;
  tangentY: number;
}

/**
 * Resolve a pick + the screen drag vector (dx,dy in CSS px, y down) into the move
 * AND the drag-aligned screen tangent (see cuberDrag.scoreCornerTwist). Null if no
 * candidate corner aligns with the drag.
 */
export function dinoResolveLive(
  cube: DinoCube,
  hit: DinoPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): DinoLivePlan | null {
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
export function dinoResolveMove(
  cube: DinoCube,
  hit: DinoPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): DinoMove | null {
  return dinoResolveLive(cube, hit, scene, camera, dxPx, dyPx, width, height)?.move ?? null;
}
