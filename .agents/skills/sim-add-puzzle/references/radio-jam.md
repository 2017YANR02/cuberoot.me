# Radio Jam（Radiolarian 8）

项目 ID 为 `radiojam`，中英文保留原名 Radio Jam。复用共享原生 PG 注册表、状态模型、拖转适配和 SVG，不复制引擎或其他 Radio 项目。

## 原作、切割与支持范围

- [Jason Smith 原作说明（2012-12-06）](https://www.puzzleforge.com/wp/2012/12/06/radiolarian-8-radio-jam-122012/)：面转二十面体，位于 Radio Jewel 与 Radio Crystal 之间，各棱两侧新增细小三角块；实物另有 jumbling。
- [Hyperspeedcube 固定版本的 `ft_icosahedra.lua`](https://github.com/HactarCE/Hyperspeedcube/blob/63737aa467ed8eccacafaae3eec97cf1f980b794/lua/puzzles/ft_icosahedra.lua)：必须读取 `radio08` 实际 `axes:add` 中的 `radio7 - 0.06`，其中 `radio7 = 5 - 2 sqrt(5)`。文件顶部另有 `radio8 = 1/phi^2`，但它没有被此模型引用，不能按名称猜切深。
- 以原二十面体内切球半径为 1，在 20 个朝外单位面法向上设置 `n·x = d`，`d = 5 - 2 sqrt(5) - 0.06 = 0.4678640450004204`。PG 描述为 `i f 0.4678640450004204`；这是已核对的理想化模型，不宣称商品实测尺寸。
- 保留 120° 外层面转、第二单层、两层宽转与整体重定向；从外看裸招式为顺时针。**只支持保形转动，不支持 jumbling**，在模拟器中英文记号说明内明确展示。
- 60 步原生随机转动练习打乱，可注入随机源；不是均匀随机状态或 WCA 打乱。csTimer 交换采用 `input`，用现有 `cuberootEvent` 元数据保留真实项目。

## 独立几何与防混用

先从独立的二十面体面法向重建原三角形，再按所有切平面分割；每面必须恰有 **22 片：15 个三角形、6 个五边形、1 个六边形**。20 面共 440 个物理贴片、302 个表面实体：12 个五贴片角、90 个双贴片块、200 个单贴片块。分割面积之和必须等于原三角形面积，不能忽略细小三角块。

Radio Web 也有 440 片、302 个表面实体，但每面的形状分布是 12 个三角形、6 个四边形、3 个五边形、1 个六边形；误用 `1/phi^2` 则是 15 个三角形、3 个四边形、3 个五边形、1 个六边形。因此总数量一致不代表切割正确。`native-mixed-puzzles-geometry.test.ts` 同时锁定切深、全部逐面多边形、形状分布、块归属、正反向刚体转动与五个中间进度的切面分离，并包含上述两个负例。

构建 puzzle-solvers 后，从 `core/` 运行现有 `node packages/client/scripts/native-puzzles/compare-outlines.mjs --set=radiojam`，核对黑色 Radio Jewel 对比线、绿色 Radio Jam 新线、蓝色冻结外轮廓、灰色包络及实际完整展开图。黑线不作为新模型保留切面。输出在 `core/.tmp/png/`，不提交临时图或截图。

## 三入口接线与执行

| 入口 | 复用路径 | 需要实际核对 |
| --- | --- | --- |
| `/zh/sim?puzzle=radiojam`、`/sim?puzzle=radiojam` | 原生注册表 → PG 目录 → 二十面体菜单 → TwistySection | 三种层深手动转动、随机打乱、播放时间轴、记录、分享恢复，中英文与移动视口；分别记录 3D 和强制二维回退 |
| `/zh/timer?event=radiojam` | shared Timer 项目、native-random-move provider → 同一 SVG | 普通/种子打乱、完整 20 面预览、来源文案、持久化和 csTimer 导入导出保留项目 |
| `/zh/scramble/gen` | 原生项目注册表 → 比赛/批量/输入 → 同一 SVG/PDF | 三模式都能选择并生成或输入，440 片完整展开图、8:5 图示比例、PDF 下载 |

扩展现有逐项目测试矩阵而不移除旧项目：原生几何/拖转/手动锚点/控件/SVG/三入口，Timer 来源/种子/预览/持久化/导入导出，以及模拟器菜单与图标契约。shared 改动后必须重建 shared，再执行 client `build:deps`、目标 vitest、typecheck 和架构检查。

图标由现有 `generate-puzzle-icons.mts` 读取同一 PG 描述生成，再运行 `pnpm --filter @cuberoot/event-icon generate`。Timer、生成页和模拟器共用 `puzzle-radiojam` 图标。
