// @vitest-environment jsdom

import {
  EVENTS,
  TIMER_MORE_ACTION_CONTRACTS,
  TIMER_MORE_ACTION_COPY,
  TIMER_MORE_ACTION_IDS,
  timerMoreActionStates,
  visibleTimerMoreActions,
  type EventId,
  type TimerMoreActionContext,
} from '@cuberoot/shared/timer';
import { TimerMoreMenu, type TimerMoreMenuItem } from '@cuberoot/timer-ui';
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const baseContext: TimerMoreActionContext = {
  compactViewport: false,
  drillActive: false,
  event: '333',
  fullscreen: false,
  solveCount: 3,
};

const DESKTOP_333_IDS = [
  'more.marks',
  'more.drill',
  'more.fullscreen',
  'more.manual-entry',
  'more.replay',
  'more.solver',
  'more.bulk',
  'more.print',
  'more.clear-event',
];

describe('canonical timer More action registry', () => {
  it('locks all IDs, order, visibility policy, disabled policy, and effect semantics', () => {
    expect(TIMER_MORE_ACTION_IDS).toEqual([
      'more.marks',
      'more.stats-mobile',
      'more.language-mobile',
      'more.drill',
      'more.bld-helper',
      'more.fullscreen',
      'more.manual-entry',
      'more.replay',
      'more.solver',
      'more.bulk',
      'more.print',
      'more.clear-event',
    ]);
    expect(TIMER_MORE_ACTION_CONTRACTS).toEqual([
      { id: 'more.marks', effect: 'navigate-scramble-marks', visibility: 'always', disabledWhen: 'never', danger: false },
      { id: 'more.stats-mobile', effect: 'open-full-stats', visibility: 'compact-viewport', disabledWhen: 'never', danger: false },
      { id: 'more.language-mobile', effect: 'toggle-language', visibility: 'compact-viewport', disabledWhen: 'never', danger: false },
      { id: 'more.drill', effect: 'open-drill-picker', visibility: 'drill-event', disabledWhen: 'never', danger: false },
      { id: 'more.bld-helper', effect: 'open-speffz-helper', visibility: 'speffz-event', disabledWhen: 'never', danger: false },
      { id: 'more.fullscreen', effect: 'toggle-fullscreen', visibility: 'always', disabledWhen: 'never', danger: false },
      { id: 'more.manual-entry', effect: 'open-manual-result-entry', visibility: 'always', disabledWhen: 'never', danger: false },
      { id: 'more.replay', effect: 'prompt-and-import-replay', visibility: 'always', disabledWhen: 'never', danger: false },
      { id: 'more.solver', effect: 'open-general-333-solver', visibility: 'always', disabledWhen: 'never', danger: false },
      { id: 'more.bulk', effect: 'open-bulk-scramble-generator', visibility: 'always', disabledWhen: 'never', danger: false },
      { id: 'more.print', effect: 'print-timer', visibility: 'always', disabledWhen: 'never', danger: false },
      { id: 'more.clear-event', effect: 'confirm-clear-current-event', visibility: 'always', disabledWhen: 'no-current-event-solves', danger: true },
    ]);
    expect(Object.keys(TIMER_MORE_ACTION_COPY)).toEqual(TIMER_MORE_ACTION_IDS);
    for (const id of TIMER_MORE_ACTION_IDS) {
      expect(TIMER_MORE_ACTION_COPY[id].en.length).toBeGreaterThan(0);
      expect(TIMER_MORE_ACTION_COPY[id].zh.length).toBeGreaterThan(0);
    }
  });

  it('matches the exact desktop/compact sets and preserves canonical order', () => {
    expect(visibleTimerMoreActions(baseContext).map((action) => action.id)).toEqual(DESKTOP_333_IDS);
    expect(visibleTimerMoreActions({ ...baseContext, compactViewport: true }).map((action) => action.id)).toEqual([
      'more.marks',
      'more.stats-mobile',
      'more.language-mobile',
      ...DESKTOP_333_IDS.slice(1),
    ]);
  });

  it('exhaustively applies the two event-conditioned visibility rules', () => {
    const drillEvents = new Set<EventId>(['333', '333oh', '333fm', 'oll', 'pll']);
    const speffzEvents = new Set<EventId>(['333bld', '333ni', '333mbld']);
    expect(EVENTS).toHaveLength(43);
    for (const event of EVENTS.map((info) => info.id)) {
      const states = timerMoreActionStates({ ...baseContext, event });
      expect(states.find((action) => action.id === 'more.drill')?.visible).toBe(drillEvents.has(event));
      expect(states.find((action) => action.id === 'more.bld-helper')?.visible).toBe(speffzEvents.has(event));
    }
    const activeDrill = timerMoreActionStates({ ...baseContext, drillActive: true })
      .find((action) => action.id === 'more.drill');
    expect(activeDrill?.visible).toBe(true);
    expect(activeDrill?.active).toBe(true);
  });

  it('only disables clear for an empty/invalid current-event solve count and tracks fullscreen', () => {
    for (const solveCount of [0, -1, Number.NaN]) {
      const states = timerMoreActionStates({ ...baseContext, solveCount });
      expect(states.find((action) => action.id === 'more.clear-event')?.disabled).toBe(true);
    }
    const states = timerMoreActionStates({ ...baseContext, fullscreen: true, solveCount: 1 });
    expect(states.find((action) => action.id === 'more.clear-event')?.disabled).toBe(false);
    expect(states.find((action) => action.id === 'more.fullscreen')?.active).toBe(true);
    expect(states.filter((action) => action.active).map((action) => action.id)).toEqual(['more.fullscreen']);
  });
});

describe('Web More host stays a thin adapter over the shared registry/UI', () => {
  it('uses the canonical resolver/copy and binds every canonical effect ID', () => {
    const solo = readFileSync('app/[lang]/timer/_shell/SoloView.tsx', 'utf8');
    expect(solo).toContain('visibleTimerMoreActions({');
    expect(solo).toContain('TIMER_MORE_ACTION_COPY[action.id]');
    for (const id of TIMER_MORE_ACTION_IDS) expect(solo).toContain(`case '${id}'`);
    expect(solo).not.toContain("['333', '333oh', '333fm', 'oll', 'pll'].includes(event)");
  });

  it('keeps Next navigation only in the wrapper and the React menu in timer-ui', () => {
    const wrapper = readFileSync('app/[lang]/timer/_components/MoreMenu.tsx', 'utf8');
    expect(wrapper).toContain("from '@cuberoot/timer-ui'");
    expect(wrapper).toContain('<TimerMoreMenu');
    expect(wrapper).toContain('<AppLink');
    expect(wrapper).not.toContain('useState(');
    expect(wrapper).not.toContain('document.addEventListener');
  });
});

describe('shared TimerMoreMenu interaction and viewport contract', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalVisualViewport: PropertyDescriptor | undefined;
  let originalScrollWidth: PropertyDescriptor | undefined;
  let originalScrollHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 460 });
    originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const viewport = new EventTarget() as EventTarget & {
      height: number;
      offsetLeft: number;
      offsetTop: number;
      width: number;
    };
    viewport.height = 420;
    viewport.offsetLeft = 10;
    viewport.offsetTop = 10;
    viewport.width = 280;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
    originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() { return (this as HTMLElement).classList?.contains('more-menu-panel') ? 520 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() { return (this as HTMLElement).classList?.contains('more-menu-panel') ? 620 : 0; },
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('more-menu-btn')) {
        return {
          x: 248, y: 30, left: 248, top: 30, right: 284, bottom: 66,
          width: 36, height: 36, toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0, y: 0, left: 0, top: 0, right: 520, bottom: 620,
        width: 520, height: 620, toJSON: () => ({}),
      } as DOMRect;
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.querySelectorAll('.more-menu-panel').forEach((panel) => panel.remove());
    if (originalVisualViewport) Object.defineProperty(window, 'visualViewport', originalVisualViewport);
    else Reflect.deleteProperty(window, 'visualViewport');
    if (originalScrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth);
    if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
    vi.restoreAllMocks();
  });

  async function render(items: readonly TimerMoreMenuItem[]) {
    await act(async () => root.render(createElement(TimerMoreMenu, {
      items,
      triggerClassName: 'host-trigger',
      triggerLabel: 'More actions with a deliberately long accessible English name',
      viewportBottomInset: 84,
    })));
  }

  async function openMenu() {
    const trigger = container.querySelector<HTMLButtonElement>('.more-menu-btn')!;
    await act(async () => trigger.click());
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    return { panel: document.querySelector<HTMLDivElement>('.more-menu-panel')!, trigger };
  }

  function fixtureItems(select: () => void): TimerMoreMenuItem[] {
    return visibleTimerMoreActions({ ...baseContext, compactViewport: true, solveCount: 0 }).map((action) => ({
      ...action,
      href: action.id === 'more.marks' ? '/timer/marks' : undefined,
      label: `${TIMER_MORE_ACTION_COPY[action.id].en} — an intentionally long label for narrow screens`,
      onSelect: action.id === 'more.manual-entry' ? select : undefined,
    }));
  }

  it('portals and clamps long content inside visualViewport, bottom nav, and narrow width', async () => {
    await render(fixtureItems(vi.fn()));
    const { panel } = await openMenu();
    expect(container.contains(panel)).toBe(false);
    expect(panel.parentElement).toBe(document.body);
    expect(panel.style.visibility).toBe('visible');
    expect(Number.parseFloat(panel.style.left)).toBeGreaterThanOrEqual(18);
    expect(Number.parseFloat(panel.style.left) + Number.parseFloat(panel.style.width)).toBeLessThanOrEqual(282);
    expect(Number.parseFloat(panel.style.top) + Number.parseFloat(panel.style.maxHeight)).toBeLessThanOrEqual(338);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
    expect(document.activeElement?.textContent).toContain('Scramble marks');
  });

  it('closes on Escape/outside, restores Escape focus, and skips disabled items for arrows', async () => {
    await render(fixtureItems(vi.fn()));
    const first = await openMenu();
    await act(async () => first.panel.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, key: 'End',
    })));
    expect(document.activeElement?.textContent).not.toContain('Clear current event');

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(document.querySelector('.more-menu-panel')).toBeNull();
    expect(document.activeElement).toBe(first.trigger);

    await openMenu();
    await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(document.querySelector('.more-menu-panel')).toBeNull();
  });

  it('runs a real bound effect, closes, and makes unbound/disabled actions inert', async () => {
    const select = vi.fn();
    await render(fixtureItems(select));
    const { panel, trigger } = await openMenu();
    const clear = Array.from(panel.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Clear current event'))!;
    const solver = Array.from(panel.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Solver'))!;
    const manual = Array.from(panel.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Manual entry'))!;
    expect(clear.disabled).toBe(true);
    expect(solver.disabled).toBe(true);
    await act(async () => clear.click());
    await act(async () => solver.click());
    expect(select).not.toHaveBeenCalled();
    expect(document.querySelector('.more-menu-panel')).not.toBeNull();

    await act(async () => manual.click());
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(select).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.more-menu-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('exposes active actions visually and semantically', async () => {
    await render([{
      ...timerMoreActionStates({ ...baseContext, drillActive: true })
        .find((action) => action.id === 'more.drill')!,
      label: 'Drill mode',
      onSelect: vi.fn(),
    }]);
    const { panel } = await openMenu();
    const drill = panel.querySelector<HTMLButtonElement>('[role="menuitem"]')!;
    expect(drill.classList.contains('active')).toBe(true);
    expect(drill.getAttribute('aria-current')).toBe('true');
  });
});
