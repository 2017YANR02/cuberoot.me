import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { beforeAll,afterAll,describe,it,expect,vi } from 'vitest';
import { ANALYSIS_DATASETS,compileAnalysis } from '../src/utils/site_assistant_analysis.js';
import { executeAnalysis } from '../src/utils/site_assistant_analysis_db.js';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { recentChampionWindow } from '../src/utils/site_assistant_champions.js';
import { withAssistantProgress } from '../src/utils/site_assistant_progress.js';
import type { AssistantStreamEvent } from '@cuberoot/shared/site-assistant';
const enabled=process.env.ASSISTANT_ANALYSIS_PG_TEST==='1' && process.env.DB_HOST==='127.0.0.1' && process.env.DB_NAME==='assistant_analysis_test';
const db=postgres({host:'127.0.0.1',port:Number(process.env.DB_PORT ?? 5433),username:process.env.DB_USER ?? 'postgres',password:process.env.DB_PASS ?? 'dev',database:'assistant_analysis_test',max:1});
const signal=()=>AbortSignal.timeout(10000);
const col=(col:string)=>({col});const value=(value:string|number)=>({value});const output=(as:string,expr:unknown)=>({as,label:as,expr});
const recentWinsQuestion='最近 WCA 官方比赛中,三阶速拧近 3 个月夺冠最多的人是谁?';

it('resolves rolling months with a month-end clamp and preserves narrower or compound questions',()=>{
  const window={from:'2026-02-28',to:'2026-05-31'};
  expect(recentChampionWindow(recentWinsQuestion,window.to)).toEqual(window);
  expect(recentChampionWindow('Who won the most 3×3 titles in official WCA competitions over the past three months?',window.to)).toEqual(window);
  for(const question of [recentWinsQuestion+'再列出前五名。',recentWinsQuestion.replace('WCA','中国 WCA'),
    recentWinsQuestion.replace('三阶速拧','三阶单手'),recentWinsQuestion.replace('3 个月','90 天'),
    recentWinsQuestion.replace('最多的','第二多的')])expect(recentChampionWindow(question,window.to)).toBeUndefined();
});
describe.skipIf(!enabled)('assistant analysis PostgreSQL isolation and calculations',()=>{
  beforeAll(async()=>{
    // Dedicated empty DB only. Never delete or reuse existing application data.
    await db.unsafe(`CREATE TABLE app_users(secret text); INSERT INTO app_users VALUES ('private');
      CREATE TABLE wca_person_results(wca_id text,comp_id text,comp_date date,event_id text,round_type_id text,format_id text,pos int,best int,average int,attempts int[],single_record text,average_record text);
      CREATE TABLE wca_competitions(id text,name text,country_id text,country_iso2 text,city text,start_date date,end_date date);
      CREATE TABLE wca_persons(wca_id text,name text,country_id text);
      CREATE TABLE wca_countries(id text,iso2 text,name text,continent_id text);
      CREATE TABLE recons(id int,person text,person_id text,event text,method text,date date,comp text,comp_wca_id text,official text,raw_time numeric,stm int,tps numeric,oll text,pll text,completion_status text,record_type text,visibility text);
      CREATE TABLE alg_cases(id int,puzzle text,set_slug text,name text,number int,subgroup text,position int);
      CREATE TABLE wiki_terms(id int,head_en text,head_zh text,body_en text,body_zh text,deleted_at timestamp);
      CREATE TABLE meta_historical(key text,updated_at timestamp);
      INSERT INTO meta_historical VALUES ('last_imported_at','2026-10-01');
      INSERT INTO wca_person_results VALUES
        ('2017YANR02','A','2026-01-01','333','1','a',1,800,1000,ARRAY[800,-1,900,-2,0],'',''),
        ('2017YANR02','A','2026-01-01','333','f','a',1,700,900,ARRAY[700,900,1100,1200,1300],'',''),
        ('2017YANR02','B','2026-02-01','333','f','a',1,600,800,ARRAY[600,800,1000,1100,1200],'',''),
        ('2017YANR02','C','2025-01-01','333','f','a',1,900,1100,ARRAY[900,1000,1100,1200,1300],'','');
      INSERT INTO wca_competitions VALUES ('A','A','China','CN','Shanghai','2026-01-01','2026-01-01'),('B','B','Japan','JP','Tokyo','2026-02-01','2026-02-01'),('C','C','China','CN','Shanghai','2025-01-01','2025-01-01');
      INSERT INTO recons(id,visibility,raw_time) VALUES (1,'public',4.5),(2,'private',1),(3,'unlisted',2);
      INSERT INTO wiki_terms(id,head_en,deleted_at) VALUES (1,'Public',null),(2,'Deleted',now());`);
    await db.unsafe(await readFile(new URL('../../../../ops/bin/provision-assistant-reader.sql',import.meta.url),'utf8'));
    await db.unsafe('GRANT cuberoot_assistant_reader TO CURRENT_USER');
    await db.unsafe(await readFile(new URL('../migrations/0267_assistant_public_analysis.sql',import.meta.url),'utf8'));
  });
  afterAll(async()=>{await db.end();});
  it('matches the catalog and denies private base tables and writes at the DB boundary',async()=>{
    const columns=await db`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='assistant_public' ORDER BY ordinal_position`;
    for(const [name,definition] of Object.entries(ANALYSIS_DATASETS))expect(columns.filter(c=>c.table_name===name).map(c=>c.column_name)).toEqual([...definition.columns]);
    await expect(db.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE cuberoot_assistant_reader');await tx.unsafe('SELECT * FROM public.app_users');})).rejects.toMatchObject({code:'42501'});
    await expect(db.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE cuberoot_assistant_reader');await tx.unsafe('DELETE FROM assistant_public.recons');})).rejects.toMatchObject({code:'42501'});
    await expect(db.begin('read only',async tx=>{await tx.unsafe("INSERT INTO app_users VALUES ('denied')");})).rejects.toMatchObject({code:'25006'});
    const visible=await executeAnalysis(compileAnalysis({from:{dataset:'recons',as:'r'},select:[output('id',col('r.id'))]}),signal());expect(visible.rows).toEqual([{id:'1'}]);
    const terms=await executeAnalysis(compileAnalysis({from:{dataset:'wiki_terms',as:'w'},select:[output('id',col('w.id'))]}),signal());expect(terms.rows).toEqual([{id:'1'}]);
  });
  it('enforces read-only role, query timeout and cancellation, then releases capacity',async()=>{
    const base=compileAnalysis({from:{dataset:'recons',as:'r'},select:[output('id',col('r.id'))]});
    const state=await executeAnalysis({...base,sql:"SELECT current_setting('transaction_read_only') AS mode,current_user AS role,current_setting('max_parallel_workers_per_gather') AS parallel_workers"},signal());
    expect(state.rows).toEqual([{mode:'on',role:'cuberoot_assistant_reader',parallel_workers:'0'}]);
    await expect(executeAnalysis({...base,sql:'SELECT pg_sleep(10)'},signal())).rejects.toMatchObject({code:'57014'});
    const controller=new AbortController();
    const task=executeAnalysis({...base,sql:'SELECT pg_sleep(10)'},controller.signal);
    setTimeout(()=>controller.abort(),30);
    await expect(task).rejects.toBeDefined();
    expect((await executeAnalysis(base,signal())).rows).toEqual([{id:'1'}]);
  },10000);
  it('computes deduplicated monthly counts, host joins, attempts and staged windows',async()=>{
    const byMonth={from:{dataset:'results',as:'r'},select:[output('month',{fn:'month',args:[col('r.comp_date')]}),output('count',{fn:'count',args:[col('r.comp_id')],distinct:true})],where:{op:'>=',args:[col('r.comp_date'),value('2026-01-01')]},groupBy:[{fn:'month',args:[col('r.comp_date')]}]};
    const counts=await executeAnalysis(compileAnalysis({...byMonth,orderBy:[{expr:{fn:'month',args:[col('r.comp_date')]},direction:'asc'}]}),signal());expect(counts.rows).toEqual([{month:'1',count:'1'},{month:'2',count:'1'}]);
    const previous=await executeAnalysis(compileAnalysis({steps:[{name:'months',query:byMonth}],from:{dataset:'months',as:'m'},select:[output('month',col('m.month')),output('previous',{fn:'lag',args:[col('m.count')],over:{orderBy:[{expr:col('m.month'),direction:'asc'}]}})],orderBy:[{expr:col('m.month'),direction:'asc'}]}),signal());expect(previous.rows).toEqual([{month:'1',previous:null},{month:'2',previous:'1'}]);
    const country=await executeAnalysis(compileAnalysis({from:{dataset:'results',as:'r'},joins:[{dataset:'competitions',as:'c',type:'inner',on:{op:'=',args:[col('r.comp_id'),col('c.id')]}}],select:[output('country',col('c.country_iso2')),output('count',{fn:'count',args:[col('r.comp_id')],distinct:true})],groupBy:[col('c.country_iso2')],orderBy:[{expr:col('c.country_iso2'),direction:'asc'}]}),signal());expect(country.rows).toEqual([{country:'CN',count:'2'},{country:'JP',count:'1'}]);
    const attempts=await executeAnalysis(compileAnalysis({from:{dataset:'attempts',as:'a'},select:[output('dnf',{fn:'count',args:[],filter:{op:'=',args:[col('a.value'),value(-1)]}}),output('attempted',{fn:'count',args:[],filter:{op:'or',args:[{op:'>',args:[col('a.value'),value(0)]},{op:'=',args:[col('a.value'),value(-1)]}]}})]}),signal());expect(attempts.rows).toEqual([{dnf:'1',attempted:'18'}]);
  });
  it('removes numeric padding while preserving text, nulls and significant precision',async()=>{
    const query=compileAnalysis({from:{dataset:'recons',as:'r'},select:[
      output('seconds',{op:'/',args:[value(657),value(100)]}),
      output('precise',{op:'/',args:[value(1),value(3)]}),
      output('numeric_text',value('006.570000')),
      output('missing',col('r.tps')),
    ]});
    const result=await executeAnalysis(query,signal());
    expect(result.rows).toEqual([{seconds:'6.57',precise:'0.33333333333333333333',numeric_text:'006.570000',missing:null}]);
  });
  it('answers the screenshot question from imported finals without contacting a model',async()=>{
    await db.unsafe(`INSERT INTO wca_persons VALUES ('2017YANR02','First Person','US'),('2020TEST01','Second Person','CN'),('2020TEST02','Third Person','CN');
      INSERT INTO wca_competitions VALUES
        ('WindowStart','Window Start','China','CN','Shanghai','2026-08-22','2026-08-23'),
        ('WindowEnd','Window End','Japan','JP','Tokyo','2026-11-23','2026-11-23'),
        ('BeforeWindow','Before Window','Japan','JP','Tokyo','2026-08-22','2026-08-22'),
        ('AfterWindow','After Window','Japan','JP','Tokyo','2026-11-23','2026-11-24');
      INSERT INTO wca_person_results(wca_id,comp_id,event_id,round_type_id,pos,best) VALUES
        ('2017YANR02','WindowStart','333','c',1,700),
        ('2017YANR02','WindowStart','333','f',1,700),
        ('2017YANR02','WindowEnd','333','f',1,700),
        ('2017YANR02','BeforeWindow','333','f',1,700),
        ('2017YANR02','AfterWindow','333','f',1,700),
        ('2020TEST01','WindowStart','333','c',1,700),
        ('2020TEST01','WindowEnd','333','f',1,700),
        ('2020TEST02','WindowStart','333','1',1,700),
        ('2020TEST02','WindowStart','333','f',2,700),
        ('2020TEST02','WindowEnd','333','f',1,-1),
        ('2020TEST02','WindowEnd','222','f',1,700);`);
    vi.useFakeTimers({toFake:['Date']});
    vi.setSystemTime(new Date('2026-11-24T07:50:00Z'));
    try {
      const events:AssistantStreamEvent[]=[];
      const emit=async(event:AssistantStreamEvent)=>{events.push(event);};
      const fetcher=vi.fn<typeof fetch>().mockRejectedValue(new Error('Unexpected network call'));
      const deadline=AbortSignal.timeout(6000);
      const answer=await withAssistantProgress(emit,deadline,performance.now(),()=>answerSiteQuestion(
        recentWinsQuestion,'zh',{key:'fixture',baseUrl:'https://model.invalid',model:'fixture'},deadline,fetcher,[],undefined,emit,'America/Los_Angeles'));
      expect(fetcher).not.toHaveBeenCalled();
      expect(answer.answer).toContain('First Person、Second Person并列第一，均夺冠 2 次');
      expect(answer.answer).toContain('2026-08-23 至 2026-11-23');
      expect(answer.answer).toContain('2026-10-01');
      expect(answer.artifacts?.[0]).toMatchObject({rows:[['First Person','2'],['Second Person','2']]});
      expect(events.filter(event=>event.type==='progress').map(event=>event.progress)).toMatchObject([
        {id:1,phase:'tool',tool:'recent_3x3_champions',state:'running',scope:{from:'2026-08-23',to:'2026-11-23'}},
        {id:1,phase:'tool',tool:'recent_3x3_champions',state:'complete',scope:{from:'2026-08-23',to:'2026-11-23'}},
      ]);
    } finally { vi.useRealTimers(); }
  });
  it('reports a blocked results source without asking the model to retry the calculation',async()=>{
    const locked=Promise.withResolvers<void>(),release=Promise.withResolvers<void>();
    const lock=db.begin(async tx=>{
      await tx.unsafe('LOCK TABLE wca_person_results IN ACCESS EXCLUSIVE MODE');
      locked.resolve();
      await release.promise;
    });
    try {
      await Promise.race([locked.promise,lock]);
      const fetcher=vi.fn<typeof fetch>().mockRejectedValue(new Error('Unexpected network call'));
      await expect(answerSiteQuestion(recentWinsQuestion.replace('3 个月','2 个月'),'zh',
        {key:'fixture',baseUrl:'https://model.invalid',model:'fixture'},AbortSignal.timeout(3000),fetcher))
        .rejects.toMatchObject({code:'source_unavailable'});
      expect(fetcher).not.toHaveBeenCalled();
    } finally {release.resolve();await lock;}
  });
});
