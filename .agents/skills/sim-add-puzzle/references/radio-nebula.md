# Radio Nebula（Radiolarian 12）

## 来源与模型

- 将 `radionebula` 注册为 Jason Smith 的 Radio Nebula（Radiolarian 12），中英文菜单沿用原名；核对[作者原作说明与实物照片](https://www.puzzleforge.com/wp/2013/03/07/radiolarian-12-the-radio-nebula-32013/)及 [Hyperspeedcube 的 `radio12` 实现](https://github.com/HactarCE/Hyperspeedcube/blob/main/lua/puzzles/ft_icosahedra.lua)。
- 以内切球半径 1 使用 `h = 1/φ⁴ = (7−3√5)/2`，其中 `φ = (1+√5)/2`，描述为 `i f 0.1458980337503154`；只加入这一族二十个对称平面切面，不把相邻 Radiolarian 的比较切面叠加进去。
- 保留原作的小五色角及其周围星形分区；将作者提到的意外原地扭角视为实体机械错位，不额外提供不属于保形面转模型的角尖动作。
- 区分 Radio Nebula 与双切层的 Eitan’s Nebula；名称、切深、图标与状态均按本项目核对。将采用的切深表述为开源模拟器的理想化平面模型，不称为量产品尺寸测量值。
- 仅支持标准保形 120° 面转，不包含 jumbling；复用原生 `A / 2A / Aw / Av` 记号和全部二十个面向。

## 先核对轮廓

在 `core/` 构建 puzzle-solvers 后运行：

```bash
node packages/client/scripts/native-puzzles/compare-outlines.mjs --set=radionebula
```

核对 `core/.tmp/png/radionebula-outlines-radionebula.svg` 的单面放大图与完整展开图；黑色 Radio Crystal 切线仅作比较，绿色为本项目切线，蓝色外轮廓保持不变。放大小角和星臂，逐片对照原作照片。

| 核对项 | 精确结果 |
| --- | --- |
| 面数 | 20 |
| 每面分区 | 18 个三角形、3 个四边形、3 个五边形、4 个六边形，共 28 区 |
| 可见贴片 | 560 |
| 开启中心朝向后的原始 PG 条目 | 600；排除 40 个重复朝向轮廓后为 560 |
| 可见块 | 362：12 个五贴片角块、150 个双贴片棱块、200 个单贴片中心块 |
| 可见块轨道大小 | 12、60、30、60、60、60、60、20 |
| 外层单步改变位置的块数 | 153；不计只在原位置改变朝向的块 |

保留 `C5RNER` 的五重朝向，以及 `CENTERS4` 为状态计算保留的三重朝向；去重输出 SVG 的重合几何时仍保存完整颜色查找，不把重复朝向解释成额外实体块。

## 接线与验证

- 在 `NATIVE_PUZZLES` 复用二十面体面轴、两种独立层深、60 步随机转动与 `8/5` 展开图比例；普通和种子打乱共用生成器，明确是练习用随机转动，不声称均匀随机状态。
- 按[三入口接入清单](integration-and-verification.md)同步模拟器分类、双语记号说明、Timer provider、独立记录及 csTimer `input + cuberootEvent`；识别完整 `Radio Nebula`、`Radiolarian 12` 名称，拒绝 `Radiolarian120`、`Radiolarian12.5` 和 `Radio Nebulaic` 等相近名称。
- 从相同 PG 描述生成 `puzzle-radionebula` 原创图标，运行 `generate-puzzle-icons.mts --only radionebula` 和 event-icon 的 `generate`，核对图标库、三入口菜单及小尺寸显示。
- 在 `native-mixed-puzzles-geometry.test.ts` 用正二十面体顶点、单位面法向和独立半空间分割重导每面分区、可见块和置换轨道；将所有层的正反 120° 转动、交错转动、转体和五个中间进度与真实 PG 状态及 PG3D 矩阵对账。
- 以 `1/φ³` 的 Radio Star 为负例，确认其 380 片不是本项目的 560 片；核对 `h ± 0.0001` 均保留 28 区，避免把本切深误写成贴片消失临界点。
- 复用原生拖转、SVG、手动记录、二维回退及三入口契约，实际在浏览器检查三维贴片拖转、空白旋转、随机打乱终态、动画中间帧、回放和分享；独立记录二维回退按钮、播放与分享恢复，不能以它替代三维验收。
