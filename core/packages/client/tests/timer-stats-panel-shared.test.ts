// @vitest-environment jsdom

import type { RollingStatKey, Solve } from '@cuberoot/shared/timer';
import {
  TimerRollingStatsPicker,
  TimerStatsPanel,
  type TimerRollingStatsPickerLabels,
  type TimerStatsPanelLabels,
} from '@cuberoot/timer-ui';
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pickerLabels: TimerRollingStatsPickerLabels = {
  changeColumn: current => `Change stats column, currently ${current}`,
  clear: 'Clear',
  customPlaceholder: 'Custom ao',
  customSize: 'Custom ao size',
  replace: 'Replace',
};

const labels: TimerStatsPanelLabels = {
  best: 'best',
  bestBo3: 'best bo3',
  bestMo3: 'best mo3',
  count: 'count',
  current: 'current',
  hideExtras: 'Hide extras',
  mean: 'mean',
  rollingPicker: pickerLabels,
  showAllStats: 'Show all stats',
  single: 'time',
  subX: 'Sub-X',
  worst: 'worst',
};

function solve(id: string, timeMs: number, overrides: Partial<Solve> = {}): Solve {
  return {
    id,
    timeMs,
    penalty: 'ok',
    scramble: `R U ${id}`,
    event: '333',
    ts: Number(id),
    ...overrides,
  };
}

describe('shared compact TimerStatsPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.querySelectorAll('.compact-select-popup').forEach(panel => panel.remove());
    vi.restoreAllMocks();
  });

  it('keeps the Web rows, exact values, PR slot, extras, and Sub-X', async () => {
    const solves = [
      solve('1', 10_000),
      solve('2', 11_000),
      solve('3', 9_000),
      solve('4', 12_000),
      solve('5', 8_000),
    ];
    await act(async () => root.render(createElement(TimerStatsPanel, {
      event: '333',
      labels,
      onRollingColumnsChange: vi.fn(),
      renderPrBadge: ({ rowKey }) => createElement('span', { 'data-pr-row': rowKey }, 'PR'),
      rollingColumns: ['ao5', 'ao12'],
      solves,
    })));

    expect(Array.from(container.querySelectorAll('[data-stat-row]')).map(row => ({
      best: row.querySelector('.st-best')?.textContent,
      current: row.querySelector('.st-cur')?.textContent,
      key: row.getAttribute('data-stat-row'),
    }))).toEqual([
      { key: 'time', current: '8.00', best: '8.00PR' },
      { key: 'ao5', current: '10.00', best: '10.00PR' },
      { key: 'ao12', current: '-', best: '-' },
    ]);
    expect(Array.from(container.querySelectorAll('[data-pr-row]')).map(node => node.getAttribute('data-pr-row')))
      .toEqual(['time', 'ao5']);
    expect(container.querySelector('.stats-foot')?.textContent).toContain('count 5');
    expect(container.querySelector('.subx-section h3')?.textContent).toBe('Sub-X');

    const toggle = container.querySelector<HTMLButtonElement>('.stats-expand-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(Array.from(container.querySelectorAll('.stats-grid .row')).map(row => row.textContent)).toEqual([
      'mean10.00',
      'worst12.00',
      'mo39.66',
      'best mo39.66',
      'bo38.00',
      'best bo38.00',
    ]);
    await act(async () => toggle.click());
    expect(container.querySelector('.stats-grid')).toBeNull();
  });

  it('ranks and formats the MBLD best attempt by points before time', async () => {
    const solves = [
      solve('1', 600_000, { event: '333mbld', mbld: { solved: 8, attempted: 10 } }),
      solve('2', 700_000, { event: '333mbld', mbld: { solved: 10, attempted: 14 } }),
    ];
    await act(async () => root.render(createElement(TimerStatsPanel, {
      event: '333mbld',
      labels,
      onRollingColumnsChange: vi.fn(),
      rollingColumns: ['ao5', 'ao12'],
      solves,
    })));
    const row = container.querySelector('[data-stat-row="time"]')!;
    expect(row.querySelector('.st-cur')?.textContent).toBe('10/14 11:40');
    expect(row.querySelector('.st-best')?.textContent).toBe('8/10 10:00');
    expect(Array.from(container.querySelectorAll('[data-stat-row]')).map(node => (
      node.getAttribute('data-stat-row')
    ))).toEqual(['time']);
    expect(container.querySelector('.rolling-stats-column-pickers')).toBeNull();
  });
});

describe('shared TimerRollingStatsPicker interaction and viewport contract', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalVisualViewport: PropertyDescriptor | undefined;
  let originalScrollWidth: PropertyDescriptor | undefined;
  let originalScrollHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 320 });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 500 });
    originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const viewport = Object.assign(new EventTarget(), {
      height: 500, offsetLeft: 0, offsetTop: 0, width: 320,
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
    originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() { return (this as HTMLElement).classList?.contains('compact-select-popup') ? 500 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() { return (this as HTMLElement).classList?.contains('compact-select-popup') ? 600 : 0; },
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('compact-select-trigger')) {
        return {
          x: 270, y: 30, left: 270, top: 30, right: 310, bottom: 62,
          width: 40, height: 32, toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0, y: 0, left: 0, top: 0, right: 500, bottom: 600,
        width: 500, height: 600, toJSON: () => ({}),
      } as DOMRect;
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.querySelectorAll('.compact-select-popup').forEach(panel => panel.remove());
    if (originalVisualViewport) Object.defineProperty(window, 'visualViewport', originalVisualViewport);
    else Reflect.deleteProperty(window, 'visualViewport');
    if (originalScrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth);
    if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
    vi.restoreAllMocks();
  });

  async function render(onColumnsChange: (columns: RollingStatKey[]) => void, triggerColumns = ['ao5', 'ao12'] as RollingStatKey[]) {
    await act(async () => root.render(createElement(TimerRollingStatsPicker, {
      columns: ['ao5', 'ao12'], labels: pickerLabels, onColumnsChange, triggerColumns,
      variant: 'header', viewportBottomInset: 64,
    })));
  }

  async function openFirst() {
    const trigger = container.querySelector<HTMLButtonElement>('.compact-select-trigger')!;
    await act(async () => trigger.click());
    await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
    return { panel: document.querySelector<HTMLDivElement>('.compact-select-popup')!, trigger };
  }

  it('portals/clamps the menu and replaces a preset without duplicates', async () => {
    const onColumnsChange = vi.fn();
    await render(onColumnsChange);
    const { panel } = await openFirst();
    expect(container.contains(panel)).toBe(false);
    expect(panel.style.visibility).toBe('visible');
    expect(Number.parseFloat(panel.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(panel.style.left) + Number.parseFloat(panel.style.maxWidth)).toBeLessThanOrEqual(312);
    expect(Number.parseFloat(panel.style.top) + Number.parseFloat(panel.style.maxHeight)).toBeLessThanOrEqual(428);
    const ao25 = Array.from(panel.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find(option => option.textContent === 'ao25')!;
    await act(async () => ao25.click());
    expect(onColumnsChange).toHaveBeenCalledWith(['ao12', 'ao25']);
    expect(document.querySelector('.compact-select-popup')).toBeNull();
  });

  it('validates custom aoN, supports Enter, and restores Escape focus', async () => {
    const onColumnsChange = vi.fn();
    await render(onColumnsChange, ['ao5']);
    const first = await openFirst();
    const input = first.panel.querySelector<HTMLInputElement>('.rolling-stats-custom-input')!;
    const replace = first.panel.querySelector<HTMLButtonElement>('.rolling-stats-custom-add')!;
    expect(replace.disabled).toBe(true);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '37');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(replace.disabled).toBe(false);
    expect(first.panel.querySelector('button[aria-label="Clear"]')).not.toBeNull();
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, key: 'Enter',
    })));
    expect(onColumnsChange).toHaveBeenCalledWith(['ao12', 'ao37']);
    const second = await openFirst();
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    expect(document.querySelector('.compact-select-popup')).toBeNull();
    expect(document.activeElement).toBe(second.trigger);
  });
});

describe('Web statistics adapters', () => {
  it('stay injection-only over public timer-ui and leave no duplicated CSS', () => {
    const statsWrapper = readFileSync('app/[lang]/timer/_components/StatsPanel.tsx', 'utf8');
    const pickerWrapper = readFileSync('app/[lang]/timer/_components/RollingStatsPicker.tsx', 'utf8');
    const compactWrapper = readFileSync('components/CompactSelect.tsx', 'utf8');
    const timerCss = readFileSync('app/[lang]/timer/timer.css', 'utf8');
    expect(statsWrapper).toContain("from '@cuberoot/timer-ui'");
    expect(statsWrapper).toContain('<TimerStatsPanel');
    expect(statsWrapper).toContain('renderPrBadge=');
    expect(statsWrapper).not.toContain('bestSingle(');
    expect(statsWrapper).not.toContain('useState(');
    expect(pickerWrapper).toContain('<TimerRollingStatsPicker');
    expect(pickerWrapper).not.toContain('<CompactSelect');
    expect(compactWrapper).toContain("from '@cuberoot/timer-ui/compact-select'");
    expect(compactWrapper).not.toContain('useLayoutEffect');
    expect(timerCss).not.toContain('.stats-table {');
    expect(timerCss).not.toContain('.rolling-stats-custom {');
  });
});
