本流程的发布授权见 [skill 入口](../SKILL.md)。以下命令从 `core/` 执行，除非另有说明。

## A. 三阶阶段难度

```sh
pnpm stats:scramble:local --jobs stages
pnpm stats:scramble:local --jobs stages --plan
pnpm stats:scramble:local --jobs stages --dry-run --source-csv /path/to/input.csv
```

TypeScript 入口下载或复用 WCA export，抽取新增打乱，运行 `std_analyzer`，按 ID 幂等追加 std CSV、master 和多盲元数据。随后按 master 与各变体 CSV 的 ID 差集补缺，再重算 distribution、wca_cross、comp_steps、近期打乱和首次出现时间线。默认补 daisy、first_layer、eo、pseudo、pseudo_pair、pair、f2leo、pseudo_f2leo、222、roux、223、eoline、dr、f2b；用 `--variants eo,pseudo` 缩小范围，`--max-chunks 1` 控制每个变体最多一块，`--chunk-size N` 覆盖块大小。中断后重跑按 ID 续算。

分析器走 `CUBE_TABLE_DIR` 与 `CUBE_ALLOW_HUGE_TABLES=1`，Rayon 默认使用机器可用并行度。性能估计须读取本机实际进度；旧机器的 eo、pair 等速率不能作为本机承诺。产物自动记录各阶段耗时。若更改分布 JSON 结构，应同时更新前端类型和资源版本。

### 第二套数据集：xcross_2_col_10f

它与 WCA 增量管道解耦。只补 CSV，在仓库根运行：

```sh
./core/node_modules/.bin/tsx scripts/stats/backfill-xcross.ts --variant pseudo_f2leo --hours 5
```

可选 `--variant f2leo`、`--chunk-size N`、`--max-chunks N`。默认线程使用机器可用并行度，不固定 10/14。目标 master 是 `CUBEROOT_XCROSS_DATA_DIR`（默认数据根下 `xcross_2_col_10f`）的 `scrambles.txt`；结果写同目录 `stat/<variant>.csv`。只在该 CSV 与 master 的 ID 集合完全一致后，才重建并发布对应分布，避免不完整样本被当作全量。

发布入口需单独获得授权：`pnpm stats:scramble:publish --publish --jobs stages`。仅预览静态差异可运行 `./core/node_modules/.bin/tsx scripts/stats/publish-static.ts --dry-run`（仓库根）。
