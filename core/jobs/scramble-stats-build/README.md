# @cuberoot/scramble-stats-build

把分析器产出的 7 份变体 CSV(std/eo/pair/pseudo/pseudo_pair/f2leo/pseudo_f2leo)聚合成 `stats/scramble/distribution.json`,供前端 `/scramble/stats` 页面使用(缺失的变体 CSV 会被跳过并打 `[skip]` 警告,不抛错)。

> 增量刷新 + 发布的完整管道(取数→解算→追加→重算→commit/push/scp)见 `RUNBOOK.md` 与 `update_cross_stats.ps1`;本 README 只讲 `build` 这一聚合步。

## 用法

```powershell
# 1. 复制配置,指向本地 CSV 所在目录
cp config.yml.example config.yml
# 编辑 config.yml 里的 sets[].csv_dir / scrambles_txt

# 2. 跑 build
pnpm --filter @cuberoot/scramble-stats-build build
```

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

每次 CSV 更新后重跑 build 再 commit JSON(或直接走 `update_cross_stats.ps1` 全流程)。
