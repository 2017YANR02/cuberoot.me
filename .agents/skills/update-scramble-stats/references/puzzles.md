本流程的发布授权见 [skill 入口](../SKILL.md)。

## B. 非 3x3 整解步数

在 `core/` 运行本地一键入口：

```sh
pnpm stats:scramble:local --jobs puzzles
pnpm stats:scramble:local --jobs puzzles --puzzles sq1
```

单独刷新 puzzle 分布（不运行三阶统计）可在仓库根运行：

```sh
./core/node_modules/.bin/tsx scripts/stats/puzzles-cli.ts --puzzles 222,pyraminx,skewb,clock,sq1
./core/node_modules/.bin/tsx scripts/stats/puzzles-cli.ts --build-only
```

`puzzles-cli.ts` 支持 `--max-new N` 限制新增语料，`--build-only` 仅由已有 CSV 重算分布。非 WCA TIER C/D 采样默认**关闭**；仅用户明确要求时用 `--sampled`，可加 `--sampled-events 335,...` 和 `--sampled-n N`。TIER B 确定性表只在首次生成或明确重建时加 `--rebuild-tier-b`。

222、金字塔、斜转及 clock 从 `incremental/tsv/Scrambles.tsv` 按 event_id 增量抽取语料，按 ID 差集分块调用原生分析器或 TS clock analyzer，逐块校验后追加 CSV。222/金字塔的多口径步数由 `src/build_puzzle_metrics.mts` 增量预算；`build_puzzle_dist.ts`、`build_puzzle_examples.ts`、`build_puzzle_first_appearance.ts` 消费结果。前三者的最优等价打乱通过分析器的 `PUZZLE_EMIT_SOLN=1` 解列产生。新增 puzzle 同步更新 `scripts/stats/puzzles.ts` 注册表及 `src/build_puzzle_dist.ts`。

### SQ1 精确双口径

SQ1 使用统一 `table_generator` 产出的 `sq1_wca_jsqfull.bin`（13,005,619,200 字节）。TypeScript 管道按 ID 续跑 WCA 12c4 精确解，并从最优解派生 slash 下界；仅 `W=2s−1` 的歧义态需要 via-WCA 搜索，超时残留由 `sq1_slash_mitm` 判定。CSV 分别为 `sq1_wca_exact.csv` 和 `sq1_slash_exact.csv`，后者同时写 `sq1_slash_meta.json` 的 `fallback/provisional`。分布和示例构建只统计可证结果，未解态保留明确部分状态。

手动维护使用同一个 TypeScript 入口（仓库根）：

```sh
./core/node_modules/.bin/tsx scripts/stats/sq1.ts wca --build-only
./core/node_modules/.bin/tsx scripts/stats/sq1.ts slash --merge-only
./core/node_modules/.bin/tsx scripts/stats/sq1.ts grind
```

`wca` 默认续算未解 ID，可用 `--chunk-size N`；`grind` 取怪物清单，把主 CSV 的 `id,M` 原位替换为真值，默认 10 分钟每条并检查已有 `sq1_analyzer` 进程，避免两份 13 GiB 表并行。需要手动调资源时可给 `grind --split 2 --tt-budget 300000000`；默认线程使用机器可用并行度。每次啃完后重跑 `pnpm stats:scramble:local --jobs puzzles --puzzles sq1` 重建本地分布。发布须获得授权，再走 `pnpm stats:scramble:publish --publish --publish-only --jobs puzzles`。

全量历史计算可能持续多日；主 CSV 只在已完成块并入后变化，运行中看 `sq1/_exact_progress.log`、`sq1/_slash_progress.log` 及对应 analyzer 日志。不要并发启动两个 SQ1 WCA 分析器。TIER C/D 采样与 TIER B 表构建均不应被日常一键入口暗中启用。
