// @vitest-environment jsdom

import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routeState = vi.hoisted(() => ({ lang: 'zh' as 'zh' | 'en' }));
const speechState = vi.hoisted(() => ({ supported: false, listening: false, status: 'idle', error: null as string | null, microphone: null as string | null, start: vi.fn(), stop: vi.fn() }));

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/link', () => ({
  default: ({ children, prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode; prefetch?: boolean }) => (
    createElement('a', props, children)
  ),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: routeState.lang }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/useSpeechToText', () => ({
  useSpeechToText: () => speechState,
}));
vi.mock('@/lib/site-search', () => ({
  INITIAL_RENDER_CAP: 10,
  METRIC_LABEL_OVERRIDE: {},
  useSiteSearch: (query: string, _mode: string, options: { cards: Array<{ id: string }> }) => ({
    q: query.trim().toLowerCase(),
    xSearchEnabled: false,
    xLoaded: true,
    cardMatches: query.trim() ? options.cards : [],
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
    totalCount: query.trim() ? options.cards.length : 0,
    yearMatch: null,
  }),
}));

import LandingSearch from '@/components/LandingSearch';
import { changeAppLanguage } from '@/i18n/i18n-client';

describe('LandingSearch placeholder hydration', () => {
  beforeEach(() => {
    routeState.lang = 'zh';
    speechState.error = null;
    speechState.listening = false;
    speechState.microphone = null;
    changeAppLanguage('zh');
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('only asks on submission, ignores IME Enter and renders a real source link', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ answer: '打开数帧页面。', sources: [{ id: 'frame-count', title: '数帧', href: '/frame-count', read: true }] }) });
    vi.stubGlobal('fetch', fetcher);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(createElement(LandingSearch, { cards: [], lang: 'zh', query: '视频怎么数帧', persistentResults: true })); });
    const input = host.querySelector('input')!;
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })); });
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ question: '视频怎么数帧', lang: 'zh' });
    expect(host.querySelector('.landing-search-answer-text')?.textContent).toBe('打开数帧页面。');
    expect(host.textContent).not.toContain('未找到匹配项');
    expect(host.querySelector('.landing-search-answer a')?.getAttribute('href')).toBe('/zh/frame-count');
    await act(async () => root.unmount());
    host.remove();
  });

  it('cancels stale questions when the user edits and keeps regular search on provider failure', async () => {
    let resolve!: (value: unknown) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; }))
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal('fetch', fetcher);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const props = { cards: [], lang: 'zh' as const, persistentResults: true };
    await act(async () => { root.render(createElement(LandingSearch, { ...props, query: '旧问题' })); });
    await act(async () => { host.querySelector('button[aria-label="提问"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const signal = fetcher.mock.calls[0][1].signal;
    await act(async () => { root.render(createElement(LandingSearch, { ...props, query: '新问题' })); });
    expect(signal.aborted).toBe(true);
    await act(async () => { resolve({ ok: true, json: async () => ({ answer: '过期回答', sources: [] }) }); });
    expect(host.textContent).not.toContain('过期回答');
    await act(async () => { host.querySelector('button[aria-label="提问"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(host.textContent).toContain('暂时无法回答');
    expect(host.querySelector('input')?.value).toBe('新问题');
    await act(async () => root.unmount());
    host.remove();
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

  it.each([
    ['zh', '/zh/courses'],
    ['en', '/courses'],
  ] as const)('独立搜索页使用 %s 受控查询,并生成正确的真链接', (lang, expectedHref) => {
    routeState.lang = lang;
    changeAppLanguage(lang);
    const html = renderToStaticMarkup(createElement(LandingSearch, {
      cards: [{
        id: 'courses',
        href: '/courses',
        internal: true,
        nameZh: '课程',
        nameEn: 'Courses',
        sectionTitleZh: '学习',
        sectionTitleEn: 'Learn',
      }],
      lang,
      query: '课程',
      persistentResults: true,
    }));
    const host = document.createElement('div');
    host.innerHTML = html;

    expect(host.querySelector<HTMLInputElement>('.landing-search-field')?.value).toBe('课程');
    expect(host.querySelector<HTMLAnchorElement>('.landing-search-item')?.getAttribute('href'))
      .toBe(expectedHref);
    expect(host.querySelector('.landing-search--page')).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>('.landing-search-field')?.getAttribute('aria-label'))
      .toBe(lang === 'zh' ? '全站搜索' : 'Site search');
  });

  it('keeps the controlled URL query when a standalone-search result is opened', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onQueryChange = vi.fn();
    const root = createRoot(host);

    await act(async () => {
      root.render(createElement(LandingSearch, {
        cards: [{
          id: 'courses',
          href: '/courses',
          internal: true,
          nameZh: '课程',
          nameEn: 'Courses',
          sectionTitleZh: '学习',
          sectionTitleEn: 'Learn',
        }],
        lang: 'zh',
        query: '课程',
        onQueryChange,
        persistentResults: true,
      }));
    });

    await act(async () => {
      host.querySelector<HTMLAnchorElement>('.landing-search-item')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    });

    expect(onQueryChange).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLInputElement>('.landing-search-field')?.value).toBe('课程');
    await act(async () => root.unmount());
    host.remove();
  });

  it.each([
    ['zh', 'network', '无法连接语音识别服务'],
    ['en', 'network', 'Cannot connect to speech recognition'],
    ['zh', 'unsupported', '此浏览器不支持网页语音输入'],
    ['zh', 'timeout', '语音识别长时间没有返回结果'],
  ] as const)('shows %s speech failure %s without clearing the search', (lang, error, message) => {
    routeState.lang = lang;
    changeAppLanguage(lang);
    speechState.error = error;
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(LandingSearch, { cards: [], lang, query: 'PLL' }));
    expect(host.querySelector('[role="status"]')?.textContent).toContain(message);
    expect(host.querySelector<HTMLInputElement>('.landing-search-field')?.value).toBe('PLL');
    expect(host.querySelector('.landing-search-mic')).not.toBeNull();
  });

  it('shows the selected microphone during capture and on failure', () => {
    speechState.listening = true;
    speechState.microphone = 'Default - Wireless Mic Rx';
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(LandingSearch, { cards: [], lang: 'zh' }));
    expect(host.querySelector('[role="status"]')?.textContent).toBe('麦克风：Default - Wireless Mic Rx');
    speechState.listening = false;
    speechState.error = 'no-speech';
    host.innerHTML = renderToStaticMarkup(createElement(LandingSearch, { cards: [], lang: 'zh' }));
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Default - Wireless Mic Rx');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('检查麦克风是否静音');
  });
});
