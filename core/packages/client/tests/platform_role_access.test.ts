// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PlatformActionId, PlatformActionResult } from '@/lib/platform-types';

const state = vi.hoisted(() => ({
  user: null as null | { uid: number }, admin: false, load: vi.fn(), execute: vi.fn(), learning: vi.fn(), entry: vi.fn((path: string) => path), t: (zh: string) => zh,
  action: null as null | ((action: PlatformActionId, id?: string, payload?: Record<string, unknown>) => Promise<PlatformActionResult | undefined>),
}));
vi.mock('@/hooks/useT', () => ({ useT: () => state.t }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/useEntryRouter', () => ({ useEntryRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => state.user, useIsAdmin: () => state.admin, nextQuery: () => '' }));
vi.mock('@/lib/entry-navigation', () => ({ currentEntryHref: state.entry }));
vi.mock('nuqs', async original => {
  const { useState } = await import('react');
  return { ...await original<object>(), useQueryState: (_key: string, parser: { defaultValue?: unknown }) => useState(parser.defaultValue ?? null) };
});
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
import { PlatformNavigationContext, PlatformSearchContext, type PlatformSearchBinding } from '@/lib/platform-navigation-context';
import { PlatformScopedSearch } from '@/components/platform/PlatformScopedSearch';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const params = {};
const clickFilterButton = async (label: string) => act(async () => {
  const button = [...host.querySelectorAll<HTMLButtonElement>('.platform-filter-panel button')].find(item => item.textContent?.trim() === label);
  expect(button).toBeDefined();
  button!.click();
});
const openFilters = async () => act(async () => host.querySelector<HTMLButtonElement>('.platform-filter-trigger')!.click());
const render = async (id: string) => {
  await act(async () => root.render(createElement(PlatformRouteView, { definition: PLATFORM_ROUTES.find(route => route.id === id)!, params })));
  await act(async () => { await vi.dynamicImportSettled(); });
};
const renderInShell = async (id: string, routeParams = params) => act(async () => root.render(createElement(PlatformNavigationContext, { value: true },
  createElement(PlatformRouteView, { definition: PLATFORM_ROUTES.find(route => route.id === id)!, params: routeParams }))));
beforeEach(() => { vi.clearAllMocks(); state.user = { uid: 1 }; state.admin = false; state.action = null; state.load.mockResolvedValue({ items: [] }); host = document.createElement('div'); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); });

it('combines real catalog facets with the masthead and applies or resets them together', async () => {
  state.user = null;
  state.load.mockResolvedValue({ items: [
    { id: 'course-1', title: '三阶入门课程', data: { presentation: { tags: ['puzzle:333', 'topic:beginner'] } } },
    { id: 'course-2', title: '二阶进阶课程', data: { presentation: { tags: ['puzzle:222', 'topic:speed'] } } },
  ] });
  function Embedded() {
    const [binding, setBinding] = useState<PlatformSearchBinding | null>(null);
    return createElement('div', null, createElement(PlatformScopedSearch, { lang: 'zh', scope: 'courses', binding }),
      createElement(PlatformNavigationContext, { value: true }, createElement(PlatformSearchContext, { value: { scope: 'courses', routeId: 'courses', bind: setBinding } },
        createElement(PlatformRouteView, { definition: PLATFORM_ROUTES.find(route => route.id === 'courses')!, params }))));
  }
  await act(async () => root.render(createElement(Embedded)));
  expect(host.querySelector('.platform-course-toolbar')).toBeNull();
  expect(host.querySelector('.platform-filter-panel')).toBeNull();
  expect(host.querySelectorAll('.platform-course-card')).toHaveLength(2);
  await openFilters();
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('全部项目');
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('全部学习方向');
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('最近更新');
  const projectSearch = host.querySelector<HTMLInputElement>('.platform-filter-search input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(projectSearch, '三阶');
    projectSearch.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(host.querySelector('.platform-filter-scroll')?.textContent).not.toContain('二阶');
  await clickFilterButton('三阶');
  expect(host.querySelector('.platform-filter-panel')?.textContent).not.toContain('速度提升');
  await clickFilterButton('入门复原');
  expect(host.querySelectorAll('.platform-course-card')).toHaveLength(2);
  await clickFilterButton('应用筛选');
  expect(host.querySelector('.platform-filter-panel')).toBeNull();
  expect(host.querySelector('.platform-filter-count')?.textContent).toBe('2');
  expect(host.querySelectorAll('.platform-course-card')).toHaveLength(1);
  await openFilters();
  await clickFilterButton('重置');
  await clickFilterButton('应用筛选');
  expect(host.querySelector('.platform-filter-count')).toBeNull();
  expect(host.querySelectorAll('.platform-course-card')).toHaveLength(2);
  const input = host.querySelector<HTMLInputElement>('.platform-scoped-search input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '三阶');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(host.querySelectorAll('.platform-course-card')).toHaveLength(1);
  expect(host.querySelector('.platform-course-card')?.textContent).toContain('三阶入门课程');
  expect(state.load.mock.calls.filter(call => call[0] === 'courses')).toHaveLength(1);
});

it('searches and sorts learning paths from the same masthead', async () => {
  state.user = null;
  state.load.mockImplementation(async (_resource, options) => ({
    items: options.query
      ? [{ id: 'path-1', title: '三阶入门路径' }]
      : [{ id: 'path-1', title: '三阶入门路径' }, { id: 'path-2', title: '进阶学习路径' }],
  }));
  function Embedded() {
    const [binding, setBinding] = useState<PlatformSearchBinding | null>(null);
    return createElement('div', null, createElement(PlatformScopedSearch, { lang: 'zh', scope: 'paths', binding }),
      createElement(PlatformNavigationContext, { value: true }, createElement(PlatformSearchContext, { value: { scope: 'paths', routeId: 'paths', bind: setBinding } },
        createElement(PlatformRouteView, { definition: PLATFORM_ROUTES.find(route => route.id === 'paths')!, params }))));
  }
  await act(async () => root.render(createElement(Embedded)));
  expect(host.querySelector('.platform-toolbar')).toBeNull();
  await openFilters();
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('最近更新');
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('标题');
  await clickFilterButton('标题');
  await clickFilterButton('应用筛选');
  expect(state.load).toHaveBeenLastCalledWith('paths', expect.objectContaining({ sort: 'title', page: 1 }));
  expect(host.textContent).toContain('进阶学习路径');
  const input = host.querySelector<HTMLInputElement>('.platform-scoped-search input')!;
  expect(input.placeholder).toBe('搜索学习路径');
  vi.useFakeTimers();
  try {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '三阶');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(state.load).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(state.load).toHaveBeenLastCalledWith('paths', expect.objectContaining({ query: '三阶', sort: 'title', page: 1 }));
    expect(host.textContent).toContain('三阶入门路径');
    expect(host.textContent).not.toContain('进阶学习路径');
    await act(async () => host.querySelector<HTMLButtonElement>('.platform-scoped-search button[aria-label="清除"]')!.click());
    expect(state.load).toHaveBeenLastCalledWith('paths', expect.objectContaining({ query: null, page: 1 }));
    expect(host.textContent).toContain('进阶学习路径');
  } finally { vi.useRealTimers(); }
});

it.each([
  ['events', '搜索活动', '筛选活动'],
  ['news', '搜索资讯', '筛选资讯'],
] as const)('combines the %s collection query, real categories and sorting in the masthead', async (id, placeholder, filterTitle) => {
  state.user = null;
  state.load.mockImplementation(async (_resource, options) => ({
    categories: ['教学', '比赛'],
    items: options.query
      ? [{ id: 'item-1', title: '魔方比赛' }]
      : [{ id: 'item-1', title: '魔方比赛' }, { id: 'item-2', title: '教学内容' }],
  }));
  function Embedded() {
    const [binding, setBinding] = useState<PlatformSearchBinding | null>(null);
    return createElement('div', null, createElement(PlatformScopedSearch, { lang: 'zh', scope: id, binding }),
      createElement(PlatformNavigationContext, { value: true }, createElement(PlatformSearchContext, { value: { scope: id, routeId: id, bind: setBinding } },
        createElement(PlatformRouteView, { definition: PLATFORM_ROUTES.find(route => route.id === id)!, params }))));
  }
  await act(async () => root.render(createElement(Embedded)));
  expect(host.querySelector('.platform-toolbar')).toBeNull();
  expect(host.querySelector('.platform-scoped-search input')?.getAttribute('placeholder')).toBe(placeholder);
  await openFilters();
  expect(host.querySelector('.platform-filter-panel')?.getAttribute('aria-label')).toBe(filterTitle);
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('教学');
  expect(host.querySelector('.platform-filter-panel')?.textContent).toContain('比赛');
  await clickFilterButton('比赛');
  await clickFilterButton('标题');
  expect(state.load).toHaveBeenCalledTimes(1);
  await clickFilterButton('应用筛选');
  expect(state.load).toHaveBeenLastCalledWith(id, expect.objectContaining({ category: '比赛', sort: 'title', page: 1 }));
  expect(host.querySelector('.platform-filter-count')?.textContent).toBe('2');
  vi.useFakeTimers();
  try {
    const input = host.querySelector<HTMLInputElement>('.platform-scoped-search input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '魔方');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(state.load).toHaveBeenLastCalledWith(id, expect.objectContaining({ query: '魔方', category: '比赛', sort: 'title', page: 1 }));
    expect(host.textContent).not.toContain('教学内容');
    await openFilters();
    await clickFilterButton('重置');
    await clickFilterButton('应用筛选');
    expect(state.load).toHaveBeenLastCalledWith(id, expect.objectContaining({ query: '魔方', category: null, sort: 'updated', page: 1 }));
    expect(host.querySelector('.platform-filter-count')).toBeNull();
  } finally { vi.useRealTimers(); }
});

it.each(['events', 'news', 'paths', 'membership', 'leaderboard', 'teacher-apply'])('keeps the selected navigation as the visible section heading on %s', async id => {
  await renderInShell(id);
  expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(true);
  expect(host.querySelector('.platform-route-labels')).toBeNull();
  if (id === 'events') expect(host.querySelector('.platform-route-actions a[href="/platform/events/preview"]')).not.toBeNull();
  if (id === 'membership') expect(host.querySelector('.platform-route-header p')?.textContent).toContain('课程会员用于解锁课程');
});

it('preserves detail titles and visible headings when the corresponding workspace navigation is unavailable', async () => {
  state.admin = false;
  await renderInShell('admin-courses');
  expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(false);
  state.admin = true;
  await renderInShell('admin-courses');
  expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(true);
  state.load.mockResolvedValue({ items: [{ id: 'example', title: '实际活动名称', summary: '活动说明' }] });
  await renderInShell('event-detail', { id: 'example' });
  expect(host.querySelector('h1')?.textContent).toBe('实际活动名称');
  expect(host.querySelector('h1')?.classList.contains('sr-only')).toBe(false);
  expect(host.querySelector('.platform-route-labels')).toBeNull();
});

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
