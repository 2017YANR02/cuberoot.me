// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientLoadStatus } from '@/components/StartupStatus';

describe('ClientLoadStatus', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it('turns a route-critical loading placeholder into an actionable timeout', async () => {
    await act(async () => root.render(createElement(ClientLoadStatus, { timeoutMs: 1_000 })));

    expect(host.querySelector('[role="status"]')).not.toBeNull();
    expect(host.querySelector('button')).toBeNull();

    await act(async () => vi.advanceTimersByTime(1_000));

    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector('button')?.textContent).toBe('Retry');
  });
});
