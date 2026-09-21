# Ghost Cube 原作者几何复原

状态：用户已批准 source-based SVG；已接入 `/sim?puzzle=ghost`，完成本地几何、转动、拖拽、播放与窄屏验证。尚未推送或部署。

## 来源与边界

- [Adam Cowan 原作者主题](https://twistypuzzles.com/forum/viewtopic.php?f=15&t=12042) 中 2009-03-06 的 `3x3x3 Ghost Cube v2.PDF`：[附件 id=9936](https://twistypuzzles.com/forum/download/file.php?id=9936)。
- PDF SHA256：`c70cdc32c4663a9b31983c1c9a7ac3d6e463ba3a037a05d0e77ec702e2109a32`；SolidWorks2009SP2.1，文件创建日期 2009-03-06。
- U3D 解码使用独立下载的 [svhss/u3d-mesh-extract](https://github.com/svhss/u3d-mesh-extract)，固定 commit `71c5f4428ae3bcff9c2521c4e00dd938a703a648`；脚本 SHA256 `d2a42da14e1bb6933f976c863f6b0c83fc08a7b2143eb33a62d33ef055ec6289`。
- 解码器及其 NOTICE 仅存 `.tmp/png/` 作本地研究工具，不纳入产品，也不假定原 PDF 或解码器具备再分发许可；原文件与贴纸网格不进入生产资产。
- [TORIBO 量产款贴纸图](https://store.tribox.com/products/detail.php?product_id=1713) 仅作外观参考；页面明确有型号省略微小贴纸。未证明它与本次原作者几何逐点一致。
- 源文件实际只有 **55 块薄贴纸实体**，327 个网格、508 个场景节点、648 个三角形；不是完整块身或内部机构 CAD。
- 下述 mm 是源坐标按 U3D 单位换算的模型尺度；58 mm 是反推的理想外壳边长，不是任何量产型号的实测尺寸。

## 直接证据与推导

直接解码得到每个顶点、面、装配变换；本文件全部装配变换为恒等，无 progressive mesh，327 个资源全部放置。
每个贴纸底面位于外壳坐标 `±30 mm`，顶面 `±30.1 mm`，厚度 `0.1 mm`；面内外边界为 `±28.5 mm`。
原始贴纸 143 条内部边、74 条外壳边共同约束以下模型；没有拿照片像素反推数值。

以原始装配坐标 p 为基准，外壳坐标为 `q = Bᵀp`；B 的三列是外壳正交轴：

```text
B = [ 0.7986354924797165  -0.3804722704578621   0.4662855365163283
      0.6018150464650089   0.5049037236837130  -0.6187817706256710
      0.0000000015009331   0.7747987359456397   0.6322079711432301 ]
```

先由所有面法线加权恢复 B，再用极分解消除 float32 舍入形成的微小非正交；不把未知外壳倾角强行取整。

理想外壳：`|q₀|, |q₁|, |q₂| ≤ 29`。
层切平面：源坐标 `p_y = ±9.5`。
各层内两组正交切平面：

```text
n_x = (cos θ, 0, sin θ)
n_z = (−sin θ, 0, cos θ)
n_x · p = ±9.5
n_z · p = ±9.5

源 −Y 层：θ = 87°
源中层： θ = 52°
源 +Y 层：θ = 23°
```

θ 是 XZ 平面中法线方位角；从边方向实际恢复六组 `23,52,87,113,142,177°`，与整数度差最大约 `0.0000022°`。
先扣除贴纸外移量，再按源 Y 坐标分类，独立确定每层对应的 θ；并非手写层角后只看是否像。
选择 θ 在 `[0°,90°)` 的等价轴标记，相对中层绕 **源 +Y 右手旋转**为 `−35°,0°, +29°`。
此处转轴不等于图中外壳 U/D 面法线，SVG 的 F/R/U/B/L/D 仅表示从各外壳面向外观看。

反推贴纸构造（只为重现原 PDF，不是生产显示设置）：

1. 取理想外壳与分片切割半空间交集；内部切面向单元内移 `1 mm`。
2. 在理想外壳表面截取多边形，再沿面内所有边向内缩 `0.5 mm`。
3. 整张贴纸沿面法线向外移 `1 mm`，并挤出 `0.1 mm` 厚度。

拟合未知数 `[半切深, 外移量, 切面内缩, 面内内缩]` 的非约束解为：
`[9.4999999528, 1.0000000564, 0.9999996527, 0.5000002955] mm`，秩 4、条件数约 14.86。
采用半毫米网格上的简洁参数 `[9.5,1,1,0.5]` 后仍吻合全部源顶点；模型假设包括对称切深、统一内缩、外移量和按层正交平面，并不声称是唯一可能的内部机械构造。

## 已完成的核对

- 27 个非空凸几何单元，26 个有外表面，内部单元 `[0,0,0]`；“内部单元”不是对真实核心机构的恢复。
- 理想分片总表面积逐面 `58² = 3364 mm²`，总体积 `58³ = 195112 mm³`；共有 59 个外表面分片，其中 4 个微小分片内缩后无贴纸。
- 与全部 55 块源贴纸一一对应，逐块顶点数相同，最大顶点集合双向距离 `0.000003526703 mm`；不是只抽查图片或面积。
- 最大内部边方程残差 `0.000001671725 mm`；所有这些误差仅说明数字模型吻合程度，不能当作实物加工公差。
- 独立 JavaScript 校验不调用 Python 推导函数：从原始网格按平面距离找贴纸底面，用两直线交点法重建贴纸，对比所有原顶点；用仓库 `polytopeVerts` + Three.js 凸包重算全部单元。
- JS 凸包体积为 `195112.004927736 mm³`，与精确值差 `0.00493 mm³` 来自 Three.js float32 位置属性；Python 双精度总体积为 `195111.99999999988 mm³`。
- 生产 `ghostModel.ts` 的全部 55 张未倒圆贴纸轮廓也与原始网格逐点核对，最大顶点集合双向距离 `0.000003526703 mm`；生产渲染额外的小圆角不属于源 CAD 精度声明。
- 源点精度、外观图与机械完整性是不同验收：内部卡脚/轴心、实物间隙、真实倒角和量产款一致性均未验证；以下动态验证只针对本模拟器的重建实体。

## 模拟器实现与验收边界

- 几何/状态/转动位于 `core/packages/puzzle-render-core/src/engine/ghost/`，站点拖拽与控制接入既有 `/sim`，不加载原 PDF、解码器或原始贴纸网格。
- 用中层 θ=52° 的正交轴作为机制坐标，显示四元数将还原外壳摆正；转动字母指内部转轴，不指斜外壳面的法线。还原态先顺时针 `U29° D35°` 对齐六组层切面。
- 支持面转、宽转、M/E/S 和 x/y/z；外层额外接受整数度数（1–359°，例如 `U29°`、`D35°'`）。这是模拟器扩展记号，不宣称为官方记号；cstimer 没有可复用的 Ghost 项目。
- 所有整块顶点都必须落在转层内或外；切面跨块时拒绝转动。输入/队列先完整验证再应用，非法序列不改变原状态、历史或待播队列。
- 实体由原始切平面围成，采用 `0.08 mm` 显示间隙和 `0.18 mm` 块身倒圆；贴纸厚 `0.1 mm`、抬升 `0.015 mm`，圆角半径为 `min(0.12 mm, 最短边/6)`。这些是显示参数，不是实物测量。
- `tests/ghost_cube.test.ts` 独立重导 55 张贴纸，锁定 27 单元/59 外表面/55 贴纸、体积、法向、厚度、每角最大转角小于 50°、有符号偏转、120 步往返、队列事务性、半转恢复与材质释放。
- 对 17 组转动（两组初始对齐、六面、三中层、六宽转）逐一检查 0/20/50/80/100% 帧：每个块身与贴纸的全部渲染顶点始终位于对应隔离切面的正确一侧。这证明这些重建实体的动静组分离，不替代真实机械碰撞测试。
- 无头浏览器实测：还原外观、5 张以上中间帧及放大边缘、随机打乱终态、主图/示意伴图/背面小窗同步、非法输入阻止播放、半转停住后再拖拽/播放、对齐与逆序还原、390 px 窄屏 CDP 触摸拖拽与无横向溢出。
- 已接入适用的原核、结构着色、镂空、立体贴片、提示贴片和挖面设置；无需新建设置 UI。随机打乱采用对齐步骤加现有三阶随机公式，不是均匀随机状态；未新增求解器。

## 复现

在仓库根用 pwsh 下载研究输入到 `.tmp/png/`，不改产品：

```powershell
New-Item -ItemType Directory -Force .tmp/png | Out-Null
Invoke-WebRequest 'https://twistypuzzles.com/forum/download/file.php?id=9936' -OutFile .tmp/png/ghost-adam-cowan-original.pdf
Invoke-WebRequest 'https://raw.githubusercontent.com/svhss/u3d-mesh-extract/71c5f4428ae3bcff9c2521c4e00dd938a703a648/scripts/u3d2mesh.py' -OutFile .tmp/png/ghost-u3d2mesh.py
Invoke-WebRequest 'https://raw.githubusercontent.com/svhss/u3d-mesh-extract/71c5f4428ae3bcff9c2521c4e00dd938a703a648/NOTICE' -OutFile .tmp/png/ghost-u3d2mesh-NOTICE.txt
uv run --with pypdf python core/packages/client/scripts/ghost/extract-reference.py
uv run --with numpy --with scipy python core/packages/client/scripts/ghost/analyze-reference.py
Set-Location core
pnpm --filter @cuberoot/client exec tsx scripts/ghost/verify-reference.mjs
pnpm --filter @cuberoot/client exec tsx scripts/ghost/render-reference.mjs
```

解码入口先校验固定 PDF/脚本摘要，不静默接受不同版本；Python BLAS 并行限制 14 线程。

审核产物均在根 `.tmp/png/`：

- `ghost-original-geometry-review.svg/.png`：绿色理想切线、蓝色冻结外壳、黑色现有镜面对比、灰虚线源贴纸 `±30.1 mm` 空间包络投影。
- `ghost-original-overlay.svg/.png`：55 块源贴纸黑粗线与解析重建绿细线叠合，全部从各面外侧观看。
- `ghost-original-detail.svg/.png`：最小原贴纸 body 12 放大核对。
- `ghost-original-analysis.json`：参数、全部分片顶点、贴纸对应、残差与覆盖核对。
- `geometry-review.mjs` 为已废弃的早期猜测稿，仅保留研究记录；其输出改为 `ghost-approximate-review.*`，不得用于引擎。

生产几何核对及回归命令（在 `core/`）：

```powershell
pnpm --filter @cuberoot/client exec tsx scripts/ghost/verify-reference.mjs
pnpm --filter @cuberoot/client exec vitest run tests/ghost_cube.test.ts --maxWorkers=4
pnpm --filter @cuberoot/client typecheck
pnpm --filter @cuberoot/puzzle-render-core typecheck
```

`preview.mjs` 是独立几何验收服务器（localhost:3036），`icon.mjs` 从同源几何生成正 Z 面图标；运行验证截图存于 `core/.tmp/png/ghost-*.png`，不进入生产资产。
