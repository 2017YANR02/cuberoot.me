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
  MEASURED_SENSOR_MOUNT,
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

/**
 * THE COMPOSITION ORDER — and the bug it kept causing. Read this before
 * "simplifying" `applyOrientation`.
 *
 * A sample is `qRaw = W ⊗ C ⊗ M⁻¹`: `W` is the sensor's power-on HEADING (not
 * constant between sessions — a cube boots resting on a face, so it lands on a
 * quarter turn), `C` the cube's pose, `M` the mounting. The body-frame delta
 * `q0⁻¹ ⊗ qRaw` cancels `W`; the world-frame delta `qRaw ⊗ q0⁻¹` cancels `M`
 * instead and hands the heading to the renderer, where it reads as「我做 x',
 * 屏幕做 z」. That report was measured on hardware twice, and both times it was
 * written into `BRAND_SENSOR_BASIS` as though it were a mounting — the second
 * time inverting the first. The second test below is that history, executable.
 */
describe('body-frame composition (the one that is easy to get backwards)', () => {
  /** A physical cube move: `x`, about the cube's OWN left-right axis.
   *  记号约定:x / y / z 都是绕对应**正轴 −90°**(从正轴看过去顺时针),`x`
   *  把 D 面转到前面。写成 +90° 就是它们的逆,别把两边搞混。 */
  const xMove = fromAxisAngle(X, -90 * DEG);
  /** Power-on headings. A yaw, quantised to quarter turns; different each session. */
  const HEADINGS = [
    QUAT_IDENTITY,
    fromAxisAngle(Y, 90 * DEG),
    fromAxisAngle(Y, 180 * DEG),
    fromAxisAngle(Y, -90 * DEG),
  ];
  /** How the cube happened to be held when the user tapped 校准. */
  const GRIPS = [
    QUAT_IDENTITY,
    fromAxisAngle(X, 30 * DEG),
    fromAxisAngle([0.4, -0.2, 0.9], 110 * DEG),
  ];
  /** A body-frame move right-multiplies the pose; the heading left-multiplies it.
   *  The mounting is left out here (M = identity) so this block is about the
   *  composition ORDER alone — the mounting gets its own end-to-end block below. */
  const sample = (heading: Quat, pose: Quat, move: Quat) =>
    quatMul(quatMul(heading, pose), move);

  it('one physical x displays as x — from every heading and every grip', () => {
    for (const heading of HEADINGS) {
      for (const grip of GRIPS) {
        const before = sample(heading, grip, QUAT_IDENTITY);
        const after = sample(heading, grip, xMove);
        expectSameRotation(applyOrientation(after, calibrate(before)), xMove);
      }
    }
  });

  it("the world-frame order is the bug: 90° of heading turns that x into a z'", () => {
    const worldFrame = (before: Quat, after: Quat) => quatMul(after, quatInverse(before));
    const shown = HEADINGS.map((heading) => {
      const before = sample(heading, QUAT_IDENTITY, QUAT_IDENTITY);
      return worldFrame(before, sample(heading, QUAT_IDENTITY, xMove));
    });
    // Heading 0: it happens to be right, which is why this ever shipped.
    expectSameRotation(shown[0], xMove);
    // Heading 90°: the same physical move, rendered as a z′ — 用户那句「我做 x',
    // 屏幕做 z」的逆写法,同一件事。
    expectSameRotation(shown[1], fromAxisAngle(Z, 90 * DEG));
    expect(sameRotation(shown[1], xMove)).toBe(false);
    // Heading 270°: the same complaint, inverted — Sprint 31's report.
    expectSameRotation(shown[3], fromAxisAngle(Z, -90 * DEG));
    // Body-frame, same samples, no dependence on the heading at all.
    for (const heading of HEADINGS) {
      const before = sample(heading, QUAT_IDENTITY, QUAT_IDENTITY);
      expectSameRotation(applyOrientation(sample(heading, QUAT_IDENTITY, xMove), calibrate(before)), xMove);
    }
  });

  it('a whole solve of body-frame moves composes, it does not accumulate error', () => {
    const grip = fromAxisAngle([0.4, -0.2, 0.9], 110 * DEG);
    const heading = fromAxisAngle(Y, 90 * DEG);
    const moves = [fromAxisAngle(X, -90 * DEG), fromAxisAngle(Y, -90 * DEG), fromAxisAngle(Z, -90 * DEG)];
    let pose = QUAT_IDENTITY;
    const before = sample(heading, grip, QUAT_IDENTITY);
    for (const m of moves) {
      pose = quatMul(pose, m);
      expectSameRotation(applyOrientation(sample(heading, grip, pose), calibrate(before)), pose);
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
    // stays a +yaw: composing with a constant cannot flip the sense.
    const yaw = fromAxisAngle(Y, 40 * DEG);
    for (const pose of [QUAT_IDENTITY, fromAxisAngle(X, 25 * DEG), fromAxisAngle(Z, 61 * DEG)]) {
      const shown = applyOrientation(quatMul(pose, yaw), calibrate(pose));
      expect(sameRotation(shown, fromAxisAngle(Y, -40 * DEG))).toBe(false);
      expectSameRotation(shown, yaw);
    }
    // The mirror knob is the only thing that does flip it.
    expectSameRotation(
      applyOrientation(quatMul(QUAT_IDENTITY, yaw), calibrate(QUAT_IDENTITY), { mirror: true }),
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
  it('every brand assumes a Z-up IMU', () => {
    for (const [brand, basis] of Object.entries(BRAND_SENSOR_BASIS)) {
      expect(basis, `${brand} basis`).toBe('rotX270');
    }
  });

  /**
   * 表里每一行都必须正好是 `MEASURED_SENSOR_MOUNT` 的逆 —— 换句话说,基表只允许
   * 记「传感器怎么装在魔方里」这一条硬件事实,不许再夹带别的修正。
   *
   * 这条就是防重犯的那道闸:上一次是把开机航向(一次 90° 偏航)当成装配姿态写进
   * 表里,而且是搭在一个和陀螺仪毫无关系的提交里进来的。有了这条,那种改动当场红。
   * 真要动它,得先动 `MEASURED_SENSOR_MOUNT`,那是个必须写明「在真机上重新量过」
   * 的改动,不是顺手补一个常量。
   */
  it('every row is exactly the measured mounting inverted — no room for a second correction', () => {
    const wanted = quatInverse(MEASURED_SENSOR_MOUNT);
    for (const [brand, basis] of Object.entries(BRAND_SENSOR_BASIS)) {
      expect(quatAngleTo(SENSOR_BASES[basis], wanted), `${brand} basis`).toBeLessThan(1e-9);
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
    const b = SENSOR_BASES.rotX270;
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
 * 「物理动作 → 屏幕动作」—— 整块朝向代码的唯一验收标准,端到端走一遍。
 *
 * 上面那些都是零件:这一组把零件拼起来,按真机语义造样本(装配姿态 = 实测的
 * `MEASURED_SENSOR_MOUNT`,再叠一个任意开机航向和任意握法),然后要求屏幕上做的
 * 就是手里做的那一下。用户报 bug 用的是这套话术,验收也就该用这套。
 *
 * 这一组红了只意味着一件事:**要么基表被人动了,要么合成顺序被人动了**。两者都
 * 该回到 orientation.ts 的头注,而不是在这里调参数把它调绿。
 */
describe('物理动作 → 屏幕动作(端到端)', () => {
  const MOUNT = MEASURED_SENSOR_MOUNT;
  const basis = sensorBasisForBrand('gan-v4');
  const mirror = mirrorForBrand('gan-v4');

  /**
   * 一颗真机会报什么:`qRaw = W ⊗ C ⊗ M⁻¹`。
   * `heading` 是开机航向 W,`pose` 是魔方相对校准姿态转过的量(魔方自己的坐标)。
   */
  const raw = (heading: Quat, grip: Quat, pose: Quat): Quat =>
    quatMul(quatMul(quatMul(heading, grip), pose), quatInverse(MOUNT));

  /**
   * 三条魔方自己的轴:x 穿 R 面,y 穿 U 面,z 穿 F 面。
   * 记号是**绕正轴 −90°**(从正轴看过去顺时针):`x` 把 D 转到前面、`y` 把 R 转到
   * 前面、`z` 把 L 转到上面。写成 +90° 就成了它的逆,这一步反过 —— 别再反。
   */
  const MOVES: ReadonlyArray<[string, [number, number, number], number]> = [
    ['x', X, -90], ["x'", X, 90],
    ['y', Y, -90], ["y'", Y, 90],
    ['z', Z, -90], ["z'", Z, 90],
    ['x2', X, 180], ['y2', Y, 180], ['z2', Z, 180],
  ];

  // 航向是绕**传感器自己的竖轴**转的 —— 它是 Z-up 的,所以这里绕 Z 不绕 Y。
  const HEADINGS: ReadonlyArray<[string, Quat]> = [
    ['开机朝北', QUAT_IDENTITY],
    ['开机偏 90°', fromAxisAngle(Z, 90 * DEG)],
    ['开机偏 180°', fromAxisAngle(Z, 180 * DEG)],
    ['开机偏 270°', fromAxisAngle(Z, -90 * DEG)],
  ];

  const GRIPS: ReadonlyArray<[string, Quat]> = [
    ['摆正校准', QUAT_IDENTITY],
    ['歪着校准', fromAxisAngle([0.4, -0.2, 0.9], 110 * DEG)],
  ];

  for (const [headingName, heading] of HEADINGS) {
    for (const [gripName, grip] of GRIPS) {
      it(`${headingName} / ${gripName}:六个转体各就各位`, () => {
        const reference = calibrate(raw(heading, grip, QUAT_IDENTITY));
        for (const [name, axis, deg] of MOVES) {
          const move = fromAxisAngle(axis, deg * DEG);
          const shown = applyOrientation(raw(heading, grip, move), reference, { basis, mirror });
          expect(quatAngleTo(shown, move), `做 ${name}`).toBeLessThan(1e-9);
        }
      });
    }
  }

  it('一次两手也对:x 之后再 y,屏幕上是同一个复合', () => {
    const heading = fromAxisAngle(Z, 90 * DEG);
    const grip = fromAxisAngle(X, 30 * DEG);
    const reference = calibrate(raw(heading, grip, QUAT_IDENTITY));
    const pose = quatMul(fromAxisAngle(X, -90 * DEG), fromAxisAngle(Y, -90 * DEG));
    expectSameRotation(applyOrientation(raw(heading, grip, pose), reference, { basis, mirror }), pose);
  });

  /**
   * 曾经的两次真机报告,写成断言 —— 它们互为逆,所以不可能同时是「装配姿态」。
   * 把航向当成装配姿态写进表里,只会让同一句抱怨换个方向再来一次。
   */
  it('把航向写进基表就会这样:同一个 x,航向差 90° 就成了 z′', () => {
    const worldFrameDelta = (before: Quat, after: Quat) => quatMul(after, quatInverse(before));
    const xMove = fromAxisAngle(X, -90 * DEG);
    const seen = (heading: Quat) => worldFrameDelta(
      raw(heading, QUAT_IDENTITY, QUAT_IDENTITY),
      raw(heading, QUAT_IDENTITY, xMove),
    );
    const b = SENSOR_BASES[basis];
    const through = (q: Quat) => quatMul(quatMul(b, q), quatConjugate(b));
    expectSameRotation(through(seen(fromAxisAngle(Z, 90 * DEG))), fromAxisAngle(Z, 90 * DEG));
    expectSameRotation(through(seen(fromAxisAngle(Z, -90 * DEG))), fromAxisAngle(Z, -90 * DEG));
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
