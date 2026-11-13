import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {assistantWebRequestScope} from '../src/utils/site_assistant_web.js';
import {answerSiteQuestion,requestedAssistantEvidence} from '../src/utils/site_assistant.js';
import {modelResponse,wireEvidence} from './fixtures/site_assistant_model.js';
import {resolveAssistantTime} from '@cuberoot/shared/site-assistant';

const config={key:'test-only',baseUrl:'https://model.example/v1',model:'qwen3.8-flash'};
beforeEach(()=>{vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});vi.stubEnv('SITE_ASSISTANT_KNOWLEDGE_ENABLED','0');});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});

describe('stage4 evidence type consistency',()=>{
  it('answers TPS from its entry when the independent forum fails after a comma availability instruction',async()=>{
    let calls=0;
    const fetcher=vi.fn<typeof fetch>(async input=>{
      if(String(input).startsWith(config.baseUrl))return ++calls===1
        ? modelResponse([{tool:'forum',query:'TPS'},{tool:'glossary',query:'TPS'}])
        : modelResponse({answerKind:'site_content',answer:'TPS 是每秒转动步数；论坛暂时无法核实。 [[wiki:1]]',sourceIds:['wiki:1']});
      if(String(input).endsWith('/wiki/terms'))return Response.json({sections:[{entries:[{id:1,head:'TPS',body:'TPS 是每秒转动步数。'}]}]});
      expect(String(input)).not.toContain('/assistant/pages.json');
      return new Response('',{status:503});
    });
    const result=await answerSiteQuestion('查TPS的百科定义和论坛主题，有资料的部分先答，查不到的部分说明状态。','zh',config,AbortSignal.timeout(3000),fetcher,[],undefined,undefined,'UTC',[],'fast');
    expect(result.answer).toContain('每秒转动步数');expect(result.answer).toContain('无法核实');expect(result.sources.map(source=>source.id)).toEqual(['wiki:1']);
    expect(calls).toBe(3);
  });
  it.each(['先回答TPS的百科定义和论坛主题，有资料的部分先答，查不到的部分明确说明。','查TPS的百科定义与论坛，有资料的部分先回答；没有资料的部分说明状态。'])('keeps comma-separated partial availability independent: %s',question=>{
    expect(requestedAssistantEvidence(question)).toBe('auto');
    expect(requestedAssistantEvidence('根据页面有资料的部分先回答。')).toBe('pages');
  });
  it('does not impose page evidence across independent availability clauses',async()=>{
    const question='分别查询F2L的百科定义与论坛主题，有资料的部分先答；查不到的部分说明状态。';
    expect(requestedAssistantEvidence(question)).toBe('auto');
    expect(requestedAssistantEvidence('根据计时器页面资料回答；查不到的部分说明状态。')).toBe('pages');
    let calls=0;
    const fetcher=vi.fn<typeof fetch>(async input=>{
      if(String(input).startsWith(config.baseUrl))return ++calls===1?modelResponse([{tool:'glossary',query:'F2L'},{tool:'forum',query:'F2L'}]):modelResponse({answerKind:'site_content',answer:'F2L是前两层；论坛暂时无法核实。 [[wiki:1]]',sourceIds:['wiki:1']});
      if(String(input).endsWith('/wiki/terms'))return Response.json({sections:[{entries:[{id:1,head:'F2L',body:'F2L是前两层。'}]}]});
      expect(String(input)).not.toContain('/assistant/pages.json');
      return new Response('',{status:503});
    });
    const result=await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(4000),fetcher,[],undefined,undefined,'UTC',[],'fast');
    expect(result.answer).toContain('前两层');expect(result.sources.map(s=>s.id)).toEqual(['wiki:1']);expect(calls).toBe(3);
  });
  it('does not expose a tool failure as a citeable observation in drafting or isolated review',async()=>{
    let calls=0,seen=0;
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
      if(String(input).startsWith(config.baseUrl)){
        for(const item of wireEvidence(JSON.parse(String(init?.body))))if(item.data?.status==='temporary_failure'){
          seen++;expect(item).not.toHaveProperty('id');expect(item.citationAllowed).toBe(false);
        }
        return ++calls===1?modelResponse([{tool:'glossary',query:'DNS'},{tool:'forum',query:'DNS'}]):modelResponse({answerKind:'site_content',answer:'DNS 表示未开始尝试；论坛暂时无法核实。 [[wiki:1]]',sourceIds:['wiki:1']});
      }
      if(String(input).endsWith('/wiki/terms'))return Response.json({sections:[{entries:[{id:1,head:'DNS',body:'DNS 表示未开始尝试。'}]}]});
      return new Response('',{status:503});
    });
    const result=await answerSiteQuestion('查DNS百科定义和论坛主题，独立部分先回答。','zh',config,AbortSignal.timeout(4000),fetcher,[],undefined,undefined,'UTC',[],'fast');
    expect(seen).toBeGreaterThanOrEqual(2);expect(result.answer).toContain('未开始尝试');expect(result.sources.map(s=>s.id)).toEqual(['wiki:1']);
  });
  it.each(['draft','review'])('keeps the retrieved glossary when %s mislabels it as site_content',async phase=>{
    let calls=0;
    const fetcher=vi.fn<typeof fetch>(async input=>{
      if(String(input).startsWith(config.baseUrl)) {
        calls++;
        if(calls===1)return modelResponse([{tool:'glossary',query:'DNS'},{tool:'forum',query:'DNS'}]);
        return modelResponse({answerKind:(phase==='draft'||calls>2)?'site_content':'grounded',answer:'DNS 表示未开始尝试；论坛暂时无法核实。 [[wiki:1]]',sourceIds:['wiki:1']});
      }
      if(String(input).endsWith('/wiki/terms'))return Response.json({sections:[{entries:[{id:1,head:'DNS',body:'DNS 表示未开始尝试。'}]}]});
      return new Response('',{status:503});
    });
    const result=await answerSiteQuestion('查DNS百科定义和论坛主题，独立部分先回答。','zh',config,AbortSignal.timeout(4000),fetcher,[],undefined,undefined,'UTC',[],'fast');
    expect(result.answer).toContain('未开始尝试');expect(result.sources.map(s=>s.id)).toEqual(['wiki:1']);expect(calls).toBe(3);
  });
  it.each(['empty','invented','feature'])('keeps the final evidence guard for %s evidence',async kind=>{
    let calls=0;
    const fetcher=vi.fn<typeof fetch>(async input=>{
      if(String(input).startsWith(config.baseUrl))return ++calls===1?modelResponse([{tool:'glossary',query:'DNS'}]):modelResponse({answerKind:'site_content',answer:'DNS 表示未开始尝试；计时器支持自动保存。 [['+(kind==='invented'?'unknown':'wiki:1')+']]',sourceIds:[kind==='invented'?'unknown':'wiki:1']});
      if(String(input).endsWith('/wiki/terms'))return Response.json({sections:[{entries:[{id:1,head:'DNS',body:kind==='empty'?'':'DNS 表示未开始尝试。'}]}]});
      return new Response('',{status:503});
    });
    const question=kind==='feature'?'根据计时器页面资料确认是否支持自动保存？':'查DNS的百科定义。';
    const result=await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(4000),fetcher,[],undefined,undefined,'UTC',[],'fast');
    expect(result.answer).not.toContain('支持自动保存');expect(result.sources).toEqual([]);
  });
});

describe('stage4 request web dates',()=>{
  it.each([['web_search','news'],['news','web_search']])('blocks both dependent reads before execution in order %s, %s',async(first,second)=>{
    let calls=0;
    const fetcher=vi.fn<typeof fetch>(async input=>{
      expect(String(input).startsWith(config.baseUrl)).toBe(true);
      return ++calls===1?modelResponse([{tool:first,query:'公告'},{tool:second,query:'公告'}]):modelResponse({answerKind:'general',answer:'无法确认，请明确日期口径。',sourceIds:[]});
    });
    const result=await answerSiteQuestion('查本月发布与实际发生的事件，两种日期都要。','zh',config,AbortSignal.timeout(3000),fetcher,[],undefined,undefined,'UTC',[],'fast');
    expect(result.answer).toContain('请明确');expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    ['只列2026年10月实际发生的事件，不能把文章发布日期当事件日期。',{from:'2026-10-01',to:'2026-10-31',dateBasis:'event'}],
    ['只限2026年10月1日至31日发布的公告。',{from:'2026-10-01',to:'2026-10-31',dateBasis:'publication'}],
    ['只要2026年11月实际发生的事件，不是11月新发布的文章。',{from:'2026-11-01',to:'2026-11-30',dateBasis:'event'}],
    ['只要2026年11月实际发生的事件，并非11月发表的文章。',{from:'2026-11-01',to:'2026-11-30',dateBasis:'event'}],
    ['不是文章发布日期，而是2026年11月事件实际发生日期。',{from:'2026-11-01',to:'2026-11-30',dateBasis:'event'}],
    ['2026年11月发布的公告，不是事件实际发生日期。',{from:'2026-11-01',to:'2026-11-30',dateBasis:'publication'}],
    ['查2026年10月30日至2026年11月2日发表的公告。',{from:'2026-10-30',to:'2026-11-02',dateBasis:'publication'}],
    ['Published from 2026-10-01 to 2026-10-31.',{from:'2026-10-01',to:'2026-10-31',dateBasis:'publication'}],
    ['查2026年10月发布的公告，同时显示事件实际发生日期。',{from:'2026-10-01',to:'2026-10-31',dateBasis:'publication'}],
    ['2026年2月30日发布的公告',{ambiguous:true}],
    ['比较2026年9月和2026年10月发布的公告。',{ambiguous:true}],
    ['本月发布与实际发生的事件都要。',{ambiguous:true}],
  ] as const)('resolves the original request: %s',(question,expected)=>{
    expect(assistantWebRequestScope(question,{periods:[]})).toMatchObject(expected);
  });
  it('does not infer the current month from an undated request',()=>{
    expect(assistantWebRequestScope('查询这个比赛的公告。',{periods:[]})).toEqual({});
  });
  it.each([
    ['去年10月发布的公告。',{from:'2025-10-01',to:'2025-10-31',dateBasis:'publication'}],
    ['今年2月发布的公告。',{from:'2026-02-01',to:'2026-02-28',dateBasis:'publication'}],
    ['去年10月3日发布的公告。',{ambiguous:true}],
    ['去年13月发布的公告。',{ambiguous:true}],
    ['今年实际发生的事件。',{from:'2026-01-01',to:'2026-12-31',dateBasis:'event'}],
  ] as const)('does not widen a relative date: %s',(question,expected)=>{
    expect(assistantWebRequestScope(question,resolveAssistantTime(question,new Date('2026-10-31T00:00:00Z'),'UTC'))).toMatchObject(expected);
  });
  it('clarifies an ambiguous web scope even if the model invents an answer',async()=>{
    let calls=0;
    const fetcher=vi.fn<typeof fetch>(async input=>{
      expect(String(input).startsWith(config.baseUrl)).toBe(true);
      return ++calls===1?modelResponse([{tool:'web_search',query:'公告',recency:'any'}]):modelResponse({answerKind:'general',answer:'晴空已在本月启动。',sourceIds:[]});
    });
    const result=await answerSiteQuestion('联网查询本月发布与实际发生的事件，两种日期都要。','zh',config,AbortSignal.timeout(4000),fetcher,[],undefined,undefined,'UTC',[],'fast');
    expect(result.answer).toContain('请明确');expect(result.answer).not.toContain('晴空');expect(result.sources).toEqual([]);
  });
  it.each(['omitted','conflicting'])('keeps one event interval on two searches when the second scope is %s',async variant=>{
    vi.stubEnv('SITE_ASSISTANT_WEB_ENABLED','1');vi.stubEnv('SITE_ASSISTANT_WEB_API_KEY','synthetic-key');vi.stubEnv('SITE_ASSISTANT_WEB_BASE_URL','https://dashscope.aliyuncs.com/compatible-mode/v1');
    const actual:any[]=[];let calls=0;
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
      if(String(input).startsWith(config.baseUrl)) {
        const request=JSON.parse(String(init?.body));
        for(const item of wireEvidence(request))if(item.data?.originals)actual.push(item.data);
        calls++;
        if(calls<=2)return modelResponse([{tool:'web_search',query:'official '+calls,recency:'any',...(calls===1?{from:'2026-01-01',to:'2026-12-31',dateBasis:'publication'}:variant==='conflicting'?{dateBasis:'publication',from:'2025-01-01',to:'2025-12-31'}:{})}]);
        return modelResponse({answerKind:'general',answer:'事件时间不在所问范围，无法确认。',sourceIds:[]});
      }
      if(String(input).startsWith('https://dashscope.aliyuncs.com'))return new Response('data:'+JSON.stringify({output:{search_info:{search_results:[{index:1,title:'official',url:'https://www.worldcubeassociation.org/posts/stage4-old'}]},choices:[{message:{content:[{text:JSON.stringify({relevant:true,summary:'New article [ref_1].'})}]},finish_reason:'stop'}]}})+'\n\n',{headers:{'content-type':'text/event-stream'}});
      return new Response('<html><head><meta property="article:published_time" content="2026-10-25"><script type="application/ld+json">{"@type":"SportsEvent","startDate":"2025-05-03"}</script></head><main><p>Old event happened May 3, 2025.</p></main></html>',{headers:{'content-type':'text/html'}});
    });
    await answerSiteQuestion('联网只列2026年10月实际发生的事件，不能把文章发布日期当事件日期。','zh',config,AbortSignal.timeout(4000),fetcher,[],undefined,undefined,'UTC',[],'fast');
    expect(actual.length).toBeGreaterThanOrEqual(2);
    for(const data of actual) {expect(data).toMatchObject({from:'2026-10-01',to:'2026-10-31',dateBasis:'event',verifiedSourceIds:[]});expect(data.originals[0].admissible).toBe(false);}
  });
});
