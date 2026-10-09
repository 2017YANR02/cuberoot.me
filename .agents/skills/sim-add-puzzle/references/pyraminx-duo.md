# Pyraminx Duo

## 模型与来源

标准二重奏有四个定位不变、各有三种朝向的角块，以及四个单色三角中心块。绕 U/L/R/B 任一顶点转动 120° 时，转该角及其相邻三个中心；对面中心固定。普通无标记中心片的自转不计入还原目标。

- [Jaap Scherphuis 的结构、状态数及最短距离分布](https://www.jaapsch.net/puzzles/pyraduo.htm)
- [Oskar van Deventer 的设计目录](https://oskarvandeventer.nl/meffert.html)
- [Rob Stegmann 的拼图收藏与设计记录](https://www.robspuzzlepage.com/rearrangement.htm)

状态模型在 `core/packages/puzzle-solvers/src/pyraminx-duo.ts`：四个角朝向与四个中心位置，严格接受 `U L R B` 及 ASCII 撇号。裸字母从轴外侧看顺时针，几何角为 −120°。独立 Rodrigues 几何 oracle 得到 324 个状态，距离分布 `[1, 8, 48, 188, 79]`；原生打乱等概率抽取距离至少 2 的 315 个状态。该策略属于 CubeRoot，不是 WCA 或 csTimer 项目。

## 已批准的外观与有限实体

`puzzle-render-core/src/duo-face.ts` 是平面轮廓单一源：中央同向三角形边长为外三角形的 0.4，三角周围是三个凹六边形角片。0.4 是 2026-10-08 用户批准的外观参数，不是测量所得的工厂尺寸。共享 SVG、3D 和图标均沿用这一切分。

`engine/duo/duoGeometry.ts` 使用有限厚度的闭合径向壳，并为彩色贴片单独作法向挤出。角块的同一块两面保留共同外边，只有真实块间切缝做内缩；三面壳因此连通。内部核心球只用于填暗缝隙，不宣称复刻厂商内部机械结构。

以四面体顶点坐标 ±1 为单位，参数集中在 `DUO_SHELL`：body 切缝 inset 0.03、径向深度 0.01、圆角 0.02；sticker 全边 inset 0.04、圆角 0.025、法向抬升 0.001、深度 0.006。实际尺寸乘 `DUO_A`。

这里不能把“小圆角后再内缩”当成通用顺序：共享工具对 60° 尖角和凹口先圆角、再内缩时会折返自交，round 0.08 也不足以消除尖角回环。先对原始直边做平行内缩，再加小圆角，已通过轮廓简单性和实体检查。

## 可重跑的证据

从 `core/` 运行：

```bash
node --import tsx packages/client/scripts/pyraminx-duo/verify-geometry.mts
node --import tsx packages/client/scripts/pyraminx-duo/render.mts
pnpm --filter @cuberoot/puzzle-solvers exec vitest run tests/pyraminx-duo.test.ts
pnpm --filter @cuberoot/client exec vitest run tests/pyraminx-duo-engine.test.ts tests/pyraminx-duo-geometry.test.ts \
  tests/pyraminx-duo-controls.test.ts tests/pyraminx-duo-native-scramble.test.ts
```

几何脚本独立重建更大的硬边包络，再验证实际 32 个闭合网格、5,920 个三角形全部包含于其中，包括凹口边。对四轴双向每 0.5° 的完整凸多面体 SAT 分离检查，加上采样间刚体位移上界及 Float32 余量，得到连续角度的正间距；无间隙负例必须检出交叠。改动任何厚度、抬升、内缩或圆角参数后重跑该证明，不以端态截图代替中间角度检查。

`render.mts` 输出六个刚体 U 转动帧和两个示意图到 `core/.tmp/png/pyraminx-duo/`。`outline.mjs` 保留已批准的平面对比图，可重跑但不作为碰撞 oracle。

## 接线与边界

项目键统一为 `pyraminx_duo`。模拟器使用 `DuoCube` / `DuoTwister`、通用 `CornerTurnGesture` 和 `CORNER_SPECS`；拾取中心时用其当前面寻找三个可转角，不用 home face。还原判定看离散颜色，不比较未标记中心的最终 quaternion。

严格分类器同时保护 setup 和 alg。非法输入保持上次合法盘面并标红；打乱播放和跳步也检查 validity。撤销/重做必须先结束当前动画，再读写 history，避免未入栈的当前招式在重放时插回。

生成页有三个用户模式：比赛用 `TNoodleMode`，批量与输入分别用 `QuickMode(subMode="batch"|"paste")`，没有独立的 `InputMode.tsx`。两个生成入口通过 `core/packages/client/lib/native-scramble.ts` 调用同一个生成器；输入模式复用项目目录与图示渲染，验收时也要选择 Duo 并粘贴合法公式。

Timer 的普通和种子路径也复用该生成器；项目语义在 `shared/src/timer/types.ts` 属于 `nonwca`，picker 在 `event-catalog.ts` 属于 `other` 并显示 `textLabel: 'Duo'`，两种分组不要混用。运行能力登记为 `kind: 'shared'`、`provider: 'small-puzzle-random-state'`，不依赖 csTimer key。

Web/PDF/Timer 用共享 `pyraminx-duo-svg`，二维图示不依赖 WebGL；其正常显示不代表浏览器中的 3D 拖拽与动画已经通过。csTimer 没有对应 scrambler，导出使用真实的 `input` 类型并携带 `cuberootEvent`，导入凭元数据恢复，不依赖用户可改的组名。

跨页面路径、公开出口/架构契约与预览验收遵循 [通用接入清单](integration-and-verification.md)，按当前代码核验，不把本次验证状态固化成未来任务的通过记录。
