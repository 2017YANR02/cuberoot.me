// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TimerBattleHistory } from '@cuberoot/timer-ui';
import type { LocalBattleRound } from '@cuberoot/shared/timer';

vi.mock('cubing/twisty', () => ({ TwistyPlayer: class { constructor() { return document.createElement('div'); } } }));

it.each(['en', 'zh'] as const)('shows all rounds and binds confirmed deletion to the stable round id in %s', async (language) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const rounds: LocalBattleRound[] = Array.from({ length: 25 }, (_, index) => ({
    id: `round-${index}`, ts: 1_000 + index, winners: [0],
    attempts: [0, 1].map((playerId) => ({ playerId, solve: {
      id: `solve-${index}-${playerId}`, event: '333', ts: 1_000 + index,
      timeMs: 1000, penalty: playerId === 0 ? '+2' : 'DNF', scramble: "R U R'",
    } })),
  }));
  const host = document.createElement('div'); const root = createRoot(host);
  const remove = vi.fn(); const close = vi.fn(); let back: (() => void) | null = null;
  try {
    await act(async () => root.render(createElement(TimerBattleHistory, { rounds, playerCount: 2, language, precision: 3, onClose: close, onDelete: remove, onBackChange: (fn) => { back = fn; } })));
    const list = () => document.querySelectorAll<HTMLButtonElement>('.timer-battle-history-list button');
    expect(list()).toHaveLength(25);
    await act(async () => list()[0].click());
    expect(document.querySelector('.timer-battle-history-results')?.textContent).toContain('3.000+');
    expect(document.querySelector('.timer-battle-history-results')?.textContent).toContain('DNF');
    expect(document.querySelectorAll('.timer-battle-history-scramble')).toHaveLength(1);
    await act(async () => { back?.(); }); expect(list()).toHaveLength(25); expect(close).not.toHaveBeenCalled();
    await act(async () => list()[0].click());
    const deleteButton = document.querySelectorAll<HTMLButtonElement>('.timer-room-actions button')[1];
    await act(async () => deleteButton.click()); expect(remove).not.toHaveBeenCalled();
    await act(async () => deleteButton.click()); expect(remove).toHaveBeenCalledExactlyOnceWith('round-24');
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
