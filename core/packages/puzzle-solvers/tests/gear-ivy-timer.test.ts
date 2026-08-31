import { describe, expect, it } from 'vitest';

import {
  GEAR_GODS_NUMBER,
  GEAR_LENGTH_DISTRIBUTION,
  GEAR_TIMER_MIN_LENGTH,
  GEAR_TOTAL_STATES,
  generateGearTimerScramble,
  gearGraphStats,
  parseGearScramble,
  solveGear,
} from '../src/gear';
import {
  IVY_GODS_NUMBER,
  IVY_LENGTH_DISTRIBUTION,
  IVY_TIMER_MIN_LENGTH,
  generateIvyTimerScramble,
  ivyGraphStats,
  parseIvyScramble,
  solveIvy,
} from '../src/ivy';

const SAMPLES = [0, 0.000001, 0.01, 0.1, 0.25, 0.5, 0.75, 0.999999] as const;

function axes(scramble: string): string[] {
  return scramble.split(/\s+/).map((move) => move[0]);
}

function expectNoRepeatedAxis(scramble: string): void {
  const sequence = axes(scramble);
  for (let index = 1; index < sequence.length; index++) {
    expect(sequence[index], scramble).not.toBe(sequence[index - 1]);
  }
}

describe('shared Gear/Ivy graph oracles', () => {
  it('preserves the proven reachable-state counts and exact histograms', () => {
    expect(gearGraphStats()).toEqual({
      total: GEAR_TOTAL_STATES,
      histogram: [...GEAR_LENGTH_DISTRIBUTION],
    });
    expect(ivyGraphStats()).toEqual({
      total: 29_160,
      histogram: [...IVY_LENGTH_DISTRIBUTION],
    });
    expect(GEAR_GODS_NUMBER).toBe(6);
    expect(IVY_GODS_NUMBER).toBe(8);
  });
});

describe('shared csTimer-style Timer providers', () => {
  it('keeps Gear gearso notation, state, minimum length, and axis reduction', () => {
    for (const sample of SAMPLES) {
      const scramble = generateGearTimerScramble(() => sample);
      const moves = parseGearScramble(scramble);
      expect(moves.length).toBeGreaterThanOrEqual(GEAR_TIMER_MIN_LENGTH);
      expect(moves.length).toBeLessThanOrEqual(GEAR_TIMER_MIN_LENGTH + GEAR_GODS_NUMBER);
      expectNoRepeatedAxis(scramble);
      const { solution, length } = solveGear(scramble);
      expect(length).toBeLessThanOrEqual(GEAR_GODS_NUMBER);
      expect(solveGear(`${scramble} ${solution}`).length).toBe(0);
    }
  });

  it('keeps Ivy ivyso notation, state exclusion, minimum length, and axis reduction', () => {
    for (const sample of SAMPLES) {
      const scramble = generateIvyTimerScramble(() => sample);
      const moves = parseIvyScramble(scramble);
      expect(moves.length).toBeGreaterThanOrEqual(IVY_TIMER_MIN_LENGTH);
      expect(moves.length).toBeLessThanOrEqual(IVY_TIMER_MIN_LENGTH + IVY_GODS_NUMBER);
      expectNoRepeatedAxis(scramble);
      const { solution, length } = solveIvy(scramble);
      expect(length).toBeGreaterThan(1);
      expect(length).toBeLessThanOrEqual(IVY_GODS_NUMBER);
      expect(solveIvy(`${scramble} ${solution}`).length).toBe(0);
    }
  });

  it('rejects invalid random sources instead of returning another puzzle', () => {
    for (const bad of [-1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => generateGearTimerScramble(() => bad)).toThrow(
        'gear-solver: rng must return a number in [0,1)',
      );
      expect(() => generateIvyTimerScramble(() => bad)).toThrow(
        'ivy-solver: rng must return a number in [0,1)',
      );
    }
  });
});
