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
import { Alg, Move } from 'cubing/alg';
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

/**
 * Mirror an alg through one of the slice planes.
 *  - axis 'M': swap R↔L, r↔l, and invert M/x amounts (R becomes L', etc.)
 *  - axis 'S': swap F↔B, f↔b, and invert S/z amounts
 *  - axis 'E': swap U↔D, u↔d, and invert E/y amounts
 * Moves on the swap axis itself get their amount sign flipped.
 * Other families pass through unchanged.
 */
export function mirrorAlg(alg: string, axis: 'M' | 'S' | 'E'): string {
  if (!alg) return '';
  const swap = ({ M: ['R', 'L'], S: ['F', 'B'], E: ['U', 'D'] } as const)[axis];
  const wideSwap = ({ M: ['r', 'l'], S: ['f', 'b'], E: ['u', 'd'] } as const)[axis];
  const wideSwapW = ({ M: ['Rw', 'Lw'], S: ['Fw', 'Bw'], E: ['Uw', 'Dw'] } as const)[axis];
  const flipAxis = ({ M: 'x', S: 'z', E: 'y' } as const)[axis];
  try {
    const out: string[] = [];
    for (const m of new Alg(alg).experimentalLeafMoves()) {
      let f = m.family;
      let amount = m.amount;
      if (f === swap[0]) f = swap[1];
      else if (f === swap[1]) f = swap[0];
      else if (f === wideSwap[0]) f = wideSwap[1];
      else if (f === wideSwap[1]) f = wideSwap[0];
      else if (f === wideSwapW[0]) f = wideSwapW[1];
      else if (f === wideSwapW[1]) f = wideSwapW[0];
      // For swapped families and the slice/rotation on the same axis: flip sign
      if ([...swap, ...wideSwap, ...wideSwapW, axis, flipAxis].includes(f as never)
          || [...swap, ...wideSwap, ...wideSwapW, axis, flipAxis].includes(m.family as never)) {
        amount = -amount;
      }
      out.push(new Move(f, amount).toString());
    }
    return out.join(' ');
  } catch {
    return alg;
  }
}

/** Cancel adjacent same-axis moves (e.g. "U' U" → "", "U' U2" → "U") AND
 *  fold each move's amount modulo 4 (`U3` → `U'`, `U4` → drop, `U5` → `U`).
 *  cubing.js's experimentalSimplify cancels but leaves U-axis amounts > 2
 *  alone, so we post-process to canonicalise. */
export function simplifyAlg(alg: string): string {
  if (!alg) return '';
  try {
    const simplified = new Alg(alg).experimentalSimplify({ cancel: true });
    const out: string[] = [];
    for (const m of simplified.experimentalLeafMoves()) {
      const wrapped = ((m.amount % 4) + 4) % 4;
      if (wrapped === 0) continue;
      // Map 3 → -1 so cubing.js stringifies as `X'` rather than `X3`.
      const newAmount = wrapped === 3 ? -1 : wrapped;
      const newMove = m.amount === newAmount ? m : new Move(m.family, newAmount);
      out.push(newMove.toString());
    }
    return out.join(' ');
  } catch {
    return alg;
  }
}
