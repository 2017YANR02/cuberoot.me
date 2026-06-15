// LOOKUP 类(/wca/grand-slam 等 6 个) — about entries
import type { AboutEntry } from '../types';

// ──── grand-slam ───────────────────────────────────────────────────────────
const grand_slam: AboutEntry = {
  id: 'grand-slam',
  titleZh: '大满贯 — 同一项目集齐三冠 + WR',
  titleEn: 'Grand Slam — three-tier podium plus a WR in one event',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '一个 `(选手, 项目)` 算「大满贯」需要四件事同时成立:在该项目登上**世界锦标赛**(WC)的决赛领奖台、**所在大洲冠军赛**的决赛领奖台、**所在国家锦标赛**的决赛领奖台,并且在职业生涯**至少一次**刷新过该项目的 single 或 average WR。',
    '门槛高度叠加 — 既要常年保持世界顶级,又要在主场国和大洲都拿到名次,还得有那么一刻是地球最快。`onlyFirst=1` 进一步只留三个领奖台都是金牌(pos=1)的人,这是「全金大满贯」。',
  ],
  introEn: [
    'A `(person, event)` qualifies as a "Grand Slam" when **four** things hold at once: a final-round podium at a **World Championship** (WC), a final-round podium at the person\'s **Continental Championship**, a final-round podium at their **National Championship**, and **at least one** WR (single or average) at some point in their career in that event.',
    'The bar stacks — sustained world-top form plus winning at home and on the continent, with a moment of literally being fastest on Earth. The `onlyFirst=1` toggle further restricts to people whose three podiums were all gold (pos=1) — the "all-gold" slam.',
  ],
  stats: [
    { value: '3 + 1', labelZh: '台阶', labelEn: 'Tiers', hintZh: 'WC + 大洲 + 国锦 领奖台,外加任一 WR', hintEn: 'WC + continental + national podium, plus any WR'
    },
    { value: '17', labelZh: '覆盖项目', labelEn: 'Events covered', hintZh: '当前 17 个官方项目逐个独立计算', hintEn: 'Computed independently per active event'
    },
    { value: 'pos ≤ 3', labelZh: '领奖台口径', labelEn: 'Podium criterion', hintZh: '只看 finals(round_type c/f)', hintEn: 'Finals only — `round_type_id` in c/f'
    },
    { value: '1 d', labelZh: 'API 缓存', labelEn: 'API cache', hintZh: '/v1/wca/grand-slam 走 24h Cache-Control', hintEn: '/v1/wca/grand-slam served with 24h Cache-Control'
    },
  ],
  sourceZh: [
    'CI 端读 WCA dump 的 `results` + `championships` + `eligible_country_iso2s_for_championship`,本地折叠成 `wca_grand_slam` 一行 = `(wca_id, event_id)`。冠军赛分三类:`world` / `_continent` 前缀 / 国家 iso2;`greater_china` 等多国共享冠军赛走 eligibility 表反查。运行时只读 PG。',
  ],
  sourceEn: [
    'CI reads `results` + `championships` + `eligible_country_iso2s_for_championship` from the WCA dump, then folds them into `wca_grand_slam` keyed by `(wca_id, event_id)`. Championships split three ways: `world`, leading-underscore continent codes, and ISO2 country codes; multi-country championships (e.g. `greater_china`) resolve via the eligibility table. The server only reads PG.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT gs.wca_id, gs.event_id, gs.best_value, gs.avg_value,
       gs.has_wr, gs.is_only_first,
       gs.world_champ_comp_id, gs.world_champ_pos,
       gs.continental_champ_comp_id, gs.continental_champ_pos,
       gs.national_champ_comp_id, gs.national_champ_pos,
       p.name AS person_name
FROM wca_grand_slam gs
JOIN wca_persons p ON p.wca_id = gs.wca_id
WHERE gs.event_id = ?
ORDER BY gs.best_value NULLS LAST;`,
  },
  steps: [
    {
      titleZh: '挑出决赛领奖台行',
      titleEn: 'Filter to final-round podium rows',
      bodyZh: '只看 `round_type_id ∈ {c, f}` 且 `pos BETWEEN 1 AND 3` 的 `results` 行。预赛 / 半决无效 — 必须是 finals。',
      bodyEn: 'Keep `results` rows where `round_type_id ∈ {c, f}` and `pos BETWEEN 1 AND 3`. Heats / semis don\'t count — must be finals.'
    },
    {
      titleZh: '按 comp 分到三档',
      titleEn: 'Route each podium to one of three tiers',
      bodyZh: '`compId ∈ worldChampComps` → WC 档;`continentalChampComps.get(compId) === person 的大洲` → 大洲档;`nationalChampComps.get(compId) === person 国籍`(或 `multiCountryNatComps` 包含)→ 国锦档。同档多次留 `pos` 最小那次。',
      bodyEn: '`compId ∈ worldChampComps` → WC tier; `continentalChampComps.get(compId) === person\'s continent` → continental tier; `nationalChampComps.get(compId) === person\'s country` (or the multi-country set contains it) → national tier. If the person podiums multiple times in the same tier, keep the row with the smallest `pos`.'
    },
    {
      titleZh: '独立扫一遍 WR',
      titleEn: 'Separately sweep for WR',
      bodyZh: '同一 `(person, event)` 任意一行的 `regional_single_record = "WR"` 或 `regional_average_record = "WR"` 即标 `has_wr = TRUE`。不限轮次 / 比赛类型 — 一次 WR 终生有效。',
      bodyEn: 'Any row for the same `(person, event)` with `regional_single_record = "WR"` or `regional_average_record = "WR"` flips `has_wr = TRUE`. No round or comp-type restriction — one WR is enough, forever.'
    },
    {
      titleZh: '四交集 → 大满贯',
      titleEn: 'Four-way intersection → Grand Slam',
      bodyZh: '一行进 `wca_grand_slam` 必须 `worldChampPos / contChampPos / natChampPos` 全部非空,**并且** `hasWrSingle || hasWrAvg`。`is_only_first = (worldChampPos = 1 AND contChampPos = 1 AND natChampPos = 1)`。',
      bodyEn: 'A row lands in `wca_grand_slam` only if `worldChampPos / contChampPos / natChampPos` are all non-null **and** `hasWrSingle || hasWrAvg`. Then `is_only_first = (worldChampPos = 1 AND contChampPos = 1 AND natChampPos = 1)`.'
    },
    {
      titleZh: '请求时 join 出 enriched 行',
      titleEn: 'Enrich at request time',
      bodyZh: '`/v1/wca/grand-slam?event=&onlyFirst=` 从 `wca_grand_slam` 按 `event_id` + 可选 `is_only_first` / `has_wr` 过滤,join `wca_persons` / `wca_competitions` / `wca_countries` 补齐姓名 / 比赛名 / iso2,按 `best_value` 升序最多返回 5000 行。',
      bodyEn: '`/v1/wca/grand-slam?event=&onlyFirst=` filters `wca_grand_slam` by `event_id` plus optional `is_only_first` / `has_wr`, joins `wca_persons` / `wca_competitions` / `wca_countries` for names + iso2, and returns up to 5000 rows sorted by `best_value`.',
      highlight: true
    },
  ],
  edgesZh: [
    '大洲冠军赛归属看选手**当前**国籍对应的大洲(`persons.country_id` → `countries.continent_id`),不是比赛举办地。换国籍的选手可能"重新具备资格"。',
    '"领奖台" 严格按 `pos` 取(WCA 官方裁定),不重算成绩 — 即使有人 DNF average 但 `pos = 3` 也算上。',
    '`greater_china` 等多国共享冠军赛通过 `eligible_country_iso2s_for_championship` 反查;台湾 / 香港 / 澳门选手在 China Championship 上的领奖台计入国锦档。',
    '`onlyFirst` 不要求三场是同一年 — 只要三场都拿过金牌即可,时间跨度不限。',
  ],
  edgesEn: [
    'Continental tier is decided by the person\'s **current** nationality → continent (`persons.country_id` → `countries.continent_id`), not by where the comp was held. People who changed citizenship may "re-qualify".',
    'Podium uses raw `pos` (WCA official placement); we don\'t recompute from values. A DNF\'d average with `pos = 3` still counts.',
    'Multi-country championships (e.g. `greater_china`) resolve via `eligible_country_iso2s_for_championship`; podiums by TW / HK / MO competitors at China Championship credit their national tier.',
    '`onlyFirst` does not require the three golds to be in the same year — across a career is fine.',
  ],
  related: [
    { id: 'sum-of-ranks', titleZh: '全项目排名', titleEn: 'Sum of Ranks', hintZh: '另一个"全能选手"指标 — 把世界排名相加', hintEn: 'Another all-rounder lens — sum of world ranks instead of podiums'
    },
    { id: 'all-events-done', titleZh: '全项目达成', titleEn: 'All Events Done', hintZh: '从首参赛到 17 项都至少完赛一次的耗时', hintEn: 'Days from first comp to having at least one result in all 17 events'
    },
    { id: 'wr_aoxr', titleZh: 'AoXR — 跨轮平均', titleEn: 'AoXR — across-round average', hintZh: '同样靠 WR 列表筛人 — has_wr=TRUE 选手集合的交集', hintEn: 'Also keyed off the WR list — overlaps the has_wr=TRUE cohort'
    },
    { id: 'grand-slam', toStat: true, titleZh: '直接打开大满贯排名', titleEn: 'Open the Grand Slam table', hintZh: '看实际选手 / 项目切换 / 全金过滤', hintEn: 'Live table + event picker + only-gold toggle'
    },
  ]
};

// ──── all-results ──────────────────────────────────────────────────────────
const all_results: AboutEntry = {
  id: 'all-results',
  titleZh: '全部成绩排名 — 全 11M 行的可分页搜索',
  titleEn: 'All Results — paginated search over every WCA result',
  badgeZh: '查询',
  badgeEn: 'Lookup',
  introZh: [
    '把 WCA dump 里的全部 single + average 成绩展平成一张 `wca_results_flat` 表(~11M 行,无 cap),让前端按项目 / single 还是 average / 国家 / 年 / 月 / 选手或比赛名搜索,翻页深至几百万也得在 <300 ms 内返回。',
    '关键挑战在**深分页**:`ORDER BY value LIMIT/OFFSET` 走 OFFSET 1,000,000 时,朴素查询要先 join 三张表再丢弃前 100 万行,要 10 s+。这里用「派生表 + late-join 走 id PK」+ `INCLUDE (id)` 索引,让内子查询走 Index Only Scan 不回表,外层再 enrich 100 行。',
  ],
  introEn: [
    'Flattens the WCA dump\'s single + average results into one `wca_results_flat` table (~11M rows, no cap) so the client can filter by event / single vs average / country / year / month / person or comp name and paginate millions of rows deep in under 300 ms.',
    'The hard part is **deep pagination**: `ORDER BY value LIMIT/OFFSET` with `OFFSET 1,000,000` would naïvely join three tables and then discard the first million rows — 10 s+. The route uses a **derived-table + late-join on the id PK** pattern with an `INCLUDE (id)` index so the inner subquery is Index-Only and the outer only enriches 100 rows.',
  ],
  stats: [
    { value: '~11 M', labelZh: '行数', labelEn: 'Rows', hintZh: 'single + average 各占一行', hintEn: 'One row each for single and average'
    },
    { value: '6', labelZh: '主索引', labelEn: 'Main indexes', hintZh: 'wrf_main / country / wca_id / comp_id / year / comp_lookup', hintEn: 'wrf_main / country / wca_id / comp_id / year / comp_lookup' },
    { value: '< 300 ms', labelZh: 'OFFSET 1 M', labelEn: 'At OFFSET 1 M', hintZh: 'late-join + INCLUDE(id) + VACUUM 后 Heap Fetches = 0', hintEn: 'late-join + INCLUDE(id) + VACUUM → Heap Fetches = 0'
    },
    { value: '200', labelZh: '页大小上限', labelEn: 'Page size cap', hintZh: 'MAX_SIZE 防大查询拖慢服务', hintEn: 'MAX_SIZE prevents huge pulls from starving the server'
    },
  ],
  sourceZh: [
    'CI 端逐 `event_id` 流式扫描 `results`,每行可能产出 0 / 1 / 2 条 TSV(`best > 0` 一条 single,`average > 0` 再一条 average);末尾 3 列 `round_type_id / format_id / record_tag` 是为 `/comp` 页 fast-path 准备的,无 cap。`load.sql` 在 PG 上 `DROP + CREATE + COPY`,完成后 `VACUUM (ANALYZE)` 让 visibility map 干净 — 否则 Index Only Scan 还得回表,深页 OFFSET 又退化。',
  ],
  sourceEn: [
    'CI streams `results` per `event_id`, emitting 0 / 1 / 2 TSV rows per source row (one single if `best > 0`, one average if `average > 0`); the trailing `round_type_id / format_id / record_tag` cols feed the `/comp` page fast-path — no cap anywhere. `load.sql` does `DROP + CREATE + COPY` then `VACUUM (ANALYZE)` so the visibility map is clean; without that, Index Only Scan re-fetches the heap and deep OFFSET regresses.',
  ],
  sourceCode: {
    lang: 'sql',
    captionZh: '深分页 late-join — 内子查询只走 INCLUDE(id) 覆盖索引,外层用 id PK 回表',
    captionEn: 'Deep-page late-join — inner subquery rides INCLUDE(id), outer joins via id PK',
    body: `SELECT q.value, q.wca_id, t.person_country_id, co.iso2,
       t.comp_id, c.name AS comp_name, t.comp_date, t.attempts, p.name
FROM (
  SELECT t.id, t.value, t.wca_id
  FROM wca_results_flat t
  WHERE t.event_id = ? AND t.is_avg = ?
  ORDER BY t.value ASC, t.wca_id ASC
  LIMIT ? OFFSET ?
) q
JOIN wca_results_flat t ON t.id = q.id
JOIN wca_persons p ON p.wca_id = t.wca_id
LEFT JOIN wca_countries co ON co.id = t.person_country_id
LEFT JOIN wca_competitions c ON c.id = t.comp_id
ORDER BY q.value ASC, q.wca_id ASC;`
},
  steps: [
    {
      titleZh: '基础过滤:event + type',
      titleEn: 'Base filter: event + type',
      bodyZh: '`event_id` 校验 `VALID_EVENTS`(21 个含废止项目),`type` 只接 `single` / `average`;`333mbf` 拒绝 average。这两个值进 `wrf_main` 索引前缀。',
      bodyEn: '`event_id` validated against `VALID_EVENTS` (21 incl. discontinued); `type` is `single` or `average` only; `333mbf` rejects `average`. Both values form the leading prefix of `wrf_main`.'
    },
    {
      titleZh: '附加过滤:country / year / month',
      titleEn: 'Optional filters: country / year / month',
      bodyZh: '`country` 走 2 字符 ISO2 → 反查 `wca_countries.id`;`year` 落到派生列 `comp_year`(STORED `EXTRACT(YEAR FROM comp_date)::SMALLINT`),`month` 走 `EXTRACT(MONTH FROM comp_date)`。`year` 命中 `wrf_year` 索引;month 是 post-filter。',
      bodyEn: '`country` accepts 2-char ISO2, resolved via `wca_countries.id`. `year` hits the generated column `comp_year` (`STORED EXTRACT(YEAR FROM comp_date)::SMALLINT`); `month` is `EXTRACT(MONTH FROM comp_date)` as a post-filter. `year` rides the `wrf_year` index.'
    },
    {
      titleZh: '自由文本 q:两张表 ILIKE',
      titleEn: 'Free-text q: ILIKE two tables',
      bodyZh: '`q` 同时在 `wca_persons.name` 和 `wca_competitions.name` 上 `ILIKE %q%`,各 LIMIT 200,union 进一个 `IN (...)` 列表喂给主查询的 `(wca_id IN ... OR comp_id IN ...)`。两边都空 → 直接返回 `total: 0`。',
      bodyEn: '`q` ILIKEs both `wca_persons.name` and `wca_competitions.name` with `LIMIT 200` each. Their ids feed `(wca_id IN ... OR comp_id IN ...)` in the main predicate. Both empty → short-circuit `total: 0`.'
    },
    {
      titleZh: '派生表内子查询走 Index Only Scan',
      titleEn: 'Inner derived query stays Index-Only',
      bodyZh: '内层只 `SELECT id, value, wca_id` — 三列都覆盖在 `wrf_main INCLUDE (id)` 里。`ORDER BY value, wca_id LIMIT ? OFFSET ?` 在索引上线性走,OFFSET 1 M 也只 ~250 ms,`Heap Fetches: 0`(前提 VACUUM 过)。',
      bodyEn: 'Inner query only `SELECT id, value, wca_id` — all three columns live inside `wrf_main INCLUDE (id)`. `ORDER BY value, wca_id LIMIT ? OFFSET ?` walks the index linearly; OFFSET 1 M still ~250 ms with `Heap Fetches: 0` (assuming a recent VACUUM).'
    },
    {
      titleZh: '外层用 id PK 回表 + enrich + 总数',
      titleEn: 'Outer joins via id PK, enrich, count',
      bodyZh: '`JOIN wca_results_flat t ON t.id = q.id` 走 PK,只回 100 行;再 join 三张字典表补 `name` / `comp_name` / `iso2`。并发跑一条 `COUNT(*)` 给 `total`(相同 WHERE)。',
      bodyEn: '`JOIN wca_results_flat t ON t.id = q.id` rides the PK and only resolves 100 rows; three lookup joins add `name` / `comp_name` / `iso2`. A separate `COUNT(*)` with the same WHERE produces `total`.',
      highlight: true
    },
  ],
  edgesZh: [
    '`OFFSET 1 M+` 是真实负载 — 数据集大到要这种写法。直接 `ORDER BY + LIMIT/OFFSET + 三表 JOIN` 单写法在 PG 上深页要 10 s+,被慢日志钉过。',
    '`person_country_id` 是**该次比赛时**选手的国籍(per result 列),不是当前国籍 — 国旗在历史成绩里展示的是当年的旗。',
    '`q` 同时空 + 没条件时全表扫,但 LIMIT 200 防止 ILIKE 命中 100k 选手时 IN list 爆掉。',
    '`333mbf` 没有 average — 请求 `type=average` 直接 400,不静默返空。',
  ],
  edgesEn: [
    '`OFFSET 1 M+` is real workload — the table is big enough that this pattern is required. Plain `ORDER BY + LIMIT/OFFSET + 3 joins` regresses to 10 s+ on PG and showed up in slow logs.',
    '`person_country_id` is nationality **at the time of the comp** (a per-result column), not current nationality — historical rows show the flag worn back then.',
    '`q` empty + no other filter is allowed (full scan), but ILIKE results are LIMIT-200 so a query matching 100k persons doesn\'t blow up the `IN` list.',
    '`333mbf` has no average — `type=average` returns 400 rather than silently empty.',
  ],
  related: [
    { id: 'cohort-ranks', titleZh: '参赛届别排名', titleEn: 'Cohort Ranks', hintZh: '同库的另一种切片:按首参赛年分组', hintEn: 'Same dataset sliced by first-competition year'
    },
    { id: 'wr_aoxr', titleZh: 'AoXR — 跨轮平均', titleEn: 'AoXR — across-round average', hintZh: '更窄的衍生指标 — 单场比赛多轮 average 平均', hintEn: 'A narrower derivative — averaging round averages within one comp'
    },
    { id: 'all-results', toStat: true, titleZh: '直接打开全成绩表', titleEn: 'Open the All Results table', hintZh: '看翻页 + 过滤 + 搜索的实际表现', hintEn: 'Live table — pagination + filters + free-text search'
    },
  ]
};

// ──── cohort-ranks ─────────────────────────────────────────────────────────
const cohort_ranks: AboutEntry = {
  id: 'cohort-ranks',
  titleZh: '参赛届别排名 — 按"首参赛年"分组排名',
  titleEn: 'Cohort Ranks — leaderboards bucketed by year of first comp',
  badgeZh: '排名',
  badgeEn: 'Ranking',
  introZh: [
    '把所有选手按**首次参赛年份**(cohort)分组,然后在每组内部按每项目的**生涯累积最佳**排名。"2014 届"就是把 2014 年第一次报名 WCA 比赛的人挑出来,看他们今天在 333 single 的相对位置。',
    '看一个选手要不要给"届别同期最强"的标签 — 是同年入场的人里最快的,而不是世界总榜上的排位。`country` 参数下排名按国家排;否则按世界排。',
  ],
  introEn: [
    'Bucket every competitor by the **year of their first competition** (cohort), then rank within each bucket by their **lifetime best** per event. The "2014 cohort" is everyone whose first WCA registration was in 2014 — and where they currently stand on 333 single relative to peers from that year.',
    'Answers "fastest of their year" — local ranking within the cohort rather than the global leaderboard. With a `country` param the rank becomes a within-country rank inside the cohort; without it, world rank.',
  ],
  stats: [
    { value: '~10 M', labelZh: '行数', labelEn: 'Rows', hintZh: 'cohort × event × single/average × person', hintEn: 'cohort × event × single/average × person'
    },
    { value: '2003+', labelZh: 'cohort 范围', labelEn: 'Cohort range', hintZh: 'WCA 复办年起,1982 唯一一场不纳入 cohort 分组', hintEn: 'From the WCA-revival year; the lone 1982 comp is not a cohort here'
    },
    { value: '生涯累积', labelZh: '排名口径', labelEn: 'Ranking metric', hintZh: '取每人到今天为止的 PB,不是某一年内的最佳', hintEn: 'Lifetime PB to date — not best-within-year'
    },
    { value: 'wr / cr', labelZh: '两列预排好', labelEn: 'Two ranks stored', hintZh: 'world_rank / country_rank 都预计算,按 country 切换无需重排', hintEn: 'world_rank + country_rank precomputed — country toggle = re-pick column'
    },
  ],
  sourceZh: [
    'CI 端先扫一次 `results JOIN competitions` 算每人 `first_comp_date`,再在主循环里按 cohort 分组对生涯累积 PB 排序,`assignRanks()` 同分并列同名次,落到 `wca_cohort_ranks(cohort_year, event_id, is_avg, wca_id, value, country_id, world_rank, country_rank)`。',
  ],
  sourceEn: [
    'CI first scans `results JOIN competitions` to derive each person\'s `first_comp_date`. In the main event loop, lifetime-best per person gets bucketed by cohort and sorted; `assignRanks()` handles ties (equal value → equal rank). Result lands in `wca_cohort_ranks(cohort_year, event_id, is_avg, wca_id, value, country_id, world_rank, country_rank)`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT cr.wca_id, cr.value, cr.country_id, co.iso2,
       cr.world_rank, cr.country_rank, p.name
FROM wca_cohort_ranks cr
JOIN wca_persons p ON p.wca_id = cr.wca_id
LEFT JOIN wca_countries co ON co.id = cr.country_id
WHERE cr.cohort_year = ?
  AND cr.event_id = ?
  AND cr.is_avg = ?
  ${'/* AND cr.country_id = ? */'}
ORDER BY cr.world_rank ASC, cr.wca_id ASC
LIMIT ? OFFSET ?;`,
  },
  steps: [
    {
      titleZh: '算每人 first_comp_date',
      titleEn: 'Derive each person\'s first_comp_date',
      bodyZh: '`SELECT r.person_id, r.competition_id, c.start_date FROM results r JOIN competitions c ORDER BY c.start_date, r.competition_id` 顺扫,per pid 留最早一行 → `firstComp.get(pid).year` 当作 cohort。',
      bodyEn: '`SELECT r.person_id, r.competition_id, c.start_date FROM results r JOIN competitions c ORDER BY c.start_date, r.competition_id`, then keep the first row per person → `firstComp.get(pid).year` is the cohort.'
    },
    {
      titleZh: '生涯累积 PB',
      titleEn: 'Carry forward lifetime PB',
      bodyZh: '主循环按 event 处理 `results`(按 `start_date, id` 升序),per (event, person) 维护 `Acc { best, avg, country }`,只在严格更小时更新。结果 = 每人到今天为止的 single PB / average PB。',
      bodyEn: 'The main loop iterates `results` per event (sorted by `start_date, id`), maintaining `Acc { best, avg, country }` per (event, person), updating on strict improvement. Net result: every person\'s lifetime single PB / average PB.'
    },
    {
      titleZh: '按 cohort 分桶 + 排名',
      titleEn: 'Bucket by cohort, rank',
      bodyZh: '`for (cohortYear, persons in cohort)`:`sort by val ASC`,`assignRanks()` 同时给 `world_rank`(列表整体)和 `country_rank`(同国内子计数器)。同分并列 — `wr` 不增加,但 cohort 总计数继续。',
      bodyEn: 'For each `(cohortYear, persons_in_cohort)` group: sort by `val ASC`, then `assignRanks()` assigns both `world_rank` (over the full list) and `country_rank` (per-country running counter). Ties share a rank but the running counter keeps stepping.'
    },
    {
      titleZh: '查询时选 world_rank 或 country_rank 排序',
      titleEn: 'At query time, sort by world_rank or country_rank',
      bodyZh: '`/v1/wca/cohort-ranks?cohort=&event=&type=&country=` 走 `coh_world` 或 `coh_country` 索引。`country` 给定 → `ORDER BY country_rank` 且加 `country_id = ?` 过滤;否则 `ORDER BY world_rank`。',
      bodyEn: '`/v1/wca/cohort-ranks?cohort=&event=&type=&country=` rides either `coh_world` or `coh_country`. With `country` set, `ORDER BY country_rank` plus `country_id = ?`; otherwise `ORDER BY world_rank`.',
      highlight: true
    },
  ],
  edgesZh: [
    'cohort = **首参赛年**,与选手出生年 / 注册 WCA-ID 年都无关 — 一个 2018 第一次比赛的选手永远是 2018 届,即便有 2019 改的 WCA-ID 也不变。',
    '生涯累积 = 今天为止,不是 cohort 当年内 — "2010 届的 333 第一"看的是这个人至今 PB,不是他 2010 年内的成绩。',
    '`333mbf` 没有 average — `type=average` 400,与 all-results 同口径。',
    '同分并列(`assignRanks()` 用 `prevVal` 比较);PG 端 ORDER BY 加 `wca_id ASC` 兜底,翻页稳定。',
  ],
  edgesEn: [
    'Cohort = **year of first comp**, unrelated to birth year or WCA-ID issue date — someone whose first comp is 2018 stays in the 2018 cohort even if their WCA-ID was issued in 2019.',
    'Lifetime cumulative = up to today, NOT confined to the cohort year — "fastest of 2010" uses today\'s PB, not their 2010-season best.',
    '`333mbf` has no average — `type=average` returns 400, same as all-results.',
    'Ties share a rank (`assignRanks()` compares `prevVal`); PG ORDER BY adds `wca_id ASC` for stable pagination.',
  ],
  related: [
    { id: 'all-results', titleZh: '全部成绩排名', titleEn: 'All Results', hintZh: '同源数据,不分 cohort 的全局视图', hintEn: 'Same source, global view without cohort bucketing'
    },
    { id: 'sum-of-ranks', titleZh: '全项目排名', titleEn: 'Sum of Ranks', hintZh: '世界排名衍生指标 — 17 项相加', hintEn: 'Another rank-derived metric — sums world ranks across 17 events'
    },
    { id: 'cohort-ranks', toStat: true, titleZh: '直接打开届别排名', titleEn: 'Open the cohort table', hintZh: '看届别 / 项目 / 国家切换', hintEn: 'Live table — cohort / event / country switches'
    },
  ]
};

// ──── success-rate ─────────────────────────────────────────────────────────
const success_rate: AboutEntry = {
  id: 'success-rate',
  titleZh: '项目成功率 — solved / attempted',
  titleEn: 'Success Rate — solved ÷ attempted',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '每人每项目算一个比率:`solved / attempted`,其中 `attempted` 计入所有非 DNS 的 `best`(`best != 0`,含 DNF 和 valid),`solved` 只数 `best > 0`(valid)。直观地说就是"举手了的次数里成功的占比"。',
    '主要用在盲拧 / FMC / 大盲这种高 DNF 项目 — `333bf` 默认进页面,3 次起步就能上榜。每项目排名按 `pct_x10000` 降序,同分再按 `attempted` 降序(尝试多的同分排前)。',
  ],
  introEn: [
    'Per person, per event: `solved / attempted`. `attempted` counts every non-DNS `best` (i.e. `best != 0`, including DNFs); `solved` counts only `best > 0` (valid). Intuitively: "of all times they showed up to the table, what fraction stuck".',
    'Mainly used for blind / FMC / big-blind — high-DNF events. `333bf` is the default; minimum 3 attempts to qualify. Leaderboard sorts by `pct_x10000` descending, tie-broken by `attempted` descending (more tries at the same percentage wins).',
  ],
  stats: [
    { value: '~2 M', labelZh: '行数', labelEn: 'Rows', hintZh: '每 (event, person, attempted ≥ 3)', hintEn: 'One row per (event, person) with attempted ≥ 3'
    },
    { value: '≥ 3', labelZh: '最小尝试', labelEn: 'Min attempts', hintZh: '默认门槛,API 可调高', hintEn: 'Default floor; API param lets you raise it'
    },
    { value: 'pct × 10⁴', labelZh: '存整数', labelEn: 'Stored as integer', hintZh: '9999 = 99.99%,稳定排序', hintEn: '9999 = 99.99% — stable integer sort'
    },
    { value: 'DNS 排除', labelZh: 'best = 0 跳过', labelEn: 'best = 0 skipped', hintZh: '没动手不算 attempted', hintEn: 'Not-attempted rows don\'t count'
    },
  ],
  sourceZh: [
    'CI 在主循环里 per `(event, person)` 维护 `[solved, attempted]`:`if (r.best > 0) solved++; if (r.best !== 0) attempted++`。整 17 项扫完一次性写 `wca_success_rate(event_id, wca_id, country_id, solved, attempted, pct_x10000)`,`pct_x10000 = round(solved/attempted * 10000)`。`attempted < 3` 直接不输出。',
  ],
  sourceEn: [
    'In the main event loop, per `(event, person)`: `if (r.best > 0) solved++; if (r.best !== 0) attempted++`. After all 17 events, dump to `wca_success_rate(event_id, wca_id, country_id, solved, attempted, pct_x10000)` where `pct_x10000 = round(solved/attempted * 10000)`. Rows with `attempted < 3` are dropped.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT sr.wca_id, sr.country_id, co.iso2,
       sr.solved, sr.attempted, sr.pct_x10000, p.name
FROM wca_success_rate sr
JOIN wca_persons p ON p.wca_id = sr.wca_id
LEFT JOIN wca_countries co ON co.id = sr.country_id
WHERE sr.event_id = ?
  AND sr.attempted >= ?
ORDER BY sr.pct_x10000 DESC,
         sr.attempted DESC,
         sr.wca_id ASC
LIMIT ? OFFSET ?;`,
  },
  formulae: [
    {
      labelZh: '公式',
      labelEn: 'Formula',
      expr: 'pct = solved / attempted,  attempted = #{r : r.best ≠ 0},  solved = #{r : r.best > 0}',
      bodyZh: '`r.best = 0` 是 DNS(根本没尝试),不进分母;`r.best = -1` 是 DNF(尝试了但失败),进分母不进分子。',
      bodyEn: '`r.best = 0` means "did not start" — excluded from the denominator. `r.best = -1` means DNF — counted in the denominator but not the numerator.'
    },
  ],
  steps: [
    {
      titleZh: '逐 result 扫,只看 best',
      titleEn: 'Iterate results, look at best only',
      bodyZh: 'CI 主循环里每行 `result` 检查 `r.best`:`0` → skip(DNS);`-1` → `attempted++`(DNF);`> 0` → `solved++; attempted++`。average 列在这里**不参与**计数。',
      bodyEn: 'In the CI event loop, inspect `r.best`: `0` → skip (DNS); `-1` → `attempted++` (DNF); `> 0` → `solved++; attempted++`. The `average` column is **not** factored in here.'
    },
    {
      titleZh: '按 (event, person) 累计',
      titleEn: 'Accumulate per (event, person)',
      bodyZh: '`successAcc: Map<event, Map<pid, [solved, attempted]>>`。同人同项目的所有比赛所有轮次都加在一起 — 没有时间窗 / cohort 切片。',
      bodyEn: '`successAcc: Map<event, Map<pid, [solved, attempted]>>`. All rounds across all comps for the same `(event, person)` aggregate into one cell — no time window or cohort slicing.'
    },
    {
      titleZh: '过滤 + 百分比定点化',
      titleEn: 'Filter, fixed-point percentage',
      bodyZh: '`attempted < 3` 丢掉(避免一次 fluke);`pct_x10000 = round(solved/attempted * 10000)`,稳定整数排序避免浮点同分判定漂移。',
      bodyEn: 'Drop `attempted < 3` (avoid one-fluke entries); `pct_x10000 = round(solved/attempted * 10000)` — stable integer ordering, no float-equality drift on ties.'
    },
    {
      titleZh: '查询端复合排序',
      titleEn: 'Compound sort at query time',
      bodyZh: '`ORDER BY pct_x10000 DESC, attempted DESC, wca_id ASC`:同百分比下尝试多的优先(更可信);最后 `wca_id` 兜底翻页稳定。`sr_event` / `sr_event_country` 索引覆盖。',
      bodyEn: '`ORDER BY pct_x10000 DESC, attempted DESC, wca_id ASC`: at equal percentage, more tries wins (more reliable); `wca_id` is the stable-pagination tiebreaker. Covered by `sr_event` / `sr_event_country`.',
      highlight: true
    },
  ],
  edgesZh: [
    '`r.best = 0` 是 WCA 编码里的 DNS(Did Not Start),不能跟 DNF 混。`attempted` 不计入 DNS — 否则一个登记了但没上手的轮次会拖低比例。',
    'attempts(5 次 raw)不直接看 — 用最终 `best`。一个 attempts = [4321, -1, -1, -1, -1] 的轮次 `best = 4321 > 0`,算 1 个 solved + 1 个 attempted。',
    '不区分 single / average。333bf / 444bf / 555bf / 333mbf 这类项目的 average 行根本不存在(WCA 规则),mo3 也是聚合统计形式,这里只看 best。',
    '榜单按百分比看是高分高;不同项目 baseline 差异大 — 333 几乎人均 99%+,333mbf 60% 已是顶级。',
  ],
  edgesEn: [
    '`r.best = 0` is DNS (Did Not Start) in WCA encoding — distinct from DNF. DNS doesn\'t count as `attempted`, otherwise registering and no-showing would tank your ratio.',
    'We don\'t inspect raw attempts — we use the final `best`. A round with attempts = [4321, -1, -1, -1, -1] has `best = 4321 > 0`, so 1 solved + 1 attempted.',
    'Not split by single vs average. Blind events (333bf / 444bf / 555bf / 333mbf) have no average rows by WCA rule; mo3 is the format. We just count best rows.',
    'Higher = better; baselines vary wildly across events — near-100% for 333, ~60% is elite for 333mbf.',
  ],
  related: [
    { id: 'dnf_rate_by_event', titleZh: 'DNF 率(按项目)', titleEn: 'DNF rate by event', hintZh: '整体角度 — 同样的数据按事件聚合', hintEn: 'Event-level aggregate of the same numerator/denominator'
    },
    { id: 'most_solves_before_bld_success', titleZh: '盲拧首成功前 DNF 数', titleEn: 'DNFs before first BLD success', hintZh: '盲拧专属姐妹指标 — 首成功的尝试代价', hintEn: 'BLD-specific sibling — DNFs before the first valid solve'
    },
    { id: 'success-rate', toStat: true, titleZh: '直接打开成功率榜', titleEn: 'Open the Success Rate table', hintZh: '看默认 333bf + 项目切换 + 国家过滤', hintEn: 'Live table — defaults to 333bf, event + country pickers'
    },
  ]
};

// ──── all-events-done ──────────────────────────────────────────────────────
const all_events_done: AboutEntry = {
  id: 'all-events-done',
  titleZh: '全项目达成 — 集齐 17 项所用的天数',
  titleEn: 'All Events Done — days from first comp to all 17 events checked off',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '一个人需要多久 — 从他/她的首场 WCA 比赛起算 — 才能在**当前 17 个官方项目**里每项都至少有一次 valid 成绩(`best > 0`)?这个"首次集齐"的最早日期减去首参赛日期就是 `days_to_complete`。',
    '页面默认按 `days_to_complete ASC` 排,看"最快全勤"。未集齐的人(`is_done = FALSE`)按 `done_count` 降序排,看离全勤还差几项。',
  ],
  introEn: [
    'How long does it take, counting from a person\'s first WCA competition, to post at least one valid result (`best > 0`) in **every one of the 17 currently-active events**? `days_to_complete` is the earliest such "all done" date minus their first-comp date.',
    'Default sort is `days_to_complete ASC` — fastest to full sweep. Incomplete people (`is_done = FALSE`) sort by `done_count` descending — how close to the finish line.',
  ],
  stats: [
    { value: '17', labelZh: '目标项目', labelEn: 'Target events', hintZh: 'ACTIVE_EVENTS 当下口径,废止项目不计', hintEn: 'Current ACTIVE_EVENTS set — discontinued events not counted'
    },
    { value: '~150 k', labelZh: '行数', labelEn: 'Rows', hintZh: '每个参加过 WCA 的人一行', hintEn: 'One row per person with any WCA result'
    },
    { value: 'best > 0', labelZh: '达成口径', labelEn: 'Done criterion', hintZh: '一次 valid single 就算这个项目达成', hintEn: 'Any single valid result counts the event as done'
    },
    { value: 'max(date)', labelZh: '达成日 = 17 个首达成日的最晚', labelEn: 'Achievement date = max of 17 firsts', hintZh: '最后一项的首达成日就是大功告成日', hintEn: 'Latest first-result among the 17 events seals the achievement'
    },
  ],
  sourceZh: [
    'CI 端 per `(person, event ∈ ACTIVE_EVENTS)` 维护一个 `first_done_date`,在主循环里看到 `r.best > 0` 时取 `min(curr, r.compDate)`。扫完后每人有 17 个日期数组,`doneCount = 非空数`,`isDone = (doneCount === 17)`,`maxDate = max(那 17 个)`,`days_to_complete = (maxDate − first_comp_date)`。',
  ],
  sourceEn: [
    'CI maintains per `(person, event ∈ ACTIVE_EVENTS)` a `first_done_date`. In the main loop, when `r.best > 0`, take `min(curr, r.compDate)`. After scanning all events: each person has 17 dates → `doneCount = non-empty count`, `isDone = (doneCount === 17)`, `maxDate = max(those 17)`, `days_to_complete = (maxDate − first_comp_date)`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT aed.wca_id, aed.country_id, co.iso2,
       aed.done_count, aed.is_done,
       aed.first_comp_id, aed.first_comp_date,
       aed.achievement_comp_id, aed.achievement_comp_date,
       ac.name AS achievement_comp_name,
       aed.days_to_complete, aed.total_comp_count, p.name
FROM wca_all_events_done aed
JOIN wca_persons p ON p.wca_id = aed.wca_id
LEFT JOIN wca_competitions ac ON ac.id = aed.achievement_comp_id
WHERE aed.is_done = TRUE
ORDER BY aed.days_to_complete ASC, aed.wca_id ASC
LIMIT ? OFFSET ?;`,
  },
  formulae: [
    {
      labelZh: '公式',
      labelEn: 'Formula',
      expr: 'days = max₍e ∈ 17₎ firstDone(p, e) − firstComp(p)',
      bodyZh: '`firstDone(p, e)` = 选手 p 在项目 e 上首次 `best > 0` 的比赛日期;若有任一项目无成绩 → 全无定义,`is_done = FALSE` 且 `days_to_complete IS NULL`。',
      bodyEn: '`firstDone(p, e)` = the comp date of person p\'s first `best > 0` in event e; if any of the 17 is missing → undefined overall, with `is_done = FALSE` and `days_to_complete IS NULL`.'
    },
  ],
  steps: [
    {
      titleZh: '识别首参赛日 / 项目',
      titleEn: 'Resolve first-comp date and id',
      bodyZh: 'CI 预扫一次 `results JOIN competitions ORDER BY start_date, comp_id`,per pid 留最早一行 → `firstComp.compId / date / year`。后续 `personCompSet` 同时收集所有参赛 comp 用于 `total_comp_count`。',
      bodyEn: 'CI presweep: `results JOIN competitions ORDER BY start_date, comp_id`, keep the earliest row per pid → `firstComp.compId / date / year`. `personCompSet` simultaneously tracks all attended comps for `total_comp_count`.'
    },
    {
      titleZh: '17 项 first-done 数组',
      titleEn: '17-slot first-done array',
      bodyZh: '主循环里,`r.best > 0 && eventIdx != null` 时:`personEventFirstDone[pid][eventIdx]` 没值就填,有值且 `r.compDate < curr` 就更新。`eventIdx` 来自 `EVENT_INDEX`(对齐 `ACTIVE_EVENTS` 顺序)。',
      bodyEn: 'In the main loop, when `r.best > 0 && eventIdx != null`: fill `personEventFirstDone[pid][eventIdx]` if empty, or overwrite when `r.compDate < curr`. `eventIdx` comes from `EVENT_INDEX`, aligned with `ACTIVE_EVENTS` order.'
    },
    {
      titleZh: '聚合 done_count + maxDate',
      titleEn: 'Aggregate done_count + maxDate',
      bodyZh: '扫完所有 event 后,per pid 对 17 元数组算:`doneCount = 非空数`,`maxDate = 最晚日期`,`isDone = (doneCount === 17)`。',
      bodyEn: 'After all events scanned, per pid the 17-element array yields `doneCount = non-empty count`, `maxDate = latest of those dates`, `isDone = (doneCount === 17)`.'
    },
    {
      titleZh: '回查达成比赛',
      titleEn: 'Locate the achievement comp',
      bodyZh: '`isDone` 时在 `personCompSet[pid]` 里找 `compInfo.startDate === maxDate` 的任一 comp → `achievementCompId`;`daysToComplete = floor((maxDate − firstCompDate) / 86400000)`。',
      bodyEn: 'When `isDone`, scan `personCompSet[pid]` for any comp whose `compInfo.startDate === maxDate` → `achievementCompId`. Then `daysToComplete = floor((maxDate − firstCompDate) / 86400000)`.'
    },
    {
      titleZh: '查询端两种排序',
      titleEn: 'Two sort orders at query time',
      bodyZh: '`/v1/wca/all-events-done?onlyDone=&country=`:`onlyDone=1`(默认) → `days_to_complete ASC`;`onlyDone=0` 全集 → `done_count DESC, days_to_complete ASC NULLS LAST`。`aed_done` / `aed_country_done` 索引覆盖。',
      bodyEn: '`/v1/wca/all-events-done?onlyDone=&country=`: `onlyDone=1` (default) → `days_to_complete ASC`. `onlyDone=0` (full set) → `done_count DESC, days_to_complete ASC NULLS LAST`. Covered by `aed_done` / `aed_country_done`.',
      highlight: true
    },
  ],
  edgesZh: [
    '"17 项" 是**今天**的口径(`ACTIVE_EVENTS`)。Magic / Master Magic / 333ft / 333mbo 等已废止项目不计 — 历史上没人需要拧 21 项才算"全勤"。',
    '只要 single 有效就算 — 不要求 average。这对盲拧 / 大盲(没 average 的项目)友好,否则 `333mbf` 永远算不上。',
    '同一项目的"首次有效"取最早 — 一个选手 2008 年 4x4 DNF / 2010 才 valid,我们把 2010 那场算成 `firstDone[4x4]`。',
    '`country` 过滤是按选手**当前**国籍(`country_id`),不是首参赛时国籍 — 换国籍的选手会跟着挪。',
  ],
  edgesEn: [
    '"17 events" is **today\'s** set (`ACTIVE_EVENTS`). Magic / Master Magic / 333ft / 333mbo and other discontinued events are out — no one historically had to clear 21 events to count as "full sweep".',
    'Singles only — average not required. Friendly to blind / multi-blind (no average rows), otherwise `333mbf` would lock everyone out.',
    'First-valid takes the **earliest** valid result — someone who DNF\'d 4x4 in 2008 and only solved valid in 2010 has `firstDone[4x4] = 2010`.',
    '`country` filter uses **current** nationality (`country_id`), not nationality at first comp — citizenship changes follow.',
  ],
  related: [
    { id: 'shortest_time_to_get_all_singles', titleZh: '集齐所有 single 的最短用时', titleEn: 'Shortest time to get all singles', hintZh: 'stats-build 老指标,同概念另一种实现', hintEn: 'Equivalent stats-build classic — parallel implementation of the same idea'
    },
    { id: 'shortest_time_to_get_all_singles_and_averages', titleZh: '集齐所有 single + average', titleEn: 'Shortest time, singles + averages', hintZh: '更严格版本 — 还要每项 average 也至少一次', hintEn: 'Stricter sibling — additionally requires an average in each event'
    },
    { id: 'grand-slam', titleZh: '大满贯', titleEn: 'Grand Slam', hintZh: '另一个"全能"维度 — 三级冠军 + WR', hintEn: 'Another all-rounder lens — three-tier podiums + WR'
    },
    { id: 'all-events-done', toStat: true, titleZh: '直接打开全项目达成榜', titleEn: 'Open the All Events Done table', hintZh: '看默认 onlyDone 模式 + 国家切换', hintEn: 'Live table — default onlyDone view + country switcher'
    },
  ]
};

// ──── sum-of-ranks ─────────────────────────────────────────────────────────
const sum_of_ranks: AboutEntry = {
  id: 'sum-of-ranks',
  titleZh: '全项目排名 — 17 项世界排名之和',
  titleEn: 'Sum of Ranks — sum of world ranks across all 17 events',
  badgeZh: '排名',
  badgeEn: 'Ranking',
  introZh: [
    '每个选手在 17 个官方项目里各有一个世界排名(没成绩的项目用"该项目参赛人数 + 1"作为惩罚),把这 17 个数加起来就是 Sum of Ranks。**越小越全能** — 数值低代表又多又强。',
    '默认按全 17 项 single 排;`type=average` 切到 average 视图,`country` 给定时换成 country_rank 之和;`events` 参数可以挑子集(`333,222,444`)。子集模式用 CTE 实时算每个项目的参赛人数,缺项的"参赛人数 + 1"也走子集的范围。',
  ],
  introEn: [
    'For each person, every one of the 17 official events has a world rank (events without any result get a penalty rank of "participants + 1"). The sum across all 17 is Sum of Ranks. **Lower = more well-rounded** — small number means broad + strong.',
    'Default view = all 17 events × single. `type=average` flips to averages, `country` swaps in country_rank sums, and `events` lets you pick a subset (e.g. `333,222,444`). Subset mode uses a CTE to count participants per event inline; the "participants + 1" penalty for missing events is computed within the chosen scope.',
  ],
  stats: [
    { value: '17', labelZh: '事件位', labelEn: 'Event slots', hintZh: '与 ACTIVE_EVENTS 一一对应,固定顺序', hintEn: 'One per ACTIVE_EVENTS slot, fixed order'
    },
    { value: '~300 k', labelZh: '行数', labelEn: 'Rows', hintZh: 'person × (single|average)', hintEn: 'One row per (person, is_avg)'
    },
    { value: 'participants + 1', labelZh: '缺项惩罚', labelEn: 'Missing-event penalty', hintZh: '比该项目最后一名再差一名', hintEn: 'One worse than the last-ranked competitor of that event'
    },
    { value: 'wr / cr', labelZh: '存两套排名', labelEn: 'Two rank arrays', hintZh: 'ranks_world + ranks_country 各 17 元素', hintEn: 'ranks_world + ranks_country — 17 INTEGER[] each'
    },
  ],
  sourceZh: [
    'CI 端先 `accByEvent[event] → Acc { best, avg }` 累积每人每项 PB,然后对每个 event 各跑一次 `assignRanks(sortedList)` 同时给 world_rank + country_rank;最后 per person 把 17 项的 wr / cr 装进 `INTEGER[]`,缺项当场补 `participants + 1` 计入 total。**领奖台过滤**走 `best_final_pos`(跨所有 event 的 final round MIN(pos)):未登台 = `=0 OR >3`。落 `wca_person_ranks(wca_id, is_avg, country_id, events_done, total_world_rank, total_country_rank, best_final_pos, ranks_world[], ranks_country[])`。',
  ],
  sourceEn: [
    'CI accumulates per-event PB via `accByEvent[event] → Acc { best, avg }`. For each event, `assignRanks(sortedList)` assigns both world_rank + country_rank in one pass. Per person, the 17 ranks land in two `INTEGER[]` columns; missing events absorb a `participants + 1` penalty in the precomputed total. **Podium filtering** uses `best_final_pos` (MIN(pos>0) across every event\'s final-round results): no-podium = `=0 OR >3`, fourth-place king = `=4`. Stored in `wca_person_ranks(wca_id, is_avg, country_id, events_done, total_world_rank, total_country_rank, best_final_pos, ranks_world[], ranks_country[])`.',
  ],
  sourceCode: {
    lang: 'sql',
    captionZh: '子集模式 — CTE 算每个选中项目的参赛人数,缺项 fallback 到 ep.pX + 1',
    captionEn: 'Subset mode — CTE counts participants per selected event; missing slots fall back to ep.pX + 1',
    body: `WITH ep AS (
  SELECT SUM(CASE WHEN ranks_world[1] > 0 THEN 1 ELSE 0 END) AS p0,
         SUM(CASE WHEN ranks_world[2] > 0 THEN 1 ELSE 0 END) AS p1
         /* ... more selected events ... */
  FROM wca_person_ranks WHERE is_avg = ?
)
SELECT pr.wca_id, p.name, pr.ranks_world,
       (CASE WHEN pr.ranks_world[1] > 0 THEN pr.ranks_world[1] ELSE ep.p0 + 1 END
      + CASE WHEN pr.ranks_world[2] > 0 THEN pr.ranks_world[2] ELSE ep.p1 + 1 END
       /* ... */) AS subset_total
FROM wca_person_ranks pr CROSS JOIN ep
JOIN wca_persons p ON p.wca_id = pr.wca_id
WHERE pr.is_avg = ?
ORDER BY subset_total ASC;`
},
  formulae: [
    {
      labelZh: '公式',
      labelEn: 'Formula',
      expr: 'totalRank(p) = Σₑ (rank(p, e)  if rank > 0 else participants(e) + 1)',
      bodyZh: '`e` 跑遍 17 项(或子集);`rank(p, e) = 0` 表示该项目无成绩,fallback 到"参赛人数 + 1"(比最后一名再差一名)。',
      bodyEn: '`e` ranges over all 17 events (or chosen subset). `rank(p, e) = 0` indicates no result in that event, fallback to "participants + 1" (one worse than the bottom-ranked competitor).'
    },
  ],
  steps: [
    {
      titleZh: '17 项各自排一次',
      titleEn: 'Rank each event once',
      bodyZh: 'per `ACTIVE_EVENTS[i]`,从 `accByEvent` 取 `Acc`,sort by PB,`assignRanks()` 给同分并列 world_rank + country_rank。`eventParticipantsSingle[i]` / `eventParticipantsAvg[i]` 记参赛人数。',
      bodyEn: 'For each `ACTIVE_EVENTS[i]`, pull `Acc` from `accByEvent`, sort by PB, run `assignRanks()` to assign world + country rank with tie handling. `eventParticipantsSingle[i]` / `eventParticipantsAvg[i]` remember each event\'s competitor count.'
    },
    {
      titleZh: '装 17 元数组 + 缺项惩罚',
      titleEn: 'Build 17-slot arrays + missing penalty',
      bodyZh: 'per (pid, is_avg):17 元数组 `ranksW[i] = eventRanks[i].get(pid)?.wr ?? 0`(同 ranksC);total 加的是 `wr` 或缺项时的 `participants + 1`。`333mbf` 无 average → average 视图里该位永远 0 且跳过累加。',
      bodyEn: 'Per (pid, is_avg): build 17-slot `ranksW[i] = eventRanks[i].get(pid)?.wr ?? 0` (likewise `ranksC`). The total adds either `wr` or the `participants + 1` penalty for missing slots. `333mbf` has no average — that slot stays 0 and is skipped in the average-view total.'
    },
    {
      titleZh: '记 best_final_pos / events_done',
      titleEn: 'Record best_final_pos / events_done',
      bodyZh: '主循环每条 result 命中 `round_type_id IN (\'c\', \'f\')` 且 `pos > 0` 时,跨 event 更新该人的 `best_final_pos = MIN(pos)`。0 = 从未在任何 final 拿过有效成绩。`events_done` 计 `wr > 0` 的项目数。`/v1/wca/sum-of-ranks?hidePodium=1` → `best_final_pos = 0 OR > 3`。',
      bodyEn: 'In the main loop, every result with `round_type_id IN (\'c\', \'f\')` and `pos > 0` updates that person\'s `best_final_pos = MIN(pos)` across events. 0 = never produced a valid final-round result. `events_done` counts slots with `wr > 0`. `/v1/wca/sum-of-ranks?hidePodium=1` → `best_final_pos = 0 OR > 3`.'
    },
    {
      titleZh: '全 17 项 → 走预计算列',
      titleEn: 'All 17 events → use precomputed total',
      bodyZh: '默认没传 `events`(或传了全集):`ORDER BY total_world_rank`(无 country)或 `total_country_rank`(有 country),走 `pr_total` / `pr_country_total` 索引,毫秒级。',
      bodyEn: 'No `events` param (or all 17): `ORDER BY total_world_rank` (no country) or `total_country_rank` (with country), riding `pr_total` / `pr_country_total`. Sub-millisecond.'
    },
    {
      titleZh: '子集 → CTE + array indexing 实时算',
      titleEn: 'Subset → CTE + array indexing on the fly',
      bodyZh: '`events` 传了真子集:CTE `ep` 算每个选中项目的参赛人数;主查询用 `CASE WHEN ranks_X[i+1] > 0 THEN ... ELSE ep.pX + 1 END` 累加 `subset_total`,再 `ORDER BY` 它。CTE 不受 `hidePodium` 影响 — 参赛人数是固有属性。',
      bodyEn: 'A real subset was passed: CTE `ep` counts participants per selected event; the main query builds `subset_total` with `CASE WHEN ranks_X[i+1] > 0 THEN ... ELSE ep.pX + 1 END` and `ORDER BY subset_total ASC`. The CTE is **not** affected by `hidePodium` — participant count is intrinsic to the event.',
      highlight: true
    },
  ],
  edgesZh: [
    '`333mbf` 在 average 视图里**跳过**,不参与累加 — 它没有 average 这种概念;真用 17 项的 average sum 会让它单挑一类人。',
    '缺项惩罚 = 该项目"参赛人数 + 1",不是固定大数。这避免冷门项目(参赛人数少)和热门项目权重失衡 — 跳过 333 损失约 30 万排名,跳过 333mbf 只损失几千。',
    '`hidePodium` 只过滤主查询行,不改 CTE 的参赛人数 — 否则隐藏一个 podium 选手会让其他人的"缺项罚"变小,语义混乱。',
    '`country` 给定 → ORDER BY `total_country_rank`,返回的 `ranks` 数组也切到 `ranks_country` — 同一行下"按国家看排名"是一致 view。',
  ],
  edgesEn: [
    '`333mbf` is **skipped** in the average view — there\'s no average concept for it; summing 17 averages would single it out as a class of its own.',
    'Missing-event penalty = that event\'s "participants + 1", not a fixed large number. Prevents weighting imbalance between rare events (few participants) and crowded ones — skipping 333 costs ~300k ranks, skipping 333mbf costs a few thousand.',
    '`hidePodium` filters the main query rows but does **not** affect the CTE\'s participant count — otherwise hiding a podium person would shrink everyone else\'s missing-event penalty, garbled semantics.',
    'With `country` set, both `ORDER BY total_country_rank` and the returned `ranks` array switches to `ranks_country` — single consistent "national view" within the row.',
  ],
  related: [
    { id: 'grand-slam', titleZh: '大满贯', titleEn: 'Grand Slam', hintZh: '另一种"全能"过滤 — 看顶尖一行;sum-of-ranks 看分布', hintEn: 'Sibling all-rounder filter — Grand Slam is the elite cut; sum-of-ranks shows the spread'
    },
    { id: 'all-events-done', titleZh: '全项目达成', titleEn: 'All Events Done', hintZh: '前置条件 — 没集齐 17 项,sum 里会扛缺项惩罚', hintEn: 'Precondition — anyone short of 17 events eats the missing-event penalty here'
    },
    { id: 'cohort-ranks', titleZh: '参赛届别排名', titleEn: 'Cohort Ranks', hintZh: '单项目按届别看,sum-of-ranks 全项目无届别', hintEn: 'Single event by cohort; sum-of-ranks aggregates all events without cohorting'
    },
    { id: 'sum-of-ranks', toStat: true, statHref: '/wca/all-results?events=all', titleZh: '直接打开 Sum of Ranks', titleEn: 'Open Sum of Ranks', hintZh: '看默认 17 项 + 子集 picker + hidePodium 切换', hintEn: 'Live table — default 17 events + subset picker + hidePodium toggle'
    },
  ]
};

export const LOOKUP_ABOUT: Record<string, AboutEntry> = {
  'grand-slam': grand_slam,
  'all-results': all_results,
  'cohort-ranks': cohort_ranks,
  'success-rate': success_rate,
  'all-events-done': all_events_done,
  'sum-of-ranks': sum_of_ranks,
};
