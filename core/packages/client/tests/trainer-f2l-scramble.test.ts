import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';

import {
  F2L_SLOTS,
  f2lFinalAdjustmentVariants,
  generateScramble,
  normalizeF2LSlots,
  trainerSetScrambleFeatures,
} from '@/lib/trainer-scramble';

const F2L_CASE: AlgCase = {
  name: 'F2L test',
  subgroup: 'Test',
  setup: "R U R'",
  sticker: { kind: 'f2l', fl: '' },
  algs: [[{ alg: "R U' R'" }]],
};

afterEach(() => { vi.restoreAllMocks(); });

describe('F2L trainer scramble features', () => {
  it('enumerates every enabled AUF × slot combination exactly once', () => {
    const both = f2lFinalAdjustmentVariants(true, F2L_SLOTS);
    expect(both).toHaveLength(16);
    expect(new Set(both.map(v => `${v.auf}|${v.y}`)).size).toBe(16);

    expect(f2lFinalAdjustmentVariants(true, ['FL', 'BR'])).toHaveLength(8);
    expect(f2lFinalAdjustmentVariants(false, F2L_SLOTS)).toHaveLength(4);
    expect(f2lFinalAdjustmentVariants(false, ['FR'])).toEqual([{ auf: '', y: '' }]);
  });

  it('maps the four slot labels to their exact final rotations', () => {
    expect(F2L_SLOTS.map(slot => generateScramble(F2L_CASE, '3x3', 'inv', {
      f2lSlots: [slot],
    }))).toEqual([
      "R U R'",
      "R U R' y",
      "R U R' y2",
      "R U R' y'",
    ]);
  });

  it('normalizes persisted slot values and rejects an empty result via its fallback', () => {
    expect(normalizeF2LSlots(['BR', 'FR', 'BR', 'bad'])).toEqual(['FR', 'BR']);
    expect(normalizeF2LSlots([], ['FL'])).toEqual(['FL']);
  });

  it('are declared only by F2L and Advanced F2L sets', () => {
    expect(trainerSetScrambleFeatures('3x3', 'f2l')).toEqual({
      randomInitialD: false,
      psf2lExtraScramble: false,
      randomFinalAuf: true,
      f2lSlots: true,
    });
    expect(trainerSetScrambleFeatures('3x3', 'adv-f2l')).toEqual({
      randomInitialD: false,
      psf2lExtraScramble: false,
      randomFinalAuf: true,
      f2lSlots: true,
    });
    expect(trainerSetScrambleFeatures('3x3', 'zbls')).toEqual({
      randomInitialD: false,
      psf2lExtraScramble: false,
      randomFinalAuf: false,
      f2lSlots: false,
    });
    expect(trainerSetScrambleFeatures('3x3', 'mix:adv-f2l+f2l')).toEqual({
      randomInitialD: false,
      psf2lExtraScramble: false,
      randomFinalAuf: false,
      f2lSlots: false,
    });
  });

  it('leaves the canonical setup untouched for the FR slot with AUF off', () => {
    expect(generateScramble(F2L_CASE, '3x3', 'inv', {
      randomFinalAuf: false,
      f2lSlots: ['FR'],
    })).toBe(F2L_CASE.setup);
  });

  it('appends AUF before the final y rotation', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.3) // U
      .mockReturnValueOnce(0.99); // BR → y'

    expect(generateScramble(F2L_CASE, '3x3', 'inv', {
      randomFinalAuf: true,
      f2lSlots: ['FR', 'BR'],
    })).toBe("R U R' U y'");
  });

  it('allows either final adjustment independently, including no adjustment', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.55);
    expect(generateScramble(F2L_CASE, '3x3', 'inv', {
      randomFinalAuf: true,
      f2lSlots: ['FR'],
    })).toBe("R U R' U2");

    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.55);
    expect(generateScramble(F2L_CASE, '3x3', 'inv', {
      randomFinalAuf: false,
      f2lSlots: F2L_SLOTS,
    })).toBe("R U R' y2");

    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(generateScramble(F2L_CASE, '3x3', 'inv', {
      randomFinalAuf: true,
      f2lSlots: F2L_SLOTS,
    })).toBe(F2L_CASE.setup);
  });

  it('merges adjacent U and y turns instead of adding empty backtracking', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValueOnce(0.99);
    expect(generateScramble({ ...F2L_CASE, setup: 'R U' }, '3x3', 'inv', {
      randomFinalAuf: true,
      f2lSlots: ['FR'],
    })).toBe('R U2');

    vi.restoreAllMocks();
    expect(generateScramble({ ...F2L_CASE, setup: 'R y' }, '3x3', 'inv', {
      randomFinalAuf: false,
      f2lSlots: ['BR'],
    })).toBe('R');
  });
});
