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
  const hideShareMenu = vi.fn();
  const getNetworkType = vi.fn();
  const setNavigationBarTitle = vi.fn();
  const showShareMenu = vi.fn();
  const networkListeners = new Set<WechatMiniprogram.OnNetworkStatusChangeCallback>();

  beforeEach(() => {
    networkListeners.clear();
    vi.stubGlobal('wx', {
      getNetworkType,
      getStorageSync: () => null,
      hideShareMenu,
      offNetworkStatusChange(listener: WechatMiniprogram.OnNetworkStatusChangeCallback) {
        networkListeners.delete(listener);
      },
      onNetworkStatusChange(listener: WechatMiniprogram.OnNetworkStatusChangeCallback) {
        networkListeners.add(listener);
      },
      removeStorageSync: vi.fn(),
      nextTick(callback: () => void) {
        callback();
      },
      setNavigationBarTitle,
      showShareMenu,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    hideShareMenu.mockReset();
    getNetworkType.mockReset();
    setNavigationBarTitle.mockReset();
    showShareMenu.mockReset();
    vi.unstubAllGlobals();
  });

  it('opens an allowlisted route and updates its title', async () => {
    const context = createContext();

    await expect(openWebRoute(context, 'timer')).resolves.toBe(true);
    expect(context.data).toEqual({
      canRetry: false,
      errorMessage: '',
      errorTitle: '',
      loginBusy: false,
      loginError: '',
      loginRequired: false,
      loginStorageUnavailable: false,
      loadingTitle: '正在打开计时',
      routeKey: 'timer',
      src: 'https://cuberoot.me/zh/timer#wechat_redirect',
      viewAttempt: 1,
    });
    expect(setNavigationBarTitle).toHaveBeenCalledWith({ title: '计时' });
  });

  it('still opens the route when the cosmetic title API throws', async () => {
    setNavigationBarTitle.mockImplementationOnce(() => {
      throw new Error('title unavailable');
    });
    const context = createContext();

    await expect(openWebRoute(context, 'timer')).resolves.toBe(true);
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
    expect(context.data.errorTitle).toBe('');
  });

  it('blocks unknown routes without offering a retry', async () => {
    const context = createContext();

    await expect(openWebRoute(context, 'https://example.com')).resolves.toBe(false);
    expect(context.data.src).toBe('');
    expect(context.data.errorTitle).toBe('无法打开');
    expect(context.data.canRetry).toBe(false);
  });

  it('shares each public web route through its canonical Mini Program entry', async () => {
    const context = createContext();
    const options = createWebViewPageOptions() as unknown as {
      onLoad(this: WebViewPageContext, query: { key: string }): void;
      onShareAppMessage(this: WebViewPageContext): WechatMiniprogram.Page.ICustomShareContent;
    };

    options.onLoad.call(context, { key: 'alg' });
    await Promise.resolve();

    expect(showShareMenu).toHaveBeenCalledWith({
      menus: ['shareAppMessage'],
    });
    expect(hideShareMenu).not.toHaveBeenCalled();
    expect(options).not.toHaveProperty('onShareTimeline');
    expect(options.onShareAppMessage.call(context)).toEqual({
      imageUrl: '/assets/share-cover.png',
      title: 'CubeRoot 魔方根：公式',
      path: '/pages/web/index?key=alg',
    });
  });

  it('hides private routes and never forwards their route key', async () => {
    const context = createContext();
    const options = createWebViewPageOptions() as unknown as {
      onLoad(this: WebViewPageContext, query: { key: string }): void;
      onShareAppMessage(this: WebViewPageContext): WechatMiniprogram.Page.ICustomShareContent;
    };

    options.onLoad.call(context, { key: 'account' });
    await Promise.resolve();

    expect(hideShareMenu).toHaveBeenCalledWith({
      menus: ['shareAppMessage', 'shareTimeline'],
    });
    expect(showShareMenu).not.toHaveBeenCalled();
    expect(options.onShareAppMessage.call(context)).toEqual({
      imageUrl: '/assets/share-cover.png',
      title: 'CubeRoot 魔方根',
      path: '/pages/timer/index',
    });
  });

  it('shows a recoverable state after a web-view error', async () => {
    const context = createContext();
    await openWebRoute(context, 'alg');

    markWebRouteFailed(context);
    expect(context.data.src).toBe('');
    expect(context.data.errorTitle).toBe('网页加载失败');
    expect(context.data.canRetry).toBe(true);

    retryWebRoute(context);
    expect(context.data.src).toBe('https://cuberoot.me/zh/alg#wechat_redirect');
    expect(context.data.errorTitle).toBe('');
  });

  it('reopens a failed route when the network reconnects', async () => {
    const context = createContext();
    const options = createWebViewPageOptions('timer') as unknown as {
      onLoad(this: WebViewPageContext, options: Record<string, string>): void;
      onShow(this: WebViewPageContext): void;
    };

    options.onLoad.call(context, {});
    options.onShow.call(context);
    await Promise.resolve();
    markWebRouteFailed(context);

    expect(networkListeners.size).toBe(1);
    networkListeners.forEach((listener) => listener({
      isConnected: false,
      networkType: 'none',
    }));
    expect(context.data.errorTitle).toBe('网页加载失败');

    networkListeners.forEach((listener) => listener({
      isConnected: true,
      networkType: 'wifi',
    }));
    await Promise.resolve();

    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
    expect(context.data.errorTitle).toBe('');
    expect(setNavigationBarTitle).toHaveBeenCalledTimes(2);
  });

  it('removes network recovery when the page is unloaded', async () => {
    const context = createContext();
    const options = createWebViewPageOptions('timer') as unknown as {
      onLoad(this: WebViewPageContext, options: Record<string, string>): void;
      onShow(this: WebViewPageContext): void;
      onUnload(this: WebViewPageContext): void;
    };

    options.onLoad.call(context, {});
    options.onShow.call(context);
    await Promise.resolve();
    markWebRouteFailed(context);
    const [listener] = [...networkListeners];

    options.onUnload.call(context);
    expect(networkListeners.size).toBe(0);
    listener({ isConnected: true, networkType: 'wifi' });
    await Promise.resolve();

    expect(context.data.src).toBe('');
    expect(setNavigationBarTitle).toHaveBeenCalledTimes(1);
  });

  it('pauses recovery while hidden and checks connectivity when shown again', async () => {
    const context = createContext();
    const options = createWebViewPageOptions('timer') as unknown as {
      onHide(this: WebViewPageContext): void;
      onLoad(this: WebViewPageContext, query: Record<string, string>): void;
      onShow(this: WebViewPageContext): void;
    };

    options.onLoad.call(context, {});
    options.onShow.call(context);
    await Promise.resolve();
    markWebRouteFailed(context);
    const [hiddenListener] = [...networkListeners];

    options.onHide.call(context);
    expect(networkListeners.size).toBe(0);
    hiddenListener({ isConnected: true, networkType: 'wifi' });
    await Promise.resolve();
    expect(context.data.errorTitle).toBe('网页加载失败');

    getNetworkType.mockImplementationOnce(({ success }) => {
      success?.({ networkType: 'wifi' });
    });
    options.onShow.call(context);
    await Promise.resolve();

    expect(getNetworkType).toHaveBeenCalledTimes(1);
    expect(networkListeners.size).toBe(1);
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
    expect(context.data.errorTitle).toBe('');
    expect(setNavigationBarTitle).toHaveBeenCalledTimes(2);
  });

  it('restores a retry paused by hiding and resumes it when shown', async () => {
    const nextTicks: Array<() => void> = [];
    vi.spyOn(wx, 'nextTick').mockImplementation((callback) => {
      nextTicks.push(callback);
    });
    const context = createContext();
    const options = createWebViewPageOptions('timer') as unknown as {
      onHide(this: WebViewPageContext): void;
      onLoad(this: WebViewPageContext, query: Record<string, string>): void;
      onShow(this: WebViewPageContext): void;
      retry(this: WebViewPageContext): void;
    };

    options.onLoad.call(context, {});
    options.onShow.call(context);
    await Promise.resolve();
    markWebRouteFailed(context);
    options.retry.call(context);
    expect(context.data.canRetry).toBe(false);

    options.onHide.call(context);
    expect(context.data.canRetry).toBe(false);
    expect(context.data.errorTitle).toBe('');
    nextTicks[0]?.();
    expect(context.data.src).toBe('');

    options.onShow.call(context);
    expect(nextTicks).toHaveLength(2);
    nextTicks[1]?.();
    await Promise.resolve();

    expect(getNetworkType).not.toHaveBeenCalled();
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
    expect(context.data.errorTitle).toBe('');
    expect(setNavigationBarTitle).toHaveBeenCalledTimes(2);
  });

  it('does not finish a pending handoff while hidden and requests a fresh one when shown', async () => {
    const token = 't'.repeat(20);
    const requestCallbacks: Array<(result: { statusCode: number; data: unknown }) => void> = [];
    vi.stubGlobal('wx', {
      getStorageSync: () => ({ token, user: { name: 'CubeRoot', wcaId: null } }),
      getNetworkType: vi.fn(),
      nextTick: (callback: () => void) => callback(),
      onNetworkStatusChange: vi.fn(),
      offNetworkStatusChange: vi.fn(),
      request: ({ success }: { success: (result: { statusCode: number; data: unknown }) => void }) => {
        requestCallbacks.push(success);
        return { abort: vi.fn() };
      },
      setNavigationBarTitle,
    });
    const context = createContext();
    const options = createWebViewPageOptions('timer') as unknown as {
      onHide(this: WebViewPageContext): void;
      onLoad(this: WebViewPageContext, query: Record<string, string>): void;
      onShow(this: WebViewPageContext): void;
    };

    options.onLoad.call(context, {});
    options.onShow.call(context);
    expect(requestCallbacks).toHaveLength(1);

    options.onHide.call(context);
    requestCallbacks[0]?.({
      statusCode: 200,
      data: { ticket: 'A'.repeat(43), expiresIn: 90 },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(context.data.src).toBe('');

    options.onShow.call(context);
    expect(requestCallbacks).toHaveLength(2);
    requestCallbacks[1]?.({
      statusCode: 200,
      data: { ticket: 'B'.repeat(43), expiresIn: 90 },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(context.data.src).toBe(
      `https://cuberoot.me/auth/miniprogram#wechat_redirect&ticket=${'B'.repeat(43)}&next=%2Fzh%2Ftimer`,
    );
  });

  it('keeps manual retry available when network observation throws', async () => {
    vi.stubGlobal('wx', {
      getStorageSync: () => null,
      onNetworkStatusChange() {
        throw new Error('network observation unavailable');
      },
      removeStorageSync: vi.fn(),
      nextTick(callback: () => void) { callback(); },
      setNavigationBarTitle,
    });
    const context = createContext();
    const options = createWebViewPageOptions('timer') as unknown as {
      onLoad(this: WebViewPageContext, options: Record<string, string>): void;
      onShow(this: WebViewPageContext): void;
      retry(this: WebViewPageContext): void;
    };

    expect(() => options.onLoad.call(context, {})).not.toThrow();
    expect(() => options.onShow.call(context)).not.toThrow();
    await Promise.resolve();
    markWebRouteFailed(context);
    options.retry.call(context);

    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
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

    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
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
      expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
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
      expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
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
      expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
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

    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
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
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
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
      `https://cuberoot.me/auth/miniprogram#wechat_redirect&ticket=${ticket}&next=%2Fzh%2Ftimer`,
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
      'https://cuberoot.me/auth/miniprogram#wechat_redirect&action=logout&next=%2Fzh%2Faccount',
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
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
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
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
  });

  it('keeps a timed-out handoff in a retryable state instead of opening as a guest', async () => {
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

    expect(context.data).toMatchObject({
      canRetry: true,
      errorMessage: '登录状态暂未同步，请检查网络后重试。为避免账号错位，暂不会以游客身份打开网页。',
      errorTitle: '账号同步失败',
      src: '',
    });
  });

  it('keeps a handoff route closed when local session storage cannot be read', async () => {
    const request = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync() {
        throw new Error('storage unavailable');
      },
      nextTick(callback: () => void) { callback(); },
      request,
      setNavigationBarTitle,
    });
    const context = createContext();

    await openWebRoute(context, 'timer');

    expect(request).not.toHaveBeenCalled();
    expect(context.data).toMatchObject({
      canRetry: true,
      errorTitle: '账号同步失败',
      src: '',
    });
  });

  it('keeps a server-side handoff failure retryable instead of opening as a guest', async () => {
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
        options.success({ statusCode: 503, data: { error: 'temporarily unavailable' } });
      },
    });
    const context = createContext();

    await openWebRoute(context, 'timer');

    expect(context.data).toMatchObject({
      canRetry: true,
      errorTitle: '账号同步失败',
      src: '',
    });
  });

  it('keeps a network handoff failure retryable instead of opening as a guest', async () => {
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        token: 't'.repeat(20),
        user: { name: 'CubeRoot', wcaId: null },
      }),
      removeStorageSync: vi.fn(),
      nextTick(callback: () => void) { callback(); },
      setNavigationBarTitle,
      request(options: {
        fail(result: { errMsg: string }): void;
      }) {
        options.fail({ errMsg: 'request:fail network error' });
      },
    });
    const context = createContext();

    await openWebRoute(context, 'timer');

    expect(context.data).toMatchObject({
      canRetry: true,
      errorTitle: '账号同步失败',
      src: '',
    });
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
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
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

    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
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
    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
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

    expect(context.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
    expect(setNavigationBarTitle).toHaveBeenCalledWith({ title: '计时' });
  });
});
