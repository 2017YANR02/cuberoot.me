---
name: update-scramble-stats
description: "用户说更新打乱统计、更新十字/阶段难度、更新 puzzle 或 SQ1 分布、333 HTM/333opt、补 xcross、backfill_xcross_variant 或 pseudo_f2leo 回填时使用。执行 /scramble/stats 的本地增量管道；只能在具备 solver、cubeopt 等本地大表的环境运行。"
---

# 更新打乱统计

发布遵循仓库 AGENTS 部署授权;下列裸命令会 commit/push、上传静态产物并灌库,仅在这些发布动作均获授权时执行;仅本地或未获发布授权时统一加 `-NoPublish`(跳过 commit/push/scp/灌库),不得用脚本默认行为扩大权限。

**一条龙:一个命令 `update_cross_stats.ps1`,`-Jobs` 选作业,跑完共享一次发布**(commit+push + scp 换 static,覆盖三类产物)。三类作业都只能本地(stages 需 solver 34GB 表 / 333opt 需 cubeopt 表):

> **发布全增量(2026-06-25)**:所有作业都只传变化的文件。非 stages 小作业(`333opt`/`puzzles`)走 `git status` diff scp(`.tmp`+远端原子 `mv`),秒级;**stages 走 `publish_scramble_incremental.ps1`**——维护本地 sha1 内容清单(`incremental/publish_manifest.sha1`),每次只 diff 出内容真变的文件打小包 scp + 删远端孤儿,把过去每次 ~590MB 整包 tar(~35min)降到典型增量的 changed 小包(几十个 comp_steps + 变动 JSON,分钟级)。首次无清单(或 `-Baseline`)自动全量 tar 建基线。复用现有免密 `ssh cuberoot`,不引入 rsync。
>
> **PG 灌库也全增量(2026-06-25)**:`wca_scramble_optimal` + `wca_scramble_steps` 以前每次全量 `DELETE`+`\copy` / `TRUNCATE` 重灌(单次 ~270MB),现同样走行级 sha1 内容 diff(`pg_incremental_diff.mjs` + `incremental/pg_*_manifest.tsv`)——本地照常 build 全量 CSV,灌库只 `UPSERT` 内容真变的行 + `DELETE` 已消失自然键(典型增量几千行=KB,无变化=零传输只刷 meta)。manifest 仅在远端灌库成功后落盘(失败不更新,下次重试)。无 manifest=基线:走原全量路径并建基线;**删对应 `pg_*_manifest.tsv` 即强制全量重建**。重复自然键(steps 偶有,WCA dump 同场两套 scramble)diff 侧按首次出现去重 + 服务端 `DISTINCT ON` 双保险。

| job | 对象 | 内部 | 产物 |
|-----|------|------|------|
| `stages` | 3x3 阶段难度(十字/F2L/EO/DR 多阶段多变体) | 内置(取数→std→变体补缺) | `distribution.json` + `wca_cross` + `comp_steps*` + `difficulty_first_appearance*`(时间线) |
| `333opt` | 3x3 整解最优 HTM(整个魔方最优解) | `node solver/333opt/inject.mjs` + `inject_first_appearance.mjs`(折 `out.*.csv`) | `distribution.json` + `examples.json` 的 `variants['333']` + `difficulty_first_appearance` 的 333 注入 |
| `puzzles` | 非3x3(二阶/金字塔/斜转/SQ1) | `update_puzzle_stats.ps1` + `build_puzzle_examples.ts` + `build_puzzle_first_appearance.ts` | `puzzle_distribution.json` + `puzzle_examples.json` + `puzzle_first_appearance.json`(时间线) |

```pwsh
pwsh core/jobs/scramble-stats-build/update_cross_stats.ps1                 # = -Jobs all,全跑 + 发布
pwsh core/jobs/scramble-stats-build/update_cross_stats.ps1 -Jobs 333opt    # 只跑某作业
pwsh core/jobs/scramble-stats-build/update_cross_stats.ps1 -Jobs stages,puzzles   # 跑多个
pwsh core/jobs/scramble-stats-build/update_cross_stats.ps1 -Jobs puzzles -Puzzles sq1   # 选 puzzle
pwsh core/jobs/scramble-stats-build/update_cross_stats.ps1 -NoPublish      # 只本地不发布
```

**NL 映射**(AI 按用户话传 flag):"更新统计"=`-Jobs all`;"只跑333"=`-Jobs 333opt`;"跑 X/Y"=`-Jobs X,Y`;"不跑 X"=去掉 X 后的列表;"不跑 eo" 等**变体级**=`-Variants <去掉eo的列表>`(仅 stages 内,见 A)。

要点:
- ⛔ **非 WCA 采样默认停用(2026-06-25 用户要求)**:`puzzles` 作业**不再**为非 WCA puzzle(335 等 TIER C/D)跑离线采样分布 `dist_<event>.json`。`update_puzzle_stats.ps1` 采样步已默认关(加 `-Sampled` 才跑),一条龙 / 裸跑都不采样。**别为「补全分布」把这默认去掉 / 加回采样**;要恢复需用户显式说。详见 `solver/NONWCA_PUZZLE_LOOP.md` §0.0 #12。
- **333opt 只做 inject**(折当前 `solver/333opt/out.*.csv`);那条 **~3.5 天全量求解仍是独立后台** `node solver/333opt/solve_loop.mjs`(按需续解,见 C),不在一条龙里。
- **stages 的 build 会覆写 distribution/examples 的 '333' 变体 → 脚本在 stages build 之后自动补 333 inject 还原**(不用再记得手跑;`willInject = run333opt 或 stages有变`)。
- 三类作业**共享发布**;`-NoPublish` 一起跳过。

**「原始 / 最优打乱」开关数据**(/scramble/stats 难度+长度 tab、/timer 真题):每条打乱可切「最优等价打乱」=invert(最优解),同状态最少步。
- **难度 tab puzzle**(222/pyram/skewb):analyzer 开 `PUZZLE_EMIT_SOLN=1` 多产 soln 列(`update_puzzle_stats.ps1` 已固定开);`build_puzzle_examples.ts` 反推存第 3 元 `[id,scr,opt]`。改 analyzer 要 `cargo build --release --bin {cube222,skewb,pyraminx}_analyzer`。
- **难度 tab 三阶**:333opt inject 已带(examples 第 4 元)。
- **长度 tab**(3x3 面转族 + 222/pyram/skewb):`build_length_opt.mjs`(一条龙 step 5c,增量)产 `event_length_examples_opt.json`(text→opt overlay);CI 日更的 base 不被覆盖。3x3 走 cube48opt5(972M 表),puzzle 走 analyzer。**首跑慢(~1284 个 3x3 解,opt5 ~40min);增量再跑很快**。
- **/timer 真题最优**:走 PG `wca_scramble_optimal`(非 static)。**一条龙自动灌库**(2026-06-14 起,不再手动 `\copy`):333opt job 在 inject 后跑 `solver/333opt/export_optimal.mjs` 产 `wca_optimal.csv`,puzzles job 跑 `export_puzzle_optimal.mjs` 产 `wca_optimal_puzzle.csv`,发布步 6b 自动**行级增量灌库**(2026-06-25 起,见上「PG 灌库也全增量」):sha1 行清单 diff,只 `UPSERT` 变动行 + `DELETE` 删除键(无 manifest=基线走原 `DELETE`+`\copy` 全量);密码服务器端从 `/root/core-api/.env` 读(不入仓库脚本)。`-NoPublish` 一并跳过(只产 CSV 不灌)。前端 `OPTIMAL_EVENTS`(WcaSourceConfig)gate 开关显示;开关 ON 时 date 模式传 `optimal=1`(服务端只回有最优等态的真题)、comp 模式客户端过滤,**不再静默回退原打乱**(某项目覆盖率不足时该池空→回退随机生成)。sq1/魔表无(占位注明)。

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

## A. 三阶阶段难度

运行 stages、变体回填或双色底 xcross 前，必须读 [专项流程](references/stages.md)；命令路径沿用仓库根目录基准，流程明确指定 CWD 时按其执行。

## B. 非 3x3

运行 puzzles、SQ1 或非三阶分布前，必须读 [专项流程](references/puzzles.md)；命令路径沿用仓库根目录基准，流程明确指定 CWD 时按其执行。

## C. 三阶整解

运行 333opt 注入、续解或最优 HTM 统计前，必须读 [专项流程](references/333opt.md)；命令路径沿用仓库根目录基准，流程明确指定 CWD 时按其执行。
