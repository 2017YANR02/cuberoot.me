/**
 * Shared drag-to-turn math for the corner-turning cuber engines (Ivy / Dino / Redi).
 *
 * All three resolve a drag the same way: grab anywhere on the cube, then score each
 * CANDIDATE corner by how well the screen-space tangent of a ±120° twist at the grab
 * point aligns with the drag vector, and fire the best (corner, direction). The
 * partial-turn application + snap-back + screen projection are byte-identical across
 * the three; this module owns them so each puzzle's drag file is just its own
 * raycast/candidate logic plus thin wrappers SimPage keeps importing.
 */
import * as THREE from 'three';
import type { PieceAnim } from './pieceAnim';

const _q = new THREE.Quaternion();

/** Apply a partial turn (t∈[0,1]) to anims from a cube's beginMove — multiply each
 *  pivot's start orientation by a fraction of the move's rotation. Shared by every
 *  corner-turn drag for the debug "hold partial turn" mode. */
export function applyPartial(anims: PieceAnim[], t: number): void {
  const tt = Math.max(0, Math.min(1, t));
  for (const a of anims) {
    _q.setFromAxisAngle(a.axis, a.angle * tt);
    a.pivot.quaternion.multiplyQuaternions(_q, a.startQuat);
  }
}

/** Snap the affected pivots back to their pre-turn pose (cancel a frozen turn). */
export function snapBack(anims: PieceAnim[]): void {
  for (const a of anims) a.pivot.quaternion.copy(a.startQuat);
}

const _proj = new THREE.Vector3();

/** Project a world point to CSS pixels (y down). */
export function worldToScreenPx(
  p: THREE.Vector3, camera: THREE.Camera, width: number, height: number,
): { x: number; y: number } {
  _proj.copy(p).project(camera);
  return { x: (_proj.x * 0.5 + 0.5) * width, y: (-_proj.y * 0.5 + 0.5) * height };
}

/** Corners (indices) whose 120° cycle includes this slot. */
export function cornersOfSlot(
  slot: number, cornerCycle: ReadonlyArray<readonly number[]>,
): number[] {
  const out: number[] = [];
  for (let c = 0; c < cornerCycle.length; c++) if (cornerCycle[c].includes(slot)) out.push(c);
  return out;
}

export interface CornerTwistScore {
  /** Winning candidate corner index (as passed in `candidates`). */
  corner: number;
  /** Turn direction: +1 along the corner's +120°, −1 along −120°. */
  dir: 1 | -1;
  /** Screen-space unit tangent ORIENTED along the drag, so projecting later drag
   *  onto it advances the turn 0→full (live partial-turn tracking). */
  tangentX: number;
  tangentY: number;
}

const _r = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _tmp = new THREE.Vector3();

/**
 * Score each candidate corner by how well the screen-space tangent of a +120° twist
 * at the grab point aligns with the drag vector (dragX,dragY in CSS px, y down).
 * Returns the best corner + sign(alignment) as the direction + the drag-aligned unit
 * tangent, or null if no candidate aligns above `minCos`.
 *
 * The tangent direction NEVER uses a fixed sign — it flips on opposite sides of the
 * axis, so the dot product's sign is the only correct source of the turn direction.
 *
 * `axisWorldOf(corner)` returns that corner's twist axis already transformed to world
 * space (each puzzle uses its own transform — Dino/Redi via the scene matrix, Ivy via
 * the cube matrix — so the exact transform stays with the caller). The returned
 * vector is read immediately, so the caller may reuse a scratch vector for it.
 */
export function scoreCornerTwist(
  candidates: number[],
  axisWorldOf: (corner: number) => THREE.Vector3,
  pointWorld: THREE.Vector3,
  originWorld: THREE.Vector3,
  dragX: number, dragY: number,
  camera: THREE.Camera, width: number, height: number,
  minCos = 0,
): CornerTwistScore | null {
  const dragLen = Math.hypot(dragX, dragY);
  if (dragLen < 1e-6) return null;
  const pScreen = worldToScreenPx(pointWorld, camera, width, height);
  _r.copy(pointWorld).sub(originWorld);
  let best: CornerTwistScore | null = null;
  let bestAbsCos = minCos;
  for (const corner of candidates) {
    _tan.crossVectors(axisWorldOf(corner), _r);
    if (_tan.lengthSq() < 1e-9) continue;
    _tan.normalize();
    const tScreen = worldToScreenPx(_tmp.copy(pointWorld).add(_tan), camera, width, height);
    let tx = tScreen.x - pScreen.x;
    let ty = tScreen.y - pScreen.y;
    const tl = Math.hypot(tx, ty);
    if (tl < 1e-6) continue;
    tx /= tl; ty /= tl;
    const dot = tx * dragX + ty * dragY;
    const absCos = Math.abs(dot / dragLen);
    if (absCos > bestAbsCos) {
      bestAbsCos = absCos;
      const dir: 1 | -1 = dot >= 0 ? 1 : -1;
      best = { corner, dir, tangentX: tx * dir, tangentY: ty * dir };
    }
  }
  return best;
}
