// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CubeGraphPage from '@/app/[lang]/math/cube-graph/page';

const cube = vi.hoisted(() => ({ props: null as null | {
  moves: string[]; locked: boolean; onMove: (move: string) => void;
} }));

vi.mock('@/app/[lang]/math/cube-graph/CubeGraphCube', () => ({
  default: (props: NonNullable<typeof cube.props>) => { cube.props = props; return null; },
}));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'en' }));
vi.mock('@/components/AlgInput', () => ({ default: () => null }));
vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/components/CompactSelect', () => ({ CompactSelect: () => null }));
vi.mock('@/components/math/Tex', () => ({ TeX: () => null }));
vi.mock('@/components/JsonLd', () => ({ default: () => null, articleJsonLd: () => ({}) }));
vi.mock('@/app/[lang]/math/cube-graph/CayleyLesson', () => ({ default: () => null }));

let root: Root;
let host: HTMLDivElement;
const button = (text: string) => [...host.querySelectorAll('button')]
  .find(node => node.textContent === text || node.getAttribute('aria-label') === text)!;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(CubeGraphPage)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('accepts a second manual turn while the first graph animation is still busy', async () => {
  await act(async () => button('Reset').click());
  await act(async () => cube.props!.onMove('R'));
  expect(button('Reset').disabled).toBe(true);
  // The real controller snaps a dragged layer back to zero when this is true.
  expect(cube.props!.locked).toBe(false);
  await act(async () => cube.props!.onMove('U'));
  expect(cube.props!.moves).toEqual(['R', 'U']);
  expect(cube.props!.locked).toBe(false);
  await act(async () => vi.advanceTimersByTime(600));
  expect(button('Reset').disabled).toBe(false);
  expect(cube.props!.moves).toEqual(['R', 'U']);
});

it('still locks manual turns during playback and unlocks when paused', async () => {
  await act(async () => button('Play').click());
  expect(cube.props!.locked).toBe(true);
  await act(async () => button('Pause').click());
  expect(cube.props!.locked).toBe(false);
});
