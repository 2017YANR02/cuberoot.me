import type { ScenarioSpec } from './site_assistant_scenario_table.js';

type Measures = Array<[string, number]>;
const result = (text: string, measures: Measures) => ({ text, measures: new Map(measures) });
const tally = (items: string[]) => {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
};

export const scenarioCounts: Record<string, ScenarioSpec> = {
  most_competitions_abroad: {
    fields: { 当时代表地: 'text', 举办地: 'text' },
    instructions:
      'One permanent row per individual competition, even when several share a country. Store the representation AT PARTICIPATION separately per row. A later nationality change affects new competitions only. A venue correction changes only the specified competition. Use the same country labels; exclude virtual countries.',
    evidence: 'result.country_id != competition.country_id',
    rule: '逐场使用参赛当时的代表地，同场多个项目只计一站。',
    view(rows, question) {
      const eligible = rows.filter(
        (r) => r.当时代表地 !== r.举办地 && !/虚拟|^X[AEFMNOSW]$/.test(String(r.举办地)),
      );
      const pairs = tally(rows.map((r) => r.当时代表地 + '代表在' + r.举办地));
      const breakdown = [...pairs].map(
        ([key, n]) =>
          key +
          '参赛 ' +
          n +
          ' 站，计入 ' +
          eligible.filter((r) => r.当时代表地 + '代表在' + r.举办地 === key).length +
          ' 站',
      );
      const byRepresentative = new Map<string, number>();
      for (const row of rows) byRepresentative.set(String(row.当时代表地), 0);
      for (const row of eligible)
        byRepresentative.set(String(row.当时代表地), byRepresentative.get(String(row.当时代表地))! + 1);
      const periods = [...byRepresentative].sort((a, b) => b[1] - a[1]);
      const comparison =
        periods.length === 2 && /哪一季|哪一段|并列|哪段|哪个时期|时期哪个更多/.test(question)
          ? periods[0][1] === periods[1][1]
            ? '两段并列。'
            : '代表' + periods[0][0] + '期间多 ' + (periods[0][1] - periods[1][1]) + ' 站。'
          : '';
      return result(comparison + breakdown.join('；') + '。合计 ' + eligible.length + ' 站海外比赛。', [
        ['海外站数', eligible.length],
      ]);
    },
  },
  most_attended_competitions_in_single_week: {
    fields: { 比赛ID: 'text', 周: 'text' },
    instructions:
      'One row per original competition observation. Assign stable IDs and relative ISO week labels (首周/下一周) unless dates supplied. Two observations proven to be the same competition must share ID and opening week. Undo that ID correction independently from a change of opening day for another observation. Sunday before next Monday belongs to the first week.',
    evidence: 'HAVING attended_within_week >= 3',
    rule: '按开幕日所在的周一至周日分组，每周按比赛 ID 去重，至少 3 场入榜。',
    view(rows, question) {
      const all = new Map<string, string>();
      for (const row of rows) {
        const id = String(row.比赛ID),
          week = String(row.周);
        if (all.has(id) && all.get(id) !== week) return;
        all.set(id, week);
      }
      const counts = tally([...all.values()]);
      return result(
        [...counts]
          .map(
            ([week, n]) =>
              week +
              ' ' +
              n +
              ' 场，' +
              (n >= 3 ? '达标，比门槛多 ' + (n - 3) : '未达标，还差 ' + (3 - n)) +
              ' 场',
          )
          .join('；') +
          '。' +
          (/两周合起来|两周合计/.test(question) ? '两周合计 ' + all.size + ' 个不同比赛。' : ''),
        [...counts],
      );
    },
  },
  dnf_rate_by_event: {
    fields: { 项目: 'text', 状态: 'text', 次数: 'count' },
    instructions:
      'Use rows grouped by event and status 有效/DNF/DNS/占位. Keep absolute counts on every affected row; transferring an attempt decrements its old group once and increments its new group once. Zero-value placeholders do not take part. Only handle one event.',
    evidence: 'value NOT IN (-2, 0)',
    rule: 'DNF 为 −1，DNS 为 −2，零值为空槽。分母只含有效尝试和 DNF。',
    view(rows) {
      if (
        new Set(rows.map((r) => r.项目)).size !== 1 ||
        rows.some((r) => !['有效', 'DNF', 'DNS', '占位'].includes(String(r.状态)))
      )
        return;
      const count = (state: string) =>
        rows.filter((r) => r.状态 === state).reduce((n, r) => n + Number(r.次数), 0);
      const fails = count('DNF'),
        valid = count('有效'),
        actual = fails + valid;
      if (!actual) return result('没有实际尝试，分母为 0，失败率无定义。', [['分母', 0]]);
      const pct = (100 * fails) / actual;
      return result(
        '有效 ' +
          valid +
          ' 次，DNF ' +
          fails +
          ' 次，实际尝试 ' +
          actual +
          ' 次。失败率 ' +
          fails +
          ' / ' +
          actual +
          ' = ' +
          Number(pct.toFixed(2)) +
          '%。',
        [
          ['分母', actual],
          ['失败次数', fails],
          ['失败率（百分点）', pct],
        ],
      );
    },
  },
  'frame-count-about': {
    fields: { 帧率: 'positive', 终点: 'count', 秒: 'positive', 实测起点: 'count', 已测: 'flag' },
    instructions:
      'Only fixed-rate nominal frame-interval arithmetic with known end frame and input seconds. One stable row; 实测起点 is 0 and 已测=0 unless an independent start marker is explicitly observed. Revert only the named timing or marker change. Do not apply this to variable frame rate, timestamps, truncated timer ranges or requests for the exact tool rounding convention.',
    evidence: '固定帧率相邻帧间隔',
    rule: '反推使用了输入的计时器成绩，不能据此独立验证成绩。',
    view(rows) {
      if (rows.length !== 1) return;
      const r = rows[0],
        fps = Number(r.帧率),
        end = Number(r.终点),
        seconds = Number(r.秒),
        span = fps * seconds;
      if (!Number.isSafeInteger(end) || !Number.isSafeInteger(span) || end < span) return;
      const start = end - span;
      if (r.已测) {
        const observed = Number(r.实测起点);
        if (observed > end || !Number.isSafeInteger(observed)) return;
        const duration = (end - observed) / fps,
          delta = duration - seconds;
        return result(
          '实测从第 ' +
            observed +
            ' 帧到第 ' +
            end +
            ' 帧，相隔 ' +
            (end - observed) +
            ' 个帧间隔。用时 ' +
            Number(duration.toFixed(4)) +
            ' 秒，' +
            (delta === 0
              ? '与计时器一致'
              : '比计时器' + (delta > 0 ? '多 ' : '少 ') + Number(Math.abs(delta).toFixed(4)) + ' 秒') +
            '。',
          [],
        );
      }
      return result(
        '按固定帧率反推，跨越 ' +
          fps +
          ' × ' +
          seconds +
          ' = ' +
          span +
          ' 个间隔。终点第 ' +
          end +
          ' 帧，起点第 ' +
          start +
          ' 帧。',
        [
          ['起点帧号', start],
          ['跨越间隔数', span],
        ],
      );
    },
  },
  most_completed_solves: {
    fields: { 项目: 'text', 成功数: 'count', DNF: 'count' },
    instructions:
      'Count strictly positive valid attempts per event. DNS becoming DNF changes neither success count. Transfer a success between events without changing the total. DNF is the separately supplied failed-attempt count. DNS and unsubmitted slots contribute neither to DNF nor actual attempts. If actual attempts are requested and failure counts are unknown, return LOOKUP.',
    evidence: 'value > 0',
    rule: '只计正数的有效还原。DNS 改为 DNF 对成功计数的贡献仍是零。',
    view(rows, question) {
      const focus = question.match(/只(?:看|报|列|说)([二三四五六七]阶|三盲|四盲|五盲|单手|金字塔|斜转|时钟)/)?.[1];
      const counts = rows
        .filter((r) => !focus || r.项目 === focus)
        .map((r) => [String(r.项目), Number(r.成功数)] as [string, number]);
      if (new Set(counts.map(([key]) => key)).size !== counts.length || !counts.length) return;
      const n = counts.reduce((sum, [, count]) => sum + count, 0);
      const actual = rows
        .filter((r) => !focus || r.项目 === focus)
        .reduce((sum, r) => sum + Number(r.DNF) + Number(r.成功数), 0);
      const askedAttempts = /上场次数|实际尝试/.test(question);
      const ranking=[...counts].sort((a,b)=>b[1]-a[1]);
      const comparison=ranking.length===2 && /哪边多|差几次|一样多/.test(question)
        ? ranking[0][1]===ranking[1][1] ? '两项相同。' : ranking[0][0]+'多 '+(ranking[0][1]-ranking[1][1])+' 次。' : '';
      return result(
        comparison + counts.map(([event, n]) => event + ' ' + n + ' 次').join('、') +
          (focus ? '。' : '，合计 ' + n + ' 次成功。') +
          (/未成功.{0,5}算几次/.test(question) ? '未成功的尝试贡献 0 次。' : '') +
          (askedAttempts ? '实际有 ' + actual + ' 次上场尝试。' : ''),
        askedAttempts ? [...counts, ['小计', n], ['实际尝试', actual]] : [...counts, ['小计', n]],
      );
    },
  },
  most_finals: {
    fields: { 场: 'text', 项目: 'text', 决赛: 'flag', 本人: 'flag' },
    instructions:
      'One row per original result row for a person at a particular event, round and competition. 综合决赛 has its final flag set. DNF does not remove a final row. Correct ownership using 本人.',
    evidence: 'round_types.final',
    rule: '只看本人的决赛成绩行，全 DNF 也可计入。同场不同项目分别计数。',
    view(rows) {
      const finals = rows.filter((r) => r.决赛 === 1 && r.本人 === 1),
        count = new Set(finals.map((r) => r.场)).size;
      return result(
        '计入' +
          (finals.map((r) => r.场 + '的' + r.项目).join('、') || '零项') +
          '。共 ' +
          finals.length +
          ' 条决赛行，来自 ' +
          count +
          ' 场比赛。',
        [
          ['决赛行数', finals.length],
          ['比赛数', count],
        ],
      );
    },
  },
  most_4th_places: {
    fields: { 场: 'text', 项目: 'text', 决赛: 'flag', 名次: 'positive', 有效: 'flag' },
    instructions:
      'One row per event-round result for the supplied competitor. Apply final flag, rank and validity as independent fields. A tie for third is rank 3. 半决赛/预赛/复赛 ALWAYS have 决赛=0. Only actual finals or combined finals explicitly marked final have 决赛=1. A correction from preliminary to semifinal does not turn on the flag.',
    evidence: 'pos = 4 AND best > 0',
    rule: '同场不同项目分别计数，只计有有效成绩的决赛第四。',
    view(rows, question, previousRows) {
      const hits = rows.filter((r) => r.决赛 === 1 && r.名次 === 4 && r.有效 === 1);
      const becameFinal = hits.filter((r) =>
        previousRows.some(
          (old) =>
            old.场 === r.场 && old.项目 === r.项目 && old.决赛 === 0 && old.名次 === 4 && old.有效 === 1,
        ),
      );
      const cause =
        /条件|原因/.test(question) && becameFinal.length
          ? becameFinal.map((r) => r.项目).join('、') + '从非决赛更正为决赛，原有效第四名因此计入。'
          : '';
      return result(
        cause +
          (hits.map((r) => r.场 + '的' + r.项目).join('、') || '无符合项') +
          '，合计 ' +
          hits.length +
          ' 次。',
        [['第四名次数', hits.length]],
      );
    },
  },
  most_podiums_together: {
    fields: {
      场: 'text',
      项目: 'text',
      决赛: 'flag',
      第一人: 'text',
      第二人: 'text',
      第三人: 'text',
      目标甲: 'text',
      目标乙: 'text',
      目标丙: 'text',
    },
    instructions:
      'Only for questions tracking a specific pair and that same pair plus a named third person. One row per podium at an event and competition. Copy the actual three medalist names to 第一人,第二人,第三人, and the three target names to 目标甲/目标乙/目标丙. The first two targets denote the pair. Keep targets identical on every row. Renaming a medalist changes only the medalist name, never a target. Do not group different events. Return LOOKUP for incomplete or tied podiums.',
    evidence: 'C(3, k)',
    rule: '同一场、同一项目的有效决赛领奖台才贡献一次组合。',
    view(rows) {
      if (!rows.length) return;
      const a = rows[0].目标甲,
        b = rows[0].目标乙,
        c = rows[0].目标丙;
      const names = (r: (typeof rows)[number]) => new Set([r.第一人, r.第二人, r.第三人]);
      if (
        new Set([a, b, c]).size !== 3 ||
        rows.some((r) => r.目标甲 !== a || r.目标乙 !== b || r.目标丙 !== c || names(r).size !== 3)
      )
        return;
      const pairs = rows.filter((r) => r.决赛 && names(r).has(a) && names(r).has(b));
      const triples = pairs.filter((r) => names(r).has(c)),
        diff = pairs.filter((r) => !names(r).has(c));
      return result(
        '对子 ' +
          pairs.length +
          ' 次，三人组 ' +
          triples.length +
          ' 次' +
          (triples.length ? '（' + triples.map((r) => String(r.场) + r.项目).join('、') + '）' : '') +
          '，差 ' +
          diff.length +
          ' 次。' +
          (diff.length ? '只贡献对子的是' + diff.map((r) => String(r.场) + r.项目).join('、') + '。' : ''),
        [
          ['对子', pairs.length],
          ['三人组', triples.length],
        ],
      );
    },
  },
};
