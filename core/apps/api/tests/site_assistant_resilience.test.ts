import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPETITION_SERVICE_HEADER, verifyCompetitionProof } from '@cuberoot/shared/competition-access';
import { SITE_ASSISTANT_TIMEOUT_MS } from '@cuberoot/shared/site-assistant';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { createSiteAssistantRoutes as createRoutes } from '../src/routes/site_assistant.js';
import { AssistantFailure } from '../src/utils/site_assistant_diagnostics.js';
import { modelResponse as model, wireEvidence } from './fixtures/site_assistant_model.js';
import { chunkKnowledge } from '../src/utils/site_assistant_knowledge.js';
import { withAssistantProgress } from '../src/utils/site_assistant_progress.js';
import * as analysis from '../src/utils/site_assistant_analysis_db.js';
vi.mock('../src/utils/site_assistant_people.js',()=>({findAssistantPeople:vi.fn(async()=>[])}));

const config={key:'private-model-key',baseUrl:'https://model.example/v1',model:'test'};
const createSiteAssistantRoutes = (deps: Omit<Parameters<typeof createRoutes>[0], 'authenticate'>) => createRoutes({ authenticate: async () => ({ uid: 1, wcaId: '2017YANR02' }), ...deps });
const secret='test-only-service-signing-secret-32-chars';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
describe('assistant resilience',()=>{
  it('allows an independent calculation after a public search fails',async()=>{
    const source={id:'analysis:independent',title:'Competition count',href:'/wca/results',read:true};
    const table={kind:'table' as const,title:source.title,columns:['Count'],rows:[['7']]};
    const query=vi.spyOn(analysis,'runAnalysisQuery').mockResolvedValue({sources:[source],artifacts:[table],evidence:{rows:[['7']]}});
    let models=0;
    const fetcher=vi.fn<typeof fetch>(async(url,init)=>{
      if(String(url).endsWith('/wiki/terms'))return Response.json({sections:[{entries:[{id:1,head:'TPS',body:'Turns per second.'}]}]});
      if(String(url).includes('/forum/search'))return new Response('',{status:503});
      const request=JSON.parse(String(init?.body));
      if(++models===1)return model([{tool:'glossary',query:'TPS'},{tool:'forum',query:'TPS'}]);
      if(models===2) {
        expect(request.tools.some((tool:any)=>tool.function.name==='forum')).toBe(false);
        return model([{tool:'analysis_schema',datasets:['results']},{tool:'analysis_query',title:source.title,description:'Distinct competitions',query:{}}]);
      }
      return model({answerKind:'grounded',answer:'TPS means turns per second. The count is 7; the forum could not be checked. [[wiki:1]] [[analysis:independent]]',sourceIds:['wiki:1',source.id],reviewedSourceIds:[source.id]});
    });
    const result=await answerSiteQuestion('Define TPS, find its forum discussion, and count my competitions.','en',config,AbortSignal.timeout(5000),withCatalog(fetcher),[],'2017YANR02');
    expect(query).toHaveBeenCalledTimes(1);
    expect(result.artifacts).toEqual([table]);
    expect(result.sources.map(item=>item.id)).toEqual(['wiki:1',source.id]);
    expect(result.answer).toContain('forum could not be checked');
  });
  it('repairs invalid final fields from existing evidence without repeating data reads',async()=>{
    const requests:any[]=[];
    let dataReads=0;
    const fetcher=vi.fn<typeof fetch>(async (url,init)=>{
      if(String(url).endsWith('/wiki/terms')) { dataReads++; return Response.json({sections:[]}); }
      const body=JSON.parse(String(init?.body)); requests.push(body);
      if(requests.length===1)return model([{tool:'glossary',query:'CFOP'}]);
      if(requests.length===2)return model({answer:{text:'private-invalid-answer'}});
      return model({answerKind:'general',answer:'No matching glossary entry was found.',sourceIds:[]});
    });
    const answer=await answerSiteQuestion('Look up CFOP.','en',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(answer.answer).toBe('No matching glossary entry was found.');
    expect(dataReads).toBe(1);
    expect(requests[2].tools).toBeUndefined();
    expect(requests[2].messages.at(-1).content).toContain('answer: invalid_type');
    expect(wireEvidence(requests[2])).toEqual(wireEvidence(requests[1]));
    expect(requests).toHaveLength(3);
  });
  it('stops after one output repair and returns a distinct failure',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>model({answer:'   '}));
    await expect(answerSiteQuestion('Explain rain.','en',config,AbortSignal.timeout(5000),withCatalog(fetcher))).rejects.toMatchObject({code:'model_output_invalid'});
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).tools).toBeUndefined();
  });
  it.each([429,503])('backs off once for HTTP %s without turning transport recovery into format repair',async status=>{
    vi.useFakeTimers();
    try {
      const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('',{status,headers:{'retry-after':'1'}})).mockResolvedValueOnce(model({answer:'Recovered.'}));
      const pending=answerSiteQuestion('Explain rain.','en',config,new AbortController().signal,withCatalog(fetcher));
      await vi.advanceTimersByTimeAsync(999);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect((await pending).answer).toBe('Recovered.');
      expect(fetcher).toHaveBeenCalledTimes(2);
      const body=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
      expect(body.tool_choice).toBe('auto');
      expect(body.messages.at(-1).content).not.toContain('previous answer failed validation');
    } finally { vi.useRealTimers(); }
  });
  it('honors a long Retry-After without retrying early',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:429,headers:{'retry-after':'60'}}));
    await expect(answerSiteQuestion('Explain rain.','en',config,AbortSignal.timeout(5000),withCatalog(fetcher))).rejects.toMatchObject({code:'model_rate_limited',upstreamStatus:429,retryAfterMs:60000});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not start a retry when the original request is aborted during backoff',async()=>{
    const controller=new AbortController();
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:503,headers:{'retry-after':'1'}}));
    const pending=answerSiteQuestion('Explain rain.','en',config,controller.signal,withCatalog(fetcher));
    const rejection=expect(pending).rejects.toThrow();
    await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
    controller.abort(); await rejection;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('answers from the formula catalog when a documentation search has no matches',async()=>{
    const answer={answerKind:'grounded',answer:'可以查询 PLL。[[algorithms]]',sourceIds:['algorithms']};
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(model([{tool:'algorithms',puzzle:'3x3'},{tool:'pages',query:'你能查询什么公式',pageIds:[]}]))
      .mockResolvedValueOnce(Response.json([{puzzle:'3x3',setSlug:'pll',count:21}]))
      .mockResolvedValueOnce(Response.json({version:2,updated:'2026-10-10T00:00:00.000Z',pages:[]}))
      .mockImplementation(async()=>model(answer));
    const result=await answerSiteQuestion('你能查询什么公式','zh',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(result.answer).toBe(answer.answer);
    expect(result.sources.map(source=>source.id)).toEqual(['algorithms']);
    const evidence=wireEvidence(JSON.parse(String(fetcher.mock.calls[3][1]?.body)));
    expect(evidence.find((entry:any)=>entry.tool.tool==='pages').data).toMatchObject({notEvidence:true,pages:[]});
    expect(evidence.find((entry:any)=>entry.tool.tool==='algorithms').data.sets).toEqual([{puzzle:'3x3',setSlug:'pll',count:21}]);
  });
  it('reads dated official news without loading competition indexes',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
    try {
      const fetcher=vi.fn<typeof fetch>()
        .mockResolvedValueOnce(model([{tool:'news',limit:5}]))
        .mockResolvedValueOnce(new Response('<rss><channel><item><title>Official update</title><link>https://www.worldcubeassociation.org/posts/update</link><pubDate>2026-10-20T12:00:00Z</pubDate><description>Published facts.</description></item></channel></rss>'))
        .mockResolvedValueOnce(model({answer:'本周 WCA 官方消息：公告已更新。[[news:update]]',sourceIds:['news:update']}))
        .mockResolvedValueOnce(model({answer:'本周 WCA 官方消息：公告已更新。[[news:update]]',sourceIds:['news:update']}));
      const result=await answerSiteQuestion('这周魔方圈有什么新闻？','zh',config,new AbortController().signal,withCatalog(fetcher),[],undefined,undefined,'Asia/Shanghai');
      expect(fetcher.mock.calls[1][0]).toBe('https://www.worldcubeassociation.org/rss.xml');
      expect(fetcher).toHaveBeenCalledTimes(3); // Includes the final evidence review.
      expect(result.sources[0].href).toBe('https://www.worldcubeassociation.org/posts/update');
      const evidence=wireEvidence(JSON.parse(String(fetcher.mock.calls[2][1]?.body)));
      expect(evidence[0].data).toMatchObject({from:'2026-10-19',to:'2026-10-25',timeZone:'Asia/Shanghai'});
    } finally { vi.useRealTimers(); }
  });
  it.each(['timeout','network','gateway'])('recovers one transient %s data read without repeating model planning',async failure=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(model([{tool:'glossary',query:'CFOP'}]));
    if(failure==='gateway') fetcher.mockResolvedValueOnce(new Response('',{status:503}));
    else fetcher.mockRejectedValueOnce(failure==='timeout'?new DOMException('timeout','TimeoutError'):new TypeError('fetch failed'));
    fetcher.mockResolvedValueOnce(Response.json({sections:[]})).mockResolvedValueOnce(model({answer:'No matching term found.'}));
    await answerSiteQuestion('CFOP','en',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls[1][0]).toBe(fetcher.mock.calls[2][0]);
  });
  it('isolates a source timeout after bounded retries and does not retry an aborted request',async()=>{
    let dataReads=0,modelCalls=0;
    const fetcher=vi.fn<typeof fetch>(async url=>{
      if(String(url).endsWith('/wiki/terms')){dataReads++;throw new DOMException('timeout','TimeoutError');}
      return ++modelCalls===1?model([{tool:'glossary',query:'CFOP'}]):model({answerKind:'general',answer:'The requested definition is temporarily unavailable; I cannot confirm it.'});
    });
    const result=await answerSiteQuestion('CFOP','en',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(dataReads).toBe(2);expect(modelCalls).toBe(3);
    expect(result.answer).toContain('cannot confirm');expect(result.sources).toEqual([]);
    const controller=new AbortController();
    const aborted=vi.fn<typeof fetch>().mockResolvedValueOnce(model([{tool:'glossary',query:'CFOP'}])).mockImplementationOnce(async()=>{controller.abort();throw new TypeError('fetch failed');});
    await expect(answerSiteQuestion('CFOP','en',config,controller.signal,withCatalog(aborted))).rejects.toThrow();
    expect(aborted).toHaveBeenCalledTimes(2);
  });
  it('keeps supported facts when an additional source fails, without repeating its failed read',async()=>{
    const calls=[{tool:'algorithms',puzzle:'3x3'},{tool:'glossary',query:'PLL'}];
    const answer={answerKind:'grounded',answer:'PLL has 21 cases. The glossary explanation could not be verified. [[algorithms]]',sourceIds:['algorithms']};
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(model(calls))
      .mockResolvedValueOnce(Response.json([{puzzle:'3x3',setSlug:'pll',count:21}]))
      .mockRejectedValueOnce(new TypeError('private-network-detail'))
      .mockRejectedValueOnce(new TypeError('private-network-detail'))
      .mockResolvedValueOnce(model([{tool:'glossary',query:'PLL'}]))
      .mockResolvedValueOnce(model(answer))
      .mockResolvedValueOnce(model(answer));
    const result=await answerSiteQuestion('How many PLL cases are there, and what does the glossary say?','en',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(result.answer).toBe(answer.answer);
    expect(result.sources.map(source=>source.id)).toEqual(['algorithms']);
    expect(fetcher.mock.calls.filter(([url])=>String(url).endsWith('/wiki/terms'))).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(6);
    const remaining=JSON.parse(String(fetcher.mock.calls[4][1]?.body));
    expect(remaining.tool_choice).toBe('auto');
    expect(remaining.tools.some((tool:any)=>tool.function.name==='glossary')).toBe(false);
    const evidence=wireEvidence(JSON.parse(String(fetcher.mock.calls[5][1]?.body)));
    expect(evidence.filter((entry:any)=>entry.tool.tool==='glossary')).toHaveLength(2);
    expect(evidence.filter((entry:any)=>entry.tool.tool==='glossary').every((entry:any)=>entry.data.notEvidence)).toBe(true);
    expect(JSON.stringify(evidence)).not.toContain('private-network-detail');
  });
  it('still stops at access challenges after an earlier successful read',async()=>{
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(model([{tool:'algorithms',puzzle:'3x3'},{tool:'glossary',query:'PLL'}]))
      .mockResolvedValueOnce(Response.json([{puzzle:'3x3',setSlug:'pll',count:21}]))
      .mockResolvedValueOnce(new Response('',{status:403}));
    await expect(answerSiteQuestion('How many PLL cases are there, and what does the glossary say?','en',config,AbortSignal.timeout(5000),withCatalog(fetcher))).rejects.toMatchObject({code:'source_verification_required'});
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('retains the failure notice when a verified fixed-tool summary replaces an invented count',async()=>{
    const sourceId='person-competitions:2017YANR02:all:all';
    const modelFetch=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(model([{tool:'person_competitions',wcaId:'2017YANR02'},{tool:'glossary',query:'CFOP'}]))
      .mockResolvedValueOnce(model({answerKind:'grounded',answer:'999 competitions. The glossary could not be read.',sourceIds:[sourceId]}))
      .mockResolvedValueOnce(model({answerKind:'grounded',answer:'1 competition. The glossary could not be read.',sourceIds:[sourceId]}));
    const fetcher:typeof fetch=async(input,init)=>{
      const url=new URL(String(input));
      if(url.pathname.endsWith('/person-page'))return Response.json({profile:{person:{name:'Ruimin Yan (颜瑞民)'}},results:[{competition_id:'A'}],comps:[{id:'A',start_date:'2026-01-01'}]});
      if(url.pathname.endsWith('/meta'))return Response.json({lastImportedAt:'2026-11-01'});
      if(url.pathname.endsWith('/wiki/terms'))throw new TypeError('private-network-detail');
      return modelFetch(input,init);
    };
    const result=await answerSiteQuestion('Count my competitions and explain CFOP.','en',config,AbortSignal.timeout(5000),withCatalog(fetcher),[],'2017YANR02');
    expect(result.answer).toContain('competed in 1 competitions');
    expect(result.answer).not.toContain('999');
    expect(result.answer).toContain('Some additional sources could not be read.');
    expect(result.sources.map(source=>source.id)).toEqual([sourceId]);
    expect(modelFetch).toHaveBeenCalledTimes(2);
  });
  it('accepts native tool calls without retry, while still validating every tool',async()=>{
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(model([{tool:'statistics',id:'example',limit:5}]))
      .mockResolvedValueOnce(model({answer:'Please choose a listed statistic.'}));
    await answerSiteQuestion('Example','en',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(fetcher).toHaveBeenCalledTimes(2);
    const request=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(wireEvidence(request)[0].tool).toMatchObject({tool:'statistics',id:'example'});
  });
  it('recovers one transient model failure inside the original request, but never retries denied credentials',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(model({answer:'Please specify a person.'}));
    const result=await answerSiteQuestion('Who?','en',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(result.answer).toBe('Please specify a person.');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const denied=vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:401}));
    await expect(answerSiteQuestion('Who?','en',config,AbortSignal.timeout(5000),withCatalog(denied))).rejects.toMatchObject({code:'model_unavailable',upstreamStatus:401});
    expect(denied).toHaveBeenCalledTimes(1);
  });
  it('signs index and public page reads, never sends proof to model or follows redirects',async()=>{
    vi.stubEnv('COMPETITION_ACCESS_SECRET',secret);
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(model({calls:[{tool:'pages',query:'frames',pageIds:['frame-count']}]}))
      .mockResolvedValueOnce(new Response('',{status:404}))
      .mockResolvedValueOnce(new Response('<main>Count frames.</main>',{headers:{'content-type':'text/html'}}))
      .mockResolvedValueOnce(model({answer:'Count frames.',sourceIds:['frame-count']}))
      .mockResolvedValueOnce(model({answer:'Count frames.',sourceIds:['frame-count']}));
    await answerSiteQuestion('Frame counting','en',config,AbortSignal.timeout(5000), withCatalog(fetcher));
    for(const i of [1,2]) {
      const [url,init]=fetcher.mock.calls[i];
      expect(String(url)).toMatch(/^https:\/\/next\.cuberoot\.me\//);
      const headers=new Headers(init?.headers);
      expect(headers.has('authorization')).toBe(false);
      expect(await verifyCompetitionProof(secret,headers.get(COMPETITION_SERVICE_HEADER)!,'service',new URL(String(url)).pathname)).toBe(true);
      expect(init?.redirect).toBe('manual');
    }
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).has(COMPETITION_SERVICE_HEADER)).toBe(false);
    expect(String(fetcher.mock.calls[3][1]?.body)).not.toContain(secret);
  });
  it('reports a challenged source without another model round or external redirect',async()=>{
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(model({calls:[{tool:'pages',query:'frames',pageIds:['frame-count']}]}))
      .mockResolvedValueOnce(new Response('',{status:404}))
      .mockResolvedValueOnce(new Response('',{status:307,headers:{location:'/competition-verify?returnTo=example'}}));
    await expect(answerSiteQuestion('Frames','en',config,AbortSignal.timeout(5000), withCatalog(fetcher))).rejects.toMatchObject({code:'source_verification_required'});
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('retains real indexed evidence when an additional selected page is unavailable',async()=>{
    const corpus={version:2,updated:'2026-10-10T00:00:00.000Z',pages:[{lang:'en' as const,href:'/recognize/pll',title:'PLL',text:'Recognize bars and headlights.'}]};
    const [passage]=await chunkKnowledge(corpus);
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(model({calls:[{tool:'pages',query:'PLL',pageIds:['frame-count','page:/recognize/pll']}]}))
      .mockResolvedValueOnce(Response.json(corpus))
      .mockResolvedValueOnce(new Response('',{status:404}))
      .mockResolvedValueOnce(model({answer:'Look for bars.',sourceIds:[passage.id]}))
      .mockResolvedValueOnce(model({answer:'Look for bars.',sourceIds:[passage.id]}));
    const result=await answerSiteQuestion('PLL','en',config,AbortSignal.timeout(5000), withCatalog(fetcher));
    expect(result.sources).toEqual([{id:passage.id,title:'PLL',href:'/recognize/pll',read:true}]);
    const evidence=wireEvidence(JSON.parse(String(fetcher.mock.calls[3][1]?.body)));
    expect(evidence[0].data.pages).toHaveLength(1);
  });
  it.each(['zh','en'] as const)('reads a verified %s dynamic page whose index entry only contains navigation',async lang=>{
    const href='/math/group/conjugation',id=`page:${href}`;
    const corpus={updated:'2026-10-26T00:00:00.000Z',pages:[{lang,href,title:'Conjugation',text:''}]};
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(model({calls:[{tool:'pages',query:'conjugation setup',pageIds:[id]}]}))
      .mockResolvedValueOnce(Response.json(corpus))
      .mockResolvedValueOnce(new Response('<main>Apply setup, perform the operation, then undo the setup.</main>',{headers:{'content-type':'text/html'}}))
      .mockResolvedValueOnce(model({answer:'Apply setup, operate, undo setup.',sourceIds:[id]}))
      .mockResolvedValueOnce(model({answer:'Apply setup, operate, undo setup.',sourceIds:[id]}));
    const result=await answerSiteQuestion('Explain this page',lang,config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(fetcher.mock.calls[2][0]).toBe(`https://next.cuberoot.me${lang==='zh'?'/zh':''}${href}`);
    expect(result.sources).toEqual([{id,href,title:'Conjugation',read:true}]);
  });
  it('does not turn an invented page ID into an on-demand URL',async()=>{
    const fetcher=vi.fn<typeof fetch>()
      .mockResolvedValueOnce(model({calls:[{tool:'pages',query:'unknown',pageIds:['page:/unknown-public-route']}]}))
      .mockResolvedValueOnce(Response.json({updated:'2026-10-26T00:00:00.000Z',pages:[]}))
      .mockImplementation(async()=>model({answerKind:'general',answer:'I could not verify that page.',sourceIds:[]}));
    const result=await answerSiteQuestion('Read it','en',config,AbortSignal.timeout(5000),withCatalog(fetcher));
    expect(result.sources).toEqual([]);
    const evidence=wireEvidence(JSON.parse(String(fetcher.mock.calls[2][1]?.body)));
    expect(evidence[0]).toMatchObject({outcome:{state:'blocked',reason:'invalid_page_reference'},data:{notEvidence:true,error:'invalid_page_reference'}});
    expect(fetcher.mock.calls.some(([url])=>String(url).includes('/unknown-public-route'))).toBe(false);
  });
  it('repairs a bad follow-up page ID without discarding evidence or reporting a source outage',async()=>{
    const corpus={updated:'2026-11-12T00:00:00.000Z',pages:[{lang:'en' as const,href:'/help/inspection',title:'Inspection help',text:'The documented inspection reminder sounds at eight and twelve seconds.'}]};
    const [passage]=await chunkKnowledge(corpus);
    const calls:any[]=[];
    const events:any[]=[];
    let indexReads=0;
    const fetcher=vi.fn<typeof fetch>(async(url,init)=>{
      if(String(url).endsWith('/assistant/pages.json')) {indexReads++;return Response.json(corpus);}
      const request=JSON.parse(String(init?.body));calls.push(request);
      if(calls.length===1)return model({calls:[{tool:'pages',query:'inspection reminder',pageIds:[]}]});
      if(calls.length===2)return model({calls:[{tool:'pages',query:'inspection timing',pageIds:['invented-inspection-id']}]});
      if(calls.length===3) {
        const evidence=wireEvidence(request);
        expect(evidence.some(item=>item.data?.pages?.some((page:any)=>page.id===passage.id))).toBe(true);
        expect(evidence.some(item=>item.data?.error==='invalid_page_reference')).toBe(true);
        expect(evidence.find(item=>item.data?.error==='invalid_page_reference')?.data.instruction).toContain('Reuse an exact ID');
        expect(request.messages.at(-1).content).toContain('The page selection was invalid.');
        return model({calls:[{tool:'pages',query:'inspection timing',pageIds:[passage.id]}]});
      }
      return model({answerKind:'grounded',answer:`The reminder sounds at eight and twelve seconds. [[${passage.id}]]`,sourceIds:[passage.id]});
    });
    const signal=AbortSignal.timeout(5000);
    const result=await withAssistantProgress(async event=>{events.push(event);},signal,performance.now(),()=>answerSiteQuestion('Explain the documented inspection reminders.','en',config,signal,withCatalog(fetcher)));
    expect(result.answer).toContain('eight and twelve seconds');
    expect(result.sources).toEqual([{id:passage.id,title:'Inspection help',href:'/help/inspection',read:true}]);
    expect(indexReads).toBe(1);
    expect(calls.some(request=>request.messages.some((message:any)=>message.role==='system' && message.content.includes('Compose and check the final answer directly from the ORIGINAL question')))).toBe(true);
    expect(fetcher.mock.calls.every(([url])=>String(url).endsWith('/assistant/pages.json') || String(url).startsWith(config.baseUrl))).toBe(true);
    expect(events.filter(event=>event.type==='progress' && event.progress.phase==='tool' && event.progress.state!=='running').map(event=>event.progress.state)).toEqual(['complete','partial','complete']);
  });
  it('logs stage timing without recording question, provider body or model key',async()=>{
    const log=vi.spyOn(console,'log').mockImplementation(()=>{});
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('secret-provider-body',{status:502}));
    await expect(answerSiteQuestion('private-question','en',config,AbortSignal.timeout(5000), withCatalog(fetcher))).rejects.toMatchObject({code:'model_unavailable'});
    const output=JSON.stringify([...log.mock.calls,...warn.mock.calls]);
    expect(output).toContain('site_assistant_stage');
    expect(output).toContain('durationMs');
    for(const value of ['private-question','secret-provider-body',config.key])expect(output).not.toContain(value);
  });
  it.each(['network','malformed'])('classifies %s model failures without leaking details',async mode=>{
    const fetcher=vi.fn<typeof fetch>();
    if(mode==='network')fetcher.mockRejectedValue(new TypeError('private-provider-host'));
    else fetcher.mockResolvedValue(Response.json({choices:[{message:{content:'invalid model JSON'}}]}));
    await expect(answerSiteQuestion('test','en',config,AbortSignal.timeout(5000), withCatalog(fetcher))).rejects.toMatchObject({code:'model_unavailable'});
  });
  it('ends a stalled quota request at the shared deadline and never starts a late model call',async()=>{
    const controller=new AbortController();
    const timeout=vi.spyOn(AbortSignal,'timeout').mockReturnValue(controller.signal);
    let release!:(value:{allowed:boolean;retryAfter:number})=>void;
    const reserve=vi.fn(()=>new Promise<{allowed:boolean;retryAfter:number}>(resolve=>{release=resolve;}));
    const answer=vi.fn();
    const route=createSiteAssistantRoutes({answer,config:()=>config,now:Date.now,reserve});
    const pending=route.request('/site-assistant',{method:'POST',body:JSON.stringify({question:'test',lang:'en'})});
    await vi.waitFor(()=>expect(reserve).toHaveBeenCalledTimes(1));
    expect(timeout).toHaveBeenCalledWith(SITE_ASSISTANT_TIMEOUT_MS-2000);
    controller.abort();
    const response=await pending;
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({error:'timeout'});
    release({allowed:true,retryAfter:60});
    await Promise.resolve(); await Promise.resolve();
    expect(answer).not.toHaveBeenCalled();
  });
  it('returns classified provider failures without exposing the provider message',async()=>{
    const route=createSiteAssistantRoutes({answer:vi.fn().mockRejectedValue(new AssistantFailure('model_unavailable')),config:()=>config,now:Date.now,reserve:async()=>({allowed:true,retryAfter:60})});
    const response=await route.request('/site-assistant',{method:'POST',body:JSON.stringify({question:'test',lang:'en'})});
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({error:'model_unavailable'});
  });
});

const withCatalog = (fetcher: typeof fetch): typeof fetch => (url, init) => String(url)==='https://static.cuberoot.me/stats/index.json' ? Promise.resolve(Response.json({categories:[]})) : fetcher(url,init);
