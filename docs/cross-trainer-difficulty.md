# 随机状态来源的「难度」(cross-trainer) — 跟踪

> issue #67。/timer 随机状态来源按「某个阶段的最优步数」直接**生成**打乱,不是从真题里筛。
> 引擎 `core/packages/client/lib/cross-trainer/**`,UI `_components/GenDiffConfig.tsx`,
> 取题 `_lib/scramble/trainer_pool.ts` + `trainer.worker.ts`。

## 0. 目标

1. or18 那 8 个训练器(tools/cross_trainer 等 fork)全部进站本体,性能优于上游。
2. 口径两套都要:or18 的**定色 + 定槽**,以及站内的**底色子集 + 最优槽**(与 /scramble/stats、
   真题难度筛同一口径)。
3. **每个阶段的最小 / 最大步数都要能生成**(例:XCross 0 步与 10 步)。
4. 生成代价 = 用户等待时长,必须小。
5. 方法 / 阶段最终对齐 `/scramble/solver` 的全站词表(整体 / 标准 / 伪 / 基态 / 伪基态 / EO /
   F2LEO / 伪 F2LEO / 砖 / DR × 十字…XXXXCross)。**未完成,见 §7。**
6. 滑块刻度标到**上帝之数**(至少是有实证的下界),抽不出来的那一段置灰而不是不标。

## 1. 已上线

9 个阶段:`std/{cross,xcross,xxcross}`、`eo/eo_cross`、`pair/{cross_pair,xcross_pair}`、
`pseudo/{pseudo_cross,pseudo_xcross}`、`pseudo_pair/pseudo_cross_pseudo_pair`。

- 采样严格均匀:子步坐标均匀 × 其余块均匀补全 = 该最优步数下全体状态上均匀(纤维等势)。
- **帧折叠**:只给规范坐标系(D 面十字、DFR 槽)建表,其余 (底色, 槽) 用 24 个整体旋转换算 ——
  六色中立从 24 次建表降到 1 次。
- 状态 → 打乱文本走 min2phase 的 `INVERSE_SOLUTION`(CI 里验证回代到同一 54 字符)。

## 2. 关键算法:多帧(双色 / 四色 / 六色 / 最优槽)怎么抽

度量是**多个帧上的最小值**,帧之间相关,没有单一坐标可枚举。两个引擎交替跑(`index.ts` 的
`oneFrame`):

| 引擎 | 做法 | 强在哪 | 弱在哪 |
|---|---|---|---|
| A 全局拒绝 | 均匀抽整个状态 → 算各帧最小值 → 落窗口就要 | 窗口盖住分布主体时几乎一击即中 | 稀有档(0 步、极深)命中率天文数字级低 |
| B 条件抽样 | 选一帧 f → 从 f **自己的窗口** `[lo,hi]` 精确抽 → 验证其余帧都不更浅 | 稀有档(尤其 0 步)一次就中 | 窗口宽且靠近众数时,「其余帧不更浅」几乎全被拒 |

B 的无偏性:提案分布是各帧自己窗口的**并集**上的均匀分布(目标集合的超集),同一状态可能有多帧
并列,只有**下标最小**的那帧才接受(canonical representative),所以每个目标状态恰好被产出一次。
超集上均匀 + 只接受子集 = 子集上均匀。

**B 必须抽整个窗口,不能按深度轮询** —— 条件在单个深度上才是精确的,轮询深度等于偷偷给窗口重新
加权,详见 §3 第 5 条。

已知偏差(有意保留):B 的均匀性要求各帧互为共轭、窗口等大。凡是「换个底色 / 换个槽」得到的帧都
满足。**不满足的是两个「最优槽」帧有两种形状的阶段** —— XXCross(4 个相邻槽对 + 2 个对角)和
XCross+配对 —— 它们的层大小从第 2 层起就分家(见 `multi.ts`),对角代表被少抽约 1–2%。

交替 = 最多比更优的那个慢 2 倍,不用给每个阶段调参。

**效果**(实测,表已建好后):

| 组合 | 改前 | 改后 |
|---|---|---|
| 六色 XCross 0 步 | 拒绝采样 8 s 预算耗尽 → 「生成不出来」 | 1 ms |
| 六色 EOCross / XXCross / 基态 / 伪 / 伪基态 0 步 | 同上 | 建表后即时 |
| 双色十字 8 步 | 取不到 | 359 ms |
| 双色 XCross 9 步 | 取不到 | 0.7–2 s |
| 双色伪十字 8 步 | 取不到 | 61 ms |

### 预算是墙钟,不是次数

三处都踩过同一个坑:**用「尝试次数」当上限**。一次尝试的成本从 1 µs(十字)到 1.2 ms
(XCross 配对)差三个数量级,所以任何固定次数要么把便宜阶段的预算浪费掉 2/3,要么把贵的阶段
卡死几分钟。现在:

- 单帧抽样按**时间分块**(`drawFrame`:小块起步 → 计时 → 按剩余时间外推下一块大小),
  上限只是「更多次数也没用」的信号(枚举型阶段直接判空,其余到 20 万次封顶)。
- 多帧外循环没有次数上限,只看墙钟。
- 墙钟从**第一块之后**才起算 —— 第一块付的是建表钱(冷启 XXCross 建表 13.6 s,比整个预算还长)。

## 3. 已修的正确性 bug

1. **伪十字给错难度**:`pseudoCrossDistOf` 无视 `cap`,引擎 A 只判了 `best >= lo` 没判
   `<= hi` → 要 0 步却给 4 步。现在 A 显式判上界,且该函数按 cap 返回 -1。同类问题的
   `std/cross` 的 `frameDist` 也一并按 cap 返回 -1(否则引擎 B 的并列裁决全被拒)。
2. **EOCross 走的是自己那份多色循环**(没有条件层抽样、没有预算上限)→ 改成和其余阶段一样走
   `oneFrame`。`std/cross` 同样收编(它原先的多色循环是纯拒绝采样,取不到双色 8 步)。
3. **冷建表吞掉整个预算 → 池子把「预算用尽」当成「不存在」并永久锁死**。这就是用户截图里那个
   「这个难度组合生成不出来」:XXCross 冷建表 13.6 s > 8 s 预算,`gen` 返回 0 条,
   `trainer_pool` 把 `buf.empty` 置真再也不重试。三处一起修:worker 加 `warm` 指令(建表不计时)、
   墙钟从第一块之后起算、池子只认**证明**(`verdict === 'empty'`)才锁死,预算用尽只报「还在找」。
   隔离验证:同一 spec 表建好后 590 ms 就出题。
   后续修正:独立的 `warm` 请求已撤掉 —— 它没有 supersede,拖动阶段下拉会把每个阶段的建表都排进
   worker 队列(照 §4 的数字,9 个阶段 ≈ 一分钟)挡在用户真正要的那次 `gen` 前面。现在建表就在
   `gen` 内部、采样计时开始之前完成,顺序天然正确。
4. **单帧路径完全没有墙钟**:`pair/xcross_pair` 单色定槽 11 步实测一次抽样阻塞 worker 47.6 s
   (最坏 ~240 s)。现在单帧和引擎 B 的每次尝试都按 §2 分块计时 —— 但**每次 `drawFrame` 的第一
   小块仍在计时之外**,那是有意的(它付的是建表钱)。所以起始块只有 32 次尝试:按最贵阶段
   3.3 ms/次算也就 ~100 ms,再几何增长。
5. **多帧窗口抽样把分布压到了下端**:引擎 B 只对**单个深度**精确,旧版按深度轮询 → 六色十字
   `[4,6]` 抽 3000 次有 2515 次是 4 步(真值 26%),`[0,8]` 几乎每条都是「十字已解」。改成 B 直接
   抽**整个窗口**(见 §2)。回归守卫:`tests/cross_trainer_distribution.test.ts` 用
   `trainerMetric` 当独立 oracle 做 χ² 比对。
6. 多帧抽样的预算改成可传参(`drawTrainerState(spec, rng, budgetMs)`),取题池用短预算,
   离线扫描用长预算。

## 4. 代价实测

单条打乱(表已建好):

| 阶段 | 采样 | + min2phase | 上游 or18 |
|---|---|---|---|
| cross | 0.0 ms | 0.8 ms | ~18 ms |
| xcross | 0.1 ms | 0.7 ms | ~18 ms |
| xxcross | 1.4 ms | 0.4 ms | 13–24 ms |
| eo_cross | 0.0 ms | 0.5 ms | — |
| cross_pair | 0.1 ms | 0.6 ms | — |
| xcross_pair | 0.8 ms | 0.6 ms | — |
| pseudo_xcross | 0.1 ms | 0.8 ms | — |

一次性建表(冷启,worker 里,期间 UI 转圈):cross 0.3 s / xcross 1.8 s / xxcross ~8–14 s /
xcross_pair ~12 s。上游同类:cross 1.4 s、xcross 13.7 s(~630 MB)、xxcross 8.8 s。
建表在 `gen` 内部、采样计时开始之前完成(见 §3 第 3 条),所以第一条打乱要等建表,之后队列已预热。

## 5. 滑块两个上限:`god` 与 `draw`

`lib/cross-trainer/reach.ts` 每格给两个数,回答两个不同的问题:

- **`god`** — 这个难度**存在**吗?刻度轴到此为止。
- **`draw`** — 这个难度**抽得出来**吗?超过它的刻度照画,但置灰不可选
  (`RangeSlider` 新增 `softMax`)。

### `god` 的来源:站内语料,不是估计

`stats/scramble/distribution.json` 八个数据集里该 (阶段, 底色档) **实际出现过**的最大值 ——
每个数字背后都有真实状态,所以是「至少能到这么深」的证据。八个集合里最关键的是
`xcross_2_col_10f`:**定向收集**的 127 万条「单白 XCross = 10 且单黄 XCross = 10」硬打乱
(`/zh/scramble/solver?dset=xcross_2_col_10f`),深端几乎全靠它撑起来。

重新生成(distribution.json 更新后重跑,把输出贴回 `reach.ts` 的 `TRAINER_GOD`):

```python
import json
d = json.load(open('stats/scramble/distribution.json', encoding='utf-8'))
SUB = {1: list('BGORWY'), 2: ['WY','BG','OR'], 4: ['BGOR','ORWY','BGWY'], 6: ['BGORWY']}
KEYS = [('std','cross'),('std','xcross'),('std','xxcross'),('eo','eo_cross'),
        ('pair','cross_pair'),('pair','xcross_pair'),('pseudo','pseudo_cross'),
        ('pseudo','pseudo_xcross'),('pseudo_pair','pseudo_cross_pseudo_pair')]
for var, st in KEYS:
    out = []
    for n in (1, 2, 4, 6):
        mx = -1
        for sv in d['sets'].values():
            row = sv['variants'].get(var, {}).get('data', {}).get(st)
            if row:
                mx = max([mx] + [row[s]['max'] for s in SUB[n] if s in row])
        out.append(mx)
    print(f"  '{var}/{st}': {out},")
```

口径说明:distribution 的 XCross 一族是**四槽取最优**,定槽只会更深或相等,所以同一个数字对
`fixed` 也是合法下界。

刻度轴的顶取三种证据里最强的一条:**语料里出现过**、**我们自己抽出来过**、或者这一格**被穷举
过**(`reach.ts` 的 `FRAME_MAX_VERIFIED`:单色 + 定槽是单帧,若该阶段有全空间距离表 / 完整 BFS
就直接知道直径)。反过来,`XXCROSS_MAX_DEPTH = 13`、`XPAIR_MAX_DEPTH = 11` 这类**只当搜索上界
用、从没被枚举验证过**的常数不算证据 —— 拿它画刻度等于告诉用户「13 步的 XXCross 存在」,而
`multi.ts` 自己就写着那个数没验证过。那两个阶段照样退回语料证据(12 / 11)。

### `draw` 的来源:实测

定义:**按线上预算(`GEN_BUDGET_MS` = 3 s)连抽 5 次都中**的最大步数。重新测量的探针脚本原样留在
本文件末尾附录 A —— `god` 那半有脚本可复现,`draw` 这半也得有。

守卫 `tests/cross_trainer_reach.test.ts`:每个 (阶段 × 四个底色档 × 槽档) 的**上下两端**都要抽出
来,预算就用线上的 3 s,失败允许重试 3 次 —— 这正是取题池的行为(`MAX_TRIES` 批之后才报「太
稀有」),所以测的是用户真正会遇到的契约,而不是一个放宽过的版本。槽档只测 UI 真能选到的组合:
定槽只在单色下出现(多色时面板直接隐掉槽选择器)。

### 关键结论

- **双色底 XCross 10 步存在**(整个 `xcross_2_col_10f` 语料都是),但均匀抽样撞上它约 1e-8,
  给 30 s 也抽不出来 → 标到 10、9 以上置灰。
- 六色 XCross 10 步在该语料里只有 23/1,271,727 条 → 同样置灰。
- 六色十字 8 步在真题 1.3M 条里 0 次,在硬语料里 968,351 次 → 存在,但要「所有六色同时最深」,
  引擎 B 也撞不上。
- 反过来,**下界恒为 0**:引擎 B 直接构造「该阶段已解」的状态,任何底色档都是即时。

## 6. 还没做到的:方法 / 阶段词表

`/scramble/solver` 的方法下拉有 10 项,难度面板目前只有 5 项、9 个阶段。差距:

| 方法 | 阶段 | 现状 | 客户端引擎与实测单帧成本 |
|---|---|---|---|
| 标准 | cross / xcross / xxcross | ✅ 原生 TS | — |
| 标准 | xxxcross | ❌ | `CrossSolverWasm.solve_face` 中位 34 ms(需 `pt_cross_C4E0`,gz 21 MB → 内存 54.7 MB) |
| 标准 | xxxxcross | ❌ | 同上,中位 615 ms / p90 2.9 s / 最坏 3.8 s |
| EO | eo_cross | ✅ 原生 TS | — |
| EO | eo_xcross…eo_xxxcross | ❌ | `VariantSolverWasm`,**无单帧入口**,最小单位是 6 视角网格;xxxcross ≈ 0.7 s/帧 |
| EO | eo_xxxxcross | ❌ | 9–63 s/帧(网格 212 s)—— 光测量就超预算,不可行 |
| 基态 / 伪 | cross / xcross | ✅ 原生 TS | — |
| 伪基态 | cross(`pseudo_cross_pseudo_pair`) | ✅ 原生 TS | — |
| 伪基态 | xcross(`pseudo_xcross_pseudo_pair`) | ❌ | `VariantSolverWasm`,无单帧入口 |
| 基态 / 伪 / 伪基态 | xxcross / xxxcross | ❌ | `VariantSolverWasm`;伪基态 xxxcross 9.6–57 s/帧,不可行 |
| F2LEO / 伪 F2LEO | cross…xxxcross | ❌ | `VariantSolverWasm`,建表 4.2–4.9 s,xxxcross 1–6.6 s/帧 |
| 砖 | 122 / 123 / 222 / 223 / F2B | ❌ | `Roux223SolverWasm` 建表 2.87 s;**F2B 每条 ~3 s(无缓存,IDA*)** |
| DR | dr | ❌ | `EoDrSolverWasm` 建表 442 ms,测量 ~2 ms/帧 |
| EOLine | eo / eoline | ❌(数据层变体,UI 并入 EO) | 同上,≤1 ms |
| 整体 | 333 | ❌ | **无可用客户端引擎**:cubeopt 要 SAB + COOP/COEP(全站只有 /scramble/solver 发),表 30 MB–15 GB;或走登录态的服务端 SSE |

(以上成本由 `wf_b4b6d65f-1c0` 工作流在本机 Node 实测,浏览器桌面 ≈1–1.5×,手机 3–5×。)

### 路线分层

- **T1 原生 TS(精确层 + 双引擎)** —— 现有 9 个阶段的做法。两端都能取到,微秒级。
  下一批适合走 T1 的:**纯 EO**(坐标 2048)、**EOLine**(2048 × 132 = 27 万)、
  **block222**(1 角 + 3 棱 ≈ 25 万)—— 都是一次 BFS 就全枚举,和十字同级便宜。
- **T2 WASM 测量 + 拒绝采样** —— 只覆盖分布主体,稀有档靠 §5 的 `god`/`draw` 如实置灰。
  适用:DR(2 ms/帧)、标准 xxxcross(34 ms/帧)。
- **T3 暂不提供** —— 光测量一帧就超预算的:标准 xxxxcross、eo_xxxxcross、伪基态 xxxcross、
  砖 F2B、整体。面板里不列,而不是列出来再报错。

> 注意 `dr` / `htr` / `htr2` / `fr` 在 StageSolver 里是**条件式阶段**(输入必须已处于该视角的
> DR/HTR,否则返回哨兵值),不能直接当任意随机态的难度轴 —— DR 方法要用的是
> `EoDrSolverWasm` 的「到 DR 的最优步数」,不是那几个条件阶段。

## 7. 待办

- [x] 可达区间表 → 滑块上下限(按 阶段 × 底色档 × 槽档);不可达刻度置灰。
- [x] 建表预热:选中阶段就在 worker 里开始建,别等第一条打乱。
- [x] iframe 里不再注入 CubeRoot logo(`tools/assets/js/logo_nav.js`:`window.self !== window.top` 直接 return)。
- [ ] **T1 扩展**:纯 EO / EOLine / block222 三个原生阶段(方法下拉多出「砖」)。
- [ ] **T2 扩展**:DR、标准 xxxcross(worker 里挂 `cross_solver_bg.wasm`)。
- [ ] 深端真抽出来:双色 / 六色 XCross 9–10 步现在是置灰。可行方向是**从硬语料反推构造**
      —— `xcross_2_col_10f` 那 127 万条是被定向收集出来的,同样的收集器可以在离线管道里
      预生成一批深档状态随打乱包下发,而不是让浏览器现场撞运气。
- [ ] `f2leo` / `pseudo_f2leo` / `整体`:等有便宜引擎再说,现在如实不列。

## 8. 决策记录

- **不做独立训练器页面**:功能全部落在 /timer 的难度面板(用户明确要「界面就 1」)。
- **不用真题筛代替生成**:真题库里没有的档(六色 0 步)必须能出,只有生成做得到。
- **不给用户看假打乱**:窗口取不到时显示提示,绝不塞一条别的难度的打乱冒充。
- **滑块标到上帝之数、置灰不可达**,而不是干脆不标 —— 不标会让人以为站内认为它不存在。
- **「预算用尽」永远不等于「不存在」**:只有「所有单帧层都空」才是证明,才允许锁死提示。

## 附录 A. 重新测量 `draw`

放回 `core/packages/client/tests/_probe_reach.test.ts` 跑一次,输出在 `.tmp/reach_measured.txt`,
把 `###` 那些行贴回 `reach.ts` 的 `DRAW`。跑完删掉探针(它不是断言,不该留在 CI 里)。

```ts
import { describe, expect, it } from 'vitest';
import { drawTrainerState, trainerCaps, trainerStagesOf, trainerVariants } from '@/lib/cross-trainer';
import { TRAINER_GOD } from '@/lib/cross-trainer/reach';

const BUDGET = 3000;                       // = GEN_BUDGET_MS
const SUBSET: Record<number, string> = { 1: 'W', 2: 'WY', 4: 'BGOR', 6: 'BGORWY' };
const CONFIRM = 5;                         // 连中 5 次才算这一格能交付
const COUNTS = [1, 2, 4, 6] as const;

describe('reach measurement', () => {
  it('deepest depth deliverable in five consecutive draws', async () => {
    const { writeFileSync } = await import('node:fs');
    const lines: string[] = [];
    const emit = (s: string) => { lines.push(s); writeFileSync('.tmp/reach_measured.txt', lines.join('
')); };
    for (const variant of trainerVariants()) {
      for (const stage of trainerStagesOf(variant)) {
        const caps = trainerCaps(variant, stage)!;
        const god = TRAINER_GOD[`${variant}/${stage}`];
        const modes: Array<'fixed' | 'best'> = caps.slots ? ['fixed', 'best'] : ['best'];
        const row: Record<string, number[]> = {};
        for (const mode of modes) {
          const got: number[] = [];
          for (const n of COUNTS) {
            const ceiling = Math.min(caps.range[1], mode === 'fixed' && n === 1 ? caps.range[1] : god[COUNTS.indexOf(n)]);
            let best = -1;
            for (let d = ceiling; d >= 0; d--) {
              let ok = 0;
              for (let k = 0; k < CONFIRM; k++) {
                const r = drawTrainerState(
                  { variant, stage, colors: SUBSET[n], slot: mode === 'fixed' ? 0 : 'best', lo: d, hi: d },
                  Math.random, BUDGET,
                );
                if (r.ok && r.depth === d) ok++; else break;
              }
              emit(`${variant}/${stage} ${n}c/${mode} @${d}: ${ok}/${CONFIRM}`);
              if (ok === CONFIRM) { best = d; break; }
            }
            got.push(best);
          }
          row[mode] = got;
        }
        emit(`### '${variant}/${stage}': { fixed: [${(row.fixed ?? row.best).join(', ')}], best: [${row.best.join(', ')}] },`);
      }
    }
    expect(lines.length).toBeGreaterThan(0);
  }, 3_600_000);
});
```
