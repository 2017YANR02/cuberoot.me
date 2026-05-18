/**
 * SQ1 drag-to-turn helpers.
 *
 * Pointer raycast hits a horizontal plane at TOP_Y or BOT_Y in cube-local frame.
 * Track Δθ around +Y between pointerdown and pointermove; apply uniformly to
 * every piece pivot in that layer so the sticker stays under the finger.
 * On release snap to nearest 30°, tween pivots into the snapped end pose, then
 * commit state + history (mirrors what Sq1Cube.finishMove does).
 */
import * as THREE from 'three';
import { W, HALF_MID, LAYER_HEIGHT } from './sq1Geometry';
import { applySq1Move, moveToString, type Sq1Move } from './sq1State';
import type Sq1Cube from './Sq1Cube';
import tweener from '../tweener';
import CubeGroup from '../group';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TOP_Y = HALF_MID + LAYER_HEIGHT;
const BOT_Y = -HALF_MID - LAYER_HEIGHT;

export interface Sq1DragStart {
  layer: 'top' | 'bot';
  startAngle: number;
  starts: { pivot: THREE.Object3D; quat: THREE.Quaternion; pos: THREE.Vector3 }[];
}

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

function planeHit(ray: THREE.Ray, y: number): THREE.Vector3 | null {
  if (Math.abs(ray.direction.y) < 1e-6) return null;
  const t = (y - ray.origin.y) / ray.direction.y;
  if (t < 0) return null;
  const pt = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
  if (Math.abs(pt.x) > W || Math.abs(pt.z) > W) return null;
  return pt;
}

/** Raycast pointer onto top/bot Y-plane in cube-local frame. Picks the plane
 *  that hits closer to the camera, so a side-on view doesn't accidentally
 *  pick the far face when the ray passes through both. Returns null when
 *  neither face is hit (pointer over side wall or empty space). */
export function sq1DragStart(
  cube: Sq1Cube,
  scene: THREE.Scene, camera: THREE.Camera,
  screenX: number, screenY: number, width: number, height: number,
): Sq1DragStart | null {
  const ray = buildLocalRay(scene, camera, screenX, screenY, width, height);
  const top = planeHit(ray, TOP_Y);
  const bot = planeHit(ray, BOT_Y);
  let layer: 'top' | 'bot';
  let hit: THREE.Vector3;
  if (top && bot) {
    const dTop = top.distanceToSquared(ray.origin);
    const dBot = bot.distanceToSquared(ray.origin);
    if (dTop <= dBot) { layer = 'top'; hit = top; } else { layer = 'bot'; hit = bot; }
  } else if (top) { layer = 'top'; hit = top; }
  else if (bot) { layer = 'bot'; hit = bot; }
  else return null;
  const sign = layer === 'top' ? 1 : -1;
  const starts = cube.pieces
    .filter((p) => p.layerSign === sign)
    .map((p) => ({
      pivot: p.pivot,
      quat: p.pivot.quaternion.clone(),
      pos: p.pivot.position.clone(),
    }));
  return { layer, startAngle: Math.atan2(hit.z, hit.x), starts };
}

/** Re-raycast onto the same plane and return the Δθ since start (radians,
 *  unwrapped to (-π, π]). Null if the ray misses (rare — only when scene
 *  is rotated past vertical so the plane is behind / parallel). */
export function sq1DragDelta(
  start: Sq1DragStart,
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
  return d;
}

/** Apply live rotation to all tracked pivots: quat = q(Δ) · startQuat,
 *  pos = q(Δ) · startPos (so the sticker tracks the finger). */
export function sq1DragApply(start: Sq1DragStart, delta: number): void {
  const q = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, delta);
  for (const s of start.starts) {
    s.pivot.quaternion.multiplyQuaternions(q, s.quat);
    s.pivot.position.copy(s.pos).applyQuaternion(q);
  }
}

/** Snap Δθ to nearest 30° unit, tween from current → snapped end, commit
 *  state + history. Returns the committed move (null if 0 units = snap back). */
export function sq1DragCommit(
  cube: Sq1Cube,
  start: Sq1DragStart,
  delta: number,
): Sq1Move | null {
  const units = Math.round(delta / (Math.PI / 6));
  const snapAngle = units * (Math.PI / 6);
  const qSnap = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, snapAngle);
  // Capture current pivot state (drag rotation already applied).
  const curQuats = start.starts.map((s) => s.pivot.quaternion.clone());
  const curPoss = start.starts.map((s) => s.pivot.position.clone());
  // Target = snapped delta applied to start.
  const endQuats = start.starts.map((s) => qSnap.clone().multiply(s.quat));
  const endPoss = start.starts.map((s) => s.pos.clone().applyQuaternion(qSnap));

  const frames = Math.max(2, Math.round(CubeGroup.tweenDuration(Math.max(0.5, Math.abs(units) / 3))));
  tweener.tween(0, 1, frames, (v) => {
    for (let i = 0; i < start.starts.length; i++) {
      start.starts[i].pivot.quaternion.slerpQuaternions(curQuats[i], endQuats[i], v);
      start.starts[i].pivot.position.lerpVectors(curPoss[i], endPoss[i], v);
    }
    cube.dirty = true;
    return v >= 1;
  });

  if (units === 0) return null;
  // beginMove convention: pivot rotated by -top·30°. We rotated by +snapAngle =
  // +units·30°. So top = -units. Bot pivots use +bot·30° → bot = +units.
  const move: Sq1Move = start.layer === 'top'
    ? { kind: 'turn', top: -units, bot: 0 }
    : { kind: 'turn', top: 0, bot: units };
  cube.state = applySq1Move(cube.state, move);
  cube.history.record(moveToString(move));
  cube.dirty = true;
  for (const cb of cube.callbacks) cb();
  return move;
}
