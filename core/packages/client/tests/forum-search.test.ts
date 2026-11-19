// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), exchange: vi.fn() }));
vi.mock('@/lib/auth-store', () => ({
  getSessionToken: () => 'web-session:search-test', getWcaToken: () => '',
}));
vi.mock('@/lib/web-session', () => ({ getWebAccessToken: mocks.exchange }));
vi.mock('@/i18n/tr', () => ({
  useLang: () => 'zh', tr: ({ zh }: { zh: string }) => zh, T: ({ zh }: { zh: string }) => zh,
}));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/useEntryRouter', () => ({ useEntryRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/[lang]/forum/_components/ForumBreadcrumbs', () => ({ ForumBreadcrumbs: () => null }));
vi.mock('@/app/[lang]/forum/_components/ThreadRowList', () => ({ ThreadRowList: () => null }));
vi.mock('@/app/[lang]/forum/_components/ForumHeader', () => ({ ForumHeader: ({ children }: { children: React.ReactNode }) => createElement('header', null, children) }));
vi.mock('@/components/forum/ForumFeedList', () => ({ ForumFeedList: () => null }));

import ForumSearchPage from '@/app/[lang]/forum/search/page';
import ForumFeedPage from '@/app/[lang]/forum/feed/page';
import { fetchForumFeed } from '@/lib/forum-api';
import { PlatformScopedSearch } from '@/components/platform/PlatformScopedSearch';
import { PlatformSearchContext, type PlatformSearchBinding } from '@/lib/platform-navigation-context';

let host: HTMLDivElement;
let root: Root;
const result = { threads: [], total: 60, page: 1, size: 25 };
const advance = async (ms: number) => { await act(async () => vi.advanceTimersByTimeAsync(ms)); };
async function type(value: string) {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>('.forum-search-input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  mocks.fetch.mockReset().mockImplementation(async () => Response.json(result));
  // A cold or stalled session exchange must not block public search.
  mocks.exchange.mockReset().mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal('fetch', mocks.fetch);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(NuqsTestingAdapter, {
    searchParams: '?q=蓝牙', hasMemory: true, children: createElement(ForumSearchPage),
  })));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
});

it('starts URL searches and pagination immediately without waiting for login or sending credentials', async () => {
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  const [url, init] = mocks.fetch.mock.calls[0];
  expect(new URL(url).searchParams.get('q')).toBe('蓝牙');
  expect(init.credentials).toBe('omit');
  expect(new Headers(init.headers).has('Authorization')).toBe(false);
  expect(mocks.exchange).not.toHaveBeenCalled();
  expect(host.textContent).toContain('60');

  await act(async () => host.querySelectorAll<HTMLButtonElement>('.wse-page-btn')[1].click());
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(new URL(mocks.fetch.mock.calls[1][0]).searchParams.get('page')).toBe('2');
});

it('debounces typing once, aborts superseded requests and ignores late results after clearing', async () => {
  let resolveOld!: (response: Response) => void;
  mocks.fetch.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; }));
  await type('智能');
  await advance(299);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  const signal: AbortSignal = mocks.fetch.mock.calls[1][1].signal;
  expect(signal.aborted).toBe(false);

  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="清除"]')!.click());
  expect(signal.aborted).toBe(true);
  await act(async () => resolveOld(Response.json(result)));
  expect(host.textContent).not.toContain('找到');
  expect(host.textContent).not.toContain('搜索中');
});

it('moves the search input into the Platform masthead and shares query, pagination and clearing with the real forum search', async () => {
  function Embedded() {
    const [binding, setBinding] = useState<PlatformSearchBinding | null>(null);
    return createElement('div', null, createElement(PlatformScopedSearch, { lang: 'zh', scope: 'forum', binding }),
      createElement(PlatformSearchContext, { value: { scope: 'forum', bind: setBinding } }, createElement(ForumSearchPage)));
  }
  mocks.fetch.mockClear();
  await act(async () => root.render(createElement(NuqsTestingAdapter, { key: 'embedded', searchParams: '?q=蓝牙&page=2', hasMemory: true, children: createElement(Embedded) })));
  expect(host.querySelector('.forum-search-box')).toBeNull();
  expect(host.querySelector('.platform-filter-trigger')).toBeNull();
  const input = host.querySelector<HTMLInputElement>('.platform-scoped-search input')!;
  expect(input.value).toBe('蓝牙');
  expect(new URL(mocks.fetch.mock.lastCall![0]).searchParams.get('page')).toBe('2');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '训练');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await advance(300);
  expect(new URL(mocks.fetch.mock.lastCall![0]).searchParams.get('q')).toBe('训练');
  expect(new URL(mocks.fetch.mock.lastCall![0]).searchParams.get('page')).toBe('1');
  expect(mocks.exchange).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="清除"]')!.click());
  expect(input.value).toBe('');
  expect(host.textContent).not.toContain('找到');
});

it('moves the existing activity board and sort controls into the Platform search filter', async () => {
  mocks.exchange.mockResolvedValue('access-token');
  mocks.fetch.mockClear();
  mocks.fetch.mockImplementation(async url => Response.json(new URL(url).pathname.endsWith('/index')
    ? { categories: [{ id: 1, nameZh: '论坛', nameEn: 'Forum', forums: [
      { id: 1, slug: 'general', nameZh: '综合讨论', nameEn: 'General discussion' },
      { id: 2, slug: 'training', nameZh: '魔方训练', nameEn: 'Cube training' },
    ] }] } : { threads: [], total: 0 }));
  function Embedded() {
    const [binding, setBinding] = useState<PlatformSearchBinding | null>(null);
    return createElement('div', null, createElement(PlatformScopedSearch, { lang: 'zh', scope: 'forum', binding }),
      createElement(PlatformSearchContext, { value: { scope: 'forum', routeId: 'community-feed', bind: setBinding } }, createElement(ForumFeedPage)));
  }
  await act(async () => root.render(createElement(NuqsTestingAdapter, { key: 'feed', searchParams: '?page=2', hasMemory: true, children: createElement(Embedded) })));
  expect(host.querySelector('select[aria-label="筛选板块"]')).toBeNull();
  expect(host.querySelector('select[aria-label="动态排序"]')).toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('.platform-filter-trigger')!.click());
  const panelButton = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('.platform-filter-panel button')].find(button => button.textContent?.trim() === label)!;
  await act(async () => panelButton('魔方训练').click());
  await act(async () => panelButton('最新发布').click());
  const feedCalls = () => mocks.fetch.mock.calls.filter(call => new URL(call[0]).pathname.endsWith('/feed'));
  expect(feedCalls()).toHaveLength(1);
  await act(async () => panelButton('应用筛选').click());
  expect(Object.fromEntries(new URL(feedCalls().at(-1)![0]).searchParams)).toMatchObject({ forum: 'training', sort: 'latest', page: '1' });
  expect(host.querySelector('.platform-filter-count')?.textContent).toBe('2');
  expect(host.querySelector<HTMLButtonElement>('.platform-scoped-search button[type=submit]')?.disabled).toBe(true);
});

it('preserves session authentication for viewer-dependent forum reads', async () => {
  mocks.exchange.mockResolvedValueOnce('access-token');
  await fetchForumFeed('active', 1, 20);
  expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith('web-session:search-test');
  expect(new Headers(mocks.fetch.mock.lastCall![1].headers).get('Authorization')).toBe('Bearer access-token');
});

it('sends the board filter with feed pagination and omits it for all boards', async () => {
  mocks.exchange.mockResolvedValue('access-token');
  await fetchForumFeed('latest', 2, 10, 'general');
  const filtered = new URL(mocks.fetch.mock.lastCall![0]);
  expect(Object.fromEntries(filtered.searchParams)).toMatchObject({ forum: 'general', sort: 'latest', page: '2', size: '10' });
  await fetchForumFeed('latest', 1, 10);
  expect(new URL(mocks.fetch.mock.lastCall![0]).searchParams.has('forum')).toBe(false);
});
