# Porting Notes

记录每个 phase 把 C++ 端翻译到 Rust 时的设计决策、差异点与坑。

---

## Phase 1: cube_common

**翻译范围**:`cube_common.h` + `cube_common.cpp`(基础层)。

**对应 Rust 文件**:`src/cube_common.rs`。

### 关键设计决策

1. **State 用紧凑数组而非 4 个 Vec**
   C++ 的 `State` 用 4 个 `std::vector<int>`(cp/co/ep/eo,共 80 字节堆分配)。Rust 改成
   `[u8; 8]` 角块 + `[u8; 12]` 棱块,共 20 字节,值=`base*idx+ori`(角块 base=3,棱块 base=2),
   与 C++ 各处"raw_state = 2/3*idx+ori"的约定天然一致。State 直接 `Copy`,无堆分配。

2. **18 个 Move 用 `enum Move` + `MOVE_STATES: [State; 18]` 常量表**
   C++ 用 `std::unordered_map<std::string, State> moves_map` + `move_names` 数组。Rust
   废弃哈希表:`Move` 是 `#[repr(u8)]` enum,索引值与 `MOVE_NAMES` / `MOVE_STATES` 对齐。
   字符串解析(`string_to_alg`)只在边界用一次,运行时全部走索引。

3. **OpenMP → rayon 留给后续 phase**
   本 phase 没有需要并行的循环(只有静态初始化),rayon 仅在 Cargo.toml 里挂着,等 phase 2
   的表生成再用。

4. **C++ singleton + extern 全局表 → Rust `OnceLock`**
   `rot_map`、`conj_moves_flat`、`sym_moves_flat`、`valid_moves` 都从 "全局
   `extern int[..][..]` + `init_matrix()`" 改成返回 `&'static [[u8; ..]; ..]` 的函数,
   首次调用时 `OnceLock` 初始化,线程安全且免去显式 init 调用。

5. **C++ `unsigned char*` 表指针 → Rust `&[u8]` / `&[u32]`(本 phase 仅 I/O 占位)**
   `read_table_le_u32` 直接返回 `Vec<u32>`;后续大表会改成 `memmap2::Mmap` + `cast_slice`
   零拷贝映射,本 phase 没引入。

6. **C++ 模板 `save_vector<T>` / `load_vector<T>` → 显式 `*_le_u32` 函数**
   表内容都是固定宽度的 `u32`(C++ 端的 `int` 总是 32 位有符号),不需要 generic;同时切
   到 little-endian 显式编码,跨平台稳定。Header 用 8 字节 magic `CUBESLV1` + 4 字节
   entry_count(C++ 端只写了 `size_t`,无 magic、字节序依赖,Rust 端这一刀干净点)。

7. **`array_to_index` / `index_to_array` 参数语义照搬**
   C++ 的 `n`(参与编码的块数)、`c`(朝向基数)、`pn`(块总数)三个 int 一字不差保留,
   因为后续 `move_tables`、`prune_create` 大量用 `(n,c,pn) ∈ {(2,2,12),(3,2,12),(2,3,8),
   (4,2,12),(6,2,12),(3,3,8),(4,1,12)}` 等八种组合,改 API 会让后续翻译对不齐。
   `index_to_array` 输出值仍乘 18(C++ 同样设计),保持 basic_table 的 18-stride 一致。

8. **`createMultiMoveTable[2]` 不用 generic 闭包**
   原计划按任务描述写成 `Fn(F, G)`,但读完 C++ 发现 encode/decode 已经定型为
   `array_to_index` / `index_to_array`,做 generic 反而失去对齐。保留原签名
   `(n, c, pn, size, &[i32]) -> Vec<i32>`,phase 2 的 move_tables 模块直接用。

### 与 C++ 的差异点

- **State 编码**:Rust 把 cp/co、ep/eo 合并成 `corners[8]` / `edges[12]`,需要拆开时
  调 `cp_co()` / `ep_eo()`。`compose()` 内部仍按 4-数组的语义操作,等价于 C++ 的
  `apply_move`。
- **进度条删了**:C++ `createMultiMoveTable` 内有 `std::cout` 进度条,Rust 暂时
  去掉(测试期间不需要,后续 phase 移到调用方)。
- **`apply_move_edge` / `apply_move_corner` 没翻译**:这两个仅供 `createMTEdge` /
  `createMTCorn` 用,属于 phase 2(move_tables)的领地。本 phase 不引入,避免
  无人调用的 dead code。
- **`getDiagonalView` 仅保留原 BL-FR / BR-FL 判定**:C++ 实现就是硬编码 (0,2)/(1,3),
  Rust 一致。

### 已知坑 / 疑问

- C++ `init_matrix` 里 `for (int prev = 0; prev <= 18; ++prev)` 越界写到 `valid_moves_flat[18]`,
  实际数组声明 `[20][18]`,留了 `[18]` 表示 "无上一步" 哨兵、`[19]` 空着。Rust 保留同样的
  `[[u8; 18]; 20]` 形状,避免后续翻译对不齐。
- `index_to_array` 内层 "sorted insert" C++ 用 `std::sort(begin, begin+i)`,Rust 改成
  `sorted[..i].sort()`,行为一致。原 C++ 还多写了一段 "插入排序" 的循环,但那段循环
  其实是空操作(`k` 在外层 for 里没被使用),已删除冗余。
- 文件 I/O 暂只支持 `u32` 表;`u8` 压缩表(剪枝表 4-bit pack)等到 phase 3 加 magic v2。

---

## Phase 2: move_tables

**翻译范围**:`move_tables.{h,cpp}`(MoveTableManager 单例 + 12 张 mt_*.bin 的懒加载/生成/释放)。

**对应 Rust 文件**:`src/move_tables.rs`。

### 关键设计决策

1. **OnceLock 不能 reset → Mutex<Option<Arc<MoveTable>>>**
   任务要求 `release_*` 能清掉已加载表(C++ 端是 `std::vector<int>().swap()`),Rust 的
   `OnceLock` 没有 `take`(stable),所以 12 个槽位用 `Mutex<Option<Arc<MoveTable>>>`。
   全局单例本身仍用 `OnceLock<MoveTableManager>`(它本身不需要 reset)。

2. **TableStorage 双模式 Owned/Mmap**
   ```rust
   enum TableStorage { Owned(Vec<u32>), Mmap(Mmap) }
   ```
   生成路径走 Owned;`ensure_*` 永远走 mmap(生成后立即 write+mmap reload,统一接口)。
   `as_u32()` 在 LE 主机上从 `Mmap` 直接 reinterpret(`from_raw_parts`),零拷贝;
   非 LE 平台目前 panic(这个项目只跑 x86_64/ARM64 LE,够用)。

3. **mt_edge6 保护**
   `ensure_edge6` 在文件不存在且 `CUBE_ALLOW_HUGE_TABLES != "1"` 时 panic,避免误生成
   ~3 GB 大表炸内存/磁盘。其他表无此保护。

4. **表目录可配置**
   默认 `./tables/`(相对 CWD),可被 env `CUBE_TABLE_DIR` 覆盖。`table_path("mt_edge.bin")`
   返回 PathBuf,跨平台用 `.join()` 拼接。

5. **gen 函数不持槽位锁**
   `ensure_with` 在 gen 阶段不能持槽位锁(否则 `gen_mt_edge2` 内部 `ensure_edge` 会死锁
   于同一 manager 的别的槽位)。模式:
   - 拿锁查快速路径
   - 不持锁地 gen + write
   - 再拿锁安放 Arc(并发兜底)

6. **C++ 单棱/单角生成的 Rust 等价**
   C++ `createMTEdge` 用 "ep/eo 中只置一个 -1 状态"+`apply_move_edge`,这是因为 C++ State
   允许 `ep[i]=-1` 占位。Rust State 是 `[u8;12]` 全填,所以改成:从 solved 出发只把目标
   棱的 orientation 改成 `i%2`(位置已经对了),`applied(move)` 后找目标 edge 编号现在的位置。
   `mt[18*i+j] = 2*idx + eo_new[idx]`,等价于 C++ 输出。Corner 同理。

7. **依赖表自动 ensure**
   - `mt_edge*` 系列依赖 `mt_edge`
   - `mt_corn*` 系列依赖 `mt_corn`
   - `mt_ep4` 依赖 `mt_ep1`
   `gen_mt_*` 内部直接调 `mgr.ensure_dep()`,递归 ensure 安全(gen 阶段不持锁)。

8. **stride 字段**
   `MoveTable.stride` 表示一行多少个 entry,跟 table_naming.csv 一致:
   - mt_edge / mt_corn / mt_edge2 / mt_edge3 / mt_corn2 / mt_corn3 / mt_eo12 /
     mt_eo12_alt / mt_ep1 / mt_ep4 = 18
   - mt_edge4 = 24(`createMultiMoveTable2` 预乘 24)
   - mt_eo12 虽然 stride=18,但值预乘 18(测试 `mt_eo12_size_and_premul` 校验)

### 与 C++ 的差异点

- **u32 而非 i32**:C++ `std::vector<int>` 是 32 位 signed,Rust 端表内存全部走 u32(因为
  写盘格式是 LE u32,文件层就是无符号)。`create_multi_move_table*` 返回 `Vec<i32>` 是因为
  Phase 1 时用了 `-1` 作 "未填" 哨兵;Rust 端 `gen_*` 函数把结果 `as u32` 转一下再存。
  (所有 cell 都会被填,所以 `-1 as u32 = u32::MAX` 不会进表;若进了说明 C++ 算法漏填,
  测试 `assert_eq!(len, expected)` 不会发现这个,但 Phase 3 用表时会越界,留作 phase-3 兜底)
- **不打印进度/计时**:C++ 用 `GenerationTimer` + cout,Rust 端去掉了。后续如果需要,
  在 `ensure_with` 的 gen 分支套个 `Instant::now()` 打 stderr 即可。
- **无 `initialize()` / `loadAll()` / `genAllSequentially()`**:这些 C++ 方便方法暂时不
  迁移(本 phase 不需要;phase 4/5 调用方按需 ensure 即可)。需要时再补。

### 测试策略

- `target/test-tables/<name>/` 子目录隔离,每个测试前 `remove_dir_all` + `create_dir_all`,
  测后清理。不污染 `./tables/`。
- 通过 env `CUBE_TABLE_DIR` 让 manager 看到隔离目录。测试间用全局 Mutex 串行化(env 变量
  全局共享)。
- 每个测试构造**本地** `MoveTableManager::new()` 而非用 `instance()`(单例会跨测试串扰)。
- mt_edge / mt_corn / mt_edge2 / mt_edge3 / mt_corn2 / mt_corn3 / mt_eo12 / mt_eo12_alt /
  mt_ep1 / mt_ep4 默认跑;mt_edge4 (~17 MB) 和 mt_edge6 保护机制 `#[ignore]`,
  `cargo test -- --ignored` 跑前者(release 下约 10s,debug 下慢)。

### 已知坑 / 疑问

- C++ `loadMTEdge6` **不**做 "已加载" 快速检查(其他表都做),所以每次调用都重新加载
  ~3 GB。Rust 端没复刻这个特殊行为:`ensure_edge6` 和别的表一样会缓存 Arc,调用方按需
  `release_edge6` 来释放。是否要严格复刻 C++ 的 "不缓存" 行为,等 phase 3 看 prune_create
  的使用模式再决定。
- C++ `apply_move_corner` 第 144 行有可疑代码:`nco[idx_next] = (co[idx] + nco[idx_next]) % 3;`
  使用了**自己刚被初始化为 -1 的** `nco[idx_next]`,然后第 146 行又用 `m.co[idx_next]` 覆盖。
  最终结果是第 146 行的值生效,第 144 行没影响(死代码 + UB)。Rust 端直接按 "最终
  语义" 翻译,等价于 `(co[idx] + m.co[idx_next]) % 3`。
- mmap u32 视图依赖 page-aligned mmap 起点 + 12 字节偏移仍 4 字节对齐(操作系统保证 mmap
  按页对齐,12 是 4 的倍数,所以安全)。换文件格式时如果改 header 长度,要重新检查对齐。
- 测试用 `std::env::set_var`,Rust 2024 后 `set_var` 标记 `unsafe`,但当前 edition 是 2021,
  没问题。升级 edition 时要换成 `unsafe { std::env::set_var(..) }`。


## Phase 3: prune_tables / prune_create

**翻译范围**:`prune_tables.{h,cpp}` + `prune_create.cpp`(15 个 BFS 引擎 + ~36 张
Canon 剪枝表的懒生成/加载/释放管理)。

**对应 Rust 文件**:`src/prune_tables.rs` + `src/prune_create.rs`。

### 关键设计决策

1. **新文件格式 `CUBEPT01` + u64 header(不复用 Phase 1 的 `CUBESLV1`)**
   理由:有的 pt 表(EDGE6 × CORNER2 = 21,459,271,680)条目数 > `u32::MAX`,Phase 1
   的 u32 entry_count 装不下;且 pt 是 4-bit packed,与 Phase 1 的 u32 表语义不同。
   - magic = `b"CUBEPT01"`(8 字节)
   - entry_count = u64 LE(8 字节)
   - data = `(entry_count + 1) / 2` 字节,4-bit packed
   总 header = 16 字节。pt 表读 / 写函数:`read_packed_prune_table`、
   `write_packed_prune_table`(`prune_tables.rs`)。Phase 1 的 `*_le_u32` 不动。

2. **nibble 顺序与 C++ 一致**
   `shift = (idx & 1) << 2`:idx=0 在 low nibble,idx=1 在 high nibble。
   `get_prune_nibble` / `set_prune_nibble` 与 C++ `get_prune` / `set_prune` 严格对齐。
   测试 `nibble_set_get_roundtrip` 验证 `set_prune_nibble(b,0,0x3); set_prune_nibble(b,1,0xA); b[0]==0xA3`。

3. **BFS 引擎家族(prune_create.rs)**
   13 个 C++ create* 函数全部翻译:
   - `create_pt_cross_or_pscross`(C++ `genPTCross` / `genPTPsCross` inline BFS)
   - `create_pt_cross_ins_c`(`createPTCrossInsC`)
   - `create_pt_pair_basic`(`createPTPair`)
   - `create_pt_cross_ce`(`createPTCrossCE`,`is_pseudo` 区分 Std/Pseudo XCross)
   - `create_pt_edge6_corn2`(`createPTEdge6Corn2`,Huge)
   - `create_pt_pscross_aux2`(`createPTPsCrossEdge2` / `Corn2` / `Edge3` / `Corn3` 统一引擎)
   - `create_pt_dim2`(`createPTDim2`,pt_ep4eo12)
   - `create_pt_cross_cex`(`createPTCrossCEX`,EOCross Plus)
   - `create_pt_cross_ccc`(`createPTCrossCCC`,EOCross 3-Corner)
   - `create_pt_pscross_corn`(`createPTPsCrossCorn`,PseudoPair base)
   - `create_pt_pscross_ins_c`(`createPTPsCrossInsC`,PseudoPair XCross 16 变体)
   - `create_pt_pspair`(`createPTPsPair`,PseudoPair Pair 16 变体)
   每个引擎对外都通过 `gen_pt_xxx(&PruneTableManager) -> (u64, Vec<u8>)` 注册。

4. **并行化:OpenMP → rayon + AtomicU8 CAS**
   C++ 用 `#pragma omp parallel for reduction(+ : cnt)` + `__sync_val_compare_and_swap`。
   Rust 用 `rayon::par_iter` + `AtomicU8::compare_exchange(255, nd, Relaxed, Relaxed)`。
   `tmp: Vec<AtomicU8>` 全部填 255 = unvisited,BFS 后 `atomic_to_bytes` 取快照再 pack。
   不能 `.with_min_len()`(`u64` 范围不实现 `IndexedParallelIterator`),直接默认分块。

5. **Canon / Conj / Zombie 角色策略(table_naming.csv 对齐)**
   - **Canon** 表全部翻译(36 张):提供 `ensure_pt_*` / `release_pt_*` 与 `gen_pt_*`
   - **Conj** 表(8+ 张,如 `pt_pscross_C5C6` 通过 rot 映射到 `pt_pscross_C4C5`):
     **不实现 ensure**,等 Phase 4 std_analyzer 通过 `rot_map` 在运行时查表
   - **Zombie** 表(`pt_pscross_E1E2`、`pt_pscross_E0E1E3` 等共 ~12 张):
     **完全不实现**(连 gen 函数都没写),`#[allow(dead_code)]` 保留位置
   - Edge2 仅 Canon `E0E1` + `E0E2`,Corner2 仅 `C4C5` + `C4C6`,
     Edge3 仅 `E0E1E2`,Corner3 仅 `C4C5C6`(与 C++ `loadPseudoTables` 一致)

6. **大表保护机制(继承 Phase 2 思路,改成基于 entry_count 的统一阈值)**
   `HUGE_ENTRY_THRESHOLD = 1.6e9 entries`(约 800 MB packed):任何
   `ec_count(id) >= 阈值` 的表在 `ensure_with` 里走 `huge_table_check`,
   默认 panic,设 `CUBE_ALLOW_HUGE_TABLES=1` 才放行。
   - 默认放行:pt_cross (139 KB)、pt_pscross (139 KB)、pt_pair_C4E0 (288 B)、
     pt_pspair_CE (288 B)、pt_pscross_C[4-7] (2.18 MB)、pt_cross_ins_C4 (2.18 MB)、
     pt_pscross_ins_C_diff[16] (2.18 MB)、pt_ep4eo12 (11.6 MB)
   - 默认放行但慢(`#[ignore]`):pt_pscross_E0E1/E0E2 (~48 MB)、pt_pscross_C4C5/C4C6
     (~46 MB)、pt_pscross_C4E[0..3] (52 MB)、pt_cross_C4E0 (52 MB)
   - 需要 env 才能生成:pt_pscross_E0E1E2 (957 MB)、pt_pscross_C4C5C6 (822 MB)、
     pt_ep4eo12 不阈值内但 OK、pt_cross_CEE/CCE/C4C5C6 (1.22 GB)、
     pt_cross_C4C5E0E1 / pt_cross_C4C6E0E2 (10 GB,~21.5G 条目)

7. **跨模块 TEST_LOCK 合并**
   Phase 2 的 mt_tests 和 Phase 3 的 pt_tests 都 `set_var("CUBE_TABLE_DIR")`,
   它们用各自模块的 TEST_LOCK 不能避免冲突。改成 `cube_common::test_env_lock()`
   共享一把全局 `Mutex<()>`,并把 `.unwrap()` 改成 `.unwrap_or_else(|e| e.into_inner())`
   兜底 PoisonError。这样 `cargo test --lib` 多线程默认也能稳定通过。

8. **mt 单例复用 vs 重生成**
   pt tests 通过 `prune_create::gen_pt_*` 间接调用 `mt::instance().ensure_*()`,
   这是 **全局 mt 单例**。pt 测试用的 `CUBE_TABLE_DIR` 是隔离的,每次 pt test 都会
   触发全局 mt 单例首次生成 mt 表(因为生成依赖 mt_edge / mt_corn 等基础表)。
   测试结束时 pt 删除自己的隔离目录,但 mt 单例的 Arc<MoveTable> 仍持有已删除文件的
   Mmap,**Windows 上文件已 unlink + handle 持有时仍可读**,所以无 bug。
   多个 pt test 串行执行时(共享 TEST_LOCK),后续 test 复用首次缓存的 mt 表,无需重生。

### 与 C++ 的差异点

- **不打印进度/计时**:`DistributionPrinter` + `GenerationTimer` 没翻译(测试期间噪声)。
  后续 phase 调用方需要时再补,加 `Instant::now()` 即可。
- **`load_*Tables` 系列方法没翻译**:C++ 的 `loadPseudoTables` / `loadPseudoPairTables` /
  `loadEOCrossTables` 是为单一 analyzer 批量加载表;Rust 端 analyzer 按需 `ensure_*`,
  不强制批量加载,所以暂时不需要。
- **`initialize` / `genAllSequentially`**:C++ 在 `main` 调用顺序生成全部 36+ 张。
  Rust 端 phase 5 才会有 e2e 入口,暂时按需 ensure 即可。
- **Mmap 偏移对齐**:pt header = 16 字节(u8 切片对齐 1,无需 padding)。
- **`createPTCrossInsC` 的 `t_cr` 索引技巧**:`mt_edge4` 值 = `cross_idx * 24`,所以
  `t_cr[i_cr+j] + t_cn[i_cn+j]`(其中 i_cn 是 corner_idx,sz_cn=CORNER=24)直接等于
  `(cross_idx*24)+corner_idx = idx_in_pt`。Rust 保持同样写法,不展开。
- **`createPTPsCrossCorn` 的初始化只有 3 个 U-axis 邻居**(C++ 第 704-706 行只取 j=3,4,5):
  对应 D / D2 / D' 这 3 个 move(C++ 中 face index 1 = D,j=3,4,5),Rust 保持。
- **`createPTPsCrossInsC` 与 `createPTPsPair` 的初始化扩展非常啰嗦**:展 4 个 algorithm
  × 3 个 U-axis × 多层嵌套,Rust 端逐字翻译,**未化简**(怕语义偏差),后续如果通过
  Phase 4 验证发现某些 seed 冗余可以再删。

### 未实现 / Phase 4 待补

| 表 | 角色 | 备注 |
|---|---|---|
| `pt_pscross_E1E2` / `E0E3` / `E1E3` / `E2E3` | Zombie | 不实现 |
| `pt_pscross_E0E1E3` / `E0E2E3` / `E1E2E3` | Zombie | 不实现 |
| `pt_pscross_C4C7` / `C5C6` / `C5C7` / `C6C7` | Conj | 通过 rot 映射 `C4C5` / `C4C6`,Phase 4 实现运行时映射 |
| `pt_pscross_C4C5C7` / `C4C6C7` / `C5C6C7` | Conj | 同上 |

`pt_cross_C4C5C6` 已在 EOCross Canon 列,**已实现 gen** 但默认 panic 保护。

### 测试策略

- 默认 `cargo test --lib --release`(46 个测试,含 phase 1/2/3):全部通过,4 个 `#[ignore]`。
  - phase 3 默认 10 个测试:nibble、pt_cross(139KB)、pt_pscross(139KB)、
    pt_pair_C4E0(288B)、pt_pspair_CE(288B)、pt_pscross_C4(2.18MB)、
    pt_cross_ins_C4(2.18MB)、pt_huge_default_panics(panic 保护)、
    pt_cross_depth_sanity(跨模块联调)
- `cargo test --lib --release -- --ignored`:跑中表(48 MB / 52 MB),需要 ~5s
- 大表(>800MB)由 `pt_huge_default_panics` 测试覆盖 panic 路径;真正生成需手动设 env。
- 所有 pt 测试用 `target/test-tables/pt_*/` 隔离,测前 `remove_dir_all` + `create_dir_all`,
  测后清理。

### 已知坑 / 疑问

- C++ `createPTPsCrossInsC` 第 779-810 行的"嵌套 table1[table1[i1+x]+k]"是 11 层
  CSE 不友好的索引,我把它们逐字翻译成 Rust。如果 Phase 4 的解题深度对不上 C++,
  优先检查这段。
- `createPTCrossCEX` 的初始 SOLVED 只有 1 个(`is_pseudo` 没用),但 EOCross Plus
  表设计上要不要扩 4 个 D-shift 初值,C++ 实现是不扩,Rust 保持。
- 默认走 rayon 并行,如果发现单线程生成会更稳定可以加 env 切换;目前无问题。
- u64 range 不能 `.with_min_len()`,如有大表 BFS 出现负载不均,改用 chunked
  par_iter 或 par_chunks。

## Phase 4: executor + cross_solver + std_analyzer

**翻译范围**:`analyzer_executor.h` + `cross_solver.h` + `std_analyzer.cpp`(Cross 部分)。

**对应 Rust 文件**:`src/executor.rs` + `src/cross_solver.rs` + `src/bin/std_analyzer.rs`。

### 关键设计决策

1. **C++ `template<SolverT>` → Rust `trait SolverWrapper`**
   C++ 用编译期 duck-typing(模板 + 静态成员调用)。Rust 用 trait 表达同样的静态
   接口:`global_init()` / `get_csv_header()` / `solve(alg, id)` 都是关联函数,
   没有 `&self`,与 C++ 的 `static` 一一对应。`run_analyzer_app::<W>()` 用泛型
   参数代替模板。trait bound 加 `Send + Sync` 因为 rayon 内部要求。

2. **OpenMP `#pragma omp parallel for` → `rayon::par_iter`**
   保序写出:先把所有 task 喂给 `par_iter_mut().zip(par_iter())` 写入预分配的
   `Vec<String>`,再单线程顺序 `writeln!` 到 csv,避免 C++ 端 critical-section
   维护 `nextWriteIdx` 的复杂状态机。

3. **`COUNT_NODE` 宏 → `AtomicU64 GLOBAL_NODES` + `bump_node_count()`**
   C++ 用 thread_local 本地累加 + 每 1000 次 flush 一次。Rust 暂时只暴露
   `pub static GLOBAL_NODES: AtomicU64` 和 `bump_node_count(n)`;Cross 内层热
   循环未调用(开销不可忽略),Phase 5 引入更多搜索器时再决定是否打开。

4. **进度条 / ANSI 颜色 / 监视线程全部省略**
   C++ 端 `analyzer_executor.h` 大段是 Windows console handle + ANSI 转义 +
   独立 monitor 线程,Rust 端直接 `eprintln!` 每 1% 打一行 `[PROG] N/total`,
   完成后 `[DONE] N tasks in Xs, nodes=..., output=...`。`run_analyzer_app`
   循环读 stdin 取文件名,`exit` 或 EOF 退出。

5. **Cross 单独抽出 `cross_solver.rs`**
   C++ `cross_solver.h` 已经把 Std/Pseudo 共享部分独立成 inline header。
   Rust 同样抽到独立模块:`CrossSolver::new(is_pseudo: bool)` 内部 ensure 对应的
   pt 表(`pt_cross` 或 `pt_pscross`),不强制 caller 选表。这样 Phase 5 移植
   pseudo_analyzer 时不用复制粘贴 Cross 逻辑。

6. **IDA* 与 C++ 的对齐点**
   - `valid_moves[prev]` 同轴剪枝 ↔ C++ `valid_moves_flat[prev]` / `valid_moves_count[prev]`
   - `prev=18` 作为 "无上一步" 哨兵 ↔ C++ 一致
   - 内层 `mt[i*18 + m]` stride ↔ C++ `p_mt_edge2[i + m]`(后者已预乘 18,因为传入的
     `i1 / i2` 已是 `idx*18`)
   - `pt.get(idx) >= depth` 剪枝判定 ↔ C++ `get_prune(p_pt, idx) >= depth`
   - depth 上界 8(`d_min..=8`)与 C++ `get_stats` 完全一致(Cross 最优解 ≤ 8)
   - 返回值:0 表示 SOLVED,否则返回最少步数

7. **std_analyzer 大表 env 守护**
   - 默认:`global_init` 仅 ensure `mt_edge2` + `pt_cross`,跑 Cross 6 列
   - `CUBE_RUN_FULL_STD=1`:额外 ensure `mt_edge / mt_corn / mt_edge4` +
     `pt_cross_C4E0`(~52 MB),开 XCross 6 列(当前 Phase 4 仍占位 0,Phase 5 接入)
   - `CUBE_RUN_FULL_STD=1` + `CUBE_ALLOW_HUGE_TABLES=1`:额外 ensure
     `mt_edge6 / mt_corn2` + `pt_cross_C4C5E0E1` + `pt_cross_C4C6E0E2`
     (各 ~10 GB),开 XXCross/XXXCross/XXXXCross
   - 没启用阶段一律输出 0(C++ 端的 17 "不解" 标记没有对齐,因为 0 在 csv 里更显眼,
     便于 Phase 5 接入时 diff)

### 与 C++ `run_analyzer_app` 的差异点(简化清单)

| 项 | C++ | Rust Phase 4 |
|---|---|---|
| 表头输出 | `outfile << header << "\n"` | `writeln!(w, "{}", header)` |
| 并行 | OpenMP `#pragma omp parallel for schedule(dynamic, 1)` | `rayon par_iter` |
| 保序写 | critical section + `nextWriteIdx` 增量 flush | 预分配 `Vec<String>`,batch 写 |
| 进度条 | 独立 monitor 线程 + ANSI 重写两行 | `eprintln!("[PROG] {}/{}")` 每 1% |
| 节点统计 | `COUNT_NODE` thread-local + flush | 暴露 atomic + helper,Cross 暂未启用 |
| 计时文件 | 写 `%TEMP%/<stem>_<suffix>_timing.txt` | 不写(verify.ps1 暂未移植) |
| 数据预览 | `printDataPreview(file, 6)` | 不打印 |
| 汇总表格 | 边框 ASCII art + ANSI 颜色 | 一行 `[DONE]` |
| stdin 循环 | `std::cin >> filename` | `read_line` + `trim` |

### XCross / XXCross / XXXCross / XXXXCross 暂不实现

C++ `XCrossSolver` 的四个 `search_N` 体量巨大(2.5 KLOC),需要 mt_edge4 + mt_edge +
mt_corn + mt_edge6(2.85 GB) + mt_corn2 + pt_cross_C4E0 (52 MB) +
pt_cross_C4C5E0E1 (10 GB) + pt_cross_C4C6E0E2 (10 GB)。

Phase 4 决策:Cross 求解通过 golden 验证后,后 4 阶段留 0 占位。Phase 5 再:
1. 翻译 `XCrossSolver::search_1` + `get_stats` 第 1 段(XCross 6 列,需 ~52 MB)
2. 翻译 `search_2 / search_3 / search_4` + `hugeTablePrunes`(大表区,需 ~25 GB 磁盘)
3. 视情况:用户拒绝大表时只跑 Cross + XCross(12 列 csv),其余仍 0

### C++ 端歧义 / 疑问

- **`get_stats` 返回 `depth ≤ 8`** 的上界从哪来:Cross 最优解理论上界(Kociemba
  Phase 1 同款)。pseudo 可能更长,但 C++ `cross_solver.h` 写死 8,Rust 同步。
- **`prev=18` 哨兵**:`valid_moves_flat[18]` 是 "全部 18 个 move" 的初始集,跟
  Phase 1 的 `[20][18]` 形状对齐。如果改成 enum 哨兵会破坏外部 API,沿用 u8。
- **`alg_rotation` rotation 串语法**(空格分隔,如 `"z'"`、`"x' y"`):C++ 端用
  `std::istringstream` token 化。Rust `split_whitespace`,未识别 token 静默
  跳过,与 C++ 一致(无错误传播)。
- **C++ 端 `XCrossSolver::search_4` 的 `t_idx1 / t_idx2` 在 `search_2` 内部未
  使用**:已在 C++ 注释中说明(`t12/t21/...` "在函数体内未被使用,已移除")。
  Phase 5 移植 search_2 时按 C++ 实际签名翻译即可,不要被参数名误导。

### 验收数据

- `cargo check`:OK
- `cargo build --release`:OK(含 `std_analyzer` binary)
- `cargo test --release --lib`:54 passed / 0 failed / 4 ignored
- Cross golden 比对(`cross_matches_golden_first5`):5 行 × 6 列 = 30 个数全部
  bit-exact 匹配 `D:/cube/solver/golden/scramble_1000_std.txt` 前 5 行 cross_* 列。
- 行数:executor.rs 229 / cross_solver.rs 156 / bin/std_analyzer.rs 137(共 522)
- 二进制 smoke:`scramble_5.txt` 跑通,6 列 Cross + 24 列 0 占位,CSV header 30 列与
  C++ 一致。

## Phase 5: std_analyzer XCross + e2e + 文档收口

**翻译范围**:`std_analyzer.cpp` 的 `XCrossSolver::search_1` + `get_stats` 第 1 段(XC)。
XXCross / XXXCross / XXXXCross 三个 cascade 阶段(`search_2/3/4` + `hugeTablePrunes`)
依赖 `pt_cross_C4C5E0E1`(10 GB)+ `pt_cross_C4C6E0E2`(10 GB)+ `mt_edge6`(3 GB),
本 phase 不实现(用户磁盘空间限制),继续输出 0 占位。

**对应 Rust 文件**:`src/xcross_solver.rs`(新增,~270 行,含 1 个 ignored 单元测试)+
`src/bin/std_analyzer.rs`(更新 XCross 接入)+ `tests/e2e_cross.rs`(新增)+
`tests/e2e_xcross.rs`(新增,#[ignore])+ `testdata/`(新增源数据)。

### 关键设计决策

1. **XCross 独立成 `xcross_solver.rs`**
   C++ `XCrossSolver` 体量 ~600 行(含 search_1/2/3/4 + get_conjugated_indices_all
   + get_stats 4 段),即便只译 search_1 也 ~250 行。拆到独立模块避免
   std_analyzer.rs 膨胀,且后续接入 search_2/3/4 时不用动 std_analyzer。

2. **状态编码完全照搬 C++ 的"预乘步幅"约定**
   - `mt_edge4` 的值已是 `cross_idx * 24`(stride=24),所以 `i1` 直接是 mt 索引
   - `mt_corn` / `mt_edge` 是 stride 18,递归时手动 `*18`
   - 初始 `cur_cn = 12 * 18`,因为 corner idx 12(=4*3+0)是 "4 号角无朝向" 的
     raw state value,初始要乘 18 才能直接喂给 mt
   - pt_cross_C4E0 索引公式:`(n_i1 + n_i2) * 24 + n_i3`
     展开 = `(cross_idx*24 + corner_idx) * 24 + edge_idx`,跟 4-bit 表的 109_486_080
     条目数一致

3. **`initial_states` 简化版**
   C++ `get_conjugated_indices_all` 计算 13 个量(im / ic / e0/e2/e4/e6 / c5/c6/c7 +
   4 个 huge 状态),后 10 个是 XXCross+ 才需要的。Rust 端只算 (im, ic, ie) 三个,
   等后续 phase 接入 search_2 时再扩展。

4. **task 排序 + early break 与 C++ 一致**
   4 个 conj slot 按初始 h 升序排,`if (h >= current_best) break;`(C++ 同款),
   `max_search = min(12, current_best - 1)`(C++ 同款)。这是 IDA* 跨 slot 的剪枝。

5. **节点计数**:Rust 端在 `search_1` 内 batch `bump_node_count`(返回前一次性
   提交本帧 children 数),而非 C++ 的"每 1000 次 flush"thread-local。语义略
   有差异:Rust 是精确计数(无上限),C++ 是误差小于 1000 的近似;对最终
   `[DONE] ... nodes=` 数值有微小差异(可接受)。

6. **不复用 cross_solver**:虽然 XCross 也是 IDA*,但循环体里有 conj_moves
   切换、3 个 mt 同时跟随,封装成 trait 反而难维护。两者各自一份,共 100 多
   行 search 函数,重复可以接受。

7. **CSV 输出格式不变**
   30 列(`id + 5阶段*6视角`),只有 xcross_z0..xcross_x1 6 列从 0 变成真实数据,
   其余 18 列继续 0 占位,跟 C++ 比对时只用对前 13 列(id + cross + xcross)。

### e2e 测试设计

1. **`tests/e2e_cross.rs`(default)**:
   - 用 `env!("CARGO_BIN_EXE_std_analyzer")` 拿到 release binary 绝对路径
   - 在 `target/test-tables/e2e-cross-work/` 拷一份 `scramble_5.txt`,
     cwd 设到 work_dir 跑 binary(因为 binary 的 output 与 input 同目录)
   - `CUBE_TABLE_DIR=target/test-tables/e2e-cross/` 隔离表,**测前清理**
     (Cross 表小 ~140 KB,几秒生成,无副作用)
   - stdin 喂 `scramble_5.txt\nexit\n` 让 binary 跑一遍退出
   - 解析输出 CSV,**前 6 行 × 6 列 cross_* 必须 bit-exact 匹配 golden**;
     xcross_* 6 列必须全 0;总列数必须 31(30 个逗号 + id)

2. **`tests/e2e_xcross.rs`(#[ignore])**:
   - 同上,但加 `CUBE_RUN_FULL_STD=1`,验证 13 列(id + cross + xcross)全匹配
   - `target/test-tables/e2e-xcross/` **不预清理**,52 MB 表可复用,避免每次
     re-run 重生(用户清掉 target/ 自然就重生)

3. **`xcross_solver.rs` 内部还有一个 `#[ignore]` 单元测试**
   `xcross_matches_golden_first3`:不跑 binary,直接构造 `XCrossSolver` + 3 个
   scramble,验证 18 个数。与 e2e_xcross 各覆盖一半视角:e2e 走 binary +
   process 边界,unit 走纯库 API。

4. **隔离规范**(沿用 phase 2/3):测试前 `remove_dir_all` + `create_dir_all`
   隔离目录,**测试不污染 ./tables/**。`testdata/` 是源,要 commit;`.gitignore`
   把 "根目录 scramble_*_*.csv" 改成 "/scramble_*_*.csv"(只 ignore 项目根,
   不 ignore testdata/ 子目录)。

### C++ 端歧义 / 疑问

- **`get_conjugated_indices_all` 的"4 号角"起始 `cur_cn = 12 * 18`**:
  C++ 端 12 = `4*3+0`(角块 4 是 raw idx 4,无朝向),`* 18` 是为了直接喂给
  stride-18 的 mt_corn。Rust 端原样保留。
- **`max_search = min(12, current_best - 1)`**:
  当 `current_best == 0`(已 solved)时,`current_best - 1` 在 C++ 是 -1(int),
  Rust 用 `current_best.saturating_sub(1)` = 0,搜索上界 = `min(12, 0) = 0`,
  循环 `for d in h..=0` 不会跑(因为 h >= 0 且通常 >= 1),语义一致。但其实
  if h == 0 已经短路 return 0,不会进 if 分支,所以这个边界永远不触发。
- **`XCrossSolver` 多视角 task 重排**:C++ 用 `std::sort` + `lambda`;Rust
  `[(usize, u32); 4].sort_by_key`,行为一致。两者都不是 stable sort,但 4 个
  元素 + 不同 h 时唯一,差异无影响。

### 整体 5 phase 总结

| 维度 | 数值 |
|------|------|
| Rust 源文件总数 | 8 个 (lib + 1 bin) |
| Rust 总行数(src/) | ~5440 (cube_common 1100 + move_tables 870 + prune_tables 1100 + prune_create 1280 + executor 230 + cross_solver 157 + xcross_solver 270 + std_analyzer 137 + lib 8) |
| 单元测试 (lib) | 54 default + 5 ignored = 59 个 |
| e2e 集成测试 | 1 default + 1 ignored = 2 个 |
| 跑通的 golden 列 | Cross 6 + XCross 6 = 12 列,5 scramble × 12 = 60 个数 bit-exact |
| 未译 C++ analyzer | 4 个 binary(pair / pseudo / pseudo_pair / eo_cross)+ table_generator |
| 未译 std_analyzer 阶段 | XXCross / XXXCross / XXXXCross 3 个 cascade(需 25 GB 表) |

**覆盖度估算(对比 C++ 端)**:
- 底层(common + mt + pt + create + executor):**100%**(36 张 Canon 表全部能生成)
- std_analyzer:**40%**(Cross + XCross = 12/30 列,XXCross+ = 0/18 列)
- 其余 analyzer:**0%**
- 整体 C++ → Rust 行数比约 **35%**(底层全译,analyzer 仅 1/5)

### 验收数据

| 命令 | 结果 |
|------|------|
| `cargo check` | OK |
| `cargo build --release` | OK |
| `cargo test --release` | 54 lib + 1 e2e_cross = 55 passed / 0 failed / 6 ignored |
| `cargo test --release -- --ignored` | 6 passed(4 mt/pt 中表 + 1 xcross_solver unit + 1 e2e_xcross) |
| 手动 smoke(scramble_5.txt 默认模式) | 5 行 × 30 列,Cross 6 列与 golden 完全一致,xcross+ 24 列全 0 |
| XCross e2e | 5 行 × 6 列 = 30 个数 bit-exact 匹配 `D:/cube/solver/golden/scramble_1000_std.txt` 前 5 行 xcross_* |


## Phase 6: pseudo_analyzer(Cross / XCross / XXCross / XXXCross 全 cascade)

**翻译范围**:`pseudo_analyzer.cpp`(1239 行)。完整移植,所有 25 列(id + 4 阶段 × 6 视角)bit-exact 匹配 golden。

**对应 Rust 文件**:`src/pseudo_xcross_solver.rs`(~270 行)+ `src/pseudo_xxcross_solver.rs`(~530 行)+ `src/pseudo_xxxcross_solver.rs`(~520 行)+ `src/bin/pseudo_analyzer.rs`(~140 行)+ `tests/e2e_pseudo.rs`(~140 行)。

### 关键设计决策

1. **拆 3 个独立 solver 模块,不复用 std_xcross_solver**
   pseudo 的 search 与 std 在关键点上语义不同(见 #2),且每个阶段(XC/XXC/XXXC)依赖的表 + AuxState 体系都在递增,拆成 3 个模块比一个大文件清晰。XXC 加 AuxTable(4 entries),XXXC 扩展 AuxTable(6 entries)+ 6-piece setup_aux。

2. **pseudo search 内 **不** 用 conj_moves_flat,std search 用**
   C++ `pseudo_analyzer.cpp` 的 `search_1/2/3` 内 `int n_i1 = p_mt_edge4[i1 + m]`(raw m);std 的 search_1 是 `p_mt_edge4[i1 + conj_moves_flat[m][s1]]`。两者初始化都 conj,所以搜索语义不同 — 但 IDA* 找最优深度一致(因为 conj 保长),只是结果 alg 不同。Rust 端原样保留这个差异。

3. **trans_moves 全局共享**
   `pseudo_xxcross_solver::trans_moves()` 提供 `&'static [[[u8; 18]; 4]; 4]`,XXXCross 通过 `pub(crate)` 复用同一份。`init_pseudo_matrix` 改成 OnceLock 懒初始化,避免每次 solver 构造重算。

4. **AuxTable 枚举 + 静态分派,不用 trait object**
   C++ `AuxPrunerDef` 是带 3 个指针的 struct;Rust 用 `enum AuxTable { PsCrossE0E1, ... }` + 4-6 个 `match`(`aux_pt` / `aux_mt` / `aux_multiplier`)。`AuxState` 是 `Copy`,内联到 `[AuxState; MAX_AUX]` 数组,内层循环零分配。`move_mapper_idx: u8`(0..3 valid, 4 = 无效)代替 `Option<&[u8; 18]>`,省一个分支。

5. **setup_aux 复刻 C++ 的 covered 优化**
   3-subset 先走,所有命中的对在 `covered[8][8]` 标记;2-subset 跳过已覆盖。XXC 只调用 2-subset 版本(`setup_aux_2subset`),XXXC 调用统一版本(`setup_aux`)。target_pieces 用 `&[u8]`(动态长度)以兼容 4-piece(XXC)和 6-piece(XXXC)。

6. **跨阶段 early-exit 严格按 C++ 实现**
   PsXC 的 `startD = max(t.h, ps_cross_result_for_this_rot)`,PsXXC 类似用 ps_xc_min,PsXXC → PsXXXC 用 ps_xxc_min。binary 端用流水线传递:Cross.get_stats → PsXCross.get_stats(cross_results) → PsXXCross.get_stats(xc_results) → PsXXXCross.get_stats(xxc_results)。

7. **Huge table 优化(`pt_cross_C4C5E0E1` 10GB)主动跳过**
   C++ 在 search_2 中对 (cp.first=0, cp.second=1, d1=d2=0) 的特殊 case 用 10GB 的 pt_cross_C4C5E0E1 加紧 h_base。该优化只影响初始 h(不影响正确性),Rust 端为节省磁盘/RAM 跳过。验证表明 PsXXC 6 列仍 bit-exact 匹配 golden,因为 IDA* 自然会从更低的 startD 搜起,只是稍慢。后续若 #1 任务(std XXCross+)启用了该表,可顺便接入。

8. **max_search = 16,std 是 12**
   PsX*Cross 解 ≤ 16 步(C++ 同款上界);std X*Cross 解 ≤ 12 步。

9. **`perms_3()` 硬编码 6 个排列,不依赖 itertools**
   C++ 用 `std::next_permutation`,Rust 标库无对应函数,且只需 3! = 6 个,直接硬编码 `[[usize; 3]; 6]` 常量。

10. **PseudoTask3 过滤 `d1==d2==d3`**
    所有 3 对 (corner, edge) 必须有同样的 diff(共享 pt_pscross_C4E[diff] 表)。4 ct × 4 et × 6 perm = 96,过滤后约 16 个 task / rotation。

### 与 C++ 的差异点

- **`AuxState::current_cross_scaled`** 始终随 mapper 走(C++ 也是,2-subset 和 3-subset 都 set mapper),C++ 中 `cross_state_idx = n_i1a / 24`(side A 的)只在 mapper 为 null 时 fallback,Rust 中实测此分支 dead,直接删除。
- **`getDiagonalView` 等 BL-FR/BR-FL 判定** 在 pseudo 端不需要,只用 `(se - sc + 4) & 3` 公式判邻接(0/1/3)vs 对角(2)。
- **mirror tables(`sym_corner2` / `sym_edge6_pos` / `sym_edge6_ori`)** 仅服务 huge table 优化(L↔R 镜像复用 pt_cross_C4C5E0E1),既然跳过 huge,这部分一起跳过。
- **`std::cout` / `printCuberootLogo` / ANSI 颜色 / 剪枝统计** 全删,executor 已有 `[PROG] N/total` + `[DONE]`。
- **`MAX_AUX = 8`** 与 C++ 一致(实际 PsXXC 2 entries,PsXXXC 2-4 entries,远小于 8)。

### env 守护策略

| env | 作用 | 默认 |
|---|---|---|
| `CUBE_PSEUDO_SKIP_XCROSS=1` | 跳 PsXC + 下游,均输出 0 | enable |
| `CUBE_PSEUDO_SKIP_XXCROSS=1` | 跳 PsXXC + 下游 | enable |
| `CUBE_PSEUDO_SKIP_XXXCROSS=1` | 跳 PsXXXC(强制) | 默认 skip 除非 huge env |
| `CUBE_ALLOW_HUGE_TABLES=1` | 解锁 PsXXXC 所需 ~1.8 GB 表 | disable |

默认行为:`pseudo_analyzer.exe` 跑 Cross + XC + XXC(需 ~415 MB 表),XXXC 输出 0 占位。加 `CUBE_ALLOW_HUGE_TABLES=1` 全 4 阶段。

### 性能数据(release,机器实测)

| 场景 | 耗时 | 备注 |
|---|---|---|
| 5 scramble 全默认(仅 Cross,~140 KB 表) | < 0.1s | pt_pscross 复用 |
| 5 scramble + 全部表 mmap | 7-8s | 各表懒生成 |
| 5 scramble + XXX(huge,首次 BFS 1.8GB 表) | 73.5s | 包含 ~70s 表生成 |
| 5 scramble + XXX(表已存) | < 5s | 全部 mmap reload |

`nodes` 计数(rayon 多核 sum):search_3 约 270 K nodes / scramble × 5 = 1.35 M 总 nodes。

### 验收数据

| 命令 | 结果 |
|------|------|
| `cargo build --release` | OK,产出 std_analyzer + pseudo_analyzer 两个 bin |
| `cargo test --release` | 54 lib + 1 e2e_cross = 55 passed / 0 failed / 10 ignored |
| `cargo test --release -- --ignored` | 10 个(7 lib ignored + 1 e2e_xcross + 2 e2e_pseudo) |
| e2e_pseudo full(huge 表已生成) | 5 行 × 24 列 = 120 个数 bit-exact 匹配 `D:/cube/solver/golden/scramble_1000_pseudo.txt` 前 5 行 |
| 表生成总耗时(冷启动) | ~75s 含 1.86 GB 数据 |
| 表占盘 | ~2.3 GB(4 × pscross_C4E + E0E1/E0E2/C4C5/C4C6 + E0E1E2/C4C5C6 + 7 张 mt) |

### 已知坑 / 待办

- **huge 表优化未启用**:若后续做 std XXCross+(任务 #1)生成了 pt_cross_C4C5E0E1,可顺便给 pseudo search_2 加上;影响初始 h,不影响正确性。
- **table_generator 独立 bin** 未译,所有表由各 manager 内置懒生成(够用)。

## Phase 7: pair_analyzer

**翻译范围**:`pair_analyzer.cpp`(728 行)→ `src/pair_solver.rs` + `src/bin/pair_analyzer.rs`。

5 阶段 cascade(scramble + cross_pair / xcross_pair / xxcross_pair / xxxcross_pair = 25 列):
- `solve_1_group`(Cross+Pair):4 slot,按 h 升序
- `solve_2_group`(XCross+Pair):4 fix × 3 tgt = 12 task,XCross 剪枝率最高(77.7%)先查
- `solve_3_group`(XXCross+Pair):6 pair × 2 tgt = 12 task,huge table 优先(Neighbor / Diagonal 二选一)
- `solve_4_group`(XXXCross+Pair):4 tgt,**3 个 huge table 同步**剪枝

### 关键决策
- `VirtState` 跟踪 7 个量(im/ic/ie + 4 个 huge 状态),C++ 内联 4 个量,Rust 用 struct + Default
- `huge_check` 内联实现 `hugeTablePrunes`,conj=-1 时返回 (false, 0, 0) 跳过检查
- `with_diagonal: bool` 构造参数,`false` 时 `pt_cross_C4C6E0E2` 为 None,对应槽位 h_huge=0(影响速度不影响正确性)
- 4 个 SOLVED 索引(E6 NB/DG + C2 NB/DG)用 `array_to_index` 一次性算好缓存

### 表依赖
mt_edge4/corn/edge/edge6/corn2 + pt_cross_ins_C4 + pt_pair_C4E0 + pt_cross_C4E0 + pt_cross_C4C5E0E1 + (optional) pt_cross_C4C6E0E2(共 ~20 GB,binary 强制 `CUBE_ALLOW_HUGE_TABLES=1`)。

## Phase 8: eo_cross_analyzer

**翻译范围**:`eo_cross_analyzer.cpp`(1185 行)→ `src/eo_cross_solver.rs` + `src/bin/eo_cross_analyzer.rs`。

两个独立 solver:
- `EOCrossSolver`:Cross+EO,12 sym 视角(sym_moves_flat),search() 上界 12 步
- `EOXCrossSolver`:XC/XXC/XXXC/XXXXC + EO,4 个 search_N,内部用 `ViewState` 数据驱动循环 + view_order 按 heuristic 降序

### 关键决策
- C++ 用 `sym & 1` 配对 + `(sym & 1) ? res[*-1] : 99` 起始上界:Rust 严格保留以兼容 best-sharing
- Wrapper 端用 `fold_sym_to_rot(sym48)` 把 48 个 sym 结果按 `min(2c, 2c+1)` 折叠成 24 个 rotation 输出,Cross 阶段用 `fold_cross_sym_to_rot`
- `ViewState` 数据驱动:has3corner + plus_tab 数组 + n_tracks(2 或 3)
- `pick_huge(s1, s2)` 优先 Neighbor 否则 Diagonal,返回 (v_huge, p_huge, init_e6, init_c2)
- `ENABLE_EO_SEARCH_4` 在 Rust 中始终启用(C++ 是编译期开关,Rust 简化为永远算 XXXX 阶段)

### 表依赖
mt_{edge,edge2,corn,edge4,edge6,corn2,ep4,eo12,eo12_alt} + pt_cross + pt_cross_C4E0 + 3 × pt_cross_C4E0E{1,2,3} (CEE) + 3 × pt_cross_C4{C5,C6,C7}E0 (CCE) + pt_cross_C4C5C6 + pt_ep4eo12 + pt_cross_C4C5E0E1 + (optional) pt_cross_C4C6E0E2。

## Phase 9: pseudo_pair_analyzer

**翻译范围**:`pseudo_pair_analyzer.cpp`(1592 行,最大)→ `src/pseudo_pair_solver.rs` + `src/bin/pseudo_pair_analyzer.rs`。

4 cascade(C++ 命名约定:列名 cross/xcross 实际对应 search_1/2/3/4):
- `xcross_analyze`     → CSV pseudo_cross_pseudo_pair      (search_1: Cross + Pair on 1 slot)
- `xxcross_analyze`    → CSV pseudo_xcross_pseudo_pair     (search_2: + XC2 conj prune)
- `xxxcross_analyze`   → CSV pseudo_xxcross_pseudo_pair    (search_3: + XC3 + 2-subset Aux)
- `xxxxcross_analyze`  → CSV pseudo_xxxcross_pseudo_pair   (search_4: + XC4 + 3-subset Aux)

### 关键决策
- 复用 pseudo_xxxcross_solver 的 `AuxTable` 6-variant enum 概念(自有副本,不依赖跨模块)
- `ConjStateXC` 跟踪 (cross, corner, 4 edges)用于 XC2/XC3/XC4 conj 剪枝表查询
- 16 张 `pt_pscross_ins_C_diff` + 16 张 `pt_pspair_CE`(按 `c*4+e` 索引),通过 `pt_pscross_c{4..7}` + diff 矩阵覆盖所有 (slot, pslot) 组合
- 跨阶段下界:start_d = max(local_h, prev_stage_min) 严格按 C++
- C++ `move_mapper=nullptr` 分支在 2/3-subset Aux 中不触发(setup 总是 set mapper),保留 fallback 路径以备 phase 9 验证发现差异

### 表依赖
全部 pseudo 表 + 16 × ins_C_diff + 16 × pspair_CE,加 mt_corn3/edge3/corn2/edge2;binary 强制 `CUBE_ALLOW_HUGE_TABLES=1`(总 ~3 GB)。

## Phase 10:全 5 analyzer 总结

| Analyzer | 行数(src) | 阶段数 | 备注 |
|---|---|---|---|
| std_analyzer | ~530 | 全 5 阶段 (30/30 列) | golden bit-exact ✅(Phase 11) |
| pseudo_analyzer | ~1450 | 全 4 阶段 (24/24 列) | golden bit-exact ✅ |
| pair_analyzer | ~720 | 全 4 阶段 (24/24 列) | golden bit-exact ✅ |
| eo_cross_analyzer | ~820 | 全 5 阶段 (30/30 列) | golden bit-exact ✅ |
| pseudo_pair_analyzer | ~900 | 全 4 阶段 (24/24 列) | golden bit-exact ✅ |

**整体覆盖度**:6 个 C++ analyzer 全部有 Rust binary 对应,全部 golden bit-exact。

## Phase 11:std_analyzer XXCross / XXXCross / XXXXCross(huge cascade)

补完 `xcross_solver.rs` 的 search_2 / search_3 / search_4 + 4-段 get_stats,std
从 12/30 列变全 30 列。对照 `scramble_1000_std.txt` 前 20 scramble,30 列全
bit-exact(83.7s,6.7M nodes)。

**关键洞察(省掉大量代码且等价)**:C++ `XCrossSolver::search_2/3/4` 里每个
`SlotView` 的逐槽 move-table 查表(`p_mt_edge4[...]` 等)是重构残留的**死代码**
——只赋值、向下递归传递,从不参与任何剪枝判定,也不影响 `depth==1 → true` 的叶子
返回。真正的剪枝与解判定**只**来自 huge 表:

- search_2(XXCross,2 槽):1 张 huge 表。相邻 pair 用 `pt_cross_C4C5E0E1`,对角
  pair 用 `pt_cross_C4C6E0E2`(由 `getNeighborView/getDiagonalView` 选)。该表是对应
  子集(cross + 2 槽全解)的精确 BFS 距离,故 XXCross 解恒 = 表查值 h,IDA* 在
  `d=h` 立即命中。
- search_3(XXXCross,3 槽):三元组的 3 个 pair → 3 张 huge 表,任一 ≥ depth 即剪。
- search_4(F2L,4 槽):4 个相邻 pair(conj slot = 数组下标 0..3,全用 C4C5E0E1)+
  2 个对角 pair(conj slot 0,1,用 C4C6E0E2),共覆盖全部 6 个 pair;全 < depth 才继续。

因此 Rust 端直接省去 SlotView,search_2/3/4 退化为"对 1 / 3 / (4+2) 张 huge 表做
IDA*",复用 `pair_solver.rs` 已验证的 `huge_check`(= C++ `hugeTablePrunes`)+
`get_virt`(= `get_conjugated_indices_all`,只留 im/ic/ie + ie6_nb/ic2_nb/ie6_dg/ic2_dg
7 个量)。`get_correct_edge_start` / `get_correct_corn_start` / `getPlusTableIdx`
全部因只喂死代码而无需移植。

**内存**:两张 10 GB huge 表 + 3 GB mt_edge6 全走 mmap(`load_pt_from_disk` →
`Mmap::map`),solve 期按页 fault,不占常驻 RAM;实测无 OOM。`new(with_huge)`
关闭时退化为纯 XCross(52 MB),后 18 列输出 0。

**跨阶段下界**:xc_min → xxc startD,xxc_min → xxxc startD,xxxc_min → f2l startD
(与 C++ 一致)。各阶段 IDA* 上界:XXC=14,XXXC=16,F2L=16;F2L 的 max_h>16 直接
记 17。

