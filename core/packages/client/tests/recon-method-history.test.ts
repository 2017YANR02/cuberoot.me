// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import type { Solve } from '@cuberoot/shared/timer';
import { walkMethod } from '@cuberoot/shared/timer/reconstruct/method-walk';
import { cachedMethodStages, rememberMethodStages, methodHistoryWindow, methodStageAverages } from '@cuberoot/timer-ui/reconstruct/method-history';

const solve: Solve = { id: 'one', event: '333', ts: 100, timeMs: 1000, penalty: 'ok', scramble: 'R', moves: [{ m: "R'", ts: 500 }] };
beforeEach(() => localStorage.clear());

it('persists stages by method and invalidates every physical input change', () => {
  const stages = walkMethod('roux', solve.scramble, solve.moves!, solve.timeMs)!.stages;
  rememberMethodStages(solve, 'roux', stages);
  expect(cachedMethodStages(solve, 'roux')).toEqual(stages);
  expect(cachedMethodStages(solve, 'zz')).toBeNull();
  for (const patch of [{ scramble: 'U' }, { timeMs: 1001 }, { gyro: 'changed' }, { moves: [{ m: "R'", ts: 501 }] }]) {
    expect(cachedMethodStages({ ...solve, ...patch }, 'roux')).toBeNull();
  }
  localStorage.setItem('cuberoot.reconstruction.stage-cache.v1', 'invalid');
  expect(cachedMethodStages(solve, 'roux')).toBeNull();
});

it('compares only prior same-event non-DNF recordings, excluding the current solve', () => {
  const history = Array.from({ length: 15 }, (_, i) => ({ ...solve, id: `old-${i}`, ts: i }));
  const selected = methodHistoryWindow([...history, solve, { ...solve, id: 'future', ts: 101 },
    { ...solve, id: 'dnf', penalty: 'DNF' }, { ...solve, id: 'other', event: '222' }, { ...solve, id: 'manual', moves: undefined }], solve);
  expect(selected).toHaveLength(12);
  expect(selected.map(item => item.id)).toEqual(history.slice(3).reverse().map(item => item.id));
});

it('requires five samples per stage and does not turn missing stages into zero', () => {
  const stages = walkMethod('roux', solve.scramble, solve.moves!, solve.timeMs)!.stages;
  expect(methodStageAverages(Array(4).fill(stages))).toEqual({});
  const samples = Array.from({ length: 5 }, (_, i) => stages.map(stage => ({ ...stage, stepMs: stage.key === 'fb' ? (i + 1) * 100 : null })));
  expect(methodStageAverages(samples)).toEqual({ fb: 300 });
});
