// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));
vi.mock('@/components/AppLink', () => ({ default: ({ prefetch: _prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => createElement('a', props) }));
import AlgMirrorPanel, { hasMirror, supportsAlgMirrorPreview } from '@/components/AlgMirrorPanel';
import type { AlgPuzzle } from '@cuberoot/shared/alg-catalog';

it('renders OLL mirror repetition and finger marks together', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(AlgMirrorPanel, {
      alg: "U2 f (U R U' R')2 f'", algHtml: "U2 <u>f</u> (U R U' R')2 f'", puzzle: '3x3', set: 'oll',
    })));
    expect(host.querySelector('.alg-mirror-alg')?.textContent).toBe("U2 f' (U' L' U L)2 f");
    expect(host.querySelector('.alg-mirror-alg u')?.textContent).toBe("f'");
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

it('updates corresponding LR marks and clears them without changing the moves', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  const render = async (algHtml?: string) => act(async () => root.render(createElement(AlgMirrorPanel, {
    alg: "F U F' y", algHtml, puzzle: '3x3', set: 'f2l', ori: 1,
  })));
  try {
    for (const [open, close, selector] of [
      ['<s>', '</s>', 's'], ['<u>', '</u>', 'u'], ['<u class="wavy">', '</u>', 'u.wavy'],
      ['<em>', '</em>', 'em'], ['<strong>', '</strong>', 'strong'],
      ['<sub>', '</sub>', 'sub'], ['<sup>', '</sup>', 'sup'],
    ]) {
      await render(`F ${open}U${close} F' y`);
      const alg = host.querySelector('.alg-mirror-alg')!;
      expect(alg.textContent).toBe("F' U' F");
      expect(alg.querySelector(selector)?.textContent).toBe("U'");
    }
    await render();
    expect(host.querySelector('.alg-mirror-alg')?.textContent).toBe("F' U' F");
    expect(host.querySelector('.alg-mirror-alg :is(s,u,em,strong,sub,sup)')).toBeNull();
    await render('F <s>D</s> F\' y');
    expect(host.querySelector('.alg-mirror-alg s')).toBeNull();
    expect(host.querySelector('.alg-mirror-alg')?.textContent).toBe("F' U' F");
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

it('filters back moves for every NxN preview without invented slot links', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    for (const puzzle of ['2x2', '3x3', '4x4', '5x5', '6x6', '7x7'] as AlgPuzzle[]) {
      expect(supportsAlgMirrorPreview(puzzle)).toBe(true);
      await act(async () => root.render(createElement(AlgMirrorPanel, {
        alg: 'R U B', puzzle, set: 'pll', mirrorHref: '/alg/mirror', selfHref: '/alg/self',
      })));
      expect(Array.from(host.querySelectorAll('.alg-mirror-alg'), el => el.textContent)).toEqual([
        "R' U' F'",
      ]);
      expect(Array.from(host.querySelectorAll('a'), el => el.getAttribute('href'))).toEqual([
        '/alg/mirror',
      ]);
    }
    expect(hasMirror('3x3', 'pll')).toBe(false);
    expect(hasMirror('3x3', 'f2l')).toBe(true);
    for (const puzzle of ['sq1', 'pyraminx', 'skewb', 'megaminx', 'fto'] as AlgPuzzle[]) {
      expect(supportsAlgMirrorPreview(puzzle)).toBe(false);
      await act(async () => root.render(createElement(AlgMirrorPanel, { alg: 'R U', puzzle })));
      expect(host.textContent).toBe('');
    }
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

it('hides whole back-move variants and reserves y2 for F2L', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  const render = async (alg: string, set: string) => act(async () => root.render(createElement(AlgMirrorPanel, {
    alg, puzzle: '3x3', set,
  })));
  const labels = () => Array.from(host.querySelectorAll('.alg-mirror-label'), el => el.textContent);
  try {
    for (const alg of ['R U F', 'R U f', 'R U Fw', "(R2' u' R U') (R U R' u) (R2 f R' f')"]) {
      await render(alg, 'pll');
      expect(labels()).toEqual(['LR-mirror']);
    }
    for (const alg of ['B U F', 'b U f', 'Bw U Fw']) {
      await render(alg, 'pll');
      expect(host.querySelector('.alg-mirror-panel')).toBeNull();
    }
    for (const set of ['pll', 'oll', 'zbls', 'cls']) {
      await render("R U R'", set);
      expect(labels()).toEqual(['LR-mirror', 'FB-mirror']);
    }
    for (const set of ['f2l', 'adv-f2l']) {
      await render("R U R'", set);
      expect(labels()).toEqual(['LR-mirror', 'FB-mirror', 'y2-rot']);
      await render("F U F'", set);
      expect(labels()).toEqual(['LR-mirror']);
    }
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
