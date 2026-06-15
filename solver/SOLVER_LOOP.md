# Solver Loop — 自驱 backlog + 协议

> `/loop` 的单一事实源。每轮迭代**先完整读本文件**,按 §0 协议推进 §1 backlog 的下一个未完成单元,
> 干完更新本文件(打勾 + 写 §2 日志 + 必要时 §3)。范本与全链路细节在 `solver/VARIANT_PLAYBOOK.md`,
> 造新变体先调 skill `new-substep-solver`、看板同步调 `solvers-tables`。
>
> 用户决策(2026-06-10 锁定):范围=档1→2→3 全做;提交=自动 commit **不 push**;
> 统计管道灌数据 + static 发布 = **不纳入 loop,留用户在场手动**。

---

## §0 LOOP PROTOCOL(每轮照做)

1. **读本文件全文**。**优先级**:若当前可用内存宽松(§0.10,可用 > ~3GB)且 §4「测试欠账」非空 → **先回补欠账**(把欠着的测试/验收跑掉)再推新活;否则在 §1 自顶向下找第一个未打勾任务(尊重 EPIC 顺序)。
2. **遇到 `⛔ GATE` 或 `⏸ soft-gate`**:**停 loop,不 ScheduleWakeup**。在 §3 写清需要用户拍板的取舍,
   正文给一句话摘要,等用户。绝不擅自跨过 gate 开工。
   ⚠ **区分**:只有 `⛔ GATE` / `⏸ soft-gate` 才停;`📦 MANUAL` **不是 gate**——它是"loop 跳过这条、写 §3 交接、继续做下一个"(灌数据/发布留用户)。**别把 `📦 MANUAL` 当 gate 停住**,否则 loop 会卡死在变体之间永不前进。
3. **否则把该单元整体派给一个 fresh 子 agent 执行**(`Agent` 工具,general-purpose)。**主 loop 不亲自写代码 / 跑 cargo / 读大文件**——只给子 agent 一段自包含 prompt:指向 `VARIANT_PLAYBOOK.md` + 调 `new-substep-solver` skill、本单元的验收门、限核 **≤8 线程硬上限**(`RAYON_NUM_THREADS=8` + 编译 `CARGO_BUILD_JOBS=8` 或 `cargo … -j 8`、低优先级、`CUBE_TABLE_DIR=solver\tables`)、内存门(§0.10)、提交规则(§0.5)。要求它干到验收门过、自行 commit,**只回 ≤20 行摘要**(改了哪些文件 / 门过没 / commit 短 hash / 有无 blocker)。**子 agent(L2)内部若自己撞上大输出**(读大 obfuscated 文件 / 长 cargo 日志 / 大批量改)**可再下放一层子 agent(L3)只收摘要**(Claude Code ≥2.1.172 支持嵌套子 agent,上限 5 层);但 **≤2 层(L2→L3)够用,别为嵌套而嵌套**——层越深摘要越失真、协调成本越高。UI 验收(playwright)单独派一个子 agent,**只回关键断言**(native↔WASM 是否逐格相等、有无 console error),**绝不回 DOM snapshot**。
   **绝不跑全量 ~130 万打乱灌注、绝不跑 static 发布**——那是 `📦 MANUAL`,只在 §3 留交接条目。
   重活前若磁盘紧先 `df -h` 报告再动(剩余<6G 直接红灯,见 §3 磁盘历史:6.6G 表 / 曾剩 5.5G)。
4. **验收门(按任务类型,全过才算成)**:
   - Rust:`cargo test --release <v>` 绿(含 §0 范本的独立暴力对照 + enumerate + e2e)。
   - 前端:`pnpm --filter @cuberoot/client typecheck` 干净。
   - UI:playwright 开 `127.0.0.1:3000/zh/scramble/analyzer` 切到新方法,**桌面 + 390px 各一遍**,
     0 console error,**native↔WASM 同打乱逐格相等**(别拿截图肉眼当真值,用 cubing.js 独立 replay)。
     playwright 前先确认 dev server 在 `127.0.0.1:3000`(用户常驻);**不在就把 UI/playwright 验证标 §4 欠账继续,绝不自己 `pnpm dev`**(端口占用 + 留孤儿 node,见全局规则)。
   门**真跑了却没过、且两次聚焦修复仍不过 → 红灯**:停 loop、不 ScheduleWakeup,把失败摘要写进 §3,等用户。**内存不够跑验收门 ≠ 红灯**——按 §0.10 降级:跳过测试、记 §4 欠账、照常推进下一个任务。
5. **提交(子 agent 在单元内做)**:`git add` **只加本单元改动的文件**(别 `git add .` 扫进无关 WIP),
   commit(英文 message,结尾带 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`),**不 push**。**按 §0.10 跳过了验收门(欠测试)时** message 加前缀 `[untested]` 并登记 §4。
   主 loop 只在摘要里核对拿到了 commit 短 hash。
6. **更新并提交本文件**:勾掉任务;§2 追加一行(日期 + 单元 + commit 短 hash);生成了 MANUAL 交接就写 §3、有测试欠账就写 §4。然后 `git add solver/SOLVER_LOOP.md` 单独 commit(这步主 loop 自己做,小输出)——进度文件也版本化,`/clear` 重启 + git log 都能续上。
7. **决定下一步(标准 Ralph:跑到底,不中途停)**:默认**一路推进直到 backlog 清空**,不预防性急停、不让用户中途 /clear。只有以下情形停:
   - **还有未 gate 的 backlog** → `ScheduleWakeup`(self-paced:一般 ~150–240s 起下一个单元;若有长 build/test 在后台跑,delay 对齐它),**原样回传同一条 /loop 指令**。这是常态,持续到 backlog 见底。
   - **完成信号:backlog 全部打勾 / 下一个是 `⛔ GATE` / `⏸ soft-gate`** → **停**(不 ScheduleWakeup),正文给收尾总结。这是唯一的"正常结束"。
   - **红灯**(验收门真跑两次仍不过)→ 停,写 §3,等用户。
   - **空转自断**:连续 ~3 轮醒来都因内存紧 / 无可做活而**没推进任何单元** → 停、不再 ScheduleWakeup,提示用户腾内存。
   - **安全网(max-iterations 类比)**:单 session 连续推进 **~15 个单元**仍没到完成信号 → 完成当前单元后停一次,正文提示 `/clear` 重 `/loop` 续(纯防失控烧 token 的硬上限,不是常规节奏;远高于一般 EPIC 的单元数,正常 backlog 跑完都到不了)。
8. **每轮目标一个可验收单元**:commit 完再调度下一轮,让进度落盘、可断点续。
9. **上下文防腐(主 loop 必须一直瘦)**:真相只在 git(代码)+ 本文件(§1 进度 / §3 决策),**从不靠"记得"**;每轮从读文件重建状态。
   - (a) **核心机制**:每个单元的重活全在 fresh 子 agent 里干、干完即弃(见 §0.3)——这等价于标准 bash-Ralph 的"每轮 fresh 上下文",只是粒度在单元。主 loop 每轮只净增"一次文件读 + 一段 ≤20 行摘要",**所以才敢一路跑到底**。
   - (b) **派发要短**:给子 agent 的 prompt 别堆几十行内联 spec——详细 spec 写进 §1 该单元条目(或 `solver/specs/<unit>.md`),派发时只给"读 §1 的 X 单元 / specs/X.md 执行 + 验收门 + §0.5 提交规则"几行指针。主 loop 越瘦,能连跑的单元越多。
   - (c) **真腐烂兜底**:若中途真的触发了 summarize / auto-compact(不是预防性,是实际发生了),无妨——状态全在文件 + git,读文件即重建;继续跑。只有 §0.7 的 ~15 单元安全网才主动停。
10. **内存门(本机 32GB 总,但常被占满——实测某刻仅 3.0GB 可用,务必防 OOM)**:跑 cargo(release 编译峰值 ~2GB)、native 建表/跑表、playwright(Chromium ~0.5GB/实例)前**先查可用内存**(`Get-CimInstance Win32_OperatingSystem` 的 FreePhysicalMemory,KB)。**绝不并发两个重进程**(两个 cargo / cargo+playwright / 多浏览器),严格串行。内存不够时 = **降级跳过、记账、继续,不死等也不红灯**(用户 2026-06-11 定):
    - 跑得动 `cargo check`/debug 但跑不动 `cargo test --release` 全量 → 至少 `cargo check` 确认能编过,把 release 全测 + playwright 标欠账。
    - **地基底线(不可跳)**:每个变体的 Rust 核心(H1 / M1 这类下游都依赖的单元)的**独立暴力对照测试**(playbook 金标准,内存占用小、吃内存的是编译)**内存再紧也必须跑**;只许欠 release 全量 e2e / playwright。**绝不让未验证的地基喂给下游单元**(否则在错地基上白盖楼)。
    - 内存紧时**编译也降并行**:`cargo … -j 2`(甚至 `-j 1`),别 8 个 rustc 一起吃爆内存(`-j` 是编译并行,跟运行时 `RAYON_NUM_THREADS=8` 是两回事)。
    - 连编译都吃力(可用 < ~1.5GB)→ 这个需重编译的单元整单元欠账、跳过,去 backlog 找能在低内存下做的活(纯前端 typecheck 类 / 看板文案);实在没有就 ScheduleWakeup 稍后再看内存。
    - **凡跳过的**:代码照常 commit(message 前缀 `[untested]`),§1 任务旁标 `⚠欠测试`,§4 登记一条(单元 / 跳了啥验收 / 怎么补),**继续推进 backlog,不停 loop**。
    - 以后内存宽松(可用 > ~3GB)的轮次按 §0.1 **优先回补 §4 欠账**。
    - **安全阀**:一个变体的 §4 欠账没清零前**不算"完成"、不进 §3 的 MANUAL 发布交接**(上线前测试必须补齐,未验证代码不流到线上)。
    - **建大表特例**:>1G 落盘表(state_count×stride)在低可用内存下仍**红灯**——这是真做不动 + 磁盘风险,不是跳测试能绕的(与 §1 soft-gate 双保险)。

---

## §1 BACKLOG(有序,自顶向下)

### EPIC 1 — HTR(档1,Thistlethwaite DR→HTR)
> 语义:DR(G2 = ⟨U,D,L2,R2,F2,B2⟩)再降到 HTR(G3 = ⟨U2,D2,L2,R2,F2,B2⟩ 的陪集)。
> 范本 = `dr_solver.rs`(IDA* + 可采纳 max 启发式 + 零/小盘表)。件集合 / 坐标 / 态数**自行从
> `cube_common.rs` + cstimer(`D:\cube\cstimer\src\js\tools\`)推导,在测试里用独立暴力对照验证,别信记忆里的数**。
> 难点=好的可采纳启发式:三轴 DR-max 偏弱(可能只到伪 HTR)。**先弱启发式跑通**,rate 不行再加落盘大表
> (照 f2b nibble 落盘模式)。变体 key 建议 `htr`。

- [x] **H1** Rust 核心 `htr_solver.rs` + 测试(pt_basics + 独立暴力对照 + enumerate)。门:`cargo test --release htr` 绿。✅ 2026-06-11 5 测试全绿(5.1s)。
      soft-gate 解除:真 HTR 无需大表——全空间 = cp 8!(40320,目标 Hc 96)× 轨道组合 C(8,4)=70 = 2,822,400 态,2.8MB 内存精确表现场 BFS,零盘表零启发式,查表即最优。|G3|=663,552=96×6912 闭包验证;DR→HTR God's number 实测 13。
- [x] **H2** analyzer bin `src/bin/htr_analyzer.rs`(suffix `_htr`)+ `tests/e2e_htr.rs`。门:e2e 绿 + smoke 5 条打乱 CSV 形状对。✅ 2026-06-11 e2e 1 绿 + H1 5 测试仍绿 + smoke 5+5 形状对。语义=条件式阶段:DR 视角出精确步数,非 DR 视角出 `-`(build.ts anyBad 守卫跳行)。
- [x] **H3** WASM 类 + 重建仪式(`build_wasm.ps1` $names → copy pkg-web 产物到 `tools/solver/rust-cross/` → 手维护 worker 加 `need==='htr'` 分支 → `lib/rust-cross-client.ts` bump `V`+TABLE_BYTES/TABLE_SETS+接口 → `rust-cross-pool.ts` PoolNeed)。门:typecheck 干净。✅ 2026-06-11 typecheck tsgo+tsc 双绿(主 loop 复核);零盘表 `TABLE_SETS.htr=[]` 零下载,wasm 首查惰性 BFS ~335ms;非 DR 哨兵 `HTR_NOT_DR`(u32::MAX);node 冒烟 native↔wasm 逐格相等。
- [x] **H4** `components/StageSolver.tsx` 集成(Method/METHODS/STAGE_LABELS/EAGER_MAX/kindOf/needOf/computeAll/fetchMoves 各加分支)。门:playwright analyzer 桌面+390px 过,native↔WASM 逐格相等,0 console error。✅ 2026-06-11 playwright 8/8 PASS,native↔WASM 12/12 格相等,0 error;哨兵 `-` 渲染 + min 统计排除验证;htr 故意不进 VARIANT_ORDER(原始打乱非 DR,gen/recent 下拉无意义,归 MANUAL)。
- [x] **H5** `/code/solvers` 看板同步(TABLES/NATIVE/BROWSER/hero,调 `solvers-tables` skill)。门:typecheck + `tests/code-tokens-drift` 绿。✅ 2026-06-11 typecheck 双绿(主 loop 复核)+ tokens-drift/zh-hant-drift 38 测试绿;NATIVE rate 放宽 `number|null` 显示「未实测」不编数;顺手修 small 概览卡只列 222 的旧 drift。
- [x] **📦 MANUAL(HTR)** 统计管道注册 + 灌 master/xcross + stats/gen/recent UI 接入 + 发布 — 交接已写 §3(2026-06-11),**loop 跳过,继续 EPIC 2**。

### EPIC 2 — move-mask 引擎能力(档2)
> 现 `valid_moves()` = 18 步全集 + 相邻面剪枝,无"只许子集"开关。加一个 allowed-moves bitmask 贯穿
> search/enumerate,一次投入解锁真 Roux S2 / HTR phase-2 / FMC 分阶段。

- [x] **M1** 引擎加 move-mask 参数,贯穿 `cube_common` 的 valid_moves/search/enumerate。门:**全部现有 `cargo test --release` 仍绿(承重墙不能塌)**,且 mask=全集时与现状逐位相等(加一条对照测试锁死)。✅ 2026-06-11 全量 94/94 绿(1m27s);MoveMask=u32 对齐 Move::index,`*_masked` 新入口零破坏;4 条新测试(表级×2 + 全集逐位相等 + 限 G2 暴力对照)。
- [x] **⏸ soft-gate(M2)** ✅ 2026-06-11 用户拍板:**做**,key `roux_s2`。展开为 M2a–M2e:
- [x] **M2a** ~~引擎扩 move 集~~ — **2026-06-11 红灯→用户拍板走伪 roux_s2**(见 §3):原生扩 M/r 撞 18-stride 承重墙(重构引擎 + 重建 34GB 表),弃之。改由 M2b 在现有 18-move + 视角共轭里表达 ⟨M,U,R,r⟩,零引擎改动。M2a 作为"扩引擎"单元取消。
- [x] ~~**M2b–M2e** roux_s2 全链路~~ — **2026-06-11 用户拍板弃整个 M2**。两路皆绝:扩引擎撞 18-stride 承重墙(M2a)、伪路线 FTM 最优 SB = 现有 `roux_s1_solver` 逐位重复(M2b,cstimer 亦只报 FTM)。roux_s2 不作为独立变体。若日后要 Roux SB 的 FTM 数,复用 `RouxS1Solver` 右块视角即可,无需新变体全链路。
### M3 — HTR phase-2(G3→G4,限 ⟨U2,D2,L2,R2,F2,B2⟩ 搜索;6 双转全在现有 18-move 编码内,用 M1 mask,零引擎改动)
> 语义:从 HTR 态(G3 陪集已满足)只用 6 种双转降到 solved(G4)。|G3|=663,552(H1 已算)→ 全空间小表可行,照 HTR 零盘表精确表模式。变体 key 建议 `htr2` 或 `htrfin`(M3a 推导时定)。
- [x] **M3a** Rust 核心 `htr_phase2_solver.rs`(key `htr2`)+ 测试。✅ 2026-06-11 `2996acf17`。态空间=|G3|=663,552(角 Hc=96 × 棱 6912=24³/2),u8 精确表 648KB 现场 BFS,零盘表;mask=G3_MOVES(U2=1 D2=4 L2=7 R2=10 F2=13 B2=16,复用 htr_solver,自逆);4 测试绿含 663,552 全空间暴力对照;全量 lib 90/0 + e2e 全绿(htr/M1 未塌);God's number=15(文献一致,baseline 锁)。
- [x] **M3b** analyzer bin `htr_phase2_analyzer.rs`(suffix `_htr2`)+ `tests/e2e_htr2.rs`。✅ 2026-06-11 `8e6496a83`。照 htr_analyzer 同构;e2e 绿 + htr/htr2 仍绿(lib 9)+ smoke 形状对。关键:G3 词全程 HTR,6 视角恒同值(异于 H1 DR 词只 UD 轴),baseline 据实测锁。
- [x] **M3c** WASM 类 `HtrPhase2SolverWasm` + 重建仪式(照 H3 清单)。✅ 2026-06-11 `a8b9449f4`(8 文件)。`TABLE_SETS.htr2=[]` 零下载,哨兵 `HTR2_NOT_HTR`,V bump 20260611b;typecheck 主 loop 复核 EXIT=0(从 core/ 跑;注意别 cd 到仓库根否则 ERR_PNPM_NO_PKG_MANIFEST);cargo htr2 仍绿;node 冒烟 3 G3 词 native↔wasm 6 视角全等。
- [x] **M3d** StageSolver UI 集成(照 H4 清单)。✅ 2026-06-11 `5626a0e9c`(3 文件)。htr↔htr2 各登记点对齐 + isSentinel 统一哨兵;typecheck 主 loop 复核 EXIT=0(我的文件干净);playwright 8/8 PASS、native↔WASM 12/12 格相等、0 相关 console error;htr2 不进 VARIANT_ORDER。文案 zh「HTR 收尾」/en「HTR-finish」,EAGER_MAX=0。
- [x] **M3e** `/code/solvers` 看板同步 `4cd201d20` + **📦 MANUAL(htr2)** 交接见 §3。✅ 2026-06-11 typecheck EXIT=0(主 loop 复核)+ code-tokens-drift 35/35 + zh-hant-drift 4/4;htr2 登记 TABLES/NATIVE/BROWSER/hero/概览卡,rate 留 null「未实测」。**M3 全链路完成,EPIC 2 收尾。**

### EPIC 3 — 独立 puzzle 引擎(档3,非 3x3)
> 2026-06-11 GATE 解除,用户拍板:**四个全做,且接统计管道**(覆盖调研的"无落点"结论——管道统计 = **整解最优步数分布**:WCA 打乱语料喂最优 solver,每打乱最优解长度分桶,即 `/scramble/stats` 对 3x3 cross 那类难度分布的 puzzle 级单阶段版)。各 puzzle 0 复用 `cube_common`,需独立状态模型(小空间全表 BFS / SQ1 双阶段)。**真正灌百万打乱 + static 发布仍是 📦 MANUAL**(顶部锁定规矩);loop 建 native 引擎 + analyzer + 统计管线注册 + WASM + 在线求解器 + 难度分布 UI + 看板。
> 顺序(de-risk:先小后大,2x2x2 先把非 3x3 的"统计管道 + 难度分布 UI"那套新管线打通,后三者照搬):**2x2x2 → Pyraminx → Skewb → SQ1**。
> ⚠ 这是新管线:非 3x3 不进现有 3x3 StageSolver/analyzer,落点是独立"在线求解器 + 难度分布"页面 + `/scramble/stats` 新 puzzle 分桶。第一个 puzzle(2x2x2)的 P2c/P2d 含**新 UI/统计面设计**,后三者复用其范式。

#### EPIC 3.1 — 2x2x2 口袋魔方(状态空间 3,674,160 = 7!·3^6,全表 BFS ~3.6MB 零盘表;solver 参考 cstimer `gsolver.js::pocketCube`)
- [x] **P2a** Rust 核心 `pocket_solver.rs`(key `pocket`)。✅ 2026-06-11 `c1c6c18db`。3,674,160=7!·3^6 全表 BFS 零盘表,9 move(U/R/F×3,固定 DBL 角消整体朝向);4 测试绿含全 3,674,160 暴力对照,全量 98 lib + e2e 绿;God's number=11 HTM,距离分布逐项吻合公开数据。
- [x] **P2b** analyzer bin `pocket_analyzer.rs`(输出每打乱最优解长度)+ `tests/e2e_pocket.rs`。✅ 2026-06-11 `65affa381`。CSV `id,pocket` 两列;支持全 18 记号(2x2x2 无中心,D/L/B=对面+整体旋转,analyzer 24 旋转词归一后查表,绕开 coord_of 直投影对 D/L/B 不成立的坑);bin 4 单测含独立 IDDFS oracle 40 组全等 + e2e 绿 + 全量回归未塌(lib 99/0 + 13 e2e);smoke 5 条 WCA 222 → 9/9/10/9/9 全 ≤11。
- [x] **P2c** 统计管线注册(非 3x3 新管线)。✅ 2026-06-11 `550f71c0d`。新 JSON `stats/scramble/puzzle_distribution.json`(`puzzles.<名>={event,label,label_zh,metric,sample_count,dist:HistEntry}`,前端 DiscreteHistogram/computeStats 直接复用);管道 `update_puzzle_stats.ps1`(-MaxNew/-BuildOnly,语料=Scrambles.tsv 按 event_id 过滤,id 差集增量)+ `build_puzzle_dist.ts` PUZZLES 注册表;client 数据契约 `lib/puzzle-distribution.ts`(UI 在 P2d);范式写入 VARIANT_PLAYBOOK §8。小样本 350 条端到端两跑绿(首跑+增量),峰值 9 吻合公开分布;typecheck EXIT=0。全量灌注+发布留 MANUAL。
- [x] **P2d** WASM 类 + 重建仪式 + **在线最优求解器 UI**。✅ 2026-06-11 `8b92c6312`(9 文件)。路由 `/scramble/pocket` + hub 卡片;新范式组件 `scramble/_components/PuzzleOptimalSolver.tsx`(spec 驱动 event/title/need/solve/tokenRe,后三 puzzle 各写 spec 复用);nuqs `?scramble=`,2D 展开图,cubing-scramble 222 随机。Rust 关键决策:`new_lean()` 新入口(联合移动表 132MB 浏览器吃不消 → 只建 3.6MB 距离表现场转移)+ `solve_one_any`/`enumerate_any` 24 旋转归一(解带整体旋转前缀);零盘表零下载,V bump 20260611e。门:cargo pocket 6/6(lean↔full 全空间相等)+ node 冒烟 12 条 native↔wasm 相等 + cubing.js replay 12/12 + typecheck/zh 绿 + playwright 桌面+390px 全 PASS 0 error。
- [x] **P2e** `/code/solvers` 看板登记 + **📦 MANUAL(2x2x2)** 灌注/发布交接写 §3。✅ 2026-06-11 `7059b70c1`(1 文件)。NATIVE 加 pocket(rate null「未实测」+ `puzzle:'2x2x2'` 字段如实标非 3x3)、回填进度区 pocket 单独「待灌注」行不掺 3x3 百分比、TABLES 零盘表条目、BROWSER PocketSolverWasm、small 概览卡;typecheck EXIT=0 + tokens-drift/zh-hant-drift 39 测试绿。**EPIC 3.1(2x2x2)代码侧全链路完成**,MANUAL 交接见 §3。

#### EPIC 3.2 — Pyraminx(核心 933,120 × 顶点 3^4=81 → 含 tips 75,582,720;solver 参考 cstimer `pyraminx.js`)
> 照 2x2x2 范式。注意:顶点(tips)trivial 可分离,步数口径已在 P3a 锁定(总 HTM = 核心查表最优 + 错位 tip 数,有定理证明 + 75.6M 全空间验证);WCA 打乱含小写顶点记号 u/l/r/b,analyzer 必须能吃全记号。
- [x] **P3a** Rust 核心 `pyraminx_solver.rs`(key `pyraminx`)。✅ 2026-06-11 `2f5a4427c`。独立 PyraState(6 棱偶置换 360×翻转 32 + 4 轴心 3^4),move 几何 Rodrigues 实算推导与 cstimer 逐项吻合;核心 933,120 全可达(闭包独立验证,原条目"75,582"系含 tips 总数 75,582,720 的截断笔误,已实算修正);核心距离表 0.9MB+移动表 29.9MB 现场建 ~1s 零盘表;口径=核心最优+错位 tip 数(精确,联合 BFS 75.6M 逐态验证加法公式);God's number 核心 11(分布对 jaapsch 逐项锁)/含 tips 15(卷积逐项断言);5/5 测试绿 + 全量 lib 116/0 + cubing.js 手性 replay 4/4。
- [x] **P3b** analyzer bin `pyraminx_analyzer.rs` + `tests/e2e_pyraminx.rs`(照 pocket_analyzer;吃全 WCA pyram 记号含顶点)。✅ 2026-06-11。CSV `id,pyraminx` 两列,口径=P3a 锁定(核心查表最优+错位 tip 数);pyram 小写 tip 记号进不了 3x3 `string_to_alg` → executor.rs 新增 raw 字符串通道(`RawSolverWrapper`/`run_analyzer_app_raw`,batch/stdin 循环抽私有泛型核与 Move 版共用,旧接口签名不动),解析失败行出 `id,-` 不中断;bin 3 单测(全 16 记号±'±2 / 已还原 0 / 单 tip 1 / `U u'`=2 / 字符串 round-trip 与 lib 直查 60 组逐位一致 / 独立联合 IDDFS oracle 32 组全等)+ e2e 双文件 baseline 锁死(WCA 形态 5 条 + 记号边角 5 条手算)均绿;executor 7/7、pocket e2e+bin 回归绿;全量 lib 120 绿(唯一红 = 并行 session chain_solver.rs 未提交 WIP 的 golden replay,与本单元无关);smoke 5 条 WCA pyram → 10/11/10/11/11 全 ≤15。
- [x] **P3c** 统计管线:PUZZLES 注册表加 pyraminx。✅ 2026-06-11 `68f8b24f4`(3 文件)。event `pyram`,metric htm 含 tips;ps1 加 analyzer 表项 + 顺手修 -Puzzles 默认值(空=全部注册,原硬码 pocket 与 docstring 矛盾);client 契约泛型零改动;小样本 350 条两跑绿(首跑+增量),dist 7..13 峰值 11 全 ≤15,与 P3b smoke 吻合。
- [x] **P3d** WASM 类 + 重建仪式 + `/scramble/pyraminx`。✅ 2026-06-11 `15646376c`(12 文件)。照 pocket new_lean 路线:0.9MB 核心距离表现场转移(弃 29.9MB 联合移动表),wasm 首查惰性 BFS node 408ms/浏览器 613ms 后续 <1ms;解=核心大写+tips 小写;V bump 20260611h,TABLE_SETS.pyraminx=[] 零下载,pyram 跳过 3x3 normalizeScramble;PuzzleOptimalSolver 加可选 placeholder prop(默认示例 F2 对 pyram 非法,防教错);门全绿:cargo 6/6 + node 冒烟 12 条相等 + cubing.js replay 12/12(isIdentical)+ typecheck/zh + playwright 桌面+390px en/zh 0 error(主 loop 复核 typecheck EXIT=0,harness 中途诊断系过期快照)。
- [x] **P3e** 看板登记 + **📦 MANUAL(Pyraminx)** 交接写 §3。✅ 2026-06-11 `f9ce5ef61`(1 文件)。NATIVE/TABLES/BROWSER/概览卡照 pocket 范本;顺手把待灌注行语料文案按 event 参数化(去 pocket 硬码);typecheck EXIT=0 + 39 守卫测试绿。**EPIC 3.2(Pyraminx)代码侧全链路完成**,MANUAL 交接见 §3。

#### EPIC 3.3 — Skewb(全空间 3,149,280;/trainer/skewb 已有宿主;solver 参考 cstimer `skewb.js`,`mathlib.Solver(4,2,...)` BFS)
> 照范式。注意:Skewb 件 = 8 角(两轨道各 4)+ 6 中心,WCA 打乱记号 U/L/R/B ± '(角转);态数/件集合/固定参照自行从 cstimer 推导并独立暴力对照,别信记忆(3,149,280 待实算验证);God's number 文献 11(对公开分布逐项锁)。
- [x] **P4a** Rust 核心 `skewb_solver.rs`(key `skewb`)。✅ 2026-06-11 `507a73ca4`。推导修正调研预期:WCA 4 轴 = cubing.js 角 6/4/5/7,{4,5,6} A3 轨道 + {0,1,2,7} A4 轨道,**角 3 完全不动不扭 = 天然全局参照**(无需消朝向);move 数组取自 cubing.js kpuzzle 现场 dump 与 cstimer 4320×2187/3 交叉核对。态数 360×12×3×3^5=3,149,280 闭包实算相符、编码恰双射;God 数 11,分布对 jaapsch 逐项锁。实现即 lean:3.0MB u8 距离表现场 BFS ~1.2s,转移件级现算(full 联合移动表理论 100.8MB 不建,P4d 直接用 lean);4/4 测试绿 + 全量 lib 126/0 + cubing.js 手性 replay 8/8(P4d 消险)。
- [x] **P4b** analyzer bin `skewb_analyzer.rs` + `tests/e2e_skewb.rs`。✅ 2026-06-11 `e19a58529`(2 文件,executor/solver 零改动)。走 raw 通道(skewb 全大写但语义非 3x3,X2=240° 走 string_to_alg 会错映);bin 3 单测(全 8 记号 / round-trip×60 / 件级 IDDFS oracle×32)+ e2e 双 baseline(真实 WCA 5 条 9/9/9/8/8 + 手算 5 条)锁死;P4a 4/4 不塌、全量 lib 126/0;smoke 5 条全 ≤11。
- [x] **P4c** 统计管线:PUZZLES 注册表加 skewb。✅ 2026-06-11 `b6c965160`(3 文件)。event `skewb`,label_zh「斜转」(对齐站内十余处既有叫法);350 条两跑绿(首跑+增量),dist 7..10 峰值 9 全 ≤11;client 契约零改动。
- [x] **P4d** WASM 类 + 重建仪式 + `/scramble/skewb`。✅ 2026-06-11 `57057e6bd`(10 文件)。SkewbSolverWasm 零下载惰性 BFS(首查 node 2.5s/浏览器 3.3s,复查 <1ms);V bump 20260611i,skewb_ 跳过 3x3 normalizeScramble;预览零新 SVG(ScramblePreview2D 按 event 已路由 skewb_svg.ts);hub 卡片「斜转求解」。门全绿:cargo + 冒烟 12/12 + cubing.js replay 12/12 + 浏览器实产 3/3 + typecheck(主 loop 复核 EXIT=0,harness 诊断又是过期快照)+ playwright 桌面+390px en/zh 0 error。⚠坑(SQ1 参考):cubing.js skewb kpuzzle 给 CENTERS 记 mod-4 orientation(物理不可见),isIdentical 严格比对误判"未还原",experimentalIsSolved 对 skewb 未实现——replay 口径=角(位置+扭转)+中心位置,忽略中心自转。
- [x] **P4e** 看板登记 + **📦 MANUAL(Skewb)** 交接写 §3。✅ 2026-06-11 `abf2cb466`(1 文件)。NATIVE/TABLES/BROWSER/概览卡照 pyraminx 范本;typecheck EXIT=0 + 39 守卫绿。**EPIC 3.3(Skewb)代码侧全链路完成**,MANUAL 交接见 §3。

#### EPIC 3.4 — SQ1 S1+S2(~3.4 亿 shape-reachable,双阶段 search + 剪枝表,非全表;solver 参考 cstimer `scramble_sq1_new.js`,min2phase 风格 WCA 标准最优)
> 最重的一个,与前三只 puzzle 的"全表 BFS"模板不同:走双阶段 search + `SquarePrun` 式剪枝表(几 MB 级内存表,仍零盘表目标;若推导出需 >1G 落盘表 → 停,按 §0.10 大表特例红灯问用户)。打乱记号 `(x,y)` twist 对 + `/` slash;步数度量先按 cstimer 口径推导(slash 计 1 步,twist 计法在 P5a 定死并对公开 God 数核验)。cubing.js sq1 kpuzzle 比对注意 P4d 的中心自转坑同类问题 + memory 提的 sr-puzzlegen sq1 渲染坑(预览用现有 `_svg/sq1_svg.ts` / `lib/sq1-svg.ts`)。
- [x] **P5a** Rust 核心 `sq1_solver.rs`(key `sq1`,shape/层状态模型,双阶段 search + 剪枝表)。门:cargo test --release sq1 绿,含独立暴力对照(浅层 IDDFS oracle)+ 已知最优案例核验;God 数/分布对公开数据(twist metric 口径写死)。✅ 2026-06-12 `5b7c44950`(实现)+ `0e740eaf5`(性能修复+基线回填)。cstimer SqCubie 同构模型;twist 口径定死(slash=1、层转=0,God 数 13 对 jaapsch 锁死,另用 face-turn metric 深度 0..6 分布锁机械正确性);双阶段 IDDFS,phase-1 五张全空间投影精确表取 max(~43MB nibble 打包现场 BFS,零盘表),phase-2 限方形子群;6/6 绿(oracle/已知最优/公开分布/round-trip/基线)+ 全量 lib 132/0;16 刀深游走最差 7.3s(初版 49min 爆炸已修),典型随机态(d≈10-11)秒级。⚠ P5b/P5c 百万态灌注嫌慢的话:根节点 8 线程并行预计再 ~5×,或批量层并行。
- [x] **P5b** analyzer bin `sq1_analyzer.rs` + `tests/e2e_sq1.rs`(raw 通道,吃全 WCA sq1 记号 `(x,y)/`)。门:e2e 绿 + smoke 形状对。✅ 2026-06-12 `d104a7a16`(2 文件,executor 零改动)。bin 3 单测(round-trip×20 / 手算边角含 `(0,0)` 容忍 / 字符串通道 vs lib 直查×12)+ e2e 双 baseline(真实 WCA 5 条锁 11,9,10,9,11 含悬挂 `/`;手算 5 条锁 0,1,1,0,0);P5a 6/6 + 全量 lib 132/0 未塌;smoke 全 ≤13。⚠ P5c/灌注预警:单态时长方差大(多数 0.05~4s,少数 d=11/12 态 45~95s,24 条实测),百万态全量前需根节点并行或批量层并行;executor 按首个逗号切 id,sq1 记号含逗号 → **输入行必须带显式 id**(管道语料恒有)。
- [x] **P5c** 统计管线:PUZZLES 注册表加 sq1(event_id `sq1`)+ 小样本验形。门:端到端小样本绿。✅ 2026-06-12 `84ee30e18`(3 文件)。PUZZLES 加 sq1(label Square-1 / SQ1,metric `twist`,叫法对齐全站口径);raw batch 本就 rayon 并行但单态单线程(并行摊量不削尾);两跑绿(首跑 49 条 830s + 增量 1 条 23s),dist 9..12 峰值 11(24/52),God 13 内,与 P5b smoke 吻合;client 契约零改动。⚠ **实测灌注成本远超 P5b 预警**:WCA 随机态平均 ~200 CPU-s/态 + 病态长尾(单态 10min+ 未出解被杀,300 条块 8 线程 37min 未完,尾部主导);样本因此收缩到 52,29 条病态/未测在本地 scratch csv 以 `-` 占位。**全量灌注前置:先做根节点并行(P5a 预留 ~5×)/更强启发式;灌注时清空 `D:\cube\scramble\puzzle\sq1\` 重来或显式回填 `-` 行。**
- [x] **⏸ soft-gate(P5d 设计)解除** ✅ 2026-06-12 用户拍板:**先上近最优上界,再想最优**。精确最优长尾爆炸不可行(500 态/6min 不收敛),改走 **cstimer 双阶段近最优**(`solver/src/sq1_twophase.rs`,忠实移植 ShapePrun+SquarePrun,node 跑 cstimer 真解器 81 条逐位等同验证)。**6.3ms/态**(原 200s 的 3 万倍),stats + 在线求解器双双可行。stats 已灌+发布(见下);P5d「秒级 loading 态」前提作废(ms 级)。gap:+0/52% +2/44% +4/4%,均 +1,真上界。「逼近最优」(双阶段迭代总长 / 更紧剪枝)= deferred「想最优」项。
- [x] **P5c.5 SQ1 近最优 stats 灌注+发布** ✅ 2026-06-12(📦 MANUAL,用户在场)。`sq1_analyzer.exe` 默认两阶段 + **WCA 12c4 计步**((X,Y)=1+/=1,`solve_wca`;`SQ1_METRIC=slash`/`SQ1_EXACT=1` 切口径);全 125,605 条 ~50s,**WCA dist 11..30 峰 25**(slash 口径才 5..15 峰 12);`puzzle_distribution.json`+`puzzle_examples.json`(sq1 19 bin/333 样本)scp static + 公网 curl 验证上线;前端难度 tab 选 Square-1 即显示(`PUZZLE_EVENT_MAP` 加 sq1,口径行标「WCA 12c4 近最优」,**示例打乱用简写记号** `formatScrambleForEvent`,无求解器页故示例不可点);V bump 20260612c;exact ground-truth 存档 `sq1_exact_groundtruth.csv`;管道修空 master 丢表头边界。**未 commit(并行 session 脏树,等用户查)**。⚠ 用户核对 WCA 12c4 原文后纠正:原 slash-only 口径非官方,已切 WCA 12c4。
- [ ] **P5d** WASM 类 + 重建仪式 + `/scramble/sq1`(近最优双阶段在线求解器;6.3ms 原生,WASM 估计仍亚秒;预览走现有 sq1 svg)。门:typecheck + node 冒烟相等 + playwright(replay 独立验证,注意 kpuzzle 等价口径)。建后把 stats 示例卡 sq1 改可点跳此页。
- [ ] **P5e** 看板登记 + **📦 MANUAL(SQ1)** 交接写 §3。门:typecheck + code-tokens-drift 绿。

---

## §2 PROGRESS LOG(append-only)

- 2026-06-10 — 文件创建,backlog 锁定,等 `/loop` 启动。
- 2026-06-11 — **H1** HTR Rust 核心 + 测试,`ef61f9f7f`。上轮宿主机卡死遗留的未提交代码经独立核对后原样验收(零重写);全空间 2.8M 态内存精确表,soft-gate 解除;5 测试全绿含暴力对照,God's number=13。
- 2026-06-11 — **H2** HTR analyzer bin + e2e,`9f61985bf`。7 列 CSV(_htr 后缀)与 dr_analyzer 同构;e2e 绿、H1 测试未塌、smoke 形状对。
- 2026-06-11 — **H3** HTR WASM 类 + 重建仪式,`015e0ad58`。HtrSolverWasm + worker htr 分支 + client V bump(20260611a)+ PoolNeed;顺手补了 eodr 上次漏的 2 个 stale .d.ts;typecheck 主 loop 双工具复核绿。
- 2026-06-11 — **H4** StageSolver 集成 HTR,`c753f09c5`。8 登记点对齐 eoline + scramble-variants 4 点 + TNoodleMode 类型 ripple;HTR_NOT_DR 哨兵 7 处接线(主 loop grep 复核);playwright 独立 agent 验收 8/8 PASS。
- 2026-06-11 — **H5** /code/solvers 看板登记 HTR,`af97a2c0a`。EPIC 1 代码侧全部完成;MANUAL(HTR) 交接写入 §3。
- 2026-06-11 — **M1** 引擎 move-mask 能力,`07e93483d`。u32 bitmask + `*_masked` 入口;全量 94/94 绿,mask=全集逐位相等锁死 + 限 G2 暴力对照。
- 2026-06-11 — **M2 soft-gate 解除**:用户拍板做,key `roux_s2`,展开 M2a–M2e(下一个 = M2a)。
- 2026-06-11 — **协议改版**:§0.7/§0.9 改为标准 Ralph"跑到底"——删除原 §0.9b"6-8 单元预防性停 + 让用户 /clear"的非标准摩擦;退出只认 backlog 空 / GATE / 红灯 / 空转 / ~15 单元安全网。依据:Ralph Wiggum 社区标准用法(状态在文件、跑到完成信号才停)。
- 2026-06-11 — **M2a 红灯**(见 §3):扩 ⟨M,U,R,r⟩ move 集撞 18-stride 承重墙(36 文件 + 34GB 表),触"绝不重构 cube_common"红线。loop 按协议停,等用户三选一。
- 2026-06-11 — **M2 拍板:伪 roux_s2**。用户选 (A),M2a 扩引擎取消,M2b 改"18-move+共轭"伪路线 + design-first soft-gate(若实质=已有 123 系则停)。红灯解除,继续。
- 2026-06-11 — **M2b soft-gate:伪路线亦死**(见 §3)。固定 18-move 模型 M 不可当 1 步,伪 roux_s2 = roux_s1 重复。roux_s2 整个 epic 两路皆绝。loop 停,等用户定弃 M2→M3。未写代码。
- 2026-06-11 — **用户拍板弃整个 M2**(M2a–M2e 全取消,零代码)。下一个 = M3(HTR phase-2)。
- 2026-06-11 — **M3a** HTR phase-2 核心 `htr2`,`2996acf17`。663,552 全空间精确表(648KB,零盘表),复用 M1 mask 限 6 双转;663,552 全枚举暴力对照绿,God's number=15。
- 2026-06-11 — **M3b** htr2 analyzer + e2e,`8e6496a83`。照 htr_analyzer 同构;e2e 绿、lib 9 全绿、smoke 形状对(G3 词 6 视角恒同值)。
- 2026-06-11 — **M3c** htr2 WASM + 重建仪式,`a8b9449f4`。HtrPhase2SolverWasm + worker htr2 分支 + V bump + PoolNeed;零盘表;typecheck EXIT=0,node 冒烟 native↔wasm 全等。
- 2026-06-11 — **M3d** htr2 StageSolver UI,`5626a0e9c`。playwright 8/8 + native↔WASM 12/12;文案 HTR 收尾/HTR-finish。(发现并行 AI 的 arch-data.tsx:316 语法 WIP,非本域。)
- 2026-06-11 — **M3e** htr2 看板登记,`4cd201d20`。typecheck+drift 全绿。**EPIC 2 完成(M1 done / M2 弃 / M3=htr2 全链路 done)。下一个 = EPIC 3 P0 ⛔ GATE,loop 按协议停。**
- 2026-06-11 — **EPIC 3 GATE 调研**(`a73a3b5f1`)+ **用户拍板**:四个非 3x3 全做 + 接统计管道(整解最优步数分布,修正调研"无落点");展开 EPIC 3.1–3.4,顺序 2x2x2→Pyraminx→Skewb→SQ1,灌注/发布 MANUAL。下一个 = P2a(2x2x2 核心)。
- 2026-06-11 — **P2a** 2x2x2 核心 `pocket`,`c1c6c18db`。3,674,160 全表 BFS 零盘表,God's number=11 HTM,全枚举暴力对照绿。**本 session 已推进 ~15 单元(H1–H5/M1/M2a-b/M3a-e/GATE/P2a)+ 大量决策对话,按 §0.7 安全网停一次,/clear 重 /loop 续(下一个 = P2b)。**
- 2026-06-11 — **P2b** pocket analyzer + e2e,`65affa381`(新 session 起点)。全 18 记号经 24 旋转归一;IDDFS 独立 oracle 40 组全等;e2e + 全量回归绿;smoke 5 条形状对。
- 2026-06-11 — **P2c** 非 3x3 统计管线注册,`550f71c0d`。puzzle_distribution.json 新形态 + update_puzzle_stats.ps1 增量管道 + 数据契约 lib/puzzle-distribution.ts + 范式入 playbook §8;350 条小样本两跑验形。(harness 报 build_puzzle_dist.ts node 类型诊断 = LSP 误报,import 与既有 build.ts 同款且 tsx 实跑两遍绿。)
- 2026-06-11 — **P2d** pocket WASM + /scramble/pocket 在线最优求解器,`8b92c6312`。new_lean 3.6MB 距离表(弃 132MB 联合移动表)+ 24 旋转归一出解;PuzzleOptimalSolver spec 范式;全门绿(cargo/冒烟/replay/typecheck/playwright)。wasm 产物与并行 session 的 chain 变体 commit(7da7e2c02)字节一致免重复提交。
- 2026-06-11 — **P2e** pocket 看板登记,`7059b70c1`。typecheck + 39 守卫测试绿。**EPIC 3.1 完成**,MANUAL(2x2x2) 交接入 §3;EPIC 3.2(Pyraminx)按既定计划细化为 P3a–P3e。下一个 = P3a。
- 2026-06-11 — **P3a** pyraminx Rust 核心,`2f5a4427c`。核心 933,120(修正 backlog 笔误)/含 tips 75.6M 全空间验证;口径=核心最优+tip 数(定理+全空间断言);God 数 11/15 对公开数据逐项锁;5/5 + lib 116/0 + cubing.js 手性 4/4。
- 2026-06-11 — **P3b** pyraminx analyzer + e2e,`ed5722750`。executor 新增 raw 字符串通道(小写 tip 进不了 string_to_alg);bin 3 单测含独立 IDDFS oracle + e2e baseline 锁死全绿;pocket/executor 回归绿;smoke 5 条 WCA pyram 10/11/10/11/11 全 ≤15。lib 唯一红 = 并行 chain_solver WIP,非本单元。下一个 = P3c。
- 2026-06-11 — **P3c** pyraminx 统计管线,`68f8b24f4`。PUZZLES 加 pyram + ps1 表项与默认值修正;350 条两跑验形,dist 峰值 11。下一个 = P3d。
- 2026-06-11 — **P3d** pyraminx WASM + /scramble/pyraminx,`15646376c`。lean 0.9MB 现场转移,首查 ~0.6s;replay 12/12;playwright en/zh 双断点全 PASS。下一个 = P3e。
- 2026-06-11 — **P3e** pyraminx 看板登记,`f9ce5ef61`。typecheck + 39 守卫绿。**EPIC 3.2 完成**,MANUAL(Pyraminx) 交接入 §3;EPIC 3.3(Skewb)细化为 P4a–P4e。下一个 = P4a。
- 2026-06-11 — **P4a** skewb Rust 核心,`507a73ca4`。角 3 天然全局参照(修正调研);3,149,280 闭包验证;God 数 11 对 jaapsch 逐项锁;lean 3.0MB 即主实现;4/4 + lib 126/0 + 手性 8/8。下一个 = P4b。
- 2026-06-11 — **P4b** skewb analyzer + e2e,`e19a58529`。raw 通道;双 baseline 锁死;lib 126/0;smoke 5 条全 ≤11。下一个 = P4c。
- 2026-06-11 — **P4c** skewb 统计管线,`b6c965160`。PUZZLES + ps1 表项;350 条两跑验形,dist 峰值 9。下一个 = P4d。
- 2026-06-11 — **P4d** skewb WASM + /scramble/skewb,`57057e6bd`。replay 12/12 + 浏览器 3/3;cubing.js skewb 中心自转坑记入 §1 条目。下一个 = P4e。
- 2026-06-11 — **P4e** skewb 看板登记,`abf2cb466`。typecheck + 39 守卫绿。**EPIC 3.3 完成**,MANUAL(Skewb) 交接入 §3;EPIC 3.4(SQ1)细化为 P5a–P5e。**本 session 连续推进 14 单元(P2b–P4e),按 §0.7 安全网停一次,/clear 重 /loop 续(下一个 = P5a,SQ1 双阶段,最重)。**
- 2026-06-12 — **P5a** SQ1 Rust 核心,`5b7c44950`(实现,被并行 session 打包)+ `0e740eaf5`(性能修复+基线回填)。过程:两个子 agent 先后死于"后台等测试不收尾"(主 loop 直接接管基线回填);初版 16 刀深态 IDDFS 爆炸(单态 49min 单核满载,实测后杀),聚焦修复换五张全空间投影表 max 启发式(节点数 16.5 万倍削减)后最差 7.3s;6/6 + 全量 lib 132/0。教训已写派发模板:cargo 一律前台跑 + 10min 自断。下一个 = P5b。
- 2026-06-12 — **P5b** sq1 analyzer + e2e,`d104a7a16`。raw 通道照 pyraminx 范本;真实 WCA 5 条 + 手算 5 条双 baseline 锁死;全量 132/0。预警:单态方差大(少数深态 45~95s),灌注侧需并行(写进 P5b 行 + P5c 判断)。下一个 = P5c。
- 2026-06-12 — **P5c** sq1 统计管线,`84ee30e18`。两跑绿(49+1 条),dist 峰值 11;实测平均 ~200 CPU-s/态 + 病态长尾 → P5d「秒级」设计前提被打破,挂 ⏸ soft-gate(§3 四选一),**loop 按协议停,等用户拍板**。(build_puzzle_dist.ts 的 node 类型诊断仍为 P2c 已记录的 LSP 误报。)

---

## §3 BLOCKERS / 需用户决策 / MANUAL 交接

- 磁盘历史(决策依据):`solver/tables/` ~34GB;曾有 6.6G 表、剩余一度 5.5G。任何 >1G 新表先 `df -h` + 红灯确认。
- **✅ 2026-06-12 MANUAL 灌注+发布完成(pocket/pyraminx/skewb,用户在场手动)**:全量解算 — pocket 435,680(dist 4..11 峰 9)、pyraminx 313,373(6..14 峰 11)、skewb 223,853(7..11 峰 9);`stats/scramble/puzzle_distribution.json` 重算(临时排除 sq1 小样本,build 脚本即改即还原未提交)+ commit `7377bd4d6` + scp static.cuberoot.me `/stats/scramble/`,公网 curl 验证三 puzzle 全量、sq1 缺席。**仍 pending:`/scramble/stats` 的 puzzle 难度分布展示 tab 未做**(P2c 只落数据契约 `lib/puzzle-distribution.ts`,无消费 UI)——数据已上线但网页尚无展示入口。sq1 灌注+发布仍待 P5d soft-gate 拍板后做。
- **⛔ M2a 红灯 — 扩 move 集撞承重墙(2026-06-11,等用户三选一)**:
  - **推导**:8角12棱无中心模型在"件"层面能表达 M(4 棱 cycle+flip)/ r(=R∘M'),朝向参照无矛盾(cstimer 也不在求解器里用 M 切片搜索,M/r 只在记号层)。但整个 move-table / 剪枝 / 搜索 **硬编码 stride=18**(`valid_moves` 用 `i/3==prev/3` 面剪枝、`MASK_ALL=(1<<18)-1`、`INV_MOVE:[u8;18]`、`create_multi_move_table` 列宽 18、坐标乘 18),**36 个源文件 + 34GB 表**全建在 18-stride 上。原生加 M/r(索引≥18)= 重构表生成引擎 + 重建全部表,明确触 §0.3 红线。
  - **三条路**:(A) **伪 roux_s2**(推荐):M2b 的 ⟨M,U,R,r⟩ 搜索不扩引擎,在现有 18-move + 视角共轭里表达 Roux S2 阶段(M=共轭切片组合、r=R+M'),输出用记号规整器译回 M/r 显示。零引擎重构,落在现有 mask+conj+pseudo 能力内。(B) **真重构**:stride 18→24 改表生成引擎 + 重建 34GB 表(磁盘紧 + 波及全舰队,高风险)。(C) **弃 M2**:roux_s2 本是 nice-to-have,本站口径已用 `123x2` f2b 联合最优替代;直接跳到 M3。
  - ✅ **2026-06-11 用户拍板:走 (A) 伪 roux_s2**。M2a"扩引擎"取消,M2b 改伪路线 + design-first soft-gate(伪路线若实质等于已有 123 系就停,别造重复)。红灯解除,loop 继续。
- **📦 MANUAL(htr2) 交接**(2026-06-11,M3a–M3e 代码侧全绿落地,等用户在场手动):同 HTR 一样是条件式阶段——随机 master 打乱直灌 htr_phase2_analyzer 全 `-`(打乱不在 G3)。口径同 MANUAL(HTR):(a) 只做 analyzer 在线查询(现状,零额外工作);或 (b) 输入集用"先降到 HTR(G3)后的态"(需串 htr 阶段)。若灌统计:注册管道 `_htr2` 列 → 灌 → distribution.json htr2 分桶;UI 加 VARIANT_ORDER(M3d 故意未加)+ 各下游登记点;看板 NATIVE htr2 rate 从「未实测」改实测(M3e 已留 null 槽)。
  - ⛔ **2026-06-11 M2b soft-gate:伪路线也死**。推导确认固定 18-move 模型 M 不能当 1 步(M≡R L' x'),伪 roux_s2 只能给 FTM 最优 SB = 与现有 `roux_s1_solver`(全部 24 个物理 1x2x3 块)逐位等价,cstimer 亦只报 FTM。**roux_s2 作为独立有意义变体两条路皆绝(扩引擎撞墙 / 伪路线重复)**。建议:弃整个 M2(M2a–M2e),推进 M3;若仍要 Roux SB 的 FTM 数,复用 `RouxS1Solver` 右块视角即可,无需新变体。等用户定。
- (MANUAL 交接条目在此累积:变体名 + 待跑的灌注/发布步骤,等用户在场手动跑)
- **📦 MANUAL(2x2x2 pocket) 交接**(2026-06-11,P2a–P2e 代码侧全绿落地,等用户在场手动):
  1. 全量灌注:`pwsh solver/update_puzzle_stats.ps1 -Puzzle pocket`(增量、可续跑;analyzer 查表 ~百万/s,瓶颈在 IO/CSV,全量 WCA 222 语料预计分钟级)。
  2. 产出:`stats/scramble/puzzle_distribution.json`(meta.generated_at + puzzles.pocket.dist)。
  3. 发布:deploy_mirror 已停 → 手动 scp 到 static.cuberoot.me 的 `/www/wwwroot/toolkit/stats/scramble/`(memory `reference_static_toolkit_deploy`);改响应 shape 须 bump `lib/puzzle-distribution.ts` 的 V。
  4. UI 待办:`/scramble/stats` 的 puzzle 分桶 tab **尚未接**——P2c 只落数据契约 `lib/puzzle-distribution.ts`(fetchPuzzleDistribution,dist 兼容 DiscreteHistogram/computeStats 直接复用)。
  5. 看板回填:实测吞吐后回 `/code/solvers` page.tsx 把 pocket 的 `rate: null` 改实测值,「待灌注」行接真实覆盖数。
- **📦 MANUAL(Pyraminx) 交接**(2026-06-11,P3a–P3e 代码侧全绿落地,等用户在场手动):
  1. 灌注:`update_puzzle_stats.ps1`(默认 -Puzzles 空=全部注册含 pyraminx;语料=Scrambles.tsv event `pyram`,id 差集增量,-MaxNew 可分批)。
  2. 产出:`stats/scramble/puzzle_distribution.json` 的 `puzzles.pyraminx`(metric=htm 含 tips,预期峰值 11 全 ≤15)。
  3. 发布:scp 到 static.cuberoot.me `/stats/scramble/`(同 pocket,一次发布两 puzzle 一起带)。
  4. stats 页 tab:`/scramble/stats` 非 3x3 puzzle 分布 tab 与 pocket 共用待办(契约 `lib/puzzle-distribution.ts` 已就位)。
  5. 看板 rate 回填:全量跑完实测后改 `/code/solvers` NATIVE pyraminx 的 `rate: null`。
- **📦 MANUAL(Skewb) 交接**(2026-06-11,P4a–P4e 代码侧全绿落地,等用户在场手动):
  1. 灌注:`update_puzzle_stats.ps1`(默认 -Puzzles 空=全部注册含 skewb;语料=Scrambles.tsv event `skewb`,id 差集增量,-MaxNew 可分批)。
  2. 产出:`stats/scramble/puzzle_distribution.json` 的 `puzzles.skewb`(metric=htm,350 条样本峰值 9 全 ≤11)。
  3. 发布:scp 到 static.cuberoot.me `/stats/scramble/`(与 pocket/pyraminx 一次发布一起带)。
  4. stats 页 tab:`/scramble/stats` 非 3x3 puzzle 分布 tab 与 pocket/pyraminx 共用待办(契约 `lib/puzzle-distribution.ts` 已就位)。
  5. 看板 rate 回填:全量跑完实测后改 `/code/solvers` NATIVE skewb 的 `rate: null`。
- **📦 MANUAL(HTR) 交接**(2026-06-11,H1–H5 代码侧已全绿落地,等用户在场手动):
  1. **先拍板口径**:WCA master 随机打乱直灌 htr_analyzer 会得全 `-`(随机打乱不在 DR 态,H2 实证)。可选:(a) 不灌全量统计,htr 只做 analyzer 在线查询(现状即此,零额外工作);(b) 输入集改"先过 DR 阶段后的态"(需定义 DR 解的选取规则,管道要串 dr→htr);(c) 只灌天然 DR 态子集(~1/19万,样本太稀,不推荐)。
  2. 若选 (b):统计管道注册(update_cross_stats.ps1 / build 流程加 `_htr` 列)→ 灌 master/xcross → `stats/scramble/distribution.json` 进 htr 分桶。
  3. UI 接入:`VARIANT_ORDER` 加 htr(H4 故意未加,gen/recent 下拉才会出现)、RecentScrambles / stats 页 / SheetView / CompCrossAnalysis / useCompSteps / useVariantStepMap 各登记点(H4 摘要列过,grep `'eoline'` 对照)。
  4. 看板回填:`/code/solvers` NATIVE htr 的 rate 从「未实测」改实测值(H5 已留 null 槽位)。
  5. static 发布照常规仪式。
- ~~⏸ soft-gate(M2) 待拍板~~ ✅ 2026-06-11 用户拍板:做,key `roux_s2`,已展开 M2a–M2e(见 §1)。S1+S2 联合 vs 只 S2 留给 M2b 推导后定。

### ⛔ EPIC 3 GATE 调研(2026-06-11,只读 + 推导,等用户拍板「开工哪个 + 接不接管道」)

**核心结论**:四个都是非 3x3 puzzle,`cube_common`(`State{corners:[u8;8],edges:[u8;12]}` + 18-move + Lehmer 编码)是为 3x3 件锁死的,**四者全 0 复用**,各需独立状态模型与移动表(几十~一两百行 Rust 一套,小空间全表 BFS,不落盘大表)。但本舰队用途 = **3x3 打乱的分阶段难度统计喂 `/scramble/*`**;这四个 puzzle 的 scramble 已由 cubing.js + cstimer 引擎现成生成,**没有任何"在 3x3 打乱上做分阶段统计"的语义**——它们各是独立 puzzle,进 master 灌注管道无意义。所以即便做,落点只能是「在线求解器 / 打乱难度直方图独立页」,不是现有 analyzer/gen 管道。

**现成资源(全部已在仓库,不需新造)**:
- 渲染:`client/app/[lang]/scramble/gen/_svg/` 已有 `sq1_svg.ts`/`pyraminx_svg.ts`/`skewb_svg.ts`(+ `mega_svg.ts`);`components/PuzzleSVG.tsx`/`lib/sq1-svg.ts`;`/trainer/skewb` 已上线。
- 打乱:`lib/cubing-scramble`(cubing.js WCA,含 222/sq1/pyram/skewb)+ `lib/cstimer-scramble` 双轨,`/scramble/gen` 已全部生成 + 画图。
- 求解参考(cstimer,`D:\cube\cstimer\src\js\`):2x2x2 = `tools/gsolver.js::pocketCube`(BFS gSolver,完整最优,且 333 step solver 已复用其块求解);SQ1 = `scramble/scramble_sq1_new.js`(双阶段 search + `SquarePrun` 剪枝,min2phase 风格 WCA 标准最优);Skewb = `scramble/skewb.js`(`mathlib.Solver(4,2,...)` BFS,普通 + ivy);Pyraminx = `scramble/pyraminx.js`(`mathlib.Solver(4,2,...)` BFS + phase 表)。

**对照表**:

| puzzle | 状态空间(数量级) | 复用现模型? | 工作量量级 | 现成渲染/打乱/solver 参考 | 接 /scramble 管道? | 落点 |
|---|---|---|---|---|---|---|
| 2x2x2 口袋 | 3,674,160(7!·3^6) | ❌ 8 角无棱模型 | 小:全表 BFS(~3.7M u8 ≈ 3.6MB)零落盘,~半天 | 全有;solver=gsolver.js pocketCube | ❌ 无 3x3 分阶段语义 | 在线最优求解器 / 打乱难度独立页 |
| Skewb | 3,149,280 | ❌ 4 轴中心 + 8 角独有件 | 小:全表 BFS ~3MB,~半天 | 全有(/trainer/skewb 已在);solver=skewb.js | ❌ 同上 | 同上(可挂 /trainer/skewb 旁) |
| Pyraminx | 933,120(核心 75,582 × 顶点 3^4) | ❌ 顶点/边独有件 | 最小:核心全表 BFS 几十 KB,~半天 | 全有;solver=pyraminx.js | ❌ 同上 | 在线最优求解器(顶点 trivial) |
| SQ1 (S1+S2) | ~3.4 亿(shape-reachable,全态过大) | ❌ shape/层非件模型 | 中:双阶段 search + 剪枝表(照 cstimer 双 prun),非全表 | 全有;solver=scramble_sq1_new.js(双阶段) | ❌ 阶段是 shape→perm,非 3x3 cross/eo/dr | 在线最优求解器 / 步数分布独立页 |

**推荐排序(只摆事实,不替用户决定)**:
1. **最不该进本管道 = 全部**:四者都没有"3x3 打乱分阶段难度"语义,接 `/scramble` analyzer/gen master 管道无落点。若要做,只做独立"在线求解器 / 难度直方图"页,与本舰队统计管道脱钩。
2. **若仍要做,性价比序**:Pyraminx(空间最小、表最小、最快)> 2x2x2(空间小、最经典、口袋魔方有受众)> Skewb(空间小,且 /trainer/skewb 已有宿主页)> SQ1(唯一需双阶段 search + 剪枝表、shape 模型最复杂、工作量最大)。
3. **更省的替代**:这四个 puzzle 的最优/近最优 solver cstimer 已自带且本站已 vendored——要在线求解器**直接复用 cstimer 引擎**(JS,无需 Rust/WASM 新表),比新写 Rust 引擎成本低一个量级;Rust 新引擎只在"要灌百万级打乱跑批统计"时才值得,而恰恰这点没有 3x3 式分阶段语义支撑。

**一句话给用户**:档3 = 另一个 feature(非 3x3,零复用本引擎,零 master 管道落点);最划算路径是若要在线求解器就复用 cstimer 现成 JS solver,本 Rust 舰队不必扩。等用户明确「做哪个 + 用 cstimer JS 还是新写 Rust + 接不接(其实不该接)管道」。

**✅ 2026-06-11 用户拍板(覆盖上面"无落点"结论)**:四个全做 + **接统计管道**。修正:调研把"无 3x3 多阶段语义"误当成"无管道落点",漏了对这些 puzzle 最自然的单阶段管道统计 = **整解最优步数分布**(WCA 打乱语料喂最优 solver,最优解长度分桶,即 cross-stats 的 puzzle 级单阶段版,这些都是 WCA 项目、语料现成)。接管道也正好让 Rust native 引擎有价值(批量跑百万打乱,cstimer JS 那条省事路不适用)。已展开 EPIC 3.1–3.4(见 §1),顺序 2x2x2→Pyraminx→Skewb→SQ1。**灌注 + 发布仍 MANUAL**。

---

- **⏸ P5d 设计 soft-gate(2026-06-12,等用户拍板)**:P5c 实测 WCA 随机态 twist 最优求解平均 ~200 CPU-s/态、病态长尾 10min+(浏览器 WASM 估计再慢 2-3 倍),`/scramble/sq1` 在线「最优」求解器对随机打乱基本不可用,P5d 原设计前提(秒级 + loading 态)不成立。四选一:
  - **(A) 双轨 UX**:秒出近似解(需新写 cstimer 式两阶段非最优快解,新工程量约一个子单元)+ 后台继续证最优、可取消——同 FMC 流式先例(`048fb9f93`)。
  - **(B) 限时最优(最省)**:浏览器 ≤10s 截断,超时显示「状态太深」+ 已证下界;零新引擎工作,页面功能打折。
  - **(C) 先插 P5a+ 性能单元**:根节点并行 + MITM/更强启发式,目标平均 <5s/态,再按原 spec 做 P5d;管线全量灌注同受益(灌注侧反正需要它)。
  - **(D) 弃在线求解器**:P5d 缩为纯 WASM 类 + 分布展示,无交互求解。
  - 推荐:**(C),若仍超秒级再叠 (A)**;只想快点收尾就 (B)。灌注(MANUAL)无论选哪个都建议先做 (C) 的并行部分。

## §4 测试 / 验证欠账(append-only,内存宽松时优先回补)

> 内存紧时按 §0.10 跳过的测试/验收登记在此。每条:**单元 + 跳了什么验收(cargo test --release / e2e / playwright)+ 回补怎么跑**。
> 回补并通过后标 `✅ 日期` 或划掉。**规则铁律:一个变体的欠账没清零前不算完成、不发布上线。**

- (空)

---

## §5 加新求解器 / 新任务(入口 — 不必每次找作者)

- **自己加最快**:往 §1 想要的优先级位置插一行
  `- [ ] 造 XX(语义:目标件集合 / 阶段;照 VARIANT_PLAYBOOK 全链路 core+test+wasm+ui+board + 📦MANUAL)`。
  loop 下一轮读文件即捡起,自顶向下做;**loop 正在跑时中途加也行**,当前单元做完就会看到。不用改代码、不用等谁。
- **拿不准设计再找作者讨论**:件集合 / 状态空间多大 / 现引擎够不够 / 要不要落盘大表——想清楚再写进 §1。
  cstimer 语义参照见 `VARIANT_PLAYBOOK.md` §6;空间 ≤3000 万走全表模板,否则走 IDA*+启发式模板。
- **非 3x3 的 puzzle**(SQ1 / 金字塔 / 斜转 / 二阶)= 档3,需独立状态引擎,走 §1 EPIC 3 的 `⛔ GATE` 先确认。
