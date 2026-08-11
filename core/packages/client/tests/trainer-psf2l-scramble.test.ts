import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';

import {
  generateScramble,
  replaceOuterDAdjustment,
  trainerSetScrambleFeatures,
} from '@/lib/trainer-scramble';

const PSF2L_CASE: AlgCase = {
  name: 'PSF2L 01',
  subgroup: '',
  setup: "D R U R' D'",
  sticker: { kind: 'f2l', fl: '' },
  algs: [[{ alg: "D R U' R' D'" }]],
};

afterEach(() => { vi.restoreAllMocks(); });

describe('PSF2L trainer D adjustment', () => {
  it('is declared only by the PSF2L set', () => {
    expect(trainerSetScrambleFeatures('3x3', 'psf2l')).toEqual({
      randomInitialD: true,
      randomFinalAuf: false,
      randomFinalY: false,
    });
    expect(trainerSetScrambleFeatures('2x2', 'psf2l').randomInitialD).toBe(false);
  });

  it.each([
    ['D', "D R U R' D'"],
    ['D2', "D2 R U R' D2"],
    ["D'", "D' R U R' D"],
  ])('replaces both ends with the inverse pair for %s', (adjustment, expected) => {
    expect(replaceOuterDAdjustment(PSF2L_CASE.setup, adjustment)).toBe(expected);
  });

  it('leaves malformed or non-PSF2L setups untouched', () => {
    expect(replaceOuterDAdjustment('', 'D2')).toBe('');
    expect(replaceOuterDAdjustment("R U R'", 'D2')).toBe("R U R'");
    expect(replaceOuterDAdjustment("D R U R' D", 'D2')).toBe("D R U R' D");
    expect(replaceOuterDAdjustment(PSF2L_CASE.setup, 'U')).toBe(PSF2L_CASE.setup);
  });

  it('draws D, D2 and D-prime without adding an unadjusted fourth state', () => {
    const random = vi.spyOn(Math, 'random');
    random.mockReturnValueOnce(0);
    expect(generateScramble(PSF2L_CASE, '3x3', 'inv', { randomInitialD: true }))
      .toBe("D R U R' D'");

    random.mockReturnValueOnce(0.34);
    expect(generateScramble(PSF2L_CASE, '3x3', 'inv', { randomInitialD: true }))
      .toBe("D2 R U R' D2");

    random.mockReturnValueOnce(0.99);
    expect(generateScramble(PSF2L_CASE, '3x3', 'inv', { randomInitialD: true }))
      .toBe("D' R U R' D");
  });

  it('keeps the document setup exact when the switch is off', () => {
    expect(generateScramble(PSF2L_CASE, '3x3', 'inv', { randomInitialD: false }))
      .toBe(PSF2L_CASE.setup);
  });
});
