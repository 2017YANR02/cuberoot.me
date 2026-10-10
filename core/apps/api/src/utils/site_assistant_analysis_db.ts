import postgres from 'postgres';
import { createHash } from 'node:crypto';
import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { databaseSettings } from '../db/settings.js';
import { ANALYSIS_DATASETS, ANALYSIS_PLAN_GUIDE, AnalysisInputError, compileAnalysis, type AnalysisDataset } from './site_assistant_analysis.js';
import type { ToolResult } from './site_assistant_tools.js';

export function describeAnalysis(datasets:AnalysisDataset[]):ToolResult {
  const names=datasets.length?datasets:Object.keys(ANALYSIS_DATASETS) as AnalysisDataset[];
  return {sources:[],artifacts:[],evidence:{datasets:names.map(id=>({id,...ANALYSIS_DATASETS[id]})),instructions:ANALYSIS_PLAN_GUIDE,limits:{rows:100,steps:3,queryTimeoutMs:4000},availability:'Public projections of imported WCA results and published site content. Missing data cannot be inferred from training memory.'}};
}
let active=0;
export type CompiledAnalysis = ReturnType<typeof compileAnalysis>;
export interface AnalysisRows { rows:Record<string,unknown>[]; importedAt:string|null }

/** Fresh, independent connection; never queues behind or changes the business pool. */
export async function executeAnalysis(query:CompiledAnalysis,signal:AbortSignal):Promise<AnalysisRows> {
  signal.throwIfAborted();
  if(active>=2)throw new AnalysisInputError('Analysis is busy. Do not retry in this answer; ask the visitor to try later.');
  active++;
  const db=postgres({...databaseSettings(),max:1,connect_timeout:2,idle_timeout:1,prepare:false,
    connection:{application_name:'cuberoot-assistant-analysis',default_transaction_read_only:true,statement_timeout:4000,lock_timeout:500,work_mem:'4MB',max_parallel_workers_per_gather:0,search_path:'pg_catalog'},
  });
  let pending:{cancel:()=>void}|undefined;
  const close=()=>{pending?.cancel();void db.end({timeout:0}).catch(()=>{});};
  // Covers transport/setup/commit as well as individual PG statement deadlines.
  const timer=setTimeout(close,6500);
  signal.addEventListener('abort',close,{once:true});
  try {
    return await db.begin('read only',async tx=>{
      const run=async(statement:string,params:unknown[]=[])=>{
        signal.throwIfAborted();
        const task=tx.unsafe(statement,params as never[]);pending=task;
        try { return await task; } finally { pending=undefined; }
      };
      signal.throwIfAborted();
      await run('SET LOCAL ROLE cuberoot_assistant_reader');
      const [freshness]=await run('SELECT imported_at FROM assistant_public.freshness');
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

export async function runAnalysisQuery(call:{title:string;description:string;query:unknown},lang:'en'|'zh',signal:AbortSignal,knownPeople:Set<string>,execute=executeAnalysis):Promise<ToolResult> {
  try {
    const compiled=compileAnalysis(call.query);
    for(const value of compiled.params)if(typeof value==='string' && /^\d{4}[A-Z]{4}\d{2}$/.test(value) && !knownPeople.has(value))throw new AnalysisInputError('Unresolved WCA ID. Use find_person first; never invent a person ID.');
    const result=await execute(compiled,signal);
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
    return {sources:[{id,title:call.title,href:ANALYSIS_DATASETS[compiled.datasets[0]].href,read:true}],
      artifacts:[{kind:'table',title:call.title,columns:compiled.columns.map(c=>c.label),rows}],
      evidence:{description:call.description,datasets:compiled.datasets,importedAt:result.importedAt,columns:compiled.columns,rows,truncated,returnedRows:rows.length,
        basis:label,instruction:'These rows were computed from the full filtered public datasets before output limiting. Description is the requested method, not independently verified interpretation. State actual filters, units and denominator; imported WCA data is not live. Never aggregate truncated rows or treat NULL as zero. Empty rows alone are not a zero count. Cite this analysis source; do not claim broader coverage than these projections.'},
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
