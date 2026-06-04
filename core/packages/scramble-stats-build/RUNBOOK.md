# 十字统计刷新 (手动增量管道, 按需触发非定时)

把 WCA 新公示的打乱(三阶 / 单手 / 脚拧 / 三盲 / 多盲 / FMC)增量算进 `cross / xc / xxc / xxxc / xxxxc × 6 底色` 的统计,刷新 `/scramble/stats` 全局分布图 + `/scramble/analyzer` 的真实打乱池。

**只能在本地跑**:solver 需要 ~34 GB 剪枝表 + 运行时十几 GB 内存,云服务器(2G)跑不动。

## 一键

```pwsh
pwsh core/packages/scramble-stats-build/update_cross_stats.ps1
```

下载最新 results export → 挑出未处理的新打乱 → std_analyzer 全 5 阶段 → 追加 master → 默认再跟 std 锁步补 eo/pseudo/pseudo_pair(按 id 缺补,分块可续)→ 重算 JSON → commit & push + scp static。任一步失败即停。

### 交互向导

**真人终端裸跑(无任何参数)会自动进向导**。UI 移植自 `D:\cube\upload-video\upload.ps1`(原生配色 + `SetCursorPosition` 原地重绘):`↑↓` 移动、`Space` 多选切换、`Enter` 确认、`Esc` 取消。先在取数**前**问 TSV 来源,取数后扫描各变体待补条数并按实测速率估时,逐项问:

0. **TSV 来源**(单选,仅当 `cache/` 有可用 zip 才问):下载官方最新 export / 用本地缓存最新 zip 不联网(后者等价 `-UseCached`,export_date 从文件名还原,stamp 仍稳定)。
1. **补哪些变体**(多选 ■/□,带每变体待补数 + 估时):快捷键 `[A]`ll 全选、`[D]`efault 切默认组 `eo/pseudo/pseudo_pair`、`[O]`pt-in 切 `pair/f2leo/pseudo_f2leo`;数字 `1..6` 切单项。
2. **每变体最多跑几块**(单选,数字键直选):补满 / 1 / 2 / 5 块(等价 `-MaxChunks N`)。
3. **是否发布**(Yes/No,`●`/`○`):发布(push + scp)/ 仅本地(等价 `-NoPublish`)。

最后打印「计划」总览 + 开始/取消 确认;选择直接套回 `$Variants/$MaxChunks/$NoPublish`,后续与 flag 路径完全一致。三个菜单函数 `Read-MultiSelect`/`Read-SingleSelect`/`Read-Confirm`;`Esc` 任一步取消都不改动 master/JSON。**顶部 `[Console]::OutputEncoding = UTF8` 是必须的** —— 否则中文 Windows 默认 GBK(936) 码页会把 `›`/`■`/`●` 等非 GBK 字形渲染成 `?`。

触发判据:`-Interactive` 强制开;否则仅当**无任何参数 + 交互终端**(`[Console]::IsInputRedirected=False`)。**AI 工具 / 带任意 flag / 非交互终端(stdin 重定向)一律不弹**,走旧一键 —— 故 AI 自动化与定时任务行为不变。

### 开关

| flag | 作用 |
|---|---|
| `-Interactive` | 强制走交互向导(见上);裸跑+真人终端时自动开,无需显式传 |
| `-UseCached` | 取数不联网,用 `incremental/cache/` 里最新 `WCA_export_*.tsv.zip`(向导里也会问);无缓存则报错 |
| `-DryRun` | 不下载(配 `-SourceCsv`)、不发布,验证流程 |
| `-SourceCsv <path>` | 用本地 `input` 形状 csv 当源替代下载(测试) |
| `-NoPublish` | 跑完只更新本地 std.csv + JSON,不 commit/push/scp(想先 review) |
| `-SkipSolve` | 调试:跳过 incremental + std 解算,复用上次取数/solver 产出(`new_no_wide_move.txt` + `_std.csv`),直接走追加/变体/发布。需上一次正常 run 留下的产物 |
| `-Variants <list>` | 跟 std 锁步补缺的变体,默认 `eo,pseudo,pseudo_pair`;`@()`=只 std。**pair / f2leo / pseudo_f2leo 不在默认**:pair 暖表 ~200/s(全量补 ~1.7h);f2leo/pseudo_f2leo 现走大表快路径(真实打乱实测 f2leo 用 huge 联合表 ~31/s、pseudo_f2leo 用 huge 电池 ~81/s,均需 CUBE_ALLOW_HUGE_TABLES=1 已默认设;首跑全量回填),要显式 `-Variants pair` 或 `-Variants f2leo,pseudo_f2leo` |
| `-ChunkSize <n>` | 变体补缺分块大小(显式则覆盖每变体默认 `$VARIANT_CHUNK`:eo/pair=2000、其余 20000):逐块校验+追加,中断只丢当前块、下次自动续 |
| `-MaxChunks <n>` | **每个变体最多跑 N 块就停**,之后照常重算 + 发布(还差的下次 run 自动续);`0`=补满(默认)。用于"只跑一两块"而无需人工中途 kill。例:`-Variants eo -MaxChunks 1` = 跑一块 eo(2000≈40min)→ 发布 |

## 前置(一次性)

- **solver 表**:`D:\cube\cuberoot.me\solver\tables\` 已生成(~34 GB)。没有就先 `cd D:\cube\cuberoot.me\solver; cargo build --release; .\target\release\table_generator.exe`(1-2 小时)。
- **uv**:`incremental.py` 依赖 pandas,`uv run` 自动装。
- **免密 ssh**:`ssh root@cuberoot` 通(scp 发布用)。
- **CWD 无所谓**:脚本内部全用绝对路径 + `CUBE_TABLE_DIR`,不依赖当前目录。
- **算力限额**:脚本顶部已钉 `RAYON_NUM_THREADS=14`(7 核 14 线程,留 1 核给系统)+ 本进程 `BelowNormal` 优先级,长跑 analyzer 不吃满核、不卡系统。手动直接跑某个 `*_analyzer.exe` 时记得自己带 `$env:RAYON_NUM_THREADS=14`。

## 步骤

1. **取数** `incremental.py`:下 `results/v2/tsv`(~344 MB,按 export_date 缓存)→ 抽 `Scrambles.tsv` + `Competitions.tsv` → 过滤 333 系列 & **未处理的 scrambleId**(对 `std.csv` 已处理集合做差,能接住回填)→ 拆多盲(`|`→行)+ 去宽层 → `incremental/new_no_wide_move.txt`。顺便刷新 `competitions.tsv` + 写 `export_date.txt`。(std 无新增也**不早退**,继续走变体补缺。)
2. **std solver** `std_analyzer.exe`:`CUBE_TABLE_DIR` + `CUBE_ALLOW_HUGE_TABLES=1` + `CUBE_RUN_FULL_STD=1`,stdin 喂文件名,`[PROG] N/total` 实时进度。热态 **std ~115 条/秒**(旧 16 核满核基准;现钉 14 线程略低),冷启首条多花几分钟 mmap 巨表。
3. **追加 std master**(LF 安全):`stats/std.csv` ← solver 输出;`wca_scrambles_no_wide_move.txt` ← 新打乱(=变体补缺基准);`input/wca_scrambles_split_mbf.csv` ← 新元数据。
4. **变体补缺**(`-Variants`,默认 eo/pseudo/pseudo_pair):每个变体算 `master no_wide_move 的 id − 该变体 csv 已有 id = 待补` → 对应 analyzer(`solver/target/release/<v>_analyzer.exe`,env 同需 huge)**分块 solve + 逐块校验行数后追加**,中断可续(下次重算 missing 自动接上)。实测速率(旧 16 核满核、huge 表全模式,2026-05-30 核实;现钉 14 线程略低):**pseudo ~390/s、pseudo_pair ~47/s**(旧记 18/35 偏低)、**eo ~0.9/s**(~13M 节点/条,全量 89.5k ≈ 27h,最慢长极)、pair ~200/s(暖表)。**analyzer 是整块 `rayon par_iter` 攒进内存 Vec、跑完才一次性写 CSV**(`executor.rs::run_batch`),故中断丢在飞的整块 → chunk 越小 save point 越密。每变体默认 chunk 见脚本 `$VARIANT_CHUNK`(eo=2000≈37min、pair=2000 暖表≈10s/块、其余=20000≈9-18min),显式 `-ChunkSize` 覆盖全部。**pair 不在默认**:暖表 ~200/s,全量补 ~1.7h(首块冷读 huge 表 ~95s,之后 OS page cache 命中),显式 `-Variants pair` 跑。**f2leo / pseudo_f2leo 也不在默认**(opt-in):它们是小表分析器(`f2leo_analyzer.exe` / `pseudo_f2leo_analyzer.exe`,常驻 ~40MB,只用 mt_edge2/edge4/corn/edge + 自建 ~18MB xcross + ~272KB cross 剪枝表,**不碰 huge 表、不需要 `CUBE_ALLOW_HUGE_TABLES`**),显式 `-Variants f2leo,pseudo_f2leo`,首跑全量回填全部 ~1.29M id。
5. **重算**:`build`(distribution.json + examples.json + 下载 txt,**读全部变体故任一变即重算**)+ 仅当有新 std 时再跑 `build:wca-cross`(6 色池,每条带完整 `id` 含后三位)+ `build:comp-steps`(每场预计算表 `comp_steps/<id>.json`,gen 页"秒出")。RNG 固定种子 + `SCRAMBLE_STATS_STAMP`=export_date → 数据不变则产物逐字节不变。
6. **发布**:`git add stats/scramble` → commit(英文 msg)→ `pull --rebase --autostash` → push(触发 Vercel)→ tar 打包 `scp` 到 static(self-hosted nginx + Vercel fallback 都从这服)。

## id 编码

`final_id = str(scrambleId) + zfill(3, seq)`。非多盲 `seq=001`(如 `22001`);多盲一把多条 → `001..00n`。`scrambleId = int(id) // 1000` 可逆。这个完整 id(含后三位)会写进 `wca_cross/*.json` 每条样本,网页端展示打乱序号。

## 数据(全 gitignore 在 `D:\cube\scramble\wca_scramble\`)

`stats/{std,eo,pseudo,pseudo_pair,pair,f2leo,pseudo_f2leo}.csv`(各变体统计,表头统一 `id`+`_z0/_z2/_z3/_z1/_x3/_x1`;f2leo/pseudo_f2leo 只 4 阶段无 xxxxcross,大表快路径产出) `wca_scrambles_no_wide_move.txt`(打乱文本=变体补缺基准) `input/wca_scrambles_split_mbf.csv`(元数据) `competitions.tsv`(比赛名/日期) `incremental/`(每次的中间产物 + 变体补缺的 `sync_*.txt`/`sync_*_*.csv`)。

## 排错

| 症状 | 原因 / 解决 |
|---|---|
| solver 卡在 `Scanning depth N` / `State Space` | `CUBE_TABLE_DIR` 没指对,在重新生成表。确认指向 `solver\tables\` |
| `huge table requires CUBE_ALLOW_HUGE_TABLES=1` | 缺 env,脚本已设;手动跑记得带 |
| GBK 编码报错 | python 已 `reconfigure utf-8`;手动跑前 `$env:PYTHONUTF8=1` |
| 下载慢/断 | export ~344 MB;脚本按 export_date 缓存到 `incremental/cache/`,重跑跳过已下 |

## 可选:定时

用户选了手动一键。若要无人值守,Windows 任务计划程序加一条每周触发:
`pwsh -NoProfile -File D:\cube\cuberoot.me\core\packages\scramble-stats-build\update_cross_stats.ps1`
(机器需开机 + 已登录态;失败会非零退出,可在任务里配重试/告警。)
