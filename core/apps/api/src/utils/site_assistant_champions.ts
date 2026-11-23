import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { resolveAssistantTime, type AssistantAnswer, type AssistantDurableInput, type AssistantStreamEvent } from '@cuberoot/shared/site-assistant';
import { executeAnalysis, type AnalysisRows } from './site_assistant_analysis_db.js';
import { assistantDeadline, assistantFailureCode, assistantStage, AssistantFailure } from './site_assistant_diagnostics.js';
import { publicReadCache } from './site_assistant_public_queries.js';

type Window = { from:string; to:string };
const rollingMonths = /(?:最近|近|过去|此前)\s*(1[0-2]|[1-9一二两三四五六七八九]|十[一二]?)\s*个?月(?:里|内)?|\b(?:past|last|preceding)\s+(1[0-2]|[1-9]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+months?\b/gi;
const monthsByName: Record<string,number> = {一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,十一:11,十二:12,
  one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};

/** Accept only a complete, global 3x3 win-count question. Other scopes need the planner. */
export function recentChampionWindow(question:string,today:string):Window|undefined {
  const q=question.normalize('NFKC').toLowerCase().replace(/×/g,'x');
  const periods=[...q.matchAll(rollingMonths)];
  if(periods.length!==1)return;
  const period=periods[0];
  const request=q.replace(period[0],' ').replace(/^(?:(?:请问|请|帮我|最近)\s*)+/,'');
  const event=/三阶\s*(?:魔方\s*)?(?:速拧)?|\b3x3(?:x3)?\b/i;
  if(!event.test(request) || !/夺冠|冠军|\b(?:won|wins?|titles?|championships)\b/.test(request)
    || !/最多|\bmost\b/.test(request) || !/谁|哪(?:个|位)|\b(?:who|which)\b/.test(request))return;
  const residual=request.replace(event,' ')
    .replace(/在全球范围内|世界范围内|全球|官方比赛|正式比赛|比赛|赛事|夺冠|冠军|获胜|最多|次数|选手|运动员|哪(?:个|位)|拿到|获得|赢得|统计|是谁|谁|的|人|在|中|里|是|了|有/g,'')
    .replace(/\b(?:who|which|cuber|competitor|person|won|has|had|the|most|wins?|titles?|championships|in|at|for|during|over|worldwide|wca|official|competitions?|events?|did|win|got|scored|finals?|speedsolving|times?)\b/g,'')
    .replace(/[\s\p{P}]/gu,'');
  if(residual)return;
  const token=period[1] ?? period[2];
  const months=monthsByName[token] ?? Number(token);
  const end=new Date(today+'T00:00:00Z');
  const start=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-months,1));
  const lastDay=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
  start.setUTCDate(Math.min(end.getUTCDate(),lastDay));
  return {from:start.toISOString().slice(0,10),to:today};
}

/** This narrow request can execute even when no model provider is configured. */
export function standaloneChampionWindow(input:Pick<AssistantDurableInput,'question'|'timeZone'|'history'|'images'|'references'>):Window|undefined {
  if(input.history.length || input.images?.length || input.references?.length)return;
  return recentChampionWindow(input.question,resolveAssistantTime('',new Date(),input.timeZone).today);
}

export async function runRecentChampionQuery(window:Window,lang:'zh'|'en',signal:AbortSignal,emit?:(event:AssistantStreamEvent)=>Promise<void>) {
  const tool='recent_3x3_champions';
  await emit?.({type:'status',status:{phase:'querying',tool}});
  return assistantStage('tool',()=>recentChampionAnswer(window,lang,signal),0,tool,undefined,window);
}

const recentWinsSql=`WITH wins AS (
  SELECT r.wca_id, count(DISTINCT r.comp_id)::int AS wins
  FROM assistant_public.results r JOIN assistant_public.competitions c ON c.id=r.comp_id
  WHERE r.event_id='333' AND r.round_type_id IN ('f','c') AND r.pos=1 AND r.best>0
    AND c.end_date BETWEEN $1::date AND $2::date
  GROUP BY r.wca_id
), leaders AS (
  SELECT wca_id,wins FROM wins WHERE wins=(SELECT max(wins) FROM wins)
)
SELECT l.wca_id,coalesce(p.name,l.wca_id) AS name,l.wins,count(*) OVER ()::int AS tied
FROM leaders l LEFT JOIN assistant_public.persons p ON p.wca_id=l.wca_id
ORDER BY l.wca_id LIMIT 20`;

const cachedWins=new Map<string,ReturnType<typeof publicReadCache<AnalysisRows>>>();

export async function recentChampionAnswer(window:Window,lang:'zh'|'en',signal:AbortSignal):Promise<AssistantAnswer> {
  const key=window.from+':'+window.to;
  let read=cachedWins.get(key);
  if(!read) {
    if(cachedWins.size>=24)cachedWins.delete(cachedWins.keys().next().value!);
    read=publicReadCache(60_000);
    cachedWins.set(key,read);
  }
  const result=await assistantDeadline(()=>read(()=>{
    const deadline=AbortSignal.timeout(5_000);
    return assistantDeadline(()=>executeAnalysis({sql:recentWinsSql,params:[window.from,window.to],datasets:['results','competitions','persons']},deadline),deadline);
  }),signal).catch(error=>{
    signal.throwIfAborted();
    throw new AssistantFailure(assistantFailureCode(error)==='timeout' || error?.code==='57014' ? 'timeout' : 'source_unavailable');
  });
  const {rows,importedAt}=result;
  if(!importedAt)throw new AssistantFailure('source_unavailable');
  const title={zh:'三阶速拧夺冠次数',en:'3×3 wins'}[lang];
  const source={id:'wca:recent-3x3-wins',title:{zh:'WCA 正式比赛成绩导出',en:'Official WCA results export'}[lang],href:'https://www.worldcubeassociation.org/export/results',read:true};
  const names=rows.map(row=>displayCuberName(String(row.name),lang==='zh'));
  const wins=Number(rows[0]?.wins);
  const tied=Number(rows[0]?.tied);
  const conclusion=lang==='zh'
    ? !rows.length ? '已导入的成绩中没有符合条件的三阶决赛冠军记录。' : tied>rows.length ? `最高为 ${wins} 次，共 ${tied} 人并列。下表列出其中 ${rows.length} 人。` : `${names.join('、')}${tied>1?'并列第一，均夺冠':'夺冠次数最多，共'} ${wins} 次。`
    : !rows.length ? 'The imported results contain no eligible 3×3 winners for this period.' : tied>rows.length ? `${tied} competitors tied with ${wins} wins. The table shows ${rows.length} of them.` : `${names.join(', ')} ${tied>1?'tied for first with':'led with'} ${wins} ${wins===1?'win':'wins'}.`;
  const imported=importedAt.slice(0,10);
  const scope=lang==='zh'
    ? `按比赛结束日期统计 ${window.from} 至 ${window.to} 的有效决赛第一名，每人每场计一次。基于 ${imported} 导入的 WCA 正式成绩，尚未录入的成绩未计入。`
    : `Counts one valid first-place final per competitor per competition, using competition end dates from ${window.from} to ${window.to}. Based on WCA results imported on ${imported}. Results outside that snapshot are excluded.`;
  return {answer:`${conclusion}\n\n${scope} [[${source.id}]]`,sources:[source],artifacts:rows.length?[{kind:'table',title,
    columns:{zh:['选手','夺冠次数'],en:['Competitor','Wins']}[lang],rows:rows.map((row,index)=>[names[index],String(row.wins)]),links:rows.map(row=>'/wca/persons/'+row.wca_id)}]:[]};
}
