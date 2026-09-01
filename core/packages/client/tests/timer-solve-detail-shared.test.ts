import {
  timerSolveDetailBldTimes,
  timerSolveDetailStageRows,
  type Solve,
} from '@cuberoot/shared/timer';
import { describe, expect, it } from 'vitest';

function solve(patch: Partial<Solve> = {}): Solve {
  return {
    event: '333',
    id: 'solve-1',
    penalty: 'ok',
    scramble: "R U R'",
    timeMs: 10_000,
    ts: 1_700_000_000_000,
    ...patch,
  };
}

describe('shared solve detail projections', () => {
  it('derives canonical stage durations without rewriting the stored solve', () => {
    const input = solve({
      stages: { cross: 2_000, f2l: 8_000, oll: 9_000, pll: 9_500 },
    });
    expect(timerSolveDetailStageRows(input)).toEqual([
      { id: 'cross', cumulativeMs: 2_000, durationMs: 2_000 },
      { id: 'f2l', cumulativeMs: 8_000, durationMs: 6_000 },
      { id: 'oll', cumulativeMs: 9_000, durationMs: 1_000 },
      { id: 'pll', cumulativeMs: 10_000, durationMs: 1_000 },
    ]);
    expect(input.stages?.pll).toBe(9_500);
  });

  it('clamps dirty and partial legacy stages to monotonic raw time', () => {
    expect(timerSolveDetailStageRows(solve({
      stages: { cross: 5_000, f2l: 4_000, oll: 12_000, pll: 99_999 },
    }))).toEqual([
      { id: 'cross', cumulativeMs: 5_000, durationMs: 5_000 },
      { id: 'f2l', cumulativeMs: 5_000, durationMs: 0 },
      { id: 'oll', cumulativeMs: 10_000, durationMs: 5_000 },
      { id: 'pll', cumulativeMs: 10_000, durationMs: 0 },
    ]);
    expect(timerSolveDetailStageRows(solve({
      stages: { oll: 8_000, pll: 20_000 },
    }))).toEqual([
      { id: 'cross', cumulativeMs: null, durationMs: null },
      { id: 'f2l', cumulativeMs: null, durationMs: null },
      { id: 'oll', cumulativeMs: 8_000, durationMs: 8_000 },
      { id: 'pll', cumulativeMs: 10_000, durationMs: 2_000 },
    ]);
  });

  it('fails closed for non-finite split data and clamps blindfold memo', () => {
    expect(timerSolveDetailStageRows(solve({
      stages: { cross: Number.NaN, f2l: Number.POSITIVE_INFINITY, oll: -10, pll: 1 },
    }))).toEqual([
      { id: 'cross', cumulativeMs: null, durationMs: null },
      { id: 'f2l', cumulativeMs: null, durationMs: null },
      { id: 'oll', cumulativeMs: 0, durationMs: 0 },
      { id: 'pll', cumulativeMs: 10_000, durationMs: 10_000 },
    ]);
    expect(timerSolveDetailBldTimes(solve({ bld: { memoMs: 12_000 } }))).toEqual({
      executionMs: 0,
      memoMs: 10_000,
      totalMs: 10_000,
    });
    expect(timerSolveDetailBldTimes(solve({ bld: { memoMs: Number.NaN } }))).toEqual({
      executionMs: 10_000,
      memoMs: 0,
      totalMs: 10_000,
    });
  });
});
