# WCA Stats React 迁移 — AI 交接文档

> 创建于 2026-03-26，本轮对话结束时留给下一个 AI 的上下文文档。

## 两个版本说明

| 版本 | 地址 | 状态 |
|------|------|------|
| **Legacy（参考正确版本）** | `http://localhost:4000/stats/` | Jekyll 静态站，**数据和 UI 均正确** |
| **React 迁移版（需要修 bug）** | `http://localhost:5173/app/wca-stats/` | React SPA，有 bug，以 Legacy 为标准 |

**原则：以 Legacy 为 ground truth，发现 React 版任何与 Legacy 不一致的地方都算 bug。**

## 本地开发环境启动

```powershell
# Legacy 版（参考基准）
cd D:\cube\ruiminyan.github.io
bundle exec jekyll serve
# → http://localhost:4000/stats/

# React 版（需修 bug）
cd D:\cube\ruiminyan.github.io\trainer
pnpm --filter @cuberoot/client dev
# → http://localhost:5173/app/wca-stats/
```

> `vite.config.ts` 已设 `host: '127.0.0.1'`，Windows Chrome 需用 IPv4 地址。

## 代码架构速查

### 渲染管线

```
stats/data/<stat_id>.json          ← 由 stats-build 生成的 JSON 数据
    ↓ fetch
WcaStatsPage.tsx                   ← 路由: /app/wca-stats/:statId
    ↓ 根据 JSON 结构分派
    ├── rows      → StatsTable（单表）
    ├── sections  → SectionsView（分组折叠）
    ├── panels    → PanelsView（Tab: Ranking/History）
    └── metricPanels → MetricPanelsView（Metric 切换 + Panels）
```

### 关键文件

| 文件 | 作用 |
|------|------|
| `trainer/packages/client/src/pages/wca_stats/WcaStatsPage.tsx` | 核心渲染逻辑（`SectionsView`, `PanelsView`, `StatsTable` 等全部在此文件） |
| `trainer/packages/client/src/pages/wca_stats/WrHistoryChart.tsx` | AoX History 折线图（Canvas） |
| `trainer/packages/client/src/pages/wca_stats/DistributionChart.tsx` | AoX Ranking 分布图 |
| `trainer/packages/client/src/pages/wca_stats/WcaEventSelector.tsx` | 21 个项目图标过滤器 |
| `trainer/packages/client/src/pages/wca_stats/wca_stats.css` | 统计页样式 |
| `trainer/packages/client/src/pages/wca_stats/WcaStatsIndex.tsx` | 统计索引页（分组卡片导航）|

### JSON 渲染模式对应

```
rows         → 普通/分组统计（Statistic / GroupedStatistic）
sections     → 多 section（GroupedStatistic，有 title 分组）
panels       → 双 Tab（RoundMetric / AoRounds / AverageOfX，含 ranking + history）
metricPanels → Metric 切换（wr_metric / wr_aoxr / average_of，含多个 metric）
```

## 本轮已完成的工作

> 以下已合并到 main 分支，不需要重复做：

- ✅ **`wr_dominance` 内存优化**：SQL 去掉 JOIN+CONCAT，流式处理，内存从 5118MB → 2297MB
- ✅ **`average_of` pbHistory 优化**：用预格式化 csv 替代数组拷贝
- ✅ **日期格式 bug 修复**：`formatDate()` 统一输出 YYYY-MM-DD（之前 JS Date 序列化导致排序错误）
- ✅ **折线图单调性修复**：`WrHistoryChart.tsx` 的 `extractPoints` 现在用 `date`（达成日期）而非 `start_date`（窗口起点）做 x 轴
- ✅ **AoX History Dedup toggle**：iOS 药丸开关，默认 ON，两条过滤规则对标 Legacy `initHideDays0`
- ✅ **Vite IPv4 绑定**：`vite.config.ts` 加 `host: '127.0.0.1'`，修复 Windows Chrome 连不上 dev server

## 已知 Bug 清单（下一个 AI 接手）

> 以下 bug 均是通过对比 `http://localhost:4000/stats/` 和 `http://localhost:5173/app/wca-stats/` 发现的。

### 优先级高

- [ ] **待排查**：与 Legacy 对比，找出剩余不一致的 UI/数据 bug。建议逐页对比：
  - `average_of`：`http://localhost:4000/stats/average_of` vs `http://localhost:5173/app/wca-stats/average_of`
  - `wr_metric`：`http://localhost:4000/stats/wr_metric` vs `http://localhost:5173/app/wca-stats/wr_metric`
  - `wr_dominance`：`http://localhost:4000/stats/wr_dominance` vs `http://localhost:5173/app/wca-stats/wr_dominance`
  - 任意普通统计如 `world_championship_podiums_by_person`

### 排查方法

1. 并排打开 Legacy 和 React 版相同页面
2. 检查 UI 结构（Tab/Metric 切换、折叠状态、图表）
3. 检查数据（表格内容、链接、国旗、格式）
4. 检查交互（Dedup toggle、Event selector、搜索框）

## Legacy 参考实现（重要）

Legacy 实现位置（只读参考，**不要修改**）：

| 功能 | Legacy 文件 |
|------|------------|
| Tab/Metric 切换逻辑 | `trainer/packages/stats-ui/src/stats_ui.ts` |
| WR 历史折线图 | `trainer/packages/stats-ui/src/wr_history_chart.ts` |
| 分布图 | `trainer/packages/stats-ui/src/distribution_chart.ts` |
| 项目选择器 | `trainer/packages/stats-ui/src/event_selector.ts` |
| Dedup toggle（initHideDays0） | `trainer/packages/stats-ui/src/stats_ui.ts` L396-504 |
| Ruby 统计实现（参考数据逻辑） | `_stats_build/statistics/*.rb` |

## 数据文件路径

```
stats/data/<stat_id>.json          ← React 版读取的 JSON（正式数据）
stats/data/index.json              ← 统计索引（WcaStatsIndex.tsx 用）
stats/wr_ids.json                  ← Calc 页面 WR 数据
```

## 关键 Header Key 对照表

React 版 `header` 数组中的 `key` 由 stats-build 生成（Ruby 表头转 snake_case）：

| 显示名 | key | 说明 |
|--------|-----|------|
| Result | `result` | 成绩 |
| Start Date | `start_date` | 窗口开始日期（AoX 专用） |
| Date | `date` | WR 达成日期 |
| Start Comp | `start_comp` | 窗口开始比赛（AoX 专用，Dedup 规则 2 用此列）|
| Competition | `competition` | 比赛名 |
| Days | `days` | 保持天数（Dedup 规则 1：== '0' 时过滤）|
| Person | `person` | 选手名（含 Markdown 链接格式 `[text](url)`）|
| Improvement | `improvement` | 进步百分比 |
| Count | `count` | 次数（WR Dominance 专用 y 轴）|

## 注意事项

- React 版从 JSON 读数据，Legacy 从 SQL 实时生成 HTML。JSON 数据本身通过 `stats-build` TS 脚本生成，与 Ruby 结果应该 1:1 一致（若数据不一致是 stats-build 的 bug）。
- 单元格可能含 Markdown 链接 `[text](url)`，`renderCell()` 函数负责解析渲染为 `<a>` 标签。
- 国旗通过 `countryFlagClass()` → `fi fi-xx` CSS 类渲染（flag-icons 库）。
- `WrHistoryChart` 的数据点通过 `extractPoints()` 从表格 rows 提取，`header` 的 key 决定列解析。
