---
name: sim-add-puzzle
description: "用户说造魔方模拟器、给 /sim 加魔方、新魔方类型、X cube simulator 或拖拽转动时使用。覆盖 Three.js 3D 渲染、转角动画、raycast 拖拽及招式接入；只处理模拟器交互，新求解器引擎走 new-substep-solver。"
---

# sim-add-puzzle

给 `/sim` 加新魔方类型(站内渲染 + 转角动画 + 拖拽转动)。写真「引擎类型」,不写一次性 HTML 页面。
求解器引擎走 skill `new-substep-solver`;本 skill 只管渲染 + 动画 + 交互。

## 先分流(动手前定这 3 件)
- cubing.js 有 `pg()`(PuzzleGeometry,有 3D 模型)→ 走 twisty(`TwistySection`),不碰自有引擎;只有 `svg()`(仅 2D net、没注册)→ 必走自有引擎(实测:`redi_cube`/`dino` 都得自有引擎,别被 twizzle 能开 2D net 误导)。
- 先定转动元素:**面/层**(NxN/SQ1)、**角**(绕体对角线 120°,Dino/Redi/Ivy/Rex)、**棱**(绕棱中点轴 180°,Heli)、**面**(绕面法线,Megaminx/FTO)——它定轴集 + 状态周期表 + pivot 朝向。
- 要打乱/解法但没 solver → 先按 skill `new-substep-solver` 造 `lib/<x>-solver.ts` 再回来接渲染。
- 保立方体形的标准转才做;深切魔方的 jumble(转出非立方体形)不做。
- **没有立体形态的拼图(魔表)走「平面引擎」,别硬造 3D**:`/sim` 与 twizzle 一样只有 2D。做法 = **mesh-less 引擎**:`ClockCube` 只挂空 `THREE.Object3D` pivot 当动画载体(18 个,前后各 9 盘),真正的画面是 `_SimClockBoard.tsx` 覆在上面的 `components/InteractiveClock`(全站共用的那块 SVG 板),每帧读 `pivot.rotation.z` 经 `animOffset(dial)` 喂 SVG。等于把「引擎只算、渲染另接」这条缝显式化了 —— NxN 的 `_SimCubeNet` 平面视图是同一条路。能力门控走 `simCaps.ts` 的 `flat` 旗标(`scale`/`hint`/`dragEmpty` 一律 `!flat`),别给某拼图手写 `disabled={puzzleKind==='clock'}`。
- **非均匀切割的 NxN 变体(镜面 / Bump)别新建引擎**:扩 `engine/nxn` —— logical 层保持均匀(转动 / twister / controller / 打乱 / 播放 / 配色全复用零改),只在 `instanced.ts` 加 mirror 模式把渲染 matrix 换成 `compose(R·center0, R, scale0)`(范本 `engine/mirror/mirrorGeometry.ts` + `new Cube(order, true)`)。**再加一个阶数只改 `CORE_OFFSET` 那张表 + 各注册表加一行**,别复制引擎。
- **twizzle 式「自定义切割」编辑器**(基础多面体 c/t/o/d/i + face/vertex/edge cuts 任意深度)= 纯 UI:拼 cubing.js puzzle-description 字符串喂 `TwistySection.puzzleDescription`(= `experimentalPuzzleDescription`),零几何移植;范本 `app/[lang]/sim/CutEditor.tsx`(SimPuzzle `'custom'`,desc 进 URL `cuts` query + debounce 重建)。

## 模板

新建或修改引擎前，必须读 [引擎范本](references/engine-templates.md)，选择对应机制并遵守末尾的通用几何约束；其中 `engine/` 等局部路径相对 `core/packages/client/app/[lang]/sim/`。

## 工作方式
- 直接在主树编辑(要读 Ivy/SQ1/dino 当范本);worktree 只配「盲测提示词」场景。
- 5 个共享文件是多 AI 热点:`engine/world.ts` / `PlayerControls.tsx` / `SimPage.tsx` / `SettingDrawer.tsx` / `lib/sim-recon-link.ts`。
- 3x3 手部 rig(`engine/hands/`)每帧轮询 `groups[axis][layer].angle`:改层角语义 / 整体转 / drop 时序会牵动手势,动完必跑穿模 oracle + 换握 oracle(方法与四机制见 memory `project_sim_hands_rig`);指法规格(哪指做哪步 / 连拨 / `p` 推法记号)权威在 `engine/hands/FINGERING.md`;其它拼图无手(`supports.hands = kind===3`)。
- 先读 `git status`/diff,只暂存本任务新增和修改的内容,保留他人暂存与未暂存改动;无关 WIP 不阻塞,重叠时仅暂停无法安全分离的部分;默认不 push。
- 三方合并这 5 文件后必 `typecheck` + 读关键分支/依赖数组核对(无冲突标记 ≠ 语义对)。

## 动手前(几何先查证)
- **平面 SVG 先行(硬性)**:新模拟器 / 改任何轮廓几何,必须先出平面对比 SVG(`.tmp/png/`:黑=现行、绿=提议、蓝=冻结段、灰虚线=约束包络)给用户审核,**批准后才准动引擎代码**;禁止「先改了再让用户看 3D」。
- 轮廓修改教训(gear 2026-07-19):①只动用户点名的区段,其余顶点逐点 verbatim 冻结;②栅格追踪 / 生长算法出的轮廓必带 0.1-0.5 锯齿,交付轮廓要手工构造少顶点平滑段(斜率单调渐变),宁可让出零点几宽度换平滑;③法线外推够不到侧向角落,算真实可达域用区域法(自由格 flood + 边界追踪);④烘焙一次把占用栅格 dump 成 JSON,之后离线秒级迭代,别每轮重烤;⑤采样场余量是平面判据,3D 精细 oracle(rigid_check 类)才是终审。
- 先 WebSearch/WebFetch(twistypuzzles wiki / Jaap's / ruwix / speedsolving)查真实切割结构:切割面形状(平面?球面?锥面?)、轴 / 转什么、每种块判据、有无永不露面的内部。
- 查 cstimer 对该魔方的打乱记号(cstimer 集成在本项目、近乎全覆盖)= move set + 记号约定的权威来源,直接定 parser / 状态模型。
- 面形单独查证(机制同 X ≠ 面形同 X):从 2D net / 官方图标 / `components/EventIcon/svg-map.ts` 的 `unofficial-<x>` / 真机近照确认每片可见形状;cubing.js net 的 `<rect>`/`<polygon>` 当真值用。
- fail-fast:先只渲 solved 截图对账参考图(面形对上)再投入转动/拖拽。

## 零穿模不变式(任何魔方,先读这条)
- 每片 = 它周围所有切割面围出的实体。
- 隔开「会动片」与「不动片」的那张切割面,必须在该转动下保持不变(invariant):会动片造在其内侧(`∩`)、不动片造在外侧(`−`)→ 构造性零穿模(数学为 0,不是「小到看不见」)。
- 切割体必须以转轴为对称轴;网格化时让网格的 N 重对称轴对齐转轴(平面 = 球面半径→∞ 的特例)。

### 按切割面落地
- **平面切**(面/层转、平面切角转 Dino、棱转 Heli):绕轴转自动不变(180° 也不变)→ 挤实心 wedge 即可,无 CSG、无曲边弧(贴片走直边 `quadraticCurveTo` 圆角 + `extrudeOntoFace`/`ExtrudeGeometry`)。
- 平面切缝宽由切平面偏移定:动块 `C·v≥CUT·H`、静块峰值 `(2−CUT)·H`,零穿模 ⟺ `CUT≥1.0`;面上黑「X」缝 `=(CUT−1)·H`,取 ≈1.07(留余量,别到 1.0);锁回归测试(`tests/dino_no_interpenetration.test.ts`)。
- Heli 棱片的 cap-edge 集合与招式生成元同源(动哪几片由同一组 plane-side 判定),否则渲染与状态错位。
- **球面切角转**(Ivy/Rex):隔离面 = 球心落在转轴上的球;网格球转到「N 重对称轴 ‖ 转轴」(`alignedSphereGeo` 用 `setFromUnitVectors`);会动片 `∩ 球`、不动片 `− 球`。
- Rex:球心 = `s·V`(s≈1.3,在角轴上)、半径过该角相邻 3 顶点 → 6 中心(∩4−4)+24 花瓣(∩3−5)+12 棱(∩2−6);别用平面 ⊥ 轴切(=Master Skewb)或等径顶点球(=脏带)。
- 写脚本枚举半径/球心定面分区,别手推;**派生脚本放持久 `core/packages/client/scripts/<x>/`(tsconfig exclude),禁写 `.tmp/`(会被清)**,范本管线 `scripts/gear/mesh_check.mjs` + 独立重导锁 `tests/rex_state.test.ts`。
- **方块面角转**(Redi):做不到精确零穿模 → 用小缝(贴片 inset + body 圆角微缩)+ 接受 cap 抬升,别为零穿模改面形;范本 `engine/redi/rediGeometry.ts`。
- **啮合/干涉转 + 钦定参考轮廓**(拿不到构造隔离面,如 gear 角块贴纸):齿伸进邻件工作半径,靠恒定齿比**相位同步**错开(非避扫掠体积——旧「避全程体积」谓词过度保守会把贴纸缩成血块);先 SVG 逐点验旧谓词违规=你模型错不是 SVG 错。做法:离线把动件两分支×360°×0.5° 扫成二维占用足印栅格,轮廓走**最小平滑形变**(安全点逐字留 SVG → 越界点沿平滑法线场内移平滑上包络 G1 → 深坑沿安全等值线 Newton 桥接 → 裁剪残尖定向贝塞尔圆角 → 接缝约束整形);**禁硬布尔裁剪**(marching-squares/chaikin/量化都会熔尖+出台阶,整形侵蚀上限只够磨到 r≈1.7)。离线细扫烘 `CORNER_POLY` + 独立粗扫 vitest 双判据锁(别同源自证)。范本 `core/packages/client/scripts/gear/mesh_check.mjs` + spec 同目录 `GEAR_FRONT_SPEC.md §9`。
- 验:单次 eval 内 setup 半转,算「会动片每顶点到隔离面有向距离 ≤0、不动片 ≥0」且跨 0/50/80% 进度恒定 = 隔离面真不变。

### CSG(切片用 `three-bvh-csg`)
- `pnpm add three-bvh-csg`;`new Evaluator()` + `new Brush(geo)`(每 brush `position.copy(中心)` 后 `updateMatrixWorld()`)+ `evaluate(a,b,INTERSECTION|SUBTRACTION)` 链式。
- `Evaluator.attributes` 留默认 `['position','uv','normal']`(改成 `[]`/`['normal']` 会崩)。
- 输入网格带 position+normal+uv(Box/Icosahedron 自带,别 `deleteAttribute`)。
- 相邻两片共享的切割面用同一个 brush 实例 → 切面逐三角重合、无缝无叠。
- CSG 插值法线天然「平面平、曲面滑」,免 `computeVertexNormals`。
- 范本 `IvyCube._buildBodies`:每片 = 立方体 ∩ 自己的切割球 − 其余球。
- **贴纸浮起假 → 轮廓柱体交(silhouette solid/visual hull)**:每张贴纸=底面,沿面法线挤全深柱体,`∩` 全部柱体 = 块身 → 贴纸是块的真面、任意视角剪影=该面轮廓,不再是浮贴花。**必严格交(∩)非并(∪)**,并集会让别面柱身凸出本面轮廓。面板挖深到交集顶棚(邻面轮廓顶缘)以下扎根,别悬浮透缝。毛刺:柱端帽落他柱平面范围外(整帽被弃、不参与切分)+各柱错开内缩防共面喷渣;测试锁全顶点每坐标≤轮廓 max。范本齿轮角块 `gearGeometry buildCornerPiece`。

## 引擎契约(照抄 SQ1/Ivy)
新建 `engine/<x>/`:
- `<X>Cube extends THREE.Group`:`puzzleType`/`order=0`/`dirty`/`callbacks[]`/`history`/`twister`;每片一个 pivot at 原点(quaternion=真值);`beginMove(move)→anims[]`、`finishMove`(bake 末态+推离散态+history+callbacks)、`applyMoveInstant`、`applyMovesInstant`、`reset`、`complete`、`dispose`。
- pivot 驱动 + 转角精确的魔方:`complete` = 所有 pivot `quaternion.angleTo(IDENT)<0.05`,免排列/定向离散态(范本 pyraminx/FTO)。
- `<X>Twister`:`setup/setupAsync/push/twist/finish/undo/redo`,用全局 `engine/tweener`;解析复用 `lib/<x>-solver` 的 parse。
- 每片 mesh 必标 `userData.simRole`:壳/块/frame→`'body'`、球核/内填充箱→`'core'`、色贴片→`'sticker'`(供结构着色/镂空/立体贴片/提示贴片通用层)。

### 几何硬要求
- 每片必须有体积:面/层转 = 实心块 `ExtrudeGeometry`(黑 body)+ 薄色贴片;角转/斜轴 = 真 CSG 立体角(见零穿模)。
- 色贴片解析画(真 2D 圆弧路径 + `ExtrudeGeometry` depth),别从 CSG body 三角 soup 抠(继承球面细分=折线 + 零厚度);范本 `rexFacePaths.ts`/`ivyFacePaths.facePathsGrooved`。
- 复用 `engine/stickerGeom.ts`(`arcPts`/`circleIntersect`/`offsetInward`/`polyArea2`/`roundCorners`/`cubeFaceBasis`/`extrudeOntoFace`)+ `engine/csgCut.ts`(`alignedSphereGeo`/`cutCell`);别再抄定向球/手写贴面挤出/各写弧采样。
- 贴片要圆角 + 有厚度:直边片用 `quadraticCurveTo` 圆角 + `ExtrudeGeometry` depth 做软垫(别用平 `ShapeGeometry`);范本 NxN `makeStickerShape` / dino `roundedTriSticker`。
- 直边片开缝 = `offsetInward(roundCorners(poly, ROUND), INSET)`,`ROUND` 留 ≈2× `INSET` 余量(否则内弧翻负半径扎尖刺);加粗缝(调大 INSET)同步调大 ROUND。
- 曲边片开缝 = 沿原曲线同心等距偏移(圆弧改半径、缝 = 两条同心真圆的等宽环带),解析生成新尖 = 两圆交点用 SVG `A` 弧发出;直边片才可朝质心缩。
- body 与色贴片共用同一条轮廓点(同形抬 `LIFT`),body 永不超出自己颜色;真 CSG body 除外(零穿模构造性保证,贴片改用内缩 grooved 轮廓盖上、黑缝=露出的 body)。
- 给实心体倒圆角用 Minkowski opening(各面内移 r 求 eroded 顶点 → 绕每个顶点 `fibonacciSphere` 采样 → `ConvexGeometry` → 删 normal/uv 后 `mergeVertices`+`computeVertexNormals`),别单刀 chamfer;范本 `roundedTetraBody`。
- 挤出贴片侧壁用材质数组 `[stickerMat(color), bodyMat]`(盖彩、壁黑;单材质 → 掠射角彩壁挡黑缝、分隔线消失)。
- 配色:上游(cubing.js/twizzle)有的魔方从 `lib/puzzle-geometry/colors.ts` 的 `defaultPlatonicColorSchemes()[面数]` 按面名映射进引擎面序;纯自有的才自定(仍走 `lib/cube-colors`)。
- 面法线取背离顶点侧的外法线(如四面体面 `m` 用 `-V_m`,贴片 lift/extrude/`simStickerNormal` 都用它),否则背面贴片从中心缝透出。
- 招式旋转 sign:选「`R(axis,+θ)` 把 `faceNormal(a)→faceNormal(b)`」对齐 solver cycle,别手猜符号。
- 抗锯齿:`SimPage` 渲染器已全局 `setPixelRatio(min(max(dpr,2),2.5))` 做 ≥2× 超采样,别改回 `setPixelRatio(dpr)`(dpr=1 屏会锯齿);验收放大到边缘像素级看。

## 必改文件
1. `engine/world.ts`:`PuzzleKind`/`cube` 联合类型 += x;加私有缓存字段;`setPuzzle` 加 `else if (kind==='x')` 分支(实例化、`controller.disable=true`、小件复用 `_ensureSq1Lights`);`resize()` 的 `refHalf` 给该 kind(实心魔方≈SIZE*4.0、框满≈0.85)+ near 裁剪宽放,`setPuzzle` 末尾已统一 `this.resize()` 自动重取景。
2. `PlayerControls.tsx`:`PUZZLE_TYPE_OPTIONS` += `{value:'x',iconClass:'unofficial-x',labelZh,labelEn}`;`SimPuzzle` += x;`PuzzleTypeSelect` 的 value 映射 + onChange 白名单含 x。
3. `PlayerControls.tsx`(角/棱转):`CORNER_SPECS` 注册表加 1 条(parse/toString/invert/reduce/scramble + `CornerCube` 接口)+ `cornerKind` 映射 1 行 → `corner` 描述符;所有播放分支 key off `corner`(`actions`/`cornerActions`/`totalSteps`/`jumpToStep`/auto-reset/`handleCaretSync`/play-loop/`simplify`/`invert`/`canSimplify`/`handleScramble`/`applyMove` guard/`is3x3`)。
4. `PlayerControls.tsx`(控件显隐 + 灰禁):全走 `simCaps.ts` 的 `CAPS` 表加 1 条 `{engine:'always'|'engineMode'|'never', carve}`;`resolveCaps(puzzleKind,renderer)` 给 `{engineActive, carve, hasRendererChoice, supports}` → 引擎开关=`caps.engineActive`、挖块=`caps.carve`、渲染器下拉=`caps.hasRendererChoice`;本地只留 `isNxNLocal = typeof puzzleKind==='number'`。**「该拼图不支持的设置变灰不可点」全自动**:`caps.supports.<控件>`(bool)从 engine 类型 + NxN 性派生(cubing.js 路径支持 scale/yaw/pitch/speed/hint/backView/animation/background + 锁定大小位置(lockView 通用,TwistySection wheel/pinch 守卫)+ 方位字母常显(faceLabels 仅 skewb/pyraminx/megaminx 走 `FaceOverlay`),其余引擎特性 + 面色/logo 走引擎/NxN),`Slider`/`Toggle`/`ColorRow` 收 `disabled`+`title`(=`hint(ok)` 统一提示),灰禁 CSS 走 `.sim-toggle--disabled`/`.sim-slider--disabled`/`.sim-color-row--disabled` + PillToggle `:disabled`。新魔方只填 `engine` 类型即自动灰对,**别**为某拼图手写 `disabled={puzzleKind==='x'}`。
5. `SimPage.tsx`:`asNxN` 对 x 返 null;`puzzleParam` 加 `if(raw==='x') return 'x'`;角/棱转写 `CornerTurnAdapter` 进 `cornerGestures` 注册表 + `cornerGestureFor` 加键,pinch-end `controller.disable` + render-loop `viewing` 各加 x;连续/异类(SQ1/Ivy)才手写 onPointerDown/Move/Up。
6. `SettingDrawer.tsx` `applySettings`:新 engine 魔方加进 `ENGINE_BODY_PUZZLES` 走 else 分支(`applyStickerThickness`+`applyEngineBodyOverlay`+`applyHintFacelets`);`hintBg`(`--background`)提到 if/else 前算一次;carve 走 duck-type `(world.cube as {setCarve?}).setCarve?.(s.debugCarve)`(Cube 实现 `setCarve(on)` 即自动接上)。
7. `lib/sim-recon-link.ts`:`SimPuzzle` += x;`reconEventForSim` 加分支(无 recon event 返 null)。
8. 图标 `components/EventIcon/svg/unofficial/<x>.svg`:先查 `EventIcon/svg-map.ts` 看是否已存在;键名用 `unofficial-<id>`(非 WCA 魔方用 `event-*` 会 miss → 空 span,不报错)。
9. `engine/<x>/<x>Drag.ts`(新建):raycast 命中 + 方向判定(见拖拽转动节)。

播放循环用 `twist(action,false,false)` + 仅 `started===true` 才推进 step(完成才接下一步);别用 `force=true`+固定 `setInterval`(会在缓动结束前砍掉 120° 转动);NxN 分支先 `if(cube.busy) return`。
所有显隐/能力走 `simCaps` 单一 registry,别写 `isTwistyLocal`/`isCornerLocal`/`isIvyLocal` 布尔链或 `puzzleKind!=='megaminx'` 单点补丁。

## 拖拽转动(每种魔方都做,不只整体旋转)
- 抓魔方任意位置都能转(别要求精准命中窄区);拖拽方向自动选要转的可动单元(角/面/层)。
- 范本:Ivy `ivyDrag.ts`(离散 120° 过阈值整步)、SQ1 `sq1Drag.ts`(连续跟手 + 松手 snap);`<x>Drag.ts` 运行时 `import * as THREE`(SimPage 保持 type-only)。
- `<x>PickHit`:`scene.updateMatrixWorld()`→`setFromCamera`→`intersectObject(cube,true)`;命中魔方任意件都返回(命中点 + 一组候选单元),脱靶才 null→orbit;鼠标在魔方上一律不 orbit。
- 候选单元只认 `hits[0]`,沿 parent 链读 `userData`(花瓣→它的角、中心→它 live 面相邻 2 角、缝/黑体→全部)。
- `<x>ResolveMove`:对每候选算「绕它转时命中点的屏幕切向」与拖拽向量点积 `s`,取 |s| 最大者、`sign(s)` 作方向(别用固定符号),离散魔方过阈值(~6px)触发整步。
- SimPage 接线:pointerdown 先 PickHit(命中→记 pending、`rotating=false`;脱靶→orbit);pointermove pending 过阈值→ResolveMove→`cube.twister.twist(move,false,true)` + `userMoveRef.current?.(move.name)`(传 string,免 TwistAction 吞多字符);非活跃时各分支 `if(pending){…return}`/`if(orbiting){…return}` 让出到底部双指 pinch,别整体 `return`。
- 离散角/棱转:用 `engine/cornerTurnGesture.ts` 的 `CornerTurnGesture` —— SimPage 写 ~7 行 `CornerTurnAdapter<Cube,Move,PickHit>`(`match` instanceof、`pickHit`/`resolveLive`/`resolveMove` 给 drag 函数、`beginMove:(c,m)=>c.beginMove(m)`、`moveToString`、`fullPx`/`threshold`)进注册表,别 copy 175 行 dispatch;连续(SQ1)/异类(Ivy)各写各的。
- 视角 orbit/snap 走 `engine/viewControls.ts` 的 `orbitScene`/`snapViewToQuadrant`,别内联 `scene.rotation.y+=dx*k`(NxN 的 `onOrbit` 不 clamp 是例外)。

### 通用功能接入

新增 engine 魔方，或修改渲染、交互、设置、伴图/背面小窗、手部、导出前，必须读 [通用功能契约](references/engine-features.md)，逐项保留适用接线与验收；其中 `engine/` 等局部路径相对 `core/packages/client/app/[lang]/sim/`。

## 双渲染器(cubing.js 原生 + 自有引擎可选)
- cubing.js 已支持(skewb/pyraminx/megaminx)又想要引擎独占开关时,保留两版:`SimPage.ENGINE_TWISTY` += id;`useEngine = isTwisty && ENGINE_TWISTY.has(id) && renderer!=='cubing'`、`twisty = isTwisty && !useEngine`;`PlayerControls` 收 `renderer`/`onRendererChange`、`isXEngine=id&&renderer!=='cubing'` 进 `cornerKind`;simCaps 声明 `engine:'engineMode'`(渲染器下拉自动出);引擎版用自有记号 → `reconEvent` 置 null。
- 非内置 cubing id 的提升(FTO):从 `pgCatalog.PG_PUZZLES` 删掉它(免类型选择器/explore 双列、路由撞名);cubing.js 版改喂 `SimPage.ENGINE_TWISTY_DEF[id]`(def 串)→ `TwistySection puzzleDescription` → `experimentalPuzzleDescription`;`pgDef = PG_DEF_BY_ID[p] ?? ENGINE_TWISTY_DEF[p]`、`isTwistyPuzzle`/`PG_BOUND_KINDS` += id。
- `renderer=group` 群论内核:照 megaminx 写 `engine/<x>/<x>PgBridge.ts` 接 PG 群(见 [[project_sim_pg_binding_layer]] 的「再加魔方 recipe」)。
- 群论面板同步 5 处:`pgBindings` BRIDGES、`simCaps` CAPS、`SimPage` `PG_BOUND_KINDS`+`ENGINE_TWISTY`、`GroupTheoryPanel.PG_BOUND`(最易漏,漏=面板挂载后内部 `bound=false` 一片空白)。
- engineMode 魔方默认 `renderer='group'`(`withDefault('group')`,下拉「群论内核」排第一,`handleRendererChange` 用 `r==='group'?null:r`);大群(>~10⁸ 带 word 建不动)bridge 标 `solvable:false` + `factsOverEngineGens`(PG def 带额外深 slice 时 |G| 只用引擎面生成元算)。
- **群论静态 facts 必须离线预计算,禁运行时 live Schreier-Sims**(会冻页:heli≈1s、7x7≈8s)。|G|/轨道/reassembly/约束指数/生成元只跟拼图有关=常量,烘进 `engine/pgFacts.generated.ts`。新 bridge 加进 `pgBindings.allBridges()`(NxN 已在里),然后 `GEN_PG_FACTS=1 pnpm --filter @cuberoot/client exec vitest run tests/gen_pg_facts.gen.test.ts` 重跑生成表(键=`bridge.pgName`)。`PgEngineBinding.facts()` 自动读表,漏了会 dev warn。只有跟当前状态有关的(元素阶/是否还原/2x2 BSGS 打乱还原)才 live。NxN 走 `nxn/nxnPgBridge.ts` 工厂(`nxnPgBridge(N)`,2..7,单层切片原子,2x2 solvable)。
- **PG 表示不了的拼图走 perm 路(非-PG 置换内核)**:决策树=对称平面切多面体→PG;否则→perm。PG 做不了的两类:非对称切(ivy 只转 4 正四面体角)、带隐藏朝向被 PG 多算(rex 中心 4 重朝向)。写 `engine/<x>/<x>PermBridge.ts` 实现 `PermBridge<M>`(engine/permBridge.ts):`key`(=facts 表键)、`orbits`(`permutes:false`=定位固定只转向)、`genPerms()`(从引擎自己 state model 抬:apply 到 solved 读 slot→source,g[slot]=source)、`moveToStep/stepToMove/parse/toString/solvable`。注册 `pgBindings.PERM_BRIDGES` + `createBinding` perm 分支返 `new PermEngineBinding(bridge)`(实现共享 `GroupKernel`,与 PgEngineBinding 同 surface),facts 生成器加 `permBridges()` 轮(键=`bridge.key`)。**大 perm 群 facts 别用 permGroup(带 word 建 OOM,如 rex ~5e27)**:`computeFactsLive` 的 `!solvable` 用 vendored `schreierSims(gens.map(g=>new Perm(g)))`。闭环 oracle 就用引擎自己的 applyXxxMove。范例:ivy(solvable 29160)、rex(facts-only A₆×A₁₂³)、mirror(=`nxnPgBridge(3)` 复用 3x3 kernel+facts)、redi(PG compy cube + `factsOverEngineGens` 去 ×12 深 slice)。sq1 出局(变形群胚,无单一 |G|)。科普页 `/math/kernel` 数字全从 `PRECOMPUTED_PG_FACTS` 读,加拼图后覆盖表自动跟。

## 记号约定
- “随机打乱”只生成并立即应用终态；打乱动画只由旁边的播放按钮触发。
- 拿方朝向下拉顶部写明左色块是顶面、右色块是前面；每项用两枚实色色块标出顶面与前面，同时保留 `(UF)` 字母提示。
- SQ2/SQ4 简化记号保留元组括号和逗号,只移除安全空白,避免 Square-4 两位数转角产生歧义。
- 裸字母 = 玩家从外看的顺时针(= dir −1 / −120°);写反则玩家拖顺时针被记成带 `'`。
- /sim 是自包含世界(自己的随机打乱 + 拖拽):显示/记录用标准记号,即便 solver(cstimer)记号非标准也别动 `lib/<x>-solver`(它喂 /scramble 打乱/预览/求解,保持 cstimer 一致)。用 WCA/cubing.js 记号,别自造(如 skewb 引擎 8 grip 别记 `UFR/UFL…`,走 cubing.js 全 8 角族 `F/U/B/D/L/R+UL/UR`,WCA 打乱只 `R/U/L/B` 4 角子集;字母↔角按面集对齐 cubing.js,裸=CW 手性通常已对;`face_hints` 标签同步)。记号功能子集(WCA 4 角)可只喂随机打乱,拖拽仍可转全部单元(记扩展 token)。范本 memory [[project_sim_skewb_wca_notation]]。
- namer(`pickMove`/`<x>MoveToString`)和 /sim 自己的 parser(`parse<X>Moves`)必须成对翻转,否则录下的名字回放成反方向;物理 `beginMove`/`apply<X>Move` 用 dir 不动。
- involution/对称转(Heli 180°,顺逆终态相同)动画也跟手做两方向:给 move 加 cosmetic `dir?:1|-1`(状态/记号忽略它),`<x>ResolveLive` 把 `score.dir` 烤进 move,`beginMove` 用 `(move.dir ?? sweepDir)*ANGLE` 定扫动符号。
- alg/打乱输入框坏 token 别 throw(async `jumpToStep` 里 throw = 崩页):token 分类器算 validity(坏则早退、totalSteps=0)+ mirror 高亮层标红(范本 `classifyIvyTokens` + `.sim-player-hl`);strict parser 只留求解器。
- 改记号约定同步改锁约定的 baseline 测试。

## 验证(必做)
- 干净 worktree/新 clone 先 `pnpm -F @cuberoot/shared build && pnpm -F @cuberoot/visualcube build`(否则 typecheck/dev 报缺 `@cuberoot/visualcube`/`@cuberoot/shared/admin`)。
- `pnpm --filter @cuberoot/client typecheck`(tsgo)。
- Playwright 开 `127.0.0.1:3000/zh/sim?puzzle=x`:① solved 看花纹(非实色,对账参考图);② 随机打乱看乱态(招式动画 + 颜色跨面);③ 拖某可抓件 → 单件转动 + 解法框追加 token,拖中心/空白 → 转视角(合成 PointerEvent 打 canvas、读第 2 个 `<textarea>`.value)。
- 图像浮层逐个 kind 实测 solved 和打乱态与 3D 的可见面、切分数、颜色、状态一致;测试锁 `schematicPoly` 朝外绕向和可见小面数,禁只验主画布或拿一个 kind 代测。
- 转动动画抓中间帧(首尾帧 bake 后一定对,bug 只在中间):临时 `window.__sim={world,renderer,THREE}` → `beginMove` 取 anims → 逐 v 设 pivot+`render`+截图 ≥5 帧;端态受影响面应混色、开口应是平滑曲面非平板/尖扇形(开「结构着色」:core 品红、body 青);验完删句柄。
- occlusion 别只截图猜:藏掉所有 `simRole==='body'/'core'` mesh 重渲,弧立刻完整 = 贴片对、body 盖前;定位用逐像素 CPU raycast 出 ASCII 角色图(每格取最近命中 `simRole`/色),按 hit 的 pivot quaternion 分类 moving/stationary。
- Windows Next dev 截图写进 `.tmp/` 会触发 HMR remount 把 cube state 重置成 solved(见 [[feedback_windows_next_dev_restart]])→ scene-graph 取证一律「单次 eval 内 setup turn + raycast 出文本」(不截图);Playwright MCP 截图只能落 `core/.tmp/png`。
- 质量门(报 done 前):① 几何/视觉放大到单弧/单贴片占屏一大块目检(正常视角藏折线/扁平);② 拿本 skill 与本次适用参考文件的每条硬要求对着实际产物逐条核(凭记忆核=漏);③ 收尾把「找茬验收」外包给 fresh-context 评审 agent(只喂硬要求 + 放大截图);④ 曲边贴片必配几何回归测试卡「每个区最大转角 < ~50°」(针刺=120-180° 反向转角;软目检会失效、CI 测试不会),红了用 2D 离线精确复刻排查(范本 `rex_2d_face`/`rex_2d_corner`)。
- 数学/几何推导用脚本/独立重导测试锁死(范本 `tests/rex_state.test.ts` 从零重导对账;派生脚本持久化到 `scripts/<x>/`,别留 `.tmp/`);核心搭建(geometry→state→cube→twister→drag→接线)强顺序 + 踩 5 共享文件,别拆并行。
- 改完动 /sim 必回写本 skill + 相关 memory(见 [[feedback_maintain_sim_skill]]);回写一条规则一行、祈使句、只写怎么做,根因/坑的来龙去脉放 memory。
