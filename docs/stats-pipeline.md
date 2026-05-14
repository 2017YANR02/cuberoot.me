# WCA 统计数据管道

## 概览

88 项 WCA 统计，每周日 19:00 UTC 由 CI 自动更新。

- **地址**：[cuberoot.me/stats/](https://cuberoot.me/stats/) · [www.cuberoot.me](https://www.cuberoot.me)
- **CI**：`.github/workflows/stats.yml`
- **耗时**：~47 分钟

## 本地发布（无需等待 CI）

```powershell
cd core/packages/stats-build
$env:NODE_OPTIONS='--expose-gc --max-old-space-size=6144'

# 单个/多个统计
$env:STATS_FILTER='wr_bao5,average_of'
npx tsx src/bin/compute_all.ts

# 提交
git add ../../stats/
git commit -m "chore: update stats"
git pull --rebase origin main   # ⚠️ CI 可能在后台推了 commit
git push
```

## 计算架构

88 个统计串行执行（`core/packages/stats-build/src/bin/compute_all.ts`）：

| 类别 | 数量 | 说明 |
|------|------|------|
| Phase 1 聚合 | 3 | `wr_metric`/`wr_aoxr`/`average_of`，含子统计，完成后 GC |
| Phase 2 重量级 | 11 | RSS > 3GB，每个计算后强制 `global.gc()` |
| Phase 3 轻量级 | 74 | 串行执行，定期 GC |

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
// core/packages/stats-build/src/statistics/my_new_stat.ts
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
3. 类型检查：`npx tsc --noEmit`
4. 生成：`npx tsx src/bin/compute.ts my_new_stat`
5. 输出：`stats/my_new_stat.json`，React 前端 `/wca-stats/my_new_stat` 渲染

## 近期比赛追踪

追踪 434 名顶尖选手的近期 WCA 比赛。

```powershell
python scripts/fetch_upcoming_comps.py          # 使用缓存（~5 秒）
python scripts/fetch_upcoming_comps.py --refresh  # 强制刷新（~15 分钟）
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

`scripts/fetch_comp_names_zh.py` 生成 `comp_names_zh.json`，CI 每天凌晨 4:00 自动更新。
