// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/zh/platform/teachers' }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh' }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => null, useIsAdmin: () => false }));
vi.mock('@/lib/landing-sections', () => ({ SEARCH_CARDS: [], isLandingSearchCardVisible: () => true }));
vi.mock('@/components/LandingSearch', () => ({ default: () => createElement('input', { 'aria-label': '搜索' }) }));
vi.mock('@/components/PageBackLink', () => ({ default: () => createElement('a', { href: '/platform' }, '返回') }));
vi.mock('@/components/CompactSelect', () => ({ CompactSelect: () => null }));
vi.mock('@/components/AppLink', () => ({
  default: ({ prefetch: _prefetch, ...props }: React.ComponentProps<'a'> & { prefetch?: boolean }) => createElement('a', props),
}));

import { PlatformShell } from '@/components/platform/PlatformShell';

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
});
