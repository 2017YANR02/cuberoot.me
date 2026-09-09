// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';

const auth = vi.hoisted(() => ({ user: null as { wcaId: string } | null }));
const lockApi = vi.hoisted(() => ({
  getHomeCardLocks: vi.fn(async () => ({} as Record<string, boolean>)),
  setHomeCardLock: vi.fn(async (_id: string, _locked: boolean) => ({ ok: true })),
}));
vi.mock('@/lib/home-card-order-api', () => ({ ...lockApi, getHomeCardOrders: async () => ({}), reorderHomeCards: vi.fn() }));
vi.mock('@/lib/page-notices-api', () => ({ fetchPageNotices: async () => [] }));
vi.mock('@/lib/membership-api', () => ({ listPublicMembers: async () => [] }));
vi.mock('@/components/LazyVisible', () => ({ default: () => null }));
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
      expect(card.classList.contains('is-disabled')).toBe(true);
      expect(card.querySelector('.coming-soon-badge')?.textContent).toBe('开发中');
      expect(card.querySelector('.lucide-lock')).toBeNull();
    }
    expect(host.querySelector('#card-teaching')?.getAttribute('href')).toBe('/zh/courses');
    expect(host.querySelectorAll('.landing-card-lock').length > 0).toBe(admin);
  });
  it('saves a lock, preserves the admin link, restores access on unlock and keeps state on save failure', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    auth.user = { wcaId: ADMIN_WCA_IDS[0] };
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    try {
      await act(async () => root.render(createElement(LandingPage)));
      const card = () => host.querySelector('#card-teaching')!;
      const button = () => card().parentElement!.querySelector<HTMLButtonElement>('.landing-card-lock')!;
      await act(async () => button().click());
      expect(lockApi.setHomeCardLock).toHaveBeenLastCalledWith('teaching', true);
      expect(card().classList.contains('is-disabled')).toBe(true);
      expect(card().getAttribute('href')).toBe('/zh/courses');
      expect(button().getAttribute('aria-pressed')).toBe('true');
      lockApi.setHomeCardLock.mockRejectedValueOnce(new Error('offline'));
      await act(async () => button().click());
      expect(alert).toHaveBeenCalled();
      expect(button().getAttribute('aria-pressed')).toBe('true');
      await act(async () => button().click());
      expect(card().classList.contains('is-disabled')).toBe(false);
      lockApi.getHomeCardLocks.mockResolvedValue({ teaching: true, platform: false });
      auth.user = null;
      await act(async () => { window.dispatchEvent(new Event('focus')); });
      expect(card().tagName).toBe('DIV');
      expect(card().getAttribute('href')).toBeNull();
      expect(host.querySelector('#card-platform')?.tagName).toBe('A');
      expect(host.querySelector('.landing-card-lock')).toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
      alert.mockRestore();
      lockApi.getHomeCardLocks.mockResolvedValue({});
    }
  });
});
