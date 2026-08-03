/*
 * The enumerated difficulty classes — the ones the samplers cannot reach — are the RIGHT states,
 * and there are exactly as many of them as the site's exact-enumeration datasets say.
 *
 * These classes exist because sampling them is hopeless: six-colour cross at 8 is 40 states in
 * 980,995,276,800, six-colour XCross at 10 is 438 in 4.3e19. So the generator lists them instead —
 * and a list is only as good as its provenance. Two things are checked, both with toBe:
 *
 *   · the COUNT matches the golden number (exact_dist.ts for cross, /scramble/hardest for XCross).
 *     A count that is one short means the enumeration missed a state; one over means it admitted
 *     an illegal one. Either way the class is wrong and the trainer would hand out wrong cases.
 *   · every member really has that difficulty, re-measured with the trainer's own metric — not the
 *     tables the enumeration itself walked, but the same function the timer shows the user.
 *
 * The shipped XCross list is additionally re-derived from its source fixture (the 438 upstream
 * scrambles) and compared element by element, so the packed data cannot drift from what it claims.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySequence, parseMoves, solvedCubie } from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';
import { crossMetric, facesOfSubset, xcrossMetric } from '@/lib/cross-trainer';
import { corpusClass, corpusDepths, drawCorpus } from '@/lib/cross-trainer/corpus';
import { fillState } from '@/lib/cross-trainer/fill';

/** 精确穷举金标(app/[lang]/scramble/stats/_data/exact_dist.ts 的 cross / unfixed 一格)。 */
const CROSS_TOP = 8;
const CROSS_TOP_COUNT: Record<string, number> = {
  // 四色底三种取法各一份 —— 分布相同(颜色对称),但状态集合不同,所以逐个都要枚举对。
  BGOR: 591, BGWY: 591, ORWY: 591,
  BGORWY: 40,
};

describe('cross-trainer / enumerated classes', () => {
  for (const [subset, count] of Object.entries(CROSS_TOP_COUNT)) {
    it(`${subset} cross @${CROSS_TOP}: exactly ${count} states, every one of them ${CROSS_TOP} moves`, () => {
      const faces = facesOfSubset(subset);
      const list = corpusClass('std', 'cross', faces, 'best', CROSS_TOP);
      expect(list, `${subset}: enumeration must reproduce its golden count`).not.toBeNull();
      expect(list!.length).toBe(count);

      const seen = new Set<string>();
      for (const member of list!) {
        // 12 条棱全钉死 —— 十字的度量只看棱,角是自由纤维。
        expect(member.edgePins.length).toBe(12);
        const state = fillState(member.edgePins, member.cornerPins, Math.random);
        // 翻转和必须是偶数,否则这根本不是一个魔方状态。
        expect(state.eo.reduce((a, b) => a + b, 0) % 2).toBe(0);
        // 用计时器实际展示的那个度量重测一遍,而不是枚举时走的那张表。
        expect(crossMetric(state, faces)).toBe(CROSS_TOP);
        seen.add(member.edgePins.map((p) => `${p.piece}:${p.slot}:${p.ori}`).sort().join('|'));
      }
      expect(seen.size, `${subset}: no duplicates`).toBe(count);
    });
  }

  it('六色底 cross @8 的 40 个,是四色底 591 个的子集', () => {
    // 六个底色都要 8 步 ⇒ 其中任意四个也都要 8 步。这条不是重复检验:它把两次独立的
    // 枚举结果对上,一边算错就对不上。
    const key = (pins: { piece: number; slot: number; ori: number }[]) =>
      pins.map((p) => `${p.piece}:${p.slot}:${p.ori}`).sort().join('|');
    const four = new Set(corpusClass('std', 'cross', facesOfSubset('BGOR'), 'best', 8)!.map((m) => key(m.edgePins)));
    for (const m of corpusClass('std', 'cross', facesOfSubset('BGORWY'), 'best', 8)!) {
      expect(four.has(key(m.edgePins))).toBe(true);
    }
  });

  it('六色底 XCross @10: 438 个,逐个复现上游那份打乱表', () => {
    const golden = JSON.parse(
      readFileSync(new URL('./fixtures/cn_xcross_10_golden.json', import.meta.url), 'utf8'),
    ) as { total: number; all: string[] };
    expect(golden.total).toBe(438);

    const faces = facesOfSubset('BGORWY');
    const list = corpusClass('std', 'xcross', faces, 'best', 10);
    expect(list).not.toBeNull();
    expect(list!.length).toBe(438);

    // 打包的那份必须逐个等于「把上游打乱拧到还原态上」得到的状态,顺序都不许错。
    const stateKey = (c: { ep: number[]; eo: number[]; cp: number[]; co: number[] }) =>
      [c.ep.join(''), c.eo.join(''), c.cp.join(''), c.co.join('')].join('/');
    for (let i = 0; i < 438; i++) {
      const want = applySequence(solvedCubie(), parseMoves(golden.all[i]));
      const got = fillState(list![i].edgePins, list![i].cornerPins, Math.random);
      expect(stateKey(got), `state ${i}`).toBe(stateKey(want));
      // 再用计时器自己的度量确认它确实是 10 步 —— 搬运来的清单不许免检。
      expect(xcrossMetric(got, faces, 'best', 10), `state ${i} metric`).toBe(10);
    }
  });

  it('抽出来的就是那一档,而且不是每次同一个', () => {
    const faces = facesOfSubset('BGORWY');
    const keys = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const state = drawCorpus('std', 'cross', faces, 'best', 8, Math.random);
      expect(state).not.toBeNull();
      expect(crossMetric(state!, faces)).toBe(8);
      keys.add(state!.ep.join('') + state!.eo.join(''));
    }
    // 40 个里抽 60 次,只出一个的概率是 40·(1/40)^60 —— 不可能。
    expect(keys.size).toBeGreaterThan(1);
  });

  it('没有枚举的格返回 null,不返回「差不多的」', () => {
    expect(corpusClass('std', 'cross', facesOfSubset('W'), 'best', 8)).toBeNull();
    expect(corpusClass('std', 'cross', facesOfSubset('BGORWY'), 'best', 7)).toBeNull();
    expect(corpusClass('std', 'xxcross', facesOfSubset('BGORWY'), 'best', 12)).toBeNull();
    expect(drawCorpus('eo', 'eo_cross', facesOfSubset('BGORWY'), 'best', 10, Math.random)).toBeNull();
  });

  it('corpusDepths 只报有枚举的那几档', () => {
    expect(corpusDepths('std', 'cross', 6, 'best')).toEqual([8]);
    expect(corpusDepths('std', 'cross', 4, 'best')).toEqual([8]);
    expect(corpusDepths('std', 'cross', 1, 'best')).toEqual([]);
    expect(corpusDepths('std', 'xcross', 6, 'best')).toEqual([10]);
    expect(corpusDepths('std', 'xcross', 6, 'fixed')).toEqual([]);
  });
});
