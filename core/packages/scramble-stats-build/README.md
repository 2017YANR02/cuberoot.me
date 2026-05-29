# @cuberoot/scramble-stats-build

把 `D:\cube\solver` 的 7 个分析器产物 CSV 聚合成 `stats/scramble/distribution.json`，供前端 `/scramble-stats` 页面使用（缺失的变体 CSV 会被跳过）。

## 用法

```powershell
# 1. 复制配置，指向本地 CSV 所在目录
cp config.yml.example config.yml
# 编辑 config.yml 里的 csv_dir

# 2. 跑 build
pnpm --filter @cuberoot/scramble-stats-build build
```

输入：`<csv_dir>/{std,eo,pair,pseudo,pseudo_pair,f2leo,pseudo_f2leo}.csv`（缺失的变体 CSV 会被跳过并打警告，不再抛错）
输出：`<repo-root>/stats/scramble/distribution.json`

## 产出 schema

```jsonc
{
  "meta": { "sample_count": 1199999, "generated_at": "...", "source": "..." },
  "variants": {
    "std": {
      "stages": ["cross", "xcross", ...],
      "angles": ["z0", "z1", "z2", "z3", "x1", "x3"],
      "data": {
        "cross": {
          "z0": { "min": 2, "max": 8, "counts": {"2": 12, ...} },
          // ...5 其他朝向
          "min_across": { "min": 1, "max": 7, "counts": {...} }
        }
      }
    },
    // pair/eo/pseudo/pseudo_pair 类似
  }
}
```

`min_across` = 同一 stage 下 6 个朝向逐行取 min 后的分布（约等于 color-neutral 选手体验）。

每次 CSV 更新后手动重跑 build 再 commit JSON。
