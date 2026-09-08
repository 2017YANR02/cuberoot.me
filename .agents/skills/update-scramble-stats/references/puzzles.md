## B. 非 3x3 整解步数(`update_puzzle_stats.ps1`)

二阶 / 金字塔 / 斜转 / SQ1 的整解步数分布 + 示例。前三个全表查表型精确最优(小表,百万/秒),全量分钟级;**SQ1 = 精确双口径(WCA 12c4 可证最优 + slash 最优,均 0 残留全部可证最优),增量已自动接进一条龙**(需本机 13GB `sq1_wca_jsqfull.bin`;详见末条)。

```pwsh
# 全部已注册 puzzle(增量补满,含 sq1)
pwsh core/jobs/scramble-stats-build/update_puzzle_stats.ps1 -Puzzles pocket,pyraminx,skewb,sq1

# 再产示例 reservoir(每步数 bin 取 20 条真实比赛打乱 + 比赛名/轮次)
cd core/jobs/scramble-stats-build; pnpm exec tsx src/build_puzzle_examples.ts
```

- 语料自动从三阶管道抽好的 `incremental/tsv/Scrambles.tsv` 按 event_id 过滤(`222`/`pyram`/`skewb`/`sq1`),增量落 `D:\cube\scramble\puzzle\<key>\`。`-MaxNew N` 限量验形,`-BuildOnly` 只重算 JSON。
- 产 `stats/scramble/puzzle_distribution.json`(直方图)+ `puzzle_examples.json`(示例卡片)。前端 `/scramble/stats` 难度 tab 选中二阶/金字塔/斜转/SQ1 即显示(`PUZZLE_EVENT_MAP` → `PuzzleDistView`)。
- **2×2 / 金字塔「按步数」多口径(2026-07-12)**:2×2 有 底面/底层/魔方/QTM(face/layer/htm/qtm)、金字塔有 V/魔方(v/cube)四/二个度量,`PuzzleDistView` 顶部「度量」下拉切换(选项/标签复用计时器的 `step-metrics.ts`,单一源)。值由 **`core/packages/client/scripts/build_puzzle_metrics.mts`**(client 端,复用计时器求解器 `lib/cube222-metric` + `timer/_lib/solver/pyra`,不重造)预算进 `D:\cube\scramble\puzzle\<key>\<key>_metrics.csv`;`update_puzzle_stats.ps1` 步骤 2.9 **增量**跑它(只算 scrambles.txt 里新打乱),`build_puzzle_dist.ts` / `build_puzzle_examples.ts` 读该 CSV 产 `metrics.<key>.dist` / `metrics.<key>.bins`。同一份预计算**同时喂计时器 `/timer` 的「按步数」WCA 真题筛选**(`wca_pool.ts` 从 `puzzle_examples.json` 的稀有桶播种 → 稀有区间如底层=0 即时+可靠)。
  - 性能:2×2 走 `create222MetricEvaluator`(全 3.67M 态 BFS 距离表一次 ~10s,之后每条 O(1) 查表),44 万全量 ~1min、增量秒级,单进程无需分片;金字塔逐条求解(~1000/s),增量 delta 秒级。
  - 一键入口:`update_cross_stats.ps1 -Jobs puzzles`(= update_puzzle_stats.ps1[含 2.9 metrics + 3 dist] → build_puzzle_examples → first_appearance → export_puzzle_optimal)。
  - 改 dist/examples shape 须 bump `lib/puzzle-{distribution,examples}.ts` 的 `V`(已 `20260712bysteps`)。
- **SQ1 近最优(twophase)2026-06-18 退役**:精确档上线后 `update_puzzle_stats.ps1` 不再解算 sq1(已移出 `$PUZZLE` 注册表,改走专门「SQ1 块」)。`solver/src/sq1_twophase.rs` 仅留作对照(cstimer-vs-TNoodle 上游说明在该模块头)。示例打乱仍用 SQ1 简写记号(`formatScrambleForEvent('sq1',scr)`)。
- **SQ1 精确双口径 = 增量自动接进一条龙(2026-06-18)**:`update_puzzle_stats.ps1` 的「SQ1 块」(sq1 不在 `$PUZZLE` 注册表,单独处理)增量抽 sq1 语料 → **有新打乱且 13GB `sq1_wca_jsqfull.bin` 在场**时,依次跑 `inject_sq1_wca_exact.ps1`(WCA 12c4 可证最优,`Sq1WcaSolver`,产 `sq1/sq1_wca_exact.csv` = `id,wca_exact,opt_scramble`)+ `inject_sq1_slash_exact.ps1`(slash 最优),两脚本都按 id 跳过已完成只解 delta。无新打乱→跳过不白载表;表缺失→`Write-Warning` 跳过(分布留旧值)。⇒ **`update_cross_stats.ps1 -Jobs puzzles`(或 all)现已自动刷新 SQ1 精确双口径并发布**。
  - **slash 最优口径**:`inject_sq1_slash_exact.ps1` 由 `sq1_wca_exact.csv` 算 slash 最优 `t`(twist 口径,God 13)。**省算:W=2s 或 2s+1 ⇒ t=s 已证明(95.71%),只 W=2s−1 歧义(4.29%,5,392 条深态)需判定**。判定走 **slash-via-wca 归约**(analyzer `SQ1_SLASH_VIA_WCA=1`,`Sq1WcaSolver::shared_lite` ~600MB,不需 13GB 表):**5,392 条全部判定 t=s(5,382 via-wca 穷尽 + 10 条最深 s=12/13 由 MITM `decide_t` 双向 BFS 判定,2026-06-19),0 残留,全程 0 条 t=s−1**(`sq1_slash_meta.json`:`provisional:false,fallback:0,eq:5392`,前端数据驱动)。产 `sq1/sq1_slash_exact.csv`(`id,slash_exact,opt_scramble`)+ `sq1_slash_meta.json`。`puzzle_distribution.json` 的 `sq1.alt` = 此(紧上界)slash 分布,数字 = `wcaOptSlash`(零反例 + 省算双重支撑,**不随残留变**);`binsAlt` = slash 值 + 等价打乱。前端 `PuzzleDistView` 计步 **WCA / slash 最优** 切换。**0 残留由 MITM `decide_t`(`solver/src/bin/sq1_slash_mitm.rs`,radius-⌊s/2⌋ 双向 BFS 判 t∈{s−1,s})达成,且已接进 inject 自动兜底**(`Run-DecideT`:via-wca 超时的残留 M 怪物自动逐条 decide_t 判 t=s,Tier1「无待解」路径也跑、`-NoMitm` 关)⇒ **以后「更新统计」遇深态怪物自维持 0 残留,provisional 不翻回 true**(需 `sq1_slash_mitm.exe` 在场,`cargo build --release` 默认带)。松下界剪枝(尝试 A)OOM 判死、别重试。saga/方法/失败史见 `solver/SQ1_SLASH_OPTIMAL.md` §6 + memory [[project_sq1_slash_optimal]]。
  - **全量历史 backfill 是一次性的**(WCA-exact ~8.8 天已完成 125,605 条;slash 歧义 ~3h 单独后台,完成后只剩增量)。⚠️ **勿与增量 / grind 并跑**(两个 13GB 表 = OOM)。
  - ⚠️ **进度藏在 chunk**:全量 backfill 把所有块喂给一个长跑 analyzer,主 CSV 只在进程启动/结束各 ingest 一次 → 长跑期间主 CSV 停在初始行数,完成的块堆在 `sq1/_{exact,slash}_chunks/`。`build_puzzle_dist.ts` 额外读这些块(只读不删),按 id 去重 → 每跑一次 build 反映真实进度。**手动 ingest 块**:`pwsh inject_sq1_wca_exact.ps1 -BuildOnly`。
  - **精确档示例已建(2026-06-18)**:`build_puzzle_examples.ts` 的 `bucketExactSq1`(读 `sq1_wca_exact.csv` + `_exact_chunks/*_sq1.csv`,按 wca_exact / opt 的 slash 数双分桶)→ `puzzle_examples.json` 的 `exactBins`/`exactBinsAlt`,点柱子看该步数真实比赛打乱;**只产精确档示例、不产 near 档**(用户要求)。opt_scramble = **SQ1 简写记号**(`tb/tb/`,CSV 安全,前端 `compactSq1Alg` 原样渲染)。改 shape 须 bump `lib/puzzle-examples.ts` 的 `V`。
  - ⚠️ **怪物行(id,M)**:全量灌注对单条 >60s 的深尾(actual 24-25)**超时跳过**,记 `id,M`(原始打乱回捞进 `sq1/sq1_wca_monsters.csv`,留后续大 `SQ1_TT_BUDGET` 单独跑;仍可证最优只是延后)。build 侧 `Number('M')`=NaN **自动略过、不进 seen**(以后单独跑出真值仍计入)⇒ 精确分布**最右尾(25-27)在怪物全部单独跑完前会偏少**,属已知部分态(同「进行中 N%」徽标一并诚实展示)。env `SQ1_SOLVE_TIMEOUT_SECS`(inject 设 60)/ 看门狗安全网 `ANALYZER_STUCK_SECS`(120)。详见 memory [[project_sq1_wca_optimal_solver]]。
  - **WCA 怪物三层**(2026-06-18):① 大部分 = `inject_sq1_wca_exact.ps1` 带超时正常解;② 批量啃 = `grind_sq1_monsters.ps1`(默认 4 线程/10min·条);③ 单条死磕 = `grind ... -Threads 1` / `-Split 2`(吃满全核, 数十分钟·条)。**① + ② 已自动接进一条龙**:`update_puzzle_stats.ps1` 的「SQ1 块」inject 后若出现新 `id,M` 怪物(历史积压已清零=0),自动 gated 跑 ② 批量啃(10min cap, 不会挂死), 啃完才让 slash 重判歧义; ② 没啃下的硬尾留 `id,M` 并**告警提示手动 ③**。
  - **「跑SQ1怪物」= 手动 ③ 死磕**(用户说"跑SQ1怪物 / 啃怪物"时执行, 用于 ② 没啃下的 brutal 尾或大积压):`grind_sq1_monsters.ps1` 拿 `sq1_wca_monsters.csv`、把 `sq1_wca_exact.csv` 的 `id,M` 行**原地替换**成真值。
    ```pwsh
    pwsh core/jobs/scramble-stats-build/grind_sq1_monsters.ps1                 # 默认 4 线程/240M TT/关超时,一次啃完
    pwsh core/jobs/scramble-stats-build/grind_sq1_monsters.ps1 -Threads 1      # 最硬的尾巴:单线程独占全部 TT
    ```
    - **为什么一定能最优**:IDA* 完备+可采纳,TT 满了只少剪枝不出错 ⇒ 给够时间必收敛。怪物是速度问题非正确性问题。
    - **关键约束**:① **严禁与主 inject run 并跑**(两个 13GB 表 = OOM;脚本检测到 `sq1_analyzer` 在跑会拒绝)⇒ 先等主 run 完;② RAM 上限 13GB 表 + TT + OS < 32GB ⇒ TtBudget ≲300M(默认 240M 安全);③ **少线程比大 TT 更治硬态**(TT 全局共享,线程少 ⇒ 每条独占更多,复刻 217111 单线程 125M 成功的条件)。
    - 可续(启动先合并上轮残留 + 跳已解);实时 `Get-Content sq1/_monster_progress.log -Wait -Tail 20`;>30min 单条报 `[STUCK]`(真·brutal,需 Tier 2:紧凑 open-addressing TT 2-3× / 更大耦合 PDB 抬 h)。报本轮**最深 WCA**(= D_WCA 经验下界候选)。
    - **啃完后必跑** `update_cross_stats.ps1 -Jobs puzzles -Puzzles sq1` 重建+发布(把真值搬上线,最右尾补齐)。
  - **发布**:`update_cross_stats.ps1 -Jobs puzzles`(或 all)跑完即一并 scp(build 带上当前已完成的精确块 + 怪物略过)。改 exact dist shape 须 bump `lib/puzzle-distribution.ts` / `lib/puzzle-examples.ts` 的 `V`。
  - **SQ1 复形(cubeshape)= 自动随 puzzles 作业产(2026-06-26)**:`build_puzzle_dist.ts` / `build_puzzle_examples.ts` 对 sq1 额外算「到 cube shape(顶底两层 square)最少 slash 数」(0..7,God 7,中层不计;`src/sq1_cubeshape.ts` 170 态 BFS 查表,从 `sq1/scrambles.txt` 即时算、**不依赖 13GB 整解 solver**)→ `puzzle_distribution.json` 的 `sq1.cubeshape` + `puzzle_examples.json` 的 `binsCubeshape`。前端 `PuzzleDistView` 顶部「目标:完整魔方 / 复形」下拉切换(复形时隐藏 WCA/slash 度量钮)。**无新管道步骤**,跟 sq1 整解口径同走 puzzles 作业;改 shape 须 bump `lib/puzzle-{distribution,examples}.ts` 的 `V`。
- **想更准**(deferred):双阶段迭代总长 / 更紧剪枝可逼近最优,代价回到长尾;见 `solver/SOLVER_LOOP.md` P5d。
- **发布**:走一条龙共享发布(`update_cross_stats.ps1 -Jobs puzzles` 跑完即一并 scp);单独手跑这两步则需手 scp。改 shape 须 bump `lib/puzzle-distribution.ts` / `lib/puzzle-examples.ts` 的 `V`。
- 加新 puzzle(如 SQ1)的全链路范式:`solver/VARIANT_PLAYBOOK.md` §8。

---

