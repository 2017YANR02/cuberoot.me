// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PlatformActionId, PlatformActionResult } from '@/lib/platform-types';

const state = vi.hoisted(() => ({
  user: null as null | { uid: number }, admin: false, load: vi.fn(), execute: vi.fn(), learning: vi.fn(), entry: vi.fn((path: string) => path), t: (zh: string) => zh,
  action: null as null | ((action: PlatformActionId, id?: string, payload?: Record<string, unknown>) => Promise<PlatformActionResult | undefined>),
}));
vi.mock('@/hooks/useT', () => ({ useT: () => state.t }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => state.user, useIsAdmin: () => state.admin, nextQuery: () => '' }));
vi.mock('@/lib/entry-navigation', () => ({ currentEntryHref: state.entry }));
vi.mock('nuqs', async original => {
  const { useState } = await import('react');
  return { ...await original<object>(), useQueryState: (_key: string, parser: { defaultValue?: unknown }) => useState(parser.defaultValue ?? null) };
});
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/lib/platform-gateway', async original => ({ ...await original<object>(), loadPlatformResource: state.load, executePlatformAction: state.execute }));
vi.mock('@/lib/platform-learning', async original => ({ ...await original<object>(), platformLearningRequest: state.learning }));
vi.mock('@/components/AppLink', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => createElement('a', { href }, children) }));
vi.mock('@/components/PageBackLink', () => ({ default: () => null }));
vi.mock('@/components/platform/PlatformDomainActions', () => ({ PlatformDomainActions: ({ runAction }: { runAction: typeof state.action }) => { state.action = runAction; return createElement('button', {}, '操作'); } }));
vi.mock('@/components/platform/PlatformDomainContent', () => ({ PlatformDomainContent: () => null }));
vi.mock('@/components/platform/PlatformEntityList', () => ({ PlatformEntityList: ({ items }: { items: { title: string }[] }) => createElement('div', {}, items.map(item => item.title).join(',')) }));
vi.mock('@/components/platform/PlatformLanding', () => ({ PlatformLanding: () => null }));
vi.mock('@/components/platform/PlatformInfoViews', () => ({ PlatformAboutView: () => null, PlatformOfflineView: () => null, PlatformAccountView: () => null, PlatformCanonicalView: () => null }));
vi.mock('@/components/platform/PlatformOrderPayment', () => ({ PlatformOrderPayment: () => null }));
vi.mock('@/components/platform/PlatformQrAdmin', () => ({ PlatformQrAdmin: () => null }));
vi.mock('@/components/platform/OnlineCompetitions', () => ({ OnlineCompetitions: () => null }));
vi.mock('@/components/platform/OnlineCompetitionPreview', () => ({ OnlineCompetitionPreview: () => null }));
import { PlatformRouteView } from '@/components/platform/PlatformRouteView';
import { PlatformLearningPath } from '@/components/platform/PlatformLearningWorkspace';
import { PLATFORM_ROUTES } from '@/lib/platform-routes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const params = {};
const render = async (id: string) => act(async () => root.render(createElement(PlatformRouteView, { definition: PLATFORM_ROUTES.find(route => route.id === id)!, params })));
beforeEach(() => { vi.clearAllMocks(); state.user = { uid: 1 }; state.admin = false; state.action = null; state.load.mockResolvedValue({ items: [] }); host = document.createElement('div'); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); });

it('blocks guests and ordinary accounts before requesting admin resources, then permits admin loading', async () => {
  state.user = null;
  await render('admin-courses');
  expect(state.load).not.toHaveBeenCalled();
  expect(host.textContent).toContain('请先登录');
  state.user = { uid: 1 };
  await render('admin-courses');
  expect(state.load).not.toHaveBeenCalled();
  state.admin = true;
  state.load.mockResolvedValue({ items: [{ id: 'course', title: '管理课程 fixture' }] });
  await render('admin-courses');
  expect(state.load).toHaveBeenCalledWith('admin-courses', expect.anything());
  expect(host.textContent).toContain('管理课程 fixture');
});

it('shows instructor data only after a successful instructor response and handles denial', async () => {
  state.learning.mockResolvedValueOnce({ totals: {}, courses: [], months: [], payouts: [], recent: [] });
  await render('instructor');
  expect(state.learning).toHaveBeenCalledWith('/instructor/dashboard', undefined, 'GET', expect.any(AbortSignal));
  expect(host.textContent).toContain('月度收入');
  state.user = { uid: 2 };
  state.learning.mockRejectedValueOnce(new Error('Instructor access required'));
  await render('instructor');
  expect(host.textContent).toContain('Instructor access required');
  expect(host.textContent).not.toContain('月度收入');
});

it('does not continue a former account redemption after its response arrives', async () => {
  let finish!: (result: PlatformActionResult) => void;
  state.execute.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await render('account-invites');
  let pending!: Promise<PlatformActionResult | undefined>;
  await act(async () => { pending = state.action!('redeem-invite', undefined, { code: 'OLD-ACCOUNT' }); });
  state.user = { uid: 2 };
  await render('account-invites');
  await act(async () => { finish({ entitlementId: 'old-entitlement' }); await pending; });
  expect(state.load).not.toHaveBeenCalled();
  expect(state.entry).not.toHaveBeenCalled();
  expect(await pending).toBeUndefined();
});

it('drops old account data even when a resource ignores its aborted signal', async () => {
  let finish!: (result: unknown) => void;
  state.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce({ items: [{ id: 'new', title: '当前账号订单' }] });
  await render('orders');
  const oldSignal = state.load.mock.calls[0][1].signal as AbortSignal;
  state.user = { uid: 2 };
  await render('orders');
  expect(oldSignal.aborted).toBe(true);
  await act(async () => finish({ items: [{ id: 'old', title: '旧账号订单' }] }));
  expect(host.textContent).toContain('当前账号订单');
  expect(host.textContent).not.toContain('旧账号订单');
});

it('discards cancelled path progress and clears a previous error after account refresh', async () => {
  let finish!: (value: unknown) => void;
  const entity = { id: 'path', title: '路径', data: { items: [{ courseId: 'course', title: '课程', totalLessons: 10 }] } };
  state.learning.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce({ items: [] })
    .mockRejectedValueOnce(new Error('网络暂不可用'))
    .mockResolvedValueOnce({ items: [] });
  const renderPath = () => root.render(createElement(PlatformLearningPath, { entity }));
  await act(async () => renderPath());
  const oldSignal = state.learning.mock.calls[0][3] as AbortSignal;
  state.user = { uid: 1 };
  await act(async () => renderPath());
  expect(oldSignal.aborted).toBe(true);
  expect(host.textContent).toContain('网络暂不可用');
  state.learning.mockResolvedValueOnce({ items: [{ id: 'course', completedLessons: 2, totalLessons: 10, progressBps: 2000 }] })
    .mockResolvedValueOnce({ items: [] });
  state.user = { uid: 1 };
  await act(async () => renderPath());
  expect(host.textContent).not.toContain('网络暂不可用');
  await act(async () => finish({ items: [{ id: 'course', completedLessons: 10, totalLessons: 10, progressBps: 10000 }] }));
  expect(host.textContent).toContain('整体进度 2/10');
  expect(host.textContent).not.toContain('整体进度 10/10');
});
