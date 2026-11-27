// Resolve the operands before issuing a verdict. Only a supported source and
// a fully consumed scenario may bypass the guide reader.
type Page = { href: string; text: string };

export function calculatedGuideExample(question: string, page: Page): string | undefined {
  const q = question.normalize('NFKC').replace(/\s/g, '');
  const text = page.text;
  switch (page.href) {
    case '/wca/achievements':
      return badgeExample(q, text);
    case '/wca/about/competition_days_count_by_region': {
      if (!text.includes('end_date - start_date + 1')) return;
      // No year is needed for intervals wholly within a specified month.
      const range=/(\d{1,2})月(\d{1,2})日?(?:至|到)(\d{1,2})日/g;
      const dates=[...q.matchAll(range)];
      const remaining=q.replace(range,'').replace(/地区比赛天数|实际日期|只算|两站|两场|每场|平均|场数|总场数|几天|是多少|请|用|算|和|也|给我|[\p{P}]/gu,'');
      if(dates.length===2 && !remaining) {
        const valid=dates.every(([,m,a,b])=>+m>=1 && +m<=12 && +a>=1 && +a<=+b && +b<=[31,28,31,30,31,30,31,31,30,31,30,31][+m-1]);
        if(valid) {
          const [a,b]=dates.map(([, ,start,end])=>+end-+start+1);
          return '共2场，均含起止日。第一场 '+a+' 天，第二场 '+b+' 天，平均 ('+a+' + '+b+') ÷ 2 = '+((a+b)/2)+' 天。';
        }
      }
      const pair = q.match(/^(?:一个|某个?)地区(?:只有|有)两场比赛[,。]一场(?:是)?周([一二三四五六日天])(?:到|至)周([一二三四五六日天])[,。](?:另)?一场(?:是)?周([一二三四五六日天])到周([一二三四五六日天])[。,.]按地区比赛天数口径平均是几天,总场数几场\?$/);
      if (!pair) return;
      const weekdays = '一二三四五六日';
      const days = pair.slice(1).map(d => weekdays.indexOf(d.replace('天', '日')));
      const durations = [0, 2].map(i => (days[i+1] - days[i] + 7) % 7 + 1);
      const [a, b] = durations;
      const detail = durations.map((n,i) => n === 1 ? '第'+(i+1)+'场若同日开始并结束是1天；若到下周同一天是8天。' : '第'+(i+1)+'场到最近的该星期几为'+n+'天。').join('');
      const totals = new Set([a, ...(a === 1 ? [8] : [])].flatMap(x => [b, ...(b === 1 ? [8] : [])].map(y => (x+y)/2)));
      return '共2场，按起止日期含首尾计算。'+detail+'对应的平均天数为'+[...totals].join('或')+'天。';
    }
    case '/wca/about/wr_metric': {
      if (!text.includes('mean(best 3') || !text.includes('mean(worst 3')) return;
      const list = q.match(/(\d+(?:\.\d+)?(?:秒?[、,]\d+(?:\.\d+)?){3})秒/);
      if (!list || !/前[四4]把/.test(q) || !/BPA/i.test(q) || !/WPA/i.test(q)) return;
      // Unsupported follow-ups (DNF, fifth-result scenarios, percentiles,
      // etc.) must remain available to the normal guide reader.
      const queried=q.match(/两把(\d+(?:\.\d+)?)是不是都要舍/);
      if(queried && list[1].replace(/秒/g,'').split(/[、,]/).filter(s=>Number(s)===Number(queried[1])).length!==2)return;
      const rest = q.replace(list[0],'').replace(queried?.[0]??'','').replace(/前[四4]把|指标榜|结果保留两位|哪个数|BPA|WPA|各自|分别|舍掉|舍|去掉|删掉|哪把|哪一把|是多少|多少|怎么算|怎么计算|结果|成绩|算一下|算算|算|说清楚|告诉我|比较|请|把|的|为|是|和|与|各|[\p{P}]/giu,'');
      if (rest) return;
      const values = list[1].replace(/秒/g,'').split(/[、,]/).map(Number).sort((a,b) => a-b);
      if (!values.every(v => Number.isFinite(v) && v > 0)) return;
      const mean = (xs: number[]) => (xs.reduce((a,b) => a+b)/3).toFixed(2);
      return 'BPA 舍掉前四把中最慢的 '+values[3]+' 秒，取 '+values.slice(0,3).join('、')+' 的平均，为 '+mean(values.slice(0,3))+' 秒。WPA 舍掉最快的 '+values[0]+' 秒，取 '+values.slice(1).join('、')+' 的平均，为 '+mean(values.slice(1))+' 秒。'+(queried?'前四把里的两个 '+queried[1]+' 秒'+(Number(queried[1])===values[0] || Number(queried[1])===values[3]?'即使处在被舍弃的一端，也只舍去其中一个。':'在两种计算中都保留。'):'');
    }
    case '/alg/sq1/karnaukh-notation': {
      const notation=q.match(/卡脑壳(?:表|记号)(?:把|里的?)?(-?\d-?\d)(?:和|与|、)(-?\d-?\d)/);
      if(!notation || !text.includes('切层仍需写 /'))return;
      const rest=q.replace(notation[0],'').replace(/挤在一起写|我该|怎么拆|这两组|紧挨的|负号|是除号|表示|已经|切层|了吗|[\p{P}]/gu,'');
      if(rest)return;
      // Read only signed pairs that the published table actually expands.
      const pairs=notation.slice(1).map(token=>text.match(new RegExp('(?:^|[^0-9-])'+token+'(?: = |→)\\((-?\\d+),\\s*(-?\\d+)\\)')));
      if(pairs.some(v=>!v))return;
      return pairs.map((v,i)=>notation[i+1]+' = ('+v![1]+', '+v![2]+')').join('；')+'。每个负号作用于紧随其后的分量；实际切层须另写 /。';
    }
    case '/dev/algorithms/kociemba': {
      const allowed=text.match(/只能用 10 种 G1 转动:([UDFBRL2' ]+)。/)?.[1].split(' ');
      const moves=q.match(/G1里我想用([URFDLB](?:2|')?)和([URFDLB](?:2|')?)/);
      const rest=moves && q.replace(moves[0],'').replace(/二阶段求解的|哪一步|会离开|允许步集|如果|只改同一面|能改成什么|[\p{P}]/gu,'');
      if(rest!=='' || !allowed || !moves)return;
      return moves.slice(1).map(m=>allowed.includes(m)?m+' 是 G1 允许的转动。':m+' 不在第二阶段步集中；同一面改用 '+m[0]+'2 就能留在 G1。').join('');
    }
    case '/scramble/batch-solver': {
      const depths=q.match(/建表(\d{1,2})步[、,]搜索(\d{1,2})步/);
      if(!depths || !text.includes('最长解 = 建表 + 搜索') || !text.includes('每行步组 = 一轮搜索:限定允许的步'))return;
      const rest=q.replace(depths[0],'').replace(/批量求解器?|某轮|是不是|每个case|就一定|给\d+步的解|给我说明\d+代表什么|以及|步组|能不能|限制|能用的转动|[\p{P}]/giu,'');
      if(rest)return;
      const max=+depths[1]+ +depths[2];
      return '搜索最多覆盖 '+depths[1]+' + '+depths[2]+' = '+max+' 步。可找到的解可能更短；若允许的动作和深度内无解，该 case 就没有结果。每行步组可限制允许的转动。';
    }
    case '/wca/about/most_completed_solves': {
      if(!text.includes('逐 attempt 数 value > 0'))return;
      const valid=[...q.matchAll(/(\d{1,5})个有效/g)].map(m=>+m[1]);
      const rest=q.replace(/\d{1,5}个(?:有效|DNS|DNF)|一轮里|另一轮|最多完成还原|是加两轮|还是[一二两三四五六七八九十0-9]+次|去掉DNS后|这个数字变吗|[\p{P}]/giu,'');
      if(valid.length!==2 || rest)return;
      return '逐把计有效成绩，两轮合计 '+valid.join(' + ')+' = '+(valid[0]+valid[1])+' 次。DNF 和 DNS 都不增加成功数；去掉 DNS 后仍是 '+(valid[0]+valid[1])+' 次。';
    }
    case '/mosaic-about': {
      if(!text.includes('画面由 60 × 90 个色块组成') || !text.includes('原图像素再高也不能突破这个网格'))return;
      const layouts=[...q.matchAll(/(\d{1,4})行(\d{1,4})列/g)];
      const order=q.match(/([二三四五六七])阶/);
      const rest=q.replace(/\d{1,4}行\d{1,4}列/g,'').replace(/[二三四五六七]阶|魔方拼画|拼画|原先|改成|总共|多几颗|画面宽|多几格|原图像素|翻倍|还会|再加格|吗|[\p{P}]/gu,'');
      if(rest || !order || layouts.length!==2)return;
      const [[,r1,c1],[,r2,c2]]=layouts;
      if([r1,c1,r2,c2].some(v=>+v===0))return;
      const n='一二三四五六七'.indexOf(order[1])+1;
      return '魔方数从 '+(+r1*+c1)+' 颗变为 '+(+r2*+c2)+' 颗，相差 '+Math.abs(+r2*+c2-+r1*+c1)+' 颗。画面宽从 '+(+c1*n)+' 格变为 '+(+c2*n)+' 格色块，相差 '+Math.abs(+c2-+c1)*n+' 格。固定布局时，原图像素翻倍也不会增加格数。';
    }
    case '/recon-about': {
      if (!text.includes('总时间与步数可以算整体 TPS') || !text.includes('视频打点或设备时间记录')) return;
      const m = q.match(/^(?:我)?只知道(?:一条|一次)?还原(?:共|用了)(\d+)步[、,](\d+(?:\.\d+)?)秒,想写整体TPS和(十字|F2L|顶层)TPS(?:两个数)?,(?:哪个|哪些)能算\?另一个还缺什么\?$/i);
      if (m && Number(m[2]) > 0) return '整体 TPS = '+m[1]+' ÷ '+m[2]+' ≈ '+Number((Number(m[1])/Number(m[2])).toFixed(3))+' 步/秒。'+m[3]+' TPS 需要该阶段自己的步数和用时；可用视频打点或设备时间记录取得阶段用时。';
      return;
    }
    case '/nemesizer-about': {
      if (!text.includes('每种成绩类型') || !text.includes('最小排名差为 1')) return;
      const m = q.match(/^我的[二三四五六七]阶\/[二三四五六七]阶都被同一个宿敌领先,排名差分别(\d+)位和(\d+)位。这符合严格宿敌吗\?“仅差一点”还缺什么\?$/);
      if (!m || Number(m[1]) <= 0 || Number(m[2]) <= 0) return;
      const gap = Math.min(Number(m[1]), Number(m[2]));
      return '若题中两项就是你的全部排名（单次和平均分开），对方全部严格领先，符合严格宿敌。两项中最小差为 '+gap+' 位，'+(gap===1?'也符合':'未达到')+'“仅差一点”所需的最小差 1 位。若另有未列出的排名，须合并检查是否全部领先，并重新取最小差。';
    }
  }
}

function badgeExample(q: string, text: string): string | undefined {
  const retired=q.match(/(?:项目在)?第(\d{1,6})天退役/);
  const tier=q.match(/时间之碑的?(\d{1,6})天/);
  if(retired && tier && /正式(?:单次|平均)?(?:WR|洲际纪录)/i.test(q) && text.includes('追平不结束保持期；退役项目只计至退役')) {
    const rest=q.replace(retired[0],'').replace(tier[0],'').replace(/我的|正式|单次|平均|WR|洲际纪录|撑了\d+天|后来无人打破|还能拿吗|追平会提前截止吗|[\p{P}]/giu,'');
    if(!rest && /时间之碑\s+某条正式 WR 或洲际纪录[^。]+/.exec(text)?.[0].match(/\d+/g)?.includes(tier[1])) {
      const days=+retired[1];
      return '退役项目只算到退役日，计 '+days+' 天，'+(days>=+tier[1]?'达到':'未达到')+tier[1]+' 天档。追平不截断保持期；打破纪录或项目退役才会截止。';
    }
  }
  const reset=q.match(/第([一二三四五六七八九])轮正好(\d+(?:\.\d+)?),第([一二三四五六七八九])轮(\d+(?:\.\d+)?)/);
  if(reset && text.includes('平均低于 5 秒') && /五秒连击/.test(q)) {
    const rest=q.replace(reset[0],'').replace(/[一二三四五六七八九]个连续三阶平均都sub5|五秒连击|还差一轮就能到五连吗|现在连续几轮|[\p{P}]/giu,'');
    if(!rest && +reset[2]>=5 && '一二三四五六七八九'.indexOf(reset[3])==='一二三四五六七八九'.indexOf(reset[1])+1) {
      const current=+reset[4]<5?1:0;
      return '按每一轮的平均严格低于5秒计，第'+reset[1]+'轮的 '+reset[2]+' 秒使连续轮数清零。第'+reset[3]+'轮后连续 '+current+' 轮，距离五连还差 '+(5-current)+' 轮。';
    }
  }
  const finals = q.match(/^(?:请问)?决赛常客的?第([1-9]\d{0,5})场只(?:留了?|有)(DNF|DNS),?(?:和|与)第([1-9]\d{0,5})场只(?:留了?|有)(DNF|DNS),(?:哪一个|哪个)(?:能满足|能达到)(?:最初|第一)档\?$/i);
  const firstTier = text.match(/决赛常客\s+正式参加至少 (\d+)[^。]+DNF 计入，DNS 不计/);
  if (finals && firstTier) {
    return [1,3].map(i => {
      const n = Number(finals[i]), outcome = finals[i+1].toUpperCase();
      const count = n-1+Number(outcome==='DNF');
      return '若此前 '+(n-1)+' 场均计入，第 '+n+' 场只留 '+outcome+' 后共计 '+count+' 场，'+(count>=Number(firstTier[1])?'达到':'未达到')+firstTier[1]+' 场档。';
    }).join('');
  }
  const record = q.match(/^我的纪录保持了(\d+)天,第(\d+)天被人追平,第(\d+)天才被打破。时间之碑能拿(\d+)天那档吗\?$/);
  const duration = text.match(/时间之碑\s+某条正式 WR 或洲际纪录[^。]+至少 ([\d／]+) 天。追平不结束保持期/);
  if (record && duration && duration[1].split('／').includes(record[4]) && record[1]===record[3] && Number(record[2])<=Number(record[3])) {
    return '若为正式 WR 或洲际纪录，且期间未因项目退役而截止，第 '+record[2]+' 天追平不截断，保持期到被打破共 '+record[3]+' 天，'+(Number(record[3])>=Number(record[4])?'达到':'未达到')+record[4]+' 天档。其他类型的纪录不适用此徽章。';
  }
  const years = q.match(/^常青树在(\d{4})[至到](\d{4})每年都参赛,但(\d{4})只有DNS。换成那年只有DNF,五年档的结论会变吗\?$/i);
  if (years && /连续至少 5[^。]+个自然年正式参赛。DNF 计入，DNS 不计/.test(text)) {
    const [start,end,skip] = years.slice(1).map(Number);
    if (start<=skip && skip<=end) {
      const original = Math.max(skip-start,end-skip), changed = end-start+1;
      return '在给定年份内，只记 DNS 的 '+skip+' 年中断连续参赛，最长连续 '+original+' 年，'+(original>=5?'达到':'未达到')+'五年档。改为 DNF 则该年计入，连续 '+changed+' 年，'+(changed>=5?'达到':'未达到')+'五年档。';
    }
  }
  const streak = q.match(/^破茧成功前在([三四五]盲)DNF([一二两三四五六七八九十]|\d+)次[、,]([三四五]盲)DNF([一二两三四五六七八九十]|\d+)次,然后首次成功([三四五]盲),凑够十次吗\?若第十次是([三四五]盲)DNS呢\?$/i);
  if (streak && /同一盲拧项目经历至少 10[^。]+次 DNF 后首次成功。DNS 不计/.test(text)) {
    const number = (s:string) => /^\d+$/.test(s) ? Number(s) : '零一二三四五六七八九十'.indexOf(s.replace('两','二'));
    const a=number(streak[2]), b=number(streak[4]);
    // The counterfactual replaces the last of the specified failures.
    if (a+b!==10 || b<1) return;
    const event=streak[5], total=(streak[1]===event?a:0)+(streak[3]===event?b:0);
    const alt=total-Number(streak[3]===event);
    return '只累计首次成功的同一项目。'+event+' 在成功前有 '+total+' 次 DNF，'+(total>=10?'够':'不够')+'十次。第十次换成 '+streak[6]+' DNS 后，这条未开始记录不计，'+event+' 计 '+alt+' 次 DNF，'+(alt>=10?'达到':'未达到')+'十次门槛。';
  }
}

// Optional numeric evidence for an example. Keep raw outcome categories so
// changing a DNF into a success never changes the number of actual attempts.
function sampleFailureRate(setup:string, changes:readonly string[]) {
  const digits=(text:string)=>text.replace(/[零一二两三四五六七八九](?=把|次)/g,
    c=>String('零一二三四五六七八九'.indexOf(c.replace('两','二'))));
  const input=digits(setup);
  const counts=['成功','DNF','DNS'].map(label=>input.match(new RegExp(label+'([0-9]+)(?:把|次)','i')));
  if(counts.some(m=>!m) || /(?:成功|DNF|DNS)(?:不是|负|-)|另有|另外|还有.{0,4}(?:把|次)/i.test(input) || /[十百千][零一二两三四五六七八九0-9]*(?:把|次)|不含|不包括/.test(input))return;
  if(['成功','DNF','DNS'].some(label=>[...input.matchAll(new RegExp(label+'[0-9]+(?:把|次)','gi'))].length!==1))return;
  const values=counts.map(m=>Number(m![1]));
  if(values.some(v=>!Number.isSafeInteger(v)))return;
  const edits:{from:number;to:number;count:number}[]=[];
  // Category 3 is an unsubmitted slot. Both it and DNS are outside the denominator.
  const emptySlots=input.match(/(?:空槽|未提交)(\d+)(?:个|次|把)/);
  if(/空槽|未提交/.test(input) && !emptySlots)return;
  values.push(emptySlots?Number(emptySlots[1]):0);
  for(const raw of changes) {
    const q=digits(raw);
    if(/另外|再把|同时|并(?:将|把)|不是|不曾/.test(q))return;
    if(/撤[销回].{0,10}对DNS的更正/.test(q)){
      const i=edits.map(edit=>edit.from).lastIndexOf(2);
      if(i<0)return;
      const [edit]=edits.splice(i,1);
      if(values[edit.to]<edit.count)return;
      values[edit.to]-=edit.count;
      values[edit.from]+=edit.count;
      continue;
    }
    const movement=/(\d+)把(?:原标|原来是|原是)?DNF.{0,6}(?:其实成功|改成成功)/i.exec(q)
      ?? /(\d+)把(?:之前的|原标|原是)?DNS.{0,12}(?:动手后失败|改成DNF)/i.exec(q)
      ?? /(\d+)把失败.{0,12}(?:未提交|空槽)/.exec(q);
    if(!movement)return;
    const from=/DNS/i.test(movement[0])?2:1;
    const to=from===2?1:/空槽|未提交/.test(movement[0])?3:0;
    const count=Number(movement[1]);
    if(!Number.isSafeInteger(count) || count>values[from])return;
    values[from]-=count;
    values[to]+=count;
    edits.push({from,to,count});
  }
  const [success,dnf,dns,empty]=values, attempts=success+dnf;
  return {success,dnf,dns,empty,attempts,percent:attempts?Number((100*dnf/attempts).toFixed(2)):null};
}

export function attemptCountAnswer(turns:readonly string[],page:Page):string|undefined {
  if(page.href!=='/wca/about/dnf_rate_by_event' || !page.text.includes('NOT IN (-2, 0)'))return;
  const [setup,...changes]=turns.map(t=>t.normalize('NFKC').replace(/\s/g,''));
  if(!setup)return;
  // The update and the requested outputs must both be understood. The
  // underlying count can still be supplied as evidence for a broader question.
  const last=changes.at(-1)??setup;
  const clauses=last.split(/[。.!?]/).filter(Boolean);
  const query=clauses.at(-1)??'';
  // Consume only vocabulary for these six quantities. An additional subject
  // (ranking, dates, a second sample, etc.) belongs to the guide reader.
  const outputWords=/实际尝试(?:次数)?|尝试数|失败数|失败率|百分比|DNF率|分子|分母|比例|负数|成功数|失败次数/gi;
  const removeQueryWords=(q:string)=>q.replace(outputWords,'').replace(/按现在这版|请给我|恢复后的|还可能|跟着改|要不要|分别|是多少|是多少次|多少|现在|还算|新的?|都重报|各|和|是|为|还|吗|会|次|把|[、,]/g,'');
  if(!query.match(outputWords) || removeQueryWords(query) || clauses.length>3 ||
     turns.some(t=>/如果|假设再|另外|分别按|先.*再|同时(?:增加|删除)|再问|为什么|另一(?:个)?项目/.test(t)))return;
  if(clauses.slice(0,-1).some(c=>/谁|哪|多少|怎么|是否|能否/.test(c) && removeQueryWords(c)))return;
  const counts=sampleFailureRate(setup,changes);
  if(!counts)return;
  const {success,dnf,dns,empty,attempts,percent}=counts;
  const prior=changes.length?sampleFailureRate(setup,changes.slice(0,-1)):undefined;
  const change=prior && prior.attempts===attempts?'分母不变。':'';
  return change+'成功 '+success+' 把、DNF '+dnf+' 把，实际尝试 '+success+' + '+dnf+' = '+attempts+' 把。DNS '+dns+' 把和空槽 '+empty+' 个不计入分母。'+
    (percent===null?'没有实际尝试，比例未定义。':'DNF 率为 '+dnf+' / '+attempts+' = '+percent.toFixed(2)+'%。')+
    (/负数/.test(query)?'计数均非负，有定义的 DNF 率最低为 0%。':'');
}

function threeEventRanks(setup:string,changes:readonly string[]) {
  const three=setup.match(/只选三项.{0,14}第(\d+)[、,]第(\d+)[,。]第三项没成绩有(\d+)人上榜/);
  if(!three)return;
  const initial=three.slice(1).map(Number);
  if(!initial.every(n=>Number.isSafeInteger(n)&&n>0))return;
  const first=initial[0];
  let second=initial[1],field=initial[2],selected=true;
  const initialSum=first+second+field+1;
  for(const change of changes){
    const grow=change.match(/第三项.{0,10}(?:进来|增加)([一二两三四五六七八九]|\d+)人/);
    const rank=change.match(/第二项从(\d+)(?:升|降)(?:到)?第(\d+)/);
    if(grow){
      const delta=Number(grow[1]) || '零一二三四五六七八九'.indexOf(grow[1].replace('两','二'));
      if(!(delta>0))return;
      field+=delta;
    }else if(rank && +rank[1]===second && +rank[2]>0)second=+rank[2];
    else if(/取消勾选(?:它|第三项)/.test(change) && /第三项/.test(change))selected=false;
    else if(!selected && /选回来/.test(change) && /撤[回销].{0,12}(?:多|增加).{0,7}人/.test(change)){
      if(changes.filter(c=>/进来|增加/.test(c)).length!==1)return;
      selected=true;
      field=initial[2];
    }else return;
  }
  const penalty=selected?field+1:0;
  return {initialRanks:[initial[0],initial[1],initial[2]+1],initialSum,first,second,field,penalty,selectedCount:selected?3:2,sum:first+second+penalty,changeSinceFirst:first+second+penalty-initialSum};
}

export function rankSumExample(turns:readonly string[],page:Page):string|undefined {
  if(page.href!=='/wca/about/sum-of-ranks' || !/参赛人数\s*\+\s*1/.test(page.text))return;
  const [setup,...changes]=turns.map(q=>q.normalize('NFKC').replace(/\s/g,''));
  if(!setup || !changes.length)return;
  const last=changes[changes.length-1];
  // Render only scalar comparisons whose fields are all available in state.
  if(!/^(?:第二项从\d+(?:升|降)(?:到)?第\d+[,。](?:其[余他](?:都)?(?:留着|不变|照旧))[。,.])?(?:新的?)?总和(?:以及|和|、)相对(?:第[一1]版|首版)的差(?:都要|是多少|各是多少)[.。?]?$/.test(last))return;
  const state=threeEventRanks(setup,changes);
  if(!state)return;
  const delta=state.changeSinceFirst;
  return '当前三项分别计 '+state.first+'、'+state.second+' 和 '+state.penalty+'，总和为 '+state.sum+'。第三项仍无成绩，按 '+state.field+' 人加 1 计。首版总和 '+state.initialSum+'，本版'+(delta===0?'与首版相同':(delta>0?'多 ':'少 ')+Math.abs(delta))+'。';
}

// Supply checked operands to the guide reader without treating a calculation
// as a complete answer to a potentially multipart question.
export function guideScenarioCalculations(turns: readonly string[], page: Page): string | undefined {
  const [setup, ...changes] = turns.map(t => t.normalize('NFKC').replace(/\s/g, ''));
  if (!setup) return;
  if (page.href==='/wca/about/dnf_rate_by_event' && page.text.includes('NOT IN (-2, 0)')) return JSON.stringify(sampleFailureRate(setup,changes));
  if (changes.some(t=>/不要|不再是|不(?:增加|加上|旋转)|先.{0,20}再|同时(?:改|加)/.test(t.replace(/要不要/g,'是否要')))) return;
  if (page.href==='/recon-about' && /TPS/i.test(page.text)) {
    const times=setup.match(/(?:一共|总计)(\d+)步(\d+(?:\.\d+)?)秒[,。]F2L(?:是|用)(\d+)步(\d+(?:\.\d+)?)秒/i);
    if(!times)return;
    let [,moves,seconds,stageMoves,stageSeconds]=times.map(Number);
    for(const change of changes){
      const stage=change.match(/F2L计时(?:更正为|改成)(\d+(?:\.\d+)?)秒/i);
      const total=change.match(/总时长(?:更正成|改成)(\d+(?:\.\d+)?)秒/);
      const count=change.match(/总步数(?:实际|改成)(\d+)/);
      if(stage)stageSeconds=+stage[1];
      else if(total)seconds=+total[1];
      else if(count)moves=+count[1];
      else if(/撤销F2L的计时改动/i.test(change) && changes.filter(t=>/F2L计时(?:更正为|改成)/i.test(t)).length===1)stageSeconds=+times[4];
      else return;
    }
    if(!(seconds>stageSeconds && stageSeconds>0 && moves>=stageMoves))return;
    const rate=(m:number,t:number)=>Number((m/t).toFixed(4));
    const previous=changes.length?guideScenarioCalculations(turns.slice(0,-1),page):undefined;
    const before=previous?JSON.parse(previous):undefined;
    const totalTPS=rate(moves,seconds),F2LTPS=rate(stageMoves,stageSeconds),remainingTPS=rate(moves-stageMoves,seconds-stageSeconds);
    return JSON.stringify({totalTPS,F2LTPS,remainingTPS,remainingMoves:moves-stageMoves,remainingSeconds:seconds-stageSeconds,
      changeSincePrevious:before?{total:totalTPS-before.totalTPS,F2L:F2LTPS-before.F2LTPS,remaining:remainingTPS-before.remainingTPS}:undefined});
  }
  if (page.href === '/wca/about/wr_metric' && /BAo5.*至少 3 次有效/.test(page.text) && /WPA.*worst 3/i.test(page.text)) {
    const sample=setup.match(/(?:成绩|依次为|五次是|五把是)(\d+(?:\.\d+)?(?:[、,]\d+(?:\.\d+)?){4})秒/);
    if (!sample) return;
    const values=sample[1].split(/[、,]/).map(Number);
    if (values.some(v=>!Number.isFinite(v) || v<=0)) return;
    const mean=(a:number[])=>Number((a.reduce((x,y)=>x+y,0)/a.length).toFixed(2));
    const revisions=values.map(()=>[] as number[]);
    const metrics=()=>{
      const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
      const firstFour=values.slice(0,4).sort((a,b)=>a-b);
      return {Mo5:sorted.length===5?mean(sorted):null, BAo5:sorted.length>=3?mean(sorted.slice(0,3)):null, WAo5:sorted.length===5?mean(sorted.slice(-3)):null,
        BPA:firstFour.every(Number.isFinite)?mean(firstFour.slice(0,3)):null, WPA:firstFour.every(Number.isFinite)?mean(firstFour.slice(1)):null};
    };
    let previous=metrics();
    for (const turn of changes) {
      previous=metrics();
      const replacement=turn.match(/把(\d+(?:\.\d+)?)改(?:成|为)?(\d+(?:\.\d+)?)/);
      const ordinal=turn.match(/(?:第([一二三四五1-5])把|最后[一那]把|末把)(?:原来[^。?]{0,12}那次是|(?:改(?:成|为)|是))?(DNF|\d+(?:\.\d+)?)(?:秒|[,.。?]|$)/i);
      const undo=turn.match(/撤[回销]第([一二三四五1-5])把的(?:改动|更正)/);
      const index=(s:string)=>Number(s) ? Number(s)-1 : '一二三四五'.indexOf(s);
      if(undo){
        const slot=index(undo[1]), prior=revisions[slot].pop();
        if(prior===undefined)return;
        values[slot]=prior;
      } else if(ordinal || replacement) {
        let slot:number, value:number;
        if(ordinal){
          slot=ordinal[1]?index(ordinal[1]):4;
          value=/dnf/i.test(ordinal[2])?Infinity:Number(ordinal[2]);
        } else {
          const label=Number(replacement![1]);
          if(values.filter(v=>v===label).length!==1)return;
          slot=values.indexOf(label);
          value=Number(replacement![2]);
        }
        if(!(value>0))return;
        revisions[slot].push(values[slot]);
        values[slot]=value;
      } else if(/(?:最后[一那]把|第五把)(?:改成|是)?DNF/i.test(turn)){
        revisions[4].push(values[4]);
        values[4]=Infinity;
      } else if(!/只看前四把|忽略第五把/.test(turn)) return;
    }
    return JSON.stringify({attempts:values.map(v=>Number.isFinite(v)?v:'DNF'),previous,current:metrics(),unit:'秒，null 表示不成立。BPA/WPA只使用前四把。'});
  }
  if (page.href === '/wca/about/sum-of-ranks' && /参赛人数\s*\+\s*1/.test(page.text)) {
    // A missing event's fallback rank follows the ranked field size, even
    // when a different event is edited or the event is deselected and restored.
    const state=threeEventRanks(setup,changes);
    if(state)return JSON.stringify(state);
    const a = setup.match(/\bA排(?:第)?(\d+)/i);
    const b = setup.match(/\bB有(\d+)(?:位|人).{0,10}(?:我没有|我没成绩|我无排名)/i);
    if (!a || !b || !Number.isSafeInteger(+a[1]) || +a[1]<1 || !Number.isSafeInteger(+b[1]) || !/只选(?:两|2)个项目/.test(setup)) return;
    const missing = Number(b[1]) + 1;
    let rank = missing;
    let selectedA = true;
    let prior = Number(a[1]) + missing;
    for (const turn of changes) {
      const next = turn.match(/B(?:现在)?(?:有了|排|是)(?:第)?(\d+)/i);
      prior = Number(a[1]) * Number(selectedA) + rank;
      if (next && Number.isSafeInteger(+next[1]) && +next[1]>0) rank = Number(next[1]);
      else if (/取消勾选A/i.test(turn)) selectedA = false;
      else return;
    }
    const sum = Number(selectedA)*Number(a[1]) + rank;
    return '缺项时B的替代名次='+b[1]+'+1='+missing+'。本版选中A='+selectedA+'，A名次='+a[1]+'，B计入='+rank+'，总和='+sum+'。上一版总和='+prior+'，减少量='+(prior-sum)+'。';
  }
  if (page.href === '/mosaic-about' && page.text.includes('原图像素再高也不能突破这个网格')) {
    const order = setup.match(/([二三四五六七2-7])阶/);
    const dims=setup.match(/(\d{1,4})(行|列)[、,]?(\d{1,4})(行|列)/);
    if(!dims || dims[2]===dims[4] || !order)return;
    let rows=Number(dims[dims[2]==='行'?1:3]),columns=Number(dims[dims[2]==='列'?1:3]);
    const orderValue=(s:string)=>Number(s) || '一二三四五六七'.indexOf(s)+1;
    let n=orderValue(order[1]);
    if(!rows || !columns)return;
    const initial={rows,columns,n};
    let beforeRows=rows,beforeColumns=columns,beforeOrder=n;
    const rowAdds:number[]=[];
    for(const turn of changes){
      beforeRows=rows;beforeColumns=columns;beforeOrder=n;
      const added=turn.match(/(?:再铺|加上|增加|加)(\d{1,4})([行列])/) ?? turn.match(/(行|列)数增加(\d{1,4})/);
      const nChange=turn.match(/(?:换成|换为)([二三四五六七2-7])阶/);
      const strip=turn.match(/(?:最右|最左|顶部|底部)([一二两三四五六七八九]|\d{1,4})(行|列)(?:整个)?拿掉/);
      const restore=turn.match(/把([一二两三四五六七八九]|\d{1,4})(行|列)加回来/);
      const rotate=/转(?:了)?(?:90|270)度|转一个直角/.test(turn);
      const order=turn.match(/(?:改回|改成)([二三四五六七2-7])阶/);
      if(strip || restore){
        const [,label,axis]=(strip ?? restore)!;
        const amount=Number(label) || '一二三四五六七八九'.indexOf(label.replace('两','二'))+1;
        const delta=(strip?-1:1)*amount;
        if(axis==='行')rows+=delta;
        else columns+=delta;
        if(rows<1 || columns<1)return;
      } else if(rotate && order){
        [rows,columns]=[columns,rows]; n=orderValue(order[1]);
      } else if(added){
        const axis=/^[行列]$/.test(added[1])?added[1]:added[2];
        const count=Number(axis===added[1]?added[2]:added[1]);
        if(axis==='行'){rows+=count;rowAdds.push(count);}
        else columns+=count;
      } else if(/加的.{1,4}行.{0,3}撤掉/.test(turn) && /多放一列/.test(turn) && rowAdds.length===1){
        rows-=rowAdds.pop()!;
        columns++;
      } else if(nChange)n=orderValue(nChange[1]);
      else if(/旋转(?:了)?(?:90|270)度|转一个直角/.test(turn))[rows,columns]=[columns,rows];
      else if(!/原(?:照)?片|原图/.test(turn) || !/放大|翻倍|缩小/.test(turn))return;
    }
    if (/可见色块/.test(setup)) {
      const cubes=rows*columns, prior=beforeRows*beforeColumns, original=initial.rows*initial.columns;
      const compare=(before:number)=>cubes===before?'不变':(cubes>before?'增加':'减少')+Math.abs(cubes-before)+' 颗';
      return '当前 '+rows+' 行 × '+columns+' 列，共 '+cubes+' 颗；横宽 '+columns*n+' 格、纵高 '+rows*n+' 格，可见色块共 '+cubes*n*n+' 格。与上一版相比，颗数'+compare(prior)+'；与第一版相比，颗数'+compare(original)+'。';
    }
    return '当前布局：'+rows+'行×'+columns+'列，共'+(rows*columns)+'颗；横宽'+columns*n+'格、纵高'+rows*n+'格。相对上轮颗数增加'+(rows*columns-beforeRows*beforeColumns)+'，横向增加'+(columns*n-beforeColumns*beforeOrder)+'格，纵向增加'+(rows*n-beforeRows*beforeOrder)+'格。相对首版多'+(rows*columns-initial.rows*initial.columns)+'颗，横宽差'+(columns*n-initial.columns*initial.n)+'格、纵高差'+(rows*n-initial.rows*initial.n)+'格。原照片分辨率不改变布局。';
  }
}

// Badge thresholds use different units. Validate the source condition and
// the complete change of premise before rendering a deterministic response.
export function badgeCountScenario(turns: readonly string[], page: Page): string | undefined {
  if(page.href!=='/wca/achievements')return;
  const [setup,...changes]=turns.map(q=>q.normalize('NFKC').replace(/\s/g,''));
  if (!setup) return;
  const last=changes.at(-1) ?? setup;
  if(changes.length===1 && /百赛选手/.test(setup) && page.text.includes('DNF 计入参赛，只有 DNS 的比赛不计')) {
    const base=setup.match(/(?:我有|已有)(\d+)场正式比赛[。,.]第(\d+)场[^。?]{0,18}(?:全是|全部|都是)DNS/i);
    const corrected=/^(?:把|如果把)?(?:上一场|那场|上场)(?:的)?(?:一个|一项)DNS(?:改判|改成|改为)(?:了)?DNF[,。](?:其他|其余)[^。?]{0,6}(?:没出场|是DNS|仍是DNS)[。,.](?:这回|现在)?(?:总数|场数)和徽章(?:呢|怎样|怎么样)?\?$/i;
    if(base && +base[2]===+base[1]+1 && corrected.test(last)) {
      const total=Number(base[1])+1;
      return '这场有一项 DNF，符合参赛计数条件；其余 DNS 不再使整场被排除。'+base[1]+' + 1 = '+total+' 场，'+(total>=100?'达到':'未达到')+'百赛选手的100场门槛。';
    }
  }
  if(changes.length===1 && /常青树/.test(setup) && page.text.includes('DNF 计入，DNS 不计')) {
    const range=setup.match(/(\d{4})(?:年)?(?:到|至)(\d{4})[^。?]{0,8}每年都(?:有|取得)正式有效成绩/);
    const years=last.match(/^(?:如果|若)(\d{4})年?(?:唯一一项是|只有)DNF,(\d{4})年?也只有DNF,到(\d{4})年底几连[,、]点亮哪档\?$/i);
    const limits=page.text.match(/常青树\s+连续至少 ([\d／]+) 个自然年正式参赛/);
    if(range && years && limits && +range[1]<=+range[2] && +years[1]===+range[2]+1 && +years[2]===+years[1]+1 && years[2]===years[3]) {
      const length=+years[2]-Number(range[1])+1;
      const tier=limits[1].split('／').map(Number).filter(n=>n<=length).at(-1);
      return '这两年都是 DNF，均计入参赛。'+range[1]+' 至 '+years[2]+' 年含首尾，共连续 '+length+' 年，'+(tier?'达到 '+tier+' 年档。':'尚未达到第一档。');
    }
  }
  if(!page.text.includes('多盲每次尝试计一次'))return;
  const source=page.text.match(/累计成功复原至少 ([\d／]+) 次。DNF、DNS 不计/);
  const counts=setup.match(/^万次复原[,：:]?我(?:已有|已经有)(\d{1,7})次[。,.]本场普通项目成功(一次|\d+次)[,、]还有(?:一把)?多盲(一次|\d+次)尝试里全对(\d+)个[。,.](?:现在)?累计多少[,、]离门槛(?:还差多少|呢)\?$/i);
  if(!counts || !source || +counts[4]<1)return;
  const attempts=(s:string)=>s==='一次'?1:parseInt(s,10);
  const normal=attempts(counts[2]), multi=attempts(counts[3]);
  if(!Number.isSafeInteger(normal) || !Number.isSafeInteger(multi) || !normal || !multi)return;
  if(turns.slice(1).some(q=>!/^在这之后只加(?:一次|\d+次)DNF和(?:一次|\d+次)DNS[。.]能用它们补这最后一步吗[，,]累计多少[？?]$/i.test(q)))return;
  const total=Number(counts[1])+normal+multi;
  const tiers=source[1].split('／').map(Number);
  const next=tiers.find(n=>n>total);
  const met=tiers.filter(n=>n<=total).at(-1);
  return '按成功尝试计，每次多盲成功计一次。'+counts[1]+' + '+normal+' + '+multi+' = '+total+' 次。'+
    (turns.length>1?'新增的 DNF 和 DNS 都不增加成功数。':'')+
    (met?'已达到 '+met+' 次档。':'')+(next?'距 '+next+' 次档还差 '+(next-total)+' 次。':'');
}

export function guideComparisonScenario(turns: readonly string[], page: Page): string | undefined {
  const q=turns.at(-1)!.normalize('NFKC').replace(/\s/g,'');
  if(page.href==='/wca/about/best_potential_fmc_mean' && page.text.includes('三个 slot 的最佳可能来自三个不同的人')) {
    const slots=q.match(/(?:槽位|位置)的全场(?:最少|最低)步数(?:是|为)(\d{1,3})[、,](\d{1,3})[、,](\d{1,3})/);
    if(slots && slots.slice(1).every(n=>+n>0) && /[。.]结果是多少步[,、]这一定是某位选手的正式平均吗\?$/.test(q)
      && !/更正|排除|另外|如果|还要|忽略|不是|[?].+/.test(q)) {
      const sum=slots.slice(1).reduce((a,v)=>a+Number(v),0);
      return '潜在平均为 ('+slots.slice(1).join(' + ')+') ÷ 3 = '+Number((sum/3).toFixed(2))+' 步。三个槽位的最低值可以来自不同选手；仅凭这些数值无法确定是否恰好有人实际做出该平均。';
    }
    const other=q.match(/^第[三3]槽恢复(\d{1,3}),但来自另一轮。能借它拼平均吗\?要怎样的\1才算\?$/);
    if(other && +other[1]>0)return '不能借其他轮次的成绩。要用 '+other[1]+' 步作第三槽的值，它必须是同一场比赛、同一轮、第三次尝试的全场最低有效步数；若同槽有人更少，就取更少的值。';
  }
  if(page.href==='/wca/about/cohort-ranks' && page.text.includes('同分并列同名次') && page.text.includes('不是世界总榜上的排位')) {
    const tied=/同届(?:另一个人|另一位).{0,8}(?:单次|平均).{0,5}(?:同速|相同|同分)/;
    if(tied.test(q) && /(?:可[以否]|能否)并列吗?\?.{0,15}(?:世界|全球)第一吗?\?$/.test(q) && !/如果|除外|另外还/.test(q))return '同届、同项目、同成绩类型且成绩相同，两人可以并列。即使同为该届第一，其他届别也可能有人更快，因此不能由此断定世界第一。';
    const change=q.match(/^另一位(?:原来|实际是)?(\d{4})年?才首次参赛。现在还能说他俩在同一届并列吗\?速度相同这个事实会改变吗\?$/);
    if(change && turns.slice(0,-1).some(t=>tied.test(t))) {
      const firstYears=turns.slice(0,-1).flatMap(t=>[...t.matchAll(/(\d{4})年?才第一次正式参赛/g)].map(m=>m[1]));
      const first=firstYears.at(-1);
      if(first)return '两人的首参赛年分别为 '+first+' 和 '+change[1]+'。'+(first===change[1]?'同届，同项目同类型同成绩可并列。':'分属不同届别，不能在同一届内并列。')+'更正首参赛年不改变两人的成绩，速度仍相同。';
    }
  }
  if(page.href==='/scramble/gen-about' && page.text.includes('输入给已有打乱配图、排版对应项目，每行一条打乱') &&
    /只给(?:原来|已有|现成)(?:那些|的)?配图并印出来要切回哪个模式[,、]项目能不核对吗\?$/.test(q) && !/[?].+只给|另外还|顺便/.test(q))
    return '切回输入模式，选择这些原打乱对应的项目，每行贴一条，只给这批打乱配图，再预览并导出 PDF。核对项目才能让图与打乱对应。';
}

// A correction edits one recorded podium rather than adding a second
// version of it. Derive the totals from the final set of eligible entries.
export function podiumScenario(turns: readonly string[], page: Page): string | undefined {
  const [setup,...changes]=turns.map(t=>t.normalize('NFKC').replace(/\s/g,''));
  if(!changes.length || !setup)return;
  if(page.href==='/wca/about/most_podiums_together' && page.text.includes('决赛 + pos ≤ 3 + best > 0')) {
    const original=setup.match(/^共同登台(?:表|榜)里?同场([^。?]+)。(?:这场我们增加几次\?哪项有贡献\?)$/);
    if(!original)return;
    const entries=new Map<string,{partner:string;mine:number;theirs:number;final:boolean;sameCompetition:boolean}>();
    const position=(s:string)=>Number(s) || '一二三四五六七八九'.indexOf(s)+1;
    for(const part of original[1].split(/[,、]/)) {
      const row=part.match(/^([二三四五六七]阶)决赛我第([一二三四五六七八九1-9])([\p{Script=Han}]{1,5})第([一二三四五六七八九1-9])$/u);
      if(!row || entries.has(row[1]))return;
      entries.set(row[1],{mine:position(row[2]),partner:row[3],theirs:position(row[4]),final:true,sameCompetition:true});
    }
    if(new Set([...entries.values()].map(e=>e.partner)).size!==1)return;
    for(const turn of changes){
      const event=/(?:更正.{1,5}|那如果我们|^)([二三四五六七]阶)/.exec(turn);
      const entry=event && entries.get(event[1]);
      if(!entry)return;
      const rank=turn.match(/^更正(.{1,5})[二三四五六七]阶也?是?第([一二三四五六七八九1-9]),[二三四五六七]阶不动。/);
      if(rank && rank[1]===entry.partner)entry.theirs=position(rank[2]);
      else if(/名次发生在半决赛,决赛都没进/.test(turn))entry.final=false;
      else if(turn.includes(entry.partner+'的第') && /是(?:隔天)?另一场比赛的/.test(turn))entry.sameCompetition=false;
      else return;
    }
    if(!/(?:同一场能出现第二次计数吗\?现在合计多少|就这几条资料,我们有共同登台吗)\?$/.test(changes.at(-1)!))return;
    const eligible=[...entries].filter(([,e])=>e.final && e.sameCompetition && e.mine<=3 && e.theirs<=3).map(([event])=>event);
    return '同一比赛的不同项目分别计数，每个项目要求两人在同一场的该项目决赛共同登台。'+(eligible.length?'符合的项目为'+eligible.join('、')+'，合计 '+eligible.length+' 次。':'这些记录中没有符合条件的共同登台，合计 0 次。');
  }
  if(page.href==='/wca/achievements' && page.text.includes('与同一选手共同登上项目领奖台')) {
    const starting=setup.match(/^我有(\d{1,6})次和同一个人一起上台,下一次跟另一位新搭档获奖。并肩登台/);
    const limits=page.text.match(/与同一选手共同登上项目领奖台至少 ([\d／]+) 次/);
    if(!starting || !limits)return;
    let originalCount=Number(starting[1]), added=0;
    let originalOnPodium=false,newOnPodium=true,onPodium=true;
    for(const turn of changes) {
      if(/那次.*两位搭档都在领奖台,我也在/.test(turn))originalOnPodium=newOnPodium=onPodium=true;
      else if(/那次我自己第四,两位搭档仍是前三/.test(turn))onPodium=false;
      else {
        const more=turn.match(/^之后我和原搭档又一起登台(两|\d{1,5})次,新搭档没上/);
        if(!more)return;
        added+=more[1]==='两'?2:Number(more[1]);
      }
    }
    if(!/(?:两对的累计数分别回到多少|我的两组次数和最高已达档次各是多少)\?$/.test(changes.at(-1)!))return;
    originalCount+=added+Number(onPodium && originalOnPodium);
    const newCount=Number(onPodium && newOnPodium);
    const tier=(n:number)=>{const met=limits[1].split('／').map(Number).filter(x=>n>=x).at(-1);return met?'已达 '+met+' 次档':'尚未达到最低档';};
    return '你与原搭档共同登台 '+originalCount+' 次，'+tier(originalCount)+'；你与新搭档共同登台 '+newCount+' 次，'+tier(newCount)+'。改判的那次按最终名次只核算一次。';
  }
}

// Emit computed values without passing them through another arithmetic step,
// only when all requested outputs belong to the supported operation.
function changesAreDimensions(request:string):boolean {
  return /宽高|横竖/.test(request) && !request.replace(/最终|现在|可见|第一版|色块|总数|颗数|宽高|横竖|要不要|多买|变没变|还有|多少|分别|以及|[、,和与比呢?]/g,'');
}

export function dimensionOrSpeedAnswer(turns:readonly string[],page:Page):string|undefined {
  const q=turns.at(-1)?.normalize('NFKC').replace(/\s/g,'');
  if(!q || /如果|另问|再问|为什么|假如/.test(q))return;
  const parts=q.split(/[。?]/).filter(Boolean);
  const question=parts.at(-1)??'';
  const request=q.split(/[。?,]/).filter(c=>/宽高|横竖|要不要多买|和第一版比/.test(c)).join('');
  if(page.href==='/mosaic-about' && changesAreDimensions(request) && /可见色块/.test(turns[0]) &&
     q.split(/[。?,]/).every(c=>!c || changesAreDimensions(c) || /^(?:还是|刚才|把每颗都换成|再把整幅转|和第一版比颗数变没变|要不要多买颗数)/.test(c))){
    const summary=guideScenarioCalculations(turns,page);
    if(summary?.includes('可见色块共'))return summary;
  }
  if(page.href==='/mosaic-about' && parts.length<=3 &&
    /^(?:(?:总颗数会跟着变吗,)?横竖分别变几格|现在横宽、纵高、总颗数[,、]以及比最初多的颗数)$/.test(question) &&
    parts.slice(0,-1).every(c=>/^(?:保持刚才\d+列\d+行[,、]但把每颗换成[二三四五六七2-7]阶|总颗数会跟着变吗|把版面转一个直角[,、]继续用刚才的阶数)$/.test(c))){
    return guideScenarioCalculations(turns,page);
  }
  if(page.href==='/recon-about' && parts.length===2 &&
     /^数步的人也改了[:：]总步数实际\d+[,、]F2L仍\d+$/.test(parts[0]) && /^余段有几步、几秒和多少TPS$/i.test(question)){
    const raw=guideScenarioCalculations(turns,page);
    if(!raw)return;
    const state=JSON.parse(raw);
    return '扣除 F2L 后，余段 '+state.remainingMoves+' 步、'+state.remainingSeconds+' 秒，速度为 '+state.remainingMoves+' ÷ '+state.remainingSeconds+' = '+state.remainingTPS+' TPS。';
  }
}

export function frameRateComparison(turns:readonly string[],page:Page):string|undefined {
  if(page.href!=='/frame-count-about' || !page.text.includes('固定帧率相邻帧间隔'))return;
  const [setup,...changes]=turns.map(q=>q.normalize('NFKC').replace(/\s/g,''));
  const base=setup?.match(/^恒定(\d+(?:\.\d+)?)fps,起点(\d+)帧,终点(\d+)帧[。,.]/i);
  const current=changes.pop()??'';
  const question=current.match(/^(?:帧率|FPS)(?:改成|换成|改为|调至)(\d+(?:\.\d+)?)fps[,。](?:两个)?标记(?:还在原位置|不动|保持不变)。/i);
  if(!question)return;
  const asks=current.slice(question[0].length).replace(/(?:用时|耗时|时间|和|跟|与|首版|最初|比|少|多|差|多少|几|秒|帧差|改不改|变了吗|变没变|还|呢|[?,。])/g,'');
  if(asks || !/用时|耗时|时间/.test(current) || !/首版|最初/.test(current))return;
  if(!base || Number(base[1])<=0 || Number(question[1])<=0)return;
  let start=Number(base[2]),end=Number(base[3]);
  const oldEnd:number[]=[];
  for(const change of changes){
    const shift=change.match(/^终点误标了,往(前|后)挪(\d+)帧,起点不动[。,.]/);
    const undo=change.match(/^撤回对终点的移动[;；]只改起点,变成第(\d+)帧[。,.]/);
    if(shift){oldEnd.push(end);end+=(shift[1]==='前'?-1:1)*Number(shift[2]);}
    else if(undo && oldEnd.length){end=oldEnd.pop()!;start=Number(undo[1]);}
    else return;
    if(start<0 || end<start)return;
  }
  const frames=end-start,initial=(Number(base[3])-Number(base[2]))/Number(base[1]);
  if(initial<0)return;
  const seconds=frames/Number(question[1]),delta=seconds-initial;
  const fmt=(v:number)=>Number(v.toFixed(6));
  return '起点 '+start+' 帧，终点 '+end+' 帧，帧差仍为 '+frames+'。更换帧率只改变每个间隔的用时。当前 '+frames+' ÷ '+question[1]+' = '+fmt(seconds)+' 秒；首版 '+fmt(initial)+' 秒，'+(delta===0?'两者相同。':('本版'+(delta>0?'多 ':'少 ')+fmt(Math.abs(delta))+' 秒。'));
}

export function consecutivePrExample(turns:readonly string[],page:Page):string|undefined {
  if(page.href!=='/wca/achievements')return;
  const tiers=page.text.match(/突破不停\s+连续 ([\d／]+) 场正式比赛取得至少一项 PR，包含追平/);
  const [setup,...changes]=turns.map(q=>q.normalize('NFKC').replace(/\s/g,''));
  const first=setup?.match(/已经([一二三四五六七八九]|\d+)连,新站只追平一项平均,没有更快的单次/);
  if(!tiers || !first || !changes.length)return;
  const numeric=(s:string)=>/^\d+$/.test(s)?Number(s):'零一二三四五六七八九'.indexOf(s.replace('两','二'));
  const length=numeric(first[1]);
  if(length<=0 || length>500)return;
  const competitions:boolean[]=Array(length).fill(true);
  competitions.push(true);
  const streak=()=>competitions.length-1-competitions.lastIndexOf(false);
  const bounds=tiers[1].split('／').map(Number);
  let prior=streak();
  for(const change of changes){
    prior=streak();
    if(/^(?:追平那项被撤了|撤销那项追平),新站再无任何PR[。,.]/i.test(change))competitions[length]=false;
    else if(/^如果撤销刚才取消追平的决定,让那站仍算有PR,后两场仍有效[。,.]/i.test(change))competitions[length]=true;
    else if(/^最后一场只是又录入倒数第二场的另一项目[。,.]/.test(change)){
      if(competitions.length<length+3 || !competitions.at(-1) || !competitions.at(-2))return;
      competitions.pop();
    }else{
      const more=change.match(/^随后([一二两三四五六七八九]|\d+)场分别各刷新一个单次[,。]/);
      if(!more || numeric(more[1])>500)return;
      competitions.push(...Array<boolean>(numeric(more[1])).fill(true));
    }
  }
  if(!/^最后一场只是又录入倒数第二场的另一项目。比赛数去重后当前几连\?离下档的差跟刚才比怎样变\?$/.test(changes[changes.length-1]))return;
  const current=streak(),next=bounds.find(x=>x>current),oldNext=bounds.find(x=>x>prior);
  if(!next || !oldNext)return;
  const diff=(next-current)-(oldNext-prior);
  return '同场不同项目只计一场。去重前 '+prior+' 连，到 '+oldNext+' 连差 '+(oldNext-prior)+' 场；去重后 '+current+' 连，到 '+next+' 连差 '+(next-current)+' 场。距离比上版'+(diff===0?'相同':(diff>0?'增加 ':'减少 ')+Math.abs(diff)+' 场')+'。';
}

export function revisedPersonalBest(turns:readonly string[],page:Page):string|undefined {
  if(page.href!=='/wca/about/wr_non_pr' || !/此前|之前|历史/.test(page.text) || !page.text.includes('PB') || turns.length!==2)return;
  const [setup,change]=turns.map(q=>q.normalize('NFKC').replace(/\s/g,''));
  const first=setup.match(/原PB是(\d+(?:\.\d+)?),之后同项目单次依次(\d+(?:\.\d+)?)[、,](\d+(?:\.\d+)?)[。,.]/i);
  const revised=change.match(/^把第一把(\d+(?:\.\d+)?)改成(\d+(?:\.\d+)?),第二把仍是(\d+(?:\.\d+)?)。两把谁现在是non-PR\?新的个人最佳是多少\?$/i);
  if(!first || !revised || +first[2]!==+revised[1] || +first[3]!==+revised[3])return;
  let pb=+first[1];
  if(pb<=0 || +revised[2]<=0 || +revised[3]<=0)return;
  const answers=[+revised[2],+revised[3]].map((n,i)=>{
    const verdict=n>pb?'严格慢于当时 PB，属于 non-PR':n===pb?'追平 PB，不属于 non-PR':'快于当时 PB，刷新个人最佳';
    pb=Math.min(pb,n);
    return '第'+(i+1)+'把 '+n+' 秒'+verdict;
  });
  return answers.join('。')+'。最终单次 PB 为 '+pb+' 秒。';
}

export function recordTierExample(turns:readonly string[],page:Page):string|undefined {
  if(page.href!=='/wca/about/most_records_at_single_competition' || !page.text.includes('single + average 各 1 个') ||
     !page.text.includes('Continental 把所有 CR(含 WR'))return;
  const [setup,...changes]=turns.map(q=>q.normalize('NFKC').replace(/\s/g,''));
  const entries=[...setup.matchAll(/([一二两三四五六七八九]|\d+)条(NR|洲际纪录|CR|WR)/gi)];
  const counts={national:0,continental:0,world:0};
  if(entries.length!==3 || /除了|不含|其中|跨场|其中含/.test(setup))return;
  for(const [,n,label] of entries){
    const count=Number(n)||'零一二三四五六七八九'.indexOf(n.replace('两','二'));
    if(count<=0 || !Number.isSafeInteger(count))return;
    counts[/^NR$/i.test(label)?'national':/^WR$/i.test(label)?'world':'continental']+=count;
  }
  if(!counts.national || !counts.continental || !counts.world)return;
  const totals=()=>[counts.world,counts.world+counts.continental,counts.world+counts.continental+counts.national];
  const initial=totals();
  let upgraded=false,extraAverage=false;
  for(const q of changes){
    if(/^把其中一条NR升级成WR,还是同一个成绩[。,.]/i.test(q) && counts.national>0 && !upgraded){
      counts.national--; counts.world++;upgraded=true;
    }else if(/^刚才升级那条其实属于另一场,整条移走[。,.]/.test(q) && upgraded){
      counts.world--;upgraded=false;
    }else if(/^原站还漏了一条平均WR,原来的WR是单次,同一轮[。,.]/i.test(q) && !extraAverage){
      counts.world++;extraAverage=true;
    }else if(/^撤销最后补的平均WR,保留跨场移走的那条[。,.]/i.test(q) && extraAverage){
      counts.world--;extraAverage=false;
    }else return;
  }
  const asks=(changes.at(-1)??setup).split('。').at(-1)??'';
  if(!/^(?:只看原站,各层各剩下几条|能同时算吗\?现在三层分别多少)\?$/.test(asks) &&
     !/^(?:原站)?各层(?:分别|还)?(?:各)?(?:剩下)?多少条\?$/.test(asks))return;
  const current=totals();
  return (extraAverage?'同一轮的单次 WR 和平均 WR 是两条纪录，可以同时计入。':'')+
    '只看原站，剩下 '+counts.world+' 条 WR、'+counts.continental+' 条洲际纪录、'+counts.national+' 条 NR。World '+current[0]+' 条，Continental '+current[1]+' 条，National '+current[2]+' 条（首版分别为 '+initial.join('、')+' 条）。';
}
