/**
 * SQ1 drag-to-turn helpers.
 *
 * Pointerdown raycasts the full sq1 geometry (caps + side walls + equator).
 * Hit point's Y sign in cube-local frame picks the layer: y >= 0 → top, else
 * bot. startAngle is the polar atan2(z, x) on the layer's reference plane
 * (TOP_Y / BOT_Y), so subsequent moves re-project onto the same plane.
 *
 * Drag delta is sign-flipped so the sticker tracks the finger from any view:
 * R_y(+θ) makes cube-local atan2 decrease, but the finger's atan2 increases
 * by the same delta — so applying -delta around +Y keeps them in sync.
 *
 * On release snap to nearest 30°, tween pivots into the snapped end pose,
 * then commit state + history (mirrors what Sq1Cube.finishMove does).
 */
import * as THREE from 'three';
import { HALF_MID, LAYER_HEIGHT, W, WEDGE_HALF_CHORD } from './sq1Geometry';
import { applySq1Move, moveToString, snapValidLayerTurn, type Sq1Move } from './sq1State';
import type Sq1Cube from './Sq1Cube';
import tweener from '../tweener';
import { tweenDuration } from '../tweenTiming';
import { applyAnimFrame, type PieceAnim } from '../pieceAnim';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TOP_Y = HALF_MID + LAYER_HEIGHT;
const BOT_Y = -HALF_MID - LAYER_HEIGHT;

/** Live drag of one layer, snapped on release. */
export interface Sq1TurnDrag {
  kind: 'turn';
  layer: 'top' | 'bot';
  startAngle: number;
  starts: { pivot: THREE.Object3D; quat: THREE.Quaternion; pos: THREE.Vector3 }[];
  /** Hit point lay east of the slice chord (即 slice 那侧)。SimPage 用这个 +
   *  threshold-cross 时 dx/dy 主分量来决定是否把 turn-drag 升级成 slash。 */
  startEastHalf: boolean;
}

/** Mid-slab hit. Carries no state — SimPage fires a one-shot slice animation
 *  on first pointermove past the threshold and clears the drag handle. */
export interface Sq1SliceDrag {
  kind: 'slice';
}

export type Sq1DragStart = Sq1TurnDrag | Sq1SliceDrag;

function buildLocalRay(
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): THREE.Ray {
  const ray = new THREE.Ray();
  ray.origin.setFromMatrixPosition(camera.matrixWorld);
  const ndcX = (screenX / width) * 2 - 1;
  const ndcY = -(screenY / height) * 2 + 1;
  ray.direction.set(ndcX, ndcY, 0.5).unproject(camera).sub(ray.origin).normalize();
  const inv = new THREE.Matrix4().copy(scene.matrix).invert();
  ray.applyMatrix4(inv);
  return ray;
}

/** Ray ∩ Y=const plane in cube-local frame. No cap-footprint check — once we
 *  know which layer was hit, the plane is just a reference for polar angle. */
function planeIntersect(ray: THREE.Ray, y: number): THREE.Vector3 | null {
  if (Math.abs(ray.direction.y) < 1e-6) return null;
  const t = (y - ray.origin.y) / ray.direction.y;
  if (t < 0) return null;
  return ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
}

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

/** Raycast the full cube. Any mesh hit (cap, side wall, equator) starts a
 *  turn-drag; the hit's cube-local Y picks the layer. Returns null when the
 *  pointer is over empty space — SimPage falls back to view rotation. */
export function sq1DragStart(
  cube: Sq1Cube,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): Sq1DragStart | null {
  _ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObject(cube, true);
  if (hits.length === 0) return null;
  // Hit point is in world space; convert to cube-local (= scene-local since
  // sq1Cube has identity matrix relative to scene) to read Y sign.
  const hitLocal = hits[0].point.clone();
  const sceneInv = new THREE.Matrix4().copy(scene.matrix).invert();
  hitLocal.applyMatrix4(sceneInv);
  // Mid-slab hit (equator) → one-shot slice. Walk up the parent chain of the
  // hit mesh; if it descends from either middle pivot, it's a slice gesture.
  // Has to be done before the y-sign layer pick — a slab face at y=+ε would
  // otherwise be misread as a top-layer turn.
  const hitObj = hits[0].object;
  for (const m of cube.middle) {
    let cur: THREE.Object3D | null = hitObj;
    while (cur && cur !== cube) {
      if (cur === m.pivot) return { kind: 'slice' };
      cur = cur.parent;
    }
  }
  const layer: 'top' | 'bot' = hitLocal.y >= 0 ? 'top' : 'bot';

  // startAngle: polar on layer's reference plane. Fallback to raw hit (x, z)
  // if the ray runs parallel to the plane (rare degenerate view).
  const ray = buildLocalRay(scene, camera, screenX, screenY, width, height);
  const planeY = layer === 'top' ? TOP_Y : BOT_Y;
  const planePt = planeIntersect(ray, planeY);
  const refX = planePt ? planePt.x : hitLocal.x;
  const refZ = planePt ? planePt.z : hitLocal.z;

  // 按物理位置选层,不能用 piece.layerSign(piece id 类型 — slice 后会跟物理
  // 反向:顶类 piece 物理 y<0,底类 y>0)。跟 Sq1Cube.beginMove 同一约定。
  const wantTop = layer === 'top';
  const starts = cube.pieces
    .filter((p) => (p.pivot.position.y > 0) === wantTop)
    .map((p) => ({
      pivot: p.pivot,
      quat: p.pivot.quaternion.clone(),
      pos: p.pivot.position.clone(),
    }));
  // east-of-chord 半边:跟 Sq1Cube.beginMove 的 slice 测试同一条 chord(法线 SLICE_AXIS)。
  // refX/refZ 取的是 layer 参考平面上 hit 点,跟 turn-drag 起手 atan2 一致。
  const startEastHalf = refX * W + refZ * WEDGE_HALF_CHORD > 0;
  return { kind: 'turn', layer, startAngle: Math.atan2(refZ, refX), starts, startEastHalf };
}

/** Re-raycast onto the same plane and return the Δθ since start (radians,
 *  unwrapped to (-π, π]). Null if the ray misses (rare — only when scene
 *  is rotated past vertical so the plane is behind / parallel). */
export function sq1DragDelta(
  start: Sq1TurnDrag,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): number | null {
  const ray = buildLocalRay(scene, camera, screenX, screenY, width, height);
  const y = start.layer === 'top' ? TOP_Y : BOT_Y;
  // Don't reuse planeHit's footprint check — once dragging started we want to
  // keep following the finger even if it leaves the W×W cap.
  if (Math.abs(ray.direction.y) < 1e-6) return null;
  const t = (y - ray.origin.y) / ray.direction.y;
  if (t < 0) return null;
  const pt = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
  let d = Math.atan2(pt.z, pt.x) - start.startAngle;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  // R_y(+θ) decreases cube-local atan2 by θ, while the finger's atan2 increases
  // by Δfinger. So apply -Δfinger around +Y to keep sticker under finger. Both
  // layers; apply + commit consume this value so the chain stays consistent.
  return -d;
}

/** Apply live rotation to all tracked pivots: quat = q(Δ) · startQuat,
 *  pos = q(Δ) · startPos (so the sticker tracks the finger). */
export function sq1DragApply(start: Sq1TurnDrag, delta: number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, delta);
  for (const s of start.starts) {
    s.pivot.quaternion.multiplyQuaternions(q, s.quat);
    s.pivot.position.copy(s.pos).applyQuaternion(q);
  }
}

/** Snap the dragged pivots back to their pre-drag pose (cancel a frozen partial
 *  turn — debug "hold partial" mode). No state change; state was never committed. */
export function sq1DragSnapBack(start: Sq1TurnDrag): void {
  for (const s of start.starts) {
    s.pivot.quaternion.copy(s.quat);
    s.pivot.position.copy(s.pos);
  }
}

/** Snap Δθ to nearest *slash-valid* 30° unit, tween from current → snapped
 *  end, commit state + history. Returns the committed move (null if 0 units =
 *  snap back).
 *
 *  Shape constraint: not every 30° step is legal — landing with a corner
 *  straddling the slice cut (slot 5|6 or 11|0) would make `/` impossible and
 *  cause a visible "pop" on next slice. We delegate the search to
 *  `snapValidLayerTurn` which enumerates U ∈ [-6, 6], skips those whose
 *  resulting state isn't slash-valid, and returns the closest valid unit (0
 *  if every non-zero step is farther than no-op). */
export function sq1DragCommit(
  cube: Sq1Cube,
  start: Sq1TurnDrag,
  delta: number,
): Sq1Move | null {
  // Raw drag in 30°-units, sign = drag direction (R_y(+delta) is applied).
  // Map to the layer's state-U: top R_y(δ) ↔ move.top = -δ/(π/6); bot ↔ +δ/(π/6).
  const rawUnits = delta / (Math.PI / 6);
  const targetU = start.layer === 'top' ? -rawUnits : rawUnits;
  const validU = snapValidLayerTurn(cube.state, start.layer, targetU);
  // visualUnits is what gets rotated around +Y in pivot space (matches the
  // direction the user's finger went). Inverse of the layer→state mapping.
  const visualUnits = start.layer === 'top' ? -validU : validU;
  const snapAngle = visualUnits * (Math.PI / 6);
  const qSnap = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, snapAngle);
  // Capture current pivot state (drag rotation already applied).
  const curQuats = start.starts.map((s) => s.pivot.quaternion.clone());
  const curPoss = start.starts.map((s) => s.pivot.position.clone());
  // Target = snapped delta applied to start.
  const endQuats = start.starts.map((s) => qSnap.clone().multiply(s.quat));
  const endPoss = start.starts.map((s) => s.pos.clone().applyQuaternion(qSnap));

  const frames = Math.max(2, Math.round(tweenDuration(Math.max(0.5, Math.abs(visualUnits) / 3))));
  tweener.tween(0, 1, frames, (v) => {
    for (let i = 0; i < start.starts.length; i++) {
      start.starts[i].pivot.quaternion.slerpQuaternions(curQuats[i], endQuats[i], v);
      start.starts[i].pivot.position.lerpVectors(curPoss[i], endPoss[i], v);
    }
    cube.dirty = true;
    return v >= 1;
  });

  if (validU === 0) return null;
  const move: Sq1Move = start.layer === 'top'
    ? { kind: 'turn', top: validU, bot: 0 }
    : { kind: 'turn', top: 0, bot: validU };
  cube.state = applySq1Move(cube.state, move);
  cube.history.record(moveToString(move));
  cube.dirty = true;
  for (const cb of cube.callbacks) cb();
  return move;
}

// ─── live slice drag (debug "hold partial turn") ──────────────────────────────
//
// Unlike a layer turn (a continuous Y-rotation), the slice is a 180° flip of the
// east half. To freeze it mid-flip (inspect the internal vertical cut, e.g. for
// raw-core dev) we drive the same `beginMove({kind:'slice'})` anim plan directly
// off the finger instead of running it as a one-shot tween: vertical drag maps to
// flip progress v∈[0,1] via `applyAnimFrame`. Only used when holdPartialTurn is
// on; normal mode keeps the snappy one-shot slice. State is never committed — the
// frozen pivots are restored by sq1SliceLiveSnapBack on release/clear.

/** px of vertical finger travel for a full 180° flip. Fixed (not sensitivity-
 *  scaled): this is a debug inspect gesture, so predictable travel beats coupling
 *  to the turn slider — and the turn slider scales an *angle*, not pixels. ~240px
 *  ≈ a third of the canvas → a half-drag (~120px) lands near 90° (cut fully open). */
const SLICE_FLIP_PX = 240;

export interface Sq1SliceLive {
  kind: 'sliceLive';
  anims: PieceAnim[];
  /** pointer-down Y (canvas-local) — the v=0 reference. */
  downY: number;
  /** +1 = drag down, -1 = drag up; baked into the anim arc + the v sign. */
  dir: 1 | -1;
}

/** Capture the flip anim plan for the current state; v starts at 0. */
export function sq1SliceLiveStart(cube: Sq1Cube, dir: 1 | -1, downY: number): Sq1SliceLive {
  return { kind: 'sliceLive', anims: cube.beginMove({ kind: 'slice' }, dir), downY, dir };
}

/** Map vertical finger travel → flip progress and apply it live. */
export function sq1SliceLiveApply(live: Sq1SliceLive, localY: number): void {
  const v = (localY - live.downY) * live.dir / SLICE_FLIP_PX;
  applyAnimFrame(live.anims, Math.min(1, Math.max(0, v)));
}

/** Cancel a frozen partial slice: snap the flipped pivots back to v=0 (no state
 *  change; state was never committed). */
export function sq1SliceLiveSnapBack(live: Sq1SliceLive): void {
  applyAnimFrame(live.anims, 0);
}
