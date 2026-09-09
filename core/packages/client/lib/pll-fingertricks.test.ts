// Regression fixtures for the shared shorthand move parser.
import { describe, it, expect } from 'vitest';
import { tokenizeAlg, parseMove } from './pll-fingertricks';

// Stored PLL notation snapshot, 2026-07-13.
const PLL_MAIN_ALGS: Record<string, string> = {
  Aa: "x R' U R' D2 R U' R' D2 R2 x'",
  Ab: "x R2 D2 R U R' D2 R U' R x'",
  E: "U x' R U' R' D R U R' D' R U R' D R U' R' D' x U'",
  F: "U R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R U'",
  Ga: "R2 U R' U R' U' R U' R2 D U' R' U R D'",
  Gb: "D R' U' R U D' R2 U R' U R U' R U' R2",
  Gc: "U2 R2 F2 R U2 R U2 R' F R U R' U' R' F R2 U'",
  Gd: "R U R' U' D R2 U' R U' R' U R' U R2 D'",
  H: "M2 U' M2 U2 M2 U' M2",
  Ja: "U2 x R2 F R F' R U2 r' U r U2 x' U'",
  Jb: "R U R' F' R U R' U' R' F R2 U' R'",
  Na: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
  Nb: "R' U R U' R' F' U' F R U R' F R' F' R U' R",
  Ra: "U R U' R' U' R U R D R' U' R D' R' U2 R' U'",
  Rb: "R' U2 R U2 R' F R U R' U' R' F' R2",
  T: "R U R' U' R' F R2 U' R' U' R U R' F'",
  Ua: "U2 M2 U M U2 M' U M2 U2",
  Ub: "U2 M2 U' M U2 M' U' M2 U2",
  V: "R' U R' U' R D' R' D R' U D' R2 U' R2 D R2",
  Y: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  Z: "M' U' M2 U' M2 U' M' U2 M2 U'",
};

describe('tokenizer + family classifier', () => {
  it('strips finger-trick decorators · ↑ ↓ ← →', () => {
    expect(tokenizeAlg("R· U↑ R'↓ ←U' →F")).toEqual(["R", 'U', "R'", "U'", 'F']);
  });

  it('strips grouping brackets ( ) [ ]', () => {
    expect(tokenizeAlg("R U [R' U'] (R U R')")).toEqual(['R', 'U', "R'", "U'", 'R', 'U', "R'"]);
  });

  it('parses prime, double, wide, rotation correctly', () => {
    expect(parseMove("R'")).toMatchObject({ family: 'R', reverse: true, times: 1, wide: false });
    expect(parseMove('R2')).toMatchObject({ family: 'R', reverse: false, times: 2 });
    expect(parseMove('Rw')).toMatchObject({ family: 'wide', wide: true, base: 'R' });
    expect(parseMove('r')).toMatchObject({ family: 'wide', wide: true, base: 'R' });
    expect(parseMove("r'")).toMatchObject({ family: 'wide', wide: true, reverse: true });
    expect(parseMove("x'")).toMatchObject({ family: 'x', reverse: true });
    expect(parseMove('y2')).toMatchObject({ family: 'y', times: 2 });
    expect(parseMove('M2')).toMatchObject({ family: 'M', times: 2 });
    expect(parseMove("M'")).toMatchObject({ family: 'M', reverse: true });
    expect(parseMove('D2')).toMatchObject({ family: 'D', times: 2 });
    expect(parseMove("U2")).toMatchObject({ family: 'U', times: 2 });
  });

  it('returns null for garbage tokens', () => {
    expect(parseMove('')).toBeNull();
    expect(parseMove('hello')).toBeNull();
  });
});

describe('stored PLL notation fixtures', () => {
  for (const [name, alg] of Object.entries(PLL_MAIN_ALGS)) {
    it(name, () => {
      const tokens = tokenizeAlg(alg);
      expect(tokens.length).toBeGreaterThan(0);
      for (const token of tokens) {
        expect(parseMove(token), token).not.toBeNull();
      }
    });
  }
});
