# 原生 PuzzleGeometry 拼图：结构、记号与接线

通过原生 PuzzleGeometry 接入独立项目时，让 `/sim`、`/scramble/gen` 与 `/timer` 消费同一描述、模型和生成器，不在页面重新定义切割。本文件代码路径相对仓库 `core/`。

## 目录

- [共享入口](#共享入口)
- [已核证的结构来源](#已核证的结构来源)
- [可见几何与 SVG](#可见几何与-svg)
- [深度与原生记号](#深度与原生记号)
- [有界输入与播放](#有界输入与播放)
- [原生拖拽适配](#原生拖拽适配)
- [验证范围](#验证范围)

## 共享入口

| 职责 | 源文件与公开 API |
| --- | --- |
| 项目描述、轴、名称、徽标、图示比例、纯打乱 | `packages/puzzle-solvers/src/native-puzzles.ts`：`NATIVE_PUZZLES`、`NATIVE_PUZZLE_IDS`、`nativePuzzleMoves`、`generateNativePuzzleScramble` |
| 原生状态与有界完整记号 | `packages/puzzle-solvers/src/native-puzzle-model.ts`：`nativePuzzleKPuzzle`、`parseNativePuzzleAlg` |
| 完整展开图 | `packages/puzzle-render-core/src/native-puzzle-svg.ts`：`renderNativePuzzleSvg`、`nativePuzzleSvgAspect` |
| 模拟器项目与手动操作 | `packages/client/app/[lang]/sim/pgCatalog.ts`、`packages/client/components/TwistySection.tsx` 及其同目录 `NativePuzzleControls.tsx` |
| 页面手势 | `packages/client/components/puzzle-models/gestures/pgDrag.ts`：`createNativePuzzleDragGeometry`、`pickNativePuzzleDrag`；`nativePgPointer.ts`：`attachNativePgPointer` |
| 手动追加与锚点 | `packages/client/components/puzzle-models/gestures/nativePgMoveAppend.ts`：`attachNativePgMoveAppend`，校验并同步记录、终点状态及原生补间动画 |

- 从注册表派生选择器和生成器分支，保留已有项目 ID；没有专用图标时沿用 `textLabel`，不要借用无关图标或伪造键。
- 经 package 的公开 subpath 导入模型和 SVG；让模型、SVG 和手势统一使用 `allMoves: true`、`orientCenters: true`、`addRotations: true` 及原生 `ExperimentalPGNotation`，保持与描述播放器一致。
- 让普通与种子打乱共用注入随机源的纯生成器，只读取注册表，不在生成路径构建几何、DOM 或图示；说明有界随机转动策略，不宣称均匀随机状态或伪造 csTimer 项目键。
- Timer 来源显示按 `timerScrambleCapability(event)` 的实际 provider 派生：`native-random-move` 即使沿用全局 WCA 偏好，也显示练习用随机转动并同步打印文案，保留手动来源，不改全局偏好；来源菜单隐藏不可用 WCA 选项，比赛配置按 `timerSupportsRealWcaScrambles(event)` 门控。核对重新进入页面、切回 WCA 项目与训练子项目，不能只验证公式和 SVG 正确。
- 按 [跨页面接入与验收](integration-and-verification.md) 补齐生成页三个模式、Timer 外层分发及 PDF 比例；不要以项目出现在菜单中替代实际消费验证。

## 已核证的结构来源

| 项目 ID | 双语名称 | PuzzleGeometry 描述 | 结构来源与范围 |
| --- | --- | --- | --- |
| `superz` | 二阶＋斜转 / SuperZ (2×2 + Skewb) | `c f 0 v 0` | 使用 [cubing.js 维护者给出的 2×2 + Skewb 描述](https://github.com/cubing/cubing.js/issues/127)，保留穿心面切和穿心角切的完整对称模型；不自行加入某一外观版本的联动限制。 |
| `cube3dino` | 三阶＋恐龙 / 3×3 + Dino | `c f 0.333333333333333 v 0.577350269189626` | 按 [Tom van der Zanden 的原作说明](https://www.tomvanderzanden.nl/puzzle.php?puz=3x3x3+Dino+Cube)组合均匀三阶面切与 Dino 角切；以立方体半边长 1 推导面切距离 1/3 与顶点切距离 1/√3，核对原作照片的三阶网格及面上对角线，不把该比例称为量产品的测量值。 |
| `dogic` | Dogic 二十面体 / Dogic | `i v 0.562777422255239 v 0.9105929973100289` | 使用 [cubing.js 维护者给出的二十色 Dogic 描述](https://github.com/cubing/cubing.js/issues/127)；按 [Jaap 的拆解和转动说明](https://www.jaapsch.net/puzzles/dogic.htm)核对两种顶点转动，不套用该文十二色版本的贴色与群阶。 |
| `octahedron4` | 四阶八面体 / 4×4 Octahedron | `o v 0 v 0.86602540378` | 使用 [cubing.js 维护者给出的深截角四阶描述](https://github.com/cubing/cubing.js/issues/127)；参考 [Jürgen Brandt 作品介绍中的 Octahedron from a 4×4×4](https://www.twistypuzzles.com/articles/spotlight-jurgen/)核对四阶改形的实际构造，不把描述中的切割比例说成某一量产品的测量值。 |
| `dinoskewb` | 恐龙斜转 / Dino Skewb | `c v 0 v 0.577350269189626` | 按 [Tom van der Zanden 的原作说明](https://www.tomvanderzanden.nl/puzzle.php?puz=Dino+Skewb)与[作者发布帖](https://twistypuzzles.com/forum/viewtopic.php?f=15&t=17016)组合原生 Skewb 中心切面与 Dino 切面；核对作者演示的 Dino、Skewb 和内层三种转法，保留无独立小尖的原作机制，不混用 DaYan F-Skewb 的非对称结构。 |

把拼图描述视为几何数据；Dino Skewb 与 3×3 + Dino 的组合描述由已核证的两类切面推导，不标注成上游预设中逐字复制的条目。

## 可见几何与 SVG

| 项目 | 面数 | 每面可见贴片 | 可见贴片总数 | 可见块轨道 | 基本转角 |
| --- | --- | --- | --- | --- | --- |
| SuperZ | 6 | 8 | 48 | 8 个三贴片角块、24 个单贴片中心块 | 面轴 90°、体对角轴 120° |
| 3×3 + Dino | 6 | 16（12 三角形、4 正方形） | 96 | 24 个双三角贴片棱块、12 个双四边形贴片棱块、24 个单三角贴片中心块 | 面轴 90°、体对角轴 120° |
| Dogic（二十色） | 20 | 4 | 80 | 60 个小三角块、20 个大三角块 | 顶点轴 72° |
| 四阶八面体 | 8 | 4 | 32 | 24 个小三角块、8 个大三角块 | 顶点轴 90° |
| Dino Skewb | 6 | 12 | 72 | 24 个双贴片棱块、24 个单贴片中心块 | 体对角轴 120° |

- 从 `get3d()` 的 `isDup` 排除只为表示朝向而重复的贴片，再统计可见几何；开启 `orientCenters` 后 Dogic 和四阶八面体会分别返回 120、48 条贴片数据，不要把它们当成实际贴片数。
- 解析原生 SVG 时，先保存所有 `orbit/piece/orientation` 的颜色查找项，再按面名和多边形顶点集合去重重合轮廓；只去重输出几何，不删除朝向颜色，否则转动后的单色中心会取不到颜色。
- 用注册表 `visibleFacelets` 核对去重后的物理片数，按完整展开图包络与 `nativePuzzleSvgAspect` 排版；同时检查还原态和发生中心朝向变化的打乱态，没有重复片、缺色或面被裁掉。
- 保留原生二十色、八色与六色方案，使每个还原面颜色一致；先核对 Dogic 二十个面确实使用二十种不同颜色。
- 在所有注册的原生项目二维回退中，用公开 `ExperimentalSVGAnimator`、同一 loader 的 SVG/KPuzzle 和实际 `legacyPosition` 镜像图像浮层及转动过渡，保护播放器/loader 替换与卸载；失败或超时明确提示并禁用导出，不用 `setup + alg` 重建当前帧，也不回退三阶 spec 图。
- 拼图或伴图来源切换时先清除上一帧，无论目标是否仍是原生项目；等待新来源期间，只有当前 spec 能精确表示盘面时才允许静态回退。所有 engineOnly 来源都应等待自己的有效帧，同步禁用复制、下载及已打开的格式菜单，不能导出上个拼图或默认三阶图。
- 用可观察的颜色和形状判定还原，忽略单色等边三角块不可辨的自转及同色块之间不可辨的交换；不要拿原生朝向轨道的严格单位元替代可见还原。
- 保留四阶八面体原生描述的小数精度，几何比较采用覆盖该近似误差的数值容差，片数、置换数与周期仍用精确断言。

## 深度与原生记号

对具有独立内层的原生项目，以原生面轴或顶点族 `A` 为例，让按钮、拖拽、记录、解析和 SVG 使用同一含义。

| 写法 | 含义 |
| --- | --- |
| `A` | 靠近该顶点的最外一层 |
| `2A` | 从该顶点数第二层，单独转动 |
| `Aw` | 最外两层一起转动；等价于 `A 2A` |
| `3Aw` | 最外三层一起转动，适用于该轴层数允许的范围 |
| `Av` | 绕该轴整体转体 |
| 后缀 `'` | 逆向一个基本转角 |
| 后缀 `2` | 同向两个基本转角；不要与开头的层号 `2` 混淆 |

- 将 Dogic 的 `Aw` 接为围绕顶点的五个完整面转动，将 `A` 接为五个小三角块转动；例如 `FREGUw` 转动 15 个小三角块与 5 个大三角块，`FREGU` 只转动 5 个小三角块。
- 将 Dino Skewb 的 `Aw` 接为 Skewb 半体转动，将 `A` 接为较浅的 Dino 转动；例如 `UFRw` 转动 12 个棱块与 12 个中心块，`UFR` 与 `2UFR` 各转动其中互不相交的 6 个棱块与 6 个中心块。
- 将四阶八面体的 `Aw` 接为两层宽转；例如 `ULFRw` 转动 12 个小三角块与 4 个大三角块，`ULFR` 只转动 4 个小三角块，`2ULFR` 转动 8 个小三角块与 4 个大三角块。
- 保留合法内层单转；它可以由宽转与外层逆转组合得到，不要把 `2A` 错当成宽转。
- 对 SuperZ 分别提供六个面向的 90° 转和八个角向的 120° 转，不添加不存在的独立内层/宽层按钮；原生 `2R = L'`、`2DRF = UBL'`，整体转写作 `Rv = R L'`、`DRFv = DRF UBL'`，不要套用该模型不支持的 `Rw` 或 `x/y/z`。
- 对 3×3 + Dino 同时提供面轴与角轴的外层、独立内层和两层宽转；核对 `Fw = F 2F`、`UFRw = UFR 2UFR`、`Fv = F 2F B'` 和 `UFRv = UFR 2UFR DLB'`，拒绝超深的 `3Fw`、`3UFRw` 与该原生模型不支持的 `x/y/z`。
- 对穿过中心的同一内层，用实际轨道变换识别反向别名；3×3 + Dino 的 `2F = 2B'`、`2UFR = 2DLB'` 是同一动作，不以文字不相同判定拖动错误，并继续独立核对旋转方向。
- 对面转/角转与浅层/宽层并存的练习打乱，覆盖两者组合；交替面外层、角外层、面宽转、角宽转，避免把转轴类别与层深绑定在同一个奇偶条件上。
- 从原生招式校验后提取可转轴；开启 `addRotations` 时，`get3d().axis` 还含只能整体转体的面轴和棱轴，不能直接把每一项都展示为局部转动按钮。
- 为 PG 项目关闭三阶自动空格，保留多字母族名、前置层号、宽转与整体转；只让 `nativePuzzleMoves` 决定手动按钮，完整输入范围交给原生记号校验，不拿按钮列表限制公式。

## 有界输入与播放

- 先检查原始文本长度和括号嵌套，再调用原生递归 parser；展开前计算 AST 工作量，覆盖大转数、嵌套重复、换位子、共轭和空分组重复。
- 对 setup 和 alg 的完整序列调用 `parseNativePuzzleAlg`，通过所有招式的模型校验后才构造或更新原生播放器、展开时间轴、简化、求逆及生成 SVG；不要仅依赖语法 parser 判断合法层和族名。
- 输入无效时标红并暂停播放，保留上次合法盘面；同时阻止原生播放器自带播放入口和手动追加绕过校验，不让不完整编辑触发异步异常或部分状态更新。
- 延迟播放回调使用独立于本地引擎重放的请求序号，执行前核对拼图、播放器与当前草稿；编辑、重打乱或切换后取消过期请求。合并 setup 与 alg 前保留行末注释的换行边界，避免取逆吃掉另一框的招式。
- 终点锚定时，手动追加 `M` 同步把 setup `S` 改成 `S M`、alg `A` 改成 `A M`，保留原起点并推进终点；先完整校验两框，再更新模型、草稿与分享状态，使用真实 `currentPattern` 验证盘面确实改变。
- 将编辑器实际追加后的完整文本返回手动适配层，按真实回执识别延迟或批量回写并保留注释；用户编辑应取消旧动作，不从模型规范式猜测原文，也不用盘面等价判断是否为自动回写。

## 原生拖拽适配

- 将原生 tap 转动、拖空白 orbit 与拖可抓件转层分开；原生 PG 提供模型和点击能力，真实拖层复用 `pgDrag.ts` 与 `nativePgPointer.ts`，由 `TwistySection.tsx` 挂载并接手动记录。
- 原生播放器采用封闭 Shadow DOM，外层宿主的 `composedPath()` 看不到 canvas；通过公开 vantage 的 `contentWrapper` 在内部捕获起手，宿主继续处理捏合、捕获后的移动与结束。用完整封闭 Shadow DOM 树测试，不能用开放树替代。
- 切换拼图时使不适用的深度选择失效；没有内层选择器的模型不得继续消费上个拼图隐藏的宽层或内层设置。
- 在 raycast 前更新矩阵，把世界命中点经目标对象 `worldToLocal` 转成局部坐标；按原生网格实际缩放对齐 `get3d()` 顶点，只应用一次缩放，再把局部点和轴变回世界空间计算屏幕切向。
- 从非重复的当前空间槽位及合法转动的置换/朝向变化筛选候选层；PG 端态会重新着色固定槽位，不用贴片当前颜色或还原块身份推断可动层，缝和黑体命中也匹配相邻槽位。
- 支持自动、外层、内层与宽层的适用选择；只在明确选择宽层时把宽转加入候选，保持转动锁和未命中时的 orbit 行为。
- 用绕朝外轴的负角度 `-2π/order` 独立旋转几何，对照原生置换确认裸招式从外看顺时针；当前切向评分采用右手正方向，转成原生 amount 时用 `-score.dir`，不要用互逆还原替代方向验证。
- 覆盖对象已整体旋转、缩放与平移后的命中和方向；用独立投影拖动向量检验正反向、不同深度与脱靶，避免测试与实现共用同一符号错误。

## 验证范围

- 按改动选择 `packages/client/tests/superz_geometry.test.ts`、`cube3dino-geometry.test.ts` 和 `additional-puzzles-native-geometry.test.ts`，核对片数、合法深度、宽转组合、基本周期及独立刚体旋转与原生置换；用独立切平面交线锁定组合模型的每面轮廓。
- 用 `native-puzzle-drag.test.ts` 核对真实几何上的拾取与方向，用 `native-puzzle-svg.test.ts` 和 `native-puzzles-client-integration.test.ts` 核对有界输入、完整记号、原生颜色、确定性生成、共享 SVG 和 PDF 比例；这些文件同在 `packages/client/tests/`。
- 用 `native-puzzle-manual-anchor.test.ts` 读取未挂载真实 TwistyPlayer 的 `currentPattern`，核对双锚点下快速追加的盘面、记录和分享重建，以及编辑打断与卸载后的过期取消。
- 用 `sim-native-companion-lifecycle.test.ts` 挂载真实页面、播放器控件与图像面板，覆盖原生→通用 PG→原生：旧伴图清空，等待精确帧时复制、下载及已打开的导出菜单禁用，返回后恢复当前原生 SVG；仅验证独立镜像 helper 的清理不覆盖页面保留上一帧的问题。
- 在浏览器分别记录模型显示、手动操作、随机打乱、公式播放、记录与分享恢复；WebGL 不可用时验证二维按钮和展开图，明确保留 3D 动画与拖拽未验，不把 tap、静态几何或离线手势测试当成 3D 浏览器验收。
