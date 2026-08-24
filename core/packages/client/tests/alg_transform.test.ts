import { describe, expect, it } from 'vitest';
import { invertAlg } from '@cuberoot/shared/alg-transform';

describe('invertAlg', () => {
  it('returns an empty string for empty input', () => {
    expect(invertAlg('')).toBe('');
  });

  it('returns an empty string for invalid input', () => {
    expect(invertAlg('R @ U')).toBe('');
  });

  it('inverts ordinary moves', () => {
    expect(invertAlg("R U R' U'")).toBe("U R U' R'");
  });

  it('preserves wide and layered move semantics', () => {
    expect(invertAlg("Rw U 3Rw2'")).toBe("3Rw2 U' Rw'");
  });

  it('preserves rotation semantics', () => {
    expect(invertAlg("x y' z2")).toBe("z2' y x'");
  });

  it('inverts commutators with cubing.js semantics', () => {
    expect(invertAlg('[R, U]')).toBe('[U, R]');
  });

  it('inverts conjugates with cubing.js semantics', () => {
    expect(invertAlg('[R: U]')).toBe("[R: U']");
  });
});
