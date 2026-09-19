import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { RoomCube, ROOM_SCENE_COUNT } from '@/app/[lang]/sim/room-cube';
import { ROOM_THEMES, normalizeRoomTheme, roomCubeActive, supportsRoomCube } from '@/app/[lang]/sim/room-themes';

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
    const material = vi.spyOn([...rooms.rooms.values()][0].material, 'dispose');
    rooms.dispose(); rooms.dispose();
    expect(rooms.parent).toBe(null);
    expect(rooms.rooms.size).toBe(0);
    expect(cube.instancedRenderer.visible).toBe(true);
    for (const spy of [...spies, material]) expect(spy).toHaveBeenCalledTimes(1);
    cube.dispose();
  });
});
