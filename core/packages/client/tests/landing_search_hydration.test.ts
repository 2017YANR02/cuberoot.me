// @vitest-environment jsdom

import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routeState = vi.hoisted(() => ({ lang: 'zh' as 'zh' | 'en' }));

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/link', () => ({
  default: ({ children, prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode; prefetch?: boolean }) => (
    createElement('a', props, children)
  ),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: routeState.lang }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/useSpeechToText', () => ({
  useSpeechToText: () => ({ supported: false, listening: false, start: vi.fn(), stop: vi.fn() }),
}));
vi.mock('@/lib/site-search', () => ({
  INITIAL_RENDER_CAP: 10,
  METRIC_LABEL_OVERRIDE: {},
  useSiteSearch: (query: string, _mode: string, options: { cards: Array<{ id: string }> }) => ({
    q: query.trim().toLowerCase(),
    xSearchEnabled: false,
    xLoaded: true,
    cardMatches: query.trim() ? options.cards : [],
    toolMatches: [],
    lookupMatches: [],
    statMatches: [],
    personMatches: [],
    compMatches: [],
    reconMatches: [],
    glossaryMatches: [],
    aboutMatches: [],
    stackMatches: [],
    algSetMatches: [],
    totalCount: query.trim() ? options.cards.length : 0,
    yearMatch: null,
  }),
}));

import LandingSearch from '@/components/LandingSearch';
import { changeAppLanguage } from '@/i18n/i18n-client';

describe('LandingSearch placeholder hydration', () => {
  beforeEach(() => {
    routeState.lang = 'zh';
    changeAppLanguage('zh');
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('服务器与客户端跨 UTC 日期时首帧仍一致,挂载后再显示当天文案', async () => {
    vi.setSystemTime(new Date('2026-08-19T12:00:00Z'));
    const html = renderToStaticMarkup(createElement(LandingSearch, { cards: [], lang: 'zh' }));
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);

    vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
    const errors: unknown[][] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(host, createElement(LandingSearch, { cards: [], lang: 'zh' }));
    });
    errorSpy.mockRestore();

    expect(
      errors.filter((entry) => String(entry[0]).toLowerCase().includes('hydrat')),
    ).toEqual([]);
    expect(host.querySelector<HTMLInputElement>('.landing-search-field')?.placeholder)
      .toBe('想看哪一年的统计?');

    await act(async () => root?.unmount());
    host.remove();
  });

  it.each([
    ['zh', '/zh/courses'],
    ['en', '/courses'],
  ] as const)('独立搜索页使用 %s 受控查询,并生成正确的真链接', (lang, expectedHref) => {
    routeState.lang = lang;
    changeAppLanguage(lang);
    const html = renderToStaticMarkup(createElement(LandingSearch, {
      cards: [{
        id: 'courses',
        href: '/courses',
        internal: true,
        nameZh: '课程',
        nameEn: 'Courses',
        sectionTitleZh: '学习',
        sectionTitleEn: 'Learn',
      }],
      lang,
      query: '课程',
      persistentResults: true,
    }));
    const host = document.createElement('div');
    host.innerHTML = html;

    expect(host.querySelector<HTMLInputElement>('.landing-search-field')?.value).toBe('课程');
    expect(host.querySelector<HTMLAnchorElement>('.landing-search-item')?.getAttribute('href'))
      .toBe(expectedHref);
    expect(host.querySelector('.landing-search--page')).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>('.landing-search-field')?.getAttribute('aria-label'))
      .toBe(lang === 'zh' ? '全站搜索' : 'Site search');
  });

  it('keeps the controlled URL query when a standalone-search result is opened', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onQueryChange = vi.fn();
    const root = createRoot(host);

    await act(async () => {
      root.render(createElement(LandingSearch, {
        cards: [{
          id: 'courses',
          href: '/courses',
          internal: true,
          nameZh: '课程',
          nameEn: 'Courses',
          sectionTitleZh: '学习',
          sectionTitleEn: 'Learn',
        }],
        lang: 'zh',
        query: '课程',
        onQueryChange,
        persistentResults: true,
      }));
    });

    await act(async () => {
      host.querySelector<HTMLAnchorElement>('.landing-search-item')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    });

    expect(onQueryChange).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLInputElement>('.landing-search-field')?.value).toBe('课程');
    await act(async () => root.unmount());
    host.remove();
  });
});
