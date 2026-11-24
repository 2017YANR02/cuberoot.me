import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { formatWcaResult } from '@cuberoot/shared/wca-format-result';
import { withTransaction } from '../db/connection.js';
import type { ToolResult } from './site_assistant_tools.js';

type Lang = 'zh'|'en';
export const fourthsId = 'most_4th_places';
export const fourthsUrl = 'https://static.cuberoot.me/stats/most_4th_places.json';

// Recognize only a fully consumed global request. Unknown qualifiers, proper names,
// event names, explicit years and compound questions stay with the planner.
export function publicLeaderboard(question: string): 'fourths'|'annual'|undefined {
  const q = question.normalize('NFKC').toLowerCase().replace(/殿军|(?:拿|得|获)第四(?=次数|最多|的次数)/g,'第四名');
  const fourth = /第\s*[四4]\s*名|4th[- ]places?|fourth[- ]places?|finished fourth|most_4th_places/.test(q);
  const annual = /单年|同一(?:个)?(?:自然)?年|单个自然年|一个自然年|一年(?:之内|内)|single (?:calendar )?year|one (?:calendar )?year/.test(q);
  if (fourth === annual || !/最多|榜|most|leader|top|排名/.test(q)) return;
  const remaining = q
    .replace(/most_4th_places|第\s*[四4]\s*名|前\s*(?:[一二两三四五六七八九十]+|\d{1,2})(?:名|位|人)?|top\s+(?:\d{1,2}|three|five|ten)\b/g,'')
    .replace(/同一场比赛|同一场|同场|不同项目|各自|各项目|全项目|所有项目|所有正式项目|所有比赛|分开计(?:算)?|各计一次|每人只取最好的一年|同一个自然年|同一自然年|同一年|同一个年|一年之内|一年内|单个自然年|一个自然年|单年|职业生涯|生涯|有史以来|历史上|世界上|全球|世界范围内|正式|有效成绩|累计|累积|合计|总共|wca|比赛结果|魔方比赛|比赛数|决赛|比赛|最多|多少|分别|每人|列出|请问|请列|请|读取|站内|本站|告诉我|帮我|给我|给|选手|运动员|姓名|名字|次数|场数|数量|年份|参赛|参加过|参加|获得|拿过|拿到|拿了|拿|取得|取|排行榜|统计榜|榜单|排名|记录|榜|哪些|谁|以及|分别是多少|不同|几次|几场|多少场|给出|查询|赛事|成绩|列|中|在|按|的|是|和|与|有|人|位|名/g,'')
    .replace(/\b(?:who|which|a|is|are|has|have|had|the|most|fourth|4th|place|places|finishes|in|finals|final|across|all|events|event|count|separately|each|competition|competitions|competitors|cubers|players|finished|won|career|careers|list|their|names|and|counts|single|one|calendar|year|years|attended|distinct|per|person|only|best|lifetime|official|historically|top)\b/g,'')
    .replace(/[\s\p{P}]/gu,'');
  if (remaining || /所有轮|所有比赛轮|非决赛|预赛|半决赛/.test(q)) return;
  if (annual && (!/比赛|参赛|competitions?/.test(q) || /决赛|决賽|finals?|有效成绩|valid results?/i.test(q))) return;
  if (fourth && /年份|哪一年|which year|calendar year/i.test(q)) return;
  return fourth ? 'fourths' : 'annual';
}

// A fixed global leaderboard cannot establish a ranking within a subset.
// Keep unrecognized ranking requests on the scoped analysis path even when
// the planner has guessed the name of the published file correctly.
export function needsScopedLeaderboard(question:string,kind:'fourths'|'annual') {
  if(publicLeaderboard(question)===kind)return false;
  const ranking=/最多|榜|前三|前五|排名|\b(?:top|rank(?:ing)?|most)\b/i.test(question);
  const topic=kind==='fourths' ? /第四名|第4名|fourth|4th/i : /参赛|比赛|competitions?|attend/i;
  return (ranking && topic.test(question))
    || /(?:19|20)\d{2}|仅限|只看|只算|指定|地区|现役|半决赛|预赛|全部轮|所有轮|各轮|单手|盲拧|[二三四五六七]阶|\b(?:only|semifinals?|preliminary|active events|all rounds|dnfs?|[2-7]x[2-7])\b/i.test(question);
}

// Only public data, one slot per endpoint. The shared operation has its own
// deadline; cancellation of one visitor never cancels another visitor's read.
export function publicReadCache<T>(ttl: number) {
  let value: { result:T; expires:number }|undefined;
  let pending: Promise<T>|undefined;
  return (load:()=>Promise<T>)=>{
    if (value && value.expires>Date.now()) return Promise.resolve(value.result);
    pending ??= load().then(result=>{
      value={result,expires:Date.now()+ttl};
      return result;
    }).finally(()=>{pending=undefined;});
    return pending;
  };
}
export const cachedFourths=publicReadCache<unknown>(60_000);

export function worldsFinalRequest(question:string) {
  if (!/(?:三阶|3x3(?:x3)?)/i.test(question) || !/决赛|\bfinal\b/i.test(question)
    || !/第四名|第\s*4\s*名|fourth|4th/i.test(question) || !/铜牌|第三名|bronze|third/i.test(question)
    || !/平均|average/i.test(question)) return;
  // Fail closed on other events, qualifiers and additional tasks.
  const match=question.match(/(?:WC|WCA World Championship\s*|Worlds\s*)(20\d\d)\b|\b(20\d\d)\s*年?(?:WCA\s*)?(?:世锦赛|世界锦标赛|world(?:s| championship))/i)
    ?? question.match(/(?:世锦赛|世界锦标赛)\s*(20\d\d)/);
  if (!match) return;
  const residual=question.toLowerCase().replace(match[0].toLowerCase(),'')
    .replace(/按(?:比赛|实际|原)?顺序|五[把次]|5[把次]|逐把(?:成绩)?|每一?把|单次明细|不计入|被?剔除|最快(?:的)?(?:一把)?|最慢(?:的)?(?:一把)?|标出|标注|两[把人]|两位|各自|并给|给出|官方|wca|主页|链接|并|个人资料/gi,'')
    .replace(/\b(?:all|five|attempts?|solves?|in order|competition order|excluded|discarded|fastest|slowest|mark|give|both|profiles?|official|links?|list|each|their|to)\b/gi,'')
    .replace(/只看|三阶|魔方|决赛|谁|拿了|获得|第四名|第4名|第三名|铜牌|他|她|和|与|的|平均|成绩|分别|是多少|是|多少|相差|差距|差|几秒|秒|请问|请|列出|及|两者|名次|3x3(?:x3)?/gi,'')
    .replace(/\b(?:in|the|final|who|was|finished|fourth|4th|third|bronze|medalist|and|what|were|their|average|averages|times|how|many|seconds|apart|difference|gap|between|them|is)\b/gi,'').replace(/[\s\p{P}]/gu,'');
  if (residual || /单手|盲|最佳单次|预赛|半决赛|资格|女子|男子|少年|仅限|分别列出每|one.hand|blind|semifinal|women|men's|junior|qualif/i.test(question)) return;
  return 'WC'+(match[1]??match[2]);
}

export function introductoryF2lDrill(question:string,lang:Lang):string|undefined {
  const q=question.normalize('NFKC').toLowerCase();
  if(!/f2l/.test(q) || !/练习|drill|exercise/.test(q) || !/10\s*分钟|十分钟|10[- ]minute/.test(q))return;
  const extra=q.replace(/什么是|cfop|里的|f2l|给|刚学完|层先法|的人|一个|不用计时|不计时|今天|花|10\s*分钟|十分钟|就能做的|练习|新手|入门|请|解释|适合|的|和|并/g,'')
    .replace(/\b(?:what|is|in|give|me|a|an|beginner|untimed|10|minute|exercise|drill|for|someone|who|just|learned|the|layer|by|method|today|and)\b/gi,'').replace(/[\s\p{P}]/gu,'');
  if(extra)return;
  return lang==='zh'
    ? "F2L 是 CFOP 的前两层阶段。做好底层十字后，把一个底角和对应的中层棱块配成一对，一起放进它们的槽。白红绿角配红绿棱，两块共有的红、绿对应两侧中心。\n\n今天用约 10 分钟，只练一对，不记还原时间。\n1. 拿一个已还原的三阶，白色朝下、绿色朝前、红色朝右，先找到右前槽里的白红绿角和红绿棱。\n2. 做 R U R′，观察这两块到了哪里。慢做逆序 R U′ R′ 把它们送回槽，每步都看着同一对块。\n3. 重复几次，然后停下来，先指出角、棱和目标槽，再尝试插入。成功标准是两层侧面都与中心对色，白色十字也完整。"
    : "F2L means First Two Layers. After the cross, pair a bottom corner with its matching middle-layer edge and insert them together. The white-red-green corner pairs with the red-green edge.\n\nSpend about ten minutes on one pair without timing solves. Start solved with white down, green in front and red on the right. Find the pair in the front-right slot. Do R U R′ to take it out, then slowly undo it with R U′ R′ while following both pieces. Repeat, pointing to both pieces and their slot before inserting. Check that both side colors match their centers and your cross is intact.";
}

type YearRow={wca_id:string;name:string;year:number;competitions:number};
const cachedYears=publicReadCache<YearRow[]>(60_000);

async function bestYears() {
  return withTransaction(async run=>{
    await run('SET TRANSACTION READ ONLY');
    await run("SET LOCAL statement_timeout='6s'");
    // Imported primary key (wca_id,comp_id) already counts each competition
    // exactly once, including DNF-only participation. Never rank round counts.
    return run<YearRow>(
      `WITH totals AS (
         SELECT s.wca_id, extract(year FROM c.start_date)::int AS year, count(*)::int AS competitions
         FROM wca_fs_person_comp_solves s JOIN wca_competitions c ON c.id=s.comp_id
         WHERE c.start_date IS NOT NULL GROUP BY s.wca_id, year
       ), best AS (
         SELECT DISTINCT ON (wca_id) * FROM totals ORDER BY wca_id, competitions DESC, year
       ), leaders AS (
         SELECT * FROM best ORDER BY competitions DESC, wca_id LIMIT 20
       )
       SELECT l.*, p.name FROM leaders l JOIN wca_persons p USING (wca_id)
       ORDER BY competitions DESC, wca_id`);
  });
}

export async function annualAnswer(lang:Lang,limit:number):Promise<ToolResult> {
  const leaders=await cachedYears(async()=>{
    const rows=await bestYears();
    if (!rows.length) throw new Error('Attendance data unavailable');
    return rows;
  });
  const rows=leaders.slice(0,limit);
  const title={zh:'单年参赛次数',en:'Competitions in one calendar year'}[lang];
  const columns={zh:['选手','年份','不同比赛数'],en:['Competitor','Year','Distinct competitions']}[lang];
  const basis={zh:'按比赛开始年份统计有正式成绩的不同比赛，包括仅有 DNF 的参赛记录。每人取最高的一年，同次数取较早年份。',en:'Distinct competitions with official results, including DNF-only participation, by start year. Each person appears once, with the earliest of their best years.'}[lang];
  return {evidence:{rows,basis},factualSummary:basis+' '+rows.map(r=>displayCuberName(r.name,lang==='zh')+' ('+r.year+'): '+r.competitions).join(', '),
    sources:rows.map(r=>({id:'person:'+r.wca_id,title:r.name,href:'/wca/persons/'+r.wca_id,read:true})),
    artifacts:[{kind:'table',title,columns,rows:rows.map(r=>[displayCuberName(r.name,lang==='zh'),String(r.year),String(r.competitions)]),links:rows.map(r=>'/wca/persons/'+r.wca_id)}]};
}
