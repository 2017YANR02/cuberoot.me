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

  it('opens formula choices without selecting the project and restores focus between levels', () => {
    const onSelect = vi.fn();
    act(() => root.render(createElement(TimerPuzzlePicker, {
      groups: [{ id: 'training', label: 'Puzzle', items: [{
        id: '333', label: '3×3', children: [
          { id: '/alg/3x3/oll/select', label: 'OLL' },
          { id: '/alg/3x3/pll/select', label: 'PLL' },
        ],
      }] }],
      onSelect,
      puzzleLabel: 'Puzzle',
      triggerLabel: 'Training',
      submenuLabel: 'Algorithms',
      showItemIcons: false,
      selectedEvent: '',
    })));
    const trigger = host.querySelector<HTMLButtonElement>('.pp-trigger')!;
    act(() => trigger.click());
    const puzzle = host.querySelector<HTMLButtonElement>('.pp-item')!;
    act(() => puzzle.click());
    expect(onSelect).not.toHaveBeenCalled();
    expect(puzzle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.textContent).toBe('OLL');
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(host.querySelector('.pp-cascade-options')).toBeNull();
    expect(host.querySelector('.pp-popup')).not.toBeNull();
    expect(document.activeElement).toBe(puzzle);
    act(() => puzzle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    act(() => host.querySelector<HTMLButtonElement>('.pp-cascade-options button')!.click());
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('/alg/3x3/oll/select');
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

  it('renders all 64 canonical events with a real SVG or an explicit text badge', () => {
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
    expect(items).toHaveLength(64);
    expect(items.filter((item) => item.querySelector('.cubing-icon'))).toHaveLength(27);
    expect(items.filter((item) => item.querySelector('.pp-item-tag'))).toHaveLength(37);
    for (const item of items) {
      const icon = item.querySelector<HTMLElement>('.cubing-icon');
      const tag = item.querySelector<HTMLElement>('.pp-item-tag');
      expect(Boolean(icon) !== Boolean(tag), item.textContent ?? '').toBe(true);
      if (icon) expect(icon.querySelector('svg'), item.textContent ?? '').not.toBeNull();
      if (tag) expect(tag.textContent?.trim().length, item.textContent ?? '').toBeGreaterThan(0);
    }
  });

  it('moves every 3x3 training mode into types while preserving its stored identity', () => {
    const groups = TIMER_EVENT_PICKER_GROUPS.map((group) => ({
      id: group.id, label: group.nameEn,
      items: group.items.map((item) => ({ id: item.id, label: item.nameEn })),
    }));
    const onSelect = vi.fn();
    const render = (selectedEvent: string, disabled = false) => act(() => root.render(createElement(TimerPuzzlePicker, {
      groups, selectedEvent, onSelect, disabled, dataNoTimer: true,
      puzzleLabel: 'Puzzle', scrambleTypeLabel: 'Scramble type',
    })));
    const typeIds = ['333', 'cross', 'f2l', 'll', 'oll', 'pll', 'coll', 'cmll', 'zbll', 'cll', 'ell', 'eocp', '2gll', 'ollcp', 'zzll', 'zbls', 'lse', 'l10p'];
    for (const selectedEvent of typeIds) {
      render(selectedEvent);
      expect(host.querySelector('.pp-trigger')?.getAttribute('aria-label')).toBe('3×3');
      act(() => host.querySelector<HTMLButtonElement>('[aria-label="Scramble type"]')!.click());
      const options = [...document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')];
      expect(options).toHaveLength(typeIds.length);
      expect(options[typeIds.indexOf(selectedEvent)].getAttribute('aria-selected')).toBe('true');
      for (const [index, option] of options.entries()) {
        if (index !== typeIds.indexOf(selectedEvent)) expect(option.getAttribute('aria-selected')).toBe('false');
      }
      act(() => options[typeIds.indexOf(selectedEvent)].click());
      expect(onSelect).toHaveBeenLastCalledWith(selectedEvent);
    }
    act(() => host.querySelector<HTMLButtonElement>('.pp-trigger')!.click());
    expect(host.querySelectorAll('.pp-item')).toHaveLength(47);
    expect([...host.querySelectorAll('.pp-item')].some(item => item.textContent === 'ZBLL')).toBe(false);
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    render('222');
    expect(host.querySelector('[aria-label="Scramble type"]')).toBeNull();
    render('333');
    expect(host.querySelector('[aria-label="Scramble type"]')?.textContent).toBe('WCA');
    render('zbll', true);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Scramble type"]')!.disabled).toBe(true);
  });

  it('coordinates the type menu with host Back and restores its trigger focus', () => {
    const onOpenChange = vi.fn();
    const groups = [{ ...GROUPS[0], items: [...GROUPS[0].items, { id: 'zbll', label: 'ZBLL', iconClass: '' }] }];
    const render = (open: boolean) => act(() => root.render(createElement(TimerPuzzlePicker, {
      groups, selectedEvent: 'zbll', onSelect: vi.fn(), open, onOpenChange,
      puzzleLabel: 'Puzzle', scrambleTypeLabel: 'Scramble type',
    })));
    render(false);
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Scramble type"]')!.click());
    expect(onOpenChange).toHaveBeenLastCalledWith(true, { id: TIMER_OVERLAY_IDS.puzzlePicker, reason: 'trigger' });
    render(true);
    expect(document.body.querySelector('[role="listbox"][aria-label="Scramble type"]')).not.toBeNull();
    expect(host.querySelector('.pp-popup')).toBeNull();
    render(false);
    expect(document.body.querySelector('[role="listbox"][aria-label="Scramble type"]')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('[aria-label="Scramble type"]'));
  });

  it('preserves WCA selector spellings in filtered multiplayer catalogs', () => {
    act(() => root.render(createElement(TimerPuzzlePicker, {
      groups: [{ ...GROUPS[0], items: [...GROUPS[0].items, { id: '333bf', label: '3BLD', iconClass: 'event-333bf' }] }],
      selectedEvent: '333bf', onSelect: vi.fn(), puzzleLabel: 'Puzzle', scrambleTypeLabel: 'Scramble type',
    })));
    expect(host.querySelector('.pp-trigger')?.getAttribute('aria-label')).toBe('3BLD');
    expect(host.querySelector('[aria-label="Scramble type"]')).toBeNull();
  });
  it('keeps EG and 3x3 training identities under their puzzles in the combined source menu', () => {
    const groups = TIMER_EVENT_PICKER_GROUPS.map((group) => ({
      id: group.id, label: group.nameEn,
      items: group.items.map((item) => ({ id: item.id, label: item.nameEn })),
    }));
    for (const [selectedEvent, puzzle] of [['eg1', '2×2'], ['eg2', '2×2'], ['cross', '3×3'], ['ll', '3×3']]) {
      act(() => root.render(createElement(TimerPuzzlePicker, {
        groups, selectedEvent, onSelect: vi.fn(), puzzleLabel: 'Puzzle',
        scrambleTypeLabel: 'Scramble type', combineScrambleTypes: true,
      })));
      expect(host.querySelector('.pp-trigger')?.getAttribute('aria-label')).toBe(puzzle);
      expect(host.querySelector('[aria-label="Scramble type"]')).toBeNull();
      act(() => host.querySelector<HTMLButtonElement>('.pp-trigger')!.click());
      expect(host.querySelectorAll('.pp-item')).toHaveLength(45);
      act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    }
  });

});
