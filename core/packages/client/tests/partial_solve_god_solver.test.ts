import { describe, expect, it } from 'vitest';
import { N_SYM, canonicalKey } from '@/app/[lang]/scramble/symmetry/_sym_core';
import type { CubieCube } from '@/app/[lang]/scramble/solver/_kociemba/cube';
import { familyById } from '@/lib/partial-solve-god';

/**
 * 部分还原两族的「等价类数」现场复算 —— 枚举全部 108,864 / 304,128 个状态,按 48 元空间对称
 * + 取逆(共 96 个操作)归并轨道,数出 1152 / 3272。这两个数就是 cuBerBruce 2011 年公布的类数,
 * 复算对上即说明:我们枚举的状态族与他的是同一个,`lib/partial-solve-god.ts` 里那两条
 * classCounts 因此可以直接引用。
 *
 * 归到 `*_solver.test.ts`(默认从 CI / `pnpm test` 排除):~110s,且是"证一次就成立"的确定性事实,
 * 只取决于 `_sym_core.ts` 与本文件的枚举。改了任一方跑
 * `pnpm -F @cuberoot/client test:solvers partial_solve`。
 */

const combos = (arr: number[], k: number): number[][] => (k === 0 ? [[]]
  : arr.flatMap((x, i) => combos(arr.slice(i + 1), k - 1).map((c) => [x, ...c])));

const permsOf = (a: number[]): number[][] => (a.length <= 1 ? [a]
  : a.flatMap((x, i) => permsOf([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));

/** slots 上的全部 5-循环,写成整条 nAll 长的置换(其余位置不动)。 */
function cyclesOn(slots: number[], nAll: number): number[][] {
  const out: number[][] = [];
  for (const order of permsOf(slots.slice(1))) {
    const cyc = [slots[0], ...order];
    const p = Array.from({ length: nAll }, (_, i) => i);
    for (let i = 0; i < cyc.length; i++) p[cyc[i]] = cyc[(i + 1) % cyc.length];
    out.push(p);
  }
  return out;
}

/** slots 上朝向和 ≡ 0 (mod base) 的全部朝向向量 —— 自由度 base^(k-1),最后一位由和定死。 */
function orisOn(slots: number[], nAll: number, base: number): number[][] {
  const out: number[][] = [];
  const k = slots.length;
  for (let n = 0; n < base ** (k - 1); n++) {
    const v = new Array<number>(nAll).fill(0);
    let x = n, s = 0;
    for (let i = 0; i < k - 1; i++) { const d = x % base; x = (x - d) / base; v[slots[i]] = d; s += d; }
    v[slots[k - 1]] = (base - (s % base)) % base;
    out.push(v);
  }
  return out;
}

const ID_C = [0, 1, 2, 3, 4, 5, 6, 7];
const ID_E = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const ZERO_C = [0, 0, 0, 0, 0, 0, 0, 0];
const ZERO_E = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function allStates(kind: 'corner' | 'edge'): CubieCube[] {
  const n = kind === 'corner' ? 8 : 12;
  const base = kind === 'corner' ? 3 : 2;
  const out: CubieCube[] = [];
  for (const slots of combos(Array.from({ length: n }, (_, i) => i), 5)) {
    for (const perm of cyclesOn(slots, n)) {
      for (const o of orisOn(slots, n, base)) {
        out.push(kind === 'corner'
          ? ({ cp: perm, co: o, ep: ID_E.slice(), eo: ZERO_E.slice() } as CubieCube)
          : ({ cp: ID_C.slice(), co: ZERO_C.slice(), ep: perm, eo: o } as CubieCube));
      }
    }
  }
  return out;
}

const ALL_SYMS = Array.from({ length: N_SYM }, (_, i) => i);

describe.each([
  ['corner', 'corner5'] as const,
  ['edge', 'edge5'] as const,
])('%s 5-循环', (kind, id) => {
  const f = familyById(id);

  it('状态数等于构造式给的数', () => {
    expect(allStates(kind).length).toBe(f.states);
  }, 300_000);

  it('48 元对称 + 取逆下的轨道数 = cuBerBruce 公布的等价类数', () => {
    const sizes = new Map<string, number>();
    for (const p of allStates(kind)) {
      const key = canonicalKey(p, ALL_SYMS, true);
      sizes.set(key, (sizes.get(key) ?? 0) + 1);
    }
    expect(sizes.size).toBe(f.classes);

    // 轨道大小只可能是 48 或 96 —— 「类平均 ≠ 真平均」全部根源在这一行
    const hist: Record<number, number> = {};
    let total = 0;
    for (const s of sizes.values()) { hist[s] = (hist[s] ?? 0) + 1; total += s; }
    expect(hist).toEqual(f.orbitSizes);
    expect(total).toBe(f.states);
  }, 300_000);
});
