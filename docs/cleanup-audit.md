# 全站清理跟进（2026-07-17 审查）

多 agent 全站审查产出的整改 backlog。审查**排除了当时 3 个 AI 在改的 WIP**（整个 `alg/`、`sim/`、`icon/` 树 + timer/wca/lib/server/components 里在改的具体文件），所以这里的每一项都在「已稳定、非 WIP」的代码上。

图例：`[ ]` 待办 · `[x]` 已完成 · `⏸` 暂缓（大重构，等对应 WIP 落定再动，勿碰其他 AI 在改的文件）

---

## P0 大重构 ⏸（等 WIP 落定再动）

- [x] `scramble/stats` 里 **29 个 `*DistView` 组件是复制粘贴** → 已抽 `<EnumeratedDistView>` 基座 + per-puzzle `ENUM_SPECS` 表(`_components/enumerated-specs.ts`),两数据源(js baked / json sampled)一个 hook。25 视图 5,925 行 → 281 行基座 + 559 行 spec 表 + 90 行 `lib/scramble-dist/{stats,download,types}`(替 ~11 份 inline `stats()` + 6 下载 + ~18 份 `DistJson`);page.tsx if-链 25×塌成一个 `ENUM_SPECS[event]` 查表(−491 行)。Bicube/Slide15/SuperFloppy 仍 bespoke(更重 async/confirm),WCA 采样走 `PuzzleDistView`,都在查表下方 fall through。commit `d56fc2dcf8`+`392bef6cad`,Playwright 逐路径 + 全测试 1653 绿。（Sampled 家族早已是 config 驱动的 `PuzzleDistView`,无需再抽。）
- [x] `scramble/solver` **复制粘贴求解器页去重(28 个)** → 抽 `useSingleLineSolve()` hook(`hooks/`,`SolveInvocation` 判别联合分 sync/async 两支,sync 支在 `setTimeout` 里算解以保留"先画 spinner 再阻塞主线程"的原 UX)+ `<PuzzleSolverPage>` 通用组件 + per-file `SolverSpec`。每文件从 ~130–150 行渲染/状态样板塌成 ~50 行 spec,双语 lead/caveat/placeholder/error 文案与 doc 注释逐字保留;spec 一文件一份,`page.tsx` 仍按 event dynamic import 各自 code-split。**分两轮**:①async `SolveState+reqRef` 族 15 个(commit `fd83db196e`+`63c13fe88b`);②首轮按签名漏掉的 **sync `useMemo` 族 13 个**(ivy/gear/heli/helicv/ctico/cm2/cm3/cuboid223/diamond/floppy/slide8/superfloppy/ufo,commit `41fbe6b4ac`)——基座补 `METRIC_FIXED_BOUNDED`/`badgeCap`/`CAVEAT_TITLE_BOUNDED`(有界非最优族)+ 可选 `prewarm` 挂载预热。真 bespoke 只剩 `_Cube3Solver`(1331 行旗舰)、`_Sq1Solver`(自定义可视化)。**CI 棘轮** `tests/scramble-solver-shared-base.test.ts`(登记 `/code/guards`):`_*Solver.tsx` 必须 import `PuzzleSolverPage`,白名单只放 {Cube3,Sq1},新复制粘贴 solver 直接红。typecheck + 全测绿(唯一无关失败=别人未提交的 useHashHighlight)+ 文案逐字保真 diff + safe-chrome 渲染验(ivy 端到端 solve、heli bounded spec)。
- [x] `math/group/page.tsx` **16,508 行 god component**（~92 内联 demo）→ **已拆完**:63 节全搬进 `_components/sections/`,由 `EXT_COMPONENTS` map `dynamic(ssr:false)` 按 slug 懒加载,page.tsx 塌成 **608 行**索引壳,0 个内联 `GTSec`。（审查后由后续几轮完成,见 memory `project_math_group_expansion.md`;下方 P0 深挖 A 节的 33-节清单已作废。）
- [ ] 其它 god component：`components/WcaStatView.tsx`（1290）、`wca/results/page.tsx:122`（1027，4 视图塞一函数）、`FrameCountPage.tsx`（2820）、`components/LandingSearch.tsx`（744）
- [~] **4 个 WCA 统计表页复制同一份脚手架**(`wca/success-rate` + cohort-ranks / all-events-done / grand-slam)。**逐文件核对后否掉「抽 `WcaStatsTablePage` 大模板」**:grand-slam 一家就四轴破格(无分页 / 无 `{rows,total}` 信封 / flag 并进选手格 / champ+RecordBadge 列),泛型表会退化成一堆条件 slot,比现状更难读。**只抽真正字节相同的页头** → `<WcaStatsPageHeader slug title subtitle>`(4 页各删 18 行重复页头,commit `8b6adaf4e1`,Playwright 4 页头逐一验)。剩下 fetch/筛选/列按页保留。`<PersonLink>` 已抽(`components/PersonLink.tsx` + `personHref`;AppLink 会重派 lang 前缀,传裸 path 即可),repoint 12 文件(4 统计表页 + records + MiscTab + ReconPerson/result-watch/ReconSubmit/forum PostCard + CompCard;被别的 AI 的 `git add -A` 并入 commit `3488c8b729`,代码无损已测)。`NameStatsView` 有本地同名助手故留;非 JSX href 串 / router.push / 裸 `<a>`(results/fun-stats/WcaStatView/CompDetailPage/SoloView)与 `<CountryCell>` 未做(comp/timer 是别的 AI WIP)。
- [ ] recon 双播放器合并：`ReconPlayerPane`↔`ReconPlayerCanvas`、`Sq1ReconPlayer`↔`CuberReconPlayer`
- [ ] 无共享 `ModalShell`：Donate/Feedback/Login/AlgCaseMeta 各搓 Escape+overlay → 抽公共壳
- [ ] `/code` intro 三套并存范式（数据驱动壳 vs 28 个 bespoke language/*/page vs algorithms 手写）统一

## P1 跨区收口

- [x] **`getIp(c)` 复制进 21 个后端 route**，都保留可伪造 `X-Forwarded-For` 回退 → 已加共享 `getIp(c)`（`analytics_helpers.ts`，委托权威 `getClientIp`、去 XFF 回退），21 route 删本地 def 改 import，111 调用点不变。server typecheck 绿。**★安全硬化，commit 未 push（需上线才生效）**。**分层防回归**（「立约束要分层」）：写入态 hook `.claude/hooks/block-server-forwarded-for.ps1`（→ `hook-detect-server-forwarded-for.mjs`，实活验证真拦）+ CI 兜底 `tests/server-no-forwarded-for.test.ts`，已登记 `/code/guards`（`_guards.ts` PAIRED_GUARDS）；新 route 再抄回 XFF 回退会被写入即拦 + CI 红。行内 `allow-forwarded-for` 豁免正当用途
- [x] **`lib/name-utils.ts` 与 `lib/cuber-name-display.ts` 重复**（三导出函数字节相同，仅注释差一行）→ 保留有测试的 `cuber-name-display`（测试文件误名 `name_utils.test.ts`,实 import `cuber-name-display`,已改名 `cuber-name-display.test.ts`），repoint 17 消费者、删 `name-utils.ts`。commit `2c1c59140c`,typecheck + 10/10 name 测试绿。（原「暂缓」因 timer AI 改 SoloView;实做时工作区已干净,无撞车。）
- [ ] 内联 `isZh ? '中' : 'EN'` 文案三元 → `tr({en,zh})` / `<T>`。**审查严重低估**：实测 **80+ 处**（非 ~15），密集落在正被改的 `alg/3bld|_roux|skewb-trainer` 树 + 暗锁 `WcaStatView`/`wiki`/`battle_store`，且混着**合法非文案** `isZh`（`'/zh'` 前缀、`u.lang='zh-CN'`、`countryName(t,isZh)` util 参数）不能一刀切。**暂缓**：全站 i18n 迁移撞 3 个 AI 的 alg/timer WIP，应等树静下来单独一轮 + 保留 `<T>` 订阅防切语言不重渲染。注：`code/architecture/arch-data.tsx` 还把旧 `isZh` 三元写成「推荐做法」，与现 CLAUDE.md 矛盾，属过期文案
- [ ] 本地 `t=(zh,en)=>isZh?zh:en` shim **56 文件/66 处** → 先补导出 positional `t(zh,en)` 的响应式 `useT()`，再全仓收敛。**暂缓**：与上条同批(同是 isZh 家族、同撞 WIP)，一次做
- [~] 重复小 util:逐个核对后**多数是伪重复或不该合**——`firstGlyph`(现只 1 份 `lib/first-glyph.ts`)、MBLD decode(现只 1 份 `mbf-average.ts`)已单;`fmtDate` 三份**签名/语义各异**(`epochSec:number` UTC / `Date` **本地时区**(练习热力图必须按本地日,合并会引 bug)/ `iso:string|null` UTC+空守卫),**不该合**;`statsUrl` shared/client 双份是**模块边界**副本(shared 不能 import client `lib/`,注释已写明),且 shared 那份带 Vite 死分支——与下面 viteDev 项同批**暂缓**(触 shared 需 rebuild + 撞 alg WIP);货币格式化实测仅 `support/page.tsx` 1 处真用;`no-store` 字面量是标准 HTTP 头串(client 16 处),抽常量属高扰动低收益,**不做**
- [x] calc 重造的 `EventSelector` → 共享 `WcaEventSelector`。给 `WcaEventSelector` 加可选 `containerClassName`(默认 `'wca-stats-event-selector'`,其 css 全挂该 class 故不渗漏),calc 传 `containerClassName="event-selector"` 让 `calc.css` 奶油纸皮肤接管;calc 侧改薄封装保留 store 接线。commit `c532d71893`,Playwright 验奶油皮肤/绿色选中/废止项展开全一致(tooltip 改为全名 `EVENT_ZH/EN`,与全站其余选择器一致)。
- [ ] `CountrySelect` / `RegionCountrySelect` 半截迁移收尾
- [x] 硬编码色值 → token（部分）：`recognize:273/317` `#adb5bd`→`var(--muted-foreground)` + 同块 `rgba(255,255,255,.15)` hr→`color-mix`。**误报排除**：`recon-utils.ts:244` FACE_COLORS 是十字色块(色字母键+Tailwind 盘)非 UI token、也不等于 face 键的 `cube-colors`,留;`prediction/lucky:213` `#888` 是图表 series fallback 色(旁边 6 个 series 色也是硬码 hex),data-viz 非 chrome,留(真要收口是事件配色单一源,另立项)
- [x] 命名：`CompPicker.extractWcaIdFromUrl` 实返比赛 id（非选手 WCA ID） → 已改 `extractCompIdFromUrl`（函数名+文档+2 调用点局部变量+`onUrlPaste` 形参，4 refs；`CompCuberPicker` 里真指选手 id 的 `wcaId` 没动）
- [ ] 命名：`components/*.css` 三风格统一（cosmetic）
- [x] Vite 残渣（注释部分）:`tr.tsx:18` "3 canonical locales" → "two locales (en, zh)"(繁体早移除)
- [ ] Vite 残渣（代码分支）:`viteDev` 死分支（`shared/src/api/stats-base.ts:20`、`shared/src/alg.ts:226`）→ **暂缓**:触 shared 需 rebuild,且 `alg.ts` 是 alg trainer AI 在改的 dev 路由检测,等其 WIP 落定再动

## P2 简单清理（本次做）

- [x] `shared/src/types.ts:4` 五个旧训练器类型全死（`TrainerCase`/`TrainerSet`/`TrainResult`/`UserProgress`/`UserSettings`）→ 已删（0 真实消费者：alg-select 命中是 `TrainerSetClient` 文件名子串、test 命中是 allowlist 路径串）；shared rebuild + client/server typecheck 绿
- [x] `components/wca-stats/ShowToggle.tsx` 死组件（仅 /code 画廊引用；`ShowMode` type 被 wca/results 用）→ 已把 `ShowMode` 内联进唯一消费者 wca/results，删组件 + 去画廊 import/demo/registry/metadata 四处。`code-catalog-sync` 测试 5/5 绿，typecheck 无新错
- [x] `/code` `cuberootDesc` 字段（49 文件填充但 0 渲染器读）→ **已删**。核实真相：它是被取代的短草稿——每个工具另有一个**已渲染**的长版 `cuberoot: {zh,en}`（页面「它在 cuberoot.me 上做什么」那节），短版 `cuberootDesc` 内容长版都有,删掉不丢信息。sed 逐行删 50 文件 / −100 行(98 内容 + 2 类型,全单行),grep 归零 + client typecheck 绿
- [x] untrack `.playwright-mcp/` 下 5 个 debug session dump（整目录已 gitignore，误 force-add）
- [x] 删 `core/packages/client/HANDOFF.md`（已完成的 Vite→Next 移交文档，零引用）
- [x] 删 23 个死 ts-morph 一次性迁移脚本（`scripts/codemod-*` / `revert-*` / `scan-residual-isz` / `scan-gaps` / `cleanup-orphan-isz` / `fix-domain-terms` / `fix-use-client-order`；全 import 未安装的 ts-morph = 跑不起来，且无引用）
- [x] 删死导出 `getLangQuery`（`i18n/i18n-client.ts`）、`isZhAny`（`i18n/tr.tsx`）——零消费者

---

## P0 深挖校验（2026-07-17 续 — 逐文件实测，供开工前定方案）

上面 P0 是审查产出的方向；这一节是**按文件读过源码后的精确核对 + 具体改法**。结论：原方向都对，数字补精确，另纠一处 util 归属错认。

### A. `math/group/page.tsx`（16,508 行）— **唯一真·巨石，且已拆一半**

- 现状实测：page.tsx 里 **33 个 `<GTSec id=...>` 内联节** + **92 个 `function Xxx(` 内联 demo 组件**（`grep -c`）。而 `_components/sections/` 下**已抽出 30 节**，由 page.tsx 第 33–64 行的 `EXT_COMPONENTS` map `dynamic(() => import(...), { ssr:false })` **按 slug 懒加载**（`NewSectionMount`）。即 §33–§62 走的是现代懒加载 pattern，§1–§32+refs 这 33 节还整坨内联、靠一个巨型 return + `GTSec`（id 命中 slug 才渲染）伺候。
- 改法：把剩下的 **33 个内联节**逐个搬进 `_components/sections/Xxx.tsx`，在 `EXT_COMPONENTS` 加一行 import。**有现成、已上线验证的模子照抄**，非从零设计。
- 风险/收益：**风险最低**（每节自包含、slug 隔离，搬一节 Playwright 开一节比对，不牵连）；**收益最大**（16.5k → 预计 <2k 索引壳 + 首屏 chunk 变小）；`/math` **无别的 AI 在动**。33 节是耐心活不是难活。
- 内联节 slug 清单（迁移单位）：`what-is-a-group` `cube-group` `state-vector` `order` `invariants` `structure` `order-of-element` `conjugation` `commutators` `thistlethwaite` `gods-number` `beyond` `patterns` `cayley` `other-puzzles` `open-problems` `homomorphisms` `actions-burnside` `lagrange` `quotient` `permutation-groups` `algorithms` `distance` `random-walks` `computational` `representations` `lights-out` `peg-solitaire` `hamiltonian` `two-face-pgl` `rotational-puzzles` `useful-math` `refs`。

### B. 29 个 `*DistView`（各 ~200 行）— **不是巨石，是复制粘贴家族**

- 实测同构证据：29/29 全 import 同 5 基座（react / `@/i18n/tr` / `ScramblePreview2D` / `AppLink` / `./DiscreteHistogram`）；结构签名一致（Cuboid223/Gear/Ivy 均 `DiscreteHistogram:2 useState:4 useMemo:6`）；唯一差异是各自 `@/lib/{puzzle}-solver` + 数据 key + 步数标签 + 文案。
- **两个家族**（原方向的 `SampledDistView` + `EnumeratedDistView` 拆法**正确**）：
  - **Sampled（WCA 采样）家族**：只有 `PuzzleDistView.tsx`（528 行）1 个是 `await fetch` 型——它**已经是** config 驱动的通用基座，一个组件吃 222/pyra/skewb/sq1（真比赛示例带国旗/城市）。
  - **Enumerated（全空间枚举）家族**：其余 **28 个**全是 sync `import {…} from '@/lib/{puzzle}-solver'`（全状态空间 BFS、自己反推示例、下载全部）→ 应合成**一个 config 驱动组件 + 28 条 per-puzzle spec**（solver 三函数、event_id、色、god number、下载语义、文案）。`Slide8/Slide15`（`useState:8`，滑块无旋转）是异类，留独立或做第三 variant。
- **顺带的低风险子赢**（不做完整合并也该做）：`function stats(` (均值/中位/众数) **内联 11 次**、下载逻辑 **28 个各自造**（其中 6 个各定义 `function downloadBlob`、**0 共享**）→ 抽 `lib/dist-stats.ts` + `lib/download.ts`。**纠错**：`lib/stats-base.ts` 只导出 `statsUrl`/`staticUrl`（数据 URL helper），**不含**统计函数——共享统计 util 是**新建**，不是 repoint 现有的。
- 风险：中。需逐魔方核视觉一致（直方图 + 示例卡 ×28）。scramble/stats 偶有人动，搬前 `git status` 扫。

### C. 大但**不重复**的单页组件 — 拆价值低、风险高，建议先放

`CompDetailPage 3608` / `wca/comp/page 2966` / `FrameCountPage 2820` / `ReconSubmitForm 2126` / `ReconDetailClient 1898` / `WcaStatView 1290` / `wca/results/page 1027`（4 视图挤一函数）/ `LandingSearch 744`。这些是「一个复杂页写成一个大文件」，非复制粘贴；拆只能靠抽 section/hook 提可读性——功能正常、收益纯美观、动的是线上复杂交互 UI 回归面大，且 comp/recon 那片别的 AI 常碰。**除非特别嫌某个，先不动。**

### 不列入重构（行数高但天经地义）

`/sim` 全家（禁区）；`timer/_shell/SoloView 1815`、`BattleView 1556`（别的 AI 脏 WIP）；`scramble_444_rs 2343`、`wca/about/.../journey 1644`、`records_countries 1578`、`prediction/.../algorithms_catalog 1540`（**数据/生成文件，不是组件**）。

### 建议开工顺序

**A（math/group 续拆）** 最值：低风险、收益最大、不撞车、有现成模子 → **B（DistView 模板化）**：最治洁癖但耗 28 次视觉核对，可先只做「抽 `stats()`/`download` 共享 util」这半步 → **C 放着**。

---

*本文件随整改推进勾选。P0/P1 大项建议等 WIP 稳定后单独开 agent 逐个做。*
