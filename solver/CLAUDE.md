# CLAUDE.md

三阶魔方 Cross / F2L 阶段最优解分析器,从 D:\cube\solver(C++17)移植到 Rust。当前是部分移植产物 — 详细路线图见 README.md,设计决策见 PORTING_NOTES.md。

本仓库**同时**承载两类 binary,共享 cube_common / move_tables:
- **solver 系列** (`*_analyzer`):IDA* + prune table 解单个 scramble,源 = `D:\cube\solver`
- **dist 系列** (`dist_*`):完整 BFS + 聚合算分布,源 = `D:\cube\solver_wip\*`

## 当前状态(2026-05-28)

- ✅ 基础层 cube_common / move_tables / prune_tables / prune_create 100% 移植,36 张 Canon pt 表的 gen 函数已就绪
- ✅ std_analyzer 二进制可用:Cross(默认)+ XCross(env CUBE_RUN_FULL_STD=1)+ XXCross/XXXCross/XXXXCross(再加 CUBE_ALLOW_HUGE_TABLES=1),全 30 列 **golden bit-exact**(前 20 scramble 对齐 scramble_1000_std.txt,83.7s)
- ✅ pseudo_analyzer 二进制可用:Cross + XCross + XXCross(默认,~415MB 表)+ XXXCross(env CUBE_ALLOW_HUGE_TABLES=1,~1.8GB 表),全 25 列 bit-exact 匹配 golden
- ✅ pair_analyzer 全 4 阶段、eo_cross_analyzer 全 5 阶段:均强制 CUBE_ALLOW_HUGE_TABLES=1,**已 golden bit-exact**(前 20 scramble 对齐 D:\cube\solver\golden\scramble_1000_pair.txt / scramble_20_eo.txt,pair 25 列 / eo 31 列全匹配)
- ✅ pseudo_pair_analyzer 全 4 阶段(强制 CUBE_ALLOW_HUGE_TABLES=1),**已 golden bit-exact**(前 20 scramble × id+24 列全匹配 scramble_100_pseudo_pair.txt,该文件只 20 行)。曾有 bug:ins_C_diff / pspair_CE 两个 16-元数组按 corner-major 构建却按 edge-major(`slot1*4+pslot1`)访问,非对角槽位读错表,已改 edge-major 构建
- ℹ️ std XXCross+ 关键事实:C++ search_2/3/4 仅靠 huge 表(C4C5E0E1 相邻 / C4C6E0E2 对角)剪枝,逐槽 SlotView move-table 查表是重构死代码(只赋值从不剪枝),Rust 端直接省去,等价且更快
- ✅ table_generator 独立 binary:顺序生成全 73 张表(12 mt + 61 pt),已存在跳过支持断点续跑;≥1G 状态的大表跑 C++ 式 DistributionPrinter 进度;两张 10GB huge 表原位打包峰值 ~21GB(vs C++ ~32GB)
- ✅ dist_xcross_1col 单色底不固定槽 XCross 分布,bit-exact 对齐 golden(total=695,280,402,432,000;聚合 ~6.7s,vs C++ AVX2 6.24s)
- ✅ dist_xcross_1col_fixed 单色底固定 BL 槽 XCross 分布,11 深度 bit-exact (total=72,990,720, 1s)
- ✅ dist_xxcross_1col_{adj,diag} 单色底固定双槽 XXCross 13 深度分布,bit-exact (total=21,459,271,680;adj 144s vs cpp 161s,diag 132s vs cpp 178s)
- ✅ dist_cross_{1col,2col,6col} 单/双/六色底 Cross 分布,bit-exact (1col 45ms,2col 38ms vs cpp 300ms,6col 32s vs cpp 21s)
- ✅ dist_xcross_2col 双色 (D4h 16-elem) 不固定槽 XCross 11 深度分布,bit-exact (total=43,252,003,274,489,856,000;1048s vs cpp 877s)
- ✅ dist_*_0f 11 个 0 步状态数(xcross/xxcross/xxxcross × 1col/2col/6col + xxxxcross × 2col/6col),纯容斥 + dist/combo.rs,全部 bit-exact 对齐 cpp 输出
- ⏭️ dist_xxxcross_1col_fixed 跳过 — 2.2 TB visited 不可跑(32GB 机器)
- ⏭️ dist_xxcross_1col(6-min 折叠不固定槽)跳过 — 695T 全空间研究级,cpp 端自己都没解出来
- ⏭️ dist_xxxxcross_1col 跳过 — 350 TB visited
- ⏭️ dist_xcross_6col 跳过 — cpp 端 v5/v6/v7 都有 bug,没有可对照 golden
- ⏭️ dist_cross_pair_1col 跳过 — cpp 端 v1..v4 用户都不确定哪个对,无可信 golden
- ⏭️ dist_*_state / _Nf 等 scramble 生成器/per-state 输出工具,非分布 bin,不优先
- ✅ state_cross_1col 单色 cross 8 步各深度 scramble (190K 行,0.06s,count bit-exact)
- ✅ state_cross_2col 双色 cross d=8 各 (W_idx,Y_idx) 配对的 IDA* 解 (3672 scrambles,1.5s vs cpp 30s,无 golden 文件)
- ✅ state_xcross_1col_fixed_10f 固定 BL 槽 XCross 10 步各深度 scramble (73M 行,55s,count bit-exact)
- ⏭️ state_xcross_1col_10f 跳过 — cpp 自己说"里面混入了很多不是10步的"
- ⏭️ state_xcross_2col_10f 跳过 — 仅输出 d=10 count,已被 dist_xcross_2col 取代
- ⏭️ state_xcross_2col_10f_state / state_xcross_6col_10f / state_xxcross_1col_12f / state_xxcross_1col_fixed_12f_state / state_xxcross_2col_12f 跳过 — pruning 表 ≥10GB 或 parent tracking ≥100GB,32GB 机器跑不动

## 硬约束

- env 开关(可选):
  - `CUBE_RUN_FULL_STD=1` 启用 std_analyzer XCross(pt_cross_C4E0 52MB)
  - `CUBE_ALLOW_HUGE_TABLES=1` 启用 mt_edge6 / pt_cross_C4C*E0E* / pt_pscross_E0E1E2 / pt_pscross_C4C5C6 等 ≥800MB 表
  - pseudo_analyzer 默认会拉 ~415 MB 表(Cross+XC+XXC),按需可用 `CUBE_PSEUDO_SKIP_X*CROSS=1` 跳过
- 单元测试 RAM 增量 ≤ 200MB、落盘 ≤ 10MB;ignored 测试 ≤ 1GB / ≤ 100MB
- 测试用 `target/test-tables/<name>/` 隔离 + 前后清,**禁止污染** `./tables/`

## 构建 / 运行 / 测试

```powershell
cargo check
cargo build --release
cargo test --release                  # 55 默认通过(含 e2e Cross)
cargo test --release -- --ignored     # 8 个 ignored(中表 + e2e XCross + pseudo unit + e2e pseudo)
"testdata\scramble_5.txt" | .\target\release\std_analyzer.exe   # 输出 scramble_5_std.csv
"testdata\scramble_5.txt" | .\target\release\pseudo_analyzer.exe   # 输出 scramble_5_pseudo.csv
```

启用 std XCross:`$env:CUBE_RUN_FULL_STD = "1"` 后再跑。首次会生成 52MB pt 表(BFS,几十秒)。
启用 pseudo XXXCross:`$env:CUBE_ALLOW_HUGE_TABLES = "1"`,首次生成 1.8GB huge 表(~70s)。
**全 analyzer × scramble_5/100 的端到端验证 + 计时 + diff golden,用 `verify.ps1`**(需 huge 表在 `./tables/`):
`pwsh verify.ps1`(对照 golden)/ `pwsh verify.ps1 -Generate`(重建 golden 基线)。详见 TESTING.md。

## 文件地图

| 文件 | 职责 |
|---|---|
| `src/cube_common.rs` | State / Move / 索引 / rot_map / conj_moves_flat / state_space / create_multi_move_table* / 表 I/O / string_to_alg / test_env_lock |
| `src/move_tables.rs` | MoveTableManager 单例,12 张 mt 表 ensure_*/release_*;mt_edge6 panic 保护 |
| `src/prune_tables.rs` | PruneTableManager + PackedPruneTable(4-bit packed,low=偶 idx high=奇 idx) |
| `src/prune_create.rs` | 13 个 BFS 引擎家族,翻译 C++ prune_create.cpp 全部 create* 函数 |
| `src/cross_solver.rs` | Cross 阶段 IDA*(std/pseudo 共享,is_pseudo 切表) |
| `src/xcross_solver.rs` | std XCross/XXCross/XXXCross/XXXXCross IDA*(search_1 pt_cross_C4E0;search_2/3/4 纯 huge 表 1/3/(4+2) 张,死 SlotView 已省;new(with_huge)) |
| `src/pseudo_xcross_solver.rs` | Pseudo XCross(4 pscross_C4E[diff] 表,16 task,search 内 **不** conj) |
| `src/pseudo_xxcross_solver.rs` | Pseudo XXCross(2-subset Aux,72 task,trans_moves 双路径) |
| `src/pseudo_xxxcross_solver.rs` | Pseudo XXXCross(3-subset Aux + 2-subset 补漏,16 task,三路径,需 huge) |
| `src/pair_solver.rs` | Pair analyzer 4 cascade(VirtState 7 量,2 huge table optional,Phase 7) |
| `src/eo_cross_solver.rs` | EOCross + EOXCross 4 cascade(12 sym → 6 rot 折叠,Phase 8) |
| `src/pseudo_pair_solver.rs` | PseudoPair 4 cascade(ConjStateXC + AuxState 6 表,16×ins/pspair,Phase 9) |
| `src/executor.rs` | run_analyzer_app trait + rayon 并行 + CSV 输出(替代 C++ OpenMP) |
| `src/logo.rs` | 开屏 CUBEROOT logo,移植 C++ logo.h:`print_logo_block`(默认,6 bin 启动调,赤陶 #D97757)+ `print_logo`/`print_logo_v4`/`print_claude_cube_logo`;ANSI 24-bit + Unicode,std-only(Win32 控制台 UTF-8/VT 走 kernel32 FFI)|
| `src/bin/std_analyzer.rs` | std_analyzer 二进制 main,6 旋转 × 5 cascade = 30 列 CSV |
| `src/bin/pseudo_analyzer.rs` | pseudo_analyzer 二进制 main,6 旋转 × 4 cascade = 24 列 CSV |
| `src/bin/pair_analyzer.rs` | pair_analyzer 二进制,scramble + 4×6 = 25 列 CSV |
| `src/bin/eo_cross_analyzer.rs` | eo_cross_analyzer 二进制,id + 5×6 = 31 列 CSV |
| `src/bin/pseudo_pair_analyzer.rs` | pseudo_pair_analyzer 二进制,id + 4×6 = 25 列 CSV |
| `src/dist/bfs.rs` | dist 共享:通用 byte-valued BFS 距离表(raw-byte race-permit) |
| `src/dist/packed4.rs` | dist 共享:4-bit packed BFS(nibble CAS + AVX2 64-nibble 块跳过),`bfs_xxcross_packed4` (e×c layout) |
| `src/dist/mask.rs` | dist 共享:28 个 popcount==2 mask + 28×28 disjoint 邻接 |
| `src/dist/combo.rs` | dist 共享:组合数学(perm/binom/POW2/POW3/FACT/count_legal_states/w_sub),0 步容斥用 |
| `src/bin/dist_xcross_1col.rs` | dist_xcross_1col 二进制:单色 XCross 11 个深度分布(AVX2 聚合) |
| `src/bin/dist_xcross_1col_fixed.rs` | 固定 BL 槽 XCross,11 深度 BFS,1s |
| `src/bin/dist_xxcross_1col_{adj,diag}.rs` | 固定双槽 XXCross,13 深度 4-bit packed BFS(~10 GB visited + 3 GB mt_edge6),~140s |
| `src/bin/dist_cross_{1col,2col,6col}.rs` | 1/2/6 色 Cross 分布(_2col 走 W/Y 独立 495×495 mask 容斥;_6col 走 6 BFS + AVX2 32-batch min-reduction) |
| `src/bin/dist_xcross_2col.rs` | 双色 XCross 分布(D4h 16-elem,8 张 109MB pruning 表,70 partition × 24 perm × 16 ori × AVX2 conv3,11 深度),~17 分钟 |
| `src/bin/dist_*_0f.rs` | 11 个 0 步状态数 bin(容斥;1col 子空间 / 2col,6col 全空间 + cube laws) |
| `src/bin/state_cross_1col.rs` | 单色 cross 1..8 步 scramble,输出 1..8.txt(190K 行) |
| `src/bin/state_cross_2col.rs` | 双色 cross d=8 配对 IDA*,输出 cross_2_col_state.txt(3672 行) |
| `src/bin/state_xcross_1col_fixed_10f.rs` | 固定 BL 槽 XCross 1..10 步 scramble,输出 1..10.txt(73M 行) |
| `.cargo/config.toml` | -C target-cpu=native(分布计算 AVX2 必需,solver 系列也受益) |
| `tests/e2e_cross.rs` | default e2e,Cross 13 列对照 golden |
| `tests/e2e_xcross.rs` | ignored e2e,XCross 13 列对照 golden |
| `tests/e2e_pseudo.rs` | ignored e2e,PsCross+XC+XXC 18 列 + 全 24 列两个测试 |
| `verify.ps1` | 一键跑全 5 analyzer × scramble_5/100、计时、diff golden;`-Generate` 重建基线 |
| `testdata/scramble_{5,100}.txt`、`testdata/golden/` | e2e 输入(上游测试打乱)+ 期望输出(golden = 本程序受信任输出,前 20 行已对齐 C++) |
| `DEFINITIONS.md` | 块/槽/位置图 + 5 analyzer 阶段语义 + 索引约定对照(从上游 README 移植,使仓库自包含) |
| `TESTING.md` | 测试输入/golden 说明 + verify.ps1 用法 + scramble_5/100 实测耗时表 |
| `PORTING_NOTES.md` | 5 个 phase 的设计决策、C++ 端歧义、表 magic 升级、命名差异。**改代码前必读** |
| `README.md` | 进度表 + 上手命令 + env 清单 + 路线图 |

## 表格式(Rust 自有,不兼容 C++ .bin)

- Move 表:magic `b"CUBESLV1"`(8 字节)+ u32 LE entry_count + u32 LE data
- Prune 表:magic `b"CUBEPT01"`(8 字节)+ u64 LE entry_count + 4-bit packed bytes(EDGE6×CORN2 维度需 u64)

## 源工程对照

- C++ 源:`D:\cube\solver\`(只读参考,**别改**)
- Golden CSV:`D:\cube\solver\golden\*.txt`、`D:\cube\solver\scramble_*_std.csv` 等
- 架构图:`D:\cube\solver\ARCHITECTURE.md`(四层 base/data/executor/app)
- 表清单:`D:\cube\solver\table_naming.csv`(角色 Canon/Conj/Zombie、文件名、大小)
- create 引擎清单:`D:\cube\solver\create_functions.csv`
- `reference/claudecode.cpp`:存档的 C++ 原文件(生成 cube_root.svg 的矢量 logo,**SVG 生成逻辑未移植**;Rust 端只借其字模做了终端版 `print_claude_cube_logo`)

## 缩写约定(全项目一致)

sz=size、ed=edge、cn/corn=corner、cr=cross、ps=pseudo、ins=insertion、ex=extra、mt=move table、pt=prune table、adj=adjacent、diag=diagonal。新命名跟上。

## 工程规矩

- LF only(全局 git autocrlf=false + .gitattributes 已设)
- UTF-8 无 BOM
- 不加新依赖(memmap2 + rayon + std 够用)
- 测试 隔离 + 前后清 `target/test-tables/`
- 不写多余注释 / 多余 .md
- 改公共类型(State / Move / PackedPruneTable / 表 magic)前先看 PORTING_NOTES.md

## 给下一个 AI 的最优先 TODO(按依赖顺序)

solver 系列(6 analyzer + table_generator)全部移植并 golden bit-exact,剩余只有 dist 续译:

1. **dist 系列续译**:`D:\cube\solver_wip\` 还有 ~30 个 cpp(xxcross_1_col / cross_6_col / pseudo_cross_* 等),都同模板。每加一个新 dist bin:`src/bin/dist_<name>.rs` + 复用 `src/dist/{bfs,mask}.rs`,共享需求(y 旋转映射 / 4-bit packed 表 / 通用 AVX2 聚合等)成熟后再补到 `src/dist/`

每完成一个,在 PORTING_NOTES.md 追加一段 `## Phase N+` 记设计决策,在 README.md 进度表打勾。
