---
name: stats-build
description: "Use when regenerating WCA statistics JSONs under `stats/` — 80+ SQL-driven stats (average_of, wr_metric, world_records_by_country, longest_streak_*, etc.). Covers compute.ts CLI, memory flags, registry, adding new stats, StatJson schema. Triggers: \"stats-build\", \"compute.ts\", \"wr_metric\", \"重跑 stats\", \"new stat\", \"Statistic 基类\"."
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

### 本地 DB 已配置（不要假设缺）

本机已装 MySQL 8 并导入 WCA dump，**默认就能跑**：
- MySQL 数据目录：`E:\mysql_data\wca_statistics\`（database = `wca_statistics`）
- 监听：`127.0.0.1:3306`
- 凭据文件：`packages/stats-build/database.yml`（已 .gitignore，本机有）
- `--expose-gc` 让基类里的显式 `global.gc()` 生效，避免 OOM

跑不通先按以下顺序自查（**pwsh 命令，不是 bash**）：
```pwsh
ls packages/stats-build/database.yml          # 凭据文件在不在
netstat -an | Select-String ':3306'           # MySQL 在听吗
Get-Service | Where-Object Name -match mysql  # 服务状态
```
全 OK 还连不上才向用户求助。**绝不能因一次"找不到"就下结论"用户没装 DB"**。

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
- 复杂结构覆盖 `toJson()`（如 `world_records_by_country.ts` 加 `years` + `cumulative`）
- `transform` 同步——要副查询 override `async toJson()`：`dbQuery` → 存 instance → `super.toJson()`

## 前端 row 渲染

`WcaStatsPage.renderCell`：
- row 里 `null` 字面渲染成 "null"——别塞 null
- 想要中英差异显示（如 `"Still active"` → `"至今"`）：往 `wca_translations.ts` 的 `VALUE_ZH` 加映射
- `event` 列自动前置 `<EventIcon>`，SQL 直接输出 events.name 即可

## 已停办项目

`333ft / magic / mmagic / 333mbo`。"持续到现在"类 stat 的最后一段不能默认 endDate=today——查该项目最后一场比赛作终止点；现役还持续的用 `"Still active"` 哨兵字符串。否则 years 失真。

## CI 自动刷新

`.github/workflows/stats.yml` 每周日 20:00 UTC 跑 `compute_all.ts`，commit `stats/*.json`。**手动改生成出的 stats 数据**（如 `wr_metric.json`）会被 CI 覆盖 —— 有需要改的是 SQL 或 transform 逻辑。

**改 build 步骤顺序时，把动了的那步往前挪** —— 否则用户得等 30+ min 跑完无关的 64 stats 才看到改动那步报错。

## 验证新 stat

1. 本地跑 `npx tsx src/bin/compute.ts <stat_name>` 检查输出 JSON 结构
2. 对照已知数据校验（如 `world_records_by_country.json` 末年 cumulative 值应等于原 rows 总数）
3. 前端消费代码（通常在 `WcaStatsPage` 或自定义页面）添加支持

## SQL 校验（改 stat SQL 后必做）

`src/bin/validate_queries.ts` 对所有 stat 跑 `EXPLAIN`，几秒内捕获 SQL 语法错（MySQL 8 保留字如裸 `rank` / `event`、列名拼错、表名拼错）。CI 已自动在 `compute_all` 前跑一次。

**改任一 stat 的 `query()` 后必须本地跑一遍**，复制以下命令执行（CWD 是 `core/`，路径前缀不要再加 `core/`）：

```bash
pnpm --filter @cuberoot/stats-build run validate-queries
```

预期输出末尾 `Done: 78 passed, 0 failed, 10 skipped`（数字可能随注册表增减）。任何 `failed` 都必须先修，再 commit。

### 排查"跑不了"前必须先验证

本仓库**默认有本地 MySQL + WCA dump**，配置在 `packages/stats-build/database.yml`（已 .gitignore）。如果 validator 报连接错，按这个顺序核查，不要直接下结论"没 DB":

1. `ls packages/stats-build/database.yml` —— 看文件在不在（注意:CWD 是 `core/`，**不是** `core/packages/...`）
2. `netstat -an | Select-String ':3306'` —— 看 MySQL 是否在听（**pwsh,不是 bash 的 grep**）
3. 都有却连不上 —— 才向用户求助

### 真没 DB 的兜底

只在用户明确说没装 MySQL 时退到这条：push 后建议
```
gh workflow run stats.yml -f stats_filter=<changed_stat>
```
跑 1 个 stat（~10min）而不是全量（~47min）。Stat 名见 `src/bin/compute.ts` 的 `REGISTRY` keys。

**切忌只跑 typecheck 就 push 改动 SQL 的 stat** —— typecheck 看不见字符串里的 SQL。
