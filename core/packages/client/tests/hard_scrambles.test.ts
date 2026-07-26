import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { detectStageFromAlg } from '@/lib/stage_detect';
import { HARD_SCRAMBLES, type HardStageKey } from '@/app/[lang]/scramble/hardest/_data/hard_scrambles';
import { CN_XCROSS_10_REPS } from '@/app/[lang]/scramble/hardest/_data/cn_xcross_10';

/**
 * `/scramble/hardest` 的两组数字,分头钉住:
 *
 *   见证解法(本文件现场证)—— 表格给的每个阶段都附了一条解法。把「打乱 + 解法」跑到
 *   cubing.js 的状态上,用站内 stage_detect 判定它到底解开了哪一阶段、几个槽,并核对
 *   长度。证到的是「该阶段 ≤ count」;count 的**最优性**仍是表格口径,页面照此标注。
 *
 *   整方最优步数(fixture 归档)—— 本机 cubeopt(h48 15G 剪枝表)跑出来的结果存进
 *   hard_scrambles_golden.json / cn_xcross_10_golden.json,这里只锁住数据层没被改歪。
 *   CI 里没有那张 15G 表,故不现场复算。
 */

interface HardGolden {
  /** 5 条著名打乱 + 第 5 条的 superflip 伴侣,顺序与 HARD_SCRAMBLES 一致。 */
  optimal: number[];
}
const hardGolden: HardGolden = JSON.parse(
  readFileSync(new URL('./fixtures/hard_scrambles_golden.json', import.meta.url), 'utf8'),
);
const cnGolden: { optimal: { reps: number[] } } = JSON.parse(
  readFileSync(new URL('./fixtures/cn_xcross_10_golden.json', import.meta.url), 'utf8'),
);

/** 该阶段至少要解开几个 F2L 槽。 */
const SLOTS_NEEDED: Record<HardStageKey, number> = {
  cross: 0, xcross: 1, xxcross: 2, xxxcross: 3,
};

const moveCount = (alg: string) => [...new Alg(alg).experimentalLeafMoves()].length;

describe('极难打乱:见证解法', () => {
  it('每条解法长度与表格给的步数一致', () => {
    for (const h of HARD_SCRAMBLES) {
      for (const s of h.stages) {
        expect(`${h.source} ${s.key} = ${moveCount(s.solution)}`).toBe(`${h.source} ${s.key} = ${s.count}`);
      }
    }
  });

  it('每条解法确实解开了它声称的阶段', async () => {
    for (const h of HARD_SCRAMBLES) {
      for (const s of h.stages) {
        const info = await detectStageFromAlg(`${h.scramble} ${s.solution}`);
        // 十字必须成:stage_detect 只在十字成立时才报 cross 家族。
        expect(`${h.source} ${s.key} → ${info.stage}`).not.toBe(`${h.source} ${s.key} → none`);
        expect({
          case: `${h.source} ${s.key}`,
          slots: info.solvedSlots.length >= SLOTS_NEEDED[s.key],
        }).toEqual({ case: `${h.source} ${s.key}`, slots: true });
      }
    }
  }, 60_000);

  it('打乱长度自洽,且长度 ≥ 整方最优步数', () => {
    for (const h of HARD_SCRAMBLES) {
      expect(`${h.source}: ${moveCount(h.scramble)}`).toBe(`${h.source}: ${h.length}`);
      expect(h.length).toBeGreaterThanOrEqual(h.optimal);
    }
  });

  it('六色底 Cross / XCross 各 6 个值,且 XCross ≥ Cross', () => {
    for (const h of HARD_SCRAMBLES) {
      expect(h.crossByColor.length).toBe(6);
      expect(h.xcrossByColor.length).toBe(6);
      for (let i = 0; i < 6; i++) expect(h.xcrossByColor[i]).toBeGreaterThanOrEqual(h.crossByColor[i]);
    }
  });
});

describe('极难打乱:整方最优步数(cubeopt 归档结论)', () => {
  it('5 条著名打乱 + superflip 伴侣与 fixture 一致', () => {
    const partners = HARD_SCRAMBLES.flatMap((h) => (h.partner ? [h.partner.optimal] : []));
    expect([...HARD_SCRAMBLES.map((h) => h.optimal), ...partners]).toEqual(hardGolden.optimal);
    // 全部 ≤ 20 —— 上帝之数。超过 20 说明抄错了行(表格的 f* 列对某几条其实是打乱长度)。
    for (const n of hardGolden.optimal) expect(n).toBeLessThanOrEqual(20);
  });

  it('23 条代表的 optimal 列与 cubeopt 复核结果逐条一致', () => {
    expect(CN_XCROSS_10_REPS.map((r) => r.optimal)).toEqual(cnGolden.optimal.reps);
  });
});
