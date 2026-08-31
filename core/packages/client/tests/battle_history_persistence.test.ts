/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistenceControl = vi.hoisted(() => ({ allow: true }));

vi.mock('@/lib/safe-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/safe-storage')>();
  return {
    ...actual,
    persistItem: (key: string, value: string) => (
      persistenceControl.allow && actual.persistItem(key, value)
    ),
  };
});
vi.mock('@/app/[lang]/timer/_battle/engine/engine_loader', () => ({
  isScrambleEngineReady: () => true,
  loadScrambleEngine: () => Promise.resolve(),
}));
vi.mock('@/app/[lang]/timer/_battle/engine/scramble_engine', () => ({
  generateScramble: () => "R U R' U'",
  generateScrambleImageUrl: () => null,
}));
vi.mock('@/app/[lang]/timer/_lib/scramble/wca_pool', () => ({
  hasWcaSource: () => false,
  peekWca: () => null,
  nextWca: () => Promise.resolve(null),
  prefetchWca: () => {},
  wcaMetaFor: () => null,
}));

localStorage.clear();
const { filterUnpairedLegacyBattleRecords, loadLegacyBattleRecords, useBattleStore } = await import(
  '@/app/[lang]/timer/_battle/engine/battle_store'
);
const { buildLocalBattleCsv } = await import(
  '@/app/[lang]/timer/_battle/VsHistoryPanel'
);

beforeEach(() => {
  persistenceControl.allow = true;
  localStorage.clear();
  useBattleStore.setState({
    mode: '1v1',
    sessionId: '1',
    playerCount: 2,
    puzzleIds: ['333', '333', '333', '333'],
    battleRounds: [],
    battleHistoryWarning: null,
  });
});

describe('atomic local-battle persistence', () => {
  it('Reset All removes every legacy event/player key and the recovery copy', () => {
    localStorage.setItem('battle_1v1_history_1_222_0', '[{"time":1000}]');
    localStorage.setItem('battle_1v1_history_1_333_3', '[{"time":2000}]');
    localStorage.setItem('battle_rounds_v1_1', '[{"id":"old"}]');
    localStorage.setItem('battle_rounds_v1_recovery_1', 'damaged raw bytes');

    useBattleStore.getState().resetAll();

    expect(localStorage.getItem('battle_1v1_history_1_222_0')).toBeNull();
    expect(localStorage.getItem('battle_1v1_history_1_333_3')).toBeNull();
    expect(localStorage.getItem('battle_rounds_v1_recovery_1')).toBeNull();
    expect(localStorage.getItem('battle_rounds_v1_1')).toBe('[]');
  });

  it('surfaces a failed canonical write and clears it after a successful retry', () => {
    persistenceControl.allow = false;
    useBattleStore.getState().saveSolveHistory();
    expect(useBattleStore.getState().battleHistoryWarning).toBe('write-failed');

    persistenceControl.allow = true;
    useBattleStore.getState().saveSolveHistory();
    expect(useBattleStore.getState().battleHistoryWarning).toBeNull();
  });

  it('keeps valid legacy keys visible when a different key is damaged', () => {
    localStorage.setItem('battle_1v1_history_1_222_0', JSON.stringify([{
      time: 1234,
      penalty: 'ok',
      scramble: 'R U',
      date: '2026-08-31T00:00:00.000Z',
    }]));
    localStorage.setItem('battle_1v1_history_1_333_1', '{broken');

    const loaded = loadLegacyBattleRecords('1');
    expect(loaded.records).toMatchObject([{
      event: '222',
      playerId: 0,
      entry: { time: 1234, scramble: 'R U' },
    }]);
    expect(loaded.skippedKeys).toBe(1);
  });

  it('hides exact atomic mirrors without hiding a same-time record from another event', () => {
    const entry = {
      time: 1234,
      penalty: 'ok' as const,
      scramble: 'R U',
      date: '2026-08-31T00:00:00.000Z',
    };
    const records = [
      { event: '222' as const, playerId: 0, entry },
      { event: '333' as const, playerId: 0, entry },
    ];
    const rounds = [{
      id: 'round-1',
      ts: Date.parse(entry.date),
      attempts: [
        { playerId: 0, solve: { id: 'a', timeMs: 1234, penalty: 'ok' as const, scramble: 'R U', event: '222' as const, ts: Date.parse(entry.date) } },
        { playerId: 1, solve: { id: 'b', timeMs: 1500, penalty: 'ok' as const, scramble: 'F R', event: '333' as const, ts: Date.parse(entry.date) } },
      ],
      winners: [0],
    }];

    expect(filterUnpairedLegacyBattleRecords(records, rounds)).toEqual([records[1]]);
  });

  it('exports raw milliseconds, event identity, round id, legacy rows, and RFC-escaped text', () => {
    const ts = Date.parse('2026-08-31T00:00:00.000Z');
    const csv = buildLocalBattleCsv([{
      id: 'round-csv',
      ts,
      attempts: [
        { playerId: 0, solve: { id: 'a', timeMs: 1234, penalty: 'ok', scramble: 'R,U\n"x"', event: '222', ts } },
        { playerId: 1, solve: { id: 'b', timeMs: 5678, penalty: '+2', scramble: 'R,U\n"x"', event: '333', ts } },
      ],
      winners: [0],
    }], [{
      event: '333',
      playerId: 1,
      entry: { time: 9000, penalty: 'dnf', scramble: 'F,R', date: '2026-08-30T00:00:00.000Z' },
    }], 2);

    expect(csv).toContain('Round ID,P1 Event,Player1(ms)');
    expect(csv).toContain('round-csv,222,1234,ok,"R,U\n""x""",333,5678,+2');
    expect(csv).toContain('legacy,,,');
    expect(csv).not.toContain('1.234');
  });
});
