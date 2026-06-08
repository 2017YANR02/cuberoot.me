// 领奖台与荣誉 — about entries
import type { AboutEntry } from '../types';

// ──── best_result_off_podium ─────────────────────────────────────────────
const best_result_off_podium: AboutEntry = {
  id: 'best_result_off_podium',
  titleZh: '最佳非领奖台成绩 — 离奖牌最近的眼泪',
  titleEn: 'Best result not providing a podium',
  badgeZh: '荣誉',
  badgeEn: 'Honors',
  introZh: [
    '一个选手在决赛打出了**几乎可以拿奖牌**的成绩,但因为另外三个人更快、最后只排到第 4 或更后 —— 这条 stat 就是给这些"差一点"的成绩留个名字。',
    '换句话说,它把"项目历史上**没能进领奖台的最快成绩**"按项目列出来。可以读作"奖牌门槛的天花板"。',
  ],
  introEn: [
    'When a competitor posts a result in a final that would have medalled at almost any other competition, but three other people were faster on the day — this stat names that pain.',
    'In other words: the **fastest result per event that did NOT make the podium**. Read it as the soft ceiling above which finishing 4th still hurts.',
  ],
  stats: [
    { value: '17', labelZh: '覆盖项目', labelEn: 'Events', hintZh: '所有 WCA 项目分组排', hintEn: 'Grouped per WCA event',
        labelZhHant: "覆蓋項目",
        hintZhHant: "所有 WCA 項目分組排"
    },
    { value: 'pos > 3', labelZh: '过滤条件', labelEn: 'Filter', hintZh: '排除 1/2/3 名', hintEn: 'Drops 1st / 2nd / 3rd',
        labelZhHant: "過濾條件"
    },
    { value: '决赛', labelZh: '轮次范围', labelEn: 'Round scope', hintZh: '只看 round_type c / f', hintEn: 'Only finals (c, f)',
        labelZhHant: "輪次範圍"
    },
    { value: 'Top 10', labelZh: '每项目保留', labelEn: 'Per event', hintZh: '按主成绩升序前 10', hintEn: 'Top 10 by primary metric',
        labelZhHant: "每項目保留",
        hintZhHant: "按主成績升序前 10"
    },
  ],
  sourceZh: [
    '从 `results` 表筛 `round_type_id IN (\'c\', \'f\')`(综合决赛 / 决赛)且 `pos > 3`,join `persons`(`sub_id = 1` 取主身份)、`competitions`(取赛事名)、以及 `preferred_formats` + `formats`(拿到 `sort_by` / `sort_by_second`,决定该项目按 single 还是 average 排)。',
  ],
  sourceEn: [
    'From `results` filter `round_type_id IN (\'c\', \'f\')` (combined final / final) and `pos > 3`. Join `persons` (`sub_id = 1` for primary identity), `competitions` for the cell_name, and `preferred_formats` + `formats` to read `sort_by` / `sort_by_second` — these decide whether the event ranks by single or by average.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT format.sort_by, format.sort_by_second,
       results.event_id,
       best AS single, average,
       person.name, competition.cell_name,
       pos AS place
FROM results
JOIN persons person ON person.wca_id = person_id
                   AND person.sub_id = 1
JOIN competitions competition ON competition.id = competition_id
JOIN preferred_formats pf ON pf.event_id = results.event_id
                         AND pf.ranking = 1
JOIN formats format ON format.id = pf.format_id
WHERE round_type_id IN ('c', 'f') AND pos > 3;`,
  },
  steps: [
    {
      titleZh: '按项目分组',
      titleEn: 'Group by event',
      bodyZh: '遍历 17 个 WCA 项目,每个项目独立排榜 —— 不同项目用不同主成绩(single vs average),不能混排。',
      bodyEn: 'Iterate over all 17 WCA events; each event has its own leaderboard because the primary metric (single vs average) differs by event.',
        titleZhHant: "按項目分組",
        bodyZhHant: "遍歷 17 個 WCA 項目,每個項目獨立排榜 —— 不同項目用不同主成績(single vs average),不能混排。"
    },
    {
      titleZh: '解析主 / 次成绩',
      titleEn: 'Parse primary / secondary metric',
      bodyZh: '从 `preferred_formats` 读这个项目的 `sort_by`:333fm = "average",大多数项目 = "average",333bf / 333mbf / 333ft = "single"。`sort_by_second` 是平局打破字段。',
      bodyEn: 'Read the event\'s `sort_by` from `preferred_formats`: 333fm = "average", most events = "average", 333bf / 333mbf / 333ft = "single". `sort_by_second` breaks ties.',
        titleZhHant: "解析主 / 次成績",
        bodyZhHant: "從 `preferred_formats` 讀這個項目的 `sort_by`:333fm = \"average\",大多數項目 = \"average\",333bf / 333mbf / 333ft = \"single\"。`sort_by_second` 是平局打破欄位。"
    },
    {
      titleZh: '按主成绩升序',
      titleEn: 'Sort ascending by primary',
      bodyZh: '`SolveTime.compareTo` 知道 DNF / DNS 怎么排;先比主,主相等再比次。结果越小越靠前 —— 我们要的就是"最快的非领奖台"。',
      bodyEn: 'Use `SolveTime.compareTo` (it knows how DNF / DNS sort): compare primary first, then secondary on tie. Smaller is better — we want the fastest off-podium.',
        titleZhHant: "按主成績升序",
        bodyZhHant: "`SolveTime.compareTo` 知道 DNF / DNS 怎麼排;先比主,主相等再比次。結果越小越靠前 —— 我們要的就是\"最快的非領獎臺\"。"
    },
    {
      titleZh: '取前 10',
      titleEn: 'Take top 10',
      bodyZh: '排序后 `slice(0, 10)` 截前 10,组装成 `[选手, single, average, 比赛, 名次]` 五列;主成绩在表里加粗。',
      bodyEn: 'After sort, `slice(0, 10)` truncates to 10 rows of `[person, single, average, competition, place]`. Primary metric is bolded in the rendered table.',
      highlight: true,
        bodyZhHant: "排序後 `slice(0, 10)` 截前 10,組裝成 `[選手, single, average, 比賽, 名次]` 五列;主成績在表裡加粗。"
    },
  ],
  edgesZh: [
    '只看决赛 (`round_type c / f`) —— 预赛 / 半决里第 4 名不算,即使时间很快也无视。',
    '`pos > 3` 是 WCA 官方给的名次,平局并列规则已包含在内(并列第 3 仍然算第 3,不算"非领奖台")。',
    'DNF 主成绩(`value = -1`)排序时被推到最末,所以不会污染榜单(`SolveTime` 类负责)。',
    '`sub_id = 1` 过滤改名 / 换国籍生成的副 person 行,避免重复。',
  ],
  edgesEn: [
    'Only finals (`round_type c / f`) — fast 4th-place finishes in early rounds don\'t count.',
    '`pos > 3` is WCA\'s official placement (ties handled at the source — a co-3rd is still 3rd, not off-podium).',
    'DNF primary results sort last via `SolveTime.compareTo`, so they don\'t pollute the top of the off-podium list.',
    '`sub_id = 1` filters out alternate person rows from renames / country changes.',
  ],
  related: [
    { id: 'worst_result_on_podium', titleZh: '领奖台最差成绩', titleEn: 'Worst result on podium', hintZh: '镜像 stat — 拿了奖牌的最慢成绩', hintEn: 'Mirror stat — the slowest results that still medalled',
        titleZhHant: "領獎臺最差成績",
        hintZhHant: "映象 stat — 拿了獎牌的最慢成績"
    },
    { id: 'most_4th_places', titleZh: '最多第四名', titleEn: 'Most 4th places', hintZh: '按选手算"差一点"的累积次数', hintEn: 'Per-person tally of near-misses',
        hintZhHant: "按選手算\"差一點\"的累積次數"
    },
    { id: 'best_result_off_podium', toStat: true, titleZh: '直接打开排名', titleEn: 'Jump to the leaderboard', hintZh: '看每个项目的"差点拿奖"完整 top 10', hintEn: 'Full per-event top 10 of off-podium bests',
        titleZhHant: "直接開啟排名",
        hintZhHant: "看每個項目的\"差點拿獎\"完整 top 10"
    },
  ],
    titleZhHant: "最佳非領獎臺成績 — 離獎牌最近的眼淚",
    badgeZhHant: "榮譽"
};

// ──── complete_competition_winners ───────────────────────────────────────
const complete_competition_winners: AboutEntry = {
  id: 'complete_competition_winners',
  titleZh: '完全比赛冠军 — 包圆一场赛事',
  titleEn: 'Complete competition winners',
  badgeZh: '荣誉',
  badgeEn: 'Honors',
  introZh: [
    '某场比赛举办了 N 个项目,有一个选手把这 N 个项目的金牌**全部拿走** —— 这条 stat 就是收集这样的"全包"事件。',
    '事件数 N 越大越罕见。早期 weekend 小赛 5 - 8 项还可以个人通吃;现代 20 + 项目的大赛要全包需要从 333 到 333mbld 全能,几乎不可能。',
  ],
  introEn: [
    'When a single competition holds N events and one person wins gold in **every** one of them — that\'s a complete competition win.',
    'Bigger N = rarer. Small weekend comps of 5 - 8 events occasionally see a sweep; a modern 20+-event regional being swept by one cuber would require fluency from 3x3 through 3x3 multi-blind and effectively never happens.',
  ],
  stats: [
    { value: 'pos = 1', labelZh: '入选条件', labelEn: 'Filter', hintZh: '每个项目都拿第一', hintEn: 'Gold in every event',
        labelZhHant: "入選條件",
        hintZhHant: "每個項目都拿第一"
    },
    { value: 'HAVING = 1', labelZh: '关键 SQL', labelEn: 'SQL key', hintZh: '比赛里"第一名集合"只有 1 人', hintEn: 'Set of 1st-place people has size 1',
        labelZhHant: "關鍵 SQL",
        hintZhHant: "比賽裡\"第一名集合\"只有 1 人"
    },
    { value: '决赛', labelZh: '轮次范围', labelEn: 'Round scope', hintZh: '只看 round_type c / f', hintEn: 'Finals only',
        labelZhHant: "輪次範圍"
    },
    { value: 'DESC', labelZh: '排序', labelEn: 'Sort', hintZh: '项目数多者优先', hintEn: 'More events first',
        hintZhHant: "項目數多者優先"
    },
  ],
  sourceZh: [
    '内层在 `results` 上按 `competition_id` 分组,过滤 `round_type_id IN (\'c\', \'f\') AND pos = 1 AND best > 0`,然后 `GROUP_CONCAT(DISTINCT person_id)` + `HAVING COUNT(DISTINCT person_id) = 1`。这一步保证"该比赛所有冠军都是同一个人"。',
    '外层再 join `persons` / `competitions` / `countries` 拿展示字段;按 `events_count DESC` 排序。',
  ],
  sourceEn: [
    'The inner query groups `results` by `competition_id`, filters `round_type_id IN (\'c\', \'f\') AND pos = 1 AND best > 0`, then `GROUP_CONCAT(DISTINCT person_id)` with `HAVING COUNT(DISTINCT person_id) = 1` — ensuring every gold at that comp belongs to the same person.',
    'The outer query joins `persons` / `competitions` / `countries` for display, sorted by `events_count DESC`.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT events_count, person.name,
       country.name, competition.cell_name
FROM (
  SELECT competition_id,
         GROUP_CONCAT(DISTINCT person_id) AS person_id,
         COUNT(DISTINCT event_id)         AS events_count
  FROM results
  WHERE round_type_id IN ('c', 'f')
    AND pos = 1
    AND best > 0
  GROUP BY competition_id
  HAVING COUNT(DISTINCT person_id) = 1
) AS sweeps
JOIN persons person ON person.wca_id = person_id AND sub_id = 1
JOIN competitions competition ON competition.id = competition_id
JOIN countries country ON country.id = person.country_id
ORDER BY events_count DESC, person.name;`,
  },
  steps: [
    {
      titleZh: '按比赛收集所有金牌',
      titleEn: 'Collect all golds per comp',
      bodyZh: '内层 `GROUP BY competition_id`,把这场比赛每个项目的"第一名 person_id"汇总。',
      bodyEn: 'Inner query `GROUP BY competition_id`; for each comp, gather the person_id of every event\'s 1st place.',
        titleZhHant: "按比賽收集所有金牌",
        bodyZhHant: "內層 `GROUP BY competition_id`,把這場比賽每個項目的\"第一名 person_id\"彙總。"
    },
    {
      titleZh: '只留"一人通吃"',
      titleEn: 'Keep only single-person sweeps',
      bodyZh: '`HAVING COUNT(DISTINCT person_id) = 1` —— 集合大小必须正好 1。两人各拿几块金牌 = 不算。',
      bodyEn: '`HAVING COUNT(DISTINCT person_id) = 1` — the set of gold-medallists must have size exactly 1. Two people splitting golds doesn\'t qualify.',
        bodyZhHant: "`HAVING COUNT(DISTINCT person_id) = 1` —— 集合大小必須正好 1。兩人各拿幾塊金牌 = 不算。"
    },
    {
      titleZh: '数项目数',
      titleEn: 'Count events',
      bodyZh: '`COUNT(DISTINCT event_id)` 就是这场比赛的项目数 N —— 也是包圆的"难度"。',
      bodyEn: '`COUNT(DISTINCT event_id)` is the comp\'s event count N — also the sweep\'s difficulty.',
        titleZhHant: "數項目數",
        bodyZhHant: "`COUNT(DISTINCT event_id)` 就是這場比賽的項目數 N —— 也是包圓的\"難度\"。"
    },
    {
      titleZh: '关联展示字段并排序',
      titleEn: 'Join display fields and sort',
      bodyZh: '外层 join 把 wca_id / cell_name / country.name 拼成 markdown 链接,按 `events_count DESC` 然后按 person.name 字典序兜底。',
      bodyEn: 'Outer join attaches wca_id / cell_name / country.name as markdown links; sorts by `events_count DESC` then person.name as tiebreaker.',
      highlight: true,
        titleZhHant: "關聯展示欄位並排序",
        bodyZhHant: "外層 join 把 wca_id / cell_name / country.name 拼成 markdown 連結,按 `events_count DESC` 然後按 person.name 字典序兜底。"
    },
  ],
  edgesZh: [
    '`best > 0` 排除 DNF —— 即使你"获得"了第一名而成绩是 DNF,这条记录被过滤(很少见但理论可能,比如全员 DNF 时按 best 顺序仍有 pos = 1)。',
    '`round_type_id IN (\'c\', \'f\')` 只看最终轮,避免预赛"局部第一"误判。',
    '没有项目数下限,N = 1 的"独项目比赛"也会被包含(理论上单项目赛拿冠军就算包圆)。表头按 N 倒排,这些天然沉底。',
    '`sub_id = 1` 让某选手换国籍后,只用主行匹配,不重复出现。',
  ],
  edgesEn: [
    '`best > 0` excludes DNF results — even if a "DNF gold" technically exists, it doesn\'t qualify.',
    '`round_type_id IN (\'c\', \'f\')` restricts to actual finals; first-place finishes in early rounds don\'t count.',
    'No floor on N — a one-event comp where you win the only event is technically a sweep. They sink to the bottom in the N-DESC sort naturally.',
    '`sub_id = 1` keeps renames / country-changes from generating duplicate rows.',
  ],
  related: [
    { id: 'most_podiums_at_single_competition', titleZh: '单场比赛登台最多', titleEn: 'Most podiums at single comp', hintZh: '只要求"登台",不要求都金 — 门槛更低', hintEn: 'Same comp scope but counts any podium, not just gold',
        titleZhHant: "單場比賽登臺最多",
        hintZhHant: "只要求\"登臺\",不要求都金 — 門檻更低"
    },
    { id: 'most_finals', titleZh: '进入决赛最多', titleEn: 'Most finals', hintZh: '生涯级累积口径', hintEn: 'Career-level finals tally',
        titleZhHant: "進入決賽最多",
        hintZhHant: "生涯級累積口徑"
    },
    { id: 'complete_competition_winners', toStat: true, titleZh: '直接打开包圆名册', titleEn: 'Jump to the sweep registry', hintZh: '看每一场被某选手完全征服的比赛', hintEn: 'Every comp ever swept by one person',
        titleZhHant: "直接開啟包圓名冊",
        hintZhHant: "看每一場被某選手完全征服的比賽"
    },
  ],
    titleZhHant: "完全比賽冠軍 — 包圓一場賽事",
    badgeZhHant: "榮譽"
};

// ──── most_4th_places ────────────────────────────────────────────────────
const most_4th_places: AboutEntry = {
  id: 'most_4th_places',
  titleZh: '最多第四名 — "伴娘"榜',
  titleEn: 'Most 4th places',
  badgeZh: '荣誉',
  badgeEn: 'Honors',
  introZh: [
    '决赛第 4 名 —— 离奖牌一步之遥,却拿不到任何东西。这条 stat 按选手统计"决赛 4th"出现的总次数。',
    '叫"伴娘"(bridesmaid)是社区习惯。在比赛抽奖意义上没有任何价值,但它揭示了一个选手"长期处于顶尖决赛圈但常被前 3 压住"的画像。',
  ],
  introEn: [
    '4th place in a final — one slot from a medal, but no hardware. This stat counts career-wide "final 4ths" per person.',
    'Known as the "bridesmaid" stat. It rewards no one, but it does sketch a portrait of cubers who routinely make finals only to be pipped on the day.',
  ],
  stats: [
    { value: 'pos = 4', labelZh: '过滤条件', labelEn: 'Filter', hintZh: '只数第 4 名', hintEn: 'Counts only 4th place',
        labelZhHant: "過濾條件",
        hintZhHant: "只數第 4 名"
    },
    { value: 'final = 1', labelZh: '轮次范围', labelEn: 'Round scope', hintZh: '只统计决赛(round_types.final 标志)', hintEn: 'Finals only via round_types.final',
        labelZhHant: "輪次範圍",
        hintZhHant: "只統計決賽(round_types.final 標誌)"
    },
    { value: 'Top 100', labelZh: '保留人数', labelEn: 'Cutoff', hintZh: 'LIMIT 100,过滤长尾', hintEn: 'LIMIT 100, drops long tail',
        labelZhHant: "保留人數",
        hintZhHant: "LIMIT 100,過濾長尾"
    },
    { value: 'per person', labelZh: '聚合粒度', labelEn: 'Granularity', hintZh: '一行一个选手', hintEn: 'One row per cuber',
        hintZhHant: "一行一個選手"
    },
  ],
  sourceZh: [
    '内层在 `results` 上按 `person_id` 分组,join `round_types` 取 `final = 1`,然后过滤 `pos = 4 AND best > 0`,`COUNT(*)` 得到该选手生涯第 4 总数。`ORDER BY ... DESC LIMIT 100`。',
    '外层 join `persons`(`sub_id = 1`)拼 markdown 链接。',
  ],
  sourceEn: [
    'Inner query groups `results` by `person_id`, joins `round_types` for `final = 1`, filters `pos = 4 AND best > 0`, and `COUNT(*)` is the per-person career 4th tally. `ORDER BY ... DESC LIMIT 100`.',
    'Outer query joins `persons` (`sub_id = 1`) to build the markdown link.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT 4th_places_count, person.name
FROM (
  SELECT person_id AS wca_id,
         COUNT(*) AS 4th_places_count
  FROM results
  JOIN round_types round_type
    ON round_type.id = round_type_id
  WHERE round_type.final = 1
    AND pos = 4
    AND best > 0
  GROUP BY person_id
  ORDER BY 4th_places_count DESC
  LIMIT 100
) AS counts
JOIN persons person ON person.wca_id = counts.wca_id
                   AND person.sub_id = 1
ORDER BY 4th_places_count DESC;`,
  },
  steps: [
    {
      titleZh: '锁定决赛',
      titleEn: 'Restrict to finals',
      bodyZh: 'join `round_types` 表,只保留 `final = 1` 的行(WCA round 系统里 c / f / 1 round comps 都打 final 标志)。',
      bodyEn: 'Join `round_types` and keep `final = 1` rows (c / f / single-round comps all carry the final flag).',
        titleZhHant: "鎖定決賽",
        bodyZhHant: "join `round_types` 表,只保留 `final = 1` 的行(WCA round 系統裡 c / f / 1 round comps 都打 final 標誌)。"
    },
    {
      titleZh: '过滤"有效第 4 名"',
      titleEn: 'Filter valid 4th places',
      bodyZh: '`pos = 4 AND best > 0` —— pos 是官方名次,`best > 0` 排除整轮 DNF 的"运气名次"(全员 DNF 时仍按提交顺序填 pos)。',
      bodyEn: '`pos = 4 AND best > 0` — pos is official placement, `best > 0` filters out all-DNF rounds where someone gets a hollow 4th.',
        titleZhHant: "過濾\"有效第 4 名\"",
        bodyZhHant: "`pos = 4 AND best > 0` —— pos 是官方名次,`best > 0` 排除整輪 DNF 的\"運氣名次\"(全員 DNF 時仍按提交順序填 pos)。"
    },
    {
      titleZh: '按选手 COUNT',
      titleEn: 'Aggregate per person',
      bodyZh: '`GROUP BY person_id` + `COUNT(*)`,得到生涯累积。一个比赛同一项目只会有一个决赛,所以不会重复计数。',
      bodyEn: '`GROUP BY person_id` + `COUNT(*)` produces the career tally. Each comp × event has only one final, so no double counting.',
        titleZhHant: "按選手 COUNT",
        bodyZhHant: "`GROUP BY person_id` + `COUNT(*)`,得到生涯累積。一個比賽同一項目只會有一個決賽,所以不會重複計數。"
    },
    {
      titleZh: '截 top 100 + 拼接展示',
      titleEn: 'Take top 100 and decorate',
      bodyZh: '内层 `ORDER BY ... LIMIT 100`,外层 join `persons` 加 markdown person 链接;最终再做一次 `ORDER BY` 保证渲染顺序稳定。',
      bodyEn: 'Inner `ORDER BY ... LIMIT 100`; outer joins `persons` for markdown links. A final `ORDER BY` keeps render order stable.',
      highlight: true,
        bodyZhHant: "內層 `ORDER BY ... LIMIT 100`,外層 join `persons` 加 markdown person 連結;最終再做一次 `ORDER BY` 保證渲染順序穩定。"
    },
  ],
  edgesZh: [
    '只看决赛 —— 预赛 / 半决出第 4 名不算(WCA 早期偶有"奇数轮"也通过 final flag 涵盖)。',
    '`best > 0` 关键 —— 决赛 DNF 时 pos 仍按提交顺序填到 4,这条会被过滤掉,以免"运气 4th"灌水。',
    '所有项目混在一起 cumulatively 累计,不分单 / 平均 —— 一个 3x3 单 4 + 一个 333bf 4 = 2。',
    'LIMIT 100 是渲染体面值,真实 4 次的人远不止 100;长尾不可见。',
  ],
  edgesEn: [
    'Finals only — fast 4ths in earlier rounds don\'t count (the `round_types.final` flag also covers odd single-round comps).',
    '`best > 0` is critical — when an entire final is DNF, pos still fills to 4 by submission order; filtering shields the count from these hollow 4ths.',
    'All events pooled — a 3x3 4th and a 3x3-blind 4th both count, tally = 2.',
    'LIMIT 100 is a display cap; the long tail of "4 once" people is invisible by design.',
  ],
  related: [
    { id: 'best_result_off_podium', titleZh: '最佳非领奖台成绩', titleEn: 'Best result off podium', hintZh: '同主题的"成绩侧"口径 — 最快的 4th 是哪条', hintEn: 'Sibling — the fastest 4th-or-worse times',
        titleZhHant: "最佳非領獎臺成績",
        hintZhHant: "同主題的\"成績側\"口徑 — 最快的 4th 是哪條"
    },
    { id: 'most_finals', titleZh: '进入决赛最多', titleEn: 'Most finals', hintZh: '不限名次,看决赛出场次数', hintEn: 'Same scope but any placement counts',
        titleZhHant: "進入決賽最多",
        hintZhHant: "不限名次,看決賽出場次數"
    },
    { id: 'most_4th_places', toStat: true, titleZh: '直接打开伴娘榜', titleEn: 'Jump to the bridesmaid list', hintZh: '看 top 100 完整名单', hintEn: 'Live top-100 leaderboard',
        titleZhHant: "直接開啟伴娘榜",
        hintZhHant: "看 top 100 完整名單"
    },
  ],
    badgeZhHant: "榮譽"
};

// ──── most_competitions_before_winning ───────────────────────────────────
const most_competitions_before_winning: AboutEntry = {
  id: 'most_competitions_before_winning',
  titleZh: '首次获胜前参加最多比赛 — 漫长的等待',
  titleEn: 'Most competitions before winning',
  badgeZh: '荣誉',
  badgeEn: 'Honors',
  introZh: [
    '一个选手在某个项目上**第一次**赢下决赛之前,已经参加了多少场举办了该项目的比赛?这条 stat 就是数这个等待时长 —— 按"场数"计,不按"年数"。',
    '名字里"win"指任何项目决赛拿第一,不是 WR。所以这条 stat 既能描述大牌选手"在自己强项里多久才登顶",也能给"小项目专家终于熬出头"留个画面。',
  ],
  introEn: [
    'For each event, count how many comps (that held that event) a person attended before their **first ever final win** in it. Measured in competitions, not in years.',
    '"Win" here means 1st place in a final — not WR. So the stat captures both top cubers slowly grinding into a main event, and small-event specialists who finally got their gold.',
  ],
  stats: [
    { value: '17', labelZh: '覆盖项目', labelEn: 'Events', hintZh: '按项目独立计算', hintEn: 'Computed per event',
        labelZhHant: "覆蓋項目",
        hintZhHant: "按項目獨立計算"
    },
    { value: 'first 1st', labelZh: '触发条件', labelEn: 'Trigger', hintZh: '首次决赛 pos = 1 AND best > 0', hintEn: 'First final pos = 1 AND best > 0',
        labelZhHant: "觸發條件",
        hintZhHant: "首次決賽 pos = 1 AND best > 0"
    },
    { value: 'start_date', labelZh: '时间轴', labelEn: 'Timeline', hintZh: '按比赛开始日期排序', hintEn: 'Ordered by comp start_date',
        labelZhHant: "時間軸",
        hintZhHant: "按比賽開始日期排序"
    },
    { value: 'Top 10', labelZh: '每项目保留', labelEn: 'Per event', hintZh: '等待最长的 10 人', hintEn: '10 longest waits per event',
        labelZhHant: "每項目保留",
        hintZhHant: "等待最長的 10 人"
    },
  ],
  sourceZh: [
    '从 `results` 拉所有行,join `persons` / `competitions` / `round_types`;`ORDER BY start_date` 保证时间正序。然后在 TS 里按"项目 → 选手 → 比赛"嵌套分组,扫到第一次"决赛 + pos = 1 + best > 0"为止,这次比赛**之前**参加的场数就是答案。',
  ],
  sourceEn: [
    'Pull all rows from `results`, join `persons` / `competitions` / `round_types`, `ORDER BY start_date` for time ordering. In TypeScript, nest-group by event → person → comp, scan in chronological order until the first "final + pos = 1 + best > 0" — the count of comps **before** that one is the answer.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person.name,
       competition.cell_name,
       event_id,
       pos AS place,
       round_type.final AS is_final,
       best
FROM results
JOIN persons person ON person.wca_id = person_id
                   AND sub_id = 1
JOIN competitions competition
  ON competition.id = competition_id
JOIN round_types round_type
  ON round_type.id = round_type_id
ORDER BY start_date;`,
  },
  steps: [
    {
      titleZh: '时间正序拉所有 result 行',
      titleEn: 'Pull all rows in time order',
      bodyZh: 'SQL 不做聚合,只是 `ORDER BY start_date`。每行带 `event_id` / `person_id` / `competition_id` / `pos` / `is_final` / `best`。',
      bodyEn: 'No SQL aggregation — just `ORDER BY start_date`. Each row carries `event_id` / `person_id` / `competition_id` / `pos` / `is_final` / `best`.',
        titleZhHant: "時間正序拉所有 result 行",
        bodyZhHant: "SQL 不做聚合,只是 `ORDER BY start_date`。每行帶 `event_id` / `person_id` / `competition_id` / `pos` / `is_final` / `best`。"
    },
    {
      titleZh: '按项目筛 → 按选手分桶',
      titleEn: 'Filter per event, bucket per person',
      bodyZh: '`EVENTS_ENTRIES.map` 遍历 17 个项目;每个项目内 `Map<personLink, rows[]>`,行的相对顺序保留(因为 SQL 已按时间排过)。',
      bodyEn: '`EVENTS_ENTRIES.map` iterates 17 events. Inside, `Map<personLink, rows[]>` — the row order is preserved because SQL already sorted by time.',
        titleZhHant: "按項目篩 → 按選手分桶",
        bodyZhHant: "`EVENTS_ENTRIES.map` 遍歷 17 個項目;每個項目內 `Map<personLink, rows[]>`,行的相對順序保留(因為 SQL 已按時間排過)。"
    },
    {
      titleZh: '同人内按比赛再分桶',
      titleEn: 'Inside person, bucket by comp',
      bodyZh: '一个人在一场比赛里可能跑多轮,只能按"比赛是不是赢了"来标 —— 用 `byComp` Map + `compOrder` 数组保住时间序。',
      bodyEn: 'A person may run multiple rounds at one comp; we only need to know "did the comp end in a win" — track with a `byComp` Map plus a `compOrder` array to keep chronology.',
        titleZhHant: "同人內按比賽再分桶",
        bodyZhHant: "一個人在一場比賽裡可能跑多輪,只能按\"比賽是不是贏了\"來標 —— 用 `byComp` Map + `compOrder` 陣列保住時間序。"
    },
    {
      titleZh: '每场打"是否获胜"标签',
      titleEn: 'Tag each comp with won-flag',
      bodyZh: '`won = compRows.some(r => is_final === 1 && place === 1 && best > 0)`。一场比赛只要在该项目决赛里有一行 pos = 1 就算赢。',
      bodyEn: '`won = compRows.some(r => is_final === 1 && place === 1 && best > 0)`. A single 1st-place final row in that event flags the whole comp as a win.',
        titleZhHant: "每場打\"是否獲勝\"標籤",
        bodyZhHant: "`won = compRows.some(r => is_final === 1 && place === 1 && best > 0)`。一場比賽只要在該項目決賽裡有一行 pos = 1 就算贏。"
    },
    {
      titleZh: '找首次 won 的下标',
      titleEn: 'Find first won index',
      bodyZh: '`findIndex(c => c.won)` 给出"第几场起赢了" —— 这个下标 = 之前参加的场数。倒序取 top 10 后输出。',
      bodyEn: '`findIndex(c => c.won)` returns the index of the breakthrough — that index = number of prior comps. Sort descending, take top 10 per event.',
      highlight: true,
        titleZhHant: "找首次 won 的下標",
        bodyZhHant: "`findIndex(c => c.won)` 給出\"第幾場起贏了\" —— 這個下標 = 之前參加的場數。倒序取 top 10 後輸出。"
    },
  ],
  edgesZh: [
    '没在该项目里赢过的人会被 `findIndex` 返回 -1,直接跳过 —— 这是设计:我们要的是"赢了之后回头数等了多久",还没赢的没法算。',
    '`is_final === 1 AND place === 1 AND best > 0` 三条必须同时成立,纯 DNF 决赛的"幽灵冠军"被滤掉。',
    '"参加了该项目的比赛"用 `eventRows.filter(r => event_id === eventId)` 隐式定义 —— 不在该项目上场的比赛不计入等待长度。',
    'sub_id = 1 + 一个选手即使换 wca_id 也只看主行,etc.(若 wca_id 真换了则视为两个人 — WCA 极少改 wca_id)。',
  ],
  edgesEn: [
    'People who never won in an event return -1 from `findIndex` and are skipped — by design: this stat counts the wait before a win, so non-winners are uncountable.',
    '`is_final === 1 AND place === 1 AND best > 0` all required; ghost-wins from fully-DNF\'d finals are dropped.',
    '"Attended a comp that held the event" is implicitly defined by `eventRows.filter(r => event_id === eventId)` — comps where the person didn\'t enter that event don\'t add to the wait.',
    '`sub_id = 1` collapses renames / country changes into one person (true wca_id changes — vanishingly rare — would still split).',
  ],
  related: [
    { id: 'most_finals', titleZh: '进入决赛最多', titleEn: 'Most finals', hintZh: '类似时间纵深的累积量,但不限"赢"', hintEn: 'Career-depth tally, no win requirement',
        titleZhHant: "進入決賽最多",
        hintZhHant: "類似時間縱深的累積量,但不限\"贏\""
    },
    { id: 'most_4th_places', titleZh: '最多第四名', titleEn: 'Most 4th places', hintZh: '另一种"差一点"的画像', hintEn: 'A different shade of near-misses',
        hintZhHant: "另一種\"差一點\"的畫像"
    },
    { id: 'most_competitions_before_winning', toStat: true, titleZh: '直接打开排名', titleEn: 'Jump to the leaderboard', hintZh: '看每个项目"等最久"的 10 人', hintEn: '10 longest waits per event',
        titleZhHant: "直接開啟排名",
        hintZhHant: "看每個項目\"等最久\"的 10 人"
    },
  ],
    titleZhHant: "首次獲勝前參加最多比賽 — 漫長的等待",
    badgeZhHant: "榮譽"
};

// ──── most_finals ────────────────────────────────────────────────────────
const most_finals: AboutEntry = {
  id: 'most_finals',
  titleZh: '进入决赛最多 — 长青指标',
  titleEn: 'Most finals',
  badgeZh: '荣誉',
  badgeEn: 'Honors',
  introZh: [
    '一个选手生涯里进过多少次决赛?项目不分,名次不限 —— 只要决赛轮里有他的成绩,就算一次。',
    '它是"出勤稳定 + 排名靠前(才能晋级到决赛)"的复合指标。长期高水平选手很容易就到几百,而 single-event 玩家会受限于只跑一个项目。',
  ],
  introEn: [
    'How many finals has a cuber appeared in over their career? Any event, any placing — if their name is in a finals round, it counts.',
    'A compound proxy for "competes a lot" + "ranks high enough to advance." Long-term top cubers easily clear several hundred; single-event specialists are capped by the events they enter.',
  ],
  stats: [
    { value: 'final = 1', labelZh: '过滤条件', labelEn: 'Filter', hintZh: 'round_types.final 标志', hintEn: 'round_types.final flag',
        labelZhHant: "過濾條件",
        hintZhHant: "round_types.final 標誌"
    },
    { value: 'COUNT(*)', labelZh: '聚合', labelEn: 'Aggregate', hintZh: '每行 = 一次决赛轮成绩', hintEn: 'Each row = one finals appearance',
        hintZhHant: "每行 = 一次決賽輪成績"
    },
    { value: 'Top 100', labelZh: '保留', labelEn: 'Cutoff', hintZh: 'LIMIT 100', hintEn: 'LIMIT 100' },
    { value: 'all events', labelZh: '项目混合', labelEn: 'All events', hintZh: '不分单 / 平均 / 项目', hintEn: 'Pooled across single / average / event',
        labelZhHant: "項目混合",
        hintZhHant: "不分單 / 平均 / 項目"
    },
  ],
  sourceZh: [
    '内层在 `results` 上按 `person_id` 分组,join `round_types` 只保 `final = 1`,`COUNT(*)` = 决赛出场总数。`ORDER BY ... DESC LIMIT 100` 截前 100。',
    '外层 join `persons` 加 markdown 链接。',
  ],
  sourceEn: [
    'Inner: group `results` by `person_id`, join `round_types` for `final = 1`, `COUNT(*)` is the total finals appearances. `ORDER BY ... DESC LIMIT 100`.',
    'Outer: join `persons` for markdown links.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT finals_count, person.name
FROM (
  SELECT person_id AS wca_id,
         COUNT(*) AS finals_count
  FROM results
  JOIN round_types round_type
    ON round_type.id = round_type_id
  WHERE round_type.final = 1
  GROUP BY person_id
  ORDER BY finals_count DESC
  LIMIT 100
) AS people_with_finals
JOIN persons person ON person.wca_id = people_with_finals.wca_id
                   AND person.sub_id = 1
ORDER BY finals_count DESC;`,
  },
  steps: [
    {
      titleZh: '锁定决赛行',
      titleEn: 'Restrict to finals rows',
      bodyZh: 'join `round_types`,只保 `final = 1`。WCA 把综合决赛(c)、决赛(f)、以及单轮比赛唯一的 round 都打了 final 标。',
      bodyEn: 'Join `round_types`, keep `final = 1`. WCA tags combined finals (c), finals (f), and the only round of single-round comps all as final.',
        titleZhHant: "鎖定決賽行",
        bodyZhHant: "join `round_types`,只保 `final = 1`。WCA 把綜合決賽(c)、決賽(f)、以及單輪比賽唯一的 round 都打了 final 標。"
    },
    {
      titleZh: '按选手计数',
      titleEn: 'Count per person',
      bodyZh: '`GROUP BY person_id` + `COUNT(*)`。同一场比赛同一项目只贡献 1 行 result(决赛只跑一次),所以不会重复。',
      bodyEn: '`GROUP BY person_id` + `COUNT(*)`. A given comp × event only produces one finals row, so no double-count.',
        titleZhHant: "按選手計數",
        bodyZhHant: "`GROUP BY person_id` + `COUNT(*)`。同一場比賽同一項目只貢獻 1 行 result(決賽只跑一次),所以不會重複。"
    },
    {
      titleZh: '降序截 100',
      titleEn: 'Sort desc, take 100',
      bodyZh: '`ORDER BY finals_count DESC LIMIT 100`,渲染体面值。',
      bodyEn: '`ORDER BY finals_count DESC LIMIT 100` for a readable leaderboard.',
        bodyZhHant: "`ORDER BY finals_count DESC LIMIT 100`,渲染體面值。"
    },
    {
      titleZh: '拼接展示',
      titleEn: 'Decorate',
      bodyZh: '外层 join `persons` 拼出 markdown 链接给前端;最终一次 `ORDER BY` 保稳定。',
      bodyEn: 'Outer join attaches markdown person links; a final `ORDER BY` keeps render order deterministic.',
      highlight: true,
        bodyZhHant: "外層 join `persons` 拼出 markdown 連結給前端;最終一次 `ORDER BY` 保穩定。"
    },
  ],
  edgesZh: [
    '不过滤 `best > 0` —— DNF 决赛也算一次出场。因为这条 stat 数的是"进决赛的事件",不是"赢决赛"。',
    '所有项目混合 —— 跑 17 个项目的 generalist 会自然占便宜;single-event 选手再强也无法靠一个项目挤进前 100。',
    'LIMIT 100 是渲染体面值,长尾不可见。',
    '`sub_id = 1` 合并改名 / 换籍生成的副 person 行。',
  ],
  edgesEn: [
    'No `best > 0` filter — a DNF\'d final still counts. This stat measures "showed up to a final", not "won".',
    'All events pooled — generalists who enter 17 events have a structural advantage over single-event specialists.',
    'LIMIT 100 is a display cap; long tail invisible.',
    '`sub_id = 1` collapses rename / country-change alt rows.',
  ],
  related: [
    { id: 'most_4th_places', titleZh: '最多第四名', titleEn: 'Most 4th places', hintZh: '决赛细分:专数第 4 名', hintEn: 'Subset of finals — just 4th places',
        hintZhHant: "決賽細分:專數第 4 名"
    },
    { id: 'most_podiums_at_single_competition', titleZh: '单场比赛登台最多', titleEn: 'Most podiums at single comp', hintZh: '同主题但单比赛粒度', hintEn: 'Same theme but per-comp granularity',
        titleZhHant: "單場比賽登臺最多",
        hintZhHant: "同主題但單比賽粒度"
    },
    { id: 'most_competitions_before_winning', titleZh: '首次获胜前参加最多比赛', titleEn: 'Most comps before winning', hintZh: '时间纵深的另一种切法', hintEn: 'A different depth-of-career cut',
        titleZhHant: "首次獲勝前參加最多比賽",
        hintZhHant: "時間縱深的另一種切法"
    },
    { id: 'most_finals', toStat: true, titleZh: '直接打开决赛榜', titleEn: 'Jump to the finals leaderboard', hintZh: '看 top 100 选手', hintEn: 'Live top 100',
        titleZhHant: "直接開啟決賽榜",
        hintZhHant: "看 top 100 選手"
    },
  ],
    titleZhHant: "進入決賽最多 — 長青指標",
    badgeZhHant: "榮譽"
};

// ──── most_podiums_at_single_competition ─────────────────────────────────
const most_podiums_at_single_competition: AboutEntry = {
  id: 'most_podiums_at_single_competition',
  titleZh: '单场比赛登台最多 — 一站收割',
  titleEn: 'Most podiums at a single competition',
  badgeZh: '荣誉',
  badgeEn: 'Honors',
  introZh: [
    '一个选手在**同一场比赛**里同时登上多少个项目的领奖台(1 / 2 / 3 名)?这条 stat 找的就是这种"一站收割"事件。',
    '门槛设在 ≥ 10 个领奖台,所以名单基本上是"在 15 + 项目大赛上对全部能跑的项目都拿到了奖牌"的传奇时刻。',
  ],
  introEn: [
    'How many podium finishes (1st / 2nd / 3rd) did one person collect at a single comp? This stat enumerates those one-comp harvests.',
    'Threshold ≥ 10 podiums, so the list is essentially legendary moments where someone medalled in basically every event of a 15 + event regional.',
  ],
  stats: [
    { value: 'pos ∈ {1, 2, 3}', labelZh: '过滤条件', labelEn: 'Filter', hintZh: '只数领奖台', hintEn: 'Podium positions only',
        labelZhHant: "過濾條件",
        hintZhHant: "只數領獎臺"
    },
    { value: '≥ 10', labelZh: '入选门槛', labelEn: 'Threshold', hintZh: 'HAVING podiums_count >= 10', hintEn: 'HAVING podiums_count >= 10',
        labelZhHant: "入選門檻"
    },
    { value: '决赛', labelZh: '轮次范围', labelEn: 'Round scope', hintZh: '只看 round_type c / f', hintEn: 'Finals only (c, f)',
        labelZhHant: "輪次範圍"
    },
    { value: 'per (人 × 赛)', labelZh: '聚合粒度', labelEn: 'Granularity', hintZh: 'GROUP BY person × competition', hintEn: 'GROUP BY person × competition' },
  ],
  sourceZh: [
    '内层在 `results` 上按 `(person_id, competition_id)` 分组,过滤 `round_type_id IN (\'f\', \'c\') AND best > 0 AND pos IN (1, 2, 3)`,`COUNT(*)` 得到该选手在该场的领奖台总数。',
    '`HAVING podiums_count >= 10` 砍掉门槛以下;外层 join `persons` / `competitions` 拼链接。比赛链接指向 `/results/podiums` 子页,直接给读者看现场。',
  ],
  sourceEn: [
    'Inner: group `results` by `(person_id, competition_id)`, filter `round_type_id IN (\'f\', \'c\') AND best > 0 AND pos IN (1, 2, 3)`, `COUNT(*)` is podiums at that comp.',
    '`HAVING podiums_count >= 10` drops below-threshold pairs; outer joins `persons` / `competitions` for markdown. The comp link points at `/results/podiums` so readers can verify in situ.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT podiums_count, person.name, competition.cell_name
FROM (
  SELECT COUNT(*)       AS podiums_count,
         person_id, competition_id
  FROM results
  WHERE round_type_id IN ('f', 'c')
    AND best > 0
    AND pos IN (1, 2, 3)
  GROUP BY person_id, competition_id
  HAVING podiums_count >= 10
  ORDER BY podiums_count DESC
) AS counts
JOIN persons person ON person.wca_id = person_id AND sub_id = 1
JOIN competitions competition ON competition.id = competition_id;`,
  },
  steps: [
    {
      titleZh: '按 (人, 比赛) 分组',
      titleEn: 'Group by (person, comp)',
      bodyZh: '不同比赛的领奖台**不合并**;一个人在 weekend × 2 各拿 5 块 ≠ 一次 10 块。',
      bodyEn: 'Podiums from different comps are **not pooled**; 5 + 5 across two weekends ≠ 10 in one comp.',
        titleZhHant: "按 (人, 比賽) 分組",
        bodyZhHant: "不同比賽的領獎臺**不合並**;一個人在 weekend × 2 各拿 5 塊 ≠ 一次 10 塊。"
    },
    {
      titleZh: '过滤领奖台 + 排除 DNF',
      titleEn: 'Filter podium + drop DNFs',
      bodyZh: '`pos IN (1, 2, 3) AND best > 0`。`pos` 是 WCA 官方名次,平局并列规则已包含,所以并列第 3 仍然算第 3。',
      bodyEn: '`pos IN (1, 2, 3) AND best > 0`. `pos` is WCA\'s official placement (ties baked in — co-3rd is still 3rd).',
        titleZhHant: "過濾領獎臺 + 排除 DNF",
        bodyZhHant: "`pos IN (1, 2, 3) AND best > 0`。`pos` 是 WCA 官方名次,平局並列規則已包含,所以並列第 3 仍然算第 3。"
    },
    {
      titleZh: '只看决赛',
      titleEn: 'Finals only',
      bodyZh: '`round_type_id IN (\'f\', \'c\')`(决赛 / 综合决赛)。预赛 / 半决"局部前 3"不计入领奖台。',
      bodyEn: '`round_type_id IN (\'f\', \'c\')` (final / combined final). Early-round top-3s don\'t count as podiums.',
        titleZhHant: "只看決賽",
        bodyZhHant: "`round_type_id IN ('f', 'c')`(決賽 / 綜合決賽)。預賽 / 半決\"區域性前 3\"不計入領獎臺。"
    },
    {
      titleZh: '门槛 ≥ 10',
      titleEn: 'Threshold of 10',
      bodyZh: '`HAVING podiums_count >= 10` —— 把日常奖牌不当回事,只看真正"一站收割"。',
      bodyEn: '`HAVING podiums_count >= 10` — filters away routine medal counts, keeping only true harvests.',
        titleZhHant: "門檻 ≥ 10",
        bodyZhHant: "`HAVING podiums_count >= 10` —— 把日常獎牌不當回事,只看真正\"一站收割\"。"
    },
    {
      titleZh: '拼接展示并按数量倒序',
      titleEn: 'Decorate, sort desc',
      bodyZh: '外层 join 拼 markdown,比赛链接直指 `/results/podiums` 子页给读者验证;`ORDER BY podiums_count DESC`。',
      bodyEn: 'Outer joins build markdown; comp link goes to the comp\'s `/results/podiums` subpage for verification. `ORDER BY podiums_count DESC`.',
      highlight: true,
        titleZhHant: "拼接展示並按數量倒序",
        bodyZhHant: "外層 join 拼 markdown,比賽連結直指 `/results/podiums` 子頁給讀者驗證;`ORDER BY podiums_count DESC`。"
    },
  ],
  edgesZh: [
    '`best > 0` 排除 DNF —— pos 仍能是 1 / 2 / 3 但成绩是 DNF 的"虚拟领奖"会被滤掉(`SolveTime` value = -1 表示 DNF)。',
    '只看决赛,不看预赛 —— 例如 WC 那种多轮比赛只算最后一轮的名次。',
    '不分项目地累计 —— 一个人在 333 拿 3 + 444 拿 3 + ... 可以快速堆到 ≥ 10。',
    '`HAVING podiums_count >= 10` 是硬截断,9 块奖牌的"差一点"不可见。',
  ],
  edgesEn: [
    '`best > 0` excludes DNF podiums — pos can be 1 / 2 / 3 with a DNF result; those are filtered (`SolveTime` -1 = DNF).',
    'Finals only — multi-round comps like Worlds count only the final round\'s placing.',
    'All events pooled into the count — a 3 on 3x3 + 3 on 4x4 + ... can reach 10 fast.',
    '`HAVING podiums_count >= 10` is hard — a 9-podium near miss is invisible.',
  ],
  related: [
    { id: 'complete_competition_winners', titleZh: '完全比赛冠军', titleEn: 'Complete competition winners', hintZh: '更严格的版本:不是"登台",而是"全包金牌"', hintEn: 'Stricter sibling — every gold, not just any podium',
        titleZhHant: "完全比賽冠軍",
        hintZhHant: "更嚴格的版本:不是\"登臺\",而是\"全包金牌\""
    },
    { id: 'most_finals', titleZh: '进入决赛最多', titleEn: 'Most finals', hintZh: '生涯级累积口径', hintEn: 'Career-level finals tally',
        titleZhHant: "進入決賽最多",
        hintZhHant: "生涯級累積口徑"
    },
    { id: 'most_podiums_together', titleZh: '最多共同登台次数', titleEn: 'Most podiums together', hintZh: '对子 / 三人组合视角', hintEn: 'Pairs / triples view',
        titleZhHant: "最多共同登臺次數",
        hintZhHant: "對子 / 三人組合視角"
    },
    { id: 'most_podiums_at_single_competition', toStat: true, titleZh: '直接打开榜单', titleEn: 'Jump to the leaderboard', hintZh: '看每一场被"一站收割"的比赛', hintEn: 'Every one-comp harvest in history',
        titleZhHant: "直接開啟榜單",
        hintZhHant: "看每一場被\"一站收割\"的比賽"
    },
  ],
    titleZhHant: "單場比賽登臺最多 — 一站收割",
    badgeZhHant: "榮譽"
};

// ──── most_podiums_together ──────────────────────────────────────────────
const most_podiums_together: AboutEntry = {
  id: 'most_podiums_together',
  titleZh: '最多共同登台次数 — 对子与三人组',
  titleEn: 'Most podiums together',
  badgeZh: '荣誉',
  badgeEn: 'Honors',
  introZh: [
    '同一场比赛、同一个项目的领奖台上,A 和 B 一起站过几次?——三人组同理。这条 stat 找出最常"组团登台"的对子和三人组。',
    '它捕捉的是地区高手圈的稳定共生关系:同一片大陆 / 同一国的顶尖选手会在多场比赛里反复同台。结果分 Pairs(对子)和 Triples(三人组)两组。',
  ],
  introEn: [
    'How often have A and B (and C) appeared on the same podium of the same event at the same comp? This stat enumerates the most frequent podium pairs and triples.',
    'It surfaces the stable co-stardom of regional top circles: same continent\'s top cubers keep ending up on the same stage. Output split into Pairs and Triples.',
  ],
  stats: [
    { value: 'pos ≤ 3', labelZh: '入选条件', labelEn: 'Filter', hintZh: '领奖台名次', hintEn: 'Podium positions',
        labelZhHant: "入選條件",
        hintZhHant: "領獎臺名次"
    },
    { value: '决赛', labelZh: '轮次范围', labelEn: 'Round scope', hintZh: 'round_types.final = 1', hintEn: 'round_types.final = 1',
        labelZhHant: "輪次範圍"
    },
    { value: '2 / 3', labelZh: '组合大小', labelEn: 'Combo size', hintZh: '从领奖台 3 人里取 C(3, k)', hintEn: 'C(podium people, k) for k in {2, 3}',
        labelZhHant: "組合大小",
        hintZhHant: "從領獎臺 3 人裡取 C(3, k)"
    },
    { value: 'Top 100', labelZh: '每分组保留', labelEn: 'Per bucket', hintZh: 'Pairs 100 + Triples 100', hintEn: 'Pairs 100 + Triples 100',
        labelZhHant: "每分組保留"
    },
  ],
  sourceZh: [
    '从 `results` join `persons` / `round_types`,过滤决赛 + pos ≤ 3 + `best > 0`;按 `(event_id, competition_id)` 分组,用 `GROUP_CONCAT(person.name ORDER BY person.name)` 把这场比赛该项目的领奖台名单拼成字符串。',
    'TS 端解析为人名数组,对每个"领奖台名单"用组合数学 `C(arr, k)` 生成所有 2 元 / 3 元子集,在 Map 里累加频次,最后按频次降序取 top 100。',
  ],
  sourceEn: [
    'SQL joins `results` to `persons` / `round_types`, filters finals + pos ≤ 3 + `best > 0`, groups by `(event_id, competition_id)`, and `GROUP_CONCAT(person.name ORDER BY person.name)` collapses that event\'s podium roster into a single string.',
    'TS side splits into a name array, generates every k-combo via `combinations(arr, k)` for k ∈ {2, 3}, tallies into a Map, sorts desc, takes top 100 per bucket.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT GROUP_CONCAT(
         person.name ORDER BY person.name
       ) AS people
FROM results
JOIN persons person ON person.wca_id = person_id
                   AND person.sub_id = 1
JOIN round_types round_type
  ON round_type.id = round_type_id
WHERE round_type.final = 1
  AND pos <= 3
  AND best > 0
GROUP BY event_id, competition_id;`,
  },
  steps: [
    {
      titleZh: '收集每个领奖台',
      titleEn: 'Collect each podium',
      bodyZh: '`GROUP BY event_id, competition_id` —— 每一行 = 该比赛该项目的领奖台名单(按字母排序,后面好做 key)。',
      bodyEn: '`GROUP BY event_id, competition_id` — each row = the podium roster of one (comp × event), names alphabetized so combos give canonical keys.',
        titleZhHant: "收集每個領獎臺",
        bodyZhHant: "`GROUP BY event_id, competition_id` —— 每一行 = 該比賽該項目的領獎臺名單(按字母排序,後面好做 key)。"
    },
    {
      titleZh: '拼名字成字符串',
      titleEn: 'Concatenate names',
      bodyZh: '`GROUP_CONCAT` 拼成 `Alice,Bob,Carol`;TS 端 `.split(\',\')` 还原。',
      bodyEn: '`GROUP_CONCAT` glues into `Alice,Bob,Carol`; TS does `.split(\',\')` to rebuild the array.',
        titleZhHant: "拼名字成字串",
        bodyZhHant: "`GROUP_CONCAT` 拼成 `Alice,Bob,Carol`;TS 端 `.split(',')` 還原。"
    },
    {
      titleZh: '取 k 元组合',
      titleEn: 'Generate k-combinations',
      bodyZh: '`combinations(arr, k)` 递归取出 `C(n, k)` 个子集;n 通常是 3 (三人领奖台),所以 k = 2 得 3 对,k = 3 得 1 组。并列时 n 可大于 3。',
      bodyEn: '`combinations(arr, k)` recursively enumerates `C(n, k)`; n is usually 3 (three medallists) → k = 2 gives 3 pairs, k = 3 gives 1 triple. Ties can push n > 3.',
        titleZhHant: "取 k 元組合",
        bodyZhHant: "`combinations(arr, k)` 遞迴取出 `C(n, k)` 個子集;n 通常是 3 (三人領獎臺),所以 k = 2 得 3 對,k = 3 得 1 組。並列時 n 可大於 3。"
    },
    {
      titleZh: '累加频次',
      titleEn: 'Tally frequencies',
      bodyZh: 'Map<key, count>,key = 名字 join `&`(因为已字母排序,组合 key 唯一)。',
      bodyEn: 'Map<key, count>, key = names joined by `&` (alphabetical sort upstream makes the key canonical).',
        titleZhHant: "累加頻次",
        bodyZhHant: "Map<key, count>,key = 名字 join `&`(因為已字母排序,組合 key 唯一)。"
    },
    {
      titleZh: '降序取 top 100 输出两个桶',
      titleEn: 'Sort desc, take top 100 per bucket',
      bodyZh: '分 Pairs(k = 2)和 Triples(k = 3)两组,各自 sort + slice(0, 100)。',
      bodyEn: 'Two buckets — Pairs (k = 2) and Triples (k = 3) — each sort + slice(0, 100).',
      highlight: true,
        titleZhHant: "降序取 top 100 輸出兩個桶",
        bodyZhHant: "分 Pairs(k = 2)和 Triples(k = 3)兩組,各自 sort + slice(0, 100)。"
    },
  ],
  formulae: [
    {
      labelZh: '每场领奖台贡献的组合数',
      labelEn: 'Combinations per podium',
      expr: 'pairs_per_podium = C(n, 2),  triples_per_podium = C(n, 3)',
      bodyZh: 'n = 该领奖台人数,通常 3(因平局可大于 3)。所以一个 3 人领奖台贡献 3 对 + 1 三人组。',
      bodyEn: 'n = people on that podium, usually 3 (ties can push higher). A standard 3-person podium contributes 3 pairs and 1 triple.',
        labelZhHant: "每場領獎臺貢獻的組合數",
        bodyZhHant: "n = 該領獎臺人數,通常 3(因平局可大於 3)。所以一個 3 人領獎臺貢獻 3 對 + 1 三人組。"
    },
  ],
  edgesZh: [
    '只看决赛 + `pos <= 3` + `best > 0` —— DNF 不算"登台",虚拟同台被排除。',
    '`sub_id = 1` 让改名 / 换籍后的副 person 行不污染。一个换过国籍的选手仍按同一个人累计。',
    '平局并列第 3 时 podium 可能有 4 人,所有 C(4, 2) = 6 对都计入 —— 这就是为啥某些"低水平区域大赛"对子频次格外高。',
    'GROUP_CONCAT 默认有长度上限(MySQL 1024 字节);WCA 单领奖台通常 3 - 5 人,远不超,实际安全。',
  ],
  edgesEn: [
    'Finals only + `pos <= 3` + `best > 0` — DNFs don\'t count, no ghost co-podiums.',
    '`sub_id = 1` collapses renames / country changes — a person who switched country still accumulates as one identity.',
    'Tied 3rds can make a podium hold 4 people; all C(4, 2) = 6 pairs are counted — explains why low-depth regions sometimes show abnormally tight pairs.',
    'GROUP_CONCAT has a default 1024-byte cap in MySQL; podiums of 3 - 5 names stay well under, so this is safe in practice.',
  ],
  related: [
    { id: 'most_podiums_at_single_competition', titleZh: '单场比赛登台最多', titleEn: 'Most podiums at single comp', hintZh: '同主题但单人 × 单赛粒度', hintEn: 'Same theme — per-person, per-comp granularity',
        titleZhHant: "單場比賽登臺最多",
        hintZhHant: "同主題但單人 × 單賽粒度"
    },
    { id: 'complete_competition_winners', titleZh: '完全比赛冠军', titleEn: 'Complete competition winners', hintZh: '一个人包圆一场比赛的所有金牌', hintEn: 'Sibling — one person sweeping gold in a comp',
        titleZhHant: "完全比賽冠軍",
        hintZhHant: "一個人包圓一場比賽的所有金牌"
    },
    { id: 'most_podiums_together', toStat: true, titleZh: '直接打开 pairs / triples', titleEn: 'Jump to pairs / triples', hintZh: '看共同登台最多的对子和三人组', hintEn: 'Live top-100 of co-podium pairs and triples',
        titleZhHant: "直接開啟 pairs / triples",
        hintZhHant: "看共同登臺最多的對子和三人組"
    },
  ],
    titleZhHant: "最多共同登臺次數 — 對子與三人組",
    badgeZhHant: "榮譽"
};

// ──── worst_result_on_podium ─────────────────────────────────────────────
const worst_result_on_podium: AboutEntry = {
  id: 'worst_result_on_podium',
  titleZh: '领奖台最差成绩 — 也能拿奖',
  titleEn: 'Worst result providing a podium',
  badgeZh: '荣誉',
  badgeEn: 'Honors',
  introZh: [
    '这条 stat 是 `best_result_off_podium` 的镜像:在决赛里拿到 1 / 2 / 3 名,但成绩**特别慢**的 top 10。读它能看到"奖牌门槛的地板"。',
    '出现的情况一般是:小比赛参赛人少、难项目(444bf / 555bf / 333mbld / 333fmc)成绩差距大、或者全场翻车只剩你成绩成形。',
  ],
  introEn: [
    'Mirror of `best_result_off_podium`: 1st / 2nd / 3rd in a final but with the **slowest** result. Reading this gives the soft floor of the podium.',
    'Typical setups: small comps with few entrants, hard events (444bf / 555bf / multi-blind / FMC) where spread is huge, or a comp-wide meltdown where you\'re the only one who finished.',
  ],
  stats: [
    { value: '17', labelZh: '覆盖项目', labelEn: 'Events', hintZh: '所有 WCA 项目', hintEn: 'All WCA events',
        labelZhHant: "覆蓋項目",
        hintZhHant: "所有 WCA 項目"
    },
    { value: 'pos ≤ 3', labelZh: '过滤条件', labelEn: 'Filter', hintZh: '只看 1 / 2 / 3 名', hintEn: 'Only 1st / 2nd / 3rd',
        labelZhHant: "過濾條件"
    },
    { value: '排除 DNF', labelZh: '主成绩有效', labelEn: 'Primary valid', hintZh: 'isComplete() 过滤', hintEn: 'isComplete() filter',
        labelZhHant: "主成績有效",
        hintZhHant: "isComplete() 過濾"
    },
    { value: 'Top 10', labelZh: '每项目保留', labelEn: 'Per event', hintZh: '正序后 reverse 取 top 10', hintEn: 'Sort asc, reverse, slice 10',
        labelZhHant: "每項目保留",
        hintZhHant: "正序後 reverse 取 top 10"
    },
  ],
  sourceZh: [
    '从 `results` 筛 `round_type_id IN (\'c\', \'f\') AND pos <= 3`,join `persons` / `competitions` / `preferred_formats` / `formats`。后两个用来读 `sort_by` / `sort_by_second`,决定该项目按 single 还是 average 排。',
    '比赛链接指向 `/results/podiums#eXXX` 子页,直接跳到该项目的领奖台板块。',
  ],
  sourceEn: [
    'From `results` filter `round_type_id IN (\'c\', \'f\') AND pos <= 3`. Join `persons` / `competitions` / `preferred_formats` / `formats` — the last two yield `sort_by` / `sort_by_second` for primary / secondary metric per event.',
    'Comp link points at `/results/podiums#eXXX` to jump straight to that event\'s podium section.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT format.sort_by, format.sort_by_second,
       results.event_id,
       best AS single, average,
       person.name, competition.cell_name,
       pos AS place
FROM results
JOIN persons person ON person.wca_id = person_id
                   AND person.sub_id = 1
JOIN competitions competition ON competition.id = competition_id
JOIN preferred_formats pf ON pf.event_id = results.event_id
                         AND pf.ranking = 1
JOIN formats format ON format.id = pf.format_id
WHERE round_type_id IN ('c', 'f') AND pos <= 3;`,
  },
  steps: [
    {
      titleZh: '按项目分组',
      titleEn: 'Group by event',
      bodyZh: '`EVENTS_ENTRIES.map` 遍历 17 项,每项独立排榜(主成绩字段不同,不能混)。',
      bodyEn: '`EVENTS_ENTRIES.map` iterates all 17 events. Each event ranks independently because the primary metric differs.',
        titleZhHant: "按項目分組",
        bodyZhHant: "`EVENTS_ENTRIES.map` 遍歷 17 項,每項獨立排榜(主成績欄位不同,不能混)。"
    },
    {
      titleZh: '解析 SolveTime + 过滤无效',
      titleEn: 'Build SolveTime + filter incomplete',
      bodyZh: '每行包成 `{ single, average, sort_by, sort_by_second, ... }`;过滤 `primary.isComplete()` —— 主成绩为 DNF / DNS 的剔除,避免"DNF 也算最差"的伪记录。',
      bodyEn: 'Wrap each row as `{ single, average, sort_by, sort_by_second, ... }`. Drop rows where `primary.isComplete()` is false — keeps DNF / DNS primaries out of the "worst" tally.',
        titleZhHant: "解析 SolveTime + 過濾無效",
        bodyZhHant: "每行包成 `{ single, average, sort_by, sort_by_second, ... }`;過濾 `primary.isComplete()` —— 主成績為 DNF / DNS 的剔除,避免\"DNF 也算最差\"的偽記錄。"
    },
    {
      titleZh: '正序排 + 反转',
      titleEn: 'Sort ascending, reverse',
      bodyZh: '按 `SolveTime.compareTo` 主升,次升,然后 `.reverse()` 把数组首尾翻过来 —— 现在数组头就是"最慢仍登台"。',
      bodyEn: 'Sort primary asc then secondary asc via `SolveTime.compareTo`, then `.reverse()` — the array head is now the slowest podium time.',
        titleZhHant: "正序排 + 反轉",
        bodyZhHant: "按 `SolveTime.compareTo` 主升,次升,然後 `.reverse()` 把陣列首尾翻過來 —— 現在陣列頭就是\"最慢仍登臺\"。"
    },
    {
      titleZh: '取 top 10 + 主成绩加粗',
      titleEn: 'Slice 10, bold primary',
      bodyZh: '`slice(0, 10)`;输出 `[选手, single, average, 比赛, 名次]`,主成绩字段渲染时加 `**` 标记。',
      bodyEn: '`slice(0, 10)`; output `[person, single, average, competition, place]` with the primary metric wrapped in `**` for bolding.',
      highlight: true,
        titleZhHant: "取 top 10 + 主成績加粗",
        bodyZhHant: "`slice(0, 10)`;輸出 `[選手, single, average, 比賽, 名次]`,主成績欄位渲染時加 `**` 標記。"
    },
  ],
  edgesZh: [
    '排除主成绩 DNF / DNS —— 否则一堆"DNF 拿奖"会占满表(全场翻车时 pos 仍是 1)。次成绩可以是 DNF。',
    '`pos <= 3` 用的是 WCA 官方名次,平局并列已包含 —— 并列第 3 也能进表。',
    '`sub_id = 1` 滤副 person 行。',
    '按项目分组所以"333 拿亚军 30 秒"和"333mbld 拿亚军 99/99"不可比 —— 看的是每个项目自己的地板。',
  ],
  edgesEn: [
    'Primary DNF / DNS dropped — otherwise the table fills with "DNF gold" rows from all-meltdown finals where pos still goes 1 / 2 / 3. Secondary may be DNF.',
    '`pos <= 3` is WCA\'s official placement; ties are baked in (a co-3rd appears).',
    '`sub_id = 1` filters alternate person rows.',
    'Per-event grouping means "30s 3x3 silver" vs "99/99 multi-blind silver" never share a row — read each event\'s own floor.',
  ],
  related: [
    { id: 'best_result_off_podium', titleZh: '最佳非领奖台成绩', titleEn: 'Best result off podium', hintZh: '镜像 stat —— 没进领奖台的最快成绩', hintEn: 'Mirror stat — fastest results that missed the podium',
        titleZhHant: "最佳非領獎臺成績",
        hintZhHant: "映象 stat —— 沒進領獎臺的最快成績"
    },
    { id: 'most_podiums_at_single_competition', titleZh: '单场比赛登台最多', titleEn: 'Most podiums at single comp', hintZh: '同口径下的"登台"另一切片', hintEn: 'Another slice of the podium concept',
        titleZhHant: "單場比賽登臺最多",
        hintZhHant: "同口徑下的\"登臺\"另一切片"
    },
    { id: 'worst_result_on_podium', toStat: true, titleZh: '直接打开排名', titleEn: 'Jump to the leaderboard', hintZh: '看每个项目"奖牌地板"top 10', hintEn: 'Live per-event top 10 of slowest podiums',
        titleZhHant: "直接開啟排名",
        hintZhHant: "看每個項目\"獎牌地板\"top 10"
    },
  ],
    titleZhHant: "領獎臺最差成績 — 也能拿獎",
    badgeZhHant: "榮譽"
};

export const PODIUMS_ABOUT: Record<string, AboutEntry> = {
  best_result_off_podium,
  complete_competition_winners,
  most_4th_places,
  most_competitions_before_winning,
  most_finals,
  most_podiums_at_single_competition,
  most_podiums_together,
  worst_result_on_podium,
};
