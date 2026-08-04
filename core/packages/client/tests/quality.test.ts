/**
 * Solve Quality —— 一把还原压成 0-100,以及它由哪三个数构成。
 * =========================================================================
 *
 * 分数是产品钩子(XC大师 已经证明了),但分数只有可解释才敢摆在第一屏。所以这里
 * 把**校准锚点**测死:换公式、换权重、换斜率,下面三个典型样本的分数必须跟着变,
 * 变了就得有人重新看一眼这条曲线还合不合理。
 *
 *   效率 = 你的步数 / 参考步数(reference.ts),1.0 满分,每超 1.0 扣 130 分;
 *   流畅 = 这把里**在转**的时间占多大比例(剩下的是在停);分数就是这个百分比
 *          本身,不再套曲线(它才看得见 F2L 内部的停顿 —— 按步拆的识别/执行
 *          只有四个阶段间隔,结构上看不见);
 *   无废步 = 废步时间 / 转动时间,每一整份扣 150 分。
 *   权重 0.40 / 0.40 / 0.20;缺的那项按剩下的重新归一。
 *
 * 三个锚点(粗糙 47 / 一般 80 / 极佳 93)覆盖了「典型值落 50-95」这条设计目标。
 */
import { describe, it, expect } from 'vitest';

import { computeSolveQuality, turningSplit } from '@/app/[lang]/timer/_lib/reconstruct/quality';
import type { ReferenceResult } from '@/app/[lang]/timer/_lib/reconstruct/reference';
import type { StepMetricsResult } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import type { ErrorDetectResult } from '@/app/[lang]/timer/_lib/reconstruct/error_detect';
import type { SolveMove, StageSegments } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';

/** `count` quarter turns at `turnMs` each, standing still for `pauseMs` before
 *  `pauses` of them (spread evenly). 流畅 is a time split now, so a constant
 *  stream can only ever say "100% turning" — the pauses ARE the fixture. */
const FIXTURE_FACES = ['R', 'U', 'F', 'L', 'D', 'B'];
function burstyMoves(count: number, turnMs: number, pauses = 0, pauseMs = 0): SolveMove[] {
  const out: SolveMove[] = [];
  let ts = 1000;
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      // Pause before move i when i lands on one of the `pauses` evenly-spaced slots.
      const slot = pauses > 0 && Math.floor((i - 1) * pauses / (count - 1))
        !== Math.floor(i * pauses / (count - 1));
      ts += turnMs + (slot ? pauseMs : 0);
    }
    out.push({ m: FIXTURE_FACES[i % FIXTURE_FACES.length], ts });
  }
  return out;
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
  /** HTM total (what efficiency compares); the stream below is quarter turns. */
  turns: number;
  /** The move stream: how many quarter turns, how fast, and how much standing still. */
  moves?: number;
  turnMs: number;
  pauses?: number;
  pauseMs?: number;
  /** Defaults to the stream's own span, which is what step_metrics reports
   *  (solvingMs = first turn → last turn). Override only to test the guards. */
  solvingMs?: number;
  wastedMs?: number;
  /** null put-down = the cube never reached solved (a DNF mid-solve). */
  finished?: boolean;
}

function qualityFor(c: Case) {
  const stream = burstyMoves(c.moves ?? Math.max(9, c.turns), c.turnMs, c.pauses, c.pauseMs);
  const span = stream[stream.length - 1].ts - stream[0].ts;
  const solvingMs = c.solvingMs ?? span;
  const metrics: StepMetricsResult = {
    pickupMs: 500,
    putDownMs: c.finished === false ? null : 200,
    solvingMs,
    totalRecognitionMs: 0,
    totalExecutionMs: solvingMs,
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
  return computeSolveQuality(stream, metrics, reference, waste);
}

/** The competent anchor's stream, reused wherever the case is about another
 *  axis: 61 quarter turns at 100ms, stopping 200ms before ten of them →
 *  8.0s of solving, 6.0s of it turning. */
const COMPETENT = { moves: 61, turnMs: 100, pauses: 10, pauseMs: 200 } as const;

describe('calibration anchors', () => {
  it('scores a competent solve around 80', () => {
    // 60 turns against a 50-turn reference (ratio 1.20); 61 quarter turns at
    // 100ms each with ten 200ms stops → 6.0s turning out of 8.0s.
    const q = qualityFor({ refTurns: 50, userTurns: 60, turns: 60, ...COMPETENT })!;
    expect(q.turnRatio).toBeCloseTo(1.2, 6);
    expect(q.solvingMs).toBe(8000);
    expect(q.turnMs).toBe(100);
    expect(q.turningMs).toBe(6000);
    expect(q.pausingMs).toBe(2000);
    expect(q.efficiency).toBeCloseTo(74, 6);   // 100 - 130 * 0.20
    expect(q.flow).toBeCloseTo(75, 6);         // 6.0s of 8.0s
    expect(q.wasteFree).toBe(100);
    expect(q.total).toBe(80);
  });

  it('scores a tight solve in the low 90s', () => {
    // 55 turns against 52 (ratio 1.058); 51 quarter turns at 80ms with five
    // 100ms stops → 4.0s turning out of 4.5s.
    const q = qualityFor({
      refTurns: 52, userTurns: 55, turns: 55, moves: 51, turnMs: 80, pauses: 5, pauseMs: 100,
    })!;
    expect(q.efficiency).toBeCloseTo(92.5, 1);
    expect(q.flow).toBeCloseTo(88.9, 1);
    expect(q.total).toBe(93);
  });

  it('scores a sloppy solve just under 50', () => {
    // 72 turns against 50 (ratio 1.44); 73 quarter turns at 125ms but thirty
    // 600ms stops → 9.0s turning out of 27.0s, and 2.0s of it undone work.
    const q = qualityFor({
      refTurns: 50, userTurns: 72, turns: 72,
      moves: 73, turnMs: 125, pauses: 30, pauseMs: 600, wastedMs: 2000,
    })!;
    expect(q.solvingMs).toBe(27000);
    expect(q.efficiency).toBeCloseTo(42.8, 1);
    expect(q.flow).toBeCloseTo(33.3, 1);
    expect(q.wasteFree).toBeCloseTo(88.9, 1);
    expect(q.total).toBe(48);
  });
});

describe('component edges', () => {
  it('caps efficiency at 100 for matching or beating the reference', () => {
    const same = qualityFor({ refTurns: 60, userTurns: 60, turns: 60, ...COMPETENT })!;
    const better = qualityFor({ refTurns: 60, userTurns: 55, turns: 55, ...COMPETENT })!;
    expect(same.efficiency).toBe(100);
    expect(better.efficiency).toBe(100);   // never above 100, and never a bonus
  });

  it('floors efficiency at 0 once the solve is 77% over the reference', () => {
    const q = qualityFor({ refTurns: 50, userTurns: 90, turns: 90, ...COMPETENT })!;
    expect(q.turnRatio).toBeCloseTo(1.8, 6);
    expect(q.efficiency).toBe(0);
  });

  it('reads 100% fluency when the hands never stopped', () => {
    const q = qualityFor({ refTurns: 60, userTurns: 60, turns: 60, moves: 60, turnMs: 100 })!;
    expect(q.pausingMs).toBe(0);
    expect(q.flow).toBe(100);
    expect(q.total).toBe(100);
  });

  it('floors waste-free at 0 when two thirds of the solve was undone', () => {
    const q = qualityFor({ refTurns: 50, userTurns: 60, turns: 60, ...COMPETENT, wastedMs: 6000 })!;
    expect(q.wasteFree).toBe(0);
  });

  it('renormalises the weights when there is no reference', () => {
    const q = qualityFor({ turns: 60, ...COMPETENT })!;
    expect(q.efficiency).toBeNull();
    expect(q.turnRatio).toBeNull();
    // fluency 75 at weight .4, waste 100 at weight .2 → (0.4*75 + 0.2*100) / 0.6
    expect(q.total).toBe(83);
  });
});

describe('solves that are not scored at all', () => {
  it('refuses an unfinished solve', () => {
    expect(qualityFor({
      refTurns: 50, userTurns: 60, turns: 60, ...COMPETENT, finished: false,
    })).toBeNull();
  });

  it('refuses a solve with no turns or no elapsed time', () => {
    expect(qualityFor({ turns: 0, ...COMPETENT })).toBeNull();
    expect(qualityFor({ turns: 60, ...COMPETENT, solvingMs: 0 })).toBeNull();
  });
});

describe('turning vs pausing', () => {
  it('calls a constant stream all turning', () => {
    const s = turningSplit(burstyMoves(20, 120), 19 * 120)!;
    expect(s.turnMs).toBe(120);
    expect(s.pausingMs).toBe(0);
    expect(s.turningMs).toBe(2280);
  });

  it('charges only the part of a gap that is over one turn', () => {
    // 10 turns at 100ms with a single 1.0s stare in the middle.
    const moves = burstyMoves(10, 100, 1, 1000);
    const s = turningSplit(moves, moves[9].ts - moves[0].ts)!;
    expect(s.turnMs).toBe(100);
    expect(s.pausingMs).toBe(1000);      // the stare, not the turn under it
    expect(s.turningMs).toBe(900);
  });

  it('survives moves that arrived in one BLE packet', () => {
    // gan_v2 (and giiker/gocube/qiyi) hand us no device clock, so a packet
    // carrying two moves stamps both at arrival: gaps alternate 2ms / 198ms.
    // Without the 40ms floor the turn cost would be estimated at 2ms and this
    // solve would read as 2% fluency instead of "the packet held two turns".
    const moves: SolveMove[] = [];
    let ts = 1000;
    for (let i = 0; i < 21; i++) {
      if (i > 0) ts += i % 2 === 1 ? 2 : 198;
      moves.push({ m: FIXTURE_FACES[i % FIXTURE_FACES.length], ts });
    }
    const s = turningSplit(moves, ts - 1000)!;
    expect(s.turnMs).toBe(198);
    expect(s.pausingMs).toBe(0);
  });

  it('returns null without timing information', () => {
    expect(turningSplit([], 1000)).toBeNull();
    expect(turningSplit([{ m: 'R', ts: 100 }], 1000)).toBeNull();
    expect(turningSplit(burstyMoves(10, 0), 0)).toBeNull();
  });
});
