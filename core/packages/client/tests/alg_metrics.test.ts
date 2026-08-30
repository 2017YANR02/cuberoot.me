import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';
import { displayedAlgorithmStm, firstAlgorithmAverageStm } from '@/lib/alg-metrics';

type MetricCase = Pick<AlgCase, 'algs' | 'setup' | 'standard'>;

const metricCase = (algs: string[][], standard?: string, setup = 'R'): MetricCase => ({
  algs: algs.map(group => group.map(alg => ({ alg }))),
  setup,
  standard,
});

describe('algorithm catalog STM metrics', () => {
  it('reuses the displayed cube-alg STM convention, including rotations and trailing AUF', () => {
    expect(displayedAlgorithmStm('3x3', "y R U R' U' U")).toBe(3);
    expect(displayedAlgorithmStm('4x4', "x 3Rw2 U2 M'")).toBe(3);
  });

  it('uses the existing Square-1 twist metric', () => {
    expect(displayedAlgorithmStm('sq1', '(1,-3) / (3,0) / (0,-3) /')).toBe(3);
  });

  it('counts FTO multi-letter moves once and whole-puzzle rotations zero', () => {
    expect(displayedAlgorithmStm('fto', "T BR' BL2 S Ft R")).toBe(4);
    expect(displayedAlgorithmStm('fto', 'BR nope')).toBeNull();
  });

  it('averages only the first algorithm of every case', () => {
    const cases = [
      metricCase([["R U R'", 'R'], ['F2 U2']]),
      metricCase([], 'R F'),
    ];
    expect(firstAlgorithmAverageStm('3x3', cases)).toBe(2.5);
  });

  it('returns null for an empty scope or a case with no formula', () => {
    expect(firstAlgorithmAverageStm('3x3', [])).toBeNull();
    expect(firstAlgorithmAverageStm('3x3', [metricCase([])])).toBeNull();
  });

  it('counts the intentional solved FTO reference as zero moves', () => {
    expect(firstAlgorithmAverageStm('fto', [metricCase([], undefined, '')])).toBe(0);
  });
});
