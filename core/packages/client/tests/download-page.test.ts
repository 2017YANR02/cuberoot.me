// @vitest-environment jsdom
import { act, createElement, type PropsWithChildren } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import DownloadPage from '../app/[lang]/download/page';
import { ANDROID_APK_URL } from '../lib/app-downloads';

const locale = vi.hoisted(() => ({ language: 'zh' as 'zh' | 'en' }));
vi.mock('@/i18n/tr', () => ({
  useLang: () => locale.language,
  tr: (message: { zh: string; en: string }) => message[locale.language],
}));
vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/components/HomeLink', () => ({
  default: ({ children }: PropsWithChildren) => createElement('a', { href: '/' }, children),
}));

describe('download availability', () => {
  it.each([
    ['Windows NT 10.0', 'Win32', 0, 'Windows'],
    ['Macintosh', 'MacIntel', 0, 'macOS'],
    ['Macintosh', 'MacIntel', 5, 'iOS'],
    ['Linux; Android', 'Linux', 5, 'Android'],
    ['Linux', 'Linux', 0, null],
  ] as const)('prioritizes downloads for %s (%s, %i touch points)', async (userAgent, platform, maxTouchPoints, expected) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: maxTouchPoints });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      await act(async () => root.render(createElement(NuqsTestingAdapter, { children: createElement(DownloadPage) })));
      expect(host.querySelector('.download-device-first > section h2')?.textContent ?? null).toBe(expected);
      expect(host.querySelectorAll('.download-platform-section')).toHaveLength(4);
      const mac = host.querySelector('section[aria-labelledby="download-macos-title"]')!;
      const web = 'https://apps.apple.com/cn/app/cuberoot/id6816632957?platform=mac';
      expect(mac.querySelector('.download-apple-badge')?.getAttribute('href')).toBe(
        expected === 'macOS' ? 'macappstore://apps.apple.com/app/id6816632957?mt=12' : web,
      );
      expect(mac.querySelector(`a[href="${web}"]`)).not.toBeNull();
      if (expected) {
        const others = host.querySelector('details')!;
        expect(others.open).toBe(false);
        others.querySelector('summary')!.click();
        expect(others.open).toBe(true);
        expect(others.querySelectorAll('section')).toHaveLength(3);
      }
    } finally {
      await act(async () => root.unmount());
      Reflect.deleteProperty(navigator, 'maxTouchPoints');
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

  it.each(['zh', 'en'] as const)('renders the %s page with a working Play link and no unavailable download links', (language) => {
    locale.language = language;
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(NuqsTestingAdapter, { children: createElement(DownloadPage) }));
    expect(host.querySelector('h1')?.textContent).toBe({ zh: '下载 CubeRoot', en: 'Download CubeRoot' }[language]);
    expect(host.querySelector('a[href="https://play.google.com/store/apps/details?id=me.cuberoot.app"]')).not.toBeNull();
    const android = host.querySelector('section[aria-labelledby="download-android-title"]')!;
    const windows = host.querySelector('section[aria-labelledby="download-windows-title"]')!;
    const apk = android.querySelector<HTMLAnchorElement>('.download-alternative a.download-text-link');
    expect(apk?.href).toBe(ANDROID_APK_URL);
    expect(android.querySelector('.download-primary-action button')).toBeNull();
    expect(host.querySelector('.download-note')).toBeNull();
    expect(host.querySelectorAll('.download-upcoming a, .download-upcoming button')).toHaveLength(0);
    expect([...host.querySelectorAll('.download-upcoming-platforms > span')].map(node => node.textContent))
      .toEqual(['HarmonyOS NEXT']);
    for (const [url, badge] of [
      ['https://apps.apple.com/app/id6816632957?platform=iphone', 'app-store'],
      ['https://apps.apple.com/cn/app/cuberoot/id6816632957?platform=mac', 'mac-app-store'],
    ]) {
      const image = host.querySelector(`a[href="${url}"] img`);
      expect(image?.getAttribute('src')).toBe(`/badges/${badge}-${language === 'zh' ? 'zh-cn' : 'en-us'}.svg`);
    }
    expect(windows.querySelector('h2')?.textContent).toBe('Windows');
    expect(windows.querySelectorAll('.download-primary-action button:disabled')).toHaveLength(1);
    expect(windows.querySelectorAll('a')).toHaveLength(0);
  });
});
