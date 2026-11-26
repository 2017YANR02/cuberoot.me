import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {officialRegulationPassages,regulationExcerptArticles,WCA_REGULATIONS_URL,WCA_REGULATIONS_MIRROR_URL,savedRegulationChapter} from '../src/utils/site_assistant_regulations.js';
import {runDataTool} from '../src/utils/site_assistant_tools.js';
import {answerSiteQuestion, readCurrentOfficialRules} from '../src/utils/site_assistant.js';
import {modelResponse,wireEvidence} from './fixtures/site_assistant_model.js';

it('shares the anonymous rules warmup and revalidates an expired official version',async()=>{
  const page = '<ul><li id="A4d1">Version one</li></ul>';
  const updated = page.replace('one','two');
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(page,{headers:{etag:'"v1"'}}))
    .mockResolvedValueOnce(new Response(null,{status:304}))
    .mockResolvedValueOnce(new Response('unavailable',{status:503}))
    .mockResolvedValueOnce(new Response(updated,{headers:{etag:'"v2"'}}));
  const now = Date.now();
  const time = vi.spyOn(Date,'now').mockReturnValue(now);
  vi.stubGlobal('fetch',fetcher);
  try {
    expect(await Promise.all([readCurrentOfficialRules(),readCurrentOfficialRules()])).toEqual([page,page]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    time.mockReturnValue(now+61_000);
    expect(await readCurrentOfficialRules()).toBe(page);
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('if-none-match')).toBe('"v1"');
    time.mockReturnValue(now+122_000);
    await expect(readCurrentOfficialRules()).rejects.toThrow();
    expect(await readCurrentOfficialRules()).toBe(updated);
  } finally {
    time.mockRestore();
    vi.unstubAllGlobals();
  }
});

const config={key:'test-only',baseUrl:'https://model.example/v1',model:'qwen3.8-flash'};
// Minimal clause structure; the paid evaluation separately uses the frozen WCA
// April 2026 original, including single-cap / two-cap / edge-piece examples.
const rules='<html><body><version>Version: April 1, 2026</version><ul><li id="5b">Defect procedure<ul><li id="5b5">Evaluate detached parts.</li><li id="5b5+">A single center cap can remain detached.</li><li id="5b5++">Two center caps are different.</li><li id="5b5a">Uncolored parts.</li><li id="5b5b">One part with one colored face: solved.</li><li id="5b5c">Multiple such parts: DNF.</li><li id="5b5d">A part with multiple colored faces: DNF.</li><li id="5b5e">5b5c and 5b5d override the permissions.</li></ul></li></ul></body></html>';
beforeEach(()=>{vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});vi.stubEnv('SITE_ASSISTANT_KNOWLEDGE_ENABLED','0');});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});

it('retains earlier-year PBs in a year-end ranking with an explicit snapshot basis',async()=>{
  const read=vi.fn(async(url:string)=>url.includes('/meta')?{lastImportedAt:'2026-11-06T00:00:00Z'}:url.includes('historical-ranks?')?{total:1,rows:[{rank:1,name:'Earlier PB',wcaId:'2012PARK03',value:313,iso2:'US',compId:'Earlier2023',compName:'Earlier',compDate:'2023-06-11'}]}:{});
  const result=await runDataTool({tool:'rankings',event:'333',type:'single',country:'',year:2025,limit:3},'en',read);
  expect(result.evidence).toMatchObject({year:2025,timeBasis:{kind:'cumulative_snapshot',through:'2025-12-31'},rows:[['1','Earlier PB','2012PARK03','3.13','US','Earlier','2023-06-11']]});
});

it('retrieves the complete defect family and examples instead of lending an edge penalty to a cap',()=>{
  const result=officialRegulationPassages(rules,[{href:'/regulation/defects',content:'5b5d edge-piece example.'}]);
  expect(result).toHaveLength(1);expect(result[0].metadata.clauses).toEqual(['5b','5b5','5b5+','5b5++','5b5a','5b5b','5b5c','5b5d','5b5e']);
  expect(result[0].relatedOmitted).toBe(false);expect(result[0].metadata.sourceVersion).toBe('Version: April 1, 2026');
  expect(result[0].content.match(/One part with one colored face/g)).toHaveLength(1);
});

it('distinguishes a complete retained family from an oversized omitted family',()=>{
  const html='<html><body><ul><li id="A3">'+('Inspection. '.repeat(2000))+'</li><li id="A4">Timer start.<ul><li id="A4d">The timer starts the solve.</li></ul></li></ul></body></html>';
  const [result]=officialRegulationPassages(html,[{href:'/regulation/speed-solving',content:'A3 A4d'}]);
  expect(result.metadata.clauses).toEqual(['A4','A4d']);expect(result.relatedOmitted).toBe(true);
  expect(result.metadata.completeFamilies).toEqual(['A4']);expect(result.metadata.omittedFamilies).toEqual(['A3']);
});

it('associates each penalty with its explicit exception references without inheriting nested exceptions',()=>{
  const html='<html><body><version>Fixture version</version><ul><li id="A3">Inspection<ul><li id="A3c1">No moves or intentional alignment changes. Penalty: DNF. Exception: see A3c2 and A3c5.</li><li id="A3c2">An existing misalignment may be corrected within 10f limits.</li><li id="A3c5">A puzzle-specific alignment procedure is allowed.</li></ul></li></ul></body></html>';
  const [result]=officialRegulationPassages(html,[{href:'/regulation/speed-solving',content:'A3c1'}]);
  expect(result.metadata.exceptions).toEqual([{clause:'A3c1',text:'Exception: see A3c2 and A3c5.',references:['A3c2','A3c5']}]);
  expect(result.metadata.clauses).toContain('A3c2');expect(result.metadata.clauses).toContain('A3c5');
});

it('resolves full-text clause references and includes their linked starting conditions in one read',()=>{
  const html='<html><body><ul><li id="A1">'+('Unrelated scope. '.repeat(1200))+'</li><li id="A3">Inspection.<ul><li id="A3a">Inspect before starting the solve (see A4d).</li></ul></li><li id="A4">Start.<ul><li id="A4d">The timer starts the solve.</li><li id="A4d1">Within 15 seconds.</li><li id="A4d1+">Exactly 15.00: +2.</li><li id="A4d2">Within 17 seconds.</li><li id="A4d2+">Exactly 17.00: DNF.</li></ul></li></ul></body></html>';
  const excerpt={href:'/regulation/full',content:'A3a 观察时间。'};
  const [result]=officialRegulationPassages(html,[excerpt]);
  expect(result.id).toBe('wca:regulations:A');
  expect(result.metadata.clauses).toEqual(['A3','A3a','A4','A4d','A4d1','A4d1+','A4d2','A4d2+']);
  expect(result.metadata.completeFamilies).toEqual(['A3','A4']);expect(result.metadata.omittedFamilies).toEqual(['A1']);
  expect(result.relatedOmitted).toBe(true);
  expect(regulationExcerptArticles({href:'/regulation/full',content:'Unknown article Z9'})).toEqual([]);
  expect(regulationExcerptArticles({href:'/forum',content:'A4d'})).toEqual([]);
});

it.each([0,5000])('supplements a retrieved full-text rule with official clauses before answering (body delay: %i ms)',async(delay)=>{
  let models=0,officialReads=0;
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    const url=String(input);
    if(url.endsWith('/assistant/pages.json'))return Response.json({updated:'2026-11-12T00:00:00Z',pages:[{lang:'en',href:'/regulation/full',title:'WCA Regulations',text:'5b5d puzzle defect example.'}]});
    if(url===WCA_REGULATIONS_MIRROR_URL)return new Response(rules.replace('<version>','<p class="reg-doc-version">').replace('</version>','</p>'));
    if(url===WCA_REGULATIONS_URL){
      officialReads++;
      return new Response(new ReadableStream({start(controller){
        const abort=()=>{clearTimeout(timer);controller.error(init!.signal!.reason);};
        const timer=setTimeout(()=>{init?.signal?.removeEventListener('abort',abort);controller.enqueue(new TextEncoder().encode(rules));controller.close();},delay);
        init?.signal?.addEventListener('abort',abort,{once:true});
      }}),{headers:{'content-type':'text/html'}});
    }
    expect(url.startsWith(config.baseUrl)).toBe(true);models++;
    const pages=wireEvidence(JSON.parse(String(init?.body))).flatMap(item=>item.data?.pages??[]);
    expect(pages[0].content).toContain('One part with one colored face: solved');
    expect(pages[0].id).toBe('wca:regulations:5');
    return modelResponse({answerKind:'grounded',answer:'One detached center cap can remain solved. [[wca:regulations:5]]',sourceIds:['wca:regulations:5']});
  });
  const result=await answerSiteQuestion('According to the puzzle defects rules, what happens with a detached center cap?','en',config,AbortSignal.timeout(15000),fetcher);
  expect(result.sources[0].href).toContain(delay>4000?WCA_REGULATIONS_MIRROR_URL:WCA_REGULATIONS_URL);expect(models).toBe(1);expect(officialReads).toBe(1);
},15000);

it('keeps a full competitor chapter above the old excerpt budget, including equipment exceptions',()=>{
  const html='<html><body><ul><li id="2a">'+('x'.repeat(11600))+'</li><li id="2i">Equipment restrictions.</li><li id="2i2a">Medical aid exception.</li></ul></body></html>';
  const [result]=officialRegulationPassages(html,[{href:'/regulation/competitors',content:'2a eligibility'}]);
  expect(result.metadata.clauses).toEqual(['2a','2i','2i2a']);expect(result.relatedOmitted).toBe(false);
});

it('uses the versioned English full-text mirror after an official transport failure without claiming a live official read',async()=>{
  const mirror=rules.replace('<version>','<p class="reg-doc-version">').replace('</version>','</p>');
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    const url=String(input);
    if(url.endsWith('/assistant/pages.json'))return Response.json({updated:'2026-11-12T00:00:00Z',pages:[{lang:'en',href:'/regulation/defects',title:'Puzzle defects',text:'5b5d edge-piece example.'}]});
    if(url===WCA_REGULATIONS_URL)throw new DOMException('Timed out','TimeoutError');
    if(url===WCA_REGULATIONS_MIRROR_URL)return new Response(mirror);
    const pages=wireEvidence(JSON.parse(String(init?.body))).flatMap(item=>item.data?.pages??[]);
    expect(pages[0].metadata).toMatchObject({snapshot:true,sourceVersion:'Version: April 1, 2026'});
    expect(pages[0].content).toContain('One part with one colored face: solved');
    return modelResponse({answerKind:'grounded',answer:'Under the April 2026 rules, one detached center cap can remain solved. [[wca:regulations:5]]',sourceIds:['wca:regulations:5']});
  });
  const result=await answerSiteQuestion('According to the puzzle defects rules, what happens with a detached center cap?','en',config,AbortSignal.timeout(5000),fetcher);
  expect(result.sources[0].href).toBe(WCA_REGULATIONS_MIRROR_URL+'#5b');
  expect(savedRegulationChapter({sources:result.sources} as any,'wca:regulations:5')).toBe('/regulation/defects');
  expect(officialRegulationPassages(rules,[{href:'/regulation/defects',content:'5b5'}],'',WCA_REGULATIONS_MIRROR_URL)).toEqual([]);
});

it('resolves a returned official source ID for a focused follow-up without refetching or inventing a URL',async()=>{
  let models=0,officialReads=0;
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    const url=String(input);
    if(url.endsWith('/assistant/pages.json'))return Response.json({updated:'2026-11-12T00:00:00Z',pages:[{lang:'en',href:'/regulation/defects',title:'Puzzle defects',text:'5b5d edge-piece defect example.'}]});
    if(url===WCA_REGULATIONS_URL){officialReads++;return new Response(rules,{headers:{'content-type':'text/html'}});}
    expect(url.startsWith(config.baseUrl)).toBe(true);models++;
    if(models===1)return modelResponse([{tool:'pages',query:'5b5b exceptions',pageIds:['wca:regulations:5']}]);
    expect(wireEvidence(JSON.parse(String(init?.body))).some(item=>item.data?.pages?.some((p:any)=>p.id==='wca:regulations:5' && p.content.includes('One part with one colored face')))).toBe(true);
    return modelResponse({answerKind:'grounded',answer:'One detached center cap can remain solved. [[wca:regulations:5]]',sourceIds:['wca:regulations:5']});
  });
  const result=await answerSiteQuestion('According to the puzzle defects rules, what happens with a detached center cap?','en',config,AbortSignal.timeout(4000),fetcher);
  expect(result.answer).toContain('can remain solved');expect(models).toBe(2);expect(officialReads).toBe(1);
});

it('uses authoritative clauses before a conflicting summary in one checked composition',async()=>{
  let models=0;
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    const url=String(input);
    if(url.endsWith('/assistant/pages.json'))return Response.json({updated:'2026-11-12T00:00:00Z',pages:[{lang:'zh',href:'/regulation/defects',title:'WCA 魔方故障',text:'中心盖掉落。5b5d 缺失棱块判 DNF。'.repeat(4)}]});
    if(url===WCA_REGULATIONS_URL)return new Response(rules,{headers:{'content-type':'text/html'}});
    expect(url.startsWith(config.baseUrl)).toBe(true);models++;
    const evidence=wireEvidence(JSON.parse(String(init?.body)));
    const pages=evidence.flatMap(item=>item.data?.pages??[]);
    expect(pages[0].content).toContain('One part with one colored face: solved');
    expect(pages.some(p=>p.content.includes('缺失棱块判'))).toBe(false);
    return modelResponse({answerKind:'grounded',answer:'单个中心盖脱落不自动判 DNF。 [[wca:regulations:5]]',sourceIds:['wca:regulations:5']});
  });
  const result=await answerSiteQuestion('根据本站 WCA 魔方故障规则，中心盖脱落一定判 DNF 吗？','zh',config,AbortSignal.timeout(4000),fetcher);
  expect(result.sources[0].href).toContain('worldcubeassociation.org/regulations/');expect(models).toBe(1);
});

it.each([false,true])('opens one request circuit and preserves independent evidence (malformed answer: %s)',async malformed=>{
  let models=0,forum=0;
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    const url=String(input);
    if(url.startsWith(config.baseUrl)){
      models++;
      if(models===1)return modelResponse([{tool:'glossary',query:'TPS'},{tool:'forum',query:'TPS'},{tool:'forum',query:'手速'}]);
      const request=JSON.parse(String(init?.body));expect((request.tools??[]).some((t:any)=>t.function.name==='forum')).toBe(false);
      if(malformed)return Response.json({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'invalid JSON'}}]});
      return modelResponse({answerKind:'grounded',answer:'TPS 是每秒步数；论坛暂时无法核实。 [[wiki:1]]',sourceIds:['wiki:1']});
    }
    if(url.endsWith('/wiki/terms'))return Response.json({sections:[{entries:[{id:1,head:'TPS',body:'每秒步数'}]}]});
    if(url.includes('/forum/search')){forum++;return new Response('',{status:503});}
    throw new Error('Unexpected read');
  });
  const result=await answerSiteQuestion('查 TPS 百科定义和论坛主题。','zh',config,AbortSignal.timeout(5000),fetcher);
  expect(result.answer).toContain('每秒步数');expect(result.answer).toContain('论坛');expect(result.sources.map(s=>s.id)).toEqual(['wiki:1']);
  expect(forum).toBe(2);expect(models).toBe(malformed?3:2);
});

it('does not read a tutorial when an entry request explicitly excludes it',async()=>{
  let models=0;
  const id='page:/alg/3bld/lookup';
  const fetcher=vi.fn<typeof fetch>(async input=>{
    if(String(input).endsWith('/assistant/pages.json'))return Response.json({updated:'2026-11-12',pages:[{lang:'zh',href:'/alg/3bld/lookup',title:'三盲公式查询',text:''}]});
    if(String(input).startsWith(config.baseUrl))return ++models===1
      ? modelResponse([{tool:'navigation',query:'三盲',kind:'all'}])
      : modelResponse({answerKind:'site_content',answer:`查询入口 [[${id}]]`,sourceIds:[id]});
    throw new Error('Unexpected content read');
  });
  const answer=await answerSiteQuestion('我想查三盲公式，给我入口，不用介绍教程。','zh',config,AbortSignal.timeout(3000),fetcher);
  expect(answer.actions?.[0]?.href).toBe('/alg/3bld/lookup');expect(models).toBe(2);
});

it('does not turn an optional glossary navigation link into a page-body requirement',async()=>{
  let models=0;
  const fetcher=vi.fn<typeof fetch>(async input=>{
    const url=String(input);
    if(url.endsWith('/assistant/pages.json'))return Response.json({updated:'2026-11-12',pages:[{lang:'zh',href:'/forum',title:'论坛',text:''}]});
    if(url.endsWith('/wiki/terms'))return Response.json({sections:[{entries:[{id:1,head:'TPS',body:'每秒步数'}]}]});
    if(url.includes('/forum/search'))return new Response('',{status:503});
    if(url.startsWith(config.baseUrl))return ++models===1
      ? modelResponse([{tool:'glossary',query:'TPS'},{tool:'forum',query:'TPS'},{tool:'navigation',query:'论坛',kind:'all'}])
      : modelResponse({answerKind:'site_content',answer:'TPS 是每秒步数 [[wiki:1]]；论坛暂时无法核实，可稍后打开入口 [[page:/forum]]。',sourceIds:['wiki:1','page:/forum']});
    throw new Error('Unexpected read');
  });
  const answer=await answerSiteQuestion('查 TPS 百科定义和论坛主题，查不到就说明。','zh',config,AbortSignal.timeout(4000),fetcher);
  expect(answer.answer).toContain('每秒步数');expect(models).toBe(2);
});

it('preserves the explicitly requested clause family before spending the excerpt budget on other chapters',()=>{
  const html='<html><body><ul><li id="9a">'+('Other events. '.repeat(720))+'</li><li id="A1">'+('Format. '.repeat(680))+'</li><li id="A4">Start.<ul><li id="A4d1">'+('Inspection. '.repeat(390))+'</li><li id="A4d1+">Boundary.</li></ul></li></ul></body></html>';
  const pages=officialRegulationPassages(html,[{href:'/regulation/events',content:'9a'},{href:'/regulation/speed-solving',content:'A1'}],'What does A4d1 say?');
  expect(pages[0].id).toBe('wca:regulations:A');
  expect(pages[0].metadata.clauses).toEqual(expect.arrayContaining(['A4d1','A4d1+']));
  expect(pages[0].href).toContain('#A4');
});

it.each(['auto','fast'] as const)('repairs an invented slow-turn allocation in %s mode', async mode => {
  const question='慢拧那段录像停顿多，全速那段少，可后者的打乱我认识。我该把练习比例倒过来吗？请把两种练法各自用什么题单验收说清，给一个取舍指标。';
  const first='1. 先保留原配比：熟悉打乱会影响判断。\n2. A 原练法（慢拧）与 B 新练法（全速）等时练习，各测一份不重叠的新打乱，以练后整把用时中位数取舍。';
  const corrected='1. 先保留当前配比：两段录像不足以判断，且打乱熟悉度不同。\n2. A 用当前配比，B 用倒过来的配比；等时等难练习后，A、B 各测一份未练过、彼此不重叠的新打乱。复测时交换顺序并换新题，B 的整把用时中位数稳定更低才改。';
  const fetcher=vi.fn<typeof fetch>()
    .mockResolvedValueOnce(modelResponse({answerKind:'general',answer:first}))
    .mockResolvedValueOnce(modelResponse({answerKind:'general',answer:corrected}));
  const result=await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(5000),fetcher,[],undefined,undefined,'UTC',[],mode);
  expect(result.answer).toContain('A 用当前配比，B 用倒过来的配比');
  expect(result.answer).not.toContain('A 原练法（慢拧）');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('uses deep reasoning once for a complete mix comparison and repairs a false difficulty claim without repeating it', async()=>{
  const question='慢拧那段录像停顿多，全速那段少，可后者的打乱我认识。我该把练习比例倒过来吗？请把两种练法各自用什么题单验收说清，给一个取舍指标。';
  const right='1. 暂留当前配比，认识打乱使识别更容易。\n2. A 按当前配比，B 用倒过来的配比，等时练习，各测一份彼此不重叠的陌生打乱；只比较练后整把中位时间。';
  for(const wrong of [false,true]){
    const body:Array<Record<string, unknown>>=[];
    const fetcher:typeof fetch=async (_input,init)=>{
      body.push(JSON.parse(String(init?.body)));
      const answer=wrong && body.length===1?right.replace('认识打乱使识别更容易','两组打乱难度不同'):right;
      return modelResponse({answerKind:'general',answer});
    };
    const deep={...config,baseUrl:'https://api.deepseek.com',model:'deepseek-flash'};
    const result=await answerSiteQuestion(question,'zh',deep,AbortSignal.timeout(5000),fetcher,[],undefined,undefined,'UTC',[],'deep');
    expect(result.answer).toBe(right);
    expect(body).toHaveLength(wrong?2:1);
    expect(body[0]).toMatchObject({thinking:{type:'enabled'},reasoning_effort:'low'});
    if(wrong)expect(body[1]).toMatchObject({thinking:{type:'disabled'}});
  }
});
