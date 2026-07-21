# /sim 图像面板 异形拼图 sr 精确一致 — 进度

方案 A:异形(sq1/pyraminx/megaminx/skewb)右侧 sr 预览 = 朝向 + 配色 + 透视 + 状态 与左边 3D 一致(风格用 sr,不复刻 sim 网格外观)。详见 memory `project_sim_exotic_sr_exact_match.md`。

## 关键发现
1. **sim 异形引擎用「固定配色」,不是 faceColors 面板**
   - **skewb** → `CUBE_FILL`(WCA 标准,`@/lib/cube-colors`)
   - **sq1** → `SQ1_COLORS`(`engine/sq1/sq1Colors.ts`)
   - **pyraminx** → `CUBE_FILL` 按面 index
   - **megaminx** → cubing.js `defaultPlatonicColorSchemes()[12]`
   `srSchemeFor` 必须喂这些固定色,不能喂 `spec.faceU..B`(改色即分叉)。
2. **异形默认左边 = 自有引擎**(`renderer` 默认自 `9a3155961e` 起为 `'group'`,`ENGINE_TWISTY={skewb,pyraminx,megaminx,fto}` 全走自有 3D;sq1 一直是自有 sq1 引擎)。标定判据必须用**实际默认渲染器** —— 2026-07 前的标定对着 cubing.js TwistyPlayer,渲染器默认切换后全部重标过一轮。
3. **sr 各拼图有自带默认 `rotations`**(`sr/dist/lib/visualizer/options.js`):cube/skewb `[{y:45},{x:34}]`、sq1 `[{z:-34},{x:-56}]`、**pyraminx `[{z:60},{x:-60}]`**、megaminx **无**(identity=F 面朝前)。传显式 rotations 会**覆盖**这个默认。

## 已完成(全部实证对齐左边 = 自有引擎;2026-07-21 重标)
| 拼图 | 配色 | 朝向(SR_ANGLE_BASE) | 透视 | 状态 |
|---|---|---|---|---|
| **skewb** | `CUBE_FILL` ✅ | `{yaw:100}`(几何 90=F 平视 + 默认偏置 10)✅ | ✅ | 完成 |
| **sq1** | `SQ1_COLORS` ✅ | `{yaw:0,pitch:-90}`(渲染器没换,原标定仍准,实证复核)✅ | ✅ | 完成 |
| **pyraminx** | `CUBE_FILL` ✅ | `{yaw:112,pitch:-90}`(几何 z=simYaw+120 / x=simPitch−90:sr z 尖轴自旋 红0/绿120/蓝240、x 俯拍0→平视−90;yaw 默认偏置 −8),srPuzzleAxis y→z ✅ | ✅ | 完成(0/0 锚点=正对绿面 精确;默认 30/30 红缝宽度像素对齐) |
| **megaminx** | sr12键→cubing 映射(代码钉死同手性)✅ | `{yaw:0,pitch:-19}`(几何 −26.57=十二面体坐 D 面时 F 上仰角;偏置到默认 上下30 U 带宽度对齐)✅ | ✅ | 完成(yaw 1:1 跟踪实证,含 30° 方向核) |

偏置原则 = **默认精确**:sr 相机对侧面/顶面的「每度揭露量」略低于引擎 72mm 相机,纯几何 base 在默认视角下缝/带偏窄;把差额并进 base 使默认像素对齐,偏离默认后近似(与旧标定同策)。

- **透视 P2 ✅**:相机距离已是 fork 正式选项 `SVGVisualizerOptions.cameraDist`(sr 收编进 `@cuberoot/vendor-sr-puzzlegen` 时把原 `sr-puzzlegen-patch.ts` 的 runtime camera 重建烧进 `Camera` 构造器,灰面 painter 修复烧进 `PolygonRenderer.renderPolygons`,补丁文件已删),距离由 `PuzzleImage.srCameraDist(spec.dist)` 驱(SR_DIST_BASE=3.9),scale∝dist 保尺寸。四拼图透视滑杆实时驱动、方向跟左边。
- **img_dist ✅**:非 cube 分支现也写 `patch.dist`,sr 消费它当透视 —— 不再是死参(原「切异形后残留」问题解决)。
- **skewb 记号 ✅(实证无手性 bug)**:`setup=R` 左右**状态完全一致** —— sr 的 skewb `R`==cubing 的 `R`,不需要记号翻译。之前误判的「分叉」= `alg=`(左边 twisty 当**待播放动画**显起始态)vs sr(**应用**显末态)的语义差,不是记号问题。另加 `toWcaSkewb`(imgInherit 里,与左边一致)修 Sarah 记号:sr 正则会把 `UL/UR` 拆成 U+L,翻成 WCA 后两边一致(默认 WCA 时是恒等,只影响 Sarah 用户)。

## 残留(非阻塞,已知)
- **pitch 偏离默认后近似跟踪**:pyra/mega 的 pitch 有常量偏移(additive 角度模型,tilt 基座不与 yaw/pitch 交换),默认精确、偏离近似。yaw 对 mega 是 1:1、对 pyra 连续。根治需把基座姿态改成「前置固定旋转 + 世界系 yaw/pitch」模型(改 SimPage↔PuzzleImage 契约,风险高),暂不做。
- **alg vs setup 语义**:面板对 `alg` 显**末态**(应用 setup+alg),左边 twisty 对 `alg` 显**起始态**(待播放)。有 `alg`(非 setup)时两图天然不同 —— 这是交互播放器 vs 静态快照的固有区别,非 bug。`setup`(打乱)两边都应用、一致。
- **sq1/mega 记号未逐一 live 核**:sq1 经 `canonicalSq1Alg` 桥接、mega 喂 Pochmann 两边都解析(research 判定一致);skewb+pyra 已实测。如需可后续对 sq1/mega 各做一次 `setup=<move>` 左右比对。

## 标定法(如需再标)
temp 在 `PuzzleSVG.tsx` 的 `import('@cuberoot/vendor-sr-puzzlegen').then((mod)` 回调里挂 `window.__srMod=mod`(用完删;sr 已收编为 workspace 包,无 runtime patch),浏览器 eval `mod.SVG(host, mod.Type.XXX, {width,height,puzzle:{scheme,rotations}})` 扫候选栅格对左边 GL canvas 目视选。判据=左边(实际默认渲染器)。彩虹 scheme 读键位:megaminx 12 键 `{U F R dr dl L d br BR BL bl b}`、pyraminx 4 键 `{left right top back}`。滑杆 index:灵敏0 缩放1 透视2 Yaw(左右)3 Pitch(上下)4 转速5。
