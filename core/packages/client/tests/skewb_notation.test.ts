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

  it('Sarah ULF / URB map to the cubing.js UL / UR grips', () => {
    // Sarah L = ULF = cubing.js UL (UL ≡ y' F y, verified equal cube state)
    expect(translate('L')).toBe('UL');
    expect(translate("L'")).toBe("UL'");
    expect(translate('L2')).toBe('UL2');
    // Sarah R = URB = cubing.js UR (UR ≡ y F y')
    expect(translate('R')).toBe('UR');
    expect(translate("R'")).toBe("UR'");
  });

  it('Sarah suffix preservation on direct map', () => {
    expect(translate("F'")).toBe("F'");
    expect(translate('B2')).toBe('U2');
    expect(translate("r'")).toBe("R'");
    expect(translate('b2')).toBe('B2');
  });

  it('S/H macros expand and recurse (L → UL, rotation-free)', () => {
    // S = F' L F L' (Sarah) → F' UL F UL'
    expect(translate('S')).toBe("F' UL F UL'");
    // H = L F' L' F → UL F' UL' F
    expect(translate('H')).toBe("UL F' UL' F");
    // S' = inverse of sledgehammer = hedgeslammer
    expect(translate("S'")).toBe("UL F' UL' F");
    expect(translate("H'")).toBe("F' UL F UL'");
  });

  it('rotations pass through', () => {
    expect(translate('x')).toBe('x');
    expect(translate("y'")).toBe("y'");
    expect(translate('z2')).toBe('z2');
  });

  it('mixed Sarah alg from sarahs-advanced 1a', () => {
    // First alg of sarahs-advanced case 1a uses R/r/B/b/z/x/y
    const out = translate("y x R b' r' R' r z B' r B");
    // Sarah's R → UR; r → R; B → U; b → B
    expect(out).toBe("y x UR B' R' UR' R z U' R U");
  });

  it('S/H heavy alg from sarahs-advanced 1a (3rd entry)', () => {
    // H z S z' H z H — every move is a macro or rotation
    const out = translate("H z S z' H z H");
    expect(out).toBe("UL F' UL' F z F' UL F UL' z' UL F' UL' F z UL F' UL' F");
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
