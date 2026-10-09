# 八板与十二板：标准折叠路线

本文件的源码路径相对 `core/`；沿用根 `AGENTS.md` 的发布授权和最小必要验证规则。

## 先识别真实机制

- 将八板识别为 Rubik’s Magic（`magic`），将十二板识别为 Master Magic（`mmagic`），先核对图片与既有事件目录。
- 沿用既有练习方向：`Forward` / `Backward`，十二板兼容历史字符串 `M Forward` / `M Backward`；不要把方向字符串说成随机公式或伪造新的 csTimer 事件键。
- 明确标准正向目标：八板从 2×4 矩形的三个分离环折成 L 形的三个相连环；十二板从 2×6 矩形的五个相连环折成阶梯形的五个分离环。
- 先读 [Jaap 八板结构](https://www.jaapsch.net/puzzles/magic.htm)、[标准八板](https://www.jaapsch.net/puzzles/magicstd.htm) 与 [Master Magic](https://www.jaapsch.net/puzzles/magicmast.htm)；需要历史比赛语义时核对 [WCA 2010 Article G](https://regulations.worldcubeassociation.org/history/files/regulations2010.html#articleG)。
- 对照 [Paolini 数学说明](https://dmf.unicatt.it/rubiksmagic/rubiksmagic.pdf) 与真实折法核对每次铰链切换，不能把“板片仍相接”当作实际绳系可达的充分条件。

## 复用单一模型

- 使用 `@cuberoot/puzzle-solvers/magic` 的方向、步数、严格解析、状态转移和 `magicPoses`；八板与十二板的路线分别在 `magic-eight-path.ts`、`magic-twelve-path.ts`，不要在页面重新计算姿态。
- 保持固定板片 ID 和局部 `right/up/normal` 正交基，沿连续折叠移动整片刚体；在合法全叠状态切换铰链，保留相邻板的整边连接与闭环。
- 将十二板的平行四边形桥接按耦合旋转与平移计算，禁止在起止矩阵之间线性插值穿过不合法中间态。
- 将整体翻面保留为路线中的显式一步，让起止可见面与实际正反图案一致。
- 分离零厚度机械路线与渲染板厚；用 `magicLayerOffsets` 处理堆叠显示，保持连续，不能声称此显示间距已经证明有限厚度接触、绳长或张力。

## 固定双面图案与渲染

- 从 `puzzle-render-core/src/magic-artwork.ts` 读取固定在每片正反面的原创环带，复用到 `magic-svg.ts` 与 `engine/magic/MagicCube.ts`；不要到目标态才临时换图。
- 把可见环图按终态位置映回板片局部坐标，裁剪到各板边界，保持曲线与交叉的上下关系。
- 让每块实体闭合、双面墨迹朝外；将墨迹标为 `simRole='artwork'`，通过 `simCaps` 禁用会擦除图案的镂空、方形贴纸厚度、结构色、面色和核心设置。
- 同时检查直接 SVG 和 World 的真实矢量导出；图层深度低于 BSP 共面容差时会吞掉亮色或交叉覆盖，不能仅凭直接 SVG 正确就放行伴图。
- 让共享 SVG 使用实际起始方向的宽高比和容器内百分比尺寸；检查矩形、L 形、阶梯形在 Timer、生成页及 PDF 中不会溢出。

## 有界交互

- 在控件中说明这是标准路线演示：`F` 表示路线下一步，`F′` 表示沿同一路线退一步；这不是普通魔方的 F 面转记号。
- 提供方向选择、载入标准折法、前进、后退与播放；将不适用的终点锚定、反转整段 setup 和跟手停在半折等功能通过能力契约禁用。
- 始终先完整校验 setup 与解法再改盘面和队列；词法合法但越界的公式也要标红并保留上次合法状态。
- 在当前步骤手动折叠时先截断未播放的旧尾部，再追加新步；核对实时消步、延迟 URL 更新、撤销重做后文本与盘面一致。
- 使用实际板片拾取与合法下一步的投影位移选择前进或退回；没有可动候选时交回视角操作，不制造自由折叠轴。
- 在撤销、重做、重载路线或切换项目时完成当前动画并清理队列；让 World、MagicCube 和公共 `tweener` 使用同一构造器与时钟入口。

## 接入已有页面

- 在 `/sim` 注册两个引擎项目；在原生生成器目录复用既有方向格式化函数，在比赛、批量、输入模式显示练习方向说明与模拟器入口。
- 让 Timer 的单人项目继续使用原有 ID、普通/种子方向与保存格式；用共享图示取代“暂无预览”，不要无故改动项目身份或扩展对战支持范围。
- 通过 `magicSvgAspect` 和 `renderMagicSvg` 统一 Timer 与生成页；拒绝错误的 NxN 公式或八板上的 `M` 前缀，不静默画成还原态。

## 针对实际风险验收

- 根据变化选择 `packages/puzzle-solvers/tests/magic-*-path.test.ts` 的连续姿态、闭环、端态、铰链切换与堆叠连续性检查。
- 使用 `packages/client/tests/magic-controls.test.ts` 的真实 React 与公共动画时钟检查整条路线、半程位置、方向、手动分支、非法输入和忙时历史，避免只断言 busy 标记。
- 使用 `packages/client/tests/magic-svg-order.test.ts` 对照射线命中的最前墨迹与 BSP 最终颜色，并保留清零 `renderOrder` 的负例，防止共面图层回归。
- 按适用范围运行 `magic-native-scramble.test.ts`、`scramble_preview_svg.test.ts`、`timer-scramble-preview-shared.test.ts` 与公开包契约；保留 `.test.ts` 发现规则。
- 从 `core/` 运行 `node --import tsx packages/client/scripts/magic/render.mts` 生成四个练习起点与两种引擎的真实中间帧，放大核对正反、环数、交叉、板片遮挡与构图。
- 使用 `.mts` 或明确 ESM 的取证入口，避免脚本自身混用加载器；把离线帧、浏览器 UI、WebGL 拖拽及部署状态分别记录。
