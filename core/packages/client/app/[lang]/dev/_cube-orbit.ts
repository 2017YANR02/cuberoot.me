interface CubePose { x: number; y: number }
export interface CubeRotation { x: number; y: number; z: number; w: number }
interface RotationMatrix {
  m11: number; m12: number; m13: number;
  m21: number; m22: number; m23: number;
  m31: number; m32: number; m33: number;
}

export const CUBE_POSES = {
  system: { x: -18, y: -28 },
  compute: { x: -108, y: -28 },
  design: { x: -18, y: -118 },
  build: { x: -18, y: 62 },
  operations: { x: 72, y: -28 },
  ecosystem: { x: -18, y: -208 },
} as const;

export type CubeFace = keyof typeof CUBE_POSES;

function normalize(rotation: CubeRotation): CubeRotation {
  const length = Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w);
  return { x: rotation.x / length, y: rotation.y / length, z: rotation.z / length, w: rotation.w / length };
}

/** Unit quaternions store orientation, never accumulated revolutions. */
export function rotationFromPose(pose: CubePose): CubeRotation {
  const x = pose.x * Math.PI / 360;
  const y = pose.y * Math.PI / 360;
  return { x: Math.sin(x) * Math.cos(y), y: Math.cos(x) * Math.sin(y), z: Math.sin(x) * Math.sin(y), w: Math.cos(x) * Math.cos(y) };
}

export function dragCubeRotation(start: CubeRotation, dx: number, dy: number): CubeRotation {
  const delta = rotationFromPose({ x: -dy * .45, y: dx * .45 });
  return normalize({
    x: delta.w * start.x + delta.x * start.w + delta.y * start.z - delta.z * start.y,
    y: delta.w * start.y - delta.x * start.z + delta.y * start.w + delta.z * start.x,
    z: delta.w * start.z + delta.x * start.y - delta.y * start.x + delta.z * start.w,
    w: delta.w * start.w - delta.x * start.x - delta.y * start.y - delta.z * start.z,
  });
}

export function cubeRotationMatrix({ x, y, z, w }: CubeRotation): RotationMatrix {
  return {
    m11: 1 - 2 * (y * y + z * z), m12: 2 * (x * y + z * w), m13: 2 * (x * z - y * w),
    m21: 2 * (x * y - z * w), m22: 1 - 2 * (x * x + z * z), m23: 2 * (y * z + x * w),
    m31: 2 * (x * z + y * w), m32: 2 * (y * z - x * w), m33: 1 - 2 * (x * x + y * y),
  };
}

/** Capture even a partially interpolated snap, including its roll. */
export function rotationFromMatrix(m: RotationMatrix): CubeRotation {
  const trace = m.m11 + m.m22 + m.m33;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return normalize({ x: (m.m23 - m.m32) / s, y: (m.m31 - m.m13) / s, z: (m.m12 - m.m21) / s, w: s / 4 });
  }
  if (m.m11 > m.m22 && m.m11 > m.m33) {
    const s = Math.sqrt(1 + m.m11 - m.m22 - m.m33) * 2;
    return normalize({ x: s / 4, y: (m.m21 + m.m12) / s, z: (m.m31 + m.m13) / s, w: (m.m23 - m.m32) / s });
  }
  if (m.m22 > m.m33) {
    const s = Math.sqrt(1 + m.m22 - m.m11 - m.m33) * 2;
    return normalize({ x: (m.m21 + m.m12) / s, y: s / 4, z: (m.m32 + m.m23) / s, w: (m.m31 - m.m13) / s });
  }
  const s = Math.sqrt(1 + m.m33 - m.m11 - m.m22) * 2;
  return normalize({ x: (m.m31 + m.m13) / s, y: (m.m32 + m.m23) / s, z: s / 4, w: (m.m12 - m.m21) / s });
}

/** A matrix makes CSS interpolate the shortest quaternion path to the flat
 * view, rather than replaying every turn back to rotateX(0) rotateY(0). */
export function cubeRotationTransform(rotation: CubeRotation): string {
  const m = cubeRotationMatrix(rotation);
  return `matrix3d(${[m.m11, m.m12, m.m13, 0, m.m21, m.m22, m.m23, 0, m.m31, m.m32, m.m33, 0, 0, 0, 0, 1].join(',')})`;
}

export function nearestCubeFace(rotation: CubeRotation, preferred: CubeFace): CubeFace {
  const m = cubeRotationMatrix(rotation);
  const scores: Record<CubeFace, number> = {
    system: m.m33, compute: -m.m23, design: m.m13,
    build: -m.m13, operations: m.m23, ecosystem: -m.m33,
  };
  let nearest = preferred;
  for (const face of Object.keys(scores) as CubeFace[]) {
    if (scores[face] > scores[nearest] + 1e-9) nearest = face;
  }
  return nearest;
}
