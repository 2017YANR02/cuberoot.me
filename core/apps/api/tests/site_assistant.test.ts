import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSiteAssistantRoutes as createRoutes } from '../src/routes/site_assistant.js';
import { answerSiteQuestion, assistantConfig, pageText, requestedAssistantLimit } from '../src/utils/site_assistant.js';
import { cubeAgentConfig } from '../src/utils/cube_agents.js';
vi.mock('../src/utils/site_assistant_people.js',()=>({findAssistantPeople:vi.fn(async()=>[{wcaId:'2012PARK03',name:'Max Park',country:'USA'}])}));

const createSiteAssistantRoutes = (deps: Omit<Parameters<typeof createRoutes>[0], 'reserve' | 'authenticate'> & { reserve?: () => Promise<{ allowed: boolean; retryAfter: number }> }) => createRoutes({ authenticate: async () => ({ uid: 1, wcaId: '2017YANR02' }), reserve: async () => ({ allowed: true, retryAfter: 60 }), ...deps });

const config = { key: 'test-secret', baseUrl: 'https://model.example/v1', model: 'qwen3.8-flash' };
beforeEach(()=>{vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.useRealTimers();});
const modelResponse = (value: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
const ask = () => new Request('https://api.example/site-assistant', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Real-IP': '127.0.0.1' },
  body: JSON.stringify({ question: '怎么数帧？', lang: 'zh' }),
});

describe('site assistant grounding', () => {
  it('passes visitor-local time to every model round and applies the resolved competition interval',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2027-01-01T01:00:00Z'));
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async input=>{
      if(String(input).endsWith('/comp_names_zh.json'))return Response.json({});
      if(String(input).endsWith('/all_upcoming_comps.json'))return Response.json([
        {id:'InWeek',name:'In Week 2027',city:'City',country:'US',start_date:'2027-01-04',end_date:'2027-01-04'},
        {id:'Later',name:'Later 2027',city:'City',country:'US',start_date:'2027-01-15',end_date:'2027-01-15'},
      ]);
      const count=fetcher.mock.calls.filter(([url])=>String(url).includes('/chat/completions')).length;
      return modelResponse(count===1?{calls:[{tool:'competitions',query:'',upcoming:true}]}:{answer:'找到这场比赛。',sourceIds:['comp:InWeek']});
    });
    const result=await answerSiteQuestion('下周有哪些比赛？','zh',config,AbortSignal.timeout(5000),withCatalog(fetcher),[],undefined,undefined,'America/Los_Angeles');
    const requests=fetcher.mock.calls.filter(([url])=>String(url).includes('/chat/completions')).map(([,options])=>JSON.parse(String(options?.body)));
    for(const request of requests)expect(JSON.parse(request.messages[1].content)).toMatchObject({now:'2026-12-31',timeContext:{today:'2026-12-31',timeZone:'America/Los_Angeles',periods:[{start:'2027-01-04',end:'2027-01-10'}]}});
    expect(result.sources.map(s=>s.id)).toEqual(['comp:InWeek']);
    expect(result.artifacts?.[0]).toMatchObject({rows:[['In Week','City','US','2027-01-04']]});
  });
  it('passes the validated browser time zone through the authenticated route',async()=>{
    const answer=vi.fn<typeof answerSiteQuestion>().mockResolvedValue({answer:'OK',sources:[]});
    const routes=createSiteAssistantRoutes({answer,config:()=>config,now:()=>0});
    const response=await routes.request('/site-assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'明天有哪些比赛？',lang:'zh',timeZone:'America/Los_Angeles'})});
    expect(response.status).toBe(200);
    expect(answer.mock.calls[0][8]).toBe('America/Los_Angeles');
    const invalid=await routes.request('/site-assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'明天',lang:'zh',timeZone:'invalid'})});
    expect(invalid.status).toBe(400);
  });
  it.each(['WC2025、WC 2023 的日期是什么？','2025年和2023年世锦赛是什么时间？','When were WC2025 and WC 2023 held?'])('answers championship dates from competition records: %s',async question=>{
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);
      if(url.endsWith('/comp_names_zh.json'))return Response.json({});
      if(url.endsWith('/all_upcoming_comps.json'))return Response.json([]);
      if(url.endsWith('/all_past_comps.json'))return Response.json([
        {id:'WC2025',name:'World Championship 2025',city:'Seattle',country:'US',start_date:'2025-07-03',end_date:'2025-07-06'},
        {id:'WC2023',name:'World Championship 2023',city:'Incheon',country:'KR',start_date:'2023-08-12',end_date:'2023-08-15'},
        {id:'Seattle2025',name:'Seattle 2025',city:'Seattle',country:'US',start_date:'2025-01-01',end_date:'2025-01-01'},
      ]);
      throw new Error(`Unexpected request: ${url}`);
    });
    const result=await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(5000),fetcher);
    expect(result.answer).toBe('查到 2 届世锦赛，日期见下表；点击比赛名可查看详情。');
    expect(result.sources.map(s=>s.id)).toEqual(['comp:WC2025','comp:WC2023']);
    expect(result.actions).toBeUndefined();
    expect(result.artifacts[0]).toMatchObject({links:['/wca/comp/WC2025','/wca/comp/WC2023'],columnKinds:['text','text','country','date']});
  });
  it('includes the earliest championship and does not manufacture missing editions',async()=>{
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>Response.json(String(input).endsWith('/all_past_comps.json') ? [
      {id:'WC1982',name:"Rubik's Cube World Championship 1982",city:'Budapest',country:'HU',start_date:'1982-06-05',end_date:'1982-06-05'},
    ] : String(input).endsWith('/comp_names_zh.json') ? {} : []));
    const all=await answerSiteQuestion('历年世锦赛的日期是什么？','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(all.answer).toBe('查到 1 届世锦赛，日期见下表；点击比赛名可查看详情。');
    expect(all.artifacts[0]).toMatchObject({rows:[["Rubik's Cube World Championship",'Budapest','HU','1982-06-05']]});
    const missing=await answerSiteQuestion('WC2021 的日期是什么？','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(missing.answer).toContain('未找到 2021 年世锦赛的日期');
    expect(missing.sources).toEqual([]);
  });
  it.each(['WC 2027','2027年世锦赛的相关信息','世锦赛 2027 在哪办','明年世锦赛在哪里办','Where will next year\'s World Championship be held?'])('reads the official announcement summary before treating %s as a missing competition',async question=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(modelResponse({answer:'暂无比赛信息。'})).mockResolvedValueOnce(modelResponse({answer:'2027 年世锦赛将在瑞典乌普萨拉举办；2025 年 7 月公告未公布日期和报名安排。',sourceIds:['announcement:wc-2027']}));
    const result=await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    const request=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(request.messages[1].content).toContain('瑞典乌普萨拉');
    expect(request.messages[1].content).toContain('未公布具体比赛日期');
    expect(result.actions?.map(a=>a.href)).toEqual(['/wca/wc-2027']);
    expect(result.sources[0].read).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('retains the actual topic when the model searches with a broad paraphrase',async()=>{
    const destinations=[...Array.from({length:15},(_,i)=>({lang:'en',href:`/map-${i}`,title:`Site map ${i}`})),{lang:'en',href:'/dev/architecture',title:'Architecture Atlas'}];
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async input=>{
      if(String(input).includes('/assistant/pages.json')) return Response.json({pages:[],destinations});
      const count=fetcher.mock.calls.filter(([url])=>String(url).includes('/chat/completions')).length;
      return modelResponse(count===1 ? {calls:[{tool:'navigation',query:'site map'}]} : {answer:'Open the architecture page.',sourceIds:['page:/dev/architecture']});
    });
    const result=await answerSiteQuestion('Show me the website architecture','en',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(result.actions?.map(a=>a.href)).toEqual(['/dev/architecture']);
  });
  it('finds general site pages by their descriptions and returns only metadata for restricted entries',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async input=>{
      if(String(input).includes('/assistant/pages.json')) return Response.json({pages:[],destinations:[{lang:'zh',href:'/dev/infrastructure',title:'基础设施',description:'查看网站服务器和设备运行成本。'},{lang:'zh',href:'/admin',title:'管理后台',access:'admin',description:'管理员入口。'}]});
      const count=fetcher.mock.calls.filter(([url])=>String(url).includes('/chat/completions')).length;
      return modelResponse(count===1 ? {calls:[{tool:'navigation',query:'运行成本 管理后台'}]} : {answer:'入口如下，管理后台需要管理员权限。',sourceIds:['page:/dev/infrastructure','page:/admin']});
    });
    const result=await answerSiteQuestion('查看运行成本和管理后台','zh',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(result.actions?.map(a=>a.href)).toEqual(['/dev/infrastructure','/admin']);
    expect(fetcher.mock.calls.filter(([url])=>String(url).includes('/admin'))).toEqual([]);
  });
  it('makes resolved dynamic detail pages available as navigation actions',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(modelResponse({calls:[{tool:'find_person',query:'Max Park'}]})).mockResolvedValueOnce(modelResponse({answer:'打开选手页面。',sourceIds:['person:2012PARK03']}));
    const result=await answerSiteQuestion('打开 Max Park 的选手页面','zh',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(result.actions?.map(a=>a.href)).toEqual(['/wca/persons/2012PARK03']);
  });
  it('keeps library searches separate from training pages',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async (input,init)=>{
      if(String(input).includes('/assistant/pages.json')) return Response.json({pages:[]});
      const count=fetcher.mock.calls.filter(([url])=>String(url).includes('/chat/completions')).length;
      if(count===2) {
        const context=JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
        const destinations=context.evidence[0].data.destinations;
        expect(destinations.every((p:any)=>!p.href.endsWith('/select'))).toBe(true);
        expect(destinations.some((p:any)=>p.href==='/alg/3x3/oll')).toBe(true);
      }
      return modelResponse(count===1 ? {calls:[{tool:'navigation',kind:'algorithms',query:'OLL PLL'}]} : {answer:'打开公式库学习。',sourceIds:['alg:3x3:oll','alg:3x3:pll']});
    });
    const result=await answerSiteQuestion('学习 OLL 和 PLL','zh',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(result.actions?.map(a=>a.href)).toEqual(['/alg/3x3/oll','/alg/3x3/pll']);
  });
  it('opens existing OLL/PLL libraries and trainers without trusting model URLs',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async input=>{
      if(String(input).includes('/assistant/pages.json')) return Response.json({pages:[]});
      const count=fetcher.mock.calls.filter(([url])=>String(url).includes('/chat/completions')).length;
      return modelResponse(count===1 ? {calls:[{tool:'navigation',query:'OLL PLL'}]} : {answer:'打开公式库学习，或进入 PLL 训练。',sourceIds:['alg:3x3:oll','alg:3x3:pll','train:3x3:pll','https://evil.example']});
    });
    const result=await answerSiteQuestion('我要学习三阶 OL 和 PL 公式','zh',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(result.actions?.map(a=>a.href)).toEqual(['/alg/3x3/oll','/alg/3x3/pll','/alg/3x3/pll/select']);
    expect(result.sources.every(s=>s.read===false)).toBe(true);
  });
  it('selects a solver deep link from the published menu and retains context for follow-ups',async()=>{
    const history=[{role:'user' as const,content:'我要二阶求解器'}];
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async (input,init)=>{
      if(String(input).includes('/assistant/pages.json')) return Response.json({pages:[],destinations:[{lang:'zh',href:'/scramble/solver?event=222',title:'二阶求解器'}]});
      expect(JSON.parse(String(init?.body)).messages[1].content).toContain('我要二阶求解器');
      const count=fetcher.mock.calls.filter(([url])=>String(url).includes('/chat/completions')).length;
      return modelResponse(count===1 ? {calls:[{tool:'navigation',query:'二阶求解器'}]} : {answer:'点击打开。',sourceIds:['page:/scramble/solver?event=222']});
    });
    const result=await answerSiteQuestion('打开这个','zh',config,AbortSignal.timeout(5000),withCatalog(fetcher),history);
    expect(result.actions).toEqual([{id:'page:/scramble/solver?event=222',title:'二阶求解器',href:'/scramble/solver?event=222'}]);
  });
  it('does not show navigation actions for an unresolved request',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async input=>{
      if(String(input).includes('/assistant/pages.json')) return Response.json({pages:[]});
      const count=fetcher.mock.calls.filter(([url])=>String(url).includes('/chat/completions')).length;
      return modelResponse(count===1 ? {calls:[{tool:'navigation',query:'训练'}]} : {answer:'你要练习哪一种魔方、哪个阶段？',sourceIds:[]});
    });
    const result=await answerSiteQuestion('生成一个训练器','zh',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(result.actions).toEqual([]);
  });
  it.each(['我去过哪些国家比赛','我参加过哪些国家的比赛','Which countries have I competed in?'])('answers personal countries from the verified viewer instead of the planner or history: %s',async question=>{
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async input=>{
      const url=String(input);
      if(url.includes('/meta')) return Response.json({lastImportedAt:'2026-10-01'});
      expect(url).toBe('https://api.cuberoot.me/v1/wca/person-page?wcaId=2017YANR02');
      return Response.json({profile:{person:{name:'Ruimin Yan (颜瑞民)'}},results:[{competition_id:'A'},{competition_id:'A'},{competition_id:'B'}],comps:[{id:'A',country_iso2:'CN'},{id:'B',country_iso2:'JP'}]});
    });
    const result=await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(5000),fetcher,[{role:'user',content:'Max Park 的全部 PB'}],'2017YANR02');
    expect(result.answer).toContain('颜瑞民在 2 个国家或地区参赛');
    expect(result.artifacts).toEqual([{kind:'table',title:'参赛国家和地区',columns:['国家或地区','比赛数'],rows:[['CN','1'],['JP','1']],links:undefined,columnKinds:['country','text']}]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('asks for identity when personal countries are requested without a linked WCA ID',async()=>{
    const fetcher=vi.fn<typeof fetch>();
    const result=await answerSiteQuestion('我去过哪些国家比赛','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(result.answer).toContain('请提供你的 WCA ID');
    expect(result.artifacts).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reads an explicitly numbered reconstruction even when the planner treats its ID as seconds',async()=>{
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'recons',value:456,limit:1}]}))
      .mockResolvedValueOnce(Response.json({visibility:'public',solution:"R U // PLL"}));
    const result=await answerSiteQuestion('复盘 456 的 PLL 是什么？','zh',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(fetcher.mock.calls[1][0]).toBe('https://api.cuberoot.me/v1/recon/456');
    expect(result.artifacts?.[0]).toMatchObject({rows:[['1','R U // PLL']]});
  });
  it.each(['复盘 4.72 秒','复盘 456 秒','reconstruction 456 seconds','复盘 2026 年的比赛','复盘2026年的比赛'])('does not reinterpret an explicit duration as a reconstruction ID: %s',async question=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(modelResponse({answer:'请选择选手。'}));
    await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('uses the actual reconstruction list summary instead of inventing competition classifications',async()=>{
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'recons',limit:5}]}))
      .mockResolvedValueOnce(Response.json([{id:1,person:'One',rawTime:5,comp:'Competition'}, {id:2,person:'Two',value:6,comp:'Home'}]))
      .mockResolvedValueOnce(modelResponse({answer:'两条均为练习复盘',sourceIds:['recon:1','recon:2']}));
    const result=await answerSiteQuestion('最近五条公开复盘','zh',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(result.answer).toBe('已列出 2 条公开复盘。比赛或练习场景以表格中的原始记录为准。 [[recon:1]] [[recon:2]]');
    expect(result.sources[0].title).toBe('One · 5');
  });
  it('uses the official DeepSeek key without changing the cube comparison provider', () => {
    vi.stubEnv('SITE_ASSISTANT_PROVIDER', 'bailian');
    vi.stubEnv('DEEPSEEK_API_KEY', 'deepseek-test-key');
    vi.stubEnv('DEEPSEEK_MODEL', '');
    vi.stubEnv('SITE_ASSISTANT_API_KEY', 'bailian-test-key');
    vi.stubEnv('SITE_ASSISTANT_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    vi.stubEnv('SITE_ASSISTANT_MODEL', 'qwen3.8-flash');
    const comparisonConfig = cubeAgentConfig();
    vi.stubEnv('SITE_ASSISTANT_PROVIDER', 'deepseek');
    expect(assistantConfig()).toEqual({key:'deepseek-test-key',baseUrl:'https://api.deepseek.com',model:'deepseek-flash'});
    expect(cubeAgentConfig()).toEqual(comparisonConfig);
    vi.stubEnv('DEEPSEEK_API_KEY', '');
    expect(assistantConfig()).toBeNull();
    vi.stubEnv('SITE_ASSISTANT_PROVIDER', 'unknown');
    expect(assistantConfig()).toBeNull();
    vi.stubEnv('SITE_ASSISTANT_PROVIDER', 'bailian');
    expect(assistantConfig()).toEqual({key:'bailian-test-key',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen3.8-flash'});
  });
  it('disables DeepSeek thinking using its official parameter and keeps JSON tool planning', async () => {
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(modelResponse({answer:'请提供要查询的选手。'}));
    await answerSiteQuestion('查选手','zh',{key:'deepseek-test-key',baseUrl:'https://api.deepseek.com',model:'deepseek-flash'},AbortSignal.timeout(5000),withCatalog(fetcher));
    const [url,init]=fetcher.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(init?.headers).toMatchObject({Authorization:'Bearer deepseek-test-key'});
    const body=JSON.parse(String(init?.body));
    expect(body).toMatchObject({model:'deepseek-flash',thinking:{type:'disabled'},response_format:{type:'json_object'},max_tokens:1200});
    expect(body).not.toHaveProperty('enable_thinking');
  });
  it('keeps tabular statistics factual when the final model prose contradicts the actual value',async()=>{
    const model=vi.fn().mockResolvedValueOnce(modelResponse({calls:[{tool:'statistics',id:'example',limit:5}]})).mockResolvedValueOnce(modelResponse({answer:'占据前三席',sourceIds:['stat:example']}));
    const fetcher:typeof fetch=async url=>String(url).endsWith('/index.json')?Response.json({categories:[{stats:[{id:'example',titleZh:'屠榜',titleEn:'Dominance'}]}]}):String(url).endsWith('/example.json')?Response.json({titleZh:'屠榜',header:[{key:'count',label:'Count',labelZh:'次数'}],rows:[[1]]}):model();
    const result=await answerSiteQuestion('查询屠榜前五项','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(result.answer).toBe('已列出“屠榜”的 1 项查询结果。 [[stat:example]]');
    expect(result.artifacts?.[0]).toMatchObject({rows:[['1']]});
  });
  it('does not relabel ZBLS/ZBLL annotations as OLL/PLL from model memory',async()=>{
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'recon',id:2763}]}))
      .mockResolvedValueOnce(Response.json({visibility:'public',solution:"R U // GR/ZBLS\nR U R' // ZBLL-T6"}));
    const result=await answerSiteQuestion('复盘 2763 使用了什么 OLL 和 PLL？','zh',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(result.answer).toContain('没有独立的 OLL/PLL 标注');
    expect(result.answer).toContain('GR/ZBLS / ZBLL-T6');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.artifacts?.[0]).toMatchObject({rows:[['1','R U // GR/ZBLS'],['2',"R U R' // ZBLL-T6"]]});
  });
  it('renders actual scope choices when requested first, without inventing a ranking or spending another model call',async()=>{
    const index={categories:[{stats:[{id:'example',titleZh:'示例',titleEn:'Example'}]}]};
    const model=vi.fn(async()=>modelResponse({calls:[{tool:'statistics',id:'example',limit:5}]}));
    const fetcher:typeof fetch=async url=>String(url).endsWith('/index.json')?Response.json(index):String(url).endsWith('/example.json')?Response.json({sections:[{title:'World',rows:[[1]]},{title:'Asia',rows:[[2]]}]}):model();
    const result=await answerSiteQuestion('先说明可选条件','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(model).toHaveBeenCalledTimes(1);
    expect(result.artifacts).toEqual([{kind:'table',title:'可选统计条件',columns:['条件组合'],rows:[['World'],['Asia']]}]);
    expect(result.answer).toContain('2 个可用分表');
  });
  it('reads an explicitly named statistic before accepting an unevidenced model clarification',async()=>{
    const model=vi.fn(async()=>modelResponse({answer:'Please choose a country.'}));
    const fetcher:typeof fetch=async url=>String(url).endsWith('/index.json')?Response.json({categories:[{stats:[{id:'known_stat',titleEn:'Known statistic',titleZh:'已知统计'}]}]}):String(url).endsWith('/known_stat.json')?Response.json({sections:[{title:'Single',rows:[[1]]},{title:'Average',rows:[[2]]}]}):model();
    const result=await answerSiteQuestion('已知统计，先说明可选条件','zh',config,AbortSignal.timeout(5000),fetcher);
    expect(result.sources[0].id).toBe('stat:known_stat');
    expect(result.answer).not.toContain('country');
    expect(result.artifacts?.[0]).toMatchObject({rows:[['Single'],['Average']]});
    expect(model).toHaveBeenCalledTimes(1);
  });
  it('honors explicit result counts without confusing event names or metric names',()=>{
    for(const question of ['最近的五条公开复盘','接下来中国的五场 WCA 比赛','轮次前三成绩和的前五项','排名前5名']) expect(requestedAssistantLimit(question)).toBe(5);
    expect(requestedAssistantLimit('三阶最好成绩')).toBeUndefined();
    expect(requestedAssistantLimit('轮次前三成绩和')).toBeUndefined();
    expect(requestedAssistantLimit('前十二名')).toBe(12);
  });
  it('requires name resolution before fetching a model-invented person ID', async () => {
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'person',wcaId:'2023GENG01'}]}))
      .mockResolvedValueOnce(modelResponse({answer:'Please clarify the person.'}));
    await answerSiteQuestion('耿暄一的成绩','zh',config,AbortSignal.timeout(5000), withCatalog(fetcher));
    expect(fetcher.mock.calls.map(([url])=>url)).toEqual([config.baseUrl+'/chat/completions',config.baseUrl+'/chat/completions']);
    expect(String(fetcher.mock.calls[1][1]?.body)).toContain('Use find_person');
  });
  it.each(['他的全部官方pb', 'Show all his official PBs'])('retries an unresolved person after name resolution and renders all PBs: %s', async question => {
    const call={tool:'person',wcaId:'2012PARK03',event:'333',progress:false};
    const model=vi.fn()
      .mockResolvedValueOnce(modelResponse({calls:[call]}))
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'find_person',query:'Max Park'}]}))
      .mockResolvedValueOnce(modelResponse({calls:[call]}))
      .mockResolvedValueOnce(modelResponse({answer:'Only 3x3 is available.',sourceIds:['person:2012PARK03']}));
    const read=vi.fn(async(input:Parameters<typeof fetch>[0],init?:RequestInit)=>{
      if(String(input).startsWith(config.baseUrl))return model(input,init);
      if(String(input).includes('/meta'))return Response.json({lastImportedAt:'2026-10-01'});
      return Response.json({profile:{person:{name:'Max Park'},personal_records:{333:{single:{best:313},average:{best:500}},222:{single:{best:100},average:{best:200}}}}});
    });
    const lang=question.startsWith('Show')?'en':'zh';
    const result=await answerSiteQuestion(question,lang,config,AbortSignal.timeout(5000),withCatalog(read),[
      {role:'user',content:'查看 Max Park 的成绩'},
      {role:'assistant',content:'选手是 Max Park（2012PARK03）。'},
    ],'2017YANR02');
    expect(model).toHaveBeenCalledTimes(4);
    expect(read.mock.calls.filter(([url])=>String(url).includes('/person-page'))).toHaveLength(1);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]).toMatchObject({kind:'table',rows:[
      [lang==='zh'?'三阶':'3×3','3.13','—','5.00','—'],
      [lang==='zh'?'二阶':'2×2','1.00','—','2.00','—'],
    ]});
    expect(result.answer).toBe(lang==='zh'?'已列出Max Park全部 2 个有成绩项目的官方个人最佳成绩。 [[person:2012PARK03]]':"Showing Max Park's official personal bests for all 2 events with results. [[person:2012PARK03]]");
    const context=JSON.parse(JSON.parse(String(model.mock.calls[3][1]?.body)).messages[1].content);
    expect(context.evidence.at(-1).tool).toMatchObject({event:'all'});
    expect(context.evidence.at(-1).data.personalRecords.map((r:{event:string})=>r.event)).toEqual(['333','222']);
  });
  it('deduplicates successful normalized person reads and classifies a stalled planner as a model failure', async () => {
    const model=vi.fn()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'person',wcaId:'2012PARK03'}]}))
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'person',wcaId:'2012PARK03',event:'333',progress:false}]}))
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'person',wcaId:'2012PARK03',event:'333'}]}));
    const fetcher=vi.fn(async(input:Parameters<typeof fetch>[0],init?:RequestInit)=>String(input).startsWith(config.baseUrl)?model(input,init):Response.json(String(input).includes('/meta')?{lastImportedAt:'2026-10-01'}:{profile:{person:{name:'Max Park'},personal_records:{333:{single:{best:313},average:{best:500}}}}}));
    await expect(answerSiteQuestion('2012PARK03 的三阶 PB','zh',config,AbortSignal.timeout(5000),withCatalog(fetcher))).rejects.toMatchObject({code:'model_unavailable'});
    expect(fetcher.mock.calls.filter(([url])=>String(url).includes('/person-page'))).toHaveLength(1);
    expect(model).toHaveBeenCalledTimes(3);
  });
  it('only renders artifacts belonging to the final cited sources', async () => {
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'records',event:'222'},{tool:'records',event:'333'}]}))
      .mockResolvedValueOnce(Response.json({rows:[
        {e:'222',t:'s',v:40,p:'2023TEST01',pn:'Test Person',c:'Test2026',cn:'Test',d:'2026-01-01'},
        {e:'333',t:'s',v:280,p:'2023TEST01',pn:'Test Person',c:'Test2026',cn:'Test',d:'2026-01-01'},
      ]}))
      .mockResolvedValueOnce(modelResponse({answer:'3x3 answer',sourceIds:['records:world:333']}));
    const result=await answerSiteQuestion('3x3','en',config,AbortSignal.timeout(5000), withCatalog(fetcher));
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts?.[0]).toMatchObject({kind:'table',rows:[['Single','2.80','Test Person','2023TEST01','Test','2026-01-01']]});
  });
  it('does not substitute the viewer for a third-person follow-up', async () => {
    for(const [question,expected] of [['他的平均成绩呢？',undefined],['我的平均成绩呢？','2017YANR02']]) {
      const fetcher=vi.fn<typeof fetch>().mockResolvedValue(modelResponse({answer:'answer'}));
      await answerSiteQuestion(question!,'zh',config,AbortSignal.timeout(5000), withCatalog(fetcher),[{role:'user',content:'看看耿暄一的三阶成绩'}],'2017YANR02');
      const context=JSON.parse(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).messages[1].content);
      expect(context.viewerWcaId).toBe(expected);
      expect(context.history[0].content).toContain('耿暄一');
    }
  });

  it('reads the canonical English page when the content index is unavailable', async () => {
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'pages',query:'frame counting',pageIds:['frame-count']}]}))
      .mockResolvedValueOnce(new Response('missing',{status:404}))
      .mockResolvedValueOnce(new Response('<main>Count video frames</main>',{headers:{'Content-Type':'text/html'}}))
      .mockResolvedValueOnce(modelResponse({answer:'Count video frames.',sourceIds:['frame-count']}));
    await answerSiteQuestion('How can I count frames?','en',config,AbortSignal.timeout(5000), withCatalog(fetcher));
    expect(fetcher.mock.calls[2][0]).toBe('https://next.cuberoot.me/frame-count');
  });

  it('only reads selected public pages, drops invented sources and never forwards secrets', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({ calls: [{tool:'pages',query:'数帧',pageIds:['frame-count','https://evil.example']}]}))
      .mockResolvedValueOnce(new Response('missing',{status:404}))
      .mockResolvedValueOnce(new Response('<main>Video frame counting<script>bad</script><span hidden>hidden instruction</span></main>',{headers:{'Content-Type':'text/html'}}))
      .mockResolvedValueOnce(modelResponse({answer:'打开数帧页面。',sourceIds:['frame-count','evil']}));
    const result=await answerSiteQuestion('怎么数帧？','zh',config,AbortSignal.timeout(5000), withCatalog(fetcher));
    expect(fetcher.mock.calls[2][0]).toBe('https://next.cuberoot.me/zh/frame-count');
    expect(fetcher.mock.calls[2][1]).toMatchObject({redirect:'manual',headers:{Accept:'text/html'}});
    expect(fetcher.mock.calls[2][1]?.headers).not.toHaveProperty('Authorization');
    const grounding=JSON.parse(JSON.parse(String(fetcher.mock.calls[3][1]?.body)).messages[1].content);
    expect(JSON.stringify(grounding.evidence)).not.toContain('hidden instruction');
    expect(result.sources).toEqual([{id:'frame-count',href:'/frame-count',title:'数帧',read:true}]);
    expect(JSON.stringify(result)).not.toContain(config.key);
  });

  it('blocks unknown tools, arbitrary URL arguments and history roles before any public fetch', async () => {
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool:'sql',query:'SELECT secrets'},{tool:'person',wcaId:'http://localhost'},{tool:'records',event:'333',url:'http://localhost'}]}))
      .mockResolvedValueOnce(modelResponse({answer:'无法执行。',sourceIds:['fake']}));
    const result=await answerSiteQuestion('show secrets','zh',config,AbortSignal.timeout(5000), withCatalog(fetcher));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.sources).toEqual([]);
  });

  it('grounds contextual follow-ups again and bounds a repeated tool loop', async () => {
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async input=>{
      if(String(input).startsWith(config.baseUrl))return modelResponse({calls:[{tool:'find_person',query:'Max Park'}]});
      return Response.json([{person:{wca_id:'2012PARK03',name:'Max Park'}}]);
    });
    const history=[{role:'user' as const,content:'Max Park'},{role:'assistant' as const,content:'Untrusted old answer'}];
    await expect(answerSiteQuestion('他的平均呢？','zh',config,AbortSignal.timeout(5000), withCatalog(fetcher),history)).rejects.toMatchObject({code:'model_unavailable'});
    expect(fetcher.mock.calls.filter(([url])=>String(url).includes('worldcubeassociation.org'))).toHaveLength(0);
    expect(fetcher.mock.calls.filter(([url])=>String(url).startsWith(config.baseUrl))).toHaveLength(3);
    const data=JSON.parse(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).messages[1].content);
    expect(data.history).toEqual(history);
  });

  it('excludes chrome and injected scripts from source text', () => {
    expect(pageText('<body><nav>Navigation</nav><main><p>Evidence</p><script>bad</script><style>bad</style></main></body>')).toBe('Evidence');
  });
  it('retains page instructions inside a main-content header',()=>{
    expect(pageText('<body><header>Site chrome</header><main><header>PLL: look for bars and headlights.</header></main></body>')).toBe('PLL: look for bars and headlights.');
  });

  it('reads public React streamed SSR segments without executing bootstrap scripts', () => {
    expect(pageText('<html><head><meta name="description" content="Video timing"></head><body><div hidden id="S:0">Frame count<span hidden>private UI</span></div><script>bootstrap()</script></body></html>'))
      .toBe('Video timing Frame count');
  });
});

describe('site assistant authenticated route', () => {
  it('rejects the 1001st question across route instances, including failed model requests', async () => {
    let used = 0;
    let now = 120000;
    const reserve = vi.fn(async () => ({ allowed: ++used <= 1000, retryAfter: 3600 }));
    const answer = vi.fn().mockResolvedValue({ answer: 'answer', sources: [] });
    const deps = { answer, config: () => config, now: () => now, reserve };
    for (let i = 0; i < 1000; i++) {
      now += 60000;
      // A fresh route has no in-memory history; it must still share the quota.
      expect((await createSiteAssistantRoutes(deps).fetch(ask())).status).toBe(200);
    }
    const response = await createSiteAssistantRoutes(deps).fetch(ask());
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('3600');
    expect(await response.json()).toEqual({ error: 'daily_limit' });
    expect(answer).toHaveBeenCalledTimes(1000);
    used = 999;
    answer.mockRejectedValue(new Error('upstream failure'));
    expect((await createSiteAssistantRoutes(deps).fetch(ask())).status).toBe(503);
    expect((await createSiteAssistantRoutes(deps).fetch(ask())).status).toBe(429);
    expect(answer).toHaveBeenCalledTimes(1001);
  });

  it('fails closed when the persistent quota cannot be read', async () => {
    const answer = vi.fn();
    const route = createSiteAssistantRoutes({ answer, config: () => config, now: Date.now,
      reserve: async () => { throw new Error('database unavailable'); } });
    expect((await route.fetch(ask())).status).toBe(503);
    expect(answer).not.toHaveBeenCalled();
  });

  it('rejects oversized, malformed and unexpected fields before spending tokens', async () => {
    const answer = vi.fn();
    const route = createSiteAssistantRoutes({ answer, config: () => config, now: () => 120000 });
    for (const body of ['not json', JSON.stringify({ question: 'x'.repeat(501), lang: 'zh' }), JSON.stringify({ question: 'hello', lang: 'en', url: 'http://localhost' })]) {
      expect((await route.request('/site-assistant', { method: 'POST', body })).status).toBe(400);
    }
    expect((await route.request('/site-assistant', { method: 'POST', body: 'x'.repeat(70001) })).status).toBe(413);
    expect(answer).not.toHaveBeenCalled();
  });

  it('disables cleanly without configuration and never exposes provider errors', async () => {
    const answer = vi.fn().mockRejectedValue(new Error('provider leaked test-secret'));
    const disabled = createSiteAssistantRoutes({ answer, config: () => null, now: Date.now });
    expect((await disabled.fetch(ask())).status).toBe(503);
    expect(answer).not.toHaveBeenCalled();
    const route = createSiteAssistantRoutes({ answer, config: () => config, now: Date.now });
    const response = await route.fetch(ask());
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'unavailable' });
  });

  it('caps authenticated spend and recovers after the quota window', async () => {
    let now = 120000;
    const answer = vi.fn().mockResolvedValue({ answer: 'answer', sources: [] });
    const route = createSiteAssistantRoutes({ answer, config: () => config, now: () => now });
    for (let i = 0; i < 6; i++) expect((await route.fetch(ask())).status).toBe(200);
    expect((await route.fetch(ask())).status).toBe(429);
    expect(answer).toHaveBeenCalledTimes(6);
    now += 60000;
    expect((await route.fetch(ask())).status).toBe(200);
  });

  it('bounds concurrency and releases slots after failed requests', async () => {
    let reject!: (reason: Error) => void;
    const pending = new Promise<never>((_resolve, fail) => { reject = fail; });
    const answer = vi.fn().mockReturnValue(pending);
    const route = createSiteAssistantRoutes({ answer, config: () => config, now: Date.now });
    const requests = Array.from({ length: 4 }, () => route.fetch(ask()));
    await vi.waitFor(() => expect(answer).toHaveBeenCalledTimes(4));
    expect((await route.fetch(ask())).status).toBe(429);
    reject(new Error('upstream unavailable'));
    expect((await Promise.all(requests)).map(response => response.status)).toEqual([503, 503, 503, 503]);
    answer.mockResolvedValue({ answer: 'restored', sources: [] });
    expect((await route.fetch(ask())).status).toBe(200);
  });
});

const withCatalog = (fetcher: typeof fetch): typeof fetch => (url, init) => String(url)==='https://static.cuberoot.me/stats/index.json' ? Promise.resolve(Response.json({categories:[]})) : fetcher(url,init);
