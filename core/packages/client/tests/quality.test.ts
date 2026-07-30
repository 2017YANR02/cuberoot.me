/**
 * Solve Quality —— 一把还原压成 0-100,以及它由哪三个数构成。
 * =========================================================================
 *
 * 分数是产品钩子(XC大师 已经证明了),但分数只有可解释才敢摆在第一屏。所以这里
 * 把**校准锚点**测死:换公式、换权重、换斜率,下面三个典型样本的分数必须跟着变,
 * 变了就得有人重新看一眼这条曲线还合不合理。
 *
 *   效率 = 你的步数 / 参考步数(reference.ts),1.0 满分,每超 1.0 扣 130 分;
 *   流畅 = 「按你自己最快的 8 步手速,这些步本该花多久」÷ 实际用时,
 *          0.40 → 0 分,0.90 → 100 分(它才看得见 F2L 内部的停顿 ——
 *          按步拆的识别/执行只有四个阶段间隔,结构上看不见);
 *   无废步 = 废步时间 / 转动时间,每一整份扣 150 分。
 *   权重 0.40 / 0.40 / 0.20;缺的那项按剩下的重新归一。
 *
 * 三个锚点(粗糙 46 / 一般 78 / 极佳 95)覆盖了「典型值落 50-95」这条设计目标。
 */
import { describe, it, expect } from 'vitest';

import { computeSolveQuality, peakTurnRate } from '@/app/[lang]/timer/_lib/reconstruct/quality';
import type { ReferenceResult } from '@/app/[lang]/timer/_lib/reconstruct/reference';
import type { StepMetricsResult } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import type { ErrorDetectResult } from '@/app/[lang]/timer/_lib/reconstruct/error_detect';
import type { SolveMove, StageSegments } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';

/** Turns at a constant rate — the only thing quality() reads a move stream
 *  for is the peak turn rate, so an even stream pins it exactly.
 *
 *  The faces cycle on purpose: quality() measures the peak rate on MERGED moves
 *  (htm.ts), so a stream of one repeated face would collapse to a single move
 *  and the fixture would be measuring nothing. Cycling keeps one notification
 *  == one move, which is what these anchors are about. */
const FIXTURE_FACES = ['R', 'U', 'F', 'L', 'D', 'B'];
function evenMoves(count: number, gapMs: number): SolveMove[] {
  return Array.from({ length: count }, (_, i) => ({
    m: FIXTURE_FACES[i % FIXTURE_FACES.length],
    ts: 1000 + i * gapMs,
  }));
}

const EMPTY_SEGMENTS: StageSegments = {
  crossDoneMs: null, f2lDoneMs: null, ollDoneMs: null, solvedMs: null,
  crossEndIdx: null, f2lEndIdx: null, ollEndIdx: null, solvedEndIdx: null,
  crossMs: null, f2lMs: null, ollMs: null, pllMs: null,
  crossHtm: null, f2lHtm: null, ollHtm: null, pllHtm: null,
  crossSide: null, ollCase: null, pllCase: null,
};

interface Case {
  /** Reference / user turn totals; omit both for "no reference at all". */
  refTurns?: number;
  userTurns?: number;
  /** Total STM turns of the solve, and the constant gap that sets peak TPS. */
  turns: number;
  gapMs: number;
  solvingMs: number;
  wastedMs?: number;
  /** null put-down = the cube never reached solved (a DNF mid-solve). */
  finished?: boolean;
}

function qualityFor(c: Case) {
  const metrics: StepMetricsResult = {
    pickupMs: 500,
    putDownMs: c.finished === false ? null : 200,
    solvingMs: c.solvingMs,
    totalRecognitionMs: 0,
    totalExecutionMs: c.solvingMs,
    totalTurns: c.turns,
    execTps: null,
    steps: [],
    segments: EMPTY_SEGMENTS,
  };
  const reference: ReferenceResult | null = c.refTurns === undefined ? null : {
    stages: [],
    refTurns: c.refTurns,
    userTurns: c.userTurns ?? c.turns,
    delta: (c.userTurns ?? c.turns) - c.refTurns,
  };
  const waste: ErrorDetectResult | null = c.wastedMs === undefined ? null : {
    spans: [], totalWastedMoves: 0, totalWastedMs: c.wastedMs,
  };
  return computeSolveQuality(evenMoves(Math.max(9, c.turns), c.gapMs), metrics, reference, waste);
}

describe('calibration anchors', () => {
  it('scores a competent solve in the high 70s', () => {
    // 60 turns against a 50-turn reference (ratio 1.20); hands peak at 10 tps
    // so the turns alone would take 6.0s, and the solve spent 8.0s turning.
    const q = qualityFor({ refTurns: 50, userTurns: 60, turns: 60, gapMs: 100, solvingMs: 8000 })!;
    expect(q.turnRatio).toBeCloseTo(1.2, 6);
    expect(q.peakTps).toBeCloseTo(10, 6);
    expect(q.idealMs).toBeCloseTo(6000, 6);
    expect(q.efficiency).toBeCloseTo(74, 6);   // 100 - 130 * 0.20
    expect(q.flow).toBeCloseTo(70, 6);         // (0.75 - 0.40) / 0.50
    expect(q.wasteFree).toBe(100);
    expect(q.total).toBe(78);
  });

  it('scores a tight solve in the mid 90s', () => {
    // 55 turns against 52 (ratio 1.058), peak 12.5 tps, 4.4s of turning owed
    // against 5.0s spent.
    const q = qualityFor({ refTurns: 52, userTurns: 55, turns: 55, gapMs: 80, solvingMs: 5000 })!;
    expect(q.efficiency).toBeCloseTo(92.5, 1);
    expect(q.flow).toBeCloseTo(96, 1);
    expect(q.total).toBe(95);
  });

  it('scores a sloppy solve in the mid 40s', () => {
    // 72 turns against 50 (ratio 1.44), peak 8 tps (9.0s owed) against 16.0s
    // spent, and 2.0s of that was undoing its own work.
    const q = qualityFor({
      refTurns: 50, userTurns: 72, turns: 72, gapMs: 125, solvingMs: 16000, wastedMs: 2000,
    })!;
    expect(q.efficiency).toBeCloseTo(42.8, 1);
    expect(q.flow).toBeCloseTo(32.5, 1);
    expect(q.wasteFree).toBeCloseTo(81.25, 2);
    expect(q.total).toBe(46);
  });
});

describe('component edges', () => {
  it('caps efficiency at 100 for matching or beating the reference', () => {
    const same = qualityFor({ refTurns: 60, userTurns: 60, turns: 60, gapMs: 100, solvingMs: 8000 })!;
    const better = qualityFor({ refTurns: 60, userTurns: 55, turns: 55, gapMs: 100, solvingMs: 8000 })!;
    expect(same.efficiency).toBe(100);
    expect(better.efficiency).toBe(100);   // never above 100, and never a bonus
  });

  it('floors efficiency at 0 once the solve is 77% over the reference', () => {
    const q = qualityFor({ refTurns: 50, userTurns: 90, turns: 90, gapMs: 100, solvingMs: 12000 })!;
    expect(q.turnRatio).toBeCloseTo(1.8, 6);
    expect(q.efficiency).toBe(0);
  });

  it('caps flow at 100 when the hands never stopped', () => {
    // Even turning at the peak rate the whole way: ideal ≈ actual.
    const q = qualityFor({ refTurns: 60, userTurns: 60, turns: 60, gapMs: 100, solvingMs: 5900 })!;
    expect(q.flow).toBe(100);
    expect(q.total).toBe(100);
  });

  it('floors waste-free at 0 when two thirds of the solve was undone', () => {
    const q = qualityFor({
      refTurns: 50, userTurns: 60, turns: 60, gapMs: 100, solvingMs: 8000, wastedMs: 6000,
    })!;
    expect(q.wasteFree).toBe(0);
  });

  it('renormalises the weights when there is no reference', () => {
    const q = qualityFor({ turns: 60, gapMs: 100, solvingMs: 8000 })!;
    expect(q.efficiency).toBeNull();
    expect(q.turnRatio).toBeNull();
    // flow 70 at weight .4, waste 100 at weight .2 → (0.4*70 + 0.2*100) / 0.6
    expect(q.total).toBe(80);
  });
});

describe('solves that are not scored at all', () => {
  it('refuses an unfinished solve', () => {
    expect(qualityFor({
      refTurns: 50, userTurns: 60, turns: 60, gapMs: 100, solvingMs: 8000, finished: false,
    })).toBeNull();
  });

  it('refuses a solve with no turns or no elapsed time', () => {
    expect(qualityFor({ turns: 0, gapMs: 100, solvingMs: 8000 })).toBeNull();
    expect(qualityFor({ turns: 60, gapMs: 100, solvingMs: 0 })).toBeNull();
  });
});

describe('peak turn rate', () => {
  it('measures the fastest 8-turn burst, not the average', () => {
    // 20 slow turns with one fast burst buried in the middle.
    const moves: SolveMove[] = [];
    let ts = 0;
    for (let i = 0; i < 20; i++) {
      const gap = i >= 6 && i < 14 ? 100 : 500;   // the burst: 8 turns at 10 tps
      ts += gap;
      moves.push({ m: 'R', ts });
    }
    expect(peakTurnRate(moves)).toBeCloseTo(10, 6);
  });

  it('falls back to the whole stream when it is shorter than one window', () => {
    expect(peakTurnRate(evenMoves(4, 200))).toBeCloseTo(5, 6);
  });

  it('returns null without timing information', () => {
    expect(peakTurnRate([])).toBeNull();
    expect(peakTurnRate([{ m: 'R', ts: 100 }])).toBeNull();
    expect(peakTurnRate(evenMoves(10, 0))).toBeNull();
  });
});
