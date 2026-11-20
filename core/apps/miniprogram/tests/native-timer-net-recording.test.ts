import { describe, expect, it, vi } from 'vitest';
import { netAttemptSolveId, type NetRecordedAttempt } from '@cuberoot/shared/timer/net-attempt';
import { NativeTimer } from '../src/lib/native-timer';

function fixture() {
  let fail = false;
  const storage = new Map<string, unknown>();
  const timer = new NativeTimer({
    getStorageSync: key => storage.get(key),
    removeStorageSync: key => { storage.delete(key); },
    setStorageSync: (key, value) => {
      if (fail) throw new Error('storage failure');
      storage.set(key, structuredClone(value));
    },
  });
  timer.setManualScrambles('R U');
  const identity = { code: '4815', playerId: 'player1', round: 1 };
  const id = netAttemptSolveId(identity), ts = Date.now();
  const record: NetRecordedAttempt = {
    context: { ...identity, sessionId: timer.activeSessionId, id, ts, event: '333', scramble: 'R U' },
    solve: { id, ts, event: '333', scramble: 'R U', timeMs: 1234, penalty: 'ok' },
  };
  const backup = timer.onPersistedSolve = vi.fn();
  return { timer, record, backup, setFailure: (next: boolean) => { fail = next; } };
}

describe('native online solve storage', () => {
  it('saves into the captured group and updates the original row after it is moved', () => {
    const { timer, record, backup } = fixture();
    const group = timer.activeSessionId;
    try {
      expect(timer.createSession('Other group')).toBe(true);
      const other = timer.activeSessionId;
      timer.recordNetSolve(record);
      expect(timer.records).toEqual([]);
      expect(timer.selectSession(group)).toBe(true);
      expect(timer.records).toEqual([record.solve]);
      timer.updateComment(record.solve.id, 'Keep this note');
      expect(timer.moveResult(record.solve.id, other)).toBe(true);
      timer.recordNetSolve({ ...record, solve: { ...record.solve, penalty: '+2' } });
      expect(timer.records).toEqual([]);
      expect(timer.selectSession(other)).toBe(true);
      expect(timer.records).toEqual([{ ...record.solve, penalty: '+2', comment: 'Keep this note' }]);
      expect(backup).toHaveBeenCalledOnce();
    } finally { timer.dispose(); }
  });

  it('keeps the result in memory on write failure and counts the first successful write only', () => {
    const { timer, record, backup, setFailure } = fixture();
    try {
      setFailure(true);
      expect(() => timer.recordNetSolve(record)).toThrow();
      expect(timer.error).not.toBe('');
      expect(timer.records).toEqual([record.solve]);
      expect(backup).not.toHaveBeenCalled();
      setFailure(false);
      expect(timer.persist()).toBe(true);
      expect(backup).toHaveBeenCalledOnce();
      timer.recordNetSolve(record);
      expect(timer.records).toHaveLength(1);
      expect(backup).toHaveBeenCalledOnce();
    } finally { timer.dispose(); }
  });
});
