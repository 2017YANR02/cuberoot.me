// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nuqsMocks = vi.hoisted(() => ({ step: 'daisy' }));
const daisyResourceMocks = vi.hoisted(() => ({
  pooledScramble: vi.fn(async () => 'R U F'),
  randomMoveScrambleNxN: vi.fn(() => 'R U F'),
  getRustCrossPool: vi.fn(() => ({
    ready: Promise.resolve(),
    solveDaisyStage: vi.fn(async () => [0, 1, 2, 3, 4, 5]),
    solveDaisyMoves: vi.fn(async () => ({ sols: [{ m: 'R' }], len: 1 })),
  })),
  poolSizeForDevice: vi.fn(() => 1),
}));

vi.mock('nuqs', () => ({
  parseAsStringEnum: () => ({
    withDefault: () => ({ withOptions: () => null }),
  }),
  useQueryState: () => [nuqsMocks.step, vi.fn()],
}));

vi.mock('@/components/AlgPlayer/AlgPlayer', () => ({
  default: (props: { alg: string; setup?: string; autoPlay?: boolean }) => createElement('output', {
    'data-testid': 'lbl-player',
    'data-auto-play': String(Boolean(props.autoPlay)),
    'data-alg': props.alg,
    'data-setup': props.setup ?? '',
  }, props.alg),
}));

vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/components/AppLink', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => createElement('a', { href }, children),
}));
vi.mock('@/components/CompactSelect', () => ({
  CompactSelect: ({ label }: { label: string }) => createElement('button', { type: 'button' }, label),
}));
vi.mock('@/components/JsonLd', () => ({ default: () => null }));
vi.mock('@/components/VisualCube', () => ({
  VisualCube: ({ alt }: { alt: string }) => createElement('img', { alt }),
}));
vi.mock('@/i18n/tr', () => ({
  tr: (message: { zh: string }) => message.zh,
  T: ({ zh }: { zh: ReactNode }) => zh,
}));
vi.mock('@/lib/cubing-scramble', () => daisyResourceMocks);
vi.mock('@/lib/rust-cross-pool', () => daisyResourceMocks);

import LblTutorial from '@/app/[lang]/tutorial/lbl/page';

describe('LBL tutorial player', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    nuqsMocks.step = 'daisy';
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('keeps the daisy animation paused until the user presses play', async () => {
    await act(async () => {
      root.render(createElement(LblTutorial));
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(host.querySelector('[data-testid="lbl-player"]')?.getAttribute('data-auto-play')).toBe('false');
  });

  it('uses a pre-generated scramble without starting scramble or solver workers', async () => {
    await act(async () => {
      root.render(createElement(LblTutorial));
    });

    expect(host.querySelector('.lbl-daisy-scramble code')?.textContent).toBeTruthy();
    expect(daisyResourceMocks.pooledScramble).not.toHaveBeenCalled();
    expect(daisyResourceMocks.randomMoveScrambleNxN).not.toHaveBeenCalled();
    expect(daisyResourceMocks.getRustCrossPool).not.toHaveBeenCalled();
  });

  it('lets the user switch to another generated scramble', async () => {
    await act(async () => {
      root.render(createElement(LblTutorial));
    });

    const firstScramble = host.querySelector('.lbl-daisy-scramble code')?.textContent;
    const nextButton = Array.from(host.querySelectorAll('button')).find(
      button => button.textContent === '换一套打乱',
    );
    expect(nextButton).toBeTruthy();

    await act(async () => {
      (nextButton as HTMLButtonElement).click();
    });

    expect(host.querySelector('.lbl-daisy-scramble code')?.textContent).not.toBe(firstScramble);
  });

  it('starts the lesson scramble at daisy and carries it through every solving step', async () => {
    const stepIds = ['structure', 'daisy', 'cross', 'corners', 'middle', 'yellow-cross', 'yellow-face', 'corner-position', 'edge-position'];
    const setups: string[] = [];
    const algs: string[] = [];
    const scrambles: string[] = [];

    for (const step of stepIds) {
      nuqsMocks.step = step;
      await act(async () => {
        root.render(createElement(LblTutorial));
      });
      const player = host.querySelector('[data-testid="lbl-player"]');
      setups.push(player?.getAttribute('data-setup') ?? '');
      algs.push(player?.getAttribute('data-alg') ?? '');
      scrambles.push(host.querySelector('.lbl-daisy-scramble code')?.textContent ?? '');
    }

    expect(setups[0]).toBe('');
    expect(algs[0]).toBe('');
    expect(setups[1]).not.toBe('');
    expect(algs.slice(1).every((alg, index) => index === 4 || Boolean(alg))).toBe(true);
    expect(scrambles.slice(1).every(scramble => scramble === scrambles[1])).toBe(true);
    for (let i = 2; i < setups.length; i++) {
      expect(setups[i]).toContain(algs[i - 1]);
    }

  });
});
