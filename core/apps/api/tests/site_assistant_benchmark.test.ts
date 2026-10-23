import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SITE_ASSISTANT_QUESTION_MAX_LENGTH } from '@cuberoot/shared/site-assistant';
import { createSiteAssistantRoutes } from '../src/routes/site_assistant.js';
import { parseBenchmarkQuestions, runAssistantBenchmark } from '../scripts/benchmark-site-assistant.js';

const fixtures=vi.hoisted(()=>({
  config:{key:'test-only',baseUrl:'https://model.example',model:'fixture'},
  answer:vi.fn(async()=>({answer:'Fixture answer',sources:[]})),
}));
vi.mock('../src/utils/site_assistant.js',()=>({answerSiteQuestion:fixtures.answer,assistantConfig:()=>fixtures.config}));
vi.mock('../src/utils/account.js',async importOriginal=>({...await importOriginal<object>(),getUserById:vi.fn(async()=>({id:66,wca_id:'2017YANR02'}))}));
vi.mock('../src/utils/session.js',async importOriginal=>({...await importOriginal<object>(),signSession:()=> 'fixture-session'}));
vi.mock('../src/routes/site_assistant.js',async importOriginal=>{
  const original=await importOriginal<typeof import('../src/routes/site_assistant.js')>();
  return {...original,createSiteAssistantRoutes:vi.fn(original.createSiteAssistantRoutes),requireAssistantUser:async()=>({uid:66,wcaId:'2017YANR02'})};
});
vi.mock('node:fs',async importOriginal=>{
  const original=await importOriginal<typeof import('node:fs')>();
  const ledger=(path:unknown)=>String(path).startsWith('/tmp/cuberoot-assistant-benchmark-');
  return {...original,existsSync:(path:Parameters<typeof original.existsSync>[0])=>ledger(path)?false:original.existsSync(path),
    writeFileSync:(...args:Parameters<typeof original.writeFileSync>)=>{if(!ledger(args[0]))original.writeFileSync(...args);}};
});

beforeEach(()=>{
  vi.clearAllMocks();
  vi.spyOn(console,'log').mockImplementation(()=>{});
  vi.spyOn(console,'warn').mockImplementation(()=>{});
  vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('Benchmark contract tests must not use the network');}));
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('assistant benchmark request contract',()=>{
  it('uses the shared API question limit for Markdown cases',()=>{
    const question='文'.repeat(SITE_ASSISTANT_QUESTION_MAX_LENGTH);
    expect(parseBenchmarkQuestions(`| R01 | writing | ${question} | complete answer | — | en |`)[0]).toMatchObject({id:'R01',question,lang:'en'});
    expect(()=>parseBenchmarkQuestions(`| R01 | writing | ${question}文 | answer | — | zh |`)).toThrow('Invalid benchmark question');
  });
  it('passes case options and all assistant arguments through while replacing only the fetcher',async()=>{
    await runAssistantBenchmark([{id:'D08',category:'custom',question:'继续',expected:'continue',history:[],thinking:'deep',timeZone:'Asia/Shanghai'}],66,'2017YANR02');
    const args=vi.mocked(fixtures.answer).mock.calls[0] as unknown[];
    expect(args[5]).toEqual([]);
    expect(args[8]).toBe('Asia/Shanghai');
    expect(args[10]).toBe('deep');
    const adapter=vi.mocked(createSiteAssistantRoutes).mock.calls[0][0]!.answer;
    const signal=new AbortController().signal,emit=vi.fn(async()=>{});
    const history=[{role:'user' as const,content:'Earlier question'}];
    const images=[{mediaType:'image/png' as const,data:'fixture-image'}];
    await adapter('Image question','en',fixtures.config,signal,fetch,history,'2017YANR02',emit,'UTC',images,'fast');
    expect(fixtures.answer).toHaveBeenLastCalledWith('Image question','en',fixtures.config,signal,args[4],history,'2017YANR02',emit,'UTC',images,'fast');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('retains the legacy D08 subject and default options when no override is provided',async()=>{
    await runAssistantBenchmark([{id:'D08',category:'follow-up',question:'他的平均呢？',expected:'same person'}],66,'2017YANR02');
    const args=vi.mocked(fixtures.answer).mock.calls[0] as unknown[];
    expect(args[5]).toEqual([{role:'user',content:'我想看 2009ZEMD01 的三阶成绩'},{role:'assistant',content:'我们正在查看 2009ZEMD01 的三阶成绩。'}]);
    expect(args[8]).toBe('America/Los_Angeles');
    expect(args[10]).toBe('auto');
    expect(fetch).not.toHaveBeenCalled();
  });
});
