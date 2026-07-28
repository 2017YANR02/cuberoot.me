/**
 * LSLL 训练器的「第 n 轮」—— 302 条 ZBLS case × 494 个 ZBLL 收尾 = 149,188 条两步路线,
 * 一轮 302 条摊开走。这里锁的是那条合成律 (`model.composeState`) 的四个性质:
 *
 *  1. 接全解顶层 = 原地不动(合成律本身);
 *  2. **一轮之内 302 个 ZBLL 收尾互不相同**(错位对角 `roundZbllIndex`)—— 旧排法是「第 n 轮
 *     全体接第 n 个 ZBLL」,第 1 轮于是整轮都是纯 ZBLS(均值 9.28 步,其余 493 轮 13.0~14.4);
 *  3. 每一轮的第一眼都没变 —— 合成只动顶层角与棱的置换/朝向,槽对构型 φ 与顶层翻棱照旧,
 *     所以同一条 ZBLS case 在 494 轮里认的是同一张 ZBLS 图;
 *  4. 轮内 302 张图互不相同;跨轮会撞 804 格 —— 那是 ZBLS 构型自带 pre-AUF 对称的必然,
 *     不是 bug(路线不是局面的商,见 /math/lsll §3),数字锁在下面那条里。
 *
 * 性质 2 与 4 合起来才是「换了排法但一条路线都没丢」:错位对角是笛卡尔积上的重排,
 * 494 轮的并集仍是同一批 148,384 张图(求解语料因此不用重跑)。
 */
import { describe, it, expect } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import {
  canonicalKey, classify, composeState, keyFromString, packState, unpackState,
} from '@/lib/lsll/model';
import type { LsllState } from '@/lib/lsll/cube333';
import { ZBLS_COVERED_KEYS } from '@/lib/lsll/zbls_overlay';
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

  it('裸 zbls 与 zbls-r1 是同一轮', async () => {
    const r1 = await loadLsllCases(LSLL_SCOPE_COVERED);
    const same = await loadLsllCases('zbls-r1');
    expect(r1).toHaveLength(302);
    expect(same.map(c => c.name)).toEqual(r1.map(c => c.name));
  });

  /**
   * 一轮之内 302 个收尾互不相同。不照 `roundZbllIndex` 的公式重算一遍(那只是把实现抄两遍),
   * 而是**反查**:每张图的第一眼 φ 认出它是哪条 ZBLS,再拿 494 个 ZBLL 逐个合成去撞它的编号,
   * 撞上的那个就是这一格真正的收尾。撞不上 = 这张图根本不是这条 ZBLS 合出来的,当场红。
   */
  it('轮内 302 个 ZBLL 收尾互不相同', async () => {
    // 干净的 ZBLS 构型取自公式库那批原始 key —— 它们本身就是纯 ZBLS 局面(顶层已解)。
    const zblsByPhi = new Map<number, LsllState>();
    for (const s of ZBLS_COVERED_KEYS) {
      const k = keyFromString(s);
      if (k == null) continue;
      const st = unpackState(k);
      if (classify(st).category.pureLL) continue;
      zblsByPhi.set(phiOfState(st), st);
    }
    expect(zblsByPhi.size).toBe(302);

    /**
     * 反查数出来的收尾个数。**不是 302**:6 条 ZBLS 自带 pre-AUF 稳定子(轨道 < 4),它们身上
     * 两个不同的 ZBLL 会合出同一张图(就是那 804 格重复的来源),反查只认得出等价类里的头一个,
     * 于是每撞一次少一个。差多少取决于这一轮撞到谁,所以逐轮锁死 —— 改了配对法这几个数必变。
     * 旧排法(全轮同一个 ZBLL)在这里会是 {1:1, 2:1, …},一眼红。
     */
    const EXPECT: Record<number, number> = { 1: 302, 2: 300, 3: 301, 200: 302, [LSLL_ROUNDS]: 301 };
    const got: Record<number, number> = {};
    const rounds = zbllRoundKeys().map(unpackState);
    for (const round of [1, 2, 3, 200, LSLL_ROUNDS]) {
      const cs = await loadLsllCases(lsllRoundScope(round));
      const used = new Set<number>();
      for (const c of cs) {
        const key = caseKey(c);
        const zbls = zblsByPhi.get(phiOfState(unpackState(key)));
        expect(zbls, `${c.name} @ round ${round}`).toBeDefined();
        const z = rounds.findIndex(zbll => canonicalKey(composeState(zbll, zbls!)) === key);
        expect(z, `${c.name} @ round ${round}`).toBeGreaterThanOrEqual(0);
        used.add(z);
      }
      got[round] = used.size;
    }
    expect(got).toEqual(EXPECT);
  }, 120_000);

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
