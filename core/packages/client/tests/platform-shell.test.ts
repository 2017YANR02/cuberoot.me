// @vitest-environment jsdom
import { act, createElement, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { usePathname } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/zh/platform/teachers') }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh, T: ({ zh }: { zh: string }) => zh }));
const auth = vi.hoisted(() => ({ admin: false, user: null as null | { uid: number } }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => auth.user, useIsAdmin: () => auth.admin }));
vi.mock('@/hooks/useEntryRouter', () => ({ useEntryRouter: () => ({ push: navigate }) }));
vi.mock('@/lib/landing-sections', () => ({ SEARCH_CARDS: [], isLandingSearchCardVisible: () => true }));
vi.mock('@/components/LandingSearch', () => ({ default: () => createElement('input', { 'aria-label': '搜索' }) }));
vi.mock('@/components/PageBackLink', () => ({ default: () => createElement('a', { href: '/platform' }, '返回') }));
vi.mock('@/components/CompactSelect', () => ({ CompactSelect: () => null }));
vi.mock('@/components/WcaAuth', () => ({ default: () => null }));
vi.mock('@/components/AppLink', () => ({
  default: ({ prefetch: _prefetch, scroll, ...props }: React.ComponentProps<'a'> & { prefetch?: boolean; scroll?: boolean }) => createElement('a', { ...props, 'data-scroll': scroll === false ? 'false' : undefined }),
}));

import { PlatformShell } from '@/components/platform/PlatformShell';
import { PlatformSharedSurface } from '@/components/platform/PlatformSharedSurface';
import { ForumHeader } from '@/app/[lang]/forum/_components/ForumHeader';
import { PlatformNavigationContext } from '@/lib/platform-navigation-context';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('Platform shell ownership during shared-page navigation', () => {
  it('switches between forum, course, path, discovery and general search without reusing the previous scope draft', async () => {
    const host = document.createElement('div'), root = createRoot(host);
    const pathname = vi.mocked(usePathname);
    const render = (path: string) => {
      pathname.mockReturnValue(path);
      return act(async () => root.render(createElement(PlatformShell, { children: null })));
    };
    try {
      await render('/zh/platform');
      expect(host.querySelector('.platform-site-search input[aria-label="搜索"]')).not.toBeNull();
      await render('/zh/platform/community/feed');
      const input = host.querySelector<HTMLInputElement>('.platform-site-search input')!;
      expect(input.placeholder).toBe('搜索标题和帖子内容');
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '三阶 复原');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      act(() => host.querySelector('form[role="search"]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      expect(navigate).toHaveBeenLastCalledWith('/zh/platform/community/search?q=%E4%B8%89%E9%98%B6+%E5%A4%8D%E5%8E%9F', { scroll: false });
      await render('/zh/platform/courses');
      const courseInput = host.querySelector<HTMLInputElement>('.platform-site-search input')!;
      expect(courseInput.placeholder).toBe('搜索课程、讲师或学习内容');
      expect(courseInput.value).toBe('');
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(courseInput, '三');
        courseInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      act(() => host.querySelector('form[role="search"]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      expect(navigate).toHaveBeenLastCalledWith('/zh/platform/courses?q=%E4%B8%89', { scroll: false });
      await render('/zh/platform/paths');
      const pathInput = host.querySelector<HTMLInputElement>('.platform-site-search input')!;
      expect(pathInput.placeholder).toBe('搜索学习路径');
      expect(pathInput.value).toBe('');
      expect(host.querySelector('[data-search-scope="paths"]')).not.toBeNull();
      await render('/zh/platform/paths/path-1');
      expect(pathInput.placeholder).toBe('搜索学习路径');
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(pathInput, '入门');
        pathInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      act(() => host.querySelector('form[role="search"]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      expect(navigate).toHaveBeenLastCalledWith('/zh/platform/paths?q=%E5%85%A5%E9%97%A8', { scroll: false });
      await render('/zh/platform/courses');
      expect(host.querySelector<HTMLInputElement>('.platform-site-search input')!.value).toBe('');
      expect(host.querySelector<HTMLInputElement>('.platform-site-search input')!.placeholder).toBe('搜索课程、讲师或学习内容');
      await render('/zh/platform/events/event-1');
      const eventInput = host.querySelector<HTMLInputElement>('.platform-site-search input')!;
      expect(eventInput.placeholder).toBe('搜索活动');
      expect(eventInput.value).toBe('');
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(eventInput, '比赛');
        eventInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      act(() => host.querySelector('form[role="search"]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      expect(navigate).toHaveBeenLastCalledWith('/zh/platform/events?q=%E6%AF%94%E8%B5%9B', { scroll: false });
      await render('/zh/platform/news/news-1');
      const newsInput = host.querySelector<HTMLInputElement>('.platform-site-search input')!;
      expect(newsInput.placeholder).toBe('搜索资讯');
      expect(newsInput.value).toBe('');
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(newsInput, '魔方');
        newsInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      act(() => host.querySelector('form[role="search"]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      expect(navigate).toHaveBeenLastCalledWith('/zh/platform/news?q=%E9%AD%94%E6%96%B9', { scroll: false });
      await render('/zh/platform');
      expect(host.querySelector('.platform-scoped-search')).toBeNull();
      expect(host.querySelector('.platform-site-search input[aria-label="搜索"]')).not.toBeNull();
    } finally { pathname.mockReturnValue('/zh/platform/teachers'); await act(async () => root.unmount()); }
  });
  it('renders the native admin layout on the server without preloading the lazy shared shell', () => {
    const pathname = vi.mocked(usePathname);
    pathname.mockReturnValue('/zh/platform/admin/courses');
    try {
      const html = renderToString(createElement(PlatformSharedSurface, {
        children: createElement(PlatformShell, { children: createElement('article', null, '管理页面') }),
      }));
      const host = document.createElement('div'); host.innerHTML = html;
      expect(host.querySelectorAll('.platform-shell')).toHaveLength(1);
      expect(host.querySelector('.platform-shell--shared')).toBeNull();
      expect(host.querySelector('main article')?.textContent).toBe('管理页面');
    } finally { pathname.mockReturnValue('/zh/platform/teachers'); }
  });
  it('keeps the same admin masthead and two-tier navigation when changing native and rewritten pages', async () => {
    auth.admin = true; auth.user = { uid: 1 };
    const host = document.createElement('div'), root = createRoot(host);
    const pathname = vi.mocked(usePathname);
    const render = async (path: string, native: boolean) => {
      pathname.mockReturnValue(path);
      const content = createElement('article', null, path);
      await act(async () => root.render(createElement(Suspense, { fallback: null }, createElement(PlatformSharedSurface, { children: native ? createElement(PlatformShell, { children: content }) : content }))));
      await vi.waitFor(() => expect(host.querySelector('.platform-admin-nav')).not.toBeNull());
    };
    try {
      await render('/zh/platform/admin/courses', true);
      const masthead = host.querySelector('.platform-masthead');
      expect(host.querySelectorAll('.platform-admin-nav a')).toHaveLength(6);
      expect(host.querySelector('.platform-admin-nav [aria-current]')?.textContent).toBe('课程');
      expect(host.querySelector('.platform-admin-context-nav [aria-current]')?.getAttribute('href')).toBe('/platform/admin/courses');
      expect(host.querySelector('.platform-workspace-nav')).toBeNull();
      expect([...host.querySelectorAll('.platform-nav a, .platform-context-nav a')].every(link => link.getAttribute('data-scroll') === 'false')).toBe(true);
      await render('/zh/platform/admin/courses/new', true);
      expect(host.querySelector('.platform-masthead')).toBe(masthead);
      expect(host.querySelector('.platform-admin-context-nav [aria-current]')?.getAttribute('href')).toBe('/platform/admin/courses');
      await render('/zh/platform/admin/community', false);
      expect(host.querySelector('.platform-masthead')).toBe(masthead);
      expect(host.querySelector('.platform-admin-context-nav [aria-current]')?.getAttribute('href')).toBe('/platform/admin/community');
      await render('/zh/platform/admin/qr/cards', true);
      expect(host.querySelector('.platform-masthead')).toBe(masthead);
      expect(host.querySelectorAll('.platform-shell')).toHaveLength(1);
      expect(host.querySelector('.platform-admin-context-nav [aria-current]')?.getAttribute('href')).toBe('/platform/admin/qr/cards');
      auth.admin = false;
      pathname.mockReturnValue('/zh/platform/admin/community');
      await act(async () => root.render(createElement(Suspense, { fallback: null }, createElement(PlatformSharedSurface, { children: createElement('article', null, 'private admin content') }))));
      expect(host.querySelector('.platform-admin-nav')).toBeNull();
      expect(host.querySelector('article')).toBeNull();
      expect(host.querySelector('.platform-state-permission')).not.toBeNull();
    } finally { auth.admin = false; auth.user = null; pathname.mockReturnValue('/zh/platform/teachers'); await act(async () => root.unmount()); }
  });
  it.each([false, true])('renders one frame when a retained layout is already inside a shell (shared=%s)', async shared => {
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      await act(async () => root.render(createElement(PlatformShell, {
        shared,
        children: createElement(PlatformShell, { children: createElement('article', null, '讲师内容') }),
      })));
      expect(host.querySelectorAll('.platform-shell')).toHaveLength(1);
      expect(host.querySelectorAll('.platform-masthead')).toHaveLength(1);
      expect(host.querySelectorAll('.platform-site-search')).toHaveLength(1);
      expect(host.querySelectorAll('.platform-nav')).toHaveLength(1);
      expect(host.querySelector('article')?.textContent).toBe('讲师内容');
    } finally {
      await act(async () => root.unmount());
    }
  });

  it('keeps forum actions, removes duplicate views in Platform and preserves the standalone forum header', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      const render = (inPlatform: boolean) => act(async () => root.render(createElement(PlatformNavigationContext, { value: inPlatform },
        createElement(ForumHeader, { activeView: 'boards' }))));
      await render(true);
      expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(true);
      expect(host.querySelector('.forum-view-nav')).toBeNull();
      expect(host.querySelector('.forum-view-toolbar')).toBeNull();
      expect(host.querySelector('a[href="/forum/new"]')).not.toBeNull();
      expect(host.querySelector('a[href="/forum/search"]')).toBeNull();
      await render(false);
      expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(false);
      expect(host.querySelectorAll('.forum-view-nav a')).toHaveLength(3);
      expect(host.querySelector('a[href="/forum/search"]')).not.toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
  });

  it('omits shared navigation only while displaying course details', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const pathname = vi.mocked(usePathname);
    const render = (path: string, heading: string) => {
      pathname.mockReturnValue(path);
      return act(async () => root.render(createElement(PlatformShell, {
        children: createElement('h1', null, heading),
      })));
    };
    const chrome = '.platform-masthead, .platform-site-search, .platform-nav, .platform-context-nav';

    try {
      await render('/zh/platform/courses', '全部课程');
      expect(host.querySelectorAll(chrome)).toHaveLength(4);

      await render('/zh/platform/courses/example', '课程名称');
      expect(host.querySelector(chrome)).toBeNull();
      expect(host.querySelector('main h1')?.textContent).toBe('课程名称');

      await render('/zh/platform/courses/example/sections/core', '正式课');
      expect(host.querySelectorAll(chrome)).toHaveLength(4);

      await render('/zh/platform/courses', '全部课程');
      expect(host.querySelectorAll(chrome)).toHaveLength(4);
    } finally {
      pathname.mockReset();
      await act(async () => root.unmount());
    }
  });
});
