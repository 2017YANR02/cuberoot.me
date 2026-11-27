import { namedWeekEdits, roundEntries, witnessedRecordEdits, visitedCountryEdits, compactPodiums, dayListEdits, fourthPlaceEdits, medalCountEdits, recordSequenceEdits, weeklyCompetitionEdits } from './site_assistant_competition_edits.js';
import { successfulAttemptEdits, attemptedStatusChanges, countedTimes, fmcPositionChanges, overseasVisits, rosterEdits } from './site_assistant_attempt_edits.js';
// These examples identify individual attempts even when the setup gives a
// count. A correction to one attempt must not change its whole group.
type Row = Record<string, string | number>;
type Step = Record<string, Row>;
const digit = (s: string) =>
  /^\d+$/.test(s) ? Number(s) : '零一二三四五六七八九十'.indexOf(s.replace('两', '二'));
const normalize = (s: string) => s.normalize('NFKC').replace(/\s/g, '');
function frequency(turns: string[]): Step[] | undefined {
  const [setup, ...edits] = turns;
  if (!/最常出现的成绩/.test(setup) || !/只看.{1,4}阶哪种最多,多少次\?$/.test(setup)) return;
  const segments = setup
    .slice(setup.indexOf(':') + 1)
    .split('。')[0]
    .split(';');
  const rows: { event: string; time: string; original: string }[] = [];
  for (const segment of segments) {
    const match = segment.match(/^([二三四五六七]阶)有(.+)$/);
    if (!match) return;
    const tokens = match[2].split(/和|、|,另有/);
    for (const token of tokens) {
      const item = token.match(/^([一二两三四五六七八九十]|\d{1,2})(?:把|次)(\d+\.\d\d|DNF|DNS)$/i);
      if (!item || !digit(item[1]) || digit(item[1]) + rows.length > 64) return;
      for (let n = 0; n < digit(item[1]); n++)
        rows.push({ event: match[1], time: item[2], original: item[2] });
    }
  }
  const steps: Step[] = [
    Object.fromEntries(rows.map((r, i) => [i, { 项目: r.event, 成绩: r.time, 次数: 1 }])),
  ];
  let changed: number[] = [],
    moved: number[] = [];
  for (const edit of edits) {
    const [action, question, ...extra] = edit.split('。');
    if (
      !question ||
      extra.some(Boolean) ||
      !/^(?:[二三四五六七]阶|此时|现在)/.test(question) ||
      !/(?:频次|几次|谁多|变了吗)/.test(question) ||
      /为什么|来源|排名第|百分|多少秒|还能|另问|再问/.test(question)
    )
      return;
    const correction = action.match(
      /^(?:有)?([一二两三四五六七八九十\d]+)把(?:原先写作|原来记为|之前录成)(\d+\.\d\d),(?:其实都是|实际都是|应为)(\d+\.\d\d)$/,
    );
    const transfer = action.match(
      /^(?:纠正过的|刚改过的|更正的)[一二两三四五六七八九十\d]+把(?:当中|之中|里),([一二两三四五六七八九十\d]+)把(?:其实属于|应当归入|实际是)([二三四五六七]阶)$/,
    );
    const restore = action.match(/^只撤回这把的改秒,不撤它的项目更正$/);
    const valid = action.match(/^把最开始那个([二三四五六七]阶)(DNF|DNS)补成(\d+\.\d\d)$/);
    const step: Step = {};
    if (correction) {
      const from = setup.match(/只看([二三四五六七]阶)/)?.[1];
      const n = digit(correction[1]);
      changed = rows.flatMap((r, i) => (r.event === from && r.time === correction[2] ? [i] : [])).slice(0, n);
      if (n < 1 || changed.length !== n) return;
      for (const i of changed) {
        rows[i].time = correction[3];
        step[i] = { 成绩: correction[3] };
      }
    } else if (transfer) {
      const n = digit(transfer[1]);
      moved = changed.slice(0, n);
      if (n < 1 || moved.length !== n) return;
      for (const i of moved) {
        rows[i].event = transfer[2];
        step[i] = { 项目: transfer[2] };
      }
    } else if (restore && moved.length === 1) {
      const i = moved[0];
      rows[i].time = rows[i].original;
      step[i] = { 成绩: '^' };
    } else if (valid) {
      const candidates = rows.flatMap((r, i) => (r.event === valid[1] && r.time === valid[2] ? [i] : []));
      if (candidates.length !== 1) return;
      const i = candidates[0];
      rows[i].time = valid[3];
      step[i] = { 成绩: valid[3] };
    } else return;
    steps.push(step);
  }
  return steps;
}

function roundAverages(turns: string[]): Step[] | undefined {
  const [setup, ...edits] = turns;
  const data = setup.match(/同场([一二三四\d])轮的.{0,6}平均分别是(.+?)。[^。]*Ao[234]R怎么算,差几秒\?$/i);
  const pair = setup.match(/同场(?:打满)?([一二两三四\d])轮(?:平均:|,)([^。]+)。/);
  if (!data && !pair) return;
  const count = digit((data ?? pair)![1]),
    first: Step = {},
    people = new Map<string, number[]>();
  for (const chunk of (data ?? pair)![2].split(/[,;]/)) {
    const m = chunk.match(/^([\p{L}]{1,8})([\d.]+(?:、[\d.]+)+)秒$/u);
    const pairValues=pair && chunk.match(/^([\p{L}]{1,8}?)(?:的平均成绩)?(?:是|为)([\d.]+(?:秒?(?:和|、)[\d.]+)+)秒$/u);
    const parsed = pairValues || m;
    if (!parsed) return;
    const scores = parsed[2].split(/秒?(?:和|、)/).map(Number);
    if (people.has(parsed[1]) || scores.length !== count || !scores.every((v) => Number.isFinite(v) && v > 0))
      return;
    people.set(parsed[1], scores);
    scores.forEach(
      (v, i) => (first[parsed[1] + i] = { 人: parsed[1], 场: '本场', 轮次: i + 1, 用时: v, 总轮数: count }),
    );
  }
  if (people.size !== 2) return;
  const steps: Step[] = [first],
    invalid = new Map<string, string>();
  for (const edit of edits) {
    if (/为什么|顺便|概率|排名第|纪录|还想知道|另外问/.test(edit)) return;
    const step: Step = {};
    const voided = edit.match(/^(.+?)的([\d.]+)秒被改成无有效平均了。[^。]*Ao[234]R吗\?[^。]*变吗\?$/);
    const corrected = edit.match(
      /^(.+?)的(?:末轮|最后一轮)(?:录[快慢]了,实际|更正为|应为)([\d.]+)秒。[^。]*合格,是多少\?$/,
    );
    const restore = edit.match(/^撤回(.+?)那笔判罚,(.+?)的([\d.]+)秒照留。重报两项和领先差[。]?$/);
    const extra = edit.match(
      /^(?:刚发现比赛其实还有|比赛加开|还有)第([一二三四\d])轮,只有(.+?)晋级(?:并取得|,用时|并拿到)([\d.]+)秒。[^。]*Ao[234]R[^。]*多少\?$/i,
    );
    const indexed = edit.match(/^(.+?)(?:的)?(首|第[一二三四])轮(?:的?平均)?(?:被判无效|无效了|更正为([\d.]+)秒)/);
    const undoScore = edit.match(/^只撤回(.+?)那次改秒[,。]/);
    const another = edit.match(/(?:还有|加开)第([一二三四])轮,仅(.+?)打了并取得([\d.]+)秒平均/);
    const penalty=edit.match(/^(.+?)的首轮漏加([\d.]+)秒,/);
    const addedRound=edit.match(/还有第([一二三四])轮,(.+?)取得([\d.]+)秒,(.+?)未晋级/);
    const restoreRound=edit.match(/^只撤[回销](.+?)第([一二三四])轮的无效判定/);
    if(penalty && people.has(penalty[1]) && !steps.slice(1).some(s=>s[penalty[1]+'0'])){
      step[penalty[1]+'0']={用时:people.get(penalty[1])![0]+Number(penalty[2])};
    }else if(addedRound && digit(addedRound[1])===count+1 && people.has(addedRound[2]) && people.has(addedRound[4]) && addedRound[2]!==addedRound[4]){
      step[addedRound[2]+count]={人:addedRound[2],场:'本场',轮次:count+1,总轮数:count+1,用时:Number(addedRound[3])};
    }else if(restoreRound && people.has(restoreRound[1])){
      const id=restoreRound[1]+(digit(restoreRound[2])-1);
      if(steps.filter(change=>change[id]).at(-1)?.[id].用时!==0)return;
      step[id]={用时:'^'};
    }else if (indexed && people.has(indexed[1])) {
      const n=indexed[2]==='首'?1:digit(indexed[2].slice(1));
      if(n<1 || n>count)return;
      step[indexed[1]+(n-1)]={用时:indexed[3]?Number(indexed[3]):0};
    } else if(undoScore && people.has(undoScore[1])) {
      const scoreEdits=steps.slice(1).flatMap(change=>Object.entries(change).filter(([k,v])=>first[k]?.人===undoScore[1] && Number(v.用时)>0));
      if(scoreEdits.length!==1)return;
      step[scoreEdits[0][0]]={用时:'^'};
    } else if(another && digit(another[1])===count+1 && people.has(another[2]) && count<4) {
      step[another[2]+count]={人:another[2],场:'本场',轮次:count+1,总轮数:count+1,用时:Number(another[3])};
    } else if (voided) {
      const rs = people.get(voided[1]);
      if (!rs) return;
      const indexes = rs.flatMap((v, i) => (v === Number(voided[2]) ? [i] : []));
      if (indexes.length !== 1) return;
      const id = voided[1] + indexes[0];
      invalid.set(voided[1], id);
      step[id] = { 用时: 0 };
    } else if (corrected && people.has(corrected[1])) {
      const values = people.get(corrected[1])!;
      values[count - 1] = Number(corrected[2]);
      step[corrected[1] + (count - 1)] = { 用时: Number(corrected[2]) };
    } else if (restore && invalid.has(restore[1]) && people.get(restore[2])?.at(-1) === Number(restore[3])) {
      step[invalid.get(restore[1])!] = { 用时: '^' };
      invalid.delete(restore[1]);
    } else if (extra && people.has(extra[2]) && digit(extra[1]) === count + 1 && count < 4) {
      step[extra[2] + count] = {
        人: extra[2],
        场: '本场',
        轮次: count + 1,
        总轮数: count + 1,
        用时: Number(extra[3]),
      };
    } else return;
    steps.push(step);
  }
  return steps;
}

// Each key is one person's participation in one event. Running another
// round is idempotent; adding an event never overwrites an existing entry.
function participationSteps(turns: string[]): Step[] | undefined {
  const [setup, ...changes] = turns;
  const roster = setup.match(
    /(?:一场只有|同场只有|参赛名单[为:])([^。？?]+)[。?](?:分母几人、平均几项|平均几项|每人平均几项)\?$/,
  );
  if (!roster) return;
  const first: Step = {},
    live = new Set<string>(),
    people = new Set<string>();
  const event = /^(?:[二三四五六七]阶|单手|三盲|四盲|五盲|时钟|斜转|金字塔)$/;
  const key = (person: string, ev: string) => person + '-' + ev;
  for (const clause of roster[1].split(/[,;]/)) {
    const part = clause.match(/^([\p{L}]{1,8}?)(?:只比|比|参加了?|报了)(.+)$/u);
    if (!part || people.has(part[1])) return;
    people.add(part[1]);
    for (const ev of part[2].split(/和|与|、/)) {
      if (!event.test(ev)) return;
      const id = key(part[1], ev);
      live.add(id);
      first[id] = { 人: part[1], 项目: ev };
    }
  }
  const steps: Step[] = [first];
  for (const turn of changes) {
    const [statement, ask, ...rest] = turn.split('。');
    if (
      !ask ||
      rest.some(Boolean) ||
      !/^(?:哪(?:件|个|项).{0,7}(?:均值|平均)(?:,新值呢|,现在多少)?|(?:这次)?人数和平均会变吗|.{0,4}人分别几项,新平均呢|现在统计到几人、合计几项、平均多少)\?$/.test(
        ask,
      ) ||
      /排名|百分|奖金|时间|为什么.*(?:规则|链接)/.test(ask)
    )
      return;
    const add = statement.match(
      /^(.+?)的(.+?)(?:多跑|多比|又比)了?一轮,(?:还|又|另外)(?:参加了?|报了|新增了?)(.+)$/,
    );
    const transfer = statement.match(/^(.+?)的(.+?)其实是(.+?)的(.+?)(?:,两个选手都没有别的(.+?)记录)?$/);
    const remove = statement.match(
      /^(?:撤回|撤销|去掉)(.+?)([二三四五六七]阶|单手|三盲|四盲|五盲|时钟|斜转|金字塔)(?:那条|的?参赛记录)?(?:,但(.+?)归属沿用更正)?$/,
    );
    const merge = statement.match(/^(.+?)唯一一条(.+?)也?移给(.+?),他本来就有(.+)$/);
    const step: Step = {};
    if (add && people.has(add[1]) && live.has(key(add[1], add[2])) && event.test(add[3])) {
      const id = key(add[1], add[3]);
      live.add(id);
      step[id] = { 人: add[1], 项目: add[3], active: 1 };
    } else if (transfer || merge) {
      const m = (transfer || merge)!;
      if (
        !live.has(key(m[1], m[2])) ||
        !people.has(m[3]) ||
        m[1] === m[3] ||
        m[2] !== m[4] ||
        (m[5] && m[5] !== m[2])
      )
        return;
      const old = key(m[1], m[2]),
        dest = key(m[3], m[2]);
      if ((merge && !live.has(dest)) || (transfer?.[5] && live.has(dest))) return;
      live.delete(old);
      live.add(dest);
      step[old] = { active: 0 };
      step[dest] = { 人: m[3], 项目: m[2], active: 1 };
    } else if (
      remove &&
      live.has(key(remove[1], remove[2])) &&
      (!remove[3] || live.has(key(remove[1], remove[3])))
    ) {
      const id = key(remove[1], remove[2]);
      live.delete(id);
      step[id] = { active: 0 };
    } else return;
    steps.push(step);
  }
  return steps;
}

export function suppliedScenarioSteps(id: string, turns: readonly string[]) {
  const normalized = turns.map(normalize);
  if (id === 'recon-about') return wholeSolveEdits(normalized);
  if (id === 'potentially_seen_world_records') return witnessedRecordEdits(normalized);
  if (id === 'most_visited_countries') return visitedCountryEdits(normalized);
  if (id === 'most_4th_places') return fourthPlaceEdits(normalized) ?? roundEntries(normalized, true);
  if (id === 'most_finals') return roundEntries(normalized, false);
  if (id === 'most_podiums_together') return compactPodiums(normalized);
  if (id === 'first_r_is_wr') return recordSequenceEdits(normalized);
  if (id === 'average_event_count_by_competition') return participationSteps(normalized) ?? rosterEdits(normalized);
  if (id === 'smallest_diff_between_single_and_average') return roundGaps(normalized);
  if (id === 'best_potential_fmc_mean') return fmcPositionChanges(normalized);
  if (id === 'most_competitions_abroad') return overseasVisits(normalized);
  if (id === 'dnf_rate_by_event') return attemptedStatusChanges(normalized);
  if (id === 'most_completed_solves') return successfulAttemptEdits(normalized);
  if (id === 'most_frequent_results') return frequency(normalized) ?? countedTimes(normalized);
  if (id === 'most_attended_competitions_in_single_week') return weeklyCompetitionEdits(normalized) ?? dayListEdits(normalized) ?? namedWeekEdits(normalized);
  if (id === 'most_podiums_at_single_competition') return podiumCounts(normalized) ?? medalCountEdits(normalized);
  if (id === 'wr_aoxr') return roundAverages(normalized);
}

function podiumCounts(turns: string[]): Step[] | undefined {
  const initial = turns[0].split('。')[0];
  const entries = [...initial.matchAll(/([\p{L}]{1,8}赛)(?:我)?拿了(\d+)个(?:项目的有效决赛奖牌)?/gu)];
  if (entries.length !== 2 || !/两站各差几个\?$/.test(turns[0])) return;
  const [a, b] = entries.map((m) => m[1]),
    counts = new Map(entries.map((m) => [m[1], Number(m[2])]));
  if (a === b) return;
  const steps: Step[] = [Object.fromEntries([...counts].map(([site, n]) => [site, { 场: site, 奖牌数: n }]))];
  const additions = new Map<string, number>();
  let lastSite: string | undefined,
    removed = false;
  for (const edit of turns.slice(1)) {
    const [action, question, ...rest] = edit.replace(/,(?=移动后谁仍过线)/, '。').split('。');
    if (
      rest.some(Boolean) ||
      !question ||
      !/^(?:更新.{1,8}的数量和资格|现在.{1,8}多少,.{1,8}会补上这个缺口吗\?|两站各有几枚合格奖牌\?|移动后谁仍过线\?两站各差几枚\?)$/.test(
        question,
      )
    )
      return;
    const add = action.match(/^(.+?赛)还漏了([一二两三四五六七八九十\d]+)个不同项目的决赛[金银铜]牌$/);
    const demote = action.match(/^漏掉的第([一二三四五六七八九十\d]+)枚原来只是半决赛的第[一二三123]$/);
    const restore = action.match(
      /^把刚才半决赛的更正作废,那枚确为决赛[金银铜]牌;同时(.+?)(?:[一二三四五六七八九十\d]+)枚中的一枚改成第四$/,
    );
    const transfer = action.match(/^(.+?)新增的第([一二三四五六七八九十\d]+)枚其实属于(.+?)的一个新项目$/);
    const find = (abbr: string) => [a, b].filter((k) => k === abbr || k === abbr + '赛');
    const step: Step = {};
    const change = (key: string, n: number) => {
      const value = counts.get(key)! + n;
      counts.set(key, value);
      step[key] = { 奖牌数: value };
    };
    if (add && counts.has(add[1]) && digit(add[2]) > 0) {
      lastSite = add[1];
      additions.set(lastSite, digit(add[2]));
      change(lastSite, digit(add[2]));
    } else if (demote && lastSite && !removed && digit(demote[1]) <= additions.get(lastSite)!) {
      removed = true;
      change(lastSite, -1);
    } else if (restore && removed && lastSite && find(restore[1]).length === 1) {
      removed = false;
      change(lastSite, 1);
      change(find(restore[1])[0], -1);
    } else if (
      transfer &&
      lastSite &&
      find(transfer[1])[0] === lastSite &&
      find(transfer[3]).length === 1 &&
      !removed &&
      digit(transfer[2]) <= additions.get(lastSite)!
    ) {
      change(lastSite, -1);
      change(find(transfer[3])[0], 1);
      additions.set(lastSite, additions.get(lastSite)! - 1);
    } else return;
    steps.push(step);
  }
  return steps;
}

// The page describes both timestamp and frame-rate modes. This arithmetic
// applies only to constant-rate footage and an integer number of intervals.
function fixedFrameExample(turns: string[]) {
  const setup = turns[0].match(
    /视频固定([\d.]+)fps,我只知道结束在第(\d+)帧、计时器用时([\d.]+)秒。反推起帧是多少,能用这个起帧独立证明([\d.]+)秒正确吗\?$/i,
  );
  const sample=setup ?? turns[0].match(/固定([\d.]+)fps,视频终点第(\d+)帧,计时器报([\d.]+)秒。/i);
  if (!sample || (setup && +setup[3] !== +setup[4])) return;
  let fps = +sample[1],
    end = +sample[2],
    seconds = +sample[3],
    observedStart: number | undefined;
  const original = seconds;
  let before = end - seconds * fps;
  for (const turn of turns.slice(1)) {
    before = end - seconds * fps;
    const time = turn.match(/^计时器读错了,应为([\d.]+)秒,结束标记没动。起点往哪个方向移动了多少帧\?$/);
    const rate = turn.match(/^实测帧率是([\d.]+)fps,继续用([\d.]+)秒。重新给出跨越帧数和起点。?$/i);
    const revert = turn.match(
      /^撤回用时更正,保留([\d.]+)fps,又把结束点往([前后])挪(\d+)帧。当前两个端点各在哪里\?$/i,
    );
    const observed = turn.match(
      /^现在独立从画面认出起点是第(\d+)帧。保持刚才的终点和帧率,实测时长和计时器差多少\?$/,
    );
    const earlierEnd=turn.match(/^终点发现晚标了(\d+)帧,要往前移。仍用([\d.]+)秒/);
    const measuredRate=turn.match(/^摄像机实际是([\d.]+)fps,沿用修过的终点。/i);
    const undoEnd=turn.match(/^只撤回终点挪动,帧率坚持([\d.]+)。/);
    const measured=turn.match(/^画面独立读到实际起点在第(\d+)帧,终点(\d+)没动。/);
    if(earlierEnd && seconds===+earlierEnd[2])end-=Number(earlierEnd[1]);
    else if(measuredRate)fps=Number(measuredRate[1]);
    else if(undoEnd && fps===+undoEnd[1])end=Number(sample[2]);
    else if(measured && end===+measured[2])observedStart=Number(measured[1]);
    else if (time) seconds = +time[1];
    else if (rate && +rate[2] === seconds) fps = +rate[1];
    else if (revert && +revert[1] === fps) {
      seconds = original;
      end += (revert[2] === '前' ? -1 : 1) * Number(revert[3]);
    } else if (observed) observedStart = +observed[1];
    else return;
  }
  const span = seconds * fps,
    start = end - span;
  if (!Number.isInteger(span) || start < 0 || !(seconds > 0 && fps > 0)) return;
  if (observedStart !== undefined) {
    if (observedStart > end) return;
    const duration = (end - observedStart) / fps,
      delta = duration - seconds;
    return (
      '从第 ' +
      observedStart +
      ' 帧到第 ' +
      end +
      ' 帧，实测 ' +
      (end - observedStart) +
      ' ÷ ' +
      fps +
      ' = ' +
      Number(duration.toFixed(4)) +
      ' 秒，' +
      (delta === 0
        ? '与计时器相同。'
        : '比计时器' + (delta > 0 ? '长 ' : '短 ') + Number(Math.abs(delta).toFixed(4)) + ' 秒。')
    );
  }
  return (
    '结束在第 ' +
    end +
    ' 帧，跨越 ' +
    fps +
    ' × ' +
    seconds +
    ' = ' +
    span +
    ' 帧，反推起点为第 ' +
    start +
    ' 帧。' +
    (before === start
      ? ''
      : '较上一版往' + (start > before ? '后' : '前') + '移动 ' + Math.abs(start - before) + ' 帧。') +
    '反推使用了计时器用时，不能独立验证该用时。'
  );
}

function roundGaps(turns: string[]): Step[] | undefined {
  const match = turns[0].match(/同一个.{1,6}选手两轮的最佳与平均为(.+?)。各差几秒,谁更靠前\?$/);
  const paired=turns[0].match(/同人同项目([^。]+)。/) ?? turns[0].match(/差距,([^。]+)。/);
  const pairs=(match ?? paired)?.[1].replace(/轮最佳/g,'轮').replace(/、平均(?=[\d.])/g,'/');
  if (!match && !paired) return;
  const values = new Map<string, { best: number; average: number }>(),
    first: Step = {};
  for (const pair of pairs!.split(/[、,]/)) {
    const m = pair.match(/^([\p{L}]{1,8})([\d.]+)(?:\/|与)([\d.]+)$/u);
    if (!m || values.has(m[1])) return;
    values.set(m[1], { best: +m[2], average: +m[3] });
    first[m[1]] = { 轮: m[1], 最佳: +m[2], 平均: +m[3] };
  }
  if (values.size !== 2) return;
  const steps: Step[] = [first];
  for (const edit of turns.slice(1)) {
    const patchAverage = edit.match(/^(.+?)的平均实际是([\d.]+)。更正后领先的是哪轮,比另一轮少多少秒\?$/);
    const patchBest = edit.match(/^(.+?)的最佳录[快慢]了,应为([\d.]+)。现在.{1,8}差多少,和.{1,8}相差多少\?$/);
    const undo = edit.match(
      /^把(.+?)平均的更正作废、(.+?)的改动保留。两轮差距各是多少\?单按差距能分出先后吗\?$/,
    );
    const bestEdit=edit.match(/^(.+?轮)最佳其实是([\d.]+),平均[\d.]+没动/);
    const averageEdit=edit.match(/^(.+?)的[\d.]+是误抄,平均应为([\d.]+)。/);
    const undoBest=edit.match(/^只撤回(.+?)的最佳更正,/);
    const named=(s:string)=>values.has(s)?s:s+'轮';
    const revisedAverage=edit.match(/^(.+?轮)平均重录为([\d.]+),最佳不改/);
    const revisedBest=edit.match(/^(.+?轮)最佳不是([\d.]+)而是([\d.]+)。/);
    const undoAverage=edit.match(/^只撤回(.+?轮)平均的重录,/);
    if(revisedAverage && values.has(revisedAverage[1]))steps.push({[revisedAverage[1]]:{平均:Number(revisedAverage[2])}});
    else if(revisedBest && values.get(revisedBest[1])?.best===Number(revisedBest[2]))steps.push({[revisedBest[1]]:{最佳:Number(revisedBest[3])}});
    else if(undoAverage && values.has(undoAverage[1]))steps.push({[undoAverage[1]]:{平均:'^'}});
    else if(/拿.+?轮最佳去配.+?轮平均/.test(edit) && /能这样配吗/.test(edit))steps.push({});
    else if(bestEdit && values.has(bestEdit[1]))steps.push({[bestEdit[1]]:{最佳:Number(bestEdit[2])}});
    else if(averageEdit && values.has(named(averageEdit[1])))steps.push({[named(averageEdit[1])]:{平均:Number(averageEdit[2])}});
    else if(undoBest && values.has(named(undoBest[1])))steps.push({[named(undoBest[1])]:{最佳:'^'}});
    else if (patchAverage && values.has(patchAverage[1]))
      steps.push({ [patchAverage[1]]: { 平均: +patchAverage[2] } });
    else if (patchBest && values.has(patchBest[1])) steps.push({ [patchBest[1]]: { 最佳: +patchBest[2] } });
    else if (undo && values.has(undo[1]) && values.has(undo[2]) && undo[1] !== undo[2])
      steps.push({ [undo[1]]: { 平均: '^' } });
    else if (
      /^如果有人拿.{1,8}的最佳去减.{1,8}的平均,说得到另一条榜上差距,该接受吗\?两项必须满足什么配对条件\?$/.test(
        edit,
      )
    )
      steps.push({});
    else return;
  }
  return steps;
}

function countFinals(turns: string[]) {
  const setup = turns[0].match(
    /同场([二三四五六七]阶)有预赛和决赛,([二三四五六七]阶)只有一轮且标记为决赛,([二三四五六七]阶)只打到半决赛。总共多少次\?只算比赛场次会对吗\?$/,
  );
  if (!setup || new Set(setup.slice(1)).size !== 3) return;
  const entries = new Map<string, boolean>([
    [setup[1], true],
    [setup[2], true],
    [setup[3], false],
  ]);
  const later: string[] = [];
  let previous = 2;
  for (const edit of turns.slice(1)) {
    previous = [...entries.values()].filter(Boolean).length + later.length;
    const dnf = edit.match(/^我的([二三四五六七]阶)决赛所有尝试后来都改为DNF,决赛行保留。数量要减一吗\?$/);
    const final = edit.match(
      /^([二三四五六七]阶)记录其实是综合决赛,有决赛标记。与前版相比现在多几次,总数多少\?$/,
    );
    const remove = edit.match(
      /^把([二三四五六七]阶)的轮次改回半决赛,([二三四五六七]阶)这行查实是同名别人的。现在本人剩哪项,多少次\?$/,
    );
    const add = edit.match(
      /^另一天还参加了一场同项目([二三四五六七]阶)决赛并成功。它能单独加一次吗\?把个人决赛数和涉及的比赛数都报一下。$/,
    );
    if (dnf && entries.get(dnf[1])) continue;
    if (final && entries.has(final[1])) entries.set(final[1], true);
    else if (remove && entries.has(remove[1]) && entries.has(remove[2])) {
      entries.set(remove[1], false);
      entries.delete(remove[2]);
    } else if (add && entries.has(add[1])) later.push(add[1]);
    else return;
  }
  const events = [...entries].filter(([, v]) => v).map(([k]) => k),
    n = events.length + later.length;
  return (
    '原场比赛计入' +
    (events.join('、') || '零项') +
    '，其他场另计 ' +
    later.length +
    ' 次。个人决赛共 ' +
    n +
    ' 次，涉及 ' +
    (Number(events.length > 0) + later.length) +
    ' 场比赛。' +
    (turns.length > 1
      ? n === previous
        ? '总次数与上版相同。'
        : '比上版' + (n > previous ? '增加 ' : '减少 ') + Math.abs(n - previous) + ' 次。'
      : '') +
    '按本人的决赛成绩行计数，同场不同项目分别计算，所有尝试 DNF 也保留出场次数。'
  );
}

export function suppliedGuideCorrection(page: { href: string; text: string }, userTurns: readonly string[]) {
  const turns = userTurns.map(normalize),
    q = turns.at(-1) ?? '';
  const phase = q.match(/(PLL|OLL|F2L)阶段更快/i)?.[1];
  if (page.href === '/recon-about' && phase && /仅以上数据|只知道.*整局/.test(q) &&
      /阶段TPS/i.test(q) && turns.slice(0,-1).every(t=>!/PLL|OLL|F2L/i.test(t)) &&
      /整局/.test(turns[0]) && page.text.includes('总时间与步数可以算整体 TPS')) {
    return '现有整局数据不足。比较谁的 '+phase+' 耗时更短，需要两人各自的阶段用时；比较阶段 TPS，还需要两人的阶段步数，再分别用步数除以用时。';
  }
  if (page.href === '/wca/about/most_finals' && page.text.includes('round_types.final'))
    return countFinals(turns);
  if (page.href === '/scramble/batch-solver' && /建表深度/.test(page.text)) {
    const moves = q.match(
      /^两行都只允许([RUFLBD](?:、[RUFLBD])+)。把两行上限相加当一次搜索的长度正确吗\?对必须用([RUFLBD])才可解的目标,这两行能保证出解吗\?$/,
    );
    if (moves && !moves[1].includes(moves[2]))
      return (
        '两行分别搜索，各自的上限等于该行建表深度加搜索深度，不能把两行上限相加。两行都只允许 ' +
        moves[1] +
        '，所以对必须用 ' +
        moves[2] +
        ' 的目标，两行都无法给出解。'
      );
  }
  if (page.href === '/frame-count-about' && page.text.includes('反推起点依赖你输入的成绩'))
    return fixedFrameExample(turns);
  if (
    page.href.endsWith('/potentially_seen_world_records') &&
    page.text.includes('同场多项目不重复') &&
    /^新来的.{1,8}站我有参赛记录,但只有洲际纪录。它能增加哪怕一次吗\?能从这个榜证明我亲眼看到.{1,8}的纪录吗\?$/.test(
      q,
    )
  )
    return '这站增加 0 次。洲际纪录没有 WR 标记。同场参赛只说明可能目击，不能由榜单证明你亲眼看到了纪录。';
  if (
    page.href.endsWith('/most_competitions_before_winning') &&
    page.text.includes('pos = 1 AND best > 0') &&
    turns.length === 2
  ) {
    const setup = turns[0].match(
      /站按时间为([\p{L}、]+)。我在每站都比([二三四五六七]阶),决赛分别(第\d+(?:、第\d+)+),成绩有效。首冠在哪,之前算几站\?$/u,
    );
    const correction = q.match(
      /^(.+?)站的第(\d+)其实是([二三四五六七]阶),我那天没有参加([二三四五六七]阶)。首冠前还剩几站\?$/,
    );
    if (!setup || !correction || setup[2] !== correction[4] || correction[3] === setup[2]) return;
    const sites = setup[1].split('、'),
      places = setup[3].split('、').map((v) => Number(v.slice(1)));
    const changed = sites.indexOf(correction[1]);
    if (
      changed < 0 ||
      new Set(sites).size !== sites.length ||
      places.length !== sites.length ||
      places[changed] !== +correction[2]
    )
      return;
    const remaining = sites.filter((_, i) => i !== changed),
      win = remaining.findIndex((s) => places[sites.indexOf(s)] === 1);
    if (win < 0) return '更新后尚无该项目有效决赛冠军，不产生首冠等待场数。';
    return (
      '首冠仍按该项目有效决赛第一计算，落在' +
      remaining[win] +
      '站。在此之前参加的是' +
      (remaining.slice(0, win).join('、') || '零站') +
      '，共 ' +
      win +
      ' 站。'
    );
  }
}

function wholeSolveEdits(turns:string[]):Step[]|undefined{
  const setup=turns[0].match(/整局(?:时|:)([^。?]+)[。?]/);
  if(!setup)return;
  const records:Step={};
  for(const m of setup[1].matchAll(/(?:^|,)([\p{L}]{1,8}?)做了?([\d]+)步用了?([\d.]+)秒/gu)){
    if(records[m[1]] || !(+m[2]>0 && +m[3]>0))return;
    records[m[1]]={人:m[1],步数:+m[2],秒:+m[3]};
  }
  if(Object.keys(records).length!==2)return;
  const steps=[records];
  for(const t of turns.slice(1)){
    const q=t.split('。')[0];
    const cut=q.match(/^(.+?)有同一转动被重复计(\d+)步,/) ?? q.match(/^(.+?)的步数里有(\d+)步被抄了两次,删掉重复的那份$/);
    const missing=q.match(/^(.+?)的用时漏掉([\d.]+)秒,加回去$/);
    const elapsed=q.match(/^(.+?)的([\d.]+)秒要补上([\d.]+)秒/);
    const undo=q.match(/^只撤销(.+?)去掉重复步数的改动,/) ?? q.match(/^将(.+?)的去重复原,/);
    if(cut && records[cut[1]] && steps.every(e=>e===records || !e[cut[1]]?.步数))steps.push({[cut[1]]:{步数:Number(records[cut[1]].步数)-Number(cut[2])}});
    else if(missing && records[missing[1]] && steps.slice(1).every(e=>!e[missing[1]]?.秒))steps.push({[missing[1]]:{秒:Number(records[missing[1]].秒)+Number(missing[2])}});
    else if(elapsed && records[elapsed[1]]?.秒===+elapsed[2])steps.push({[elapsed[1]]:{秒:+elapsed[2]+Number(elapsed[3])}});
    else if(undo && records[undo[1]])steps.push({[undo[1]]:{步数:'^'}});
    else if(/只知道以上整局记录/.test(q) && /(?:F2L|OLL|PLL)阶段/.test(t))steps.push({});
    else return;
  }
  return steps;
}
