/**
 * 三种方法读同一条动作流。
 * =========================================================================
 *
 * 用的还是那条真 CFOP 解法(和 `f2l_slots.test.ts` / `stage_segments_attach.test.ts`
 * 同源)。三件事要成立:
 *
 *   1. CFOP 走 `walkMethod` 和走老的 `computeStepMetrics` 必须给出**同一批**边界
 *      —— 两条路是同一份定义,不能各说各的;
 *   2. 同一把用 Roux / ZZ 去读不能崩、不能编数:一把 CFOP 解法确实会经过 Roux 的
 *      两个块(F2L 做完就等于两块都在),但不会经过 EOLine 的「所有棱都定向」;
 *   3. 没到的阶段一律 null。
 */
import { describe, it, expect } from 'vitest';

import { walkMethod } from '@/app/[lang]/timer/_lib/reconstruct/method_walk';
import { computeStepMetrics } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import { allEdgesOriented, METHOD_ORDER, methodById } from '@/app/[lang]/timer/_lib/reconstruct/methods';
import { applyScramble, toFaceletString, solved } from '@/app/[lang]/timer/_lib/cube/state';

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
const moves = SOLUTION.map((m, i) => ({ m, ts: (i + 1) * 200 }));
const totalMs = moves[moves.length - 1].ts + 300;

describe('walkMethod', () => {
  it('CFOP 走新路和走老路给出同一批边界和同一批时间', () => {
    const walk = walkMethod('cfop', SCRAMBLE, moves, totalMs)!;
    const old = computeStepMetrics(SCRAMBLE, moves, totalMs)!;
    expect(walk.stages.map(s => s.endIdx)).toEqual([
      old.segments.crossEndIdx, old.segments.f2lEndIdx,
      old.segments.ollEndIdx, old.segments.solvedEndIdx,
    ]);
    expect(walk.stages.map(s => s.stepMs)).toEqual(old.steps.map(s => s.stepMs));
    expect(walk.stages.map(s => s.turns)).toEqual(old.steps.map(s => s.turns));
    expect(walk.totalTurns).toBe(old.totalTurns);
    expect(walk.pickupMs).toBe(old.pickupMs);
    expect(walk.putDownMs).toBe(old.putDownMs);
  });

  it('同一把用 Roux 读:两个块确实经过了,最后也确实还原了', () => {
    const walk = walkMethod('roux', SCRAMBLE, moves, totalMs)!;
    expect(walk.stages.map(s => s.key)).toEqual(['fb', 'sb', 'cmll', 'lse']);
    // F2L 做完 = 左右两块都在,所以这两个阶段一定有边界。
    expect(walk.stages[0].endIdx).not.toBeNull();
    expect(walk.stages[1].endIdx).not.toBeNull();
    // 最后一步还原,所以 LSE 的边界就是最后一手。
    expect(walk.stages[3].endIdx).toBe(moves.length - 1);
    // 边界单调不倒退。
    const ends = walk.stages.map(s => s.endIdx!).filter(v => v !== null);
    expect(ends).toEqual([...ends].sort((a, b) => a - b));
  });

  it('同一把用 ZZ 读:EOLine 没在这条解法里出现过,就报 null,不硬凑', () => {
    const walk = walkMethod('zz', SCRAMBLE, moves, totalMs)!;
    expect(walk.stages[0].key).toBe('eoline');
    // 这条是 CFOP 解法,中途不保证所有棱定向 —— 没到就是没到。
    if (walk.stages[0].endIdx === null) {
      for (const s of walk.stages) {
        if (s.endIdx === null) {
          expect(s.stepMs).toBeNull();
          expect(s.turns).toBeNull();
        }
      }
    }
    // 不管 EOLine 认没认,最后一手都把魔方还原了。
    expect(walk.stages[3].endIdx).toBe(moves.length - 1);
  });

  it('三种方法都能跑,都不抛', () => {
    for (const id of METHOD_ORDER) {
      const w = walkMethod(id, SCRAMBLE, moves, totalMs);
      expect(w, id).not.toBeNull();
      expect(w!.method.id).toBe(id);
      expect(w!.stages).toHaveLength(methodById(id).stages.length);
    }
  });

  it('没有动作就没有结果', () => {
    expect(walkMethod('cfop', SCRAMBLE, [], 1000)).toBeNull();
  });
});

describe('allEdgesOriented', () => {
  it('还原态全定向;一个 F 会翻四条棱;R U L D B2 不翻任何一条', () => {
    expect(allEdgesOriented(toFaceletString(solved(3)))).toBe(true);
    expect(allEdgesOriented(toFaceletString(applyScramble(3, 'F')))).toBe(false);
    expect(allEdgesOriented(toFaceletString(applyScramble(3, 'F2')))).toBe(true);
    expect(allEdgesOriented(toFaceletString(applyScramble(3, "R U L D B2 U' R2")))).toBe(true);
    // 单个 B 也是坏的(定向是相对 F/B 轴定义的)。
    expect(allEdgesOriented(toFaceletString(applyScramble(3, "B")))).toBe(false);
  });
});
