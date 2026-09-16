// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TRAINING_STATS_KEY, EMPTY_TRAINING_STATS, addTrainingAttempt, parseTrainingStats,
  getTrainingStatsSnapshot, getTrainingStatsServerSnapshot, recordTrainingAttempt,
  resetTrainingStats, subscribeTrainingStats, trainingStatsUnsaved,
} from '@/lib/training-stats';

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  // Force a fresh storage snapshot even after a previous test simulated a failed write.
  localStorage.setItem(TRAINING_STATS_KEY, JSON.stringify({ fixture: { total: 0 } }));
  getTrainingStatsSnapshot();
});

describe('shared training statistics', () => {
  it('retains legacy Cross counts without inventing timing samples', () => {
    const stats = parseTrainingStats('{"guess:cross":{"total":12,"correct":9,"wrong":3}}')['guess:cross'];
    expect(stats.total).toBe(12);
    expect(stats.correct).toBe(9);
    expect(stats.wrong).toBe(3);
    expect(stats.timed).toBe(0);
    expect(stats.bestMs).toBe(null);
    const next = addTrainingAttempt(stats, { id: 'new', at: 1, correct: true, durationMs: 2400 });
    expect(next.total).toBe(13);
    expect(next.totalMs / next.timed).toBe(2400);
  });

  it('does not turn an incorrect attempt into a correct one on retry or replay', () => {
    const failed = addTrainingAttempt(EMPTY_TRAINING_STATS, { id: 'one', at: 1, correct: false, durationMs: 3000 });
    const replay = addTrainingAttempt(failed, { id: 'one', at: 2, correct: true, durationMs: 4000 });
    expect(replay).toBe(failed);
    expect(replay.total).toBe(1);
    expect(replay.correct).toBe(0);
    expect(replay.wrong).toBe(1);
  });

  it('keeps ungraded timed solves out of accuracy and missing times out of averages', () => {
    let stats = addTrainingAttempt(EMPTY_TRAINING_STATS, { id: '1', at: 1, correct: null, durationMs: 2100 });
    stats = addTrainingAttempt(stats, { id: '2', at: 2, correct: true });
    stats = addTrainingAttempt(stats, { id: '3', at: 3, correct: false, durationMs: 900 });
    expect(stats.total).toBe(3);
    expect(stats.correct).toBe(1);
    expect(stats.wrong).toBe(1);
    expect(stats.timed).toBe(2);
    expect(stats.totalMs / stats.timed).toBe(1500);
    expect(stats.bestMs).toBe(900);
  });

  it('bounds recent history without truncating cumulative totals', () => {
    let stats = EMPTY_TRAINING_STATS;
    for (let i = 0; i < 80; i++) stats = addTrainingAttempt(stats, { id: `${i}`, at: i, correct: true, durationMs: 1000 });
    expect(stats.total).toBe(80);
    expect(stats.correct).toBe(80);
    expect(stats.recent.length).toBe(50);
    expect(stats.recent[0].id).toBe('30');
    expect(stats.totalMs).toBe(80000);
  });

  it('isolates groups and resets only the requested group', () => {
    recordTrainingAttempt('color', { id: '1', at: 1, correct: false });
    recordTrainingAttempt('predict', { id: '2', at: 2, correct: true });
    resetTrainingStats('predict');
    const stored = parseTrainingStats(localStorage.getItem(TRAINING_STATS_KEY));
    expect(stored.color.wrong).toBe(1);
    expect(stored.predict.total).toBe(0);
    expect(getTrainingStatsSnapshot()).toBe(getTrainingStatsSnapshot());
    expect(getTrainingStatsServerSnapshot()).toEqual({});
  });

  it('reads cross-tab changes before appending and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTrainingStats(listener);
    localStorage.setItem(TRAINING_STATS_KEY, '{"color":{"total":2,"correct":1,"wrong":1}}');
    window.dispatchEvent(new StorageEvent('storage', { key: TRAINING_STATS_KEY }));
    recordTrainingAttempt('color', { id: '3', at: 3, correct: true });
    expect(getTrainingStatsSnapshot().color.total).toBe(3);
    expect(getTrainingStatsSnapshot().color.correct).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('retains multiple in-memory answers and reports persistence failure', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    recordTrainingAttempt('color', { id: '1', at: 1, correct: true });
    recordTrainingAttempt('color', { id: '2', at: 2, correct: false });
    expect(getTrainingStatsSnapshot().color.total).toBe(2);
    expect(trainingStatsUnsaved()).toBe(true);
  });

  it('rejects corrupt records and invalid durations without NaN totals', () => {
    for (const raw of ['null', '[]', 'invalid']) expect(parseTrainingStats(raw)).toEqual({});
    const stats = parseTrainingStats('{"bad":{"total":3,"correct":9,"wrong":4,"recent":[null,{}]}}').bad;
    expect(stats.correct).toBe(3);
    expect(stats.wrong).toBe(0);
    expect(stats.recent).toEqual([]);
    const next = addTrainingAttempt(stats, { id: 'n', at: 1, correct: null, durationMs: NaN });
    expect(next.timed).toBe(0);
    expect(next.totalMs).toBe(0);
  });
});
