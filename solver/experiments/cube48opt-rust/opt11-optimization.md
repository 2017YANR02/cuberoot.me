# Opt11 优化跟踪（2026-10-29）

## 范围与当前状态

维护者要求：先建跟踪文档，再并行准备多个优化版本；原始版本全部保留；**不运行任何计算**。

本轮只阅读、编辑、归档源码和文档。不编译、不执行测试（包括小数据测试）、不建表、不打开或映射剪枝表、不求解、不跑基准。所有候选均为 **未验证源码**，没有速度或正确性实测结论，不晋升正式版本。

这里的 Opt11 是 CubeRoot EO11，不是 Nissy H48 h11。CLI、guard、hook 对 Opt11 的运行拒绝保持生效；不新增运行开关或保护基线。现有 Opt8/Opt9/Opt10 正式构件、统计入口、成绩和历史实验保持原样。

## 原版保留

- B0：本轮开始前的 Opt11 源码，含 `opt11.rs`、`opt11_generate.rs`、共享坐标、表格式、建表器、搜索器及安全入口。B0 本身也尚未编译或验证。
- 优化前已创建独立本地源码快照：仓库根目录下 `.tmp/cubeopt-reverse/opt11-source-baseline-20261029-WsCutS/`；`BASELINE.json` 记录复制范围，保存完整 `src/`、Cargo 配置及相关入口/文档，不包含大表或构建产物。该目录仅存在于本机，不是已发布或已验证版本。
- 六个候选的完成态源码另存于 `.tmp/cubeopt-reverse/opt11-candidates-source-20261029-knKjje/`，清单为 `CANDIDATES.json`。它们共享基础实现，通过独立策略/feature 区分；不是六份重复的求解器，也没有构建产物。两个源码档案都应保留，不作普通临时文件清理。
- 新候选使用独立模块与显式策略，不覆盖 B0 的默认行为。共享代码只增加必要的复用入口，保留原调用路径。
- 候选的筛选只能发生在另一次获准验证后；本轮不删除任何候选，也不把推测写为成绩。

## 候选与分工

| 编号 | 方向 | 预期减少的工作 | 状态 | 源码归属 |
| --- | --- | --- | --- | --- |
| B0 | 原始 EO11 建表与求解 | 对照基线 | 源码已存在，未验证 | 保留原模块 |
| S1 | 搜索策略 | 根下界跳过不可能的深度、动态分工、等价分支剪枝与父状态拒绝传播 | 已写源码，未验证 | `opt11_search.rs`，搜索 agent |
| S2 | 搜索证明复用 | 在 S1 上复用直接子群拒绝证明，删除已证无效的反侧半转 | 已写源码，未验证 | `opt11_search.rs`，搜索 agent |
| L1 | 地址准备与预取 | 在坐标准备阶段保存读地址，提前请求只读内存 | 已写源码，未验证 | `opt11_lookup.rs` / `eo_table.rs`，读取 agent |
| L2 | 分组读取 | 在 L1 上将八个上下文的主字和块最小值提前分组读取 | 已写源码，未验证 | `opt11_lookup.rs`，读取 agent |
| G1 | 建表别名去重 | 对同一状态的同一个完整坐标只做一次原子最小值写入 | 已写源码，未验证 | `opt11_generate_candidate.rs`，建表 agent |
| G2 | 建表坐标复用 | 状态携带完整别名与最小 key，避免 BFS 再次对称化 | 已写源码，未验证 | `opt11_generate_candidate.rs`，建表 agent |

根 agent 维护集成、版本选择、此文档及最终静态审阅；子 agent 按文件分工实现。方向可按源码证据调整，必须记录原因，不预设性能收益。

## 已接入的源码入口

| 版本 | 选择方式 | 非默认 feature |
| --- | --- | --- |
| B0 | `Opt11Solver` / `opt11_generate::generate_to` | 无 Opt11 候选 feature |
| S1 | `Opt11SearchOracle::new(&solver, Opt11SearchPolicy::Search)` | `opt11-native-search` |
| S2 | `Opt11SearchOracle::new(&solver, Opt11SearchPolicy::Coset)` | `opt11-native-coset` |
| L1 | `Opt11LookupOracle::new(&solver, Opt11LookupPolicy::Prefetch)` | `opt11-lookup` |
| L2 | `Opt11LookupOracle::new(&solver, Opt11LookupPolicy::Grouped)` | `opt11-native-batch` |
| G1 | `opt11_generate::generate_candidate_to(..., UniqueAliases)` | `opt11-generation-candidates` |
| G2 | `opt11_generate::generate_candidate_to(..., PreparedAliases)` | `opt11-generation-candidates` |

以上只是内部源码入口，**不是可以运行的命令，也不是运行许可**。CLI 仍在文件访问前拒绝 Opt11；未加命令行候选参数或环境变量豁免。搜索包装器可借用 L1/L2 查表包装器作后续组合，但首轮应先隔离各因素；不凭组合数量宣称更多独立算法。

L0（查表包装器的 `Baseline`）只用于日后衡量地址准备开销，不冒充原版 B0。带批量/固定 context feature 的构建会改变公共代码生成；真正的 B0 对照应使用独立基线构建。S1 的根下界跳层只走现有多线程 coordinator，单线程路径并未增加该行为。

设计、数学不变量与待验证风险分别见 [搜索候选](opt11-search-candidates.md)、[查表候选](opt11-lookup-candidates.md)、[建表候选](opt11-generator-candidate.md)。可能变慢的原因包括：更多分支/原子认领开销、预取时机不合适、额外块读取，以及 G2 的更大状态复制。

### 原版与候选的边界

- 原 `Opt11Solver` 查表/搜索策略不变，新增只读表借用接口仅供候选使用；`EoTable::get`、原 Opt10 读取/生成路径不改。
- 共享搜索器只扩展原有 batch/coset 编译条件，复用原实现；不改其剪枝函数主体、不启用 Cargo 默认 feature。
- B0 的生成函数沿用原坐标适配、原 checkpoint 路径及 `CBRT-EO11-GEN01` 标识。G1/G2 分别使用带候选 ID 的 checkpoint 目录和独立 magic，不能混用恢复状态。
- 同一输出的 B0/G1/G2 共用原排他锁。拿锁后再次检查输出是否已存在，再读取断点或分配表，避免另一任务刚发布后发生无用重算。输出仍拒绝覆盖，失败不自动重启。
- 未来源码审查清单包含新模块。旧 Opt10 档案核对改为使用其冻结 build 记录的源文件清单，避免新增 Opt11 文件后把历史档案误判为缺失；既有摘要、结果和构件核对保留。正式 release 文件和归档内容没有改动。

## 各版本必须保持的契约

- 输出完整 HTM 最短解；不能通过漏搜、削弱最优性保证或更改节点计数来获得表面提升。
- EO11 坐标、填充格、两位压缩、块最小值及表头校验保持兼容；不同格式必须明确隔离。
- 建表使用完整 EO11 状态去重，不把压缩值当作 visited；对称别名覆盖完整。
- 原子写入只能收紧同一个安全下界；建表恢复必须继续同一算法与配置，不能把不同候选的 checkpoint 静默混用。
- 求解器与只读大表保持常驻，checkpoint/结果保留策略和现有资源保护不弱化。
- 不改 Cargo 默认 features，不替换正式 Opt10 冻结构件，不把 Opt11 接入日常统计。

## 后续验证清单（本轮不执行）

1. 独立编译 B0 与各候选，检查候选组合和原版本兼容性。
2. 小数据坐标/别名/压缩读取逐项差分；建表结果与 B0 逐格一致，故障恢复与一次完成一致。
3. 以独立最短距离和解回放验证剪枝证明，检查串行/并行覆盖及取消语义。
4. 在获得单独运行授权、具备正确表与资源保护后，再按同输入、同线程、各一轮不预热测量；如实保留失败与变慢版本。

## 工作记录

- 2026-10-29：先建立本跟踪文档，再安排 B0 归档与分工。
- 2026-10-29：完成 B0 源码归档，三个 agent 分别处理搜索、查表、建表候选。根 agent 统一负责公共接口、feature/cfg、checkpoint 隔离和文档。
- 2026-10-29：六个候选源码与非默认 feature 已接入；搜索/建表 agent 对公共接线作了静态交叉审阅。新增小型读取、别名和 checkpoint 隔离 fixture 仅写入源码，均未执行。无构建、验证或性能结论。
- 2026-10-29：完成源码差异/空白审阅（`git diff --check`），另存六个候选源码快照。全程仅文件操作和文本审阅：未运行 Cargo、格式化器、测试、算法脚本或任何求解/建表计算；未提交、推送、发布。
