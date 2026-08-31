/** @vitest-environment jsdom */

import { createElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

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
const { useBattleStore } = await import('@/app/[lang]/timer/_battle/engine/battle_store');
const {
  battlePointerReleaseAction,
  isBattleKeyboardExcludedTarget,
  useKeyboardControls,
} = await import('@/app/[lang]/timer/_shell/BattleView');

function KeyboardHarness({ suppressed }: { suppressed: boolean }) {
  useKeyboardControls(suppressed);
  return null;
}

beforeEach(() => {
  const state = useBattleStore.getState();
  state.cancelReadyTimer();
  useBattleStore.setState({
    mode: '1v1',
    playerCount: 4,
    playerKeys: [' ', 'Enter', 'q', 'p'],
    battleRounds: [],
    scrambles: ["R U R'", "R U R'", "R U R'", "R U R'"],
    scrambleLoadings: [false, false, false, false],
    players: state.players.map((player, id) => ({
      ...player,
      id,
      isReady: false,
      canStart: false,
      isTiming: false,
      hasFinished: false,
      time: 0,
    })),
  });
});

describe('battle overlay keyboard suppression', () => {
  it('maps a real pointer release to start and platform cancellation to cancel', () => {
    expect(battlePointerReleaseAction('pointerup')).toBe('up');
    expect(battlePointerReleaseAction('pointercancel')).toBe('cancel');
    expect(battlePointerReleaseAction('lostpointercapture')).toBe('cancel');
  });

  it('treats every descendant of data-no-timer as excluded input', () => {
    const overlay = document.createElement('div');
    overlay.dataset.noTimer = '';
    const button = document.createElement('button');
    overlay.append(button);
    expect(isBattleKeyboardExcludedTarget(button)).toBe(true);
  });

  it('cancels a held player and ignores all four timer keys while an overlay is open', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    act(() => root.render(createElement(KeyboardHarness, { suppressed: false })));
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' })));
    expect(useBattleStore.getState().players[2].isReady).toBe(true);

    act(() => root.render(createElement(KeyboardHarness, { suppressed: true })));
    expect(useBattleStore.getState().players[2].isReady).toBe(false);

    for (const key of [' ', 'Enter', 'q', 'p']) {
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key }));
        document.dispatchEvent(new KeyboardEvent('keyup', { key }));
      });
    }
    expect(useBattleStore.getState().players.every((player) => (
      !player.isReady && !player.canStart && !player.isTiming
    ))).toBe(true);

    act(() => root.unmount());
    host.remove();
  });

  it('does not stop a running player through an obscured keyboard shortcut', () => {
    const players = [...useBattleStore.getState().players];
    players[0] = { ...players[0], isTiming: true, startTime: 1 };
    useBattleStore.setState({ players });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    act(() => root.render(createElement(KeyboardHarness, { suppressed: true })));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    });
    expect(useBattleStore.getState().players[0].isTiming).toBe(true);

    act(() => root.unmount());
    host.remove();
  });
});
