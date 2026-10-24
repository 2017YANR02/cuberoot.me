// @vitest-environment jsdom

import { act, createElement } from 'react';
import { readFileSync } from 'node:fs';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PuzzlePicker, { type PuzzlePickerGroup } from '@/components/PuzzlePicker/PuzzlePicker';

vi.mock('next/navigation', () => ({ useParams: () => ({ lang: 'en' }) }));
vi.mock('@/i18n/tr', () => ({ tr: (message: { en: string }) => message.en }));

const groups: PuzzlePickerGroup[] = [
  { id: 'wca', label: 'WCA events', items: [{ id: 'nxn', label: 'NxN', iconClass: 'event-333' }] },
  { id: 'families', label: 'Series', items: [{
    id: 'minx-family', label: 'Minx family', iconClass: 'event-minx', children: [
      { id: 'kilominx', label: 'Kilominx', iconClass: 'unofficial-kilominx' },
      { id: 'gigaminx', label: 'Gigaminx', iconClass: 'puzzle-gigaminx' },
    ],
  }] },
];

let host: HTMLDivElement;
let root: Root;
it.each(['shared-first', 'web-first'])('keeps flat menus anchored with %s CSS', (order) => {
  const shared = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/puzzle-picker.css')), 'utf8');
  const web = readFileSync('components/PuzzlePicker/puzzle_picker.css', 'utf8');
  const style = document.createElement('style');
  style.textContent = (order === 'shared-first' ? [shared, web] : [web, shared]).join('\n');
  document.head.appendChild(style);
  try {
    act(() => root.render(createElement(PuzzlePicker, {
      groups: groups.slice(0, 1), selectedEvent: 'nxn', onSelect: vi.fn(),
    })));
    act(() => host.querySelector<HTMLButtonElement>('.pp-trigger')!.click());
    const panel = host.querySelector<HTMLElement>('.pp-popup')!;
    expect(getComputedStyle(panel).position).toBe('absolute');
    expect(getComputedStyle(panel).top).toBe('calc(100% + 6px)');
    expect(getComputedStyle(panel).left).toBe('0px');
    panel.setAttribute('popover', 'manual');
    expect(getComputedStyle(panel).position).toBe('fixed');
    expect(getComputedStyle(panel).inset).toBe('auto');
    expect(getComputedStyle(panel).top).not.toBe('calc(100% + 6px)');
  } finally {
    style.remove();
  }
});

it('keeps flat menus visible while top-layer menus wait for positioning', () => {
  const style = document.createElement('style');
  style.textContent = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/puzzle-picker.css')), 'utf8');
  document.head.appendChild(style);
  try {
    act(() => root.render(createElement(PuzzlePicker, {
      groups: groups.slice(0, 1), selectedEvent: 'nxn', onSelect: vi.fn(),
    })));
    act(() => host.querySelector<HTMLButtonElement>('.pp-trigger')!.click());
    const panel = host.querySelector<HTMLElement>('.pp-popup')!;
    expect(getComputedStyle(panel).visibility).toBe('visible');
    panel.setAttribute('popover', 'manual');
    expect(getComputedStyle(panel).visibility).toBe('hidden');
  } finally {
    style.remove();
  }
});

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 1; });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

it('uses the shared submenu for families while WCA choices remain directly selectable', () => {
  const onSelect = vi.fn();
  act(() => root.render(createElement(PuzzlePicker, { groups, selectedEvent: 'nxn', onSelect })));
  const trigger = host.querySelector<HTMLButtonElement>('.pp-trigger')!;
  act(() => trigger.click());
  const parentItems = [...host.querySelectorAll<HTMLButtonElement>('.pp-cascade-column > .pp-group .pp-item')];
  expect(parentItems.map(item => item.textContent)).toEqual(['NxN', 'Minx family']);
  expect(host.querySelector('.pp-cascade-options')).toBeNull();
  act(() => parentItems[1].click());
  expect(onSelect).not.toHaveBeenCalled();
  const child = [...host.querySelectorAll<HTMLButtonElement>('.pp-cascade-options .pp-item')]
    .find(item => item.textContent?.includes('Gigaminx'))!;
  act(() => child.click());
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('gigaminx');
  expect(host.querySelector('.pp-popup')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  act(() => trigger.click());
  act(() => host.querySelector<HTMLButtonElement>('.pp-item')!.click());
  expect(onSelect).toHaveBeenLastCalledWith('nxn');
});

it('shows the selected leaf and returns from the second level before closing the menu', () => {
  act(() => root.render(createElement(PuzzlePicker, { groups, selectedEvent: 'kilominx', onSelect: vi.fn() })));
  const trigger = host.querySelector<HTMLButtonElement>('.pp-trigger')!;
  expect(trigger.getAttribute('aria-label')).toBe('Kilominx');
  act(() => trigger.click());
  const family = host.querySelector<HTMLButtonElement>('.pp-item[aria-haspopup="menu"]')!;
  act(() => family.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  expect(host.querySelector('.pp-cascade-options')).not.toBeNull();
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(host.querySelector('.pp-cascade-options')).toBeNull();
  expect(host.querySelector('.pp-popup')).not.toBeNull();
  expect(document.activeElement).toBe(family);
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(host.querySelector('.pp-popup')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('preserves a text-only trigger when the caller disables item icons', () => {
  act(() => root.render(createElement(PuzzlePicker, {
    groups, selectedEvent: 'kilominx', onSelect: vi.fn(), showItemIcons: false,
  })));
  const trigger = host.querySelector<HTMLButtonElement>('.pp-trigger')!;
  expect(trigger.querySelector('.pp-trigger-label')?.textContent).toBe('Kilominx');
  expect(trigger.querySelector('.pp-trigger-icon')).toBeNull();
});

it('searches bilingual leaves without changing IDs and keeps shortcuts after WCA', () => {
  const onSelect = vi.fn();
  const discovery = {
    storageKey: 'test.picker-discovery', searchLabel: 'Search puzzles', clearLabel: 'Clear search',
    emptyLabel: 'No results', resultsLabel: 'Results', recentLabel: 'Recent', favoritesLabel: 'Favorites',
    favoriteLabel: 'Favorite current puzzle', unfavoriteLabel: 'Unfavorite current puzzle',
  };
  localStorage.removeItem(discovery.storageKey);
  const bilingual = groups.map(group => ({ ...group, items: group.items.map(item => ({ ...item,
    children: item.children?.map(child => ({ ...child, searchText: child.id === 'gigaminx' ? '五阶五魔 Gigaminx' : '二阶五魔 Kilominx' })),
  })) }));
  act(() => root.render(createElement(PuzzlePicker, { groups: bilingual, selectedEvent: 'gigaminx', onSelect, discovery })));
  act(() => host.querySelector<HTMLButtonElement>('.pp-trigger')!.click());
  act(() => host.querySelector<HTMLButtonElement>('.pp-favorite')!.click());
  expect([...host.querySelectorAll('.pp-group-title')].map(el => el.textContent)).toEqual(['WCA events', 'Favorites', 'Series']);
  expect(JSON.parse(localStorage.getItem(discovery.storageKey)!).favorites).toEqual(['gigaminx']);
  const input = host.querySelector<HTMLInputElement>('input')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '五阶');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect([...host.querySelectorAll('.pp-item-label')].map(el => el.textContent)).toEqual(['GigaminxSeries / Minx family']);
  act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
  expect(document.activeElement).toBe(host.querySelector('.pp-item'));
  act(() => host.querySelector<HTMLButtonElement>('.pp-item')!.click());
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('gigaminx');
  expect(JSON.parse(localStorage.getItem(discovery.storageKey)!).recent).toEqual(['gigaminx']);
  expect(document.activeElement).toBe(host.querySelector('.pp-trigger'));
  localStorage.removeItem(discovery.storageKey);
});
