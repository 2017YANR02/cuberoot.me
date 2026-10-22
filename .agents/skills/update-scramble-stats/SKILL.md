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

用户运行日常一键命令或明确要求跑完自动发布时，按该次授权执行发布。已有本地产物只需发布时运行 `pnpm stats:scramble --publish-only`，不重复计算。底层 `stats:scramble:publish --publish` 同样灌 PG、更新最新 Release 并上传独立在线分片；兼容旧 `--push` 参数，但不再提交或推送统计文件。发布失败时保持对应 SHA1/PG manifest，供下次重试。只读独立分片差异预览在仓库根运行 `./core/node_modules/.bin/tsx scripts/stats/publish-static.ts --dry-run`，`--verify-all` 忽略哈希缓存重算。

统计发布通过同一个 `wca-data-latest` Release，基于本地 `stats/.stats-release-base.json` 生成 owner 补丁，并在全局发布锁内合并。并发修改同一文件时停止，保留结果和基线；不覆盖其他任务的新结果。新 checkout 先在 `core/` 运行 `pnpm stats:hydrate`，再开始计算；hydrate 不覆盖不同的本地文件。成功发布后只推进该 owner 的基线，失败可重试，不需要提交 Git。

| job | 内容 | 主要产物 |
| --- | --- | --- |
| `stages` | WCA 三阶标准阶段与变体按 ID 增量补缺 | `distribution.json`、`wca_cross`、`comp_steps*`、`difficulty_first_appearance*` |
| `333opt` | 正式原生 Opt10 续解、333 注入、最优等价打乱 | `out.0.csv`、333 变体、`wca_optimal.csv` |
| `puzzles` | 222、pyraminx、skewb、clock、SQ1 精确双口径 | `puzzle_distribution.json`、`puzzle_examples.json`、`puzzle_first_appearance.json` |

`stages` 构建会重写分布和示例，故统计入口在它之后自动重注入 333。`puzzles` 会更新近期打乱、不同度量的 222/金字塔步数和 SQ1 WCA/slash 精确分布。非 WCA TIER C/D 离线采样默认停用，只有用户明确要求才用独立 `scripts/stats/puzzles-cli.ts --sampled`。TIER B 精确距离表仅明确加 `--rebuild-tier-b` 时重建。

所有 solver 表由 `solver/` 的 `cargo run --release --bin table_generator` 统一生成。H48 h10 需 30,336,314,216 字节；SQ1 jsqfull 需 13,005,619,200 字节。表根为 `CUBE_TABLE_DIR`，默认 `solver/tables/`；数据根为 `CUBEROOT_DATA_ROOT`，默认仓库同级 `scramble/`，可覆盖 WCA/puzzle/xcross 子目录。Rayon 默认使用机器可用并行度，不手工限制 12/14。SQ1 WCA 分析器载入约 13 GiB 表，禁止并行启动两份。

进度由各分析器写自己的进度文件；按实际完成的字节、行数、变体或子任务计算百分比。Mac 快捷指令在终端原地刷新当前进度行，不把每个百分比写成新行；详细输出保存在 `~/.local/state/cuberoot/scramble-stats/`。无法测出中途完成量的网络与远端操作只显示 0% 和 100%，不按耗时猜测。统计总时间写 `solver/tables/stats-pipeline-times.csv`，逐阶段摘要写 `stats-local-*.json`。不要把旧机器的吞吐率当作本机预计时间。

原始/最优打乱、首次出现时间线、近期打乱和 steps PG 索引均属于本地一键输出或显式发布流程。改 JSON 形状时同步客户端类型和 `?v=`；改新的 PG `.copy.tsv`/builder/CI 上传链路时调用 `stats-pipeline-dry-run` skill 核对 builder ↔ scp ↔ load.sql。

## 专项流程

- 三阶阶段与 xcross 回填：读 [stages.md](references/stages.md)。
- Puzzle、SQ1 与采样/距离表：读 [puzzles.md](references/puzzles.md)。
- 三阶整解最优：读 [333opt.md](references/333opt.md)，并读 `solver/333opt/README.md`。

轻量回归：仓库根运行 `./core/node_modules/.bin/tsx --test scripts/stats/*.test.ts`；`core/` 运行 `pnpm --filter @cuberoot/scramble-stats-build exec vitest run tests/scramble_manifest.test.mjs`。全量统计、表生成和发布均是独立长任务，不属于这两个隔离测试。

2026-10-17：333opt 默认已切换正式 Opt10 32G，旧 H48 h10 表不再是日常前置条件。详见 references/333opt.md 的最新约定；不要为本次缺旧表错误重建 H10。
