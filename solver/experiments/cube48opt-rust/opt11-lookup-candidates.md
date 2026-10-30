# Opt11 查表候选（源码草稿）

2026-10-29：按维护者“不跑任何计算”要求，只写代码和静态审阅。**未编译、未运行测试、未载表或求解、没有速度成绩。** 主跟踪：[opt11-optimization.md](opt11-optimization.md)。

## 保留的版本

| 版本 | 接入方式 | 改变的工作 |
| --- | --- | --- |
| B0 | 原 `Opt11Solver` | 原始坐标准备及 `EoTable::get`，不经过新 wrapper |
| L0 | `Opt11LookupOracle` + `Baseline` | 同一原解码器，增加与候选相同的 probe；只作地址准备开销对照，不冒充 B0 |
| L1 | `Opt11LookupOracle` + `Prefetch` | 在 `prepare` 中校验并保存 word/shift，发出只读预取；`lookup` 复用地址 |
| L2 | `Opt11LookupOracle` + `Grouped` | 保留 L1；把八个上下文的主字与块最小值读取移到解码前 |

L1/L2 都借用原求解器内唯一一份已校验主表，不创建、复制或映射第二份表。与搜索策略组合时，由外层 `Opt11SearchOracle` 包装本读取 oracle；本模块本身不开启任何搜索剪枝优化。

## 源码理由与差别

一个 EO11 坐标使用两个已知地址：两位 code 所在的 `word=index>>4`，以及 64 格块的最低四位 `minimum_word=word&!3`。code 为零时返回块最小值，否则返回 `base+code`。

L1 把地址、位移与坐标合法性检查放到 `prepare`；八个上下文准备坐标期间，可提前请求后续将读取的内存。它没有缓存下界，不依赖上一次查询，也不改变坐标。AArch64 使用现有风格的 PRFM；x86_64 复用 `prefetch::read_word`。其他架构会在候选构造时明确拒绝，避免把无效开关记为预取候选。

L2 在一个禁止内联的读取阶段，先读取每个有效查询的主字与块最小值，再统一解码。与已有 Opt10 `get_batch` 草稿的区别是：块最小值也提前读取，消除 code 解码之后才发起该读取的依赖。当主字已经是块首字时直接复用，不重复读同一个字。

这些只是待测假设：L1 的预取可能太早或太迟；L2 会为非零 code 多读一个字，可能增加指令、缓存流量或寄存器压力。此前 Opt10 分组读取没有胜过其保留最快版，不能据此声称这版 EO11 会更快；本版独立保留，是为了今后分离验证“地址准备”和“提前读取最小值”两个因素。

## 正确性与边界

- 每个 probe 必须通过 `EoLayout::<11>::valid_index`；padding、首两格和 512 格切片尾部仍被拒绝。随后检查当前 allocation 的 word 范围，32 位目标无法容纳的索引会明确失败。
- `Opt11Probe` 字段私有；不保存裸指针或解码结果。即便内部误将 probe 交给更短的测试 fixture，后续读取仍使用有界 slice 索引。
- 标量和批量读取都使用同一 code/minimum/base 公式。没有近似值、额外剪枝或表格式变化；`max_bound` 与对称变换由原 oracle 转发。
- `None` 槽不读表，返回零只作为未使用槽的占位；合法的零下界保持为零。重复查询不去重，不修改原调度次序。
- 预取只接收借用表内的有效地址，不改变任何数据。现有文件大小、散列、分布校验、断点与资源保护入口均不修改。
- `Grouped` 构造要求非默认 `opt11-native-batch` 且为 native target；否则返回错误。feature 不是运行授权，Opt11 CLI/guard/hook 仍拒绝运行。

## 集成契约

根 agent 负责以下最小接入；本候选只拥有 `opt11_lookup.rs`、本文件和 `eo_table.rs` 中新增的 EO11 只读借用接口：

1. `opt11-lookup=[]`，`opt11-native-batch=["opt11-lookup"]`；不加入 Cargo default。
2. `lib.rs` 在 `opt11-lookup` 下声明 `opt11_lookup`，并允许该 feature 在 x86_64 编译已有 `prefetch` 模块。
3. `Opt11Solver::table(&self)->&Opt11Table` 为 crate 内只读 accessor。
4. `PruningOracle::lookup_batch`、搜索批量阶段与 `native_parallel::Cancellable` 的转发 cfg 同步接受 `opt11-native-batch`，避免编译了候选却没有实际分组路径。
5. L1 使用不含批量 feature 的独立构建；L2 使用批量 feature 的独立构建。整份搜索器的批量 feature 会改变阶段顺序，未来对照须记录构建 features，不能把带该 feature 的 B0 当作原始 B0。

外部接口为 `Opt11LookupOracle::new(&solver, policy) -> Result<_, String>`，实现 `PruningOracle<Query=Opt11Probe>`。任何 feature、构造器及 wrapper 都不能绕过目前关闭的运行入口。

## 后续验收（本轮不执行）

`opt11_lookup.rs` 已写入前三类边界的小 fixture 测试源码（人工数组最多 256 字节），均未执行；真实求解器的转发/独立验解仍是后续项目。

1. 用很小的人工压缩数组覆盖四种 code、不同块最小值、字边界、padding 和 allocation 尾部；与独立公式及原 `get` 逐项一致。
2. 批量验证全空、单槽、混合空槽、重复坐标、同字与跨块查询；证明 `None` 不读取，合法零值不丢失。
3. 验证取消 wrapper 转发批量覆盖；L1/L2 在每个合法查询上与 B0 返回同一下界。
4. 获得新的运行授权后，分别记录构建 features 与原始成绩，做独立验解及同协议单轮对照。若变慢，保留代码和结果，不晋升。
