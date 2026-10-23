# 打乱统计本地管道与发布

在 `core/` 运行 `pnpm stats:scramble`，默认增量运行 stages、333opt、puzzles，全部成功后自动灌线上 PG、通过 `wca-data-latest` Release 发布统计快照，并增量上传 static 在线分片。统计产物不再提交 Git。只选一个作业，例如 `pnpm stats:scramble --jobs 333opt`；可选 `stages`、`333opt`、`puzzles`，多个用逗号分隔。明确只在本地计算时用 `pnpm stats:scramble:local`；`pnpm stats:scramble:local --plan` 只读显示目录和作业，`--dry-run` 只读检查 stages 新增规模。`--use-cached` 使用已有 WCA export。新 checkout 先运行 `pnpm stats:hydrate` 恢复校验后的统计快照和 Release 基线。

数据根默认为仓库同级的 `scramble/`，可用 `CUBEROOT_DATA_ROOT`、`CUBEROOT_WCA_DATA_DIR`、`CUBEROOT_PUZZLE_DATA_DIR`、`CUBEROOT_XCROSS_DATA_DIR` 覆盖；求解器表根为 `CUBE_TABLE_DIR`，默认 `solver/tables/`。分析器按系统选择无后缀或 `.exe`，Rayon 默认使用本机可用并行度。复用已有、经校验的 H48 h10 和 SQ1 表，通过统计入口的资源守卫运行；本机不授权重建 H10/H11 大表，其他大内存计算须满足根目录 `AGENTS.md` 的启动条件。

## 本地流程

1. `src/incremental.ts` 下载或复用 WCA export，抽取 TSV 和新打乱；`std_analyzer` 计算标准阶段。每条结果按 ID 幂等追加到 CSV、master 语料和多盲拆分元数据。
2. 选中的阶段变体按 master 与各 CSV 的 ID 差集分块补齐，逐块校验行数后落盘。`--variants eo,pseudo` 选择变体；`--max-chunks 1` 限每个变体一块；`--chunk-size N` 覆盖默认块大小。未完成块可续。
3. puzzles 从同一 TSV 增量抽取 222、pyraminx、skewb、clock、sq1。SQ1 的 WCA 12c4 精确与 slash 最优经 `scripts/stats/sq1.ts` 共用逻辑；先啃有超时标记的难题，再生成分布、示例和首次出现时间线。非 WCA 离线采样默认关闭；单独用 `scripts/stats/puzzles-cli.ts --sampled` 才启用。
4. 三阶整解通过原生 H48 h10 按 ID 续解，并在 stages 构建后注入 333 分布、首次出现时间线和最优打乱 CSV。长度、近期打乱、步骤索引和下载包随后构建。
5. `solver/tables/stats-local-*.json` 记录本次阶段结果，`stats-pipeline-times.csv` 记录总耗时。

独立补 xcross 数据集时在仓库根运行 `./core/node_modules/.bin/tsx scripts/stats/backfill-xcross.ts --variant pseudo_f2leo`；可选 `--hours N`、`--chunk-size N`、`--max-chunks N`。它只补 CSV。样本未满时不得重建分布，以免呈现残缺样本数。

独立维护 SQ1：`./core/node_modules/.bin/tsx scripts/stats/sq1.ts wca|slash|grind`。`wca --build-only` 只并入上次已完成的块；`slash --merge-only` 只合并；`grind` 默认 10 分钟每条上限并检查是否已有 SQ1 analyzer 在运行，防止两份 13 GiB 表并行占满内存。

## 已有本地产物补发布

在 `core/` 运行 `pnpm stats:scramble --publish-only`，跳过本地计算，灌线上 PG、发布 Release 并上传 static；`--jobs` 可选发布范围。底层入口为 `pnpm stats:scramble:publish --publish --publish-only`。这些命令均会正式发布，`--push` 兼容参数不再提交或推送生成物。

静态发布器使用 `scramble_manifest.mjs` 的 SHA1 清单和元数据缓存。缓存只加速扫描；只有远端上传、解包、删除都成功后才更新发布基线。增量只传内容变化的文件并删远端孤儿，服务器在同一锁内核对每个文件的发布前/后哈希，全部符合基线后才用原子重命名替换完整文件；冲突保留本地产物和基线，不覆盖其他发布者的新数据。初次无基线会全量打包，但只允许新增文件或与线上完全相同的内容；遇到不同的已有文件，先恢复上次成功发布的 `publish_manifest.sha1`，不要用 `--baseline` 把未发布的新内容冒充线上基线。同一基线的本地发布用 `.lock` 排他；进程异常留下锁时，先核对其中主机/PID 已停止及远端发布结果再移除。只读差异预览：仓库根运行 `./core/node_modules/.bin/tsx scripts/stats/publish-static.ts --dry-run`；`--verify-all` 强制重新计算每个哈希。文件生成与发布必须串行。

`pg_incremental_diff.mjs` 为 optimal 与 steps 产行级差异及新清单。每个 PG 域（`mirror`、`steps`、`optimal-333`、`optimal-puzzle`）使用独立发布回执；服务器在共享锁内检查前一版本，写 pending 日志后执行该域的事务，成功后推进回执。锁覆盖单域操作，不代表整个统计管道是一个事务。旧版本冲突或 SQL 失败会终止本轮发布，保留旧本地清单和远端候选，不会继续报告全部成功。镜像按比赛行数补打乱；比赛名称和日期由每日 WCA stats 更新，镜像只 `ON CONFLICT DO NOTHING` 补缺，避免旧导出覆盖新比赛资料。服务器密码只在服务器端从 `/root/core-api/.env` 读取，不写入仓库。

steps 的重复自然键统一保留 CSV 首项，与增量清单原有规则一致；全量加载不再选 gm 较小的后续项，唯一键结果不变。rare 的重复键也按输入顺序保留首项。若旧线上数据来自旧全量规则的另一项，首次核验会拒绝，需恢复与当前库对应的候选后登记，不会静默改写旧库。

首次启用 PG 发布回执时会只读核对完整域数据：数据库为空则全量载入候选，即使本地已有增量 manifest；非空则必须与候选语义相等，才登记基线并跳过写库。steps 同时核对布局、日期、rare 数据以及按打乱镜像连接/去重后的值（含 `rnd`）。不匹配时先保留新计算产物，再恢复上次成功发布的对应输入，在 `core/` 运行 `pnpm stats:scramble --publish-only --jobs stages`（或 `333opt`、`puzzles`）完成核验登记，随后恢复新产物重新发布。需要成套恢复的输入如下；仅 hydrate Release 不会恢复全部求解 CSV、导出日期和 PG 发布回执。

| 域 | 上次成功发布的输入 |
| --- | --- |
| stages / mirror | WCA 数据目录 `incremental/tsv/Scrambles.tsv`、`Competitions.tsv` |
| stages / steps | `stats/scramble/steps/wca_scramble_steps.csv`、`steps_layout.json`、原有 `wca_scramble_steps_rare.csv`，以及 WCA 数据目录 `incremental/export_date.txt` |
| 333opt | `solver/333opt/wca_optimal.csv` |
| puzzles | `core/jobs/scramble-stats-build/wca_optimal_puzzle.csv` |

WCA 数据目录由 `CUBEROOT_WCA_DATA_DIR` 决定，默认是仓库同级 `scramble/wca_scramble`。本地发布回执为该目录的 `incremental/pg_publication_<域>.json`，与 `pg_wss_manifest.tsv`、`pg_optimal_<333或puzzle>_manifest.tsv` 一起备份；服务器发布回执和 pending 日志在 `/root/.local/state/cuberoot/scramble-pg/`。已有服务器发布回执但本地丢失时，完全相同的候选可幂等恢复；不同候选须先恢复成功发布的本地发布回执及清单，不能手工改 token 跳过检查。

连接中断、SQL 或补缺步骤失败时，日志会打印 `PG candidate retained: /root/_cuberoot_scramble_....sql.json`。先保留该候选、同前缀 SQL/CSV/压缩包以及服务端 pending；重跑原本地候选通常可续传并重试。若本地发布回执也丢失，必须在服务器同一锁内执行日志所指的原始请求：将 `candidate` 设为该实际 `.sql.json` 路径，再执行 `flock -w 120 /tmp/cuberoot-scramble-pg.lock node "${candidate%.json}.ts" /root/.local/state/cuberoot/scramble-pg < "$candidate"`。候选完全成功后再恢复本地基线或用相同输入补发布；不要删除 pending 来放行另一个候选。服务端 current 发布回执丢失但 pending 仍在时，先从备份恢复对应发布回执；没有可验证备份则停止并核对该域数据库，不自动接管。

## 轻量验证

在仓库根运行 `./core/node_modules/.bin/tsx --test scripts/stats/*.test.ts`；静态 SHA1 缓存回归在 `core/` 运行 `pnpm --filter @cuberoot/scramble-stats-build exec vitest run tests/scramble_manifest.test.mjs`。这些测试只使用隔离目录和模拟命令，不上传也不灌库。真正全量统计与发布应单独按授权执行。
