/**
 * Thin wrappers around cubing.js for the recon autofill / algdb features.
 *
 * Replaces the old hand-rolled cube3_sim.ts. All real cube simulation goes
 * through cubing.js KPuzzle/KPattern; this file just sugarcoats the imports
 * and the small handful of helpers we use repeatedly.
 *
 * Lazy-loaded: the 3x3 KPuzzle definition (~20 KB) is fetched on first use.
 * Both `getCube3` and downstream consumers should `await`.
 */
import { Alg, type Move } from 'cubing/alg';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';

let _kpuzzle: Promise<KPuzzle> | null = null;

/** Lazy load the 3x3 KPuzzle definition. Cached after first call. */
export function getCube3(): Promise<KPuzzle> {
  if (!_kpuzzle) {
    _kpuzzle = import('cubing/puzzles').then(m => m.cube3x3x3.kpuzzle());
  }
  return _kpuzzle;
}

/** "R U R' U'" → "U R U' R'". Handles wide / slice / rotation correctly. */
export function invertAlg(alg: string): string {
  if (!alg) return '';
  try {
    return new Alg(alg).invert().toString();
  } catch {
    return '';
  }
}

/** Apply alg to solved cube → KPattern. Handles parsing errors gracefully. */
export async function patternFromAlg(alg: string): Promise<KPattern> {
  const kp = await getCube3();
  if (!alg) return kp.defaultPattern();
  try {
    return kp.defaultPattern().applyAlg(alg);
  } catch {
    return kp.defaultPattern();
  }
}

/**
 * Is `needle` a token-prefix of `haystack`? Case-sensitive Move comparison via
 * cubing.js Move.isIdentical (so `R` ≠ `R'`, `U` ≠ `U2`, etc.).
 *
 * Used to filter alg-suggestion popup by what the user has already typed on
 * the current line (cubedb prefix-matching behaviour).
 */
export function isAlgPrefix(needle: string, haystack: string): boolean {
  if (!needle.trim()) return true;
  try {
    const ns = leafMoves(new Alg(needle));
    if (ns.length === 0) return true;
    const hs = leafMoves(new Alg(haystack));
    if (ns.length > hs.length) return false;
    for (let i = 0; i < ns.length; i++) {
      if (!ns[i].isIdentical(hs[i])) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Iterate Move tokens from an Alg (skipping comments / grouping markers). */
function leafMoves(a: Alg): Move[] {
  return [...a.experimentalLeafMoves()];
}

/** Number of move tokens in an alg (rotations + slices + wides each = 1). */
export function countMoves(alg: string): number {
  if (!alg) return 0;
  try {
    return leafMoves(new Alg(alg)).length;
  } catch {
    return 0;
  }
}
