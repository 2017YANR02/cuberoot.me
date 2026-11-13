import {expect,it,vi,afterEach} from 'vitest';
import {answerSiteQuestion,requestedAssistantEvidence} from '../src/utils/site_assistant.js';
import {assistantAnswerContext,assistantContextFollowUpCall,rememberAssistantContext,parseAssistantContext,restoreAssistantContext,resolveAssistantSnapshotAnswer,assistantSnapshotReference} from '../src/utils/site_assistant_context.js';
import {modelResponse,wireEvidence} from './fixtures/site_assistant_model.js';
const config={key:'fixture',baseUrl:'https://model.example/v1',model:'test'};
const decodedEvidence=(request:any)=>wireEvidence(request).map((item:any)=>{
  try{return {...item,data:typeof item.data==='string'?JSON.parse(item.data):item.data};}catch{return item;}
});
afterEach(()=>vi.unstubAllEnvs());
it.each([
  ['请按活动规则说明迟到的处理方式。','pages'],
  ['根据网页核对各月的场次数量。','pages'],
  ['按照本站教学示例计算分组数量。','pages'],
  ['Based on the site example, explain the counting method.','pages'],
  ['按我给的例子：120减90再除以30，结果多少？','auto'],
  ['Read the documentation and explain the steps.','pages'],
  ['只给我计时器入口，不要教程。','navigation'],
  ['打开 Max Park 的选手页面','navigation'],
  ['计时器是否支持云同步？','pages'],
  ['计时器云同步功能是否可用？','pages'],
  ['How does the timer work?','pages'],
  ['计时器有几条记录？','auto'],
  ['不要只给链接，请根据页面说明。','pages'],
  ['你好','auto'],['(450-120)/60 等于多少？','auto'],
  ['Translate: I read the book yesterday.','auto'],
])('recognizes explicit source obligations without changing ordinary requests: %s',(question,expected)=>{
  expect(requestedAssistantEvidence(question)).toBe(expected);
});
it('reads an explicitly requested page before a general-labelled draft and distinguishes an unloaded catalog',async()=>{
  vi.stubEnv('SITE_ASSISTANT_KNOWLEDGE_ENABLED','0');
  const corpus={version:2,updated:'2026-10-10T00:00:00Z',pages:[{lang:'zh',href:'/timer',title:'计时器训练',text:'先选择练习项目，再开始练习。'}]};
  const requests:any[]=[];
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    if(String(input).endsWith('/assistant/pages.json'))return Response.json(corpus);
    const request=JSON.parse(String(init?.body));requests.push(request);
    const context=JSON.parse(request.messages.find((m:any)=>m.role==='user').content);
    expect(context.statisticsCatalogStatus).toBe('not_loaded');
    expect(wireEvidence(request)[0].tool.tool).toBe('pages');
    return modelResponse({answerKind:'general',answer:'先选择练习项目，再开始练习。',sourceIds:[context.sources[0].id]});
  });
  const result=await answerSiteQuestion('请根据资料说明计时器训练的步骤。','zh',config,AbortSignal.timeout(3000),fetcher);
  expect(String(fetcher.mock.calls[0][0])).toContain('/assistant/pages.json');
  expect(result.answer).toContain('先选择练习项目');
  expect(result.sources[0].read).toBe(true);
  expect(requests.length).toBeGreaterThan(0);
});
it('composes from full evidence without an unused draft or assistant history',async()=>{
  vi.stubEnv('SITE_ASSISTANT_KNOWLEDGE_ENABLED','0');
  const corpus={version:2,updated:'2026-10-10T00:00:00Z',pages:[{lang:'zh',href:'/timer',title:'计时器训练',text:'先选择项目，再开始练习。'}]};
  let calls=0;
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    if(String(input).endsWith('/assistant/pages.json'))return Response.json(corpus);
    const body=JSON.parse(String(init?.body));calls++;
    const context=JSON.parse(body.messages.find((m:any)=>m.role==='user'&&m.content.startsWith('{')).content);
    expect(body.tool_choice).toBe('auto');
    expect(JSON.stringify(body)).not.toContain('UNVERIFIED_DRAFT');
    expect(JSON.stringify(body)).not.toContain('EARLIER_ASSISTANT_CLAIM');
    expect(wireEvidence(body)[0].data.pages[0].content).toContain('先选择项目');
    return modelResponse({answerKind:'site_content',answer:'先选择项目，再开始练习。',sourceIds:[context.sources[0].id]});
  });
  const result=await answerSiteQuestion('请根据页面资料说明计时器训练步骤。','zh',config,AbortSignal.timeout(3000),fetcher,[{role:'assistant',content:'EARLIER_ASSISTANT_CLAIM'}]);
  expect(result.answer).toContain('先选择项目');expect(calls).toBe(1);
});
it('revalidates citations invented by the final reviewer',async()=>{
  vi.stubEnv('SITE_ASSISTANT_KNOWLEDGE_ENABLED','0');
  const corpus={version:2,updated:'2026-10-10T00:00:00Z',pages:[{lang:'zh',href:'/timer',title:'计时器训练',text:'选择练习项目。'}]};let calls=0;
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    if(String(input).endsWith('/assistant/pages.json'))return Response.json(corpus);
    const context=JSON.parse(JSON.parse(String(init?.body)).messages.find((m:any)=>m.role==='user').content);
    calls++;return modelResponse({answerKind:'grounded',answer:'Unsupported [[forged]]',sourceIds:['forged']});
  });
  const result=await answerSiteQuestion('请按页面资料说明计时器训练。','zh',config,AbortSignal.timeout(3000),fetcher);
  expect(result.answer).not.toContain('Unsupported');expect(result.sources).toEqual([]);expect(calls).toBe(3);
});
it('does not release a grounded answer when no evidence was read',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>modelResponse({answerKind:'grounded',answer:'Unverified 37 competitions',sourceIds:[]}));
  const result=await answerSiteQuestion('赛事数量？','zh',config,AbortSignal.timeout(3000),fetcher);
  expect(result.answer).not.toContain('37');expect(result.sources).toEqual([]);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('accepts a pure evidence-gap answer but not a mixed gap and unsupported assertion',async()=>{
  vi.stubEnv('SITE_ASSISTANT_KNOWLEDGE_ENABLED','0');
  const corpus={version:2,updated:'2026-10-10T00:00:00Z',pages:[{lang:'zh',href:'/timer',title:'计时器训练',text:'本文没有说明云同步是否可用。'}]};
  for(const [reviewAnswer,expected] of [
    ['现有资料无法确认云同步是否可用。','gap'],
    ['现有资料无法确认云同步是否可用，但计时器支持一键同步。','blocked'],
  ] as const) {
    let calls=0;
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
      if(String(input).endsWith('/assistant/pages.json'))return Response.json(corpus);
      const context=JSON.parse(JSON.parse(String(init?.body)).messages.find((message:any)=>message.role==='user'&&message.content.startsWith('{')).content);
      calls++;const answer={answerKind:'site_content',answer:reviewAnswer,sourceIds:[]};
      return modelResponse(answer);
    });
    const result=await answerSiteQuestion('计时器云同步功能是否可用？','zh',config,AbortSignal.timeout(3000),fetcher);
    if(expected==='gap') { expect(result.answer).toBe(reviewAnswer);expect(result.sources).toEqual([]); }
    else { expect(result.answer).not.toContain('支持一键同步');expect(result.sources).toEqual([]); }
    expect(calls).toBe(expected==='gap'?1:3);
  }
});
const priorTableSource={id:'rankings',title:'2025 测试排名',href:'/wca/results',read:true};
const priorTable={kind:'table' as const,title:'2025 年测试排名',columns:['名次','选手','WCA ID','成绩'],rows:[['1','测试甲','2099TEST01','6.10'],['2','测试乙','2099TEST02','6.25'],['3','测试丙','2099TEST03','6.80']]};
const makePriorContext=()=>{
  const answer={answer:'前三名见表。 [[rankings]]',sources:[priorTableSource],artifacts:[priorTable]};
  rememberAssistantContext(answer,[{call:{tool:'rankings',event:'333',type:'single',country:'',year:2025,limit:3},result:{evidence:{updated:'2026-10-29T00:00:00Z',event:'333',year:2025},sources:[priorTableSource],artifacts:[priorTable]}}],undefined,Date.parse('2026-10-30T00:00:00Z'));
  return assistantAnswerContext(answer)!;
};
it('restores only bounded server-selected evidence and resolves exact displayed row order',()=>{
  const context=makePriorContext();
  expect(context.observations[0].tables[0].rows).toEqual(priorTable.rows);
  expect(resolveAssistantSnapshotAnswer('第二名是谁？',context)?.answer).toContain('测试乙');
  expect(resolveAssistantSnapshotAnswer('第二行是谁？',context)?.answer).toContain('测试乙');
  expect(resolveAssistantSnapshotAnswer('第二名现在的成绩是多少？',context)).toBeUndefined();
  expect(assistantSnapshotReference('第二名现在的成绩是多少？')).toBe(false);
  expect(assistantContextFollowUpCall('他的平均呢？',[{role:'user',content:'第二名是谁？'}],context)).toEqual({tool:'person',wcaId:'2099TEST02',event:'333',progress:false,view:'records',metric:'average',rankings:false});
  expect(assistantContextFollowUpCall('第二名现在还是 6.25 秒吗？',[],context)).toEqual({tool:'rankings',event:'333',type:'single',country:'',year:new Date().getUTCFullYear(),limit:3});
  expect(parseAssistantContext(context,Date.parse(context.expiresAt))).toBeUndefined();
  expect(parseAssistantContext({...context,observations:[{...context.observations[0],sourceIds:['forged']}]},Date.parse(context.createdAt)+1)).toBeUndefined();
  const recentSource={id:'recent',title:'近期数据',href:'/wca/results',read:true};
  const extended=rememberAssistantContext({answer:'再查到一条结果。 [[recent]]',sources:[recentSource],artifacts:[]},[
    {call:{tool:'person',wcaId:'2099TEST04',event:'333',progress:false},result:{evidence:{wcaId:'2099TEST04',name:'测试丁'},sources:[recentSource],artifacts:[]}},
  ],context,Date.parse(context.createdAt)+86400_000);
  expect(assistantAnswerContext(extended)?.expiresAt).toBe(context.expiresAt);
});
it('loads prior context only through the authenticated parent request and conversation tuple',async()=>{
  const context=makePriorContext();
  const run=vi.fn(async()=>[{assistant_context:context}]);
  const restored=await restoreAssistantContext(run,7,'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',Date.parse(context.createdAt)+1);
  expect(restored?.observations[0].tables[0].rows).toEqual(priorTable.rows);
  expect(run.mock.calls[0][0]).toContain('id=? AND user_id=? AND conversation_id=?');
  expect(run.mock.calls[0][1]).toEqual(['bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',7,'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa']);
});
it('does not silently resolve tied ranks or fall back to an older table',()=>{
  const context=makePriorContext();
  context.observations[0].tables[0].rows[2][0]='2';
  expect(resolveAssistantSnapshotAnswer('第二名是谁？',context)).toBeUndefined();
  expect(resolveAssistantSnapshotAnswer('第二行是谁？',context)?.answer).toContain('测试乙');
  const latest=structuredClone(context.observations[0]);latest.tables[0].rows=latest.tables[0].rows.slice(0,1);
  context.observations.push(latest);
  expect(resolveAssistantSnapshotAnswer('第二名是谁？',context)).toBeUndefined();
  expect(resolveAssistantSnapshotAnswer('2026年第二名是谁？',makePriorContext())).toBeUndefined();
});
it('answers a displayed ordinal from the server snapshot and refreshes a new person metric',async()=>{
  const context=makePriorContext(),unused=vi.fn<typeof fetch>().mockRejectedValue(new Error('unexpected provider call'));
  const ordinal=await answerSiteQuestion('第二名是谁？','zh',config,AbortSignal.timeout(3000),unused,[],undefined,undefined,'UTC',[],'fast',{},context);
  expect(ordinal.answer).toContain('测试乙');expect(ordinal.sources[0].id).toBe('rankings');expect(unused).not.toHaveBeenCalled();
  let modelCalls=0;
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    const url=String(input);
    if(url.startsWith(config.baseUrl+'/')) {
      modelCalls++;
      const request=JSON.parse(String(init?.body));
      const payload=JSON.parse(request.messages.find((message:any)=>message.role==='user'&&typeof message.content==='string'&&message.content.startsWith('{')).content);
      expect(payload.question).toBe('他的平均呢？');
      expect(payload.priorEvidence.observations[0].tables[0].rows[1][1]).toBe('测试乙');
      expect(payload.priorEvidence.observations[0].call.year).toBe(2025);
      expect(decodedEvidence(request).some((item:any)=>item.tool?.tool==='person'&&item.tool.wcaId==='2099TEST02'&&item.data.personalRecords?.[0]?.average==='10.50')).toBe(true);
      expect(JSON.stringify(request.messages)).not.toContain('6.25 秒');
      return modelResponse({answerKind:'grounded',answer:'测试乙当前登记的三阶平均是 10.50 秒。',sourceIds:['person:2099TEST02']});
    }
    if(url.startsWith('https://api.cuberoot.me/v1/wca/person-page?')) return Response.json({profile:{person:{name:'测试乙',country_iso2:'CN'},competition_count:4,medals:{},records:{},personal_records:{'333':{single:{best:900,world_rank:1},average:{best:1050,world_rank:2}}}},results:[],comps:[]});
    if(url==='https://api.cuberoot.me/v1/wca/historical-ranks/meta') return Response.json({lastImportedAt:'2026-10-29T00:00:00Z'});
    throw new Error('Unexpected URL '+url);
  });
  const refreshed=await answerSiteQuestion('他的平均呢？','zh',config,AbortSignal.timeout(5000),fetcher,[{role:'user',content:'第二名是谁？'},{role:'assistant',content:'上一轮回答文本不能作为证据。'}],undefined,undefined,'UTC',[],'fast',{},context);
  expect(refreshed.answer).toContain('10.50');expect(refreshed.sources[0].id).toBe('person:2099TEST02:333:average:no-ranks:current');expect(modelCalls).toBe(0);
});
it('refreshes a current ranking instead of reusing the prior year-end value',async()=>{
  const context=makePriorContext();let modelCalls=0;let rankingUrl='';
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    const url=String(input);
    if(url.startsWith(config.baseUrl+'/')) {
      modelCalls++;
      const request=JSON.parse(String(init?.body));
      const payload=JSON.parse(request.messages.find((message:any)=>message.role==='user'&&typeof message.content==='string'&&message.content.startsWith('{')).content);
      expect(payload.question).toBe('第二名现在还是 6.25 秒吗？');
      expect(payload.priorEvidence.observations[0].call.year).toBe(2025);
      expect(decodedEvidence(request).some((item:any)=>item.tool?.tool==='rankings'&&item.data.year===new Date().getUTCFullYear()&&item.data.rows?.[1]?.[1]==='新榜乙')).toBe(true);
      return modelResponse({answerKind:'grounded',answer:'当前排名第二位是新榜乙，成绩为 5.80 秒。 [[rankings]]',sourceIds:['rankings']});
    }
    if(url.startsWith('https://api.cuberoot.me/v1/wca/historical-ranks?')) {
      rankingUrl=url;
      return Response.json({updated:'2026-10-29T00:00:00Z',total:2,rows:[
        {rank:1,name:'新榜甲',wcaId:'2099TEST05',value:560,iso2:'CN',compId:'TESTCOMP1',compName:'测试比赛',compDate:'2026-06-01'},
        {rank:2,name:'新榜乙',wcaId:'2099TEST06',value:580,iso2:'CN',compId:'TESTCOMP1',compName:'测试比赛',compDate:'2026-06-01'},
      ]});
    }
    if(url==='https://api.cuberoot.me/v1/wca/historical-ranks/meta')return Response.json({lastImportedAt:'2026-10-29T00:00:00Z'});
    if(url==='https://static.cuberoot.me/stats/comp_names_zh.json')return Response.json({});
    throw new Error('Unexpected URL '+url);
  });
  const result=await answerSiteQuestion('第二名现在还是 6.25 秒吗？','zh',config,AbortSignal.timeout(5000),fetcher,[{role:'user',content:'显示 2025 年三阶单次排名前三名。'},{role:'assistant',content:'结果见下表。'}],undefined,undefined,'UTC',[],'fast',{},context);
  expect(new URL(rankingUrl).searchParams.get('year')).toBe(String(new Date().getUTCFullYear()));
  expect(result.answer).toContain('新榜乙');expect(result.answer).toContain('5.80');expect(result.sources[0].id).toBe('rankings');expect(modelCalls).toBe(0);
});
it('blocks a stale snapshot answer when the required current read fails',async()=>{
  const context=makePriorContext();let modelCalls=0;
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    const url=String(input);
    if(url.startsWith(config.baseUrl+'/')) {
      modelCalls++;
      return modelResponse({answerKind:'grounded',answer:'第二名現在仍是 6.25 秒。 [[rankings]]',sourceIds:['rankings']});
    }
    if(url==='https://api.cuberoot.me/v1/wca/historical-ranks/meta')return Response.json({lastImportedAt:'2026-10-29T00:00:00Z'});
    if(url.startsWith('https://api.cuberoot.me/v1/wca/historical-ranks?'))throw new Error('synthetic current ranking outage');
    throw new Error('Unexpected URL '+url);
  });
  const result=await answerSiteQuestion('第二名现在还是 6.25 秒吗？','zh',config,AbortSignal.timeout(5000),fetcher,[{role:'user',content:'显示 2025 年三阶单次排名前三名。'}],undefined,undefined,'UTC',[],'fast',{},context);
  expect(result.answer).not.toContain('仍是 6.25');expect(result.answer).toMatch(/无法确认|证据不足/);expect(modelCalls).toBe(0);
});
it('retains the prior result source for non-ordinal contextual follow-ups',async()=>{
  const context=makePriorContext();let calls=0;
  const fetcher=vi.fn<typeof fetch>(async(_input,init)=>{
    const request=JSON.parse(String(init?.body));
    const payload=JSON.parse(request.messages.find((message:any)=>message.role==='user'&&typeof message.content==='string'&&message.content.startsWith('{')).content);
    expect(payload.priorEvidence.observations[0].call.year).toBe(2025);
    const answer={answerKind:'grounded',answer:'刚才表格统计的是 2025 年。',sourceIds:['rankings']};
    calls++;return modelResponse(answer);
  });
  const result=await answerSiteQuestion('刚才那个表统计的哪一年？','zh',config,AbortSignal.timeout(3000),fetcher,[{role:'user',content:'显示 2025 年测试排名。'}],undefined,undefined,'UTC',[],'fast',{},context);
  expect(result.answer).toContain('2025');expect(result.sources[0].id).toBe('rankings');expect(calls).toBe(0);
});
it('renders entry-only answers from verified destinations instead of model-authored URLs',async()=>{
  let calls=0;
  const fetcher=vi.fn<typeof fetch>(async input=>{
    if(String(input).endsWith('/assistant/pages.json'))return Response.json({version:2,updated:'2026-10-10T00:00:00Z',pages:[]});
    return modelResponse(++calls===1?[{tool:'navigation',query:'计时器',kind:'all',pageIds:['timer']}]:{answerKind:'general',answer:'[计时器](https://cuberoot.dev/timer) 支持自动备份',sourceIds:['timer']});
  });
  const result=await answerSiteQuestion('只给我计时器入口链接。','zh',config,AbortSignal.timeout(3000),fetcher);
  expect(result.answer).not.toMatch(/cuberoot.dev|自动备份/);expect(result.actions?.[0].href).toBe('/timer');expect(calls).toBe(2);
});
it('preserves URLs in independently requested code and writing',async()=>{
  const answer='fetch("https://example.com/data").then(r => r.json())';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(modelResponse({answerKind:'general',answer,sourceIds:[]}));
  const result=await answerSiteQuestion('写一个使用我给出的示例地址的 fetch 调用。','zh',config,AbortSignal.timeout(3000),fetcher);
  expect(result.answer).toBe(answer);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('rebuilds a selected exact destination and deduplicates aliases before checking discarded prose',async()=>{
  let calls=0;
  const fetcher=vi.fn<typeof fetch>(async input=>{
    if(String(input).endsWith('/assistant/pages.json'))return Response.json({version:2,updated:'2026-10-10T00:00:00Z',pages:[]});
    return modelResponse(++calls===1?[{tool:'navigation',query:'计时器',kind:'all',pageIds:['timer']}]:{answerKind:'grounded',answer:'未经验证的自动备份 [[forged]] [计时器](/timer)',sourceIds:['/timer','timer']});
  });
  const result=await answerSiteQuestion('只给我计时器入口链接。','zh',config,AbortSignal.timeout(3000),fetcher);
  expect(result.answer).not.toMatch(/自动备份|forged/);
  expect(result.sources).toHaveLength(1);expect(result.actions).toEqual([{id:'timer',title:result.sources[0].title,href:'/timer'}]);
  expect(calls).toBe(2);
});
it('associates an exact Markdown destination with its actual returned source',async()=>{
  let calls=0;
  const fetcher=vi.fn<typeof fetch>(async input=>{
    if(String(input).endsWith('/assistant/pages.json'))return Response.json({version:2,updated:'2026-10-10T00:00:00Z',pages:[]});
    return modelResponse(++calls===1?[{tool:'navigation',query:'计时器',kind:'all',pageIds:['timer']}]:{answerKind:'general',answer:'[计时器](/timer)',sourceIds:[]});
  });
  const result=await answerSiteQuestion('只给我计时器入口链接。','zh',config,AbortSignal.timeout(3000),fetcher);
  expect(result.actions?.[0].href).toBe('/timer');expect(result.sources[0].id).toBe('timer');
});
it.each([
  {answer:'假入口 [[forged]]',sourceIds:['forged']},
  {answer:'[计时器](/timer/unverified)',sourceIds:[]},
])('does not lend a nearby destination to an unverified selection: %j',async draft=>{
  let calls=0;
  const fetcher=vi.fn<typeof fetch>(async input=>{
    if(String(input).endsWith('/assistant/pages.json'))return Response.json({version:2,updated:'2026-10-10T00:00:00Z',pages:[]});
    return modelResponse(++calls===1?[{tool:'navigation',query:'计时器',kind:'all',pageIds:['timer']}]:{answerKind:'general',...draft});
  });
  const result=await answerSiteQuestion('只给我计时器入口链接。','zh',config,AbortSignal.timeout(3000),fetcher);
  expect(result.sources).toEqual([]);expect(result.actions??[]).toEqual([]);expect(result.answer).not.toMatch(/假入口|unverified/);
});
it('preserves a source access challenge during explicit page prefetch',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:403}));
  await expect(answerSiteQuestion('请根据页面资料说明计时器。','zh',config,AbortSignal.timeout(3000),fetcher)).rejects.toMatchObject({code:'source_verification_required'});
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not substitute navigation for an explicitly required but unavailable page',async()=>{
  let calls=0;
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    if(String(input).endsWith('/assistant/pages.json'))return new Response('',{status:404});
    calls++;const body=JSON.parse(String(init?.body));
    if(calls===2)expect(body.tools).toBeUndefined();
    return modelResponse({answerKind:'general',answer:'当前页面资料无法取得，无法确认具体步骤。',sourceIds:[]});
  });
  const result=await answerSiteQuestion('请根据页面资料说明计时器。','zh',config,AbortSignal.timeout(3000),fetcher);
  expect(result.answer).toContain('无法确认');expect(calls).toBe(2);expect(fetcher).toHaveBeenCalledTimes(3);
});
