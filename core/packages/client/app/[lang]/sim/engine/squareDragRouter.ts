/** Keep SQ1's shape-aware drag path intact while sharing the UI flow with SQ2/SQ4. */
import type * as THREE from 'three';
import Sq1Cube from './sq1/Sq1Cube';
import SquareFamilyCube from './squareFamily/SquareFamilyCube';
import {
  sq1DragApply,
  sq1DragCommit,
  sq1DragDelta,
  sq1DragSnapBack,
  sq1DragStart,
  sq1SliceLiveApply,
  sq1SliceLiveSnapBack,
  sq1SliceLiveStart,
  type Sq1DragStart,
  type Sq1SliceLive,
  type Sq1TurnDrag,
} from './sq1/sq1Drag';
import { isSlashValid, moveToString } from './sq1/sq1State';
import {
  squareFamilyDragCommit,
  squareFamilyDragStart,
  squareFamilySliceLiveStart,
} from './squareFamily/squareFamilyDrag';
import { squareFamilyMoveToString } from './squareFamily/squareFamilyState';

export type SquarePuzzleCube = Sq1Cube | SquareFamilyCube;
export type SquareDragStart = Sq1DragStart;
export type SquareTurnDrag = Sq1TurnDrag;
export type SquareSliceLive = Sq1SliceLive;

export function isSquarePuzzleKind(kind: unknown): kind is 'sq1' | 'sq2' | 'sq4' {
  return kind === 'sq1' || kind === 'sq2' || kind === 'sq4';
}

export function isSquarePuzzleCube(cube: unknown): cube is SquarePuzzleCube {
  return cube instanceof Sq1Cube || cube instanceof SquareFamilyCube;
}

export function squareDragStart(
  cube: SquarePuzzleCube,
  scene: THREE.Scene,
  camera: THREE.Camera,
  x: number,
  y: number,
  width: number,
  height: number,
): SquareDragStart | null {
  return cube instanceof Sq1Cube
    ? sq1DragStart(cube, scene, camera, x, y, width, height)
    : squareFamilyDragStart(cube, scene, camera, x, y, width, height);
}

export const squareDragDelta = sq1DragDelta;
export const squareDragApply = sq1DragApply;
export const squareDragSnapBack = sq1DragSnapBack;
export const squareSliceLiveApply = sq1SliceLiveApply;
export const squareSliceLiveSnapBack = sq1SliceLiveSnapBack;

export function squareDragCommit(
  cube: SquarePuzzleCube,
  drag: SquareTurnDrag,
  delta: number,
): string | null {
  if (cube instanceof Sq1Cube) {
    const move = sq1DragCommit(cube, drag, delta);
    return move ? moveToString(move) : null;
  }
  const move = squareFamilyDragCommit(cube, drag, delta);
  return move ? squareFamilyMoveToString(move) : null;
}

export function squareSliceLiveStart(
  cube: SquarePuzzleCube,
  dir: 1 | -1,
  downY: number,
): SquareSliceLive {
  return cube instanceof Sq1Cube
    ? sq1SliceLiveStart(cube, dir, downY)
    : squareFamilySliceLiveStart(cube, dir, downY);
}

export function squareSlashValid(cube: SquarePuzzleCube): boolean {
  return cube instanceof Sq1Cube ? isSlashValid(cube.state) : true;
}

export function squareTwistSlice(cube: SquarePuzzleCube, dir: 1 | -1): boolean {
  if (cube instanceof SquareFamilyCube) {
    // A tap is a new user move. Settle animated setup/playback first so the
    // inherited force path cannot orphan the next queued tween.
    cube.twister.finish();
    return cube.twister.twist({ kind: 'slice' }, false, false, dir);
  }
  return cube.twister.twist({ kind: 'slice' }, false, true, dir);
}
