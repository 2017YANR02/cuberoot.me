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
vi.mock('@/lib/assistant-speech',()=>({playAssistantSpeech:vi.fn().mockRejectedValue(new Error('unavailable'))}));
vi.mock('@/lib/country-flags',()=>({
  loadFlagData:vi.fn(async()=>1),compFlagIso2:(id:string)=>id==='WC2025'?'us':'tw',
  compNameZh:()=>null,compNameEnFromZh:()=>null,
}));
import SiteAssistantDialog from '@/components/SiteAssistantDialog';
import { loadFlagData } from '@/lib/country-flags';
import { changeAppLanguage } from '@/i18n/i18n-client';
import { sendAssistantEvent } from '@/lib/site-assistant-request';
import { prepareAssistantImage } from '@/lib/site-assistant-images';
import { playAssistantSpeech } from '@/lib/assistant-speech';

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
    provider:'bailian',onProviderChange:vi.fn(),thinking:'auto',onThinkingChange:vi.fn(),
    ...overrides,
  };
  await act(async()=>root.render(createElement(SiteAssistantDialog,props)));
  return props;
}

it('opens the real 2×2 diagram on a saved text-only EG1 formula card',async()=>{
  const answer:AssistantAnswer={answer:'EG1',sources:[],artifacts:[{
    kind:'algorithms',version:1,title:'2x2 EG1',puzzle:'2x2',set:'eg1',display:'text',offset:0,total:40,nextOffset:1,cards:[{
      caseId:1,puzzle:'2x2',set:'eg1',name:'EG1 S 1',href:'/alg/2x2/eg1',alg:"U' F' L U2 F2 R U' x'",alternative:0,alternativeCount:9,
      sticker:{kind:'face',uf:'bygg',ur:'byoo',ub:'rybb',ul:'gorr',us:'ogyr'},
    }],
  }]};
  const {onAsk}=await render(answer);
  const card=document.querySelector('.assistant-algorithms')!;
  const toggle=card.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
  const diagram=()=>card.querySelector('[role="img"][aria-label="EG1 S 1"] svg');
  expect(toggle.textContent).toBe('显示状态图');
  expect(diagram()).toBeNull();
  await act(async()=>toggle.click());
  expect(diagram()).not.toBeNull();
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(card.querySelector('code')?.textContent).toBe("U' F' L U2 F2 R U' x'");
  expect(onAsk).not.toHaveBeenCalled();
  const loadMore=card.querySelector<HTMLButtonElement>('.assistant-algorithms-more button')!;
  await act(async()=>loadMore.click());
  expect(onAsk).toHaveBeenLastCalledWith(expect.stringContaining('状态图和公式'));
  await act(async()=>toggle.click());
  expect(diagram()).toBeNull();
});

describe('assistant general conversation controls',()=>{
  it('sends a frozen text selection while running and preserves the draft if acceptance fails',async()=>{
    const onAsk=vi.fn().mockResolvedValue(false),onDraftChange=vi.fn();
    const turn={messageId:'run-one',answerVersion:3,question:'统计 2020—2025 年中国选手的三阶成绩',partial:true,result:{answer:'共涉及 128 场比赛。',sources:[]}};
    const props=await render(turn.result,{turns:[turn],draft:'只看平均成绩',busy:true,onAsk,onDraftChange});
    expect(document.querySelector<HTMLTextAreaElement>('.site-assistant-compose textarea')!.disabled).toBe(false);
    const paragraph=document.querySelector('.site-assistant-response p')!;
    const range=document.createRange();range.selectNodeContents(paragraph);
    window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);
    await act(async()=>paragraph.dispatchEvent(new Event('pointerup',{bubbles:true})));
    await act(async()=>document.querySelector<HTMLButtonElement>('.site-assistant-quote-selection')!.click());
    await act(async()=>roots.at(-1)!.render(createElement(SiteAssistantDialog,{...props,turns:[{...turn,answerVersion:4,result:{answer:turn.result.answer+'后续内容。',sources:[]}}]})));
    expect(document.querySelector('.site-assistant-compose .site-assistant-quote-text')?.textContent).toBe(turn.result.answer);
    await act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="调整当前任务"][type="submit"]')!.click());
    expect(onAsk).toHaveBeenCalledWith('只看平均成绩',false,[],[{messageId:'run-one:assistant',messageVersion:3,role:'assistant',selectedText:turn.result.answer,sourceStatus:'partial'}],'steer');
    expect(onDraftChange).not.toHaveBeenCalled();
    expect(document.querySelector('.site-assistant-compose .site-assistant-quote')).not.toBeNull();
  });
  it('shows the answer quote only together with the completed answer toolbar',async()=>{
    const turn={messageId:'run-one',question:'解释概率',partial:true,result:{answer:'概率表示事件发生的可能性。',sources:[]}};
    const props=await render(turn.result,{turns:[turn],busy:true});
    const expectHidden=()=>{
      expect(document.querySelector('[aria-label="引用回答"]')).toBeNull();
      expect(document.querySelector('.assistant-answer-toolbar')).toBeNull();
    };
    expectHidden();
    await act(async()=>roots.at(-1)!.render(createElement(SiteAssistantDialog,{...props,turns:[{...turn,partial:false}]})));
    expectHidden();
    await act(async()=>roots.at(-1)!.render(createElement(SiteAssistantDialog,{...props,busy:false,turns:[{...turn,partial:false,endState:'complete'}]})));
    const toolbar=document.querySelector('.assistant-answer-toolbar')!;
    expect(document.querySelectorAll('[aria-label="引用回答"]')).toHaveLength(1);
    expect(toolbar.querySelector('[aria-label="引用回答"]')).not.toBeNull();
    expect(toolbar.querySelector('[aria-label="复制"]')).not.toBeNull();
    await act(async()=>roots.at(-1)!.render(createElement(SiteAssistantDialog,{...props,busy:false,turns:[{...turn,endState:'stopped'}]})));
    expectHidden();
  });
  it('quotes an exact selection from an older message outside the history window',async()=>{
    const turns=Array.from({length:12},(_,i)=>({messageId:`turn-${i}`,question:`Question ${i}`,result:{answer:`Answer ${i}: exact phrase.`,sources:[]}}));
    const onAsk=vi.fn().mockResolvedValue(true);
    await render(turns[0].result,{turns,draft:'Explain this',onAsk});
    const paragraph=document.querySelector('.site-assistant-response p')!;
    const range=document.createRange();range.setStart(paragraph.firstChild!,10);range.setEnd(paragraph.firstChild!,22);
    window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);
    await act(async()=>paragraph.dispatchEvent(new Event('pointerup',{bubbles:true})));
    await act(async()=>document.querySelector<HTMLButtonElement>('.site-assistant-quote-selection')!.click());
    await act(async()=>document.querySelector<HTMLButtonElement>('.site-assistant-compose button[type="submit"]')!.click());
    expect(onAsk.mock.calls[0][3]).toEqual([{messageId:'turn-0:assistant',messageVersion:1,role:'assistant',selectedText:'exact phrase',sourceStatus:'complete'}]);
    expect(document.querySelector('.site-assistant-compose .site-assistant-quote')).toBeNull();
  });
  it('distinguishes stopping from confirmed stop and prevents duplicate submissions while stopping',async()=>{
    const props=await render({answer:'',sources:[]},{busy:true,stopping:true,draft:'new conditions',turns:[{question:'original',createdAt:Date.now()}]});
    expect(document.querySelector('.site-assistant-progress-heading')?.textContent).toContain('正在停止');
    expect(document.querySelector<HTMLButtonElement>('button[aria-label="调整当前任务"][type="submit"]')?.disabled).toBe(true);
    await act(async()=>document.querySelector('form.site-assistant-compose')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(props.onAsk).not.toHaveBeenCalled();
  });
  it('queues a follow-up explicitly and keeps active progress on the running task',async()=>{
    const onAsk=vi.fn().mockResolvedValue(true);
    const props=await render({answer:'',sources:[]},{busy:true,activeMessageId:'root',draft:'next task',onAsk,turns:[{messageId:'root',question:'running',deliveryState:'running',progress:[{id:1,phase:'tool',tool:'statistics',state:'running',elapsedMs:10}]},{messageId:'next',question:'queued',deliveryState:'queued'}]});
    expect(document.querySelectorAll('.site-assistant-turn')[0].textContent).toContain('正在查询统计数据');
    expect(document.querySelectorAll('.site-assistant-turn')[1].textContent).toContain('等待本对话的上一条回复');
    await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="发送方式"]')!.click());
    await act(async()=>Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(option=>option.textContent?.includes('加入队列'))!.click());
    await act(async()=>document.querySelector<HTMLButtonElement>('.site-assistant-compose button[type="submit"]')!.click());
    expect(onAsk).toHaveBeenCalledWith('next task',false,[],[],'queue');
    await act(async()=>roots.at(-1)!.render(createElement(SiteAssistantDialog,{...props,busy:false,paused:true})));
    expect(document.body.textContent).toContain('任务和队列已暂停');expect(document.body.textContent).toContain('恢复执行');
  });
  it('offers Qwen and DeepSeek in the composer',async()=>{
    const props=await render({answer:'',sources:[]},{turns:[],embedded:true});
    const button=document.querySelector<HTMLButtonElement>('[aria-label="聊天模型"]')!;
    expect(button.textContent).toContain('Qwen-3.8 Flash');
    await act(async()=>button.click());
    const options=[...document.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(options.map(option=>option.textContent)).toEqual(['Qwen-3.8 Flash','DeepSeek Flash']);
    await act(async()=>options[1].click());
    expect(props.onProviderChange).toHaveBeenCalledWith('deepseek');
  });
  it('shows actual execution states and collapses them after completion while revealing a complete answer and table immediately',async()=>{
    const createdAt=Date.now()-2000;
    const steps=[
      {id:1,phase:'model' as const,activity:'plan' as const,state:'running' as const,elapsedMs:0},
      {id:2,phase:'tool' as const,state:'running' as const,tool:'person',scope:{event:'333' as const},elapsedMs:10,durationMs:30,sourceCount:2},
      {id:3,phase:'review' as const,state:'running' as const,elapsedMs:40},
      {id:4,phase:'model' as const,activity:'write' as const,state:'running' as const,elapsedMs:80},
    ];
    const turns=[{question:'对比成绩',createdAt,requestId:'fixture-request',progress:[steps[0]]}];
    const props=await render({answer:'',sources:[]},{turns,busy:true});
    expect(document.querySelector('.site-assistant-progress-heading')?.textContent).toContain('第 1 步 · 正在梳理问题并规划回答');
    for(const [index,label] of ['正在读取选手成绩 · 三阶','正在对照证据核对回答','正在组织内容并生成回答'].entries()){
      const step=index+1;
      const progress=steps.slice(0,step+1).map((item,i)=>i===step?item:{...item,state:'complete' as const});
      await act(async()=>roots.at(-1)!.render(createElement(SiteAssistantDialog,{...props,turns:[{...turns[0],progress}]})));
      expect(document.querySelectorAll('.site-assistant-progress-heading')).toHaveLength(1);
      expect(document.querySelector('.site-assistant-progress-heading')?.textContent).toContain(`第 ${step+1} 步 · ${label}`);
      expect(document.querySelector('.site-assistant-progress-steps')).toBeNull();
      expect(document.querySelector('.site-assistant-progress .more-toggle')).toBeNull();
    }
    const longAnswer='完整回答，不需要等待逐字播放。'.repeat(150);
    await act(async()=>roots.at(-1)!.render(createElement(SiteAssistantDialog,{...props,busy:false,turns:[{...turns[0],result:{answer:longAnswer,sources:[],artifacts:[{kind:'table',title:'结果',columns:['成绩'],rows:[['12.34']]}]},partial:false,endState:'complete',finishedAt:Date.now(),progress:steps.map(p=>({...p,state:'complete' as const,durationMs:100}))}]})));
    expect(document.querySelector('.site-assistant-prose')?.textContent).toContain(longAnswer);
    expect(document.querySelector('.site-assistant-table')?.textContent).toContain('12.34');
    expect(document.querySelector('.site-assistant-progress .more-toggle')?.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelectorAll('.site-assistant-letter')).toHaveLength(0);
    await act(async()=>document.querySelector<HTMLButtonElement>('.site-assistant-progress .more-toggle')!.click());
    expect(document.querySelector('.site-assistant-progress .more-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelectorAll('.site-assistant-progress-steps li')).toHaveLength(4);
    expect(document.querySelector('.site-assistant-progress-steps')?.textContent).toContain('已读取 2 条来源');
  });
  it('identifies the timed-out action in one line and suppresses an empty unfinished draft',async()=>{
    await render({answer:'',sources:[]},{busy:false,error:'timeout',turns:[{
      question:'近三个月谁夺冠最多',endState:'error',deliveryError:'timeout',partial:true,result:{answer:'',sources:[]},createdAt:0,finishedAt:58000,
      progress:[{id:2,phase:'tool',tool:'recent_3x3_champions',state:'running',elapsedMs:10,scope:{from:'2026-08-23',to:'2026-11-23'}}],
    }]});
    expect(document.querySelectorAll('.site-assistant-progress-heading')).toHaveLength(1);
    expect(document.querySelector('.site-assistant-progress-heading')?.textContent).toContain('第 2 步 · 统计 WCA 三阶决赛夺冠次数 · 2026-08-23~11-23 · 超时58 s');
    expect(document.body.textContent).toContain('这次查询超时了');
    expect(document.querySelector('.site-assistant-incomplete')).toBeNull();
    expect(document.querySelector('.site-assistant-response')).toBeNull();
    await act(async()=>document.querySelector<HTMLButtonElement>('.site-assistant-progress .more-toggle')!.click());
    expect(document.querySelector('.site-assistant-progress-steps')?.textContent).toContain('统计 WCA 三阶决赛夺冠次数');
  });
  it('marks a cancelled running step as interrupted, never completed',async()=>{
    await render({answer:'',sources:[]},{busy:false,turns:[{question:'查询',createdAt:Date.now()-1000,finishedAt:Date.now(),endState:'stopped',progress:[{id:1,phase:'tool',tool:'pages',state:'running',elapsedMs:20}]}]});
    await act(async()=>document.querySelector<HTMLButtonElement>('.site-assistant-progress .more-toggle')!.click());
    expect(document.querySelector('.site-assistant-progress-steps [data-state="stopped"]')?.textContent).toContain('已中断');
    expect(document.querySelector('.site-assistant-progress-steps [data-state="complete"]')).toBeNull();
  });
  it('accepts longer writing prompts and shows an editable thinking choice',async()=>{
    const draft='内容'.repeat(1000);
    const props=await render({answer:'',sources:[]},{draft,turns:[]});
    expect(document.querySelector<HTMLTextAreaElement>('.site-assistant-compose textarea')?.maxLength).toBe(SITE_ASSISTANT_QUESTION_MAX_LENGTH);
    expect(document.querySelector('.site-assistant-input-count')).toBeNull();
    expect(document.body.textContent).toContain('写作与翻译');
    const choose=document.querySelector<HTMLButtonElement>('button[aria-label="思考模式"]')!;
    await act(async()=>choose.click());
    await act(async()=>{Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(option=>option.textContent==='深入')!.click();});
    expect(props.onThinkingChange).toHaveBeenCalledWith('deep');
    await act(async()=>document.querySelector<HTMLButtonElement>('.site-assistant-compose button[type="submit"]')!.click());
    expect(props.onAsk).toHaveBeenCalledWith(draft,false,[],[],'queue');
  });
  it('only shows the length count near the limit and keeps the mode fixed during generation',async()=>{
    await render({answer:'',sources:[]},{draft:'x'.repeat(SITE_ASSISTANT_QUESTION_MAX_LENGTH),busy:true});
    expect(document.querySelector('.site-assistant-input-count')?.textContent).toBe(`${SITE_ASSISTANT_QUESTION_MAX_LENGTH}/${SITE_ASSISTANT_QUESTION_MAX_LENGTH}`);
    expect(document.querySelector('button[aria-label="思考模式"]')).toBeNull();
    expect(document.querySelector('button[aria-label="发送方式"]')).not.toBeNull();
  });
});

describe('assistant image interactions',()=>{
  const image={mediaType:'image/png' as const,data:'fixture'};
  const empty={answer:'Screenshot',sources:[]};
  it('sends image-only messages and keeps original images for regeneration and edits',async()=>{
    const props=await render(empty,{images:[image],turns:[{question:'',images:[image],result:empty}]});
    await act(async()=>{document.querySelector<HTMLButtonElement>('.site-assistant-compose button[type="submit"]')!.click();});
    expect(props.onAsk).toHaveBeenCalledWith('',false,[image],[],'queue');
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
  it('renders Markdown result tables and leaves missing scores empty',async()=>{
    await render({answer:'个人最好成绩：\n\n| 项目 | 单次 | 平均 |\n| --- | --- | --- |\n| 三阶 | 7.50 | 8.03 |\n| 单手 | 15.82 |',sources:[]});
    const table=document.querySelector('.site-assistant-prose .site-assistant-table table')!;
    expect([...table.querySelectorAll('th')].map(cell=>cell.textContent)).toEqual(['项目','单次','平均']);
    expect([...table.querySelectorAll('tbody tr')].map(row=>[...row.querySelectorAll('td')].map(cell=>cell.textContent))).toEqual([
      ['三阶','7.50','8.03'],['单手','15.82',''],
    ]);
  });
  it('updates a streaming table without losing cells when the answer completes',async()=>{
    const header='| 项目 | 单次 | 平均 |\n| --- | --- | --- |\n';
    const turn={question:'成绩',partial:true,result:{answer:header+'| 三阶 | 7.',sources:[]}};
    const props=await render(turn.result,{busy:true,turns:[turn]});
    expect([...document.querySelectorAll('.site-assistant-prose td')].map(cell=>cell.textContent)).toEqual(['三阶','7.','']);
    await act(async()=>roots.at(-1)!.render(createElement(SiteAssistantDialog,{...props,busy:false,turns:[{...turn,partial:false,result:{answer:header+'| 三阶 | 7.50 | 8.03 |',sources:[]}}]})));
    expect([...document.querySelectorAll('.site-assistant-prose td')].map(cell=>cell.textContent)).toEqual(['三阶','7.50','8.03']);
  });
  it('preserves table citations and code while rejecting unverified links',async()=>{
    const person={id:'person:2019LIUZ14',title:'个人成绩',href:'/wca/persons/2019LIUZ14',read:true};
    const table='| 项目 | 来源 |\n| --- | --- |\n| ~~旧值~~ `333` | [[person:2019LIUZ14]] |\n| [未知](https://example.com) | — |';
    await render({answer:table+'\n\n```text\n'+table+'\n```',sources:[person]});
    expect(document.querySelectorAll('.site-assistant-prose table')).toHaveLength(1);
    expect(document.querySelector('td code')?.textContent).toBe('333');
    expect(document.querySelector('td del')?.textContent).toBe('旧值');
    expect(document.querySelector('td .site-assistant-citation')?.getAttribute('href')).toBe('/zh/wca/persons/2019LIUZ14');
    expect(document.querySelector('a[href="https://example.com"]')).toBeNull();
    expect(document.querySelector('pre code')?.textContent).toContain('| --- | --- |');
  });
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
    expect(competition.textContent).toBe(' 世界锦标赛');
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
  expect(labels.slice(0,6)).toEqual(['引用回答','复制','朗读','选择音色','选择语速','分享']);
  await act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="分享"]')!.click());
  await act(async()=>{ await vi.dynamicImportSettled(); });
  expect(document.querySelector('.assistant-share-dialog')?.textContent).toContain('分享这条消息的公开链接');
  expect(fetcher.mock.calls.some(([url])=>String(url).includes('/site-assistant/shares'))).toBe(false);
  await act(async()=>document.querySelector<HTMLButtonElement>('.assistant-share-dialog button[aria-label="关闭"]')!.click());
  await act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="更多"]')!.click());
  await act(async()=>Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(el=>el.textContent?.includes('创建对话分支'))!.click());
  expect(onBranch).toHaveBeenCalledWith(0);
  fetcher.mockRestore();
});

it('cancels cloud generation without showing a failure or starting browser speech',async()=>{
  let signal:AbortSignal|undefined;
  vi.mocked(playAssistantSpeech).mockImplementationOnce(async(_input,current)=>{
    signal=current;
    await new Promise<void>((_resolve,reject)=>current.addEventListener('abort',()=>reject(current.reason),{once:true}));
  });
  await render({answer:'回答',sources:[]});
  await act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="朗读"]')!.click());
  expect(document.body.textContent).toContain('正在生成语音');
  await act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="停止朗读"]')!.click());
  expect(signal?.aborted).toBe(true);
  expect(document.body.textContent).not.toContain('使用浏览器朗读');
  expect(document.querySelector('button[aria-label="朗读"]')).not.toBeNull();
});

it('switches read aloud to stop and ignores queued speech after stopping',async()=>{
  const speak = vi.fn(), cancel = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak, cancel });
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  try {
    await render({ answer: '这是用于验证朗读停止的长回答。'.repeat(50), sources: [] });
    await act(async()=>document.querySelector<HTMLButtonElement>('button[aria-label="朗读"]')!.click());
    expect(speak).not.toHaveBeenCalled();
    await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button=>button.textContent==='使用浏览器朗读')!.click());
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
