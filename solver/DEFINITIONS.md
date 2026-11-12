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

## 磁盘表命名

三阶阶段自有剪枝表新增或改名时，以本节为命名事实源（维护者确认，2026-11-11）。
**按规范视角下的目标语义与具体块编号命名**，先从生成器的目标集合、坐标投影和
加载器核对，不按消费者名称、表大小、跟踪块数或算法实现猜名字。

- 剪枝表用 `pt_` 前缀、`.bin` 扩展名；语义段用小写和下划线，块编号用大写
  `C` / `E`。块列表中角在前、棱在后，各自按数字升序，每个块都写完整编号，
  连续块之间不加分隔符。例如 `C4C5E0E1`，不是角棱数量，也不是坐标数组的槽号。
- `cross` 已表示 E8、E9、E10、E11 全部归位；后缀只列额外块，不重复列十字棱。
  `pscross` 表示本文件定义的伪十字目标。没有完整十字目标的表不加这两个前缀。
  纯块归位表直接用 `pt_<块编号>.bin`；只有十字目标时可以用 `pt_cross.bin`。
- 无其他限定的 `C…E…` 表示这些块归位。仅要求指定棱朝向正确时保留 `eo`，
  如 `pt_cross_eo_E0E1E2E3`；Pair 就绪目标保留 `pair`，伪目标保留 `pscross`，
  不得与同一组块完全归位的表混用。新的目标语义先在本文件定义，再确定名称。
- 对称或旋转复用只列一份规范目标，不把所有共轭视角的块合并进名字。
  `stage`、`deep7`、`middle4`、`be3c2` 等阶段/数量简称不能替代块编号；
  `sym`、`compact`、nibble/bit 数、容量、版本实验标签不作为目标名称。
  对称压缩与坐标布局写在表格式/实现说明中；同语义但不兼容的编码须由格式版本
  或独立制品目录区分，不能因文件同名就覆盖或复用旧表。

| 文件名（省略 `.bin`） | 规范目标 |
| --- | --- |
| `pt_cross_C4E0` | 十字 + C4、E0 归位 |
| `pt_cross_C4C5E0E1` | 十字 + C4、C5、E0、E1 归位 |
| `pt_cross_C4C6E0E1E2` | 十字 + C4、C6、E0、E1、E2 归位（原 `pt_stage_deep7_sym`） |
| `pt_C4C5C6C7E0E1E2E3` | 四枚 F2L 角 + 四枚中层棱归位，无十字（原 `pt_stage_middle4_sym`） |
| `pt_C4C5C6C7E0E3E11` | 左块 C4、C7 / E0、E3、E11 + 对侧两角 C5、C6，无完整十字（原 `pt_f2b_be3c2`） |
| `pt_cross_eo_E0E1E2E3` | 十字归位 + E0–E3 朝向正确，不要求这四枚棱归位（原 `pt_f2leo_cross_compact`） |
| `pt_cross_pair_C4E0` | 十字归位 + C4、E0 Pair 就绪 |
| `pt_pscross_pair_C4E0` 至 `pt_pscross_pair_C4E3` | 伪十字 + C4 与指定棱的 Pseudo Pair 就绪，每种配对一表 |

此规范不把通用移动表 `mt_*` 的坐标维度改成物理块编号；例如 `mt_corn2`、
`mt_edge3` 仍分别表示两角、三棱坐标。外部 H48/Egg 及其他专用格式沿用各自契约，
不据此批量改名历史文件。

改名须同步生成器选择项、加载路径、资源预算清单、现用文件及其断点、
`/dev/solvers` 的 `TABLES` 和当前使用文档；仅改名时保持表内容、坐标和预算不变，
核对文件身份/大小/表头并更新受影响的本地程序。冻结源码、原始日志、基准及授权凭据
保留原样，以迁移记录关联新旧名称；不因改名重建表或重跑计算。

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

见 `AGENTS.md` 的"缩写约定"(sz/ed/cn/cr/ps/ins/ex/mt/pt/adj/diag)。
