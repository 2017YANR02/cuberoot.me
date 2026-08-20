// @vitest-environment jsdom

import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) => (
    createElement('a', props, children)
  ),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: 'zh' }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/useSpeechToText', () => ({
  useSpeechToText: () => ({ supported: false, listening: false, start: vi.fn(), stop: vi.fn() }),
}));
vi.mock('@/lib/site-search', () => ({
  INITIAL_RENDER_CAP: 10,
  METRIC_LABEL_OVERRIDE: {},
  useSiteSearch: () => ({
    q: '',
    xSearchEnabled: false,
    xLoaded: true,
    cardMatches: [],
    toolMatches: [],
    lookupMatches: [],
    statMatches: [],
    personMatches: [],
    compMatches: [],
    reconMatches: [],
    glossaryMatches: [],
    aboutMatches: [],
    stackMatches: [],
    algSetMatches: [],
    totalCount: 0,
    yearMatch: null,
  }),
}));

import LandingSearch from '@/components/LandingSearch';

describe('LandingSearch placeholder hydration', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('服务器与客户端跨 UTC 日期时首帧仍一致,挂载后再显示当天文案', async () => {
    vi.setSystemTime(new Date('2026-08-19T12:00:00Z'));
    const html = renderToStaticMarkup(createElement(LandingSearch, { cards: [], lang: 'zh' }));
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);

    vi.setSystemTime(new Date('2026-08-20T12:00:00Z'));
    const errors: unknown[][] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(host, createElement(LandingSearch, { cards: [], lang: 'zh' }));
    });
    errorSpy.mockRestore();

    expect(
      errors.filter((entry) => String(entry[0]).toLowerCase().includes('hydrat')),
    ).toEqual([]);
    expect(host.querySelector<HTMLInputElement>('.landing-search-field')?.placeholder)
      .toBe('想看哪一年的统计?');

    await act(async () => root?.unmount());
    host.remove();
  });
});
