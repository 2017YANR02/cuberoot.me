import { describe, expect, it } from 'vitest';

import { localeFromLanguage, tr } from '../src/lib/i18n';

describe('mini program i18n', () => {
  it('recognizes Simplified and Traditional Chinese language tags', () => {
    expect(localeFromLanguage('zh_CN')).toBe('zh');
    expect(localeFromLanguage('zh-Hans')).toBe('zh');
    expect(localeFromLanguage('zh-Hant')).toBe('zh');
  });

  it('uses English for other explicit languages and Chinese as the safe fallback', () => {
    expect(localeFromLanguage('en')).toBe('en');
    expect(localeFromLanguage('ja_JP')).toBe('en');
    expect(localeFromLanguage(undefined)).toBe('zh');
  });

  it('selects text without inline language branches at call sites', () => {
    const text = { en: 'Tools', zh: '工具' } as const;

    expect(tr(text, 'en')).toBe('Tools');
    expect(tr(text, 'zh')).toBe('工具');
  });
});

// The tabs are separate bundles and tools messages arrive after tab navigation.
describe('saved WebView language', () => {
  it('refreshes native tabs and resolves future routes in the saved language across bundles', async () => {
    const { vi } = await import('vitest');
    const stored = new Map<string, unknown>();
    const refreshLocale = vi.fn();
    const setTabBarItem = vi.fn();
    vi.stubGlobal('getCurrentPages', () => [{ refreshLocale }]);
    vi.stubGlobal('wx', {
      getStorageSync: (key: string) => stored.get(key),
      setStorageSync: (key: string, value: unknown) => stored.set(key, value),
      getAppBaseInfo: () => ({ language: 'zh_CN' }),
      setTabBarItem,
    });
    try {
      const native = await import('../src/lib/i18n');
      const { resolveWebRoute } = await import('../src/lib/web-routes');
      expect(resolveWebRoute('timer')?.path).toBe('/zh/timer');
      native.receiveNativeLocale({ type: 'cuberoot:locale', locale: 'en' });
      expect(native.getMiniProgramLocale()).toBe('en');
      expect(resolveWebRoute('timer')?.path).toBe('/timer');
      expect(native.localizedWebsitePath('/zh?foo=bar&lang=zh#section')).toBe('/?foo=bar&lang=en#section');
      expect(native.localizedWebsitePath('/zh/?foo=bar')).toBe('/?foo=bar');
      expect(native.localizedWebsitePath('/zh/timer?players=2&lang=zh')).toBe('/timer?players=2&lang=en');
      expect(setTabBarItem).toHaveBeenCalledWith({ index: 2, text: 'Me' });
      expect(refreshLocale).toHaveBeenCalledOnce();
      vi.resetModules();
      expect((await import('../src/lib/i18n')).getMiniProgramLocale()).toBe('en');
      native.receiveNativeLocale({ type: 'cuberoot:locale', locale: '../bad' });
      expect(native.getMiniProgramLocale()).toBe('en');
      native.receiveNativeLocale({ type: 'cuberoot:locale', locale: 'zh' });
      expect(native.localizedWebsitePath('/zh?foo=bar&lang=en#section')).toBe('/zh?foo=bar&lang=zh#section');
      expect(native.localizedWebsitePath('/?foo=bar')).toBe('/zh?foo=bar');
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});
