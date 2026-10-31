// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useHomeScrollRestoration } from '@/hooks/useHomeScrollRestoration';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let resize: () => void;
let height = 4000;
const disconnect = vi.fn();
function Probe({ ready = true }: { ready?: boolean }) {
  useHomeScrollRestoration(ready);
  return createElement('a', { href: '/memo/colpi', onClick: (e: MouseEvent) => e.preventDefault() }, 'Memo');
}
async function mount(ready = true) {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(Probe, { ready })));
}
beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  history.replaceState(null, '', '/zh');
  height = 4000;
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => height });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  vi.spyOn(window, 'scrollTo').mockImplementation((options) => {
    window.scrollY = (options as ScrollToOptions).top ?? 0;
    window.dispatchEvent(new Event('scroll'));
  });
  disconnect.mockClear();
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('restores after a child-page visit without saving the navigation reset', async () => {
  await mount();
  window.scrollY = 1400;
  window.dispatchEvent(new Event('scroll'));
  document.querySelector('a')!.click();
  window.scrollY = 0;
  window.dispatchEvent(new Event('scroll'));
  expect(sessionStorage.getItem('home-scroll:/zh')).toBe('1400');
  await act(async () => root!.unmount());
  history.replaceState(null, '', '/zh/memo/colpi');
  window.dispatchEvent(new Event('scroll'));
  history.replaceState(null, '', '/zh');
  await mount();
  await vi.advanceTimersByTimeAsync(20);
  expect(window.scrollY).toBe(1400);
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
  resize();
  await vi.advanceTimersByTimeAsync(20);
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
});

it('waits for layout height without overwriting the saved target', async () => {
  sessionStorage.setItem('home-scroll:/zh', '1800');
  height = 1000;
  await mount();
  await vi.advanceTimersByTimeAsync(20);
  expect(window.scrollY).toBe(200);
  expect(sessionStorage.getItem('home-scroll:/zh')).toBe('1800');
  height = 4000;
  resize();
  await vi.advanceTimersByTimeAsync(20);
  expect(window.scrollY).toBe(1800);
  expect(disconnect).toHaveBeenCalledTimes(1);
});

it('stops restoring when the user scrolls and cleans up on unmount', async () => {
  sessionStorage.setItem('home-scroll:/zh', '1800');
  height = 1000;
  await mount();
  window.dispatchEvent(new Event('wheel'));
  height = 4000;
  resize();
  await vi.advanceTimersByTimeAsync(3100);
  expect(window.scrollTo).not.toHaveBeenCalled();
  await act(async () => root!.unmount());
  root = undefined;
  window.scrollY = 500;
  window.dispatchEvent(new Event('scroll'));
  expect(sessionStorage.getItem('home-scroll:/zh')).toBe('1800');
});

it('leaves first visits and explicit hash navigation alone', async () => {
  await mount();
  await vi.advanceTimersByTimeAsync(20);
  expect(window.scrollTo).not.toHaveBeenCalled();
  await act(async () => root!.unmount());
  sessionStorage.setItem('home-scroll:/zh', '1800');
  history.replaceState(null, '', '/zh#train');
  await mount();
  await vi.advanceTimersByTimeAsync(20);
  expect(window.scrollTo).not.toHaveBeenCalled();
});
