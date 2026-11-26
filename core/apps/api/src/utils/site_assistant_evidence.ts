import type { ToolResult } from './site_assistant_tools.js';

/** Tool completion and factual completeness are different states. */
export function assistantToolOutcome(result: ToolResult): NonNullable<ToolResult['outcome']> {
  const data=result.evidence;
  if(result.outcome && (result.outcome.state==='blocked' || result.outcome.state==='temporary_failure'))return result.outcome;
  if(data && typeof data==='object' && 'notEvidence' in data && data.notEvidence===true)return {state:'partial',reason:'evidence_incomplete'};
  if(result.outcome)return result.outcome;
  if(data && typeof data==='object' && 'contextIncomplete' in data && data.contextIncomplete===true)return {state:'partial',reason:'evidence_incomplete'};
  if(data && typeof data==='object' && 'status' in data && data.status==='unavailable')return {state:'temporary_failure',reason:'source_unavailable'};
  const arrays=Array.isArray(data)?[data]:data && typeof data==='object'
    ? ['rows','articles','competitions','results','items','entries'].flatMap(key=>Array.isArray((data as Record<string,unknown>)[key])?[(data as Record<string,unknown>)[key] as unknown[]]:[]):[];
  return {state:arrays.length && arrays.every(rows=>!rows.length)?'empty':'success'};
}

/** Allocate complete evidence units. A truncated JSON string is never evidence. */
export function boundAssistantEvidence(input:unknown,budget:number):unknown {
  const size=(value:unknown)=>JSON.stringify(value)?.length ?? 0;
  if(size(input)<=budget)return input;
  const missing={notEvidence:true,truncated:true,error:'Evidence exceeds the remaining context budget. Missing fields are unknown; do not infer values or claim absence.'};
  if(!input || typeof input!=='object' || Array.isArray(input) || budget<size(missing))return missing;
  const record=input as Record<string,unknown>;
  // Keep scope, query/goal, units and freshness together, then add whole pages/rows.
  const arrayKeys=['pages','rows','results','items','destinations','articles','originals','entries'].filter(key=>Array.isArray(record[key]));
  if(!arrayKeys.length)return missing;
  const base:Record<string,unknown>={...record,truncated:true,contextIncomplete:true};
  for(const key of arrayKeys)base[key]=[];
  if(size(base)>budget)return missing;
  for(const key of arrayKeys)for(const item of record[key] as unknown[]) {
    (base[key] as unknown[]).push(item);
    if(size(base)>budget){(base[key] as unknown[]).pop();break;}
  }
  if(arrayKeys.every(key=>!(base[key] as unknown[]).length))return missing;
  if(Array.isArray(base.entries)) {
    const retained=new Set(base.entries.map(item=>item?.sourceId));
    base.entries=base.entries.map(item=>{
      if(!item || !Array.isArray(item.expansionSourceIds) || item.expansionSourceIds.every((id:unknown)=>retained.has(id)))return item;
      const {expandedEnglish,expansionSourceIds,...quoted}=item;
      return quoted;
    });
  }
  if(Array.isArray(base.originals) && Array.isArray(base.verifiedSourceIds)) {
    const retained=new Set(base.originals.flatMap(item=>item && typeof item==='object' && 'id' in item?[item.id]:[]));
    base.verifiedSourceIds=base.verifiedSourceIds.filter(id=>retained.has(id));
  }
  if('rows'in base)base.returnedRows=(base.rows as unknown[]).length;
  return base;
}

/** A dropped evidence unit must not leave behind a citeable source. */
export function boundAssistantToolResult(result:ToolResult,budget:number):ToolResult {
  const evidence=boundAssistantEvidence(result.evidence,budget);
  const data=evidence as Record<string,unknown> | null;
  if(data?.notEvidence===true) {
    const outcome=result.outcome && ['partial','blocked','temporary_failure'].includes(result.outcome.state) ? result.outcome : {state:'partial' as const,reason:evidence===result.evidence?'evidence_unavailable':'context_budget'};
    return {...result,evidence,sources:[],artifacts:[],roundRows:undefined,factualSummary:undefined,outcome};
  }
  if(evidence===result.evidence || !data)return result;
  const keyed=['pages','entries','originals','destinations'].filter(key=>Array.isArray(data[key]));
  const ids=new Set(keyed.flatMap(key=>(data[key] as Array<{id?:unknown;sourceId?:unknown}>).flatMap(item=>[item.id,item.sourceId]).filter((id):id is string=>typeof id==='string')));
  const sources=keyed.length?result.sources.filter(source=>ids.has(source.id)):result.sources;
  return {...result,evidence,sources,artifacts:sources.length?result.artifacts:[],factualSummary:undefined,outcome:{state:'partial',reason:'context_budget'}};
}
