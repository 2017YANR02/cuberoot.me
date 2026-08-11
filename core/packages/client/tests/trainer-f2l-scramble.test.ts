import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';

import { generateScramble, trainerSetScrambleFeatures } from '@/lib/trainer-scramble';

const F2L_CASE: AlgCase = {
  name: 'F2L test',
  subgroup: 'Test',
  setup: "R U R'",
  sticker: { kind: 'f2l', fl: '' },
  algs: [[{ alg: "R U' R'" }]],
};

afterEach(() => { vi.restoreAllMocks(); });

describe('F2L trainer scramble features', () => {
  it('are declared only by F2L and Advanced F2L sets', () => {
    expect(trainerSetScrambleFeatures('3x3', 'f2l')).toEqual({
      randomInitialD: false,
      randomFinalAuf: true,
      randomFinalY: true,
    });
    expect(trainerSetScrambleFeatures('3x3', 'adv-f2l')).toEqual({
      randomInitialD: false,
      randomFinalAuf: true,
      randomFinalY: true,
    });
    expect(trainerSetScrambleFeatures('3x3', 'zbls')).toEqual({
      randomInitialD: false,
      randomFinalAuf: false,
      randomFinalY: false,
    });
    expect(trainerSetScrambleFeatures('3x3', 'mix:adv-f2l+f2l')).toEqual({
      randomInitialD: false,
      randomFinalAuf: false,
      randomFinalY: false,
    });
  });

  it('leaves the canonical setup untouched when both switches are off', () => {
    expect(generateScramble(F2L_CASE, '3x3', 'inv', {
      randomFinalAuf: false,
      randomFinalY: false,
    })).toBe(F2L_CASE.setup);
  });

  it('appends AUF before the final y rotation', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.3) // U
      .mockReturnValueOnce(0.99); // y'

    expect(generateScramble(F2L_CASE, '3x3', 'inv', {
      randomFinalAuf: true,
      randomFinalY: true,
    })).toBe("R U R' U y'");
  });

  it('allows either final adjustment independently, including no adjustment', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.55);
    expect(generateScramble(F2L_CASE, '3x3', 'inv', {
      randomFinalAuf: true,
      randomFinalY: false,
    })).toBe("R U R' U2");

    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.55);
    expect(generateScramble(F2L_CASE, '3x3', 'inv', {
      randomFinalAuf: false,
      randomFinalY: true,
    })).toBe("R U R' y2");

    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(generateScramble(F2L_CASE, '3x3', 'inv', {
      randomFinalAuf: true,
      randomFinalY: true,
    })).toBe(F2L_CASE.setup);
  });

  it('merges adjacent U and y turns instead of adding empty backtracking', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValueOnce(0.99);
    expect(generateScramble({ ...F2L_CASE, setup: 'R U' }, '3x3', 'inv', {
      randomFinalAuf: true,
      randomFinalY: false,
    })).toBe('R U2');

    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99);
    expect(generateScramble({ ...F2L_CASE, setup: 'R y' }, '3x3', 'inv', {
      randomFinalAuf: false,
      randomFinalY: true,
    })).toBe('R');
  });
});
