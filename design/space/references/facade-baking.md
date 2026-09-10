# 外滩立面照明烘焙实验

日期：2026-09-10。状态：单平面数值与 EXR 方向校准通过；汇丰独栋完成 2K / 4K 同机位比较，4K 明显改善柱身长黑线，柱头细缝、暗部噪点和阴影边缘仍未通过近景验收，尚未接入正式城市。

## 问题与实验范围

网页近景使用六盏聚光灯，远景使用材质中的程序补光。两者的配光不同，镜头转向邻栋时即使渐变换灯，建筑仍会明显改变亮度。已有渐变提交 `944045873a` 只处理换灯过程，没有解决这项视觉差异。

`scripts/probe_facade_bake.py` 从当前 `scenes/shanghai.blend` 复制一栋建筑及已编辑的原生灯具到独立场景，试验 Cycles 漫反射直接光和间接光烘焙。原有材质 UV 保留，新增 `LightUV`，产出 EXR、双 UV 的独栋 GLB 和独立候选 `.blend`；不保存城市源工程，不修改网页资源。汇丰、江海关、和平饭店分别使用楼号 `12 / 13 / 20`。

这是照明技术实验，不能替代实拍对照、建筑精修或正式导出流程。当前六盏灯是视觉代理，功率与现场光度没有标定；实验只包含本栋遮挡，未纳入相邻建筑，漫反射贴图也不包含金属穹顶的视角相关反射。样本合并了对象，仅用于单栋研究，不能直接替换包含稳定对象标识的正式城市资产。

## 执行与产物

在仓库根使用已安装的 Blender 后台执行，最多 14 线程，以隐藏窗口和 BelowNormal 优先级启动：

```powershell
$probeLabel = 'hsbc-next'
$probeLogRoot = Join-Path (Get-Location) '.tmp/png/space-light-bake'
New-Item -ItemType Directory -Force -Path $probeLogRoot | Out-Null
$probeProcess = Start-Process -FilePath 'E:/Apps/Blender/blender.exe' -ArgumentList @(
  '--background', '--disable-autoexec', 'D:/cube/cuberoot.me/design/space/scenes/shanghai.blend',
  '--threads', '14', '--python-exit-code', '1',
  '--python', 'D:/cube/cuberoot.me/design/space/scripts/probe_facade_bake.py',
  '--', '--building', '12', '--size', '2048', '--samples', '128', '--label', $probeLabel
) -WindowStyle Hidden -PassThru -RedirectStandardOutput "$probeLogRoot/$probeLabel.log" -RedirectStandardError "$probeLogRoot/$probeLabel-error.log"
$probeProcess.PriorityClass = 'BelowNormal'
```

标签须唯一；已有目录会拒绝覆盖。产物全部位于 `.tmp/png/space-light-bake/<label>/`：`started.json` 只代表前置检查完成；只有 `report.json` 才代表烘焙、导出及源文件未变检查全部执行完毕。还须查看进程退出码和日志，文件存在不等于视觉验收通过。

脚本检查建筑和六盏灯完整、有限正功率、支持的材质与 UV 范围、合并前后面数、原 UV 哈希不变、光照 UV 有限且在图集内、烘焙像素非空且有限、源工程大小与修改时间不变。展开只在临时焊接副本进行，按原始面角 ID 回传 UV；原接收网格的位置、多边形角和三角化哈希必须保持。报告另记小于一像素的三角面数量、其实际表面积占比和图集三角面积总和；后者不是去重覆盖率，不能证明没有重叠。尚未运行的检查不能记为通过。

微小校准使用同一脚本：将上述 Blender 参数中的工程路径替换为 `--factory-startup`、线程设为 `2`，脚本参数用 `-- --calibrate --label calibration-next`。只生成 64×64 单平面，8 samples；打开了任何工程时拒绝执行。两组 UV 特意左右镜像，另输出上下颜色不同的 `orientation.exr`，分别检测 UV 通道与垂直方向。默认工厂场景仍存在，因此两个导出分支均限定 `use_active_scene=True`，防止其他场景的已选对象混入 GLB。

## 2026-09-10 执行记录

- Python AST 语法检查通过，删除了未使用的导入。
- 本次后台 Blender 从 08:42 启动，到 09:31 仍未进入检查脚本，累计 CPU 时间约 2.66 秒；没有 `started.json`、EXR 或样本 GLB。已核对命令行后停止本任务进程，保留日志，不能声称完成烘焙（时间为本机 America/Los_Angeles）。
- 同时测得系统 CPU 100%，内存剩余约 1.7–2.6 GB，后台 Blender 约 0.3 GB；负载涉及浏览器、编译和内存压缩。没有停止或改动这些其他进程。
- 已释放本任务两个无头页面的城市场景。浏览器曾确认 WebGL2 使用 RTX 3080 Laptop GPU 的 ANGLE Direct3D11，不能把低帧率归因于软件渲染。
- 本地网页在加载及重新加载之间变化，曾返回 500；拿到的 renderer 统计仍处于加载阶段，不是城市稳定渲染的帧率或绘制调用证据，500 根因未定位。
- 第二次复核改用 `--factory-startup --disable-autoexec --threads 2`，完全不读取上海工程，目标仅为单平面、64×64、8 samples 的漫反射校准。09:54:09 启动，10:00:13 仍未执行 Python 的首个状态写入；累计 CPU 2.265625 秒、工作集 148,905,984 字节，标准输出和错误日志均为空。已核对命令行后停止该样本，证据为 `.tmp/png/space-light-bake/calibration-01-process.json`，不是烘焙成功报告。
- 此次系统 CPU 仍为 100%，可用内存已回升到约 5.5 GB；进程主线程采样为 Ready。仅对这个微小样本作了 12 秒普通优先级诊断，随后恢复 BelowNormal，仍未进入脚本。结果说明当前停滞也发生在空白启动，不能归因于上海几何规模或烘焙参数；线程调度受限是线索，具体系统原因尚未定位。没有调整其他进程。
- 本机 Three.js 0.183.2 的 `lights_fragment_maps.glsl.js` 将 `lightMapTexel.rgb * lightMapIntensity` 加入 irradiance，再由材质应用 Lambert 项；没有在这里自动乘 π。此前缺少 Cycles 数值，下面的微小样本现已补齐线性漫反射校准。

### 微小校准通过

- `calibration-04/report.json`：Blender 5.2.1 LTS、CPU 2 线程、8 samples，世界辐亮度为 1、Diffuse 颜色为 0.5，烘焙 Direct + Indirect 且排除 Color。64×64 全部 RGB 像素为有限值 1，原材质 UV 哈希未变，生成耗时约 1.08 秒，日志正常退出。
- 实际 GLB 只有一个平面，包含两组不同的 UV。前一个样本 `calibration-03` 意外带入另一场景的默认立方体；限定当前场景后重导出并在浏览器确认一个网格。
- `calibration-04/runtime.json`：真实无头 WebGL、Three.js revision 183、Float 渲染目标、Linear-sRGB、无色调映射、无其他光源。加载实际 EXR 后，`lightMapIntensity = π` 得到 RGB `0.5`；强度为 1 的对照为 `0.1591549367`，与 `0.5 / π` 相符。
- 实际 GLB 的 UV1 通过红蓝测试纹理检验：`texture.channel = 1` 和 `0` 时左右像素互换，确认网页使用了第二组坐标。**纠正前轮结论：常量 EXR 不能验证上下方向，不能据此认定 `flipY = false` 正确。**
- `calibration-05` 通过同一 Blender 保存路径新增四象限不对称 EXR，在实际导出 GLB 的 UV1 上读取四个像素。当前 Three.js `EXRLoader` 链路必须使用 `flipY = true`；正确结果依次为绿、红、黄、蓝，故意设为 false 的对照为黄、蓝、绿、红。数值校准仍为 `0.5` 与 `0.1591549367`。证据 `calibration-05/runtime.json`，临时复现脚本为 `.tmp/png/space-light-bake/runtime-calibration.js`；这条设置限于已测的 EXR 链路，不推广到所有图片格式。
- 这只证明该烘焙设置下的 **Lambert 线性漫反射换算**，不代表 Principled/PBR 的 Fresnel、金属、玻璃、环境反射、实际照度或整栋夜景通过；不能对整个城市盲目乘 π。
- 已实际读取汇丰源工程：18 个网格、81,863 个面，均有一组材质 UV。单栋初跑检出了编辑模式后旧 UV 引用失效，以及默认 World 节点名称受界面语言影响；现重新按层名取得 UV、按节点类型找到 Background。失败日志保留于 `hsbc-02`、`hsbc-03`，没有保存覆盖源工程。

### 独栋图集修复及 2K / 4K 审图

`hsbc-04` 首次完成烘焙，但浏览器几乎全黑。实测光照 UV 三角面积总和仅约 0.025%；导入网格的大量面角没有连接，直接 Smart Project 把图集空间消耗在碎片间距上。坐标落在 0–1 范围内并不代表具有足够的贴图密度。

现在只焊接临时 UV 副本，保留所有源网格面角 ID 后回传展开结果；130 个焊接可能丢失角的重合/退化面单独保护。源网格 265,878 个顶点、292,791 个面角保持，代理为 76,343 个顶点。`hsbc-06` 与旧样本的 18 组 GLB 图元位置、法线、材质 UV 和材质分配均保持；一组存在等值重复顶点的索引重排，按三角面逐角比较位置、法线和 UV 后一致，不能用原始索引字节相同描述这项结果。证据 `hsbc-06/geometry-comparison.json`。

| 样本 | 参数与耗时 | 图集和审图结果 |
| --- | --- | --- |
| `hsbc-05` | 2048²、16 samples、57.02 秒 | 三角面积总和 28.95%；小于一像素的面占实际表面积 1.40%。修正 EXR 上下方向后，柱廊、穹顶与檐口的投光位置和原生灯光对齐，但仍有明显采样噪声 |
| `hsbc-06` | 2048²、128 samples、149.53 秒 | 复用同一展开，噪声减少；正面、斜侧和近景均已查看，近景柱槽仍有竖向黑线、檐口阴影边缘块状化，未通过近景验收 |
| `hsbc-07` | 4096²、128 samples、700.89 秒 | 三角面积总和 38.94%；小于一像素的面占实际表面积降至 0.344%。三个同机位均已查看，柱身长黑线明显减少，柱头仍有细黑线、暗部有噪点、部分阴影边缘仍生硬 |

4K 的 EXR 为 16,985,507 字节，2K 为 5,396,205 字节；独栋 GLB 均为 13,257,328 字节。这是更高密度带来的实测效果与代价，不是通过增加采样数消除接缝。4K 的源网格几何/三角化哈希、原材质 UV、源文件大小和修改时间均保持；实际 GLB 的 18 组图元再次通过逐三角面角属性比较，证据 `hsbc-07/geometry-comparison.json`。日志正常结束于 `Blender quit`，报告与浏览器结果分别在 `hsbc-07/report.json`、`hsbc-07/runtime.json`。

所有样本只在临时目录。浏览器使用真实 WebGL、同一 GLB 和 EXR，黑背景、无环境光、固定诊断曝光 +8 stops；正面另有本栋原生灯光的 Cycles 渲染对照。可查看 [2K 近景](../../../.tmp/png/space-light-bake/hsbc-06/web-close.png)、[4K 近景](../../../.tmp/png/space-light-bake/hsbc-07/web-close.png)、[4K 正面](../../../.tmp/png/space-light-bake/hsbc-07/web-front.png)及[4K 斜侧](../../../.tmp/png/space-light-bake/hsbc-07/web-oblique.png)。这些图用来定位光影映射与密度，不能代表正式网页夜景，也没有完成金属和玻璃反射一致性。

## 下一轮验收

1. 定位 4K 剩余的柱头细缝和阴影边缘，检查 UV 间距与烘焙扩边的关系，比较原生渲染后再选择局部重展或调整边距；不直接继续扩大整张贴图。
2. 对照本栋原生灯光渲染，复核柱廊、檐口、鼓座的阴影与接缝；在真实建筑 PBR 材质中检查漫反射换算的适用范围。
3. 补金属、玻璃和环境反射的多视角检查；出现漏光、黑块或明显接缝则修改并重烘焙。
4. 效果通过后再设计保留稳定 ID、日夜强度控制及资产加载的正式接入，移除被替代的补光，避免重复照明；随后测量真实场景耗时与显存。

## 技术来源

- [Blender 5.2 Cycles Render Baking](https://docs.blender.org/manual/en/latest/render/cycles/baking.html)：烘焙需要 UV 和目标图像节点；Diffuse 的 Color 与 Direct/Indirect 可分别控制。本次通过官方检索摘要核对，网页正文请求未成功。
- [Three.js MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html)：`lightMap` 使用额外 UV，描述预先计算的照明；PBR 反射仍依赖环境光照。已读取官方页面，实际导出和强度换算仍须样本验证。
- 本机 Blender `io_scene_gltf2/blender/exp/primitive_extract.py` 在启用 `gltf_texcoords` 时枚举网格 UV 层；这里只能证明导出实现支持多层 UV，不能替代对实际 GLB 的检查。

没有引入第三方天气或照明库。本实验脚本为仓库自写，使用已安装的 Blender/Cycles 与 Three.js；建筑照片来源继续使用各栋既有参考档案。
