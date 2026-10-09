// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useContentRefreshKey } from '@/hooks/useContentRefreshKey';

let root: Root;
let host: HTMLDivElement;
function Probe({ enabled = true }: { enabled?: boolean }) {
  return createElement('div', null, useContentRefreshKey(enabled));
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
it('refreshes once for paired return events and never polls in the background', async () => {
  await act(async () => root.render(createElement(Probe)));
  expect(host.textContent).toBe('0');
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(host.textContent).toBe('1');
  await act(async () => vi.advanceTimersByTime(600_000));
  expect(host.textContent).toBe('1');
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(host.textContent).toBe('2');
});
it('does not interrupt input or explicitly disabled editing', async () => {
  await act(async () => root.render(createElement(Probe)));
  const input = document.createElement('input');
  host.append(input); input.focus();
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(host.firstChild?.textContent).toBe('0');
  input.remove();
  await act(async () => root.render(createElement(Probe, { enabled: false })));
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(host.textContent).toBe('0');
});
