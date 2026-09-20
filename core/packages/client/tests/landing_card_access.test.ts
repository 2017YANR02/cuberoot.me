// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';
import type { PublicMember } from '@/lib/membership-api';

const auth = vi.hoisted(() => ({ user: null as { wcaId: string } | null }));
const lockApi = vi.hoisted(() => ({
  getHomeCardLocks: vi.fn(async () => ({} as Record<string, boolean>)),
  setHomeCardLock: vi.fn(async (_id: string, _locked: boolean) => ({ ok: true })),
}));
vi.mock('@/lib/home-card-order-api', () => ({ ...lockApi, getHomeCardOrders: async () => ({}), reorderHomeCards: vi.fn() }));
vi.mock('@/lib/page-notices-api', () => ({ fetchPageNotices: async () => [] }));
const memberApi = vi.hoisted(() => ({ listPublicMembers: vi.fn(async (): Promise<PublicMember[]> => []) }));
vi.mock('@/lib/membership-api', () => memberApi);
vi.mock('@/components/LazyVisible', () => ({ default: () => null }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => auth.user, nextQuery: () => '' }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/navigation', () => ({ usePathname: () => '/zh', useParams: () => ({ lang: 'zh' }) }));
vi.mock('next/link', () => ({
  default: ({ children, prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode; prefetch?: boolean }) => createElement('a', props, children),
}));
vi.mock('@/components/HeaderToggles', () => ({ default: () => null }));
vi.mock('@/components/LandingSearch', () => ({ default: () => null }));
vi.mock('@/components/persons/sections/PersonUpcomingComps', () => ({
  default: ({ wcaId, isZh }: { wcaId: string; isZh: boolean }) => createElement('section', {
    'data-testid': 'home-upcoming-comps',
    'data-wca-id': wcaId,
    'data-is-zh': String(isZh),
  }),
}));
// Browser optics are verified in Playwright; this suite exercises card access.
vi.mock('@/lib/theme', () => ({ useEffectiveTheme: () => 'dark' }));

import LandingPage from '@/app/[lang]/LandingClient';
import { changeAppLanguage } from '@/i18n/i18n-client';
import { PRIMARY_CARDS, WCA_CARDS, SECTIONS } from '@/lib/landing-sections';

describe('homepage development cards', () => {
  it('shows the shared upcoming competition cards only for a logged-in WCA account', () => {
    changeAppLanguage('zh');
    const render = () => {
      const host = document.createElement('div');
      host.innerHTML = renderToStaticMarkup(createElement(LandingPage));
      return host.querySelector('[data-testid="home-upcoming-comps"]');
    };

    auth.user = null;
    expect(render()).toBeNull();
    auth.user = { wcaId: '2017YANR02' };
    const upcoming = render();
    expect(upcoming?.getAttribute('data-wca-id')).toBe('2017YANR02');
    expect(upcoming?.getAttribute('data-is-zh')).toBe('true');
  });

  it.each([null, { wcaId: 'ordinary-user' }, { wcaId: ADMIN_WCA_IDS[0] }])('renders access for %j', (user) => {
    auth.user = user;
    changeAppLanguage('zh');
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(LandingPage));
    const admin = user?.wcaId === ADMIN_WCA_IDS[0];
    for (const [id, href] of [['platform', '/zh/platform'], ['teaching-management', '/zh/org'], ['learning-center', '/zh/learn']]) {
      const card = host.querySelector(`#card-${id}`)!;
      if (!admin) { expect(card).toBeNull(); continue; }
      expect(card.tagName).toBe('A');
      expect(card.getAttribute('href')).toBe(href);
      expect(card.getAttribute('aria-disabled')).toBeNull();
      expect(card.classList.contains('is-disabled')).toBe(true);
      expect(card.querySelector('.coming-soon-badge')).toBeNull();
      expect(card.querySelector('.lucide-lock')).toBeNull();
    }
    expect(host.querySelector('#card-teaching')?.getAttribute('href')).toBe(admin ? '/zh/courses' : undefined);
    const partnership = host.querySelector('#card-partnership');
    if (admin) {
      expect(partnership?.getAttribute('href')).toBe('/zh/partnership');
      expect(partnership?.classList.contains('is-disabled')).toBe(true);
      const lock = partnership?.parentElement?.querySelector<HTMLButtonElement>('.landing-card-lock');
      expect(lock?.disabled).toBe(true);
      expect(lock?.getAttribute('aria-pressed')).toBe('true');
      expect(lock?.getAttribute('aria-label')).toBe('解锁卡片');
    } else {
      expect(partnership).toBeNull();
    }
    const interview = host.querySelector('#card-interview');
    if (admin) {
      expect(interview?.getAttribute('href')).toBe('/zh/docs/edit?id=b769490d-292b-4423-8e83-3ada43c1d96b');
      expect(interview?.textContent).toContain('面试');
    } else {
      expect(interview).toBeNull();
    }
    expect(host.querySelectorAll('.landing-card-lock').length > 0).toBe(admin);
    const adminArea = host.querySelector('#landing-admin-content');
    if (admin) {
      expect(host.querySelector('.landing-page')?.lastElementChild).toBe(adminArea);
      for (const config of [...PRIMARY_CARDS, ...WCA_CARDS, ...SECTIONS.flatMap((section) => section.cards)]) {
        const cards = host.querySelectorAll(`#card-${config.id}`);
        expect(cards).toHaveLength(1);
        expect(adminArea?.contains(cards[0])).toBe(Boolean(config.adminOnly || config.lockedForNonAdmin || config.comingSoon));
      }
      expect(adminArea?.querySelector('#enterprise-members-title')).not.toBeNull();
      expect(adminArea?.querySelector('#individual-members-title')).not.toBeNull();
    } else {
      expect(adminArea).toBeNull();
    }
  });
  it.each(['partnership', 'interview'])('treats %s as a default-locked card that can be unlocked for visitors', async (id) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    auth.user = { wcaId: ADMIN_WCA_IDS[0] };
    const host = document.createElement('div');
    const root = createRoot(host);
    const card = () => host.querySelector(`#card-${id}`)!;
    const button = () => card().parentElement!.querySelector<HTMLButtonElement>('.landing-card-lock')!;
    try {
      await act(async () => root.render(createElement(LandingPage)));
      expect(card().classList.contains('is-disabled')).toBe(true);
      expect(card().closest('#landing-admin-content')).not.toBeNull();
      expect(button().disabled).toBe(false);
      await act(async () => button().click());
      expect(lockApi.setHomeCardLock).toHaveBeenLastCalledWith(id, false);
      expect(card().classList.contains('is-disabled')).toBe(false);
      expect(card().closest('#landing-admin-content')).toBeNull();
      await act(async () => button().click());
      expect(lockApi.setHomeCardLock).toHaveBeenLastCalledWith(id, true);
      expect(card().closest('#landing-admin-content')).not.toBeNull();
      auth.user = null;
      lockApi.getHomeCardLocks.mockResolvedValueOnce({ [id]: false });
      await act(async () => { window.dispatchEvent(new Event('focus')); });
      expect(card().tagName).toBe('A');
      expect(host.querySelectorAll(`#card-${id}`)).toHaveLength(1);
      expect(host.querySelector('#landing-admin-content')).toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
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
      expect(card().closest('#landing-admin-content')).toBeNull();
      await act(async () => button().click());
      expect(card().closest('#landing-admin-content')).not.toBeNull();
      expect(host.querySelectorAll('#card-teaching')).toHaveLength(1);
      expect(lockApi.setHomeCardLock).toHaveBeenLastCalledWith('teaching', true);
      expect(card().classList.contains('is-disabled')).toBe(true);
      expect(card().getAttribute('href')).toBe('/zh/courses');
      expect(button().getAttribute('aria-pressed')).toBe('true');
      lockApi.setHomeCardLock.mockRejectedValueOnce(new Error('offline'));
      await act(async () => button().click());
      expect(alert).toHaveBeenCalled();
      expect(button().getAttribute('aria-pressed')).toBe('true');
      expect(card().closest('#landing-admin-content')).not.toBeNull();
      await act(async () => button().click());
      expect(card().classList.contains('is-disabled')).toBe(false);
      expect(card().closest('#landing-admin-content')).toBeNull();
      lockApi.getHomeCardLocks.mockResolvedValue({ teaching: true, platform: false });
      auth.user = null;
      await act(async () => { window.dispatchEvent(new Event('focus')); });
      expect(card()).toBeNull();
      expect(host.querySelector('#card-platform')?.tagName).toBe('A');
      expect(host.querySelector('.landing-card-lock')).toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
      alert.mockRestore();
      lockApi.getHomeCardLocks.mockResolvedValue({});
    }
  });
  it('locks member sections independently and restores saved visitor visibility', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    auth.user = { wcaId: ADMIN_WCA_IDS[0] };
    const host = document.createElement('div');
    const root = createRoot(host);
    const section = (id: string) => host.querySelector(`[aria-labelledby="${id}-members-title"]`);
    const button = (id: string) => section(id)!.querySelector<HTMLButtonElement>('button')!;
    try {
      await act(async () => root.render(createElement(LandingPage)));
      expect(button('enterprise').getAttribute('aria-pressed')).toBe('true');
      expect(button('individual').getAttribute('aria-pressed')).toBe('true');
      expect(section('enterprise')?.closest('#landing-admin-content')).not.toBeNull();
      expect(section('individual')?.closest('#landing-admin-content')).not.toBeNull();
      await act(async () => button('enterprise').click());
      expect(section('enterprise')?.closest('#landing-admin-content')).toBeNull();
      expect(section('individual')?.closest('#landing-admin-content')).not.toBeNull();
      expect(lockApi.setHomeCardLock).toHaveBeenLastCalledWith('enterprise-members', false);
      expect(button('enterprise').getAttribute('aria-pressed')).toBe('false');
      expect(button('individual').getAttribute('aria-pressed')).toBe('true');
      await act(async () => button('individual').click());
      expect(lockApi.setHomeCardLock).toHaveBeenLastCalledWith('individual-members', false);
      auth.user = null;
      lockApi.getHomeCardLocks.mockResolvedValueOnce({ 'enterprise-members': false, 'individual-members': true });
      await act(async () => { window.dispatchEvent(new Event('focus')); });
      expect(section('enterprise')).not.toBeNull();
      expect(section('individual')).toBeNull();
      expect(section('enterprise')!.querySelector('button')).toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
  });
  it('orders VIP numbers numerically and filters each member section by name, WCA ID and padded or short VIP ID', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    auth.user = { wcaId: ADMIN_WCA_IDS[0] };
    changeAppLanguage('zh');
    const rows: PublicMember[] = [
      { wcaId: 'TEN', name: 'Ten', vipId: 'VIP10', planSlug: 'individual_yearly' },
      { wcaId: 'NONE', name: 'Missing', planSlug: 'individual_yearly' },
      { wcaId: 'TWO', name: '测试二', vipId: 'VIP000002', planSlug: 'individual_yearly' },
      { wcaId: 'ONE', name: 'One', vipId: 'VIP000001', planSlug: 'individual_yearly' },
      { wcaId: 'BIG2', name: 'Large B', vipId: 'VIP9007199254740993', planSlug: 'individual_yearly' },
      { wcaId: 'BIG1', name: 'Big one', vipId: 'VIP9007199254740992', planSlug: 'individual_yearly' },
      { wcaId: 'ORG', name: 'Enterprise', vipId: 'VIP3', planSlug: 'enterprise_yearly' },
      { wcaId: 'INVALID', name: 'Invalid', vipId: 'invalid', planSlug: 'individual_yearly' },
    ];
    memberApi.listPublicMembers.mockResolvedValueOnce(rows);
    const host = document.createElement('div');
    const root = createRoot(host);
    const section = (id: string) => host.querySelector(`[aria-labelledby="${id}-members-title"]`)!;
    const ids = (id: string) => [...section(id).querySelectorAll('.landing-member')].map((link) => link.getAttribute('href')!.split('/').at(-1));
    const search = async (value: string) => act(async () => {
      const input = section('individual').querySelector('input')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    try {
      await act(async () => root.render(createElement(LandingPage)));
      const expected = ['ONE', 'TWO', 'TEN', 'BIG1', 'BIG2', 'NONE', 'INVALID'];
      expect(ids('individual')).toEqual(expected);
      for (const query of ['测试二', 'two', ' vip2 ', 'VIP000002']) {
        await search(query);
        expect(ids('individual')).toEqual(['TWO']);
        expect(ids('enterprise')).toEqual(['ORG']);
      }
      await search('no-match');
      expect(ids('individual')).toEqual([]);
      expect(section('individual').querySelector('[role="status"]')?.textContent).toBe('没有匹配的会员');
      await act(async () => section('individual').querySelector<HTMLButtonElement>('[aria-label="清除"]')!.click());
      expect(ids('individual')).toEqual(expected);
      await search('  ');
      expect(ids('individual')).toEqual(expected);
      expect(rows[0].wcaId).toBe('TEN');
    } finally {
      await act(async () => root.unmount());
    }
  });
  it.each([null, { wcaId: 'ordinary-user' }])('hides persisted locks without a first-render flash for %j', async (user) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    auth.user = user;
    let resolveLocks!: (locks: Record<string, boolean>) => void;
    lockApi.getHomeCardLocks.mockImplementationOnce(() => new Promise((resolve) => { resolveLocks = resolve; }));
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      await act(async () => root.render(createElement(LandingPage)));
      expect(host.querySelector('[id^="card-"]')).toBeNull();
      expect(host.querySelector('#enterprise-members-title')).toBeNull();
      expect(host.querySelector('#individual-members-title')).toBeNull();
      await act(async () => resolveLocks({ contests: true, 'online-competitions': true, 'comp-sim': true }));
      for (const id of ['contests', 'online-competitions', 'comp-sim', 'platform', 'teaching-management', 'learning-center']) {
        expect(host.querySelector(`#card-${id}`)).toBeNull();
      }
      expect(host.querySelector('#card-teaching')?.getAttribute('href')).toBe('/zh/courses');
      expect(host.querySelector('#enterprise-members-title')).toBeNull();
      expect(host.querySelector('#individual-members-title')).toBeNull();
      lockApi.getHomeCardLocks.mockResolvedValueOnce({ contests: false, 'online-competitions': false, 'comp-sim': false });
      await act(async () => { window.dispatchEvent(new Event('focus')); });
      for (const id of ['contests', 'online-competitions', 'comp-sim']) {
        expect(host.querySelector(`#card-${id}`)?.tagName).toBe('A');
      }
    } finally {
      await act(async () => root.unmount());
    }
  });
});
