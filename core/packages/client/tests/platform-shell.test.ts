// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { usePathname } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/zh/platform/teachers') }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh, T: ({ zh }: { zh: string }) => zh }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => null, useIsAdmin: () => false }));
vi.mock('@/lib/landing-sections', () => ({ SEARCH_CARDS: [], isLandingSearchCardVisible: () => true }));
vi.mock('@/components/LandingSearch', () => ({ default: () => createElement('input', { 'aria-label': '搜索' }) }));
vi.mock('@/components/PageBackLink', () => ({ default: () => createElement('a', { href: '/platform' }, '返回') }));
vi.mock('@/components/CompactSelect', () => ({ CompactSelect: () => null }));
vi.mock('@/components/WcaAuth', () => ({ default: () => null }));
vi.mock('@/components/AppLink', () => ({
  default: ({ prefetch: _prefetch, ...props }: React.ComponentProps<'a'> & { prefetch?: boolean }) => createElement('a', props),
}));

import { PlatformShell } from '@/components/platform/PlatformShell';
import { ForumHeader } from '@/app/[lang]/forum/_components/ForumHeader';
import { PlatformNavigationContext } from '@/lib/platform-navigation-context';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('Platform shell ownership during shared-page navigation', () => {
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
      await render(false);
      expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(false);
      expect(host.querySelectorAll('.forum-view-nav a')).toHaveLength(3);
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
