# Square-1 WCA 12c4 度量的最优求解器 / 上帝之数

> 实验室笔记 (lab notebook)。给「我 + 未来的 AI」继续跟进 SQ1 WCA-12c4 度量的最优解与上帝之数 `D_WCA`。
> 起于 2026-06-16。配套代码:`solver/src/sq1_solver.rs`(twist 精确)、`sq1_twophase.rs`(near-opt)、新增 `Sq1WcaSolver`(WCA 精确)。
> 相关旧调研存档:memory `project_sq1_optimal_research` / `project_sq1_near_optimal_stats`,`.tmp/sq1-research/report.md`。

---

## 0. 一句话现状

- **twist 度量** God = **13**(已证,Masonjones 2005)。**face-turn 度量** God = **31**(已证,Chen 2017,722GB 盘 BFS)。
- **WCA 12c4 度量** God = **`D_WCA` 未知 = 真·未解之谜**(就是计时器报的打乱长度口径)。
- 本仓此前**没有任何 WCA-optimal 求解器**;`/scramble/stats` 的 "WCA 12c4" 列是拿 **twist 近最优解**数 token,**非** WCA 最优 → 系统性高估(报到 30,实则可证 ≤ 27)。
- **本笔记的目标**:① 造出 WCA 精确最优求解器;② 用它把 `D_WCA` 从「未知」收紧到「可证区间 / 精确值」。

---

## 1. 三套度量的精确定义(锁死,勿凭直觉改)

记号:WCA Square-1 解 = `(x0,y0)/(x1,y1)/.../(xk,yk)`,`(x,y)` = 上层转 x×30°、下层转 y×30°,`/` = 切片(翻右半)。`/` 只在「无角块跨切缝」时合法。

| 度量 | `/` 切片 | `(x,y)` 层转 | God's number |
|------|---------|-------------|--------------|
| **twist** (slash) | 1 | **0**(免费) | **13** 已证 |
| **WCA 12c4** | 1 | **1**(非恒等即 1) | **未知** |
| **face-turn** | 1 | 单层 `(x,0)`/`(0,y)`=1,双层 `(x,y)`=2 | **31** 已证 |

**铁律**:`/` 在任何度量恒计 1;差异**只**在层转。故对**同一条解** `twist ≤ WCA ≤ face`。
代码权威定义:`packages/client/lib/sq1-metrics.ts` 的 `sq1TokenCost`。

**易错点**:
- 「12c4」= **WCA 规则编号**(Regulations 12c4 原文:"(X, Y) counts as one move, "/" counts as one move"),**不是**二项式、不是算法名,指上表 WCA 行。双层 `(X,Y)`(X、Y 皆非 0)在 12c4 下计 **1**(关键)。
- **别拿 cubing.js / twizzle 交叉校验**:它默认显示 **ETM**(双层 `(X,Y)`=**2**,= face-turn 系),与 12c4 不同。校验只用本仓独立 oracle。
- WCA 另有 10f4+ 口径(收尾歪打分,X/Y 分开数,(5,5)=2),**与 12c4 不同**,别混。
- 43/44 是 **2-gen 受限子群**(12! 子集)直径(ben1996123),**不是**整体上帝之数,别引错。
- **没有 Rokicki/Kogler 的 SQ1 求解器**(那是 2014 Rubik's **Clock** 的工作,别张冠李戴)。

---

## 2. 已验证事实 + 态空间

来源:`jaapsch.net/puzzles/square1.htm`(Jaap Scherphuis)+ Chen(cs0x7f)2017 帖。代码里 `sq1_solver.rs` 模块头 + 测试 `sq1_face_turn_metric_matches_public` / `sq1_twist_metric_classes_match_public_and_known_optimal` 已逐层锁死浅层 BFS 计数。

- **slash-ready shape 数 = 3678**(每半层 13 种 {1,2}-拆 6,`(1+5x+6x²+x³)⁴` 的 x⁸ 系数)。
- **face-turn 可切态总数 = 11,958,666,854,400 = 3678 × 8! × 8! × 2**。face 深度 0..6 = 1, 15, 69, 212, 1141, 3933, 14029。God=31 仅 376 态(都「顶层 4 角」),depth 30 有 8,987,110。
- **twist 层转等价类总数 = 435,891,456,000 = 15!/3**(Godfrey 单环双射,通式 `8(C+E−1)!/(2C+E)`)。twist 深度 0..4 = 1, 64, 1153, 17050, 235144;峰在 11;**antipode(twist=13)有 157,452,752 个**;均 10.615。
- 另一口径:raw 态(不约层转等价)= **552,738,816,000 = 170 × 2 × 8! × 8!**(170 = 含中层的 shape 数)。
- 对称群:top↔bottom 层交换 + 上下层各自旋转 + 镜像。Chen 实测约简 **~3.85×**(11.96e12 → **3,101,840,179,200**)。**TODO 精确列出 WCA 度量下保距的对称数**(给约简枚举用)。

---

## 3. 关键洞察(本笔记的核心)

### 3.1 WCA 是 uniform-cost → BFS / IDA*

WCA cost = #(非恒等层转) + #(slash),**每个动作恰好 1 步**。把「能落脚的态」限制在 **slash-aligned**(= shape ∈ 3678 = 当前对位可合法切)态上,移动只有两种、都计 1:
- **slash**:`z → slash(z)`(z 本就 slash-legal)。
- **turn 到另一个合法对位**:`z → turn(z,a,b)`,`(a,b)≠0` 且结果仍 slash-legal(即 `a∈legal_rot[pt], b∈legal_rot[pb]`)。

> 为什么只需落脚在 slash-legal 对位:turn 只在 slash 前才有用;两个连续 turn 会合并成一个;故最优路径绝不在「不能切的对位」停留。于是 **WCA 距离 = 该图上的 BFS 深度**。

**最优解结构**:连续同类动作冗余(`slash∘slash=id`、`turn∘turn=合并`)⇒ **最优解严格 turn/slash 交替**。搜索里据此剪枝(禁同类相邻),不损最优。

### 3.2 可证区间 `13 ≤ D_WCA ≤ 27`(今天就能写进 UI)

- **下界 13**:任意态 `WCA_dist ≥ twist_dist`;twist=13 的态 ⇒ 其 `WCA_dist ≥ 13`。故 `D_WCA ≥ 13`。
- **上界 27**:取该态的 **twist 最优解**(≤13 个 slash)。写成 WCA token:`k` 个 slash 之间/首尾最多 `k+1` 个层转槽,每槽 ≤1 个非恒等 turn。
  `WCA_dist ≤ k + (k+1) = 2k+1 ≤ 2·13+1 = 27`。故**每个态 WCA ≤ 27 ⇒ `D_WCA ≤ 27`**。
  (推论:UI 现在报的 28/29/30 全是 near-opt 高估的产物,真实不存在。)

### 3.3 不用 700GB 也能算出精确 `D_WCA`(targeted enumeration)

由 `WCA_dist ≤ 2·twist_dist+1`:
- `WCA = 27` ⇒ 必须 `twist = 13`。
- `WCA = 26` ⇒ 必须 `twist = 13`(2t+1≥26 ⇒ t≥12.5)。
- `WCA = 25` ⇒ 必须 `twist ≥ 12`。
- `twist ≤ 11` 的态 ⇒ `WCA ≤ 23`。

所以:**只在 twist=13 的 157,452,752 个 antipode 上跑 WCA-optimal,取 max = M13**。
- 若 `M13 ≥ 26` ⇒ 其余态全 ≤25 < M13 ⇒ **`D_WCA = M13`,证毕**(几 CPU 小时)。
- 若 `M13 = 25` ⇒ 其余 ≤25 ⇒ `D_WCA = 25`,证毕。
- 仅当 `M13 ≤ 24` 才需再扫 twist=12 壳(几十亿态,大但仍远小于全 BFS)。

> 卡点:要枚举 twist=13 antipode,需先有 twist BFS 的 depth-13 壳。这本身是大计算(全态 4.36e11)。**路线**:(a) 流式 twist BFS 落盘 antipode 集;或 (b) 找 antipode 的结构刻画(face=31 的 376 态是「顶层 4 角」,twist=13 的 157M 是否也有刻画?**待查**)。

---

## 4. 求解器设计(`Sq1WcaSolver`,新增于 `sq1_solver.rs`)

- **复用** `Sq1State`(top/bottom u64 12 槽×4bit + ml)、`Sq1Solver` 的索引设施(`shape_id`/`legal_rot`/`comb_idx`/`c4_idx`/`e4_idx`/`c4b_idx`/`e4b_idx`/投影 map)。同模块 → 私有可达,**twist 求解器零改动**(低风险)。
- **剪枝表**:5 张投影表(comb / c4 / e4 / c4b / e4b),但用 **uniform BFS(§3.1 的 turn+slash 边,均 1 步)** 重建,值 = 该投影的 WCA 距离。投影是「移动+代价」同态 ⇒ 表值 ≤ 真 WCA dist ⇒ **可采纳**;`h = 5 表取 max`。
  - 与 twist 表的差异:twist 表做 free-rotation 闭包(层转免费,一个轨道所有对位同距);WCA 表**不**闭包(每个对位是独立节点,turn 边计 1 步)。
- **搜索**:IDA*,`g` 每步 +1,阈值 = WCA cost。turn/slash 交替剪枝。root 若非 slash-legal 先强制 turn(1 步)进合法对位。
- **正确性验证**:① 暴力 WCA-BFS oracle(浅层全枚举,raw 图)逐个相等;② `twist ≤ WCA ≤ 2·twist+1`;③ 解 replay 回精确 SOLVED;④ token 数 = WCA cost。

**性能风险**:单阶段 IDA* 在 gap(真 dist − h)大时(antipode dist 26-27、h~15-18 ⇒ gap~10)可能慢。缓解(按需,见 §6):加 phase-2(方形子群 WCA 精确尾)或更强表(shape×角全排列 8! ,~296MB)。

### 4.1 与现有工具的关系(prior art,诚实说明)

- **per-position WCA-optimal 并非首创**:Chen `cs0x7f/sq12phase`(TNoodle 内置)有 `solutionOpt` + `WCA_TURN_METRIC` 分支(把上下层合成一个 transition,双层 `(x,y)` 真计 1),**就是** WCA 单态最优。但它只用于**打乱长度记账**(认证 ≥11 步下界),**从不**用来生成打乱、**从不**跑全空间 → **不产出上帝之数**。本仓 `Sq1WcaSolver` 是**独立 Rust 实现 + 接入统计/求解管道**,价值在工程落地与全空间路线,不在「首个单态最优」。
- **现有精确全态求解器都不是 WCA 度量**:`qqwref/sq1opt`(Gottlieb fork of Jaap,IDA*,twist/turn 可选)、`Moreolo/Square-1-Solver-Rust`(3.3e9 态 pattern DB,depth-12,**slice 度量** = `(x,y)/` 块数)。
- cstimer/TNoodle/cubing.js 生成打乱都走 sq12phase 两阶段近最优族,**没有**标「全空间可证最优」的在线工具。

---

## 5. 进度 / 结果 + 尝试记录 (RESULTS / ATTEMPTS LOG)

> 成功与失败的尝试都记这里(用户要求),给后人省坑。2026-06-16。

### 尝试 A —— 单阶段 IDA*(❌ 不够快,深态爆搜)
- 做法:5 张全空间投影表(comb / c4 / e4 / c4b / e4b),用 uniform BFS(turn+slash 边各 1 步,§3.1)现场建,WCA 投影直径 **17-18**(全空间可达,无 255)。融合 `h_le_wca`(单次扫描算 5 码 + 任一表 > bound 早短路)。IDA* + turn/slash 交替剪枝 + 子按 h 升序。
- **正确性 ✅**:对独立暴力 WCA-BFS oracle(raw 图全枚举)**逐态相等**,depth ≤4 全 5568 态(`wca_matches_oracle`,proven optimal)。WCA 精确态深度分布 0..=4 = **[1, 64, 78, 2496, 2929]**。
- **❌ 性能**:深真打乱(wca ~22-25)单态实测 **14 分钟单线程仍不收敛**(848 CPU-s)。根因 = 深态 h gap ~7-10 + turn 层分支大(每态 ~B^(wca/2),B≈8 ⇒ 8^12 ≈ 7e10 节点)。**单阶段对 SQ1 这种 shape-shift 深度根本不可行**(twist 求解器同理,靠 phase-2 才 16 刀 ≤7s)。

### 尝试 B —— 加 phase-2 方形子群精确尾解(进行中,预期 ✅)
- 思路同 twist 求解器:phase-1 只需**浅搜到方形 shape**(shape 距 ~9-13),方形之后的排列尾巴交**方形子群精确表**;phase-1 有效深度砍半 ⇒ B^6 量级,秒级。
- 新增:`csq`/`esq`(方形子群角/棱 8 排列 × ml WCA 距离,80640 each)、`build_sq_wca`(复用 `derive_sq_actions` 的 sig/tau/rhoc/rhoe,但**旋转 cost 1** 非 twist 的 0-cost 闭包)、`sq_h_wca`、`p2_dfs_wca`/`p2_dist_le_wca`(IDA* + memo),`dfs` 在方形态先试 p2。
- **关键坑(WCA vs twist)**:phase-2 memo 键必须用**精确态** `(top,bottom,ml)`,**不能**用 `canon_key`。twist 旋转免费 ⇒ 一个轨道所有对位同距 ⇒ canon-key 合法;WCA 旋转计 1 步 ⇒ 不同对位距离不同 ⇒ canon-key 会串味出错。
- 状态:typecheck ✅,正在跑 oracle(回归正确性)+ 81 真打乱深态(验速度 + 拿经验 mean/max)。

### 尝试 B 的坑(❌→✅,2026-06-16):phase-2 在轨道上提前收尾
- 症状:phase-2 接上后,深态解 **token 数对(cost 正确)但 replay 不到精确 SOLVED**(停在一个**方形但非 solved** 的态,如 `top=0x110332554776` vs solved `0x011233455677`)。
- 根因:`sq_proj_arrays` 按**扫描序**读件 ⇒ **旋转不变**;`csq`/`esq` 量的是到 solved **轨道/陪集**的距离,`sq_h_wca==0` 对**一整类**非 solved 方形态(角/棱各自有序但角-棱对位错)都成立。p2 用 `h==0` 当目标 ⇒ 在轨道上(甚至离 solved 好几步的同陪集态)提前宣布成功。
- 修法:p2 目标改 **`is_exact_solved`**(精确态),`sq_h_wca` 只作可采纳剪枝下界(低估终局对齐,无害)。**这正是 twist 求解器 p2_dfs 在 rem==0 查 `is_goal`(canon)而非 `h==0` 的原因** —— 当时没照抄这一点,踩了。
- 教训:浅层 oracle(depth≤4)只验 **cost** 不验 **path**,且浅态恰好不触发该陪集冲突 ⇒ bug 潜伏到深态 replay 才暴露。**深态必须验 path replay**。

- 修复**已验证 ✅**:seed=63 现 replay 到精确 SOLVED;oracle 5568 态仍全过;深态秒级。cost 一直是对的(18),只是 path 之前停在同陪集的非 solved 态。

### 尝试 C —— 全 8 角 + 8 棱 PDB 强化 h(⚠️ 部分成功:中位提速,深态仍慢)
> 2026-06-16。背景:尝试 B 的 phase-2 接上后,中等态秒级,但**真实 12 步打乱(真最优 ~22-25)单态仍分钟级不收敛**。根因复测 = phase-1 启发式 `h`(5 张 **4-件** 投影表 max)在深态**饱和** —— 旧基线 2026 真打乱样本 `mean h=14.82, max h=18`,而真最优 ~22-25 ⇒ gap ~5-7 ⇒ IDA* 节点 `B^gap` 爆炸。
- **做法**:除 5 张 4-件投影外,新增 **全 8 角 PDB**(`shape × 8 角全排列 8!=40320 × ml` = 296,593,920 项 = **283MB**)+ **全 8 棱 PDB**(283MB)。`h = 7 表 max`。
  - 索引 `corn_idx`/`edge_idx`:按 tiling 扫描序读角/棱 `id>>1 ∈ 0..7`(恒为排列)→ `rank8` → `(sid*40320+rank)*2+ml`。
  - 构建:**直接复用 `build_proj_wca` BFS,seed=`SOLVED`**(corn_idx 只读角、角移动与棱 id 无关 ⇒ BFS 按 corn_idx 自动去重到 296M,无需投影映射 —— 比造投影 seed 更简单、不易错)。
  - 盘缓存 `tables/sq1_wca_{corn,edge}p.bin`(**gitignored**),`SQ1_BUILD_PDB=1` 门控构建,缺表回退 5 表(CI/wasm 零开销;wasm 恒空,fs/大表进不了浏览器)。h_le_wca 里大表最强、先查取最佳早剪。
- **并行 builder(必须)**:单线程建 296M ~**10min/张** + 内存 ~3.6GB(frontier 存全态)。改 **rayon + AtomicU8 CAS** 抢首达的并行 BFS `build_proj_wca_par`,~7×(小表也切过去,`build_proj_wca_auto` native 并行/wasm 串行,**init 从 ~3min→~15s**;小表此前**没缓存**每次重建是隐藏大头)。正确性 = `pdb_par_matches_serial` 锁死与单线程**逐字节相等**才敢用。
- **结果**(2026 真打乱样本):

  | 指标 | 旧 5 表 | 新 7 表 | Δ |
  |------|--------|--------|---|
  | mean h | 14.82 | **15.59** | +0.77 |
  | max h | 18 | **20** | +2 |
  | min h | 8 | **11** | +3 |

  中位解速 **分钟→秒**(最差低估改善最多,min +3);`(1,0)/`→**2** ✅(对独立双向 BFS oracle 一致)。
- **❌ 深态仍慢**:真最优 ~22-25 的态仍 **>5min**。根因 = **max(corn,edge) 的结构性天花板**:角/棱**共享全部移动**,任一投影单独都界不住联合距离;corner-subspace / edge-subspace 直径 ~20(= 新 max h)**< 真 D ~25** ⇒ 深态 gap ~5-7 基本不变 ⇒ 搜索仍爆。
- **教训**:**单个投影 PDB 的 h 上限 = 该子空间直径**,与真整体距离差一截。要再强需 **coupled 表**(角+部分棱联合),但全耦合 `3678·8!·8!·2`=1.2e10、角+4棱 `3678·8!·1680·2`≈5e11 都太大。**max-of-PDB 对「每步动全体」的强耦合 puzzle(SQ1/Clock 类)收益有限** —— 这类拆不出 additive disjoint PDB(没有「只影响某子集」的移动)。下一步候选见 §6.6。

### 待办
- [ ] 81 真打乱 mean/max(经验下界初值)+ 全 125k 扫。
- [ ] 全 125k 打乱语料 `SQ1_WCA_EXACT=1` 扫一遍 → **真实 WCA 分布**(对比现 near-opt 高估,后者报到 30,真值 ≤27)。
- [ ] `D_WCA` 经验下界(样本 max)写进 `/math/god?event=sq1`(把 `[13,31]` 收成 `[13,27]` + 经验下界)。

---

## 6. 路线图 / 待办

1. **求解器落地**(本次):正确性 + 吞吐基线。
2. **修 stats**:`sq1_analyzer` 加 `SQ1_WCA_EXACT=1`,把 `/scramble/stats` 的 WCA 列换成精确(或更紧的近最优);长尾态的可行性实测。`update-scramble-stats` 管道接入。
3. **UI/数学页**:`/math/god?event=sq1` 把 `D_WCA = ?` 改成 `13 ≤ D_WCA ≤ 27`(可证)+ 经验下界 + 精确分布图。
4. **精确 `D_WCA`** —— 两条路线(论坛启发猜 ~26-27,"probably 27",有人 argue 下界 ≥26):
   - **路线 A(targeted,本笔记主张,可能便宜得多)**:只在 twist-13 的 157M antipode 上跑 WCA-optimal 取 M13(§3.3)。瓶颈 = antipode 枚举(需 twist BFS 落盘 4.36e11,或找 twist=13 的结构刻画)。
   - **路线 B(full-space coset-BFS,Chen 同款,稳但贵)**:WCA 是 uniform-cost ⇒ 纯无权 BFS。按 3678 个 shape-coset 切(每 coset ~1.6e9 colorings,**单 coset 入内存**),盘吞吐瓶颈,多日级。工具:Rokicki `twsearch`(cubing.js 同引擎)。规模同 Chen 2017 face-turn(~772GB 盘,11.96e12 态),WCA 更简单(无权)。
5. **对称约简**:列出 WCA 保距对称(top↔bottom + 各层旋转 + 镜像,Chen 实测 ~3.85×),把枚举/表规模再砍一截。

### 6.6 深态提速候选(尝试 C 之后,按性价比排序)
大表把 h 抬到 max 20 仍 < 真 D ~25,深态 gap ~5-7。再压 gap 的候选:
1. **更深的 phase-2 入口 / 更早转 phase-2**(便宜,优先试):现 phase-2 只在「方形 shape」触发。若能把 phase-1 的有效深度再砍(更激进的 phase-2 子群,或 phase-1 只搜到「角已归层」就转表),gap 的指数底数 B 不变但指数减小。**先 profile 深态实际卡在 phase-1 哪层**再动。
2. **方形子群表升级为 (角×棱) 联合**:现 `csq`/`esq` 是角/棱**各自** 8! 取 max(80640 each)。方形子群联合 = `8!·8!·2`=3.25e9,~3.25GB,可盘缓存;phase-2 尾解变精确单表 ⇒ phase-2 一步到位、phase-1 更早收。**性价比最高的「再强一档」**。
3. **coupled phase-1 PDB(角 + 棱朝向/部分棱)**:全 `角×棱` 1.2e10 太大;**角 + 棱「归层 mask」**(`shape×8!角×C(8,4)棱mask×ml`≈ 3678·40320·70·2=2.1e10)仍大但可子集化。收益存疑(mask 太粗)。
4. **接受部分最优**:中位数已秒级 ⇒ 管道/UI 用精确解跑得动的多数 + 深尾回退 near-opt(标注),或限时(timeout→near-opt 上界)。**对「经验 D_WCA 下界」足够**(下界只需样本 max,慢的少数可单独长跑)。
5. **绕开单态求解**:`D_WCA` 精确值走 §3.3 targeted enumeration(只在 twist=13 antipode 上跑),不依赖「每个深态都快」。

> 直觉:SQ1 是「每步动全体」的强耦合 puzzle,additive disjoint PDB 不适用,max-of-PDB 收益封顶在子空间直径。真正的杠杆是 **phase-2(子群精确尾)做得更厚**,而非 phase-1 的 h 无限加强 —— 这与 twist 求解器靠 phase-2 而非更强 h 取胜一致(§7 首条)。

---

## 7. 坑 (PITFALLS)

- **单阶段 IDA* 对深态不可行**(尝试 A,§5):必须像 twist 求解器那样加 **phase-2**(方形子群精确尾解),否则深真打乱单态分钟级不收敛。phase-1 浅搜到方形即可,尾巴交精确表。
- **phase-2 memo 键用精确态非 canon_key**:WCA 旋转计 1 步,不同对位距离不同;canon_key(旋转不变)只在 twist(旋转免费)合法,WCA 用了会串味出错。
- **投影索引只对 slash-aligned 态有效**(shape ∈ 3678)。turn 到非法对位后 `shape_id` 无定义。搜索里 h 只查 slash-aligned 节点(root 特判);phase-2 的 `sq_h_wca` 只对方形态有效。
- **WCA 表禁用 free-rotation 闭包**(那是 twist 专属;层转免费才能闭包)。WCA 每对位独立。
- **奇偶**:`#slash ≡ ml (mod 2)`;但 WCA = slash + turn,turn 不动 ml ⇒ **WCA 无干净奇偶步进**,IDA* 步长 1(twist 是 2)。
- **near-opt 的 WCA 是上界非真值**:`sq1_twophase::solve_wca` = twist 近最优解的 token 数,既非 twist-opt 也非 WCA-opt,双重高估。别拿它当 ground-truth。
- **记号约定**:`lib/sq1-svg` 的 `applySq1Scramble` 与 solver 的 (a,b)/ sign 约定不一致,别拿它交叉校验解的还原性;用 solver 自身 round-trip。
- **纯旋转态**:`(1,0)` 这种在 WCA 下计 **1**(对齐一步),twist 计 0。真实打乱不会是纯旋转。
- **审计未提交代码踩 worktree 隔离**(尝试 C 期间):派 `isolation:worktree` 的审计 agent 验 `Sq1WcaSolver` 最优性,agent checkout 的是干净 **HEAD**,而 `Sq1WcaSolver`(761 行)当时**未提交** ⇒ agent 判「求解器不存在 / 非最优」(其实它审的是 HEAD 里 `sq1_twophase` 的 near-opt wrapper)。**教训:审/review 未提交工作,先 commit 再派 worktree agent,或用非隔离 agent**;`git diff --stat HEAD -- <file>` 一眼看出在不在 HEAD。
- **「最低 h」≠「最易解」**:想抽几个「快的」态量解速,挑了 h 最低的 5 个 → 反而可能是 **gap 最大(h 低估最狠)= 最慢**的态,测试在那里挂死。要测易态:挑 near-opt 值小的、或已知浅 BFS 壳内的。
- **大 PDB 单线程建太慢**:296M 项 BFS 单线程 ~10min/张 + frontier 存全态 ~3.6GB 内存。用并行(rayon + AtomicU8 CAS 抢首达,见 `build_proj_wca_par`),且**先用小表锁死「并行==单线程逐字节相等」**再跑大表。小表此前没缓存、每次 init 重建是隐藏成本(~3min),一并切并行后 ~15s。
- **PDB 是「一次性建、盘缓存」**:gitignored,本地/服务器各自建一次;CI/wasm 缺表回退 5 表(零额外开销)。别每次 `shared()` 现场重建。
- **cargo 并发锁**:快速连续 `cargo build`/`cargo test` + 杀进程,后续 cargo 会 **"Blocking waiting for file lock on build directory"** 空转(无 rustc、CPU=0)。诊断别用 `... | grep` 管道吞掉 cargo 的这条 stderr(会看着像 0 输出像卡死);跑慢测量用原始日志 + tail。
