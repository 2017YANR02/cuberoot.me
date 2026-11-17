// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TimerSettingsPanel } from '@cuberoot/timer-ui';
import TimerFontPicker from '@cuberoot/timer-ui/font-picker';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it.each(['trigger', 'option', 'dialog'])('Escape from the open font %s closes only the menu, then settings', async focus => {
  const close = vi.fn();
  const change = vi.fn();
  function Settings() {
    const [open, setOpen] = useState(true);
    return open ? createElement(TimerSettingsPanel, {
      language: 'en', activeCategory: 'appearance', onCategoryChange: vi.fn(),
      onClose: () => { close(); setOpen(false); },
      children: createElement(TimerFontPicker, { value: 'lcd', onChange: change }),
    }) : null;
  }
  await act(async () => root.render(createElement(Settings)));
  const trigger = document.querySelector<HTMLButtonElement>('.tfp-trigger')!;
  // Safari and accessibility clicks can open a button without moving focus.
  if (focus !== 'dialog') trigger.focus();
  await act(async () => trigger.click());
  const target = focus === 'trigger' ? trigger : document.querySelector<HTMLElement>(
    focus === 'option' ? '[role="option"]' : '[role="dialog"]',
  )!;
  target.focus();
  await act(async () => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('[role="listbox"]')).toBeNull();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(close).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);
  await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(close).toHaveBeenCalledOnce();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('keeps the font menu above a low trigger and scrollable in a short viewport', async () => {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(320);
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(180);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    const style = getComputedStyle(this);
    const extra = style.boxSizing === 'border-box' ? 0 : [style.paddingTop, style.paddingBottom,
      style.borderTopWidth, style.borderBottomWidth].reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
    return Math.min(160, (parseFloat(this.style.maxHeight) || 160) + extra);
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this === document.documentElement) return { left: 0, right: 320 } as DOMRect;
    if (this.classList.contains('tfp-trigger')) return { left: 100, top: 170, bottom: 190 } as DOMRect;
    return { left: 100, top: 196 + (parseFloat(this.style.marginTop) || 0) } as DOMRect;
  });
  await act(async () => root.render(createElement(TimerFontPicker, { value: 'lcd', onChange: vi.fn() })));
  await act(async () => host.querySelector<HTMLButtonElement>('.tfp-trigger')!.click());
  const menu = host.querySelector<HTMLElement>('[role="listbox"]')!;
  expect(menu.style.overflowY).toBe('auto');
  expect(menu.offsetHeight).toBe(156);
  expect(menu.getBoundingClientRect().top).toBe(8);
  window.dispatchEvent(new Event('resize'));
  expect(menu.getBoundingClientRect().top).toBe(8);
  expect(menu.querySelectorAll('[role="option"]')).toHaveLength(4);
});
