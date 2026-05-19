# cube555-daemon Optimization Handoff

接 PROMPT_optimize_solve_length.md 后两轮(v1 knob / v2 群论)总结。本文是给下个 AI
的状态快照 + 真实剩余路径。**不必读** PROMPT v1 / 全 BENCHMARKS,关键信息下面都有。

## 现状(2026-05-18 ship)

- Default config:`P5_SOLS=8` 单 seed,其它 env 默认
- bench (n=100):**avg 69.57 步 / latency 1509ms / 100% verify OK**
- Opt-in `CUBE555_BIDIR=1`(双向求解):**avg 69.09 / latency 3483ms**,-0.48 步 / +131% 延迟,uniformity 不破坏
- 7s budget 内余量大,移植性 / 内存 / 测试齐备
- 60 步目标 **不可达**(架构地板 ~67-68 步)

## 求解 pipeline

```
random state S ─[reducer 5-phase IDA*]─ ~51 步 ─[降到 3x3 等价]─[cs.min2phase Kociemba]─ ~19 步 ─ solved
```

- reducer = `cs.cube555.Search` 上游(`D:\cube\cube555\src\Search.java`),5 phase 各自局部最优 IDA*,**51 步是结构地板**
- Kociemba = `cs.min2phase`(打包在 `lib/twophase.jar`),~19 步接近 god's number=20,**没空间**
- 拼接 = `Daemon.java solveCore()` 返 raw (red, koc),`solvePicked()` 走 `invertAndConvert`(正向)或 `convertOnly`(反向)

## v1 + v2 已穷举的方向(全部失败 / 性价比太低)

| # | 方向 | 结果 |
|---|------|------|
| 1 | Kociemba `probeMin` 1e6 | 25x 延迟换 1 步,revert |
| 2 | Kociemba `probeMin` 1e4 | <1σ 噪声,revert |
| 3 | `phase5SolsSize=8` + pick-shortest p5sol | **-1.23 步 / +3% 延迟,ship default** |
| 4 | 全 phase 宽 beam(P1=400, P2-4=1500, P5=32) | -1.5 步 / 2.6x 延迟,不入 default |
| 5 | Multi-seed K=2 + 宽 beam | -1.8 步 / 3.2x 延迟,破坏 uniformity |
| 6 | Multi-seed K=5 P5=4 | -2.5 步 / 5.2x 延迟超 7s,破坏 uniformity |
| 7 | Kociemba `OPTIMAL_SOLUTION` (0x8) | >1000x 慢,kill |
| 8 | Reduction/Kociemba 边界 token cancellation | reducer 100% wide 结尾,`lastPlain=0`,零触发 |
| 9 | 双向解 (bidir) | **-0.48 步 / +131% 延迟,opt-in `CUBE555_BIDIR=1`** |
| 10 | 对称共轭 N=4 取最短 | cube555 无 corner sym 表,自造 6-8h,放弃 |

## 关键 API quirks(踩过的坑)

1. `Search.solveReduction(state, int verbose)` 第 2 参是 **verbose flag**(`USE_SEPARATOR=0x1`),**不是** quality 档位 — PROMPT v1 假设错
2. cube555 reducer 输出 **小写** wide(`r`, `r2`, `r'`),Kociemba 输出 **大写** plain(`R`, `R'`, `R2`)— 拼接 / parse 必须考虑
3. `Daemon.java parseMove()` 只接受大写 `R` / `Rw` 注法,**不认小写 `r`** — backward path 必须先 `convertOnly`
4. `CubieCube.doConj(int)` (line 449-458) 只 conj mEdge/wEdge/tCenter/xCenter,**不动 corner**;`CubeSym[48]` 也无 corner 数据
5. `Tools.randomCube` 走 cubie 级 Fisher-Yates 直接采样(perm + orient 数组),**不走 move 序列** → 没有 "原始 move" 可逆
6. tCenter / xCenter 存 **face index 0-5**(不是 cubie 标号),within-face cubie 不可区分 → 4!⁶ ≈ 2×10⁸ 个等价 facelet representative 同一 group element
7. Phase 5 内 64 个候选 reduction 长度差 ≤1 步(within-seed σ≈0),挑最短只值 ~1.2 步
8. Cross-seed σ≈1.5 步 → multi-seed K=N 期望收益 ~0.85σ × √(ln N),K=5 已严重递减

## 剩余真正可走的路径(只有 1 条)

### 替换 reducer 为非 phased 求解器

- **核心**:cube555 的 5 phase 在 coset 边界提交,每 phase 局部最优 → 全局非最优。统一 IDA*(不分 phase)能把 reduction 砍到接近 optimal ~38-42 步,total 接近 60 步
- **工程量**:**月级**
  - 需重新设计剪枝表(放弃 5 张 phase-specific 表,设计 1-2 张全局表)
  - 状态空间 ~7×10⁴² 不可枚举,得用 part-symmetry-reduction 或 corner+edge 联合启发式
  - 参考工作:Reid 求解器(论文级 50 步 5x5)、Korf-style admissible heuristic、tnoodle 5x5 random-state(不公开 solver 源)
- **风险**:剪枝表建表 + benchmark 调参可能花更多时间
- **入手点**:先 clone 一些公开 5x5 solver 看(如有),否则从 cube555 的 `Phase1Search`..`Phase5Search` 类合并入手

### 其它不建议碰

- **knob tuning**:7 个方向穷举完了,见上表
- **群论小 trick**:cancellation / inverse / sym 都试过或评估过
- **对称共轭**:cube555 缺 corner sym 基建,做的话要先补这层
- **multi-seed 默认**:破坏 WCA random-state 严格 uniform,产品语义降级
- **OPTIMAL_SOLUTION**:实测 >1000x 慢

## 代码位置

| 文件 | 内容 |
|------|------|
| `cube555-daemon/Daemon.java` | 我们写的胶水(唯一入 git 的 .java),env knobs + `solveCore` / `solvePicked` / `invertCubieCube` / `replay` / `convertOnly` |
| `cube555-daemon/local_bench.mjs` | 直 spawn java daemon,数 token + 计 latency,优化迭代用 |
| `cube555-daemon/BENCHMARKS.md` | v1 7 attempt + v2 3 attempt 详细数据 |
| `D:\cube\cube555\src\Search.java` | 上游 reducer(只读) |
| `D:\cube\cube555\src\CubieCube.java` | 上游 cube 表示 + sym 基建(只读) |
| `D:\cube\cube555\lib\twophase.jar` | cs.min2phase Kociemba(unzip 看 class) |

## 验收 / 测试

```bash
# baseline(default)
node cube555-daemon/local_bench.mjs --n 100 --par 3 --workers 3 --xmx 4g

# bidir
CUBE555_BIDIR=1 node cube555-daemon/local_bench.mjs --n 100 ...
```

- verify 必须 100% OK,任何 FAIL 立刻 revert 那个 attempt
- BENCHMARKS.md 新 attempt 写新一个 Attempt 段(沿 v1+v2 schema)
- 每个独立改动一个 commit,format `perf(cube555): <候选名> -X.X 步 / latency YYYYms`

## env knob 总表(部署侧能改的)

| env | default | 影响 |
|-----|---------|------|
| `CUBE555_P1`..`CUBE555_P5` | `200/500/500/500/8` | 5 phase 各自 sols pool 大小,改大延迟涨步数微降 |
| `CUBE555_SEEDS` | `1` | 多 seed 取最短,K>1 破坏 uniformity |
| `CUBE555_KOC_PROBE_MIN` | `500` | Kociemba 找到首解后继续搜的最少 probe,改大延迟暴涨 |
| `CUBE555_KOC_FLAGS` | `0` | Kociemba verbose flag。0x8 = OPTIMAL_SOLUTION (unusable) |
| `CUBE555_BIDIR` | `0` | 双向解,-0.48 步 / +131% 延迟,uniformity safe |
| `CUBE555_WORKERS` | `4` | 内部并行求解线程数 |
| `CUBE555_NATIVE_BIN` | (unset) | 设路径走 GraalVM 二进制,省 ~170MB RSS |
| `CUBE555_DISABLED` | (unset) | 设 `1` skip spawn,/v1/scramble/555-rs 返 503 |

## 一句话总结

cube555 当前架构 floor ~67-68 步,**60 步在不重写 reducer 的情况下不可能**。本仓库的优化空间已基本榨干,下一步要么接受 ~69-70 步现状,要么投入月级工程替换 reducer。
