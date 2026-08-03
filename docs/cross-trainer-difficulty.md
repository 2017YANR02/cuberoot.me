# 随机状态来源的「难度」(cross-trainer) — 跟踪

> issue #67。/timer 随机状态来源按「某个阶段的最优步数」直接**生成**打乱,不是从真题里筛。
> 引擎 `core/packages/client/lib/cross-trainer/**`,UI `_components/GenDiffConfig.tsx`,
> 取题 `_lib/scramble/trainer_pool.ts` + `trainer.worker.ts`。

## 0. 目标

1. or18 那 8 个训练器(tools/cross_trainer 等 fork)全部进站本体,性能优于上游。
2. 口径两套都要:or18 的**定色 + 定槽**,以及站内的**底色子集 + 最优槽**(与 /scramble/stats、
   真题难度筛同一口径)。
3. **每个阶段的最小 / 最大步数都要能生成**(例:XCross 0 步与 10 步)。
4. 生成代价 = 用户等待时长,必须小。
5. 方法 / 阶段最终对齐 `/scramble/solver` 的全站词表(整体 / 标准 / 伪 / 基态 / 伪基态 / EO /
   F2LEO / 伪 F2LEO / 砖 / DR × 十字…XXXXCross)。**未完成,见 §7。**
6. 滑块刻度标到**上帝之数**(至少是有实证的下界),抽不出来的那一段置灰而不是不标。

## 1. 已上线

12 个阶段:`std/{cross,xcross,xxcross}`、`eo/eo_cross`、`pair/{cross_pair,xcross_pair}`、
`pseudo/{pseudo_cross,pseudo_xcross}`、`pseudo_pair/pseudo_cross_pseudo_pair`、
以及 T1 那批 `eoline/{eo,eoline}`、`222/block222`(见 §6.2)。
方法下拉走站内的 UI 聚合(`uiVariantOptions`/`uiStagesOf`/`dataVariantOfStage`),所以
`eoline` 并进「EO」、`222` 并进「砖」—— 与 /scramble/solver、首页近期打乱、真题难度筛同一份下拉。

- 采样严格均匀:子步坐标均匀 × 其余块均匀补全 = 该最优步数下全体状态上均匀(纤维等势)。
- **帧折叠**:只给规范坐标系(D 面十字、DFR 槽)建表,其余 (底色, 槽) 用 24 个整体旋转换算 ——
  六色中立从 24 次建表降到 1 次。
- 状态 → 打乱文本走 min2phase 的 `INVERSE_SOLUTION`(CI 里验证回代到同一 54 字符)。

## 2. 关键算法:多帧(双色 / 四色 / 六色 / 最优槽)怎么抽

度量是**多个帧上的最小值**,帧之间相关,没有单一坐标可枚举。两个引擎交替跑(`index.ts` 的
`oneFrame`):

| 引擎 | 做法 | 强在哪 | 弱在哪 |
|---|---|---|---|
| A 全局拒绝 | 均匀抽整个状态 → 算各帧最小值 → 落窗口就要 | 窗口盖住分布主体时几乎一击即中 | 稀有档(0 步、极深)命中率天文数字级低 |
| B 条件抽样 | 选一帧 f → 从 f **自己的窗口** `[lo,hi]` 精确抽 → 验证其余帧都不更浅 | 稀有档(尤其 0 步)一次就中 | 窗口宽且靠近众数时,「其余帧不更浅」几乎全被拒 |

B 的无偏性:提案分布是各帧自己窗口的**并集**上的均匀分布(目标集合的超集),同一状态可能有多帧
并列,只有**下标最小**的那帧才接受(canonical representative),所以每个目标状态恰好被产出一次。
超集上均匀 + 只接受子集 = 子集上均匀。

**B 必须抽整个窗口,不能按深度轮询** —— 条件在单个深度上才是精确的,轮询深度等于偷偷给窗口重新
加权,详见 §3 第 5 条。

已知偏差(有意保留):B 的均匀性要求各帧互为共轭、窗口等大。凡是「换个底色 / 换个槽」得到的帧都
满足。**不满足的是两个「最优槽」帧有两种形状的阶段** —— XXCross(4 个相邻槽对 + 2 个对角)和
XCross+配对 —— 它们的层大小从第 2 层起就分家(见 `multi.ts`),对角代表被少抽约 1–2%。

交替 = 最多比更优的那个慢 2 倍,不用给每个阶段调参。

**效果**(实测,表已建好后):

| 组合 | 改前 | 改后 |
|---|---|---|
| 六色 XCross 0 步 | 拒绝采样 8 s 预算耗尽 → 「生成不出来」 | 1 ms |
| 六色 EOCross / XXCross / 基态 / 伪 / 伪基态 0 步 | 同上 | 建表后即时 |
| 双色十字 8 步 | 取不到 | 359 ms |
| 双色 XCross 9 步 | 取不到 | 0.7–2 s |
| 双色伪十字 8 步 | 取不到 | 61 ms |

### 预算是墙钟,不是次数

三处都踩过同一个坑:**用「尝试次数」当上限**。一次尝试的成本从 1 µs(十字)到 1.2 ms
(XCross 配对)差三个数量级,所以任何固定次数要么把便宜阶段的预算浪费掉 2/3,要么把贵的阶段
卡死几分钟。现在:

- 单帧抽样按**时间分块**(`drawFrame`:小块起步 → 计时 → 按剩余时间外推下一块大小),
  上限只是「更多次数也没用」的信号(枚举型阶段直接判空,其余到 20 万次封顶)。
- 多帧外循环没有次数上限,只看墙钟。
- 墙钟从**第一块之后**才起算 —— 第一块付的是建表钱(冷启 XXCross 建表 13.6 s,比整个预算还长)。

## 3. 已修的正确性 bug

1. **伪十字给错难度**:`pseudoCrossDistOf` 无视 `cap`,引擎 A 只判了 `best >= lo` 没判
   `<= hi` → 要 0 步却给 4 步。现在 A 显式判上界,且该函数按 cap 返回 -1。同类问题的
   `std/cross` 的 `frameDist` 也一并按 cap 返回 -1(否则引擎 B 的并列裁决全被拒)。
2. **EOCross 走的是自己那份多色循环**(没有条件层抽样、没有预算上限)→ 改成和其余阶段一样走
   `oneFrame`。`std/cross` 同样收编(它原先的多色循环是纯拒绝采样,取不到双色 8 步)。
3. **冷建表吞掉整个预算 → 池子把「预算用尽」当成「不存在」并永久锁死**。这就是用户截图里那个
   「这个难度组合生成不出来」:XXCross 冷建表 13.6 s > 8 s 预算,`gen` 返回 0 条,
   `trainer_pool` 把 `buf.empty` 置真再也不重试。三处一起修:worker 加 `warm` 指令(建表不计时)、
   墙钟从第一块之后起算、池子只认**证明**(`verdict === 'empty'`)才锁死,预算用尽只报「还在找」。
   隔离验证:同一 spec 表建好后 590 ms 就出题。
   后续修正:独立的 `warm` 请求已撤掉 —— 它没有 supersede,拖动阶段下拉会把每个阶段的建表都排进
   worker 队列(照 §4 的数字,9 个阶段 ≈ 一分钟)挡在用户真正要的那次 `gen` 前面。现在建表就在
   `gen` 内部、采样计时开始之前完成,顺序天然正确。
4. **单帧路径完全没有墙钟**:`pair/xcross_pair` 单色定槽 11 步实测一次抽样阻塞 worker 47.6 s
   (最坏 ~240 s)。现在单帧和引擎 B 的每次尝试都按 §2 分块计时 —— 但**每次 `drawFrame` 的第一
   小块仍在计时之外**,那是有意的(它付的是建表钱)。所以起始块只有 32 次尝试:按最贵阶段
   3.3 ms/次算也就 ~100 ms,再几何增长。
5. **多帧窗口抽样把分布压到了下端**:引擎 B 只对**单个深度**精确,旧版按深度轮询 → 六色十字
   `[4,6]` 抽 3000 次有 2515 次是 4 步(真值 26%),`[0,8]` 几乎每条都是「十字已解」。改成 B 直接
   抽**整个窗口**(见 §2)。回归守卫:`tests/cross_trainer_distribution.test.ts` 用
   `trainerMetric` 当独立 oracle 做 χ² 比对。
6. 多帧抽样的预算改成可传参(`drawTrainerState(spec, rng, budgetMs)`),取题池用短预算,
   离线扫描用长预算。

## 4. 代价实测

单条打乱(表已建好):

| 阶段 | 采样 | + min2phase | 上游 or18 |
|---|---|---|---|
| cross | 0.0 ms | 0.8 ms | ~18 ms |
| xcross | 0.1 ms | 0.7 ms | ~18 ms |
| xxcross | 1.4 ms | 0.4 ms | 13–24 ms |
| eo_cross | 0.0 ms | 0.5 ms | — |
| cross_pair | 0.1 ms | 0.6 ms | — |
| xcross_pair | 0.8 ms | 0.6 ms | — |
| pseudo_xcross | 0.1 ms | 0.8 ms | — |

一次性建表(冷启,worker 里,期间 UI 转圈):cross 0.3 s / xcross 1.8 s / xxcross ~8–14 s /
xcross_pair ~12 s。上游同类:cross 1.4 s、xcross 13.7 s(~630 MB)、xxcross 8.8 s。
建表在 `gen` 内部、采样计时开始之前完成(见 §3 第 3 条),所以第一条打乱要等建表,之后队列已预热。

## 5. 滑块:刻度到 `god`,可选的是 `allowed`

`lib/cross-trainer/reach.ts` 每格回答两个不同的问题:

- **`god`** — 这个难度**存在**吗?刻度轴到此为止。
- **`allowed`** — 哪几档**真出得来**?其余刻度照画,置灰不可选(`RangeSlider` 的 `allowed`)。

`allowed` 是一组数而不是一个上限,因为它**可能不连续**:六色底 XCross 能出 0–8(采样)和
10(§5.5 的枚举),唯独 9 出不来 —— 既撞不上、也列不全。滑块的把手会跳过空档,提示语按连续段
逐段报(「9 步太罕见,抽不出来」),而不是假设只有一条尾巴。

### `god` 的来源:站内语料,不是估计

`stats/scramble/distribution.json` 八个数据集里该 (阶段, 底色档) **实际出现过**的最大值 ——
每个数字背后都有真实状态,所以是「至少能到这么深」的证据。八个集合里最关键的是
`xcross_2_col_10f`:**定向收集**的 127 万条「单白 XCross = 10 且单黄 XCross = 10」硬打乱
(`/zh/scramble/solver?dset=xcross_2_col_10f`),深端几乎全靠它撑起来。

重新生成(distribution.json 更新后重跑,把输出贴回 `reach.ts` 的 `TRAINER_GOD`):

```python
import json
d = json.load(open('stats/scramble/distribution.json', encoding='utf-8'))
SUB = {1: list('BGORWY'), 2: ['WY','BG','OR'], 4: ['BGOR','ORWY','BGWY'], 6: ['BGORWY']}
KEYS = [('std','cross'),('std','xcross'),('std','xxcross'),('eo','eo_cross'),
        ('pair','cross_pair'),('pair','xcross_pair'),('pseudo','pseudo_cross'),
        ('pseudo','pseudo_xcross'),('pseudo_pair','pseudo_cross_pseudo_pair')]
for var, st in KEYS:
    out = []
    for n in (1, 2, 4, 6):
        mx = -1
        for sv in d['sets'].values():
            row = sv['variants'].get(var, {}).get('data', {}).get(st)
            if row:
                mx = max([mx] + [row[s]['max'] for s in SUB[n] if s in row])
        out.append(mx)
    print(f"  '{var}/{st}': {out},")
```

口径说明:distribution 的 XCross 一族是**四槽取最优**,定槽只会更深或相等,所以同一个数字对
`fixed` 也是合法下界。

刻度轴的顶取三种证据里最强的一条:**语料里出现过**、**我们自己抽出来过**、或者这一格**被穷举
过**(`reach.ts` 的 `FRAME_MAX_VERIFIED`:单色 + 定槽是单帧,若该阶段有全空间距离表 / 完整 BFS
就直接知道直径)。反过来,`XXCROSS_MAX_DEPTH = 13`、`XPAIR_MAX_DEPTH = 11` 这类**只当搜索上界
用、从没被枚举验证过**的常数不算证据 —— 拿它画刻度等于告诉用户「13 步的 XXCross 存在」,而
`multi.ts` 自己就写着那个数没验证过。那两个阶段照样退回语料证据(12 / 11)。

### 采样段的来源:实测

`allowed` 的连续段 = `[0, draw]`。`draw` 的定义:**按线上预算(`GEN_BUDGET_MS` = 3 s)连抽 5 次
都中**的最大步数。重新测量的探针脚本原样留在
本文件末尾附录 A —— `god` 那半有脚本可复现,`draw` 这半也得有。

守卫 `tests/cross_trainer_reach.test.ts`:每个 (阶段 × 四个底色档 × 槽档) 的**边界档**都要真抽出
来 —— 0 步、连续可抽段的最深一格,以及每个靠枚举补上的孤岛档;预算就用线上的 3 s,失败允许重试 3 次 —— 这正是取题池的行为(`MAX_TRIES` 批之后才报「太
稀有」),所以测的是用户真正会遇到的契约,而不是一个放宽过的版本。槽档只测 UI 真能选到的组合:
定槽只在单色下出现(多色时面板直接隐掉槽选择器)。

### 关键结论

- **双色底 XCross 10 步存在**(整个 `xcross_2_col_10f` 语料都是),但均匀抽样撞上它约 1e-8,
  给 30 s 也抽不出来 → 标到 10、9 以上置灰。
- 反过来,**下界恒为 0**:引擎 B 直接构造「该阶段已解」的状态,任何底色档都是即时。
- 深端里有一类不必置灰:**整档能一个不漏地列出来**的,见下一节。

## 5.5 抽不到就点名:枚举出题(`corpus.ts`)

抽样在多底色度量的最顶上不是「慢」,是**不可能**:六色底十字 8 步是 9.81e11 里的 40 个
(p = 4e-11),六色底 XCross 10 步是 4.3e19 里的 438 个。但这两档小到可以**逐个列出来** ——
那才是诚实的答案,不是再调一版采样器。

两条来路,同一个契约(在整档上均匀):

| 来路 | 覆盖 | 做法 | 成本 |
|---|---|---|---|
| **现算** | 十字顶档(四色 591 / 六色 40) | 交每个底色**自己的**最深层(各 102 个坐标),逐面加约束 | 首次 ~10 ms,之后缓存 |
| **随包** | 六色底 XCross 10 步(438) | 上游穷举搜索的结果,`corpus-data.ts` 打包 4 个整数/条(~15 KB) | 解码即用 |

- 现算之所以便宜:十字度量只看 4 条棱,而每个底色的 8 步层只有 102 个坐标;沿着底色往下走,
  面与面共享棱(每条棱属于两个十字),约束收得极快。**只在该度量的最大值上成立** —— 那里
  「六色取最小 = 8」与「六色各自都 = 8」是同一句话,更浅的档两者不等价。
- XCross 不能现算:六色四槽的度量读**整颗魔方**,闭包等于在 4.3e19 上搜。那 438 个来自上游
  穷举,站内出处见 `/scramble/hardest`(含 23 条对称代表展开成 438 的现场证明)。
- **数目对不上就不给**:每一格都带一个金标数(来自 `_data/exact_dist.ts` 的精确穷举集 /
  `/scramble/hardest`),现算结果与金标不等 = 模型漂了,直接返回 null 报「生成不出来」,
  绝不端出一份「差不多的」。
- 取用时机:**窗口正好压在一档上**(`lo === hi`)才走枚举。窗口更宽时,真条件分布给深端的
  权重是 1e-11,如实照办(= 出不来)才是对的 —— 想要它就单独要它,而这正是把滑块两个把手
  拖到同一格的意思。
- 守卫 `tests/cross_trainer_corpus.test.ts`:数目 `toBe` 锁死;每一条都用**计时器自己的度量**
  重测一遍(不是枚举时走的那张表);438 条逐条与上游打乱表比对,顺序都不许错;
  六色 40 个必须是四色 591 个的子集(两次独立枚举互证)。

## 6. 还没做到的:方法 / 阶段词表

`/scramble/solver` 的方法下拉有 10 项,难度面板目前只有 5 项、9 个阶段。差距:

| 方法 | 阶段 | 现状 | 客户端引擎与实测单帧成本 |
|---|---|---|---|
| 标准 | cross / xcross / xxcross | ✅ 原生 TS | — |
| 标准 | xxxcross | ❌ | `CrossSolverWasm.solve_face` 中位 34 ms(需 `pt_cross_C4E0`,gz 21 MB → 内存 54.7 MB) |
| 标准 | xxxxcross | ❌ | 同上,中位 615 ms / p90 2.9 s / 最坏 3.8 s |
| EO | eo_cross | ✅ 原生 TS | — |
| EO | eo_xcross…eo_xxxcross | ❌ | `VariantSolverWasm`,**无单帧入口**,最小单位是 6 视角网格;xxxcross ≈ 0.7 s/帧 |
| EO | eo_xxxxcross | ❌ | 9–63 s/帧(网格 212 s)—— 光测量就超预算,不可行 |
| 基态 / 伪 | cross / xcross | ✅ 原生 TS | — |
| 伪基态 | cross(`pseudo_cross_pseudo_pair`) | ✅ 原生 TS | — |
| 伪基态 | xcross(`pseudo_xcross_pseudo_pair`) | ❌ | `VariantSolverWasm`,无单帧入口 |
| 基态 / 伪 / 伪基态 | xxcross / xxxcross | ❌ | `VariantSolverWasm`;伪基态 xxxcross 9.6–57 s/帧,不可行 |
| F2LEO / 伪 F2LEO | cross…xxxcross | ❌ | `VariantSolverWasm`,建表 4.2–4.9 s,xxxcross 1–6.6 s/帧 |
| 砖 | 222 | ✅ 原生 TS(§6.2) | 25.3 万态,一次 BFS 114 ms |
| 砖 | 122 / 123 / 223 / F2B | ❌ | `Roux223SolverWasm` 建表 2.87 s;**F2B 每条 ~3 s(无缓存,IDA*)** |
| DR | dr | ❌ | `EoDrSolverWasm` 建表 442 ms,测量 ~2 ms/帧 |
| EOLine | eo / eoline | ✅ 原生 TS(§6.2) | 2,048 / 27 万态,BFS 各 ~0.1 s |
| 整体 | 333 | ❌ | **无可用客户端引擎**:cubeopt 要 SAB + COOP/COEP(全站只有 /scramble/solver 发),表 30 MB–15 GB;或走登录态的服务端 SSE |

(以上成本由 `wf_b4b6d65f-1c0` 工作流在本机 Node 实测,浏览器桌面 ≈1–1.5×,手机 3–5×。)

### 路线分层

- **T1 原生 TS(精确层 + 双引擎)** —— 现有 9 个阶段的做法。两端都能取到,微秒级。
  下一批适合走 T1 的:**纯 EO**(坐标 2048)、**EOLine**(2048 × 132 = 27 万)、
  **block222**(1 角 + 3 棱 ≈ 25 万)—— 都是一次 BFS 就全枚举,和十字同级便宜。
- **T2 WASM 测量 + 拒绝采样** —— 只覆盖分布主体,稀有档靠 §5 的 `god`/`draw` 如实置灰。
  适用:DR(2 ms/帧)、标准 xxxcross(34 ms/帧)。
- **T3 暂不提供** —— 光测量一帧就超预算的:标准 xxxxcross、eo_xxxxcross、伪基态 xxxcross、
  砖 F2B、整体。面板里不列,而不是列出来再报错。

> 注意 `dr` / `htr` / `htr2` / `fr` 在 StageSolver 里是**条件式阶段**(输入必须已处于该视角的
> DR/HTR,否则返回哨兵值),不能直接当任意随机态的难度轴 —— DR 方法要用的是
> `EoDrSolverWasm` 的「到 DR 的最优步数」,不是那几个条件阶段。

## 6.1 口径核对:与站内 Rust 引擎逐列比对

这批新阶段一上来就问了一个之前没问过的问题:**生成器说的「白 · 十字 · 5 步」,和
/scramble/stats 说的是同一句话吗?** 之前每个测试都是拿生成器和它自己的表对,自证。

现在有了外部判据:`stats/scramble/comp_steps*` 是 Rust 分析器逐条真题算出来的每色步数
(6 列 = 分析器那 6 个视角,列序 W Y R O B G,对应 `_z0 _z2 _z3 _z1 _x3 _x1`)。守卫
`tests/cross_trainer_parity.test.ts` 把每个阶段的 224 条真题 × 6 色全部对一遍:

| 阶段 | 对上 / 总数 |
|---|---|
| `std/{cross,xcross,xxcross}`、`pair/{cross_pair,xcross_pair}`、`pseudo/pseudo_cross` | 1344 / 1344 |
| **`eoline/{eo,eoline}`、`222/block222`(新)** | **1344 / 1344** |
| `eo/eo_cross` | 959 / 1344 |
| `pseudo/pseudo_xcross` | 822 / 1344 |
| `pseudo_pair/pseudo_cross_pseudo_pair` | 911 / 1344 |

后三个是**先前就存在的口径分歧**,不是这次改出来的(这次只是第一次量到)。共同点是「移植时靠推断
补的定义」:EOCross 的取向轴该怎么随底色走、以及带槽的「伪」到底伪在哪。数值用 `toBe` 锁住,
修好一个就该顶到 1344 并挪进上面那行 —— 绝不允许把断言放宽。

新阶段没踩这个坑,是因为定义是**读引擎读来的**,不是猜的:
- 纯 EO 的每色列 = 该底色**两条垂直轴**里更小的那个(不是 ZZ 惯用的那一条),所以对面色恒等、
  四色就已经把三条轴占满 —— 四色档与六色档必然同值。
- EOLine 的每色列 = 该面**两条线**(D 面的 DF/DB 与 DR/DL)里更小的那个,六色 = 12 条线。
- 222 的每色列 = 该层**四个块**里最小的那个;一对对面色的八个块就是全部八个,所以双 / 四 / 六色
  三档必然同值。

## 6.2 T1:三个原生阶段

| 阶段 | 坐标 | 态数 | BFS | 上帝之数(穷举) |
|---|---|---|---|---|
| 纯 EO | 12 位翻转字(偶校验) | 2,048 | 瞬时 | **7** |
| EOLine | 翻转字 × 两条线棱的有序位置 | 2,048 × 132 = 270,336 | 81 ms | **9** |
| 222 | 1 角(24)× 3 棱有序(10,560) | 253,440 | 114 ms | **8** |

三个都是**整表枚举**,所以没有「抽不到」的档:单帧任意一层都是 O(1) 直接从层里取,`draw` 顶到
`god`,滑块一格不置灰。这也是它们和 §5 那套「采样 + 置灰」的根本差别 —— 便宜到不需要采样。

god 的证据这次不来自 distribution.json(§5 那张表的来源),因为该文件的观测最大值低于真上帝之数
(block222 观测 7,实际 8)。改用两条:40 万次均匀抽样见过的最深,与实际抽出来过的最深;而单帧
直径又是「多帧取最小」的天花板,所以凡是打到直径的格子就是**准确值**,不只是下界。

## 7. 待办

- [x] 可达区间表 → 滑块上下限(按 阶段 × 底色档 × 槽档);不可达刻度置灰。
- [x] 建表预热:选中阶段就在 worker 里开始建,别等第一条打乱。
- [x] iframe 里不再注入 CubeRoot logo(`tools/assets/js/logo_nav.js`:`window.self !== window.top` 直接 return)。
- [x] **T1 扩展**:纯 EO / EOLine / block222 三个原生阶段(方法下拉多出「砖」),见 §6.2;
      方法/阶段下拉同时换成站内的 UI 聚合。
- [ ] 修 §6.1 那三个口径分歧:`eo/eo_cross`(取向轴怎么随底色走)、`pseudo/pseudo_xcross`、
      `pseudo_pair/pseudo_cross_pseudo_pair`。判据现成(comp_steps 逐列比对),缺的是读引擎。
- [ ] **T2 扩展**:DR、标准 xxxcross(worker 里挂 `cross_solver_bg.wasm`)。
- [x] 深端真出题(§5.5):六色底十字 8 步(40 个,现算)、四色底十字 8 步(591 个,现算)、
      六色底 XCross 10 步(438 个,随包)。
- [ ] 深端剩下的:**双色底 XCross 10 步**(该档 20,230,604 个,列不全也抽不到)、
      **六色底 XCross 9 步**(该档数目未知)、多底色 EOCross 10 步(可现算,量待估)。
      前者可行方向是从 `xcross_2_col_10f` 那 127 万条硬语料里抽样随包下发。
- [ ] `f2leo` / `pseudo_f2leo` / `整体`:等有便宜引擎再说,现在如实不列。

## 8. 决策记录

- **不做独立训练器页面**:功能全部落在 /timer 的难度面板(用户明确要「界面就 1」)。
- **不用真题筛代替生成**:真题库里没有的档(六色 0 步)必须能出,只有生成做得到。
- **不给用户看假打乱**:窗口取不到时显示提示,绝不塞一条别的难度的打乱冒充。
- **滑块标到上帝之数、置灰不可达**,而不是干脆不标 —— 不标会让人以为站内认为它不存在。
- **「预算用尽」永远不等于「不存在」**:只有「所有单帧层都空」才是证明,才允许锁死提示。

## 附录 A. 重新测量 `draw`

放回 `core/packages/client/tests/_probe_reach.test.ts` 跑一次,输出在 `.tmp/reach_measured.txt`,
把 `###` 那些行贴回 `reach.ts` 的 `DRAW`。跑完删掉探针(它不是断言,不该留在 CI 里)。

```ts
import { describe, expect, it } from 'vitest';
import { drawTrainerState, trainerCaps, trainerStagesOf, trainerVariants } from '@/lib/cross-trainer';
import { TRAINER_GOD } from '@/lib/cross-trainer/reach';

const BUDGET = 3000;                       // = GEN_BUDGET_MS
const SUBSET: Record<number, string> = { 1: 'W', 2: 'WY', 4: 'BGOR', 6: 'BGORWY' };
const CONFIRM = 5;                         // 连中 5 次才算这一格能交付
const COUNTS = [1, 2, 4, 6] as const;

describe('reach measurement', () => {
  it('deepest depth deliverable in five consecutive draws', async () => {
    const { writeFileSync } = await import('node:fs');
    const lines: string[] = [];
    const emit = (s: string) => { lines.push(s); writeFileSync('.tmp/reach_measured.txt', lines.join('
')); };
    for (const variant of trainerVariants()) {
      for (const stage of trainerStagesOf(variant)) {
        const caps = trainerCaps(variant, stage)!;
        const god = TRAINER_GOD[`${variant}/${stage}`];
        const modes: Array<'fixed' | 'best'> = caps.slots ? ['fixed', 'best'] : ['best'];
        const row: Record<string, number[]> = {};
        for (const mode of modes) {
          const got: number[] = [];
          for (const n of COUNTS) {
            const ceiling = Math.min(caps.range[1], mode === 'fixed' && n === 1 ? caps.range[1] : god[COUNTS.indexOf(n)]);
            let best = -1;
            for (let d = ceiling; d >= 0; d--) {
              let ok = 0;
              for (let k = 0; k < CONFIRM; k++) {
                const r = drawTrainerState(
                  { variant, stage, colors: SUBSET[n], slot: mode === 'fixed' ? 0 : 'best', lo: d, hi: d },
                  Math.random, BUDGET,
                );
                if (r.ok && r.depth === d) ok++; else break;
              }
              emit(`${variant}/${stage} ${n}c/${mode} @${d}: ${ok}/${CONFIRM}`);
              if (ok === CONFIRM) { best = d; break; }
            }
            got.push(best);
          }
          row[mode] = got;
        }
        emit(`### '${variant}/${stage}': { fixed: [${(row.fixed ?? row.best).join(', ')}], best: [${row.best.join(', ')}] },`);
      }
    }
    expect(lines.length).toBeGreaterThan(0);
  }, 3_600_000);
});
```
