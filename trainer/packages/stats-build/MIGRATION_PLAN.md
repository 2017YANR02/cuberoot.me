# Stats Ruby → TypeScript 迁移文档（AI 交接用）

> **本文档是面向下一个 AI 的完整移交文档。包含项目上下文、已完成进度、剩余任务和关键约束。**
> **更新时间**：2025-03-25

## 一、背景与现状

### 1.1 项目概述

本项目（[ruiminyan.github.io](https://ruiminyan.github.io)）是一个 Jekyll 静态站 + React SPA 的混合架构。WCA 统计模块由 **88 个 Ruby 脚本** 生成 Markdown，再由 Jekyll 渲染为 HTML。

**最终目标**：用 TypeScript 完全替代 Ruby — TS 直连 MySQL 生成 JSON，React 渲染页面，Ruby 退役。

### 1.2 当前架构

```
┌── Ruby 管线（legacy，CI 已移除）─────────────────────────┐
│  _stats_build/statistics/*.rb (88 个)                       │
│      ↓ SQL → Markdown → Jekyll → GitHub Pages               │
└─────────────────────────────────────────────────────────────┘

┌── TS 管线（✅ 全部完成，CI 已接入）─────────────────────┐
│  stats-build/src/bin/update_database.ts  ← 下载+导入 DB     │
│  stats-build/src/statistics/*.ts (88 个)                     │
│      ↓ SQL → JSON → React SPA（4 种渲染模式）               │
│  /app/wca-stats/ (索引) + /app/wca-stats/:statId (详情)     │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 数据库

- 凭据在 `_stats_build/database.yml`（不在 git 中）
- 核心表：`results`、`persons`、`competitions`、`round_types`
- Schema 见 `_stats_build/SCHEMA.md`

---

## 二、已完成进度（✅ 88/88 统计 + 内存优化）

### 2.1 基础架构（全部完成）

| 组件 | 文件 | 说明 |
|------|------|------|
| MySQL 连接 | `src/core/database.ts` | mysql2 连接池，配置从 `_stats_build/database.yml` 读取 |
| Statistic 基类 | `src/core/statistic.ts` | 抽象类：`query()` → SQL → `transform()` → `toJson()` |
| GroupedStatistic 基类 | `src/core/grouped_statistic.ts` | 按 WCA 项目分组，输出 `sections` |
| RoundMetric 基类 | `src/core/round_metric.ts` | 双视图 `panels`（ranking + history），支持 batch/non-batch 排名 |
| AoRounds 基类 | `src/core/ao_rounds.ts` | 跨轮次 average-of-averages，逐 event 查询 |
| AverageOfX 基类 | `src/core/average_of_x.ts` | 滑动窗口裁剪均值（trimmed mean） |
| Rankings 基类 | `src/core/rankings.ts` | 年度排名 |
| SolveTime 工具 | `src/core/solve_time.ts` | WCA 成绩值格式化（厘秒/FMC/多盲） |
| 项目映射 | `src/core/events.ts` | WCA 项目 ID → 中英文名 + 表头翻译 |
| CLI 入口 | `src/bin/compute.ts` | 单统计计算 + REGISTRY 注册表 |
| 批量执行 | `src/bin/compute_all.ts` | 串行 88 统计 + GC + STATS_FILTER |
| 数据库导入 | `src/bin/update_database.ts` | fetch + readline + mysql CLI 导入 |
| WR ID / 索引 | `src/bin/gen_wr_ids.ts` / `compute_index.ts` | 从 JSON 生成（无需 MySQL） |
| 验证脚本 | `src/bin/validate.ts` | Ruby MD vs TS JSON 自动对比 |
| React 页面 | `WcaStatsPage.tsx` / `WcaStatsIndex.tsx` | 4 种渲染模式 + 6 分类索引页 |

### 2.2 内存管理（✅ 已与 Ruby 对齐）

TS 版照搬了 Ruby `compute_all.rb` 的三层内存保护机制：

| 层次 | Ruby 模式 | TS 实现 | 文件 |
|------|-----------|---------|------|
| 执行层 | `instance_variable_set(iv, nil)` + `GC.start` | `stat = null` + `json = null` + `global.gc()` | `compute.ts` |
| 基类 toJson | `@query_results` 通过执行层释放 | `rawRows = null` + `global.gc()` 在 transform 后 | `statistic.ts`/`grouped_statistic.ts`/`round_metric.ts`/`average_of_x.ts` |
| 聚合子统计 | 执行层统一释放 | `inst = null` + `global.gc()` 每个子统计后 | `wr_metric.ts`/`wr_aoxr.ts`/`average_of.ts` |
| 逐 event 查询 | `rows = nil` 或 block 局部 | `const` block-scoped 自动释放 / 显式 `rows = null` | `wr_dominance.ts`/`wr_non_pr.ts`/`ao_rounds.ts` |
| 独立大查询 | 执行层释放 | `rawRows = null` + `gc()` | `consecutive_sub_5_average.ts`/`mbf_average.ts`/`best_round.ts` |

**运行环境要求**：`NODE_OPTIONS='--expose-gc --max-old-space-size=6144'`

### 2.3 JSON Schema

```typescript
// 三种输出模式共存
interface StatJson {
  id: string;
  title: string;
  titleZh: string;
  note?: string;
  noteZh?: string;
  header: Array<{ key: string; label: string; labelZh: string; align: Alignment }>;
  rows?: unknown[][];       // 模式 1：Statistic
  sections?: StatSection[]; // 模式 2：GroupedStatistic
  panels?: StatPanel[];     // 模式 3：RoundMetric/AoRounds/AverageOfX — 单级双视图
  metricPanels?: MetricPanel[]; // 模式 4：聚合页面 — 多级面板
}
```

### 2.4 已完成的 88 个统计

| 阶段 | 类型 | 数量 | 基类 |
|------|------|------|------|
| A-1 | 纯 SQL | 18 | `Statistic` |
| A-2 | SQL + transform | 20 | `Statistic` |
| B | 分组统计 | 17 | `GroupedStatistic` |
| C-1 | 轮次指标 | 13 | `RoundMetric` |
| C-2 | 跨轮次均值 | 4 | `AoRounds` |
| C-3 | X 次均值 | 7 | `AverageOfX` |
| D-1 | 特殊统计 | 4 | 混合（`wr_newcomer`/`consecutive_sub_5_average`/`mbf_average`/`yearly_rankings`） |
| D-2 | StatPanel 双视图 | 2 | `Statistic`（`wr_non_pr`/`wr_dominance`） |
| D-3 | 聚合页面 | 3 | `Statistic`（`wr_metric`/`wr_aoxr`/`average_of`） |
| **合计** | | **88** | |

---

## 三、✅ 全部完成

### 3.1 CLI 工具（✅ 全部完成）

| 工具 | Ruby 版 | TS 版 | 说明 |
|------|---------|-------|------|
| **数据库导入** | `bin/update_database.rb` | ✅ `src/bin/update_database.ts` | fetch + readline 解析 SQL dump + mysql CLI 导入 |
| **批量执行** | `bin/compute_all.rb` | ✅ `src/bin/compute_all.ts` | 串行执行 + GC，PRIORITY_STATS/ALL_MERGED/HEAVY_STATS/STATS_FILTER |
| **WR ID JSON** | `bin/gen_wr_ids.rb` | ✅ `src/bin/gen_wr_ids.ts` | 读取 wr_metric.json 提取 top2 WCA ID + centiseconds（无需 MySQL） |
| **索引页** | `bin/compute_index.rb` | ✅ `src/bin/compute_index.ts` | 6 分类 63 统计 JSON（无需 MySQL） |
| **CI workflow** | `.github/workflows/stats.yml` | ✅ 已完全移除 Ruby | Node.js 22 + pnpm + tsx |

### 3.2 前端（✅ 全部完成）

| 页面 | 说明 | 当前状态 |
|------|------|---------|
| `WcaStatsPage.tsx` | 支持 `rows`/`sections`/`panels`/`metricPanels` 4 种模式 | ✅ |
| `WcaStatsIndex.tsx` | 索引页（6 分类卡片网格） | ✅ |
| 路由 `/wca-stats` | 索引页路由 | ✅ |

### 3.3 验证工作

- `validate.ts` 已完成基本验证（88/88 通过），差异仅限于数据时差和 SQL 并列排序不确定性
- 建议在同一数据库快照下运行 Ruby 和 TS 进行 1:1 最终对比

---

## 四、关键文件快速索引

### 4.1 TS 核心文件

| 用途 | 路径 |
|------|------|
| **6 个基类** | `src/core/statistic.ts` / `grouped_statistic.ts` / `round_metric.ts` / `ao_rounds.ts` / `average_of_x.ts` / `rankings.ts` |
| **SolveTime 工具** | `src/core/solve_time.ts` |
| **数据库连接** | `src/core/database.ts` |
| **项目映射+翻译** | `src/core/events.ts` |
| **CLI + REGISTRY** | `src/bin/compute.ts`（88 条注册） |
| **批量执行** | `src/bin/compute_all.ts` |
| **数据库导入** | `src/bin/update_database.ts` |
| **WR ID / 索引** | `src/bin/gen_wr_ids.ts` / `compute_index.ts` |
| **验证脚本** | `src/bin/validate.ts` |
| **88 个统计** | `src/statistics/*.ts` |
| **批量测试** | `run_all_tests.ps1` |

### 4.2 Ruby 参考文件（只读）

| 用途 | 路径 |
|------|------|
| **Ruby 统计源码** | `_stats_build/statistics/*.rb` |
| **Ruby 基类** | `_stats_build/core/*.rb` + `_stats_build/statistics/abstract/*.rb` |
| **CI 工作流** | `.github/workflows/stats.yml` |
| **数据库凭据** | `_stats_build/database.yml`（不在 git 中） |

### 4.3 events.ts 关键常量

| 常量 | 说明 |
|------|------|
| `EVENTS` | 全部 WCA 项目 ID → 英文名 |
| `EVENTS_ENTRIES` | **必须用此遍历**（固定顺序，禁止直接遍历 EVENTS 对象） |
| `EVENTS_WITH_AVERAGE` | 排除 333mbf/333mbo |
| `EVENTS_WITH_AO5` | 排除 Mo3 项目 |
| `OFFICIAL_EVENTS` | 排除退役项目 |
| `BLD_EVENTS` | 盲拧项目 |
| `HEADER_ZH` | 表头英→中翻译 |
| `NAMES_ZH` | 项目名英→中翻译 |

---

## 五、关键约束

1. **Ruby 代码零修改**：所有 `.rb` 文件只读参考
2. **SQL 逻辑零改动**：TS 版的 SQL 必须与 Ruby 完全一致
3. **遍历顺序**：必须用 `EVENTS_ENTRIES` 遍历项目，禁止直接遍历 `EVENTS` 对象（JS 对象键序不确定）
4. **内存管理**：任何新增的 `toJson()` 覆写，如果涉及大量数据，必须在 transform 后 `rawRows = null; if (global.gc) global.gc();`
5. **运行环境**：`NODE_OPTIONS='--expose-gc --max-old-space-size=6144'`
6. **i18n 双语**：标题、描述、列名都需要中英文
7. **新表头翻译**：在 `events.ts` 的 `HEADER_ZH` 添加
8. **新统计注册**：在 `compute.ts` 的 `REGISTRY` 中注册
9. **编译检查**：每批完成后 `npx tsc --noEmit`
10. **增量提交**：每完成一批就 `git commit`（全英文 commit message）

---

## 六、快速上手命令

```powershell
# 进入工作目录
cd d:\cube\ruiminyan.github.io\trainer\packages\stats-build

# TypeScript 编译检查
npx tsc --noEmit

# 批量执行所有统计（串行 + GC）
$env:NODE_OPTIONS='--expose-gc --max-old-space-size=6144'
npx tsx src/bin/compute_all.ts

# 生成单个统计 JSON
npx tsx src/bin/compute.ts world_championship_podiums_by_person

# 查看所有已注册的统计
npx tsx src/bin/compute.ts

# 生成 WR ID + 索引（依赖 compute_all 输出）
npx tsx src/bin/gen_wr_ids.ts
npx tsx src/bin/compute_index.ts

# 批量测试（需要 MySQL 运行）
.\run_all_tests.ps1

# 启动前端（在 trainer 根目录）
cd d:\cube\ruiminyan.github.io\trainer
pnpm --filter @cuberoot/client dev
# → http://localhost:5173/app/wca-stats/       (索引页)
# → http://localhost:5173/app/wca-stats/<statId> (详情页)
```

---

## 七、已知技术陷阱

1. **RowDataPacket spread 陷阱**：`{ ...row }` 会丢失 mysql2 的 index signature。用显式字段映射代替
2. **333mbf 排序**：多盲成绩用 `SolveTime.points` 降序排列，非 `wca_value` 升序
3. **RoundMetric 两步 SQL**：`batchRanking() = false` 的子类使用 `result_attempts` 表子查询
4. **ATTEMPTS_SUBQUERY**：在 `database.ts` 中定义，SQL 中用 `${ATTEMPTS_SUBQUERY} AS attempts`
5. **JS 对象键序**：直接 `for...in` 遍历 EVENTS 对象会导致数字 key 排前面，破坏 Section 顺序
6. **Windows 编码**：含中文注释的文件禁止用 `replace_file_content` 做全文替换

---

## 八、改写模式速查

### 模式 1：纯 SQL（Statistic）
```typescript
import { Statistic } from '../core/statistic.js';
export class XxxStat extends Statistic {
  constructor() { super(); this.title = '...'; this.titleZh = '...'; this.tableHeader = {...}; }
  query() { return `SELECT ... FROM ...`; }
}
```

### 模式 2：SQL + transform（Statistic）
```typescript
export class XxxStat extends Statistic {
  constructor() { super(); /* ... */ }
  query() { return `SELECT ...`; }
  transform(rows: RowDataPacket[]) { return rows.map(r => [...]); }
}
```

### 模式 3：分组统计（GroupedStatistic）
```typescript
import { GroupedStatistic } from '../core/grouped_statistic.js';
export class XxxStat extends GroupedStatistic {
  constructor() { super(); /* ... */ }
  query() { return `SELECT event_id, ...`; }
  transform(rows: RowDataPacket[]) {
    return EVENTS_ENTRIES.map(([eid, ename]) => {
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
  constructor() { super(); this.title = '...'; this.titleZh = '...'; }
  computeMetric(values: number[], row: RowDataPacket): number | null { return ...; }
}
```

### 模式 5：AoRounds 子类
```typescript
import { AoRounds } from '../core/ao_rounds.js';
export class WrAoXr extends AoRounds {
  constructor() { super(); this.title = '...'; }
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
