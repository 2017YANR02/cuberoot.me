/**
 * 识别 / 执行拆分 —— 逐字采用 Cubeast 定义,数字必须能对外比较。
 * =========================================================================
 *
 * 定义(SMART_CUBE_RESEARCH.md「step 级五个时间字段」,这里当作规范锁死):
 *   识别 = 上一阶段最后一转落定 → 本阶段第一个**非 AUF** 转动(AUF 计入识别);
 *   执行 = 该转动 → 本阶段最后一转;step_time = 识别 + 执行,两者精确二分;
 *   TPS  = STM 步数 / **执行**时间(被思考稀释的 TPS 不是手速);
 *   拿起 = 起表 → 第一转;放下 = 最后一转 → 停表(第一阶段的钟从第一转起走,
 *   拿起单独成段 —— Cubeast 的堆叠柱状图就是 Pickup 在 Cross 前面自成一柱)。
 *
 * fixture 的构造方式:按阶段写好**解法**(十字/F2L/OLL/PLL,各自带设计好的
 * 时间戳),打乱 = 整段解法的逆。这样"走到第几步完成哪个阶段"不是测试自说自话,
 * 而是真实 CFOP 检测器(computeStageSegments → detectCfopStage)在真实魔方
 * 模型上算出来的 —— 断言的边界错一步整组数字全错。
 */
import { describe, it, expect } from 'vitest';

import { computeStepMetrics, isAufToken, stmWeight } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import { computeStageSegments } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import type { SolveMove } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';

/** Invert one token: R→R', R'→R, R2→R2. Enough for the fixtures here. */
function invertToken(t: string): string {
  if (t.endsWith('2')) return t;
  if (t.endsWith("'")) return t.slice(0, -1);
  return t + "'";
}

/** The scramble that the given solution solves: its inverse. */
function scrambleFor(solution: string[]): string {
  return solution.slice().reverse().map(invertToken).join(' ');
}

interface Part { tokens: string[]; ts: number[] }

function movesOf(parts: Part[]): SolveMove[] {
  const out: SolveMove[] = [];
  for (const p of parts) {
    expect(p.tokens.length).toBe(p.ts.length);
    for (let i = 0; i < p.tokens.length; i++) out.push({ m: p.tokens[i], ts: p.ts[i] });
  }
  return out;
}

function solutionOf(parts: Part[]): string[] {
  return parts.flatMap(p => p.tokens);
}

/* ------------------------------------------------------------------ */
/* Fixture 1 — full CFOP, every gap designed                           */
/* ------------------------------------------------------------------ */

// Cross 3 moves; F2L one slot with a leading AUF; OLL 45 with a leading AUF;
// PLL = T perm with a leading U2. Timestamps chosen so every recognition /
// execution value is a distinct round number.
const CROSS: Part = { tokens: ["D'", "R'", 'D'], ts: [400, 600, 800] };
const F2L: Part = { tokens: ['U', 'R', "U'", "R'"], ts: [1500, 1700, 1800, 2100] };
const OLL: Part = {
  tokens: ['U', 'F', 'R', 'U', "R'", "U'", "F'"],
  ts: [3000, 3100, 3200, 3250, 3300, 3350, 3600],
};
const PLL: Part = {
  tokens: ['U2', 'R', 'U', "R'", "U'", "R'", 'F', 'R2', "U'", "R'", "U'", 'R', 'U', "R'", "F'"],
  ts: [4200, 4400, 4500, 4600, 4700, 4800, 4900, 5000, 5100, 5200, 5300, 5400, 5500, 5600, 5700],
};
const FULL_PARTS = [CROSS, F2L, OLL, PLL];
const FULL_MOVES = movesOf(FULL_PARTS);
const FULL_SCRAMBLE = scrambleFor(solutionOf(FULL_PARTS));
const FULL_TOTAL = 5950; // last turn 5700 + 250ms put-down

describe('the stage walker finds the constructed boundaries', () => {
  // Everything below leans on these indices; pin them first so a walker
  // change fails HERE with a readable message, not in a derived number.
  it('completes each stage exactly at its part boundary', () => {
    const segs = computeStageSegments(FULL_SCRAMBLE, FULL_MOVES, FULL_TOTAL)!;
    expect(segs.crossEndIdx).toBe(2);   // last cross move
    expect(segs.f2lEndIdx).toBe(6);     // last F2L move (index 3+4-1+... = 2+4)
    expect(segs.ollEndIdx).toBe(13);    // last OLL move
    expect(segs.solvedEndIdx).toBe(FULL_MOVES.length - 1);
    expect(segs.crossDoneMs).toBe(800);
    expect(segs.f2lDoneMs).toBe(2100);
    expect(segs.ollDoneMs).toBe(3600);
    // solvedMs is padded to totalMs by the walker's own documented rule.
    expect(segs.solvedMs).toBe(FULL_TOTAL);
  });
});

describe('recognition / execution per the Cubeast definitions', () => {
  const mx = computeStepMetrics(FULL_SCRAMBLE, FULL_MOVES, FULL_TOTAL)!;
  const [cross, f2l, oll, pll] = mx.steps;

  it('starts the first step at the first turn — pickup is its own segment', () => {
    expect(mx.pickupMs).toBe(400);
    expect(cross.recognitionMs).toBe(0);      // first turn is non-AUF
    expect(cross.executionMs).toBe(400);      // 400 → 800
    expect(cross.stepMs).toBe(400);
  });

  it('counts a leading AUF as recognition, not execution', () => {
    // F2L: previous turn landed at 800; AUF U at 1500; first non-AUF R at 1700.
    expect(f2l.recognitionMs).toBe(900);      // 800 → 1700, THROUGH the AUF
    expect(f2l.executionMs).toBe(400);        // 1700 → 2100
    expect(f2l.stepMs).toBe(1300);
    // OLL: landed 2100; AUF at 3000; F at 3100.
    expect(oll.recognitionMs).toBe(1000);
    expect(oll.executionMs).toBe(500);
    // PLL: landed 3600; U2 AUF at 4200; R at 4400.
    expect(pll.recognitionMs).toBe(800);
    expect(pll.executionMs).toBe(1300);
  });

  it('divides TPS by execution time only, and counts the AUF as a turn', () => {
    expect(cross.turns).toBe(3);
    expect(f2l.turns).toBe(4);
    expect(oll.turns).toBe(7);                // AUF + 6-move OLL 45
    expect(pll.turns).toBe(15);               // U2 + 14-move T perm
    expect(cross.tps).toBeCloseTo(3 / 0.4, 5);
    expect(f2l.tps).toBeCloseTo(4 / 0.4, 5);
    expect(oll.tps).toBeCloseTo(7 / 0.5, 5);
    expect(pll.tps).toBeCloseTo(15 / 1.3, 5);
  });

  it('partitions the whole solve: pickup + steps + put-down = timeMs', () => {
    expect(mx.putDownMs).toBe(250);
    const stepSum = mx.steps.reduce((acc, s) => acc + (s.stepMs ?? 0), 0);
    expect(mx.pickupMs + stepSum + mx.putDownMs!).toBe(FULL_TOTAL);
    expect(mx.solvingMs).toBe(FULL_TOTAL - 400 - 250);
    // And each step partitions itself.
    for (const s of mx.steps) {
      expect(s.stepMs).toBe((s.recognitionMs ?? 0) + (s.executionMs ?? 0));
    }
  });

  it('sums the totals from the same parts', () => {
    expect(mx.totalRecognitionMs).toBe(0 + 900 + 1000 + 800);
    expect(mx.totalExecutionMs).toBe(400 + 400 + 500 + 1300);
    expect(mx.totalTurns).toBe(3 + 4 + 7 + 15);
    expect(mx.execTps).toBeCloseTo(29 / 2.6, 5);
  });

  it('reports cumulative time at each stage-completing turn', () => {
    expect(cross.cumulativeMs).toBe(800);
    expect(f2l.cumulativeMs).toBe(2100);
    expect(oll.cumulativeMs).toBe(3600);
    expect(pll.cumulativeMs).toBe(5700);
  });
});

/* ------------------------------------------------------------------ */
/* Fixture 2 — OLL skip                                                */
/* ------------------------------------------------------------------ */

describe('a skipped stage', () => {
  // No OLL part: after F2L the remaining state is the (LL-only, orientation-
  // preserving) inverse T perm, so F2L-done and OLL-done land on the same
  // move and the walker reports OLL as completed by that very move.
  const parts = [CROSS, F2L, { tokens: PLL.tokens, ts: PLL.ts }];
  const moves = movesOf(parts);
  const scramble = scrambleFor(solutionOf(parts));
  const total = 5950;

  it('is marked skipped with zero moves and zero time', () => {
    const mx = computeStepMetrics(scramble, moves, total)!;
    const [cross, f2l, oll, pll] = mx.steps;
    expect(cross.skipped).toBe(false);
    expect(f2l.skipped).toBe(false);
    expect(oll.skipped).toBe(true);
    expect(oll.stepMs).toBe(0);
    expect(oll.turns).toBe(0);
    expect(oll.tps).toBeNull();
    expect(oll.recognitionMs).toBeNull();
    // PLL's clock still starts at the move that completed F2L (= OLL).
    expect(pll.recognitionMs).toBe(4400 - 2100);
    // The partition invariant survives the skip.
    const stepSum = mx.steps.reduce((acc, s) => acc + (s.stepMs ?? 0), 0);
    expect(mx.pickupMs + stepSum + mx.putDownMs!).toBe(total);
  });
});

/* ------------------------------------------------------------------ */
/* Fixture 3 — PLL that is a single AUF                                */
/* ------------------------------------------------------------------ */

describe('an all-AUF step', () => {
  // After OLL the cube is one U turn from solved. There is no non-AUF turn
  // to hand recognition off at, so recognition runs to the step's first turn
  // and the AUF itself is the execution (it did solve the cube).
  const parts = [CROSS, F2L, OLL, { tokens: ['U'], ts: [4200] }];
  const moves = movesOf(parts);
  const scramble = scrambleFor(solutionOf(parts));

  it('falls back to first turn = execution start', () => {
    const mx = computeStepMetrics(scramble, moves, 4500)!;
    const pll = mx.steps[3];
    expect(pll.skipped).toBe(false);
    expect(pll.recognitionMs).toBe(4200 - 3600);
    expect(pll.executionMs).toBe(0);          // single turn: nothing to time
    expect(pll.tps).toBeNull();               // never Infinity
    expect(pll.turns).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Fixture 4 — DNF mid-OLL                                             */
/* ------------------------------------------------------------------ */

describe('an unfinished solve', () => {
  const parts = [CROSS, F2L, { tokens: OLL.tokens.slice(0, 3), ts: OLL.ts.slice(0, 3) }];
  const moves = movesOf(parts);
  // Scramble is still the FULL solution's inverse — the solve just stopped.
  const scramble = FULL_SCRAMBLE;

  it('nulls the unreached steps and has no put-down', () => {
    const mx = computeStepMetrics(scramble, moves, 4000)!;
    const [cross, f2l, oll, pll] = mx.steps;
    expect(cross.stepMs).toBe(400);
    expect(f2l.stepMs).toBe(1300);
    expect(oll.stepMs).toBeNull();
    expect(pll.stepMs).toBeNull();
    expect(mx.putDownMs).toBeNull();          // a DNF has no put-down
    expect(mx.solvingMs).toBe(4000 - 400);    // the tail is unfinished solving
    // Totals only include what actually happened.
    expect(mx.totalTurns).toBe(3 + 4);
  });
});

/* ------------------------------------------------------------------ */
/* Token classification + degenerate input                             */
/* ------------------------------------------------------------------ */

describe('token classification', () => {
  it('treats exactly bare U turns as AUF', () => {
    for (const t of ['U', "U'", 'U2', "U2'"]) expect(isAufToken(t), t).toBe(true);
    for (const t of ['u', 'Uw', 'D', "R'", 'F2', 'M', 'y', '']) expect(isAufToken(t), t).toBe(false);
  });

  it('counts rotations as zero turns (STM), everything else as one', () => {
    for (const t of ['x', "y'", 'z2', 'X', 'Y2', "Z'"]) expect(stmWeight(t), t).toBe(0);
    for (const t of ['R', 'U2', 'M', "E'", 'S2', 'Rw', 'u']) expect(stmWeight(t), t).toBe(1);
    expect(stmWeight('')).toBe(0);
  });

  it('lets a rotation neither end recognition nor add a turn', () => {
    // Same F2L slot with a do-nothing y y' regrip between the AUF and the R:
    // recognition must still run to the R, and the turn count must not move.
    const f2lRot: Part = {
      tokens: ['U', 'y', "y'", 'R', "U'", "R'"],
      ts: [1500, 1550, 1600, 1700, 1800, 2100],
    };
    const parts = [CROSS, f2lRot, OLL, PLL];
    const mx = computeStepMetrics(scrambleFor(solutionOf(parts)), movesOf(parts), FULL_TOTAL)!;
    const f2l = mx.steps[1];
    expect(f2l.recognitionMs).toBe(900);      // 800 → 1700, through AUF + regrip
    expect(f2l.turns).toBe(4);                // the two rotations count nothing
  });
});

describe('degenerate input', () => {
  it('returns null with no moves', () => {
    expect(computeStepMetrics(FULL_SCRAMBLE, [], 5000)).toBeNull();
  });
});
