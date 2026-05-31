# WASM_PORT_PLAN

> Rust cross 求解器 → 浏览器 WASM。跟踪文档,**每个 phase 收尾更新本页**。
> 维护者先读这页 + `TESTING.md`。

## 目标

把 `cuberoot.me` 的 `/solver` 页现在那套 **C++→WASM** cross 系列求解器
(cross / xc / xxc / xxxc / xxxxc,三阶)换成 **Rust→WASM**,性能不退、最好更好。

- 原生批处理版(`std_analyzer` 等 6 个 binary)**保持不变**,继续用 20GB 大表跑全量。
- 新增一个浏览器交互版:同一份 Rust core,换小表启发式,编进 WASM 接进 `/solver` UI。

## 为什么不能直接搬

`std_analyzer` 的 XXCross/XXXCross/XXXXCross 三阶段吃 ~23GB 大表
(`pt_cross_C4C5E0E1` neighbor 10GB + `pt_cross_C4C6E0E2` diagonal 10GB + `mt_edge6` 3GB)。
WASM32 地址空间 ≤4GB(浏览器实际 ~1-2GB),且 **WASM 无 mmap** —— solver-rust 的
memmap2 零拷贝读表模型在浏览器里不成立。结论:不是"优化内存能压进去",必须换更小的
**可采纳启发式**(admissible heuristic)+ 更深 IDA* 搜索,牺牲速度保最优。

## 架构决策(已定)

一份共享 Rust core(坐标模型 + move table + IDA* loop),启发式抽到 trait 后面,
两套后端用 Cargo feature 切:

| feature | 用途 | 启发式表 |
|---|---|---|
| `big-tables`(默认) | 原生批处理,现状不动 | 现有 ~23GB 大表(EDGE6×CORNER2 精确 BFS) |
| `wasm-small` | 浏览器 | 小可采纳表(目标 <150MB)+ 更深搜索,仍返回最优解 |

**关键事实(读码确认):** 启发式在代码里已经是抽象的 —— `PackedPruneTable::get(idx)`
被 `cross_solver` / `xcross_solver` 的 IDA* 当下界消费。big vs small 的差别只在
"每个 IDA* 节点查哪张表、查值多紧"。所以 trait 化阻力小。

cascade 各阶段启发式现状 + 小表替代候选:

| 阶段 | 现状(big) | 表大小 | WASM 小表候选 |
|---|---|---|---|
| Cross | `pt_cross` 全精确 | 140KB | 原样,已够小 ✅ |
| XCross | `pt_cross_C4E0` 单槽精确 | 52MB | 原样,可接受 ✅ |
| XXCross | EDGE6×CORNER2 精确,h==解 | 10GB | **候选 A**: max 两个单槽 `pt_cross_C4E0`(admissible);**候选 B**: EDGE6-only 投影表(丢 corner 维,~21MB/类型) |
| XXXCross | max 3 个 pair 的 huge | (同上) | max 3 个候选 A/B |
| XXXXCross | max 4 nb + 2 dg pair 的 huge | (同上) | max 6 个候选 A/B |

> **已定(Phase 1+2 实测):全程采纳候选 A**。零新表(仅复用 52MB `pt_cross_C4E0`)、
> 内存最省、且实测速度足够(见下)。候选 B 不需要,留作未来 xxxxc 提速备选。

## 验收口径(死规矩)

- **只用 `testdata/scramble_5.txt`**;std 输出必须 **bit-exact** 等于
  `testdata/golden/scramble_5_std.csv`(30 列全 cascade)。
- 小表是 admissible 的 → IDA* 仍返回最优,逐格必须 == golden。**有一格不等就是错的**,
  不许放宽成"接近"。
- 性能只参考,不苛求(用户原话)。
- 验法:`pwsh verify.ps1 -Inputs scramble_5.txt`,或对应 cargo test。

## Phases

| # | 名称 | 状态 | 产出 / 验收 |
|---|---|---|---|
| 0 | 摸底 + 基线 | ✅ done | 表确认在位;big-table native cross→xxxxcross 瞬时;or18(C++ WASM 现状)浏览器内能跑 cross→xxxcross,无 xxxxcross。dev MIME/404 让 or18 计时不可信,权威基线交给 Phase 2 native bench |
| 1 | 启发式抽 trait + 小表后端 | ✅ done | 小表 cascade(`get_stats_small`/`search_multi`/`solve_subset`,候选 A 单槽 max admissible)+ Cargo features `big-tables`(默认)/`wasm-small` + std_analyzer feature gate。**验收达成**:`wasm-small` native 跑 scramble_5 std == golden **bit-exact**(unit test + 整合二进制双验)。big 路径一字未动 |
| 2 | native 小表逐变体基准 | ✅ done | 见下「Phase 2 基准」。结论:候选 A 全程足够,无需候选 B;xxxxc 用 worker 防卡 UI |
| 3 | wasm-pack 构建 + 表加载 + worker | ✅ done | 见下「Phase 3 产物」。**nodejs 端到端 bit-exact 25/25**(5 scramble × 5 变体);native 54 单测全过(refactor 没破 big 路径) |
| 4 | 接 `/solver` UI + parity | ✅ done | 自包含 Rust-WASM 分析器页落 `tools/solver/rust-cross/`(经 Next catch-all 访问,prod 回退 static.cuberoot.me);**真浏览器端到端 bit-exact 25/25**(init 525-601ms);见下「Phase 4 集成」 |

> Phase 0-3 在 `D:\cube\solver-rust`;Phase 4 在 `D:\cube\cuberoot.me\core`
> (`/solver` 走 repo 根 `tools/`,Next catch-all `app/tools/[...slug]/route.ts`)。

## Phase 2 基准(release,单视角 rot="",scramble_5 全 5 条)

`cargo test --release -- --ignored --nocapture bench_small_per_stage`

| 变体 | 5 条总耗时 | 最坏单条 | 节点(5 条累计) |
|---|---|---|---|
| cross | 0.1ms | — | 0(纯查表) |
| xc | 0.1ms | 0.1ms | 268 |
| xxc | 9.3ms | 7.6ms | 6.2 万 |
| xxxc | 138.9ms | 43.5ms | 380 万 |
| xxxxc | 1847.8ms | **1128.7ms** | 5050 万 |

- cross→xxxc:单视角 <50ms,WASM ×3 仍 <150ms → 浏览器级流畅。
- xxxxc(or18 都没有的新能力):最坏单视角 ~1.1s native → WASM ~2-3s;analyzer 若跑 6 视角
  最坏 ~6-18s。用户明说性能不苛求 → 候选 A 采纳,xxxxc 走 web worker 不卡 UI + 进度提示。
- 整合二进制(6 视角全 cascade)scramble_5 = 12.2s / 5 条,5.6 亿节点,零 huge 表。

## Phase 3 产物(`pkg-web/`,跑 `pwsh build_wasm.ps1` 复现)

| 文件 | 大小 | 说明 |
|---|---|---|
| `cross_solver_bg.wasm` | 48KB | 纯求解器代码(表另 fetch) |
| `cross_solver.js` | 10KB | wasm-bindgen 胶水(`--target web`) |
| `cross-solver-worker.js` | 2KB | 模块 worker:加载 wasm + 6 表,后台求解 |
| `cross-solver-client.js` | 2KB | 主线程封装,Promise 化 `solve(scramble, variant)` |
| `tables/*.bin.gz` | ~27MB | 6 张表 gzip(运行时 fetch + DecompressionStream 解压) |

WASM API:`new CrossSolverWasm(pt_cross, pt_cross_C4E0, mt_edge2, mt_edge4, mt_corn, mt_edge)`,
`solve(scramble, variant)→Uint32Array[6]`(variant 0..4=cross/xc/xxc/xxxc/xxxxc,6 视角),
`solve_cumulative(scramble, variant)`(累计变体)。

构建踩坑(已固化进 `build_wasm.ps1` / `.cargo/config.toml` / `Cargo.toml`):
- `.cargo/config.toml` 的 `target-cpu=native` 必须 cfg 限定到 non-wasm,否则 rustc 报 skylake/+fma。
- wasm-bindgen CLI 必须与 Cargo.toml 的 `wasm-bindgen` crate **精确同版本**(0.2.122);
  rustc 1.95 默认开 reference-types,CLI 太旧报 `clone_ref` intrinsic。
- memmap2/rayon 是 native-only dep(`[target.'cfg(not(wasm32))']`);WASM 走
  `from_bin` + solver `from_tables` 绕过 manager(整块 `#[cfg(not(wasm32))] mod manager`)。

## Phase 4 集成

产物落 `D:\cube\cuberoot.me\tools\solver\rust-cross\`(代码 ~70KB + `tables/*.gz` 27MB):
`app.html`(分析器 UI)、`parity.html`(golden 自检)、`cross_solver.js/_bg.wasm`、
`cross-solver-worker.js`、`cross-solver-client.js`、`tables/`。经 Next catch-all
(`app/tools/[...slug]/route.ts`)访问:dev `/tools/solver/rust-cross/app.html`,
prod 回退 `static.cuberoot.me/tools/solver/rust-cross/*`。路由 MIME 兼容(`.js`→
application/javascript 给 module worker;`.wasm`→octet 走 ArrayBuffer fallback;
`.gz`→octet 原始字节给 DecompressionStream,不双解压)。

**验证:** 干净静态服务器上真浏览器端到端 **bit-exact 25/25**(5 scramble × 5 变体),
init(wasm + 27MB 表 fetch + 解压)525-601ms;UI 页对 T-perm 正确给出全 0(PLL 不动前两层)。

**与 or18(根 `tools/solver/index.html`,upstream fork)的差异(就地替换前须知):**
- or18 analyzer 表是**逐 slot 组合多行**(cross 1 行 / xcross 4 行 BL,BR,FR,FL /
  xxcross 6 对 / xxxcross 4 三元组),每格 onclick=`solve(name,rot)` 联动 or18 自己的 F2L
  solver;**无 xxxxcross**。我的 Rust 端口给的是**逐变体 min-over-combos**(= golden 口径)+
  **新增 xxxxcross**。
- or18 `Count>1` 时格子显示**前 n 解的平均步数**(难度指标);我的 IDA* 只给最优(=n=1)。
  多解枚举是 or18 没移植的能力。
- 故**就地替换** `index.html` 的 analyzer 需:① Rust 出逐组合值(已有 `solve_combo` 思路,
  易加)+ 核对 slot 0-3↔BL/BR/FR/FL;② 复刻 or18 那套 HTML 行/表头/onclick 协议;
  ③ n>1 走 or18 C++ worker 兜底(平均缺口)。这是对 307KB 上游 fork 的破坏性改动 + 有语义缺口,
  **留作用户拍板的后续**;当前先交自包含页(零上游风险、可逆、含 xxxxcross)。

## 当前进度

- **Phase 0-4 全 ✅。** Rust→WASM cross 求解器:小表可采纳启发式、native + 浏览器双端
  bit-exact、48KB wasm + 27MB gzip 表、web worker 不阻塞、自包含分析器页接进 `/solver` 区。
- 可选后续(用户拍板):把根 `tools/solver/index.html` 的 C++ analyzer 就地换成 Rust(见上差异)。

## 关键文件

- 入口:`src/bin/std_analyzer.rs`(30 列 cascade)
- 搜索:`src/cross_solver.rs`(Cross IDA*)、`src/xcross_solver.rs`(XC/XXC/XXXC/XXXXC,search_1/2/3/4)
- 表:`src/prune_tables.rs`(`PackedPruneTable`,启发式接口)、`src/move_tables.rs`、`src/prune_create.rs`(BFS 生成)
- 坐标 / state:`src/cube_common.rs`、`DEFINITIONS.md`
- 测试:`TESTING.md`、`verify.ps1`、`testdata/golden/scramble_5_std.csv`
- 移植决策:`PORTING_NOTES.md`

## 性能:xxxxcross(2026-05-29 实测 + 定论)

scramble_5 6 视角 xxxxcross native release 基线(`bench_xxxxc_per_scramble`):

| scramble | 6 视角 ms | 节点 |
|---|---|---|
| 22001 | 3831 | 94M |
| 23001 | 2053 | 54M |
| 24001 | 2599 | 60M |
| **25001** | **11971** | **325M** |
| 26001 | 938 | 26M |
| 合计 | 21.4s | 560M |

**瓶颈 = 每节点启发式弱**(max 单槽 pt_cross_C4E0 = cross+1角+1边),到 15 步答案 gap ~5,depth-14 树爆。

**关键定论:手机约束下无法靠更强的"打包表"再压**。验证过:
- `cross×corner2`(cross+2角,48MB)、`cross×edge2`(cross+2边,50MB)、二者合并 —— 根启发式 gap 几乎不收窄(30 例平均 5.03 → 仅 4.60)。根因:任何 `CROSS×{504/528}` 表把"多 pair 之间的干涉"投影掉了,而那正是 xxxxc 贵的根源。
- 真正能消除干涉的是 huge 的 EDGE6×CORNER2(全 6 边联合),但导航需 `mt_edge6`(3GB)—— WASM/手机装不下。这是 big 路径 native-only 的根本原因。
- or18 的 in-browser xxxxc 用「启动 BFS 生成 4 张 `cross×单角`(190080×24)表,max-of-4」。但 `cross+角` 每项**弱于**我们现有的 `cross+角+边`(pt_cross_C4E0),由 dominance,or18 启发式 ≤ 我们的 → 节点不会更少。or18 的唯一优势是表小到能启动生成(省下载),代价是换弱启发式。

**结论 + 采取的措施:**
1. 保留现有强启发式(pt_cross_C4E0,52MB 打包)= 单视角最快的手机可行方案。325M 是"打包表的下限"。
2. **UI 懒按面**:xxxxcross 不预算 6 视角,点格子才解该面(对齐 or18 一次一视角)。最坏单面浏览器 ~5s,可接受。这是把"感知慢"(6×)消除的实际手段。
3. 进一步提速只剩 3GB 表(手机不可能)或 SIMD(本搜索是指针追逐,SIMD 收益有限)。已是约束内极致。

> 实验产生的 junk 表在 `tables/pt_cross_C4C5.bin`/`C4C6`/`E0E1`/`E0E2`(各 ~48-50MB,gitignored),可删。
