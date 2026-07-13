/**
 * Thin wrappers around cubing.js for alg manipulation (invert / simplify / mirror).
 * Ported from packages/client-vite/src/utils/cube3.ts.
 */
import { Alg, Move } from 'cubing/alg';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';

let _kpuzzle: Promise<KPuzzle> | null = null;

/** Lazy load the 3x3 KPuzzle definition. Cached after first call. */
export function getCube3(): Promise<KPuzzle> {
  if (!_kpuzzle) {
    _kpuzzle = import('cubing/puzzles').then((m) => m.cube3x3x3.kpuzzle());
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

function leafMoves(a: Alg): Move[] {
  return [...a.experimentalLeafMoves()];
}

export function countMoves(alg: string): number {
  if (!alg) return 0;
  try {
    return leafMoves(new Alg(alg)).length;
  } catch {
    return 0;
  }
}

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

/**
 * Mirror an alg through one of the slice planes.
 *
 * A reflection is orientation-reversing, so EVERY move flips direction — slices
 * (M/S/E) and rotations (x/y/z) included. Only the two faces straddling the
 * plane trade names. Negating just the on-axis families (the pre-2026-07 bug)
 * silently produced non-algs: mirroring T-perm that way wrecked D + E.
 */
export function mirrorAlg(alg: string, axis: 'M' | 'S' | 'E'): string {
  if (!alg) return '';
  const pairs = ({
    M: [['R', 'L'], ['r', 'l'], ['Rw', 'Lw']],
    S: [['F', 'B'], ['f', 'b'], ['Fw', 'Bw']],
    E: [['U', 'D'], ['u', 'd'], ['Uw', 'Dw']],
  } as const)[axis];
  try {
    const out: string[] = [];
    for (const m of new Alg(alg).experimentalLeafMoves()) {
      let f: string = m.family;
      for (const [a, b] of pairs) {
        if (f === a) { f = b; break; }
        if (f === b) { f = a; break; }
      }
      out.push(new Move(f, -m.amount).toString());
    }
    return out.join(' ');
  } catch {
    return alg;
  }
}

/**
 * Cancel adjacent moves WITHOUT the mod-4 fold (so it stays correct on
 * non-cube puzzles whose axes aren't all order-4: pyraminx / skewb / megaminx).
 * Adjacent inverse moves annihilate; identical moves combine.
 */
export function simplifyTwistyAlg(alg: string): string {
  if (!alg) return '';
  try {
    return new Alg(alg).experimentalSimplify({ cancel: true }).toString();
  } catch {
    return alg;
  }
}

/** Cancel adjacent same-axis moves AND fold each amount mod 4. */
export function simplifyAlg(alg: string): string {
  if (!alg) return '';
  try {
    const simplified = new Alg(alg).experimentalSimplify({ cancel: true });
    const out: string[] = [];
    for (const m of simplified.experimentalLeafMoves()) {
      const wrapped = ((m.amount % 4) + 4) % 4;
      if (wrapped === 0) continue;
      const newAmount = wrapped === 3 ? -1 : wrapped;
      // modified() 保留宽层 / 层号(new Move(m.family, n) 会把 3r 退成 r)。
      const newMove = m.amount === newAmount ? m : m.modified({ amount: newAmount });
      out.push(newMove.toString());
    }
    return out.join(' ');
  } catch {
    return alg;
  }
}
