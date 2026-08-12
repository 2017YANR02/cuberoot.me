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
