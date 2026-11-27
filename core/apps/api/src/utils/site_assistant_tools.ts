import { glossaryText, glossaryNotationKey, glossaryListParts, glossaryGroupingSubject } from './site_assistant_glossary_aliases.js';
import { roundAnswer, type RoundRow } from './site_assistant_round.js';
import { checkpointAssistantTool } from './site_assistant_execution.js';
import { attendanceLocationResult } from './site_assistant_locations.js';
import { annualAnswer, fourthsId } from './site_assistant_public_queries.js';
import { z } from 'zod';
import { formatWcaResult } from '@cuberoot/shared/wca-format-result';
import { selectCurrentRecords, personalRecordFlags, type WcaRecordRow } from '@cuberoot/shared/wca-records';
import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { WCA_EVENT_ORDER, EVENT_DISPLAY_ZH, EVENT_DISPLAY_EN } from '@cuberoot/shared/wca-events';
import { localizeCompName } from '@cuberoot/shared/comp-localize';
import { localizeCity } from '@cuberoot/shared/city-localize';
import { formatDateRangeIso, isValidIsoDate } from '@cuberoot/shared/iso-date';
import { roundChronologicalOrder } from '@cuberoot/shared/wca-round';
import { mergeCompetitionIndexes } from '@cuberoot/shared/competition-index';
import type { AssistantAnswer, AssistantArtifact, AssistantSource, AssistantTable } from '@cuberoot/shared/site-assistant';
import { PHOTO_ALG_SETS, POCKET_PHOTO_ALG_SETS, FOUR_PHOTO_ALG_SETS } from '@cuberoot/shared/cube-photo/lookup';
import { findAssistantPeople } from './site_assistant_people.js';
import { analysisSchemaCall, analysisQueryCall } from './site_assistant_analysis.js';
import { readAssistantNews } from './site_assistant_news.js';
import { readStatisticsMetadata } from './site_assistant_statistics_metadata.js';
import { readStatisticsRuntime } from './site_assistant_statistics_runtime.js';
import { algorithmCards } from './site_assistant_algorithms.js';
import { formulaReviewCall } from './site_assistant_formula_reviews.js';
import { verifyCubeMovesCall } from './site_assistant_moves.js';
import { competitionScheduleCall, readCompetitionSchedule } from './site_assistant_competition_schedule.js';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const competitionId = id.refine(value=>!/^\d{4}[A-Z]{4}\d{2}$/.test(value),'This is a person WCA ID; use wcaId, not compId.');
const event = z.enum(WCA_EVENT_ORDER).default('333');
const query = z.string().trim().min(1).max(100);
const date=z.string().refine(isValidIsoDate,'Expected an ISO calendar date');
export const toolCallSchema = z.discriminatedUnion('tool', [
  analysisSchemaCall,
  analysisQueryCall,
  verifyCubeMovesCall,
  formulaReviewCall,
  competitionScheduleCall,
  z.object({ tool: z.literal('deliberate') }).strict(),
  z.object({ tool: z.literal('web_search'), query: z.string().trim().min(2).max(300), recency: z.enum(['any','day','week','month','year']).default('any'), from: date.optional(), to: date.optional(), dateBasis: z.enum(['publication','event']).optional() }).strict().refine(value=>!value.from || !value.to || value.from<=value.to,{message:'Date range is reversed'}),
  z.object({ tool: z.literal('news'), from: date.optional(), to: date.optional(), limit: z.number().int().min(1).max(10).default(5) }).strict().refine(value=>!value.from || !value.to || value.from<=value.to,{message:'Date range is reversed'}),
  z.object({ tool: z.literal('records'), event, region: z.string().regex(/^(world|[A-Z]{2})$/).default('world') }).strict(),
  z.object({ tool: z.literal('find_person'), query }).strict(),
  z.object({ tool: z.literal('person_countries'), location: z.object({country:z.string().regex(/^[A-Z]{2}$/), view:z.enum(['regions','cities','competitions']),region:z.string().trim().min(1).max(40).regex(/^[\p{L} .’-]+$/u).optional()}).strict().optional(), wcaId: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/), event: z.enum(WCA_EVENT_ORDER).optional(), from: date.optional(), to: date.optional() }).strict().refine(value=>!value.from || !value.to || value.from<=value.to,{message:'Date range is reversed'}),
  z.object({ tool: z.literal('person_competitions'), wcaId: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/), event: z.enum(WCA_EVENT_ORDER).optional(), from: date.optional(), to: date.optional(), groupBy: z.literal('year').optional(), view: z.literal('latest').optional() }).strict().refine(value=>!value.from || !value.to || value.from<=value.to,{message:'Date range is reversed'}).refine(value=>!value.groupBy || !value.view),
  z.object({ tool: z.literal('person'), wcaId: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/), event: z.enum([...WCA_EVENT_ORDER, 'all']).default('333'), metric: z.enum(['single','average']).optional(), rankings: z.boolean().optional(), progress: z.boolean().default(false), view: z.enum(['records','profile']).optional() }).strict().refine(value=>value.event!=='all' || !value.progress,{path:['event'],message:'Progress charts require one event; use all only for current personal bests.'}).refine(value=>value.view!=='profile' || (!value.metric && !value.progress && value.rankings===undefined),{path:['view'],message:'Use records view for metric, rankings or progress requests.'}),
  z.object({ tool: z.literal('rankings'), event, type: z.enum(['single','average']).default('single'), country: z.string().regex(/^([A-Z]{2}|_Asia|_Europe|_Africa|_North America|_South America|_Oceania)?$/).default(''), year: z.number().int().min(2003).max(2100).optional(), limit: z.number().int().min(1).max(20).default(10) }).strict(),
  z.object({ tool: z.literal('competitions'), query: z.string().max(100).default(''), city: z.string().trim().min(1).max(100).optional(), country: z.string().regex(/^([A-Z]{2})?$/).default(''), upcoming: z.boolean().default(true), from:date.optional(),to:date.optional(), limit: z.number().int().min(1).max(20).default(10) }).strict().refine(value=>!value.from || !value.to || value.from<=value.to,{message:'Date range is reversed'}),
  z.object({ tool: z.literal('annual_attendance'), limit:z.number().int().min(1).max(20).default(3) }).strict(),
  z.object({ tool: z.literal('competition_round'), compId:competitionId,event,details:z.boolean().optional(),people:z.array(z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/)).min(1).max(20).optional(),round:z.enum(['semifinal','final','first','second','third','f','c','1','2','3','d','e','g','b','h','0']).default('final'),limit:z.number().int().min(1).max(20).default(10) }).strict(),
  z.object({ tool: z.literal('scrambles'), compId: competitionId, event, round: z.string().regex(/^[a-z0-9]{1,2}$/).default('f') }).strict(),
  z.object({ tool: z.literal('recons'), wcaId: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/).optional(), compId: competitionId.optional(), value: z.number().positive().max(360000).optional(), event: z.string().regex(/^[A-Za-z0-9]+$/).optional(), limit: z.number().int().min(1).max(20).default(10) }).strict(),
  z.object({ tool: z.literal('recon'), id: z.number().int().positive() }).strict(),
  z.object({ tool: z.literal('glossary'), query }).strict(),
  z.object({ tool: z.literal('forum'), query }).strict(),
  z.object({ tool: z.literal('algorithms'), puzzle: id.default('3x3'), set: id.optional(),
    query: z.string().trim().max(100).optional(), caseId: z.number().int().positive().optional(),
    offset: z.number().int().min(0).max(50000).optional(), limit: z.number().int().min(1).max(24).optional(),
    alternative: z.number().int().min(0).max(500).optional(), display: z.enum(['both','image','text']).optional(),
  }).strict(),
  z.object({ tool: z.literal('lookup_cube_photo'), imageRef: z.string().regex(/^(?:current:[0-2]|history:[0-9]:[0-2])$/),
    sets: z.union([z.literal('auto'), z.array(z.enum([...PHOTO_ALG_SETS, ...POCKET_PHOTO_ALG_SETS, ...FOUR_PHOTO_ALG_SETS])).min(1).max(PHOTO_ALG_SETS.length + POCKET_PHOTO_ALG_SETS.length + FOUR_PHOTO_ALG_SETS.length)]).default('auto'),
  }).strict(),
  z.object({ tool: z.literal('statistics'), id: id.optional(), tableKey: z.string().regex(/^[0-9.]{1,40}$/).optional(), offset: z.number().int().min(0).max(50000).optional(), limit: z.number().int().min(1).max(20).default(10) }).strict().refine(value=>!value.tableKey || !!value.id, {path:['id'],message:'A tableKey requires its statistic id. Repeat the id from the previous result; table keys are not global.'}),
  z.object({ tool: z.literal('statistics_metadata'), scope: z.literal('all').optional(), id: id.optional(), view: z.enum(['configuration','runtime']).optional() }).strict().refine(value => !(value.scope && value.id), { message: 'Choose scope all or one id.' }),
  z.object({ tool: z.literal('pages'), query, pageIds: z.array(z.string().max(120)).max(3).default([]), audience: z.enum(['user','developer']).default('user') }).strict(),
  z.object({ tool: z.literal('navigation'), query, kind: z.enum(['all','algorithms','training','solver']).default('all'), pageIds: z.array(z.string().max(200)).max(3).default([]) }).strict(),
]);
export type AssistantToolCall = z.infer<typeof toolCallSchema>;
export interface ToolResult {
  roundRows?: RoundRow[];
  evidence: unknown; sources: AssistantSource[]; artifacts: AssistantArtifact[];
  outcome?: { state: 'success' | 'empty' | 'partial' | 'temporary_failure' | 'blocked'; reason?: string };
  /** Exact published choices, for visitors explicitly asking to choose conditions first. */
  scopeChoices?: { total: number; titles: string[] };
  reconstructionAnnotations?: string[];
  factualSummary?: string;
}
/** Keep table keys identical for model tools and direct reads, including nested panels. */
export function publishedStatisticTables(data:any,lang:'zh'|'en') {
  const tables:Array<{key:string;title:string;scope:unknown;header:any[];rows:unknown[][]}>=[];
  const walk=(node:any,key:string,labels:string[],header:any[])=>{
    const nextLabels=[...labels,node.titleZh && lang==='zh' ? node.titleZh : node.title ?? (lang==='zh'?node.labelZh:node.labelEn) ?? ''].filter(Boolean);
    const columns=node.header?.length ? node.header : header;
    if (Array.isArray(node.rows) && node.rows.length) tables.push({key,title:nextLabels.join(' · '),scope:node.recordScope,header:columns,rows:node.rows});
    ['metricPanels','panels','sections','sourcePanels'].forEach((field,group)=>node[field]?.forEach((child:any,i:number)=>walk(child,key+'.'+group+'.'+i,nextLabels,columns)));
  };
  walk(data,'0',[],data.header ?? []);
  return tables;
}

export type JsonReader = (url: string) => Promise<any>;
const api = 'https://api.cuberoot.me/v1';
const stat = 'https://static.cuberoot.me/stats';
const url = (path: string, params: Record<string, string | number | undefined>) => {
  const result = new URL(path);
  for (const [key, value] of Object.entries(params)) if (value !== undefined) result.searchParams.set(key, String(value));
  return result.href;
};
const source = (id: string, title: string, href: string): AssistantSource => ({ id, title, href, read: true });
const attendancePeriod = (from: string | undefined, to: string | undefined, lang: 'zh'|'en') => {
  if (from && to && from.endsWith('-01-01') && to===from.slice(0,4)+'-12-31') return from.slice(0,4)+(lang==='zh'?' 年':'');
  return from && to ? formatDateRangeIso(from,to) : from ? lang==='zh'?`${from} 起`:`since ${from}` : to ? lang==='zh'?`截至 ${to}`:`through ${to}` : '';
};

interface GlossaryEntry {
  id: number; head?: string; body?: string;
  headEn?: string | null; headZh?: string | null; bodyEn?: string | null; bodyZh?: string | null;
  source?: string;
}
/** Resolve a bounded, unambiguous one-hop abbreviation from the same public read.
 * Preserve quoted headings; derived expansions carry both source identities. */
function glossaryExpansions(entries: GlossaryEntry[], selected: GlossaryEntry[]) {
  const parse=(entry:GlossaryEntry)=>(entry.headEn || entry.head || '').normalize('NFKC').match(/^([A-Z][A-Z0-9-]{1,12})\s*\(([^()]{1,160})\)/);
  const records=entries.filter(entry=>Number.isSafeInteger(entry.id) && entry.id>0).map(entry=>{
    const match=parse(entry);return {entry,term:match?.[1] ?? (entry.headEn || entry.head || '').normalize('NFKC').split('(',1)[0].trim(),expansion:match?.[2]};
  });
  const related=new Map<number,GlossaryEntry>();
  const expansions=new Map<number,{expandedEnglish:string;expansionSourceIds:string[]}>();
  for(const entry of selected) {
    const match=parse(entry);if(!match)continue;
    const terms=[...new Set(match[2].match(/\b[A-Z][A-Z0-9-]{1,12}\b/g) ?? [])];
    if(!terms.length || terms.length>4)continue;
    const dependencies=terms.map(term=>records.filter(record=>record.term===term));
    // Missing, ambiguous, recursive and self-referencing definitions are not proof.
    if(dependencies.some(group=>group.length!==1 || group[0].entry.id===entry.id || !group[0].expansion || /\b[A-Z][A-Z0-9-]{1,12}\b/.test(group[0].expansion)))continue;
    const resolved=dependencies.map(group=>group[0]);
    const extra=resolved.filter(record=>!selected.some(item=>item.id===record.entry.id));
    if(new Set([...related.keys(),...extra.map(record=>record.entry.id)]).size>4)continue;
    for(const record of extra)related.set(record.entry.id,record.entry);
    expansions.set(entry.id,{expandedEnglish:match[2].replace(/\b[A-Z][A-Z0-9-]{1,12}\b/g,term=>resolved.find(record=>record.term===term)!.expansion!),
      expansionSourceIds:[`wiki:${entry.id}`,...new Set(resolved.map(record=>`wiki:${record.entry.id}`))]});
  }
  return {entries:[...selected,...related.values()],expansions};
}
function glossaryMatches(entries: GlossaryEntry[], query: string) {
  const records=entries.filter(entry=>Number.isSafeInteger(entry.id) && entry.id>0).map(entry=>{
    const heads=[entry.headEn,entry.headZh,entry.head].filter((value):value is string=>typeof value==='string' && !!value.trim()).map(glossaryText);
    // Parenthesized expansions belong to their leading term, not every acronym in the definition.
    const aliases=[...new Set(heads.flatMap(head=>[head,head.split(/[（(]/,1)[0].trim()]).filter(Boolean))];
    return {entry,heads,aliases,bodies:[entry.bodyEn,entry.bodyZh,entry.body].filter((value):value is string=>typeof value==='string').map(glossaryText)};
  });
  const normalized=glossaryText(query);
  const exact=(term:string)=>{
    const literal=records.filter(record=>record.aliases.includes(term));
    if(literal.length)return literal;
    const key=glossaryNotationKey(term);
    return key ? records.filter(record=>record.aliases.includes(key)) : [];
  };
  const punctuated=glossaryListParts(normalized);
  const knownTerms=(text:string)=>{
    if(exact(text).length) return [text];
    const connected=text.split(/\s*(?:和|与|及|\b(?:and|versus|vs\.?)\b)\s*/i).filter(Boolean);
    const parts=connected.length>1 ? connected : text.split(' ');
    return parts.every(term=>exact(term).length) ? parts : [text];
  };
  // Split known headings or an explicitly punctuated list; ordinary sentences stay intact.
  const candidates=punctuated.length>1 ? punctuated.flatMap(knownTerms) : knownTerms(normalized);
  const knownList=candidates.every(term=>exact(term).length);
  const punctuatedList=punctuated.length>1 && candidates.some(term=>exact(term).length);
  const terms=!exact(normalized).length && candidates.length>1 && (knownList || punctuatedList)
    ? [...new Set(candidates)] : [normalized];
  const matches=terms.map(term=>{
    const direct=exact(term);
    if(direct.length || glossaryNotationKey(term)) return direct;
    // Unknown terms retain the original full-text/phrase search behavior.
    const contains=(text:string)=>text.includes(term);
    return records.map(record=>({record,rank:record.heads.some(contains)?1:record.bodies.some(contains)?2:0}))
      .filter(match=>match.rank>0).sort((a,b)=>a.rank-b.rank).map(match=>match.record);
  });
  const selected: GlossaryEntry[]=[];
  const seen=new Set<number>();
  // Interleave terms so a broad first term cannot crowd every later term out of the budget.
  for(let index=0; selected.length<8 && matches.some(group=>index<group.length); index++) for(const group of matches) {
    const entry=group[index]?.entry;
    if(entry && !seen.has(entry.id) && selected.length<8) {selected.push(entry);seen.add(entry.id);}
  }
  const total=new Set(matches.flatMap(group=>group.map(record=>record.entry.id))).size;
  return {entries:selected,total,truncated:total>selected.length,unmatchedTerms:terms.filter((_,index)=>!matches[index].length)};
}

/** Closed field lookup only: no generated factual prose can expand the source's scope.
 * Caller excludes history, quoted messages, images and independent requested reads. */
export function glossaryFieldAnswer(question:string,query:string,result:ToolResult,lang:'zh'|'en'):AssistantAnswer|undefined {
  if(!/英文(?:全称|名称)|\bEnglish (?:full )?name\b/i.test(question) || !/中文[^。；;\n]{0,12}(?:含义|意思|释义)|\bChinese meaning\b/i.test(question))return;
  if(!/一句话|一句|one sentence/i.test(question))return;
  if(/为什么|为何|怎么|如何|原理|前提|条件|保留|保持|步骤|算法|公式|比较|区别|对比|举例|用途|是否|能否|页面|计时器|论坛|规则|正文|标题|原文|表格|字数|\b(?:why|how|compare|difference|prerequisite|condition|algorithm|example|page|timer|forum|rules?|body|quote|title|table|JSON|words?|explain)\b|不要[^。]{0,12}(?:来源|引用)|without[^.]{0,20}(?:sources|citations)/i.test(question))return;
  const data=result.evidence as {entries?:Array<{sourceId:string;headEn?:string;headZh?:string;expandedEnglish?:string;expansionSourceIds?:string[]}>;truncated?:boolean;contextIncomplete?:boolean;unmatchedTerms?:string[]};
  if(!data?.entries?.length || data.truncated || data.contextIncomplete || data.unmatchedTerms?.length)return;
  const terms=query.split(/\s+/);if(!terms.length || terms.length>4 || terms.some(term=>!/^([A-Z][A-Z0-9]{1,8})$/.test(term)))return;
  // Closed vocabulary, not a broad intent guess: any additional instruction falls back.
  const words=new Set('look up in the site glossary give its fully expanded english full complete name expand every all abbreviation abbreviations and chinese meaning one sentence with source sources citations each respectively please answer respond write'.split(' '));
  let rest=question.normalize('NFKC');
  for(const term of terms)rest=rest.replace(new RegExp(`\\b${term}\\b`,'g'),'');
  rest=rest.replace(/英文|中文|完整|全称|名称|含义|意思|释义|是什么|站内|本站|百科|词条|词典|辞典|字典|术语表|解释|根据|依据|查询|核对|分别|一句话|一句|每句|给出|并给|附上|来源|引用|展开|所有|缩写|只写|请|查|和|及|的|用|都|并|附/g,'')
    .replace(/\b[a-z]+\b/gi,word=>words.has(word.toLowerCase())?'':word).replace(/[^\p{L}\p{N}]/gu,'');
  if(rest)return;
  const sources=new Map(result.sources.filter(source=>source.read).map(source=>[source.id,source]));
  const available=new Set(data.entries.map(entry=>entry.sourceId));
  const used=new Set<string>(),clauses:string[]=[];
  const english=lang==='en' || /\b(?:answer|respond|write) in English\b/i.test(question);
  for(const term of terms) {
    const matches=data.entries.filter(entry=>entry.headEn?.split('(',1)[0].trim()===term);
    if(matches.length!==1)return;
    const entry=matches[0],expanded=entry.expandedEnglish || entry.headEn?.match(/\(([^()]+)\)/)?.[1];
    if(!expanded || !entry.headZh?.trim() || /\b[A-Z][A-Z0-9]{1,8}\b/.test(expanded))return;
    const ids=entry.expandedEnglish?entry.expansionSourceIds:[entry.sourceId];
    if(!ids?.length || !ids.includes(entry.sourceId) || ids.some(id=>!sources.has(id)||!available.has(id)))return;
    ids.forEach(id=>used.add(id));const citations=ids.map(id=>`[[${id}]]`).join('');
    clauses.push(english?`${term} stands for ${expanded}; its Chinese meaning is “${entry.headZh.trim()}” ${citations}`:`${term} 的英文全称是 ${expanded}，中文含义为“${entry.headZh.trim()}”${citations}`);
  }
  const perTerm=/分别|每句|\beach\b|respectively/i.test(question);
  const period=english?'.':'。';
  return {answer:perTerm?clauses.map(clause=>clause+period).join('\n'):clauses.join(english?'; ':'；')+period,sources:[...used].map(id=>sources.get(id)!),artifacts:[]};
}

/** A single named glossary heading is the whole permitted source. */
export function assistantGlossaryHeadingTerm(question:string) {
  const match=question.match(/^(?:只|仅)凭(?:本站|站内)?百科(?:的)?\s*([A-Z][A-Z0-9]{1,8})\s*词条标题[，,：:]?\s*(?:能否|能|是否)[^。？?\n]{1,100}[？?](?:\s*请(?:说明理由|给出依据)(?:并指明依据)?。?)?$/)
    ??question.match(/^Based only on (?:the )?(?:site )?(?:glossary|dictionary) heading for ([A-Z][A-Z0-9]{1,8}),?\s*(?:does|can|is)\b[^.?!\n]{1,100}\?$/i);
  return match?.[1].toUpperCase();
}

/** A heading-only lookup has a closed claim scope. Render the actual fields,
 * including corrections of old assistant claims, instead of rephrasing them
 * into new procedural facts. Mixed tasks and richer documents keep normal review. */
export function glossaryNameOnlyAnswer(question:string, observations:Array<{call:{tool:string;query?:unknown};result:ToolResult}>,lang:'zh'|'en'):AssistantAnswer|undefined {
  // A single explicitly evidence-only property question cannot be answered
  // from headings. Compose the evidence gap without allowing a model to append
  // outside knowledge after a disclaimer. Mixed/format requests stay general.
  const property=question.match(/^(?:只|仅)根据(?:本站|站内)?百科(?:词条)?[，,\s]*([A-Z][A-Z0-9]{1,8})\s*(?:是否|能否)[^。？?\n]{1,60}[？?]?$/)
    ??question.match(/^Based only on (?:the )?(?:site )?glossary,?\s*(?:does|can)\s+([A-Z][A-Z0-9]{1,8})\b[^.?!\n]{1,80}\?$/i);
  const headingTerm=assistantGlossaryHeadingTerm(question);
  if((property || headingTerm) && !/另外|顺便|再写|再给|表格|段落|JSON|\balso\b/i.test(question) && observations.length===1 && observations[0].call.tool==='glossary') {
    const {call,result}=observations[0],term=headingTerm??property![1].toUpperCase();
    const data=result.evidence as {entries?:Array<{sourceId:string;headEn?:string;claimScope?:string}>;truncated?:boolean;contextIncomplete?:boolean;unmatchedTerms?:string[]};
    const entry=data?.entries?.find(e=>e.headEn?.split('(',1)[0].trim()===term),source=result.sources.find(s=>s.id===entry?.sourceId&&s.read);
    if(call.query===term && entry && source && data.entries?.every(e=>e.claimScope==='name_and_translation_only') && !data.truncated && !data.contextIncomplete && !data.unmatchedTerms?.length) {
      return {answer:lang==='zh'?`该百科词条只提供 ${term} 的名称与译名，没有说明所问的性质，因此仅凭该词条无法判断。[[${source.id}]]`:`The retrieved glossary entry only provides the name and translation of ${term}; it does not establish the requested property, so the entry alone cannot answer this question. [[${source.id}]]`,sources:[source],artifacts:[]};
    }
  }
  const expansionOnly=/^(?:[^.?!。？！\n]*\b(?:just|only)\s+(?:the\s+)?(?:full name|expansion|expanded form)\b|[^.?!。？！\n]*(?:只|仅)(?:给|写|答)[^。？！\n]{0,25}全称)/i.test(question)
    && !/译名|翻译|\b(?:translation|translate)\b/i.test(question);
  if(!/含义|意思|全称|定义|\b(?:mean|means|meaning|definition|name|stand for|expansion|expanded form)\b/i.test(question)
    || /另外|顺便|同时|再写|再给|额外|比较|区别|对比|前提|条件|保持|保留|是否|能否|怎么|如何|为什么|举例|公式|表格|段落|字数|不要.{0,12}(?:来源|引用)|\b(?:also|compare|difference|prerequisite|condition|preserv\w*|whether|how|why|example|algorithm|table|paragraph|JSON|words?|without)\b/i.test(question)
    || !observations.length || observations.some(o=>o.call.tool!=='glossary'))return;
  const clauses:string[]=[], sources=new Map<string,AssistantSource>();
  const english=/用英文|用英语|\b(?:answer|respond|write) in English\b/i.test(question) || lang==='en' && !/用中文|answer in Chinese/i.test(question);
  for(const {call,result} of observations) {
    const data=result.evidence as {entries?:Array<{sourceId:string;headEn?:string;headZh?:string;expandedEnglish?:string;expansionSourceIds?:string[];claimScope?:string}>;truncated?:boolean;contextIncomplete?:boolean;unmatchedTerms?:string[]};
    if(!data?.entries?.length || data.truncated || data.contextIncomplete || data.unmatchedTerms?.length)return;
    const terms=typeof call.query==='string'?call.query.split(/[\s,，、/;&+]+/).filter(Boolean):[];
    if(!terms.length || terms.length>4 || terms.some(t=>! /^[A-Z][A-Z0-9]{1,8}$/.test(t)))return;
    // Unknown extra instructions must stay on the general path. A matching
    // keyword alone never authorizes discarding the rest of a mixed request.
    let rest=question.normalize('NFKC');
    for(const term of terms)rest=rest.replace(new RegExp(`\\b${term}\\b`,'g'),'');
    const words=new Set('what does mean means meaning definition define name stand stands for look up in the site glossary give its fully expanded english full complete expand every all abbreviation abbreviations and chinese one sentence with source sources citations each respectively please answer respond write correct correction earlier previous mistaken statement my your only actually is was not it that'.split(' '));
    if(expansionOnly)for(const word of ['just','expansion','form','of','cuberoot','citation','entry','entries','needed','to','support','supports','supporting','provide','include','a','cite','this'])words.add(word);
    rest=rest.replace(/英文|中文|完整|全称|名称|含义|意思|释义|定义|是什么|什么意思|站内|本站|百科|词条|词典|辞典|字典|术语表|解释|根据|依据|查询|核对|分别|一句话|一句|每句|给出|并给|附上|来源|引用|展开|所有|缩写|只写|只要|仅|请|查|和|及|的|用|都|并|附|纠正|更正|之前|刚才|前面|说法|错误|误说|我|你|说|成|不是|而是|是/g,'')
      .replace(/\b[a-z]+\b/gi,word=>words.has(word.toLowerCase())?'':word).replace(/[^\p{L}\p{N}]/gu,'');
    if(rest)return;
    for(const term of terms) {
      const entries=data.entries.filter(e=>e.headEn?.split('(',1)[0].trim()===term);
      if(entries.length!==1 || entries[0].claimScope!=='name_and_translation_only')return;
      const entry=entries[0],name=entry.expandedEnglish || entry.headEn?.match(/\(([^()]+)\)/)?.[1];
      if(!name || !entry.headZh?.trim() || expansionOnly && /\b[A-Z][A-Z0-9]{1,8}\b/.test(name))return;
      const ids=entry.expandedEnglish?entry.expansionSourceIds:[entry.sourceId];
      if(!ids?.length || ids.some(id=>!result.sources.some(s=>s.id===id && s.read)))return;
      for(const id of ids)sources.set(id,result.sources.find(s=>s.id===id)!);
      const citation=ids.map(id=>`[[${id}]]`).join('');
      clauses.push(expansionOnly?`${name} ${citation}`:english?`${term} means ${name} (${entry.headZh.trim()})${citation}`:`${term}：${name}，即“${entry.headZh.trim()}”${citation}`);
    }
  }
  return clauses.length?{answer:[...new Set(clauses)].join(english?'; ':'；')+(english?'.':'。'),sources:[...sources.values()],artifacts:[]}:undefined;
}

/** A complete first glossary answer can precede model composition. Only show
 * a direct field of the uniquely named entry, with its actual provenance. */
export function glossaryItemPreview(item:string, result:ToolResult, lang:'en'|'zh'):AssistantAnswer|undefined {
  const text=item.trim().replace(/[。？?.!！]+$/u,'');
  const name=text.match(/^([A-Z][A-Z0-9-]{1,12})\s*的(?:英文)?全称(?:是什么)?$/)
    ?? text.match(/^what (?:is ([a-z0-9-]+) short for|does ([a-z0-9-]+) (?:stand for|expand to))$/i);
  const usage=text.match(/^([\p{L}\d-]{1,30})(?:有什么用途|在(?:魔方)?(?:转动记号|公式记号|转动序列|记号|公式)(?:里|中)起什么作用)$/u);
  const term=name?.[1] ?? name?.[2] ?? usage?.[1] ?? glossaryGroupingSubject(item);
  if (!term) return;
  if (name) {
    // Reuse validation of all linked expansion source IDs. The lookup may
    // contain other terms, but this preview answers exactly one requirement.
    return glossaryNameOnlyAnswer('Give only the full name of '+term.toUpperCase(),[{call:{tool:'glossary',query:term.toUpperCase()},result}],lang);
  }
  const data=result.evidence as {entries?:Array<{sourceId:string;headZh?:string;headEn?:string;bodyZh?:string;bodyEn?:string}>;notEvidence?:boolean;truncated?:boolean;contextIncomplete?:boolean};
  if(data?.notEvidence || data?.truncated || data?.contextIncomplete)return;
  const key=glossaryNotationKey(term);
  const matches=data?.entries?.filter(row=>row.headZh===term || row.headEn===term
    || (key && row.headEn && glossaryText(row.headEn)===key));
  if(matches?.length!==1)return;
  const row=matches[0], source=result.sources.find(s=>s.read && s.id===row.sourceId);
  const body=lang==='zh'?row.bodyZh:row.bodyEn;
  if(!source || !body || body.length>400 || /\[|https?:\/\//i.test(body)
    || !/用于|用来|用途|\bused (?:to|for)\b|\bfor grouping\b/i.test(body))return;
  return {answer:body+' [['+source.id+']]',sources:[source],artifacts:[]};
}

/** An exact localized entry can supply the definition in a two-part request. */
export function glossaryDefinitionExcerpt(term:string, result:ToolResult, lang:'zh'|'en'):AssistantAnswer|undefined {
  const data=result.evidence as {entries?:Array<GlossaryEntry & {sourceId:string}>;total?:number;truncated?:boolean;contextIncomplete?:boolean;unmatchedTerms?:string[];notEvidence?:boolean};
  if(data?.total!==1 || data.entries?.length!==1 || data.truncated || data.contextIncomplete || data.notEvidence || data.unmatchedTerms?.length)return;
  const row=data.entries[0], subject=glossaryText(term);
  const heads=[row.headEn,row.headZh,row.head].filter((s):s is string=>!!s).map(glossaryText);
  const names=heads.flatMap(head=>[head,head.split('(',1)[0].trim()]);
  const key=glossaryNotationKey(term);
  if(!names.includes(subject) && !(key && names.includes(key)))return;
  const source=result.sources.find(s=>s.id===row.sourceId && s.read);
  const body=(lang==='zh'?row.bodyZh:row.bodyEn)?.trim();
  const title=(lang==='zh'?row.headZh:row.headEn)?.trim();
  if(!body || !title || !source || body.length>400 || /^(?:see\b|refer to\b|cf\.|参见|详见|另见)/iu.test(body))return;
  // Allow notation such as [A:B], but no links, embedded markup or citation tokens.
  const prose=(title+' '+body).replace(/\[[A-Za-z\d'′ ,:]+\]/gu,'');
  if(/[\[\]<>|`*_\\#\r\n]|https?:\/\//iu.test(prose))return;
  return {answer:title+(lang==='zh'?'：':': ')+body+' [['+source.id+']]',sources:[source],artifacts:[]};
}

/** Close only explicitly used derived names over their already-read sources. */
export function completeGlossaryExpansionCitations(answer:string,observations:Array<{call:{tool:string};result:ToolResult}>):{answer:string;sourceIds:string[]} {
  const used=new Set<string>();
  for(const {call,result} of observations) {
    if(call.tool!=='glossary')continue;
    const data=result.evidence as {entries?:Array<{sourceId:string;expandedEnglish?:string;expansionSourceIds?:string[]}>;truncated?:boolean;contextIncomplete?:boolean};
    if(!data?.entries || data.truncated || data.contextIncomplete)continue;
    const available=new Set(result.sources.filter(s=>s.read).map(s=>s.id));
    for(const entry of data.entries) {
      const name=entry.expandedEnglish,ids=entry.expansionSourceIds;
      if(!name || !ids?.includes(entry.sourceId) || ids.some(id=>!available.has(id)))continue;
      const at=answer.toLowerCase().indexOf(name.toLowerCase());if(at<0)continue;
      ids.forEach(id=>used.add(id));
      const missing=ids.filter(id=>!answer.includes(`[[${id}]]`));
      if(missing.length)answer=answer.slice(0,at+name.length)+missing.map(id=>`[[${id}]]`).join('')+answer.slice(at+name.length);
    }
  }
  return {answer,sourceIds:[...used]};
}

/** A narrow scope check, not sentence-level entailment. In an empty-body
 * definition lookup, an extra acronym cannot be explained without a source.
 * Check the factual portion of mixed requests too; independent writing is not
 * glossary evidence. Body-backed explanations remain on the normal path. */
export function glossaryDefinitionScopeViolation(question:string,answer:string,observations:Array<{call:{tool:string};result:ToolResult}>):string|undefined {
  if(!/含义|意思|全称|定义|\b(?:meaning|definition|name|stand for)\b/i.test(question)
    || !observations.length || observations.some(o=>o.call.tool!=='glossary'))return;
  const texts:string[]=[question];
  for(const {result} of observations) {
    const data=result.evidence as {entries?:Array<{head?:string;headEn?:string;headZh?:string;expandedEnglish?:string;claimScope?:string}>;truncated?:boolean;contextIncomplete?:boolean};
    if(!data?.entries?.length || data.truncated || data.contextIncomplete || data.entries.some(e=>e.claimScope!=='name_and_translation_only'))return;
    texts.push(...data.entries.flatMap(e=>[e.head??'',e.headEn??'',e.headZh??'',e.expandedEnglish??'']));
  }
  const acronyms=(text:string)=>text.match(/\b[A-Z][A-Z0-9]{1,8}\b/g)??[];
  const allowed=new Set([...texts.flatMap(acronyms),...'A AN THE IS ARE NOT NO AND OR IN OF TO FOR IT YES NOTE ONLY'.split(' ')]);
  const mixed=/另外|顺便|同时|再写|再根据|\b(?:also|in addition|additionally)\b/i.test(question);
  const terms=new Set(texts.slice(1).flatMap(acronyms));
  const clauses=answer.replace(/\[\[[^\]]+\]\]/g,'').split(/[。！？.!?;；\n]|但是|不过|但|\b(?:but|however)\b/i);
  // These observable cubing properties are not entailed by names/translations.
  // A limitation about the source is valid; "does not rotate corners" is still
  // a property claim. This is a bounded guard, not a general entailment model.
  const property=/保持[^。；\n]{0,24}(?:朝向|定向|F2L)|(?:块|角|棱)[^。；\n]{0,24}(?:归位|调整|移动)|(?:顶面|顶层)[^。；\n]{0,12}(?:已同色|已完成定向)|\b(?:preserv\w*|keep\w*|maintain\w*)\b[^.!?;\n]{0,40}\b(?:orientation|F2L)\b|\b(?:move\w*|permut\w*|reposition\w*|rotate\w*|twist\w*)\b[^.!?;\n]{0,35}\b(?:pieces?|corners?|edges?)\b|\b(?:pieces?|corners?|edges?)\b[^.!?;\n]{0,35}\b(?:positions?|orientations?)\b/i;
  const gap=/无法|不能(?:确认|判断|证明|推断)|没有(?:说明|记载|提供|涉及)|未(?:说明|记载|提供|涉及)|不(?:额外补充|足以)|\b(?:cannot|can't|unable to|does not establish|does not state|doesn't establish|doesn't state|not documented|no evidence)\b/i;
  if(clauses.some(clause=>property.test(clause)&&!gap.test(clause)))return 'glossary_heading_scope';
  // Citation syntax is validated separately, and is not generated terminology.
  const factual=mixed?clauses.filter(clause=>acronyms(clause).some(term=>terms.has(term))).join(' '):answer.replace(/\[\[[^\]]+\]\]/g,'');
  const extra=acronyms(factual).find(term=>!allowed.has(term));
  return extra?`glossary_unread_term:${extra}`:undefined;
}

/** Shared attendance set: select actual result rows before deduplicating competitions. */
function selectAttendance(data: {results: Array<{competition_id: string; event_id?: string}>; comps: Array<{id: string; start_date?: string; country_iso2?: string}>}, call: {tool: string; event?: string; from?: string; to?: string}) {
  const attended = new Set(data.results.filter(result=>!call.event || result.event_id===call.event).map(result=>result.competition_id));
  const metadata = new Map(data.comps.map(comp=>[comp.id,comp]));
  const competitions: Array<{id: string; start?: string; country?: string}> = [];
  let unknownDateCompetitions = 0;
  for (const id of attended) {
    const comp = metadata.get(id), parsedDate = date.safeParse(comp?.start_date);
    const start = parsedDate.success ? parsedDate.data : undefined;
    if (!start) {
      unknownDateCompetitions++;
      if (call.from || call.to || call.tool==='person_competitions') continue;
    } else if ((call.from && start<call.from) || (call.to && start>call.to)) continue;
    competitions.push({id,start,country:comp?.country_iso2});
  }
  return {competitions,unknownDateCompetitions};
}

/** Only fixed public origins/endpoints. Never forwards cookies or credentials. */
async function executeDataTool(call: Exclude<AssistantToolCall, {tool:'pages'|'navigation'|'analysis_schema'|'analysis_query'|'web_search'|'deliberate'|'lookup_cube_photo'|'my_formula_reviews'}>, lang: 'zh'|'en', read: JsonReader, findPeople = findAssistantPeople,today=new Date().toISOString().slice(0,10),timeZone='UTC'): Promise<ToolResult> {
  if (call.tool === 'person_countries' && call.location) return attendanceLocationResult(call,call.location,lang,read);
  if (call.tool === 'annual_attendance') return annualAnswer(lang,call.limit);
  if (call.tool === 'competition_round') return roundAnswer(call,lang,read);
  if (call.tool === 'competition_schedule') return readCompetitionSchedule(call, lang, read);
  if (call.tool === 'statistics_metadata') return call.view === 'runtime' ? readStatisticsRuntime(call, lang, read, Date.now, timeZone) : readStatisticsMetadata(call, lang);
  if (call.tool === 'news') return readAssistantNews(call, lang, read, timeZone);
  const label = (zh: string, en: string) => ({ zh, en })[lang];
  const name = (raw: string) => displayCuberName(raw, lang === 'zh');
  const compNames = lang === 'zh' && ['records','rankings','competitions'].includes(call.tool) ? await read(`${stat}/comp_names_zh.json`).catch(() => ({})) : {};
  const compName = (id:string, raw:string, date?:string) => localizeCompName(id,raw,lang === 'zh',{date,resolveNameZh:n=>compNames[n] ?? n});
  const out: ToolResult = { evidence: null, sources: [], artifacts: [] };
  const table = (title: string, columns: string[], rows: string[][], links?: string[], columnKinds?: AssistantTable['columnKinds'], cellLinks?: AssistantTable['cellLinks']) => out.artifacts.push({ kind:'table', title, columns, rows, links, ...(columnKinds ? {columnKinds} : {}), ...(cellLinks ? {cellLinks} : {}) });
  const freshness = async () => (await read(`${api}/wca/historical-ranks/meta`)).lastImportedAt;
  if (call.tool === 'statistics') {
    const entries=call.id===fourthsId ? [{id:fourthsId,titleEn:'Most 4th places',titleZh:'最多第四名'}] : (await read(stat+'/index.json')).categories.flatMap((c:any)=>c.stats);
    const entry=entries.find((e:any)=>e.id===call.id);
    if (!entry) {
      out.evidence={catalog:entries.map((e:any)=>({id:e.id,titleEn:e.titleEn,titleZh:e.titleZh})),instruction:'Choose a catalog id, then inspect available tables. Never invent a stat id.'};
      return out;
    }
    const data=await read(stat+'/'+entry.id+'.json');
    const tables=publishedStatisticTables(data,lang);
    if(tables.length>1) out.scopeChoices={total:tables.length,titles:tables.slice(0,20).map(t=>t.title)};
    const selected=tables.find(t=>t.key===call.tableKey) ?? (tables.length===1?tables[0]:undefined);
    const offset=call.offset ?? 0;
    const choices=selected?[selected]:tables.slice(offset,offset+60);
    out.sources.push(source('stat:'+entry.id,label(entry.titleZh,entry.titleEn),'/wca/'+entry.id));
    out.evidence={id:entry.id,note:lang==='zh'?data.noteZh:data.note,updated:data.updated ?? null,
      instruction:'Published statistical tables may have their own cutoff. Do not claim live coverage, aggregate truncated rows, or filter a global top list as if it were a complete regional ranking.',
      interpretation: selected ? [
        selected.header.some(h=>h.key==='competitions_per_year') && selected.header.some(h=>h.key==='years') ? 'These are annualized averages over a span of years, NOT counts for each calendar year. If asked for year-by-year counts, explain that this table does not contain that series.' : null,
        call.id==='most_records_at_single_competition' ? 'Each row describes a PERSON at a COMPETITION, not an aggregate across everyone at that competition. Do not claim a competition-wide record from these rows. Preserve tied leaders.' : null,
      ].filter(Boolean) : [],
      selected:selected?{...selected,rows:selected.rows.slice(0,call.limit)}:null,
      totalTables:tables.length,nextOffset:!selected && offset+60<tables.length?offset+60:null,
      metrics:data.metricPanels?.map((p:any)=>({id:p.id,label:lang==='zh'?p.labelZh:p.labelEn})),
      tables:choices.map(t=>({key:t.key,title:t.title,recordScope:t.scope,rows:t.rows.length})),tablesTruncated:!selected && offset+60<tables.length,
      availability:tables.length?'published_rows':'published_file_has_no_rows',
      emptyMeaning:tables.length?undefined:'The published file contains no rows. This may reflect unavailable generation/import; it does not prove nobody achieved the statistic.'};
    if (selected) {
      const rows=selected.rows.slice(0,call.limit);
      const note=lang==='zh'?data.noteZh:data.note;
      const annualized=selected.header.some(h=>h.key==='competitions_per_year') && selected.header.some(h=>h.key==='years');
      const personCompetition=call.id==='most_records_at_single_competition';
      out.factualSummary=[
        label(`已列出“${selected.title}”的 ${rows.length} 项查询结果。`,`Showing ${rows.length} results for “${selected.title}”.`),
        typeof note==='string'?note:'',
        annualized?label('本表是多年间的年均比赛数，不是每个日历年的比赛数量。','These are annualized averages, not counts for each calendar year.'):'',
        personCompetition?label('每行对应一名选手在一场比赛的结果，不代表整场比赛的总量。','Each row describes one person at one competition, not a competition-wide total.'):'',
        selected.scope && selected.header.some(h=>h.key==='days')?label('表中未提供每条纪录当前是否仍有效的状态，不能仅据保持天数判断其已经被打破。','This table does not provide each record’s current status; its duration alone does not establish that it has been broken.'):'',
      ].filter(Boolean).join(' ');
      const width=Math.max(selected.header.length,...rows.map(row=>row.length));
      const columns=Array.from({length:width},(_,i)=>{
        const header=selected.header[i];
        if(header) return lang==='zh'?header.labelZh ?? header.label:header.label;
        // Some legacy published tables omit the competition heading while retaining
        // its cells. Preserve the data and label it only from explicit WCA links.
        return rows.every(row=>typeof row[i]==='string' && /\]\(https:\/\/www\.worldcubeassociation\.org\/competitions\//.test(row[i] as string)) ? label('比赛','Competition') : label('补充信息','Additional information');
      });
      table(selected.title,columns,rows.map(row=>Array.from({length:width},(_,column)=>{
      const value=row[column];
      // Text transport for the same published solves-cell contract used by WcaStatView.
      const raw=value && typeof value==='object' && '_type' in value && value._type==='solves' && 'csv' in value ? value.csv : value;
      const text=(Array.isArray(raw)?raw.join(', '):String(raw ?? '')).replace(/\[([^\]]+)\]\([^)]+\)/g,'$1');
      return selected.header[column]?.key==='person' ? name(text) : text;
      })));
    }
  } else if (call.tool === 'records') {
    const data = await read(`${stat}/records/history/${call.region === 'world' ? 'world' : `country/${call.region}`}.json`);
    const rows = selectCurrentRecords((data.rows as WcaRecordRow[]).filter(r => r.e === call.event));
    const href = `/wca/results?tab=records&rshow=current&rregion=${call.region}&revent=${call.event}`;
    const formatted = rows.map(r => [r.t === 's' ? label('单次','Single') : label('平均','Average'), formatWcaResult(r.v, r.e, r.t === 's' ? 'single' : 'average'), name(r.pn), r.p, compName(r.c,r.cn,r.d), r.d]);
    out.evidence = { updated: data.updated, event:call.event, region:call.region, columns:['type','result','person','wcaId','competition','date'], rows:formatted };
    out.sources.push(source(`records:${call.region}:${call.event}`, label('WCA 纪录','WCA records'), href));
    table(label('当前纪录','Current records'), [label('类型','Type'),label('成绩','Result'),label('选手','Person'),'WCA ID',label('比赛','Competition'),label('日期','Date')], formatted,undefined,['text','text','text','text','text','date'],rows.map(r=>[null,null,null,null,`/wca/comp/${r.c}`,null]));
  } else if (call.tool === 'find_person') {
    const rows = await findPeople(call.query);
    out.evidence = rows;
    out.sources = rows.map(r => source(`person:${r.wcaId}`, name(r.name), `/wca/persons/${r.wcaId}`));
    if (rows.length > 1) table(label('匹配的 WCA 选手','Matching WCA competitors'),
      [label('选手','Person'),'WCA ID',label('国家或地区','Country or region')],
      rows.map(r => [name(r.name),r.wcaId,r.country]),rows.map(r => `/wca/persons/${r.wcaId}`));
  } else if (call.tool === 'person_competitions') {
    const [data, updated] = await Promise.all([read(url(`${api}/wca/person-page`, {wcaId:call.wcaId})), freshness()]);
    const title = name(data.profile.person.name);
    // Results contain multiple events/rounds per competition. Count each ID
    // once, including DNF results; unrelated competition metadata is not attendance.
    const {competitions,unknownDateCompetitions} = selectAttendance(data,call);
    if (call.view === 'latest') {
      const sourceId = `person-latest-competition:${call.wcaId}:${call.event ?? 'all'}:${call.from ?? 'all'}:${call.to ?? 'all'}`;
      out.sources.push(source(sourceId, title, `/wca/persons/${call.wcaId}`));
      const latestDate = competitions.map(comp => comp.start!).sort().at(-1);
      const latestIds = new Set(competitions.filter(comp => comp.start === latestDate).map(comp => comp.id));
      const latest = data.comps.filter((comp: any) => latestIds.has(comp.id))
        .map((comp: any) => ({ id: comp.id, name: compName(comp.id, comp.name ?? comp.id, comp.start_date), start: comp.start_date }));
      out.evidence = { updated, wcaId: call.wcaId, latest, unknownDateCompetitions,
        basis: 'Most recent competition start date among result-bearing competitions in imported WCA results. Preserve ties and the import cutoff. Missing dates may affect order. Registration is not attendance.' };
      if (latest.length) {
        for (const comp of latest) out.sources.push(source(`comp:${comp.id}`, comp.name, `/wca/comp/${comp.id}`));
        table(label('最近有正式成绩的比赛', 'Most recent competitions with official results'), [label('比赛','Competition'), label('开始日期','Start date')],
          latest.map((comp: {name: string; start: string}) => [comp.name, comp.start]), latest.map((comp: {id: string}) => `/wca/comp/${comp.id}`));
      }
      return out;
    }
    const years = new Map<string,number>();
    const count = competitions.length;
    if (call.groupBy==='year') for (const comp of competitions) {
      const year = comp.start!.slice(0,4); years.set(year,(years.get(year) ?? 0)+1);
    }
    const byYear = [...years].sort(([a],[b])=>a.localeCompare(b)).map(([year,competitions])=>({year,competitions}));
    out.evidence = {updated,wcaId:call.wcaId,name:title,event:call.event,from:call.from,to:call.to,count,...(call.groupBy==='year'?{byYear}:{}),unknownDateCompetitions,
      basis:'Distinct competition IDs with imported official results, grouped/filtered by competition start date. DNF participation is included. Not a count of rounds, events, registrations or an annualized average. Missing years have zero imported competitions only when unknownDateCompetitions is zero. Coverage ends at the import timestamp, not today.'};
    out.sources.push(source(`person-competitions:${call.wcaId}:${call.from ?? 'all'}:${call.to ?? 'all'}${call.event?':'+call.event:''}${call.groupBy?':'+call.groupBy:''}`,title,`/wca/persons/${call.wcaId}`));
    const period = attendancePeriod(call.from,call.to,lang) || label('全部年份','all years');
    const scope = period + (call.event ? ` · ${({zh:EVENT_DISPLAY_ZH,en:EVENT_DISPLAY_EN})[lang][call.event]}` : '');
    out.factualSummary = (call.from && call.from>today
      ? label(`${period} 尚未发生，当前没有该期间的正式比赛成绩，无法提供未来的确切成绩。`,`The period ${period} is in the future. Official results do not exist yet, so exact future results are unavailable.`)
      : label(`${title}在 ${scope} 参加过 ${count} 场比赛，以比赛开始日期计。`,`${title} competed in ${count} competitions (${scope}), counted by competition start date.`))
      + (unknownDateCompetitions ? label(`另有 ${unknownDateCompetitions} 场比赛缺少有效日期，未计入，以上数量可能不完整。`,` ${unknownDateCompetitions} competitions lack valid dates and are excluded; this count may be incomplete.`) : '');
    if (call.groupBy==='year' && byYear.length) table(label('按年参赛数','Competitions by year'),[label('年份','Year'),label('比赛数','Competitions')],byYear.map(row=>[row.year,String(row.competitions)]));
  } else if (call.tool === 'person_countries') {
    const [data, updated] = await Promise.all([read(url(`${api}/wca/person-page`, {wcaId:call.wcaId})), freshness()]);
    const title = name(data.profile.person.name);
    // Count competition locations from actual result-bearing competitions,
    // never the person's nationality or a truncated global traveler ranking.
    const {competitions,unknownDateCompetitions} = selectAttendance(data,call);
    const counts = new Map<string,number>();
    let unknownCompetitions = 0;
    for (const {country} of competitions) {
      if (!country || !/^[A-Z]{2}$/.test(country)) { unknownCompetitions++; continue; }
      counts.set(country,(counts.get(country) ?? 0)+1);
    }
    const regions = new Intl.DisplayNames([lang === 'zh' ? 'zh-Hans' : 'en'],{type:'region'});
    const countries = [...counts].sort(([a],[b])=>a.localeCompare(b)).map(([iso2,competitions])=>({iso2,name:regions.of(iso2) ?? iso2,competitions}));
    out.evidence = {updated,wcaId:call.wcaId,name:title,event:call.event,from:call.from,to:call.to,countries,unknownCompetitions,unknownDateCompetitions:call.from || call.to ? unknownDateCompetitions : 0,basis:'Competition host country/region, distinct competitions with official results including DNF, filtered by event and competition start date before counting; not nationality or travel without competing. Coverage ends at the import timestamp.'};
    out.sources.push(source(call.event || call.from || call.to ? `person-countries:${call.wcaId}:${call.from ?? 'all'}:${call.to ?? 'all'}:${call.event ?? 'all'}` : `person:${call.wcaId}`,title,`/wca/persons/${call.wcaId}`));
    table(label('参赛国家和地区','Countries and regions competed in'),[label('国家或地区','Country or region'),label('比赛数','Competitions')],countries.map(c=>[c.name,String(c.competitions)]));
    const period = attendancePeriod(call.from,call.to,lang);
    const scope = [period,call.event?({zh:EVENT_DISPLAY_ZH,en:EVENT_DISPLAY_EN})[lang][call.event]:''].filter(Boolean).join(' · ');
    out.factualSummary = (call.from && call.from>today
      ? label(`${period} 尚未发生，当前没有该期间的正式比赛成绩。`,`The period ${period} is in the future; official results do not exist yet.`)
      : label(`${title}${scope?`（${scope}）`:''}在 ${countries.length} 个国家或地区参赛。以比赛举办地计算。`,`${title} competed in ${countries.length} countries or regions${scope?` (${scope})`:''}. Locations refer to competition hosts.`))
      + ((call.from || call.to) && unknownDateCompetitions ? label(`另有 ${unknownDateCompetitions} 场比赛缺少有效日期，未计入，以上范围可能不完整。`,` ${unknownDateCompetitions} competitions lack valid dates and are excluded; coverage may be incomplete.`) : '')
      + (unknownCompetitions ? label(`另有 ${unknownCompetitions} 场比赛缺少有效举办地，未计入。`,` ${unknownCompetitions} competitions lack a valid host location and are excluded.`) : '');
  } else if (call.tool === 'person') {
    const [data, updated] = await Promise.all([read(url(`${api}/wca/person-page`, { wcaId:call.wcaId })), freshness()]);
    const profile = data.profile;
    const title = name(profile.person.name);
    if (call.view === 'profile') {
      out.evidence = {updated,wcaId:call.wcaId,name:title,country:profile.person.country_iso2,competitionCount:profile.competition_count,medals:profile.medals,historicalRecordBreaks:profile.records};
      out.sources.push(source(`person:${call.wcaId}`,title,`/wca/persons/${call.wcaId}`));
      return out;
    }
    const eventOrder: readonly string[] = WCA_EVENT_ORDER;
    const personal = Object.entries(profile.personal_records ?? {}).sort(([a],[b])=>eventOrder.indexOf(a)-eventOrder.indexOf(b)).map(([eventId, v]: [string,any]) => ({ event:eventId, single:formatWcaResult(v.single?.best ?? 0,eventId,'single'), average:formatWcaResult(v.average?.best ?? 0,eventId,'average'), singleRank:v.single?.world_rank, averageRank:v.average?.world_rank }));
    const selected = personal.filter(r=>call.event==='all' || r.event===call.event);
    const metrics = call.metric ? [call.metric] : ['single','average'] as const;
    const rankings = call.rankings !== false;
    const records = selected.map(record=>({event:record.event,...Object.fromEntries(metrics.flatMap(metric=>[
      [metric,call.metric && !(profile.personal_records[record.event]?.[metric]?.best>0) ? null : record[metric]],
      ...(rankings ? [[metric+'Rank',record[metric==='single'?'singleRank':'averageRank']]] : []),
    ]))}));
    out.evidence = { updated, wcaId:call.wcaId, name:title, event:call.event, ...(call.metric ? {metric:call.metric} : {country:profile.person.country_iso2,competitionCount:profile.competition_count,medals:profile.medals,historicalRecordBreaks:profile.records}), personalRecords:records };
    const href = `/wca/persons/${call.wcaId}`;
    const sourceId = call.metric || !rankings ? `person:${call.wcaId}:${call.event}:${call.metric ?? 'both'}:${rankings?'ranks':'no-ranks'}:${call.progress?'progress':'current'}` : `person:${call.wcaId}`;
    const metricName = call.metric==='single' ? label('单次','single') : label('平均','average');
    const eventName = call.event==='all' ? label('全部项目','all events') : ({zh:EVENT_DISPLAY_ZH,en:EVENT_DISPLAY_EN})[lang][call.event];
    // A scalar's citation must still distinguish people/events when several
    // values are requested together; the value itself stays concise.
    out.sources.push(source(sourceId, call.metric ? `${title} · ${eventName} ${metricName}` : title, href));
    if (call.metric && !rankings && !call.progress && call.event!=='all') {
      const raw = profile.personal_records?.[call.event]?.[call.metric]?.best;
      const formatted = raw>0 ? formatWcaResult(raw,call.event,call.metric) + (call.event==='333fm' ? label(' 步',' moves') : !['333mbf','333mbo'].includes(call.event) && raw<6000 ? label(' 秒',' seconds') : '') : '';
      out.factualSummary = raw>0
        ? formatted
        : label(`${title}没有已导入的${eventName}有效${metricName}成绩。`,`${title} has no imported valid ${eventName} ${metricName} result.`);
    } else table(title, [label('项目','Event'),...metrics.flatMap(metric=>[metric==='single'?label('单次','Single'):label('平均','Average'),...(rankings?[label('世界排名','World rank')]:[])])], records.map(record=>[({zh:EVENT_DISPLAY_ZH,en:EVENT_DISPLAY_EN})[lang][record.event] ?? record.event,...metrics.flatMap(metric=>[String((record as Record<string,unknown>)[metric] ?? '—'),...(rankings?[String((record as Record<string,unknown>)[metric+'Rank'] ?? '—')]:[])])]));
    if(call.event==='all') out.factualSummary=label(`已列出${title}全部 ${selected.length} 个有成绩项目的官方个人最佳成绩。`,`Showing ${title}'s official personal bests for all ${selected.length} events with results.`);
    if (call.progress && call.event!=='all') {
      const dates = new Map<string,string>(data.comps.map((c:any)=>[c.id,c.start_date]));
      const competitions = new Map<string,any>(data.comps.map((c:any)=>[c.id,c]));
      const results = data.results.filter((r:any)=>r.event_id===call.event).sort((a:any,b:any)=>(dates.get(a.competition_id) ?? '').localeCompare(dates.get(b.competition_id) ?? '') || a.competition_id.localeCompare(b.competition_id) || roundChronologicalOrder(a.round_type_id)-roundChronologicalOrder(b.round_type_id));
      const flags = personalRecordFlags(results as Array<{event_id:string;best:number;average:number}>);
      for (const metric of metrics) {
        const points = results.flatMap((r:any)=>{
          const value = metric === 'single' ? r.best : r.average;
          const date = dates.get(r.competition_id);
          if (!date || !(metric==='single' ? flags.get(r)?.bestIsPb : flags.get(r)?.averageIsPb)) return [];
          const competition=competitions.get(r.competition_id);
          return [{date,value,label:formatWcaResult(value,call.event,metric),person:title,
            competition:compName(r.competition_id,competition?.name ?? r.competition_id,date),
            compId:r.competition_id,round:r.round_type_id}];
        });
        if (points.length) out.artifacts.push({kind:'progress',title:`${title} · ${metric === 'single' ? label('单次','Single') : label('平均','Average')}`,event:call.event,metric,points});
      }
      out.evidence = {...out.evidence as object, progress:out.artifacts.filter(a=>a.kind==='progress').map(a=>({title:a.title,metric:a.metric,recordPoints:a.points.length,improvementsAfterFirst:Math.max(0,a.points.length-1),first:a.points[0],current:a.points.at(-1),recent:a.points.slice(-5)})), progressionBasis:'Strict round-best PR. Dates are competition start dates, not necessarily the date the solve occurred. Same-day competition order is unknown. The first point is the first valid round result, not the final PR at the end of the first competition. PR points alone do not establish consistency or stability.'};
    }
  } else if (call.tool === 'rankings') {
    const [data,updated] = await Promise.all([read(url(`${api}/wca/historical-ranks`, {event:call.event,type:call.type,country:call.country,year:call.year ?? new Date().getUTCFullYear(),size:call.limit,page:1})),freshness()]);
    const rows = data.rows.map((r:any)=>[String(r.rank),name(r.name),r.wcaId,formatWcaResult(r.value,call.event,call.type),r.iso2,compName(r.compId,r.compName,r.compDate),r.compDate]);
    const year=call.year ?? new Date().getUTCFullYear();
    out.evidence={updated,...call,year,timeBasis:{kind:'cumulative_snapshot',through:`${year}-12-31`,coverageThrough:updated,
      rowDate:'Date of the competition where this personal best was achieved, NOT the ranking snapshot date.',
      instruction:'Include personal bests achieved in earlier years. This is the cumulative ranking through year end (or latest import for the current year), not a list of results achieved during that year. Do not discard an earlier result or call it out-of-period. For results achieved within a date interval use analysis_query instead.'},total:data.total,columns:['rank','person','wcaId','result','country','competition','date'],rows};
    out.sources.push(source('rankings',label('WCA 排名','WCA rankings'),'/wca/results'));
    table(label('排名','Rankings'),[label('名次','Rank'),label('选手','Person'),'WCA ID',label('成绩','Result'),label('地区','Country'),label('比赛','Competition'),label('日期','Date')],rows,data.rows.map((r:any)=>`/wca/persons/${r.wcaId}`),['text','text','text','text','country','text','date'],data.rows.map((r:any)=>[null,null,null,null,null,r.compId ? `/wca/comp/${r.compId}` : null,null]));
  } else if (call.tool === 'competitions') {
    const upcoming = await read(`${stat}/all_upcoming_comps.json`);
    // WC editions use canonical WCA IDs even when their names change. An
    // explicit edition is historical discovery, not an upcoming-only query.
    const worldQuery=/^(?:wc|世锦赛|世界(?:魔方)?锦标赛|(?:rubik'?s?\s+)?(?:wca\s+)?world\s+(?:cube\s+|rubik'?s?\s+cube\s+)?championships?)(?:\s*(?:19|20)\d{2})*$/i.test(call.query.trim());
    const years:string[]=worldQuery ? call.query.match(/(?:19|20)\d{2}/g) ?? [] : [];
    const upcomingOnly=call.upcoming && years.length===0 && !(call.from && call.from<today) && !(call.to && call.to<today);
    const all = upcomingOnly ? upcoming : mergeCompetitionIndexes(await read(`${stat}/all_past_comps.json`),upcoming);
    const q=call.query.toLocaleLowerCase().replace(/\s/g,'');
    const cityKey = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '').replace(/市$/, '');
    const city = call.city && cityKey(call.city);
    const matchesCity = (host: unknown, country: string) => {
      if (!city) return true;
      if (typeof host !== 'string') return false;
      const municipality = host.split(/[,，]/, 1)[0];
      return [host, municipality, localizeCity(municipality, true, country)].some(name => cityKey(name) === city);
    };
    const localizedQuery = lang === 'zh' && /[\u3400-\u9fff]/.test(q);
    const matches=all.filter((c:any)=>(!upcomingOnly || c.end_date >= today) && (!call.from || c.end_date>=call.from) && (!call.to || c.start_date<=call.to) && (!call.country || c.country===call.country)
      && matchesCity(c.city,c.country)
      && (worldQuery ? /^WC(?:19|20)\d{2}$/.test(c.id) && (!years.length || years.includes(c.id.slice(2))) : !q || `${c.id} ${c.name} ${c.city}`.toLocaleLowerCase().replace(/\s/g,'').includes(q)
      || (localizedQuery && compName(c.id,c.name,c.start_date).replace(/\s/g,'').includes(q))))
      .sort((a:any,b:any)=>upcomingOnly ? a.start_date.localeCompare(b.start_date) : b.start_date.localeCompare(a.start_date));
    const rows=matches.slice(0,call.limit);
    out.evidence={...call,total:matches.length,returnedRows:rows.length,truncated:rows.length<matches.length,
      coverage:'Matching competitions in the imported site catalogs, filtered before the output limit. total is the full matched catalog count; returnedRows is only the displayed list length. Do not report returnedRows as the total when truncated. This is schedule metadata, not published results or champions, and does not establish that a competition has results. Catalog coverage is not a live exhaustive WCA check. Date filters use competition date overlap, not individual round or solve dates.',
      competitions:rows.map((c:any)=>({...c,name:compName(c.id,c.name,c.start_date)}))};
    out.sources=rows.map((c:any)=>source(`comp:${c.id}`,compName(c.id,c.name,c.start_date),`/wca/comp/${c.id}`));
    table(label('比赛','Competitions'),[label('比赛','Competition'),label('城市','City'),label('地区','Country'),label('日期','Dates')],rows.map((c:any)=>[compName(c.id,c.name,c.start_date),c.city,c.country,formatDateRangeIso(c.start_date,c.end_date)]),rows.map((c:any)=>`/wca/comp/${c.id}`),['text','text','country','date']);
  } else if (call.tool === 'scrambles') {
    const all=await read(url(`${api}/wca/scrambles`,{compId:call.compId}));
    const rows=all.filter((r:any)=>r.event_id===call.event && r.round_type_id===call.round).slice(0,40);
    out.evidence={...call,rows};
    out.sources.push(source(`scrambles:${call.compId}`,label('官方比赛打乱','Official scrambles'),`/wca/comp/${call.compId}`));
    table(label('官方打乱','Official scrambles'),[label('组','Group'),label('序号','Number'),label('备打','Extra'),label('打乱','Scramble')],rows.map((r:any)=>[String(r.group_id),String(r.scramble_num),r.is_extra ? label('是','Yes') : '',r.scramble]));
  } else if (call.tool === 'recons') {
    const data=await read(url(`${api}/recon/list`,{wcaId:call.wcaId,comp:call.compId}));
    const rows=(Array.isArray(data)?data:data.rows ?? data.recons ?? []).filter((r:any)=>(!call.event || r.event===call.event || (call.event==='333' && r.event==='3x3')) && (call.value===undefined || Number(r.value)===call.value || Number(r.rawTime)===call.value)).slice(0,call.limit);
    out.evidence=rows.map((r:any)=>({id:r.id,person:r.person,personId:r.personId,event:r.event,value:r.value,rawTime:r.rawTime,comp:r.comp,compWcaId:r.compWcaId,official:r.official,date:r.date,stm:r.stm,tps:r.tps,method:r.method}));
    out.sources=rows.map((r:any)=>source(`recon:${r.id}`,`${name(r.person)} · ${r.value ?? r.rawTime ?? '—'}`,`/recon/${r.id}`));
    out.factualSummary=label(`已列出 ${rows.length} 条公开复盘。比赛或练习场景以表格中的原始记录为准。`,`Showing ${rows.length} public reconstructions. Competition or practice settings follow the original records in the table.`);
    table(label('公开复盘','Public reconstructions'),[label('选手','Person'),label('成绩','Result'),label('比赛或场景','Competition or setting'),label('日期','Date')],rows.map((r:any)=>[name(r.person),String(r.value??r.rawTime??''),r.comp??'',r.date??'']),rows.map((r:any)=>`/recon/${r.id}`));
  } else if (call.tool === 'recon') {
    const r=await read(`${api}/recon/${call.id}`);
    if (r.visibility && r.visibility !== 'public') throw new Error('Only published reconstructions are indexed');
    // A deliberate public field projection: never pass author/account fields to the model.
    out.evidence=Object.fromEntries(['id','person','event','value','rawTime','method','date','comp','official','compWcaId','stm','tps','scramble','optimalScramble','wcaScramble','solution','reconstruction','note','oll','pll'].filter(k=>r[k]!=null).map(k=>[k,r[k]]));
    if (typeof r.solution === 'string') {
      Object.assign(out.evidence as object,{solutionLineCount:r.solution.split('\n').filter(Boolean).length,
        annotationMeaning:'The oll/pll legacy storage fields may contain ZBLS/ZBLL or other method labels. They do not establish an OLL/PLL classification. Quote the recorded label without reclassifying it.'});
      out.reconstructionAnnotations=r.solution.split('\n').flatMap((line:string)=>line.includes('//')?[line.slice(line.indexOf('//')+2).trim()]:[]).filter(Boolean);
      table(label('原始复盘步骤','Original reconstruction'),[label('步骤','Step'),label('原始记号与注释','Original notation and annotations')],r.solution.split('\n').filter(Boolean).map((line:string,i:number)=>[String(i+1),line]));
    }
    out.sources.push(source(`recon:${call.id}`,label('复盘','Reconstruction'),`/recon/${call.id}`));
  } else if (call.tool === 'glossary') {
    const data=await read(`${api}/wiki/terms`);
    const allEntries:GlossaryEntry[]=data.sections.flatMap((section:{entries:GlossaryEntry[]})=>section.entries);
    const matches=glossaryMatches(allEntries,call.query);
    const resolved=glossaryExpansions(allEntries,matches.entries);
    out.evidence={entries:resolved.entries.map(entry=>({id:entry.id,sourceId:`wiki:${entry.id}`,head:entry.head,body:entry.body,headEn:entry.headEn,headZh:entry.headZh,bodyEn:entry.bodyEn,bodyZh:entry.bodyZh,source:entry.source,
      ...resolved.expansions.get(entry.id),
      hasDescription:!![entry.body,entry.bodyEn,entry.bodyZh].some(value=>value?.trim()),
      claimScope:[entry.body,entry.bodyEn,entry.bodyZh].some(value=>value?.trim())?'entry_text':'name_and_translation_only',
    })),total:matches.total,truncated:matches.truncated,unmatchedTerms:matches.unmatchedTerms,instruction:'These are quoted glossary entries, not independently verified or complete definitions. total counts query matches, excluding linked abbreviation entries. For a full English name, use expandedEnglish when supplied: it is derived from the quoted headings, not itself a quotation; cite ALL expansionSourceIds. Do not leave an abbreviation unexpanded when its linked definition is provided. Cite the sourceId of each other entry used. When claimScope is name_and_translation_only, the entry supports only its name, translation and supplied linked expansion. It cannot verify prerequisites, preserved properties or algorithm behavior, even if these are familiar from general knowledge. For an evidence-only request for such a property, say that the retrieved entry does not establish it; do not fill the gap from memory.'};
    // The page owns its title-derived anchors; do not duplicate its slug algorithm here.
    out.sources=resolved.entries.map(entry=>source(`wiki:${entry.id}`,(lang==='zh'?entry.headZh:entry.headEn)?.trim() || entry.head?.trim() || entry.headEn?.trim() || entry.headZh?.trim() || label('魔方百科','Cubing glossary'),'/wiki'));
  } else if (call.tool === 'forum') {
    const data=await read(url(`${api}/forum/search`,{q:call.query,size:6}));
    out.evidence=data.threads.map((r:any)=>({id:r.id,title:r.title,snippet:r.snippet}));
    if (!data.threads.length) out.outcome={state:'empty',reason:'no_matching_threads'};
    out.sources=data.threads.map((r:any)=>source(`forum:${r.id}`,r.title,`/forum/t/${r.id}`));
  } else if (call.tool === 'algorithms') {
    const path=call.set ? `${api}/alg/sets/${call.puzzle}/${call.set}` : `${api}/alg/sets`;
    const data=await read(path);
    const cards = call.set ? algorithmCards(data, {...call, set:call.set}, lang) : undefined;
    if (cards) out.artifacts.push(cards);
    out.evidence=cards ? {puzzle:cards.puzzle,set:cards.set,total:cards.total,offset:cards.offset,nextOffset:cards.nextOffset,
      items:cards.cards.map(({sticker, ...card}) => card),
      instruction:'The UI renders these exact algorithm cards. Briefly introduce them; do not repeat moves in prose. total counts matching cases, not formulas. nextOffset means this is a partial page, never the entire set. Empty items with nonzero total can mean the requested alternative/offset is unavailable. Follow-ups must reuse these case IDs, alternative indexes and display mode.',
    } : {
      puzzle:call.puzzle,
      sets:data.filter((set:any)=>set.puzzle===call.puzzle).map((set:any)=>({puzzle:set.puzzle,setSlug:set.setSlug,count:set.count,updatedAt:set.updatedAt})),
      instruction:'Complete catalog for this puzzle. count is the number of cases, not formulas. Use these counts for catalog questions; do not reread the catalog or fetch individual formula content to answer them. For other aggregates use analysis_schema / analysis_query.',
    };
    out.sources.push(source(cards ? `algorithms:${call.puzzle}:${call.set}:${call.caseId ?? call.query ?? ''}:${call.offset ?? 0}:${call.alternative ?? 0}` : 'algorithms',cards?.title ?? label('公式库','Algorithms'),call.set ? `/alg/${call.puzzle}/${call.set}` : '/alg'));
  }
  return out;
}

/** Read-only tool checkpoints share the exact validated call, locale and date. */
export async function runDataTool(...args: Parameters<typeof executeDataTool>): Promise<ToolResult> {
  return checkpointAssistantTool(args[0],()=>executeDataTool(...args));
}
