/**
 * Helicopter Cube drag-to-turn.
 *
 * Pointerdown raycasts the whole cube. Hitting ANY piece (or the core) starts a pending
 * drag; missing falls back to view rotation (SimPage). On the first pointermove past a
 * small threshold we resolve which EDGE to twist from the drag vector and fire the whole
 * 180° move (discrete — like a real Helicopter, an edge twist is all-or-nothing).
 *
 * Every turn is a 180° involution, so there is no clockwise/counter-clockwise choice —
 * the resolved `dir` only orients the live partial-turn sweep so it follows the finger
 * (HeliCube.beginMove(move, dir); ±π are the same end rotation). The tangential-
 * projection scoring + partial-turn helpers are shared in cuberDrag.
 */
import * as THREE from 'three';
import type HeliCube from './HeliCube';
import { EDGE_AXIS, EDGES_AT_CORNER_SLOT, EDGES_AT_WING_SLOT, type HeliMove } from './heliState';
import { scoreCornerTwist } from '../cuberDrag';

export { applyPartial as heliApplyPartial, snapBack as heliSnapBack } from '../cuberDrag';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _axis = new THREE.Vector3();

const ALL_EDGES = Array.from({ length: 12 }, (_, e) => e);

/** Result of a successful pick: the hit world point + candidate edge indices. */
export interface HeliPickHit {
  /** Hit point in world space. */
  point: THREE.Vector3;
  /** Edge indices (0..11) whose twist can move the hit piece at its current position. */
  candidates: number[];
}

/**
 * Raycast the cube. Returns the hit point + candidate edges, or null if the pointer
 * missed every piece (SimPage then orbits). A corner returns its 3 adjacent edges, a
 * wing its 2 edges (by current slot, since pieces permute); a core hit returns all 12.
 */
export function heliPickHit(
  cube: HeliCube,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): HeliPickHit | null {
  _ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
  scene.updateMatrixWorld();
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObject(cube, true);
  if (hits.length === 0) return null;
  const point = hits[0].point.clone();

  // Walk up from the hit mesh to find the owning pivot (carries heliCorner / heliWing).
  let obj: THREE.Object3D | null = hits[0].object;
  while (obj && obj !== cube) {
    const ud = obj.userData;
    if (ud && typeof ud.heliCorner === 'number') {
      const slot = cube.cornerSlotOf(ud.heliCorner as number);
      return { point, candidates: EDGES_AT_CORNER_SLOT[slot].slice() };
    }
    if (ud && typeof ud.heliWing === 'number') {
      const slot = cube.wingSlotOf(ud.heliWing as number);
      return { point, candidates: EDGES_AT_WING_SLOT[slot].slice() };
    }
    obj = obj.parent;
  }
  // core hit — any edge is a candidate
  return { point, candidates: ALL_EDGES.slice() };
}

/** A resolved drag: the move to fire + the live-sweep dir + the drag-aligned screen
 *  tangent (project later drag onto it to advance the turn 0→full). */
export interface HeliLivePlan {
  move: HeliMove;
  dir: 1 | -1;
  tangentX: number;
  tangentY: number;
}

/**
 * Resolve a pick + the screen drag vector (dxPx,dyPx, y down) into the edge twist whose
 * screen-space tangent best aligns with the drag, plus the drag-aligned tangent + sweep
 * dir. Null if no candidate edge aligns with the drag.
 */
export function heliResolveLive(
  cube: HeliCube,
  hit: HeliPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): HeliLivePlan | null {
  scene.updateMatrixWorld();
  const originWorld = new THREE.Vector3().setFromMatrixPosition(cube.matrixWorld);
  const score = scoreCornerTwist(
    hit.candidates,
    (edge) => {
      const a = EDGE_AXIS[edge];
      return _axis.set(a[0], a[1], a[2]).normalize().transformDirection(scene.matrixWorld);
    },
    hit.point, originWorld, dxPx, dyPx, camera, width, height, 0.2,
  );
  if (!score) return null;
  // Bake the drag's sweep sign into the move so the discrete-fire path (twist → beginMove)
  // sweeps the way the finger went — not always the default +π. Notation still ignores dir.
  return { move: { edge: score.corner, dir: score.dir }, dir: score.dir, tangentX: score.tangentX, tangentY: score.tangentY };
}

/** Back-compat discrete-fire path: just the move (no live tracking). */
export function heliResolveMove(
  cube: HeliCube,
  hit: HeliPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): HeliMove | null {
  return heliResolveLive(cube, hit, scene, camera, dxPx, dyPx, width, height)?.move ?? null;
}
