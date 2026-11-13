// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ProgressSlider from '@/components/ProgressSlider';

it('commits the latest keyboard position once, and ends an adjustment on focus loss', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const start = vi.fn(), end = vi.fn(), commit = vi.fn(), change = vi.fn();
  try {
    await act(async () => root.render(createElement(ProgressSlider, {
      value: 0, max: 1, step: 0.1, keyboardStep: 0.2, ariaLabel: 'Position',
      onChange: change, onCommit: commit, onInteractionStart: start, onInteractionEnd: end,
    })));
    const input = host.querySelector('input')!;
    const key = (type: string, key: string) => act(async () => {
      input.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
    });
    await key('keydown', 'ArrowRight');
    await key('keydown', 'ArrowRight');
    expect(start).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenLastCalledWith(0.4);
    expect(commit).not.toHaveBeenCalled();
    await key('keyup', 'ArrowRight');
    await key('keyup', 'ArrowRight');
    expect(commit).toHaveBeenCalledExactlyOnceWith(0.4);
    expect(end).toHaveBeenCalledTimes(1);
    await key('keydown', 'End');
    await act(async () => window.dispatchEvent(new Event('blur')));
    expect(commit).toHaveBeenLastCalledWith(1);
    expect(end).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});

it('releases only the active pointer, including cancellation outside the slider', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const end = vi.fn(), commit = vi.fn();
  try {
    await act(async () => root.render(createElement(ProgressSlider, {
      value: 5, max: 10, ariaLabel: 'Position', onChange: () => {}, onCommit: commit, onInteractionEnd: end,
    })));
    const pointer = (target: EventTarget, type: string, id: number) => act(async () => {
      const event = new MouseEvent(type, { button: 0, bubbles: true });
      Object.defineProperty(event, 'pointerId', { value: id });
      target.dispatchEvent(event);
    });
    await pointer(host.querySelector('input')!, 'pointerdown', 3);
    await pointer(window, 'pointerup', 4);
    expect(end).not.toHaveBeenCalled();
    await pointer(window, 'pointercancel', 3);
    await pointer(window, 'pointerup', 3);
    expect(end).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
