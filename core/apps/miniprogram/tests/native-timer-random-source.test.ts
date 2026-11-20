import { beforeEach, describe, expect, it, vi } from 'vitest';
import { solvedCubie } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { trainerSpecOf } from '@cuberoot/shared/timer/random-difficulty';
import { NativeTimer } from '../src/lib/native-timer';
import type { NativeRandomDifficultyNext } from '../src/lib/native-timer-random-difficulty';

const adapter = vi.hoisted(() => ({ next: vi.fn(), solve: vi.fn(), retry: vi.fn(), release: vi.fn() }));
vi.mock('../src/lib/native-timer-random-difficulty', () => ({ createNativeTimerRandomDifficulty: () => adapter }));

function fixture() {
  const data = new Map<string, unknown>();
  const storage = {
    getStorageSync: (key: string) => data.get(key),
    setStorageSync: vi.fn((key: string, value: unknown) => { data.set(key, structuredClone(value)); }),
    removeStorageSync: (key: string) => { data.delete(key); },
  };
  return { timer: new NativeTimer(storage), storage };
}

describe('native timer random difficulty lifecycle', () => {
  beforeEach(() => vi.resetAllMocks());

  it('stores the case with its history slot and refreshes only when the effective difficulty changes', async () => {
    const { timer } = fixture();
    const settings = { ...timer.settings, genDiffOn: true, genDiffSteps: [4, 5, 6] };
    const spec = trainerSpecOf('333', settings)!;
    const first = { scramble: 'R U', spec, depth: 4, state: solvedCubie() };
    const second = { scramble: 'F D', spec, depth: 6, state: solvedCubie() };
    adapter.next.mockResolvedValueOnce({ kind: 'ready', result: first })
      .mockResolvedValueOnce({ kind: 'ready', result: second })
      .mockResolvedValue({ kind: 'empty' });
    try {
      timer.updateSettings(settings);
      expect(timer.randomDifficultyStatus).toBe('working');
      await vi.waitFor(() => expect(timer.randomDifficultyResult).toBe(first));
      timer.updateSettings({ timerFontScale: 1.2 });
      expect(adapter.next).toHaveBeenCalledTimes(1);

      timer.nextScramble();
      await vi.waitFor(() => expect(timer.randomDifficultyResult).toBe(second));
      timer.previousScramble();
      expect(timer.randomDifficultyResult).toBe(first);
      timer.nextScramble();
      expect(timer.randomDifficultyResult).toBe(second);
      expect(adapter.next).toHaveBeenCalledTimes(2);

      expect(timer.manualEntry('10')).toBe(true);
      expect(timer.records[0]?.scrambleSource).toMatchObject({ kind: 'random', identity: expect.stringContaining('difficulty:') });
      timer.updateSettings({ genDiffSteps: [5] });
      await vi.waitFor(() => expect(timer.randomDifficultyStatus).toBe('empty'));
      expect(timer.canPrevious).toBe(false);
      expect(timer.scramble).toBe('');
    } finally {
      timer.dispose();
    }
  });

  it('drops stale generation after switching source and reopens the saved source and queue', async () => {
    const { timer, storage } = fixture();
    let deliver!: (outcome: NativeRandomDifficultyNext) => void;
    adapter.next.mockImplementationOnce(() => new Promise(resolve => { deliver = resolve; }));
    try {
      timer.updateSettings({ genDiffOn: true });
      expect(timer.loading).toBe(true);
      const spec = trainerSpecOf('333', timer.settings)!;
      timer.setManualScrambles('R\nU');
      deliver({ kind: 'ready', result: { scramble: 'F', depth: spec.lo, spec, state: solvedCubie() } });
      await Promise.resolve();
      expect(timer.scramble).toBe('R');
      expect(timer.randomDifficultyStatus).toBe('idle');
      expect(timer.randomDifficultyResult).toBe(null);

      const reopened = new NativeTimer(storage);
      try {
        expect(reopened.currentSource).toBe('manual');
        reopened.nextScramble();
        expect(reopened.scramble).toBe('R');
        const backup = reopened.exportBackup();
        reopened.setManualScrambles('D\nF');
        expect(reopened.scramble).toBe('D');
        expect(reopened.restoreBackup(backup)).toBe(true);
        expect(reopened.currentSource).toBe('manual');
        expect(reopened.scramble).toBe('R');
        reopened.updateSettings({ genDiffOn: false });
        reopened.useRandomScrambles();
        expect(new NativeTimer(storage).currentSource).toBe('random');
      } finally {
        reopened.dispose();
      }
    } finally {
      timer.dispose();
    }
  });

  it('checks the event captured by the clear dialog and rolls back failed clears and imports', () => {
    const { timer, storage } = fixture();
    try {
      timer.updateSettings({ autoSessionForEvent: false, autoEventForSession: false });
      timer.setManualScrambles('R');
      expect(timer.manualEntry('10')).toBe(true);
      const sessionId = timer.sessions.activeSessionId;
      timer.selectEvent('222');
      expect(timer.manualEntry('3')).toBe(true);
      expect(timer.clearCurrentEvent(sessionId, '333')).toBe(false);
      expect(timer.records).toHaveLength(2);
      storage.setStorageSync.mockImplementationOnce(() => { throw new Error('disk full'); });
      expect(timer.clearCurrentEvent(sessionId, '222')).toBe(false);
      expect(timer.records).toHaveLength(2);
      expect(timer.clearCurrentEvent(sessionId, '222')).toBe(true);
      expect(timer.records.map(solve => solve.event)).toEqual(['333']);

      const imported = [{ name: 'Imported', event: '333' as const, solves: [{ ...timer.records[0]!, id: 'fixture-import' }] }];
      const groupCount = timer.sessions.sessions.length;
      storage.setStorageSync.mockImplementationOnce(() => { throw new Error('disk full'); });
      expect(timer.importSessions(imported)).toBe(false);
      expect(timer.sessions.sessions).toHaveLength(groupCount);
      expect(timer.importSessions(imported)).toBe(true);
      expect(timer.sessions.sessions).toHaveLength(groupCount + 1);
      expect(timer.sessions.activeSessionId).toBe(sessionId);
    } finally {
      timer.dispose();
    }
  });
});
