/**
 * Translator from Sarah / Algorithm-notation skewb to cubing.js WCA notation.
 *
 * These cases are calibrated against cubing.js's skewb engine via playwright
 * probe of `experimentalModel.alg.get()` (see chat transcript). The expected
 * outputs are the verbatim conjugate/macro expansions that drive the
 * TwistyPlayer to the correct cube state for the user-typed Sarah alg.
 */
import { describe, it, expect } from 'vitest';
import { toWca, translate } from '@cuberoot/shared/skewb-notation';

describe('skewb notation translator', () => {
  it('passes through WCA notation unchanged', () => {
    expect(toWca('R U L B', 'wca')).toBe('R U L B');
    expect(toWca("R' U2 L B'", 'wca')).toBe("R' U2 L B'");
  });

  it('Sarah direct mapping (axes that exist in WCA notation mapper)', () => {
    // Sarah F = UFR = cubing.js F
    expect(translate('F')).toBe('F');
    // Sarah B = ULB = cubing.js U
    expect(translate('B')).toBe('U');
    // Lowercase bottom corners map straight to WCA letters
    expect(translate('r')).toBe('R');
    expect(translate('l')).toBe('L');
    expect(translate('b')).toBe('B');
    expect(translate('d')).toBe('D');
    expect(translate('f')).toBe('D');
  });

  it('Sarah conjugates for ULF / URB (no direct WCA letter)', () => {
    // Sarah L = ULF axis → y' F y
    expect(translate('L')).toBe("y' F y");
    expect(translate("L'")).toBe("y' F' y");
    expect(translate('L2')).toBe("y' F2 y");
    // Sarah R = URB axis → y F y'
    expect(translate('R')).toBe("y F y'");
    expect(translate("R'")).toBe("y F' y'");
  });

  it('Sarah suffix preservation on direct map', () => {
    expect(translate("F'")).toBe("F'");
    expect(translate('B2')).toBe('U2');
    expect(translate("r'")).toBe("R'");
    expect(translate('b2')).toBe('B2');
  });

  it('S/H macros expand and recurse', () => {
    // S = F' L F L' (Sarah) → F' (y' F y) F (y' F y)' = F' y' F y F y' F' y
    expect(translate('S')).toBe("F' y' F y F y' F' y");
    // H = L F' L' F
    expect(translate('H')).toBe("y' F y F' y' F' y F");
    // S' = inverse of sledgehammer = hedgeslammer
    expect(translate("S'")).toBe("y' F y F' y' F' y F");
    expect(translate("H'")).toBe("F' y' F y F y' F' y");
  });

  it('rotations pass through', () => {
    expect(translate('x')).toBe('x');
    expect(translate("y'")).toBe("y'");
    expect(translate('z2')).toBe('z2');
  });

  it('mixed Sarah alg from sarahs-advanced 1a', () => {
    // First alg of sarahs-advanced case 1a uses R/r/B/b/z/x/y
    const out = translate("y x R b' r' R' r z B' r B");
    // Sarah's R → y F y'; r → R; B → U; b → B
    expect(out).toBe("y x y F y' B' R' y F' y' R z U' R U");
  });

  it('S/H heavy alg from sarahs-advanced 1a (3rd entry)', () => {
    // H z S z' H z H — every move is a macro or rotation
    const out = translate("H z S z' H z H");
    expect(out).toBe("y' F y F' y' F' y F z F' y' F y F y' F' y z' y' F y F' y' F' y F z y' F y F' y' F' y F");
  });

  it('unknown tokens pass through', () => {
    expect(translate('@@')).toBe('@@');
    // 'u' is not in Sarah notation (top-back is B, not u) — passes through as unknown.
    expect(translate('u')).toBe('u');
  });

  it('empty / whitespace', () => {
    expect(translate('')).toBe('');
    expect(translate('   ')).toBe('');
    expect(toWca('', 'sarah')).toBe('');
  });
});
