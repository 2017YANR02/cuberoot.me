# Opt1–9 / H48 H0–H11 原生 Rust 对照验证

这是探索性的原生移植：Rust 自己表示魔方、计算坐标和搜索；WASM 仅作为 Opt 独立对照与首版表来源。原 `core/packages/client/public/cubeopt/cube48opt{1..9}.{wasm,mjs}` 不修改，旧 H48/Nissy 源码、程序、表和结果保留。本页区分当前 H0–H11 小数据验收与历史 Opt/H10 真实表结果，不能跨程序版本转用验证结论。

## H0–H11 通用版：当前仅小数据验证（2026-10-13）

通用 `H48Variant`、`H48State`、`H48Table`、`H48Solver` 和旧 H10 兼容入口已接线。`solve-h48 H TABLE [CONTEXTS MAX_DEPTH MAX_NODES]` / `query-h48 H TABLE` 的完整契约与每档规格见 [README](README.md)。**本阶段没有打开或映射任何真实 H48 表，没有真实表求解、回归或基准；H10 也尚未在通用版重新验收。H11 仅代码支持，CLI 在表路径访问前明确拒绝，未使用真实或稀疏占位 H11 文件。**

已通过 **19 项不同的目标测试**，均为小数据或 mock oracle：

| 范围 | 项数 | 验证风险 |
| --- | ---: | --- |
| `h48_variant` | 3 | 全 12 档大小/base/分布、直接读取固定 vendor 源数组逐项核对、H11 拒绝 |
| `h48_coord` | 5 | 全 34,650 种 ESEP 分组、2,048 种 EO、局部变换及快/标量一致性；各 H 的 u64 折叠和边界 |
| `h48_table` | 6 | 三段 header 检查、64 字节编码/fallback、各 H 末行 padding、元数据及预取范围 |
| H10 兼容包装 | 1 | 固定 H10 常量和旧 `MainProbe` 方法 |
| CLI | 2 | 参数范围、旧/新入口、H11 先于文件访问拒绝 |
| 搜索调度 | 2 | mock oracle 的最大界/首前缀边界及规范前缀覆盖 |

其中 14 项 `h48_` 测试另在关闭 H48 快坐标与预取、保留 `neon-moves` 的配置重跑通过；这不是额外 14 个不同测试。默认和该配置的 `cargo check --all-targets` 均通过，旧坐标验证 example 仍能编译。坐标测试覆盖所有 H 的 2,048 EO 值及五个代表轨道（包括最大索引），另检查合成角代表下的 48 对称；合成代表不等同于真实 COCSEP 表选择。所有目标测试低于 200 MB，不生成大表；H0/H11 边界只做整数和小缓冲检查。

可复现入口从此 crate 目录执行，独立 target 保留已验收 release 程序；以下是已执行的小测试命令，不是大表运行入口：

```sh
cargo check --target-dir target/h48-general --all-targets
cargo check --target-dir target/h48-general --no-default-features --features neon-moves --all-targets
cargo test --target-dir target/h48-general --lib h48_
cargo test --target-dir target/h48-general --no-default-features --features neon-moves --lib h48_
cargo test --target-dir target/h48-general --lib h10_table::tests
cargo test --target-dir target/h48-general --bin cube48opt-research
cargo test --target-dir target/h48-general --lib search::tests::variant_prefix_boundary_queries_the_root_or_first_prefix
cargo test --target-dir target/h48-general --lib search::tests::prefix_jobs_cover_the_canonical_tree_without_duplicates
```

固定 12 档预期分布来自 `checkdata.h`，base 来自 `gendata_h48.h`，不是根据总项数伪造分布。真实加载的 `Full` 验证还须扫描实际主表；小测试只验证代码和边界，不能替代这一步。旧固定 H10 的 5,698 状态坐标差分、三路 10,686 个解、7,124 条快/标量等价输出及 **1.566×** 正式基准，均属于 SHA-256 为 `e8b2c919087006bdcd51b76f7bdbe13a294b538c2a69058d4593fa107099d8a0` 的历史程序，详见 [基准记录](benchmark-results.md)。泛化前只读备份为 `/Users/eula/Developer/cuberoot.me-backups/rust-h10-before-h0-h11-2026-10-13/`；本阶段未覆盖旧版程序、表或结果。

## 固定原版与导出

- opt1 原 WASM：126,954 bytes，SHA-256 `cb538e00a5b5ba7a80fa7008c70077ebd62cae8e78f77a7d445461c6fa0d801c`；包装 SHA-256 `04c0e38f79fa64b7517f32a0dfac858e73e3201a84e7f42a0bd1e9a1e5e8c347`。
- `variants.mjs` 固定全部九档 WASM/包装 SHA-256、布局、内存上限。`oracle.mjs inspect` 只解析二进制元数据，不实例化、不生成表；逐档核对 13 个内部函数索引、原名称、精确参数/返回类型，以及 memory import 上限。
- Oracle 仅在内存副本中增加 WASM export section；函数体、数据、导入和原文件不变。原版缺少公开 C/C++ 核心源码，当前依据是固定 WASM、包装和反编译结果，不称为“拥有完整源码”。
- 通过 `instantiateWasm` 捕获实际 instance 的 exports；Emscripten 初始化及被动 data 段仍走原包装，不重复调用内部内存初始化函数。

## 表格式与运行限制

opt1 表名 `h48prun01.dat`，精确长度 **30,401,280 bytes**，由 `_get_mem_ptr()` 返回的动态基址开始连续保存。原浏览器 worker 原样上传/下载这段字节，没有 JS 外壳头。WASM 为小端；首版 Rust 读取此原始表时应使用显式小端读取与越界检查，不混用 Nissy H48 的头、254 项缓存行或文件格式。

`init(a,b)` 的 `a` 是模式：`-1` 查询状态、`0` 尝试接纳已加载表、正值生成；`b` 是生成/检查线程数。生成读取 `CUBEOPT_THREADS`（默认 1，须为正整数且不超过 `availableParallelism()`）；求解保持一个线程、一个组。生成临时 fast-move 对象为 opt1～7 的 **19,208,544 bytes**、opt8/9 的 **19,208,560 bytes**；opt2～9 另有 **表大小 / 16** 的 frontier。frontier 压缩时先分配并复制实际保留前缀，再释放旧缓冲，因此短暂多一份不超过 frontier 大小的副本；实际长度依生成日志确认。工作线程共享这些大缓冲，另外各有线程栈、局部搜索帧和运行时对象（opt2 的 fill 栈帧为 41,456 bytes）。固定大缓冲之和不是严格峰值预测。

`init` 参数顺序以固定二进制为证据：opt2 反编译的 `init(a,b)` 调用 `init_prun(b,0,0)`，后者调用 `init_pruning_hash_table(b,0)`；生成函数创建 `b-1` 个 pthread，主线程也参与。因此 **`init(1,18)` 才表示允许生成并用 18 线程**；旧 `solver/333opt/gen-table.mjs` 的 `init(THREADS,1)` 及其“第一个参数为建表线程数”注释不准确。opt1/opt9 也核对了同一调用链。新生成元数据保存 `generationThreads` 和原始 `generationInitArguments`；加载记录 `adoptionThreads:1` 与 `[0,1]`。

opt1～7 导入 memory32，最大 65,536 页（4 GiB）；opt8/9 导入 memory64，最大 262,144 页（16 GiB），原生指针与 JS 调用参数是 i64/BigInt。高档不是多份 32 位内存分片。小表模式一律限制为 256 MiB；生成/求解按 manifest 设置线性内存上限（PDB + fast-move + 两份 frontier + 128 MiB，至少 256 MiB，并截在原版地址空间上限）。opt7/9 的保守总和超过原版地址上限，实际峰值还取决于 retained-prefix 长度，不能据此承诺必能生成。外层 `guard.mts` 另行检查整个进程树 RSS、系统内存余量/压力、同一启动期间 Swapouts 基线与超时；线性内存上限不能冒充总 RSS 上限或系统禁换出。

| 档位 | 原始文件名 | 精确表字节数 | 额外 frontier 字节数 |
| --- | --- | ---: | ---: |
| opt1 | h48prun01.dat | 30,401,280 | 0 |
| opt2 | h48prun31h2.dat | 121,605,120 | 7,600,320 |
| opt3 | h48prun31h3.dat | 243,210,240 | 15,200,640 |
| opt4 | h48prun31h4.dat | 486,420,480 | 30,401,280 |
| opt5 | h48prun31h5.dat | 972,840,960 | 60,802,560 |
| opt6 | h48prun31h6.dat | 1,945,681,920 | 121,605,120 |
| opt7 | h48prun31h7.dat | 3,891,363,840 | 243,210,240 |
| opt8 | h48prun31h8.dat | 7,782,727,680 | 486,420,480 |
| opt9 | h48prun31h9.dat | 15,565,455,360 | 972,840,960 |

大表生成、加载及 SHA-256 检查均以至多 4 MiB 窗口流式处理，不复制成一份完整 Node Buffer。默认性能基准同时保留 Rust/WASM 两份表，opt9 仅两表约 31.13 GB，另计运行时与保护余量；资源不满足时拒绝启动。大档可显式指定 `--sequential`，使用下述单份表驻留协议，不隐式改变计时方法。

opt1 加载路径调用的 `check_pruning_dist(..., checksum=0, ...)` 禁用了 checksum 比较；其它档位另有原始固定 checksum。`init(0,1)===0` 只证明原版接纳了表，**不构成内容完整性或最优性证明**。生成文件保存完整 SHA-256；Rust 读取时检查固定大小、恢复的 XOR checksum（opt1 为 `780e1cba`）和完整剪枝值分布，JS 验证/基准入口另外检查全文件 SHA-256。XOR 与分布不能替代加密摘要。真实浅层状态另行核对下界/搜索结果；随机态的已验证解只给上界，全局最优仍需搜索完整性证明或独立已知最优长度。

未发现原版内置高档降档入口。高档 2-bit 零码已将个体距离压成 16-byte 块内 fallback 最小值，而不同档位的 EO 折叠改变桶组成、编码基数也变化。对高档已解码值取投影最小可得到保守下界，但不能据此声称复现原版低档的逐字节内容/checksum。首轮逐档使用原版生成；不从有损高档表推断“同一原版低档表”。

只对已有大表进行目录/文件 stat：`solver/tables/h48` 为空，存在 Nissy h7/h10 文件，但格式不同，不能复用为 opt1。不打开或拷贝多 GB 表来寻找 opt1。

## 明确入口

所有实例化/生成/求解由 root 统一套外部 guard 调度，避免与其它计时重叠。统一环境变量 `CUBEOPT_VARIANT=1..9`（默认 1，严格拒绝其它输入），native 子进程继承同一档位；输入的小表和大表元数据必须与档位/源摘要一致。输出目录必须不存在；已有文件不覆盖，失败保留 partial 及监控证据。

- `node oracle.mjs small ABS_NEW_DIR`：仅初始化小表，导出 `small-memory.bin`、`small-tables.json` 和 `fixtures.json`，不生成 PDB、不调用搜索。原线性内存片段末尾 opt1 为 816856，opt2～7 为 816952，opt8/9 为 818008。
- `node oracle.mjs verify-small ABS_SMALL_DIR`：不实例化 WASM，用独立 cubing.js 模型验证全部 407 条物理状态；输出编号/朝向对应和 `physical-verification.json`。
- `node oracle.mjs generate ABS_NEW_DIR`：生成选定档位 PDB，写 raw 表、`table.json`（档位、原版/包装/oracle/manifest 摘要、表摘要、耗时、线程数、内存长度及日志）和小表快照。
- `node oracle.mjs solve ABS_TABLE ABS_CASES_JSON ABS_OUTPUT_JSONL`：加载选定档位表；cases 为数组或 `{cases:[{id,scramble,htm?}]}`；逐例保留原版日志并独立 cubing.js 验解，有已知 `htm` 则严格相等。不隐式生成。
- `node oracle.mjs query ABS_TABLE ABS_FIXTURES_JSON ABS_OUT_JSON`：真实调用原版 `step1_query`，只启用一个 context，剩余七个停用；给负剩余预算让第一次查表必定剪枝，防止逆坐标二次计算覆盖首次结果。保存 407 条正/逆坐标和下界，不进行搜索。
- `node oracle.mjs query-small ABS_FIXTURES_JSON ABS_OUT_JSON`：只初始化小表，不分配 PDB；把 PDB 指针暂设为线性内存末尾，原版 `step1_query` 写出第一坐标后在第一次 PDB 读取触发预期越界。读取已写坐标并恢复指针。固定二进制中的该函数没有下级调用或全局栈指针写入；哨兵、坐标范围、memory32 加法不绕回及预期异常均检查。输出 `hot-query.v1` 的 814 个坐标，`method` 明确记录方式、下界为 null；这不验证剪枝表值或求解正确性。
- `node validate.mjs shallow|suite ABS_NATIVE ABS_SMALL_DIR ABS_TABLE ABS_NEW_OUT_DIR`：统一对照运行。`shallow` 用 cubing.js BFS 全部深度 0..3 状态（数量 1、18、243、3240），Rust contexts 1/8 和 WASM 各验一遍；`suite` 用 10 个固定短序列及历史 15 步 case `3649581001`。同时检查 Rust 节点预算取消和深度穷尽的边界，保存每路原始结果和汇总。
- `node benchmark.mjs ABS_NATIVE ABS_SMALL_DIR ABS_TABLE ABS_NEW_OUT_DIR [--cases ABS_CASES_JSON] [--probe] [--sequential]`：默认保留持久 Rust 进程（8 contexts）与持久 WASM 实例（1 thread、1 group、内部 8 contexts），两边加载同一档位表后逐例交错求解。默认 **18 例**：从历史 60 例中取全部 `htm<=17` 的 16 例（原始最短步数 15/16/17 分别 1/1/14 例），每条截取前 14 个转动，作为 `prefix14` 组；再追加全部 `htm<=16` 的 2 条完整原序列，作为 `historical` 组。截取后的 16 条不继承原序列的 `htm`，其距离与 WASM 对照确定。默认生成数据与 `.tmp/cubeopt-reverse/benchmark-bounded-cases.json` 的 `cases` 序列化后逐字节一致。`--cases` 可传数组或 `{cases:[{id,scramble,htm?,group?}]}`。正式运行首轮预热并排除，再测 3 轮，同例跨轮交换先后；`--probe` 只做 1 轮资源/耗时探测，不能作为正式性能结论。Rust 每例 10 亿节点预算，触及预算报告取消，不宣称无解；外层使用 guard 当前按档位/动作选择的 RSS、超时与原 Swapouts 基线。

`--sequential` 默认改用同一历史文件的全部 **60 条完整打乱**（已知 HTM 15～19），不是上述前缀集合，也不按观察到的速度挑选。每轮为每路引擎各启动一个新子进程，当前引擎完成整批并退出后才启动下一路，因此一次仅驻留一份 PDB；按轮次奇偶交替整批先后。每批先在该进程做复原态启动检查，单独记录包含加载的 wall 耗时；随后先完整跑一遍语料并验解，标记为 `process-warmup`，排除其耗时，再在同一进程内跑该轮完整集合。保留全局首轮整批排除及三轮正式测量，因此默认保存 **960 条结果**（480 条进程预热、120 条全局预热、360 条正式测量）和另外 **8 条启动检查**；元数据 `perProcessWarmupRounds=1`。`--probe` 仍只做一轮、不进行完整语料预热，不能作为正式性能结论。

报告 method 为 `one resident table; fresh engine processes per round; alternating whole-batch order`。每轮新进程使 JIT/内部缓存无法跨进程保留，所以完整语料预热在每个子进程内进行；这也不证明 JIT 已达到稳定状态。应单独报告此协议，不能与旧 persistent 逐例交错结果混算。启动请求限制 600 秒，后续每例限制 120 秒，Rust 每例保留 10 亿节点预算；预热和测量中的任何预算、超时或验解失败都会终止整次运行并保存已有输出，不跳过或自动重试。该入口已通过语法检查，实际受监控运行验收另行记账。

基准每解都由 cubing.js 独立复原并检查已知最短步数、跨引擎/轮次解长一致。`results.jsonl` 保留每轮 seconds、额外 wallSeconds、解、先后顺序和预热标记；持久模式的 `native-raw.jsonl` 与 `wasm-raw.jsonl` 保留原始输出，顺序模式则按 `round-N-phase/{native,wasm}/` 保存 `raw.jsonl`、`stderr.log`、`startup.json` 和成功退出后的 `complete.json`。`report.json` 对 all 及实际存在的语料组给出逐轮总时间、中位数、几何平均和对应比率，**不比较节点计数**。主要时间为 Rust `solve()` 自报耗时与 WASM 自报 `tt`，二者包围的初始化/调度范围略有差别；顺序模式两路 wallSeconds 均从启动检查完成后的请求开始，包含 IPC，加载另记；持久模式第一条 native 请求的 wall 包含加载，不能当作纯搜索对照。WASM 自报时间分辨率 0.001 ms，零值明确保留，不用人为 epsilon 修饰几何平均。前缀样本与完整历史状态分别报告，不把前缀当作完整随机态。fresh 输出目录还保存 Rust/oracle/benchmark 源码、固定原 WASM/包装、本次原生二进制、原始语料和表元数据副本及摘要；失败保留已有逐例结果。

## 小表与状态对照规范

`small-memory.bin` 保存固定 WASM 的地址空间片段，是 golden 数据，不能当 Rust 自身的指针或长期 ABI。元数据列出关键区域：48 个 symmetry cubies（20 bytes）、18 个 move cubies、48 个逆对称编号、153,090 项 raw-corner→sym 的 u32 表，以及 separation/mask 小表。更多数组由实际反编译地址核对，不能仅按相邻位置猜长度。

输入 corpus：复原态、全部 18 个一步、全部 324 个两步（包括约简/抵消），再加固定 xorshift32 seed `0x48480101` 的 64 个 20 步序列，共 **407** 条。每条保存原版 `input_scramble` 的 20-byte cubie、`cubie2fast` 的 48-byte fast，以及全部 48 对称的 cubie。fast 的 `[28,32)` 与 `[44,48)` 是未定义 padding；新 oracle 先清零后调用，历史快照差分应跳过这些字节。

最小验证顺序：

1. 对原版 18 个转动按受影响块位置识别物理角/棱；使用 cubing.js 独立的转动模型建立朝向对应，再检查完整 407 条状态，避免假设 Nissy/Kociemba 的编号和朝向可直接复用。
2. Rust 的转动、乘法、全部 48 对称、fast 有效字段逐字节对照；角/棱商坐标逐项对照原版小表，特别检查复原态和表尾、对称逆及复合关系。
3. 生成表后检查完整文件摘要、大小；验证复原下界、一步/两步下界不超过已知距离及相邻状态下界安全性。饱和编码/fallback 必须对照解码边界，不把截断值当作精确距离。
4. 先在浅层 BFS 可独立确定最短距离的集合比较 Rust 与 WASM。每个解均 cubing.js 验解；有解不等于证明最短。通过后再由 root 安排固定历史 60 例的受监控对照。
5. 性能只比较同机、同表档位、同线程与同批输入，排除生成和冷启动；保留原版时间与解长。原始日志中的节点保留溯源，但两边定义不同，不作节点比率。WASM 与 Rust 差异先归因于实现/运行时，不能直接宣称数学算法的加速。

当前证据：`oracle.mjs`、`validate.mjs`、`benchmark.mjs` 语法检查通过；`inspect` 确认原版摘要、长度和仅增加 export 的副本。root 已受监控生成 opt1 表：SHA-256 `95d0d1a32ec79a8729b64f45b7b4ef6d1a4ffa42c92f6452aeda112ad0e68913`；原版日志报告分布总数 117,567,450、平均 9.605、checksum `780e1cba`。坐标代理已完成 407 条状态/fast、19,536 个共轭和 7,326 个 inverse-move 等式差分；`hot-query.json` 的 814 个正/逆热路径坐标与 Rust 完全一致。cubing.js 的 407 条独立完整物理状态验证通过，证据是 `opt1-small/physical-verification.json`。

`validation-shallow/report.json` 已确认全部 3,502 个 BFS 状态在 Rust contexts 1/8 和 WASM 的共 **10,506** 个解均能复原且等于独立最短距离，节点预算取消/深度穷尽边界通过；相应 guard 记录新增 Swapouts 为 0。root 还完成 11 例 suite 的 **33** 个解，包含历史 15 步例，均通过。该单轮正确性运行没有交错和预热，不能用其耗时宣称性能提升。

## 历史 Opt1 阶段的正式基准

原 26 例 probe 在第一个完整 17 步历史例 `348442001` 上，Rust 耗时 35.616 秒达到 10 亿节点预算，完整穷尽到深度 16 后取消，不能将此结果记成无解。独立 WASM 求得并验证 17 步解，自报 `tt=38.463` 秒。失败及原始结果保存在 `.tmp/cubeopt-reverse/benchmark-probe/` 与 `wasm17.jsonl`。为了让重复对照落在固定运行预算内，正式两版均显式使用同一份 18 例 `benchmark-bounded-cases.json`；默认语料现已与其对齐，预算和计时逻辑未变。

两版均为 1 轮预热加 3 轮交错测量；每版 18×2×4＝**144 个解**全部通过独立验解。三次测量的整批总时间取中位数：

| 版本与结果文件（相对仓库根） | Rust | WASM | WASM / Rust |
| --- | ---: | ---: | ---: |
| 标量基线 `.tmp/cubeopt-reverse/benchmark-baseline/report.json` | 3.900356 s | 3.190428 s | 0.818× |
| NEON 候选 `.tmp/cubeopt-reverse/benchmark-neon/report.json` | 3.293073 s | 3.648869 s | **1.108×** |

该历史 Opt1 阶段主报告采用 **约 1.11×**。逐例时间中位数的配对几何比为 1.154×，这是另一种聚合口径，不替换主指标。两次运行的 WASM 时间也有变化，因此不把跨运行的 Rust 基线/候选时间差全部归因于代码；结果仅覆盖这 18 个固定输入和 opt1 内存档位，不能外推 H10 或全部随机态。后续 Opt1–9 逐档真实表验收和不同程序的基准见 [README](README.md) 与 [基准记录](benchmark-results.md)，不与这里的旧数字合并。

`.tmp/cubeopt-reverse/neon-search-equivalence.json` 确认候选与标量基线的 **72 条原生结果**（含预热），除 `seconds` 外所有字段一致，包括解和计数。当前 `Cargo.toml` 默认启用 `neon-moves`，其 SIMD 实现仅在 `aarch64` 目标使用；其它目标保留标量路径。默认语料更新只执行一次 JS 数据比对：18 例序列化为 1,829 bytes，与正式输入的 `cases` 逐字节相等，未重跑任何求解。
