import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { RoomCube, ROOM_SCENE_COUNT } from '@/app/[lang]/sim/room-cube';
import { ROOM_THEMES, normalizeRoomTheme, roomCubeActive, supportsRoomCube } from '@/app/[lang]/sim/room-themes';
import { buildInterior, createInteriorMaterials, INTERIOR_SCENES } from '@/app/[lang]/sim/room-interiors';

describe('miniature room cube boundaries', () => {
  it('validates persisted themes and supports only ordinary integer orders 2–7', () => {
    for (const invalid of [null, undefined, '', 'pictures', 'unknown', {}, 3]) expect(normalizeRoomTheme(invalid)).toBe('off');
    for (const invalid of [null, undefined, '3', 'mirror', 'sq1', 1, 8, 2.5, NaN, Infinity]) expect(supportsRoomCube(invalid)).toBe(false);
    expect(roomCubeActive(3, 'off')).toBe(false);
    expect(roomCubeActive('mirror', 'whimsy')).toBe(false);
    for (const { id } of ROOM_THEMES) for (const n of [2, 3, 4, 5, 6, 7]) expect(roomCubeActive(n, id)).toBe(true);
  });

  for (const { id } of ROOM_THEMES) {
    it.each([2, 3, 4, 5, 6, 7])(`${id}: every room is finite, three-dimensional and inside its physical cubie (%i)`, (order) => {
      const cube = new Cube(order);
      const rooms = new RoomCube(cube, id);
      try {
        expect(rooms.rooms.size).toBe(order ** 3 - (order - 2) ** 3);
        expect(new Set([...rooms.rooms.values()].map((mesh) => mesh.userData.roomScene)).size).toBe(Math.min(ROOM_SCENE_COUNT, rooms.rooms.size));
        expect(cube.instancedRenderer.visible).toBe(false);
        for (const mesh of rooms.rooms.values()) {
          const positions = mesh.geometry.getAttribute('position');
          expect([...positions.array].every(Number.isFinite)).toBe(true);
          expect([...mesh.geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
          expect(mesh.geometry.getAttribute('color').count).toBe(positions.count);
          if (id === 'whimsy') {
            expect(mesh.geometry.getAttribute('uv').count).toBe(positions.count);
            expect(mesh.geometry.groups.every((group) => group.materialIndex! >= 0 && group.materialIndex! < 7)).toBe(true);
            expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
          }
          mesh.geometry.computeBoundingBox();
          const box = mesh.geometry.boundingBox!;
          for (const axis of ['x', 'y', 'z'] as const) {
            expect(box.min[axis]).toBeGreaterThanOrEqual(-32);
            expect(box.max[axis]).toBeLessThanOrEqual(32);
            expect(box.max[axis] - box.min[axis]).toBeGreaterThan(45);
          }
        }
      } finally { rooms.dispose(); cube.dispose(); }
    });
  }

  it('tracks real HOME cubies through a partial turn, a scramble, undo and reset', () => {
    const cube = new Cube(3), rooms = new RoomCube(cube, 'whimsy');
    const expected = new THREE.Matrix4();
    const verify = () => {
      cube.updateMatrixWorld(true);
      for (const [initial, mesh] of rooms.rooms) {
        cube.instancedRenderer.getCubeletRenderMatrix(initial, expected);
        expect(mesh.matrix.elements).toEqual(expected.elements);
      }
    };
    try {
      verify();
      const home = rooms.rooms.get(26)!.matrix.clone();
      const slice = cube.table.groups.x[2];
      expect(slice.drag()).toBe(true);
      slice.angle = Math.PI / 5;
      verify();
      expect(rooms.rooms.get(26)!.matrix.equals(home)).toBe(false);
      slice.twist(Math.PI / 2, true);
      verify();
      cube.twister.setup('R U F2 L D B'); verify();
      cube.twister.setup("B' D' L' F2 U' R'"); verify();
      cube.reset(); verify();
      expect(rooms.rooms.get(26)!.matrix.elements).toEqual(home.elements);
    } finally { rooms.dispose(); cube.dispose(); }
  });

  it('disposes every owned resource once and restores the original renderer', () => {
    const cube = new Cube(3), rooms = new RoomCube(cube, 'cosmos');
    const spies = [...rooms.rooms.values()].map((mesh) => vi.spyOn(mesh.geometry, 'dispose'));
    const material = vi.spyOn([...rooms.rooms.values()][0].material as THREE.Material, 'dispose');
    rooms.dispose(); rooms.dispose();
    expect(rooms.parent).toBe(null);
    expect(rooms.rooms.size).toBe(0);
    expect(cube.instancedRenderer.visible).toBe(true);
    for (const spy of [...spies, material]) expect(spy).toHaveBeenCalledTimes(1);
    cube.dispose();
  });

  it('provides nine residential interiors and deterministic local PBR finishes', () => {
    expect(INTERIOR_SCENES).toEqual(['living', 'bedroom', 'kitchen', 'bathroom', 'reception', 'basement', 'library', 'dining', 'conservatory']);
    for (const index of [-1, 9, 1.5, NaN, Infinity]) expect(() => buildInterior(index, [true, true])).toThrow('Invalid interior scene');
    const a = createInteriorMaterials(), b = createInteriorMaterials();
    try {
      expect(a.map((material) => material.name)).toEqual(['miniature-paint', 'miniature-wood', 'miniature-fabric', 'miniature-stone', 'miniature-metal', 'miniature-glaze', 'miniature-light']);
      expect(a[4].metalness).toBe(0.65);
      expect(a[5].roughness).toBe(0.16);
      for (const i of [1, 2, 3]) {
        expect(a[i].map).toBeInstanceOf(THREE.DataTexture);
        expect((a[i].map as THREE.DataTexture).image.data).toEqual((b[i].map as THREE.DataTexture).image.data);
        expect(a[i].bumpMap).toBe(a[i].map);
      }
    } finally { for (const material of [...a, ...b]) { material.map?.dispose(); material.dispose(); } }
  });

  it('releases shared residential geometries, seven materials and three textures exactly once', () => {
    const cube = new Cube(4), rooms = new RoomCube(cube, 'whimsy');
    const geometries = new Set([...rooms.rooms.values()].map((mesh) => mesh.geometry));
    expect(geometries.size).toBeLessThan(rooms.rooms.size);
    const materials = [...rooms.rooms.values()][0].material as THREE.MeshStandardMaterial[];
    const textures = materials.flatMap((material) => material.map ? [material.map] : []);
    expect(textures.length).toBe(3);
    const spies = [...geometries, ...materials, ...textures].map((resource) => vi.spyOn(resource, 'dispose'));
    rooms.dispose(); rooms.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(cube.instancedRenderer.visible).toBe(true);
    cube.dispose();
  });
});
