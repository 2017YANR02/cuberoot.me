# 打乱统计本地管道与发布

在 `core/` 运行 `pnpm stats:scramble`，默认增量运行 stages、333opt、puzzles，全部成功后自动灌线上 PG、上传 static，并提交推送统计文件。只选一个作业，例如 `pnpm stats:scramble --jobs 333opt`；可选 `stages`、`333opt`、`puzzles`，多个用逗号分隔。明确只在本地计算时用 `pnpm stats:scramble:local`；`pnpm stats:scramble:local --plan` 只读显示目录和作业，`--dry-run` 只读检查 stages 新增规模。`--use-cached` 使用已有 WCA export。

数据根默认为仓库同级的 `scramble/`，可用 `CUBEROOT_DATA_ROOT`、`CUBEROOT_WCA_DATA_DIR`、`CUBEROOT_PUZZLE_DATA_DIR`、`CUBEROOT_XCROSS_DATA_DIR` 覆盖；求解器表根为 `CUBE_TABLE_DIR`，默认 `solver/tables/`。分析器按系统选择无后缀或 `.exe`，Rayon 默认使用本机可用并行度。H48 h10 和 SQ1 大表都应由 `solver/` 的 `cargo run --release --bin table_generator` 生成。

## 本地流程

1. `src/incremental.ts` 下载或复用 WCA export，抽取 TSV 和新打乱；`std_analyzer` 计算标准阶段。每条结果按 ID 幂等追加到 CSV、master 语料和多盲拆分元数据。
2. 选中的阶段变体按 master 与各 CSV 的 ID 差集分块补齐，逐块校验行数后落盘。`--variants eo,pseudo` 选择变体；`--max-chunks 1` 限每个变体一块；`--chunk-size N` 覆盖默认块大小。未完成块可续。
3. puzzles 从同一 TSV 增量抽取 222、pyraminx、skewb、clock、sq1。SQ1 的 WCA 12c4 精确与 slash 最优经 `scripts/stats/sq1.ts` 共用逻辑；先啃有超时标记的难题，再生成分布、示例和首次出现时间线。非 WCA 离线采样默认关闭；单独用 `scripts/stats/puzzles-cli.ts --sampled` 才启用。
4. 三阶整解通过原生 H48 h10 按 ID 续解，并在 stages 构建后注入 333 分布、首次出现时间线和最优打乱 CSV。长度、近期打乱、步骤索引和下载包随后构建。
5. `solver/tables/stats-local-*.json` 记录本次阶段结果，`stats-pipeline-times.csv` 记录总耗时。

独立补 xcross 数据集时在仓库根运行 `./core/node_modules/.bin/tsx scripts/stats/backfill-xcross.ts --variant pseudo_f2leo`；可选 `--hours N`、`--chunk-size N`、`--max-chunks N`。它只补 CSV。样本未满时不得重建分布，以免呈现残缺样本数。

独立维护 SQ1：`./core/node_modules/.bin/tsx scripts/stats/sq1.ts wca|slash|grind`。`wca --build-only` 只并入上次已完成的块；`slash --merge-only` 只合并；`grind` 默认 10 分钟每条上限并检查是否已有 SQ1 analyzer 在运行，防止两份 13 GiB 表并行占满内存。

## 已有本地产物补发布

在 `core/` 运行 `pnpm stats:scramble --publish-only`，跳过本地计算，灌线上 PG、上传 static 并提交推送统计文件；`--jobs` 可选发布范围。底层 `pnpm stats:scramble:publish --publish` 只做 PG 和 static，另加 `--push` 才推送 Git。

静态发布器使用 `scramble_manifest.mjs` 的 SHA1 清单和元数据缓存。缓存只加速扫描；只有远端上传、解包、删除都成功后才更新发布基线。初次无基线自动全量 tar；增量只传内容变化的文件并删远端孤儿。只读差异预览：仓库根运行 `./core/node_modules/.bin/tsx scripts/stats/publish-static.ts --dry-run`；`--verify-all` 强制重新计算每个哈希。文件生成与发布必须串行。

`pg_incremental_diff.mjs` 为 optimal 与 steps 产行级差异及新清单。PG 成功后才推进对应 manifest；失败保留旧基线以便下次重试。镜像从线上比赛行数判断需补的比赛。服务器密码只在服务器端从 `/root/core-api/.env` 读取，不写入仓库。

## 轻量验证

在仓库根运行 `./core/node_modules/.bin/tsx --test scripts/stats/*.test.ts`；静态 SHA1 缓存回归在 `core/` 运行 `pnpm --filter @cuberoot/scramble-stats-build exec vitest run tests/scramble_manifest.test.mjs`。这些测试只使用隔离目录和模拟命令，不上传也不灌库。真正全量统计与发布应单独按授权执行。
