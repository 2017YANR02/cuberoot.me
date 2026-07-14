/**
 * 4x4 的 M/E/S —— 偶数阶**没有中层**,cubing.js 的 4x4 引擎里根本没有这几个 grip
 * (喂进去当场 `Bad grip in move M`)。而 4x4 的公式作者照写 `M`,指的是「两个内层一起转」,
 * 也就是 SiGN 的 `2-3Lw`。
 *
 * 不修的后果不是报错,是**误判**:oll-parity 的「M」case = Basic 被 M 共轭了一下
 * (`M · Basic · M'`),三条好公式全被校验器判成「没还原」,卡片挂红框。
 * 数据是对的,记号没翻译 —— 跟当年那 611 条「语法错」同一个坑(见 lib/alg_normalize.ts 头注)。
 *
 * 判据不是自证:M case 的 4 条公式里有 1 条不含 M(`y2 2R2 U2 …`),引擎本来就认。
 * 拿它反推 setup,再去验另外三条 —— 换 M 之前全挂,换之后全过。
 */
import { describe, it, expect } from 'vitest';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import { normalizeAlg } from '@/lib/alg_normalize';
import { validateAlgCase } from '@/lib/alg_validation';
import type { AlgSticker } from '@cuberoot/shared';

const kpuzzle4 = await puzzles['4x4x4'].kpuzzle();
const kpuzzle5 = await puzzles['5x5x5'].kpuzzle();
/** 引擎真吃得下才算数 —— 抛 = 校验器会把好公式判成坏的 */
const applies = (kp: typeof kpuzzle4, s: string): boolean => {
  try { kp.defaultPattern().applyAlg(new Alg(s)); return true; } catch { return false; }
};

// stats: alg_cases 里 4x4/oll-parity 的「M」case(2026-07-14)
const M_CASE_STICKER: AlgSticker = {
  kind: 'face',
  ub: 'byybbbbbbbbbbbbb', uf: 'yggygggggggggggg',
  ul: 'rooorrrrrrrrrrrr', ur: 'rrrooooooooooooo',
  us: 'ybbyyyyyyyyygyyg',
};
const M_CASE_ALGS = [
  "M Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw' M'",
  // 唯一不含 M 的一条 —— 判据就靠它
  "y2 2R2 U2 2R2 Uw2 2R2 Uw2 Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'",
  "M Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2 M'",
  "M Rw' U2' Rw U2 Rw U2' Rw2' F2 Rw' U2 Rw' U2' F2 Rw2 F2 M'",
];
const M_FREE_ALG = M_CASE_ALGS[1];

describe('4x4 M/E/S → 内层双切', () => {
  it('引擎本来就不认 4x4 的 M/E/S(这就是要翻译的理由)', () => {
    expect(applies(kpuzzle4, 'M')).toBe(false);
    expect(applies(kpuzzle4, 'E')).toBe(false);
    expect(applies(kpuzzle4, 'S')).toBe(false);
  });

  it('翻成 2-3Lw / 2-3Dw / 2-3Fw,引擎就认了', () => {
    expect(normalizeAlg('4x4', 'M')).toBe('2-3Lw');
    expect(normalizeAlg('4x4', 'E')).toBe('2-3Dw');
    expect(normalizeAlg('4x4', 'S')).toBe('2-3Fw');
    for (const s of ['2-3Lw', '2-3Dw', '2-3Fw']) expect(applies(kpuzzle4, s)).toBe(true);
  });

  it('后缀跟着走(M2 / M\' / M2\')', () => {
    expect(normalizeAlg('4x4', "M'")).toBe("2-3Lw'");
    expect(normalizeAlg('4x4', 'M2')).toBe('2-3Lw2');
    expect(normalizeAlg('4x4', "M2'")).toBe("2-3Lw2'");
    for (const s of ["M'", 'M2', "M2'"]) expect(applies(kpuzzle4, normalizeAlg('4x4', s))).toBe(true);
  });

  it('只碰独立的 M/E/S,不碰 Lw / Rw / 已经是 2-3Lw 的', () => {
    expect(normalizeAlg('4x4', "Rw U2 Lw' Uw2 Rw'")).toBe("Rw U2 Lw' Uw2 Rw'");
    expect(normalizeAlg('4x4', '2-3Lw2')).toBe('2-3Lw2');
  });

  it('5x5 是奇数阶,真有中层 —— 引擎自己认 M,不许翻译', () => {
    expect(applies(kpuzzle5, 'M')).toBe(true);
    expect(normalizeAlg('5x5', 'M')).toBe('M');
    expect(normalizeAlg('5x5', "M2'")).toBe("M2'");
  });

  it('3x3 的 M 更不能碰', () => {
    expect(normalizeAlg('3x3', "M2 U M2 U2 M2 U M2")).toBe('M2 U M2 U2 M2 U M2');
  });
});

describe('oll-parity 的「M」case —— 好公式不该再被判成坏的', () => {
  // 独立判据:setup 由**不含 M** 的那条公式反推,跟 M 怎么翻译无关
  const setup = new Alg(normalizeAlg('4x4', M_FREE_ALG)).invert().toString();

  it('四条公式(含三条带 M 的)全部通过校验', async () => {
    for (const alg of M_CASE_ALGS) {
      const r = await validateAlgCase(setup, alg, M_CASE_STICKER, '4x4', 'oll-parity');
      expect(r.ok, `"${alg}" — ${r.reason}`).toBe(true);
    }
  });

  it('反向对照:校验器没在盖橡皮图章 —— 故意写坏的必须挂', async () => {
    // 少一步,魔方就还原不了。这条要是也「通过」,说明 4x4 压根没进校验、上面那条全是空转。
    const broken = M_CASE_ALGS[0].replace(" M'", '');
    const r = await validateAlgCase(setup, broken, M_CASE_STICKER, '4x4', 'oll-parity');
    expect(r.ok).toBe(false);
  });
});
