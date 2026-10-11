// @vitest-environment jsdom

import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({ user: { uid: 66, wcaId: '2017YANR02' } as { uid: number; wcaId: string } | null, login: vi.fn() }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => authState.user, useAuthStore: { getState: () => authState } }));
vi.mock('@/lib/admin-api', () => ({ authHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer session-test' }) }));

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
    platformMatches: [],
    platformSearchError: false,
    totalCount: query.trim() ? options.cards.length : 0,
    yearMatch: null,
  }),
}));

import LandingSearch from '@/components/LandingSearch';
import { changeAppLanguage } from '@/i18n/i18n-client';

describe('LandingSearch placeholder hydration', () => {
  beforeEach(() => {
    routeState.lang = 'zh';
    authState.user = { uid: 66, wcaId: '2017YANR02' };
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
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer session-test');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ question: '视频怎么数帧', lang: 'zh', timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone, history: [] });
    // The dialog and its controls render immediately; formatting arrives in its own chunk.
    await act(async () => { await import('react-markdown'); });
    expect(document.querySelector('.site-assistant-prose')?.textContent).toBe('打开数帧页面。数帧');
    expect(host.textContent).not.toContain('未找到匹配项');
    expect(document.querySelector('.site-assistant-prose a.site-assistant-citation')?.getAttribute('href')).toBe('/zh/frame-count');
    await act(async () => root.unmount());
    host.remove();
  });

  it('shows live stages and inline citations before completion, then retains stopped text', async () => {
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    const fetcher=vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({start(c){stream=c;}}), {headers:{'Content-Type':'text/event-stream'}}));
    vi.stubGlobal('fetch',fetcher);
    const host=document.createElement('div'); document.body.appendChild(host);
    const root=createRoot(host);
    const emit=async (event:unknown)=>{await act(async()=>{stream.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));});};
    try {
      await act(async()=>{root.render(createElement(LandingSearch,{cards:[],lang:'zh',query:'怎么数帧',persistentResults:true}));});
      await act(async()=>{host.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});
      expect(fetcher.mock.calls[0][1].headers.Accept).toBe('text/event-stream');
      await emit({type:'status',status:{phase:'querying',tool:'pages'}});
      expect(document.querySelector('.site-assistant-status')?.textContent).toContain('正在查询站内页面');
      const sources=[{id:'page:/frame-count',href:'/frame-count',title:'数帧',read:true},{id:'unsafe',href:'//evil.test',title:'unsafe',read:true}];
      await emit({type:'answer',answer:'第一句。 [[page:/frame-',sources});
      expect(document.querySelector('.site-assistant-prose')?.textContent).toBe('第一句。');
      await emit({type:'answer',answer:'第一句。 [[page:/frame-count]] 第二句。 [[unsafe]] [[unknown]]',sources});
      const prose=document.querySelector('.site-assistant-prose')!;
      expect(prose.textContent).toBe('第一句。 数帧 第二句。');
      expect(prose.querySelectorAll('a')).toHaveLength(1);
      expect(prose.querySelector('a')?.getAttribute('href')).toBe('/zh/frame-count');
      expect(document.querySelector('.site-assistant-sources')).toBeNull();
      await act(async()=>{(document.querySelector('button[title="停止"]') as HTMLButtonElement).click();});
      expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
      expect(document.querySelector('.site-assistant-incomplete')?.textContent).toBe('回答未完成');
      expect(document.querySelector('.site-assistant-status')).toBeNull();
      await emit({type:'done',result:{answer:'late replacement',sources:[]}});
      expect(prose.textContent).not.toContain('late replacement');
    } finally { await act(async()=>root.unmount()); host.remove(); }
  });

  it('reports a dropped stream and keeps the partial answer visibly incomplete', async () => {
    const payload='data: '+JSON.stringify({type:'answer',answer:'已收到的内容',sources:[]})+'\n\n';
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(payload,{headers:{'Content-Type':'text/event-stream'}})));
    const host=document.createElement('div'); document.body.appendChild(host); const root=createRoot(host);
    try {
      await act(async()=>{root.render(createElement(LandingSearch,{cards:[],lang:'zh',query:'怎么数帧',persistentResults:true}));});
      await act(async()=>{host.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});
      expect(document.querySelector('.site-assistant-prose')?.textContent).toBe('已收到的内容');
      expect(document.querySelector('[role="alert"]')?.textContent).toContain('连接中断');
      expect(document.querySelector('.site-assistant-incomplete')?.textContent).toBe('回答未完成');
    } finally {await act(async()=>root.unmount());host.remove();}
  });

  it('regenerates and edits the latest question without feeding its old answer into history', async () => {
    const fetcher=vi.fn().mockImplementation(async()=>Response.json({answer:'回答',sources:[]}));vi.stubGlobal('fetch',fetcher);
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
    const click=async(selector:string)=>{await act(async()=>{(document.querySelector(selector) as HTMLButtonElement).click();});};
    try {
      await act(async()=>root.render(createElement(LandingSearch,{cards:[],lang:'zh',query:'第一问',persistentResults:true})));
      await click('button[aria-label="提问"]');
      await click('button[title="重新生成"]');
      expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({question:'第一问',lang:'zh',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,history:[]});
      expect(document.querySelectorAll('.site-assistant-turn')).toHaveLength(1);
      await click('button[title="编辑问题"]');
      const textarea=document.querySelector('textarea[aria-label="编辑问题"]') as HTMLTextAreaElement;
      await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'改过的问题');textarea.dispatchEvent(new Event('input',{bubbles:true}));});
      await act(async()=>{document.querySelector('.site-assistant-edit')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
      expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({question:'改过的问题',lang:'zh',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,history:[]});
      expect(document.querySelector('.site-assistant-question h3')?.textContent).toBe('改过的问题');
      expect(document.querySelectorAll('.site-assistant-turn')).toHaveLength(1);
    } finally {await act(async()=>root.unmount());host.remove();}
  });

  it('keeps a composer draft on close, renders safe rich text and copies the answer with data', async () => {
    const answer={answer:'## 练习\n\n- **逐帧**查看 [[page]]\n- 慢放\n\n[不可信](https://evil.test) <script>bad()</script>',sources:[{id:'page',title:'数帧',href:'/frame-count',read:true}],artifacts:[{kind:'table',title:'数据',columns:['项目','成绩'],rows:[['三阶','5.00']]}]};
    vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>Response.json(answer)));
    const writeText=vi.fn().mockResolvedValue(undefined);vi.stubGlobal('navigator',{...navigator,clipboard:{writeText}});
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
    const click=async(selector:string)=>{await act(async()=>{(document.querySelector(selector) as HTMLButtonElement).click();});};
    try {
      await act(async()=>root.render(createElement(LandingSearch,{cards:[],lang:'zh',query:'数帧',persistentResults:true})));
      await click('button[aria-label="提问"]');
      expect(document.querySelector('.site-assistant-prose h2')?.textContent).toBe('练习');
      expect(document.querySelectorAll('.site-assistant-prose li')).toHaveLength(2);
      expect(document.querySelectorAll('.site-assistant-prose a')).toHaveLength(1);
      expect(document.querySelector('.site-assistant-prose script')).toBeNull();
      await click('button[title="复制回答"]');
      expect(writeText.mock.calls[0][0]).toContain('项目\t成绩\n三阶\t5.00');
      expect(writeText.mock.calls[0][0]).toContain('[数帧](');
      const textarea=document.querySelector('textarea[aria-label="继续提问"]') as HTMLTextAreaElement;
      await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'尚未发送');textarea.dispatchEvent(new Event('input',{bubbles:true}));});
      await click('button[title="关闭"]');
      expect(document.querySelector('.landing-search-answer-text')?.textContent).not.toContain('[[page]]');
      await click('button[aria-label="提问"]');
      expect((document.querySelector('textarea[aria-label="继续提问"]') as HTMLTextAreaElement).value).toBe('尚未发送');
      await click('button[title="全屏"]');
      expect(document.querySelector('.site-assistant-dialog')?.classList.contains('is-expanded')).toBe(true);
      const messages=document.querySelector('.site-assistant-messages')!;
      Object.defineProperties(messages,{scrollHeight:{value:2000,configurable:true},clientHeight:{value:500,configurable:true},scrollTop:{value:0,writable:true,configurable:true}});
      await act(async()=>messages.dispatchEvent(new Event('scroll',{bubbles:true})));
      await click('button[title="回到最新消息"]');
      expect(messages.scrollTop).toBe(2000);
      await click('button[title="新对话"]');
      expect((document.querySelector('textarea[aria-label="继续提问"]') as HTMLTextAreaElement).value).toBe('');
    } finally {await act(async()=>root.unmount());host.remove();}
  });

  it('keeps anonymous questions out of the paid API', async () => {
    authState.user = null;
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    try {
      await act(async () => { root.render(createElement(LandingSearch, { cards: [], lang: 'zh', query: '世界纪录', persistentResults: true })); });
      await act(async () => { host.querySelector('button[aria-label="提问"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      expect(fetcher).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain('请先登录并绑定 WCA 账号');
      expect(host.querySelector('input')?.value).toBe('世界纪录');
    } finally { await act(async () => root.unmount()); host.remove(); }
  });

  it('cancels stale questions when the user edits and keeps regular search on provider failure', async () => {
    let resolve!: (value: unknown) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; }))
      .mockResolvedValueOnce(Response.json({ error: 'model_unavailable' }, { status: 503 }));
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
    expect(document.body.textContent).toContain('暂时无法回答');
    expect(host.querySelector('input')?.value).toBe('新问题');
    await act(async () => root.unmount());
    host.remove();
  });

  it('explains the site-wide daily quota without clearing the search query', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'daily_limit' }, { status: 429 })));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(createElement(LandingSearch, { cards: [], lang: 'zh', query: '世界纪录', persistentResults: true })); });
    await act(async () => { host.querySelector('button[aria-label="提问"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(document.body.textContent).toContain('全站今日 1000 次提问额度已用完');
    expect(document.body.textContent).toContain('北京时间零点恢复');
    expect(host.querySelector('input')?.value).toBe('世界纪录');
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
