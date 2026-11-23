import { parseHTML } from 'linkedom';
import { assistantDeadline } from './site_assistant_diagnostics.js';
import { publicReadCache } from './site_assistant_public_queries.js';
import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { GAN_TEAM_FILTER } from '@cuberoot/shared/wca-team-filters';
import type { AssistantAnswer, AssistantMessage } from '@cuberoot/shared/site-assistant';
import { asksToLocatePair, assistantObservationOnlyPlan, assistantPlanPieceFacts, assistantPlanShape, assistantPlanTimeBounds } from './site_assistant_plan.js';

type Lang = 'zh'|'en';

/** A stand-alone recognition question about one corner. Extra clauses, including
 * requests for an insertion or a drill, still go to the general assistant. */
export function pairColourMatch(question:string,lang:Lang) {
  if (!/F2L|前两层/i.test(question)) return;
  const corner=/([白黄红橙蓝绿]{3})角(?:块)?/g;
  const corners=[...question.matchAll(corner)];
  if (corners.length!==1) return;
  const colours=[...corners[0][1]];
  if (new Set(colours).size!==3) return;
  const cross=question.match(/([白黄红橙蓝绿])(?:色)?(?:底|十字)/)?.[1] ?? '白';
  if (!colours.includes(cross)) return;
  const sides=colours.filter(c=>c!==cross);
  const edge=sides.join('');
  const distractor=question.match(/排除([白黄红橙蓝绿]{2})棱/)?.[1];
  const wrong=distractor && [...distractor].find(c=>!sides.includes(c));
  if (distractor && !wrong) return;
  const phrases=question.replace(corner,'').replace(/([白黄红橙蓝绿])(?:色)?(?:底|十字)/g,'')
    .replace(/(?:我(?:刚学|在学)|三阶|F2L|前两层|常把棱找错|用|做例子|为例|该找哪条棱|该配哪条棱|它应该对准哪两个中心|对准哪两个中心|如何一眼排除[白黄红橙蓝绿]{2}棱|不要给(?:我)?公式|只讲辨认|请)/gi,'')
    .replace(/[\s\p{P}]/gu,'');
  const complete=!phrases && /哪条棱|哪两个中心/.test(question);
  if (lang==='zh') {
    const reject=wrong?distractor+'棱含'+wrong+'色，缺少'+sides.find(c=>!distractor!.includes(c))+'色，可以直接排除。':'';
    const answer='以'+cross+'色做底层十字，'+corners[0][0]+'去掉'+cross+'色后剩下'+sides.join('和')+'，所以找'+edge+'棱。归位后，'+sides.map(c=>c+'色贴纸对准'+c+'色中心').join('，')+'。'+reject;
    return {answer,complete};
  }
  const names:Record<string,string>={白:'white',黄:'yellow',红:'red',橙:'orange',蓝:'blue',绿:'green'};
  const answer='With a '+names[cross]+' cross, set aside the '+names[cross]+' sticker on the corner. Look for the '+sides.map(c=>names[c]).join('–')+' edge. In its slot, '+sides.map(c=>'the '+names[c]+' sticker faces the '+names[c]+' center').join(' and ')+'.'+(wrong?' Exclude the '+[...distractor!].map(c=>names[c]).join('–')+' edge because it contains '+names[wrong]+'.':'');
  return {answer,complete};
}

export function pairFindingDrill(question: string, history: AssistantMessage[], lang: Lang, sentences?: number): string|undefined {
  const previous = history.filter(m => m.role === 'user').at(-1)?.content ?? '';
  const revised = /第二项|第\s*2\s*项|第二个练习|second (?:exercise|drill|activity)/i.test(question);
  const topic = revised ? previous+'\n'+question : question;
  if (!/F2L|前两层|first two layers/i.test(topic) || !asksToLocatePair(question) ||
      !/练习|训练|只练|\b(?:drills?|exercises?|practi[cs]e)\b/i.test(question)) return;
  const oncePattern = /每(?:一)?项(?:只(?:能|允许|可)?)?(?:尝试|试|做)?[一1]次|(?:each (?:exercise|drill) (?:only )?once|one (?:attempt|try) (?:per|each)|only (?:one|1) (?:attempt|try) each)/i;
  const once = oncePattern.test(topic);
  if (/只(?:能)?看[到见]|被挡|遮住|(?:禁止|不许|不能|不要|不可)转体|每项.{0,6}[一二三四五六七八九十0-9]+次|每组.{0,6}次|(?:白|黄|绿|蓝|红|橙)(?:色)?底|(?:white|yellow|red|orange|blue|green) cross|repetitions per|reps each|\b(?:hidden|occluded|no rotations?|no regrips?)\b|贴纸颜色是|计时器计时|子步骤|表格|每项.{0,5}理由|substeps?|table|paragraph|段落|词数/i.test(topic.replace(oncePattern,'')) ||
      assistantPlanPieceFacts(topic) || assistantObservationOnlyPlan(question, revised ? previous : '')) return;
  const shape = assistantPlanShape(question);
  if (shape?.englishWords || shape?.substepsPerActivity || shape?.activitySecondsMaximum || shape?.stepSecondsMaximum) return;
  const check = once ? (lang==='zh'?'核对两块的配色，本项只试一次，找错或找不到也停。':'Check the colours once, then stop even if you miss.') : {zh:'用两指同时指出角和棱，核对角上除底色外的两色是否与棱的两色完全相同，连续找对两对即停。',en:'Point at both pieces, check that the two non-cross colours on the corner exactly match the edge, and stop after two correct pairs in a row.'}[lang];
  const eyesOpen = /(?:禁止|不许|不能|不要|不)闭眼|眼睛.{0,6}睁开|keep.{0,12}eyes open|without closing/i.test(topic);
  const second = eyesOpen ? {zh:'换一个含底色的角，睁眼慢慢转体，找到与角上另外两色匹配的棱并说出两块的位置。',en:'Choose a new cross-colour corner and rotate the cube with your eyes open until you can point out the matching edge and name both locations.'}[lang] : {zh:'换一个含底色的角，先按另外两色找到配对棱，再闭眼说出两块的位置，睁眼转体复核。',en:'Choose another cross-colour corner, locate its edge by the other two colours, then close your eyes and name both locations before rotating the cube to check.'}[lang];
  if (revised && (!sentences || sentences === 2) && /改|调整|换|revise|change|replace|rewrite/i.test(question)) return second+(lang==='zh'?'':' ')+check;
  if (sentences || (shape?.activities && shape.activities !== 2) || !/无计时器|(?:没(?:有)?|不用|不看)计时器|without (?:a |my )?timer|no timer/i.test(question)) return;
  const seconds = assistantPlanTimeBounds(question).total;
  const budget = seconds && seconds%60 === 0 ? {zh:'总共最多 '+seconds/60+' 分钟，有时间就做下一项，到点随时停；用次数判断是否完成。',en:'Allow at most '+seconds/60+' minutes overall. Use repetitions as the stopping points and stop early if your time is up.'}[lang] : '';
  if (once) {
    const stop = lang==='zh'?'各做一次，核对后即停；找错或找不到也结束该项。':'Try each exercise once. Stop after the check even if you miss or cannot find the piece.';
    const drills=lang==='zh'?[
      '选一个含底色的角，说出另外两色。扫视各层，包括中层已经占用的槽，指出同时带这两色的棱。',
      '反过来，先选一条既不含底色也不含顶色的棱，再找同时带底色和这两色的角。并排指认两块，核对三个颜色。',
    ]:[
      'Choose a cross-colour corner and name its other two colours. Scan every layer, including occupied middle slots, for the edge with exactly those colours.',
      'Start with an edge that has neither the cross nor the opposite colour. Find the corner with the cross colour and both edge colours. Point at both pieces and check the colours.',
    ];
    return [budget,stop,...drills.map((drill,i)=>(i+1)+'. '+drill)].filter(Boolean).join('\n\n');
  }
  const first = {zh:'选定底色，找一个含该色的角。转动整颗魔方看清另外两色，再找恰有这两色的棱；两指同时指对两块算一次，换角成功两次即停。',
    en:'Choose your cross colour and a corner containing it. Rotate the whole cube to see its other two colours, then find the edge with exactly those colours. Point to both pieces and stop after two correct matches using different corners.'}[lang];
  return [budget,'1. '+first,'2. '+second+(lang==='zh'?'':' ')+check].filter(Boolean).join('\n\n');
}

export function reductionParityGuide(question: string, lang: Lang): AssistantAnswer|undefined {
  if (!/(?:四|4)阶|4\s*[×x]\s*4/i.test(question) || !/降阶|配.{0,3}棱|reduction|paired|parity|奇偶/i.test(question) ||
      !/单.{0,3}翻|翻.{0,5}(?:一|1|棱)|两.{0,4}棱.{0,4}(?:换|交换)|OLL\s*parity|PLL\s*parity|flipped edge|edge.{0,12}(?:flipped|swap)/i.test(question)) return;
  // An algorithm opt-out still permits a diagnostic explanation.
  const scope = question.replace(/(?:不要|不用|无需|不需要)(?:给|写|贴)?(?:长)?公式|(?:no|without) (?:long )?algorithms?/gi,'');
  const wantsMoves = /公式|算法|手顺|转法|步骤|怎样拧|怎么拧|如何操作|\b(?:algorithms?|moves?|sequence|notation|how to (?:fix|solve|execute))\b/i.test(scope);
  if (wantsMoves && /OLL\s*parity|单.{0,2}翻|flipped edge/i.test(scope) &&
      !/PLL|互换|交换|尚未配|未配|没(?:有)?配好|概率|推导|最短|其他公式|(?:不要|不用|禁止|不能|不含).{0,4}(?:宽转|转体)|inner.only|rotation.free|swap|unpaired|derive|shortest|without (?:wide|rotations)|no rotations/i.test(scope)) {
    const source={id:'alg:4x4:oll-parity',title:lang==='zh'?'四阶 OLL parity 公式库':'4×4 OLL parity algorithms',href:'/alg/4x4/oll-parity',read:false};
    const alg="Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'";
    const answer=lang==='zh'?[
      '先确认中心已还原、12 组棱已配好。末层朝上，把要翻的组合棱放在上前方（UF）。',
      alg,
      'Rw 是从右面看，将右侧两层一起顺时针转 90°。撇号表示逆时针，2 表示半转。Lw 同理，从左面看；x 是沿 R 的方向转动整个魔方，之后按新朝向继续。完成后重新识别普通三阶末层。',
    ]:[
      'With centres solved and all 12 edges paired, hold the last layer up and the flipped pair at up-front (UF).',
      alg,
      'Rw turns the two right layers together clockwise as seen from the right. A prime reverses the turn and 2 means a half turn. Read Lw from the left. For x rotate the whole cube like R, then continue in the new grip. Recheck the last layer before proceeding as on a 3×3.',
    ];
    return {answer:answer.join('\n\n')+' [['+source.id+']]',sources:[source]};
  }
  if (wantsMoves || /没(?:有)?配好|尚未配|未配|计数|概率|\b(?:algorithm|moves?|unpaired|probability|odds)\b/i.test(scope)) return;
  const source = {id:'guide:4x4-reduction',title:{zh:'J Perm 四阶降阶教程',en:'J Perm’s 4×4 reduction tutorial'}[lang],href:'https://jperm.net/4x4',read:false};
  const answer = {zh:'中心、12 组棱和前两层都已完成时，顶面看起来只有一条组合棱翻转是合理的。\n\n先数四条顶层组合棱：顶色朝上的有 1 或 3 条，就是 OLL 奇偶。若有 0、2 或 4 条，翻棱数为偶数；顶面还花也可能只是普通 OLL。\n\n再查位置：完成顶面定向，把角归位并与侧面中心对齐。如果只剩两组棱互换，就是 PLL 奇偶。两种情况可以同时出现，先查朝向，再查位置。\n\n三阶通过合法转动只能翻转偶数条棱，角、棱排列的奇偶性也必须一致。四阶的一组棱由两个翼棱组成，配对后把它们看成一条，才会出现三阶无法达到的外观。',
    en:'With centres solved, all 12 edges paired and the first two layers complete, one apparently flipped paired edge is possible.\n\nCount the four top edges showing the top colour: one or three means OLL parity. Zero, two or four is even, so an unfinished top can still be ordinary OLL.\n\nAfter orienting the top, solve its corners and align them with the side centres. If exactly two edge pairs still need to exchange places, that is PLL parity. Both can occur in one solve.\n\nLegal 3×3 moves preserve even edge-flip parity and matching corner/edge permutation parity. Each reduced 4×4 edge contains two separate wings. Treating them as one piece can produce a state unreachable on a 3×3.'}[lang];
  return {answer:answer+' [['+source.id+']]',sources:[source]};
}

export const clubDirectoryUrl = 'https://speedcubing.app/clubs/directory';
type Club = {href:string; name:string; aliases:string[]};
const cachedClubs = publicReadCache<Club[]>(300_000);

function listedClubs(html:string):Club[] {
  const {document}=parseHTML(html);
  return [...document.querySelectorAll('a[href^="/clubs/"]')].flatMap(a=>{
    const path=a.getAttribute('href')!;
    const name=a.textContent?.trim().match(/^(.+?) cubing club\b/i)?.[1];
    if(!name || name.length>100 || !/^\/clubs\/[a-z0-9-]+$/.test(path))return [];
    const aliases=name.split(/[()]/).map(s=>s.trim().toLowerCase()).filter(s=>s.length>=2);
    return [{href:new URL(path,clubDirectoryUrl).href,name,aliases}];
  });
}

export async function clubDirectoryAnswer(question: string, lang: Lang, loadHtml:()=>Promise<string>, signal:AbortSignal, shared=false):Promise<AssistantAnswer|undefined> {
  if (!/俱乐部|战队|魔友|魔方社|cubing club|cube club|team directory|teams page/i.test(question) ||
      !/入口|目录|浏览|线下|城市|本地|附近|哪里|\b(?:find|directory|browse|city|local|meet|nearby)\b/i.test(question) ||
      /我(?:的|加入了)|队员名单|胜率|谁|排名|比赛成绩|收费|多少钱|会费|报名|申请|怎么加入|具体地址|营业时间|\b(?:my team|roster|rankings?|won)\b/i.test(question)) return;
  const site = {id:'page:wca-teams',href:'/wca/teams',title:{zh:'CubeRoot 战队目录',en:'CubeRoot team directory'}[lang]};
  const regional = {id:'directory:cubing-clubs',href:'https://speedcubing.app/clubs/directory',title:{zh:'地区俱乐部目录（Speedcubing.app）',en:'Regional club directory (Speedcubing.app)'}[lang]};
  const byCity = /俱乐部|线下|魔友|城市|附近|本地|\b(?:clubs?|city|local|meet|nearby)\b/i.test(question);
  const external = byCity && !/仅限本站|不要外链|只(?:给|要)本站|no external|only (?:this site|cuberoot)/i.test(question);
  let matches:Club[]=[];
  if (external) {
    const load = async()=>{
      const clubs=listedClubs(await loadHtml());
      if (!clubs.length) throw new Error('Club directory contains no entries');
      return clubs;
    };
    try {
      const clubs=await assistantDeadline(()=>shared?cachedClubs(load):load(),signal);
      const q=question.toLowerCase().normalize('NFKC');
      const words=' '+q.replace(/[^\p{L}\p{N} -]/gu,' ')+' ';
      const hits=clubs.flatMap(club=>{
        const positions=club.aliases.map(alias=>/\p{Script=Han}/u.test(alias)?q.indexOf(alias):words.indexOf(' '+alias+' ')).filter(i=>i>=0);
        return positions.length?[{club,at:Math.min(...positions)}]:[];
      }).sort((a,b)=>a.at-b.at);
      matches=[...new Map(hits.map(({club})=>[club.href,club])).values()];
    } catch { signal.throwIfAborted(); }
    signal.throwIfAborted();
  }
  const citySource=(club:Club)=>({...regional,id:'club:'+club.href.split('/').at(-1),href:club.href,title:club.name+' (Speedcubing.app)'});
  if (matches.length>1) {
    const actions=matches.map(citySource);
    return {answer:actions.map((source,i)=>matches[i].name+' [['+source.id+']]').join('\n'),actions,sources:actions.map(source=>({...source,read:false}))};
  }
  const [match]=matches;
  const city = match ? citySource(match) : regional;
  let answer = {zh:'打开「战队」，选择厂商及旗下战队，可按姓名或 WCA ID 查成员。该页没有城市筛选。',en:'Open Teams, choose a brand and its team, or search the members by name or WCA ID. This page has no city filter.'}[lang]+' [['+site.id+']]';
  if (external) answer += ' '+({zh:match?'外部俱乐部目录有 '+match.name+' 条目，可直接打开。':'找当地魔友可打开外部俱乐部目录，按国家或地区浏览，再用页面搜索查城市。',en:match?'Open the '+match.name+' entry in the external club directory.':'For local cubers, browse the external directory by country or region and search the page for your city.'}[lang])+' [['+city.id+']] '+{zh:'条目可用于找同地区玩家，线下聚会时间和地点需另行确认。',en:'A directory entry can help you find local cubers. Confirm a meetup time and place separately.'}[lang];
  const actions = external ? [site,city] : [site];
  return {answer,actions,sources:actions.map(s=>({...s,read:false}))};
}

/** Only unqualified roster questions; rankings, dates and subteams have other scopes. */
export async function brandRosterAnswer(question:string, lang:Lang, read:(url:string)=>Promise<unknown>, signal:AbortSignal):Promise<AssistantAnswer|undefined> {
  const roster = /^(?:请问|请列出|请|目前|现在)?\s*(GAN|魔域|MoYu)\s*(?:旗下|战队|队|目前|现在|的)*\s*(?:队员|选手|成员)?(?:有哪些|有谁|都有谁|都有哪些|有哪些人|名单)(?:队员|选手|成员)?[？?。!\s]*$|^(?:who (?:is|are) (?:on|in)|list (?:the )?members of) (?:team )?(GAN|MoYu)(?:'s)?(?: (?:team|roster))?[?.!\s]*$/i.exec(question.trim());
  if (!roster) return;
  const brand = (roster[1] ?? roster[2]).toLowerCase() === 'gan' ? 'GAN' : 'MoYu';
  const filter = brand === 'GAN' ? GAN_TEAM_FILTER : 'moyu';
  const href = '/wca/teams'+(brand==='GAN'?'?team='+GAN_TEAM_FILTER:'');
  const source = {id:'roster:'+filter,href,title:{zh:brand+' 战队名单',en:brand+' roster'}[lang]};
  try {
    const directory = await read('https://api.cuberoot.me/v1/wca/teams?directory=1&team='+filter+'&page=1&size=50&v=5') as {members?:{name:string}[];total?:number};
    if (!Array.isArray(directory?.members) || !Number.isSafeInteger(directory.total) || !directory.members.every(m=>typeof m?.name==='string')) throw new Error('Incomplete roster');
    const names = directory.members.map(m=>displayCuberName(m.name,lang==='zh')).join(lang==='zh'?'、':', ');
    const answer = {zh:brand+' 厂商旗下已登记 '+directory.total+' 人，本页列出 '+directory.members.length+' 人。',en:brand+' has '+directory.total+' registered members across its teams. This page lists '+directory.members.length+'.'}[lang];
    return {answer:answer+' '+names+' [['+source.id+']]',sources:[{...source,read:true}],actions:[source]};
  } catch {
    signal.throwIfAborted();
    return {answer:{zh:'当前未能读取成员名单。可打开战队目录，展开 '+brand+'，选择旗下战队查看成员。',en:'The roster could not be read. Open Teams, expand '+brand+' and select a team to see its members.'}[lang]+' [['+source.id+']]',sources:[{...source,read:false}],actions:[source]};
  }
}
