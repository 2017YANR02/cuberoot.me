# 1LLL 表 —— 待站长处理的问题清单

机器扫出来的,**每条都跑过 cubing.js**,不是猜的。判据 = §3 的 16 折轨道
(`U^a · A · U^b` 解同一个 case,所以「备选公式写在别的 U 朝向下」**不算错**)。

> 生成:`core/packages/alg-build/phase2_validate.mjs`。
> 背景和理论见 [`1lll-migration.md`](./1lll-migration.md),进度见 [`1lll-worklog.md`](./1lll-worklog.md)。

扫了 **5059** 条公式(3915 行的 `Self alg` 全部,含备选),**5034** 条正确。

| | 数量 |
|---|---|
| 公式不保 F2L(压根不是 LL 公式) | **4** |
| 公式解的是**别的 case** | **21** |
| 括号不配对 | **2** |
| 单元格开头多一个空格(把表自己的 `DELETE_AUF` 挡住了) | **1** |
| `Speedcubedb no.` 脏数据 | **7** |

---

## 1. 公式不保 F2L —— 压根不是 LL 公式

| Self | Name | 第几条 | 公式 | 本行还有几条对的 | 唯一单 token 修复 |
|---|---|---|---|---|---|
| 15 | PLL-Gb | alg[5] | `[oh] U R' UD' R y (R2 u R' U) (R U' R u') R2'` | 9 | 第 4 步 `D'` → `U2` |
| 1133 | F+L3 | alg[1] | `U' (R U R' U' R' F R F') U2 (R U R' U' M' U R U' R')` | 1 | 2 个候选,不唯一 |
| 1130 | F+L5 | alg[1] | `U' (R U R' U' R' F R F') (R U R' U' M' U R U' R')` | 1 | 2 个候选,不唯一 |
| 3048 | I3R5 | alg[0] **首条** | `U' F (r U r' U' r U2 r') U' (R U2 R' U') (r U r' F')` | 0 | 第 6 步 `U'` → `U` |

## 2. 公式解的是别的 case

⚠ **9 条是「正确地镜像了一条本身就错位的公式」** —— 镜像生成器没问题,喂给它的源行错了。
`3419/O-U8` 和 `3347/O+U9` 互为**逐字正确**的镜像,却双双错位:错发生在**被镜像之前**。

| Self | Name | 第几条 | 本行应当是 | 这条其实解的是 | 公式 | 本行还有几条对的 |
|---|---|---|---|---|---|---|
| 13 | PLL-Ga | alg[3] | pll/Ga | **14/PLL-Gc** | `U2 (R2' U' R U') (R U R' U) R2 UD' (R U' R' D)` | 7 |
| 1 | PLL-U+ | alg[0] **首条** | pll/Ub | **2/PLL-U-** | `L2 U' S U2' S' U' L2` | 9 |
| 193 | LF9 | alg[1] | zbll/ZBLL L 34 | **2036/W-F8** | `(L' U' L U') (L' U L U) (L F' L' F)` | 2 |
| 205 | LR9 | alg[1] | zbll/ZBLL L 22 | **2108/W+R9** | `(R U R' U) (R U' R' U') (R' F R F')` | 1 |
| 701 | DLR6 | alg[0] **首条** | 1lll/1LLL 17 38 | **686/DLFB** | `U' (R U R' F') U (R' U' F' U F R) U2 F R U' R'` | 0 |
| 698 | DLRB | alg[0] **首条** | 1lll/1LLL 17 26 | **689/DLF5** | `U2 R' F' D (R2 U2' R2' D') F2 (R U' R' F' R)` | 0 |
| 911 | DS+F1 | alg[0] **首条** | 1lll/1LLL 3 44 | **912/DS+F8** | `U2 r' U' (R' F2 R2 U' R' U2) r U' r' F r` | 0 |
| 916 | DS+F9 | alg[0] **首条** | 1lll/1LLL 3 48 | **3829/L+B4** | `U (F R U' R' U' R U R') (F2 r U r' U' r' F r)` | 0 |
| 545 | DTB1 | alg[0] **首条** | 1lll/1LLL 19 29 | **1447/T2B1** | `U' (R' F R U) (R' F' R U2') (R F R' U) R F' R'` | 0 |
| 580 | DTR5 | alg[0] **首条** | 1lll/1LLL 19 62 | **566/DTLA** | `U F (R U' R' U') (F R U R' U' F') (R U R' F')` | 0 |
| 578 | DTRA | alg[0] **首条** | 1lll/1LLL 19 50 | **568/DTL5** | `U (L F' L' U' L) F2' (D' L2' U2 L2 D) F' L'` | 0 |
| 597 | DUU6 | alg[0] **首条** | 1lll/1LLL 18 9 | **104/UU9** | `(L U L' U L U2 L2) (U' L U' L' U2 L)` | 0 |
| 2569 | I4B6 | alg[0] **首条** | 1lll/1LLL 55 29 | **276/HB2** | `U2 (f R U R' U' S') (R U' R' U R U R' F')` | 0 |
| 2230 | K2B1 | alg[0] **首条** | 1lll/1LLL 37 50 | **2242/K2L1** | `(R U R' U') R' F (R2 U' R' U) (R U R' F')` | 2 |
| 3280 | M-U1 | alg[0] **首条** | 1lll/1LLL 12 12 | **3419/O-U8** | `U2 (R B U B' U' R') (F U R U' R' F')` | 0 |
| 3613 | N-L4 | alg[0] **首条** | 1lll/1LLL 8 57 | **3302/M-B4** | `U2 (l' U' L U') L2' D' (L U2' L' D) L l` | 1 |
| 3563 | N-U9 | alg[0] **首条** | 1lll/1LLL 8 7 | **3568/N-U3** | `U (f' L' U' L U f) (L' U' B' U B L)` | 1 |
| 3514 | N+FA | alg[0] **首条** | 1lll/1LLL 7 30 | **3835/L+F8** | `U (L2' D' L U2' L' D L U2' L) (F' L' U' L U F)` | 0 |
| 3496 | N+U3 | alg[0] **首条** | 1lll/1LLL 7 7 | **3491/N+U9** | `(R U B U' B' R') (F U R U' R' F')` | 0 |
| 3419 | O-U8 | alg[0] **首条** | 1lll/1LLL 6 7 | **3280/M-U1** | `U2 (R B U B' U' R') (f U R U' R' f')` | 0 |
| 3347 | O+U9 | alg[0] **首条** | 1lll/1LLL 5 4 | **3208/M+U1** | `U2 (L' B' U' B U L) (f' U' L' U L f)` | 1 |

## 3. 括号不配对

两行都**不带重复指数**,丢掉括号照常解析,不影响 case 身份 —— 但表该修。

| Self | Name | 毛病 | 公式 |
|---|---|---|---|
| 13 | PLL-Ga | 括号不配对(少一个 ")") | `[oh] U2 R2 U (R' U R' U') (R U' R2 U'D) (R' U R u'` |
| 1465 | C1U6 | 括号不配对(多出一个 ")") | `(F R U R' U') (R U R' F2) r U r2' F r)` |

## 4. `71 / TLA` —— 单元格开头多了一个空格

```
" U' (M2' U M2' U2 M2' U M)(R U R' U' r' F R F')"
  ↑ 这里
```

表的 `DELETE_AUF` 是 `TRIM(REGEXREPLACE(alg, "^U2'?|^U'|^U", ""))` —— **正则跑在 `TRIM` 之前**,
`^U'` 被那个空格挡住没匹配上,起手 AUF 没被剥掉。所以这一行的 `SH` / `SQ` 是 **16 / 20**,
真值是 **15 / 19**。公式本身没问题,删掉那个空格即可。

## 5. `Speedcubedb no.` 脏数据

该列非空 **472** 行(= ZBLL 总数 472,与表的 `Stat` sheet 一致)。
状态轨道 join **反而把这些纠正了** —— 报出来供你回填。

| Self | Name | 表里填的 | 实际(按状态定的) |
|---|---|---|---|
| 216 | LB2 | `L04` | ZBLL L 41 |
| 236 | LL7 | `L` | ZBLL L 1 |
| 227 | LL9 | `L` | ZBLL L 5 |
| 238 | LLA | `L` | ZBLL L 8 |
| 232 | LLB | `L` | ZBLL L 11 |
| 352 | S+U3 | `S+06` | ZBLL S 67 |
| 424 | S-U3 | `S-06` | ZBLL AS 68 |

## 6. 这些**不是**问题(免得来回改)

- **`R4` / `L4'` / `R3`** —— 群元素是恒等 / 是 `R'`,但它们是**真实的物理动作**,
  对指法、手部动画、TPS 都算数。计步照写照算(`L4'` = 1 STM / 4 SQTM)。**保留。**
- **备选公式写在别的 U 朝向下** —— `U^a · A · U^b` 解同一个 case,16 折轨道天然吸收。
- **42 对镜像只差一个起手 AUF** —— 前 AUF 在轨道内,同 case,合法。
- **署名 `(by CubeRoot 251029)` / `(wyh)`** —— 导入时直接丢弃(你 2026-07-13 拍的板)。

---

## 元数据层:干净得出奇

`Mirror` / `Inv` / `IM` 三个编号列是**完美的群作用**:

| | |
|---|---|
| Mirror 是对合 | 3915 / 3915 |
| Inv 是对合 | 3915 / 3915 |
| `IM == Inv∘Mirror == Mirror∘Inv` | 3915 / 3915,零不一致 |

剔掉上面那些坏公式之后,INV / MIRROR / IM 三个关系的**残差为零**。
