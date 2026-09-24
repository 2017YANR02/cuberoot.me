---
name: update-scramble-stats
description: "用户说更新打乱统计、更新十字/阶段难度、更新 puzzle 或 SQ1 分布、333 HTM/333opt、补 xcross、backfill_xcross_variant 或 pseudo_f2leo 回填时使用。执行 /scramble/stats 的本地增量管道；需具备 solver 和 H48 h10 等本地大表。"
---

# 更新打乱统计

日常一条龙在 `core/` 运行 `pnpm stats:scramble`。它默认跑 `stages,333opt,puzzles`，计算成功后自动灌线上 PG、上传 static，并提交推送统计文件；可用 `--jobs` 选子集。Mac、Windows 采用同一 TypeScript 命令，分析器继续用 Rust。明确只要本地产物时才运行 `pnpm stats:scramble:local`；`--plan` 用本地入口只读查看路径与作业。

```sh
cd core
pnpm stats:scramble
pnpm stats:scramble --jobs 333opt
pnpm stats:scramble --jobs stages,puzzles
pnpm stats:scramble --jobs puzzles --puzzles sq1
pnpm stats:scramble:local
pnpm stats:scramble:local --plan
```

用户运行日常一键命令或明确要求跑完自动发布时，按该次授权执行发布。已有本地产物只需发布时运行 `pnpm stats:scramble --publish-only`，不重复计算。底层 `stats:scramble:publish --publish` 仍可只灌 PG、传 static；它不推送 Git，需加 `--push` 才完整发布。发布失败时保持原 SHA1/PG manifest，供下次重试。只读静态差异预览在仓库根运行 `./core/node_modules/.bin/tsx scripts/stats/publish-static.ts --dry-run`，`--verify-all` 忽略哈希缓存重算。

| job | 内容 | 主要产物 |
| --- | --- | --- |
| `stages` | WCA 三阶标准阶段与变体按 ID 增量补缺 | `distribution.json`、`wca_cross`、`comp_steps*`、`difficulty_first_appearance*` |
| `333opt` | 原生 H48 h10 续解、333 注入、最优等价打乱 | `out.0.csv`、333 变体、`wca_optimal.csv` |
| `puzzles` | 222、pyraminx、skewb、clock、SQ1 精确双口径 | `puzzle_distribution.json`、`puzzle_examples.json`、`puzzle_first_appearance.json` |

`stages` 构建会重写分布和示例，故统计入口在它之后自动重注入 333。`puzzles` 会更新近期打乱、不同度量的 222/金字塔步数和 SQ1 WCA/slash 精确分布。非 WCA TIER C/D 离线采样默认停用，只有用户明确要求才用独立 `scripts/stats/puzzles-cli.ts --sampled`。TIER B 精确距离表仅明确加 `--rebuild-tier-b` 时重建。

所有 solver 表由 `solver/` 的 `cargo run --release --bin table_generator` 统一生成。H48 h10 需 30,336,314,216 字节；SQ1 jsqfull 需 13,005,619,200 字节。表根为 `CUBE_TABLE_DIR`，默认 `solver/tables/`；数据根为 `CUBEROOT_DATA_ROOT`，默认仓库同级 `scramble/`，可覆盖 WCA/puzzle/xcross 子目录。Rayon 默认使用机器可用并行度，不手工限制 12/14。SQ1 WCA 分析器载入约 13 GiB 表，禁止并行启动两份。

进度由各分析器写自己的进度文件，TypeScript 入口在终端原地更新，重定向输出时稀疏记录；详细日志保存于数据目录。统计总时间写 `solver/tables/stats-pipeline-times.csv`，逐阶段摘要写 `stats-local-*.json`。不要把旧机器的吞吐率当作本机预计时间。

原始/最优打乱、首次出现时间线、近期打乱和 steps PG 索引均属于本地一键输出或显式发布流程。改 JSON 形状时同步客户端类型和 `?v=`；改新的 PG `.copy.tsv`/builder/CI 上传链路时调用 `stats-pipeline-dry-run` skill 核对 builder ↔ scp ↔ load.sql。

## 专项流程

- 三阶阶段与 xcross 回填：读 [stages.md](references/stages.md)。
- Puzzle、SQ1 与采样/距离表：读 [puzzles.md](references/puzzles.md)。
- 三阶整解最优：读 [333opt.md](references/333opt.md)，并读 `solver/333opt/README.md`。

轻量回归：仓库根运行 `./core/node_modules/.bin/tsx --test scripts/stats/*.test.ts`；`core/` 运行 `pnpm --filter @cuberoot/scramble-stats-build exec vitest run tests/scramble_manifest.test.mjs`。全量统计、表生成和发布均是独立长任务，不属于这两个隔离测试。
