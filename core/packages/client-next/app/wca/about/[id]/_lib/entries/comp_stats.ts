// 赛事统计 — about entries
import type { AboutEntry } from '../types';

// ──── average_event_count_by_competition ────────────────────────────────────
const average_event_count_by_competition: AboutEntry = {
  id: 'average_event_count_by_competition',
  titleZh: '每场比赛平均参赛项目数',
  titleEn: 'Average event count by competition',
  badgeZh: '赛事',
  badgeEn: 'Competition',
  introZh: [
    '每场比赛里,每位选手平均报名/参赛了多少个项目?把比赛内所有选手的"参赛项目数"做算术平均,就得到这一项指标。',
    '数值高一般意味着两件事:一是赛程齐(项目摆得多),二是选手愿意报(多项目热情高)。小邀请赛 / 单项目专场会偏低,综合性大赛偏高。',
  ],
  introEn: [
    'For each competition, how many events did its competitors participate in on average? Arithmetic mean of "events run per person" across everyone at that comp.',
    'A high value usually means two things at once: the schedule was broad, and competitors actually opted into many of those events. Single-event or invitational comps land low; big general-purpose meets land high.',
  ],
  stats: [
    { value: 'AVG', labelZh: '聚合方式', labelEn: 'Aggregation', hintZh: '算术平均', hintEn: 'Arithmetic mean' },
    { value: 'top 100', labelZh: '榜单长度', labelEn: 'Leaderboard size', hintZh: '按平均项目数降序', hintEn: 'Top 100 by mean event count' },
    { value: '2 位小数', labelZh: '精度', labelEn: 'Precision', hintZh: 'toFixed(2)', hintEn: 'toFixed(2)' },
    { value: '4 列', labelZh: '表头', labelEn: 'Columns', hintZh: '比赛 / 均值 / 选手数 / 国家', hintEn: 'Competition / mean / competitors / country' },
  ],
  sourceZh: [
    '只读 `results` 表 —— 一行 = 某选手在某比赛某项目的某轮成绩。先把 `(competition_id, person_id)` 分组,`COUNT(DISTINCT event_id)` 得到每人在该比赛的项目数;再外层按比赛聚合一次,取 `AVG`。',
  ],
  sourceEn: [
    'Reads only the `results` table — one row per (person, competition, event, round). Inner group by `(competition_id, person_id)` with `COUNT(DISTINCT event_id)` gives per-person event count at that comp; outer group by competition takes the `AVG`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  competition.cell_name,
  AVG(event_count) average_event_count,
  COUNT(*) competitors,
  country.name country
FROM (
  SELECT competition_id, person_id,
         COUNT(DISTINCT event_id) event_count
  FROM results
  GROUP BY competition_id, person_id
) AS competitors_with_event_count
JOIN competitions competition ON competition.id = competition_id
JOIN countries country ON country.id = competition.country_id
GROUP BY competition_id
ORDER BY average_event_count DESC
LIMIT 100;`,
  },
  steps: [
    {
      titleZh: '按 (比赛, 选手) 分组',
      titleEn: 'Group by (competition, person)',
      bodyZh: '在 `results` 上做内层 GROUP BY `(competition_id, person_id)`,行数 = 每场比赛参与的"选手 × 1"。',
      bodyEn: 'Inner `GROUP BY (competition_id, person_id)` on `results`. Each output row = one competitor at one comp.',
    },
    {
      titleZh: '数项目数',
      titleEn: 'Count distinct events',
      bodyZh: '组内 `COUNT(DISTINCT event_id)` —— 同一人同一项目多轮只算一次。',
      bodyEn: '`COUNT(DISTINCT event_id)` per group — multiple rounds of the same event collapse to one.',
    },
    {
      titleZh: '外层按比赛聚合',
      titleEn: 'Outer group by competition',
      bodyZh: '外层把内层结果按 `competition_id` 再分一次组,取 `AVG(event_count)` 作为该比赛的平均项目数,同时 `COUNT(*)` 出选手数。',
      bodyEn: 'Outer `GROUP BY competition_id` over the inner result, taking `AVG(event_count)` as the mean and `COUNT(*)` as competitor count.',
    },
    {
      titleZh: '挂上国家 / 比赛链接',
      titleEn: 'Join country and comp link',
      bodyZh: 'JOIN `competitions` 拿 `cell_name` 做链接显示,JOIN `countries` 拿国名作右侧列。',
      bodyEn: 'JOIN `competitions` for the display `cell_name` (used in the WCA link) and `countries` for the right-most column.',
    },
    {
      titleZh: '降序取前 100',
      titleEn: 'Sort and take top 100',
      bodyZh: '`ORDER BY average_event_count DESC LIMIT 100`,均值前留 2 位小数。',
      bodyEn: '`ORDER BY average_event_count DESC LIMIT 100`; the mean is rendered with two decimals.',
      highlight: true,
    },
  ],
  edgesZh: [
    '没报名但出现在 `results` 表的轮次才算 —— 报了名但没去现场(DNS 整轮)的选手不计入。',
    '"项目数"是 distinct event,不是 distinct 轮数 —— 一个人在 3x3 打了 3 轮和 1 轮算同等贡献。',
    '榜首通常是早期小型综合赛 —— 项目数稳,人少时均值容易往上推。',
  ],
  edgesEn: [
    'Only rounds present in `results` count — registered-but-no-show competitors (full DNS) do not contribute.',
    '"Event count" is `DISTINCT event_id`, not round count — someone doing 3 rounds of 3x3 contributes the same as someone doing 1.',
    'The top of the board is usually small early-era multi-event meets — broad schedule plus low headcount pushes the mean up.',
  ],
  related: [
    { id: 'competitions_per_year_by_country', titleZh: '每年每国比赛数', titleEn: 'Competitions per year by country', hintZh: '另一种"赛事密度"切片', hintEn: 'Sibling slice of competition density' },
    { id: 'fewest_competitors_contest', titleZh: '参赛人数最少的比赛', titleEn: 'Fewest competitors contest', hintZh: '人数维度的相对面', hintEn: 'Opposite end on the headcount axis' },
    { id: 'most_records_at_single_competition', titleZh: '单场比赛最多纪录', titleEn: 'Most records at a single competition', hintZh: '另一种"单场强度"指标', hintEn: 'Another single-comp intensity metric' },
    { id: 'average_event_count_by_competition', toStat: true, titleZh: '查看实时榜单', titleEn: 'Jump to live data', hintZh: '完整 top 100', hintEn: 'Full top 100' },
  ],
};

// ──── competition_days_count_by_region ──────────────────────────────────────
const competition_days_count_by_region: AboutEntry = {
  id: 'competition_days_count_by_region',
  titleZh: '按区域统计比赛天数',
  titleEn: 'Competition days count by region',
  badgeZh: '赛事',
  badgeEn: 'Competition',
  introZh: [
    '每场比赛持续 1 至若干天(`end_date - start_date + 1`)。把所有比赛的天数按"地区"分桶,算每个地区的**平均比赛天长**和总场次,得到一张三档(World / Continents / Countries)分组表。',
    '直观回答:同样办比赛,哪些地方更倾向于多日赛?在多人多项目的大赛区里,多日是标配;小区域 / 项目少的地方一日完结。',
  ],
  introEn: [
    'Each comp spans 1 or more days (`end_date - start_date + 1`). Bucket every comp by region, take the **mean days per comp** and total count — output is a three-tier grouped table (World / Continents / Countries).',
    'Cleanly answers: where do organizers lean toward multi-day comps? Big multi-event regions almost always need >1 day; small regions or single-event meets wrap in a day.',
  ],
  stats: [
    { value: '3 档', labelZh: '分组维度', labelEn: 'Group tiers', hintZh: 'World / Continents / Countries', hintEn: 'World / Continents / Countries' },
    { value: '+1 天', labelZh: '区间口径', labelEn: 'Range convention', hintZh: '含首尾两端', hintEn: 'Inclusive of both ends' },
    { value: '排除虚拟', labelZh: '排除项', labelEn: 'Excludes', hintZh: '7 个 X* 虚拟国家 + 多洲', hintEn: '7 X* virtual countries + multi-continent' },
    { value: 'mean ↓', labelZh: '排序', labelEn: 'Sort', hintZh: '组内按均值降序', hintEn: 'Within tier by mean DESC' },
  ],
  sourceZh: [
    '只读 `competitions` 表,逐行算 `DATEDIFF(end_date, start_date) + 1` 作为比赛天数;JOIN `countries` / `continents` 取人话名字。过滤掉 7 个 X 开头的虚拟国家代码(`XA/XE/XF/XM/XN/XO/XS/XW`)和 `_Multiple Continents`。',
  ],
  sourceEn: [
    'Reads only `competitions`, computing `DATEDIFF(end_date, start_date) + 1` per row. Joins `countries` / `continents` for display names. Filters the 7 virtual `X*` country codes (`XA/XE/XF/XM/XN/XO/XS/XW`) and `_Multiple Continents`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  (DATEDIFF(end_date, start_date) + 1) days,
  country.name country,
  continent.name continent
FROM competitions
JOIN countries country ON country.id = country_id
JOIN continents continent ON continent.id = continent_id
WHERE country_id NOT IN ('XA','XE','XF','XM','XN','XO','XS','XW')
  AND continent_id != "_Multiple Continents";`,
  },
  steps: [
    {
      titleZh: '逐场算天数',
      titleEn: 'Compute per-comp days',
      bodyZh: '`days = DATEDIFF(end_date, start_date) + 1`。同日比赛 = 1 天,跨周末两日赛 = 2 天。',
      bodyEn: '`days = DATEDIFF(end_date, start_date) + 1`. Same-day = 1, weekend two-day = 2.',
    },
    {
      titleZh: '过滤虚拟地区',
      titleEn: 'Filter virtual regions',
      bodyZh: 'WCA dump 里有 7 个 `X*` 占位国家代码(给一些跨域比赛用的虚拟值)和 `_Multiple Continents`,统计前先剔掉。',
      bodyEn: 'The WCA dump uses 7 `X*` placeholder country codes (for cross-region edge cases) plus `_Multiple Continents` — drop these before tallying.',
    },
    {
      titleZh: '三档 group 键',
      titleEn: 'Three group keys',
      bodyZh: 'TypeScript 端用三个 `groupFn`:`World` 全合并、`Continents` 按 `continent.name`、`Countries` 按 `country.name`。',
      bodyEn: 'TS-side three `groupFn`s: `World` collapses everything, `Continents` keys on `continent.name`, `Countries` on `country.name`.',
    },
    {
      titleZh: '组内累加',
      titleEn: 'Accumulate within group',
      bodyZh: '每组记 `totalDays` 和 `count`;`mean = totalDays / count`。',
      bodyEn: 'Each group tracks `totalDays` and `count`; `mean = totalDays / count`.',
    },
    {
      titleZh: '排序并输出三表',
      titleEn: 'Sort and emit three tables',
      bodyZh: '组内按 `mean` 降序排,同值时按地区名 `localeCompare`;输出 `[ header, rows ]` 元组列表,前端三个 tab 渲染。',
      bodyEn: 'Within each tier sort by `mean` DESC, breaking ties by region name `localeCompare`. Emit a list of `[header, rows]` tuples — the UI renders one tab per tier.',
      highlight: true,
    },
  ],
  edgesZh: [
    '"天数"含首尾两端 —— 单日赛是 1,不是 0。',
    '`country_id NOT IN (...)` 排除 7 个 X 代码,这些是 WCA 给跨域赛用的虚拟国别,统计上没有意义。',
    'World 档只有 1 行,均值是全球所有比赛的总天数除以总场次。',
  ],
  edgesEn: [
    '"Days" is inclusive of both endpoints — a one-day comp is 1, not 0.',
    'The `country_id NOT IN (...)` clause drops 7 virtual codes WCA uses for multi-country edge cases — they are not meaningful in regional stats.',
    'The World tier has a single row — the mean is total days across all comps divided by total comp count.',
  ],
  related: [
    { id: 'competitions_per_year_by_country', titleZh: '每年每国比赛数', titleEn: 'Competitions per year by country', hintZh: '按时间维度看赛事密度', hintEn: 'Comp density on the time axis' },
    { id: 'competitions_count_by_week', titleZh: '每周比赛数量', titleEn: 'Competitions count by week', hintZh: '同一份赛事数据另一种切法', hintEn: 'Same data sliced by ISO week' },
    { id: 'average_event_count_by_competition', titleZh: '每场比赛平均项目数', titleEn: 'Average event count by competition', hintZh: '与天数强相关', hintEn: 'Strongly correlated with days' },
    { id: 'competition_days_count_by_region', toStat: true, titleZh: '查看实时榜单', titleEn: 'Jump to live data', hintZh: '三档地区切换', hintEn: 'Three-tier region switcher' },
  ],
};

// ──── competitions_count_by_week ────────────────────────────────────────────
const competitions_count_by_week: AboutEntry = {
  id: 'competitions_count_by_week',
  titleZh: '每周比赛数量',
  titleEn: 'Competitions count by week',
  badgeZh: '赛事',
  badgeEn: 'Competition',
  introZh: [
    '把每场比赛归到它 `start_date` 所在的 ISO 周(周一开始、周日结束),数一数那一周全球开了多少场。降序排,能直接读出历史上最忙的几个"魔方周末"。',
    '通常榜首集中在每年 6 月底到 8 月初(暑期 + WC 年的 Worlds 前夕),个别极端值出现在区域性大型集中办赛的周。',
  ],
  introEn: [
    'Bucket every comp by the ISO week containing its `start_date` (Monday → Sunday). Count comps per week, sort DESC — the top of the board surfaces the busiest "cubing weekends" in history.',
    'The top weeks typically cluster around late June to early August (summer plus pre-Worlds in WC years), with occasional spikes from coordinated regional pushes.',
  ],
  stats: [
    { value: '周一', labelZh: '周起点', labelEn: 'Week starts on', hintZh: 'ISO 8601', hintEn: 'ISO 8601' },
    { value: 'show_at_all', labelZh: '过滤', labelEn: 'Filters', hintZh: '排除隐藏比赛', hintEn: 'Hidden comps excluded' },
    { value: 'cancelled IS NULL', labelZh: '过滤', labelEn: 'Filters', hintZh: '排除已取消', hintEn: 'Cancelled comps excluded' },
    { value: '"List" 链接', labelZh: '末列', labelEn: 'Last column', hintZh: '深链接到 WCA 该周筛选', hintEn: 'Deep-link to WCA weekly filter' },
  ],
  sourceZh: [
    '只读 `competitions` 表 —— 已取消的(`cancelled_at IS NOT NULL`)和未公开的(`show_at_all = 0`)排除。在 SQL 里直接用 `DATE_ADD(start_date, INTERVAL(-WEEKDAY(start_date)) DAY)` 推回当周周一,再 `+6` 拿周日。',
  ],
  sourceEn: [
    'Reads only `competitions`, excluding cancelled (`cancelled_at IS NOT NULL`) and hidden (`show_at_all = 0`) entries. SQL derives Monday with `DATE_ADD(start_date, INTERVAL(-WEEKDAY(start_date)) DAY)` and Sunday with `+6`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  COUNT(*) competitions_count,
  DATE_ADD(start_date, INTERVAL(-WEEKDAY(start_date)) DAY) week_start_date,
  DATE_ADD(start_date, INTERVAL(6 - WEEKDAY(start_date)) DAY) week_end_date,
  CONCAT('[List](https://www.worldcubeassociation.org/competitions',
         '?state=custom&from_date=', MIN(start_date),
         '&to_date=', MAX(end_date), ')') list_link
FROM competitions
WHERE show_at_all = 1 AND cancelled_at IS NULL
GROUP BY week_start_date, week_end_date
ORDER BY competitions_count DESC, week_start_date DESC;`,
  },
  steps: [
    {
      titleZh: '过滤可见 + 未取消',
      titleEn: 'Filter visible and non-cancelled',
      bodyZh: '`show_at_all = 1 AND cancelled_at IS NULL` —— 草稿、测试赛、取消赛都排除。',
      bodyEn: '`show_at_all = 1 AND cancelled_at IS NULL` — drafts, tests, and cancellations excluded.',
    },
    {
      titleZh: '回推所在周',
      titleEn: 'Snap to enclosing week',
      bodyZh: '`WEEKDAY()` 返回 0..6(周一..周日)。减它得周一、加 `6-` 得周日,把 `start_date` 精确锁到一周。',
      bodyEn: '`WEEKDAY()` returns 0..6 (Mon..Sun). Subtracting it lands on Monday; `6 - WEEKDAY` lands on Sunday — pinning `start_date` to its containing ISO week.',
    },
    {
      titleZh: '按周分组计数',
      titleEn: 'Group and count per week',
      bodyZh: '`GROUP BY week_start_date, week_end_date`,`COUNT(*)` 就是该周比赛数。',
      bodyEn: '`GROUP BY week_start_date, week_end_date` then `COUNT(*)` gives comps in that week.',
    },
    {
      titleZh: '拼 WCA 列表深链接',
      titleEn: 'Build WCA deep-link',
      bodyZh: '用 `MIN(start_date)` / `MAX(end_date)` 拼 `state=custom&from_date=...&to_date=...`,点 "List" 直接跳 WCA 该周筛选页。',
      bodyEn: 'Use `MIN(start_date)` / `MAX(end_date)` to build `state=custom&from_date=...&to_date=...` — the "List" link jumps to that week filtered on the WCA site.',
    },
    {
      titleZh: '降序输出 + 日期格式化',
      titleEn: 'Sort DESC and format dates',
      bodyZh: '主键 `competitions_count DESC`,同票数按周降序;前端把 `Date` 渲染成 `5 Jan 2025`(无前导零,英文月缩写)。',
      bodyEn: 'Primary key `competitions_count DESC`, ties broken by week DESC. The renderer formats dates as `5 Jan 2025` (no leading zero, abbreviated month).',
      highlight: true,
    },
  ],
  edgesZh: [
    '一场跨周的多日赛只按 `start_date` 归一周 —— 周一开始周二结束的不会被分到两周。',
    '过滤了 `cancelled_at IS NOT NULL`,2020 疫情期间的取消高峰不会冒出来。',
    '"List" 列的 WCA URL 参数 `state=custom` 不会跟未来未公开比赛混在一起。',
  ],
  edgesEn: [
    'Multi-day comps that cross a week boundary stick to the week of `start_date` — a Mon-start, Tue-end comp is not split across two weeks.',
    'Cancelled comps (`cancelled_at IS NOT NULL`) are filtered, so 2020-era cancellation spikes don\'t surface here.',
    'The "List" URL uses `state=custom`, which does not pull in future hidden comps.',
  ],
  related: [
    { id: 'most_attended_competitions_in_single_week', titleZh: '一周参赛最多的选手', titleEn: 'Most competitions in single week', hintZh: '同时间窗的选手维度', hintEn: 'Same time window, per-person view' },
    { id: 'most_attended_competitions_in_single_month', titleZh: '一月参赛最多的选手', titleEn: 'Most competitions in single month', hintZh: '放宽到月窗口', hintEn: 'Same idea, monthly window' },
    { id: 'competition_days_count_by_region', titleZh: '按区域比赛天数', titleEn: 'Competition days by region', hintZh: '同一份赛事数据按地区分', hintEn: 'Same comp data sliced by region' },
    { id: 'competitions_count_by_week', toStat: true, titleZh: '查看实时榜单', titleEn: 'Jump to live data', hintZh: '逐周完整列表', hintEn: 'Full week-by-week list' },
  ],
};

// ──── competitions_per_year_by_country ──────────────────────────────────────
const competitions_per_year_by_country: AboutEntry = {
  id: 'competitions_per_year_by_country',
  titleZh: '每年每国比赛数',
  titleEn: 'Competitions per year by country',
  badgeZh: '赛事',
  badgeEn: 'Competition',
  introZh: [
    '把一国的总比赛场次 ÷ 该国首场比赛至今的年数,得到"该国年均办赛数"。年数 < 1 的国家(刚加入 WCA 不足 1 年)被剔除,避免分母过小爆栏。',
    '注意:分母是**自己**第一场比赛起算的年数,不是 WCA 历史总年数 —— 这样新生赛区不会因为"WCA 已经办了 20 年而我才办 3 年"而被压低。',
  ],
  introEn: [
    'Total comps in a country ÷ years since its very first comp. Countries with under 1 year of history are excluded to keep the denominator sane.',
    'The denominator counts from **that country\'s** first comp, not from WCA\'s overall start — so a freshly active region is not penalized by the global 20+ year history.',
  ],
  stats: [
    { value: 'years ≥ 1', labelZh: '门槛', labelEn: 'Threshold', hintZh: '首场满 1 年才上榜', hintEn: 'First comp ≥ 1 year ago' },
    { value: '/ 365.25', labelZh: '年长度', labelEn: 'Year length', hintZh: '含闰年平均', hintEn: 'Average incl. leap years' },
    { value: 'CURDATE()', labelZh: '终点', labelEn: 'End date', hintZh: '取数据 dump 当天', hintEn: 'Date of dump load' },
    { value: '2 位小数', labelZh: '精度', labelEn: 'Precision', hintZh: 'comps/year + years', hintEn: 'comps/year + years' },
  ],
  sourceZh: [
    '内层:`results` JOIN `competitions`,按 `competition.country_id` 分组。`COUNT(DISTINCT competition_id)` 算该国比赛数,`DATEDIFF(CURDATE(), MIN(start_date)) / 365.25` 算"从首场到今天"的年数。`HAVING years >= 1` 滤掉新国。',
    '外层:除一下得到 `competitions_per_year`,JOIN `countries` 取国名,按比例降序输出。',
  ],
  sourceEn: [
    'Inner: `results` JOIN `competitions`, group by `competition.country_id`. `COUNT(DISTINCT competition_id)` for comp count, `DATEDIFF(CURDATE(), MIN(start_date)) / 365.25` for years since first comp. `HAVING years >= 1` filters fresh regions.',
    'Outer: divide for `competitions_per_year`, JOIN `countries` for the display name, sort DESC by rate.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  competitions / years competitions_per_year,
  competitions, years, country.name country
FROM (
  SELECT
    COUNT(DISTINCT competition_id) competitions,
    (DATEDIFF(CURDATE(), MIN(start_date)) / 365.25) years,
    competition.country_id
  FROM results result
  JOIN competitions competition ON competition.id = competition_id
  GROUP BY competition.country_id
  HAVING years >= 1
) AS data_by_country
JOIN countries country ON country.id = country_id
ORDER BY competitions_per_year DESC;`,
  },
  formulae: [
    {
      labelZh: '公式',
      labelEn: 'Formula',
      expr: 'rate(country) = competitions(country) / years_since_first(country)',
      bodyZh: '`years_since_first = (today - first_comp_date) / 365.25`,不足 1 年的国家剔除。',
      bodyEn: '`years_since_first = (today - first_comp_date) / 365.25`. Countries under 1 year are dropped.',
    },
  ],
  steps: [
    {
      titleZh: '收集每国比赛集合',
      titleEn: 'Collect per-country comp set',
      bodyZh: '从 `results` 起,只为了拿到"真实办过的比赛"(竞赛日历里挂了但 0 人出赛的不算)。JOIN `competitions` 拿到 `country_id` 和 `start_date`。',
      bodyEn: 'Starting from `results` (not `competitions` directly) ensures only comps that actually ran are counted. JOIN `competitions` for `country_id` and `start_date`.',
    },
    {
      titleZh: '数比赛 + 找首场',
      titleEn: 'Count comps and find first date',
      bodyZh: '组内 `COUNT(DISTINCT competition_id)`(同一比赛多轮多人不重复),`MIN(start_date)` 得首场日期。',
      bodyEn: '`COUNT(DISTINCT competition_id)` per group (multi-round, multi-person rows collapse), `MIN(start_date)` for the first comp date.',
    },
    {
      titleZh: '算"自首场以来"年数',
      titleEn: 'Compute years since first comp',
      bodyZh: '`years = DATEDIFF(CURDATE(), MIN(start_date)) / 365.25`。除以 365.25 而非 365 是为了平摊闰年。',
      bodyEn: '`years = DATEDIFF(CURDATE(), MIN(start_date)) / 365.25`. Dividing by 365.25 (not 365) amortizes leap years.',
    },
    {
      titleZh: '过滤新国',
      titleEn: 'Drop fresh regions',
      bodyZh: '`HAVING years >= 1` —— 否则一个 6 个月前刚开第一场的国家会算出 "12 场/年" 这种伪信号。',
      bodyEn: '`HAVING years >= 1` — otherwise a country whose first comp was 6 months ago could read as "12 comps/year", a false signal.',
    },
    {
      titleZh: '相除并降序',
      titleEn: 'Divide and sort DESC',
      bodyZh: '外层 `competitions / years`,JOIN `countries` 拿可读国名,`ORDER BY competitions_per_year DESC`。',
      bodyEn: 'Outer divides the two, JOIN `countries` for display name, `ORDER BY competitions_per_year DESC`.',
      highlight: true,
    },
  ],
  edgesZh: [
    '从 `results` 起 join 比从 `competitions` 起 join 严:挂在日历但 0 人出赛的"幽灵比赛"不会算进 `competitions` 计数。',
    '`years` 是连续小数(不是整数),所以 "2.37 年办 18 场" 算出来是 7.59/年。',
    '`CURDATE()` 是 SQL 引擎当下的时间,每次重跑 dump 都会前进 —— 国家排名会有微弱的"自然衰减",新一年没办赛比例会下降。',
  ],
  edgesEn: [
    'Joining from `results` (not from `competitions`) is stricter — "ghost" comps listed but with zero competitors don\'t inflate the count.',
    '`years` is fractional (not integer), so "18 comps in 2.37 years" yields 7.59/year.',
    '`CURDATE()` advances with each dump rebuild, giving rates a slight natural decay if a country sits idle for a year.',
  ],
  related: [
    { id: 'competition_days_count_by_region', titleZh: '按区域比赛天数', titleEn: 'Competition days by region', hintZh: '另一种"地区赛事密度"', hintEn: 'Alt region-density slice' },
    { id: 'competitions_count_by_week', titleZh: '每周比赛数量', titleEn: 'Competitions per week', hintZh: '时间维度的对照', hintEn: 'Time-axis counterpart' },
    { id: 'average_event_count_by_competition', titleZh: '每场比赛平均项目数', titleEn: 'Avg events per comp', hintZh: '"广度"维度,与"密度"配套看', hintEn: 'Breadth dimension, complements density' },
    { id: 'competitions_per_year_by_country', toStat: true, titleZh: '查看实时榜单', titleEn: 'Jump to live data', hintZh: '按国家完整排序', hintEn: 'Full country ranking' },
  ],
};

// ──── dnf_rate_by_event ─────────────────────────────────────────────────────
const dnf_rate_by_event: AboutEntry = {
  id: 'dnf_rate_by_event',
  titleZh: '各项目 DNF 率',
  titleEn: 'DNF rate by event',
  badgeZh: '项目',
  badgeEn: 'Event',
  introZh: [
    '每个项目的 DNF(Did Not Finish)次数除以**实际尝试次数**,得到该项目的 DNF 率。这里 attempts 排除掉两类不算手:`value = 0`(未提交占位)和 `value = -2`(DNS,根本没上)。',
    'BLD / FMC / MBLD 这些"高难项目"DNF 率显著高于 3x3:盲拧靠记忆完整度,FMC 有 1 小时时限和步数上限,MBLD 一份成绩里有任一立方体失败就整轮 DNF。',
  ],
  introEn: [
    'For each event, DNF count ÷ **actual attempts**. Attempts excludes two flavors of non-solve: `value = 0` (placeholder for not-submitted) and `value = -2` (DNS — no-show).',
    'BLD / FMC / MBLD sit well above 3x3: blindfolded depends on full memorization, FMC has a 1-hour cap with move limits, MBLD DNFs the whole attempt if any cube fails.',
  ],
  stats: [
    { value: 'value=-1', labelZh: 'DNF 编码', labelEn: 'DNF encoding', hintZh: 'result_attempts.value', hintEn: 'In result_attempts.value' },
    { value: 'value=-2', labelZh: 'DNS 编码', labelEn: 'DNS encoding', hintZh: '排除在分母外', hintEn: 'Excluded from denominator' },
    { value: 'value=0', labelZh: '空槽', labelEn: 'Empty slot', hintZh: '一轮 5 attempts 未填满', hintEn: '5-attempts round not filled' },
    { value: '%', labelZh: '展示', labelEn: 'Display', hintZh: '2 位小数百分比', hintEn: '2-decimal percentage' },
  ],
  sourceZh: [
    '走 `results` JOIN `result_attempts` —— 后者一行 = 一次单尝试(WCA dump 的细粒度表)。按 `event_id` 分组,SUM 出 dnfs(`value = -1`)与 attempts(`value NOT IN (-2, 0)`),前端 TS 端再算比例并按降序排。',
  ],
  sourceEn: [
    'JOIN `results` to `result_attempts` (one row = one solve attempt — the fine-grained WCA dump table). Group by `event_id`, SUM the DNFs (`value = -1`) and attempts (`value NOT IN (-2, 0)`); TS side then computes the ratio and sorts DESC.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  r.event_id,
  SUM(CASE WHEN ra.value = -1 THEN 1 ELSE 0 END) dnfs,
  SUM(CASE WHEN ra.value NOT IN (-2, 0) THEN 1 ELSE 0 END) attempts
FROM results r
JOIN result_attempts ra ON ra.result_id = r.id
GROUP BY r.event_id;`,
  },
  formulae: [
    {
      labelZh: 'DNF 率',
      labelEn: 'DNF rate',
      expr: 'dnf_rate = dnf_count / attempted',
      bodyZh: '`dnf_count = COUNT(value = -1)`;`attempted = COUNT(value ≠ -2 且 ≠ 0)` —— 排除 DNS 和未填槽。展示时乘 100 加 `%`。',
      bodyEn: '`dnf_count = COUNT(value = -1)`; `attempted = COUNT(value ≠ -2 and ≠ 0)` — excludes DNS and empty slots. Multiplied by 100 with `%` for display.',
    },
  ],
  steps: [
    {
      titleZh: '展开单 attempt 维度',
      titleEn: 'Expand to per-attempt rows',
      bodyZh: '`results` 一行是一轮成绩(含 best/average),真实的 5 个单尝试要去 `result_attempts` 里看 —— JOIN 后行数 ≈ 5× results。',
      bodyEn: '`results` is one row per round (with best/average); the individual 5 attempts live in `result_attempts`. JOIN multiplies row count by ~5.',
    },
    {
      titleZh: '辨认三种值',
      titleEn: 'Recognize three value types',
      bodyZh: '`value > 0` 真成绩(厘秒/步数/移动数等编码),`= -1` DNF,`= -2` DNS(未上),`= 0` 一轮 5 个 attempt 没填满的空槽。',
      bodyEn: '`value > 0` real result (centisecond / move / FMC encoding); `= -1` DNF; `= -2` DNS (no-show); `= 0` empty slot when a 5-attempt round wasn\'t fully filled.',
    },
    {
      titleZh: 'SUM 出两个数',
      titleEn: 'SUM out two numbers',
      bodyZh: '`SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END)` = DNF 数;`SUM(CASE WHEN value NOT IN (-2, 0) THEN 1 ELSE 0 END)` = 实尝试数(含 DNF)。',
      bodyEn: '`SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END)` = DNF count; `SUM(CASE WHEN value NOT IN (-2, 0) THEN 1 ELSE 0 END)` = real attempts (including DNFs).',
    },
    {
      titleZh: '按项目分组',
      titleEn: 'Group by event',
      bodyZh: '`GROUP BY r.event_id`,每个 WCA 项目一行。',
      bodyEn: '`GROUP BY r.event_id` — one row per WCA event.',
    },
    {
      titleZh: '前端算比例并排序',
      titleEn: 'Compute and sort in TS',
      bodyZh: 'TS 端 `100 * dnfs / attempts`,`toFixed(2) + " %"`;按 DNF 率降序,`EVENTS[id]` 映射成项目中文名。',
      bodyEn: 'TS computes `100 * dnfs / attempts`, formats as `toFixed(2) + " %"`, sorts DESC by rate, and maps `event_id` through `EVENTS[id]` for display.',
      highlight: true,
    },
  ],
  edgesZh: [
    '分母**不含** DNS(`-2`)和空槽(`0`)—— 真没上 / 没填的不算"尝试"。改了分母口径会让所有数都偏低。',
    '一轮记录 = 至多 5 个 attempt,但很多项目只有 1-3 attempt(BLD / FMC 等)。聚合时单 attempt 是原子,不是单轮。',
    'MBLD 项目的 attempt 是"复合 attempt"(一组 cube),DNF 由整体判定;比例不是"每立方体 DNF 率"。',
  ],
  edgesEn: [
    'Denominator **excludes** DNS (`-2`) and empty slots (`0`) — those are not real "attempts". Changing the denominator would shift every event down.',
    'A round can hold up to 5 attempts but many events use only 1-3 (BLD / FMC etc.). Aggregation is per-attempt, not per-round.',
    'MBLD attempts are compound (one bundle of cubes) — DNF is judged at the bundle level. The rate is not "per-cube DNF rate".',
  ],
  related: [
    { id: 'most_completed_solves', titleZh: '最多完成单次数', titleEn: 'Most completed solves', hintZh: '"实尝试 - DNF"的全选手榜', hintEn: 'Successful attempts leaderboard' },
    { id: 'most_solves_before_bld_success', titleZh: 'BLD 首次成功前的尝试', titleEn: 'Solves before BLD success', hintZh: 'DNF 集中的盲拧角度', hintEn: 'BLD-focused take on DNF density' },
    { id: 'mbf_average', titleZh: 'MBF 平均', titleEn: 'MBF average', hintZh: 'MBLD 完成度细项', hintEn: 'MBLD attempt-completeness companion' },
    { id: 'dnf_rate_by_event', toStat: true, titleZh: '查看实时榜单', titleEn: 'Jump to live data', hintZh: '21 个项目排序', hintEn: 'All 21 events ranked' },
  ],
};

// ──── fewest_competitors_contest ────────────────────────────────────────────
const fewest_competitors_contest: AboutEntry = {
  id: 'fewest_competitors_contest',
  titleZh: '参赛人数最少的比赛',
  titleEn: 'Fewest competitors contest',
  badgeZh: '赛事',
  badgeEn: 'Competition',
  introZh: [
    '一场比赛里有几位**实际出赛**的选手?把 `results` 表按 `competition_id` 分组,数 distinct `person_id`。只保留 ≤ 15 人的小型比赛,升序排,榜首往往是邀请赛、首场地区赛或线上特别赛。',
    '"出赛"只看 `results` 里有没有那个人的记录 —— 报了名但没去现场 / 全 DNS 的不计入。',
  ],
  introEn: [
    'How many people actually **competed** at a comp? Group `results` by `competition_id` and count distinct `person_id`. Keep only comps with ≤ 15 competitors, sort ascending — the top tends to be invitationals, first-ever regional comps, or special online events.',
    '"Competed" means a row exists in `results` — registered-but-DNS no-shows are not counted.',
  ],
  stats: [
    { value: '≤ 15', labelZh: '门槛', labelEn: 'Threshold', hintZh: '只看小型比赛', hintEn: 'Small comps only' },
    { value: 'DISTINCT', labelZh: '计数', labelEn: 'Counting', hintZh: 'person_id 去重', hintEn: 'On person_id' },
    { value: '升序', labelZh: '排序', labelEn: 'Sort', hintZh: '人最少在最上', hintEn: 'Fewest at top' },
    { value: '2 列', labelZh: '表头', labelEn: 'Columns', hintZh: '人数 + 比赛链接', hintEn: 'Count + comp link' },
  ],
  sourceZh: [
    '一条只读 SQL:内层 `GROUP BY competition_id` 数 distinct 出赛人;`HAVING competitors_count <= 15` 卡门槛;外层 JOIN `competitions` 拿到 `cell_name` 拼 WCA 比赛链接。',
  ],
  sourceEn: [
    'Single read-only SQL: inner `GROUP BY competition_id` counts distinct competitors; `HAVING competitors_count <= 15` applies the cutoff; outer JOIN `competitions` builds the WCA link from `cell_name`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  competitors_count,
  competition.cell_name
FROM (
  SELECT
    COUNT(DISTINCT person_id) competitors_count,
    competition_id
  FROM results
  GROUP BY competition_id
  HAVING competitors_count <= 15
) AS competitors_count_by_competition
JOIN competitions competition ON competition.id = competition_id
ORDER BY competitors_count;`,
  },
  steps: [
    {
      titleZh: '基于真实出赛',
      titleEn: 'Start from actual results',
      bodyZh: '从 `results` 起(而不是 `registrations`/`competitions`),没出赛的天然不算。',
      bodyEn: 'Start from `results` (not `registrations` or `competitions`) — anyone who didn\'t show up is naturally excluded.',
    },
    {
      titleZh: '去重计数',
      titleEn: 'Count distinct',
      bodyZh: '`COUNT(DISTINCT person_id)` —— 同一人多项目多轮仍只算一次。',
      bodyEn: '`COUNT(DISTINCT person_id)` — multi-event multi-round rows from the same person collapse to one.',
    },
    {
      titleZh: '过滤"小型"',
      titleEn: 'Filter to "small"',
      bodyZh: '`HAVING competitors_count <= 15` —— 完整 dump 上 LIMIT 没意义,15 是约定的"小赛"上界。',
      bodyEn: '`HAVING competitors_count <= 15` — a LIMIT on a full dump is meaningless; 15 is the conventional "small comp" upper bound.',
    },
    {
      titleZh: '挂比赛链接',
      titleEn: 'Attach comp link',
      bodyZh: '外层 JOIN `competitions`,拼 markdown `[name](.../competitions/<id>)`,前端渲染成可点链接。',
      bodyEn: 'Outer JOIN `competitions`, build a markdown `[name](.../competitions/<id>)`. The renderer turns this into a clickable link.',
    },
    {
      titleZh: '升序输出',
      titleEn: 'Sort ascending',
      bodyZh: '`ORDER BY competitors_count` —— 同票数无打破,前端按 SQL 顺序保留。',
      bodyEn: '`ORDER BY competitors_count` — ties keep SQL\'s natural order in the UI.',
      highlight: true,
    },
  ],
  edgesZh: [
    '"出赛 = 有 `results` 行" —— 该选手可能整轮 DNS(SQL 里 `value > 0` 都没有),只要 `result_attempts` 里挂了行就算。',
    '`HAVING competitors_count <= 15` 写死,要看更大规模需自己改 SQL —— 这是个"小赛"专题榜。',
    '历史上单人比赛极少,通常是疫情期间允许的 1 人或 2 人特殊场。',
  ],
  edgesEn: [
    '"Competed" means a `results` row exists — even a fully DNS\'d round still ties a row to the person. Empty-`results` comps would not count anyone.',
    'The `<= 15` cutoff is hardcoded — this is intentionally a "small comp" leaderboard. Larger thresholds need a SQL edit.',
    'Single-person comps are very rare historically — usually pandemic-era 1- or 2-person specials.',
  ],
  related: [
    { id: 'average_event_count_by_competition', titleZh: '每场比赛平均项目数', titleEn: 'Avg events per comp', hintZh: '小赛常项目多人少', hintEn: 'Small comps trend high here' },
    { id: 'competition_days_count_by_region', titleZh: '按区域比赛天数', titleEn: 'Comp days by region', hintZh: '小赛通常 1 天完结', hintEn: 'Small comps usually wrap in a day' },
    { id: 'most_records_at_single_competition', titleZh: '单场比赛最多纪录', titleEn: 'Most records at one comp', hintZh: '与"人少"对照的"密度高"', hintEn: 'Opposite-end density companion' },
    { id: 'fewest_competitors_contest', toStat: true, titleZh: '查看实时榜单', titleEn: 'Jump to live data', hintZh: '完整小赛列表', hintEn: 'Full small-comp list' },
  ],
};

// ──── most_records_at_single_competition ────────────────────────────────────
const most_records_at_single_competition: AboutEntry = {
  id: 'most_records_at_single_competition',
  titleZh: '单场比赛最多纪录',
  titleEn: 'Most records at a single competition',
  badgeZh: '赛事',
  badgeEn: 'Competition',
  introZh: [
    '一场比赛里,某位选手刷了几个区域纪录?WCA `results` 表两个字段 `regional_single_record` / `regional_average_record` 标记该轮的 single / average 是否破了 NR/CR/WR 中的某一级。把同一人同一场内的所有标记数一遍就是该人在该场的"破纪录数"。',
    '分 World / Continental / National 三档:World 只算 `WR`;Continental 把所有 CR(含 WR 因为 WR 必同时 ≥ CR)算进去;National 再加 `NR`。每档 top 20(含并列)。',
  ],
  introEn: [
    'How many regional records did one person set at a single comp? WCA `results` carries two flags — `regional_single_record` and `regional_average_record` — marking whether that round\'s single/average broke an NR/CR/WR. Sum the flags for each (person, comp) pair to get their record count at that comp.',
    'Three tiers — World / Continental / National. World counts only `WR`; Continental counts all CRs (WR auto-qualifies since WR ≥ CR); National adds `NR` on top. Top 20 per tier with ties.',
  ],
  stats: [
    { value: '3 档', labelZh: '层级', labelEn: 'Tiers', hintZh: 'World / Continental / National', hintEn: 'World / Continental / National' },
    { value: '2 字段', labelZh: '记录列', labelEn: 'Record columns', hintZh: 'single + average 各 1 个', hintEn: 'single + average flags' },
    { value: 'top 20', labelZh: '每档', labelEn: 'Per tier', hintZh: '含并列', hintEn: 'Ties included' },
    { value: 'sub_id=1', labelZh: '过滤', labelEn: 'Filter', hintZh: '只主身份', hintEn: 'Primary identity only' },
  ],
  sourceZh: [
    '只读 `results` JOIN `persons (sub_id = 1)` JOIN `competitions` 三张表。`WHERE` 卡 `regional_single_record` 或 `regional_average_record` 非空,把所有"该轮破了某级纪录"的行抽出来 —— 后续在 TS 端按 (人, 比赛) 分组并按层级累加。',
  ],
  sourceEn: [
    'Read-only JOIN across `results`, `persons (sub_id = 1)`, and `competitions`. `WHERE` keeps rows where either `regional_single_record` or `regional_average_record` is non-empty — TS side then groups by (person, comp) and tallies per tier.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  regional_single_record,
  regional_average_record,
  person.name, person.wca_id,
  competition.cell_name, competition.id
FROM results
JOIN persons person
  ON person.wca_id = person_id
 AND person.sub_id = 1
JOIN competitions competition
  ON competition.id = competition_id
WHERE (regional_single_record IS NOT NULL AND regional_single_record != '')
   OR (regional_average_record IS NOT NULL AND regional_average_record != '');`,
  },
  steps: [
    {
      titleZh: '只抽"刷新"行',
      titleEn: 'Pull only "record-setting" rows',
      bodyZh: 'WHERE 至少一个 record 字段非空 —— `regional_*_record` 是 `WR / CR / NR` 中的代码(空串 = 没破)。',
      bodyEn: 'WHERE at least one record flag is non-empty — `regional_*_record` holds `WR / CR / NR` code (empty string = none).',
    },
    {
      titleZh: '过滤副身份',
      titleEn: 'Filter to primary identity',
      bodyZh: '`persons.sub_id = 1` —— 改名/换国籍的选手 dump 里有多行,只保留主行,避免重复计数。',
      bodyEn: '`persons.sub_id = 1` — the dump holds multiple rows for rename/country-change cases; keep only the primary to avoid double counts.',
    },
    {
      titleZh: '前端定义三档代码集',
      titleEn: 'Define three tier code-sets',
      bodyZh: 'TypeScript 端的 `levels`:`World = ["WR"]`;`Continental = ["AfR","AsR","NAR","SAR","ER","OcR","WR"]`;`National = ["NR","AfR",...,"WR"]`(因为 WR 总是同时 ≥ CR ≥ NR)。',
      bodyEn: 'TS `levels` map: `World = ["WR"]`; `Continental = ["AfR","AsR","NAR","SAR","ER","OcR","WR"]`; `National = ["NR","AfR",...,"WR"]` (since WR is automatically also CR and NR).',
    },
    {
      titleZh: '按 (人, 比赛) 累加',
      titleEn: 'Tally per (person, comp)',
      bodyZh: '组键 `person_link|||results_link`,组内对 single 和 average 各检查一次:若该字段值落在当前档的代码集里,`count += 1`。',
      bodyEn: 'Group key `person_link|||results_link`. Within a group, check both `single` and `average` against the tier\'s code-set — `count += 1` for each hit.',
    },
    {
      titleZh: '排序并取 top 20(含并列)',
      titleEn: 'Sort and take top 20 with ties',
      bodyZh: '按 `count DESC`;`takeTopNWithTies` 取 20,边界并列全部一起留下(避免"第 20 名打平却被剪掉"的不公)。',
      bodyEn: 'Sort by `count DESC`; `takeTopNWithTies` keeps the top 20 plus any ties at the cutoff (avoids "tied at #20 but cut off" unfairness).',
      highlight: true,
    },
  ],
  edgesZh: [
    'WR 行同时也是 CR、也是 NR —— 三档的代码集层层包含,确保高档纪录在所有低档里都计入。',
    '一行可能 single 和 average **都**破了纪录,记为 2 个纪录(不是 1)。',
    '`sub_id = 1` 过滤副身份后,某位曾改名的选手的所有比赛仍归到主名下,不会被切碎。',
    '只看 `regional_*_record` 标记,不二次校验数值 —— 若 WCA 后续 retroactive 撤销某条纪录,统计会随 dump 更新跟随。',
  ],
  edgesEn: [
    'A WR row is automatically also a CR and an NR — the three tier code-sets nest, so higher-tier records always count in the lower-tier boards.',
    'A single row can break **both** single and average records — that counts as 2, not 1.',
    'After `sub_id = 1` filtering, a competitor who later renamed is still aggregated under one identity, not split.',
    'Reads only the `regional_*_record` flags — no numeric re-verification. If WCA retroactively voids a record, the next dump rebuild reflects it.',
  ],
  related: [
    { id: 'longest_streak_of_world_records', titleZh: '连续比赛刷 WR', titleEn: 'Longest streak of WRs', hintZh: '跨比赛的"连续刷新"', hintEn: 'Cross-comp consecutive WRs' },
    { id: 'records_in_most_events', titleZh: '在最多项目上有纪录', titleEn: 'Records in most events', hintZh: '项目覆盖维度', hintEn: 'Event-coverage take' },
    { id: 'most_podiums_at_single_competition', titleZh: '单场最多领奖台', titleEn: 'Most podiums at one comp', hintZh: '同"单场密度"另一种切', hintEn: 'Sibling single-comp density stat' },
    { id: 'most_records_at_single_competition', toStat: true, titleZh: '查看实时榜单', titleEn: 'Jump to live data', hintZh: '三档完整 top 20', hintEn: 'Full top-20 per tier' },
  ],
};

export const COMP_STATS_ABOUT: Record<string, AboutEntry> = {
  average_event_count_by_competition,
  competition_days_count_by_region,
  competitions_count_by_week,
  competitions_per_year_by_country,
  dnf_rate_by_event,
  fewest_competitors_contest,
  most_records_at_single_competition,
};
