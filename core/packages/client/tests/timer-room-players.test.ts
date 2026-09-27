// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TimerRoomLayout, TimerRoomPlayers, timerRoomPlayerName } from '@cuberoot/timer-ui';
import type { NetRoomState } from '@cuberoot/shared/timer';

it('preserves guest nicknames and WCA duplicate suffixes', () => {
  expect(timerRoomPlayerName({ name: 'Guest (alias)' }, 'zh')).toBe('Guest (alias)');
  expect(timerRoomPlayerName({ name: 'Ruimin Yan (颜瑞民) (2)', wcaId: '2017YANR02' }, 'zh')).toBe('颜瑞民 (2)');
});

it.each(['en', 'zh'] as const)('shares room order, results and live/rename actions in %s', async (language) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const room: NetRoomState = {
    code: '1234', revision: 1, videoGeneration: 'test', roundRoster: [], event: '333', round: 1,
    scrambles: { '333': 'R U' }, admin: 'self', syncStart: false, startAt: null, now: 1_000,
    players: {
      self: { name: 'Guest (alias)', ph: 'idle', joined: 1, seen: 1_000, at: 0 },
      other: { name: 'Other', ph: 'solving', joined: 2, seen: 1_000, at: 100 },
    },
    results: { '1': { self: { t: 1_000, p: '+2' } } }, scores: { self: 2 }, history: [],
  };
  const rename = vi.fn(); const view = vi.fn();
  const host = document.createElement('div'); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(TimerRoomLayout, {
      players: createElement(TimerRoomPlayers, {
        room, currentPlayerId: 'self', language, precision: 3, nowMs: 1_100,
        onRename: rename, onViewPlayer: view, canViewPlayer: (id) => id === 'other',
        runningTime: (id, ms) => createElement('span', { id: `live-${id}` }, String(ms)),
      }), children: 'timer',
    })));
    expect(host.firstElementChild?.firstElementChild?.className).toContain('timer-room-players');
    expect(host.querySelector('.timer-room-player.is-me')?.textContent).toContain('3.000+');
    expect(host.querySelector('#live-other')?.textContent).toBe('1000');
    await act(async () => host.querySelector<HTMLButtonElement>('button.timer-room-player-name')!.click());
    expect(rename).toHaveBeenCalledWith('Guest (alias)');
    await act(async () => host.querySelector<HTMLButtonElement>('.timer-room-player-view')!.click());
    expect(view).toHaveBeenCalledWith('other');
  } finally {
    await act(async () => root.unmount()); vi.unstubAllGlobals();
  }
});
