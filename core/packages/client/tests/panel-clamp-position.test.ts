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
