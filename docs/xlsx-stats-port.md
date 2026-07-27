# 表格统计移植 追踪

两份自建表格搬上站,顺带把能便宜证明的都证掉。源文件在 `.tmp/xlsx/`(gitignored,不进仓库):

- `3x3.xlsx` — cross / xcross 分布 + 极难打乱语料
- `Cube Odds.xlsx` — 全项目「情况概率」速查表(<https://bit.ly/cubeodds>)

## 0 铁律

- **不重造轮**:每条数据先查站内有没有,有就并进现成页面/数据层,别新开重复入口。
- **来源分级**:每个数字必须标明是①站内代码现算 ②穷举 BFS 金标 ③表格搬运(未证)。不许把搬运伪装成证明。
- **能证就证**:凡是浏览器/CI 里几秒内能枚举出来的,写成 `toBe()` 锁死的测试,页面标「现场自证」。
- 大数一律十进制字符串 + BigInt,禁 `number`(见 `exact_dist.ts` 的教训)。

## 1 主线:六色底 XCross = 10 的 438 个状态 ✅

### 事实

| | |
|---|---|
| 全空间 | 43,252,003,274,489,856,000 |
| 六色底(CN)XCross = 10 的状态数 | **438**(ground truth) |
| 对称去重后 | **23** 类(轨道 6/12/24/48) |
| 概率 | 1 / 9.87489e16 |

来源:`3x3.xlsx` 的 `10f CN xcross uniq 23` 表(23 条代表 + `All [438]` 全表);`Cube Odds.xlsx`
的 `3x3!10 Move CN xcross = 9.87489e+16`,与 4.3252e19 / 438 一致。

CN XCross = 10 即「六个底色 × 四个槽位共 24 种口径全部要 10 步」,是 XCross 的上确界
(单色底 4 槽 XCross 的最大深度就是 10,`dist_xcross_1col` 金标 d=10 = 4,998,960)。

### 证明分层(页面上逐条标注,不许混)

1. **闭包证明 — CI 现场自证**。438 = 23 条代表在 48 元对称群(24 转体 × 镜像)下的轨道并集。
   `tests/cn_xcross_10.test.ts` 每次跑都重算 23×48 去重,断言逐个状态命中表格那 438 条(不多不少,
   不是只比个数),且 23 条两两不对称等价。
2. **性质证明 — 本机 solver 实证**。`std_analyzer`(`CUBE_RUN_FULL_STD=1`)跑完 438 条,
   438×6 = 2,628 个 xcross 值全部为 10;副产物:cross 值 `{8: 2604, 6: 24}` —— 有一条轨道的部分底色
   只要 6 步十字。结论归档 `tests/fixtures/cn_xcross_10_golden.json`。
3. **整方最优步数 — 本机 cubeopt 复核**。h48 15G 剪枝表对 23 条代表逐条复算,与表格 `optimal` 列
   **零不一致**(直方图 18×4 / 19×17 / 20×2);对 5 条名场面打乱同样复算,发现表格 `f*` 列在
   `Kliria the Kirlia` 那行其实是**打乱长度 22**,真实最优是 19 —— 已按复核值落库。
4. **穷尽性 — 做不到,如实标注**。「不存在第 439 个」需要在 4.3e19 全空间穷举。已知最紧可枚举上界是
   双色底 WY XCross d=10 的 20,230,604 个状态(`dist_xcross_2col` 金标),但那一档走对称折叠 + 聚合,
   不落地单个状态。→ 站上写「上游穷举搜索给出的 ground truth」,不写「已证明」。

### 落地

- [x] 从 xlsx 抽 23 + 438 → `scramble/hardest/_data/cn_xcross_10.ts` + `tests/fixtures/cn_xcross_10_golden.json`
- [x] 闭包 + 性质测试 `tests/cn_xcross_10.test.ts`(7 项)
- [x] 写进 `exact_dist.ts`:六色底 XCross 那格补 `top` 端点(d=10 = 438),覆盖矩阵改「只知道两端」
- [x] `scramble/hardest/page.tsx` —— 23 代表画廊 + 证明分层 + 5 条名场面打乱;`exact_dist.ts` 的
      `href: '/scramble/hardest'` 死链随之修好
- [x] `hard_scrambles.ts` + `tests/hard_scrambles.test.ts`:每条阶段解法现场验「确实解开了该阶段」
      且长度相符(证到 ≤ count;最优性仍是表格口径)

## 1.5 三阶 HTM 距离分布收敛成单一源(C1 / C2 / C14 / C15 / C16)

搬 A1(0..20 深度分布)前先清地基。站上原来有 **七份** 手抄表,d=16..19 互相打架;其中一份写到
`1_100_531_606_815_050_000` 这种 cube20.org 从没公布过的位数。全部收进
`lib/god-distance-333.ts`,锁在 `tests/god_distance_333.test.ts`。

### 这份源怎么分级

| 字段 | 档位 | 含义 |
|---|---|---|
| `GOD_DIST_333[d].count` | `exact` d ≤ 15 | Rokicki 等人穷举,逐位精确。**界面显示的就是这一列** |
| | `approx` d = 16..19 | cube20.org 只给两位有效数字。四项相加比真实尾部大 1.03%,那是四舍五入,不是抄错 |
| | `atLeast` d = 20 | 490,000,000 是「已经找到这么多」,是下界不是计数 |
| `GOD_TAIL_TOTAL` | 精确 | `\|G\| − Σ(d ≤ 15)` —— 对 d ≥ 16 唯一能说的硬话 |
| `GOD_DIST_333_NORMALIZED` | 派生 | 只把四个 `approx` 等比缩到尾部真值,Σ 由构造恰为 `\|G\|`。**只用来画条 / 算占比 / 算期望,不许显示** |

关键取舍:**显示走公布值,几何走归一化值**。归一化后的 d=18 是 19 位数,端到界面上就是拿伪精度
换掉伪精度(C16)。`GOD_KIND_MARK` 给三档统一记号(`` / `≈` / `≥`)。

### 顺带修掉的四条硬伤

- **C2** `Patterns.tsx`「全 4.3 × 10¹⁹ 里只有三个状态需要满 20 步」→ superflip 是**第一个**被证明的
  (Reid 1995),满 20 步的已找到约 4.9 亿个。`math/group/page.tsx` 的 superflip 特写同病同修。
- **C14** 六处写「17-19 步占 >99%」→ 真值 **97.25%**;99% 那句只有把 d=16 也算进去才成立
  (16-19 = **99.77%**)。两条改由 `godShare()` 出,正文插值 `GOD_SHARE_17_19_PCT` / `GOD_SHARE_16_19_PCT`。
- **C15** `OpenProblems.tsx` 把**分支因子 17.97** 当成平均最优步数 → 平均是 **17.70**(`GOD_MEAN_HTM`)。
  17.97 只在 CayleyGraph 讲分支因子时是对的。
- 「FMC 16 步纪录难在打乱稀有」→ 最优解 ≤16 的打乱有约 **2.7%**,难的是人在一小时里把它找出来。

### 守卫

`tests/god_distance_333.test.ts` 七项:精确档逐位、尾部真值、1.0103 超额、归一化 Σ = |G| 且只动
四档、E[d] = 17.70、两条占比、外加一条**字面量棘轮** —— 除单一源外任何 `.ts/.tsx` 不许再出现
d=16..19 那四个量级的字面量(正则只认具体写法,不误伤 SVG path)。

## 1.6 A4 四色底 Cross:不抄那个均值,把整条分布跑出来

表格只给了一个 `avg 5.019`。站内 `exactColorsOf()` 对 4 字符 key 直接 `return null`,
四色底在精确集是空的。与其把 5.019 抄进去,不如把分布算出来 —— 它本来就便宜。

### 怎么算的

`solver/src/bin/dist_cross_6col.rs` 原本就是「6 张单面 BFS 表 + AVX2 逐状态取 min」。
取 min 的面集合抽成 `--faces <UDLRFB 子集>` 参数即可,全空间(12!·2¹¹ = 980,995,276,800)
与编码一个字都不用改 —— 所以任意色数出来的分布都躺在同一个分母上,可以直接互相比。
单次 ~35s(RAYON_NUM_THREADS=14)。

### 参数化本身对不对,拿已有金标验

| `--faces` | 期望 | 结果 |
|---|---|---|
| `U` | 5,160,960 × `cross_1_col` 金标(190,080 子空间在全空间里的重数) | 九档逐位一致 |
| `UD` | 192 × `cross_2_col` 金标 | 九档逐位一致 |
| `UDLRFB` | `cross_6_col` 金标 | bit-exact,内置金标自检也过 |

这三条不是走过场:`_1col` / `_2col` 用的是完全不同的算法(子空间 BFS、495×495 mask 容斥),
它们和参数化后的全空间 min-reduction 对上,才说明新路径没写歪。

### 四色底

「四色底」= 去掉一对相对色。`LRFB` / `UDFB` / `UDLR` 三种取法各跑一遍,**九档逐位相同** ——
颜色对称性在这里是跑出来的,不是假设的。

```
20635791 309065792 3241839115 27981105637 175574881766
514537441534 256994694935 2335611639 591          Avg 5.0194
```

`5.0194` 对上表格的 `5.019`。另外两条现场自证:平均步数随可选底色数单调下降
(5.8121 > 5.3872 > 5.0194 > 4.8095),且累积分布逐档「六色 ≥ 四色」。

### 白送的第四重验证

四色底一进 `exact_dist.ts`,页面上的「叠加 WCA 真题对照」就自动接上了 ——
1,317,565 条真题的四色底经验分布与这条理论分布**最大逐档偏差 0.0137 个百分点**。
穷举、真题两条独立的路走到同一处。

覆盖矩阵顺手改了一处:四色底那一列多出四个空格,原来会渲染成和「不适用」一模一样的灰字。
「未实现」现在有自己的样式与图例条目 —— 说得通只是没跑,和「这个阶段根本没有这个槽位」
是两回事。

## 1.7 A5 伪十字:表格那条分布是错的

表格给 `1 12 110 896 5399 19070 21913 2442 5`(合 49,848)/ avg 5.385933。
搬之前先验 —— 没通过。

### 独立复算

`lib/cross-solver.ts` 的 `PERM` / `ORI` 是站内已在跑的棱层模型(它自己复算标准十字金标
`1 15 158 1394 9809 46381 97254 34966 102` 逐位一致),把目标集从「还原」放宽成
「还原 / D / D' / D2」再 BFS 一遍:

```
190,080 态 : 4 48 440 3576 21492 74660 81780 8064 16   avg 5.356587
```

按 4 个循环重标定折叠成自由轨道,是 `1 12 110 894 5373 18665 20445 2016 4`(合 47,520)——
与表格前三档一样、从第四档起开始分家。表格的合计 49,848 也不是任何一个轨道数。

### 谁对:拿 1,317,565 条 WCA 真题当裁判

| 口径 | avg | 与真题经验档的最大逐档偏差 |
|---|---|---|
| 本机 BFS | 5.356587 | **0.0757** 个百分点 |
| 表格 | 5.385933 | 0.98 个百分点 |

真题经验档(`pseudo_cross.W`)的 avg 是 5.358074。13 倍的偏差差距不是采样噪声,
表格那条不采用。

### 推到其余色数

单色底能在进程内 BFS,双 / 四 / 六色底的状态空间不行。做法与 §1.6 同源:
`dist_cross_6col` 加一个与 `--faces` **正交**的 `--pseudo`,只改每张单面 BFS 表的
**起点集**(1 个 solved → 4 个:solved + 该面自身三个转),其余(全空间、编码、
AVX2 取 min)一个字不动。四次 ~35s。

`--faces U --pseudo` 出来恰好 = 5,160,960 × 上面那条 JS BFS —— 这是新代码路径的
正确性证明,不是巧合能凑的。四档全部落地并与各自的真题子集对上:

| 底色 | avg | 最大逐档偏差 | 最深 |
|---|---|---|---|
| 单色 | 5.356587 | 0.0757 pp | 8 步 |
| 双色 | 4.930410 | 0.0768 pp | 8 步 |
| 四色 | 4.531320 | 0.0368 pp | 7 步 |
| 六色 | 4.307273 | 0.0480 pp | 7 步 |

### C13 自行消解

「A5 精确 avg 5.386 vs 站内经验 4.308」根本不是冲突:**5.36 是固定底色、4.31 是六色底**。
现在两个数出自同一张表,四档均值单调下降,页面上并排可见。

### 落地

`exact_dist.ts` 长出第二个变体(`pseudo_cross` 阶段 × 四个色档),覆盖矩阵多一行
「伪 Cross」,理论×真题叠加不再写死 `std`(伪十字的经验档挂在 `variants.pseudo` 下)。
回归锁 6 条:JS BFS 交叉验证、四档数值、末档不补 0、同分母下逐档严格优于标准十字、
色数越多均值越低。

## 2 站内覆盖勘察(移植前必读)

四个只读 agent 扫过 `/scramble` `/math` `/alg` 及其余路由,合并结论如下。
口径:`covered` = 站内已有等价或更强;`partial` = 数据层或视图缺一半;`absent` = 全新。

### A 组 分布 / 语料(`3x3.xlsx`)

| # | 表格条目 | 站内现状 | 动作 |
|---|---|---|---|
| A1 | 3×3 整解 0..20 深度分布 | covered(理论)/ partial(并排)。0..20 全表**硬编码 4 份**:`math/god`、`math/group`(2 处)、`why-cube`、`wca/prediction/lucky_data.ts`。经验档在 `/scramble/stats` 方法「整体」(12..19,n=1,317,565) | 并入 `/scramble/stats`,`DiscreteHistogram` 虚线叠理论柱。**前置 C1 收敛单一源** |
| A2 | 对称态 164,604,041,664 | covered。`scramble/symmetry/_sym_core.ts` 33 型全表 + `tests/symmetry_core.test.ts` 现场重算 | 并入 `/math/group`,import `_sym_core.ts`,禁重造 |
| A3 | Cross 190,080 / 5,109,350,400 / 980,995,276,800 | covered。`exact_dist.ts` 三档逐位落地 + `toBe` 锁死 | 不搬;`/code/algorithms/cfop-std-solver` 加一条链过去 |
| A4 | Cross 四色底 avg 5.019 | **done**(见 §1.6)。没抄那个 avg —— 本机把整条分布穷举出来了,均值 5.0194 | — |
| A5 | 伪十字精确 49,848 / avg 5.386 | **done**(见 §1.7)。表格那条**验错了** —— 本机穷举 + 132 万条真题双向否掉,四个底色档全部重算落地 | — |
| A6 | EOCross 212,889,530 / fixed 24,330,240 | partial。有 analyzer 无精确档 | 只补数字。**先核 C5** |
| A7 | XCross 各口径 | partial,但站内比表格强(dual 是精确不是采样) | 只补六色底那一格 |
| A8 | 白底 XXCross 采样 1,097,307 | covered(站内 n 更大,且有 adj/diag 各 21,459,271,680 精确全表) | 不搬;标注样本来源差异(C11) |
| A9 | Roux FB/SB/223 + 1LLL 3,916 | partial。1LLL 数据层 100% 就绪(PG `alg_cases.meta.optimal`)但**无聚合视图**;Roux SB 1,088,640 真缺 | 1LLL 新建加权步数分布视图;Roux 只补数字 |
| A10 | 5c / 5e 部分还原 1152 / 3272 | absent | 只补数字 |
| A11 | 5 条名场面打乱 | **done**(见 §1) | — |
| A12 | 20f 语料 32,625 / 1000 / 1,130,184 | absent,但范式已跑通(`distribution.json` 的 `xcross_2_col_10f` set) | 照抄范式生成新 set,不新建页面 |
| A13 | no bar / disconnected / no headlight 计数 | absent(只有 2×2 侧的) | 新建 `stats/scramble/threex_recognition.json`,套 essential-2x2 契约 |
| A14 | EO 三轴坏棱联合表(分母 70,963,200 = 2¹¹ × 12!/(4!4!4!)) | absent | 套 `2x2_essential.json` 的 joint grid,`Essential2x2View` 现成 |
| A15 | 10f eocross 语料 140 条 | absent | 同 A12 范式 |
| A16 | 438 / 23 | **done**(见 §1) | — |

### B 组 概率(`Cube Odds.xlsx`)

| # | 表格条目 | 站内现状 | 动作 |
|---|---|---|---|
| B1 | LL 跳步速查(OLL 1/216、PLL 1/72、LL 1/15552、COLL 1/162、EO 1/8、LSLL、F2L) | partial。单 case 概率成熟且**现算**(`lib/alg_probability.ts`);跳步概率已散落三处(`method_dna.ts` / `glossary.json` / 长文) | 新建速查表挂 `/math/probability`,并**收敛**那三处(C12) |
| B2 | CFOP 各阶段逐步概率 / skip | partial。`ExactDistTable` 已有占比列;缺的正是覆盖矩阵的黄格 | 只补数字(依赖 solver 补 `dist_*`) |
| B3 | CN 2×2×2 block 各步概率 | partial。有经验档无精确档;NISS 全站无实现 | 只补数字;NISS 单独立项 |
| B4 | FMC 0..20 各步概率 | covered(三种呈现,含 500k 真采样) | 不搬;与 A1 一起做理论×经验并排 |
| B5 | 三阶 no bar / disconnected / no headlight 概率 | absent | 与 A13 同批 |
| B6 | 2×2 各 skip / CLL / EG | partial。`lib/essential-2x2.ts` 全 3,674,160 态精确 | 只补数字;CLL/EG 需先给 case 补 `meta.sym.cn` |
| B7 | 4×4 中心跳 1/1771、双中心 1/8,580,495 | absent | 新建 `*_444.json` + 接 `PUZZLE_EVENT_MAP` |
| B8 | Megaminx 各 skip | absent | 新建;注意别与 `lucky_data.D_MINX` 的 approx 曲线混 |
| B9 | Pyraminx bar 口径 | partial。CN 各步 covered(`essential-pyram.ts` 933,120 全枚举) | 只补 strong/weak bar 两个 stat 组 |
| B10 | Skewb U perm 1/131,220 / no bar / 0c..5c | partial。整解深度已精确(3,149,280) | 新建 `skewb_essential.json`,复用现成视图 |
| B11 | SQ1 各 skip + 11 face turns | partial。CS 已覆盖;站内并存 5 套口径 | **先写口径映射表**(C10) |
| B12 | Roux LSE/F2B/CMLL/EO skip | partial(有步数分布,无 skip 概率) | 与 B1 同一张速查表 |
| B13 | 一轮五把里 ≥n 把跳步(二项) | absent | `/math/probability` 新增二项小节,复用 `pHitLeqK` 的数值稳定写法 |

### 冲突 / 待核(动手前先解决)

| # | 冲突 | 处置 |
|---|---|---|
| C1 | 四份 0..20 表 d=16..19 **互相打架**,`math/god` 那份 Σ ≠ \|G\| | **已修**(§1.5)。棘轮又揪出三份没登记的:`math/god/.../events/Fmc.tsx`、`CayleyGraph.tsx`、`GrowthOfGroups.tsx` |
| C2 | `math/group/.../Patterns.tsx` 写「只有**三个**状态需要满 20 步」,与同书 §23 的 d=20 = 490,000,000 矛盾 | **已修**;`math/group/page.tsx` 的 superflip 特写「离还原最远的 3 个态之一」同病同修 |
| C3 | `exact_dist.ts` href `/scramble/hardest` 死链 | **已修**(§1) |
| C4 | A4 的分母与 A3 六色档同为 980,995,276,800 | **已核**:不是冲突(= 12!·2¹¹,共用同一棱商空间)。四档均值 5.8121 > 5.3872 > 5.0194 > 4.8095 单调,且累积分布逐档「六色 ≥ 四色」,都由 `toBe` 锁死 |
| C5 | A6 的 212,889,530 疑笔误:190,080 × 1120 = 212,889,**600** | 落表前 solver 复算,或确认它是 sym-unique 计数。别直接抄 |
| C8 | `/code/solvers` 的 222 块 = 253,440 态(固定角口径),表格是 CN 口径 | 差 ×8/×24,写表时显式标注口径 |
| C10 | SQ1 五套口径并存(WCA 12c4 / slash / twist / face / cubeshape) | 先写口径映射表,否则 `metric` 切换器静默串档 |
| C11 | A8 样本来源不同:站内 WCA 真题 1,317,565 vs 表格随机态 1,097,307 | 逐档必有系统差,别当回归失败;可同图叠加 |
| C12 | OLL 1/216 等三条已存在于 `method_dna.ts` / `glossary.json` | 速查表必须收敛,别做成第五份硬编码 |
| C13 | A5 pseudo 精确 avg 5.386 vs 站内经验 4.308 | **已消解**(§1.7):5.36 是固定底色、4.31 是六色底,不是同一个数。两者现已同源同表 |
| C14 | 六处写「17-19 步占 **>99%**」 | **已修**:真值 97.25%;99% 那句只有把 d=16 算进去才成立(16-19 = 99.77%)。两条都由 `godShare()` 出,`toBe` 锁死 |
| C15 | `OpenProblems.tsx` 把**分支因子 17.97** 当成平均最优步数 | **已修**:平均是 17.70,改从 `GOD_MEAN_HTM` 取 |
| C16 | 归一化后的 d=16..19 是 19 位数,直接显示等于制造**新的伪精度** | **已修**:界面一律显示 cube20.org 公布的两位有效数字(`GOD_DIST_333[d].count`),归一化值只画条/算占比/算期望 |

### 可复用清单(节选,别重造)

- 精确分布数据层 `scramble/stats/_data/exact_dist.ts`(字符串 + BigInt);上游真源 `solver/src/bin/dist_*.rs` 的 `GOLDEN` 注释
- 新语料集范式 `stats/scramble/distribution.json` 的 `xcross_2_col_10f` set + `downloads/<set>/<variant>/<stage>/<subset>_<bin>.txt`
- 全枚举契约 `lib/essential-2x2.ts` / `essential-pyram.ts`(边缘 + joint grid + 多组 stat),视图 `Essential2x2View` / `PyraminxEssentialView`
- 直方图单一源 `DiscreteHistogram`(超 Number ratios / outline 虚线叠加 / 对数 y 轴);逐档表 `ExactDistTable`;覆盖矩阵 `ExactCoverageMatrix`
- 概率:`lib/alg_probability.ts`(`ALG_SET_UNIVERSE` / `caseOrbit` = 16/cn / `probabilityFraction`)、`math/probability/_components/ll_math.ts`
- 对称群引擎 `scramble/symmetry/_sym_core.ts`(48 元 + 33 型);现场复核 `lib/cross-solver.ts`、`components/StageSolver`
- 千分位 `lib/group-digits.ts`(全站单一实现,收字符串)

## 3 落地顺序(依赖最短)

1. ~~C3 死链 → `scramble/hardest/page.tsx` + 测试~~ ✅
2. ~~C1 单一源 → 收敛 0..20 表~~ ✅ → 可以做 A1/B4 的理论×经验并排了
3. 纯数据层补丁(无新页面):~~A4 四色档~~ ✅ → ~~A5 pscross~~ ✅ → A10 → B3 → B2 黄格
4. B1 速查表(收敛 `method_dna` + glossary 三条)→ 顺带 B12
5. 新 essential JSON:B10 skewb → A14 EO 联合 → A13/B5 三阶识别口径
6. 新语料集(照 `xcross_2_col_10f`):A12 → A15
7. 待核后再动:A6(C5)、B11(C10)、B7/B8(全新分母)

## 4 进度

- [x] 清点两份表格
- [x] 站内覆盖勘察(§2)
- [x] §1 438 主线 + `/scramble/hardest`
- [x] §1.5 C1/C2 单一源 `lib/god-distance-333.ts`(顺带 C14/C15/C16)
- [x] §1.6 A4 四色底 Cross 精确分布(solver `--faces` 参数化 + 三取法互证 + 真题叠加)
- [x] §1.7 A5 伪十字四色档(否掉表格数据 + solver `--pseudo` + 四档真题叠加,顺带消解 C13)
- [ ] §3 第 3 步剩下的 A10 / B3 / B2
