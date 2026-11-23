import type { AssistantMessage } from '@cuberoot/shared/site-assistant';
import type { AssistantContext } from './site_assistant_context.js';
import { singleRoundEvent } from './site_assistant_scope.js';
import { worldsFinalRequest } from './site_assistant_public_queries.js';
import { z } from 'zod';
import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { EVENT_DISPLAY_ZH, EVENT_DISPLAY_EN } from '@cuberoot/shared/wca-events';
import { formatWcaResult } from '@cuberoot/shared/wca-format-result';
import { withTransaction } from '../db/connection.js';
import type { AssistantToolCall, JsonReader, ToolResult } from './site_assistant_tools.js';

export const roundRowSchema = z.object({
  pos: z.number().int().positive(), wca_id: z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/),
  name: z.string().min(1).max(200), average: z.number().int(), best: z.number().int(),
  format_id: z.string().max(2), round_type_id: z.string().min(1).max(2),
  attempts: z.array(z.number().int().min(-2)).max(5).nullish(),
});
export type RoundRow = z.infer<typeof roundRowSchema>;
export type RoundCall = Extract<AssistantToolCall, {tool:'competition_round'}>;
type Lang = 'zh'|'en';

const roundTypes: Record<string, string[]> = {
  final:['f','c'], first:['1','d'], second:['2','e'], third:['3','g'],
};
const precedingRounds = ['3','g','2','e','1','d'];

async function readLocal(call: RoundCall) {
  return withTransaction(async run => {
    await run('SET TRANSACTION READ ONLY');
    await run("SET LOCAL statement_timeout='4s'");
    const params: unknown[] = [call.compId, call.event];
    let roundFilter = 'r.round_type_id = ANY(?::text[])';
    if (call.round === 'semifinal') {
      // Identify the penultimate numbered round before filtering out other people.
      roundFilter = `r.round_type_id = (SELECT round_type_id FROM wca_person_results
        WHERE comp_id=? AND event_id=? AND round_type_id=ANY(?::text[])
        AND EXISTS (SELECT 1 FROM wca_person_results f WHERE f.comp_id=? AND f.event_id=? AND f.round_type_id IN ('f','c'))
        ORDER BY array_position(?::text[],round_type_id::text) LIMIT 1)`;
      params.push(call.compId,call.event,precedingRounds,call.compId,call.event,precedingRounds);
    } else params.push(roundTypes[call.round] ?? [call.round]);
    if (call.people) params.push(call.people);
    params.push(call.limit);
    return run<RoundRow>(`SELECT r.pos,r.wca_id,p.name,r.average,r.best,r.format_id,r.round_type_id,r.attempts
      FROM wca_person_results r JOIN wca_persons p USING (wca_id)
      WHERE r.comp_id=? AND r.event_id=? AND r.pos>0 AND ${roundFilter}
      ${call.people ? 'AND r.wca_id=ANY(?::text[])' : ''}
      ORDER BY r.pos,r.wca_id LIMIT ?`, params);
  });
}

export async function readCompetitionRound(call: RoundCall, read: JsonReader): Promise<RoundRow[]> {
  let local: RoundRow[] | undefined;
  try { local = await readLocal(call); } catch { /* Published WCA results also work on installations without the import. */ }
  const podium=worldId.test(call.compId) && call.round==='final' && !call.people && call.limit<=3;
  if (local?.length && (!podium || local.length===call.limit) && (!call.people || local.length === call.people.length) && (!call.details || local.every(row => row.attempts?.some(value => value !== 0)))) return local;
  if (podium) {
    try {
      const url='https://www.worldcubeassociation.org/api/v0/competitions/'+call.compId+'/podiums';
      const data=await read(url);
      if (Array.isArray(data)) {
        const ranked=data.filter(row=>row?.event_id===call.event && row.competition_id===call.compId && roundTypes.final.includes(row.round_type_id))
          .map(row=>roundRowSchema.parse(row)).sort((a,b)=>a.pos-b.pos || a.wca_id.localeCompare(b.wca_id)).slice(0,call.limit);
        if (ranked.length===call.limit && ranked.every((row,i)=>row.pos<=i+1 && (!call.details || row.attempts?.some(value=>value!==0)))) return ranked;
      }
    } catch { /* The full event results remain available when the podium feed is incomplete or offline. */ }
  }
  try {
    const url = 'https://www.worldcubeassociation.org/api/v0/competitions/'+encodeURIComponent(call.compId)+'/results/'+encodeURIComponent(call.event);
    const data = await read(url);
    if (data?.id !== call.event || !Array.isArray(data.rounds)) throw Error('Invalid competition result');
    const available = data.rounds.map((r:{roundTypeId:string}) => r.roundTypeId);
    const types = call.round === 'semifinal'
      ? (available.some((id:string) => roundTypes.final.includes(id)) ? [precedingRounds.find(id => available.includes(id))] : [])
      : roundTypes[call.round] ?? [call.round];
    const round = data.rounds.find((r:{roundTypeId:string}) => types.includes(r.roundTypeId));
    if (!round) return local ?? [];
    if (!Array.isArray(round.results)) throw Error('Invalid round results');
    const rows: RoundRow[] = [];
    for (const row of round.results) {
      if (row.competition_id !== call.compId || row.event_id !== call.event || row.round_type_id !== round.roundTypeId) throw Error('Round identity mismatch');
      if (row.pos <= 0 || (call.people && !call.people.includes(row.wca_id))) continue;
      rows.push(roundRowSchema.parse(row));
    }
    return rows.sort((a,b) => a.pos-b.pos || a.wca_id.localeCompare(b.wca_id)).slice(0,call.limit);
  } catch (error) {
    if (local?.length) return local;
    throw error;
  }
}

export function attemptCells(row: RoundRow, event: string): string[] {
  const values = row.attempts ?? [];
  let count = values.length;
  while (count && values[count-1] === 0) count--;
  const active = values.slice(0,count);
  const trimmed = new Set<number>();
  if (row.format_id === 'a' && count === 5 && row.average > 0 && active.every(v => v !== 0)) {
    const order = active.map((v,i) => ({i,score:v > 0 ? v : Infinity})).sort((a,b) => a.score-b.score || a.i-b.i);
    trimmed.add(order[0].i);
    trimmed.add(order[4].i);
  }
  return active.map((v,i) => {
    const value = formatWcaResult(v,event,'single');
    return trimmed.has(i) ? '('+value+')' : value;
  });
}

function roundSource(compId: string) {
  return {id:'competition:'+compId,title:compId,href:'/wca/comp/'+compId,read:true};
}
function profile(row: RoundRow, lang:Lang) {
  return {id:'wca-person:'+row.wca_id,title:displayCuberName(row.name,lang==='zh')+' · WCA',href:'https://www.worldcubeassociation.org/persons/'+row.wca_id,read:false};
}
export async function roundAnswer(call: RoundCall, lang:Lang, read:JsonReader): Promise<ToolResult> {
  const rows = await readCompetitionRound(call,read);
  const columns = lang==='zh' ? ['名次','选手','单次','平均'] : ['Place','Competitor','Single','Average'];
  if (call.details) columns.push(lang==='zh'?'逐把成绩（括号为剔除项）':'Attempts (discarded results in parentheses)');
  return {evidence:{compId:call.compId,event:call.event,round:call.round,rows},roundRows:rows,
    sources:[roundSource(call.compId)],artifacts:[{kind:'table',title:call.compId,columns,
      rows:rows.map(row => [String(row.pos),displayCuberName(row.name,lang==='zh'),formatWcaResult(row.best,call.event,'single'),
        formatWcaResult(row.average,call.event,'average'),...(call.details?[attemptCells(row,call.event).join(' · ') || '—']:[])]),
      links:rows.map(row => profile(row,lang).href)}]};
}

const roundNames=[
    ['semifinal',/半决赛|准决赛|\bsemi[- ]?finals?\b/i],['final',/决赛|\bfinals?\b/i],
    ['first',/第一轮|首轮|\bfirst round\b/i],['second',/第二轮|\bsecond round\b/i],['third',/第三轮|\bthird round\b/i],
  ] as const;

export const worldsDirectoryUrl = 'https://www.worldcubeassociation.org/api/v0/competition_index?q=World%20Championship&championship_only=true&include_cancelled=false&sort=-start_date&per_page=50';
const pastCompetitionsUrl = 'https://static.cuberoot.me/stats/all_past_comps.json';
const worldId = /^WC\d{4}$/;
const worldEdition = z.object({
  id:z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,92}$/), end_date:z.iso.date(), championship_types:z.array(z.string()).optional(), cancelled_at:z.string().nullish(), results_posted_at:z.string().nullish(),
});

function worldEditions(data:unknown,pastArchive=false) {
  if (!Array.isArray(data)) throw Error('Invalid World Championship directory');
  const editions=data.filter(row=>pastArchive ? worldId.test(row?.id) : Array.isArray(row?.championship_types) && row.championship_types.includes('world')).map(row=>worldEdition.parse(row));
  if (!editions.length) throw Error('World Championship directory is empty');
  return editions;
}

export async function latestCompletedWorlds(today:string,read:JsonReader,signal:AbortSignal) {
  let editions;
  try { editions=worldEditions(await read(worldsDirectoryUrl)); }
  catch {
    signal.throwIfAborted();
    editions=worldEditions(await read(pastCompetitionsUrl),true);
  }
  return editions.filter(row=>!row.cancelled_at && (row.end_date<today || (row.end_date===today && row.results_posted_at)))
    .sort((a,b)=>b.end_date.localeCompare(a.end_date))[0]?.id;
}

// A podium projection is small enough to share between visitors and events.
// Check the competition and round identities before it enters the process cache.
export function validateWorldsFile(url:string,data:unknown) {
  if (url===worldsDirectoryUrl) return worldEditions(data);
  const compId=new URL(url).pathname.split('/').at(-2);
  if (!Array.isArray(data) || !data.length || !data.every(row=>row?.competition_id===compId && typeof row.event_id==='string' &&
    roundTypes.final.includes(row.round_type_id) && roundRowSchema.safeParse(row).success)) throw Error('Invalid WCA podiums');
  return data;
}

const latestWorlds=/(?:上(?:一)?(?:届|次)|最近(?:一次|一届)?|最新(?:一届)?)(?:已(?:经)?(?:举办|结束))?的?\s*(?:WCA\s*)?(?:魔方)?(?:世锦赛|世界(?:魔方)?锦标赛)|\b(?:last|latest|most recent|previous)\s+(?:completed\s+)?(?:WCA\s+)?(?:world championships?|worlds)\b/i;
const namedWorlds=/(?:(?:19|20)\d{2}\s*年?\s*(?:WCA\s*)?(?:魔方)?(?:世锦赛|世界(?:魔方)?锦标赛|world championships?\b|worlds\b)|(?:世锦赛|世界(?:魔方)?锦标赛|\b(?:WCA\s+)?world championships?|\bworlds)\s*(?:19|20)\d{2})/i;
type StandingsRequest=RoundCall | (Omit<RoundCall,'compId'> & {edition:'latest-worlds'});

// Accept complete standings requests only. An event placing without a named round
// refers to the final. Additional filters or ranking metrics need the planner.
export function standingsRequest(question:string,limit:number|undefined):StandingsRequest|undefined {
  const q=question.normalize('NFKC');
  const podium=/领奖台|冠亚季军|\bpodium\b/i;
  if (!limit) {
    if (podium.test(q)) limit=3;
    else if (/冠亚军/.test(q)) limit=2;
    else if (/冠军|\bchampion\b/i.test(q)) limit=1;
  }
  if (!limit) return;
  const relative=q.match(latestWorlds), worlds=q.match(namedWorlds), id=q.match(/\b[A-Z][A-Za-z0-9]{0,92}(?:19|20)\d{2}\b/);
  const label=(relative ?? worlds ?? id)?.[0];
  if (!label) return;
  const scope=q.replace(label,'');
  const event=singleRoundEvent(scope);
  if (!event) return;
  const round=roundNames.find(([,pattern])=>pattern.test(scope));
  const ranking=/前\s*(?:\d+|[一二两三四五六七八九十]+)\s*(?:名|位|人)?|\btop\s+\w+|领奖台|冠亚季军|冠亚军|冠军|\b(?:podium|champion)\b/i;
  const rank=scope.match(ranking);
  if (!rank || /最佳|平均|最快|最好|单次|\b(?:best|average|single|fastest)\b/i.test(scope.slice(0,rank.index))) return;
  const rest=(round ? scope.replace(round[1],'') : scope).replace(event.label,'').replace(ranking,'')
    .replace(/(?:[一二两三四五1-5]|每一?|逐)[把次]|依次|分别|各是多少|多少秒|多少|有哪些|哪些|按比赛顺序|不计入|剔除|标出|各自|个人|每人|两人|选手|比赛|成绩|名次|平均|最好|最佳|姓名|单次|明细|链接|主页|官方|请问|列出|给出|给我|告诉我|回答|项目|速拧|魔方|他们|她们|以及|及其|获得|拿到|拿了|为谁|谁|又|在|中|名|的|和|与|是|这|请|并|\bwca\b/gi,'')
    .replace(/\b(?:in|the|at|for|from|of|who|what|was|were|are|their|competitors?|finishers?|placings?|results?|times?|names?|list|give|both|individual|each|attempts?|solves?|single|best|averages?|in order|profiles?|official|links?|and|please|all|five|three|event|speedcubing|cube)\b/gi,'')
    .replace(/[\s\p{P}]/gu,'');
  if (rest) return;
  const selection={tool:'competition_round' as const,event:event.event,round:round?.[0] ?? 'final',limit,
    details:/[把次](?:成绩|依次|明细)|[一二两三四五1-5][把次]|每把|逐把|剔除|attempts?|solves?/i.test(scope)};
  if (relative) return {...selection,edition:'latest-worlds'};
  const compId=worlds?'WC'+worlds[0].match(/\d{4}/)![0]:label;
  return {...selection,compId};
}

function unavailableRound(call:RoundCall,lang:Lang):ToolResult {
  const summary=lang==='zh'?call.compId+' 的轮次成绩源暂时不可用，可在 WCA 官方成绩页核对。'
    :'Round results for '+call.compId+' are temporarily unavailable. Check the official WCA results page.';
  return {evidence:{notEvidence:true},outcome:{state:'temporary_failure'},factualSummary:summary,artifacts:[],
    sources:[{id:'wca-results:'+call.compId,title:call.compId+' · WCA',href:'https://www.worldcubeassociation.org/competitions/'+call.compId+'/results/all',read:false}]};
}

export async function standingsAnswer(call:RoundCall,lang:Lang,read:JsonReader,profiles:boolean):Promise<ToolResult> {
  let result:ToolResult;
  try { result=await roundAnswer(call,lang,read); } catch { return unavailableRound(call,lang); }
  const rows=result.roundRows ?? [];
  const lines=rows.map(row=>{
    const name=displayCuberName(row.name,lang==='zh');
    const average=formatWcaResult(row.average,call.event,'average');
    const best=formatWcaResult(row.best,call.event,'single');
    const timed=!['333fm','333mbf','333mbo'].includes(call.event);
    const withUnit=(value:string)=>timed && /^\d+\.\d{2}$/.test(value) ? value+(lang==='zh'?' 秒':' s') : value;
    const summary=lang==='zh'?'平均 '+withUnit(average)+'，最佳单次 '+withUnit(best):'average '+withUnit(average)+', best single '+withUnit(best);
    const attempts=call.details ? attemptCells(row,call.event) : [];
    return row.pos+'. '+name+' — '+summary+(call.details?' · '+(attempts.join(' / ') || (lang==='zh'?'缺少逐把成绩':'Attempts unavailable')):'');
  });
  if (call.details && rows.some(r=>r.format_id==='a' && r.average>0)) lines.push(lang==='zh'?'括号内的成绩不计入平均。':'Parentheses mark results discarded from the average.');
  if (profiles && rows.length<=10) result.sources.push(...rows.map(row=>profile(row,lang)));
  if (rows.length && call.round==='final') {
    const event=(lang==='zh'?EVENT_DISPLAY_ZH:EVENT_DISPLAY_EN)[call.event] ?? call.event;
    const title=worldId.test(call.compId) ? (lang==='zh'?call.compId.slice(2)+' 年世锦赛':call.compId.slice(2)+' World Championship') : call.compId;
    lines.unshift(title+' · '+event+(lang==='zh'?'决赛':' final'));
  }
  if (rows.length && worldId.test(call.compId)) result.sources.push({id:'wca-results:'+call.compId+':'+call.event,title:lang==='zh'?'WCA 官方成绩':'Official WCA results',
    href:'https://www.worldcubeassociation.org/competitions/'+call.compId+'/results/all?event='+call.event,read:false});
  result.factualSummary=lines.join('\n') || (lang==='zh'?'没有查到该轮的正式名次。':'No published placings were found for this round.');
  return result;
}

export async function medalComparison(call: RoundCall, lang: Lang, read: JsonReader, profiles: boolean): Promise<ToolResult|undefined> {
  const source = roundSource(call.compId);
  let ranked: RoundRow[];
  try {
    ranked = await readCompetitionRound(call,read);
  } catch {
    return unavailableRound(call,lang);
  }
  const rows = ranked.filter(row => row.pos===3 || row.pos===4);
  if (rows.length!==2 || rows[0].pos!==3 || rows[1].pos!==4) {
    const known=rows.map(row=>String(row.pos)+'. '+displayCuberName(row.name,lang==='zh')+' '+formatWcaResult(row.average,call.event,'average')).join(', ');
    const reason=ranked.length ? (lang==='zh'?'该轮缺少唯一的第三、第四名组合，无法比较。':'The round has no unique third/fourth pair to compare.')
      : (lang==='zh'?'没有查到该场三阶决赛的正式名次。':'No published 3x3 final placings were found.');
    return {evidence:{compId:call.compId,rows},outcome:{state:ranked.length?'partial':'empty'},factualSummary:[reason,known].filter(Boolean).join(' '),
      sources:[source],artifacts:[]};
  }
  const [bronze,fourth] = rows;
  const name = (row:RoundRow) => displayCuberName(row.name,lang==='zh');
  const avg = (row:RoundRow) => formatWcaResult(row.average,call.event,'average') + (row.average>0 ? (lang==='zh'?' 秒':' s') : '');
  const lines = [lang==='zh'
    ? call.compId+' 三阶决赛第四名是 '+name(fourth)+'，平均 '+avg(fourth)+'。铜牌是 '+name(bronze)+'，平均 '+avg(bronze)+'。'
    : call.compId+' 3x3 final: fourth was '+name(fourth)+' ('+avg(fourth)+'); bronze was '+name(bronze)+' ('+avg(bronze)+').'];
  const valid = rows.every(row => row.average>0);
  const delta = (Math.abs(fourth.average-bronze.average)/100).toFixed(2);
  lines[0] += valid ? (lang==='zh'?'相差 '+delta+' 秒。':' The gap was '+delta+' s.')
    : (lang==='zh'?'有效平均不足，无法计算差值。':'There are fewer than two valid averages.');
  if (call.details) {
    lines.push(lang==='zh'?'逐把成绩按比赛顺序排列，括号表示不计入有效平均的成绩。':'Attempts in competition order, with results discarded from a valid average in parentheses.');
    for (const row of rows) lines.push(name(row)+' — '+(attemptCells(row,call.event).join(' · ') || (lang==='zh'?'缺少逐把成绩':'Attempts unavailable')));
  }
  return {evidence:{compId:call.compId,rows},roundRows:rows,sources:[source,...(profiles?rows.map(row=>profile(row,lang)):[])],factualSummary:lines.join('\n'),artifacts:[]};
}

const ordinal = /第\s*([1-5一二两三四五])\s*(?:把|次)|\b(?:attempt|solve)\s*#?([1-5])\b|\b(first|second|third|fourth|fifth)\s+(?:attempt|solve)\b/i;
function attemptRequest(question: string) {
  const match = ordinal.exec(question);
  const range = /极差|(?:最慢(?:的)?(?:一把|单次|成绩)?\s*(?:减去?|[-−])\s*最快(?:的)?(?:一把|单次|成绩)?)|\b(?:range|spread|slowest (?:minus|less) fastest)\b/i;
  const fastest = /最快(?:的)?(?:一把|单次|成绩)?|\b(?:fastest|best) (?:attempt|solve|time)\b/i;
  const slowest = /最慢(?:的)?(?:一把|单次|成绩)?|\b(?:slowest|worst) (?:attempt|solve|time)\b/i;
  const operation = range.test(question) ? 'range' : fastest.test(question) ? 'fastest' : slowest.test(question) ? 'slowest' : 'ordinal';
  if (operation === 'ordinal' && (!match || !/谁.*(?:快|慢)|(?:快|慢|差).*多少|who.*(?:faster|quicker)|how much faster/i.test(question))) return;
  const metric = {range,fastest,slowest,ordinal}[operation];
  const scope=question.replace(metric,'');
  const round=roundNames.find(([,pattern])=>pattern.test(scope));
  let terms = round ? scope.replace(round[1],'') : scope;
  if (operation !== 'ordinal') {
    terms=terms.replace(/只比较|比较|把每人|每人|各自|分别|有效单次|有效|列出|给出|各是|是多少|多少|谁的差值更小|谁更小|差值|精确到百分之一秒|保留两位小数|每位/g,'')
      .replace(/\b(?:smaller|lower|ranges?|spreads?|each|give|list|times?|solves?|valid|which|has|had|for|of|to two decimal places)\b/gi,'');
  }
  const remaining = terms.replace(/换成|换到|改成|改看|如果|那|只看|只比|刚才|这两个人|这两位选手|这两人|这两位|他们|她们|两人|选手|在|这场|比赛|的|谁更快|谁快|快多少秒|快多少|差多少秒|相差多少|请|只用|用一句话|一句话|回答|呢|中/g,'')
    .replace(/\b(?:only|compare|those|these|two|people|competitors|their|them|the|in|this|that|same|who|was|is|faster|quicker|by|and|how|much|many|seconds|on|answer|one|sentence|please|instead|what|about)\b/gi,'')
    .replace(/[\s\p{P}]/gu,'');
  if (remaining) return;
  if (operation!=='ordinal') return {operation,round:round?.[0]};
  if (!match) return;
  const word = match[1] ?? match[2] ?? match[3].toLowerCase();
  const ordinals:Record<string,number> = {一:1,二:2,两:2,三:3,四:4,五:5,first:1,second:2,third:3,fourth:4,fifth:5};
  return {operation,index:(ordinals[word] ?? Number(word))-1,
    round:round?.[0]};
}

export async function compareRoundAttempt(question:string,lang:Lang,history:AssistantMessage[],context:AssistantContext|undefined,read:JsonReader) {
  const request = attemptRequest(question);
  if (!request) return;
  const prior = context?.observations.at(-1);
  const lastSources = context?.memory?.episodes.at(-1)?.sourceIds;
  let rows: RoundRow[];
  let previous: RoundCall;
  if (prior?.call.tool==='competition_round' && prior.roundRows?.length===2
      && lastSources?.includes(roundSource(prior.call.compId).id)) {
    previous=prior.call;
    rows=prior.roundRows;
  } else {
    // A legacy conversation may predate saved rows. Resolve its original scope
    // and read the source again rather than accepting numbers from chat prose.
    const lastUser = [...history].reverse().find(message=>message.role==='user');
    const compId = lastUser && worldsFinalRequest(lastUser.content);
    if (!compId) return;
    previous={tool:'competition_round',compId,event:'333',round:'final',limit:6,details:true};
    try { rows=(await readCompetitionRound(previous,read)).filter(r=>r.pos===3 || r.pos===4); }
    catch { return {call:previous,result:unavailableRound(previous,lang)}; }
    if(rows.length!==2 || rows[0].pos!==3 || rows[1].pos!==4) return;
  }
  if (['333mbf','333mbo','333fm'].includes(previous.event)) return;
  const call:RoundCall = {...previous,round:request.round ?? previous.round,people:rows.map(r=>r.wca_id),limit:2,details:true};
  const switched=call.round!==previous.round;
  if (switched || rows.some(row=>!row.attempts?.length)) {
    try { rows=await readCompetitionRound(call,read); }
    catch { return {call,result:unavailableRound(call,lang)}; }
  }
  const source=roundSource(call.compId);
  const compared=rows.map(row=>{
    const name=displayCuberName(row.name,lang==='zh');
    const valid=(row.attempts ?? []).filter(value=>value>0);
    if (request.index!==undefined) return {name,value:row.attempts?.[request.index] ?? 0};
    if (!valid.length || (request.operation==='range' && valid.length<2)) return {name,value:null};
    const fastest=Math.min(...valid), slowest=Math.max(...valid);
    const value=request.operation==='range' ? slowest-fastest : request.operation==='fastest' ? fastest : slowest;
    return {name,value};
  });
  const label=request.index!==undefined ? (lang==='zh'?'第 '+(request.index+1)+' 把':'Attempt '+(request.index+1))
    : request.operation==='range' ? (lang==='zh'?'有效单次极差':'Range of valid solves')
    : request.operation==='fastest' ? (lang==='zh'?'最快有效单次':'Fastest valid solve') : (lang==='zh'?'最慢有效单次':'Slowest valid solve');
  let summary:string;
  const range=request.operation==='range';
  const formatted=(value:number|null)=>value===null ? (lang==='zh'?'有效成绩不足':'insufficient valid results')
    : range ? (value/100).toFixed(2)+(lang==='zh'?' 秒':' s') : formatWcaResult(value,call.event,'single');
  const known=compared.map(r=>r.name+' '+formatted(r.value)).join(' / ');
  const values=compared.filter((r):r is {name:string;value:number}=>r.value!==null && (range || r.value>0));
  if (values.length!==2) {
    const missing=range ? (lang==='zh'?'每人至少需要两把有效成绩才能比较极差':'Each competitor needs at least two valid solves to compare ranges') : undefined;
    summary=missing ? missing+(known?' ('+known+')':'')+(lang==='zh'?'。':'.')
      :lang==='zh'?label+'缺少两个有效成绩，无法比较差值'+(known?'（'+known+'）':'')+'。'
      :label+' has fewer than two valid results'+(known?' ('+known+')':'')+'.';
  } else {
    const [fast,slow]=values.sort((a,b)=>a.value-b.value);
    const times=known;
    const gap=((slow.value-fast.value)/100).toFixed(2);
    summary=fast.value===slow.value ? (lang==='zh'?label+'两人并列（'+times+'）。':label+' was tied ('+times+').')
      : range ? (lang==='zh'?label+'（'+times+'），'+fast.name+' 更小。':label+' ('+times+'). '+fast.name+' has the smaller range.')
      : lang==='zh'?label+' '+fast.name+' 快 '+gap+' 秒（'+times+'）。':label+': '+fast.name+' was faster by '+gap+' s ('+times+').';
  }
  const result:ToolResult={roundRows:rows,evidence:{compId:call.compId,rows},factualSummary:summary,sources:[source],artifacts:[]};
  return {call,result};
}
