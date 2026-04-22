---
name: scramble-stats-build
description: "Use when regenerating `stats/data/scramble/*.json` or touching `core/packages/scramble-stats-build/` / `core/packages/client/src/pages/scramble_stats/`. Covers CSV 列名、pair rotation 记号、WCA 配色、UI 朝向→底色。Triggers: \"scramble-stats-build\", \"distribution.json\", \"打乱分布\", \"scramble_stats\"."
---

# Scramble Stats Build

把 `D:\cube\solver` 产的 5 份 CSV 聚合成 `stats/data/scramble/distribution.json`，给 `/scramble-stats` 用。

## 跑

```pwsh
pnpm --filter @cuberoot/scramble-stats-build build
```

`config.yml` 指向 CSV 目录（默认 `D:/cube/scramble/wca_scramble/stat`，gitignored）。CSV 370MB 永不进 git。

## CSV schema

| 文件 | id 列 | stages | angles |
|---|---|---|---|
| `std.csv` | `id` | `cross xcross xxcross xxxcross f2l` | `z0 z1 z2 z3 x1 x3` |
| `eo.csv` | `id` | `eo_cross … eo_xxxxcross`（5 阶段） | 同上 |
| `pair.csv` | `scramble` | `crossp xcp xxcp xxxcp` | **`'' z2 z' z x' x`** ← 特殊 |
| `pseudo.csv` | `id` | `pseudo_cross … pseudo_xxxcross` | `z0..x3` |
| `pseudo_pair.csv` | `id` | `pseudo_cross_pseudo_pair …` | `z0..x3` |

列名 = `${stage}_${angle}`（pair 空 angle 产生 `crossp_` 裸下划线）。pair 样本数比其他小（~112k vs 1.2M）是正常。

## 朝向 = 底色（WCA 官方配色）

```
z0/''   黄 #FEFE00      z1/z    红 #EE0000      z2/z2   白 #555555（cream 底显示深灰）
z3/z'   橙 #FFA100      x1/x    蓝 #0000F2      x3/x'   绿 #00D800
```

**UI 绝不暴露 `z0/z1/x1`，只用颜色名（黄/红/白/橙/蓝/绿 或 Y/R/W/O/B/G）。**

## JSON 每 stage 产出

- 6 个 angle 直方图（原始 6 朝向）
- `min_across`：逐行取 6 朝向 min 后的直方图（全 CN）
- `min_wy`：逐行取黄+白两朝向 min 后的直方图（白黄双色 CN，速拧常用）

## 关键文件

- 聚合：`core/packages/scramble-stats-build/src/build.ts`（`VARIANTS` 数组）
- 页：`…/pages/scramble_stats/ScrambleStatsPage.tsx`（`ANGLE_FACE` 映射在这里）
- 图：`…/pages/scramble_stats/DiscreteHistogram.tsx`（自写的离散整数 SVG，**不要**改用 `wca_stats/DistributionChart.tsx`）
- 样式：对齐 `landing.css` 的 Claude 浅色系；`wca_stats.css` 的暗棕**不要污染**
