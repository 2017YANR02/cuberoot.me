// Preserve membership separately from a row's measured value. A missed home
// competition stays in the sequence; moving a result transfers ownership.
type Page = { href: string; text: string };
const eventNames = '甲乙丙丁戊己庚辛壬癸';

function attendance(setup: string, changes: string[]) {
  const schedule = setup.match(/(?:本国|国内)(?:连续)?(?:办|举办)([甲乙丙丁戊己庚辛壬癸、,]+)/)?.[1];
  const attended = setup.match(/只(?:去了|参加了)([甲乙丙丁戊己庚辛壬癸、,]+)/)?.[1];
  if (!schedule || !attended) return;
  const names = [...schedule].filter(s => eventNames.includes(s));
  if (new Set(names).size !== names.length || [...attended].some(s => eventNames.includes(s) && !names.includes(s))) return;
  const visits = new Map(names.map(n => [n, [attended.includes(n)]]));
  const overseas = new Set<string>();
  const snapshot = () => {
    let current = 0, longest = 0;
    const events = [...visits].filter(([id]) => !overseas.has(id)).map(([id, history]) => {
      const present = history.at(-1)!;
      current = present ? current + 1 : 0;
      longest = Math.max(longest, current);
      return { id, present };
    });
    return { events, current, longest };
  };
  let previous = snapshot();
  for (const turn of changes) {
    previous = snapshot();
    const first = turn.split(/[。;；]/)[0].replace(/[,，](?:但)?保留[^,，]+(?:缺席|出席)$/, '');
    const name = first.match(/[甲乙丙丁戊己庚辛壬癸]/)?.[0];
    if (!name || new Set(first.match(/[甲乙丙丁戊己庚辛壬癸]/g)).size !== 1) return;
    const row = visits.get(name);
    if (/回退|撤销|撤回/.test(first)) {
      if (!row || row.length < 2) return;
      row.pop();
    } else if (/其实是海外|改为海外/.test(first) && row) overseas.add(name);
    else if (/(?:下一场|新增).*(?:本国|国内)/.test(first) && /缺席/.test(first) && !row) visits.set(name, [false]);
    else if (/找到.*参赛记录|补录.*出席/.test(first) && row) row.push(true);
    else return;
  }
  return { previous, current: snapshot() };
}

function bestRound(setup: string, changes: string[]) {
  if (!/三阶|二阶|四阶|五阶/.test(setup) || /盲|单次/.test(setup)) return;
  const groups = new Map<string, number[][]>();
  for (const m of setup.matchAll(/([甲乙丙丁])(?:的)?(?:[一二三四五六七八九\d]+个|前三)?平均(\d+(?:\.\d+)?(?:[、,]\d+(?:\.\d+)?){1,})秒/g)) {
    if (groups.has(m[1])) return;
    groups.set(m[1], m[2].split(/[、,]/).map(x => [Number(x)]));
  }
  if (groups.size !== 2 || [...groups.values()].flat().some(([v]) => v <= 0)) return;
  const snapshot = () => {
    const rounds = [...groups].map(([id, rows]) => {
      const values = rows.map(v => v.at(-1)!).sort((a,b) => a-b);
      const top = values.slice(0,3);
      return { id, values, top, sum: top.length === 3 ? Number(top.reduce((a,b) => a+b,0).toFixed(2)) : null };
    });
    const eligible = rounds.filter(r => r.sum !== null).sort((a,b) => a.sum! - b.sum!);
    return { rounds, leaders: eligible.filter(r => r.sum === eligible[0].sum).map(r => r.id),
      gap: eligible.length === 2 ? Number((eligible[1].sum! - eligible[0].sum!).toFixed(2)) : null };
  };
  let previous = snapshot();
  for (const s of changes) {
    previous = snapshot();
    const first = s.split(/[。;；]/)[0];
    const edit = first.match(/([甲乙丙丁])(?:的|把)(\d+(?:\.\d+)?)秒?(?:被|后来)?改(?:为|成)?(\d+(?:\.\d+)?)/);
    const move = first.match(/([甲乙丙丁])的(\d+(?:\.\d+)?).*移到([甲乙丙丁])/);
    if (edit) {
      const rows = groups.get(edit[1]);
      const undo = /撤销|撤回|回退/.test(first);
      const matches = rows?.filter(r => r.at(-1) === Number(edit[undo ? 3 : 2]) && (!undo || r.at(-2) === +edit[2]));
      if (matches?.length !== 1 || +edit[3] <= 0) return;
      if (undo) matches[0].pop();
      else matches[0].push(+edit[3]);
    } else if (move) {
      const from = groups.get(move[1]), to = groups.get(move[3]);
      const matches = from?.filter(r => r.at(-1) === +move[2]);
      if (!from || !to || from === to || matches?.length !== 1) return;
      from.splice(from.indexOf(matches[0]),1);
      to.push(matches[0]);
    } else return;
  }
  return { previous, current: snapshot() };
}

// Distinct-event leaderboards count events, not record rows. Retain the
// original row when its flag changes, even after the record is surpassed.
function recordBreadth(setup: string, changes: string[]) {
  const entries = [...setup.matchAll(/([二三四五六七]阶)有([一二两三四五六七八九]|\d{1,2})条(洲际纪录|WR|NR|CR)/gi)];
  if (!entries.length || entries.length !== (setup.match(/条/g) ?? []).length) return;
  const rows = entries.flatMap(([,event,count,flag]) => Array.from(
    { length: Number(count) || '零一二三四五六七八九'.indexOf(count.replace('两','二')) },
    () => ({ event, flags: [flag === '洲际纪录' ? 'CR' : flag.toUpperCase()] })));
  const tiers = { World: ['WR'], Continental: ['WR','CR'], National: ['WR','CR','NR'] };
  const snapshot = () => Object.fromEntries(Object.entries(tiers).map(([tier, allowed]) => {
    const events = [...new Set(rows.filter(r => allowed.includes(r.flags.at(-1)!)).map(r => r.event))];
    return [tier, {events, count: events.length}];
  }));
  let previous = snapshot();
  for (const turn of changes) {
    previous = snapshot();
    const event = turn.match(/[二三四五六七]阶/)?.[0];
    if (!event) return;
    const own = rows.filter(row => row.event === event);
    if (!own.length) return;
    const change = turn.match(/一条(NR|CR|WR)(?:更正为|改为)(洲际纪录|NR|CR|WR)/);
    const transfer = turn.match(/(?:其实是|应该是)([二三四五六七]阶)/);
    if (change) {
      const row = own.find(r => r.flags.at(-1) === change[1]);
      if (!row) return;
      row.flags.push(change[2] === '洲际纪录' ? 'CR' : change[2]);
    } else if (/标记撤销|撤回.*更正/.test(turn)) {
      const revised = own.filter(r => r.flags.length > 1);
      if (revised.length !== 1) return;
      revised[0].flags.pop();
    } else if (transfer && /记错项目|移到/.test(turn) && own.length === 1) own[0].event = transfer[1];
    else if (!/被同项目更快成绩打破.*当时纪录有效/.test(turn)) return;
  }
  return { previous, current: snapshot() };
}

export function guideGroupOperands(turns: readonly string[], page: Page): string | undefined {
  const [setup, ...changes] = turns.map(s => s.normalize('NFKC').replace(/\s/g,''));
  if (!setup || changes.some(s => /如果|假设|假如|同时|并把|又把|然后/.test(s))) return;
  if (page.href === '/wca/about/longest_streak_of_competitions_in_own_country' && page.text.includes('一场缺席 → 计数清零')) {
    return JSON.stringify(attendance(setup, changes));
  }
  if (page.href === '/wca/about/records_in_most_events' && page.text.includes('WR 同时计入洲际和国家纪录')) {
    return JSON.stringify(recordBreadth(setup, changes));
  }
  if (page.href === '/wca/about/best_round' && page.text.includes('ORDER BY <best | average>')) {
    return JSON.stringify(bestRound(setup, changes));
  }
}

// Render a closed comparison from the checked rows, including the previous
// ranking. Open-ended or additional questions still go through the reader.
export function groupComparisonAnswer(turns: readonly string[], guide: Page): string | undefined {
  const ask = turns.at(-1)?.normalize('NFKC').split('。').slice(1).join('');
  if (!ask) return;
  if (guide.href === '/wca/about/best_round' &&
      !ask.replace(/要不要|递补|补|第[一二三四五六七八九\d]+人|新前三|总和|领先者|谁|差几秒|还|会|换人|榜首|都|给我|[?、,]/g,'')) {
    const operands = guideGroupOperands(turns,guide);
    if (!operands) return;
    const {previous,current} = JSON.parse(operands) as {previous:RoundSnapshot;current:RoundSnapshot};
    const results = current.rounds.map(r => {
      const before = previous.rounds.find(v => v.id === r.id)!;
      const newlyInTop = r.top.some(v => !before.top.includes(v));
      return r.id+(r.sum === null ? '不足三人' : '前三为 '+r.top.join('、')+' 秒，合计 '+r.sum+' 秒')+
        (newlyInTop && before.values.includes(r.top[2]) && !before.top.includes(r.top[2]) ? '，原先排在前三之外的 '+r.top[2]+' 秒递补入列' : '');
    });
    return results.join('；')+'。'+(current.leaders.length === 2 ? '两轮并列。' :
      current.leaders.join('、')+'在前，'+(current.leaders.join() === previous.leaders.join() ? '领先方未变' : '领先方已变')+
      (current.gap === null ? '' : '，差 '+current.gap+' 秒')+'。');
  }
  if (guide.href === '/wca/about/records_in_most_events' &&
      !ask.replace(/三档|各档|各层|现在|计数|多少|合并项目后|哪个档变了|[?、,]/g,'')) {
    const operands = guideGroupOperands(turns,guide);
    if (!operands) return;
    type Tiers = Record<string,{events:string[];count:number}>;
    const {current,previous} = JSON.parse(operands) as {current:Tiers;previous:Tiers};
    return Object.entries(current).map(([tier,{count,events}]) => {
      const change=count-previous[tier].count;
      return tier+' '+count+' 项（'+events.join('、')+'），较上一版'+(change === 0 ? '不变' : (change>0?'增加':'减少')+Math.abs(change)+' 项');
    }).join('；')+'。按项目去重，曾有效的纪录被超越仍计入。';
  }
}
type RoundSnapshot = {rounds:{id:string;values:number[];top:number[];sum:number|null}[];leaders:string[];gap:number|null};

export function offPodiumAnswer(turns:readonly string[], page:Page):string|undefined {
  if (page.href!=='/wca/about/best_result_off_podium' || !/pos\s*>\s*3/.test(page.text)) return;
  const [setup,...edits]=turns.map(t=>t.normalize('NFKC').replace(/\s/g,''));
  if (!setup?.includes('三阶决赛的有效平均') || !edits.length) return;
  const entries=[...setup.matchAll(/([甲乙丙丁])第(\d+)名(\d+(?:\.\d+)?)/g)];
  const rows=new Map(entries.map(([,name,rank,sec])=>[name,{rank:+rank,sec:+sec,valid:true,final:true}]));
  if (rows.size<2 || rows.size!==entries.length) return;
  const sorted=()=>[...rows].filter(([,r])=>r.valid && r.final && r.rank>3).sort((a,b)=>a[1].sec-b[1].sec);
  const gap=(list:ReturnType<typeof sorted>)=>Number((list.at(-1)![1].sec-list[0][1].sec).toFixed(2));
  let previous=sorted();
  for (const edit of edits) {
    previous=sorted();
    const clause=edit.split('。')[0];
    const name=clause.match(/[甲乙丙丁]/)?.[0], row=name && rows.get(name);
    if (!row) return;
    if (/^.[的]?平均改DNF但单次仍有效,其他不动$/i.test(clause)) row.valid=false;
    else if (/^.的决赛名次原来是第[一二三四五六七八九\d]+,平均未改$/.test(clause)) {
      const rank=clause.match(/第([一二三四五六七八九\d]+)/)![1];
      row.rank=Number(rank)||'零一二三四五六七八九'.indexOf(rank);
    } else if (/^撤销.的DNF,让平均回原值,.名次不动$/.test(clause)) row.valid=true;
    else if (/^.那条其实是半决赛成绩,再剔掉$/.test(clause)) row.final=false;
    else return;
  }
  const ask=edits.at(-1)!.split('。').slice(1).join('');
  if (!ask || ask.replace(/三人的顺序|最快|最慢|的差|现在|前两人|是谁|差距|和刚才|相比|缩了|多少|到|和|[?,、]/g,'')) return;
  const current=sorted();
  if (current.length<2 || previous.length<2) return;
  const change=Number((gap(current)-gap(previous)).toFixed(2));
  return '有效平均从快到慢为'+current.map(([id,r])=>id+' '+r.sec.toFixed(2)+' 秒').join('、')+'，首尾相差 '+gap(current).toFixed(2)+' 秒。上一版相差 '+gap(previous).toFixed(2)+' 秒，'+(change===0?'差距不变':(change>0?'扩大':'缩小')+Math.abs(change).toFixed(2)+' 秒')+'。';
}
