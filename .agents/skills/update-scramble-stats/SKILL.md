---
name: update-scramble-stats
description: "用户说更新打乱统计、更新十字/阶段难度、更新 puzzle 或 SQ1 分布、333 HTM/333opt、补 xcross、backfill_xcross_variant 或 pseudo_f2leo 回填时使用。执行 /scramble/stats 的本地增量管道；三阶最优按电脑总内存自动选 Egg Solver 32G/64G，复用已验收本地大表。"
---

# 更新打乱统计

**2026-11-10 起，三阶最优统计按电脑物理总内存自动选择 Egg Solver：至少 128 GiB 用 64G（h11/base10），64–不足 128 GiB 用 32G（h10/base10）；不足 64 GiB 不自动启动。档位由总内存确定，不随当前空闲内存降档。正式入口仍是 core/ 下 pnpm stats:scramble，兼容 solve_h10.mts 调用 solve-egg.mts。两档复用已验收的表和 macOS F_NOCACHE 程序，默认 lanes、单进程常驻，不重新建表、不改变线上 Timer。** 按 ID 续算、逐条独立验解，不因缺文件静默回退。路径及资源保护见 [333opt.md](references/333opt.md)。

日常一条龙在 `core/` 运行 `pnpm stats:scramble`。它默认跑 `stages,333opt,puzzles`，计算成功后自动灌线上 PG、上传 static 并更新 Release；统计文件不再提交 Git；可用 `--jobs` 选子集。Mac、Windows 采用同一 TypeScript 命令，分析器继续用 Rust。明确只要本地产物时才运行 `pnpm stats:scramble:local`；`--plan` 用本地入口只读查看路径与作业。

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

发布完整性（2026-11-13）：日常入口发布 stages 前，必须通过全部比赛、打乱、变体及六底色值的覆盖检查（validate_comp_steps.ts），缺数据不发布。独立分片发布每次先按实际远端 SHA1 核对全部候选文件，补传远端缺失项；不以本地 publish_manifest.sha1 中“已有”代替远端存在。远端未知内容视为并发冲突，保留并停止。上传后再次全量核验，通过才推进本地基线。--baseline 也须远端与本地完全一致，不能凭本地文件初始化“已发布”。--verify-all 只控制本地哈希缓存，远端核验始终执行；--dry-run 是离线本地差异预览，不代表远端完整性。修复线上缺失先复用已有结果，不重复求解。`exact-puzzles/` 属独立不可变数据包发布流程，通用静态发布不得上传或删除它，即使旧基线含这些路径也要排除。

统计发布通过同一个 `wca-data-latest` Release，基于本地 `stats/.stats-release-base.json` 生成 owner 补丁，并在全局发布锁内合并。并发修改同一文件时停止，保留结果和基线；不覆盖其他任务的新结果。新 checkout 先在 `core/` 运行 `pnpm stats:hydrate`，再开始计算；hydrate 不覆盖不同的本地文件。成功发布后只推进该 owner 的基线，失败可重试，不需要提交 Git。

| job | 内容 | 主要产物 |
| --- | --- | --- |
| `stages` | WCA 三阶标准阶段与变体按 ID 增量补缺 | `distribution.json`、`wca_cross`、`comp_steps*`、`difficulty_first_appearance*` |
| `333opt` | Egg Solver 32G/64G 自动选档续解、333 注入、最优等价打乱 | `out.0.csv`、333 变体、`wca_optimal.csv` |
| `puzzles` | 222、pyraminx、skewb、clock、SQ1 精确双口径 | `puzzle_distribution.json`、`puzzle_examples.json`、`puzzle_first_appearance.json` |

`stages` 构建会重写分布和示例，故统计入口在它之后自动重注入 333。`puzzles` 会更新近期打乱、不同度量的 222/金字塔步数和 SQ1 WCA/slash 精确分布。非 WCA TIER C/D 离线采样默认停用，只有用户明确要求才用独立 `scripts/stats/puzzles-cli.ts --sampled`。TIER B 精确距离表仅明确加 `--rebuild-tier-b` 时重建。

日常运行只复用已有表；以下是其他分析器的历史建表入口，不自动运行。其他 solver 表由 `solver/` 的 `cargo run --release --bin table_generator` 统一生成。H48 h10 需 30,336,314,216 字节；SQ1 jsqfull 需 13,005,619,200 字节。表根为 `CUBE_TABLE_DIR`，默认 `solver/tables/`；数据根为 `CUBEROOT_DATA_ROOT`，默认仓库同级 `scramble/`，可覆盖 WCA/puzzle/xcross 子目录。Rayon 默认使用机器可用并行度，不手工限制 12/14。SQ1 WCA 分析器载入约 13 GiB 表，禁止并行启动两份。

进度由各分析器写自己的进度文件；按实际完成的字节、行数、变体或子任务计算百分比。Mac 快捷指令在终端原地刷新当前进度行，不把每个百分比写成新行；详细输出保存在 `~/.local/state/cuberoot/scramble-stats/`。无法测出中途完成量的网络与远端操作只显示 0% 和 100%，不按耗时猜测。统计总时间写 `solver/tables/stats-pipeline-times.csv`，逐阶段摘要写 `stats-local-*.json`。不要把旧机器的吞吐率当作本机预计时间。

原始/最优打乱、首次出现时间线、近期打乱和 steps PG 索引均属于本地一键输出或显式发布流程。改 JSON 形状时同步客户端类型和 `?v=`；改新的 PG `.copy.tsv`/builder/CI 上传链路时调用 `stats-pipeline-dry-run` skill 核对 builder ↔ scp ↔ load.sql。

## 专项流程

涉及三阶阶段表的新增、改名或加载关系调整时，先读 [磁盘表命名规范](../../../solver/DEFINITIONS.md#磁盘表命名) 并使用 `solvers-tables` skill 同步；日常统计仍只复用已有表。

- 三阶阶段与 xcross 回填：读 [stages.md](references/stages.md)。
- Puzzle、SQ1 与采样/距离表：读 [puzzles.md](references/puzzles.md)。
- 三阶整解最优：读 [333opt.md](references/333opt.md)，并读 `solver/333opt/README.md`。

轻量回归：仓库根运行 `./core/node_modules/.bin/tsx --test scripts/stats/*.test.ts`；`core/` 运行 `pnpm --filter @cuberoot/scramble-stats-build exec vitest run tests/scramble_manifest.test.mjs`。全量统计、表生成和发布均是独立长任务，不属于这两个隔离测试。

2026-10-17 的 Opt10 默认已由 2026-11-10 Egg 按物理内存选档约定取代。旧 H10/Opt10 仅保留显式历史入口，不作为缺文件后备。
