// @vitest-environment jsdom

import {
  OLL_CASES,
  PLL_CASES,
  TIMER_DRILL_PICKER_COPY,
} from '@cuberoot/shared/timer';
import {
  TIMER_OVERLAY_IDS,
  TimerDrillPicker,
} from '@cuberoot/timer-ui';
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const timerUiEntry = new URL(import.meta.resolve('@cuberoot/timer-ui'));
const pickerSource = readFileSync(new URL('./TimerDrillPicker.tsx', timerUiEntry), 'utf8');
const pickerCss = readFileSync(new URL('./drill-picker.css', timerUiEntry), 'utf8');
const pillCss = readFileSync(new URL('./scramble-222-config.css', timerUiEntry), 'utf8');

describe('shared TimerDrillPicker', () => {
  let container: HTMLDivElement;
  let root: Root;
  let trigger: HTMLButtonElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 320,
    });
    trigger = document.createElement('button');
    trigger.textContent = 'Open drill';
    document.body.appendChild(trigger);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    trigger.focus();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.querySelectorAll('.timer-drill-picker__backdrop').forEach((item) => item.remove());
    container.remove();
    trigger.remove();
    vi.restoreAllMocks();
  });

  async function render(overrides: Partial<Parameters<typeof TimerDrillPicker>[0]> = {}) {
    await act(async () => root.render(createElement(TimerDrillPicker, {
      language: 'en',
      onClose: vi.fn(),
      onExit: vi.fn(),
      onPick: vi.fn(),
      ...overrides,
    })));
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
  }

  it('uses the canonical 57 OLL and 21 PLL cases, groups OLL, and prioritizes the active type', async () => {
    const activeCase = { id: PLL_CASES[0]!.id, type: 'pll' as const };
    await render({ activeCase, initialType: 'oll' });

    const dialog = document.querySelector<HTMLElement>('.timer-drill-picker__dialog')!;
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.querySelector('.timer-drill-picker__backdrop'));
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('[data-no-timer]')).not.toBeNull();
    expect(document.querySelector('[data-drill-type="pll"] [role="switch"]')?.getAttribute('aria-checked'))
      .toBe('false');
    expect(document.querySelectorAll('[data-drill-case]')).toHaveLength(21);
    expect(document.querySelector(`[data-drill-case="${activeCase.id}"]`)?.getAttribute('aria-pressed'))
      .toBe('true');
    expect(document.querySelector('.timer-drill-picker__count')?.textContent).toBe('(21)');

    await act(async () => document.querySelector<HTMLButtonElement>('[data-drill-type="pll"] [role="switch"]')!.click());
    expect(document.querySelectorAll('[data-drill-case]')).toHaveLength(57);
    expect(document.querySelector('.timer-drill-picker__count')?.textContent).toBe('(57)');
    expect(document.querySelectorAll('.timer-drill-picker__group-title').length).toBeGreaterThan(1);
    expect(OLL_CASES).toHaveLength(57);
    expect(PLL_CASES).toHaveLength(21);
  });

  it('searches canonical fields, clears search, and returns the exact target', async () => {
    const onClose = vi.fn();
    const onPick = vi.fn();
    await render({ onClose, onPick });
    const search = document.querySelector<HTMLInputElement>('.timer-drill-picker__search')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'OLL 21');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const cases = document.querySelectorAll<HTMLButtonElement>('[data-drill-case]');
    expect(cases).toHaveLength(1);
    expect(cases[0]!.dataset.drillCase).toBe('OLL 21');
    expect(document.querySelector<HTMLButtonElement>('.clear-btn')?.getAttribute('aria-label'))
      .toBe(TIMER_DRILL_PICKER_COPY.clearSearch.en);

    await act(async () => document.querySelector<HTMLButtonElement>('.clear-btn')!.click());
    expect(search.value).toBe('');

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        search,
        OLL_CASES[0]!.group,
      );
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.querySelectorAll('[data-drill-case]')).toHaveLength(0);
    await act(async () => document.querySelector<HTMLButtonElement>('.clear-btn')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[data-drill-case="OLL 21"]')!.click());
    expect(onPick).toHaveBeenCalledWith({ id: 'OLL 21', type: 'oll' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows shared empty/copy states and exits the active drill before closing', async () => {
    const onClose = vi.fn();
    const onExit = vi.fn();
    await render({
      activeCase: { id: 'OLL 21', type: 'oll' },
      language: 'zh',
      onClose,
      onExit,
    });
    expect(document.querySelector('.timer-drill-picker__title')?.textContent)
      .toContain(TIMER_DRILL_PICKER_COPY.title.zh);
    const search = document.querySelector<HTMLInputElement>('.timer-drill-picker__search')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'not-a-case');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.querySelector('[role="status"]')?.textContent)
      .toBe(TIMER_DRILL_PICKER_COPY.noMatches.zh);

    const exit = Array.from(document.querySelectorAll<HTMLButtonElement>('.timer-drill-picker__button'))
      .find((button) => button.textContent?.includes(TIMER_DRILL_PICKER_COPY.exit.zh))!;
    await act(async () => exit.click());
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps/restores focus and closes only on Escape or the actual backdrop', async () => {
    const onClose = vi.fn();
    await render({ onClose });
    const first = document.querySelector<HTMLButtonElement>('[data-drill-type] [role="switch"]')!;
    const close = Array.from(document.querySelectorAll<HTMLButtonElement>('.timer-drill-picker__button'))
      .find((button) => button.textContent === TIMER_DRILL_PICKER_COPY.close.en)!;
    const dialog = document.querySelector<HTMLDivElement>('.timer-drill-picker__dialog')!;
    const backdrop = document.querySelector<HTMLDivElement>('.timer-drill-picker__backdrop')!;
    expect(document.activeElement).toBe(first);

    close.focus();
    await act(async () => close.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab',
    })));
    expect(document.activeElement).toBe(first);
    await act(async () => first.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab',
      shiftKey: true,
    })));
    expect(document.activeElement).toBe(close);

    trigger.focus();
    expect(document.activeElement).toBe(first);
    await act(async () => dialog.click());
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => backdrop.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape',
    })));
    expect(onClose).toHaveBeenCalledTimes(2);

    await act(async () => root.render(null));
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps touch targets and the 320px dialog bounded with theme/safe-area tokens', () => {
    expect(pickerCss).toMatch(/\.timer-drill-picker__dialog \{[^}]*width: min\(100%, 720px\);[^}]*min-width: 0;[^}]*box-sizing: border-box;/s);
    expect(pickerCss).toMatch(/\.timer-drill-picker__button,[\s\S]*?\.timer-drill-picker__case \{[^}]*min-width: 44px;[^}]*min-height: 44px;/s);
    expect(pickerCss).toMatch(/\.timer-drill-picker__search \{[^}]*min-height: 44px;/s);
    expect(pickerCss).toMatch(/\.timer-drill-picker__search-wrap \.clear-btn \{[^}]*width: 44px;[^}]*height: 44px;/s);
    expect(pickerCss).toContain('env(safe-area-inset-top)');
    expect(pickerCss).toMatch(/@media \(max-height: 420px\)[\s\S]*?overflow-y: auto;[\s\S]*?flex: 0 0 min\(160px, 42vh\);/);
    expect(pickerCss).toContain('var(--modal-overlay, var(--foreground))');
    expect(pickerCss).toContain('var(--popover)');
    expect(pickerCss).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(TIMER_OVERLAY_IDS.drillPicker).toBe('timer.drill-picker');
  });

  it('locks background scroll while mounted and restores the previous body style', async () => {
    document.body.style.overflow = 'scroll';
    await render();
    expect(document.body.style.overflow).toBe('hidden');
    await act(async () => root.render(null));
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  it('contains no copied case data or host-owned translation branch', () => {
    expect(pickerSource).toContain("from '@cuberoot/shared/timer'");
    expect(pickerSource).toContain('TIMER_DRILL_PICKER_COPY');
    expect(pickerSource).not.toContain('Drill mode');
    expect(pickerSource).not.toContain('专项练习');
    expect(pickerSource).not.toContain('isZh');
  });

  it('keeps the shared green pill visible before color-mix support', () => {
    const fallback = pillCss.indexOf('background: var(--toggle-on, var(--signal-success));');
    const enhanced = pillCss.indexOf(
      'background: color-mix(in srgb, var(--toggle-on, var(--signal-success)) 72%, black);',
    );
    expect(fallback).toBeGreaterThan(-1);
    expect(enhanced).toBeGreaterThan(fallback);
  });
});
