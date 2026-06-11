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
   - 前端:`pnpm --filter @cuberoot/client-next typecheck` 干净。
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

### EPIC 3 — 独立 puzzle 引擎(档3,每个都 GATED)
> 非 3x3:`cube_common`(8角12棱)不覆盖,各需独立状态模型;且偏离本舰队"3x3 打乱分阶段难度统计"用途。

- [ ] **⛔ GATE(P0)** 到此**必停**:逐个列出 SQ1 S1+S2 / Pyraminx V / Skewb Face / 2x2x2 口袋魔方的状态模型成本、是否接 `/scramble` 管道,在 §3 给设计取舍,获用户明确"开工 X + 接不接管道"才继续。
- [ ] **P1+**(gated,确认后展开)

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

---

## §3 BLOCKERS / 需用户决策 / MANUAL 交接

- 磁盘历史(决策依据):`solver/tables/` ~34GB;曾有 6.6G 表、剩余一度 5.5G。任何 >1G 新表先 `df -h` + 红灯确认。
- **⛔ M2a 红灯 — 扩 move 集撞承重墙(2026-06-11,等用户三选一)**:
  - **推导**:8角12棱无中心模型在"件"层面能表达 M(4 棱 cycle+flip)/ r(=R∘M'),朝向参照无矛盾(cstimer 也不在求解器里用 M 切片搜索,M/r 只在记号层)。但整个 move-table / 剪枝 / 搜索 **硬编码 stride=18**(`valid_moves` 用 `i/3==prev/3` 面剪枝、`MASK_ALL=(1<<18)-1`、`INV_MOVE:[u8;18]`、`create_multi_move_table` 列宽 18、坐标乘 18),**36 个源文件 + 34GB 表**全建在 18-stride 上。原生加 M/r(索引≥18)= 重构表生成引擎 + 重建全部表,明确触 §0.3 红线。
  - **三条路**:(A) **伪 roux_s2**(推荐):M2b 的 ⟨M,U,R,r⟩ 搜索不扩引擎,在现有 18-move + 视角共轭里表达 Roux S2 阶段(M=共轭切片组合、r=R+M'),输出用记号规整器译回 M/r 显示。零引擎重构,落在现有 mask+conj+pseudo 能力内。(B) **真重构**:stride 18→24 改表生成引擎 + 重建 34GB 表(磁盘紧 + 波及全舰队,高风险)。(C) **弃 M2**:roux_s2 本是 nice-to-have,本站口径已用 `123x2` f2b 联合最优替代;直接跳到 M3。
  - ✅ **2026-06-11 用户拍板:走 (A) 伪 roux_s2**。M2a"扩引擎"取消,M2b 改伪路线 + design-first soft-gate(伪路线若实质等于已有 123 系就停,别造重复)。红灯解除,loop 继续。
- **📦 MANUAL(htr2) 交接**(2026-06-11,M3a–M3e 代码侧全绿落地,等用户在场手动):同 HTR 一样是条件式阶段——随机 master 打乱直灌 htr_phase2_analyzer 全 `-`(打乱不在 G3)。口径同 MANUAL(HTR):(a) 只做 analyzer 在线查询(现状,零额外工作);或 (b) 输入集用"先降到 HTR(G3)后的态"(需串 htr 阶段)。若灌统计:注册管道 `_htr2` 列 → 灌 → distribution.json htr2 分桶;UI 加 VARIANT_ORDER(M3d 故意未加)+ 各下游登记点;看板 NATIVE htr2 rate 从「未实测」改实测(M3e 已留 null 槽)。
  - ⛔ **2026-06-11 M2b soft-gate:伪路线也死**。推导确认固定 18-move 模型 M 不能当 1 步(M≡R L' x'),伪 roux_s2 只能给 FTM 最优 SB = 与现有 `roux_s1_solver`(全部 24 个物理 1x2x3 块)逐位等价,cstimer 亦只报 FTM。**roux_s2 作为独立有意义变体两条路皆绝(扩引擎撞墙 / 伪路线重复)**。建议:弃整个 M2(M2a–M2e),推进 M3;若仍要 Roux SB 的 FTM 数,复用 `RouxS1Solver` 右块视角即可,无需新变体。等用户定。
- (MANUAL 交接条目在此累积:变体名 + 待跑的灌注/发布步骤,等用户在场手动跑)
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
- 渲染:`client-next/app/[lang]/scramble/gen/_svg/` 已有 `sq1_svg.ts`/`pyraminx_svg.ts`/`skewb_svg.ts`(+ `mega_svg.ts`);`components/PuzzleSVG.tsx`/`lib/sq1-svg.ts`;`/trainer/skewb` 已上线。
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

---

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
