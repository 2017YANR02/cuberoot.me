// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientLoadStatus, LinkPendingIndicator } from '@/components/StartupStatus';

const navigation = vi.hoisted(() => ({ pending: false }));
vi.mock('next/link', () => ({ useLinkStatus: () => navigation }));

describe('ClientLoadStatus', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    navigation.pending = false;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it('turns a route-critical loading placeholder into an actionable timeout', async () => {
    await act(async () => root.render(createElement(ClientLoadStatus, { timeoutMs: 1_000 })));

    expect(host.querySelector('[role="status"]')).not.toBeNull();
    expect(host.querySelector('.spinner')).not.toBeNull();
    expect(host.querySelector('button')).toBeNull();

    await act(async () => vi.advanceTimersByTime(1_000));

    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector('button')?.textContent).toBe('Retry');
  });

  it('keeps link feedback outside layout and removes it when navigation ends or is cancelled', async () => {
    await act(async () => root.render(createElement(LinkPendingIndicator)));
    expect(document.querySelector('.app-navigation-loading')).toBeNull();
    navigation.pending = true;
    await act(async () => root.render(createElement(LinkPendingIndicator)));
    expect(host.childElementCount).toBe(0);
    expect(document.body.querySelector('.app-navigation-loading .spinner')).not.toBeNull();
    navigation.pending = false;
    await act(async () => root.render(createElement(LinkPendingIndicator)));
    expect(document.querySelector('.app-navigation-loading')).toBeNull();
  });
});
