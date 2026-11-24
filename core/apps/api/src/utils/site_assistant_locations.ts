import { canonicalCountryNamesByIso2 } from '@cuberoot/shared/country-flag';
import { localizeCity, resolveCnProvince } from '@cuberoot/shared/city-localize';
import { isValidIsoDate } from '@cuberoot/shared/iso-date';
import { EVENT_DISPLAY_EN, EVENT_DISPLAY_ZH } from '@cuberoot/shared/wca-events';
import type { AssistantMessage } from '@cuberoot/shared/site-assistant';
import { publishedAttendance } from './site_assistant_city.js';
import type { AssistantContext } from './site_assistant_context.js';
import { toolCallSchema, type AssistantToolCall, type JsonReader, type ToolResult } from './site_assistant_tools.js';

type Countries = Extract<AssistantToolCall,{tool:'person_countries'}>;
type Location = NonNullable<Countries['location']>;
const labels = {zh:new Intl.DisplayNames('zh-Hans',{type:'region'}), en:new Intl.DisplayNames('en',{type:'region'})};
const countryCodes = new Map<string,string>();
for (const key of Object.keys(canonicalCountryNamesByIso2())) {
  const code=key.toUpperCase();
  for (const label of [code,labels.zh.of(code),labels.en.of(code)]) if (label) countryCodes.set(label.toLowerCase(),code);
}

const orderedLabels=[...countryCodes].sort((a,b)=>b[0].length-a[0].length);

function locationIntent(question:string, countries:string[]) {
  let q=question.normalize('NFKC').trim().toLowerCase().replace(/[?!.。]+$/,'').trim();
  if (/[\u3400-\u9fff]/.test(q)) q=q.replace(/\s+/g,'');
  let named:string|undefined;
  for (const [label,code] of orderedLabels) {
    if (!countries.includes(code) || !q.includes(label)) continue;
    // Short ISO codes must not match ordinary words, e.g. "in China".
    if (/^[a-z]/.test(label) && !q.split(/[^a-z]+/).includes(label) && !q.endsWith(' '+label)) continue;
    if (label===code.toLowerCase() && !question.includes(code)) continue;
    named=code;
    q=q.replace(label,'@');
    break;
  }
  q=q.replace(/^(?:请问|请说说|请列出)\s*/,'');
  q=q.replace(/^(?:那其中|那么|其中|那(?!(?:些|几|[一二三四五六七八九十\d]+)场))[，,\s]*/,'').replace(/(?:呢|吗)$/,'').trim();
  const match=/^(?:(?:在)?@(?:的|这几场|那几场)?|(?:这|那)(?:些|几|[一二三四五六七八九十\d]+)场(?:比赛)?)?(?:具体|分别|都|又|是|在|有|办在|去了|去过|参加了|参加过|分布在|举办在|举行在|落在|位于|的)*哪(?:些|几个|个|儿|里|几场)(?:的)?(地区|地方|省份?|省市|城市|市|比赛|赛事)?(?:办的|举办的|举行的|办|举办|举行|参赛|比赛)?$/.exec(q)
    ?? /^(?:and )?(?:which|what) (regions|areas|provinces|cities|competitions)(?: (?:in|within) @)?$/.exec(q);
  if (!match) return;
  const view:Location['view']=/比赛|赛事|competitions/.test(match[1] ?? '') || q.includes('哪几场') ? 'competitions'
    : /城市|^市$|cities/.test(match[1] ?? '') ? 'cities' : 'regions';
  return {named,view};
}

// The stable source locator supplies identity and filters. Displayed counts
// are used only to identify the referenced country; all answers reread results.
function sourceScope(source:string):Countries|undefined {
  const [kind,wcaId,from,to,event,country,view,region,...extra]=source.split(':');
  if (extra.length || (kind==='person' ? from!==undefined :
    kind!=='person-countries' || !event || !!country!==!!view)) return;
  const parsed=toolCallSchema.safeParse({tool:'person_countries',wcaId,
    from:from==='all'?undefined:from, to:to==='all'?undefined:to, event:event==='all'?undefined:event,
    ...(country ? {location:{country,view,...(region?{region}:{})}} : {})});
  return parsed.success && parsed.data.tool==='person_countries' ? parsed.data : undefined;
}

export function personalCountriesRequest(question:string) {
  return /^(?:我(?:去过哪些国家比赛|参加过哪些国家的比赛)|Which countries have I competed in)[?？。!！\s]*$/i.test(question.trim());
}

const chooseCountry={zh:'你想展开上表中的哪个国家或地区？',en:'Which country or region in the table would you like to explore?'};
export function attendanceLocationFollowUp(question:string,history:AssistantMessage[],context?:AssistantContext):{call:Countries}|{clarify:true}|undefined {
  if (question.length>200) return;
  let previous=history.at(-1);
  if (previous?.role!=='assistant') return;
  let query=question;
  if (Object.values(chooseCountry).some(prompt=>previous!.content.startsWith(prompt))) {
    const country=countryCodes.get(question.trim().replace(/[。.!！?？]+$/,'').toLowerCase());
    const original=history.at(-2);
    previous=history.at(-3);
    if (!country || original?.role!=='user' || previous?.role!=='assistant') return;
    const intent=locationIntent(original.content,[]);
    if (!intent) return;
    query='which '+intent.view+' in '+labels.en.of(country);
  }
  const text=previous.content;
  const title=/^(参赛国家和地区|Countries and regions competed in|参赛地点明细|Competition location details)$/m.exec(text)?.[1];
  if (!title) return;
  const sourceIds=[...new Set([...text.matchAll(/^Attendance source: ([^\n]+)$/gm)].map(m=>m[1]))];
  const candidates=sourceIds.length ? sourceIds.map(sourceScope) :
    context?.observations.filter(item=>item.call.tool==='person_countries' && text.includes('/persons/'+item.call.wcaId) && item.tables.some(t=>t.title===title)).map(item=>item.call as Countries) ?? [];
  // Older clients have the displayed profile link but no query locator. Only
  // reconstruct lifetime scope for an explicitly unfiltered, immediate question.
  const previousQuestion=history.at(history.lastIndexOf(previous)-1);
  if (!candidates.length && previousQuestion?.role==='user' && personalCountriesRequest(previousQuestion.content)) {
    const ids=[...new Set([...text.matchAll(/\/wca\/persons\/(\d{4}[A-Z]{4}\d{2})\b/g)].map(match=>match[1]))];
    if (ids.length===1) candidates.push({tool:'person_countries',wcaId:ids[0]});
  }
  if (candidates.length!==1 || !candidates[0]) return;
  const scope=candidates[0];
  const table=text.split(title+'\n').at(-1)!.split('\n\n')[0];
  const displayedRows=[...table.matchAll(/^\d+\t([^\t\n]+)\t(\d+)$/gm)];
  const displayedNames=displayedRows.map(row=>row[1]);
  const countries=scope.location ? [scope.location.country] : [...new Set(displayedNames.map(name=>countryCodes.get(name.toLowerCase())).filter((v):v is string=>!!v))];
  let region=scope.location?.region;
  if (scope.location?.view==='regions') {
    const names=displayedNames.sort((a,b)=>b.length-a.length);
    const selected=names.find(name=>query.toLowerCase().includes(name.toLowerCase()));
    if (selected) {
      region=selected;
      query=query.replace(new RegExp(selected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:省|市)?','i'),'@');
      if (/^(?:那(?:么)?)?@呢[？?。]?$/.test(query)) query='@有哪些城市';
    }
  }
  const intent=locationIntent(query,countries);
  if (!intent || !countries.length) return;
  const completeTable=!text.includes('context truncated');
  const countReference=/(?:这|那)\s*(\d+)\s*场/.exec(query);
  const matchingRows=countReference && !scope.location && completeTable
    ? displayedRows.filter(row=>row[2]===countReference[1]) : [];
  const inferred=matchingRows.length===1 ? countryCodes.get(matchingRows[0][1].toLowerCase()) : undefined;
  const onlyCountry=scope.location?.country ?? (displayedNames.length===1 && completeTable ? countries[0] : undefined);
  const country=intent.named ?? inferred ?? (countReference && !scope.location ? undefined : onlyCountry);
  if (!country) return {clarify:true};
  return {call:{...scope,location:{country,view:intent.view,...(region && !intent.named?{region}:{})}}};
}
export const attendanceCountryPrompt=(lang:'zh'|'en')=>chooseCountry[lang];

export async function attendanceLocationResult(call:Countries,location:Location,lang:'zh'|'en',read:JsonReader):Promise<ToolResult> {
  const {country,view}=location;
  const zh=lang==='zh';
  const {rows,href,unposted}=await publishedAttendance(call.wcaId,read,undefined,call.event);
  const id=['person-countries',call.wcaId,call.from ?? 'all',call.to ?? 'all',call.event ?? 'all',country,view,...(location.region?[location.region]:[])].join(':');
  const groups=new Map<string,number>();
  const competitions:Array<{name:string;id:string;city:string;date:string}>=[];
  let count=0, unknownScope=0, unknownPlace=0;
  for (const comp of rows) {
    if (comp?.country_iso2 && comp.country_iso2!==country) continue;
    if (call.from || call.to) {
      if (!comp?.start_date || !isValidIsoDate(comp.start_date)) {unknownScope++;continue;}
      if (call.from && comp.start_date<call.from || call.to && comp.start_date>call.to) continue;
    }
    if (!comp?.country_iso2) {unknownScope++;continue;}
    const city=comp.city?.trim();
    const singleCity=!!city && !/multiple (cities|locations)|多地/i.test(city);
    const province=singleCity && country==='CN' ? resolveCnProvince(city) : undefined;
    const regionLabel=(language:'zh'|'en')=>country==='CN' ? province?.[language] :
      singleCity ? (language==='zh' ? localizeCity(city,true,country) : city).split(/[,，]/).slice(1).map(s=>s.trim()).join(', ') || undefined : undefined;
    if (location.region) {
      const regions=[regionLabel('zh'),regionLabel('en')].filter(Boolean);
      if (!regions.length) {unknownScope++;continue;}
      if (!regions.some(name=>name?.toLowerCase()===location.region!.toLowerCase())) continue;
    }
    count++;
    if (view==='competitions') {
      competitions.push({name:comp.name || comp.id,id:comp.id,city:city ? localizeCity(city,zh,country) : '—',date:comp.start_date ?? '—'});
      continue;
    }
    let place:string|undefined;
    if (singleCity) {
      const parts=localizeCity(city,zh,country).split(/[,，]/).map(s=>s.trim());
      place=view==='cities' ? parts[0] : regionLabel(lang);
    }
    if (!place) {unknownPlace++;continue;}
    groups.set(place,(groups.get(place) ?? 0)+1);
  }
  competitions.sort((a,b)=>a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const sorted=[...groups].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],lang));
  const column=view==='competitions' ? (zh?'比赛':'Competition') : view==='cities' ? (zh?'城市':'City') : (zh?'省级地区':'Region');
  const host=[labels[lang].of(country),location.region].filter(Boolean).join(zh?' · ':', ');
  const scope=[call.from,call.to].some(Boolean) ? [call.from ?? '…', call.to ?? '…'].join(' – ') : '';
  const period=[scope,call.event && (zh?EVENT_DISPLAY_ZH:EVENT_DISPLAY_EN)[call.event]].filter(Boolean).join(' · ');
  const subject=call.wcaId+(period?' ('+period+')':'');
  const summary=zh ? subject+' 在'+host+'有 '+count+' 场可核实的 WCA 比赛。' : subject+' competed in '+count+' verified WCA competitions in '+host+'.';
  const notes=[
    unknownPlace && (zh?'其中 '+unknownPlace+' 场缺少可核实的'+column+'。':' The '+column.toLowerCase()+' is unknown for '+unknownPlace+' of these competitions.'),
    unknownScope && (zh?'另有 '+unknownScope+' 场缺少地点或日期，无法确定是否属于本次范围。':' '+unknownScope+' other entries lack the location or date needed to determine scope.'),
    unposted && (zh?'另有 '+unposted+' 场尚未公布成绩，未计入。':' '+unposted+' entries without posted results are excluded.'),
    Math.max(sorted.length,competitions.length)>100 && (zh?'表中列出前 100 项。':' The table shows the first 100 entries.'),
  ].filter(Boolean).join('');
  const listing=view==='competitions';
  const shown=competitions.slice(0,100);
  const tableRows=listing ? shown.map(c=>[c.name,c.city,c.date]) : sorted.slice(0,100).map(([name,total])=>[name,String(total)]);
  const columns=listing ? [column,zh?'举办地':'Host location',zh?'开始日期':'Start date'] : [column,zh?'比赛数':'Competitions'];
  const factualSummary=summary+notes;
  return {factualSummary,evidence:{wcaId:call.wcaId,country,count,event:call.event,from:call.from,to:call.to,groups:tableRows,unknownPlace,unknownScope,unposted},
    sources:[{id,title:'WCA · '+call.wcaId,href,read:true}],artifacts:[{kind:'table',title:zh?'参赛地点明细':'Competition location details',columns,rows:tableRows,...(listing?{links:shown.map(c=>'https://www.worldcubeassociation.org/competitions/'+encodeURIComponent(c.id))}:{})}]};
}
