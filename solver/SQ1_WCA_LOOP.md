# SQ1 WCA 最优求解器 Loop — 自驱 backlog + 协议

> `/loop 继续造 SQ1 最优求解器`(或"造 SQ1 最优""SQ1 WCA loop")的**单一事实源**。
> 每轮迭代:**先读本文件全文 + 实验笔记 `solver/SQ1_WCA_GODS_NUMBER.md` 全文**(后者是技术事实/尝试史/坑),
> 按 §0 协议推进 §1 backlog 下一个未完成单元,干完更新两份文件(打勾 + §2 日志 + 笔记的尝试记录)。
>
> **终极目标(用户 2026-06-16 定)**:
> ① 把 SQ1 的 **WCA 12c4 最优求解器**做到**任意真实打乱都够快**(现状 A3-full 后:5 真深态全解出无超时,最慢 37.86s;残留最难态 ~38s 是纯 phase-1 成本,待 A4);
> ② 用它接统计管道(精确步数 + 最优打乱)、上 UI;
> ③ 终极:算出 **`D_WCA`**(WCA 12c4 上帝之数,现可证区间 `[13,27]`)。
> **允许建 ≤15GB 大表**(盘缓存,`solver/tables/`,gitignored);**严禁 OOM**;**线程一律 12**(用户 2026-06-16:14→8→12)。

---

## §0 LOOP PROTOCOL(每轮照做)

1. **读本文件 + `SQ1_WCA_GODS_NUMBER.md` 全文**,从 §1 自顶向下找第一个未打勾单元(尊重 EPIC 顺序)。状态只信"代码(git)+ 这两份 md",从不靠记忆;每轮读文件重建状态。
2. **遇 `⛔ GATE`**(需用户拍板的大取舍,如启动多日级 `D_WCA` 全枚举):**停 loop,不 ScheduleWakeup**,§3 写清取舍,正文一句话摘要,等用户。绝不擅自跨 gate。
3. **执行该单元**。重活(建大表 / `cargo test --release` 全量 / 长跑求解)**放后台或派 fresh 子 agent**,主 loop 只收 ≤20 行摘要,保持瘦。给子 agent 的 prompt 用指针(读本文件第 X 单元 + 笔记对应节),别内联长 spec。
4. **内存门(严禁 OOM —— 本机 32GB 但常被占,实测某刻仅 3GB 可用)**:
   - **建表前必查可用内存**(`Get-CimInstance Win32_OperatingSystem` 的 `FreePhysicalMemory` KB)。
   - **真正的 OOM 风险是构建瞬时 frontier,不是表本身**。实测:283MB 表用「frontier 存全态」builder 峰值 **~3.6GB**(frontier ≈ 10× 表大小)。⇒ **表 > ~1GB 前必须先把 builder 改成「frontier 存 u32 索引」或 scan-based**(见 §1 EPIC A 的 A1),否则 3GB 表 → ~15-30GB 瞬时 → 必 OOM。
   - **预算公式**:`需要 ≈ 表大小(dist) + 峰值frontier + 2GB余量`。不够就**别建**(红灯,§3 记账等用户),不死等。
   - **一次只建一张表**;**绝不并发两个重进程**(两个 cargo / cargo+建表),严格串行;建完 drop 瞬时再下一张。
   - **线程(用户 2026-06-16:14→8→12,当前 12)**:`RAYON_NUM_THREADS=12` + 编译 `cargo -j 12`(`CARGO_BUILD_JOBS=12`);长跑进程 BelowNormal 低优先级启动(留机器给用户)。
   - 长建表用后台 + 盯 WS(`Get-Process`),逼近 `可用-2GB` 立即 abort。
5. **验收门(全过才算成,这是最优求解器的命门 —— 错的"最优"比慢更糟)**:
   - **正确性**:任何动 `Sq1WcaSolver` 启发式/搜索/表的改动 → ① 浅层(depth ≤4)对**独立暴力 WCA-BFS oracle 逐态相等**;② 解 **replay 回精确 SOLVED**(不是 `h==0`,见笔记 §7 陪集坑)且 token 数 = cost;③ `twist ≤ WCA ≤ 2·twist+1`。
   - **新表**:`pdb_par_matches_serial` 式**并行==单线程逐字节相等**(先在小表锁死再跑大表);表值**可采纳**(≤ 真 WCA dist,抽样核对)。
   - **Rust**:`cargo test --release`(相关测试)绿;`cargo check --target wasm32-unknown-unknown` 仍编过(deploy 用 wasm,大表/fs 须 cfg-gate 掉)。
   - 门真跑两次仍不过 → **红灯**,停 loop,§3 记失败摘要,等用户。**内存不够跑门 ≠ 红灯** → 降级跳过、§2 记欠账、继续。
6. **诚实记录(用户硬要求)**:成功**与失败**都写进 `SQ1_WCA_GODS_NUMBER.md` §5 尝试记录 + §7 坑。给后人省坑,别只记成功。
7. **提交**:`git add` **只加本单元改的文件**(别 `git add .`),英文 commit message 结尾带
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`,**自动 commit 不 push**。大表是 gitignored,不进 commit。
8. **更新本文件 + 笔记**:勾任务;§2 追加一行(日期 + 单元 + 短 hash);单独 commit 这两份 md(可断点续)。
9. **决定下一步**:默认一路推进直到 backlog 清空。
   - 还有未 gate 单元 → `ScheduleWakeup`(self-paced;有后台长 build/test 时 delay 对齐它,一般 200-600s),**原样回传同一条 /loop 指令**。
   - backlog 全勾 / 下一个是 `⛔ GATE` → **停**,正文收尾总结。
   - 红灯 / 连续 ~3 轮没推进任何单元 → 停,§3 交代。
   - 安全网:单 session 连推 ~12 单元仍没到完成信号 → 停一次,提示 `/clear` 重 `/loop` 续。
10. **不可碰**:**绝不删 near-optimal 求解器 `sq1_twophase`**(留作对照 + 深尾回退,用户 2026-06-16 锁)。**绝不跑全 125 万打乱灌注 / static 发布**(那是 `📦 MANUAL`,§3 留交接)。

---

## §1 BACKLOG(有序,自顶向下)

> 背景全在 `SQ1_WCA_GODS_NUMBER.md`:§3 关键洞察、§4 求解器设计、§5 尝试 A/B/C 记录、§6.6 提速候选、§7 坑。
> **现状基线**(尝试 C 后):7 表启发式(5 张 4-件投影 + 全 8 角/8 棱 PDB 各 283MB),h: mean 15.59 / max 20;
> 中位解秒级,真最优 ~22-25 的深态仍 >5min(根因 = max-PDB 封顶在子空间直径 ~20 < 真 D)。

### EPIC A — 让深态也够快(当前唯一硬阻塞)
- [x] **A0 提交基线**(48a1c7e13,2026-06-16):`Sq1WcaSolver`(sq1_solver.rs +1047 行)+ analyzer `SQ1_WCA_EXACT` 已提交。门绿:`wca_matches_oracle`(5568 态对独立 oracle 全相等,深度 ≤4 证最优)/ `wca_tables_baseline` / `pdb_par_matches_serial` 三测过(56s,大 PDB 各 283MB load OK)。**未跑 `wca_bracket_replay_and_near_opt_cross`**(含 81 真深态,单态 >5min,会 hang —— 见 §3 欠账)。
- [x] **A1 内存安全的大表 builder**(313ed1e28,2026-06-16):新增 `build_pdb_idx_par`——frontier 存 **u32 投影索引(4B)** 而非全态 Sq1State(24B),出队时 `unrank_pdb` 重建代表态再扩展(投影是 move 同态 ⇒ 邻居索引与全态 builder 逐字节相等)。`unrank8`(rank8 逆,阶乘进制,无堆分配)+ `unrank_pdb`(corn_idx/edge_idx 逆;`base.shapes[sid]` 直接给 shape 免建逆表,承载件按 rank8 摆、另一类填 filler)。corn/edge 的 `load_or_build_one` 已切到它。**门全过**:`wca_pdb_unrank_roundtrip`(全 296M×2 索引 round-trip 绿)+ `wca_pdb_idx_builder_matches_file`(#[ignore],重建 corn+edge 各 296593920 字节 **byte-identical** 磁盘旧表)+ **峰值 WS 1.24GB(旧 ~3.6GB,降 2.9×)** + oracle/baseline/par 绿 + wasm32 check 编过(unrank_pdb 在 wasm 是 dead code warning,同既有 corn_idx/edge_idx,无 deny)。下一步 A3。
- [x] **A2 先诊断再加料**(2026-06-16,**先于 A1 做**,见 §3):新增运行时门控 profiler(`wca_profile` + `solve_profile`,默认零成本 + node/time cap 不挂),profile 5 条真深态(id 774-778)。**结论**:h 深态只 13-15、gap 7-12(比估计大);首方形深度浅(6-12)⇒「更早转 phase-2」是伪命题;两种慢模式 = phase-1 节点爆炸 + **phase-2 现搜时间槽**(776/778 仅 1-2 万节点却烧 7-15s)。**杠杆 = A3 角×棱联合精确 phase-2 表(一次查表替现搜)**,非更早入口、非单堆 h。详见笔记 §5 诊断 A2。下一步 A1→A3。
- [x] **A3 加厚 phase-2 —— ✅ 完成(jsq 半成 9d2e7c4ed → A3-full 精确表收尾 aa93699b7,2026-06-16)**:角×棱联合表 `jsq`(`8!·8!·2`=3.25GB,scan-based 建,峰值仅表本身不 OOM,原地转换免 2×)替 `sq_h_wca` 的 `max(csq,esq)`。**正确性门全过**:`max(csq,esq) ≤ jsq ≤ 真距离`(可采纳)+ oracle 5568 态逐字节(最优性保持)+ scan 驱动==frontier + 配对 action 健全。**效果**:777 >5min→35.6s、775 1.3s。**但 <30s-all 门未过**:774/778/776 仍 >90s。profile 定论(笔记 §5「诊断 A3-后」):jsq 只是**更强剪枝启发**,phase-2 仍是搜索(分支~145)⇒ **没消灭 phase-2 时间槽**(776/778,461-753µs/节点),且 phase-1 爆炸(774/777,~23µs/节点 ×9-17/bound)jsq 根本碰不到。⇒「全 <30s」是 **A3-full(13GB 精确 phase-2 查表,杀 776/778)+ A4(phase-1,杀 774/777)** 的多单元目标。
  **→ A3-full 收尾(本轮,详见 §3 + 笔记 §5「工程 A3-full」)**:补 per-layer shape 位的 13GB 精确表 `jsq_full` 建成(12 线程 ~52min,scan-based + 原地转换,无 OOM),phase-2 变 **O(1) 精确查表 + 梯度重建**(无搜索)。`wca_a3_jsqfull_exact`(3104 态 == 独立精确)+ oracle 5568 绿;`wca_a3_deep_timing` **5 真深态零超时**:774=22@6.7s / 775=19@0.26s / 776=22@37.86s / 777=20@0.52s / 778=22@5.0s。**惊喜:精确 h 顺带驯服 phase-1 爆炸(774/777 从估 >5min→秒级)**,推翻 jsq-lite 的悲观外推。残留 776@37.86s 是纯 phase-1 成本 ⇒ A4。
- [x] **A4 phase-1 置换表(TT)—— ✅ 完成(2026-06-17,非大表路线)**。**背景**:全量灌注真实语料撞到远比 776(37.86s)惨的态 —— `inject_sq1_wca_exact.ps1` 在某条上**卡死 11.7h**(无超时机制,12 线程里 11 个早完工、1 个单核死搜)。真凶 = **id=217111**(`(-5,0) / (0,-3) / (3,-3) / (0,-3) / (-4,0) / (0,-3) / (6,0) / (-4,-5) / (4,-4) / (4,-4) / (5,-2) / (-3,0) / (-2,0)`,本身方形态、h=13、actual=**23**);次难 id=218075(h=16,actual=24)。
  **诊断(profile 实证,非猜)**:`solve_profile` 逐 bound 节点数**平坦**(218075:bound22=60M、bound23=60.7M,几何增长本应每层 ×B)⇒ IDA* 大量**重复访问同一状态**。`wca_profile_file`(新增运行时驱动 profiler,读 `SQ1_PROFILE_FILE`,#[ignore])定位。**排序教训**:别按近最优 near 排(松上界),爆炸由 `gap = actual − h` 驱动 ⇒ **按低 h 找最难态**(217111 near 才 25 但最难)。
  **修法**:`dfs` 加 phase-1 **置换表** `tt: HashMap<u128,u8>`,key=`(top48|bottom48|ml|lm)`、值=已证无解的最大剩余预算 `rem`。`tt[key] ≥ rem` ⇒ 直接剪(只缓存**已穷举无解**的子树、且只在 `rem' ≤ 已证 rem` 时剪 ⇒ **保最优**)。`lm` 进 key(turn/slash 交替剪枝令子树随 lm 不同)。profiler 中止时**不写** TT(`profiler_aborted()` 守,否则毒化成假 fail)。
  **OOM 安全**:全局共享计数 `TT_GLOBAL_ENTRIES` + `tt_budget()`(默认 240M≈9GB,`SQ1_TT_BUDGET` 覆盖)⇒ 总内存有界**与线程数无关**(满了停插、查询照旧 ⇒ 只少剪枝不出错),单条怪物可独占大预算(它需要大表),12 线程不 OOM。每 solve 结束 `fetch_sub(tt.len())` 释放。
  **效果(实测)**:218075 **124M→6.3M 节点 / 69.6s→3.9s(~20×)**;217111 **11.7h(无TT)→ 937M 节点 / ~10min 单线程(~80×),用 125M TT 条目(未撞 250M 上限 ⇒ 非 cap-limited,够大即可)**。**保最优已验**:`wca_matches_oracle`(==BFS 真值)+ `wca_bracket_replay_and_near_opt_cross`(数百态 token 数==wca)全过。
  **残留**:217111 是 chunk 6(500 条)里最难;全语料 125k 可能有更难者(actual 24-25,TT 下或仍 ~30-60min/条),未全扫。但**已从"无限卡死"变"有界+最优+能跑完"**。原大表路线(coupled phase-1 PDB)**不再需要**(测量证明 TT+够大记忆本即可,省了 15GB 级高风险投入)。commit 待 chunk6 端到端确认后。

### EPIC B — 接统计管道(A 达标后)
- [x] **B1 精确步数进管道(2026-06-17 wiring 完;首轮灌注卡死已杀,待用修复后 analyzer 重启)**:`sq1_analyzer SQ1_WCA_EXACT=1 [+SQ1_WCA_SOLN=1]` 出 `id,wca_exact,opt_scramble`。`build_puzzle_dist.ts` 的 `aggregateExactSq1` 产 `sq1.exact.dist`(WCA 可证最优)+`.alt`(slash=数 opt_scramble 的 `/`);`PuzzleDistView.tsx` 加「求解:精确/近最优」开关(默认精确)+ 进度徽标。
  ⚠️**首轮(无 TT)在 chunk 6 的 217111 上卡死 11.7h** → 杀掉,做 A4(TT)。**重启前提**:用 A4 修复后重建的 `sq1_analyzer.exe`(已重建)。已落 chunk 0-5(3000 条)+ chunk6 重验中;重启 `inject_sq1_wca_exact.ps1` 会自动 Ingest 已完成块 + 跳过已解,续跑剩余。
  ⚠️**坑①**:注入主 CSV 只在进程启停各 ingest 一次,**长跑中冻结**,build 必须读 `sq1/_exact_chunks/*`(已做)。⚠️**坑②**:analyzer **整块缓冲、不到 ChunkSize 不落盘** ⇒ 中途杀进程**丢整块在算的**(已解的别的块不丢)。⚠️**坑③(待办)**:inject/analyzer **无 per-scramble 超时 + 无 hang 监控** ⇒ 重启时必须挂进度监控(见 §1 B1-monitor)。详见 memory [[project_sq1_wca_optimal_solver]] + skill `update-scramble-stats`。
- [ ] **B1-monitor 进度 + 防卡监控(重启灌注前必挂)**:防"盲跑 8 天才发现白跑"。① 进度 = `(主CSV 行 + ∑_exact_chunks/*_sq1.csv 行) / 125605`;② 死亡/hang 告警:进程退出即报、或 >60min 无新块即报(正常一块含怪物 ~15min,>60min=真异常)。重启时用后台 Monitor 挂着。
- [ ] **⏳ B1-cleanup(run 完后做)**:全量灌注 100% + **16 空隙复证**(见下)后,**重新评估近最优档**:它直方图角色冗余(系统偏高 ~2.6 步、甚至略输 TNoodle),用户(2026-06-17)倾向**删或降级成「对照(近最优)」**。删的前提:先给精确档补一套示例(现示例按近最优分桶,删近最优会丢示例 + 「原始/最优打乱」切换)。**勿删 `sq1_twophase.rs` 代码本身**(§0.10),这里只说前端档位。
- [ ] **⚠️🔬 B1-verify 16 空隙**:精确 WCA 分布有孤立空隙 `wca=16`(实际解长度也从不为 16),已排除 wiring bug + id 偏倚。需跑 Rust oracle 独立复证是真实壳层空隙还是求解器在该值漏最优 —— 但会与 13GB 注入 job 抢内存(禁并跑),故 deferred 到 run 完或暂停注入时验。上线为公众前必证。
- [ ] **B2 最优打乱**:`solve_with_solution` 已能出 token 序列;analyzer 已产 `opt_scramble` 列(`SQ1_WCA_SOLN=1`,序列化 `x:y/` 逗号安全)。剩:精确档示例面板用它(接 B1-cleanup)。门:序列 replay 回 SOLVED + 步数 = 列值。

### EPIC C — UI / 数学页(A 达标后)
- [ ] **C1 `/math/god?event=sq1`**:把 `D_WCA = ?` 改 `13 ≤ D_WCA ≤ 27`(可证)+ 样本经验下界 + 精确分布图。
- [ ] **C2 `/scramble/solver?event=sq1`**:加"精确/近最优"开关(WASM 走精确仅当够快;否则服务端端点,照 3x3 cloud daemon 模式)。**保留**现有近最优求解器对照(§0.10)。

### EPIC D — 算出 D_WCA(终极目标)⛔ GATE
- [ ] **D0 ⛔ GATE**:`D_WCA` 精确值是多日级大计算,两条路线(笔记 §6 路线 A targeted / 路线 B full coset-BFS)。**启动前必停,让用户拍板路线 + 资源**。
  - 路线 A(便宜):只在 twist=13 的 157M antipode 上跑 WCA-optimal 取 max(笔记 §3.3)。瓶颈=antipode 枚举(需 twist BFS 落盘 4.36e11 或找结构刻画)。
  - 路线 B(稳但贵):WCA = uniform-cost ⇒ 纯 BFS,按 3678 shape-coset 切,盘吞吐瓶颈(规模同 Chen 2017 face-turn ~772GB)。

---

## §2 进度日志(LOG)

> 每完成一个单元追加一行:日期 + 单元 + commit 短 hash + 一句话。

- 2026-06-16 尝试 C(大表)落地(未走本 loop,是 loop 创建前的手工推进):全 8 角/8 棱 PDB 各 283MB + 并行 builder + 小表并行化;h mean 14.82→15.59 max 18→20;中位秒级、深态仍 >5min。详见笔记 §5 尝试 C。**本 loop 文件创建。下一步从 A0 起。**
- 2026-06-16 **A0 提交基线**(48a1c7e13):Sq1WcaSolver(+1047 行)+ analyzer SQ1_WCA_EXACT 提交;3 测绿(`wca_matches_oracle` 5568 态 / `wca_tables_baseline` / `pdb_par_matches_serial`,56s)。下一步 A1。
- 2026-06-16 **A2 诊断**(先于 A1,见 §3 重排理由):加 bounded profiler,profile 5 真深态;定论瓶颈 = 弱 h + phase-2 现搜时间槽,**杠杆 = A3 联合精确 phase-2 表**。native 测过、wasm lib check 过。下一步 A1(为 A3 铺内存安全 builder)。
- 2026-06-16 **A1 内存安全 builder**(313ed1e28):`build_pdb_idx_par`(u32 frontier + `unrank8`/`unrank_pdb`),corn/edge 切过去;round-trip + byte-diff(两表逐字节同旧表)双门绿,峰值 WS 3.6GB→1.24GB。下一步 A3(联合精确 phase-2 表)。
- 2026-06-16 **A3 jsq 联合 phase-2 表(半成)**(9d2e7c4ed):角×棱联合 3.25GB 表替 sq_h_wca,scan-based 建(8 线程 ~65min,峰值仅表本身 + 原地转换免 2×)。正确性全绿(可采纳/支配性 + oracle 5568 逐字节 + 最优性保持)。效果 777 >5min→35.6s、775 1.3s,但 774/776/778 仍 >90s。profile 定论:jsq 是更强剪枝但没消灭 phase-2 时间槽(776/778)、碰不到 phase-1 爆炸(774/777)。**<30s-all 待 A3-full + A4,§3 取舍等用户。** 另:用户改线程 14→8(全局 CLAUDE.md + §0.4)。
- 2026-06-16 **A3-full 精确 phase-2 表收尾**(aa93699b7 码 + 本轮建表+实测;线程 8→12):13GB `jsq_full`(补 per-layer shape 位的精确双射)建成(`build_jsq_full_only`,12 线程 ~52min,scan-based + 原地转换,无 OOM)⇒ phase-2 变 O(1) 精确查表 + 梯度重建(无搜索)。门全绿:`wca_a3_jsqfull_exact`(3104 态 == 独立精确)+ oracle 5568 + `wca_a3_deep_timing` **5 真深态零超时**(774=22@6.7s 775=19@0.26s 776=22@37.86s 777=20@0.52s 778=22@5.0s)。**意外:精确 h 顺带杀了 phase-1 爆炸(774/777 秒级)**,推翻 jsq-lite 悲观外推。残留 776@37.86s 纯 phase-1 → A4(soft-gate)。**EPIC A 达标,下一步 EPIC B(精确步数进管道)。**

---

## §3 决策 / GATE / 交接(DECISIONS)

- (空)首次跑 loop 从 A0 开始;A4、D0 是 gate,到那再停问用户。
- **欠账(A0)**:`wca_bracket_replay_and_near_opt_cross` 测含 81 条真实 12-step 打乱的精确求解,单条深态 >5min ⇒ 全测会 hang(用户明确要求测试只跑个位数、防死循环)。该测当前**未在 loop 跑过**;A3 加厚 phase-2 后,深态够快了再恢复跑它当回归。在那之前验深态只抽 ≤5 条且带超时。
- **重排决策(2026-06-16):A2 先于 A1 做**。理由:(1) 笔记 §6.6 自己的工程指引是「先 profile 再动、别盲目加表」,A2 正是该 profiling,且 A1 仅是 A3 大表的内存前置 —— 先验证大表路线值不值得;(2) A1 是字节精确、shape-aware 的 unrank 重构(多小时、易错),A2 是 bounded 安全诊断,符合用户「测小、防死循环」。重排在 EPIC A 内、可逆、A1 不跳过。**A2 已完成并证实大表(A3)是正确杠杆 ⇒ A1→A3 顺序继续。**
- **A1 ✅ 已完成(313ed1e28)**:`build_pdb_idx_par`(u32 frontier + `unrank8`/`unrank_pdb`)。关键省事发现:`base.shapes[sid] = (pt<<12)|pb` 本身就是 shape 逆映射,免建逆表;rank8 逆 = 阶乘进制 unrank8;filler 角填 id 1(奇,占 2 槽)、棱填 id 0(偶)。两门绿(全域 round-trip + byte-diff 旧表),峰值 1.24GB。**(历史教训保留)曾试 fork 跑 A1 失败**(fork 继承编排上下文、错把自己当 orchestrator 空转 ⇒ 别用 fork 跑独立 worker;自己 inline 或 fresh general-purpose agent 给自包含 prompt)。
- **A3 设计提示(交接给下一轮)**:A1 的 index-frontier 技术 + `unrank8` 直接可复用,但 **A3 表是方形子群联合(角 perm × 棱 perm × ml,8!·8!·2≈3.25e9),不是全空间** ⇒ 需(a)新 idx:`(rank8(角) * 40320 + rank8(棱)) * 2 + ml`(无 shape,全方形);(b)新 unrank:两个 rank8 逆摆进**方形 tiling**(SQ_PAT_A/B),无 shape 维;(c)BFS 边 = **方形保形旋转 + 方形→方形 slash**(复用 `derive_sq_actions` 的 sig/tau/rhoc/rhoe,但 WCA 旋转 cost 1,参照现 `build_sq_wca`),**不是** `build_pdb_idx_par` 的全 move 集。内存:dist 3.25GB + u32 frontier(方形子群最大层估 ~1-2GB)⇒ 峰值 ~6-8GB,先按 §0.4 查内存。phase-2 接法:方形态一次查联合表到精确(替 `p2_dfs_wca` 现搜),phase-1 首个方形态即收尾。门:正确性(§0.5,memo 键用精确态)+ 深态 774-779 实测 <30s/条 + 不 OOM。
  - **A3 落地后修正(实测打脸交接预期)**:scan-based 比 index-frontier 更省内存(峰值仅 3.25GB),已用它建成。但**(cp,ep,ml) 投影只精确到 solved 陪集(忘了每层 A/B shape 偏移)⇒ 纯查表做不到精确 phase-2**,故 A3 落地为「更强可采纳启发」而非「精确查表替搜索」。结果:jsq 没消灭 phase-2 时间槽(见下「⛔ 取舍」)。

- **⛔ 取舍(2026-06-16,A3 jsq 半成后,等用户拍板)**:jsq 验证正确+有效但没达「全深态 <30s」。profile(5 真深态,jsq 已载):

  | id | 模式 | 关键数 | 谁能救 |
  |----|------|--------|--------|
  | 775 | 易 | SOLVED=19 @1.3s | 已够快 |
  | 777 | phase-1 爆炸 | ~23µs/节点,bound18=258K;最优20 @35.6s | A4(更强 phase-1 h) |
  | 774 | phase-1 爆炸 | ~23µs/节点 ×9/bound,最优~22 需~20min | A4 |
  | 776 | **phase-2 时间槽** | 9.7K 节点却 7.3s = **753µs/节点** | **A3-full**(精确查表替搜索) |
  | 778 | **phase-2 时间槽** | 32K 节点 15s = **461µs/节点** | **A3-full** |

  根因:jsq 只是更强**剪枝启发**,phase-2 仍是 `p2_dfs_wca` 搜索(分支~145);phase-1 用 `h_le_wca`(jsq 不参与)。**三条路,等用户选**:
  1. **接受部分最优(推荐)**:中位秒级,深尾少数 timeout→near-opt 兜底(标注),§6.6#4 本就预案。直接解锁 EPIC B(管道)+ C(UI);D_WCA 经验下界只需样本 max(慢的少数单独长跑)。**零额外表、零风险。**
  2. **A3-full(13GB 精确 phase-2)**:加 per-layer shape 位(4 combo × 8!×8!×2)⇒ phase-2 变 O(1) 精确查表(无搜索)⇒ 杀 776/778。但 **(a) 碰不到 phase-1 爆炸(774/777 仍慢)**;(b) 13GB 建表需 ~15GB 空闲(当前仅 5.5GB,得先腾内存);(c) 单独不达 <30s-all。
  3. **A4(更强 phase-1 PDB)**:压 774/777 的 phase-1 爆炸。soft-gate(≤15GB 投入需点头),且尝试 C 警告强耦合 puzzle 的 max-PDB 收益存疑、候选「角+棱归层 mask」~21GB 超预算。**先在样本估收益再建。**
  - 达「全深态 <30s」需 **2+3 一起**(~28-34GB 表 + 数小时建表 + A4 收益不确定)。判断:为最后几 % 最难态投这么多,性价比低 ⇒ 倾向路 1。
  - **用户选了路 2(A3-full,2026-06-16)**。代码已落地+提交(`aa93699b7`):精确态索引(补 shape 位的双射)+ `build_jsq_full`(scan-based,真实方形 move)+ phase-2 改 O(1) 查表 + `p2_reconstruct` 梯度重建(无搜索)+ jsq_full 在位免载 jsq。**廉价门全绿**:`full_idx_unrank_roundtrip`(2M 采样 + 3104 BFS 态双射)、scan 驱动、配对、wasm32(JSQ_FULL_SIZE cfg-gate native:13e9 超 wasm 32-bit usize)。**安全:jsq_full.bin 不存在时零行为变化(优雅回退),故未验证也不影响现求解。** ✅ **已收尾(2026-06-16,用户腾内存到 ~17GB 后)**:`build_jsq_full_only` 12 线程 ~52min 建成 13GB 表(无 OOM);`wca_a3_jsqfull_exact`(3104 态 == 独立精确)+ oracle + `wca_a3_deep_timing`(5 真深态零超时,最慢 776@37.86s)全过。**结果超预期**:不只杀 phase-2 时间槽(776/778),精确 h 还顺带驯服 phase-1 爆炸(774/777 从估 >5min→6.7s/0.52s),推翻路 2「碰不到 phase-1」的预判。**EPIC A 达标**(残留 776@37.86s 纯 phase-1,留 A4 按需)。⚠️ 部署注意:驻留 13GB 对服务器太重,EPIC C 的 `/scramble/solver` 须走云 daemon / 部分最优(路 1),不能浏览器/服务器常驻这张表。

---

## §4 快速参考(命令 / 文件 / 已验证事实)

**文件**:求解器 `solver/src/sq1_solver.rs`(`Sq1WcaSolver`);analyzer `solver/src/bin/sq1_analyzer.rs`;笔记 `solver/SQ1_WCA_GODS_NUMBER.md`;度量定义 `core/packages/client/lib/sq1-metrics.ts`;近最优(勿删)`sq1_twophase.rs`。

**建大表**(一次性,盘缓存到 `solver/tables/`,gitignored):
```bash
cd solver
echo '1,(1,0)/' > /d/cube/cuberoot.me/core/.tmp/sq1_wca/triv.txt
printf 'D:/cube/cuberoot.me/core/.tmp/sq1_wca/triv.txt\nexit\n' | \
  CUBE_TABLE_DIR=D:/cube/cuberoot.me/solver/tables SQ1_BUILD_PDB=1 SQ1_WCA_EXACT=1 \
  RAYON_NUM_THREADS=14 ./target/release/sq1_analyzer.exe
```
**精确求解**(表已缓存则自动加载;无 `SQ1_BUILD_PDB` 缺表则回退 5 表):
```bash
# 输入文件每行 `id,(x,y)/ (x,y)/ ...`;输出 <basename>_sq1.csv 两列 id,wca_exact
printf 'INPUT.txt\nexit\n' | CUBE_TABLE_DIR=D:/cube/cuberoot.me/solver/tables \
  SQ1_WCA_EXACT=1 RAYON_NUM_THREADS=14 ./target/release/sq1_analyzer.exe
```
**测试**:`CUBE_TABLE_DIR=...\tables cargo test --release --lib <name> -- --nocapture`(`wca_bigtable_report` 出 h 分布;`pdb_par_matches_serial` 锁并行正确性)。⚠ 别用 `| grep` 吞掉 cargo 的 "Blocking waiting for file lock"(笔记 §7)。

**已验证事实**(交叉验证锚点):`(1,0)/`→2、`(0,-1)/`→2、`/`→1、`//`→0(对独立双向 BFS);现 7 表 h: mean 15.59 max 20;可证 `13 ≤ D_WCA ≤ 27`。
