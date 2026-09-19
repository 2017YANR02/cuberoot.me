// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CubeGraphPage from '@/app/[lang]/math/cube-graph/page';
import { stickerPermutation } from '@/app/[lang]/math/cube-graph/model';

const cube = vi.hoisted(() => ({ props: null as null | {
  moves: string[]; locked: boolean; onMove: (move: string) => void;
  selected?: number; onSelect: (id: number) => void;
} }));

vi.mock('@/app/[lang]/math/cube-graph/CubeGraphCube', () => ({
  default: (props: NonNullable<typeof cube.props>) => { cube.props = props; return null; },
}));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'en' }));
vi.mock('@/components/AlgInput', () => ({ default: () => null }));
vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/components/CompactSelect', () => ({ CompactSelect: ({ ariaLabel, value, items, onChange }: {
  ariaLabel: string; value: string | number; items: { value: string | number; label: string }[]; onChange: (value: string | number) => void;
}) => createElement('select', { 'aria-label': ariaLabel, value, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
  onChange(items.find(item => String(item.value) === event.target.value)!.value);
} }, items.map(item => createElement('option', { key: item.value, value: item.value }, item.label))) }));
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

it('shows both maps together and tracks the same sticker through turns, with one shared selection', async () => {
  expect(host.querySelectorAll('.cube-graph-views > figure')).toHaveLength(3);
  expect(host.querySelectorAll('.cube-graph-svg')).toHaveLength(2);
  expect(host.querySelector('select[aria-label="Map layout"]')).toBeNull();
  expect(host.querySelectorAll('[data-sticker][opacity="1"]')).toHaveLength(54);
  expect(host.querySelectorAll('[data-slot][opacity="1"]')).toHaveLength(54);
  await act(async () => button('Reset').click());
  expect(host.querySelector('.cube-graph-tracking select')).toBeNull();
  await act(async () => host.querySelector('[data-sticker="18"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(cube.props!.selected).toBe(18);
  expect(host.querySelectorAll('[data-sticker][opacity="1"]')).toHaveLength(1);
  expect(host.querySelector('[data-sticker="18"]')?.getAttribute('opacity')).toBe('1');
  await act(async () => cube.props!.onMove('U'));
  const slot = stickerPermutation(['U']).indexOf(18);
  expect(host.querySelector('.cube-graph-tracking')?.textContent).toBe('Click a sticker to track it');
  expect(host.querySelectorAll('.cube-graph-svg')).toHaveLength(2);
  expect(host.querySelectorAll('[data-slot][opacity="1"]')).toHaveLength(1);
  expect(host.querySelector(`[data-slot="${slot}"]`)?.getAttribute('opacity')).toBe('1');
  expect(host.querySelector('[data-sticker="18"]')?.getAttribute('opacity')).toBe('1');
  // Clicking the moved sticker on the disc deselects its identity, not its slot.
  await act(async () => host.querySelector(`[data-slot="${slot}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(cube.props!.selected).toBeUndefined();
  expect(host.querySelectorAll('[data-sticker][opacity="1"]')).toHaveLength(54);
  expect(host.querySelectorAll('[data-slot][opacity="1"]')).toHaveLength(54);
  expect(host.querySelector('.cube-graph-tracking input')).toBeNull();
  await act(async () => host.querySelector(`[data-slot="${slot}"]`)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(cube.props!.selected).toBe(18);
  await act(async () => button('Clear selection').click());
  expect(cube.props!.selected).toBeUndefined();
  // The 3D view feeds the same selection and both flat maps follow it.
  await act(async () => cube.props!.onSelect(9));
  expect(host.querySelector('[data-sticker="9"]')!.closest('[role="button"]')!.getAttribute('aria-pressed')).toBe('true');
  const rightStickerSlot = stickerPermutation(['U']).indexOf(9);
  expect(host.querySelector(`[data-slot="${rightStickerSlot}"]`)!.getAttribute('aria-pressed')).toBe('true');
  await act(async () => host.querySelector('[data-sticker="9"]')!.parentElement!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
  expect(cube.props!.selected).toBeUndefined();
});
