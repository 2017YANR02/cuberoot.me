/**
 * Redi Cube drag-to-turn.
 *
 * Pointerdown raycasts the whole cube. Hitting ANY piece (or the core) starts a
 * pending drag; missing falls back to view rotation (handled by SimPage). On the
 * first pointermove past a small threshold we resolve which corner to twist and in
 * which direction from the drag vector, then fire the whole 120° move (discrete —
 * like a real Redi, a twist is all-or-nothing).
 *
 * Corner + direction picking (skill's tangential-projection rule, like Dino/Ivy):
 * for each CANDIDATE corner (those that can move the hit piece), compute the
 * screen-space tangential direction of a +120° rotation at the hit point =
 * project(p + axis×r) − project(p). Dot with the screen drag vector. Take the corner
 * with the largest |dot|; sign(dot) is the turn direction (never a fixed sign — the
 * tangent flips on opposite sides of the axis).
 *
 * Candidates: an EDGE piece → the 2 corners adjacent to its CURRENT slot; a CORNER
 * piece → only its own corner (corners never permute); the core → all 8.
 */
import * as THREE from 'three';
import type RediCube from './RediCube';
import type { PieceAnim } from './RediCube';
import { CORNER_AXIS, CORNER_CYCLE, type RediMove } from './rediState';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();

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
    return { point, candidates: cornersOfSlot(slot) };
  }
  // core hit — any corner is a candidate
  return { point, candidates: [0, 1, 2, 3, 4, 5, 6, 7] };
}

/** Corners (indices) whose 120° cycle includes this edge slot. */
function cornersOfSlot(slot: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < 8; c++) if (CORNER_CYCLE[c].includes(slot)) out.push(c);
  return out;
}

const _v = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();

/** A resolved drag: the move to fire + the screen-space unit tangent oriented ALONG
 *  the drag, so projecting later drag onto it advances the turn 0→full. */
export interface RediLivePlan {
  move: RediMove;
  tangentX: number;
  tangentY: number;
}

/**
 * Resolve a pick + the screen drag vector (dx,dy in CSS px, y down) into the move
 * AND the drag-aligned screen tangent. Scores each candidate corner by how well the
 * screen tangent of a +120° twist at the grab point aligns with the drag; picks the
 * best, sign(dot) is the direction. Null if no candidate aligns.
 */
export function rediResolveLive(
  cube: RediCube,
  hit: RediPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): RediLivePlan | null {
  scene.updateMatrixWorld();
  const dragX = dxPx;
  const dragY = dyPx; // y down
  const dragLen = Math.hypot(dragX, dragY);
  if (dragLen < 1e-3) return null;
  const pScreen = worldToScreenPx(hit.point, camera, width, height);
  const originWorld = new THREE.Vector3().setFromMatrixPosition(cube.matrixWorld);
  let best: { corner: number; dir: 1 | -1; cos: number; tx: number; ty: number } | null = null;
  for (const corner of hit.candidates) {
    const axisLocal = CORNER_AXIS[corner];
    _v.set(axisLocal[0], axisLocal[1], axisLocal[2]).normalize();
    const axisWorld = _v.clone().transformDirection(scene.matrixWorld);
    const r = hit.point.clone().sub(originWorld);
    const tangentWorld = axisWorld.clone().cross(r);
    if (tangentWorld.lengthSq() < 1e-9) continue;
    _p1.copy(hit.point).add(tangentWorld.multiplyScalar(0.1));
    const tScreen = worldToScreenPx(_p1, camera, width, height);
    let tx = tScreen.x - pScreen.x;
    let ty = tScreen.y - pScreen.y;
    const tLen = Math.hypot(tx, ty);
    if (tLen < 1e-3) continue;
    tx /= tLen; ty /= tLen;
    const dot = tx * dragX + ty * dragY;
    const cos = dot / dragLen;
    if (!best || Math.abs(cos) > Math.abs(best.cos)) {
      best = { corner, dir: dot >= 0 ? 1 : -1, cos, tx, ty };
    }
  }
  if (!best || Math.abs(best.cos) < 0.2) return null;
  return {
    move: { corner: best.corner, dir: best.dir },
    tangentX: best.tx * best.dir,
    tangentY: best.ty * best.dir,
  };
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

/** Live partial-turn helpers (debug "hold half-turn" mode). `anims` come from
 *  RediCube.beginMove; each carries pivot + startQuat + axis + full signed angle. */
export function rediApplyPartial(anims: PieceAnim[], t: number): void {
  const tt = Math.max(0, Math.min(1, t));
  const q = new THREE.Quaternion();
  for (const a of anims) {
    q.setFromAxisAngle(a.axis, a.angle * tt);
    a.pivot.quaternion.multiplyQuaternions(q, a.startQuat);
  }
}

/** Snap the affected pivots back to their pre-turn pose (cancel a frozen turn). */
export function rediSnapBack(anims: PieceAnim[]): void {
  for (const a of anims) a.pivot.quaternion.copy(a.startQuat);
}

function worldToScreenPx(
  p: THREE.Vector3, camera: THREE.Camera, width: number, height: number,
): { x: number; y: number } {
  _p2.copy(p).project(camera);
  return { x: (_p2.x * 0.5 + 0.5) * width, y: (-_p2.y * 0.5 + 0.5) * height };
}
