import postgres from 'postgres';
import { createHash } from 'node:crypto';
import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { databaseSettings } from '../db/settings.js';
import { ANALYSIS_DATASETS, ANALYSIS_PLAN_GUIDE, AnalysisInputError, compileAnalysis, analysisCountLabel, analysisGoalSchema, checkAnalysisGoal, type AnalysisDataset, type AnalysisGoal } from './site_assistant_analysis.js';
import type { ToolResult } from './site_assistant_tools.js';

export function describeAnalysis(datasets:AnalysisDataset[]):ToolResult {
  const names=datasets.length?datasets:Object.keys(ANALYSIS_DATASETS) as AnalysisDataset[];
  return {sources:[],artifacts:[],evidence:{datasets:names.map(id=>({id,...ANALYSIS_DATASETS[id]})),instructions:ANALYSIS_PLAN_GUIDE,limits:{rows:100,steps:3,queryTimeoutMs:4000},availability:'Public projections of imported WCA results and published site content. Missing data cannot be inferred from training memory.'}};
}
let active=0;
export type CompiledAnalysis = ReturnType<typeof compileAnalysis>;
export interface AnalysisRows { rows:Record<string,unknown>[]; importedAt:string|null }

/** Fresh, independent connection; never queues behind or changes the business pool. */
export async function executeAnalysis<Query extends Pick<CompiledAnalysis,'sql'|'params'|'datasets'>>(query:Query,signal:AbortSignal,goal?:AnalysisGoal):Promise<AnalysisRows> {
  signal.throwIfAborted();
  if(active>=2)throw new AnalysisInputError('Analysis is busy. Do not retry in this answer; ask the visitor to try later.');
  active++;
  const db=postgres({...databaseSettings(),max:1,connect_timeout:2,idle_timeout:1,prepare:false,
    // postgres.js omits falsy startup values; the string preserves the zero limit.
    connection:{application_name:'cuberoot-assistant-analysis',default_transaction_read_only:true,statement_timeout:4000,lock_timeout:500,work_mem:'4MB',max_parallel_workers_per_gather:'0',search_path:'pg_catalog'},
  });
  let pending:{cancel:()=>void}|undefined;
  const close=()=>{pending?.cancel();void db.end({timeout:0}).catch(()=>{});};
  // Covers transport/setup/commit as well as individual PG statement deadlines.
  const timer=setTimeout(close,6500);
  signal.addEventListener('abort',close,{once:true});
  try {
    return await db.begin('isolation level repeatable read read only',async tx=>{
      const run=async(statement:string,params:unknown[]=[])=>{
        signal.throwIfAborted();
        const task=tx.unsafe(statement,params as never[]);pending=task;
        try { return await task; } finally { pending=undefined; }
      };
      signal.throwIfAborted();
      await run('SET LOCAL ROLE cuberoot_assistant_reader');
      // Read freshness and required public projections in the same snapshot as the answer.
      // An empty/missing import component cannot establish a zero for a visitor's filters.
      const required=['competitions','results','persons','countries'].filter(dataset=>query.datasets.some(name=>name===dataset || (name==='attempts' && dataset==='results')));
      const checks=required.map(dataset=>'EXISTS (SELECT 1 FROM assistant_public.'+dataset+')');
      const coverageParams:string[]=[];
      const needsHostMap=goal?.location?.basis==='host' && 'continentIds' in goal.location || goal?.metric==='countries' && !goal.location;
      if (needsHostMap && required.includes('competitions') && required.includes('countries')) {
        if (goal?.time?.basis==='competition_start')coverageParams.push(goal.time.from,goal.time.before);
        checks.push(`NOT EXISTS (SELECT 1 FROM assistant_public.competitions c
          LEFT JOIN assistant_public.countries h ON h.id=c.country_id
          WHERE (h.id IS NULL OR NULLIF(h.continent_id,'') IS NULL)`+
          (coverageParams.length?' AND c.start_date >= $1 AND c.start_date < $2':'')+')');
      }
      const [freshness]=await run('SELECT imported_at, '+(checks.join(' AND ') || 'TRUE')+' AS complete FROM assistant_public.freshness',coverageParams);
      if (required.length && freshness?.complete===false)throw new AnalysisInputError('A required WCA projection or host country mapping is incomplete; no count is verified.');
      const importedAt=freshness?.imported_at instanceof Date?freshness.imported_at.toISOString():freshness?.imported_at?String(freshness.imported_at):null;
      if(query.datasets.some(name=>['results','attempts','competitions','persons','countries'].includes(name)) && !importedAt)throw new AnalysisInputError('The WCA import timestamp is missing; coverage is unavailable, not zero.');
      const plans=await run('EXPLAIN (FORMAT JSON) '+query.sql,query.params);
      const root=plans[0]?.['QUERY PLAN']?.[0]?.Plan;
      function costly(node:any):boolean {return !node || Number(node['Total Cost'])>1_000_000 || (node.Plans ?? []).some(costly);}
      if(costly(root))throw new AnalysisInputError('Query exceeds the analysis cost budget. Narrow the person, event or date range; do not report zero.');
      signal.throwIfAborted();
      const rows=await run(query.sql,query.params);
      signal.throwIfAborted();
      return {rows:[...rows],importedAt};
    }) as AnalysisRows;
  } finally {
    clearTimeout(timer);signal.removeEventListener('abort',close);
    try { await db.end({timeout:0}); } finally { active--; }
  }
}

export async function runAnalysisQuery(call:{title:string;description:string;query:unknown;goal?:AnalysisGoal},lang:'en'|'zh',signal:AbortSignal,knownPeople:Set<string>,execute=executeAnalysis,context?:{question:string;normalizedQuestion?:string;viewerWcaId?:string}):Promise<ToolResult> {
  try {
    let compiled:CompiledAnalysis;
    try {compiled=compileAnalysis(call.query);} catch (error) {
      if (!(error instanceof AnalysisInputError))throw error;
      return {sources:[],artifacts:[],evidence:{notEvidence:true,error:error.message,validation:{status:'rejected',issues:[error.message]}}};
    }
    if(context && !call.goal)throw new AnalysisInputError('Provide a compact goal matching the original question before executing analysis_query.');
    const goal=call.goal?analysisGoalSchema.parse(call.goal):undefined;
    const validation=goal?checkAnalysisGoal(compiled,goal,context):undefined;
    if(validation?.status==='rejected')return {sources:[],artifacts:[],evidence:{notEvidence:true,error:'The plan does not implement the requested goal. Correct the actual query; changing titles cannot repair it.',goal,actualQuery:compiled.plan,validation}};
    for(const value of compiled.params)if(typeof value==='string' && /^\d{4}[A-Z]{4}\d{2}$/.test(value) && !knownPeople.has(value))throw new AnalysisInputError('Unresolved WCA ID. Use find_person first; never invent a person ID.');
    const result=await execute(compiled,signal,goal);
    let truncated=result.rows.length>compiled.limit,characters=0;
    const rows:string[][]=[];
    for(const row of result.rows.slice(0,compiled.limit)) {
      const cells=compiled.columns.map(c=>{
        const raw=row[c.key]==null?'—':String(row[c.key]);
        const text=c.personName?displayCuberName(raw,lang==='zh'):raw;
        if(text.length>500)truncated=true;
        return text.length>500?text.slice(0,500)+'…':text;
      });
      const size=JSON.stringify(cells).length;
      if(characters+size>9000){truncated=true;break;}
      rows.push(cells);characters+=size;
    }
    const id='analysis:'+createHash('sha256').update(JSON.stringify([compiled.sql,compiled.params])).digest('hex').slice(0,16);
    const label={zh:'现场计算',en:'Computed analysis'}[lang];
    const columns=compiled.columns.map(c=>({...c,...(c.countMeasure?{countUnit:analysisCountLabel(c.countMeasure,lang)}:{})}));
    return {sources:[{id,title:call.title,href:ANALYSIS_DATASETS[compiled.datasets[0]].href,read:true}],
      factualSummary:{zh:'现场计算结果见下表。',en:'The computed results are shown below.'}[lang],
      artifacts:[{kind:'table',title:call.title,columns:columns.map(c=>c.countUnit && !c.label.includes(c.countUnit)?`${c.label} · ${c.countUnit}`:c.label),rows}],
      evidence:{goal,actualQuery:compiled.plan,validation,description:call.description,datasets:compiled.datasets,importedAt:result.importedAt,columns,rows,truncated,returnedRows:rows.length,
        basis:label,instruction:'Review the actual query predicates and these rows against the question before finalizing. Description and column headings were authored by you; they do not prove the query implements that method. If a displayed total/denominator contradicts its components, correct the query and use only the corrected source ID; NEVER silently fix the number in prose while leaving a wrong table. Include derived rates/differences in the database query. These rows were computed before output limiting. State only the scope, units or denominator necessary to interpret the answer, once; keep the complete method in evidence. Imported WCA data is not live. Returned database aggregate/window values were computed BEFORE the output limit and remain valid for their actual query scope even if detail rows are truncated. Truncation alone does not invalidate those totals; do not replace a correct aggregate with a sum/count of visible rows. Never aggregate truncated rows or treat NULL as zero. Empty rows alone are not a zero count. Cite this analysis source; do not claim broader coverage than these projections.'},
    };
  } catch(error) {
    signal.throwIfAborted();
    const code=(error as {code?:string})?.code;
    if(!(error instanceof AnalysisInputError))console.warn(JSON.stringify({event:'site_assistant_analysis_error',code:code ?? 'unknown'}));
    const errorText=error instanceof AnalysisInputError?error.message
      : code==='57014'?'Query timed out. Narrow the scope; do not treat failure as zero.'
      : code==='42803'?'Invalid aggregation: group all non-aggregate selected/ordered expressions, or move window results to an earlier step.'
      : ['42883','42804','22P02','22023','22012','42601'].includes(code ?? '')?'Expression types or function arguments are invalid. Check schema, units and function arity, then correct the plan.'
      : 'Analysis data is temporarily unavailable. Do not retry in this answer or substitute a fabricated result.';
    return {sources:[],artifacts:[],evidence:{error:errorText,notEvidence:true}};
  }
}
