// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIMER_EVENT_PICKER_GROUPS } from '@cuberoot/shared/timer';
import { TIMER_OVERLAY_IDS, TimerPuzzlePicker } from '@cuberoot/timer-ui';

const GROUPS = [{
  id: 'wca',
  label: 'WCA events',
  items: [
    { id: '333', label: '3×3', iconClass: 'event-333' },
    { id: '222', label: '2×2', iconClass: 'event-222' },
  ],
}];

describe('shared timer puzzle picker', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('opens the real menu and emits the selected event', () => {
    const onSelect = vi.fn<(id: string) => void>();
    act(() => {
      root.render(createElement(TimerPuzzlePicker, {
        dataNoTimer: true,
        groups: GROUPS,
        onSelect,
        puzzleLabel: 'Puzzle',
        selectedEvent: '333',
      }));
    });

    const trigger = host.querySelector<HTMLButtonElement>('.pp-trigger');
    expect(trigger?.getAttribute('aria-label')).toBe('3×3');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.pp')?.hasAttribute('data-no-timer')).toBe(true);

    act(() => trigger?.click());
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    const twoByTwo = [...host.querySelectorAll<HTMLButtonElement>('.pp-item')]
      .find((item) => item.textContent?.includes('2×2'));
    expect(twoByTwo).toBeDefined();

    act(() => twoByTwo?.click());
    expect(onSelect).toHaveBeenCalledWith('222');
    expect(host.querySelector('.pp-popup')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Escape and restores trigger focus', () => {
    act(() => {
      root.render(createElement(TimerPuzzlePicker, {
        groups: GROUPS,
        onSelect: vi.fn(),
        puzzleLabel: 'Puzzle',
        selectedEvent: '333',
      }));
    });
    const trigger = host.querySelector<HTMLButtonElement>('.pp-trigger');
    act(() => trigger?.click());
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(host.querySelector('.pp-popup')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('supports host-controlled close without changing the uncontrolled Web behavior', () => {
    const onOpenChange = vi.fn();
    const render = (open: boolean) => root.render(createElement(TimerPuzzlePicker, {
      groups: GROUPS,
      onOpenChange,
      onSelect: vi.fn(),
      open,
      puzzleLabel: 'Puzzle',
      selectedEvent: '333',
    }));
    act(() => render(true));
    expect(host.querySelector('.pp-popup')).not.toBeNull();

    act(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      id: TIMER_OVERLAY_IDS.puzzlePicker,
      reason: 'outside',
    });
    // A controlled component waits for its host instead of racing Android Back.
    expect(host.querySelector('.pp-popup')).not.toBeNull();

    act(() => render(false));
    expect(host.querySelector('.pp-popup')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('.pp-trigger'));
    act(() => render(true));
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      id: TIMER_OVERLAY_IDS.puzzlePicker,
      reason: 'escape',
    });
  });

  it('uses a runtime compact layout when the viewport is narrow', () => {
    const width = vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(360);
    act(() => {
      root.render(createElement(TimerPuzzlePicker, {
        groups: GROUPS,
        onSelect: vi.fn(),
        puzzleLabel: 'Puzzle',
        selectedEvent: '333',
      }));
    });
    expect(host.querySelector('.pp')?.classList.contains('pp--compact')).toBe(true);

    width.mockReturnValue(768);
    act(() => window.dispatchEvent(new Event('resize')));
    expect(host.querySelector('.pp')?.classList.contains('pp--compact')).toBe(false);
  });

  it('renders all 43 canonical events with a real SVG or an explicit text badge', () => {
    const groups = TIMER_EVENT_PICKER_GROUPS.map((group) => ({
      id: group.id,
      label: group.nameEn,
      items: group.items.map((item) => ({
        id: item.id,
        label: item.nameEn,
        iconClass: item.iconClass,
        textLabel: item.textLabel,
      })),
    }));
    act(() => {
      root.render(createElement(TimerPuzzlePicker, {
        groups,
        onSelect: vi.fn(),
        puzzleLabel: 'Puzzle',
        selectedEvent: '333',
      }));
    });

    act(() => host.querySelector<HTMLButtonElement>('.pp-trigger')?.click());
    const items = [...host.querySelectorAll<HTMLElement>('.pp-item')];
    expect(items).toHaveLength(43);
    expect(items.filter((item) => item.querySelector('.cubing-icon'))).toHaveLength(26);
    expect(items.filter((item) => item.querySelector('.pp-item-tag'))).toHaveLength(17);
    for (const item of items) {
      const icon = item.querySelector<HTMLElement>('.cubing-icon');
      const tag = item.querySelector<HTMLElement>('.pp-item-tag');
      expect(Boolean(icon) !== Boolean(tag), item.textContent ?? '').toBe(true);
      if (icon) expect(icon.querySelector('svg'), item.textContent ?? '').not.toBeNull();
      if (tag) expect(tag.textContent?.trim().length, item.textContent ?? '').toBeGreaterThan(0);
    }
  });
});
