// @vitest-environment jsdom

import { createInstance } from 'i18next';
import { act, createElement, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthLayout from '@/app/auth/layout';
import MiniProgramAuthLayout from '@/app/auth/miniprogram/layout';
import i18n from '@/i18n/i18n-client';
import { tr } from '@/i18n/tr';

function CallbackLabel() {
  return createElement('p', null, tr({
    zh: '正在同步登录状态...',
    en: 'Syncing your session...',
  }));
}

function renderOnServer(element: ReactNode) {
  const browserWindow = window;
  vi.stubGlobal('window', undefined);
  try { return renderToStaticMarkup(element); }
  finally { vi.stubGlobal('window', browserWindow); }
}

function renderCallback(children: ReactNode) {
  return createElement(MiniProgramAuthLayout, { children });
}

function renderSocialCallback(children: ReactNode) {
  return createElement(AuthLayout, { children });
}

describe('Auth callback hydration', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await i18n.changeLanguage('en');
  });

  it('uses the same Chinese text for server rendering and first client render', async () => {
    await i18n.changeLanguage('en');
    const html = renderOnServer(renderCallback(createElement(CallbackLabel)));
    expect(html).toContain('正在同步登录状态...');

    // The Mini Program callback's fresh browser bundle starts in Chinese.
    await i18n.changeLanguage('zh');
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);

    const errors: unknown[][] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(host, renderCallback(createElement(CallbackLabel)));
    });
    consoleError.mockRestore();

    expect(host.textContent).toBe('正在同步登录状态...');
    expect(errors.filter((entry) => String(entry[0]).includes('Hydration failed'))).toEqual([]);

    await act(async () => root?.unmount());
    host.remove();
  });

  it('resets a bare auth callback to English after a Chinese server render', async () => {
    await i18n.changeLanguage('zh');
    const html = renderOnServer(renderSocialCallback(createElement(CallbackLabel)));
    expect(html).toContain('Syncing your session...');

    // A fresh callback tab starts its client-side i18n singleton in English.
    await i18n.changeLanguage('en');
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);

    const errors: unknown[][] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(host, renderSocialCallback(createElement(CallbackLabel)));
    });
    consoleError.mockRestore();

    expect(host.textContent).toBe('Syncing your session...');
    expect(errors.filter((entry) => String(entry[0]).includes('Hydration failed'))).toEqual([]);

    await act(async () => root?.unmount());
    host.remove();
  });
});

// Verify fresh-tab initialization rather than relying on the test's existing singleton.
describe('Auth callback browser locale', () => {
  afterEach(() => {
    vi.doUnmock('i18next');
    window.history.replaceState(null, '', '/');
  });
  it.each([
    ['/auth/miniprogram', 'zh'],
    ['/auth/google', 'en'],
    ['/zh/account', 'zh'],
  ])('initializes %s in %s', async (path, lang) => {
    vi.resetModules();
    vi.doMock('i18next', () => ({ default: createInstance() }));
    window.history.replaceState(null, '', path);
    const { default: freshI18n } = await import('@/i18n/i18n-client');
    expect(freshI18n.language).toBe(lang);
  });
});
