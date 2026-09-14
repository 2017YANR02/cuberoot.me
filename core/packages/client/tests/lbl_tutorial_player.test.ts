// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('nuqs', () => ({
  parseAsStringEnum: () => ({
    withDefault: () => ({ withOptions: () => null }),
  }),
  useQueryState: () => ['daisy', vi.fn()],
}));

vi.mock('@/components/AlgPlayer/AlgPlayer', () => ({
  default: (props: { alg: string; autoPlay?: boolean }) => createElement('output', {
    'data-testid': 'lbl-player',
    'data-auto-play': String(Boolean(props.autoPlay)),
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
vi.mock('@/components/Spinner/Spinner', () => ({ Spinner: () => null }));
vi.mock('@/components/VisualCube', () => ({
  VisualCube: ({ alt }: { alt: string }) => createElement('img', { alt }),
}));
vi.mock('@/i18n/tr', () => ({
  tr: (message: { zh: string }) => message.zh,
  T: ({ zh }: { zh: ReactNode }) => zh,
}));
vi.mock('@/lib/cross-solver', () => ({ normalizeScramble: (scramble: string) => scramble }));
vi.mock('@/lib/cubing-scramble', () => ({
  pooledScramble: async () => 'R U F',
  randomMoveScrambleNxN: () => 'R U F',
}));
vi.mock('@/lib/rust-cross-pool', () => ({
  getRustCrossPool: () => ({
    ready: Promise.resolve(),
    solveDaisyStage: async () => [0, 1, 2, 3, 4, 5],
    solveDaisyMoves: async () => ({ sols: [{ m: 'R' }], len: 1 }),
  }),
  poolSizeForDevice: () => 1,
}));

import LblTutorial from '@/app/[lang]/tutorial/lbl/page';

describe('LBL tutorial player', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
});
