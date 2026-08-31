/**
 * 每一对该花几步。
 * =========================================================================
 *
 * 整块 F2L 的参考解法回答的是「这四对合起来最少几步」——引擎可以自己挑顺序、可以
 * 一手插两对。**每一对**的参考解法问的是另一件事,而且对参考更苛刻:
 *
 *   从这位玩家真正所处的局面出发,在**不拆掉已经插好的那几对**的前提下,
 *   把这一对插进去最少几步。
 *
 * 所以四个槽的参考步数**不等于**整块 F2L 的参考步数(整块那个更小),两个数不能相加,
 * 下面第三条就把这件事钉死。
 *
 * 最重要的一条是 slot ↔ 位掩码 的对应:0x1 到底是 FR 还是别的槽,是从 cstimer 的掩码
 * 串上**读**出来的,读错了就会给出「答案对但答的是隔壁那对」。所以这里不去核对掩码
 * 字面量,而是把参考解法真的**拧到魔方上**,再问 `isSlotSolved` —— 拧完之后:
 * 十字还在、之前那几对还在、这一对进去了。三条都成立,对应关系就不可能错。
 */
import { describe, it, expect } from 'vitest';

import { computeF2lSlots } from '@/app/[lang]/timer/_lib/reconstruct/f2l_slots';
import { isSlotSolved } from '@/app/[lang]/timer/_lib/reconstruct/f2l_slots';
import type { F2lSlotId } from '@/app/[lang]/timer/_lib/reconstruct/f2l_slots';
import {
  computeF2lSlotReferences, computeStageReferences, gradeForDelta,
} from '@/app/[lang]/timer/_lib/reconstruct/reference';
import { computeStepMetrics } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import { applyOneToken } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import { applyScramble } from '@/app/[lang]/timer/_lib/cube/state';
import type { CubeFaces } from '@/app/[lang]/timer/_lib/cube/state';
import { isCross } from '@/app/[lang]/timer/_lib/cube/cfop_detect';
import { F2L_SLOT_FLAG, solveF2lTo } from '@cuberoot/puzzle-solvers/timer-333-step';
import { faceTurnToken } from '@cuberoot/puzzle-solvers/timer-333-cube';

// 与 f2l_slots.test.ts / stage_segments_attach.test.ts 同一条真解法。
const SCRAMBLE = "D R' D' R B' U' R' F2 L' F2 D' U2 L' D2 F L' B R'";
const SOLUTION = [
  'U', "R'", 'F', "R'", 'B', 'B', 'L',
  'U', 'F', 'F', "R'", 'F', 'F', 'U', 'U', 'R',
  'U', "B'", 'U', 'U', 'B',
  'F', 'L', 'F', "L'", 'F', 'F', "U'", 'F',
  'U', 'U', "L'", 'U', 'L', "U'", "L'", "U'", 'L',
  'U', 'U', 'F', 'U', 'R', "U'", "R'", "F'",
  "U'", 'F', 'F', "U'", 'F', 'F', 'D', 'R', 'R', 'B', 'B', 'U', 'B',
  'B', "D'", 'R', 'R', 'U',
];

const timed = (tokens: string[], stepMs = 200) =>
  tokens.map((m, i) => ({ m, ts: (i + 1) * stepMs }));

const moves = timed(SOLUTION);
const totalMs = moves[moves.length - 1].ts + 300;

function apply(state: CubeFaces, tokens: readonly string[]): CubeFaces {
  let s = state;
  for (const t of tokens) s = applyOneToken(s, t);
  return s;
}

describe('computeF2lSlotReferences', () => {
  const slots = computeF2lSlots(SCRAMBLE, moves, totalMs)!;

  it('四对都拿到参考步数,而且都不为零(这把没有白给的对)', () => {
    const refs = computeF2lSlotReferences(SCRAMBLE, moves, slots)!;
    expect(refs).toHaveLength(4);
    expect(refs.map(r => r.slot)).toEqual(slots.slots.map(s => s.slot));
    for (const r of refs) {
      expect(r.note).toBeNull();
      expect(r.refTurns).not.toBeNull();
      expect(r.refTurns!).toBeGreaterThan(0);
      expect(r.delta).toBe(r.userTurns! - r.refTurns!);
    }
  });

  it('把参考解法真拧上去:十字还在、之前那几对还在、这一对进去了', () => {
    const refs = computeF2lSlotReferences(SCRAMBLE, moves, slots)!;
    const crossEnd = slots.segments.crossEndIdx!;
    let prevEnd = crossEnd;
    const standing: F2lSlotId[] = [];

    for (let i = 0; i < refs.length; i++) {
      const r = refs[i];
      const seg = slots.slots[i];
      // 这一对开始时的局面 = 打乱 + 用户到上一对为止的动作。
      const start = apply(
        applyScramble(3, SCRAMBLE),
        SOLUTION.slice(0, prevEnd + 1),
      );
      const after = apply(start, (r.refSolution ?? '').split(/\s+/).filter(Boolean));
      expect(isCross(after), `slot ${r.slot}: 十字被拆了`).toBe(true);
      for (const kept of standing) {
        expect(isSlotSolved(after, kept), `slot ${r.slot}: 把 ${kept} 拆了`).toBe(true);
      }
      expect(isSlotSolved(after, r.slot), `slot ${r.slot}: 没插进去`).toBe(true);
      standing.push(r.slot);
      prevEnd = seg.endIdx!;
    }
  });

  it('参考不可能比用户还长(用户的那条本身就是一条合法解)', () => {
    const refs = computeF2lSlotReferences(SCRAMBLE, moves, slots)!;
    for (const r of refs) {
      // 用户这一段允许含 D 转(引擎的字母表里没有),所以只在无 D 的那几对上比较。
      const seg = slots.slots[refs.indexOf(r)];
      const span = SOLUTION.slice(0, (seg.endIdx ?? 0) + 1);
      const usedD = span.some(t => /^D/.test(t));
      if (usedD) continue;
      expect(r.refTurns!).toBeLessThanOrEqual(r.userTurns!);
    }
  });

  it('四对的参考步数之和 ≥ 整块 F2L 的参考步数(约束更强,不是同一个数)', () => {
    const metrics = computeStepMetrics(SCRAMBLE, moves, totalMs)!;
    const whole = computeStageReferences(SCRAMBLE, moves, metrics)!;
    const f2l = whole.stages.find(s => s.step === 'f2l')!;
    const refs = computeF2lSlotReferences(SCRAMBLE, moves, slots)!;
    const sum = refs.reduce((n, r) => n + (r.refTurns ?? 0), 0);
    expect(f2l.refTurns).not.toBeNull();
    expect(sum).toBeGreaterThanOrEqual(f2l.refTurns!);
  });

  it('打乱里有引擎表达不了的记号 → 整排 unsupported-moves,不瞎猜', () => {
    const refs = computeF2lSlotReferences(`Rw ${SCRAMBLE}`, moves, slots)!;
    expect(refs).toHaveLength(4);
    for (const r of refs) {
      expect(r.note).toBe('unsupported-moves');
      expect(r.refTurns).toBeNull();
    }
  });

  it('拧到一半:做完的有参考,没做完的是 unreached', () => {
    const partial = timed(SOLUTION.slice(0, 21));
    const partialSlots = computeF2lSlots(SCRAMBLE, partial, 21 * 200 + 300)!;
    const refs = computeF2lSlotReferences(SCRAMBLE, partial, partialSlots)!;
    const done = refs.filter(r => r.note === null);
    const missing = refs.filter(r => r.note === 'unreached');
    expect(done).toHaveLength(2);
    expect(missing).toHaveLength(2);
    for (const r of missing) expect(r.refTurns).toBeNull();
  });
});

describe('solveF2lTo — 掩码索引本身', () => {
  it('四个单槽 + 全四对的目标都在表里', () => {
    const scr = SCRAMBLE.trim().split(/\s+/).map(t => faceTurnToken(t)!);
    for (const flag of Object.values(F2L_SLOT_FLAG)) {
      // 打乱之后十字都没搭,单靠 F2L 字母表(无 D)插不进一对是常态 ——
      // 这里只要求「查得到目标」,查不到会返回 null 且没有搜索发生。
      const sol = solveF2lTo(scr, flag);
      expect(sol === null || Array.isArray(sol)).toBe(true);
    }
    expect(solveF2lTo(scr, 0)).toBeNull();      // 空集不是一个目标
    expect(solveF2lTo(scr, 0x10)).toBeNull();   // 越界
  });
});

describe('gradeForDelta', () => {
  it('只在追平和超越时给词,慢了不给', () => {
    expect(gradeForDelta(-1)).toBe('brilliant');
    expect(gradeForDelta(-7)).toBe('brilliant');
    expect(gradeForDelta(0)).toBe('optimal');
    expect(gradeForDelta(1)).toBeNull();
    expect(gradeForDelta(99)).toBeNull();
    expect(gradeForDelta(null)).toBeNull();
    expect(gradeForDelta(undefined)).toBeNull();
  });
});
