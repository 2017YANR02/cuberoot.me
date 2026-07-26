# 魔表模拟器 / 魔表求解器 / 四视图铺开(金字塔·斜转·SQ1·魔表)

跟踪文档。目标:把 `/scramble/solver` 的「立体 / 平面 / 打乱 / 复盘」四视图从三阶+二阶铺到
**金字塔 · 斜转 · SQ1 · 魔表**;魔表额外要从零造 `/sim` 模拟器 + 求解器。

状态图例:`[ ]` 未开始 `[~]` 进行中 `[x]` 完成 `[!]` 阻塞/待决

---

## 0. 现状盘点(已核实)

| 项目 | event | 求解器 | 立体 | 平面 | 打乱 | 复盘 | /sim 3D |
|------|-------|--------|------|------|------|------|---------|
| 三阶 | `333` | cubeopt/云端 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 二阶 | `222` | 纯 TS 精确表 | ✅ | ✅ | ✅ | ❌ | ✅ |
| 金字塔 | `pyram` | Rust WASM(只吃打乱串) | ❌ | ❌ | ✅ | ❌ | ✅(engineMode) |
| 斜转 | `skewb` | Rust WASM(只吃打乱串) | ❌ | ❌ | ✅ | ❌ | ✅(engineMode) |
| SQ1 | `sq1` | 纯 TS 两阶段近最优 | ❌ | ❌ | ✅ | ❌ | ✅(自有引擎) |
| 魔表 | `clock` | **无** | ❌ | ❌ | ❌ | ❌ | **无** |

关键文件:
- 视图切换器范本:`app/[lang]/scramble/solver/_Cube3Solver.tsx:905`(四项 ListSelect)、`_Cube2Solver.tsx:126`(三项)
- 立体画板:`solver/_Interactive3DCube.tsx`(复用 `/sim` 引擎 + `controller.paintMode`)
- 平面画板:`solver/_InteractiveCubeNet.tsx`
- 涂色契约:`solver/_paint-shared.ts` 的 `PaintSpec`(n / siblings / validate / randomLegal)
- 事件分发:`solver/page.tsx` 的 `SolverDispatch`;导航 `scramble/_components/SolveTabs.tsx`
- 二阶「状态→解 / 状态→打乱」范本:`lib/pocket-facelet.ts`(3,674,160 态纯 TS 精确表)

---

## 1. 关键发现

### 1.1 twizzle 的魔表没有 3D,抄不到

`D:\cube\cubing.js` 里 clock 只有:
- `puzzles/implementations/clock/index.ts` → KPuzzle JSON + **平面 SVG**
- `twisty/model/props/viewer/VisualizationStrategyProp.ts` 把 `clock` 硬编码成 `"2D"`(与 square1 /
  redi_cube 同列),**没有任何 3D 模型**
- `search/inside/solve/puzzles/clock.ts` 只是随机打乱生成器(规范 14 步),**不是求解器**

而站内 `app/[lang]/scramble/gen/_svg/clock_svg.ts` 已经是 tnoodle `ClockPuzzle.java` 的完整移植
(18 位状态 + 9 种转法的 move 表 + 忠实 SVG),比 cubing.js 那份更贴 WCA。

> **结论:2D 那层站内已有且更好,3D 魔表必须自造。**

### 1.2 魔表数学(定 solver 口径)

- 18 个表盘,**14 个独立**:每个角位的正/反面表盘同轴联动,恒有 `back_corner = −front_corner`
  (4 条约束)。状态群 ≅ (Z12)^14,|G| = 12^14 = 1,283,918,464,548,864。**阿贝尔群,招式全可交换**。
- 招式 = (针脚子集 P ⊆ {UL,UR,DL,DR},非空 → 15 种) × (正面/反面) = **30 种 move type**,每种
  幅度 1..11。交换 ⇒ 最优解里每种 type 至多用一次。
- WCA 打乱的规范形式正好是 14 步(正面 `UR DR DL UL U R D L ALL` + `y2` + 反面 `U R D L ALL`)
  —— 那是唯一分解,不是最优解。
- **God's number = 12**(Kogler 2014);平均最优 9.4337 步(Rokicki);仅 39,248 个状态需要 12 步;
  OptClock(Michael Gottlieb + Ben Whitmore)是已知的最优求解器。
- 拟用算法(纯 TS,零下载表):把状态拆成「正面 5 个自有盘(中心+4 棱)/ 反面 5 个自有盘 / 4 个
  角盘」——**正面招式不动反面自有盘,反面招式不动正面自有盘**,两侧只通过 4 个角盘耦合。
  于是按角向量 v ∈ Z12^4(20,736 个)做中间相遇:两侧各按步数迭代加深枚举(每侧 15 个 type
  的子集 + mod-12 线性解),取 `min_v (F[v] + B[v])`。两侧招式集不相交 ⇒ 下界可加,收敛很快。
  正确性用独立暴力/规范 14 步 + 全空间抽样直方图(应复现 均值 9.43 / max 12)锁死。

### 1.3 金字塔 / 斜转已有贴纸级状态模型

`gen/_svg/pyraminx_svg.ts`(4 面 × 9 贴纸,tnoodle 移植)、`gen/_svg/skewb_svg.ts`(6 面 × 5 贴纸,
tnoodle 移植)都带完整 move 语义 + 展开图。→ 平面画板可直接在这两份几何上开洞(给 polygon 挂
`data-idx`),**不用重画**。

状态求解走二阶同款纯 TS 全空间 BFS(金字塔核心 933,120 态 + 4 尖独立;斜转 3,149,280 态,量级
与已落地的二阶 3,674,160 相当)—— 不碰 Rust/WASM。

---

## 2. 决策(2026-07-25 已定)

- [x] **D1 魔表 3D → 不做**。魔表只用 2D。因此:
  - 求解页魔表的视图 = **平面 / 打乱 / 复盘 三项**(无「立体」)。
  - `/sim` 的魔表用**自写的交互式 2D 魔表组件**(不是 Three.js,也不是 cubing.js 的只读 2D)——
    同一个组件同时当求解页的「平面」视图。cubing.js 的 TwistyPlayer 2D 魔表只能播放、不能拖指针,
    要真「模拟器」这段交互无论如何得自己写,所以写一份、用两处。
- [x] **D2 立体视图语义 → 涂色 + 可拧双模式**(金字塔 / 斜转 / SQ1 的「立体」画板给一个模式开关)。
  接线参照 `/sim` 播放条已有的求解一条龙:🔀 随机打乱、`最优` 开关、🔍「从下方解法反推打乱」
  (`PlayerControls.tsx` 的 `deriveScrambleFromSolution` + `cloudOptimalScramble`)—— 复用,别重写。
- [x] **D3 优先级 → 魔表整链优先**,再金字塔 + 斜转,最后 SQ1。
- [x] **D4 魔表分布 → 用 Jaap 的 God 表,但要自己写代码证明**。见 §3 P1 的实际结论与边界。

已自决(不单独问):
- 复盘视图 = textarea 输入解法 + 取逆同步到状态(与三阶完全一致),四个项目统一加。
- 魔表求解器给**最优解**;规范 14 步形式一并给出(反推打乱直接用它,与 tnoodle 打乱逐 token 同形)。
- 金字塔/斜转的「状态 → 解」走纯 TS 全空间表,不走「反推打乱再喂 Rust WASM」(两者本质同一件事,
  纯 TS 少一个 worker 往返)。

---

## 3. 阶段拆解

### P1 魔表求解器(纯 TS)— **完成** ✅

产出:
- `lib/clock-solver.ts` — 14 维状态模型 + 30 种 move type + WCA/扩展记号 parse/toString +
  **可证最优**求解器 + WCA 规范 14 步分解 + 反推打乱 + 随机态。零下载表、零 worker。
- `tests/clock_solver.test.ts` — 16 条,全绿(走 `pnpm -F @cuberoot/client test:solvers clock`,
  按仓库惯例 `*_solver.test.ts` 不进 CI 常规集)。
- `scripts/clock/verify_distribution.mts` — 分布核验脚本(可复跑)。

算法(精确最优,非启发式):正面招式不碰反面自有盘、反面招式不碰正面自有盘,两侧只通过 4 个角盘
耦合 → 各建一张 `Z12^4 → 最小步数` 表(20,736 项),取 `min_α (F[α] + B[α−角目标])`;两侧按步数
迭代加深,收敛判据 = 「漏掉的解某一侧 > cap ⇒ 总步数 ≥ cap+1+另一侧最小步数」。
单侧枚举不需要通用 mod-12 线性求解:5 条自有盘方程把 8 个单角/邻边用量压成 4 个自由参数,
只剩「7 种全覆盖 type 分配总和 T」要枚举。**实测 17.4 ms/次**。

已验证(实测输出,非推断):
| 证据 | 结果 |
|------|------|
| Jaap 表逐档求和 == 12^14 | ✅(顺带抓出我从截图误读的两位数字:d=4 与 d=11,和差 7) |
| 单步招式 vs tnoodle 18 位 move 表逐格 | ✅ 9 种记号 × 12 幅度全等 |
| 含 y2 多步算法 vs tnoodle | ✅ 300 条随机 |
| d ≤ 3 精确枚举(本仓库招式模型独立算) | ✅ 1 / 330 / 51,651 / **4,947,912** 逐档 `===` Jaap |
| 深度 ≤2 全枚举精确表 vs 求解器 | ✅ 400 个随机抽查逐个命中真实最短 |
| 20,000 随机态抽样 | 均值 **9.4332**(理论 9.4337)、上限 11、**χ²=3.22 / 5 自由度** |
| 解施加回状态 = 还原 / 不长于规范 14 步 / 同 type 不重复 | ✅ |

**边界(必须如实说)**:全表 1.28e15 个状态**无法在本机重算** —— 那是 Kogler / Rokicki 量级的
全空间 BFS。所以 d ≤ 3 是**精确证明**,d ≥ 4 是**统计证据**(χ² 拟合优度 p≈0.67)。
脚本带 `--depth 4` 可把 317,141,342 那一档也变成精确证明(4.01 亿元组、约 3.3 GB、数分钟),
默认不跑。

**追加(2026-07-25,用户要求收藏全空间算法):** 上游那几份代码已找到并原样收藏进
`solver/reference/clock/`(只读、不编译、无任何 workspace import,目录 README 逐份讲清算法):

| 文件 | 作者 | 是什么 |
|------|------|--------|
| `clockcoset11.cpp` | Tomas Rokicki | **唯一真正算穿 12^14 的代码**。陪集分解(固定正面十字的 12^9 子群 → 12^5 个陪集,靠镜像/旋转/乘互质数压到 9,906 个代表元)+ SWAR 内核 `do12()`(一个 64 位字 12 条 5 bit 车道同时取 min)。单陪集 <3 分钟/核,总计约 3 天。发布版 `N = 10`(作者把程序写成 hours 2..12 通用做交叉验证),跑真魔表要改 `N = 12`(内存 12^8 字 = 3.2 GiB) |
| `dist12.txt` | Tomas Rokicki | 全部 **39,248** 个距离 12 的位置 |
| `optclock.cpp` / `optclock_stats.cpp` / `optclock_readme.txt` | Michael Gottlieb + Ben Whitmore | OptClock:两阶段(phase 2 全表 12^6 落盘 3 MB + 枚举 12^8 个 phase 1 解) |
| `ClockSolver.java` | Shuang Chen (cs0x7f) | 独立 Java 最优求解器,**GPLv3**(许可证原样保留;不链接不编译,无传染) |

Kogler 本人那份最早的证明程序**没有公开源码**,只有方法描述(单侧表 + 迭代加深到深度 6 + 逆状态
对称),已写进目录 README。

`dist12.txt` 顺手把**最难的一档变成可精确对账的测试集** —— 这是分布表里唯一一个我们能逐条验完的
高档位。映射(OptClock 14 列 → 本仓库 `posit`)与测试都在 `tests/clock_solver.test.ts`。

顺带量出一个求解器的性能事实:**d=12 是最坏情形,70.9 ms/个,是随机态均值(12.5 ms)的 5.7 倍**
—— 两侧的迭代加深都得把 cap 抬到顶才收敛。全量 39,248 条约 46 分钟。
教训:同步 for 循环打断不了 vitest 的超时计时器,单个 `it` 超时只会在**跑完之后**才判失败
(2026-07-25 实测:跑满 40 分钟只换回一条 timeout,一条位置都没验证到账)。已拆成 8 段各自一个
`it`(每段约 6 分钟)。

待办:
- [!] `/code/solvers` 看板登记 —— **卡在分类上,要用户拍板**。`_fleet.ts` 的 `NONWCA_TS` 被 CI
      守卫 `code-solvers-fleet-sync` 锁死「event 集 == `CSTIMER_SOLVABLE_IDS`」,魔表是 **WCA 项目**、
      不在那个集合里,硬塞进去 CI 直接红。而现有四档 tier 也没有一档描述得准:魔表不是全 BFS(A)、
      不是离线表(B)、不是 IDA*(C)、更不是近最优(D),它是「代数拆分 + 两侧迭代加深」的可证最优。
      两条路选一条:①加一个 `WCA_TS` 分区(纯 TS 的 WCA 项目求解器,目前只有魔表);
      ②把 tier taxonomy 加一档。**没敢猜**(该文件头注明写着 do NOT guess)。
- [x] `credits_data.json`:补 tnoodle(move 表语义锚)、Jaap(分布表)、Kogler/Rokicki/OptClock/cs0x7f
      (先行工作 + 收藏,**未取用其代码**)三条
- [ ] 可选:跑一次 `--depth 4` 把第 5 档(317,141,342)也钉成精确证明

### P2 魔表求解页(平面 / 打乱 / 复盘)— **完成** ✅

- [x] `components/InteractiveClock.tsx` + `interactive_clock.css` —— **共用件**,求解页的「平面」
      视图与 `/sim`(P3)用同一份。两种模式:
      - **编辑**:拖指针设表盘。角盘正反自动联动(front + back ≡ 0)→ **画不出非法态**,压根没有
        「状态非法」这条路径要处理。
      - **拧**:点针脚切上下,在任一半区里拖 = 一次 WCA 招式(针脚组合 × 幅度),实时跟手、松手
        回调 `onMove`。两个半区同屏 ⇒ 不翻面也能拧背面;`y2` 按钮仍做真翻面(交换两块 + 针脚反转)。
- [x] `solver/_ClockSolver.tsx` —— 三视图 + 最优解 + WCA 规范 ≤14 步分解 + 还原 / 随机 / 求打乱。
- [x] `page.tsx` dispatch + `SolveTabs` 的 `SolvePuzzle`/`EVENT_ID`/`PUZZLE_BY_EVENT` 加 `clock`。
- [x] `clock_svg.ts` 的几何常量改为 **export**(不再各算一份),角位 ↔ 表盘的镜像关系统一从
      `lib/clock-solver` 的四张表取 → 画板与打乱图逐像素同格。
- [x] `/code` 组件目录登记 `InteractiveClock`。

浏览器实证(非推断):

| 检查 | 结果 |
|------|------|
| 拧模式拖 90° | 落 `UR+DL+DR3-`,**手算复核** WCA 规范解 `DR3+ R3- D3-` 确实把 18 个盘全归零 |
| 编辑模式点表盘 0 的 3 点钟方向 | `posit[0]=3` 且 `posit[11]=9` 自动联动;最优 2 步(手算确认 1 步不可能) |
| 复盘输入 6 步算法 | 反解回原算法本身(6 种 type 各用一次 ⇒ 必最优) |
| 求打乱 → `ScramblePreview2D` | 官方打乱图与画板同形(左淡右深、指针逐个对上) |
| 375px 窄屏 | 无横向溢出(`scrollWidth` 360 < 375),表盘热区 44.8px |
| 控制台 | 0 error 0 warning |

一个刻意的设计:WCA 打乱串中间带一个 `y2`,所以粘一条打乱进来,画板会按**打乱完手里那个姿势**
显示(两块对调 + 配色换面)—— 与官方打乱图一致。但「求打乱」写回的那条**不回流**(记了自己写
的那条跳过),否则画板会凭空翻个个儿。

### P3 魔表进 /sim(2D 交互式)
- [ ] SimPage 加第三条渲染路径(现有:自有 Three.js world / cubing.js TwistyPlayer)承载 2D 魔表
- [ ] 必改注册表:`PlayerControls.tsx`(`PUZZLE_TYPE_OPTIONS` / `SimPuzzle`)、`simCaps.ts`
      (魔表非转层 → carve / isolate / stickering / hands / logo / 面色 全 false)、
      `SimPage.tsx`、`lib/sim-recon-link.ts`、`EventIcon` 图标
- [ ] 接上播放条已有的打乱 / 播放 / 反推打乱一条龙

### P4 魔表分布区
- [ ] `/scramble/stats?event=clock` 用 Jaap 的 God 表(全空间**精确**分布,不是采样)——
      魔表 WCA 打乱本就是均匀随机态,所以理论分布 = 打乱难度分布
- [ ] 页面上标清「d ≤ 3 精确复现 / d ≥ 4 抽样吻合」的证据等级,别写成"已全部证明"

### P5 金字塔四视图
- [ ] `lib/pyraminx-facelet.ts`:贴纸 ↔ 块模型 + 合法性校验 + 全空间 BFS 最优解 + 反推打乱
- [ ] 平面画板(复用 `pyraminx_svg.ts` 几何)
- [ ] 立体画板(复用 `/sim` pyra 引擎)
- [ ] `_PyraSolver.tsx` 四视图 + 接 dispatch

### P6 斜转四视图
- [ ] `lib/skewb-facelet.ts`(同上,3,149,280 态)
- [ ] 平面 / 立体 / 四视图接线

### P7 SQ1 四视图
- [ ] 语义按 D2 定;状态模型复用 `lib/sq1-svg.ts` / `sq1-metrics.ts`

### P8 收尾
- [ ] typecheck + 全量测试
- [ ] `/code/solvers` 看板、`/code` catalog 登记
- [ ] 回写 skill `sim-add-puzzle`(魔表 = 首个非转层魔方)+ memory

---

## 4. 风险 / 坑

- 魔表在 `/sim` 是**首个非「转层/转角/转棱」魔方**:`simCaps` 的能力模型(carve / isolate /
  stickering / 手指 / 面色 / logo)几乎全不适用,别硬套 `CORNER_SPECS`,需要自己的 drag adapter
  (照 SQ1 / Ivy 那条「异类手写 pointer 事件」路子)。
- 魔表没有「贴纸颜色」概念 → `PaintSpec` 那套(siblings / maxPerColor / 调色板)完全不适用,
  立体/平面画板要另立一套「盘值编辑」契约,别硬塞进 `_paint-shared.ts`。
- COEP 边界:只有 `event=333` 是 COOP/COEP 文档,新增 event 之间软导航即可,别误入硬导航分支。
- 分布区嵌在求解页下方(`LazyVisible` + `ScrambleStatsPage embedded`),新 event 若无分布数据要
  确认不报错。
- `SolveTabs` 的 `PUZZLE_BY_EVENT` 一旦加 `clock`,魔表就从「跳分布页」变成「跳求解页」,
  `/scramble/stats` 侧的入口要同步核对。

---

## 5. 参考

- God's number for Clock = 12:https://speedsolving.com/forum/threads/gods-number-for-clock-found.47822
- OptClock 最优求解器:https://www.speedsolving.com/threads/optclock-optimal-rubiks-clock-solver.47747/
- Jaap's Puzzle Page(魔表群结构 / 30 种招式 / 均值 9.4337):https://www.jaapsch.net/puzzles/clock.htm
- Rokicki 的全空间陪集计算(附源码 + dist12.txt):http://cube20.org/clock/
- twizzle 魔表(2D):https://alpha.twizzle.net/edit/?puzzle=clock
- **本仓库的算法收藏**:`solver/reference/clock/README.md`
