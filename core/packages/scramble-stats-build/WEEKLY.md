# 周更:WCA 十字步数分布增量管道

把 WCA 新公示的打乱(三阶 / 单手 / 脚拧 / 三盲 / 多盲 / FMC)增量算进 `cross / xc / xxc / xxxc / xxxxc × 6 底色` 的统计,刷新 `/scramble/stats` 全局分布图 + `/scramble/analyzer` 的真实打乱池。

**只能在本地跑**:solver 需要 ~34 GB 剪枝表 + 运行时十几 GB 内存,云服务器(2G)跑不动。

## 一键

```pwsh
pwsh core/packages/scramble-stats-build/run_weekly.ps1
```

下载最新 results export → 挑出未处理的新打乱 → solver 全 5 阶段 → 追加 master → 重算 JSON → commit & push + scp static。任一步失败即停。

### 开关

| flag | 作用 |
|---|---|
| `-DryRun` | 不下载(配 `-SourceCsv`)、不发布,验证流程 |
| `-SourceCsv <path>` | 用本地 `input` 形状 csv 当源替代下载(测试) |
| `-NoPublish` | 跑完只更新本地 std.csv + JSON,不 commit/push/scp(想先 review) |
| `-SkipSolve` | 调试:复用上次 solver 产出 |

## 前置(一次性)

- **solver 表**:`D:\cube\solver-rust\tables\` 已生成(~34 GB)。没有就先 `cd D:\cube\solver-rust; cargo build --release; .\target\release\table_generator.exe`(1-2 小时)。
- **uv**:`incremental.py` 依赖 pandas,`uv run` 自动装。
- **免密 ssh**:`ssh root@cuberoot` 通(scp 发布用)。
- **CWD 无所谓**:脚本内部全用绝对路径 + `CUBE_TABLE_DIR`,不依赖当前目录。

## 6 步

1. **取数** `incremental.py`:下 `results/v2/tsv`(~344 MB,按 export_date 缓存)→ 抽 `Scrambles.tsv` + `Competitions.tsv` → 过滤 333 系列 & **未处理的 scrambleId**(对 `std.csv` 已处理集合做差,能接住回填)→ 拆多盲(`|`→行)+ 去宽层 → `incremental/new_no_wide_move.txt`。顺便刷新 `competitions.tsv` + 写 `export_date.txt`。
2. **solver** `std_analyzer.exe`:`CUBE_TABLE_DIR` + `CUBE_ALLOW_HUGE_TABLES=1` + `CUBE_RUN_FULL_STD=1`,stdin 喂文件名,`[PROG] N/total` 实时进度。热态 ~1 条/秒(16 核),冷启首条多花几分钟 mmap 巨表。
3. **追加 master**(LF 安全):`stat/std.csv` ← solver 输出;`wca_scrambles_no_wide_move.txt` ← 新打乱;`input/wca_scrambles_split_mbf.csv` ← 新元数据。
4. **重算**:`build`(distribution.json + examples.json + 下载 txt)+ `build:wca-cross`(6 色池,每条带完整 `id` 含后三位)+ `build:comp-steps`(每场预计算十字步数表 `comp_steps/<id>.json`,gen 页"秒出"用,前端零解算)。RNG 固定种子 + `SCRAMBLE_STATS_STAMP`=export_date → distribution/wca_cross 数据不变则逐字节不变;comp_steps 是精确值(无随机/时间戳)。
5. **发布**:`git add stats/scramble` → commit(英文 msg)→ `pull --rebase --autostash` → push(触发 Vercel)→ `scp stats/scramble` 到 static(self-hosted nginx + Vercel fallback 都从这服)。
6. 完成。

## id 编码

`final_id = str(scrambleId) + zfill(3, seq)`。非多盲 `seq=001`(如 `22001`);多盲一把多条 → `001..00n`。`scrambleId = int(id) // 1000` 可逆。这个完整 id(含后三位)会写进 `wca_cross/*.json` 每条样本,网页端展示打乱序号。

## 数据(全 gitignore 在 `D:\cube\scramble\wca_scramble\`)

`stat/std.csv`(主统计) `wca_scrambles_no_wide_move.txt`(打乱文本) `input/wca_scrambles_split_mbf.csv`(元数据) `competitions.tsv`(比赛名/日期) `incremental/`(每次的中间产物)。

## 排错

| 症状 | 原因 / 解决 |
|---|---|
| solver 卡在 `Scanning depth N` / `State Space` | `CUBE_TABLE_DIR` 没指对,在重新生成表。确认指向 `solver-rust\tables\` |
| `huge table requires CUBE_ALLOW_HUGE_TABLES=1` | 缺 env,脚本已设;手动跑记得带 |
| GBK 编码报错 | python 已 `reconfigure utf-8`;手动跑前 `$env:PYTHONUTF8=1` |
| 下载慢/断 | export ~344 MB;脚本按 export_date 缓存到 `incremental/cache/`,重跑跳过已下 |

## 可选:定时

用户选了手动一键。若要无人值守,Windows 任务计划程序加一条每周触发:
`pwsh -NoProfile -File D:\cube\cuberoot.me\core\packages\scramble-stats-build\run_weekly.ps1`
(机器需开机 + 已登录态;失败会非零退出,可在任务里配重试/告警。)
