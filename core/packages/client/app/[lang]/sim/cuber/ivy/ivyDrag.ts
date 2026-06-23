/**
 * Ivy drag-to-turn helpers (mirrors sq1Drag.ts, but for a corner-turning puzzle).
 *
 * Grab ANYWHERE on the cube and drag → it turns. Pointerdown raycasts the cube:
 *   - hit a petal  → candidate corners = [that petal's corner];
 *   - hit a lens   → candidate corners = the grabbed center's LIVE face's 2 corners;
 *   - hit a groove / black body → candidate corners = all 4;
 *   - missed the cube entirely → null (SimPage orbits the view; on-cube never orbits).
 * On drag we score each candidate corner by how well the screen-space tangent of
 * rotating the grab point about that corner's body diagonal aligns with the drag
 * vector, then fire the best (corner, direction). So the drag direction itself
 * picks the corner — no need to hit a thin petal precisely. An Ivy move is a
 * discrete 120° twist, so it fires once past a small threshold (no live
 * finger-tracking yet). IvyCube.pickMove folds in baseSign so the chosen power
 * keeps the discrete state in sync with lib/ivy-solver.
 */
import * as THREE from 'three';
import type IvyCube from './IvyCube';
import type { IvyMove, IvyAnim } from './IvyCube';

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

function project(p: THREE.Vector3, camera: THREE.Camera, width: number, height: number): { x: number; y: number } {
  const v = p.clone().project(camera); // NDC, y up
  return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
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
  const dragX = curX - downX;
  const dragY = curY - downY; // screen px, y down
  const p0 = project(hit.pointWorld, camera, width, height);
  const r = hit.pointWorld.clone().sub(hit.centerWorld);
  let bestAxis = -1;
  let bestScore = 0;
  let bestTx = 0, bestTy = 0;
  for (const axis of hit.candidates) {
    const axisWorld = cube.cornerAxisVec(axis).transformDirection(cube.matrixWorld);
    const tangent = new THREE.Vector3().crossVectors(axisWorld, r);
    if (tangent.lengthSq() < 1e-9) continue;
    tangent.normalize();
    const p1 = project(hit.pointWorld.clone().add(tangent), camera, width, height);
    let tx = p1.x - p0.x;
    let ty = p1.y - p0.y;
    const tl = Math.hypot(tx, ty);
    if (tl < 1e-6) continue;
    tx /= tl; ty /= tl;
    const s = dragX * tx + dragY * ty; // signed alignment of the drag with +rotation
    if (Math.abs(s) > Math.abs(bestScore)) { bestScore = s; bestAxis = axis; bestTx = tx; bestTy = ty; }
  }
  if (bestAxis < 0) return null;
  // geomSign: +1 when the drag goes along +tangent (positive rotation about the
  // corner axis). pickMove folds in baseSign to choose the power (R vs R').
  const sign = bestScore >= 0 ? 1 : -1;
  // Orient the tangent along the drag so (laterDrag·tangent)/PX grows 0→1.
  return { move: cube.pickMove(bestAxis, sign), tangentX: bestTx * sign, tangentY: bestTy * sign };
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

/** Live partial-turn helpers (debug "hold half-turn" mode). `anims` come from
 *  IvyCube.beginMove; each carries pivot + startQuat + axis + full signed angle. */
export function ivyApplyPartial(anims: IvyAnim[], t: number): void {
  const tt = Math.max(0, Math.min(1, t));
  const q = new THREE.Quaternion();
  for (const a of anims) {
    q.setFromAxisAngle(a.axis, a.angle * tt);
    a.pivot.quaternion.multiplyQuaternions(q, a.startQuat);
  }
}

/** Snap the affected pivots back to their pre-turn pose (cancel a frozen turn). */
export function ivySnapBack(anims: IvyAnim[]): void {
  for (const a of anims) a.pivot.quaternion.copy(a.startQuat);
}
