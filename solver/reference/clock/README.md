# 魔表(Rubik's Clock)求解器 — 参考实现收藏

**这个目录不参与任何构建。** 里面全是第三方原作者的代码,原样收录、只读、不编译、不被任何
workspace import。本站真正在跑的求解器是 `core/packages/client/lib/clock-solver.ts`(纯 TS,
独立写成,见文末对照)。

收录动机:魔表是少数几个「全状态空间被完整算穿」的扭计魔方之一 —— 12^14 = 1,283,918,464,548,864
个状态、God's number = 12。这份收藏保存了做成这件事的那几份代码,以及验收用的数据集。

---

## 1. 出处 / 授权

| 文件 | 作者 | 出处 | 取得 | 授权 |
|------|------|------|------|------|
| `clockcoset11.cpp` | Tomas Rokicki | <http://cube20.org/clock/clockcoset11.cpp> | 2026-07-25 | 页面公开发布,作者写明 "for your perusal";**无明示 license** |
| `dist12.txt` | Tomas Rokicki | <http://cube20.org/clock/dist12.txt> | 2026-07-25 | 同上(数据集) |
| `optclock.cpp`<br>`optclock_stats.cpp`<br>`optclock_readme.txt` | Michael Gottlieb (qqwref) + Ben Whitmore | <http://mzrg.com/rubik/optclock/optclock.zip> | 2026-07-25 | readme 内写 "Copyright 2014 by Michael Gottlieb and Ben Whitmore";**无明示 license** |
| `ClockSolver.java`<br>`cs0x7f-clock-README.md` | Shuang Chen (cs0x7f,csTimer 作者) | <https://github.com/cs0x7f/clock> | 2026-07-25 | **GPLv3**(许可证正文在 `cs0x7f-clock-README.md`,原样保留) |

说明:

- 原 zip 里的 `optclock.exe` / `optclock_stats.exe` / `optclock_gui.exe`(Windows 二进制)**未收录**。
- 全部文件只做了 CRLF → LF 行尾归一(仓库 `.gitattributes` 强制 LF),内容逐字未改。
- `ClockSolver.java` 是 GPLv3。GPLv3 允许原样再分发,本仓库**不链接、不编译、不衍生**它,
  因此不产生传染;它与本站代码在物理与逻辑上都完全隔离。
- Jakob Kogler(Jakube)那份最早证出 God's number = 12 的程序**没有公开源码**,只有方法描述
  (见 §3),他的 GitHub 上没有 clock 仓库。

---

## 2. `clockcoset11.cpp` — Rokicki 的全空间陪集求解器 ★

这是唯一一份真正算穿了 12^14 全空间的代码,产出上面那张距离分布表。

**思路(陪集分解):**

固定正面十字(center + 4 条边共 5 个表盘)的那个子群,允许背面十字与 4 个角盘任意变化,大小
12^9 = 5,159,780,352。由 Lagrange,陪集数 = 12^14 / 12^9 = 12^5 = 248,832,恰好等于正面十字的
位置数。**一次执行把一个陪集里的 51.6 亿个状态全部最优解掉。**

陪集数再靠等价关系压:左右镜像 + 90° 整体旋转 + 「每个表盘乘一个与 12 互质的整数」的同构,
一个正面十字位置最多有 31 个等价伙伴 → 248,832 压到 **9,906** 个代表元(约 25 倍)。每个陪集
单核跑不到 3 分钟,9,906 个陪集撒在几台桌面机上,总共约 3 天。

**代码结构(逐段):**

| 位置 | 作用 |
|------|------|
| `const int N = 10` | **每个表盘的刻度数**。作者把程序写成 hours = 2..12 通用(用小 N 做穷举交叉验证),**跑真魔表要改成 `N = 12`**。发布出来的这份就停在 10。 |
| `touch[15][9]` | 15 种非空针脚组合各自拨动正面哪几个盘(按影响盘数分组注释成 4's / 6's / 7's / 8's / 9's)。 |
| `prune[CROSS]`(N^5 字节) | 正面十字的剪枝表,填到深度 4(`memset(prune,5,…)` + `d<5` 循环)。 |
| `dist[MEMLONGS]`(N^8 个 `ull`) | 陪集内 N^9 个状态的距离表,每个 64 位字塞 N 个 5 bit 车道。N=12 时 12^8 = 429,981,696 字 = **3.2 GiB**。哨兵 `LONGINIT` = 每车道 14(注释写明「出现 15 就是未检出的溢出」)。 |
| `search()` | 迭代加深 DFS:枚举所有解正面十字的走法,记录它顺带把 4 个角盘拨到哪(`cornerindex()` + `p[8]`),写进 `dist`。`at == 8` 处有个剪枝:除非十字快解完了否则不往后走。 |
| `gentable()` | 「用每个背面招式扩张距离表」的那一遍扫描。因为群是阿贝尔的,每个招式只需扫一次。 |
| `do12(v1, v2, tw)` | **SWAR 内核**,一条指令流里同时对 12 个 5 bit 车道做 `min(v1, rot(v2) + 1)`:`v2 << 5*tw \| v2 >> 5*(N-tw)` 是「拨表盘 tw 格」= 车道循环移位,`+LOBITS` 是「多走一步」,`HIBITS` 当借位护栏做无分支车道比较。这就是 2,800 万解/秒 的来源。 |
| `main(argc == 6)` | `argv[1..5]` = 陪集编号(正面十字那 5 个盘的值)。跑一次 = 解一个陪集。 |

**正确性自证(作者原话):** 把程序写成 hours 通用后,他用这个陪集程序跑遍 2..12 各种刻度数,
另写了几个更慢的独立程序用别的方法枚举状态空间;hours = 2 和 3 做到了完整穷举对账,其余尺寸
对账了低距离档;距离 12 的那些位置再用 OptClock 逐个复核确实要 12 步。

---

## 3. Jakob Kogler(Jakube)的 God's number 证明 — 无公开源码

2014-05-31 首次证出 God's number = 12。方法(论坛原述):单侧(十字 + 角)最优步数查找表 +
迭代加深 DFS 到深度 6,再用「逆状态步数相同」的对称性折半。建表约 10 分钟。Rokicki 随后用上面
的陪集法独立复核,并给出完整分布。

---

## 4. `optclock.cpp` / `optclock_stats.cpp` — OptClock(单状态最优)

qqwref(Michael Gottlieb)写算法与非 GUI 版,Ben Whitmore 用 Qt 加 GUI。**两阶段:**

- **Phase 2**(先算):只剩两个十字 + 4 个角 → 12^6 ≈ 300 万态,标准 God's algorithm 全表,
  落盘成 3 MB 的 `phase2.table`。
- **Phase 1**:30 个招式里 16 个会破坏十字(phase 1 用)、14 个保持两个十字(phase 2 用),
  因为可交换所以两组互不侵犯。8 个「角招式」的用量是仅有的自由度 → 12^8 ≈ 4.3 亿种 phase 1 解,
  逐个查 phase 2 表求总步数最小。phase 1 步数拆成前后各一张 12^4 表相加;已有 11 步解时,
  phase 1 就已 ≥ 11 的组合直接跳过 phase 2 查表(phase 1 最长 16 步,大部分被砍掉)。

`optclock_readme.txt` 里作者结尾还写着「接下来去找 God's number,现在看着像 11」—— 后来是 12。

**记号(dist12.txt 就用这个格式):**

```
   1 2 3     . 10 .
   4 5 6    11 12 13
   7 8 9     . 14 .
  (front)    (back)
```

打乱 = 14 个整数。背面 4 个角不用给(由正面角决定)。翻面时保持顶端仍在顶端(所以 10 号在 2 号背后)。
招式写成 `UUDU u3'`:大写四位 = 针脚状态(左上/右上/左下/右下,U = 朝向你),小写 u/d = 拨 U 侧还是
D 侧的角,数字/撇 = 拨几格、顺逆。

---

## 5. `ClockSolver.java` — cs0x7f 的 Java 最优求解器

csTimer 作者 Shuang Chen 的独立实现,GPLv3。`moveArr[18][14]` 直接给出 18 个招式(正面 9 + 背面 9)
在 14 个自由坐标上的增量,背面招式对正面角写 `11`(= −1 mod 12)—— 正是「背面角 = −正面角」约束
的编码。文件头那张图是它的坐标编号:

```
  0 1 2	  -2  9 -0
  3 4 5	  10 11 12
  6 7 8	  -8 13 -6
 (front)	(back)
```

---

## 6. `dist12.txt` — 全部 39,248 个距离 12 的状态 ★

Rokicki 的成果之一,也是这份收藏里**最有实用价值**的东西:它把「最难的那一档」变成可精确对账的
测试集。每行 14 个整数,OptClock 格式(见 §4),0..11。

映射到本站 `lib/clock-solver.ts` 的 `posit`(物理帧,18 个盘,正面 0..8、背面 9..17):

| dist12 列(0-indexed) | 含义 | 本站 `posit` 下标 |
|---|---|---|
| 0..8 | 正面逐行 | 0..8 |
| 9 | 背面上边 | 10 |
| 10 | 背面左边 | 12 |
| 11 | 背面中心 | 13 |
| 12 | 背面右边 | 14 |
| 13 | 背面下边 | 16 |
| — | 背面 4 角 = −正面对应角 | 11, 9, 17, 15 ← −(0, 2, 6, 8) |

对账测试在 `core/packages/client/tests/clock_solver.test.ts`,默认抽样、`CLOCK_DIST12_FULL=1` 跑全量:

```bash
# 抽样(默认 300 条,约 5 秒)
pnpm --filter @cuberoot/client test:solvers clock
# 全量 39,248 条(约 11 分钟)
CLOCK_DIST12_FULL=1 pnpm --filter @cuberoot/client test:solvers clock
```

分布表本身的三层核验(恒等式 / d ≤ 3 精确枚举 / 抽样)在
`core/packages/client/scripts/clock/verify_distribution.mts`。

---

## 7. 与本站 TS 求解器的关系

`core/packages/client/lib/clock-solver.ts` 是**独立写成**的(先于本目录收录这些代码),没有抄任何一份。
写完再读上游,发现思路与 Rokicki 的陪集内那一步是同一个:

|  | 本站 TS | Rokicki 陪集 | OptClock |
|---|---|---|---|
| 目标 | 单状态最优 | 全陪集(51.6 亿态)最优 | 单状态最优 |
| 核心结构 | 前/后各一张 `Z12^4 → 最少步数` 表(20,736 项),答案 = `min_α (F[α] + B[α − 角目标])` | 同样「解正面十字 + 记录对 12^4 个角设置的影响」,再用 SWAR 扫背面招式扩张 | 两阶段:12^6 全表 + 枚举 12^8 个 phase 1 解 |
| 表 | 现场建,无落盘 | 3.2 GiB 内存 | 3 MB `phase2.table` |
| 组合次数 | 20,736 | — | 4.3 亿(带早剪) |
| 速度 | 17.4 ms/态(浏览器 JS) | 2,800 万态/秒(摊到陪集) | 秒级/态 |

三者都吃同一个结构性事实:**魔表群是阿贝尔的,且正面招式碰不到背面自有盘、反之亦然,两侧只通过
4 个角盘耦合。**

---

## 8. 其它(只留链接,未收录)

- [Nyanyan/RubiksClockSolver](https://github.com/Nyanyan/RubiksClockSolver) — Python,MIT。
- [JoshM2/matrix-clock](https://github.com/JoshM2/matrix-clock) — Rust,**tick 最优**(最小化总刻度数而非步数,不同度量);需要一个 3.7 MB 的预算表二进制才能用。
- [Jaap's Puzzle Page — Rubik's Clock](https://www.jaapsch.net/puzzles/clock.htm) — 分布表与群论背景。
- [God's Number for Clock found](https://www.speedsolving.com/threads/gods-number-for-clock-found.47822/) — Kogler 的原帖。
- [OptClock 发布帖](https://www.speedsolving.com/threads/optclock-optimal-rubiks-clock-solver.47747/)
