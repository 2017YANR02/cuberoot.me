import { describe,it,expect,vi } from 'vitest';
import { compileAnalysis, checkAnalysisGoal, analysisGoalSchema, AnalysisInputError } from '../src/utils/site_assistant_analysis.js';
import { runAnalysisQuery } from '../src/utils/site_assistant_analysis_db.js';
const col=(col:string)=>({col});
const value=(value:string|number)=>({value});
const base={from:{dataset:'results',as:'r'},select:[{as:'count',label:'Competitions',expr:{fn:'count',args:[col('r.comp_id')],distinct:true}}],where:{op:'=',args:[col('r.wca_id'),value('2017YANR02')]}};
describe('assistant analysis compiler',()=>{
  it('derives count units independently of misleading labels and follows deduplicated stages',()=>{
    const rows={from:{dataset:'results',as:'r'},select:[{as:'n',label:'Competitions',expr:{fn:'count',args:[]}}]};
    expect(compileAnalysis(rows).columns[0].countMeasure).toBe('results');
    expect(compileAnalysis({...rows,joins:[{dataset:'competitions',as:'c',type:'inner',on:{op:'=',args:[col('r.comp_id'),col('c.id')]}}]}).columns[0].countMeasure).toBe('rows');
    const stage={from:{dataset:'results',as:'r'},select:[{as:'id',expr:col('r.comp_id')}],groupBy:[col('r.comp_id')]};
    expect(compileAnalysis({...rows,steps:[{name:'comps',query:stage}],from:{dataset:'comps',as:'r'}}).columns[0].countMeasure).toBe('competitions');
    expect(compileAnalysis({...rows,select:[{as:'n',label:'Competitions',expr:{fn:'count',args:[col('r.comp_id')],distinct:true}}]}).columns[0].countMeasure).toBe('competitions');
  });
  it('binds hostile literals and rejects private tables, columns, SQL, functions and cross joins',()=>{
    const hostile="'; DELETE FROM app_users; --";
    const result=compileAnalysis({...base,where:{op:'=',args:[col('r.wca_id'),value(hostile)]}});
    expect(result.params).toEqual([hostile]);expect(result.sql).not.toContain(hostile);
    expect(result.sql).toContain('assistant_public."results"');
    for(const input of [
      {...base,from:{dataset:'app_users',as:'r'}},
      {...base,select:[{as:'x',label:'x',expr:col('r.password_hash')}]},
      {...base,select:[{as:'x',label:'x',expr:{fn:'pg_read_file',args:[value('/etc/passwd')]}}]},
      {...base,select:[{as:'x',label:'x',expr:{sql:'SELECT secret FROM app_users'}}]},
      {...base,sql:'SELECT 1'}, {...base,from:{dataset:'results;DROP TABLE recons',as:'r'}},
      {...base,steps:[{name:'results',query:base}]},
      {...base,joins:[{dataset:'results',as:'s',type:'inner',on:{op:'=',args:[value(1),value(1)]}}]},
    ])expect(()=>compileAnalysis(input)).toThrow(AnalysisInputError);
    expect(()=>compileAnalysis({...base,select:[{as:'x',label:'x',expr:{fn:'concat',args:[]}}]})).toThrow('Unsupported function concat. Allowed:');
  });
  it('keeps intermediate groups untruncated and supports arithmetic and windows',()=>{
    const q=compileAnalysis({steps:[{name:'totals',query:base}],from:{dataset:'totals',as:'t'},select:[{as:'number',label:'Number',expr:{op:'/',args:[col('t.count'),value(2)]}},{as:'rank',label:'Rank',expr:{fn:'rank',args:[],over:{orderBy:[{expr:col('t.count'),direction:'desc'}]}}}],limit:5});
    expect(q.sql.match(/LIMIT/g)).toHaveLength(1);expect(q.sql).toContain('LIMIT 6');expect(q.sql).toContain('rank() OVER');expect(q.sql).toContain('NULLIF');expect(q.datasets).toEqual(['results']);
  });
  it('rejects deep expressions before parsing or execution',()=>{
    let expr:any=col('r.best');for(let i=0;i<30;i++)expr={fn:'abs',args:[expr]};
    expect(()=>compileAnalysis({...base,select:[{as:'x',label:'x',expr}]})).toThrow('too complex');
  });
  it('identifies the malformed nested window field so the planner can repair it',()=>{
    expect(()=>compileAnalysis({...base,select:[{as:'previous',label:'Previous',expr:{fn:'lag',args:[col('r.best')],over:{orderBy:[{col:'r.comp_date',direction:'asc'}]}}}]})).toThrow('select.0.expr.over.orderBy.0.expr: Expected an expression object');
  });
  it('does not require unused intermediate display labels but still requires final labels',()=>{
    const intermediate={...base,select:base.select.map(({label,...column})=>column)};
    expect(()=>compileAnalysis({steps:[{name:'totals',query:intermediate}],from:{dataset:'totals',as:'t'},select:[{as:'n',label:'Count',expr:col('t.count')}]})).not.toThrow();
    expect(()=>compileAnalysis(intermediate)).toThrow('Final output columns require display labels');
  });
  it('marks truncation, blocks invented identities and keeps errors out of evidence',async()=>{
    const execute=vi.fn().mockResolvedValue({rows:[{count:'1'},{count:'2'}],importedAt:'2026-10-10'});
    const call={title:'Count',description:'Distinct competitions',query:{...base,limit:1}};
    const result=await runAnalysisQuery(call,'en',AbortSignal.timeout(1000),new Set(['2017YANR02']),execute);
    expect(result.evidence).toMatchObject({rows:[['1']],truncated:true,importedAt:'2026-10-10'});
    const unknown=await runAnalysisQuery(call,'en',AbortSignal.timeout(1000),new Set(),execute);
    expect(unknown.evidence).toMatchObject({notEvidence:true,error:expect.stringContaining('Unresolved WCA ID')});expect(execute).toHaveBeenCalledTimes(1);
    execute.mockRejectedValueOnce(Object.assign(new Error('secret query details'),{code:'57014'}));
    const timeout=await runAnalysisQuery(call,'en',AbortSignal.timeout(1000),new Set(['2017YANR02']),execute);
    expect(timeout.sources).toEqual([]);expect(timeout.evidence).toMatchObject({notEvidence:true,error:expect.stringContaining('timed out')});expect(JSON.stringify(timeout)).not.toContain('secret');
  });
  it('formats person names only after calculation, preserving column provenance through stages',async()=>{
    const query={steps:[{name:'people',query:{from:{dataset:'persons',as:'p'},select:[{as:'name',label:'Name',expr:col('p.name')}]}}],from:{dataset:'people',as:'p'},select:[{as:'name',label:'Name',expr:col('p.name')}]};
    const compiled=compileAnalysis(query);expect(compiled.columns[0].personName).toBe(true);
    const result=await runAnalysisQuery({title:'People',description:'Names',query},'zh',AbortSignal.timeout(1000),new Set(),async()=>({rows:[{name:'Ruimin Yan (颜瑞民)'}],importedAt:null}));
    expect(result.artifacts[0]).toMatchObject({rows:[['颜瑞民']]});
  });
});

describe('host continent evidence',()=>{
  const colEq=(left:string,right:string)=>({op:'=',args:[col(left),col(right)]});
  const goal={metric:'competitions',subject:'all',grain:'total',outputs:['比赛数'],time:{basis:'competition_start',from:'2026-01-01',before:'2027-01-01'},location:{basis:'host',continentIds:['_Asia']}};
  const dates=[{op:'>=',args:[col('c.start_date'),value(goal.time.from)]},{op:'<',args:[col('c.start_date'),value(goal.time.before)]}];
  const asia={op:'=',args:[col('h.continent_id'),value('_Asia')]};
  const query={from:{dataset:'competitions',as:'c'},joins:[{dataset:'countries',as:'h',type:'inner',on:colEq('c.country_id','h.id')}],select:[{as:'n',label:'场数',expr:{fn:'count',args:[col('c.id')],distinct:true}}],where:{op:'and',args:[...dates,asia]}};
  const check=(q:unknown,g:unknown=goal)=>checkAnalysisGoal(compileAnalysis(q),analysisGoalSchema.parse(g),{question:'今年亚洲有多少场比赛',normalizedQuestion:'2026亚洲有多少场比赛'}).status;
  it('checks the original year, requested scope and exact host-country join independently',()=>{
    expect(check(query)).toBe('program_checks_passed');
    expect(check({...query,where:{op:'and',args:[asia,{op:'=',args:[value(2026),{fn:'year',args:[col('c.start_date')]}]}]}})).toBe('program_checks_passed');
    expect(check({...query,where:{op:'and',args:[asia,dates[0],{op:'<=',args:[col('c.start_date'),value('2026-12-31')]}]}})).toBe('program_checks_passed');
    expect(check(query,{...goal,location:undefined})).toBe('rejected');
    expect(check(query,{...goal,time:undefined})).toBe('rejected');
    expect(check({...query,where:{op:'and',args:dates}})).toBe('rejected');
    expect(check({...query,where:{op:'or',args:[...dates,asia]}})).toBe('rejected');
    expect(check({...query,joins:[...query.joins,{dataset:'countries',as:'other',type:'inner',on:colEq('c.city','other.name')}],where:{op:'and',args:[...dates,{op:'=',args:[col('other.continent_id'),value('_Asia')]}]}})).toBe('rejected');
    expect(check(query,{...goal,location:{basis:'nationality',continentIds:['_Asia']}})).toBe('rejected');
    expect(analysisGoalSchema.safeParse({...goal,location:{basis:'host',countryIds:['_Asia']}}).success).toBe(false);
  });
});

describe('shared statistical scope and evidence',()=>{
  const equal=(a:unknown,b:unknown)=>({op:'=',args:[a,b]});
  const goal=analysisGoalSchema.parse({subject:'all',metric:'competitions',grain:'total',outputs:['Count'],event:'333oh'});
  const eventCheck=(where:unknown,event=goal.event,question='三阶单手有多少场比赛？')=>checkAnalysisGoal(
    compileAnalysis({...base,where}),{...goal,event},{question}).status;
  it('checks the exact qualified event and accepts equivalent filters through OR and IN',()=>{
    const oh=value('333oh'), e=col('r.event_id');
    for (const predicate of [equal(e,oh),equal(oh,e),{op:'in',args:[e,oh,oh]},
      {op:'or',args:[equal(e,oh),equal(oh,e)]}])expect(eventCheck(predicate)).toBe('program_checks_passed');
    expect(eventCheck(equal(e,value('333')),'333')).toBe('rejected');
    expect(eventCheck({op:'and',args:[equal(e,oh),equal(e,value('333'))]})).toBe('rejected');
    expect(eventCheck({op:'or',args:[equal(e,oh),equal(col('r.format_id'),oh)]})).toBe('rejected');
    expect(eventCheck({op:'in',args:[e,oh,value('333')]})).toBe('rejected');
    expect(eventCheck(equal(e,value('222')),'222','列出最活跃的 333 名选手')).toBe('program_checks_passed');
  });
  it('rejects incompatible entity IDs even when projected and renamed by a previous step',()=>{
    const stage={name:'projected',query:{from:base.from,select:[{as:'identity',expr:col('r.wca_id')}]}};
    const query={steps:[stage],from:{dataset:'projected',as:'a'},select:[{as:'id',label:'ID',expr:col('a.identity')}]};
    const joined=(dataset:string,column:string)=>({...query,joins:[{type:'inner',dataset,as:'b',on:equal(col('b.'+column),col('a.identity'))}]});
    expect(()=>compileAnalysis(joined('competitions','id'))).toThrow('Incompatible join keys');
    expect(()=>compileAnalysis(joined('persons','wca_id'))).not.toThrow();
  });
  it('requires the specified month, time basis and grouping independent of operand order',()=>{
    const from='2026-05-01',before='2026-06-01',date=col('c.start_date');
    const year={fn:'year',args:[date]};
    const query={from:{dataset:'competitions',as:'c'},select:[{as:'n',label:'Total',expr:{fn:'count',distinct:true,args:[col('c.id')]}}],where:{op:'and',args:[
      {op:'<=',args:[value(from),date]},{op:'>',args:[value(before),date]}]},groupBy:[year]};
    const monthlyGoal=analysisGoalSchema.parse({subject:'all',metric:'competitions',grain:'year',outputs:['Count'],time:{basis:'competition_start',from,before}});
    const context={question:'2026年5月的比赛按年份汇总'};
    expect(checkAnalysisGoal(compileAnalysis(query),monthlyGoal,context).status).toBe('program_checks_passed');
    expect(checkAnalysisGoal(compileAnalysis({...query,groupBy:[{fn:'year',args:[col('c.end_date')]}]}),monthlyGoal,context).status).toBe('rejected');
    expect(checkAnalysisGoal(compileAnalysis(query),{...monthlyGoal,time:undefined},context).status).toBe('rejected');
  });
});

import { requestedAnalysisPeriod,publicCountRequest } from '../src/utils/site_assistant_competition_scope.js';
import { assistantToolOutcome,boundAssistantToolResult } from '../src/utils/site_assistant_evidence.js';

it('keeps comparisons, exclusions and standing user constraints out of the standalone path',()=>{
  for(const q of ['2026年亚洲有多少场比赛，欧洲呢？','2026年全球有多少名三阶选手参赛','2026年除日本外亚洲有多少场比赛'])
    expect(publicCountRequest(q)).toBeUndefined();
  expect(publicCountRequest('2026年亚洲有多少场比赛',[{role:'user',content:'接下来只统计有三阶单手的比赛。'}])).toBeUndefined();
  for (const q of ['2026年1月至3月有多少轮？','截至2026年5月有多少轮？','how many rounds in January 2026?'])
    expect(requestedAnalysisPeriod(q,q)).toBeUndefined();
});

it('drops stale citations and factual summaries for failed tools at any response size',()=>{
  const result={sources:[{id:'entry',title:'Entry',href:'/wiki',read:true}],artifacts:[],factualSummary:'Stale answer',
    outcome:{state:'success' as const},evidence:{notEvidence:true,error:'Could not read the source'}};
  for(const budget of [10,10000]){
    const bounded=boundAssistantToolResult(result,budget);
    expect(bounded.sources).toEqual([]);
    expect(bounded.factualSummary).toBeUndefined();
    expect(bounded.outcome?.state).toBe('partial');
  }
  expect(assistantToolOutcome(result).state).toBe('partial');
  const partial={...result,evidence:{entries:[{sourceId:'entry'}],contextIncomplete:true}};
  expect(boundAssistantToolResult(partial,10000).sources).toEqual(result.sources);
});
