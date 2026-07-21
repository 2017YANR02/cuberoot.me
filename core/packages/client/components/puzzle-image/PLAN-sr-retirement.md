# sr-puzzlegen 退役计划 — 引擎解析矢量导出统一路线

状态:**Phase 2 完成、Phase 3 /sim 镜像上线(2026-07-21,含 NxN)**。决策(2026-07-21):给自有 /sim 引擎做**解析隐面消除(BSP)矢量导出**,伴图 + 服务端缩略图全走它;`@cuberoot/vendor-sr-puzzlegen` 整包**先不删,当后悔药**,切换稳定后最终删除。追加决策(2026-07-21):**NxN 伴图同路退役 visualcube**(cube:normal 走 BSP 镜像;visualcube 包同样先不删当后悔药)—— §5 原「NxN 不在本方案内」作废,收窄为「visualcube 的无 live-sim 消费方(/visualcube studio 任意 spec、CaseThumb、服务端)仍走 visualcube,随 Phase 1 抽包 + Phase 4 一并评估」。

> 执行顺序调整(2026-07-21):BSP 导出(Phase 2)先在 client 内实现并接通 /sim
> 伴图(Phase 3 的镜像部分),**抽包(Phase 1)推迟到服务端切换(Phase 4)之前**
> —— 风险最高的算法部分先落地见效,机械搬移后置。

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
（2026-07-21:`arrows` 与 `color.stroke` 逐色描边已按用户要求提前移植进 `sim_svg_export_schematic.ts`——箭头走 `opts.arrows` 世界坐标线段,逐色描边走 sticker `userData.schematicStroke`;站内暂无消费方,备将来用。）

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

### Phase 2 — BSP 解析隐面消除导出路径(核心)✅ 2026-07-21(commit 9c1b0170b6)
- [x] 独立模块 `sim_svg_export_bsp.ts`(与 GPU depth-map 截图路径并存):世界系三角形建 BSP 树,按相机 back-to-front 遍历得**精确** painter 序,SPAN 面片 Sutherland–Hodgman 解析切开;共面并档保 GL「先画先赢」语义(ro asc + seq desc)。纯数学无 WebGL,Node 可跑。
- [x] 共享边相消边界重建:paint 序中连续同平面同色段合并为单 path(含洞,nonzero);链化失败降级逐面片,不产生错误画面。
- [x] 「示意图」定稿(2026-07-21,3 轮迭代后弃 BSP 改 SR 范式):独立导出器 `sim_svg_export_schematic.ts` —— 只画彩色小面(sticker mesh 的 `userData.schematicPoly`,全三角轮廓 + 反烘 PIECE_SHRINK),**每个小面独立 path + 各自黑描边**(SR 的画法);相邻小面共享棱在建模层同点 → 描边逐比特重合(测试锁死:输出顶点去重数 = 晶格顶点数)。静止形态凸体、可见面互不遮挡 → 背面剔除即可,不需要隐面消除,**示意路径不走 BSP**(BSP 的共享边相消正好破坏描边重合,只留给实模投影)。相机取引擎 world,任意视角精确跟随。描边宽 = 面板「黑边」滑块(SVG px)。**pyraminx 36 贴纸已挂**;**skewb / megaminx / sq1 / fto 已挂(2026-07-21)**:mega/fto 的 polytope facet 即理想晶格直接挂(`schematicPolyFromFacet`,stickerGeom 共享);skewb 缝隙烘在切割面偏移 → 用 seam=0 理想切割重算;sq1 理想外形 = 正方体 [−W,W]³(层高不含 bevel 余量),多边形挂 **parent frame + `schematicInParent`**(贴纸 mesh 会被立体贴片开关改 scale.z,不能挂 mesh 本地系),底层镜像(pivot.scale.y=−1)由导出端 **det<0 绕向翻转**兜住;sq1 变形后非凸 → 导出端**凸性守卫**(可见小面面积和 ≈ 凸包面积才启用凸包裁剪 + 外框,否则退回纯 round join = sr 原版观感)。NxN 跟进(四边形小面同一机制,轮廓即 quad)。
- [x] 描边策略定稿(2026-07-21,两轮实测迭代):join 用 **bevel**(round 把亚像素碎片描成圆团"黑点";miter 在边界微锯齿顶点长针刺),描边宽 = min(1.2, 碎片平均宽) 随面积收缩,合并链化顶点吸附 1/8px 格点消微锯齿源头。两导出器同策略。
- 验收(已做):单测 14 用例含解析 painter-order oracle(1/viewZ 屏幕空间仿射,重叠对逐一验证近盖远),互穿 + 循环遮挡(风车三板)通过;真实 skewb 场景 6.2k 三角 147ms(优于 GPU 路径参考值)。**毛刺结构性消失**(无逐像素采样、无细分,遮挡边界=平面求交直线)。

### Phase 3 — 客户端伴图切换
- [x] **/sim 伴图镜像(v1,2026-07-21)**:SimPage rAF 采样场景几何签名,静止(两拍 ≈0.25s)即 `exportSimSvgBsp(world)` → `engineSvg` 透传 studio → PuzzleImage 的 sr 分支被引擎矢量镜像替代(仅 iso 变体;top 俯视示意不动)。相机/配色/状态与左边同源,**天然精确跟踪任意视角**。回退:`/sim?img_engine=sr`。SR_ANGLE_BASE 保留为回退路径的标定,待 sr 删除时一并清。
- [x] **NxN 伴图镜像(2026-07-21)**:cube:`normal` 视图同吃 `engineSvg`(plan/trans/net/wca 仍 visualcube/tnoodle)。伴图上限 64k 三角(普通阶 ≈88/块+204/贴纸,6x6≈5.7 万;超限收集期即抛,回退 visualcube 不卡页面);原核分色(aRaw,BSP 会画错色)经 `bspSceneAudit` 检测回退。N≥50 引擎自换简化几何,远期若要全阶镜像走 worker 化。
- [x] **「截图 SVG」按钮切 BSP 默认(2026-07-21)**:引擎拼图下载路径不再走 GPU depth-map(其逐像素遮挡采样即毛刺来源,用户实测 pyraminx 下载件确认);`bspSceneAudit` 检出手/方位字母/logo 贴图/原核(BSP 画不全或画错)才回退 GPU 全保真路径。BSP 收集期跳过贴图材质(logo 贴片画成实心色块必错,宁缺)。
- [ ] 待用户过目 4 拼图新旧观感(风格从 sr 平面示意 → 引擎实模投影)后,再决定是否需要示意图预设形态。
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
- **NxN(2026-07-21 改判)**:/sim 伴图的 cube:normal 已入镜像(见 Phase 3);visualcube 包先不删。剩余 visualcube 消费方 = 无 live-sim 场景(/visualcube studio 任意 spec 渲染、CaseThumb cube、`/v1/visualcube.svg` cube 视图、plan/trans/net 视图),真退役前置条件与 sr 相同:Phase 1 headless 抽包后由参数建 world 再 BSP。cubing.js net 不在退役范围。

## 6. 时序
Phase 0 随时可做;1→2→(3‖4)→观察期→5 严格串行;3 与 4 可并行。每 phase 单独 commit + 全测试绿再进下一个。
