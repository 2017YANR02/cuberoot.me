# sr-puzzlegen + visualcube 退役计划 — 引擎解析矢量导出统一路线

> **2026-08-23 架构更新（本地待发布）**：Phase 1 的四拼图无头 SVG 闭包已物理提取到 `@cuberoot/puzzle-render-core`；`EnginePuzzleSVG` 与 Server 的 iso 静态图共用 `iso-svg` 实现，Server 不再 import Client 源码，也不再为 iso 回退到 sr。通用 `PuzzleImage` 仍会在 `engineSvg` 缺失时隐式走 sr，另有显式 sr 后悔药；top/net 视图也仍在。sr 整包删除继续由 Phase 5 单独验收。

> **2026-07-30 再追加(用户指令,已执行)**:`/sim/batch` 用户判定「没啥必要」,整页删除(不加 redirect)。连带删掉只服务它的 `lib/puzzle-image/batch.ts`、`lib/zip.ts`(ZIP 打包只有批量下载用)、`tests/zip-and-batch.test.ts`、`vcStageMask` 的 `vcMaskForStickering`(sim → 批量页的阶段翻译),以及 `.vc-editor-page` / `.vc-header*` / `.vc-textarea` 这几条只有整页宿主才用得上的样式。`/sim` 图像面板底下只剩「阶段遮罩速查」一个去处。

> **2026-07-30 追加(用户指令,已执行)**:standalone `/visualcube` 页整个退役 —— 编辑器页直接删(不加 redirect,按项目规矩),两个子页搬进模拟器:`/visualcube/batch` → **`/sim/batch`**(URL key 从裸前缀换成 `img_`,与 /sim 图像面板同一套;拼图 / 公式 / 阶段三个 key 两边各自翻译)、`/visualcube/stages` → **`/sim/stages`**(卡片改成「打开模拟器并选中该阶段」`?puzzle=N&stickering=…`,与引擎自带阶段同义的名字走 `stickeringValueForVcMask` 去重)。
>
> 连带:`PuzzleImageStudio` 的 `mode` prop 删除(page 模式没宿主了),page 专属的那几组控件(魔方 / 阶数 / 公式 / 六面配色 / 视角旋转 / 壳体与贴纸不透明度 / 投影距离 / stage mask 下拉)一并删 —— 它们在 /sim 各有一个入口,本来就是重复;「背景色」是导出件底色、sim 没有对应控件,改成面板常驻。「分享链接」按钮删(面板状态就在地址栏的 `img_*` 里)。**已知损失**:3×3 net 涂色编辑器(`?fc=`)随 page 模式一起没了入口 —— 画任意面色出图这件事现在只有 `/scramble/solver` 的涂色板能做,它不出图。
>
> `/sim` 伴图侧只删了浮层左上那个 **VC/ENG 渲染器切换钮**(`preferSpecRender` + `sim.img.source`)。引擎画不出时静默回落 visualcube 的兜底、以及 plan 俯视图直调 `renderCubeSVG` 出图,**都按用户决定保留**。
>
> `scripts/verify_puzzle_image_golden.cjs` 删除:它唯一能跑的 arm 就是 /visualcube 页。等价覆盖已在 `tests/puzzle-image-render.test.ts`(同一批 golden fixture,Node 侧逐字节)。

当前状态（2026-08-23）：2026-07-22 的 Phase 0-4 旧实现已上线并完成当时验收；四异形的物理抽取现已按窄边界落到 `@cuberoot/puzzle-render-core`，本轮待发布。原完整 `sim-engine` 物理搬移已取消，剩余重复实现与回退归 Phase 5 的 sr 删除工作包。VisualCube 继续负责 NxN 状态图、语义平面图和阶段/箭头 DSL，不属于四异形 package 的重复实现；其 live-sim `cube:normal` 伴图已有引擎镜像，但失败回退和其他视图保留。

**历史目标（2026-07-21，已被 2026-07-30 与 2026-08-23 决策收窄）**：当时计划完整退役 VisualCube 与 sr，并要求迁移功能时复用 UI、DSL 和解析层。standalone `/visualcube` 后来按用户决定删除；当前只把 sr 重复后端列入 Phase 5，VisualCube 的 NxN/平面图职责继续保留。网格观感仍复用 VisualCube 的 **inset 模型**，不另造 DSL 或用固定 px 描边。

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

## 2b. visualcube studio 功能对照表(2026-07-21 用户指令:一个都不能少)

用户明确:以下 /visualcube studio 面板功能(截图存证)全部要在引擎路线等价存在,才允许退役 visualcube。UI 与 DSL(箭头串 `U0U2-red,U6U8`、遮罩串 `U:0,2;F:3-5`)照搬,只换渲染后端。

| 功能 | visualcube 侧实现 | 引擎路线落点 | 状态 |
|---|---|---|---|
| 视图 normal(iso) | drawing.ts 三面投影 | /sim 伴图已镜像(示意/BSP)。示意导出器面板结构 2026-07-22 与 vc `renderCubeOutline` 同构收敛:逐面凸包面板 + **全图唯一**等比内缩系数 + 同色 round-join 描边 + `<g opacity>` 整层拍平;几何不变量(覆盖/共享角重合/逐 path opacity)锁在 `tests/_svg_invariants.mjs`(CI 单测 + `audit:svg` CLI 现抓复判共用) | ✅ |
| 视图 plan(俯视含侧带) | 同上,俯视 + 四侧首排 | `sim_plan_export.ts` 的 `exportSimPlanSvg`:**忠实复刻 visualcube plan 几何** —— 整方块绕 X 转 −90° 透视投影(dist=5),中央 U 面 N×N + R/F/L/B 顶排沿面法向外推 0.2 的**斜切梯形**侧带(renderOLLStickers),四角由梯形斜边闭合。移植 visualcube 投影数学(makeStickerPosition+透视+OLL 外推),颜色仍走已核验的 netIndexOf(`serialize[block·N²+netIndexOf]`),每颜色格直接配自身投影几何(不经 visualcube 内部几何↔颜色转置)。SimPage flat 分支 + engineMirrors/engineShown 收 `cubeView==='plan'` | ✅(2026-07-22 改判 & 修:**先前误做成平矩形侧带、四角留空违反忠于原版**,已改为透视斜切;`sim_plan_export.test.ts` 逐多边形质心比对 visualcube `renderCubeSVG(view:plan)` 全匹配 ε<0.01 + Playwright 实测 /sim plan 侧带斜切) |
| 视图 trans(半透明) | cubeOpacity/stickerOpacity | 示意导出器加 `showHidden`(跳背面剔除,已有 z 排序 far→near + bodyOpacity 让背贴纸透出前壳)；trans = **接管内核外观的预设**:`SettingDrawer.withTransCore` 把内核色/内核不透明度顶成银壳 #BFBFBF + 50%,SimPage 的 `renderSettings` 同时喂 3D 与伴图,外观区那两行随之锁死并显示预设值(hover 说明原因),持久化设置不动 | ✅(2026-07-21 起;2026-07-30 改判并修:先前只顶伴图、且条件是「内核色/不透明度还等于默认」—— 于是大魔方实心而小图半透明,用户一旦调过内核不透明度 trans 更是彻底失效。实测 trans 与「normal + 银 + 50%」伴图逐字节相同,故不是另一种渲染,就是这两个旋钮的预设) |
| 视图 net(展开图) | 平面展开 | `sim_net_export.ts` 的 `exportSimNetSvg`:读 `cube.serialize()`(URFDLB N² 块,net 朝向)→ **直调 tnoodle 参照 `cube_unfolded_svg` 的共享 emitter(`renderUnfoldedStateSvg`)逐格喂引擎面色** —— 布局 GAP 0.2 / stroke 0.1 / viewBox `4N+5G × 3N+4G` 与 studio spec 渲染(`renderSpecSvg → renderUnfoldedSvg`)按构造逐字节同款(先前自绘 GAP 0.18/stroke 0.05 数值漂移,2026-07-22 收敛)。布局常量与交互式 `_SimCubeNet` 单一源(它 import 这里)。SimPage engineSvg 效应加 net 分支(serialize 签名,不走 3D 采样);PuzzleImage/studio 的 engineMirrors/engineShown 收 `cubeView==='net'` | ✅(2026-07-22 收敛:`sim_net_export.test.ts` 复原态 N=2/3/4 vs `renderUnfoldedSvg` 逐字节相等 + 54 格逐格归属探针;live 实测 viewBox `0 0 13 9.8`、net≡wca;遮罩键 `face:idx` 已备,SimPage 侧透传待接) |
| 视图 wca(记分表样式) | tnoodle 风格平面 | 同 net,引擎状态直出 | ✅(2026-07-21):cube 的 wca 与 net 是同一展开图(render.ts 两者同出 `renderUnfoldedSvg`,产出一致),故复用 `exportSimNetSvg`——SimPage net 分支 + engineMirrors/engineShown 均收 `cubeView==='wca'`。非 cube(skewb/mega)wca 仍走各自 scramble-display,不在 NxN 退役范围 |
| 图片尺寸 (PX) | svg width/height | `lib/puzzle-image/engine-svg.ts` 的 `sizeEngineSvg`:root <svg> 宽高钉 size×size(viewBox 保留 → meet 等比不变形);显示 / studio 预览 / SVG 下载三处共用一份。PNG 下载走 canvas=imageSize² + contain-fit | ✅(2026-07-21;此前 SVG 下载漏套尺寸=导出器原生像素,已补) |
| 箭头(面/从/到/过/缩放/影响/颜色 + DSL + 默认箭头色) | arrows 解析 + renderArrows | `engine/nxn/vcArrowBridge.ts`:复用 visualcube `parseArrows`(不重造 DSL)→ `faceletFromNet`(netIndexOf 的逆,round-trip oracle 锁死全 6 面)→ 局部贴纸中心 × 示意 mesh matrixWorld(锚 mesh 变换,固定几何位、随相机+打乱精确)→ SimPage 烙进 `opts.arrows`。studio 箭头 UI/DSL 原样透传。**曲线(s3/influence)已通(2026-07-22)**:桥按 vc renderArrow 同序算控制点(s3 贴纸中心朝未收缩弦中点按 influence/5 缩放,vc 在 2D 投影面缩、桥在 3D 贴纸面缩 —— 与 scale 同一近似),导出器画 `M p1 Q p3 p2` + marker orient=auto 末端切线定头向(= vc 手算 rotation 语义);取景计入控制点(二次曲线 ⊂ {p1,p3,p2} 凸包)。测试:`vc_arrow_bridge.test.ts` 曲线关系式(i5=贴纸中心 / 默认 i10=因子 2 / s 收缩不动 p3)+ 导出器 Q path/取景。**线宽/头尺寸 vc 等比(2026-07-22)**:vc 箭头定在投影后 2D 单位(线 0.12/N、头 0.033/N,单位=立方体边长;project 在立方体中心深度比例恰 1)→ 桥给世界单位线宽 0.12×格距,导出器按中心深度透视比例统一换 px(与视口解耦,交换态小框视口不再爆粗),头 marker 按 vc 三角 ×0.275(=0.033/0.12)strokeWidth 单位逐数复刻。实测引擎/vc 线宽÷墨迹宽 = 0.028765/0.028761(差 0.014%),交换态 0.028764 不变 | ✅(2026-07-22;NxN normal;直/曲/色/缩放/默认色全通)。跨面 waypoint 仍限 s1.face(vc renderArrow 本身如此,忠实保留) |
| MASK 预设(fl/f2l/oll… + rot) | mask 枚举 | ①非 NxN 走 canonical DSL → 引擎贴纸 key 直映;②**NxN 整套 visualcube MASK 已并进 /sim 主魔方 stickering 下拉**(`engine/nxn/vcStageMask.ts`:复用 `makeMasking` + 标准展开图桥,逐小面二值灰化 3D 真机,伴图读 mesh 色天然跟随;按语义去重引擎自带阶段;crossColor 重定向)| ✅(NxN + pyra/skewb/mega + sq1 全通,2026-07-21) |
| 贴纸遮罩(`U:0,2;F:3-5` + 点选编辑) | facelet 级遮罩 | 同上直映层;点选编辑 UI 照搬 | ✅ 全拼图(2026-07-21)。pyra/skewb/mega 直映 + 点选联动实证。**NxN**:`engine/nxn/netIndex.ts` 的 `engineHomeSid`(纯,零依赖 → instanced.ts 可引不拖 visualcube)给每贴纸 instance 打 HOME canonical sid;`toEngineMask('cube')` 恒等;导出器 instanced 分支查 `schematicInstanceKeys[i]` 灰化;net_index.test.ts 双射锁;实证 `U:0,2;F:3-5` 位置全对。**sq1(sr 做不到的新能力)**:canonical id 空间定稿 = piece 本位(mask-core 头注:U0-7 / D8-15 / SA0-15 / SB{corner} / M0-5,sideA/sideB 单一源 = 引擎 `pieceFaces()`);`sq1-svg.ts` 发 data-sid + 灰化(tnoodle 状态携带 piece id → piece-following 免费);引擎 `sq1Geometry` 建构时烙 `stickerKey` = canonical sid → `toEngineMask('sq1')` 恒等;PIECE_GROUPS.sq1 定义式派生(18 组 46 贴纸,sq1_mask.test.ts 双射锁);studio pick 自动解锁(maskSupported 表驱动)。实证:点 U0 整块 → `SA:0;SB:0;U:0` → 伴图灰 2 面(第 3 面朝背);`M:0-5` 中层灰 3 可见面(2D 授权图无中层贴纸,M 走 DSL/引擎伴图) |
| 壳体色 | cubeColor | 导出器 bodyColor 参数(inset 衬底色) | ✅(已接 /sim 引擎伴图,2026-07-21) |
| 壳体不透明度 | cubeOpacity | 导出器 bodyOpacity | ✅(已接引擎伴图) |
| 贴纸不透明度 | stickerOpacity | 导出器 stickerOpacity | ✅(已接引擎伴图) |
| 投影距离 | dist(透视强度) | 引擎相机距离/fov 映射 | ✅(架构已满足,2026-07-21 核实):/sim「透视」滑块 = dolly-zoom 直控相机距离+FOV(35mm 等效焦距,PlayerControls `UNIT_FOCAL`),引擎镜像共享 live 相机 → 投影距离即透视滑块。且 `settings.perspective` 已写入 `img_dist`(SimPage 1704-1723)双向接线。studio 独立 `dist` 控件仅 standalone /visualcube 页显示(`showInheritedControls = mode==='page'`),驱动 visualcube 渲染,/sim panel 不显示 |
| 黑边(网格缝宽) | inset 0.85 + 底色缝 | 示意导出器 inset 模型(滑块 = 缝宽占小面比例) | ✅(2026-07-21) |

## 3. 消费方清单(切换时逐个勾)

使用 `components/EnginePuzzleSVG.tsx` 的客户端静态图路径会懒调用 `@cuberoot/puzzle-render-core/iso-svg`；World 池、状态重放与 schematic 导出只在共享包实现一次，组件仅保留公式方向换算、缓存和 React 生命周期。通用 `PuzzleImage` 不是该路径：其 `engineSvg` 缺失时仍隐式回到 sr，top/net 形态也留守各自渲染器：
- [x] `/sim` 图像面板：伴图 iso 已引擎镜像（Phase 3）。**→ Phase 5 队列**：四异形的通用 `PuzzleImage` sr fallback 与 top 变体；standalone `/visualcube` 已删除，不再列队列
- [x] `/alg` 缩略图 `CaseThumb.tsx`:**pyraminx iso → EnginePuzzleSVG ✅**(2026-07-21,实测 /alg/pyraminx/l4e 38 thumb 全引擎、case 逆变换姿态正确);skewb-top 自绘、sq1 服务端 net 不动(非 sr-iso 范围)。**→ Phase 5 队列**:megaminx-top 俯视形态仍 sr,删 sr 时定去留(引擎补 top 视角或切 iso)
- [x] `/scramble/pattern` **4 拼图 iso 全切引擎 ✅**(2026-07-21,实测 pyra 6/6 + mega/skewb/sq1 各 5/5 卡出图)
- [x] `/scramble/batch-solver` `_CaseImage.tsx`(pyraminx iso → EnginePuzzleSVG ✅,同组件同路径)
- [x] mask 体系:引擎直映已并存接管(五拼图全通,见 Phase 3)。**→ Phase 5 队列**:`SR_INDEX_MAP` 派生表随 sr 一并删

服务端:
- [x] `GET /v1/visualcube.svg` view=**iso** → `@cuberoot/puzzle-render-core/iso-svg`（Phase 4 本地 ✅；top 留独立 renderer；部署待验）

退役时要一并清的登记点:`client/server package.json` 依赖、`knip.json`、`about/credits_data.json`、`/dev/stack` 的 `pnpm.tsx`/`monorepo.tsx` 文案、pnpm-lock。

## 4. 方案分阶段

### Phase 0 — 判据先行(小)✅ 2026-07-21
- [x] 固化现有 golden(`verify_puzzle_image_golden.cjs` 28 查询)为切换前基线。实证:对 /visualcube(page 模式)**28/28 逐字节吻合**,基线仍有效,覆盖全部渲染分派分支。
- [x] 像素计数 oracle 脚本化 → `scripts/verify_engine_svg_pixel_oracle.cjs`:同页同相机下,栅格化「引擎导出伴图 SVG」与「WebGL 画布」各成 256²,逐色统计「该色/全部着色像素」面积比,断言两侧比例一致(容差默认 8%)。调色板取自 SVG 自己的 fill(按色相最近归桶 → 对打光免疫);saturated OR 近白才计入(滤灰塑料倒角)。实证 **8/8**(2026-07-21):pyraminx 0.1% / sq1 0.2%(schematic 精确跟随相机)、skewb 2.9% / mega 2.7%、**NxN(BSP)cube-2/3/4/6 全 6.2–6.8%**。
  - **观察(记 Phase 3 待查)**:所有 NxN 的 BSP 伴图「白(U 顶)面」系统性比 3D 低 ~6%、「绿(F 前)面」高 ~6%,四个阶(2/3/4/6)一致 → 非随机噪声,是 3D 顶面受光最强、AA 边界近白像素被就近计成白(BSP 路径比 schematic 的 0.1% 显著)。当前容差 8% 放得过、gross 回归(画错面/镜像/错打乱=双位数差)拦得住;真要压到 ≤2% 需 BSP 相机与 live 3D 相机零偏移复核 + 高光抑制,列 Phase 3 精修,不阻塞。不进 CI(要浏览器+WebGL+dev server)。

### Phase 1 — 引擎核心可 headless(抽包)
**依赖图已做(2026-07-21,§5「抽包半径」前置)**:24,785 行 ~126 文件,**~65%(≈16.2k 行)可干净 headless**——群论内核 + 全拼图几何 + PG 桥 + `world.ts` 场景组装本就 renderer-free(THREE 只用 math/scene-graph 类;`engine/` 内唯一碰 `WebGLRenderer` 的是 `backView.ts`,主渲染器/rAF 帧循环本来就在 SimPage 不在 engine)。client 残留 ~35% = `hands/` 5.2k + 各 `*Drag.ts` 1.5k + `nxn/controller.ts` + `backView.ts` + 手势/动画播放 + logo 上传 + worker bootstrap(worker 做的活是纯 WASM 计算,headless 走同内核的同步 `setup()`,不需要 worker)。
**真阻塞仅 4 点(全是小 gate/DI,非深重构)**:①`tweener.ts:100` 模块级单例 ctor 里 `requestAnimationFrame`——内核 import 即炸 Node(cube/group/twister 都 import 它);②`nxn/twister.ts:471/506/622` 同步 `setup()` 热路径无条件解引用 `window.__STACK_KERNEL_*`;③`world.ts:120` ctor 硬 `new Controller(this)`(启指针 rAF 环);④`world.ts:121-161` ctor 硬建 ~10 个 `FaceHints`(`document.createElement('canvas')` 烤字母纹理)。
- [x] **headless gate 落地(2026-07-21)**:①②④ typeof 守卫(tweener/Controller rAF、twister window、FaceHints 无 document 跳 sprite);③升级为**完整 DI 解耦**:world.ts 对 Controller/HandsRig/loadSmplxFullBody 只剩 `import type` + 注入槽(`controller!` / `handsFactory` / `smplxLoader`),值层面零 client 依赖 —— core 已可整体进 headless 包;client 侧 4 个实例化点(SimPage/_Interactive3DCube/PllPerformerOverlay/ReconPlayerBase)经新 `worldInteraction.attachInteraction` 注入,SimPage 另注入手/全身工厂。实证:tests/engine_headless.test.ts 4/4(无注入建 world/切拼图/打乱)+ Playwright(/sim 打乱伴图、/scramble/solver 3D 交互魔方、/recon 详情双 canvas)。/sim 行为不变。
**2026-08-23 实施决策与状态**：不搬完整 Web `World`，也不创建泛化的 `@cuberoot/sim-engine`。只把 Server 实际消费的四拼图几何、状态、无头 World 和 SVG 导出闭包提取到 `@cuberoot/puzzle-render-core`；DOM、Worker、控制器、手势、播放和其余拼图继续归 Client。旧 Client 路径保留薄 re-export，Server 只走 package 公开 subpath。原先约 90 文件的全引擎搬移队列已取消，未来若出现新消费者，重新按 package 门槛审计，不以“整理目录”为由扩大边界。
- 验收:Node 裸脚本能建出 skewb world 并数出三角形(**已达成**,tests/engine_headless.test.ts 于 vitest node 环境 4/4);client typecheck + 全测试绿;/sim playwright smoke 行为不变。

### Phase 2 — BSP 解析隐面消除导出路径(核心)✅ 2026-07-21(commit 9c1b0170b6)
- [x] 独立模块 `sim_svg_export_bsp.ts`(与 GPU depth-map 截图路径并存):世界系三角形建 BSP 树,按相机 back-to-front 遍历得**精确** painter 序,SPAN 面片 Sutherland–Hodgman 解析切开;共面并档保 GL「先画先赢」语义(ro asc + seq desc)。纯数学无 WebGL,Node 可跑。
- [x] 共享边相消边界重建:paint 序中连续同平面同色段合并为单 path(含洞,nonzero);链化失败降级逐面片,不产生错误画面。
- [x] 「示意图」定稿(2026-07-21,3 轮迭代后弃 BSP 改 SR 范式):独立导出器 `sim_svg_export_schematic.ts` —— 只画彩色小面(sticker mesh 的 `userData.schematicPoly`,全三角轮廓 + 反烘 PIECE_SHRINK),**每个小面独立 path + 各自黑描边**(SR 的画法);相邻小面共享棱在建模层同点 → 描边逐比特重合(测试锁死:输出顶点去重数 = 晶格顶点数)。静止形态凸体、可见面互不遮挡 → 背面剔除即可,不需要隐面消除,**示意路径不走 BSP**(BSP 的共享边相消正好破坏描边重合,只留给实模投影)。相机取引擎 world,任意视角精确跟随。描边宽 = 面板「黑边」滑块(SVG px)。**pyraminx 36 贴纸已挂**;**skewb / megaminx / sq1 / fto 已挂(2026-07-21)**:mega/fto 的 polytope facet 即理想晶格直接挂(`schematicPolyFromFacet`,stickerGeom 共享);skewb 缝隙烘在切割面偏移 → 用 seam=0 理想切割重算;sq1 理想外形 = 正方体 [−W,W]³(层高不含 bevel 余量),多边形挂 **parent frame + `schematicInParent`**(贴纸 mesh 会被立体贴片开关改 scale.z,不能挂 mesh 本地系),底层镜像(pivot.scale.y=−1)由导出端 **det<0 绕向翻转**兜住;sq1 变形后非凸 → 导出端**凸性守卫**(可见小面面积和 ≈ 凸包面积才启用凸包裁剪 + 外框,否则退回纯 round join = sr 原版观感)。**NxN 已挂(2026-07-21)**:InstancedRenderer 走 mesh 级 `schematicInstancedPoly`(±HALF 整格 quad × per-instance 矩阵,填色 instanceColor;mirror 非均匀分层不满足晶格假设 → enableMirror 摘除回退 BSP);导出器加 `maxFacelets`(默认 2 万)防超高阶 path 爆量,超限抛 SVG_TOO_COMPLEX 回退 visualcube。**engine-only 拼图面板(2026-07-21)**:fto / ivy / dino / redi / rex / heli / gear 先开面板;同日第二轮**全量化**:`imageStudio` 注册项删除(恒真即死旗),图像面板对所有拼图常在,`imageStudioEngineOnly = !imgSpecRenderable`;无引擎 world 的 twisty 拼图(PG 目录 / custom / cubing.js 渲染的 fto)伴图走 TwistyPlayer vantage → `exportSimSvg`(painter,srgbColors,截图 SVG 同路径),vantage 每采样拍异步刷新(custom 改切割时 player 原地换内部 scene,缓存一次会冻住);静止签名掺 position/color BufferAttribute.version(twisty 转动/换色只改顶点属性不改矩阵)。spec 可渲染拼图在 cubing.js 渲染下仍走 sr 伴图不抢。另加**主图↔伴图交换钮**(浮层右下,同背面小窗交换钮款,`sim.img.swap`):开 = 伴图铺满画布、实时 3D 缩进左上 float-size 方框;引擎路径由 resize 闭包按 `imgSwapRef` 真调渲染器/world 尺寸(纯 CSS 缩放会废掉 Toucher 像素坐标射线拾取),twisty 靠自身 ResizeObserver 真重排。SimPage 判 `imageStudioEngineOnly`(spec 渲染器不认识)→ studio 走 engineOnly 模式:预览直出 engineSvg、导出栏只剩截图组 + SVG/PNG(链接类按钮指向服务端 spec 渲染,画不了这些拼图 → 隐藏),spec 同步 effect 跳过(不污染 URL img_*)。SVG/PNG 下载与预览所见一致:预览显示引擎矢量时 `getCurrentSvg` 直接返回它(此前会导出 spec 重渲染的近似版)。
- [x] 描边策略定稿(2026-07-21,两轮实测迭代):join 用 **bevel**(round 把亚像素碎片描成圆团"黑点";miter 在边界微锯齿顶点长针刺),描边宽 = min(1.2, 碎片平均宽) 随面积收缩,合并链化顶点吸附 1/8px 格点消微锯齿源头。两导出器同策略。
- 验收(已做):单测 14 用例含解析 painter-order oracle(1/viewZ 屏幕空间仿射,重叠对逐一验证近盖远),互穿 + 循环遮挡(风车三板)通过;真实 skewb 场景 6.2k 三角 147ms(优于 GPU 路径参考值)。**毛刺结构性消失**(无逐像素采样、无细分,遮挡边界=平面求交直线)。

### Phase 3 — 客户端伴图切换
- [x] **/sim 伴图镜像(v1,2026-07-21)**:SimPage rAF 采样场景几何签名,静止(两拍 ≈0.25s)即 `exportSimSvgBsp(world)` → `engineSvg` 透传 studio → PuzzleImage 的 sr 分支被引擎矢量镜像替代(仅 iso 变体;top 俯视示意不动)。相机/配色/状态与左边同源,**天然精确跟踪任意视角**。回退:`/sim?img_engine=sr`。SR_ANGLE_BASE 保留为回退路径的标定,待 sr 删除时一并清。
- [x] **NxN 伴图镜像(2026-07-21)**:cube:`normal` 视图同吃 `engineSvg`(plan/trans/net/wca 仍 visualcube/tnoodle)。伴图上限 64k 三角(普通阶 ≈88/块+204/贴纸,6x6≈5.7 万;超限收集期即抛,回退 visualcube 不卡页面);原核分色(aRaw,BSP 会画错色)经 `bspSceneAudit` 检测回退。N≥50 引擎自换简化几何,远期若要全阶镜像走 worker 化。
- [x] **「截图 SVG」按钮切 BSP 默认(2026-07-21)**:引擎拼图下载路径不再走 GPU depth-map(其逐像素遮挡采样即毛刺来源,用户实测 pyraminx 下载件确认);`bspSceneAudit` 检出手/方位字母/logo 贴图/原核(BSP 画不全或画错)才回退 GPU 全保真路径。BSP 收集期跳过贴图材质(logo 贴片画成实心色块必错,宁缺)。
- [x] 4 拼图新旧观感对比材料已产出并呈交(2026-07-21):`client/.tmp/png/engine-render/compare.html`(8 组 sr↔引擎并排,含打乱态)。「过目」从**前置门**改为**后置反馈制**。当时的保护包含 Client `?img_engine=sr` 与 Server sr fallback；2026-08-23 后 Server fallback 已删除，Client 的显式开关与 `engineSvg` 缺失时的隐式 sr 路径继续保留到 Phase 5。
- [x] mask 直映:canonical DSL → 引擎贴纸建构 key(`userData.stickerKey`),替代 SR_INDEX_MAP。**pyraminx + skewb + megaminx 已通(2026-07-21)**:几何烙 key → `tests/_engine_mask_derive.ts` 共轭派生(引擎侧置换从建好的 3D 场景几何读出:层内晶格质心绕轴转、落槽匹配即置换)→ `data/engine-sid-map.json` 锁表(engine-mask.test.ts:逐字节重推 + 双射 + 块结构守恒 + 端到端灰化渲染)→ `toEngineMask` → schematic 导出器 `mask` 选项 → SimPage 烙进镜像。无表拼图 SimPage 置 engineSvg=null 回退 spec 渲染器,两条路都不丢遮罩。genMap 三法:pyra 顶点字母同名 + 双手性试解;skewb 中心面 3-循环 ⊆ 轴旋转面循环且 3 面在轴正侧(动侧,否则差整体旋转)一次钉死轴+手性;mega 复用 deriveMegaGenMap(U/F 锚)+ **第三锚 R='R' 破镜像**(双手性下镜像配反手性群层面也能共轭,必须几何锚排除;底环面名对映逐面吻合方位角:DR→C 54° / DL→A 126° / DBL→I 198° / B→BF 270° / DBR→E 342°)。**studio 点选编辑 UI ↔ 引擎镜像联动已复查(2026-07-21 Playwright 实证)**:pick 编辑器是独立「还原态展开图」授权视图(不传 engineSvg → 走带 `data-sid` 的 pure/sr 渲染命中);点 skewb U0(单贴纸模式)→ `img_msk=U:0` → 主 iso 引擎镜像恰好 1 面变 `#404040`;点 pyraminx F0(整块模式)→ `F:0;L:3;R:0`(角块 3 面)→ 镜像灰 2 面(第 3 面朝背不可见)。两种几何 + engine-mask.test.ts 锁死的派生表 → pyra/skewb/mega 三元组联动确认。**NxN instanced posit 追踪已完成(2026-07-21)**:贴纸实例跟物理块走,故给每 instance 打 HOME canonical sid(`engineHomeSid`),导出器 `schematicInstanceKeys[i] ∈ mask.keys` 灰化 —— 键 HOME = 灰随块(piece-following,与 sr/其它拼图同语义);`toEngineMask('cube')` 恒等(引擎 key 即 sid,免派生表)。net_index.test.ts 双射锁 + Playwright 实证 `U:0,2;F:3-5` 位置全对。**sq1 canonical id 空间已定稿并全链落地(2026-07-21,§2b 遮罩行有全记录)—— mask 直映五拼图(NxN/pyra/skewb/mega/sq1)全通,无剩余待办。**
- [x] 后悔药开关(2026-07-21):`?img_engine=sr` query(单 URL)+ env `NEXT_PUBLIC_SR_FALLBACK=1`(部署级,build 时内联)回退旧路径;sr 代码原样保留。
- [x] skewb-top 自绘 fan 保留不动(它不是 sr,是示意图另一形态)——「保留」决策已生效,零改动即完成。
- 验收:/sim 面板 4 拼图默认角 + 极端拖动角逐像素判据;golden fixtures 主动重录并逐张 review diff;CaseThumb / pattern / batch-solver 页 playwright 截图对照;新旧 4 拼图对比图给用户过目一次(风格从 sr 平面示意变成引擎平色预设,视觉会变)。

### Phase 4 — 服务端缩略图切换(2026-08-23 架构收口，本地待发布)
- [x] iso 只调用 `@cuberoot/puzzle-render-core/iso-svg`；旧 `engine_render.ts` 已删除，Server 不再跨包读取 Client 源码，渲染失败也不回退到第二套 iso 实现。top 仍是独立平面视图：megaminx-top 由 sr 提供，skewb-top 用共享 fan renderer。共享实现内部按拼图池化 World，并锁定 headless 相机矩阵、真实像素视口和逐请求状态复位。
- [x] `r=` 直接映射引擎场景欧拉(叠加在引擎默认视角上,= /sim 拖动语义);y→z promotion 不进引擎路径(sr 专属,随 sr 回退分支苟活到 Phase 5)。
- [x] **历史上线验收(2026-07-21 push)**:当时的 `engine_render.ts` 路径通过 8/8 图像 smoke，并以 Server 内 sr fallback 作为回滚。2026-08-23 的架构收口已经替换该实现和回滚策略；此条只保留历史证据，不描述当前运行路径。
- 当前验收（本地待发布）：`@cuberoot/puzzle-render-core` 独立 build、Node 四拼图无浏览器全局 smoke、Server bundle、类型检查和边界测试通过；Server iso 的失败语义为请求失败，不再静默切换第二套 renderer。发布后仍须复验四拼图路由与失败日志。

### Phase 5 — sr 退役(后悔药到期才做,单独会话工作包;非本工作线开放待办)
触发条件:Phase 3+4 上线后观察期内(建议 ≥2 周)无回退开关使用、无渲染 bug 报告。
**观察期起点 = 2026-07-22(Phase 3+4 push 上线,commit 67e5526938);最早可执行 Phase 5 = 2026-08-05 之后。日历门控,本会话物理不可执行;届时按下列队列单独会话操刀:**
- (队列)删 `packages/vendor-sr-puzzlegen` 整包 + client/server 依赖 + `PuzzleSVG.tsx` + `sr_render.ts` 旧路径 + 回退开关。
- (队列)删 `SR_INDEX_MAP` 派生表与 derive 测试(mask 已直映引擎 id)。
- (队列)清登记点:`knip.json`、`credits_data.json`、`/dev/stack` 文案、pnpm-lock。
- (队列)`TODO-sr-exact-match.md` 归档（历史价值并入本文件或 memory）；§3 的通用 `PuzzleImage` fallback 与 megaminx-top 去留一并处理。
- 净删量预估:−7,400(vendor)− 标定层/胶水若干,+ Phase 2 新增 ≈ 600-1,000。

## 5. 风险与开放问题
- **megaminx 三角量**:12 五角面 × 分块,BSP 分裂在高模下可能爆;示意图预设低模是主保险,Phase 2 先量三角数再动手。
- **sq1 薄中层**:kite/中层薄片共面 epsilon 要调(现导出器的平面簇偏置经验可复用)。
- **抽包半径（已决策）**：实际只提取四拼图无头渲染闭包，不搬完整 24k 行 engine；Client-only 交互和其余拼图保持原归属。新增消费者出现前不继续扩大 package。
- **风格即产品**:伴图/缩略图外观会从 sr 味变引擎味,Phase 3 验收含用户过目,不视觉偷跑。
- **NxN/VisualCube 当前边界**：`/sim` 的 `cube:normal` 伴图已用 live engine 镜像，过大或不适用场景仍回退 VisualCube；CaseThumb/Facelets、`/v1/visualcube.svg` 的 cube 分支、plan/trans/net 等语义图、阶段遮罩与箭头 DSL 继续以 VisualCube 为规范实现。它们不是四异形 `puzzle-render-core` 的重复职责；若未来考虑替换，必须作为独立工作包重新盘点消费者和视觉契约，不能借 Phase 5 顺带删除。

## 6. 时序
Phase 0 随时可做;1→2→(3‖4)→观察期→5 严格串行;3 与 4 可并行。每 phase 单独 commit + 全测试绿再进下一个。
**实际进度：2026-07-22 的 Phase 0-4 旧实现已上线并完成当时验收；2026-08-23 又以窄 `puzzle-render-core` 替换 Server 跨 Client 源码路径，本轮本地验证完成、尚待发布。原完整 `sim-engine` 搬移不再是待办；剩余重复实现与回退统一归 Phase 5 删除工作包。**
