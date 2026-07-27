# 表格移植 逐项复核表

`docs/xlsx-stats-port.md` 是**做的时候**的工程记录(按单元组织);这份是**验收时**用的清单
(按页面组织)。一项一行,给到:表格里的原始位置、站上的确切网址、我们到底是搬运还是重算、
怎么验的,最后留一格给复核结论。

打开方式:所有网址直接粘进浏览器即可,页面状态全在 query 里。

记号:

- **复算** = 站内自己把这个数算出来了,表格只当对照;数值写死在代码里的,配了测试每次跑重算一遍。
- **搬运** = 我们算不动,原样引用,页面上标「未证」并写明出处。
- ✅ 表格与我们一致 / ⚠️ 表格错了(页面用我们的值)/ ❓ 口径不明,未采纳。

---

## 页面 1 `/scramble/stats` 打乱统计

三阶各阶段的步数分布。表格 `3x3.xlsx` 的 `dist` 页几乎整页都对应到这一个页面。

| # | 内容 | 表格出处 | 网址 | 我们做了什么 | 结论 | 复核 |
|---|---|---|---|---|---|---|
| S1 | 整解 0..20 最优步数分布 | `3x3.xlsx` `dist!A9:E29`,均值 `A30` = 17.88531632 | [/zh/scramble/stats?variant=333&stage=333](https://cuberoot.me/zh/scramble/stats?variant=333&stage=333) | 计数不是从表格抄的,收敛到 `lib/god-distance-333.ts` 单一源(d ≤ 15 穷举精确、16..19 上游只给两位有效数字标 ≈、20 是下界标 ≥)。真题那 131 万条的柱子是本站现算 | ⚠️ 表格的均值 17.885 算错了(见下「S1 备注」),站上是 17.70,真题实测 17.71 | [ ] |
| S2 | 单色底 Cross 分布 | `dist!A94:B102`,均值 `A103` = 5.812058081 | [?set=exact&stage=cross&colors=Y](https://cuberoot.me/zh/scramble/stats?set=exact&variant=std&stage=cross&colors=Y) | 复算(Rust 穷举 190,080 全空间,早于本次移植就有) | ✅ 九档逐位一致 | [ ] |
| S3 | 双色底 Cross | `dist!A118:B126`,均值 `A127` = 5.387206484 | [?colors=WY](https://cuberoot.me/zh/scramble/stats?set=exact&variant=std&stage=cross&colors=WY) | 复算 | ✅ | [ ] |
| S4 | 六色底 Cross | `dist!A106:B114`,均值 `A115` = 4.809458647 | [?colors=BGORWY](https://cuberoot.me/zh/scramble/stats?set=exact&variant=std&stage=cross&colors=BGORWY) | 复算 | ✅ | [ ] |
| S5 | 四色底 Cross | `dist!A130:B138`(表头写 `all but opp cross`),均值 `A139` = 5.01943319 | [?colors=BGOR](https://cuberoot.me/zh/scramble/stats?set=exact&variant=std&stage=cross&colors=BGOR) | **复算**:solver 的单面 BFS 加 `--faces` 参数,全空间 980,995,276,800 逐状态取 min,约 35 秒。三种取法(LRFB / UDFB / UDLR)各跑一遍,九档全同 | ✅ 九个计数与表格逐位相同 | [ ] |
| S6 | 伪十字分布(四个底色档) | `dist!A82:B90`,合计 49,848,均值 `A91` = 5.385933237 | [?variant=pseudo&stage=pseudo_cross&colors=Y](https://cuberoot.me/zh/scramble/stats?set=exact&variant=pseudo&stage=pseudo_cross&colors=Y) | **复算**:JS BFS + solver `--pseudo`,四个底色档全跑 | ⚠️ 表格那条从第 4 档起就不对,合计 49,848 也不是任何一个轨道数;拿 131 万条真题当裁判,我们的偏差 0.076 个百分点、表格的 0.98 | [ ] |
| S7 | EOCross(固定轴)分布 | `dist!A157:B167`(表头 `fixed eocross (fixed orientation)`),均值 `A168` = 7.530829494 | [?variant=eo&stage=eo_cross&colors=Y](https://cuberoot.me/zh/scramble/stats?set=exact&variant=eo&stage=eo_cross&colors=Y) | **复算**:纯 TS BFS 全部 24,330,240 个态,约 7 秒 | ✅ 十一档逐位一致,均值 9 位小数也一致 | [ ] |
| S8 | `EOFC` 那张表的分母 212,889,530 | `dist!B152` | 同上页面(该格图下那句注) | 只做了结论:那一列自己加起来是 212,889,**600**(= 190,080 × 1,120),累积列因此溢到 1.000000329 | ⚠️ 是笔误,少写 70;`EOFC` 具体是哪个阶段仍不明,没搬 | [ ] |
| S9 | 各阶段平均步数表(算不动的那几格) | `3x3.xlsx` `stat` 页 `B3:F6` | 任一精确集页面下方的**覆盖矩阵**,如 [?set=exact&stage=xxcross](https://cuberoot.me/zh/scramble/stats?set=exact&variant=std&stage=xxcross&colors=Y) | 重叠的八格先拿来验我们自己(七格对上);我们算不动的七格**搬运**进来,矩阵里显示成「均值 ≈ x 未证」 | ⚠️ 固定 BL 槽 XCross:我们 7.975721(该四舍五入成 7.98),表格写 7.97,少进一位 | [ ] |
| S10 | 覆盖矩阵四个「只有 0 步」的格 | `Cube Odds.xlsx` `3x3` 页各阶段 skip 列 | 同 S9 的矩阵 | 复算:四色底 XCross / XX / XXX / XXXX 的 0 步计数由容斥补齐(不用 solver) | ✅ 矩阵已无空格 | [ ] |

### S1 备注:表格那个 17.885 是怎么来的

`dist!A30` 写 17.88531632。它的算法是「每档计数 ÷ 43,252,003,274,489,856,000」——
但 d = 16..19 那四档是 cube20.org 的两位有效数字(1.1e18 / 1.2e19 / 2.9e19 / 1.5e18),
四舍五入之后**那一整列加起来是 |G| 的 1.0103 倍**。除以 |G| 而不是除以它自己的和,
均值就被抬高了 0.18 步。

本机核过一遍:

| 算法 | 均值 |
|---|---|
| 表格的算法(÷ |G|) | 17.885316 |
| 同一列 ÷ 它自己的和 | 17.702396 |
| 站上的算法(把四个近似档等比缩到尾部真值,总和恰为 \|G\|) | 17.702331 |
| 131 万条 WCA 真题实测 | 17.71 |

真题站在我们这边。

---

## 页面 2..4

`/math/probability`、`/math/god`、`/scramble/hardest` 的逐项表,等这一页复核完再列
—— 一次只看一页,免得对照到一半串行。

---

## 复核进度

- [ ] `/scramble/stats`(S1–S10)
- [ ] `/math/probability`
- [ ] `/math/god`
- [ ] `/scramble/hardest`
