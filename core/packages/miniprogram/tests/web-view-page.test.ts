import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createWebViewPageOptions,
  createWebViewPageData,
  markWebRouteFailed,
  openWebRoute,
  retryWebRoute,
  type WebViewPageContext,
} from '../src/lib/web-view-page';

function createContext(): WebViewPageContext {
  return {
    data: createWebViewPageData(),
    setData(next) {
      this.data = { ...this.data, ...next };
    },
  };
}

describe('shared web-view page state', () => {
  const setNavigationBarTitle = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('wx', {
      getStorageSync: () => null,
      removeStorageSync: vi.fn(),
      nextTick(callback: () => void) {
        callback();
      },
      setNavigationBarTitle,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    setNavigationBarTitle.mockReset();
    vi.unstubAllGlobals();
  });

  it('opens an allowlisted route and updates its title', async () => {
    const context = createContext();

    await expect(openWebRoute(context, 'timer')).resolves.toBe(true);
    expect(context.data).toEqual({
      canRetry: false,
      errorMessage: '',
      errorTitle: '',
      loadingTitle: '正在打开计时器',
      routeKey: 'timer',
      src: 'https://cuberoot.me/zh/timer',
    });
    expect(setNavigationBarTitle).toHaveBeenCalledWith({ title: '计时器' });
  });

  it('blocks unknown routes without offering a retry', async () => {
    const context = createContext();

    await expect(openWebRoute(context, 'https://example.com')).resolves.toBe(false);
    expect(context.data.src).toBe('');
    expect(context.data.errorTitle).toBe('无法打开');
    expect(context.data.canRetry).toBe(false);
  });

  it('shows a recoverable state after a web-view error', async () => {
    const context = createContext();
    await openWebRoute(context, 'alg');

    markWebRouteFailed(context);
    expect(context.data.src).toBe('');
    expect(context.data.errorTitle).toBe('网页加载失败');
    expect(context.data.canRetry).toBe(true);

    retryWebRoute(context);
    expect(context.data.src).toBe('https://cuberoot.me/zh/alg');
    expect(context.data.errorTitle).toBe('');
  });

  it('uses a one-time handoff ticket when a Mini Program session exists', async () => {
    const token = 't'.repeat(20);
    const ticket = 'A'.repeat(43);
    vi.stubGlobal('wx', {
      getStorageSync: () => ({ token, user: { name: 'CubeRoot', wcaId: null } }),
      removeStorageSync: vi.fn(),
      nextTick(callback: () => void) { callback(); },
      setNavigationBarTitle,
      request(options: {
        header: Record<string, string>;
        success(result: { statusCode: number; data: unknown }): void;
      }) {
        expect(options.header.Authorization).toBe(`Bearer ${token}`);
        options.success({ statusCode: 200, data: { ticket, expiresIn: 90 } });
      },
    });
    const context = createContext();

    await openWebRoute(context, 'timer');

    expect(context.data.src).toBe(
      `https://cuberoot.me/auth/miniprogram#ticket=${ticket}&next=%2Fzh%2Ftimer`,
    );
  });

  it('clears an expired Mini Program session and falls back to the public website route', async () => {
    const token = 't'.repeat(20);
    const removeStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => ({ token, user: { name: 'CubeRoot', wcaId: null } }),
      removeStorageSync,
      nextTick(callback: () => void) { callback(); },
      setNavigationBarTitle,
      request(options: {
        success(result: { statusCode: number; data: unknown }): void;
      }) {
        options.success({ statusCode: 401, data: { error: 'Authentication required' } });
      },
    });
    const context = createContext();

    await openWebRoute(context, 'timer');

    expect(removeStorageSync).toHaveBeenCalledWith('cuberoot:session');
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
  });

  it('never leaves the shell loading forever when the handoff request does not finish', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        token: 't'.repeat(20),
        user: { name: 'CubeRoot', wcaId: null },
      }),
      removeStorageSync: vi.fn(),
      nextTick(callback: () => void) { callback(); },
      setNavigationBarTitle,
      request() {},
    });
    const context = createContext();
    const opening = openWebRoute(context, 'timer');

    await vi.advanceTimersByTimeAsync(6_000);
    await opening;

    expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
  });

  it('does not revive a web-view after a later load error cancelled the attempt', async () => {
    let finishRequest: ((result: { statusCode: number; data: unknown }) => void) | undefined;
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        token: 't'.repeat(20),
        user: { name: 'CubeRoot', wcaId: null },
      }),
      removeStorageSync: vi.fn(),
      nextTick(callback: () => void) { callback(); },
      setNavigationBarTitle,
      request(options: {
        success(result: { statusCode: number; data: unknown }): void;
      }) {
        finishRequest = options.success;
      },
    });
    const context = createContext();
    const opening = openWebRoute(context, 'timer');

    markWebRouteFailed(context);
    finishRequest?.({
      statusCode: 200,
      data: { ticket: 'A'.repeat(43), expiresIn: 90 },
    });
    await opening;

    expect(context.data.src).toBe('');
    expect(context.data.errorTitle).toBe('网页加载失败');
  });

  it('ignores a handoff result after the page has been unloaded', async () => {
    let finishRequest: ((result: { statusCode: number; data: unknown }) => void) | undefined;
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        token: 't'.repeat(20),
        user: { name: 'CubeRoot', wcaId: null },
      }),
      removeStorageSync: vi.fn(),
      nextTick(callback: () => void) { callback(); },
      setNavigationBarTitle,
      request(options: {
        success(result: { statusCode: number; data: unknown }): void;
      }) {
        finishRequest = options.success;
      },
    });
    const context = createContext();
    const options = createWebViewPageOptions('timer') as unknown as {
      onUnload(this: WebViewPageContext): void;
    };
    const opening = openWebRoute(context, 'timer');

    options.onUnload.call(context);
    finishRequest?.({
      statusCode: 200,
      data: { ticket: 'A'.repeat(43), expiresIn: 90 },
    });
    await opening;

    expect(context.data.src).toBe('');
  });

  it('does not start a queued retry after the page has been unloaded', async () => {
    let runNextTick: (() => void) | undefined;
    vi.stubGlobal('wx', {
      getStorageSync: () => null,
      removeStorageSync: vi.fn(),
      nextTick(callback: () => void) {
        runNextTick = callback;
      },
      setNavigationBarTitle,
    });
    const context = createContext();
    await openWebRoute(context, 'alg');
    markWebRouteFailed(context);
    const options = createWebViewPageOptions('alg') as unknown as {
      onUnload(this: WebViewPageContext): void;
      retry(this: WebViewPageContext): void;
    };

    options.retry.call(context);
    options.onUnload.call(context);
    runNextTick?.();

    expect(context.data.src).toBe('');
    expect(setNavigationBarTitle).toHaveBeenCalledTimes(1);
  });
});
