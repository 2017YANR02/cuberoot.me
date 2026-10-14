# Rust 历史 H10 与 Opt1–9 原生内存及基准记录

2026-10-14 正式版：维护者指定Opt10 coset **24.591秒**（WCA1000、16线程、单轮不预热）为正式版本，原生峰值RSS **31.2GB**。正式程序保持与该次实测SHA一致，未重跑测试；其余9份已测/诊断版本原位归档。登记见 [opt10-release.json](opt10-release.json)，恢复清单见 [opt10-archives.json](opt10-archives.json)。本地比较页已同步；仅本地未发布。下方“不采用/默认未替换”等按当时实验阶段理解。

2026-10-14 Opt10第三/四轮完成：coset-chain **25.483秒**、邻居下界lookahead **27.438秒**、替代对称投影projection **25.501秒**，同一1000条/16线程/每版单轮无预热，各1000条独立验解及最优长度核对通过。均未超过保留coset **24.591秒**，不采用，未达到20秒。profile仅用于诊断，带计数耗时不进排名；96.689%节点在剩余10–12步。projection总节点减少1.20%，本轮总耗时反增3.70%，不把局部剪枝当作性能突破。所有候选完整冻结、旧程序未覆盖、旧基准未重跑、原表不变；仅本地未提交、推送或发布。维护者说明20秒为尽力探索目标，本轮收尾；详情见 [Opt10原生实验记录](opt10-native-experiments.md)。

2026-10-14 Opt10第二轮：同一WCA1000/16线程/单轮无预热，batch **29.764秒**、dual **27.827秒**、coset **24.591秒**；三版各1000条全部独立验解和最优长度核对通过。前向pathmax的新剪枝被证明冗余，未跑正式基准。coset是本轮最快单次，比保留25.145秒版少约2.2%，仍未达20秒；总节点没有下降，不能断言稳定提速或重大突破。原33.032秒和25.145秒未重跑、完整源码/程序及报告都保留；同表、RSS约31.2GB，仅本地未发布。完整数学推导、负结果与复现证据见 [Opt10原生实验记录](opt10-native-experiments.md)。

2026-10-14 Opt10新增结果：同机WCA前1000条、16线程、各单轮无预热，原生基准 **33.032秒**，搜索优化版 **25.666秒**，查表优化版 **25.145秒**。各1000条独立验解通过，均复用同一31.1GB Opt10 v2表，峰值RSS约31.2GB；原版及两候选均保留，仅本地未发布。最短实测耗时减少23.9%，未达到减半。协议、源码/程序快照与误差边界见 [Opt10原生实验记录](opt10-native-experiments.md)。下列“暂无Opt10表与性能数据”是先前历史状态。

2026-10-13 后续：维护者取消 H9 建表和测试，进程已停止、跟进已停用，没有完整 H9 表或测试结果。开发转向 Rust Opt10 代码，暂无其大表与性能数据；状态见 [Opt10 开发跟踪](opt10-development.md)。下方 H9 启动记录保留为历史。

本记录汇总已完成的 **Rust H10 与原 C 同表完整 60 例对照**、**Opt1–8 同机、同档位、固定 18 例基准**、**Opt9 与 WASM 的完整 60 例基准**及原生进程内存测量。各表档、比较对象与协议分别解释，不作跨档速度排名。所有数据均为本地实验，未替换统计管道或线上引擎。

**版本边界（2026-10-13）：下列 H10 1.566× 是旧固定 H10 程序的实测，不是刚泛化的 H0–H11 程序。** 新通用后端仅通过编译和 19 项不同的小数据测试，尚无任何真实表回归、RSS 或性能记录，H10 也未重跑。H11 仅代码支持，CLI 在任何表文件访问前拒绝，没有本机生成、加载、求解或基准。旧数字和完整原始证据保持原样，不能据代码结构相近将结果转记到新程序。

泛化前的 39 份文件及验收程序已只读备份到 `/Users/eula/Developer/cuberoot.me-backups/rust-h10-before-h0-h11-2026-10-13/`，附清单和 SHA；当前小测试使用独立 `target/h48-general`，未覆盖已验收 release 程序。新 API、CLI、每档规格见 [README](README.md)，小数据证据见 [validation.md](validation.md)。

## 历史固定 Rust H10：同表、同内存档的原 C 对照

2026-10-12 在本机 Apple M5 Pro 上完成。双方使用同一个只读 H10 文件 `solver/tables/h48-nissy-core/h48h10.dat`，大小 **30,336,314,216 bytes**；每批前后检查路径、inode、大小与时间戳，未生成或转换大表。Rust 默认启动还扫描完整表分布，原 C 只映射文件；启动和加载均不计入下列搜索时间，每个新进程先完整预热全部 60 例。

使用历史语料原顺序的全部 60 条 HTM 15–19 状态（各深度为 1/1/14/39/5 例），双方均单求解线程，Rust 在该线程内交错推进 8 个上下文。一次只驻留一个引擎。整批先后逐轮交替，排除第一轮及每个进程的完整预热，统计余下三轮；禁用节点预算，但保留逐例超时与资源停止保护。没有跳过、筛选或补跑失败样本。

| 正式轮次 | Rust H10 全 60 例 s | 原 C H10 全 60 例 s | 原 C / Rust |
| --- | ---: | ---: | ---: |
| 1 | 38.185295251 | 59.186903 | 1.550× |
| 2 | 36.782246953 | 57.605142 | 1.566× |
| 3 | 35.142004214 | 55.122275 | 1.569× |
| 中位数 | **36.782246953** | **57.605142** | **1.566×** |

主指标为每轮全部样本的总搜索时间，再取三轮中位数：速度比 **1.566112643×**，Rust 耗时减少 **36.1476%**。两路各轮总时间均有所下降，因此同时保留逐轮数字，不只选最快轮；三轮速度比分别为 1.550/1.566/1.569。逐例配对几何比 1.872468 另存原始报告，不以它代替整批总时间比。搜索计时边界分别为 Rust `solve()` 与 C `nissy_solve()`，排除加载、IPC、外部验解；搜索实现与节点计数含义不同，不能把结果归因为 Rust 语言本身，也不直接比较跨引擎节点比例。

| 内存范围 | Rust H10 | 原 C H10 |
| --- | ---: | ---: |
| 共同表文件 bytes | 30,336,314,216 | 30,336,314,216 |
| 四个进程的原生最大 RSS bytes | **30,342,217,728** | **30,342,397,952** |

RSS 来自每批 `/usr/bin/time -l`，覆盖各进程启动与求解，单位 bytes，排除 Node 监控器。两者都约 **30.34 GB / 28.26 GiB**，属于本次约 32 GB 的进程预算；不代表只有 32 GB 整机内存也满足系统余量。整个受监控进程树的采样峰值为 **30,520,770,560 bytes**，最小保守余量 **36,962,697,216 bytes**，压力正常、Swapouts 增量为 0、`stopped` 为空；运行时观测不是系统级禁止换出的保证。

实际完成 **960 条已验解结果、8 条启动检查、8 个进程正常退出**；480 条进程预热与 120 条首轮预热排除，360 条正式计时。每个解通过独立 cubing.js 复原，长度匹配历史已知 HTM。之前两版完整浅层 BFS 3,502 态加历史 60 例的三路验证各通过 10,686 解；优化前后 7,124 条 Rust 输出排除时间后完全一致，表明这次固定 9,720 字节 LUT/SIMD 坐标和预取优化没有改变已测搜索行为。

独立只读复核见同目录 `independent-stability.json`：960 条结果、968 条原始输出与请求（含 8 条启动）、逐轮汇总全部匹配。**正式三轮，两边各自 60/60 例的全部非时间输出均稳定**；含预热的每例八次比较中，Rust 60/60 稳定，原 C 有 5 例节点数出现两个值，但所有例的解和步数均稳定。跨引擎有 40/60 例解字符串相同，另 20 例为不同的已验证等长解，并非正确性失败。按逐例三轮中位数，Rust 在 58/60 例中用时较少；总时间比仍为本报告的主要指标。

原 C 对照从未修改的固定 nissy-core 源码以 `H48_ORIGINAL`、`-O3`、NEON、单线程编译，未应用历史实验的确定性 rank 补丁。Rust 的 H10 根对称消重尚未启用，仍完整枚举分支；复用 Opt 搜索组织，并保留 Nissy 的角投影早剪、主表与 EOESEP fallback。因此这次是两套具体实现的同表对照，不是逐节点等同的语言微基准。

证据目录为 `.tmp/cubeopt-reverse/h10-benchmark-full60/`：`input.json`、`report.json`、`results.jsonl`、每批原始输出/启动/退出记录、程序和源码副本均保留。Rust 程序 SHA-256 为 `e8b2c919087006bdcd51b76f7bdbe13a294b538c2a69058d4593fa107099d8a0`；C 程序为 `46d201e856901a1b6ebe06ceec51b438620ff27530343c7b3bd569fec14ee501`，构建输入记录在 `../h10-build/build.json`。H10 表进行了完整分布校验和元数据一致性检查，没有重新计算整张 30 GB 表的 SHA-256。旧版源码、程序和表均保留，备份位置见主跟踪 MD。

本次结论仅覆盖该 Mac、固定 60 例、上述协议。它与下文 Opt9/WASM 的 1.165× 是不同的表和比较对象，不能据此声称全状态空间都快、全球最快、3 倍提升或数学上的搜索量突破。

## Opt1–9 已完成结果

时间单位为秒，采用每轮全部样本的总时间，再取正式三轮的中位数：Opt1–8 每轮 18 例，Opt9 每轮 60 例。速度比为该 WASM 中位数除以 Rust 中位数，大于 1 表示这次 Rust 用时较短；不是逐例几何平均。表大小与原生最大 RSS 精确到字节，分别来自输入/生成元数据和独立的 `/usr/bin/time -l` 测量。

| 档位 | 剪枝表 bytes | 原生最大 RSS bytes | Rust 三轮总时间中位数 s | WASM 三轮总时间中位数 s | WASM / Rust |
| --- | ---: | ---: | ---: | ---: | ---: |
| Opt1 | 30,401,280 | 37,486,592 | 3.248305876 | 3.502674 | 1.078× |
| Opt2 | 121,605,120 | 127,516,672 | 0.326758918 | 0.377631 | 1.156× |
| Opt3 | 243,210,240 | 249,118,720 | 0.178435251 | 0.202577 | 1.135× |
| Opt4 | 486,420,480 | 491,274,240 | 0.546997543 | 0.594701 | 1.087× |
| Opt5 | 972,840,960 | 977,698,816 | 0.358938792 | 0.395669 | 1.102× |
| Opt6 | 1,945,681,920 | 1,950,547,968 | 0.189309332 | 0.220497 | 1.165× |
| Opt7 | 3,891,363,840 | 3,896,197,120 | 0.083801087 | 0.105117 | 1.254× |
| Opt8 | 7,782,727,680 | 7,786,528,768 | 0.059918873 | 0.084411 | 1.409× |
| Opt9（独立 60 例协议） | 15,565,455,360 | 15,569,256,448 | 52.117762 | 60.718842 | 1.165× |

Opt1 的原生最大 RSS 是 **37.486592 MB = 35.75 MiB**，Opt9 是 **15.569256448 GB = 14.5 GiB**。这里 GB/MB 为十进制，GiB/MiB 为二进制；RSS 列不是各档基准里 Rust 与 WASM 同时驻留的总内存。

Opt1–8 有界样本中，较大档位的整批搜索已经只有几十毫秒，单例更短，计时边界、固定初始化/调度开销和噪声会明显影响比值。这组 18 例数据不支持用几何均值宣传数倍提升，也不能外推到均匀随机状态、完整 18–19 步样本或 Nissy H10。更大的表也不保证这组短样本单调变快：本次 Opt4 慢于 Opt3，原因尚未单独分析。

## 同一输入与计时协议

Opt1–8 的 `input.json.cases` 逐字节一致，均为 **18 个有界样本**：从历史 60 例中取全部 `htm<=17` 的 16 例，各截取打乱前 14 个面转，另加全部 `htm<=16` 的两条完整历史打乱。16 个前缀不继承原始打乱的已知最短步数，也不假设其距离为 14；两条完整历史状态的已知最短步数分别为 16 和 15。没有按观察到的运行速度挑选样本。

`JSON.stringify(input.cases)` 为 1,829 bytes，八档共同 SHA-256：

`77518218fbc3b4f48060e16da5e4f1d48b4d8cda2448e88e244b472780544357`

每档均使用持久 Rust 进程（8 个搜索上下文、一个求解线程）与持久原 WASM 实例（一个 thread、一个 group、内部 8 contexts）。先完整预热一轮并排除，再做三轮正式测量，同例跨轮交替先后。两边使用同一档位 PDB；Rust 搜索过程中不调用 WASM。

主指标是 Rust `solve()` 自报时间和 WASM 日志中的 `tt`，不含表加载和独立回放；二者内部计时包围的初始化/调度范围并非逐指令相同。WASM `tt` 分辨率为 0.001 ms。额外 `wallSeconds` 包含 API/IPC 开销，保留在原始结果中，不替换本表的主指标。节点计数定义不同，不比较节点比率。

每档 **18 × 2 × 4 = 144 个解**在运行时通过独立 cubing.js 回放和解长检查，其中 36 个属于预热、108 个属于正式测量；Opt1–8 合计 **1,152 个已验证解**，正式测量 864 个。本次汇总另核对了原始结果的数量、验证标记，并从 `results.jsonl` 重新相加三轮总时间，与各报告中位数逐项一致，没有重新求解。

另对 Opt1–8 的 576 条原生输出按 144 个档位/样本分组，进行 432 次跨轮严格比较：仅排除 `seconds`，解、步数、节点、所有计数、`completed_depth` 和取消标记等全部字段相等。覆盖与差异错误均为 0，证据为 `.tmp/cubeopt-reverse/generic-native-repeatability.json`；尚不包含独立协议的 Opt9。

## 原生 RSS 的独立测量

RSS 使用固定历史语料中全部 `htm<=16` 的两例，按原顺序：`2645972015`（16 步）、`3649581001`（15 步）。每档一次加载、连续两次真实原生求解，8 contexts、每例最多 10 亿节点。九档共 **18 个解**已在汇总脚本中用独立 cubing.js 再次回放，ID/长度均匹配，`cancelled=false`。

原生最大 RSS 取 Darwin `/usr/bin/time -l` 的 `maximum resident set size`，单位 bytes，覆盖原生程序加载和求解，排除 Node 监控器与 time 包装器本身。它是这两例条件下的进程高水位，不是所有状态的内存上界，也不是纯搜索阶段的增量内存。

guard 的 `peakRss` 则是每 500 ms 采样的整个监控进程树，范围与上述内核原生高水位不同。Opt2/3 的任务很短，guard 恰未采到其完整驻留峰值，故采样值甚至低于原生最大 RSS；不能据此声称其只加载了少量表。RSS 九次记录与 Opt1–9 基准记录的 `stopped` 均为空，同一启动期间 Swapouts 增量为 0；这不等于操作系统强制禁用 swap。

## 程序与结果证据

Opt1–9 每个基准目录都保留本次 `native-binary`，实际文件 SHA-256 与 `input.json`、`report.json` 一致，九档共同值为：

`a8e64b19f79edf54ba0021a44702c7fe378d1637b1c917c77a022f9939a48d55`

RSS 汇总时观察到的当前原生程序也是该摘要，但单次 RSS stdout/time 日志没有嵌入运行时程序 hash；报告明确保留了这个证据边界。

以下路径相对仓库根；`.tmp` 是保留在本机的原始证据，不是仓库中可自动下载的大表。

| 证据 | 路径 |
| --- | --- |
| Opt1–8 逐档输入与摘要 | `.tmp/cubeopt-reverse/benchmark-generic-optN/input.json`，N=1..8 |
| 本表主指标来源 | `.tmp/cubeopt-reverse/benchmark-generic-optN/report.json` |
| 每例/每轮时间、解、先后、预热标记 | `.tmp/cubeopt-reverse/benchmark-generic-optN/results.jsonl` |
| 原生与 WASM 原始输出 | 同目录 `native-raw.jsonl`、`wasm-raw.jsonl`、`native-stderr.log` |
| 实际程序与源码快照 | 同目录 `native-binary`、`source/`，包括固定上游 `.wasm/.mjs` |
| 固定输入原件与表来源 | 同目录 `cases-source.json`、`table-manifest.json`、`small-manifest.json` |
| 基准保护观测 | `.tmp/cubeopt-reverse/benchmark-generic-optN-resources.json` |
| Opt9 完整语料输入、时间和报告 | `.tmp/cubeopt-reverse/benchmark-opt9-full60/{input.json,results.jsonl,report.json}` |
| Opt9 各进程启动、原始输出及退出记录 | 同目录 `round-R-P/S/{startup.json,raw.jsonl,complete.json}`，R=0..3，P=warmup/measure，S=native/wasm |
| Opt9 保护观测与独立复核 | `.tmp/cubeopt-reverse/benchmark-opt9-full60-resources.json`、`opt9-native-repeatability.json` |
| 九档 RSS 及 18 解独立复核 | `.tmp/cubeopt-reverse/native-rss-report.json` |
| RSS 两例原始输入与来源/hash | `.tmp/cubeopt-reverse/native-rss-cases.tsv`、`native-rss-cases.json` |
| RSS 原生输出、系统测量、保护观测 | `.tmp/cubeopt-reverse/optN-native-rss.jsonl`、`optN-native-rss.stderr.log`、`optN-native-rss-resources.json`，N=1..9 |

原始历史输入为 `solver/testdata/benchmarks/h48-h10-2026-10-04.json`，SHA-256：`1cd84b7074eb8633bbd2ff1db07ac9de11dcd1cb11a8eb1d55ef06eef97ab5d5`。RSS 报告还记录各输入、输出、stderr、资源记录和表 manifest 的独立摘要。

## Opt9 完整 60 例：已完成的独立基准

目录为 `.tmp/cubeopt-reverse/benchmark-opt9-full60/`。它保留历史语料原顺序的全部 60 条完整状态：HTM 15/16/17/18/19 步分别为 **1/1/14/39/5 例**，没有按运行速度筛选。采用一次只驻留一份表的 `--sequential` 协议：每轮每路新进程，先做独立启动检查和一遍完整语料预热，再运行该批；整批引擎顺序跨轮交替。首轮整批也排除，只汇总之后三轮。这组完整样本与上方 18 例持久双引擎数据不是同一基准。

实际完成 **960 条验解结果、8 条 startup 记录及 8 条进程正常退出记录**：480 条进程内预热、120 条全局首轮预热均排除，只有 360 条 `measure` 进入正式统计。启动记录吸收表加载时间，未计入搜索结果。原生 8 contexts 与 WASM 内部 8 contexts 均由一个 OS 求解线程执行；原生每例节点预算为 10 亿，全部 `cancelled=false`。没有跳过或补跑失败样本。

| 正式轮次 | Rust 全 60 例总时间 s | WASM 全 60 例总时间 s |
| --- | ---: | ---: |
| 1 | 52.117762000 | 60.718842 |
| 2 | 52.709173540 | 61.275829 |
| 3 | 52.013821625 | 60.541289 |
| 中位数 | **52.117762** | **60.718842** |

从原始逐例记录重新相加得到的三轮总时间与 `report.json` 完全一致，WASM/Rust 中位数比为 **1.165031645×，约 1.17×**。这表示该固定历史语料和协议下 Rust 总搜索时间更短，不是全体随机状态或 Nissy H10 的速度结论；不以较高的逐例几何比替代总时间指标。每个新进程确已完整预热，但不据此声称 JIT 必然达到稳态。

额外独立复核保存于 `.tmp/cubeopt-reverse/opt9-native-repeatability.json`：960 条解全部再次通过 cubing.js 角块/棱块复原与已知 HTM 检查；480 条原生结果涵盖 4 个进程、每进程 2 遍语料，每例出现 8 次。以首次结果为基准进行 **420 次严格比较，仅排除 `seconds` 后全部字段相同**，包括解、步数、节点、所有计数和 `completed_depth`；覆盖错误与差异均为 0。另核对了输入来源、12 份源码/上游快照、保留的原生程序摘要及全部 WASM startup 中的程序/加载表摘要。此次复核只读已有结果和小文件，没有重跑求解，也没有重新读取 15.6 GB 大表；大表依据运行时加载摘要及当前 size/mtime 与原记录一致。

该轮 guard 的 `stopped` 为空，Swapouts 保持 0，采样进程树峰值为 **16,080,437,248 bytes**，最小保守余量为 **20,818,477,056 bytes**，未触及保护门槛。这个进程树采样值不能替代前述独立测得的 Opt9 原生最大 RSS **15,569,256,448 bytes**。

## WCA 前 100 条统一基准（2026-10-13，进行中）

后续追加（2026-10-13）：维护者明确只补 H9 并测试。H9 建表支持已加入唯一
`table_generator` 和 C worker，保持上游生成、校验、内存生成后写盘的算法不变。
H9 预计 15,169,187,432 字节；专用 guard 的 h9gen 路径仅放行这一目标，16 线程、
17,316,671,080 字节 RSS 预算，共享换出基线和研究锁。配置/元数据/命令范围的
9 项检查通过；表生成及 Rust H9 单次 100 条实测尚待完成。Opt7 WASM/Rust
单次对照已完成（`benchmark-wca100-opt7-single`）：WASM 222.220814 秒，Rust Opt7 206.352212629 秒，200 解已验证。
维护者随后要求停止 4 线程并改为 16 线程。旧进程组已退出，日志保存在
`.tmp/cubeopt-reverse/h9-generation-4threads-stopped/`；16 线程建表于 2026-10-13T12:45Z 启动。
沿用同一系统启动及 Swapouts=0 基线、相同 RSS 上限，未重设保护记录；实际 16 线程 worker 已确认运行。

### Rust H7/H10 最终结果（已完成）

两档使用相同完整 100 条语料、同顺序、单求解线程与 8 contexts；每档
单进程预热 100 条后计时三轮。各 400 条输出全部通过独立 cubing.js 验解，
同一状态跨轮及跨 H7/H10 的最优步数全部一致。加载与预热不计入搜索时间。

| 档位 | 三轮 100 条总耗时（秒） | 中位数（秒） | 独立峰值 RSS（字节） |
| --- | --- | ---: | ---: |
| Rust H7 | 269.189350 / 264.683874 / 255.368703 | 264.683874 | 3,801,907,200 |
| Rust H10 | 59.122515 / 57.439391 / 59.590332 | 59.122515 | 30,343,528,448 |

H10 在该语料下速度约为 H7 的 4.48 倍。两个进程均正常退出，资源保护未触发，
同次系统启动的 Swapouts 始终为 0。H7 证据前缀为
`.tmp/cubeopt-reverse/wca100-rust-h7-v2`，H10 为 `wca100-rust-h10-v2`；
各自保留 `.jsonl`、`.stderr.log`、`-resources.json`、`-report.json`。
已本地回填页面，未推送。用户最终只要求现有表 H7/H10，其他档位不在本轮范围。

最新范围：维护者仅要求现有表的 Rust H7/H10，不补表、不跑 Nissy、Opt 或 H11。
Rust 专项采用单进程完整 100 条预热，然后同顺序三轮计时，400 条结果均独立验解；
与此前 Opt8 的每轮新进程协议分别记账。H10 已完成：59.122515 / 57.439391 /
59.590332 秒，中位数 59.122515 秒，独立最大 RSS 30,343,528,448 bytes。
原始结果与资源记录为 `.tmp/cubeopt-reverse/wca100-rust-h10-v2.*` 及同名
`-resources.json` / `-report.json`。H7 旧的 10 分钟窗口运行主动终止并保留，
完整重跑使用 `wca100-rust-h7-v2`。原生 H48 基准新增显式
`CUBEOPT_BENCHMARK=1`，只将该基准的时限设为一小时，RSS、压力、Swapouts、
2 GiB 余量、H11 拒绝与既有停止基线不变；配置回归 7 项通过。
结果复核及页面回填入口为 `report-rust-wca100.mts`，它不启动任何求解。

固定输入：`solver/testdata/benchmarks/wca-first100.json`，来自统计源
`wca_scramble/wca_scrambles_no_wide_move.txt` 前 100 个物理记录，ID 22001 至
273001，保留原顺序及完整打乱。规范语料 SHA256 为
`92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde`。
不复用历史 18/60 条耗时，不截短打乱，不按运行速度挑样本。

H10 基准已支持 `--cases`，原 60 条默认协议仍保留。当前 H10 启动检查要求
34,631,281,512 bytes，观测保守可用 12,811,141,120 bytes，故未启动。
Opt8 使用现存表经 guard 顺序运行 Rust/WASM，输出目录
`.tmp/cubeopt-reverse/benchmark-wca100-opt8`，资源日志
`.tmp/cubeopt-reverse/wca100-opt8-resources.json`。
每个进程完整预热 100 条，首轮排除，三轮正式结果取总搜索时间中位数；
每条 120 秒超时，任何失败保留记录且整组不发布为完成结果。
H11 不运行；一次仅驻留一个引擎；内存保护触发后不重设基线续跑。

## 2026-10-13 双底 H10 多线程接入验收

独立 target/zbll 程序 SHA-256 `4967dbfcb48cf48aacc45cd6b29acd2c2a6bc30d2877c5575e059907216856f1`；不覆盖历史 release。每线程独立求解不同输入，借用同一只读 H10 映射。64 个双底代表状态（固定均匀索引取样）加全部 60 个历史状态，共 124 例；每配置完整预热一轮，再连续测量两轮。每次只运行一个引擎，计时包含 IPC/调度/输出写入，排除加载及独立验解；这是批处理墙钟协议，不与上面的搜索内核自报时间直接合并。

| 配置 | 正式第一轮 s | 正式第二轮 s | 平均 s |
|---|---:|---:|---:|
| Rust 1 线程 | 55.285 | 56.387 | 55.836 |
| 原 C 16 线程 | 8.342 | 8.571 | 8.456 |
| Rust 16 线程 | 5.974 | 5.884 | 5.929 |

这组混合样本吞吐速度比 1.426×，耗时减少 29.89%；未做全任务速度外推。1,116 解全部独立 cubing.js 复原并匹配已有最短 HTM，另有 3 次启动检查；Rust 124 状态跨 1/16 线程与三轮共 620 次非时间字段比较全等。进程树 RSS 采样峰值 30,642,421,760 bytes；Swapouts 0，保护未触发。报告 `.tmp/zbll-rust-acceptance-20261013-v3/{input.json,raw.jsonl,report.json,thread-equivalence.json}`，资源记录 `.tmp/cubeopt-reverse/zbll-rust-acceptance-v3-resources.json`。失败的 v1（Node 模块加载）与 v2（成对 x2 输入转换缺失）没有产生正式结果，目录保留；v3 已对所有输入的转换前后完整棱角状态逐条核对。

### WCA100 更新

Opt8 已完成 1,600 条验解（含预热），三轮正式每轮 100 条：
Rust Opt8 总耗时 107.095847 / 113.389643 / 106.762833 秒；
WASM Opt8 128.775343 / 131.740247 / 130.616558 秒。
中位数分别为 107.095847 和 130.616558 秒，WASM/Rust 为 1.219623。
Rust Opt8 不是 Rust H8，不将该结果标在 Rust H8 行。
进程树采样峰值 8,336,228,352 bytes，Swapouts 为 0，保护未触发；
采样峰值不作为独立引擎最大 RSS 发布。

维护者释放内存后，H10 经同一基线及资源预算检查启动，结果保存于
`.tmp/cubeopt-reverse/benchmark-wca100-h10`。启动后观测进程树峰值约
30.5 GB，保守余量大于 41 GB，Swapouts 为 0。完成前不填性能成绩。
`publish-wca100.mts` 从原始逐条结果核对完整语料、轮次、总时间和中位数后
回填页面，H10 与 Opt 使用同一份冻结输入，保留旧成绩与原始程序。

## 本机 18 线程统一基准（2026-10-13，进行中）

本节取代比较页的历史测试口径。按维护者最新要求，只测试本机 Mac M5 Pro
（18 核、64 GiB），每个引擎使用 18 个实际搜索线程、一个输入任务，固定 WCA
前 100 条原顺序只跑一遍，不预热，不重新测试阿里云。页面只接收这一口径的完整
已验解报告；历史原始结果和程序保留，历史报告入口不再写入页面。

已有表可用于原版 WASM Opt1–9、Rust WASM Opt1–9、Rust 原生 Opt1–10 和
Rust H7/H10。H0–H6、H8/H9 缺表，不补表；H11 禁止运行；本轮不运行 Nissy。
Opt10 使用已完成的 v2 表，旧 v1 不完整文件不参与测试。

原生 18 线程程序使用独立 `target/multithread` 构建，未覆盖旧版。共享内存 WASM
保留默认 4 线程，增加显式 18 线程支持；18 线程构建已完成全部 9 档的浅层状态
正确性验证。正式大表测试统一经过 guard，沿用原系统启动和 Swapouts 证据，
串行执行，一次仅驻留一个引擎；任何保护停止均保留记录，不自动重新设置基线。

每份正式报告须核对 100 条顺序、18 个搜索线程、独立复原全部解及 H10 已验证
最短长度、正常退出和未触发资源保护。耗时为 100 条搜索时间之和，排除加载；
峰值 RSS 含表加载。界面只显示整数 MB、一位小数 GB 和一位小数秒数，不显示
精确字节数。尚无正式 18 线程报告时显示待测，不复用旧的单线程成绩。

### 已完成的本机 18 线程结果

| 引擎 | 100 条总搜索秒数 | 峰值 RSS 字节 | 独立验解/最优长度 |
| --- | ---: | ---: | --- |
| Rust H7 | 25.372522463 | 3,865,968,640 | 100/100，通过 |
| Rust 原生 Opt9 | 6.385029210 | 15,642,624,000 | 100/100，通过 |

结果分别在 `.tmp/cubeopt-reverse/wca100-mt18-rust-h7-review/result/` 和
`wca100-mt18-rust-opt9-review/result/`，保留完整报告、消费凭证及原始输出。
两项均单轮、不预热、正常退出，Swapouts 为 0，资源保护未触发。

H10 于 2026-10-14T05:02:55Z 在启动前被余量检查拒绝，没有加载表或求解，
也没有消耗该档运行凭证。Rust WASM Opt9 于 05:04:37Z 在首个结果输出前
出现 worker `unreachable`，未形成完整实测；资源记录仍为正常压力、Swapouts 0。
守卫因子进程非零退出留下独立停止记录，后续队列停止，未自动重启或重设基线。
失败结果不填入性能图，原版 WASM 的对照尚未开始。

### WCA1000 / 16 threads (local request, 2026-10-13)

- Targets: original Opt9 WASM, Rust Opt9 native, Rust Opt9 shared WASM. One pass, no warmup; same first 1000 full source records.
- Corpus: solver/testdata/benchmarks/wca-first1000.json, SHA256 5b42a18086b27e974115a73696702017b5dde0a19c9819a77c88c8014d67c8ea.
- Runner: run-wca1000.mts, all computation remains under guard.mts.
- Status: original WASM startup rejected before any solve or table loading: fresh 3 GiB startup headroom unavailable. Observed reclaimable 12.6 GiB; required WASM 21.4 GiB / native 18.7 GiB. Swapouts 0. Neither other engine started. No valid performance result.
- Attempt evidence: .tmp/cubeopt-reverse/wca1000-mt16-original-wasm-opt9.stderr.log and -exit.json. This is a preflight rejection, not a consumed benchmark. Preserve resource failure history; do not lower budgets or automatically reset/retry.
- Previous scores must not be presented as the new 1000/16 results. User does not want historical results displayed.

### WCA1000 / 16 threads — 2026-10-14 outcome

- Explicit resume after startup-memory rejection; archived only the unconsumed preflight attempt in .tmp/cubeopt-reverse/preflight-archive-20261014. No baseline reset.
- Original Opt9 WASM: 625 completed and independently verified, process exited 1 on case 626 (ID 1683001), stderr only unwind. Incomplete; no 1000-case time.
- Rust Opt9 native: 1000 completed and independently verified, 70.54567079799996 solve seconds, peak RSS 15645851648 bytes; 625 original reference lengths matched.
- Rust Opt9 shared WASM: failed on first case, worker 3 cubeopt_begin -> GenericOracle::conjugate -> panic_bounds_check. Zero completed rows.
- All three were 16 search threads, single pass, no warmup, same frozen corpus. No swapout or resource-protection trigger; program failures preserved and no engine retried. Local only.
- Page replaced old 100/18 result with valid native 1000/16 result. Opt10 remains unmeasured under this protocol. No speed ratio claimed against incomplete WASM runs.

### 原生 Opt9 实验优化（2026-10-14）

维护者要求实验优化并保留原版。同一 WCA1000、16 个搜索线程、单轮不预热：专门化 + BPMX 为 **59.1430 秒**；再加动态前缀分工为 **55.8018 秒**。两版峰值 RSS 均约 15.64 GB；各 1000 条独立验解通过，全部长度与保留原版一致。无新增 Swapouts，guard 正常退出，无保护触发。

相对之前 70.5457 秒同协议基准，本轮最快实验少耗时 20.90%、少访问 7.52% 节点。原版本轮没有重跑，不宣称已证明稳定提升或达到了 40 秒。原版程序、完整源码备份和原表保留，实验使用非默认 feature 和独立 target，未替换默认版本、网页或服务器，未提交推送。详细数学说明、检查及产物索引见 [opt9-native-experiments.md](opt9-native-experiments.md)。

### 原生 Opt9 第二轮：保留原版与 55.8 秒版（2026-10-14）

仍为相同 WCA1000、16 个搜索线程，每个新候选单轮且无额外预热。C 预取为 56.0287 秒；D 加等价四分之一转剪枝为 46.6339 秒；E 加成功查询缓存和根下界为 47.9108 秒；F 去掉 E 缓存，使用固定上下文流水线及根下界，为 **43.2312 秒**。

F 峰值 RSS **15.64 GB**，进程树峰值 15.75 GB；1000 条全部独立验解通过，长度同时匹配原版和 55.8 秒版。各轮正常退出，Swapouts 为 0，资源保护未触发。F 比保留 55.8018 秒结果少耗时 22.53%，比原版 70.5457 秒少耗时 38.72%；两份旧版没有重跑，属于同协议历史对照。**尚未达到 40 秒。**

原版、55.8 秒版与新最快版均有独立源码/程序/证据封存，原 Opt9 表不变。F 程序位于 `target/opt9-fixed`，完整快照位于 `.tmp/cubeopt-reverse/opt9-native-fixed-preserved-20261014/`；详情与数学依据见 [opt9-native-experiments.md](opt9-native-experiments.md)。只改本地，未更换默认程序、网页或服务器，未提交推送。


## 2026-10-14：Opt9 第三轮探索 30 秒

固定 WCA 前1000条、16个实际搜索线程、每个新候选单轮、不预热。同一 Opt9 主表；原版70.55秒、B55.80秒、F43.23秒不重测，源码/程序完整保留。本轮 G NISS排序45.6850秒，H三进制坐标47.1400秒，I相反面两步剪枝45.6115秒，J全局前缀评分46.1451秒；全部1000条独立回放与三个参考的最优长度一致，正常退出、Swapouts=0、无保护触发。**当前最佳仍是F43.2312秒，未达到30秒。** 不将单轮历史对照表述为同期重复测量；没有替换默认版本或发布。

J阶段统计显示52.75%节点位于已穷尽的较短深度，47.25%位于找到解的深度，另17,000根证明节点；节点比例不能当作时间比例。Opt10仅完成小坐标等价性审计，没有运行其大表或基准。各候选完整源码/可执行文件/证据快照、数学边界与后续方向见 [Opt9实验跟踪](opt9-native-experiments.md#第三轮保留三版探索-30-秒四个候选完成)。
