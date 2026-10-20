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
- [机制审查记录](#机制审查记录)
- [Cat’s Cradle](#cats-cradle)
- [Radio Canon](#radio-canon)

## 共享入口

| 职责 | 源文件与公开 API |
| --- | --- |
| 项目描述、轴、名称、徽标、图示比例、纯打乱 | `packages/puzzle-solvers/src/native-puzzles.ts`：`NATIVE_PUZZLES`、`NATIVE_PUZZLE_IDS`、`nativePuzzleMoves`、`generateNativePuzzleScramble` |
| 原生状态与有界完整记号 | `packages/puzzle-solvers/src/native-puzzle-model.ts`：`nativePuzzleKPuzzle`、`parseNativePuzzleAlg` |
| 完整展开图 | `packages/puzzle-render-core/src/native-puzzle-svg.ts`：`renderNativePuzzleSvg`、`nativePuzzleSvgAspect` |
| 模拟器项目与手动操作 | `packages/client/app/[lang]/sim/pgCatalog.ts`、`packages/client/components/TwistySection.tsx` 及其同目录 `NativePuzzleControls.tsx` |
| 页面手势 | `packages/client/components/puzzle-models/gestures/pgDrag.ts`：`createNativePuzzleDragGeometry`、`pickNativePuzzleDrag`；`nativePgPointer.ts`：`attachNativePgPointer` |
| 手动追加与锚点 | `packages/client/components/puzzle-models/gestures/nativePgMoveAppend.ts`：`attachNativePgMoveAppend`，校验并同步记录、终点状态及原生补间动画 |

- 从注册表派生选择器和生成器分支，保留已有项目 ID；沿用 `packages/client/scripts/generate-puzzle-icons.mts` 为 `/sim` 的 PG 目录项目生成同切割结构的 SVG 与共享图标映射，并运行 `puzzle-icon-catalog.test.ts` 验证菜单和下载目录。
- 原生 PG 的实际拼图先在共享 `svg/puzzle/` 生成同 ID 的结构图并收入 `/zh/icon`，再给模拟器、生成页和 Timer 接 `puzzle-${id}`；不要用 `textLabel` 占位、不存在的键或无关图标代替，文字徽标仅留给训练/自定义等语义模式。
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
| `lattice` | Lattice / Lattice Cube | `c v 0.577350269189626 v 1.154700538379252` | 参考 [Okamoto 专访](https://twistypuzzles.com/articles/spotlight-okamoto/)与[实物面形](https://robspuzzlepage.com/images/lattice-cube-calvin1.jpg)，以半边长 1 推导角切距离 1/√3、2/√3；核对每面的四个中部四边形与八个三角形。 |
| `hyperx` | Hyper X | `c f 0 v 0.275` | 按 [Grégoire Pfennig 的原作演示](https://www.youtube.com/watch?v=moAp71Z9Ios)组合 Master Skewb 与二阶面切，并核对[实物照片](https://robspuzzlepage.com/images/hyper-x-gregoire-pfennig1.jpg)；0.275 是保持原作切分结构的理想化角切深度，不是测量值。 |
| `latticex` | Lattice X | `c f 0 v 0.577350269189626 v 1.154700538379252` | 按 [Ola Jansson（olz91）的原作演示](https://www.youtube.com/watch?v=b0ie8C8XAnU)在 Lattice 上加入二阶穿心面切，核对[原作外形](https://robspuzzlepage.com/images/sm-twisty-cust/lattice-x-olz1.jpg)；每面的四个四边形被分成八个三角形。 |
| `masterbrilic` | Master Brilic | `d f 0.447213595499989 f 0.7888543819998317` | 按 [Tom van der Zanden 原作](https://www.tomvanderzanden.nl/puzzle.php?puz=Master+Brilic)与[实体版本说明](https://www.chewiescustompuzzles.com/puzzleshop/p/master-brilic)在 Pyraminx Crystal 上加层；取深切 d=1/√5、浅切 h=d+(1−d)/φ=4/√5−1，使小棱贴片保留三角形。 |
| `masterftov2` | 四阶 FTO v2 / Master FTO v2 | `o f 0 f 0.4` | 按 [Chewie's / Seth Holiday 实体设计说明与照片](https://www.chewiescustompuzzles.com/puzzleshop/p/master-fto-v2)加深外切；0.4 是保留原作分区的理想化深度，较普通 Master FTO 的 0.5 产生额外 24 块中心。 |
| `quadx` | Quad-X | `c e 0.47140452079103173` | 按 [Andrew Cormier 原型的博物馆档案与照片](https://twistypuzzles.com/app/museum/museum_showitem.php?pkey=2858)核对深棱切及中央方块；以立方体半边长 1、两对侧棱中点投影 ±√2 的三等宽层推导切深 ±√2/3。采用对称理想化切深及保形 180° 转动，不宣称复刻量产品尺寸或支持 jumbling。 |
| `dinoocta` | 恐龙八面体 / Dino Octa | `o f 0.5` | 按 [Katsuhiko Okamoto 2006 年原型档案](https://twistypuzzles.com/app/museum/museum_showitem.php?pkey=%3D2673)核对普通 FTO 不可见的八个面中心及每面十区；取内切球半径 1、面法向切深 1/2 的理想化结构。 |
| `fto5` | 五阶 FTO / 5-layer FTO | `o f 0.2 f 0.6` | 从正八面体每条边五等分独立构造均匀五阶 FTO：内切球半径 1 时，面法向切深 ±1/5、±3/5，每面 25 个等面积三角形；不声称测量复刻特定厂牌，也不使用未经核证的商品别名。 |
| `eto` | ETO 棱转八面体 / Eitan's ETO | `o e 0.6123724356957945` | 按 [Eitan Cher 原作说明](https://twistypuzzles.com/forum/viewtopic.php?f=15&t=19666)核对与 FTRD 的关系及隐藏中心；正八面体内切球半径 1 时，棱中点沿棱轴投影 √(3/2)，取其一半 √6/4。只支持保形 180° 棱转，不包含 jumbling。 |
| `radiocrystal` | Radio Crystal | `i f 0.3333333333333333` | 按 [Jason Smith 的 Radiolarian 9 原作](https://www.puzzleforge.com/wp/2012/12/)核对深切恰好穿过另一组六个面中心；二十个单位面法向中，与任意固定法向内积 1/3 的恰有六个，取该切深使中心消失。保形面转为 120°，不包含 jumbling。 |
| `cube3skewb` | 三阶＋斜转 / 3×3 + Skewb | `c f 0.333333333333333 v 0` | 按 [TwistyPuzzles 分类论文 §2.2](https://twistypuzzles.com/articles/other-classification/PieceSignature.pdf)的 Skewb 3x3x3／HF2C1 机制组合标准三阶面切与 Skewb 穿心角切；以立方体半边长 1 独立构造 ±1/3 与 0 切面，不声称测量复刻某个商品或读过尚未取得的原作者发布帖。 |
| `heliskewb` | 直升机斜转 / Helicopter Skewb | `c v 0 e 0.7071067811865476` | 按 [Tom van der Zanden 原作](https://www.tomvanderzanden.nl/puzzle.php?puz=Helicopter+Skewb)组合 Skewb 角切与 Helicopter 棱切；半边长 1 时角切过中心、棱切深 √2/2，分别支持保形 120° 与 180° 转动，不包含 jumbling。 |
| `comboctahedron` | Comboctahedron | `o f 0.333333333333333 v 0.5773502691896258 v 1.1547005383792517` | 按 [Hyperspeedcube 的面／角转实现](https://github.com/HactarCE/Hyperspeedcube/blob/main/lua/puzzles/fcto.lua)和 [CTO 角层定义](https://github.com/HactarCE/Hyperspeedcube/blob/main/lua/puzzles/cto.lua)组合面切 ±1/3 与顶点切 ±1/√3、±2/√3；第二组角切不增加可见片数，但保留独立角尖转动，不能省略。 |
| `circoradiolarian` | Circo-Radiolarian | `i f 0.7453559924999299` | 按 [Jason Smith 的 Radiolarian 2 原作](https://www.puzzleforge.com/wp/2010/01/11/radiolarian-2-12010/)及 [Hyperspeedcube 的 radio02 实现](https://github.com/HactarCE/Hyperspeedcube/blob/main/lua/puzzles/ft_icosahedra.lua)，取直线面切 1−(1−1/φ)×2/3=√5/3；保留三角形及四边形表面分区，仅支持保形 120° 面转。 |
| `icosababyface` | 深切角转二十面体 / Deep-Cut Icosahedron | `i v 0.562777422255239` | 使用 [cubing.js 维护者列出的单层深角切描述](https://github.com/cubing/cubing.js/issues/127)，以外接球半径 r 推导切深 r/√5，使每个切面经过五个邻接顶点；只采用 Dogic 的深切族，不添加小角片。上游昵称带问号，显示名使用明确结构名称。 |
| `cube3heli` | 三阶＋直升机 / 3×3 + Helicopter | `c f 0.333333333333333 e 0.7071067811865476` | 根据 [cubing.js 官方 pgPuzzles.ts](https://github.com/cubing/cubing.js/blob/main/src/cubing/puzzle-geometry/pgPuzzles.ts) 的独立 `3x3x3`、`helicopter` 预设及 [Jaap 的平面棱转说明](https://www.jaapsch.net/puzzles/helicopter.htm)，组合均匀三阶面切与 Helicopter 棱切；以立方体半边长 1 推导面切 ±1/3、棱切 ±√2/2。支持保形 90° 面转及 180° 棱转，不包含 jumbling，不宣称精确复刻 Grégoire Pfennig 的 Helicopter 3×3 实物切深。 |
| `radiojewel` | Radio Jewel / Radio Jewel | `i f 0.5278640450004204` | 按 [Jason Smith 的 Radiolarian 7 原作](https://www.puzzleforge.com/wp/2012/11/06/radiolarian-7-radio-jewel-112012/)和 [Hyperspeedcube 的 radio07 实现](https://github.com/HactarCE/Hyperspeedcube/blob/main/lua/puzzles/ft_icosahedra.lua)，取内切球半径 1、面切深 5−2√5；核对原作照片的中央六边形与十五个三角形，以及[实体规格的 242 个外露块](https://cubein.cn/products/radio-jewel-radiolarian-7)。保留二十色和保形 120° 面转，不包含实物的两种 jumbling，不宣称测量复刻商品尺寸。 |
| `radiocanon` | Radio Canon / Radio Canon | `i f 0.77` | 按 [Jason Smith 的 Radiolarian 1.5 原作](https://www.puzzleforge.com/wp/2014/05/08/radiolarian-1-5-the-radio-cannon-52014/)核对固定面中心及实物分区，采用 [Hyperspeedcube 的 `radio01_5` 切深](https://github.com/HactarCE/Hyperspeedcube/blob/main/lua/puzzles/ft_icosahedra.lua) 0.77；这是已知模拟器的理想化平面模型，不是商品尺寸测量值。保留标准 120° 面转，不包含 jumbling。 |

把拼图描述视为几何数据；Dino Skewb、3×3 + Dino 与 3×3 + Helicopter 的组合描述由已核证的两类切面推导，不标注成上游预设中逐字复制的条目。

## 可见几何与 SVG

| 项目 | 面数 | 每面可见贴片 | 可见贴片总数 | 可见块轨道 | 基本转角 |
| --- | --- | --- | --- | --- | --- |
| SuperZ | 6 | 8 | 48 | 8 个三贴片角块、24 个单贴片中心块 | 面轴 90°、体对角轴 120° |
| 3×3 + Dino | 6 | 16（12 三角形、4 正方形） | 96 | 24 个双三角贴片棱块、12 个双四边形贴片棱块、24 个单三角贴片中心块 | 面轴 90°、体对角轴 120° |
| Dogic（二十色） | 20 | 4 | 80 | 60 个小三角块、20 个大三角块 | 顶点轴 72° |
| 四阶八面体 | 8 | 4 | 32 | 24 个小三角块、8 个大三角块 | 顶点轴 90° |
| Dino Skewb | 6 | 12 | 72 | 24 个双贴片棱块、24 个单贴片中心块 | 体对角轴 120° |
| Lattice | 6 | 12（8 三角形、4 四边形） | 72 | 24+12 个双贴片棱块 | 体对角轴 120° |
| Hyper X | 6 | 20（16 三角形、4 四边形） | 120 | 8 角块、24 棱块、24+24 单贴片中心块 | 面轴 90°、体对角轴 120° |
| Lattice X | 6 | 16（三角形） | 96 | 两组各 24 个双贴片棱块 | 面轴 90°、体对角轴 120° |
| Master Brilic | 12 | 30（15 三角形、15 四边形） | 360 | 20 角块、60+30 棱块、60+60 单贴片中心块 | 面轴 72° |
| Master FTO v2 | 8 | 19（13 三角形、3 四边形、3 五边形） | 152 | 6 四贴片角块、24 棱块、三组各 24 个中心块、8 个单贴片中心块 | 面轴 120° |
| Quad-X | 6 | 21（16 三角形、5 四边形） | 126 | 8 角块、12 棱块、三组各 24 个中心块、6 个面中心 | 棱轴 180° |
| Dino Octa | 8 | 10（7 三角形、3 四边形） | 80 | 6 四贴片角块、12 棱块、24+8 个中心块 | 面轴 120° |
| 五阶 FTO | 8 | 25（三角形） | 200 | 6 四贴片角块、24+12 棱块、四组各 24 个中心块、8 个面中心 | 面轴 120° |
| ETO | 8 | 13（10 三角形、3 四边形） | 104 | 6 四贴片角块、24 棱块、24+8 个中心块 | 棱轴 180° |
| Radio Crystal | 20 | 15（三角形） | 300 | 12 五贴片角块、60+30 棱块、60 个中心块 | 面轴 120° |
| 3×3 + Skewb | 6 | 21（12 三角形、8 五边形、1 正方形） | 126 | 8 角块、24 棱块、两组各 24 个中心块、6 个面中心 | 面轴 90°、体对角轴 120° |
| Helicopter Skewb | 6 | 8（三角形） | 48 | 8 三贴片角块、24 单贴片中心块 | 体对角轴 120°、棱轴 180° |
| Comboctahedron | 8 | 9（三角形） | 72 | 6 四贴片角块、12 棱块、24 个中心块 | 面轴 120°、顶点轴 90° |
| Circo-Radiolarian | 20 | 15（9 三角形、6 四边形） | 300 | 12 五贴片角块、60+30 棱块、60 个中心块 | 面轴 120° |
| Deep-Cut Icosahedron | 20 | 1（完整三角形） | 20 | 20 个完整单面块 | 顶点轴 72° |
| 3×3 + Helicopter | 6 | 28（12 三角形、12 四边形、4 五边形） | 168 | 8 个三贴片角块、24 个双贴片棱块、四组各 24 个单贴片中心块，共 128 块 | 面轴 90°、棱轴 180° |
| Radio Jewel | 20 | 16（15 三角形、1 六边形） | 320 | 12 个五贴片角块、30 个双贴片棱块、三组各 60 个三角中心块、20 个六边形中心块，共 242 块 | 面轴 120° |
| Cat’s Cradle | 20 | 19（15 三角形、3 四边形、1 六边形） | 380 | 12 个五贴片角块、60+30 个双贴片棱块、两组各 60 个单贴片中心块、20 个六边形中心块，共 242 块 | 面轴 120° |
| Radio Canon | 20 | 16（7 三角形、9 四边形） | 320 | 12 个五贴片角块、60+30 个双贴片棱块、60 个单贴片中心块、20 个固定三角中心，共 182 块 | 面轴 120° |

- 从 `get3d()` 的 `isDup` 排除只为表示朝向而重复的贴片，再统计可见几何；开启 `orientCenters` 后 Dogic 和四阶八面体会分别返回 120、48 条贴片数据，不要把它们当成实际贴片数。
- 对 Master FTO v2 去掉 168 条原始数据中的 16 个朝向重复片，保持 152 个真实贴片；核对普通 Master FTO 为 128 片、86 块，新版为 152 片、110 块，不把版本差异只实现为名称或配色。
- 对 Master Brilic 用独立切线交点锁定每面的 10 个小棱三角形；拒绝用 0.8 代替 4/√5−1，即使两者都返回 360 片，前者也会将这 10 片变成带微小第四边的四边形。
- 对 Radio Jewel 保留 5−2√5 的临界切深，从 360 条原始数据中去掉 40 个六边形中心朝向重复片，输出 320 片；以独立半空间分割核对每面 15 个三角形及一个六边形，并检查切深 ±0.0001 两侧均重新出现额外小片。
- 对 Quad-X、Dino Octa、五阶 FTO、ETO 分别从 144、96、216、120 条原始 PG 数据去除面中心朝向重复片，保留 126、80、200、104 个可见区域；Radio Crystal 的 300 片无面中心重复，不得补入小中心片。
- 对 3×3 + Skewb 和深切角转二十面体分别从 144、60 条原始数据去除朝向重复片，保留 126、20 个真实区域；后者每个还原面是完整三角形，不把同色三角面的不可辨自转算成未还原。
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
| `3A` | 从该轴端数第三层，单独转动 |
| `Aw` | 最外两层一起转动；等价于 `A 2A` |
| `3Aw` | 最外三层一起转动，适用于该轴层数允许的范围 |
| `1-2A`、`1-3A` | 使用 FaceRenamingMapper 的十二面体／FTO 面族的规范宽转，分别合并最外两层、三层；这些项目不接受 `Aw` |
| `Av` | 绕该轴整体转体 |
| 后缀 `'` | 逆向一个基本转角 |
| 后缀 `2` | 同向两个基本转角；不要与开头的层号 `2` 混淆 |

- 将 Dogic 的 `Aw` 接为围绕顶点的五个完整面转动，将 `A` 接为五个小三角块转动；例如 `FREGUw` 转动 15 个小三角块与 5 个大三角块，`FREGU` 只转动 5 个小三角块。
- 将 Dino Skewb 的 `Aw` 接为 Skewb 半体转动，将 `A` 接为较浅的 Dino 转动；例如 `UFRw` 转动 12 个棱块与 12 个中心块，`UFR` 与 `2UFR` 各转动其中互不相交的 6 个棱块与 6 个中心块。
- 将四阶八面体的 `Aw` 接为两层宽转；例如 `ULFRw` 转动 12 个小三角块与 4 个大三角块，`ULFR` 只转动 4 个小三角块，`2ULFR` 转动 8 个小三角块与 4 个大三角块。
- 保留合法内层单转；它可以由宽转与外层逆转组合得到，不要把 `2A` 错当成宽转。
- 对 SuperZ 分别提供六个面向的 90° 转和八个角向的 120° 转，不添加不存在的独立内层/宽层按钮；原生 `2R = L'`、`2DRF = UBL'`，整体转写作 `Rv = R L'`、`DRFv = DRF UBL'`，不要套用该模型不支持的 `Rw` 或 `x/y/z`。
- 对 3×3 + Dino 同时提供面轴与角轴的外层、独立内层和两层宽转；核对 `Fw = F 2F`、`UFRw = UFR 2UFR`、`Fv = F 2F B'` 和 `UFRv = UFR 2UFR DLB'`，拒绝超深的 `3Fw`、`3UFRw` 与该原生模型不支持的 `x/y/z`。
- 对 3×3 + Helicopter 的六个面向与十二个棱向提供 `A/2A/Aw/Av`；每轴三个物理层只需两种独立深度，核对 `Fw = F 2F`、`DFw = DF 2DF`、`Fv = F 2F B'`、`DFv = DF 2DF UB'`，拒绝全层宽转 `3Fw/3DFw`。使用 `axisOrders` 的 90°/180° 周期，生成 60 步交替面转与棱转的练习打乱，并在各机制内部轮换外层与两层宽转；棱轴只生成 ±1 步，不宣称均匀随机状态。
- 对 Lattice 与 Lattice X 的五个物理角层提供 `A`、`2A`、`3A`、`Aw`、`3Aw`；保留 `5A = O'`、`4A = 2O'`、`3A = 3O'` 的对侧轴 O 别名，完整输入仍接受合法四层宽转。
- 对 Hyper X 的三个物理角层提供 `A`、`2A`、`Aw`；对 Hyper X／Lattice X 的两个面半体只提供外层按钮，使用逐轴 `axisLayers`，拒绝不存在的面 `Fw`，但保留合法的对侧 `2F = B'` 输入。
- 对 Master Brilic 的五个物理层提供三个独立层深，对 Master FTO v2 的四个物理层提供两个独立层深；保留对侧深层别名和合法范围输入，用 `Av` 表示整体旋转，拒绝全层范围冒充局部宽转。
- 对五阶 FTO 的五个物理层提供 `A`、`2A`、`3A`、`1-2A`、`1-3A`，保留中层对侧别名；Dino Octa 同样使用面族范围宽转，不接受 `Aw`。
- 对 Quad-X、ETO 和 Radio Crystal 使用原生 `A/2A/Aw/Av`；只把前两者的棱轴或 Radio Crystal 的二十个面轴注册为局部转动，不误收 `addRotations` 的其他整体转轴。
- 对 Radio Jewel 的二十个面向提供 `A/2A/Aw/Av`，核对 `Rw = R 2R`、`Rv = R 2R K'` 和 `2R = 2K'`，拒绝不存在的 `3Rw`；复用 60 步原生随机转动生成器，不伪造 csTimer 项目或宣称均匀随机状态。
- 对 Quad-X 与 ETO 只生成 ±1 个 180° 基本转角，过滤 ±2 个基本角的整圈空动作；切入两阶转轴时将残留角度按方向归一到 ±1，关闭实时消步时保留输入的正反方向。
- 对穿过中心的同一内层，用实际轨道变换识别反向别名；3×3 + Dino 的 `2F = 2B'`、`2UFR = 2DLB'` 是同一动作，不以文字不相同判定拖动错误，并继续独立核对旋转方向。
- 对混合机制的练习打乱，在每类机制内部按该轴支持的层深轮换；保留已有一／二层项目的随机源调用与序列，确保 Lattice X 覆盖面外层与角轴的三种深度，不强行给面半体生成宽转。
- 用 `axisOrders` 表达实际混合轴周期，按机制组轮换打乱；分别保留三阶＋斜转的 90°/120°、直升机斜转的 120°/180° 与 Comboctahedron 的 120°/90°，不要假定前三轴永远为 90° 面轴。
- 对三阶＋斜转提供面轴两种独立深度与角半体，对直升机斜转提供角半体与棱轴两种独立深度；同一拼图内切换到 180° 轴时也须把残留 ±2 步归一到 ±1。
- 对 Comboctahedron 使用外部规范面族 `F/B/D/U/L/BR/BL/R` 与带下划线的顶点族（如 `D_BR_R_F`），面轴提供两种独立深度、顶点轴提供三种；宽转只用 `1-2A/1-3A`，整体转用 `Av`，不要用 `Aw` 或内部族名替代菜单与拖拽匹配。
- 从原生招式校验后提取可转轴；开启 `addRotations` 时，`get3d().axis` 还含只能整体转体的面轴和棱轴，不能直接把每一项都展示为局部转动按钮。
- 为 PG 项目关闭三阶自动空格，保留多字母族名、前置层号、宽转与整体转；只让 `nativePuzzleMoves` 决定手动按钮，完整输入范围交给原生记号校验，不拿按钮列表限制公式。

## 有界输入与播放

- 先检查原始文本长度和括号嵌套，再调用原生递归 parser；展开前计算 AST 工作量，覆盖大转数、嵌套重复、换位子、共轭和空分组重复。
- 对 setup 和 alg 的完整序列调用 `parseNativePuzzleAlg`，通过所有招式的模型校验后才构造或更新原生播放器、展开时间轴、简化、求逆及生成 SVG；不要仅依赖语法 parser 判断合法层和族名。
- 输入无效时标红并暂停播放，保留上次合法盘面；同时阻止原生播放器自带播放入口和手动追加绕过校验，不让不完整编辑触发异步异常或部分状态更新。
- 解法无效时同时禁用随机打乱按钮并在回调入口检查有效性，避免直接赋新 setup 绕过两框原子校验；仅打乱框无效时，允许新随机序列替换该框并恢复合法状态。
- 延迟播放回调使用独立于本地引擎重放的请求序号，执行前核对拼图、播放器与当前草稿；编辑、重打乱或切换后取消过期请求。合并 setup 与 alg 前保留行末注释的换行边界，避免取逆吃掉另一框的招式。
- 终点锚定时，手动追加 `M` 同步把 setup `S` 改成 `S M`、alg `A` 改成 `A M`，保留原起点并推进终点；先完整校验两框，再更新模型、草稿与分享状态，使用真实 `currentPattern` 验证盘面确实改变。
- 将编辑器实际追加后的完整文本返回手动适配层，按真实回执识别延迟或批量回写并保留注释；用户编辑应取消旧动作，不从模型规范式猜测原文，也不用盘面等价判断是否为自动回写。

## 原生拖拽适配

- 将原生 tap 转动、拖空白 orbit 与拖可抓件转层分开；原生 PG 提供模型和点击能力，真实拖层复用 `pgDrag.ts` 与 `nativePgPointer.ts`，由 `TwistySection.tsx` 挂载并接手动记录。
- 原生播放器采用封闭 Shadow DOM，外层宿主的 `composedPath()` 看不到 canvas；通过公开 vantage 的 `contentWrapper` 在内部捕获起手，宿主继续处理捏合、捕获后的移动与结束。用完整封闭 Shadow DOM 树测试，不能用开放树替代。
- 切换拼图时使不适用的深度选择失效；没有内层选择器的模型不得继续消费上个拼图隐藏的宽层或内层设置。
- 让第三单层与两／三层宽转同时适用于拖动和点击；按 `nativePuzzleMoves` 的 `family`、`depth` 查找规范招式，缺少对应层时取消点击，不退回外层，也不直接拼 `w`。
- 在 raycast 前更新矩阵，把世界命中点经目标对象 `worldToLocal` 转成局部坐标；按原生网格实际缩放对齐 `get3d()` 顶点，只应用一次缩放，再把局部点和轴变回世界空间计算屏幕切向。
- 从非重复的当前空间槽位及合法转动的置换/朝向变化筛选候选层；PG 端态会重新着色固定槽位，不用贴片当前颜色或还原块身份推断可动层，缝和黑体命中也匹配相邻槽位。
- 支持自动、外层、第二／第三单层和两／三层宽转的适用选择；自动选择只纳入单层，保持转动锁和未命中时的 orbit 行为。
- 用绕朝外轴的负角度 `-2π/order` 独立旋转几何，对照原生置换确认裸招式从外看顺时针；当前切向评分采用右手正方向，转成原生 amount 时用 `-score.dir`，不要用互逆还原替代方向验证。
- 覆盖对象已整体旋转、缩放与平移后的命中和方向；用独立投影拖动向量检验正反向、不同深度与脱靶，避免测试与实现共用同一符号错误。

## 验证范围

- 按改动选择 `packages/client/tests/superz_geometry.test.ts`、`cube3dino-geometry.test.ts` 和 `additional-puzzles-native-geometry.test.ts`，核对片数、合法深度、宽转组合、基本周期及独立刚体旋转与原生置换；用独立切平面交线锁定组合模型的每面轮廓。
- 用 `lattice-hyperx-geometry.test.ts` 与 `polyhedral-native-geometry.test.ts` 从独立正多面体外法向及切深重建分区、选择动块并核对正反转、五个进度的隔离面距离；不要用 PG 的 moved-set 反推预期选层。
- 构建 puzzle-solvers 后运行 `packages/client/scripts/native-puzzles/compare-outlines.mjs` 复现五项目的切线对比和完整展开图，输出到 `core/.tmp/png/native-five-outlines.svg`；该图供轮廓核对，独立推导与选层正确性仍由上述测试证明。
- 传入 `--set=2026-10` 复现 Quad-X、Dino Octa、五阶 FTO、ETO、Radio Crystal 的切线对比与单款放大 SVG，输出到 `core/.tmp/png/native-five-2026-10-outlines*.svg`；允许注册前使用提议数据，注册后校验描述与物理片数一致。
- 用 `native-five-geometry.test.ts` 独立构造三种正多面体外法向和切面，逐面核对分区、全轴层选择、正反转、五个进度隔离面与真实 PG3D 半转矩阵；使用真实 SVG 回归确认物理面中心只绘制一次。
- 传入 `--set=2026-10-12` 复现三阶＋斜转、直升机斜转、Comboctahedron、Circo-Radiolarian、深切角转二十面体的对比和放大 SVG；用 `native-mixed-puzzles-geometry.test.ts` 独立核对完整分区、块归属、全轴层深、五个进度与独立角尖，用 `native-puzzles-client-integration.test.ts` 的改前散列锁定旧项目固定种子序列。
- 构建 puzzle-solvers 后，从 `core/` 运行 `node packages/client/scripts/native-puzzles/compare-outlines.mjs --set=cube3heli`，生成 `core/.tmp/png/cube3heli-outlines.svg` 与 `cube3heli-outlines-cube3heli.svg`；核对黑色三阶原切线、绿色新增棱切线、蓝色冻结轮廓、灰色约束包络及六面完整展开图。
- 对 Radio Jewel 先运行同一轮廓脚本的 `--set=radiojewel`，对照原作照片核对六边形中心和三角形星状分区；将黑色 Radio Crystal 线仅作对比，不保留为新模型切面，并以独立几何、真实 PG3D 中间矩阵及三入口交互分别记录验证范围。
- 用 `native-mixed-puzzles-geometry.test.ts` 的 3×3 + Helicopter 样本锁定每面 28 区、168 贴片和 128 块；连续交错执行 `F UF' 2R' DFw Fv 2BL' Bw'`，从当前刚体顶点独立选层，在每步的五个进度核对切面分离，并将片位与朝向逐步对照 PG 状态；用真实 TwistyPlayer 创建的 PG3D 对全部手动层深检查 50% 进度的被选块、正反 amount 和正反播放方向，明确这属于本地渲染器测试，不替代浏览器拖拽实测。
- 用 `native-puzzle-drag.test.ts` 核对真实几何上的拾取与方向，用 `native-puzzle-svg.test.ts` 和 `native-puzzles-client-integration.test.ts` 核对有界输入、完整记号、原生颜色、确定性生成、共享 SVG 和 PDF 比例；这些文件同在 `packages/client/tests/`。
- 用 `native-puzzle-manual-anchor.test.ts` 读取未挂载真实 TwistyPlayer 的 `currentPattern`，核对双锚点下快速追加的盘面、记录和分享重建，以及编辑打断与卸载后的过期取消。
- 用 `sim-native-companion-lifecycle.test.ts` 挂载真实页面、播放器控件与图像面板，覆盖原生→通用 PG→原生：旧伴图清空，等待精确帧时复制、下载及已打开的导出菜单禁用，返回后恢复当前原生 SVG；仅验证独立镜像 helper 的清理不覆盖页面保留上一帧的问题。
- 在浏览器分别记录模型显示、手动操作、随机打乱、公式播放、记录与分享恢复；WebGL 不可用时验证二维按钮和展开图，明确保留 3D 动画与拖拽未验，不把 tap、静态几何或离线手势测试当成 3D 浏览器验收。
- 展开记号说明后核对项目名称与全部文字可读，并为画布上的背景等浮层保留空间，避免浮层遮挡手动控件和说明。

## 机制审查记录

- 2026-10 新增候选中，Compy Skewb 被排除。[原作者页面](https://www.tomvanderzanden.nl/puzzle.php?puz=Compy+Skewb)及[详细发布帖](https://twistypuzzles.com/forum/viewtopic.php?f=15&t=18117)说明角尖与内部 Skewb 联动，浅层 Compy 转动时角尖固定。直接组合 `c v 0 v 0.915641442663986` 虽能生成相似切线，却会在浅层转动时扭动 `CORNERS`，无法表达原作联动，不能将该纯 PG 描述命名为 Compy Skewb。
- Quad-X 与 ETO 是此注册表首批基本周期为 2 的项目。旧生成器把所有非 3/4 周期都按 5 周期提供 `2` 后缀，旧控件也固定显示 ±1/±2，导致 360° 单位动作。以实际周期过滤整圈，同时保留相反动画方向；实时消步开启时原生规范化可将半转逆向写法归一为正向，关闭时保留原文。
- 原生 `orientCenters` 使用重合轮廓表示单色中心朝向。预实现原始 SVG 中 Quad-X 的方中心有四份、三种八面体的三角中心有三份，这不是四块或三块可见贴片；下游 `renderNativePuzzleSvg` 保存完整颜色表后去重，勿通过关闭朝向模型消除这些内部数据。
- Comboctahedron 的浅顶点切 ±2/√3 与既有面切在表面交线重合，省略后仍得到 72 个三角贴片，却失去独立尖角转动。通过单尖只改一角朝向、两层宽转与单尖不等的独立回归核对完整机制；仅凭外轮廓及片数相同不足以认定模型等价。


## 二阶＋直升机

- 将 `cube2heli` 作为平面二阶／直升机组合，使用 `c f 0 e 0.7071067811865476`；不要称为某一曲面零售型号的尺寸复刻，不支持 jumbling。
- 核对标准直升机切面及实体：<https://www.jaapsch.net/puzzles/helicopter.htm>；实物组合的独立照片与原作者链接见 <https://robspuzzlepage.com/rearrangement.htm> 的 Helicopter+2x2 小节。使用立方体半边长 1：三张中心面切面为 x/y/z = 0，棱切深为 sqrt(2)/2。
- 保留每面八个三角形、六面 48 个可见贴片、8 个三色角块与 24 个单色面块；中心面切面与部分既有表面切缝重合，但添加了独立面转，不能从描述中删除 `f 0`。
- 按九对轴登记 `axisOrders = [4,4,4,2,2,2,2,2,2]` 与 `axisLayers = [1,1,1,2,2,2,2,2,2]`；面轴只提供两半外层，第二层与两层宽转只用于棱轴；完整转体采用 `Av`，拒绝面宽转 `Fw`。
- 生成 40 步练习打乱并交替面转／棱转，不声称 WCA 或均匀随机状态；复用原生 provider、完整六面 SVG、记号与手动历史，使用 `cube2heli` 保存计时记录，csTimer 导出用 `input` 并保留 `cuberootEvent`。
- 运行 `node core/packages/client/scripts/native-puzzles/compare-outlines.mjs --set=cube2heli` 重现平面对照；生成结构图标后运行共享图标映射生成器，不为重合切缝编造额外线条。
- 扩展现有独立半空间、交错转动与 PG3D 中间帧用例，并遍历手动选择、拖转层、二维回退、分享锚点、Timer 外层预览与双进口 round-trip；独立模型和 jsdom 中间帧均不等于浏览器 3D 拖拽实测。

- 新增 Timer 项目还会改变完整项目分区、选择器图标／文字徽标数量与三来源矩阵；同步检查 `timer_event_catalog.test.ts`、`timer-puzzle-picker.test.ts`、`timer-drill-contract-shared.test.ts`、app-ui 的 `scramble-source-matrix.audit.test.ts`，并在 `timer-sync-seed.test.ts` 验证普通／种子打乱共用原生生成器。保留完整名单与数量断言，不以删除断言消除目录漂移。

## Six-layer FTO

`fto6`（六阶 FTO / 6-layer FTO）沿用 [Jaap 的 FTO 面转与平行切面说明](https://www.jaapsch.net/puzzles/octaface.htm)，将正八面体每条边六等分。这是独立构造的均匀六阶结构，不声称复刻某个商品。内切球半径为 1 时，切深为 0、±1/3、±2/3，描述为 `o f 0 f 0.3333333333333333 f 0.6666666666666666`。每面 36 个等面积三角形，共 288 个可见贴片；6 个四贴片角块、48 个双贴片棱块、168 个单贴片中心块，共 222 块。

每步面转 120°。八个面向均提供 `A`、`2A`、`3A`、`1-2A`、`1-3A`，沿用原生 FaceRenamingMapper 范围记号，不拼接无效 `Aw`。六阶两侧的第三层互不相同，不能沿用五阶的中央层反向别名。普通和种子入口共用 72 步有界随机转动，仅供练习，不伪造 csTimer 类型或宣称均匀随机状态。

三入口矩阵：模拟器复用原生手动操作、拖转、播放、记录和分享；Timer 保留独立 `fto6` 会话及 `cuberootEvent` 导出元数据；生成页比赛、批量、输入以及 PDF 使用同一完整八面展开 SVG。菜单归入“FTO 与八面体”，结构图标由现有 `generate-puzzle-icons.mts` 生成。

开工平面对比先核对四阶旧切线、六阶新切线及固定三角包络。`fto6-native-geometry.test.ts` 独立核对贴片面积、表面块数、40 种动作的顺时针刚体对应、宽转组合与两侧第三层区别；跨入口、种子、导入导出及 SVG/PDF 继续由既有逐原生项目契约覆盖。测试结果、浏览器能力和正式部署是单独的验收证据；二维回退通过不等于三维拖转通过。

## Cat’s Cradle

- 将 `catscradle` 注册为 Jason Smith 的 Cat’s Cradle（Radiolarian 5），核对[原作者的实物与机制说明](https://www.puzzleforge.com/wp/2012/10/06/radiolarian-5-cats-cradle-102012/)及 [Hyperspeedcube 的 `radio05` 切深](https://github.com/HactarCE/Hyperspeedcube/blob/main/lua/puzzles/ft_icosahedra.lua)；中英文菜单沿用原名，不编造中文商品名。
- 以内切球半径 1 使用 `i f 0.566915270681799`，保留 `h = φ²/(2+φ²) = (4+√5)/11` 的临界精度；每面保留 15 个三角形、3 个四边形及1个六边形。从 420 条原生数据中排除 40 个朝向重复片，输出 380 个可见贴片、242 个可见块，不把单色六边形中心的自转重复绘制成额外贴片。
- 按二十个面向提供 `A/2A/Aw/Av`，复用原生面名与 120° 基本转角；核对 `Aw = A 2A`、对侧中层反向别名与整体转体，拒绝 `3Aw` 等不存在的局部层。保留原作仅保形标准转动的实现边界，在两语说明中明确不含 jumbling。
- 在注册前从 `core/` 运行 `node packages/client/scripts/native-puzzles/compare-outlines.mjs --set=catscradle` 生成平面对照及完整展开图，核对原作网状切分；黑色 Radio Web 线只作几何对比，不保留为新模型切面。
- 在 `native-mixed-puzzles-geometry.test.ts` 从独立正二十面体半空间重导全部面、片位和层选择；将 `h±0.0001` 的两侧分区作为负例，两者都恢复为每面 22 区，不能用近似切深冒充原作。遍历全部手动层、整体转体、正反方向与五个进度的切面分离，并分别验证真实 PG3D 的中间矩阵及浏览器拖转。
- 让三入口消费同一注册表、60 步原生随机转动与完整二十面 SVG；计时记录使用独立 `catscradle`，csTimer 导出用 `input` 并保留 `cuberootEvent`，导入兼容直／弯撇号名称和 `Radiolarian 5`。保留练习来源说明，核对比赛、批量、输入和 PDF，不宣称 WCA 或均匀随机状态。

## Radio Canon

- 将 `radiocanon` 注册为 Jason Smith 的 Radio Canon（Radiolarian 1.5），沿用原名和 `Canon` 文字徽标。以内切球半径 1 使用 `i f 0.77`，按上表原作照片及上游 `radio01_5` 切深核对每面的七个三角形和九个四边形；320 片与 Radio Jewel 数量相同，分区和块结构不同。
- 在注册前从 `core/` 运行 `node packages/client/scripts/native-puzzles/compare-outlines.mjs --set=radiocanon`，对照 Circo-Radiolarian 的旧切线和 Radio Canon 的新切线；旧切深仅作比较，不能一起保留在新描述中。放大中央三角和周围四边形，并核对完整二十面展开图。
- 从 360 条原生数据排除 40 个面中心朝向重复片，保留 320 个可见贴片、182 个可见块。复用 `native-mixed-puzzles-geometry.test.ts` 的独立正二十面体半空间分割，核对原生轨道 `C5RNER(12,5)`、`EDGES(60,2)`、`CENTERS(60,1)`、`EDGES2(30,2)`、`CENTERS2(20,3)`，不把轨道名称当成独立几何证据。
- 从独立面中心定位二十个中央三角。核对不同面法向点积的最大值为 `√5/3 < 0.77`，并逐外层面转及逆转检查所有中央三角置换保持恒等；转动面的单色中心允许不可辨自转。固定中心不意味着内层转动或整体转体的中心置换也恒等。
- 复用二十面轴、120° 基本转角及 `A/2A/Aw/Av` 记号，检查宽转组合、对侧中层反向别名和非法层拒绝。遍历全部手动层及整体转体的独立刚体终态与五进度切面分离；对真实 PG3D 在 `0/0.2/0.5/0.8/1` 逐手动层核对正反转动及播放方向，同时单独记录浏览器能否实测 3D 拖层。
- 让三入口共用 60 步练习用随机转动和完整 SVG，沿用保形转动、不含 jumbling 的双语说明。csTimer 导出用 `input` 并保留 `cuberootEvent`；导入兼容 Radio Canon、Radio Cannon、Radiolarian 1.5，并保留小数点和词边界，拒绝将 Radiolarian 15、1.50 或 Radio Canonical 误归本项目。
