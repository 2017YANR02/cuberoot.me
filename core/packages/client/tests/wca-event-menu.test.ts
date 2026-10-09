// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WcaEventSelector from '@/components/WcaEventSelector';
import WcaEventMultiSelector from '@/components/WcaEventMultiSelector';
import { EventSelect } from '@/components/EventSelect/EventSelect';

vi.mock('next/navigation', () => ({ useParams: () => ({ lang: 'en' }) }));
vi.mock('@/i18n/tr', () => ({ tr: (text: { en: string }) => text.en }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));

describe('WCA event menus', () => {
  let host: HTMLDivElement;
  let root: Root;
  const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')]
    .find(node => node.textContent === label || node.getAttribute('aria-label') === label)!;
  const open = () => act(() => host.querySelector<HTMLButtonElement>('.pp-trigger')!.click());

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 1; });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('collapses by default, preserves All, former and appended events, and excludes unavailable events', () => {
    const onSelect = vi.fn();
    act(() => root.render(createElement(WcaEventSelector, {
      availableEvents: new Set(['333', '333ft', 'fto']), selectedEvent: '', allowAll: true,
      allLabel: 'All events', onSelect, isZh: false, onlyAvailable: true,
      appendEvents: [{ id: 'fto', iconClass: 'unofficial-fto', label: 'FTO' }],
      badges: { '333': 2 }, topBadges: { '333': 3 },
    })));
    expect(host.querySelectorAll('button')).toHaveLength(1);
    expect(button('All events').textContent).toBe('All events');
    open();
    expect(host.querySelectorAll('.pp-item')).toHaveLength(4);
    expect(host.textContent).toContain('Former events');
    expect(host.querySelector('.pp-item-detail')?.textContent).toBe('2 / 3');
    act(() => button('FTO').click());
    expect(onSelect).toHaveBeenLastCalledWith('fto');
    expect(host.querySelector('.pp-popup')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('.pp-trigger'));
    open();
    act(() => host.querySelectorAll<HTMLButtonElement>('.pp-item')[0].click());
    expect(onSelect).toHaveBeenLastCalledWith('');
  });

  it('keeps multi-selection open, including empty selection, group shortcuts, and cancelled events', () => {
    const changes = vi.fn();
    function Example() {
      const [selectedEvents, setSelected] = useState(new Set(['333']));
      return createElement(WcaEventMultiSelector, {
        availableEvents: new Set(['333', '222', '333bf', '333ft']), selectedEvents, isZh: false,
        onChange: (next: Set<string>) => { changes([...next]); setSelected(next); },
      });
    }
    act(() => root.render(createElement(Example)));
    expect(host.querySelector('.wca-event-multi-toolbar')).toBeNull();
    expect(host.querySelector('.pp-trigger')?.getAttribute('aria-label')).toBe('3×3');
    expect(host.querySelector('.pp-trigger')?.textContent).toBe('');
    expect(host.querySelectorAll('.pp-trigger-selection .pp-trigger-icon')).toHaveLength(1);
    open();
    act(() => button('Clear').click());
    expect(changes).toHaveBeenLastCalledWith([]);
    expect(host.querySelector('.pp-trigger-label')?.textContent).toBe('Puzzle');
    expect(host.querySelector('.pp-popup')).not.toBeNull();
    act(() => button('Blind').click());
    expect(changes).toHaveBeenLastCalledWith(['333bf']);
    expect(host.querySelector('.pp-trigger')?.getAttribute('aria-label')).toBe('3BLD');
    act(() => button('All').click());
    expect(changes).toHaveBeenLastCalledWith(['333', '222', '333bf']);
    expect(host.querySelector('.pp-trigger')?.getAttribute('aria-label')).toBe('3×3, 2×2, 3BLD');
    expect(host.querySelector('.pp-trigger')?.textContent).toBe('');
    expect([...host.querySelectorAll('.pp-trigger-selection > span')].map(node => node.getAttribute('title')))
      .toEqual(['3×3', '2×2', '3BLD']);
    const cancelled = host.querySelector<HTMLButtonElement>('[role="switch"]')!;
    act(() => cancelled.click());
    expect(changes).toHaveBeenLastCalledWith(['333', '222', '333bf', '333ft']);
    expect(host.querySelector('.pp-trigger')?.getAttribute('aria-label')).toBe('3×3, 2×2, 3BLD, Feet');
    expect(host.querySelectorAll('.pp-trigger-selection .pp-trigger-icon')).toHaveLength(4);
    expect(host.querySelectorAll('[role="menuitemcheckbox"]')).toHaveLength(4);
    act(() => cancelled.click());
    expect(changes).toHaveBeenLastCalledWith(['333', '222', '333bf']);
    act(() => host.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')!.click());
    expect(changes).toHaveBeenLastCalledWith(['222', '333bf']);
    expect(host.querySelector('.pp-trigger')?.getAttribute('aria-label')).toBe('2×2, 3BLD');
    expect(host.querySelectorAll('.pp-trigger-selection .pp-trigger-icon')).toHaveLength(2);
    expect(host.querySelector('.pp-popup')).not.toBeNull();
  });

  it('closes on outside touch/pointer and Escape, restoring focus for Escape', () => {
    act(() => root.render(createElement(EventSelect, { events: ['333'], value: '333', onChange: vi.fn() })));
    open();
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(host.querySelector('.pp-popup')).toBeNull();
    open();
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(host.querySelector('.pp-popup')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('.pp-trigger'));
  });

  it('normalizes recon-style short event ids before rendering icons', () => {
    act(() => root.render(createElement(EventSelect, {
      events: ['3x3', '3bld'],
      value: '3x3',
      onChange: vi.fn(),
    })));

    open();
    const items = [...host.querySelectorAll<HTMLElement>('.pp-item')];
    expect(items.map(item => item.querySelector('.cubing-icon')?.className)).toEqual([
      expect.stringContaining('event-333'),
      expect.stringContaining('event-333bf'),
    ]);
    expect(items.every(item => item.querySelector('svg'))).toBe(true);
  });

  it('uses the dedicated non-WCA icons for gear and mirror blocks', () => {
    act(() => root.render(createElement(EventSelect, {
      events: ['gear', 'mirror'],
      value: 'gear',
      onChange: vi.fn(),
    })));

    open();
    const items = [...host.querySelectorAll<HTMLElement>('.pp-item')];
    expect(items.map(item => item.querySelector('.cubing-icon')?.className)).toEqual([
      expect.stringContaining('unofficial-gear'),
      expect.stringContaining('unofficial-333_mirror_blocks'),
    ]);
    expect(items.every(item => item.querySelector('svg'))).toBe(true);
  });

  it('preserves inline editing and real hard-navigation links', () => {
    const common = { availableEvents: new Set(['333', '222']), selectedEvent: '333', isZh: false, onlyAvailable: true };
    act(() => root.render(createElement(WcaEventSelector, { ...common, presentation: 'inline' })));
    expect(host.querySelector('.pp-trigger')).toBeNull();
    expect(host.querySelectorAll('.event-btn')).toHaveLength(2);
    act(() => root.render(createElement(WcaEventSelector, { ...common, linkFor: id => ({ href: `/puzzle/${id}`, hard: true }) })));
    open();
    expect([...host.querySelectorAll('a')].map(node => node.getAttribute('href'))).toEqual(['/puzzle/333', '/puzzle/222']);
  });

  it('keeps multi-select shortcuts visible with the inline event strip', () => {
    act(() => root.render(createElement(WcaEventMultiSelector, {
      presentation: 'inline',
      availableEvents: new Set(['333', '222', '333bf']),
      selectedEvents: new Set(['333']),
      onChange: vi.fn(),
      isZh: false,
    })));

    expect(host.querySelector('.pp-trigger')).toBeNull();
    expect(host.querySelector('.wca-event-multi-toolbar')).not.toBeNull();
    expect(host.querySelectorAll('.event-btn')).toHaveLength(3);
  });
});
