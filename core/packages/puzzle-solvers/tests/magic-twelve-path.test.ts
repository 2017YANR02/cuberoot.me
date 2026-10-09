import { describe, expect, it } from 'vitest';
import type { MagicPose } from '../src/magic-eight-path';
import { MAGIC_TWELVE_STEPS, magicTwelveLayerOffsets, magicTwelvePoses } from '../src/magic-twelve-path';

type Vector = readonly [number, number, number];
const EPSILON = 1e-8;
const subtract = (a: Vector, b: Vector): Vector => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vector, b: Vector): number => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const distance = (a: Vector, b: Vector): number => Math.hypot(...subtract(a, b));
const rounded = (v: Vector): number[] => v.map(x => Math.abs(x) < EPSILON ? 0 : Math.round(x * 1e8) / 1e8);

function vertices(pose: MagicPose): Vector[] {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => pose.position.map((v, i) => v + (x * pose.right[i] + y * pose.up[i]) / 2) as unknown as Vector);
}

// Edge indices are local D, R, U, L. None of this oracle reads the path's
// selected tile groups, axes, angle signs, or layer-coefficient table.
function matchingEdges(a: MagicPose, b: MagicPose): [number, number][] {
  const av = vertices(a), bv = vertices(b), matches: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const a0 = av[i], a1 = av[(i + 1) % 4], b0 = bv[j], b1 = bv[(j + 1) % 4];
      if ((distance(a0, b0) < EPSILON && distance(a1, b1) < EPSILON)
        || (distance(a0, b1) < EPSILON && distance(a1, b0) < EPSILON)) matches.push([i, j]);
    }
  }
  return matches;
}

function planeCut(square: Vector[], plane: MagicPose): Vector[] {
  const distances = square.map(point => dot(subtract(point, plane.position), plane.normal));
  const points: Vector[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (Math.abs(distances[i]) < EPSILON) points.push(square[i]);
    if (distances[i] * distances[j] < -1e-14) {
      const t = distances[i] / (distances[i] - distances[j]);
      points.push(square[i].map((v, k) => v + (square[j][k] - v) * t) as unknown as Vector);
    }
  }
  return points;
}

function interior(point: Vector, pose: MagicPose): boolean {
  const relative = subtract(point, pose.position);
  return Math.abs(dot(relative, pose.right)) < 0.5 - EPSILON
    && Math.abs(dot(relative, pose.up)) < 0.5 - EPSILON;
}

// Cut each square by the other's plane and overlap the resulting intervals.
// Full coincident stacks and contact at a boundary are intentional; crossing
// the open interiors of two panels is not an admissible fold.
function interiorsCross(a: MagicPose, b: MagicPose): boolean {
  const direction = cross(a.normal, b.normal);
  const length = Math.hypot(...direction);
  if (length < EPSILON) return false;
  const ac = planeCut(vertices(a), b), bc = planeCut(vertices(b), a);
  if (ac.length < 2 || bc.length < 2) return false;
  const unit = direction.map(v => v / length) as unknown as Vector;
  const ai = ac.map(p => dot(p, unit)), bi = bc.map(p => dot(p, unit));
  const low = Math.max(Math.min(...ai), Math.min(...bi));
  const high = Math.min(Math.max(...ai), Math.max(...bi));
  if (high - low < EPSILON) return false;
  const delta = (high + low) / 2 - dot(ac[0], unit);
  const middle = ac[0].map((v, i) => v + unit[i] * delta) as unknown as Vector;
  return interior(middle, a) && interior(middle, b);
}

function lifted(progress: number): Vector[] {
  const coefficients = magicTwelveLayerOffsets(progress);
  return magicTwelvePoses(progress).map((pose, tile) => pose.position.map((v, i) => v + coefficients[tile] * pose.normal[i]) as unknown as Vector);
}

// Independently recorded from the original-stringing Pochmann fold sequence:
// source diagram tile numbers (1-based), listed bottom to top at each stop.
// https://www.jaapsch.net/puzzles/magicmast.htm (Solution 4)
const EXPECTED_STACKS: readonly (readonly (readonly number[])[])[] = [
  [],
  [[5, 6], [8, 7]],
  [[5, 6, 7]],
  [[4, 7], [5, 6], [9, 8]],
  [[9, 8, 7]],
  [[6, 7], [9, 8]],
  [],
  [[2, 1], [11, 12]],
  [[11, 12, 1]],
  [[1, 12, 11]],
  [[6, 9, 10], [7, 8]],
  [[2, 1], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]],
  [[2, 1], [3, 12], [4, 11, 10]],
  [[9, 10, 11]],
  [[9, 6], [8, 7], [10, 11]],
  [[9, 8, 7]],
  [[6, 7], [9, 8]],
  [],
  [[12, 1], [3, 2]],
  [[12, 1, 2]],
  [[12, 1], [11, 2], [4, 3]],
  [[4, 3, 2]],
  [[1, 2], [4, 3]],
  [],
];

describe('Master Magic original-stringing folding path', () => {
  it('matches the standard start and the target tile identities and orientations', () => {
    expect(MAGIC_TWELVE_STEPS).toBe(23);
    expect(magicTwelvePoses(0).map(p => rounded(p.position))).toEqual([
      [-2.5, 0.5, 0], [-1.5, 0.5, 0], [-0.5, 0.5, 0], [0.5, 0.5, 0], [1.5, 0.5, 0], [2.5, 0.5, 0],
      [2.5, -0.5, 0], [1.5, -0.5, 0], [0.5, -0.5, 0], [-0.5, -0.5, 0], [-1.5, -0.5, 0], [-2.5, -0.5, 0],
    ]);
    const final = magicTwelvePoses(MAGIC_TWELVE_STEPS);
    // This is the numbered target from https://cube.garron.us/master_pattern.gif,
    // viewed from the solved back. Source tiles 2,3,6,8,9,10 have the opposite
    // in-plane orientation to source tiles 1,4,5,7,11,12.
    expect(final.map(p => rounded(p.position))).toEqual([
      [-0.5, -1.5, 0], [-0.5, -2.5, 0], [0.5, -2.5, 0], [0.5, -1.5, 0],
      [1.5, -1.5, 0], [1.5, -0.5, 0], [2.5, -0.5, 0], [2.5, 0.5, 0],
      [1.5, 0.5, 0], [0.5, 0.5, 0], [0.5, -0.5, 0], [-0.5, -0.5, 0],
    ]);
    expect(final.map(p => rounded(p.right))).toEqual([1, -1, -1, 1, 1, -1, 1, -1, -1, -1, 1, 1].map(x => [x, 0, 0]));
    expect(final.map(p => rounded(p.normal))).toEqual(Array.from({ length: 12 }, () => [0, 0, -1]));
  });

  it('keeps all cyclic seams closed and rigid panel interiors uncrossed', () => {
    for (let sample = 0; sample <= MAGIC_TWELVE_STEPS * 16; sample++) {
      const progress = sample / 16, poses = magicTwelvePoses(progress);
      expect(poses.length).toBe(12);
      for (let i = 0; i < 12; i++) {
        const pose = poses[i];
        expect(matchingEdges(pose, poses[(i + 1) % 12]).length, `seam ${i} at ${progress}`).not.toBe(0);
        expect(dot(pose.right, pose.right)).toBeCloseTo(1, 10);
        expect(dot(pose.up, pose.up)).toBeCloseTo(1, 10);
        expect(distance(cross(pose.right, pose.up), pose.normal)).toBeCloseTo(0, 10);
        for (let j = i + 1; j < 12; j++) {
          expect(interiorsCross(pose, poses[j]), `tiles ${i}/${j} at ${progress}`).toBe(false);
        }
      }
    }
  });

  it('switches only between the hinges permitted by the inner string diagonal', () => {
    // Paolini, Exploring the Rubik's Magic Universe, section 3. With a front
    // slash groove, stacking the next tile over that front permits R↔D and
    // L↔U; the reverse face permits R↔U and L↔D. Backslash reverses the rule.
    const last: ({ edge: number; side: number } | undefined)[] = Array(12).fill(undefined);
    let switches = 0;
    for (let sample = 0; sample <= MAGIC_TWELVE_STEPS * 16; sample++) {
      const progress = sample / 16, poses = magicTwelvePoses(progress);
      for (let i = 0; i < 12; i++) {
        const tile = poses[i], next = poses[(i + 1) % 12];
        const shared = matchingEdges(tile, next);
        if (shared.length !== 1) continue;
        const edge = shared[0][0], previous = last[i];
        if (previous && previous.edge !== edge) {
          const boundary = magicTwelvePoses(Math.floor(progress));
          expect(distance(boundary[i].position, boundary[(i + 1) % 12].position)).toBeLessThan(EPSILON);
          const slashPairs = (previous.side > 0) === (i % 2 === 0);
          const pair = [edge, previous.edge].sort().join(',');
          expect(slashPairs ? ['0,1', '2,3'] : ['0,3', '1,2']).toContain(pair);
          switches++;
        }
        last[i] = { edge, side: dot(subtract(next.position, tile.position), tile.normal) };
      }
    }
    expect(switches).toBe(20);
  });

  it('preserves source stack order and at least one full thickness between every layer', () => {
    let stackedPairs = 0, minimumSeparation = Infinity;
    for (let step = 0; step <= MAGIC_TWELVE_STEPS; step++) {
      const ideal = magicTwelvePoses(step), render = lifted(step);
      const groups = new Map<string, number[]>();
      ideal.forEach((pose, tile) => {
        const key = rounded(pose.position).join(',');
        const group = groups.get(key) ?? [];
        group.push(tile);
        groups.set(key, group);
      });
      const stacks = [...groups.values()].filter(group => group.length > 1);
      const actualOrder = stacks.map(group => [...group].sort((a, b) => render[a][2] - render[b][2]).map(tile => tile + 1));
      const order = (groupsToSort: readonly (readonly number[])[]) => groupsToSort.map(group => [...group]).sort((a, b) => a[0] - b[0]);
      expect(order(actualOrder), `stack order at step ${step}`).toEqual(order(EXPECTED_STACKS[step]));
      for (const group of stacks) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            stackedPairs++;
            minimumSeparation = Math.min(minimumSeparation, distance(render[group[i]], render[group[j]]));
          }
        }
      }
    }
    expect(stackedPairs).toBe(60);
    expect(minimumSeparation).toBeCloseTo(2, 10);
    expect(magicTwelveLayerOffsets(0)).toEqual(Array(12).fill(0));
    expect(magicTwelveLayerOffsets(MAGIC_TWELVE_STEPS)).toEqual(Array(12).fill(0));
  });

  it('keeps the ideal and rendered poses continuous across every fold boundary', () => {
    for (let boundary = 1; boundary < MAGIC_TWELVE_STEPS; boundary++) {
      const ideal = magicTwelvePoses(boundary), render = lifted(boundary);
      for (const offset of [-1e-10, 1e-10]) {
        const near = magicTwelvePoses(boundary + offset), nearRender = lifted(boundary + offset);
        for (let tile = 0; tile < 12; tile++) {
          for (const field of ['position', 'right', 'up', 'normal'] as const) {
            expect(distance(ideal[tile][field], near[tile][field])).toBeLessThan(1e-7);
          }
          expect(distance(render[tile], nearRender[tile])).toBeLessThan(1e-7);
        }
      }
    }
    for (const progress of [-1e-9, MAGIC_TWELVE_STEPS + 1e-9, NaN, Infinity, -Infinity]) {
      expect(() => magicTwelvePoses(progress)).toThrow(RangeError);
      expect(() => magicTwelveLayerOffsets(progress)).toThrow(RangeError);
    }
  });
});
