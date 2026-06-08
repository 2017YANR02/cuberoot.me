// 世界纪录分析 — about entries
import type { AboutEntry } from '../types';

// ──── wr_aoxr ───────────────────────────────────────────────────────────────
// 示范条目:展示 stats / steps / formulae / edges / related 完整结构。
const wr_aoxr: AboutEntry = {
  id: 'wr_aoxr',
  titleZh: 'AoXR — 单场比赛平均的均值',
  titleEn: 'AoXR — Average across rounds of a single competition',
  badgeZh: '世界纪录',
  badgeEn: 'World record',
  introZh: [
    '`AoXR` 把一场比赛里**所有轮次**的 average 再做一次平均。X = 1, 2, 3, 4,分别对应"恰好打了 1/2/3/4 轮"的情况。比赛圈内最常用 `Ao3R`(预赛 + 半决 + 决赛)和 `Ao4R`(加一个 1/4 决)。',
    '它度量一个选手「单场稳定输出」的能力 —— 不像 single 那样靠手气,也不像 ao5 那样有掐尾。被 4 轮挤进来的选手,平均都得过硬。',
  ],
  introEn: [
    '`AoXR` is the **average of the averages** a competitor posted across all rounds in a single competition. X ∈ {1, 2, 3, 4}, depending on how many rounds they actually competed in.',
    'It measures within-comp consistency: not luck-of-the-single, and broader than ao5 because every round counts.',
  ],
  stats: [
    { value: '4', labelZh: '档位数', labelEn: 'Tiers', hintZh: 'Ao1R / Ao2R / Ao3R / Ao4R', hintEn: 'Ao1R / Ao2R / Ao3R / Ao4R',
        labelZhHant: "檔位數"
    },
    { value: '17', labelZh: '覆盖项目', labelEn: 'Events covered', hintZh: '有 average 的全部 WCA 项目', hintEn: 'All WCA events with averages',
        labelZhHant: "覆蓋專案",
        hintZhHant: "有 average 的全部 WCA 專案"
    },
    { value: '排名+历史', labelZh: '两个视图', labelEn: 'Two views', hintZh: '当前榜 + WR 进化时间线', hintEn: 'Current leaderboard + WR evolution timeline',
        labelZhHant: "兩個檢視",
        hintZhHant: "當前榜 + WR 進化時間線"
    },
    { value: '< 1 ms', labelZh: '页内查询', labelEn: 'Lookup time', hintZh: '预计算 JSON,无服务器调用', hintEn: 'Precomputed JSON, no backend calls',
        labelZhHant: "頁內查詢",
        hintZhHant: "預計算 JSON,無伺服器呼叫"
    },
  ],
  sourceZh: [
    '直接读 WCA 开发者 dump 的 `results` 表 — 每行一个轮次成绩;join `persons`(`sub_id = 1` 取主身份)和 `competitions`(取 `start_date` / `cell_name`)。只看 `average > 0`(过滤 DNF 和未提交)。',
  ],
  sourceEn: [
    'Reads the WCA developer-dump `results` table — one row per round result — joined to `persons` (`sub_id = 1`) for the main identity and `competitions` for `start_date` / `cell_name`. Filters `average > 0` (drops DNFs and not-attempted).',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT event_id, average, round_type_id,
       competition_id, person_id,
       competition.start_date
FROM results
JOIN persons ON persons.wca_id = results.person_id
            AND persons.sub_id = 1
JOIN competitions ON competitions.id = results.competition_id
WHERE average > 0
ORDER BY start_date;`,
  },
  steps: [
    {
      titleZh: '按 (比赛, 选手) 分组',
      titleEn: 'Group by (competition, person)',
      bodyZh: '把同一选手同一场比赛的所有轮次 average 收集到一组。键 = `competition_id:person_id`。',
      bodyEn: 'Collect all round averages a single person posted at one competition. Key = `competition_id:person_id`.',
        titleZhHant: "按 (比賽, 選手) 分組",
        bodyZhHant: "把同一選手同一場比賽的所有輪次 average 收集到一組。鍵 = `competition_id:person_id`。"
    },
    {
      titleZh: '按轮次 type 排序 + 选 X 档',
      titleEn: 'Sort by round type, pick tier',
      bodyZh: '组内按 `round_type_id` 排:`1/d → 2/e → 3/g → c/f`(预赛、半决、决赛、综合);再按"组里恰好有 X 个轮次"拆成 4 个 sub-stat(Ao1R / Ao2R / Ao3R / Ao4R)。',
      bodyEn: 'Within a group, sort by `round_type_id` (1/d → 2/e → 3/g → c/f). Bucket each group by its round count X (1, 2, 3, or 4) — each bucket feeds one of Ao1R / Ao2R / Ao3R / Ao4R.',
        titleZhHant: "按輪次 type 排序 + 選 X 檔",
        bodyZhHant: "組內按 `round_type_id` 排:`1/d → 2/e → 3/g → c/f`(預賽、半決、決賽、綜合);再按\"組裡恰好有 X 個輪次\"拆成 4 個 sub-stat(Ao1R / Ao2R / Ao3R / Ao4R)。"
    },
    {
      titleZh: '算数平均',
      titleEn: 'Take the mean',
      bodyZh: '组内 average 直接取**算术平均**(不像 ao5 不掐尾),得到一个数 = 该选手在该场比赛的 AoXR。',
      bodyEn: 'Plain **arithmetic mean** of the in-group averages (no trim like ao5) gives one number — that person\'s AoXR at that comp.',
        titleZhHant: "算數平均",
        bodyZhHant: "組內 average 直接取**算術平均**(不像 ao5 不掐尾),得到一個數 = 該選手在該場比賽的 AoXR。"
    },
    {
      titleZh: '排名:每人最佳值前 10',
      titleEn: 'Ranking: per-person best, top 10',
      bodyZh: '每个选手保留**最佳一个 AoXR**(最小的 = 最快);按项目排到 top 10。',
      bodyEn: 'For each person, keep their single best (smallest) AoXR; sort across persons, top 10 per event.',
        bodyZhHant: "每個選手保留**最佳一個 AoXR**(最小的 = 最快);按專案排到 top 10。"
    },
    {
      titleZh: 'WR 历史:严格刷新',
      titleEn: 'WR history: strict refresh',
      bodyZh: '把所有 (人, 比赛, AoXR) 按 `start_date` 正序扫描;只保留**严格刷新**当前最小值的那条(平 WR 不算)。这条规则就是 `filterWrHistory(strict=true)`。',
      bodyEn: 'Scan all (person, comp, AoXR) records by `start_date`; keep only entries that strictly improve on the running minimum (ties don\'t count). Implemented by `filterWrHistory(strict=true)`.',
      highlight: true,
        titleZhHant: "WR 歷史:嚴格重新整理",
        bodyZhHant: "把所有 (人, 比賽, AoXR) 按 `start_date` 正序掃描;只保留**嚴格重新整理**當前最小值的那條(平 WR 不算)。這條規則就是 `filterWrHistory(strict=true)`。"
    },
  ],
  formulae: [
    {
      labelZh: '公式',
      labelEn: 'Formula',
      expr: 'AoXR(p, c) = (1/X) · Σᵢ averageᵢ(p, c, roundᵢ)',
      bodyZh: 'p = 选手,c = 比赛,roundᵢ = 第 i 轮(按 type 排序),averageᵢ = 该轮 average。X = 该选手在该比赛的轮次数。',
      bodyEn: 'p = person, c = competition, roundᵢ = i-th round (sorted by type), averageᵢ = that round\'s average. X = number of rounds the person ran in that comp.',
        bodyZhHant: "p = 選手,c = 比賽,roundᵢ = 第 i 輪(按 type 排序),averageᵢ = 該輪 average。X = 該選手在該比賽的輪次數。"
    },
    {
      labelZh: '相邻 WR 进步百分比',
      labelEn: 'Gain % between consecutive WRs',
      expr: 'gain = (prev − cur) / prev × 100%',
      bodyZh: '在 History 视图里 "Improvement" 列展示;首条没有 prev,留空。',
      bodyEn: 'Shown in the "Improvement" column of the History view; first row has no prev so the cell is blank.',
        labelZhHant: "相鄰 WR 進步百分比",
        bodyZhHant: "在 History 檢視裡 \"Improvement\" 列展示;首條沒有 prev,留空。"
    },
  ],
  edgesZh: [
    '只算 `average > 0` 的轮次。DNF 平均(value = -1)和未提交(value = 0)被排除 — 一个选手即使打了 4 轮但有一轮 DNF,会被算成 Ao3R 而不是 Ao4R。',
    '同日两条不同比赛的 AoXR 不会合并 — 每条都是独立"事件"。',
    '与 WCA 官方"Average of X solves"(ao5/mo3)完全不同 — 这里 X 是**轮次数**,不是单次还原数。',
    '`sub_id = 1` 过滤副身份(改名、换国籍的选手 dump 里会有多行 persons,只取主行)。',
  ],
  edgesEn: [
    'Only rounds with `average > 0` count. DNF averages (-1) and not-attempted (0) are excluded — someone who ran 4 rounds with one DNF\'d average lands in Ao3R, not Ao4R.',
    'Two AoXRs on the same date from different comps are not merged — each comp is its own event.',
    'Different from WCA "Average of X solves" (ao5 / mo3) — here X counts **rounds**, not solves.',
    '`sub_id = 1` filters out alt identities (renames, country changes — only the primary person row is kept).',
  ],
  related: [
    { id: 'wr_metric', titleZh: '指标 (Metric)', titleEn: 'Metric', hintZh: '同库的 WR 指标总集 — single/average/bao5/wao5/mo5/bpa/wpa/...', hintEn: 'Sibling stat — all WR metrics: single/average/bao5/wao5/mo5/bpa/wpa/...',
        titleZhHant: "指標 (Metric)",
        hintZhHant: "同庫的 WR 指標總集 — single/average/bao5/wao5/mo5/bpa/wpa/..."
    },
    { id: 'average_of', titleZh: '滚动平均 (Rolling Average)', titleEn: 'Rolling Average', hintZh: '跨比赛的 N-次滑动平均,对照口径', hintEn: 'Sliding N-window average across comps — sibling concept',
        titleZhHant: "滾動平均 (Rolling Average)",
        hintZhHant: "跨比賽的 N-次滑動平均,對照口徑"
    },
    { id: 'best_round', titleZh: '最佳轮次', titleEn: 'Best round', hintZh: '单轮 average 排名(不跨轮平均)', hintEn: 'Single round average leaderboard (no cross-round avg)',
        titleZhHant: "最佳輪次",
        hintZhHant: "單輪 average 排名(不跨輪平均)"
    },
    { id: 'wr_aoxr', toStat: true, titleZh: '直接打开 AoXR 排名', titleEn: 'Jump to AoXR ranking', hintZh: '看实际数据 / 项目切换', hintEn: 'Live data + event picker',
        titleZhHant: "直接開啟 AoXR 排名",
        hintZhHant: "看實際資料 / 專案切換"
    },
  ],
    titleZhHant: "AoXR — 單場比賽平均的均值",
    badgeZhHant: "世界紀錄"
};

// ──── wr_current ────────────────────────────────────────────────────────────
// 当前世界纪录快照 — 按项目 × {single, average} 取目前仍然成立的最快值
const wr_current: AboutEntry = {
  id: 'wr_current',
  titleZh: '当前世界纪录',
  titleEn: 'Current world records',
  badgeZh: '世界纪录',
  badgeEn: 'World record',
  introZh: [
    "把所有 `regional_single_record = 'WR'` 或 `regional_average_record = 'WR'` 的轮次成绩拉出来,按 (项目, single/average) 取当前**仍未被刷新**的最小值。一行 = 一条当前 WR 持有事件,附 single 的全部 attempt 明细。",
    '"当前"意味着只显示**今天仍然站着的那条**:历史上同一项目可能有几十条 WR,这里只看最新的。',
  ],
  introEn: [
    'Pulls every round flagged `regional_single_record = \'WR\'` or `regional_average_record = \'WR\'`, then per (event, single/average) keeps the minimum value — i.e. the WR that **still stands today**.',
    'One row per currently-standing record, with full attempt breakdown for singles. Historic WRs that have since been broken are not shown.',
  ],
  stats: [
    { value: '17 × 2', labelZh: '行数(满载)', labelEn: 'Rows (full)', hintZh: '每项目 single + average,无并列', hintEn: 'Single + average per event, no ties',
        labelZhHant: "行數(滿載)",
        hintZhHant: "每專案 single + average,無並列"
    },
    { value: 'WR', labelZh: '过滤条件', labelEn: 'Filter', hintZh: 'regional_single/average_record = WR', hintEn: 'regional_single/average_record = WR',
        labelZhHant: "過濾條件"
    },
    { value: 'asc', labelZh: '并列排序', labelEn: 'Tie order', hintZh: '同值取更早的 start_date', hintEn: 'Earlier start_date wins ties',
        labelZhHant: "並列排序"
    },
    { value: 'attempts', labelZh: '附明细', labelEn: 'Extra detail', hintZh: '5 次 attempt 全展示', hintEn: 'All 5 attempts shown',
        labelZhHant: "附明細"
    },
  ],
  sourceZh: [
    '查 `results` 表,filter 任意一种 WR 标志;join `persons`(`sub_id = 1`)和 `competitions` 取人名 / 比赛名 / 日期。Single 的 attempts 用 `GROUP_CONCAT` 子查询拼出来,前端 split 后逐次格式化(避免多盲值含空格被错误拆分)。',
  ],
  sourceEn: [
    'Reads `results` filtered by either WR flag; joins `persons` (`sub_id = 1`) and `competitions` for name / comp / date. The single\'s attempts come from a `GROUP_CONCAT` subquery on `result_attempts`, then the client splits and formats each attempt (string split avoids the MBLD space-encoding quirk).',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT r.event_id, r.best AS single, r.average,
       r.regional_single_record, r.regional_average_record,
       (SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number)
          FROM result_attempts ra WHERE ra.result_id = r.id) AS attempts,
       p.name, c.cell_name, c.start_date
FROM results r
JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
JOIN competitions c ON c.id = r.competition_id
WHERE r.regional_single_record = 'WR'
   OR r.regional_average_record = 'WR'
ORDER BY r.event_id, c.start_date;`,
  },
  steps: [
    {
      titleZh: '拉出所有 WR 标志行',
      titleEn: 'Pull every WR-flagged result',
      bodyZh: '一条 `results` 行可能 single 是 WR、average 是 WR、或两者都是。SQL 用 OR 把这三种都收进来,后续 transform 分两个口径分别看。',
      bodyEn: 'A single `results` row may have a WR single, a WR average, or both. The SQL OR captures all three; downstream transform splits single vs average and processes each independently.',
        titleZhHant: "拉出所有 WR 標誌行",
        bodyZhHant: "一條 `results` 行可能 single 是 WR、average 是 WR、或兩者都是。SQL 用 OR 把這三種都收進來,後續 transform 分兩個口徑分別看。"
    },
    {
      titleZh: '按项目分组,各自取最小值',
      titleEn: 'Group by event, keep the min',
      bodyZh: '遍历每个项目:single 看 `r.best`,average 看 `r.average`。在该项目内取**数值最小**的那条 = 当前 WR。',
      bodyEn: 'For each event: single uses `r.best`, average uses `r.average`. Within that event\'s WR-flagged rows, the minimum value wins — that\'s the standing record.',
        titleZhHant: "按專案分組,各自取最小值",
        bodyZhHant: "遍歷每個專案:single 看 `r.best`,average 看 `r.average`。在該專案內取**數值最小**的那條 = 當前 WR。"
    },
    {
      titleZh: '并列时选更早的',
      titleEn: 'Tie-break by earlier date',
      bodyZh: '同值并列(常见于 333fm / 333bf 单次)按 `start_date` 升序保留 — 先设出来的优先;但所有并列条目都会被输出,前端表格按项目分组展示。',
      bodyEn: 'Ties (common in 333fm / 333bf singles) are sorted ascending by `start_date` — the earliest holder lists first; every tied row is still emitted, so the table shows all co-holders.',
        titleZhHant: "並列時選更早的",
        bodyZhHant: "同值並列(常見於 333fm / 333bf 單次)按 `start_date` 升序保留 — 先設出來的優先;但所有並列條目都會被輸出,前端表格按專案分組展示。"
    },
    {
      titleZh: '格式化 single 的 attempts',
      titleEn: 'Format single\'s attempts',
      bodyZh: '只有 single 行才展示 5 次 attempt 明细 — 把 `GROUP_CONCAT` 出来的逗号字符串 split 后逐次过 `SolveTime.clockFormat()`。average 行的 attempts 跟单次 WR 的 attempts 是同一份,展示在 single 那行就够了。',
      bodyEn: 'Singles get the per-attempt breakdown: split the comma-joined `GROUP_CONCAT` then run each through `SolveTime.clockFormat()`. Average rows reuse the same attempt list as the single — showing it on the single row only avoids duplication.',
        bodyZhHant: "只有 single 行才展示 5 次 attempt 明細 — 把 `GROUP_CONCAT` 出來的逗號字串 split 後逐次過 `SolveTime.clockFormat()`。average 行的 attempts 跟單次 WR 的 attempts 是同一份,展示在 single 那行就夠了。"
    },
    {
      titleZh: '输出 (项目, Single/Average, 时间, 人, 日期, 比赛)',
      titleEn: 'Emit (event, single/average, time, person, date, comp)',
      bodyZh: '每条 WR 一行,日期格式化为 `YYYY-MM-DD`,人和比赛名都带 markdown 链接到 WCA 官网。',
      bodyEn: 'One row per standing WR; date as `YYYY-MM-DD`; person / comp rendered as markdown links to the WCA site.',
      highlight: true,
        titleZhHant: "輸出 (專案, Single/Average, 時間, 人, 日期, 比賽)",
        bodyZhHant: "每條 WR 一行,日期格式化為 `YYYY-MM-DD`,人和比賽名都帶 markdown 連結到 WCA 官網。"
    },
  ],
  edgesZh: [
    'WR 标志由 WCA 官方在 dump 里直接打 — 不需要本地重算,但意味着新打破的 WR 要等下次 dump 刷新才显示。',
    'Single 和 average 各自独立 — 一行 `results` 可能 single=WR、average 不是,或反之。',
    '并列的 single WR(尤其 333fm 历史 22 / 333bf 极快单次)全部展示,前端表格不去重。',
    '该 stat 没有 history 视图 — 历史演化看 `wr_metric` 的 Single / Average 子项。',
  ],
  edgesEn: [
    'WR flags come baked into the WCA dump — no re-computation here, but newly-broken records only appear after the next dump refresh.',
    'Single and average are independent — one `results` row can be a WR single but not a WR average (or vice-versa).',
    'Tied singles (notably old 333fm = 22 moves, blazing 333bf singles) are all listed; no dedup at the UI layer.',
    'No history view here — for time-series, see the Single / Average panels under `wr_metric`.',
  ],
  related: [
    { id: 'wr_metric', titleZh: '指标 (Metric)', titleEn: 'Metric', hintZh: 'WR single / average 的历史演化时间线', hintEn: 'WR single / average evolution over time',
        titleZhHant: "指標 (Metric)",
        hintZhHant: "WR single / average 的歷史演化時間線"
    },
    { id: 'wr_dominance', titleZh: '屠榜 (Dominance)', titleEn: 'Dominance', hintZh: '当前 WR 持有者领先第二名多少 — 配套视角', hintEn: 'How far the standing holder leads #2 — companion angle',
        hintZhHant: "當前 WR 持有者領先第二名多少 — 配套視角"
    },
    { id: 'grand-slam', titleZh: '大满贯', titleEn: 'Grand slam', hintZh: '同时持有 single + average WR 的稀有事件', hintEn: 'Rare moments of holding both single and average WR',
        titleZhHant: "大滿貫",
        hintZhHant: "同時持有 single + average WR 的稀有事件"
    },
    { id: 'wr_current', toStat: true, titleZh: '直接打开当前 WR 表', titleEn: 'Jump to current WR table', hintZh: '17 项 × {single, avg} 一目', hintEn: '17 events × {single, avg} at a glance',
        titleZhHant: "直接開啟當前 WR 表",
        hintZhHant: "17 項 × {single, avg} 一目"
    },
  ],
    titleZhHant: "當前世界紀錄",
    badgeZhHant: "世界紀錄"
};

// ──── wr_metric ─────────────────────────────────────────────────────────────
// 聚合 13 个从一轮 5 次还原中算出的衍生指标(single/avg/bao5/wao5/mo5/bpa/wpa/...)
const wr_metric: AboutEntry = {
  id: 'wr_metric',
  titleZh: '指标 (Metric)',
  titleEn: 'Metric',
  badgeZh: '世界纪录',
  badgeEn: 'World record',
  introZh: [
    '把"从一轮 5 次还原中能算出来的所有数"打包成一个聚合页:除了官方 single / average,还有 BAo5(5 中 3 最好均值)、WAo5(5 中 3 最差)、Mo5(裁不裁尾的总均值)、BPA / WPA(只看前 4 次的最好 / 最差可能 ao5)、Median、Best/Worst Counting、Worst、Variance、Best/Avg ratio 共 13 个指标。',
    '同一份原始数据(每轮 5 次 attempt)被反复榨干 — 选手"运气"与"稳定性"的对照在这一页上一览。前端把 13 个指标按 Basic / Composite / Distribution 三组下拉切换。',
  ],
  introEn: [
    'Bundles every derivable metric from a round\'s 5 solves into one aggregator: official Single / Average plus BAo5 (best 3 of 5), WAo5 (worst 3 of 5), Mo5 (mean of all 5, no trim), BPA / WPA (best / worst possible average from the first 4), Median, Best / Worst Counting, Worst, Variance, and Best/Avg Ratio — 13 metrics in total.',
    'One raw input (5 attempts per round) repeatedly squeezed to surface luck vs consistency. The UI groups the 13 metrics into Basic / Composite / Distribution dropdowns.',
  ],
  stats: [
    { value: '13', labelZh: '指标子类', labelEn: 'Metric subclasses', hintZh: '每个一份 RoundMetric 子类', hintEn: 'Each one a RoundMetric subclass',
        labelZhHant: "指標子類",
        hintZhHant: "每個一份 RoundMetric 子類"
    },
    { value: '3', labelZh: '分组', labelEn: 'Groups', hintZh: 'Basic / Composite / Distribution', hintEn: 'Basic / Composite / Distribution',
        labelZhHant: "分組"
    },
    { value: '2', labelZh: '视图', labelEn: 'Views', hintZh: '排名 + WR 历史', hintEn: 'Ranking + WR history',
        labelZhHant: "檢視",
        hintZhHant: "排名 + WR 歷史"
    },
    { value: 'EVENTS_WITH_AO5', labelZh: '覆盖项目', labelEn: 'Event scope', hintZh: '只看正式 ao5 项目(BLD/MBLD/FMC 除外)', hintEn: 'Official ao5 events only (excl. BLD / MBLD / FMC)',
        labelZhHant: "覆蓋專案",
        hintZhHant: "只看正式 ao5 專案(BLD/MBLD/FMC 除外)"
    },
  ],
  sourceZh: [
    '本类自身**不查 SQL** — `query()` 返回空串。每个子类(`wr_bao5` / `wr_mo5` / `wr_bpa` / ...)各自走 `RoundMetric` 基类,基类用一份 batch SQL 把所有 ao5 项目的 attempt 拉出来共享,子类只覆写 `computeMetric(values)` 决定 5 个数怎么算。',
    '聚合层把 13 份 `toJson()` 结果按 id 包成 `MetricPanel[]`,再附 `metricGroups` 元数据让前端渲染分组下拉。',
  ],
  sourceEn: [
    'This class issues **no SQL of its own** — `query()` returns ``. Each child (`wr_bao5` / `wr_mo5` / `wr_bpa` / ...) hooks into the `RoundMetric` base class, which runs one batch SQL across all ao5 events and shares the attempt rows. Each child only overrides `computeMetric(values)` to define how the 5 numbers collapse.',
    'The aggregator wraps the 13 children\'s `toJson()` outputs as `MetricPanel[]` keyed by id, and adds `metricGroups` metadata so the UI can render group dropdowns.',
  ],
  sourceCode: {
    lang: 'ts',
    body: `// 13 个子类按 id 注册,逐个 import + run
for (const def of METRIC_DEFS) {
  const mod = await def.module();
  const inst = new (Object.values(mod).find(v => typeof v === 'function'))();
  const sub = await inst.toJson();
  metricPanels.push({
    id: def.id, labelEn: def.label,
    labelZh: sub.titleZh, panels: sub.panels,
  });
  if (global.gc) global.gc();   // 子统计完释放,防 OOM
}`,
    captionZh: '聚合层 — 逐子类 import + GC',
    captionEn: 'Aggregator — child-by-child import + GC',
      captionZhHant: "聚合層 — 逐子類 import + GC"
},
  steps: [
    {
      titleZh: '基类 batch SQL 抓 attempts',
      titleEn: 'Base class batch-loads attempts',
      bodyZh: '`RoundMetric` 父类对所有 batch 子类 share 一份 SQL:每轮 attempt 用 `GROUP_CONCAT` 拼成字符串。所有 11 个 batch 子类共用这份缓存,避免 11 倍重复查询。',
      bodyEn: '`RoundMetric` shares one SQL across all batch-mode children — round attempts come back as a `GROUP_CONCAT` string. The cached rows feed all 11 batch children, dodging 11× redundant queries.',
        titleZhHant: "基類 batch SQL 抓 attempts",
        bodyZhHant: "`RoundMetric` 父類對所有 batch 子類 share 一份 SQL:每輪 attempt 用 `GROUP_CONCAT` 拼成字串。所有 11 個 batch 子類共用這份快取,避免 11 倍重複查詢。"
    },
    {
      titleZh: '子类定义"怎么从 5 个数得到 1 个"',
      titleEn: 'Each child defines `computeMetric(values)`',
      bodyZh: '只覆写一个方法:接收一个 length-5 的数组(可能含 DNF=-1),返回一个数或 null。例如 BAo5 = 前 3 小求均值;WAo5 = 后 3 大求均值;BPA = 前 4 个的 best-3 均值。',
      bodyEn: 'A child overrides one method: take a length-5 array (DNFs as -1), return a number or null. e.g. BAo5 = mean of the smallest 3; WAo5 = mean of the largest 3; BPA = best-3 of the first 4.',
        titleZhHant: "子類定義\"怎麼從 5 個數得到 1 個\"",
        bodyZhHant: "只覆寫一個方法:接收一個 length-5 的陣列(可能含 DNF=-1),返回一個數或 null。例如 BAo5 = 前 3 小求均值;WAo5 = 後 3 大求均值;BPA = 前 4 個的 best-3 均值。"
    },
    {
      titleZh: '排名:每项目 Top 10 + WR 历史',
      titleEn: 'Rank: per-event top 10 + WR history',
      bodyZh: '基类对每个子类输出双视图:Ranking(每人最佳指标值,项目 Top 10)和 History(按时间扫描严格刷新当前最小值的事件序列)。WR 历史走 `filterWrHistory(strict=true)`。',
      bodyEn: 'Base class emits two panels per child: Ranking (per-person best metric, top 10 by event) and History (chronological scan keeping strict improvements). WR history uses `filterWrHistory(strict=true)`.',
        titleZhHant: "排名:每專案 Top 10 + WR 歷史",
        bodyZhHant: "基類對每個子類輸出雙檢視:Ranking(每人最佳指標值,專案 Top 10)和 History(按時間掃描嚴格重新整理當前最小值的事件序列)。WR 歷史走 `filterWrHistory(strict=true)`。"
    },
    {
      titleZh: '聚合层拼成 MetricPanel[]',
      titleEn: 'Aggregator wraps into MetricPanel[]',
      bodyZh: '13 份 sub `toJson()` 输出按 METRIC_DEFS 顺序串成数组,每项含 `id / labelEn / labelZh / panels`。前端用 `metricPanels[i].id` 在 dropdown 切换。',
      bodyEn: 'The 13 sub `toJson()` outputs concatenate in METRIC_DEFS order; each entry holds `id / labelEn / labelZh / panels`. The UI matches `metricPanels[i].id` against the dropdown.',
        titleZhHant: "聚合層拼成 MetricPanel[]",
        bodyZhHant: "13 份 sub `toJson()` 輸出按 METRIC_DEFS 順序串成陣列,每項含 `id / labelEn / labelZh / panels`。前端用 `metricPanels[i].id` 在 dropdown 切換。"
    },
    {
      titleZh: '附 metricGroups → UI 分三组下拉',
      titleEn: 'Emit metricGroups → UI three-section dropdown',
      bodyZh: 'Basic = {single, average}, Composite = {bao5, wao5, mo5, bpa, wpa}, Distribution = {median, bestc, worstc, worst, variance, ratio}。前端按这个分组渲染下拉,而不是 13 个扁平选项。',
      bodyEn: 'Basic = {single, average}, Composite = {bao5, wao5, mo5, bpa, wpa}, Distribution = {median, bestc, worstc, worst, variance, ratio}. UI renders a grouped dropdown rather than 13 flat items.',
      highlight: true,
        titleZhHant: "附 metricGroups → UI 分三組下拉",
        bodyZhHant: "Basic = {single, average}, Composite = {bao5, wao5, mo5, bpa, wpa}, Distribution = {median, bestc, worstc, worst, variance, ratio}。前端按這個分組渲染下拉,而不是 13 個扁平選項。"
    },
  ],
  formulae: [
    {
      labelZh: 'BAo5 / WAo5 / Mo5',
      labelEn: 'BAo5 / WAo5 / Mo5',
      expr: 'BAo5 = (s₁+s₂+s₃)/3   WAo5 = (s₃+s₄+s₅)/3   Mo5 = (s₁+...+s₅)/5',
      bodyZh: '其中 s₁ ≤ s₂ ≤ ... ≤ s₅ 为本轮 5 次升序排序后的成绩。5 次必须全有效(Mo5 / WAo5),BAo5 至少 3 次有效。',
      bodyEn: 'with s₁ ≤ s₂ ≤ ... ≤ s₅ being the round\'s 5 solves sorted ascending. Mo5 / WAo5 need all 5 valid; BAo5 needs at least 3 valid.',
        bodyZhHant: "其中 s₁ ≤ s₂ ≤ ... ≤ s₅ 為本輪 5 次升序排序後的成績。5 次必須全有效(Mo5 / WAo5),BAo5 至少 3 次有效。"
    },
    {
      labelZh: 'BPA / WPA(决赛前预测口径)',
      labelEn: 'BPA / WPA (pre-last-solve hypothetical)',
      expr: 'BPA = mean(best 3 of {s₁,s₂,s₃,s₄})   WPA = mean(worst 3 of {s₁,s₂,s₃,s₄})',
      bodyZh: '只用前 4 次:第 5 次还没打,BPA = 假设第 5 次完美时能拿的 ao5 下限;WPA = 假设第 5 次崩盘时的上限。比赛镜头里常见"BPA 锁纪录"的来源。',
      bodyEn: 'Uses only the first 4: BPA = best ao5 achievable if solve 5 lands perfectly; WPA = worst ao5 if solve 5 implodes. The "BPA-locked" tension you see on stream comes from here.',
        labelZhHant: "BPA / WPA(決賽前預測口徑)",
        bodyZhHant: "只用前 4 次:第 5 次還沒打,BPA = 假設第 5 次完美時能拿的 ao5 下限;WPA = 假設第 5 次崩盤時的上限。比賽鏡頭裡常見\"BPA 鎖紀錄\"的來源。"
    },
  ],
  edgesZh: [
    '所有指标只覆盖**有 ao5 的项目**(`EVENTS_WITH_AO5`);BLD / MBLD / FMC 没有 5 次组,这页不参与。',
    'BPA / WPA 用前 4 次,顺序敏感:第几次 attempt 由 `attempt_number` 决定,SQL 里 `GROUP_CONCAT(ORDER BY attempt_number)` 保证顺序。',
    'Worst Counting 要求至多 1 次 DNF(否则 ao5 本身 DNF);Worst 要求 5 次全有效。',
    'Median 计算 ≥ 3 次 DNF 时返 null(不输出),否则取排序后 index=2 — DNF 会"挤"中位数向更高有效成绩偏。',
  ],
  edgesEn: [
    'All metrics target **ao5 events only** (`EVENTS_WITH_AO5`); BLD / MBLD / FMC have no 5-solve grouping and don\'t participate.',
    'BPA / WPA are order-sensitive on the first 4 attempts: ordering comes from `attempt_number`, which SQL preserves via `GROUP_CONCAT(... ORDER BY attempt_number)`.',
    'Worst Counting tolerates at most 1 DNF (else the ao5 itself is DNF); Worst Solve requires all 5 valid.',
    'Median returns null with ≥ 3 DNFs; otherwise picks the sorted index 2 — DNFs shift the median up to a higher valid solve.',
  ],
  related: [
    { id: 'wr_aoxr', titleZh: 'AoXR', titleEn: 'AoXR', hintZh: '跨轮平均(单场比赛级),对照单轮指标', hintEn: 'Cross-round average (per-comp) — companion to per-round metrics',
        hintZhHant: "跨輪平均(單場比賽級),對照單輪指標"
    },
    { id: 'wr_current', titleZh: '当前 WR', titleEn: 'Current WR', hintZh: '只看 single / average 两子项的当前持有', hintEn: 'Just the single / average panels frozen at today',
        titleZhHant: "當前 WR",
        hintZhHant: "只看 single / average 兩子項的當前持有"
    },
    { id: 'wr_dominance', titleZh: '屠榜', titleEn: 'Dominance', hintZh: '同维度看"领先程度"', hintEn: 'Same dimensions, but measuring the lead size',
        hintZhHant: "同維度看\"領先程度\""
    },
    { id: 'wr_metric', toStat: true, titleZh: '直接打开 Metric 总表', titleEn: 'Jump to Metric explorer', hintZh: '13 个指标 × 项目下拉', hintEn: '13 metrics × event dropdown',
        titleZhHant: "直接開啟 Metric 總表",
        hintZhHant: "13 個指標 × 專案下拉"
    },
  ],
    titleZhHant: "指標 (Metric)",
    badgeZhHant: "世界紀錄"
};

// ──── wr_dominance ──────────────────────────────────────────────────────────
// 屠榜 — 当前 WR 持有者在全历史排名上自己的成绩比第 2 名所有人都好的数量
const wr_dominance: AboutEntry = {
  id: 'wr_dominance',
  titleZh: '屠榜 (Dominance)',
  titleEn: 'Dominance',
  badgeZh: '世界纪录',
  badgeEn: 'World record',
  introZh: [
    '"屠榜"度量当前榜首多远地甩开第二名。具体来说:在某项目全历史的成绩列表里,**当前最强**的选手 P 有多少条成绩**严格快于**所有其他选手的最佳成绩?那个数量 = dominance。',
    'P 把前 5 / 前 10 / 前 N 都自己占了 = 高分屠榜;P 只赢出第二名 0.01 秒 = 极低 dominance,即便他确实是 WR 持有者。指标双维度(single / average)× 双视图(当前排名 / 历史演变),后者画出"屠榜深度"在时间轴上的演化。',
  ],
  introEn: [
    'Dominance measures how far the top seat is from the rest. Concretely: across an event\'s full history, how many of the **current #1**\'s individual results are **strictly faster than every other person\'s best**? That count is dominance.',
    'P claims #1 through #N alone with all of their own marks = high-score domination; P beats #2 by 0.01s = near-zero dominance even though they hold the WR. Two metrics (single / average) × two views (live ranking / WR evolution), with the history view drawing how that depth grew.',
  ],
  stats: [
    { value: 'count', labelZh: '主指标', labelEn: 'Primary metric', hintZh: 'P 严格快于 others_best 的成绩数', hintEn: 'Count of P\'s results strictly < others\' best',
        labelZhHant: "主指標",
        hintZhHant: "P 嚴格快於 others_best 的成績數"
    },
    { value: '2 + 2', labelZh: '面板', labelEn: 'Panels', hintZh: 'Single/Average × Ranking/History', hintEn: 'Single/Average × Ranking/History' },
    { value: '~5 M', labelZh: '扫描行 (333)', labelEn: 'Rows scanned (333)', hintZh: '逐 event 加载 result_attempts', hintEn: 'Per-event scan of result_attempts',
        labelZhHant: "掃描行 (333)",
        hintZhHant: "逐 event 載入 result_attempts"
    },
    { value: 'O(log n)', labelZh: '更新成本', labelEn: 'Update cost', hintZh: '每选手有序数组 + 二分插入', hintEn: 'Per-person sorted array + binary insert',
        hintZhHant: "每選手有序陣列 + 二分插入"
    },
  ],
  sourceZh: [
    'Single 走 `result_attempts`(每行一次 attempt),Average 走 `results.average`(每轮一行);都按 `start_date` 升序逐 event 扫一遍,**不带** person/comp 链接字符串(瘦行,500 万行省 ~2GB)。',
    '扫完后维护每选手的有序数组 + 当前 best;在"日期切换"边界检查 dominance 是否刷新历史最大值。最后一次性 `IN (...)` 查少量链接拼出来。',
  ],
  sourceEn: [
    'Single mode reads `result_attempts` (one row per solve), Average mode reads `results.average` (one row per round). Both scan per-event in `start_date` order, **without** embedded person/comp link strings (slim rows save ~2GB at 5M rows).',
    'During the scan, maintain a sorted array + running best per person; at each date boundary check whether dominance just hit a new max. Final markdown links are resolved with one `IN (...)` query over the surviving few dozen IDs.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `-- Single (瘦行)
SELECT result.person_id, ra.value,
       result.competition_id AS comp_id, competition.start_date
FROM result_attempts ra
JOIN results result ON result.id = ra.result_id
JOIN competitions competition ON competition.id = result.competition_id
WHERE ra.value > 0 AND result.event_id = '<event>'
ORDER BY competition.start_date;`,
  },
  steps: [
    {
      titleZh: '逐 event 加载瘦行,按日期升序',
      titleEn: 'Per-event load slim rows, sorted by date',
      bodyZh: 'Single 看 `result_attempts.value`,Average 看 `results.average`。**只取 person_id / value / comp_id / start_date 四列** — 不在 SQL 里拼 markdown 链接(后置查询),避免百万行字符串膨胀。',
      bodyEn: 'Single ← `result_attempts.value`; Average ← `results.average`. **Just four columns**: person_id / value / comp_id / start_date — markdown links are resolved later, dodging string bloat across millions of rows.',
        titleZhHant: "逐 event 載入瘦行,按日期升序",
        bodyZhHant: "Single 看 `result_attempts.value`,Average 看 `results.average`。**只取 person_id / value / comp_id / start_date 四列** — 不在 SQL 裡拼 markdown 連結(後置查詢),避免百萬行字串膨脹。"
    },
    {
      titleZh: '每人维护有序数组 + best',
      titleEn: 'Per-person sorted array + best',
      bodyZh: '边扫边二分插入(`bisectLeft`),保持 O(log n) 维护"每人的所有有效成绩排序数组"`pv` + 当前 best `pb`。',
      bodyEn: 'Stream through, binary-insert each value (`bisectLeft`) into `pv[person]` (sorted array of all valid times for that person). Maintain `pb[person]` = running best.',
        titleZhHant: "每人維護有序陣列 + best",
        bodyZhHant: "邊掃邊二分插入(`bisectLeft`),保持 O(log n) 維護\"每人的所有有效成績排序陣列\"`pv` + 當前 best `pb`。"
    },
    {
      titleZh: '日期切换边界:算 dominance',
      titleEn: 'On date boundary: compute dominance',
      bodyZh: '当 `start_date` 跳到下一天时,扫一遍 `pb`:找全局最快选手 P + 次快值 `others_best`;在 P 的有序数组里 `bisectLeft(others_best)` 得到 P **严格快于** others_best 的成绩数。这就是当日的 dominance count。',
      bodyEn: 'When `start_date` rolls forward, scan `pb`: find global leader P + the second-best across everyone else (`others_best`). Then `bisectLeft(pv[P], others_best)` = number of P\'s results strictly faster than `others_best`. That\'s the day\'s dominance count.',
        titleZhHant: "日期切換邊界:算 dominance",
        bodyZhHant: "當 `start_date` 跳到下一天時,掃一遍 `pb`:找全域性最快選手 P + 次快值 `others_best`;在 P 的有序陣列裡 `bisectLeft(others_best)` 得到 P **嚴格快於** others_best 的成績數。這就是當日的 dominance count。"
    },
    {
      titleZh: '历史:严格刷新才记一条',
      titleEn: 'History: keep strict refreshes only',
      bodyZh: '日期切换时,如果 count 严格大于 `maxDom`,记一条 WR event:当前 P / 当前 comp / 当前日期 + 该选手**首次达到屠榜**的比赛(`firstDom`)。后期算 improvement = `+(count - prev.count)` 和持续时长(days)。',
      bodyEn: 'On boundary, if `count > maxDom` strictly, log a WR event: current P, comp, date, plus the comp where that person **first reached domination** (`firstDom`). Later compute improvement = `+(count - prev.count)` and run-length days.',
        titleZhHant: "歷史:嚴格重新整理才記一條",
        bodyZhHant: "日期切換時,如果 count 嚴格大於 `maxDom`,記一條 WR event:當前 P / 當前 comp / 當前日期 + 該選手**首次達到屠榜**的比賽(`firstDom`)。後期算 improvement = `+(count - prev.count)` 和持續時長(days)。"
    },
    {
      titleZh: '最后一次性 IN(...) 解链接,落 JSON',
      titleEn: 'Resolve markdown links in one IN(...) pass',
      bodyZh: '所有 event 扫完,把累计到的 person/comp ID 集合用 `IN (...)` 一次查 `persons` / `competitions` 拼 markdown 链接;然后把瘦行的 ID 替换成链接字符串,生成 4 个 panel(2 指标 × {ranking, history})。',
      bodyEn: 'After all events finish, batch-resolve every accumulated person_id / comp_id with one `IN (...)` query against `persons` / `competitions` to build markdown links; substitute slim-row IDs with link strings; emit 4 panels (2 metrics × {ranking, history}).',
      highlight: true,
        titleZhHant: "最後一次性 IN(...) 解連結,落 JSON",
        bodyZhHant: "所有 event 掃完,把累計到的 person/comp ID 集合用 `IN (...)` 一次查 `persons` / `competitions` 拼 markdown 連結;然後把瘦行的 ID 替換成連結字串,生成 4 個 panel(2 指標 × {ranking, history})。"
    },
  ],
  formulae: [
    {
      labelZh: 'Dominance count',
      labelEn: 'Dominance count',
      expr: 'dom(P, t) = | { v ∈ results(P, ≤t) : v < min_{Q ≠ P} best(Q, ≤t) } |',
      bodyZh: 't = 当前时间点。即:截至 t 时,选手 P 名下严格快于"任何其他选手最佳成绩"的成绩条数。',
      bodyEn: 't = current point in time. The count of P\'s results (up to t) that are strictly faster than the best result of any other person (up to t).',
        bodyZhHant: "t = 當前時間點。即:截至 t 時,選手 P 名下嚴格快於\"任何其他選手最佳成績\"的成績條數。"
    },
  ],
  edgesZh: [
    '**平 (tied) 成绩不计入屠榜** — `bisectLeft` 找的是第一个 `>= target` 的位置,等于 `others_best` 的成绩不算 P 的赢分。',
    'Single 和 Average 是完全独立的两份扫描 — Single 在 attempt 级(同轮 5 次都算),Average 在轮级。',
    '"日期边界"是按 `start_date` 字符串切的 — 同日多场比赛会合并在一个 boundary 同时结算,不会拆成两次。',
    '榜首换人时 `firstDom` 也会重置 — 新王朝从 0 开始累计,展示的不是该人成绩从首条开始而是从他**夺榜**那天起的累计。',
  ],
  edgesEn: [
    '**Tied results don\'t count** — `bisectLeft` returns the first `>= target` index, so values equal to `others_best` don\'t add to P\'s margin.',
    'Single and Average run as fully independent scans — Single at attempt-granularity (all 5 solves of each round count), Average at round-granularity.',
    'Date boundaries split on `start_date` strings — multiple comps on the same day collapse into one boundary, not two.',
    'When the leader changes, `firstDom` resets — the new reign counts from the day they took the top seat, not from their first-ever result.',
  ],
  related: [
    { id: 'wr_current', titleZh: '当前 WR', titleEn: 'Current WR', hintZh: 'P 是谁/拿什么成绩 — 屠榜的对象', hintEn: 'Who P is and their headline time — the subject of dominance',
        titleZhHant: "當前 WR",
        hintZhHant: "P 是誰/拿什麼成績 — 屠榜的物件"
    },
    { id: 'wr_metric', titleZh: '指标 (Metric)', titleEn: 'Metric', hintZh: '13 个 metric 的 WR 演化序列', hintEn: 'WR evolution across 13 derived metrics',
        titleZhHant: "指標 (Metric)",
        hintZhHant: "13 個 metric 的 WR 演化序列"
    },
    { id: 'longest_standing_records', titleZh: '持续最久的纪录', titleEn: 'Longest-standing records', hintZh: 'WR 多久不被刷 vs 屠榜多深,两个稳定性视角', hintEn: 'How long unbroken vs how deep the lead — two stability lenses',
        titleZhHant: "持續最久的紀錄",
        hintZhHant: "WR 多久不被刷 vs 屠榜多深,兩個穩定性視角"
    },
    { id: 'wr_dominance', toStat: true, titleZh: '直接打开屠榜表', titleEn: 'Jump to Dominance table', hintZh: '看每项目当前 #1 屠了多少', hintEn: 'See how deep each event\'s #1 dominates',
        titleZhHant: "直接開啟屠榜表",
        hintZhHant: "看每專案當前 #1 屠了多少"
    },
  ],
    badgeZhHant: "世界紀錄"
};

// ──── wr_non_pr ─────────────────────────────────────────────────────────────
// 非 PR 的 WR — 选手刷新 WR 时手里已经有过更好成绩
const wr_non_pr: AboutEntry = {
  id: 'wr_non_pr',
  titleZh: '非 PR 的纪录',
  titleEn: 'Non-PR records',
  badgeZh: '世界纪录',
  badgeEn: 'World record',
  introZh: [
    '正常情况下,WR = PR(个人纪录) — 你打出来比谁都快,自然也比自己以前快。但偶尔会反着:选手在某轮成绩**不是自己最快**,却仍然好过史上其它所有人,也就是说他自己以前的某条更好成绩才是真正历史最快。这页找的就是这种"虽不是 PR 但仍最强"的成绩。',
    '常见场景:大佬连发数轮,中后段一个 ao5 比自己之前的 PB 慢,但仍超过其他人最佳。该 ao5 不刷新 WR(因为他自己更快的那条已经是 WR 了),但它仍是**所有非 PR 成绩里**的最强。统计输出双视图:每人的最佳 non-PR(排名) + WR 进化(历史)。',
  ],
  introEn: [
    'Usually WR = PR — beating everyone implies beating yourself. But occasionally a result is **not the person\'s best yet still better than everyone else** — i.e. their own earlier result is the true historical leader. This page surfaces those "not-PR-but-still-king" results.',
    'Typical setup: a top cuber posts several rounds in a row; a mid-event ao5 is slower than their PB but faster than every other person\'s best. That ao5 doesn\'t set a new WR (their own faster one already holds it), but it is still **the strongest result among all non-PR results**. Two views: per-person best non-PR (ranking) + non-PR WR evolution (history).',
  ],
  stats: [
    { value: 'val > pb', labelZh: '入选条件', labelEn: 'Inclusion rule', hintZh: '严格慢于自己当前 PB 才算 non-PR', hintEn: 'Strictly slower than own running PB',
        labelZhHant: "入選條件",
        hintZhHant: "嚴格慢於自己當前 PB 才算 non-PR"
    },
    { value: '2 + 2', labelZh: '面板', labelEn: 'Panels', hintZh: 'Single/Average × Ranking/History', hintEn: 'Single/Average × Ranking/History' },
    { value: '%', labelZh: '历史 Δ', labelEn: 'History Δ', hintZh: '相邻 non-PR WR 的提升百分比', hintEn: 'Gain % between consecutive non-PR WRs',
        labelZhHant: "歷史 Δ",
        hintZhHant: "相鄰 non-PR WR 的提升百分比"
    },
    { value: 'O(n)', labelZh: '单次扫描', labelEn: 'Single scan', hintZh: '每选手维护一个 PB 数', hintEn: 'One running PB per person',
        labelZhHant: "單次掃描",
        hintZhHant: "每選手維護一個 PB 數"
    },
  ],
  sourceZh: [
    '逐 event 查所有 `results.best` / `results.average` > 0 的行(同时取两列减少查询次数),join `persons` + `competitions` 取链接。按 `(start_date, result.id)` 升序扫一遍。',
    'Single 和 Average 共用这份原始数据,各走一遍 `computeNonPr` — 维护两份 `pb` Map(每选手的最佳)和 `bestNonPr` Map(每选手的最佳非 PR)。',
  ],
  sourceEn: [
    'Per event, pull every row with `results.best > 0` or `results.average > 0` (both columns in one query), join `persons` + `competitions` for link strings, then iterate ascending by `(start_date, result.id)`.',
    'Single and Average reuse the same row set — each runs `computeNonPr` independently, maintaining its own `pb` map (running personal best) and `bestNonPr` map (best non-PR per person).',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT result.person_id, result.best, result.average,
       person.country_id,
       <person_link>, <comp_link>,
       competition.start_date
FROM results result
JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
JOIN competitions competition ON competition.id = result.competition_id
WHERE result.event_id = '<event>'
  AND (result.best > 0 OR result.average > 0)
ORDER BY competition.start_date, result.id;`,
  },
  steps: [
    {
      titleZh: '按 (日期, 行 id) 升序扫',
      titleEn: 'Scan ascending by (date, row id)',
      bodyZh: '同日多比赛之间没有严格序;`result.id` 当 tiebreaker 给一个确定性顺序。`pb` 跟 `bestNonPr` 在扫描中累加。',
      bodyEn: 'Same-day comps lack a strict order; `result.id` serves as a deterministic tiebreaker. `pb` and `bestNonPr` accumulate as the scan progresses.',
        titleZhHant: "按 (日期, 行 id) 升序掃",
        bodyZhHant: "同日多比賽之間沒有嚴格序;`result.id` 當 tiebreaker 給一個確定性順序。`pb` 跟 `bestNonPr` 在掃描中累加。"
    },
    {
      titleZh: 'val ≤ pb → PR,跳过',
      titleEn: 'val ≤ pb → it\'s a PR, skip',
      bodyZh: '如果当前值 ≤ 该选手当前 PB(包括首次出现 / 刷新 / 平 PB),更新 `pb[pid] = val` 然后**跳过** — 这条不属于 non-PR。',
      bodyEn: 'If current value ≤ their running PB (first appearance, refresh, or tie), set `pb[pid] = val` and **skip** — this row isn\'t a non-PR.',
        titleZhHant: "val ≤ pb → PR,跳過",
        bodyZhHant: "如果當前值 ≤ 該選手當前 PB(包括首次出現 / 重新整理 / 平 PB),更新 `pb[pid] = val` 然後**跳過** — 這條不屬於 non-PR。"
    },
    {
      titleZh: 'val > pb → 进 bestNonPr',
      titleEn: 'val > pb → enter bestNonPr',
      bodyZh: '当前值严格慢于 pb = 是 non-PR。如果 `val < bestNonPr[pid].value`(或首次),更新 `bestNonPr[pid]`。同时维护"non-PR WR"`wrBest` — 跨人比较,记录全局最好的非 PR 成绩。',
      bodyEn: 'Value strictly slower than pb = it\'s a non-PR. If `val < bestNonPr[pid].value` (or first time), update `bestNonPr[pid]`. Also maintain a cross-person `wrBest` — track the strongest non-PR ever seen.',
        titleZhHant: "val > pb → 進 bestNonPr",
        bodyZhHant: "當前值嚴格慢於 pb = 是 non-PR。如果 `val < bestNonPr[pid].value`(或首次),更新 `bestNonPr[pid]`。同時維護\"non-PR WR\"`wrBest` — 跨人比較,記錄全域性最好的非 PR 成績。"
    },
    {
      titleZh: '排名:bestNonPr 取最快前 10',
      titleEn: 'Ranking: top 10 fastest bestNonPr',
      bodyZh: '每人保留**最快的 non-PR**;按值升序排,每项目 top 10 输出 [rank, person, time, country, date, comp]。',
      bodyEn: 'Keep each person\'s single fastest non-PR; sort ascending, take top 10 per event, output [rank, person, time, country, date, comp].',
        bodyZhHant: "每人保留**最快的 non-PR**;按值升序排,每專案 top 10 輸出 [rank, person, time, country, date, comp]。"
    },
    {
      titleZh: '历史:wrBest 演化 → 倒序展示',
      titleEn: 'History: wrBest evolution → reverse-chrono',
      bodyZh: 'scan 中追加到 wrRecords 的每条都是当时的"非 PR WR";最后倒序输出 + 计算相邻 improvement `(prev-cur)/prev × 100%` 和持续天数。',
      bodyEn: 'Each `wrRecords` entry marks a non-PR WR moment at the time; reverse the list for newest-first, then compute adjacent improvement `(prev-cur)/prev × 100%` plus run-length days.',
      highlight: true,
        titleZhHant: "歷史:wrBest 演化 → 倒序展示",
        bodyZhHant: "scan 中追加到 wrRecords 的每條都是當時的\"非 PR WR\";最後倒序輸出 + 計算相鄰 improvement `(prev-cur)/prev × 100%` 和持續天數。"
    },
  ],
  formulae: [
    {
      labelZh: '非 PR 判定',
      labelEn: 'Non-PR predicate',
      expr: 'isNonPR(P, t, v) ⟺ v > min{v\' : v\' ∈ results(P, < t)}',
      bodyZh: 'P = 选手,t = 时间,v = 当前成绩。当前成绩严格大于此前所有自己成绩的最小值时,该成绩是 non-PR。',
      bodyEn: 'P = person, t = time, v = current value. Strictly greater than the min of all the same person\'s prior results = non-PR.',
        bodyZhHant: "P = 選手,t = 時間,v = 當前成績。當前成績嚴格大於此前所有自己成績的最小值時,該成績是 non-PR。"
    },
  ],
  edgesZh: [
    '**平 PB 算 PR 不算 non-PR** — `val <= pb` 时进入 PR 分支,只有 `val > pb` 才进 non-PR 池。',
    'Single 和 Average 各自独立 — 同一行 `results` 里 best 可能是 PR、average 是 non-PR,反之亦然。',
    'WR History 的"Improvement"百分比公式:`(prev - cur) / prev × 100%`;首条留空。',
    '排名展示每人**最快的一条** non-PR,不展示其余 non-PR — 同一选手在历史里有几十次刷自己最好但仍不刷 PB 的轮次,这里只看最强那条。',
  ],
  edgesEn: [
    '**Ties (val == pb) count as PR, not non-PR** — `val <= pb` takes the PR branch; only `val > pb` enters the non-PR pool.',
    'Single and Average are tracked independently — within one `results` row, best could be a PR while average is non-PR (or vice-versa).',
    'History "Improvement" % uses `(prev - cur) / prev × 100%`; first row blank.',
    'Ranking shows each person\'s single fastest non-PR only — a cuber may have hundreds of non-PR-but-close rounds; only their strongest surfaces here.',
  ],
  related: [
    { id: 'wr_current', titleZh: '当前 WR', titleEn: 'Current WR', hintZh: 'PR = WR 的正常情况对照', hintEn: 'The "PR = WR" normal case for comparison',
        titleZhHant: "當前 WR",
        hintZhHant: "PR = WR 的正常情況對照"
    },
    { id: 'wr_metric', titleZh: '指标 (Metric)', titleEn: 'Metric', hintZh: 'WR 历史正轨', hintEn: 'The standard WR history track',
        titleZhHant: "指標 (Metric)",
        hintZhHant: "WR 歷史正軌"
    },
    { id: 'wr_newcomer', titleZh: '新人首场', titleEn: 'Newcomer first', hintZh: '另一类反直觉 WR — 第一场就破纪录', hintEn: 'Another counter-intuitive WR slice — record on debut',
        titleZhHant: "新人首場",
        hintZhHant: "另一類反直覺 WR — 第一場就破紀錄"
    },
    { id: 'wr_non_pr', toStat: true, titleZh: '直接打开 Non-PR 表', titleEn: 'Jump to Non-PR table', hintZh: '看哪些项目出过这种事', hintEn: 'See which events have seen this',
        titleZhHant: "直接開啟 Non-PR 表",
        hintZhHant: "看哪些專案出過這種事"
    },
  ],
    titleZhHant: "非 PR 的紀錄",
    badgeZhHant: "世界紀錄"
};

// ──── wr_newcomer ───────────────────────────────────────────────────────────
// 新人在首次还原 / 首场比赛就破纪录 — 双数据源 × 双指标
const wr_newcomer: AboutEntry = {
  id: 'wr_newcomer',
  titleZh: '新人首战 (Newcomer)',
  titleEn: 'Newcomer first WR',
  badgeZh: '世界纪录',
  badgeEn: 'World record',
  introZh: [
    '"新人首战"看选手**在某项目最早一次接触**时拿出的成绩 — 即在他人生第一场该项目比赛上的成绩。该值越快越罕见,越接近(甚至超过)历史 WR 越离谱。',
    '页面有两个数据源:**首次还原 (1st-solve)** = 该选手该项目首场比赛**第一轮的第一次 attempt**(或 average,看指标);**首场比赛 (1st-comp)** = 该选手该项目首场比赛**所有轮次中最快的一次** — 1st-comp 给选手稍多机会(同场多轮),1st-solve 是真正的"开局即上限"。两个数据源 × 两个指标(single / average) = 4 组面板,每组都有 Ranking + History。',
  ],
  introEn: [
    '"Newcomer first WR" looks at what a cuber posts the **very first time they touch the event** in competition — the rarer / faster the value, the more astonishing.',
    'Two sources: **1st-solve** = the very first attempt (or average, per metric) in their **first round of their first comp** for that event; **1st-comp** = the fastest result across **all rounds of that first comp** — 1st-comp grants more chances within the comp, 1st-solve is the "debut single-shot." Two sources × two metrics (single / average) = 4 panel groups, each with Ranking + History.',
  ],
  stats: [
    { value: '2 × 2 × 2', labelZh: '维度', labelEn: 'Dims', hintZh: 'metric × source × view', hintEn: 'metric × source × view',
        labelZhHant: "維度"
    },
    { value: 'tmp table', labelZh: 'first_comp 索引', labelEn: 'first_comp index', hintZh: '临时表 + (person, event, date) 索引', hintEn: 'Temp table + (person, event, date) idx',
        hintZhHant: "臨時表 + (person, event, date) 索引"
    },
    { value: 'ROW_NUMBER()', labelZh: '选首轮', labelEn: 'Pick first round', hintZh: '按 round_type_id ∈ {1,0,d} 排,rn=1', hintEn: 'Sort by round_type_id ∈ {1,0,d}, take rn=1',
        labelZhHant: "選首輪"
    },
    { value: 'strict <', labelZh: 'WR 历史', labelEn: 'WR history', hintZh: '严格递减扫描', hintEn: 'Strictly decreasing scan',
        labelZhHant: "WR 歷史",
        hintZhHant: "嚴格遞減掃描"
    },
  ],
  sourceZh: [
    '先建临时表 `tmp_first_comp` = 每 (person_id, event_id) 的最早 `start_date`,加 `(person_id, event_id, earliest_date)` 复合索引。',
    '1st-solve:`ROW_NUMBER() OVER (PARTITION BY person, event ORDER BY CASE round_type ∈ {1,0,d} THEN 0 ELSE 1 END)` 选首轮;single 看 `result_attempts.value` 且 `attempt_number = 1`,average 看 `results.average`。',
    '1st-comp:在首场比赛的所有轮次里 `ROW_NUMBER() OVER (PARTITION BY person, event ORDER BY best/average)` 取最快;两组都按 `(event, value)` 升序输出。',
  ],
  sourceEn: [
    'First build a temp table `tmp_first_comp` = each (person_id, event_id)\'s earliest `start_date`, with composite index `(person_id, event_id, earliest_date)`.',
    '1st-solve: `ROW_NUMBER() OVER (PARTITION BY person, event ORDER BY CASE round_type ∈ {1,0,d} THEN 0 ELSE 1 END)` picks the first round; single reads `result_attempts.value WHERE attempt_number = 1`, average reads `results.average`.',
    '1st-comp: across all rounds of the first comp, `ROW_NUMBER() OVER (PARTITION BY person, event ORDER BY best/average)` picks the fastest; both queries output ordered by `(event, value)` ascending.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `CREATE TEMPORARY TABLE tmp_first_comp AS
SELECT r.person_id, r.event_id, MIN(c.start_date) AS earliest_date
FROM results r JOIN competitions c ON c.id = r.competition_id
GROUP BY r.person_id, r.event_id;

-- 1st-solve(single)
SELECT person_id, event_id, ra.value AS first_result, ...
FROM results r
JOIN result_attempts ra ON ra.result_id = r.id AND ra.attempt_number = 1
JOIN tmp_first_comp fc USING (person_id, event_id)
WHERE c1.start_date = fc.earliest_date AND ra.value > 0
QUALIFY ROW_NUMBER() OVER (PARTITION BY person_id, event_id
  ORDER BY CASE WHEN round_type_id IN ('1','0','d') THEN 0 ELSE 1 END) = 1;`,
  },
  steps: [
    {
      titleZh: '建 tmp_first_comp 索引',
      titleEn: 'Build tmp_first_comp index',
      bodyZh: '每选手每项目的最早 comp 日期 → 临时表;加 (person, event, date) 索引,后面两组 SQL 都靠它做 join 谓词。',
      bodyEn: 'For each (person, event), compute earliest comp date → temp table; add (person, event, date) index. Both downstream SQLs join on this.',
        bodyZhHant: "每選手每專案的最早 comp 日期 → 臨時表;加 (person, event, date) 索引,後面兩組 SQL 都靠它做 join 謂詞。"
    },
    {
      titleZh: '1st-solve:取首场首轮第 1 attempt',
      titleEn: '1st-solve: first attempt of first round of first comp',
      bodyZh: '首场比赛里的"首轮" = `round_type_id ∈ {1,0,d}` 的轮次(预赛 / 第 1 轮);single 看该轮 `attempt_number = 1` 的 value,average 看该轮 average。`ROW_NUMBER()` 决胜并列。',
      bodyEn: 'The "first round" within the first comp = a round with `round_type_id ∈ {1,0,d}` (qualification / round 1); for single take that round\'s `attempt_number = 1` value, for average take that round\'s average. `ROW_NUMBER()` breaks any ties.',
        titleZhHant: "1st-solve:取首場首輪第 1 attempt",
        bodyZhHant: "首場比賽裡的\"首輪\" = `round_type_id ∈ {1,0,d}` 的輪次(預賽 / 第 1 輪);single 看該輪 `attempt_number = 1` 的 value,average 看該輪 average。`ROW_NUMBER()` 決勝並列。"
    },
    {
      titleZh: '1st-comp:首场比赛所有轮中最快',
      titleEn: '1st-comp: fastest across all rounds of first comp',
      bodyZh: '首场比赛里可能打 1–4 轮,这里在全部轮次中 `MIN(best)` / `MIN(average)` 拿最快的那条 — 选手在第一场比赛"能拿出的最好水准"。',
      bodyEn: 'A first comp may include 1–4 rounds; this picks `MIN(best)` / `MIN(average)` across all of them — the "peak day-1 performance."',
        titleZhHant: "1st-comp:首場比賽所有輪中最快",
        bodyZhHant: "首場比賽裡可能打 1–4 輪,這裡在全部輪次中 `MIN(best)` / `MIN(average)` 拿最快的那條 — 選手在第一場比賽\"能拿出的最好水準\"。"
    },
    {
      titleZh: '排名:项目内 Top 10',
      titleEn: 'Ranking: top 10 per event',
      bodyZh: '每项目按 first_result 升序前 10。展示 single 时附 5 次 attempt 明细;average 类似但不展开。',
      bodyEn: 'Top 10 per event ascending by first_result. Single rows include the 5-attempt breakdown; average rows omit it.',
        titleZhHant: "排名:專案內 Top 10",
        bodyZhHant: "每專案按 first_result 升序前 10。展示 single 時附 5 次 attempt 明細;average 類似但不展開。"
    },
    {
      titleZh: 'WR 历史:严格递减扫描',
      titleEn: 'WR history: strictly decreasing scan',
      bodyZh: '按 (start_date, first_result) 升序排序所有(person, event, first_result);维护 `minSoFar`,只保留严格 `< minSoFar` 的条目。最后倒序输出,首条 = 当前最强首战。',
      bodyEn: 'Sort all (person, event, first_result) ascending by (start_date, first_result); maintain `minSoFar`; keep only strictly `< minSoFar`. Reverse for newest-first; top row = current strongest debut.',
      highlight: true,
        titleZhHant: "WR 歷史:嚴格遞減掃描",
        bodyZhHant: "按 (start_date, first_result) 升序排序所有(person, event, first_result);維護 `minSoFar`,只保留嚴格 `< minSoFar` 的條目。最後倒序輸出,首條 = 當前最強首戰。"
    },
  ],
  edgesZh: [
    '**两个数据源不会合并** — 1st-solve 和 1st-comp 是不同口径,某人可能在 1st-solve 榜很高但 1st-comp 名次普通(因为同场后续轮没刷得更快)。',
    '`round_type_id ∈ {1, 0, d}` 是 WCA 数据 dump 的"首轮"约定:1 = combined round 1,0 = round 1,d = qualification round。其他 `c f g e` 等都是后续轮。',
    'FMC 不走这页(其 round_type 划分跟普通项目不同),average 算的是 mean of 3。',
    'WR History 用 `< minSoFar`(严格小于) — 跟其他 stat 一致,不展示并列。Improvement 用 `(prev - cur) / prev × 100%`,保留 1 位小数。',
  ],
  edgesEn: [
    '**The two sources don\'t merge** — 1st-solve and 1st-comp are independent. A cuber can rank high on 1st-solve yet middling on 1st-comp (their later same-comp rounds didn\'t go faster).',
    '`round_type_id ∈ {1, 0, d}` is the WCA dump\'s "first round" convention: 1 = combined-final round 1, 0 = round 1, d = qualification. `c f g e` etc. are subsequent rounds.',
    'FMC works here too but its "average" means mean-of-3, not ao5 trimmed; round type filtering still applies.',
    'WR history uses `< minSoFar` (strict) — consistent with other stats, ties not shown. Improvement % uses `(prev - cur) / prev × 100%` to 1 decimal.',
  ],
  related: [
    { id: 'wr_current', titleZh: '当前 WR', titleEn: 'Current WR', hintZh: '横向对比"首战成绩 vs 当时 WR"', hintEn: 'Compare debut value vs the standing WR',
        titleZhHant: "當前 WR",
        hintZhHant: "橫向對比\"首戰成績 vs 當時 WR\""
    },
    { id: 'wr_non_pr', titleZh: '非 PR 的 WR', titleEn: 'Non-PR WR', hintZh: '另一类反直觉 WR 视角', hintEn: 'A different counter-intuitive WR slice',
        hintZhHant: "另一類反直覺 WR 視角"
    },
    { id: 'wr_metric', titleZh: '指标 (Metric)', titleEn: 'Metric', hintZh: '正轨 WR 演化', hintEn: 'The standard WR evolution track',
        titleZhHant: "指標 (Metric)",
        hintZhHant: "正軌 WR 演化"
    },
    { id: 'wr_newcomer', toStat: true, titleZh: '直接打开新人榜', titleEn: 'Jump to Newcomer table', hintZh: '看 4 个 panel 切换', hintEn: 'Browse the 4 panel combinations',
        titleZhHant: "直接開啟新人榜",
        hintZhHant: "看 4 個 panel 切換"
    },
  ],
    titleZhHant: "新人首戰 (Newcomer)",
    badgeZhHant: "世界紀錄"
};

// ──── average_of ────────────────────────────────────────────────────────────
// 跨比赛滚动平均 — Ao3/5/12/25/50/100/1000 的滑动窗口
const average_of: AboutEntry = {
  id: 'average_of',
  titleZh: '滚动平均 (Rolling Average)',
  titleEn: 'Rolling Average',
  badgeZh: '世界纪录',
  badgeEn: 'World record',
  introZh: [
    '把选手生涯里**所有官方 attempt** 按时间排成一长串,在上面滑一个长度 N 的窗口算裁剪均值,N ∈ {3, 5, 12, 25, 50, 100, 1000}。每个窗口产出一个数,选手生涯里最小的那个 = 他这套 AoN 的 PB。这跟 WCA 官方的"一轮 5 次裁剪均值"不一样 — 这里 N 是**跨比赛 / 跨轮次**滑动的。',
    '它考的是**长期稳定输出** — Ao1000 的 PB 持有者基本意味着这个人有 1000 次官方还原都保持高水准。前端按 N 切下拉,每个 N 都有自己的 Ranking + WR History。聚合层把 7 个 AverageOfX 子类拼成一个 stat。',
  ],
  introEn: [
    'Lay out a cuber\'s **entire official attempt history** in chronological order, slide a window of size N over it computing the WCA trimmed mean — N ∈ {3, 5, 12, 25, 50, 100, 1000}. Each window emits a number; the smallest across their career = their AoN PB. Unlike the WCA official "trimmed mean of 5 within one round," this N slides **across comps and rounds**.',
    'It probes long-horizon consistency — an Ao1000 PB means 1000 consecutive official attempts at top form. UI dropdown switches N; each N gets its own Ranking + WR History. The aggregator stitches 7 AverageOfX children into one stat.',
  ],
  stats: [
    { value: '7', labelZh: 'N 档', labelEn: 'N tiers', hintZh: '3 / 5 / 12 / 25 / 50 / 100 / 1000', hintEn: '3 / 5 / 12 / 25 / 50 / 100 / 1000',
        labelZhHant: "N 檔"
    },
    { value: 'top 15~2000', labelZh: '候选门槛', labelEn: 'Candidate top-N', hintZh: '按项目变化(333 top 15, 333bf top 2000)', hintEn: 'Varies by event (333: 15; 333bf: 2000)',
        labelZhHant: "候選門檻",
        hintZhHant: "按專案變化(333 top 15, 333bf top 2000)"
    },
    { value: '5%', labelZh: '裁剪比例', labelEn: 'Trim ratio', hintZh: '每端 ceil(N × 5%) 个,共 ~10%', hintEn: 'ceil(N × 5%) per side, ~10% total',
        hintZhHant: "每端 ceil(N × 5%) 個,共 ~10%"
    },
    { value: '1×', labelZh: 'SQL 查询', labelEn: 'SQL queries', hintZh: '7 个子类共享同一份 row 缓存', hintEn: '7 children share one cached row set',
        labelZhHant: "SQL 查詢",
        hintZhHant: "7 個子類共享同一份 row 快取"
    },
  ],
  sourceZh: [
    '基类 SQL 抓"候选选手"的全部 attempt:候选 = (每项目 average PB Top N 的选手) UNION (历史 single / average WR 持有者)。Top N 阈值按项目设:`333 top 15` / `333bf top 2000` / 多数 30 / FMC pyram clock 等 300。',
    '7 个子类(Ao3 ~ Ao1000)**共享同一份原始查询** — 第一个子类查完缓存,后面 6 个 直接复用,避免 6 × 60s 重复。FMC 项目的"成绩"是 moves,乘 100 统一成厘秒。',
  ],
  sourceEn: [
    'Base SQL pulls **all attempts** of candidate cuber — candidates = (per-event top-N by average PB) UNION (single / average WR holders ever). Top-N varies: `333: 15`, `333bf: 2000`, most events 30, FMC / pyram / clock / etc. 300.',
    'The 7 children (Ao3 ... Ao1000) **share one cached row set** — first child runs the SQL, others reuse, dodging 6× ~60s redundant queries. For FMC, move counts are ×100 to map onto the centisecond domain.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT person_id, country_id, event_id,
       GROUP_CONCAT(ra.value ORDER BY ra.attempt_number) AS attempts,
       competition_link, competition.start_date
FROM results result
JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
JOIN competitions competition ON competition.id = competition_id
JOIN round_types round_type ON round_type.id = round_type_id
JOIN ( /* candidate = top-N UNION WR holders */ ) candidates USING (event_id, person_id)
WHERE event_id NOT IN ('333mbf', '333mbo')
ORDER BY competition.start_date, round_type.rank;`,
  },
  steps: [
    {
      titleZh: '一次查 attempts → 共享缓存',
      titleEn: 'One attempts query → shared cache',
      bodyZh: '基类 `getSharedQueryRows()` lazy load 一份大查询;7 个子类(Ao3 ~ Ao1000)直接复用 — 不用查 7 次。每次子类跑完不立刻清,等聚合层最后 `clearSharedCache()`。',
      bodyEn: '`getSharedQueryRows()` lazy-loads one giant query; the 7 children reuse it — no 7× re-queries. Cache survives across children, gets `clearSharedCache()`\'d after the aggregator finishes.',
        titleZhHant: "一次查 attempts → 共享快取",
        bodyZhHant: "基類 `getSharedQueryRows()` lazy load 一份大查詢;7 個子類(Ao3 ~ Ao1000)直接複用 — 不用查 7 次。每次子類跑完不立刻清,等聚合層最後 `clearSharedCache()`。"
    },
    {
      titleZh: '按 (项目, 选手) 分组拉直 attempt',
      titleEn: 'Group by (event, person), flatten attempts',
      bodyZh: '在每个项目下,每选手所有 round 按 `(start_date, round_type.rank)` 升序;每轮 attempts 字符串 split 后逐个 push 到 `solves[]` — DNF 标记为 `Infinity`(裁剪后留在尾巴),`0` 跳过(未提交)。',
      bodyEn: 'Within each event, each cuber\'s rounds sort ascending by `(start_date, round_type.rank)`; each round\'s attempts split and stream into `solves[]` — DNF → `Infinity` (gets trimmed off if possible), `0` skipped (not-attempted).',
        titleZhHant: "按 (專案, 選手) 分組拉直 attempt",
        bodyZhHant: "在每個專案下,每選手所有 round 按 `(start_date, round_type.rank)` 升序;每輪 attempts 字串 split 後逐個 push 到 `solves[]` — DNF 標記為 `Infinity`(裁剪後留在尾巴),`0` 跳過(未提交)。"
    },
    {
      titleZh: '滑动窗口 + WCA 裁剪均值',
      titleEn: 'Sliding window + WCA trimmed mean',
      bodyZh: '`solves.length == N` 时算一次裁剪均值:排序,两端各去 `ceil(N × 5%)`,剩下取算术均值。如果裁后还含 `Infinity` → 整个均值 DNF。然后窗口 `shift()` 一格。',
      bodyEn: 'When `solves.length == N`, compute the trimmed mean: sort, drop `ceil(N × 5%)` from each side, average the rest. If a trimmed window still contains `Infinity` → DNF the whole average. Then `shift()` the window.',
        titleZhHant: "滑動視窗 + WCA 裁剪均值",
        bodyZhHant: "`solves.length == N` 時算一次裁剪均值:排序,兩端各去 `ceil(N × 5%)`,剩下取算術均值。如果裁後還含 `Infinity` → 整個均值 DNF。然後視窗 `shift()` 一格。"
    },
    {
      titleZh: '每人记 best + pbHistory',
      titleEn: 'Per person: best + pbHistory',
      bodyZh: '每选手维护当前最佳 AoN(`best`) + 历史 PB 列表 (`pbHistory`)。pbHistory 不存 solves 数组(Ao1000 × 多 PB 会爆),立刻 format 成 csv 字符串。',
      bodyEn: 'Each cuber holds a `best` AoN + a `pbHistory` list. To avoid memory blowup (Ao1000 × many PBs), pbHistory stores formatted csv strings instead of solve arrays.',
        titleZhHant: "每人記 best + pbHistory",
        bodyZhHant: "每選手維護當前最佳 AoN(`best`) + 歷史 PB 列表 (`pbHistory`)。pbHistory 不存 solves 陣列(Ao1000 × 多 PB 會爆),立刻 format 成 csv 字串。"
    },
    {
      titleZh: '排名 + WR 历史输出',
      titleEn: 'Emit ranking + WR history',
      bodyZh: '每项目 top 10 按 best AoN 升序;WR History 把所有人的 pbHistory 合并按 `(endDate, value)` 升序扫,只留严格刷新当前最小的 — 最后倒序展示。',
      bodyEn: 'Top 10 per event by best AoN ascending. WR History merges everyone\'s pbHistory, sorts by `(endDate, value)`, keeps strict improvements only, reverses for newest-first.',
      highlight: true,
        titleZhHant: "排名 + WR 歷史輸出",
        bodyZhHant: "每專案 top 10 按 best AoN 升序;WR History 把所有人的 pbHistory 合併按 `(endDate, value)` 升序掃,只留嚴格重新整理當前最小的 — 最後倒序展示。"
    },
  ],
  formulae: [
    {
      labelZh: 'WCA 裁剪均值 (window = N)',
      labelEn: 'WCA trimmed mean (window = N)',
      expr: 'AoN = (1 / (N - 2k)) · Σ sᵢ for i ∈ (k, N − k],  k = ⌈N × 0.05⌉',
      bodyZh: 's₁ ≤ s₂ ≤ ... ≤ s_N 为窗口内排序后成绩;裁剪掉两端各 k = `⌈N × 5%⌉` 个,剩下算术平均。N=5 → k=1(WCA 标准 ao5);N=1000 → k=50。',
      bodyEn: 's₁ ≤ s₂ ≤ ... ≤ s_N is the sorted window; drop k = `⌈N × 5%⌉` per side, arithmetic mean the rest. N=5 → k=1 (the WCA standard ao5); N=1000 → k=50.',
        bodyZhHant: "s₁ ≤ s₂ ≤ ... ≤ s_N 為視窗內排序後成績;裁剪掉兩端各 k = `⌈N × 5%⌉` 個,剩下算術平均。N=5 → k=1(WCA 標準 ao5);N=1000 → k=50。"
    },
  ],
  edgesZh: [
    '**跨比赛跨轮**,跟 WCA 官方 ao5(同一轮 5 次)完全不同。AoN 的窗口可能横跨好几年。',
    'MBLD / MBLD-old (`333mbf` / `333mbo`)不参与 — 它们的 attempt 结构不同。',
    '裁剪比例 5% 是写死的;N=3 时 k=1(去掉最快最慢);N=5 时 k=1(等价 WCA ao5);N=1000 时 k=50。',
    'WR History 候选只包含 top-N + WR 持有者(SQL 已过滤),所以"全民最大 Ao1000" 的真正持有者不一定在 — 但这页只关心强者侧,无伤大雅。',
  ],
  edgesEn: [
    '**Cross-comp, cross-round** — not the same as the WCA-official ao5 (within one round). An AoN window can span multiple years.',
    'MBLD / MBLD-old (`333mbf` / `333mbo`) excluded — their attempt structure differs.',
    'Trim ratio hard-coded to 5%; N=3 → k=1 (drops the single fastest + slowest); N=5 → k=1 (= WCA standard ao5); N=1000 → k=50.',
    'WR-history candidates = top-N + WR holders only — the absolute "biggest Ao1000 of all humans" may live outside this set; this page focuses on the strong end where it matters.',
  ],
  related: [
    { id: 'wr_aoxr', titleZh: 'AoXR', titleEn: 'AoXR', hintZh: '单场跨轮平均(N 不固定,跟比赛轮数挂钩)', hintEn: 'Within-comp cross-round average (N = comp\'s round count)',
        hintZhHant: "單場跨輪平均(N 不固定,跟比賽輪數掛鉤)"
    },
    { id: 'wr_metric', titleZh: '指标 (Metric)', titleEn: 'Metric', hintZh: '单轮内的衍生指标', hintEn: 'Within-round derived metrics',
        titleZhHant: "指標 (Metric)",
        hintZhHant: "單輪內的衍生指標"
    },
    { id: 'consecutive_sub_5_average', titleZh: '连续 sub-5 平均', titleEn: 'Consecutive sub-5 averages', hintZh: '另一种"持续稳定"度量 — 连续 N 次破阈值', hintEn: 'Another "sustained-form" lens — N consecutive sub-threshold averages',
        titleZhHant: "連續 sub-5 平均",
        hintZhHant: "另一種\"持續穩定\"度量 — 連續 N 次破閾值"
    },
    { id: 'average_of', toStat: true, titleZh: '直接打开滚动平均', titleEn: 'Jump to Rolling Average', hintZh: '7 个 N 档下拉切换', hintEn: 'Dropdown across 7 N values',
        titleZhHant: "直接開啟滾動平均",
        hintZhHant: "7 個 N 檔下拉切換"
    },
  ],
    titleZhHant: "滾動平均 (Rolling Average)",
    badgeZhHant: "世界紀錄"
};

// ──── consecutive_sub_5_average ────────────────────────────────────────────
// 3x3x3 最长连续 sub-5 average 段
const consecutive_sub_5_average: AboutEntry = {
  id: 'consecutive_sub_5_average',
  titleZh: '连续 sub-5 平均',
  titleEn: 'Consecutive sub-5 averages',
  badgeZh: '3x3x3',
  badgeEn: '3x3x3',
  introZh: [
    '在 3x3x3 项目上,某选手把所有官方轮次的 average 按时间排成一串后,**连续都 < 5.00 秒**的最长段有多长?这就是这条 stat。一段被中断 = 出现任意一次 ≥ 5.00 的 average(或 DNF)。',
    '它跟 Ao1000 测的"长期稳定"不同 — 这里要求**每一轮都过线**,一次失手就归零;比起均值,更像高强度抗压性指标。前端双视图:Ranking(每人最长 streak Top 100) + History(WR 演变倒序)。',
  ],
  introEn: [
    'For 3x3x3 only: take a cuber\'s sequence of official-round averages in chronological order — what\'s the longest consecutive run where every single one is **< 5.00 seconds**? That\'s the metric. A streak breaks on any ≥ 5.00 average (or DNF).',
    'Unlike Ao1000\'s "long-horizon mean", this is **every-round-must-clear** — one slip resets to zero. More of a sustained-pressure metric than a smoothing one. Two views: Ranking (each person\'s longest, top 100) + History (newest-first WR evolution).',
  ],
  stats: [
    { value: '500', labelZh: '阈值(厘秒)', labelEn: 'Threshold (cs)', hintZh: '5.00 秒 = 500 厘秒', hintEn: '5.00s = 500 centiseconds',
        labelZhHant: "閾值(釐秒)",
        hintZhHant: "5.00 秒 = 500 釐秒"
    },
    { value: '333 only', labelZh: '范围', labelEn: 'Scope', hintZh: '只看 event_id = 333', hintEn: 'event_id = 333 only',
        labelZhHant: "範圍"
    },
    { value: 'count > 1', labelZh: 'streak 下限', labelEn: 'Min streak', hintZh: '至少连续 2 次才算', hintEn: 'Need ≥ 2 to count',
        hintZhHant: "至少連續 2 次才算"
    },
    { value: 'top 100', labelZh: 'Ranking 展示', labelEn: 'Ranking shown', hintZh: '每人最长 streak,Top 100', hintEn: 'Per person\'s longest, top 100',
        hintZhHant: "每人最長 streak,Top 100"
    },
  ],
  sourceZh: [
    '查 `results` 全部 333 行,join `persons` + `competitions` + `round_types`;按 `(person_id, start_date, round_type.rank)` 升序排,保证同人成绩按真实时间 + 同日同比赛按轮次顺序。',
    '内存里按 person_id 分组,对每个选手逐行扫一遍,维护一个"当前 streak"对象。average 严格 < 500 且 > 0 → 计数 +1 同时记录起 / 止比赛;否则若 count > 1 收尾入库,重新置零。',
  ],
  sourceEn: [
    'Pull every 333 row, join `persons` + `competitions` + `round_types`; sort `(person_id, start_date, round_type.rank)` ascending to enforce per-person chronology and per-day round order.',
    'Group in memory by person_id, scan per person maintaining a "current streak" object. average strictly < 500 and > 0 → bump count, update end-comp; otherwise commit if count > 1 and reset.',
  ],
  sourceCode: {
    lang: 'sql',
    body: `SELECT result.person_id, person_link, result.average,
       competition.cell_name AS competition_name,
       competition.id AS competition_id,
       competition.start_date
FROM results result
JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
JOIN competitions competition ON competition.id = result.competition_id
JOIN round_types round_type ON round_type.id = result.round_type_id
WHERE result.event_id = '333'
ORDER BY result.person_id, competition.start_date, round_type.rank;`,
  },
  steps: [
    {
      titleZh: '查 333 全部 average,按 (人, 时间) 排序',
      titleEn: 'Pull all 333 averages, sort by (person, time)',
      bodyZh: '`ORDER BY person_id, start_date, round_type.rank` 让单选手内成绩呈严格时间序;后续扫描不再需要再排。',
      bodyEn: '`ORDER BY person_id, start_date, round_type.rank` enforces strict per-person chronology; downstream scan needs no re-sorting.',
        titleZhHant: "查 333 全部 average,按 (人, 時間) 排序",
        bodyZhHant: "`ORDER BY person_id, start_date, round_type.rank` 讓單選手內成績呈嚴格時間序;後續掃描不再需要再排。"
    },
    {
      titleZh: '按 person_id 拆组逐选手扫',
      titleEn: 'Split by person_id, scan each',
      bodyZh: '内存里 `byPerson: Map<pid, rows>` 拆好后释放原始 rows(配合 `global.gc()`);逐选手单独跑 streak 检测。',
      bodyEn: '`byPerson: Map<pid, rows>` partitions in memory; release raw rows (paired with `global.gc()`) and process each cuber independently.',
        titleZhHant: "按 person_id 拆組逐選手掃",
        bodyZhHant: "記憶體裡 `byPerson: Map<pid, rows>` 拆好後釋放原始 rows(配合 `global.gc()`);逐選手單獨跑 streak 檢測。"
    },
    {
      titleZh: 'avg < 500 → 累加;否则收尾',
      titleEn: 'avg < 500 → extend; else commit',
      bodyZh: '当前 streak:`avg > 0 && avg < 500` 时 count += 1,更新 endComp/endDate(并在 count == 1 时记录 startComp);否则若 count > 1 把这段写出,重新 newStreak()。最后一段也别忘了 commit。',
      bodyEn: 'For each row: `avg > 0 && avg < 500` → count += 1, update endComp/endDate (and set startComp on count == 1); else if count > 1, commit the streak and reset. After the loop, commit the trailing run too.',
        titleZhHant: "avg < 500 → 累加;否則收尾",
        bodyZhHant: "當前 streak:`avg > 0 && avg < 500` 時 count += 1,更新 endComp/endDate(並在 count == 1 時記錄 startComp);否則若 count > 1 把這段寫出,重新 newStreak()。最後一段也別忘了 commit。"
    },
    {
      titleZh: 'Ranking:每人取最长一条,Top 100',
      titleEn: 'Ranking: each person\'s longest, top 100',
      bodyZh: '`bestByPerson` 把同选手多段 streak 折叠到最长那条;按 count 降序前 100 输出。一行 = [count, person_link, startComp_link, endComp_link]。',
      bodyEn: '`bestByPerson` collapses one cuber\'s many streaks to their longest; sort descending by count, take top 100. Row = [count, person_link, startComp_link, endComp_link].',
        titleZhHant: "Ranking:每人取最長一條,Top 100",
        bodyZhHant: "`bestByPerson` 把同選手多段 streak 摺疊到最長那條;按 count 降序前 100 輸出。一行 = [count, person_link, startComp_link, endComp_link]。"
    },
    {
      titleZh: 'History:WR 演变倒序',
      titleEn: 'History: WR evolution reversed',
      bodyZh: '把所有 streak 按 `(endDate, count)` 升序排;扫描时记录 `maxCount`,只留 `count >= maxCount && count > 1` 的条(注意是 `>=` — 这里允许并列也记一次);最后 reverse 输出最新在上。',
      bodyEn: 'Sort all streaks ascending by `(endDate, count)`; scan tracking `maxCount`, keep entries with `count >= maxCount && count > 1` (note `>=` — ties allowed here); reverse for newest-first.',
      highlight: true,
        titleZhHant: "History:WR 演變倒序",
        bodyZhHant: "把所有 streak 按 `(endDate, count)` 升序排;掃描時記錄 `maxCount`,只留 `count >= maxCount && count > 1` 的條(注意是 `>=` — 這裡允許並列也記一次);最後 reverse 輸出最新在上。"
    },
  ],
  formulae: [
    {
      labelZh: 'streak 定义',
      labelEn: 'Streak definition',
      expr: 'streak(P) = max { k : ∃ i, aᵢ, aᵢ₊₁, ..., aᵢ₊ₖ₋₁ all < 5.00 }',
      bodyZh: '(aⱼ) = P 的 333 average 按时间序列;最长的"全部 < 5.00"连续子序列长度 = streak。',
      bodyEn: '(aⱼ) = P\'s 333 averages in chronological order; the longest run of consecutive entries all < 5.00 = streak length.',
        labelZhHant: "streak 定義",
        bodyZhHant: "(aⱼ) = P 的 333 average 按時間序列;最長的\"全部 < 5.00\"連續子序列長度 = streak。"
    },
  ],
  edgesZh: [
    "**项目固定 3x3x3**(`event_id = '333'`),其他项目即便有 sub-5 average 也不参与。",
    '阈值是**严格小于 500**(即 < 5.00 秒) — 5.00 整数算"未过线"中断 streak。DNF 也算中断。',
    'WR History 用 `>=`(允许并列也记)— 跟其他大多数 WR history 的 strict `<` 不同,这是这条 stat 的特殊行为。',
    'count == 1 不入库 — 也就是说一次 sub-5 average 单独出现不算一段 streak,至少要连续 2 次。',
  ],
  edgesEn: [
    "**3x3x3 only** (`event_id = '333'`); other events with sub-5 averages don't apply.",
    'Threshold is **strictly < 500** (i.e. < 5.00s) — a 5.00 flat counts as a break. DNFs break too.',
    'WR history uses `>=` (ties allowed) — different from most other WR histories which use strict `<`. This is a quirk of this stat.',
    'count == 1 isn\'t stored — a single isolated sub-5 average doesn\'t count as a streak; need ≥ 2 consecutive.',
  ],
  related: [
    { id: 'average_of', titleZh: '滚动平均 (Rolling Average)', titleEn: 'Rolling Average', hintZh: '另一类持续表现指标,但允许个别失手', hintEn: 'A different sustained-form lens — tolerates occasional slips',
        titleZhHant: "滾動平均 (Rolling Average)",
        hintZhHant: "另一類持續表現指標,但允許個別失手"
    },
    { id: 'longest_streak_of_personal_records', titleZh: '最长 PR streak', titleEn: 'Longest PR streak', hintZh: '"连续刷 PB" 的姊妹 streak 指标', hintEn: 'Sibling streak metric — consecutive PB refreshes',
        titleZhHant: "最長 PR streak",
        hintZhHant: "\"連續刷 PB\" 的姊妹 streak 指標"
    },
    { id: 'wr_metric', titleZh: '指标 (Metric)', titleEn: 'Metric', hintZh: '单轮指标视角', hintEn: 'Within-round metric lens',
        titleZhHant: "指標 (Metric)",
        hintZhHant: "單輪指標視角"
    },
    { id: 'consecutive_sub_5_average', toStat: true, titleZh: '直接打开 streak 排名', titleEn: 'Jump to streak leaderboard', hintZh: '看谁连续多少场过线', hintEn: 'See who has held the line for how long',
        titleZhHant: "直接開啟 streak 排名",
        hintZhHant: "看誰連續多少場過線"
    },
  ],
    titleZhHant: "連續 sub-5 平均"
};

// ──── 导出聚合 ──────────────────────────────────────────────────────────────
export const WR_ANALYSIS_ABOUT: Record<string, AboutEntry> = {
  wr_aoxr,
  wr_current,
  wr_metric,
  wr_dominance,
  wr_non_pr,
  wr_newcomer,
  average_of,
  consecutive_sub_5_average,
};
