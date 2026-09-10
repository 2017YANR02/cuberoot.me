# 外滩立面照明烘焙实验

日期：2026-09-10。状态：脚本语法检查通过；尚未生成或验收烘焙图，未接入网页。

## 问题与实验范围

网页近景使用六盏聚光灯，远景使用材质中的程序补光。两者的配光不同，镜头转向邻栋时即使渐变换灯，建筑仍会明显改变亮度。已有渐变提交 `944045873a` 只处理换灯过程，没有解决这项视觉差异。

`scripts/probe_facade_bake.py` 从当前 `scenes/shanghai.blend` 复制一栋建筑及已编辑的原生灯具到独立场景，试验 Cycles 漫反射直接光和间接光烘焙。原有材质 UV 保留，新增 `LightUV`，产出 EXR、双 UV 的独栋 GLB 和独立候选 `.blend`；不保存城市源工程，不修改网页资源。汇丰、江海关、和平饭店分别使用楼号 `12 / 13 / 20`。

这是照明技术实验，不能替代实拍对照、建筑精修或正式导出流程。当前六盏灯是视觉代理，功率与现场光度没有标定；实验只包含本栋遮挡，未纳入相邻建筑，漫反射贴图也不包含金属穹顶的视角相关反射。样本合并了对象，仅用于单栋研究，不能直接替换包含稳定对象标识的正式城市资产。

## 执行与产物

在仓库根使用已安装的 Blender 后台执行，最多 14 线程，以隐藏窗口和 BelowNormal 优先级启动：

```powershell
$probeLabel = 'hsbc-02'
$probeLogRoot = Join-Path (Get-Location) '.tmp/png/space-light-bake'
New-Item -ItemType Directory -Force -Path $probeLogRoot | Out-Null
$probeProcess = Start-Process -FilePath 'E:/Apps/Blender/blender.exe' -ArgumentList @(
  '--background', 'D:/cube/cuberoot.me/design/space/scenes/shanghai.blend',
  '--threads', '14', '--python-exit-code', '1',
  '--python', 'D:/cube/cuberoot.me/design/space/scripts/probe_facade_bake.py',
  '--', '--building', '12', '--size', '1024', '--samples', '16', '--label', $probeLabel
) -WindowStyle Hidden -PassThru -RedirectStandardOutput "$probeLogRoot/$probeLabel.log" -RedirectStandardError "$probeLogRoot/$probeLabel-error.log"
$probeProcess.PriorityClass = 'BelowNormal'
```

标签须唯一；已有目录会拒绝覆盖。产物全部位于 `.tmp/png/space-light-bake/<label>/`：`started.json` 只代表前置检查完成；只有 `report.json` 才代表烘焙、导出及源文件未变检查全部执行完毕。还须查看进程退出码和日志，文件存在不等于视觉验收通过。

脚本检查建筑和六盏灯完整、有限正功率、支持的材质与 UV 范围、合并前后面数、原 UV 哈希不变、光照 UV 有限且在图集内、烘焙像素非空且有限、源工程大小与修改时间不变。尚未运行的检查不能记为通过。

## 2026-09-10 执行记录

- Python AST 语法检查通过，删除了未使用的导入。
- 本次后台 Blender 从 08:42 启动，到 09:31 仍未进入检查脚本，累计 CPU 时间约 2.66 秒；没有 `started.json`、EXR 或样本 GLB。已核对命令行后停止本任务进程，保留日志，不能声称完成烘焙（时间为本机 America/Los_Angeles）。
- 同时测得系统 CPU 100%，内存剩余约 1.7–2.6 GB，后台 Blender 约 0.3 GB；负载涉及浏览器、编译和内存压缩。没有停止或改动这些其他进程。
- 已释放本任务两个无头页面的城市场景。浏览器曾确认 WebGL2 使用 RTX 3080 Laptop GPU 的 ANGLE Direct3D11，不能把低帧率归因于软件渲染。
- 本地网页在加载及重新加载之间变化，曾返回 500；拿到的 renderer 统计仍处于加载阶段，不是城市稳定渲染的帧率或绘制调用证据，500 根因未定位。
- 第二次复核改用 `--factory-startup --disable-autoexec --threads 2`，完全不读取上海工程，目标仅为单平面、64×64、8 samples 的漫反射校准。09:54:09 启动，10:00:13 仍未执行 Python 的首个状态写入；累计 CPU 2.265625 秒、工作集 148,905,984 字节，标准输出和错误日志均为空。已核对命令行后停止该样本，证据为 `.tmp/png/space-light-bake/calibration-01-process.json`，不是烘焙成功报告。
- 此次系统 CPU 仍为 100%，可用内存已回升到约 5.5 GB；进程主线程采样为 Ready。仅对这个微小样本作了 12 秒普通优先级诊断，随后恢复 BelowNormal，仍未进入脚本。结果说明当前停滞也发生在空白启动，不能归因于上海几何规模或烘焙参数；线程调度受限是线索，具体系统原因尚未定位。没有调整其他进程。
- 本机 Three.js 0.183.2 的 `lights_fragment_maps.glsl.js` 将 `lightMapTexel.rgb * lightMapIntensity` 加入 irradiance，再由物理材质应用 Lambert 项；没有在这里自动乘 π。Cycles 的实际数值尚未取得，因此不能根据这一半证据决定贴图强度。

## 下一轮验收

1. 先在资源允许时通过空白 Blender 的微小校准，再加载单栋；完成实际烘焙，检查退出码、报告、EXR 有效像素及 GLB 的 `TEXCOORD_0 / TEXCOORD_1`。空白启动未通过时不反复加载整城。
2. 对照本栋原生灯光渲染，检查柱廊、檐口、鼓座的阴影、接缝与图集密度；用校准样本核对 Cycles 输出与 Three.js `lightMap` 的强度换算。
3. 在独栋浏览器样本检查正面、斜侧、近远视角和金属反射；出现漏光、黑块或明显接缝则修改并重烘焙。
4. 效果通过后再设计保留稳定 ID、日夜强度控制及资产加载的正式接入，移除被替代的补光，避免重复照明；随后测量真实场景耗时与显存。

## 技术来源

- [Blender 5.2 Cycles Render Baking](https://docs.blender.org/manual/en/latest/render/cycles/baking.html)：烘焙需要 UV 和目标图像节点；Diffuse 的 Color 与 Direct/Indirect 可分别控制。本次通过官方检索摘要核对，网页正文请求未成功。
- [Three.js MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html)：`lightMap` 使用额外 UV，描述预先计算的照明；PBR 反射仍依赖环境光照。已读取官方页面，实际导出和强度换算仍须样本验证。
- 本机 Blender `io_scene_gltf2/blender/exp/primitive_extract.py` 在启用 `gltf_texcoords` 时枚举网格 UV 层；这里只能证明导出实现支持多层 UV，不能替代对实际 GLB 的检查。

没有引入第三方天气或照明库。本实验脚本为仓库自写，使用已安装的 Blender/Cycles 与 Three.js；建筑照片来源继续使用各栋既有参考档案。
