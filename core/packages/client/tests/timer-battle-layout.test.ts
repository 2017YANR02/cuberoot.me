// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TimerBattleLayout, TimerBattleLayoutControls } from '@cuberoot/timer-ui';

it.each([2, 3, 4] as const)('orders %s player slots and keeps facing and shared scrambles explicit', async (playerCount) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  const renderPlayer = vi.fn((id: number, cell: { hideScramble: boolean }) =>
    createElement('output', { 'data-hide-scramble': cell.hideScramble }, id));
  try {
    await act(async () => root.render(createElement(TimerBattleLayout, {
      playerCount, layout: 'versus', flipTopRow: true, renderPlayer,
      bottomScramble: 'bottom scramble', topScramble: 'top scramble',
    })));
    expect([...host.querySelectorAll('[data-player-id]')].map((el) => Number(el.getAttribute('data-player-id'))))
      .toEqual(playerCount === 2 ? [1, 0] : playerCount === 3 ? [2, 0, 1] : [2, 3, 0, 1]);
    expect(host.querySelectorAll('.timer-battle-cell[data-flipped]')).toHaveLength(playerCount === 4 ? 2 : 1);
    expect(host.querySelectorAll('.timer-battle-scramble')).toHaveLength(playerCount === 2 ? 0 : playerCount === 3 ? 1 : 2);
    await act(async () => root.render(createElement(TimerBattleLayout, {
      playerCount, layout: 'side', flipTopRow: false, renderPlayer,
    })));
    expect(host.querySelector('[data-flipped]')).toBeNull();
    expect(host.querySelector('[data-hide-scramble="true"]')).toBeNull();
    expect(host.querySelectorAll('[data-player-id]')).toHaveLength(playerCount);
  } finally {
    await act(async () => root.unmount()); vi.unstubAllGlobals();
  }
});

it('shares orientation adaptation and manual layout controls without touching timer state', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let notify = () => {};
  const media = { matches: false, addEventListener: vi.fn((_event: string, listener: () => void) => { notify = listener; }), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', () => media);
  const onLayoutChange = vi.fn();
  const onFlipChange = vi.fn();
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(TimerBattleLayoutControls, {
      playerCount: 2, layout: 'versus', flipTopRow: true, language: 'en', onLayoutChange, onFlipChange,
    })));
    expect(onLayoutChange).toHaveBeenLastCalledWith('versus');
    media.matches = true;
    await act(async () => notify());
    expect(onLayoutChange).toHaveBeenLastCalledWith('side');
    await act(async () => host.querySelector('button')!.click());
    expect(onLayoutChange).toHaveBeenLastCalledWith('versus');
    await act(async () => host.querySelector('input')!.click());
    expect(onFlipChange).toHaveBeenCalledWith(false);
  } finally {
    await act(async () => root.unmount());
    expect(media.removeEventListener).toHaveBeenCalled();
    vi.unstubAllGlobals();
  }
});
