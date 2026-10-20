import { describe, expect, it } from 'vitest';
import { cube3x3x3 } from 'cubing/puzzles';
import { toMoveString } from '@cuberoot/shared/alg-notation';
import { invertAlg } from '@cuberoot/shared/alg-transform';

describe('invertAlg', () => {
  it.each([
    ["FS' R U' R' S U' F'", "F U S' R U R' S F'"],
    ['FS', "S' F'"], ['UD', "D' U'"], ['MR', "R' M'"],
    ['ML', "L' M'"], ['UE', "E' U'"],
    ["F2S'", "S F2'"],
  ])('inverts compact moves %s without inventing a move family', async (alg, expected) => {
    expect(invertAlg(alg)).toBe(expected);
    const solved = (await cube3x3x3.kpuzzle()).defaultPattern();
    expect(solved.applyAlg(expected).applyAlg(toMoveString(alg)).isIdentical(solved)).toBe(true);
  });

  it('preserves group and commutator structure with compact moves', () => {
    expect(invertAlg('(FS)2')).toBe("(F S)2'");
    expect(invertAlg('[FS, UE]')).toBe('[U E, F S]');
  });

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
