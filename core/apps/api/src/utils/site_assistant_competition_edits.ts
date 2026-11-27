// These small, fully specified examples need no public ranking or model extraction.
type Step = Record<string, Record<string, string | number>>;
const day = '[一二三四五六日天]';
const n = (value: string) =>
  /^\d+$/.test(value) ? Number(value) : '零一二三四五六七八九十'.indexOf(value.replace('两', '二'));

export function weeklyCompetitionEdits(turns: string[]): Step[] | undefined {
  const setup = turns[0].match(
    new RegExp('(?:这周|本周)一站跨周(' + day + ')(?:、(?:周)?' + day + ')+,另有周(' + day + ')一站。'),
  );
  if (!setup) return;
  // Row identity survives a move. Merging duplicate observations only changes their competition ID.
  const days = [setup[1], setup[2]],
    weeks = ['本周', '本周'];
  const steps: Step[] = [Object.fromEntries(days.map((_, i) => [i, { 比赛ID: '站' + i, 周: '本周' }]))];
  if (days[0] === days[1]) return;
  let latest: number | undefined;
  for (const turn of turns.slice(1)) {
    const [action, ask, ...rest] = turn.split('。');
    if (
      !ask ||
      rest.some(Boolean) ||
      !/门槛|达标|资格|过线|几站|几场|不同比赛/.test(ask) ||
      /排名|链接|地区|选手|日均/.test(ask)
    )
      return;
    const add = action.match(
      new RegExp('^周(' + day + ')我?(?:还赶了|又参加了|另有)另?一站(?:,只比一个项目)?$'),
    );
    const move = action.match(
      new RegExp('^新加的比赛实际(下周|本周)(' + day + ')开幕,我误看成周(' + day + ')$'),
    );
    const addTwo = action.match(
      new RegExp('^(下周|本周)(' + day + ')和周(' + day + ')又各比了一站,都是独立ID$'),
    );
    const merge = action.match(
      new RegExp('^刚才说的周(' + day + ')与周(' + day + ')原来是同一场,周\\2开幕$'),
    );
    const patch: Step = {};
    function addRow(d: string, w: string) {
      latest = days.length;
      days.push(d);
      weeks.push(w);
      patch[latest] = { 比赛ID: '站' + latest, 周: w };
    }
    if (add) addRow(add[1], '本周');
    else if (move && latest !== undefined && days[latest] === move[3]) {
      days[latest] = move[2];
      weeks[latest] = move[1];
      patch[latest] = { 周: move[1] };
    } else if (addTwo && addTwo[2] !== addTwo[3]) {
      addRow(addTwo[2], addTwo[1]);
      addRow(addTwo[3], addTwo[1]);
    } else if (merge && latest !== undefined && merge[1] !== merge[2]) {
      const find = (d: string) =>
        days.flatMap((value, i) => (value === d && weeks[i] === weeks[latest!] ? [i] : []));
      const a = find(merge[1]),
        b = find(merge[2]);
      if (a.length !== 1 || b.length !== 1) return;
      patch[a[0]] = { 比赛ID: '站' + b[0] };
    } else return;
    steps.push(patch);
  }
  return steps;
}

export function medalCountEdits(turns: string[]): Step[] | undefined {
  const setup = turns[0].split('。')[0];
  if (!/有效决赛奖牌/.test(setup)) return;
  const matches = [
    ...setup.matchAll(/(?:^|[,:;])([\p{L}]{1,6}(?:赛|站))(?:我)?(?:拿了?|只有|获得|有)(\d+)(?:枚|个)/gu),
  ];
  if (matches.length !== 2 || matches[0][1] === matches[1][1]) return;
  const counts = new Map(matches.map((m) => [m[1], Number(m[2])]));
  const steps: Step[] = [
    Object.fromEntries([...counts].map(([key, num]) => [key, { 场: key, 奖牌数: num }])),
  ];
  let newMedals: { site: string; total: number; disqualified: number } | undefined;
  for (const turn of turns.slice(1)) {
    const [action, ask, ...rest] = turn.split('。');
    if (
      !ask ||
      rest.some(Boolean) ||
      !/达标|门槛|差额|奖牌各|几枚|几项/.test(ask) ||
      /排名|链接|哪些人|为什么设置/.test(ask)
    )
      return;
    const add = action.match(/^(.+?(?:站|赛))还有([一二两三四五六七八九十\d]+)项有效决赛并列第三漏记$/);
    const remove = /^查明其中一项只是(?:预赛|半决赛)第三$/.test(action);
    const demote = action.match(/^把(.+?(?:站|赛))的一个第三名换成第四名,(.+?(?:站|赛))那次轮次修改保留$/);
    const undo = action.match(/^(?:我)?只撤回(.+?(?:站|赛))那次降为(?:预赛|半决赛)的修改$/);
    let site: string, amount: number;
    if (add && counts.has(add[1]) && n(add[2]) > 0) {
      site = add[1];
      amount = n(add[2]);
      newMedals = { site, total: amount, disqualified: 0 };
    } else if (remove && newMedals && newMedals.disqualified < newMedals.total) {
      site = newMedals.site;
      amount = -1;
      newMedals.disqualified++;
    } else if (demote && counts.has(demote[1]) && newMedals?.site === demote[2]) {
      site = demote[1];
      amount = -1;
    } else if (undo && newMedals && undo[1] === newMedals.site && newMedals.disqualified === 1) {
      site = newMedals.site;
      amount = 1;
      newMedals.disqualified = 0;
    } else return;
    const total = counts.get(site)! + amount;
    if (total < 0) return;
    counts.set(site, total);
    steps.push({ [site]: { 奖牌数: total } });
  }
  return steps;
}

export function recordSequenceEdits(turns: string[]): Step[] | undefined {
  const seq = turns[0].match(
    /先(?:有)?(单次|平均)(WR|CR|NR)[、,](?:再(?:有)?|隔一个月)(单次|平均)(WR|CR|NR)[、,](?:最后|第三条为|再之后是)(单次|平均)(WR|CR|NR)[。,]/,
  );
  if (!seq) return;
  const fields = [seq[2], seq[4], seq[6]],
    original = [...fields];
  const steps: Step[] = [
    Object.fromEntries(fields.map((record, i) => [i, { 次序: i + 1, 类型: seq[1 + i * 2], 标记: record }])),
  ];
  for (const turn of turns.slice(1)) {
    const action = turn.split('。')[0];
    if (!/资格|最早|最先|符合|首次|补回|上榜|第一条正式|最终合格/.test(turn) || /同一天|并列|链接|世界排名/.test(turn)) return;
    const unmark=action.match(/^若最早的(单次|平均)只是一条普通PB/);
    const prepend=action.match(/^补发现一条更早的(单次|平均)(NR|CR|WR),发生在这个PB之前/);
    if(unmark && unmark[1]===seq[1]){
      fields[0]='无';steps.push({0:{标记:'无'}});continue;
    }
    if(prepend && fields[0]==='无' && !steps.some(s=>s.earliest)){
      steps.push({earliest:{次序:0.5,类型:prepend[1],标记:prepend[2]}});continue;
    }
    if(/^撤回补发现的(NR|CR|WR),但保留PB/.test(action) && steps.some(s=>s.earliest?.标记 && action.includes(String(s.earliest.标记)))){
      steps.push({earliest:{active:0}});continue;
    }
    if(/发现第一条原来只是普通/.test(action)){
      fields[0]='无';steps.push({0:{标记:'无'}});continue;
    }
    const insert=action.match(/介于首条普通(单次|平均)和(单次|平均)(WR|CR|NR)之间的(单次|平均)(WR|CR|NR)/);
    if(insert && insert[1]===seq[1] && insert[2]===seq[3] && insert[3]===fields[1] && fields[0]==='无'){
      steps.push({insert:{次序:1.5,类型:insert[4],标记:insert[5]}});continue;
    }
    if(/^只取消刚补的/.test(action) && steps.some(step=>step.insert?.标记 && action.includes(String(step.insert.标记)))){
      steps.push({insert:{active:0}});continue;
    }
    if((action.startsWith('把最早那条'+original[0]+'恢复') || action === '只把最初'+seq[1]+'的'+original[0]+'标志恢复') && fields[0]==='无'){
      fields[0]=original[0];steps.push({0:{标记:'^'}});continue;
    }
    const change = action.match(/^第一条(单次|平均)的标记其实是(洲际|国家|世界)纪录,时间顺序没变$/);
    let idx: number, mark: string;
    if (change && change[1] === seq[1]) {
      idx = 0;
      mark = change[2] === '洲际' ? 'CR' : change[2] === '国家' ? 'NR' : 'WR';
    } else if (/^把第一条的洲际标记去掉,(单次|平均)还原为普通成绩$/.test(action) && fields[0] === 'CR') {
      idx = 0;
      mark = '无';
    } else if (
      /^再把中间的(单次|平均)(NR|WR|CR)撤了,末尾(WR|NR|CR)照留$/.test(action) &&
      action.includes(seq[3] + fields[1]) &&
      action.includes('末尾' + fields[2])
    ) {
      idx = 1;
      mark = '无';
    } else if (
      action === '只恢复中间的' + original[1] + ',不恢复最早' + seq[1] + '的标记' &&
      fields[1] === '无'
    ) {
      idx = 1;
      mark = original[1];
    } else return;
    fields[idx] = mark;
    steps.push({ [idx]: { 标记: mark } });
  }
  return steps;
}

export function compactPodiums(turns: string[]): Step[] | undefined {
  const setup = turns[0],
    target = setup.match(/([\p{L}]{2})(?:两人|对子)和([\p{L}]{3})三人(?:分别几次|组)/u) ?? setup.match(/关心([\p{L}]{2})对子。[^?]*?对子共几次,([\p{L}]{3})三人齐/u);
  if (!target || !target[2].startsWith(target[1]) || new Set(target[2]).size !== 3) return;
  const letters = [...target[2]],
    cols = ['第一人', '第二人', '第三人'];
  const entries: { site: string; event: string; names: string[] }[] = [];
  const steps: Step[] = [{}],
    data = setup.split('。').find((text) => /有效的?决赛前三|决赛台为/.test(text));
  if (!data) return;
  const field = (text: string) =>
    text.match(/^([\p{L}]{1,5}赛)(单手|时钟|[二三四五六七]阶)(?:也?是|另有)([\p{L}]{3})(?:同台)?$/u);
  const insert = (m: readonly string[], step: Step) => {
    const names = [...m[3]];
    if (new Set(names).size !== 3 || entries.some((r) => r.site === m[1] && r.event === m[2])) return false;
    step[entries.length] = {
      场: m[1],
      项目: m[2],
      决赛: 1,
      第一人: names[0],
      第二人: names[1],
      第三人: names[2],
      目标甲: letters[0],
      目标乙: letters[1],
      目标丙: letters[2],
    };
    entries.push({ site: m[1], event: m[2], names });
    return true;
  };
  const listed = data.match(/:([\p{L}]{1,5}站)(单手|时钟|[二三四五六七]阶)有效决赛前三为(\p{L})、(\p{L})、(\p{L});同站(单手|时钟|[二三四五六七]阶)是(\p{L})、(\p{L})、(\p{L})$/u);
  const sameVenue=data.match(/^([\p{L}]{1,6}站)的(单手|时钟|[二三四五六七]阶)决赛台为(\p{L}{3}),(单手|时钟|[二三四五六七]阶)决赛台为(\p{L}{3})$/u);
  if(sameVenue){
    if(!insert(['',sameVenue[1],sameVenue[2],sameVenue[3]],steps[0]) || !insert(['',sameVenue[1],sameVenue[4],sameVenue[5]],steps[0]))return;
  }else if(listed){
    if(!insert(['',listed[1],listed[2],listed.slice(3,6).join('')],steps[0]) || !insert(['',listed[1],listed[6],listed.slice(7,10).join('')],steps[0]))return;
  }else for (const clause of data.replace(/,都是有效的决赛前三$/, '').split(',')) {
    const m = field(clause);
    if (!m || !insert(m, steps[0])) return;
  }
  const swaps: { i: number; col: number; old: string }[] = [];
  for (const turn of turns.slice(1)) {
    const [action, question, ...rest] = turn.replace(/,(?=同一站两项能)/,'。').split('。');
    if (!question || rest.some(Boolean) || !/组合|对子|三人组|二人组|谁增加/.test(question)) return;
    const extra = field(action),
      rename = action.match(/^(.+?赛)的(\p{L})其实是(\p{L})$/u);
    const round = action.match(/^把(.+?赛)(单手|时钟|[二三四五六七]阶)改成半决赛,.+的更正留着$/);
    const undo = action.match(/^只撤销(.+?赛)的改名,那条半决赛别算$/);
    const step: Step = {};
    const byEvent=action.match(/^(单手|时钟|[二三四五六七]阶)的(\p{L})改成(\p{L}),/u) ?? action.match(/^(单手|时钟|[二三四五六七]阶)台上的(\p{L})原来是(\p{L})$/u);
    const reclass=action.match(/^(.+?站)(单手|时钟|[二三四五六七]阶)现在认定是预赛,/);
    const undoEvent=action.match(/^撤掉(单手|时钟|[二三四五六七]阶)的改名,/);
    const add=action.match(/^(.+?站)多了一次(\p{L})、(\p{L})、(\p{L})的(单手|时钟|[二三四五六七]阶)决赛领奖台$/u);
    const roundFlag=action.match(/^(?:后来|只恢复)(单手|时钟|[二三四五六七]阶)决赛(?:标签被取消,只算预赛|,.*改名不要撤)$/);
    if(roundFlag){
      const hits=entries.flatMap((r,i)=>r.event===roundFlag[1]?[i]:[]);
      if(hits.length!==1)return;
      step[hits[0]]={决赛:action.startsWith('只恢复')?'^':0};
    }else if(byEvent){
      const hits=entries.flatMap((r,i)=>r.event===byEvent[1] && r.names.includes(byEvent[2])?[i]:[]);
      if(hits.length!==1)return;
      const i=hits[0],col=entries[i].names.indexOf(byEvent[2]);
      swaps.push({i,col,old:byEvent[2]});entries[i].names[col]=byEvent[3];step[i]={[cols[col]]:byEvent[3]};
    }else if(reclass){
      const i=entries.findIndex(r=>r.site===reclass[1] && r.event===reclass[2]);if(i<0)return;
      step[i]={决赛:0};
    }else if(undoEvent){
      const hits=swaps.filter(x=>entries[x.i].event===undoEvent[1]);if(hits.length!==1)return;
      const {i,col,old}=hits[0];entries[i].names[col]=old;step[i]={[cols[col]]:'^'};swaps.splice(swaps.indexOf(hits[0]),1);
    }else if(add){
      if(!insert(['',add[1],add[5],add.slice(2,5).join('')],step))return;
    }else if (extra) {
      if (!insert(extra, step)) return;
    } else if (rename) {
      const ids = entries.flatMap((r, i) => (r.site === rename[1] && r.names.includes(rename[2]) ? [i] : []));
      if (ids.length !== 1) return;
      const i = ids[0],
        col = entries[i].names.indexOf(rename[2]);
      swaps.push({ i, col, old: rename[2] });
      entries[i].names[col] = rename[3];
      step[i] = { [cols[col]]: rename[3] };
    } else if (round) {
      const i = entries.findIndex((r) => r.site === round[1] && r.event === round[2]);
      if (i < 0) return;
      step[i] = { 决赛: 0 };
    } else if (undo) {
      const found = swaps.filter((s) => entries[s.i].site === undo[1]);
      if (found.length !== 1) return;
      const { i, col, old } = found[0];
      entries[i].names[col] = old;
      step[i] = { [cols[col]]: '^' };
      swaps.splice(swaps.indexOf(found[0]), 1);
    } else return;
    steps.push(step);
  }
  return steps;
}

export function dayListEdits(turns: string[]): Step[] | undefined {
  const setup = turns[0].match(/同一个(周[一二三四五六日](?:、周[一二三四五六日])+)我各有一场[,。]/);
  if (!setup) return;
  const days = setup[1].split('、');
  if (new Set(days).size !== days.length) return;
  const steps: Step[] = [Object.fromEntries(days.map((d) => [d, { 比赛ID: d, 周: '本周' }]))];
  let merged: string | undefined, added: string | undefined;
  for (const turn of turns.slice(1)) {
    const [action, question] = turn.split('。');
    if (!question || !/达标|几场|达到|拼成/.test(question)) return;
    const merge = action.match(/^(周.)与(周.)后来发现是同一个比赛ID,开幕日在(周.)$/);
    const another = action.match(/^下(周.)补一场,不改其它记录$/);
    const earlier = action.match(/^现在发现(周.)那场实际是前一天(周.)开幕,ID和(周.)不同$/);
    const undo = action.match(/^撤掉(周.)(周.)同ID那个更正,后一场改到(周.)开幕照留$/);
    if (
      merge &&
      merge[1] !== merge[2] &&
      days.includes(merge[1]) &&
      days.includes(merge[2]) &&
      merge[1] === merge[3]
    ) {
      merged = merge[2];
      steps.push({ [merged]: { 比赛ID: merge[1] } });
    } else if (another && !added) {
      added = another[1];
      steps.push({ 后站: { 比赛ID: '后站', 周: '下周' } });
    } else if (earlier && added === '周一' && earlier[1] === added && earlier[2] === '周日') {
      steps.push({ 后站: { 周: '本周' } });
    } else if (undo && undo[2] === merged && days.includes(undo[1])) {
      steps.push({ [merged]: { 比赛ID: '^' } });
      merged = undefined;
    } else return;
  }
  return steps;
}

export function fourthPlaceEdits(turns: string[]): Step[] | undefined {
  const setup = turns[0].match(/[,：:]([\p{L}]{1,6}赛)我在([^。]+)。/u);
  if (!setup) return;
  const first: Step = {};
  for (const clause of setup[2].split('、')) {
    const row = clause.match(
      /^([二三四五六七]阶|[三四五]盲|时钟|单手)(决赛|预赛|半决赛)第(\d+)(有效|全DNF)$/,
    );
    if (!row || first[row[1]]) return;
    first[row[1]] = {
      场: setup[1],
      项目: row[1],
      决赛: Number(row[2] === '决赛'),
      名次: +row[3],
      有效: Number(row[4] === '有效'),
    };
  }
  const steps = [first];
  for (const turn of turns.slice(1)) {
    const [act, ask] = turn.replace(/,(?=哪一个条件|什么条件)/, '。').split('。');
    if (!ask || !/次数|总数|几次|几回|条件|涨了/.test(ask)) return;
    const valid = act.match(/^(.+?)的成绩后来恢复成有效,名次没变$/);
    const round =
      act.match(/^(.+?)那轮查明是(半决赛|决赛|预赛)$/) ??
      act.match(/^如果(.+?)轮次最终确认为(决赛|半决赛|预赛),其他照旧$/);
    const undo = act.match(/^只撤销(.+?)成绩修复,同时(.+?)更正成并列第(\d+)$/);
    if (valid && Object.hasOwn(first, valid[1])) steps.push({ [valid[1]]: { 有效: 1 } });
    else if (round && Object.hasOwn(first, round[1]))
      steps.push({ [round[1]]: { 决赛: Number(round[2] === '决赛') } });
    else if (undo && undo[1] !== undo[2] && Object.hasOwn(first, undo[1]) && Object.hasOwn(first, undo[2]))
      steps.push({ [undo[1]]: { 有效: '^' }, [undo[2]]: { 名次: +undo[3] } });
    else return;
  }
  return steps;
}

// Track each physical competition separately when several share a venue.
// Countries are opaque labels here; this reader only serves the country metric.
export function visitedCountryEdits(turns: string[]): Step[] | undefined {
  const data=turns[0].match(/我在(.+?)有成绩,在(.+?)只观赛/);
  const roster=turns[0].match(/[,：:]([\p{L}]{1,8}?)有([一二两三四五六七八九\d]+)场本人正式成绩,([\p{L}]{1,8}?)([一二两三四五六七八九\d]+)场;([\p{L}]{1,8}?)只当观众。/u);
  if(!data && !roster)return;
  const entries = data ? data[1].split('、') : [roster![1] + roster![2] + '场', roster![3] + roster![4] + '场'];
  const countries:string[]=[];
  for(const entry of entries){
    const m=entry.match(/^([\p{L}]{1,10}?)([一二两三四五六七八九\d]+)场$/u);
    if(!m || /虚拟|洲际/.test(m[1]))return;
    const count=/^\d+$/.test(m[2])?Number(m[2]):'一二三四五六七八九'.indexOf(m[2].replace('两','二'))+1;
    if(count<1 || count+countries.length>64)return;
    countries.push(...Array<string>(count).fill(m[1]));
  }
  const steps:Step[]=[Object.fromEntries(countries.map((国家,i)=>[i,{国家,洲:'未指定',场数:1}]))];
  const moves:{row:number;from:string;active:boolean}[]=[];
  for(const turn of turns.slice(1)){
    const action=turn.split('。')[0];
    const move=action.match(/^(.+?)(?:那场实际|[一二两三四五六七八九\d]+场有一场其实|[一二两三四五六七八九\d]+场中的一场场馆其实)在(.+?)(?:举行|,|$)/);
    const undo=action.match(/^只撤[销回]第([一二三四五六七八九])次改址/);
    if(move){
      const row=countries.indexOf(move[1]);
      if(row<0 || move[1]===move[2])return;
      moves.push({row,from:countries[row],active:true});
      countries[row]=move[2];steps.push({[row]:{国家:move[2]}});
    }else if(undo || /^只撤[销回]那次/.test(action)){
      const named=action.match(/^只撤[销回]那次(.+?)改(.+?)的场馆更正,/);
      const candidates=named ? moves.filter(m=>m.active && m.from===named[1] && countries[m.row]===named[2]) : [];
      const m=undo ? moves['一二三四五六七八九'.indexOf(undo[1])] : candidates.length===1 ? candidates[0] : undefined;
      const index=m ? moves.indexOf(m) : -1;
      if(!m?.active || moves.slice(index+1).some(later=>later.active && later.row===m.row))return;
      countries[m.row]=m.from;m.active=false;steps.push({[m.row]:{国家:'^'}});
    }else if((/改代表/.test(action) && /没增加参赛/.test(action)) || (/改成代表/.test(action) && /仍只有看比赛/.test(action)))steps.push({});
    else if(countries.some(c=>action.startsWith(c+'那一场')) && /同日还报了/.test(action))steps.push({});
    else return;
  }
  return steps;
}

export function witnessedRecordEdits(turns:string[]):Step[]|undefined {
  const s=turns[0].match(/[,：:]([\p{L}]{1,6}站)我(?:比了|参加)([一二两三四五六七八九0-9]+)项,(?:现场有|当地出了)(\d+)条单次WR和(\d+)条平均WR;([\p{L}]{1,6}站)(?:没参加,有|我不在,出了)(\d+)条WR/u);
  if(!s || s[1]===s[5] || n(s[2])<2)return;
  // An unspecified record type can contribute to a total, but not to a
  // type-specific edit. Leave that case to the general reader.
  if(turns.some(t=>t.includes(s[5]+'的单次') || t.includes(s[5]+'的平均')))return;
  const steps:Step[]=[{first:{场:s[1],出席:1,单次WR:+s[3],平均WR:+s[4]},second:{场:s[5],出席:0,单次WR:+s[6],平均WR:0}}];
  let demoted: '单次WR' | '平均WR' | undefined;
  let attended = false;
  for(const turn of turns.slice(1)){
    const action=turn.split('。')[0];
    if(action.startsWith(s[1]) && /一个单次WR被降为NR/.test(action) && /退掉其中一项/.test(action) && +s[3]>0 && !demoted){
      steps.push({first:{单次WR:+s[3]-1}});demoted='单次WR';
    }else if(action.startsWith(s[1]) && /退掉一项,现场一个平均WR改成NR/.test(action) && +s[4]>0 && !demoted){
      steps.push({first:{平均WR:+s[4]-1}});demoted='平均WR';
    } else if (action.startsWith(s[5]) && /(?:补上|补录).{0,5}参赛成绩/.test(action) && !attended) {
      steps.push({ second: { 出席: 1 } });
      attended = true;
    } else if (attended && ((action.includes(s[5] + '补录的') && /另一个人/.test(action)) ||
        action.startsWith('只撤回' + s[5] + '补的本人参赛'))) {
      steps.push({ second: { 出席: 0 } });
      attended = false;
    } else if (demoted && (action.startsWith('只恢复' + s[1]) && action.includes(demoted) ||
        action.startsWith('恢复' + s[1] + '那条世界纪录'))) {
      steps.push({ first: { [demoted]: '^' } });
      demoted = undefined;
    } else return;
  }
  return steps;
}

// A named meet can span two calendar days. Only its opening week is a
// mutable field: changing the competitor's personal day leaves it untouched.
export function namedWeekEdits(turns: string[]): Step[] | undefined {
  const list = turns[0].match(/(?:同|本)周[一二三四五六日]开[^。;]+/);
  if (!list) return;
  const first: Step = Object.create(null);
  for (const clause of list[0].replace(/^(?:同|本)/, '').split('、')) {
    const match = clause.match(/^周[一二三四五六日]开([\p{L}]{1,8}站)$/u);
    if (!match || first[match[1]]) return;
    first[match[1]] = { 比赛ID: match[1], 周: '本周' };
  }
  const steps = [first];
  for (const turn of turns.slice(1)) {
    const action = turn.split('。')[0];
    const shift = action.match(/^(.+?站)(?:公告)?改期[^,]*,改到(下周|本周)[一二三四五六日]$/);
    const addition = action.match(/^(下周|本周)[一二三四五六日].*?(?:另一场|另一站)(.+?站),两场并非同ID$/);
    const undo = action.match(/^(?:我)?只撤[销回](.+?站)改期,/);
    const personalDay = action.match(/^(.+?站)周[一二三四五六日]那天实际没轮到我,我周[一二三四五六日]才比$/);
    if (shift && first[shift[1]]) steps.push({ [shift[1]]: { 周: shift[2] } });
    else if (addition && !steps.some(s=>Object.hasOwn(s,addition[2]))) {
      steps.push({ [addition[2]]: { 比赛ID: addition[2], 周: addition[1] } });
    } else if (undo && first[undo[1]]) steps.push({ [undo[1]]: { 周: '^' } });
    else if (personalDay && first[personalDay[1]]) steps.push({});
    else return;
  }
  return steps;
}

// Read round type separately from placement and solve validity. Carry a
// venue only within the same clause group ("A站三盲决赛和单手决赛").
export function roundEntries(turns: string[], fourth: boolean): Step[] | undefined {
  const start = turns[0].split('。')[0];
  const part = start.match(/(?:我在|[,:])([\p{L}]{1,6}站(?:我有)?(?:[二三四五六七]阶|[三四五]盲|单手|时钟).*)/u);
  if (!part) return;
  const first: Step = Object.create(null);
  let venue = '';
  for (const term of part[1].split(/[、和,;]/)) {
    const row = term.match(/^(?:([\p{L}]{1,6}站)(?:我有|只有)?)?([二三四五六七]阶|[三四五]盲|单手|时钟)(半决赛|预赛|决赛)(?:也?第([一二三四五\d]+)(有效|但全DNF)?)?$/u);
    if (!row || (fourth && (!row[4] || (row[3]==='决赛' && !row[5])))) return;
    venue = row[1] ?? venue;
    const key = venue + row[2];
    if (!venue || first[key]) return;
    first[key] = { 场: venue, 项目: row[2], 决赛: Number(row[3] === '决赛'),
      ...(fourth ? {名次:n(row[4]), 有效: Number(row[5]==='有效')} : {本人:1}) };
  }
  const steps=[first];
  const eventRow = (key: string) => Object.hasOwn(first, key);
  for (const t of turns.slice(1)) {
    const edit = t.match(/^(.+?站(?:[二三四五六七]阶|[三四五]盲|单手|时钟))(?:原来是带决赛标记的一轮|那轮实际是决赛)([^。？?]*)/);
    const owner = t.match(/^(.+?站.+?)那行改记同名他人。/);
    const undo = t.match(/^(?:仅|只)?撤回(.+?站)(.*?)的(?:轮次更正|决赛标签)[,。]/);
    const duplicated = t.match(/^与(.+?站.+?)相同的那条决赛行被扫描两次,确认只有一个原件。若原先只算一次/);
    const valid = t.match(/^(.+?站)补进自己一把有效结果,名次没动。/);
    if (edit && eventRow(edit[1]) && (!fourth || /有有效成绩/.test(edit[2]))) {
      steps.push({ [edit[1]]: { 决赛: 1, ...(fourth ? { 有效: 1 } : {}) } });
    } else if (!fourth && owner && eventRow(owner[1])) {
      steps.push({ [owner[1]]: { 本人: 0 } });
    } else if (undo) {
      const candidates = Object.keys(first).filter(key => first[key].场 === undo[1] &&
        (!undo[2] || first[key].项目 === undo[2]) && steps.slice(1).some(step => step[key]?.决赛 === 1));
      if (candidates.length !== 1) return;
      steps.push({ [candidates[0]]: { 决赛: '^' } });
    } else if (!fourth && duplicated && eventRow(duplicated[1])) {
      steps.push({});
    } else if (fourth && valid) {
      const atVenue = Object.keys(first).filter(key => first[key].场 === valid[1]);
      if (atVenue.length !== 1) return;
      steps.push({ [atVenue[0]]: { 有效: 1 } });
    } else return;
  }
  return steps;
}
