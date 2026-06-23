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

/**
 * Given a pick + the screen drag vector (dx,dy in CSS px, y down), choose the move.
 * Returns null if no candidate's tangent aligns enough with the drag.
 */
export function dinoResolveMove(
  cube: DinoCube,
  hit: DinoPickHit,
  scene: THREE.Scene, camera: THREE.Camera,
  dxPx: number, dyPx: number, width: number, height: number,
): DinoMove | null {
  scene.updateMatrixWorld();
  // Drag vector in NDC-ish screen space (y up to match projection).
  const dragX = dxPx;
  const dragY = -dyPx;
  const dragLen = Math.hypot(dragX, dragY);
  if (dragLen < 1e-3) return null;

  // Hit point in world space → project to screen px.
  const pScreen = worldToScreenPx(hit.point, camera, width, height);

  let best: { corner: number; dir: 1 | -1; score: number } | null = null;
  for (const corner of hit.candidates) {
    const axisLocal = CORNER_AXIS[corner];
    // axis in world space (cube may be rotated by scene.matrixWorld)
    _v.set(axisLocal[0], axisLocal[1], axisLocal[2]).normalize();
    const axisWorld = _v.clone().transformDirection(scene.matrixWorld);
    // tangential world direction at hit point for +120°: axis × (point - origin).
    // origin in world space = cube position (scene rotates about it).
    const originWorld = new THREE.Vector3().setFromMatrixPosition(cube.matrixWorld);
    const r = hit.point.clone().sub(originWorld);
    const tangentWorld = axisWorld.clone().cross(r);
    if (tangentWorld.lengthSq() < 1e-9) continue;
    // screen tangent = project(point + tangent) - project(point)
    _p1.copy(hit.point).add(tangentWorld.multiplyScalar(0.1));
    const tScreen = worldToScreenPx(_p1, camera, width, height);
    const tx = tScreen.x - pScreen.x;
    const ty = -(tScreen.y - pScreen.y); // y up
    const tLen = Math.hypot(tx, ty);
    if (tLen < 1e-3) continue;
    // dot of unit tangent with unit drag
    const dot = (tx * dragX + ty * dragY) / (tLen * dragLen);
    const score = Math.abs(dot);
    if (!best || score > best.score) {
      best = { corner, dir: dot >= 0 ? 1 : -1, score };
    }
  }
  if (!best || best.score < 0.2) return null;
  return { corner: best.corner, dir: best.dir };
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
