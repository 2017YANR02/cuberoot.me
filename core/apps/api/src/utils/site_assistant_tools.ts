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

const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const event = z.enum(WCA_EVENT_ORDER).default('333');
const query = z.string().trim().min(1).max(100);
export const toolCallSchema = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('records'), event, region: z.string().regex(/^(world|[A-Z]{2})$/).default('world') }).strict(),
  z.object({ tool: z.literal('find_person'), query }).strict(),
  z.object({ tool: z.literal('person'), wcaId: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/), event, progress: z.boolean().default(false) }).strict(),
  z.object({ tool: z.literal('rankings'), event, type: z.enum(['single','average']).default('single'), country: z.string().regex(/^([A-Z]{2}|_Asia|_Europe|_Africa|_North America|_South America|_Oceania)?$/).default(''), year: z.number().int().min(2003).max(2100).optional(), limit: z.number().int().min(1).max(20).default(10) }).strict(),
  z.object({ tool: z.literal('competitions'), query: z.string().max(100).default(''), country: z.string().regex(/^([A-Z]{2})?$/).default(''), upcoming: z.boolean().default(true), limit: z.number().int().min(1).max(20).default(10) }).strict(),
  z.object({ tool: z.literal('scrambles'), compId: id, event, round: z.string().regex(/^[a-z0-9]{1,2}$/).default('f') }).strict(),
  z.object({ tool: z.literal('recons'), wcaId: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/).optional(), compId: id.optional(), value: z.number().positive().max(360000).optional() }).strict(),
  z.object({ tool: z.literal('recon'), id: z.number().int().positive() }).strict(),
  z.object({ tool: z.literal('glossary'), query }).strict(),
  z.object({ tool: z.literal('forum'), query }).strict(),
  z.object({ tool: z.literal('algorithms'), puzzle: id.default('3x3'), set: id.optional() }).strict(),
  z.object({ tool: z.literal('statistics'), id: id.optional(), tableKey: z.string().regex(/^[0-9.]{1,40}$/).optional(), limit: z.number().int().min(1).max(20).default(10) }).strict(),
  z.object({ tool: z.literal('pages'), query, pageIds: z.array(z.string().max(120)).max(3).default([]) }).strict(),
]);
export type AssistantToolCall = z.infer<typeof toolCallSchema>;
export interface ToolResult { evidence: unknown; sources: AssistantSource[]; artifacts: AssistantArtifact[] }
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
export async function runDataTool(call: Exclude<AssistantToolCall, {tool:'pages'}>, lang: 'zh'|'en', read: JsonReader): Promise<ToolResult> {
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
      ['metricPanels','panels','sections'].forEach((field,group)=>node[field]?.forEach((child:any,i:number)=>walk(child,key+'.'+group+'.'+i,nextLabels,columns)));
    };
    walk(data,'0',[],data.header ?? []);
    const selected=tables.find(t=>t.key===call.tableKey) ?? (tables.length===1?tables[0]:undefined);
    out.sources.push(source('stat:'+entry.id,label(entry.titleZh,entry.titleEn),'/wca/'+entry.id));
    out.evidence={id:entry.id,note:lang==='zh'?data.noteZh:data.note,updated:data.updated ?? null,
      instruction:'Published statistical tables may have their own cutoff. Do not claim live coverage, aggregate truncated rows, or filter a global top list as if it were a complete regional ranking.',
      tables:tables.slice(0,160).map(t=>({key:t.key,title:t.title,recordScope:t.scope,rows:t.rows.length})),tablesTruncated:tables.length>160,
      selected:selected?{...selected,rows:selected.rows.slice(0,call.limit)}:null};
    if (selected) table(selected.title,selected.header.map(h=>lang==='zh'?h.labelZh ?? h.label:h.label),selected.rows.slice(0,call.limit).map(row=>row.map(v=>String(v ?? '').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1'))));
  } else if (call.tool === 'records') {
    const data = await read(`${stat}/records/history/${call.region === 'world' ? 'world' : `country/${call.region}`}.json`);
    const rows = selectCurrentRecords((data.rows as WcaRecordRow[]).filter(r => r.e === call.event));
    const href = `/wca/records?show=current&region=${call.region}&event=${call.event}`;
    const formatted = rows.map(r => [r.t === 's' ? label('单次','Single') : label('平均','Average'), formatWcaResult(r.v, r.e, r.t === 's' ? 'single' : 'average'), name(r.pn), r.p, compName(r.c,r.cn,r.d), r.d]);
    out.evidence = { updated: data.updated, event:call.event, region:call.region, columns:['type','result','person','wcaId','competition','date'], rows:formatted };
    out.sources.push(source(`records:${call.region}:${call.event}`, label('WCA 纪录','WCA records'), href));
    table(label('当前纪录','Current records'), [label('类型','Type'),label('成绩','Result'),label('选手','Person'),'WCA ID',label('比赛','Competition'),label('日期','Date')], formatted);
  } else if (call.tool === 'find_person') {
    const rows = await read(url('https://www.worldcubeassociation.org/api/v0/persons', { q:call.query, per_page:10 }));
    out.evidence = rows.slice(0,10).map((r:any) => ({ wcaId:r.person.wca_id, name:r.person.name, country:r.person.country_iso2 }));
    out.sources = rows.slice(0,10).map((r:any) => source(`person:${r.person.wca_id}`, name(r.person.name), `/wca/persons/${r.person.wca_id}`));
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
      const results = data.results.filter((r:any)=>r.event_id===call.event).sort((a:any,b:any)=>(dates.get(a.competition_id) ?? '').localeCompare(dates.get(b.competition_id) ?? '') || a.competition_id.localeCompare(b.competition_id) || roundChronologicalOrder(a.round_type_id)-roundChronologicalOrder(b.round_type_id));
      const flags = personalRecordFlags(results as Array<{event_id:string;best:number;average:number}>);
      for (const metric of ['single','average'] as const) {
        const points = results.flatMap((r:any)=>{
          const value = metric === 'single' ? r.best : r.average;
          const date = dates.get(r.competition_id);
          if (!date || !(metric==='single' ? flags.get(r)?.bestIsPb : flags.get(r)?.averageIsPb)) return [];
          return [{date,value,label:formatWcaResult(value,call.event,metric),person:title}];
        });
        if (points.length) out.artifacts.push({kind:'progress',title:`${title} · ${metric === 'single' ? label('单次','Single') : label('平均','Average')}`,event:call.event,metric,points});
      }
      out.evidence = {...out.evidence as object, progress:out.artifacts.filter(a=>a.kind==='progress').map(a=>({title:a.title,metric:a.metric,improvements:a.points.length,first:a.points[0],current:a.points.at(-1),recent:a.points.slice(-5)})), progressionBasis:'strict round-best PR by competition start date and round; same-day competition order is not known'};
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
    out.evidence={...call,competitions:rows};
    out.sources=rows.map((c:any)=>source(`comp:${c.id}`,c.name,`/wca/comp/${c.id}`));
    table(label('比赛','Competitions'),[label('比赛','Competition'),label('城市','City'),label('地区','Country'),label('日期','Dates')],rows.map((c:any)=>[compName(c.id,c.name,c.start_date),c.city,c.country,formatDateRangeIso(c.start_date,c.end_date)]),rows.map((c:any)=>`/wca/comp/${c.id}`));
  } else if (call.tool === 'scrambles') {
    const all=await read(url(`${api}/wca/scrambles`,{compId:call.compId}));
    const rows=all.filter((r:any)=>r.event_id===call.event && r.round_type_id===call.round).slice(0,40);
    out.evidence={...call,rows};
    out.sources.push(source(`scrambles:${call.compId}`,label('官方比赛打乱','Official scrambles'),`/wca/comp/${call.compId}`));
    table(label('官方打乱','Official scrambles'),[label('组','Group'),label('序号','Number'),label('备打','Extra'),label('打乱','Scramble')],rows.map((r:any)=>[String(r.group_id),String(r.scramble_num),r.is_extra ? label('是','Yes') : '',r.scramble]));
  } else if (call.tool === 'recons') {
    const data=await read(url(`${api}/recon/list`,{wcaId:call.wcaId,comp:call.compId}));
    const rows=(Array.isArray(data)?data:data.rows ?? data.recons ?? []).filter((r:any)=>call.value===undefined || Number(r.value)===call.value || Number(r.raw_time)===call.value).slice(0,12);
    out.evidence=rows.map((r:any)=>({id:r.id,person:r.person,person_id:r.person_id,event:r.event,value:r.value,raw_time:r.raw_time,comp:r.comp,date:r.date,stm:r.stm,tps:r.tps,method:r.method}));
    out.sources=rows.map((r:any)=>source(`recon:${r.id}`,`${r.person} · ${r.value}`,`/recon/${r.id}`));
  } else if (call.tool === 'recon') {
    const r=await read(`${api}/recon/${call.id}`);
    if (r.visibility && r.visibility !== 'public') throw new Error('Only published reconstructions are indexed');
    // A deliberate public field projection: never pass author/account fields to the model.
    out.evidence=Object.fromEntries(['id','person','event','value','raw_time','method','date','comp','stm','tps','scramble','optimal_scramble','solution','reconstruction','note','oll','pll'].filter(k=>r[k]!=null).map(k=>[k,r[k]]));
    if (typeof r.solution === 'string') table(label('原始复盘步骤','Original reconstruction'),[label('步骤','Step'),label('原始记号与注释','Original notation and annotations')],r.solution.split('\n').filter(Boolean).map((line:string,i:number)=>[String(i+1),line]));
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
