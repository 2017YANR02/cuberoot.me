---
name: sim-add-puzzle
description: 给 /sim 加一个新魔方「模拟器」=站内 3D 渲染 + 转角动画 + 拖拽转动的新「类型」(不是一次性 HTML 页面)。当用户说"造某某魔方模拟器""给 /sim 加 X 魔方""新魔方类型""X cube simulator"时用。覆盖 SQ1/Ivy 模板契约、必改文件、Three.js 几何、拖拽转动(raycast+方向)、招式对接 solver、必踩的坑。区分:造"求解器"引擎走 skill new-substep-solver;本 skill 只管 /sim 的渲染+动画+交互集成。Triggers "造魔方模拟器", "造X魔方模拟器", "枫叶魔方模拟器", "给 /sim 加魔方", "sim 加魔方", "新魔方类型", "add puzzle to sim", "X cube simulator", "/sim 新增魔方", "魔方模拟器", "sim 拖拽转动".
---

# sim-add-puzzle

给 `/sim` 加新魔方类型(站内渲染 + 转角动画 + 拖拽转动)。写真「引擎类型」,不写一次性 HTML 页面。
求解器引擎走 skill `new-substep-solver`;本 skill 只管渲染 + 动画 + 交互。

## 先分流(动手前定这 3 件)
- cubing.js 有 `pg()`(PuzzleGeometry,有 3D 模型)→ 走 twisty(`TwistySection`),不碰自有引擎;只有 `svg()`(仅 2D net、没注册)→ 必走自有引擎(实测:`redi_cube`/`dino` 都得自有引擎,别被 twizzle 能开 2D net 误导)。
- 先定转动元素:**面/层**(NxN/SQ1)、**角**(绕体对角线 120°,Dino/Redi/Ivy/Rex)、**棱**(绕棱中点轴 180°,Heli)、**面**(绕面法线,Megaminx/FTO)——它定轴集 + 状态周期表 + pivot 朝向。
- 要打乱/解法但没 solver → 先按 skill `new-substep-solver` 造 `lib/<x>-solver.ts` 再回来接渲染。
- 保立方体形的标准转才做;深切魔方的 jumble(转出非立方体形)不做。
- **非均匀切割的 NxN 变体(镜面 / Bump)别新建引擎**:扩 `engine/nxn` —— logical 层保持均匀(转动 / twister / controller / 打乱 / 播放 / 配色全复用零改),只在 `instanced.ts` 加 mirror 模式把渲染 matrix 换成 `compose(R·center0, R, scale0)`(范本 `engine/mirror/mirrorGeometry.ts` + `new Cube(3, true)`)。
- **twizzle 式「自定义切割」编辑器**(基础多面体 c/t/o/d/i + face/vertex/edge cuts 任意深度)= 纯 UI:拼 cubing.js puzzle-description 字符串喂 `TwistySection.puzzleDescription`(= `experimentalPuzzleDescription`),零几何移植;范本 `app/[lang]/sim/CutEditor.tsx`(SimPuzzle `'custom'`,desc 进 URL `cuts` query + debounce 重建)。

## 模板(已提交、读它当范本)
- `engine/sq1/` — 平面切、层转;每片实心 `ExtrudeGeometry` + 薄色贴片。
- `engine/dino/` — 平面切、角转;每片 = 立方体 ∩ 两端角的 ⊥ 体对角线切平面 = 实心四面体(`wedgeGeometry`),无 CSG。
- `engine/pyra/` — 四面体顶点 120° 层转(= 四面体版 dino),平面切免 CSG,复用 dino `solve3`+凸胞枚举+`roundedTriSticker`;**双渲染器范本**。
- `engine/redi/` — 方块面、角转;角 = cubie、边 = 五边形 tent、中心 = X,无中心块;做不到零穿模(接受 cap 抬升)。
- `engine/rex/` — 球面深切、8 角转(FTO 立方对偶);6 中心+24 花瓣+12 棱;CSG 球切,扩 `CornerTurnCube`;8 球各过自身相邻 3 顶点(切口在顶点相交、无角块)。
- `engine/heli/` — 棱转 = 平面切,12 棱轴各 180° involution;切面 = ⊥ 棱轴的单平面 `a·x=√0.5`(`a`=棱中点方向);每片 = `cube ∩ 12 棱半空间` 实心凸多面体,Minkowski 圆角,无 CSG;`HeliCube` 内联 `CornerTurnCube`;几何从 cstimer poly3dlib 提取 + 测试锁。
- `engine/mega/` — 面转十二面体(唯一转面非立方体);每片 = 十二面体 ∩ 12 切平面(走共享 `engine/polytopeCut.ts`,`CUT=0.7·R_IN` 对齐 PG `d f 0.7`);`MegaminxCube` 内联 begin/finish,每片 pivot 原点转 11 块 72°;状态表 `.tmp/mega/derive.mjs` 离线导出硬编。
- `engine/fto/` — `o f 0.333` 面转八面体,**纯几何态范本**(免离散周期表);`CUT=R_IN/3`;枚举 256 子集 → 51 cell(42 可见 + 9 黑核);`complete` 颜色感知;测试 `_fto_model.ts` 独立重导锁 42 片。
- `engine/ivy/` — 球面切、4 角转,真 CSG;**可能是未 commit 的本地 WIP** → 引用它的文件/函数前先确认在仓库里,不在就照 SQ1/dino。
- `engine/mirror/` — 镜面魔方(Bump)= order-3 NxN + 非均匀长方体块:只 `mirrorGeometry.ts`(层厚 x[1.15:1:0.85] y[1.45:1:0.55] z[1.3:1:0.7] → 累积 center + scale0)+ `instanced.ts` mirror 模式(`_mirrorCenters`/`mirrorMat`/`enableMirror`,7 处 `cubelet.matrix` 加 mirror 分支、NxN 路径字节不变);转动动画 `R_slice·origMat` 自动正确(R·S 正交列各乘 sx/sy/sz、刚体无 shear);`Cube(order, mirror=true)` + world `'mirror'` 分支(`controller.disable=false` 复用 NxN 拖拽);配色 = `coreStyle:raw`+faceColors 全一色(单色金,solve by shape)/ 普通贴片(六色),SettingDrawer applySettings 加 `cube.isMirror` 分支(mirrorColorMode/mirrorColor 独立不污染 NxN);controller raycast 用均匀 plane(打乱后凸块点击精度略降,可接受);PlayerControls 4 个特化标志全 false → 自动落 NxN 播放,只须 `setOrder(3)` 让 scramble 走 '333'。
- `engine/gear/` — 齿轮魔方,**复合联动范本**:一步 = 面 180° + 中层 90° 跟随 + 赤道 4 齿轮自旋 480°(净 120° = mod-3 相位的视觉单位;相位单位角必须满足「相位归零 ⇔ 视觉归位」,pieceAnim 按 axis-angle 插值天然支持 >360° 甩转);每齿轮嵌套双 pivot(orbit 原点 world-premultiply + spin 恒定局部轴 `P₀⁻¹·r̂`,pieceAnim 零改动);状态复用 `lib/gear-solver`(BFS 双向单射锁 41,472);齿轮 = 12 齿长短交替伞冠(等腰梯形齿板切「锥尖=棱中点、半角 45°」的锥再沿锥法线抬 D0 成 8.5 高原;mod-3 相位 ⇒ 塑件须 120° 不变,120°=4 齿距保交替;静止短齿 ±90° 平贴两面、长齿 ±60°/±120° 斜指、0/180° 长齿藏角块沟槽;腰过圆心、隙 15.2° > 齿 14.8°)+ 掌网(高原锥全回转 lathe + 12 扇区贴纸)+ 毂球 → 每面读出「掌 + 3 触角 = 折成两半的圆」,相位≠0 贴纸混色;角块 = RoundedBox − 3 冠扫掠 lathe(自旋∪轨道解析轮廓;长齿上限=中心臂净空 TIP≤64.5)− 3 washer 环,构造零穿模;**LatheGeometry 闭合轮廓必须 (r,y) 逆时针绕**,顺时针 = brush 内外翻转 → CSG 喷毛刺;角贴纸 = 模切鱼形 FISH_REL 多边形(照 unofficial/gear.svg 描,头贴角、叉尾指面心,inside() 谓词逐级收缩防进沟槽)——真机贴纸本就是模切形,别指望雕刻轮廓自己长成鱼。
- 有参考图(平面图/实物照)时别目测比例:光栅化后 canvas 扫描线量各元素位置(H 单位),常数逐项对齐;齿轮类「内齿穿面位置 = 2·GEAR_B − H」这类解析关系先推出来再定常数。
- 转面/非立方体引擎:面索引取上游 PG `get3d()` faceNames 顺序、`FACE_NORMAL`=PG 轴 → bridge 按 index 1:1(零模糊匹配)。
- 第二个切平面魔方起,几何切平面走共享 `engine/polytopeCut.ts`(`Plane`/`solve3`/`polytopeVerts`/`roundedSolid`),别各写一份。

## 工作方式
- 直接在主树编辑(要读 Ivy/SQ1/dino 当范本);worktree 只配「盲测提示词」场景。
- 5 个共享文件是多 AI 热点:`engine/world.ts` / `PlayerControls.tsx` / `SimPage.tsx` / `SettingDrawer.tsx` / `lib/sim-recon-link.ts`。
- 3x3 手部 rig(`engine/hands/`)每帧轮询 `groups[axis][layer].angle`:改层角语义 / 整体转 / drop 时序会牵动手势,动完必跑穿模 oracle + 换握 oracle(方法与四机制见 memory `project_sim_hands_rig`);指法规格(哪指做哪步 / 连拨 / `p` 推法记号)权威在 `engine/hands/FINGERING.md`;其它拼图无手(`supports.hands = kind===3`)。
- 先 `git status`、只 `git add` 自己新文件、默认不 push;别人魔方未 commit(如 ivy)就等它落地再在干净基线上做。
- 三方合并这 5 文件后必 `typecheck` + 读关键分支/依赖数组核对(无冲突标记 ≠ 语义对)。

## 动手前(几何先查证)
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
- 写 `.tmp/<x>/` 脚本枚举半径/球心定面分区(范本 `.tmp/rex/sphere2.mjs`+`emit.mjs`),别手推。
- **方块面角转**(Redi):做不到精确零穿模 → 用小缝(贴片 inset + body 圆角微缩)+ 接受 cap 抬升,别为零穿模改面形;范本 `engine/redi/rediGeometry.ts`。
- 验:单次 eval 内 setup 半转,算「会动片每顶点到隔离面有向距离 ≤0、不动片 ≥0」且跨 0/50/80% 进度恒定 = 隔离面真不变。

### CSG(切片用 `three-bvh-csg`)
- `pnpm add three-bvh-csg`;`new Evaluator()` + `new Brush(geo)`(每 brush `position.copy(中心)` 后 `updateMatrixWorld()`)+ `evaluate(a,b,INTERSECTION|SUBTRACTION)` 链式。
- `Evaluator.attributes` 留默认 `['position','uv','normal']`(改成 `[]`/`['normal']` 会崩)。
- 输入网格带 position+normal+uv(Box/Icosahedron 自带,别 `deleteAttribute`)。
- 相邻两片共享的切割面用同一个 brush 实例 → 切面逐三角重合、无缝无叠。
- CSG 插值法线天然「平面平、曲面滑」,免 `computeVertexNormals`。
- 范本 `IvyCube._buildBodies`:每片 = 立方体 ∩ 自己的切割球 − 其余球。

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

### 通用调试开关接入(对所有 engine 魔方)
- 方位提示:每个角/棱/面转魔方一套 `<X>_CORNER_HINTS`(label + 轴 dir,严格照抄该魔方 state 的 `CORNER_NAMES`/`CORNER_AXIS`)放 `face_hints.ts`;world 建 `<x>Hints = new FaceHints(SIZE, hints, distanceMul, sizeMul)` 加进 scene;SimPage render loop 按 `puzzleKind` 选 active 集、其余 `.hide()`、全部 `.tick(dt)`,`viewing` 三元含该魔方 `<x>Rotating`;设置面板「字母」(`settings.faceLabels`)开 → `forceLabels` 让 active 集常驻(`if(viewing||forceLabels)show`),新魔方按 puzzleKind 自动生效无需额外接线。
- 多字符标签靠 `makeLetterTexture` 返回的 `aspect` 设 `sprite.scale.x=size*aspect`(否则挤扁);`distanceMul` 把标签推到实心块外(被挡=不见,Redi 角帽 ~3.7、Dino 开口缝 3.3)。
- 半转停住(`holdPartialTurn`):SimPage-管理魔方过阈值时若开则 `<x>ResolveLive` 返 move + 屏幕切向 → `beginMove` 取 anims → 逐帧 `proj/FULL_PX→t∈[0,1]` 设 pivot;pointerup 不 commit,存 `partialSnapBackRef.current=()=><x>SnapBack(anims)`;开始新转动前 + toggle off 调 `clearPartialFreeze()`;`world.callbacks` 注册「丢 ref」(已提交变更已重摆 pivot,只丢不弹);reset() 要 fire callbacks。
- 半转停住(NxN):`holdPartial` flag,转一层前必 `world.controller.clearFrozen()`;PlayerControls 的 jumpToStep/打乱等所有驱动 cube 入口也先 `clearFrozen()`(它们不经 controller,锁不自解,否则 `group.drag()` 死循环卡死)。
- 半转停住(SQ1 两种招式):layer turn 走 `sq1Drag`(实时拖,`sq1DragSnapBack` 回弹);slice(`/`,180° 翻转露垂直内切面)只在开 `holdPartialTurn` 时改成实时拖——`sq1SliceLiveStart`(=`beginMove({kind:'slice'},dir)` 取 anims)+ 逐帧 `sq1SliceLiveApply`(竖拖 px/`SLICE_FLIP_PX(240)`→v∈[0,1] 走 `applyAnimFrame`)+ pointerup 存 `sq1SliceLiveSnapBack`;关时保持一次性 `twist({kind:'slice'})`(正常手感不动);触发前 `sq1SlashValid(state)` 闸 + pinch 打断要回弹。范本见 SimPage SQ1 块。其余引擎要原核露内切面同理:把"露切面的那种招式"做成实时拖+冻结。
- 结构着色(`debugStructureColor`):`applyDebugStructureColors(cube,on)` 按 `userData.simRole` 换材质实例(存 `userData.origMat`,off 还原);别改共享材质 `.color`(会串色关不掉);在 `applySettings` 末尾调(放 NxN `hollow` setter 后、用 `mesh.material !== dbg` 捕获原材质)。
- 立体贴片(`thickness`)+ 镂空(`hollow`):标对 body/core → 镂空自动有;贴片补 `simStickerNormal`(makeSticker 魔方)或 `simRole='sticker'`+`simFlatten='scaleZ'`(SQ1 式)→ 立体贴片有;机制 `applyEngineBodyOverlay` + `applyStickerThickness`,`thickness=true` 是 no-op(默认零回归)。
- 提示贴片背面(`hint`):`applyHintFacelets(cube,on,bgHex)` 给每 sticker 加淡色 `BackSide` ghost 子节点(随转动自动跟、`raycast=()=>{}` 不挡拾取);复用立体贴片那套 tag,贴片标对即自动有。
- 挖块(挖角/挖面/挖棱):Cube 实现 `setCarve(on)`(藏一次转动的会动块组,复用自己的 `pivotsForMove`/cycle 取 element-0 那组,off 恢复全部)+ simCaps 声明 `carve:'corner'|'face'|'edge'`;所有 engine 魔方都该有,门控走 `caps.carve`。
- 按阶段展示色块(`?stickering=`,twizzle Stickering,issue #27):阶段 mask 单一源 `engine/nxn/stickering.ts`(cubing.js cube-like-stickerings 逐条翻译到 initial 坐标,SOLVED 帧授权颜色随块走,fixture 测试 `tests/sim_stickering.test.ts`);NxN 渲染走 `instanced.setStickering(maskFn)` per-slot 改 instance color(dim 必须 sRGB 域 ×0.5,线性域减半看不出),`refreshStickerColors` 是 applyStick/setFaceColors/hint 共用的色源;megaminx/fto cubing 渲染直接 `TwistySection experimentalStickering` 透传;下拉 `StickeringSelect` 在播放条最左,门控 `caps.supports.stickering`(false=隐藏,非置灰);换阶/换拼图后 SimPage effect 按 `[worldTick,puzzleParam,query.stickering]` 重挂。
- 原核 `coreStyle:'raw'`(无贴纸实色块身、棱对角双色/角三色)两套实现:
  - **NxN**(instanced)= `instanced.ts setRawCore(on,faces,coreColor,border)` 给 frame(+inner)换克隆几何(per-instance 面色属性)+ `rawCore.ts` onBeforeCompile shader,全阶(低/中阶 Phong+圆角 frame+inner;超高阶 N≥50 unlit Basic+`_FRAME_LOW` 无 inner;转层中空由 `panelFan.ts` 扇形彩色切面填,镜面改用补回的中心块填洞),见 [[project_sim_raw_core_and_logo]]。
    - 着色器 lit/unlit 分叉:Phong(lit)用几何法向 `vRawNrm=normal` 分外壳(`dot(gn,面法向)>0.5`→沿 localPos 对角分割)/内壁(落 `diffuse`=`coreColor`=内核色,转层露深内核);Basic(unlit,超高阶无 normal attr)纯 localPos 最近可见面。「内核色」色块 = `setRawCore` 设 raw 材质 `.color`。
    - **黑缝粗细必须与「六色/单色」无关**:原核外壳面在「面内 chebyshev 距离 > 贴片半宽」处也落回内核色当黑缝(等同六色 `_STICKER` 内缩),贴片与 frame 同受缩放→逐块等宽。贴片半宽走 `define.STICKER_INNER` 单一源(`Cubelet._STICKER` 同源派生),**禁再抄边宽常量**——同一视觉元素多渲染路径时共享尺寸/颜色必走单一源,别各算一份。
    - **镜面**:`setRawCore(…,border)` 第 4 参控缝色——普通 `border:1`(独立内核色缝:金/彩块+暗缝)、原核 `border:0`(缝跟随本体面色,连续无黑线);single 恒 raw;选原核时**内核色跟随镜面配色**(无中心块也回退镜面色);四量 `mirrorRaw/rawOn/rawBorder/rawCoreColor` 在 `applySettings`。
  - **engine-body 魔方**(SQ1/Skewb/Mega/Pyra/…非 instanced)= 共享 `engine/rawBody.ts`,由 `applyEngineBodyOverlay(root,hollow,debug,raw)`(body 材质唯一 owner,优先级 `raw>debug>hollow>base`)驱动:对每个 `simRole='body'` mesh,从**同 parent 的 sticker 兄弟**反推有色面(`simStickerNormal`+cap 色 `material[0].color`),换 per-piece 原核材质 + 隐藏 sticker。shader 用**法向 argmax**(`dot(objectNormal, faceN)` 最大,**非** NxN 的 position-based——非中心化圆体/斜挤出体 position 会切错;法向对任意形状稳),per-mesh uniform 喂面表,**每材质唯一 `customProgramCacheKey`**(否则 onBeforeCompile 共享 program 只留第一个的 uniform=全体串成一块色)。**加新 engine 魔方:用 `makeSticker`(已自带 `simStickerNormal`)则原核零代码自动有**;非 makeSticker(如 SQ1 local-z extrude)给每 sticker 补 `userData.simStickerNormal`(body 本地帧外法向,与 body 几何顶点法向同帧)。坑:body mesh 必须相对 piece group identity rotation(否则法向不同帧);pyra 的 `PIECE_SHRINK` 黑缝/黑星是引擎固有(normal 模式也有),非原核 bug。
- 顶面 logo `logo:'none'|'site'|'custom'` = **NxN 专属**:`cube.ts setLogo` 在 U 中心块顶面贴 plane(`logo.ts` 缓存 + 上传降采样,仅奇数阶);site 源 = `/icons/CubeRoot.png`(∛红蓝格透明底,**非** favicon.svg 紫色);plane 48;Y = `order*32 + (instancedRenderer.thickness?4:1)` 跟随立体贴片(平贴片顶面仅 ~0.1,固定高会悬浮);非 NxN 空操作。
- 手指(指法演示,3x3 专属,`engine/hands/`):同步不挂事件 —— rig 每帧轮询 `cube.table.groups[axis][l].angle`(tween/拖拽都写它),零 import NxN 引擎;开关 `SimSettings.hands` → `world.setHandsWanted`,caps `supports.hands = kind===3`,手开时 refHalf 3.9。坑:① 左手四元数 = `mirrorQuatX(右手) ∘ Rz(π)`(几何在局部 y=0 镜像、世界姿态在 x=0 镜像,复合差一个局部 Rz(π));② 指根姿态必须 `rootBase ∘ R(curl/splay)` 叠加(直写 rotation 会抹掉拇指对掌基座);③ 招式队列同 tick 接续无零活动帧,轴/层类/方向切换都要显式 endGesture,否则上一手 weld 悬死;④ 姿态调优:pose 存「世界轴旋转序列」,Playwright 冻结层角(`groups.y[2].angle=0.7` + `scene.updateMatrix()`,scene 是 matrixAutoUpdate=false)截图校准(headless rAF 不限帧,动画中间帧抓不到);精调用浏览器内坐标下降求解器(目标=指尖胶囊帽**圆心落面外一个半径**处 + 指腹朝按压向 + 指链采样点不进 96+r 立方包络 + 解剖正则,圆心进面内=肉从贴纸穿出);⑤ 前臂做独立件、肘锚 IK 指向腕点,别焊进手模型(腕转会变整臂绕魔方公转);肘锚 = home 腕点沿手局部 −x 推远(前臂 = 手的自然延长,固定世界锚曾垂直下垂被否);手模 = MANO 独占(2026-07-11 内置 generic-hand 退役,资产逐机 convert-mano.py 转换 gitignored,缺失时手部整体不可用;SMPL-X 真前臂切段同套管线);⑥ 手性硬约束:家位指位(指列朝后、食指在上、掌心朝魔方)决定魔方右侧手必须用 side=-1 几何(side=+1 摆该姿态掌心必朝外,差一个镜像纯旋转无解);⑦ 相机包络:手+前臂几何真包络 ≈5.8×SIZE(腕 166U+前臂 170U+帽 30U;肘锚 6.95×SIZE 处无几何别拿它算),主视图 resize 与 backView 的 near/far handsOn 分支用 `max(distance−6×SIZE, 0.4×SIZE)` —— **near 必须钳正**,perspective 滑杆下限 2 时 distance 仅 7.8×SIZE,负 near = 投影矩阵损坏任意角度乱切;手部 layer-1 补光要每个相机 `camera.layers.enable(1)`;⑧ 指弹分三种扫法:拇指(F 族)=展开中节沿 F 面上扫、y 轴=伸展横扫、x/z 轴中指=splay 竖扫 —— 且绕 x 的旋转在 x=0 镜像下不变(M 族整个 B 面同向竖移),竖扫符号必须按世界系竖向逐手换算,镜像对称公式必打架;⑨ **指骨网格挂当前关节系跨 [0,len]**,别塞进「下一关节」组(它被挪到 x=len → 骨渲染在 [len,1.5len],掌指间一段真空 =「手指与手心断开」;关节数学正确指尖不露馅,极难肉眼定位 —— 判别:三维相连投影必相连,逐项排除 culling/clipping/depth 后清零关节摆直指量网格中心),锁 `tests/hands_model.test.ts`;⑩ 持久握姿:weld 提交(raw 层角 snap ±90° 倍数非零)烘进 per-hand grip 四元数不回家;解法框换握记号 ↑上手/↓下手/·回 home 各占一步(`regrip()` 动画 + `isRegripping` 闸播放;跳步用纯函数 `simulateGrips` 静态推演)—— 注意 recon 工具链 `cleanForPlayer` 把 ·↑↓ 当装饰剥掉:分段要在它之前,caret 同步喂原文,invert/mirror/反推打乱先 `stripGripMarks`。⑪ 皮肤贴图运行时烘焙(`bakeHandTexture.ts`,UV 光栅化逐像素 3D 域求值):须在 adaptGltfHand 后、入场景/摆 home 前调用(group 无父级);甲背 = 功能指腹方向反向(四指 = 手系 −z 投影⊥末节轴,拇指再绕根段轴滚 THUMB_CURL_PLANE_ROLL×side),**禁用末节顶点法线提纯**(被指尖前向面拽偏,甲画到指腹侧压在贴纸上隐形);甲色须按指尖顶点血色补偿(顶点色 g×0.89/b×0.86 与贴图相乘,不补则甲片潮红隐形);左右手 UV 布局不一致,两手各烘;锁 `tests/hands_texture.test.ts`。手势映射锁 `tests/hands_gestures.test.ts`。
- 背面小窗(`backView.ts`,NxN/SQ1/recon):相机 target+pivot 取 `Box3.setFromObject(world.cube)` 中心(先 traverse 清 `InstancedMesh.boundingBox` 强制逐实例重算,否则拿还原态陈旧盒)+ 纯 `(0,0,distance)` 偏移脱 pan;**别钉原点**(打乱质心偏移 / 主视图平移都会让小窗魔方偏位)。

## 双渲染器(cubing.js 原生 + 自有引擎可选)
- cubing.js 已支持(skewb/pyraminx/megaminx)又想要引擎独占开关时,保留两版:`SimPage.ENGINE_TWISTY` += id;`useEngine = isTwisty && ENGINE_TWISTY.has(id) && renderer!=='cubing'`、`twisty = isTwisty && !useEngine`;`PlayerControls` 收 `renderer`/`onRendererChange`、`isXEngine=id&&renderer!=='cubing'` 进 `cornerKind`;simCaps 声明 `engine:'engineMode'`(渲染器下拉自动出);引擎版用自有记号 → `reconEvent` 置 null。
- 非内置 cubing id 的提升(FTO):从 `pgCatalog.PG_PUZZLES` 删掉它(免类型选择器/explore 双列、路由撞名);cubing.js 版改喂 `SimPage.ENGINE_TWISTY_DEF[id]`(def 串)→ `TwistySection puzzleDescription` → `experimentalPuzzleDescription`;`pgDef = PG_DEF_BY_ID[p] ?? ENGINE_TWISTY_DEF[p]`、`isTwistyPuzzle`/`PG_BOUND_KINDS` += id。
- `renderer=group` 群论内核:照 megaminx 写 `engine/<x>/<x>PgBridge.ts` 接 PG 群(见 [[project_sim_pg_binding_layer]] 的「再加魔方 recipe」)。
- 群论面板同步 5 处:`pgBindings` BRIDGES、`simCaps` CAPS、`SimPage` `PG_BOUND_KINDS`+`ENGINE_TWISTY`、`GroupTheoryPanel.PG_BOUND`(最易漏,漏=面板挂载后内部 `bound=false` 一片空白)。
- engineMode 魔方默认 `renderer='group'`(`withDefault('group')`,下拉「群论内核」排第一,`handleRendererChange` 用 `r==='group'?null:r`);大群(>~10⁸ 带 word 建不动)bridge 标 `solvable:false` + `factsOverEngineGens`(PG def 带额外深 slice 时 |G| 只用引擎面生成元算)。
- **群论静态 facts 必须离线预计算,禁运行时 live Schreier-Sims**(会冻页:heli≈1s、7x7≈8s)。|G|/轨道/reassembly/约束指数/生成元只跟拼图有关=常量,烘进 `engine/pgFacts.generated.ts`。新 bridge 加进 `pgBindings.allBridges()`(NxN 已在里),然后 `GEN_PG_FACTS=1 pnpm --filter @cuberoot/client exec vitest run tests/gen_pg_facts.gen.test.ts` 重跑生成表(键=`bridge.pgName`)。`PgEngineBinding.facts()` 自动读表,漏了会 dev warn。只有跟当前状态有关的(元素阶/是否还原/2x2 BSGS 打乱还原)才 live。NxN 走 `nxn/nxnPgBridge.ts` 工厂(`nxnPgBridge(N)`,2..7,单层切片原子,2x2 solvable)。
- **PG 表示不了的拼图走 perm 路(非-PG 置换内核)**:决策树=对称平面切多面体→PG;否则→perm。PG 做不了的两类:非对称切(ivy 只转 4 正四面体角)、带隐藏朝向被 PG 多算(rex 中心 4 重朝向)。写 `engine/<x>/<x>PermBridge.ts` 实现 `PermBridge<M>`(engine/permBridge.ts):`key`(=facts 表键)、`orbits`(`permutes:false`=定位固定只转向)、`genPerms()`(从引擎自己 state model 抬:apply 到 solved 读 slot→source,g[slot]=source)、`moveToStep/stepToMove/parse/toString/solvable`。注册 `pgBindings.PERM_BRIDGES` + `createBinding` perm 分支返 `new PermEngineBinding(bridge)`(实现共享 `GroupKernel`,与 PgEngineBinding 同 surface),facts 生成器加 `permBridges()` 轮(键=`bridge.key`)。**大 perm 群 facts 别用 permGroup(带 word 建 OOM,如 rex ~5e27)**:`computeFactsLive` 的 `!solvable` 用 vendored `schreierSims(gens.map(g=>new Perm(g)))`。闭环 oracle 就用引擎自己的 applyXxxMove。范例:ivy(solvable 29160)、rex(facts-only A₆×A₁₂³)、mirror(=`nxnPgBridge(3)` 复用 3x3 kernel+facts)、redi(PG compy cube + `factsOverEngineGens` 去 ×12 深 slice)。sq1 出局(变形群胚,无单一 |G|)。科普页 `/math/kernel` 数字全从 `PRECOMPUTED_PG_FACTS` 读,加拼图后覆盖表自动跟。

## 记号约定
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
- 转动动画抓中间帧(首尾帧 bake 后一定对,bug 只在中间):临时 `window.__sim={world,renderer,THREE}` → `beginMove` 取 anims → 逐 v 设 pivot+`render`+截图 ≥5 帧;端态受影响面应混色、开口应是平滑曲面非平板/尖扇形(开「结构着色」:core 品红、body 青);验完删句柄。
- occlusion 别只截图猜:藏掉所有 `simRole==='body'/'core'` mesh 重渲,弧立刻完整 = 贴片对、body 盖前;定位用逐像素 CPU raycast 出 ASCII 角色图(每格取最近命中 `simRole`/色),按 hit 的 pivot quaternion 分类 moving/stationary。
- Windows Next dev 截图写进 `.tmp/` 会触发 HMR remount 把 cube state 重置成 solved(见 [[feedback_windows_next_dev_restart]])→ scene-graph 取证一律「单次 eval 内 setup turn + raycast 出文本」(不截图);Playwright MCP 截图只能落 `core/.tmp/png`。
- 质量门(报 done 前):① 几何/视觉放大到单弧/单贴片占屏一大块目检(正常视角藏折线/扁平);② 拿本 skill 每条硬要求对着实际产物逐条核(凭记忆核=漏);③ 收尾把「找茬验收」外包给 fresh-context 评审 agent(只喂硬要求 + 放大截图);④ 曲边贴片必配几何回归测试卡「每个区最大转角 < ~50°」(针刺=120-180° 反向转角;软目检会失效、CI 测试不会),红了用 2D 离线精确复刻排查(范本 `rex_2d_face`/`rex_2d_corner`)。
- 数学/几何推导用脚本/独立重导测试锁死(范本 `.tmp/rex/emit.mjs` 枚举周期表 + `tests/rex_state.test.ts` 从零重导对账);核心搭建(geometry→state→cube→twister→drag→接线)强顺序 + 踩 5 共享文件,别拆并行。
- 改完动 /sim 必回写本 skill + 相关 memory(见 [[feedback_maintain_sim_skill]]);回写一条规则一行、祈使句、只写怎么做,根因/坑的来龙去脉放 memory。
