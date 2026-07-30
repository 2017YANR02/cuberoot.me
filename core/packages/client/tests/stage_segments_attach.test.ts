/**
 * 「一把还原落盘时该不该带 CFOP 分段」的判定 —— stageSegmentsFor。
 * =========================================================================
 *
 * 这个判定曾经没有主人:分段只由设置里那个手动「重新分析」写过,新还原一律不带。
 * 于是公式统计 / 成绩里的 OLL·PLL 筛选 / 自动标签 / CSV 导出全都看不见刚拧完的那把,
 * 除非用户自己想起来去点一次迁移。判定挪进这里之后,录入路径和迁移读同一份规则。
 *
 * 测三件事:
 *   1. 该带的带上,而且 OLL/PLL 名字是真名(整条链路都活着才可能对);
 *   2. 不该带的不带(没有动作流、不是三阶系项目);
 *   3. 拧坏的输入不能连带把这把还原弄丢 —— 走不通只能返回 null,禁抛。
 */
import { describe, it, expect } from 'vitest';

import { stageSegmentsFor, STAGE_SEGMENT_EVENTS } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import type { Solve } from '@/app/[lang]/timer/_lib/types';

/** 真题打乱 + 一条真的 CFOP 解法(浏览器里用假魔方跑过同一条)。
 *  双层转在真智能魔方上是两个 90 度,所以这里也按单层记。 */
const SCRAMBLE = "D R' D' R B' U' R' F2 L' F2 D' U2 L' D2 F L' B R'";
const SOLUTION = [
  'U', "R'", 'F', "R'", 'B', 'B', 'L',                                  // 十字
  'U', 'F', 'F', "R'", 'F', 'F', 'U', 'U', 'R',                         // F2L-1
  'U', "B'", 'U', 'U', 'B',                                             // F2L-2
  'F', 'L', 'F', "L'", 'F', 'F', "U'", 'F',                             // F2L-3
  'U', 'U', "L'", 'U', 'L', "U'", "L'", "U'", 'L',                      // F2L-4
  'U', 'U', 'F', 'U', 'R', "U'", "R'", "F'",                            // OLL 44
  "U'", 'F', 'F', "U'", 'F', 'F', 'D', 'R', 'R', 'B', 'B', 'U', 'B',
  'B', "D'", 'R', 'R', 'U',                                             // PLL T
];

function solveOf(over: Partial<Solve> = {}): Solve {
  return {
    id: 'test-1',
    ts: 1_700_000_000_000,
    timeMs: 7_000,
    scramble: SCRAMBLE,
    event: '333',
    penalty: 'ok',
    moves: SOLUTION.map((m, i) => ({ m, ts: Math.round((i * 7_000) / SOLUTION.length) })),
    ...over,
  } as Solve;
}

describe('stageSegmentsFor', () => {
  it('给带动作流的三阶还原算出分段,阶段名是真的', () => {
    const segs = stageSegmentsFor(solveOf());
    expect(segs).not.toBeNull();
    expect(segs!.ollCase).toBe('OLL 44 (P-Shape)');
    expect(segs!.pllCase).toBe('PLL T');
    expect(segs!.crossSide).toBe('D-cross');
    // 每一步的 HTM 就是上面那几段的长度,加起来是整条流。
    expect([segs!.crossHtm, segs!.f2lHtm, segs!.ollHtm, segs!.pllHtm]).toEqual([7, 31, 8, 18]);
    expect(segs!.crossHtm! + segs!.f2lHtm! + segs!.ollHtm! + segs!.pllHtm!).toBe(SOLUTION.length);
    // 四个阶段都到过,而且时间是递增的。
    expect(segs!.crossDoneMs).not.toBeNull();
    expect(segs!.solvedMs).not.toBeNull();
    expect(segs!.crossDoneMs!).toBeLessThan(segs!.f2lDoneMs!);
    expect(segs!.f2lDoneMs!).toBeLessThan(segs!.ollDoneMs!);
    expect(segs!.ollDoneMs!).toBeLessThan(segs!.solvedMs!);
  });

  it('没有动作流就没有分段(手动输入 / 外接计时器)', () => {
    expect(stageSegmentsFor(solveOf({ moves: undefined }))).toBeNull();
    expect(stageSegmentsFor(solveOf({ moves: [] }))).toBeNull();
  });

  it('不是三阶系的项目不分段', () => {
    expect(stageSegmentsFor(solveOf({ event: '222' }))).toBeNull();
    expect(stageSegmentsFor(solveOf({ event: '444' }))).toBeNull();
    expect(stageSegmentsFor(solveOf({ event: 'skewb' }))).toBeNull();
    // 但三阶单手 / 盲拧之外的三阶变体要分段 —— 它们拧的是同一个魔方。
    expect(stageSegmentsFor(solveOf({ event: '333oh' }))).not.toBeNull();
    expect(STAGE_SEGMENT_EVENTS.has('333oh')).toBe(true);
  });

  it('输入拧坏了也只是没分段,不能抛', () => {
    expect(() => stageSegmentsFor(solveOf({ scramble: '' }))).not.toThrow();
    expect(() => stageSegmentsFor(solveOf({ scramble: 'not a scramble at all' }))).not.toThrow();
    expect(() => stageSegmentsFor(solveOf({
      moves: [{ m: '???', ts: 0 }, { m: '', ts: 10 }],
    }))).not.toThrow();
  });

  it('打乱认不出来时不会假装认出了阶段', () => {
    // 乱打乱 + 真解法:走出来的状态跟这条解法无关,最后一步不可能到还原。
    const segs = stageSegmentsFor(solveOf({ scramble: 'R U R U R U R U R U' }));
    expect(segs?.solvedMs ?? null).toBeNull();
    expect(segs?.pllCase ?? null).toBeNull();
  });
});
