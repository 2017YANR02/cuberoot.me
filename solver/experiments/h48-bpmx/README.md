# H48 单层 BPMX 实验

本目录保留独立补丁，原 `solver/vendor/nissy-core` 不修改，H10 文件不改写。候选复用 H48 已经查出的下界，把子节点提供的证据向父节点传播一次，不新增剪枝表。

## 数学依据

记 `d(x)` 为状态 `x` 到复原态的精确 HTM 距离。一次面转、其逆转均属于代价为 1 的合法操作，因此对任意实际一步邻居 `y`，有 `d(x) >= d(y) - 1`。若 `L(y)` 是可采纳下界，即 `L(y) <= d(y)`，则 `L(y) - 1` 也是父状态 `x` 的下界。

代码中父状态剩余预算为 `r`，传入 `h48_prune_pipeline` 的 `target = r - 1`。因此仅在以下严格不等式成立时丢弃整个父分支：

```text
L(y) > r + 1 = target + 2
```

等号不能剪枝：父状态 `U` 的距离为 1，邻居 `U R` 的距离为 2；当父预算为 1 时，子界等于 `target + 2`，父状态仍有合法最短解。

对于前转以及 NISS 中的逆状态，结论不变。HTM 字长满足 `d(x) = d(x^-1)`，左乘或右乘一个面转均最多改变精确距离 1。代码中的 `inverse(move(x,m)) == premove(inverse(x),m)` 保证取到的逆状态对应同一个实际邻居。该论证依赖下界可采纳，不要求启发式在相邻节点间保持一致。

## 实现边界

- 仅传播本次真实取得的 `get_h48_cdata`、`h48_prune_lookup` 结果。
- 不传播 Stage 0 的半转继承缓存，不修改 `pn/pi`、`lb_normal/lb_inverse`、动作掩码或 NISS 选择规则。
- `h48_prune_pipeline` 返回是否已证明父分支无解；调用方在递归计数和状态修改之前返回。
- 开关默认为关。`cuberoot_h48_bpmx_enable(bool)` 使用原子开关，每次求解在工作线程启动前取得快照；运行中的求解不受后续切换影响。
- 这是一次子到父的 BPMX 剪枝，不包含跨多层回传的完整递归 BPMX。后续可评估独立的通用下界返回值，逐层减 1 传播；仍不能混入 H48 专属的半转界。

`stats[7]` 是父剪枝次数。`stats[8]` 是切断时尚未标记 `stop` 的其他候选邻居数；这些候选尚未全部完成 H48 过滤，因此不能把该数称为已经证明节省的递归节点数。原 `stats[0..2]` 继续表示生成节点、主表查询、fallback 次数。

此候选能否显著提速取决于真实搜索中不一致下界的频率。若启发式处处一致，邻居界无法提供新的父剪枝。即使发生父剪枝，额外分支与统计也有成本；必须分别核对最短解长度、节点数、查表次数和运行时间，不能从论文倍率推断当前 H48 的收益。

## 接入与最小验证

把 vendor 快照复制到实验产物目录，在副本根目录应用 `candidate.patch`。编译 `engine.c` 时让 include path 指向该副本的 `src`；`engine.c` 已包含 `nissy.c`，不要再次单独编译它。调用原 `nissy_solve`，每次调用前用开关选择实验或同构建关闭实验的对照。

`engine.test.c` 单独编译，不与 `engine.c` 一起链接。测试约使用 1.1 MB 人工 cocsep 缓冲，覆盖严格阈值、开关、统计、正逆 pipeline 提前返回，并最多枚举两步来验证真实魔方的数学边界。它不读取 H10、不生成表、不调用求解器，不替代完整最优性和性能验收。

一手依据：[Felner 等，Inconsistent Heuristics in Theory and Practice](https://tzin.bgu.ac.il/~felner/2011/incnew.pdf)，以及 [Zahavi 等，Predicting the Performance of IDA* Using Conditional Distributions，第 10 节](https://s.aaai.org/Papers/JAIR/Vol37/JAIR-3702.pdf)。这些论文讨论 BPMX 利用不一致但可采纳下界，提前结束 IDA* 子树；本实验只采用这一证明成立的局部传播规则。
