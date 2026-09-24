# @cuberoot/scramble-stats-build

把分析器产出的 7 份变体 CSV(std/eo/pair/pseudo/pseudo_pair/f2leo/pseudo_f2leo)聚合成 `stats/scramble/distribution.json`,供前端 `/scramble/stats` 页面使用(缺失的变体 CSV 会被跳过并打 `[skip]` 警告,不抛错)。

> 本地增量刷新统一使用 TypeScript 一键入口 `scripts/stats/update-local.ts`；本地入口不会 commit、push、scp 或写线上 PG。显式发布入口是 `scripts/stats/update-published.ts`，须遵守仓库发布授权。

## 用法

在 Mac 或 Windows 上安装 Node/pnpm、Rust 后，从仓库的 `core/` 运行同一条命令。入口按仓库位置查找 `solver/`，默认在仓库同级的 `scramble/` 查找原始数据。首次运行会生成忽略版本管理的 `config.yml`；已有自定义配置会保留。

可用 `CUBEROOT_DATA_ROOT` 改整个数据根，或分别用 `CUBEROOT_WCA_DATA_DIR`、`CUBEROOT_PUZZLE_DATA_DIR`、`CUBEROOT_XCROSS_DATA_DIR` 指定目录。`CUBE_TABLE_DIR` 可指定求解器表目录。Rust 分析器按系统选择无后缀文件或 `.exe`。

一键运行全部本地统计：

```sh
pnpm stats:scramble:local
```

只运行三阶阶段统计：`pnpm stats:scramble:local --jobs stages`。先检查计划：`pnpm stats:scramble:local --plan`。可用 `--jobs 333opt`、`--jobs puzzles --puzzles sq1`、`--use-cached`、`--variants eo,pseudo`、`--max-chunks 1`。入口始终只写本地，不需要 `pwsh`。

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

每次 CSV 更新后重跑 build，或从 `core/` 运行 `pnpm stats:scramble:local` 完成本地全流程。发布须另行授权。

需要发布时，获得当次发布授权后从 `core/` 运行 `pnpm stats:scramble:publish --publish`。它先跑同一套本地计算，再上传静态文件和增量灌库；加 `--publish-only` 仅发布已有本地产物。需要同步 Git 再加 `--push`，否则不提交或推送。`--publish` 是必需的显式保护开关。静态清单的只读差异预览：`pnpm exec tsx ../scripts/stats/publish-static.ts --dry-run`。
