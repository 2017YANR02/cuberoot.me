// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MiniProgramAuthLayout from '@/app/auth/miniprogram/layout';
import i18n from '@/i18n/i18n-client';
import { tr } from '@/i18n/tr';

function CallbackLabel() {
  return createElement('p', null, tr({
    zh: '正在同步登录状态...',
    en: 'Syncing your session...',
  }));
}

function renderCallback(children: ReactNode) {
  return createElement(MiniProgramAuthLayout, { children });
}

describe('Mini Program auth callback hydration', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage('en');
  });

  it('uses the same Chinese text for server rendering and first client render', async () => {
    await i18n.changeLanguage('en');
    const html = renderToStaticMarkup(renderCallback(createElement(CallbackLabel)));
    expect(html).toContain('正在同步登录状态...');

    // A browser loads a fresh client bundle whose i18n singleton starts in English.
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
      root = hydrateRoot(host, renderCallback(createElement(CallbackLabel)));
    });
    consoleError.mockRestore();

    expect(host.textContent).toBe('正在同步登录状态...');
    expect(errors.filter((entry) => String(entry[0]).includes('Hydration failed'))).toEqual([]);

    await act(async () => root?.unmount());
    host.remove();
  });
});
