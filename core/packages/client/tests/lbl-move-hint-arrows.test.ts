import { expect, it } from 'vitest';
import { Mesh, Vector3 } from 'three';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { attachMoveHintArrows } from '../components/AlgPlayer/move-hint-arrows';

it.each([
  { move: "x'", vertical: -1, depth: 1 },
  { move: 'x', vertical: 1, depth: -1 },
])('loops a $move arrow in the indicated direction without turning the cube', ({ move, vertical, depth }) => {
  const cube = new Cube(2);
  const detach = attachMoveHintArrows(cube, move, '#5aac7e', undefined, 'orbit');
  try {
    const state = cube.serialize();
    const arrow = cube.children.at(-1)!.children.at(-1) as Mesh;
    const position = arrow.geometry.getAttribute('position');
    const tipAt = (elapsedMs: number) => {
      detach.update(elapsedMs);
      cube.updateMatrixWorld(true);
      return arrow.localToWorld(new Vector3().fromBufferAttribute(position, position.count - 1));
    };
    const from = tipAt(0);
    const to = tipAt(220);
    expect(from.x).toBeCloseTo(0);
    expect(to.x).toBeCloseTo(0);
    expect(Math.sign(to.y - from.y)).toBe(vertical);
    expect(Math.sign(to.z - from.z)).toBe(depth);
    expect(tipAt(2200).distanceTo(from)).toBeCloseTo(0);
    expect(cube.serialize()).toEqual(state);
  } finally {
    detach();
    cube.dispose();
  }
});

it('alternates each fixed arrow color without moving it or changing the cube state', () => {
  const cube = new Cube(3);
  const detach = attachMoveHintArrows(cube, 'R', '#5aac7e', '#ffffff');
  try {
    const state = cube.serialize();
    const arrows = cube.children.at(-1)!.children as Mesh[];
    detach.update(0);
    const before = arrows.map(arrow => arrow.matrix.clone());
    expect(detach.update(500)).toBe(true);
    expect(arrows.every((arrow, i) => arrow.matrix.equals(before[i]))).toBe(true);
    const colors = new Set(arrows.map(arrow => (arrow.material as import('three').MeshBasicMaterial).color.getHexString()));
    expect(colors.has('5aac7e')).toBe(true);
    expect(colors.has('ffffff')).toBe(true);
    expect(cube.serialize()).toEqual(state);
  } finally { detach(); cube.dispose(); }
});

it('hides arrows as soon as a layer is held, then shows them after it is released', () => {
  const cube = new Cube(3);
  const detach = attachMoveHintArrows(cube, 'R', '#5aac7e', '#ffffff');
  try {
    const group = cube.children.at(-1)!;
    detach.update(0);
    expect(group.visible).toBe(true);
    const layer = cube.table.groups.y[2];
    expect(layer.drag()).toBe(true);
    detach.update(100);
    expect(group.visible).toBe(false);
    const materials = group.children.map(arrow => (arrow as Mesh).material);
    layer.angle = .4;
    detach.update(1000);
    expect(group.children.map(arrow => (arrow as Mesh).material)).toEqual(materials);
    expect(group.visible).toBe(false);
    layer.angle = 0;
    layer.drop();
    detach.update(1100);
    expect(group.visible).toBe(true);
  } finally { detach(); cube.dispose(); }
});

it('keeps the second move of the left trigger on the top layer after the first turn settles', () => {
  const cube = new Cube(2);
  const left = cube.table.groups.x[0];
  expect(left.drag()).toBe(true);
  left.angle = Math.PI / 4;
  const detach = attachMoveHintArrows(cube, "U'", '#5aac7e');
  try {
    const group = cube.children.at(-1)!;
    const topLayer = group.children.map(arrow => arrow.matrix.clone());
    detach.update();
    expect(group.visible).toBe(false);
    left.angle = Math.PI / 2;
    left.drop();
    detach.update();
    expect(group.visible).toBe(true);
    expect(group.children.map(arrow => arrow.matrix.elements)).toEqual(topLayer.map(matrix => matrix.elements));
  } finally { detach(); cube.dispose(); }
});

it.each([
  { move: 'R', frontDirection: [0, 1, 0] },
  { move: "R'", frontDirection: [0, -1, 0] },
  { move: 'U', frontDirection: [-1, 0, 0] },
  { move: "U'", frontDirection: [1, 0, 0] },
  { move: "L'", frontDirection: [0, 1, 0] },
  { move: 'y', frontDirection: [-1, 0, 0] },
])('places $move arrows on the correct surfaces without changing the cube', ({ move, frontDirection }) => {
  const cube = new Cube(3);
  try {
    const state = cube.serialize();
    const count = cube.children.length;
    const detach = attachMoveHintArrows(cube, move, '#C15F3C');
    const group = cube.children.at(-1)!;
    const front = group.children.filter(child => child.position.z > 0 && (child as Mesh).isMesh
      && new Vector3(0, 0, 1).applyQuaternion(child.quaternion).z > .99);
    expect(front.length).toBeGreaterThan(0);
    for (const arrow of front) {
      expect(new Vector3(0, 1, 0).applyQuaternion(arrow.quaternion).distanceTo(new Vector3(...frontDirection))).toBeLessThan(.001);
    }
    expect(cube.serialize()).toEqual(state);
    detach();
    expect(cube.children).toHaveLength(count);
  } finally {
    cube.dispose();
  }
});

it.each(['x', 'y'] as const)('keeps a U hint in place across a turn on the %s axis', axis => {
  const cube = new Cube(3);
  const detach = attachMoveHintArrows(cube, 'U', '#C15F3C');
  try {
    const group = cube.children.at(-1)!;
    const arrows = group.children;
    const before = arrows.map(arrow => arrow.matrix.clone());
    const layer = cube.table.groups[axis][2];
    expect(layer.drag()).toBe(true);
    layer.angle = Math.PI / 4;
    expect(detach.update()).toBe(true);
    expect(group.visible).toBe(false);
    layer.angle = Math.PI / 2;
    layer.drop();
    detach.update();
    expect(group.visible).toBe(true);
    expect(arrows.every((arrow, index) => arrow.matrix.equals(before[index]))).toBe(true);
  } finally {
    detach();
    cube.dispose();
  }
});
