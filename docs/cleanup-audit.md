# 全站清理跟进（2026-07-17 审查）

多 agent 全站审查产出的整改 backlog。审查**排除了当时 3 个 AI 在改的 WIP**（整个 `alg/`、`sim/`、`icon/` 树 + timer/wca/lib/server/components 里在改的具体文件），所以这里的每一项都在「已稳定、非 WIP」的代码上。

图例：`[ ]` 待办 · `[x]` 已完成 · `⏸` 暂缓（大重构，等对应 WIP 落定再动，勿碰其他 AI 在改的文件）

---

## P0 大重构 ⏸（等 WIP 落定再动）

- [ ] `scramble/stats` 里 **29 个 `*DistView` 组件是复制粘贴** → 抽 `<SampledDistView>` + `<EnumeratedDistView>` + per-puzzle spec 表。（`scramble/stats/_components/BsqDistView.tsx:48`）同区顺带：`stats(counts)` ×11、下载助手 ×28 → `lib/dist-stats.ts` + `lib/download.ts`
- [ ] `scramble/solver` **15 个 `*Solver` 各自重造** `SolveState`+`reqRef`+renderSingle → `useAsyncSolve()` hook + `<NearOptimalSolver>`（`scramble/solver/_DinoSolver.tsx:32`）
- [ ] `math/group/page.tsx` **16,508 行 god component**（~92 内联 demo）→ 按 `_components/sections/` 拆分
- [ ] 其它 god component：`components/WcaStatView.tsx`（1290）、`wca/results/page.tsx:122`（1027，4 视图塞一函数）、`FrameCountPage.tsx`（2820）、`components/LandingSearch.tsx`（744）
- [ ] **4 个 WCA 统计表页复制同一份脚手架** → 抽 `WcaStatsTablePage` / `useWcaStatsTable`（`wca/success-rate/page.tsx:34` + cohort-ranks / all-events-done / grand-slam）
- [ ] recon 双播放器合并：`ReconPlayerPane`↔`ReconPlayerCanvas`、`Sq1ReconPlayer`↔`CuberReconPlayer`
- [ ] 无共享 `ModalShell`：Donate/Feedback/Login/AlgCaseMeta 各搓 Escape+overlay → 抽公共壳
- [ ] `/code` intro 三套并存范式（数据驱动壳 vs 28 个 bespoke language/*/page vs algorithms 手写）统一

## P1 跨区收口

- [x] **`getIp(c)` 复制进 21 个后端 route**，都保留可伪造 `X-Forwarded-For` 回退 → 已加共享 `getIp(c)`（`analytics_helpers.ts`，委托权威 `getClientIp`、去 XFF 回退），21 route 删本地 def 改 import，111 调用点不变。server typecheck 绿。**★安全硬化，commit 未 push（需上线才生效）**。**分层防回归**（「立约束要分层」）：写入态 hook `.claude/hooks/block-server-forwarded-for.ps1`（→ `hook-detect-server-forwarded-for.mjs`，实活验证真拦）+ CI 兜底 `tests/server-no-forwarded-for.test.ts`，已登记 `/code/guards`（`_guards.ts` PAIRED_GUARDS）；新 route 再抄回 XFF 回退会被写入即拦 + CI 红。行内 `allow-forwarded-for` 豁免正当用途
- [ ] **`lib/name-utils.ts` 与 `lib/cuber-name-display.ts` 重复**（三导出函数代码相同，仅注释差一行；消费者 17 vs 33）→ 保留有测试的 `cuber-name-display`，repoint 17 个后删 `name-utils`。**暂缓**：17 消费者之一 `timer/_shell/SoloView.tsx` 正被 timer AI 改（dirty），现在 repoint 会撞车 / 半途留 `name-utils`。等其 commit 后一次做完
- [ ] 内联 `isZh ? '中' : 'EN'` 文案三元 → `tr({en,zh})` / `<T>`。**审查严重低估**：实测 **80+ 处**（非 ~15），密集落在正被改的 `alg/3bld|_roux|skewb-trainer` 树 + 暗锁 `WcaStatView`/`wiki`/`battle_store`，且混着**合法非文案** `isZh`（`'/zh'` 前缀、`u.lang='zh-CN'`、`countryName(t,isZh)` util 参数）不能一刀切。**暂缓**：全站 i18n 迁移撞 3 个 AI 的 alg/timer WIP，应等树静下来单独一轮 + 保留 `<T>` 订阅防切语言不重渲染。注：`code/architecture/arch-data.tsx` 还把旧 `isZh` 三元写成「推荐做法」，与现 CLAUDE.md 矛盾，属过期文案
- [ ] 本地 `t=(zh,en)=>isZh?zh:en` shim **56 文件/66 处** → 先补导出 positional `t(zh,en)` 的响应式 `useT()`，再全仓收敛。**暂缓**：与上条同批(同是 isZh 家族、同撞 WIP)，一次做
- [ ] 重复小 util：`fmtDate`、货币格式化 ×3、`firstGlyph` ×2、`statsUrl`（shared/client 双份**已漂移**）、MBLD decode ×2、`no-cache,no-store` 字面量 56 处
- [ ] calc 重造的 `EventSelector` → 共享 `WcaEventSelector`（`calc/_components/components/EventSelector.tsx:26`）
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

*本文件随整改推进勾选。P0/P1 大项建议等 WIP 稳定后单独开 agent 逐个做。*
