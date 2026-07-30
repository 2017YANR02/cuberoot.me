/**
 * F2L 拆槽:一把 F2L 是四对,不是一块。
 * =========================================================================
 *
 * 用的是和 `stage_segments_attach.test.ts` 同一条**真** CFOP 解法(浏览器里用假魔方
 * 跑过),所以四对的边界是已知的:
 *
 *   十字   0-6    U R' F R' B B L
 *   F2L-1  7-15   U F F R' F F U U R
 *   F2L-2  16-20  U B' U U B
 *   F2L-3  21-28  F L F L' F F U' F
 *   F2L-4  29-37  U U L' U L U' L' U' L
 *   OLL    38-45 / PLL 46-63
 *
 * 所以四个槽的收尾动作下标必须是 15 / 20 / 28 / 37 —— 这是全文件最强的一条断言:
 * 它同时锁住了「哪一手合上了这对」和「四对的先后顺序」。
 */
import { describe, it, expect } from 'vitest';

import {
  computeF2lSlots, classifySlotStart, isSlotSolved,
} from '@/app/[lang]/timer/_lib/reconstruct/f2l_slots';
import { computeStageSegments } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import { applyScramble, solved } from '@/app/[lang]/timer/_lib/cube/state';

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

/** 200ms 一手,足够让识别/执行两个数不为零。 */
const timed = (tokens: string[], stepMs = 200) =>
  tokens.map((m, i) => ({ m, ts: (i + 1) * stepMs }));

describe('computeF2lSlots', () => {
  const moves = timed(SOLUTION);
  const totalMs = moves[moves.length - 1].ts + 300;

  it('把 F2L 切成四对,边界落在真解法的四段上', () => {
    const res = computeF2lSlots(SCRAMBLE, moves, totalMs)!;
    expect(res).not.toBeNull();
    expect(res.slots).toHaveLength(4);
    expect(res.freeCount).toBe(0);
    expect(res.slots.map(s => s.endIdx)).toEqual([15, 20, 28, 37]);
    expect(res.slots.map(s => s.order)).toEqual([1, 2, 3, 4]);
    // 四对必须是四个不同的槽,不能把同一个槽数两遍。
    expect(new Set(res.slots.map(s => s.slot)).size).toBe(4);
  });

  it('每对的识别 + 执行正好等于这对的用时,累计时间单调', () => {
    const res = computeF2lSlots(SCRAMBLE, moves, totalMs)!;
    let prevCum = 0;
    for (const s of res.slots) {
      expect(s.recognitionMs! + s.executionMs!).toBe(s.stepMs!);
      expect(s.cumulativeMs!).toBeGreaterThan(prevCum);
      prevCum = s.cumulativeMs!;
    }
    // 最后一对收尾的时刻就是 F2L 完成的时刻。
    const segs = computeStageSegments(SCRAMBLE, moves, totalMs)!;
    expect(res.slots[3].cumulativeMs).toBe(segs.f2lDoneMs);
  });

  it('四对的步数加起来等于 F2L 整段的步数', () => {
    const res = computeF2lSlots(SCRAMBLE, moves, totalMs)!;
    const segs = computeStageSegments(SCRAMBLE, moves, totalMs)!;
    const sum = res.slots.reduce((n, s) => n + (s.turns ?? 0), 0);
    expect(sum).toBe(segs.f2lHtm);
  });

  it('拧到一半断掉:做完的照报,没做完的是 null 而不是借来的数', () => {
    const partial = timed(SOLUTION.slice(0, 21));   // 只到 F2L-2 收尾
    const res = computeF2lSlots(SCRAMBLE, partial, 21 * 200 + 300)!;
    const finished = res.slots.filter(s => s.endIdx !== null);
    expect(finished.map(s => s.endIdx)).toEqual([15, 20]);
    for (const s of res.slots.filter(s => s.endIdx === null)) {
      expect(s.stepMs).toBeNull();
      expect(s.turns).toBeNull();
      expect(s.cumulativeMs).toBeNull();
    }
  });

  it('本来就站着的对算 free,不给它记时间和步数', () => {
    // 打乱只有一个 U:十字和四对从一开始就在,一手 U' 就还原。
    const res = computeF2lSlots('U', timed(["U'"]), 500)!;
    expect(res.freeCount).toBe(4);
    for (const s of res.slots) {
      expect(s.free).toBe(true);
      expect(s.turns).toBe(0);
      expect(s.stepMs).toBe(0);
      expect(s.start).toBe('solved');
    }
  });

  it('没有动作 / 没做完十字的一律返回 null,不编数', () => {
    expect(computeF2lSlots(SCRAMBLE, [], 1000)).toBeNull();
    // 打乱后随便拧两手,十字没成 → 没有 F2L 阶段可分。
    expect(computeF2lSlots(SCRAMBLE, timed(['R', 'U']), 1000)).toBeNull();
  });
});

describe('classifySlotStart', () => {
  it('还原态下四个槽都是 solved', () => {
    const s = solved(3);
    for (const id of ['FR', 'FL', 'BR', 'BL'] as const) {
      expect(isSlotSolved(s, id)).toBe(true);
      expect(classifySlotStart(s, id)).toBe('solved');
    }
  });

  it('把一对提到顶层:配好的是 paired-top,拆开的是 split-top', () => {
    // 判据不是我看着像:`R U R'` 是插入式 `R U' R'` 的**逆**,而 `R U' R'` 按定义
    // 就是「角在槽正上方、棱贴着它、整对连着」那一种,所以它的逆必然是 paired-top。
    const paired = applyScramble(3, "R U R'");
    expect(isSlotSolved(paired, 'FR')).toBe(false);
    expect(classifySlotStart(paired, 'FR')).toBe('paired-top');

    // 同理 `U R U' R'` 是 sexy(`R U R' U'`)的逆,而 sexy 解的是「角棱都在顶层但
    // 没连上」那一类 —— 顶层位置相邻不等于配好,侧面颜色对不上就是拆开的。
    const split = applyScramble(3, "U R U' R'");
    expect(classifySlotStart(split, 'FR')).toBe('split-top');
  });

  it('角已入槽 / 棱已入槽分得开', () => {
    expect(classifySlotStart(applyScramble(3, "R U R' U' R U R'"), 'FR')).toBe('corner-slotted');
    expect(classifySlotStart(applyScramble(3, "R U R' F"), 'FR')).toBe('edge-slotted');
  });

  it('别的槽被占了的时候说 unknown,不硬塞进基本情况', () => {
    // D 让四对整体转位:每个槽里都是「别人家的」对。
    const st = applyScramble(3, 'D');
    for (const id of ['FR', 'FL', 'BR', 'BL'] as const) {
      expect(isSlotSolved(st, id)).toBe(false);
      expect(classifySlotStart(st, id)).toBe('unknown');
    }
  });
});
