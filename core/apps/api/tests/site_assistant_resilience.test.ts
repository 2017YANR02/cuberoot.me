import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPETITION_SERVICE_HEADER, verifyCompetitionProof } from '@cuberoot/shared/competition-access';
import { SITE_ASSISTANT_TIMEOUT_MS } from '@cuberoot/shared/site-assistant';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { createSiteAssistantRoutes as createRoutes } from '../src/routes/site_assistant.js';
import { AssistantFailure } from '../src/utils/site_assistant_diagnostics.js';
import { modelResponse as model, wireEvidence } from './fixtures/site_assistant_model.js';
import { chunkKnowledge } from '../src/utils/site_assistant_knowledge.js';

const config={key:'private-model-key',baseUrl:'https://model.example/v1',model:'test'};
const createSiteAssistantRoutes = (deps: Omit<Parameters<typeof createRoutes>[0], 'authenticate'>) => createRoutes({ authenticate: async () => ({ uid: 1, wcaId: '2017YANR02' }), ...deps });
const secret='test-only-service-signing-secret-32-chars';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
describe('assistant resilience',()=>{
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
      expect(fetcher).toHaveBeenCalledTimes(4); // Includes the final evidence review.
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
  it('stops after a second source timeout and does not retry an aborted request',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(model([{tool:'glossary',query:'CFOP'}])).mockRejectedValue(new DOMException('timeout','TimeoutError'));
    await expect(answerSiteQuestion('CFOP','en',config,AbortSignal.timeout(5000),withCatalog(fetcher))).rejects.toMatchObject({code:'timeout'});
    expect(fetcher).toHaveBeenCalledTimes(3);
    const controller=new AbortController();
    const aborted=vi.fn<typeof fetch>().mockResolvedValueOnce(model([{tool:'glossary',query:'CFOP'}])).mockImplementationOnce(async()=>{controller.abort();throw new TypeError('fetch failed');});
    await expect(answerSiteQuestion('CFOP','en',config,controller.signal,withCatalog(aborted))).rejects.toThrow();
    expect(aborted).toHaveBeenCalledTimes(2);
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
      .mockResolvedValueOnce(Response.json({updated:'2026-10-26T00:00:00.000Z',pages:[]}));
    await expect(answerSiteQuestion('Read it','en',config,AbortSignal.timeout(5000),withCatalog(fetcher))).rejects.toMatchObject({code:'source_unavailable'});
    expect(fetcher).toHaveBeenCalledTimes(2);
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
