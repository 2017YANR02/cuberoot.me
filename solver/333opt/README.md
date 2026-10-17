# 三阶整解最优统计（H48 h10）

离线 `/scramble/stats` 的 333 整解最优 HTM 和 `/timer` 同态最优打乱，统一使用 **nissy-core H48 h10**。旧 `cube48opt9` WASM、`gen-table.mjs`、`solve.mjs`、`solve_loop.mjs` 仅保留作历史参考，不再作为本地统计入口。网站 `/scramble/solver` 的线上服务另有自己的表，不受此离线切换影响。

## 表与语料

- `solver/tables/h48-nissy-core/h48h10.dat`：30,336,314,216 字节，nissy-core 原生格式；只能由 `table_generator` 生成。`CUBE_TABLE_DIR` 可更改表根。64 GiB 档自动包含 H10；仅补它：在 `solver/` 执行 `cargo run --release --bin table_generator -- --only h48-h10`。生成器自动记录耗时和 RSS，57 GiB RSS 停机。
- `../scramble/wca_scramble/wca_scrambles_no_wide_move.txt`：统计管道同源的 `id,scramble` 全量语料，包含 333 / OH / BLD / MBLD / FMC / feet，多盲已拆、宽层已定向为面转。可用 `CORPUS` 覆盖，`CUBEROOT_DATA_ROOT` / `CUBEROOT_WCA_DATA_DIR` 改数据根。
- `solver/333opt/out.0.csv`：每行 `id,htm,solution`。已有 id 自动跳过；原生 worker 只读映射 H10 一次，用可用 CPU 并行度逐行求解并验证解法。`THREADS` 可覆盖。

## 一键入口

从仓库根进入 `core/`：

```sh
pnpm exec tsx ../solver/scripts/generate_and_build_stats.mts
```

它运行统一建表、一次 H10 烟测，再运行本地 TypeScript 统计入口。长度统计里的三阶样例也复用 H10。只做已有表上的全部本地统计，可在 `core/` 执行：

```sh
pnpm stats:scramble:local --jobs all
```

单独续跑三阶整解时，在 `core/` 执行：

```sh
pnpm exec tsx ../solver/333opt/solve_h10.mts
```

`solve_h10.mts` 首次编译 `solver/native/solve_h48_h10.c`，用只读映射复用一张 H10 表，逐条产出 `out.0.csv`，完成后重算 `counts.json`。它不调用旧 opt9。单独重算统计展示：在 `solver/333opt/` 执行 `node inject.mjs`、`node inject_first_appearance.mjs`、`node export_optimal.mjs --verify`；默认一键管道已按顺序执行这些步骤。

断点完成度按当前语料的实际 ID 覆盖判断；输出中额外的历史 ID 不会掩盖当前缺行。计数在读取已有输出和接收新结果时合并累计，不再在完成后重新扫描整个输出；`counts.json` 仍统计完整输出，`--no-counts` 不累计或写入计数。隔离回归检查：从 `core/` 运行 `pnpm exec tsx --test ../solver/333opt/solve_h10.test.mts`，使用极小替身 worker，不加载 H10。

## 口径与边界

`solution` 是把该魔方态复原的 HTM 最短序列。最优打乱是该序列的逆序，和原打乱到达同一魔方态。`export_optimal.mjs` 只给 333 / 333oh / 333ft / 333fm 导出 `/timer` 用的最优打乱；盲拧和多盲原始宽层定向可能改变中心朝向，故不作为同态替代。`out.0.csv` 与比赛元数据关联后，`inject.mjs` 更新难度分布与示例。

2026-09-24 的本地全管道记录为 `solver/tables/stats-local-2026-09-24T13-39-07.047Z.json`：整轮状态 `complete`，总耗时 29 分 35.6 秒，其中 `333opt` 阶段 377.323 秒。该阶段耗时不等于纯求解吞吐；表文件和求解结果只在本机，提交源码不会自动上传它们。发布统计数据需单独授权；`stats:scramble:local` 不提交、不推送、不灌生产库。

2026-10-04 在 M5 Pro、64 GiB、18 逻辑核上，用固定 60 条 15–19 步语料比较核分配。暖缓存单进程 18 线程为 5.324/5.412 秒，2×9、3×6、6×3 分别为 5.891、6.333、7.882 秒，因此保留原来的单进程、可用 CPU 并行度，不增加多行并发。第一次 20 条冷映射为 18.869 秒，同组暖缓存为 2.088 秒；这个差异是缓存冷热，不是算法提速。所有结果逐条比对已有最优长度，原生 worker 逐条回代验解；等长解法文本不要求唯一。完整样本与实测在 `../testdata/benchmarks/h48-h10-2026-10-04.json`，没有修改生产求解结果或 H10 表。

额外比较 `-mcpu=native` 和 `-mcpu=native -flto`：交错暖缓存两轮，原选项 5.302/5.569 秒，native 5.952/5.414 秒，native+LTO 5.829/5.595 秒，没有稳定收益，故未加入默认构建。此轮 `/usr/bin/time -l` 实测单进程峰值 RSS 为 30,342,987,776 字节（28.26 GiB）。多进程对照的映射页由系统共享，不能把各进程 RSS 相加当作实际物理占用。

## 2026-10-17 日常统计切换正式 Opt10

维护者明确要求将日常 333 整解统计切到正式 CubeRoot Opt10（32G 档）。此条取代上文日常必须使用 Nissy H10 的约定；不授权重建大表。`solve_h10.mts` 保留兼容文件名，默认 `H10_ENGINE=opt10`，使用 `opt10-release.mts verify` 核验的正式制品及 `.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat`（31,130,911,744 字节），不能与旧 H10 表互换。`H10_ENGINE=c|rust` 保留显式旧后端，须自行具备旧表。

统计专用 `scramble-stats-opt10-session` 经过原 guard，共享正式制品历史资源审查、独占锁、换出/压力/RSS/2 GiB 余量保护；不使用 ZBLL 的基线重审或到期例外，不重设已有基线。单进程、单批次 worker、默认最多16个搜索线程，全语料期间只加载一次表，已有 `out.0.csv` 按 ID 续算，逐行落盘。这里只修改入口，不启动整轮统计、不发布。下一次运行快捷指令仍按其原有完整计算后发布语义执行。

2026-10-17：维护者另行明确授权“允许，复核后准备好，我自己启动”。统计独立审查保存在 `.tmp/scramble-stats-opt10/review-20261017.json`，绑定当前启动标识、Swapouts 48、旧保护记录和入口源码指纹；不改旧基线、不使用 ZBLL 续跑授权。统计保护停止写入该目录的 `protected-stop.json`，存在则不能自动续跑。入口预检提前检查该审查、余量与独占状态，避免先跑完其他阶段才发现无法启动 Opt10。准备过程不加载大表、不启动统计。

### 2026-10-17 日常 Opt10 统计启动规则更新（维护者明确授权）

维护者同意取消历史换出计数锁定、保留运行保护，并要求开始续跑。仅 `scramble-stats-opt10-session`：每次用户主动启动时核验正式制品、当前压力、可用内存和独占锁，以当前 boot/Swapouts 建立本轮固定基线；历史非零计数或旧停止记录不再永久阻止新任务。运行中不得更新基线，新增换出、异常压力、RSS 超限或余量不足仍立即停止，不自动重启。每轮基线、资源采样及停止证据单独保存在 `.tmp/scramble-stats-opt10/runs/<timestamp>-<pid>/`，保留全部旧记录及求解结果。此条取代此前日常统计对48/80的逐次批准要求，不扩大到其他研究或建表任务。
