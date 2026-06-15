// Shared cube algorithms for /why-cube interactive widgets.

export const HERO_SCRAMBLE = "L2 U2 R2 F2 D' B2 D2 R2 U' F2 U L' B' D2 R' F U L D2 F2";

function invertMove(m: string): string {
  if (m.endsWith("'")) return m.slice(0, -1);
  if (m.endsWith('2')) return m;
  return m + "'";
}

/** Invert an alg string: reverse move order and invert each move. */
export function invertAlg(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).reverse().map(invertMove).join(' ');
}

/** A solution for HERO_SCRAMBLE = its inverse (the cube unwinds to solved). */
export const HERO_SOLUTION = invertAlg(HERO_SCRAMBLE);

/* Famous patterns — setup algs played forward turn the solved cube into each
 * pattern. Kept here so the hero, the flow band and the pattern gallery share
 * one source. */
export const PATTERNS = [
  { key: 'checker',   setup: 'M2 E2 S2' },
  { key: 'spots',     setup: "U D' R L' F B' U D'" },
  { key: 'cube',      setup: "F L F U' R U F2 L2 U' L' B D' B' L2 U" },
  { key: 'pons',      setup: 'F2 B2 U2 D2 L2 R2' },
  { key: 'gift',      setup: "U B2 R2 B2 L2 F2 R2 D' F2 L2 B U2 F' U F' R2 U" },
  { key: 'superflip', setup: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" },
] as const;

export type PatternKey = (typeof PATTERNS)[number]['key'];
