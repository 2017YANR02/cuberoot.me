---
name: scramble-stats-build
description: "Use when regenerating `stats/scramble/*.json` or touching `core/packages/scramble-stats-build/` / `core/packages/client/src/pages/scramble_stats/`. Covers CSV 列名、pair rotation 记号、WCA 配色、UI 朝向→底色。Triggers: \"scramble-stats-build\", \"distribution.json\", \"打乱分布\", \"scramble_stats\"."
---

# Scramble Stats Build

把 `D:\cube\solver` 产的 7 份 CSV 聚合成 `stats/scramble/distribution.json`,给 `/scramble-stats` 用。**支持多个 set**(WCA 历史 + state-based 数据集),UI 上 dropdown 切换。某个变体 CSV 缺失时**跳过**(打 `[skip] <key>: missing CSV ...` 警告,不再抛错),回填后再纳入。

## 跑

```pwsh
pnpm --filter @cuberoot/scramble-stats-build build
```

`config.yml` 是 `sets:` 数组,每项一个 csv_dir + scrambles_txt,例如:

```yaml
sets:
  - key: wca
    label: WCA
    csv_dir: D:/cube/scramble/wca_scramble/stats
    scrambles_txt: D:/cube/scramble/wca_scramble/wca_scrambles_no_wide_move.txt
  - key: xcross_2_col_10f
    label: 10-step XCross dual-color states
    label_zh: 双色底 XCross 10步状态
    csv_dir: D:/cube/scramble/xcross_2_col_10f/stat
    scrambles_txt: D:/cube/scramble/xcross_2_col_10f/scrambles.txt
```

CSV 数据全 gitignored(`D:/cube/scramble/`),几百 MB 永不进 git。`config.yml` 也 gitignored,只 commit `config.yml.example`。

## 数据来源约定

- `D:/cube/scramble/<set>/`:**所有打乱数据**(无论是 WCA 真实历史 or 由状态空间穷举/采样产生的合成 scramble),都放这里。每个 set 一个子目录,内含 `stat/` + `scrambles.txt`(+ 可选 `README.md`)。
- C++ analyzer 源码 / 二进制 / `state2scramble` 等中间工具留在 `D:/cube/solver/` 或 `D:/cube/solver_wip/`,**不**进数据目录

## CSV schema

| 文件 | id 列 | stages | angles |
|---|---|---|---|
| `std.csv` | `id` | `cross xcross xxcross xxxcross xxxxcross` | `z0 z2 z3 z1 x3 x1` |
| `eo.csv` | `id` | `eo_cross … eo_xxxxcross`（5 阶段） | 同上 |
| `pair.csv` | `id` | `cross_pair xcross_pair xxcross_pair xxxcross_pair`（4 阶段） | 同上 |
| `pseudo.csv` | `id` | `pseudo_cross … pseudo_xxxcross` | `z0,z2,z3,z1,x3,x1` |
| `pseudo_pair.csv` | `id` | `pseudo_cross_pseudo_pair …` | 同上 |
| `f2leo.csv` | `id` | `f2leo_cross f2leo_xcross f2leo_xxcross f2leo_xxxcross`（4 阶段,无 xxxxcross） | 同上 |
| `pseudo_f2leo.csv` | `id` | `pseudo_f2leo_cross pseudo_f2leo_xcross pseudo_f2leo_xxcross pseudo_f2leo_xxxcross`（4 阶段,无 xxxxcross） | 同上 |

列名 = `${stage}_${angle}`,**全部变体表头已统一**为 `id` + `_z0/_z2/_z3/_z1/_x3/_x1`(2026-05-29 把 pair 从老的 `scramble`+rotation 记号一并归一)。列**物理顺序**按 /solver UI 排(None / z2 / z' / z / x' / x),标签按 z^n / x^n 标准 cubing 记号(_z0=Y, _z2=W, _z3=O, _z1=R, _x3=G, _x1=B)。pair.csv 样本数比其他小(~112k vs 1.2M)是老快照残留,待回填。

## 朝向 = 底色（WCA 官方配色）

```
z0/''   黄 #FEFE00      z1/z    红 #EE0000      z2/z2   白 #555555（cream 底显示深灰）
z3/z'   橙 #FFA100      x1/x    蓝 #0000F2      x3/x'   绿 #00D800
```

**UI 绝不暴露 `z0/z1/x1`，只用颜色名（黄/红/白/橙/蓝/绿 或 Y/R/W/O/B/G）。**

## JSON 每 stage 产出

颜色子集直方图，key = **按字母序排好的颜色字母串**（B<G<O<R<W<Y）。共 13 个 key：

- size 1（6 个）：`B G O R W Y` —— single 模式 6 选 1
- size 2（3 个）：`WY BG OR` —— dual 模式只允许 3 对相反色
- size 4（3 个）：`BGOR ORWY BGWY` —— quad 模式排除一对相反色
- size 6（1 个）：`BGORWY` —— cn 全中立

每个直方图 = 逐行对选中颜色集合取 min 步数的计数分布。

## 关键文件

- 聚合：`core/packages/scramble-stats-build/src/build.ts`（`VARIANTS` + `angleToColor` 映射；`SUBSET_KEYS` = sizes 1/2/4/6）
- 页：`core/packages/client/app/[lang]/scramble/stats/page.tsx`（`COLOR_LETTERS` / `COLOR_HEX` / `DUAL_PAIRS` 在这里）
- 图：`core/packages/client/app/[lang]/scramble/stats/_components/DiscreteHistogram.tsx`（自写的离散整数 SVG，**不要**改用 `components/wca-stats/DistributionChart.tsx`）
- 样式：对齐 `landing.css` 的 Claude 浅色系；`wca_stats.css` 的暗棕**不要污染**
