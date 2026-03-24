# Stats Ruby → TypeScript + React 完整迁移计划

## 一、背景与现状

### 1.1 项目概述

本项目（[ruiminyan.github.io](https://ruiminyan.github.io)）是一个 Jekyll 静态站 + React SPA 的混合架构。其中 WCA 统计模块由 Ruby 脚本生成 Markdown 文件，再由 Jekyll 渲染为 HTML。

**最终目标**：用 TypeScript 完全替代 Ruby — TS 直连 MySQL 生成数据，React 渲染页面，Ruby 退役。

### 1.2 当前架构

```
┌──────────────────────────────────────────────────────────────┐
│                    现有 Ruby 管线（每周 CI 运行）                │
│                                                              │
│  _stats_build/statistics/*.rb (93 个 Ruby 脚本)               │
│      ↓ SQL 查询 MySQL (wca_statistics)                       │
│      ↓ 格式化为 Markdown                                     │
│  stats/*.md (71 个 Markdown 文件，去重后)                      │
│      ↓ Jekyll 渲染                                           │
│  _site/stats/*.html                                          │
│      ↓ GitHub Pages 部署                                     │
│  https://ruiminyan.github.io/stats/*                         │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 目标架构

```
┌──────────────────────────────────────────────────────────────┐
│                    新 TS 管线                                  │
│                                                              │
│  stats-build/src/statistics/*.ts (逐个替代 Ruby)              │
│      ↓ SQL 查询 MySQL (wca_statistics)                       │
│      ↓ 输出 JSON                                             │
│  stats/data/*.json                                           │
│      ↓ React SPA 渲染                                        │
│  http://localhost:5173/app/wca-stats/:statId                 │
│      ↓ 部署                                                  │
│  https://ruiminyan.github.io/app/wca-stats/:statId           │
└──────────────────────────────────────────────────────────────┘
```

### 1.4 已完成的试点

**试点统计：`world_championship_podiums_by_person`**

已成功建立 TS 管线，证明可行性：

| 组件 | 文件 | 说明 |
|------|------|------|
| MySQL 连接 | `stats-build/src/core/database.ts` | mysql2 连接池，配置从环境变量或默认值读取 |
| 基类 | `stats-build/src/core/statistic.ts` | 抽象 SQL → JSON 管线 |
| 项目映射 | `stats-build/src/core/events.ts` | WCA 项目 ID → 中英文名映射 |
| 试点统计 | `stats-build/src/statistics/world_championship_podiums_by_person.ts` | 完整重写 Ruby SQL |
| CLI | `stats-build/src/bin/compute.ts` | `npx tsx src/bin/compute.ts <stat_id>` |
| React 页面 | `client/src/pages/wca_stats/WcaStatsPage.tsx` | 通用统计表格组件 |
| 样式 | `client/src/pages/wca_stats/wca_stats.css` | 暗色主题 + 搜索 |
| 路由 | `App.tsx` 中 `/app/wca-stats/:statId` | 懒加载 |

### 1.5 数据库信息

```yaml
database: wca_statistics
host: 127.0.0.1
username: root
password: yrm31415926
```

核心表：`Results`, `Persons`, `Competitions`, `RanksSingle`, `RanksAverage`
详细 schema 见 `_stats_build/SCHEMA.md`

---

## 二、迁移策略

**直接逐个将 93 个 Ruby 统计改写为 TypeScript**。

- 每改写一个 → 跑 `compute.ts` 生成 JSON → React 前端自动可用
- 未改写的统计继续走 Jekyll 渲染（已有且正常工作）
- 索引页可混合链接：已改写的指向 React，未改写的指向 Jekyll

> ~~曾考虑过先写 Markdown 解析器，将现有 .md 批量转 JSON，让 React 立即覆盖全部统计。但这是临时代码，最终会被 TS 改写替代，故跳过。~~

---

## 三、.md 文件格式分析（参考）

> 虽然不再做 Markdown 解析器，但这些格式分析对理解 Ruby 输出和对比验证仍有价值。

### 3.1 统计概览

| 分类 | 数量 | 特征 |
|------|------|------|
| 纯 Markdown 表格 | ~46 | 用 `\| col \| col \|` 管道语法 |
| 混合型 | ~12 | `<h3>` HTML 分节标题 + Markdown 管道表格 |
| HTML 面板型 | 12 | `<div class="stat-panel">` + `<table>` HTML 标签 |
| 索引页 | 1 | `index.md`，分类卡片链接 |

### 3.2 共有结构

```html
<h2 data-i18n-en="English Title" data-i18n-zh="中文标题">English Title</h2>
<p><em data-i18n-en="English description" data-i18n-zh="中文描述">English description</em></p>
<!-- 可选：分节标题 -->
<h3 data-i18n-en="Section" data-i18n-zh="分节">Section</h3>
<!-- 表格内容（Markdown 或 HTML） -->
```

### 3.3 HTML 面板型文件清单（12 个，复杂度最高）

```
consecutive_sub_5_average     wr_metric
wr_current                    wr_newcomer
wr_dominance                  wr_non_pr
wr_aoxr                       average_of
yearly_rankings                best_round
moving_average                 longest_standing_records
```

这些文件含嵌套面板 + tab 切换，React 前端需要额外组件支持。

---

## 四、JSON Schema 设计

### 4.1 现有 schema（试点产出的格式）

```typescript
interface StatData {
  id: string;               // 如 "world_championship_podiums_by_person"
  title: string;             // 英文标题
  titleZh: string;           // 中文标题
  note?: string;             // 英文描述
  noteZh?: string;           // 中文描述
  header: StatHeader[];      // 表头
  rows: unknown[][];         // 数据行
}

interface StatHeader {
  key: string;               // 列键名
  label: string;             // 英文列名
  labelZh: string;           // 中文列名
  align: 'left' | 'right' | 'center';
}
```

### 4.2 扩展 schema（支持多分节和多面板）

```typescript
interface StatData {
  id: string;
  title: string;
  titleZh: string;
  note?: string;
  noteZh?: string;
  // 单表格（向后兼容）
  header?: StatHeader[];
  rows?: unknown[][];
  // 多分节（如 most_podiums_together: Pairs, Triples）
  sections?: StatSection[];
  // 多面板（如 wr_metric: Single/Average + Ranking/History）
  panels?: StatPanel[];
}

interface StatSection {
  title: string;
  titleZh: string;
  header: StatHeader[];
  rows: unknown[][];
}

interface StatPanel {
  id: string;                // 如 "single", "average"
  label: string;             // tab 标签英文
  labelZh: string;           // tab 标签中文
  sections: StatSection[];   // 面板内的子分节
}
```

### 4.3 JSON 输出位置

所有 JSON 文件输出到 `stats/data/<stat_id>.json`。

---

## 五、改写工作计划

### 5.1 改写难度分类

根据 Ruby 文件行数和 SQL 复杂度：

| 难度 | 行数 | 数量 | 代表文件 |
|------|------|------|----------|
| 简单 | <50 行 | ~50 | `most_4th_places.rb`, `fewest_competitors_contest.rb` |
| 中等 | 50-100 行 | ~25 | `most_distinct_dates_competed_on.rb`, `first_r_is_wr.rb` |
| 复杂 | 100-200 行 | ~12 | `best_round.rb`, `consecutive_sub_5_average.rb` |
| 极复杂 | 200+ 行 | ~6 | `wr_dominance.rb` (312行), `wr_newcomer.rb` (274行) |

### 5.2 每个统计的改写步骤

1. 阅读对应 `.rb` 文件的 SQL 和格式化逻辑
2. 在 `stats-build/src/statistics/<stat_id>.ts` 创建新类（继承 `Statistic` 基类）
3. 移植 SQL 到 TS（通常只需复制 SQL 字符串，修改结果处理代码）
4. 在 `bin/compute.ts` 的 REGISTRY 注册
5. 运行 `npx tsx src/bin/compute.ts <stat_id>` 生成 JSON
6. **对比验证**：TS 输出的 JSON 数据与 Ruby 输出的 .md 中的数据一致
7. 浏览器打开 `http://localhost:5173/app/wca-stats/<stat_id>` 预览
8. Git commit

### 5.3 改写优先级

推荐顺序（由简到难，优先高流量页面）：

**第一批（简单 SQL、单表格）：**
```
world_championship_podiums_by_country  ← 与已完成的 by_person 结构相似
world_records_by_person
world_records_by_country
current_world_records_by_country
most_completed_solves
most_4th_places
fewest_competitors_contest
dnf_rate_by_event
name_parts_count
```

**第二批（中等复杂度 / 多分节）：**
```
most_podiums_together              ← 多分节（Pairs / Triples）
best_medal_collection_from_abroad_by_person
best_medal_collection_from_abroad_by_country
competitions_per_year_by_person
competitions_per_year_by_country
most_visited_countries
most_visited_continents
best_potential_fmc_mean
```

**第三批（复杂 SQL / 多面板）：**
```
wr_metric (87 行但多面板)
wr_current
wr_aoxr
best_round
moving_average
consecutive_sub_5_average
```

**第四批（极复杂）：**
```
wr_dominance (312 行)
wr_newcomer (274 行)
wr_non_pr (226 行)
mbf_average (205 行)
```

### 5.4 前端需要同步升级的点

随着改写推进，React 前端需要逐步增强：

| 改写批次 | 前端需要 | 说明 |
|----------|----------|------|
| 第一批 | 无 | 现有 `WcaStatsPage` 已支持单表格 |
| 第二批 | `sections` 支持 | 多分节表格渲染，每个分节有标题 |
| 第三批 | `panels` + tab 切换 | 面板切换 UI 组件 |
| 全部完成后 | 索引页 `WcaStatsIndex` | 统计分类导航 |

---

## 六、CI/CD 集成计划

### 6.1 过渡期

两套管线并行：
- Ruby CI 继续生成 .md → Jekyll 渲染未改写的统计
- TS CLI 手动运行或 CI 运行生成 JSON → React 渲染已改写的统计

### 6.2 迁移后 CI

```yaml
# .github/workflows/stats-build.yml
# 每周运行 TS 管线生成全部 JSON
- run: cd trainer && npx tsx packages/stats-build/src/bin/compute.ts --all
# 将 JSON 推送到 stats/data/
```

---

## 七、目录结构总览

```
trainer/packages/stats-build/
├── package.json
├── tsconfig.json
├── MIGRATION_PLAN.md              ← 本文档
├── src/
│   ├── core/
│   │   ├── database.ts            ← MySQL 连接（已完成）
│   │   ├── statistic.ts           ← 统计基类（已完成）
│   │   └── events.ts              ← WCA 项目映射（已完成）
│   ├── statistics/
│   │   ├── world_championship_podiums_by_person.ts  ← ✅ 已完成
│   │   ├── world_championship_podiums_by_country.ts ← [待建]
│   │   └── ...                                      ← 逐个改写
│   └── bin/
│       └── compute.ts             ← SQL → JSON CLI（已完成）

stats/
├── *.md                           ← Ruby 生成的 Markdown 文件（不动）
└── data/
    └── *.json                     ← TS 生成的 JSON 文件

trainer/packages/client/src/pages/wca_stats/
├── WcaStatsPage.tsx               ← 通用统计表格（已完成，需逐步扩展）
├── WcaStatsIndex.tsx              ← [待建] 索引页
└── wca_stats.css                  ← 样式（已完成）
```

---

## 八、关键约束与注意事项

1. **Ruby 代码零修改**：所有 Ruby 文件只读不改，TS 完全平行重写
2. **JSON 文件名一致性**：`stats/data/<stat_id>.json` 中的 `stat_id` 必须与 .md 文件名一致
3. **i18n 支持**：所有标题、描述、列名都需要中英文双语
4. **Vite proxy**：开发时 `/stats` 请求通过 Vite proxy 转发到 Jekyll `localhost:4000`（已配置）
5. **数据对比验证**：每个 TS 改写的统计都必须与 Ruby 输出对比验证
6. **MySQL 连接**：需要本地运行 MySQL 且导入 WCA 数据库（`wca_statistics`）
7. **增量推进**：每完成一个统计就 git commit，不要攒批

---

## 九、93 个 Ruby 文件完整清单

<details>
<summary>点击展开完整列表</summary>

```
average_event_count_by_competition.rb
average_of_100.rb
average_of_1000.rb
average_of_12.rb
average_of_25.rb
average_of_3.rb
average_of_5.rb
average_of_50.rb
average_of.rb
best_medal_collection_from_abroad_by_country.rb
best_medal_collection_from_abroad_by_person.rb
best_potential_fmc_mean.rb
best_result_off_podium.rb
best_round.rb
competition_days_count_by_region.rb
competitions_count_by_week.rb
competitions_per_year_by_country.rb
competitions_per_year_by_person.rb
complete_competition_winners.rb
consecutive_sub_5_average.rb
current_world_records_by_country.rb
delegated_competition_per_year.rb
dnf_rate_by_event.rb
fewest_competitors_contest.rb
first_r_is_wr.rb
index.rb
longest_competitions_path.rb
longest_standing_records.rb
longest_streak_of_competitions_in_own_country.rb
longest_streak_of_personal_records.rb
longest_streak_of_podiums.rb
longest_streak_of_world_records.rb
longest_time_to_sub_10.rb
mbf_average.rb
most_4th_places.rb
most_attended_competitions_in_single_month.rb
most_attended_competitions_in_single_week.rb
most_competitions_abroad.rb
most_competitions_before_winning.rb
most_completed_solves.rb
most_delegated_competitions.rb
most_distinct_dates_competed_on.rb
most_finals.rb
most_frequent_results.rb
most_podiums_at_single_competition.rb
most_podiums_together.rb
most_records_at_single_competition.rb
most_solves_before_bld_success.rb
most_visited_continents.rb
most_visited_countries.rb
moving_average.rb
name_parts_count.rb
potentially_seen_world_records.rb
records_in_most_events.rb
shortest_time_to_get_all_singles_and_averages.rb
shortest_time_to_get_all_singles.rb
shortest_time_to_reach_milestone_in_comps_count.rb
smallest_diff_between_single_and_average.rb
winned_week_count.rb
world_championship_podiums_by_country.rb
world_championship_podiums_by_person.rb          ← ✅ 已完成
world_championship_records.rb
world_records_by_country.rb
world_records_by_person.rb
worst_result_on_podium.rb
wr_ao1r.rb
wr_ao2r.rb
wr_ao3r.rb
wr_ao4r.rb
wr_aoxr.rb
wr_average_history.rb
wr_bao5.rb
wr_best_average_ratio.rb
wr_best_counting.rb
wr_bpa.rb
wr_current.rb
wr_dominance.rb
wr_median.rb
wr_metric.rb
wr_mo5.rb
wr_newcomer.rb
wr_non_pr.rb
wr_single_history.rb
wr_variance.rb
wr_wao5.rb
wr_worst_counting.rb
wr_worst.rb
wr_wpa.rb
yearly_rankings.rb
```

</details>

---

## 十、检验标准

### 单个统计完成标准
- [ ] TS SQL 输出与 Ruby Markdown 数据完全一致
- [ ] `npx tsc --noEmit` 编译通过
- [ ] 浏览器预览正常
- [ ] Git commit

### 最终完成标准
- [ ] 全部 93 个 Ruby 统计改写为 TS
- [ ] CI/CD 切换到 TS 管线
- [ ] Ruby 相关代码标记为 deprecated
- [ ] 索引页 `WcaStatsIndex.tsx` 完成
- [ ] README 更新
