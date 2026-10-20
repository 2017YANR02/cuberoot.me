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
import { mirrorFamily, mirrorKeepsAmount, ROTATE_Y, type MirrorAxis } from '../alg_notation';
export { invertAlg } from '../alg_transform';
import { parseCubeAlg } from '../alg_transform';

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

function mapAlgMoves(alg: Alg, transform: (move: Move) => Move): Alg {
  const nodes: AlgNode[] = [];
  for (const node of alg.childAlgNodes()) {
    if (node instanceof Move) {
      // Nothing legitimate produces amount 0, so omit it rather than stringifying
      // it as a quarter turn.
      if (node.amount !== 0) nodes.push(transform(node));
    } else if (node instanceof Grouping) {
      nodes.push(new Grouping(mapAlgMoves(node.alg, transform), node.amount));
    } else if (node instanceof Commutator) {
      nodes.push(new Commutator(mapAlgMoves(node.A, transform), mapAlgMoves(node.B, transform)));
    } else if (node instanceof Conjugate) {
      nodes.push(new Conjugate(mapAlgMoves(node.A, transform), mapAlgMoves(node.B, transform)));
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
    return mapAlgMoves(new Alg(alg), move => mirrorMove(move, axis)).toString();
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

/** Relabel in a rotated frame (rotation^-1 · alg · rotation), preserving the syntax tree. */
export function rotateAlg(alg: string, axis: 'x' | 'y' | 'z', turns = 1): string {
  const maps: Record<'x' | 'z', Record<string, readonly [string, number]>> = {
    x: { U: ['B', 1], B: ['D', 1], D: ['F', 1], F: ['U', 1], R: ['R', 1], L: ['L', 1],
      M: ['M', 1], E: ['S', 1], S: ['E', -1], x: ['x', 1], y: ['z', -1], z: ['y', 1] },
    z: { U: ['R', 1], R: ['D', 1], D: ['L', 1], L: ['U', 1], F: ['F', 1], B: ['B', 1],
      M: ['E', -1], E: ['M', 1], S: ['S', 1], x: ['y', -1], y: ['x', 1], z: ['z', 1] },
  };
  const count = ((turns % 4) + 4) % 4;
  return mapAlgMoves(parseCubeAlg(alg), move => {
    let family = move.family, amount = move.amount;
    for (let i = 0; i < count; i++) {
      const lower = /^[rludfbmse]$/.test(family);
      const wide = /^[RLUDFB]w$/.test(family);
      const base = lower ? family.toUpperCase() : wide ? family[0] : family;
      const hit = axis === 'y' ? ROTATE_Y[base] : maps[axis][base];
      if (!hit) throw new Error('Unsupported cube move: ' + family);
      family = lower ? hit[0].toLowerCase() : wide ? hit[0] + 'w' : hit[0];
      amount *= hit[1];
    }
    return move.modified({ family, amount: amount === -2 ? 2 : amount });
  }).toString();
}
