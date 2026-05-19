// 成绩与纪录 — about entries
import type { AboutEntry } from '../types';

// ──── best_potential_fmc_mean ───────────────────────────────────────────────
const best_potential_fmc_mean: AboutEntry = {
  id: 'best_potential_fmc_mean',
  titleZh: '最佳潜在 FMC 平均',
  titleEn: 'Best potential FMC mean',
  badgeZh: '潜在最佳',
  badgeEn: 'Potential',
  introZh: [
    '`333fm` 的 mean of 3 = 三次手写解步数取算术平均。这个统计反过来问:在某一**轮**(competition × round)里,如果一个人把他/她那一轮的**每个 attempt slot 都换成全场最好的那一发**,平均能压到多少?',
    '换句话说,把同一轮所有选手的 attempt 1 全收齐取最小,attempt 2 同样,attempt 3 同样,(min1 + min2 + min3) / 3 就是"这一轮在理论上达成过的最佳 FMC 平均"。它衡量的是**轮次本身的难度系数** —— 打乱好不好打,而不是某个选手。',
  ],
  introEn: [
    '`333fm` mean-of-3 is just the arithmetic mean of three hand-written move counts. This stat flips the question: for one **round** (competition × round), if you took **the best attempt-1 from anyone in that round, the best attempt-2 from anyone, and the best attempt-3 from anyone**, what would the resulting mean be?',
    'Concretely: aggregate attempt 1 across all competitors in the round to its `MIN`, same for attempts 2 and 3, then `(min1 + min2 + min3) / 3`. It is a measure of **how easy the scrambles were**, not how good any one solver is.',
  ],
  stats: [
    { value: 'mean-of-3', labelZh: '聚合口径', labelEn: 'Aggregation', hintZh: '三个 attempt 各取全场最小再求均值', hintEn: 'Per-attempt minimum across the round, then averaged' },
    { value: '`333fm`', labelZh: '仅此项目', labelEn: 'Only event', hintZh: 'Fewest Moves 是 WCA 里唯一手写步数的项目', hintEn: 'FMC is the only hand-written move-count event in WCA' },
    { value: '100', labelZh: '榜单深度', labelEn: 'Rows returned', hintZh: '按 mean 升序取前 100 个 round', hintEn: 'Top 100 rounds by mean ascending' },
    { value: '整数', labelZh: '步数为整数', labelEn: 'Integer values', hintZh: 'WCA dump 里 `333fm` 步数直接存,不像计时项 ×100', hintEn: 'FMC values stored as integer moves, no ×100 like timed events' },
  ],
  sourceZh: [
    '`results` + `result_attempts` 两表 join。先按 `(competition_id, round_type_id)` 分组,对每个 `attempt_number ∈ {1, 2, 3}` 单独取 `MIN(value)`(只算 `value > 0`,过滤 DNF/DNS/未提交);再把三个最小值相加除以 3。`333fm` 不需要乘 100 — dump 里这个项目存的就是步数本身。',
  ],
  sourceEn: [
    'Joins `results` and `result_attempts`. Groups by `(competition_id, round_type_id)`; per attempt slot (1, 2, 3) it takes `MIN(value)` filtered to `value > 0` (drops DNF/DNS/unattempted). Then `(min1 + min2 + min3) / 3`. `333fm` move counts are stored as integers — no ×100 like timed events.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT (best1 + best2 + best3) / 3 AS mean,
       best1, best2, best3, competition_id, round_type_id
FROM (
  SELECT
    MIN(CASE WHEN ra.attempt_number = 1 AND ra.value > 0 THEN ra.value END) best1,
    MIN(CASE WHEN ra.attempt_number = 2 AND ra.value > 0 THEN ra.value END) best2,
    MIN(CASE WHEN ra.attempt_number = 3 AND ra.value > 0 THEN ra.value END) best3,
    r.competition_id, r.round_type_id
  FROM results r
  JOIN result_attempts ra ON ra.result_id = r.id
  WHERE r.event_id = '333fm'
  GROUP BY r.competition_id, r.round_type_id
) t
WHERE LEAST(best1, best2, best3) IS NOT NULL
ORDER BY mean
LIMIT 100;`,
  },
  steps: [
    {
      titleZh: '按 (比赛, 轮次) 拆桶',
      titleEn: 'Bucket by (competition, round)',
      bodyZh: '`results` join `result_attempts`,只留 `event_id = 333fm`。把每一条 attempt 按 `(competition_id, round_type_id)` 装进对应的桶。',
      bodyEn: '`results` joined with `result_attempts`, filtered to `event_id = 333fm`. Each attempt row is dropped into the bucket keyed by `(competition_id, round_type_id)`.',
    },
    {
      titleZh: '逐 attempt slot 取全场最小',
      titleEn: 'Per-slot minimum',
      bodyZh: '在每个桶内,attempt 1、attempt 2、attempt 3 三个槽位各跑一次 `MIN(value WHERE value > 0)`。这一步 = "把全轮选手在 attempt i 上的最好成绩抽出来"。',
      bodyEn: 'Within each bucket, run `MIN(value WHERE value > 0)` three times — once per attempt slot. This pulls out "the best attempt-1 by anyone in this round", and same for slots 2 and 3.',
    },
    {
      titleZh: '过滤完整桶',
      titleEn: 'Keep only complete buckets',
      bodyZh: '`WHERE LEAST(best1, best2, best3) IS NOT NULL` — 必须三个 attempt 都有有效成绩,否则不算 mean。预赛 / DNF 一片的轮次会自动被剔掉。',
      bodyEn: '`WHERE LEAST(best1, best2, best3) IS NOT NULL` — all three slots must have at least one valid attempt. Rounds where some attempt slot is all-DNF / all-unattempted are dropped.',
    },
    {
      titleZh: '算潜在 mean 排前 100',
      titleEn: 'Compute potential mean, top 100',
      bodyZh: '`mean = (best1 + best2 + best3) / 3`,按 mean 升序 `LIMIT 100`。注意:这个 mean 完全可能没有任何**单个选手**真实拿到过 — 它是三人各贡献一槽的虚拟最佳。',
      bodyEn: '`mean = (best1 + best2 + best3) / 3`, ordered ascending, `LIMIT 100`. Note: no single solver may ever have posted this mean — it is a virtual best assembled from three different people, one per slot.',
      highlight: true,
    },
  ],
  formulae: [
    {
      labelZh: '公式',
      labelEn: 'Formula',
      expr: 'potentialMean(c, r) = (mₐ + m_b + m_c) / 3,  mₖ = min{vₖ(p) : p ∈ round(c, r), vₖ(p) > 0}',
      bodyZh: 'c = 比赛,r = 轮次,p = 选手,vₖ(p) = 选手 p 在 attempt slot k 上的步数。mₖ 是该 slot 在该轮的全场最小步数。',
      bodyEn: 'c = competition, r = round, p = competitor, vₖ(p) = solver p\'s move count on attempt slot k. mₖ is the per-slot minimum across the whole round.',
    },
  ],
  edgesZh: [
    '"潜在"是关键 — 三个 slot 的最佳可能来自三个不同的人,所以这条 mean 并不是任何选手本人达成过的成绩。',
    '只看 `value > 0`:DNF (-1)、DNS (-2)、未提交 (0) 全被剔。三个 slot 全 DNF 的轮次根本进不了榜。',
    'FMC 的 value 列存的就是整数步数,**没有** ×100 编码 — 不要去乘 100,会把所有 mean 放大成两位小数后离谱的数。',
    '`MIN` 而非 `MAX`:FMC 步数越**少**越好,跟 BLD points 编码恰好相反。',
  ],
  edgesEn: [
    '"Potential" is the key word — the three per-slot best results may come from three different people, so this mean is not necessarily one any individual ever achieved.',
    'Only `value > 0` counts: DNF (-1), DNS (-2), unattempted (0) are dropped. A round where some slot is entirely DNF cannot appear.',
    'For FMC the `value` column stores integer move counts directly — there is **no** ×100 encoding. Do not multiply by 100 or the displayed mean will be off by two orders of magnitude.',
    '`MIN`, not `MAX`: FMC is lower-is-better, unlike BLD points which are higher-is-better.',
  ],
  related: [
    { id: 'best_round', titleZh: '最佳轮次', titleEn: 'Best round', hintZh: '真实达成过的轮次 top-3 之和,可对照"潜在"差距', hintEn: 'Actually-achieved top-3 sum per round — contrast with "potential"' },
    { id: 'wr_metric', titleZh: '指标 (Metric)', titleEn: 'Metric', hintZh: '其它 mean / average / single 的 WR 视角', hintEn: 'Other mean / average / single WR perspectives' },
    { id: 'most_frequent_results', titleZh: '最常出现的成绩', titleEn: 'Most frequent results', hintZh: '同样用 `result_attempts` 拆 attempt slot', hintEn: 'Also unrolls per-attempt values via `result_attempts`' },
    { id: 'best_potential_fmc_mean', toStat: true, titleZh: '打开潜在 FMC mean 榜', titleEn: 'Jump to potential FMC mean board', hintZh: '看实际榜单', hintEn: 'Live leaderboard' },
  ],
};

// ──── best_round ────────────────────────────────────────────────────────────
const best_round: AboutEntry = {
  id: 'best_round',
  titleZh: '最佳轮次',
  titleEn: 'Best round',
  badgeZh: '轮次',
  badgeEn: 'Round',
  introZh: [
    '`best_round` 找的是**某一轮(competition × round_type)的 top 3 成绩之和**最小的那些轮 —— 一群选手挤在同一组 / 同一场决赛里同时打出顶级表现的"神级 round"。',
    'BLD 系列(333bf / 444bf / 555bf / 333mbf)用 single,其他项目用 average。`333mbf` 因为 WCA value 编码是越小越好但**业内排序**用 points 倒序,所以单独走一条 transform 路径。',
  ],
  introEn: [
    '`best_round` finds rounds (one row = one `competition × round_type`) with the smallest **sum of the top 3 results in that round** — these are the legendary rounds where a cluster of competitors all posted elite times back-to-back.',
    'BLD events (333bf / 444bf / 555bf / 333mbf) rank by single; all other events rank by average. `333mbf` gets a separate transform path because its WCA `value` encoding is lower-is-better but the natural ranking is by **points** descending.',
  ],
  stats: [
    { value: '21', labelZh: '项目', labelEn: 'Events', hintZh: '每个项目独立一节,top 10 轮', hintEn: 'One section per event, top 10 rounds each' },
    { value: 'top 3', labelZh: '取多少人', labelEn: 'Per round', hintZh: '`ROW_NUMBER ≤ 3` 取前三',  hintEn: '`ROW_NUMBER ≤ 3` keeps the top three' },
    { value: 'single / average', labelZh: '排序口径', labelEn: 'Rank field', hintZh: 'BLD 用 best;其他用 average', hintEn: 'BLD uses best; others use average' },
    { value: 'points DESC', labelZh: '`333mbf` 特例', labelEn: '`333mbf` special', hintZh: '另查一次,按 points 之和倒序', hintEn: 'Queried separately, sorted by points sum descending' },
  ],
  sourceZh: [
    '逐项目跑参数化 SQL(`event_id = \'%s\'`)。窗口函数 `ROW_NUMBER() OVER (PARTITION BY competition_id, round_type_id ORDER BY <best | average>)` 在每个 round 内给选手排号;`MAX(CASE WHEN row_num = k THEN ...)` 透视成"第 k 名"宽表,再把 1/2/3 名结果相加得到 `result_sum`,按 sum 升序 `LIMIT 10`。',
  ],
  sourceEn: [
    'Runs parameterized SQL per event (`event_id = \'%s\'`). A window function `ROW_NUMBER() OVER (PARTITION BY competition_id, round_type_id ORDER BY <best | average>)` numbers competitors inside each round; `MAX(CASE WHEN row_num = k THEN ...)` pivots into "kth-place" columns. The 1st/2nd/3rd results sum to `result_sum`, sorted ascending, `LIMIT 10`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT competition_id, round_type_id, event_id,
  MAX(CASE WHEN row_num = 1 THEN best_result END) first_result,
  MAX(CASE WHEN row_num = 2 THEN best_result END) second_result,
  MAX(CASE WHEN row_num = 3 THEN best_result END) third_result,
  first_result + second_result + third_result AS result_sum
FROM (
  SELECT competition_id, round_type_id, event_id, person_id,
    CASE WHEN event_id IN ('333bf','444bf','555bf','333mbf')
         THEN best ELSE average END AS best_result,
    ROW_NUMBER() OVER (
      PARTITION BY competition_id, round_type_id
      ORDER BY CASE WHEN event_id IN ('333bf','444bf','555bf','333mbf')
                    THEN best ELSE average END
    ) AS row_num
  FROM results
  WHERE event_id = '%s' AND best_result > 0
) ranked
GROUP BY competition_id, round_type_id
ORDER BY result_sum
LIMIT 10;`,
  },
  steps: [
    {
      titleZh: '挑排序字段',
      titleEn: 'Pick the rank field',
      bodyZh: 'BLD 三项 + multi-BLD 用 `best`(single 值越小越好);其它项目用 `average`(ao5 的官方均值)。在 `CASE` 表达式里一次解决,排序和"宽表透视"都用同一个表达式。',
      bodyEn: 'BLD trio + multi-BLD rank by `best` (single, lower is better); all other events rank by `average` (the official ao5 mean). A single `CASE` expression handles both the `ORDER BY` and the pivot column.',
    },
    {
      titleZh: '每 round 内排名',
      titleEn: 'Rank within each round',
      bodyZh: '`ROW_NUMBER() OVER (PARTITION BY competition_id, round_type_id ORDER BY <rank field>)` 给每条结果在所属 round 内分配 1, 2, 3, ... 的名次。只看正值(`best_result > 0`,排除 DNF/DNS/未提交)。',
      bodyEn: '`ROW_NUMBER() OVER (PARTITION BY competition_id, round_type_id ORDER BY <rank field>)` numbers each row within its round (1, 2, 3, ...). Only positive values are considered (`best_result > 0`, dropping DNF/DNS/unattempted).',
    },
    {
      titleZh: '透视成宽表',
      titleEn: 'Pivot to wide table',
      bodyZh: '`MAX(CASE WHEN row_num = 1 THEN person_id END) first_id` 等等 — 把 long 表压成每 round 一行、第 1/2/3 名各自占三列。`third_result IS NOT NULL` 过滤掉不足三人完赛的轮次。',
      bodyEn: '`MAX(CASE WHEN row_num = 1 THEN person_id END) first_id` etc. — collapses the long table to one row per round with three columns each for the top three solvers. `third_result IS NOT NULL` drops rounds where fewer than three completed.',
    },
    {
      titleZh: '加和取前 10',
      titleEn: 'Sum, sort, top 10',
      bodyZh: '`result_sum = first + second + third`,按和升序 `LIMIT 10`,每个项目独立一节。',
      bodyEn: '`result_sum = first + second + third`, ordered ascending, `LIMIT 10`, one section per event.',
    },
    {
      titleZh: '`333mbf` 单独一条 transform',
      titleEn: '`333mbf` separate transform path',
      bodyZh: 'Multi-BLD 的 `value` 编码越小越好(攻击数 / 时间 / 解出数全塞一个数),但人眼习惯按 **points** 倒序(尝试 N 个、解出 M 个、错 N−M)。`queryResults` 跳过 `333mbf`,`toJson` 单独查 + 按 `points` 之和倒序排,再合并回去。',
      bodyEn: 'Multi-BLD `value` is encoded lower-is-better (a single packed number for attempted / time / solved), but humans rank it by **points** descending. `queryResults` skips `333mbf`; `toJson` queries it separately and sorts by sum of `points` descending before merging.',
      highlight: true,
    },
  ],
  edgesZh: [
    'BLD 项目按 `single` 排,其它按 `average`:这是项目固有规则,不可调。',
    '不足 3 人的 round 被过滤(`third_result IS NOT NULL`)。所以小赛事冷门项目可能整项目都没有上榜行。',
    '`333mbf` 的 sum 列显示的是 **points 之和**,不是 WCA value 之和 — 跟其它项目的 clock-format 步调不同,看的时候要意识到单位差异。',
    '同一场比赛的预赛 / 决赛可以同时上榜(它们是两个不同的 `round_type_id`)。',
  ],
  edgesEn: [
    'BLD events rank by `single`, all others by `average` — fixed by event, not user-configurable.',
    'Rounds with fewer than 3 finishers are filtered (`third_result IS NOT NULL`). Niche events at tiny competitions may have zero rows.',
    '`333mbf` displays a **points sum**, not a WCA-value sum — a different unit from clock-format times, so don\'t cross-compare.',
    'A first-round and a final from the same competition can both appear (they have distinct `round_type_id`s).',
  ],
  related: [
    { id: 'best_potential_fmc_mean', titleZh: '最佳潜在 FMC 平均', titleEn: 'Best potential FMC mean', hintZh: '同样以"轮次"为单位的潜在视角', hintEn: 'Round-keyed sibling stat, but "potential" rather than achieved' },
    { id: 'wr_aoxr', titleZh: 'AoXR (跨轮)', titleEn: 'AoXR (across rounds)', hintZh: '反过来:同一选手跨多轮取平均', hintEn: 'Opposite axis: averages across rounds for one person' },
    { id: 'yearly_rankings', titleZh: '年度排名', titleEn: 'Yearly rankings', hintZh: '一年时间窗内的最佳成绩', hintEn: 'Best results within a single year' },
    { id: 'best_round', toStat: true, titleZh: '打开 Best round 榜', titleEn: 'Jump to Best round board', hintZh: '21 项目 top 10', hintEn: '21 events, top 10 each' },
  ],
};

// ──── most_frequent_results ─────────────────────────────────────────────────
const most_frequent_results: AboutEntry = {
  id: 'most_frequent_results',
  titleZh: '最常出现的成绩',
  titleEn: 'Most frequent results',
  badgeZh: '频次',
  badgeEn: 'Frequency',
  introZh: [
    '把 WCA 历史上**所有 attempt 值**(每条结果有 1 ~ 5 次 attempt,3x3 ao5 = 5 次,FMC mean = 3 次,等等)拆开,看哪些**具体厘秒值**出现得最多。',
    '结果出奇地有趣 —— 整十、整百的"round 数"明显堆积(如 3x3 的 `10.00`、`12.00`),这是计时器停秒时**人眼对齐**的副作用;FMC 因为整数步数,频次分布天然密集;BLD 的 DNF 几乎主导分布(但被 `> 0` 过滤掉了),所以榜上只看到成功成绩。',
  ],
  introEn: [
    'Unroll every attempt value (each result has 1 ~ 5 attempts: 3x3 ao5 = 5, FMC mean = 3, single events = 1) across all WCA history, then count which exact **centisecond values** show up most often.',
    'The result is oddly fun: round-number times pile up (e.g. `10.00` and `12.00` on 3x3), which is a side effect of how timer-stoppers eye the readout; FMC has dense integer values by construction; BLD is dominated by DNF, but `> 0` filtering means the board shows only successes.',
  ],
  stats: [
    { value: '`> 0`', labelZh: '只算成功', labelEn: 'Successful only', hintZh: 'DNF (-1)、DNS (-2)、未提交 (0) 全跳', hintEn: 'DNF (-1), DNS (-2), unattempted (0) all skipped' },
    { value: '21 项目', labelZh: '逐项目分桶', labelEn: 'Per-event buckets', hintZh: '不同项目厘秒分布完全不同,不混着排', hintEn: 'Different events have wildly different distributions; not pooled' },
    { value: 'top 10', labelZh: '榜单深度', labelEn: 'Rows per event', hintZh: '每个项目取最热门 10 个具体值', hintEn: 'Per event: the 10 most-frequent exact values' },
    { value: '~M 级', labelZh: '总 attempt 量', labelEn: 'Total attempts', hintZh: 'WCA 历史所有 attempt — 数千万级', hintEn: 'Tens of millions of attempts across WCA history' },
  ],
  sourceZh: [
    '只 `SELECT` 出 `event_id` 和 attempts 列(通过 `ATTEMPTS_SUBQUERY` 把 `result_attempts` 表的 1-5 个 attempt 拼成 comma-separated string),其它过滤、拆分、计数都在 TS 里跑。`event_id != \'333mbo\'`(旧 multi-BLD old style,已被 `333mbf` 取代)。',
  ],
  sourceEn: [
    'SQL only `SELECT`s `event_id` and a comma-separated `attempts` string (built by `ATTEMPTS_SUBQUERY` over the `result_attempts` table, joining 1 ~ 5 attempts into one cell). Splitting, filtering, and counting all happen in TS. Excludes `event_id = \'333mbo\'` (legacy multi-BLD, superseded by `333mbf`).',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  event_id,
  ${'${ATTEMPTS_SUBQUERY}'} AS attempts  -- 1~5 attempts joined as 'v1,v2,v3,v4,v5'
FROM results result
WHERE event_id != '333mbo';

-- TS side:
--   for each row: attempts.split(',').map(Number)
--   for each value v > 0: counts.set(v, counts.get(v) + 1)
--   sort by count desc, top 10 per event`,
  },
  steps: [
    {
      titleZh: 'attempts 拼串',
      titleEn: 'Concatenate attempts',
      bodyZh: '`ATTEMPTS_SUBQUERY` 在 `result_attempts` 表里按 `result_id` group + `GROUP_CONCAT(value ORDER BY attempt_number)`,得到形如 `\'1234,1100,1450,1380,1290\'` 的串。WCA 表设计本身没有 `value1..value5` 列,值散在 `result_attempts` 里一行一条。',
      bodyEn: '`ATTEMPTS_SUBQUERY` does a per-`result_id` `GROUP_CONCAT(value ORDER BY attempt_number)` over `result_attempts`, yielding strings like `\'1234,1100,1450,1380,1290\'`. (The WCA schema does **not** have `value1..value5` columns — each attempt is its own row in `result_attempts`.)',
    },
    {
      titleZh: '按项目分桶 + 拆 attempt',
      titleEn: 'Bucket by event + split attempts',
      bodyZh: '`EVENTS_ENTRIES.map`,每个项目一节。`row[\'attempts\'].split(\',\').map(Number)` 拆出 1-5 个 attempt;`if (v > 0)` 过滤掉 DNF(-1)、DNS(-2)、未提交(0)。',
      bodyEn: '`EVENTS_ENTRIES.map` builds one section per event. `row.attempts.split(\',\').map(Number)` extracts the 1 ~ 5 attempts; the `v > 0` filter drops DNF (-1), DNS (-2), and unattempted (0).',
    },
    {
      titleZh: '`Map<number, number>` 计数',
      titleEn: '`Map<number, number>` count',
      bodyZh: '`valueCounts.set(v, (valueCounts.get(v) ?? 0) + 1)` — 每见到一次 v 就 ++。注意 `v` 是**原始厘秒/步数**整数,所以 `10.00` (1000)、`10.01` (1001)、`10.02` (1002) 被算成三个不同 key。',
      bodyEn: '`valueCounts.set(v, (valueCounts.get(v) ?? 0) + 1)` — increment per occurrence. `v` is the **raw centisecond / move-count integer**, so `10.00` (1000), `10.01` (1001), `10.02` (1002) are three distinct keys.',
    },
    {
      titleZh: '排序 + top 10 + 格式化',
      titleEn: 'Sort, top 10, format',
      bodyZh: '`[...valueCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)`,然后用 `SolveTime(eventId, \'single\', v).clockFormat()` 把整数转成展示串(`10.00` / `33` 等)。',
      bodyEn: '`[...valueCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)`, then `SolveTime(eventId, \'single\', v).clockFormat()` turns the integer into a display string (`10.00`, `33`, etc.).',
      highlight: true,
    },
  ],
  edgesZh: [
    '`333mbo` (multi-BLD old style) 整体被排除 — 它在 2009 年已被 `333mbf` 取代,数据点太少且编码不同。',
    'DNF / DNS / 未提交不计入频次,所以即使 BLD 项目里 DNF 大量出现,榜单也只展示成功 attempt。',
    'FMC 的 attempt 是步数(integer),所以容易出现极高频整数(如 `28`、`29`、`30`);timed 项目则是厘秒,整 `.00`、`.50` 偏多反映"读秒手动停"的人因偏差。',
    '同一 result 的 5 个 attempt 全都进入计数 — 不只是 best / 不只是 average 用到的 3 个。',
  ],
  edgesEn: [
    '`333mbo` (multi-BLD old style) is excluded outright — superseded by `333mbf` in 2009, with too few data points and a different encoding.',
    'DNF / DNS / unattempted are not counted, so even though BLD events have abundant DNFs in raw data, the board shows only successful attempts.',
    'FMC attempts are integer move counts, producing high-frequency exact values like `28`, `29`, `30`. Timed events are centiseconds — over-representation of `.00` and `.50` reflects human "stop-the-timer" perception bias.',
    'All 5 attempts of a result are counted — not only the `best`, not only the 3 that survive ao5 trimming.',
  ],
  related: [
    { id: 'best_potential_fmc_mean', titleZh: '最佳潜在 FMC 平均', titleEn: 'Best potential FMC mean', hintZh: '同样用 `result_attempts` 拆 attempt slot', hintEn: 'Also unrolls `result_attempts` per slot' },
    { id: 'dnf_rate_by_event', titleZh: '各项目 DNF 率', titleEn: 'DNF rate by event', hintZh: '反过来:看被这里过滤掉的 DNF 占比', hintEn: 'Mirror view: how big a fraction were the filtered-out DNFs' },
    { id: 'smallest_diff_between_single_and_average', titleZh: '最小单平差', titleEn: 'Smallest single-average diff', hintZh: '另一类"巧合数值"统计', hintEn: 'A different kind of "coincidental value" stat' },
    { id: 'most_frequent_results', toStat: true, titleZh: '打开 Most frequent results', titleEn: 'Jump to live frequency board', hintZh: '21 项目分布', hintEn: '21 event distributions' },
  ],
};

// ──── moving_average ────────────────────────────────────────────────────────
const moving_average: AboutEntry = {
  id: 'moving_average',
  titleZh: '移动平均',
  titleEn: 'Moving average',
  badgeZh: '近期',
  badgeEn: 'Recent',
  introZh: [
    '`moving_average` 给每个选手 × 项目算一个**指数加权移动平均 (EMA)**:把该选手所有 official ao5 平均按比赛日期顺序排列,从早到晚扫一遍,新值权重 `1 − α`,老值衰减系数 `α`。这里 `α = 0.8`,意味着最近 ~5 个 average 占主导。',
    '它不像 official ao5 / ao12 那样"只在一个比赛里"取连续 N 次还原 —— 它跨**整个职业生涯**滑动,衡量"这位选手最近这阵子在该项目上水平有多稳"。career 不足 5 个 ao5 的选手会被排除(数据太少没意义)。',
  ],
  introEn: [
    '`moving_average` computes an **exponentially-weighted moving average (EMA)** per `(person, event)` pair: walk through every official ao5 average that solver has posted, in date order, weighting new values by `1 − α` and decaying old ones by `α`. Here `α = 0.8`, so the most recent ~5 averages dominate.',
    'Unlike official ao5 / ao12 (a single-comp window of consecutive solves), this glides over an entire **career**, measuring "how strong has this solver been lately at this event". People with fewer than 5 career ao5 averages are excluded (not enough signal).',
  ],
  stats: [
    { value: 'α = 0.8', labelZh: '衰减系数', labelEn: 'Decay factor', hintZh: '老成绩每滑一步衰减 0.8 倍', hintEn: 'Each step back in time discounts by 0.8' },
    { value: '~5', labelZh: '有效窗口', labelEn: 'Effective window', hintZh: '最近 5 个 average 总权重约占 2/3', hintEn: 'Most recent 5 averages contribute ~2/3 of total weight' },
    { value: '≥ 5', labelZh: '最低 average 数', labelEn: 'Min averages', hintZh: '少于 5 个 ao5 的选手不上榜', hintEn: 'Solvers with under 5 career averages are dropped' },
    { value: '50', labelZh: '榜单深度', labelEn: 'Rows per event', hintZh: 'top 50 / 项目', hintEn: 'Top 50 per event' },
  ],
  sourceZh: [
    '`results` join `persons`(`sub_id = 1`)、`competitions`、`round_types`,**按 `start_date` + `round_type.rank` 全局排序**(职业生涯时间线)。只取 `average > 0`,排除 BLD 系列(`333bf / 333mbf / 333mbo / 444bf / 555bf`,因为它们的 single 才是排名口径)。`average_of_x` 的 sibling 思路用纯 SQL 滑动窗口;这里 EMA + 偏差校正只能在 TS 里跑。',
  ],
  sourceEn: [
    '`results` join `persons` (`sub_id = 1`), `competitions`, `round_types`, **ordered globally by `start_date` then `round_type.rank`** (career timeline). Filters to `average > 0` and drops BLD events (`333bf / 333mbf / 333mbo / 444bf / 555bf`, which are ranked by single, not average). Sibling stat `average_of_x` runs as pure-SQL sliding windows; here EMA + bias correction is done in TS.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  person.name, person.wca_id, event_id, average
FROM results result
JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
JOIN competitions competition ON competition.id = competition_id
JOIN round_types round_type ON round_type.id = round_type_id
WHERE average > 0
  AND event_id NOT IN ('333bf','333mbf','333mbo','444bf','555bf')
ORDER BY competition.start_date, round_type.rank;

-- TS: per (person, event) accumulate
--   avg = avg * α + (1 - α) * new_value      (α = 0.8)
--   bias-correct:  corrected = avg / (1 - αⁿ)`,
  },
  steps: [
    {
      titleZh: '时间序排好整张表',
      titleEn: 'Sort the whole table chronologically',
      bodyZh: 'SQL 一次性按 `start_date, round_type.rank` 全排,TS 端按 `(person, event)` 收桶即可,无需在 TS 里再排。`round_type.rank` 保证同一比赛内预赛 → 半决 → 决赛顺序。',
      bodyEn: 'SQL pre-sorts the entire table by `start_date, round_type.rank`. The TS side just needs to bucket by `(person, event)` — no re-sorting. `round_type.rank` ensures qualification → semifinal → final ordering within a comp.',
    },
    {
      titleZh: '逐人迭代 EMA',
      titleEn: 'Iterate EMA per person',
      bodyZh: '从 `avg = 0` 起步,每读一个新 average `num`:`avg = avg * α + (1 − α) * num`。`α = 0.8` 意味着老值每步衰减到 80%,新值仅占 20% — 但因为持续累加,最近 5 个值贡献了约 2/3 总权重。',
      bodyEn: 'Start `avg = 0`. For each new `num`: `avg = avg * α + (1 − α) * num`. With `α = 0.8`, old values decay to 80% per step and the new one contributes 20% — but accumulated over time, the most recent 5 values contribute ~2/3 of total weight.',
    },
    {
      titleZh: '偏差校正',
      titleEn: 'Bias correction',
      bodyZh: '初期 `avg` 被 `0` 拖低(只跑了 1-2 个值时,衰减项还没"填满"),需要除以 `1 − αⁿ`(n = 已见值数量)来抵消。等价于 Adam optimizer 里那个 `1 − β₁ᵗ` 修正。`Math.round` 取整成厘秒 long-int。',
      bodyEn: 'Early on, `avg` is dragged down by its `0` start (the decay term has not "filled in" yet). Dividing by `1 − αⁿ` (n = number of samples seen) cancels that — same trick as Adam optimizer\'s `1 − β₁ᵗ`. Rounded to a centisecond long-int.',
    },
    {
      titleZh: '过滤不足 5 + 排序取 top 50',
      titleEn: 'Filter < 5, sort, top 50',
      bodyZh: '`.filter(([, avgs]) => avgs.length >= 5)` — 不足 5 个 average 的人不上榜。再按 EMA 升序取 50。每项目独立一节(BLD 5 项目整组缺席)。',
      bodyEn: '`.filter(([, avgs]) => avgs.length >= 5)` drops solvers with fewer than 5 averages. Sort ascending, take top 50. One section per event (BLD events absent as a group).',
      highlight: true,
    },
  ],
  formulae: [
    {
      labelZh: 'EMA 递推 + 偏差校正',
      labelEn: 'EMA recurrence + bias correction',
      expr: 'avgₜ = α · avgₜ₋₁ + (1 − α) · numₜ ;  EMA = avg_n / (1 − αⁿ)',
      bodyZh: 'α = 0.8,n = 该选手已发布的 average 数。先迭代,最后一步除以 `1 − αⁿ` 校正初期欠拟合。',
      bodyEn: 'α = 0.8, n = number of averages the solver has posted. Iterate, then divide the final value by `1 − αⁿ` to correct the warm-up underestimate.',
    },
  ],
  edgesZh: [
    'BLD 系列(`333bf / 333mbf / 333mbo / 444bf / 555bf`)整组被排除 — 它们以 single 为排名口径,放进 EMA 没意义。',
    '`< 5 averages` 整段被剔。所以新人即使 5 个 ao5 飙到 sub-7 也得攒够数才上榜。',
    'EMA 对**单次大失误**记忆很短(几个 average 之后就忘了),所以"最近退步"的选手比 ao12/ao50 更快从榜上掉下来。',
    '不像 `average_of_x` 那种"连续 N 次官方还原"的固定窗口口径 — EMA 是软窗口,没有"截断"。',
  ],
  edgesEn: [
    'BLD events (`333bf / 333mbf / 333mbo / 444bf / 555bf`) are excluded as a group — they\'re ranked by single, so EMA-on-averages is meaningless.',
    'Solvers with fewer than 5 averages are dropped. So a newcomer flying through 5 sub-7 ao5\'s still needs more career data before they appear.',
    'EMA has very short memory for a single bad blowup (it fades within a few averages). Recent decliners drop off this board faster than they would from ao12 / ao50.',
    'Unlike `average_of_x` (a hard window of N consecutive official attempts), EMA is a soft window — there is no cliff cutoff.',
  ],
  related: [
    { id: 'average_of', titleZh: '滚动平均 (ao3 ~ ao1000)', titleEn: 'Rolling Average (ao3 ~ ao1000)', hintZh: '硬窗口连续 N 次官方还原,对照 EMA 软窗口', hintEn: 'Hard-window sibling: N consecutive official solves, vs EMA\'s soft window' },
    { id: 'wr_metric', titleZh: '指标 (Metric)', titleEn: 'Metric', hintZh: '更广义的 WR 指标族(bao5 / wao5 / mo5 / ...)', hintEn: 'Broader WR-metric family (bao5 / wao5 / mo5 / ...)' },
    { id: 'yearly_rankings', titleZh: '年度排名', titleEn: 'Yearly rankings', hintZh: '时间窗硬切到一年,而非 EMA 软衰减', hintEn: 'Hard one-year cutoff, opposite of EMA\'s decay' },
    { id: 'moving_average', toStat: true, titleZh: '打开 Moving average 榜', titleEn: 'Jump to Moving average board', hintZh: '看每项目 top 50', hintEn: 'Per-event top 50' },
  ],
};

// ──── smallest_diff_between_single_and_average ──────────────────────────────
const smallest_diff_between_single_and_average: AboutEntry = {
  id: 'smallest_diff_between_single_and_average',
  titleZh: '最小的单次与平均差距',
  titleEn: 'Smallest difference between a single and an average',
  badgeZh: '巧合',
  badgeEn: 'Coincidence',
  introZh: [
    '在同一个 ao5 round 里,一个选手的**单次最佳 (best)** 和**平均 (average)** 应该总是 `best ≤ average`(因为 average 是去头去尾后剩 3 次的均值)。差距 `diff = average − best` 总是 ≥ 0。',
    '这条 stat 找的是 diff 最小的那些 round —— 极端情况是 `diff = 0`(平均的 3 次计入还原恰好都跟 best 相同),次极端是 `diff = 0.01`(一厘秒)。这类记录通常发生在低位数选手 spam 一串极接近的还原时,或者大项目(`777` / `666`)上整组成绩浮动很小。',
  ],
  introEn: [
    'Within a single ao5 round, a solver\'s **best (single)** is always ≤ their **average** (because the average is the trimmed mean of the middle 3 of 5 attempts). So `diff = average − best` is always ≥ 0.',
    'This stat picks out the rounds with the smallest such diff. The extreme case is `diff = 0` (the 3 counting solves happen to equal the single); the next is `diff = 0.01` (one centisecond). Often these come from low-time solvers spamming near-identical times, or from big-cube events (`777`, `666`) where the whole set moves together.',
  ],
  stats: [
    { value: '`avg − best`', labelZh: '定义', labelEn: 'Definition', hintZh: '同一 round 的 average 减 single', hintEn: 'average minus single from the same round' },
    { value: 'top 10', labelZh: '榜单深度', labelEn: 'Rows per event', hintZh: '按 diff 升序取前 10', hintEn: 'Top 10 by diff ascending' },
    { value: '剔除 333fm', labelZh: '`333fm` 不入榜', labelEn: '`333fm` excluded', hintZh: 'FMC 整数步数,diff = 0 太常见无意义', hintEn: 'FMC integer moves — `diff = 0` is trivial and noisy' },
    { value: 'tiebreak', labelZh: '三键排序', labelEn: 'Three-key sort', hintZh: 'diff → avg → single,确保稳定输出', hintEn: 'diff → avg → single, deterministic ordering' },
  ],
  sourceZh: [
    '`results` join `persons` (`sub_id = 1`)、`competitions`。SQL 只 SELECT `best`、`average` 和身份信息;`diff` 在 TS 端算。`event_id != \'333fm\'`(FMC 整数步数,diff=0 极常见,没区分度);`average > 0`(排除 DNF average / 未提交)。',
  ],
  sourceEn: [
    '`results` joined with `persons` (`sub_id = 1`) and `competitions`. SQL `SELECT`s `best`, `average`, and identity fields; `diff` is computed in TS. Filters: `event_id != \'333fm\'` (FMC integer values make `diff = 0` trivial), `average > 0` (drops DNF averages and unattempted).',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  event_id,
  best AS single,
  average,
  person.name,
  person.wca_id,
  competition.cell_name,
  competition.id AS competition_id
FROM results
JOIN persons person ON person.wca_id = person_id AND sub_id = 1
JOIN competitions competition ON competition.id = competition_id
WHERE event_id != '333fm' AND average > 0;

-- TS: diff = average - single
--   sort by (diff ASC, average ASC, single ASC)
--   slice 0..10 per event`,
  },
  steps: [
    {
      titleZh: '拉成对 (single, average)',
      titleEn: 'Pair (single, average)',
      bodyZh: '从 `results` 取每一条 ao5 round 的 `best` 与 `average`。注意 WCA dump 里 `best` 列 = 该 round 的最佳 attempt(即"单次"列),`average` = ao5 / mo3 的官方均值。',
      bodyEn: 'For each ao5 round in `results`, pull `best` and `average`. WCA dump convention: `best` column = the round\'s best attempt (i.e. the "single"), `average` = the ao5 / mo3 mean.',
    },
    {
      titleZh: '过滤口径',
      titleEn: 'Apply filters',
      bodyZh: '`event_id != \'333fm\'` — FMC 整数步数容易 single 与 average 完全相同,`diff = 0` 没有区分度。`average > 0` 排除 DNF 平均(WCA value `-1`)和未提交(`0`)。',
      bodyEn: '`event_id != \'333fm\'` — FMC integer-move semantics make `diff = 0` too common to be meaningful. `average > 0` drops DNF averages (value `-1`) and unattempted (`0`).',
    },
    {
      titleZh: '计算 diff',
      titleEn: 'Compute diff',
      bodyZh: '`diff = Number(average) − Number(single)`,单位是**厘秒**(可正可零,理论上不会为负 — single 是 ao5 内最佳)。注意:展示时 `(diff / 100).toFixed(2)` 转秒,但内部排序用整数厘秒避免浮点误差。',
      bodyEn: '`diff = Number(average) − Number(single)`, units are **centiseconds** (always ≥ 0 in theory — single is the round\'s best). For display: `(diff / 100).toFixed(2)` to seconds; internal sort stays on integer centiseconds to avoid float jitter.',
    },
    {
      titleZh: '三键排序',
      titleEn: 'Three-key sort',
      bodyZh: '`diff ASC → average ASC → single ASC` — diff 相同时偏好 average 更低的 round(更难达成),再相同时偏好 single 更低。这种 tiebreak 让大量 `diff = 0` 的行有确定排序。',
      bodyEn: '`diff ASC → average ASC → single ASC` — among ties on diff, prefer rounds with lower average (harder), then lower single. This deterministic tiebreak orders the (often many) `diff = 0` rows.',
    },
    {
      titleZh: '每项目取 top 10',
      titleEn: 'Per-event top 10',
      bodyZh: '`EVENTS_ENTRIES.map`,21 项目(剔除 `333fm`)每项目独立切前 10。`SolveTime(eventId, type, v).clockFormat()` 把厘秒转成展示串。',
      bodyEn: '`EVENTS_ENTRIES.map`, one section per event (FMC excluded), top 10 each. `SolveTime(eventId, type, v).clockFormat()` formats centiseconds for display.',
      highlight: true,
    },
  ],
  formulae: [
    {
      labelZh: '差值',
      labelEn: 'Diff',
      expr: 'diff = average − single,  diff ≥ 0',
      bodyZh: 'WCA ao5 规则:5 次 attempt 去最快和最慢,剩 3 次取算术平均。所以 `single ≤ 任一中间 3 次 ≤ average`(忽略 DNF 边界)。',
      bodyEn: 'WCA ao5 rule: drop fastest and slowest of 5 attempts, average the middle 3. Therefore `single ≤ any of the middle 3 ≤ average` (ignoring DNF edge cases).',
    },
  ],
  edgesZh: [
    '`333fm` 整体被排除 — FMC 是整数步数,`28 / 28 / 28 / 30 / 29` → single=28, mean=28.67,这种 `diff = 0` 在每场 FMC 都有,放进来淹没榜单。',
    'BLD 系列只有 `333bf` / `444bf` / `555bf` 有 average(`mo3`),`333mbf` 没有 average;BLD 的 `mo3` 没去头尾,所以 `single ≤ mo3` 仍然成立但口径不同。',
    'diff 用厘秒整数算,展示用 2 位小数 — `diff = 0.00` 和 `diff = 0.01` 在榜上同时存在很正常。',
    '不是"最相似 single 和 average"在 WCA 历史的查询 — 而是**同一 round 内**的差。两个不同 round 的"巧合一致"不会上榜。',
  ],
  edgesEn: [
    '`333fm` is excluded as a whole — integer move counts make `28 / 28 / 28 / 30 / 29` → single=28, mean=28.67 trivially common; if not excluded it would swamp every other event.',
    'Of the BLD family, only `333bf / 444bf / 555bf` have averages (`mo3`); `333mbf` has none. BLD `mo3` does not trim head/tail, but `single ≤ mo3` still holds (different semantics).',
    'Internally diff is integer centiseconds; the display rounds to 2 decimals — `diff = 0.00` and `diff = 0.01` happily coexist on the board.',
    'This is **within a single round**, not "most similar single and average across history" — two coincidentally-equal values in different rounds are not eligible.',
  ],
  related: [
    { id: 'most_frequent_results', titleZh: '最常出现的成绩', titleEn: 'Most frequent results', hintZh: '同样在"巧合数值"题材', hintEn: 'Sibling stat in the "value coincidence" theme' },
    { id: 'best_round', titleZh: '最佳轮次', titleEn: 'Best round', hintZh: 'round 级别的另一视角:top 3 之和', hintEn: 'Round-level sibling: top-3 sum view' },
    { id: 'average_of', titleZh: '滚动平均', titleEn: 'Rolling Average', hintZh: 'ao5 / mo3 计算口径详解', hintEn: 'Detail on the ao5 / mo3 semantics this stat relies on' },
    { id: 'smallest_diff_between_single_and_average', toStat: true, titleZh: '打开最小单平差榜', titleEn: 'Jump to Smallest diff board', hintZh: '21 项目 top 10', hintEn: '21 events, top 10 each' },
  ],
};

// ──── yearly_rankings ───────────────────────────────────────────────────────
const yearly_rankings: AboutEntry = {
  id: 'yearly_rankings',
  titleZh: '年度排名',
  titleEn: 'Yearly rankings',
  badgeZh: '年度',
  badgeEn: 'Yearly',
  introZh: [
    '`yearly_rankings` 是把 `Rankings` 抽象基类用 `WHERE YEAR(competition.start_date) = YEAR(CURDATE())` 切到**当年**得到的子统计 —— 每项目 × {Single, Average} 两个榜,各 top 10。',
    '这个 stat 是识别"当年统治力"的最快窗口:谁今年开了挂、谁新爬上 sub-X、哪个项目今年集体破纪录。和 `wr_current` 不同(那是全时段 WR),这里**只看 2026 这一年发生的成绩**。',
  ],
  introEn: [
    '`yearly_rankings` is the `Rankings` abstract base specialized to **the current calendar year** via `WHERE YEAR(competition.start_date) = YEAR(CURDATE())` — producing two boards per event ({Single, Average}), top 10 each.',
    'This is the quickest window into "who is dominant this year": who is breaking out, who just dropped sub-X, which events are seeing record clusters. Different from `wr_current` (all-time WR) — this filter is strictly **results that happened in 2026 itself**.',
  ],
  stats: [
    { value: '当年', labelZh: '时间窗', labelEn: 'Time window', hintZh: '`YEAR(start_date) = YEAR(CURDATE())`', hintEn: '`YEAR(start_date) = YEAR(CURDATE())`' },
    { value: '21 × 2', labelZh: '面板数', labelEn: 'Panels', hintZh: '21 项目,每项目 Single + Average', hintEn: '21 events, Single + Average each' },
    { value: 'top 10', labelZh: '每榜深度', labelEn: 'Per panel', hintZh: '每榜 top 10', hintEn: 'Top 10 per panel' },
    { value: '人去重', labelZh: '每人取最佳', labelEn: 'Best per person', hintZh: '同一人多条只留最快那条', hintEn: 'Same solver, multiple rows → only the fastest is kept' },
  ],
  sourceZh: [
    'extends `Rankings`(共用基类),`condition = \'WHERE YEAR(competition.start_date) = YEAR(CURDATE())\'`。`Rankings.query()` 从 `results` join `persons` (`sub_id = 1`)、`countries`、`competitions`,带出 single / average / attempts / 比赛 / 国籍信息。当前年口径意味着每元旦 0:00 整张榜清零重建。',
  ],
  sourceEn: [
    'extends the shared `Rankings` base class with `condition = \'WHERE YEAR(competition.start_date) = YEAR(CURDATE())\'`. `Rankings.query()` joins `results`, `persons` (`sub_id = 1`), `countries`, `competitions`, pulling single / average / attempts / comp / nationality. The "current year" cutoff means the board resets at every January 1st.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT
  event_id,
  best AS single,
  average,
  ${'${ATTEMPTS_SUBQUERY}'} AS attempts,
  person.name, person.wca_id,
  country.name AS country,
  competition.cell_name, competition.id
FROM results result
JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
JOIN countries country ON country.id = person.country_id
JOIN competitions competition ON competition.id = competition_id
WHERE YEAR(competition.start_date) = YEAR(CURDATE());

-- TS (Rankings.transform):
--   for each event × ('single' | 'average'):
--     filter value > 0
--     sort by SolveTime.compareTo
--     dedupe by person (keep best)
--     slice 0..10`,
  },
  steps: [
    {
      titleZh: '时间窗过滤',
      titleEn: 'Filter to the current year',
      bodyZh: '`WHERE YEAR(competition.start_date) = YEAR(CURDATE())` — 只放行当年的比赛结果。SQL 端一次过滤完,后续逻辑都共享 `Rankings` 基类的实现。',
      bodyEn: '`WHERE YEAR(competition.start_date) = YEAR(CURDATE())` lets through only this year\'s competition results. The SQL handles the filter once; everything downstream reuses the shared `Rankings` base.',
    },
    {
      titleZh: '展开 event × type',
      titleEn: 'Expand event × type',
      bodyZh: '`EVENTS_ENTRIES.flatMap` 把每个项目展开成 `[Single, Average]` 两个 panel(共 ~42 个面板,部分项目 average panel 为空,如 `333mbf`)。',
      bodyEn: '`EVENTS_ENTRIES.flatMap` expands each event into a `[Single, Average]` pair (≈ 42 panels total — some events have an empty average panel, e.g. `333mbf`).',
    },
    {
      titleZh: '正值过滤 + SolveTime 排序',
      titleEn: 'Positive filter + SolveTime sort',
      bodyZh: '`Number(r[type]) > 0` 排除 DNF/DNS/未提交。然后用 `SolveTime.compareTo` 排序(BLD points 项目走升序仍然语义正确,因为基类内部已封好)。',
      bodyEn: '`Number(r[type]) > 0` drops DNF / DNS / unattempted. Then `SolveTime.compareTo` sorts — for BLD-points events the comparator is encapsulated correctly inside `SolveTime` so the calling code remains uniform.',
    },
    {
      titleZh: '人去重',
      titleEn: 'Dedupe by person',
      bodyZh: '`Set<person_link>`,从已排序列表中扫,首次出现即记入,后续重复 skip。等价于"每人保留**今年内**最快的那条"。',
      bodyEn: '`Set<person_link>` walks the sorted list and records each solver on first encounter, skipping duplicates. Equivalent to "keep this year\'s fastest record per person".',
    },
    {
      titleZh: '取 top 10 + 渲染',
      titleEn: 'Take top 10 + render',
      bodyZh: '`slice(0, 10)`,每行附带 attempts 串("**32.10** 33.45 30.20 ...")便于看到组成。每个 (event, type) 一个 section。',
      bodyEn: '`slice(0, 10)`. Each row attaches the attempts string ("**32.10** 33.45 30.20 ...") so viewers can see the composition. One section per `(event, type)`.',
      highlight: true,
    },
  ],
  edgesZh: [
    '"当年"= `YEAR(CURDATE())`,即 build 时的服务器日历年。跨年那一刻整张榜从零开始重新累积。',
    '`sub_id = 1` 过滤副身份(改名 / 换国籍 / 多 WCA ID 的 dump 行)。',
    'BLD multi (`333mbf`) 没有 average,所以它的 Average panel 永远是空 — 渲染时整 panel 不会显示。',
    '每人去重是"全年最佳",不是"每场比赛最佳" — 不是按 round / comp / round_type 分。一个人哪怕全年比了 30 场,这里也只算他/她最快的那一条。',
  ],
  edgesEn: [
    '"Current year" = `YEAR(CURDATE())` at build time on the server clock. On New Year the board resets and re-accumulates from zero.',
    '`sub_id = 1` filters alt identities (renames, country changes, multiple WCA IDs in the dump).',
    'BLD multi (`333mbf`) has no average, so its Average panel is always empty — and won\'t render.',
    'Dedupe is "year-best per person", not per-comp or per-round. Even if someone competes 30 times in the year, only their single fastest result appears.',
  ],
  related: [
    { id: 'wr_current', titleZh: '现役世界纪录', titleEn: 'Current world records', hintZh: '全时段口径,对照"今年口径"', hintEn: 'All-time WR, contrast with this year-only view' },
    { id: 'wr_metric', titleZh: '指标 (Metric)', titleEn: 'Metric', hintZh: 'WR 指标族 — single/average/bao5/wao5/...', hintEn: 'WR metric family — single / average / bao5 / wao5 / ...' },
    { id: 'moving_average', titleZh: '移动平均', titleEn: 'Moving average', hintZh: 'EMA 软窗口 vs 一年硬窗口', hintEn: 'EMA soft window vs hard one-year cutoff' },
    { id: 'yearly_rankings', toStat: true, titleZh: '打开 Yearly rankings', titleEn: 'Jump to Yearly rankings', hintZh: '21 项目 × {Single, Average} 共 ~42 面板', hintEn: '21 events × {Single, Average} ≈ 42 panels' },
  ],
};

export const RESULTS_RECORDS_ABOUT: Record<string, AboutEntry> = {
  best_potential_fmc_mean,
  best_round,
  most_frequent_results,
  moving_average,
  smallest_diff_between_single_and_average,
  yearly_rankings,
};
