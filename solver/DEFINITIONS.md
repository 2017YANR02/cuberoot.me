# DEFINITIONS

魔方块编码、槽位、各 analyzer 阶段语义的权威定义。移植自上游
`D:\cube\solver\README.md`,使 Rust 仓库**自包含**,无需回查 C++ 工程。

> 数值口径与 C++ 严格一致;golden 测试夹具见 `testdata/golden/scramble_20_*.csv`。

## 块编码

- 角块状态值 = `3 * idx + ori`,`ori ∈ {0,1,2}`
- 棱块状态值 = `2 * idx + ori`,`ori ∈ {0,1}`

### 角块

| 索引 idx | 物理 ID | 初始位置 | 初始状态值 (ori=0) |
|---:|:--|:--|---:|
| 0 | C0 | UBL | 0 |
| 1 | C1 | UBR | 3 |
| 2 | C2 | UFR | 6 |
| 3 | C3 | UFL | 9 |
| 4 | C4 | DBL | 12 |
| 5 | C5 | DBR | 15 |
| 6 | C6 | DFR | 18 |
| 7 | C7 | DFL | 21 |

C4 C5 C6 C7 是 F2L 角块;C4 C5 是目标槽位(BL/BR)的 F2L 角块。

### 棱块

| 索引 idx | 物理 ID | 初始位置 | 初始状态值 (ori=0) |
|---:|:--|:--|---:|
| 0 | E0 | BL | 0 |
| 1 | E1 | BR | 2 |
| 2 | E2 | FR | 4 |
| 3 | E3 | FL | 6 |
| 4 | E4 | UB | 8 |
| 5 | E5 | UR | 10 |
| 6 | E6 | UF | 12 |
| 7 | E7 | UL | 14 |
| 8 | E8 | DB | 16 |
| 9 | E9 | DR | 18 |
| 10 | E10 | DF | 20 |
| 11 | E11 | DL | 22 |

E0 E1 E2 E3 是 F2L 棱块;E0 E1 是目标槽位(BL/BR)的 F2L 棱块;
E8 E9 E10 E11 是组成 cross 的棱块。

### 槽位

| Slot | 位置 | 组成 |
|---:|:--|:--|
| 0 (Base) | BL | C4 + E0 |
| 1 | BR | C5 + E1 |
| 2 | FR | C6 + E2 |
| 3 | FL | C7 + E3 |

F2L 4 槽是一个环:相邻对 4 个 {0,1} {1,2} {2,3} {3,0},对角对 2 个 {0,2} {1,3},
合计 C(4,2)=6 对。

### 角块位置图

```
              +-------+
              | 0   1 |
              |   U   |
              | 3   2 |
      +-------+-------+-------+-------+
      | 0   3 | 3   2 | 2   1 | 1   0 |
      |   L   |   F   |   R   |   B   |
      | 4   7 | 7   6 | 6   5 | 5   4 |
      +-------+-------+-------+-------+
              | 7   6 |
              |   D   |
              | 4   5 |
              +-------+
```

### 棱块位置图

```
              +-------+
              |   4   |
              | 7 U 5 |
              |   6   |
      +-------+-------+-------+-------+
      |   7   |   6   |   5   |   4   |
      | 0 L 3 | 3 F 2 | 2 R 1 | 1 B 0 |
      |   11  |   10  |   9   |   8   |
      +-------+-------+-------+-------+
              |   10  |
              | 11 D 9|
              |   8   |
              +-------+
```

## 索引约定对照(踩坑预警)

本仓库**同时**承载两个上游工程的代码,二者棱块索引约定**不同**,移植 dist 系列时
极易混淆:

| 来源 | 0..3 含义 | 用在 |
|:--|:--|:--|
| `D:\cube\solver`(solver 系列) = `cube_common` | **F2L 棱**(E0=BL..E3=FL),8..11=cross 棱 | 6 个 analyzer + `cross_solver` / `xcross_solver` 等 |
| `D:\cube\solver_wip`(dist 系列) | **U 层棱** | `dist_*` / `state_*` 的 cpp 原文 |

→ 上表(角/棱/槽)是 **solver = cube_common** 的约定。移植 `dist_*` 时,cpp 源里的
`0..3` 是 U 层,**不要**直接套用本文件的 F2L 编号。详见 memory
`project_position_index_convention`。

## Std Analyzer

计算 cross / xcross / xxcross / xxxcross / xxxxcross 的最少步。

| 阶段 | 定义 |
|:--|:--|
| Cross | 底层 4 个十字棱块 (E8 E9 E10 E11) 还原 |
| XCross | Cross + 1 组 F2L |
| XXCross | Cross + 2 组 F2L |
| XXXCross | Cross + 3 组 F2L |
| XXXXCross | Cross + 4 组 F2L(= 完整 F2L) |

## Pseudo Analyzer

### Pseudo Cross

底层 4 个十字棱块相对彼此位置/色向正确(形成十字),但允许该十字整体相对固定中心
存在 D 层偏移。**特征**:Cross 处于 Solved / D / D' / D2 之一。

### Pseudo XCross / XXCross / XXXCross

Pseudo Cross + N 个底层角块 + N 个中层棱块:

| 阶段 | 角块选择 | 棱块选择 | 目标状态数 |
|:--|:--|:--|:--|
| Pseudo XCross | C(4,1)=4 | C(4,1)=4 | 16 |
| Pseudo XXCross | C(4,2)=6 | C(4,2)=6 | 36 |
| Pseudo XXXCross | C(4,3)=4 | C(4,3)=4 | 16 |

### 非匹配性 / 索引独立

选定角块的物理 ID 集合与选定棱块的物理 ID 集合**无需一致**。例如 Pseudo XXCross
里"角块 {0,1}"可搭配"棱块 {2,3}"。系统只关心选定的 N 个角块和 N 个棱块是否分别
归位,不强制它们组成传统 F2L Pair。

### 位置相对性(参考系解耦)

1. **角块 → 伪位**:相对 **Pseudo Cross 当前位置**复原。Cross 整体做了 D 偏移,
   目标角块也必须处于偏移后的物理位置。
2. **棱块 → 固定位**:相对 **固定中心**复原。中层棱块 (E0-E3) 不随 D 偏移,必须
   归位到真实物理槽位。

### 独立性

角块复原态与棱块复原态视为两个**正交**维度:只要选定角块满足"伪位归位"、选定棱块
满足"固定位归位",即达成 Pseudo X..XC,不考虑它们空间上是否相邻/匹配。

## Pair Analyzer

### Pair

由**相同槽位**的 F2L 棱块和 F2L 角块组成的棱角对称为 Pair,当且仅当:该棱角对可通过
Setup(调整 U 层)+ Insert(插入)的转动组合,进入目标槽位并还原。

- Setup:NULL / U / U2 / U'
- Insert(以 BL 槽为例):NULL / `L U L'` / `L U' L'` / `B' U B` / `B' U' B`
  - 其他槽位(BR/FR/FL)用相应对称/镜像公式

### 阶段

| 阶段 | 定义 |
|:--|:--|
| Cross + Pair | Cross 已还原,剩余 4 个 F2L 槽中存在 Pair |
| XCross + Pair | Cross + 1 槽已还原,剩余 3 槽中存在 Pair |
| XXCross + Pair | Cross + 2 槽已还原,剩余 2 槽中存在 Pair |
| XXXCross + Pair | Cross + 3 槽已还原,剩余槽中存在 Pair |

## Pseudo Pair Analyzer

### Pseudo Pair

由**任意两个非绑定**的 F2L 棱块和角块组成的棱角对称为 Pseudo Pair,当且仅当:该对
可通过 Setup + Insert,使**棱块进固定位**并还原、**角块进伪位**并还原。

- 坐标系:允许 Cross 处于 D/D'/D2 偏移(继承 Pseudo Analyzer)
- 配对规则:完全解耦,棱 E 与角 C 不需来自同一物理槽(如 FR 的棱配 BL 的角)
- 归位标准:棱块对齐绝对中心,角块对齐偏移后的 Cross
- 目标:寻找 **Pseudo Pair 就绪**态 —— 当前状态经 Setup(U)+Insert 能立刻满足上述
  Pseudo 归位标准(非寻找"已归位")
- Setup / Insert 公式同 Pair Analyzer

### 阶段

Pseudo Cross / XCross / XXCross / XXXCross + Pseudo Pair(语义同上,前缀阶段递进)。

## EO Cross Analyzer

计算下列 4(+1) 阶段最少步:

| 阶段 | 定义 |
|:--|:--|
| EO + Cross | Cross 已还原,剩余 8 棱色向正确 |
| EO + XCross | XCross 已还原,剩余 7 棱色向正确 |
| EO + XXCross | XXCross 已还原,剩余 6 棱色向正确 |
| EO + XXXCross | XXXCross 已还原,剩余 5 棱色向正确 |
| EO + XXXXCross | XXXXCross 已还原,剩余 4 棱色向正确 |

颜色中性(Color Neutrality)通过 **12 个对称状态**模拟并压缩计算量:

- 轴向覆盖:6 个面作底面(U D L R F B)
- 状态归约:每轴向测 2 个姿态(原始 + y 轴旋转)
- 输出:每对状态(同底面 2 视角)取 `min`,输出该底面轴向最优步数

## 旋转列与后缀

6 个旋转视角(对应 CSV 列后缀):

| rot | `""` | `z2` | `z'` | `z` | `x'` | `x` |
|:--|:--|:--|:--|:--|:--|:--|
| 后缀 | `_z0` | `_z2` | `_z3` | `_z1` | `_x3` | `_x1` |

## 缩写

见 `CLAUDE.md` 的"缩写约定"(sz/ed/cn/cr/ps/ins/ex/mt/pt/adj/diag)。
