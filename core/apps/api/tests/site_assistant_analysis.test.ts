import { describe,it,expect,vi } from 'vitest';
import { compileAnalysis, AnalysisInputError } from '../src/utils/site_assistant_analysis.js';
import { runAnalysisQuery } from '../src/utils/site_assistant_analysis_db.js';
const col=(col:string)=>({col});
const value=(value:string|number)=>({value});
const base={from:{dataset:'results',as:'r'},select:[{as:'count',label:'Competitions',expr:{fn:'count',args:[col('r.comp_id')],distinct:true}}],where:{op:'=',args:[col('r.wca_id'),value('2017YANR02')]}};
describe('assistant analysis compiler',()=>{
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
