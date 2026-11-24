import { isKnownCompetitionCity, localizeCity } from '@cuberoot/shared/city-localize';
import type { AssistantAnswer, AssistantMessage } from '@cuberoot/shared/site-assistant';
import { z } from 'zod';
import type { JsonReader } from './site_assistant_tools.js';

type Visit = {city:string; travel:boolean; wcaId?:string; year?:string};
function parseVisit(question:string):Visit|undefined {
  let q=question.normalize('NFKC').trim().replace(/[?!.。]+$/,'').trim();
  const year=/^(?:我\s*((?:19|20)\d{2})\s*年|((?:19|20)\d{2})\s*年\s*我)/.exec(q);
  if (year) q='我'+q.slice(year[0].length).trim();
  const travel=/旅游|旅行|出差|\b(?:on vacation|as a tourist|on business)\b/i.test(q);
  if (travel) q=q.replace(/(?:旅游|旅行|出差)|\s+(?:on vacation|as a tourist|on business)$/gi,'').trim();
  const place=[
    /^我(?:一共|总共)?(?:去过|去了)(?:几|多少)次(.+)$/,
    /^我(?:一共|总共)?(?:去过|去了)(.+?)(?:几|多少)次$/,
    /^我在(.+?)(?:一共|总共)?(?:参加过|参加了|参加|比过)(?:几|多少)(?:场|次|个)(?:WCA\s*)?比赛$/i,
    /^how many (?:WCA )?competitions (?:have I (?:attended|entered)|did I attend|have I competed in) in (.+)$/i,
    /^how many times have I (?:been to|visited|competed in) (.+)$/i,
  ].map(pattern=>pattern.exec(q)?.[1]?.trim()).find(Boolean);
  if (!place || !isKnownCompetitionCity(place)) return;
  return {city:place,travel,...(year ? {year:year[1] ?? year[2]} : {})};
}

function continueVisit(question:string,prior?:Visit):Visit|undefined {
  if (!prior || prior.travel) return;
  const id=question.trim().toUpperCase();
  if (/^\d{4}[A-Z]{4}\d{2}$/.test(id)) return {...prior,wcaId:id};
  const city=/^(?:那|那么)\s*(.+?)\s*呢[？?。]?$/u.exec(question.trim())?.[1];
  if (city && isKnownCompetitionCity(city)) return {...prior,city};
  const year=/^(?:那|那么)?\s*((?:19|20)\d{2})\s*年(?:呢)?[？?。]?$/.exec(question.trim())?.[1];
  if (year) return {...prior,year};
}

export function personalCityRequest(question:string,history:AssistantMessage[]):Visit|undefined {
  const direct=parseVisit(question);
  if (direct) return direct;
  let prior:Visit|undefined;
  for (const message of history) {
    if (message.role==='user') prior=parseVisit(message.content) ?? continueVisit(message.content,prior);
  }
  return continueVisit(question,prior);
}

const competition=z.object({id:z.string().min(1),city:z.string().nullish(),country_iso2:z.string().nullish(),start_date:z.string().nullish()});
const profileSchema=z.object({
  wcaId:z.string(), profile:z.object({person:z.object({wca_id:z.string()})}),
  results:z.array(z.object({competition_id:z.string().min(1)})).nonempty(),
  comps:z.array(competition),
});
const cityKey=(value:string)=>value.normalize('NFKC').split(/[,，]/,1)[0].trim().toLowerCase().replace(/市$/,'');

async function publishedAttendance(id:string,read:JsonReader,signal:AbortSignal) {
  try {
    const data=profileSchema.parse(await read('https://api.cuberoot.me/v1/wca/person-page?wcaId='+id));
    if (data.wcaId!==id || data.profile.person.wca_id!==id) throw Error('Profile identity mismatch');
    const comps=new Map(data.comps.map(c=>[c.id,c]));
    const ids=new Set(data.results.map(r=>r.competition_id));
    return {rows:[...ids].map(compId=>comps.get(compId)),href:'/wca/persons/'+id,unposted:0};
  } catch {
    signal.throwIfAborted();
    const url='https://www.worldcubeassociation.org/api/v0/persons/'+id+'/competitions';
    const competitions=z.array(competition.extend({results_posted_at:z.string().nullable(),cancelled_at:z.string().nullable()})).nonempty().parse(await read(url));
    const rows=new Map(competitions.filter(c=>c.results_posted_at && !c.cancelled_at).map(c=>[c.id,c]));
    return {rows:[...rows.values()],href:'https://www.worldcubeassociation.org/persons/'+id,unposted:competitions.filter(c=>!c.cancelled_at && !c.results_posted_at).length};
  }
}

export async function personalCityAnswer(visit:Visit,viewer:string|undefined,lang:'zh'|'en',read:JsonReader,signal:AbortSignal):Promise<AssistantAnswer> {
  const {city}=visit;
  const say=(zh:string,en:string)=>lang==='zh'?zh:en;
  if (visit.travel) return {answer:say('我没有你的私人行程记录，无法确认你实际去过'+city+'几次。WCA 成绩只能核对当地参赛场数。','I do not have your travel history. WCA results can only establish how many competitions you attended in '+city+'.'),sources:[]};
  const id=visit.wcaId ?? viewer;
  if (!id) return {answer:say('若要查你在'+city+'参加过几场 WCA 比赛，请提供或绑定你的 WCA ID。私人出行次数需要查自己的行程记录。','Please provide or link your WCA ID to count competitions in '+city+'. Actual visits require your travel history.'),sources:[]};
  const source={id:'attendance:'+id,title:'WCA · '+id,href:'https://www.worldcubeassociation.org/persons/'+id};
  try {
    const {rows,href,unposted}=await publishedAttendance(id,read,signal);
    let count=0, unknown=0, undated=0;
    for (const c of rows) {
      if (visit.year) {
        if (!c?.start_date || !/^\d{4}-\d{2}-\d{2}/.test(c.start_date)) {undated++;continue;}
        if (!c.start_date.startsWith(visit.year+'-')) continue;
      }
      if (!c?.city?.trim() || /multiple (?:cities|locations)|多地/i.test(c.city)) {unknown++;continue;}
      if ([c.city,localizeCity(c.city,true,c.country_iso2)].some(value=>cityKey(value)===cityKey(city))) count++;
    }
    const period=visit.year ? say(visit.year+' 年',' in '+visit.year) : '';
    const result=say('按 WCA 公开成绩，'+id+' '+period+'在'+city+'有 '+count+' 场可核实的比赛。','Published WCA results confirm '+count+' competitions in '+city+period+' for '+id+'.');
    const caveat=unknown?say('另有 '+unknown+' 场无法确定举办城市。',' The host city is uncertain for '+unknown+' other competitions.'):'';
    const dateNote=undated?say('另有 '+undated+' 场缺少日期，无法归入所问年份。',' '+undated+' other competitions have no usable date.'):'';
    const coverage=unposted?say('另有 '+unposted+' 场缺少成绩发布日期，未计入。',' '+unposted+' other entries have no results publication date and are excluded.'):'';
    return {answer:result+caveat+dateNote+coverage+say('同场多个项目只计一次，私人行程次数无法从参赛记录判断。',' Each competition counts once across events. Travel frequency cannot be inferred from attendance.')+' [['+source.id+']]',sources:[{...source,href,read:true}]};
  } catch {
    signal.throwIfAborted();
    return {answer:say('暂时无法读取 '+id+' 的完整参赛记录，无法核实在'+city+'的场数。','The full competition record for '+id+' is unavailable, so the count in '+city+' could not be verified.')+' [['+source.id+']]',sources:[{...source,read:false}]};
  }
}
