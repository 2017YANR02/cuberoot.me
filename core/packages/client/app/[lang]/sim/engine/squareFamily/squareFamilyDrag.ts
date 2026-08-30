/** Pointer drag adapter for the equal-sector Square-2 / Square-4 engine. */
import * as THREE from 'three';
import SquareFamilyCube from './SquareFamilyCube';
import {
  applySquareFamilyMove,
  normalizeSquareUnits,
  squareFamilyMoveToString,
  type SquareFamilyMove,
} from './squareFamilyState';
import {
  SQUARE_FAMILY_HALF_MIDDLE,
  SQUARE_FAMILY_LAYER_HEIGHT,
} from './squareFamilyGeometry';
import { tweenDuration } from '../tweenTiming';
import {
  sq1DragApply,
  sq1DragDelta,
  sq1DragSnapBack,
  sq1SliceLiveApply,
  sq1SliceLiveSnapBack,
  type Sq1DragStart,
  type Sq1SliceLive,
  type Sq1TurnDrag,
} from '../sq1/sq1Drag';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TOP_Y = SQUARE_FAMILY_HALF_MIDDLE + SQUARE_FAMILY_LAYER_HEIGHT;
const BOT_Y = -TOP_Y;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function finiteInput(x: number, y: number, width: number, height: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y)
    && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

function localPlanePoint(
  scene: THREE.Scene,
  camera: THREE.Camera,
  x: number,
  y: number,
  width: number,
  height: number,
  planeY: number,
): THREE.Vector3 | null {
  if (!finiteInput(x, y, width, height)) return null;
  const origin = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const direction = new THREE.Vector3((x / width) * 2 - 1, -(y / height) * 2 + 1, 0.5)
    .unproject(camera).sub(origin).normalize();
  const ray = new THREE.Ray(origin, direction)
    .applyMatrix4(new THREE.Matrix4().copy(scene.matrix).invert());
  if (Math.abs(ray.direction.y) < 1e-6) return null;
  const t = (planeY - ray.origin.y) / ray.direction.y;
  if (!Number.isFinite(t) || t < 0) return null;
  return ray.at(t, new THREE.Vector3());
}

export function squareFamilyDragStart(
  cube: SquareFamilyCube,
  scene: THREE.Scene,
  camera: THREE.Camera,
  x: number,
  y: number,
  width: number,
  height: number,
): Sq1DragStart | null {
  if (!finiteInput(x, y, width, height)) return null;
  ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(cube, true)[0];
  if (!hit) return null;

  const hitLocal = hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(scene.matrix).invert());
  for (const middle of cube.middle) {
    let current: THREE.Object3D | null = hit.object;
    while (current && current !== cube) {
      if (current === middle.pivot) return { kind: 'slice' };
      current = current.parent;
    }
  }

  const layer: 'top' | 'bot' = hitLocal.y >= 0 ? 'top' : 'bot';
  const planePoint = localPlanePoint(
    scene, camera, x, y, width, height, layer === 'top' ? TOP_Y : BOT_Y,
  );
  const refX = planePoint?.x ?? hitLocal.x;
  const refZ = planePoint?.z ?? hitLocal.z;
  const wantTop = layer === 'top';
  const probe = new THREE.Vector3();
  const starts = cube.pieces
    .filter((piece) => (cube.currentProbe(piece, probe).y > 0) === wantTop)
    .map((piece) => ({
      pivot: piece.pivot,
      quat: piece.pivot.quaternion.clone(),
      pos: piece.pivot.position.clone(),
    }));
  const startEastHalf = refX * cube.sliceAxis.x + refZ * cube.sliceAxis.z > 0;
  return {
    kind: 'turn',
    layer,
    startAngle: Math.atan2(refZ, refX),
    starts,
    startEastHalf,
  };
}

export const squareFamilyDragDelta = sq1DragDelta;
export const squareFamilyDragApply = sq1DragApply;
export const squareFamilyDragSnapBack = sq1DragSnapBack;

export function squareFamilyDragCommit(
  cube: SquareFamilyCube,
  start: Sq1TurnDrag,
  delta: number,
): SquareFamilyMove | null {
  if (!Number.isFinite(delta)) {
    squareFamilyDragSnapBack(start);
    cube.dirty = true;
    return null;
  }
  const rawUnits = delta / cube.spec.unitRadians;
  const stateUnits = normalizeSquareUnits(
    Math.round(start.layer === 'top' ? -rawUnits : rawUnits),
    cube.spec,
  );
  const visualUnits = start.layer === 'top' ? -stateUnits : stateUnits;
  const snapAngle = visualUnits * cube.spec.unitRadians;
  const snap = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, snapAngle);
  const currentQuats = start.starts.map((entry) => entry.pivot.quaternion.clone());
  const currentPositions = start.starts.map((entry) => entry.pivot.position.clone());
  const endQuats = start.starts.map((entry) => snap.clone().multiply(entry.quat));
  const endPositions = start.starts.map((entry) => entry.pos.clone().applyQuaternion(snap));
  const frames = Math.max(2, Math.round(tweenDuration(Math.max(0.5, Math.abs(visualUnits) / 3))));
  cube.animateInteraction(frames, (v) => {
    for (let i = 0; i < start.starts.length; i++) {
      start.starts[i].pivot.quaternion.slerpQuaternions(currentQuats[i], endQuats[i], v);
      start.starts[i].pivot.position.lerpVectors(currentPositions[i], endPositions[i], v);
    }
    cube.dirty = true;
  });
  if (stateUnits === 0) return null;
  const move: SquareFamilyMove = start.layer === 'top'
    ? { kind: 'turn', top: stateUnits, bot: 0 }
    : { kind: 'turn', top: 0, bot: stateUnits };
  cube.state = applySquareFamilyMove(cube.state, move, cube.spec);
  cube.history.record(squareFamilyMoveToString(move));
  cube.dirty = true;
  for (const callback of cube.callbacks) callback();
  return move;
}

export function squareFamilySliceLiveStart(
  cube: SquareFamilyCube,
  dir: 1 | -1,
  downY: number,
): Sq1SliceLive {
  return { kind: 'sliceLive', anims: cube.beginMove({ kind: 'slice' }, dir), downY, dir };
}

export const squareFamilySliceLiveApply = sq1SliceLiveApply;
export const squareFamilySliceLiveSnapBack = sq1SliceLiveSnapBack;
