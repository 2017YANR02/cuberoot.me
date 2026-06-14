# 333 整解最优步数统计管道(管道 C)

为 `/scramble/stats` 难度 tab 的 **「333」方法**生成「整个三阶魔方最优解 HTM 步数分布」+ 示例。
方法/阶段/数据形态见前端 `core/packages/client-next/app/[lang]/scramble/stats/` + memory `project_333_optimal_difficulty`。

> 手动本地管道(非 CI):依赖本机的合并池 master + cubeopt WASM + 15G 剪枝表。

## 语料 = 管道 A 的合并池 master(不再 pull)

`D:\cube\scramble\wca_scramble\wca_scrambles_no_wide_move.txt`(`id,scramble`,**1,297,444** 条)——
跟 `update_cross_stats.ps1` 的 std_analyzer **同一份**合并三阶池(333 速拧 / 单手 / 盲拧 / 多盲 / FMC / 脚拧):

- **宽块定向已剥**:盲拧/多盲打乱末尾的 `Rw Uw'` 等已去掉,只剩纯面转(HTM),最优解器能直接吃。
- **mbf 已拆**:多盲一次多魔方已拆成单个 3x3 打乱(`|` 分隔的各 cube 各占一行)。
- **真实 WCA id**:示例据此 join 比赛名/轮次。

`pull.mjs`(从本地 WCA MySQL dump `ORDER BY RAND()` 抽样)只留作**快速验形**,生产别用(会丢宽块归一/mbf 拆分/真实 id)。

## 依赖(本机)

1. **cubeopt WASM** —— `core/packages/client-next/public/cubeopt/cube48opt9.mjs` + `.wasm`(Tronto h48 最优解,前端 `/scramble/solver` 同款,memory64 build)。
2. **15G 剪枝表** —— `solver/tables/h48/h48prun31h9.dat`(gitignored,15,565,455,360 字节)。生成走 `node gen-table.mjs`(`THREADS=12`,~数小时,内存峰 ~16G)。
3. **合并池 master**(上一节),由 `update_cross_stats.ps1` 的 incremental.py 维护并增量更新。

## 步骤

```bash
# CWD = solver/333opt/ —— 默认即生产:opt9 15G + in-proc 12 线程 + 按 id 续跑
node solve_loop.mjs   # ★全量用这个★ 自动重启 wrapper(见下「unwind 崩溃」)。内部反复跑 solve.mjs 12 直到全量完
node inject.mjs       # 注入 stats/scramble/{distribution,examples}.json 的 variant '333'(难度分布 + 示例)
node export_optimal.mjs --verify   # 导出 /timer 最优打乱数据 wca_optimal.csv(同态项目 333/oh/ft/fm),cubing 自验
# 单跑(调试,会在 ~5000 解后 unwind 崩溃,只适合小批):node solve.mjs 12
```

> **⚠️ unwind 崩溃 + 自动重启**:opt9 in-proc 跑约 5000 解后 wasm 必抛 emscripten `unwind`(pthread/主线程
> proxying 资源在长生命周期进程里累积)使进程死。solve.mjs 按 id 续跑、每解即 appendFileSync,故**重启零损失**。
> `solve_loop.mjs` = 崩了自动重启续跑直到全量完(每次重载表 ~56s,开销 ~4%;连续 3 次零进展才停下报警,不静默跳数据)。
> 全量**必须**走 `solve_loop.mjs`,别裸跑 `solve.mjs`。

## 最优解 + 最优打乱(/timer 真题用)

`solve.mjs` 用 `debug=true` 让 wasm 多打印 `Solution found!: <moves>`,故每行存 **`id,htm,solution`**:
`solution` = 该状态的**最优解序列**(HTM,God's-number 最短)。由此可得两样东西:

- **最优解**:直接就是 `solution`(把打乱解开的最短转动)。
- **最优打乱**:`solution` 的**逆序**(每步取逆 + 倒序)= 从复原态到达同一状态的最短打乱。

用途(downstream):`/timer` 的 **WCA 真题**模式给用户选「**原始打乱**(WCA 比赛原打乱)/ **最优打乱**(同状态最短)」。两者解出来是同一个魔方态,只是最优打乱更短。数据走 `out.0.csv` 的 `id → solution`(join 回 /timer 现有的真实打乱来源,见 memory `project_timer_wca_scramble_source`)。

- **默认就是生产**:solve.mjs 默认 `MODULE=cube48opt9.mjs` + `TABLE=.../h48prun31h9.dat` + `CORPUS=.../wca_scrambles_no_wide_move.txt`。表 >4GB 自动走 **in-proc**(单进程载一次表,每解开 K 线程);≤4GB(如 opt5 抽样)走 **fork**(K 进程各载一份表)。`MODULE`/`TABLE`/`CORPUS`/`INPROC=0|1` 可覆盖。
- **续跑**:每解完一个 `appendFileSync` 立刻同步落盘 `out.0.csv`,**断了最多丢正在算的 1 个**;重启 `node solve.mjs 12` 读 `out.0.csv` 已有 id 自动跳过,从断点接着算(唯一成本 = 重载 15G 表的 ~56s)。`out.0.csv` 也是 inject 的数据源。
- **长跑监控**:detached + BelowNormal 起进程(`Start-Process node ... -PriorityClass BelowNormal -RedirectStandardOutput solve_full.log`),挂 Monitor 数 `out.0.csv` 行数 / 1297444 报进度 + 完成/报错/卡死。
- **限核**:用户指定 12 线程(覆盖默认 7 核上限)。低 CPU + 高内存是大表 IDA* 随机查表的常态(内存延迟瓶颈),非卡死;15G 表全程驻留 RAM(~16G 空闲即可,别让它换页到 C 盘)。表 64M 分块灌 heap 防 OOM。

## 成本

| 表 | 每解 | 全量 1,297,444 |
|----|------|----------------|
| `cube48opt5` 972M(抽样兜底) | ~43s | ~93 天 / 7 核,不可行 |
| `cube48opt9` 15G(生产) | ~250ms(12 线程) | **~3.5 天**(~4/s) |

实测分布峰值 18 HTM(随机态均值 ~17.7),正确。

## 示例(比赛元数据)

`inject.mjs` 把 example bin 写成 `[真实WCA id, scramble, '']`,并把这些 id 的比赛/轮次 merge 进
`examples.json` 的 `sets.wca.{comps, idMeta}`(源 `wca_scrambles_split_mbf.csv` + `competitions.tsv`,
列序与口径同 `core/packages/scramble-stats-build/src/build.ts` 的 `buildExampleCompMeta`)。前端据 idMeta
解析出「比赛名 + 初赛E组#4」。⚠️ 管道 A(`update_cross_stats.ps1`)重跑会**重写 examples.json 丢掉 '333' 变体**,
故 A 跑完要**补跑 `node inject.mjs`** 把 333 加回。

## /timer 真题:原始 / 最优打乱(下游功能)

`/timer` WCA 真题模式给用户选「原始打乱 / 最优打乱」。最优打乱 = `invert(solution)`,到达同一魔方态的最短打乱。
**仅同态项目**(333/333oh/333ft/333fm,纯面转):盲拧/多盲打乱带宽块定向,本地解的是剥定向后的态,非同态,排除。

数据链路(求解全量跑完后):

```bash
node export_optimal.mjs --verify   # out.0.csv ⋈ split_mbf → wca_optimal.csv(自然键+htm+最优打乱),cubing 验 打乱+解法=复原
# 灌入生产 PG(migration 0047 已建 wca_scramble_optimal 表,deploy_core 自动 apply):
#   scp wca_optimal.csv root@cuberoot:/tmp/ && ssh ... \copy wca_scramble_optimal FROM '/tmp/wca_optimal.csv' CSV HEADER
```

- **键 = 自然键**(competition_id/event_id/round_type_id/group_id/is_extra/scramble_num):`wca_scrambles.id` 是本地自增 IDENTITY 非 WCA id,只能按自然键关联。`split_mbf.csv` 提供 id→自然键。
- **server**(`routes/wca_scrambles.ts`):`/wca/scrambles`(comp)+ `/wca/scrambles/random`(date)都 `LEFT JOIN wca_scramble_optimal`,random 端点 meta 多带短键 `o`=最优打乱(无则省略)。
- **client**:`TimerSettings.wcaUseOptimal` + `WcaSourceConfig` 的「最优打乱」开关(仅同态项目显示)+ `wca_pool` 按 `spec.optimal` 用 `o`/`optimal_scramble` 替换原打乱(无则回退原打乱)。`specKey` 含 optimal 标志,切换即重灌池。
- **部署前安全**:表空 / 数据未灌时,LEFT JOIN 返回 null → 开关回退原打乱,功能优雅缺席(可先部署代码再灌数据)。

## 发布(手动,用户在场)

`inject.mjs` 只写本地 `stats/scramble/*.json`。上线:

1. `scp stats/scramble/{distribution,examples}.json` 到 static origin(`/stats/scramble/`);
2. 改了 JSON 形态须 bump `stats/page.tsx` fetch 的 `?v=` 参数;
3. 前端代码改动需 commit+push(Vercel + systemd 部署)才在生产显示。

## TODO

- **QTM**:`inject.mjs` 写的 `counts_qtm` 暂为空(前端 QTM 钮占位)。要做需在 solve 阶段额外按 QTM 口径统计,或对 HTM 解二次计步。
