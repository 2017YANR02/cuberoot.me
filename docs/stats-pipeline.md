# WCA 统计数据管道

## 概览

WCA 统计由 `.github/workflows/stats.yml` 每天 20:00 UTC 定时更新，也可手动触发；push 统计源码只运行语法检查。

- **地址**：[cuberoot.me/stats/](https://cuberoot.me/stats/) · [www.cuberoot.me](https://www.cuberoot.me)
- **CI**：`.github/workflows/stats.yml`
- **运行范围**：以 `core/jobs/stats-build/src/bin/compute.ts` 的 `REGISTRY` 与 workflow 为准

## 本地计算

从仓库的 `core/` 目录运行；数据库连接按 `core/jobs/stats-build/src/core/database.ts` 配置：

```sh
pnpm --filter @cuberoot/stats-build compute wr_metric
pnpm --filter @cuberoot/stats-build compute:all
```

只跑多个聚合 ID 时设置 `STATS_FILTER` 环境变量，值用逗号分隔；本地内存参数参考 `stats.yml` 的 `NODE_OPTIONS`。本地生成不自动提交、同步静态服务器或灌线上数据库。

## 线上更新

获得发布授权后在仓库根目录手动触发 `gh workflow run stats.yml -f pipeline=full`，并在 Actions 中确认 `Update Stats` 及其触发的 `Sync static toolkit` 成功。不要在统计 job 子目录执行旧的 `git add ../../stats/` 或对带未提交修改的工作区直接 `git pull --rebase`。

## 计算架构

统计由 `core/jobs/stats-build/src/bin/compute_all.ts` 按 registry 运行：

| 类别 | 说明 |
|------|------|
| Phase 1 聚合 | `wr_metric`/`wr_aoxr`/`average_of`，含子统计，完成后 GC |
| Phase 2 重量级 | 单项隔离运行，避免内存累积 |
| Phase 3 轻量级 | 串行执行，定期 GC |

### Phase 1 聚合统计

> 输入子统计 ID 到 `STATS_FILTER` 无效，需输入聚合 ID。

| 聚合 ID | 包含的子统计 |
|---------|-------------|
| `wr_metric` | `wr_single_history`, `wr_average_history`, `wr_bao5`, `wr_wao5`, `wr_mo5`, `wr_bpa`, `wr_wpa`, `wr_median`, `wr_best_counting`, `wr_worst_counting`, `wr_worst`, `wr_variance`, `wr_best_average_ratio` |
| `wr_aoxr` | `wr_ao1r` ~ `wr_ao4r` |
| `average_of` | `average_of_5` ~ `average_of_100` |

### 附加构建步骤

| 脚本 | 输出 | 用途 |
|------|------|------|
| `gen_wr_ids.ts` | `stats/wr_ids.json` | Calc 页面 WR 数据 |
| `compute_index.ts` | `stats/index.json` | 统计索引页 |

## 添加新统计（TypeScript）

```typescript
// core/jobs/stats-build/src/statistics/my_new_stat.ts
import { Statistic } from '../core/statistic.js';

export class MyNewStat extends Statistic {
  constructor() {
    super();
    this.title = 'My New Statistic';
    this.titleZh = '我的新统计';
    this.tableHeader = { 'Rank': 'right', 'Name': 'left' };
  }
  query(): string {
    return `SELECT ... FROM results ...`;
  }
}
```

1. 在 `src/bin/compute.ts` 的 `REGISTRY` 中注册
2. 新表头翻译加到 `src/core/events.ts` 的 `HEADER_ZH`
3. 从 `core/` 类型检查：`pnpm --filter @cuberoot/stats-build typecheck`
4. 从 `core/` 生成：`pnpm --filter @cuberoot/stats-build compute my_new_stat`
5. 输出：`stats/my_new_stat.json`，React 前端 `/wca/my_new_stat` 渲染

## 近期比赛追踪

追踪统计生成器选出的顶尖选手近期 WCA 比赛；实际人数记录在生成的 `upcoming_comps.json` 的 `total_cubers_tracked`，不在文档写固定人数。

从 `core/` 运行：

```sh
pnpm --filter @cuberoot/stats-build exec tsx src/bin/fetch_upcoming_comps.ts
pnpm --filter @cuberoot/stats-build exec tsx src/bin/fetch_upcoming_comps.ts --refresh
```

### 数据源

| 来源 | 用途 |
|------|------|
| WCA API | 全球比赛 + 选手注册 |
| cubing.com | 中国内地比赛（WCA API 不覆盖）|

### 缓存

- 目录：`.upcoming_cache/`（在 `.gitignore`）
- TTL：24 小时
- 输出：`stats/upcoming_comps.json`

### 中文比赛名

`core/jobs/stats-build/src/bin/fetch_comp_names_zh.ts` 生成 `comp_names_zh.json`；当前定时入口与触发时间以 `.github/workflows/update_upcoming.yml` 为准。
