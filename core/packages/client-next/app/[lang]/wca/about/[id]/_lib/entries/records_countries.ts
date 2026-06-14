// 纪录与国家 — about entries
import type { AboutEntry } from '../types';

// ──── best_medal_collection_from_abroad_by_country ──────────────────────────
const best_medal_collection_from_abroad_by_country: AboutEntry = {
  id: 'best_medal_collection_from_abroad_by_country',
  titleZh: '各国海外最佳奖牌收藏',
  titleEn: 'Best medal collection from abroad by country',
  badgeZh: '国家',
  badgeEn: 'Country',
  introZh: [
    '统计**每个国家的选手在本国之外**比赛上拿到的金 / 银 / 铜数。"本国"判定基于选手国籍 (`results.country_id`) 与比赛举办国 (`competitions.country_id`) 的对比 —— 不一致即"海外"。',
    '这是衡量一个国家"远征实力"的硬指标:常驻强国主场刷牌简单,真到客场能拿牌才说明选手层厚。',
  ],
  introEn: [
    'Counts gold / silver / bronze each country\'s competitors have earned **outside their home country**. "Abroad" is decided by comparing the cuber\'s national identity (`results.country_id`) against the competition\'s host country (`competitions.country_id`).',
    'It measures away-game depth: home medals are easy for established regions; medals abroad require a real talent pool willing and able to travel.',
  ],
  stats: [
    { value: '金 > 银 > 铜', labelZh: '排序口径', labelEn: 'Sort key', hintZh: '先金牌降序,平了看银 / 铜', hintEn: 'Golds desc, silver / bronze tiebreaker'
    },
    { value: '`pos ∈ {1,2,3}`', labelZh: '领奖台判定', labelEn: 'Podium check', hintZh: '直接读 `results.pos`(WCA 已算好)', hintEn: 'Reads `results.pos` (WCA-precomputed)'
    },
    { value: '`c / f` 轮次', labelZh: '只看决赛', labelEn: 'Final rounds only', hintZh: 'Final + Combined Final', hintEn: 'Final + Combined Final'
    },
    { value: '`best > 0`', labelZh: '排 DNF', labelEn: 'DNF filter', hintZh: 'best ≤ 0 = DNF / DNS / 未提交', hintEn: 'best ≤ 0 = DNF / DNS / unattempted' },
  ],
  sourceZh: [
    '`results` 表 join `competitions`,加条件 `competition.country_id != result.country_id` 筛出海外成绩;再过 `round_type_id IN (\'c\', \'f\')` 只看决赛轮 (`f` = Final, `c` = Combined Final)。`pos` 由 WCA 在每轮 round 内预先计算 (1 / 2 / 3 / ... 名次),`pos ∈ {1,2,3}` 即领奖台。',
  ],
  sourceEn: [
    '`results` joined to `competitions` with `competition.country_id != result.country_id` to keep abroad-only rows. Restrict to final rounds via `round_type_id IN (\'c\', \'f\')` (`f` = Final, `c` = Combined Final). `pos` is WCA-precomputed per round (1 / 2 / 3 / ...); `pos ∈ {1,2,3}` means podium.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT result.country_id,
       SUM(IF(pos = 1, 1, 0)) gold,
       SUM(IF(pos = 2, 1, 0)) silver,
       SUM(IF(pos = 3, 1, 0)) bronze
FROM results
JOIN competitions ON competitions.id = competition_id
WHERE round_type_id IN ('c', 'f')
  AND best > 0
  AND competitions.country_id != results.country_id
GROUP BY result.country_id`,
  },
  steps: [
    {
      titleZh: '过滤海外决赛行',
      titleEn: 'Filter abroad final rows',
      bodyZh: '保留 `country_id` 不一致 + `round_type_id IN (c, f)` + `best > 0` 的 `results` 行 —— 即"决赛 + 完赛 + 客场"。',
      bodyEn: 'Keep `results` rows where the two `country_id` differ, the round is `c` or `f`, and `best > 0` — final, completed, away.'
    },
    {
      titleZh: '按选手国家分组',
      titleEn: 'Group by competitor country',
      bodyZh: '注意分组键是 `results.country_id` (选手国籍),不是比赛举办国。',
      bodyEn: 'Group by `results.country_id` (competitor nationality), not the host country.'
    },
    {
      titleZh: '三种奖牌分别 SUM',
      titleEn: 'Sum each medal tier',
      bodyZh: '`SUM(IF(pos = 1, 1, 0))` 数金牌,同理银 / 铜。一个领奖台 = 3 行 (3 个项目分别拿牌)。',
      bodyEn: '`SUM(IF(pos = 1, 1, 0))` for gold, similarly silver / bronze. One podium across an event = one row per medalist.'
    },
    {
      titleZh: 'join `countries` 取国名',
      titleEn: 'Join `countries` for display name',
      bodyZh: '把 `country_id` 换成可读国名;按 `gold DESC, silver DESC, bronze DESC, name` 排序 —— 经典奖牌榜规则。',
      bodyEn: 'Resolve `country_id` to a display name; sort by `gold DESC, silver DESC, bronze DESC, name` — classic medal-table rule.',
      highlight: true
    },
  ],
  edgesZh: [
    '"海外"按举办国判定,不是地理远近 —— 大陆内邻国 (中日韩互访) 也算海外。',
    '只看 Final + Combined Final 两类决赛轮 —— 预赛 / 半决名次不计入奖牌。',
    'WCA 的 `pos` 在 DNF 也会赋值 (按 best 排),所以再加 `best > 0` 排掉 "DNF 拿第一"。',
    '"奖牌"沿用 WCA 标准 —— 决赛前 3 即领奖台,即使决赛 < 8 人也算 (规则未要求最低人数)。',
  ],
  edgesEn: [
    '"Abroad" is country-of-comp vs country-of-cuber, not geographic distance — neighboring countries (CN/JP/KR cross-visits) still count.',
    'Only Final / Combined Final rounds matter — semi-final or earlier round placings are not medals.',
    'WCA assigns `pos` even to DNFs (sorted by best), so the extra `best > 0` filter strips DNF "1st place".',
    'Standard WCA medal definition — top 3 in final is a podium even if fewer than 8 competitors entered.',
  ],
  related: [
    { id: 'best_medal_collection_from_abroad_by_person', titleZh: '个人版', titleEn: 'Per-person version', hintZh: '同口径,按选手汇总', hintEn: 'Same metric, aggregated by person'
    },
    { id: 'world_championship_podiums_by_country', titleZh: '世锦赛奖牌(国家)', titleEn: 'Worlds podiums by country', hintZh: '只看世锦赛的版本', hintEn: 'Worlds-only counterpart'
    },
    { id: 'world_records_by_country', titleZh: '各国 WR 总数', titleEn: 'WRs by country', hintZh: '另一个国家维度指标', hintEn: 'Sibling country-level metric'
    },
    { id: 'best_medal_collection_from_abroad_by_country', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: '完整国家列表', hintEn: 'Full country leaderboard'
    },
  ]
};

// ──── best_medal_collection_from_abroad_by_person ───────────────────────────
const best_medal_collection_from_abroad_by_person: AboutEntry = {
  id: 'best_medal_collection_from_abroad_by_person',
  titleZh: '个人海外最佳奖牌收藏',
  titleEn: 'Best medal collection from abroad by person',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '同上,但分组键换成 `person_id` —— 一个选手在所有海外比赛累计的金 / 银 / 铜数。',
    '能上榜的基本都是"靠飞机刷牌"的远征型选手:本国比赛拿再多牌不算,只有跨境拿牌才进分子。',
  ],
  introEn: [
    'Same as the country version but grouped by `person_id` — gold / silver / bronze a single cuber has racked up at competitions outside their home country.',
    'The leaderboard is dominated by frequent-flyer travelers — home-country medals don\'t count, only cross-border podiums.',
  ],
  stats: [
    { value: '100', labelZh: '榜单长度', labelEn: 'Leaderboard size', hintZh: '`LIMIT 100`', hintEn: '`LIMIT 100`'
    },
    { value: '`sub_id = 1`', labelZh: '只取主身份', labelEn: 'Primary identity only', hintZh: '改名 / 改国籍走副 row,忽略', hintEn: 'Renames / nationality changes go to alt rows, ignored'
    },
    { value: '金 → 银 → 铜', labelZh: '排序优先级', labelEn: 'Tiebreaker order', hintZh: '同国家榜', hintEn: 'Same as country leaderboard'
    },
    { value: '决赛 + 完赛', labelZh: '入榜门槛', labelEn: 'Inclusion filter', hintZh: '`round_type_id IN (c, f)` + `best > 0`', hintEn: '`round_type_id IN (c, f)` + `best > 0`'
    },
  ],
  sourceZh: [
    '同 by_country,只是 `GROUP BY person_id`,然后 join `persons` (`sub_id = 1` 取主身份) 拿展示名。`country_id` 改名不变,但选手改国籍后副行的 `country_id` 也会跟着新,所以"海外"判定仍然准确。',
  ],
  sourceEn: [
    'Same query as the country version but `GROUP BY person_id`, then joined to `persons` (`sub_id = 1` for the primary row) for display name. Even when a cuber changes nationality the alt person row\'s `country_id` updates, so the "abroad" check stays accurate.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_id,
       SUM(IF(pos = 1, 1, 0)) gold,
       SUM(IF(pos = 2, 1, 0)) silver,
       SUM(IF(pos = 3, 1, 0)) bronze
FROM results
JOIN competitions ON competitions.id = competition_id
WHERE round_type_id IN ('c', 'f') AND best > 0
  AND competitions.country_id != results.country_id
GROUP BY person_id
ORDER BY gold DESC, silver DESC, bronze DESC LIMIT 100`,
  },
  steps: [
    {
      titleZh: '同 by_country 的 WHERE',
      titleEn: 'Same WHERE as by_country',
      bodyZh: '`round_type_id IN (c, f)` + `best > 0` + 跨国比赛过滤,沿用国家榜过滤逻辑。',
      bodyEn: 'Same `round_type_id IN (c, f)` + `best > 0` + cross-border filter as the country leaderboard.'
    },
    {
      titleZh: '`GROUP BY person_id`',
      titleEn: 'Aggregate by person',
      bodyZh: '每个选手一行;同一场比赛多个项目奖牌都计入。',
      bodyEn: 'One row per cuber; multiple medals from one comp (different events) all stack.'
    },
    {
      titleZh: 'join `persons` 取主身份',
      titleEn: 'Join `persons` for primary identity',
      bodyZh: 'WCA dump 里改名 / 国籍变化会有多行 `persons`,`sub_id = 1` 是当前展示行。',
      bodyEn: 'WCA dump stores rename / nationality changes as alt rows; `sub_id = 1` is the currently-displayed identity.'
    },
    {
      titleZh: '排序 + LIMIT 100',
      titleEn: 'Sort + LIMIT 100',
      bodyZh: '同 by_country 排序;只输出前 100 控制 JSON 体积。',
      bodyEn: 'Same sort order as the country leaderboard; capped at 100 rows to keep the JSON small.',
      highlight: true
    },
  ],
  edgesZh: [
    '选手改国籍后,旧比赛的 `result.country_id` **不会回填** —— 历史奖牌按当时国籍判定海外/主场,符合直觉。',
    '同一选手在同一比赛拿多个项目金牌会累计 (e.g. 3x3 + 2x2 + OH 都金牌 = +3 金)。',
    'Limit 100 截断意味着尾部选手在这里看不到,但完整 by_country 加总能反推。',
  ],
  edgesEn: [
    'When a cuber changes nationality, the historical `result.country_id` is **not back-filled** — old medals stay tagged with the country they held at the time, which matches intuition.',
    'Multiple medals at one comp stack (gold in 3x3 + 2x2 + OH at the same event = +3 golds).',
    'The hard limit of 100 hides the long tail; the country aggregate is complete.',
  ],
  related: [
    { id: 'best_medal_collection_from_abroad_by_country', titleZh: '国家版', titleEn: 'Per-country version', hintZh: '把人 → 国家的汇总', hintEn: 'Person → country aggregation'
    },
    { id: 'world_championship_podiums_by_person', titleZh: '世锦赛奖牌(选手)', titleEn: 'Worlds podiums by person', hintZh: '只在世锦赛上的领奖台', hintEn: 'Worlds-only podiums per cuber'
    },
    { id: 'world_records_by_person', titleZh: '个人 WR 数', titleEn: 'WRs by person', hintZh: '另一个个人维度指标', hintEn: 'Sibling per-person metric'
    },
    { id: 'best_medal_collection_from_abroad_by_person', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: 'Top 100', hintEn: 'Top 100'
    },
  ]
};

// ──── current_world_records_by_country ──────────────────────────────────────
const current_world_records_by_country: AboutEntry = {
  id: 'current_world_records_by_country',
  titleZh: '各国当前世界纪录数量',
  titleEn: 'Current world records by country',
  badgeZh: '国家',
  badgeEn: 'Country',
  introZh: [
    '不依赖 `regional_single_record = WR` 历史标记 (那是当时打破时贴上的,改 dump 后旧 WR 会留 "WR" 但已被超越);而是**直接重算每个项目的当前最佳**,持有者所属国家 +1。',
    '所以一个选手如果同时持有 single + average WR,会贡献 2 条;同国多人也合并到该国名下。',
  ],
  introEn: [
    'Does not trust the historical `regional_single_record = WR` marker (which sticks even after the WR is broken). Instead **recomputes the current best per event** and credits its holder\'s country.',
    'A cuber holding both single + average WR contributes 2; multiple holders in one country roll up under that country.',
  ],
  stats: [
    { value: 'single + average', labelZh: '两类纪录', labelEn: 'Two record types', hintZh: '每个项目最多 2 个当前 WR', hintEn: 'Up to 2 active WRs per event'
    },
    { value: '`e.rank < 900`', labelZh: '只看现役项目', labelEn: 'Active events only', hintZh: '排除已停办项目', hintEn: 'Discontinued events excluded'
    },
    { value: '`MIN(best/average)`', labelZh: 'WR 判定', labelEn: 'WR check', hintZh: '该项目全局最小 = 当前 WR', hintEn: 'Global min per event = current WR'
    },
    { value: 'GROUP_CONCAT', labelZh: '同国合并', labelEn: 'Per-country join', hintZh: '该国 WR 持有者列表', hintEn: 'Country\'s WR holders rendered as list'
    },
  ],
  sourceZh: [
    '两步嵌套查询:外层先在 `results` 上 `GROUP BY person_id, event_id` 算每人每项的 PB,再 `GROUP BY event_id` 算全局 WR,内连接 `PB = WR` 的行 = 当前 WR 持有者。Single 和 average 各跑一遍 UNION ALL,再 join `persons` 拿国家,最后按 `country_id` 汇总。',
    '`events.rank < 900` 排除 magic / mmagic / 333mbo / 333ft 等已停办项目 (WCA 给停办项目 rank ≥ 900)。',
  ],
  sourceEn: [
    'Two-step nested query: inner `GROUP BY person_id, event_id` for per-person PB, another `GROUP BY event_id` for the global WR, inner-join where `PB = WR` to find current holders. Single and average each run separately, UNIONed, then joined to `persons` for country, finally aggregated by `country_id`.',
    '`events.rank < 900` strips discontinued events (magic / mmagic / 333mbo / 333ft); WCA assigns those rank ≥ 900.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `-- single WR holders (average mirrors this)
SELECT DISTINCT ps.person_id
FROM (SELECT person_id, event_id, MIN(best) AS pb
      FROM results WHERE best > 0
      GROUP BY person_id, event_id) ps
JOIN (SELECT event_id, MIN(best) AS wr
      FROM results WHERE best > 0
      GROUP BY event_id) wr
  ON ps.event_id = wr.event_id AND ps.pb = wr.wr
JOIN events e ON e.id = ps.event_id AND e.rank < 900;`,
  },
  steps: [
    {
      titleZh: '算每人每项 PB',
      titleEn: 'Compute per-person PB',
      bodyZh: '`GROUP BY person_id, event_id` + `MIN(best)`,过 `best > 0` 排 DNF。average 用 `MIN(average)` 同理。',
      bodyEn: '`GROUP BY person_id, event_id` with `MIN(best)`, filter `best > 0` to drop DNFs. Average mirrors via `MIN(average)`.'
    },
    {
      titleZh: '算全局 WR',
      titleEn: 'Compute global WR',
      bodyZh: '同 `results` 表 `GROUP BY event_id` + `MIN(best)` —— 每项目一个 WR 值。',
      bodyEn: 'Same `results` table, `GROUP BY event_id` + `MIN(best)` — one WR value per event.'
    },
    {
      titleZh: '找等值持有者',
      titleEn: 'Match holders',
      bodyZh: '内连接 `PB = WR` 拿到当前持有人;并列 WR (多人同值) 都算进去。',
      bodyEn: 'Inner join `PB = WR` extracts current holders; ties (multiple cubers at the same time) all qualify.'
    },
    {
      titleZh: 'UNION ALL single + average',
      titleEn: 'UNION single + average',
      bodyZh: '两个子查询合并 —— 同时持有 single + average WR 的选手出现 2 行,自然 +2。',
      bodyEn: 'Merge both subqueries — a cuber holding single + average WRs appears twice, contributing 2.'
    },
    {
      titleZh: '按国家汇总',
      titleEn: 'Roll up by country',
      bodyZh: '`COUNT(*)` 算该国 WR 数,`GROUP_CONCAT(DISTINCT person.name ...)` 拼持有者名单。',
      bodyEn: '`COUNT(*)` for the country\'s WR tally; `GROUP_CONCAT(DISTINCT person.name ...)` for the holder list.',
      highlight: true
    },
  ],
  edgesZh: [
    '"当前"= dump 时间点 (每月更新);新 WR 打破后下一次 dump 才会反映。',
    '并列 WR (同值多人) 都算,所以个别项目可能 2-3 个国家同时各 +1。',
    '停办项目 (`e.rank ≥ 900`) 整个被排除 —— 那些 "永久 WR" 不参与现役榜。',
    '与 `world_records_by_country` 区别:那个是历史累计,这个只数当前持有。',
  ],
  edgesEn: [
    '"Current" means as of the dump snapshot (refreshed monthly); a new WR shows up only after the next dump.',
    'Tied WRs (multiple holders at the same value) all count, so an event can credit 2-3 countries simultaneously.',
    'Discontinued events (`e.rank ≥ 900`) are dropped entirely — those "permanent WRs" don\'t appear here.',
    'Different from `world_records_by_country` — that counts all-time WR history; this counts only what\'s currently held.',
  ],
  related: [
    { id: 'world_records_by_country', titleZh: '历史 WR 累计(国家)', titleEn: 'All-time WR count (country)', hintZh: '同一维度的累计版', hintEn: 'Cumulative all-time counterpart'
    },
    { id: 'world_records_by_person', titleZh: '历史 WR 累计(选手)', titleEn: 'All-time WR count (person)', hintZh: '换个体维度', hintEn: 'Per-person version'
    },
    { id: 'wr_current', titleZh: '当前 WR 一览', titleEn: 'Current WR snapshot', hintZh: '逐项目列出当前 WR 值', hintEn: 'Per-event WR value listing'
    },
    { id: 'current_world_records_by_country', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: '国家 + 持有人', hintEn: 'Country + holders'
    },
  ]
};

// ──── delegated_competition_per_year ────────────────────────────────────────
const delegated_competition_per_year: AboutEntry = {
  id: 'delegated_competition_per_year',
  titleZh: '每年代表比赛数',
  titleEn: 'Delegated competitions per year',
  badgeZh: '代表',
  badgeEn: 'Delegate',
  introZh: [
    'WCA Delegate 是每场官方比赛的现场监督,亲自到场签字盖章。本表按"代表年均量"排序 —— 该代表的总代表场数 ÷ 服役年数。',
    '服役年数定义为**首次代表 → 末次代表**的时间跨度 (DATEDIFF 算天数 ÷ 365.25),并非 WCA Delegate 任命书的合同期。门槛:至少代表过 5 场,排掉新晋。',
  ],
  introEn: [
    'A WCA Delegate is the on-site supervisor of each official competition. This table ranks by yearly throughput — total delegated comps ÷ years of service.',
    'Service span = first delegated comp → last (DATEDIFF days ÷ 365.25), not the formal Delegate appointment window. Floor: at least 5 delegated comps to qualify (filters out new appointees).',
  ],
  stats: [
    { value: '≥ 5', labelZh: '入榜门槛', labelEn: 'Inclusion floor', hintZh: '少于 5 场不上榜', hintEn: 'Under 5 — excluded'
    },
    { value: '365.25', labelZh: '年长度', labelEn: 'Days per year', hintZh: '含闰年的平均年长', hintEn: 'Leap-aware average year'
    },
    { value: '`show_at_all = 1`', labelZh: '可见比赛', labelEn: 'Visible comps', hintZh: '排掉草稿 / 隐藏', hintEn: 'Excludes draft / hidden'
    },
    { value: '`cancelled_at IS NULL`', labelZh: '排已取消', labelEn: 'Drop cancelled', hintZh: '签了又取消的不算', hintEn: 'Signed but cancelled excluded'
    },
  ],
  sourceZh: [
    '`competition_delegates` 表 (一场比赛多 Delegate = 多行) join `competitions` 过滤 `show_at_all = 1 AND cancelled_at IS NULL AND start_date < CURDATE()` (即"对外可见、未取消、已开始")。`GROUP BY delegate_id`,统计 `COUNT(DISTINCT competition_id)` (避免一人在一场被记两次) + `DATEDIFF` 算跨度。',
    '`users.wca_id` join `persons` 拿展示名;输出 `delegated_per_year = count / years`。',
  ],
  sourceEn: [
    '`competition_delegates` (multiple delegates per comp = multiple rows) joined to `competitions`, filtered to `show_at_all = 1 AND cancelled_at IS NULL AND start_date < CURDATE()` (public, not cancelled, already started). `GROUP BY delegate_id` with `COUNT(DISTINCT competition_id)` (avoids double-counting same delegate on one comp) and `DATEDIFF` for span.',
    '`users.wca_id` joined to `persons` resolves display names; output is `delegated_per_year = count / years`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT COUNT(DISTINCT competition_id) delegated,
       (DATEDIFF(MAX(end_date), MIN(start_date)) / 365.25) years,
       delegate_id
FROM competition_delegates
JOIN competitions ON competitions.id = competition_id
WHERE show_at_all = 1
  AND cancelled_at IS NULL
  AND start_date < CURDATE()
GROUP BY delegate_id
HAVING delegated >= 5`,
  },
  steps: [
    {
      titleZh: '过滤可见 + 未取消 + 已开始',
      titleEn: 'Filter visible + not cancelled + started',
      bodyZh: '草稿比赛 / 取消比赛 / 未来比赛全排掉 —— 只算"真正办过"的。',
      bodyEn: 'Drafts / cancelled / future comps all excluded — only "actually happened" counts.'
    },
    {
      titleZh: 'COUNT(DISTINCT competition_id)',
      titleEn: 'Count distinct comps',
      bodyZh: 'Distinct 防一场比赛多角色 (e.g. Delegate + Organizer) 在 join 后产生重复行。',
      bodyEn: 'Distinct guards against double-counting when a delegate also held other roles at the same comp.'
    },
    {
      titleZh: '服役跨度 = MAX(end) − MIN(start)',
      titleEn: 'Span = MAX(end) − MIN(start)',
      bodyZh: '`DATEDIFF` 拿天数 / 365.25 = 年。注意 `MIN(start_date)` 配 `MAX(end_date)` —— 首场起算到末场结束。',
      bodyEn: '`DATEDIFF` days ÷ 365.25 = years. Pair `MIN(start_date)` with `MAX(end_date)` — from first comp\'s start to last comp\'s end.'
    },
    {
      titleZh: '`HAVING delegated >= 5`',
      titleEn: 'Threshold ≥ 5',
      bodyZh: '少于 5 场的"刚上任 + 跨度极短"会算出离谱年均值,直接砍掉。',
      bodyEn: 'New appointees with very short spans would compute absurd yearly rates — cut at 5 minimum.'
    },
    {
      titleZh: '`delegated / years` 降序',
      titleEn: 'Sort by delegated / years',
      bodyZh: '最终排序键 = 单位年代表场数,Top 即"最高效"代表。',
      bodyEn: 'Final sort key is comps-per-year; the top is the most productive Delegate.',
      highlight: true
    },
  ],
  edgesZh: [
    '服役跨度按"代表过的比赛"算,不是 WCA 内部任命期 —— 间断不计入分母 (但通常 Delegate 不会真正断签)。',
    '若代表只签过 1 场,DATEDIFF 是 0,会除零;`HAVING ≥ 5` 顺带防了。',
    '副代表 (Trainee) 在 `competition_delegates` 里也是一行,会算进总数 —— 包含见习经历。',
  ],
  edgesEn: [
    'Service span is from first to last delegated comp, not the formal Delegate appointment period — gaps in between count toward the denominator.',
    'A delegate with only 1 comp would divide by 0 days; the `HAVING ≥ 5` floor handles that.',
    'Trainee delegates also appear in `competition_delegates`, so trainee shifts count toward the total.',
  ],
  related: [
    { id: 'most_delegated_competitions', titleZh: '代表总场次榜', titleEn: 'Total delegated comps', hintZh: '不除年数,纯累计', hintEn: 'No yearly rate, pure cumulative'
    },
    { id: 'delegated_competition_per_year', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: '年均效率排名', hintEn: 'Comps-per-year ranking'
    },
  ]
};

// ──── first_r_is_wr ─────────────────────────────────────────────────────────
const first_r_is_wr: AboutEntry = {
  id: 'first_r_is_wr',
  titleZh: '首次破纪录即世界纪录',
  titleEn: 'First record is a World Record',
  badgeZh: '稀有',
  badgeEn: 'Cinematic',
  introZh: [
    '一个选手生涯里**第一次打破任何"地区纪录"** (NR / CR / WR,WCA 术语统称 regional record) 时,如果那条同时是世界纪录,就上榜。',
    '极戏剧的事件:大多数选手是先破 NR,再爬到 CR,再到 WR;少数天才级 / 项目极冷门的情况下,一上来就 WR。',
  ],
  introEn: [
    'A cuber qualifies when **their very first regional record** (NR / CR / WR — WCA collectively calls these "regional records") was simultaneously a World Record.',
    'Dramatic and rare: most cubers stair-step from NR → CR → WR; only prodigies or competitors in niche events skip straight to WR on debut.',
  ],
  stats: [
    { value: 'ROW_NUMBER()', labelZh: '取首次', labelEn: 'First-only pick', hintZh: '按 start_date 分窗排序', hintEn: 'Window-rank by start_date' },
    { value: 'rn = 1', labelZh: '过滤条件', labelEn: 'Filter', hintZh: '只看每人首条纪录', hintEn: 'Keep first-record-per-person only'
    },
    { value: 'single ∪ average', labelZh: '两类合并', labelEn: 'Both metric types', hintZh: 'UNION ALL 后一起排', hintEn: 'UNION ALL, then window-rank together'
    },
    { value: '`record = WR`', labelZh: '入榜条件', labelEn: 'Inclusion', hintZh: '首条恰好是 WR', hintEn: 'First record is a WR'
    },
  ],
  sourceZh: [
    '把 `regional_single_record IS NOT NULL` 和 `regional_average_record IS NOT NULL` 两个子集 UNION ALL,每行带 `start_date` 和 record 类型 (NR / CR / WR);窗口函数 `ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY start_date)` 给每人按时间编号,取 `rn = 1`。',
    '最后 `WHERE record = \'WR\'` 留下"首条就是 WR"的人。',
  ],
  sourceEn: [
    'UNION ALL the two subsets (`regional_single_record IS NOT NULL` and `regional_average_record IS NOT NULL`) — each row carries `start_date` and the record type (NR / CR / WR). A window function `ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY start_date)` numbers each person\'s records chronologically; keep `rn = 1`.',
    'Final `WHERE record = \'WR\'` filters to those whose first record happened to be a WR.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT *, ROW_NUMBER() OVER (
         PARTITION BY person_id ORDER BY start_date
       ) AS rn
FROM (
  SELECT person_id, event_id, 'single' AS type,
         best AS result, regional_single_record AS record, ...
  FROM results WHERE regional_single_record IS NOT NULL
  UNION ALL
  SELECT ..., 'average', average, regional_average_record, ...
  FROM results WHERE regional_average_record IS NOT NULL
) all_records
WHERE rn = 1 AND record = 'WR'`,
  },
  steps: [
    {
      titleZh: '聚合所有 regional record',
      titleEn: 'Pool all regional records',
      bodyZh: '`regional_single_record` 和 `regional_average_record` 两列(NR / CR / WR / 空)联合,每条非空都成一行。',
      bodyEn: 'Both `regional_single_record` and `regional_average_record` columns (NR / CR / WR / null) become rows when non-null.'
    },
    {
      titleZh: '按人按时间编号',
      titleEn: 'Window-rank per person by date',
      bodyZh: '`ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY start_date)` 给每个选手的所有 record 按时间编号 (1, 2, 3, ...)。',
      bodyEn: '`ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY start_date)` numbers each cuber\'s record events 1, 2, 3, ... chronologically.'
    },
    {
      titleZh: '取 `rn = 1`',
      titleEn: 'Keep `rn = 1`',
      bodyZh: '只留下每人**最早**那一条 regional record;同日多条都算"首次"。',
      bodyEn: 'Keep only each person\'s **earliest** regional record; multiple records on the same date all qualify as "first".'
    },
    {
      titleZh: '过滤 `record = WR`',
      titleEn: 'Filter `record = WR`',
      bodyZh: '在首条 record 里只挑级别 = WR 的 —— 上榜的就是这群人。',
      bodyEn: 'From the first-record set, keep only those tagged WR — that\'s the leaderboard.',
      highlight: true
    },
  ],
  edgesZh: [
    '"首次"按 `start_date` 排,同日多场比赛 / 同场多项目的并列首条都会进 `rn = 1` (单条记录里 single + average 同时算 NR/CR/WR 也会拆 2 行)。',
    '只要 record **不是空字符串 / NULL** 就算 regional record;NR / CR / WR 三级都收进 UNION,再过滤。',
    'WCA 的 `regional_*_record` 是当时打破时的标记,不会因后续被超越而清除 —— 历史 WR 不会"降级"。',
  ],
  edgesEn: [
    '"First" is `start_date` ordering; same-day records (multiple comps, or single + average flagged together) all tie for `rn = 1`.',
    'Any non-empty `regional_*_record` value counts (NR / CR / WR all enter the UNION before the WR filter).',
    'WCA\'s `regional_*_record` markers are stamped at time-of-record and stay there even after the WR is broken — historical WRs are never "demoted".',
  ],
  related: [
    { id: 'world_records_by_person', titleZh: '个人 WR 总数', titleEn: 'WRs by person', hintZh: '一个 WR 不稀奇,首条就是才稀奇', hintEn: 'One WR is common; debut WR is rare'
    },
    { id: 'records_in_most_events', titleZh: '在最多项目破纪录', titleEn: 'Records in most events', hintZh: '广度对比', hintEn: 'Breadth counterpart'
    },
    { id: 'longest_standing_records', titleZh: '最长保持纪录', titleEn: 'Longest-standing records', hintZh: '纪录之后的生命周期', hintEn: 'What happens to a record afterwards'
    },
    { id: 'first_r_is_wr', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: '完整名单 + 日期 + 比赛', hintEn: 'Full list with dates and comps'
    },
  ]
};

// ──── longest_standing_records ──────────────────────────────────────────────
const longest_standing_records: AboutEntry = {
  id: 'longest_standing_records',
  titleZh: '最长保持纪录',
  titleEn: 'Longest standing records',
  badgeZh: '寿命',
  badgeEn: 'Longevity',
  introZh: [
    '把所有曾经的 regional record (`AfR` / `AsR` / `ER` / `NAR` / `OcR` / `SAR` / `WR`) 按"在被打破前活了多少天"排序。仍在保持的纪录,用今天减打破日。',
    '分 7 个区域看 (World + 6 大洲),每区取 Top 10。WR 在每个洲都重复出现 —— 因为 WR 同时也是该洲的洲纪录。',
  ],
  introEn: [
    'For every regional record (`AfR` / `AsR` / `ER` / `NAR` / `OcR` / `SAR` / `WR`), measures how many days it stood until being broken. Active records use today as the upper bound.',
    'Split across 7 regions (World + 6 continents), Top 10 each. WRs appear in every continent block — a WR is automatically that continent\'s continental record too.',
  ],
  stats: [
    { value: '7', labelZh: '区域分组', labelEn: 'Region blocks', hintZh: 'World + 6 大洲', hintEn: 'World + 6 continents'
    },
    { value: '10', labelZh: '每区域条数', labelEn: 'Rows per region', hintZh: '降序天数前 10', hintEn: 'Top 10 by days standing'
    },
    { value: 'OFFICIAL_EVENTS', labelZh: '只看现役项目', labelEn: 'Active events only', hintZh: '排除已停办', hintEn: 'Discontinued excluded'
    },
    { value: 'today / 打破日', labelZh: '截止时间', labelEn: 'End boundary', hintZh: '尚未被破 = 今天', hintEn: 'Still active → today'
    },
  ],
  sourceZh: [
    '从 `results` 拉所有 `regional_single_record` 或 `regional_average_record` 是 `WR/AfR/AsR/ER/NAR/OcR/SAR` 之一的行;join `persons` (`sub_id = 1`) + `competitions` + `countries` + `continents` 拿洲信息。SQL 只做拉数据,寿命计算全在 JS 的 `transform()` 里。',
    'transform 里按 (区域, 类型, 项目) 分组,组内按时间排,找"比当前更好的下一条"的日期差;没有更好 = 今天 − 当前日 = 仍活着。',
  ],
  sourceEn: [
    'Pulls all rows from `results` whose `regional_single_record` or `regional_average_record` is `WR/AfR/AsR/ER/NAR/OcR/SAR`; joins `persons` (`sub_id = 1`) + `competitions` + `countries` + `continents` for continent info. SQL only collects data — longevity is computed in JS `transform()`.',
    'In transform, group by (region, type, event), sort by date, find "next better result" date diff; no better → today minus current date (i.e. still active).',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT regional_single_record, regional_average_record,
       best single, average,
       person.name, competition.start_date,
       event_id, continent.name continent
FROM results
JOIN persons ON persons.wca_id = person_id AND persons.sub_id = 1
JOIN competitions ON competitions.id = competition_id
JOIN countries ON countries.id = results.country_id
JOIN continents ON continents.id = countries.continent_id
WHERE regional_single_record IN ('AfR','AsR','ER','NAR','OcR','SAR','WR')
   OR regional_average_record IN ('AfR','AsR','ER','NAR','OcR','SAR','WR')`,
  },
  steps: [
    {
      titleZh: '拉历史 record 行',
      titleEn: 'Pull every record-flagged row',
      bodyZh: 'WHERE 子句包含 7 个 regional record code;一行可能同时 single + average 都标 (拆 2 条处理)。',
      bodyEn: 'WHERE clause includes all 7 regional record codes; a single row can carry both single + average markers (handled as 2 entries).'
    },
    {
      titleZh: '按 (区域, 项目, 类型) 分桶',
      titleEn: 'Bucket by (region, event, type)',
      bodyZh: '`regionRecords` 表:每个区域看哪些 code (e.g. Asia 看 `AsR + WR`,因为 WR 持有者必然在亚洲打出来才同时进 AsR)。',
      bodyEn: 'A `regionRecords` map: each region accepts which codes (e.g. Asia includes `AsR + WR`, since a WR set in Asia also counts as AsR).'
    },
    {
      titleZh: '找"下一条更好"',
      titleEn: 'Find next-better record',
      bodyZh: '组内时间正序,对每条 r,`find(r2 => r2.value < r.value)` 拿到打破它的下一条;返回那条的 `start_date`。',
      bodyEn: 'Sorted by date within group; for each row r, `find(r2 => r2.value < r.value)` returns the row that broke it; that row\'s `start_date` is the end boundary.'
    },
    {
      titleZh: '没有更好 = 仍活着',
      titleEn: 'No-better → still active',
      bodyZh: '当前活着的纪录用今天截止;在 UI 里通常会标"仍在保持"。',
      bodyEn: 'Still-active records use today as the end boundary; UI typically annotates "still active".'
    },
    {
      titleZh: '天数降序 + Top 10',
      titleEn: 'Sort by days, Top 10',
      bodyZh: '`days = ⌊(end − start) / 1d⌋`,按 days 降序;每区域只输出前 10 条 (加粗显示 days)。',
      bodyEn: '`days = ⌊(end − start) / 1d⌋`, sorted desc; emit only the Top 10 per region (with days bolded).',
      highlight: true
    },
  ],
  edgesZh: [
    '"被打破"判定基于值严格更小 (`Number(r2[type]) < Number(r[type])`),平了不算打破。',
    '同人多次破自己的纪录,每条都算独立条目,寿命算到下次他自己又破。',
    '`OFFICIAL_EVENTS` 过滤:`333mbo` / `magic` 等停办项目不进榜 —— 它们的"永久纪录"不公平。',
    'WR 持有人通常在自己洲也持有 CR,所以同一条 WR 会在 World + 其洲 2 个区块各出现一次。',
  ],
  edgesEn: [
    'Broken-by is strictly less-than (`Number(r2[type]) < Number(r[type])`); ties don\'t count as broken.',
    'Self-improvements split into multiple entries — each older record\'s span ends when its holder improves it.',
    '`OFFICIAL_EVENTS` filter drops discontinued events (`333mbo`, `magic`, ...) — their "permanent records" would unfairly dominate.',
    'A WR holder also typically owns the matching CR, so the same WR row appears twice — once under World, once under its continent.',
  ],
  related: [
    { id: 'longest_streak_of_world_records', titleZh: '连续 WR 时长', titleEn: 'WR streak duration', hintZh: '同一人连续持有,不同口径', hintEn: 'Same person consecutive holds, different angle'
    },
    { id: 'first_r_is_wr', titleZh: '首条即 WR', titleEn: 'First record is WR', hintZh: '纪录的开端 vs 终点', hintEn: 'Birth of a record vs longevity'
    },
    { id: 'world_records_by_person', titleZh: '个人 WR 总数', titleEn: 'WRs by person', hintZh: '广度 vs 深度', hintEn: 'Breadth vs depth'
    },
    { id: 'longest_standing_records', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: '7 区域 Top 10', hintEn: '7 regions Top 10'
    },
  ]
};

// ──── longest_streak_of_world_records ───────────────────────────────────────
const longest_streak_of_world_records: AboutEntry = {
  id: 'longest_streak_of_world_records',
  titleZh: '同一项目同一类型最长连续世界纪录',
  titleEn: 'Longest streak of world records (same event, same type)',
  badgeZh: '连击',
  badgeEn: 'Streak',
  introZh: [
    '在某个项目某个类型 (single 或 average) 下,**连续**由同一选手打破的 WR 链。每次有别人插进来打破,streak 就断。',
    '示例:某选手在 3x3 single 上 5 次刷新自己的 WR (中间没人挤进来),即为长度 5 的 streak。',
  ],
  introEn: [
    'A consecutive chain of WRs in one event-type (single or average) all set by **the same cuber**. The streak breaks the moment anyone else sets a WR in that event-type.',
    'Example: a cuber improves their own 3x3 single WR 5 times in a row with nobody else WR-ing in between — a length-5 streak.',
  ],
  stats: [
    { value: '> 1', labelZh: '入榜门槛', labelEn: 'Inclusion floor', hintZh: '至少 2 条连续才算 streak', hintEn: 'At least 2 consecutive to qualify'
    },
    { value: '日期 + 成绩', labelZh: '同日 tiebreak', labelEn: 'Same-day tiebreak', hintZh: '同日多 WR 按成绩降序', hintEn: 'Same date sorted by result desc'
    },
    { value: 'Years', labelZh: '排序主键', labelEn: 'Sort key', hintZh: '末次 − 首次 WR 时长', hintEn: 'End - start span'
    },
    { value: '停办项目', labelZh: '特殊处理', labelEn: 'Special case', hintZh: '末次 WR 截至项目最后一场', hintEn: 'Endpoint = event\'s final comp'
    },
  ],
  sourceZh: [
    'SQL 只拉所有 `regional_*_record = WR` 行 + 必要 join (`persons sub_id = 1`, `competitions`)。streak 检测在 JS 的 `transform()` 里:对每个 (event, type) 按日期排序,顺序扫,跟同一人连续就 `count += 1`,换人就开新 streak。',
    '停办项目 (`333ft / magic / mmagic / 333mbo`) 的 streak 终点是该项目最后一场比赛 (`toJson` 里预查一次),不是"至今" —— 因为项目已死,不可能再有 WR。',
  ],
  sourceEn: [
    'SQL only pulls all `regional_*_record = WR` rows plus necessary joins (`persons sub_id = 1`, `competitions`). Streak detection lives in JS `transform()`: for each (event, type), sort by date and scan — same cuber as the previous WR? `count += 1`. Different cuber? Start a new streak.',
    'Discontinued events (`333ft / magic / mmagic / 333mbo`) terminate the final streak at the event\'s last comp (prefetched in `toJson`) — not "still active", since no new WR can occur.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT regional_single_record, regional_average_record,
       best single, average,
       person.name, competition.start_date,
       event_id, competition.cell_name
FROM results
JOIN persons ON persons.wca_id = person_id AND persons.sub_id = 1
JOIN competitions ON competitions.id = competition_id
WHERE regional_single_record = 'WR'
   OR regional_average_record = 'WR'`,
  },
  steps: [
    {
      titleZh: '拉所有 WR 行',
      titleEn: 'Pull every WR row',
      bodyZh: 'single + average WR 都包括,行里同时带项目 + 选手 + 日期 + 比赛。',
      bodyEn: 'Includes both single + average WRs, each row carrying event + person + date + comp.'
    },
    {
      titleZh: '按 (项目, 类型) 拆桶',
      titleEn: 'Split by (event, type)',
      bodyZh: 'streak 不跨项目也不跨 single↔average:3x3 single 和 3x3 average 各自独立 streak。',
      bodyEn: 'Streaks don\'t cross events or cross single↔average: 3x3 single and 3x3 average track independently.'
    },
    {
      titleZh: '排序 + 顺序扫',
      titleEn: 'Sort + sequential scan',
      bodyZh: '同日 tiebreak 按 `result desc` (成绩差的在前 / 成绩好的在后) —— 因为同日多条 WR 必然是渐进刷新。',
      bodyEn: 'Same-day tiebreak sorts result desc (worse first, better last) — same-day multiple WRs are by definition stepwise improvements.'
    },
    {
      titleZh: '换人 = 断 streak',
      titleEn: 'Different cuber = streak break',
      bodyZh: '`current.person === prev.person` 则 `count += 1`,否则封档,记录 `endDate` + `lastCompetition`。',
      bodyEn: 'If `current.person === prev.person`, `count += 1`; otherwise close out, recording `endDate` + `lastCompetition`.'
    },
    {
      titleZh: '按 years 降序输出',
      titleEn: 'Sort by years, output',
      bodyZh: 'years = (end − start) / 365.25。`count > 1` 才入榜,降序排,加上停办项目的特殊截止。',
      bodyEn: 'years = (end − start) / 365.25. Only `count > 1` qualifies; sorted desc; discontinued events apply the special endpoint.',
      highlight: true
    },
  ],
  edgesZh: [
    'streak 不要求"严格刷新":WCA `regional_*_record = WR` 本身就是当时贴的标 (能贴说明改进了),所以扫到的每条都已经是 WR。',
    '同一人在不同项目同时连击 → 拆成 2 个 streak (每项目独立)。',
    '"仍在保持"的活 streak 用 today 算 years;实际可能下个月就被破,数字会变。',
    '停办项目走 `DISCONTINUED_EVENTS = [333ft, magic, mmagic, 333mbo]` 的特殊路径 —— 这些项目最后的 WR 持有人会用项目"死亡日"截止。',
  ],
  edgesEn: [
    'Streaks don\'t require strict improvement: WCA\'s `regional_*_record = WR` marker only attaches when it\'s actually a new WR, so every row is by definition a WR-tier improvement.',
    'One cuber WR-streaking in two events simultaneously → split into 2 separate streaks (per-event isolated).',
    '"Active" streaks use today for the years calc; numbers shift as the streak continues — or ends.',
    'Discontinued events follow the `DISCONTINUED_EVENTS = [333ft, magic, mmagic, 333mbo]` path — final WR holders\' streaks close at the event\'s last competition.',
  ],
  related: [
    { id: 'longest_standing_records', titleZh: '单条纪录寿命', titleEn: 'Single-record lifespan', hintZh: '单条 vs 连续多条', hintEn: 'One record vs consecutive chain'
    },
    { id: 'world_records_by_person', titleZh: '个人 WR 总数', titleEn: 'WRs by person', hintZh: '总数 vs 连击', hintEn: 'Total count vs streak'
    },
    { id: 'first_r_is_wr', titleZh: '首条即 WR', titleEn: 'First record is WR', hintZh: '另一种戏剧化指标', hintEn: 'Another cinematic metric'
    },
    { id: 'longest_streak_of_world_records', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: '项目 × 类型完整列表', hintEn: 'Full event × type table'
    },
  ]
};

// ──── most_delegated_competitions ───────────────────────────────────────────
const most_delegated_competitions: AboutEntry = {
  id: 'most_delegated_competitions',
  titleZh: '代表比赛最多',
  titleEn: 'Most delegated competitions',
  badgeZh: '累计',
  badgeEn: 'Cumulative',
  introZh: [
    '每个 WCA Delegate 历史累计代表过的比赛数。和"每年代表比赛数"是同一份基础数据,只换排序键 —— 这里看总量,那里看效率。',
    '过滤口径一致:已开始的可见、未取消比赛;Delegate 角色基于 `competition_delegates` 表 (一场比赛多 Delegate = 多行)。',
  ],
  introEn: [
    'Per-Delegate cumulative count of competitions they\'ve overseen. Same dataset as "delegated competitions per year" but ranked by total, not yearly rate.',
    'Same filter: started, visible, not-cancelled comps. Delegate roles read from `competition_delegates` (one comp with multiple delegates = multiple rows).',
  ],
  stats: [
    { value: '`COUNT(DISTINCT)`', labelZh: '去重统计', labelEn: 'Distinct count', hintZh: '防同人多角色重复', hintEn: 'Guards against multi-role rows'
    },
    { value: 'show_at_all = 1', labelZh: '只看公开比赛', labelEn: 'Public comps only', hintZh: '排掉草稿', hintEn: 'Drafts excluded'
    },
    { value: 'cancelled_at IS NULL', labelZh: '排已取消', labelEn: 'Drop cancelled', hintZh: '签了又取消不算', hintEn: 'Signed-then-cancelled excluded'
    },
    { value: 'start_date < CURDATE()', labelZh: '排未来场', labelEn: 'Past only', hintZh: '未开始不计入', hintEn: 'Future comps excluded'
    },
  ],
  sourceZh: [
    '`competition_delegates` join `competitions` 三过滤后 `GROUP BY delegate_id`,`COUNT(DISTINCT competition_id)` 得累计场数;join `users` + `persons` 拿到 wca_id 和展示名。',
    '不像 per_year 版本需要 `HAVING >= 5` —— 这里直接全列,新人 1 场也算一行。',
  ],
  sourceEn: [
    '`competition_delegates` joined to `competitions`, filtered, then `GROUP BY delegate_id` with `COUNT(DISTINCT competition_id)` for the total; `users` + `persons` joins resolve wca_id and display name.',
    'Unlike the per-year version, there\'s no `HAVING >= 5` — new delegates with even 1 comp appear.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT COUNT(DISTINCT competition_id) delegated_count,
       delegate_id
FROM competition_delegates
JOIN competitions ON competitions.id = competition_id
WHERE show_at_all = 1
  AND cancelled_at IS NULL
  AND start_date < CURDATE()
GROUP BY delegate_id
ORDER BY delegated_count DESC`,
  },
  steps: [
    {
      titleZh: '同 per_year 的过滤',
      titleEn: 'Same filter as per_year',
      bodyZh: '`show_at_all = 1 AND cancelled_at IS NULL AND start_date < CURDATE()`。',
      bodyEn: '`show_at_all = 1 AND cancelled_at IS NULL AND start_date < CURDATE()`.'
    },
    {
      titleZh: 'COUNT(DISTINCT competition_id)',
      titleEn: 'Distinct comp count',
      bodyZh: '同人在同场多角色 (Delegate + Organizer + Trainee Delegate ...) 只算 1 次。',
      bodyEn: 'Same person at one comp with multiple roles (Delegate + Organizer + Trainee Delegate ...) counts only once.'
    },
    {
      titleZh: '不加 HAVING 阈值',
      titleEn: 'No HAVING threshold',
      bodyZh: '`per_year` 要 `>= 5` 防分母过小;这里看累计,1 场也是 1 场。',
      bodyEn: '`per_year` requires `>= 5` to guard against tiny denominators; here we count totals, so even 1 comp counts.'
    },
    {
      titleZh: '降序输出 + WCA list 链接',
      titleEn: 'Sort desc + WCA list link',
      bodyZh: '附上 `https://www.worldcubeassociation.org/competitions?delegate=<id>` 让用户能跳过去看完整列表。',
      bodyEn: 'Each row links to `https://www.worldcubeassociation.org/competitions?delegate=<id>` for the full WCA list view.',
      highlight: true
    },
  ],
  edgesZh: [
    'Trainee Delegate (见习代表) 也是 `competition_delegates` 的一行,会被计入 —— 累计数包含见习经历。',
    'Senior Delegate / 区域代表角色不影响计数 —— 只要在那场比赛挂名 Delegate 就 +1。',
    '从未代表过的人不上榜 —— 不是"所有 Delegate 列表",而是"代表过至少 1 场"。',
  ],
  edgesEn: [
    'Trainee delegates show as rows in `competition_delegates` and count toward the total — trainee shifts included.',
    'Senior Delegate / regional roles don\'t affect counting — any delegate-tagged appearance = +1.',
    'Delegates who never delegated don\'t appear — this is "delegated ≥ 1 comp", not "all delegates list".',
  ],
  related: [
    { id: 'delegated_competition_per_year', titleZh: '年均代表场数', titleEn: 'Yearly delegated rate', hintZh: '同源数据,换排序键', hintEn: 'Same source, different sort key'
    },
    { id: 'most_delegated_competitions', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: 'Top 代表累计场数', hintEn: 'Top delegates by cumulative comps'
    },
  ]
};

// ──── potentially_seen_world_records ────────────────────────────────────────
const potentially_seen_world_records: AboutEntry = {
  id: 'potentially_seen_world_records',
  titleZh: '可能目击过的世界纪录',
  titleEn: 'Potentially seen world records',
  badgeZh: '现场',
  badgeEn: 'On site',
  introZh: [
    '一个选手参加过 WR 诞生的同一场比赛,**理论上**能现场见证它 (不一定真在场地里;同比赛同日就算)。每场每出 1 个 WR = 该比赛所有参赛选手 +1。',
    '这是个"参与度 × 时代"的混合指标 —— 早入坑 + 跑勤的人见证最多,跟绝对实力关系不大。',
  ],
  introEn: [
    'A cuber registered at the same comp as a WR-setting performance could **in principle** witness it (not literally in the same hall; same comp / same days is enough). Each WR set at a comp adds +1 to every registered cuber there.',
    'A "participation × era" hybrid — early adopters who travel a lot top the list, with little correlation to skill.',
  ],
  stats: [
    { value: '100', labelZh: '榜单长度', labelEn: 'Leaderboard size', hintZh: '`LIMIT 100`', hintEn: '`LIMIT 100`'
    },
    { value: '`HAVING wrs_count > 0`', labelZh: '只看有 WR 的比赛', labelEn: 'WR-containing comps only', hintZh: '没出 WR 的比赛跳过', hintEn: 'Comps with no WR skipped'
    },
    { value: 'DISTINCT', labelZh: '人 × 比赛去重', labelEn: 'Person × comp distinct', hintZh: '同场多项目不重复', hintEn: 'Multi-event registration deduped'
    },
    { value: 'WR/比赛 求和', labelZh: '汇总方式', labelEn: 'Aggregation', hintZh: '到场 WR 数对人累加', hintEn: 'WRs-per-comp summed per person'
    },
  ],
  sourceZh: [
    '两个子查询:(1) 每场比赛的 WR 数 (`COUNT IF(regional_single_record = WR) + IF(regional_average_record = WR)`),(2) 每人参加过哪些比赛 (`SELECT DISTINCT person_id, competition_id`)。',
    'join 后 `SUM(wrs_count) GROUP BY person_id` —— 这个人参加的每场比赛的 WR 数之和。',
  ],
  sourceEn: [
    'Two subqueries: (1) WRs-per-comp (`COUNT IF(regional_single_record = WR) + IF(regional_average_record = WR)`), (2) comps-each-person-attended (`SELECT DISTINCT person_id, competition_id`).',
    'Join then `SUM(wrs_count) GROUP BY person_id` — total WRs across all comps that cuber attended.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_id, SUM(wrs_count) potentially_seen_wrs_count
FROM (SELECT DISTINCT person_id, competition_id FROM results) AS attendance
JOIN (
  SELECT competition_id,
         SUM(IF(regional_single_record = 'WR', 1, 0)
           + IF(regional_average_record = 'WR', 1, 0)) wrs_count
  FROM results
  GROUP BY competition_id
  HAVING wrs_count > 0
) AS wrs_by_comp USING (competition_id)
GROUP BY person_id LIMIT 100`,
  },
  steps: [
    {
      titleZh: '算每场比赛的 WR 数',
      titleEn: 'Count WRs per comp',
      bodyZh: '内层 `GROUP BY competition_id`,数 `regional_single_record = WR` + `regional_average_record = WR` —— 一行可能 2 个 WR (single + average 同时刷)。',
      bodyEn: 'Inner `GROUP BY competition_id`, count `regional_single_record = WR` + `regional_average_record = WR` — one result row can contribute 2 (single + average broken together).'
    },
    {
      titleZh: '过滤有 WR 的比赛',
      titleEn: 'Keep only WR-containing comps',
      bodyZh: '`HAVING wrs_count > 0` —— 没出 WR 的比赛直接丢,不参与 join,加速 + 减小输出。',
      bodyEn: '`HAVING wrs_count > 0` — comps with no WR are dropped before the join, speeding things up and shrinking output.'
    },
    {
      titleZh: '取每人参加比赛集合',
      titleEn: 'Collect each person\'s comps',
      bodyZh: '`SELECT DISTINCT person_id, competition_id FROM results` —— 一人在一场算 1 次,不管打几个项目。',
      bodyEn: '`SELECT DISTINCT person_id, competition_id FROM results` — one cuber per comp = 1, regardless of how many events they entered.'
    },
    {
      titleZh: 'join + SUM 累加',
      titleEn: 'Join + SUM',
      bodyZh: '每个 (person, comp) 行附带该比赛的 wrs_count;`GROUP BY person_id SUM(...)` 就是"理论目击 WR 总数"。',
      bodyEn: 'Each (person, comp) row carries that comp\'s wrs_count; `GROUP BY person_id SUM(...)` gives "potentially seen WR count".',
      highlight: true
    },
  ],
  edgesZh: [
    '"目击"是理论值 —— 选手实际不一定在该轮在场,可能在午餐 / 没看屏幕。',
    '同场 single + average 双 WR 算 2 次 —— 即使是同一个选手同一轮,也都贡献。',
    '只统计 WR;NR / CR 不算 —— 想拓宽换 records_in_most_events 思路。',
    'Top 100 截断:尾部几千名选手 ≥ 1 的有很多,看不见。',
  ],
  edgesEn: [
    '"Witnessed" is purely theoretical — the cuber may have been at lunch or not watching the right station.',
    'A single comp with both single + average WR counts as 2 — even if same cuber same round.',
    'WRs only; NR / CR don\'t count — a broader view would need a different metric.',
    'LIMIT 100 truncation: many thousands of cubers with ≥ 1 sit invisible below.',
  ],
  related: [
    { id: 'world_records_by_person', titleZh: '个人 WR 数', titleEn: 'WRs by person', hintZh: '自己创造 vs 现场目击', hintEn: 'Set vs witnessed'
    },
    { id: 'world_championship_records', titleZh: '世锦赛纪录', titleEn: 'Worlds records', hintZh: '世锦赛上的 WR 子集', hintEn: 'Worlds-only WR subset'
    },
    { id: 'longest_streak_of_world_records', titleZh: '连续 WR 持有', titleEn: 'WR streak', hintZh: '另一类 WR 视角', hintEn: 'Another WR-centric lens'
    },
    { id: 'potentially_seen_world_records', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: 'Top 100 现场参与者', hintEn: 'Top 100 on-site attendees'
    },
  ]
};

// ──── records_in_most_events ────────────────────────────────────────────────
const records_in_most_events: AboutEntry = {
  id: 'records_in_most_events',
  titleZh: '在最多项目中打破纪录',
  titleEn: 'Records in the highest number of events',
  badgeZh: '广度',
  badgeEn: 'Breadth',
  introZh: [
    '每个选手在多少**不同项目**上打破过 regional record (历史上,不限当前)。分 3 个级别看:World (`WR`) / Continental (`AfR/AsR/ER/NAR/OcR/SAR/WR`) / National (`NR + 上级`)。',
    '高级别天然包含低级别 —— `WR` 必然也是该洲 CR、该国 NR,所以 World 榜的人在 Continental / National 榜上一定项目数 ≥。',
  ],
  introEn: [
    'Per cuber: how many **distinct events** they\'ve ever set a regional record in (any historical record, not just current). Three tiers shown: World (`WR`) / Continental (`AfR/AsR/ER/NAR/OcR/SAR/WR`) / National (`NR + above`).',
    'Higher tiers cascade into lower: a `WR` is automatically also that continent\'s CR and that country\'s NR, so the World leaderboard cuber appears in Continental / National with event count ≥.',
  ],
  stats: [
    { value: '3', labelZh: '级别', labelEn: 'Tiers', hintZh: 'World / Continental / National', hintEn: 'World / Continental / National'
    },
    { value: '20', labelZh: '每级条数', labelEn: 'Rows per tier', hintZh: 'Top 20', hintEn: 'Top 20'
    },
    { value: '历史全口径', labelZh: '不限当前', labelEn: 'All-time', hintZh: '过去 WR 即使现已超越也算', hintEn: 'Old WRs count even if since broken'
    },
    { value: '`event.rank` 排序', labelZh: '项目列展示', labelEn: 'Events list order', hintZh: 'WCA 官方项目顺序', hintEn: 'Official WCA event order'
    },
  ],
  sourceZh: [
    'SQL 拉所有 `regional_single_record` 或 `regional_average_record` 非空的行,带 `person` + `event` 信息;具体哪些 code 算"该级别"在 JS `transform()` 里按 `levels` 字典过滤。',
    '同一选手在同项目多次破不同级别纪录,JS 用 `Set<event_name>` 去重 —— 一个项目数 1 次。',
  ],
  sourceEn: [
    'SQL pulls every row with non-empty `regional_single_record` or `regional_average_record`, carrying `person` + `event`; which codes qualify per tier is decided in JS `transform()` via the `levels` dict.',
    'Multiple records by same cuber in same event dedupe via JS `Set<event_name>` — one event counted once.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT regional_single_record, regional_average_record,
       person.name, event.name event_name
FROM results
JOIN persons person ON person.wca_id = person_id AND sub_id = 1
JOIN events event ON event.id = event_id
WHERE (regional_single_record IS NOT NULL AND regional_single_record != '')
   OR (regional_average_record IS NOT NULL AND regional_average_record != '')
ORDER BY event.rank`,
  },
  steps: [
    {
      titleZh: '拉所有带 record 标记的行',
      titleEn: 'Pull every record-flagged row',
      bodyZh: 'WCA `regional_*_record` 列在打破时贴标,空字符串 / NULL 表示没破;两个非空条件 OR 拉全集。',
      bodyEn: 'WCA stamps `regional_*_record` at break-time; empty/NULL = no break. Two non-empty conditions OR\'d pull the full set.'
    },
    {
      titleZh: '按级别过滤 code',
      titleEn: 'Filter codes per tier',
      bodyZh: 'World tier 只接 `WR`;Continental 接 `WR + 6 个 CR code`;National 再加 `NR`。',
      bodyEn: 'World tier accepts `WR` only; Continental adds the 6 continental codes; National adds `NR` too.'
    },
    {
      titleZh: '按选手 Set<event> 去重',
      titleEn: 'Per-cuber dedupe via Set<event>',
      bodyZh: '`byPerson: Map<person, Set<event>>`;一个项目无论破多少次只算 1。',
      bodyEn: '`byPerson: Map<person, Set<event>>`; an event counted once no matter how many times broken.'
    },
    {
      titleZh: '按 events.size 降序,Top 20',
      titleEn: 'Sort by events.size, Top 20',
      bodyZh: '`results.size` 即"破纪录涉及项目数",降序取 Top 20。',
      bodyEn: '`results.size` = "number of events with records"; sort desc and take Top 20.',
      highlight: true
    },
  ],
  edgesZh: [
    '"项目"按 `event.name` 字符串去重 —— 已停办项目 (magic / 333mbo) 都计入,因为是历史口径。',
    'NR 在小国家相对容易拿,所以 National tier 榜单偏向"项目多 × 国家小"的选手;3 个级别一起看更公平。',
    '`sub_id = 1` 过滤改名 / 国籍变化的副行,避免同人多算。',
  ],
  edgesEn: [
    '"Event" deduped by `event.name` string — discontinued events (magic / 333mbo) all count, since this is historical.',
    'NR is comparatively easy in small countries, so the National tier tilts toward "many events × small country" cubers — read all 3 tiers together for fairness.',
    '`sub_id = 1` filter drops alt-identity rows from renames / nationality changes to prevent double-counting.',
  ],
  related: [
    { id: 'world_records_by_person', titleZh: '个人 WR 总数', titleEn: 'WRs by person', hintZh: '广度 vs 深度', hintEn: 'Breadth vs depth'
    },
    { id: 'first_r_is_wr', titleZh: '首条即 WR', titleEn: 'First record is WR', hintZh: '入门即 WR vs 多项目均刷', hintEn: 'Debut WR vs many-event sweep'
    },
    { id: 'longest_standing_records', titleZh: '最长保持纪录', titleEn: 'Longest-standing records', hintZh: '广度 vs 单条寿命', hintEn: 'Breadth vs single-record longevity'
    },
    { id: 'records_in_most_events', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: '3 级别 Top 20', hintEn: '3 tiers Top 20'
    },
  ]
};

// ──── winned_week_count ─────────────────────────────────────────────────────
const winned_week_count: AboutEntry = {
  id: 'winned_week_count',
  titleZh: '获胜周数',
  titleEn: 'Winned week count',
  badgeZh: '周王',
  badgeEn: 'Week king',
  introZh: [
    '把时间切成 ISO 周 (周一 ~ 周日),对每个项目数:这个选手在多少周内做出了**当周全球最快单次**。',
    '"周王" —— 看的不是历史总分,而是周与周的统治力。一个 WR 持有几年可能就几个 winned weeks (因为后面有别人小幅打破),而高频出战的选手可能积累大量。',
  ],
  introEn: [
    'Slices time into ISO weeks (Mon-Sun). Per event, counts: in how many weeks did this cuber post the **globally fastest single of that week**.',
    '"Week king" — measures week-by-week dominance, not all-time totals. A long-standing WR holder might only have a few winned weeks (anyone else beating it for one week ends the streak), while a frequent flyer accumulates many.',
  ],
  stats: [
    { value: 'ISO 周', labelZh: '时间粒度', labelEn: 'Time bucket', hintZh: '周一 00:00 ~ 周日 23:59', hintEn: 'Mon 00:00 - Sun 23:59'
    },
    { value: '只看 single', labelZh: '指标', labelEn: 'Metric', hintZh: '`best` 列,不看 average', hintEn: '`best` only, no average'
    },
    { value: '20', labelZh: '每项目条数', labelEn: 'Per-event rows', hintZh: 'Top 20', hintEn: 'Top 20'
    },
    { value: '并列计数', labelZh: '同周多人', labelEn: 'Co-winners', hintZh: '`DISTINCT (event,best,week)`', hintEn: '`DISTINCT (event,best,week)`' },
  ],
  sourceZh: [
    '内层 SQL:对每周 (`WEEKDAY` + `DATE_ADD` 算周一 / 周日) 算 `MIN(best)` —— 该周该项目的最佳单次。外层 join 回 `results`,找出 `best = week_best` 的选手 ,`GROUP BY event_id, person_id` 数 winned_weeks。',
    '排序在 JS `transform()` 里完成:按项目分组,各取 Top 20。',
  ],
  sourceEn: [
    'Inner SQL: for each ISO week (`WEEKDAY` + `DATE_ADD` to derive Mon / Sun bounds), compute `MIN(best)` — the week\'s best single per event. Outer joins back to `results`, finds cubers matching `best = week_best`, `GROUP BY event_id, person_id` counts winned_weeks.',
    'Sorting happens in JS `transform()` — group by event, take Top 20 each.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `-- per-week best per event (inner)
SELECT event_id, MIN(best) week_best,
       DATE_ADD(start_date, INTERVAL(-WEEKDAY(start_date)) DAY) week_start
FROM results
JOIN competitions ON competitions.id = competition_id
WHERE best > 0
GROUP BY event_id, week_start

-- (outer) match cubers to week_best, count distinct weeks won
SELECT event_id, person_id,
       COUNT(DISTINCT event_id, best, week_start_date) winned_weeks
FROM ... GROUP BY event_id, person_id`,
  },
  steps: [
    {
      titleZh: '推 ISO 周边界',
      titleEn: 'Derive ISO week bounds',
      bodyZh: '`week_start = start_date - WEEKDAY(start_date)` (周一), `week_end = start_date + (6 - WEEKDAY)` (周日)。',
      bodyEn: '`week_start = start_date - WEEKDAY(start_date)` (Monday), `week_end = start_date + (6 - WEEKDAY)` (Sunday).'
    },
    {
      titleZh: '算每周每项目 MIN(best)',
      titleEn: 'Compute per-week per-event MIN(best)',
      bodyZh: '`GROUP BY event_id, week_start_date`,得"该周该项目最快单次"。',
      bodyEn: '`GROUP BY event_id, week_start_date`, yielding "fastest single per event per week".'
    },
    {
      titleZh: 'join 回 results 找持有者',
      titleEn: 'Join back to find holder(s)',
      bodyZh: '匹配 `best = week_best` + 比赛日期落在周窗内 —— 不只一人时,大家都算"周王" (并列)。',
      bodyEn: 'Match `best = week_best` + comp date in the week window — multiple matches all win the week (tied co-kings).'
    },
    {
      titleZh: 'COUNT DISTINCT 防同周多场',
      titleEn: 'COUNT DISTINCT for multi-comp weeks',
      bodyZh: '`COUNT(DISTINCT event_id, best, week_start)` —— 同周该选手在多场比赛都跑到 week_best,也算 1 周。',
      bodyEn: '`COUNT(DISTINCT event_id, best, week_start)` — if a cuber matched week_best at multiple comps in the same week, still 1 week.'
    },
    {
      titleZh: '按项目降序 Top 20',
      titleEn: 'Sort desc, Top 20 per event',
      bodyZh: 'JS 里按 `event_id` 桶分,每桶 winned_weeks 降序前 20。',
      bodyEn: 'JS buckets by `event_id`, each bucket sorted desc by winned_weeks, Top 20.',
      highlight: true
    },
  ],
  edgesZh: [
    'ISO 周以周一为起点(用 `WEEKDAY()`,周一 = 0,周日 = 6) —— 跨年 W52/W01 都按数学推,不走 ISO `YEARWEEK()` 复杂规则。',
    '没有比赛的周不计入 (没人跑出 week_best) —— 比如圣诞 / 疫情期间会有"空周"。',
    '同周并列 (多人同值) 全部算赢家,不分先后日期 —— 这是 WCA "regional records 同分并列"的延伸。',
    '只看 single,不算 average —— 类似指标用 average 会受 5 次/掐尾规则影响,口径复杂。',
  ],
  edgesEn: [
    'ISO weeks start Monday (`WEEKDAY()` = 0 for Mon, 6 for Sun) — year boundaries W52/W01 follow simple date math, not the formal ISO `YEARWEEK()` rule.',
    'Weeks with no comps don\'t count (no one posted week_best) — Christmas / pandemic gaps produce empty weeks.',
    'Same-week ties all win — extending WCA\'s "tied regional records both count" rule.',
    'Single only, not average — average\'s 5-solve trim rules complicate the metric.',
  ],
  related: [
    { id: 'world_records_by_person', titleZh: '个人 WR 数', titleEn: 'WRs by person', hintZh: 'WR vs 周王', hintEn: 'WR vs week king'
    },
    { id: 'wr_dominance', titleZh: 'WR 支配度', titleEn: 'WR dominance', hintZh: '长期统治力', hintEn: 'Long-term dominance'
    },
    { id: 'longest_streak_of_world_records', titleZh: '连续 WR 链', titleEn: 'WR streak', hintZh: '连续刷新 vs 周冠数', hintEn: 'Consecutive holds vs week counts'
    },
    { id: 'winned_week_count', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: '项目切换 + Top 20', hintEn: 'Event picker + Top 20'
    },
  ]
};

// ──── world_championship_podiums_by_country ─────────────────────────────────
const world_championship_podiums_by_country: AboutEntry = {
  id: 'world_championship_podiums_by_country',
  titleZh: '各国世锦赛领奖台次数',
  titleEn: 'World Championship podiums by country',
  badgeZh: '世锦赛',
  badgeEn: 'Worlds',
  introZh: [
    '只看 WCA World Championship (官方世锦赛,每 2 年一届) 的决赛领奖台,按选手国籍汇总金 / 银 / 铜。',
    '通过 `championships` 表里 `championship_type = world` 标识 —— WCA dump 用这张表标注每场比赛"是否是某届世锦赛"。',
  ],
  introEn: [
    'Counts decision-round podiums at WCA World Championships (every 2 years) only, aggregated by competitor nationality (gold / silver / bronze).',
    'A comp is "Worlds" if `championships.championship_type = world`. WCA\'s dump uses this table to tag each comp with its championship status.',
  ],
  stats: [
    { value: '`championship_type = world`', labelZh: '世锦赛过滤', labelEn: 'Worlds filter', hintZh: '排掉 nationals / continentals', hintEn: 'Excludes nationals / continentals'
    },
    { value: '决赛轮', labelZh: '只看金银铜', labelEn: 'Final-round only', hintZh: '`round_type_id IN (c, f)`', hintEn: '`round_type_id IN (c, f)`'
    },
    { value: '`pos ∈ {1,2,3}`', labelZh: '领奖台', labelEn: 'Podium', hintZh: 'WCA 预算 pos', hintEn: 'WCA-precomputed pos'
    },
    { value: '金 → 银 → 铜', labelZh: '排序键', labelEn: 'Sort key', hintZh: '奥运奖牌榜风格', hintEn: 'Olympic medal-table style'
    },
  ],
  sourceZh: [
    '`results` join `competitions` join `championships` (内连接,只留 Worlds 比赛)。同 medal_from_abroad 套路:决赛轮 + 完赛 + `SUM IF(pos = ...)` 三档分别汇总;`GROUP BY result.country_id` 按选手国籍。',
  ],
  sourceEn: [
    '`results` joined to `competitions` joined to `championships` (inner join keeps Worlds only). Same medal_from_abroad pattern: final rounds + completed + `SUM IF(pos = ...)` for each tier; `GROUP BY result.country_id` by competitor nationality.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT result.country_id,
       SUM(IF(pos = 1, 1, 0)) gold_medals,
       SUM(IF(pos = 2, 1, 0)) silver_medals,
       SUM(IF(pos = 3, 1, 0)) bronze_medals
FROM results
JOIN competitions ON competitions.id = competition_id
JOIN championships ON championships.competition_id = results.competition_id
WHERE round_type_id IN ('c', 'f')
  AND best > 0
  AND championship_type = 'world'
GROUP BY result.country_id`,
  },
  steps: [
    {
      titleZh: 'join `championships` 锁 Worlds',
      titleEn: 'Join `championships`, filter Worlds',
      bodyZh: '内连接自动过滤掉非世锦赛比赛;再 `championship_type = world` 排掉洲锦赛 / 国锦赛。',
      bodyEn: 'Inner join automatically drops non-championship comps; `championship_type = world` further excludes continentals / nationals.'
    },
    {
      titleZh: '保留决赛轮 + 完赛',
      titleEn: 'Keep finals + completed',
      bodyZh: '`round_type_id IN (c, f)` + `best > 0`,同 by_abroad。',
      bodyEn: '`round_type_id IN (c, f)` + `best > 0`, same as by_abroad.'
    },
    {
      titleZh: '三档分别 SUM',
      titleEn: 'Sum each medal tier',
      bodyZh: '`SUM(IF(pos = 1, 1, 0))` 金,同理银 / 铜。',
      bodyEn: '`SUM(IF(pos = 1, 1, 0))` for gold, similarly silver / bronze.'
    },
    {
      titleZh: '按选手国籍汇总',
      titleEn: 'Roll up by competitor country',
      bodyZh: '`GROUP BY result.country_id` —— 即使该届世锦赛在美国办,中国选手拿金牌算 CN gold。',
      bodyEn: '`GROUP BY result.country_id` — if Worlds is in the US but a CN cuber wins gold, it counts as CN gold.',
      highlight: true
    },
  ],
  edgesZh: [
    '世锦赛办过的届数有限 (1982 第一届,2003 复办后每 2 年一届),所以总样本远小于"海外奖牌";顶部国家以少胜多。',
    '`championships` 表对每场比赛只挂 1 个 championship_type;WC + CC 双挂的情况 (一个比赛同时是世锦赛和洲锦赛) 极少。',
    '同 medal_from_abroad,`best > 0` 防 DNF "登顶"。',
  ],
  edgesEn: [
    'Worlds has happened sparingly (1982 first, biennial since 2003), so sample size is much smaller than abroad medals; top-country totals are concentrated.',
    '`championships` table assigns one championship_type per comp; a single comp tagged both Worlds + Continental is essentially nonexistent.',
    'Same as medal_from_abroad, `best > 0` strips DNF-as-1st cases.',
  ],
  related: [
    { id: 'world_championship_podiums_by_person', titleZh: '世锦赛奖牌(选手)', titleEn: 'Worlds podiums by person', hintZh: '换个体维度', hintEn: 'Per-person version'
    },
    { id: 'world_championship_records', titleZh: '世锦赛纪录', titleEn: 'Worlds records', hintZh: '世锦赛 WR 子集', hintEn: 'Worlds-WR subset'
    },
    { id: 'best_medal_collection_from_abroad_by_country', titleZh: '海外奖牌(国家)', titleEn: 'Abroad medals (country)', hintZh: '所有海外赛 vs 仅世锦赛', hintEn: 'All abroad vs Worlds only'
    },
    { id: 'world_championship_podiums_by_country', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: '国家奖牌榜', hintEn: 'Country medal table'
    },
  ]
};

// ──── world_championship_podiums_by_person ──────────────────────────────────
const world_championship_podiums_by_person: AboutEntry = {
  id: 'world_championship_podiums_by_person',
  titleZh: '世锦赛领奖台次数(选手)',
  titleEn: 'World Championship podiums by person',
  badgeZh: '世锦赛',
  badgeEn: 'Worlds',
  introZh: [
    '同 by_country,但 `GROUP BY person_id`,按选手累计世锦赛金 / 银 / 铜。一个选手在多届 Worlds 多个项目累计,数字可以很大。',
    '同 medal_from_abroad,过滤是决赛 + 完赛 + `championship_type = world`。',
  ],
  introEn: [
    'Same as by_country, but `GROUP BY person_id` — gold / silver / bronze a single cuber has accumulated across Worlds editions. Numbers can climb high when one cuber wins multiple events across multiple Worlds.',
    'Same filter chain as medal_from_abroad: final round + completed + `championship_type = world`.',
  ],
  stats: [
    { value: 'sub_id = 1', labelZh: '主身份', labelEn: 'Primary identity', hintZh: '过滤改名 / 国籍变化副行', hintEn: 'Filters alt rows from renames / nationality'
    },
    { value: '`championship_type = world`', labelZh: '世锦赛过滤', labelEn: 'Worlds filter', hintZh: '同 by_country', hintEn: 'Same as by_country'
    },
    { value: '金 → 银 → 铜', labelZh: '排序', labelEn: 'Sort', hintZh: '奥运奖牌榜风格', hintEn: 'Olympic medal-table style'
    },
    { value: '决赛 + 完赛', labelZh: '入榜条件', labelEn: 'Inclusion', hintZh: '`round_type_id IN (c, f)` + `best > 0`', hintEn: '`round_type_id IN (c, f)` + `best > 0`'
    },
  ],
  sourceZh: [
    '同 by_country,改 `GROUP BY person_id`;join `persons` (`sub_id = 1`) 拿展示名;无 LIMIT —— 不像 abroad 截到 100,Worlds 因为样本小本来就短。',
  ],
  sourceEn: [
    'Same as by_country, `GROUP BY person_id`; join `persons` (`sub_id = 1`) for display name; no LIMIT — unlike abroad which caps at 100, Worlds is short by nature.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_id,
       SUM(IF(pos = 1, 1, 0)) gold_medals,
       SUM(IF(pos = 2, 1, 0)) silver_medals,
       SUM(IF(pos = 3, 1, 0)) bronze_medals
FROM results
JOIN competitions ON competitions.id = competition_id
JOIN championships ON championships.competition_id = results.competition_id
WHERE round_type_id IN ('c', 'f')
  AND best > 0
  AND championship_type = 'world'
GROUP BY person_id`,
  },
  steps: [
    {
      titleZh: '同 by_country 的过滤',
      titleEn: 'Same filter as by_country',
      bodyZh: '`championship_type = world` + 决赛 + 完赛。',
      bodyEn: '`championship_type = world` + final-round + completed.'
    },
    {
      titleZh: '`GROUP BY person_id`',
      titleEn: 'Aggregate by person',
      bodyZh: '同 medal_from_abroad_by_person 套路。',
      bodyEn: 'Same pattern as medal_from_abroad_by_person.',
    },
    {
      titleZh: 'join `persons` 主身份',
      titleEn: 'Join `persons` primary',
      bodyZh: '`sub_id = 1` 防同人多行重复;改国籍的选手保留当前国名展示。',
      bodyEn: '`sub_id = 1` prevents duplicate rows from identity changes; cubers who changed nationality show current country.'
    },
    {
      titleZh: '排序输出',
      titleEn: 'Sort + emit',
      bodyZh: '`gold DESC, silver DESC, bronze DESC, name`;Worlds 样本小,Top 10 就能看到主要面孔。',
      bodyEn: '`gold DESC, silver DESC, bronze DESC, name`; Worlds sample is small, the Top 10 already covers most familiar names.',
      highlight: true
    },
  ],
  edgesZh: [
    '选手国籍变化:dump 里 `result.country_id` 是当时国籍,不会回填;但 `persons.country_id` (sub_id = 1) 显示当前国籍。"国家"列可能跟历史身份不符。',
    '同届世锦赛多项目多领奖台 → 多次累计 (无去重)。',
    'Worlds 样本量小,前 5 大概覆盖一半 —— 头部效应明显。',
  ],
  edgesEn: [
    'Nationality changes: `result.country_id` is at-time, never back-filled; `persons.country_id` (sub_id = 1) is current. The displayed country may not match the country at the time of the medal.',
    'Multiple events at one Worlds = multiple medal accumulations (no per-comp dedup).',
    'Worlds sample is small; the top 5 cover about half the total — heavy long tail.',
  ],
  related: [
    { id: 'world_championship_podiums_by_country', titleZh: '世锦赛奖牌(国家)', titleEn: 'Worlds podiums by country', hintZh: '聚合到国家维度', hintEn: 'Country-level aggregation'
    },
    { id: 'world_championship_records', titleZh: '世锦赛纪录', titleEn: 'Worlds records', hintZh: 'Worlds 的 WR 子集', hintEn: 'Worlds-only WR subset'
    },
    { id: 'best_medal_collection_from_abroad_by_person', titleZh: '海外奖牌(选手)', titleEn: 'Abroad medals (person)', hintZh: '更广口径', hintEn: 'Broader-scope counterpart'
    },
    { id: 'world_championship_podiums_by_person', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: '选手奖牌榜', hintEn: 'Person medal table'
    },
  ]
};

// ──── world_championship_records ────────────────────────────────────────────
const world_championship_records: AboutEntry = {
  id: 'world_championship_records',
  titleZh: '世锦赛纪录',
  titleEn: 'World Championship records',
  badgeZh: '世锦赛',
  badgeEn: 'Worlds',
  introZh: [
    '类似奥运纪录:在所有 WCA 世锦赛上,每个项目的最佳 single 和 average。**不要求是 WR** —— 即使比当时 WR 慢,也算"世锦赛纪录"。',
    '换言之:把全 Worlds 的成绩缩成 (项目, 类型) 二维,各取最快。',
  ],
  introEn: [
    'Like Olympic records: for every event, the best single and best average ever achieved across all WCA Worlds. **Not required to be a WR** — even if slower than the prevailing WR, it\'s still the "Worlds record".',
    'In effect: shrink all Worlds results to a (event, type) 2D grid, keeping the fastest each.',
  ],
  stats: [
    { value: '2', labelZh: '类型', labelEn: 'Types', hintZh: 'Single + Average', hintEn: 'Single + Average'
    },
    { value: '`SolveTime` 比较', labelZh: 'DNF 安全', labelEn: 'DNF-safe', hintZh: '不简单 MIN,要 isComplete()', hintEn: 'Not naive MIN — uses isComplete()'
    },
    { value: 'EVENTS_ENTRIES', labelZh: '官方项目顺序', labelEn: 'Official event order', hintZh: 'WCA event sort', hintEn: 'WCA event sort'
    },
    { value: '`championship_type = world`', labelZh: '世锦赛过滤', labelEn: 'Worlds filter', hintZh: '同 podium 系列', hintEn: 'Same as podium siblings'
    },
  ],
  sourceZh: [
    'SQL 只拉所有 Worlds 比赛 (`championships.championship_type = world`) 的 `results` + 选手 + 国家 + 比赛信息。"找最快"在 JS `transform()` 用 `SolveTime.compareTo()` 比较 (DNF 自动排到最后)。',
  ],
  sourceEn: [
    'SQL pulls all Worlds (`championships.championship_type = world`) results + person + country + comp info. "Find fastest" runs in JS `transform()` via `SolveTime.compareTo()` (DNF auto-sorts to last).',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT event_id,
       person.name, competition.cell_name,
       country.name country_name,
       best single, average
FROM results
JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
JOIN competitions competition ON competition.id = competition_id
JOIN countries country ON country.id = person.country_id
JOIN championships ON championships.competition_id = results.competition_id
WHERE championship_type = 'world'`,
  },
  steps: [
    {
      titleZh: '拉所有 Worlds 成绩',
      titleEn: 'Pull all Worlds results',
      bodyZh: 'inner join `championships` + `WHERE championship_type = world`;不限决赛 (预赛 / 半决也算 —— 那一轮若打出最快,也是世锦赛纪录)。',
      bodyEn: 'Inner join `championships` + `WHERE championship_type = world`. Doesn\'t restrict to finals — semi-finals / first rounds qualify if they happened to be the fastest.'
    },
    {
      titleZh: '按 (项目, 类型) 桶分',
      titleEn: 'Bucket by (event, type)',
      bodyZh: '外层循环 `[Single, Average]`,内层 `Map<event, {result, row}>` 追踪当前最佳。',
      bodyEn: 'Outer loop on `[Single, Average]`, inner `Map<event, {result, row}>` tracks current best.'
    },
    {
      titleZh: '`SolveTime.compareTo()` 比较',
      titleEn: '`SolveTime.compareTo()` comparison',
      bodyZh: '不直接比 `Number(best)` —— `SolveTime` 帮你处理 DNF 编码 (-1) / 未提交 (0) / FMC / MBLD 等特殊指标。',
      bodyEn: 'Doesn\'t directly compare `Number(best)` — `SolveTime` handles DNF encoding (-1) / unattempted (0) / FMC / MBLD special metrics.'
    },
    {
      titleZh: '按 EVENTS_ENTRIES 顺序输出',
      titleEn: 'Emit per EVENTS_ENTRIES order',
      bodyZh: '按 WCA 官方项目顺序 (3x3 → 2x2 → 4x4 → ...) 排序输出 —— 每项目 1 行。',
      bodyEn: 'Output in WCA official event order (3x3 → 2x2 → 4x4 → ...) — one row per event.'
    },
    {
      titleZh: '过滤 `isComplete()`',
      titleEn: 'Filter via `isComplete()`',
      bodyZh: '`!entry.result.isComplete()` (即 DNF) 的项目不输出 —— 譬如某项目所有 Worlds 历史 average 都 DNF (罕见),那个项目不上表。',
      bodyEn: '`!entry.result.isComplete()` (i.e. DNF) — events where all Worlds-history averages are DNF (rare) get skipped.',
      highlight: true
    },
  ],
  edgesZh: [
    '"世锦赛纪录"≠ WR;比 WR 慢的成绩照样可以是 WCR (e.g. 某项目 WR 在某届非 Worlds 比赛打出,Worlds 上的最佳 < WR)。',
    '不限决赛 —— 预赛打出超快单次也算 (虽然实际罕见,因为决赛通常是表现高点)。',
    'FMC / MBLD 的 average 计算用 `SolveTime` 内部规则;MBLD `best` 用 score 编码 (尝试 / 完成 / 时间),不要直接看数值。',
  ],
  edgesEn: [
    '"Worlds record" ≠ WR; a slower-than-WR result can still be the WCR (e.g. an event\'s WR was set at a non-Worlds comp; the best at Worlds is slower than the WR).',
    'Doesn\'t restrict to finals — prelim heats can hold the record (rare in practice since finals usually peak).',
    'FMC / MBLD averages use `SolveTime` internal rules; MBLD `best` encodes score (attempted / solved / time), don\'t read raw number.',
  ],
  related: [
    { id: 'world_championship_podiums_by_country', titleZh: '世锦赛奖牌(国家)', titleEn: 'Worlds medals (country)', hintZh: '同源,看奖牌而非纪录', hintEn: 'Same source, medals not records'
    },
    { id: 'world_championship_podiums_by_person', titleZh: '世锦赛奖牌(选手)', titleEn: 'Worlds medals (person)', hintZh: '同源,选手维度', hintEn: 'Same source, per-person'
    },
    { id: 'world_records_by_person', titleZh: '个人 WR 总数', titleEn: 'WRs by person', hintZh: 'WCR vs WR', hintEn: 'WCR vs WR'
    },
    { id: 'world_championship_records', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: 'Single + Average 双表', hintEn: 'Single + Average dual table'
    },
  ]
};

// ──── world_records_by_country ──────────────────────────────────────────────
const world_records_by_country: AboutEntry = {
  id: 'world_records_by_country',
  titleZh: '各国世界纪录数量',
  titleEn: 'World records by country',
  badgeZh: '国家',
  badgeEn: 'Country',
  introZh: [
    '**历史所有** WR 按选手国籍累加 (不像 `current_world_records_by_country` 只数当前)。同一选手刷自己 5 次 = 5 个 WR;刷一次 single + 一次 average = 2 个。',
    '附带按年份累计的时间线 —— `/globe` 的 WR choropleth + year slider 用这个;`/wca/world_records_by_country` 页本身的年份 slider 也是。',
  ],
  introEn: [
    'Counts **all-time** WRs by competitor nationality (unlike `current_world_records_by_country` which counts only currently held). One cuber improving their own WR 5 times = 5 WRs; one single + one average WR = 2.',
    'Ships with a per-year cumulative timeline — used by `/globe` WR choropleth + year slider, and the year slider on the `/wca/world_records_by_country` page itself.',
  ],
  stats: [
    { value: 'YEAR(start_date)', labelZh: '年份切片', labelEn: 'Year bucketing', hintZh: 'WCA 比赛起始日为准', hintEn: 'Based on comp start date'
    },
    { value: 'single + average', labelZh: 'WR 计数', labelEn: 'WR counting', hintZh: '每行至多 2 个 WR', hintEn: 'Up to 2 WRs per row'
    },
    { value: 'years[]', labelZh: '稠密年份轴', labelEn: 'Dense year axis', hintZh: '空年也占位', hintEn: 'Empty years held as placeholders'
    },
    { value: 'cumulative{}', labelZh: '累计稠密数组', labelEn: 'Cumulative dense array', hintZh: '每国一个 years.length 数组', hintEn: 'One years.length array per country'
    },
  ],
  sourceZh: [
    'SQL `GROUP BY country.id, year`,`SUM(IF(... = WR, 1, 0))` 数 WR 次数。`toJson()` 后处理:把 (country, year, count) 稀疏行转成稠密 `cumulative: {country: number[]}` —— 索引 i 对应 years[i] 年累计值。',
    '`years[]` 从最早 WR 年到当前年 (`minYear` .. `new Date().getFullYear()`);中间没 WR 的年也占一格,保证时间轴连续。',
  ],
  sourceEn: [
    'SQL `GROUP BY country.id, year`, `SUM(IF(... = WR, 1, 0))` counts WRs. `toJson()` post-processing: convert sparse (country, year, count) rows into a dense `cumulative: {country: number[]}` — index i corresponds to years[i] cumulative.',
    '`years[]` spans `minYear` .. current year; empty years still take a slot to keep the timeline contiguous.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT country.name AS country,
       YEAR(comp.start_date) AS year,
       SUM(IF(regional_single_record = 'WR', 1, 0)
         + IF(regional_average_record = 'WR', 1, 0)) AS wrs
FROM results
JOIN competitions comp ON comp.id = results.competition_id
JOIN countries country ON country.id = results.country_id
WHERE regional_single_record = 'WR' OR regional_average_record = 'WR'
GROUP BY country.id, year
ORDER BY year, country.name`,
  },
  steps: [
    {
      titleZh: '过滤 WR 行',
      titleEn: 'Filter WR-only rows',
      bodyZh: '`WHERE regional_single_record = WR OR regional_average_record = WR` —— 排掉 NR / CR / 空。',
      bodyEn: '`WHERE regional_single_record = WR OR regional_average_record = WR` — drops NR / CR / blank.'
    },
    {
      titleZh: '按 (国家, 年) 分组',
      titleEn: 'Bucket by (country, year)',
      bodyZh: '`YEAR(comp.start_date)` 切年;SUM 两列 IF 加起来 —— 同行 single + average WR 双开算 2。',
      bodyEn: '`YEAR(comp.start_date)` for year; SUM both `IF` columns — single + average on same row contribute 2.'
    },
    {
      titleZh: '推稠密 years[]',
      titleEn: 'Derive dense years[]',
      bodyZh: 'JS 算 `minYear`,从 minYear 到当前年逐年 push;空年保留为 0。',
      bodyEn: 'JS computes `minYear` and pushes year by year up to current; empty years stay 0.'
    },
    {
      titleZh: '累计扫描',
      titleEn: 'Cumulative scan',
      bodyZh: '每国一个数组,`cum += byYear.get(y) ?? 0`,产生 N 年长度的累计序列。',
      bodyEn: 'Per country, `cum += byYear.get(y) ?? 0`, yielding N-year cumulative sequence.'
    },
    {
      titleZh: '主 rows = 截至最后一年',
      titleEn: 'Main rows = final-year total',
      bodyZh: '`rows = cumulative.map(arr => arr[last])`,按总数降序 + 国名字母序 (tiebreak);0 国家过滤。',
      bodyEn: '`rows = cumulative.map(arr => arr[last])`, sorted desc + country name tiebreak; countries with 0 filtered out.',
      highlight: true
    },
  ],
  edgesZh: [
    '历史 WR 不会因后续超越而清除标记 —— 算的就是"曾经的 WR",所以同一项目 WR 进化史里每条都进总数。',
    '"国家"按打破 WR 时的选手国籍 (`result.country_id` 当时值);改国籍后旧 WR 仍归原国。',
    'WCA dump 是历史口径,WR 标记跟"破纪录顺序"绑死 (并列 WR 都打标);所以同值并列时 2 个国家各 +1。',
    '`/globe` 把 `cumulative` 一帧帧映射成 choropleth,时间轴回放 1982 → 今天的 WR 集中度演化。',
  ],
  edgesEn: [
    'Historical WR markers don\'t get removed when broken — this is "ever-WR" count, so every entry in an event\'s WR evolution feeds the total.',
    'Country = competitor nationality at time of record (`result.country_id` at-time); changing nationality doesn\'t reattribute old WRs.',
    'WCA dump treats record markers as "did this break the WR" (ties both tagged); so tied WRs credit 2 countries each +1.',
    '`/globe` maps `cumulative` frame-by-frame onto a choropleth — time slider replays 1982 → today WR concentration.',
  ],
  related: [
    { id: 'current_world_records_by_country', titleZh: '当前 WR(国家)', titleEn: 'Current WRs (country)', hintZh: '累计 vs 当前', hintEn: 'All-time vs current'
    },
    { id: 'world_records_by_person', titleZh: '个人 WR 总数', titleEn: 'WRs by person', hintZh: '同口径,选手维度', hintEn: 'Same metric, per-person'
    },
    { id: 'first_r_is_wr', titleZh: '首条即 WR', titleEn: 'First record is WR', hintZh: '稀有事件子集', hintEn: 'Rare-event subset'
    },
    { id: 'world_records_by_country', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: '国家榜 + 年份 slider', hintEn: 'Country leaderboard + year slider'
    },
  ]
};

// ──── world_records_by_person ───────────────────────────────────────────────
const world_records_by_person: AboutEntry = {
  id: 'world_records_by_person',
  titleZh: '个人世界纪录数量',
  titleEn: 'World records by person',
  badgeZh: '选手',
  badgeEn: 'Person',
  introZh: [
    '历史累计 —— 每个选手生涯破过多少次 WR (single + average 各计 1 次)。和 by_country 同源,只换 `GROUP BY`。',
    '榜首通常是个位数双位数,因为 WR 是稀缺资源 (整个 WCA 每年也就几十个新 WR)。',
  ],
  introEn: [
    'All-time per-cuber WR break count (single + average each contribute 1). Same source as by_country, only `GROUP BY` swap.',
    'Top values usually in single / double digits — WRs are scarce (the entire WCA produces only a few dozen new WRs per year).',
  ],
  stats: [
    { value: 'single + average', labelZh: '两列各算 1', labelEn: 'Each column = 1', hintZh: '同行可计 2', hintEn: 'Same row can be 2'
    },
    { value: '`HAVING > 0`', labelZh: '过滤 0', labelEn: 'Drop zeros', hintZh: '没破过 WR 的人不上榜', hintEn: 'Cubers with 0 WRs excluded'
    },
    { value: 'sub_id = 1', labelZh: '主身份', labelEn: 'Primary identity', hintZh: '同其他 person 榜', hintEn: 'Same as other person leaderboards' },
    { value: 'name 字母序 tiebreak', labelZh: '同分排序', labelEn: 'Tied-name sort', hintZh: '相同 WR 数按字母', hintEn: 'Same count → alphabetical'
    },
  ],
  sourceZh: [
    '`results` 算 `SUM(IF(regional_single_record = WR, 1, 0) + IF(regional_average_record = WR, 1, 0))`,`GROUP BY person_id` + `HAVING > 0`。join `persons` (`sub_id = 1`)。',
  ],
  sourceEn: [
    '`results` aggregates `SUM(IF(regional_single_record = WR, 1, 0) + IF(regional_average_record = WR, 1, 0))`, `GROUP BY person_id` + `HAVING > 0`. Joined to `persons` (`sub_id = 1`).',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_id,
       SUM(IF(regional_single_record = 'WR', 1, 0)
         + IF(regional_average_record = 'WR', 1, 0)) wrs_count
FROM results
GROUP BY person_id
HAVING wrs_count > 0
ORDER BY wrs_count DESC, person.name`,
  },
  steps: [
    {
      titleZh: '`SUM IF` 数 WR',
      titleEn: '`SUM IF` to count WRs',
      bodyZh: '单行 single + average 都标 WR 时贡献 2;只标一个贡献 1;都没标 0。',
      bodyEn: 'Same row with both single + average WR contributes 2; one tag = 1; neither = 0.'
    },
    {
      titleZh: '`GROUP BY person_id`',
      titleEn: 'Aggregate per person',
      bodyZh: '每人一行,累计所有项目所有时间。',
      bodyEn: 'One row per cuber, accumulating across all events and all time.'
    },
    {
      titleZh: '`HAVING wrs_count > 0`',
      titleEn: '`HAVING wrs_count > 0`',
      bodyZh: '没破过 WR 的人 (绝大多数 WCA 选手) 排掉;否则榜单几十万人。',
      bodyEn: 'Cubers who never broke a WR (the vast majority of WCA) excluded; otherwise the leaderboard would be hundreds of thousands long.'
    },
    {
      titleZh: '降序 + name 字母 tiebreak',
      titleEn: 'Sort desc + name tiebreak',
      bodyZh: '同 WR 数 → 按姓名字母排;join `persons` 拿主身份名。',
      bodyEn: 'Same WR count → alphabetical by name; `persons` join brings primary identity.',
      highlight: true
    },
  ],
  edgesZh: [
    '同人同场刷自己 = 累计;e.g. 同场预赛 + 半决 + 决赛 single 都破 WR = 3 个 WR。',
    'WR 持有人改国籍不影响 WR 计数,只影响 by_country 归属。',
    '与 `records_in_most_events` (项目广度) 不同 —— 这里数次数,那边数不同项目数。',
    '没单独"当前"版,要看当前 WR 数走 `current_world_records_by_country` (但那是国家维度,WCA 没出当前 WR by person 的官方榜)。',
  ],
  edgesEn: [
    'Same cuber improving themselves all count: prelim + semi + final single WR at one comp = 3 WRs.',
    'WR-holder changing nationality doesn\'t affect their personal WR count, only by_country attribution.',
    'Different from `records_in_most_events` (event breadth) — here we count occurrences, not distinct events.',
    'No separate "current" version for persons; current-WR breakdown goes through `current_world_records_by_country` (country-level only).',
  ],
  related: [
    { id: 'world_records_by_country', titleZh: '各国 WR 数', titleEn: 'WRs by country', hintZh: '聚合到国家', hintEn: 'Aggregated to country'
    },
    { id: 'records_in_most_events', titleZh: '项目广度', titleEn: 'Records breadth', hintZh: '次数 vs 项目数', hintEn: 'Count vs distinct events'
    },
    { id: 'longest_streak_of_world_records', titleZh: '连续 WR 链', titleEn: 'WR streak', hintZh: 'WR 是否连续', hintEn: 'Whether WRs are consecutive'
    },
    { id: 'first_r_is_wr', titleZh: '首条即 WR', titleEn: 'First record is WR', hintZh: 'WR 入门姿势', hintEn: 'How they entered the WR club'
    },
    { id: 'world_records_by_person', toStat: true, titleZh: '打开实时榜单', titleEn: 'Jump to live data', hintZh: 'Top WR 大佬', hintEn: 'Top WR holders'
    },
  ]
};

export const RECORDS_COUNTRIES_ABOUT: Record<string, AboutEntry> = {
  best_medal_collection_from_abroad_by_country,
  best_medal_collection_from_abroad_by_person,
  current_world_records_by_country,
  delegated_competition_per_year,
  first_r_is_wr,
  longest_standing_records,
  longest_streak_of_world_records,
  most_delegated_competitions,
  potentially_seen_world_records,
  records_in_most_events,
  winned_week_count,
  world_championship_podiums_by_country,
  world_championship_podiums_by_person,
  world_championship_records,
  world_records_by_country,
  world_records_by_person,
};
