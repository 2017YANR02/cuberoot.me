// @vitest-environment jsdom
import { act, createElement, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { usePanelClamp } from '@cuberoot/timer-ui/panel-clamp';

it('clamps centered panels at both edges and keeps an in-bounds center unchanged', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let left = -40;
  const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { left: this === document.documentElement ? 0 : left, right: 600 } as DOMRect;
  });
  const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200);
  const viewport = vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(600);
  function Panel() {
    const ref = useRef<HTMLDivElement>(null);
    usePanelClamp(true, ref);
    return createElement('div', { ref });
  }
  try {
    await act(async () => root.render(createElement(Panel)));
    expect((host.firstElementChild as HTMLElement).style.marginLeft).toBe('48px');
    left = 200;
    window.dispatchEvent(new Event('resize'));
    expect((host.firstElementChild as HTMLElement).style.marginLeft).toBe('');
    left = 460;
    window.dispatchEvent(new Event('resize'));
    expect((host.firstElementChild as HTMLElement).style.marginLeft).toBe('-68px');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    rect.mockRestore(); width.mockRestore(); viewport.mockRestore();
  }
});

it('moves right-anchored panels and flips tall menus above their trigger without drift', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const viewport = vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(390);
  const height = vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(844);
  const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200);
  const panelHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return Math.min(585, parseFloat(this.style.maxHeight) || 585);
  });
  const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this === document.documentElement) return { left: 0, right: 390 } as DOMRect;
    if (this.tagName === 'BUTTON') return { top: 610, bottom: 640 } as DOMRect;
    return { left: -3 - (parseFloat(this.style.marginRight) || 0), top: 646 + (parseFloat(this.style.marginTop) || 0) } as DOMRect;
  });
  function Panel() {
    const ref = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    usePanelClamp(true, ref, trigger);
    return createElement('div', null, createElement('button', { ref: trigger }), createElement('div', { ref, style: { boxSizing: 'border-box' } }));
  }
  try {
    await act(async () => root.render(createElement(Panel)));
    const panel = host.querySelector('button')!.nextElementSibling as HTMLElement;
    expect(panel.style.marginRight).toBe('-11px');
    expect(panel.getBoundingClientRect().left).toBe(8);
    expect(panel.getBoundingClientRect().top).toBe(19);
    expect(panel.style.maxHeight).toBe('596px');
    expect(panel.style.overflowY).toBe('auto');
    for (let i = 0; i < 3; i++) window.dispatchEvent(new Event('resize'));
    expect(panel.getBoundingClientRect().top).toBe(19);
    expect(panel.getBoundingClientRect().left).toBe(8);
  } finally {
    await act(async () => root.unmount()); host.remove();
    viewport.mockRestore(); height.mockRestore(); width.mockRestore(); panelHeight.mockRestore(); rect.mockRestore();
  }
});
