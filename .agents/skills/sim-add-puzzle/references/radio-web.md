# Radio Web（Radiolarian 6）

项目 ID 为 `radioweb`，中英文保留原名 Radio Web。使用共享原生 PG 路径，不新建引擎，不修改 Radio Jewel 或其他既有项目。

## 结构来源与支持边界

- [Jason Smith 的原作说明（2012-10-06）](https://www.puzzleforge.com/wp/2012/10/06/radiolarian-6-radio-web-102012/)：面转二十面体，比 Cat's Cradle 深切；各角周围有十个小块，实物可 jumble。
- [Hyperspeedcube 的独立实现](https://github.com/HactarCE/Hyperspeedcube/blob/63737aa467ed8eccacafaae3eec97cf1f980b794/lua/puzzles/ft_icosahedra.lua)：`radio06` 使用 `radio7 + 0.02`，其中 `radio7 = 5 - 2 sqrt(5)`。这是明确的理想化切割比例，不是实物测量值，也不是临界深度本身。
- 内切球半径取 1，20 个单位面法向各设切平面 `n·x = d`，`d = 5 - 2 sqrt(5) + 0.02`。PG 描述为 `i f 0.5478640450004204`。
- 仅支持保形的 120° 面转、第二单层、两层宽转及整体重定向；**不支持 jumbling**。该边界同时写入 `NativePuzzleControls.tsx` 的中英文说明。
- 采用 CubeRoot 原生有界随机转动练习打乱，60 步，支持注入随机源；不是均匀随机状态，也没有虚构的 csTimer/WCA 项目键。csTimer 交换使用 `input` 并保留 `cuberootEvent` 元数据。

## 独立几何判据

实现前先对正二十面体的面作独立半空间裁切并生成平面对比图。黑色为既有 Radio Jewel 切割，绿色为 Radio Web，蓝色为冻结的原三角形边界，灰虚线为包络；这些颜色仅用于开发对比图，不进入产品主题。

每面恰有 22 个可见贴片：12 个三角形、6 个四边形、3 个五边形、1 个六边形。总计 440 个可见贴片，分属 302 个表面实体：12 个五贴片角、90 个双贴片块、200 个单贴片块。片面积之和应等于原三角形面积，细小翼块不能因去重或图标简化而消失。

不能用 Radio Jewel 的 `d = 5 - 2 sqrt(5)` 替代：它只有每面 16 片、总计 320 片、242 个表面实体。两种拼图虽然共用面轴与 120° 记号，却不共用状态模型或几何。

沿用 `native-mixed-puzzles-geometry.test.ts` 的独立面法向、半空间裁切、逐层刚体转动和方向负例；不得仅从生产注册表复制预期数量来充当几何验证。PG 的定向中心可能产生重叠的朝向副本，须区分原始贴片和 `!isDup` 的物理贴片。

## 三入口与现有契约

| 入口 | 接线 | 验收要求 |
| --- | --- | --- |
| `/sim?puzzle=radioweb`、`/zh/sim?puzzle=radioweb` | 原生注册表 → PG 目录 → 二十面体子菜单 → TwistySection | 手动外层/内层/宽转、随机打乱、时间轴、求逆、记录、URL 重载；有 WebGL 时实测拖转，无 WebGL 时只认二维证据 |
| `/timer?event=radioweb`、`/zh/timer?event=radioweb` | Timer 类型、项目目录、native-random-move 能力 → 共用 SVG | 普通/种子打乱、实际 20 面预览、来源文案、记录与导入导出保留项目 ID |
| `/scramble/gen`、`/zh/scramble/gen` | 原生打乱注册表 → 比赛/批量/输入三个模式 → 共用 SVG/PDF | 实际生成和粘贴均显示 440 片；PDF 与网页共用完整展开图及 8:5 图示比例 |

复用 `native-puzzles-client-integration`、`native-puzzle-svg`、`native-puzzle-drag`、`native-puzzle-sim-controls`、`native-puzzle-manual-anchor`、`twisty_2d_fallback`、`timer-sync-seed`、`timer_scramble_runtime`、`timer_event_catalog`、`timer_persistence`、`timer_cstimer_io`、`timer-scramble-preview-shared`、`timer-scramble-source-bar` 和 `sim-puzzle-menu` 的逐项目用例，不放宽已有断言。

结构图标由现有 `generate-puzzle-icons.mts` 从同一 PG 描述生成，再运行 `pnpm --filter @cuberoot/event-icon generate`。修改 shared 后必须重新构建 shared；安装残留或仅出现在菜单中不能替代三入口验收。

本文件规定结构与验收契约，不预先宣称任何测试、浏览器或部署已通过；具体提交的执行证据以 PR 检查、日志、截图和部署状态为准。
