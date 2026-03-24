# Stats Ruby → TypeScript + React 完整迁移计划

> **本文档是面向下一个 AI 的移交文档，包含完整上下文、已完成进度和后续任务。**

## 一、背景与现状

### 1.1 项目概述

本项目（[ruiminyan.github.io](https://ruiminyan.github.io)）是一个 Jekyll 静态站 + React SPA 的混合架构。WCA 统计模块由 93 个 Ruby 脚本生成 Markdown 文件，再由 Jekyll 渲染为 HTML。

**最终目标**：用 TypeScript 完全替代 Ruby — TS 直连 MySQL 生成 JSON，React 渲染页面，Ruby 退役。

### 1.2 当前架构 → 目标架构

```
┌── 现有 Ruby 管线（每周 CI，继续运行）──────────────────────┐
│  _stats_build/statistics/*.rb (93 个)                       │
│      ↓ SQL → Markdown                                      │
│  stats/*.md → Jekyll → _site/stats/*.html                   │
│      ↓ GitHub Pages                                        │
│  ruiminyan.github.io/stats/*                                │
└─────────────────────────────────────────────────────────────┘

┌── 新 TS 管线（逐步替代上方）───────────────────────────────┐
│  stats-build/src/statistics/*.ts (逐个替代 Ruby)            │
│      ↓ SQL → JSON                                          │
│  stats/data/*.json                                          │
│      ↓ React SPA 渲染                                      │
│  /app/wca-stats/:statId                                     │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 数据库信息

凭据在 `_stats_build/database.yml`（不在 git 中），核心表见 `_stats_build/SCHEMA.md`。

---

## 二、已完成进度

### 2.1 基础架构（✅ 已完成）

| 组件 | 文件 | 说明 |
|------|------|------|
| MySQL 连接 | `src/core/database.ts` | mysql2 连接池，配置从 `_stats_build/database.yml` 读取 |
| 基类 | `src/core/statistic.ts` | 抽象 `Statistic` 类：`query()` → SQL → `toJson()` 管线 |
| 项目映射 | `src/core/events.ts` | WCA 项目 ID → 中英文名映射 + `HEADER_ZH` 表头翻译字典 |
| CLI | `src/bin/compute.ts` | `npx tsx src/bin/compute.ts <stat_id>` → 输出 JSON |
| React 页面 | `client/src/pages/wca_stats/WcaStatsPage.tsx` | 通用统计表格组件 |
| 路由 | `client/src/App.tsx` 中 `/app/wca-stats/:statId` | 懒加载 |

### 2.2 已改写的统计（✅ 18 个纯 SQL 类）

以下全部继承 `Statistic` 基类，只需实现 `query()` 返回 SQL 字符串：

| # | stat_id | Ruby 继承 | 说明 |
|---|---------|-----------|------|
| 1 | `world_championship_podiums_by_person` | Statistic | 世锦赛领奖台（按选手） |
| 2 | `world_championship_podiums_by_country` | Statistic | 世锦赛领奖台（按国家） |
| 3 | `world_records_by_person` | Statistic | 世界纪录数（按选手） |
| 4 | `world_records_by_country` | Statistic | 世界纪录数（按国家） |
| 5 | `current_world_records_by_country` | Statistic | 当前世界纪录（按国家） |
| 6 | `most_4th_places` | Statistic | 最多第四名 |
| 7 | `fewest_competitors_contest` | Statistic | 参赛人数最少的比赛 |
| 8 | `best_medal_collection_from_abroad_by_country` | Statistic | 海外奖牌（按国家） |
| 9 | `best_medal_collection_from_abroad_by_person` | Statistic | 海外奖牌（按选手） |
| 10 | `complete_competition_winners` | Statistic | 完全比赛冠军 |
| 11 | `most_attended_competitions_in_single_month` | Statistic | 单月参赛最多 |
| 12 | `most_competitions_abroad` | Statistic | 海外参赛最多 |
| 13 | `most_delegated_competitions` | Statistic | 代表比赛最多 |
| 14 | `most_finals` | Statistic | 进入决赛最多 |
| 15 | `most_podiums_at_single_competition` | Statistic | 单场比赛登台最多 |
| 16 | `most_visited_continents` | Statistic | 去过最多大洲 |
| 17 | `most_visited_countries` | Statistic | 去过最多国家 |
| 18 | `potentially_seen_world_records` | Statistic | 可能目击过的世界纪录 |

所有 SQL 与 Ruby 原版 **完全一致**（1:1 复制），包括 `CONCAT('**', ...)` 等 Markdown 格式化。

---

## 三、剩余工作（70 个统计文件）

### 3.1 Ruby 基类分类

93 个 Ruby 文件继承 6 种基类。`index.rb` 是注册表无需改写。分类如下：

| Ruby 基类 | 总数 | 已完成 | 剩余 | 需要创建 TS 基类 |
|-----------|------|--------|------|-----------------|
| **Statistic（无 transform）** | 22 | ✅ 18 | **4** | ❌ 已有 |
| **Statistic（有 transform）** | 22 | 0 | **22** | ❌ 已有，需在子类实现 `transform()` |
| **GroupedStatistic** | 17 | 0 | **17** | ✅ 需创建 `grouped_statistic.ts` |
| **RoundMetric** | 12 | 0 | **12** | ✅ 需创建 `round_metric.ts` |
| **AverageOfX** | 7 | 0 | **7** | ✅ 需创建 `average_of_x.ts` |
| **AoRounds** | 4 | 0 | **4** | ✅ 需创建 `ao_rounds.ts` |
| **Rankings** | 1 | 0 | **1** | ✅ 需创建 `rankings.ts` |

另有 4 个**聚合页面**（`wr_metric`/`wr_aoxr`/`average_of`/`wr_dominance`），它们继承 `Statistic` 但使用 `StatPanel` + `MetricLayout` mixin，不走标准 `query()` 管线，有自定义 `markdown()` 方法。这些最复杂，建议最后处理。

### 3.2 剩余 4 个纯 SQL（Statistic 无 transform）

这些最简单，直接复制 SQL 即可（与已完成的 18 个完全相同模式）：

```
wr_non_pr                ← 注意：继承 Statistic 但有 StatPanel mixin
wr_metric                ← 聚合页面，含 StatPanel + MetricLayout
wr_aoxr                  ← 聚合页面
average_of               ← 聚合页面
```

> ⚠️ 虽然这 4 个标记为 `Statistic|N`（无 transform），但它们是聚合页面，有完全自定义的 `markdown()` 方法和多面板布局，复杂度远高于普通统计。

### 3.3 Statistic + 自定义 transform（22 个）

这些继承 `Statistic`，有 `query()` 返回 SQL，但还有 `def transform(rows)` 在 Ruby 侧对数据做后处理（排序、聚合、格式化等）。改写时需要阅读每个文件的 `transform` 逻辑并用 TS 实现。

```
average_event_count_by_competition    best_potential_fmc_mean
competitions_count_by_week            competitions_per_year_by_country
competitions_per_year_by_person       consecutive_sub_5_average
delegated_competition_per_year        dnf_rate_by_event
first_r_is_wr                         longest_competitions_path
longest_streak_of_competitions_in_own_country
longest_streak_of_personal_records    longest_streak_of_podiums
longest_streak_of_world_records       longest_time_to_sub_10
mbf_average                           most_attended_competitions_in_single_week
most_distinct_dates_competed_on       name_parts_count
shortest_time_to_get_all_singles      shortest_time_to_get_all_singles_and_averages
wr_current
```

**改写模式**：在 TS 子类中覆写 `transform(rows: Record<string, unknown>[])` 方法。基类 `Statistic.toJson()` 会在 SQL 查询后调用 `this.transform(rows)`。

> 当前 `statistic.ts` 基类可能需要添加 `transform()` 钩子。检查 `statistic.ts` 看是否已有。

### 3.4 GroupedStatistic（17 个）

Ruby 中 `GroupedStatistic` 继承 `Statistic`，特点是**按 WCA 项目分组**（如 333、222、444……），每个项目执行一次 SQL，输出按项目分组的 JSON。

需要先阅读 `_stats_build/core/grouped_statistic.rb` 理解其 `def grouped_data` 和 `def transform` 模式，然后创建 TS 基类：

```
best_result_off_podium              best_round
competition_days_count_by_region    longest_standing_records
most_competitions_before_winning    most_completed_solves
most_frequent_results               most_podiums_together
most_records_at_single_competition  most_solves_before_bld_success
moving_average                      records_in_most_events
shortest_time_to_reach_milestone_in_comps_count
smallest_diff_between_single_and_average
winned_week_count                   world_championship_records
worst_result_on_podium              wr_newcomer (此文件无 transform)
```

**JSON 输出需要 sections**：每个 event 是一个 section，对应扩展 schema 中的 `StatSection[]`。

### 3.5 RoundMetric（12 个）

继承自 `_stats_build/statistics/abstract/wr_round_history.rb`。特点：
- 所有基于 WR 轮次 attempts 计算衍生指标（BAo5、WAo5、Mo5、BPA、WPA、Median 等）
- 子类只需实现 `compute_metric(values, r)` 返回计算值
- 共享基类缓存全量 results，避免重复查询

```
wr_bao5    wr_wao5    wr_mo5     wr_bpa
wr_wpa     wr_median  wr_best_counting  wr_worst_counting
wr_worst   wr_variance  wr_best_average_ratio
wr_single_history  wr_average_history
```

> ⚠️ 这 12 个是 `wr_metric` 聚合页面的子统计。可以先独立实现每个 TS 类，最后再做聚合。

### 3.6 AverageOfX（7 个）

继承自 `_stats_build/statistics/abstract/average_of_x.rb`。计算连续 X 次官方成绩的滚动平均。

```
average_of_3    average_of_5    average_of_12
average_of_25   average_of_50   average_of_100   average_of_1000
```

> 这 7 个是 `average_of` 聚合页面的子统计。

### 3.7 AoRounds（4 个）

继承自 `_stats_build/statistics/abstract/ao_rounds.rb`。跨轮次的 AoXR 计算。

```
wr_ao1r    wr_ao2r    wr_ao3r    wr_ao4r
```

> 这 4 个是 `wr_aoxr` 聚合页面的子统计。

### 3.8 Rankings（1 个）

```
yearly_rankings
```

独立基类，需要阅读 `_stats_build/statistics/abstract/rankings.rb` 理解模式。

---

## 四、推荐改写顺序

### 阶段 A：继续纯 SQL（最简单，立即可做）

完成 §3.3 中 transform 逻辑较简单的几个：

```
dnf_rate_by_event          ← transform 只是格式化百分比
name_parts_count           ← transform 只是字符串拆分计数
competitions_count_by_week ← transform 简单聚合
```

> **操作步骤**：阅读 `.rb` 的 `transform` 方法 → 在 TS 子类中覆写 `transform()` → 注册到 REGISTRY → `npx tsc --noEmit`

### 阶段 B：创建 GroupedStatistic 基类

1. 阅读 `_stats_build/core/grouped_statistic.rb` 理解模式
2. 创建 `src/core/grouped_statistic.ts`
3. 从最简单的子类开始改写（如 `most_completed_solves`、`worst_result_on_podium`）

### 阶段 C：创建 RoundMetric + AverageOfX + AoRounds 基类

1. 阅读对应的 Ruby 抽象基类
2. 创建 TS 基类
3. 逐个改写子类

### 阶段 D：聚合页面

`wr_metric`、`wr_aoxr`、`average_of`、`wr_dominance` — 需要前端支持 `panels` + tab 切换。

### 阶段 E：前端升级

1. `WcaStatsPage.tsx` 支持 `sections`（多分节）
2. `WcaStatsPage.tsx` 支持 `panels`（多面板 + tab）
3. `WcaStatsIndex.tsx` 索引页

---

## 五、JSON Schema

### 5.1 单表格（已实现）

```typescript
interface StatData {
  id: string;
  title: string;
  titleZh: string;
  note?: string;
  noteZh?: string;
  header: StatHeader[];
  rows: unknown[][];
}

interface StatHeader {
  key: string;
  label: string;
  labelZh: string;
  align: 'left' | 'right' | 'center';
}
```

### 5.2 扩展（后续需要）

```typescript
// 多分节（GroupedStatistic 按 event 分组）
sections?: StatSection[];

// 多面板（wr_metric 的 Single/Average + Ranking/History）
panels?: StatPanel[];

interface StatSection {
  title: string;
  titleZh: string;
  header: StatHeader[];
  rows: unknown[][];
}

interface StatPanel {
  id: string;
  label: string;
  labelZh: string;
  sections: StatSection[];
}
```

---

## 六、关键文件快速索引

| 用途 | 路径 |
|------|------|
| **TS 基类** | `trainer/packages/stats-build/src/core/statistic.ts` |
| **数据库连接** | `trainer/packages/stats-build/src/core/database.ts` |
| **项目映射+表头翻译** | `trainer/packages/stats-build/src/core/events.ts` |
| **CLI 入口** | `trainer/packages/stats-build/src/bin/compute.ts` |
| **已完成的 TS 统计** | `trainer/packages/stats-build/src/statistics/*.ts` |
| **Ruby 统计源码（只读参考）** | `_stats_build/statistics/*.rb` |
| **Ruby 基类** | `_stats_build/core/statistic.rb`、`grouped_statistic.rb` |
| **Ruby 抽象类** | `_stats_build/statistics/abstract/*.rb` |
| **JSON 输出** | `stats/data/*.json` |
| **React 前端** | `trainer/packages/client/src/pages/wca_stats/` |
| **数据库 Schema** | `_stats_build/SCHEMA.md` |
| **数据库凭据** | `_stats_build/database.yml`（不在 git 中） |

---

## 七、关键约束

1. **Ruby 代码零修改**：所有 `.rb` 文件只读参考
2. **SQL 逻辑零改动**：TS 版的 SQL 必须与 Ruby 完全一致
3. **计算逻辑零改动**：`transform` 的数据处理逻辑必须与 Ruby 完全一致
4. **i18n 双语**：标题、描述、列名都需要中英文
5. **新表头翻译**：每增加新表头列名，在 `events.ts` 的 `HEADER_ZH` 添加
6. **新统计注册**：每个新 TS 文件都要在 `compute.ts` 的 `REGISTRY` 中注册
7. **编译检查**：每批完成后 `npx tsc --noEmit`
8. **增量提交**：每完成一批就 `git commit`

---

## 八、快速上手命令

```powershell
# 进入工作目录
cd d:\cube\ruiminyan.github.io\trainer\packages\stats-build

# TypeScript 编译检查
npx tsc --noEmit

# 生成单个统计 JSON
npx tsx src/bin/compute.ts world_championship_podiums_by_person

# 查看所有已注册的统计
npx tsx src/bin/compute.ts

# 启动前端（在 trainer 根目录）
cd d:\cube\ruiminyan.github.io\trainer
pnpm --filter @cuberoot/client dev

# 浏览器访问
# http://localhost:5173/app/wca-stats/world_championship_podiums_by_person
```

---

## 九、完整 Ruby 文件清单与状态

<details>
<summary>点击展开（93 个文件，含继承关系和完成状态）</summary>

| 文件 | Ruby 基类 | 有 transform | 状态 |
|------|-----------|-------------|------|
| `average_event_count_by_competition` | Statistic | ✅ | ⬜ |
| `average_of_100` | AverageOfX | ❌ | ⬜ |
| `average_of_1000` | AverageOfX | ❌ | ⬜ |
| `average_of_12` | AverageOfX | ❌ | ⬜ |
| `average_of_25` | AverageOfX | ❌ | ⬜ |
| `average_of_3` | AverageOfX | ❌ | ⬜ |
| `average_of_5` | AverageOfX | ❌ | ⬜ |
| `average_of_50` | AverageOfX | ❌ | ⬜ |
| `average_of` | Statistic+StatPanel | ❌ | ⬜ 聚合页面 |
| `best_medal_collection_from_abroad_by_country` | Statistic | ❌ | ✅ |
| `best_medal_collection_from_abroad_by_person` | Statistic | ❌ | ✅ |
| `best_potential_fmc_mean` | Statistic | ✅ | ⬜ |
| `best_result_off_podium` | GroupedStatistic | ✅ | ⬜ |
| `best_round` | GroupedStatistic | ✅ | ⬜ |
| `competition_days_count_by_region` | GroupedStatistic | ✅ | ⬜ |
| `competitions_count_by_week` | Statistic | ✅ | ⬜ |
| `competitions_per_year_by_country` | Statistic | ✅ | ⬜ |
| `competitions_per_year_by_person` | Statistic | ✅ | ⬜ |
| `complete_competition_winners` | Statistic | ❌ | ✅ |
| `consecutive_sub_5_average` | Statistic | ✅ | ⬜ |
| `current_world_records_by_country` | Statistic | ❌ | ✅ |
| `delegated_competition_per_year` | Statistic | ✅ | ⬜ |
| `dnf_rate_by_event` | Statistic | ✅ | ⬜ |
| `fewest_competitors_contest` | Statistic | ❌ | ✅ |
| `first_r_is_wr` | Statistic | ✅ | ⬜ |
| `longest_competitions_path` | Statistic | ✅ | ⬜ |
| `longest_standing_records` | GroupedStatistic | ✅ | ⬜ |
| `longest_streak_of_competitions_in_own_country` | Statistic | ✅ | ⬜ |
| `longest_streak_of_personal_records` | Statistic | ✅ | ⬜ |
| `longest_streak_of_podiums` | Statistic | ✅ | ⬜ |
| `longest_streak_of_world_records` | Statistic | ✅ | ⬜ |
| `longest_time_to_sub_10` | Statistic | ✅ | ⬜ |
| `mbf_average` | Statistic | ✅ | ⬜ |
| `most_4th_places` | Statistic | ❌ | ✅ |
| `most_attended_competitions_in_single_month` | Statistic | ❌ | ✅ |
| `most_attended_competitions_in_single_week` | Statistic | ✅ | ⬜ |
| `most_competitions_abroad` | Statistic | ❌ | ✅ |
| `most_competitions_before_winning` | GroupedStatistic | ✅ | ⬜ |
| `most_completed_solves` | GroupedStatistic | ✅ | ⬜ |
| `most_delegated_competitions` | Statistic | ❌ | ✅ |
| `most_distinct_dates_competed_on` | Statistic | ✅ | ⬜ |
| `most_finals` | Statistic | ❌ | ✅ |
| `most_frequent_results` | GroupedStatistic | ✅ | ⬜ |
| `most_podiums_at_single_competition` | Statistic | ❌ | ✅ |
| `most_podiums_together` | GroupedStatistic | ✅ | ⬜ |
| `most_records_at_single_competition` | GroupedStatistic | ✅ | ⬜ |
| `most_solves_before_bld_success` | GroupedStatistic | ✅ | ⬜ |
| `most_visited_continents` | Statistic | ❌ | ✅ |
| `most_visited_countries` | Statistic | ❌ | ✅ |
| `moving_average` | GroupedStatistic | ✅ | ⬜ |
| `name_parts_count` | Statistic | ✅ | ⬜ |
| `potentially_seen_world_records` | Statistic | ❌ | ✅ |
| `records_in_most_events` | GroupedStatistic | ✅ | ⬜ |
| `shortest_time_to_get_all_singles` | Statistic | ✅ | ⬜ |
| `shortest_time_to_get_all_singles_and_averages` | Statistic | ✅ | ⬜ |
| `shortest_time_to_reach_milestone_in_comps_count` | GroupedStatistic | ✅ | ⬜ |
| `smallest_diff_between_single_and_average` | GroupedStatistic | ✅ | ⬜ |
| `winned_week_count` | GroupedStatistic | ✅ | ⬜ |
| `world_championship_podiums_by_country` | Statistic | ❌ | ✅ |
| `world_championship_podiums_by_person` | Statistic | ❌ | ✅ |
| `world_championship_records` | GroupedStatistic | ✅ | ⬜ |
| `world_records_by_country` | Statistic | ❌ | ✅ |
| `world_records_by_person` | Statistic | ❌ | ✅ |
| `worst_result_on_podium` | GroupedStatistic | ✅ | ⬜ |
| `wr_ao1r` | AoRounds | ❌ | ⬜ |
| `wr_ao2r` | AoRounds | ❌ | ⬜ |
| `wr_ao3r` | AoRounds | ❌ | ⬜ |
| `wr_ao4r` | AoRounds | ❌ | ⬜ |
| `wr_aoxr` | Statistic+StatPanel | ❌ | ⬜ 聚合页面 |
| `wr_average_history` | RoundMetric | ✅ | ⬜ |
| `wr_bao5` | RoundMetric | ❌ | ⬜ |
| `wr_best_average_ratio` | RoundMetric | ❌ | ⬜ |
| `wr_best_counting` | RoundMetric | ❌ | ⬜ |
| `wr_bpa` | RoundMetric | ❌ | ⬜ |
| `wr_current` | Statistic | ✅ | ⬜ |
| `wr_dominance` | Statistic+StatPanel | ❌ | ⬜ 聚合页面 |
| `wr_median` | RoundMetric | ❌ | ⬜ |
| `wr_metric` | Statistic+StatPanel | ❌ | ⬜ 聚合页面 |
| `wr_mo5` | RoundMetric | ❌ | ⬜ |
| `wr_newcomer` | GroupedStatistic | ❌ | ⬜ |
| `wr_non_pr` | Statistic+StatPanel | ❌ | ⬜ |
| `wr_single_history` | RoundMetric | ❌ | ⬜ |
| `wr_variance` | RoundMetric | ❌ | ⬜ |
| `wr_wao5` | RoundMetric | ❌ | ⬜ |
| `wr_worst_counting` | RoundMetric | ❌ | ⬜ |
| `wr_worst` | RoundMetric | ❌ | ⬜ |
| `wr_wpa` | RoundMetric | ❌ | ⬜ |
| `yearly_rankings` | Rankings | ❌ | ⬜ |

</details>
