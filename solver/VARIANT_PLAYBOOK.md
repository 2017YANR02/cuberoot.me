# 新 substep 求解器 Playbook

> 给 AI 的完整流程:用户说「造个 Roux S1 求解器」之类时,从语义设计到 analyzer 在线求解、
> 本地统计管道、看板同步的全链路。范本 = 2x2x2 块(`block222`,2026-06-10),它是最简单
> 也最完整的参照——除非另有说明,每一步都「照 block222 抄」。

## 0. 语义设计(先想清楚再写代码)

1. **定义目标件集合**:substep = 一组角块 + 棱块同时归位(位置+朝向)。
   上游语义参照 cstimer(本地 clone `D:\cube\cstimer\src\js\tools\`):
   `gsolver.js`(2x2x2 块 / Petrus / Roux S2 / EO+DR 等 facelet-pattern 求解器)、
   `roux1.js`(Roux S1 坐标式)、`cross.js` / `eoline.js`。块类 substep 的件集合可由面交集推导:
   角 = 3 面交,块内棱 = 两两面交(见 `block222_solver.rs` 的 `CORNER_FACE_MASK` / 测试里的 `EDGE_FACE_MASK`)。
2. **状态空间** = `P(8,c)·3^c × P(12,e)·2^e`(c 个角、e 个棱)。引擎现成坐标常量
   (`cube_common.rs::state_space`):CORNER=24(1角) CORNER2=504(2角) CORNER3=9072(3角)
   EDGE=24 EDGE2=528 EDGE3=10560 CROSS=190080(4棱) EO12=2048 EP4=11880。
   对应移动表 `mt_corn/mt_corn2/mt_corn3/mt_edge/mt_edge2/mt_edge3/mt_edge4(stride24)` 都已生成。
3. **表策略按空间大小定**:
   - ≤ ~3000 万态:**全空间精确距离表**(BFS 一次,u8 数组,查长度 O(1) 零搜索,枚举首达即最优)。
     222 = 24×10560 = 253,440(248KB);Roux S1 = 504×10560 = 5.3M(5MB,native 秒级 / wasm 数秒,可懒建)。
   - 更大(如 EO+DR 的 2048×2187×495 ≈ 2.2G):走分解坐标 + `max()` 可采纳启发式 + IDA*,
     照 `pair_solver.rs` / `eo_cross_solver.rs` 的既有模式,必要时 prune_create.rs 注册落盘表。
4. **视角/多位置归约**:不要为每个位置建表。一个规范位置 + 共轭覆盖全部:
   - 6 底色 = `ROTS6 = ["","z2","z'","z","x'","x"]`(走 `alg_rotation`),列序/颜色映射恒为
     z0=Y z2=W z3=O z1=R x3=G x1=B(`ANGLE_COLOR_STD`,全站统一,别发明新记号)。
   - 同底色下的多个等价位置(222 是 4 个贴底块)= `rot_map()[k]`(y^k)再共轭。
   - 解的展示前缀 = `rot + y^k` 旋转 token(UI `moveLen` 已剥 1~2 个 token)。
   - **标签用探针法导出**,别手推:对每面取代表 move 走同一套变换,读 `G^{-1}({目标面})`
     (见 `block222_solver.rs::face_map/block_label`)——保证标签与实际求的块永远一致。
5. **CSV 口径**:每视角列 = 该底色下所有等价位置的 **min**(与 6 色 subset 聚合自洽:
   六色 min = 全部位置全局 min)。列名 `<stage>_<z0|z2|z3|z1|x3|x1>`,id 列在首。

## 1. Rust 核心(solver/)

照抄 `src/block222_solver.rs`(~250 行 + 测试),要点:

- struct 持 `Arc<MoveTable>` + 距离表 `Vec<u8>`;`new()`(native, manager `ensure_*`)与
  `from_tables()`(WASM, 字节喂入)双轨;`#[cfg]` 门控只在 `new()`。
- solved 索引用 `array_to_index(&[c*pos+ori...], n, c, pn)` 算,别硬编码魔数。
- 距离表 = frontier BFS(单线程即可,转移 = `mt[idx*18+m]` 组合);**双 target 通用,别用 rayon**。
- `conj_buf`: alg → `alg_rotation(rot)` → `rot_map()[yk]` 逐 move 重映射;`walk` 从 solved 索引走表。
- 多解枚举照 `CrossSolver::enumerate` 形状(`valid_moves()` 剪 move + pt 剪枝 + cap),
  多位置合并按 `(len, yk)` 排序 cap 截断。
- `lib.rs` 注册模块(放 wasm 可编区,别进 native-only 块)。
- analyzer bin `src/bin/<v>_analyzer.rs` 照 `block222_analyzer.rs`:`SolverWrapper` + OnceLock 单例 +
  `run_analyzer_app::<W>("_<variant>")`(suffix 必须 = `_<变体名>`,管道靠它拼输出文件名)。
- **测试是承重墙,三件套缺一不可**(`cargo test --release <v>` 跑,小批量就够):
  1. `pt_basics`:全空间可达、max_depth 合理(222 是 8)、单 move 已知值(U 不碰底块=0,D=1)。
  2. **独立暴力对照**:用 `MOVE_STATES` 的单件运动学(绕开 mt 表与 Lehmer 编码)逐位置建
     HashMap 距离表,随机打乱 × 全部 (rot,yk) 视角逐格对照——这是与编码/共轭/标签三者
     一起被验证的金标准。
  3. 枚举有效性:每条解在共轭帧 replay 后 pt=0、长度=声明值、含最优;再抽一条 State 级
     replay(yk 逆映射回原帧)验物理归位。
  + `tests/e2e_<v>.rs` 跑二进制对 `testdata/scramble_5.txt`,CSV 形状 + 与 lib 直查一致。

## 2. WASM + analyzer UI(在线求解)

**WASM 类**(`src/wasm.rs`):照 `Block222SolverWasm` —— 构造器收表字节 `from_bin`,
`solve(scramble) -> Vec<u32>`(6 视角)、`solve_moves(scramble, face, extra, cap) -> String`
(JSON `{"len":N,"sols":[{"m":"z2 y R U ...","c":"标签"}]}`,走 `fmt_moves`/`sols_json`)。
距离表在构造器现场 BFS(小空间)或惰性 RefCell(照 F2leoSolverWasm)。
多个相关 UI 方法共享表时**合并一个类 + 一个 need**(照 `Roux223SolverWasm`:Roux FB 与
Petrus 223 两方法 4 阶段 flat stage id 0..3,微表 eager、5.3M 表 RefCell 惰性且 s1/223 共享)。

**重建仪式**(改 Rust 后必走,顺序固定):
1. `build_wasm.ps1` 的 `$names` 数组加新表名(若引了新 mt/pt)→ `pwsh solver/build_wasm.ps1`。
2. copy `pkg-web/cross_solver.js`、`cross_solver_bg.wasm`(+两个 `.d.ts`)→ `tools/solver/rust-cross/`;
   新表 `pkg-web/tables/<t>.bin.gz` → `tools/solver/rust-cross/tables/`。
3. **worker 是手维护源** `tools/solver/rust-cross/cross-solver-worker.js`(pkg-web 里那份是旧的):
   `init` 加 `need === '<v>'` 分支(只拉自己的表)+ 消息类型 `<v>_stage` / `<v>_moves`。
4. `lib/rust-cross-client.ts`:**bump `V`**(如 `v=20260610a`);`TABLE_BYTES` 加新表解压字节
   (= state_count×stride×4+12);`TABLE_SETS` 加 need 清单(**必须与 worker init 分支一致**);
   `RustCrossPool` 接口 + return 对象加 `solve<V>Stage/Moves`;moves 类消息名加进 onmessage 的
   `job.resolve({...m.data, ms})` 分支。
5. `lib/rust-cross-pool.ts`:`PoolNeed` 联合加 `'<v>'`。
6. `components/StageSolver.tsx`:`Method` 联合 + `METHODS`(下拉项)+ `STAGE_LABELS`(阶段名数组)+
   `EAGER_MAX`(轻=最深阶段全 eager;重=浅层)+ `kindOf/needOf` + `computeAll`/`fetchMoves` 各加分支。
   视角格 tooltip 若「X 面十字」语义不符,加 method 分支文案。
7. 验收:playwright 开 `127.0.0.1:3000/zh/scramble/analyzer` 切方法,桌面 + 390px 视口各一遍,
   0 console error;**native ↔ WASM 同打乱 6 值逐格相等**(开 dev 页 vs 跑 analyzer.exe)。
   外部交叉验证用 cubing.js 独立 replay(`.tmp/check222.mjs` 模式),别拿截图肉眼 OCR 当真值。

COEP 注意:analyzer 页用 classic worker、**不发 COOP/COEP**;别把新页面加进 next.config
`headers()` 的 SAB 名单除非真用 SharedArrayBuffer。

## 3. 统计管道(本地跑,大表机器)

数据源两套(`scramble-stats-build/config.yml`):
- WCA 真实打乱:master `D:\cube\scramble\wca_scramble\wca_scrambles_no_wide_move.txt`(~130万),
  CSV 落 `...\wca_scramble\stats\<v>.csv`。
- 双色底 10f xcross 难题集:`D:\cube\scramble\xcross_2_col_10f\scrambles.txt`(~127万),
  CSV 落 `...\xcross_2_col_10f\stat\<v>.csv`(注意目录名是 `stat` 无 s)。

步骤:
1. **首灌全量**:master 本身就是合法输入(`id,scramble` 行),直接
   `Push-Location <数据目录>; "<master文件名>`nexit" | & block222_analyzer.exe` 跑完
   把 `<master名>_<v>.csv` move 成 `stats\<v>.csv`。env:`CUBE_TABLE_DIR=solver\tables`、
   `RAYON_NUM_THREADS=14`(全局限核)。慢变体(IDA* 搜索类)别一把梭,用第 3 步脚本分块。
2. **注册增量管道** `core/packages/scramble-stats-build/update_cross_stats.ps1` 五处:
   `$VARIANT_EXE` / `$VARIANT_CHUNK` / `$VARIANT_RATE`(实测)/ 默认 `-Variants` 数组 / 向导 `$order`。
   **数字开头的变体名(如 222)hashtable 键必须加引号**,否则 int 键查 string 查不到。
3. **xcross 集**:`backfill_xcross_variant.ps1` 的 `ValidateSet` + `$EXE` 两处;快变体直接
   `-Variant <v>` 跑完,慢变体用 `-Hours/-Threads/-MaxChunks` 分次。
4. **build 侧** `scramble-stats-build/src/build.ts` 的 `VARIANTS` 加 spec
   (`key/file/stages/angleToColor: ANGLE_COLOR_STD/colFor`)。distribution/examples/downloads
   全 spec 驱动,加完即生效;CSV 缺的 set 自动跳过。
5. **stats 页** `app/[lang]/scramble/stats/page.tsx`:`VariantKey` 联合 + `VARIANT_LABEL` +
   `STAGE_LABEL`(新 stage 键)。下拉数据驱动,JSON 里有就显示。中文含繁简差异字时
   `node scripts/conv.mjs "简体"` 取 zhHant 粘贴(禁手敲)。
6. **重算 + 发布**:
   `$env:SCRAMBLE_STATS_STAMP=(Get-Content ...\incremental\export_date.txt).Trim()`(字节稳定)
   → `pnpm --filter @cuberoot/scramble-stats-build build` → 核对 distribution.json 新变体的
   sample_count/直方图 → 发布走 `update_cross_stats.ps1 -PublishOnly`(git commit stats/scramble +
   push + tar+scp static 原子替换),或手动照它第 6 步。
7. **看板** `/code/solvers`:调 `solvers-tables` skill(TABLES/NATIVE/BROWSER/hero 文案)。

可选集成(按需):
- `build_comp_steps.ts` `TARGETS` + `useCompSteps.ts` DIR + gen 页 SheetView → /scramble/gen 行内秒出。
- 首页 RecentScrambles(222/roux/223 已接,2026-06-10 起新变体默认跟着接):
  `build_recent_scrambles.ts` `VARIANTS`(块类变体 metric 键不走 cross/xc 位置映射,加 `metrics: [stage名]`)
  + `components/RecentScrambles.tsx` 的 VARIANT_ORDER / VARIANT_LABEL / METRIC_ORDER / METRIC_LABEL
  → `pnpm --filter @cuberoot/scramble-stats-build build:recent-scrambles`。今日神打不动(单独问)。

## 4. 验收清单

- [ ] `cargo test --release <v>` 全绿(含独立暴力对照 + e2e)
- [ ] native analyzer 实测吞吐记录进 `$VARIANT_RATE` 和看板
- [ ] analyzer 页桌面 + 手机 playwright 过,native↔WASM 逐格相等,0 console error
- [ ] 两套数据集 CSV 行数 = master 行数 + 1(表头)
- [ ] distribution.json 含新变体(两 set),stats 页下拉可选、直方图/样例正常
- [ ] `pnpm --filter @cuberoot/client-next typecheck` 干净
- [ ] 发布后线上 stats 页验一遍(static 已替换)
- [ ] /code/solvers 看板同步

## 5. 已知数值(实测参照)

| 变体 | 状态空间 | 表 | native 吞吐 | God's number |
|---|---|---|---|---|
| block222 | 253,440 | 内存 248KB(BFS 现建) | ~1.25M/s(查表零搜索) | 8 HTM |
| fb_square(1x2x2,前/后双目标) | 24×528 ×2 | 内存 2×12.7KB | 与 roux 同 bin | 7 HTM |
| roux_s1(1x2x3) | 5,322,240 | 内存 ~5MB(BFS ~1s) | ~600k/s(roux_analyzer 双阶段合并) | 9 HTM |

注:Roux 第一块的 **UI/JSON/Method key = `123`**(用户按块尺寸找:123/222/223 一族,数字键还会
排到下拉最前);管道名/CSV/exe 仍叫 `roux`(roux.csv / roux_analyzer.exe / 五处注册键 'roux')。
| block223(2x2x3,IDA*) | ~1.53G(放不下) | 复用 s1 全表 + 角2×棱2 266K | ~19k/s(WCA)/ ~4.4k/s(难题集) | 未测(观测 max 10) |

block223 启发式 = max(pt_s1, pt_ce2),两者都是子目标精确距离 ⇒ h==0 ⟺ 块成,首达即最优;
枚举/统计直接照 block222 形状,只是查表换成 IDA*。

## 6. cstimer 求解器语义速查(未来扩展)

均为 3x3 引擎可做(SQ1/Pyraminx/Skewb 是另外的 puzzle,本引擎不覆盖):

| cstimer 名 | 件集合 | 空间 | 全表? |
|---|---|---|---|
| 2x2x2(块) | 1角+3棱 | 253K | ✅ 已做(block222) |
| Roux S1(1x2x3) | 2角+3棱(DBL+DLF 角 + BL,FL,DL 棱) | 504×10560=5.3M | ✅ 已做(roux_s1,含 fb_square 1角+2棱 双目标子阶段) |
| EOLine | EO12 + DF,DB 两棱位置 | 2048×132=270K | ✅ |
| EOCross | EO12 + 十字 4 棱 | 2048×11880=24.3M | ✅(pt_ep4eo12 已有,eo 变体已覆盖) |
| Petrus 2x2x2+2x2x3 | 块 → 2角+5棱 | 253K → ~1.53G | ✅ 已做(block223:IDA* + max(s1 全表, 角2×棱2);UI 方法 '223' = 222+223 两阶段) |
| 2x2x2 face(口袋魔方) | 2x2x2 puzzle | — | 另一个 puzzle,引擎不适用 |
| EO+DR | EO×CO×E-slice = 2048×2187×495≈2.2G | 太大 | ❌ 分解坐标+max 启发式 |
| Roux S1+S2 | S1 后 M/U/R/r 受限 move 集 | — | 需要 move 子集支持(引擎现无,要加) |

设计新变体时先在此表对号入座,空间 ≤3000 万就走 block222 全表模板,否则走 pair/eo 启发式模板。
