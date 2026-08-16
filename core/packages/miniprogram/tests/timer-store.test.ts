import { createTimerStoreData, type Solve } from '@cuberoot/shared/timer';
import { describe, expect, it } from 'vitest';

import { appendTimerSolve, loadOrCreateTimerStore } from '../src/lib/timer-store';

const environment = { nowMs: 1_700_000_000_000, id: 'session-1' };

describe('mini program timer store', () => {
  it('creates a Chinese timer store when storage is empty', () => {
    const loaded = loadOrCreateTimerStore('', environment);
    expect(loaded.recoveredFromCorruption).toBe(false);
    expect(loaded.data.settings.language).toBe('zh');
    expect(loaded.data.database.activeSessionId).toBe('session-1');
  });

  it('recovers without treating corrupt input as valid data', () => {
    const loaded = loadOrCreateTimerStore({ schemaVersion: 99 }, environment);
    expect(loaded.recoveredFromCorruption).toBe(true);
    expect(loaded.data.database.sessions).toHaveLength(1);
  });

  it('appends a solve without mutating the previous snapshot', () => {
    const original = createTimerStoreData(environment.nowMs, environment.id, 'zh');
    const solve: Solve = {
      event: '333',
      id: 'solve-1',
      penalty: 'ok',
      scramble: "R U R'",
      timeMs: 9_876,
      ts: environment.nowMs + 1,
    };
    const next = appendTimerSolve(original, solve);
    expect(original.database.dataBySession[environment.id]['333']).toBeUndefined();
    expect(next.database.dataBySession[environment.id]['333']).toEqual([solve]);
  });

  it('rejects a duplicate solve id', () => {
    const original = createTimerStoreData(environment.nowMs, environment.id, 'zh');
    const solve: Solve = {
      event: '333', id: 'same', penalty: 'ok', scramble: 'R', timeMs: 1_000, ts: 1,
    };
    const once = appendTimerSolve(original, solve);
    expect(() => appendTimerSolve(once, { ...solve, ts: 2 })).toThrow('Duplicate solve id');
  });
});
