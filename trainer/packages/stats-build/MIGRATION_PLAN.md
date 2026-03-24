# Stats Ruby → TypeScript + React 完整迁移计划

> **本文档是面向下一个 AI 的移交文档，包含完整上下文、已完成进度和后续任务。**
> **更新时间**：2025-03-25

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

┌── 新 TS 管线（已实现 60/93）──────────────────────────────┐
│  stats-build/src/statistics/*.ts (60 个已完成)              │
│      ↓ SQL → JSON                                          │
│  stats/data/*.json                                          │
│      ↓ React SPA 渲染                                      │
│  /app/wca-stats/:statId                                     │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 数据库信息

凭据在 `_stats_build/database.yml`（不在 git 中），核心表见 `_stats_build/SCHEMA.md`。

---

## 二、已完成进度（60/93）

### 2.1 基础架构（✅ 全部完成）

| 组件 | 文件 | 说明 |
|------|------|------|
| MySQL 连接 | `src/core/database.ts` | mysql2 连接池，配置从 `_stats_build/database.yml` 读取，含 `ATTEMPTS_SUBQUERY` 常量 |
| Statistic 基类 | `src/core/statistic.ts` | 抽象类：`query()` → SQL → `transform()` → `toJson()`。含 `StatJson`/`StatPanel`/`StatSection` 等类型 |
| GroupedStatistic 基类 | `src/core/grouped_statistic.ts` | 按 WCA 项目分组的统计基类，输出 `sections` |
| RoundMetric 基类 | `src/core/round_metric.ts` | 从 attempt 计算衍生指标，双视图 `panels`（ranking + history），支持 batch/non-batch 排名 |
| AoRounds 基类 | `src/core/ao_rounds.ts` | 跨轮次 average-of-averages，逐 event 查询 |
| AverageOfX 基类 | `src/core/average_of_x.ts` | 滑动窗口裁剪均值（trimmed mean），逐 event 计算 |
| SolveTime 工具 | `src/core/solve_time.ts` | WCA 成绩值格式化（厘秒/FMC/多盲编解码），含 `DNF_INSTANCE` 哨兵 |
| 项目映射 | `src/core/events.ts` | WCA 项目 ID → 中英文名映射、`HEADER_ZH` 表头翻译字典、各种常量 |
| CLI | `src/bin/compute.ts` | `npx tsx src/bin/compute.ts <stat_id>` → 输出 JSON，含 `REGISTRY`（60 条） |
| React 页面 | `client/src/pages/wca_stats/WcaStatsPage.tsx` | 通用统计表格组件 |
| 路由 | `client/src/App.tsx` 中 `/app/wca-stats/:statId` | 懒加载 |

### 2.2 JSON Schema（已实现）

```typescript
// NOTE: 三种输出模式共存
interface StatJson {
  id: string;
  title: string;
  titleZh: string;
  note?: string;
  noteZh?: string;
  header: Array<{ key: string; label: string; labelZh: string; align: Alignment }>;
  rows?: unknown[][];       // 模式 1：普通统计（Statistic）
  sections?: StatSection[]; // 模式 2：分组统计（GroupedStatistic）
  panels?: StatPanel[];     // 模式 3：双视图统计（RoundMetric/AoRounds/AverageOfX）
}

interface StatSection {
  title: string;      // 项目英文名
  titleZh: string;    // 项目中文名
  rows: unknown[][];
}

interface StatPanel {
  id: string;         // 'ranking' | 'history'
  labelEn: string;    // Tab 按钮英文标签
  labelZh: string;    // Tab 按钮中文标签
  header: Array<{ key: string; label: string; labelZh: string; align: Alignment }>;
  sections: StatSection[];
}
```

### 2.3 已完成的 60 个统计

#### 阶段 A-1：18 个纯 SQL（Statistic 无 transform）✅

继承 `Statistic`，只需 `query()` 返回 SQL。SQL 与 Ruby 完全 1:1。

| # | stat_id |
|---|---------|
| 1 | `world_championship_podiums_by_person` |
| 2 | `world_championship_podiums_by_country` |
| 3 | `world_records_by_person` |
| 4 | `world_records_by_country` |
| 5 | `current_world_records_by_country` |
| 6 | `most_4th_places` |
| 7 | `fewest_competitors_contest` |
| 8 | `best_medal_collection_from_abroad_by_country` |
| 9 | `best_medal_collection_from_abroad_by_person` |
| 10 | `complete_competition_winners` |
| 11 | `most_attended_competitions_in_single_month` |
| 12 | `most_competitions_abroad` |
| 13 | `most_delegated_competitions` |
| 14 | `most_finals` |
| 15 | `most_podiums_at_single_competition` |
| 16 | `most_visited_continents` |
| 17 | `most_visited_countries` |
| 18 | `potentially_seen_world_records` |

#### 阶段 A-2：20 个 Statistic + transform ✅

继承 `Statistic`，有 `query()` + `transform()` 覆写。

| # | stat_id | transform 逻辑简述 |
|---|---------|---------------------|
| 1 | `dnf_rate_by_event` | 百分比格式化 |
| 2 | `name_parts_count` | 字符串拆分计数 |
| 3 | `competitions_count_by_week` | 按周聚合 |
| 4 | `average_event_count_by_competition` | 均值计算 |
| 5 | `best_potential_fmc_mean` | SolveTime 格式化 |
| 6 | `competitions_per_year_by_country` | 年度+百分比 |
| 7 | `competitions_per_year_by_person` | 年度+百分比 |
| 8 | `delegated_competition_per_year` | 年度聚合 |
| 9 | `first_r_is_wr` | SolveTime 格式化 |
| 10 | `longest_competitions_path` | 日期+距离计算 |
| 11 | `longest_streak_of_competitions_in_own_country` | 连续计数 |
| 12 | `longest_streak_of_personal_records` | 连续计数 |
| 13 | `longest_streak_of_podiums` | 连续计数 |
| 14 | `longest_streak_of_world_records` | 连续计数 |
| 15 | `longest_time_to_sub_10` | 天数计算 |
| 16 | `most_attended_competitions_in_single_week` | 周聚合 |
| 17 | `most_distinct_dates_competed_on` | 日期去重 |
| 18 | `shortest_time_to_get_all_singles` | 天数+日期 |
| 19 | `shortest_time_to_get_all_singles_and_averages` | 天数+日期 |
| 20 | `wr_current` | SolveTime 格式化 |

#### 阶段 B：16 个 GroupedStatistic ✅

继承 `GroupedStatistic`，按 WCA 项目分组，输出 `sections`。

| # | stat_id | 复杂度亮点 |
|---|---------|-----------|
| 1 | `most_completed_solves` | 简单分组 |
| 2 | `worst_result_on_podium` | 分组 + SolveTime |
| 3 | `best_result_off_podium` | 动态排序（preferred_formats） |
| 4 | `best_round` | 覆写 queryResults（逐项目查询）+ 333mbf points 降序 |
| 5 | `competition_days_count_by_region` | 按项目+地区 |
| 6 | `longest_standing_records` | 使用 OFFICIAL_EVENTS |
| 7 | `most_competitions_before_winning` | 标准分组 |
| 8 | `most_frequent_results` | 频次分析 |
| 9 | `most_podiums_together` | 组合数学（n 选 2） |
| 10 | `most_records_at_single_competition` | 标准分组 |
| 11 | `most_solves_before_bld_success` | BLD 项目专用 |
| 12 | `moving_average` | EMA 指数移动均值 |
| 13 | `records_in_most_events` | 标准分组 |
| 14 | `shortest_time_to_reach_milestone_in_comps_count` | 里程碑计算 |
| 15 | `smallest_diff_between_single_and_average` | SolveTime 差值 |
| 16 | `winned_week_count` | 周冠军统计 |
| — | `world_championship_records` | 世锦赛记录分组 |

> NOTE: 实际为 17 个（含 world_championship_records），阶段 B 的 GroupedStatistic 全部完成。

#### 阶段 C-1：13 个 RoundMetric 子类 ✅

继承 `RoundMetric`，子类只需实现 `computeMetric(values, row)` + 可选 `formatMetric()`。输出 `panels`。

| # | stat_id | computeMetric 逻辑 |
|---|---------|---------------------|
| 1 | `wr_bao5` | 5 中取最好 3 均值 |
| 2 | `wr_wao5` | 5 中取最差 3 均值 |
| 3 | `wr_mo5` | 5 次全部均值 |
| 4 | `wr_bpa` | 前 4 中取最好 3 均值 |
| 5 | `wr_wpa` | 前 4 中取最差 3 均值 |
| 6 | `wr_median` | 排序后中位数 |
| 7 | `wr_variance` | 样本方差，自定义 formatMetric |
| 8 | `wr_best_counting` | 去掉最好最差后最小值 |
| 9 | `wr_worst_counting` | 去掉最好最差后最大值 |
| 10 | `wr_worst` | 最大值 |
| 11 | `wr_best_average_ratio` | best/average 比值，自定义 formatMetric |
| 12 | `wr_single_history` | 直接返回 best 字段，batch=false |
| 13 | `wr_average_history` | 直接返回 average 字段，batch=false |

#### 阶段 C-2：4 个 AoRounds 子类 ✅

继承 `AoRounds`，子类只需实现 `roundCount()` 返回轮次数。

| # | stat_id | roundCount |
|---|---------|------------|
| 1 | `wr_ao1r` | 1 |
| 2 | `wr_ao2r` | 2 |
| 3 | `wr_ao3r` | 3 |
| 4 | `wr_ao4r` | 4 |

#### 阶段 C-3：7 个 AverageOfX 子类 ✅

继承 `AverageOfX`，子类只需 `super(solveCount)` 指定窗口大小。

| # | stat_id | solveCount |
|---|---------|------------|
| 1 | `average_of_3` | 3 |
| 2 | `average_of_5` | 5 |
| 3 | `average_of_12` | 12 |
| 4 | `average_of_25` | 25 |
| 5 | `average_of_50` | 50 |
| 6 | `average_of_100` | 100 |
| 7 | `average_of_1000` | 1000 |

---

## 三、剩余工作（33 个统计文件）

### 3.1 当前基类完成情况

| TS 基类 | 对应 Ruby 基类 | 总子类 | 已完成 | 剩余 |
|---------|---------------|--------|--------|------|
| `statistic.ts` | `statistic.rb` | 42 | ✅ 38 | **4** |
| `grouped_statistic.ts` | `grouped_statistic.rb` | 18 | ✅ 17 | **1** |
| `round_metric.ts` | `round_metric.rb` | 13 | ✅ 13 | **0** |
| `average_of_x.ts` | `average_of_x.rb` | 7 | ✅ 7 | **0** |
| `ao_rounds.ts` | `ao_rounds.rb` | 4 | ✅ 4 | **0** |
| ❌ 需创建 `rankings.ts` | `rankings.rb` | 1 | 0 | **1** |
| ❌ TS 侧不需要单独基类 | `stat_panel.rb`（Ruby mixin） | — | — | — |

### 3.2 剩余 33 个统计详细分类

#### 3.2.1 Statistic + transform（2 个）

这两个比较特殊，使用了 `StatPanel` mixin 有双视图输出：

| # | stat_id | 说明 | 复杂度 |
|---|---------|------|--------|
| 1 | `consecutive_sub_5_average` | 连续 sub-5 average 统计，有 StatPanel 双视图 | 中 |
| 2 | `mbf_average` | 多盲 Mo3 均值统计，被 `wr_average_history` 引用 | 高 |

> **改写模式**：阅读 `.rb` 的 `transform` + `markdown` 方法，用 TS 覆写。需要输出 `panels` 而非 `rows`。

#### 3.2.2 Statistic + StatPanel 聚合页面（4 个）

这些最复杂——它们不执行自己的 SQL，而是聚合其他统计的结果。有完全自定义的 `markdown()` 方法和多面板布局。

| # | stat_id | 说明 | 依赖 |
|---|---------|------|------|
| 1 | `wr_metric` | WR 衍生指标聚合页（13 个 RoundMetric 子统计的索引） | 所有 `wr_*` RoundMetric 子类 |
| 2 | `wr_aoxr` | AoXR 聚合页（4 个 AoRounds 子统计的索引） | 所有 `wr_ao*r` 子类 |
| 3 | `average_of` | AoX 聚合页（7 个 AverageOfX 子统计的索引） | 所有 `average_of_*` 子类 |
| 4 | `wr_dominance` | WR 统治力页面 | 独立逻辑 |

> **改写策略**：子统计已全部完成（13+4+7=24），聚合页面只需要组织子统计的 JSON 输出。建议在前端用 Tab 组件切换子统计，或在 TS 侧合并 JSON。

#### 3.2.3 Statistic + StatPanel（2 个）

| # | stat_id | 说明 |
|---|---------|------|
| 1 | `wr_non_pr` | 非 PR 的 WR 历史 |
| 2 | `wr_newcomer` | WR 新人（继承 GroupedStatistic，但无 transform） |

#### 3.2.4 Rankings（1 个）

| # | stat_id | 说明 |
|---|---------|------|
| 1 | `yearly_rankings` | 年度排名，需创建 `rankings.ts` 基类 |

> **改写步骤**：阅读 `_stats_build/statistics/abstract/rankings.rb`（50 行）→ 创建 `src/core/rankings.ts` → 实现子类

### 3.3 ⚠️ 重要遗留问题

1. **`wr_average_history` 的 333mbf/333mbo 处理**：Ruby 版通过委托 `MbfAverage` 实例处理多盲项目的 Mo3 数据。当前 TS 版暂时只覆盖有官方 average 的项目。完成 `mbf_average` 后需要回补此逻辑。

2. **`RoundMetric` 两步 SQL 排名**（`batchRanking() = false` 的子类）：`computeOwnRanking()` 使用了 `result_attempts` 表的子查询，需要确认该表存在。如果不存在，需要改用 `ATTEMPTS_SUBQUERY`。

---

## 四、推荐改写顺序

### 阶段 D-1：简单剩余（3 个，~30 分钟）

```
wr_newcomer            ← GroupedStatistic 无 transform，最简单
consecutive_sub_5_average  ← Statistic + StatPanel
mbf_average            ← Statistic + transform（被 wr_average_history 依赖）
```

完成 `mbf_average` 后，**回补 `wr_average_history` 的 333mbf/333mbo 处理**。

### 阶段 D-2：Rankings 基类（1 个，~15 分钟）

```
yearly_rankings        ← 需先创建 rankings.ts 基类
```

### 阶段 D-3：StatPanel 特殊统计（2 个，~30 分钟）

```
wr_non_pr              ← Statistic + StatPanel 双视图
wr_dominance           ← Statistic + StatPanel
```

### 阶段 D-4：聚合页面（4 个，~1 小时）

```
wr_metric              ← 聚合 13 个 RoundMetric（⚠️ 需前端 Tab 支持）
wr_aoxr                ← 聚合 4 个 AoRounds
average_of             ← 聚合 7 个 AverageOfX
```

> 这些聚合页面需要前端配合——`WcaStatsPage.tsx` 需要支持 `panels`（Tab 切换多面板）和 `sections`（分节展示）。

### 阶段 E：前端升级

1. `WcaStatsPage.tsx` 支持 `sections`（多分节展示，用于 GroupedStatistic）
2. `WcaStatsPage.tsx` 支持 `panels`（Tab 切换双视图，用于 RoundMetric/AoRounds/AverageOfX）
3. `WcaStatsIndex.tsx` 索引页（所有统计的入口）

---

## 五、关键文件快速索引

### 5.1 TS 核心文件

| 用途 | 路径 |
|------|------|
| **Statistic 基类** | `trainer/packages/stats-build/src/core/statistic.ts` |
| **GroupedStatistic 基类** | `trainer/packages/stats-build/src/core/grouped_statistic.ts` |
| **RoundMetric 基类** | `trainer/packages/stats-build/src/core/round_metric.ts` |
| **AoRounds 基类** | `trainer/packages/stats-build/src/core/ao_rounds.ts` |
| **AverageOfX 基类** | `trainer/packages/stats-build/src/core/average_of_x.ts` |
| **SolveTime 工具** | `trainer/packages/stats-build/src/core/solve_time.ts` |
| **数据库连接** | `trainer/packages/stats-build/src/core/database.ts` |
| **项目映射+表头翻译** | `trainer/packages/stats-build/src/core/events.ts` |
| **CLI 入口 + REGISTRY** | `trainer/packages/stats-build/src/bin/compute.ts` |
| **已完成的 TS 统计** | `trainer/packages/stats-build/src/statistics/*.ts`（60 个） |

### 5.2 Ruby 参考文件（只读）

| 用途 | 路径 |
|------|------|
| **Ruby 统计源码** | `_stats_build/statistics/*.rb` |
| **Ruby 基类** | `_stats_build/core/statistic.rb`、`grouped_statistic.rb`、`stat_panel.rb` |
| **Ruby 抽象类** | `_stats_build/statistics/abstract/round_metric.rb`、`average_of_x.rb`、`ao_rounds.rb`、`rankings.rb` |
| **数据库 Schema** | `_stats_build/SCHEMA.md` |
| **数据库凭据** | `_stats_build/database.yml`（不在 git 中） |

### 5.3 前端文件

| 用途 | 路径 |
|------|------|
| **React 页面** | `trainer/packages/client/src/pages/wca_stats/WcaStatsPage.tsx` |
| **JSON 输出** | `stats/data/*.json` |

### 5.4 events.ts 中的关键常量

| 常量 | 说明 | 使用者 |
|------|------|--------|
| `EVENTS` | 全部 WCA 项目 ID → 英文名 | 所有统计 |
| `EVENTS_WITH_AVERAGE` | 排除 333mbf/333mbo | RoundMetric/AoRounds 默认 |
| `EVENTS_WITH_AO5` | 排除 Mo3 项目 | RoundMetric 的 Ao5 系子类 |
| `EVENTS_WITH_AVERAGE_MBF` | WITH_AVERAGE + 333mbf/333mbo | wr_average_history |
| `OFFICIAL_EVENTS_RECORD` | 排除退役项目（Record 格式） | wr_single_history |
| `OFFICIAL_EVENTS` | 排除退役项目（string[] 格式） | longest_standing_records 等 |
| `BLD_EVENTS` | 盲拧项目 | most_solves_before_bld_success |
| `MO3_EVENTS` | Mo3 项目列表 | EVENTS_WITH_AO5 过滤用 |
| `HEADER_ZH` | 表头英文 → 中文翻译 | 所有统计的 headerZh() |
| `NAMES_ZH` | 项目英文名 → 中文名 | eventZh() |

---

## 六、关键约束

1. **Ruby 代码零修改**：所有 `.rb` 文件只读参考
2. **SQL 逻辑零改动**：TS 版的 SQL 必须与 Ruby 完全一致
3. **计算逻辑零改动**：`transform` / `computeMetric` 的数据处理逻辑必须与 Ruby 完全一致
4. **i18n 双语**：标题、描述、列名都需要中英文
5. **新表头翻译**：每增加新表头列名，在 `events.ts` 的 `HEADER_ZH` 添加
6. **新统计注册**：每个新 TS 文件都要在 `compute.ts` 的 `REGISTRY` 中注册
7. **编译检查**：每批完成后 `npx tsc --noEmit`
8. **增量提交**：每完成一批就 `git commit`
9. **不做多余防御**：只修根因，不做多余防御。可读性优先

---

## 七、快速上手命令

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

## 八、改写模式速查

### 模式 1：纯 SQL（Statistic，无 transform）

```typescript
import { Statistic } from '../core/statistic.js';
export class XxxStat extends Statistic {
  constructor() { super(); this.title = '...'; this.titleZh = '...'; this.tableHeader = {...}; }
  query() { return `SELECT ... FROM ...`; }
}
```

### 模式 2：SQL + transform（Statistic）

```typescript
import { Statistic } from '../core/statistic.js';
export class XxxStat extends Statistic {
  constructor() { super(); this.title = '...'; this.titleZh = '...'; this.tableHeader = {...}; }
  query() { return `SELECT ...`; }
  transform(rows: RowDataPacket[]) { return rows.map(r => [...]); }
}
```

### 模式 3：分组统计（GroupedStatistic）

```typescript
import { GroupedStatistic } from '../core/grouped_statistic.js';
export class XxxStat extends GroupedStatistic {
  constructor() { super(); this.title = '...'; this.titleZh = '...'; this.tableHeader = {...}; }
  query() { return `SELECT event_id, ...`; }
  transform(rows: RowDataPacket[]) {
    return Object.entries(EVENTS).map(([eid, ename]) => {
      const filtered = rows.filter(r => r['event_id'] === eid);
      return [ename, filtered.map(r => [...])];
    });
  }
}
```

### 模式 4：RoundMetric 子类

```typescript
import { RoundMetric } from '../core/round_metric.js';
export class WrXxx extends RoundMetric {
  constructor() { super(); this.title = '...'; this.titleZh = '...'; this.tableHeader = {...}; }
  targetEvents() { return EVENTS_WITH_AO5; }
  computeMetric(values: number[], row: RowDataPacket): number | null { return ...; }
  formatMetric(v: number, eid: string) { return '...'; } // 可选覆写
}
```

### 模式 5：AoRounds 子类

```typescript
import { AoRounds } from '../core/ao_rounds.js';
export class WrAoXr extends AoRounds {
  constructor() { super(); this.title = '...'; this.titleZh = '...'; }
  roundCount() { return X; }
}
```

### 模式 6：AverageOfX 子类

```typescript
import { AverageOfX } from '../core/average_of_x.js';
export class AverageOfXx extends AverageOfX {
  constructor() { super(XX); }
}
```

---

## 九、完整 Ruby 文件清单与状态

<details>
<summary>点击展开（93 个文件，含继承关系和完成状态）</summary>

| 文件 | Ruby 基类 | 有 transform | 状态 |
|------|-----------|-------------|------|
| `average_event_count_by_competition` | Statistic | ✅ | ✅ A-2 |
| `average_of_100` | AverageOfX | ❌ | ✅ C-3 |
| `average_of_1000` | AverageOfX | ❌ | ✅ C-3 |
| `average_of_12` | AverageOfX | ❌ | ✅ C-3 |
| `average_of_25` | AverageOfX | ❌ | ✅ C-3 |
| `average_of_3` | AverageOfX | ❌ | ✅ C-3 |
| `average_of_5` | AverageOfX | ❌ | ✅ C-3 |
| `average_of_50` | AverageOfX | ❌ | ✅ C-3 |
| `average_of` | Statistic+StatPanel | ❌ | ⬜ 聚合页面 D-4 |
| `best_medal_collection_from_abroad_by_country` | Statistic | ❌ | ✅ A-1 |
| `best_medal_collection_from_abroad_by_person` | Statistic | ❌ | ✅ A-1 |
| `best_potential_fmc_mean` | Statistic | ✅ | ✅ A-2 |
| `best_result_off_podium` | GroupedStatistic | ✅ | ✅ B |
| `best_round` | GroupedStatistic | ✅ | ✅ B |
| `competition_days_count_by_region` | GroupedStatistic | ✅ | ✅ B |
| `competitions_count_by_week` | Statistic | ✅ | ✅ A-2 |
| `competitions_per_year_by_country` | Statistic | ✅ | ✅ A-2 |
| `competitions_per_year_by_person` | Statistic | ✅ | ✅ A-2 |
| `complete_competition_winners` | Statistic | ❌ | ✅ A-1 |
| `consecutive_sub_5_average` | Statistic+StatPanel | ✅ | ⬜ D-1 |
| `current_world_records_by_country` | Statistic | ❌ | ✅ A-1 |
| `delegated_competition_per_year` | Statistic | ✅ | ✅ A-2 |
| `dnf_rate_by_event` | Statistic | ✅ | ✅ A-2 |
| `fewest_competitors_contest` | Statistic | ❌ | ✅ A-1 |
| `first_r_is_wr` | Statistic | ✅ | ✅ A-2 |
| `longest_competitions_path` | Statistic | ✅ | ✅ A-2 |
| `longest_standing_records` | GroupedStatistic | ✅ | ✅ B |
| `longest_streak_of_competitions_in_own_country` | Statistic | ✅ | ✅ A-2 |
| `longest_streak_of_personal_records` | Statistic | ✅ | ✅ A-2 |
| `longest_streak_of_podiums` | Statistic | ✅ | ✅ A-2 |
| `longest_streak_of_world_records` | Statistic | ✅ | ✅ A-2 |
| `longest_time_to_sub_10` | Statistic | ✅ | ✅ A-2 |
| `mbf_average` | Statistic+StatPanel | ✅ | ⬜ D-1 |
| `most_4th_places` | Statistic | ❌ | ✅ A-1 |
| `most_attended_competitions_in_single_month` | Statistic | ❌ | ✅ A-1 |
| `most_attended_competitions_in_single_week` | Statistic | ✅ | ✅ A-2 |
| `most_competitions_abroad` | Statistic | ❌ | ✅ A-1 |
| `most_competitions_before_winning` | GroupedStatistic | ✅ | ✅ B |
| `most_completed_solves` | GroupedStatistic | ✅ | ✅ B |
| `most_delegated_competitions` | Statistic | ❌ | ✅ A-1 |
| `most_distinct_dates_competed_on` | Statistic | ✅ | ✅ A-2 |
| `most_finals` | Statistic | ❌ | ✅ A-1 |
| `most_frequent_results` | GroupedStatistic | ✅ | ✅ B |
| `most_podiums_at_single_competition` | Statistic | ❌ | ✅ A-1 |
| `most_podiums_together` | GroupedStatistic | ✅ | ✅ B |
| `most_records_at_single_competition` | GroupedStatistic | ✅ | ✅ B |
| `most_solves_before_bld_success` | GroupedStatistic | ✅ | ✅ B |
| `most_visited_continents` | Statistic | ❌ | ✅ A-1 |
| `most_visited_countries` | Statistic | ❌ | ✅ A-1 |
| `moving_average` | GroupedStatistic | ✅ | ✅ B |
| `name_parts_count` | Statistic | ✅ | ✅ A-2 |
| `potentially_seen_world_records` | Statistic | ❌ | ✅ A-1 |
| `records_in_most_events` | GroupedStatistic | ✅ | ✅ B |
| `shortest_time_to_get_all_singles` | Statistic | ✅ | ✅ A-2 |
| `shortest_time_to_get_all_singles_and_averages` | Statistic | ✅ | ✅ A-2 |
| `shortest_time_to_reach_milestone_in_comps_count` | GroupedStatistic | ✅ | ✅ B |
| `smallest_diff_between_single_and_average` | GroupedStatistic | ✅ | ✅ B |
| `winned_week_count` | GroupedStatistic | ✅ | ✅ B |
| `world_championship_podiums_by_country` | Statistic | ❌ | ✅ A-1 |
| `world_championship_podiums_by_person` | Statistic | ❌ | ✅ A-1 |
| `world_championship_records` | GroupedStatistic | ✅ | ✅ B |
| `world_records_by_country` | Statistic | ❌ | ✅ A-1 |
| `world_records_by_person` | Statistic | ❌ | ✅ A-1 |
| `worst_result_on_podium` | GroupedStatistic | ✅ | ✅ B |
| `wr_ao1r` | AoRounds | ❌ | ✅ C-2 |
| `wr_ao2r` | AoRounds | ❌ | ✅ C-2 |
| `wr_ao3r` | AoRounds | ❌ | ✅ C-2 |
| `wr_ao4r` | AoRounds | ❌ | ✅ C-2 |
| `wr_aoxr` | Statistic+StatPanel | ❌ | ⬜ 聚合页面 D-4 |
| `wr_average_history` | RoundMetric | ✅ | ✅ C-1（⚠️ 333mbf 待补） |
| `wr_bao5` | RoundMetric | ❌ | ✅ C-1 |
| `wr_best_average_ratio` | RoundMetric | ❌ | ✅ C-1 |
| `wr_best_counting` | RoundMetric | ❌ | ✅ C-1 |
| `wr_bpa` | RoundMetric | ❌ | ✅ C-1 |
| `wr_current` | Statistic | ✅ | ✅ A-2 |
| `wr_dominance` | Statistic+StatPanel | ❌ | ⬜ D-3 |
| `wr_median` | RoundMetric | ❌ | ✅ C-1 |
| `wr_metric` | Statistic+StatPanel | ❌ | ⬜ 聚合页面 D-4 |
| `wr_mo5` | RoundMetric | ❌ | ✅ C-1 |
| `wr_newcomer` | GroupedStatistic | ❌ | ⬜ D-1 |
| `wr_non_pr` | Statistic+StatPanel | ❌ | ⬜ D-3 |
| `wr_single_history` | RoundMetric | ❌ | ✅ C-1 |
| `wr_variance` | RoundMetric | ❌ | ✅ C-1 |
| `wr_wao5` | RoundMetric | ❌ | ✅ C-1 |
| `wr_worst_counting` | RoundMetric | ❌ | ✅ C-1 |
| `wr_worst` | RoundMetric | ❌ | ✅ C-1 |
| `wr_wpa` | RoundMetric | ❌ | ✅ C-1 |
| `yearly_rankings` | Rankings | ❌ | ⬜ D-2 |

**统计**：✅ 60 · ⬜ 33（含 4 聚合页面）

</details>

---

## 十、已知技术陷阱

1. **RowDataPacket spread 陷阱**：`{ ...row }` 会丢失 mysql2 的 index signature。解决方案：用显式字段映射 `{ field: row['field'] }` 代替 spread。

2. **333mbf 排序**：多盲成绩用 `SolveTime.points` 降序排列，而非 `wca_value` 升序。`best_round` 子类中已实现此逻辑。

3. **表头翻译缺失**：新增表头列名如果不在 `HEADER_ZH` 中会返回英文原文。新增统计前先检查 `events.ts` 是否有对应翻译。

4. **类型满足**：`AoRounds`/`AverageOfX` 继承 `GroupedStatistic`，后者有 `abstract transform()`。由于这两个基类完全覆写了 `toJson()` 不使用 `transform()`，提供了空实现 `transform() { return []; }` 满足类型要求。

5. **Windows 编码**：含中文注释的文件禁止用 `replace_file_content` 做全文替换，必须用字节级操作或增量编辑。

6. **ATTEMPTS_SUBQUERY**：在 `database.ts` 中定义，用于将 `value1~value5` 拼接为逗号分隔字符串。需要在 SQL 中使用 `${ATTEMPTS_SUBQUERY} AS attempts` 引用。

7. **RoundMetric 两步 SQL**：`batchRanking() = false` 的子类（`wr_single_history`、`wr_average_history`）使用 `computeOwnRanking()` 方法，该方法的 SQL 引用了 `result_attempts` 表。如果本地数据库没有该表，需要改用 `ATTEMPTS_SUBQUERY`。
