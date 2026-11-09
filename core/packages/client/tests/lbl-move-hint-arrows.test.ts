import { expect, it } from 'vitest';
import { Mesh, Vector3 } from 'three';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { attachMoveHintArrows } from '../components/AlgPlayer/move-hint-arrows';
import { SIZE } from '@cuberoot/puzzle-render-core/engine/define';

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

it('follows both a dragged layer and its completed turn without a jump', () => {
  const cube = new Cube(3);
  const detach = attachMoveHintArrows(cube, 'U', '#C15F3C');
  try {
    const arrows = cube.children.at(-1)!.children;
    const before = arrows.map(arrow => arrow.matrix.clone());
    const layer = cube.table.groups.y[2];
    expect(layer.drag()).toBe(true);
    layer.angle = Math.PI / 4;
    expect(detach.update()).toBe(true);
    arrows.forEach((arrow, i) => {
      const expected = before[i].clone().premultiply(layer.matrix);
      expect(arrow.matrix.elements).toEqual(expected.elements);
    });
    layer.angle = Math.PI / 2;
    detach.update();
    const ending = arrows.map(arrow => arrow.matrix.clone());
    layer.drop();
    detach.update();
    arrows.forEach((arrow, i) => arrow.matrix.elements.forEach((value, j) => {
      expect(value).toBeCloseTo(ending[i].elements[j], 6);
    }));
  } finally {
    detach();
    cube.dispose();
  }
});

it('also follows the affected stickers when the user drags a different layer', () => {
  const cube = new Cube(3);
  const detach = attachMoveHintArrows(cube, 'U', '#C15F3C');
  try {
    const arrows = cube.children.at(-1)!.children;
    const before = arrows.map(arrow => arrow.matrix.clone());
    const layer = cube.table.groups.x[2];
    expect(layer.drag()).toBe(true);
    layer.angle = -.4;
    detach.update();
    arrows.forEach((arrow, i) => {
      const moved = new Vector3().setFromMatrixPosition(before[i]).x > SIZE / 2;
      const expected = moved ? before[i].clone().premultiply(layer.matrix) : before[i];
      arrow.matrix.elements.forEach((value, j) => expect(value).toBeCloseTo(expected.elements[j], 6));
    });
    layer.angle = 0;
    layer.drop();
  } finally {
    detach();
    cube.dispose();
  }
});
