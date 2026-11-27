// A closed grammar for operations on an explicitly named published table.
// Any unrecognised population, qualifier or second request goes to the planner.
const ordinal='(\\d{1,4}|[零一二两三四五六七八九十]{1,3})';
const unit='(?:个人|个年份|个星期|条记录|个单次|个洲|个国家|场|笔|行|条|位|名|人|项|组|队|对|周)';
const span=new RegExp('第\\s*'+ordinal+'\\s*(?:行|条)?\\s*(?:到|至|[-~])\\s*第?\\s*'+ordinal+'\\s*'+unit);
const positions=new RegExp('(第|头|前)\\s*'+ordinal+'\\s*'+unit,'g');
const maximum=/(?:最多|最高|榜首|头名|首行)/;

export function rankingQuantity(value:string) {
  if(/^\d+$/.test(value))return Number(value);
  const [left,right]=value.replace(/[两俩]/g,'二').split('十');
  const digits='零一二三四五六七八九';
  if(right===undefined)return left.length===1?digits.indexOf(left):-1;
  if(left.length>1 || right.length>1)return -1;
  return (left?digits.indexOf(left):1)*10+(right?digits.indexOf(right):0);
}

const groupPatterns: Record<string,Array<[string,RegExp]>>={
  most_completed_solves:[
    ['Competition',/按比赛|比赛之间比?|的比赛|哪一场|比赛分表|按一场比赛(?:一条记录|一笔)/],['Year',/按年份|年份分表|哪一年|那一年/],
    ['Country',/按国家|各国|国家分表/],['Person',/比较选手|按选手|选手榜|个人分表/],
    ['Event',/按项目|各?项目分表/],['Continent',/按(?:大)?洲(?:汇总)?|大洲分表/],
  ],
  most_podiums_together:[['Pairs',/对子|两人组(?:合)?|两人搭档|哪对/],['Triples',/三人(?:组合|组|搭档|(?=共同领奖|共同登台))|三个人/]],
  most_frequent_results:[...'二三四五六七'].map(n=>[n+'阶魔方',new RegExp(n+'阶(?:魔方)?')]),
};

export function rankingSections(id:string, question:string) {
  return (groupPatterns[id]??[]).filter(([,pattern])=>pattern.test(question));
}

// Requests may mention which columns to return. These words cannot authorise
// an event, region, date interval or unsupported sort.
// Match the longest filler phrase first so a shorter prefix cannot strand a suffix.
const words=new RegExp([
  '拿了几次|是哪两位|哪两位|我想摘|两人各|我找|先取|先看|只列|只读|选|成员|请列|代表过|他去了|几个国家|不同日子|名字和|是哪一秒数|出现多少回|是多少回|跑过几个洲|各跑过几个洲|哪项|逐人报|并排|成功量|国及|两国|及总数|都列一下|选对子|他们的|共同次数|完成数|请逐人|都想看|时间|两人',
  '完成总数|分表中|周起止|各周的|是哪个洲|哪个洲|是哪年|排行取|排行|往下翻到|覆盖多少国|洲数|去了多少个洲|能把|一起报出来吗|帮我找|用时|月份|年份|是啥|发我|配起来|只要她的|只要他的|想知道|都想知道|项目名|两人的|场赛事|赛事|统计那栏|统计的|是哪个洲|频数|那周|也要|报下|是几个国家|的记录|年均场数',
  '完成总量|并报|比赛数|呢|排头那周|两端|只从|顺便带上|列出来|能查到吗|场数到底是几|当过|只要他那条|只要她那条|只要|统计上的|名单中|每笔|打了|抄给我|直接|为几|总数|是哪些|哪些|完成多少把|的项目|在比赛中|最多次|场数最靠前的|想看|两者|几个国家|多少站|还原数',
  '拿过|生涯|能报一下吗|共上台|以及|及|它们|别按并列名次跳行|跨年同月同日只算一天的|往下数到|请一起报|旁边写的|如果按|报一下吗|请带|这张表给他的|用时是啥|出现了多少次|在国外打了|只查|只能看|只摘|只说|进了多少次决赛|发生在哪月|一共|多少国|几国|集到了|几天|它们|出现频率|能列一下吗|去比赛|上了|请带|来排|要追到|积了',
  '登在|排名|哪位|那位|那张|哪两个洲|不去重相加|按显示顺序|往下找到|数到多少天|一个个报下|打出来|想看看|我只想读',
  '最前那周|在国外打的|频次|人名|国数|几回|多少回|秒数|多少秒|站数|同台次数|出现几回|念一下|即可|名单|叫什么|叫什麼|年均|两个洲|起止|等于|那份|挑|就',
  '发布表|开了|哪周',
  '不用列整张|带出现次数|成功还原数|按显示顺序|是哪年哪月|职业生涯拿|全球比赛|出现次数|哪些大洲|哪年哪月|国家数量|完成把数|已发布的|成功还原|按一年里',
  '数据给我|比赛最挤|职业生涯|一样吗|之间比|全世界|列给我|原顺序|发布的|哪一场|哪一年|哪个月|哪几场|国家数|在榜上',
  '大洲数|已有的|年均值|总成功|我只查|我只看|我只要|拿得勤|日期数|是什么|是哪站|是多少|最前面|最挤的|最高的',
  '的是谁|的纪录|还原数|那一年|不同|个人|个月|代表|全球|具体|几个|几场|几天|几把|几次',
  '几站|分别|分表|列出|列表|别漏|参赛|只看|只给|各有|各自|名字|哪站|场数|多少',
  '姓名|对应|帮我|年月|并带|开头|归属|总量|想查|成功|成绩|我想|排在|排序|排第',
  '数值|数字|数据|数目|日期|星期|是几|是谁|最多|最高|月日|有效|榜上|榜单|榜首',
  '次数|每周|每年|的是|第一|累计|纪录|给出|给我|表里|覆盖|记了|记录|请问|这些',
  '这张|选手|那个|附上|限在|上|与|个|了|人|分|列|各|和|哪',
  '在|场|带|把|报|按|排|数|是|有|查|榜|次|的|看',
  '算|给|至|表|读|谁|赛|跑|里|附',
].flatMap(line=>line.split('|')).sort((a,b)=>b.length-a.length).join('|'),'gu');

export function rankingRowOperation(question:string,subject:RegExp,id:string) {
  question=question.normalize('NFKC');
  const name=question.match(subject)?.[0];
  if(!name)return;
  let rest=question.replace(name,'')
    .replace(/(?:频数排|的)([一二三四五六七八九十\d]+)、([一二三四五六七八九十\d]+)(?:两行|的时间)/g,'第$1行和第$2行')
    .replace(/第([一二三四五六七八九十\d]+)(?:和|、)第([一二三四五六七八九十\d]+)(?:个时间|(?=的))/g,'第$1行和第$2行')
    .replace(/从第([一二三四五六七八九十\d]+)(?:位|名)到第/g,'第$1到第')
    .replace(/排在最前的(?=[一二两三四五六七八九十\d]+位)/g,'前')
    .replace(/最忙的那周/g,'第一周')
    .replace(/(?:排名|排)第([一二三四五六七八九十\d]+)(?=的(?:成绩|记录))/g,'第$1行')
    .replace(/第([一二三四五六七八九十\d]+)和第([一二三四五六七八九十\d]+)行/g,'第$1行和第$2行')
    .replace(/(?:最靠前的|排头的)([一二两三四五六七八九十\d]+)(?=位|名|人|行)/g,'前$1')
    .replace(/排头那周/g,'第一周')
    .replace(/第([一二三四五六七八九十\d]+)热门/g,'第$1行')
    .replace(/是哪([一二两三四五六七八九十\d]+)个时间/g,'前$1行')
    .replace(/排第([一二三四五六七八九十\d]+)(?=的是谁)/g,'第$1位')
    .replace(/第([一二三四五六七八九十\d]+)(?:位|名|行|笔)开始(?:连读|接着读)([一二两三四五六七八九十\d]+)(?:个人|位|行|笔)/g,
      (_,a:string,n:string)=>'第'+rankingQuantity(a)+'至'+(rankingQuantity(a)+rankingQuantity(n)-1)+'行')
    .replace(/第([一二三四五六七八九十\d]+)[、和与]?第([一二三四五六七八九十\d]+)(?:两个国家|的项目|名|位|笔|行|条)/g,'第$1行和第$2行')
    .replace(/^哪([一二两三四五六七八九十\d]+)个人([\s\S]*?只要头)([一二两三四五六七八九十\d]+)位(?=[？?。]?$)/, (m,a,mid,b)=>rankingQuantity(a)===rankingQuantity(b)?mid+b+'位':m)
    .replace(/(?:我)?看到第([一二三四五六七八九十\d]+)(?:行|条|位)了?[,、 ]*(?:请)?(?:再|接着)?续([一二两三四五六七八九十\d]+)(?:行|条|位)/g,
      (_,last:string,count:string)=>'第'+(rankingQuantity(last)+1)+'至'+(rankingQuantity(last)+rankingQuantity(count))+'行')
    .replace(/第([一二三四五六七八九十\d]+)(?:到|至)第?([一二三四五六七八九十\d]+)这([一二两三四五六七八九十\d]+)个人/g,
      (match,a:string,b:string,n:string)=>rankingQuantity(b)-rankingQuantity(a)+1===rankingQuantity(n)?'第'+a+'至'+b+'人':match)
    .replace(/([一二三四五六七八九十\d]+)(?:和|与)([一二三四五六七八九十\d]+)两个位置/g,
      (match,a:string,b:string)=>rankingQuantity(b)===rankingQuantity(a)+1?'第'+a+'至'+b+'位':match)
    .replace(/第([一二三四五六七八九十\d]+)常见/g,'第$1行')
    .replace(/(?:最多的)?是哪([两三四五六七八九十\d]+)个人/g,'前$1位')
    .replace(/(?:开头|最上面|最前面)(?=[俩两一二三四五六七八九十\d])/g,'前')
    .replace(/(?:全球)?比赛最挤的(?=[一二两三四五六七八九十\d]+个星期)/g,'最挤的')
    .replace(/(?:略过|跳过)榜首[，,、\s]*(?:看|读)?下一(?:条|行|位)/g,'第二行')
    .replace(/第([一二三四五六七八九十\d]+(?:[、,]第?[一二三四五六七八九十\d]+)+)(行|条|位|名|笔|组|对)/g,
      (match,sequence:string,u:string)=>{
        const values=sequence.split(/[、,]第?/).map(rankingQuantity);
        return values.every((n,i)=>!i || n===values[i-1]+1)?'第'+values[0]+'至'+values.at(-1)+u:match;
      })
    .replace(/不用第一(?:组|对|行|条)[,、]\s*(?=第二)/g,'')
    .replace(/(?:后)?排第([一二三四五六七八九十\d]+)(?=的是哪位)/g,'第$1位')
    .replace(/最多的([两三四五六七八九十\d]+)(位|人|对|组)(?!搭档|组合)/g,'前$1$2')
    .replace(/最前那周/g,'第一周')
    .replace(/(?:最高的|最挤的)([一二两三四五六七八九十\d]+)个(?:年份|星期)/g,'前$1行')
    .replace(/俩人/g,'两个人').replace(/次席/g,'第二行')
    .replace(/第([一二三四五六七八九十\d]+)(?=[、和与]第)/g,'第$1行');
  // Asking who the two members of a ranked pair are is not a request for two rows.
  if(id==='most_podiums_together' && /第[一二三四五六七八九十\d]+对/.test(question))rest=rest.replace(/是(?:前|哪)两位/g,'是谁');
  if(id==='competitions_count_by_week' && /最密集/.test(name))rest=rest.replace(/^([一二两三四五六七八九十\d]+)个星期/,'前$1周');
  if(id==='most_completed_solves' && rankingSections(id,question).some(([group])=>group==='Country'))
    rest=rest.replace(/第([一二三四五六七八九十\d]+)国/g,'第$1行');
  const explicitYear=rest.match(/(?:19|20)\d{2}/);
  let year:number|undefined;
  if(explicitYear) {
    if(!/公开的|表已有|发布表|现有记录|已发布|(?:榜|表)上已有/.test(rest))return;
    year=Number(explicitYear[0]);
    rest=rest.replace(/把|给我|的数据|只用|公开的|表已有|只在|仅在|只看|这张|(?:榜|表)上已有|发布表|现有记录|已发布记录|已发布|筛出|筛|中|已有的|内找|开赛那周|周起始日|比赛数|限在|月份|[“”]/gu,'').replace(/(?:19|20)\d{2}\s*年/,'');
  }
  const groups=rankingSections(id,question);
  if(groups.length>1)return;
  const section=groups[0]?.[0]??'';
  if(groups.length) {
    const pattern=groups[0][1];
    const phrase=question.match(pattern)![0];
    rest=rest.replace(phrase,'').replace(new RegExp(pattern.source,'g'),'');
  }
  // A quoted negative ordinal is not a second result request.
  rest=rest.replace(/(?:不是问|别从)第[一二三四五六七八九十\d]+(?:行|条)(?:开始抄)?[。？]?$/,'');
  rest=rest.replace(/((?:前|头)[一二两三四五六七八九十\d]+)个(?:洲|国家)/g,'$1行');
  rest=rest.replace(/^中(?=[，,])/,'');
  const difference=/相差|差多少|差几|差额|领先|多几|少出现几|多出现几|多跑了几/.test(rest);
  const sum=/加起来|合计|加总|总和|合起来|相加/.test(rest);
  if(sum && difference)return;
  if(sum)rest=rest.replace(/不去重(?:直接)?相加|求一个总和|加起来|合计|加总|总和|合起来|相加/gu,'');
  if(difference)rest=rest.replace(/还差几|领先|差额|相差多少|相差|差多少|差几|多几|多跑了几|少出现几|多出现几|比|几个国家|个国家|个洲|几场|几次|几站|几|国家|洲|站/gu,'');
  const range=rest.match(span);
  const points=[...rest.matchAll(positions)];
  let start:number,end:number;
  if(range) {
    start=rankingQuantity(range[1]);end=rankingQuantity(range[2]);rest=rest.replace(range[0],'');
  } else if(points.length===2 && points.every(m=>m[1]==='第')) {
    [start,end]=points.map(m=>rankingQuantity(m[2]));
    if(!difference && end!==start+1)return;
    rest=rest.replace(positions,'');
  } else if(points.length===1) {
    const [m]=points;
    start=m[1]==='第'?rankingQuantity(m[2]):1;
    end=rankingQuantity(m[2]);
    if(difference && /榜首/.test(rest) && m[1]==='第')start=1;
    rest=rest.replace(m[0],'');
  } else if(!points.length && maximum.test(question) && (section || year || /榜首|头名|首行/.test(question))) {
    start=1;end=1;rest=rest.replace(maximum,'');
  } else return;
  if((difference || sum) && end<start)[start,end]=[end,start];
  if(start<=0 || end<start || (difference && start===end) || (!difference && end-start>=20))return;
  if(id==='most_frequent_results')rest=rest.replace(/单次/g,'');
  if(id==='most_visited_continents')rest=rest.replace(/大洲榜/g,'');
  if(id==='most_visited_countries')rest=rest.replace(/旅行参赛的国家数/g,'');
  const remaining=rest.replace(words,'').replace(/[\s\p{P}]/gu,'');
  if(remaining)return;
  return {op:difference?'gap' as const:sum?'sum' as const:'rows' as const,section,start,end,year};
}
