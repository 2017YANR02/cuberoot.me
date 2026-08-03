# 精确穷举分布:待跑单元

`/scramble/stats` 的「完整状态空间」数据集(`core/packages/client/app/[lang]/scramble/stats/_data/exact_dist.ts`)
里每一格都要么有一条穷举出来的深度分布,要么写清楚**卡在哪**。这份文件是「卡在哪」那一半的
台账:每个单元写明坐标、内存、算法、跑法、跑完之后数字回填到哪里。

页面上的格子按可行性分三档,与这里一一对应:

| 页面标签 | 含义 | 本文件 |
|---|---|---|
| 待跑 | 算法与代码都就位,只差机时 | 有跑法命令行 |
| 有路线 | 路线清楚,代码还没写 | 有算法段,没命令行 |
| 够不着 | 现有硬件够不着 | 不列在这里(格子里直接写要多少) |

跑之前先读 `CLAUDE.md` 的硬约束:重活 ≤ 14 线程,别吃满核;huge 表要显式
`CUBE_ALLOW_HUGE_TABLES=1`;表落 `./tables/`,别污染测试目录。

---

## 引擎:`src/bin/dist_tracked.rs`

「盯住这几块角 + 这几条棱,归位即达标」这一族全走它。状态 = A 因子 × B 因子,
`idx = a·|B| + b`,BFS 走 `src/dist/packed4.rs` 的 4-bit nibble 多源版。

因子由分量串成:`Corners(k)` = P(8,k)·3^k、`Edges(m)` = P(12,m)·2^m、
`EdgePos(m)` = P(12,m)(翻转交给 `EoWord`)、`EoWord` = 2,048。

**为什么要拆两个因子**:8 条棱的精确坐标 51 亿,转动表 368 GB,建不出来。拆开之后
转动表小到可以忽略,代价是乘积空间大于真实空间 —— 多出来的是「两块占同一个位」的
非法态,BFS 从合法目标出发永远走不到,计数仍然精确。**总数对不上就是有 bug**,
每个 preset 都把真实态数写死、跑完逐次断言。

### 正确性怎么来的

```powershell
cargo build --release --bin dist_tracked
.\target\release\dist_tracked.exe verify     # ~10s
```

一次比七条已知曲线 + 一组等价性检查:

| preset | 态数 | 金标来源 |
|---|---:|---|
| cross | 190,080 | 本仓库 `dist_cross_1col` |
| 122 | 12,672 | TS `lib/cross-trainer/tracked.ts`(48 个帧同曲线) |
| 222 | 253,440 | TS `lib/cross-trainer/block.ts`(另一套打包 + 另一套 BFS) |
| 123 | 5,322,240 | TS `tracked.ts`(24 个帧同曲线) |
| xcross | 72,990,720 | 本仓库 `dist_xcross_1col_fixed` |
| eo | 2,048 | TS `lib/cross-trainer/eoline.ts` |
| eoline | 270,336 | 同上 |
| f2leo1 vs f2leo1_split | 3,041,280 | 同一个问题两种拆法,曲线必须逐档相同 |

最后一组是 `HomeThenOriented`(一个分量里混口径)与「非法乘积态不可达」这两件事的
证据 —— E3 靠它们,而 E3 本身太大跑不起验证。

---

## 已跑完(留在这里,是为了能复现)

### E1 — 2×2×3(`block223` / 固定单帧)✅

* 坐标:2 角(504)× 5 棱(3,041,280)= **1,532,805,120**,nibble 766 MB
* 命令:`$env:CUBE_ALLOW_HUGE_TABLES=1; .\target\release\dist_tracked.exe 223`
* 实测:14.2s(14 线程)
* 结果:`[1, 12, 141, 1746, 20935, 243092, 2698935, 27258179, 216204042, 830686751,
  453825501, 1865784, 1]`,均值 9.1159,直径 12(对径态恰好 1 个)
* 已回填 `exact_dist.ts` 的 `block223.fixed1.W`

### E2 — EO + XCross(`eo_xcross` / 固定单帧)✅

* 坐标:5 棱有序位置(95,040)×(1 角 24 × 翻转字 2,048)= **4,671,406,080**,nibble 2.34 GB
* 命令:`$env:CUBE_ALLOW_HUGE_TABLES=1; .\target\release\dist_tracked.exe eo_xcross`
* 实测:39.9s
* 结果:`[1, 15, 186, 2317, 28337, 335934, 3837763, 40923897, 371417146, 2016467967,
  2190899897, 47492614, 6]`,均值 9.3895,直径 12
* 已回填 `exact_dist.ts` 的 `eo_xcross.fixed1.W`

---

## 待跑(代码就位,只差机时)

### E3 — F2LEO 十字(`f2leo_cross` / 站内口径)

十字四棱归位 + 中层四棱朝向正确(位置随意)。一个底色只有一个帧,所以**这一格就是
站内那条曲线**,不是上界 —— 这批里最有价值的一个。

* 真实态数 **5,109,350,400**(P(12,8)·2⁸ 中十字归位那一支)
* 拆法 6+2:`Edges(DB,DR,DF,DL,BL,BR)` 混口径 × `Edges(FR,FL)` 只要朝向
  → 乘积 42,577,920 × 528 = 22,481,141,760,**nibble 11.24 GB + mt_edge6 3 GB**
* 退路 4+4(不想要 3 GB 表时):190,080² = 36,130,406,400,nibble **18.07 GB**,
  转动表各 13 MB。改 preset 里 a/b 两行即可
* 目标集 1,680 个(十字四棱归位 × 中层四棱在剩下 8 个位里的排列,朝向全 0)
* 预计 3–5 分钟(按 E2 的 4.67 亿态/40s 外推,乘积空间 5 倍)
* 命令:`$env:CUBE_ALLOW_HUGE_TABLES=1; .\target\release\dist_tracked.exe f2leo_cross`
* 跑完:`counts` 那行填进 `exact_dist.ts` 的 `f2leo_cross.unfixed`(四个底色档同一条,
  因为一个底色只有一个帧),并把 `STAGE_PLAN.f2leo_cross` 那条删掉

> 内存不够就先别开:11.24 GB nibble 是**常驻**的,换页比不跑还糟。

---

## 有路线(代码还没写)

### E4 — XCross + 一对(`xcross_pair` / 固定双槽)

* 坐标:与 XXCross 定双槽同一个 **21,459,271,680**(6 棱 42,577,920 × 2 角 504),
  nibble 10.0 GB + mt_edge6 3 GB;`dist_xxcross_1col_adj` 已经在这个坐标上跑通过
* 差的只有目标集:「一个槽解好 + 另一个槽配好」。「配好」的定义(Setup × Insert)
  与那 17 个目标态在 TS 侧 `lib/cross-trainer/pair.ts` 里,有测试盯着
* 做法:TS 侧导出 17 个 (角 coord, 棱 coord) 对 → 换算成 dist_tracked 的坐标 →
  `starts`。**别在 Rust 里重推一遍公式**,那是两份真源
* 伪基态版(`pseudo_cross_pseudo_pair`)同理,但先修口径:站内定义与 Rust 引擎
  1,344 个态里只对上 911 个,口径不对齐之前穷举没有意义

### E5 — EOCross 取最优(`eo_cross` / 站内单色底口径)

站内单色底 = 两条垂直轴取更短的那条(见 `eo_cross.fixed1.W` 那格的 `noOverlay`:
定轴均值 7.531,真题 7.219)。

* 坐标:4 条底棱的有序位置(11,880)× 其余 8 条棱**按类**的排列 × 翻转字(2,048)
  ≈ **1.02×10¹⁰**,nibble ~5 GB
* 关键是那个类商空间:12 条棱按「不碰哪条轴」分 3 类各 4 条,`delta[piece][slot]`
  只依赖类 —— 这件事已经在 `core/packages/client/lib/eo-axis-dist.ts` 上证过并做成
  测试(纯 EO 那份,70,963,200 态)。带十字的这版是同一个想法多一层
* 写在哪:`dist_tracked` 塞不下(它的分量都是「盯住具体块」),另开
  `src/bin/dist_eo_cross_2axis.rs`

### E6 — EOLine 取最优(`eoline` / 站内口径)

* 一个底色两条线、六色底十二条线取最优 → 要读全部 12 条棱的位置与朝向:
  12!·2¹¹ = **9.81×10¹¹**。与六色底十字同一个量级,同一套走法
  (`dist_cross_6col` 的 6 次 BFS + AVX2 min-reduction)
* 那个 bin 跑 32s;这里多一个 2,048 倍的翻转维,内存是真问题,先估再写

### E7 — DR(`dr` / 站内口径)

* Kociemba 第一阶段那个坐标:2¹¹ × 3⁷ × C(12,4) = **2,217,093,120**,nibble 1.1 GB
* 一个底色只有一条轴 ⇒ 单 / 双色底那两格就是定轴这份;四 / 六色底是三条轴取最优,
  要三条轴联合(≈ 三次 BFS 后逐态取 min,与 `dist_cross_6col` 同构)
* 三个坐标(翻转字 / 角朝向 / 中层四棱位置)的转动表都是小表,`dist_tracked` 的
  分量再加两种(`CornerOri`、`SliceSet`)就能装下 —— 但要先找到一条能对的金标曲线,
  否则又是一条自证的数

### P2 / P3 / P4 — 伪 XXCross、伪基态 XCross、伪 F2LEO 十字

三个都是「与标准版同一个坐标,只换目标集」:

| 单元 | 坐标 | 目标集 |
|---|---:|---|
| P2 `pseudo_xxcross` 固定双槽 | 21,459,271,680 | 底面四个 D 偏移 |
| P3 `pseudo_xcross_pseudo_pair` 固定单槽 | 21,459,271,680 | D 偏移 × 插入公式(**口径未对齐,先修**) |
| P4 `pseudo_f2leo_cross` 站内口径 | 5,109,350,400 | F2LEO 十字目标集按四个 D 偏移闭包 |

E3 / E4 跑通之后,这三个是同一套代码换 `starts`。

---

## 回填清单(跑完一个就走这四步)

1. `counts` 那行填进 `exact_dist.ts` 对应的 `kind: 'full'` 格,`total` 用真实态数
2. 删掉该阶段在 `STAGE_PLAN` 里的兜底文案 —— 留着就是过期承诺
3. `pnpm --filter @cuberoot/client exec vitest run tests/scramble_exact_dist.test.ts`
   (那里有一条普查:full / zero 各多少格,数字变了要一起改,这是 review 信号)
4. 本文件把该单元从「待跑」移到「已跑完」,写上实测耗时与结果
