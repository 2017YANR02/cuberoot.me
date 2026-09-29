import { z } from 'zod';
import { formatWcaResult } from '@cuberoot/shared/wca-format-result';
import { selectCurrentRecords, personalRecordFlags, type WcaRecordRow } from '@cuberoot/shared/wca-records';
import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { WCA_EVENT_ORDER, EVENT_DISPLAY_ZH, EVENT_DISPLAY_EN } from '@cuberoot/shared/wca-events';
import { localizeCompName } from '@cuberoot/shared/comp-localize';
import { formatDateRangeIso } from '@cuberoot/shared/iso-date';
import { roundChronologicalOrder } from '@cuberoot/shared/wca-round';
import { mergeCompetitionIndexes } from '@cuberoot/shared/competition-index';
import type { AssistantArtifact, AssistantSource } from '@cuberoot/shared/site-assistant';
import { findAssistantPeople } from './site_assistant_people.js';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const competitionId = id.refine(value=>!/^\d{4}[A-Z]{4}\d{2}$/.test(value),'This is a person WCA ID; use wcaId, not compId.');
const event = z.enum(WCA_EVENT_ORDER).default('333');
const query = z.string().trim().min(1).max(100);
export const toolCallSchema = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('records'), event, region: z.string().regex(/^(world|[A-Z]{2})$/).default('world') }).strict(),
  z.object({ tool: z.literal('find_person'), query }).strict(),
  z.object({ tool: z.literal('person'), wcaId: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/), event, progress: z.boolean().default(false) }).strict(),
  z.object({ tool: z.literal('rankings'), event, type: z.enum(['single','average']).default('single'), country: z.string().regex(/^([A-Z]{2}|_Asia|_Europe|_Africa|_North America|_South America|_Oceania)?$/).default(''), year: z.number().int().min(2003).max(2100).optional(), limit: z.number().int().min(1).max(20).default(10) }).strict(),
  z.object({ tool: z.literal('competitions'), query: z.string().max(100).default(''), country: z.string().regex(/^([A-Z]{2})?$/).default(''), upcoming: z.boolean().default(true), limit: z.number().int().min(1).max(20).default(10) }).strict(),
  z.object({ tool: z.literal('scrambles'), compId: competitionId, event, round: z.string().regex(/^[a-z0-9]{1,2}$/).default('f') }).strict(),
  z.object({ tool: z.literal('recons'), wcaId: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/).optional(), compId: competitionId.optional(), value: z.number().positive().max(360000).optional(), event: z.string().regex(/^[A-Za-z0-9]+$/).optional(), limit: z.number().int().min(1).max(20).default(10) }).strict(),
  z.object({ tool: z.literal('recon'), id: z.number().int().positive() }).strict(),
  z.object({ tool: z.literal('glossary'), query }).strict(),
  z.object({ tool: z.literal('forum'), query }).strict(),
  z.object({ tool: z.literal('algorithms'), puzzle: id.default('3x3'), set: id.optional() }).strict(),
  z.object({ tool: z.literal('statistics'), id: id.optional(), tableKey: z.string().regex(/^[0-9.]{1,40}$/).optional(), offset: z.number().int().min(0).max(50000).optional(), limit: z.number().int().min(1).max(20).default(10) }).strict().refine(value=>!value.tableKey || !!value.id, {path:['id'],message:'A tableKey requires its statistic id. Repeat the id from the previous result; table keys are not global.'}),
  z.object({ tool: z.literal('pages'), query, pageIds: z.array(z.string().max(120)).max(3).default([]) }).strict(),
]);
export type AssistantToolCall = z.infer<typeof toolCallSchema>;
export interface ToolResult {
  evidence: unknown; sources: AssistantSource[]; artifacts: AssistantArtifact[];
  /** Exact published choices, for visitors explicitly asking to choose conditions first. */
  scopeChoices?: { total: number; titles: string[] };
  reconstructionAnnotations?: string[];
  factualSummary?: string;
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

/** Only fixed public origins/endpoints. Never forwards cookies or credentials. */
export async function runDataTool(call: Exclude<AssistantToolCall, {tool:'pages'}>, lang: 'zh'|'en', read: JsonReader, findPeople = findAssistantPeople): Promise<ToolResult> {
  const label = (zh: string, en: string) => ({ zh, en })[lang];
  const name = (raw: string) => displayCuberName(raw, lang === 'zh');
  const compNames = lang === 'zh' && ['records','rankings','competitions'].includes(call.tool) ? await read(`${stat}/comp_names_zh.json`).catch(() => ({})) : {};
  const compName = (id:string, raw:string, date?:string) => localizeCompName(id,raw,lang === 'zh',{date,resolveNameZh:n=>compNames[n] ?? n});
  const out: ToolResult = { evidence: null, sources: [], artifacts: [] };
  const table = (title: string, columns: string[], rows: string[][], links?: string[]) => out.artifacts.push({ kind:'table', title, columns, rows, links });
  const freshness = async () => (await read(`${api}/wca/historical-ranks/meta`)).lastImportedAt;
  if (call.tool === 'statistics') {
    const index=await read(stat+'/index.json');
    const entries=index.categories.flatMap((c:any)=>c.stats);
    const entry=entries.find((e:any)=>e.id===call.id);
    if (!entry) {
      out.evidence={catalog:entries.map((e:any)=>({id:e.id,titleEn:e.titleEn,titleZh:e.titleZh})),instruction:'Choose a catalog id, then inspect available tables. Never invent a stat id.'};
      return out;
    }
    const data=await read(stat+'/'+entry.id+'.json');
    const tables:Array<{key:string;title:string;scope:unknown;header:any[];rows:unknown[][]}>=[];
    const walk=(node:any,key:string,labels:string[],header:any[])=>{
      const nextLabels=[...labels,node.titleZh && lang==='zh' ? node.titleZh : node.title ?? (lang==='zh'?node.labelZh:node.labelEn) ?? ''].filter(Boolean);
      const columns=node.header?.length ? node.header : header;
      if (Array.isArray(node.rows) && node.rows.length) tables.push({key,title:nextLabels.join(' · '),scope:node.recordScope,header:columns,rows:node.rows});
      ['metricPanels','panels','sections','sourcePanels'].forEach((field,group)=>node[field]?.forEach((child:any,i:number)=>walk(child,key+'.'+group+'.'+i,nextLabels,columns)));
    };
    walk(data,'0',[],data.header ?? []);
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
    const href = `/wca/records?show=current&region=${call.region}&event=${call.event}`;
    const formatted = rows.map(r => [r.t === 's' ? label('单次','Single') : label('平均','Average'), formatWcaResult(r.v, r.e, r.t === 's' ? 'single' : 'average'), name(r.pn), r.p, compName(r.c,r.cn,r.d), r.d]);
    out.evidence = { updated: data.updated, event:call.event, region:call.region, columns:['type','result','person','wcaId','competition','date'], rows:formatted };
    out.sources.push(source(`records:${call.region}:${call.event}`, label('WCA 纪录','WCA records'), href));
    table(label('当前纪录','Current records'), [label('类型','Type'),label('成绩','Result'),label('选手','Person'),'WCA ID',label('比赛','Competition'),label('日期','Date')], formatted);
  } else if (call.tool === 'find_person') {
    const rows = await findPeople(call.query);
    out.evidence = rows;
    out.sources = rows.map(r => source(`person:${r.wcaId}`, name(r.name), `/wca/persons/${r.wcaId}`));
  } else if (call.tool === 'person') {
    const [data, updated] = await Promise.all([read(url(`${api}/wca/person-page`, { wcaId:call.wcaId })), freshness()]);
    const profile = data.profile;
    const title = name(profile.person.name);
    const personal = Object.entries(profile.personal_records ?? {}).map(([eventId, v]: [string,any]) => ({ event:eventId, single:formatWcaResult(v.single?.best ?? 0,eventId,'single'), average:formatWcaResult(v.average?.best ?? 0,eventId,'average'), singleRank:v.single?.world_rank, averageRank:v.average?.world_rank }));
    out.evidence = { updated, wcaId:call.wcaId, name:title, country:profile.person.country_iso2, competitionCount:profile.competition_count, medals:profile.medals, historicalRecordBreaks:profile.records, personalRecords:personal };
    const href = `/wca/persons/${call.wcaId}`;
    out.sources.push(source(`person:${call.wcaId}`, title, href));
    table(title, [label('项目','Event'),label('单次','Single'),label('世界排名','World rank'),label('平均','Average'),label('世界排名','World rank')], personal.filter(r=>r.event===call.event).map(r=>[({zh:EVENT_DISPLAY_ZH,en:EVENT_DISPLAY_EN})[lang][r.event] ?? r.event,r.single,String(r.singleRank ?? '—'),r.average,String(r.averageRank ?? '—')]));
    if (call.progress) {
      const dates = new Map<string,string>(data.comps.map((c:any)=>[c.id,c.start_date]));
      const competitions = new Map<string,any>(data.comps.map((c:any)=>[c.id,c]));
      const results = data.results.filter((r:any)=>r.event_id===call.event).sort((a:any,b:any)=>(dates.get(a.competition_id) ?? '').localeCompare(dates.get(b.competition_id) ?? '') || a.competition_id.localeCompare(b.competition_id) || roundChronologicalOrder(a.round_type_id)-roundChronologicalOrder(b.round_type_id));
      const flags = personalRecordFlags(results as Array<{event_id:string;best:number;average:number}>);
      for (const metric of ['single','average'] as const) {
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
    out.evidence={updated,...call,total:data.total,columns:['rank','person','wcaId','result','country','competition','date'],rows};
    out.sources.push(source('rankings',label('WCA 排名','WCA rankings'),'/wca/results'));
    table(label('排名','Rankings'),[label('名次','Rank'),label('选手','Person'),'WCA ID',label('成绩','Result'),label('地区','Country'),label('比赛','Competition'),label('日期','Date')],rows,data.rows.map((r:any)=>`/wca/persons/${r.wcaId}`));
  } else if (call.tool === 'competitions') {
    const upcoming = await read(`${stat}/all_upcoming_comps.json`);
    const all = call.upcoming ? upcoming : mergeCompetitionIndexes(await read(`${stat}/all_past_comps.json`),upcoming);
    const q=call.query.toLocaleLowerCase().replace(/\s/g,'');
    const rows=all.filter((c:any)=>(!call.upcoming || c.end_date >= new Date().toISOString().slice(0,10)) && (!call.country || c.country===call.country) && (!q || `${c.id} ${c.name} ${c.city}`.toLocaleLowerCase().replace(/\s/g,'').includes(q)))
      .sort((a:any,b:any)=>call.upcoming ? a.start_date.localeCompare(b.start_date) : b.start_date.localeCompare(a.start_date)).slice(0,call.limit);
    out.evidence={...call,competitions:rows.map((c:any)=>({...c,name:compName(c.id,c.name,c.start_date)}))};
    out.sources=rows.map((c:any)=>source(`comp:${c.id}`,compName(c.id,c.name,c.start_date),`/wca/comp/${c.id}`));
    table(label('比赛','Competitions'),[label('比赛','Competition'),label('城市','City'),label('地区','Country'),label('日期','Dates')],rows.map((c:any)=>[compName(c.id,c.name,c.start_date),c.city,c.country,formatDateRangeIso(c.start_date,c.end_date)]),rows.map((c:any)=>`/wca/comp/${c.id}`));
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
      out.reconstructionAnnotations=r.solution.split('\n').flatMap((line:string)=>line.includes('//')?[line.slice(line.indexOf('//')+2).trim()]:[]).filter(Boolean);
      table(label('原始复盘步骤','Original reconstruction'),[label('步骤','Step'),label('原始记号与注释','Original notation and annotations')],r.solution.split('\n').filter(Boolean).map((line:string,i:number)=>[String(i+1),line]));
    }
    out.sources.push(source(`recon:${call.id}`,label('复盘','Reconstruction'),`/recon/${call.id}`));
  } else if (call.tool === 'glossary') {
    const data=await read(`${api}/wiki/terms`);
    const q=call.query.toLowerCase();
    out.evidence=data.sections.flatMap((s:any)=>s.entries).filter((r:any)=>JSON.stringify([r.headEn,r.headZh,r.bodyEn,r.bodyZh,r.head,r.body]).toLowerCase().includes(q)).slice(0,8).map((r:any)=>({head:r.head,body:r.body,headEn:r.headEn,headZh:r.headZh,bodyEn:r.bodyEn,bodyZh:r.bodyZh}));
    out.sources.push(source('wiki',label('魔方百科','Cubing glossary'),'/wiki'));
  } else if (call.tool === 'forum') {
    const data=await read(url(`${api}/forum/search`,{q:call.query,size:6}));
    out.evidence=data.threads.map((r:any)=>({id:r.id,title:r.title,snippet:r.snippet}));
    out.sources=data.threads.map((r:any)=>source(`forum:${r.id}`,r.title,`/forum/t/${r.id}`));
  } else if (call.tool === 'algorithms') {
    const path=call.set ? `${api}/alg/sets/${call.puzzle}/${call.set}` : `${api}/alg/sets`;
    const data=await read(path);
    out.evidence=call.set ? {...data,cases:data.cases?.slice(0,72)} : data;
    out.sources.push(source('algorithms',label('公式库','Algorithms'),call.set ? `/alg/${call.puzzle}/${call.set}` : '/alg'));
  }
  return out;
}
