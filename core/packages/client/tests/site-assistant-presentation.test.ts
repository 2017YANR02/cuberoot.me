// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssistantAnswer } from '@cuberoot/shared/site-assistant';

vi.mock('next/link',()=>({default:({children,prefetch:_prefetch,...props}:AnchorHTMLAttributes<HTMLAnchorElement> & {children?:ReactNode;prefetch?:boolean})=>createElement('a',props,children)}));
vi.mock('next/navigation',()=>({useParams:()=>({lang:'zh'})}));
vi.mock('@/hooks/useSpeechToText',()=>({useSpeechToText:()=>({listening:false,start:vi.fn(),stop:vi.fn()})}));
vi.mock('@/lib/country-flags',()=>({
  loadFlagData:vi.fn(async()=>1),compFlagIso2:(id:string)=>id==='WC2025'?'us':'tw',
  compNameZh:()=>null,compNameEnFromZh:()=>null,
}));
import SiteAssistantDialog from '@/components/SiteAssistantDialog';
import { loadFlagData } from '@/lib/country-flags';
import { changeAppLanguage } from '@/i18n/i18n-client';

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
async function render(answer:AssistantAnswer) {
  changeAppLanguage('zh');
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('div');document.body.append(host);
  const root=createRoot(host);roots.push(root);
  await act(async()=>root.render(createElement(SiteAssistantDialog,{
    turns:[{question:'历年世锦赛时间',result:answer}],busy:false,error:null,lang:'zh',draft:'',
    onDraftChange:vi.fn(),onAsk:vi.fn(),onStop:vi.fn(),onClose:vi.fn(),onNew:vi.fn(),
  })));
}

describe('assistant linked table presentation',()=>{
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
