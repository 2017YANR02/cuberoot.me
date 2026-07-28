# LSLL 批量求解管道

给 `/alg/lsll` 的 case 算「整个三阶魔方的 HTM 最优解」。**一个语料 `corpus.txt`,579,368 个 case**。

## 口径:算的是「case 的最优」,不是某个代表元的最优(2026-07-28 起)

case 按定义是双陪集 ⟨U⟩·S·⟨U⟩ —— 起手对准顶层那个 AUF、公式尾部自带那个 AUF 都是解法里可以
自由选的,所以 **`U^a 打乱 U^b` 这 16 个局面是同一个 case**,它们的最优解长度互差 0~2 步。

于是语料每行展开 16 个像各解一次,**取最短**:

```
579,368 个 case × ≤16 个 AUF 像 = 9,268,992 次求解
```

(不是 579,368 × 16 = 9,269,888:D+ / D− 两类整对入槽且槽棱没翻,有非平凡稳定子,
全空间共 896 个像重复,展开后按局面去重。)

**等价判据 —— 取到最短之后,那条解的首招和末招一定都不是 U 系转动。**是的话剥掉就得到同轨道
更短的成员,与「最短」矛盾。`solve.mjs` 逐条断言、`export_cases.mjs` 灌库前整表复核、
`tests/lsll_optimal.test.ts` 钉判据本身,三处同源。

> 旧口径(只解展示相位那一个代表元)的 `out.csv` **整个作废**:实测 148,389 行里 59% 的解首/末
> 是 U 系,均值虚高 ≥0.71 步(14.01 → ≤13.30)。`solve.mjs` 启动时会扫出来并拒绝续跑,
> 不会静默混用。

`579,368 = 583,284 − 3,916`:**O 类不进语料**,它对子已归位且朝向正确,剩下的纯粹是顶层,
那 3,916 个局面就是 1LLL 的 3,916 个,LSLL 不列不练。

背景 / 待办见 `core/packages/client/app/[lang]/alg/lsll/PLAN.md`。手动本地管道,非 CI。

## 一键跑

```bash
# 1) 造语料(半分钟,只需一次;换了 zbls 库或 model 才要重跑)
cd D:/cube/cuberoot.me/core
NODE_OPTIONS=--no-experimental-strip-types pnpm --filter @cuberoot/client exec tsx scripts/lsll-corpus.mts

# 2) 全量(默认 opt9 + 15.6G 表;可随时 Ctrl-C,再跑接着算)
cd D:/cube/cuberoot.me/solver/lsll
node solve_loop.mjs
```

`solve_loop.mjs` 是**全量入口**:内部反复拉起 `solve.mjs` 直到全量完(cubeopt 跑久了会抛
emscripten `unwind` 把进程带走,每个 case 即落盘所以重启零损失)。别裸跑 `solve.mjs`。

开跑前先量一发速度(约一分钟,顺带把所有闸门都走一遍):

```bash
LIMIT=200 node solve.mjs      # 只啃 200 个 case,给出 case/s 与 解/s
```

想让它占低优先级在后台跑:

```powershell
Start-Process node -ArgumentList 'solve_loop.mjs' -WorkingDirectory D:\cube\cuberoot.me\solver\lsll `
  -PriorityClass BelowNormal -RedirectStandardOutput solve.log -NoNewWindow
```

## 中断与续跑

**每个 case 一算完就 `appendFileSync` 落盘。**所以随时 Ctrl-C / 关机 / 崩溃最多丢当前这一个
case(≤16 次求解,≈0.7 秒),没有别的状态要保存,重跑同一条命令按 key 续上。

启动时还会核末行是否被断电写残,残了自动截掉重算那一条(`repairTail`)。

## 进度显示

**全程只占一行,原地覆盖**,连崩溃重启也不换行(第 1 轮之外子进程走 `QUIET=1`,不打横幅
不打汇总):

```
[52716/579368 9.10%] 1.42 case/s(22.1 解/s)· 剩 111.3h · HTM 均 13.31 峰 16
```

重定向进日志时没法原地覆盖,退化成每 1% 一条(全程约 100 行)。
`退回重解 N` 只在批量模式(GROUP>1)出现,正常不该有。

## 范围与语料

两个文件,格式都是 `base36key,scramble`,由同一个脚本一次生成
(`core/packages/client/scripts/lsll-corpus.mts`,加 `--routes-only` 只出前一段)。

**前 148,384 行** = 站上「两步路线」那批:302 条已收录 ZBLS case × 494 个 ZBLL
收尾 = 149,188 条路线,去重后 148,384 个 canonical key(804 条撞在一起 —— 6 个 ZBLS 构型
自带 pre-AUF 稳定子)。打乱**不是**逐个求解,而是只解 302 + 494 = 796 次基件,其余全是字符串
拼接(`composeState(zbll, zbls)` ⇒ `setup(zbll) + setup(zbls)`),149,188 条**逐条回放校验**。
打乱 6–42 步(均 32.7)。

**后 430,984 行** = 其余全部,凑满 579,368 = 41 个可训练大类枚举之和(**不含 O 类**)。这批
拼不出来,但也**不用**逐个跑 cubing.js 两阶段(43 万 × ~100ms ≈ 12 小时):走
`scripts/lsll-scramble-bfs.mts` —— 保住十字 + 前三槽的转动自己成群,

    U / U2 / U' · R U^k R' · F' U^k F   (k = 1,2,3)

这 9 条就把 9,331,200 个原始态全生成了(实测覆盖 9,331,200 / 9,331,200,BFS 3.6s,最深 11 层),
之后每个局面回溯即得打乱,43 万条**逐条回放校验**只要 10s(4.2 万条/s)。打乱 1–30 步(均 20.5)。
别往生成元里加 `R2 U R2` / `F U F'` / `R' U R`:R2 把 DRB 角、F 把 DLF 角送进顶层收不回来,
`extractLsll` 判 broken,建表时当场抛。

打乱长短都无所谓,最优解器只关心它到达的局面 —— 而且求解阶段会把每行展开成 16 个首尾 AUF 像,
**基准相位是什么更加无所谓**。仍钉在展示相位(见文末),纯粹为了回放校验有个确定的比对目标。

## 输出

`out.csv`,每行 `key,htm,qtm,solution`,**一行一个 case**:

| 列 | 含义 |
|---|---|
| `key` | LSLL canonical key 的 base36(= `model.keyToString`) |
| `htm` | **这个 case 的整方 HTM 最优步数** = 16 个 AUF 像里最短的那个(确定值) |
| `qtm` | **这一条解**的 QTM(步数 + 半转个数)——**不是**所有最优解里最小的那个 |
| `solution` | 一条 HTM 最优解;首末招保证不是 U 系。它的逆序 = 摆出该 case 的最短打乱(相位随缘) |

旧口径(只解展示相位)的实测分布是 `{11:5, 12:19, 13:48, 14:118, 15:97, 16:13}`,均值 14.07;
把首尾 AUF 剥掉可得新口径的**上界** 13.30 —— 新口径的真实均值 ≤ 13.30,分布整体左移约一格。
新口径跑完之后把实测填回这里。

## 引擎

cubeopt / h48 —— 与 `/scramble/solver`、`solver/333opt` 同一套:

- 模块 `core/packages/client/public/cubeopt/cube48opt{1..9}.mjs`(memory64 build)
- 表 `solver/tables/h48/h48prun31h{5,6,9}.dat` = 928M / 1856M / 15.6G(gitignored)

默认 **opt9 + 15.6G 表** —— 与 `solver/333opt`(skill `update-scramble-stats` §C)**同一档**。
一份表常驻 in-proc,要 ~16G 空闲物理内存;不够会换页到磁盘,比换小表还惨,启动时会警告。

**这条管道认定用 opt9 + 15.6G 表**,内存自己腾。实测(本机 12 线程,真实 LSLL 语料抽样):

| 表 | 每解 | 9,268,992 次求解 |
|---|---|---|
| opt5 928M | 58ms | 估 150h |
| opt6 1856M | 51ms / 46ms(21.8 解/s) | 估 **118h** |
| **opt9 15.6G(默认)** | **未实测**(要 16G 空闲) | 待 `LIMIT=200` 量 |

opt9 那行没有实测数 —— 开跑前用 `LIMIT=200 node solve.mjs` 量一发再决定怎么排期。
`solver/333opt/README.md` 那张「opt5 43s / opt9 250ms」是 **18 步随机态**,和 LSLL 的
12–16 步差着量级,别照搬那个 170 倍。

换表**不改答案**(最优就是最优),只改速度,而且按 key 续跑 ⇒ 中途停下来换表零重做。

## 还能再省一半(没做)

镜像对合 σ(`lib/lsll/mirror.ts`,过 FR / BL 的对角镜面)**保步数**,所以每对 `{K, σK}` 只用解
一个,另一个的解 = 这条解的镜像。普查实测(`scripts/lsll-mirror-census.mts`):自镜像 case
F = 432,**省约 50%**。求逆(`opt(S) = opt(S⁻¹)`,且求逆把 case 成对映射)还能再省一半,
两条叠起来最多 4×:118h → ~30h。

没做的理由:省下的是**无人值守的后台时间**,换来的是一条「派生数据」路径(有一半 case 的解
不是给它自己求出来的,而是镜像 / 取逆过来的)—— 要新一层校验才敢灌库。

真想大幅压缩的话,杠杆最大的其实是第三条:**给 cubeopt 加深度上限**。有了它,每个 case 只需
满解一个像拿到 d,其余 15 个像只问「有没有 ≤ d−2 / ≤ d−1 的解」,IDA\* 的开销压在最后一层,
浅两层的探测便宜一个数量级 —— 16× 能压到 2~4×。代价是要动 C / wasm(现在 embind 只导出
`get_mem_ptr / init / get_table_size / get_table_name / solve_scramble`,没有深度口)。

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
pwsh update_lsll.ps1 -Solve       # 先把 corpus.txt 跑完,再导出 + 灌
```

灌库前 `export_cases.mjs` 会整表复核「首末招不是 U 系」——旧口径的 `out.csv` 在这一步一定炸,
不会被静默端上线。O 类那 3,916 行不再在语料里,增量 diff 会把它们从表里 DELETE 掉
(页面本来就不列 O)。

- 表 `lsll_cases`(migration **0094**),主键 = canonical key 的 base36(= URL 的 `?k=`)。
- **导出的分母 = `corpus.txt` 的 579,368**(`export_cases.mjs` 默认只读它,`CORPUS` 可给逗号
  分隔清单覆盖,抽样跑时用)。
- manifest 落 `incremental/`,**仅灌库成功后**才落盘;想强制全量重灌就删它。**按目标库分开存**
  (线上 `pg_lsll_manifest.tsv` / 本地 `pg_lsll_manifest_local.tsv`)—— 一份 manifest 复用到两个库,
  会让先灌过本地的那批在灌线上时被判「无变化」跳过,线上永远缺那几行(2026-07-28 踩过,缺 400 行)。
- CSV 与 manifest 都是生成物,**不进 git**(全量 ~10 MB + ~7 MB,每跑一次全变);要重建就重跑导出。
- **没跑完也能灌**:缺的 case 端点返 `{status:'pending'}`,页面显示「计算中」。
- 线上灌库的密码由服务器端自己从 `/root/core-api/.env` 读,脚本里没有凭据。
- `-Local` 走容器内 psql(本机没装客户端),会顺手把 migration 0094 灌进 pg13(幂等)。
- 全量 579,368 行的量级:CSV ~55 MB,PG 表 + 主键索引 ~80 MB。`/v1/alg/lsll/dist` 那句
  `GROUP BY htm` 是全表扫(单 case 查询走主键,不受影响),灌满之后如果嫌它慢,加
  `CREATE INDEX ON lsll_cases (htm)` 让它走 index-only scan;端点本身 `s-maxage=86400`,
  正常一天只穿透一次。

## 下游(已接)

- API `GET /v1/alg/lsll/case/:key` → `{ htm, qtm, exhaustive, algs }`;未回填返 `{status:'pending'}`。
  另有 `GET /v1/alg/lsll/dist` 给步数直方图。
- 页面 `/alg/lsll/case?k=` 的「HTM 最优解」区显示它,`exhaustive=false` 时明写
  「只有一条最优解,QTM 并列未穷尽」。

**相位:库里那条解落在 16 个像里的哪一个是算出来才知道的**,通常不是展示相位。所以前端分两个
出口(`lib/lsll/optimal.ts`):

- `optimalSetup` —— 直接取逆,**最短**,相位随缘。训练器用它:各处的图都从实际打乱渲染,
  跟着转就行,何况出题本来就带随机 post-AUF。
- `setupForPhase` —— 取逆后补首尾 AUF 摆到 `displayState`,长度 +0~2。case 页用它:
  那里的图要和浏览页缩略图对得上,相位不能飘。页面会把多出来的步数明说。

语料本身仍钉在展示相位(第一段拼完枚举 16 种 AUF 钉过去,第二段拿展示相位的态回溯),
纯粹是为了回放校验有个确定的比对目标 —— 求解阶段既然要展开 16 个像,基准相位是哪个已无所谓。
