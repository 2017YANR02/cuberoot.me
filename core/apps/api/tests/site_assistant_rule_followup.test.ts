import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {answerSiteQuestion} from '../src/utils/site_assistant.js';
import {regulationFollowUpRead,WCA_REGULATIONS_URL} from '../src/utils/site_assistant_regulations.js';
import type {AssistantContext} from '../src/utils/site_assistant_context.js';
import {modelResponse,wireEvidence} from './fixtures/site_assistant_model.js';

const config={key:'fixture',baseUrl:'https://model.example/v1',model:'fixture'};
const question='如果观察恰好 15.00 秒或 17.00 秒才启动计时器呢？14.9 秒启动但 15.5 秒才转第一步会加罚吗？';
const context=():AssistantContext=>({version:1,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),
  sources:[{id:'wca:regulations:A',title:'Official regulations',href:WCA_REGULATIONS_URL+'#A3',read:true}],
  observations:[{call:{tool:'pages',query:'观察时间 A3',pageIds:[],audience:'user'},sourceIds:['wca:regulations:A'],dataVersion:null,facts:{},tables:[]}]});
const rules='<html><body><ul><li id="A3">Inspection.<ul><li id="A3a">See A4d for starting the solve.</li></ul></li><li id="A4">Start.<ul><li id="A4d">Starting the timer starts the solve, not the first move.</li><li id="A4d1+">Exactly 15.00 seconds: +2.</li><li id="A4d2+">Exactly 17.00 seconds: DNF.</li></ul></li></ul></body></html>';
beforeEach(()=>{vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});vi.stubEnv('SITE_ASSISTANT_KNOWLEDGE_ENABLED','0');});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});

describe('saved official rule follow-ups',()=>{
  it('uses a trusted source and prior clause query, not the previous answer',()=>{
    expect(regulationFollowUpRead(question,'zh',context())).toMatchObject({tool:'pages',pageIds:['wca:regulations:A'],query:expect.stringContaining(question)});
    expect(regulationFollowUpRead('如果 15 秒后下雨会怎样？','zh',context())).toBeUndefined();
    expect(regulationFollowUpRead(question,'zh')).toBeUndefined();
    const missing=context();missing.observations[0].call={tool:'pages',query:'观察时间',pageIds:[],audience:'user'};
    expect(regulationFollowUpRead(question,'zh',missing)).toBeUndefined();
    const fake=context();fake.sources[0].href='https://example.com/regulations/#A3';
    expect(regulationFollowUpRead(question,'zh',fake)).toBeUndefined();
    const mixed=context();mixed.sources.push({id:'wiki:1',title:'Other topic',href:'/wiki',read:true});
    expect(regulationFollowUpRead(question,'zh',mixed)).toBeUndefined();
  });

  it('rereads the source and composes a checked answer without a preliminary planner',async()=>{
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
      if(String(input)===WCA_REGULATIONS_URL)return new Response(rules);
      expect(String(input).startsWith(config.baseUrl)).toBe(true);
      const request=JSON.parse(String(init?.body));
      expect(JSON.stringify(request.messages)).not.toContain('OLD_UNVERIFIED_DNF_AT_15');
      expect(wireEvidence(request)[0].data.pages[0].content).toContain('Exactly 15.00 seconds: +2.');
      expect(request.tool_choice).toBe('auto');
      return modelResponse({answerKind:'grounded',answer:'15.00 秒 +2；17.00 秒 DNF；14.9 秒起表无观察超时处罚。 [[wca:regulations:A]]',sourceIds:['wca:regulations:A']});
    });
    const result=await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(4000),fetcher,[{role:'user',content:'观察时间超过15秒？'},{role:'assistant',content:'OLD_UNVERIFIED_DNF_AT_15'}],undefined,undefined,'UTC',[],'deep',{},context());
    expect(fetcher).toHaveBeenCalledTimes(2);expect(String(fetcher.mock.calls[0][0])).toBe(WCA_REGULATIONS_URL);
    expect(result.sources.map(s=>s.id)).toEqual(['wca:regulations:A']);
  });

  it('allows an additional needed tool after the prefetched clauses',async()=>{
    let models=0,glossary=0;
    const fetcher=vi.fn<typeof fetch>(async(input)=>{
      const url=String(input);
      if(url===WCA_REGULATIONS_URL)return new Response(rules);
      if(url.endsWith('/wiki/terms')){glossary++;return Response.json({sections:[{entries:[{id:1,head:'DNF',body:'Did Not Finish.'}]}]});}
      expect(url.startsWith(config.baseUrl)).toBe(true);
      if(++models===1)return modelResponse([{tool:'glossary',query:'DNF'}]);
      return modelResponse({answerKind:'grounded',answer:'17.00 秒判 DNF。 [[wca:regulations:A]] DNF 是 Did Not Finish。 [[wiki:1]]',sourceIds:['wca:regulations:A','wiki:1']});
    });
    const result=await answerSiteQuestion('如果观察满17秒，DNF是什么意思？','zh',config,AbortSignal.timeout(4000),fetcher,[],undefined,undefined,'UTC',[],'deep',{},context());
    expect(glossary).toBe(1);expect(models).toBe(2);expect(result.sources.map(s=>s.id)).toContain('wiki:1');
  });

  it.each([503,200])('falls back to planning when a fresh read cannot establish the clauses (HTTP %s)',async status=>{
    let models=0;
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
      if(String(input)===WCA_REGULATIONS_URL)return new Response('<html>No clauses.</html>',{status});
      expect(String(input).startsWith(config.baseUrl)).toBe(true);models++;
      const request=JSON.parse(String(init?.body));expect(request.tool_choice).toBe('auto');
      expect(wireEvidence(request)[0].data.notEvidence).toBe(true);
      return modelResponse({answerKind:'general',answer:'现有资料无法核实该条款。',sourceIds:[]});
    });
    const result=await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(4000),fetcher,[],undefined,undefined,'UTC',[],'deep',{},context());
    expect(models).toBe(1);expect(result.sources).toEqual([]);expect(result.answer).toContain('无法核实');
  });

  it('does not hide an access challenge behind speculative prefetch',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>new Response('',{status:403}));
    await expect(answerSiteQuestion(question,'zh',config,AbortSignal.timeout(4000),fetcher,[],undefined,undefined,'UTC',[],'deep',{},context())).rejects.toMatchObject({code:'source_verification_required'});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
