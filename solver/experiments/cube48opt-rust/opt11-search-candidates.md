# Opt11 搜索候选 S1 / S2

状态：2026-10-29 仅完成源码，**未编译、未运行任何测试、未加载表或求解**。实现位于 `src/opt11_search.rs`。没有 Opt11 性能成绩；Opt10 的历史成绩不能作为这些候选正确性或速度的验收。

## 保留与选择

原 `Opt11Solver` 是 B0；本文件不修改其行为。`Opt11SearchOracle<'a, O = Opt11Solver>` 借用已有 oracle，不复制剪枝表，不新增工作进程，也不按逻辑批次重建 oracle。`O::Query` 保持泛型，可以叠加独立 Opt11 查表候选。

`Opt11SearchPolicy` 明确区分三个策略：

| ID | 策略 | 与前版的差异 | 所需非默认 feature |
| --- | --- | --- | --- |
| `b0` | `Baseline` | 额外搜索策略全部关闭 | 无 |
| `s1-search` | `Search` | 根下界、动态前缀认领、等价四分之一转剪枝、父状态拒绝传播 | `opt11-native-search` |
| `s2-coset` | `Coset` | 在 S1 上增加直接子群拒绝证明复用 | `opt11-native-coset` |

包装器模块只随原生搜索候选 feature 导出；普通 B0 直接使用原 `Opt11Solver`，无需这个模块。构造器拒绝未编入的策略，避免选择了 S2 却静默执行 S1/B0。这个检查只是源码构建能力检查，不解除 `generate-opt11` / `solve-opt11` 的运行禁令。没有默认晋升，也没有新增 CLI 或环境变量入口。

完整 B0 源码另存于 `.tmp/cubeopt-reverse/opt11-source-baseline-20261029-WsCutS`。同一候选构建中的 `Baseline` 只关闭额外策略；固定 context/batch 等编译选项仍可能改变公共代码生成。以后正式对照应使用冻结 B0 的独立构建，不能把候选构建中的策略关闭冒充原始构件。

## S1 的依据

令 `D(g)` 为完整 HTM 最短距离，`H` 为所有面半转生成的子群，`h_H(g)` 为已完成并校验的 EO11 表读取出的安全下界。以下证明要求 `h_H(g) <= d_H(g) <= D(g)` 且 `h_H(a g) = h_H(g)`（`a ∈ H`）。这是现有搜索器本身就要求的 oracle 契约，不能换成一个任意的全状态估值。

EO11 保留完整棱朝向，但没有补入 H 内部的棱块排列身份。左乘面半转不改变棱朝向、角模式和棱分组，因此保留第十一位 EO 并不自动破坏该不变量；具体快速坐标、对称别名与压缩实现仍需未来逐项差分验证。

1. **根下界**：`max(h_H(g), h_H(g⁻¹)) <= D(g)`。多线程 native coordinator 从这个下界开始逐深度搜索，省去已有证明不可能成功的浅层。它与 `DepthSearch::new_with_initial_depth` 分别核验根查询，真实查询仍进入计数，取消不被当成深度完成。现有单线程 `search::solve` 仍从零开始；本候选不把单线程入口也宣称为跳过浅层。
2. **动态前缀认领**：保留同一组规范前缀，只让空闲线程通过原子操作认领尚未处理的前缀。每个深度全部完成后才重置认领记录；改变分工，不减少合法搜索覆盖。
3. **等价四分之一转**：`(gF′)⁻¹ = F²(gF)⁻¹`，而 `F² ∈ H`，两者反侧估值相同。若某个四分之一转的反侧查询已超过剩余步数，同一父状态的另一四分之一转也失败。现有实现检查 NISS 侧标记，只清当前 context 拥有的分支。
4. **父状态拒绝传播**：子状态下界 `h` 给出父状态的完整距离下界 `h−1`；父层预算同时多一步，所以每向上一级拒绝余量减少二。复用 `Context::reject_bound`，传播证明只用于本地回退，不能写回要求 H 不变的缓存。

固定 1/8 context 的公共实现仍只是一份搜索器，通过独立 feature 使容器长度成为编译期常量。不复制整套 DFS。

## S2 的依据与边界

S2 只在 S1 上开启 `allow_backward_coset`，复用 `Context::reject_backward_coset`。

正常侧子状态 `x = gM` 有 `d_H(g) >= h_H(x)−1`。当子状态预算为 `r`，直接查询得到 `h_H(x) = r+2`，就证明父状态 `d_H(g) >= r+1`，恰等于父预算。反侧先做半转仍在同一左 H 陪集中，却消耗一步，因此这类待探索分支可以删除。

实现必须保留原函数的限定：只消费直接查询的 excess=2；在普通父状态传播之前应用；根据保存的侧标记区分正常/反侧；只清当前 context 的待探索反侧半转；不改表值、缓存、其他 context、其他 worker 或前缀所有权。没有新增查表，也不启用跨多层 coset-chain。

## 集成约定

由主 agent 统一集成，避免同时编辑共享文件：

- `lib.rs` 声明 `opt11_search` 模块。
- `opt11-native-search` 依赖 `opt9-native-dynamic`、`opt9-native-quarter`、`opt9-native-root-bound`、`opt9-native-fixed-contexts`；父状态传播函数本身没有 `opt9-native-bpmx` 编译条件，不需要借它开启 Opt9 策略。
- `opt11-native-coset` 只依赖 `opt11-native-search`。不要依赖 `opt10-native-coset`，否则会顺带开启 Opt10 runtime/search。
- 在 `search.rs` 的原生 coset 条件中加入 `opt11-native-coset`，包括计数结构、拒绝函数、运行策略读取、调用点及内部证明入口；保留原 WASM 条件。`native_parallel.rs` 的相同计数汇总条件、`main.rs` 的相同计数输出条件同步扩展。
- `bpmx_check.rs` 的两处 `test + opt10-native-coset/wasm-coset-prune` 条件可纳入新 feature，以便后续复用独立小距离证明；本轮不执行。
- `lookup_batch` 转发条件已预留 `opt11-native-batch`；主 agent 应同步 trait、共享搜索及 native 取消包装器的对应条件。保留已有 feature 路径。
- 不更改 Cargo 默认 features，不改 Opt10 oracle 的策略条件，不增加本轮运行许可。

## 待验证风险

以下均未执行，不能标记通过：

- B0 EO11 的安全下界、11 位快速/标量坐标、全部对称别名和左 H 不变性；S1/S2 不能修复错误的基础表。
- 独立短距离图的最优长度与实际解回放，覆盖 excess=1/2/3、NISS 侧交换、context split、无待探索分支祖先。
- S2 与 S1 的完整搜索覆盖、串行与并行结果、取消/有限节点预算，不能只比较更少的节点。
- 所需 feature 的独立构建及组合构建；旧 Opt10 特性关闭/开启时仍使用原策略。
- 动态调度和额外根查询可能增加开销；S2 可能减少分支却降低每节点速度。最终只按同条件的一轮实测记录选择，保留无收益版本。
