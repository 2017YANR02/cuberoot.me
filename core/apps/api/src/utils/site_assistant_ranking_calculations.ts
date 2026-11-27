import { COUNTRY_ZH } from '@cuberoot/shared/country-name';
import { ISO2_TO_CONTINENT, CONTINENT_NAMES } from '@cuberoot/shared/continent';
import { roundEventMentions } from './site_assistant_event_scope.js';
import { rankingQuantity } from './site_assistant_ranking_rows.js';

// Evaluate only the parts of the published methodology that are arithmetic or
// logical predicates. Bounds also prevent interpreting unrelated numbers as inputs.
export function rankingCalculation(id:string, question:string, article:string):string|undefined {
  const q=question.normalize('NFKC');
  if (/再(?:帮|查|列)|以及谁|顺便|另外(?:再|帮我|找|给|查|列|算|解释)|举例|代码|翻译|名单|今年榜首|解释原因/.test(q)) return;
  const count='(\\d+|[一二两三四五六七八九十]{1,3})';
  // Use the numeric inputs only where the wording identifies their units.
  if(id==='most_visited_continents' && article.includes('DISTINCT') && /参赛大洲数/.test(q)) {
    const trip=q.match(/^去([^，,？?]+)各比一站[,，]参赛大洲数(?:增加|覆盖)几个不同的大洲[？?]?$/);
    if(trip) {
      const countries=trip[1].split(/[、和与]/);
      const continents=countries.map(country=>{
        const entry=Object.entries(COUNTRY_ZH).find(([,label])=>label===country);
        return entry && ISO2_TO_CONTINENT[entry[0]];
      });
      if(countries.length>0 && continents.every(c=>c!==undefined)) {
        const names=[...new Set(continents.map(c=>CONTINENT_NAMES[c!].zh))];
        return '这些比赛覆盖 '+names.length+' 个不同大洲（'+names.join('、')+'）。生涯参赛大洲数只增加此前未去过的洲。';
      }
    }
  }
  if(id==='sum-of-ranks' && article.includes('越小')) {
    const pair=q.match(/^名次(?:总和|之和)一人\s*(\d{1,8})\s*另一人\s*(\d{1,8})[,，]比较范围完全一样[,，]谁在前面[？?]?$/);
    if(pair) {
      const a=Number(pair[1]),b=Number(pair[2]);
      if(a>0 && b>0)return (a===b?'两人的名次总和相同。':'总和 '+Math.min(a,b)+' 的选手排在前面。')+'同一统计范围和成绩类型下，把各项目的排名相加，数值越小越靠前。';
    }
  }
  if(id==='dnf_rate_by_event' && article.includes('value') && !/没(?:有)?出手|全是空槽|没有实际/.test(q)) {
    const total=q.match(new RegExp(count+'\\s*(?:次|个|把)\\s*(?:实际(?:出手|尝试)|真的动手)'));
    const failed=q.match(new RegExp(count+'\\s*(?:个|次|把)?\\s*(?:DNF|失败)','i'));
    if(total && failed && !/(?:另外|此外|还有)[^，。？]{0,12}(?:成功|还原|实际尝试|完成)/.test(q)) {
      const n=rankingQuantity(total[1]),d=rankingQuantity(failed[1]);
      if(n>0 && d>=0 && d<=n)return '分子是 '+d+' 次 DNF，分母是 '+n+' 次实际尝试。DNF 率为 '+d+'/'+n+' = '+Number((100*d/n).toFixed(2))+'%。DNS 和空槽不计入分母。';
    }
  }
  if(id==='dnf_rate_by_event' && article.includes('value') && !/多盲|若再|如果再|另外.*实际尝试/.test(q)) {
    const total=q.match(new RegExp(count+'\\s*(?:把|次|个)\\s*(?:实际尝试|真的动手|真正出手|实际出手)\\s*(?:全|都)(?:部)?成功'));
    if(total && rankingQuantity(total[1])>0 && !/(?:[1-9一二两三四五六七八九十])\s*(?:个|把|次)?\s*(?:DNF|失败)/i.test(q))
      return 'DNF 率是 0%。'+rankingQuantity(total[1])+' 次实际尝试全部成功，因此分子为 0，分母为 '+rankingQuantity(total[1])+'。DNS 与空槽均不计入。';
    if(/没有(?:人|实际)?(?:出手|尝试)|没一个人出手|没人出手|全(?:是|为).*DNS|只有[^，。？]{0,20}DNS/i.test(q) &&
        !/成功|另有|还有.{0,5}(?:失败|实际)|[1-9一二三四五六七八九十]\s*(?:次|个|把)\s*DNF/i.test(q))
      return '无法计算这个样本的 DNF 率。DNS 和空槽都没有实际出手，分母为 0，不能把 0/0 填成 0%。';
  }
  if(id==='wr_dominance' && /严格|bisectLeft/.test(article) && !/罚|DNF|分钟|毫秒|并列第一|如果改/.test(q)) {
    const threshold=q.match(/(?:(?:其他人|别人|对手)(?:的)?(?:最好|最佳|最快)(?:成绩)?|(?:屠榜)?(?:门槛|比较线))(?:是|为)?\s*(\d+(?:\.\d+)?)(?:\s*秒|(?=[,，、]))/);
    const list=q.match(/我(?:有|交过|做出|做了|的成绩是|的成绩为)\s*((?:\d+(?:\.\d+)?\s*秒?\s*[,、和与]\s*)+\d+(?:\.\d+)?)(?![\d.])/);
    if(threshold && list && !/[、,和与]\s*[-+\d]|到|至/.test(q.slice((list.index??0)+list[0].length))) {
      const cut=Number(threshold[1]), values=list[1].split(/[,、和与]/).map(v=>Number(v.replace('秒','').trim()));
      if(cut>0 && values.every(v=>v>0) && q.match(/\d+(?:\.\d+)?/g)?.length===values.length+1) {
        const ahead=values.filter(v=>v<cut);
        return '屠榜数为 '+ahead.length+' 条。只算严格快于 '+cut+' 秒的成绩'+(ahead.length?'（'+ahead.join('、')+' 秒）':'')+'，打平或更慢的成绩均不计入。';
      }
    }
  }
  if(id==='average_of' && /\bMo\s*3(?!\d)/i.test(q) && /不裁|算术平均|不丢/.test(article) &&
      !/DNF|DNS|不同选手|换人|罚|跨项目|毫秒|分钟|分\d|Ao\d/i.test(q)) {
    const durations=q.match(/(?<![\d.])(\d+(?:\.\d+)?)\s*(?:秒\s*[,、，]?\s*|[,、，]\s*)(\d+(?:\.\d+)?)\s*(?:秒\s*[,、，]?\s*|[,、，]\s*)(\d+(?:\.\d+)?)\s*秒/);
    if(durations && !/\d\s*秒|[,、，]\s*\d/.test(q.slice((durations.index??0)+durations[0].length)) &&
        !/\d+\s*(?:秒|[,、，])\s*$/.test(q.slice(0,durations.index))) {
      const values=durations.slice(1).map(Number);
      if(values.every(v=>v>0 && Number.isFinite(v)))return '这窗 Mo3 是 '+((values[0]+values[1]+values[2])/3).toFixed(2)+' 秒。三把全部参与算术平均：('+values.join(' + ')+') ÷ 3。同一选手同一项目的连续有效尝试可以跨轮次、跨比赛取窗。';
    }
  }
  if(id==='most_distinct_dates_competed_on' && /月日|MM.DD/i.test(article) &&
      /几种月日|几个不同.{0,4}(?:日期|月日)|几种日期/.test(q) && !/到|至|跨天|连续|另有|次日|第二天|隔天/.test(q)) {
    const dates=[...q.matchAll(/(\d{1,2})月(\d{1,2})[日号]/g)];
    if(dates.length>=2 && dates.length===q.match(/月/g)!.length-Number(q.includes('月日')) &&
       dates.every(m=>Number(m[1])>=1 && Number(m[1])<=12 && Number(m[2])>=1 && Number(m[2])<=new Date(Date.UTC(2000,Number(m[1]),0)).getUTCDate())) {
      const distinct=new Set(dates.map(m=>Number(m[1])+'月'+Number(m[2])+'日'));
      return '覆盖 '+distinct.size+' 种不同月日：'+[...distinct].join('、')+'。同一月日参加多站只算一种。';
    }
  }
  if(id==='grand-slam' && article.includes('onlyFirst') && /三(?:项|个|种).{0,5}锦标赛.*(?:站过台|登台|领奖台|奖牌)/.test(q)) {
    const medals=q.match(/([二三四五六七]阶)[^，。？]{0,8}三(?:项|种|个).{0,5}锦标赛/);
    const record=q.match(/唯一的?(?:世界纪录|WR)(?:却|只)?(?:是|在)([二三四五六七]阶)/i);
    if(medals && record && medals[1]!==record[1] && q.includes(medals[1]+'大满贯'))
      return '还没有达成'+medals[1]+'大满贯。三种锦标赛的决赛领奖台和世界纪录都要在同一项目达成。'+record[1]+'的世界纪录无法满足'+medals[1]+'的纪录条件。';
  }
  if(id==='most_4th_places' && /前百|前一百|前\s*100/.test(q) && /拼音|中文名|按名(?:字|称)/.test(q) && /所有|完整|准确排名/.test(q))
    return '不能。全球前百已截断，地区内其他选手可能没有入表。拼音和姓名也无法确定选手代表的国家或地区。需要按代表地区筛选完整的有效决赛第四成绩，再按次数排序。';
  // A podium belongs to one competition and event. Restrict this shortcut to
  // two explicitly placed people in a single example, without additional cases.
  if(id==='most_podiums_together' && /同一(?:站|场|个比赛)/.test(q) && /算.{0,5}共同登台|共同登台.{0,5}算/.test(q) &&
      !/另外|也拿|又拿|多个|后来|分别.*和|如果换|不在同一|不是同一/.test(q)) {
    const events=roundEventMentions(q);
    if(events.length===2 && events.every(e=>e.event) && events[0].event!==events[1].event &&
        events.every(e=>q.includes(e.label+'第三') || q.includes(e.label+'第二') || q.includes(e.label+'第一') ||
          ['金牌','银牌','铜牌'].some(m=>q.includes(e.label+m))))
      return '这两个成绩贡献 0 次共同登台。'+events[0].label+'和'+events[1].label+'各有自己的领奖台；两人必须在同一场比赛、同一项目的决赛同时进入有效前三，才算共同登台。';
  }
  if(id==='most_finals' && article.includes('不过滤 best > 0') && !/预赛|半决赛|弃权|取消|无效|未出场|被撤|除外|其中|后来|还有/.test(q)) {
    const finals=q.match(new RegExp(count+'个(?:不同)?项目都(?:留了决赛成绩|有决赛成绩|进(?:了|入)?决赛)'));
    if(finals && /涨几|加几|计几|算几|加多少/.test(q) && rankingQuantity(finals[1])>0)
      return '增加 '+rankingQuantity(finals[1])+' 次。每个项目有一条决赛轮成绩就计一次，决赛 DNF 也计入，无需获得奖牌。';
  }
  // A specified sequence is sufficient evidence for the count. Only the
  // initial run of DNFs belongs to it; DNS, mixed events and missing attempts
  // require interpretation against the methodology.
  if(id==='most_solves_before_bld_success' && article.includes('findIndex') &&
    !/DNS|没成功|未成功|尚未|从没|没能|不是|并非|分别|另一|如果再|其中|并列|哪一位|第几名|排名|哪年|为何|为什么/.test(q)) {
    const run=q.match(new RegExp('(?:先|开头|起初)(?:连续)?'+count+'(?:次|把)(?:都)?\\s*DNF[,、 ]*(?:然后|再|随后|才)(?:首次|第一次)?成功','i'));
    const ordinal=q.match(new RegExp('(?:从首把开始|开头|起初|^|[，,。:： ])(?:前|头)'+count+'(?:次|把)(?:都|全是)?\\s*DNF[,、 ]*第'+count+'(?:次|把)(?:才|首次)?成功','i'));
    const failures=run?rankingQuantity(run[1]):ordinal && rankingQuantity(ordinal[2])===rankingQuantity(ordinal[1])+1?rankingQuantity(ordinal[1]):-1;
    if(failures>=0 && /记几|记多少|多少次|数字是几|算几|有几个|是多少/.test(q))
      return '首次成功前有 '+failures+' 次失败尝试。按该选手同一项目的时间顺序，数到第一次成功为止；之后的失败不再计入。';
  }
  if(id==='wr_newcomer' && article.includes('attempt_number = 1') && /首次还原/.test(q) &&
    /首战最好|首场(?:比赛)?(?:最好|最佳)/.test(q) && !/DNF|DNS|平均|罚|毫秒|分钟|换项目|不同项目/.test(q)) {
    const times=q.match(/第一把\s*(\d+(?:\.\d+)?)\s*秒[,、 ]*(?:后来有|后来是|整场最好|首场最好)\s*(\d+(?:\.\d+)?)\s*秒/);
    if(times && Number(times[1])>0 && Number(times[2])>0 && q.match(/\d+(?:\.\d+)?\s*秒/g)?.length===2) {
      const first=Number(times[1]),later=Number(times[2]);
      return '首次还原单次取首场首轮的第一把，是 '+first+' 秒。就给出的两把比较，最快是 '+Math.min(first,later)+' 秒。首场比赛最好单次取整场各轮的最小有效值。'+
        (later<first?'已经有一把更快，因此这两个指标在这场的数值不同。':'若没有更快的其他尝试，这场的两个数值相同。');
    }
  }
  if(id==='wr_newcomer' && article.includes('attempt_number = 1') && /第一次还原|首次还原|第一次尝试/.test(q) &&
    /首场比赛最好|首场.*最佳|首赛最佳/.test(q) && /同一个指标|一个指标|是一样|等同/.test(q) && !/平均|\d|几秒/.test(q))
    return '两项取数范围不同。看单次时，“首次还原”取该项目首场比赛首轮的第一次尝试；这一把 DNF，不能顺延到第一次成功。“首场比赛最佳”取该场各轮中最快的有效单次。两项数值可能相同。';
  if(id==='most_finals' && /都没(?:有)?进(?:入)?决赛|一次决赛也没进/.test(q) && /加几次|计几次|算几次/.test(q) && !/另|后来|但有|又进/.test(q))
    return '这组比赛贡献 0 次。只有进入项目决赛并留下决赛成绩才计一次，仅参加比赛不会增加这项计数。';
  if(id==='competitions_count_by_week' && article.includes('ISO 周') && /每天|每一天/.test(q) && /加一场|各算一场/.test(q) && /举办|开幕|开赛/.test(q))
    return '整场比赛只加 1 场，归入开赛日期所在的 ISO 周（周一至周日）。持续多天也不会每天另加一场。';
  const eventCount=q.match(new RegExp(count+'\\s*场(?:不同)?比赛'));
  if(eventCount && rankingQuantity(eventCount[1])>0 && !/但有|另有|其中|取消|分属不同项目/.test(q)) {
    const n=rankingQuantity(eventCount[1]);
    if(id==='most_delegated_competitions' && /代表.{0,7}场不同比赛/.test(q) && /加|计几|多少/.test(q))
      return '计 '+n+' 场。代表次数按不同比赛 ID 去重，同一天承担不同比赛的代表工作，各场分别计数。';
    if(id==='most_podiums_together' && /同一对|这对/.test(q) && /同一项目/.test(q) && /都(?:站上|登上|上台)/.test(q))
      return '这对搭档的共同登台频次增加 '+n+' 次。每场比赛的同一项目形成一个领奖台，同一对人在这些不同领奖台共同出现，每次各加一。';
  }
  if(id==='most_frequent_results' && /有效单次/.test(q) && /频次|频数/.test(q) && !/同一把|重复导入|取消/.test(q)) {
    const identical=q.match(new RegExp(count+'次(?:完全)?(?:一样|相同)'));
    if(identical && rankingQuantity(identical[1])>0) return '该成绩的频次增加 '+rankingQuantity(identical[1])+' 次。每次有效单次分别计数，同一位选手多次打出相同成绩也逐次累计。';
  }
  if(id==='success-rate' && article.includes('attempted') && /(?:每|都至少|各至少).{0,8}(?:做出来|还原成功|有效成绩|成功还原)/.test(q) &&
      /全成功|都算成功|成功率/.test(q) && !/没(?:有)?成功|成功率榜首|排第/.test(q)) {
    const count=q.match(/(\d+|[一二两三四五六七八九十])轮都至少/);
    if(count)return '这'+count[1]+'轮全算成功，成功率是 100%。每轮只看最终最佳成绩，有一把完成，该轮就同时计为一个成功轮和一个尝试轮，其他单把 DNF 不会改变这一点。';
  }
  if(id==='most_4th_places' && article.includes('best') && /(?:资格赛|预赛|半决赛)第四/.test(q) &&
      /决赛也?第四.{0,5}(?:有效|成绩有效)/.test(q) && /同一(?:人|个人).*同一(?:个)?项目/.test(q) && /几次|多少次/.test(q) &&
      !/两场|三场|[2-9]场|多场|不同比赛/.test(q)) return '这场比赛贡献 1 次。有效的决赛第四计一次，资格赛、预赛或半决赛的第四不计入决赛殿军榜。';
  if(id==='most_4th_places' && /全球|全世界/.test(q) && /前百|前一百|前\s*100/.test(q) &&
      /筛.*名字|名字.*筛/.test(q) && /完整/.test(q))return '无法从全球前百得到完整的地区榜。该地区在全球前百以外的选手也需要纳入，而且姓名不能可靠地确定选手所代表的国家或地区。应按所问地区筛完整成绩，再按有效决赛第四的次数排序。';
  const openingDay=q.match(/(?:周|星期)([一二三四五六日天])(?:开赛|开幕|开场|开始)/);
  if(id==='competitions_count_by_week' && openingDay && article.includes('ISO 周') && /(?:下(?:个)?(?:周|星期)|跨周|两周各|分摊|归.*周)/.test(q) &&
     !/另一(?!周)|另有|第二场|两场比赛|同时开赛|两站|取消/.test(q))
    return '这场比赛完整计 1 场，归入开赛日（周'+openingDay[1]+'）所在的 ISO 周，周一到周日为一周。结束日在下一周也不会再计或分摊。';
  const weekdays=q.match(/(?:周|星期)([一二三四五六日天])(?:到|至)(?:下周|周|星期)([一二三四五六日天])/);
  if(id==='competitions_count_by_week' && weekdays && article.includes('ISO 周') && /再算|另算|重复|占两周/.test(q) && !/两场|另一场/.test(q))
    return '这场比赛只算 1 场，归入开赛日（周'+weekdays[1]+'）所在的 ISO 周。比赛持续到周'+weekdays[2]+'，不会让结束日所在周再多一场。';
  if(id==='competitions_count_by_week' && article.includes('ISO 周') &&
      /(?:另一场|第二场|另一个比赛)/.test(q) && /周日开赛|周日开幕/.test(q) && /下周一开赛|下周一开幕/.test(q) &&
      /同一(?:个)?周/.test(q)) return '分在两个不同的统计周。每场比赛按开赛日期归入 ISO 周，周一开始、周日结束。周日开赛的一场归本周，下周一开赛的另一场归下一周。';
  if (id==='average_of' && /ceil\(N × 5%\)|⌈N × 5%⌉/.test(article) &&
      /裁|舍去|丢|扔|剩下|参与平均|最快.*最慢|去掉|清零/.test(q) &&
      !/DNF|DNS|打乱|纪录|候选|中位数|秒|分秒|\[|盲|无限|为什么/i.test(q)) {
    const windows=[...q.matchAll(/\b([am]o)\s*(\d+)/gi)];
    if (!windows.length || windows.some(w=>!['3','5','12','25','50','100','1000'].includes(w[2]) || (w[1].toLowerCase()==='mo')!==(w[2]==='3'))) return;
    const results=[...new Set(windows.map(w=>Number(w[2])))].map(n=>{
      if(n===3)return 'Mo3 不裁剪，3 把都参与算术平均。';
      const k=Math.ceil(n/20);
      return 'Ao'+n+' 将窗口内的成绩排序，最快的 '+k+' 把和最慢的 '+k+' 把不参与平均。两端共去掉 '+(2*k)+' 把，取中间 '+(n-2*k)+' 把的算术平均。';
    });
    if(windows.length===2 && /少裁|多裁|多丢|少丢|多扔|少扔|多几|少几|差几|相差/.test(q)) {
      const trims=windows.map(w=>w[2]==='3'?0:Math.ceil(Number(w[2])/20));
      const distance=Math.abs(trims[0]-trims[1]);
      results.push('前者每端比后者'+(trims[0]<trims[1]?'少':trims[0]>trims[1]?'多':'相差')+'裁 '+distance+' 把，两端合计相差 '+2*distance+' 把。');
    }
    return results.join('\n')+' 滚动窗口可以跨轮次、跨比赛连续取成绩。';
  }
  if (id==='grand-slam' && article.includes('onlyFirst') &&
      /同一项目/.test(q) && /三(?:种|项|个|场)(?:锦标赛|冠军赛)/.test(q) &&
      /(?:都|各|分别)(?:拿过|获得|拿到|有)(?:铜牌|银牌|奖牌)/.test(q) &&
      /(?:破过|刷新过|打破过|拿过)(?:一[次个项])?(?:平均|单次)(?:世界纪录|WR)/i.test(q) &&
      !/没|未|不曾|跨|换国|哪年|资格|并列/.test(q)) {
    return '满足普通大满贯。这个项目在世锦赛、所属洲锦赛和国锦赛都登过决赛领奖台，铜牌和银牌都算。该项目的单次或平均世界纪录满足最后一项条件。选择金牌大满贯时，这三个领奖台才都必须是冠军。';
  }
  if(id==='cohort-ranks' && article.includes('生涯') && /首[次参]?赛|届别/.test(q) &&
     /PB|个人最好|生涯最佳/.test(q) && /(?:超过|超越)同届|能(?:否|不能)?(?:改善|提升|提高|改变)|能.*(?:届内|同届)名次|(?:一定|保证).*升一位/i.test(q) &&
     !/第几|几位|多少名|实际.*排|出生|年龄组|国家|哪一项/.test(q)) {
    return '首次实际参赛的年份决定届别，刷新成绩不会改变这个年份。届内比较使用同一项目、同一成绩类型的生涯最佳。能否实际升名次，取决于新成绩有没有超过同届其他选手。';
  }
  if(id==='sum-of-ranks' && article.includes('totalRank') && /名次.*相加|总和|总名次/.test(q) &&
     /谁靠前|哪个靠前|哪(?:个|位).*排前/.test(q) && !/并列|缺项|没成绩|打平/.test(q)) {
    const pair=q.match(/(\d+)\s*(?:和|与|、|对比|跟)\s*(\d+)/);
    if(pair && q.match(/\d+/g)?.length===2) {
      const [a,b]=pair.slice(1).map(Number);
      if(Number.isSafeInteger(a) && Number.isSafeInteger(b) && a>0 && b>0 && a!==b)
        return '总名次为 '+Math.min(a,b)+' 的选手靠前。按相同项目和范围求和时，总和越小排名越高，'+Math.min(a,b)+' 小于 '+Math.max(a,b)+'。';
    }
  }
  if(id==='competitions_per_year_by_person' && article.includes('365.25') && /(?:除以|年均).*还是.*(?:最忙|最多)|(?:最忙|最多).*还是.*年均/.test(q) && !/\d|几名|谁/.test(q))
    return '取生涯年均值。先把同一场比赛的多个项目合为一场，再用场数除以职业年限。职业年限是首场开赛日到数据导出日的天数除以 365.25，满一年才入榜。最忙的那个自然年是另一项统计。';
  if(id==='success-rate' && article.includes('attempted') && /(?:一轮|同一轮)/.test(q) &&
     /(?:一把|一次|至少一把)(?:还原)?成功/.test(q) && /成功几次|尝试几次/.test(q) &&
     !/没(?:有)?(?:一把|一次)|没有成功|如果|多少轮/.test(q)) return '这轮记 1 个成功轮、1 个尝试轮。每轮只看一个 best，有一把还原成功就有有效 best，同轮其余 DNF 不会增加轮数。';
  if(id==='success-rate' && article.includes('attempted') && /不同轮次|各(?:自|占)一轮|分别.*一轮/.test(q) &&
      /(?:实际出手|单把|把).*(?:DNF|失败)|DNF.*不同轮次/i.test(q)) {
    const num='(?:\\d+|[一二两三四五六七八九十])';
    const total=q.match(new RegExp('('+num+')(?:个实际出手|把|次尝试)'));
    const failed=q.match(new RegExp('('+num+')(?:次|把|个)?\\s*DNF','i'));
    const number=(s:string)=>/^\d+$/.test(s)?Number(s):'零一二三四五六七八九十'.indexOf(s.replace('两','二'));
    if(total && failed) {
      const n=number(total[1]),d=number(failed[1]);
      if(n>0 && n<=1000 && d>=0 && d<=n) return '只知道 '+n+' 次出手中有 '+d+' 个 DNF，还不能确定按轮统计的成功率。每轮只看该选手的最佳成绩，有一次成功就算一个成功轮。如果这 '+n+' 把各自独占一轮，且其余 '+(n-d)+' 把都成功，那么这组的成功率是 '+(n-d)+'/'+n+' = '+Number(((n-d)*100/n).toFixed(2))+'%。如果这些轮里还有别的尝试，就要看每轮的最终 best。';
    }
  }
}
