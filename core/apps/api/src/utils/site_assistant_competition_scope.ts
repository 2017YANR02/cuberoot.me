import { CONTINENT_CODES, CONTINENT_NAMES } from '@cuberoot/shared/continent';
import { canonicalCountryNamesByIso2 } from '@cuberoot/shared/country-flag';
import { isValidIsoDate } from '@cuberoot/shared/iso-date';
import { countryName } from '@cuberoot/shared/country-name';

type HostRegion = {kind:'country'|'continent'|'world'; id:string; en:string; zh:string};
export const continentIds = CONTINENT_CODES.map(code=>'_'+CONTINENT_NAMES[code].en);
const regions = new Map<string, HostRegion>();
const world:HostRegion={kind:'world',id:'world',en:'the world',zh:'全球'};
for (const name of ['全球','世界','全世界','the world','worldwide']) regions.set(name,world);
for (const code of CONTINENT_CODES) {
  const names = CONTINENT_NAMES[code];
  const region:HostRegion = {kind:'continent', id:'_'+names.en, ...names};
  for (const alias of [names.zh, names.en.toLowerCase(), names.zh.replace(/美洲$/, '美')]) regions.set(alias, region);
}
for (const [code, canonical] of Object.entries(canonicalCountryNamesByIso2())) {
  if (!/^[a-z]{2}$/i.test(code)) continue;
  const en = countryName(code, false), zh = countryName(code, true);
  const region:HostRegion = {kind:'country', id:code.toUpperCase(), en, zh};
  for (const alias of [canonical, en, zh]) regions.set(alias.toLowerCase(), region);
}

// The shared time resolver expands relative ranges in the visitor's timezone.
// Accept its compact ISO ranges as well as explicitly written years and months.
function countPeriod(text:string) {
  const match = /((?:19|20)\d{2})-(\d{2})-(\d{2})(?:\s*(?:~|至|到|to)\s*((?:\d{4}-\d{2}-|\d{2}-)?\d{2}))?|((?:19|20)\d{2})(?:年(?:(\d{1,2})月)?|-(\d{2}))?/i.exec(text);
  if (!match) return;
  const [token,year,month,day,until,calendarYear,zhMonth,isoMonth] = match;
  if (year) {
    const from = [year,month,day].join('-');
    const end = until ? from.slice(0,10-until.length)+until : from;
    if (!isValidIsoDate(from) || !isValidIsoDate(end) || end<from) return;
    const exclusive = new Date(end+'T00:00:00Z');
    exclusive.setUTCDate(exclusive.getUTCDate()+1);
    const label = end===from ? from : from+' – '+end;
    return {token,from,before:exclusive.toISOString().slice(0,10),zh:label,en:label};
  }
  const m = zhMonth || isoMonth;
  if (!m) return {token,from:calendarYear+'-01-01',before:(Number(calendarYear)+1)+'-01-01',zh:calendarYear+' 年',en:calendarYear};
  const date = calendarYear+'-'+m.padStart(2,'0');
  if (!isValidIsoDate(date+'-01')) return;
  const before = new Date(Date.UTC(Number(calendarYear),Number(m),1)).toISOString().slice(0,10);
  return {token,from:date+'-01',before,zh:calendarYear+' 年 '+Number(m)+' 月',en:date};
}

// Only promote a standalone calendar interval to a required WHERE constraint.
// Comparisons, named editions, as-of dates and rolling windows need review.
export function requestedAnalysisPeriod(question:string, normalized:string) {
  const period=countPeriod(normalized);
  if (!period) return;
  const remainder=normalized.replace(period.token,' ');
  if (/(?:19|20)\d{2}|[上下]半年|锦标赛|公开赛|邀请赛|资格赛|季度|赛季|年初|年底|年末|\d+\s*[月日号]|至|到\s*\d|以来|以前|以后|之前|之后|截至|截止|早于|晚于|最近|近\s*\d|过去|从.+(?:开始|起)|\b(?:from|between|since|until|before|after|through|as of|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|championships?|quarter|season|past|rolling)\b/i.test(remainder)) return;
  if (/^\d{4}年/.test(period.token) || normalized!==question || /\b(?:in|during|for)\s+$/i.test(normalized.slice(0,normalized.indexOf(period.token)))) return period;
}

// Parse each axis separately. Only a complete, single-measure question can
// bypass planning. Extra wording (an event, an exclusion, another request)
// must not disappear when extracting the region or the period.
const publicMeasures = [
  {metric:'competitions', zh:/^(?:有|举办了?|举行了?)?(?:多少|几)场\s*(?:WCA\s*)?(?:魔方)?(?:比赛|赛事)$/i, en:'(?:wca )?competitions'},
  {metric:'persons', zh:/^(?:有)?(?:多少|几)(?:名|位|个)?(?:不同)?选手(?:参加(?:过|了)?(?:WCA\s*)?比赛|参赛)$/, en:'(?:distinct |different )?competitors (?:competed|participated)'},
  {metric:'cities', zh:/^(?:有)?(?:多少|几)(?:个|座)?(?:不同)?城市(?:举办|举行)(?:了|过)?(?:WCA\s*)?(?:比赛|赛事)$/i, en:'(?:distinct |different )?cities hosted (?:wca )?competitions'},
  {metric:'countries', zh:/^(?:有)?(?:多少|几)个(?:不同)?国家(?:或地区)?(?:举办|举行)(?:了|过)?(?:WCA\s*)?(?:比赛|赛事)$/i, en:'(?:different )?countries(?: or regions)? hosted (?:wca )?competitions'},
] as const;

export function publicCountRequest(normalizedQuestion:string,history:readonly {role:string;content:string}[]=[]) {
  if (history.some(message=>message.role==='user' && /(?:接下来|之后|后续|以后|本次对话|这次对话).{0,30}(?:只|仅|一律|始终|都|统一)|(?:from now on|for the rest of (?:this|our) (?:chat|conversation)|always (?:use|count|exclude|include))/i.test(message.content))) return;
  const text=normalizedQuestion.trim().replace(/[?？。.!！]+$/, '').trim();
  const period=countPeriod(text);
  if (!period || text.includes('@')) return;
  const q=text.replace(period.token,'@').replace(/(?:的)?(?:WCA\s*)?(?:魔方)?(?:比赛|赛事)(?:一共|总共|共)?有(多少|几)场$/i,'有$1场比赛');
  const zh=/^(?:请问|请统计|请查询)?\s*(?:@\s*(?:在)?(.{1,32}?)|(.{1,32}?)\s*@)(?:地区)?(?:一共|总共|共)?((?:有|举办|举行|多少|几).+)$/i.exec(q);
  if (zh) {
    const region=regions.get((zh[1] ?? zh[2]).trim().toLowerCase());
    const measure=publicMeasures.find(item=>item.zh.test(zh[3]));
    if (region && measure) return {region,metric:measure.metric,...period};
  }
  for (const measure of publicMeasures) {
    const location=measure.metric==='competitions'?'(?:were (?:held )?in|are (?:there )?in|in)':'in';
    const match=new RegExp('^how many '+measure.en+' '+location+' (.{1,50}?) (?:in |on |from )?@$','i').exec(q);
    const region=match && regions.get(match[1].trim().toLowerCase());
    if (region) return {region,metric:measure.metric,...period};
  }
}

export type PublicCountRequest=NonNullable<ReturnType<typeof publicCountRequest>>;

// Also protect explicit hosting language in longer analysis requests. A named
// championship or a reference to competitors from a region is a different scope.
export function requestedHostContinent(question:string) {
  if (/(?:除|以外|之外|不在|未在|没有在|excluding|outside|except|not (?:held )?in)/i.test(question)) return;
  const named = CONTINENT_CODES.filter(code=>{
    const {zh,en} = CONTINENT_NAMES[code];
    return question.includes(zh) || new RegExp('\\b'+en+'\\b','i').test(question);
  });
  if (named.length!==1) return;
  const {zh,en} = CONTINENT_NAMES[named[0]];
  if (new RegExp('(?:在|于)'+zh+'(?:地区)?(?:举办|举行)|(?:competitions?|events?) (?:held |hosted )?in '+en+'\\b','i').test(question)) return '_'+en;
}

export function matchesHostCountry(id:string, iso2:string) {
  return id.toUpperCase()===iso2 || regions.get(id.toLowerCase())?.id===iso2;
}
