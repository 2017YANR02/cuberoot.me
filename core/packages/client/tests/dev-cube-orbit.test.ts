import { describe, expect, it } from 'vitest';
import { CUBE_POSES, cubeRotationMatrix, cubeRotationTransform, dragCubeRotation, nearestCubeFace, rotationFromMatrix, rotationFromPose } from '../app/[lang]/dev/_cube-orbit';

describe('developer cube category snapping', () => {
  it('recognizes all six canonical faces after equivalent full turns on either axis', () => {
    for (const [face, pose] of Object.entries(CUBE_POSES)) {
      for (const turns of [-2, -1, 0, 1, 2]) {
        expect(nearestCubeFace(rotationFromPose({ x: pose.x + turns * 360, y: pose.y - turns * 360 }), 'system')).toBe(face);
      }
    }
  });

  it('finds the top and bottom from every side', () => {
    for (const y of [-208, -118, -28, 62, 152, 512]) {
      expect(nearestCubeFace(rotationFromPose({ x: -65, y }), 'system')).toBe('compute');
      expect(nearestCubeFace(rotationFromPose({ x: 65, y }), 'system')).toBe('operations');
    }
  });

  it('keeps the current category on a boundary and changes sides only after crossing it', () => {
    expect(nearestCubeFace(rotationFromPose({ x: -18, y: -44.9 }), 'system')).toBe('system');
    expect(nearestCubeFace(rotationFromPose({ x: -18, y: -45.1 }), 'system')).toBe('design');
    expect(nearestCubeFace(rotationFromPose({ x: -18, y: -45 }), 'system')).toBe('system');
    expect(nearestCubeFace(rotationFromPose({ x: -18, y: -45 }), 'design')).toBe('design');
  });

  it('discards whole revolutions rather than replaying them during unfolding', () => {
    const start = rotationFromPose(CUBE_POSES.design);
    const original = cubeRotationMatrix(start);
    for (const [dx, dy] of [[1600, 0], [0, 1600], [-2400, 2400]]) {
      const turned = cubeRotationMatrix(dragCubeRotation(start, dx, dy));
      for (const key of Object.keys(original) as (keyof typeof original)[]) {
        expect(turned[key]).toBeCloseTo(original[key], 10);
      }
    }
    expect(cubeRotationTransform(start)).toMatch(/^matrix3d\(/);
  });

  it('allows vertical dragging beyond both the top and bottom faces', () => {
    expect(nearestCubeFace(dragCubeRotation(rotationFromPose(CUBE_POSES.compute), 0, 200), 'compute')).toBe('ecosystem');
    expect(nearestCubeFace(dragCubeRotation(rotationFromPose(CUBE_POSES.operations), 0, -200), 'operations')).toBe('ecosystem');
  });

  it('preserves an interrupted orientation including roll and half-turns', () => {
    const rotations = [
      ...Object.values(CUBE_POSES).map(rotationFromPose),
      rotationFromPose({ x: 180, y: 0 }),
      rotationFromPose({ x: 0, y: 180 }),
      rotationFromPose({ x: 180, y: 180 }),
      dragCubeRotation(rotationFromPose(CUBE_POSES.operations), 113, -217),
    ];
    for (const rotation of rotations) {
      const original = cubeRotationMatrix(rotation);
      const restored = cubeRotationMatrix(rotationFromMatrix(original));
      for (const key of Object.keys(original) as (keyof typeof original)[]) {
        expect(restored[key]).toBeCloseTo(original[key], 10);
      }
    }
  });

  it('stays normalized through repeated drags without accumulating angles', () => {
    let rotation = rotationFromPose(CUBE_POSES.system);
    for (let i = 0; i < 1000; i++) rotation = dragCubeRotation(rotation, 127, -83);
    expect(Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w)).toBeCloseTo(1, 12);
    expect(Object.values(cubeRotationMatrix(rotation)).every(value => Math.abs(value) <= 1)).toBe(true);
  });
});
