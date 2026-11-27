// Expand bounded counts into individual attempts before making partial changes.
// An attempt keeps its original identity when its event or its result changes.
type Fields = Record<string, string | number>;
type Step = Record<string, Fields>;
const integer = (s: string) =>
  /^\d+$/.test(s) ? Number(s) : '零一二三四五六七八九十'.indexOf(s.replace('两', '二'));
const events = '二阶|三阶|四阶|五阶|六阶|七阶|单手|三盲|四盲|五盲|时钟|斜转|金字塔';
const amount = '[一二两三四五六七八九十]|\\d{1,2}';

export function countedTimes(turns: string[]): Step[] | undefined {
  const [setup, ...changes] = turns;
  if (!setup.includes('最常出现的成绩')) return;
  const records: { event: string; score: string; original: string }[] = [];
  const eventPrefix = new RegExp('(' + events + ')(?:的|只有|有|为|是)?(?=\\d)');
  const blocks = setup.split('。').filter(block => eventPrefix.test(block));
  if (blocks.length !== 1) return;
  const chunk = blocks[0].slice(blocks[0].search(eventPrefix));
  const clauses = chunk.split(new RegExp('[;:]|,(?=(?:' + events + ')(?:的|只有|有|为|是)?\\d)'));
  for (const clause of clauses) {
    const m = clause.match(eventPrefix);
    if (!m || m.index !== 0) return;
    for (const item of clause.slice(m[0].length).split(/[、,]/)) {
      const count = item.match(
        new RegExp('^(\\d+\\.\\d{1,2}|DNF|DNS)(?:有)?(' + amount + ')(?:把|次)$', 'i'),
      );
      if (!count || integer(count[2]) < 1 || records.length + integer(count[2]) > 64) return;
      for (let i = 0; i < integer(count[2]); i++)
        records.push({ event: m[1], score: count[1], original: count[1] });
    }
  }
  if (!records.length || !setup.split('。').slice(1).join('')) return;
  const initial: Step = Object.fromEntries(
    records.map((r, i) => [i, { 项目: r.event, 成绩: r.score, 次数: 1 }]),
  );
  const originalEvents = records.map((r) => r.event);
  const steps = [initial];
  let lastCorrected: number[] = [],
    lastMoved: number | undefined;
  for (const turn of changes) {
    const voidReturned = turn.match(/^如果(?:划|移|转)回去的那(?:次|把)后来是(DNS|DNF),/);
    if (voidReturned && lastMoved !== undefined && records[lastMoved].event === originalEvents[lastMoved] &&
        steps.slice(1).some(step => step[lastMoved!]?.项目 === '^') && /有效成绩/.test(turn)) {
      records[lastMoved].score = voidReturned[1];
      steps.push({ [lastMoved]: { 成绩: voidReturned[1] } });
      continue;
    }
    const [action, ...asks] = turn.split('。');
    if (
      !asks.some(Boolean) ||
      /为什么|账号|规则条款|链接|怎么练|世界排名|多少人|概率|百分/.test(asks.join(''))
    )
      return;
    const correct = action.match(
      new RegExp(
        '^(?:沿用|只看|限定)(' +
          events +
          '),(' +
          amount +
          ')把(\\d+\\.\\d+)(?:其实都?是|应为|改成)(\\d+\\.\\d+)$',
      ),
    );
    const fromGroup = action.match(
      new RegExp('^(' + events + ')那(' + amount + ')把里抽出一把改记(\\d+\\.\\d+)$'),
    );
    const individual = action.match(
      new RegExp('^(?:其中)?一次(' + events + ')的(\\d+\\.\\d+)(?:改成|改为)(\\d+\\.\\d+)$'),
    );
    const move = action.match(
      new RegExp('^(?:纠正|更正|改过)(?:里|中)的.{1,3}把有一把原来就是(' + events + '),放回\\1$'),
    );
    const movedAttempt = action.match(new RegExp('^这把改过秒的原属(' + events + ')$'));
    const withdraw = action.match(new RegExp('^删掉最初(' + events + ')那把记录,更正后移过来的那把要留$'));
    const undo = /^只撤[回销]这把的改秒,项目(?:还|仍)是|^把这把的用时恢复到更正前,项目按/.test(action);
    const invalid = action.match(
      new RegExp(
        '^(?:再回来看|回到|只看)(' + events + '),(?:没动的)?那把(\\d+\\.\\d+)(?:判成|改成)(DNF|DNS)了?$',
      ),
    );
    const step: Step = {};
    const moveExtreme = action.match(new RegExp('^(' + events + ')最(慢|快)的有效(?:值|成绩)(?:里|中)?有一把(?:属于|归到|移到)(' + events + '),?(?:秒数照旧|用时不变)?$'));
    const changeMoved = action.match(/^(?:刚(?:刚)?(?:移|转)(?:动|过去)的|移项的|那次移过去的)(?:那|这)?一?把(?:其实|应为|是|改成)+(\d+(?:\.\d{1,2})?)(?:秒)?(?:才对)?$/)
      ?? action.match(/^(?:我又听错了,)?那把刚(?:划|移|转)过去的(?:应为|改成|实际是)(\d+(?:\.\d{1,2})?)(?:秒)?$/);
    const restoreEvent = action.match(new RegExp('^(?:这个)?(?:改秒|新用时)(?:没错|保留),?(?:但)?项目(?:还|仍)是(' + events + '),?(?:把)?归属(?:退回|撤回|恢复)$'))
      ?? action.match(new RegExp('^(?:秒数改得对|用时没错|秒数不动),只把它(?:划|移|转)回(' + events + ')$'));
    const cancelOriginal = action.match(new RegExp('^(?:现在)?原来就(?:写|记)([\\d.]+)的那把(' + events + ')(?:取消|撤销),刚改成([\\d.]+)的要留$'));
    const transfer = action.match(new RegExp('^(' + events + ')(?:那|这)(?:次|把)(?:其实|原来)?(?:是|属于|归到)(' + events + ')(?:的)?(?:,仍然是([\\d.]+)秒)?$'));
    if (transfer) {
      const ids = records.flatMap((r,i) => r.event===transfer[1] && (!transfer[3] || Number(r.score)===Number(transfer[3])) ? [i] : []);
      if(ids.length!==1 || transfer[1]===transfer[2])return;
      lastMoved=ids[0];
      records[lastMoved].event=transfer[2];
      step[lastMoved]={项目:transfer[2]};
    } else if (moveExtreme) {
      const candidates = records.map((r,i)=>({r,i})).filter(({r})=>r.event===moveExtreme[1] && Number(r.score)>0);
      if (!candidates.length || moveExtreme[1]===moveExtreme[3]) return;
      candidates.sort((a,b)=>(Number(a.r.score)-Number(b.r.score))*(moveExtreme[2]==='慢'?-1:1));
      lastMoved=candidates[0].i;
      records[lastMoved].event=moveExtreme[3];
      step[lastMoved]={项目:moveExtreme[3]};
    } else if (changeMoved && lastMoved !== undefined && Number(changeMoved[1])>0) {
      records[lastMoved].score=changeMoved[1];
      lastCorrected=[lastMoved];
      step[lastMoved]={成绩:changeMoved[1]};
    } else if (restoreEvent && lastMoved !== undefined && originalEvents[lastMoved]===restoreEvent[1]) {
      if (records[lastMoved].event === restoreEvent[1]) return;
      records[lastMoved].event=restoreEvent[1];
      step[lastMoved]={项目:'^'};
    } else if (cancelOriginal && cancelOriginal[1]===cancelOriginal[3]) {
      const untouched=records.flatMap((r,i)=>r.original===cancelOriginal[1] && r.score===r.original && r.event===cancelOriginal[2] && !lastCorrected.includes(i)?[i]:[]);
      if(untouched.length!==1)return;
      records[untouched[0]].event='';
      step[untouched[0]]={active:0};
    } else if (correct) {
      const n = integer(correct[2]);
      lastCorrected = records
        .flatMap((r, i) => (r.event === correct[1] && r.score === correct[3] ? [i] : []))
        .slice(0, n);
      if (n < 1 || n !== lastCorrected.length) return;
      for (const i of lastCorrected) {
        records[i].score = correct[4];
        step[i] = { 成绩: correct[4] };
      }
    } else if (fromGroup) {
      const grouped = new Map<string, number[]>();
      records.forEach((r, i) => {
        if (r.event === fromGroup[1]) grouped.set(r.score, [...(grouped.get(r.score) ?? []), i]);
      });
      const candidates = [...grouped.values()].filter((ids) => ids.length === integer(fromGroup[2]));
      if (candidates.length !== 1) return;
      const i = candidates[0][0];
      records[i].score = fromGroup[3];
      step[i] = { 成绩: fromGroup[3] };
      lastCorrected = [i];
    } else if (movedAttempt && lastCorrected.length === 1) {
      lastMoved = lastCorrected[0];
      records[lastMoved].event = movedAttempt[1];
      step[lastMoved] = { 项目: movedAttempt[1] };
    } else if (withdraw) {
      const candidates = records.flatMap((r, i) =>
        r.event === withdraw[1] && originalEvents[i] === withdraw[1] ? [i] : [],
      );
      if (candidates.length !== 1) return;
      step[candidates[0]] = { active: 0 };
      records[candidates[0]].event = '';
    } else if (individual) {
      const i = records.findIndex((r) => r.event === individual[1] && r.score === individual[2]);
      if (i < 0) return;
      records[i].score = individual[3];
      step[i] = { 成绩: individual[3] };
      lastCorrected = [i];
    } else if (move && lastCorrected.length && lastMoved === undefined) {
      const origin = records[lastCorrected[0]];
      if (
        origin.event === move[1] ||
        lastCorrected.some(
          (i) => records[i].event !== origin.event || records[i].original !== origin.original,
        )
      )
        return;
      lastMoved = lastCorrected[0];
      records[lastMoved].event = move[1];
      step[lastMoved] = { 项目: move[1] };
    } else if (
      undo &&
      lastMoved !== undefined &&
      action.replace(/保留$/, '').endsWith(records[lastMoved].event)
    ) {
      records[lastMoved].score = records[lastMoved].original;
      step[lastMoved] = { 成绩: '^' };
    } else if (invalid) {
      const ids = records.flatMap((r, i) => (r.event === invalid[1] && r.score === invalid[2] ? [i] : []));
      if (ids.length !== 1) return;
      records[ids[0]].score = invalid[3];
      step[ids[0]] = { 成绩: invalid[3] };
    } else return;
    steps.push(step);
  }
  return steps;
}

export function attemptedStatusChanges(turns: string[]): Step[] | undefined {
  const setup = turns[0],
    event = setup.match(new RegExp('(' + events + ')(?:(?:记录|这一页)?有(?=\\d)|练习表)'))?.[1];
  if (!event || !/DNF(?:率|比例)/i.test(setup) || new Set(setup.match(new RegExp(events, 'g'))).size !== 1) return;
  const statuses = ['有效', 'DNF', 'DNS', '占位'];
  const counts = new Map(statuses.map((s) => [s, 0]));
  const matched = [...setup.matchAll(/(\d+)(?:次|把|个)(有效|成功|DNF|DNS|零占位|占位|空槽)/gi)];
  if (matched.length < 3 || new Set(matched.map((m) => m[2])).size !== matched.length) return;
  const status = (s: string) => (s === '成功' ? '有效' : ['空槽','零占位'].includes(s) ? '占位' : s.toUpperCase());
  if (new Set(matched.map((m) => status(m[2]))).size !== matched.length) return;
  for (const m of matched) counts.set(status(m[2]), Number(m[1]));
  const steps: Step[] = [
    Object.fromEntries([...counts].map(([state, n]) => [state, { 项目: event, 状态: state, 次数: n }])),
  ];
  const edits: { from: string; to: string; active: boolean }[] = [];
  for (const turn of turns.slice(1)) {
    const step: Step = {};
    const transfer = (from: string, to: string, n: number) => {
      if (n < 1 || counts.get(from)! < n) return false;
      counts.set(from, counts.get(from)! - n);
      counts.set(to, counts.get(to)! + n);
      step[from] = { 次数: counts.get(from)! };
      step[to] = { 次数: counts.get(to)! };
      return true;
    };
    const addValid = turn.match(new RegExp('^(?:我)?(?:又|再)?(?:多找到|补录|新增)(?:一次|一把)有效' + event + '(?:,不是改判的那一条)?。'));
    if(addValid) {
      counts.set('有效',counts.get('有效')!+1);
      steps.push({有效:{次数:counts.get('有效')!}});
      continue;
    }
    const modify = turn
      .split(/[。?]/)[0]
      .replace(/其中一条(DNF|DNS)只是没开始,应作(DNS|DNF)/g,'一次$1改为$2')
      .replace(/把前面的(DNF|DNS)改(DNS|DNF)撤掉[;；]新增的有效值要留着/g,'只撤回从$1到$2的更正')
      .replace(/若把最后([一二两三四五六七八九十\d]+)条DNS的空位全删了.*/, '把$1个DNS删掉')
      .replace(/一条原来成功的改成/g,'一次有效改成')
      .replace(/其中一个原来的(DNS|DNF)判为/g,'一次$1改判')
      .replace(/只撤回成功改DNS/g,'只撤回从有效到DNS的更正')
      .replace(/再清空(\d+)条零值记录和剩余那条DNS/g,'把$1个空槽删掉,把1个DNS删掉')
      .replace(/(DNS|DNF|有效)是裁判录错,改成/g, '$1改成')
      .replace(/,同时/g, ',')
      .split(',');
    let ok = true;
    for (const clause of modify) {
      const one = clause.match(
        /^(?:又有)?(?:一[个把次]|1[个把次]|那条)(?:原先)?(有效|DNS|DNF)(?:的成绩)?(?:改判|改成|改为)(DNF|有效|DNS)$/,
      );
      const undo = clause.match(/^只(?:取消|撤销|撤回)从(有效|DNS|DNF)到(有效|DNS|DNF)的更正$/);
      const all = clause.match(/^把所有(\d+)次(DNF|DNS|有效)都纠正成(有效|DNF|DNS)(?:成绩)?$/);
      const ordinal = clause.match(
        /^只(?:取消|撤销|撤回)第([一二三四五六七八九十\d])次对(有效|DNS|DNF)的更改$/,
      );
      const excluded = clause.match(/^(?:把|再加)([一二两三四五六七八九十\d]+)(?:个|条)(空槽|DNS)(删掉)?$/);
      if (excluded) {
        const key = status(excluded[2]),
          n = integer(excluded[1]),
          updated = counts.get(key)! + (excluded[3] ? -n : n);
        if (n < 1 || updated < 0) return;
        counts.set(key, updated);
        step[key] = { 次数: updated };
      } else if (ordinal) {
        const edit = edits[integer(ordinal[1]) - 1];
        if (!edit?.active || edit.from !== ordinal[2] || !transfer(edit.to, edit.from, 1)) return;
        edit.active = false;
      } else if (one && transfer(one[1], one[2], 1)) edits.push({ from: one[1], to: one[2], active: true });
      else if (undo) {
        const edit = [...edits].reverse().find((e) => e.active && e.from === undo[1] && e.to === undo[2]);
        if (!edit || !transfer(edit.to, edit.from, 1)) return;
        edit.active = false;
      } else if (all && counts.get(all[2]) === Number(all[1]) && transfer(all[2], all[3], Number(all[1])))
        continue;
      else if (
        /^(?:空槽不动|不是刚改的那把|后一条判罚继续|第[一二三四五]次判罚照常|DNS那次改判保留|DNS与占位不动|要不要纳入分母\??)$/.test(
          clause,
        )
      )
        continue;
      else if (/^补到同一项目的.{1,3}个零值占位$/.test(clause)) continue;
      else ok = false;
    }
    if (!ok || /来源|链接|平均用时|世界排名/.test(turn)) return;
    steps.push(step);
  }
  return steps;
}

// Preserve the identity of each originally entered event. Two records with the
// same current owner/event count once, but undoing a transfer separates them.
export function rosterEdits(turns: string[]): Step[] | undefined {
  const roster = turns[0].match(/(?:试算|举个例子|参赛名单|这场的记录)[:：]([^。]+)。|参赛记录是([^。]+)。|平均参赛项目数里,([^。]+)。/);
  if (!roster) return;
  const entries: { owner: string; event: string; active: boolean }[] = [];
  for (const part of (roster[1] ?? roster[2] ?? roster[3]).split(/[,;]/)) {
    const who =
      part.match(/^([\p{L}]{1,8}?)(?:只有|只比|就一个|有|比|报了?|参加)(.+)$/u) ??
      part.match(new RegExp('^([\\p{L}]{1,8}?)((?:' + events + ')(?:、(?:' + events + '))*)$', 'u'));
    if (!who) return;
    for (const event of who[2].split(/和|、|与/)) {
      if (!new RegExp('^(?:' + events + ')$').test(event)) return;
      entries.push({ owner: who[1], event, active: true });
    }
  }
  const steps: Step[] = [Object.fromEntries(entries.map((e, i) => [i, { 人: e.owner, 项目: e.event }]))];
  const transfers: { index: number; from: string }[] = [];
  for (const turn of turns.slice(1)) {
    const stem = turn.split('。')[0];
    const add = stem.match(
      new RegExp(
        '^(.+?)的(' + events + ')(?:又比了一轮,同时他第一次上场比|打了两轮,而且第一次参加)(' + events + ')$',
      ),
    );
    const transfer = stem.match(
      new RegExp('^(?:更正一下,)?(.+?)那条(' + events + ')属于(.+?),(?:.+?)原本就有\\2$'),
    );
    const ownerMove = stem.match(
      new RegExp(
        '^(?:(' + events + ')其实是(.+?)的,他原先没有这个项目|(.+?)的(' + events + ')归到(.+?),他已经有\\4)$',
      ),
    );
    const remove = stem.match(new RegExp('把(.+?)新增的(' + events + ')整条撤掉'));
    const undo =
      stem.match(new RegExp('^只把(' + events + ')的转移撤掉,')) ??
      stem.match(new RegExp('^只撤[销消](' + events + ')的转移,'));
    const step: Step = {};
    const added=stem.match(new RegExp('^(.+?)的(' + events + ')决赛又出现一行,(.+?)多了一项(' + events + ')$'));
    const owner=stem.match(new RegExp('^(.+?)的(' + events + ')后来核实是(.+?)的,\\3本来就有$'));
    const signup=stem.match(new RegExp('^(.+?)补报(' + events + ')又打(' + events + ')第[一二三四]轮(?:,|$)'));
    const reassign=stem.match(new RegExp('^那条补报登记错人了,(.+?)的这个(' + events + ')属于(.+?)$'));
    const removeWrong=stem.match(new RegExp('^(.+?)的(' + events + ')是整条误录,'));
    const restoreBoth=stem.match(new RegExp('^让(.+?)的(' + events + ')恢复,(.+?)那条(' + events + ')也恢复原归属$'));
    if(signup && entries.some(r=>r.owner===signup[1] && r.event===signup[3] && r.active)){
      step[entries.length]={人:signup[1],项目:signup[2]};
      entries.push({owner:signup[1],event:signup[2],active:true});
    }else if(reassign || removeWrong){
      const [_,who,event,dest]=(reassign ?? removeWrong)!;
      const matches=entries.flatMap((r,i)=>r.owner===who && r.event===event && r.active?[i]:[]);
      if(matches.length!==1)return;
      const i=matches[0];
      if(reassign){
        transfers.push({index:i,from:who});entries[i].owner=dest;step[i]={人:dest};
      }else{
        entries[i].active=false;step[i]={active:0};
      }
    }else if(restoreBoth){
      const removed=entries.flatMap((r,i)=>!r.active && r.owner===restoreBoth[1] && r.event===restoreBoth[2]?[i]:[]);
      const moved=transfers.filter(m=>m.from===restoreBoth[3] && entries[m.index].event===restoreBoth[4]);
      if(removed.length!==1 || moved.length!==1 || moved[0].index===removed[0])return;
      entries[removed[0]].active=true; step[removed[0]]={active:1};
      const {index,from}=moved[0];
      entries[index].owner=from; step[index]={人:'^'};
      transfers.splice(transfers.indexOf(moved[0]),1);
    }else if(added && entries.some(r=>r.owner===added[1] && r.event===added[2]) && entries.some(r=>r.owner===added[3])){
      step[entries.length]={人:added[3],项目:added[4]};entries.push({owner:added[3],event:added[4],active:true});
    }else if(owner){
      const ids=entries.flatMap((r,i)=>r.owner===owner[1] && r.event===owner[2] && r.active?[i]:[]);
      if(ids.length!==1 || !entries.some(r=>r.owner===owner[3] && r.event===owner[2]))return;
      const i=ids[0];transfers.push({index:i,from:owner[1]});entries[i].owner=owner[3];step[i]={人:owner[3]};
    }else if (add && entries.some((e) => e.active && e.owner === add[1] && e.event === add[2])) {
      step[entries.length] = { 人: add[1], 项目: add[3] };
      entries.push({ owner: add[1], event: add[3], active: true });
    } else if (ownerMove) {
      const ev = ownerMove[1] ?? ownerMove[4],
        dest = ownerMove[2] ?? ownerMove[5];
      const ids = entries.flatMap((e, i) =>
        e.active && e.event === ev && (!ownerMove[3] || e.owner === ownerMove[3]) ? [i] : [],
      );
      if (ids.length !== 1 || !entries.some((e) => e.owner === dest) || entries[ids[0]].owner === dest)
        return;
      const index = ids[0];
      transfers.push({ index, from: entries[index].owner });
      entries[index].owner = dest;
      step[index] = { 人: dest };
    } else if (transfer) {
      const ids = entries.flatMap((e, i) =>
        e.active && e.owner === transfer[1] && e.event === transfer[2] ? [i] : [],
      );
      if (ids.length !== 1 || !entries.some((e) => e.owner === transfer[3] && e.event === transfer[2]))
        return;
      transfers.push({ index: ids[0], from: transfer[1] });
      entries[ids[0]].owner = transfer[3];
      step[ids[0]] = { 人: transfer[3] };
    } else if (remove) {
      const ids = entries.flatMap((e, i) =>
        e.active && e.owner === remove[1] && e.event === remove[2] ? [i] : [],
      );
      if (ids.length !== 1) return;
      entries[ids[0]].active = false;
      step[ids[0]] = { active: 0 };
    } else if (undo) {
      const matches = transfers.filter((t) => entries[t.index].event === undo[1]);
      if (matches.length !== 1) return;
      const t = matches[0];
      entries[t.index].owner = t.from;
      step[t.index] = { 人: '^' };
      transfers.splice(transfers.indexOf(t), 1);
    } else return;
    if (/世界排名|练习计划|链接|我的账号/.test(turn)) return;
    steps.push(step);
  }
  return steps;
}

// Representation belongs to the competition observation, not the person's
// current profile. Keep a stable row for each station, including home events.
export function overseasVisits(turns: string[]): Step[] | undefined {
  const setup = turns[0];
  if (!/海外/.test(setup) || /虚拟|线上|连线|取消|缺席|没去|未参赛/.test(setup)) return;
  const data = setup.match(/代表([\p{L}]{1,6})时(?:去|在)([^。;]+)[。;]/u);
  const season = setup.match(
    /代表([\p{L}]{1,6})时在([\p{L}]{1,6})参加同一站.{1,3}项,([\p{L}]{1,6})另有([一二两三四五六七八九十\d]+)站[;。]/u,
  );
  if (season) {
    const count = integer(season[4]);
    if (count < 1 || count > 32) return;
    const first: Step = { a: { 当时代表地: season[1], 举办地: season[2] } };
    for (let i = 0; i < count; i++) first['b' + i] = { 当时代表地: season[1], 举办地: season[3] };
    const steps = [first];
    let later = 0;
    for (const turn of turns.slice(1)) {
      const more = turn.match(
        /^下一季她改代表([\p{L}]{1,6}),又回([\p{L}]{1,6})比了([一二两三四五六七八九十\d]+)站。/u,
      );
      const step: Step = {};
      if (more && !later) {
        later = integer(more[3]);
        if (later < 1 || later > 32) return;
        for (let i = 0; i < later; i++) step['c' + i] = { 当时代表地: more[1], 举办地: more[2] };
      } else if (/^第二季的两张成绩单其实来自同一站。/.test(turn) && later === 2) {
        step.c1 = { active: 0 };
      } else return;
      steps.push(step);
    }
    return steps;
  }
  if (!data) return;
  const rows: { country: string; venue: string; later: boolean }[] = [];
  const steps: Step[] = [{}];
  for (const text of data[2].split(/[、,]/)) {
    const match = text.match(new RegExp('^([\\p{L}]{1,6}?)(' + amount + ')(?:站|场)$', 'u'));
    if (!match || integer(match[2]) < 1 || integer(match[2]) + rows.length > 64) return;
    for (let i = 0; i < integer(match[2]); i++) {
      steps[0][rows.length] = { 当时代表地: data[1], 举办地: match[1] };
      rows.push({ country: data[1], venue: match[1], later: false });
    }
  }
  const secondPeriod = setup.match(/;(?:改|换)代表([\p{L}]{1,6}?)(?:以后|后)在([\p{L}]{1,6}?)(?:一|1)(?:场|站)。/u);
  if (setup.includes(';') && !secondPeriod) return;
  if (secondPeriod) {
    if (secondPeriod[1] === data[1]) return;
    steps[0][rows.length] = { 当时代表地: secondPeriod[1], 举办地: secondPeriod[2] };
    rows.push({ country: secondPeriod[1], venue: secondPeriod[2], later: true });
  }
  const inactive = new Set<number>();
  const moves: { index: number; old: string }[] = [];
  for (const turn of turns.slice(1)) {
    const step: Step = {};
    const arrival = turn.match(/改代表([\p{L}]{1,6}?)(?:以后|后)又在([\p{L}]{1,6}?)参加一场/u);
    const move = turn.match(/一场旧([\p{L}]{1,6}?)赛.{0,8}实际在([\p{L}]{1,6}?)办/u);
    const correction = turn.match(/^(?:换代表后|后段|后一段)(?:的)?那(?:场|站)(?:其实|实际)也?在([\p{L}]{1,6}?)(?:举行|举办)。/u);
    const duplicate = turn.match(/^(?:前段|前一段)在([\p{L}]{1,6}?)的两份成绩(?:实际|其实)?(?:属于|来自)同一(?:场|站)(?:同一ID)?。/iu);
    const undo = /只把那场举办地更正撤掉/.test(turn);
    const undoLater = turn.match(/^(?:撤回|撤销)后段改址,但([\p{L}]{1,6}?)的重复ID仍按一场。/iu);
    const recent = turn.match(/后来([\p{L}]{1,6}?)那场.{0,6}误录,其实也?在([\p{L}]{1,6}?)。/u);
    if (correction) {
      const later = rows.flatMap((row, i) => row.later && !inactive.has(i) ? [i] : []);
      if (later.length !== 1 || rows[later[0]].venue === correction[1]) return;
      const i = later[0];
      moves.push({ index: i, old: rows[i].venue });
      rows[i].venue = correction[1];
      step[i] = { 举办地: correction[1] };
    } else if (duplicate) {
      const pair = rows.flatMap((row, i) => !row.later && row.venue === duplicate[1] && !inactive.has(i) ? [i] : []);
      if (pair.length !== 2) return;
      inactive.add(pair[1]);
      step[pair[1]] = { active: 0 };
    } else if (arrival) {
      step[rows.length] = { 当时代表地: arrival[1], 举办地: arrival[2] };
      rows.push({ country: arrival[1], venue: arrival[2], later: true });
    } else if (move || recent) {
      const edit = (move ?? recent)!;
      const ids = rows.flatMap((r, i) => (!inactive.has(i) && r.later === !!recent && r.venue === edit[1] ? [i] : []));
      if (
        !ids.length ||
        ids.some((i) => rows[i].country !== rows[ids[0]].country) ||
        (recent && ids.length !== 1)
      )
        return;
      const i = ids[0];
      moves.push({ index: i, old: rows[i].venue });
      rows[i].venue = edit[2];
      step[i] = { 举办地: edit[2] };
    } else if ((undo || undoLater) && moves.length) {
      const last = moves.pop()!;
      if (undoLater && (!rows[last.index].later || ![...inactive].some(i => !rows[i].later && rows[i].venue === undoLater[1]))) return;
      rows[last.index].venue = last.old;
      step[last.index] = { 举办地: '^' };
    } else return;
    if (/城市|多少项|百分|哪一年|几天|奖金|链接|真实排名/.test(turn)) return;
    steps.push(step);
  }
  return steps;
}

export function fmcPositionChanges(turns: string[]): Step[] | undefined {
  const setup = turns[0].match(
    /(?:FMC平均里,|FMC平均的练习数据:|FMC平均,)([\p{L}]{1,8})(?:的三个位置填的是|的三张为|的三张解答依次|依次交了)(\d+、\d+、\d+)步?,([\p{L}]{1,8}?)(?:的)?是(\d+、\d+、\d+)步?。/u,
  );
  if (!setup || setup[1] === setup[3]) return;
  const initial: Step = {};
  for (const i of [1, 3]) {
    const [a, b, c] = setup[i + 1].split('、').map(Number);
    if (!a || !b || !c) return;
    initial[setup[i]] = { 人: setup[i], 轮: '原轮', 一: a, 二: b, 三: c };
  }
  const steps: Step[] = [initial];
  for (const turn of turns.slice(1)) {
    const change=turn.match(/^(.+?)(?:的)?(首|第[一二三])张(?:判无效|被取消了|(?:录错,)?实际[是为](\d+)步)[,。]/);
    const undo=turn.match(/^只恢复(.+?)(首|第[一二三])张的有效性[,。]/) ?? turn.match(/^把(.+?)(首|第[一二三])张放回[,。]/);
    const moved=turn.match(/^(.+?)的第([一二三])、([一二三])张移去别的轮,第([一二三])张仍在本轮/);
    if(change || undo){
      const m=(change ?? undo)!;
      if(!Object.hasOwn(initial,m[1]))return;
      steps.push({[m[1]]:{[m[2]==='首'?'一':m[2].slice(1)]:undo?'^':Number(m[3]??0)}});
      continue;
    }
    if(moved && Object.hasOwn(initial,moved[1]) && new Set(moved.slice(2)).size===3 && /本轮/.test(turn)){
      steps.push({[moved[1]]:{[moved[2]]:0,[moved[3]]:0}});
      continue;
    }
    const movedPair = turn.match(/^(.+?)的(首|第[一二三])张和(首|第[一二三])张(?:如果)?属于另一轮[,。]/);
    if (movedPair && Object.hasOwn(initial, movedPair[1]) && /本轮/.test(turn)) {
      const slots = movedPair.slice(2).map(slot => slot === '首' ? '一' : slot.slice(1));
      if (slots[0] === slots[1]) return;
      steps.push({ [movedPair[1]]: { [slots[0]]: 0, [slots[1]]: 0 } });
      continue;
    }
    const corrected = turn.match(/^(.+?)(?:的)?(第一|第二|第三)张的(\d+)其实是(\d+)。/);
    const restored = turn.match(/^我?只撤回(.+?)(?:的)?(第一|第二|第三)张的判罚[,。]/);
    const relocate = turn.match(/^把(.+?)的三个记录全移去另一轮,别跨轮取最短。/);
    if (
      corrected &&
      Object.hasOwn(initial, corrected[1]) &&
      initial[corrected[1]][corrected[2][1]] === +corrected[3]
    ) {
      steps.push({ [corrected[1]]: { [corrected[2][1]]: +corrected[4] } });
      continue;
    }
    if (restored && Object.hasOwn(initial, restored[1])) {
      steps.push({ [restored[1]]: { [restored[2][1]]: '^' } });
      continue;
    }
    if (relocate && Object.hasOwn(initial, relocate[1]) && /原来这一轮/.test(turn)) {
      steps.push({ [relocate[1]]: { 轮: '另一轮' } });
      continue;
    }
    const edit =
      turn.match(/^发现(.+?)的(首个|第二个|末个)解答无效,另外两张照旧。/) ??
      turn.match(/^(.+?)的(第一|第二|第三)张没签名,假定判无效。/);
    if (
      !edit ||
      !Object.hasOwn(initial, edit[1]) ||
      !/位置|均值|潜在平均/.test(turn) ||
      /规则|链接|另问/.test(turn)
    )
      return;
    const key = /首个|第一/.test(edit[2]) ? '一' : /第二/.test(edit[2]) ? '二' : '三';
    steps.push({ [edit[1]]: { [key]: 0 } });
  }
  return steps;
}

// Keep a transferred attempt even when a later correction invalidates its result.
export function successfulAttemptEdits(turns: string[]): Step[] | undefined {
  const samples = new RegExp('(' + events + ')([0-9]+)(?:把成功|次有效)(?:另)?([0-9]+)(?:把|次)(DNF|DNS)', 'g');
  const pairs = [...turns[0].matchAll(samples)];
  if(pairs.length < 2 || new Set(pairs.map(p=>p[1])).size!==pairs.length) return;
  const items: {event:string; state:string; original:string}[]=[];
  for(const [,event,valid,failed,state] of pairs) {
    if(items.length + Number(valid)+Number(failed)>64)return;
    for(const [count,status] of [[Number(valid),'有效'],[Number(failed),state]] as const)
      for(let i=0;i<count;i++)items.push({event,state:status,original:status});
  }
  const snapshot = ():Step => Object.fromEntries(pairs.map(([,event])=>[event,{项目:event,成功数:items.filter(i=>i.event===event && i.state==='有效').length,DNF:items.filter(i=>i.event===event && i.state==='DNF').length}]));
  const steps=[snapshot()];
  let edited:typeof items[number]|undefined;
  for(const turn of turns.slice(1)){
    const action=turn.split(/[。?]/)[0];
    const correction=action.match(new RegExp('^(?:我把|把)?(' + events + ')的(DNS|DNF)改成有效(?:,|$)')) ??
      action.match(new RegExp('^(?:[两二三四五0-9]+条)?(' + events + ')(DNF|DNS)(?:有一条|其中一把)(?:补回|改成)有效'));
    const transfer=action.match(new RegExp('^(?:把)?刚改为有效的(?:那条|那把)(?:归到|移到)(' + events + ')(?:,|$)'));
    const completed=action.match(new RegExp('^(' + events + ')失败的那次(?:其实)?完成了(?:,|$)'));
    const moved=action.match(new RegExp('^刚补的这次(?:实际)?拿的是(' + events + ')(?:,|$)'));
    const allFailed=action.match(new RegExp('^(?:现在)?(' + events + ')([两一二三四五六七八九十\\d]+)条DNS都改为DNF$'));
    if(completed){
      const possible=items.filter(i=>i.event===completed[1] && i.state==='DNF');
      if(possible.length!==1)return;
      edited=possible[0];
      edited.state='有效';
    }else if(moved && edited && pairs.some(p=>p[1]===moved[1])){
      edited.event=moved[1];
    }else if(/^只取消[“"]完成了[”"]的更正/.test(action) && edited){
      edited.state=edited.original;
    }else if(allFailed){
      const attempts=items.filter(i=>i.event===allFailed[1] && i.state==='DNS');
      if(attempts.length!==integer(allFailed[2]))return;
      for(const item of attempts)item.state='DNF';
    }else if(correction){
      edited=items.find(i=>i.event===correction[1] && i.state===correction[2]);
      if(!edited)return;
      edited.state='有效';
    }else if(transfer && edited && pairs.some(p=>p[1]===transfer[1]))edited.event=transfer[1];
    else if(/^只撤[回销]结果改有效,项目仍/.test(action) && edited)edited.state=edited.original;
    else return;
    steps.push(snapshot());
  }
  return steps;
}
