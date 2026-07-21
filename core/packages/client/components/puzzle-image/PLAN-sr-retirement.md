# sr-puzzlegen 退役计划 — 引擎解析矢量导出统一路线

状态:**方案定稿,未开工**。决策(2026-07-21):给自有 /sim 引擎做**解析隐面消除(BSP)矢量导出**,伴图 + 服务端缩略图全走它;`@cuberoot/vendor-sr-puzzlegen` 整包**先不删,当后悔药**,切换稳定后最终删除。

前情:标定/对齐历史见同目录 `TODO-sr-exact-match.md`;此方案根治其「残留」节的 pitch 近似跟踪 + 消灭 SR_ANGLE_BASE 手工标定层。

---

## 1. 现状盘点(2026-07-21 量)

| 部件 | 行数 | 说明 |
|---|---|---|
| `vendor-sr-puzzlegen/src` | 7,380 | 自带几何+模拟器+alg 解析+SVG 投影(其中"大脑"≈4,961) |
| `/sim` 引擎 `app/[lang]/sim/engine` | 24,391 | Three.js 真 3D + 群论内核 |
| `sim_svg_export.ts`(现有导出器) | 1,053 | GPU depth-map 三档分类采样;**依赖 WebGL,服务端跑不了** |
| 胶水(shared sq1/skewb-notation + sr-rotations + cube-colors) | ~406 | 唯一真共享 |
| `PuzzleSVG.tsx`(sr React 壳) | 188 | |
| `sr_render.ts`(服务端 linkedom 壳) | 115 | |

架构病根:两边不共享相机与状态,靠 `SR_ANGLE_BASE` 每拼图手工标定角度偏移对齐 —— 默认精确、偏离默认近似,引擎默认一换标定就悄悄失效(2026-07-20 skewb 事故)。

## 2. sr 包覆盖面 vs 我们的真实用量

sr 共 12 种 visualizer type、5 类拼图:

| sr type | 我们用? | 现由谁承担 |
|---|---|---|
| `cube` / `cube-net` / `cube-top`(NxN) | ❌ | visualcube(iso/plan/oll…)+ cubing.js(net) |
| `square1` | ✅ iso/top | **sr** |
| `megaminx` / `megaminx-top` | ✅ iso/top | **sr** |
| `pyraminx` | ✅ iso/top | **sr** |
| `skewb` | ✅ iso | **sr**(skewb-top = 自绘 `shared/skewb-pyramid-svg`,非 sr) |
| 全部 `*-net` | ❌ | cubing.js 2D net(server `cubing_render.ts`) |

用到的 sr 特性:`alg`/`case`(自带模拟器)、`rotations`、`cameraDist`(fork 收编的透视选项)、`scheme`(整面配色)、`mask`(灰化,经派生表 `SR_INDEX_MAP` 映射;sq1 不可 mask 是 sr 结构限制)、viewBox 裁剪(minx/miny/svgWidth/svgHeight)、strokeWidth。**没人用**:`arrows`、`stickerColors`、sr 的 net/cube 系列。

## 3. 消费方清单(切换时逐个勾)

客户端(全走 `PuzzleSVG.tsx`):
- [ ] `/sim` 图像面板 + `/visualcube` studio(`PuzzleImage.tsx` 的 `'sr-puzzlegen'` renderer,8 个 kind:sq1/mega/pyra/skewb × iso/top)
- [ ] `/alg` 缩略图 `CaseThumb.tsx`(megaminx-top、pyraminx;skewb-top 自绘、sq1 走服务端 net,不受影响)
- [ ] `/scramble/pattern`(sq1/mega/pyra/skewb iso,`case=`)
- [ ] `/scramble/batch-solver` `_CaseImage.tsx`(pyraminx iso)
- [ ] mask 体系:`lib/puzzle-image/puzzle-mask.ts` 的 `SR_INDEX_MAP` 派生表 + `tests/_puzzle_mask_derive.ts` + `puzzle-mask.test.ts`

服务端:
- [ ] `GET /v1/visualcube.svg` view=iso|top(`cube.ts` → `sr_render.ts`,linkedom)

退役时要一并清的登记点:`client/server package.json` 依赖、`knip.json`、`about/credits_data.json`、`/code/stack` 的 `pnpm.tsx`/`monorepo.tsx` 文案、pnpm-lock。

## 4. 方案分阶段

### Phase 0 — 判据先行(小)
- [ ] 固化现有 golden(`verify_puzzle_image_golden.cjs` 28 查询)为切换前基线。
- [ ] 把本轮像素计数 oracle(GL `readPixels` vs SVG 栅格化,分色统计面积比)脚本化进 `scripts/`,作为逐拼图逐角度的对齐判据 —— 新路线的验收是「引擎 3D vs 引擎 SVG 同相机」,应逐像素级一致(≤1-2% AA 噪声),不再是 sr 时代的「面积比近似」。

### Phase 1 — 引擎核心可 headless(抽包)
- [ ] 从 `app/[lang]/sim/engine` 抽 headless 核心到工作区包 `@cuberoot/sim-engine`:群论内核、拼图几何构建、场景组装、配色。禁 DOM/WebGL import(logo 纹理等 client-only 能力 gate 掉)。交互层(指针/动画/手/全身)留在 client。
- [ ] client 全量改 import 路径;server 可 import(先例:server 已 import `@cuberoot/visualcube`、`@cuberoot/shared`)。
- 验收:Node 裸脚本能建出 skewb world 并数出三角形;client typecheck + 全测试绿;/sim playwright smoke 行为不变。

### Phase 2 — BSP 解析隐面消除导出路径(核心)
- [ ] `sim_svg_export.ts` 新增 `renderer: 'bsp'` 模式(与现有 null-painter / GPU depth-map 并存):世界系三角形建 BSP 树,按相机 back-to-front 遍历得**精确** painter 序,分裂解循环遮挡;共面层(贴纸压塑料压 logo)沿用现有材质优先级,不走几何。
- [ ] 共面同色相邻三角形合并成单 path(union),把 path 数压到贴纸量级。
- [ ] 「示意图预设」(schematic preset):倒角 0、无手、无 logo、平色填充 —— 低模场景既是 BSP 分裂量的保险,也是缩略图产品形态。
- 验收:4 拼图 × iso/top × 扫任意 `r=`,GL vs SVG 逐像素 diff ≤ 现 depth-map 路径水平;4-8x 放大接缝无锯齿无漏面(1:1 diff 是盲区,必放大验);path 数目标 mega iso ≤ 300;耗时不劣于现 GPU 路径参考值(pyra 173ms / skewb 263 / sq1 337 / mega 669)。

### Phase 3 — 客户端伴图切换
- [ ] `PuzzleImage.tsx` 的 `'sr-puzzlegen'` renderer → `'engine-svg'`:直接复用 sim 相机参数,**删除 SR_ANGLE_BASE / SR_DIST_BASE 整层**(含 codec 角度换算、`srSchemeFor` 映射)。偏离默认视角从此精确跟踪(根治 TODO 残留第一条)。
- [ ] mask:canonical DSL → 引擎贴纸 id 直映(新 map,替代 SR_INDEX_MAP);顺带解锁 sq1 mask(sr 做不到,引擎能)。
- [ ] 后悔药开关:`?img_engine=sr` query(+ env `NEXT_PUBLIC_SR_FALLBACK`)一键回退旧路径;sr 代码原样保留。
- [ ] skewb-top 自绘 fan 保留不动(它不是 sr,是示意图另一形态)。
- 验收:/sim 面板 4 拼图默认角 + 极端拖动角逐像素判据;golden fixtures 主动重录并逐张 review diff;CaseThumb / pattern / batch-solver 页 playwright 截图对照;新旧 4 拼图对比图给用户过目一次(风格从 sr 平面示意变成引擎平色预设,视觉会变)。

### Phase 4 — 服务端缩略图切换
- [ ] `engine_render.ts` 替代 `sr_render.ts`:`@cuberoot/sim-engine` headless world + BSP 导出,输出纯字符串,**该路径不再需要 linkedom**。
- [ ] `r=` 直接映射引擎相机;sq1/pyraminx 的 y→z promotion(`shared/sr_rotations.ts`)随之消亡或收缩。
- [ ] 响应内容变 → 按缓存规则 bump `v=`;24h cache 保持。
- 验收:本地 hono dev 渲 4 拼图 × iso/top × alg/case/mask 全组合对照;`server-cache-headers.test.ts` 绿;单张冷渲 ≤ 300ms;**服务器内存紧张**(见 nemesizer/L1 教训),BSP 树用完即弃、无常驻大表。

### Phase 5 — sr 退役(后悔药到期才做,单独会话)
触发条件:Phase 3+4 上线后观察期内(建议 ≥2 周)无回退开关使用、无渲染 bug 报告。
- [ ] 删 `packages/vendor-sr-puzzlegen` 整包 + client/server 依赖 + `PuzzleSVG.tsx` + `sr_render.ts` 旧路径 + 回退开关。
- [ ] 删 `SR_INDEX_MAP` 派生表与 derive 测试(mask 已直映引擎 id)。
- [ ] 清登记点:`knip.json`、`credits_data.json`、`/code/stack` 文案、pnpm-lock。
- [ ] `TODO-sr-exact-match.md` 归档(历史价值并入本文件或 memory)。
- 净删量预估:−7,400(vendor)− 标定层/胶水若干,+ Phase 2 新增 ≈ 600-1,000。

## 5. 风险与开放问题
- **megaminx 三角量**:12 五角面 × 分块,BSP 分裂在高模下可能爆;示意图预设低模是主保险,Phase 2 先量三角数再动手。
- **sq1 薄中层**:kite/中层薄片共面 epsilon 要调(现导出器的平面簇偏置经验可复用)。
- **抽包半径**:engine 24k 行里 headless 核心占多少、client-only 纠缠多深,Phase 1 开工前先做依赖图;若纠缠过深,退一步先抽「几何构建 + 状态」最小集。
- **风格即产品**:伴图/缩略图外观会从 sr 味变引擎味,Phase 3 验收含用户过目,不视觉偷跑。
- **NxN 不在本方案内**:cube 系仍走 visualcube/cubing.js;引擎导出器取代 visualcube 是远期独立方案(sim_svg_export 长期目标),别混进来。

## 6. 时序
Phase 0 随时可做;1→2→(3‖4)→观察期→5 严格串行;3 与 4 可并行。每 phase 单独 commit + 全测试绿再进下一个。
