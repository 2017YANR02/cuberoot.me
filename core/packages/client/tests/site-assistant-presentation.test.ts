// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes, type ReactNode, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssistantAnswer } from '@cuberoot/shared/site-assistant';

vi.mock('next/link',()=>({default:({children,prefetch:_prefetch,...props}:AnchorHTMLAttributes<HTMLAnchorElement> & {children?:ReactNode;prefetch?:boolean})=>createElement('a',props,children)}));
vi.mock('next/navigation',()=>({useParams:()=>({lang:'zh'})}));
vi.mock('@/hooks/useSpeechToText',()=>({useSpeechToText:()=>({listening:false,start:vi.fn(),stop:vi.fn()})}));
vi.mock('@/lib/site-assistant-images',()=>({prepareAssistantImage:vi.fn()}));
vi.mock('@/lib/country-flags',()=>({
  loadFlagData:vi.fn(async()=>1),compFlagIso2:(id:string)=>id==='WC2025'?'us':'tw',
  compNameZh:()=>null,compNameEnFromZh:()=>null,
}));
import SiteAssistantDialog from '@/components/SiteAssistantDialog';
import { loadFlagData } from '@/lib/country-flags';
import { changeAppLanguage } from '@/i18n/i18n-client';
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
    onDraftChange:vi.fn(),onAsk:vi.fn(),onStop:vi.fn(),onClose:vi.fn(),onNew:vi.fn(),
    ...overrides,
  };
  await act(async()=>root.render(createElement(SiteAssistantDialog,props)));
  return props;
}

describe('assistant image interactions',()=>{
  const image={mediaType:'image/png' as const,data:'fixture'};
  const empty={answer:'Screenshot',sources:[]};
  it('sends image-only messages and keeps original images for regeneration and edits',async()=>{
    const props=await render(empty,{images:[image],turns:[{question:'',images:[image],result:empty}]});
    await act(async()=>{document.querySelector<HTMLButtonElement>('.site-assistant-compose button[type="submit"]')!.click();});
    expect(props.onAsk).toHaveBeenCalledWith('',false,[image]);
    expect(props.onImagesChange).toHaveBeenCalledWith([]);
    await act(async()=>{document.querySelector<HTMLButtonElement>('button[title="重新生成"]')!.click();});
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
