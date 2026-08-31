import { describe, expect, it, vi } from 'vitest';

import {
  createMobileNetBattleSessionStore,
  decodeMobileNetBattleSession,
  type MobileNetBattleSession,
} from './mobile-net-battle';

const SESSION: MobileNetBattleSession = {
  code: '0427',
  name: 'Cuber',
  playerId: 'player1234',
  playerToken: 'a'.repeat(43),
};

describe('mobile online-battle session', () => {
  it('accepts a complete capability and rejects legacy public-pid sessions', () => {
    expect(decodeMobileNetBattleSession(SESSION)).toEqual(SESSION);
    expect(decodeMobileNetBattleSession({ code: '0427', name: 'Cuber', playerId: 'player1234' })).toBeNull();
  });

  it('reuses the injected secure store for save, restore, and atomic clear', async () => {
    let value: string | null = null;
    const storage = {
      getItem: vi.fn(async () => value),
      setItem: vi.fn(async (_key: string, next: string) => { value = next; }),
      removeItem: vi.fn(async () => { value = null; }),
    };
    const store = createMobileNetBattleSessionStore(storage);

    await store.save(SESSION);
    expect(await store.load()).toEqual(SESSION);
    await store.clear();
    expect(await store.load()).toBeNull();
    expect(storage.setItem).toHaveBeenCalledWith('net_battle_session', JSON.stringify(SESSION));
    expect(storage.removeItem).toHaveBeenCalledWith('net_battle_session');
  });
});
