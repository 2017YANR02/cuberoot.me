/** Website-only gyro pose recovery around the shared solve orientation engine. */
import {
  CUBE_FACES,
  facePermFor,
  type CubeFace,
  type FacePerm,
} from '@cuberoot/shared/timer/reconstruct/orient';

import {
  applyOrientation,
  mirrorForBrand,
  nearestCubeOrientation,
  quatConjugate,
  quatMul,
  quatNormalize,
  sensorBasisForBrand,
  type Quat,
} from '../bluetooth/orientation';
import type { GyroSample } from '../bluetooth/gyro_track';

export * from '@cuberoot/shared/timer/reconstruct/orient';

const FACE_VECTOR: Readonly<Record<CubeFace, readonly [number, number, number]>> = Object.freeze({
  U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1],
  B: [0, 0, -1], L: [-1, 0, 0], R: [1, 0, 0],
});

function rotateVector(q: Quat, v: readonly [number, number, number]): [number, number, number] {
  const n = quatNormalize(q);
  const p: Quat = { w: 0, x: v[0], y: v[1], z: v[2] };
  const r = quatMul(quatMul(n, p), quatConjugate(n));
  return [r.x, r.y, r.z];
}

function faceForVector(v: readonly [number, number, number]): CubeFace {
  let best: CubeFace = 'U';
  let bestDot = -Infinity;
  for (const face of CUBE_FACES) {
    const axis = FACE_VECTOR[face];
    const dot = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
    if (dot > bestDot) { best = face; bestDot = dot; }
  }
  return best;
}

function facePermFromQuat(q: Quat): FacePerm {
  const out = {} as Record<CubeFace, CubeFace>;
  for (const face of CUBE_FACES) out[face] = faceForVector(rotateVector(q, FACE_VECTOR[face]));
  return Object.freeze(out);
}

function permKey(perm: FacePerm): string {
  return CUBE_FACES.map(face => perm[face]).join('');
}

const ROTATION_BY_PERM = (() => {
  const tokens = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'] as const;
  const out = new Map<string, string>();
  const queue = [''];
  while (queue.length > 0 && out.size < 24) {
    const rotation = queue.shift()!;
    const key = permKey(facePermFor(rotation));
    if (out.has(key)) continue;
    out.set(key, rotation);
    if (rotation.trim().split(/\s+/).filter(Boolean).length >= 2) continue;
    for (const token of tokens) queue.push(rotation ? `${rotation} ${token}` : token);
  }
  return out;
})();

const INITIAL_POSE_MAX_ERROR_RAD = Math.PI / 4;

export function initialPoseRotation(
  samples: readonly GyroSample[],
  brand?: string | null,
): string | null {
  const first = samples[0];
  if (!first) return null;
  const posed = applyOrientation(first.q, null, {
    basis: sensorBasisForBrand(brand),
    mirror: mirrorForBrand(brand),
  });
  const nearest = nearestCubeOrientation(posed);
  if (nearest.angleRad > INITIAL_POSE_MAX_ERROR_RAD) return null;
  return ROTATION_BY_PERM.get(permKey(facePermFromQuat(nearest.quat))) ?? null;
}
