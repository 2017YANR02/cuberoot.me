/**
 * Dino Cube drag-to-turn.
 *
 * Pointerdown raycasts the whole cube. Hitting ANY piece (or the core) starts a
 * pending drag; missing falls back to view rotation (handled by SimPage). On the
 * first pointermove past a small threshold we resolve which corner to twist and in
 * which direction from the drag vector, then fire the whole 120° move (discrete —
 * like a real Dino, a twist is all-or-nothing).
 *
 * Corner + direction picking (skill's tangential-projection rule, generalized from
 * Ivy): for each CANDIDATE corner (the corners that can move the hit piece — i.e.
 * the corners adjacent to the hit piece's CURRENT slot), compute the screen-space
 * tangential direction of a +120° rotation at the hit point = project(p + axis×r) −
 * project(p). Dot with the screen drag vector. Take the corner with the largest
 * |dot|; sign(dot) is the turn direction. (Never a fixed sign — the tangent flips
 * on opposite sides of the axis.)
 */
import * as THREE from 'three';
import type DinoCube from './DinoCube';
import type { PieceAnim } from './DinoCube';
import {
  CORNER_AXIS, CORNER_CYCLE, type DinoMove,
} from './dinoState';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();

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
  const candidates = cornersOfSlot(slot);
  return { point, candidates };
}

/** Corners (indices) whose 120° cycle includes this slot. */
function cornersOfSlot(slot: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < 8; c++) if (CORNER_CYCLE[c].includes(slot)) out.push(c);
  return out;
}

const _v = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();

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
 * AND the drag-aligned screen tangent. Scores each candidate corner by how well the
 * screen tangent of a +120° twist at the grab point aligns with the drag; picks the
 * best, sign(dot) is the direction (never a fixed sign — the tangent flips across
 * the axis). Null if no candidate aligns. All math in y-down screen px so SimPage
 * can project later drag with the same sign convention.
 */
export function dinoResolveLive(
  cube: DinoCube,
  hit: DinoPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): DinoLivePlan | null {
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
    // tangential world direction at hit point for +120°: axis × (point - origin).
    const r = hit.point.clone().sub(originWorld);
    const tangentWorld = axisWorld.clone().cross(r);
    if (tangentWorld.lengthSq() < 1e-9) continue;
    // screen tangent = project(point + tangent) - project(point), y down
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
  // Orient the unit tangent along the drag so (laterDrag·tangent)/PX grows 0→1.
  return {
    move: { corner: best.corner, dir: best.dir },
    tangentX: best.tx * best.dir,
    tangentY: best.ty * best.dir,
  };
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

/** Live partial-turn helpers (debug "hold half-turn" mode). `anims` come from
 *  DinoCube.beginMove; each carries pivot + startQuat + axis + full signed angle. */
export function dinoApplyPartial(anims: PieceAnim[], t: number): void {
  const tt = Math.max(0, Math.min(1, t));
  const q = new THREE.Quaternion();
  for (const a of anims) {
    q.setFromAxisAngle(a.axis, a.angle * tt);
    a.pivot.quaternion.multiplyQuaternions(q, a.startQuat);
  }
}

/** Snap the affected pivots back to their pre-turn pose (cancel a frozen turn). */
export function dinoSnapBack(anims: PieceAnim[]): void {
  for (const a of anims) a.pivot.quaternion.copy(a.startQuat);
}

function worldToScreenPx(
  p: THREE.Vector3, camera: THREE.Camera, width: number, height: number,
): { x: number; y: number } {
  _p2.copy(p).project(camera);
  return {
    x: (_p2.x * 0.5 + 0.5) * width,
    y: (-_p2.y * 0.5 + 0.5) * height,
  };
}
