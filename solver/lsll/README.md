# LSLL 批量求解管道

给 `/alg/lsll` 的 case 算「整个三阶魔方的 HTM 最优解」。**分两批**,合起来是整个 LSLL 空间:

| 批 | 语料 | 个数 | 是什么 | 实测耗时(h6 表,12 线程) |
|---|---|---|---|---|
| 一 | `corpus.txt` | 148,384 | 站上「两步路线」那批(302 ZBLS × 494 ZBLL 去重) | 19.7 解/s ⇒ **2.1 h** |
| 二 | `corpus_rest.txt` | 434,900 | 其余全部 | 21.8 解/s ⇒ **5.5 h** |
| | | **583,284** | = 整个 LSLL 空间 | 合 **7.6 h** |

第二批**不比第一批难**(2026-07-27 各 300 条抽样实测:HTM 均 14.13 vs 14.07,峰都是 16;
反而略快一点)。两批共用一个 `out.csv`,按 key 续跑,先后顺序随意、可交叉、可中断。

背景 / 待办见 `core/packages/client/app/[lang]/alg/lsll/PLAN.md`。手动本地管道,非 CI。

## 一键跑

```bash
# 1) 造语料(半分钟,只需一次;换了 zbls 库或 model 才要重跑)
#    一次出两个文件:corpus.txt(148,384)+ corpus_rest.txt(434,900)
cd D:/cube/cuberoot.me/core
NODE_OPTIONS=--no-experimental-strip-types pnpm --filter @cuberoot/client exec tsx scripts/lsll-corpus.mts

# 2) 第一批(~2 小时,可随时 Ctrl-C,再跑接着算)
cd D:/cube/cuberoot.me/solver/lsll
node solve_loop.mjs

# 3) 第二批(~5.5 小时,同一个 out.csv)
CORPUS=corpus_rest.txt node solve_loop.mjs
```

`solve_loop.mjs` 是**全量入口**:内部反复拉起 `solve.mjs` 直到本批全量完(cubeopt 跑久了会抛
emscripten `unwind` 把进程带走,每条即落盘所以重启零损失)。别裸跑 `solve.mjs`。

进度、ETA、「全部完成」的判定都**只数本批**的 key —— 不是数 `out.csv` 的总行数
(那样第二批跑到 43 万总行时会误判完成,把后面十几万条静默丢掉)。

想让它占低优先级在后台跑:

```powershell
Start-Process node -ArgumentList 'solve_loop.mjs' -WorkingDirectory D:\cube\cuberoot.me\solver\lsll `
  -PriorityClass BelowNormal -RedirectStandardOutput solve.log -NoNewWindow
```

## 进度显示

TTY 下**单行原地刷新**(~200ms 一次),每 1% 落一条持久行;重定向进日志时只留那些持久行,
不刷屏:

```
[52716/148384 35.5%] 19.5/s · ETA 1.4h · HTM 均 14.04 峰 16
```

`退回重解 N` 只在批量模式(GROUP>1)出现,正常不该有。

## 范围与语料

两个文件,格式都是 `base36key,scramble`,由同一个脚本一次生成
(`core/packages/client/scripts/lsll-corpus.mts`,加 `--routes-only` 只出第一批)。

**`corpus.txt` 148,384 行** = 站上「两步路线」那批:302 条已收录 ZBLS case × 494 个 ZBLL
收尾 = 149,188 条路线,去重后 148,384 个 canonical key(804 条撞在一起 —— 6 个 ZBLS 构型
自带 pre-AUF 稳定子)。打乱**不是**逐个求解,而是只解 302 + 494 = 796 次基件,其余全是字符串
拼接(`composeState(zbll, zbls)` ⇒ `setup(zbll) + setup(zbls)`),149,188 条**逐条回放校验**。
打乱 6–42 步(均 32.7)。

**`corpus_rest.txt` 434,900 行** = 其余全部,凑满 583,284 = 42 个大类枚举之和(含 O 类那
3,916 个纯顶层局面 —— 页面不列它们,但「粘打乱定位 case」会撞上,顺手算掉)。这批拼不出来,
但也**不用**逐个跑 cubing.js 两阶段(43 万 × ~100ms ≈ 12 小时):走
`scripts/lsll-scramble-bfs.mts` —— 保住十字 + 前三槽的转动自己成群,

    U / U2 / U' · R U^k R' · F' U^k F   (k = 1,2,3)

这 9 条就把 9,331,200 个原始态全生成了(实测覆盖 9,331,200 / 9,331,200,BFS 3.6s,最深 11 层),
之后每个局面回溯即得打乱,43 万条**逐条回放校验**只要 10s(4.2 万条/s)。打乱 1–30 步(均 20.5)。
别往生成元里加 `R2 U R2` / `F U F'` / `R' U R`:R2 把 DRB 角、F 把 DLF 角送进顶层收不回来,
`extractLsll` 判 broken,建表时当场抛。

打乱长短都无所谓,最优解器只关心它到达的局面。两批的打乱都钉在**展示相位**(见文末)。

## 输出

`out.csv`,每行 `key,htm,qtm,solution`:

| 列 | 含义 |
|---|---|
| `key` | LSLL canonical key 的 base36(= `model.keyToString`) |
| `htm` | **整方 HTM 最优步数**(确定值) |
| `qtm` | **这一条解**的 QTM(步数 + 半转个数)——**不是**所有最优解里最小的那个 |
| `solution` | 一条 HTM 最优解;它的逆序 = 到达该局面的最短打乱 |

实测分布(各 300 条均匀抽样,h6 表):

| 批 | HTM 分布 | 均值 |
|---|---|---|
| 一 `corpus.txt` | `{11:5, 12:19, 13:48, 14:118, 15:97, 16:13}` | 14.07 |
| 二 `corpus_rest.txt` | `{10:2, 11:3, 12:11, 13:46, 14:119, 15:114, 16:5}` | 14.13 |

两批同一个量级 —— 「剩下那 43 万会不会难得多」这个担心不成立。

## 引擎

cubeopt / h48 —— 与 `/scramble/solver`、`solver/333opt` 同一套:

- 模块 `core/packages/client/public/cubeopt/cube48opt{1..9}.mjs`(memory64 build)
- 表 `solver/tables/h48/h48prun31h{5,6,9}.dat` = 928M / 1856M / 15.6G(gitignored)

默认 **opt9 + 15.6G 表** —— 与 `solver/333opt`(skill `update-scramble-stats` §C)**同一档**。
一份表常驻 in-proc,要 ~16G 空闲物理内存;不够会换页到磁盘,比换小表还惨,启动时会警告。

实测(本机 12 线程,真实 LSLL 语料抽样):

| 表 | 每解 | 第一批 148,384 | 第二批 434,900 |
|---|---|---|---|
| opt5 928M | 58ms | 2.4h | 估 7h |
| opt6 1856M | 51ms / 46ms | 2.1h | **5.5h** |
| **opt9 15.6G(默认)** | **未实测**(要 16G 空闲) | **估 1.5–2h** | 估 4–5h |

opt9 那行是**估计**,按 opt5→opt6 的斜率外推。`solver/333opt/README.md` 那张
「opt5 43s / opt9 250ms」是 **18 步随机态**,和 LSLL 的 12–16 步差着量级,别照搬那个 170 倍。

内存不够就换小表:

```bash
TABLE=../tables/h48/h48prun31h6.dat \
MODULE=../../core/packages/client/public/cubeopt/cube48opt6.mjs node solve_loop.mjs
```

换表**不改答案**(最优就是最优),只改速度,而且按 key 续跑 ⇒ 小表先起跑、内存空出来再换
大表接着跑同一个 `out.csv`,零重做。

## 还能再省一半(没做)

镜像对合 σ(`lib/lsll/mirror.ts`,过 FR / BL 的对角镜面)**保步数**,所以每对 `{K, σK}` 只用解
一个,另一个的解 = 这条解的镜像。普查实测(`scripts/lsll-mirror-census.mts`):自镜像 case
F = 432,无序对 = (583,284 + 432) / 2 = 291,858,**省 49.96%**,7.6h → 3.8h。

没做的理由:省下的是**无人值守的后台时间**,换来的是一条「派生数据」路径(有一半 case 的解
不是给它自己求出来的,而是镜像过来的)—— 要新一层校验才敢灌库。等真嫌 5.5 小时长再说。

## 已知边界:h48 吐不出「全部最优解」

用户要的口径是「**HTM 最优前提下 QTM 也最优,并列全留**」。这一阶段只给**一条**最优解,
`qtm` 是那一条的 QTM。原因(2026-07-27 实测,不是推测):

- `solve_scramble(scramble, n_threads, n_group, debug)` 的第 3 个参数是 **n_group =「同时解几条」**
  (多条打乱用 `\n` 分隔),**不是**解数上限:只喂 1 条打乱却给 8,函数空转返回、一行不打。
  前端 `/scramble/solver` 那个「同时求解」下拉就是它。
- wasm 的 embind 导出只有 `get_mem_ptr / init / get_table_size / get_table_name / solve_scramble`。
  内部虽有 `get_prun_idx()` 和 `std::vector<sol_t>`,但**没有导出**,JS 侧既拿不到剪枝表查询口、
  也拿不到解的列表。
- 拿 h48 当「距离神谕」自己做 DFS 也不行:每个节点要对 18 个子局面各求一次最优,而其中绝大多数
  子局面深度是 L+1 —— **比父局面还贵约一个分支因子**,整体比直接枚举更慢。

要做到并列全留,三条路(按推荐序):

1. **自建定深枚举**(推荐)。阶段 1 已经把 L 钉死,阶段 2 只需在**固定深度 L** 上枚举,
   不用迭代加深。配一张像样的角块 PDB(88M 项,nibble 压缩 ~44M)+ 两张 6 棱 PDB 就够;
   仓库里 `prune_create.rs` / `prune_tables.rs` / `move_tables.rs` 的基建都在。
   退役的 `lsll_solver`(git `b2e21a52b9`)的三个病灶已写在 PLAN.md,照着避。
   粗估:定深 14、好 PDB ≈ 10⁷–10⁸ 节点/case,12 线程下全量数小时量级(**未实测,属估计**)。
2. **重编 wasm**:取 cubeopt/h48 上游源码,把解收集口导出来。省事但要拿到源、配 emsdk。
3. **退化口径**:只存一条最优解,`exhaustive=false` 明确标注「QTM 并列未穷尽」——
   也就是现在这个阶段的产物。

⚠️ 这里的 `qtm` 与 `/scramble/stats` 的 333 `counts_qtm` **不是一回事**:后者要的是真 QTM 最优
(可能更长但 QTM 更小),现在仍是空占位,别拿这里的数去填。

## 为什么不批量(GROUP)

批量确实更快(h6 上 29.4/s vs 20.0/s),但 debug 输出是多线程裸 printf,**行内会互相插队**。
实测抓到过:

```
Solution found!: Solution found!: B' U' R' U  R' F  R2 F2 U  F  U' B  U
Solution found!: B' R2 D  F' L2 B  L2 F  B' D  U' R' L2 U  R  U2 B  L2 R  D2 B  B  U  B' R'
```

第二行是两条解首尾相接拼成的(中间那个 `B  B` 相邻同面,不可能出现在最优解里)。
一批 12 条里稳定有 2–3 条串味,50 批有 45 批要整批退回重解,净效果比逐条还慢。
所以默认 `GROUP=1`:12 线程全压在同一条上,输出干净。

## 校验

每条解都用本地 cubie 模型回放 `打乱 + 解 = 复原`,不过关立刻停下报错(不写坏数据)。
那张 move 表与 `client/lib/lsll/cube333.ts` 同源;它要是错了,第一条就会失败,不会静默。

## 灌库(→ 页面)

跑完(或跑到一半想先看看)走 `update_lsll.ps1`,照 `update_cross_stats.ps1` 的 `Load-*ToPg` 那套
行级增量:本地照常导出**全量** CSV,灌库时只 UPSERT 内容真变的行 + DELETE 已消失的键
(复用同一个 `pg_incremental_diff.mjs`,自然键 = 第 1 个逗号字段)。

```powershell
pwsh update_lsll.ps1              # 导出 + 增量灌【线上】PG
pwsh update_lsll.ps1 -Local       # 导出 + 灌【本地 pg13】(docker,5433)—— 配 dev:local 预览
pwsh update_lsll.ps1 -ExportOnly  # 只出 lsll_cases.csv,不碰任何库
pwsh update_lsll.ps1 -Solve       # 先把第一批(corpus.txt)跑完,再导出 + 灌
pwsh update_lsll.ps1 -Solve -Rest # 跑第二批(corpus_rest.txt),再导出 + 灌
```

- 表 `lsll_cases`(migration **0094**),主键 = canonical key 的 base36(= URL 的 `?k=`)。
- **导出的分母永远是两批的并集 583,284**,与这次求解哪一批无关(`export_cases.mjs` 默认读
  `corpus.txt` + `corpus_rest.txt`,`CORPUS` 可给逗号分隔清单覆盖)。
- manifest 落 `incremental/pg_lsll_manifest.tsv`,**仅灌库成功后**才落盘;想强制全量重灌就删它。
- **没跑完也能灌**:缺的 case 端点返 `{status:'pending'}`,页面显示「计算中」。
- 线上灌库的密码由服务器端自己从 `/root/core-api/.env` 读,脚本里没有凭据。
- `-Local` 走容器内 psql(本机没装客户端),会顺手把 migration 0094 灌进 pg13(幂等)。
- 全量 583,284 行的量级:CSV ~55 MB,PG 表 + 主键索引 ~80 MB。`/v1/alg/lsll/dist` 那句
  `GROUP BY htm` 是全表扫(单 case 查询走主键,不受影响),灌满之后如果嫌它慢,加
  `CREATE INDEX ON lsll_cases (htm)` 让它走 index-only scan;端点本身 `s-maxage=86400`,
  正常一天只穿透一次。

## 下游(已接)

- API `GET /v1/alg/lsll/case/:key` → `{ htm, qtm, exhaustive, algs }`;未回填返 `{status:'pending'}`。
  另有 `GET /v1/alg/lsll/dist` 给步数直方图。
- 页面 `/alg/lsll/case?k=` 的「HTM 最优解」区显示它,`exhaustive=false` 时明写
  「只有一条最优解,QTM 并列未穷尽」。

**语料是按展示相位生成的**:case 页画的是 `displayState`(对子摆正那个代表元),而 canonical key
认的是 16 个 AUF 像里最小的那个 —— 差一个 AUF,解贴上去就解不开。所以第一批拼完打乱后会枚举
16 种首尾 AUF、钉到展示相位再写出;第二批直接拿展示相位的态去 BFS 表里回溯,天生就在相位上。
**改语料生成时别把这一步弄丢。**
