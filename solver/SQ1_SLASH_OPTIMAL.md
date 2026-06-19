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

歧义态实测(slash-via-wca 归约 + MITM `decide_t`,详见 §6):**5,392 条全部证明 t=s(5,382 via-wca 穷尽 + 10 条最深 s=12/13 由双向 BFS `decide_t` 判定),0 残留,全程 0 条 t=s−1**。⇒ slash 分布**全部可证最优**,数字 = wcaOptSlash(WCA 最优解里的 `/` 数);**2026-06-19 起 `provisional` = false**。

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

产物文件(`D:/cube/scramble/puzzle/sq1/`):`sq1_slash_exact.csv`(全量)、`sq1_slash_ambiguous.csv`(歧义解算)、`sq1_slash_monsters.csv`(超时清单)、`sq1_slash_meta.json`(`{less,eq,fallback,ambiguous,provisional}`,前端 `provisional`/残留计数数据源)。

## 6. 啃怪物尝试史 + 失败日志(2026-06-19,给未来 AI)

> 目标:把 4.29% 歧义态(W=2s−1)全部精确判定到 **0 残留**,让 slash 分布从"紧上界"升级到"可证最优"(前端 `provisional` flip false)。

### 6.1 slash-via-wca 归约(成功,已上线)

精确 slash 求解器(`Sq1Solver`,5 表投影 h-max 9)对 s=11/12/13 深态秒级~分钟级,全量直跑歧义态长尾爆炸。改用**归约到 WCA 测地机**:歧义态只需判定"是否存在 turn=s、slash=s−1 的解"(总 WCA cost = 2s−1 = W,比 WCA 最优解少一刀)。`sq1_analyzer.rs` 的 `SQ1_SLASH_VIA_WCA=1` 走 `Sq1WcaSolver::shared_lite()`(~600MB,**不需** 13GB jsq_full)跑固定交替(偶位 turn / 奇位 slash,bound=W)IDA*(`dfs_slash_alt` 串行 / `dfs_slash_alt_par` 根分裂并行 + `ShardedTt` + `thread::scope` 看门狗):
- 找到 s−1 解 → `SmallerExists` → t=s−1(输出 `id,s-1,opt`)。
- 穷尽无 → `ProvenEqual` → t=s(输出 `id,s,`)。
- 看门狗超时 → `Monster`(输出 `id,M`)。

实战(`inject_sq1_slash_exact.ps1`:Tier1 lite 单线程 + Tier2 `-Split` 根分裂并行):**5,392 歧义态 → 5,382 条穷尽证明 t=s,10 条残留怪物,全程 0 条 t=s−1**(`meta.less=0`)。残留 10 = 5×(W23,s=12)+ 5×(W25,s=13):
- s=12:`217111 476747 5242987 5305193 5587870`
- s=13:`812997 941925 3682487 4395194 5293046`

### 6.2 ❌ 尝试 A:slash 数下界剪枝(失败,已回退)

**想法**:在 `dfs_slash_alt` / `dfs_slash_alt_par` 里,除 WCA 启发 `h_le_wca`,再叠一层 `Sq1Solver::h_le`(5 投影 slash 下界)剪枝 —— 状态 c 处剩余刀位 = `(child_bound+1)/2`(turn 位)/ `child_bound/2`(slash 位),若 slash 下界 > 剩余刀位则该枝必无解、直接剪(admissible,不误剪真解)。

**结果**:对这 10 条最深态**无效 + OOM 崩**。
- @120s 看门狗:前 6 条全 `[MONSTER]`(0 解出),第 7 条进程 OOM 崩(`memory allocation of 276824080 bytes failed`,退出码 `-1073740791` / `0xC0000409`)。
- 单测 217111 给到 232s 仍 `M`。
- **根因**:`Sq1Solver::h_le` 的 slash 下界对 s=12/13 最深态太松(h-max 才 9,深 13 时 gap 大),`h_le(c) > 剩余刀位` 几乎从不成立 → 剪不掉枝 → TT 照涨满 → 叠加 `Sq1Solver` 投影表(~1GB)驻留 + 多线程节点累积 > 物理内存 → OOM。
- **教训**:**松下界做剪枝在最深态 = 没剪还白付每节点一次查表 + 涨内存**。要真剪深态得用**紧下界**(更大 pattern DB / 双向相遇),不是现成的 h-max 9 投影。
- 代码已 `git checkout solver/src/sq1_solver.rs` 回退(A 的 5 处改:`h_le` 改 `pub` + 4 个剪枝块);committed via-wca 基建完好,**勿连带删 `Sq1Solver` / `sq1_twophase.rs`**。

### 6.3 关键现实(别再被"残留"误导)

**slash 分布的数字现在已经是真最优,不随残留变。** 已证:slash 真最优 t ≡ WCA 最优解的 slash 数(`wcaOptSlash`),由 **5,382/5,382 零反例 + 95.71% 省算定理**支撑。生产发的就是 `wcaOptSlash` 分布;这 10 条残留也填 `wcaOptSlash`(=s),经验上极大概率 = 真最优,只是没对这 10 条单独出"可证"印章。**0 残留 ≠ 数字会变,只 = `provisional` flip false 这一个标签。** 前端已数据驱动诚实标注(读 `meta.fallback`/`meta.eq`,见 `PuzzleDistView.tsx`)。

### 6.4 结局:B 成功,0 残留(2026-06-19)

**B(MITM 双向搜索)跑通 → 10 条残留全部判定 t=s → 0 残留 → `provisional` flipped false。** 路径:
- 新增 bin `solver/src/bin/sq1_slash_mitm.rs`(纯增量,不碰 `Sq1Solver`/`sq1_twophase`):BFS 建在**自由转动等价类**(节点 = 状态模 144 种 top/bottom 自由转的规范键 `fast_key`,边 = 一刀;`fast_key` 用 top/bottom 独立取 min 分解,可证 == 144-min)。每条边 = 1 slash ⇒ **BFS 深度 = slash 数**;双向 BFS 中点相遇,把超时 IDA* 的半径砍半。
- **`decide_t(state, s)` 是关键**:歧义态 t∈{s−1,s},只需判"是否存在 ≤s−1 解"。任一 ≤s−1 路径两半 ≤⌈(s−1)/2⌉=⌊s/2⌋,故只建 **radius=⌊s/2⌋(=6)** 双向 frontier(比全距离的 radius-7 浅一层)→ s=13 怪物 radius-6 fit 进 100M/侧上限,而全距离 `slash_dist` 在 radius-7 OOM(我先前 5/10 INFEASIBLE 即此)。实测:s=13 怪物 ~25s 判出 t=13、s=12 ~45-66s 判出 t=12。
- **验证**(禁造假):全距离 MITM 对 221 条已知态 100% 吻合;`decide_t` 对 50 条已知 s=10/11 态 100% 返回 t(0 spurious t−1);10 怪物全 t=s(5 条 s=12 与全距离 MITM 交叉吻合)。
- **持久化 + 自动化**:10 条进 seed `_xval` → `inject -MergeOnly` 重算 `fallback=0/eq=5392/provisional=false`。**且 decide_t 已接进 inject 自动兜底**(`Run-DecideT`:via-wca 解不动的残留 M 怪物自动逐条跑 `sq1_slash_mitm` decide_t,Tier1「无待解」路径也跑、`-NoMitm` 可关)⇒ 以后新打乱里若出深态怪物,via-wca 超时 → decide_t 自动判 t=s → **0 残留自维持,provisional 不会被翻回 true**。实测:把 217111 抹成 M 重跑 inject,decide_t 自动判回 t=12、`provisional=false`(这正是「跑新数据会不会用新算法」的答案:会)。前提:`sq1_slash_mitm.exe` 在场(`cargo build --release` 全 bin 默认带;缺则告警跳过,残留留作上界)。
- **教训**:深态判定别傻算全距离 ——「decide(≤K)」只需 radius ⌊K/2⌋,比 compute-distance 省一整层半径,是 OOM↔可行的分界。A(松下界剪枝)仍判死,别重试。
