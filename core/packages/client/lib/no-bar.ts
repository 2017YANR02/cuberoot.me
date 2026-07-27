/**
 * 「没有棒」(no bar):一个三阶状态的**任意一面**上,没有两块同色贴纸挨在一起。
 *
 * 两档口径,页面上分开报:
 *   - 正交:上下左右相邻不同色(面内 12 对);
 *   - 正交 + 对角:再加上斜着挨着也不同色(面内再 8 对)。
 *
 * 跨面不用管:跨过一条棱贴在一起的两块贴纸必然属于同一个块(棱块 1 对、角块 3 对),
 * 而同一个块上的贴纸颜色天生互不相同,所以跨面那 36 对**恒不同色**,不构成额外约束。
 *
 * 稀有度自己采样,不抄:`sampleNoBar()` 用固定种子的 xorshift128 生成均匀随机合法态
 * (角/棱排列同奇偶、角朝向和 ≡ 0 mod 3、棱朝向和为偶),逐个数面内同色相邻。
 * 同一个种子跑出来的数逐位可复现,`tests/no_bar.test.ts` 锁着。
 */

import { cubieToFacelet } from '@/app/[lang]/scramble/solver/facelet';
import type { CubieCube } from '@/app/[lang]/scramble/solver/_kociemba/cube';

/** 面内正交相邻的 12 对下标(每面)。 */
export const FACE_ORTHO_PAIRS: readonly [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      if (c < 2) out.push([i, i + 1]);
      if (r < 2) out.push([i, i + 3]);
    }
  }
  return out;
})();

/** 面内对角相邻的 8 对下标(每面)。 */
export const FACE_DIAG_PAIRS: readonly [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      if (c < 2) out.push([i, i + 4]);
      if (c > 0) out.push([i, i + 2]);
    }
  }
  return out;
})();

export interface FaceContacts {
  /** 六个面上同色且正交相邻的对数。 */
  ortho: number;
  /** 六个面上同色且对角相邻的对数。 */
  diag: number;
}

/** 数一个 facelet 串(URFDLB,54 字符)里的同色相邻对数。 */
export function faceContacts(facelet: string): FaceContacts {
  let ortho = 0;
  let diag = 0;
  for (let f = 0; f < 6; f++) {
    const base = f * 9;
    for (const [a, b] of FACE_ORTHO_PAIRS) if (facelet[base + a] === facelet[base + b]) ortho++;
    for (const [a, b] of FACE_DIAG_PAIRS) if (facelet[base + a] === facelet[base + b]) diag++;
  }
  return { ortho, diag };
}

/** xorshift128:够均匀、够快,且同种子逐位可复现(Math.random 做不到)。 */
export function makeRng(seed: number): () => number {
  let x = seed | 0 || 1;
  let y = 362436069;
  let z = 521288629;
  let w = 88675123;
  return () => {
    const t = x ^ (x << 11);
    x = y; y = z; z = w;
    w = (w ^ (w >>> 19)) ^ (t ^ (t >>> 8));
    return (w >>> 0) / 4294967296;
  };
}

const parityOf = (p: number[]): number => {
  let swaps = 0;
  const a = [...p];
  for (let i = 0; i < a.length; i++) {
    while (a[i] !== i) { const j = a[i]; [a[i], a[j]] = [a[j], a[i]]; swaps++; }
  }
  return swaps & 1;
};

function shuffle(n: number, rnd: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 均匀随机合法态(4.3 × 10¹⁹ 个里等概率取一个)。 */
export function randomCubie(rnd: () => number): CubieCube {
  const cp = shuffle(8, rnd);
  const ep = shuffle(12, rnd);
  if (parityOf(cp) !== parityOf(ep)) { const t = ep[0]; ep[0] = ep[1]; ep[1] = t; }
  const co = new Array<number>(8);
  let cs = 0;
  for (let i = 0; i < 7; i++) { co[i] = Math.floor(rnd() * 3); cs += co[i]; }
  co[7] = (3 - (cs % 3)) % 3;
  const eo = new Array<number>(12);
  let es = 0;
  for (let i = 0; i < 11; i++) { eo[i] = rnd() < 0.5 ? 0 : 1; es += eo[i]; }
  eo[11] = es & 1;
  return { cp, co, ep, eo };
}

export interface NoBarSample {
  n: number;
  /** 六面都没有正交同色相邻的个数。 */
  noOrtho: number;
  /** 正交与对角都没有的个数。 */
  noContact: number;
}

/** 采样 n 个均匀随机态,数「没有棒」的个数。同种子结果逐位可复现。 */
export function sampleNoBar(n: number, seed: number): NoBarSample {
  const rnd = makeRng(seed);
  let noOrtho = 0;
  let noContact = 0;
  for (let i = 0; i < n; i++) {
    const c = faceContacts(cubieToFacelet(randomCubie(rnd)));
    if (c.ortho === 0) { noOrtho++; if (c.diag === 0) noContact++; }
  }
  return { n, noOrtho, noContact };
}
