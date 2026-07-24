// Smart-cube gyroscope orientation math.
//
// Everything under test is pure (no DOM, no three.js, no BLE), which is the
// whole point of splitting it out of the view: we own zero smart cubes, so the
// only place the pipeline can be PROVEN correct is here.
//
// The load-bearing assertion is the composition order. `qRaw ⊗ q0⁻¹` (world
// frame, left) and `q0⁻¹ ⊗ qRaw` (body frame, right) are both plausible-looking
// one-liners that both pass a naive "calibrating makes it identity" check —
// they only diverge once the calibration pose is tilted, which is exactly the
// case a hand-held cube is always in. See `world-frame composition` below.
//
// See app/[lang]/timer/_lib/bluetooth/orientation.ts for the reasoning.
import { describe, it, expect } from 'vitest';
import {
  QUAT_IDENTITY,
  SENSOR_BASES,
  BRAND_SENSOR_BASIS,
  BRAND_MIRROR,
  applyOrientation,
  calibrate,
  mirrorForBrand,
  quatAngleTo,
  quatConjugate,
  quatDot,
  quatInverse,
  quatLength,
  quatMul,
  quatNormalize,
  quatSlerp,
  readDevQuatSource,
  sensorBasisForBrand,
  slerpTowards,
  type Quat,
  type SensorBasisName,
} from '@/app/[lang]/timer/_lib/bluetooth/orientation';

/** Rotation of `angle` radians about (unit) `axis`. */
function fromAxisAngle(axis: [number, number, number], angle: number): Quat {
  const n = Math.hypot(...axis);
  const s = Math.sin(angle / 2) / n;
  return { w: Math.cos(angle / 2), x: axis[0] * s, y: axis[1] * s, z: axis[2] * s };
}

/** Rotate a vector by a quaternion (v' = q v q⁻¹). */
function rotate(q: Quat, v: [number, number, number]): [number, number, number] {
  const p: Quat = { w: 0, x: v[0], y: v[1], z: v[2] };
  const r = quatMul(quatMul(quatNormalize(q), p), quatInverse(q));
  return [r.x, r.y, r.z];
}

/** Same orientation? Compares on the sphere, so the q/−q double cover is fine. */
function sameRotation(a: Quat, b: Quat): boolean {
  return quatAngleTo(a, b) < 1e-9;
}

function expectSameRotation(a: Quat, b: Quat): void {
  expect(quatAngleTo(a, b)).toBeLessThan(1e-9);
}

const DEG = Math.PI / 180;
const X: [number, number, number] = [1, 0, 0];
const Y: [number, number, number] = [0, 1, 0];
const Z: [number, number, number] = [0, 0, 1];

const ALL_BASES = Object.keys(SENSOR_BASES) as SensorBasisName[];

describe('quaternion primitives', () => {
  it('identity is the multiplicative unit', () => {
    const q = fromAxisAngle([1, 2, 3], 0.7);
    expectSameRotation(quatMul(q, QUAT_IDENTITY), q);
    expectSameRotation(quatMul(QUAT_IDENTITY, q), q);
  });

  it('q ⊗ q⁻¹ = identity', () => {
    const q = fromAxisAngle([0.3, -0.8, 0.5], 2.1);
    expectSameRotation(quatMul(q, quatInverse(q)), QUAT_IDENTITY);
  });

  it('normalize rescues a degenerate sample instead of producing NaN', () => {
    const z = quatNormalize({ w: 0, x: 0, y: 0, z: 0 });
    expect(z).toEqual({ w: 1, x: 0, y: 0, z: 0 });
    expect(quatLength(quatNormalize({ w: 4, x: 0, y: 3, z: 0 }))).toBeCloseTo(1, 12);
  });

  it('angleTo ignores the q/−q double cover', () => {
    const q = fromAxisAngle(Y, 1.234);
    const neg: Quat = { w: -q.w, x: -q.x, y: -q.y, z: -q.z };
    expect(quatAngleTo(q, neg)).toBeLessThan(1e-9);
  });

  it('angleTo reports the actual turn angle', () => {
    expect(quatAngleTo(QUAT_IDENTITY, fromAxisAngle(Y, 90 * DEG))).toBeCloseTo(90 * DEG, 12);
  });
});

describe('calibration', () => {
  it('is idempotent: calibrate(q) then apply(q) ⇒ identity', () => {
    for (const q of [
      fromAxisAngle(Y, 37 * DEG),
      fromAxisAngle([0.2, 0.9, -0.4], 155 * DEG),
      QUAT_IDENTITY,
    ]) {
      expectSameRotation(applyOrientation(q, calibrate(q)), QUAT_IDENTITY);
    }
  });

  it('survives an un-normalized raw sample', () => {
    const raw: Quat = { w: 2, x: 0, y: 2, z: 0 }; // |q| = 2√2
    expectSameRotation(applyOrientation(raw, calibrate(raw)), QUAT_IDENTITY);
  });

  it('null reference (not yet calibrated) passes the raw sample through', () => {
    const q = fromAxisAngle([1, 1, 0], 40 * DEG);
    expectSameRotation(applyOrientation(q, null), q);
  });
});

describe('world-frame composition (the one that is easy to get backwards)', () => {
  // Calibrate with the cube TILTED — the case that separates the two orders.
  const tilt = fromAxisAngle(X, 30 * DEG);
  const yaw90 = fromAxisAngle(Y, 90 * DEG);
  // The user yaws the physical cube 90° about the room's vertical. In world
  // terms that left-multiplies the current pose.
  const raw = quatMul(yaw90, tilt);

  it('a 90° world yaw displays as a 90° yaw about the screen up axis', () => {
    const shown = applyOrientation(raw, calibrate(tilt));
    expectSameRotation(shown, yaw90);
    // Spelled out on the axis itself: screen up must be a fixed point.
    const up = rotate(shown, Y);
    expect(up[0]).toBeCloseTo(0, 12);
    expect(up[1]).toBeCloseTo(1, 12);
    expect(up[2]).toBeCloseTo(0, 12);
    expect(quatAngleTo(QUAT_IDENTITY, shown)).toBeCloseTo(90 * DEG, 12);
  });

  it('is NOT the body-frame order q0⁻¹ ⊗ qRaw', () => {
    const bodyFrame = quatMul(quatInverse(tilt), raw);
    // Both are 90° turns, but the body-frame one is about a 30°-tilted axis —
    // the cube would visibly tumble instead of spinning flat.
    expect(sameRotation(bodyFrame, yaw90)).toBe(false);
    const up = rotate(bodyFrame, Y);
    expect(Math.abs(up[1] - 1)).toBeGreaterThan(1e-3);
    expectSameRotation(applyOrientation(raw, calibrate(tilt)), yaw90);
  });

  it('the displayed pose is independent of how the cube was held at calibration', () => {
    // Same physical yaw, three different calibration poses ⇒ same display.
    for (const pose of [
      QUAT_IDENTITY,
      fromAxisAngle(X, 30 * DEG),
      fromAxisAngle([0.4, -0.2, 0.9], 110 * DEG),
    ]) {
      expectSameRotation(applyOrientation(quatMul(yaw90, pose), calibrate(pose)), yaw90);
    }
  });
});

describe('unit-norm preservation', () => {
  it('applyOrientation always returns a unit quaternion', () => {
    const raws: Quat[] = [
      { w: 3, x: 0, y: 4, z: 0 },
      { w: 0.1, x: 0.1, y: 0.1, z: 0.1 },
      fromAxisAngle([1, -2, 3], 2.4),
    ];
    for (const raw of raws) {
      for (const basis of ALL_BASES) {
        for (const mirror of [false, true]) {
          const out = applyOrientation(raw, calibrate(fromAxisAngle(Z, 0.9)), { basis, mirror });
          expect(quatLength(out)).toBeCloseTo(1, 12);
        }
      }
    }
  });

  it('slerp stays on the unit sphere', () => {
    const a = fromAxisAngle(X, 10 * DEG);
    const b = fromAxisAngle([0, 1, 1], 170 * DEG);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(quatLength(quatSlerp(a, b, t))).toBeCloseTo(1, 12);
    }
  });
});

describe('sensor basis', () => {
  it('every named basis is a unit quaternion', () => {
    for (const name of ALL_BASES) {
      expect(quatLength(SENSOR_BASES[name])).toBeCloseTo(1, 12);
    }
  });

  it('round-trips: conjugating back by B⁻¹ recovers the original delta', () => {
    const delta = fromAxisAngle([0.2, 0.7, -0.4], 80 * DEG);
    for (const name of ALL_BASES) {
      const b = SENSOR_BASES[name];
      const remapped = applyOrientation(delta, null, { basis: name });
      const back = quatMul(quatMul(quatConjugate(b), remapped), b);
      expectSameRotation(back, delta);
    }
  });

  it('preserves the rotation ANGLE — a basis change can only move the axis', () => {
    const delta = fromAxisAngle(Y, 90 * DEG);
    for (const name of ALL_BASES) {
      const out = applyOrientation(delta, null, { basis: name });
      expect(quatAngleTo(QUAT_IDENTITY, out)).toBeCloseTo(90 * DEG, 12);
    }
  });

  it('swapYZ turns a yaw about +Y into a roll about +Z', () => {
    const out = applyOrientation(fromAxisAngle(Y, 90 * DEG), null, { basis: 'swapYZ' });
    const axis = rotate(out, Z); // +Z is the fixed point of a rotation about +Z
    expect(axis[2]).toBeCloseTo(1, 12);
    expectSameRotation(out, fromAxisAngle(Z, 90 * DEG));
  });

  it('identity basis is a no-op', () => {
    const delta = fromAxisAngle([1, 2, -1], 1.1);
    expectSameRotation(applyOrientation(delta, null, { basis: 'identity' }), delta);
  });

  it('negX is the 180° turn about X (keeps X, flips Y and Z)', () => {
    const b = SENSOR_BASES.negX;
    expect(rotate(b, X)[0]).toBeCloseTo(1, 12);
    expect(rotate(b, Y)[1]).toBeCloseTo(-1, 12);
    expect(rotate(b, Z)[2]).toBeCloseTo(-1, 12);
  });
});

describe('mirror (handedness)', () => {
  const delta = fromAxisAngle([0.3, 0.9, 0.2], 70 * DEG);

  it('negates (x,y,z) — i.e. reverses the rotation', () => {
    const shown = applyOrientation(delta, null, { mirror: true });
    expectSameRotation(shown, quatInverse(delta));
    // Same amount of turn, opposite sense.
    expect(quatAngleTo(QUAT_IDENTITY, shown)).toBeCloseTo(quatAngleTo(QUAT_IDENTITY, delta), 12);
    expect(quatDot(quatNormalize(shown), quatNormalize(delta))).toBeLessThan(1);
  });

  it('is an involution: mirroring twice is the original', () => {
    const once = applyOrientation(delta, null, { mirror: true });
    expectSameRotation(applyOrientation(once, null, { mirror: true }), delta);
  });

  it('flips the sign of a pure yaw', () => {
    const yaw = fromAxisAngle(Y, 90 * DEG);
    expectSameRotation(
      applyOrientation(yaw, null, { mirror: true }),
      fromAxisAngle(Y, -90 * DEG),
    );
  });

  it('commutes with the basis change (so knob order does not matter)', () => {
    for (const name of ALL_BASES) {
      const b = SENSOR_BASES[name];
      const basisThenMirror = quatConjugate(quatMul(quatMul(b, delta), quatConjugate(b)));
      const mirrorThenBasis = applyOrientation(delta, null, { basis: name, mirror: true });
      expectSameRotation(basisThenMirror, mirrorThenBasis);
    }
  });

  it('is something calibration provably cannot do', () => {
    // For every calibration reference, the un-mirrored display of a pure +yaw
    // stays a +yaw: right-multiplying by a constant cannot flip the sense.
    const yaw = fromAxisAngle(Y, 40 * DEG);
    for (const pose of [QUAT_IDENTITY, fromAxisAngle(X, 25 * DEG), fromAxisAngle(Z, 61 * DEG)]) {
      const shown = applyOrientation(quatMul(yaw, pose), calibrate(pose));
      expect(sameRotation(shown, fromAxisAngle(Y, -40 * DEG))).toBe(false);
      expectSameRotation(shown, yaw);
    }
    // The mirror knob is the only thing that does flip it.
    expectSameRotation(
      applyOrientation(quatMul(yaw, QUAT_IDENTITY), calibrate(QUAT_IDENTITY), { mirror: true }),
      fromAxisAngle(Y, -40 * DEG),
    );
  });
});

describe('smoothing', () => {
  const from = QUAT_IDENTITY;
  const to = fromAxisAngle(Y, 90 * DEG);

  it('moves toward the target without overshooting', () => {
    const step = slerpTowards(from, to, 16);
    const moved = quatAngleTo(from, step);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(quatAngleTo(from, to));
  });

  it('is frame-rate independent (one 32 ms step ≈ two 16 ms steps)', () => {
    const one = slerpTowards(from, to, 32);
    const two = slerpTowards(slerpTowards(from, to, 16), to, 16);
    expect(quatAngleTo(one, two)).toBeLessThan(1e-9);
  });

  it('converges to the target', () => {
    let q = from;
    for (let i = 0; i < 200; i++) q = slerpTowards(q, to, 16);
    expect(quatAngleTo(q, to)).toBeLessThan(1e-6);
  });

  it('a zero/negative dt is a no-op (tab wake, clock skew)', () => {
    expectSameRotation(slerpTowards(from, to, 0), from);
    expectSameRotation(slerpTowards(from, to, -5), from);
  });

  it('takes the short way round the double cover', () => {
    const negTo: Quat = { w: -to.w, x: -to.x, y: -to.y, z: -to.z };
    expect(quatAngleTo(slerpTowards(from, to, 16), slerpTowards(from, negTo, 16))).toBeLessThan(1e-9);
  });
});

describe('brand tables', () => {
  it('every brand currently defaults to identity / no mirror (UNVERIFIED)', () => {
    for (const [brand, basis] of Object.entries(BRAND_SENSOR_BASIS)) {
      expect(basis, `${brand} basis`).toBe('identity');
    }
    for (const [brand, m] of Object.entries(BRAND_MIRROR)) {
      expect(m, `${brand} mirror`).toBe(false);
    }
  });

  it('an unknown / missing brand falls through to identity rather than throwing', () => {
    expect(sensorBasisForBrand('some-brand-invented-tomorrow')).toBe('identity');
    expect(sensorBasisForBrand(null)).toBe('identity');
    expect(sensorBasisForBrand(undefined)).toBe('identity');
    expect(mirrorForBrand('nope')).toBe(false);
  });
});

describe('dev synthetic source', () => {
  const g = globalThis as { window?: unknown };

  it('returns null with no window (SSR)', () => {
    expect(g.window).toBeUndefined();
    expect(readDevQuatSource(0)).toBeNull();
  });

  it('reads a fixed quaternion, a function, and rejects garbage', () => {
    g.window = {} as Window;
    try {
      const w = g.window as Window;
      expect(readDevQuatSource(0)).toBeNull();

      w.__cuberootFakeQuat = { w: 2, x: 0, y: 0, z: 0 }; // normalized on read
      expect(readDevQuatSource(0)).toEqual({ w: 1, x: 0, y: 0, z: 0 });

      w.__cuberootFakeQuat = (t: number) => fromAxisAngle(Y, (t / 1000) * Math.PI);
      expectSameRotation(readDevQuatSource(1000)!, fromAxisAngle(Y, Math.PI));

      w.__cuberootFakeQuat = { w: 1 } as unknown as Quat; // missing components
      expect(readDevQuatSource(0)).toBeNull();

      w.__cuberootFakeQuat = (() => { throw new Error('boom'); }) as never;
      expect(readDevQuatSource(0)).toBeNull();
    } finally {
      delete g.window;
    }
  });
});
