/**
 * anchorAlgFor —— 「连上时魔方已经是乱的」那条路的起点。
 *
 * 真求解器跑在 worker 里(第一次要建表,几秒),测试不碰它:求解器是参数,这里换成
 * 假的,考的是**这个模块自己的判断**,尤其是那道验算 —— 求解器给的串对不对,它必须
 * 自己能看出来。那道验算不是保险丝,是这个模块唯一的正确性来源:贴纸串到块级状态跨
 * 了三套下标约定,错一位出来的仍是一串合法转动,画出来却是另一颗魔方。
 */

import { describe, expect, it, vi } from 'vitest';

import { anchorAlgFor } from '@/app/[lang]/timer/_lib/bluetooth/anchor';
import { applyScramble, toFaceletString } from '@/app/[lang]/timer/_lib/cube/state';

const SOLVED = toFaceletString(applyScramble(3, ''));
const faceletsOf = (alg: string) => toFaceletString(applyScramble(3, alg));

describe('anchorAlgFor', () => {
  it('复原态直接给空,不惊动求解器', async () => {
    const solve = vi.fn();
    await expect(anchorAlgFor(SOLVED, solve)).resolves.toEqual([]);
    expect(solve).not.toHaveBeenCalled();
  });

  it('求解器给对了就照收', async () => {
    const alg = "R U R' U' F2 D L B'";
    const tokens = await anchorAlgFor(faceletsOf(alg), async () => alg);
    expect(tokens).toEqual(alg.split(' '));
  });

  it('大小写不影响(协议那头报上来是什么样都认)', async () => {
    const alg = 'R U2 F';
    const tokens = await anchorAlgFor(faceletsOf(alg).toLowerCase(), async () => alg);
    expect(tokens).toEqual(['R', 'U2', 'F']);
  });

  it('**求解器给了另一颗魔方 → 作废**(下标约定错位就是长这样)', async () => {
    const alg = "R U R' U'";
    // 一串完全合法、但到不了目标的转动。旧的做法会照单全收,屏幕从此和手里对不上。
    await expect(anchorAlgFor(faceletsOf(alg), async () => "L D L' D'")).resolves.toBeNull();
  });

  it('差一手也算错(验算是逐格比,不是「差不多」)', async () => {
    const alg = "R U R' U'";
    await expect(anchorAlgFor(faceletsOf(alg), async () => "R U R'")).resolves.toBeNull();
  });

  it('贴纸串读不动 → null,不惊动求解器', async () => {
    const solve = vi.fn();
    await expect(anchorAlgFor('UUU', solve)).resolves.toBeNull();
    expect(solve).not.toHaveBeenCalled();
    // 54 个字符但九个一面不成立(物理上不可能的贴纸分布)
    await expect(anchorAlgFor('U'.repeat(54), solve)).resolves.toBeNull();
    expect(solve).not.toHaveBeenCalled();
  });

  it('求解器抛了 / 给了空串 → null', async () => {
    const f = faceletsOf('R U F');
    await expect(anchorAlgFor(f, async () => { throw new Error('no tables'); })).resolves.toBeNull();
    await expect(anchorAlgFor(f, async () => '   ')).resolves.toBeNull();
  });

  it('乱七八糟的记号不会被当成公式吞下去', async () => {
    await expect(anchorAlgFor(faceletsOf('R U F'), async () => 'Q7 ??')).resolves.toBeNull();
  });
});
