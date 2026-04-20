---
name: stats-build
description: "Use when regenerating WCA statistics JSONs under `stats/data/` — 80+ SQL-driven stats (average_of, wr_metric, world_records_by_country, longest_streak_*, etc.). Covers compute.ts CLI, memory flags, registry, adding new stats, StatJson schema. Triggers: \"stats-build\", \"compute.ts\", \"wr_metric\", \"重跑 stats\", \"new stat\", \"Statistic 基类\"."
---

# Stats Build

WCA 统计数据生成管道：`core/packages/stats-build/` —— 基于 `jonatanklosko/wca_statistics` 的 TypeScript 重写。

## 本地运行

```pwsh
cd core/packages/stats-build
$env:NODE_OPTIONS='--expose-gc --max-old-space-size=6144'
npx tsx src/bin/compute.ts <stat_name>     # 单个统计
npx tsx src/bin/compute_all.ts             # 全量（~30min，会很耗内存）
```

- 需要本地 MySQL（`database.yml`）—— 导入 WCA 数据库 dump
- `--expose-gc` 让基类里的显式 `global.gc()` 生效，避免 OOM

## 注册表

在 `src/bin/compute.ts` 的 `REGISTRY` 里手动加新统计：
```ts
'my_new_stat': () => import('../statistics/my_new_stat.js'),
```

对应文件放 `src/statistics/my_new_stat.ts`，导出一个继承 `Statistic` / `GroupedStatistic` / `RoundMetric` 等基类的 class。

## Statistic 基类

`src/core/statistic.ts`：
- 子类实现 `query()` 返回 SQL 字符串
- 基类 `toJson()` 执行查询并按 `tableHeader` 构造 `{header, rows}` 输出
- 复杂结构可覆盖 `toJson()`（如 `world_records_by_country.ts` 加了 `years` + `cumulative`）

`StatJson` interface（已有的可选字段）：`rows` / `sections` / `panels` / `metricPanels`，时间序列数据用 `years` + `cumulative`。

## CI 自动刷新

`.github/workflows/stats.yml` 每周日 20:00 UTC 跑 `compute_all.ts`，commit `stats/data/*.json`。**手动改生成出的 stats 数据**（如 `wr_metric.json`）会被 CI 覆盖 —— 有需要改的是 SQL 或 transform 逻辑。

## 验证新 stat

1. 本地跑 `npx tsx src/bin/compute.ts <stat_name>` 检查输出 JSON 结构
2. 对照已知数据校验（如 `world_records_by_country.json` 末年 cumulative 值应等于原 rows 总数）
3. 前端消费代码（通常在 `WcaStatsPage` 或自定义页面）添加支持
