// @vitest-environment jsdom

import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let playerMounts = 0;
let playerUnmounts = 0;

vi.mock('@/components/AlgPlayer/AlgPlayer', () => ({
  default: function PlayerProbe({ alg, autoPlay, loop, controlMode }: {
    alg: string;
    autoPlay?: boolean;
    loop?: boolean;
    controlMode?: string;
  }) {
    useEffect(() => {
      playerMounts++;
      return () => { playerUnmounts++; };
    }, []);
    return createElement('output', {
      'data-testid': 'player-alg',
      'data-auto-play': String(Boolean(autoPlay)),
      'data-loop': String(Boolean(loop)),
      'data-control-mode': controlMode,
    }, alg);
  },
}));

vi.mock('@/components/AppLink', () => ({
  default: function LinkProbe({ href, children }: { href: string; children: unknown }) {
    return createElement('a', { href }, children as never);
  },
}));

vi.mock('@/hooks/useT', () => ({
  useT: () => (zh: string) => zh,
}));

import MoveNotationDemo from '@/components/MoveNotationDemo/MoveNotationDemo';
import AlgPlaybackControls from '@/components/AlgPlayer/AlgPlaybackControls';

describe('MoveNotationDemo player lifecycle', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    playerMounts = 0;
    playerUnmounts = 0;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('keeps one 3D player mounted while moves are switched rapidly', async () => {
    await act(async () => {
      root.render(createElement(MoveNotationDemo, {
        puzzle: '3x3',
        moves: [
          { move: 'U', caption: '上' },
          { move: 'D', caption: '下' },
          { move: 'R', caption: '右' },
          { move: 'F', caption: '前' },
        ],
        variant: 'compact',
      }));
    });

    const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('.move-notation-option'));
    await act(async () => {
      buttons[1].click();
      buttons[2].click();
      buttons[3].click();
      buttons[0].click();
      buttons[2].click();
    });

    expect(host.querySelector('[data-testid="player-alg"]')?.textContent).toBe('R');
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-control-mode')).toBe('replay');
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-auto-play')).toBe('true');
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-loop')).toBe('false');
    expect(playerMounts).toBe(1);
    expect(playerUnmounts).toBe(0);
  });

  it('renders only one replay button in the teaching control mode', async () => {
    const onReplay = vi.fn();
    await act(async () => {
      root.render(createElement(AlgPlaybackControls, {
        step: 1,
        count: 1,
        playing: false,
        onStepChange: vi.fn(),
        onPlayingChange: vi.fn(),
        mode: 'replay',
        onReplay,
      }));
    });

    const buttons = host.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-label')).toBe('重播');
    expect(host.querySelector('input[type="range"]')).toBeNull();

    await act(async () => buttons[0].click());
    expect(onReplay).toHaveBeenCalledOnce();
  });
});
