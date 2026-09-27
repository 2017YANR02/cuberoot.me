// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TimerRoomLayout, TimerRoomPlayers, TimerRoomAdmin, timerRoomPlayerName } from '@cuberoot/timer-ui';
import type { NetRoomState } from '@cuberoot/shared/timer';

it('preserves guest nicknames and WCA duplicate suffixes', () => {
  expect(timerRoomPlayerName({ name: 'Guest (alias)' }, 'zh')).toBe('Guest (alias)');
  expect(timerRoomPlayerName({ name: 'Ruimin Yan (颜瑞民) (2)', wcaId: '2017YANR02' }, 'zh')).toBe('颜瑞民 (2)');
});

it.each(['en', 'zh'] as const)('requires confirmation and contains keyboard focus in the shared %s admin dialog', async (language) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const room: NetRoomState = {
    code: '1234', revision: 1, videoGeneration: 'test', roundRoster: [], event: '333', round: 1,
    scrambles: {}, admin: 'self', syncStart: false, startAt: null, now: 1_000,
    players: { self: { name: 'Me', ph: 'idle', joined: 1, seen: 1_000, at: 0 }, other: { name: 'Guest', ph: 'idle', joined: 2, seen: 1_000, at: 0 } },
    results: {}, scores: {}, history: [],
  };
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  const host = document.createElement('div'); const root = createRoot(host);
  const kick = vi.fn(); const close = vi.fn(); const leaked = vi.fn();
  window.addEventListener('keydown', leaked);
  try {
    await act(async () => root.render(createElement(TimerRoomAdmin, { room, currentPlayerId: 'self', language, onSyncStart: vi.fn(), onTransfer: vi.fn(), onKick: kick, onClose: close })));
    const dialog = document.querySelector<HTMLElement>('.timer-room-dialog')!;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
    const remove = buttons.at(-1)!;
    await act(async () => remove.click()); expect(kick).not.toHaveBeenCalled();
    await act(async () => remove.click()); expect(kick).toHaveBeenCalledWith('other');
    await act(async () => { remove.focus(); remove.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); });
    expect(document.activeElement).toBe(buttons[0]);
    await act(async () => buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(close).toHaveBeenCalledOnce(); expect(leaked).not.toHaveBeenCalled();
    await act(async () => root.unmount()); expect(document.activeElement).toBe(trigger);
  } finally {
    window.removeEventListener('keydown', leaked); trigger.remove(); vi.unstubAllGlobals();
  }
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
