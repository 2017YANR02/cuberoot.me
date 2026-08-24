// @vitest-environment jsdom

import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let playerMounts = 0;
let playerUnmounts = 0;

vi.mock('@/components/AlgPlayer/AlgPlayer', () => ({
  default: function PlayerProbe({ alg, autoPlay, playRequest, loop, controlMode, engine, startSolved }: {
    alg: string;
    autoPlay?: boolean;
    playRequest?: number;
    loop?: boolean;
    controlMode?: string;
    engine?: string;
    startSolved?: boolean;
  }) {
    useEffect(() => {
      playerMounts++;
      return () => { playerUnmounts++; };
    }, []);
    return createElement('output', {
      'data-testid': 'player-alg',
      'data-auto-play': String(Boolean(autoPlay)),
      'data-play-request': String(playRequest ?? 0),
      'data-loop': String(Boolean(loop)),
      'data-control-mode': controlMode,
      'data-engine': engine,
      'data-start-solved': String(Boolean(startSolved)),
    }, alg);
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
    expect(host.querySelector('.move-notation-demo')?.classList.contains('alg-player-list-layout')).toBe(true);
    expect(host.querySelector('.move-notation-stage')?.classList.contains('alg-player-list-player')).toBe(true);
    expect(host.querySelector('.move-notation-options')?.classList.contains('alg-player-list-options')).toBe(true);
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-auto-play')).toBe('false');
    await act(async () => {
      buttons[1].click();
      buttons[2].click();
      buttons[3].click();
      buttons[0].click();
      buttons[2].click();
    });

    expect(host.querySelector('[data-testid="player-alg"]')?.textContent).toBe('R');
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-control-mode')).toBeNull();
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-engine')).toBeNull();
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-start-solved')).toBe('true');
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-auto-play')).toBe('true');
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-loop')).toBe('false');
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-play-request')).toBe('5');
    expect(host.querySelector('.move-notation-current')).toBeNull();
    expect(host.querySelector('.move-notation-open')).toBeNull();
    expect(playerMounts).toBe(1);
    expect(playerUnmounts).toBe(0);

    await act(async () => buttons[2].click());
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-play-request')).toBe('6');
    expect(playerMounts).toBe(1);
  });

  it('renders only one replay button in the teaching control mode', async () => {
    const onReplay = vi.fn();
    await act(async () => {
      root.render(createElement(AlgPlaybackControls, {
        count: 1,
        mode: 'replay',
        onReplay,
      }));
    });

    const buttons = host.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].classList.contains('playback-bar-btn')).toBe(true);
    expect(buttons[0].getAttribute('aria-label')).toBe('重播');
    expect(host.querySelector('input[type="range"]')).toBeNull();

    await act(async () => buttons[0].click());
    expect(onReplay).toHaveBeenCalledOnce();
  });

  it('reuses the canonical playback bar and delegates its five transport actions', async () => {
    const onScrub = vi.fn();
    const onStepBack = vi.fn();
    const onTogglePlay = vi.fn();
    const onStepForward = vi.fn();
    await act(async () => {
      root.render(createElement(AlgPlaybackControls, {
        step: 3,
        count: 7,
        playing: false,
        onScrub,
        onStepBack,
        onTogglePlay,
        onStepForward,
      }));
    });

    expect(host.querySelector('.playback-bar')).not.toBeNull();
    expect(host.querySelector('.playback-scrubber')).not.toBeNull();
    expect(host.querySelector('.alg-sim-controls')).toBeNull();
    expect(host.querySelector('.alg-sim-scrub')).toBeNull();

    const range = host.querySelector<HTMLInputElement>('input[type="range"]');
    expect(range).not.toBeNull();
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(range, '4');
      range?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onScrub).toHaveBeenCalledWith(4);

    const buttons = host.querySelectorAll<HTMLButtonElement>('.playback-bar-btn');
    expect(buttons).toHaveLength(5);
    await act(async () => {
      for (const button of buttons) button.click();
    });

    expect(onScrub.mock.calls.map(([value]) => value)).toEqual([4, 0, 7]);
    expect(onStepBack).toHaveBeenCalledOnce();
    expect(onTogglePlay).toHaveBeenCalledOnce();
    expect(onStepForward).toHaveBeenCalledOnce();
  });

  it('keeps the formula transport implementation on PlaybackBar without local controls', () => {
    const controls = readFileSync(
      join(process.cwd(), 'components', 'AlgPlayer', 'AlgPlaybackControls.tsx'),
      'utf8',
    );
    const css = readFileSync(
      join(process.cwd(), 'components', 'AlgPlayer', 'alg-sim-player.css'),
      'utf8',
    );

    expect(controls).toContain("from '@/components/PlaybackBar'");
    expect(controls).toContain('<PlaybackBar');
    expect(controls).not.toContain('type="range"');
    expect(css).not.toContain('.alg-sim-btn');
    expect(css).not.toContain('.alg-sim-scrub');
  });

  it('contains extension-modified inline style hydration noise at the exact leaf', () => {
    const stage = readFileSync(
      join(process.cwd(), 'components', 'sim-embed', 'SimStage.tsx'),
      'utf8',
    );

    expect(stage).toContain('<style suppressHydrationWarning>{INLINE_CSS}</style>');
  });

  it('uses the same default full controls and engine routing as formula previews', async () => {
    await act(async () => {
      root.render(createElement(MoveNotationDemo, {
        puzzle: '3x3',
        moves: [
          { move: 'U', caption: '上' },
          { move: 'D', caption: '下' },
        ],
        variant: 'compact',
      }));
    });

    const buttons = host.querySelectorAll<HTMLButtonElement>('.move-notation-option');
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-control-mode')).toBeNull();
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-engine')).toBeNull();
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-auto-play')).toBe('false');

    await act(async () => buttons[1].click());
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-play-request')).toBe('1');
    expect(host.querySelector('[data-testid="player-alg"]')?.getAttribute('data-auto-play')).toBe('true');
  });

  it('derives cube captions from the same formatter as foolproof notation', async () => {
    await act(async () => {
      root.render(createElement(MoveNotationDemo, {
        puzzle: '3x3',
        moves: [{ move: 'x' }, { move: 'E' }],
        variant: 'compact',
      }));
    });

    const captions = Array.from(host.querySelectorAll('.move-notation-option > span'))
      .map(node => node.textContent);
    expect(captions).toEqual([
      '整体沿右层顺时针转90度',
      '下面第二层顺时针转90度',
    ]);
  });

  it('keeps canonical move notation visible beside a localized alias', async () => {
    await act(async () => {
      root.render(createElement(MoveNotationDemo, {
        puzzle: '3x3',
        moves: [{ move: "R3'", symbol: "右3'", caption: '右面逆时针转270度' }],
        variant: 'compact',
      }));
    });

    expect(host.querySelector('.move-notation-standard')?.textContent).toBe("R3'");
    expect(host.querySelector('.move-notation-alias')?.textContent).toBe("右3'");
  });

  it('visually groups suffix variants of the same base move', async () => {
    await act(async () => {
      root.render(createElement(MoveNotationDemo, {
        puzzle: '3x3',
        moves: [
          { move: 'U' }, { move: "U'" }, { move: 'U2' }, { move: "U2'" },
          { move: 'D' }, { move: "D'" }, { move: 'D2' }, { move: "D2'" },
        ],
        variant: 'compact',
      }));
    });

    const groupStarts = host.querySelectorAll('.move-notation-option.is-group-start');
    expect(groupStarts).toHaveLength(1);
    expect(groupStarts[0].textContent).toBe('D下面顺时针转90度');
  });
});
