/**
 * 中层切 `M` vs `m` —— **大小写是两个招式**,不是同一个的两种写法。
 *
 *   `M` = 正中间那**一片**层。只有奇数阶才有。
 *   `m` = `R L' x'` = **全部内层**一起转。
 *
 * 3x3 只有一片内层,两者恰好相等(但 cubing.js 只收大写);4x4 没有正中间的层,只有 `m`;
 * 5x5 两个都合法却**不等价**(一片 vs 三片)—— 所以谁也别想把它俩当同义词互换,
 * 换了不报错,只会把公式悄悄变成另一个变换。
 *
 * 这里钉两件事:
 *   1. 引擎在各阶上到底收哪个(下面全是实测,不是背的);
 *   2. 全站那张记号表(shared 的 MOVE_RE)**认得小写 m/e/s** —— 以前不认,任何人在公式里
 *      敲一个 `m`,`toMoveString` 就当场报「认不出来的记号」,好公式被判成语法错。
 *      4x4 oll-parity 的「M」case 就是踩了这个坑(它其实是 Basic 被内层切共轭)。
 */
import { describe, it, expect } from 'vitest';
import { Alg } from 'cubing/alg';
import { puzzles, cube3x3x3 } from 'cubing/puzzles';
import { toMoveString, tokenizeMoves } from '@cuberoot/shared/alg-notation';
import { normalizeAlg } from '@/lib/alg_normalize';
import { validateAlgCase } from '@/lib/alg_validation';
import type { AlgSticker } from '@cuberoot/shared';

const kp3 = await cube3x3x3.kpuzzle();
const kp4 = await puzzles['4x4x4'].kpuzzle();
const kp5 = await puzzles['5x5x5'].kpuzzle();
type KP = typeof kp3;

/** 引擎真吃得下才算数 */
const accepts = (kp: KP, a: string): boolean => {
  try { kp.defaultPattern().applyAlg(new Alg(a)); return true; } catch { return false; }
};
/** 同一个变换? 比状态,不比字面 */
const sameMove = (kp: KP, a: string, b: string): boolean =>
  kp.defaultPattern().applyAlg(new Alg(a)).isIdentical(kp.defaultPattern().applyAlg(new Alg(b)));

describe('引擎收哪个:M 要有正中层,m 要有内层', () => {
  it('3x3 收 M,不收 m —— 但数学上它俩相等(只有一片内层)', () => {
    expect(accepts(kp3, 'M')).toBe(true);
    expect(accepts(kp3, 'm')).toBe(false);
    expect(sameMove(kp3, 'M', "R L' x'")).toBe(true);   // M == R L' x' == m 的定义
  });

  it('4x4 收 m,不收 M —— 偶数阶根本没有正中间那片层', () => {
    expect(accepts(kp4, 'M')).toBe(false);   // Bad grip in move M
    expect(accepts(kp4, 'm')).toBe(true);
    expect(sameMove(kp4, 'm', "R L' x'")).toBe(true);
    expect(sameMove(kp4, 'e', "U D' y'")).toBe(true);
    expect(sameMove(kp4, 's', "F' B z")).toBe(true);
  });

  it('5x5 两个都收,但**不是同一个招式** —— 一片中层 vs 全部三片内层', () => {
    expect(accepts(kp5, 'M')).toBe(true);
    expect(accepts(kp5, 'm')).toBe(true);
    expect(sameMove(kp5, 'm', "R L' x'")).toBe(true);
    expect(sameMove(kp5, 'm', 'M')).toBe(false);   // ← 谁也别想把大小写互换
  });
});

describe('记号表认得小写 m/e/s(以前当 junk 丢,好公式被判语法错)', () => {
  it('tokenize 认得,且归类成 slice', () => {
    const { moves, junk } = tokenizeMoves("m U2 m'");
    expect(junk).toEqual([]);
    expect(moves.map(x => x.family)).toEqual(['m', 'U', 'm']);
    expect(moves.map(x => x.kind)).toEqual(['slice', 'face', 'slice']);
  });

  it('toMoveString 不再抛,后缀原样带着', () => {
    expect(toMoveString("m U2 m'")).toBe("m U2 m'");
    expect(toMoveString("m2' e s'")).toBe("m2' e s'");
  });

  it('normalizeAlg 不做大小写翻译 —— 原样交给引擎判', () => {
    expect(normalizeAlg('4x4', "m Rw U2 m'")).toBe("m Rw U2 m'");
    expect(normalizeAlg('5x5', 'M')).toBe('M');
    expect(normalizeAlg('5x5', 'm')).toBe('m');
    expect(normalizeAlg('3x3', 'M2 U M2 U2 M2 U M2')).toBe('M2 U M2 U2 M2 U M2');
  });

  it('连写照样切得开(`mR` 是 m + R,不是一个叫 mR 的招式)', () => {
    expect(toMoveString('mR')).toBe('m R');
  });
});

describe("4x4 oll-parity 的「M」case —— 写成小写 m 之后就该全过", () => {
  // stats: alg_cases,4x4/oll-parity「M」(2026-07-14)。它就是 Basic 被内层切共轭:m · Basic · m'
  const STICKER: AlgSticker = {
    kind: 'face',
    ub: 'byybbbbbbbbbbbbb', uf: 'yggygggggggggggg',
    ul: 'rooorrrrrrrrrrrr', ur: 'rrrooooooooooooo',
    us: 'ybbyyyyyyyyygyyg',
  };
  const ALGS = [
    "m Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw' m'",
    "y2 2R2 U2 2R2 Uw2 2R2 Uw2 Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'",
    "m Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2 m'",
    "m Rw' U2' Rw U2 Rw U2' Rw2' F2 Rw' U2 Rw' U2' F2 Rw2 F2 m'",
  ];
  // Basic 的 setup 被内层切共轭 —— 判据不自证:它由 Basic(另一个 case)推来,与这四条无关
  const SETUP = "m Rw U2' Rw U2' Rw' U2' Rw U2' Lw' U2' Rw U2' Rw' U2' Rw' x' U2' Rw' m'";

  it('四条公式全部通过校验', async () => {
    for (const alg of ALGS) {
      const r = await validateAlgCase(SETUP, alg, STICKER, '4x4', 'oll-parity');
      expect(r.ok, `"${alg}" — ${r.reason}`).toBe(true);
    }
  });

  it('反向对照:校验器没在盖橡皮图章 —— 故意写坏的必须挂', async () => {
    // 少收尾那一步,魔方就回不去。这条要是也「通过」,说明上面全是空转。
    const broken = ALGS[0].replace(" m'", '');
    const r = await validateAlgCase(SETUP, broken, STICKER, '4x4', 'oll-parity');
    expect(r.ok).toBe(false);
  });

  it('写成大写 M 就是坏的 —— 引擎不认,库里别再写', async () => {
    const upper = ALGS[0].replace(/\bm\b/g, 'M').replace(/\bm'/g, "M'");
    const r = await validateAlgCase(SETUP, upper, STICKER, '4x4', 'oll-parity');
    expect(r.ok).toBe(false);
  });
});
