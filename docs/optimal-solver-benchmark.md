# 三阶最优求解器公开 Benchmark

## 2026-10-15：补齐已记录的节点计数，无需重跑

维护者要求记录搜索节点并删除图表横轴。已从 11 份保留原始日志完整提取，核对 corpus 顺序、原始摘要及逐条数量；Rust 逐 worker/depth 累加与 search.nodes 一致，原版每条只取最终累计 `N/M node(s)` 的 N。页面改为“引擎节点计数”数值展示，不绘制跨实现节点条形图，完整定义与证据放在下载数据。未因此重跑求解。

| 档位与样本 | CubeRoot Rust WASM | 原版 cube48opt WASM |
| --- | ---: | ---: |
| Opt8 / WCA100 / 4线程 | 1,717,133,808 | 2,384,839,394 |
| Opt9 / WCA1000 / 16线程（Rust A） | 9,983,318,127 | 13,926,702,773 |

Rust `nodes` 是每个非空 context 的处理次数，包含叶检查（`src/search.rs` stage1a 在叶判断前递增）；原版 N 是 `step1_query` 有效槽位 popcount 累加，叶检查先标记停用，因此不是严格同义。原版 M 是空闲/停用槽位计数，不是初始化节点；`pnode` 是上一 IDA 深度结束的累计 N，已包含在最终 N，绝不能再次相加。不能直接把两列比例称为搜索减少百分比。逐条耗时及资源记录本来已保留，当前不新增其他页面指标。

## 2026-10-15：Opt9 四候选完成，转入 Chrome 对照

**Chrome 本轮终态：内存保护停止，0 条性能样本；其余三个范围未启动。** 原版 Opt8 已通过 Chrome155 的 memory64/shared-memory 能力检查；Rust8/9 分别以4/16个真实 Worker 完成3条独立最短验解的小数据检查，未读取主表。首次 Rust8 小检查发现浏览器 TextDecoder 不接受 SharedArrayBufferView；仅在生成的浏览器宿主适配中复制小段 JSON 输出后解码，冻结 WASM/搜索源码与主表未改，原失败记录保留，修复后两档小检查均通过。小检查无性能分数，也不是 WCA 预热。

2026-10-15 11:07:20 UTC，原版 Opt8 Chrome 的完整表已分块载入并校验，但还未 ready/求解，guard 采样进程树 RSS 9,989,849,088 字节，超过该范围上限9,831,860,592字节，自动停止，退出1。Swapouts仍48、压力1，触发时保守余量15,040,004,096字节；本次原因是任务 RSS 上限，**不是系统内存不足或新增换出**。浏览器额外开销超过了这次相对 Node 仅增加256MiB的预算，后续若继续须重新审查浏览器预算与记录，不得直接抬上限重跑。共同stop阻止继续其余范围，未启动Rust8或任一Opt9浏览器性能测试，未重设基线。

证据位于 `.tmp/cubeopt-reverse/wasm-browser-20261015/` 的 session、stop、receipt、stdout/stderr及original8目录；资源终态为同级 `wasm-browser-original8-20261015-resources.json`。results.jsonl为0字节，无ready/result/report性能数据。guard清理了进程组，root随后按PID出生时间/完整命令身份及专用Chrome profile独立复核无残留，写入exit.json与post-stop-cleanup.json。原有Node成绩保持。此轮无自动重启、不发布。

固定同一 WCA1000 原序、16 个实际搜索线程、单轮、零预热，Node 24.21.0 / V8 TurboFan。四次 guard 均正常退出 0，各 1000 条独立回放与参考最优长度全部通过；运行中压力正常、Swapouts 48→48，未触发保护。原版基准未重跑。

| 候选 | 冻结构件 | 总求解秒数 | 进程树峰值字节 |
| --- | --- | ---: | ---: |
| Opt9 专用批查询 A | `build-gLDBF5` | 81.081181706 | 16,442,589,184 |
| padded B | `build-AigbMy` | 83.673328202 | 16,350,314,496 |
| 批查询 + padded C | `build-CZO3Yd` | 84.303642843 | 16,554,213,376 |
| select D | `build-6zU5tn` | 83.683323292 | 16,595,091,456 |
| 保留原版 cube48opt9 | 原始 WASM | 83.655909546 | 见保留报告 |
| 保留 Rust quarter | `build-6bonwj` | 93.745204850 | 见保留报告 |

A 本轮比保留原版耗时少 3.08%，比保留 quarter 少 13.51%。这是一轮、不同时间的测量，不能据此声称稳定的 3% 优势；原版仍保留 431+569 条跨会话续跑事实。B、D 与原版接近，C 略慢。A 的搜索节点为 9,983,318,127；283,414 个已穷尽分片与保留 quarter 一致，最小运行余量 10.9873 GiB。所有旧版本与完整结果保留；页面默认只展示 A 与原版，未部署或替换正式构件。

独立报告位于 `.tmp/cubeopt-reverse/wasm-{opt9-batch,opt9-padded,opt9-batch-padded,opt9-select}-20261015/opt9-report.json`。修改后续 Chrome 入口前，四轮使用的 guard、policy、reporter 和 harness 已按各 review 的摘要归档至 `.tmp/cubeopt-reverse/wasm-opt9-round-controls-20261015/`，以冻结文件为历史复现事实源，不用后来修改的工作树文件冒充当时源码。

维护者接着明确授权本机 Chrome 两边都测：Opt8 为 WCA100 / 4线程；Opt9 为 WCA1000 / 16线程，均一轮不预热。原版与 CubeRoot 各一轮，Chrome 成绩独立于 Node；Rust8 使用 `build-FcRcSF`，Rust9 使用最快 A。仅新增浏览器 Worker/HTTP Range 传输适配，不改冻结 WASM 搜索代码。启动额外余量沿本次明确指令为 1 GiB，运行余量仍为 2 GiB，同 boot / Swapouts48，串行单表驻留，共用整轮停止记录。先做不加载主表的能力与小数据线程验证，再运行四个性能范围。当前 Chrome 性能尚未完成，不能把 Node 的 81.1 秒标为 Chrome。

下方“暂缓”“尚无成绩”等段落为历史过程，当前状态以上述已完成报告为准。

## 2026-10-15：Opt9 专用 WASM 查表优化

**维护者最新调整：启动额外余量由 3 GiB 改为 1 GiB，并要求测试。** 仅本轮四个 Opt9 候选适用，总启动门槛为 19.4204 GiB；运行中 2 GiB 余量、RSS 预算、压力和 Swapouts 48 基线均不变。A 先前未消费的 review 原样存为 `session-preflight-3gib.json`，与 `preflight-failure.json`、旧 stdout/stderr 一同冻结进入新 review 的历史证据；新运行日志使用 `opt9-run.stdout.log` / `opt9-run.stderr.log`。四份实际 WASM 不重新编译，仍各运行一次。第一版已通过新启动检查，开始运行，最终成绩以独立报告为准。

**最新授权：维护者随后明确“可以测试了”。** 允许四个已准备候选按本章同一协议顺序测试，撤销下方暂缓状态；同 boot / Swapouts 48 的独立范围保留旧保护证据，不从旧失败 scope 重启。先补组合和 select 的实际 WASM 小数据验证，再接固定构件、独立输出/receipt 与本轮共同 stop 边界。任何候选保护触发都阻止继续其他候选；原版及 quarter 旧成绩复用，不发布。启动时仍核验至少 21.4204 GiB 可回收内存和原有运行中保护。

**当前执行状态：四版小数据验证通过，首次启动被内存门槛拦截，尚无新性能成绩。** 新组合版 `build-CZO3Yd` 与 select 版 `build-6zU5tn` 各完成 11,790 次独立浅层验解；select 的 3,072 项独立解码检查通过。生产 WASM 字节分别与旧 `draft-RT74yX` / `draft-VeHD7Z` 相同，原草稿完整保留。下方暂缓阶段的描述仅是历史记录，以本节最新授权和实测记录为准。

2026-10-15 10:26 UTC，A 的真实 guard 启动命令以 `Insufficient memory` / exit 1 拒绝。随后样本可回收内存为 22,623,354,880 字节，低于所需 22,999,955,824 字节；复核约 21.27 GiB，仍低于 21.4204 GiB。boot 未变、Swapouts 48、压力等级 1；无其他求解进程。求解器未启动，receipt 未消费、结果目录和本轮 stop 均不存在，没有主表加载或新增换出。证据保存在 `.tmp/cubeopt-reverse/wasm-opt9-batch-20261015/{session.json,preflight-failure.json,opt9.stdout.log,opt9.stderr.log}`，不可覆盖；后续资源达标可继续未消费的 A 范围，保留首轮启动失败日志，不需重复请求本轮测试授权。

四候选策略和报告器已冻结，14 项局部纯逻辑/构件校验通过。policy SHA-256 为 `7fbb560018fa8fd210d471ae0f3f5679c5db889b4a9894b90fad39b6db4ee0d5`，reporter 为 `8a8b479a70db877e78828c80d2f7f49f5e3573f3f05dbcf0991ae10ba9acc8a7`；hook 仅同步精确依赖 SHA，真实 guard 调用仍由其内存检查拒绝。未修改原生默认、正式 WASM 或网页成绩，未提交、推送或发布。

| 新验证构件 | 构件目录 | build-metadata.json SHA-256 |
| --- | --- | --- |
| opt9-batch-padded | `build-CZO3Yd` | `0a457f1e6df65141a78a57546df49c460fe69873bd0ea80cb8fa4f527f82b443` |
| opt9-select | `build-6zU5tn` | `790e8dccc214d012cae4c4bf4538b0b6a1d3ee2133ba3fa06c44791f3c7364af` |

维护者重新指定本轮优化 CubeRoot Opt9 WASM 16G，目标快于保留原版 cube48opt9 WASM 的 83.655909546 秒；对照的当前 Rust quarter 版为 93.745204850 秒。固定 WCA1000 原序、16 个实际搜索线程、各新候选一轮零预热，保留所有旧构件、源码和原始结果，不重跑原版、不发布。原版结果由先前 431 条与续跑 569 条组成，Rust quarter 为连续单轮；两次会话的局限保留在完整协议，不能隐去。

### 已定位的执行路径差异

保留 quarter 构件 `build-6bonwj` 的实际 WAT/ARM64 输出显示，Opt9 仍走 `GenericOracle`，每次坐标计算调用多档位 `index64`，默认 `lookup_batch` 逐槽读取后解码；对应 TurboFan 通用批函数为 19,520 字节。Opt8 正式路径早已使用固定档位坐标和先批量读取、再解码。现有专用 Opt9Oracle 则被绑在失败的 coset 实验 feature 下，不能单独启用。这是已核对的生成代码差异，不是加速结论。

新增非默认 adapter feature `wasm-opt9-batch`，独立复用固定 Opt9 坐标和批量读取，保留 quarter 剪枝，关闭 backward coset、根界跳层、延后普通侧乘法和 padded 状态。表、索引含义、查询槽位、搜索规则和线程调度不变。小数据验证同时检查所有档位、scalar 坐标、批解码及真实 16 线程；正式原生、正式 WASM 和旧构件不变。

已完成冻结构建（同一源码摘要 `a3bff95a41691e29e8eed0c5c23ff54a6abd2a65ab38be681c0d0b0da9102f21`）：

| 候选 | 构件目录 | WASM SHA-256 | 状态 |
| --- | --- | --- | --- |
| opt9-batch | `build-gLDBF5` | `17d66df66935894e28a5ee0c7494853f79444c96eac3b9b2b9d4832eedcfb545` | 小数据通过；性能测试暂缓 |
| padded-state | `build-AigbMy` | `59da71ddda187745680daa21c671a6749aee6779e57cb2bfefdd4b284245f2f3` | 小数据通过；性能测试暂缓 |

目录均在 `.tmp/cubeopt-reverse/rust-wasm-shared-builds/`，保留每次独立 target、日志、checker、源码快照与 `build-metadata.json`。两份实际 WASM 各通过 11,790 次浅层独立最优验解（262 状态 × 9 档位 × 1/2/4/16/18 线程）、133,578 次坐标比较、3,072 次 Opt8/9 批解码与 18,432 次通用解码检查；另覆盖深前缀、取消及 worker 生命周期。生产构件无 fixture 导出，小数据阶段没有加载主表，不是性能测试，也不计入随后 WCA1000 的预热。padded checker 还在上述坐标样本执行全部 18 种真实 SIMD 配对群乘法、换侧后连续移动与逆移动恢复，并断言 Cube20/Storage24/Frame64；native 同 feature 仍保留原20字节路径。构件只留本地，不晋升或替换正式版。

`wasm-padded-state` 是第二份隔离源码：外部 Cube20 保持，搜索帧用显式零尾部的 24 字节状态，Frame64，使边块完整 SIMD 读写合法。旧 V5 Cube24 已做过同类每步指令简化，因此它仅作为当前多线程框架的独立布局实验保留，未安排本轮全量测试，不与 batch 混合。

### 按维护者要求继续准备，尚未测试

- `opt9-batch-padded` / `wasm-opt9-batch-padded`：组合上述专用批量查表与搜索帧 SIMD 布局。只读审查未发现交界冲突：坐标仍只接收合法 Cube20 引用，批查询只存独立 u64 索引。但两份单独构件通过不代表组合通过，之后必须独立验证组合。
- `opt9-select` / `wasm-opt9-select`：在专用 Opt9 批查询中，每个有效槽位先读取目标 word 和同一对齐 16 字节块的 header，再选择 code0/header 或 code+10；目标降低条件解码分支。`None` 不读表，边界检查保留，Opt8 和旧 batch 路径不变。额外读取及临时存储可能反而更慢；源码中的条件表达式是否生成 WASM select 以及净收益均不能凭代码假定。

两版均保持原表、quarter 剪枝和现有线程调度，关闭 coset/root/lazy；select 不包含 padded。新 build 的 `--compile-only` 只执行 Cargo 编译并冻结源码/WASM/wrapper/worker，单任务 `-j1`，不创建 WASM 实例、不执行 fixture、不载表。草稿只有 `draft-metadata.json`，明确 compiled-unverified；不写正式 `build-metadata.json`，禁止以编译成功冒充已通过验证或获准运行。

两份草稿均已编译成功，未执行正确性或性能测试，保存在同一 `rust-wasm-shared-builds/` 下：

| 候选 | 草稿目录 | WASM SHA-256 | WASM 大小 |
| --- | --- | --- | ---: |
| opt9-batch-padded | `draft-RT74yX` | `42a0ba87ea6fbe06682fa563d5f2d1139583005664a34891a300a1ffe3804bb4` | 130,755 B |
| opt9-select | `draft-VeHD7Z` | `c2359a9b97138d4df27bfaf163c765afd13a0eef223e272bcfcf5700f185c2db` | 134,136 B |

暂停后未运行任何新测试。保护策略代码保持未授权，hook 仅同步该已审阅依赖的精确 SHA；此最后 hash 同步没有追加运行时 hook 检查。后续实际启用新范围时再验证真实拦截行为。本地旧源码/构件/成绩与保护记录全部保留，没有提交、推送、发布或替换正式版本。

待后续明确允许测试且资源达标时，先从各冻结快照做必要的小数据校验：marker、固定坐标、全部码值/块头回退/None、padded 配对群乘法及真实 16 线程；select 的独立 3,072 项 synthetic fixture 已写好但尚未运行。然后才为被选择的版本建立独立一次性 guard 范围，按固定 WCA1000/16线程/单轮零预热测量并独立回放全部结果。原版 83.655909546 秒、Rust quarter 93.745204850 秒不重跑。现有 batch scope 仍锁定旧冻结构件并要求工作树源码匹配，新草稿已改变工作树源码，因此不能直接拿该 scope 运行；后续需审阅并绑定实际冻结版本，不覆盖旧构件，不为通过校验静默重编旧版。

资源复核时同 boot 的 Swapouts 为 48、压力等级 1、无其他求解计算；可回收约 12.85 GiB，低于既有 Opt9 启动门槛 21.4204 GiB。未加载主表，未运行新 WCA1000。旧 16→48 停止记录保留；此前 Opt8 的 48 授权和 receipt 不自动扩展到 Opt9。本轮新 scope 先准备为 fail-closed，只有新运行范围明确、资源达标后才允许启动，绝不降低门槛或覆盖旧记录。

## 2026-10-15：原版 Opt8 本机基准完成

维护者明确要求补跑原版 cube48opt Opt8 WASM：固定 WCA 前 100 条原序、4 个搜索线程、单轮、零预热，仅本机，与现有 Rust WASM 正式版 33.368675666 秒比较。原版 WASM SHA-256 `63e2f0c1c24c9ed6bf5be09040578f22ca091f0fd417ccf5d81dce26f472b5f7` 不变，私有 JS wrapper 复用已验证的 pthread mailbox 兼容修复，补丁后 SHA-256 `8be9ddb568e96df55dbe0ba457d23a2e1440c395625b328ac80d87909e3a50ba`。使用相同 Node 24.21.0 / TurboFan、同一 Opt8 表和相同计时边界；不运行 Rust 或 Opt9。

现有 guard 增加一次性 `opt8-original` 范围，输出根目录 `.tmp/cubeopt-reverse/original-opt8-local4-20261015/`。沿用已批准的同一 boot / Swapouts 48、9,563,425,136 字节 RSS 预算及额外 3 GiB 启动余量，旧 16→48 停止记录及所有完成结果继续绑定。首次启动前检查以 `Insufficient memory` 退出 1，求解器未启动、receipt 未消费、0 条结果。当时可回收内存 11,731,861,504 字节（约 10.93 GiB），低于所需 12,784,650,608 字节（约 11.91 GiB）；压力等级 1、Swapouts 仍 48。原始 stderr、session 和 `preflight-failure.json` 均保留。维护者随后明确要求“启动”，重新复核可回收内存 18,068,602,880 字节、同 boot / Swapouts 48、压力正常且无其他计算后才启动；未降低门槛或重设基线。

准备阶段的 12 项计时/协议/兼容检查与 8 项 guard 范围检查通过。实测正常退出 0；独立报告器复核全部 100 条回放、参考最优长度、原版构件与私有兼容补丁、协议和保护记录，生成 `opt8-report.json` 后回填本地页面。

| 本机 Opt8 / 8G / WCA100 / 4 线程 / 单轮零预热 | 总求解时间 | 独立验解 |
| --- | ---: | ---: |
| 原版 cube48opt WASM，本次补测 | 44.984614785 s | 100/100 |
| CubeRoot Rust → WASM 正式版，复用保留成绩 | 33.368675666 s | 100/100 |

Rust 耗时少 25.82%，原版耗时为 Rust 的 1.348 倍。两次测量在相同机器、同表、相同 Node/TurboFan 与相同计时边界下进行，时间不同；这是一轮对照，不估计重复测试波动，也不据此宣称全网最快。此次没有重跑 Rust 或 Opt9，也没有替换任何求解器构件。

原版峰值求解器 RSS 8,076,361,728 字节、进程树峰值 8,399,142,912 字节、最小保守余量 14,277,689,344 字节，Swapouts 48→48、压力正常、无保护触发。报告 SHA-256 `f165222be3b03314630bd0f0780585418669d711dff721fbb6e4b46c8a2a79d6`；原始结果 SHA-256 `88def20d70dd34c00bc9a1ac996a421b6630f2274bc1339491af0e72992fb73e`。一次性 receipt 已消费，所有原始结果及旧记录保留，不覆盖或重复运行。用户要求结果写入本地比较页；仅本地、不提交、不推送、不发布。Rust padded 实验仍暂停。

## 2026-10-15：WASM 工作量与每节点成本优化（进行中）

维护者要求继续从底层显著提升 Opt8 / Opt9 WASM；采用条件仍为同条件真实成绩优于保留基准，不以源码、小数据计时或静态机器码证明全量加速。Opt8 保持 8 GB / WCA100 / 4 线程，Opt9 保持 16 GB / WCA1000 / 16 线程，各新候选单轮零预热，保留旧构件，不重跑原版。上一轮 `wasm-opt8-opt9-20261015/stop.json` 的 Swapouts 16→48 记录不可覆盖；用户随后仅批准本轮 Opt8 以 48 为基线，具体范围与实测见下文。Opt9 不运行。

并行审查的事实与新方向：

- 同 WCA1000 的保留原生正式版为 9,814,932,764 节点 / 12,478,556,794 次查询、42.098 秒，保留 WASM quarter 版为 9,954,986,953 节点 / 12,659,707,012 次查询、93.745 秒。搜索节点差约 1.43%，不能用大量额外搜索解释 2.23 倍耗时；主要需要改善每节点执行成本与宿主调度。
- WASM 原始结果含 18,708 次深度屏障，其中 12,261 次每个工人最多一个节点。由 `d(g)=d(g^-1)` 与可采纳下界，`max(h(g),h(g^-1))` 以下的深度可在派发前排除。已在独立 `wasm-root-bound` feature 中实现，保存两侧根界、逐工人一致性及实际开始深度，不伪造被跳过层的工人完成记录。所有新增查询计入计时和查询数；旧 ABI 回退保持原样。
- 既有原生 profile 显示普通侧仅约 37.39% 节点查询。候选推迟普通侧 `gM` 的构造，先计算并检查 `M^-1 g^-1`；逆侧拒绝时无需普通侧状态。必须保持前缀构造、NISS 换侧、复原判断、掩码与所有权、查询顺序和最优性，小数据精确 trace 先验证。这是原生诊断所支持的机会，尚非新 WASM 全量性能结论。
- 编译审查已确认两版都是 memory64 / shared / SIMD，Rust 已用 O3 与 fat LTO，不能归因于未打开优化开关。实际 V8 ARM64 有界微型函数检查发现，将坐标基址固定成常量仍保留 memory64 的 `cmp/b.hs` 越界检查，代码反而由 64 字节增至 72–80 字节，因此不采用该方向、不改坐标快照布局。证据在 `.tmp/cubeopt-reverse/wasm-codegen-audit-20261015/audit.md`。

延后普通侧乘法使用非默认 `wasm-lazy-normal`：逆状态始终完整，普通状态暂存父状态和一步移动，只在逆侧通过后补算。叶节点用 `g^-1=e` 等价判断；前缀、NISS 换侧、分裂与继续展开前恢复完整配对。`Frame` 仍为 56 字节、`Cube` 仍为 20 字节。原 96 例完整查询轨迹摘要保持 `6d17ca1f6d7bb115`（4,718 次查询、896 次缓存复用、1,250 次分裂）；真实 WASM 小坐标校验另比较全部 18 种单侧 SIMD 群乘法与标量、原配对实现。拆开原有配对 SIMD 也可能有成本，未做全量实测前不能声称加速。

页面按维护者最新要求直接在条形图实现名后写 `8G / 16G`，删除重复候选表、进程树峰值列和峰值内存指标；完整精确内存记录仍在下载 JSON。提交 `049d3ea7c9`，本地 typecheck 与 Opt8/Opt9 实际浏览器核对通过。维护者随后明确“不需要发布”，检查时 Deploy Next `38700638948` 的部署及 Vercel 均已成功，无法再取消该已完成流程；已告知用户，从此后只保留本地，不再提交、推送或发布。未发布任何候选 WASM。

源码修改只在非默认 feature 中进行；正式原生、正式 WASM、主剪枝表不变。两份冻结构件如下，源码摘要同为 `ce0cf7fa3696f91e29ace97d443579cf85d2f8e743ae5945f473e541077a0862`：

| 计划测试 | 候选 | 冻结目录 | WASM SHA-256 | 浅层独立验解 |
| --- | --- | --- | --- | --- |
| Opt8，100 条 / 4 线程 | lazy-normal-four | build-UXKCJq | 09b20de0852d49436b762aeda188f7b0d5214f37756cb328c3ed606660922b0f | 7,074 |
| Opt9，1000 条 / 16 线程 | lazy-normal | build-ZR8n93 | f9326c55ef5ac26a9d0d0ad4ab463e5033d3678959f66868eddd74a707f92906 | 9,432 |

每份构件另有 524 条真实 WASM 非零根界诊断：Opt8 / Opt9 各 262 条独立 BFS 样本，每档 228 条发生跳层、排除 336 个深度，逐一核对所有被排除深度小于最优长度；还检查调用者深度不足返回未解、下一条打乱重置及有限节点限额拒绝。4-worker 构件验证线程数 1/2/4，18-worker 构件验证 1/2/4/18，正式 Opt9 仍按 16 线程协议。9 项 Node 证据校验通过，生产构件不含 fixture 导出。构建检查没有加载主剪枝表，不能充当性能结果。

初次编译的 cfg 裸赋值语法和首次小数据检查的旧取消标记问题均已修复：后者仅发生在小数据深前缀辅助入口，新打乱开始前补清标记，生产取消检测未放宽。失败构建和检查记录保留。

用户针对本轮“旧记录保留、资源复核后以当前 Swapouts 48 建立新基线”的明确问题回复“你就先优化和测试 opt8”，将授权缩小至 Opt8。仅为 `build-UXKCJq` 创建新的 `opt8-lazy` scope（固定 100 条、4 线程、一次、不预热），旧 coset scope 继续锁定 16 和原停止记录，不重启旧任务。新 scope 的命令、构件、语料、旧历史证据、运行标签与输出路径全部固定；当前内存压力正常、Swapouts 48、无其他求解任务。Opt9 构件仅保留，不运行。此次本机范围禁止提交、推送与发布。

### Opt8 延后普通侧计算：不采用

`build-UXKCJq` 唯一一轮实测 **47.134233168 秒**，比保留正式版 33.368675666 秒多 41.25%。100 条独立回放和对应最优长度全部通过，正常退出 0，Swapouts 48→48、压力等级 1，未触发保护。证据为 `.tmp/cubeopt-reverse/wasm-opt8-lazy-20261015/opt8-report.json` 及同目录原始结果、receipt、exit；进程树峰值 8,183,513,088 字节、最低保护余量 12,981,878,784 字节。正式版不替换。

对齐两版的 2,260 个相同深度、相同工人且完整穷尽的分片，nodes / probes / jobs 逐项相同，合计 822,532,320 节点和 1,055,321,843 查询。总节点仅由 1,717,133,808 降至 1,716,906,064，99/100 条反而更慢，支持执行成本上升而非搜索工作量增长的判断。跳过 1,196 个深度只省下 4,784 次工人返回和 4,488 次查询，另增加 1,600 次根界证明查询；不能把这些浅层屏障视为主要耗时。日志没有逐节点 CPU 计数或 JIT 记录，不把墙钟时间/聚合节点冒充 CPU 指令成本。

为分离两个改动，第二候选只保留根界跳层，恢复原配对 SIMD 状态运算：`root-bound-four`，冻结 `build-vkpXmK`，WASM SHA-256 `1a3761bd29fcd97063081220005a30e2cc3690244d790910323aaa5908394758`，通过 7,074 条浅层独立验解。新 `opt8-root` 标签保持同一已批准的 48 基线，先前失败和成功证据均保留，仍只跑一次 WCA100 / 4 线程，不预热。

第二候选实测 **39.103082627 秒**，全部 100 条独立验解及最优长度核对通过，退出 0、Swapouts 48→48，仍慢于保留版 17.19%，不采用。搜索节点 1,717,411,128，未发生实质工作量下降；进程树峰值 8,123,416,576 字节、最低余量 14,235,025,408 字节。证据：`.tmp/cubeopt-reverse/wasm-opt8-root-20261015/opt8-report.json`。恢复配对运算后低于 lazy 候选，但单轮且编译布局不同，不把耗时差全部定量归因于某条 SIMD 指令。

### 原版 WASM 的实现差异与下一步

原版 Opt9 的 `fastcube` 为三个 16 字节块（配对角块、普通边块、逆边块），移动实现直接 `v128.load/store`；已测 93.745 秒 Rust WASM 用两个 20 字节 `Cube`，12 字节边块需要尾部重排及 64+32 位分段存储。证据分别是 `.tmp/cubeopt-reverse/variants/opt9.wat` 的 `step4_domove` 与 `open-benchmark-20261015/rust-wasm-opt9-quarter-fixed/source/build/solver/experiments/cube48opt-rust/src/cube.rs`。原版工作供需协调位于 WASM pthread/condition_variable 内，Rust wrapper 则每层通过 JS Promise/worker 消息协调。实现差异可确认，但尚未量出各项对原版领先约 10.1 秒的贡献。

原版日志节点合计 13,926,702,773，Rust 为 9,954,986,953，两边计数/遍历/任务拆分没有等价契约，不能比较每节点速度或据此断言原版剪得更多。原版 83.656 秒仍是 431+569 断点续测，Rust 93.745 秒是连续单轮；没有重跑或隐藏该边界。Opt8 的 33.369 秒是我们正式版，原版 Opt8 在本机尚无同条件成绩。

第三候选只尝试非默认 WASM 状态填充：保留外部 `Cube` 20 字节布局，用 24 字节包装为每份状态补足 4 字节，允许从包装整体安全读写 16 字节边块。预期 `Frame` 由 56 增至 64 字节，以较少重排/分段存储换取少量状态空间。只在 quarter-fixed-four 基础上启用，不混入已失败的 root-bound/lazy/coset；是否提速待实际构建与单轮验证，不提前采用。

## 2026-10-15：Opt8 / Opt9 分组与 WASM 陪集候选

维护者本轮要求先更新网站，再优化两档 WASM。Opt8 固定 8 GB 表档、统计管道前 100 条、4 线程；Opt9 固定 16 GB 表档、前 1000 条、16 线程。每个新候选一轮、不预热，仅本机，原版与旧 Rust 不重跑。页面分组展示，禁止跨组比较总秒数；Opt8 目前没有同条件本机原版 WASM 成绩，不能用阿里云旧结果补位。页面基准更新提交 `506ca9adcf`，独立于求解器发布。

候选沿用相同表字节，仅增加搜索证明和 WASM 实现优化：

- 直接反向陪集证明：孩子 `gM` 的下界达到 `r+2`，则父节点的陪集距离至少 `r+1`；左半转不会降低该距离，所以可清除父节点仍拥有的反侧半转分支。证明在普通 BPMX 修改 excess 之前使用，方向由保存的 NISS side 位确定，不改缓存或其他线程分支。
- Opt9 专用 Oracle 在构造时固定坐标布局，复用既有 `index9`；补齐与 Opt8 相同的八槽先加载、后解码。Opt8 / Opt9 最大下界均为 13，非零二位码加 10，零码仍读取块头。
- 非默认 `wasm-coset-batch` 开关，原生默认和正式构件不变。实际运行记录 `cosetRemoved` 与 `quarterRemoved`，不能只凭代码声称剪枝生效。

构件完整保留于 `.tmp/cubeopt-reverse/rust-wasm-shared-builds/`：

| 档位 | 候选 | 目录 | WASM SHA-256 |
| --- | --- | --- | --- |
| Opt8 | coset-batch-four | build-K1O5W7 | 47ef75332d6b4e50e62d7265a33003617df1e061cf26e62935d795534e83c3b6 |
| Opt9 | coset-batch | build-UkHMsS | 6b1f35015ca48cc44ad9ad64780e9e4e571bfc51d77c4795801a8c5166cfa487 |

预检：3,502 个 BFS 状态、56,032 次有界搜索的最优解一致，17,010 次有效父证明、100,852 个半转位删除；NISS/拆分所有权测试通过，原流水线 96 例精确摘要保持 `6d17ca1f6d7bb115`。实际 WASM 构建各通过 7,074 / 9,432 条浅层独立验解、坐标和生命周期检查，以及 3,072 个含全部编码和空槽的解码检查。零下界浅层解不证明剪枝正确，非零可采纳 CO 校验和正式逐条验解共同补足。

正式运行使用 `wasm-dual-candidate-policy.mts` 的两个一次性标签，仍由原 `guard.mts` 执行。沿用用户已批准的同一 boot / Swapouts 16，旧 Swapouts 0 保护历史完整保留；资源不足不启动，任一保护或失败阻止重试，Opt8 成功才允许 Opt9。原始结果、构件、资源与独立报告保存在 `.tmp/cubeopt-reverse/wasm-opt8-opt9-20261015/`。

本轮结果：

| 档位 | 保留版 | 新候选 | 决定 |
| --- | --- | --- | --- |
| Opt8，100 条 / 4 线程 | 33.368675666 s | 39.667527956 s；RSS 7.986 GB，进程树 8.180 GB | 新候选慢 18.88%，不晋升 |
| Opt9，1000 条 / 16 线程 | Rust 93.745204850 s；原版 83.655909546 s | 载表阶段保护停止，0 条 | 无新性能结论，不晋升、不重跑 |

Opt8 全部 100 条再次独立回放、核对固定参考最优长度，并验证所有线程的深度屏障，正常退出 0。实际删除陪集半转位 38,233,566 个、等价四分之一转位 580,548,090 个，但节点仅从 1,717,133,808 降到 1,716,985,601（约 0.0086%），查表从 2,189,688,440 降到 2,189,507,487；额外规则未带来有意义的工作量下降。不能仅凭此次总耗时把全部退化归因到某条指令，也不能以单轮声称稳定差距；此候选收益不足，保留正式版。

Opt9 启动前可回收估计 27,760,476,160 B，超过已有预算加 3 GiB 的启动门槛，pressure=1、Swapouts=16。06:59:36 UTC 检测到系统 Swapouts=48（增加 32 页），立即终止进程组并正常清理研究锁，退出 1。触发时进程树 RSS 2,225,799,168 B、余量 21,360,902,144 B，仍在表加载阶段，结果文件为空。Swapouts 是系统级计数，日志不能据此断言由哪个应用造成；不能把压力正常、尚有余量等同于内核不会换出。保留 stop.json、session.json、receipt、资源与退出证据，不重设基线、不重启、不改统计口径。新 Opt9 构件可供将来获准复核资源后测试，当前不得作“更快”结论。

结果页面提交 `ba4333bff9` 已推送；Deploy Next `38696806668` 与 Test `38696806632` 均成功。线上浏览器确认 Opt8 的 33.4 / 39.7 秒及“未采用”，Opt9 的 93.7 / 83.7 秒旧基准与新候选“内存保护停止 / 0 条”。只发布比较页面和结果，未替换正式求解器或服务器表。CSS 交互控件选择器已按 CI 契约改为专用 class，未添加守卫豁免。

## 2026-10-15：Rust Opt9 WASM 剪枝补齐实验

用户明确要求保留原版 83.655909546 秒与旧 Rust WASM 99.882797158 秒，原版不重跑；新候选仍为相同 WCA1000 原序、16 搜索线程、单轮、不预热，仅本机。

构建 `build-6bonwj`，候选 `opt9-quarter-fixed`，WASM SHA-256 `cab08e553c5db5aacf5db7f4789bb537cb24da7ffaeab571a20bf1b8e0ef6193`。独立构建目录包含程序、wrapper/worker、源码快照、编译参数和小数据校验。旧 `build-Nv4Vc5` 与原版私有构件完整保留，摘要核对未变。

本次只补齐已经定位的 Opt9 四分之一转等价剪枝：旧 `quarter-fixed` 构建只在 Opt8 专用 Oracle 打开开关，Opt9 GenericOracle 继承默认 false。新非默认 feature 将该开关仅接到 GenericOracle 的 Opt9，其他档位不变；已有固定搜索上下文与父界传播继续使用。没有宣称已移植原生版的全部调度/CPU 优化。

数学依据是同一面的正反四分之一转相差半转，在逆状态坐标下落到同一左半转陪集，因此对应剪枝界相等，已有一侧拒绝证书可剔除等价兄弟分支。小表校验对 Opt9 的正反转逐面比较快速和标量坐标；全部 9,432 条浅层解、坐标与线程生命周期检查通过，不加载大表。正式运行记录 `quarterRemoved`，用于确认优化真实生效。

正式测试仅通过既有 guard 的一次性 `opt9-wasm-candidate-policy.mts` 入口执行，沿用原 boot / Swapouts 16 基线、内存预算和停止边界。原保护记录与两份旧结果摘要锁定；不得复用候选标签、覆盖旧报告或重设基线重跑。

| 实现 | 1000 条求解秒数 | 求解器峰值 RSS | 进程树峰值 RSS |
| --- | --- | --- | --- |
| 新 Rust WASM opt9-quarter-fixed | 93.745204850 | 16.0908 GB | 16.4126 GB |
| 保留 Rust WASM quarter-fixed（Opt9 剪枝未接入） | 99.882797158 | 16.0990 GB | 16.4621 GB |
| 保留原版 WASM（431＋569 续测） | 83.655909546 | ≤16.1775 GB | 16.1775 GB |

新候选比旧 Rust WASM 耗时减少 6.1448%，仍比原版多 12.0605%；**未达到超过原版的目标**。实际 `quarterRemoved=3,547,019,854`，搜索节点 `9,954,986,953`，证明新接入剪枝真实生效，不能据此把剩余差距全部归因于某个尚未测量的因素。原版续测与连续 Rust 单轮的限制仍适用。

全部 1000 条独立回放、对应最优长度、16 个搜索线程的逐层完成屏障核对通过，进程正常退出 0；Swapouts 16→16，未触发资源停止。新报告 `open-benchmark-20261015/rust-wasm-opt9-quarter-fixed-report.json`，完整原始结果与私有构件在同目录 `rust-wasm-opt9-quarter-fixed/`。本地页面并列三版；不替换线上、不覆盖正式原生版本，未提交或推送。

## 2026-10-14：原版 WASM 断点续测完成

本轮按用户要求保留前 431 条，仅从第 432 条（ID 1194001）续跑至第 1000 条。相同 WCA1000、Opt9 15.6 GB 表、16 搜索线程、单轮零预热，仅本机。原 431 行与合并文件前缀逐字节相同；续测 IPC 恰为索引 431–999 的 569 条，无重跑前缀。

| 实现 | 1000 条总求解时间 | 求解器峰值 RSS | 进程树峰值 RSS |
| --- | --- | --- | --- |
| 原版 cube48opt Opt9 WASM（JS 兼容修复） | 83.655909546 秒 | ≤16.1775 GB | 16.1775 GB |
| Rust Opt9 WASM quarter-fixed | 99.882797158 秒 | 16.0990 GB | 16.4621 GB |
| Rust 原生 Opt9 正式 fixed | 42.098461188 秒 | 15.6376 GB | 15.7223 GB |

原版前缀 34.568785544 秒＋续测 49.087124002 秒。Rust WASM 本轮比原版总求解耗时多 19.397%；没有证据称 Rust WASM 更快。原生与 WASM 分榜。原版合计来自两个进程会话，Rust 为连续会话；排除原失败尝试、表重载与验解耗时，不能冒充原版一次不中断的 1000 条测量。单轮没有估计波动。原版首段没有成功返回求解器 maxRSS，因此用首段进程树峰值与续测求解器峰值的较大值作为保守上界。

### 运行时修复与证据边界

- WAT 中 `_emscripten_yield` 检查线程崩溃标记后调用 `emscripten_exit_with_live_runtime`，所以 `unwind` 是外层信号，不能当成功吞掉。
- 原 JS wrapper 无条件执行 `Atomics.waitAsync(...).value.then(...)`。4 字节共享内存小测试复现同步 `not-equal` 返回字符串导致 TypeError；私有测试副本改为区分 async/sync，同步时让出事件循环再检查邮箱，并在 pthread 崩溃标记前保留异常栈。源码和 WASM 的上游原件未修改。
- **此次 569 条未再触发 unwind，也没有观测到新增的同步邮箱分支日志。因此已证实一个运行时兼容缺陷并完成续测，但不能声称原先第 432 条崩溃的唯一根因已证实，或长期稳定性已获验证。** 禁止为证明稳定性擅自重跑已完成基准。
- `original-wasm-compat.mjs` 只应用在私有原版 wrapper；WASM SHA-256 仍为 `a041e72e9a05182425722c18a1c262cd0ac6018014c5dcd817069693883a734f`，表 SHA-256 仍为 `eee54090252967ca2be6c5881defbe96deb2012cebd82de68497b795e962d42d`。

### 验收与保留

独立回放全部 1000 条，逐条与已有最优长度核对通过。guard 正常退出 0；同一 boot、Swapouts 16→16、压力等级 1，无资源保护触发。原保护记录、原失败记录、原前缀结果和已完成 Rust 两份报告全部保留。兼容/协议/guard 39 项检查通过；页面 typecheck 通过。未运行其他求解器、未恢复双底、未重建表、未提交推送或部署。

证据目录 `.tmp/cubeopt-reverse/open-benchmark-20261015/`：`original-wasm-resume431/`（私有构件、输入快照、569 条新 IPC、合并 1000 行）、`original-wasm-report.json`（完整独立验解）、`session-original-resume431.json`（单次授权和原记录摘要）、`original-resume431-receipt.json`（已消费）。本地比较页和下载 JSON 明示 431＋569 续测口径，旧部分失败报告仅作为历史证据保留。

## 2026-10-14：A 版批准，本机首轮实测

用户选定 A 版并授权：16 GB 表档、16 个搜索线程、固定 WCA 前 1000 条原序，每版一轮、不预热，仅本机。结果已填本地页面，未提交、推送或部署。

| 实现 | 完成 | 总求解秒数 | 求解器峰值 RSS | 进程树峰值 RSS |
| --- | --- | --- | --- | --- |
| Rust 原生 Opt9 正式 fixed | 1000 / 1000 | 42.098461188 | 15.6376 GB | 15.7223 GB |
| Rust Opt9 WASM quarter-fixed | 1000 / 1000 | 99.882797158 | 16.0990 GB | 16.4621 GB |
| 原版 cube48opt Opt9 WASM | 431 / 1000 后退出 | 不列完整成绩 | 不列完整成绩 | 不列完整成绩 |

两份 Rust 全部独立回放验解、逐条核对已验证的最优长度；Rust WASM 另检查每个较短深度的完成屏障和 16 个工作线程实际参与。计时不含表加载与验解。两份 WASM 使用同一 Node 24.21.0 / V8 TurboFan（`--no-liftoff`），不把它当成浏览器或阿里云测量；原生与 WASM 分开显示。

原版在第 432 条（ID `1194001`）的 Node 会话中抛出 `unwind` 并退出；前 431 条均独立验证通过。这是本轮运行兼容性失败的证据，尚不能断言上游求解算法有误。不外推完整耗时、不将其排名，也没有重跑已计算的条目。其他候选缺表、未取得原生源码、架构或并行模式不匹配，保持明确待测说明。本轮不能声称全网最快。

资源授权与记录：此前双底任务 Swapouts 从 0 增到 16 后已停止。用户明确回复“允许本轮建立新基线，继续测试”，只允许本轮独立比较在同一 boot 的 16 页建立基线；旧基线及所有保护记录保持原样。运行中新增换出仍立即停止，不恢复双底。三个实际计算进程均未新增换出，压力正常；原版退出为程序异常，不是资源保护。

启动前修正过一处 20 GiB 统一预算过宽的问题，最终采用原有 multithread-policy 的逐运行时预算，没有降低既有保护要求；该次预检未启动求解器。原版首次准备还被脚本中仅允许 Opt8/4 线程的编译器条件拦截，未启动 WASM 子进程、未计算任何条目；修正条件后才开始唯一实测。所有预检/准备失败和修复后的会话证据分别保留。原版实测退出后只继续独立 Rust WASM，不重置交换计数。

证据目录：`.tmp/cubeopt-reverse/open-benchmark-20261015/`；资源记录在相邻的 `open16-wca1000-*-resources.json`。`session*.json` 固定授权、历史记录摘要、程序摘要、命令和输入；每个进程只消费一次 receipt。`rust-native-report.json`、`rust-wasm-report.json` 为完整报告，`original-wasm-partial-report.json` 明确不可排名。原始 JSONL 逐条保留，不自动续跑失败的测试。

页面数据由 `publish-open-benchmark.mts` 从完整报告生成 `current-results.json`，不展示旧历史成绩；下载 JSON 包含本轮结果、二进制/语料/表/输出摘要和原版失败状态。完整独立验解入口是 `report-open-benchmark.mts`，失败部分使用 `report-open-original-partial.mts`。这些是本机证据，尚未打包发布为可跨机复现的 GitHub benchmark。

保护钩子仅同步已修改依赖的校验摘要，不新增直接计算豁免；脚本回归通过不等于新会话已信任钩子更新，下一 Codex 会话仍需按既有 hook 流程加载。没有恢复双底或改动服务器。

本轮验收：36 项保护/协议回归通过，client typecheck 通过，页面数据与 hook 适配的 170 项局部检查通过；中文页面原生/WASM、耗时/峰值内存显示正确，390px 页面无横向溢出。实际下载 JSON 已核对两份完整成绩及原版部分失败状态。逐个摘要核对旧保护文件均未变化；无残留求解进程或计算锁。

## 2026-10-14：前端评审阶段

用户要求先做网站前端与 mockup，再检查。复用 `/dev/solvers/compare`，本轮没有启动求解器、生成表、恢复 ZBLL、创建 GitHub 仓库或发布。

- 实际前端：图表优先，可切换原生/WASM、耗时/峰值内存/搜索节点。
- `.tmp/solver-benchmark-mockup.html`：A 图表优先、B 紧凑表格，均不填虚构数据。
- 新横向测试结果为空；已有 CubeRoot Opt9 正式版本机基准明确单列，不宣称全网最快。
- 原页面 Opt9 仍为原版 70.5457 秒，本轮按正式版发布清单更新为 43.23124978399998 秒、峰值 RSS 15,638,528,000 字节。
- 数据证据：`solver/experiments/cube48opt-rust/opt9-release.json`，对应报告 `.tmp/cubeopt-reverse/wca1000-mt16-rust-native-opt9-exp-fixed-report.json`；1000 条独立回放、最优长度核对通过。43.2 秒不包含表加载与独立验解。

## 拟定口径（待前端评审后落实）

完整三阶 HTM 最优解；同机、固定 WCA 前1000条原序；16线程、单轮、不预热。首期16GB十进制表预算；报告实际表容量、求解器RSS和进程树RSS，不冒充16GB整机内存上限。初始化、建表、验解另计。原生与WASM分榜。

2026-10-15 维护者确认：允许各引擎自行选择单状态或跨状态并行，nxopt 不因跨状态并行而排除。比较固定整批输入从开始求解到全部完成的实际经过时间，计算线程总预算为16；不得将并发的逐条耗时相加作为整批耗时，也不得把整批结果解读为单个打乱的响应延迟。保留逐条结果与实际并行配置；历史成绩只有核对其计时与本口径一致后才能直接复用。当前仓库尚未发现 nxopt 程序和专用表，未启动测试。

每个新结果需完整版本/构建参数、语料摘要、计时定义、内存口径、逐条解和最优长度验证。节点计数定义需审计，不能直接作为统一排名。未来 GitHub benchmark 应交付数据集/许可、运行器、可重现实验配置、逐条原始结果与独立验证器。本轮JSON下载为协议草案和已有报告摘要，不是完整实验复现包。

## 首期候选及公开来源

| 项目 | 拟定配置 | 初步边界 |
| --- | --- | --- |
| CubeRoot Rust Opt9 | 15.6GB | 已有本机43.2秒基准，横向轮次待测 |
| cube48opt | Opt9，15.6GB | 原生源码尚未取得；上游原生仓库链接不可读，仅公开基准有记录。WASM产物仓库可用，两个运行时分开 |
| Nissy H48 | h9，15.2GB | Mac可构建；本机表曾取消，不能自动补表 |
| vcube | 208，7.8GB | 默认308超过预算；原版x86 AVX2/BMI2，不把异机结果折算到Mac |
| nxopt | 22，7.8GB | 原版跨状态并行；仅适合批量吞吐横向比较 |

来源（2026-10-14核查）：
- https://github.com/cs0x7f/cubeopt-wasm
- https://github.com/cs0x7f/cube_solver_test
- https://github.com/sebastianotronto/nissy-core
- https://github.com/Voltara/vcube
- https://github.com/rokicki/cube20src/blob/master/nxopt.md

另有Cube Explorer最优模式、Reid、3ColorCube等，可后续扩展，当前不制造空泛的全网冠军结论。用户分享 https://chatgpt.com/share/6ad05967-ebe4-8330-b5a6-40cdd31146a3 已通过浏览器阅读，其强调同机同协议、HTM/QTM和并行方式分离，作为方案参考，具体项目事实仍核查上游。

### 前端验证

- client typecheck 通过；现有 solver-comparison-data 的3项检查通过。
- 原生/WASM、耗时/内存/节点切换正常，WASM未误用原生结果。
- 浏览器中文/英文、390px窄屏、浅色/深色与低对比度检查通过；整页无横向溢出，候选表可独立横向滚动。
- 已实际下载JSON，核对已有基准值与正式报告一致、报告SHA-256一致、本轮结果数组为空。
- 页面与双方案mockup仅本地预览，未提交、未推送、未部署。

## 2026-10-15 nxopt 本机准备

- 维护者明确要求从 GitHub 获取后测试；已克隆官方 `https://github.com/rokicki/cube20src` 至 `/Users/eula/Developer/cube20src`，固定提交 `f430921a48306874864b9f2ac8a059b43492fd3a`。
- 原版源码未经修改，`make -f makefile-nxopt nxopt22` 成功，产物为 arm64 Mach-O；编译使用上游 HTM、EO2/EP2、pthread 和原生 CPU 优化配置。
- nxopt22 需专用 `nxopth22b.dat`（约7.8 GB）；不是 CubeRoot Opt9 的表，也不是实际16 GB表。公开预算为不超过16 GB，实际容量仍须如实记录。
- 未找到预生成表下载；上游 `main` 在缺表时会自动 `generatetab()`，不要以为运行帮助或空输入不会建表。当前未运行程序、未建表、未测试。
- 已向维护者确认新 nxopt 建表/运行时保护授权（现有允许范围未覆盖 nxopt）。检查时 Swapouts=48，未发现其他已登记求解进程，磁盘可用50 GiB；这些只是准备时快照，启动前须复核，不能重设旧保护记录。
- 后续固定 WCA1000 原序、16线程、单轮、不预热；批量实际经过时间排除建表/加载，不能加总并发逐条用时。独立验解所有输入并核对最优长度后才能回填成绩。

### nxopt 受保护运行（已获明确授权）

维护者回复“允许，受保护建表后测试”，独立 session 位于 `.tmp/cubeopt-reverse/nxopt22-20261015/session.json`。程序和输入已固定 SHA，原始保护记录只读保留；guard 独占计算锁、RSS上限约9.96GB、运行余量2GiB、新增换出或压力异常立即停止。沿用原 boot / Swapouts48，不授权恢复之前的浏览器停止任务。

- 建表完成：`nxopth22b.dat` 为7,809,269,764字节，51.613546958秒（包含初始准备和写盘，不计入求解时间）。
- 未修改上游搜索源码；参数 `-t 16 -x 20 -`，16个工作线程各解不同打乱，共用一份表。
- 同一原生PID在建表后等候固定输入，随后一次发送WCA1000，无额外预热。逐条输出同步落盘，生成表与已完成解保留；失败不自动重跑。上游建表过程本身不提供中途检查点，本次已正常完成。
- 计时从表就绪后交付输入开始，到第1000条完整解输出结束，含线程/输入/输出调度；不累加各线程的独立用时。与历史逐条计时累加值有计时边界差异，不能宣称精确的同口径倍数。
- 原始输出、逐条解、计时、资源记录与验证报告分别存档。节点指标使用原版 `lookup6` 的 `evals`，不能与 Rust context visits 直接等同。

### nxopt22 完成结果

- 1000/1000 独立验解和最优长度核对通过，16线程、单轮、零预热，整批求解耗时 **504.905973 秒**。建表51.613546958秒另计。
- 表实际7,809,269,764字节。页面在16G预算下显示真实8G表档，未冒充16GB表。
- 整个建表及求解进程树峰值8,027,537,408字节；Swapouts48→48，guard正常退出0，未触发保护。该峰值是保守进程树统计，不称为单一求解进程精确RSS。
- lookup6 evals=30,825,291,999，仅引擎诊断，非统一节点口径。
- 全量证据 `.tmp/cubeopt-reverse/nxopt22-20261015/report.json`，包含表及原始结果摘要。原始程序/源码/编译信息/本轮guard在 evidence/ 冻结。
- 当前本机保留的CubeRoot原生Opt9为42.098461187999995秒，使用15.6GB表；nxopt22使用7.8GB表且整批计时，不能称为严格同表容量或精确同计时边界的加速比。
- 已回填本地比较页和 /dev/solvers 表快照；不提交、不推送、不发布。


## 2026-10-15 nxopt22 8G 档协议对齐

维护者要求统一为 WCA 前100条、4线程、单轮不预热。复用原表，未重建；同boot/Swapouts48，独立guard scope `nxopt22-wca100-4-20261015` 正常退出。实测296.600813958秒，100/100独立验解及最优长度核对通过，evals 2673464088，进程树峰值7995080704字节，无新增换出。加载3.478632542秒不计入求解耗时。每秒求解数100/296.600813958，页面两位有效数字为0.34条/秒。

报告 `.tmp/cubeopt-reverse/nxopt22-wca100-4-20261015/report.json`，源码快照在其evidence目录。旧1000条/16线程报告原样保留，不再作为页面当前结果。nxopt使用整批输入至最后结果的墙钟耗时，包含调度和输出开销；WASM使用既有逐次调用耗时汇总，不将二者计时边界说成完全一致。仅本地，未发布。


## 2026-10-15 Opt8 native and planned 32G cohort

Opt8 native WCA100 / 4 search threads / one pass / no warmup: 33.593746037 seconds, 100 independently verified solutions matching optimal lengths, 2423291745 context visits. Peak process-tree RSS 7923204096 bytes; Swapouts remained 48, guard exit 0. Reuses preserved fixed native binary with variant 8 and existing table; quarter pruning is not enabled for variant 8 in this artifact. Evidence: `.tmp/cubeopt-reverse/opt8-native-wca100-4-20261015/`. Initial preflight rejected an empty output placeholder before any solving; logs retained, no baseline reset.

32G candidates are registered only; no table loading, generation or benchmark is authorized now. Existing Opt10 native, Nissy H10 native and nxopt23 (actual table about 23G) require resource and artifact review before a future run. No performance values assigned. Local only.


## 2026-10-15 Opt8 native quarter pruning

User approved porting the existing quarter-turn equivalence pruning to native Opt8. New opt-in `opt8-native-quarter` feature only enables the generic oracle for variant 8; other variants and defaults remain unchanged. Benchmark build uses the preserved fixed native source plus this gate, isolated under `.tmp/cubeopt-reverse/opt8-native-quarter-source-20261015/`, avoiding concurrent research WIP. Existing native binary and baseline remain unchanged. Test-only H48 include paths in this snapshot were resolved to the existing vendor headers.

Validation: side-mask/split-ownership test and complete radius-3 BFS optimal-distance test passed (3502 states, 14008 searches); real Opt8 small-coordinate test passed 45588 quarter equivalences, without loading the PDB. Benchmark: fixed WCA100, 4 search threads, one pass, no warmup; 26.402382370999998 seconds versus retained baseline 33.593746037 (21.41% less time), 1837689891 nodes versus 2423291745 (24.17% fewer), 596514029 quarter siblings removed. All 100 independent solution replays and optimal-length matches passed. Peak process-tree RSS 7898120192 bytes; Swapouts48 unchanged, guard exit0.

Page now selects the faster quarter result (3.8 solves/s, two significant digits). Old report remains `.tmp/cubeopt-reverse/opt8-native-wca100-4-20261015/report.json`; new report and frozen guard/policy/reporter are in `.tmp/cubeopt-reverse/opt8-native-quarter-wca100-4-20261015/`. Binary SHA256 30474885846bd7e0abf797f7180ecbdcc257cc61a5d68d3684777f81f1bda94b. This is one observed pass, not a repeated-run stability claim. No server artifact replacement, no publish, no 32G runs.

## 2026-10-15 Opt8 native follow-up toward 6 solves/s

The user requested best-effort progress toward 6 solves/s (WCA100 in at most 16.667 seconds). Five isolated candidates were measured on the same ordered WCA100, 4 search threads, one batch worker, one pass each, no warmup, with the existing 7782727680-byte table. The retained quarter result was not rerun. Each new run completed with guard exit 0, 100 independent solution replays and optimal-length matches, normal pressure, and Swapouts48 unchanged. **None exceeded the retained quarter result; the page remains at 26.402382371 seconds / 3.8 solves/s. The 6 solves/s target was not achieved.**

| Candidate | Change from retained source | Seconds | Context visits | Selected |
| --- | --- | ---: | ---: | --- |
| Retained quarter | Opt8 quarter pruning | 26.402382371 | 1837689891 | Yes |
| A specialized | Fixed Opt8 coordinate packing and decoder; same search policies | 29.881411287 | 1838345091 | No |
| B search | A plus parent-bound propagation, dynamic prefix claiming, root lower bound | 29.847795582 | 1699291586 | No |
| C batch | B plus grouped eight-slot PDB reads and native wrapper forwarding | 34.523386125 | 1687862281 | No |
| D native-cpu | B compiled with `-C target-cpu=native` | 27.434086423 | 1684230413 | No |
| E quarter-cpu | Original quarter source compiled with `-C target-cpu=native` | 40.114015998 | 1837791115 | No |

Lessons and limits:

- Fixed Opt8 packing removes runtime variant arithmetic but did not improve this pass. B reduced node visits by about 7.6% versus A without a corresponding time improvement. Do not assume every optimization from Opt9 transfers profitably to Opt8.
- Grouped reads require `Cancellable::lookup_batch` forwarding; otherwise native parallel runs silently use the scalar default. The new tiny dispatch fixture checks the actual four-thread path. The global `wasm-batch-probes` feature changes the candidate binary's probe phases, not just one oracle.
- Do not infer that fewer instructions or nodes necessarily means less elapsed time. A/B retired fewer instructions than the retained quarter run, but consumed more cycles. Background browser/node CPU workload was observed during this session; another browser test was allowed to finish before B. Only before-run process snapshots, not continuous CPU isolation, were collected. Single-pass timings do not establish stable differences or isolate the cause of E's slowdown. No other user's process was stopped and no old run was repeated.
- A/B/C and the retained quarter build use empty Rust flags. D/E deliberately use native CPU targeting. An initial B build accidentally used native CPU flags; it was preserved before any benchmark, B was rebuilt and rechecked with empty flags, and the preserved build was subsequently tested once as the explicitly separate D candidate. Do not confuse these artifacts.
- New features `opt8-native-specialized`, `opt8-native-search`, and `opt8-native-batch` remain opt-in; defaults and official binaries are unchanged. Use the full explicit build flags in each frozen configuration. Current shared source has concurrent research work and is not byte-identical to these measured frozen sources.

Evidence root: `.tmp/cubeopt-reverse/`. Full results, instruction/cycle observations and hashes are in `opt8-native-6ps-20261015-summary.json`. Each `opt8-native-{specialized,search,batch,native-cpu,quarter-cpu}-wca100-4-20261015/` retains `session.json`, consumed `receipt.json`, raw output, stderr, independent report and frozen guard/policy/reporter; corresponding `-resources.json` is beside the directory. The D label intentionally expands to `opt8-native-native-cpu-wca100-4-20261015`. Frozen sources are `opt8-native-{specialized,search,batch,quarter-cpu}-source-20261015/`; D's tested binary/configuration is preserved under B's `draft-native-cpu/`. All five scopes are consumed and must not be automatically rerun. They share `opt8-native-6ps-20261015-stop.json` as the stop boundary; no stop was triggered. Earlier protection records remain hash-bound and untouched.

Validation before measuring included 98304 Opt8 coordinate comparisons (81936 above u32), all scalar decoder codes/header fallbacks, quarter/BPMX ownership and 3502 independent shallow BFS states / 14008 searches, dynamic prefix coverage/cancellation, and root-bound proof/error handling. C's probe pipeline retained exact digest `6d17ca1f6d7bb115`. The actual repository port passed native library/binary compilation and four focused Opt8 checks, including the real small-coordinate snapshot and four-thread batch dispatch. No large table was loaded by these small checks. No publication, default artifact replacement or 32G run occurred.
