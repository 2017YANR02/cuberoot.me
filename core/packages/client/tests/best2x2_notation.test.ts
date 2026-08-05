import { describe, expect, it } from 'vitest';
import { expandAlg, sanitizeAlg, SheetNotationError } from '../scripts/best2x2/notation.mts';

describe('Best 2x2 Algs notation branches', () => {
  it('expands parenthesized AUF choices', () => {
    const got = expandAlg("(U/U') (R' F R F')2");
    expect(got.map((x) => x.alg)).toEqual([
      "U R' F R F' R' F R F'",
      "U' R' F R F' R' F R F'",
    ]);
    expect(got.every((x) => x.eitherAuf && x.variants === 2)).toBe(true);
  });

  it('expands an inline move choice without losing the suffix', () => {
    const got = expandAlg('R U F2/D R2');
    expect(got.map((x) => x.alg)).toEqual(['R U F2 R2', 'R U D R2']);
    expect(got.map((x) => x.choices)).toEqual([['F2'], ['D']]);
  });

  it('keeps the quote on a numbered choice arm', () => {
    const got = expandAlg("R2 F2 R/R3' U'");
    expect(got.map((x) => x.alg)).toEqual(["R2 F2 R U'", "R2 F2 R3' U'"]);
    expect(got.map((x) => x.choices)).toEqual([['R'], ["R3'"]]);
  });

  it('normalizes quote variants and keeps a single formula unchanged', () => {
    expect(sanitizeAlg("R U2’ R'.").alg).toBe("R U2' R'");
  });

  it('forces branching callers to use expandAlg', () => {
    expect(() => sanitizeAlg('R U B/F')).toThrow(SheetNotationError);
  });

  it('rejects unknown notation', () => {
    expect(() => expandAlg('R nope U')).toThrow(SheetNotationError);
  });
});
