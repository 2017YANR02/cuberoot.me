// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TimerRoomLayout, TimerRoomPlayers, TimerRoomAdmin, TimerRoomDialog, TimerRoomHistory, TimerRoomRoundStatus, TimerRoomToolbar, timerRoomPlayerName } from '@cuberoot/timer-ui';
import type { NetRoomState } from '@cuberoot/shared/timer';

it('preserves guest nicknames and WCA duplicate suffixes', () => {
  expect(timerRoomPlayerName({ name: 'Guest (alias)' }, 'zh')).toBe('Guest (alias)');
  expect(timerRoomPlayerName({ name: 'Ruimin Yan (颜瑞民) (2)', wcaId: '2017YANR02' }, 'zh')).toBe('颜瑞民 (2)');
});

it('shares ready, waiting, result correction and next-round actions', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const room: NetRoomState = {
    code: '1234', revision: 1, videoGeneration: 'test', roundRoster: [], event: '333', round: 1,
    scrambles: {}, admin: 'self', syncStart: true, startAt: null, now: 1_000,
    players: { self: { name: 'Me', ph: 'idle', joined: 1, seen: 1_000, at: 0 }, other: { name: 'Guest', ph: 'idle', joined: 2, seen: 1_000, at: 0 } },
    results: {}, scores: {}, history: [],
  };
  const host = document.createElement('div'); const root = createRoot(host);
  const ready = vi.fn(); const next = vi.fn(); const penalty = vi.fn();
  const render = () => act(async () => root.render(createElement(TimerRoomRoundStatus, {
    room, currentPlayerId: 'self', language: 'en', idle: true, countdown: false, onPenalty: penalty, onReady: ready, onNext: next,
  })));
  try {
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-pressed="false"]')!.click());
    expect(ready).toHaveBeenCalledOnce();
    room.results['1'] = { self: { t: 1000, p: 'ok' } }; await render();
    expect(host.textContent).toContain('Waiting for others to finish (1 left)');
    await act(async () => [...host.querySelectorAll('button')].find((button) => button.textContent === '+2')!.click());
    expect(penalty).toHaveBeenCalledWith('+2');
    const skip = host.querySelector<HTMLButtonElement>('.timer-room-warning-action')!;
    await act(async () => skip.click());
    expect(next).not.toHaveBeenCalled();
    expect(skip.textContent).toBe('Confirm skipping unfinished solves');
    await act(async () => skip.click());
    expect(next).toHaveBeenCalledExactlyOnceWith(true);
    await act(async () => skip.click()); // A newly armed skip becomes a normal next-round action as soon as everyone finishes.
    room.results['1'].other = { t: 2000, p: 'dnf' }; await render();
    expect(host.textContent).toContain('Me');
    await act(async () => host.querySelector<HTMLButtonElement>('.timer-room-actions button')!.click()); expect(next).toHaveBeenLastCalledWith(false);
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

it('confirms leaving a populated or scored room, expires on blur and timeout, and leaves a fresh solo room directly', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const player = { name: 'Me', ph: 'idle' as const, joined: 1, seen: 1_000, at: 0 };
  const room: NetRoomState = {
    code: '1234', revision: 1, videoGeneration: 'test', roundRoster: [], event: '333', round: 1,
    scrambles: {}, admin: 'self', syncStart: false, startAt: null, now: 1_000,
    players: { self: player, other: { ...player, name: 'Other' } }, results: {}, scores: {}, history: [],
  };
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const leave = vi.fn();
  const render = () => act(async () => root.render(createElement(TimerRoomToolbar, {
    room, copied: false, copyKind: 'invite', language: 'en', onLeave: leave, onCopy: vi.fn(), onQr: vi.fn(), onHistory: vi.fn(),
  })));
  const leaveButton = () => host.querySelector<HTMLButtonElement>('.timer-room-actions button:last-child')!;
  const clickLeave = () => act(async () => leaveButton().click());
  try {
    await render();
    await act(async () => leaveButton().focus());
    await clickLeave();
    expect(leave).not.toHaveBeenCalled();
    expect(leaveButton().textContent).toBe('Confirm leaving the room');
    await act(async () => leaveButton().blur());
    expect(leaveButton().getAttribute('aria-label')).toBe('Leave room');
    await clickLeave();
    await act(async () => vi.advanceTimersByTime(4_000));
    expect(leaveButton().getAttribute('aria-label')).toBe('Leave room');
    await clickLeave();
    await clickLeave();
    expect(leave).toHaveBeenCalledOnce();

    delete room.players.other;
    room.results['1'] = { self: { t: 1_000, p: 'ok' } };
    await render();
    await clickLeave();
    expect(leave).toHaveBeenCalledOnce();
    await clickLeave();
    expect(leave).toHaveBeenCalledTimes(2);

    room.results['1'] = {};
    await render();
    await clickLeave();
    expect(leave).toHaveBeenCalledTimes(3);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
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
  const render = () => act(async () => root.render(createElement(TimerRoomAdmin, { room, currentPlayerId: 'self', language, onSyncStart: vi.fn(), onTransfer: vi.fn(), onKick: kick, onClose: close })));
  window.addEventListener('keydown', leaked);
  try {
    await render();
    let dialog = document.querySelector<HTMLElement>('.timer-room-dialog')!;
    let buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
    const backdrop = dialog.parentElement!;
    await act(async () => {
      dialog.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
      backdrop.click();
    });
    expect(close).not.toHaveBeenCalled();
    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
      backdrop.dispatchEvent(new Event('pointercancel', { bubbles: true }));
      backdrop.click();
    });
    expect(close).not.toHaveBeenCalled();
    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
      backdrop.click();
    });
    expect(close).toHaveBeenCalledOnce();
    // The owner removes a dismissed dialog before opening a fresh instance.
    await act(async () => root.render(null));
    await render();
    dialog = document.querySelector<HTMLElement>('.timer-room-dialog')!;
    buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
    const remove = buttons.at(-1)!;
    close.mockClear();
    await act(async () => remove.click()); expect(kick).not.toHaveBeenCalled();
    await act(async () => remove.click()); expect(kick).toHaveBeenCalledWith('other');
    await act(async () => { remove.focus(); remove.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); });
    expect(document.activeElement).toBe(buttons[0]);
    await act(async () => buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(close).toHaveBeenCalledOnce(); expect(leaked).not.toHaveBeenCalled();
    await act(async () => root.render(null)); expect(document.activeElement).toBe(trigger);
  } finally {
    await act(async () => root.unmount());
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

it('copies ranked standings and restores focus after opening only the local reviewable result', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const room: NetRoomState = {
    code: '0427', revision: 1, videoGeneration: 'test', roundRoster: [], event: '333', round: 2,
    scrambles: {}, admin: 'self', syncStart: false, startAt: null, now: 1_000,
    players: {
      self: { name: 'Guest', ph: 'idle', joined: 1, seen: 1_000, at: 0 },
      other: { name: 'Rival', ph: 'idle', joined: 2, seen: 1_000, at: 0, event: '222' },
    },
    results: { '2': { self: { t: 1_000, p: '+2' }, other: { t: 2_500, p: 'ok' } } },
    history: [{ round: 1, scrambles: {}, playerEvents: { self: '333', other: '222' },
      results: { self: { t: 2_000, p: 'ok' }, other: { t: 4_000, p: 'ok' } }, winners: ['self'] }],
    scores: { other: 3, self: 2 },
  };
  const writeClipboardText = vi.fn(async () => {});
  function Fixture() {
    const [round, setRound] = useState<number | null>(null);
    return createElement('div', null,
      createElement(TimerRoomHistory, { room, currentPlayerId: 'self', language: 'en', precision: 2,
        onClose: vi.fn(), writeClipboardText, canInspectAttempt: candidate => candidate === 1, onInspectAttempt: setRound }),
      round !== null && createElement(TimerRoomDialog, { title: 'Reconstruct', language: 'en', onClose: () => setRound(null), children: String(round) }),
    );
  }
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(Fixture)));
    const history = document.querySelector('[role="dialog"]')!;
    const copy = history.querySelector<HTMLButtonElement>('[aria-label="Copy standings"]')!;
    await act(async () => copy.click());
    expect(writeClipboardText).toHaveBeenCalledExactlyOnceWith([
      'Room 0427 · Round 2',
      'Rank\tPlayer\tEvent\tWins\tBest\tao5\tao12\tMean',
      '1\tRival\t2×2\t3\t2.50\t—\t—\t3.25',
      '2\tGuest\t3×3\t2\t2.00\t—\t—\t2.50',
    ].join('\n'));
    expect(history.querySelector('[role="status"]')?.textContent).toBe('Standings copied');

    const [replay] = history.querySelectorAll<HTMLButtonElement>('.timer-room-history-result button');
    expect(history.querySelectorAll('.timer-room-history-result button')).toHaveLength(1);
    expect(replay.textContent).toBe('2.00');
    await act(async () => replay.click());
    const review = [...document.querySelectorAll('[role="dialog"]')].at(-1)!;
    expect(review.textContent).toContain('Reconstruct');
    expect(review.contains(document.activeElement)).toBe(true);
    await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.activeElement).toBe(replay);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
