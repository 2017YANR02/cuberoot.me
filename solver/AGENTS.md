# AGENTS.md

nxopt22 WCA100/4线程最新测试已完成：296.600813958秒，100条全部独立验解和最优长度核对通过，无新增换出，guard正常退出。`nxopt22-wca100-4-20261015` receipt已消费，不得重复运行。页面已转入Opt8组，旧1000条结果保留为历史。

2026-10-15 nxopt22 对齐8G档：维护者明确要求重新测固定WCA前100条、4线程、单轮不预热。复用现有表，不建表；独立scope `nxopt22-wca100-4-20261015`，同boot/Swapouts48，保留旧1000条成绩与保护记录。仍由guard独占运行，RSS预算和2GiB运行余量保持，触发停止不自动重试。输出持久化在同名.tmp目录，完成后独立验解再回填Opt8组。

nxopt22 本轮已完成：WCA1000 / 16线程 / 单轮不预热整批耗时504.905973秒，1000条独立验解及最优长度全部通过；7,809,269,764字节表已保留，建表51.613546958秒另计。Swapouts48→48，guard退出0，receipt已消费，禁止重复运行或覆盖结果。证据 `.tmp/cubeopt-reverse/nxopt22-20261015/report.json`，本地比较页已更新为两位有效数字500秒、真实8G表档；原生Opt9保留42秒成绩但其表为16G档，不宣称同容量精确倍数。仅本地未发布。

2026-10-15 nxopt 新授权：维护者回复“允许，受保护建表后测试”。允许固定上游 `rokicki/cube20src` 提交 `f430921a48306874864b9f2ac8a059b43492fd3a` 的 nxopt22 在本机生成约7.8GB专用表，再跑固定 WCA1000、16线程、单轮、不预热。由 `experiments/cube48opt-rust/guard.mts` 的独立 `nxopt-policy.mts` scope 运行，保留所有旧停止记录，沿用同 boot / Swapouts 48；新增换出、压力异常、RSS超限或运行余量低于2GiB立即停止，禁止自动重试。表生成和整批求解使用同一个常驻进程；逐条结果持久化，结束后独立验解。只用本地，不发布，不恢复任何 WASM / ZBLL 旧任务。跨状态并行允许参与整批实际耗时比较，不能累加并发的逐条时间。

2026-10-15 最新维护者指令“启动安全余量：3 GiB 该成 1G,然后测试”：仅将本轮四个 Opt9 WASM 候选的额外启动余量由 3 GiB 改为 1 GiB，总启动门槛由 21.4204 改为 19.4204 GiB。RSS 预算、运行中至少 2 GiB 余量、压力/新增换出保护、同 boot / Swapouts 48 及共同停止边界保持不变，其他任务启动门槛不变。A 先前只因 preflight 内存不足退出、receipt 未消费，原 session 与失败日志完整归档后按新条件准备 review；禁止覆盖失败记录或重置换出基线。不需再次询问授权，资源满足后顺序测试四版。

2026-10-15 最新授权“可以测试了”：维护者撤销上一条延后，允许测试已准备的四个 Opt9 WASM 候选 A 专用查表、B padded、C 组合、D select；承接已经说明的独立同 boot / Swapouts 48 监控范围，旧 16→48 停止记录全部保留。沿用同一 WCA1000 原序、16 搜索线程、每版一次、不预热，复用原版成绩，不发布。先完成 C/D 缺少的小数据验证，顺序经现有 guard 测试，一次只加载一份主表；各候选独立固定构件/源码快照/输出/receipt，共用本轮保护停止边界，任一新增换出或资源保护触发后整个本轮停止，禁止换候选变相续跑。内存门槛不降低，当前暂停记录仅为历史，不是仍需重复询问的许可关卡。此条不授权其他档位或长期任务。

2026-10-15 历史暂缓阶段（已由上条“可以测试了”取代）：维护者回复“先保留代码，不测试”，随后要求内存有限时先多准备几个版本。该阶段仅编译独立 Opt9 WASM 候选，没有加载主表或启动新测试。`opt9-batch` / `padded-state` 的小数据检查在暂停前完成；组合 `opt9-batch-padded` 与 `opt9-select` 当时仅输出 `draft-*` / `draft-metadata.json`，明确 `verified=false` / `benchmarkEligible=false`。这些原草稿和保护记录仍保留；最新构建及测试状态见 `../docs/optimal-solver-benchmark.md`。

2026-10-15 当前任务：维护者重新明确要求优化 **CubeRoot Opt9 WASM 16G**，目标快于保留的 cube48opt9 WASM 83.655909546 秒。沿用固定 WCA1000 原序、16 个搜索线程、每个新候选单轮零预热；只在本机，保留旧源码/构件/结果，不重跑原版，不发布。此前“仅 Opt8”限制不再限制本轮 Opt9 开发，但旧 coset 的 Swapouts 16→48 保护停止不可复用或重启，Opt8 专属 48 receipt 不能作为 Opt9 新运行的许可。当前先完成独立 `wasm-opt9-batch`（固定 Opt9 坐标与批量读取，关闭 coset/root/lazy）编译及小数据验证；大表运行须经内存复核和独立 guard scope，不降低门槛、不静默重设旧基线。另将 `wasm-padded-state` 搜索帧布局作为隔离候选验证，其 SIMD 简化与旧 V5 同类，不能宣称新突破或未经实测晋升。进展和冻结证据见 `../docs/optimal-solver-benchmark.md` 最新章节。

2026-10-15 研究存档指引：维护者要求仅从比较页隐藏 Opt8 coset 39.7 秒实验行，源码、冻结构件、原始结果与保护记录全部保留。后续 AI 先读 [Opt8 WASM 实验存档](experiments/cube48opt-rust/opt8-wasm-experiments.md#2026-10-15-coset-page-row-archived-research-retained)，不能把页面隐藏理解为删除研究或重新运行旧标签；既有运行规则不变。

当前状态：维护者再次要求“启动”后，原版 Opt8 的 `original-opt8-local4-20261015` 已正常完成，固定 WCA100 / 4 线程 / 单轮零预热耗时 44.984614785 秒，全部 100 条独立验解及最优长度核对通过，guard 退出 0，Swapouts 48→48。保留的 Rust WASM 正式版为 33.368675666 秒，耗时少 25.82%；同机同协议、不同时间测量，Rust 未重跑。原首次启动的内存不足记录保留，门槛未降低。一次性 receipt 已消费，禁止重复运行或覆盖结果。已回填本地比较页，不提交、不推送、不发布；Rust padded 实验仍暂停。

2026-10-15 最新任务：维护者明确要求补测原版 cube48opt Opt8 WASM，仅本机、同一固定 WCA100 原序、4 个搜索线程、单轮、不预热，与已保留 Rust WASM 正式版 33.368675666 秒比较。原版 WASM 字节不改，私有 JS wrapper 可复用已验证的线程 mailbox 兼容修复；统一 Node 24.21.0 / TurboFan（`--no-liftoff`），表加载与独立验解不计入求解时间。沿用本轮已批准的同一 boot / Swapouts 48，不覆盖任何旧保护/结果，出现新增换出立即停止，不自动重试。Rust padded 状态布局实验仍暂停，本任务不跑 Rust、Opt9 或其他档位，不发布。

2026-10-15 最新维护者指令“不需要发布”：后续本任务仅本地，不再提交、推送、发布。新 WASM `lazy-normal-four` / `lazy-normal`（含根界跳层与延后普通侧群乘法）已分别冻结到 build-UXKCJq / build-ZR8n93，完成小内存正确性检查。维护者针对“保留旧停止记录、经内存复核为本轮建立 Swapouts 48 新基线”的明确问题回复“你就先优化和测试 opt8”，因此仅授权本轮 Opt8 100 条 / 4 线程 / 每候选单轮零预热，新 `opt8-lazy` scope；不得运行 Opt9。旧 Swapouts 16→48 保护停止仍原样保留且禁止重启，新 scope 继续新增换出立即停止、独占大表与至少 2 GiB 余量保护，不自动重试。详情见 `../docs/optimal-solver-benchmark.md`。

2026-10-15 WASM 两档优化：网站按 Opt8 8 GB / WCA100 / 4 线程、Opt9 16 GB / WCA1000 / 16 线程分别比较，各候选一轮不预热，原版不重跑。新 `coset-batch-four` 实测 Opt8 39.668 秒，慢于保留正式版 33.369 秒，不晋升；新 `coset-batch` Opt9 在载表阶段系统 Swapouts 16→48 触发保护，0 条结果，无性能结论。`.tmp/cubeopt-reverse/wasm-opt8-opt9-20261015/stop.json` 与所有旧记录保留，不重设基线、不重启、不复用标签。新源码及构件已冻结，小数据证明/验解通过，但正式原生与服务器 WASM 未替换。详细证据见 `../docs/optimal-solver-benchmark.md`。下方历史授权不得覆盖此次保护停止。

2026-10-14 维护者新增长期任务要求：必须可验证地断点续算；同一个完整任务的求解器及大表常驻，批次边界不退出、不重载、不定时轮换。仅完成、用户停止、错误、授权到期或资源保护触发时退出，保留结果、原 boot/Swapouts 基线及保护记录。双底 Opt10 通过既有 guard 的 `double-zbll-opt10-session` 入口常驻；其他研究/单批入口时限不变。验收须检查连续批次使用同一 guard/native PID。详见根 AGENTS.md 和 docs/double-zbll-trainer.md。

2026-10-14 Opt8 WASM 最新任务：维护者要求先在本机优化/对比，固定 WCA 前100条、4线程、每版一轮、不预热，本机正确且更快后替换线上，不再做服务器性能测试。现用 V4 本机 37.794 秒；quarter-fixed 研究构件 32.324 秒；与线上 ABI 匹配的四线程发布构件 build-FcRcSF 为33.369秒（减少11.71%），均100条独立验解/最优长度通过。原 V4 保留，表不重建，Opt8 退休表仅只读用于本次实验。Mac Node v24.21.0 默认/Liftoff 路径在4GiB以上地址有已复现坐标错误；两版统一使用 --no-liftoff，300次有界高地址检查通过。失败的零结果首跑与旧资源基线保留，专用 opt8-local-policy.mts 只放行固定构件和协议，禁止自动重复标签。原生 Opt9/Opt10 正式选择不变。详见 experiments/cube48opt-rust/opt8-wasm-experiments.md；发布完成另以事务、当前指针及 READY 证据为准。

2026-10-14 正式版本晋升：维护者已指定Opt10最快coset24.591秒版为正式默认，其他实验归档。唯一正式选择在 `experiments/cube48opt-rust/opt10-release.json`；默认入口 `run-opt10.mts` 只选择已验SHA的 `target/opt10-official/release/cube48opt-research`，仅Opt10 solve。`opt10-release.mts install|verify|status` 仅安装/核验冻结构件，不加载表。其余9份快照以 `opt10-archives.json` 原位归档，保留源码、程序和报告，禁止覆盖或重复消费旧标签。不要给Cargo全局default加coset：它依赖Opt9实验features；不要覆盖通用程序、WASM或旧target/opt10的生成/ZBLL验证绑定。实际运行仍须guard和独立review，沿用旧资源基线；本次只完成本地晋升和比较页数据更新，不新跑基准，不授权发布。下方“默认版本未替换”等为晋升前的历史记录。

2026-10-14 Opt10第四轮已收尾：维护者明确20秒是尽力探索目标，不苛求。本轮数学候选lookahead27.438秒、projection25.501秒，均未超过保留coset24.591秒；此前coset-chain25.483秒，gated微调未跑正式基准。固定WCA1000原序、16线程、每版单轮零预热，各1000条独立验解及四份参考最优长度核对通过。profile发现96.689%节点在剩余10–12步，诊断耗时不排名。projection确有新增12层拒绝，但总节点仅降1.20%，未转化为本轮耗时改善。原33.032秒、hotpath25.145秒、coset24.591秒及所有实验/诊断源码、程序与证据已完整冻结；不覆盖默认feature或旧程序，不重建主表，禁止重复消费旧标签。仅本地未提交、推送或发布，不启动其他档位；正式结果以 `experiments/cube48opt-rust/opt10-native-experiments.md` 为准。

2026-10-14 Opt10继续：维护者要求争取20秒以内，保留原33.032秒及25.145秒版。仍为固定WCA1000原序、16搜索线程、每个新候选一轮不预热，仅本地。既有基准不重跑；新candidate使用独立target与证据，强制核对已保留的hotpath快照。复用同一表，运行保护与旧Swapouts/停止记录保持，不授权其他档位、重建表或发布。

第二轮已完成：batch 29.764秒、dual 27.827秒、coset 24.591秒，各1000条独立验解及最优长度通过；均未达到20秒。coset以直接查询的陪集证书清父帧反侧半转，不增加查询阶段；本轮最快单次，但总节点略增，不能宣称约2.2%差异稳定。原版、hotpath及三候选全部冻结，默认feature不变。pathmax经数学和小数据证明新增剪枝冗余，保留草稿后撤回，未跑正式基准。所有已消费的候选标签不可重跑，详见 `experiments/cube48opt-rust/opt10-native-experiments.md`。

2026-10-14 Opt10 新任务：维护者明确要求先测当前 Rust 原生 Opt10 基准，再探索将耗时减半；未达到也如实保留结果。沿用相同 WCA 前1000条、16个搜索线程、每版一轮不预热，仅本地。复用已验收 Opt10 v2 主表和 Opt9 辅助坐标快照，不建表、不运行其他档位；原 Opt10、原版 Opt9 / 55.8秒 / 43.2秒均保留。基准与各候选采用独立target/源码及证据快照，经既有guard监控，旧系统启动、Swapouts基线和停止记录不得覆盖或重设。下文 Opt10“只分析不运行”的旧阶段限制由此次明确授权取代；不授权推送或部署。

本轮 Opt10 已完成：baseline 33.032秒、search 25.666秒、hotpath 25.145秒，三个版本各1000条独立验解通过、无保护触发，未达到耗时减半。非默认 `opt10-native-search` / `opt10-native-hotpath` 使用独立target；三版源码、程序与原始证据已分别冻结，详见 `experiments/cube48opt-rust/opt10-native-experiments.md`。不能重用已消费的三个测试标签或覆盖原快照。Opt9各保留版本不受影响。

2026-10-14 第三轮：维护者要求继续争取 30 秒以内，保留原版 70.55 秒、55.80 秒及 43.23 秒版的完整源码/程序。43.23 秒版另封存于 `.tmp/cubeopt-reverse/opt9-native-fixed-preserved-20261014/`，逐文件 manifest 已核验。仍为同一 WCA1000、16 个搜索线程、每个新候选一轮、不预热，不重新跑保留基准。新候选使用非默认 feature、独立 target、既有 guard 与同一资源基线；只在本地实验。Opt10 本轮只审查数学适用性，不据 Opt9 成绩推算 Opt10 提速。G/H/I/J 已完成各一轮（45.685/47.140/45.611/46.145 秒），均验解通过但未超过 F，当前最佳仍为保留的 43.231 秒；完整实验记录见 `experiments/cube48opt-rust/opt9-native-experiments.md`，不得重复运行这些已消费的候选标签。

2026-10-14 继续实验：维护者要求争取低于 40 秒，原版 70.55 秒及上一轮 55.80 秒版均须保持可用。55.80 秒源码、程序、原始结果和资源证据另封存于 `.tmp/cubeopt-reverse/opt9-native-55s-preserved-20261014/`，有逐文件摘要清单。新候选沿用相同 WCA1000、16 线程、各一轮、不预热，只在新的独立 target 构建运行；不覆盖旧程序、不重新运行旧基准。复用现有表，运行保护和本地不发布范围不变。

2026-10-14 最新范围：维护者授权实验优化 **Rust 原生 Opt9**，原版必须继续可用。固定 WCA 前 1000 条、16 个实际搜索线程、每个候选单轮不预热；目标 60 秒以内，40 秒为探索目标。默认 Cargo 功能与 `target/multithread` 原版保留，候选用独立 `target/opt9-bpmx` / `target/opt9-dynamic`，仅非默认 feature 启用。源码、程序及原基准备份在 `.tmp/cubeopt-reverse/opt9-native-baseline-20261014/`，过程见 `experiments/cube48opt-rust/opt9-native-experiments.md`。复用现有 Opt9 表，不恢复旧档位、不重建大表，不做服务器测试或发布。大表实验仍经现有 guard，旧停止记录和 Swapouts 基线不得清除或重设，失败不自动重试。

2026-10-13 最新范围更新：维护者仅保留本机三阶最优研究 Opt9 与自研 Opt10 v2 两张主表及所需 Opt9 坐标快照。Opt1–8、H7/H10 与旧 Opt10 partial 已移入废纸篓（清单 `.tmp/cubeopt-reverse/table-retirement-20261013.json`），不得因旧文档的保留/默认统计约定自动恢复或补建。旧 H10 统计入口目前缺表，尚未迁移；服务器 Opt8 保持原状。比较页只展示 Rust 原生 Opt9/Opt10。当前只汇报 Opt10 优化方案，不运行新基准；WASM 修复已取消。下列旧授权与库存说明保留为历史，以最新范围为准。

2026-10-13 最新指令：维护者已确认先做 Rust Opt9 编译的 WASM 与原版 WASM 对照，固定 WCA 前 100 条一次、无额外预热；更快且正确兼容才发布。线上实际为 Opt8，发布需验证对应档位而不能直接用 Opt9 占满服务器内存。随后测试并优化自研 Rust Opt10；所有实际计算仍须接入具备对应预算的研究 guard，先完成小档生成器独立对照，再启用 Opt10 大表路径。H9 取消、H11 禁止运行、旧程序/表/原始报告保留。

2026-10-13 后续指令：维护者已取消 H9 建表及测试；16 线程进程已停止，跟进自动化已暂停，未生成完整 H9 表。下述 H9 授权保留为历史，不能据此重启。当前只开发 Rust Opt10 代码与有界小数据校验，不启动 Opt10 大表生成、加载或求解；H7/H10 及 Opt1–9 旧表、旧程序保留。

2026-10-13 维护者追加授权：仅补建 H9 并用 Rust H9 测固定 WCA 前 100 条一次，不预热、不重复。
建表复用唯一 `table_generator --only h48-h9` 入口，必须经研究 `guard.mts`，
`CUBEOPT_BACKEND=h9gen`、`RAYON_NUM_THREADS=16`、`CUBE_TABLE_DIR` 为本仓库 `solver/tables` 绝对路径。维护者随后明确要求停止 4 线程运行，保留日志并改为 16 线程重新建表；不重设 Swapouts 基线。
进程树预算为 15,169,187,432 字节表加 2 GiB，启动再留 3 GiB；共享旧 Swapouts 基线、锁与停止记录。
H7/H10 旧表保留，不并行驻留计算，不授权 H10/H11 重建。H9 校验完成后，Rust 求解按既有 h48 守卫执行。

H48 h10 求解及算法对照按根 `AGENTS.md` 的 2026-10-12 更新执行：允许原版与实验版在持续运行时监控下启动，无需系统级防换出机制或单次 hash 许可；新增换出、压力异常、RSS 超限或保守余量不足 2 GiB 即停止并保留结果。H10/H11 大表重建仍受原启动限制。算法探索记录见 `../docs/h48-algorithm-research.md`，保留原版源码、程序和主表，候选通过独立补丁构建。

cube48opt Opt1–9 Rust 独立研究按根 `AGENTS.md` 的 2026-10-12 专项授权执行：建表、查表、求解、验证与基准必须由 `experiments/cube48opt-rust/guard.mts` 启动，`CUBEOPT_VARIANT=1..9` 选择档位；入口按模式设置预算，持续检查进程树 RSS、内存压力、同次系统启动的 Swapouts 及至少 2 GiB 余量，保护触发后保留结果且不得重设基线自动重启。不得直接启动该研究原生程序的 `solve`、`oracle.mjs generate|query|solve`、`validate.mjs` 或 `benchmark.mjs`；静态 `inspect`、`small`、`verify-small` 和小表坐标校验可直接运行。这是独立研究入口，不替换下述日常 H10 统计与统一建表流程，不授权 H10/H11 大表重建，也不代表操作系统已禁用 swap。

Rust H10 融合研究同样使用该 guard：`CUBEOPT_BACKEND=h10` 显式选择已有 30,336,314,216 字节 H10 表，`solve-h10` / `query-h10` / `h10-benchmark.mjs` 的大表运行必须受监控；C 与 Rust 顺序运行，一次只驻留一份大表。小型 `verify-h10.mjs` 坐标检查仅读取辅助段。此授权来自维护者要求接入 H10 并同内存对照，不授权大表重建；原 Opt1–9 通过默认 `CUBEOPT_BACKEND=opt` 保留。

Rust H48 泛化研究按根 `AGENTS.md` 的 2026-10-13 更新执行：`solve-h48 H TABLE [CONTEXTS MAX_DEPTH MAX_NODES]` / `query-h48 H TABLE` 本机仅开放 H0–H10，必须经 `experiments/cube48opt-rust/guard.mts` 并显式设置 `CUBEOPT_BACKEND=h48`、与 CLI 一致的 `CUBEOPT_H=0..10`。guard 核对实际表文件大小和主表头档位、布局，按单表大小及预留内存设预算；沿用研究锁、时限、同次系统启动的 Swapouts 基线和停止记录，新增换出、压力异常、RSS 超限或保守余量不足 2 GiB 即停止，不得并行驻留多份大表或重设基线自动续跑。此更新限于已授权研究范围内的现有表查表和求解，不新增 Nissy H48 建表授权，不替换日常 H10 统计，也不自动授权其他批量或长期计算。旧 Opt1–9、H10 专用入口及根规则中的 AUF 例外保持。

H11 只实现代码：允许静态检查和不接触 H11 表文件的小数据算术/单元测试；本机禁止 H11 建表、表文件加载或映射、查表、求解及基准。guard 与 CLI 在表文件读取前拒绝明确的 H11 请求，无环境变量豁免；不得通过改名程序、表路径或其他入口绕过。H11 格式支持、内存预算充足或更换硬件都不等于获得运行授权。

求解器磁盘表的唯一日常生成入口是 `cargo run --release --bin table_generator`（CWD=`solver/`）；仅补 SQ1/H48 h10 分别追加 `-- --only sq1` / `-- --only h48-h10`。小档位建表验证追加 `-- --only h48-h7`，H7 不替代统计所需的 H10。三阶整解离线统计使用 `333opt/solve_h10.mts` 读取 H10，不再生成 cubeopt9。不要让后续 AI 直接跑 ignored 建表测试、`333opt/gen-table.mjs` 或上游 nissy-core 工具。表目录由 `CUBE_TABLE_DIR` 控制，生成器自动记录逐表耗时与峰值内存；H48 h10 的 RSS 警戒线 57 GiB，线程默认使用可用并行度。完整命令、源码入口、进度查看与验收记录见 [HIGH_MEMORY_TABLE_PROFILE.md](HIGH_MEMORY_TABLE_PROFILE.md)。

H48 建表禁止用 file-backed mmap / MAP_SHARED 将输出 `.tmp` 当工作内存。先在进程内存生成，调用 `nissy_checkdata` 校验，顺序写 `.tmp` 并同步后原子改名；不可因旧 H11 内存事故直接退回文件映射。本机实测该映射方式慢几个数量级。已完成表在求解时只读映射是另一条路径，仍须遵守上述 H11 禁令。当前生成器与进度查看器支持 H7/H10，日常原生求解器和 TS 统计入口使用 H10，独立 Rust 研究入口另按上述 H0–H10 规则执行；nissy-core 此版本 64 位 `H48_HMAX=11`，H11 表为 60,670,567,784 字节（56.50 GiB），H12 不能只改数字，须先有上游算法支持。未来若明确授权运行 H11，仍须同步各入口、表大小、内存预算、进度和文档，不得只替换单个常量后宣称可用。

修改 H48 遍历或进度前，先读 [vendor/nissy-core/VENDOR.md](vendor/nissy-core/VENDOR.md)：保留固定上游的短状态遍历边界及分布校验基准，不得为凑进度 100% 多处理最后一个哈希槽，或修改期望分布掩盖差异。计算路径有改动时先用统一入口完成 H7 建表与上游校验，再重新生成 H10；H7 成功不能代替 H10 自身验收。

三阶魔方 Cross / F2L 阶段最优解分析器,从 D:\cube\solver(C++17)移植到 Rust。下方 2026-05-28 快照记录当时的移植进度；当前生成与统计入口以上文和 HIGH_MEMORY_TABLE_PROFILE.md 为准，设计决策见 PORTING_NOTES.md。

本仓库**同时**承载以下两类历史核心 binary，并已新增其他求解器，详见 `src/bin/`；共享 cube_common / move_tables:
- **solver 系列** (`*_analyzer`):IDA* + prune table 解单个 scramble,源 = `D:\cube\solver`
- **dist 系列** (`dist_*`):完整 BFS + 聚合算分布,源 = `D:\cube\solver_wip\*`

## 移植快照(2026-05-28；当前建表状态以上文与 HIGH_MEMORY_TABLE_PROFILE.md 为准)

- ✅ 基础层 cube_common / move_tables / prune_tables / prune_create 100% 移植,36 张 Canon pt 表的 gen 函数已就绪
- ✅ std_analyzer 二进制可用:Cross(默认)+ XCross(env CUBE_RUN_FULL_STD=1)+ XXCross/XXXCross/XXXXCross(再加 CUBE_ALLOW_HUGE_TABLES=1),全 30 列 **golden bit-exact**(前 20 scramble 对齐 scramble_1000_std.txt,83.7s)
- ✅ pseudo_analyzer 二进制可用:Cross + XCross + XXCross(默认,~415MB 表)+ XXXCross(env CUBE_ALLOW_HUGE_TABLES=1,~1.8GB 表),全 25 列 bit-exact 匹配 golden
- ✅ pair_analyzer 全 4 阶段、eo_cross_analyzer 全 5 阶段:均强制 CUBE_ALLOW_HUGE_TABLES=1,**已 golden bit-exact**(前 20 scramble 对齐 D:\cube\solver\golden\scramble_1000_pair.txt / scramble_20_eo.txt,pair 25 列 / eo 31 列全匹配)
- ✅ pseudo_pair_analyzer 全 4 阶段(强制 CUBE_ALLOW_HUGE_TABLES=1),**已 golden bit-exact**(前 20 scramble × id+24 列全匹配 scramble_100_pseudo_pair.txt,该文件只 20 行)。曾有 bug:ins_C_diff / pspair_CE 两个 16-元数组按 corner-major 构建却按 edge-major(`slot1*4+pslot1`)访问,非对角槽位读错表,已改 edge-major 构建
- ℹ️ std XXCross+ 关键事实:C++ search_2/3/4 仅靠 huge 表(C4C5E0E1 相邻 / C4C6E0E2 对角)剪枝,逐槽 SlotView move-table 查表是重构死代码(只赋值从不剪枝),Rust 端直接省去,等价且更快
- 🧪 table_generator 独立 binary:默认 73 张表(12 mt + 61 pt)沿用已验收路径;总物理内存 ≥56 GiB 自动追加的 5 张 EO high-memory 表已在 64 GiB Mac 上生成，SQ1 与 H48 h10 也由统一入口生成;已存在表可跳过;当前生成实测见 HIGH_MEMORY_TABLE_PROFILE.md
- ✅ dist_xcross_1col 单色底不固定槽 XCross 分布,bit-exact 对齐 golden(total=695,280,402,432,000;聚合 ~6.7s,vs C++ AVX2 6.24s)
- ✅ dist_xcross_1col_fixed 单色底固定 BL 槽 XCross 分布,11 深度 bit-exact (total=72,990,720, 1s)
- ✅ dist_xxcross_1col_{adj,diag} 单色底固定双槽 XXCross 13 深度分布,bit-exact (total=21,459,271,680;adj 144s vs cpp 161s,diag 132s vs cpp 178s)
- ✅ dist_cross_{1col,2col,6col} 单/双/六色底 Cross 分布,bit-exact (1col 45ms,2col 38ms vs cpp 300ms,6col 32s vs cpp 21s)
- ✅ dist_cross_6col `--faces <UDLRFB 子集>`:任意底色集的 Cross 分布,同一个 12!·2¹¹ 分母。四色底(去掉一对相对色)Avg 5.0194,三种取法逐位相同;`--faces U` / `--faces UD` 分别 = 5,160,960× / 192× 单双色金标(参数化路径的正确性证明)
- ✅ dist_xcross_2col 双色 (D4h 16-elem) 不固定槽 XCross 11 深度分布,bit-exact (total=43,252,003,274,489,856,000;1048s vs cpp 877s)
- ✅ dist_tracked 通用「盯住 k 角 + m 棱」分布 bin(2026-08-03):preset 化,`verify` 一次对八条已知曲线(cross/pseudo_cross/122/222/123/xcross/eo/eoline)+ 三条恒等式(σ 的 y 折叠 / 混口径两种拆法 / EdgeSet 商掉 m!);已跑出 **223 15.3 亿 14s**、**eo_xcross 46.7 亿 40s**、**F2LEO 十字 + 伪 F2LEO 十字各两个口径 2.6s**。后者关键是 `EdgeSet`:目标只要求「朝向好」的那几条棱**互不区分**,商掉 m! 后 51 亿→2.13 亿、11.2GB→753MB。待跑单元与回填流程见 `EXACT_DIST_EXPANSION.md`
- ✅ dist_*_0f 11 个 0 步状态数(xcross/xxcross/xxxcross × 1col/2col/6col + xxxxcross × 2col/6col),纯容斥 + dist/combo.rs,全部 bit-exact 对齐 cpp 输出
- ⏭️ dist_xxxcross_1col_fixed 跳过 — 2.2 TB visited 不可跑(32GB 机器)
- ⏭️ dist_xxcross_1col(6-min 折叠不固定槽)跳过 — 695T 全空间研究级,cpp 端自己都没解出来
- ⏭️ dist_xxxxcross_1col 跳过 — 350 TB visited
- ⏭️ dist_xcross_6col 跳过 — cpp 端 v5/v6/v7 都有 bug,没有可对照 golden
- ⏭️ dist_cross_pair_1col 跳过 — cpp 端 v1..v4 用户都不确定哪个对,无可信 golden
- ⏭️ dist_*_state / _Nf 等 scramble 生成器/per-state 输出工具,非分布 bin,不优先
- ✅ state_cross_1col 单色 cross 8 步各深度 scramble (190K 行,0.06s,count bit-exact)
- ✅ state_cross_2col 双色 cross d=8 各 (W_idx,Y_idx) 配对的 IDA* 解 (3672 scrambles,1.5s vs cpp 30s,无 golden 文件)
- ✅ state_xcross_1col_fixed_10f 固定 BL 槽 XCross 10 步各深度 scramble (73M 行,55s,count bit-exact)
- ⏭️ state_xcross_1col_10f 跳过 — cpp 自己说"里面混入了很多不是10步的"
- ⏭️ state_xcross_2col_10f 跳过 — 仅输出 d=10 count,已被 dist_xcross_2col 取代
- ⏭️ state_xcross_2col_10f_state / state_xcross_6col_10f / state_xxcross_1col_12f / state_xxcross_1col_fixed_12f_state / state_xxcross_2col_12f 跳过 — pruning 表 ≥10GB 或 parent tracking ≥100GB,32GB 机器跑不动

## 硬约束

- env 开关(可选):
  - `CUBE_RUN_FULL_STD=1` 启用 std_analyzer XCross(pt_cross_C4E0 52MB)
  - `CUBE_ALLOW_HUGE_TABLES=1` 启用 mt_edge6 / pt_cross_C4C*E0E* / pt_pscross_E0E1E2 / pt_pscross_C4C5C6 等 ≥800MB 表
  - `CUBE_TABLE_PROFILE=auto|default|high-memory` 覆盖表档位;默认 auto,总物理内存 ≥56 GiB 选 high-memory,识别失败回落 default
  - pseudo_analyzer 默认会拉 ~415 MB 表(Cross+XC+XXC),按需可用 `CUBE_PSEUDO_SKIP_X*CROSS=1` 跳过
- 单元测试 RAM 增量 ≤ 200MB、落盘 ≤ 10MB;ignored 测试 ≤ 1GB / ≤ 100MB
- 测试用 `target/test-tables/<name>/` 隔离 + 前后清,**禁止污染** `./tables/`

## 构建 / 运行 / 测试

```sh
cargo check
cargo build --release
cargo test --release
printf '%s\n' 'testdata/scramble_5.txt' | ./target/release/std_analyzer
printf '%s\n' 'testdata/scramble_5.txt' | ./target/release/pseudo_analyzer
```

仅需补表时使用统一入口，例如 `cargo run --release --bin table_generator -- --only h48-h10`；可选目标为 `rust`、`sq1`、`h48-h7`、`h48-h10`。启用 std XCross 时给分析器命令设置 `CUBE_RUN_FULL_STD=1`；启用 pseudo XXXCross 时设置 `CUBE_ALLOW_HUGE_TABLES=1`。
**全 analyzer × scramble_5/100 的端到端验证 + 计时 + diff golden,用 `scripts/verify.mts`**(需 huge 表在 `./tables/`):
从仓库根运行 `pnpm --dir core solver:verify`(对照 golden)/ `pnpm --dir core solver:verify --generate`(重建 golden 基线)。详见 TESTING.md。

## 文件地图

| 文件 | 职责 |
|---|---|
| `src/cube_common.rs` | State / Move / 索引 / rot_map / conj_moves_flat / state_space / create_multi_move_table* / 表 I/O / string_to_alg / test_env_lock |
| `src/move_tables.rs` | MoveTableManager 单例,12 张 mt 表 ensure_*/release_*;mt_edge6 panic 保护 |
| `src/prune_tables.rs` | PruneTableManager + PackedPruneTable(4-bit packed,low=偶 idx high=奇 idx) |
| `src/prune_create.rs` | 13 个 BFS 引擎家族,翻译 C++ prune_create.cpp 全部 create* 函数 |
| `src/cross_solver.rs` | Cross 阶段 IDA*(std/pseudo 共享,is_pseudo 切表) |
| `src/xcross_solver.rs` | std XCross/XXCross/XXXCross/XXXXCross IDA*(search_1 pt_cross_C4E0;search_2/3/4 纯 huge 表 1/3/(4+2) 张,死 SlotView 已省;new(with_huge)) |
| `src/pseudo_xcross_solver.rs` | Pseudo XCross(4 pscross_C4E[diff] 表,16 task,search 内 **不** conj) |
| `src/pseudo_xxcross_solver.rs` | Pseudo XXCross(2-subset Aux,72 task,trans_moves 双路径) |
| `src/pseudo_xxxcross_solver.rs` | Pseudo XXXCross(3-subset Aux + 2-subset 补漏,16 task,三路径,需 huge) |
| `src/pair_solver.rs` | Pair analyzer 4 cascade(VirtState 7 量,2 huge table optional,Phase 7) |
| `src/eo_cross_solver.rs` | EOCross + EOXCross 4 cascade(12 sym → 6 rot 折叠,Phase 8) |
| `src/pseudo_pair_solver.rs` | PseudoPair 4 cascade(ConjStateXC + AuxState 6 表,16×ins/pspair,Phase 9) |
| `src/executor.rs` | run_analyzer_app trait + rayon 并行 + CSV 输出(替代 C++ OpenMP) |
| `src/logo.rs` | 开屏 CUBEROOT logo,移植 C++ logo.h:`print_logo_block`(默认,6 bin 启动调,赤陶 #D97757)+ `print_logo`/`print_logo_v4`/`print_claude_cube_logo`;ANSI 24-bit + Unicode,std-only(Win32 控制台 UTF-8/VT 走 kernel32 FFI)|
| `src/bin/std_analyzer.rs` | std_analyzer 二进制 main,6 旋转 × 5 cascade = 30 列 CSV |
| `src/bin/pseudo_analyzer.rs` | pseudo_analyzer 二进制 main,6 旋转 × 4 cascade = 24 列 CSV |
| `src/bin/pair_analyzer.rs` | pair_analyzer 二进制,scramble + 4×6 = 25 列 CSV |
| `src/bin/eo_cross_analyzer.rs` | eo_cross_analyzer 二进制,id + 5×6 = 31 列 CSV |
| `src/bin/pseudo_pair_analyzer.rs` | pseudo_pair_analyzer 二进制,id + 4×6 = 25 列 CSV |
| `src/dist/bfs.rs` | dist 共享:通用 byte-valued BFS 距离表(raw-byte race-permit) |
| `src/dist/packed2.rs` | dist 共享:2-bit 四色波前 BFS,无深度上限,按层精确计数+最深态见证 |
| `src/dist/packed4.rs` | dist 共享:4-bit packed BFS(nibble CAS + AVX2 64-nibble 块跳过),`bfs_xxcross_packed4` (e×c layout) |
| `src/dist/mask.rs` | dist 共享:28 个 popcount==2 mask + 28×28 disjoint 邻接 |
| `src/dist/combo.rs` | dist 共享:组合数学(perm/binom/POW2/POW3/FACT/count_legal_states/w_sub),0 步容斥用 |
| `src/bin/dist_xcross_1col.rs` | dist_xcross_1col 二进制:单色 XCross 11 个深度分布(AVX2 聚合) |
| `src/bin/dist_xcross_1col_fixed.rs` | 固定 BL 槽 XCross,11 深度 BFS,1s |
| `src/bin/dist_xxcross_1col_{adj,diag}.rs` | 固定双槽 XXCross,13 深度 4-bit packed BFS(~10 GB visited + 3 GB mt_edge6),~140s |
| `src/bin/dist_cross_{1col,2col,6col}.rs` | 1/2/6 色 Cross 分布(_2col 走 W/Y 独立 495×495 mask 容斥;_6col 走 6 BFS + AVX2 32-batch min-reduction,`--faces` 收窄取 min 的面集) |
| `src/bin/dist_xcross_2col.rs` | 双色 XCross 分布(D4h 16-elem,8 张 109MB pruning 表,70 partition × 24 perm × 16 ori × AVX2 conv3,11 深度),~17 分钟 |
| `src/bin/dist_tracked.rs` | 通用 tracked-piece 分布:A×B 两因子(Corners/Edges/EdgePos/EoWord/**EdgeSet** 分量拼)+ 多源 packed4 BFS;目标集开关 `fold_y`(两条 EO 轴取最短)/ `d_offset`(伪口径);`verify` 对八条金标 + 三条恒等式;大 preset 走 `CUBE_ALLOW_HUGE_TABLES=1` |
| `src/bin/first_layer_gods_number.rs` | First Layer 258.66 亿态严格直径证明器,2-bit 6.02GiB,默认使用可用 CPU 并行度,25GB硬限,不进浏览器 |
| `scripts/run_first_layer_gods_number.mts` | First Layer God 数一键运行:A/B 整层断点、资源门、实时进度/ETA/日志 |
| `EXACT_DIST_EXPANSION.md` | 站内「完整状态空间」缺的那些格子的台账:坐标 / 内存 / 算法 / 跑法 / 回填清单 |
| `src/bin/dist_*_0f.rs` | 11 个 0 步状态数 bin(容斥;1col 子空间 / 2col,6col 全空间 + cube laws) |
| `src/bin/state_cross_1col.rs` | 单色 cross 1..8 步 scramble,输出 1..8.txt(190K 行) |
| `src/bin/state_cross_2col.rs` | 双色 cross d=8 配对 IDA*,输出 cross_2_col_state.txt(3672 行) |
| `src/bin/state_xcross_1col_fixed_10f.rs` | 固定 BL 槽 XCross 1..10 步 scramble,输出 1..10.txt(73M 行) |
| `.cargo/config.toml` | -C target-cpu=native(分布计算 AVX2 必需,solver 系列也受益) |
| `tests/e2e_cross.rs` | default e2e,Cross 13 列对照 golden |
| `tests/e2e_xcross.rs` | ignored e2e,XCross 13 列对照 golden |
| `tests/e2e_pseudo.rs` | ignored e2e,PsCross+XC+XXC 18 列 + 全 24 列两个测试 |
| `scripts/verify.mts` | 一键跑全 5 analyzer × scramble_5/100、计时、diff golden;`--generate` 重建基线 |
| `testdata/scramble_{5,100}.txt`、`testdata/golden/` | e2e 输入(上游测试打乱)+ 期望输出(golden = 本程序受信任输出,前 20 行已对齐 C++) |
| `DEFINITIONS.md` | 块/槽/位置图 + 5 analyzer 阶段语义 + 索引约定对照(从上游 README 移植,使仓库自包含) |
| `TESTING.md` | 测试输入/golden 说明 + scripts/verify.mts 用法 + scramble_5/100 实测耗时表 |
| `PORTING_NOTES.md` | 5 个 phase 的设计决策、C++ 端歧义、表 magic 升级、命名差异。**改代码前必读** |
| `README.md` | 进度表 + 上手命令 + env 清单 + 路线图 |
| `HIGH_MEMORY_TABLE_PROFILE.md` | 333-eo 自动内存选档、表预算、H10 生成实测与后续验收项 |
| `333opt/` | 三阶整解最优统计：TypeScript 编排 + 原生 nissy-core H48 h10，详见下节 |
| `lsll/` | 同上,LSLL 最优解管道。`corpus.txt` **579,368 个 case**(`node solve_loop.mjs`),每个展开 16 个首尾 AUF 像取最短 ⇒ 9,268,992 次求解。**算的是 case 的最优不是代表元的最优**,判据 = 解的首末招不是 U 系。详见其 README |

## 三阶整解最优 HTM：统一 H48 h10

离线三阶整解统计由 `solver/333opt/solve_h10.mts` 调用原生 nissy-core H48 h10。表为
`solver/tables/h48-nissy-core/h48h10.dat`，由统一 `table_generator` 生成，大小固定
30,336,314,216 字节。从 `core/` 运行 `pnpm stats:scramble:local --jobs 333opt` 自动续解、注入统计；
完整命令、数据口径和本地一键入口见 `solver/333opt/README.md`。

以后更新三阶整解统计也用 H10。旧 `solver/333opt/solve.mjs`、`solve_loop.mjs` 和
`gen-table.mjs` 是历史 opt9 路线，不要作为统计或建表入口。`core/apps/api/src/cubeopt/`
及 `/scramble/solver` 的在线服务另有运行边界；LSLL 子阶段的旧 WASM 流程也不等于三阶整解统计。

## 表格式(Rust 自有,不兼容 C++ .bin)

- Move 表:magic `b"CUBESLV1"`(8 字节)+ u32 LE entry_count + u32 LE data
- Prune 表:magic `b"CUBEPT01"`(8 字节)+ u64 LE entry_count + 4-bit packed bytes(EDGE6×CORN2 维度需 u64)

## 源工程对照

- C++ 源:`D:\cube\solver\`(只读参考,**别改**)
- Golden CSV:`D:\cube\solver\golden\*.txt`、`D:\cube\solver\scramble_*_std.csv` 等
- 架构图:`D:\cube\solver\ARCHITECTURE.md`(四层 base/data/executor/app)
- 表清单:`D:\cube\solver\table_naming.csv`(角色 Canon/Conj/Zombie、文件名、大小)
- create 引擎清单:`D:\cube\solver\create_functions.csv`
- `reference/claudecode.cpp`:存档的 C++ 原文件(生成 cube_root.svg 的矢量 logo,**SVG 生成逻辑未移植**;Rust 端只借其字模做了终端版 `print_claude_cube_logo`)

## 缩写约定(全项目一致)

sz=size、ed=edge、cn/corn=corner、cr=cross、ps=pseudo、ins=insertion、ex=extra、mt=move table、pt=prune table、adj=adjacent、diag=diagonal。新命名跟上。

## 工程规矩

- LF only(全局 git autocrlf=false + .gitattributes 已设)
- UTF-8 无 BOM
- 不加新依赖(memmap2 + rayon + std 够用)
- 测试 隔离 + 前后清 `target/test-tables/`
- 不写多余注释 / 多余 .md
- 改公共类型(State / Move / PackedPruneTable / 表 magic)前先看 PORTING_NOTES.md

## 给下一个 AI 的最优先 TODO(按依赖顺序)

solver 系列(6 analyzer + table_generator)全部移植并 golden bit-exact,剩余只有 dist 续译:

1. **dist 系列续译**:`D:\cube\solver_wip\` 还有 ~30 个 cpp(xxcross_1_col / cross_6_col / pseudo_cross_* 等),都同模板。每加一个新 dist bin:`src/bin/dist_<name>.rs` + 复用 `src/dist/{bfs,mask}.rs`,共享需求(y 旋转映射 / 4-bit packed 表 / 通用 AVX2 聚合等)成熟后再补到 `src/dist/`

每完成一个,在 PORTING_NOTES.md 追加一段 `## Phase N+` 记设计决策,在 README.md 进度表打勾。


2026-10-15 Opt8 native WCA100/4-thread run completed: 33.593746037 seconds; 100 verified optimal solutions; guard exit 0, Swapouts48 unchanged. Scope opt8-native-wca100-4-20261015 is consumed: do not rerun. User requested 32G candidates only, explicitly no 32G testing yet.


2026-10-15 Opt8 native quarter candidate completed: WCA100 / 4 search threads / one pass / no warmup, 26.402382370999998 seconds, 100 independently verified optimal solutions, Swapouts48 unchanged. Page selects this result. Scope opt8-native-quarter-wca100-4-20261015 is consumed; do not rerun. Preserved baseline33.593746037, binary and table remain intact. Non-default opt8-native-quarter feature only applies to variant8. Isolated measured source and executable: `.tmp/cubeopt-reverse/opt8-native-quarter-source-20261015/`. 32G still not authorized to run.

2026-10-15 Opt8 native 6 solves/s follow-up completed: five new single-pass WCA100/4-thread candidates (specialized 29.881s, search 29.848s, batch 34.523s, search/native-cpu 27.434s, quarter/native-cpu 40.114s) all verified 100 optimal solutions, guard exit0, Swapouts48 unchanged. None beat retained quarter26.402s; page remains3.8/s, target6/s not achieved. Every new receipt is consumed; do not rerun or replace the selected result with an experimental one. Frozen source/binaries/raw output and negative findings are retained; read `../docs/optimal-solver-benchmark.md` section “Opt8 native follow-up toward 6 solves/s” and `.tmp/cubeopt-reverse/opt8-native-6ps-20261015-summary.json` before further optimization. Background CPU workload was observed; single-pass differences do not isolate compiler/algorithm effects. A/B/C features remain non-default. No publish and still no32G testing.

## 2026-10-17 日常统计切换正式 Opt10

维护者明确要求将日常 333 整解统计切到正式 CubeRoot Opt10（32G 档）。此条取代上文日常必须使用 Nissy H10 的约定；不授权重建大表。`solve_h10.mts` 保留兼容文件名，默认 `H10_ENGINE=opt10`，使用 `opt10-release.mts verify` 核验的正式制品及 `.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat`（31,130,911,744 字节），不能与旧 H10 表互换。`H10_ENGINE=c|rust` 保留显式旧后端，须自行具备旧表。

统计专用 `scramble-stats-opt10-session` 经过原 guard，共享正式制品历史资源审查、独占锁、换出/压力/RSS/2 GiB 余量保护；不使用 ZBLL 的基线重审或到期例外，不重设已有基线。单进程、单批次 worker、默认最多16个搜索线程，全语料期间只加载一次表，已有 `out.0.csv` 按 ID 续算，逐行落盘。这里只修改入口，不启动整轮统计、不发布。下一次运行快捷指令仍按其原有完整计算后发布语义执行。

2026-10-17：维护者另行明确授权“允许，复核后准备好，我自己启动”。统计独立审查保存在 `.tmp/scramble-stats-opt10/review-20261017.json`，绑定当前启动标识、Swapouts 48、旧保护记录和入口源码指纹；不改旧基线、不使用 ZBLL 续跑授权。统计保护停止写入该目录的 `protected-stop.json`，存在则不能自动续跑。入口预检提前检查该审查、余量与独占状态，避免先跑完其他阶段才发现无法启动 Opt10。准备过程不加载大表、不启动统计。

### 2026-10-17 日常 Opt10 统计启动规则更新（维护者明确授权）

维护者同意取消历史换出计数锁定、保留运行保护，并要求开始续跑。仅 `scramble-stats-opt10-session`：每次用户主动启动时核验正式制品、当前压力、可用内存和独占锁，以当前 boot/Swapouts 建立本轮固定基线；历史非零计数或旧停止记录不再永久阻止新任务。运行中不得更新基线，新增换出、异常压力、RSS 超限或余量不足仍立即停止，不自动重启。每轮基线、资源采样及停止证据单独保存在 `.tmp/scramble-stats-opt10/runs/<timestamp>-<pid>/`，保留全部旧记录及求解结果。此条取代此前日常统计对48/80的逐次批准要求，不扩大到其他研究或建表任务。
