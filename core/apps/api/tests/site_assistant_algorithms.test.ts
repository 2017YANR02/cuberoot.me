import {describe,it,expect,vi} from 'vitest';
import {algorithmCards,explicitAlgorithmDisplay} from '../src/utils/site_assistant_algorithms.js';
import {answerSiteQuestion} from '../src/utils/site_assistant.js';
import {modelResponse} from './fixtures/site_assistant_model.js';
import {runDataTool,toolCallSchema} from '../src/utils/site_assistant_tools.js';
import {isAssistantAlgorithms,assistantAnswerHistory} from '@cuberoot/shared/site-assistant';
import type {AlgFile} from '@cuberoot/shared/alg';

const data:AlgFile={puzzle:'3x3',set:'pll',source:'fixture',scrapedAt:'2026-11-12',cases:[
  {id:1,name:'T Perm',subgroup:'Adjacent',setup:'',sticker:{kind:'raw',tag:'',attrs:{}},algs:[[{alg:"R U R' U'"},{alg:"R' F R F'",setup:'F R F\' R\''}]]},
  {id:2,name:'Ua Perm',subgroup:'Edges',setup:'',sticker:{kind:'raw',tag:'',attrs:{}},algs:[[{alg:"R U R'"}]]},
]};
describe('assistant library cards',()=>{
  it.each(['展示所有COLL公式','请列出 3x3 COLL 公式。','Show all COLL algorithms'])('resolves an unambiguous display request from the shared catalog: %s',question=>{
    expect(explicitAlgorithmDisplay(question)).toEqual({puzzle:'3x3',set:'coll',display:'both',limit:24});
  });
  it.each(['打开COLL公式库页面','COLL 是什么','展示COLL公式并解释它和PLL的区别','展示COLL公式，只要文字','展示PLL公式图片','展示所有不存在的公式','展示所有6x6COLL公式'])('leaves navigation, qualified and unknown requests to the planner: %s',question=>{
    expect(explicitAlgorithmDisplay(question)).toBeUndefined();
  });
  it('returns paginated real library artifacts without allowing a planner to substitute a navigation answer',async()=>{
    const coll:AlgFile={...data,set:'coll',cases:Array.from({length:42},(_,i)=>({...data.cases[0],id:i+1,name:`COLL ${i+1}`}))};
    const fetcher=vi.fn<typeof fetch>(async url=>{
      expect(String(url)).toMatch(/\/v1\/alg\/sets\/3x3\/coll$/);
      return Response.json(coll);
    });
    const result=await answerSiteQuestion('展示所有COLL公式','zh',{key:'fixture',baseUrl:'https://model.example/v1',model:'fixture'},AbortSignal.timeout(5000),fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts?.[0]).toMatchObject({kind:'algorithms',set:'coll',display:'both',total:42,nextOffset:24});
    expect(result.artifacts?.[0]?.kind==='algorithms' && result.artifacts[0].cards).toHaveLength(24);
    expect(result.answer).toContain('42');
    expect(result.sources).toHaveLength(1);
  });
  it('keeps cards for a cited library alias while discarding cards from an unrelated library',async()=>{
    const model=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'algorithms',puzzle:'3x3',set:'coll'},{tool:'algorithms',puzzle:'3x3',set:'pll'}]}))
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'navigation',query:'COLL',kind:'algorithms'}]}))
      .mockResolvedValueOnce(modelResponse({answer:'COLL 公式如下。',sourceIds:['alg:3x3:coll']}));
    const fetcher:typeof fetch=async(url,init)=>{
      if(String(url).includes('/v1/alg/sets/3x3/'))return Response.json({...data,set:String(url).endsWith('/coll')?'coll':'pll'});
      if(String(url).endsWith('/assistant/pages.json'))return Response.json({pages:[]});
      if(String(url).endsWith('/stats/index.json'))return Response.json({categories:[]});
      return model(url,init);
    };
    const result=await answerSiteQuestion('我想看一些公式卡片','zh',{key:'fixture',baseUrl:'https://model.example/v1',model:'fixture'},AbortSignal.timeout(5000),fetcher);
    expect(result.sources.map(s=>s.id)).toEqual(['alg:3x3:coll']);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts?.[0]).toMatchObject({kind:'algorithms',set:'coll'});
  });
  it('resolves T exactly and preserves the selected alternative and its drawing setup',()=>{
    const result=algorithmCards(data,{puzzle:'3x3',set:'pll',query:'T',alternative:1},'zh');
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({caseId:1,alg:"R' F R F'",setup:"F R F' R'",alternative:1,alternativeCount:2});
    expect(isAssistantAlgorithms(result)).toBe(true);
    expect(assistantAnswerHistory({answer:'如下',sources:[],artifacts:[result]},'https://cuberoot.me')).toContain('caseId=1; alternative=1/2');
  });
  it('keeps complete counts and explicit pagination instead of silently truncating sets',async()=>{
    const call=toolCallSchema.parse({tool:'algorithms',puzzle:'3x3',set:'pll',limit:1,display:'image'});
    if(call.tool!=='algorithms') throw new Error();
    const result=await runDataTool(call,'en',async()=>data);
    expect(result.artifacts[0]).toMatchObject({kind:'algorithms',display:'image',total:2,nextOffset:1});
    expect(algorithmCards(data,{puzzle:'3x3',set:'pll',offset:1},'en')).toMatchObject({total:2,cards:[{caseId:2}]});
    expect(algorithmCards(data,{puzzle:'3x3',set:'pll',query:'missing'},'en').cards).toEqual([]);
  });
  it('rejects unsafe persisted diagram attributes and does not substitute unavailable alternatives',()=>{
    const result=algorithmCards(data,{puzzle:'3x3',set:'pll'},'en');
    result.cards[0].sticker={kind:'raw',tag:'lowcubes-fto',attrs:{image:'//evil.example/x.svg'}};
    expect(isAssistantAlgorithms(result)).toBe(false);
    expect(algorithmCards(data,{puzzle:'3x3',set:'pll',caseId:1,alternative:9},'en').cards).toEqual([]);
  });
});
