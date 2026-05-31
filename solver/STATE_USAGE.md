# STATE_USAGE

3 个 state/scramble 输出工具,从 `D:\cube\solver_wip\.skipped-not-dist\` 移植。
这些不是 analyzer(不读 scramble 文件),而是**枚举工具**:给定深度,把该深度
所有合法状态对应的 scramble 公式列出来,供后续训练/分析用。

## 共同点

- 不读输入。直接跑 BFS / IDA*,把结果落盘到**当前工作目录**。
- 都有 self-check:抽样 apply 输出的 scramble 反推状态,断言与目标 idx 一致。
  + count bit-exact vs cpp golden。
- 都自动 ensure 需要的表,首次会生成(`./tables/` 下,可 `CUBE_TABLE_DIR=`
  覆盖)。
- LF 输出,UTF-8 无 BOM。

## 构建

```powershell
cargo build --release --bin state_cross_1col --bin state_cross_2col --bin state_xcross_1col_fixed_10f
```

产出 3 个 binary 在 `target/release/`。

---

## 1. `state_cross_1col` — 单色 cross 各深度 scramble

**输出**:`1.txt` ... `8.txt`(8 个文件),每行一条 scramble,solved → state
方向,空格分隔。

| depth | 行数 |
|---:|---:|
| 1 | 15 |
| 2 | 158 |
| 3 | 1,394 |
| 4 | 9,809 |
| 5 | 46,381 |
| 6 | 97,254 |
| 7 | 34,966 |
| 8 | 102 |
| **total** | **190,079** |

**算法**:BFS over 190,080 cross 状态(`mt_edge4`,17 MB),记录 parent +
move,回溯出 scramble。

**性能**:总 0.07s(BFS 30ms,写盘 35ms)。

**示例**:

```powershell
mkdir out_cross_1col -Force; cd out_cross_1col
..\target\release\state_cross_1col.exe
# 产出 1.txt..8.txt
Get-Content 1.txt -First 3
# L
# L'
# L2
```

**依赖表**:`mt_edge4`(17 MB,首次几秒生成)。

---

## 2. `state_cross_2col` — 双色 (W+Y) cross d=8 scramble

**输出**:`cross_2_col_state.txt`,3672 行,`<n>. <scramble>` 格式
(scramble 9-11 步)。

**算法**:
1. BFS 白色 cross + 黄色 cross 距离表(各 190 KB)
2. 枚举所有 (W_idx, Y_idx) where W_d=8 AND Y_d=8 AND 棱位 mask 不相交
   → 3672 对
3. 每对跑 IDA* 在 (W_idx, Y_idx) 联合空间,启发式 = max(W_d, Y_d),
   终止 = "两色 cross 都解开"(h==0)
4. 输出 inverse(path) = solved → state 的 scramble

**注意**:cpp 实现用 max heuristic,语义是"两色都解",scramble 长度可 >8。
与 `dist_cross_2col` 的 `min(W_d, Y_d)` 定义不同。Rust 直译 cpp 逻辑。

**性能**:1.5s(cpp 30s,20x 加速,rayon 并行)。

**示例**:

```powershell
mkdir out_cross_2col -Force; cd out_cross_2col
..\target\release\state_cross_2col.exe
# 产出 cross_2_col_state.txt
Get-Content cross_2_col_state.txt -First 3
# 1. U F' R D L D2 U2 B' F' D
# 2. U F' R D L D2 U2 B' D F'
# 3. B R L B' F R2 U' L' F2 D'
```

**依赖表**:`mt_edge4`(17 MB)。

---

## 3. `state_xcross_1col_fixed_10f` — 固定 BL 槽 XCross 各深度 scramble

**输出**:`1.txt` ... `10.txt`(10 个文件),每行一条 scramble,solved → state。

| depth | 行数 |
|---:|---:|
| 1 | 15 |
| 2 | 172 |
| 3 | 1,950 |
| 4 | 21,535 |
| 5 | 220,368 |
| 6 | 1,989,591 |
| 7 | 13,431,990 |
| 8 | 40,963,892 |
| 9 | 16,325,184 |
| 10 | 36,022 |
| **total** | **72,990,719** |

**算法**:单线程 BFS over (cross × DBL corner × BL edge) = 190,080 × 24 × 24
= 109,486,080 状态。三个 109 MB / 437 MB / 109 MB 数组(visited / parent /
move-from-parent),总 ~650 MB RAM。

**性能**:总 55s(BFS 28s + 写盘 27s)。写盘约 1 GB 数据。

**示例**:

```powershell
mkdir out_xcross_fixed -Force; cd out_xcross_fixed
..\target\release\state_xcross_1col_fixed_10f.exe
# 产出 1.txt..10.txt,总 73M 行,~1 GB 数据
Get-Content 10.txt -First 3
# D L' U' R D R F' L R F'
# D R' F2 R' D L2 R F L' U
# D L U B' L2 F' D2 L2 U B'
```

**依赖表**:`mt_edge`(7 KB)、`mt_corn`(2 KB)、`mt_edge4`(17 MB)。

---

## 跳过未移植的 7 个

| cpp 项目 | 跳过理由 |
|---|---|
| `xcross_1_col_10f` | cpp 自己说"里面混入了很多不是10步的",无可信 golden |
| `xcross_2_col_10f` | 仅输出 d=10 count(20,230,604),已被 `dist_xcross_2col` 覆盖 |
| `xcross_2_col_10f_state` | 输出 20M 实际状态,cpp 用 2×109 MB pruning 表 + 全状态枚举,工程量大 |
| `xcross_6_col_10f_state` | cpp 端 6 色 xcross 整体存疑(v5/v6/v7 都有 bug)|
| `xxcross_1_col_12f` | cpp 用 2×21 GB pruning 表,32 GB 机器跑不动 |
| `xxcross_1_col_fixed_12f_state` | 21 B state space + parent tracking 需 ~100 GB RAM |
| `xxcross_2_col_12f` | 同 `xxcross_1_col_12f`,2×21 GB |

详细决策见 `CLAUDE.md`。

---

## scramble 的"方向"约定

| 方向 | 含义 |
|---|---|
| solved → state | 把已解魔方按 scramble 公式转,得到目标 cross/xcross 状态 |
| state → solved | scramble 公式的逆,把目标状态还原回 solved |

**3 个 bin 都输出 solved → state 方向的 scramble**(与 cpp 一致)。
要把它当"解法"用,自己取逆即可(每步 U↔U'、U2 不变)。

---

## 校验

每个 bin 跑完会打印:

```text
[OK] depth counts bit-exact vs cpp golden    # state_xcross_1col_fixed_10f / state_cross_1col
[OK] scramble self-check passed (NN samples) # 三个都有
```

count 与 cpp golden line 数完全一致(state_cross_2col 跟 cpp 30s 跑的 stdout
结果对照 3672 行)。self-check 抽 50-100 个样本,apply scramble 反推状态/idx
确认正确。

---

## 与 `dist_*` / analyzer 的区别

| 工具家族 | 输入 | 输出 | 用途 |
|---|---|---|---|
| **analyzer** (`std_analyzer` 等) | scramble 文件 | CSV(每个 scramble 各阶段最短步数) | 给已有 scramble 算 metric |
| **dist_*** | 无 | 各深度的状态计数 | 状态空间分布统计 |
| **state_*** | 无 | 各深度所有状态对应的 scramble | 枚举特定深度状态供训练/分析 |

跑 analyzer 看 `USAGE.md`;跑 dist 看 `CLAUDE.md` 文件地图,直接
`.\target\release\dist_<name>.exe`,大多数 1s 内跑完。
