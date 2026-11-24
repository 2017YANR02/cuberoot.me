import { describe, it, expect, vi } from 'vitest';
import { answerSiteQuestion, requestedAssistantLimit } from '../src/utils/site_assistant.js';
import { publicLeaderboard, needsScopedLeaderboard, worldsFinalRequest, publicReadCache, fourthsUrl } from '../src/utils/site_assistant_public_queries.js';

const fourth='按 WCA 正式比赛结果，全项目合计，职业生涯在决赛拿第四名次数最多的前三位选手是谁？列姓名和次数，同场不同项目分开计。';
const annual='历史上同一个自然年参加 WCA 正式比赛最多的前三位选手是谁？列姓名、年份、不同比赛数，每人只取最好的一年。';
const worlds='只看 WCA World Championship 2025 三阶决赛，谁拿了第四名？他和铜牌的平均成绩分别是多少，相差几秒？';
const data={title:'Most fourth places',header:[{key:'4th_places'},{key:'person'}],rows:[[9,'Player One'],[8,'Player Two'],[7,'Player Three'],[6,'Player Four']]};
describe('published assistant rankings',()=>{
  it.each([fourth,'职业生涯在比赛中取第四名次数最多的前三名','生涯第四名榜','世界上哪些选手拿过最多的决赛第四名？列前五。','第四名次数最多的是谁？','Who has the most fourth place finishes across all events?'])('recognizes a global request: %s',question=>{
    expect(publicLeaderboard(question)).toBe('fourths');
  });
  it('distinguishes a calendar year record from an annualized rate',()=>{
    expect(publicLeaderboard(annual)).toBe('annual');
    expect(publicLeaderboard('历史上谁一年之内参加的正式魔方比赛最多？给前三名和各自年份。')).toBe('annual');
    expect(publicLeaderboard('Who attended the most distinct competitions in a single calendar year? Top 3 cubers')).toBe('annual');
    expect(publicLeaderboard('同一自然年参加决赛最多的前三位')).toBeUndefined();
    expect(publicLeaderboard('每年平均参赛最多的是谁？')).toBeUndefined();
    expect(publicLeaderboard('职业生涯殿军次数最多的前三人是谁？')).toBe('fourths');
  });
  it.each(['仅限现役项目','指定三阶','计入所有轮次','2025年','仅芬兰选手','包括 DNF','同时列出第二名次数'])('preserves added scope: %s',qualifier=>{
    expect(publicLeaderboard(fourth+qualifier)).toBeUndefined();
    expect(needsScopedLeaderboard(fourth+qualifier,'fourths')).toBe(true);
  });
  it('checks the final, event and requested metric',()=>{
    expect(worldsFinalRequest(worlds)).toBe('WC2025');
    expect(worldsFinalRequest(worlds+'仅限女子')).toBeUndefined();
    expect(worldsFinalRequest(worlds+'再列前十')).toBeUndefined();
  });
  it('supports a standalone limit without truncating a larger request',()=>{
    expect(requestedAssistantLimit('最多的前三')).toBe(3);
    expect(requestedAssistantLimit('top 12 cubers')).toBe(12);
    expect(requestedAssistantLimit('前100名')).toBeUndefined();
  });
  it.each([{history:[]},{history:[{role:'user' as const,content:'我的 WCA 排名是多少？'},{role:'assistant' as const,content:'你的个人排名如下。'}]}])('reads one file and never asks a model, including after a personal ranking',async({history})=>{
    const fetcher=vi.fn(async(url:RequestInfo|URL)=>{
      expect(String(url)).toBe(fourthsUrl);
      return Response.json(data);
    });
    const result=await answerSiteQuestion(fourth,'zh',{key:'test',model:'fixture',baseUrl:'https://model.invalid'},AbortSignal.timeout(4000),fetcher,history,'2099TEST01');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.answer).toMatch(/Player One.*9/);
    expect(result.answer).toContain('Player Three');
    expect(result.answer).not.toContain('Player Four');
    expect(result.answer).toContain('有效成绩');
    expect(result.sources[0].id).toBe('stat:most_4th_places');
  });
  it.each([
    ['我想练三阶 PLL 识别。请给你所在网站一个可以直接打开的专项训练入口，并说进去后第一步怎么做。','/recognize/pll','空格'],
    ['什么是 CFOP 里的 F2L？给刚学完层先法的人一个不用计时、今天花 10 分钟就能做的练习。','','白红绿角配红绿棱'],
    ['三阶一轮五把依次是 10.00、11.00、12.00、13.00 秒和 DNF。WCA 平均是多少？如果把 13.00 也改成 DNF，平均又是多少？请说明怎么算。','','12.00 秒'],
  ])('answers the training or calculation request without a model',async(question,href,expected)=>{
    const fetcher=vi.fn<typeof fetch>();
    const answer=await answerSiteQuestion(question,'zh',{key:'test',model:'fixture',baseUrl:'https://model.invalid'},AbortSignal.timeout(2000),fetcher);
    expect(answer.answer).toContain(expected);
    if(href)expect(answer.actions?.[0].href).toBe(href);
    if(question.includes('DNF'))expect(answer.answer).toMatch(/改为 DNF 后，ao5 = DNF/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('lets one visitor cancel while another waits for the same public file',async()=>{
    let release!:()=>void,started!:()=>void;
    const wait=new Promise<void>(resolve=>{release=resolve;});
    const reading=new Promise<void>(resolve=>{started=resolve;});
    const fetcher=vi.fn<typeof fetch>(async(url,init)=>{
      expect(String(url)).toBe(fourthsUrl);
      started();await wait;
      expect(init?.signal?.aborted).toBe(false);
      return Response.json(data);
    });
    vi.stubGlobal('fetch',fetcher);
    const controller=new AbortController();
    const ask=(signal:AbortSignal)=>answerSiteQuestion(fourth,'zh',{key:'test',model:'fixture',baseUrl:'https://model.invalid'},signal);
    try {
      const first=ask(controller.signal);
      await reading;
      const second=ask(AbortSignal.timeout(2000));
      controller.abort();await expect(first).rejects.toThrow();
      release();
      expect((await second).answer).toContain('Player Three');
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {release();vi.unstubAllGlobals();}
  });
  it('shares simultaneous reads and releases failed reads',async()=>{
    const cached=publicReadCache<number>(1000);
    const fail=vi.fn(async()=>{throw Error('unavailable');});
    await Promise.all([expect(cached(fail)).rejects.toThrow(),expect(cached(fail)).rejects.toThrow()]);
    const load=vi.fn(async()=>42);
    expect(await Promise.all([cached(load),cached(load)])).toEqual([42,42]);
    expect([fail.mock.calls.length,load.mock.calls.length]).toEqual([1,1]);
  });
});

describe('round details and retained attempts',()=>{
  const first='2025 年世锦赛三阶决赛，铜牌与第四名的平均差多少？请按比赛顺序列出两人各自的五把，标出不计入平均的两把，并给两人的 WCA 主页。';
  const follow='只看刚才这两个人在这场决赛的第 2 把，谁更快，快多少秒？请只用一句话回答。';
  const rows=[
    {pos:3,name:'Tymon Kolasiński',wca_id:'2016KOLA02',best:461,average:498,attempts:[461,489,531,474,580]},
    {pos:4,name:'Qixian Cao (曹岂娴)',wca_id:'2023CAOQ01',best:441,average:543,attempts:[700,503,572,441,555]},
  ].map(row=>({...row,event_id:'333',competition_id:'WC2025',format_id:'a',round_type_id:'f'}));
  it('uses source-backed rows across turns and reads the new round for the same people',async()=>{
    const {assistantAnswerContext,parseAssistantContext}=await import('../src/utils/site_assistant_context.js');
    const {compareRoundAttempt}=await import('../src/utils/site_assistant_round.js');
    const db=await import('../src/db/connection.js');
    const noImport=vi.spyOn(db,'withTransaction').mockRejectedValue(Error('local import offline'));
    const http=vi.fn<typeof fetch>(async url=>{
      expect(String(url)).toBe('https://www.worldcubeassociation.org/api/v0/competitions/WC2025/results/333');
      return Response.json({id:'333',rounds:[{roundTypeId:'f',results:rows},{roundTypeId:'2',results:rows.map((r,i)=>({...r,round_type_id:'2',pos:15-i,attempts:[100,531+69*i,100,100,100]}))}]});
    });
    const cfg={key:'unused',baseUrl:'https://model.invalid',model:'unused'},signal=AbortSignal.timeout(5000);
    try {
      const a=await answerSiteQuestion(first,'zh',cfg,signal,http);
      expect(a.answer).toContain('(4.61) · 4.89 · 5.31 · 4.74 · (5.80)');
      expect(a.answer).toContain('0.45 秒');
      expect(a.sources.map(s=>s.href)).toContain('https://www.worldcubeassociation.org/persons/2023CAOQ01');
      const ctx=parseAssistantContext(JSON.parse(JSON.stringify(assistantAnswerContext(a))));
      const hist=[{role:'user' as const,content:first},{role:'assistant' as const,content:a.answer}];
      const b=await answerSiteQuestion(follow,'zh',cfg,signal,http,hist,undefined,undefined,'UTC',[],'auto',{},ctx);
      expect(b.answer).toContain('0.14 秒');expect(noImport).toHaveBeenCalledTimes(1);expect(http).toHaveBeenCalledTimes(1);
      const c=await answerSiteQuestion('换成半决赛，这两人第 2 把谁更快，快多少秒？','zh',cfg,signal,http,hist,undefined,undefined,'UTC',[],'auto',{},assistantAnswerContext(b));
      expect(c.answer).toContain('0.69 秒');expect(http).toHaveBeenCalledTimes(2);
      const never=vi.fn();
      expect(await compareRoundAttempt(follow,'zh',[],undefined,never)).toBeUndefined();
      expect(await compareRoundAttempt('四阶决赛第 2 把谁更快？','zh',hist,ctx,never)).toBeUndefined();
      const range='只比较刚才那两人：把每人的最慢一把减去最快一把，谁的差值更小？列出两人的差值，精确到百分之一秒。';
      const ready=structuredClone(ctx)!;
      const saved=ready.observations.at(-1)!.roundRows!;
      saved[0].attempts=[0,500,-1,500,-2];
      saved[1].attempts=[500,500,0,-2,-1];
      expect((await compareRoundAttempt(range,'zh',hist,ready,never))?.result.factualSummary).toMatch(/并列.*0.00 秒.*0.00 秒/);
      expect((await compareRoundAttempt('What is the range of valid times for each of those two competitors, and who has the smaller range?','en',hist,ready,never))?.result.factualSummary).toContain('tied');
      saved[1].attempts=[500,450,0,-2,-1];
      expect((await compareRoundAttempt('两人最快有效单次分别是多少？','zh',hist,ready,never))?.result.factualSummary).toContain('4.50');
      expect((await compareRoundAttempt('两人最慢一把分别是多少？','zh',hist,ready,never))?.result.factualSummary).toContain('并列');
      saved[1].attempts=[0,-1,-2,450,0];
      expect((await compareRoundAttempt(range,'zh',hist,ready,never))?.result.factualSummary).toContain('有效成绩不足');
      expect(await compareRoundAttempt('两人的极差与平均各是多少？','zh',hist,ready,never)).toBeUndefined();
      expect(never).not.toHaveBeenCalled();
    } finally {noImport.mockRestore();}
  });
  it('brackets exactly two for a valid Ao5, preserves failure statuses and respects the round format',async()=>{
    const {attemptCells}=await import('../src/utils/site_assistant_round.js');
    const row=rows[0];
    expect(attemptCells({...row,attempts:[500,500,500,500,500]},'333')).toEqual(['(5.00)','5.00','5.00','5.00','(5.00)']);
    expect(attemptCells({...row,attempts:[500,500,-1,510,520]},'333')).toEqual(['(5.00)','5.00','(DNF)','5.10','5.20']);
    expect(attemptCells({...row,average:-1,attempts:[500,-2,-1,510,520]},'333')).toEqual(['5.00','DNS','DNF','5.10','5.20']);
    expect(attemptCells({...row,format_id:'m',attempts:[28,29,30,0,0]},'333fm')).toEqual(['28','29','30']);
    expect(attemptCells({...row,format_id:'3',attempts:[100,99,-1]},'333')).toEqual(['1.00','0.99','DNF']);
  });
});

it('routes named competitions and different round formats while preserving unsupported filters',async()=>{
  const {standingsRequest}=await import('../src/utils/site_assistant_round.js');
  const question='WC2025 六阶决赛，前两名每人的三把依次是多少？请给出这两人的 WCA 主页。';
  expect(standingsRequest(question,2)).toEqual({tool:'competition_round',compId:'WC2025',event:'666',round:'final',limit:2,details:true});
  expect(standingsRequest(question+'只算中国选手',2)).toBeUndefined();
  expect(standingsRequest('WC2025 六阶决赛最佳单次前两名',2)).toBeUndefined();
});

describe('World Championship standings from natural questions',()=>{
  const question='上一次魔方世锦赛中三阶速拧前三名分别是谁？他们的成绩又是多少？';
  const past={id:'WC2025',championship_types:['world'],end_date:'2025-07-06'};
  const future={id:'WC2027',championship_types:['world'],end_date:'2027-07-25'};
  const podium=[
    {event_id:'333',pos:3,best:461,average:498,name:'Tymon Kolasiński',wca_id:'2016KOLA02'},
    {event_id:'333',pos:1,best:380,average:423,name:'Yiheng Wang (王艺衡)',wca_id:'2019WANY36'},
    {event_id:'333',pos:2,best:395,average:449,name:'Xuanyi Geng (耿暄一)',wca_id:'2023GENG02'},
  ].map(row=>({...row,competition_id:'WC2025',format_id:'a',round_type_id:'f'}));
  it('resolves the completed edition by end date, ignoring cancelled and unrelated competitions',async()=>{
    const {latestCompletedWorlds}=await import('../src/utils/site_assistant_round.js');
    const read=vi.fn().mockResolvedValue([future,{...future,id:'WC2026',end_date:'2026-05-02',cancelled_at:'2026-05-01'},past,{id:'LocalWorldChampionship2026',championship_types:['US'],end_date:'2026-05-03'}]);
    const signal=AbortSignal.timeout(2000);
    expect(await latestCompletedWorlds('2026-11-23',read,signal)).toBe('WC2025');
    expect(await latestCompletedWorlds('2027-07-25',read,signal)).toBe('WC2025');
    expect(await latestCompletedWorlds('2027-07-26',read,signal)).toBe('WC2027');
    expect(await latestCompletedWorlds('2031-12-01',vi.fn().mockResolvedValue([past,{...future,id:'RubiksWorlds2031',end_date:'2031-06-01'}]),signal)).toBe('RubiksWorlds2031');
    expect(await latestCompletedWorlds('2026-11-23',vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue([past]),signal)).toBe('WC2025');
  });
  it('keeps explicit rounds, ranking metrics, and demographic filters distinct',async()=>{
    const {standingsRequest}=await import('../src/utils/site_assistant_round.js');
    for(const q of [question,'上届世锦赛三阶前三是谁？','上届世锦赛三阶谁拿了金牌、银牌和铜牌？请列出姓名和成绩。','Who were the top three in 3x3 at the last WCA World Championship and what were their times?','最近一届世锦赛三阶领奖台有哪些选手？']) {
      expect(standingsRequest(q,requestedAssistantLimit(q))).toMatchObject({edition:'latest-worlds',event:'333',round:'final',limit:3,details:false});
    }
    expect(standingsRequest('上届世界魔方锦标赛三阶冠军是谁？',undefined)).toMatchObject({edition:'latest-worlds',event:'333',round:'final',limit:1});
    expect(standingsRequest('2023 年魔方世锦赛四阶半决赛前三名是谁？',3)).toMatchObject({compId:'WC2023',event:'444',round:'semifinal'});
    for(const q of ['下届世锦赛三阶前三名是谁？','上届世锦赛三阶女子前三名是谁？','上届世锦赛三阶最佳单次前三名是谁？','上届世锦赛三阶和四阶前三名是谁？','上届世锦赛三阶前三名是谁？顺便列出世界纪录']) {
      expect(standingsRequest(q,3)).toBeUndefined();
    }
  });
  it('serves the screenshot question through the normal entry and falls back from incomplete podium data',async()=>{
    const {worldsDirectoryUrl}=await import('../src/utils/site_assistant_round.js');
    const db=await import('../src/db/connection.js');
    const offline=vi.spyOn(db,'withTransaction').mockRejectedValue(Error('local import offline'));
    const podiumUrl='https://www.worldcubeassociation.org/api/v0/competitions/WC2025/podiums';
    const eventUrl='https://www.worldcubeassociation.org/api/v0/competitions/WC2025/results/333';
    try {
      for(const incomplete of [false,true]) {
        const http=vi.fn<typeof fetch>(async url=>{
          if(String(url)===worldsDirectoryUrl)return Response.json([future,past]);
          if(String(url)===podiumUrl)return Response.json(incomplete?podium.slice(0,1):podium);
          if(String(url)===eventUrl)return Response.json({id:'333',rounds:[{roundTypeId:'f',results:podium}]});
          throw Error('Unexpected request: '+String(url));
        });
        const a=await answerSiteQuestion(question,'zh',{key:'unused',model:'unused',baseUrl:'https://model.invalid'},AbortSignal.timeout(3000),http);
        expect(a.answer).toMatch(/2025 年世锦赛 · 三阶决赛[\s\S]*1\. 王艺衡 — 平均 4\.23 秒[\s\S]*2\. 耿暄一 — 平均 4\.49 秒[\s\S]*3\. Tymon Kolasiński — 平均 4\.98 秒/);
        expect(a.answer).not.toContain('剔除');
        expect(a.sources.some(s=>s.href.includes('worldcubeassociation.org/competitions/WC2025/results'))).toBe(true);
        expect(http.mock.calls.map(([url])=>String(url))).toEqual([worldsDirectoryUrl,podiumUrl,...(incomplete?[eventUrl]:[])]);
      }
    } finally {offline.mockRestore();}
  });
  it('delivers verified first standings before a second source failure',async()=>{
    const db=await import('../src/db/connection.js');
    const offline=vi.spyOn(db,'withTransaction').mockRejectedValue(Error('local import offline'));
    let preview='';
    const http=vi.fn<typeof fetch>(async url=>{
      if (String(url).endsWith('WC2025/podiums')) return Response.json(podium);
      expect(preview).toContain('4.23');
      return new Response(null,{status:404});
    });
    try {
      const question='2025 年世锦赛三阶决赛前三名是谁？再列出 2023 年世锦赛三阶决赛前三名和成绩。';
      const result=await answerSiteQuestion(question,'zh',null,AbortSignal.timeout(2000),http,[],undefined,
        async event=>{if (event.type==='answer') preview=event.answer;});
      expect(preview).toContain('Tymon');
      expect(preview).not.toContain('2023');
      expect(result.answer).toContain(preview);
      expect(result.answer).toContain('WC2023 的轮次成绩源暂时不可用');
    } finally {offline.mockRestore();}
  });

});

describe('personal city attendance',()=>{
  const id='2019WANY36',question='我去过几次徐州';
  const profile={wcaId:id,profile:{person:{wca_id:id}},results:[{competition_id:'Open'},{competition_id:'Open'},{competition_id:'Other'},{competition_id:'Missing'}],
    comps:[{id:'Open',city:'Xuzhou, Jiangsu',country_iso2:'CN',start_date:'2025-03-16'},{id:'Other',city:'Shanghai',country_iso2:'CN',start_date:'2026-06-18'},{id:'Unattended',city:'Xuzhou, Jiangsu'}]};
  it('starts both independent PB reads, keeps their requested order and identifies a missing result',async()=>{
    let release!:()=>void;
    const bothStarted=new Promise<void>(resolve=>{release=resolve;});
    const ids:string[]=[];
    const fetcher=vi.fn<typeof fetch>(async input=>{
      const url=new URL(String(input));
      if(url.pathname.endsWith('/meta'))return Response.json({lastImportedAt:'2026-01-01'});
      const id=url.searchParams.get('wcaId')!;
      ids.push(id);
      if(ids.length===2)release();
      await bothStarted;
      return Response.json({profile:{person:{name:id},personal_records:id==='2019WANY36'?{333:{average:{best:351}}}:{}}});
    });
    const answer=await answerSiteQuestion('请分别给出 2019WANY36 和 2023GENG02 的三阶官方平均 PB，各用一行并注明来源。','zh',null,AbortSignal.timeout(3000),fetcher);
    expect(ids.sort()).toEqual(['2019WANY36','2023GENG02']);
    expect(answer.answer.split('\n')).toEqual([expect.stringMatching(/3\.51 秒 .*2019WANY36/),expect.stringMatching(/没有已导入.*2023GENG02/)]);
    expect(answer.sources.map(s=>s.href)).toEqual(['/wca/persons/2019WANY36','/wca/persons/2023GENG02']);
  });
  it('maps only a single unqualified current PB to a scalar lookup',async()=>{
    const {personalBestRequest}=await import('../src/utils/site_assistant_scope.js');
    expect(personalBestRequest('我的三阶官方平均 PB 是多少？')).toEqual({event:'333',metric:'average'});
    expect(personalBestRequest('我的三阶官方平均 PB 在世界排第几？')).toBeUndefined();
    expect(personalBestRequest('我在 2024 年的三阶平均 PB 是多少？')).toBeUndefined();
    expect(personalBestRequest('what is my official 3x3 single PB?')).toEqual({event:'333',metric:'single'});
  });
  it('counts distinct attended competitions, including incomplete coverage, without a provider',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>Response.json(profile));
    const result=await answerSiteQuestion(question,'zh',null,AbortSignal.timeout(3000),fetcher,[],id);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.answer).toMatch(/在徐州有 1 场/);
    expect(result.answer).toContain('另有 1 场');
    expect(result.sources[0].href).toContain(id);
  });
  it('keeps the explicit year when the visitor changes cities',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>Response.json(profile));
    const result=await answerSiteQuestion('那上海呢？','zh',null,AbortSignal.timeout(3000),fetcher,[{role:'user',content:'2025 年我去过几次徐州'}],id);
    expect(result.answer).toMatch(/2025 年在上海有 0 场/);
    expect(result.answer).toContain('缺少日期');
  });
  it('asks for the identity and distinguishes travel from competitions without reading data',async()=>{
    const fetcher=vi.fn<typeof fetch>();
    const missing=await answerSiteQuestion(question,'zh',null,AbortSignal.timeout(1000),fetcher);
    expect(missing.answer).toContain('WCA ID');
    const travel=await answerSiteQuestion('我旅游去过几次徐州？','zh',null,AbortSignal.timeout(1000),fetcher,[],id);
    expect(travel.answer).toContain('私人行程');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('recovers from the wrong mirror identity using only posted WCA competitions',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({...profile,wcaId:'2099TEST01'})).mockResolvedValueOnce(Response.json([
      {id:'Future',city:'Xuzhou',cancelled_at:null,results_posted_at:null},
      {id:'Official',city:'Xuzhou, Jiangsu',country_iso2:'CN',cancelled_at:null,results_posted_at:'2024-01-03'},
    ]));
    const result=await answerSiteQuestion(question,'zh',null,AbortSignal.timeout(2000),fetcher,[],id);
    expect(result.answer).toContain('在徐州有 1 场');
    expect(result.sources[0].href).toBe('https://www.worldcubeassociation.org/persons/'+id);
  });
  it('keeps a failed or malformed source distinct from zero attendance',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>Response.json({}));
    const result=await answerSiteQuestion(question,'zh',null,AbortSignal.timeout(3000),fetcher,[],id);
    expect(result.answer).toContain('无法核实');
    expect(result.answer).not.toContain('0 场');
  });
});
