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
      viewAttempt: 1,
    });
    expect(setNavigationBarTitle).toHaveBeenCalledWith({ title: '计时器' });
  });

  it('still opens the route when the cosmetic title API throws', async () => {
    setNavigationBarTitle.mockImplementationOnce(() => {
      throw new Error('title unavailable');
    });
    const context = createContext();

    await expect(openWebRoute(context, 'timer')).resolves.toBe(true);
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
    expect(context.data.errorTitle).toBe('');
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

  it('retries immediately when nextTick throws', async () => {
    vi.stubGlobal('wx', {
      getStorageSync: () => null,
      removeStorageSync: vi.fn(),
      nextTick() {
        throw new Error('scheduler unavailable');
      },
      setNavigationBarTitle,
    });
    const context = createContext();
    await openWebRoute(context, 'timer');
    markWebRouteFailed(context);

    retryWebRoute(context);

    expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
    expect(context.data.errorTitle).toBe('');
  });

  it('retries immediately when the fallback timer cannot be created', async () => {
    const context = createContext();
    await openWebRoute(context, 'timer');
    markWebRouteFailed(context);
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
      throw new Error('timer unavailable');
    });

    try {
      expect(() => retryWebRoute(context)).not.toThrow();
      expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
      expect(context.data.errorTitle).toBe('');
    } finally {
      timer.mockRestore();
    }
  });

  it('retries once when the fallback timer fires synchronously', async () => {
    const context = createContext();
    await openWebRoute(context, 'timer');
    markWebRouteFailed(context);
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback) => {
      if (typeof callback === 'function') callback();
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });

    try {
      expect(() => retryWebRoute(context)).not.toThrow();
      expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
      expect(setNavigationBarTitle).toHaveBeenCalledTimes(2);
    } finally {
      timer.mockRestore();
    }
  });

  it('retries even when the fallback timer cannot be cleared', async () => {
    vi.useFakeTimers();
    const context = createContext();
    await openWebRoute(context, 'timer');
    markWebRouteFailed(context);
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {
      throw new Error('timer cleanup unavailable');
    });

    try {
      expect(() => retryWebRoute(context)).not.toThrow();
      expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
      expect(context.data.errorTitle).toBe('');
    } finally {
      clearTimer.mockRestore();
      await vi.runAllTimersAsync();
    }
  });

  it('retries once when nextTick accepts but loses its callback', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('wx', {
      getStorageSync: () => null,
      removeStorageSync: vi.fn(),
      nextTick: vi.fn(),
      setNavigationBarTitle,
    });
    const context = createContext();
    await openWebRoute(context, 'timer');
    markWebRouteFailed(context);

    retryWebRoute(context);
    expect(context.data.src).toBe('');
    await vi.advanceTimersByTimeAsync(100);

    expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
    expect(context.data.errorTitle).toBe('');
    expect(setNavigationBarTitle).toHaveBeenCalledTimes(2);
  });

  it('coalesces repeated retry taps into one route reopen', async () => {
    const nextTickCallbacks: Array<() => void> = [];
    vi.stubGlobal('wx', {
      getStorageSync: () => null,
      removeStorageSync: vi.fn(),
      nextTick(callback: () => void) {
        nextTickCallbacks.push(callback);
      },
      setNavigationBarTitle,
    });
    const context = createContext();
    await openWebRoute(context, 'timer');
    markWebRouteFailed(context);

    retryWebRoute(context);
    retryWebRoute(context);

    expect(nextTickCallbacks).toHaveLength(1);
    nextTickCallbacks[0]();
    await Promise.resolve();
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
    expect(setNavigationBarTitle).toHaveBeenCalledTimes(2);
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

  it('never creates a new login handoff while opening the logout route', async () => {
    const request = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        token: 't'.repeat(20),
        user: { name: 'CubeRoot', wcaId: null },
      }),
      removeStorageSync: vi.fn(),
      nextTick(callback: () => void) { callback(); },
      request,
      setNavigationBarTitle,
    });
    const context = createContext();

    await openWebRoute(context, 'logout');

    expect(request).not.toHaveBeenCalled();
    expect(context.data.src).toBe(
      'https://cuberoot.me/auth/miniprogram#action=logout&next=%2Fzh%2Faccount',
    );
  });

  it('explains the split logout state when the website route fails to load', async () => {
    const context = createContext();

    await openWebRoute(context, 'logout');
    markWebRouteFailed(context);

    expect(context.data.errorMessage).toBe(
      '小程序已退出，网站退出暂未完成。请检查网络后重试。',
    );
    expect(context.data.canRetry).toBe(true);
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

  it('does not clear a newer session when an older handoff request is rejected', async () => {
    const oldToken = 'o'.repeat(20);
    const newToken = 'n'.repeat(20);
    let storedSession: unknown = {
      token: oldToken,
      user: { name: 'Old account', wcaId: null },
    };
    let finishRequest: ((result: { statusCode: number; data: unknown }) => void) | undefined;
    const removeStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => storedSession,
      removeStorageSync,
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

    storedSession = {
      token: newToken,
      user: { name: 'New account', wcaId: null },
    };
    finishRequest?.({
      statusCode: 401,
      data: { error: 'Authentication required' },
    });
    await opening;

    expect(removeStorageSync).not.toHaveBeenCalled();
    expect(storedSession).toEqual({
      token: newToken,
      user: { name: 'New account', wcaId: null },
    });
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

  it('ignores a delayed error from an older web-view attempt', async () => {
    const context = createContext();
    const options = createWebViewPageOptions('timer') as unknown as {
      handleWebViewError(
        this: WebViewPageContext,
        event: { currentTarget: { dataset: { attempt: number } } },
      ): void;
    };
    await openWebRoute(context, 'timer');
    const oldAttempt = context.data.viewAttempt;

    options.handleWebViewError.call(context, {
      currentTarget: { dataset: { attempt: oldAttempt } },
    });
    retryWebRoute(context);
    const currentAttempt = context.data.viewAttempt;

    expect(currentAttempt).toBeGreaterThan(oldAttempt);
    options.handleWebViewError.call(context, {
      currentTarget: { dataset: { attempt: oldAttempt } },
    });
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
    expect(context.data.errorTitle).toBe('');

    options.handleWebViewError.call(context, {
      currentTarget: { dataset: { attempt: currentAttempt } },
    });
    expect(context.data.src).toBe('');
    expect(context.data.errorTitle).toBe('网页加载失败');
  });

  it('does not use a handoff ticket after the local session was cleared', async () => {
    const token = 't'.repeat(20);
    let storedSession: unknown = {
      token,
      user: { name: 'CubeRoot', wcaId: null },
    };
    let finishRequest: ((result: { statusCode: number; data: unknown }) => void) | undefined;
    vi.stubGlobal('wx', {
      getStorageSync: () => storedSession,
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

    storedSession = null;
    finishRequest?.({
      statusCode: 200,
      data: { ticket: 'A'.repeat(43), expiresIn: 90 },
    });
    await opening;

    expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
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

  it('ignores malformed web view attempt identifiers', async () => {
    const context = createContext();
    await openWebRoute(context, 'timer');
    const currentData = { ...context.data };

    markWebRouteFailed(context, 'not-a-number');
    markWebRouteFailed(context, '');
    markWebRouteFailed(context, 0);

    expect(context.data).toEqual(currentData);
  });

  it('does not reopen an old route after the same page instance is reused', async () => {
    let runOldNextTick: (() => void) | undefined;
    vi.stubGlobal('wx', {
      getStorageSync: () => null,
      removeStorageSync: vi.fn(),
      nextTick(callback: () => void) {
        runOldNextTick = callback;
      },
      setNavigationBarTitle,
    });
    const context = createContext();
    const options = createWebViewPageOptions() as unknown as {
      onLoad(this: WebViewPageContext, query: { key: string }): void;
      onUnload(this: WebViewPageContext): void;
      retry(this: WebViewPageContext): void;
    };

    options.onLoad.call(context, { key: 'alg' });
    await Promise.resolve();
    markWebRouteFailed(context);
    options.retry.call(context);
    options.onUnload.call(context);
    options.onLoad.call(context, { key: 'timer' });
    await Promise.resolve();

    runOldNextTick?.();
    await Promise.resolve();
    expect(context.data.routeKey).toBe('timer');
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
    expect(setNavigationBarTitle).toHaveBeenCalledTimes(2);
  });

  it('does not open a route after the page has been unloaded', async () => {
    const request = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        token: 't'.repeat(20),
        user: { name: 'CubeRoot', wcaId: null },
      }),
      nextTick(callback: () => void) { callback(); },
      removeStorageSync: vi.fn(),
      request,
      setNavigationBarTitle,
    });
    const context = createContext();
    const initialData = { ...context.data };
    const options = createWebViewPageOptions('timer') as unknown as {
      onUnload(this: WebViewPageContext): void;
    };

    options.onUnload.call(context);

    await expect(openWebRoute(context, 'timer')).resolves.toBe(false);
    expect(context.data).toEqual(initialData);
    expect(request).not.toHaveBeenCalled();
    expect(setNavigationBarTitle).not.toHaveBeenCalled();
  });

  it('allows a page instance to load again after a completed lifecycle', () => {
    const context = createContext();
    const options = createWebViewPageOptions('timer') as unknown as {
      onLoad(this: WebViewPageContext, options: Record<string, string>): void;
      onUnload(this: WebViewPageContext): void;
    };

    options.onUnload.call(context);
    options.onLoad.call(context, {});

    expect(context.data.src).toBe('https://cuberoot.me/zh/timer');
    expect(setNavigationBarTitle).toHaveBeenCalledWith({ title: '计时器' });
  });
});
