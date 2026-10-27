// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes, type ReactNode, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SITE_ASSISTANT_QUESTION_MAX_LENGTH, type AssistantAnswer } from '@cuberoot/shared/site-assistant';

vi.mock('next/link',()=>({useLinkStatus:()=>({pending:false}),default:({children,prefetch:_prefetch,...props}:AnchorHTMLAttributes<HTMLAnchorElement> & {children?:ReactNode;prefetch?:boolean})=>createElement('a',props,children)}));
vi.mock('next/navigation',()=>({useParams:()=>({lang:'zh'})}));
vi.mock('@/hooks/useSpeechToText',()=>({useSpeechToText:()=>({listening:false,start:vi.fn(),stop:vi.fn()})}));
vi.mock('@/lib/site-assistant-request',()=>({sendAssistantEvent:vi.fn().mockResolvedValue({ok:true})}));
vi.mock('@/lib/site-assistant-images',()=>({prepareAssistantImage:vi.fn()}));
vi.mock('@/lib/country-flags',()=>({
  loadFlagData:vi.fn(async()=>1),compFlagIso2:(id:string)=>id==='WC2025'?'us':'tw',
  compNameZh:()=>null,compNameEnFromZh:()=>null,
}));
import SiteAssistantDialog from '@/components/SiteAssistantDialog';
import { loadFlagData } from '@/lib/country-flags';
import { changeAppLanguage } from '@/i18n/i18n-client';
import { sendAssistantEvent } from '@/lib/site-assistant-request';
import { prepareAssistantImage } from '@/lib/site-assistant-images';

const sources=[
  {id:'comp:WC2025',title:'World Championship',href:'/wca/comp/WC2025',read:true},
  {id:'comp:Taipei2026',title:'Taipei',href:'/wca/comp/Taipei2026',read:true},
];
const result:AssistantAnswer={answer:'日期见下表。',sources,actions:sources,
  artifacts:[{kind:'table',title:'比赛',columns:['比赛','城市','地区','日期'],
    columnKinds:['text','text','country','date'],links:sources.map(s=>s.href),
    rows:[['World Championship','Seattle','US','2025-07-03~06'],['Taipei','Taipei','TW','2026-01-01']]}],
};
const roots:Array<ReturnType<typeof createRoot>>=[];
afterEach(async()=>{await act(async()=>{roots.forEach(root=>root.unmount());});roots.length=0;document.body.innerHTML='';});
async function render(answer:AssistantAnswer,overrides:Partial<ComponentProps<typeof SiteAssistantDialog>>={}) {
  changeAppLanguage('zh');
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('div');document.body.append(host);
  const root=createRoot(host);roots.push(root);
  const props:ComponentProps<typeof SiteAssistantDialog>={
    turns:[{question:'历年世锦赛时间',result:answer}],busy:false,error:null,lang:'zh',draft:'',images:[],onImagesChange:vi.fn(),
    onDraftChange:vi.fn(),onFeedback:vi.fn(),onAsk:vi.fn(),onStop:vi.fn(),onClose:vi.fn(),onNew:vi.fn(),
    thinking:'auto',onThinkingChange:vi.fn(),
    ...overrides,
  };
  await act(async()=>root.render(createElement(SiteAssistantDialog,props)));
  return props;
}

describe('assistant general conversation controls',()=>{
  it('accepts longer writing prompts and shows an editable thinking choice',async()=>{
    const draft='内容'.repeat(1000);
    const props=await render({answer:'',sources:[]},{draft,turns:[]});
    expect(document.querySelector<HTMLTextAreaElement>('.site-assistant-compose textarea')?.maxLength).toBe(SITE_ASSISTANT_QUESTION_MAX_LENGTH);
    expect(document.querySelector('.site-assistant-input-count')).toBeNull();
    expect(document.body.textContent).toContain('写作与翻译');
    const choose=document.querySelector<HTMLButtonElement>('button[aria-label="思考模式"]')!;
    await act(async()=>choose.click());
    await act(async()=>{Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(option=>option.textContent==='深入思考')!.click();});
    expect(props.onThinkingChange).toHaveBeenCalledWith('deep');
    await act(async()=>document.querySelector<HTMLButtonElement>('.site-assistant-compose button[type="submit"]')!.click());
    expect(props.onAsk).toHaveBeenCalledWith(draft,false,[]);
  });
  it('only shows the length count near the limit and keeps the mode fixed during generation',async()=>{
    await render({answer:'',sources:[]},{draft:'x'.repeat(SITE_ASSISTANT_QUESTION_MAX_LENGTH),busy:true});
    expect(document.querySelector('.site-assistant-input-count')?.textContent).toBe(`${SITE_ASSISTANT_QUESTION_MAX_LENGTH}/${SITE_ASSISTANT_QUESTION_MAX_LENGTH}`);
    expect(document.querySelector<HTMLButtonElement>('button[aria-label="思考模式"]')?.disabled).toBe(true);
  });
});

describe('assistant image interactions',()=>{
  const image={mediaType:'image/png' as const,data:'fixture'};
  const empty={answer:'Screenshot',sources:[]};
  it('sends image-only messages and keeps original images for regeneration and edits',async()=>{
    const props=await render(empty,{images:[image],turns:[{question:'',images:[image],result:empty}]});
    await act(async()=>{document.querySelector<HTMLButtonElement>('.site-assistant-compose button[type="submit"]')!.click();});
    expect(props.onAsk).toHaveBeenCalledWith('',false,[image]);
    expect(props.onImagesChange).toHaveBeenCalledWith([]);
    await act(async()=>{document.querySelector<HTMLButtonElement>('button[aria-label="重试"]')!.click();});
    expect(props.onAsk).toHaveBeenCalledWith('',true,[image]);
    await act(async()=>{document.querySelector<HTMLButtonElement>('button[title="编辑问题"]')!.click();});
    expect(document.querySelector('.site-assistant-edit img')).not.toBeNull();
    await act(async()=>{document.querySelector<HTMLButtonElement>('.site-assistant-edit button[type="submit"]')!.click();});
    expect(props.onAsk).toHaveBeenLastCalledWith('',true,[image]);
  });
  it('accepts pasted and selected image files through the same preparation boundary',async()=>{
    vi.mocked(prepareAssistantImage).mockResolvedValue(image);
    const props=await render(empty);
    const file=new File(['test'],'test.png',{type:'image/png'});
    const paste=new Event('paste',{bubbles:true,cancelable:true});
    Object.defineProperty(paste,'clipboardData',{value:{files:[file]}});
    await act(async()=>{document.querySelector('.site-assistant-compose textarea')!.dispatchEvent(paste);});
    expect(paste.defaultPrevented).toBe(true);
    expect(props.onImagesChange).toHaveBeenCalledWith([image]);
    const input=document.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input,'files',{value:[file]});
    await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(prepareAssistantImage).toHaveBeenCalledWith(file);
  });
  it('discards a pending image conversion when a new conversation starts',async()=>{
    let finish!:(value:typeof image)=>void;
    vi.mocked(prepareAssistantImage).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const props=await render(empty);
    const input=document.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input,'files',{value:[new File(['test'],'test.png',{type:'image/png'})]});
    await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));});
    await act(async()=>{document.querySelector<HTMLButtonElement>('button[title="新对话"]')!.click();});
    await act(async()=>{finish(image);});
    expect(props.onImagesChange).not.toHaveBeenCalled();
    expect(props.onNew).toHaveBeenCalledTimes(1);
  });
});

describe('assistant linked table presentation',()=>{
  it.each([false,true])('omits actions already shown as citations (explicit: %s)',async(explicit)=>{
    const person={id:'person:2017YANR02',title:'颜瑞民',href:'/wca/persons/2017YANR02',read:true};
    await render({
      answer:`颜瑞民参加过 26 场比赛。${explicit ? ` [[${person.id}]]` : ''}`,
      sources:[person],
      actions:[person,{id:'timer',title:'计时器',href:'/timer'}],
    });
    expect(document.querySelectorAll('a[href="/zh/wca/persons/2017YANR02"]')).toHaveLength(1);
    expect(document.querySelector('.site-assistant-citation')?.textContent).toBe('颜瑞民');
    expect(document.querySelector('.site-assistant-navigation')?.textContent).toBe('打开 计时器');
  });
  it('keeps actions for sources that are not cited',async()=>{
    await render({answer:`比赛见来源。 [[${sources[0].id}]]`,sources,actions:sources});
    expect(document.querySelectorAll('.site-assistant-navigation a')).toHaveLength(1);
    expect(document.querySelector('.site-assistant-navigation a')?.getAttribute('href')).toBe('/zh/wca/comp/Taipei2026');
  });
  it('puts the host flag before competition names outside the first column',async()=>{
    await render({answer:'排名见下表。',sources:[],actions:[sources[0]],artifacts:[{
      kind:'table',title:'排名',columns:['名次','选手','WCA ID','成绩','地区','比赛','日期'],
      columnKinds:['text','text','text','text','country','text','date'],
      rows:[['1','One','2017WANY29','12.71','CN','World Championship 2025','2025-07-03'],['2','Two','2024LUUZ11','15.05','CN','Taipei 2026','2026-01-01']],
      links:['/wca/persons/2017WANY29','/wca/persons/2024LUUZ11'],
      cellLinks:[[null,null,null,null,null,sources[0].href,null],[null,null,null,null,null,sources[1].href,null]],
    }]});
    const rows=document.querySelectorAll('.site-assistant-table tbody tr');
    expect(rows[0].children[4].querySelector('.fi-cn')).not.toBeNull();
    const competition=rows[0].children[5];
    expect(competition.querySelector('a')?.getAttribute('href')).toBe('/zh/wca/comp/WC2025');
    expect(competition.querySelector('.comp-cell')?.firstElementChild?.classList.contains('fi-us')).toBe(true);
    expect(competition.textContent).toBe(' World Championship');
    expect(rows[1].children[5].querySelector('img.cr-flag-img')?.getAttribute('alt')).toBe('Chinese Taipei');
    expect(document.querySelector('a[href="/zh/wca/persons/2017WANY29"]')).not.toBeNull();
    expect(document.querySelector('.site-assistant-navigation')).toBeNull();
  });
  it('shows each competition once in the table and omits duplicate open actions',async()=>{
    await render(result);
    expect(document.querySelectorAll('.site-assistant-table tbody tr')).toHaveLength(2);
    expect(document.querySelector('.site-assistant-navigation')).toBeNull();
    expect(document.querySelectorAll('a[href="/zh/wca/comp/WC2025"]')).toHaveLength(1);
    expect(document.querySelector('.site-assistant-prose')?.textContent).toBe('日期见下表。');
    expect(loadFlagData).toHaveBeenCalledWith({persons:false});
  });

  it('uses canonical country flags, including the Chinese Taipei asset, and date cells',async()=>{
    await render(result);
    const countries=document.querySelectorAll('td.site-assistant-country');
    expect(countries[0].querySelector('.fi-us.country-flag')).not.toBeNull();
    expect(countries[0].textContent).toBe('');
    expect(countries[1].querySelector('img.cr-flag-img.country-flag-ct')?.getAttribute('alt')).toBe('Chinese Taipei');
    expect(document.querySelectorAll('.comp-cell')).toHaveLength(2);
    expect([...document.querySelectorAll('td.site-assistant-date')].map(n=>n.textContent)).toEqual(['2025-07-03~06','2026-01-01']);
  });

  it('retains unrelated navigation and avoids a redundant single-source citation',async()=>{
    await render({...result,sources:[sources[0]],actions:[...sources,{id:'tool',title:'计时器',href:'/timer'},{id:'duplicate',title:'计时器',href:'/timer'}]});
    expect(document.querySelectorAll('.site-assistant-navigation a')).toHaveLength(1);
    expect(document.querySelector('.site-assistant-navigation a')?.getAttribute('href')).toBe('/zh/timer');
    expect(document.querySelector('.site-assistant-citation')).toBeNull();
  });
});

it('keeps feedback in one menu and does not apply failed saves',async()=>{
  const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const props=await render(result,{turns:[{question:'PLL?',result,requestId:id,feedback:'helpful'}]});
  const open = async()=>act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="评价回答"]')!.click());
  const bad = async()=>act(async()=>Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(el=>el.textContent?.includes('回复不佳'))!.click());
  await open();
  expect(document.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain('回复优秀');
  vi.mocked(sendAssistantEvent).mockRejectedValueOnce(new Error('offline'));
  await bad();
  expect(props.onFeedback).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('反馈未保存');
  await open(); await bad();
  expect(props.onFeedback).toHaveBeenCalledWith(id,'other');
});

it('opens a single-message share preview without publishing it and offers branching',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch');
  const onBranch=vi.fn();
  await render(result,{onBranch,turns:[{question:'PLL?',result,createdAt:1793034000000}]});
  const labels=Array.from(document.querySelectorAll('.assistant-answer-toolbar button')).map(el=>el.getAttribute('aria-label'));
  expect(labels.slice(0,3)).toEqual(['复制','朗读','分享']);
  await act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="分享"]')!.click());
  expect(document.querySelector('.assistant-share-dialog')?.textContent).toContain('分享这条消息的公开链接');
  expect(fetcher.mock.calls.some(([url])=>String(url).includes('/site-assistant/shares'))).toBe(false);
  await act(async()=>document.querySelector<HTMLButtonElement>('.assistant-share-dialog button[aria-label="关闭"]')!.click());
  await act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="更多"]')!.click());
  await act(async()=>Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(el=>el.textContent?.includes('创建对话分支'))!.click());
  expect(onBranch).toHaveBeenCalledWith(0);
  fetcher.mockRestore();
});

it('switches read aloud to stop and ignores queued speech after stopping',async()=>{
  const speak = vi.fn(), cancel = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak, cancel });
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  try {
    await render({ answer: '这是用于验证朗读停止的长回答。'.repeat(50), sources: [] });
    await act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="朗读"]')!.click());
    expect(speak).toHaveBeenCalledTimes(1);
    const first = speak.mock.calls[0][0];
    await act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="停止朗读"]')!.click());
    await act(async()=>first.onend());
    expect(speak).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(document.querySelector('button[aria-label="朗读"]')).not.toBeNull();
  } finally { vi.unstubAllGlobals(); }
});

it('links verified addresses in the answer body and preserves Markdown labels',async()=>{
  await render({answer:'训练：/recognize/pll（PLL 观察）。也可打开 [识别训练](/zh/recognize/pll) 或 /timer?content=pll。',sources:[
    {id:'pll',title:'观察',href:'/recognize/pll',read:true},
  ],actions:[{id:'trainer',title:'公式训练',href:'/timer?content=pll'}]});
  const links=[...document.querySelectorAll<HTMLAnchorElement>('.site-assistant-inline-link')];
  expect(links.map(a=>[a.textContent,a.getAttribute('href')])).toEqual([
    ['/recognize/pll','/zh/recognize/pll'],
    ['识别训练','/zh/recognize/pll'],
    ['/timer?content=pll','/zh/timer?content=pll'],
  ]);
});

it('links the verified 2x2 solver address in a reply with multiple sources',async()=>{
  await render({answer:'二阶魔方求解器在这里：二阶 — 求解器（/scramble/solver?event=222）。你也可以先打开魔方求解器总入口。',sources:[
    {id:'solver-222',title:'二阶 — 求解器',href:'/scramble/solver?event=222',read:false},
    {id:'solver',title:'魔方求解器',href:'/scramble/solver',read:false},
  ]});
  const link=document.querySelector<HTMLAnchorElement>('.site-assistant-inline-link');
  expect(link?.textContent).toBe('/scramble/solver?event=222');
  expect(link?.getAttribute('href')).toBe('/zh/scramble/solver?event=222');
});

it('does not link code, unverified paths, or partial matches of a verified path',async()=>{
  await render({answer:'`/recognize/pll` /recognize/pll/unknown /recognize/pll?unknown=1 https://evil.example/recognize/pll [未知](/unknown)\n\n```text\n/recognize/pll\n```',sources:[
    {id:'pll',title:'观察',href:'/recognize/pll',read:true},
  ]});
  expect(document.querySelector('.site-assistant-inline-link')).toBeNull();
  expect(document.querySelectorAll('code')).toHaveLength(2);
  expect(document.querySelector('a[href="/zh/unknown"]')).toBeNull();
});

it('renders verified public source metadata while rejecting private addresses and unverified Markdown links',async()=>{
  await render({answer:'公告。[[news:official]] [[external]] 不可信链接。[[bad]] [自行生成的链接](https://unverified.example/path)',sources:[
    {id:'news:official',title:'Official news',href:'https://www.worldcubeassociation.org/posts/example',read:true},
    {id:'external',title:'Retrieved documentation',href:'https://docs.example.org/guide',read:true},
    {id:'bad',title:'Bad source',href:'https://localhost/private',read:true},
  ]});
  expect(document.querySelector('a[href="https://www.worldcubeassociation.org/posts/example"]')).not.toBeNull();
  expect(document.querySelector('a[href="https://docs.example.org/guide"]')).not.toBeNull();
  expect(document.querySelector('a[href*="localhost"]')).toBeNull();
  expect(document.querySelector('a[href*="unverified.example"]')).toBeNull();
});
