import { describe, expect, it } from 'vitest';
import {
  generateTimer222ByStepsScramble,
  isWcaPocketScramble,
  pocketScrambleForState,
  timerByStepsIdentity,
  timerByStepsSelection,
  type Timer222ByStepsEngine,
  type TimerByStepsSettings,
} from '@cuberoot/shared/timer';
import {
  cube222MetricOfScramble,
  generate222ByMetric,
} from '@cuberoot/puzzle-solvers/cube222';

const ENGINE: Timer222ByStepsEngine = {
  generate: (metric, lo, hi, random) => generate222ByMetric(metric, lo, hi, random),
  measure: cube222MetricOfScramble,
};

function rng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function inverse(algorithm: string): string {
  return algorithm.trim().split(/\s+/).filter(Boolean).reverse().map((move) => (
    move.endsWith('2') ? move : move.endsWith("'") ? move.slice(0, -1) : `${move}'`
  )).join(' ');
}

const HTM_THREE: TimerByStepsSettings = {
  genByStepsOn: true,
  genStepsMetric: 'htm',
  genSteps: [3],
};

describe('shared 2x2 by-steps contract', () => {
  it('locks random/WCA source ranges and isolates both random style queues', () => {
    expect(timerByStepsSelection('222', 'random', {
      genByStepsOn: true,
      genStepsMetric: 'htm',
      genSteps: [],
    })).toMatchObject({ min: 0, max: 11, lo: 8, hi: 10 });
    expect(timerByStepsSelection('222', 'wca', {
      genByStepsOn: true,
      genStepsMetric: 'htm',
      genSteps: [0, 11],
    })).toMatchObject({ min: 4, max: 11, lo: 4, hi: 11 });
    expect(timerByStepsIdentity('222', 'random', HTM_THREE, 'wca'))
      .not.toBe(timerByStepsIdentity('222', 'random', HTM_THREE, 'optimal'));
  });

  it('keeps the selected state metric while honoring WCA and optimal styles', () => {
    const wca = generateTimer222ByStepsScramble(HTM_THREE, ENGINE, rng(7), 'wca');
    expect(isWcaPocketScramble(wca)).toBe(true);
    expect(cube222MetricOfScramble(wca, 'htm')).toBe(3);

    const optimal = generateTimer222ByStepsScramble(HTM_THREE, ENGINE, rng(7), 'optimal');
    expect(optimal.split(' ')).toHaveLength(3);
    expect(cube222MetricOfScramble(optimal, 'htm')).toBe(3);
  });

  it('re-expresses one state without changing it and fails closed on bad tokens', () => {
    const original = "U R F2 U' R2";
    const wca = pocketScrambleForState(original, 'wca');
    const optimal = pocketScrambleForState(original, 'optimal');
    expect(wca).not.toBeNull();
    expect(optimal).not.toBeNull();
    expect(isWcaPocketScramble(wca!)).toBe(true);
    expect(cube222MetricOfScramble(`${original} ${inverse(wca!)}`, 'htm')).toBe(0);
    expect(cube222MetricOfScramble(`${original} ${inverse(optimal!)}`, 'htm')).toBe(0);
    expect(optimal!.split(' ')).toHaveLength(cube222MetricOfScramble(original, 'htm')!);
    expect(pocketScrambleForState('Ufoo', 'wca')).toBeNull();
  });
});
