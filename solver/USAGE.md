# USAGE

三阶魔方 Cross / F2L 阶段最优解分析器,5 个 binary 可独立运行。

## 1. 构建

在 `solver/` 运行：

```sh
cargo build --release
```

产出 6 个 binary:`table_generator`、`std_analyzer`、`pseudo_analyzer`、`pair_analyzer`、`eo_cross_analyzer`、`pseudo_pair_analyzer`,在 `target/release/`。

## 2. 生成表(首次必跑)

```sh
cargo run --release --bin table_generator
```

- 默认档顺序生成 12 张 mt 表 + 61 张 pt 表，约 36 GB；高内存档额外生成 EO 5 张、SQ1 精确表与 H48 h10。实际空间、内存和本机验收见 [HIGH_MEMORY_TABLE_PROFILE.md](HIGH_MEMORY_TABLE_PROFILE.md)。
- 默认放 `./tables/`，可用 `CUBE_TABLE_DIR` 环境变量覆盖；已完成的表会跳过。
- 只补某类表时仍用同一个 binary，例如 `cargo run --release --bin table_generator -- --only h48-h10`；可选目标为 `rust`、`sq1`、`h48-h7`、`h48-h10`。`CUBE_DISABLE_HUGE_TABLES=1` 会跳过大表，不能用于完整统计所需的表集。

各 analyzer 自身也会在启动时自动生成缺的表(懒加载),但推荐先全跑一次,避免运行时等待。

## 3. 跑 analyzer

所有 analyzer 都是 **stdin 交互**:输入文件名,处理,输出 `<name>_<suffix>.csv` 同目录。

### 输入格式

每行一条任务,`id,scramble`(逗号分隔)或纯 `scramble`:

```text
22001,B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F' U2 B
23001,D2 U L2 B2 R2 F2 R2 U2 R2 D' R' D B2 U B' R B' D B' L'
```

### 输出

CSV,每行 `id` + 数据列(各 analyzer 列数不同,见下表)。

### 通用调用

```sh
printf '%s\n' 'scramble_1000.txt' | ./target/release/std_analyzer
# 处理完输出 scramble_1000_<suffix>.csv 同目录
```

交互模式输入 `exit` 退出；macOS/Linux 可用 Ctrl-D 结束输入，Windows 可用 Ctrl-Z。

## 4. 五个 analyzer

| binary | suffix | 列数 | 阶段 | 启动要求 |
|---|---|---|---|---|
| `std_analyzer` | `_std` | 31 | Cross / XCross (XXC+ 占位 0) | 默认即可;`CUBE_RUN_FULL_STD=1` 开 XCross |
| `pseudo_analyzer` | `_pseudo` | 25 | PsCross / PsXC / PsXXC / PsXXXC | 默认前 3 阶段;`CUBE_ALLOW_HUGE_TABLES=1` 开 PsXXXC |
| `pair_analyzer` | `_pair` | 25 | Cross+Pair / XC+Pair / XXC+Pair / XXXC+Pair | 必须 `CUBE_ALLOW_HUGE_TABLES=1` |
| `eo_cross_analyzer` | `_eo` | 31 | EO 5 阶段(Cross / XC / XXC / XXXC / XXXXC) | 必须 `CUBE_ALLOW_HUGE_TABLES=1` |
| `pseudo_pair_analyzer` | `_pseudo_pair` | 25 | PsCross+PsPair 4 阶段 | 必须 `CUBE_ALLOW_HUGE_TABLES=1` |

列编排:`id` + 各阶段 6 个视角 (`_z0/_z2/_z3/_z1/_x3/_x1`,对应 cube 6 面)。`pair_analyzer` 第一列叫 `scramble` 不是 `id`(跟 C++ 对齐)。

## 5. 环境变量

| 变量 | 作用 |
|---|---|
| `CUBE_TABLE_DIR=<path>` | 覆盖默认表目录 `./tables/` |
| `CUBE_ALLOW_HUGE_TABLES=1` | 解锁 ≥800 MB 的 5 张表(`mt_edge6`/`pt_cross_C4C5E0E1`/`pt_cross_C4C6E0E2`/`pt_pscross_E0E1E2`/`pt_pscross_C4C5C6`) |
| `CUBE_DISABLE_HUGE_TABLES=1` | (仅 `table_generator`)跳过 huge 表生成 |
| `CUBE_RUN_FULL_STD=1` | `std_analyzer` 启用 XCross |
| `CUBE_PSEUDO_SKIP_XCROSS=1` | `pseudo_analyzer` 跳过 PsXC + 下游 |
| `CUBE_PSEUDO_SKIP_XXCROSS=1` | 跳过 PsXXC + 下游 |
| `CUBE_PSEUDO_SKIP_XXXCROSS=1` | 跳过 PsXXXC |
| `CUBE_PAIR_NO_DIAG=1` | `pair_analyzer` 跳过 `pt_cross_C4C6E0E2`(省 10 GB,对角槽位剪枝退化) |
| `CUBE_EO_NO_DIAG=1` | `eo_cross_analyzer` 同上 |

## 6. 示例

```sh
# 1. 从 solver/ 用统一入口生成当前机器档位的表
cargo run --release --bin table_generator

# 2. 用 std_analyzer 跑 Cross+XCross
CUBE_RUN_FULL_STD=1 ./target/release/std_analyzer <<<'testdata/scramble_5.txt'

# 3. 用 pseudo_analyzer 跑全 4 阶段
CUBE_ALLOW_HUGE_TABLES=1 ./target/release/pseudo_analyzer <<<'testdata/scramble_5.txt'

# 4. 用 eo_cross_analyzer 跑 EO 5 阶段(无 diagonal,省 10GB)
CUBE_ALLOW_HUGE_TABLES=1 CUBE_EO_NO_DIAG=1 ./target/release/eo_cross_analyzer <<<'testdata/scramble_5.txt'
```

输出 `scramble_5_std.csv` / `scramble_5_pseudo.csv` / `scramble_5_eo.csv` 在当前目录。

## 7. 性能 / 资源

- **磁盘 / 建表内存**:按所选 profile 与表集变化；以 [HIGH_MEMORY_TABLE_PROFILE.md](HIGH_MEMORY_TABLE_PROFILE.md) 的实测和警戒线为准。
- **并行**:CSV 内多任务用 rayon 自动多核;搜索内层 IDA* 单线程
- **首次冷启动**:先用统一 `table_generator` 生成所需表；不要沿用旧机器的耗时估计。
- **二次启动**:表 mmap reload 秒级,主要耗时是搜索本身(几秒到几十秒/scramble)

## 8. 故障排查

| 症状 | 原因 | 解决 |
|---|---|---|
| panic `huge table requires CUBE_ALLOW_HUGE_TABLES=1` | 分析器需要大表开关 | 运行该分析器时设置 `CUBE_ALLOW_HUGE_TABLES=1` |
| binary 启动直接 `[ERROR] requires CUBE_ALLOW_HUGE_TABLES=1` | pair / eo_cross / pseudo_pair 强制要 huge | 同上 |
| 表损坏 / magic mismatch | 表可能与当前格式不兼容 | 核对表路径与格式；确认损坏后只重建受影响的表，别清空整个表目录 |
| 磁盘满 | huge 表占盘 | `CUBE_DISABLE_HUGE_TABLES=1` 生成精简版,或换 `CUBE_TABLE_DIR` 到大盘 |

## 9. 参考

- `README.md`:进度表 + 路线图
- `PORTING_NOTES.md`:每个 phase 的设计决策、C++ 端歧义、与 C++ 差异
- `AGENTS.md`:文件地图 + 缩写约定 + 工程规矩
- C++ 源:`D:\cube\solver\`(只读参考)
- Golden:`D:\cube\solver\golden\scramble_1000_{std,pseudo,pair,pseudo_pair,eo}.txt`
