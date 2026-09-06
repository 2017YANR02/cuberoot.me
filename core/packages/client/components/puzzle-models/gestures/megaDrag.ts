/**
 * Megaminx drag-to-turn.
 *
 * Pointerdown raycasts the whole cube. Hitting ANY piece (or the core) starts a pending
 * drag; missing falls back to view rotation (SimPage). On the first pointermove past a
 * small threshold we resolve which FACE to turn and in which direction from the drag
 * vector (the candidate faces = the faces of the hit piece's current slot), then fire the
 * whole 72° move (discrete — like a real megaminx, a turn is all-or-nothing).
 *
 * The tangential-projection scoring + partial-turn helpers are shared in cuberDrag; this
 * file is just the megaminx-specific raycast → candidate-face logic.
 */
import * as THREE from 'three';
import type MegaminxCube from '@cuberoot/puzzle-render-core/engine/mega/MegaminxCube';
import { FACE_NORMAL, type MegaMove } from '@cuberoot/puzzle-render-core/engine/mega/megaState';
import { scoreCornerTwist } from './cuberDrag';

export { applyPartial as megaApplyPartial, snapBack as megaSnapBack } from './cuberDrag';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _axis = new THREE.Vector3();
const ALL_FACES = Array.from({ length: 12 }, (_, i) => i);

/** Result of a successful pick: the hit world point + candidate face indices (0..11). */
export interface MegaPickHit {
  point: THREE.Vector3;
  candidates: number[];
}

/**
 * Raycast the cube. Returns the hit point + candidate faces, or null if the pointer missed
 * every piece (SimPage then orbits). Hitting the core returns all 12 faces (any could be
 * intended); a piece returns the faces of its CURRENT slot (corner → 3, edge → 2, center → 1).
 */
export function megaPickHit(
  cube: MegaminxCube,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): MegaPickHit | null {
  _ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
  scene.updateMatrixWorld();
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObject(cube, true);
  if (hits.length === 0) return null;
  const point = hits[0].point.clone();

  // Walk up from the hit mesh to the owning pivot (carries megaCornerId / megaEdgeId /
  // megaCenterFace).
  let obj: THREE.Object3D | null = hits[0].object;
  while (obj && obj !== cube) {
    const d = obj.userData;
    if (typeof d?.megaCornerId === 'number') {
      return { point, candidates: cube.cornerFaces(d.megaCornerId as number) };
    }
    if (typeof d?.megaEdgeId === 'number') {
      return { point, candidates: cube.edgeFaces(d.megaEdgeId as number) };
    }
    if (typeof d?.megaCenterFace === 'number') {
      return { point, candidates: [cube.centerFace(d.megaCenterFace as number)] };
    }
    obj = obj.parent;
  }
  return { point, candidates: ALL_FACES }; // core / unowned hit
}

/** A resolved drag: the move to fire + the drag-aligned screen tangent (for live "hold
 *  partial turn" tracking). */
export interface MegaLivePlan {
  move: MegaMove;
  tangentX: number;
  tangentY: number;
}

function resolveLiveForAxes(
  cube: MegaminxCube,
  hit: MegaPickHit,
  axes: readonly number[],
  deepForAxis: (face: number) => boolean,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): MegaLivePlan | null {
  scene.updateMatrixWorld();
  const originWorld = new THREE.Vector3().setFromMatrixPosition(cube.matrixWorld);
  const score = scoreCornerTwist(
    axes,
    (face) => {
      const a = FACE_NORMAL[face];
      return _axis.set(a[0], a[1], a[2]).normalize().transformDirection(cube.matrixWorld);
    },
    hit.point, originWorld, dxPx, dyPx, camera, width, height, 0.2,
  );
  if (!score) return null;
  const dir = (score.dir * cube.turnSign[score.corner]) as 1 | -1;
  const deep = deepForAxis(score.corner);
  return {
    move: { face: score.corner, dir, ...(deep ? { deep: true } : {}) },
    tangentX: score.tangentX,
    tangentY: score.tangentY,
  };
}

/**
 * Resolve a pick + the screen drag vector (dx,dy in CSS px, y down) into the face move AND
 * the drag-aligned screen tangent (see cuberDrag.scoreCornerTwist). Null if no candidate
 * face aligns with the drag.
 */
export function megaResolveLive(
  cube: MegaminxCube,
  hit: MegaPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): MegaLivePlan | null {
  return resolveLiveForAxes(
    cube,
    hit,
    hit.candidates,
    () => false,
    scene, camera, dxPx, dyPx, width, height,
  );
}

/** Back-compat discrete-fire path: just the move (no live tracking). */
export function megaResolveMove(
  cube: MegaminxCube,
  hit: MegaPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): MegaMove | null {
  return megaResolveLive(cube, hit, scene, camera, dxPx, dyPx, width, height)?.move ?? null;
}

/**
 * WCA Megaminx training exposes only U/U' plus the Pochmann R++/R-- and D++/D--
 * turns. A sticker on the stationary U cap selects shallow U; any other sticker can
 * select deep D. Deep R is available everywhere except the stationary L cap. The
 * drag scorer and animation remain the canonical `/sim` implementations.
 */
export function megaResolveWcaLive(
  cube: MegaminxCube,
  hit: MegaPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): MegaLivePlan | null {
  const axes = [0];
  if (!hit.candidates.includes(2)) axes.push(2);
  return resolveLiveForAxes(
    cube,
    hit,
    axes,
    face => face === 2 || (face === 0 && !hit.candidates.includes(0)),
    scene, camera, dxPx, dyPx, width, height,
  );
}

export function megaResolveWcaMove(
  cube: MegaminxCube,
  hit: MegaPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): MegaMove | null {
  return megaResolveWcaLive(cube, hit, scene, camera, dxPx, dyPx, width, height)?.move ?? null;
}
