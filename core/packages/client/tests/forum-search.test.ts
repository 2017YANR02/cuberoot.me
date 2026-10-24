// @vitest-environment jsdom
import { act, createElement } from 'react';
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
vi.mock('@/app/[lang]/forum/_components/ForumBreadcrumbs', () => ({ ForumBreadcrumbs: () => null }));
vi.mock('@/app/[lang]/forum/_components/ThreadRowList', () => ({ ThreadRowList: () => null }));

import ForumSearchPage from '@/app/[lang]/forum/search/page';
import { fetchForumFeed } from '@/lib/forum-api';

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

it('preserves session authentication for viewer-dependent forum reads', async () => {
  mocks.exchange.mockResolvedValueOnce('access-token');
  await fetchForumFeed('active', 1, 20);
  expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith('web-session:search-test');
  expect(new Headers(mocks.fetch.mock.lastCall![1].headers).get('Authorization')).toBe('Bearer access-token');
});
