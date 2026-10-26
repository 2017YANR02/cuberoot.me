// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CompetitionCalendarButton } from '@/components/CompetitionCalendarButton';
const mocks = vi.hoisted(() => ({ user: null as { uid: number } | null, push: vi.fn(), add: vi.fn(), check: vi.fn() }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => mocks.user, nextQuery: (path: string) => `?next=${encodeURIComponent(path)}` }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/competition-calendar-event', () => ({ addCompetitionToCalendar: mocks.add, isCompetitionInCalendar: mocks.check }));
vi.mock('@/i18n/tr', () => ({ tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/components/AppLink', () => ({ default: ({ prefetch: _prefetch, ...props }: import('react').ComponentProps<'a'> & { prefetch?: boolean }) => createElement('a', props) }));
const competition = { id: 'LishuiOpen2026', title: '丽水公开赛2026', startDate: '2026-12-06', endDate: '2026-12-06', location: '丽水' };
let root: Root;
let host: HTMLDivElement;
const render = async (input = competition) => { await act(async () => root.render(createElement(StrictMode, null, createElement(CompetitionCalendarButton, { competition: input })))); };
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); mocks.add.mockResolvedValue(undefined); mocks.check.mockResolvedValue(false); mocks.user = null;
  sessionStorage.clear(); window.history.replaceState(null, '', '/zh/wca/comp/LishuiOpen2026?view=psych');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('returns to the same view after login and adds exactly once, only once dates have loaded', async () => {
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.push).toHaveBeenCalledWith('/zh/account?next=%2Fzh%2Fwca%2Fcomp%2FLishuiOpen2026%3Fview%3Dpsych');
  await act(async () => root.unmount()); root = createRoot(host);
  mocks.user = { uid: 7 };
  await render({ ...competition, startDate: '' });
  expect(mocks.add).not.toHaveBeenCalled();
  await render();
  expect(mocks.add).toHaveBeenCalledTimes(1);
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
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(mocks.add).toHaveBeenCalledTimes(2);
  expect(host.querySelector('button')).toBeNull();
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/calendar?d=2026-12-06');
});

it('shows the calendar link immediately for a previously added competition without creating another event', async () => {
  mocks.user = { uid: 7 };
  mocks.check.mockResolvedValue(true);
  await render();
  expect(mocks.add).not.toHaveBeenCalled();
  expect(host.querySelector('button')).toBeNull();
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/calendar?d=2026-12-06');
  expect(host.querySelector('a')?.getAttribute('aria-label')).toBe('已添加 · 查看日历');
});
