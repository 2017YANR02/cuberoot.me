---
name: update-scramble-stats
description: "用户要更新 /scramble/stats(打乱难度 / 步数分布)的数据时执行本地手动增量刷新管道(按需触发,非定时)。覆盖三阶阶段难度(十字/F2L/EO/DR 等)+ 非 3x3 整解最优步数(二阶/金字塔/斜转/SQ1)+ 三阶整解最优 HTM(333 方法,cubeopt WASM,solver/333opt)三条管道。只能本地跑(三阶需 solver 34GB 表 / 333 需 cubeopt 表)。Triggers: \"更新统计\", \"更新打乱统计\", \"重跑打乱统计\", \"更新打乱分布\", \"更新打乱难度\", \"update scramble stats\", \"全部刷新统计\", \"更新十字统计\", \"重跑十字统计\", \"跑十字管道\", \"更新 puzzle 统计\", \"更新二阶/金字塔/斜转统计\", \"更新 sq1 统计\", \"更新 SQ1 统计\", \"更新 sq1 分布\", \"刷新 sq1 精确分布\", \"sq1 精确分布\", \"sq1 精确档\", \"跑SQ1怪物\", \"跑 sq1 怪物\", \"啃怪物\", \"啃 sq1 怪物\", \"sq1 怪物\", \"grind sq1 monsters\", \"补 xcross 变体\", \"双色底 10f xcross\", \"backfill_xcross_variant\", \"pseudo_f2leo 回填\", \"难打乱补变体\", \"更新333统计\", \"更新 333 统计\", \"更新 333 整解统计\", \"333 整解最优\", \"333 HTM 分布\", \"333opt\"."
---

# 更新打乱统计

**一条龙:一个命令 `update_cross_stats.ps1`,`-Jobs` 选作业,跑完共享一次发布**(commit+push + scp 换 static,覆盖三类产物)。三类作业都只能本地(stages 需 solver 34GB 表 / 333opt 需 cubeopt 表):

> **发布是增量的(2026-06-15)**:不跑 stages 的小作业(`333opt`/`puzzles` 只重写几个 tracked JSON)只 scp 变化的文件(`.tmp` + 远端原子 `mv`),**秒级**;只有 `stages`(comp_steps/下载包等 gitignored 文件会增删)才走整目录打包 `tar -czf` ~467MB → 原子换(~35min)。判据是 `-not $runStages` 时 `git status stats/scramble` 即完整变更集。

| job | 对象 | 内部 | 产物 |
|-----|------|------|------|
| `stages` | 3x3 阶段难度(十字/F2L/EO/DR 多阶段多变体) | 内置(取数→std→变体补缺) | `distribution.json` + `wca_cross` + `comp_steps*` + `difficulty_first_appearance*`(时间线) |
| `333opt` | 3x3 整解最优 HTM(整个魔方最优解) | `node solver/333opt/inject.mjs` + `inject_first_appearance.mjs`(折 `out.*.csv`) | `distribution.json` + `examples.json` 的 `variants['333']` + `difficulty_first_appearance` 的 333 注入 |
| `puzzles` | 非3x3(二阶/金字塔/斜转/SQ1) | `update_puzzle_stats.ps1` + `build_puzzle_examples.ts` + `build_puzzle_first_appearance.ts` | `puzzle_distribution.json` + `puzzle_examples.json` + `puzzle_first_appearance.json`(时间线) |

```pwsh
pwsh core/packages/scramble-stats-build/update_cross_stats.ps1                 # = -Jobs all,全跑 + 发布
pwsh core/packages/scramble-stats-build/update_cross_stats.ps1 -Jobs 333opt    # 只跑某作业
pwsh core/packages/scramble-stats-build/update_cross_stats.ps1 -Jobs stages,puzzles   # 跑多个
pwsh core/packages/scramble-stats-build/update_cross_stats.ps1 -Jobs puzzles -Puzzles sq1   # 选 puzzle
pwsh core/packages/scramble-stats-build/update_cross_stats.ps1 -NoPublish      # 只本地不发布
```

**NL 映射**(AI 按用户话传 flag):"更新统计"=`-Jobs all`;"只跑333"=`-Jobs 333opt`;"跑 X/Y"=`-Jobs X,Y`;"不跑 X"=去掉 X 后的列表;"不跑 eo" 等**变体级**=`-Variants <去掉eo的列表>`(仅 stages 内,见 A)。

要点:
- **333opt 只做 inject**(折当前 `solver/333opt/out.*.csv`);那条 **~3.5 天全量求解仍是独立后台** `node solver/333opt/solve_loop.mjs`(按需续解,见 C),不在一条龙里。
- **stages 的 build 会覆写 distribution/examples 的 '333' 变体 → 脚本在 stages build 之后自动补 333 inject 还原**(不用再记得手跑;`willInject = run333opt 或 stages有变`)。
- 三类作业**共享发布**;`-NoPublish` 一起跳过。

**「原始 / 最优打乱」开关数据**(/scramble/stats 难度+长度 tab、/timer 真题):每条打乱可切「最优等价打乱」=invert(最优解),同状态最少步。
- **难度 tab puzzle**(222/pyram/skewb):analyzer 开 `PUZZLE_EMIT_SOLN=1` 多产 soln 列(`update_puzzle_stats.ps1` 已固定开);`build_puzzle_examples.ts` 反推存第 3 元 `[id,scr,opt]`。改 analyzer 要 `cargo build --release --bin {pocket,skewb,pyraminx}_analyzer`。
- **难度 tab 三阶**:333opt inject 已带(examples 第 4 元)。
- **长度 tab**(3x3 面转族 + 222/pyram/skewb):`build_length_opt.mjs`(一条龙 step 5c,增量)产 `event_length_examples_opt.json`(text→opt overlay);CI 日更的 base 不被覆盖。3x3 走 cube48opt5(972M 表),puzzle 走 analyzer。**首跑慢(~1284 个 3x3 解,opt5 ~40min);增量再跑很快**。
- **/timer 真题最优**:走 PG `wca_scramble_optimal`(非 static)。**一条龙自动灌库**(2026-06-14 起,不再手动 `\copy`):333opt job 在 inject 后跑 `solver/333opt/export_optimal.mjs` 产 `wca_optimal.csv`,puzzles job 跑 `export_puzzle_optimal.mjs` 产 `wca_optimal_puzzle.csv`,发布步 6b 自动 scp + 按 event_id 整批替换(`DELETE`+`\copy` in tx,幂等)上线;密码服务器端从 `/root/core-api/.env` 读(不入仓库脚本)。`-NoPublish` 一并跳过(只产 CSV 不灌)。前端 `OPTIMAL_EVENTS`(WcaSourceConfig)gate 开关显示;开关 ON 时 date 模式传 `optimal=1`(服务端只回有最优等态的真题)、comp 模式客户端过滤,**不再静默回退原打乱**(某项目覆盖率不足时该池空→回退随机生成)。sq1/魔表无(占位注明)。

**「首次出现时间线」数据**(/scramble/stats 难度+长度 tab 顶栏「图表 / 时间线」开关:每步数 / 长度第一次出现在哪场比赛,按 comp 开始日期升序、同日按 id):**全部走一条龙自动产,无需手动**。前端缺数据的组合显「数据生成中」提示(占位,后端照样跑)。
- **难度 stages**(十字 / F2L / EO / DR 多变体 × 六/四/双/单色):`build:first-appearance`(步骤 5,跟 distribution 一起)→ `difficulty_first_appearance.json`(顶层 wca 合并池)+ `difficulty_first_appearance_wca_<event>.json` per-event 分片(前端懒加载)。
- **难度 333 整解最优**:`solver/333opt/inject_first_appearance.mjs`(步骤 5b,跟 `inject.mjs` 同位)→ 注入 `difficulty_first_appearance.json` 的 `sets.wca.variants['333']`。**语义 = 当前已解子集(`out.*.csv`)内最早**,随 `solve_loop` 推进逼近真值,全量解完即真值。⚠️ stages build 会覆写该 FA 文件丢 333 变体 → 5b 自动重注入还原(同 `inject.mjs` 的 `willInject` 逻辑)。
- **难度 puzzle**(222 / 金字塔 / 斜转 / SQ1 整解步数):`build_puzzle_first_appearance.ts`(puzzles job,跟 `build_puzzle_examples` 同位)→ `puzzle_first_appearance.json`(sq1 含 slash 备口径 `binsAlt`,前端暂只展主口径 WCA 12c4)。
- **长度**(3x3 面转族 + 222/pyram/skewb):`build_scramble_lengths.ts` 产 `event_length_first_appearance.json` —— **CI 日更自带**(`stats.yml`,跟长度分布同管道),非本地 ps1。
- **前置**:比赛日期必须灌好,`incremental.py refresh_competitions` 读 WCA export 的 `year/month/day`+`end_*` 六列(非 `start_date`,2026-06-15 修;`competitions.tsv` 在 `D:/cube/scramble/wca_scramble/`)。日期空则时间线排序全乱。
- 改任一 FA 文件 shape 必须同步前端 `stats/page.tsx` 的 `Fa*Json` 类型 + memo;改 fetch 响应形 bump `?v=`。

**首页「近期打乱」数据(全自动, 跟一条龙)**:每跑 stages 或 puzzles 都会附带跑 `build:recent-scrambles-events`(ps1 步骤 E),产 `stats/scramble/recent_scrambles_events.json` —— 除 3x3 外所有项目的近期打乱(本次 export 新增, 靠单调 scramble-id watermark `incremental/recent_events_watermark.txt` 界定批次, 首次无 watermark 则取 export 日期前 30 天的比赛)。每项目按**打乱长度**分桶;222/金字塔/斜转额外按**难度**(整解最优步数, join puzzle CSV, 故须在 puzzles 之后)。3x3 本身仍走旧的 `recent_scrambles.json`(变体×类型×底色)。前端 `components/RecentScrambles.tsx` + `lib/recent-scrambles-events.ts`(改 shape 须同步 + bump V)。

下面 A/B/C 是各 job 的内部细节。

---

## A. 三阶阶段难度(`update_cross_stats.ps1`)

一键(脚本名留 `cross` 是历史:十字是主阶段,实跑全阶段):

```pwsh
pwsh core/packages/scramble-stats-build/update_cross_stats.ps1
```

下 results export → 增量挑新打乱 → std_analyzer 全 5 阶段 → 追加 std.csv → 默认再跟 std 锁步补全 6 变体 eo/pseudo/pseudo_pair/pair/f2leo/pseudo_f2leo(按 id 缺补,分块可续)→ 重算 distribution/wca_cross/comp_steps → git push + scp static。

- **交互向导**:真人终端裸跑(无参数)自动进向导,全程**方向键菜单**(↑↓ / Space 多选 / 数字字母快捷 / Enter / Esc)—— 取数前问「TSV 来源(下载官方最新 / 用本地缓存不联网)」,取数后列各变体待补 + 估时,多选「跑哪些变体」+ 单选「每变体几块 / 是否发布」,总览确认再跑;`-Interactive` 强制开,`-UseCached` 单独走不联网取数。AI/带任意 flag/非交互终端不弹,走旧一键。
- **长操作都有进度**:下载(每 5%)、解压大 TSV(每 128MB)、扫描(每 2M 行)、solver([PROG] 每 1%)、build(每 20 万行 `\r`)、scp(每 3s 远端字节)。
- 先 `-DryRun` 看新增规模(只读);落后多就大补、solver 跑几小时。
- **pair / f2leo / pseudo_f2leo 已入默认**(2026-06-09);增量只补 delta。瓶颈始终是 eo ~0.9/s。想快跑显式 `-Variants eo,pseudo,pseudo_pair` 跳过三重型项。
- f2leo/pseudo_f2leo 走大表快路径(`CUBE_ALLOW_HUGE_TABLES=1` 已默认;f2leo huge ~31/s、pseudo_f2leo huge ~81/s)。
- 想本地看不发布:`-NoPublish`。细节/开关/排错:`core/packages/scramble-stats-build/RUNBOOK.md`。

### 第二套数据集:xcross_2_col_10f(双色底 10f xcross)

`/scramble/stats` 三阶有**两个 set**(`config.yml`):`wca`(全 7 变体,走上面)+ `xcross_2_col_10f`(静态 1,271,727 条难打乱,数据在 `D:\cube\scramble\xcross_2_col_10f\stat\`,master=同目录 `scrambles.txt`)。后者**只缺 f2leo/pseudo_f2leo**,与 update_cross_stats **解耦**,走独立脚本:

```pwsh
pwsh core/packages/scramble-stats-build/backfill_xcross_variant.ps1 -Variant pseudo_f2leo -Hours 5 -Threads 10
```

- 限时(`-Hours`,到点 chunk 边界停 + 末块裁剪;省略=补满)/ 限线程 / 分块可续。两变体都要补:`-Variant pseudo_f2leo`(暖态 ~21/s,全集 ~17h)、`-Variant f2leo`(暖态 ~40/s,全集 ~8.8h,但 20GB pair huge 表冷启慢)。
- **只攒 csv,partial 千万别 build**(否则该变体 sample_count 残缺误导)。补满 1,271,727 后才 `pnpm -F @cuberoot/scramble-stats-build build` → 验 `distribution.json` `sets.xcross_2_col_10f.variants.pseudo_f2leo.sample_count==1271727` → push + tar/scp static。
- 进度:`D:\cube\scramble\xcross_2_col_10f\_backfill\backfill_<variant>.log`。详见 memory `project_xcross_2col_f2leo_backfill`。

---

## B. 非 3x3 整解步数(`update_puzzle_stats.ps1`)

二阶 / 金字塔 / 斜转 / SQ1 的整解步数分布 + 示例。前三个全表查表型精确最优(小表,百万/秒),全量分钟级;**SQ1 是近最优(双阶段上界)**(详见末条)。

```pwsh
# 全部已注册 puzzle(增量补满,含 sq1)
pwsh core/packages/scramble-stats-build/update_puzzle_stats.ps1 -Puzzles pocket,pyraminx,skewb,sq1

# 再产示例 reservoir(每步数 bin 取 20 条真实比赛打乱 + 比赛名/轮次)
cd core/packages/scramble-stats-build; pnpm exec tsx src/build_puzzle_examples.ts
```

- 语料自动从三阶管道抽好的 `incremental/tsv/Scrambles.tsv` 按 event_id 过滤(`222`/`pyram`/`skewb`/`sq1`),增量落 `D:\cube\scramble\puzzle\<key>\`。`-MaxNew N` 限量验形,`-BuildOnly` 只重算 JSON。
- 产 `stats/scramble/puzzle_distribution.json`(直方图)+ `puzzle_examples.json`(示例卡片)。前端 `/scramble/stats` 难度 tab 选中二阶/金字塔/斜转/SQ1 即显示(`PUZZLE_EVENT_MAP` → `PuzzleDistView`)。
- **SQ1 = 近最优 + WCA 12c4 计步(2026-06-12 上线)**:精确最优长尾爆炸(>500 态/6min 不收敛),改用 cstimer 双阶段(`solver/src/sq1_twophase.rs`,`sq1_analyzer.exe` 默认走它)。**默认 WCA 12c4 计步**((X,Y)=1 + /=1,`solve_wca`);`SQ1_METRIC=slash` 回 slash-only(jaapsch God 13);`SQ1_EXACT=1` 回精确(slash,慢)。全 125k ~50s,**WCA dist 11..30 峰 25**。近最优 gap(slash 口径)+0/52% +2/44% +4/4% 均 +1 真上界。前端口径行标「WCA 12c4 计步,近最优」;**示例打乱用简写记号**(`formatScrambleForEvent('sq1',scr)`)。exact ground-truth 存 `sq1_exact_groundtruth.csv`。清空 master 重灌须留表头(管道已修空文件边界)。
- **SQ1 精确档(WCA 12c4 可证最优)= 独立后台 + build 自动读**:`inject_sq1_wca_exact.ps1`(用 `Sq1WcaSolver` + 13GB `jsq_full` 表,可证最优,~0.16 解/s、全 125k ~8.8 天)是**独立长跑后台**,不进一条龙(类比 333opt 的 `solve_loop.mjs`)。产 `sq1/sq1_wca_exact.csv`(`id,wca_exact,opt_scramble`)。
  - ⚠️ **进度藏在 chunk**:该 job 把所有块喂给一个长跑 analyzer,主 CSV 只在进程启动/结束各 ingest 一次 → 长跑期间主 CSV 一直停在初始行数,完成的块堆在 `sq1/_exact_chunks/*_sq1.csv`。`build_puzzle_dist.ts` 已**额外读这些块**(只读不删,绝不碰运行中的 job),按 id 去重,故每跑一次 build 就反映真实进度。**手动 ingest 块**(可选,清理用):`pwsh inject_sq1_wca_exact.ps1 -BuildOnly`。
  - 产出进 `puzzle_distribution.json` 的 `sq1.exact`:`dist` = WCA 12c4 可证最优;`alt` = slash(从 `opt_scramble` 数 `/`,= WCA-最优解里的 slash 数,**slash-最优的紧上界 ≤13,非单独 slash-最优**)。前端难度 tab 加「求解:精确/近最优」开关(默认精确),两口径(WCA/slash)都切到精确。
  - **精确档示例已建(2026-06-18)**:`build_puzzle_examples.ts` 的 `bucketExactSq1`(读 `sq1_wca_exact.csv` + `_exact_chunks/*_sq1.csv`,按 wca_exact / opt 的 slash 数双分桶)→ `puzzle_examples.json` 的 `exactBins`/`exactBinsAlt`,点柱子看该步数真实比赛打乱;**只产精确档示例、不产 near 档**(用户要求)。opt_scramble = **SQ1 简写记号**(`tb/tb/`,CSV 安全,前端 `compactSq1Alg` 原样渲染)。改 shape 须 bump `lib/puzzle-examples.ts` 的 `V`。
  - ⚠️ **怪物行(id,M)**:全量灌注对单条 >60s 的深尾(actual 24-25)**超时跳过**,记 `id,M`(原始打乱回捞进 `sq1/sq1_wca_monsters.csv`,留后续大 `SQ1_TT_BUDGET` 单独跑;仍可证最优只是延后)。build 侧 `Number('M')`=NaN **自动略过、不进 seen**(以后单独跑出真值仍计入)⇒ 精确分布**最右尾(25-27)在怪物全部单独跑完前会偏少**,属已知部分态(同「进行中 N%」徽标一并诚实展示)。env `SQ1_SOLVE_TIMEOUT_SECS`(inject 设 60)/ 看门狗安全网 `ANALYZER_STUCK_SECS`(120)。详见 memory [[project_sq1_wca_optimal_solver]]。
  - **「跑SQ1怪物」= 啃怪物到最优**(用户说"跑SQ1怪物 / 啃怪物"时执行):`grind_sq1_monsters.ps1` 拿 `sq1_wca_monsters.csv`、**关超时**死磕到可证最优,把 `sq1_wca_exact.csv` 的 `id,M` 行**原地替换**成真值。
    ```pwsh
    pwsh core/packages/scramble-stats-build/grind_sq1_monsters.ps1                 # 默认 4 线程/240M TT/关超时,一次啃完
    pwsh core/packages/scramble-stats-build/grind_sq1_monsters.ps1 -Threads 1      # 最硬的尾巴:单线程独占全部 TT
    ```
    - **为什么一定能最优**:IDA* 完备+可采纳,TT 满了只少剪枝不出错 ⇒ 给够时间必收敛。怪物是速度问题非正确性问题。
    - **关键约束**:① **严禁与主 inject run 并跑**(两个 13GB 表 = OOM;脚本检测到 `sq1_analyzer` 在跑会拒绝)⇒ 先等主 run 完;② RAM 上限 13GB 表 + TT + OS < 32GB ⇒ TtBudget ≲300M(默认 240M 安全);③ **少线程比大 TT 更治硬态**(TT 全局共享,线程少 ⇒ 每条独占更多,复刻 217111 单线程 125M 成功的条件)。
    - 可续(启动先合并上轮残留 + 跳已解);实时 `Get-Content sq1/_monster_progress.log -Wait -Tail 20`;>30min 单条报 `[STUCK]`(真·brutal,需 Tier 2:紧凑 open-addressing TT 2-3× / 更大耦合 PDB 抬 h)。报本轮**最深 WCA**(= D_WCA 经验下界候选)。
    - **啃完后必跑** `update_cross_stats.ps1 -Jobs puzzles -Puzzles sq1` 重建+发布(把真值搬上线,最右尾补齐)。
  - **发布同近最优**:`update_cross_stats.ps1 -Jobs puzzles -Puzzles sq1` 跑完即一并 scp(build 会带上当前已完成的精确块 + 怪物略过)。改 exact dist shape 须 bump `lib/puzzle-distribution.ts` 的 `V`。
- **想更准**(deferred):双阶段迭代总长 / 更紧剪枝可逼近最优,代价回到长尾;见 `solver/SOLVER_LOOP.md` P5d。
- **发布**:走一条龙共享发布(`update_cross_stats.ps1 -Jobs puzzles` 跑完即一并 scp);单独手跑这两步则需手 scp。改 shape 须 bump `lib/puzzle-distribution.ts` / `lib/puzzle-examples.ts` 的 `V`。
- 加新 puzzle(如 SQ1)的全链路范式:`solver/VARIANT_PLAYBOOK.md` §8。

---

## C. 三阶整解最优 HTM(`solver/333opt/`)

整个 3x3 魔方的**最优解 HTM 步数分布** —— 前端难度 tab 的 **「333」方法**(`distribution.json` 的 `sets.wca.variants['333']`,阶段只 `333`,带 HTM/QTM 钮)。**完整 runbook 在 `solver/333opt/README.md`,跑前先读。**

```bash
# CWD = solver/333opt/ —— 默认即生产:opt9 15G + in-proc 12 线程 + 按 id 续跑,直接吃管道 A 的合并池 master
node solve_loop.mjs   # ★全量用这个★ 自动重启 wrapper(opt9 ~5000 解后必 unwind 崩,wrapper 续跑直到全量完)
                      #   读 wca_scrambles_no_wide_move.txt(1,297,444)→ out.0.csv (id,htm,solution)。裸 solve.mjs 仅调试
node inject.mjs       # 注入 distribution+examples 的 variant '333'(真实 WCA id + 比赛元数据)
node export_optimal.mjs --verify  # /timer 最优打乱数据 wca_optimal.csv(同态 333/oh/ft/fm),cubing 自验
```

- **不 pull**:语料 = 管道 A 的 master `D:\cube\scramble\wca_scramble\wca_scrambles_no_wide_move.txt`(跟 std_analyzer 同一份合并三阶池,盲拧/多盲的宽块定向已剥、mbf 已拆、带真实 id)。`pull.mjs`(MySQL 随机抽样)只作快速验形,生产别用。
- **续跑**:每解 `appendFileSync` 即落盘 `out.0.csv`,断了最多丢正在算的 1 个,重启自动跳过已解(只赔重载表 ~56s)。长跑 detached + BelowNormal 起,挂 Monitor 数 `out.0.csv` 行数 / 1297444 报进度。
- **unwind 崩溃**:opt9 in-proc ~5000 解后必抛 emscripten `unwind`(pthread 资源累积)。全量**必须** `solve_loop.mjs`(崩了自动重启续跑,零损失),别裸跑 `solve.mjs`。
- **解法 + 最优打乱 → /timer**:`debug=true` 抓最优解,`out.0.csv` = `id,htm,solution`。**最优打乱 = solution 逆序**(同态最短打乱)。`/timer` 真题「原始/最优打乱」二选已建好:migration `0047_wca_scramble_optimal`(自然键表)+ `routes/wca_scrambles.ts` LEFT JOIN 带 `o` + client `wcaUseOptimal` 开关(仅同态 333/oh/ft/fm)。**`update_cross_stats.ps1 -Jobs 333opt` 现已自动跑 `export_optimal.mjs` + 自动灌库**(步骤 5b+/6b,见上「原始/最优打乱」一节),不再手动 `\copy`(代码先部署安全,空表回退原打乱)。
- **实测**:opt9 in-proc 12 线程 ~4/s,全量 ~3.5 天。低 CPU + 高内存(15G 表全程驻留 RAM)是大表搜索常态,非卡死。表 64M 分块灌 heap 防 OOM;Node 能 spawn emscripten pthreads(旧说法错的)→ in-proc 多线程是真并行。`MODULE`/`TABLE`/`CORPUS`/`INPROC` 可覆盖(表 >4GB 自动 in-proc,≤4GB 走 fork)。
- **inject 示例带比赛名**:bin=`[真实id,scramble,'']`,并把这些 id 的比赛/轮次 merge 进 `examples.json` 的 `sets.wca.{comps,idMeta}`(源 `wca_scrambles_split_mbf.csv`+`competitions.tsv`,口径同 build.ts `buildExampleCompMeta`)。⚠️ 管道 A 重跑会覆写 examples.json 丢 '333' 变体 → A 之后补跑 `node inject.mjs`。
- **发布**:走一条龙共享发布(`update_cross_stats.ps1 -Jobs 333opt` 跑完即 commit+push + scp,且 stages 一跑会自动补 inject 还原 '333');单独手跑 `node inject.mjs` 则需手 scp。改 JSON shape 仍须 bump `stats/page.tsx` 的 `?v=`;前端改动要 commit+push 才在生产显示。
- **QTM 待做**:`counts_qtm` 暂空(前端 QTM 钮占位)。细节见 memory `project_333_optimal_difficulty`。
