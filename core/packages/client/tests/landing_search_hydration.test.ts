// @vitest-environment jsdom

import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers';
import type { AssistantAnswer, AssistantQueueSnapshot } from '@cuberoot/shared/site-assistant';
import { act, createElement, StrictMode, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReconHit } from '@/lib/site-search';

const searchState = vi.hoisted(() => ({ recons: [] as ReconHit[] }));

const authState = vi.hoisted(() => ({ user: { uid: 66, wcaId: '2017YANR02' } as { uid: number; wcaId: string } | null, login: vi.fn() }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => authState.user, getAuthUser: () => authState.user, authActions: { login: authState.login }, useAuthStore: { getState: () => authState } }));
vi.mock('@/lib/admin-api', async original => ({ ...await original<object>(), authHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer session-test' }) }));

const routeState = vi.hoisted(() => ({ lang: 'zh' as 'zh' | 'en' }));
const speechState = vi.hoisted(() => ({ supported: false, listening: false, status: 'idle', error: null as string | null, microphone: null as string | null, start: vi.fn(), stop: vi.fn() }));

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/link', () => ({
  useLinkStatus: () => ({ pending: false }),
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
// Provider discovery has its own hook tests; these transport fixtures describe
// chat replies and must not be consumed by the independent metadata request.
vi.mock('@/hooks/useAssistantProvider', () => ({
  useAssistantProvider: () => ({ provider: 'bailian', setProvider: vi.fn(), openaiAvailable: false }),
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
    reconMatches: searchState.recons,
    glossaryMatches: [],
    aboutMatches: [],
    stackMatches: [],
    algSetMatches: [],
    platformMatches: [],
    platformSearchError: false,
    forumMatches: query === '蓝牙' ? [{ id: 8, title: '智能魔方开发接入指南', snippet: '正文中的低功耗蓝牙介绍' }] : [],
    forumTotal: query === '蓝牙' ? 15 : 0,
    forumSearchPending: false,
    forumSearchError: false,
    translationMatches: [],
    translationSearchPending: false,
    translationSearchError: false,
    translationStale: false,
    totalCount: (query === '蓝牙' ? 15 : query.trim() ? options.cards.length : 0) + searchState.recons.length,
    yearMatch: null,
  }),
}));

import LandingSearch from '@/components/LandingSearch';
import AssistantConversationView from '@/components/AssistantConversationView';
import { useAssistantWorkspace } from '@/hooks/useAssistantWorkspace';
import { assistantConversations, assistantOwner } from '@/lib/assistant-conversations';
import { changeAppLanguage } from '@/i18n/i18n-client';

describe('LandingSearch placeholder hydration', () => {
  beforeEach(() => {
    authState.login.mockClear();
    searchState.recons = [];
    localStorage.clear();
    routeState.lang = 'zh';
    authState.user = { uid: 66, wcaId: '2017YANR02' };
    speechState.error = null;
    speechState.listening = false;
    speechState.microphone = null;
    changeAppLanguage('zh');
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    let serial=0;
    // Keep the browser's async digest contract without racing Node's worker pool
    // against fake timers on a loaded CI runner.
    vi.stubGlobal('crypto', { subtle: { digest: async (_algorithm: string, data: Uint8Array) => Uint8Array.from(createHash('sha256').update(data).digest()).buffer }, randomUUID: () => `00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}` });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ['zh', '广州公开赛2026', '2026-10-05', '广州公开赛'],
    ['en', 'Guangzhou Grand Open 2026', '2026-10-05', 'Guangzhou Grand Open'],
    ['zh', '广州公开赛2026', undefined, '广州公开赛2026'],
    ['zh', '广州公开赛2026', '2025-10-05', '广州公开赛2026'],
  ] as const)('formats recon competition %s / %s beside date %s', (lang, comp, date, expected) => {
    routeState.lang = lang;
    const hit: ReconHit = { id: 42, person: '耿暄一', personIso2: 'cn', valueStr: '2.51', event: '333', compWcaId: 'GuangzhouGrandOpen2026', comp, date };
    searchState.recons = [hit];
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(LandingSearch, { cards: [], lang, query: '耿暄一', persistentResults: true }));
    const meta = host.querySelector('.landing-search-item-meta')!;
    expect(meta.textContent).toBe(expected + (date ? ` · ${date}` : ''));
    expect(meta.querySelector('.landing-search-date')?.textContent ?? null).toBe(date ? ` · ${date}` : null);
    expect(hit.comp).toBe(comp);
  });

  it.each(['zh', 'en'] as const)('submits the visible home suggestion with Enter or the send button (%s)', async lang => {
    routeState.lang = lang;
    const owner = assistantOwner(authState.user);
    const submit = vi.spyOn(assistantConversations, 'submit').mockReturnValue(true);
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    try {
      await act(async () => root.render(createElement(LandingSearch, { cards: [], lang, workspaceEntry: true })));
      const input = host.querySelector<HTMLInputElement>('input.landing-search-field')!;
      expect(input.value).toBe('');
      expect(input.placeholder).not.toBe('');
      await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })));
      expect(submit).not.toHaveBeenCalled();
      await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
      expect(submit).toHaveBeenLastCalledWith(owner, expect.any(String), input.placeholder, []);
      const button = host.querySelector<HTMLButtonElement>('.landing-search-send')!;
      expect(button.disabled).toBe(false);
      await act(async () => button.click());
      expect(submit).toHaveBeenCalledTimes(2);
      expect(submit).toHaveBeenLastCalledWith(owner, expect.any(String), input.placeholder, []);
    } finally {
      await act(async () => root.unmount()); host.remove();
    }
  });

  // Exercise the actual queue HTTP client. Only the server is simulated; POST
  // receipts and GET snapshots are separate, as they are in production.
  function queueServer(answer?: AssistantAnswer) {
    let snapshot: AssistantQueueSnapshot = { conversationId: '', revision: 0, paused: false, recovering: false, messages: [] };
    let disconnected = false;
    let rejection: {error: string; status: number} | undefined;
    const posts: Array<{url:string; init:RequestInit; body: {id:string; mode:'steer'|'queue'; input: import('@cuberoot/shared/site-assistant').AssistantDurableInput}}> = [];
    const fetcher=vi.fn(async (input: RequestInfo|URL, init: RequestInit = {}) => {
      const url=String(input), match=/\/conversations\/([^/?]+)(?:\/(messages|stop|resume))?/.exec(url);
      if(url.endsWith('/events')) return Response.json({ok:true});
      if(url.endsWith('/attachments')) return Response.json({mediaType:'image/png',data:'dGVzdA==',attachmentId:'11111111-1111-4111-8111-111111111111'});
      if(!match) throw new Error(`Unexpected fixture request: ${url}`);
      snapshot.conversationId=match[1];
      if(match[2]==='messages') {
        const body=JSON.parse(String(init.body)); posts.push({url,init,body});
        if(rejection)return Response.json({error:rejection.error},{status:rejection.status});
        const targetId=snapshot.activeId;
        snapshot.messages.push({id:body.id,sequence:posts.length,mode:body.mode,input:body.input,
          state:targetId?'applied':answer?'completed':'running',...(targetId?{targetId}:{}),
          answer:targetId?undefined:answer,progress:[],attempts:1,createdAt:Date.now(),updatedAt:Date.now(),requestId:body.id});
        if(!targetId && !answer)snapshot.activeId=body.id;
        snapshot.revision++;
        return Response.json({id:body.id},{status:202});
      }
      if(match[2]==='stop') {snapshot.paused=true;snapshot.messages.forEach(message=>{if(message.state==='running')message.state='stopped';});snapshot.activeId=undefined;snapshot.revision++;}
      if(match[2]==='resume') {snapshot.paused=false;const message=snapshot.messages.find(message=>message.state==='stopped');if(message){message.state='running';snapshot.activeId=message.id;}snapshot.revision++;}
      if(disconnected && !match[2])throw new TypeError('offline');
      return Response.json(snapshot);
    });
    vi.stubGlobal('fetch',fetcher);
    return {fetcher,posts,get snapshot(){return snapshot;},set disconnected(value:boolean){disconnected=value;},reject(error:string,status:number){rejection={error,status};},
      async update(change:(snapshot:AssistantQueueSnapshot)=>void){change(snapshot);snapshot.revision++;await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});}};
  }
  // Drain the async receipt/snapshot microtasks without advancing UI timers.
  async function settle() { await act(async()=>{await new Promise<void>(resolve=>setImmediate(resolve));}); }
  async function mountChat(query='怎么数帧') {
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
    await act(async()=>root.render(createElement(LandingSearch,{cards:[],lang:'zh',query,persistentResults:true})));
    return {host,root,async submit(){await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="提问"]')!.click());await settle();},async close(){await act(async()=>root.unmount());host.remove();}};
  }
  async function click(selector:string) {await act(async()=>document.querySelector<HTMLButtonElement>(selector)!.click());await settle();}
  async function type(selector:string,text:string) {await act(async()=>{const element=document.querySelector<HTMLInputElement|HTMLTextAreaElement>(selector)!;const prototype=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(element,text);element.dispatchEvent(new Event('input',{bubbles:true}));});}

  it('only submits once after IME composition and renders the durable answer with a real source link',async()=>{
    const server=queueServer({answer:'打开数帧页面。',sources:[{id:'frame-count',title:'数帧',href:'/frame-count',read:true}]});
    const chat=await mountChat('视频怎么数帧');
    try {
      expect(server.posts).toHaveLength(0);
      await act(async()=>chat.host.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true})));
      expect(server.posts).toHaveLength(0);
      await act(async()=>chat.host.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));await settle();
      expect(server.posts).toHaveLength(1);
      expect(server.posts[0].init.headers).toMatchObject({Authorization:'Bearer session-test'});
      expect(server.posts[0].body).toMatchObject({mode:'steer',input:{question:'视频怎么数帧',lang:'zh',provider:'bailian',thinking:'auto',history:[]}});
      await act(async()=>{await import('react-markdown');});
      expect(document.querySelector('.site-assistant-prose')?.textContent).toBe('打开数帧页面。数帧');
      expect(document.querySelector('.site-assistant-citation')?.getAttribute('href')).toBe('/zh/frame-count');
    } finally {await chat.close();}
  });

  it('shares drafts and saved images, consumes a homepage submission once in StrictMode, and retains its background reply',async()=>{
    vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
    authState.user={uid:777,wcaId:'2017YANR02'};const owner=assistantOwner(authState.user);const server=queueServer();
    function Surface(){const state=useAssistantWorkspace(owner);return createElement('div',null,createElement(LandingSearch,{cards:[],lang:'zh',workspaceEntry:true}),state.opened&&state.conversations.map(chat=>createElement(AssistantConversationView,{key:chat.id,owner,conversation:chat,active:state.open&&state.activeId===chat.id,cards:[],lang:'zh'})));}
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);let changes=0;
    const unsubscribe=assistantConversations.subscribe(()=>{if(++changes>100)throw Error('workspace notification loop');});
    try {
      await act(async()=>root.render(createElement(StrictMode,null,createElement(Surface))));
      await type('input[aria-label="全站搜索"]','WIC');await click('button[aria-label="添加"]');await click('button[aria-label="图片提问"]');
      const chatId=assistantConversations.read(owner).activeId;
      expect(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="继续提问"]')?.value).toBe('WIC');
      await type('textarea[aria-label="继续提问"]','解释 WIC');
      await act(async()=>{assistantConversations.patch(owner,chatId,{images:[{mediaType:'image/png',data:'dGVzdA=='}]});assistantConversations.setOpen(owner,false);});
      expect(host.querySelector<HTMLInputElement>('input[aria-label="全站搜索"]')?.value).toBe('解释 WIC');
      await click('button[aria-label="提问"]');
      expect(server.posts).toHaveLength(1);expect(server.posts[0].body.input).toMatchObject({question:'解释 WIC',images:[{attachmentId:'11111111-1111-4111-8111-111111111111'}]});
      await type('textarea[aria-label="继续提问"]','下一问');
      await act(async()=>{assistantConversations.setOpen(owner,false);assistantConversations.create(owner,'other-chat');assistantConversations.setOpen(owner,true);});
      await server.update(snapshot=>{snapshot.activeId=undefined;Object.assign(snapshot.messages[0],{state:'completed',answer:{answer:'廉政委员会',sources:[]}});});
      await act(async()=>{await import('react-markdown');});
      const original=()=>assistantConversations.read(owner).conversations.find(chat=>chat.id===chatId)!;
      for(let i=0;i<40&&!original().unreadReply;i++)await act(async()=>{await vi.advanceTimersByTimeAsync(25);});
      expect(original().snapshot.draft).toBe('下一问');expect(original().snapshot.turns[0].result?.answer).toBe('廉政委员会');
      expect(original().unreadReply).toBe(true);expect(assistantConversations.read(owner).activeId).toBe('other-chat');expect(server.posts).toHaveLength(1);
      await act(async()=>assistantConversations.select(owner,chatId));expect(original().unreadReply).toBe(false);
    }finally{unsubscribe();await act(async()=>root.unmount());host.remove();}
  });

  it('renders live progress and partial citations, accepts consecutive updates, and stops and resumes the same task',async()=>{
    const server=queueServer();const chat=await mountChat();
    try {
      await chat.submit();
      await server.update(snapshot=>{snapshot.messages[0].progress=[{id:1,phase:'tool',state:'complete',tool:'pages',elapsedMs:12}];snapshot.messages[0].answer={answer:'第一句。 [[page]] [[unsafe]]',sources:[{id:'page',title:'数帧',href:'/frame-count',read:true},{id:'unsafe',title:'unsafe',href:'//evil.test',read:true}]};});
      expect(document.querySelector('.site-assistant-prose')?.textContent).toContain('第一句。');expect(document.querySelectorAll('.site-assistant-prose a')).toHaveLength(1);
      for(const question of ['只讲操作','最后用两行']) {await type('textarea[aria-label="继续提问"]',question);await act(async()=>document.querySelector('.site-assistant-compose')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await settle();}
      expect(server.posts.map(post=>post.body.input.question)).toEqual(['怎么数帧','只讲操作','最后用两行']);
      expect(server.snapshot.messages.slice(1).every(message=>message.targetId===server.posts[0].body.id)).toBe(true);
      await click('button[aria-label="停止"]');expect(server.snapshot.paused).toBe(true);expect(document.body.textContent).toContain('回答未完成');
      await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button=>button.textContent==='恢复执行')!.click());await settle();expect(server.snapshot.paused).toBe(false);expect(server.posts).toHaveLength(3);
      await server.update(snapshot=>{snapshot.activeId=undefined;Object.assign(snapshot.messages[0],{state:'completed',answer:{answer:'第一行\n第二行',sources:[]},updatedAt:Date.now()});});
      expect(document.querySelector('.site-assistant-prose')?.textContent).toContain('第一行');
    }finally{await chat.close();}
  });

  it('keeps partial output through a polling outage and recovers without resubmitting',async()=>{
    const server=queueServer();const chat=await mountChat();
    try {await chat.submit();await server.update(snapshot=>{snapshot.messages[0].answer={answer:'已收到的内容',sources:[]};});
      server.disconnected=true;await server.update(()=>{});expect(document.querySelector('.site-assistant-prose')?.textContent).toBe('已收到的内容');
      expect(server.snapshot.messages[0].state).toBe('running');server.disconnected=false;
      await server.update(snapshot=>{snapshot.activeId=undefined;Object.assign(snapshot.messages[0],{state:'completed',answer:{answer:'恢复后的完整回答',sources:[]},updatedAt:Date.now()});});
      expect(document.querySelector('.site-assistant-prose')?.textContent).toBe('恢复后的完整回答');expect(server.posts).toHaveLength(1);
    }finally{await chat.close();}
  });

  it('consumes an already queued homepage submission once on a cold StrictMode mount',async()=>{
    authState.user={uid:778,wcaId:'2017YANR02'};const owner=assistantOwner(authState.user);
    assistantConversations.create(owner,'cold-chat');assistantConversations.submit(owner,'cold-chat','首次提问',[]);
    const server=queueServer({answer:'已收到',sources:[]});
    function Workspace(){const state=useAssistantWorkspace(owner);return createElement(AssistantConversationView,{owner,conversation:state.conversations[0],active:true,lang:'zh',cards:[]});}
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
    try{await act(async()=>root.render(createElement(StrictMode,null,createElement(Workspace))));await settle();
      expect(server.posts).toHaveLength(1);expect(server.posts[0].init.signal?.aborted).toBe(false);
      expect(assistantConversations.read(owner).conversations[0].snapshot.turns[0].result?.answer).toBe('已收到');
    }finally{await act(async()=>root.unmount());host.remove();}
  });

  it('retains an earlier card selection while subsequent queue snapshots arrive',async()=>{
    const original="R U R'",selected="R U2 R'",sticker={kind:'raw' as const,tag:'',attrs:{}};
    const server=queueServer({answer:'T 公式',sources:[],artifacts:[{kind:'algorithms',version:1,title:'PLL',puzzle:'3x3',set:'pll',display:'text',offset:0,total:1,cards:[{caseId:1,name:'T',puzzle:'3x3',set:'pll',href:'/alg/3x3/pll#T',alg:original,sticker,alternative:0,alternativeCount:2}]}]});
    vi.stubGlobal('fetch',(input:RequestInfo|URL,init?:RequestInit)=>String(input).includes('/alg/sets/')?Promise.resolve(Response.json({puzzle:'3x3',set:'pll',cases:[{id:1,name:'T',sticker,algs:[[{alg:original},{alg:selected}]]}]})):server.fetcher(input,init));
    const chat=await mountChat('展示 T 公式');
    try{await chat.submit();await click('button[aria-label="更换 T 公式"]');expect(document.querySelector('.assistant-algorithms')?.textContent).toContain(selected);
      await type('textarea[aria-label="继续提问"]','继续讲解');await act(async()=>document.querySelector('.site-assistant-compose')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await settle();
      expect(server.posts).toHaveLength(2);expect(document.querySelector('.assistant-algorithms')?.textContent).toContain(selected);
      expect(document.querySelector('.assistant-algorithms')?.textContent).toContain('公式 2/2');
    }finally{await chat.close();}
  });

  it('preserves thinking choice and validated external sources',async()=>{
    localStorage.setItem('cuberoot.assistant.thinking','deep');const server=queueServer({answer:'查到的资料。 [[external]]',sources:[{id:'external',title:'来源',href:'https://docs.example.org/reference',read:true}]});const chat=await mountChat('a'.repeat(1200));
    try{await chat.submit();expect(server.posts[0].body.input).toMatchObject({thinking:'deep',question:'a'.repeat(1200)});expect(document.querySelector('a[href="https://docs.example.org/reference"]')).not.toBeNull();
      await click('button[aria-label="思考模式"]');await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(option=>option.textContent==='快速回答')!.click());expect(localStorage.getItem('cuberoot.assistant.thinking')).toBe('fast');
    }finally{await chat.close();}
  });

  it('keeps a composer draft, safe rich text and copied table data when closing and reopening',async()=>{
    queueServer({answer:'## 练习\n\n- **逐帧**查看 [[page]]\n- 慢放\n\n[不可信](https://evil.test) <script>bad()</script>',sources:[{id:'page',title:'数帧',href:'/frame-count',read:true}],artifacts:[{kind:'table',title:'数据',columns:['项目','成绩'],rows:[['三阶','5.00']]}]});
    const writeText=vi.fn().mockResolvedValue(undefined);vi.stubGlobal('navigator',{...navigator,clipboard:{writeText}});const chat=await mountChat();
    try{await chat.submit();expect(document.querySelector('.site-assistant-prose h2')?.textContent).toBe('练习');expect(document.querySelectorAll('.site-assistant-prose li')).toHaveLength(2);expect(document.querySelectorAll('.site-assistant-prose a')).toHaveLength(1);expect(document.querySelector('.site-assistant-prose script')).toBeNull();
      await click('button[aria-label="复制"]');expect(writeText.mock.calls[0][0]).toContain('项目\t成绩\n三阶\t5.00');
      await type('textarea[aria-label="继续提问"]','尚未发送');await click('button[aria-label="关闭"]');await chat.submit();expect(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="继续提问"]')?.value).toBe('尚未发送');
      await click('button[title="全屏"]');expect(document.querySelector('.site-assistant-dialog')?.classList.contains('is-expanded')).toBe(true);
      await click('button[title="新对话"]');expect(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="继续提问"]')?.value).toBe('');
    }finally{await chat.close();}
  });

  it('keeps anonymous questions out of the API',async()=>{
    authState.user=null;const server=queueServer();const chat=await mountChat('世界纪录');
    try {
      const send = chat.host.querySelector<HTMLButtonElement>('button[aria-label="登录并发送"]');
      expect(send).not.toBeNull();
      await act(async () => send!.click());
      await settle();
      expect(authState.login).toHaveBeenCalledOnce();
      expect(server.fetcher).not.toHaveBeenCalled();
      expect(chat.host.querySelector('input')?.value).toBe('世界纪录');
      const { assistantAuthContinuation } = await import('@/lib/assistant-auth-continuation');
      expect(assistantAuthContinuation.read()).toMatchObject({ text: '世界纪录', uid: null, send: true, phase: 'auth' });
      assistantAuthContinuation.clear();
    } finally { await chat.close(); }
  });
  it.each([['daily_limit',429,'全站今日 1000 次提问额度已用完'],['model_unavailable',503,'暂时无法回答']] as const)('preserves the search query on %s rejection',async(error,status,text)=>{
    const server=queueServer();server.reject(error,status);const chat=await mountChat('世界纪录');
    try{await chat.submit();expect(document.body.textContent).toContain(text);expect(chat.host.querySelector('input')?.value).toBe('世界纪录');expect(server.posts).toHaveLength(1);}finally{await chat.close();}
  });

  it('hydrates when iOS Chromium adds its autofill node ID before React starts', async () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(LandingSearch, { cards: [], lang: 'zh' }));
    document.body.appendChild(host);
    const input = host.querySelector<HTMLInputElement>('.landing-search-field')!;
    input.setAttribute('__gcruniqueid', '1');
    const errors: unknown[][] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { errors.push(args); });
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(host, createElement(LandingSearch, { cards: [], lang: 'zh' }));
      });
      expect(errors.filter(entry => String(entry[0]).toLowerCase().includes('hydrat'))).toEqual([]);
      expect(host.querySelector('.landing-search-field')).toBe(input);
      expect(input.getAttribute('__gcruniqueid')).toBe('1');
    } finally {
      await act(async () => root?.unmount());
      errorSpy.mockRestore();
      host.remove();
    }
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

  it.each(['zh', 'en'] as const)('renders forum body hits and all-results links in %s', lang => {
    routeState.lang = lang;
    changeAppLanguage(lang);
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(LandingSearch, {
      cards: [], lang, query: '蓝牙', persistentResults: true,
    }));
    const prefix = lang === 'zh' ? '/zh' : '';
    expect(host.querySelector('.landing-search-item')?.getAttribute('href')).toBe(`${prefix}/forum/t/8`);
    expect(host.textContent).toContain('正文中的低功耗蓝牙介绍');
    expect(host.textContent).not.toContain('未找到匹配项');
    expect(host.querySelector('.landing-search-header-more')?.getAttribute('href'))
      .toBe(`${prefix}/forum/search?q=${encodeURIComponent('蓝牙')}`);
    expect(host.querySelector('.landing-search-header-more')?.textContent).toBe('+14');
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
