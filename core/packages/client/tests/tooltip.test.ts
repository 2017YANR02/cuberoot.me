// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Tooltip } from '@/components/Tooltip';

it('portals outside a clipped glass parent, describes the focused trigger, clamps and dismisses with Escape', async () => {
  const host = document.createElement('div');
  host.style.overflow = 'hidden';
  host.style.backdropFilter = 'blur(10px)';
  document.body.append(host);
  const root = createRoot(host);
  const viewport = vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(390);
  const height = vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(720);
  try {
    await act(async () => root.render(createElement(Tooltip, {
      content: 'Dictate',
      children: props => createElement('button', { ...props, type: 'button' }, 'Mic'),
    })));
    const button = host.querySelector('button')!;
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ left: 389, top: 0, bottom: 36, width: 36 } as DOMRect);
    await act(async () => button.focus());
    const tooltip = document.querySelector('[role="tooltip"]')!;
    expect(tooltip.parentElement).toBe(document.body);
    expect(tooltip.getAttribute('data-site-surface')).toBe('popover');
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect((tooltip as HTMLElement).style.left).toBe('382px');
    expect((tooltip as HTMLElement).style.top).toBe('42px');
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(document.activeElement).toBe(button);
    await act(async () => { button.blur(); button.focus(); });
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove(); viewport.mockRestore(); height.mockRestore();
  }
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
});

it('keeps overflow-only labels conditional and portals inside fullscreen content', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const fullscreen = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => host });
  try {
    await act(async () => root.render(createElement(Tooltip, {
      content: 'Full name', onlyWhenOverflow: true,
      children: props => createElement('button', { ...props, type: 'button' }, 'Name'),
    })));
    const button = host.querySelector('button')!;
    await act(async () => button.focus());
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    Object.defineProperty(button, 'scrollWidth', { value: 120 });
    Object.defineProperty(button, 'clientWidth', { value: 60 });
    await act(async () => { button.blur(); button.focus(); });
    expect(document.querySelector('[role="tooltip"]')?.parentElement).toBe(host);
    await act(async () => document.dispatchEvent(new Event('fullscreenchange')));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    if (fullscreen) Object.defineProperty(document, 'fullscreenElement', fullscreen);
    else Reflect.deleteProperty(document, 'fullscreenElement');
  }
});
