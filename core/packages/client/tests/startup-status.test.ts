// @vitest-environment jsdom

import { act, createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientLoadStatus, LinkPendingIndicator, NavigationLoadingHost } from '@/components/StartupStatus';

const navigation = vi.hoisted(() => ({ pending: false }));
vi.mock('next/link', () => ({ useLinkStatus: () => navigation }));
vi.mock('@/lib/theme', () => ({ useEffectiveTheme: () => 'light' }));
const navigationTree = () => createElement(Fragment, null, createElement(NavigationLoadingHost), createElement(LinkPendingIndicator));

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
    expect(host.querySelector('.loading-brand-mark')).not.toBeNull();
    expect(host.querySelector('button')).toBeNull();

    await act(async () => vi.advanceTimersByTime(1_000));

    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector('button')?.textContent).toBe('Retry');
  });

  it('keeps link feedback outside layout and removes it when navigation ends or is cancelled', async () => {
    await act(async () => root.render(navigationTree()));
    expect(document.querySelector('.app-navigation-loading')).toBeNull();
    navigation.pending = true;
    await act(async () => root.render(navigationTree()));
    expect(host.childElementCount).toBe(0);
    expect(document.querySelector('.app-navigation-loading')).toBeNull();
    await act(async () => vi.advanceTimersByTime(249));
    expect(document.querySelector('.app-navigation-loading')).toBeNull();
    await act(async () => vi.advanceTimersByTime(1));
    expect(document.body.querySelector('.app-navigation-loading .loading-brand-mark')).not.toBeNull();
    navigation.pending = false;
    await act(async () => root.render(navigationTree()));
    expect(document.querySelector('.app-navigation-loading.is-leaving')).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(180));
    expect(document.querySelector('.app-navigation-loading')).toBeNull();
  });
  it('never flashes feedback for a fast navigation', async () => {
    navigation.pending = true;
    await act(async () => root.render(navigationTree()));
    await act(async () => vi.advanceTimersByTime(100));
    navigation.pending = false;
    await act(async () => root.render(navigationTree()));
    await act(async () => vi.advanceTimersByTime(500));
    expect(document.querySelector('.app-navigation-loading')).toBeNull();
  });
});
