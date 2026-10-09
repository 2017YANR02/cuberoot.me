import { describe, expect, it } from 'vitest';
import { MAGIC_EIGHT_STEPS, magicEightLayerOffsets, magicEightPoses, type MagicPose } from '../src/magic-eight-path';

type Vector = readonly [number, number, number];
const EPSILON = 1e-8;
const dot = (a: Vector, b: Vector): number => a.reduce((sum, value, i) => sum + value * b[i], 0);
const subtract = (a: Vector, b: Vector): Vector => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const distance = (a: Vector, b: Vector): number => Math.hypot(...subtract(a, b));
const rounded = (v: Vector): number[] => v.map(x => Math.abs(x) < EPSILON ? 0 : Math.round(x * 1e8) / 1e8);

function vertices(pose: MagicPose): Vector[] {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => pose.position.map((v, i) => v + (x * pose.right[i] + y * pose.up[i]) / 2) as unknown as Vector);
}

function shareFullEdge(a: MagicPose, b: MagicPose): boolean {
  const av = vertices(a), bv = vertices(b);
  return av.some((a0, i) => bv.some((b0, j) => {
    const a1 = av[(i + 1) % 4], b1 = bv[(j + 1) % 4];
    return (distance(a0, b0) < EPSILON && distance(a1, b1) < EPSILON)
      || (distance(a0, b1) < EPSILON && distance(a1, b0) < EPSILON);
  }));
}

// Independent collision oracle: intersect the two planes, then clip that line
// against the open interiors of both squares. Common edges and intentionally
// coincident zero-thickness stacks are permitted; transverse crossings are not.
function interiorsCross(a: MagicPose, b: MagicPose): boolean {
  const line = cross(a.normal, b.normal), lineSquared = dot(line, line);
  if (lineSquared < EPSILON * EPSILON) return false;
  const da = dot(a.normal, a.position), db = dot(b.normal, b.position);
  const scaledNormals = a.normal.map((v, i) => da * b.normal[i] - db * v) as unknown as Vector;
  const point = cross(scaledNormals, line).map(v => v / lineSquared) as unknown as Vector;
  const direction = line.map(v => v / Math.sqrt(lineSquared)) as unknown as Vector;
  let start = -Infinity, end = Infinity;
  for (const panel of [a, b]) {
    for (const axis of [panel.right, panel.up]) {
      const offset = dot(subtract(point, panel.position), axis), rate = dot(direction, axis);
      if (Math.abs(rate) < EPSILON) {
        if (Math.abs(offset) >= 0.5 - EPSILON) return false;
      } else {
        const first = (-0.5 + EPSILON - offset) / rate, last = (0.5 - EPSILON - offset) / rate;
        start = Math.max(start, Math.min(first, last));
        end = Math.min(end, Math.max(first, last));
      }
    }
  }
  return start < end - EPSILON;
}

describe('Magic eight-panel closed folding path', () => {
  it('starts in a 2×4 rectangle and finishes with the linked back facing forward', () => {
    expect(MAGIC_EIGHT_STEPS).toBe(12);
    expect(magicEightPoses(0).map(p => rounded(p.position))).toEqual([
      [0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0],
      [3, 1, 0], [2, 1, 0], [1, 1, 0], [0, 1, 0],
    ]);
    const final = magicEightPoses(MAGIC_EIGHT_STEPS);
    expect(final.map(p => rounded(p.position))).toEqual([
      [0, 2, 0], [1, 2, 0], [1, 1, 0], [2, 1, 0],
      [2, 0, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0],
    ]);
    expect(final.map(p => rounded(p.normal))).toEqual(Array.from({ length: 8 }, () => [0, 0, -1]));
  });

  it('preserves every cyclic hinge, rigid panel, and uncrossed panel interior through each phase', () => {
    for (let sample = 0; sample <= MAGIC_EIGHT_STEPS * 16; sample++) {
      const progress = sample / 16, poses = magicEightPoses(progress);
      expect(poses.length).toBe(8);
      for (let i = 0; i < poses.length; i++) {
        const pose = poses[i];
        expect(shareFullEdge(pose, poses[(i + 1) % 8]), `hinge ${i} at ${progress}`).toBe(true);
        expect(dot(pose.right, pose.right)).toBeCloseTo(1, 10);
        expect(dot(pose.up, pose.up)).toBeCloseTo(1, 10);
        expect(distance(cross(pose.right, pose.up), pose.normal)).toBeCloseTo(0, 10);
        for (let j = i + 1; j < poses.length; j++) {
          expect(interiorsCross(pose, poses[j]), `panels ${i}/${j} at ${progress}`).toBe(false);
        }
      }
    }
  });

  it('switches hinge edges without a discontinuity, including the final whole-object regrip', () => {
    for (let boundary = 1; boundary < MAGIC_EIGHT_STEPS; boundary++) {
      const exact = magicEightPoses(boundary);
      for (const offset of [-1e-9, 1e-9]) {
        const near = magicEightPoses(boundary + offset);
        for (let tile = 0; tile < 8; tile++) {
          for (const field of ['position', 'right', 'up', 'normal'] as const) {
            expect(distance(exact[tile][field], near[tile][field])).toBeLessThan(1e-7);
          }
        }
      }
    }
  });

  it('rejects values beyond the validated path instead of extrapolating folding angles', () => {
    for (const progress of [-1e-9, MAGIC_EIGHT_STEPS + 1e-9, NaN, Infinity, -Infinity]) {
      expect(() => magicEightPoses(progress)).toThrow(RangeError);
      expect(() => magicEightLayerOffsets(progress)).toThrow(RangeError);
    }
  });

  it('separates coincident layers by a full panel thickness without jumps between phases', () => {
    const lifted = (progress: number): Vector[] => {
      const coefficients = magicEightLayerOffsets(progress);
      return magicEightPoses(progress).map((pose, tile) => pose.position.map((v, i) => v + coefficients[tile] * pose.normal[i]) as unknown as Vector);
    };
    let stackedPairs = 0, minimumSeparation = Infinity;
    for (let step = 0; step < MAGIC_EIGHT_STEPS; step++) {
      const ideal = magicEightPoses(step), render = lifted(step);
      for (let i = 0; i < 8; i++) {
        for (let j = i + 1; j < 8; j++) {
          if (distance(ideal[i].position, ideal[j].position) < EPSILON) {
            stackedPairs++;
            minimumSeparation = Math.min(minimumSeparation, distance(render[i], render[j]));
          }
        }
      }
      if (step > 0) {
        for (const offset of [-1e-10, 1e-10]) {
          const near = lifted(step + offset);
          for (let tile = 0; tile < 8; tile++) expect(distance(render[tile], near[tile])).toBeLessThan(1e-7);
        }
      }
    }
    expect(stackedPairs).toBe(25);
    expect(minimumSeparation).toBeCloseTo(2, 10);
    expect(magicEightLayerOffsets(MAGIC_EIGHT_STEPS)).toEqual(Array(8).fill(0));
  });
});
