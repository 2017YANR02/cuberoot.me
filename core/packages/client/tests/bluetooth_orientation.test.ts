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
  CUBE_ORIENTATIONS,
  SNAP_AFTER_MS,
  SNAP_MAX_RAD,
  advanceStillMs,
  nearestCubeOrientation,
  snapWhenSettled,
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
  it('every brand assumes a Z-up IMU yawed 90° (both reported symptoms)', () => {
    for (const [brand, basis] of Object.entries(BRAND_SENSOR_BASIS)) {
      expect(basis, `${brand} basis`).toBe('rotY90X270');
    }
  });

  it('no brand mirrors — a change of basis is proper and cannot fix handedness', () => {
    for (const [brand, m] of Object.entries(BRAND_MIRROR)) {
      expect(m, `${brand} mirror`).toBe(false);
    }
  });

  it('an unknown / missing brand falls through to the `unknown` row, not identity', () => {
    // "We didn't recognise this cube" is not evidence that its IMU is Y-up.
    expect(sensorBasisForBrand('some-brand-invented-tomorrow')).toBe(BRAND_SENSOR_BASIS.unknown);
    expect(sensorBasisForBrand(null)).toBe(BRAND_SENSOR_BASIS.unknown);
    expect(sensorBasisForBrand(undefined)).toBe(BRAND_SENSOR_BASIS.unknown);
    expect(mirrorForBrand('nope')).toBe(false);
  });
});

/**
 * The reported bug, as an assertion: 「实体做的是 y 转体,屏幕里做的是 z 转体」。
 *
 * The cube's IMU calls the axis out of its top face +Z, three.js calls it +Y.
 * Feed one to the other unchanged and every yaw arrives as a roll — which is
 * exactly what a `y` rendering as a `z` is. These lock the correction down in
 * both directions so nobody "simplifies" the basis back to identity.
 */
describe('Z-up sensor into a Y-up renderer', () => {
  it('identity IS the bug: a sensor yaw about +Z renders as a roll about +Z', () => {
    const out = applyOrientation(fromAxisAngle(Z, 90 * DEG), null, { basis: 'identity' });
    expectSameRotation(out, fromAxisAngle(Z, 90 * DEG));
  });

  it('rotX270 lands that same yaw on the screen\'s +Y — the fix', () => {
    const out = applyOrientation(fromAxisAngle(Z, 90 * DEG), null, { basis: 'rotX270' });
    expectSameRotation(out, fromAxisAngle(Y, 90 * DEG));
    // Same sense, not just the same axis: +90 stays +90.
    expect(rotate(out, X)[2]).toBeCloseTo(-1, 12);
  });

  it('maps the whole frame, not just the one axis: z→y, y→−z, x fixed', () => {
    const b = SENSOR_BASES.rotX270;
    const [zx, zy, zz] = rotate(b, Z);
    expect([zx, zy, zz].map(n => Math.round(n))).toEqual([0, 1, 0]);
    const [yx, yy, yz] = rotate(b, Y);
    expect([yx, yy, yz].map(n => Math.round(n))).toEqual([0, 0, -1]);
    expect(rotate(b, X)[0]).toBeCloseTo(1, 12);
  });

  it('is proper — it moves axes and leaves handedness alone', () => {
    // A mirror would be needed on top if the cube also yawed backwards; the
    // basis alone must not introduce that.
    const b = SENSOR_BASES.rotY90X270;
    const [ax, ay, az] = rotate(b, X);
    const [bx, by, bz] = rotate(b, Y);
    const cross: [number, number, number] = [
      ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx,
    ];
    const [cx, cy, cz] = rotate(b, Z);
    expect(cross[0]).toBeCloseTo(cx, 12);
    expect(cross[1]).toBeCloseTo(cy, 12);
    expect(cross[2]).toBeCloseTo(cz, 12);
  });
});

/**
 * 第二轮真机报告:「y 现在对了,但实际做 x 屏幕做 z,实际做 z 屏幕做 x'」。
 *
 * 三句话把传感器的三条轴全钉死了。第一轮已经定下**传感器 +Z 就是魔方的竖轴**
 * (它转到屏幕的 +Y 之后 `y` 才对的);这一轮的两个症状再把另外两条定出来:
 *
 *   rotX270 把 s_x 送到屏幕 +x、把 s_y 送到 −z。物理 x 出来是 **+z** ⇒ 物理 x = −s_y;
 *   物理 z 出来是 **−x** ⇒ 物理 z = −s_x。
 *
 * 于是「物理三轴 → 屏幕三轴」在两个基下各是什么,就成了可以直接断言的事实。
 */
describe('the second round: x and z were still 90° out', () => {
  /** 魔方自己的三条轴,写在传感器坐标里(推导见上)。 */
  const PHYS_X: [number, number, number] = [0, -1, 0];
  const PHYS_Y: [number, number, number] = [0, 0, 1];
  const PHYS_Z: [number, number, number] = [-1, 0, 0];
  // `|| 0` 把 −0 折成 0:轴向对不对和它是从哪一边趋近于零无关。
  const round = (v: [number, number, number]) => v.map(n => Math.round(n) || 0);

  it('rotX270 reproduces exactly what the user saw: x→z, z→x−, y already right', () => {
    const b = SENSOR_BASES.rotX270;
    expect(round(rotate(b, PHYS_X))).toEqual([0, 0, 1]);    // 做 x,屏幕做 z
    expect(round(rotate(b, PHYS_Z))).toEqual([-1, 0, 0]);   // 做 z,屏幕做 x'
    expect(round(rotate(b, PHYS_Y))).toEqual([0, 1, 0]);    // y 是对的
  });

  it('rotY90X270 puts all three where they belong', () => {
    const b = SENSOR_BASES.rotY90X270;
    expect(round(rotate(b, PHYS_X))).toEqual([1, 0, 0]);
    expect(round(rotate(b, PHYS_Y))).toEqual([0, 1, 0]);
    expect(round(rotate(b, PHYS_Z))).toEqual([0, 0, 1]);
  });

  it('and it really is rotY90 composed onto rotX270, left factor first', () => {
    const composed = quatMul(SENSOR_BASES.rotY90, SENSOR_BASES.rotX270);
    expectSameRotation(SENSOR_BASES.rotY90X270, composed);
  });

  it('chaining the two similarities equals applying the composite once', () => {
    // `B ⊗ q ⊗ B⁻¹` twice = `(B₂B₁) ⊗ q ⊗ (B₂B₁)⁻¹`. This is why the fix is a
    // LEFT factor and not a second call somewhere downstream.
    const sample = fromAxisAngle([0.3, -0.7, 0.5], 37 * DEG);
    const twice = applyOrientation(
      applyOrientation(sample, null, { basis: 'rotX270' }), null, { basis: 'rotY90' },
    );
    const once = applyOrientation(sample, null, { basis: 'rotY90X270' });
    expectSameRotation(twice, once);
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

// ── Settling onto a whole orientation ────────────────────────────────────
//
// This is the fix for "the cube on screen is permanently crooked and
// calibrating does not help". Calibration only zeroes the pose AT THE TAP; the
// grip error it captured then shows up in every pose after it. These lock the
// two halves of the rule: what counts as still, and what a still pose is
// allowed to be rounded to.

describe('cube orientation set', () => {
  it('is exactly the 24 rotations of a cube, and closed under quarter turns', () => {
    expect(CUBE_ORIENTATIONS).toHaveLength(24);
    // Closure: every generator applied to every element lands back in the set.
    for (const o of CUBE_ORIENTATIONS) {
      for (const g of [SENSOR_BASES.rotX90, SENSOR_BASES.rotY90, SENSOR_BASES.rotZ90]) {
        const moved = quatMul(g, o);
        expect(CUBE_ORIENTATIONS.some((c) => sameRotation(c, moved))).toBe(true);
      }
    }
    // No duplicates — the double cover would hide them from a naive compare.
    for (let i = 0; i < CUBE_ORIENTATIONS.length; i++) {
      for (let j = i + 1; j < CUBE_ORIENTATIONS.length; j++) {
        expect(sameRotation(CUBE_ORIENTATIONS[i], CUBE_ORIENTATIONS[j])).toBe(false);
      }
    }
  });

  it('rounds a slightly-off pose to the whole one, and reports how far it was', () => {
    const off = quatMul(fromAxisAngle(X, 0.06), fromAxisAngle(Y, Math.PI / 2));
    const near = nearestCubeOrientation(off);
    expectSameRotation(near.quat, fromAxisAngle(Y, Math.PI / 2));
    expect(near.angleRad).toBeCloseTo(0.06, 6);
    // A whole orientation is its own nearest, at zero distance.
    for (const o of CUBE_ORIENTATIONS) {
      expect(nearestCubeOrientation(o).angleRad).toBeLessThan(1e-9);
    }
  });

  it('is spaced a quarter turn apart, which is what makes the snap unambiguous', () => {
    // The closest two distinct cube orientations ever get is 90°, so anything
    // within 45° of one is nearer to it than to any other. SNAP_MAX_RAD sits at
    // half of that, i.e. the snap can never round to the WRONG orientation —
    // which is the property the view relies on and the reason the threshold is
    // not a free knob.
    //
    // (The set does not COVER SO(3) that tightly: measured over 2e6 uniform
    // samples the furthest any pose sits from all 24 is ~62.7°. That is fine —
    // poses that far out are never snapped at all.)
    let closest = Infinity;
    for (let i = 0; i < CUBE_ORIENTATIONS.length; i++) {
      for (let j = i + 1; j < CUBE_ORIENTATIONS.length; j++) {
        closest = Math.min(closest, quatAngleTo(CUBE_ORIENTATIONS[i], CUBE_ORIENTATIONS[j]));
      }
    }
    expect(closest).toBeCloseTo(Math.PI / 2, 9);
    expect(SNAP_MAX_RAD).toBeLessThan(closest / 2);
  });
});

describe('snapWhenSettled', () => {
  const tilt = (rad: number) => fromAxisAngle(X, rad);

  it('leaves a moving cube exactly as measured', () => {
    const q = tilt(0.1);
    expectSameRotation(snapWhenSettled(q, 0), q);
    expectSameRotation(snapWhenSettled(q, SNAP_AFTER_MS - 1), q);
  });

  it('rounds a settled cube onto the whole orientation', () => {
    expectSameRotation(snapWhenSettled(tilt(0.1), SNAP_AFTER_MS), QUAT_IDENTITY);
    // The reported symptom: a few degrees of grip error, held, forever.
    expectSameRotation(snapWhenSettled(tilt(SNAP_MAX_RAD - 0.01), SNAP_AFTER_MS + 500), QUAT_IDENTITY);
  });

  it('leaves a cube genuinely held at an angle alone', () => {
    const held = tilt(SNAP_MAX_RAD + 0.01);
    expectSameRotation(snapWhenSettled(held, 10_000), held);
    // 45° is the classic "resting on an edge" pose — it must keep reading 45°.
    const edge = tilt(Math.PI / 4);
    expectSameRotation(snapWhenSettled(edge, 10_000), edge);
  });
});

describe('advanceStillMs', () => {
  it('accumulates while the pose barely moves and resets the moment it does', () => {
    const a = tiltY(0);
    expect(advanceStillMs(null, a, 999, 16)).toBe(0); // nothing to compare against
    expect(advanceStillMs(a, a, 0, 16)).toBe(16);
    expect(advanceStillMs(a, a, 16, 16)).toBe(32);
    // Sensor noise well under a degree does not break the streak.
    expect(advanceStillMs(a, tiltY(0.005), 100, 16)).toBe(116);
    // A real turn does.
    expect(advanceStillMs(a, tiltY(Math.PI / 2), 5000, 16)).toBe(0);
  });

  it('never runs backwards on a bad dt', () => {
    const a = tiltY(0);
    expect(advanceStillMs(a, a, 100, -50)).toBe(100);
  });
});

function tiltY(rad: number): Quat {
  return fromAxisAngle(Y, rad);
}
