/**
 * LSLL 训练器的「第 n 轮」—— 302 条 ZBLS case × 494 个 ZBLL 收尾 = 149,188 条两步路线,
 * 一轮 302 条摊开走。这里锁的是那条合成律 (`model.composeState`) 的三个性质:
 *
 *  1. 第 1 轮就是公式库那批本身(收尾 ZBLL = 全解,合出来原地不动);
 *  2. 每一轮的第一眼都没变 —— 合成只动顶层角与棱的置换/朝向,槽对构型 φ 与顶层翻棱照旧,
 *     所以同一条 ZBLS case 在 494 轮里认的是同一张 ZBLS 图;
 *  3. 轮内 302 张图互不相同;跨轮会撞 804 格 —— 那是 ZBLS 构型自带 pre-AUF 对称的必然,
 *     不是 bug(路线不是局面的商,见 /math/lsll §3),数字锁在下面那条里。
 */
import { describe, it, expect } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import {
  classify, composeState, keyFromString, packState, unpackState,
} from '@/lib/lsll/model';
import { allZbllCases, phiOfState, solvedZbllKey, zbllRoundKeys, ZBLL_CASE_COUNT } from '@/lib/lsll/class3';
import {
  LSLL_ROUNDS, LSLL_SCOPE_COVERED, loadLsllCases, lsllCaseKeyString, lsllNextRoundScope,
  lsllRoundLabel, lsllRoundScope, parseLsllScope,
} from '@/lib/lsll/trainer-set';

const caseKey = (c: AlgCase) => keyFromString(lsllCaseKeyString(c))!;

describe('轮次的 ?scope=', () => {
  it('zbls / zbls-r7 往返,越界与非法退回第 1 轮', () => {
    expect(parseLsllScope('zbls')).toEqual({ category: null, eoBad: null, round: 1 });
    expect(parseLsllScope('zbls-r7')).toEqual({ category: null, eoBad: null, round: 7 });
    expect(parseLsllScope(`zbls-r${LSLL_ROUNDS}`).round).toBe(LSLL_ROUNDS);
    expect(parseLsllScope(`zbls-r${LSLL_ROUNDS + 1}`).round).toBe(1);
    expect(parseLsllScope('zbls-r0').round).toBe(1);
    expect(parseLsllScope('ap').round).toBe(1);          // 大类范围不分轮
    expect(lsllRoundScope(1)).toBe(LSLL_SCOPE_COVERED);  // 第 1 轮用裸 scope,链接短
    expect(lsllRoundScope(7)).toBe('zbls-r7');
  });

  it('下一轮 / 轮次名:最后一轮到头,大类范围没有轮次', () => {
    expect(lsllNextRoundScope(null)).toBe('zbls-r2');
    expect(lsllNextRoundScope('zbls-r2')).toBe('zbls-r3');
    expect(lsllNextRoundScope(`zbls-r${LSLL_ROUNDS}`)).toBeNull();
    expect(lsllNextRoundScope('ap')).toBeNull();
    expect(lsllRoundLabel('zbls-r3')?.zh).toBe(`第 3 / ${LSLL_ROUNDS} 轮`);
    expect(lsllRoundLabel('ap')).toBeNull();
  });

  it('轮数 = ZBLL case 数,第 1 轮的收尾就是全解顶层', () => {
    expect(LSLL_ROUNDS).toBe(ZBLL_CASE_COUNT);
    expect(LSLL_ROUNDS).toBe(494);
    const keys = zbllRoundKeys();
    expect(keys).toHaveLength(494);
    expect(keys[0]).toBe(solvedZbllKey());
    expect(new Set(keys).size).toBe(494);
    expect(new Set(keys)).toEqual(new Set(allZbllCases()));
  });
});

describe('合成律', () => {
  it('接全解顶层 = 原地不动,逐位相等', async () => {
    const solved = unpackState(solvedZbllKey());
    const r1 = await loadLsllCases(LSLL_SCOPE_COVERED);
    for (const c of [r1[0], r1[7], r1[150], r1[301]]) {
      const st = unpackState(caseKey(c));
      expect(packState(composeState(solved, st)), c.name).toBe(packState(st));
    }
  });

  it('第 1 轮 = 公式库那 302 条本身', async () => {
    const r1 = await loadLsllCases(LSLL_SCOPE_COVERED);
    const same = await loadLsllCases('zbls-r1');
    expect(r1).toHaveLength(302);
    expect(same.map(c => c.name)).toEqual(r1.map(c => c.name));
  });

  it('每一轮的第一眼不变:φ、大类、顶层翻棱数逐条相同', async () => {
    const r1 = await loadLsllCases(LSLL_SCOPE_COVERED);
    const base = r1.map(c => {
      const s = unpackState(caseKey(c));
      return { phi: phiOfState(s), letter: classify(s).category.letter, eoBad: classify(s).eoBad };
    });
    for (const round of [2, 3, 17, 200, LSLL_ROUNDS]) {
      const rn = await loadLsllCases(lsllRoundScope(round));
      expect(rn, `round ${round}`).toHaveLength(302);
      // 排序键是 (组名, case 编号),编号变了顺序可能变 —— 按 φ 配对比较
      const got = rn.map(c => {
        const s = unpackState(caseKey(c));
        return { phi: phiOfState(s), letter: classify(s).category.letter, eoBad: classify(s).eoBad };
      });
      const key = (x: { phi: number; letter: string; eoBad: number }) => `${x.phi}|${x.letter}|${x.eoBad}`;
      expect(new Set(got.map(key)), `round ${round}`).toEqual(new Set(base.map(key)));
      expect(rn.every(c => c.subgroup !== 'O')).toBe(true);
    }
  });

  /**
   * 149,188 条**路线**落到 148,384 张**图**上 —— 差的 804 不是 bug,是 /math/lsll §3 那件事:
   * 路线不是局面的商。ZBLS 构型自己带 pre-AUF 对称时(轨道 < 4),那个 U 把顶层也转了,
   * 于是两个不同的 ZBLL 收尾会合出同一张 LSLL 图。
   *
   * 覆盖到的 302 条里:296 条 pre-AUF 稳定子为 1(494 轮 494 张图,一张不重),
   * 2 条稳定子 2(各 487 张),4 条稳定子 4(274 / 276 / 288 / 348 张)。
   * 296×494 + 2×487 + (274+276+288+348) = 148,384。
   *
   * 训练进度按图的编号存,所以重复的那 804 格与先前那一格共享进度 —— 同一张图本来就是同一题。
   */
  it('149,188 条路线落在 148,384 张图上,轮内 302 张互不相同', async () => {
    const seen = new Set<number>();
    for (let round = 1; round <= LSLL_ROUNDS; round++) {
      const cs = await loadLsllCases(lsllRoundScope(round));
      expect(cs, `round ${round}`).toHaveLength(302);
      // 轮内不能撞:一场里出现两个同名 case,标记 / 轮盘就分不清了
      expect(new Set(cs.map(caseKey)).size, `round ${round}`).toBe(302);
      for (const c of cs) seen.add(caseKey(c));
    }
    expect(302 * LSLL_ROUNDS).toBe(149188);
    expect(seen.size).toBe(148384);
  }, 180_000);
});
