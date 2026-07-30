/**
 * 废步检测 —— 「这里多花了 0.8s 和 4 步」。
 * =========================================================================
 *
 * 唯一规则:**状态重现 = 中间那段转动净效果为零**。不做模式匹配
 * (R R' / 走错公式再退 / 绕一圈回来,全是同一件事),也因此不会误报:
 * 状态真的回来了,那些转动就真的什么都没达成。AUF 会移动贴纸,所以对齐
 * 顶层不会被标。
 *
 * 记账约定(实现头注里的几条,这里测死):
 *   - 每次「回到首次见过的状态」记一个原始区间,**重叠区间合并成极大段**:
 *     逐步退掉的走错公式(F F' / U U' / R R' 嵌套)必须整段报 6 步,
 *     而不是只报最内层 2 步,也不是把嵌套区间分开数成 12 步;
 *   - 只合并真重叠(共享动作),背靠背的两个环分开报 —— 那是两个错误;
 *   - 环的时间从「起点状态被到达」起算(想错路的思考时间也是这个错误的成本);
 *     从打乱起始状态出发的环例外,从环的第一转起算(那之前 solve 还没开始)。
 */
import { describe, it, expect } from 'vitest';

import { detectWastedWork } from '@/app/[lang]/timer/_lib/reconstruct/error_detect';
import type { SolveMove } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';

function mv(tokens: string[], ts: number[]): SolveMove[] {
  expect(tokens.length).toBe(ts.length);
  return tokens.map((m, i) => ({ m, ts: ts[i] }));
}

const SCRAMBLE = "R U R' F' D2 L U2 B";

describe('detectWastedWork', () => {
  it('flags an undone turn as a 2-turn loop, timed from the state before it', () => {
    // D at 1000 lands a state; R at 1500 leaves it; R' at 2600 returns.
    // Loop = [R, R'], 2 turns, and the cost runs 1000 → 2600: the 500ms spent
    // DECIDING to do the wrong R is part of what the error cost.
    const moves = mv(['D', 'R', "R'", 'F'], [1000, 1500, 2600, 3000]);
    const r = detectWastedWork(SCRAMBLE, moves)!;
    expect(r.spans).toEqual([{ fromIdx: 1, toIdx: 2, moves: 2, ms: 1600 }]);
    expect(r.totalWastedMoves).toBe(2);
    expect(r.totalWastedMs).toBe(1600);
  });

  it('flags a wrong alg backed out move by move as one maximal loop', () => {
    // Three wrong turns, three inverse turns. The walk sees three NESTED
    // revisits (after F', after U', after R'); the union must say "these six
    // turns achieved nothing" — not just the innermost F F', and not 12.
    const moves = mv(
      ['D', 'R', 'U', 'F', "F'", "U'", "R'", 'L'],
      [100, 200, 300, 400, 500, 600, 700, 800],
    );
    const r = detectWastedWork(SCRAMBLE, moves)!;
    expect(r.spans).toEqual([{ fromIdx: 1, toIdx: 6, moves: 6, ms: 600 }]);
  });

  it('merges an immediately repeated undo pair — the four turns are one run', () => {
    // R R' R R': raw intervals (0,1), (1,2), (0,3) genuinely share moves,
    // so they merge into a single 4-turn wasted run.
    const moves = mv(['R', "R'", 'R', "R'"], [100, 200, 300, 400]);
    const r = detectWastedWork(SCRAMBLE, moves)!;
    expect(r.spans).toEqual([{ fromIdx: 0, toIdx: 3, moves: 4, ms: 300 }]);
    expect(r.totalWastedMoves).toBe(4);
  });

  it('keeps back-to-back distinct loops separate — two errors, two spans', () => {
    // R R' then D D': no shared moves, so no merge. Each is its own error,
    // and the second one's clock starts from the state R R' returned to.
    const moves = mv(['R', "R'", 'D', "D'"], [100, 200, 800, 1000]);
    const r = detectWastedWork(SCRAMBLE, moves)!;
    expect(r.spans).toEqual([
      { fromIdx: 0, toIdx: 1, moves: 2, ms: 100 },
      { fromIdx: 2, toIdx: 3, moves: 2, ms: 800 },
    ]);
    expect(r.totalWastedMoves).toBe(4);
  });

  it('times a loop from the scrambled start from its first turn', () => {
    // R R' straight away: the start state existed since before the solve, so
    // the cost is 900 (first loop turn → return), not "since t=0".
    const moves = mv(['R', "R'", 'D'], [600, 1500, 2000]);
    const r = detectWastedWork(SCRAMBLE, moves)!;
    expect(r.spans).toEqual([{ fromIdx: 0, toIdx: 1, moves: 2, ms: 900 }]);
  });

  it('flags a six-sexy loop — a genuine net no-op, however fluent', () => {
    const sexy = ['R', 'U', "R'", "U'"];
    const tokens: string[] = [];
    for (let k = 0; k < 6; k++) tokens.push(...sexy);
    const ts = tokens.map((_, i) => 100 + i * 100);
    const r = detectWastedWork(SCRAMBLE, mv(tokens, ts))!;
    expect(r.totalWastedMoves).toBe(24);
    expect(r.spans[0].moves).toBe(24);
  });

  it('stays silent on a clean solve, and on an AUF', () => {
    // A straight-line sequence with no recurrence, ending in U turns
    // (AUF moves stickers — it must NOT be treated as "nothing happened").
    const moves = mv(['D', 'R', 'F', 'L', 'B', 'U', 'U'], [100, 200, 300, 400, 500, 600, 700]);
    const r = detectWastedWork(SCRAMBLE, moves)!;
    expect(r.spans).toEqual([]);
    expect(r.totalWastedMoves).toBe(0);
    expect(r.totalWastedMs).toBe(0);
  });

  it('does not conflate U2 with two separate U turns', () => {
    // U U is not an error (it's a U2 turned as two quarters), and neither
    // half undoes the other. Only U followed by U' would recur.
    const r1 = detectWastedWork(SCRAMBLE, mv(['U', 'U'], [100, 200]))!;
    expect(r1.spans).toEqual([]);
    const r2 = detectWastedWork(SCRAMBLE, mv(['U', "U'"], [100, 200]))!;
    expect(r2.spans.length).toBe(1);
  });

  it('flags four same-direction quarters — a full lap is a net no-op', () => {
    const r = detectWastedWork(SCRAMBLE, mv(['U', 'U', 'U', 'U'], [100, 200, 300, 400]))!;
    expect(r.spans).toEqual([{ fromIdx: 0, toIdx: 3, moves: 4, ms: 300 }]);
  });

  it('returns null with no moves', () => {
    expect(detectWastedWork(SCRAMBLE, [])).toBeNull();
  });
});
