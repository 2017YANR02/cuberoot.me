// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import StickyScrollGuard from '@/components/StickyScrollGuard';

let root: Root;
afterEach(async () => {
  await act(async () => root?.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it('skips mobile layout reads and restores desktop overflow after viewport or table changes', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', () => media);
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  let resize: (entries: { target: Element }[]) => void;
  const observe = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: typeof resize) { resize = callback; }
    observe = observe;
    disconnect() {}
  });
  const host = document.createElement('div');
  const tableHost = document.createElement('div');
  tableHost.className = 'sticky-scroll';
  const table = document.createElement('table');
  tableHost.append(table);
  let width = 800;
  const readWidth = vi.fn(() => width);
  Object.defineProperties(tableHost, {
    scrollWidth: { get: readWidth },
    clientWidth: { get: () => 600 },
  });
  document.body.append(host, tableHost);
  root = createRoot(host);
  await act(async () => root.render(createElement(StickyScrollGuard)));
  table.append(document.createElement('tbody'));
  await Promise.resolve();
  expect(readWidth).not.toHaveBeenCalled();
  expect(observe).not.toHaveBeenCalled();

  const viewportChanged = media.addEventListener.mock.calls[0][1] as () => void;
  const flush = () => {
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(0);
  };
  media.matches = false;
  viewportChanged();
  resize!([{ target: tableHost }, { target: table }]);
  expect(frames.size).toBe(1);
  expect(readWidth).not.toHaveBeenCalled();
  flush();
  expect(readWidth).toHaveBeenCalledTimes(1);
  expect(tableHost.classList.contains('stk-overflow')).toBe(true);

  width = 600;
  resize!([{ target: table }]);
  flush();
  expect(tableHost.classList.contains('stk-overflow')).toBe(false);

  width = 900;
  resize!([{ target: table }]);
  media.matches = true;
  viewportChanged();
  expect(frames.size).toBe(0);
  resize!([{ target: table }]);
  expect(frames.size).toBe(0);
  expect(readWidth).toHaveBeenCalledTimes(2);

  media.matches = false;
  viewportChanged();
  flush();
  expect(tableHost.classList.contains('stk-overflow')).toBe(true);
});
