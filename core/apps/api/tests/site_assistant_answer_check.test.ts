import { describe, expect, it, vi } from 'vitest';
import { answerSiteQuestion, requestedAssistantEvidence, requestedAssistantGlossary } from '../src/utils/site_assistant.js';
import { createRequirementPreview, assistantAnswerRequirements, missingAssistantRequirements, assistantClaimPassages, assistantClaimIssue } from '../src/utils/site_assistant_answer_check.js';
import { modelResponse } from './fixtures/site_assistant_model.js';

const config = {key:'fixture', baseUrl:'https://model.example/v1', model:'fixture'};
const question = '请逐项回答：1）蓝色标签的含义是什么？2）红色标签的含义是什么？';
const first = '1. 蓝色标签表示等待。';
const full = first + '\n2. 红色标签表示停止。';

describe('per-request coverage and claim citations', () => {
  it('repairs an omitted item in the normal answer path using the same evidence', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(async () => modelResponse({answerKind:'general', answer:first}))
      .mockImplementationOnce(async (_url, init) => {
        const request=JSON.parse(String(init?.body));
        const context=JSON.parse(request.messages.find((m:any)=>m.role==='user').content);
        expect(context).toMatchObject({question,unverifiedDraft:first,currentRequirements:assistantAnswerRequirements(question)});
        expect(context).not.toHaveProperty('statisticsCatalog');
        expect(String(init?.body)).toContain('Unverified request item numbers: 2');
        return modelResponse({answerKind:'general', answer:full});
      });
    const result = await answerSiteQuestion(question, 'zh', config, AbortSignal.timeout(5000), fetcher);
    expect(result.answer).toBe(full);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('accepts an already complete answer in one model call', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => modelResponse({answerKind:'general', answer:full}));
    const result = await answerSiteQuestion(question, 'zh', config, AbortSignal.timeout(5000), fetcher);
    expect(result.answer).toBe(full);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rechecks two real source IDs attached to the wrong conclusions', async () => {
    const entries = [
      {id:101,headEn:'Azure',bodyEn:'The blue display lasts 12 seconds.'},
      {id:102,headEn:'Ruby',bodyEn:'The red display lasts 38 seconds.'},
    ];
    const correct = 'Blue lasts 12 seconds [[wiki:101]]. Red lasts 38 seconds [[wiki:102]].';
    const swapped = 'Blue lasts 12 seconds [[wiki:102]]. Red lasts 38 seconds [[wiki:101]].';
    let modelCalls = 0;
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).endsWith('/wiki/terms')) return Response.json({sections:[{entries}]});
      if (++modelCalls === 1) return modelResponse([{tool:'glossary',query:'Azure'},{tool:'glossary',query:'Ruby'}]);
      const repair = String(init?.body).includes('Recheck the source of each individual claim');
      return modelResponse({answerKind:'grounded',answer:repair ? correct : swapped,sourceIds:['wiki:101','wiki:102']});
    });
    const result = await answerSiteQuestion('Compare the durations for Azure and Ruby.', 'en', config, AbortSignal.timeout(5000), fetcher);
    expect(result.answer).toBe(correct);
    expect(modelCalls).toBe(3);
  });

  it('keeps quoted material and formatting directions outside the task list', () => {
    expect(assistantAnswerRequirements('请翻译“怎么走？要多久？”')).toEqual([]);
    expect(assistantAnswerRequirements('PLL 的定义是什么？请用 JSON 输出。')).toEqual([]);
    expect(assistantAnswerRequirements('What does the median measure? Give one numerical example.')).toHaveLength(2);
    expect(assistantAnswerRequirements(question)).toEqual(['蓝色标签的含义是什么','红色标签的含义是什么？']);
  });

  it('checks distinct answer excerpts without changing requested prose formatting', () => {
    const items = ['计算差额','说明限制'];
    const body = '差额是三元，缺少收据，实际付款无法核实。';
    expect(missingAssistantRequirements(items,body,['差额是三元','实际付款无法核实'])).toEqual([]);
    expect(missingAssistantRequirements(items,body,['差额是三元','差额是三元'])).toEqual([2]);
    expect(missingAssistantRequirements(items,body,['差额是三元','已经核实'])).toEqual([2]);
  });

  const evidence = [{data:{pages:[
    {id:'page:a',content:'The blue display lasts 12 seconds.'},
    {id:'page:b',content:'The red display lasts 38 seconds.'},
    {id:'page:c',content:'An unread search result.'}
  ]}}, {data:{notEvidence:true,entries:[{sourceId:'page:a',body:'An unverified claim.'}]}}];
  const sources = new Map(['page:a','page:b','page:c'].map(id => [id,{read:id!=='page:c'}]));
  const passages = assistantClaimPassages(evidence,sources);

  it('ties exact quotations and measured values to the retained source', () => {
    expect([...passages]).toEqual([['page:a',['The blue display lasts 12 seconds.']],['page:b',['The red display lasts 38 seconds.']]]);
    expect(assistantClaimIssue('Blue lasts 12 seconds [[page:b]]. Red lasts 38 seconds [[page:a]].',[],passages)).toBe('claim_wrong_source');
    expect(assistantClaimIssue('“The red display lasts 38 seconds.” [[page:a]]',[],passages)).toBe('claim_wrong_source');
    expect(assistantClaimIssue('Blue lasts 12 seconds [[page:a]]. Red lasts 38 seconds [[page:b]].',[],passages)).toBeUndefined();
  });

  it('distinguishes a joint comparison from a detached list of references', () => {
    const ids = ['page:a','page:b'];
    expect(assistantClaimIssue('The two durations differ [[page:a]] [[page:b]].',ids,passages)).toBeUndefined();
    expect(assistantClaimIssue('Blue lasts 12 seconds.\nRed lasts 38 seconds.',ids,passages)).toBe('claim_missing_inline_source');
    expect(assistantClaimIssue('The blue display lasts 12 seconds. The red display lasts 38 seconds. [[page:a]][[page:b]]',ids,passages)).toBe('claim_missing_inline_source');
  });
});

describe('checked first answer and glossary evidence', () => {
  const lookup='请从站内词典查证并分别说明：1）括号有什么用途？2）OLL 的英文全称是什么？请把对应来源放在各自结论旁。';
  const entries=[
    {id:1,headZh:'括号',headEn:'(…)',bodyZh:'括号用于将转动序列分组。'},
    {id:2,headEn:'OLL (Orientation of LL)',headZh:'还原顶层色向'},
    {id:3,headEn:'LL (Last Layer)',headZh:'顶层'}
  ];
  it('accepts actual entry and expansion sources for both answers without requesting a page',async()=>{
    const answer='1）括号用于将转动序列分组。[[wiki:1]]\n2）OLL 是 Orientation of Last Layer。[[wiki:2]][[wiki:3]]';
    const urls:string[]=[];
    const fetcher=vi.fn<typeof fetch>(async input=>{
      urls.push(String(input));
      if (String(input).endsWith('/wiki/terms')) return Response.json({sections:[{entries}]});
      return modelResponse({answerKind:'site_content',answer,sourceIds:['wiki:1','wiki:2','wiki:3']});
    });
    expect(requestedAssistantEvidence(lookup)).toBe('auto');
    expect(requestedAssistantGlossary(lookup)).toEqual({tool:'glossary',query:'括号、OLL'});
    const result=await answerSiteQuestion(lookup,'zh',config,AbortSignal.timeout(5000),fetcher);
    expect(result.answer).toBe(answer);
    expect(result.sources.map(s=>s.id).sort()).toEqual(['wiki:1','wiki:2','wiki:3']);
    expect(urls.some(url=>url.endsWith('/pages.json'))).toBe(false);
  });

  it('shows a sourced entry after the lookup and before model composition', async()=>{
    let calls=0;
    const visible:Array<{text:string;calls:number;ids:string[]}>=[];
    const final='1. 括号用于将转动序列分组。[[wiki:1]]\n2. OLL 是 Orientation of Last Layer。[[wiki:2]][[wiki:3]]';
    const fetcher=vi.fn<typeof fetch>(async input=>{
      if(String(input).endsWith('/wiki/terms'))return Response.json({sections:[{entries}]});
      calls++;
      const content=JSON.stringify({answerKind:'grounded',answer:final,sourceIds:['wiki:1','wiki:2','wiki:3']});
      const frame={id:'fixture',object:'chat.completion.chunk',created:1,model:'fixture',choices:[{index:0,delta:{role:'assistant',content},finish_reason:'stop'}]};
      return new Response('data: '+JSON.stringify(frame)+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
    });
    const result=await answerSiteQuestion(lookup,'zh',config,AbortSignal.timeout(5000),fetcher,[],undefined,async event=>{
      if(event.type==='answer' && event.answer)visible.push({text:event.answer,calls,ids:event.sources.map(s=>s.id)});
    });
    expect(visible[0]).toEqual({text:'1. 括号用于将转动序列分组。 [[wiki:1]]',calls:0,ids:['wiki:1']});
    expect(result.answer).toBe(final);
  });

  it('keeps a verified definition when the independent page feature cannot be verified',async()=>{
    const question='请查站内词典，解释 OLL 的英文全称。另外，词典页面是否支持一键导出所有词条？';
    expect(requestedAssistantEvidence(question)).toBe('pages');
    const fetcher=vi.fn<typeof fetch>(async input=>{
      if (String(input).endsWith('/wiki/terms')) return Response.json({sections:[{entries}]});
      if (!String(input).startsWith(config.baseUrl)) return Response.json({pages:[],destinations:[]});
      return modelResponse({answerKind:'site_content',answer:'支持一键导出全部词条。[[wiki:2]]',sourceIds:['wiki:2']});
    });
    const result=await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(5000),fetcher);
    expect(result.answer).toContain('Orientation of Last Layer');
    expect(result.answer).toContain('没有可核实');
    expect(result.answer).not.toContain('支持一键导出');
    expect(result.sources.map(s=>s.id).sort()).toEqual(['wiki:2','wiki:3']);
  });

  it('streams the checked first item before the upstream finishes the second',async()=>{
    // The second half of the provider response is only released by the preview.
    const chunk=(content:string,stop=false)=>'data: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',created:1,model:'fixture',choices:[{index:0,delta:{content},finish_reason:stop?'stop':null}]})+'\n\n';
    const encoder=new TextEncoder();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const wire=new ReadableStream<Uint8Array>({start(c){controller=c;c.enqueue(encoder.encode(chunk('{"answerKind":"general","answer":"'+first+'\\n2. ')));}});
    const fetcher=vi.fn<typeof fetch>(async()=>new Response(wire,{headers:{'Content-Type':'text/event-stream'}}));
    const visible:string[]=[];
    const result=await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(2000),fetcher,[],undefined,async event=>{
      if(event.type==='answer' && event.answer){
        visible.push(event.answer);
        if(visible.length===1){
          controller.enqueue(encoder.encode(chunk('红色标签表示停止。","sourceIds":[]}',true)+'data: [DONE]\n\n'));
          controller.close();
        }
      }
    });
    expect(visible[0]).toBe(first);
    expect(result.answer).toBe(full);
    expect(fetcher).toHaveBeenCalledTimes(1);
  },3500);

  it('holds partial, out-of-order, echoed and source-dependent checklist drafts',()=>{
    const items=['第一项是什么','第二项是什么','第三项是什么'];
    for(const draft of ['1. 还没写完','1. 第一项是什么\n2. ','1. 属实 [[fake]]\n2. ','2. 跳过了一项\n3. ']) {
      expect(createRequirementPreview(items)(draft)).toBeUndefined();
    }
    const read=createRequirementPreview(items);
    expect(read('1. 蓝色。\n2. 红色还没写完')).toBe('1. 蓝色。');
    expect(read('1. 蓝色。\n2. 红色是停止。\n3. ')).toBe('1. 蓝色。\n2. 红色是停止。');
  });
});

it('accepts a verified title list and checks the measurements in each following claim',()=>{
  const ids=['wiki:1','wiki:2'];
  const passages=assistantClaimPassages([{data:{entries:[
    {sourceId:ids[0],head:'Blue 蓝色',bodyEn:'The display lasts 12 seconds.'},
    {sourceId:ids[1],head:'Red 红色',bodyEn:'The display lasts 2 seconds.'},
  ]}}],new Map(ids.map(id=>[id,{read:true}])));
  const intro='词条有“Blue 蓝色”和“Red 红色”：';
  expect(assistantClaimIssue(intro+'前者持续 12 seconds [[wiki:1]]，后者持续 2 seconds [[wiki:2]]。',ids,passages)).toBeUndefined();
  expect(assistantClaimIssue(intro+'前者持续 2 seconds [[wiki:1]]，后者持续 2 seconds [[wiki:2]]。',ids,passages)).toBe('claim_wrong_source');
  expect(assistantClaimIssue('“Red 红色” [[wiki:1]]，见 [[wiki:2]]。',ids,passages)).toBe('claim_wrong_source');
});
