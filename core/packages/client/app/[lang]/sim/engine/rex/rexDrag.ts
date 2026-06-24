/**
 * Rex Cube drag-to-turn.
 *
 * Pointerdown raycasts the whole cube. Hitting ANY piece (or the core) starts a
 * pending drag; missing falls back to view rotation (handled by SimPage). On the
 * first pointermove past a small threshold we resolve which corner to twist and in
 * which direction from the drag vector, then fire the whole 120° move (discrete —
 * like a real Rex, a twist is all-or-nothing).
 *
 * The tangential-projection scoring + partial-turn helpers are shared in cuberDrag;
 * this file is just the Rex-specific raycast → candidate-corner logic. A hit piece
 * carries its type+id in userData (set in rexGeometry); the cube resolves the
 * candidate corners from the piece's CURRENT slot (pieces permute).
 */
import * as THREE from 'three';
import type RexCube from './RexCube';
import { CORNER_AXIS, type RexMove } from './rexState';
import type { RexPieceType } from './rexGeometry';
import { scoreCornerTwist } from '../cuberDrag';

export { applyPartial as rexApplyPartial, snapBack as rexSnapBack } from '../cuberDrag';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _axis = new THREE.Vector3();

/** Result of a successful pick: the hit world point + candidate corner indices. */
export interface RexPickHit {
  point: THREE.Vector3;
  /** Corner indices (0..7) that can move the hit piece right now. */
  candidates: number[];
}

/**
 * Raycast the cube. Returns the hit point + candidate corners, or null if the
 * pointer missed every piece (SimPage then orbits). Hitting the core returns all
 * 8 corners; a sticker/body returns the corners that can currently turn that piece.
 */
export function rexPickHit(
  cube: RexCube,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): RexPickHit | null {
  _ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
  scene.updateMatrixWorld();
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObject(cube, true);
  if (hits.length === 0) return null;
  const hit = hits[0];
  const point = hit.point.clone();

  // Walk up from the hit mesh to find the owning pivot (carries rexType + rexId).
  let obj: THREE.Object3D | null = hit.object;
  let type: RexPieceType | undefined;
  let id = -1;
  while (obj && obj !== cube) {
    if (obj.userData && typeof obj.userData.rexType === 'string') {
      type = obj.userData.rexType as RexPieceType;
      id = obj.userData.rexId as number;
      break;
    }
    obj = obj.parent;
  }
  if (type === undefined || id < 0) {
    return { point, candidates: [0, 1, 2, 3, 4, 5, 6, 7] }; // core / untagged → any corner
  }
  return { point, candidates: cube.candidateCornersForPiece(type, id) };
}

/** A resolved drag: the move to fire + the screen-space unit tangent oriented
 *  ALONG the drag (for live "hold partial turn" tracking). */
export interface RexLivePlan {
  move: RexMove;
  tangentX: number;
  tangentY: number;
}

/**
 * Resolve a pick + the screen drag vector (dx,dy in CSS px, y down) into the move
 * AND the drag-aligned screen tangent. Null if no candidate corner aligns.
 */
export function rexResolveLive(
  cube: RexCube,
  hit: RexPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): RexLivePlan | null {
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
export function rexResolveMove(
  cube: RexCube,
  hit: RexPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): RexMove | null {
  return rexResolveLive(cube, hit, scene, camera, dxPx, dyPx, width, height)?.move ?? null;
}
