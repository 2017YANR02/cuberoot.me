import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { ArmKinematics, ELBOW_FLEX_MAX, ForearmRotation } from '@/app/[lang]/sim/engine/hands/armKinematics';

describe('fixed-length elbow solve', () => {
  it.each(['R', 'L'] as const)('keeps both segment lengths and the reachable wrist through a full rotation (%s)', side => {
    const solve = new ArmKinematics();
    const target = new Vector3(.09, -.12, .37);
    const previous = new Vector3();
    for (let i = 0; i <= 360; i++) {
      const radians = i * Math.PI / 180;
      solve.solve(target, new Vector3(Math.sin(radians), 0, Math.cos(radians)), .31, .25, side);
      expect(solve.upper.length()).toBeCloseTo(.31, 12);
      expect(solve.fore.length()).toBeCloseTo(.25, 12);
      expect(solve.upper.clone().add(solve.fore).distanceTo(target)).toBeLessThan(1e-12);
      if (i) expect(solve.upper.distanceTo(previous)).toBeLessThan(.015);
      previous.copy(solve.upper);
    }
  });
  it('moves the elbow around the reach circle to satisfy the wrist, and reports impossible targets', () => {
    const solve = new ArmKinematics();
    const target = new Vector3(0, 0, .4);
    const preferred = new Vector3(-1, 0, 1);
    const wrist = { neutral: new Vector3(0, 0, -1), radial: new Vector3(1, 0, 0) };
    expect(solve.solve(target, preferred, .31, .25, 'L', wrist)).toBe(true);
    const elbowDirection = solve.fore.clone().normalize().negate();
    expect(elbowDirection.dot(wrist.radial)).toBeCloseTo(Math.sin(40 * Math.PI / 180), 7);
    expect(solve.upper.clone().add(solve.fore).distanceTo(target)).toBeLessThan(1e-12);
    wrist.neutral.negate();
    expect(solve.solve(target, preferred, .31, .25, 'L', wrist)).toBe(false);
    expect(solve.upper.length()).toBeCloseTo(.31, 12);
    expect(solve.fore.length()).toBeCloseTo(.25, 12);
  });

  it('moves the shoulder the minimum distance for a straight reach beyond both segments', () => {
    const solver = new ArmKinematics();
    const wrist = { neutral: new Vector3(0, 0, -1), radial: new Vector3(1, 0, 0) };
    const fromWrist = new Vector3(0, 0, -.8);
    const correction = new Vector3();
    solver.shoulderCorrection(fromWrist, .31, .25, wrist, correction);
    expect(correction.distanceTo(new Vector3(0, 0, .24))).toBeLessThan(1e-12);
    const target = fromWrist.add(correction).negate();
    expect(solver.solve(target, target, .31, .25, 'R', wrist)).toBe(true);
  });

  it('moves the shoulder for a wrist inside the 150 degree reach boundary', () => {
    const solver = new ArmKinematics();
    const target = new Vector3(0, 0, .075);
    const wrist = { neutral: new Vector3(0, 0, -1), radial: new Vector3(1, 0, 0) };
    expect(solver.solve(target, target, .31, .25, 'L', wrist)).toBe(false);
    expect(solver.upper.angleTo(solver.fore)).toBeCloseTo(ELBOW_FLEX_MAX, 10);
    const fromWrist = target.clone().negate(), correction = new Vector3();
    solver.shoulderCorrection(fromWrist, .31, .25, wrist, correction);
    const corrected = fromWrist.add(correction).negate();
    expect(solver.solve(corrected, target, .31, .25, 'L', wrist)).toBe(true);
    expect(solver.upper.clone().add(solver.fore).distanceTo(corrected)).toBeLessThan(1e-8);
  });

  it('keeps lengths finite at a folded wrist and beyond full reach', () => {
    const solve = new ArmKinematics();
    for (const target of [new Vector3(), new Vector3(0, 0, 2)]) {
      solve.solve(target, new Vector3(0, 0, 1), .31, .25, 'R');
      expect(solve.upper.length()).toBeCloseTo(.31, 10);
      expect(solve.fore.length()).toBeCloseTo(.25, 10);
    }
  });
});


describe('forearm rotation relative to the elbow plane', () => {
  it.each(['R', 'L'] as const)('bounds the rendered thumb direction through both stops (%s)', side => {
    const limiter = new ForearmRotation(), fore = new Vector3(0, 0, -1);
    const towardShoulder = new Vector3(0, .25, .1), thumbUp = new Vector3(0, 1, 0);
    const sign = side === 'R' ? -1 : 1;
    let previous = 0;
    for (let deg = 0; deg <= 360; deg++) {
      const q = new Quaternion().setFromAxisAngle(fore, sign * deg * Math.PI / 180);
      const requested = limiter.angle(fore, towardShoulder, thumbUp.clone().applyQuaternion(q), side);
      const applied = limiter.apply(q, fore, requested, side, 16);
      const actual = limiter.angle(fore, towardShoulder, thumbUp.clone().applyQuaternion(q), side);
      expect(actual).toBeCloseTo(applied, 10);
      expect(Math.abs(actual)).toBeLessThanOrEqual(Math.PI / 2);
      expect(Math.abs(actual - previous)).toBeLessThan(.135);
      if (deg < 70) expect(actual * 180 / Math.PI).toBeCloseTo(deg, 8);
      previous = actual;
    }
    limiter.reset();
    expect(limiter.apply(new Quaternion(), fore, 0, side, 0)).toBe(0);
  });
});
