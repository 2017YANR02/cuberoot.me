// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { searchForum } = vi.hoisted(() => ({ searchForum: vi.fn() }));
vi.mock('@/lib/forum-api', () => ({ searchForum }));
vi.mock('@cuberoot/shared/persons-index', () => ({ loadPersonsIndex: async () => [], searchLocalPersons: () => [] }));
vi.mock('@/lib/comp-search', () => ({ loadComps: async () => [], searchComps: () => [] }));
vi.mock('@/lib/recon-api', () => ({ listRecons: async () => [] }));
vi.mock('@/lib/country-flags', () => ({ compNameZh: () => '', loadFlagData: async () => {} }));
vi.mock('@/app/[lang]/wiki/glossary.json', () => ({ default: { sections: [] } }));
vi.mock('@/app/[lang]/dev/stack/_lib/stack_meta', () => ({ STACK_TOOLS_META: [] }));
vi.mock('@/app/[lang]/wca/about/[id]/_lib/registry', () => ({ ABOUT_REGISTRY: {} }));

import { useSiteSearch, INITIAL_RENDER_CAP, type SiteSearchResult } from '@/lib/site-search';
let latest: SiteSearchResult;
function Probe({ query }: { query: string }) { latest = useSiteSearch(query, 'lazy'); return null; }
let root: Root;
let host: HTMLDivElement;
const render = async (query: string) => { await act(async () => root.render(createElement(Probe, { query }))); };
const advance = async (ms = 300) => { await act(async () => vi.advanceTimersByTimeAsync(ms)); };
const hit = { id: 8, title: '智能魔方接入指南', snippet: '低功耗蓝牙' };

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  searchForum.mockReset().mockResolvedValue({ threads: [hit], total: 15, page: 1, size: INITIAL_RENDER_CAP });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(
    url.includes('/stats/') ? { categories: [] } : url.includes('/platform/') ? { results: [] } : [],
  )));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
});

it('searches forum content after typing settles and includes its full count', async () => {
  await render('蓝'); await advance();
  expect(searchForum).not.toHaveBeenCalled();
  await render('蓝牙'); await advance(299);
  expect(latest.forumSearchPending).toBe(true);
  expect(searchForum).not.toHaveBeenCalled();
  await advance(1);
  expect(searchForum).toHaveBeenCalledExactlyOnceWith('蓝牙', 1, INITIAL_RENDER_CAP, expect.any(AbortSignal));
  expect(latest.forumMatches).toEqual([hit]);
  expect(latest.forumTotal).toBe(15);
  expect(latest.totalCount).toBe(15);
  expect(latest.forumSearchPending).toBe(false);
});

it('aborts old searches and prevents late responses from replacing a newer query or cleared input', async () => {
  let resolveOld!: (data: unknown) => void;
  searchForum.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  await render('蓝牙'); await advance();
  const signal: AbortSignal = searchForum.mock.calls[0][3];
  await render('计时');
  expect(signal.aborted).toBe(true);
  expect(latest.forumMatches).toEqual([]);
  await advance();
  await render('');
  await act(async () => resolveOld({ threads: [hit], total: 99 }));
  expect(latest.forumMatches).toEqual([]);
  expect(latest.forumTotal).toBe(0);
  expect(latest.forumSearchPending).toBe(false);
});

it('reports forum failure without blocking other searches and retries on the next query', async () => {
  searchForum.mockRejectedValueOnce(new Error('offline'));
  await render('蓝牙'); await advance();
  expect(latest.forumSearchError).toBe(true);
  expect(latest.forumSearchPending).toBe(false);
  expect(latest.localSearchError).toBe(false);
  await render('智能'); await advance();
  expect(latest.forumSearchError).toBe(false);
  expect(latest.forumMatches).toEqual([hit]);
});
