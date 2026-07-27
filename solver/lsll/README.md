# LSLL 批量求解管道

给 `/alg/lsll` 的 **148,384 个 case** 算「整个三阶魔方的 HTM 最优解」。
背景 / 待办见 `core/packages/client/app/[lang]/alg/lsll/PLAN.md`。手动本地管道,非 CI。

## 一键跑

```bash
# 1) 造语料(几秒,只需一次;换了 zbls 库或 model 才要重跑)
cd D:/cube/cuberoot.me/core
NODE_OPTIONS=--no-experimental-strip-types pnpm --filter @cuberoot/client exec tsx scripts/lsll-corpus.mts

# 2) 求解(约 2 小时,可随时 Ctrl-C,再跑接着算)
cd D:/cube/cuberoot.me/solver/lsll
node solve_loop.mjs
```

`solve_loop.mjs` 是**全量入口**:内部反复拉起 `solve.mjs` 直到全量完(cubeopt 跑久了会抛
emscripten `unwind` 把进程带走,每条即落盘所以重启零损失)。别裸跑 `solve.mjs`。

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

`corpus.txt` = `base36key,scramble`,**148,384 行**。

= 站上「两步路线」那批:302 条已收录 ZBLS case × 494 个 ZBLL 收尾 = 149,188 条路线,
去重后 148,384 个 canonical key(804 条撞在一起 —— 6 个 ZBLS 构型自带 pre-AUF 稳定子)。
占全量 583,284 的 25.4%;其余 434,900 个这一轮不算。

打乱**不是**给 148,384 个局面各解一次,而是只解 302 + 494 = 796 次基件,其余全是字符串拼接
(`composeState(zbll, zbls)` ⇒ `setup(zbll) + setup(zbls)`),拼完 149,188 条**逐条回放校验**。
所以打乱长 ~31 步 —— 无所谓,最优解器只关心它到达的局面。

## 输出

`out.csv`,每行 `key,htm,qtm,solution`:

| 列 | 含义 |
|---|---|
| `key` | LSLL canonical key 的 base36(= `model.keyToString`) |
| `htm` | **整方 HTM 最优步数**(确定值) |
| `qtm` | **这一条解**的 QTM(步数 + 半转个数)——**不是**所有最优解里最小的那个 |
| `solution` | 一条 HTM 最优解;它的逆序 = 到达该局面的最短打乱 |

实测分布(600 条均匀抽样):`{9:1, 10:2, 11:11, 12:30, 13:101, 14:240, 15:200, 16:15}`,均值 14.04。

## 引擎

cubeopt / h48 —— 与 `/scramble/solver`、`solver/333opt` 同一套:

- 模块 `core/packages/client/public/cubeopt/cube48opt{1..9}.mjs`(memory64 build)
- 表 `solver/tables/h48/h48prun31h{5,6,9}.dat` = 928M / 1856M / 15.6G(gitignored)

默认 **opt6 + 1856M 表**:一份表常驻,内存占用 ≈ 2G。实测(本机 12 线程,真实 LSLL 语料):

| 表 | 每解 | 全量 148,384 |
|---|---|---|
| opt5 928M | 58ms | 2.4h |
| **opt6 1856M(默认)** | **51ms** | **2.1h** |
| opt9 15.6G | 未测(要 ~16G 空闲内存) | — |

`solver/333opt/README.md` 那张「opt5 43s / opt9 250ms」的表说的是 **18 步随机态**,
和 LSLL 的 12–16 步完全不是一个量级,别拿来外推。表越大越快的趋势仍在,只是差距小得多。

换表:`TABLE=../tables/h48/h48prun31h5.dat MODULE=.../cube48opt5.mjs node solve_loop.mjs`。
换表**不改答案**(最优就是最优),只改速度,所以小表先起跑、内存空了再换大表接着跑同一个
`out.csv`,零重做。

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

## 下游(待接)

PG 新表 `lsll_cases` + API `/v1/alg/lsll/case/:key`,schema 见 PLAN.md「存储」。
`exhaustive` 列在阶段 2 之前一律 false。
