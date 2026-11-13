import {describe,it,expect,vi} from 'vitest';
import {checkAnalysisGoal,compileAnalysis,type AnalysisGoal} from '../src/utils/site_assistant_analysis.js';
import {runAnalysisQuery} from '../src/utils/site_assistant_analysis_db.js';
import {boundAssistantEvidence,boundAssistantToolResult} from '../src/utils/site_assistant_evidence.js';
import {chunkKnowledge,expandKnowledge,lexicalKnowledge,knowledgeGeneration,knowledgeHash,knowledgeQuery,knowledgePageReferences,knowledgeCoverage,KNOWLEDGE_VERSION} from '../src/utils/site_assistant_knowledge.js';
import {knowledgeIndexStatus} from '../src/utils/site_assistant_knowledge_db.js';
import {assistantRetrievalHealth} from '../src/utils/site_assistant_monitor.js';
const col=(col:string)=>({col});const v=(value:string|number)=>({value});const eq=(c:string,value:string|number)=>({op:'=',args:[col(c),v(value)]});
const filters=[eq('r.wca_id','2017YANR02'),eq('r.event_id','333'),{op:'>=',args:[col('r.comp_date'),v('2026-01-01')]},{op:'<',args:[col('r.comp_date'),v('2027-01-01')]}];
const month={fn:'month',args:[col('r.comp_date')]};
const plan={from:{dataset:'results',as:'r'},select:[{as:'month',label:'月份',expr:month},{as:'n',label:'场次',expr:{fn:'count',args:[col('r.comp_id')],distinct:true}}],where:{op:'and',args:filters},groupBy:[month]};
const goal:AnalysisGoal={metric:'competitions',subject:'viewer',personIds:[],event:'333',grain:'month',time:{basis:'competition_start',from:'2026-01-01',before:'2027-01-01'},outputs:['每月比赛数']};
const context={question:'统计我2026年三阶每月不同比赛数量',viewerWcaId:'2017YANR02'};
describe('phase two calculation goal boundaries',()=>{
  it('checks the actual dedup key and filters before executing, independently of column labels',async()=>{
    const execute=vi.fn(async()=>({rows:[],importedAt:'2026-10-30'}));
    const wrong={...plan,select:[plan.select[0],{...plan.select[1],label:'不同比赛数',expr:{fn:'count',args:[]}}]};
    const result=await runAnalysisQuery({title:'比赛数',description:'看起来正确',goal,query:wrong},'zh',AbortSignal.timeout(1000),new Set(['2017YANR02']),execute,context);
    expect(execute).not.toHaveBeenCalled();expect(result.evidence).toMatchObject({notEvidence:true,validation:{status:'rejected'}});
    await runAnalysisQuery({title:'比赛数',description:'实际查询',goal,query:plan},'zh',AbortSignal.timeout(1000),new Set(['2017YANR02']),execute,context);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it.each([0,1,2,3])('rejects missing required predicate %i rather than trusting goal metadata',index=>{
    const checked=checkAnalysisGoal(compileAnalysis({...plan,where:{op:'and',args:filters.filter((_,i)=>i!==index)}}),goal,context);
    expect(checked.status).toBe('rejected');
  });
  it('does not accept a required filter hidden under OR',()=>{
    expect(checkAnalysisGoal(compileAnalysis({...plan,where:{op:'or',args:filters}}),goal,context).status).toBe('rejected');
  });
  it('preserves query provenance and grouping through a previous stage',()=>{
    const staged={steps:[{name:'months',query:plan}],from:{dataset:'months',as:'m'},select:[{as:'month',label:'月',expr:col('m.month')},{as:'n',label:'数',expr:col('m.n')}]};
    expect(checkAnalysisGoal(compileAnalysis(staged),goal,context).status).toBe('program_checks_passed');
  });
  it('requires a goal at the orchestrated boundary and exposes the actual normalized plan',async()=>{
    const execute=vi.fn(async()=>({rows:[{month:'1',n:'2'}],importedAt:'2026-10-30'}));
    const call={title:'测试',description:'测试',query:plan};
    expect((await runAnalysisQuery(call,'zh',AbortSignal.timeout(1000),new Set(['2017YANR02']),execute,context)).sources).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
    const result=await runAnalysisQuery({...call,goal},'zh',AbortSignal.timeout(1000),new Set(['2017YANR02']),execute,context);
    expect(result.evidence).toMatchObject({goal,actualQuery:{where:plan.where},validation:{semanticReviewRequired:true},rows:[['1','2']]});
  });
  it('rejects a goal that changes the original year, granularity, metric or identity',()=>{
    for(const change of [{grain:'total'},{metric:'cities'},{time:{...goal.time!,from:'2025-01-01'}},{personIds:['2018TEST01']}])expect(checkAnalysisGoal(compileAnalysis(plan),{...goal,...change} as AnalysisGoal,context).status).toBe('rejected');
  });
  it('rejects the value IN(1,-1) DNF denominator and requires the actual ratio in output',()=>{
    const count=(filter:unknown)=>({fn:'count',args:[],filter});
    const denominator=count({op:'in',args:[col('a.value'),v(1),v(-1)]});
    const numerator=count(eq('a.value',-1));
    const query={from:{dataset:'attempts',as:'a'},select:[{as:'dnf',label:'DNF',expr:numerator},{as:'denominator',label:'总数',expr:denominator},{as:'rate',label:'率',expr:{op:'/',args:[numerator,denominator]}}]};
    const g:AnalysisGoal={metric:'dnf_rate',subject:'all',personIds:[],grain:'total',outputs:['分子','分母','比例']};
    expect(checkAnalysisGoal(compileAnalysis(query),g).status).toBe('rejected');
    const valid=count({op:'or',args:[{op:'>',args:[col('a.value'),v(0)]},eq('a.value',-1)]});
    const fixed={...query,select:[query.select[0],{...query.select[1],expr:valid},{...query.select[2],expr:{op:'/',args:[numerator,valid]}}]};
    expect(checkAnalysisGoal(compileAnalysis(fixed),g).status).toBe('program_checks_passed');
    const countValue=JSON.parse(JSON.stringify(fixed),(_key,value)=>value?.fn==='count'?{...value,args:[col('a.value')]}:value);
    expect(checkAnalysisGoal(compileAnalysis(countValue),g).status).toBe('program_checks_passed');
    const countOrdinal=JSON.parse(JSON.stringify(countValue),(_key,value)=>value?.fn==='count'?{...value,args:[col('a.attempt_number')]}:value);
    expect(checkAnalysisGoal(compileAnalysis(countOrdinal),g).status).toBe('program_checks_passed');
    const distinctOrdinal=JSON.parse(JSON.stringify(countOrdinal),(_key,value)=>value?.fn==='count'?{...value,distinct:true}:value);
    expect(checkAnalysisGoal(compileAnalysis(distinctOrdinal),g).status).toBe('rejected');
    const windowOrdinal=JSON.parse(JSON.stringify(countOrdinal),(_key,value)=>value?.fn==='count'?{...value,over:{partitionBy:[]}}:value);
    expect(checkAnalysisGoal(compileAnalysis(windowOrdinal),g).status).toBe('rejected');
    const wrongColumn=JSON.parse(JSON.stringify(countValue),(_key,value)=>value?.fn==='count'?{...value,args:[col('a.comp_id')]}:value);
    expect(checkAnalysisGoal(compileAnalysis(wrongColumn),g).status).toBe('rejected');
    const distinct=JSON.parse(JSON.stringify(countValue),(_key,value)=>value?.fn==='count'?{...value,distinct:true}:value);
    expect(checkAnalysisGoal(compileAnalysis(distinct),g).status).toBe('rejected');
    const reversed={...fixed,select:[...fixed.select.slice(0,2),{...fixed.select[2],expr:{op:'/',args:[valid,numerator]}}]};
    expect(checkAnalysisGoal(compileAnalysis(reversed),g).status).toBe('rejected');
    const unrelated={...fixed,select:[...fixed.select.slice(0,2),{...fixed.select[2],expr:{op:'/',args:[v(1),v(2)]}}]};
    expect(checkAnalysisGoal(compileAnalysis(unrelated),g).status).toBe('rejected');
  });
  it('accepts an exact host-country set while rejecting nationality substitution',()=>{
    const p={from:{dataset:'competitions',as:'c'},select:[{as:'n',label:'场次',expr:{fn:'count',args:[]}}],where:{op:'in',args:[col('c.country_id'),v('China'),v('Japan')]}};
    const g:AnalysisGoal={metric:'competitions',subject:'all',personIds:[],grain:'total',location:{basis:'host',countryIds:['Japan','China']},outputs:['举办比赛数']};
    expect(checkAnalysisGoal(compileAnalysis(p),g,{question:'在中国和日本举办的比赛场次'}).status).toBe('program_checks_passed');
    expect(checkAnalysisGoal(compileAnalysis(p),{...g,location:{...g.location!,basis:'nationality'}},{question:'在中国和日本举办的比赛场次'}).status).toBe('rejected');
  });
});
const corpus={updated:'2026-10-30T00:00:00.000Z',releaseId:'release-fixture',pages:[{lang:'zh' as const,href:'/regulation/test',title:'赛制',sourceType:'rule' as const,sourceVersion:'2026-10',text:'报名要求与例外',sections:[{id:'T1',title:'报名',path:['赛制','报名'],clause:'T1',text:'T1 报名要求：需要年满十二岁。'},...Array.from({length:7},(_,i)=>({id:'X'+i,title:'其他报名',path:['赛制','其他报名'],text:('其他报名须知与十二岁参赛规定。'.repeat(80))})),{id:'T1a',title:'特别例外',path:['赛制','报名','例外'],parentId:'T1',clause:'T1a',text:'T1a 例外：十一岁选手获得监护人书面同意后可以报名。'}]}]};
describe('phase two retrieval and evidence completeness',()=>{
  it('revokes citation eligibility for passages omitted by the context budget',()=>{
    const result=boundAssistantToolResult({evidence:{pages:[{id:'keep',content:'Complete passage'},{id:'drop',content:'x'.repeat(2000)}]},sources:[{id:'keep',title:'Keep',href:'/a',read:true},{id:'drop',title:'Drop',href:'/b',read:true}],artifacts:[]},250);
    expect(result.sources.map(source=>source.id)).toEqual(['keep']);
    expect(result.evidence).toMatchObject({contextIncomplete:true});
    expect(boundAssistantToolResult(result,20).sources).toEqual([]);
  });
  it('uses exact document titles and version-independent titles to retain source identity',()=>{
    const index={updated:corpus.updated,pages:[{lang:'zh' as const,href:'/a',title:'2025 版公开教程',text:'步骤'},{lang:'zh' as const,href:'/b',title:'动态页面入口',text:''}]};
    expect(knowledgePageReferences(index,'这份公开教程2026版是否一样？','zh')).toEqual(['/a']);
    expect(knowledgePageReferences(index,'请读动态页面入口正文','zh')).toEqual(['/b']);
    expect(knowledgePageReferences(index,'其他教程','zh')).toEqual([]);
  });
  it('brings the qualifying exception alongside its parent clause within six passages',async()=>{
    const hits=await lexicalKnowledge(corpus,'十二岁 报名要求','zh');
    expect(hits.some(h=>h.sectionId==='T1')).toBe(true);expect(hits.some(h=>h.sectionId==='T1a')).toBe(true);expect(hits.length).toBeLessThanOrEqual(6);
    expect(hits.find(h=>h.sectionId==='T1a')).toMatchObject({sourceVersion:'2026-10',sourceType:'rule',sectionPath:['赛制','报名','例外']});
  });
  it('keeps repeated sections and continuations from crowding the rule and its exception out',async()=>{
    const hits=await lexicalKnowledge(corpus,'年满十二岁报名要求','zh');
    expect(hits.some(h=>h.sectionId==='T1')).toBe(true);
    expect(hits.some(h=>h.sectionId==='T1a')).toBe(true);
    expect(hits.length).toBeLessThanOrEqual(6);
  });
  it('preserves long-question tail constraints for both lexical and embedding input',()=>{
    const query=knowledgeQuery('报名要求','背景'.repeat(1200)+'最后约束：2025 年十一岁');
    expect(query.length).toBeLessThanOrEqual(1900);expect(query).toContain('2025 年十一岁');expect(query).toContain('报名要求');
  });
  it('prioritizes explicit exceptions over continuation chunks and exposes omissions',async()=>{
    const long={...corpus,pages:[{...corpus.pages[0],sections:[{...corpus.pages[0].sections[0],text:'报名要求。'.repeat(2000)},corpus.pages[0].sections.at(-1)!]}]};
    const chunks=await chunkKnowledge(long),hits=expandKnowledge([chunks[0]],chunks);
    expect(hits.some(c=>c.sectionId==='T1a')).toBe(true);
    expect(hits[0].relatedOmitted).toBe(true);expect(hits).toHaveLength(6);
  });
  it('invalidates semantic metadata changes without re-embedding identical content',async()=>{
    const changed={...corpus,pages:corpus.pages.map(p=>({...p,sourceVersion:'2026-11'}))};
    expect(knowledgeGeneration(changed)).not.toBe(knowledgeGeneration(corpus));
    const [a]=await chunkKnowledge(corpus),[b]=await chunkKnowledge(changed);expect(a.fingerprint).toBe(b.fingerprint);expect(a.id).not.toBe(b.id);
    expect(knowledgeGeneration({...corpus,updated:'2026-10-31T00:00:00.000Z'})).toBe(knowledgeGeneration(corpus));
  });
  it('keeps entire passages and scope metadata instead of slicing JSON',()=>{
    const input={updated:'2026-10-30',pages:[{id:'a',content:'完整条款。'.repeat(20)},{id:'b',content:'另一条。'.repeat(100)}]};
    const result=boundAssistantEvidence(input,JSON.stringify({...input,pages:[input.pages[0]],truncated:true,contextIncomplete:true}).length) as any;
    expect(result.pages).toEqual([input.pages[0]]);expect(result.contextIncomplete).toBe(true);expect(result.excerpt).toBeUndefined();
    expect(boundAssistantEvidence({actualQuery:'x'.repeat(1000),rows:[['1']]},300)).toMatchObject({notEvidence:true});
  });
  it('distinguishes corpus, release, chunk version and readiness mismatches',()=>{
    const identity='fixture:512',generation=knowledgeHash(`${KNOWLEDGE_VERSION}:${identity}:${knowledgeGeneration(corpus)}`);
    const state={generation,chunk_version:KNOWLEDGE_VERSION,release_id:'release-fixture',chunk_count:10};
    expect(knowledgeIndexStatus(corpus,identity,state).indexReady).toBe(true);
    expect(knowledgeIndexStatus(corpus,identity,{...state,chunk_version:'old'}).reason).toBe('index_mismatch');
    expect(knowledgeIndexStatus(corpus,identity,{...state,release_id:'old'}).reason).toBe('release_mismatch');
    expect(knowledgeIndexStatus(corpus,identity,{...state,chunk_count:0}).reason).toBe('index_incomplete');
    expect(knowledgeCoverage(corpus)).toMatchObject({pages:1,bodyPages:1,structuredPages:1,datedPages:0});
  });
  it('warns on sustained fallback and clears it on successful hybrid recovery',()=>{
    assistantRetrievalHealth({mode:'hybrid'},0);
    expect(assistantRetrievalHealth({mode:'local_lexical'},100).alert).toBe(false);
    expect(assistantRetrievalHealth({mode:'fallback'},1000).alert).toBe(false);
    expect(assistantRetrievalHealth({mode:'database_lexical'},901000).alert).toBe(true);
    expect(assistantRetrievalHealth({mode:'fallback'},902000).alert).toBe(false);
    expect(assistantRetrievalHealth({mode:'hybrid'},903000)).toEqual({degradedMs:0,alert:false});
  });
});
