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

- [ ] **`getIp(c)` 复制进 21 个后端 route**，且都保留可伪造 `X-Forwarded-For` 回退，与权威 `getClientIp` 语义矛盾 → 提共享 helper、去 XFF 回退。**★安全相关，后端第一优先**（`server/src/routes/account_auth.ts:32`）
- [ ] **`lib/name-utils.ts` 与 `lib/cuber-name-display.ts` 重复**（三导出函数代码相同，仅注释差一行；消费者 17 vs 33）→ 保留有测试的 `cuber-name-display`，repoint 17 个后删 `name-utils`
- [ ] 内联 `isZh ? '中' : 'EN'` 文案三元 ~15 处 → `tr({en,zh})`（`wca/results:785/792/827`、calc、`membership:41`、recognize、memo/colpi、`LandingSearch:267` 等）
- [ ] 本地 `t=(zh,en)=>isZh?zh:en` shim **56 文件/66 处** → 先补导出 positional `t(zh,en)` 的响应式 `useT()`，再全仓收敛
- [ ] 重复小 util：`fmtDate`、货币格式化 ×3、`firstGlyph` ×2、`statsUrl`（shared/client 双份**已漂移**）、MBLD decode ×2、`no-cache,no-store` 字面量 56 处
- [ ] calc 重造的 `EventSelector` → 共享 `WcaEventSelector`（`calc/_components/components/EventSelector.tsx:26`）
- [ ] `CountrySelect` / `RegionCountrySelect` 半截迁移收尾
- [ ] 硬编码色值 → token：`recon-utils.ts:244` FACE_COLORS、`recognize:273` `#adb5bd`、`prediction/lucky:213` `#888`
- [ ] 命名：`CompPicker.extractWcaIdFromUrl` 实返比赛 id → 改 `extractCompIdFromUrl`；`components/*.css` 三风格统一（cosmetic）
- [ ] Vite 残渣：`viteDev` 死分支（`shared/src/api/stats-base.ts:20`、`shared/src/alg.ts:226`）、`tr.tsx:18` "3 canonical locales" 注释（实只 2 语）

## P2 简单清理（本次做）

- [ ] `shared/src/types.ts:4` 五个旧训练器类型全死（`TrainerCase`/`TrainerSet`/`TrainResult`/`UserProgress`/`UserSettings`）→ 删（触 shared，需 rebuild，暂缓到能验的时候）
- [ ] `components/wca-stats/ShowToggle.tsx` 死组件（仅 /code 画廊引用）→ 删并去画廊 demo（需过 `code-catalog-sync` CI，暂缓）
- [ ] `/code` `cuberootDesc` 字段 49 文件填充但无渲染器读取（死语料）→ 确认后删
- [x] untrack `.playwright-mcp/` 下 5 个 debug session dump（整目录已 gitignore，误 force-add）
- [x] 删 `core/packages/client/HANDOFF.md`（已完成的 Vite→Next 移交文档，零引用）
- [x] 删 23 个死 ts-morph 一次性迁移脚本（`scripts/codemod-*` / `revert-*` / `scan-residual-isz` / `scan-gaps` / `cleanup-orphan-isz` / `fix-domain-terms` / `fix-use-client-order`；全 import 未安装的 ts-morph = 跑不起来，且无引用）
- [x] 删死导出 `getLangQuery`（`i18n/i18n-client.ts`）、`isZhAny`（`i18n/tr.tsx`）——零消费者

---

*本文件随整改推进勾选。P0/P1 大项建议等 WIP 稳定后单独开 agent 逐个做。*
