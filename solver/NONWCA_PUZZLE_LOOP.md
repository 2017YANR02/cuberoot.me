# 非 WCA 小魔方求解器 Loop — backlog + 协议

> `/loop 继续造小魔方求解器`(别名「造非 WCA 求解器」「继续造 puzzle 求解器」)的**单一事实源**。
> 每轮**先完整读本文件**,按 §0 协议推进 §1 backlog 下一个未完成单元,干完更新本文件(打勾 + §2 日志 +
> 必要时 §3)。
>
> 这是**纯 TS** 路线(Ivy 范式),跟 `solver/SOLVER_LOOP.md`(Rust 引擎 + WASM + 大表 + 真题管道)是
> **两条独立 loop**,别混。范本代码 = `packages/client/lib/ivy-solver.ts` + `_IvySolver.tsx` +
> `gen/_svg/ivy_svg.ts` + `stats/_components/IvyDistView.tsx`;造每个单元前**先调 skill `new-substep-solver`
> 读 §0 七步**。
>
> 目标:给 `/scramble/gen` 的非 WCA 魔方(`lib/cstimer-scramble.ts` 的 `CSTIMER_EVENTS`,除 ivy 外 29 项)
> 依次造在线求解器 —— **能整解最优就最优,实在做不动才近最优**。
>
> 用户决策(2026-06-20 锁定):范围 = TIER A→B→C 全做(都是最优 / 单实例最优);**TIER D(大型近最优)
> 开工前 `⏸ soft-gate` 停一次问范围**。提交 = 自动 commit **不 push**。真题 / 全量发布不在 loop(本路线
> 多为全空间自生成,无管道;少数采样分布的发布留 §3 MANUAL)。

---

## §0 LOOP PROTOCOL(每轮照做)

1. **读本文件全文**。在 §1 自顶向下找第一个未打勾任务(尊重 TIER 顺序:A→B→C→soft-gate→D)。
2. **遇到 `⛔ GATE` / `⏸ soft-gate`**:**停 loop,不 ScheduleWakeup**。§3 写清要用户拍板的取舍,正文一句话摘要,等用户。绝不擅自跨过。
   ⚠ `📦 MANUAL` **不是 gate** —— 它是「loop 跳过这条、§3 留交接、继续下一个」(采样分布灌注/发布留用户),别当 gate 停住。
3. **否则把该单元整体派给一个 fresh 子 agent**(`Agent` 工具,general-purpose)。**主 loop 不亲自写求解器代码 / 不读大文件**——只给子 agent 一段自包含 prompt:
   - 「读本文件 §4 共享套路 + §1 的 <单元> 条目 + 调 skill `new-substep-solver`(§0 七步)」
   - 本单元的档位(A/B/C/D)+ cstimer 源码指针(移动语义照抄)+ 验收门(§0.4)+ 提交规则(§0.5)
   - 要求干到验收门过、自行 commit,**只回 ≤20 行摘要**(改了哪些文件 / 门过没 / commit 短 hash / blocker)。
   - UI 验收(playwright)可单独派子 agent,**只回关键断言**(预览是否渲染、native↔参照是否一致、有无 console error),**绝不回 DOM snapshot**。
4. **验收门(按档,全过才算成)**:
   - **求解器 lib**(`pnpm --filter @cuberoot/client exec vitest run tests/<puzzle>_solver.test.ts` 绿):
     - **A/B 档**:独立 BFS 交叉验证最优性 + **全枚举计数 == 全空间分布**(照 `ivy_solver.test.ts`);God's number 锁 `toBe`。
     - **C 档**(单实例最优):随机 N 条打乱,solver 长度 == 独立 IDA\*/参照最短;`scramble∘solution = solved`。
     - **D 档**(近最优):有效性必验(`scramble∘solution = solved`)+ 长度 ≤ 文献已知上界 / cstimer 同口径;最优性不强求,但要记录与已知最优的差距。
   - **typecheck**:`pnpm --filter @cuberoot/client typecheck`(tsgo)EXIT=0。
   - **UI**:playwright 开 `127.0.0.1:3000/scramble/solver?event=<id>` 桌面 + 390px,0 console error,**预览渲染**(solved 自证:纯色 / 复原态),分布页 `?event=<id>` 渲染。dev server 不在 `127.0.0.1:3000` → UI 验证标 §4 欠账继续,**绝不自己 `pnpm dev`**。
5. **提交(子 agent 在单元内做)**:`git add` **只加本单元改动的文件**(别 `git add .`),commit(英文 message,结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`),**不 push**。跳过了 UI 门 → message 前缀 `[untested-ui]` + §4 登记。
6. **更新并提交本文件**:勾掉任务;§2 追加一行(日期 + 单元 + commit 短 hash);有采样分布灌注/发布 → §3 MANUAL;有测试欠账 → §4。然后 `git add solver/NONWCA_PUZZLE_LOOP.md` 单独 commit(主 loop 自己做)。
7. **决定下一步(Ralph:跑到底)**:
   - **还有未 gate backlog** → `ScheduleWakeup`(self-paced ~150–240s;有后台 build/test 则对齐),**原样回传同一条 /loop 指令**。这是常态。
   - **完成信号:全打勾 / 下一个是 `⏸ soft-gate(TIER D)`** → **停**,正文给收尾总结。
   - **红灯**(验收门真跑两次仍不过)→ 停,§3 写失败摘要,等用户。
   - **安全网**:单 session 连续推进 ~15 个单元仍没到完成信号 → 停一次,提示 `/clear` 重 `/loop` 续。
8. **上下文防腐(主 loop 一直瘦)**:真相只在 git(代码)+ 本文件(进度/决策),从不靠「记得」;每轮读文件重建状态。重活全在 fresh 子 agent 里干完即弃;派发给子 agent 的 prompt 要短(详细 spec 写进 §1 条目 / §4),只给指针。

---

## §0.5 分档判据(每个 puzzle 开工先定档)

> 态数**先信 §1 条目里的估值,但子 agent 必须在测试里用独立 BFS / 闭包实算核实真实可达态数**(照 Ivy:
> 别信记忆/估值,枚举为准)。移动语义**必须逐字段照抄 cstimer 源**(`tools/cstimer-scramble/scramble/*.js`),
> 否则 cstimer 生成的真打乱解不了。

| 档 | 判据(可达态数) | 做法 | 分布数据 | 下载 |
|---|---|---|---|---|
| **A 浏览器现场全 BFS** | ≤ ~2×10⁶ | 进页一次性 BFS 整图 memoized,查表 O(深度) 最优 | 全空间精确直方图 | 全部状态 CSV(按最优步数分类)+ 单步数 txt |
| **B build 时预算表** | ~2×10⁶–~5×10⁷ | Node/TS build 出距离表 → 发 `stats/scramble/opt_<p>.bin.gz`,页面查表;现场 BFS 实测 >~1.5s 才落表 | 全空间精确直方图 | 同 A;**态数 >~2M 时「下载全部」CSV 会很大** → 默认给单步数 txt + 注明总量,CSV 设上限 / 异步流式 |
| **C 单实例 IDA\*** | 巨大但单条可证最短(滑块类) | 每条打乱 IDA\* + 可采纳启发式(15p 用 walking-distance),无全表 | **采样**直方图(随机 N 条解后分桶) | 不提供全状态(无法枚举);可下载样本 |
| **D 近最优** | 巨大且无优雅最优(大型扭转 / jumbling) | reduction / 两阶段;**random-state 的可直接复用 cstimer 自带 solver 当引擎** | 采样直方图 | 同 C |

**档边界 puzzle**(`gear` 12.4M / `ctico` ~1e8 / `cm3` ⚠):先按上一档现场 BFS 试跑,实测慢 / 态数超阈再降一档落表。子 agent 自行实测决定,在 §1 条目旁记真实态数 + 选定档。

---

## §1 BACKLOG(有序,自顶向下:A→B→C→soft-gate→D)

> 每条:`event id`(`CSTIMER_EVENTS` 的 id)/ 中文名 / cstimer 源 / 估态数 / 档 / 备注。
> ⚠ = 态数估值,子 agent 实算核实后回填。

### TIER A — 现场全 BFS 最优(易,Ivy 范式直接套)

- [x] **A0 基础设施:非 WCA 项目分组选择器** —— 30 项塞不进现有 `SolveTabs` / `WcaEventSelector` 图标行。子 agent 设计可扩展的二级入口(建议:WCA 求解器留图标行,非 WCA 走一个分组下拉 / 「更多魔方」分类选择器,同款复用于 `/scramble/solver` 与 `/scramble/stats`)。门:typecheck + playwright 选择器在桌面/390px 可用、能切到 ivy。**这是后续所有单元的接线前提,先做。** ⚠ 设计可改,子 agent 给一句话理由即可,别 gate。
  完成 2026-06-20(commit `6265c3671`,UI 门欠账见 §4)。落地 = `components/NonWcaPuzzlePicker`(「更多魔方」分组下拉,按 family 分组),数据驱动自 `lib/cstimer-scramble`(每 event 加 `family` + `solvable`;A1+ 只翻 `solvable:true` 即自动出现,免改 UI)。WCA 求解器留图标行,ivy 移进分组下拉作 proof,`?event=ivy` URL 不变。
- [x] **A1** `133` 1×3×3 花型 — `1x3x3.js`。move R L F B,每面单 180° 转(自逆),无 power/primes。
  完成 2026-06-20(commit `7a2a56243`)。**实测可达态 = 192**(独立 BFS 枚举;非条目原估的 6,144 —— 那是 cstimer 内部 24×16×16 编码空间,真实闭包受 perm-parity == flip-popcount-parity 约束砍半 = 24×16/2 = 192)。**上帝之数 8**,均值 4.43,直方图 `[1,4,10,24,53,64,31,4,1]`。纯 TS 全图 BFS(memoized),套 Ivy 范式;移动语义逐字段照抄 cstimer `1x3x3.js`(movePieces 2-cycle swap + 逐轴 flip bit)。落地文件 = `lib/floppy-solver.ts` + `solver/_FloppySolver.tsx`(`?event=133` dispatch)+ `gen/_svg/floppy_svg.ts`(U 面 3×3 + 四侧条网图,颜色全由 state 推导 → solved 每面纯色自证)+ `stats/_components/FloppyDistView.tsx`(全 192 态精确直方图 + 自造示例 + 下载全状态 CSV/单步数 txt)+ `tests/floppy_solver.test.ts`(独立 BFS 交叉验证全过 11/11)。**本单元顺带把 A0 遗留未提交的 Ivy proof 文件一并落库**(A0 commit 6265c3671 只提交了 picker 基建,ivy_svg/IvyDistView/_IvySolver/ivy-solver/ivy_solver.css/测试 + 三处共享接线都留在工作树未 commit;A1 的共享接线与 ivy 的交错在同一 hunk,故一并提交保证 fresh checkout 一致)。门:vitest 11/11 绿、typecheck EXIT=0、Playwright UI 验过(solver+stats 桌面+390px、下拉切 133↔ivy、2D 预览渲染、本次改动零 console error)。
- [ ] **A2** `223` 2×2×3 多米诺 — `2x2x3.js`(角 8!=40,320 × 3 中棱态 6 = **241,920**)。move U D(90°)+ R2 F2。
- [ ] **A3** `8p` 八数码 — `slide.js`(9!/2 = **181,440**)。滑块类(非扭转):状态 = 3×3 格排列,move = 空格上下左右滑;最优 + God's number 31 分布;预览 = 数字格(非 net)。
- [ ] **A4** `sfl` 超薄花型(Super Floppy)— `megascramble.js:33`(~1e5 ⚠)。move R/L + U/D 缩减集。
- [ ] **A5** `dino` 恐龙 — `redi.js:119`(cstimer 模型 ~35,640 ⚠;真实 6 色版 19,958,400,**按 cstimer 模型可达态为准**)。move F L B R f l b r(2 power)。
- [ ] **A6** `ufo` UFO — `megascramble.js:34`(~1e6 ⚠)。3 轴 + wheel(A/B/C 旋转)。
- [ ] **A7** `cm2` Cmetrick Mini — `megascramble.js:29`(⚠ 小)。记号 `< > ^ v`。
- [ ] **A8** `dmd` 钻石 — `utilscramble.js:524`(PolyScrambler 通用 solver,~1e6 ⚠)。move U R L F(2 power)。
- [ ] **A9** `sia113` 联体 1×1×3 — `megascramble.js`(⚠ 小)。

### TIER B — build 时预算表(~2e6–~5e7)

- [ ] **B1** `gear` 齿轮魔方 — `gearcube.js`(~12,441,600 ⚠;cstimer 用 IDA* 非全表)。move U R F。**边界**:先试现场 BFS,>~1.5s 就落 `opt_gear.bin.gz`。
- [ ] **B2** `cm3` Cmetrick — `megascramble.js:28`(~1e7 ⚠)。
- [ ] **B3** `233` 2×3×3 — `megascramble.js`(⚠;两大面 180° + 侧 90°)。
- [ ] **B4** `sia123` 联体 1×2×3 — `megascramble.js`(⚠)。
- [ ] **B5** `sia222` 联体 2×2×2 — `megascramble.js`(⚠)。
- [ ] **B6** `ctico` 二十面体(Icosamate)— `utilscramble.js:568`(~1e8 ⚠,**B/D 边界**)。子 agent 实算:超 ~5e7 则降 D 档近最优。

### TIER C — 单实例 IDA* 最优

- [ ] **C1** `15p` 15 数码 — `slide.js`(16!/2 ≈ 1.05×10¹³,太大无法全表)。每条打乱 IDA* + **walking-distance** 启发式出可证最短;God's number 80;采样直方图。预览 = 4×4 数字格。

### ⏸ soft-gate(TIER D)

> **跑完 A/B/C 后停,问用户:** 下面 14 个大型扭转 / jumbling 魔方都只能**近最优**,且**每个是独立中型工程**
> (各要自己的 reduction 法 / 两阶段表,远超 Ivy 范式)。要不要逐个投入?哪些值得做、哪些只留打乱不做 solver?
> D1(可复用现成 solver)成本低,D2(从零写 reduction)成本高。等用户拍板再开 D 档。

### TIER D1 — 省力:复用现成 solver(soft-gate 放行后)

- [ ] **D1a** `mpyrso` 大金字塔 — `pyraminx.js`(~4.6×10¹¹+,cstimer 自带两阶段 solver)。**直接 wrap cstimer 的 solver** 当近最优引擎,不从零写。
- [ ] **D1b** `crz3a` 疯狂 3×3 — `megascramble.js:27`(标准 3×3 移动集,~4.3×10¹⁹)。**复用站内 3×3 求解器**(kociemba/cubeopt);评估是否值得单开页(可能只是 333 换皮)。

### TIER D2 — 大型扭转,逐个独立工程,近最优(soft-gate 放行后)

- [ ] **D2a** `prcp` 五魔金字塔 — `~1.67×10¹⁷`,reduction/Pochmann。
- [ ] **D2b** `giga` 六阶五魔 — `>1e18`,reduction。
- [ ] **D2c** `sq2` 方块二 — huge,两阶段。
- [ ] **D2d** `ssq1` 超 Sq-1 — huge,两阶段。
- [ ] **D2e** `bsq` 受限 Sq-1 — huge,两阶段。
- [ ] **D2f** `334` 3×3×4 — cuboid reduction。
- [ ] **D2g** `335` 3×3×5 — cuboid reduction。
- [ ] **D2h** `336` 3×3×6 — cuboid reduction。
- [ ] **D2i** `337` 3×3×7 — cuboid reduction。
- [ ] **D2j** `bic` 联体魔方(Bicube)— huge。
- [ ] **D2k** `heli` 直升机 — `>1e8` + **jumbling**,最难。
- [ ] **D2l** `helicv` 弧面直升机 — **jumbling**,最难。

---

## §2 进度日志(每单元一行:日期 / 单元 / commit 短 hash / 一句话)

- 2026-06-20 / A0 / `6265c3671` / 非 WCA 分组选择器 `NonWcaPuzzlePicker`(数据驱动 family + solvable),接 solver/stats 两页,ivy 走分组下拉 proof;typecheck 绿,UI 门欠账。
- 2026-06-20 / A0-review / `6ba92bf18` / 复核 6265c3671:executor 的 typecheck EXIT=0 属实,预警的错误(缺 family / 悬空 SOLVE_EVENTS/SOLVE_APPEND/IVY_DIST_APPEND / 暴露未用导入)均不存在;30 event 全有 family、仅 ivy solvable、守卫测试全绿。唯一清理 = 删 cstimer-scramble 里早已存在的死 i18n 导入。UI 门仍欠账(见 §4)。
- 2026-06-20 / A1 / `7a2a56243` / `133` 1×3×3 花型纯 TS 全 BFS 最优解;实测 192 态(非估 6,144)、上帝之数 8、均值 4.43;套 Ivy 范式接 solver/stats/preview/picker;vitest 11/11 + typecheck EXIT=0 + Playwright UI 验过(零 console error)。**顺带落库 A0 遗留未提交的 Ivy proof 全套文件**(此前 ivy 实现一直只在工作树、从未 commit)。
- 参照基线:`ivy`(2026-06-20,纯 TS 全 BFS,29,160 态,God 8,均值 5.74)= 本 loop 的范式样板。

---

## §3 决策 / MANUAL 交接

- **2026-06-20 立项**:用户要给 `/scramble/gen` 非 WCA 魔方依次造求解器。分档调研结论见正文(A 现场 BFS / B 预算表 / C 单实例 IDA* / D 近最优)。TIER D 整体设 soft-gate。
- **A0 选择器 UX**:30 项非 WCA 魔方的项目入口需分组,默认方案 = 二级分组下拉;子 agent 落地后若觉得别的形态更好可改,§3 记一笔。
  → **采用默认方案**(2026-06-20):`NonWcaPuzzlePicker` = 单个「更多魔方」触发按钮,点开后 popup 按 family 分组(长方体 / 异形扭转 / Square 系 / 滑块 / 联体 / 其他)列项。家族 = 数据驱动,`CSTIMER_EVENTS` 每条带 `family`;只有 `solvable:true` 的才进下拉(当前仅 ivy)。WCA 求解器(5 个)继续走图标行 `WcaEventSelector`,选择器二者并排(solve 页 `.solve-tab-evrow`、stats 页 `.scramble-stats-event-pick` 都改成 flex 容纳)。接线点 = §4 列表里 A0 那条(已实现的:family/solvable 注册 + 分组下拉 + 两页 wire)。**A1+ 接新 puzzle**:`lib/cstimer-scramble` 该 event 标 `solvable:true`(+ 确认 `family`)→ 自动进下拉;再按 §4 加 solver dispatch / stats 渲染分支即可,选择器无需再改。
- (采样分布(C/D 档)的灌注 / 发布 MANUAL 交接,做到时写这里)

---

## §4 共享套路(每个单元照做;详见 skill `new-substep-solver` §0)

**范本文件**(逐个对照抄结构):
- `packages/client/lib/ivy-solver.ts` — 求解器核心(BFS-from-solved 整图 + `solve*` + `*Apply` 状态 + `*ExamplesByLength` + `*AllScramblesByLength`)
- `packages/client/app/[lang]/scramble/solver/_IvySolver.tsx` — 求解器页(仿 `_Sq1Solver`,`?event=` dispatch)
- `packages/client/app/[lang]/scramble/gen/_svg/ivy_svg.ts` — net SVG(颜色全由 solver 状态推导 → solved 纯色自证)
- `packages/client/app/[lang]/scramble/stats/_components/IvyDistView.tsx` — 分布视图(直方图 + 自造示例 + 下载)
- `packages/client/tests/ivy_solver.test.ts` — 测试(独立 BFS 交叉验证)

**七步(Ivy 范式)**:
1. **移动语义照抄 cstimer**(§1 条目给的源文件,逐字段);整图 BFS-from-solved,独立 BFS 交叉验证 god-number 直方图自证正确。
2. **求解器 UI 仿 `_IvySolver`**:接 `/scramble/solver` 的 `?event=` dispatch(`solver/page.tsx` 加分支)+ A0 的分组选择器;批量解复用 `BatchSolvePanel`。
3. **分布数据源按档**:A/B = 全空间精确直方图(数据现成在 solver,无管道);C/D = 采样直方图。接 `stats/page.tsx` 的 `event===` 分支。
4. **示例自造**:枚举每个最优步数档的状态、反推最短打乱当示例(`*ExamplesByLength`),不需要比赛语料。
5. **下载按钮**:A/B 给「下载全部状态」CSV(`optimal_length,scramble`,含 identity 行)+ 单步数 txt;态数 >~2M 见 §0.5 下载策略。
6. **状态图**:net SVG(颜色全由状态推导 → solved 复原态自证)接 `ScramblePreview2D` 的 `HAS_PREVIEW` + dispatch。**非立方体魔方(UFO/Cmetrick/Icosamate 等)没有 WCA net** → 退而用合理 2D 示意 / 复用 cstimer 图像生成 / 实在难就先出文字状态,**别为像素级 net 卡住单元**(预览是软需求,solver+分布+下载是硬核心)。
7. **测试**:见 §0.4 按档验收。typecheck + 守卫(i18n 一律 `tr({zh,en})` / `<T>` / `useT`,**禁** `isZh ? '中' : 'EN'` 文案三元;按钮用真 `<button>` / `AppLink`;CSS 走 theme token,禁硬码灰;puzzle data-color hex 可照 skewb 范例)。

**接线点(加一个非 WCA 求解 puzzle 要改这些)** — A0 已落地后更新:
- `lib/cstimer-scramble.ts` — 该 event 已在 `CSTIMER_EVENTS`(打乱来源 `cstimerScramble(id)`);**给它标 `solvable: true`(+ 确认 `family` 分类对)→ 自动进 `NonWcaPuzzlePicker` 分组下拉**,选择器本身不用改(A0 数据驱动)。
- `solver/page.tsx` — dispatch 加 `event===<id>` 分支(纯 TS 求解器走 `next/dynamic` 懒载,保持分包)。
- `solver/_puzzle-specs.ts` — 若复用 `PuzzleOptimalSolver` spec 范式(Rust WASM 那套)则在此加;纯 TS 自写组件则不进此表(照 ivy)。
- `stats/page.tsx` — `event===<id>` 渲染 `<P>DistView` + 关掉 WCA 专属开关(dataset/merge/timeline,照 `isIvy`/ivy 那段早返回);非 WCA solvable 的项目已被 length-reset effect 跳过(`CSTIMER_SOLVABLE_IDS.has(event)`),无需再改;`distPuzzle` 高亮映射按需加分支。**不再用 `availableEvents.add` / `appendEvents`**(A0 前的旧法,已删)。
- `ScramblePreview2D.tsx` — `HAS_PREVIEW[<id>]=true` + dispatch `renderXScrambleSvg`。
- 新建 `_svg/<id>_svg.ts`、`lib/<id>-solver.ts`、`stats/_components/<P>DistView.tsx`、`solver/_<P>Solver.tsx`、`tests/<id>_solver.test.ts`。

**测试欠账(owed UI)**:
- **A0(2026-06-20,commit `6265c3671`)**:Playwright UI 门当时跳过(内存吃紧)。**已于 A1(2026-06-20,commit `7a2a56243`)补齐并清账** —— Playwright 实测:`/scramble/solver?event=133` 与 `?event=ivy`、`/scramble/stats?event=133` 桌面(1280)+ 390px;NonWcaPuzzlePicker「更多魔方」下拉点开按 family 分组(长方体→1×3×3 花型、异形扭转→Ivy Cube),经它在 133↔ivy 间切换正常;弹层 390px box 右沿 192px 不溢出(viewport 375 内);2D 预览(net)渲染 solved 自证;**本次改动零 console error**(历史里出现过的 `SOLVE_EVENTS is not defined` 经核实是开站旧 chunk 残留,当前源码无该标识符、fresh 导航不复现;另有一条 `Connection closed.` 是 Turbopack RSC dev 流式偶发、reload 即消,均非代码问题)。A0 欠账清。
- **A0 遗留:Ivy 实现从未 commit** —— A0 的 6265c3671 只提交了 picker 基建,ivy 的 6 个实现文件 + 三处共享接线一直留在工作树未入库(repo 任何分支都查不到 ivy-solver.ts)。**已于 A1 commit `7a2a56243` 一并落库**(与 A1 的共享接线交错在同一 hunk),无残留。

**约束(全局规则,别违)**:dev server 永远在 `127.0.0.1:3000`,禁 `pnpm dev`、禁 dev 在跑时本地 `next build`;UI 验证走项目内 Playwright MCP;commit 只加自己的文件、不 push;LF 换行;回复中文。
