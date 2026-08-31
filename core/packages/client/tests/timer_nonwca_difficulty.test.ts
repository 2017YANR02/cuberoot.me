import { describe, expect, it } from 'vitest';
import {
  genByStepsScramble,
  genByStepsSig,
} from '@/app/[lang]/timer/_lib/scramble/gen-by-steps';
import {
  generateTimerNon222ByStepsScramble,
  timerNon222StepMetricOfScramble,
} from '@cuberoot/puzzle-solvers/timer-by-steps';
import { STEP_METRICS, stepPuzzleOf } from '@/app/[lang]/timer/_lib/scramble/step-metrics';
import { generateGearByDistance, solveGear } from '@/lib/gear-solver';
import { generateIvyByDistance, solveIvy } from '@/lib/ivy-solver';

const enabled = (metric: string, steps: number[]) => ({
  genByStepsOn: true,
  genStepsMetric: metric,
  genSteps: steps,
});

describe('计时器非 WCA 小状态项目难度', () => {
  it('只登记已有完整精确状态表的枫叶和齿轮', () => {
    expect(stepPuzzleOf('ivy')).toBe('ivy');
    expect(stepPuzzleOf('gear')).toBe('gear');
    expect(STEP_METRICS.ivy[0]).toEqual({
      key: 'htm', zh: '魔方', en: 'Cube', range: [0, 8], band: [5, 7],
    });
    expect(STEP_METRICS.gear[0]).toEqual({
      key: 'ftm', zh: '魔方', en: 'Cube', range: [0, 6], band: [4, 5],
    });
    for (const event of ['fto', 'kilominx', 'redi', 'mpyram', 'sq1']) {
      expect(stepPuzzleOf(event)).toBeNull();
    }
  });

  it.each([0, 5, 8])('枫叶精确生成 %i 步状态', (distance) => {
    const scramble = generateIvyByDistance(distance, distance, () => 0.5);
    expect(scramble).not.toBe('');
    expect(solveIvy(scramble).length).toBe(distance);
  });

  it.each([0, 4, 6])('齿轮精确生成 %i 步状态', (distance) => {
    const scramble = generateGearByDistance(distance, distance, () => 0.5);
    expect(scramble).not.toBe('');
    expect(solveGear(scramble).length).toBe(distance);
  });

  it('Web 只保留 Worker identity，精确生成和复算来自共享引擎', () => {
    expect(genByStepsSig('ivy', enabled('htm', [7]))).toBe('byst|ivy|htm|7.7');
    expect(genByStepsSig('gear', enabled('ftm', [5]))).toBe('byst|gear|ftm|5.5');
    expect(genByStepsScramble('ivy', enabled('htm', [7]))).toBeNull();
    expect(genByStepsScramble('gear', enabled('ftm', [5]))).toBeNull();
    const ivy = generateTimerNon222ByStepsScramble({ event: 'ivy', metric: 'htm', lo: 7, hi: 7 }, () => 0);
    const gear = generateTimerNon222ByStepsScramble({ event: 'gear', metric: 'ftm', lo: 5, hi: 5 }, () => 0);
    expect(timerNon222StepMetricOfScramble('ivy', 'htm', ivy)).toBe(7);
    expect(timerNon222StepMetricOfScramble('gear', 'ftm', gear)).toBe(5);
  });

  it('拒绝越界、反向、非整数和非法随机数', () => {
    expect(() => generateIvyByDistance(-1, 2, Math.random)).toThrow('0..8');
    expect(() => generateIvyByDistance(2, 1, Math.random)).toThrow('0..8');
    expect(() => generateIvyByDistance(1.5, 2, Math.random)).toThrow('integers');
    expect(() => generateIvyByDistance(1, 2, () => 1)).toThrow('[0,1)');
    expect(() => generateGearByDistance(-1, 2, Math.random)).toThrow('0..6');
    expect(() => generateGearByDistance(2, 1, Math.random)).toThrow('0..6');
    expect(() => generateGearByDistance(1.5, 2, Math.random)).toThrow('integers');
    expect(() => generateGearByDistance(1, 2, () => 1)).toThrow('[0,1)');
  });
});
