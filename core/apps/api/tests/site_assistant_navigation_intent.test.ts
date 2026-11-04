import { describe, expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { modelResponse, wireEvidence } from './fixtures/site_assistant_model.js';

vi.mock('../src/utils/site_assistant_people.js',()=>({findAssistantPeople:vi.fn(async()=>[])}));

const config={key:'test-secret',baseUrl:'https://model.example/v1',model:'qwen3.8-flash'};

describe('assistant task and guide navigation',()=>{
  it.each(['wrong-kind','extra-read'] as const)('finishes a verified entry without a content dependency: %s',async mode=>{
    const id='page:/alg/3bld/lookup';
    let requests=0;
    const fetcher=vi.fn<typeof fetch>(async input=>{
      if(String(input).includes('/assistant/pages.json'))return Response.json({destinations:[{lang:'zh',href:'/alg/3bld/lookup',title:'盲拧公式查询'}],pages:[]});
      expect(String(input)).toBe(config.baseUrl+'/chat/completions');
      requests++;
      return modelResponse(requests===1 ? {calls:[{tool:'navigation',kind:'algorithms',query:'三盲公式查询'}]} : mode==='wrong-kind'
        ? {answerKind:'site_content',answer:'Unverified usage details.',sourceIds:[id]}
        : {calls:[{tool:'pages',query:'三盲公式查询',pageIds:[id]}]});
    });
    const result=await answerSiteQuestion('三盲公式查询在哪？给我一个入口。','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(result.answer).toBe(`[[${id}]]`);
    expect(result.actions?.map(action=>action.href)).toEqual(['/alg/3bld/lookup']);
    expect(requests).toBe(2);
  });

  it.each([
    '三盲公式查询入口在哪，如何使用？',
    '三盲公式查询入口在哪，介绍它的功能。',
  ])('still requires readable content for a mixed entry/explanation request: %s',async question=>{
    const id='page:/alg/3bld/lookup';
    let requests=0;
    const fetcher=vi.fn<typeof fetch>(async input=>{
      if(String(input).includes('/assistant/pages.json'))return Response.json({version:2,updated:'2026-11-03',destinations:[{lang:'zh',href:'/alg/3bld/lookup',title:'盲拧公式查询'}],pages:[]});
      expect(String(input)).toBe(config.baseUrl+'/chat/completions');
      requests++;
      return modelResponse(requests===1 ? {calls:[{tool:'navigation',kind:'algorithms',query:'三盲公式查询'}]}
        : {answerKind:'site_content',answer:'Unsupported instructions.',sourceIds:[id]});
    });
    await expect(answerSiteQuestion(question,'zh',config,AbortSignal.timeout(5000),fetcher)).rejects.toMatchObject({code:'source_unavailable'});
    expect(requests).toBe(2);
  });

  it('does not pick a destination when the planner has not selected a verified ID',async()=>{
    let requests=0;
    const fetcher=vi.fn<typeof fetch>(async input=>{
      if(String(input).includes('/assistant/pages.json'))return Response.json({destinations:[{lang:'zh',href:'/alg/3bld/lookup',title:'盲拧公式查询'}],pages:[]});
      requests++;
      return modelResponse(requests===1 ? {calls:[{tool:'navigation',kind:'algorithms',query:'三盲公式查询'}]}
        : {answerKind:'general',answer:'需要确认入口。',sourceIds:['page:/invented']});
    });
    const result=await answerSiteQuestion('三盲公式查询在哪？给我一个入口。','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(result.actions).toEqual([]);
    expect(result.sources).toEqual([]);
    expect(result.answer).toBe('需要确认入口。');
  });

  it.each([
    {question:'三盲公式查询在哪？给我一个入口。',query:'三盲公式查询',lang:'zh' as const,selected:'/alg/3bld/lookup'},
    {question:'三盲公式查询在哪？给我一个入口。',query:'公式查询',lang:'zh' as const,selected:'/alg/3bld/lookup'},
    {question:'Where is the 3BLD algorithm lookup?',query:'3BLD lookup',lang:'en' as const,selected:'/alg/3bld/lookup'},
    {question:'Where is the Square-1 PBL finder?',query:'Square-1 PBL finder',lang:'en' as const,selected:'/alg/sq1/pbl-finder'},
  ])('includes algorithm tools beyond catalog sets: $query',async({question,query,lang,selected})=>{
    let requests=0;
    let destinations:any[]=[];
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
      if(String(input).includes('/assistant/pages.json'))return Response.json({
        destinations:[
          {lang,href:'/alg/3bld/lookup',title:lang==='zh'?'盲拧公式查询':'Blindfold algorithm lookup',description:lang==='zh'?'查盲拧公式：三阶的棱角三循环、奇偶、翻角、翻棱。':'Look up blindfold algorithms for corner and edge cycles.'},
          {lang,href:'/alg/3bld/sheets',title:lang==='zh'?'盲拧公式表名录':'Cuber algorithm sheets',description:lang==='zh'?'带三盲、四盲单次成绩的选手公式表。':'Competitors’ algorithm sheets with blindfold results.'},
          {lang,href:'/alg/sq1/pbl-finder',title:lang==='zh'?'SQ1 PBL 高级查找':'Square-1 PBL finder'},
        ],pages:[],
      });
      requests++;
      if(requests===1)return modelResponse({calls:[{tool:'navigation',kind:'algorithms',query}]});
      const evidence=wireEvidence(JSON.parse(String(init?.body)));
      destinations=evidence.find((item:any)=>item.tool.tool==='navigation').data.destinations;
      return modelResponse({answerKind:'general',answer:'入口如下。',sourceIds:['page:'+selected]});
    });
    const result=await answerSiteQuestion(question,lang,config,AbortSignal.timeout(5000),fetcher);
    expect(destinations[0].href).toBe(selected);
    expect(result.actions?.map(action=>action.href)).toEqual([selected]);
    expect(requests).toBe(2);
  });

  it.each([
    {question:'我想练 PLL 识别，入口在哪？',query:'PLL 识别',selected:'/recognize/pll',guide:false},
    {question:'打开 PLL 识别指南',query:'PLL 识别指南',selected:'/recognize/pll/guide',guide:true},
    {question:'I want OLL recognition practice',query:'OLL recognition',selected:'/recognize/oll',guide:false},
  ])('keeps the task distinct from its guide: $question',async({question,query,selected,guide})=>{
    let requests=0;
    let destinations:any[]=[];
    const lang=question.startsWith('I ')?'en':'zh';
    const subject=lang==='en'?'OLL recognition':'PLL 识别';
    const root=lang==='en'?'/recognize/oll':'/recognize/pll';
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
      if(String(input).includes('/assistant/pages.json'))return Response.json({
        destinations:[{lang,href:root,title:lang==='en'?'Observation':'观察'},{lang,href:root+'/guide',title:lang==='en'?'Guide':'识别指南'}],
        pages:[{lang,href:root+'/guide',title:subject+(lang==='en'?' guide':'指南'),text:'Public instructions'}],
      });
      requests++;
      if(requests===1)return modelResponse({calls:[{tool:'navigation',kind:'training',query}]});
      const evidence=wireEvidence(JSON.parse(String(init?.body)));
      destinations=evidence.find((item:any)=>item.tool.tool==='navigation').data.destinations;
      return modelResponse({answerKind:'general',answer:'入口如下。',sourceIds:['page:'+selected]});
    });
    const result=await answerSiteQuestion(question,lang,config,AbortSignal.timeout(5000),fetcher);
    expect(destinations[0].href).toBe(selected);
    if(guide)expect(destinations[0]).toMatchObject({purpose:'guide',entryHref:root});
    else {
      expect(destinations[0]).toMatchObject({purpose:'entry',aliases:expect.arrayContaining([subject.toLowerCase()])});
      expect(destinations.some((p:any)=>p.href===root+'/guide')).toBe(false);
    }
    expect(result.actions?.map(action=>action.href)).toEqual([selected]);
    expect(requests).toBe(2);
  });
});
