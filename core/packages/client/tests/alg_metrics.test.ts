import { describe, expect, it } from 'vitest';
import { displayedAlgorithmStm } from '@/lib/alg-metrics';

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
});
