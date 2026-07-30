/**
 * 每阶段参考解法 —— 「你 N 步 / 参考 M 步」。
 * =========================================================================
 *
 * 三条规矩(实现头注里的,这里测死):
 *   1. 每个阶段都按**用户真实所处的局面**定价 —— F2L 的参考从「用户自己的十字
 *      之后」起算,不是从最优十字之后。烂十字只罚一次。
 *   2. 参考的来源必须自证:十字 = 穷举最优;F2L = csTimer 步进最优(禁 D);
 *      OLL/PLL = **验证过的库内最短公式**(套到真实局面上跑一遍,真收尾才采用)。
 *   3. 引擎只认单层面转。打乱或动作流里出现宽转 / 转体 / 垃圾 token,那个阶段
 *      **拒绝出数**(note='unsupported-moves'),绝不静默丢一步去给一个用户
 *      从未处在的局面定价。
 *
 * fixture 沿用 step_metrics.test.ts 的构造:按阶段写解法,打乱 = 整段的逆。
 * 阶段边界由真实 CFOP 检测器算出,不是测试自说自话。
 *
 * 末尾两组是**全 case 扫描**:57 个 OLL、21 个 PLL 各造一个真实局面,证明库内
 * 公式对每一个 case 都能被验证通过 —— 参考数字要么是真的,要么根本不出。
 */
import { describe, it, expect } from 'vitest';

import { computeStepMetrics } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import { computeStageReferences } from '@/app/[lang]/timer/_lib/reconstruct/reference';
import type { StageReference } from '@/app/[lang]/timer/_lib/reconstruct/reference';
import type { SolveMove } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import ollData from '@cuberoot/shared/data/oll.json';
import pllData from '@cuberoot/shared/data/pll.json';

/** Invert one token: R→R', R'→R, R2→R2, y→y'. */
function invertToken(t: string): string {
  if (t.endsWith("2'")) return t.slice(0, -1);
  if (t.endsWith('2')) return t;
  if (t.endsWith("'")) return t.slice(0, -1);
  return t + "'";
}
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
function solutionOf(parts: Part[]): string[] { return parts.flatMap(p => p.tokens); }

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
const FULL_TOTAL = 5950;

function referencesFor(parts: Part[], totalMs = FULL_TOTAL, scramble?: string) {
  const moves = movesOf(parts);
  const scr = scramble ?? scrambleFor(solutionOf(parts));
  const mx = computeStepMetrics(scr, moves, totalMs)!;
  return computeStageReferences(scr, moves, mx)!;
}

function byStep(stages: StageReference[]) {
  return {
    cross: stages.find(s => s.step === 'cross')!,
    f2l: stages.find(s => s.step === 'f2l')!,
    oll: stages.find(s => s.step === 'oll')!,
    pll: stages.find(s => s.step === 'pll')!,
  };
}

describe('a full CFOP solve, priced stage by stage', () => {
  const ref = referencesFor(FULL_PARTS);
  const { cross, f2l, oll, pll } = byStep(ref.stages);

  it('finds the cross optimum independently — and it is the line the fixture used', () => {
    // The fixture's scramble is the inverse of its own solution, so an optimal
    // cross exists at 3 turns; the engine has to find one on its own.
    expect(cross.kind).toBe('optimal');
    expect(cross.refTurns).toBe(3);
    expect(cross.refSolution).toBe("D' R' D");
    expect(cross.userTurns).toBe(3);
    expect(cross.delta).toBe(0);
  });

  it('prices F2L from the state after the user own cross', () => {
    expect(f2l.kind).toBe('step-optimal');
    expect(f2l.refTurns).toBe(4);
    expect(f2l.refSolution).toBe("U R U' R'");
    expect(f2l.userTurns).toBe(4);
    expect(f2l.delta).toBe(0);
  });

  it('prices OLL with the verified library alg, AUF excluded on both sides', () => {
    // Fixture ran OLL 45 (F R U R' U' F') behind an AUF: 7 turns total, 6 of
    // them execution. The reference is the same alg, so the delta is zero —
    // the AUF must not show up as an excess turn.
    expect(oll.kind).toBe('library-alg');
    expect(oll.refTurns).toBe(6);
    expect(oll.refSolution).toBe("F R U R' U' F'");
    expect(oll.userTurns).toBe(6);
    expect(oll.delta).toBe(0);
  });

  it('reports the standard T perm as 4 turns over our shortest T perm', () => {
    // This is the documented last-layer caveat made concrete: the cuber ran a
    // textbook 14-turn T perm perfectly, and our table holds a 10-turn machine
    // solution for the same position. The delta is real information ("a
    // shorter alg exists"), not a mistake.
    expect(pll.kind).toBe('library-alg');
    expect(pll.refTurns).toBe(10);
    expect(pll.refSolution).toBe("F2 U' F2 D R2 B2 U B2 D' R2");
    expect(pll.userTurns).toBe(14);
    expect(pll.delta).toBe(4);
  });

  it('totals only over stages that have both numbers', () => {
    expect(ref.refTurns).toBe(3 + 4 + 6 + 10);
    expect(ref.userTurns).toBe(3 + 4 + 6 + 14);
    expect(ref.delta).toBe(4);
  });
});

describe('stages with nothing to price', () => {
  it('charges a skipped stage zero turns and owes zero', () => {
    const parts = [CROSS, F2L, { tokens: PLL.tokens, ts: PLL.ts }];
    const { oll } = byStep(referencesFor(parts).stages);
    expect(oll.note).toBe('skipped');
    expect(oll.refTurns).toBe(0);
    expect(oll.userTurns).toBe(0);
    expect(oll.delta).toBe(0);
  });

  it('leaves the unreached stages of a DNF unpriced', () => {
    const parts = [CROSS, F2L, { tokens: OLL.tokens.slice(0, 3), ts: OLL.ts.slice(0, 3) }];
    const ref = referencesFor(parts, 4000, FULL_SCRAMBLE);
    const { cross, f2l, oll, pll } = byStep(ref.stages);
    expect(cross.refTurns).toBe(3);
    expect(f2l.refTurns).toBe(4);
    expect(oll.note).toBe('unreached');
    expect(oll.refTurns).toBeNull();
    expect(pll.note).toBe('unreached');
    // The totals stay honest: only cross + F2L.
    expect(ref.refTurns).toBe(7);
    expect(ref.userTurns).toBe(7);
  });

  it('refuses the stage whose prefix the engine alphabet cannot express', () => {
    // A y y' regrip in the cross: the tolerant face walker handles it (and the
    // last layer is still priced from that walk), but the mask engine has no
    // rotation, so F2L — whose reference needs the cross replayed as engine
    // tokens — refuses rather than pricing a position with two turns missing.
    const crossWithRegrip: Part = {
      tokens: ['y', "y'", "D'", "R'", 'D'],
      ts: [300, 350, 400, 600, 800],
    };
    const parts = [crossWithRegrip, F2L, OLL, PLL];
    // y y' is a net no-op, so the ORIGINAL scramble still describes this solve
    // — which is the point: a clean scramble, a stream the engine can't replay.
    const { cross, f2l, oll, pll } = byStep(referencesFor(parts, FULL_TOTAL, FULL_SCRAMBLE).stages);
    expect(cross.refTurns).toBe(3);                 // scramble-only: unaffected
    expect(f2l.note).toBe('unsupported-moves');
    expect(f2l.refTurns).toBeNull();
    expect(oll.refTurns).toBe(6);                   // face walk, still priced
    expect(pll.refTurns).toBe(10);
  });

  it('refuses cross and F2L when the SCRAMBLE is outside the alphabet', () => {
    // Same solve, but the scramble carries a wide move the mask engine has no
    // token for. The two stages that replay it refuse; the last layer, priced
    // off the tolerant face walk, does not depend on it at all.
    const mx = computeStepMetrics(FULL_SCRAMBLE, FULL_MOVES, FULL_TOTAL)!;
    const ref = computeStageReferences(FULL_SCRAMBLE + ' Rw2', FULL_MOVES, mx)!;
    const { cross, f2l } = byStep(ref.stages);
    expect(cross.note).toBe('unsupported-moves');
    expect(f2l.note).toBe('unsupported-moves');
    expect(cross.refTurns).toBeNull();
  });

  it('returns null with no scramble or no moves', () => {
    const mx = computeStepMetrics(FULL_SCRAMBLE, FULL_MOVES, FULL_TOTAL)!;
    expect(computeStageReferences('', FULL_MOVES, mx)).toBeNull();
    expect(computeStageReferences(FULL_SCRAMBLE, [], mx)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Every case in the tables, verified against a real position          */
/* ------------------------------------------------------------------ */

/** A solve that is exactly "one D turn to finish the first two layers, then
 *  this alg". Its scramble is the inverse, so the state right after that D is
 *  the position the alg is written for — which is what the reference has to
 *  recognize and price. */
function algOnlySolve(alg: string) {
  const tokens = ['D', ...alg.trim().split(/\s+/)];
  const parts: Part[] = [{ tokens, ts: tokens.map((_, i) => 500 + i * 200) }];
  return referencesFor(parts, 500 + tokens.length * 200 + 200);
}

describe('every OLL case gets a verified reference', () => {
  const cases = Object.entries(ollData as Record<string, { alg: string }>);
  it('has all 57', () => { expect(cases.length).toBe(57); });

  for (const [id, entry] of cases) {
    it(`${id} — the table alg is verified against the real position`, () => {
      const { oll } = byStep(algOnlySolve(entry.alg).stages);
      expect(oll.kind, id).toBe('library-alg');
      expect(oll.refTurns, id).toBeGreaterThan(0);
      expect(oll.refSolution, id).toBeTruthy();
    });
  }
});

describe('every PLL case gets a verified reference', () => {
  const cases = Object.entries(pllData as Record<string, Record<string, string>>);
  it('has all 21', () => { expect(cases.length).toBe(21); });

  for (const [id, entry] of cases) {
    it(`${id} — the table alg is verified against the real position`, () => {
      const { pll } = byStep(algOnlySolve(entry.noAuf).stages);
      expect(pll.kind, id).toBe('library-alg');
      expect(pll.refTurns, id).toBeGreaterThan(0);
      // PLL algs are pure face turns, so the walker ends the stage on the
      // alg's last turn and the two counts are directly comparable: the
      // reference is the shortest of four verified AUF variants.
      expect(pll.refTurns!, id).toBeLessThanOrEqual(pll.userTurns!);
    });
  }
});

describe('a real scramble, solved along the reference line', () => {
  // A real WCA-style scramble; the "cuber" runs exactly what the engine and
  // the alg tables would pick (cross + step-optimal F2L + the OLL 45 alg +
  // the shortest verified Ab perm), turning at a steady ~5.5 tps with a pause
  // before each alg. Every delta must therefore be zero — the reference has to
  // reproduce itself, or one of the two sides is wrong.
  const scramble = "D2 L2 F2 U' B2 U B2 U' L2 U2 F2 R' D' B' R2 F L' B2 R' U'";
  const solution = "L D2 F' D' B2 R U2 F U2 F' R' B2 L2 B' L2 B' U2 B2 R B2 R' U' L2 U F U' F' L2 U U U F R U R' U' F' R2 F2 R' B' R F2 R' B R' U";
  const ts = [880, 1060, 1240, 1420, 1600, 1780, 1960, 2390, 2570, 2750, 2930, 3110,
    3290, 3470, 3900, 4080, 4260, 4440, 4620, 4800, 4980, 5410, 5590, 5770, 5950,
    6130, 6310, 6490, 7370, 7550, 7730, 7910, 8090, 8270, 8450, 8880, 9060, 9840,
    10020, 10200, 10380, 10560, 10990, 11170, 11350, 11530, 11710];
  const tokens = solution.split(' ');
  const moves: SolveMove[] = tokens.map((m, i) => ({ m, ts: ts[i] }));
  const totalMs = 12010;

  it('prices every stage at exactly what the cuber spent', () => {
    expect(tokens.length).toBe(ts.length);
    const mx = computeStepMetrics(scramble, moves, totalMs)!;
    const ref = computeStageReferences(scramble, moves, mx)!;
    const { cross, f2l, oll, pll } = byStep(ref.stages);
    expect([cross.refTurns, cross.userTurns]).toEqual([5, 5]);
    expect([f2l.refTurns, f2l.userTurns]).toEqual([23, 23]);
    expect([oll.refTurns, oll.userTurns]).toEqual([6, 6]);
    expect([pll.refTurns, pll.userTurns]).toEqual([10, 10]);
    expect(ref.delta).toBe(0);
    // The closing AUF the Ab position forces is part of the reference line.
    expect(pll.refSolution).toBe("R2 F2 R' B' R F2 R' B R' U");
  });
});

describe('where the stage boundary and the alg disagree', () => {
  it('can price OLL one turn over the step, when the alg ends in a cosmetic AUF', () => {
    // OLL 36's table alg is "R' U' R U' R' U R U l U' R' U x": orientation is
    // complete before the final U (and the x is pure regrip), so the walker —
    // which ends a stage at FIRST reach — hands that U to the next step, where
    // it counts as recognition. The reference is the whole 12-turn alg, so the
    // step's own count comes out one lower. Nothing is lost: the turn is an
    // AUF, and AUFs are excluded on both sides everywhere else too.
    const { oll } = byStep(algOnlySolve((ollData as Record<string, { alg: string }>)['OLL 36'].alg).stages);
    expect(oll.refTurns).toBe(12);
    expect(oll.userTurns).toBe(11);
    expect(oll.delta).toBe(-1);
  });
});
