import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import Controller from '@/app/[lang]/sim/engine/nxn/controller';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import World from '@/app/[lang]/sim/engine/world';

function controllerWorld(cube?: Cube): World {
  const scene = new THREE.Scene();
  scene.updateMatrix();
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return {
    width: 100,
    height: 100,
    scene,
    camera,
    cube,
    dirty: false,
  } as unknown as World;
}

describe('sim NxN finite gesture boundary', () => {
  it('hover hit testing matches taps without starting a gesture or changing its held target', () => {
    const cube = new Cube(3);
    const world = controllerWorld(cube);
    world.camera.position.set(0, 0, 500);
    world.camera.updateMatrixWorld(true);
    const controller = new Controller(world);
    const point = new THREE.Vector2(50, 50);
    const hit = controller.hitTest(point)!;
    expect(hit.index).toBe(22);
    expect(controller.holder.index).toBe(-1);
    expect(controller.dragging).toBe(false);
    controller.down.copy(point);
    controller.handleDown();
    expect(controller.holder.index).toBe(hit.index);
    expect(controller.holder.plane).toBe(hit.plane);
    expect(controller.hitTest(new THREE.Vector2(-1000, -1000))).toBeNull();
    expect(controller.holder.index).toBe(hit.index);
    controller.handleUp();
    cube.dispose();
  });
  it('returns null when a pointer ray is parallel to the drag plane', () => {
    const controller = new Controller(controllerWorld());
    const parallelPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -1);

    expect(controller.intersect(new THREE.Vector2(50, 50), parallelPlane)).toBeNull();
  });

  it('releases a held slice instead of starting a non-finite tween', () => {
    const cube = new Cube(3);
    const group = cube.table.groups.y[0];
    expect(group.drag()).toBe(true);
    group.angle = Math.PI / 8;

    expect(group.twist(Number.NaN, false)).toBe(false);
    expect(group.angle).toBe(0);
    expect(cube.busy).toBe(false);
    expect(cube.instancedRenderer.movingFrame.count).toBe(0);
    cube.dispose();
  });

  it('does not record DNaN when a gesture reaches pointer-up with an invalid angle', () => {
    const cube = new Cube(3);
    const controller = new Controller(controllerWorld(cube));
    const group = cube.table.groups.y[0];
    expect(group.drag()).toBe(true);
    controller.group = group;
    controller.rotating = true;
    controller.angle = Number.NaN;

    controller.handleUp();

    expect(cube.history.length).toBe(0);
    expect(cube.history.exp).not.toContain('NaN');
    expect(cube.busy).toBe(false);
    expect(cube.instancedRenderer.movingFrame.count).toBe(0);
    cube.dispose();
  });
});
