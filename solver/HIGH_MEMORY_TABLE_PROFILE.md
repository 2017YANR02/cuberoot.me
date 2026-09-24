# 64 GB 高内存表跟踪

## 背景与边界

默认表集、`CUBE_ALLOW_HUGE_TABLES`、统计管道、内存口径、已有生成器和吞吐快照全部保留。程序按总物理内存自动选档：低于 56 GiB 使用默认档，达到 56 GiB 使用 `high-memory` 档；识别失败时安全回落默认档。默认档即使看到新文件也不探测、不生成、不加载。

`333-eo` 的五张高内存表沿用原方案。总生成器另负责 SQ1 精确表和原生 H48 h10 表；三阶整解统计读取 H10，不再生成 cubeopt9。

## 坐标与文件预算

新表复用已在精确分布管道验证过的 `eo_xcross` 坐标：

`P(12,5) × 24 × 2,048 = 4,671,406,080` 个状态，即四枚 Cross 棱加一枚物理槽棱、该物理槽角和全棱 EO。物理槽在新 EP5 纯位置坐标中使用 `0,1,2,3`，对应现有“位置+翻转”单棱坐标的 `0,2,4,6`；角目标仍为 `12,15,18,21`。为避免依赖尚未证明的虚拟槽对称，四个物理槽各生成一张表。

| 文件 | 数量 | 单个字节 | 小计字节 |
| --- | ---: | ---: | ---: |
| `mt_ep5_high_memory.bin` | 1 | 6,842,892 | 6,842,892 |
| `pt_eo_xcross_slot{0..3}_high_memory.bin` | 4 | 2,335,703,056 | 9,342,812,224 |
| 新增合计 | | | 9,349,655,116 |

`333-eo` 现有 full 文件集（含可选对角表）为 33,808,236,204 字节。加上新表后为 **43,157,891,320 字节（43.2 GB / 40.2 GiB）**，低于该求解器原有的 55 GB 文件预算。**57 GiB 是 H48 h10 生成进程的 RSS 警戒线**，与 EO 的表文件预算是两种口径。

这是会被加载的完整表文件口径，不等于 RSS，mmap 工作集和生成峰值。后两者必须在新机器上独立测量，不用文件大小代替。

## 自动选档和生成

`CUBE_TABLE_PROFILE` 是可选覆盖，而不是日常必填开关：

- 未设置或设为 `auto`：按总物理内存自动选择。
- `default`：强制原始档，用于 64 GB 机器上的基线对照。
- `high-memory`：强制大档，仅用于人工验收或识别失败时。

在 64 GiB Mac 上，未设置 `CUBE_DISABLE_HUGE_TABLES=1` 时，从 `solver/` 运行普通总生成器会生成或跳过已存在的 Rust 78 张表、SQ1、H48 h10。每表耗时自动追加到 `tables/generation-times.csv`，SQ1 和 H48 的峰值 RSS 追加到 `tables/generation-memory.csv`；可用 `tee` 额外保存完整进度：

```bash
mkdir -p tables
cargo build --release --bin table_generator
set -o pipefail
./target/release/table_generator 2>&1 | tee tables/generation-$(date +%Y%m%d-%H%M%S).log
```

macOS、Linux 和 Windows 的统一生成命令（在 `solver/` 执行）：

```bash
cargo run --release --bin table_generator
```

只生成 H10，或先用 H7 验证建表流程（按需选择其中一条）：

```bash
cargo run --release --bin table_generator -- --only h48-h10
cargo run --release --bin table_generator -- --only h48-h7
```

只补某一类表时仍使用同一入口：`table_generator --only sq1`、`--only h48-h10`、`--only h48-h7` 或 `--only rust`。默认使用可用 CPU 并行度，不钳制到 12/14 线程；各大表依次生成。H48 h10 用仓库内固定版本的 nissy-core 原生源码，输出 `tables/h48-nissy-core/h48h10.dat`（30,336,314,216 字节，28.25 GiB）；H7 是只验证建表流程的小档位，输出 `h48h7.dat`，不供当前统计管道使用。原生进程的完整错误输出同步保存到同目录对应的 `*.dat.log`，进度 JSON 在失败时记录前一阶段。57 GiB RSS 警戒线触发即终止该子进程并报错。统计管道通过 `333opt/solve_h10.mts` 调用原生求解器读取 H10。SQ1 输出 `tables/sq1_wca_jsqfull.bin`（13,005,619,200 字节）。`eo_cross_analyzer` 仍按现有约束要求 `CUBE_ALLOW_HUGE_TABLES=1`。

2026-09-23 首次 H11 运行约 49 分钟时，macOS 发生 watchdog kernel panic；快照中生成进程 RSS 为 60,781,734,752 字节（约 56.6 GiB），系统空闲页约 14 MiB。日志不能单独证明根因，但原来 57 GiB 的进程 RSS 警戒未能避免重启。随后用户选择 H10。H10 首次尝试直接映射 `.tmp` 建表，处理短状态速度过慢；有上限样本显示文件映射远慢于匿名内存。现在 H10 按上游原版计算逻辑在匿名内存中生成，先校验，再顺序写入 `.tmp`，同步落盘后原子改名。Mac 系统可用内存低于 10% 或进程 RSS 达到 57 GiB 时提前停止；未完成的 `.tmp` 不能作为有效表。

2026-09-24 H7 流程验证：第一次把短状态遍历边界改成处理最后一个哈希槽，完整建表后上游分布校验失败。恢复固定上游版本的计算边界，并让进度总数按实际处理的 7,437,854 个状态显示后，第二次 H7 通过表头分布及实际表内容校验，完成写盘。输出 `h48h7.dat` 为 3,793,842,344 字节，生成器记录 439.188 秒、峰值 RSS 3,876,880,384 字节。H7 仅证明这一路径的小档位通过；当时 H10 仍需单独生成与验算，不能把 H7 结果写成 H10 完成。

2026-09-24 H10 正式生成成功：11:21:59 UTC 完成上游表头分布及实际内容分布校验、顺序写盘、同步落盘与原子改名。`h48h10.dat` 实际大小 30,336,314,216 字节（28.25 GiB）；生成器自动记录 3,772.659 秒（1 小时 2 分 52.659 秒）、峰值 RSS 30,419,353,600 字节（28.33 GiB），使用 18 个可用 CPU 线程。证据为 `tables/generation-times.csv`、`tables/generation-memory.csv`、`tables/h48-h10-validated-h7-2026-09-24T10-19-04.631Z.log` 和 `tables/h48-nissy-core/h48h10.dat.progress.json`。SQ1 文件大小亦符合统计入口检查。随后从 `core/` 运行 `pnpm stats:scramble:local`，本机记录 `tables/stats-local-2026-09-24T13-39-07.047Z.json` 的状态为 `complete`，耗时 29 分 35.6 秒（13:39:07–14:08:42 UTC）；该入口只写本地文件。尚未据此宣称线上统计已更新，也未单独测量分析器稳态 RSS、mmap 工作集或冷热表吞吐。

未来更大内存机器的 H48 升档：当前固定的 nissy-core 在 64 位平台 `H48_HMAX=11`，H11 完整文件为 60,670,567,784 字节（56.50 GiB）；H12 被上游拒绝，不能靠改常量解锁。当前生成器与进度查看器支持 H7/H10，求解器、TS 编排、统计前置检查和 `/dev/solvers` 的正式整解配置使用 H10，所以**现阶段不是改一处数字就能升 H11**。升级时仍从统一 `table_generator` 入口生成，工作缓冲区不得是文件映射，必须按新机器物理内存重新设资源警戒，并对整表校验、样例求解、统计输出做验收。完成参数化与验收后，才可把档位选择收敛为一处配置。

H48 h10 重新生成时，原生 worker 在终端同一行显示 9 个阶段的当前阶段、运行时间、可计量的完成数与本阶段粗略 ETA，约每 10 秒刷新，不连续刷屏。进度同时原子写入 `tables/h48-nissy-core/h48h10.dat.progress.json`；即使关闭终端视图，也能读取其中的 `stage`、`done`、`total`、`percent`、`etaSeconds` 和 `updatedAt`。从 `core/` 执行 `pnpm exec tsx ../solver/scripts/show_table_progress.mts --watch` 可在另一个终端原地看中文进度；不加 `--watch` 只看一次。初始化主表、处理短状态、主表统计、校验和顺序写盘按真实工作量计数；搜索深度、eoesep 状态数及最终磁盘同步不等于时间进度，这些阶段显示持续运行时间及“估算中”，不编造 ETA。`etaSeconds` 只预测当前阶段，前期样本少或工作量不均匀时会大幅变化。内存生成期间旧 `.tmp` 可能仍在磁盘上，但它不是进度；中断后不能续算，校验通过后才覆盖它。

在 macOS 的仓库根目录，可以直接运行 `./core/node_modules/.bin/tsx solver/scripts/show_table_progress.mts --watch`，无需切换目录。Windows PowerShell 从 `core/` 运行上面的 `pnpm exec tsx` 命令。

查看 H7 时追加 `--table h7`。例如从 `core/` 执行 `pnpm exec tsx ../solver/scripts/show_table_progress.mts --table h7 --watch`。默认查看 H10；查看器只读取状态，不启动或停止生成。

## 源码入口与维护约束

| 文件 | 职责 |
| --- | --- |
| [src/bin/table_generator.rs](src/bin/table_generator.rs) | 唯一日常建表入口，选择表集并记录逐表结果和耗时 |
| [src/h48_native.rs](src/h48_native.rs) | 编译和启动原生 H48 worker、保留日志、采集峰值 RSS 并执行资源警戒 |
| [native/generate_h48_h10.c](native/generate_h48_h10.c) | H7/H10 内存生成、上游校验、顺序写盘与原子改名 |
| [native/h48_progress.c](native/h48_progress.c) | 九阶段状态、同一行终端进度及 JSON 持久化 |
| [scripts/show_table_progress.mts](scripts/show_table_progress.mts) | 单次或持续查看已运行任务的进度 |
| [vendor/nissy-core/VENDOR.md](vendor/nissy-core/VENDOR.md) | 固定上游版本、来源及本地修改原因 |

修改 H48 遍历或进度前，先读 `VENDOR.md`。固定上游的计算边界和预期分布必须一致；不得为凑进度 100% 多处理一个哈希槽，也不得修改预期分布来绕过校验。计算路径有改动时先完成 H7 全流程验算，再重新生成 H10。运行中的 worker 不会因源码修改自动更新。

## 状态

| 项目 | 状态 | 验收证据 |
| --- | --- | --- |
| 默认 32 GB 路径 | 保留 | 自动识别低于 56 GiB 时不访问任何新表文件 |
| EO XCross 高内存坐标 | 代码就绪 | 四张物理槽表，搜索使用全局对称帧更新 |
| 自动选档 | 代码就绪 | Windows、macOS、Linux 读取总物理内存；识别失败回落默认档 |
| 生成器 | 代码就绪 | 统一 `table_generator` 按档追加；`--only` 补单类表；PDB 串行生成 |
| 表文件生成 | 本机完成 | 2026-09-23，64 GiB Mac mini，18 个 Rayon 线程；基础 73 张 + high-memory 5 张，合计 45,488,310,956 字节，历时 319.3 秒 |
| 新表格式与大小 | 本机核对 | 5 个文件 header 与预期字节数一致，SHA-256 已记录于本机验收日志 |
| 生成峰值内存 | 本机实测 | macOS `/usr/bin/time -l` 最大 RSS 24,542,969,856 字节；peak memory footprint 24,700,948,784 字节 |
| EO high-memory 分析器正确性和性能验收 | 未执行 | 稳态 RSS、mmap 工作集和新吞吐量待实测；H10 的本地统计运行已完成，见上文 |
| `/dev/solvers` | 本机事实已同步 | 保留默认档旧吞吐，单列本机 high-memory 文件和生成记录 |

本机自动日志为 `tables/generation-2026-09-23.log`；从逐表计时行提取的 78 行 CSV 为 `tables/generation-2026-09-23.csv`。两者均在 Git 忽略的表目录，不随仓库发布。当前 `step()` 以 0.1 秒显示耗时，`0.0s` 表示少于约 0.05 秒。

## 新机器到位后的验收清单

- 核对 5 个新文件的 header、精确字节数和 SHA-256。
- 在 32 GB 机器自动档和 64 GB 机器强制 `CUBE_TABLE_PROFILE=default` 两种情况下，确认新文件已存在也不会被打开。
- 在 64 GB Mac 确认未设置 profile 时日志选择 `high-memory`，且报告的来源是物理内存自动识别。
- 对同一固定 fixture 比较默认档与历史 CSV，必须逐位一致。
- 高内存档对同一 fixture 输出也必须逐位一致，只允许节点数和用时改变。
- 分别记录生成峰值、稳态 RSS、mmap 工作集、页面错误和冷热表吞吐。
- 记录生成器实际线程数、逐表耗时与生成峰值内存；H48 h10 生成 RSS 不得达到 57 GiB。
- 只在有实测证据后更新 `/dev/solvers` 的吞吐、RSS、mmap 和构建峰值。

## 待办候选

- `333` 整解：H10 完整表已生成并通过上游校验，本地统计管道已用 nissy-core h10 完整运行；线上静态文件和 PG 发布仍需另行验收。
- `333-f2leo` / `333-pseudo_f2leo`：已有可扩大坐标候选，但当前吞吐高于 EO 数十倍，暂不为用完容量而加表。
- `333-pseudo_pair`：当前 `47/s`，先等 EO 的单位内存收益实测后再排序。
