import { describe, expect, it } from 'vitest';
import {
  genByStepsScramble,
  genByStepsSig,
  wcaStepFilter,
} from '@/app/[lang]/timer/_lib/scramble/gen-by-steps';
import {
  generateTimerNon222ByStepsScramble,
  timerNon222StepMetricOfScramble,
} from '@cuberoot/puzzle-solvers/timer-by-steps';
import {
  STEP_METRICS,
  stepMetricSpec,
  stepPuzzleOf,
} from '@/app/[lang]/timer/_lib/scramble/step-metrics';
import {
  generateSkewbByDistance,
  skewbDistanceOfScramble,
} from '@/lib/skewb-solver';

const enabled = (steps: number[]) => ({
  genByStepsOn: true,
  genStepsMetric: 'htm',
  genSteps: steps,
});

describe('计时器斜转难度', () => {
  it('登记完整随机范围、真实 WCA 范围和默认难度带', () => {
    expect(stepPuzzleOf('skewb')).toBe('skewb');
    expect(STEP_METRICS.skewb).toEqual([
      { key: 'htm', zh: '魔方', en: 'Cube', range: [0, 11], wcaRange: [7, 11], band: [8, 10] },
    ]);
    expect(stepMetricSpec('skewb', 'bad')).toBeNull();
  });

  it.each([0, 7, 11])('随机状态能稳定生成精确 %i 步打乱', (distance) => {
    const scramble = generateSkewbByDistance(distance, distance, () => 0);
    expect(scramble).not.toBe('');
    expect(skewbDistanceOfScramble(scramble)).toBe(distance);
  });

  it('Web 只保留 Worker identity，共享引擎生成并复算斜转难度', () => {
    expect(genByStepsSig('skewb', enabled([9]))).toBe('byst|skewb|htm|9.9');
    expect(genByStepsScramble('skewb', enabled([9]))).toBeNull();
    const scramble = generateTimerNon222ByStepsScramble({
      event: 'skewb', metric: 'htm', lo: 9, hi: 9,
    }, () => 0);
    expect(timerNon222StepMetricOfScramble('skewb', 'htm', scramble)).toBe(9);
    expect(timerNon222StepMetricOfScramble('skewb', 'bad', scramble)).toBeNull();
  });

  it('WCA 过滤沿用同一范围，并拒绝非法生成边界', () => {
    expect(wcaStepFilter('skewb', enabled([7, 8, 9]))).toEqual({ metric: 'htm', lo: 7, hi: 9 });
    expect(() => generateSkewbByDistance(-1, 2, Math.random)).toThrow('0..11');
    expect(() => generateSkewbByDistance(2, 1, Math.random)).toThrow('0..11');
    expect(() => generateSkewbByDistance(1.5, 2, Math.random)).toThrow('整数');
    expect(() => generateSkewbByDistance(1, 2, () => 1)).toThrow('[0,1)');
  });
});
