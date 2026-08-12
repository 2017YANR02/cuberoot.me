/**
 * Per-piece animation plan shared by the non-NxN cuber engines.
 *
 * A move rotates a set of piece pivots by a single quaternion `delta = q(axis,
 * angle)`. `startQuat`/`endQuat` bracket the rotation; `axis`+`angle` carry the
 * *signed* world rotation so the tween interpolates as `q(angle·v, axis) · start`
 * (NOT slerp(start,end) — slerp's shortest-path flip at dot<0 makes 180° turns
 * pick whichever arc float drift nudges into). Position is optional: only layer
 * turns that translate the pivot (SQ1) carry `startPos`/`endPos`; pure
 * corner/face turns leave them undefined.
 */
import * as THREE from 'three';

export interface PieceAnim {
  pivot: THREE.Object3D;
  startQuat: THREE.Quaternion;
  endQuat: THREE.Quaternion;
  axis: THREE.Vector3;
  angle: number;
  startPos?: THREE.Vector3;
  endPos?: THREE.Vector3;
}

/** Build an anim plan rotating `pivot` by `delta` (= q(axis, angle)). Pass
 *  withPos=true to also carry the position arc (delta applied to the current
 *  pos), for layer turns that move the pivot off the origin. */
export function makeAnim(
  pivot: THREE.Object3D, delta: THREE.Quaternion,
  axis: THREE.Vector3, angle: number, withPos = false,
): PieceAnim {
  const startQuat = pivot.quaternion.clone();
  const endQuat = delta.clone().multiply(startQuat);
  if (withPos) {
    const startPos = pivot.position.clone();
    const endPos = startPos.clone().applyQuaternion(delta);
    return { pivot, startQuat, endQuat, axis, angle, startPos, endPos };
  }
  return { pivot, startQuat, endQuat, axis, angle };
}

const _scratch = new THREE.Quaternion();

/** Set every pivot to progress `v` ∈ [0,1] of its turn: quaternion always, and
 *  position when the anim carries it. This is the shared non-NxN animation sink,
 *  so it rejects non-finite progress and owns the clamp for tween + live-drag callers.
 *  Single-threaded synchronous use makes a module-level scratch quaternion safe. */
export function applyAnimFrame(anims: PieceAnim[], v: number): void {
  if (!Number.isFinite(v)) return;
  const progress = Math.max(0, Math.min(1, v));
  for (const a of anims) {
    _scratch.setFromAxisAngle(a.axis, a.angle * progress);
    a.pivot.quaternion.multiplyQuaternions(_scratch, a.startQuat);
    if (a.startPos) a.pivot.position.copy(a.startPos).applyQuaternion(_scratch);
  }
}
