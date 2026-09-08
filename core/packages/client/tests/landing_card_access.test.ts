// @vitest-environment jsdom
import { createElement, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';

const auth = vi.hoisted(() => ({ user: null as { wcaId: string } | null }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => auth.user, nextQuery: () => '' }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/navigation', () => ({ usePathname: () => '/zh', useParams: () => ({ lang: 'zh' }) }));
vi.mock('next/link', () => ({
  default: ({ children, prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode; prefetch?: boolean }) => createElement('a', props, children),
}));
vi.mock('@/components/HeaderToggles', () => ({ default: () => null }));
vi.mock('@/components/LandingSearch', () => ({ default: () => null }));
vi.mock('@/lib/theme', () => ({ useEffectiveTheme: () => 'dark' }));

import LandingPage from '@/app/[lang]/LandingClient';
import { changeAppLanguage } from '@/i18n/i18n-client';

describe('homepage development cards', () => {
  it.each([null, { wcaId: 'ordinary-user' }, { wcaId: ADMIN_WCA_IDS[0] }])('renders access for %j', (user) => {
    auth.user = user;
    changeAppLanguage('zh');
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(LandingPage));
    const admin = user?.wcaId === ADMIN_WCA_IDS[0];
    for (const [id, href] of [['platform', '/zh/platform'], ['teaching-management', '/zh/org'], ['learning-center', '/zh/learn']]) {
      const card = host.querySelector(`#card-${id}`)!;
      expect(card.tagName).toBe(admin ? 'A' : 'DIV');
      expect(card.getAttribute('href')).toBe(admin ? href : null);
      expect(card.getAttribute('aria-disabled')).toBe(admin ? null : 'true');
      expect(card.classList.contains('is-disabled')).toBe(!admin);
      expect(card.textContent?.includes('开发中')).toBe(!admin);
    }
    expect(host.querySelector('#card-teaching')?.getAttribute('href')).toBe('/zh/courses');
  });
});
