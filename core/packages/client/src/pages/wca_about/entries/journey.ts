// 选手经历 — about entries
import type { AboutEntry } from '../types';

// ──── competitions_per_year_by_person ───────────────────────────────────────
const competitions_per_year_by_person: AboutEntry = {
  id: 'competitions_per_year_by_person',
  titleZh: '每年每人比赛数',
  titleEn: 'Competitions per year by person',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '把每个选手在 WCA 的"职业年限"摊平,再算他们参加比赛的**年均频率**。一个 6 年里打了 90 场的选手 = 15 场/年。',
    '只看绝对数会让本地大佬被全球巡飞党碾压;这条指标把"短期狂飙"和"长期高频"区分开 —— 想上榜既要场次,也要跑得久。',
  ],
  introEn: [
    'Flattens each cuber\'s WCA career length and computes the **average competitions per year**. Six years with 90 comps = 15 / year.',
    'Absolute counts favour decade-long travellers; this metric separates "short burst" from "sustained high frequency" — you need both volume and longevity to chart.',
  ],
  stats: [
    { value: '≥ 1 yr', labelZh: '入榜门槛', labelEn: 'Eligibility', hintZh: '从首场到今天满 1 年', hintEn: 'At least 1 year since first comp' },
    { value: 'Top 100', labelZh: '榜单深度', labelEn: 'Leaderboard depth', hintZh: '按年均场次降序', hintEn: 'Sorted by comps/year desc' },
    { value: 'CURDATE()', labelZh: '年限基准', labelEn: 'Career end', hintZh: 'dump 的当天,不是末场比赛日', hintEn: 'Dump\'s today, not last comp date' },
  ],
  sourceZh: [
    '`results` 表 `DISTINCT competition_id`(同场多项目只算一场);`competitions.start_date` 取最早值;年限 = `(CURDATE() - MIN(start_date)) / 365.25`。',
  ],
  sourceEn: [
    '`results` with `DISTINCT competition_id` (one comp counts once regardless of events). Earliest `competitions.start_date` per person. Years = `(CURDATE() - MIN(start_date)) / 365.25`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  COUNT(DISTINCT competition_id) competitions,
  (DATEDIFF(CURDATE(), MIN(start_date)) / 365.25) years,
  person_id
FROM results
JOIN competitions ON competitions.id = competition_id
GROUP BY person_id
HAVING years >= 1
ORDER BY competitions / years DESC
LIMIT 100`,
  },
  steps: [
    {
      titleZh: '按选手聚合',
      titleEn: 'Aggregate per person',
      bodyZh: '一行 `results` = 一个项目轮次;先 `COUNT(DISTINCT competition_id)` 把多项目同场塌缩成 1。',
      bodyEn: 'Each `results` row is one event-round; `COUNT(DISTINCT competition_id)` collapses multi-event same-comp entries to 1.',
    },
    {
      titleZh: '量职业年限',
      titleEn: 'Measure career span',
      bodyZh: '`MIN(start_date)` = 首场比赛 → 与 `CURDATE()` 求差,换算 365.25 天/年(含闰年补偿)。',
      bodyEn: '`MIN(start_date)` = first comp → difference with `CURDATE()` divided by 365.25 (leap-year averaged).',
    },
    {
      titleZh: '过滤新人',
      titleEn: 'Filter newcomers',
      bodyZh: '`HAVING years >= 1` 把"刚出道 3 个月跑了 8 场"的爆发型剔掉 —— 否则分母太小,频率虚高。',
      bodyEn: '`HAVING years >= 1` removes "8 comps in first 3 months" outliers — small denominator would inflate the rate.',
    },
    {
      titleZh: '降序取 100',
      titleEn: 'Sort, take top 100',
      bodyZh: '按 `competitions / years` 降序,LIMIT 100。结果保留两位小数,便于平局区分。',
      bodyEn: 'Order by `competitions / years` desc, LIMIT 100. Two decimals retained to break ties.',
      highlight: true,
    },
  ],
  formulae: [
    {
      labelZh: '公式',
      labelEn: 'Formula',
      expr: 'rate(p) = comps(p) / ((today − firstCompDate(p)) / 365.25)',
      bodyZh: '`comps` 是去重场次,`firstCompDate` 是该选手最早一场的 `start_date`。',
      bodyEn: '`comps` is distinct count, `firstCompDate` is earliest `start_date` for the person.',
    },
  ],
  edgesZh: [
    '分母用 dump 的当天,不是"末场到首场";一个 2008 出道、2012 后退役的选手仍按 18 年计算,频率会被稀释。',
    '同一周末跨地两场算两场 —— `competition_id` 不同即不同场。',
    '副身份(改名 / 换国籍,`sub_id > 1`)不参与 — 只取主行。',
  ],
  edgesEn: [
    'Denominator uses today, not last-comp-date — a 2008 retiree from 2012 is still divided by 18 years, diluting the rate.',
    'Two cross-region comps in one weekend count separately — different `competition_id` = different comp.',
    'Alt identities (rename / country change, `sub_id > 1`) excluded — only the primary `persons` row.',
  ],
  related: [
    { id: 'shortest_time_to_reach_milestone_in_comps_count', titleZh: '最快达里程碑场次', titleEn: 'Fastest to N comps', hintZh: '短窗口爆发量化 —— 跟年均频率互补', hintEn: 'Short-window bursts — complement to the annual rate' },
    { id: 'most_attended_competitions_in_single_month', titleZh: '单月最多场次', titleEn: 'Most in a month', hintZh: '更极端的"窗口"指标', hintEn: 'Even tighter window' },
    { id: 'most_distinct_dates_competed_on', titleZh: '不同参赛日期', titleEn: 'Distinct dates', hintZh: '另一种"出勤量"口径', hintEn: 'Alternative attendance metric' },
    { id: 'competitions_per_year_by_person', toStat: true, titleZh: '查看实时数据', titleEn: 'Jump to live data', hintZh: '当前榜单 + 项目筛选', hintEn: 'Current leaderboard + filters' },
  ],
};

// ──── longest_competitions_path ─────────────────────────────────────────────
const longest_competitions_path: AboutEntry = {
  id: 'longest_competitions_path',
  titleZh: '最长比赛路径',
  titleEn: 'Longest competitions path',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '把每位选手按时间顺序参加的比赛连成一条折线,**地球大圆距离**逐段求和。决定排名的不是飞行航线,而是赛事之间的直线距离 —— 一个跨大陆来回比环球一圈短得多。',
    '榜首通常是常年欧美亚穿梭的「赛季巡游党」,一年能堆出几十万公里。',
  ],
  introEn: [
    'Connect each cuber\'s comps in chronological order, then sum **great-circle distances** segment by segment. Not flight paths — straight-line geodesics between venues.',
    'The top spots usually go to year-round Eurasia / Americas commuters who rack up several hundred thousand km a year.',
  ],
  stats: [
    { value: 'Haversine', labelZh: '距离公式', labelEn: 'Distance formula', hintZh: '球面大圆,R = 6371 km', hintEn: 'Spherical great-circle, R = 6371 km' },
    { value: '1000', labelZh: '榜单深度', labelEn: 'Leaderboard depth', hintZh: 'top 1000 选手', hintEn: 'Top 1000 cubers' },
    { value: 'lat/lon ÷ 10⁶', labelZh: '坐标精度', labelEn: 'Coord precision', hintZh: 'WCA dump 存的是 micro-degree', hintEn: 'WCA dump stores micro-degrees' },
  ],
  sourceZh: [
    '`results` 取 `DISTINCT (person_id, competition_id)` —— 同场多项目算一次;join `competitions` 拿场馆经纬度,按 `start_date, end_date` 升序排成时间线。坐标在 dump 里是 micro-degree(整数 × 10⁶),要除回。',
    '排除大陆 FMC 比赛的虚拟国家 (`XA, XE, XF, XM, XN, XO, XS, XW`),它们的经纬度不可靠。',
  ],
  sourceEn: [
    'Pull `DISTINCT (person_id, competition_id)` from `results` — multi-event same-comp counts once. Join `competitions` for venue lat/lon, sort by `start_date, end_date`. Coords are stored as micro-degrees (int × 10⁶); divide back.',
    'Continental FMC virtual countries (`XA, XE, XF, XM, XN, XO, XS, XW`) are excluded — their coords aren\'t real.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_link,
       RADIANS(latitude / 1000000) lat,
       RADIANS(longitude / 1000000) lon
FROM (SELECT DISTINCT person_id, competition_id FROM results) pc
JOIN persons ON wca_id = person_id AND sub_id = 1
JOIN competitions ON competitions.id = competition_id
WHERE country_id NOT IN ('XA','XE','XF','XM','XN','XO','XS','XW')
ORDER BY start_date, end_date`,
  },
  steps: [
    {
      titleZh: '按选手分组',
      titleEn: 'Group by person',
      bodyZh: 'SQL 拉回所有 (选手, 比赛, 坐标) 行,TS 端按 `person_link` 收成 Map,组内已按时间排好。',
      bodyEn: 'SQL returns all (person, comp, coord) rows; TS buckets by `person_link` into a Map — each group is already time-sorted.',
    },
    {
      titleZh: '相邻两点 Haversine',
      titleEn: 'Haversine on adjacent pairs',
      bodyZh: '对每个选手的 N 个坐标,算 N − 1 段。公式:`a = sin²(Δφ/2) + cos φ₁ cos φ₂ sin²(Δλ/2); d = 2R · atan2(√a, √(1−a))`。',
      bodyEn: 'For each cuber\'s N coords, compute N − 1 segments. `a = sin²(Δφ/2) + cos φ₁ cos φ₂ sin²(Δλ/2); d = 2R · atan2(√a, √(1−a))`.',
    },
    {
      titleZh: '段距累加',
      titleEn: 'Sum the segments',
      bodyZh: '不裁剪、不去重 —— 跨海回头跨过同一格也算两次距离。`Math.round` 到整数公里,千位空格分隔。',
      bodyEn: 'No clipping or dedup — flying back over the same square counts twice. `Math.round` to whole km, thin-space thousand separators.',
    },
    {
      titleZh: '降序取 1000',
      titleEn: 'Sort desc, take 1000',
      bodyZh: '榜单深 1000 比常规 100 深一档,因为这是地理"积分"指标,有大量长尾爱好者。',
      bodyEn: 'Top 1000 is deeper than the usual 100 — this is a geographic accumulator with a long tail of casuals.',
      highlight: true,
    },
  ],
  formulae: [
    {
      labelZh: 'Haversine 距离',
      labelEn: 'Haversine distance',
      expr: 'd = 2R · atan2(√a, √(1−a)),  a = sin²(Δφ/2) + cos φ₁ cos φ₂ sin²(Δλ/2)',
      bodyZh: 'φ = 纬度弧度,λ = 经度弧度,R = 6371 km。给出大圆(球面最短路径)长度。',
      bodyEn: 'φ = lat in radians, λ = lon in radians, R = 6371 km. Yields great-circle (spherical shortest path) length.',
    },
  ],
  edgesZh: [
    '相邻两场同一场馆 → 距离 0;同一城市不同场馆 → 几 km,仍计入。',
    '球面假设忽略地形/航路;不代表真实飞行里程,但在 WCA 巡游级距离尺度上误差可忽略。',
    '跨日多日比赛只在路径里出现一次(`competition_id` 维度去重)。',
  ],
  edgesEn: [
    'Two consecutive comps at the same venue → 0 km; same city different venues → a few km, still counted.',
    'Spherical assumption ignores terrain / actual flight routes; not real flown distance but negligible error at the scale of WCA touring.',
    'Multi-day comps appear once on the path (deduped by `competition_id`).',
  ],
  related: [
    { id: 'most_visited_countries', titleZh: '去过最多国家', titleEn: 'Most countries visited', hintZh: '广度 vs 路径长度 —— 互补口径', hintEn: 'Breadth vs path length — complement' },
    { id: 'most_visited_continents', titleZh: '去过最多大洲', titleEn: 'Most continents visited', hintZh: '更粗粒度的广度', hintEn: 'Coarser breadth metric' },
    { id: 'most_competitions_abroad', titleZh: '海外参赛最多', titleEn: 'Most comps abroad', hintZh: '另一种"跨国"量化', hintEn: 'Another cross-border measure' },
    { id: 'longest_competitions_path', toStat: true, titleZh: '查看实时路径榜', titleEn: 'Jump to live ranking', hintZh: '查看具体 km 与选手', hintEn: 'See km and cubers' },
  ],
};

// ──── longest_streak_of_competitions_in_own_country ─────────────────────────
const longest_streak_of_competitions_in_own_country: AboutEntry = {
  id: 'longest_streak_of_competitions_in_own_country',
  titleZh: '在本国最长连续参赛',
  titleEn: 'Longest streak of comps in own country',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '把一国所有比赛按时间排成队列;一个选手只要**漏掉**其中任何一场,本国连续记录就清零。可以理解成"在自己家门口的全勤率"。',
    '只看本国(`competition.country_id = person.country_id`),所以海外参赛的间隔不打断连胜 —— 适合衡量真正"扎根本地圈"的选手。',
  ],
  introEn: [
    'Queue every comp in a country by date; the moment a cuber **misses** one, the streak resets. Think "perfect-attendance run in your home country".',
    'Limited to in-country comps (`competition.country_id = person.country_id`), so overseas trips do not break it — captures cubers truly anchored to the local scene.',
  ],
  stats: [
    { value: '本国', labelZh: '范围', labelEn: 'Scope', hintZh: '比赛地 = 选手注册国', hintEn: 'Comp country = person\'s registered country' },
    { value: 'Top 100', labelZh: '榜单深度', labelEn: 'Leaderboard depth', hintZh: '按连胜降序', hintEn: 'Sorted by streak desc' },
    { value: '严格全勤', labelZh: '中断条件', labelEn: 'Break condition', hintZh: '一场缺席 → 计数清零', hintEn: 'One miss → counter zero' },
  ],
  sourceZh: [
    '`results` 去重 (`DISTINCT person_id, competition_id`),join 到 `persons`(`sub_id = 1`) 和 `competitions`(取 `cell_name`),用 `competition.country_id = person.country_id` 过滤本国比赛。`countries.name` 取国家名展示。按 `start_date` 升序。',
  ],
  sourceEn: [
    '`results` deduped on `(person_id, competition_id)`, joined to `persons` (`sub_id = 1`) and `competitions` (with `cell_name`), filtered by `competition.country_id = person.country_id`. Country name from `countries.name`. Ordered by `start_date`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_link, competition_link, country.name country
FROM (SELECT DISTINCT person_id, competition_id FROM results) pc
JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
JOIN competitions competition ON competition.id = competition_id
JOIN countries country ON country.id = competition.country_id
WHERE competition.country_id = person.country_id
ORDER BY competition.start_date`,
  },
  steps: [
    {
      titleZh: '按国家分桶',
      titleEn: 'Bucket by country',
      bodyZh: '每个国家拿到一条按时间排好的比赛序列 + 每场的出席选手名单。',
      bodyEn: 'Each country gets a time-sorted sequence of comps plus the attendee list per comp.',
    },
    {
      titleZh: '维护两张表',
      titleEn: 'Maintain two tables',
      bodyZh: '`currentByPerson` = 进行中的连胜;`longestByPerson` = 历史最长。每遇新比赛,先把新出现的人 init,然后 check 在桌选手是否到场。',
      bodyEn: '`currentByPerson` = in-progress streaks; `longestByPerson` = historical best. For each new comp, init new attendees, then check if tracked people showed up.',
    },
    {
      titleZh: '到场 +1 / 缺席结算',
      titleEn: 'Present +1 / absent settle',
      bodyZh: '到场 → `current.count += 1`,刷新 longest;缺席 → 把 `current` 写回历史,从 currentByPerson 删除 —— 这一刻连胜被打断。',
      bodyEn: 'Present → `current.count += 1`, refresh longest. Absent → write `current` to history, remove from currentByPerson — that\'s the moment the streak breaks.',
    },
    {
      titleZh: '收集 + 取 100',
      titleEn: 'Collect + take 100',
      bodyZh: '所有国家所有选手的 longest 全收集,降序排,取 top 100。最早 / 中断比赛同时记录。',
      bodyEn: 'Gather every person\'s longest across countries, sort desc, take top 100. First and break-comp logged.',
      highlight: true,
    },
  ],
  edgesZh: [
    '"漏掉一场"的判定是基于该国所有比赛 —— 你不参加的话,即便是 1000 公里外的小赛也会断 streak。',
    '只看主身份(`sub_id = 1`);改国籍的选手要按改后那一段算。',
    'streak 仍在进行中(没断过)也会被收录 —— `lastCompetition` 留空。',
  ],
  edgesEn: [
    '"Miss" is judged against every comp in that country — even a small 1000 km away one breaks the streak if you skip.',
    'Primary identity only (`sub_id = 1`); after a country change, only the post-change run counts.',
    'Ongoing streaks (never broken) are included — `lastCompetition` left blank.',
  ],
  related: [
    { id: 'longest_streak_of_personal_records', titleZh: '连续破 PR 比赛', titleEn: 'Streak with PR each comp', hintZh: '从"全勤"换到"刷成绩"', hintEn: 'Attendance → performance streak' },
    { id: 'longest_streak_of_podiums', titleZh: '连续登台', titleEn: 'Streak of podiums', hintZh: '另一种"连胜"', hintEn: 'A different kind of streak' },
    { id: 'most_competitions_abroad', titleZh: '海外参赛最多', titleEn: 'Most comps abroad', hintZh: '反向口径 —— 不在本国', hintEn: 'Opposite scope — outside home country' },
    { id: 'longest_streak_of_competitions_in_own_country', toStat: true, titleZh: '查看实时连胜榜', titleEn: 'Jump to live streaks', hintZh: '具体选手 + 起止比赛', hintEn: 'Cubers + start/end comps' },
  ],
};

// ──── longest_streak_of_personal_records ────────────────────────────────────
const longest_streak_of_personal_records: AboutEntry = {
  id: 'longest_streak_of_personal_records',
  titleZh: '最长连续个人纪录参赛记录',
  titleEn: 'Longest streak of comps with a PR',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '一个选手按时间参加比赛,**只要某场比赛刷了至少一个 PR**(任意项目的 single 或 average),streak 就 +1;一场没刷,清零。',
    '它衡量的是"持续进步"的硬度 —— 上榜不需要某一项目特别强,但你得在每场比赛里都从某个项目里榨出新 PR。',
  ],
  introEn: [
    'Walk a cuber\'s comps in order — **as long as a comp produces at least one PR** (any event\'s single or average), the streak ticks up; one comp without a PR resets it.',
    'A "sustained improvement" metric — you don\'t need to be top in any event, but you need to extract a fresh PR from somewhere at every comp.',
  ],
  stats: [
    { value: 'single + avg', labelZh: 'PR 类型', labelEn: 'PR types', hintZh: '两者任一刷新即 +1', hintEn: 'Either resets +1' },
    { value: 'Top 100', labelZh: '榜单深度', labelEn: 'Leaderboard depth', hintZh: '按连胜降序', hintEn: 'Sorted by streak desc' },
    { value: '≤ 历史最佳', labelZh: '刷 PR 判定', labelEn: 'PR check', hintZh: '`val <= pb` 平 PR 也算', hintEn: '`val <= pb` — ties count' },
  ],
  sourceZh: [
    '`results` 全表 join `persons` / `competitions` / `round_types`,按 `start_date, round_type.rank` 升序。每行带 `event_id`、`best`(single)、`average`。无论几轮,只要轮内的 best/average 刷新该项目 PB,这一比赛即算"有 PR"。',
  ],
  sourceEn: [
    'Full `results` joined to `persons` / `competitions` / `round_types`, sorted by `start_date, round_type.rank`. Each row has `event_id`, `best` (single), `average`. Any round breaking the per-event PB counts the whole comp as "had a PR".',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_link, competition_link,
       event_id, best single, average
FROM results
JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
JOIN competitions competition ON competition.id = competition_id
JOIN round_types round_type ON round_type.id = round_type_id
ORDER BY competition.start_date, round_type.rank`,
  },
  steps: [
    {
      titleZh: '按选手 → 比赛 嵌套分组',
      titleEn: 'Bucket by person → comp',
      bodyZh: '外层按 `person_link` 分,内层把同场所有项目轮次收拢为一个"比赛快照"。',
      bodyEn: 'Outer bucket: `person_link`. Inner bucket: gather all event-rounds at one comp into a single "comp snapshot".',
    },
    {
      titleZh: '维护 per-event PB',
      titleEn: 'Track per-event PB',
      bodyZh: '`pbsByEvent` 存每个项目的 single PB 和 average PB(都从 Infinity 起);遍历比赛快照内所有结果。',
      bodyEn: '`pbsByEvent` holds single-PB and average-PB per event (both start at Infinity); iterate every result in the snapshot.',
    },
    {
      titleZh: '判定"有 PR 的比赛"',
      titleEn: 'Decide "comp had a PR"',
      bodyZh: '任一项目任一类型 `val > 0 && val <= pb` 即触发刷新 + 标 `competitionWithPb = true`。注意 `<=`,平 PR 也算。',
      bodyEn: 'Any event × type where `val > 0 && val <= pb` fires the refresh and flips `competitionWithPb`. `<=` means ties count.',
    },
    {
      titleZh: 'streak 推进 / 重置',
      titleEn: 'Advance / reset',
      bodyZh: '有 PR → `count += 1`,刷新 longest;无 PR → 关闭 current,下一比赛重新开 streak。',
      bodyEn: 'PR found → `count += 1`, refresh longest; no PR → close current, open fresh on next comp.',
      highlight: true,
    },
  ],
  edgesZh: [
    '平 PR 算,因为 `<=`;严格意义上"刷新"的口径要 `<` —— 这里宽松。',
    '只要该比赛**任一项目任一指标** PR,整场算 PR 比赛;打 6 项 PR 跟打 1 项 PR 计数相同。',
    '`best = -1` / `0`(DNF / 未提交)不会触发 PR,因为 `val > 0` 守门。',
  ],
  edgesEn: [
    'Ties count (we use `<=`); strict-improvement would need `<` — looser here.',
    '**Any event × any type** PR makes the whole comp a "PR comp"; 6-event PRs and 1-event PRs score the same.',
    '`best = -1` / `0` (DNF / not attempted) cannot trigger a PR — `val > 0` gate.',
  ],
  related: [
    { id: 'longest_streak_of_podiums', titleZh: '连续登台', titleEn: 'Streak of podiums', hintZh: '相同形态,换成"领奖台"判定', hintEn: 'Same shape, swap PR for podium' },
    { id: 'longest_streak_of_competitions_in_own_country', titleZh: '本国连续参赛', titleEn: 'Streak in own country', hintZh: '"全勤"型 streak', hintEn: 'Attendance-style streak' },
    { id: 'longest_time_to_sub_10', titleZh: '最长 sub-10 时长', titleEn: 'Longest time to sub-10', hintZh: '另一面 —— "进步慢"的故事', hintEn: 'Flip side — slow-improvement story' },
    { id: 'longest_streak_of_personal_records', toStat: true, titleZh: '查看实时连胜榜', titleEn: 'Jump to live streaks', hintZh: '具体选手 + 起止比赛', hintEn: 'Cubers + start/end comps' },
  ],
};

// ──── longest_streak_of_podiums ─────────────────────────────────────────────
const longest_streak_of_podiums: AboutEntry = {
  id: 'longest_streak_of_podiums',
  titleZh: '最长连续登台记录',
  titleEn: 'Longest streak of podiums',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '锁定**单个项目**:从某场比赛起,只要决赛拿前 3 就 +1;某场决赛掉出前 3,streak 结束。计数粒度是 (选手, 项目) —— 一个选手能同时在 3x3 和 Square-1 上各自维持 streak。',
    '"忽略未举办该项目的比赛"是个关键放宽:如果一场没办 Square-1,Square-1 的 streak 不会因为缺席而中断。',
  ],
  introEn: [
    'Single-event lens: from some comp onward, every final placing top 3 ticks +1; a final outside top 3 ends it. Counter granularity is (person, event) — one cuber can sustain parallel streaks across 3x3 and Square-1.',
    '"Ignore comps that didn\'t hold the event" is the key relaxation — a comp without Square-1 doesn\'t kill a Square-1 streak.',
  ],
  stats: [
    { value: '决赛 + 前 3', labelZh: '登台判定', labelEn: 'Podium rule', hintZh: '`is_final = 1 AND pos ≤ 3`', hintEn: '`is_final = 1 AND pos ≤ 3`' },
    { value: '(人 × 项目)', labelZh: 'streak 粒度', labelEn: 'Streak key', hintZh: '同人不同项目各自计数', hintEn: 'Same person, different events, separate counters' },
    { value: 'best > 0', labelZh: '有效成绩', labelEn: 'Must complete', hintZh: '全 DNF 即便排到第 3 也不算', hintEn: 'All-DNF final doesn\'t qualify' },
    { value: 'Top 100', labelZh: '榜单深度', labelEn: 'Leaderboard depth', hintZh: '按连胜降序', hintEn: 'Sorted by streak desc' },
  ],
  sourceZh: [
    '`results` 全表 join `events` / `persons` / `competitions` / `round_types`;每行带 `round_type.final`(是否决赛)、`pos`(名次)、`best`(single)。按 `start_date, round_type.rank` 升序 —— 同场内预赛在决赛之前。',
  ],
  sourceEn: [
    '`results` joined to `events` / `persons` / `competitions` / `round_types`. Each row has `round_type.final` (is-final flag), `pos` (place), `best` (single). Ordered by `start_date, round_type.rank` — earlier rounds precede finals within a comp.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT event.name event_name, person_link, competition_link,
       round_type.final is_final, pos place, best single
FROM results
JOIN events event ON event.id = event_id
JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
JOIN competitions competition ON competition.id = competition_id
JOIN round_types round_type ON round_type.id = round_type_id
ORDER BY competition.start_date, round_type.rank`,
  },
  steps: [
    {
      titleZh: '按 (选手, 比赛, 项目) 三层分组',
      titleEn: 'Group by (person, comp, event)',
      bodyZh: '外层按选手,内层按 `(comp, event)` 拼一个 key;同 key 内多个 row = 该项目的多个轮次。',
      bodyEn: 'Outer by person; inner by `(comp, event)` key — multiple rows in a key = multiple rounds.',
    },
    {
      titleZh: '取最后一轮',
      titleEn: 'Take the last round',
      bodyZh: '`groupRows[groupRows.length - 1]` —— 因为 SQL 已经按 `round_type.rank` 排,组末就是决赛(若 `is_final = 1`)。',
      bodyEn: '`groupRows[groupRows.length - 1]` — SQL already orders by `round_type.rank`, so the last row is the final (if `is_final = 1`).',
    },
    {
      titleZh: '登台判定 / 计数',
      titleEn: 'Podium check / advance',
      bodyZh: '`is_final && place ≤ 3 && single > 0` → `current.count += 1`;否则把 current 写回 podiumsStreaks,把该项目从 `currentByEvent` 删 → 下次重新开 streak。',
      bodyEn: '`is_final && place ≤ 3 && single > 0` → `current.count += 1`; otherwise commit current, remove the event from `currentByEvent` — fresh streak next time.',
    },
    {
      titleZh: '收集 + 取 100',
      titleEn: 'Collect + take 100',
      bodyZh: '把每个 (人, 项目) 的所有 streak(包括仍在进行中的)平铺,按 count 降序取 100。',
      bodyEn: 'Flatten every (person, event) streak (including ongoing), sort desc by count, take 100.',
      highlight: true,
    },
  ],
  edgesZh: [
    '"未办该项目的比赛"自动跳过 —— 该 (人, 项目) 在那场没有 row,循环不接触 `currentByEvent.event`。',
    '决赛全 DNF (`single = -1` 或 `0`)即便名次 ≤ 3 也不算,因为 `single > 0` 守门。',
    '只看决赛 —— 半决赛拿第 1 进决赛拿第 5,这场算"无登台"。',
  ],
  edgesEn: [
    'Comps that don\'t hold the event are skipped automatically — no row, loop never touches `currentByEvent.event`.',
    'All-DNF finals (`single = -1` or `0`) don\'t count even if place ≤ 3 — `single > 0` gate.',
    'Finals only — winning a semi but bombing the final = "no podium" for that comp.',
  ],
  related: [
    { id: 'longest_streak_of_personal_records', titleZh: '连续破 PR', titleEn: 'Streak with PR each comp', hintZh: '同形态,换成"刷 PR"判定', hintEn: 'Same shape, swap podium for PR' },
    { id: 'longest_streak_of_competitions_in_own_country', titleZh: '本国连续参赛', titleEn: 'Streak in own country', hintZh: '"全勤"型 streak', hintEn: 'Attendance-style streak' },
    { id: 'longest_streak_of_podiums', toStat: true, titleZh: '查看实时连胜榜', titleEn: 'Jump to live streaks', hintZh: '按项目筛选 + 选手', hintEn: 'Filter by event + cubers' },
  ],
};

// ──── longest_time_to_sub_10 ────────────────────────────────────────────────
const longest_time_to_sub_10: AboutEntry = {
  id: 'longest_time_to_sub_10',
  titleZh: '最长达到 sub-10 三阶平均的时间',
  titleEn: 'Longest time to sub-10 3x3x3 average',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '只看**已经突破** 3x3 sub-10 平均的选手,量他们从**首场比赛**到**首次 sub-10**之间的年数。越靠榜首,代表花的时间越久,故事性越强。',
    'sub-10 在 3x3 圈里是公认的"高手准入线",拖了十几年才打进来的选手,通常都是回归 / 中年组逆袭,非常有意思。',
  ],
  introEn: [
    'Restricted to cubers who **eventually** broke 3x3 sub-10 average — measures years from their **first comp** to their **first sub-10 average**. Top of the leaderboard = longest journey, best story.',
    'Sub-10 is the recognized "high-level" line; people who took 10+ years to crack it are usually comeback cubers or veterans clawing their way back.',
  ],
  stats: [
    { value: '< 1000 cs', labelZh: 'sub-10 阈值', labelEn: 'Sub-10 cutoff', hintZh: '`average < 1000`(厘秒 = 10.00 秒)', hintEn: '`average < 1000` (centiseconds = 10.00 s)' },
    { value: '事件 = 333', labelZh: '项目', labelEn: 'Event', hintZh: '仅 3x3x3', hintEn: '3x3x3 only' },
    { value: '365.25', labelZh: '年化系数', labelEn: 'Year basis', hintZh: '日差 / 365.25', hintEn: 'Day diff / 365.25' },
    { value: 'Top 100', labelZh: '榜单深度', labelEn: 'Leaderboard depth', hintZh: '按年数降序', hintEn: 'Sorted by years desc' },
  ],
  sourceZh: [
    '三个子查询交叉 join:① 曾达 sub-10 的选手集合(`event_id = 333 AND average > 0 AND average < 1000`);② 每人首场比赛日期;③ 每人首次 sub-10 日期。差值 / 365.25 即年数。',
  ],
  sourceEn: [
    'Three subqueries joined: ① set of cubers who ever hit sub-10 (`event_id = 333 AND average > 0 AND average < 1000`); ② each person\'s first comp date; ③ each person\'s first sub-10 date. Diff / 365.25 = years.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_link,
       DATEDIFF(first_sub10.start_date, first_comp.start_date) / 365.25 years
FROM (SELECT DISTINCT person_id FROM results
      WHERE event_id='333' AND average > 0 AND average < 1000) sub10
JOIN (SELECT person_id, MIN(start_date) start_date FROM results
      JOIN competitions ON id=competition_id GROUP BY person_id) first_comp USING (person_id)
JOIN (SELECT person_id, MIN(start_date) start_date FROM results
      JOIN competitions ON id=competition_id
      WHERE event_id='333' AND average > 0 AND average < 1000
      GROUP BY person_id) first_sub10 USING (person_id)
ORDER BY years DESC LIMIT 100`,
  },
  steps: [
    {
      titleZh: '筛 sub-10 俱乐部',
      titleEn: 'Filter the sub-10 club',
      bodyZh: '只保留至少有一次 `average < 1000` 的选手 —— `DISTINCT person_id` 子查询。',
      bodyEn: 'Keep only cubers who hit `average < 1000` at least once — `DISTINCT person_id` subquery.',
    },
    {
      titleZh: '取首场比赛日',
      titleEn: 'Get first comp date',
      bodyZh: '`MIN(start_date)` 跨所有项目,**不限 333** —— 比"3x3 入坑日"早,因为可能先打过别的项目。',
      bodyEn: '`MIN(start_date)` across **all events** — earlier than "3x3 debut" since they might have played another event first.',
    },
    {
      titleZh: '取首次 sub-10 日',
      titleEn: 'Get first sub-10 date',
      bodyZh: '同 `MIN(start_date)` 但加 `event_id = 333 AND average < 1000` 过滤,得到首次破线的那场比赛。',
      bodyEn: 'Same `MIN(start_date)` but filtered by `event_id = 333 AND average < 1000` — the first comp crossing the line.',
    },
    {
      titleZh: '年化 + 降序',
      titleEn: 'Annualize + sort desc',
      bodyZh: '`DATEDIFF / 365.25` 给小数年;按年数降序取 100,显示两位小数。',
      bodyEn: '`DATEDIFF / 365.25` for fractional years; sort desc, take 100, display two decimals.',
      highlight: true,
    },
  ],
  edgesZh: [
    '"首场比赛"含所有项目,所以哪怕你只为参加 BLD,然后 5 年后才打 sub-10 3x3,这 5 年也算进来。',
    '只挑事后已 sub-10 的人 —— "永远 sub-10 不了"的选手不上榜。',
    '首次 sub-10 是按**比赛日期**而非具体轮次时刻;同日先慢轮再快轮 → 用该比赛 `start_date`。',
  ],
  edgesEn: [
    '"First comp" spans all events — even if you debuted only for BLD and didn\'t touch 3x3 for 5 years, those 5 years count.',
    'Only cubers who eventually broke sub-10 are listed — never-sub-10 cubers don\'t appear.',
    'First sub-10 is by **comp date**, not exact round time; slow-then-fast same day → that comp\'s `start_date`.',
  ],
  related: [
    { id: 'longest_streak_of_personal_records', titleZh: '连续破 PR', titleEn: 'Streak with PR each comp', hintZh: '持续进步 vs 单点突破', hintEn: 'Sustained improvement vs single milestone' },
    { id: 'shortest_time_to_get_all_singles', titleZh: '最快全项目 single', titleEn: 'Fastest to all singles', hintZh: '反方向 —— "最快"达成', hintEn: 'Opposite direction — "fastest" to' },
    { id: 'longest_time_to_sub_10', toStat: true, titleZh: '查看实时榜', titleEn: 'Jump to live ranking', hintZh: '具体年数 + 选手', hintEn: 'Years + cubers' },
  ],
};

// ──── most_attended_competitions_in_single_month ────────────────────────────
const most_attended_competitions_in_single_month: AboutEntry = {
  id: 'most_attended_competitions_in_single_month',
  titleZh: '单月参赛最多',
  titleEn: 'Most comps attended in a single month',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '日历月维度的疯狂窗口:在**某个自然月**(1 号到月末)内,一个选手参加了多少场比赛。`GROUP BY person_id, YEAR(start_date), MONTHNAME(start_date)` 就把月份切片,直接 `COUNT`。',
    '入榜阈值是 4(`HAVING ≥ 4`),意味着平均一周一场,已经是相当疯狂的频率;榜首通常在 6-8 场之间。',
  ],
  introEn: [
    'Calendar-month explosion: how many comps a cuber attended within a **single natural month** (1st through month-end). `GROUP BY person_id, YEAR(start_date), MONTHNAME(start_date)` slices by month, plain `COUNT`.',
    'Cutoff is 4 (`HAVING ≥ 4`) — roughly weekly cadence, already insane. The top sits around 6-8.',
  ],
  stats: [
    { value: '≥ 4', labelZh: '入榜阈值', labelEn: 'Cutoff', hintZh: '`HAVING attended_within_month >= 4`', hintEn: '`HAVING attended_within_month >= 4`' },
    { value: '自然月', labelZh: '窗口', labelEn: 'Window', hintZh: '1 号 ~ 月末,跨年不合并', hintEn: '1st to month-end, year-bounded' },
    { value: 'DISTINCT', labelZh: '去重', labelEn: 'Dedup', hintZh: '同场多项目 → 1 场', hintEn: 'Multi-event same comp → 1' },
  ],
  sourceZh: [
    '`results` 去重 (`DISTINCT competition_id, person_id`) join `competitions`,按 (选手, 年, 月) 分组 `COUNT`。`GROUP_CONCAT` 把同月所有比赛 markdown link 拼成列表展示。',
  ],
  sourceEn: [
    '`results` deduped on `(competition_id, person_id)` joined to `competitions`, grouped by (person, year, month) with `COUNT`. `GROUP_CONCAT` concatenates all comps that month as markdown links.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT COUNT(*) attended_within_month, person_id,
       MONTHNAME(start_date) month_name,
       YEAR(start_date) competitions_year,
       GROUP_CONCAT(... competition cell_name ... ORDER BY start_date)
FROM (SELECT DISTINCT competition_id, person_id FROM results) r
JOIN competitions ON competitions.id = competition_id
GROUP BY person_id, YEAR(start_date), month_name
HAVING attended_within_month >= 4
ORDER BY attended_within_month DESC`,
  },
  steps: [
    {
      titleZh: '去重 (人, 场)',
      titleEn: 'Dedup (person, comp)',
      bodyZh: '同一场打多个项目只算一行 —— `DISTINCT competition_id, person_id` 子查询。',
      bodyEn: 'Multi-event same comp collapses to one row — `DISTINCT competition_id, person_id` subquery.',
    },
    {
      titleZh: '按 (人, 年, 月) 分桶',
      titleEn: 'Bucket by (person, year, month)',
      bodyZh: '`YEAR(start_date)` + `MONTHNAME(start_date)` 双键防止跨年合并 —— "Jan 2024" 和 "Jan 2025" 是两桶。',
      bodyEn: '`YEAR(start_date)` + `MONTHNAME(start_date)` joint key prevents cross-year merging — "Jan 2024" vs "Jan 2025" are separate buckets.',
    },
    {
      titleZh: 'COUNT + 阈值',
      titleEn: 'COUNT + cutoff',
      bodyZh: '`COUNT(*)` 给每桶场次;`HAVING ≥ 4` 滤掉常规节奏。',
      bodyEn: '`COUNT(*)` per bucket; `HAVING ≥ 4` trims normal cadence.',
    },
    {
      titleZh: '降序展示比赛列表',
      titleEn: 'Sort desc + show list',
      bodyZh: '按场次降序,同分时按姓名;附上 `GROUP_CONCAT` 拼好的具体比赛 markdown 链接,方便点开看。',
      bodyEn: 'Sort by count desc, ties by name; attach `GROUP_CONCAT`-built markdown links for inspection.',
      highlight: true,
    },
  ],
  edgesZh: [
    '"自然月"切割比"30 天滑窗"宽松 —— 月底 30 号 + 月初 1 号 + 2 号其实是连续 3 天,但跨月切成两桶各 1 + 2。',
    '只看比赛 `start_date`,多日赛延伸到下个月也只按起始月算。',
    '跨年最疯狂的"夏 + 秋 + 冬"季节性堆赛,本指标看不到 —— 见单周指标更密。',
  ],
  edgesEn: [
    'Calendar slice is laxer than "rolling 30 days" — Jun-30 + Jul-1 + Jul-2 is 3 consecutive days but gets split into two buckets (1 + 2).',
    'Comp `start_date` only — multi-day spilling into the next month still counts under start month.',
    'Doesn\'t capture summer→autumn→winter back-to-back streaks across the year — the weekly metric goes denser.',
  ],
  related: [
    { id: 'most_attended_competitions_in_single_week', titleZh: '单周最多场次', titleEn: 'Most in a week', hintZh: '更紧的滑窗', hintEn: 'Tighter rolling window' },
    { id: 'competitions_per_year_by_person', titleZh: '年均频率', titleEn: 'Annual frequency', hintZh: '长期 vs 短期爆发', hintEn: 'Long-term vs short-burst' },
    { id: 'most_distinct_dates_competed_on', titleZh: '不同参赛日期', titleEn: 'Distinct dates', hintZh: '另一面 —— 日期覆盖度', hintEn: 'Flip side — date coverage' },
    { id: 'most_attended_competitions_in_single_month', toStat: true, titleZh: '查看实时榜', titleEn: 'Jump to live ranking', hintZh: '看每月谁堆得最猛', hintEn: 'Who stacked the most that month' },
  ],
};

// ──── most_attended_competitions_in_single_week ─────────────────────────────
const most_attended_competitions_in_single_week: AboutEntry = {
  id: 'most_attended_competitions_in_single_week',
  titleZh: '单周内最多参加比赛数',
  titleEn: 'Most comps attended in a single week',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '把比赛对齐到 ISO **周**(周一为周首):用 `WEEKDAY()` 反推该比赛所在周的第 0 天和第 6 天,然后按 (人, 周) 分组 `COUNT`。窗口比"自然月"紧 4 倍。',
    '榜首 3 场已经很硬 —— 周六多个赛区同日开,选手得提前安排好场地切换。',
  ],
  introEn: [
    'Align comps to the ISO **week** (Monday-first): use `WEEKDAY()` to back-compute the week\'s day-0 and day-6, then group by (person, week) with `COUNT`. 4× tighter than the monthly window.',
    'Top entries at 3 are already brutal — multiple Saturday venues on the same day means tight venue-hopping.',
  ],
  stats: [
    { value: '≥ 3', labelZh: '入榜阈值', labelEn: 'Cutoff', hintZh: '`HAVING attended_within_week >= 3`', hintEn: '`HAVING attended_within_week >= 3`' },
    { value: '周一 - 周日', labelZh: '周边界', labelEn: 'Week edges', hintZh: 'ISO,WEEKDAY = 0 即周一', hintEn: 'ISO, WEEKDAY=0 = Monday' },
    { value: 'DISTINCT', labelZh: '去重', labelEn: 'Dedup', hintZh: '同场多项目 → 1 场', hintEn: 'Multi-event same comp → 1' },
  ],
  sourceZh: [
    '`results` 去重 join `competitions`;`DATE_ADD(start_date, INTERVAL -WEEKDAY(start_date) DAY)` 把 start_date 拨回当周周一,作为周锚点。按 (人, week_start, week_end, year) 分组。',
  ],
  sourceEn: [
    '`results` deduped, joined to `competitions`. `DATE_ADD(start_date, INTERVAL -WEEKDAY(start_date) DAY)` snaps `start_date` to that week\'s Monday — used as the week anchor. Group by (person, week_start, week_end, year).',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT COUNT(*) attended_within_week, person_id,
       DATE_ADD(start_date, INTERVAL -WEEKDAY(start_date) DAY) week_start_date,
       DATE_ADD(start_date, INTERVAL 6-WEEKDAY(start_date) DAY) week_end_date
FROM (SELECT DISTINCT competition_id, person_id FROM results) r
JOIN competitions ON competitions.id = competition_id
GROUP BY person_id, week_start_date, week_end_date, YEAR(start_date)
HAVING attended_within_week >= 3
ORDER BY attended_within_week DESC`,
  },
  steps: [
    {
      titleZh: '去重 (人, 场)',
      titleEn: 'Dedup (person, comp)',
      bodyZh: '同月同样的处理 —— 多项目同场塌缩为 1。',
      bodyEn: 'Same as the monthly version — multi-event same comp → 1.',
    },
    {
      titleZh: '锚定 ISO 周',
      titleEn: 'Anchor to ISO week',
      bodyZh: '`WEEKDAY` 在 MySQL 里 0 = 周一;减回去即得该周周一,加 6 即得周日。这是分桶的钥匙。',
      bodyEn: '`WEEKDAY` in MySQL: 0 = Monday; subtract back to the week\'s Monday, add 6 for Sunday. These are the bucket keys.',
    },
    {
      titleZh: '按 (人, 周) 分组 COUNT',
      titleEn: 'Group by (person, week) + COUNT',
      bodyZh: '`YEAR(start_date)` 进 GROUP BY 防止跨年同周的边界 case 合并(虽然概率极低,守一手)。',
      bodyEn: '`YEAR(start_date)` joins the GROUP BY to guard the unlikely-but-possible cross-year same-week-num collision.',
    },
    {
      titleZh: '日期格式化展示',
      titleEn: 'Pretty-print dates',
      bodyZh: 'TS 端把 `week_start_date / week_end_date` 用 `d&nbsp;Mon&nbsp;YYYY` 格式渲染,避免日期换行。',
      bodyEn: 'TS side formats `week_start_date / week_end_date` as `d&nbsp;Mon&nbsp;YYYY` to prevent line wraps.',
      highlight: true,
    },
  ],
  edgesZh: [
    '周边界是 ISO(周一首日),不是美式(周日首日);跨周末的双天比赛只算起始日所在周。',
    '周末跨大洲多场是常见上榜套路:北美早场 + 欧洲晚场 + 亚洲后日,3 场刚好。',
    '同月版本能漏掉跨月的连续周,这个版本能补;反过来同一周内 3 场可能跨不同月。',
  ],
  edgesEn: [
    'Week boundary is ISO (Mon-first), not US (Sun-first); a weekend two-day comp counts under the week of its start date only.',
    'Crossing continents over a single weekend is the classic top-rank pattern: NA morning + EU evening + Asia next day = 3.',
    'The monthly version can miss cross-month consecutive weeks; this one catches them — and the same 3 in a week may straddle two months.',
  ],
  related: [
    { id: 'most_attended_competitions_in_single_month', titleZh: '单月最多场次', titleEn: 'Most in a month', hintZh: '宽 4 倍的窗口', hintEn: 'Window 4× wider' },
    { id: 'competitions_per_year_by_person', titleZh: '年均频率', titleEn: 'Annual frequency', hintZh: '长期视角', hintEn: 'Long-term view' },
    { id: 'longest_competitions_path', titleZh: '最长比赛路径', titleEn: 'Longest path', hintZh: '空间 vs 时间 紧凑度', hintEn: 'Spatial vs temporal density' },
    { id: 'most_attended_competitions_in_single_week', toStat: true, titleZh: '查看实时榜', titleEn: 'Jump to live ranking', hintZh: '具体周 + 比赛列表', hintEn: 'Week + comp list' },
  ],
};

// ──── most_competitions_abroad ──────────────────────────────────────────────
const most_competitions_abroad: AboutEntry = {
  id: 'most_competitions_abroad',
  titleZh: '海外参赛最多',
  titleEn: 'Most competitions abroad',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '一行最朴素的 `result.country_id != competition.country_id` 完成。每条 `results` 行存了**选手在那一刻的注册国** —— 所以改国籍前后的"海外"判定会跟着变,符合直觉。',
    '榜首通常是住在小国但全球巡飞的玩家;欧盟区互访也大量贡献 —— 一周内打三国并不少见。',
  ],
  introEn: [
    'One terse `result.country_id != competition.country_id` does it. Each `results` row stores the **cuber\'s country at that moment** — so the "abroad" flag follows country changes naturally, as expected.',
    'Top spots are typically small-country residents who travel globally; intra-EU hopping contributes too — three countries in a week isn\'t rare.',
  ],
  stats: [
    { value: 'COUNT(DISTINCT)', labelZh: '聚合', labelEn: 'Aggregate', hintZh: '场次去重', hintEn: 'Distinct comp count' },
    { value: 'Top 100', labelZh: '榜单深度', labelEn: 'Leaderboard depth', hintZh: '按海外场次降序', hintEn: 'Sorted by abroad count desc' },
    { value: '排除 8 个虚拟国', labelZh: '过滤', labelEn: 'Filter', hintZh: 'XA/XE/XF/XM/XN/XO/XS/XW', hintEn: 'XA/XE/XF/XM/XN/XO/XS/XW' },
  ],
  sourceZh: [
    '`results result` 直接 join `competitions`;`WHERE result.country_id != competition.country_id` 即海外。`COUNT(DISTINCT competition_id)` 防止同场多项目重复计数。',
    '过滤掉大陆 FMC 的虚拟国家 —— 它们没有实际地理位置,把"代表大陆参加的虚拟国家比赛"标成海外会失真。',
  ],
  sourceEn: [
    '`results result` joined to `competitions`; `WHERE result.country_id != competition.country_id` = abroad. `COUNT(DISTINCT competition_id)` avoids multi-event double-counting.',
    'Continental FMC virtual countries are filtered out — they have no geo, marking them "abroad" would skew things.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_id, COUNT(DISTINCT competition_id) competitions_abroad
FROM results
JOIN competitions ON competitions.id = competition_id
WHERE result.country_id != competition.country_id
  AND competition.country_id NOT IN
      ('XA','XE','XF','XM','XN','XO','XS','XW')
GROUP BY person_id
ORDER BY competitions_abroad DESC
LIMIT 100`,
  },
  steps: [
    {
      titleZh: '逐行打"海外"标签',
      titleEn: 'Tag each row "abroad"',
      bodyZh: 'WCA dump 的 `results.country_id` 是该选手**当时**的国籍快照 —— 改国籍后老 row 不会被回写,所以历史海外标记精确。',
      bodyEn: 'WCA dump\'s `results.country_id` snapshots the cuber\'s country **at that time** — country changes don\'t rewrite history, so old abroad flags stay correct.',
    },
    {
      titleZh: '排除虚拟大陆国',
      titleEn: 'Exclude continental virtuals',
      bodyZh: '`XA/XE/XF/XM/XN/XO/XS/XW` 用于洲际 FMC,没有真实地理 —— 这些行不参与统计。',
      bodyEn: '`XA/XE/XF/XM/XN/XO/XS/XW` are placeholders for continental FMC, no real geo — drop these.',
    },
    {
      titleZh: '去重场次 + 聚合',
      titleEn: 'Dedup + aggregate',
      bodyZh: '`COUNT(DISTINCT competition_id)` 把同场多项目折成 1。',
      bodyEn: '`COUNT(DISTINCT competition_id)` collapses multi-event same comp.',
    },
    {
      titleZh: '降序取 100',
      titleEn: 'Sort desc, take 100',
      bodyZh: '按海外场次降序;外层 join `persons` 拿名字。',
      bodyEn: 'Order by abroad count desc; outer join `persons` for names.',
      highlight: true,
    },
  ],
  edgesZh: [
    '改国籍的选手:旧国 + 新国时期分别贡献"海外"判定 —— 各时段都按当时注册国比对,合理。',
    '一个旅居者长期住在 B 国但还挂 A 国国籍 → 在 B 国所有比赛都被标海外,实际却是"主场"。',
    '`competition.country_id != result.country_id`,**不**和 `persons.country_id`(当前国籍)比 —— 这是历史准确性 vs 当前快照的取舍。',
  ],
  edgesEn: [
    'Country-changers: pre-change and post-change periods each contribute abroad counts against their then-current country — fair.',
    'A long-term resident in country B still flagged as A → all B comps mark abroad, even though B is the daily home.',
    'Compared against `competition.country_id != result.country_id`, **not** `persons.country_id` (current) — historical accuracy over present snapshot.',
  ],
  related: [
    { id: 'most_visited_countries', titleZh: '去过最多国家', titleEn: 'Most countries visited', hintZh: '相关 —— 海外场次 ≥ 海外国家数', hintEn: 'Related — abroad comps ≥ abroad countries' },
    { id: 'longest_competitions_path', titleZh: '最长比赛路径', titleEn: 'Longest path', hintZh: '空间距离视角', hintEn: 'Spatial-distance angle' },
    { id: 'longest_streak_of_competitions_in_own_country', titleZh: '本国连续参赛', titleEn: 'Streak in own country', hintZh: '反向 —— 完全本地化', hintEn: 'Inverse — fully local' },
    { id: 'most_competitions_abroad', toStat: true, titleZh: '查看实时榜', titleEn: 'Jump to live ranking', hintZh: '具体海外场次 + 选手', hintEn: 'Abroad counts + cubers' },
  ],
};

// ──── most_completed_solves ─────────────────────────────────────────────────
const most_completed_solves: AboutEntry = {
  id: 'most_completed_solves',
  titleZh: '最多完成还原数',
  titleEn: 'Most completed solves',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    'WCA 不存"成功还原数"汇总字段 —— 这条统计深入到 `result_attempts` 子表,逐 attempt 数 `value > 0` 的次数,再按 6 个维度(比赛/选手/国家/大洲/年份/项目)聚合 top 20。',
    '是个 `GroupedStatistic` —— 一个 SQL 拉全表,TS 端 6 次重分组。"还原数"是绝对值排行,跟比赛数 / PR 数都不一样 —— 一个 BLD 多盲选手一场可能贡献两位数 solve。',
  ],
  introEn: [
    'WCA stores no "completed solves" aggregate — this drilldown hits the `result_attempts` subtable, counts `value > 0` per attempt, then re-aggregates across 6 dimensions (comp / person / country / continent / year / event) for top-20 each.',
    'A `GroupedStatistic` — one SQL pull, 6 TS regroups. Absolute volume, distinct from comp count or PR count — a MBLD specialist can rack double digits per comp.',
  ],
  stats: [
    { value: '6', labelZh: '聚合维度', labelEn: 'Dimensions', hintZh: '比赛 / 人 / 国 / 洲 / 年 / 项目', hintEn: 'Comp / person / country / continent / year / event' },
    { value: 'Top 20', labelZh: '每段深度', labelEn: 'Per-section depth', hintZh: '每个维度独立 top 20', hintEn: 'Each section is independent top 20' },
    { value: '`value > 0`', labelZh: '成功定义', labelEn: 'Completed = ', hintZh: 'DNF (-1) / 未尝试 (0) 不算', hintEn: 'DNF (-1) / not-attempted (0) excluded' },
  ],
  sourceZh: [
    '主表 `results` join `result_attempts`(用相关子查询数 `value > 0` 和 `value = -1`),配 `persons / competitions / countries / continents / events`。一次 SQL 把每个 result 的 completed/dnf 数算清楚,TS 端按 6 个 field 各自再 GROUP BY。',
  ],
  sourceEn: [
    'Main `results` joined to `result_attempts` via correlated subqueries (`COUNT WHERE value > 0` and `value = -1`), plus `persons / competitions / countries / continents / events`. One SQL pulls per-result completed/dnf; TS regroups by 6 fields.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  (SELECT COUNT(*) FROM result_attempts
   WHERE result_id = result.id AND value > 0) completed_count,
  (SELECT COUNT(*) FROM result_attempts
   WHERE result_id = result.id AND value = -1) dnfs_count,
  competition_link, person_link, country.name country,
  continent.name continent,
  YEAR(competition.start_date) year, event.name event
FROM results result
JOIN persons person ON wca_id = person_id AND sub_id = 1
JOIN competitions competition ON competition.id = competition_id
JOIN countries / continents / events ...`,
  },
  steps: [
    {
      titleZh: '逐 result 数 attempt',
      titleEn: 'Per-result attempt count',
      bodyZh: '相关子查询(correlated subquery)对每个 `result.id` 二次扫 `result_attempts`,分别数 `value > 0`(完成)和 `value = -1`(DNF)。',
      bodyEn: 'Correlated subquery rescans `result_attempts` per `result.id`, counting `value > 0` (completed) and `value = -1` (DNF) separately.',
    },
    {
      titleZh: '主表带维度字段',
      titleEn: 'Carry dimension fields',
      bodyZh: '同 row 拼上比赛 link / 人 link / 国名 / 大洲名 / 年份 / 项目名 —— 后续 TS 端选哪个字段就按哪个聚合。',
      bodyEn: 'Same row carries comp link / person link / country / continent / year / event — TS picks one of these as the regrouping key per section.',
    },
    {
      titleZh: 'TS 6 次重分组',
      titleEn: 'TS regroup × 6',
      bodyZh: 'Map<key, {completed, dnfs}>:对每个维度,key = 该字段值;`completed += completed_count, dnfs += dnfs_count`。',
      bodyEn: 'Map<key, {completed, dnfs}>: for each dimension, key = field value; `completed += completed_count, dnfs += dnfs_count`.',
    },
    {
      titleZh: '排序 + top 20 + 加粗',
      titleEn: 'Sort + top 20 + bold',
      bodyZh: '主键 completed 降序,平局比 attempts 升序(同 completed 时尝试少的赢),再次平局按 key 字母序;completed 数字加粗显示。',
      bodyEn: 'Primary sort: completed desc; tiebreak: attempts asc (fewer attempts wins at same completed); final: alpha by key. Completed cell bolded.',
      highlight: true,
    },
  ],
  edgesZh: [
    'MBLD 在 `result_attempts` 里只占一两条 attempt 行,但 cube 数能上 60+ —— 本指标按 attempt 数,所以 MBLD 单场只贡献 1-2 算"完成",不按 cube 数算。',
    '`value > 0` 包括所有完成,不区分项目 —— FMC 的"分数"也算 1 次完成。',
    'DNF 不扣分,但作为 attempts 计入分母 —— 平局时少 DNF 的赢。',
  ],
  edgesEn: [
    'MBLD shows as 1-2 attempt rows in `result_attempts`, but represents 60+ cubes — this metric counts attempts, so MBLD contributes 1-2 "completed" per comp, not cube count.',
    '`value > 0` covers everything completed regardless of event — FMC scores count as 1 "completed" too.',
    'DNF doesn\'t subtract but counts in attempts (denominator) — tiebreaker favors fewer DNFs.',
  ],
  related: [
    { id: 'most_solves_before_bld_success', titleZh: '盲拧成功前尝试数', titleEn: 'Solves before BLD success', hintZh: '"失败 attempts"的反指标', hintEn: 'Failed-attempts angle' },
    { id: 'most_distinct_dates_competed_on', titleZh: '不同参赛日期', titleEn: 'Distinct dates', hintZh: 'volume 的另一种量化', hintEn: 'Alternative volume metric' },
    { id: 'competitions_per_year_by_person', titleZh: '年均频率', titleEn: 'Annual frequency', hintZh: '频率 vs 总量', hintEn: 'Rate vs total' },
    { id: 'most_completed_solves', toStat: true, titleZh: '查看实时榜', titleEn: 'Jump to live ranking', hintZh: '6 维度切换', hintEn: '6-dimension toggle' },
  ],
};

// ──── most_distinct_dates_competed_on ───────────────────────────────────────
const most_distinct_dates_competed_on: AboutEntry = {
  id: 'most_distinct_dates_competed_on',
  titleZh: '最多不同参赛日期',
  titleEn: 'Most distinct dates competed on',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '把多日比赛展开成每一天 —— 用 SQL inline `nums (0..9)` 表 cross-join 出每场比赛的所有具体日期(`start_date + n` ≤ `end_date`),然后按 `MM/DD` 月日去 distinct。一年里 366 天哪些天参过赛?',
    '榜上的人通常都打满全年大多数月份;再 TS 端把日期按月份归类,显示每月的覆盖百分比 —— 一目了然看出"夏天密集 vs 全年均衡"。',
  ],
  introEn: [
    'Explode multi-day comps day-by-day — SQL cross-joins an inline `nums (0..9)` table to enumerate every concrete date a comp covers (`start_date + n` ≤ `end_date`), then distincts by `MM/DD`. Which calendar days have you ever competed on?',
    'Cubers on this leaderboard typically cover most months of the year; the TS side then groups dates by month and shows per-month coverage % — instantly readable for "summer-heavy vs year-balanced" patterns.',
  ],
  stats: [
    { value: '≥ 100', labelZh: '入榜阈值', labelEn: 'Cutoff', hintZh: '至少 100 个不同日期', hintEn: 'At least 100 distinct dates' },
    { value: 'MM/DD', labelZh: '日期 key', labelEn: 'Date key', hintZh: '跨年同日合并(2020-05-01 = 2024-05-01)', hintEn: 'Same MM/DD across years merge' },
    { value: '0 - 9 天', labelZh: '比赛长度上限', labelEn: 'Max comp span', hintZh: 'SQL inline `nums` 表枚举', hintEn: 'SQL inline `nums` enumeration' },
  ],
  sourceZh: [
    '`competitions` 与 `nums (0..9)` 表 cross-join,把每场 N 日比赛展开为 N 行(限制 `start_date + n ≤ end_date`)。和 `results` join 后,选手参加的每个具体日期都有一行。再 `DISTINCT MM/DD` 跨年合并 → `GROUP_CONCAT` 收尾。',
  ],
  sourceEn: [
    '`competitions` cross-joined with an inline `nums (0..9)` table explodes each N-day comp into N rows (constrained by `start_date + n ≤ end_date`). Joined to `results`, every concrete competing date becomes a row. `DISTINCT MM/DD` merges across years, then `GROUP_CONCAT` collects.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT COUNT(DISTINCT competition_date) attended_dates,
       person_id,
       GROUP_CONCAT(DISTINCT competition_date
                    ORDER BY competition_date ASC SEPARATOR ',') dates_list
FROM (
  SELECT person_id, DATE_FORMAT(comp_date, '%m/%d') competition_date
  FROM results
  JOIN (SELECT id, DATE_ADD(start_date, INTERVAL n DAY) comp_date
        FROM competitions
        JOIN nums ON DATE_ADD(start_date, INTERVAL n DAY) <= end_date) c
       ON c.id = results.competition_id) d
GROUP BY person_id
HAVING attended_dates >= 100`,
  },
  steps: [
    {
      titleZh: '展开多日比赛',
      titleEn: 'Explode multi-day comps',
      bodyZh: '`nums` 子查询枚举 0-9,cross-join `competitions`,用 `DATE_ADD(start_date, INTERVAL n DAY) <= end_date` 砍掉不存在的日期。多日比赛因此变成多行。',
      bodyEn: '`nums` subquery enumerates 0-9, cross-joined to `competitions`; `DATE_ADD(start_date, INTERVAL n DAY) <= end_date` trims non-existent days. Multi-day comps expand into multiple rows.',
    },
    {
      titleZh: '日期 → MM/DD',
      titleEn: 'Date → MM/DD',
      bodyZh: '`DATE_FORMAT(.., \'%m/%d\')` 抹掉年份 —— 2020 跟 2024 同月日合并。',
      bodyEn: '`DATE_FORMAT(.., \'%m/%d\')` strips year — 2020 and 2024 same date merge.',
    },
    {
      titleZh: '按选手 COUNT DISTINCT',
      titleEn: 'Per-person COUNT DISTINCT',
      bodyZh: 'GROUP BY `person_id`,数 distinct 日期;`HAVING >= 100` 砍掉常规选手。',
      bodyEn: 'GROUP BY `person_id`, count distinct dates; `HAVING >= 100` trims casual cubers.',
    },
    {
      titleZh: 'TS 按月归类 + 百分比',
      titleEn: 'TS regroup by month + %',
      bodyZh: '`dates_list` "01/05,01/12,..." 按月份分组;每月百分比 = `days.length / DAYS_IN_MONTH[m]`(2 月按 29 天)。',
      bodyEn: '`dates_list` `01/05,01/12,...` is regrouped by month; per-month % = `days.length / DAYS_IN_MONTH[m]` (Feb at 29 days).',
      highlight: true,
    },
  ],
  edgesZh: [
    '`nums` 上限 9 → 不支持 11 日及以上比赛(目前 WCA 没有,稳)。',
    '`MM/DD` 抹年份 —— 跨年同日不重复计数,所以"在多少天打过赛"是跨多年合并后的去重数。',
    '2 月按 29 天作分母 —— 非闰年的 2/29 在 5 个月份按数据合理性挂掉,但 % 显示偏低 1/29 不修。',
  ],
  edgesEn: [
    '`nums` capped at 9 → no support for 11+ day comps (none in WCA, safe).',
    '`MM/DD` discards year — same day across years dedup, so "days competed on" is multi-year-merged distinct.',
    'Feb uses 29 days as denominator — non-leap 2/29 rows just don\'t exist, but % shown is slightly underweighted (1/29) — not corrected.',
  ],
  related: [
    { id: 'competitions_per_year_by_person', titleZh: '年均频率', titleEn: 'Annual frequency', hintZh: '日期 vs 场次', hintEn: 'Days vs comps' },
    { id: 'most_attended_competitions_in_single_month', titleZh: '单月最多场次', titleEn: 'Most in a month', hintZh: '密度 vs 覆盖度', hintEn: 'Density vs coverage' },
    { id: 'most_completed_solves', titleZh: '最多完成还原', titleEn: 'Most completed solves', hintZh: 'volume 兄弟统计', hintEn: 'Sibling volume metric' },
    { id: 'most_distinct_dates_competed_on', toStat: true, titleZh: '查看实时榜', titleEn: 'Jump to live ranking', hintZh: '按月份覆盖看分布', hintEn: 'Per-month coverage view' },
  ],
};

// ──── most_solves_before_bld_success ────────────────────────────────────────
const most_solves_before_bld_success: AboutEntry = {
  id: 'most_solves_before_bld_success',
  titleZh: '盲拧成功前最多尝试次数',
  titleEn: 'Most solves before first BLD success',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '盲拧四项目(`333bf / 444bf / 555bf / 333mbf`)逐 attempt 展开,按时间顺序铺一条该选手的尝试链;**找到第一个 `value > 0`** 的下标 = 之前的失败数。0 就是第一次就成。',
    '榜首通常是几十次甚至上百次 DNF 才憋出一次成功 —— 盲拧的"成功率坡道"超陡,跟普通项目完全不同。',
  ],
  introEn: [
    'For each BLD event (`333bf / 444bf / 555bf / 333mbf`), expand attempts in time order into a flat list per cuber; **find the first `value > 0`** — its index = failures before. 0 means success on the very first attempt.',
    'Top spots are dozens or hundreds of DNFs before finally landing one — BLD has a brutal success-rate ramp unlike any speed event.',
  ],
  stats: [
    { value: '4', labelZh: '项目', labelEn: 'Events', hintZh: '333bf/444bf/555bf/333mbf', hintEn: '333bf/444bf/555bf/333mbf' },
    { value: 'DNF 计入', labelZh: '失败定义', labelEn: 'Failure', hintZh: '`value = -1`(DNF) 算尝试,`0` 不算', hintEn: '`value = -1` (DNF) counts, `0` does not' },
    { value: 'Top 20', labelZh: '每段深度', labelEn: 'Per-section depth', hintZh: '4 个项目各 top 20', hintEn: '4 events × top 20' },
  ],
  sourceZh: [
    '`results` 限 BLD 四项目,join `persons / competitions / round_types`,带 `ATTEMPTS_SUBQUERY`(把 `result_attempts.value` 用逗号拼成字符串)。按 `start_date, round_type.rank` 升序 —— 给 TS 端一条时间正确的 attempt 串。',
  ],
  sourceEn: [
    '`results` limited to the 4 BLD events, joined to `persons / competitions / round_types`, with `ATTEMPTS_SUBQUERY` (concatenates `result_attempts.value` as comma-separated). Ordered by `start_date, round_type.rank` — TS gets a time-correct attempt chain.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT event_id, person_link, ${'$'}{ATTEMPTS_SUBQUERY} AS attempts
FROM results
JOIN persons person ON wca_id = person_id AND sub_id = 1
JOIN competitions competition ON competition.id = competition_id
JOIN round_types round_type ON round_type.id = round_type_id
WHERE event_id IN ('333bf','444bf','555bf','333mbf')
ORDER BY competition.start_date, round_type.rank`,
  },
  steps: [
    {
      titleZh: '按项目过滤',
      titleEn: 'Filter by event',
      bodyZh: '只看 BLD 四项目 —— OH/FMC/普通项目都不在范围。',
      bodyEn: 'BLD-only — OH / FMC / regular events out of scope.',
    },
    {
      titleZh: '拼 attempts 字符串',
      titleEn: 'Concatenate attempts',
      bodyZh: '`ATTEMPTS_SUBQUERY` 把每个 result 的 1-5 个 attempt value 用 `,` 拼起来,SQL 一行即一 result。',
      bodyEn: '`ATTEMPTS_SUBQUERY` joins each result\'s 1-5 attempt values with `,`. One SQL row per result.',
    },
    {
      titleZh: 'TS 端按 (项目, 人) 平铺',
      titleEn: 'TS flatten by (event, person)',
      bodyZh: '每个 (项目, 人) 把所有 result 的 attempts 串展开成一维数组,**保留 -1(DNF)和 >0(成功),丢 0(skip)和 -2(DNS)**。',
      bodyEn: 'Per (event, person), flatten every result\'s attempts into a 1D array, **keeping -1 (DNF) and >0 (success), dropping 0 (skip) and -2 (DNS)**.',
    },
    {
      titleZh: 'findIndex 找首胜',
      titleEn: 'findIndex first success',
      bodyZh: '`allAttempts.findIndex(v => v > 0)` 即"前面失败几次"。从未成功 → 不上榜。',
      bodyEn: '`allAttempts.findIndex(v => v > 0)` = "how many failures before". Never succeeded → not listed.',
      highlight: true,
    },
  ],
  edgesZh: [
    '`value = 0`(未尝试 / 退场)被排除 —— 它们不是真正的"失败",别污染计数。',
    '只统计**最终成功过**的选手 —— 从未成功的不进榜,但他们其实可能更"努力"。这是上榜口径的取舍。',
    'MBLD 的 attempt 跟 BLD 用同 `value` 编码,但语义不同(MBLD value = 难度分),`> 0` 仍能正确判定为成功。',
  ],
  edgesEn: [
    '`value = 0` (skip / withdrawn) is dropped — not a real failure, would pollute the count.',
    'Only cubers who **eventually succeeded** are listed — never-succeeded cubers (possibly the hardest workers!) are absent. Tradeoff in the leaderboard scope.',
    'MBLD attempts share the `value` encoding with BLD but mean a difficulty score, not time; `> 0` still correctly flags success.',
  ],
  related: [
    { id: 'most_completed_solves', titleZh: '最多完成还原', titleEn: 'Most completed solves', hintZh: '反面 —— 成功 attempt 总量', hintEn: 'Inverse — total successful attempts' },
    { id: 'longest_time_to_sub_10', titleZh: '最长 sub-10 时长', titleEn: 'Longest time to sub-10', hintZh: '相似的"坚持型"叙事', hintEn: 'Similar perseverance narrative' },
    { id: 'most_solves_before_bld_success', toStat: true, titleZh: '查看实时榜', titleEn: 'Jump to live ranking', hintZh: '4 项目分段', hintEn: '4 events broken out' },
  ],
};

// ──── most_visited_continents ───────────────────────────────────────────────
const most_visited_continents: AboutEntry = {
  id: 'most_visited_continents',
  titleZh: '去过最多大洲参赛',
  titleEn: 'Most continents visited',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '一句 `COUNT(DISTINCT continent_id)` 做完;入榜阈值 4 —— 7 大洲里去过一半以上。WCA 没有南极洲赛事,所以理论最大值是 6。',
    '同样排除 `_Multiple Continents`(洲际 FMC 的虚拟 continent),保证 count 都是真正的洲。',
  ],
  introEn: [
    'One `COUNT(DISTINCT continent_id)` does it; cutoff is 4 — over half of the 7 continents. WCA has no Antarctica comps, so the theoretical max is 6.',
    'Excludes `_Multiple Continents` (the continental-FMC virtual continent) to keep counts to real continents.',
  ],
  stats: [
    { value: '6', labelZh: '理论上限', labelEn: 'Theoretical max', hintZh: '7 大洲 − 南极 = 6', hintEn: '7 continents − Antarctica = 6' },
    { value: '≥ 4', labelZh: '入榜阈值', labelEn: 'Cutoff', hintZh: '半数以上大洲', hintEn: 'Majority of continents' },
    { value: 'COUNT(DISTINCT)', labelZh: '聚合', labelEn: 'Aggregate', hintZh: '`continent_id` 去重数', hintEn: 'Distinct `continent_id`' },
  ],
  sourceZh: [
    '`results` join `competitions` 拿场地国,再 join `countries` 拿洲 id;`WHERE continent_id != "_Multiple Continents"` 排掉虚拟洲,`GROUP BY person_id` + `COUNT DISTINCT continent_id`。',
  ],
  sourceEn: [
    '`results` joined to `competitions` for venue country, then `countries` for continent id; `WHERE continent_id != "_Multiple Continents"` drops the virtual continent. `GROUP BY person_id` + `COUNT DISTINCT continent_id`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_id, COUNT(DISTINCT continent_id) visited_continents
FROM results
JOIN competitions ON competitions.id = competition_id
JOIN countries ON countries.id = competition.country_id
WHERE continent_id != "_Multiple Continents"
GROUP BY person_id
HAVING visited_continents >= 4
ORDER BY visited_continents DESC`,
  },
  steps: [
    {
      titleZh: '比赛国 → 大洲',
      titleEn: 'Comp country → continent',
      bodyZh: '`countries.continent_id` 给出每个比赛地所属洲;洲际 FMC 比赛属于 `_Multiple Continents`,排掉。',
      bodyEn: '`countries.continent_id` gives the continent of each venue; continental-FMC belongs to `_Multiple Continents`, filtered out.',
    },
    {
      titleZh: 'COUNT DISTINCT',
      titleEn: 'COUNT DISTINCT',
      bodyZh: '一个选手在欧洲打 50 场和打 1 场,这指标都算 1 个大洲;广度不是深度。',
      bodyEn: '50 European comps vs 1 European comp both count as 1 continent for this metric — breadth not depth.',
    },
    {
      titleZh: '阈值 + 降序',
      titleEn: 'Cutoff + sort desc',
      bodyZh: '`HAVING >= 4` 砍掉普通选手;按 distinct 大洲数降序。',
      bodyEn: '`HAVING >= 4` trims regulars; sort by distinct continent count desc.',
      highlight: true,
    },
  ],
  edgesZh: [
    'WCA 没有南极洲比赛,所以 6 是真实上限;能跑满 6 的人极少。',
    '同一个洲多个国家不会因为多了一个洲 count —— 用 `continent_id` 而不是 `country_id`。',
    '`_Multiple Continents` 排除后,洲际 FMC 邮寄赛对该指标没贡献。',
  ],
  edgesEn: [
    'No Antarctica comps, so 6 is the real ceiling; almost nobody pulls all 6.',
    'Multiple countries on the same continent don\'t add — we count `continent_id`, not `country_id`.',
    'With `_Multiple Continents` excluded, continental-FMC mail-ins contribute nothing here.',
  ],
  related: [
    { id: 'most_visited_countries', titleZh: '去过最多国家', titleEn: 'Most countries visited', hintZh: '更细粒度', hintEn: 'Finer granularity' },
    { id: 'most_competitions_abroad', titleZh: '海外参赛最多', titleEn: 'Most comps abroad', hintZh: '场次 vs 大洲数', hintEn: 'Comps vs continents' },
    { id: 'longest_competitions_path', titleZh: '最长比赛路径', titleEn: 'Longest path', hintZh: '距离视角的版本', hintEn: 'Distance angle' },
    { id: 'most_visited_continents', toStat: true, titleZh: '查看实时榜', titleEn: 'Jump to live ranking', hintZh: '具体大洲数 + 选手', hintEn: 'Continent counts + cubers' },
  ],
};

// ──── most_visited_countries ────────────────────────────────────────────────
const most_visited_countries: AboutEntry = {
  id: 'most_visited_countries',
  titleZh: '去过最多国家参赛',
  titleEn: 'Most countries visited',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '比"最多大洲"细一档:`COUNT(DISTINCT competition.country_id)`。上榜 top 100。同样排除 8 个洲际 FMC 虚拟国家,保证每条数都是真国家。',
    '跟"海外参赛"不一样 —— 这里包括**本国**(本国 = 1 个国家),而"海外"完全排除本国。所以一个完全本地化的选手在这条至少有 1 个国家。',
  ],
  introEn: [
    'One step finer than continents: `COUNT(DISTINCT competition.country_id)`. Top 100. Same 8 continental-FMC virtual countries excluded.',
    'Differs from "comps abroad" — this **includes home country** (home = 1 country), while "abroad" excludes it. A fully-local cuber still has at least 1 country here.',
  ],
  stats: [
    { value: 'Top 100', labelZh: '榜单深度', labelEn: 'Leaderboard depth', hintZh: '按国家数降序', hintEn: 'Sorted by country count desc' },
    { value: 'COUNT(DISTINCT)', labelZh: '聚合', labelEn: 'Aggregate', hintZh: '`competition.country_id` 去重数', hintEn: 'Distinct `competition.country_id`' },
    { value: '排除 8 虚拟国', labelZh: '过滤', labelEn: 'Filter', hintZh: '洲际 FMC 占位国', hintEn: 'Continental-FMC placeholders' },
  ],
  sourceZh: [
    '`results` join `competitions`,过滤掉 8 个虚拟国;`GROUP BY person_id, COUNT DISTINCT competition.country_id`。注意是**比赛国**,跟选手国籍无关。',
  ],
  sourceEn: [
    '`results` joined to `competitions`, 8 virtual countries filtered; `GROUP BY person_id, COUNT DISTINCT competition.country_id`. Note **comp country**, not cuber\'s registered country.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_id, COUNT(DISTINCT competition.country_id) visited_countries
FROM results result
JOIN competitions competition ON competition.id = competition_id
WHERE competition.country_id NOT IN
      ('XA','XE','XF','XM','XN','XO','XS','XW')
GROUP BY person_id
ORDER BY visited_countries DESC
LIMIT 100`,
  },
  steps: [
    {
      titleZh: '比赛国 distinct',
      titleEn: 'Distinct comp countries',
      bodyZh: '`competition.country_id` 是 ISO 国家码;同一国家多场比赛只算 1。',
      bodyEn: '`competition.country_id` is ISO country code; multiple comps in one country count as 1.',
    },
    {
      titleZh: '排虚拟洲际国',
      titleEn: 'Drop virtual continents',
      bodyZh: 'XA/XE/XF/XM/XN/XO/XS/XW 8 个洲际 FMC 用 placeholder,不是真国家,排掉。',
      bodyEn: 'XA/XE/XF/XM/XN/XO/XS/XW are continental-FMC placeholders, not real countries — dropped.',
    },
    {
      titleZh: '按人聚合 + 降序',
      titleEn: 'Aggregate per person + sort',
      bodyZh: '`GROUP BY person_id`,`COUNT DISTINCT`,降序 LIMIT 100;外层 join `persons` 拿名字。',
      bodyEn: '`GROUP BY person_id`, `COUNT DISTINCT`, sort desc, LIMIT 100; outer join `persons` for names.',
      highlight: true,
    },
  ],
  edgesZh: [
    '本国算作 1 个国家 —— 跟"海外参赛"指标互补(海外 = 总国家数 - 1,前提是去过本国)。',
    '没有 `HAVING` 阈值 —— 直接拉 top 100,因为只去过 1 国的人太多,排序后自然落到尾部。',
    '改国籍前后比赛地都按"比赛 country_id"算,所以不受 selfish 改名影响。',
  ],
  edgesEn: [
    'Home country counts as 1 — complementary to "comps abroad" (abroad = total countries − 1, given you\'ve competed at home).',
    'No `HAVING` cutoff — straight to top 100; people who\'ve only competed in 1 country naturally drop to the tail.',
    'Comp country is invariant under cuber\'s country-change events — uses `competition.country_id` not `result.country_id`.',
  ],
  related: [
    { id: 'most_visited_continents', titleZh: '去过最多大洲', titleEn: 'Most continents visited', hintZh: '粗一档', hintEn: 'Coarser version' },
    { id: 'most_competitions_abroad', titleZh: '海外参赛最多', titleEn: 'Most comps abroad', hintZh: '场次 vs 国家数', hintEn: 'Comps vs countries' },
    { id: 'longest_competitions_path', titleZh: '最长比赛路径', titleEn: 'Longest path', hintZh: '距离视角', hintEn: 'Distance angle' },
    { id: 'most_visited_countries', toStat: true, titleZh: '查看实时榜', titleEn: 'Jump to live ranking', hintZh: '具体国家数 + 选手', hintEn: 'Country counts + cubers' },
  ],
};

// ──── name_parts_count ──────────────────────────────────────────────────────
const name_parts_count: AboutEntry = {
  id: 'name_parts_count',
  titleZh: '姓名词数统计',
  titleEn: 'Name parts count',
  badgeZh: '人口学',
  badgeEn: 'Demographic',
  introZh: [
    '一个看起来很冷门、实际超有信息量的人口学指标:把每个 WCA 注册名按空格拆,数有几个 part。中文括号本地化名 `(耿暄一)` 在拆分前用正则 `/ \\(.*\\)/` 扔掉。',
    '英语圈名字大多 2-3 part,西班牙语系 4 part 很常见(双名 + 双姓),阿拉伯语系传统命名能上 5 + part。所以这条指标也是"哪些 part 数典型来自哪些国家"的 fingerprint。',
  ],
  introEn: [
    'A seemingly niche but highly informative demographic stat: split each WCA registered name on whitespace, count parts. Parenthesized local names like `(耿暄一)` are stripped via regex `/ \\(.*\\)/` before splitting.',
    'English-speaking names cluster at 2-3 parts; Spanish-speaking traditions often hit 4 (double given + double family); Arabic-traditional names can reach 5+. The metric doubles as a country-origin fingerprint per part count.',
  ],
  stats: [
    { value: '空格', labelZh: '分隔符', labelEn: 'Separator', hintZh: '`name.split(\' \')`', hintEn: '`name.split(\' \')`' },
    { value: 'Top 5', labelZh: '每段国家数', labelEn: 'Top countries shown', hintZh: '每个 part-count 的 top 5 国家', hintEn: 'Per part-count, top 5 countries' },
    { value: '`sub_id = 1`', labelZh: '身份过滤', labelEn: 'Identity filter', hintZh: '主行,改名 / 副身份不算', hintEn: 'Primary row only' },
  ],
  sourceZh: [
    '只用 `persons` 表:`name` + `country_id` join `countries.name`,过 `sub_id = 1`。SQL 拉全表,TS 端拆词、分组、统计。',
  ],
  sourceEn: [
    'Only `persons`: `name` + `country_id` joined to `countries.name`, filtered `sub_id = 1`. SQL pulls the full table; TS handles splitting, grouping, counting.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person.name, country.name country_name
FROM persons person
JOIN countries country ON country.id = country_id
WHERE sub_id = 1`,
  },
  steps: [
    {
      titleZh: '剥本地名 + split',
      titleEn: 'Strip local name + split',
      bodyZh: '`name.replace(/ \\(.*\\)/, \'\')` 去括号本地名 → `split(\' \')` 数 part。"Xuanyi Geng (耿暄一)" → ["Xuanyi", "Geng"] = 2 part。',
      bodyEn: '`name.replace(/ \\(.*\\)/, \'\')` strips parenthesized local → `split(\' \')` counts parts. "Xuanyi Geng (耿暄一)" → ["Xuanyi", "Geng"] = 2 parts.',
    },
    {
      titleZh: '按 part 数分桶',
      titleEn: 'Bucket by part count',
      bodyZh: 'Map<partsCount, Person[]>;同时记国家名,便于第二步聚合。',
      bodyEn: 'Map<partsCount, Person[]>; carry country alongside for next aggregation.',
    },
    {
      titleZh: '每桶 top 5 国家',
      titleEn: 'Top 5 countries per bucket',
      bodyZh: '对每 partsCount,内部按国家计数;取 top 5,显示 `Country (x.xx %)` —— 占该 partsCount 群体的比例。',
      bodyEn: 'Within each partsCount, count by country; take top 5, formatted `Country (x.xx %)` — share of that part-count subset.',
    },
    {
      titleZh: '按 partsCount 升序',
      titleEn: 'Sort by partsCount asc',
      bodyZh: '1 part(单名)→ 2 → 3 → ...,自然地分布观感。',
      bodyEn: '1 part (mononym) → 2 → 3 → ..., natural distribution feel.',
      highlight: true,
    },
  ],
  edgesZh: [
    '括号本地化只剥**带前导空格**的括号 —— "Name(Local)" 不带空格不剥;实际 WCA 都规范化为 "Name (Local)",安全。',
    '"O\'Brien"、"de la Rosa" 这种含撇号 / 连字符 / 前缀词的 part 数会偏多 —— 没语言学拆分,纯空格切。',
    '`split(\' \')` 在多空格上会产生空 part —— WCA 数据干净,实际不会触发。',
  ],
  edgesEn: [
    'Local-name strip only removes parens **with a leading space** — "Name(Local)" without space stays; WCA always normalizes to "Name (Local)" though, safe.',
    '"O\'Brien", "de la Rosa" with apostrophes / hyphens / particles will inflate counts — pure whitespace split, no linguistic awareness.',
    '`split(\' \')` on multiple spaces yields empty parts — WCA data is clean enough that this never fires in practice.',
  ],
  related: [
    { id: 'most_visited_countries', titleZh: '去过最多国家', titleEn: 'Most countries visited', hintZh: '另一个跨国维度', hintEn: 'Another cross-country angle' },
    { id: 'name_parts_count', toStat: true, titleZh: '查看实时分布', titleEn: 'Jump to live distribution', hintZh: '各 part 数 + top 国家', hintEn: 'Each part-count + top countries' },
  ],
};

// ──── shortest_time_to_reach_milestone_in_comps_count ──────────────────────
const shortest_time_to_reach_milestone_in_comps_count: AboutEntry = {
  id: 'shortest_time_to_reach_milestone_in_comps_count',
  titleZh: '最短时间达到比赛数里程碑',
  titleEn: 'Shortest time to N comps milestone',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '一个 SQL 拉所有 (选手, 场, 日期) 排序,TS 端对 9 个里程碑(5/10/25/50/100/150/200/250/300)各算一次:**第 N 场比赛日 − 首场比赛日 + 1 天**。',
    '是 `competitions_per_year_by_person` 的"短窗口"对照 —— 那条是终身年化率,这条只看"前 N 场用了多少天",更能体现"冲量期"的烈度。',
  ],
  introEn: [
    'One SQL pulls all (cuber, comp, date) sorted; TS computes 9 milestones (5/10/25/50/100/150/200/250/300) each: **date of N-th comp − date of 1st + 1 day**.',
    'Short-window counterpart to `competitions_per_year_by_person` — that one is lifetime annualized; this one captures pure burn-rate during the run-up.',
  ],
  stats: [
    { value: '9', labelZh: '里程碑数', labelEn: 'Milestones', hintZh: '5/10/25/50/100/150/200/250/300', hintEn: '5/10/25/50/100/150/200/250/300' },
    { value: 'Top 20', labelZh: '每段深度', labelEn: 'Per-section depth', hintZh: '每个里程碑独立 top 20', hintEn: 'Each milestone separate top 20' },
    { value: '+1 day', labelZh: '日数补正', labelEn: 'Day offset', hintZh: '首尾都计入', hintEn: 'Inclusive of both endpoints' },
  ],
  sourceZh: [
    '`results` 取 `DISTINCT (person_id, competition_id, start_date)`,按 `start_date` 升序。TS 端按选手分组拿到日期数组 `dates[]`;`dates[count-1]` 是第 N 场,与 `dates[0]` 求差。',
  ],
  sourceEn: [
    '`results` with `DISTINCT (person_id, competition_id, start_date)`, sorted by `start_date`. TS groups by person to get `dates[]`; `dates[count-1]` is the N-th comp, diffed against `dates[0]`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_link, start_date
FROM (SELECT DISTINCT person_id, competition_id, start_date
      FROM results
      JOIN competitions ON competitions.id = competition_id) cd
JOIN persons person ON person.wca_id = person_id AND sub_id = 1
ORDER BY start_date`,
  },
  steps: [
    {
      titleZh: '拉时间线',
      titleEn: 'Pull the timeline',
      bodyZh: 'SQL 端只输出 (人, 日期) 行,内部按日期升序 —— 后续 TS 端 push 到数组天然就是时序。',
      bodyEn: 'SQL only emits (person, date) rows, internally date-sorted — TS just pushes into an array and gets time order for free.',
    },
    {
      titleZh: '按选手收集 dates[]',
      titleEn: 'Bucket dates[] per person',
      bodyZh: 'Map<person, Date[]>;每个数组长度 = 该选手的总场次。',
      bodyEn: 'Map<person, Date[]>; array length = total comps for that cuber.',
    },
    {
      titleZh: '逐里程碑算天数',
      titleEn: 'Days per milestone',
      bodyZh: '`dates.length >= count` 才参与;`days = floor((dates[count-1] − dates[0]) / 24h) + 1`(+1 让"同日 2 场"得 1 而非 0)。',
      bodyEn: '`dates.length >= count` to qualify; `days = floor((dates[count-1] − dates[0]) / 24h) + 1` (+1 so "2 comps same day" = 1, not 0).',
    },
    {
      titleZh: '每里程碑 top 20',
      titleEn: 'Top 20 per milestone',
      bodyZh: '9 个 GroupedStatistic section,每段独立 sort 升序取 20。',
      bodyEn: '9 GroupedStatistic sections, each sorted asc + top 20.',
      highlight: true,
    },
  ],
  edgesZh: [
    '"+1" 让首尾同日(理论上 5 场同日)算 1 天而不是 0 —— 跟 `competitions_per_year_by_person` 用 365.25 的精确口径不同。',
    '里程碑顺序按 count 升序输出(5 → 300);UI 端要展示完整光谱。',
    '部分项目特别多 / 高频选手在 5 场里程碑上几乎全是同周末连开 —— top 20 经常 1-3 天。',
  ],
  edgesEn: [
    '"+1" makes same-day endpoints (theoretical 5 comps in a day) = 1 day not 0 — different from `competitions_per_year_by_person` which uses precise 365.25.',
    'Milestones output asc by count (5 → 300); UI displays the full spectrum.',
    'For 5-comp milestone, high-cadence cubers often back-to-back the same weekend — top 20 commonly 1-3 days.',
  ],
  related: [
    { id: 'competitions_per_year_by_person', titleZh: '年均频率', titleEn: 'Annual frequency', hintZh: '终身视角的对照', hintEn: 'Lifetime counterpart' },
    { id: 'most_attended_competitions_in_single_month', titleZh: '单月最多场次', titleEn: 'Most in a month', hintZh: '更短窗口', hintEn: 'Shorter window' },
    { id: 'most_attended_competitions_in_single_week', titleZh: '单周最多场次', titleEn: 'Most in a week', hintZh: '最短窗口', hintEn: 'Shortest window' },
    { id: 'shortest_time_to_reach_milestone_in_comps_count', toStat: true, titleZh: '查看实时榜', titleEn: 'Jump to live ranking', hintZh: '9 个里程碑切换', hintEn: 'Toggle across 9 milestones' },
  ],
};

// ──── shortest_time_to_get_all_singles ──────────────────────────────────────
const shortest_time_to_get_all_singles: AboutEntry = {
  id: 'shortest_time_to_get_all_singles',
  titleZh: '最短时间获得所有项目单次成绩',
  titleEn: 'Shortest time to get all singles',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '"全 single"(每个**当前官方**项目都拿过一个有效 single)选手的最短达成时间。子查询用 `events.rank < 900` 滤掉退役项目,`COUNT(DISTINCT event_id) = (SELECT COUNT(*) FROM events WHERE rank<900)` 锁定候选人。',
    '榜首通常都是一年内全打卡的"全能加速党";最快可在数月内完成,但需要参加涵盖罕见项目(7x7 / FMC / Multi-Blind)的比赛 —— 地区少了根本凑不齐。',
  ],
  introEn: [
    'Cubers who got a valid single in **every current official event**, sorted by time-to-completion. Subquery filters retired events via `events.rank < 900`, then `COUNT(DISTINCT event_id) = (SELECT COUNT(*) FROM events WHERE rank<900)` locks candidates.',
    'Top spots usually finish within a year; the absolute fastest take months, but you need comps that hold rare events (7x7 / FMC / Multi-Blind) — sparse regions just can\'t close the set.',
  ],
  stats: [
    { value: 'rank < 900', labelZh: '官方项目过滤', labelEn: 'Official filter', hintZh: '退役项目 rank ≥ 900', hintEn: 'Retired events at rank ≥ 900' },
    { value: 'best > 0', labelZh: '有效 single', labelEn: 'Valid single', hintZh: 'DNF 不算', hintEn: 'DNF doesn\'t count' },
    { value: '首场 → 最后项目', labelZh: '时间口径', labelEn: 'Time span', hintZh: '不止 333 入坑那天', hintEn: 'Not just 3x3 debut' },
  ],
  sourceZh: [
    '子查询锁定"全 single"选手 → 外层 join 全部 results,逐 (人, 项目) 找最早 `best > 0` 的日期。最后一个项目完成的日期减去首场比赛日期即天数。',
    '历史上 `Object.keys(EVENTS).length` 用 21(含退役)的写法会让 HAVING 永远不满足 → 改用 `(SELECT COUNT(*) FROM events WHERE rank<900)` 子查询匹配 SQL 端过滤。',
  ],
  sourceEn: [
    'Subquery isolates "all-singles" cubers → outer join pulls all their results, finds the earliest `best > 0` per (person, event). Last event\'s completion date minus first comp date = days.',
    'Historical note: using `Object.keys(EVENTS).length = 21` (with retired) would never satisfy the HAVING — switched to `(SELECT COUNT(*) FROM events WHERE rank<900)` subquery to match the SQL filter.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT event_id, person_link, start_date, best
FROM (SELECT person_id FROM results
      JOIN events ON events.id = event_id
      WHERE rank < 900 AND best > 0
      GROUP BY person_id
      HAVING COUNT(DISTINCT event_id) =
             (SELECT COUNT(*) FROM events WHERE rank<900)) all_events
JOIN results r ON r.person_id = all_events.person_id
JOIN persons person ON wca_id = r.person_id AND sub_id = 1
JOIN competitions ON id = competition_id
ORDER BY start_date`,
  },
  steps: [
    {
      titleZh: '锁"全 single"候选人',
      titleEn: 'Lock "all-singles" candidates',
      bodyZh: '子查询 `HAVING COUNT(DISTINCT event_id) = (SELECT COUNT(*) FROM events WHERE rank<900)` —— 当前官方项目全部至少一个 `best > 0`。',
      bodyEn: 'Subquery `HAVING COUNT(DISTINCT event_id) = (SELECT COUNT(*) FROM events WHERE rank<900)` — at least one `best > 0` in every current event.',
    },
    {
      titleZh: '拉全 results 时间线',
      titleEn: 'Pull full results timeline',
      bodyZh: '外层 join 候选人的所有 results;TS 端按选手分组,首条即首场比赛(`start_date` 升序保证)。',
      bodyEn: 'Outer pulls every result for candidates; TS groups by person, first row = first comp (`start_date` ascending guarantees).',
    },
    {
      titleZh: '每项目最早成功日',
      titleEn: 'Earliest success per event',
      bodyZh: 'Map<eventId, Date>:遍历 personRows,只保留 `best > 0` 的最早日期。最后一个完成项目的日期是 Map 里最大值。',
      bodyEn: 'Map<eventId, Date>: iterate personRows, keep earliest `best > 0` date per event. Last-completed event = max value in the Map.',
    },
    {
      titleZh: '日数差升序',
      titleEn: 'Day-diff ascending',
      bodyZh: '`days = floor((lastEventDate − firstDate) / 24h)`;按天数升序,无 LIMIT(榜单不裁,UI 端分页)。',
      bodyEn: '`days = floor((lastEventDate − firstDate) / 24h)`; sort asc, no LIMIT (UI paginates).',
      highlight: true,
    },
  ],
  edgesZh: [
    '"首场比赛"含所有项目 —— 你打过 OH 再回头补 3x3 single,起算点是 OH 那场。',
    '只看**当前**官方项目;退役项目(magic / clock 老规则等,rank ≥ 900)不要求。',
    '`best > 0` 排 DNF,因此 DNF 拼到最后凑数不算 —— 真要成功一次。',
  ],
  edgesEn: [
    '"First comp" spans all events — if you did OH first then circled back for 3x3 single, the clock starts at the OH comp.',
    'Only **current** official events; retired events (old magic / clock-rule, rank ≥ 900) not required.',
    '`best > 0` excludes DNFs — last-event DNFs don\'t patch the set, must be a real success.',
  ],
  related: [
    { id: 'shortest_time_to_get_all_singles_and_averages', titleZh: '全 single + 全 average', titleEn: 'All singles + averages', hintZh: '加 average 维度,门槛更高', hintEn: 'Adds average dimension, harder' },
    { id: 'longest_time_to_sub_10', titleZh: '最长 sub-10 时长', titleEn: 'Longest time to sub-10', hintZh: '反方向 —— "最慢"故事', hintEn: 'Opposite — "slowest" story' },
    { id: 'shortest_time_to_reach_milestone_in_comps_count', titleZh: '最快达比赛里程碑', titleEn: 'Fastest to N comps', hintZh: '另一种"最快"达成', hintEn: 'Another "fastest to" stat' },
    { id: 'shortest_time_to_get_all_singles', toStat: true, titleZh: '查看实时榜', titleEn: 'Jump to live ranking', hintZh: '具体天数 + 选手', hintEn: 'Days + cubers' },
  ],
};

// ──── shortest_time_to_get_all_singles_and_averages ─────────────────────────
const shortest_time_to_get_all_singles_and_averages: AboutEntry = {
  id: 'shortest_time_to_get_all_singles_and_averages',
  titleZh: '最短时间获得所有项目的单次和平均成绩',
  titleEn: 'Shortest time to all singles + averages',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '比"全 single"更狠的成就:**还要补齐每个有平均的项目的 average**。3x3 Multi-Blind 没 average,所以 average 集合的目标值是 `当前项目数 − 1`。',
    '凑 average 比凑 single 难 —— BLD 系列要打过 ≥ 2 次成功才能算"有 average"(成功 / 3 attempts);MBLD 直接不参与 average 维度。所以这个榜的天数普遍是 single 榜的 1.5-3 倍。',
  ],
  introEn: [
    'A harsher version of "all singles": **also fill every event-with-average\'s average**. 3x3 Multi-Blind has no average, so the average target is `current event count − 1`.',
    'Averages are harder than singles — BLD events need ≥ 2 successes (success / 3 attempts) to register an average; MBLD opts out of the average dimension entirely. Day counts here run 1.5-3× the singles board.',
  ],
  stats: [
    { value: 'singles N + avg (N − 1)', labelZh: '目标', labelEn: 'Target', hintZh: 'MBLD 无 average', hintEn: 'MBLD has no average' },
    { value: 'best > 0 / average > 0', labelZh: '有效门槛', labelEn: 'Validity', hintZh: '各自最早成功日', hintEn: 'Earliest success per type' },
    { value: '取最大日期', labelZh: '收尾日', labelEn: 'Closing date', hintZh: 'singles 和 averages 中最晚的', hintEn: 'Latest across both sets' },
  ],
  sourceZh: [
    '双子查询交 join:① 全 single 候选(`COUNT DISTINCT event_id = N`);② 全 average 候选(`COUNT DISTINCT event_id = N − 1`,因 MBLD 无 avg)。两条都满足 → 拉全 results 进入 TS 计算。',
  ],
  sourceEn: [
    'Two subqueries intersected: ① all-singles candidates (`COUNT DISTINCT event_id = N`); ② all-averages candidates (`COUNT DISTINCT event_id = N − 1` since MBLD has no avg). Both pass → outer pulls all results into TS.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT event_id, person_link, start_date, best, average
FROM (SELECT person_id FROM results JOIN events ON id=event_id
      WHERE rank<900 AND best>0
      GROUP BY person_id
      HAVING COUNT(DISTINCT event_id)=
             (SELECT COUNT(*) FROM events WHERE rank<900)) singles
JOIN (SELECT person_id FROM results JOIN events ON id=event_id
      WHERE rank<900 AND average>0
      GROUP BY person_id
      HAVING COUNT(DISTINCT event_id)=
             (SELECT COUNT(*) FROM events WHERE rank<900) - 1) avgs USING(person_id)
JOIN results r USING(person_id)
JOIN persons person ON wca_id=person_id AND sub_id=1
JOIN competitions ON id=competition_id
ORDER BY start_date`,
  },
  steps: [
    {
      titleZh: '双子查询交集',
      titleEn: 'Intersect two subqueries',
      bodyZh: '同时满足"全 single"和"全 average"才进入候选;`= N − 1` 是为了排除 MBLD 没 average 的客观事实。',
      bodyEn: 'Must satisfy both "all singles" and "all averages" subqueries; `= N − 1` excludes MBLD which has no avg by definition.',
    },
    {
      titleZh: '收集 best + average 日期',
      titleEn: 'Collect best + average dates',
      bodyZh: 'TS 端遍历两遍 personRows:第一遍按 `best > 0` 取每项目最早日;第二遍按 `average > 0`。两组日期数组合并。',
      bodyEn: 'TS iterates personRows twice: once collecting earliest `best > 0` per event, once for `average > 0`. Concatenate the two date lists.',
    },
    {
      titleZh: '最大日 − 首场日',
      titleEn: 'Max date − first date',
      bodyZh: 'firstSuccesses 数组里取最大值即"最后一块拼图"完成日;减去首场比赛日。',
      bodyEn: 'max of firstSuccesses = "last piece" date; subtract first comp date.',
    },
    {
      titleZh: '升序展示',
      titleEn: 'Sort asc',
      bodyZh: '按天数升序;无 LIMIT。这条天数通常远高于 single 榜,因为 average 拼图含 BLD 系列。',
      bodyEn: 'Days asc, no LIMIT. Counts typically far above the singles board because the average set includes BLD events.',
      highlight: true,
    },
  ],
  edgesZh: [
    'BLD 系列(`333bf/444bf/555bf`)只有 3 attempts,要 ≥ 2 成功才会产生 average → 这一关常常卡住挑战者数月。',
    'MBLD 因没 average 完全不在 average 候选条件里(`N − 1`);3x3 FMC 有 average("三次平均"),要凑齐。',
    '`firstSuccesses` 含同事件 single + average 各自最早日 —— 两者日期可不同(先 single 后 average 很常见)。',
  ],
  edgesEn: [
    'BLD events (`333bf/444bf/555bf`) get only 3 attempts each, need ≥ 2 successes to log an average — this gate stalls many cubers for months.',
    'MBLD opts out entirely (`N − 1` target); 3x3 FMC averages ("mo3") are part of the set.',
    '`firstSuccesses` holds per-event single AND average earliest dates — they often differ (single first, average later).',
  ],
  related: [
    { id: 'shortest_time_to_get_all_singles', titleZh: '最快全 single', titleEn: 'Fastest to all singles', hintZh: '更松的目标', hintEn: 'Looser target' },
    { id: 'most_solves_before_bld_success', titleZh: '盲拧成功前尝试数', titleEn: 'Solves before BLD success', hintZh: 'BLD average 卡门坎', hintEn: 'BLD average is the choke point' },
    { id: 'longest_time_to_sub_10', titleZh: '最长 sub-10 时长', titleEn: 'Longest time to sub-10', hintZh: '反面 —— "最慢"', hintEn: 'Inverse — "slowest"' },
    { id: 'shortest_time_to_get_all_singles_and_averages', toStat: true, titleZh: '查看实时榜', titleEn: 'Jump to live ranking', hintZh: '具体天数 + 选手', hintEn: 'Days + cubers' },
  ],
};

export const JOURNEY_ABOUT: Record<string, AboutEntry> = {
  competitions_per_year_by_person,
  longest_competitions_path,
  longest_streak_of_competitions_in_own_country,
  longest_streak_of_personal_records,
  longest_streak_of_podiums,
  longest_time_to_sub_10,
  most_attended_competitions_in_single_month,
  most_attended_competitions_in_single_week,
  most_competitions_abroad,
  most_completed_solves,
  most_distinct_dates_competed_on,
  most_solves_before_bld_success,
  most_visited_continents,
  most_visited_countries,
  name_parts_count,
  shortest_time_to_reach_milestone_in_comps_count,
  shortest_time_to_get_all_singles,
  shortest_time_to_get_all_singles_and_averages,
};
