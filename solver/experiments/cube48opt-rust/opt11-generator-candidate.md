# Opt11 建表候选 G1 / G2

2026-10-29：仅源码草稿。未编译、未执行测试、未载表、未建表，也没有建表耗时或性能结论。基线及任务边界见 [优化跟踪](opt11-optimization.md)。

## 版本与集成

实现位于 `src/opt11_generate_candidate.rs`，复用 `opt10_generate::generate_resumable`，不复制 BFS、后缀枚举、断点或表存储实现。

| 版本 | 稳定 ID | 改动 |
| --- | --- | --- |
| G1 | `opt11-g1-unique-aliases-v1` | 保留原 Cube 状态、原 full key 路径；每个状态内只向同一表格写一次相同别名 |
| G2 | `opt11-g2-prepared-aliases-v1` | 在 G1 的基础上，把完整别名和最小 key 随状态一次准备；key 查询和投影写入复用同一份结果 |

`generate_candidate_resumable(candidate, coordinates, table, config, resume, checkpoint, progress)` 是未来受保护 runner 的内部适配入口。它借用同一常驻表，不打开文件、不自动重试、不发布结果。原版 `generate_to` 保持原路径；已在 `opt11_generate.rs` 的 `generate_candidate_to` 中接入显式候选分派，但没有任何启用中的 CLI 调用它。

调度层已完成源码接入，尚未编译或执行：

- `lib.rs` 通过非默认 `opt11-generation-candidates` feature 登记模块；默认 features 不变。
- 候选使用 `<output>.<candidate-id>.checkpoints`，B0 保留 `<output>.checkpoints`；相同 output 共用 B0 的 `generation.lock`，防不同实现并行争用该输出。
- `checkpoint_magic()` 写入生成状态；加载时严格匹配，G1/G2/B0 相互拒绝。内部 BFS key/slot 布局虽然相同，仍隔离版本证据及恢复边界。
- 继续使用已有文件 hash、完整表检查、最近两个完整断点及 `.partial` 保留逻辑；已有最终表不能被替换，错误不自动重试，Opt11 运行拒绝保持生效。

## 为什么这两种改动可能减少工作

B0 的短 BFS 对每个新 Cube 先算 `full_key`，成功插入后又调用 `mark_projected`。两次都枚举角块稳定子、做共轭并计算完整 EO11 坐标。对称性较高的状态还可能由不同稳定子产生相同坐标，导致重复的原子最小值写入。

G1 只减少这些完全相同的写入，不改变坐标计算次数。G2 在 `moved` / `representative` / `solved` 构造状态时一次准备完整别名；后续取 key 和写表直接复用。后缀叶子原本只算一次坐标，因此 G2 主要节约短 BFS 的第二遍和重复检查，不声称所有节点都受益。

## 等价性依据与边界

1. 每个状态的所有稳定子图像仍然被枚举；只删除数值完全相同的 index，保留首次出现顺序。原子操作为 `min`，重复同一 index、同一 depth 对最终值无影响；不同 index 即使共享一个打包字，也不能合并。
2. Opt11 的 `mark_projected` 输出完整 EO11 别名，其最小值就是 `full_key`。G2 只缓存这两者的共同输入结果。私有 `FullAliasSpace` 标记目前仅给 `Opt11Coordinates`；不能给 EO10 投影空间使用，因为 EO10 丢弃了一位 EO。
3. BFS visited 仍为原精确 `ShortStates`。两候选都不读取 PDB 值做 visited，不改变移动顺序、短层集合、后缀深度、移动约简、终止条件或枚举计数。
4. 最多 48 个别名使用状态内固定数组，无全局缓存或哈希碰撞替代。若以后坐标契约超出此上限会显式失败，不能静默漏图像。
5. checkpoint 仍只保存原精确 BFS slots 和原子表，不保存 G2 临时准备状态；恢复时重新从相同 key 构造本地状态。每个版本使用独立状态标识，不混用断点。

这些是静态推导，不是已通过的正确性验证；Cube 真实坐标构造、完整算法和编译结果均待后续验收。

## 代价与可能变慢的原因

- G1 的线性去重在别名大多唯一时增加比较；高对称状态减少的原子写入能否覆盖这部分成本未知。
- G2 的状态变大，每次移动准备并保留最多 48 个 `u64`。栈帧和复制成本可能抵消省掉的坐标计算；编译器能否消除无用复制尚未检查。
- G2 仍会为未进入 visited 的状态准备全部别名；这与基线 `full_key` 所需的稳定子枚举相同，但额外保存会有成本。
- 小样本速度、低对称状态或某一个深度的效果不能当作完整建表加速证明。本轮没有速度预测，也不计算峰值内存。

## 已写但未运行的验证源码

模块内准备了三个小 fixture：重复图像只写一次且拒绝 key 零回调；G2 一遍 canonicalization 复用 key/别名；完整循环图生成对比 B0/G1/G2 的每格最短距离、精确状态数、末层数及展开数。调度层另有 B0/G1/G2 状态 magic 和 journal 路径隔离的测试源码；均未运行。

未来另外需要验证：真实 Opt9 小快照上的完整 EO11 别名逐项差分（含高稳定子、填充格、零/极值 EO）；不同线程数下每格结果；BFS 及后缀边界故障恢复；G1/G2/B0 checkpoint 互拒；独立完整建表校验。现在不执行这些项目。
