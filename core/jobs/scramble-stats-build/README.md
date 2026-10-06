# @cuberoot/scramble-stats-build

把分析器产出的 7 份变体 CSV(std/eo/pair/pseudo/pseudo_pair/f2leo/pseudo_f2leo)聚合成 `stats/scramble/distribution.json`,供前端 `/scramble/stats` 页面使用(缺失的变体 CSV 会被跳过并打 `[skip]` 警告,不抛错)。

> 日常一键入口 `pnpm stats:scramble` 使用 TypeScript 编排；统计成功后自动灌线上 PG、上传 static，并提交推送统计文件。`pnpm stats:scramble:local` 只生成本地产物。

## 用法

在 Mac 或 Windows 上安装 Node/pnpm、Rust 后，从仓库的 `core/` 运行同一条命令。入口按仓库位置查找 `solver/`，默认在仓库同级的 `scramble/` 查找原始数据。首次运行会生成忽略版本管理的 `config.yml`；已有自定义配置会保留。

可用 `CUBEROOT_DATA_ROOT` 改整个数据根，或分别用 `CUBEROOT_WCA_DATA_DIR`、`CUBEROOT_PUZZLE_DATA_DIR`、`CUBEROOT_XCROSS_DATA_DIR` 指定目录。`CUBE_TABLE_DIR` 可指定求解器表目录。Rust 分析器按系统选择无后缀文件或 `.exe`。

一键运行全部统计并自动发布：

```sh
pnpm stats:scramble
```

只运行三阶阶段统计并发布：`pnpm stats:scramble --jobs stages`。只生成本地文件：`pnpm stats:scramble:local`。先检查计划：`pnpm stats:scramble:local --plan`。可用 `--jobs 333opt`、`--jobs puzzles --puzzles sq1`、`--use-cached`、`--variants eo,pseudo`、`--max-chunks 1`。这些入口不需要 `pwsh`。

从表生成到全部统计的一键本地运行（首次可能耗时很长）：

```sh
pnpm exec tsx ../solver/scripts/generate_and_build_stats.mts
```

它调用 Rust `table_generator`，所有表完成后自动运行 TypeScript 本地统计入口；`solver/tables/local-pipeline-run-*.json`、`generation-times.csv`、`stats-pipeline-times.csv` 自动记录各阶段与逐表耗时。若表生成失败或达到 57 GiB H10 警戒线，统计步骤不会启动。

独立执行聚合前，在本目录运行 `node prepare_config.mjs`，再从 `core/` 执行 `pnpm --filter @cuberoot/scramble-stats-build build`。原始数据和分析器仍须先准备好。

`config.yml` 是 `sets:` 数组,每项一个数据集(`key` + `csv_dir` + `scrambles_txt`);UI 上 dropdown 切换。
输入:每个 set 的 `<csv_dir>/{std,eo,pair,pseudo,pseudo_pair,f2leo,pseudo_f2leo}.csv`
输出:`<repo-root>/stats/scramble/distribution.json`(+ `examples.json` + per-bin `downloads/` txt)

## 产出 schema

### 无连色（No Bar）

`pnpm --filter @cuberoot/scramble-stats-build build:no-bar` 全量扫描本地
`wca_scramble/incremental/tsv/Scrambles.tsv`，写入 `stats/scramble/no_bar.json`。
日常入口在 `stages` 或包含二阶的 `puzzles` 作业之后自动运行；即使阶段 CSV 没有新增，也会运行。
`--source-csv` 是增量夹具输入，不视为完整 WCA 导出，不触发此报表。产物随既有 static/Git 统计发布流程发布。

判定：六个面上所有共边相邻贴纸均不同色，三阶包含中心与棱块，忽略对角相邻。
二阶直接复用 `cube222StateFlagsOfScramble().nobar`，三阶复用共享打乱归一化及 NxN 状态模型。
宽层转动保留实际状态变化，最少步前后缀不剥除。覆盖 `333/333oh/333bf/333mbf/333fm/333ft/333mbo`，
多盲一颗一条，包含备打；按原始记录计数，不按打乱字符串或状态去重。
输入无效或 ID 重复即失败，不静默漏算。完整扫描成功后原子替换 JSON。

报表保留导出日期、各项目分母和命中数、全部三阶命中的原始打乱与比赛/轮次/组/序号/备打/多盲颗数。
二阶命中较多，只保留源文件顺序的前 12 条预览，完整计数不截断。
`/scramble/stats` 的二阶和三阶类项目显示「无连色」展开区；三阶类合并显示整个家族及逐项目数量。
导出中无记录的旧多盲单独记为 0，不假定覆盖导出之前所有 WCA 历史打乱。

2026-10-04 导出首次全量：三阶类 1,356,631 条 / 命中 8 条（333=6、333oh=1、333mbf=1）；
二阶 454,897 条 / 命中 19,053 条。频率是实测值，不代表理论概率。
数值回放检查：`pnpm --filter @cuberoot/scramble-stats-build exec vitest run tests/no_bar.test.ts`。

### 阶段分布

```jsonc
{
  "meta": {
    "generated_at": "2026-05-30",
    "subset_keys": ["B","G","O","R","W","Y","WY","BG","OR","BGOR","ORWY","BGWY","BGORWY"]
  },
  "sets": {
    "wca": {
      "label": "WCA", "label_zh": "WCA", "sample_count": 1289663,
      "variants": {
        "std": {
          "sample_count": 1289663,
          "stages": ["cross", "xcross", "xxcross", "xxxcross", "xxxxcross"],
          "data": {
            "cross": {
              "B":      { "min": 0, "max": 8, "counts": { "0": 5, "1": 91, /* ... */ }, "example_bins": [0, 1, 8] },
              // ...其余 12 个 subset key (单色 / 相反对 / 四色 / 全色)
              "BGORWY": { "min": 0, "max": 6, "counts": { /* ... */ }, "example_bins": [0, 1] }
            }
            // ...其余 stage (xcross / xxcross / ...)
          }
        }
        // eo / pair / pseudo / pseudo_pair / f2leo / pseudo_f2leo 同构 (阶段数不同)
      }
    }
    // 其余 set (如 xcross_2_col_10f) 同构
  }
}
```

- 顶层 **`sets`** 支持多数据集(WCA 历史 + state-based 合成集),非单层 `variants`。
- **subset key** = 按字母序拼的颜色字母串(B<G<O<R<W<Y),共 13 个:6 单色(`B G O R W Y`)+ 3 相反对(`WY BG OR`)+ 3 四色(`BGOR ORWY BGWY`)+ 1 全色(`BGORWY`)。每个 = 对该颜色集合逐行取 min 步数的直方图(`counts` 是步数→条数)。`example_bins` = 选若干 bin 进 `examples.json` / 下载 txt。
- 朝向→颜色映射见 `src/build.ts` `ANGLE_COLOR_STD`(z0=Y z1=R z2=W z3=O x1=B x3=G);UI 只显颜色名,不暴露 z0/z1/x1。

每次 CSV 更新后重跑 build；日常从 `core/` 运行 `pnpm stats:scramble` 完成全流程并自动发布。只在本地计算时用 `pnpm stats:scramble:local`。

已有本地产物需要补发布时运行 `pnpm stats:scramble --publish-only`，会灌线上 PG、上传 static 并推送统计文件，不重复计算。底层入口 `pnpm stats:scramble:publish --publish` 可只灌 PG 和上传 static；加 `--push` 才包含 Git 推送。静态清单的只读差异预览：`pnpm exec tsx ../scripts/stats/publish-static.ts --dry-run`。
