import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSiteAssistantRoutes as createRoutes } from '../src/routes/site_assistant.js';
import { answerSiteQuestion, assistantConfig, pageText, requestedAssistantLimit } from '../src/utils/site_assistant.js';
import { cubeAgentConfig } from '../src/utils/cube_agents.js';
vi.mock('../src/utils/site_assistant_people.js',()=>({findAssistantPeople:vi.fn(async()=>[{wcaId:'2012PARK03',name:'Max Park',country:'USA'}])}));

const createSiteAssistantRoutes = (deps: Omit<Parameters<typeof createRoutes>[0], 'reserve' | 'authenticate'> & { reserve?: () => Promise<{ allowed: boolean; retryAfter: number }> }) => createRoutes({ authenticate: async () => ({ uid: 1, wcaId: '2017YANR02' }), reserve: async () => ({ allowed: true, retryAfter: 60 }), ...deps });

const config = { key: 'test-secret', baseUrl: 'https://model.example/v1', model: 'qwen3.8-flash' };
beforeEach(()=>{vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
const modelResponse = (value: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
const ask = () => new Request('https://api.example/site-assistant', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Real-IP': '127.0.0.1' },
  body: JSON.stringify({ question: '怎么数帧？', lang: 'zh' }),
});

describe('site assistant grounding', () => {
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
