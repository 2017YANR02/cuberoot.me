// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CompetitionCalendarButton } from '@/components/CompetitionCalendarButton';
import { entryNavigationBack, installEntryNavigation } from '@/lib/entry-navigation';
const mocks = vi.hoisted(() => ({ user: null as { uid: number } | null, push: vi.fn(), add: vi.fn(), check: vi.fn(), follow: vi.fn() }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => mocks.user, nextQuery: (path: string) => `?next=${encodeURIComponent(path)}` }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/competition-calendar-event', () => ({ addCompetitionToCalendar: mocks.add, isCompetitionInCalendar: mocks.check }));
vi.mock('@/lib/comp-follows', () => ({ addFollow: mocks.follow }));
vi.mock('@/i18n/tr', () => ({ tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/components/AppLink', () => ({ default: ({ prefetch: _prefetch, ...props }: import('react').ComponentProps<'a'> & { prefetch?: boolean }) => createElement('a', props) }));
const competition = { id: 'LishuiOpen2026', title: '丽水公开赛2026', startDate: '2026-12-06', endDate: '2026-12-06', location: '丽水' };
let root: Root;
let disposeNavigation: () => void;
let host: HTMLDivElement;
const render = async (input = competition) => { await act(async () => root.render(createElement(StrictMode, null, createElement(CompetitionCalendarButton, { competition: input })))); };
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); mocks.add.mockResolvedValue(undefined); mocks.check.mockResolvedValue(false); mocks.follow.mockResolvedValue(undefined); mocks.user = null;
  sessionStorage.clear(); window.history.replaceState(null, '', '/zh/wca/comp/LishuiOpen2026?view=psych');
  disposeNavigation = installEntryNavigation();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); disposeNavigation(); });
it('returns to the same view after login and adds exactly once, only once dates have loaded', async () => {
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(mocks.add).not.toHaveBeenCalled();
  const login = new URL(mocks.push.mock.calls[0][0], window.location.origin);
  expect(login.pathname).toBe('/zh/account');
  expect(login.searchParams.get('next')).toBe('/zh/wca/comp/LishuiOpen2026?view=psych');
  expect(login.searchParams.has('navBack')).toBe(false);
  window.history.pushState(null, '', login.href);
  expect(entryNavigationBack(login.pathname + login.search)).toBe('/zh/wca/comp/LishuiOpen2026?view=psych');
  window.history.replaceState(null, '', '/zh/wca/comp/LishuiOpen2026?view=psych');
  await act(async () => root.unmount()); root = createRoot(host);
  mocks.user = { uid: 7 };
  await render({ ...competition, startDate: '' });
  expect(mocks.add).not.toHaveBeenCalled();
  await render();
  expect(mocks.add).toHaveBeenCalledTimes(1);
  expect(mocks.follow).toHaveBeenCalledExactlyOnceWith(competition.id);
  expect(mocks.add.mock.invocationCallOrder[0]).toBeLessThan(mocks.follow.mock.invocationCallOrder[0]);
  expect(host.querySelector('a')?.getAttribute('aria-label')).toBe('已添加 · 查看日历');
  expect(host.querySelector('a')?.textContent).toBe('');
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/calendar?d=2026-12-06');
  await act(async () => root.unmount()); root = createRoot(host);
  await render();
  expect(mocks.add).toHaveBeenCalledTimes(1);
});
it('does not add on an ordinary logged-in visit and lets a failed click retry', async () => {
  mocks.user = { uid: 7 };
  await render(); expect(mocks.add).not.toHaveBeenCalled();
  mocks.add.mockRejectedValueOnce(new Error('offline'));
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(host.textContent).toContain('添加失败，请重试');
  expect(mocks.follow).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(mocks.add).toHaveBeenCalledTimes(2);
  expect(mocks.follow).toHaveBeenCalledExactlyOnceWith(competition.id);
  expect(host.querySelector('button')).toBeNull();
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/calendar?d=2026-12-06');
});

it('shows the calendar link immediately for a previously added competition without creating another event', async () => {
  mocks.user = { uid: 7 };
  mocks.check.mockResolvedValue(true);
  await render();
  expect(mocks.add).not.toHaveBeenCalled();
  expect(host.querySelector('button')).toBeNull();
  expect(mocks.follow).not.toHaveBeenCalled();
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/calendar?d=2026-12-06');
  expect(host.querySelector('a')?.getAttribute('aria-label')).toBe('已添加 · 查看日历');
});

it('allows retry when starring fails after calendar creation', async () => {
  mocks.user = { uid: 7 };
  mocks.follow.mockRejectedValueOnce(new Error('offline'));
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(host.textContent).toContain('添加失败，请重试');
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(mocks.follow).toHaveBeenCalledTimes(2);
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/calendar?d=2026-12-06');
});

it('does not star for a different account after an in-flight calendar addition', async () => {
  mocks.user = { uid: 7 };
  let finish!: () => void;
  mocks.add.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  mocks.user = { uid: 8 };
  await render();
  await act(async () => finish());
  expect(mocks.follow).not.toHaveBeenCalled();
});
