// A calendar correction can recategorize a competition or merge two records.
// Use competition identities until the final grouping by month or week.
type Guide = { href: string; text: string };
function count(label: string): number {
  return /^\d+$/.test(label) ? Number(label) : '零一二三四五六七八九十'.indexOf(label.replace('两','二'));
}
function monthExample(setup: string, changes: string[], text: string): string | undefined {
  const limit = text.match(/HAVING[^\n]{0,80}>=\s*(\d+)/i);
  const start = setup.match(/我([一二三四五六七八九十\d]+)月在([一二三四五六七八九十\d]+)场不同比赛有成绩[,，]另有一场(\d{1,2})月(\d{1,2})日开赛/);
  if (!start || !limit) return;
  const localMonth = count(start[1]), initialCount = count(start[2]), originalMonth = +start[3], originalDay = +start[4];
  if (initialCount < 1 || initialCount > 100 || localMonth === originalMonth ||
      [localMonth,originalMonth].some(m => m < 1 || m > 12)) return;
  const rows = Array.from({length:initialCount}, (_,i) => i);
  let crossMonth = originalMonth, nextYear: number | undefined;
  const threshold = Number(limit[1]);
  for (const s of changes) {
    const change = s.split(/[。;；]/)[0];
    const moved = change.match(/开赛日是(\d+)月(\d+)日$/);
    const restored = change.match(/开赛日还原成(\d+)月(\d+)日/);
    const merged = change.match(/第([一二三四五六七八九十\d]+)场和第([一二三四五六七八九十\d]+)场.*同站不同项目/);
    const added = change.match(/隔年([一二三四五六七八九十\d]+)月.*去了([两一二三四五六七八九十\d]+)站/);
    if ([moved,restored,merged,added].filter(Boolean).length !== 1) return;
    if (moved && +moved[1] === localMonth) crossMonth = localMonth;
    else if (restored && +restored[1] === originalMonth && +restored[2] === originalDay) crossMonth = originalMonth;
    else if (merged) {
      const a = count(merged[1])-1, b = count(merged[2])-1;
      if (rows[a] === undefined || rows[b] === undefined || a === b) return;
      const mergedId = rows[b];
      rows.forEach((id,i) => { if (id === mergedId) rows[i]=rows[a]; });
    } else if (added && count(added[1]) === localMonth && nextYear === undefined) nextYear=count(added[2]);
    else return;
  }
  const n = new Set(rows).size + Number(crossMonth === localMonth);
  const describe = (label: string, size: number) => label+' '+size+' 场，'+(size >= threshold ? '已达门槛' : '距 '+threshold+' 场差 '+(threshold-size)+' 场');
  if (nextYear !== undefined) return '不同年份的同一个月分开统计。'+describe('前一年'+localMonth+'月',n)+'；'+describe('次年'+localMonth+'月',nextYear)+'。';
  return describe(originalMonth+'月',Number(crossMonth === originalMonth))+'；'+describe(localMonth+'月',n)+'。跨月赛按开赛日归月，同一比赛的多个项目只计一场。';
}

function weeklyExample(setup: string, changes: string[]): string | undefined {
  const pair = setup.match(/周日开赛周[一二三四五六日]收官的([甲乙丙丁])、下周一开赛的([甲乙丙丁])都公开有效/);
  if (!pair || pair[1] === pair[2]) return;
  const rows = new Map([[pair[1],{week:0,initial:0,status:'公开有效'}],[pair[2],{week:1,initial:1,status:'公开有效'}]]);
  for (const turn of changes) {
    const instruction = turn.split(/[。;；]/)[0].replace(/(?:可别|但别|不要).*$/, '');
    for (const clause of instruction.split(/[,，](?:同时|并且)/)) {
      const m = clause.match(/[甲乙丙丁]/);
      const row = m && rows.get(m[0]);
      if (!row) return;
      if (/撤销.*提前开幕/.test(clause)) row.week = row.initial;
      else if (/改成周日提前开幕/.test(clause)) row.week = 0;
      else if (/标为已取消/.test(clause)) row.status = '已取消';
      else if (/设为不公开/.test(clause)) row.status = '未公开';
      else if (/恢复成公开且未取消/.test(clause)) row.status = '公开有效';
      else return;
    }
  }
  const included = [...rows].filter(([,r]) => r.status === '公开有效');
  const byWeek = [0,1].map(i => included.filter(([,r]) => r.week === i).map(([id]) => id));
  const omitted = [...rows].filter(([,r]) => r.status !== '公开有效').map(([id,r]) => id+'因'+r.status+'排除');
  return byWeek.map((ids,i) => (i ? '下周一所在周' : '周日所在周')+' '+ids.length+' 场'+(ids.length ? '（'+ids.join('、')+'）' : '')).join('，')+'。各场按开赛日归周。'+(omitted.length ? omitted.join('，')+'。' : '');
}

export function attendanceBucketAnswer(turns: readonly string[], page: Guide): string | undefined {
  const [setup,...changes] = turns.map(t => t.normalize('NFKC').replace(/\s/g,''));
  if (!setup || !changes.length) return;
  const turn = changes.at(-1)!;
  // All questions after the change must ask for one of the values we render.
  const [, ...questions] = turn.split('。');
  const ask = questions.join('');
  const unknown = ask.replace(/自然月|去年|隔年|次年|今年|开赛日|门槛|场数|缺口|结果|两周|另一周|哪一周|周日|周一|按刚才|新日期|哪场|排掉|为什么|分别|计数|数|现在|接着|重报|差|过|还|各|离|几场|个月|多少|为零|呢|两个|把|的|报一下|和|可以|填|达到|改成什么|怎样|再|按周|吗|[一二三四五六七八九十0-9甲乙丙丁月,、。?]/g,'');
  if (!ask || unknown || !/周|月|门槛/.test(ask)) return;
  if (page.href === '/wca/about/most_attended_competitions_in_single_month' && page.text.includes('start_date')) return monthExample(setup,changes,page.text);
  if (page.href === '/wca/about/competitions_count_by_week' && page.text.includes('show_at_all')) return weeklyExample(setup,changes);
}

// Keep one record per competition so moving it to another region cannot
// duplicate its duration in the pooled mean.
export function regionDaysAnswer(turns:readonly string[], guide:Guide):string|undefined {
  if (guide.href!=='/wca/about/competition_days_count_by_region' || !guide.text.includes('end_date - start_date + 1')) return;
  const [setup,...changes]=turns.map(s=>s.normalize('NFKC').replace(/\s/g,''));
  const start=setup?.match(/([甲乙丙丁])地公开的两场是(\d+)月(\d+)日至(\d+)日、(\d+)月(\d+)日当天,([甲乙丙丁])地只办一场([两一二三四五六七八九\d]+)天赛。/);
  if (!start || start[1]===start[7]) return;
  const [,first,month,begin,end,month2,day2,second,other]=start;
  const daysInMonth=(m:number)=>[31,28,31,30,31,30,31,31,30,31,30,31][m-1]??0;
  if (+begin<1 || +end<+begin || +end>daysInMonth(+month) || +day2<1 || +day2>daysInMonth(+month2)) return;
  const initial=+end-+begin+1;
  const rows=[{place:first,days:initial},{place:first,days:1},{place:second,days:count(other)}];
  for (const turn of changes) {
    const clause=turn.split('。')[0];
    if (clause===first+'地第一场提前一天结束' && rows[0].days===initial && initial>1) rows[0].days--;
    else if (clause==='取消第一场提前结束的修改,但保留地点更正') rows[0].days=initial;
    else if (clause==='那场单日赛地点写错了,应该算到'+second+'地' && initial>1) rows[1].place=second;
    else {
      const revision=clause.match(/^([甲乙丙丁])地原来那场([一二两三四五六七八九\d]+)天赛其实是([一二两三四五六七八九\d]+)天赛$/);
      if (!revision || revision[1]!==second || count(revision[2])!==rows[2].days || count(revision[3])<1) return;
      rows[2].days=count(revision[3]);
    }
  }
  const ask=(changes.at(-1)??setup).split('。').slice(1).join('');
  if (!ask || ask.replace(/现在|两地|所有比赛|合起来的|按每场|还是按|两个地区|来算|各地|场数|和|平均|天数|是|多少|[?、,]/g,'')) return;
  const summary=[first,second].map(place=>{
    const days=rows.filter(r=>r.place===place).map(r=>r.days);
    return place+'地 '+days.length+' 场，平均 '+Number((days.reduce((a,b)=>a+b,0)/days.length).toFixed(2))+' 天';
  });
  const total=rows.reduce((sum,r)=>sum+r.days,0);
  return summary.join('；')+'。合并按每场计算，共 '+rows.length+' 场、'+total+' 个比赛日，平均 '+total+' ÷ '+rows.length+' ≈ '+Number((total/rows.length).toFixed(2))+' 天。';
}

export function monthBadgeAnswer(turns:readonly string[], guide:Guide):string|undefined {
  if (guide.href!=='/wca/achievements' || !guide.text.includes('同一自然年的十二个月均正式参赛，按比赛开始月份计算。DNF 计入，DNS 不计。')) return;
  const [setup,...changes]=turns.map(s=>s.normalize('NFKC').replace(/\s/g,''));
  const base=setup.match(/十二月拼图:同一年只在(\d+)月至(\d+)月各参加过一场,再加一场(\d+)月\d+日开到\d+月\d+日。/);
  const ask=changes.at(-1)?.split('。').slice(1).join('');
  if (!base || !ask || ask.replace(/最终|覆盖|几个|十二个月|月|必须|同一个项目|吗|[?、,]/g,'')) return;
  const [start,end,initial]=base.slice(1).map(Number);
  if (start<1 || end>12 || start>end || initial<1 || initial>12) return;
  let cross=initial;
  const additional=new Map<number,string>();
  for (const s of changes) {
    const clause=s.split('。')[0];
    const move=clause.match(/^改一下,跨月赛开赛日其实是(\d+)月\d+日$/);
    const newMonth=clause.match(/^(\d+)月的另一站仅(DNS|DNF)$/);
    const both=clause.match(/^那次DNS改判DNF,随后又撤销(\d+)月\d+日开赛的日期修订$/);
    const added=clause.match(/^后来(\d+)月补录一场只取得(DNF|DNS)的正式比赛$/);
    if (move && +move[1]>=1 && +move[1]<=12) cross=+move[1];
    else if (newMonth || added) {
      const [,m,status]=(newMonth??added)!;
      if (additional.has(+m) || +m<1 || +m>12) return;
      additional.set(+m,status);
    } else if (both && cross===+both[1]) {
      const dns=[...additional].filter(([,status])=>status==='DNS');
      if (dns.length!==1) return;
      additional.set(dns[0][0],'DNF'); cross=initial;
    } else return;
  }
  const months=new Set(Array.from({length:end-start+1},(_,i)=>i+start));
  months.add(cross);
  for (const [m,status] of additional) if (status!=='DNS') months.add(m);
  return '这一年覆盖 '+months.size+' 个月。DNF 算正式参赛，DNS 不计；按开赛月份去重。各月可以参加不同项目。';
}
