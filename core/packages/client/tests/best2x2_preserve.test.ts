import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import { preserveAlg } from '../scripts/best2x2/preserve-alg.mjs';

describe('Best 2x2 source moves', () => {
  const sune = "R U R' U R U2 R'";
  const setup = new Alg(sune).invert().toString();

  it('keeps the original R U Sune verbatim', async () => {
    expect(await preserveAlg(setup, { alg: sune })).toEqual({ alg: sune });
  });

  it('only prepends U when the case needs an initial adjustment', async () => {
    expect(await preserveAlg(`${setup} U'`, { alg: sune })).toEqual({ alg: `U ${sune}` });
  });

  it('uses an independent setup instead of folding rotations or appending D', async () => {
    const original = { alg: sune, altId: '2927' };
    const result = await preserveAlg(`U ${setup}`, original);
    expect(result.alg).toBe(sune);
    expect(result.altId).toBe('2927');
    expect(result.setup).toBe(setup);
    const k = await puzzles['2x2x2'].kpuzzle();
    expect(k.defaultPattern().applyAlg(result.setup!).applyAlg(result.alg)
      .experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true })).toBe(true);
  });

  it('rejects empty source formulas', async () => {
    await expect(preserveAlg(setup, { alg: '' })).rejects.toThrow('Empty');
  });
});
