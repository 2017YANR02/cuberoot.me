// @vitest-environment jsdom
import { createElement, type PropsWithChildren } from 'react';
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
vi.mock('@/components/HeaderToggles', () => ({ default: () => null }));
vi.mock('@/components/HomeLink', () => ({
  default: ({ children }: PropsWithChildren) => createElement('a', { href: '/' }, children),
}));

describe('download availability', () => {
  it.each(['zh', 'en'] as const)('renders the %s page with a working Play link and no unavailable download links', (language) => {
    locale.language = language;
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(NuqsTestingAdapter, { children: createElement(DownloadPage) }));
    expect(host.querySelector('h1')?.textContent).toBe({ zh: '下载', en: 'Download' }[language]);
    expect(host.querySelector('a[href="https://play.google.com/store/apps/details?id=me.cuberoot.app"]')).not.toBeNull();
    const apk = host.querySelector<HTMLAnchorElement>('.download-android .download-actions a.download-button');
    expect(apk?.href).toBe(ANDROID_APK_URL);
    expect(host.querySelector('.download-android .download-actions button')).toBeNull();
    expect(host.querySelector('.download-note')?.textContent).not.toContain('1004');
    expect(host.querySelectorAll('.download-upcoming a, .download-upcoming button')).toHaveLength(0);
    expect([...host.querySelectorAll('.download-platform > :first-child')].map((node) => node.textContent))
      .toEqual(['iOS', 'macOS', 'HarmonyOS NEXT']);
    expect(host.querySelector('.download-windows h2')?.textContent).toBe('Windows');
    expect(host.querySelectorAll('.download-windows button:disabled')).toHaveLength(2);
    expect(host.querySelectorAll('.download-windows a')).toHaveLength(0);
  });
});
