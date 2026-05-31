# cube_solver (Rust 移植)

三阶魔方 Cross / F2L 阶段最优解分析器。Rust 移植自 `D:\cube\solver`(C++17)。

C++ 端的 6 个 analyzer + 表生成器已全部移植为 Rust,均 golden bit-exact。

块 / 槽 / 各阶段语义定义见 [DEFINITIONS.md](DEFINITIONS.md);移植设计决策见 PORTING_NOTES.md。

## 当前进度

| Analyzer        | 阶段           | 状态                          | 依赖表                                              |
|-----------------|----------------|-------------------------------|-----------------------------------------------------|
| std_analyzer    | Cross          | OK,默认可用                  | pt_cross 140 KB                                     |
| std_analyzer    | XCross         | OK,env CUBE_RUN_FULL_STD=1    | + pt_cross_C4E0 52 MB + mt_edge4 17 MB              |
| std_analyzer    | XXCross / XXXCross / XXXXCross | OK,**golden bit-exact**(前 20 scramble),env CUBE_RUN_FULL_STD=1 + CUBE_ALLOW_HUGE_TABLES=1 | + pt_cross_C4C5E0E1 + pt_cross_C4C6E0E2 (各 10 GB) + mt_edge6 3 GB |
| pseudo_analyzer | Cross          | OK,默认可用                  | pt_pscross 140 KB                                   |
| pseudo_analyzer | XCross         | OK,默认可用                  | + 4 × pt_pscross_C4E 各 52 MB = 210 MB              |
| pseudo_analyzer | XXCross        | OK,默认可用                  | + pscross_E0E1/E0E2/C4C5/C4C6 共 200 MB             |
| pseudo_analyzer | XXXCross       | OK,env CUBE_ALLOW_HUGE_TABLES=1 | + pscross_E0E1E2 957 MB + C4C5C6 822 MB + mt_edge3/corn3 |
| pair_analyzer   | 全 4 阶段      | OK,**golden bit-exact**(前 20 scramble),需 CUBE_ALLOW_HUGE_TABLES=1 | ~20 GB(2 张 huge + ins_C4 + pair) |
| pseudo_pair_analyzer | 全 4 阶段 | OK,**golden bit-exact**(前 20 scramble),需 CUBE_ALLOW_HUGE_TABLES=1 | ~3 GB(全 pseudo 表 + 16 × ins/pspair) |
| eo_cross_analyzer | 全 5 阶段    | OK,**golden bit-exact**(前 20 scramble),需 CUBE_ALLOW_HUGE_TABLES=1 | ~25 GB(全 cross 表 + EO 专属表) |
| table_generator | -              | OK,批量顺序生成全 73 张表 | 全部 ~25 GB                   |

底层 (cube_common / move_tables / prune_tables / prune_create / executor /
cross_solver / xcross_solver) 全部完成,golden bit-exact。

## 构建

```powershell
cargo build --release
```

需要 Rust stable(edition 2021)。无外部 C 依赖,只用 crates.io 上的
`memmap2` + `rayon`。

## 运行

`std_analyzer` / `pseudo_analyzer` 都是交互式 CLI:每行输入一个文件名,读
`id,scramble` 任务,输出同名 `*_std.csv` / `*_pseudo.csv`。

### pseudo_analyzer 快速上手

```powershell
# 默认:Cross + XCross + XXCross = 18/24 数据列(~415 MB 表,首次几十秒生成)
"scramble_1000.txt" | .\target\release\pseudo_analyzer.exe

# 全 4 阶段(+ XXXCross,~1.8 GB 额外 huge 表,首次 ~70s 生成)
$env:CUBE_ALLOW_HUGE_TABLES = "1"
"scramble_1000.txt" | .\target\release\pseudo_analyzer.exe
```

输出 25 列 CSV:`id + pseudo_{cross,xcross,xxcross,xxxcross}_{z0..x1}`。
PseudoXXXCross 默认 skip,需 `CUBE_ALLOW_HUGE_TABLES=1` 才会启用。
其他 skip env:`CUBE_PSEUDO_SKIP_XCROSS=1` / `_XXCROSS=1` / `_XXXCROSS=1`。

### pair_analyzer / eo_cross_analyzer / pseudo_pair_analyzer

三者都强制要求 `CUBE_ALLOW_HUGE_TABLES=1`(依赖 mt_edge6 或 ≥800MB pt 表):

```powershell
$env:CUBE_ALLOW_HUGE_TABLES = "1"
"scramble_1000.txt" | .\target\release\pair_analyzer.exe         # 25 列 scramble+4阶段
"scramble_1000.txt" | .\target\release\eo_cross_analyzer.exe     # 31 列 id+5阶段
"scramble_1000.txt" | .\target\release\pseudo_pair_analyzer.exe  # 25 列 id+4阶段
```

可选 env:
- `CUBE_PAIR_NO_DIAG=1`:pair 跳过 pt_cross_C4C6E0E2(省 10 GB)
- `CUBE_EO_NO_DIAG=1`:eo_cross 同上



### std_analyzer 默认(仅 Cross,~140 KB 表,首次约几秒生成)

```powershell
# 把任务文件放在当前目录,然后 echo 文件名给程序
"scramble_1000.txt" | .\target\release\std_analyzer.exe
```

输出 `scramble_1000_std.csv`,30 列:`id,cross_z0..cross_x1,xcross_*,xxcross_*,xxxcross_*,xxxxcross_*`。
默认模式下后 24 列(xcross+)全是 0。

### 启用 XCross(+52 MB pt_cross_C4E0,首次约 30-60s 生成)

```powershell
$env:CUBE_RUN_FULL_STD = "1"
"scramble_1000.txt" | .\target\release\std_analyzer.exe
```

xcross_* 6 列填真实数据,xxcross+ 仍是 0(未开 huge)。

### 完整 cascade(全 30 列,警告:磁盘需 ~23 GB,均 mmap 载入)

XXCross / XXXCross / XXXXCross 依赖 `pt_cross_C4C5E0E1`(~10 GB)+
`pt_cross_C4C6E0E2`(~10 GB)+ `mt_edge6`(~3 GB)+ `mt_corn2`(35 KB)。
同时设两个 env 后,全 30 列填真实数据(golden bit-exact)。

```powershell
$env:CUBE_ALLOW_HUGE_TABLES = "1"
$env:CUBE_RUN_FULL_STD = "1"
"scramble_1000.txt" | .\target\release\std_analyzer.exe
```

## 表文件

默认放在 `./tables/`。可用 `CUBE_TABLE_DIR` 覆盖:

```powershell
$env:CUBE_TABLE_DIR = "D:\my-cube-tables"
```

每张表都是 BFS 自动生成 + mmap 复用,首次运行慢,后续秒级 load。
Rust 端表格式与 C++ `.bin` **不兼容**(Rust 加了 magic header,详见
`PORTING_NOTES.md` Phase 1 / Phase 3)。要重新生成所有表,把目录清掉即可。

## 测试

```powershell
# 默认套件:54 个单元测试 + 1 e2e Cross,全部秒级跑完
cargo test --release

# 中表 + XCross e2e:多花几十秒生成 52 MB pt_cross_C4E0
cargo test --release -- --ignored
```

测试用 `target/test-tables/<name>/` 隔离表目录,**不污染** `./tables/`。
testdata/ 下的 `scramble_5.txt` / `scramble_100.txt`(上游测试打乱)+ `golden/`
是测试源,已 commit;`testdata/` 不在 `.gitignore` 里。

### 全 analyzer 端到端验证(verify.ps1)

5 个 analyzer × scramble_5/100 的一键验证 + 计时 + diff golden,用 `verify.ps1`
(需 `./tables/` 已含 huge 表)。golden = 本程序受信任输出(前 20 行已对齐 C++ golden
bit-exact,余下由本程序产出)。

```powershell
pwsh verify.ps1                 # 对照 golden,打印每个 analyzer 的耗时 + OK/FAIL
pwsh verify.ps1 -Generate       # 重建 golden 基线
pwsh verify.ps1 -Inputs scramble_5.txt   # 只跑某个输入
```

实测耗时见 [TESTING.md](TESTING.md)。

## 环境变量

| 变量                       | 作用                                              |
|----------------------------|---------------------------------------------------|
| `CUBE_TABLE_DIR=<path>`    | 覆盖默认表目录 `./tables/`                        |
| `CUBE_RUN_FULL_STD=1`      | 启用 std_analyzer XCross 阶段(+52 MB)           |
| `CUBE_ALLOW_HUGE_TABLES=1` | 解锁 ≥800 MB pt 表的生成(默认 panic);pseudo XXXCross / std XXCross+ 都需要 |
| `CUBE_PSEUDO_SKIP_XCROSS=1` | pseudo_analyzer 跳过 XCross + 下游               |
| `CUBE_PSEUDO_SKIP_XXCROSS=1` | pseudo_analyzer 跳过 XXCross + 下游             |
| `CUBE_PSEUDO_SKIP_XXXCROSS=1` | pseudo_analyzer 跳过 XXXCross(默认 skip 除非 huge 已开) |

## 与 C++ 版本的差异

| 项 | C++ | Rust |
|----|-----|------|
| 并行 | OpenMP `#pragma omp parallel for` | `rayon::par_iter` |
| 表格式 | 无 header,平台字节序依赖 | 加 8-byte magic + entry_count,显式 LE u32 |
| 表存储 | `std::vector<int>` 全部 owned | mmap 零拷贝 + Owned 双模式 |
| State 编码 | 4 个 `vector<int>`(cp/co/ep/eo) | `[u8;8]` + `[u8;12]` 紧凑数组 |
| 进度条 | ANSI 颜色 + 独立 monitor 线程 | `eprintln!("[PROG] N/total")` |
| std_analyzer XXCross+ | 完整 cascade | OK,golden bit-exact(前 20 scramble) |
| pseudo_analyzer | 完整 cascade | OK,全 4 阶段 bit-exact |
| pair_analyzer | 完整 cascade | OK,golden bit-exact(前 20 scramble) |
| eo_cross_analyzer | 完整 5 cascade | OK,golden bit-exact(前 20 scramble) |
| pseudo_pair_analyzer | 完整 cascade | OK,golden bit-exact(前 20 scramble) |
| table_generator | 独立 binary,顺序生成 36+ 表 | 独立 binary,顺序生成全 73 表 + C++ 式进度 |

详细差异和翻译决策见 `PORTING_NOTES.md`。

## 路线图

solver 系列(6 analyzer + table_generator)全部移植并 golden bit-exact。剩下:

1. **dist 系列续译**:`D:\cube\solver_wip\` 还有 ~30 个 cpp(xxcross_1_col / cross_6_col /
   pseudo_cross_* 等),同模板,详见 CLAUDE.md。

✅ **已完成**:
- std_analyzer:Phase 11,XXCross/XXXCross/XXXXCross 接入 huge 表(C4C5E0E1 / C4C6E0E2 / mt_edge6),全 30 列 golden bit-exact(前 20 scramble)
- pseudo_analyzer:Phase 6 完整移植,25 列全部 bit-exact 匹配 golden(详见 PORTING_NOTES Phase 6)
- pair_analyzer:Phase 7,golden bit-exact(前 20 scramble,pair 25 列)
- eo_cross_analyzer:Phase 8,golden bit-exact(前 20 scramble,eo 31 列)
- pseudo_pair_analyzer:Phase 9,golden bit-exact(前 20 scramble,25 列;修了 ins_C_diff/pspair_CE 数组 corner/edge 转置 bug)
- table_generator:顺序生成全 73 表,大表 C++ 式分布进度 + 原位打包(峰值 ~21GB)
