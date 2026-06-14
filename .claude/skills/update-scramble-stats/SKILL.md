---
name: update-scramble-stats
description: "用户要更新 /scramble/stats(打乱难度 / 步数分布)的数据时执行本地手动增量刷新管道(按需触发,非定时)。覆盖三阶阶段难度(十字/F2L/EO/DR 等)+ 非 3x3 整解最优步数(二阶/金字塔/斜转/SQ1)+ 三阶整解最优 HTM(333 方法,cubeopt WASM,solver/333opt)三条管道。只能本地跑(三阶需 solver 34GB 表 / 333 需 cubeopt 表)。Triggers: \"更新统计\", \"更新打乱统计\", \"重跑打乱统计\", \"更新打乱分布\", \"更新打乱难度\", \"update scramble stats\", \"全部刷新统计\", \"更新十字统计\", \"重跑十字统计\", \"跑十字管道\", \"更新 puzzle 统计\", \"更新二阶/金字塔/斜转统计\", \"补 xcross 变体\", \"双色底 10f xcross\", \"backfill_xcross_variant\", \"pseudo_f2leo 回填\", \"难打乱补变体\", \"更新333统计\", \"更新 333 统计\", \"更新 333 整解统计\", \"333 整解最优\", \"333 HTM 分布\", \"333opt\"."
---

# 更新打乱统计

**一条龙:一个命令 `update_cross_stats.ps1`,`-Jobs` 选作业,跑完共享一次发布**(commit+push + tar 整个 `stats/scramble/` → scp 原子换 static,覆盖三类产物)。三类作业都只能本地(stages 需 solver 34GB 表 / 333opt 需 cubeopt 表):

| job | 对象 | 内部 | 产物 |
|-----|------|------|------|
| `stages` | 3x3 阶段难度(十字/F2L/EO/DR 多阶段多变体) | 内置(取数→std→变体补缺) | `distribution.json` + `wca_cross` + `comp_steps*` |
| `333opt` | 3x3 整解最优 HTM(整个魔方最优解) | `node solver/333opt/inject.mjs`(折 `out.*.csv`) | `distribution.json` + `examples.json` 的 `variants['333']` |
| `puzzles` | 非3x3(二阶/金字塔/斜转/SQ1) | `update_puzzle_stats.ps1` + `build_puzzle_examples.ts` | `puzzle_distribution.json` + `puzzle_examples.json` |

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
- **/timer 真题最优**:走 PG `wca_scramble_optimal`(非 static)。`export_puzzle_optimal.mjs`(puzzles job 内)产 `wca_optimal_puzzle.csv`,3x3 走 `solver/333opt/export_optimal.mjs`;**灌库手动 `\copy`**(脚本末尾打提示)。前端 `OPTIMAL_EVENTS`(WcaSourceConfig)gate 开关显示。sq1/魔表无(占位注明)。

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
- **解法 + 最优打乱 → /timer**:`debug=true` 抓最优解,`out.0.csv` = `id,htm,solution`。**最优打乱 = solution 逆序**(同态最短打乱)。`/timer` 真题「原始/最优打乱」二选已建好:migration `0047_wca_scramble_optimal`(自然键表)+ `routes/wca_scrambles.ts` LEFT JOIN 带 `o` + client `wcaUseOptimal` 开关(仅同态 333/oh/ft/fm)。求解完跑 `export_optimal.mjs` → `\copy wca_optimal.csv` 灌 prod 表即上线(代码先部署安全,空表回退原打乱)。
- **实测**:opt9 in-proc 12 线程 ~4/s,全量 ~3.5 天。低 CPU + 高内存(15G 表全程驻留 RAM)是大表搜索常态,非卡死。表 64M 分块灌 heap 防 OOM;Node 能 spawn emscripten pthreads(旧说法错的)→ in-proc 多线程是真并行。`MODULE`/`TABLE`/`CORPUS`/`INPROC` 可覆盖(表 >4GB 自动 in-proc,≤4GB 走 fork)。
- **inject 示例带比赛名**:bin=`[真实id,scramble,'']`,并把这些 id 的比赛/轮次 merge 进 `examples.json` 的 `sets.wca.{comps,idMeta}`(源 `wca_scrambles_split_mbf.csv`+`competitions.tsv`,口径同 build.ts `buildExampleCompMeta`)。⚠️ 管道 A 重跑会覆写 examples.json 丢 '333' 变体 → A 之后补跑 `node inject.mjs`。
- **发布**:走一条龙共享发布(`update_cross_stats.ps1 -Jobs 333opt` 跑完即 commit+push + scp,且 stages 一跑会自动补 inject 还原 '333');单独手跑 `node inject.mjs` 则需手 scp。改 JSON shape 仍须 bump `stats/page.tsx` 的 `?v=`;前端改动要 commit+push 才在生产显示。
- **QTM 待做**:`counts_qtm` 暂空(前端 QTM 钮占位)。细节见 memory `project_333_optimal_difficulty`。
