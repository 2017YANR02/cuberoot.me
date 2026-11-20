import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalBattleRoundStore, LOCAL_BATTLE_ROUNDS_STORAGE_KEY } from '@cuberoot/shared/timer/local-battle';
import type { LocalBattleScramble } from '@cuberoot/shared/timer/local-battle-scramble';
import { createNativeTimerLocalBattle } from '../src/lib/native-timer-local-battle';

afterEach(() => vi.useRealTimers());

function memory() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: (key: string) => { data.delete(key); },
  };
  return { storage, data };
}

describe('native local battle', () => {
  it('pairs independent touches, stores both attempts once and edits penalties in the same round', async () => {
    vi.useFakeTimers();
    let now = 1000;
    const { storage } = memory();
    const source = { kind: 'wca', identity: 'official-fixture' } as const;
    const requestScramble = vi.fn()
      .mockResolvedValueOnce({ scramble: 'R U', source })
      .mockResolvedValue({ scramble: 'F2' });
    const battle = createNativeTimerLocalBattle({ storage, requestScramble, now: () => now, settings: () => ({ holdMs: 100 }) });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(battle.snapshot().players.map(player => player.scramble)).toEqual(['R U', 'R U']);
      expect(requestScramble).toHaveBeenCalledTimes(1);
      expect(battle.down(0, 10)).toBe(true);
      expect(battle.down(1, 10)).toBe(false);
      expect(battle.down(1, 20)).toBe(true);
      expect(battle.up(0, 20)).toBe(false);
      await vi.advanceTimersByTimeAsync(100);
      expect(battle.snapshot().players.map(player => player.phase)).toEqual(['ready', 'ready']);
      now = 1100;
      expect(battle.up(0, 10)).toBe(true);
      now = 1200;
      expect(battle.up(1, 20)).toBe(true);
      now = 2400;
      expect(battle.down(0, 10)).toBe(true);
      expect(battle.snapshot().players.map(player => player.display)).toEqual(['1.300', '1.200']);
      expect(storage.setItem).not.toHaveBeenCalled();
      battle.up(0, 10);
      now = 2650;
      expect(battle.down(1, 20)).toBe(true);
      battle.up(1, 20);
      await battle.flush();
      expect(battle.snapshot().winners).toEqual([0]);
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(storage.setItem.mock.calls[0][0]).toBe(LOCAL_BATTLE_ROUNDS_STORAGE_KEY);
      const original = (await createLocalBattleRoundStore(storage).load())[0];
      expect(original.attempts.map(({ solve }) => [solve.timeMs, solve.scramble, solve.scrambleSource])).toEqual([
        [1300, 'R U', source], [1450, 'R U', source],
      ]);
      expect(battle.setPenalty(0, '+2')).toBe(true);
      await battle.flush();
      const history = await createLocalBattleRoundStore(storage).load();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ id: original.id, winners: [1] });
      expect(history[0].attempts[0].solve.penalty).toBe('+2');
      await vi.advanceTimersByTimeAsync(0);
      expect(battle.snapshot().players.map(player => player.scramble)).toEqual(['F2', 'F2']);
      expect(battle.next()).toBe(true);
      expect(battle.snapshot().players.map(player => player.result)).toEqual([null, null]);
      expect(requestScramble).toHaveBeenCalledTimes(2);
    } finally { battle.dispose(); }
  });

  it('keeps one current source for four players and ignores older or rejected loads', async () => {
    vi.useFakeTimers();
    const { storage } = memory();
    const pending: Array<{ signal: AbortSignal; finish: (row: LocalBattleScramble) => void }> = [];
    const battle = createNativeTimerLocalBattle({
      playerCount: 4, storage,
      requestScramble: (_event, signal) => new Promise(finish => pending.push({ signal, finish })),
    });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(battle.snapshot()).toMatchObject({ playerCount: 4, loading: true });
      expect(battle.setEvent('222')).toBe(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(pending[0].signal.aborted).toBe(true);
      pending[0].finish({ scramble: "R U'" });
      pending[1].finish({ scramble: '⚠️ missing' });
      await vi.advanceTimersByTimeAsync(0);
      expect(battle.snapshot()).toMatchObject({ event: '222', scramble: '', scrambleFailed: true, loading: false });
      expect(battle.down(0, 5)).toBe(false);
      expect(battle.retry()).toBe(true);
      await vi.advanceTimersByTimeAsync(0);
      pending[2].finish({ scramble: 'R2 U' });
      await vi.advanceTimersByTimeAsync(0);
      expect(battle.snapshot().players.map(player => player.scramble)).toEqual(Array(4).fill('R2 U'));
    } finally { battle.dispose(); }
  });
});
