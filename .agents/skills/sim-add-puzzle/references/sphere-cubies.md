# 球块三阶

`sphere` 按用户指定外观，把普通三阶的 8 角、12 棱、6 中心分别做成完整球体；26 个可见块仍占三阶晶格，不是把整个外轮廓做成一个大球。

## 复用边界

- 使用共享 `engine/nxn/cube.ts` 的 `new Cube(3, 'sphere')`，保留 Cubelet、GroupTable、Twister、History、状态序列化与三阶打乱；不要复制引擎或增加同规则求解器。
- 保留 `new Cube(order, true)` 的镜面兼容参数；通过 `isSphere` 只改变外观与拾取。
- 在 `engine/world.ts` 单独缓存球块实例并在 Web cleanup 调用 `disposeSphereCube()`；不与普通三阶共享可变盘面。
- 在 `SimPage` 渲染阶段和 `applyPuzzle` 都固定逻辑阶数 3，覆盖从二阶切入时的首帧；群论复用 `nxnPgBridge(3)` 和已有 facts，复盘映射 `3x3`。
- `World` 对象不变时，`setPuzzle()` 仍会换掉内部 cube；父页面完成切换和设置后发布 `activeCube` 身份，播放器核对身份与 `puzzleKind` 后重放当前 setup 和步骤。不能只给子组件 effect 加 URL 依赖：子 effect 可能先于父切换运行。切换同时停旧播放、失效旧请求，在异步 setup 返回后再次核对请求和 cube 身份，并在重放完成前阻止播放和步进；Node 同步 fallback 不能代替 deferred setup 回归。
- 仅请求模拟器时不创建独立 Timer 或打乱页事件；其规则与普通三阶一致。

## 球面与颜色

- 使用 `Cubelet._SPHERE` 的完整 `SphereGeometry`，晶格间距 `SIZE=64`，半径 `SPHERE_RADIUS=30`；保留实例的刚体矩阵，不以贴纸厚度缩放球身。
- 统一通过 `InstancedRenderer.frameGeometry` 选择普通、镜面或球体基底，构造和 `setRawCore` 的克隆/恢复路径必须取同一形状。
- 复用 `rawCore.ts` 的 `argmax(localPosition · homeFaceNormal)` 分色：中心单色、棱双色、角三色；颜色属性在 cubie 本地空间，随实例矩阵刚性转动。
- 保留 54 个逻辑贴纸槽用于状态和配色，但隐藏 `staticSticker`/`movingSticker`，禁用内填充盒与中层 `panel`，不要让方形零件穿出球面。
- 将不适用的厚贴纸、提示贴片、镂空、结构着色、内核色、黑边、Logo、箭头、图案、房间、手部与阶段遮罩集中关在 `simCaps`；在 `applySettings` 同时过滤共用存储的旧值。
- 在引擎层继续强制球体 `rawCore=true`、`border=false`、`arrow=false` 与无平面 Logo；单色中心的不可见自转不能参与 `complete`。

## 间距依据

同一转层内，球心间距由刚体旋转保持；不同转层沿转轴至少相隔一个晶格间距，任意转角的欧氏距离都不小于 64。因此 `2r=60 < 64` 给出全程至少 4 的实体间隙，同轴不同层并发也成立。沿用 NxN 的互异轴锁，不改其并发契约。

- 从真实 static/moving 实例矩阵读球心，检查打乱态、三个轴、全部中层与正反转中间帧仍满足此界；用超出半晶格的半径作为负例检查。
- 改半径或非均匀缩放时重新建立间距证明，不能直接沿用当前界。

## 拾取与矢量导出

- 使用 `Controller.hitTest` 的球体分支求最近真实球面交点，从实例身份取当前 cubie 索引；射线未中任何球时才进入空白拖动。
- 仅把球面命中法线量化到最近逻辑主面，再复用 NxN 的跟手匹配；不要把连续曲面法线直接交给要求轴对齐平面的 `match()`。
- 用独立 Three.js 三角射线拾取核对斜视角、打乱与半转时的实体身份；程序调用验证不能写成浏览器拖动已验收。
- 将伴图与截图接到支持 `aRawN*`/`aRawC*` 的 `sim_svg_export.ts`，禁止回退普通方体 schematic/spec 或不支持 shader 分色的 BSP。
- 为完整、等半径、互不相交且仅刚体变换的球实例标记 `userData.simSphereCubie=true`；导出器对这类球跳过平面簇，按相机到球心的距离保留整球绘制顺序，避免后球碎三角盖到前球。
- 仅在上述等半径分离条件成立时沿用整球排序；不要把这个标签用于任意曲面、交叠球或非均匀缩放。
- 把 raw 颜色属性版本纳入场景签名，修改六面色后重新导出伴图。

## 复现与回归

- 在 `core/` 运行 `node --import tsx packages/client/scripts/sphere/render.mts`，生成真实引擎的还原态、打乱态与五个 R 转层进度的 SVG/PNG，输出到 `.tmp/png/sphere/`。
- 使用 `tests/sphere_cube.test.ts` 验证球面尺寸、颜色数、设置残值、实际实例间距、普通三阶状态等价和拾取。
- 使用 `tests/sphere_svg.test.ts` 核对真实导出图的遮挡与配色，用 `tests/sim_puzzle_membership.test.ts` 维护项目目录与能力边界。
- 分别报告本地几何、矢量图和实际浏览器 WebGL/拖拽的验证结果；环境无法创建 WebGL 时不以离线图片替代浏览器验收。
