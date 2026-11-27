import { describe, expect, it, vi } from 'vitest';
import { answerSiteQuestion, canReadPublicResult, requestedAssistantEvidence } from '../src/utils/site_assistant.js';
import { assistantNavigationRequest } from '../src/utils/site_assistant_navigation.js';
import { derivedGuideFact, guideEvidence, guideForQuestion, previousGuideTurns, rankedGuideContinuation, guideLookupRequested, readMultipartGuideReply, readGuideReply, publishedFactAnswer, publishedFactIntent } from '../src/utils/site_assistant_page_facts.js';
import { scrambleMinimumComparison, fewestMovesQuestion, fewestMovesVerdict, procedureQuestion, procedureVerdict, inspectionScenario, multiBlindTimeCount, multiBlindTimeVerdict } from '../src/utils/site_assistant_regulations.js';
import { distinctDatesExample } from '../src/utils/site_assistant_guide_dates.js';
import { frameRateComparison, recordTierExample, badgeCountScenario, guideScenarioCalculations, podiumScenario } from '../src/utils/site_assistant_guide_examples.js';
import { suppliedAverageAnswer } from '../src/utils/site_assistant_calculation.js';

describe('standalone site questions',()=>{
  it('carries a guide scenario into an elliptical follow-up, while navigation keeps its own route',()=>{
    const original='精度页固定版本的比较包含哪些误差？';
    const conversation=[{role:'user',content:original},{role:'assistant',content:'这里列的是软件模拟结果。'}];
    expect(previousGuideTurns('那“接近”是哪种结果？',conversation)).toEqual([original]);
    expect(previousGuideTurns('那帮我查一下比赛结果。',conversation)).toBeUndefined();
    expect(previousGuideTurns('如果我把那个链接打开呢？',conversation)).toBeUndefined();
  });
  it('retains consecutive changes but stops at an unrelated question',()=>{
    const setup='三阶拼画铺8行7列，需要多少魔方？';
    const revision='沿用行数，加3列后呢？';
    const history=[setup,revision].flatMap(content=>[{role:'user',content},{role:'assistant',content:'此前显示的结果'}]);
    expect(previousGuideTurns('把这个布局旋转90度呢？',history)).toEqual([setup,revision]);
    expect(previousGuideTurns('刚才那两个呢？',[...history,{role:'user',content:'介绍一下我的朋友'},{role:'assistant',content:'你好'}])).toBeUndefined();
    const page={href:'/mosaic-about',text:'原图像素再高也不能突破这个网格'};
    expect(guideScenarioCalculations([setup,revision,'把这个布局旋转90度呢？'],page)).toMatch(/10行×8列，共80颗；横宽24格、纵高30格/);
  });
  it('corrects an attempt by position before sorting and undoes that slot alone',()=>{
    const page={href:'/wca/about/wr_metric',text:'BAo5 至少 3 次有效。WPA worst 3'};
    const turns=['五次是7、7、10、13、16秒','第三把改成4秒。','最后一把是DNF。','只撤回第三把的改动。'];
    const state=JSON.parse(guideScenarioCalculations(turns,page)!);
    expect(state.attempts).toEqual([7,7,10,13,'DNF']);
    expect(state.previous.BAo5).toBe(6);
    expect(state.current.BAo5).toBe(8);
    expect(state.current.Mo5).toBeNull();
  });
  it('uses actual attempts as the denominator through reclassification and selective undo',()=>{
    const page={href:'/wca/about/dnf_rate_by_event',text:'NOT IN (-2, 0)'};
    const turns=['成功8把、DNF三把、DNS两把。','两把原标DNF其实成功了','一把之前的DNS动手后失败','撤销对DNS的更正'];
    expect(JSON.parse(guideScenarioCalculations(turns,page)!)).toMatchObject({attempts:11,dnf:1,percent:9.09});
    expect(guideScenarioCalculations([...turns,'五把原标DNF其实成功了'],page)).toBeUndefined();
  });
  it('unions actual calendar days, declining an unknown overlap or invalid date',()=>{
    const page={href:'/wca/about/most_distinct_dates_competed_on',text:'DISTINCT MM/DD HAVING attended_dates >= 100'};
    const setup='我已有97个不同月日，不含2月28、29和3月1。2020年2月28日到3月1日这场能加几个？';
    const next='再加一站2021年2月28日到3月1日。两站合起来覆盖哪几个新月日，总数多少？';
    expect(distinctDatesExample([setup,next],page)).toContain('97 + 3 = 100');
    expect(distinctDatesExample([setup,next.replace('3月1日','3月2日')],page)).toBeUndefined();
    expect(distinctDatesExample([setup,next.replace('2月28日','2月29日')],page)).toBeUndefined();
  });
  it('recomputes elapsed time using the current markers and the original rate for comparison',()=>{
    const turns=['恒定120fps，起点50帧，终点170帧。用时多少？','终点误标了，往前挪10帧，起点不动。现在呢？',
      '撤回对终点的移动；只改起点，变成第80帧。现在呢？','帧率改为180fps，标记不动。耗时与最初比少几秒？帧差呢？'];
    const page={href:'/frame-count-about',text:'固定帧率相邻帧间隔'};
    expect(frameRateComparison(turns,page)).toMatch(/帧差仍为 90.*本版少 0.5 秒/);
    expect(frameRateComparison([...turns.slice(0,-1),turns[3]+'可以导出音频吗？'],page)).toBeUndefined();
  });
  it('removes a transferred record from every qualifying tier',()=>{
    const page={href:'/wca/about/most_records_at_single_competition',text:'Continental 把所有 CR(含 WR；single + average 各 1 个'};
    const turns=['四条NR、两条洲际纪录、一条WR。分层计算？','把其中一条NR升级成WR，还是同一个成绩。现在呢？','刚才升级那条其实属于另一场，整条移走。原站各层分别多少条？'];
    expect(recordTierExample(turns,page)).toContain('World 1 条，Continental 3 条，National 6 条');
  });
  it('counts the revised podium once for each partner, then adds later appearances',()=>{
    const turns=['我有48次和同一个人一起上台，下一次跟另一位新搭档获奖。并肩登台怎么计？',
      '刚才那次其实两位搭档都在领奖台，我也在。这次怎么记？',
      '如果那次我自己第四，两位搭档仍是前三。以我为主体，两对的累计数分别回到多少？',
      '之后我和原搭档又一起登台3次，新搭档没上。我的两组次数和最高已达档次各是多少？'];
    const page={href:'/wca/achievements',text:'与同一选手共同登上项目领奖台至少 10／50／100／500 次。'};
    expect(podiumScenario(turns,page)).toMatch(/51 次，已达 50 次档.*0 次，尚未/);
    expect(podiumScenario([...turns,'我和两位搭档都换到另一个项目了。现在谁第一？'],page)).toBeUndefined();
  });
  it('counts completed multi-blind attempts independently of the number of puzzles',()=>{
    const page={href:'/wca/achievements',text:'正式比赛累计成功复原至少 10000／20000 次。DNF、DNS 不计；多盲每次尝试计一次。'};
    const q='万次复原我已有9988次。本场普通项目成功2次，还有一把多盲3次尝试里全对15个。现在累计多少，离门槛呢？';
    expect(badgeCountScenario([q],page)).toMatch(/9993 次.*还差 7 次/);
    expect(badgeCountScenario([q+'若改判失败呢？'],page)).toBeUndefined();
  });
  it('handles repeated times and per-value units without dropping both equal solves',()=>{
    const guide={href:'/wca/about/wr_metric',title:'指标',text:'mean(best 3 ...), mean(worst 3 ...)'};
    expect(derivedGuideFact('算指标榜前四把：11秒、12秒、12秒、16秒。BPA和WPA各舍哪个数，结果保留两位；两把12是不是都要舍？',guide)?.answer)
      .toMatch(/11.67.*13.33.*都保留/);
  });
  it('applies each source threshold independently even when the two outcomes swap',()=>{
    const clauses=[{id:'4b3b',text:'2x2: at least 4 moves to solve',href:'/regulation/full#4b3b'},
      {id:'4b3c',text:'Skewb: at least 7 moves to solve',href:'/regulation/full#4b3c'}];
    const page={href:'/regulation/full',text:'',title:'WCA',clauses,version:'test edition'};
    const query='官方打乱假设二阶、斜转都只需6步就可解。仅检查最短解下限，这两个状态都合格吗？';
    expect(scrambleMinimumComparison(query,page)?.answer).toMatch(/二阶.*6 步满足.*\n斜转.*6 步不满足/);
    expect(scrambleMinimumComparison(query.replace('6步','7步'),page)?.answer).toMatch(/斜转.*7 步满足/);
    expect(scrambleMinimumComparison(query,{...page,clauses:clauses.slice(1)})).toBeUndefined();
  });
  it('leaves the minimum unresolved when other ranks have only a lower bound',()=>{
    const guide={href:'/nemesizer-about',title:'宿敌',text:'每种成绩类型都严格领先，且最小排名差为 1。'};
    const q='刚才唯一并列的单次现在也领先了3名，其他项仍至少领先1名。严格宿敌和“仅差一点”现在各符合吗？';
    expect(rankedGuideContinuation(q,'其余排名全覆盖且领先',guide)?.answer).toMatch(/符合严格宿敌.*至少一项恰好领先1名才符合/);
    expect(rankedGuideContinuation(q,'还有三项没有排名',guide)).toBeUndefined();
  });
  it('requires a verified passage for each separate conclusion',()=>{
    const guide={href:'/example',title:'测试',text:'只有DNS不计。只有DNF计入。'};
    const item={answer:'后者计入。',quotes:['只有DNF计入']};
    const read=(items:unknown[])=>readMultipartGuideReply(JSON.stringify({items}),guide,2);
    expect(read([item])).toBeUndefined();
    expect(read([[item,item]])?.answer).toBe(read([item,item])?.answer);
    expect(read([[item,{answer:'未读资料。',quotes:['缺少这个引文']}]])).toBeUndefined();
    expect(read([item,{...item,quotes:['两者均不计入']}])).toBeUndefined();
    expect(read([{answer:'前者不计。',quotes:['只有DNS不计']},item])?.answer).toMatch(/1\. 前者不计。\n2\. 后者计入。/);
  });
  it('sorts the four supplied results independently of their order and defers extra constraints',()=>{
    const page={href:'/wca/about/wr_metric',title:'指标',text:'BPA = mean(best 3 of four); WPA = mean(worst 3 of four)'};
    const q='指标榜前4把为20、9、11、10秒，算一下WPA与BPA，各自去掉哪一把？';
    expect(derivedGuideFact(q,page)?.answer).toMatch(/舍掉.*20.*10.00.*舍掉.*9.*13.67/);
    expect(derivedGuideFact(q+'如果第一把是 DNF 呢？',page)).toBeUndefined();
    expect(derivedGuideFact(q,{...page,text:'已下架'})).toBeUndefined();
  });
  it('counts identical event failures and compares the alternative DNS separately',()=>{
    const guide={href:'/wca/achievements',title:'成就',text:'同一盲拧项目经历至少 10／20／40 次 DNF 后首次成功。DNS 不计。'};
    const q='破茧成功前在五盲DNF七次、五盲DNF三次，然后首次成功五盲，凑够十次吗？若第十次是四盲DNS呢？';
    expect(derivedGuideFact(q,guide)?.answer).toMatch(/10 次 DNF，够十次.*9 次 DNF，未达到/);
    expect(derivedGuideFact(q+'再算另一位选手呢？',guide)).toBeUndefined();
  });
  it('reads matching passages near the end of a long guide and leaves unmatched sources to the planner',()=>{
    const late='判断题无人回应时，先教完当前步骤。';
    const guide={href:'/teachers/live-guide',title:'直播卖课指南',text:'甲'.repeat(16000)+late};
    const evidence=guideEvidence('直播卖课指南：判断题无人回应怎么办？',guide);
    expect(evidence?.text).toContain(late);
    expect(evidence!.text.length).toBeLessThan(8000);
    expect(guideEvidence('怎么处理魔方掉块？',guide)).toBeUndefined();
    expect(guideForQuestion('数帧的 WebCodecs 解码管线输出什么？',[
      {...guide,lang:'zh',href:'/dev/algorithms/webcodecs'}, {...guide,lang:'zh',href:'/frame-count-about'}
    ])?.href).toBe('/dev/algorithms/webcodecs');
    expect(guideLookupRequested('哪些选手获得了完美多盲徽章？')).toBe(false);
    expect(guideLookupRequested('帮我打开直播卖课指南')).toBe(false);
  });
  it('keeps alternative-solve verification separate from a private submission on the same page',()=>{
    const q='复盘库里替代解重放成功，就能署名成选手现场用的那套吗？';
    const answer=publishedFactAnswer(publishedFactIntent(q)!,[{lang:'zh',href:'/recon-about',title:'复盘说明',
      text:'还原成功只能验证步骤一致，不能证明它就是视频中的实际动作。提交校验也不能代替对视频、成绩和出处的人工核对。'}]);
    expect(answer?.answer).toContain('人工核对');
    expect(answer?.answer).not.toContain('私享');
  });
  it('applies the same-event podium condition to the two actual events',()=>{
    const guide={href:'/wca/about/most_podiums_together',title:'共同登台',text:'同一场比赛、同一个项目的领奖台；决赛。'};
    const q='共同登台里同一站我只拿四阶铜牌，朋友只拿五阶银牌，会算我们一次共同登台吗？';
    expect(derivedGuideFact(q,guide)?.answer).toMatch(/^不算。.*四阶.*五阶/);
    expect(derivedGuideFact(q+'如果我们又同上二阶领奖台呢？',guide)).toBeUndefined();
    expect(derivedGuideFact(q,{...guide,text:''})).toBeUndefined();
  });
  it.each([
    ['想练三盲的棱块公式，直接带我去。','open','/alg/3bld/edge'],
    ['只想看 FTO 的转动记号说明，哪一页？','link','/alg/fto/notation'],
    ['想从录像里数帧计时，帮我打开工具。','open','/frame-count'],
    ['我和同学共用笔记本，带我去能两个人同时计时的页面。','open','/timer?players=2'],
    ['哪里可以按月份看比赛日历的统计？发链接就好。','link','/wca/comp/stats'],
  ])('resolves a registered destination for %s',(query,mode,href)=>{
    const reply=assistantNavigationRequest(query,[],'zh');
    expect(reply?.navigation).toBe(mode);
    expect(reply?.actions?.map(action=>action.href)).toEqual([href]);
  });
  it.each(['不要打开数帧工具，解释一下帧率','给我分析 FTO 的转动记号','如果打开双人计时器会怎样？'])('keeps an ordinary question in chat: %s',q=>{
    expect(assistantNavigationRequest(q,[],'zh')?.navigation).toBeUndefined();
  });
  it('keeps alternative destinations selectable and respects exclusions',()=>{
    const reply=assistantNavigationRequest('带我去数帧或计时器',[],'zh');
    expect(reply?.navigation).toBe('choose');
    expect(reply?.actions?.map(a=>a.href)).toEqual(expect.arrayContaining(['/frame-count','/timer']));
    expect(assistantNavigationRequest('打开不含数帧功能的编辑器',[],'zh')?.navigation).toBeUndefined();
  });
  it('requires the mosaic resolution paragraph, including for questions about facial detail',()=>{
    const intent=publishedFactIntent('照片有四千万像素，魔方墙只有十来列，是不是原图越高清就一定能保住所有五官？');
    expect(intent?.href).toBe('/mosaic-about');
    expect(publishedFactAnswer(intent!,[])).toBeUndefined();
  });
  it('reads FMC and multi-blind limits from the matching clauses',()=>{
    const html='<html><body><p id="H1b">fewer than 6 puzzles: time limit of 10 minutes times the number of puzzles, else the time limit is 60 minutes</p><p id="E2b">total time limit of 60 minutes to find and write a solution</p></body></html>';
    const url='https://www.worldcubeassociation.org/regulations/';
    expect(multiBlindTimeCount('多盲打算试 6 个魔方，最多能用多久？')).toBe(6);
    expect(multiBlindTimeVerdict(html,url,8,'zh')?.answer).toMatch(/8 个魔方的通常时限为 60 分钟/);
    expect(fewestMovesQuestion('FMC 一轮有多少分钟？')).toBe('time');
    expect(fewestMovesVerdict(html,url,'time','zh')?.answer).toContain('60 分钟');
    expect(fewestMovesVerdict(html,url,'inverse','zh')).toBeUndefined();
  });
  it('admits source-backed reads through the same gate as the worker',async()=>{
    const q='FMC 一轮有多少分钟？';
    expect(canReadPublicResult({question:q,history:[]})).toBe(true);
    const fetcher=vi.fn<typeof fetch>(async()=>new Response('<html><body><p id="E2b">total time limit of 60 minutes to find and write a solution</p></body></html>'));
    const reply=await answerSiteQuestion(q,'zh',null,new AbortController().signal,fetcher);
    expect(reply.answer).toContain('60 分钟');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('answers from the supplied public paragraph with a single read',async()=>{
    const href='/alg/sq1/parity-game';
    const fetcher=vi.fn<typeof fetch>(async url=>{
      expect(String(url)).toMatch(/\/assistant\/pages.json$/);
      return Response.json({pages:[{lang:'zh',href,title:'SQ1 奇偶游戏',text:'把未出现的颜色补在末尾，再判断相对 O-B-R-G 是奇排列还是偶排列。'}]});
    });
    const reply=await answerSiteQuestion('SQ1 奇偶游戏缺的颜色放哪，按什么顺序判？','zh',null,new AbortController().signal,fetcher);
    expect(reply.answer).toMatch(/末尾.*O-B-R-G/);
    expect(reply.sources).toEqual([expect.objectContaining({href,read:true})]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['H perm 和 T perm 哪个更常遇到，还要给我两套指法','CoLPI 可以删除别人的账号吗？','打乱留空时视频复盘怎么导出 PDF？'])('defers unsupported facets: %s',q=>{
    expect(publishedFactIntent(q)).toBeUndefined();
  });
  it('keeps inspection boundaries and unrelated incidents separate',()=>{
    expect(inspectionScenario('比赛观察 17.1 秒才开始还原，算加二吗？')).toEqual({kind:'standard',times:[17.1]});
    expect(inspectionScenario('观察用了 18.2 秒才启动 Stackmat，还能记作加二吗？')).toEqual({kind:'standard',times:[18.2]});
    expect(inspectionScenario('观察用了 18.2 秒才启动 Stackmat，还能记作加二吗？如果计时器故障呢？')).toBeUndefined();
  });
  it('separates an exact trimmed mean from its rounded display',()=>{
    const q=(target:number)=>'目标五把平均 '+target+' 秒，前四把 15、8、10、9，最后一把最慢能多少？按 Ao5。';
    expect(suppliedAverageAnswer(q(10),'zh')).toMatch(/11\.00 秒.*11\.01 秒/);
    expect(suppliedAverageAnswer(q(8),'zh')).toContain('无法达到');
    expect(suppliedAverageAnswer(q(10)+'如果第一个是 DNF 呢？','zh')).toBeUndefined();
  });
});

describe('published guide evidence',()=>{
  const mosaic={href:'/mosaic-about',title:'拼画',text:'用三阶拼 20 列 × 30 行，画面由 60 × 90 个色块组成。'};
  it('checks the proposed dimensions as well as the cube count',()=>{
    const correct='五阶摆 4 列、6 行的拼画，我的画布是 20×30 个色块吗，要准备几个魔方？';
    const wrong=correct.replace('20×30','30×20');
    expect(derivedGuideFact(correct,mosaic)?.answer).toMatch(/^是。.*24 个魔方.*20 列 × 30 行/);
    expect(derivedGuideFact(wrong,mosaic)?.answer).toMatch(/^不是。.*24 个魔方/);
    expect(derivedGuideFact(correct+'中间要留白怎么办？',mosaic)).toBeUndefined();
  });
  it('computes multi-blind scores only for consistent complete counts and verified rules',()=>{
    const query=(missed:number)=>'多盲报 6 个，成功 3 个，失败 '+missed+' 个，净分多少？';
    const score=procedureQuestion(query(3));
    expect(score).toEqual({solved:3,missed:3});
    expect(procedureQuestion(query(2))).toBeUndefined();
    const url='https://www.worldcubeassociation.org/regulations/';
    expect(procedureVerdict('',url,score!)).toBeUndefined();
    const html='<html><body><p id="9f12c">number of puzzles solved minus the number of puzzles not solved; if the difference is less than 0, or if only 1 puzzle is solved, DNF</p></body></html>';
    expect(procedureVerdict(html,url,score!)?.answer).toContain('净得分为 0 分');
    expect(procedureVerdict(html,url,{solved:1,missed:1})?.answer).toContain('DNF');
    expect(canReadPublicResult({question:query(3),history:[]})).toBe(true);
  });
  it('distinguishes seeing the puzzle before and after the first move',()=>{
    expect(procedureQuestion('三阶盲拧还没转第一步，可以摘下眼罩再看吗？')).toBe('beforeFirstMove');
    expect(procedureQuestion('三盲已经转过一步，此时能揭开眼罩看一眼吗？')).toBe('afterFirstMove');
    expect(procedureQuestion('三盲已经转过一步，裁判揭开眼罩让我看一眼怎么办？')).toBeUndefined();
  });
  it('counts only performances strictly ahead of the best other competitor',()=>{
    const guide={href:'/wca/about/wr_dominance',title:'屠榜',text:'严格快于所有其他选手的最佳成绩'};
    const question='榜首选手的三把是 6.30、6.40、6.40，他人最快 6.40。按屠榜口径算几条？';
    expect(derivedGuideFact(question,guide)?.answer).toMatch(/^算 1 条/);
    expect(derivedGuideFact(question.replace('6.30','6.40'),guide)?.answer).toMatch(/^算 0 条/);
    expect(derivedGuideFact(question+'如果是别的项目呢？',guide)).toBeUndefined();
  });
  it('uses the sampling guide for a ZBLL case question and preserves maintenance queries',()=>{
    const q='ZBLL 统计的 csTimer 风格每个 case 跑几条？如果生成失败会回填吗？';
    expect(requestedAssistantEvidence(q)).not.toBe('statistics_metadata');
    expect(requestedAssistantEvidence('ZBLL 题库最近一次全量生成是否成功？')).toBe('statistics_metadata');
    expect(publishedFactAnswer(publishedFactIntent(q)!,[])).toBeUndefined();
  });
  it('includes the threshold and every day of a multi-day competition',()=>{
    const guide={href:'/wca/about/most_distinct_dates_competed_on',title:'日期',text:'至少 100 个不同日期，把多日比赛展开成每一天'};
    const query=(n:number)=>'最多不同参赛日期的榜若我覆盖了 '+n+' 个不同月日可以上榜吗？跨周末的比赛只算开赛日吗？';
    expect(derivedGuideFact(query(99),guide)?.answer).toContain('未达到');
    expect(derivedGuideFact(query(100),guide)?.answer).toContain('100 个不同月日达到');
    expect(derivedGuideFact(query(100)+'另外，谁在榜首？',guide)).toBeUndefined();
  });
  it('keeps unrelated events and extra incidents out of a single-clause ruling',()=>{
    expect(procedureQuestion('四阶一对一赛制能在决赛举办吗？')).toBe('fourHeadToHead');
    expect(procedureQuestion('四阶盲拧一对一赛制能在决赛举办吗？')).toBeUndefined();
    expect(procedureQuestion('四阶一对一赛制能在决赛举办吗？如果一名选手弃权怎么办？')).toBeUndefined();
  });
  it('checks whether the two requested face turns commute before approving a pre-turn',()=>{
    const guide={href:'/scramble/batch-solver',title:'批量求解',text:'多个必须两两可交换，且每个步组都得包含它。'};
    const q='批量求解器的整层预转设为 F 和 B，可以一起用吗？每个步组有什么要求？';
    expect(derivedGuideFact(q,guide)?.answer).toMatch(/对面.*符合.*每个步组/);
    expect(derivedGuideFact(q.replace('F 和 B','F 和 L'),guide)?.answer).toMatch(/相邻面.*不符合.*每个步组/);
    expect(derivedGuideFact(q.replace('F 和 B','F 和 L 和 U'),guide)).toBeUndefined();
    expect(derivedGuideFact(q,{...guide,text:''})).toBeUndefined();
  });
  it('reads both prediction panels for the same year and respects edition qualifiers',()=>{
    const guide={href:'/wca/prediction/333',title:'三阶预测',text:'WR 单次预测20302.20 s\n20402.05 s\nWR Ao5 预测20302.95 s\n20402.75 s\n物理参考 数据 2026-05'};
    const q='三阶预测文按 2026 年 5 月快照给出的 2040 单次和平均点估计相差多少？';
    expect(derivedGuideFact(q,guide)?.answer).toContain('0.70 秒');
    expect(derivedGuideFact(q.replace('5 月','7 月'),guide)).toBeUndefined();
    expect(derivedGuideFact(q.replace('2040','2041'),guide)).toBeUndefined();
  });
  it('derives the change in Ao5 even when a replacement enters the middle three',()=>{
    const question=(t:number)=>'练习成绩 9、10、11、12、13，如果只把最慢的改成 '+t+' 秒，Ao5 会不会变，还是几秒？';
    expect(suppliedAverageAnswer(question(20),'zh')).toMatch(/^不会变。.*11.00 秒.*11.00 秒/);
    expect(suppliedAverageAnswer(question(8),'zh')).toMatch(/^会变。.*11.00 秒.*10.00 秒/);
    expect(suppliedAverageAnswer(question(20)+'再查我的官方成绩','zh')).toBeUndefined();
  });
  it('lets glossary, very short and navigation requests reach their existing handlers',()=>{
    for(const q of ['请从站内词典查证并说明这个词是什么？','怎么数帧？','帮我打开魔方拼画'])expect(guideLookupRequested(q)).toBe(false);
  });
  it('requires the attributed passage to exist in the selected document',()=>{
    expect(readGuideReply(JSON.stringify({answer:'分辨率取决于网格。',quotes:['60 × 90 个色块']}),mosaic)?.sources[0].href).toBe(mosaic.href);
    expect(readGuideReply(JSON.stringify({answer:'可导出视频。',quotes:['可以导出视频']}),mosaic)).toBeUndefined();
    expect(readGuideReply('LOOKUP',mosaic)).toBeUndefined();
  });
});

it('keeps a supplied frequency table through corrections but releases an explicit world ranking lookup', () => {
  const setup='最常出现的成绩：四阶14.22有三次、13.89有两次。限定四阶告诉我频次。';
  const history=[{role:'user',content:setup},{role:'assistant',content:'14.22 最多。'}];
  expect(previousGuideTurns('沿用四阶，一把14.22改为13.89，现在谁最多？',history)).toEqual([setup]);
  expect(previousGuideTurns('现在帮我查全球排名前三的选手。',history)).toBeUndefined();
});
