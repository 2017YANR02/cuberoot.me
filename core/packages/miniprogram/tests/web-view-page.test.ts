import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
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
      nextTick(callback: () => void) {
        callback();
      },
      setNavigationBarTitle,
    });
  });

  afterEach(() => {
    setNavigationBarTitle.mockReset();
    vi.unstubAllGlobals();
  });

  it('opens an allowlisted route and updates its title', () => {
    const context = createContext();

    expect(openWebRoute(context, 'timer')).toBe(true);
    expect(context.data).toEqual({
      canRetry: false,
      errorMessage: '',
      errorTitle: '',
      routeKey: 'timer',
      src: 'https://cuberoot.me/zh/timer',
    });
    expect(setNavigationBarTitle).toHaveBeenCalledWith({ title: '计时器' });
  });

  it('blocks unknown routes without offering a retry', () => {
    const context = createContext();

    expect(openWebRoute(context, 'https://example.com')).toBe(false);
    expect(context.data.src).toBe('');
    expect(context.data.errorTitle).toBe('无法打开');
    expect(context.data.canRetry).toBe(false);
  });

  it('shows a recoverable state after a web-view error', () => {
    const context = createContext();
    openWebRoute(context, 'alg');

    markWebRouteFailed(context);
    expect(context.data.src).toBe('');
    expect(context.data.errorTitle).toBe('网页加载失败');
    expect(context.data.canRetry).toBe(true);

    retryWebRoute(context);
    expect(context.data.src).toBe('https://cuberoot.me/zh/alg');
    expect(context.data.errorTitle).toBe('');
  });
});
