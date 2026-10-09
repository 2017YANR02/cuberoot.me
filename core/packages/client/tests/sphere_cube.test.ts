import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import Cubelet from '@cuberoot/puzzle-render-core/engine/nxn/cubelet';
import Controller from '@cuberoot/puzzle-render-core/engine/nxn/controller';
import { COLORS } from '@cuberoot/puzzle-render-core/engine/define';
import World from '@/app/[lang]/sim/engine/world';
import { applySettings, DEFAULT_SETTINGS } from '@/app/[lang]/sim/SettingDrawer';

const SCRAMBLE = "R U R' F2 D L2 U' B R2 F' U2 M E' S2 x y'";
const FACE_NAMES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;

function centers(cube: Cube): THREE.Vector3[] {
  const matrix = new THREE.Matrix4();
  return [...cube.initials.keys()].map(initial => {
    expect(cube.instancedRenderer.getCubeletRenderMatrix(initial, matrix)).not.toBeNull();
    return new THREE.Vector3().setFromMatrixPosition(matrix);
  });
}

function clearance(points: THREE.Vector3[], radius: number): number {
  let distance = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) distance = Math.min(distance, points[i].distanceTo(points[j]));
  }
  return distance - 2 * radius;
}

function gestureWorld(cube: Cube): World {
  const scene = new THREE.Scene();
  scene.add(cube);
  const camera = new THREE.PerspectiveCamera(20, 1, 1, 3000);
  camera.position.set(0, 0, 1000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  return { scene, camera, cube, width: 600, height: 600, puzzleKind: 'sphere', dirty: false } as unknown as World;
}

function screen(point: THREE.Vector3, world: World): THREE.Vector2 {
  const projected = point.clone().project(world.camera);
  return new THREE.Vector2((projected.x + 1) * world.width / 2, (1 - projected.y) * world.height / 2);
}

describe('sphere-cubie 3x3', () => {
  it('renders 26 complete balls with one/two/three home colors and no planar shell', () => {
    const cube = new Cube(3, 'sphere');
    try {
      const renderer = cube.instancedRenderer;
      const geometry = renderer.staticFrame.geometry;
      expect(cube.initials.size).toBe(26);
      expect(renderer.staticSticker.visible).toBe(false);
      expect(renderer.movingSticker.visible).toBe(false);
      expect(renderer.staticInner.visible).toBe(false);
      expect(renderer.movingInner.visible).toBe(false);
      expect(renderer.staticFrame.userData.simSphereCubie).toBe(true);
      expect(renderer.movingFrame.userData.simSphereCubie).toBe(true);
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        expect(Math.hypot(positions.getX(i), positions.getY(i), positions.getZ(i))).toBeCloseTo(30, 5);
      }
      const normals = [0, 1, 2].map(slot => geometry.getAttribute(`aRawN${slot}`));
      const counts = [0, 0, 0, 0];
      for (let i = 0; i < 26; i++) {
        const faces = normals.filter(n => Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) > 0.5).length;
        counts[faces]++;
      }
      expect(counts).toEqual([0, 6, 12, 8]);

      // A previous ordinary-cube preset must not restore boxes, arrows or a flat logo.
      cube.arrow = true;
      renderer.arrow = true;
      cube.setLogo(new THREE.Texture());
      renderer.setRawCore(false, {
        U: COLORS.U, D: COLORS.D, L: COLORS.L, R: COLORS.R, F: COLORS.F, B: COLORS.B,
      }, COLORS.Core, true);
      expect(cube.arrow).toBe(false);
      expect(renderer.arrow).toBe(false);
      expect(renderer.rawCore).toBe(true);
      expect(renderer.staticFrame.geometry).toBe(geometry);
      expect(renderer.movingFrame.geometry).toBe(geometry);
      expect(cube.children.filter(child => (child as THREE.Mesh).isMesh)).toHaveLength(0);
    } finally { cube.dispose(); }
  });

  it('updates sphere colors in the existing raw attributes', () => {
    const cube = new Cube(3, 'sphere');
    const original = Object.fromEntries(FACE_NAMES.map(face => [face, COLORS[face]]));
    try {
      cube.instancedRenderer.setFaceColors(Object.fromEntries(FACE_NAMES.map(face => [face, '#7357bf'])));
      const geometry = cube.instancedRenderer.staticFrame.geometry;
      for (let slot = 0; slot < 3; slot++) {
        const normal = geometry.getAttribute(`aRawN${slot}`);
        const color = geometry.getAttribute(`aRawC${slot}`);
        for (let i = 0; i < 26; i++) {
          if (Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) < 0.5) continue;
          expect(new THREE.Color().setRGB(color.getX(i), color.getY(i), color.getZ(i)).getHexString()).toBe('7357bf');
        }
      }
    } finally {
      cube.instancedRenderer.setFaceColors(original);
      cube.dispose();
    }
  });

  it('filters a stored ordinary-cube preset at the real settings entry point', () => {
    const world = new World();
    world.controller = new Controller(world);
    world.setPuzzle('sphere');
    const cube = world.cube as Cube;
    try {
      applySettings(world, {
        ...DEFAULT_SETTINGS,
        coreStyle: 'normal', arrow: true, thickness: true, hollow: true,
        hint: true, debugStructureColor: true, logo: 'site', pictureCube: true,
        roomTheme: 'forest', hands: true, fullBody: true, showSmplxBody: true,
      });
      expect(cube.visible).toBe(true);
      expect(cube.arrow).toBe(false);
      expect(cube.instancedRenderer.hint).toBe(false);
      expect((cube.instancedRenderer.staticFrame.material as THREE.Material).transparent).toBe(false);
      expect(cube.instancedRenderer.rawCore).toBe(true);
      expect(cube.instancedRenderer.staticFrame.geometry.type).toBe('SphereGeometry');
      expect(cube.instancedRenderer.staticSticker.visible).toBe(false);
      expect(cube.children.filter(child => (child as THREE.Mesh).isMesh)).toHaveLength(0);
    } finally { world.disposeSphereCube(); }
  });

  it('keeps full-turn clearance in scrambled states, including all middle layers', () => {
    const cube = new Cube(3, 'sphere');
    try {
      for (const axis of ['x', 'y', 'z']) {
        for (let layer = 0; layer < 3; layer++) {
          cube.twister.setup(SCRAMBLE);
          const group = cube.table.groups[axis][layer];
          expect(group.drag()).toBe(true);
          for (const fraction of [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]) {
            group.angle = fraction * Math.PI / 2;
            // Whole spheres are separated by their centers. Between distinct layers,
            // the invariant axial separation is >=64 at EVERY angle; within a layer,
            // rigid rotation preserves the original distances. These actual matrices
            // check that both renderer paths honor that constructive bound.
            expect(clearance(centers(cube), Cubelet.SPHERE_RADIUS)).toBeCloseTo(4, 4);
            expect(group.children.filter(child => (child as THREE.Mesh).isMesh)).toHaveLength(0);
          }
          group.angle = 0;
          group.drop();
        }
      }
      expect(clearance(centers(cube), Cubelet.SIZE / 2 + 1)).toBeCloseTo(-2, 4);
    } finally { cube.dispose(); }
  });

  it('preserves the ordinary three-layer state and observable solved semantics', () => {
    const sphere = new Cube(3, 'sphere');
    const ordinary = new Cube(3);
    try {
      for (const alg of [SCRAMBLE, 'R R R R', "M E S x y z Rw U2 F'", '']) {
        sphere.twister.setup(alg);
        ordinary.twister.setup(alg);
        expect(sphere.serialize()).toBe(ordinary.serialize());
        expect(sphere.complete).toBe(ordinary.complete);
      }
      expect(sphere.complete).toBe(true);
    } finally { sphere.dispose(); ordinary.dispose(); }
  });

  it('uses actual balls for picking and keeps genuinely empty gaps available for view drags', () => {
    const cube = new Cube(3, 'sphere');
    try {
      const world = gestureWorld(cube);
      const controller = new Controller(world);
      expect(controller.hitTest(screen(new THREE.Vector3(0, 0, 94), world))?.index).toBe(22);
      expect(controller.hitTest(screen(new THREE.Vector3(32, 32, 64), world))).toBeNull();
      expect(controller.hitTest(new THREE.Vector2(NaN, 300))).toBeNull();

      // Independent triangle raycasting is the oracle for oblique, scrambled and
      // mid-turn picking; identity comes from the actually hit rendered instance.
      cube.twister.setup(SCRAMBLE);
      world.scene.rotation.set(0.35, -0.55, 0.1);
      const group = cube.table.groups.x[2];
      group.drag();
      group.angle = Math.PI / 4;
      world.scene.updateMatrixWorld(true);
      const raycaster = new THREE.Raycaster();
      const renderer = cube.instancedRenderer;
      for (const center of centers(cube)) {
        const position = screen(center.applyMatrix4(cube.matrixWorld), world);
        raycaster.setFromCamera(new THREE.Vector2(position.x / 300 - 1, 1 - position.y / 300), world.camera);
        const expected = raycaster.intersectObjects([renderer.staticFrame, renderer.movingFrame], false)[0];
        if (!expected || expected.instanceId === undefined) continue;
        const initial = renderer.instanceToInitial[expected.instanceId];
        expect(controller.hitTest(position)?.index).toBe(cube.initials.get(initial)!.index);
      }
      group.angle = 0;
      group.drop();
    } finally { cube.dispose(); }
  });
});
