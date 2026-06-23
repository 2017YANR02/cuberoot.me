---
name: new-substep-solver
description: "用户要造一个新求解器时用。**先分流**:3x3 子阶段 / 大状态空间(需 Rust+WASM+大表+真题统计管道)= 范本 block222,完整流程 solver/VARIANT_PLAYBOOK.md;非 WCA 小状态整解(可整枚举,如枫叶 Ivy 29,160 态)= 纯 TS 全 BFS,**不碰 Rust/WASM/管道**,范本 packages/client/lib/ivy-solver.ts(见正文 §0)。Triggers: \"造个 X 求解器\", \"新求解器\", \"枫叶魔方求解器\", \"ivy 求解器\", \"非 wca 求解器\", \"小魔方求解器\", \"roux s1 求解器\", \"eoline 求解器\", \"petrus 求解器\", \"new substep solver\", \"加一个 step solver\", \"块求解器\", \"新变体\", \"new variant solver\"."
---

# 新求解器

## §0 先分流(造任何求解器前先判这一步)

- **借用必注明(铁律,2026-06-22)**:求解器用了别人的东西(cstimer 移动语义照抄 / wrap cstimer 自带 solver 当引擎:dino=redi、mpyrso=两阶段 / crz3a=站内 kociemba / STM=Korf / cubelib 等)→ ① solver 文件头注 + `/code/solvers/_fleet.ts` 方法文案写清出处,② `/about` 的 `credits_data.json` 补/更新一条(已收录 ~30 条,先查重)。无出处不发。
- **从零 reduction 先验 gadget 再动手(铁律,2026-06-22 heli/helicv/prcp/sia 批)**:TIER C/D 从零 reduction 动手前,先从几何 bit-exact 导出 piece model(逐 facelet 对 cstimer moveTable / poly3dlib apply),**再搜「每个件型的纯 3-循环 commutator 是否存在」**(2-gen + 浅 setup,bounded 别 OOM)。**存在 → 可建**(heli=角+4 棱轨道、helicv=+17bit 奇偶,均成);**不存在 → 早红灯延后、别硬磨**:件强耦合(prcp/giga 五魔系角棱:2000 万 comm 全是 5-循环、无纯 3-循环)或子群太深(sia 系棱 intoH 深度 19)= BLD 专属引擎 effort-gated epic,非一轮 loop 单元。
- **复用兄弟单元 reduction 前必重验「同群」(铁律,2026-06-22 helicv)**:共用 cstimer 打乱生成器 ≠ 同置换群 —— helicv 共用 heli 的 `adjScramble`(同 12 token)但 curvy 切多了 12 棱件、群大 256×(3e21),盲抄会建错;先从几何 bit-exact 重导 piece model 确认同群,再决定复用 / 另写(本项目兄弟文件 cuboid334-337 即先例)。
- **大状态空间 / 3x3 子阶段**(需大表 + 真题统计管道)→ 走下面的 substep 一页纸 + `solver/VARIANT_PLAYBOOK.md`(Rust + WASM)。
- **小状态非 WCA 整解求解器**(状态 ≤ ~10^6 可整枚举,如枫叶 Ivy 29,160 = 81×360)→ **纯 TS 全图 BFS,绝不碰 Rust/WASM/下载表/数据管道**。范本 = `packages/client/lib/ivy-solver.ts` + `_IvySolver.tsx` + `gen/_svg/ivy_svg.ts`(2026-06-20)。固定套路:

> **批量给 `/scramble/gen` 全部非 WCA 魔方造求解器** → 有专门 loop `solver/NONWCA_PUZZLE_LOOP.md`(`/loop 继续造小魔方求解器`)。注意**不是所有都能全 BFS**:分四档 —— A 现场全 BFS 最优(≤~2e6 **且现场 build <1.5s、常驻 <~100MB;态数小≠现场可行 —— bic 1.1M 态却 7s/550MB、移动崩,应落 B**)/ B build 预算表(~2e6–5e7,发 `.bin.gz` 查表)/ C 单实例 IDA* 最优(滑块如 15 数码)/ D 近最优(大型扭转 / jumbling,逐个独立工程,random-state 的可复用 cstimer 自带 solver)。下面七步是 A 档(Ivy 范式);B/C/D 的 delta 见该 loop §0.5/§4。
  1. **移动语义照抄 cstimer**(`tools/cstimer-scramble/scramble/*.js`,逐字段),整图 BFS-from-solved 复现 god-number 直方图自证正确(独立 BFS 交叉验证)。
  2. 求解器 UI 仿 `_Sq1Solver.tsx`,接 `/scramble/solver` 的 `event=` dispatch + `SolveTabs`:非 WCA 无官方图标 → `appendEvents` 走 `textLabel`;`HAS_DISTRIBUTION` 加该 event。**接线必含**:给 `/code/solvers/_fleet.ts` 的 `NONWCA_TS` 加一行(档/质量桶/态数/God 数/方法),CI 守卫 `tests/code-solvers-fleet-sync.test.ts` 锁其 event 集 == `CSTIMER_SOLVABLE_IDS`,漏登记红。
  3. **分布数据源按是否 WCA 分**:WCA 项目 → 真题语料管道(skill `update-scramble-stats`,带比赛归属示例 + 时间线);**非 WCA 小项目(A/B 档)→ 穷举全状态**,分布 = 全空间精确直方图(数据现成在 solver 里,无管道)。范本视图 `stats/_components/IvyDistView.tsx`,接 stats 页 `event===` 分支 + `availableEvents.add` + `appendEvents`。
     - **TIER C/D 大状态空间(铁律,2026-06-21)**:**分布必须离线预计算(build 脚本 → 静态 `stats/scramble/dist_<event>.json`,经 `statsUrl` fetch),严禁浏览器现场求解采样;状态空间巨大时由 build 脚本取合理样本数 N 离线算好,页面只 fetch+渲染;新 build 脚本接入 puzzle-stats 管道。** 复用 `packages/scramble-stats-build/src/build_puzzle_sampled_dist.ts`(参数化 event + N,import 纯 TS 求解器、用其 cstimer 同款随机生成器采样;`REGISTRY` 加一行 + `update_puzzle_stats.ps1` 的 `$SAMPLED_DIST_EVENTS` 加 event)。范本 DistView = `Cuboid335DistView.tsx`(纯 fetch+渲染,**零求解器 import**)。详见 `solver/NONWCA_PUZZLE_LOOP.md` §0.0 #6 / §0.5 / §0.6。
     - **采样分布出炉先验形状再发(铁律,2026-06-22)**:双峰 / 有空档 / 某峰边缘正好卡在求解器某常量(optimal-shortcut cap、phase 下限、IDA* bound、采样预算)= **大概率求解器假象不是魔方本身 → 必须自查、别直接发**。退化单柱(如全 `{'11':N}`)= 求解器偷工(返回 `scramble⁻¹` 只原路退回)。能用魔方结构(奇偶分支等固定多几步)解释第二峰才放行;否则抬 cap / 修求解器后重生。锚:335 双峰=捷径 cap 卡 12 而真最优区 9-16(已修);ssq1 双峰=真奇偶分支(合法);ssq1 初版单柱=偷工(已打回)。
  4. **示例自造**:枚举每个最优步数档的状态、反推最短打乱当示例(`ivyExamplesByLength`),**不需要比赛语料**(别再说「非 WCA 所以没示例」)。
  5. **下载按钮**:必给「下载全部状态」CSV(`optimal_length,scramble`,含 identity 行)+ 单步数 txt;数据走 `ivyAllScramblesByLength`,客户端 Blob 下载。
  6. **状态图**:从 solver 状态推导的 net SVG(`ivy_svg.ts` 复用 skewb 面切分;颜色全由状态推导 → solved 每面纯色自证),接 `ScramblePreview2D` 的 `HAS_PREVIEW` + dispatch,全站复用。
  7. 测试:独立 BFS 验最优性 + 全枚举计数 == 分布 + 渲染 solved 纯色 + frame 三角恒定。typecheck + 守卫(i18n 用 `tr`、真 `<button>`)。

---

# substep 求解器(3x3 / 大状态空间)

**先整读 `solver/VARIANT_PLAYBOOK.md`**(语义设计 → Rust → WASM/UI → 统计 → 发布全链路 + cstimer 语义速查表),范本代码 = `solver/src/block222_solver.rs` 全家桶;多目标/IDA* 范本 = `roux_s1_solver.rs` / `block223_solver.rs`;零盘表自包含范本 = `eoline_solver.rs` / `dr_solver.rs`;扭曲共轭 + 盘缓存 nibble 大表范本 = `f2b_solver.rs`(2026-06-10)。cstimer 3x3 求解器语义已全覆盖,新增只剩非 3x3 puzzle 与 HTR。

一页纸版:

1. 语义:件集合(面交集推导)→ 状态空间(乘积坐标,常量都在 `cube_common::state_space`)→ ≤3000 万态走全空间精确距离表,否则 IDA* + `max(子目标精确表)` 可采纳启发式(范本 block223:复用 roux_s1 全表 + 角2×棱2 小表)。深目标(均值 >11 步,如 f2b)小积表 max 顶不动,要上「接近完整目标的子集」大表(>1G 态走 nibble 落盘 + mmap,见 f2b pt9);对称双块用扭曲共轭(同一张表,sb 步进走 rot_map[2][m]);轴类目标(EO/DR)对面底色同值、y 不变,get_stats 少跑 yk。慢变体独立 CSV(别并进已满灌的 CSV 逼全量重算)。
2. 视角:1 个规范位置 + `alg_rotation`(6 底色)× `rot_map`(y^k)共轭;标签用探针法 `face_map`;CSV 每视角列 = 等价位置 min,列序 z0/z2/z3/z1/x3/x1。每视角可有多目标(fb_square 前/后双方块 = 双 pt 双 solved 索引,取 min)。
3. Rust:solver 模块(双轨 new/from_tables)+ analyzer bin(suffix `_<变体名>`,一个 bin 可输出多 stage 列)+ 测试三件套(独立运动学暴力对照是金标准;大空间用 radix-24 Vec 替 HashMap)+ e2e。
4. WASM 重建仪式 7 步(build_wasm.ps1 → copy → worker 手维护 → client TABLE_SETS/V bump → pool → StageSolver → playwright 桌面+手机验收,native↔WASM 逐格相等)。多个相关方法共享表时合并一个 WASM 类 + 一个 need(范本 Roux223SolverWasm:4 阶段 flat stage id,重表 RefCell 惰性建)。
5. 统计:两套数据集首灌 + update_cross_stats.ps1 五处注册(数字变体名键加引号)+ backfill 两处 + build.ts VariantSpec + stats 页三处 + 发布(**先 push 代码等部署,再 scp static,否则旧 bundle 撞新 JSON 崩**)。
6. 主页近期打乱:build_recent_scrambles.ts `VARIANTS`(块类变体加 `metrics: [stage名]`)+ RecentScrambles.tsx 三处(VARIANT_ORDER/VARIANT_LABEL/METRIC_ORDER+LABEL)→ 重跑 build:recent-scrambles。
7. /scramble/gen 比赛页(**标准步骤别漏**,六处见 playbook):build_comp_steps TARGETS → useCompSteps → TNoodleMode(VARIANT_SPEC+引擎 ternary)→ CompCrossAnalysis(Metric+OFFSET)→ SheetView(METHODS/STAGE_IDX/CYCLE)→ 实时兜底 hook;comp_steps_* 随 stats tar+scp 发布。
8. **命名规范**:用户可见标签一律纯块尺寸(1x2x2/1x2x3/2x2x2/2x2x3),UI/JSON key 用数字(123/222/223),禁「桥式/Roux」进标签;管道名/CSV 名可以另叫(123 的管道名是 roux)。
9. `/code/solvers` 看板走 solvers-tables skill;commit 前 typecheck + zh:check(繁体一律 conv.mjs 取值)。
