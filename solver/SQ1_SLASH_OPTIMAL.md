# SQ1 slash 最优(twist metric)分布 + 求解器

> 2026-06-18。给 /scramble/stats 难度 tab 的 SQ1 增加 **slash 最优** 口径(WCA 12c4 之外的第二口径)+
> slash 最优等价打乱展示。本文档记口径、算法、**95.7% 免搜索的省算**、管道、复现。

## 0. 三种 SQ1 计步口径(别混)

| 口径 | 规则 | 上帝之数 | 求解器 |
|------|------|---------|--------|
| **WCA 12c4** | `(X,Y)` 层转计 1、`/` 计 1 | D_WCA ∈ **[26,27]**(26 本项目经验下界 / 27 = Masonjones twist13 ×2+1 借用) | `Sq1WcaSolver`(13GB jsq_full 表,可证最优) |
| **slash(twist)** | 只数 `/`,层转计 0 | **13**(Mike Masonjones 算,jaapsch.net 收录) | `Sq1Solver`(零盘表 ~43MB,可证最优) |
| face-turn | 层转到另一合法对位 + slash 各计 1 | 31 | 仅作机械正确性锁,不展示 |

⚠️ 旧版前端「slash」列曾 = **WCA 最优解里的 `/` 数**(`opt_scramble` 数 `/`),那是 slash 最优的**紧上界**,不是真 slash 最优。2026-06-18 起改成真 slash 最优。

## 1. 关键省算:95.7% 免搜索(本文核心)

slash 精确求解器(`Sq1Solver`)对深态(s=11/12)**很慢**(~秒级~分钟级/条,5 表投影 h-max 9,深 13 时 gap 大)。直接全量跑 125k = ~100h 不可行。

**省算定理**(由"最优解严格交替 turn/slash"):设 W = WCA 12c4 最优步数、s = 该 WCA 最优解里的 `/` 数、t = slash 最优。则:
- 任一 k-slash 解归约后 WCA cost ≤ 2k+1 ⇒ **W ≤ 2t+1** ⇒ t ≥ (W−1)/2;且 **t ≤ s**。
- **W = 2s**   ⇒ t ≥ s−0.5 ⇒ **t = s 已证明**。
- **W = 2s+1** ⇒ t ≥ s ⇒ **t = s 已证明**。
- **W = 2s−1** ⇒ t ≥ s−1 ⇒ **t ∈ {s−1, s} 歧义**,需精确求解。

全 125,605 真题实测:**W=2s 占 49.75% + W=2s+1 占 45.95% = 95.71% 已证明 t=s**(免搜索,直接用 `sq1_wca_exact.csv` 的 s);仅 **W=2s−1 占 4.29%(5,392 条,全是 s=11/12 深态)** 跑精确 slash 求解器。

歧义态实测:30s 超时下约 **69% 解出、31% 怪物**(回退 t=s 上界,≤ +1)。81 条 groundtruth 全部落在已证明态且 t=s 无一例外;尚无任何 t=s−1 实例(理论上 W=2s−1 的 tie 才可能,极罕见)。

## 2. 求解器改动(analyzer)

`solver/src/bin/sq1_analyzer.rs` + `sq1_solver.rs`:
- `SQ1_EXACT=1` 走 `Sq1Solver`(slash 最优)。叠 **`SQ1_SLASH_SOLN=1`** ⇒ 3 列 `id,slash_exact,opt_scramble`(`opt_scramble` = slash 最优解的逆 = slash 最优等价打乱,SQ1 简写记号,CSV 安全)。默认仍 2 列 `id,sq1`。
- 新增 `Sq1Solver::solve_with_solution_deadline`(墙钟超时→怪物,复用 WCA 那套线程局部 `DEADLINE_*`)。`dfs1` 入口加 `deadline_check()` unwind(p2 在递归前已完整跑完单方形态,不半写 memo ⇒ 不中毒)。`SQ1_SOLVE_TIMEOUT_SECS=N` 生效(>N 秒 → `id,M` 怪物 + `[MONSTER]`)。
- ⚠️ 勿删 `sq1_twophase.rs`(近最优对照)/ `Sq1Solver`(slash 最优,被 WCA 解器共享索引基建复用)。

## 3. 数据管道

**已接进一条龙(2026-06-18,增量自动)**:`update_puzzle_stats.ps1` 的「SQ1 块」(sq1 不在 `$PUZZLE` 注册表,单独处理)增量抽 sq1 语料 → 有新打乱且 13GB `sq1_wca_jsqfull.bin` 在场时,依次跑 `inject_sq1_wca_exact.ps1`(WCA 12c4 精确)+ `inject_sq1_slash_exact.ps1`(slash 最优),两者都只解 delta;无新打乱跳过,表缺失告警跳过。⇒ 用户敲「更新统计」(`update_cross_stats.ps1 -Jobs puzzles`/`all`)即自动刷新 + 发布。**全量历史 backfill 是一次性后台**(下面的手动跑),完成后日常只走增量。

`core/packages/scramble-stats-build/inject_sq1_slash_exact.ps1`(镜像 `inject_sq1_wca_exact.ps1`):
1. 读 `sq1_wca_exact.csv` 分出歧义态(W=2s−1)。
2. 只对歧义态跑 analyzer(`SQ1_EXACT=1 SQ1_SLASH_SOLN=1`,默认 `-TimeoutSecs 30`,分块可续,怪物追踪)→ `sq1_slash_ambiguous.csv`。
3. **合并** → `sq1_slash_exact.csv`(全量 `id,slash_exact,opt_scramble`):证明态派生 t=s + WCA 最优打乱;歧义态用精确解 / 怪物回退 t=s。
   - `-MergeOnly` 只合并(证明态派生 + 已有歧义结果),秒级出基线。
   - 加大 `-TimeoutSecs 120` 重跑可继续消歧义怪物(续跑,只解未决的)。

`build_puzzle_dist.ts`:`PuzzleExactPrimary.slashCsv = 'sq1_slash_exact.csv'`,`alt(slash)` 优先读它的 `slash_exact`(真 slash 最优),缺则回退数 WCA-opt 的 `/`(上界)。
`build_puzzle_examples.ts`:`bucketSlashSq1` 读 `sq1_slash_exact.csv`,`binsAlt` 用真 slash 最优值分桶 + slash 最优等价打乱(`opt_scramble`)。

发布:走一条龙共享发布(`update_cross_stats.ps1 -Jobs puzzles`)或手动 scp `puzzle_distribution.json` + `puzzle_examples.json` 到 static。client `lib/puzzle-distribution.ts` / `puzzle-examples.ts` 的 `V` 已 bump 到 `20260618sq1slashopt`。

## 4. 前端

`/scramble/stats` 难度 tab → SQ1:
- 计步切换 **WCA / slash 最优**(`PuzzleDistView` 的 `sq1Metric`)。slash 视图读 `entry.alt.dist` + `exEntry.binsAlt`。
- 示例「原始 / 最优」切换:slash 视图的「最优」= slash 最优等价打乱(`binsAlt` 第 3 元)。
- 口径说明已改成「slash 最优:只数 /(twist 口径,God 13,可证最优)」。

`/code/solvers`:加 SQ1 条目(WCA 12c4 最优 + slash 最优双引擎)。

## 5. 复现 / 重跑

```pwsh
# 0. 前置:analyzer 已编译 + sq1_wca_exact.csv 已全量(inject_sq1_wca_exact.ps1)
cargo build --release --bin sq1_analyzer -j 14   # solver/

# 1. 跑歧义态 + 合并(默认 30s 超时,~3h 上限,可续)
pwsh core/packages/scramble-stats-build/inject_sq1_slash_exact.ps1 -TimeoutSecs 30

# 2. 想消更多歧义怪物:加大超时续跑(只解未决)
pwsh core/packages/scramble-stats-build/inject_sq1_slash_exact.ps1 -TimeoutSecs 120

# 3. 重生统计 JSON + 发布
cd core/packages/scramble-stats-build
pnpm exec tsx src/build_puzzle_dist.ts
pnpm exec tsx src/build_puzzle_examples.ts
# 发布:update_cross_stats.ps1 -Jobs puzzles(或手动 scp 两个 json 到 static.cuberoot.me)
```

产物文件(`D:/cube/scramble/puzzle/sq1/`):`sq1_slash_exact.csv`(全量)、`sq1_slash_ambiguous.csv`(歧义解算)、`sq1_slash_monsters.csv`(超时清单)。
