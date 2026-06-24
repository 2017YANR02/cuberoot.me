/**
 * Ivy drag-to-turn helpers (corner-turning puzzle).
 *
 * Grab ANYWHERE on the cube and drag → it turns. Pointerdown raycasts the cube:
 *   - hit a petal  → candidate corners = [that petal's corner];
 *   - hit a lens   → candidate corners = the grabbed center's LIVE face's 2 corners;
 *   - hit a groove / black body → candidate corners = all 4;
 *   - missed the cube entirely → null (SimPage orbits the view; on-cube never orbits).
 * On drag we score each candidate corner by how well the screen-space tangent of
 * rotating the grab point about that corner's body diagonal aligns with the drag
 * (shared cuberDrag.scoreCornerTwist), then fire the best (corner, direction).
 * IvyCube.pickMove folds in baseSign so the chosen power keeps the discrete state in
 * sync with the /sim's notation.
 */
import * as THREE from 'three';
import type IvyCube from './IvyCube';
import type { IvyMove } from './IvyCube';
import { scoreCornerTwist } from '../cuberDrag';

export { applyPartial as ivyApplyPartial, snapBack as ivySnapBack } from '../cuberDrag';

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

export interface IvyHit {
  /** Grab point in world space (captured at gesture start). */
  pointWorld: THREE.Vector3;
  /** Cube center (world origin) at gesture start. */
  centerWorld: THREE.Vector3;
  /** Turning-corner axes that can move the grabbed piece. */
  candidates: number[];
}

/** Raycast the cube. Any hit returns the grab + the corners that can move it (so
 *  a drag can be resolved to a turn); only an off-cube miss returns null → orbit. */
export function ivyPickHit(
  cube: IvyCube,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): IvyHit | null {
  scene.updateMatrixWorld();
  _ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObject(cube, true);
  if (hits.length === 0) return null; // off the cube → orbit
  // Only the nearest hit decides — never drill through a tile to one behind it.
  let candidates: number[] | null = null;
  let cur: THREE.Object3D | null = hits[0].object;
  while (cur && cur !== cube) {
    const ud = cur.userData as { ivyCornerAxis?: number; ivyCenterPiece?: number };
    if (typeof ud.ivyCornerAxis === 'number') { candidates = [ud.ivyCornerAxis]; break; }
    if (typeof ud.ivyCenterPiece === 'number') { candidates = cube.cornersForCenterPiece(ud.ivyCenterPiece); break; }
    cur = cur.parent;
  }
  if (!candidates || candidates.length === 0) candidates = [0, 1, 2, 3]; // groove/body → any
  const centerWorld = new THREE.Vector3().setFromMatrixPosition(cube.matrixWorld);
  return { pointWorld: hits[0].point.clone(), centerWorld, candidates };
}

/** Result of resolving a drag: the move + the screen-space unit tangent ORIENTED
 *  along the drag, so projecting later drag onto it advances the turn 0→full. */
export interface IvyLivePlan {
  move: IvyMove;
  tangentX: number;
  tangentY: number;
}

/** Resolve the started grab + current pointer into the move to fire AND the
 *  drag-aligned tangent (for live partial tracking). Scores each candidate corner
 *  by drag·(screen tangent of rotating the grab about its axis), picks the best.
 *  Null only if every candidate is degenerate (axis edge-on at the grab point). */
export function ivyResolveLive(
  cube: IvyCube,
  camera: THREE.Camera,
  hit: IvyHit,
  downX: number, downY: number,
  curX: number, curY: number,
  width: number, height: number,
): IvyLivePlan | null {
  const score = scoreCornerTwist(
    hit.candidates,
    (axis) => cube.cornerAxisVec(axis).transformDirection(cube.matrixWorld),
    hit.pointWorld, hit.centerWorld,
    curX - downX, curY - downY,
    camera, width, height,
  );
  if (!score) return null;
  // pickMove folds in baseSign to choose the power (R vs R') from the geometric sign.
  return { move: cube.pickMove(score.corner, score.dir), tangentX: score.tangentX, tangentY: score.tangentY };
}

/** Back-compat: just the move (discrete-fire path). */
export function ivyResolveMove(
  cube: IvyCube,
  camera: THREE.Camera,
  hit: IvyHit,
  downX: number, downY: number,
  curX: number, curY: number,
  width: number, height: number,
): IvyMove | null {
  return ivyResolveLive(cube, camera, hit, downX, downY, curX, curY, width, height)?.move ?? null;
}
