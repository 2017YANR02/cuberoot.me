# Rust Opt9 / Opt10：Mac 原生最优求解器

## Opt1–9 一键建表（原生 CLI）

准备 Rust 和 Node.js 24+，保留完整仓库中的 `core/packages/client/public/cubeopt/` 资源即可；建表无需安装网站的 pnpm 依赖。在本目录构建独立程序，不覆盖已验收的研究制品：

```sh
cd solver/experiments/cube48opt-rust
cargo build --release --target-dir target/init-cli
./target/init-cli/release/cube48opt-research init --memory 2G
```

`2G` 对应 Opt6，剪枝表为 1,945,681,920 字节，并非进程内存上限。省略 `--memory` 可在终端选择档位；支持 `32M / 128M / 256M / 512M / 1G / 2G / 4G / 8G / 16G`，依次对应 Opt1–9。也可用 `--variant 6`，不能与 `--memory` 同时指定。`--threads 4` 设置建表线程数，默认使用当前可用线程数。

命令复用固定版本的原版 WASM 生成器，显示已有生成进度和日志，自动保存到仓库的 `solver/tables/cubeopt/opt6/`。可以用 `--out /path/to/opt6` 指定位置。输出包含剪枝表、`small-memory.bin` 及两份 JSON 元数据；再次运行会流式校验文件大小和 SHA-256 后复用，不重新建表、不把整张表加载进 WASM。复制整个目录到其他机器后同样可以复用，元数据中的旧绝对路径不会阻止迁移。

目录不完整、档位不符或校验失败时明确报错，保留原文件，不自动覆盖或重建。当前上游建表算法不提供计算中途的续建断点；中断后的不完整目录不能当作已完成表。可保留现场并通过新的 `--out` 目录重新建表。

Linux 上建表完成后，从同一目录求解（从标准输入读取 `id<TAB>scramble`，可连续多行）：

```sh
CUBEOPT_VARIANT=6 ./target/init-cli/release/cube48opt-research solve \
  ../../tables/cubeopt/opt6/small-memory.bin \
  ../../tables/cubeopt/opt6/h48prun31h6.dat 8 20 0
```

Linux 使用原生成入口；macOS 的 `init` 会自动转入现有 `guard.mts`，沿用资源预检、独占锁、历史停止记录与运行监控，不提供绕过参数。维护者 Mac 上的求解仍走现有受保护研究入口，不直接执行上述 Linux 求解命令。自动化工具的启动 hook 继续拦截直接 native `init`；内部受保护生成调用及其预算由 `table-init.test.mts` 覆盖。此入口不改变表格式、搜索算法、正式 Opt9/10 制品或历史性能记录。

## 当前正式 Opt10

维护者于2026-10-14指定 **coset 24.6秒版**为正式原生Opt10，登记在 [opt10-release.json](opt10-release.json)。正式程序是已完成WCA1000独立验解的原始构件，未从后续实验源码重新编译；基准为同一Mac、16搜索线程、单轮、不预热，峰值RSS约31.2GB。此晋升仅本地，未发布到服务器或替换WASM。

默认正式入口为 `run-opt10.mts`，只选择登记的 `target/opt10-official/release/cube48opt-research`，仅允许Opt10求解。无参数仅检查，不启动计算：

```sh
node --experimental-strip-types solver/experiments/cube48opt-rust/run-opt10.mts
```

实际运行继续通过原内存guard，须提供新的独立运行review；当前正式入口限定既有WCA1000、16线程、单轮、零预热，不自动重跑旧测试。本次晋升没有启动求解，也没有创建运行review。旧基线、保护记录和已消费标签保留。

`opt10-release.mts install` 从冻结快照安装精确程序，`verify` 核对正式程序和40个冻结文件，均不加载剪枝表。缺少本机快照时明确失败，不自动改为构建最新实验源。需要重新编译时必须从该快照的源码、保留默认features并额外启用 `opt10-native-coset`，用独立target；新构件不能自动继承旧程序的性能证明。

其他9份已测/诊断快照见 [归档索引](opt10-archives.json)，包括原33.0秒、25.1秒及后续未采用的候选。归档保留原路径，避免破坏报告内的证据引用；源码、程序、日志和逐文件摘要均可恢复。Cargo全局default、通用Opt9/WASM构建及旧 `target/opt10` 的建表/历史验证入口不变。历史数学推导见 [实验记录](opt10-native-experiments.md)。

## Opt11 代码准备（2026-10-29，未运行）

本轮多版本优化入口见 [Opt11 优化跟踪](opt11-optimization.md)：先归档 B0，再分别准备搜索、只读查表与建表候选。原版默认路径保留；候选 features 不是运行授权，仍不开放 CLI。

维护者要求只写建表与求解代码，不运行任何计算。本轮没有编译、运行测试、加载大表、建表或求解；新增回归用例也未运行。Opt11 不是 Nissy H48 h11，也不是已发布的 cube48opt 档位。

- `src/opt11.rs`：沿用 Opt9 小坐标快照和 Opt10 生成器已有的完整 EO11 商空间。查表保留全部 11 位独立棱方向；生成时写入全部角稳定子像，搜索时只取一个规范框架。接入现有常驻、多线程搜索及逐条输出/验解框架，不替换正式 Opt10，也不继承其测速成绩。
- `src/eo_table.rs`：从 Opt10 提取的共享双比特存储；`opt10_table.rs` 保留兼容类型名和原格式。Opt11 有独立 magic、档位、长度和摘要绑定，主表为 **62,261,821,440 字节**，加 1,024 字节头后为 **62,261,822,464 字节**。不能用 Opt10 或 H48 表冒充。
- `src/opt11_generate.rs`：复用 `opt10_generate.rs` 的精确短 BFS + 后缀穷举。暂沿用 base 10 / 饱和下界 13，通过深度 12 的完整枚举后才允许写完成表；这些是格式和算法设计，不是本轮运行结论。
- 建表在 BFS 层结束及固定后缀区间完成后保存一致断点：单文件绑定表内容、坐标快照、精确短状态字典、配置和游标。只保留最近两份已提交断点，未完成 `.partial` 保留。恢复校验最新断点，不静默回退；同一进程和表跨区间常驻。仅尚未提交的区间需要重做。崩溃遗留的独占锁须人工复核，不能自动重启。
- `generate-opt11` / `solve-opt11` 的参数和调用路径已接入，但 CLI 在任何文件访问前拒绝执行；guard 和 hook 同样拒绝，不提供运行环境变量豁免。尚未授权实际运行，也没有设置新资源基线。

下一次明确允许验证后，先做编译与小数据验收（格式隔离、坐标/稳定子像、断点恢复、独立最短解），再另行接入受保护的实际运行范围。checkpoint 格式或枚举语义变化必须升级 `STATE_MAGIC`，旧证据不得当作新源码验收。Hook 的真实接入仍待新会话信任与验证。本轮不推算或测量峰值内存、不生成性能数据；`/dev/solvers` 现用 TABLES 快照不新增未生成的 Opt11 表。

## 以下为历史研究记录

**2026-10-13 Opt10 代码阶段**：维护者已取消 H9 建表与测试。自有 Rust Opt10 的原生生成、独立表格式及搜索接入已实现，完成有界小数据验证；尚未生成/加载约 31.13 GB 大表，不能据此声称性能提升。默认 CLI 与研究 guard 禁止 Opt10 大表运行；执行边界、数学条件和剩余验收见 [Opt10 开发跟踪](opt10-development.md)。原 Opt1–9/H7/H10 程序与表继续保留。

**2026-10-13 双底批处理补充**：独立 `target/zbll` 构建现已为 H10 增加共享一份只读表的状态级多线程调度。64 个双底状态与全部 60 个历史状态的 1/16 线程及 C 16 线程对照共 1,116 解通过，Rust 跨线程/轮次 620 次非时间字段比较完全一致；正式两轮混合批处理时间比为 1.426×。这只补充该固定程序的 H10 验收，不代表其他 H 档真实表已验证。旧 release 程序未覆盖，原始报告在 `.tmp/zbll-rust-acceptance-20261013-v3/`；续算契约见 `docs/double-zbll-trainer.md`。

三阶魔方 HTM 最短解研究。Rust 自己完成状态运算、坐标、表读取、IDA* 与正逆搜索，求解过程中不调用 WASM 或 C 求解器。当前实现 Apple Silicon 原生路径及可移植标量路径；实际验收环境为 macOS arm64，未验收 Intel Mac。

当前源码已把原固定 H10 后端泛化为 Nissy **H0–H11 共用后端**。本阶段通过编译检查及 **19 项不同的小数据测试**，尚未对通用版运行任何真实 H48 表回归或性能对照，包括 H10。**H11 仅保留代码支持，CLI 在任何表文件访问前拒绝；本机未生成、打开、映射或求解 H11。** 下文的 1.566× H10 和 1.165× Opt9 均归属于各自已保存的历史程序，不能作为本次通用版的验收结果。

默认启用 `neon-moves`，在 AArch64 同时向量化正逆状态转动。新编译的 x86_64 原生版为 Opt1–9 及独立 Opt10 后端的转动和坐标计算提供 AVX2 / AVX-512BW+VL 路径，运行时检测 CPU 与 OS 支持；自动模式优先 AVX2，不支持时回退标量。`CUBEOPT_SIMD=scalar|avx2|avx512` 可固定路径，明确指定不支持的指令集会报错；未指定等同 `auto`。Opt10 仍使用 `solve-opt10`，不是 `CUBEOPT_VARIANT=10`。`--no-default-features` 关闭默认的 ARM 移动 SIMD、H48 快坐标及 H48 预取，不关闭独立的 x86 路径；各开关保留兼容名称 `neon-moves`、`h10-fast-coord`、`h10-prefetch`，后两个现在作用于 Nissy H0–H11 共用实现。Opt 的现有 AArch64 坐标路径不随这些开关改变。历史 Opt9 的同表、单线程完整 60 例对照中，正式三轮总时间中位数为 Rust **52.117762 秒**、原 WASM **60.718842 秒**，速度比 **1.165 倍**；全部 960 次求解独立验过。它是这组样本的实测，不能外推为所有随机状态或相对原 C++ 的提升。旧 Opt1 1.108 倍结果仍在跟踪 MD 中作为历史单独保留。

x86 构建需要 Rust 1.89+。在目标 Linux 机器上执行前面的 `cargo build --release` 即可使用 SIMD，不需要改表或加实验 feature。本仓库 `solver/.cargo/config.toml` 使用 `target-cpu=native`；需要跨 CPU 分发时，用 `RUSTFLAGS='-C target-cpu=x86-64' cargo build --release` 保留基线兼容性，AVX2 / AVX-512 热点仍由运行时检测选择。交叉编译不能沿用 Mac 的 `target-cpu=native`。

2026-10-21 的真实 Linux Xeon 小数据验证已覆盖九档、三条路径共 1,472,526 次坐标差分；Opt8/9 的转动、坐标热点对照中 AVX2 比 AVX-512 更快，因此没有按指令集宽度强制选择 AVX-512。此结果不代表完整求解提速；没有加载大表或替换线上 WASM。构建方法、具体数据与证据见 [x86 SIMD 验证记录](x86-simd.md)。

2026-10-22 补齐 Opt10 EO10 的 x86 SIMD，三条路径的坐标、对称性与后继集合检查通过。Opt1–7 的 `opt1-7-native-prefetch`、Opt9 的 `opt9-native-prefetch` 和 Opt10 的 `opt10-native-prefetch-x86` 可显式选择 x86 预取；这些档位尚未完成整批预取性能对照，不纳入默认 features。Opt8 继续使用已经上线验证的预取实现。冻结的 Mac Opt10 正式程序不受这些源码改动影响；本台 M5 Pro 的新单轮 WCA1000 / 16 线程为 **26.134 秒、38.264 条/秒**，全部独立验解通过，启动不计入求解时间。

这是独立实验，尚未接入统计管道或替换线上引擎。Opt1 剪枝表 30,401,280 字节，小表快照 816,856 字节。二者文件合计 31,218,136 字节不等于整个进程峰值内存。Opt9 表为 15,565,455,360 字节；历史固定 H10 约 30 GB 后端的标量版与优化版均已通过坐标差分和完整固定语料验解。纯 Rust 建表尚未实现；本轮新增的是上述状态级批处理线程调度，单个状态内的搜索仍是单线程。本次没有新增生成器。

当前扩展进度：**Opt1–9 的小表、独立物理状态及原版热路径坐标差分均通过**；**Opt2–9 全部完成实际建表**。九档每档通过 3,502 个浅层状态的三路 10,506 个最短解，Opt1 使用通用版重新回归；Opt2–9 每档另有 11 例 suite 的 33 个解通过。各档建表秒数、进程树采样峰值 RSS 和完整表 SHA-256 已记入[扩展跟踪](../../../docs/h48-algorithm-research.md)，其中建表 RSS 包含监控器、Node/WASM 和临时缓冲，不能当作纯原生 Rust 求解内存。

已保留的 Opt1–9 阶段原生程序 SHA-256 为 `a8e64b19f79edf54ba0021a44702c7fe378d1637b1c917c77a022f9939a48d55`。该版本九档原生单进程 RSS 已测：固定两例历史输入下，Opt1 峰值 37,486,592 字节，Opt9 为 15,569,256,448 字节；包括加载和求解，非所有输入的内存上界。Opt1–8 的固定 18 例同表性能及 Opt9 全部 60 例历史对照均已完成；新旧程序、不同语料与计时协议分开记录，见 [性能与内存](benchmark-results.md)。

约 32 GB 的 H10 后端沿用 Rust 搜索核心，已能直接读取现有大表；后续自有 EO10 与更精确距离编码仍是研究计划。详见 [H10 融合方案](h10-integration-plan.md)及 [32 GB 内存计划](memory-32gb-plan.md)。若 32 GB 指整机内存，不能直接把约 31 GB 主表作为默认配置。

使用环境变量 `CUBEOPT_VARIANT=1..9` 选择档位，默认 1。Opt2..9 的表分别为 121.6 MB、243.2 MB、486.4 MB、972.8 MB、1.95 GB、3.89 GB、7.78 GB、15.57 GB（十进制）。每个档位必须使用自身小表快照及 PDB。完整固定规格与来源见 [coordinate-variants.md](coordinate-variants.md)。

## 通用 H48 的 API、格式与边界

`H48Variant::new(h)` 接受 0–11，并集中保存每档大小、base、最大界及原版四种 2-bit 码分布；`H48State::main_index(cdata, variant)` 计算坐标；`H48Table::open(path, variant, Validation::Full)` 只读映射并校验表；`H48Solver::new(table)` 将表持有的档位用于坐标与解码。旧 `H10State`、`H10Table` 方法及 `H10Solver` / `H10Query` 名称继续兼容，H10 表包装固定档位 10。Opt1–9 后端独立保留，Nissy 的 H 值与 Opt 档位不能混用。

令 `N = 3393 × 34650 × 2^h`，`L = ceil(N / 254)`。主表为 `64L` 字节，完整文件为 `64L + 2,060,648` 字节；主段 header 的 entries 为 `N + 2L`，包含缓存行元数据而不包含尾部空槽。规范化坐标是 `((corner_class × 34650 + esep) << h) | (eo >> (11-h))`，在移位前即使用 u64。H0 丢弃主坐标全部 EO 位，H11 保留 11 位；从 H6 起最大逻辑索引已超过 u32。

| H | 完整文件 bytes | base | 最大组合下界 |
| --- | ---: | ---: | ---: |
| 0 | 31,683,944 | 8 | 11 |
| 1 | 61,307,240 | 8 | 11 |
| 2 | 120,553,832 | 8 | 11 |
| 3 | 239,047,016 | 8 | 11 |
| 4 | 476,033,384 | 9 | 12 |
| 5 | 950,006,120 | 9 | 12 |
| 6 | 1,897,951,528 | 9 | 12 |
| 7 | 3,793,842,344 | 9 | 12 |
| 8 | 7,585,624,040 | 10 | 13 |
| 9 | 15,169,187,432 | 10 | 13 |
| 10 | 30,336,314,216 | 10 | 13 |
| 11（仅代码） | 60,670,567,784 | 10 | 13 |

这些是固定上游格式规格，不表示本机拥有或已验证各档文件。主表每 64 字节存 254 个 2-bit 码，非零码解为 `base + code`；零码解为 `max(line_min, EOESEP)`，再与 COCSEP 取最大值。即使 H0，零码辅助界仍使用完整 11 位 EO。最大组合界为 `base+3`，同时覆盖 COCSEP 的 9 和 EOESEP 的 11，搜索据此选择前缀深度。末行空槽与缓存行元数据不计入主码分布，预取地址按逻辑索引和映射范围检查。

正常加载使用 `Full`，核对精确文件大小、三段 header、辅助数据及主表四码分布；`Headers` 只供小辅助数据诊断，不能代替全表验证。格式没有可用的版本标签或文件摘要字段，校验按固定 nissy-core 提交定义，分布检查不等于 SHA-256。主表只映射一份，不复制完整表；映射大小也不等于已测进程 RSS。

CLI 契约如下，输入仍为 `id<TAB>scramble`，逐行输出 JSON：

```text
solve-h48 H TABLE [CONTEXTS MAX_DEPTH MAX_NODES]
query-h48 H TABLE
solve-h10 H10 [CONTEXTS MAX_DEPTH MAX_NODES]
query-h10 H10
```

H 必须是规范十进制整数；本机可运行范围为 0–10，11 在读取表路径及任何 stat/open/mmap 之前报错。库内保留 H11 格式与坐标能力，供将来另行授权的环境使用，并不是本机执行许可。可选参数默认 `8 20 50000000`；上下文只允许 1 或 8、深度 0–20，节点上限 0 表示不限节点，所有参数先于开表验证。`query-h48` 同样完整加载校验表，不能当作轻量元数据查询。

实际 H0–H10 运行须由 guard 调度：`CUBEOPT_BACKEND=h48` 与 `CUBEOPT_H=0..10` 必须匹配 CLI 的 H；旧 H10 命令继续使用 `CUBEOPT_BACKEND=h10`。`CUBEOPT_VARIANT` 只选择 Opt 后端。通用版真实表回归尚待单独安排，以上为接口说明，不是运行完成记录。

## 构建与 Opt 运行

Rust crate 独立于现有 solver workspace，不增加第三方 Rust 依赖。编译检查进入 crate 执行：

```sh
cd solver/experiments/cube48opt-rust
cargo check --all-targets --target-dir target/h48-general
```

本轮检查使用独立 target，未覆盖已验收的 release 程序。下面保留既有 Opt 运行入口，均从仓库根执行；其中 `target/release/cube48opt-research` 是历史程序路径，不代表刚修改的 H48 通用源码已构建验收。初次准备 Opt 表时输出目录必须不存在；原 WASM 仅用于这一步及对照验证。需要仓库已安装的 Node 与 cubing.js 依赖。

```sh
node solver/experiments/cube48opt-rust/guard.mts opt1-generate "$(node -p 'process.execPath')" "$PWD/solver/experiments/cube48opt-rust/oracle.mjs" generate "$PWD/.tmp/cubeopt-reverse/opt1-generated"
```

当前机器已完成上述生成，不要覆盖已有结果。原生求解输入格式为 `标识<TAB>打乱`，支持 U/R/F/D/L/B 及 2、撇号，半转按一步计。可连续输入多行；输出每行一个 JSON。

生成线程由 `CUBEOPT_THREADS` 指定，默认 1，上限为当前 `availableParallelism()`。Oracle 调用 `init(1, threads)`；原版函数的第二个参数才传入建表/加载检查线程数，第一个参数用于状态查询或允许生成。旧 `solver/333opt/gen-table.mjs` 的参数注释有误，不沿用其 `init(THREADS,1)` 作为多线程生成方式。Opt2–9 的本次生成均使用 18 线程，加载验证仍使用一个线程。

```sh
node solver/experiments/cube48opt-rust/guard.mts opt1-manual "$PWD/solver/experiments/cube48opt-rust/target/release/cube48opt-research" solve "$PWD/.tmp/cubeopt-reverse/opt1-generated/small-memory.bin" "$PWD/.tmp/cubeopt-reverse/opt1-generated/h48prun01.dat" 8 20 50000000 <<'CASES'
example	R U R' F2
CASES
```

最后三个参数依次为交错搜索上下文数（1 或 8，同一线程）、最大深度（0–20）、累计节点上限。节点上限触发返回 `cancelled:true`，不能解释成无解或已证最优。`solution` 非空时内部回放复核；`completed_depth` 只表示完整穷尽的深度。`seconds` 不包含程序启动和加载校验。

所有实际计算由外层 `guard.mts` 监控，按档位及生成/单引擎/双引擎动作设进程树 RSS 预算，预检额外保留 3 GiB，运行中保持至少 2 GiB 估计余量、正常内存压力、同一系统启动期间 Swapouts 不增长。小表检查限定 512 MiB；求解十分钟，成组验证/基准一小时，生成六小时到期停止。独占锁禁止研究计算相互叠加。保护触发后保留记录，不重设基线自动续跑。监控不等于操作系统保证零换出。

生成预算为 **表大小 × 18/16 + 768 MiB**，覆盖 frontier 压缩时短暂存在的两份缓冲；单引擎预算为表加 768 MiB，双引擎驻留基准为两份表加 1 GiB。大档可用 `benchmark.mjs --sequential` 一次仅驻留一份表；其逐进程完整预热与整批交错协议见 [validation.md](validation.md)，不能与早期 Opt1 持久双引擎基准混为同一测量。

## 历史固定 H10：约 32 GB 档

H10 后端使用 `solver/tables/h48-nissy-core/h48h10.dat`，精确 30,336,314,216 字节。一次只读映射，正常加载验证全部表头、辅助段与主表分布，不另存一份 30 GB 数据。它是显式 H10 后端，不是上游不存在的 Opt10。

以下结果属于泛化前的固定 H10 程序，SHA-256 为 `e8b2c919087006bdcd51b76f7bdbe13a294b538c2a69058d4593fa107099d8a0`。状态运算、坐标、读表和搜索热路径均为 Rust，不调用 C/WASM；固定坐标查找表额外占 9,720 字节，这不是整个进程的额外 RSS。`.tmp/cubeopt-reverse/h10-coordinate-v3/report.json` 记录 5,698 个基础及左半转状态的四项快/标量坐标比较、273,504 次边变换全部一致；`h10-validation-v2/report.json` 记录全部 3,502 个浅层状态及 60 个历史状态的三路 10,686 个解通过。优化前后两种 Rust 配置共 7,124 条输出除耗时外全部字段一致，见 `h10-search-equivalence.json`，不能把这次坐标优化说成减少了搜索量，也不能将旧版验证转记为 H0–H11 通用版验证。

与未修改原 C H10 的同表、单线程、完整 60 例正式对照已完成。排除加载与预热后，三轮整批总时间中位数为 Rust **36.782246953 秒**、原 C **57.605142 秒**，本组样本速度比 **1.566112643 倍**，耗时减少 **36.1476%**。全部 960 条求解结果验解通过，其中 360 条用于正式计时，另有 8 次启动检查；运行期间 Swapouts 为 0。完整协议、逐轮时间和重复性边界见 [性能与内存](benchmark-results.md)，不把有限语料结果外推为所有状态的提速保证。

正式基准的原生进程峰值 RSS 为 Rust **30,342,217,728 字节**、原 C **30,342,397,952 字节**，与 30,336,314,216 字节表文件及监控进程树 RSS 分开记录。约 32 GB 指求解进程档及相应保护预算，不代表整机只有 32 GB/32 GiB 也能满足启动余量。

```sh
CUBEOPT_BACKEND=h10 node solver/experiments/cube48opt-rust/guard.mts h10-manual "$PWD/solver/experiments/cube48opt-rust/target/release/cube48opt-research" solve-h10 "$PWD/solver/tables/h48-nissy-core/h48h10.dat" 8 20 0
```

输入仍为 `id<TAB>scramble`。最后的 0 表示不限节点，外层仍限定资源和时间。8 是单 CPU 线程中交错推进的 8 个搜索上下文。`query-h10 H10` 供完整下界核对，同样必须经 H10 guard。小坐标差分使用 `verify-h10.mjs`，完整验解使用 `validate-h10.mjs`，正式原 C 对照使用 `h10-benchmark.mjs`。泛化前的 39 份文件及验收程序保存在只读备份 `/Users/eula/Developer/cuberoot.me-backups/rust-h10-before-h0-h11-2026-10-13/`，附清单和摘要；旧 C H10、旧 Opt1–9、主表及原始结果均继续保留。

## 数据与来源

上游 `cubeopt-wasm` 固定提交 `1733d1f1ca0e7e7d9860d2b70662336ab4e6ff41` 只有编译产物和包装，当前未取得原 C++ 核心源码。本目录依据固定 Opt1–9 WASM 的反编译及行为对照重建，原 MIT 许可保留于 `LICENSE-MIT`。Nissy H48 后端移植固定 nissy-core GPL-3.0-or-later 源码的坐标、对称和表读取；组合程序遵循 GPL-3.0-or-later，完整来源与许可见 [SOURCES.md](SOURCES.md)。作者致谢统一维护于站点 [About](https://www.cuberoot.me/about)。原 `core/packages/client/public/cubeopt/` 文件未修改。

REA 6.4.0 的本地 CLI 已实际尝试，但该文件触发 `Unsupported WABT section header format`。直接使用官方 WABT 1.0.42 得到 WAT 和反编译结果后继续分析；不将 REA 的失败记作成功反编译，也不声称恢复了原始 C++ 源码。

原 WASM SHA-256：`cb538e00a5b5ba7a80fa7008c70077ebd62cae8e78f77a7d445461c6fa0d801c`。

生成的 opt1 表 SHA-256：`95d0d1a32ec79a8729b64f45b7b4ef6d1a4ffa42c92f6452aeda112ad0e68913`。

小表快照 SHA-256：`072d6d57388fa8e2fe0174e861270ba093f5374633e15df0d82baf47a8f3350f`。

Opt 的 Rust 表加载器检查精确大小、原版 XOR 校验和和完整剪枝分布；Opt 验证/基准脚本另核对完整 SHA-256。原生 CLI 的 Opt1–9 `solve` 在 Linux/macOS 首次成功校验后写入同目录的 `<表名>.verified`；后续文件设备/身份、大小、mtime、ctime、档位和校验版本均未变化时，复用校验结果，不再扫描全表统计分布。表仍需完整读入内存；此优化只减少启动耗时，不改变逐条 JSON `seconds` 的计时范围。记录丢失、损坏或文件变化会重新校验，目录不可写则本次求解照常继续、下次再次完整校验。其他平台暂保留完整校验。

需要强制重验时，在原求解命令前加 `CUBEOPT_VERIFY_TABLE=1`；旧记录先失效，成功后重新保存。缓存基于文件元数据，不能检测不改变元数据的底层静默损坏，也不是文件内容摘要。库的 `load_variant` / `from_words`、WASM、`init --reuse` 的 SHA-256 检查、H48 和 Opt10 流程保持完整校验；冻结的正式程序需另行更新后才具有此功能。

通用 H48 加载器核对精确大小、三段表头、辅助数据和完整主表分布；历史 H10 验证没有重新计算整张 30 GB 表的 SHA-256，不能把分布校验写成文件摘要校验。小表快照不是长期 ABI。opt1 的填充坐标、16 字节 fallback 编码与 nissy-core H48 不同，不能互换表文件。

## 验证与研究边界

验证命令及语料见 [validation.md](validation.md)，Opt 可复现坐标差分见 [coordinate-validation.md](coordinate-validation.md)。历史 Opt1–9 / 固定 H10 的状态和坐标对照、完整浅层最短距离检查及较深历史样本均保留机器可读证据；当前 H0–H11 泛化阶段只完成上述小数据验证。浅层穷举与有限深层对照并非整个状态空间的正确性证明。

全局跟踪、实测结果、原版备份位置和后续数学优化见 [h48-algorithm-research.md](../../../docs/h48-algorithm-research.md)。Rust 改写或 SIMD 实现本身不构成数学算法提速证据；性能必须按同机、同表、同线程、同语料实测。当前调度使用安全的独立搜索栈及确定性排序，不保证逐指令、逐节点与原 WASM 一致，两者节点计数也不能直接比较。
