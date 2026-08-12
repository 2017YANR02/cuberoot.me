import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyPartial, scoreCornerTwist } from '@/app/[lang]/sim/engine/cuberDrag';
import {
  CornerTurnGesture,
  type CornerGestureCtx,
  type CornerTurnAdapter,
} from '@/app/[lang]/sim/engine/cornerTurnGesture';
import { applyAnimFrame, makeAnim } from '@/app/[lang]/sim/engine/pieceAnim';
import {
  sq1DragApply,
  sq1DragCommit,
  sq1DragDelta,
  type Sq1TurnDrag,
} from '@/app/[lang]/sim/engine/sq1/sq1Drag';
import type Sq1Cube from '@/app/[lang]/sim/engine/sq1/Sq1Cube';
import type World from '@/app/[lang]/sim/engine/world';

function testCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

function pointer(x: number, y: number): PointerEvent {
  return { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' } as PointerEvent;
}

describe('sim non-NxN finite gesture boundary', () => {
  it('rejects non-finite shared animation progress and clamps finite progress', () => {
    const pivot = new THREE.Object3D();
    pivot.position.set(1, 0, 0);
    const axis = new THREE.Vector3(0, 1, 0);
    const angle = Math.PI / 2;
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const anim = makeAnim(pivot, delta, axis, angle, true);

    applyAnimFrame([anim], 0.5);
    const midQuat = pivot.quaternion.clone();
    const midPos = pivot.position.clone();

    applyAnimFrame([anim], Number.NaN);
    applyPartial([anim], Number.POSITIVE_INFINITY);
    expect(pivot.quaternion.equals(midQuat)).toBe(true);
    expect(pivot.position.equals(midPos)).toBe(true);

    applyPartial([anim], 2);
    expect(pivot.quaternion.angleTo(anim.endQuat)).toBeLessThan(1e-10);
    expect(pivot.position.distanceTo(anim.endPos!)).toBeLessThan(1e-10);
  });

  it('rejects invalid screen geometry before scoring a corner twist', () => {
    const camera = testCamera();
    const point = new THREE.Vector3(1, 1, 0);
    const origin = new THREE.Vector3();
    const axis = () => new THREE.Vector3(1, 1, 1).normalize();

    expect(scoreCornerTwist([0], axis, point, origin, Number.NaN, 10, camera, 100, 100)).toBeNull();
    expect(scoreCornerTwist([0], axis, point, origin, 10, 10, camera, 0, 100)).toBeNull();
    expect(scoreCornerTwist(
      [0], axis, new THREE.Vector3(Number.NaN, 1, 0), origin, 10, 10, camera, 100, 100,
    )).toBeNull();
  });

  it('snaps a live shared corner turn back when a pinch starts', () => {
    type Move = { name: string };
    type Hit = { piece: number };
    const pivot = new THREE.Object3D();
    pivot.position.set(1, 0, 0);
    const startPos = pivot.position.clone();
    const startQuat = pivot.quaternion.clone();
    const axis = new THREE.Vector3(0, 0, 1);
    const angle = Math.PI / 2;
    const move: Move = { name: 'X' };
    const cube = {
      twister: {
        finish: () => undefined,
        twist: () => true,
      },
    };
    const scene = new THREE.Scene();
    const world = {
      cube,
      scene,
      camera: testCamera(),
      width: 100,
      height: 100,
      dirty: false,
    } as unknown as World;
    const dom = {
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
    } as unknown as HTMLElement;
    const adapter: CornerTurnAdapter<typeof cube, Move, Hit> = {
      match: (candidate): candidate is typeof cube => candidate === cube,
      pickHit: () => ({ piece: 0 }),
      resolveLive: () => ({ move, tangentX: 1, tangentY: 0 }),
      resolveMove: () => move,
      beginMove: () => [
        makeAnim(pivot, new THREE.Quaternion().setFromAxisAngle(axis, angle), axis, angle, true),
      ],
      moveToString: (resolved) => resolved.name,
      fullPx: 100,
      threshold: 6,
    };
    const ctx: CornerGestureCtx = {
      world,
      dom,
      settings: () => ({ holdPartialTurn: true, dragEmpty: 'rotate' }),
      pinching: () => false,
      emitMove: () => undefined,
      orbit: () => undefined,
      clearPartialFreeze: () => undefined,
      setPartialSnapBack: () => undefined,
    };
    const gesture = new CornerTurnGesture(adapter, ctx);

    gesture.begin(pointer(10, 10));
    expect(gesture.onMove(pointer(30, 10))).toBe(true);
    expect(pivot.position.distanceTo(startPos)).toBeGreaterThan(0.01);

    gesture.onPinchStart();
    expect(pivot.position.equals(startPos)).toBe(true);
    expect(pivot.quaternion.equals(startQuat)).toBe(true);
    expect(world.dirty).toBe(true);
  });

  it('rejects a parallel or invalid SQ1 drag ray', () => {
    const scene = new THREE.Scene();
    scene.updateMatrix();
    const start: Sq1TurnDrag = {
      kind: 'turn',
      layer: 'top',
      startAngle: 0,
      starts: [],
      startEastHalf: false,
    };

    expect(sq1DragDelta(start, scene, testCamera(), 50, 50, 100, 100)).toBeNull();
    expect(sq1DragDelta(start, scene, testCamera(), 50, 50, 0, 100)).toBeNull();
  });

  it('ignores a non-finite SQ1 live delta and snaps it back on commit', () => {
    const pivot = new THREE.Object3D();
    const startPos = new THREE.Vector3(1, 2, 3);
    const startQuat = new THREE.Quaternion();
    pivot.position.set(8, 9, 10);
    pivot.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5);
    const currentPos = pivot.position.clone();
    const currentQuat = pivot.quaternion.clone();
    const start: Sq1TurnDrag = {
      kind: 'turn',
      layer: 'bot',
      startAngle: 0,
      starts: [{ pivot, pos: startPos, quat: startQuat }],
      startEastHalf: false,
    };

    sq1DragApply(start, Number.NaN);
    expect(pivot.position.equals(currentPos)).toBe(true);
    expect(pivot.quaternion.equals(currentQuat)).toBe(true);

    const cube = { dirty: false } as unknown as Sq1Cube;
    expect(sq1DragCommit(cube, start, Number.NaN)).toBeNull();
    expect(pivot.position.equals(startPos)).toBe(true);
    expect(pivot.quaternion.equals(startQuat)).toBe(true);
    expect(cube.dirty).toBe(true);
  });
});
