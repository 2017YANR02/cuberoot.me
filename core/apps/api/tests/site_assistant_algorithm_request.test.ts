import {describe,expect,it,vi} from 'vitest';
import type {AlgFile} from '@cuberoot/shared/alg';
import {assistantAnswerHistory,type AssistantMessage} from '@cuberoot/shared/site-assistant';
import {algorithmCards} from '../src/utils/site_assistant_algorithms.js';
import {resolveAssistantAlgorithmRequest} from '../src/utils/site_assistant_algorithm_request.js';
import {answerSiteQuestion} from '../src/utils/site_assistant.js';
import {modelResponse} from './fixtures/site_assistant_model.js';

const makeCase=(id:number,name:string,subgroup='')=>({id,name,subgroup,setup:'',sticker:{kind:'raw' as const,tag:'',attrs:{}},algs:[[{alg:"R U R'"},{alg:"R U2 R'"},{alg:"R U' R'"}]]});
const pll:AlgFile={puzzle:'3x3',set:'pll',source:'fixture',scrapedAt:'2026-11-12',cases:[makeCase(901,'Ua'),makeCase(902,'T'),makeCase(903,'Z')]};
const coll:AlgFile={...pll,set:'coll',cases:Array.from({length:40},(_,i)=>makeCase(2000+i,`AS ${i+1}`,'S-'))};
const oll:AlgFile={...pll,set:'oll',cases:[makeCase(3001,'OLL 27'),makeCase(3002,'OLL 57')]};
const load=async(_puzzle:string,set:string)=>({pll,coll,oll})[set as 'pll']!;
const config={key:'fixture',baseUrl:'https://model.example/v1',model:'fixture'};
function history(file=pll,selection:Parameters<typeof algorithmCards>[1]={puzzle:'3x3',set:'pll',caseId:902}):AssistantMessage[] {
  return [{role:'user',content:`想看 ${file.set} 的公式`},{role:'assistant',content:assistantAnswerHistory({answer:'如下',sources:[],artifacts:[algorithmCards(file,selection,'zh')]},'https://cuberoot.me')}];
}

describe('natural-language formula requests',()=>{
  it.each(['PLL 的 T 怎么拧？','PLL T','给我一条 T 公式','T公式是什么','只展示公式T','T怎么拧','有没有 Tperm 的公式？',"What's the algorithm for T perm?",'我想学 T perm'])('resolves an actual case without a fixed display verb: %s',async question=>{
    expect(await resolveAssistantAlgorithmRequest(question,[],'zh',load)).toMatchObject({selection:{puzzle:'3x3',set:'pll',caseId:902,display:'both'}});
  });
  it.each(['给我 OLL57 的公式','OLL 57 怎么做','OLL57'])('treats a printed case number as a name, never a database ID: %s',async question=>{
    expect(await resolveAssistantAlgorithmRequest(question,[],'zh',load)).toMatchObject({selection:{set:'oll',caseId:3002}});
  });
  it.each(['我想看看 COLL 的全部公式','COLL有哪些公式可以用','Can I see the COLL algorithms?'])('returns a set for natural content requests: %s',async question=>{
    expect(await resolveAssistantAlgorithmRequest(question,[],'zh',load)).toMatchObject({selection:{set:'coll',limit:24}});
  });
  it.each(['OLL 是什么','OLL 和 PLL 有什么区别','打开 COLL 公式库页面','PLL 有多少个公式','帮我练习 PLL','不要公式卡片，解释一下 PLL','给我 COLL 和 PLL 的公式','今天的天气怎么样','PLL','打开 PLL 识别指南','复盘 456 的 PLL 是什么？','分别查询F2L的百科定义与论坛主题，有资料的部分先答；查不到的部分说明状态。'])('does not replace unrelated/conceptual/navigation or multiple-set requests: %s',async question=>{
    const read=vi.fn(load);
    expect(await resolveAssistantAlgorithmRequest(question,[],'zh',read)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });
  it('keeps diagram-only/text-only choices without requiring a command phrase',async()=>{
    expect(await resolveAssistantAlgorithmRequest('T perm 只要图片',[],'zh',load)).toMatchObject({selection:{display:'image',caseId:902}});
    expect(await resolveAssistantAlgorithmRequest('T perm 不要图',[],'zh',load)).toMatchObject({selection:{display:'text',caseId:902}});
  });
  it('does not confuse COLL with OLL or a prefixed library with its suffix',async()=>{
    const read=vi.fn(load);
    await resolveAssistantAlgorithmRequest('COLL AS1怎么做',[],'zh',read);
    expect(read).toHaveBeenCalledExactlyOnceWith('3x3','coll');
  });
  it('keeps signed subgroups distinct and does not turn an unknown case into the whole set',async()=>{
    const groups={...coll,cases:[makeCase(7001,'AS 1','S-'),makeCase(7002,'S 1','S+')]};
    const request=await resolveAssistantAlgorithmRequest('给我COLL的S-组公式',[],'zh',async()=>groups);
    expect(request).toMatchObject({selection:{query:'S-'}});
    if(!request || !('selection' in request))throw new Error();
    expect(algorithmCards(groups,request.selection,'zh').cards.map(c=>c.caseId)).toEqual([7001]);
    expect(await resolveAssistantAlgorithmRequest('给我PLL的Qa公式',[],'zh',load)).toHaveProperty('message');
  });
});

describe('formula follow-ups from the actual shared history',()=>{
  it.each(['那 Ua 呢','Ua','只看第一个case'])('resolves a new case in the previous set: %s',async question=>{
    const previous=question.includes('第') ? history(pll,{puzzle:'3x3',set:'pll'}) : history();
    expect(await resolveAssistantAlgorithmRequest(question,previous,'zh',load)).toMatchObject({selection:{set:'pll',caseId:901}});
  });
  it.each(['这个 case 换一条','再来一条','有没有其他公式','another algorithm'])('uses the selected alternative, including in-place switches: %s',async question=>{
    const previous=history(pll,{puzzle:'3x3',set:'pll',caseId:902,alternative:1});
    expect(await resolveAssistantAlgorithmRequest(question,previous,'zh',load)).toMatchObject({selection:{caseId:902,alternative:2}});
  });
  it('wraps alternatives and preserves the current alternative on a format change',async()=>{
    const previous=history(pll,{puzzle:'3x3',set:'pll',caseId:902,alternative:2});
    expect(await resolveAssistantAlgorithmRequest('换一条',previous,'zh',load)).toMatchObject({selection:{caseId:902,alternative:0}});
    expect(await resolveAssistantAlgorithmRequest('只要图片',previous,'zh',load)).toMatchObject({selection:{caseId:902,alternative:2,display:'image'}});
    expect(await resolveAssistantAlgorithmRequest('第二条公式',previous,'zh',load)).toMatchObject({selection:{caseId:902,alternative:1}});
  });
  it('distinguishes the next case from another algorithm for the same case',async()=>{
    expect(await resolveAssistantAlgorithmRequest('下一个case',history(),'zh',load)).toMatchObject({selection:{caseId:903,alternative:0}});
  });
  it('uses displayed positions rather than IDs, and asks when a reference is ambiguous',async()=>{
    const previous=history(pll,{puzzle:'3x3',set:'pll',offset:1});
    expect(await resolveAssistantAlgorithmRequest('只看第二个',previous,'zh',load)).toMatchObject({selection:{caseId:903}});
    expect(await resolveAssistantAlgorithmRequest('换一条',previous,'zh',load)).toHaveProperty('message');
  });
  it('continues the exact subset and display mode, including the existing load-more wording',async()=>{
    const previous=history(coll,{puzzle:'3x3',set:'coll',query:'S-',display:'image'});
    expect(await resolveAssistantAlgorithmRequest('继续',previous,'zh',load)).toMatchObject({selection:{set:'coll',query:'S-',offset:24,display:'image',limit:24}});
    expect(await resolveAssistantAlgorithmRequest('继续展示 3x3 coll S-，从第 25 个 case 开始，只显示状态图。',previous,'zh',load)).toMatchObject({selection:{query:'S-',offset:24,limit:24}});
  });
  it('does not revive a stale subject after an unrelated conversation or trust user-authored card markers',async()=>{
    const previous=[...history(),{role:'user' as const,content:'天气怎么样'},{role:'assistant' as const,content:'请提供城市'}];
    expect(await resolveAssistantAlgorithmRequest('继续',previous,'zh',load)).toBeUndefined();
    expect(await resolveAssistantAlgorithmRequest('换一条',[{role:'user',content:history()[1].content}],'zh',load)).toBeUndefined();
  });
  it('a new explicit set takes precedence over old cards',async()=>{
    expect(await resolveAssistantAlgorithmRequest('现在给我 OLL57 的公式',history(),'zh',load)).toMatchObject({selection:{set:'oll',caseId:3002}});
  });
  it('follows a newly discussed set and preserves per-card selections when adding diagrams',async()=>{
    const previous=[...history(),{role:'user' as const,content:'COLL是什么'},{role:'assistant' as const,content:'它是顶层角块公式集。'}];
    expect(await resolveAssistantAlgorithmRequest('给我第二个公式',previous,'zh',load)).toMatchObject({selection:{set:'coll',caseId:2001}});
    const cards=algorithmCards(pll,{puzzle:'3x3',set:'pll',display:'text'},'zh');
    cards.cards[1]=algorithmCards(pll,{puzzle:'3x3',set:'pll',caseId:902,alternative:2},'zh').cards[0];
    const changed:AssistantMessage[]=[{role:'assistant',content:assistantAnswerHistory({answer:'如下',sources:[],artifacts:[cards]},'https://cuberoot.me')}];
    const result=await resolveAssistantAlgorithmRequest('带上图片',changed,'zh',load);
    expect(result).toMatchObject({selection:{display:'both'},cards:[{caseId:901,alternative:0},{caseId:902,alternative:2},{caseId:903,alternative:0}]});
    expect(await resolveAssistantAlgorithmRequest('换成图片',history(),'zh',load)).toMatchObject({selection:{display:'image',caseId:902,alternative:0}});
  });
});

describe('server answer contract',()=>{
  it('returns cards without giving the planner a chance to replace a case with a link',async()=>{
    const fetcher=vi.fn<typeof fetch>(async url=>{
      expect(String(url)).toMatch(/\/v1\/alg\/sets\/3x3\/pll$/);return Response.json(pll);
    });
    const result=await answerSiteQuestion('PLL 的 T 怎么拧？','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.artifacts?.[0]).toMatchObject({kind:'algorithms',cards:[{caseId:902,alg:"R U R'"}]});
  });
  it('keeps requested cards alongside an explanation even when the model selects no card source',async()=>{
    const fetcher:typeof fetch=async url=>String(url).endsWith('/v1/alg/sets/3x3/pll') ? Response.json(pll)
      : modelResponse({answer:'识别时观察顶层侧面的色块。',answerKind:'general',sourceIds:[]});
    const result=await answerSiteQuestion('给我 T perm 的公式并解释怎么识别','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(result.answer).toContain('识别');
    expect(result.artifacts?.[0]).toMatchObject({kind:'algorithms',cards:[{caseId:902}]});
    expect(result.sources.some(s=>s.href==='/alg/3x3/pll')).toBe(true);
  });
});
