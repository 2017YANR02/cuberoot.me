/**
 * Thin wrappers around cubing.js for alg manipulation (invert / simplify / mirror).
 * Ported from packages/client-vite/src/utils/cube3.ts.
 */
import { Alg, Move } from 'cubing/alg';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { ROTATE_Y, mirrorFamily, mirrorKeepsAmount, type MirrorAxis } from '@cuberoot/shared/alg-notation';

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
 * Mirror an alg through one of the three slice planes.
 *
 * The rule lives in `@cuberoot/shared/alg-notation` (which family each plane swaps,
 * and which slice/rotation is exempt from the sign flip). Parsing stays on cubing.js
 * so commutators `[R, U]` and repeat groups still work.
 */
export function mirrorAlg(alg: string, axis: MirrorAxis): string {
  if (!alg) return '';
  try {
    const out: string[] = [];
    for (const m of new Alg(alg).experimentalLeafMoves()) {
      const family = mirrorFamily(m.family, axis);
      const amount = mirrorKeepsAmount(m.family, axis) ? m.amount : -m.amount;
      // `new Move(f, 0)` stringifies back to "R" — a real quarter turn. Nothing
      // legitimate produces amount 0, so drop it rather than invent a move.
      if (amount === 0) continue;
      // `.modified()` keeps the layer prefix. `new Move(family, amount)` throws it
      // away, which silently rewrote `2R` as `L'` and `3Rw` as `Lw'` — /sim's mirror
      // buttons are live on 4x4 and 5x5.
      out.push(m.modified({ family, amount }).toString());
    }
    return out.join(' ');
  } catch {
    return alg;
  }
}

/**
 * 把公式按 `y^k` **重贴面标**:`pattern(relabelY(A, k)) === pattern(y^-k · A · y^k)`。
 *
 * 与 {@link mirrorAlg} 成对 —— 一个翻手性,一个只转朝向。规则同样只有 shared 那一份
 * (`ROTATE_Y`,含小写内层切 `m`/`s`/`e`)。
 *
 * 注意它**不加任何前缀** —— 要的是「同一个动作换个朝向描述」,不是「先转体再做」。
 * 要带可见 `y` 前缀的那种,用 `lib/rotate-solution.ts` 的 `rotateSolutionY`。
 */
export function relabelY(alg: string, k: number): string {
  const n = ((Math.trunc(k) % 4) + 4) % 4;
  if (!alg || n === 0) return alg;
  try {
    const out: string[] = [];
    for (const move of new Alg(alg).experimentalLeafMoves()) {
      let family = move.family;
      let amount = move.amount;
      for (let i = 0; i < n; i++) {
        const hit = ROTATE_Y[family];
        // 表里没有 = 出现了没见过的 family,原样放过比悄悄改掉安全
        if (!hit) break;
        family = hit[0];
        amount = hit[1] === -1 ? -amount : amount;
      }
      // `.modified()` 保留层前缀(`2R` / `3Rw`);`new Move(f, a)` 会把它扔掉
      out.push(move.modified({ family, amount }).toString());
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
