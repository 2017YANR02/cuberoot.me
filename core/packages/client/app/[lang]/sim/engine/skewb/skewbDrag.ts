/**
 * Skewb drag-to-turn.
 *
 * Pointerdown raycasts the whole cube. Hitting ANY piece (or the core) starts a
 * pending drag; missing falls back to view rotation (handled by SimPage). On the
 * first pointermove past a small threshold we resolve which grip to twist and in
 * which direction from the drag vector, then fire the whole 120° move (discrete —
 * like a real Skewb, a twist is all-or-nothing).
 *
 * The tangential-projection scoring + partial-turn helpers are shared in cuberDrag;
 * this file is just the Skewb-specific raycast → candidate-grip logic. A piece can be
 * moved by every grip whose cap contains it = every grip whose body diagonal points
 * to the same side as the piece's current slot (axis·pos > 0).
 */
import * as THREE from 'three';
import type SkewbCube from './SkewbCube';
import { CORNER_AXIS, CENTER_AXIS, type SkewbMove } from './skewbState';
import { scoreCornerTwist } from '../cuberDrag';

export { applyPartial as skewbApplyPartial, snapBack as skewbSnapBack } from '../cuberDrag';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _axis = new THREE.Vector3();

/** Grips (0..7) whose cap contains a piece sitting at outward direction `pos`. */
function gripsForDir(pos: readonly number[]): number[] {
  const out: number[] = [];
  for (let g = 0; g < 8; g++) {
    const a = CORNER_AXIS[g];
    if (a[0] * pos[0] + a[1] * pos[1] + a[2] * pos[2] > 1e-6) out.push(g);
  }
  return out;
}

export interface SkewbPickHit {
  /** Hit point in world space. */
  point: THREE.Vector3;
  /** Grip indices (0..7) that can move the hit piece. */
  candidates: number[];
}

/**
 * Raycast the cube. Returns the hit point + candidate grips, or null if the pointer
 * missed every piece (SimPage then orbits). Hitting the core returns all 8 grips;
 * a corner/centre returns the 4 grips whose cap currently contains it.
 */
export function skewbPickHit(
  cube: SkewbCube,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): SkewbPickHit | null {
  _ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
  scene.updateMatrixWorld();
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObject(cube, true);
  if (hits.length === 0) return null;
  const point = hits[0].point.clone();

  // Walk up to the owning pivot (carries skewbCorner / skewbCenter = pieceId).
  let obj: THREE.Object3D | null = hits[0].object;
  let cornerId = -1, centerId = -1;
  while (obj && obj !== cube) {
    if (typeof obj.userData?.skewbCorner === 'number') { cornerId = obj.userData.skewbCorner as number; break; }
    if (typeof obj.userData?.skewbCenter === 'number') { centerId = obj.userData.skewbCenter as number; break; }
    obj = obj.parent;
  }
  if (cornerId >= 0) {
    const slot = cube.state.cornerPerm.indexOf(cornerId);
    return { point, candidates: gripsForDir(CORNER_AXIS[slot]) };
  }
  if (centerId >= 0) {
    const slot = cube.state.centerPerm.indexOf(centerId);
    return { point, candidates: gripsForDir(CENTER_AXIS[slot]) };
  }
  return { point, candidates: [0, 1, 2, 3, 4, 5, 6, 7] }; // core
}

export interface SkewbLivePlan {
  move: SkewbMove;
  tangentX: number;
  tangentY: number;
}

/** Resolve a pick + screen drag vector into the move + drag-aligned screen tangent. */
export function skewbResolveLive(
  cube: SkewbCube,
  hit: SkewbPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): SkewbLivePlan | null {
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

/** Discrete-fire path: just the move (no live tracking). */
export function skewbResolveMove(
  cube: SkewbCube,
  hit: SkewbPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): SkewbMove | null {
  return skewbResolveLive(cube, hit, scene, camera, dxPx, dyPx, width, height)?.move ?? null;
}
