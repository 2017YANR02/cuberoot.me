/**
 * Thin wrappers around cubing.js for alg manipulation (invert / simplify / mirror).
 * Ported from packages/client-vite/src/utils/cube3.ts.
 */
import {
  Alg,
  Commutator,
  Conjugate,
  Grouping,
  Move,
  type AlgNode,
} from 'cubing/alg';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { mirrorFamily, mirrorKeepsAmount, type MirrorAxis } from '../alg_notation';
export { invertAlg } from '../alg_transform';

let _kpuzzle: Promise<KPuzzle> | null = null;

/** Lazy load the 3x3 KPuzzle definition. Cached after first call. */
export function getCube3(): Promise<KPuzzle> {
  if (!_kpuzzle) {
    _kpuzzle = import('cubing/puzzles').then((m) => m.cube3x3x3.kpuzzle());
  }
  return _kpuzzle;
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

function mirrorMove(move: Move, axis: MirrorAxis): Move {
  const family = mirrorFamily(move.family, axis);
  const amount = mirrorKeepsAmount(move.family, axis) ? move.amount : -move.amount;
  return move.modified({ family, amount });
}

function mirrorAlgTree(alg: Alg, axis: MirrorAxis): Alg {
  const nodes: AlgNode[] = [];
  for (const node of alg.childAlgNodes()) {
    if (node instanceof Move) {
      // Nothing legitimate produces amount 0, so omit it rather than stringifying
      // it as a quarter turn.
      if (node.amount !== 0) nodes.push(mirrorMove(node, axis));
    } else if (node instanceof Grouping) {
      nodes.push(new Grouping(mirrorAlgTree(node.alg, axis), node.amount));
    } else if (node instanceof Commutator) {
      nodes.push(new Commutator(mirrorAlgTree(node.A, axis), mirrorAlgTree(node.B, axis)));
    } else if (node instanceof Conjugate) {
      nodes.push(new Conjugate(mirrorAlgTree(node.A, axis), mirrorAlgTree(node.B, axis)));
    } else {
      // Pauses, comments, and newlines carry no move direction.
      nodes.push(node);
    }
  }
  return new Alg(nodes);
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
 * Mirror an alg through one of the three slice planes.
 *
 * The rule lives in `@cuberoot/shared/alg-notation` (which family each plane swaps,
 * and which slice/rotation is exempt from the sign flip). Parsing stays on cubing.js
 * so commutators `[R, U]` and repeat groups still work.
 */
export function mirrorAlg(alg: string, axis: MirrorAxis): string {
  if (!alg) return '';
  try {
    // Transform the parsed tree instead of flattening its leaf moves. Flattening
    // preserves the cube state but silently deletes grouping parentheses, repeat
    // counts, commutators, comments, and pauses from the user's text.
    return mirrorAlgTree(new Alg(alg), axis).toString();
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
