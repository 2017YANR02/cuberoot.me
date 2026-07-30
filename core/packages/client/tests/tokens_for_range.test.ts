/**
 * 每一步到底拧了什么。
 * =========================================================================
 *
 * 表格里点开一列会显示那一步的动作序列。要成立的是「这条序列和那一列的数字说的是
 * 同一件事」:
 *
 *   1. 步数对得上 —— 序列里的**转动**条数 = 那一步的 turns(转体不算步,和所有
 *      指标一致);
 *   2. 不重不漏 —— 各步序列首尾相接,拼起来就是整把(合并成 HTM 之后);
 *   3. 跨界的那一手只归一边 —— 半转被智能魔方拆成两次通知,如果它骑在阶段边界上,
 *      归它**开始**时所在的那一步(和 `metricForRange` 的归属规则同一条)。
 *
 * 还有两样是故意留着、不跟着 turns 走的:转体(0 步但人真做了)和抵消掉的连拧
 * (`R R'` 在 HTM 里一步都不算,但它解释了为什么这一步慢)。
 */
import { describe, it, expect } from 'vitest';

import { htmMoves } from '@/app/[lang]/timer/_lib/reconstruct/htm';
import { tokensForRange, stmWeight } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import type { SolveMove } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';

const mv = (tokens: string[]): SolveMove[] => tokens.map((m, i) => ({ m, ts: (i + 1) * 100 }));

describe('tokensForRange', () => {
  it('合并同面连拧,和 htmMoves 一致', () => {
    const moves = mv(['R', 'R', 'U', "F'", 'F', 'F', 'F']);
    // R R → R2;U;F' F F F → 净 +2 → F2。
    expect(tokensForRange(moves, htmMoves(moves), 0, moves.length - 1))
      .toEqual(['R2', 'U', 'F2']);
  });

  it('转体照原样留着 —— 它 0 步,但人真的转了', () => {
    const moves = mv(['y', 'R', 'U', "R'"]);
    const seq = tokensForRange(moves, htmMoves(moves), 0, 3);
    expect(seq).toEqual(['y', 'R', 'U', "R'"]);
    // 但它不进步数:序列里带权重的只有三条。
    expect(seq.filter(t => stmWeight(t) > 0)).toHaveLength(3);
  });

  it('抵消掉的连拧不进 HTM,却照样显示 —— 这一步为什么慢就写在这儿', () => {
    const moves = mv(['R', "R'", 'U']);
    expect(htmMoves(moves).map(h => h.m)).toEqual(['U']); // R R' 净 0,不算步
    expect(tokensForRange(moves, htmMoves(moves), 0, 2)).toEqual(['R', "R'", 'U']);
  });

  it('骑在边界上的半转只算给它开始的那一步', () => {
    //            0    1    2    3
    const moves = mv(['U', 'R', 'R', 'F']);
    const counted = htmMoves(moves);
    // R R 从 1 开始、到 2 结束。边界切在 1:第一步吃到 R2(它从 1 开始),
    // 第二步只剩 F —— 索引 2 那半个不会再出现一次。
    expect(tokensForRange(moves, counted, 0, 1)).toEqual(['U', 'R2']);
    expect(tokensForRange(moves, counted, 2, 3)).toEqual(['F']);
    // 边界切在 0:R2 整个归后一步。
    expect(tokensForRange(moves, counted, 0, 0)).toEqual(['U']);
    expect(tokensForRange(moves, counted, 1, 3)).toEqual(['R2', 'F']);
  });

  it('把整把按任意边界切开再拼起来,等于整把', () => {
    const moves = mv([
      'U', "R'", 'F', "R'", 'B', 'B', 'L', 'U', 'F', 'F', "R'", 'F', 'F', 'U', 'U', 'R',
      'y', 'U', "B'", 'U', 'U', 'B', 'F', 'L', 'F', "L'", 'F', 'F', "U'", 'F',
    ]);
    const counted = htmMoves(moves);
    const whole = tokensForRange(moves, counted, 0, moves.length - 1);
    for (const cuts of [[5, 15, 21], [0, 1, 2], [9, 22], [15]]) {
      const bounds = [...cuts, moves.length - 1];
      const parts: string[] = [];
      let prev = -1;
      for (const b of bounds) {
        parts.push(...tokensForRange(moves, counted, prev + 1, b));
        prev = b;
      }
      expect(parts, `cuts ${cuts.join(',')}`).toEqual(whole);
    }
  });

  it('空范围就是空,越界不抛', () => {
    const moves = mv(['R', 'U']);
    const counted = htmMoves(moves);
    expect(tokensForRange(moves, counted, 5, 9)).toEqual([]);
    expect(tokensForRange(moves, counted, 1, 0)).toEqual([]);
    expect(tokensForRange([], [], 0, 3)).toEqual([]);
  });
});
