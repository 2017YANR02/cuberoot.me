# sr-puzzlegen + visualcube 退役计划 — 引擎解析矢量导出统一路线

状态:**Phase 2 完成、Phase 3 /sim 镜像上线(2026-07-21,含 NxN)**。决策(2026-07-21):给自有 /sim 引擎做**解析隐面消除(BSP)矢量导出**,伴图 + 服务端缩略图全走它;`@cuberoot/vendor-sr-puzzlegen` 整包**先不删,当后悔药**,切换稳定后最终删除。追加决策(2026-07-21):**NxN 伴图同路退役 visualcube**(cube:normal 走 BSP 镜像;visualcube 包同样先不删当后悔药)—— §5 原「NxN 不在本方案内」作废,收窄为「visualcube 的无 live-sim 消费方(/visualcube studio 任意 spec、CaseThumb、服务端)仍走 visualcube,随 Phase 1 抽包 + Phase 4 一并评估」。

**最终目标定稿(2026-07-21 用户指令)**:**完全退役 visualcube 和 sr 两个渲染后端**(代码都先留着当后悔药,以后单独会话再删)。退役硬前提:**visualcube studio 现有功能一个都不能少**,能抄的全抄进引擎路线,见 §2b 对照表;别重复造轮 —— UI / DSL / 解析层照搬,只换渲染后端。网格观感抄 visualcube 的 **inset 模型**(贴纸向心缩、壳色衬底,缝宽 = 小面固定比例),弃绝对 px 描边 —— 固定 px 在高阶 NxN 会吞掉贴纸整图发黑(40 阶用户实测)。

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
| 视图 normal(iso) | drawing.ts 三面投影 | /sim 伴图已镜像(示意/BSP) | ✅ |
| 视图 plan(俯视含侧带) | 同上,俯视 + 四侧首排 | `sim_plan_export.ts` 的 `exportSimPlanSvg`:平面 OLL 图 = 中央 U 面 N×N + F(下)/B(上)/L(左)/R(右)顶排侧带,颜色全走已核验的 netIndexOf(`serialize[block·N²+netIndexOf]`),侧带按全局轴对齐(非镜像)。SimPage flat 分支 + engineMirrors/engineShown 收 `cubeView==='plan'` | ✅(2026-07-21;NxN;取等价平面 OLL 图而非 visualcube 略透视俯视;实测单移动 R 朝向/侧带左右序全对) |
| 视图 trans(半透明) | cubeOpacity/stickerOpacity | 示意导出器加 `showHidden`(跳背面剔除,已有 z 排序 far→near + bodyOpacity 让背贴纸透出前壳)；SimPage 对 `cubeView==='trans'` 套 visualcube 预设:银壳 #BFBFBF + 50% 不透明(未显式改壳色/不透明度时),X 光 3D | ✅(2026-07-21;NxN;实测与 visualcube trans 观感等价 —— 半透银壳 + 背贴纸透出) |
| 视图 net(展开图) | 平面展开 | `sim_net_export.ts` 的 `exportSimNetSvg`:读 `cube.serialize()`(URFDLB N² 块,net 朝向)→ 十字布局逐格上引擎面色,纯字符串 SVG。布局常量与交互式 `_SimCubeNet` 单一源(它 import 这里)。SimPage engineSvg 效应加 net 分支(serialize 签名,不走 3D 采样);PuzzleImage/studio 的 engineMirrors/engineShown 收 `cubeView==='net'` | ✅(2026-07-21;NxN;实测跟踪打乱、下载同源;遮罩键 `face:idx` 已备,SimPage 侧透传待接) |
| 视图 wca(记分表样式) | tnoodle 风格平面 | 同 net,引擎状态直出 | ✅(2026-07-21):cube 的 wca 与 net 是同一展开图(render.ts 两者同出 `renderUnfoldedSvg`,产出一致),故复用 `exportSimNetSvg`——SimPage net 分支 + engineMirrors/engineShown 均收 `cubeView==='wca'`。非 cube(skewb/mega)wca 仍走各自 scramble-display,不在 NxN 退役范围 |
| 图片尺寸 (PX) | svg width/height | `lib/puzzle-image/engine-svg.ts` 的 `sizeEngineSvg`:root <svg> 宽高钉 size×size(viewBox 保留 → meet 等比不变形);显示 / studio 预览 / SVG 下载三处共用一份。PNG 下载走 canvas=imageSize² + contain-fit | ✅(2026-07-21;此前 SVG 下载漏套尺寸=导出器原生像素,已补) |
| 箭头(面/从/到/过/缩放/影响/颜色 + DSL + 默认箭头色) | arrows 解析 + renderArrows | `engine/nxn/vcArrowBridge.ts`:复用 visualcube `parseArrows`(不重造 DSL)→ `faceletFromNet`(netIndexOf 的逆,round-trip oracle 锁死全 6 面)→ 局部贴纸中心 × 示意 mesh matrixWorld(锚 mesh 变换,固定几何位、随相机+打乱精确)→ SimPage 烙进 `opts.arrows`。studio 箭头 UI/DSL 原样透传 | ✅ 直箭头(2026-07-21;NxN normal;色/缩放/默认色通,打乱不变性实测)。曲线(s3/influence 的二次贝塞尔)+ 单面外跨面 waypoint 暂缺 → 退化直线,导出器只画 `<line>` |
| MASK 预设(fl/f2l/oll… + rot) | mask 枚举 | ①非 NxN 走 canonical DSL → 引擎贴纸 key 直映;②**NxN 整套 visualcube MASK 已并进 /sim 主魔方 stickering 下拉**(`engine/nxn/vcStageMask.ts`:复用 `makeMasking` + 标准展开图桥,逐小面二值灰化 3D 真机,伴图读 mesh 色天然跟随;按语义去重引擎自带阶段;crossColor 重定向)| ◐→**NxN ✅**(pyra/skewb/mega 直映通;sq1 id 空间待做) |
| 贴纸遮罩(`U:0,2;F:3-5` + 点选编辑) | facelet 级遮罩 | 同上直映层;点选编辑 UI 照搬 | ◐(pyra/skewb/mega 通;NxN 伴图直映、sq1 待做) |
| 壳体色 | cubeColor | 导出器 bodyColor 参数(inset 衬底色) | ✅(已接 /sim 引擎伴图,2026-07-21) |
| 壳体不透明度 | cubeOpacity | 导出器 bodyOpacity | ✅(已接引擎伴图) |
| 贴纸不透明度 | stickerOpacity | 导出器 stickerOpacity | ✅(已接引擎伴图) |
| 投影距离 | dist(透视强度) | 引擎相机距离/fov 映射 | ✅(架构已满足,2026-07-21 核实):/sim「透视」滑块 = dolly-zoom 直控相机距离+FOV(35mm 等效焦距,PlayerControls `UNIT_FOCAL`),引擎镜像共享 live 相机 → 投影距离即透视滑块。且 `settings.perspective` 已写入 `img_dist`(SimPage 1704-1723)双向接线。studio 独立 `dist` 控件仅 standalone /visualcube 页显示(`showInheritedControls = mode==='page'`),驱动 visualcube 渲染,/sim panel 不显示 |
| 黑边(网格缝宽) | inset 0.85 + 底色缝 | 示意导出器 inset 模型(滑块 = 缝宽占小面比例) | ✅(2026-07-21) |

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

### Phase 0 — 判据先行(小)✅ 2026-07-21
- [x] 固化现有 golden(`verify_puzzle_image_golden.cjs` 28 查询)为切换前基线。实证:对 /visualcube(page 模式)**28/28 逐字节吻合**,基线仍有效,覆盖全部渲染分派分支。
- [x] 像素计数 oracle 脚本化 → `scripts/verify_engine_svg_pixel_oracle.cjs`:同页同相机下,栅格化「引擎导出伴图 SVG」与「WebGL 画布」各成 256²,逐色统计「该色/全部着色像素」面积比,断言两侧比例一致(容差默认 8%)。调色板取自 SVG 自己的 fill(按色相最近归桶 → 对打光免疫);saturated OR 近白才计入(滤灰塑料倒角)。实证 **8/8**(2026-07-21):pyraminx 0.1% / sq1 0.2%(schematic 精确跟随相机)、skewb 2.9% / mega 2.7%、**NxN(BSP)cube-2/3/4/6 全 6.2–6.8%**。
  - **观察(记 Phase 3 待查)**:所有 NxN 的 BSP 伴图「白(U 顶)面」系统性比 3D 低 ~6%、「绿(F 前)面」高 ~6%,四个阶(2/3/4/6)一致 → 非随机噪声,是 3D 顶面受光最强、AA 边界近白像素被就近计成白(BSP 路径比 schematic 的 0.1% 显著)。当前容差 8% 放得过、gross 回归(画错面/镜像/错打乱=双位数差)拦得住;真要压到 ≤2% 需 BSP 相机与 live 3D 相机零偏移复核 + 高光抑制,列 Phase 3 精修,不阻塞。不进 CI(要浏览器+WebGL+dev server)。

### Phase 1 — 引擎核心可 headless(抽包)
- [ ] 从 `app/[lang]/sim/engine` 抽 headless 核心到工作区包 `@cuberoot/sim-engine`:群论内核、拼图几何构建、场景组装、配色。禁 DOM/WebGL import(logo 纹理等 client-only 能力 gate 掉)。交互层(指针/动画/手/全身)留在 client。
- [ ] client 全量改 import 路径;server 可 import(先例:server 已 import `@cuberoot/visualcube`、`@cuberoot/shared`)。
- 验收:Node 裸脚本能建出 skewb world 并数出三角形;client typecheck + 全测试绿;/sim playwright smoke 行为不变。

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
- [ ] 待用户过目 4 拼图新旧观感(风格从 sr 平面示意 → 引擎实模投影)后,再决定是否需要示意图预设形态。
- [~] mask 直映:canonical DSL → 引擎贴纸建构 key(`userData.stickerKey`),替代 SR_INDEX_MAP。**pyraminx + skewb + megaminx 已通(2026-07-21)**:几何烙 key → `tests/_engine_mask_derive.ts` 共轭派生(引擎侧置换从建好的 3D 场景几何读出:层内晶格质心绕轴转、落槽匹配即置换)→ `data/engine-sid-map.json` 锁表(engine-mask.test.ts:逐字节重推 + 双射 + 块结构守恒 + 端到端灰化渲染)→ `toEngineMask` → schematic 导出器 `mask` 选项 → SimPage 烙进镜像。无表拼图 SimPage 置 engineSvg=null 回退 spec 渲染器,两条路都不丢遮罩。genMap 三法:pyra 顶点字母同名 + 双手性试解;skewb 中心面 3-循环 ⊆ 轴旋转面循环且 3 面在轴正侧(动侧,否则差整体旋转)一次钉死轴+手性;mega 复用 deriveMegaGenMap(U/F 锚)+ **第三锚 R='R' 破镜像**(双手性下镜像配反手性群层面也能共轭,必须几何锚排除;底环面名对映逐面吻合方位角:DR→C 54° / DL→A 126° / DBL→I 198° / B→BF 270° / DBR→E 342°)。**待办:NxN instanced 要走 posit 追踪(色随打乱走,mesh 不动,另一条路);sq1 要先定义 canonical id 空间(解锁 sr 做不到的 sq1 mask);studio 遮罩编辑 UI(点选)对 skewb/mega/pyra 引擎镜像联动复查。**
- [x] 后悔药开关(2026-07-21):`?img_engine=sr` query(单 URL)+ env `NEXT_PUBLIC_SR_FALLBACK=1`(部署级,build 时内联)回退旧路径;sr 代码原样保留。
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
