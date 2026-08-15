import { describe, expect, it } from 'vitest';
import { startsWithYRotation } from '@cuberoot/shared/alg-notation';
import { prepareTopLayerSuggestion } from '@/lib/recon_autofill_core';

describe('recon top-layer suggestions', () => {
  it.each([
    ['y', "R U R'", "U R U R' U'"],
    ['y2', "R U R'", "U2 R U R' U2"],
    ["y'", "R U R'", "U' R U R' U"],
  ])('turns a %s frame prefix into AUF', (rotation, alg, expected) => {
    const suggestion = prepareTopLayerSuggestion(rotation, alg);
    expect(suggestion).toBe(expected);
    expect(startsWithYRotation(suggestion)).toBe(false);
  });

  it('also normalizes a y-led formula returned directly by ZBLL lookup', () => {
    const suggestion = prepareTopLayerSuggestion('', "y R U R'");
    expect(suggestion).toBe("U R U R' U'");
    expect(startsWithYRotation(suggestion)).toBe(false);
  });
});
