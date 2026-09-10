# 江海关屋顶接缝与钟楼基座检查

调查日期：2026-09-10。范围为外滩 13 号现有工程的局部修正，不能据此宣称整栋 1:1 或电影级验收通过。

## 参考与日期

- 原始实拍来源：[Asisbiz 外滩 13 号江海关](https://www.asisbiz.com/China/13-Zhongshan-Rd.html)及[对应原图页面](https://www.asisbiz.com/China/13-Zhongshan-Rd/pages/13-Zhongshan-Rd-Shanghai-Customs-House-The-Bund-Huangpu-District-Shanghai-China-built-1927-01.html)，原图页面署名摄影师 **Matthew Laird Acred**。本轮查看了本地原图 `.tmp/png/bund-hero-details/13-Zhongshan-Rd-Shanghai-Customs-House-The-Bund-Huangpu-District-Shanghai-China-built-1927-01.jpg`，沿用[第八批参考档案](shanghai-landmarks.md)的同一照片。
- **拍摄 EXIF 更正**：2026-09-10 读取 JPEG 的嵌套 EXIF IFD（34665），`DateTimeOriginal`（36867）与 `DateTimeDigitized`（36868）均为 **2008-11-14 17:25:05**，相机为 SONY DSC-W300。此前“没有可读取的 EXIF、拍摄日期未知”的结论漏读了嵌套字段，应撤回。顶层 `DateTime`（306）为 **2011-05-05 22:22:16**，属于修改时间字段；页面更新时间 **2020-01-27**、文件名中的建造年 1927、汇总页另一位摄影师提到的 1994 年均不能替代拍摄字段。**相机时钟与时区未独立验证**；该旧照中的主要夜间泛光未开启，不能作为当前灯位或照明光度的实测。
- 重新下载的 Asisbiz 原图与本地文件完全相同，SHA-256 为 `1d122b588aa6322b8e53ba68b5c962796befb3ee938976460ed89fff804e779c`。原图页面署名 Matthew Laird Acred，并标明 **CC BY-SA 3.0**；原始 HTML 保存在 `.tmp/png/space-parallel-20260910/customs/source-page.html` 与 `source-photo-page.html`。照片仅作本地建模参考，未作为运行贴图。
- **首要夜景参考**：[DvTor8303 自摄江海关与汇丰大楼夜景](https://commons.wikimedia.org/wiki/File:HSBC_Building_and_Custom_House,_Shanghai_at_night_20260417_(2).jpg)，**CC0 1.0**。文件页与原 JPEG 的嵌套 `DateTimeOriginal`、`DateTimeDigitized` 均标记 **2026-04-17 20:34:53**；相机 iQOO 12，时钟与时区未独立验证。[同夜另一视角](https://commons.wikimedia.org/wiki/File:HSBC_Building_and_Custom_House,_Shanghai_at_night_20260417.jpg)标记 20:33:35，亦为本人作品、CC0。已实际查看两张原图：白色钟盘、暖亮石框与塔冠、亮檐线和檐下暗带、基座下缘较亮、主立面上洗及深色窗洞均可辨；入口部分受树和人群遮挡。手机曝光、自动白平衡与图像处理影响色彩和反差，只用于明暗分布与层次，不能反算色温或光度。原图、来源页及其余历史互证见 `.tmp/png/space-customs-night-20260910/references/research.md`，照片未转为正式纹理或发布资产。
- Asisbiz 日景照片能支持前方双阁楼的连续转折檐口、钟楼下部完整石墙及基座檐上朝上的投光器。正面可辨识五盏投光器，原图横向像素中心约为 `484/578/669/764/861`；两侧另有斜向灯具，本次未复刻。檐口细部尺寸、灯具间距及材质参数仍为估算；没有测绘或现场色卡。
- 代码复用本仓库既有 `refine_customs_roof.py`、`refine_bund_galleries.py`、`refine_bund_hero_details.py`、`refine_shanghai_landmarks.py` 与 `refine_jin_mao.py` 的网格、备份、裁切、材质和检查舞台工具。本轮未移植其他 GitHub 项目的代码。

## 实证根因

只读诊断读取主 `shanghai.blend`，未保存工程。日志及结构化结果：

- `.tmp/png/space-parallel-20260910/customs/diagnose.py`
- `.tmp/png/space-parallel-20260910/customs/diagnosis.json`
- `.tmp/png/space-parallel-20260910/customs/diagnose.log`

| 问题 | 直接证据 | 处理边界 |
| --- | --- | --- |
| 双阁楼檐口深部接缝和露头 | 新六层檐口统一止于局部 `y=-1.65 m`，旧模型切口位于 `y=-1.5 m`。切口旧顶部约 `z=39.69–39.71 m`，新顶部 `39.53 m`，旧斜面与新水平分层剖面也不同 | 只替换前方两阁楼上檐的后接段，使其沿用新檐口的同一完整剖面。保留后排阁楼、拱窗、钟楼和整栋地理变换 |
| 钟楼基座夜间黑横带 | 沿共同检查舞台的四个低位灯位置反向射线。基座 `z=35.7/36.2/36.8/37.4 m` 共 16 条光路全被 `customs-roof-20260910/root/147/5/trim` 的出檐挡在 `z=35.4799995 m`；`z=38/39/40/41 m` 的另 16 条光路全畅通 | 这是此套 **临时 Cycles 检查灯** 的遮挡证据。保留真实出檐；补照片可见的檐上灯具外形和位置记录。网页投光需要另行验证，不能凭此归因或宣称已修复 |
| 玻璃局部青绿色强反光 | 旧玻璃和上一轮新屋顶玻璃都继承 `metallic=.32`、`roughness=.24`、透射 0；没有自发光。线性基色约 `(0.01850,0.03560,0.03190)` | 仅复制江海关的对应材质，去金属化并降低色偏、加宽高光；保留所有窗网格及着色绑定。仍是未模拟室内的玻璃代理，不能当成测得的真实光学材料 |

钟楼模型上界 `79.19999695 m` 是现有工程约束，并非本轮实测高度。

## 增量实现与状态

入口：[refine_customs_junctions.py](../scripts/refine_customs_junctions.py)，修订 `customs-junctions-20260910`。

- `author(root, archive)` 支持父流程串行调用，完成后自己写入 `spaceCustomsJunctionRevision` 与 `spaceCustomsJunctionDetail`。
- 前方两阁楼保留同一组六层连续檐口，延伸到各自原上檐的几何后界；不凭全楼包围盒重建城市。
- 玻璃局部复制为非金属、粗糙度 `.34`、sRGB `(47,53,53)`。未修改其他楼栋共享材质。
- 五盏基座正面投光器只包含支架、倾斜灯头与发光灯面，新增两个网格；`projectorAnchors` 记录根局部坐标，`runtimeLightsUpdated=false`。这些 metadata 本身不会改变网页灯光。
- 原网格有非导出 ARCHIVE 备份，原运行物件 ID、所有原物件变换与 clock 属性须保持；已有本修订时拒绝重复运行。CLI 完成后校验主文件大小与修改时间，遇源文件变化时要求重开；父流程负责统一保存前的源漂移保护。
- 所有 CLI 模式均不保存；没有 `--apply` 入口。父流程统一调用 `author(root, archive)` 后保存。`--baseline` 和 `--review-saved` 均只读。

候选阶段完成只读几何诊断、无渲染校验及三张真实 Cycles 审图，没有保存主工程；随后协调流程已统一应用、保存及导出，实际网页复查结果见下文，夜景尚未通过。

## 2026-09-10 候选验证

证据统一位于 `.tmp/png/space-parallel-20260910/customs/`，无渲染候选及两次渲染进程均正常退出。

| 检查 | 结果与证据 |
| --- | --- |
| 导出契约与原工程保护 | `candidate-author.json`、`candidate-day-author.json`、`candidate-night-author.json` 一致：619 个原 runtime ID 保留，没有重复 ID 或空网格；所有原物件变换、clock 属性保持；新增 2 个网格。检查主文件大小与修改时间未变，所有报告均 `saved=false` |
| 局部几何 | 旧接缝后段裁掉 640 面，六层新檐口分别连续延伸至局部 `y=-7.486844 m`、`-6.345260 m`；钟楼上界仍为 `79.19999695 m`。后排阁楼保留 |
| 日景近景 | `candidate-day-13-day-close.png`，1200×1200、24 samples、CPU 14 线程，与上一轮 `bund-next/saved-13-day-close.png` 使用相同近景机位及共同舞台。前方双阁楼的顶部黑缺口、旧斜檐露头消失；六层檐口连续回折。玻璃青绿色偏色减轻，五个灯具外形可见 |
| 夜景共同灯位 | `candidate-night-13-night-close.png`，相同近景机位与共同旧灯位。檐口接缝修正保持，但钟楼基座黑带仍在，证明几何修正本身没有消除低位灯被出檐遮挡的问题。中性玻璃依然出现较强的水平环境反光，不能认定材质完整达标 |
| 夜景灯位 A/B | `candidate-night-13-night-plinth-lighting.png`。在同一临时舞台增加五个檐上 AREA 检查灯（45 W、尺寸 0.24 m），原黑带被照亮；同时产生五处明显亮斑，旧灯造成的宽横向明暗分界仍部分可见。因此此图只接受为遮挡根因证据，**不接受为最终照明方案**。这些功率、尺寸不来自照片测量，检查灯没有写入源文件或网页 |

几何局部问题已通过日夜候选审图；中性玻璃通过去金属化与减色偏检查，仍未完成真实玻璃表现；完整夜景与网页灯光未通过验收。日志为 `candidate.log`、`candidate-day.log`、`candidate-night.log`。

## 命令与验证范围

父流程可在已打开的主工程中导入模块并调用 `author(customs_root, archive)`；本批子任务不自行保存主工程。

```powershell
& 'E:/Apps/Blender/blender.exe' --background 'D:/cube/cuberoot.me/design/space/scenes/shanghai.blend' --threads 8 --python 'D:/cube/cuberoot.me/design/space/scripts/refine_customs_junctions.py' -- --no-render --label candidate
```

实际启动须通过隐藏窗口、低优先级的 `Start-Process`，且遵守父流程的唯一重计算时段调度。共同审图工具内设 14 线程，只有获准独占时段后才运行渲染；不把无渲染候选的检查当视觉验收。

父流程完成统一审核后，在自己的源漂移保护与保存步骤之前调用：

```python
import refine_customs_junctions
detail = refine_customs_junctions.author(customs_root, archive)
```

`--night --corrected-lights` 会先生成共同旧灯位图，再在临时舞台增加檐上检查灯生成对照图。此 CLI 不保存，因此新增检查灯不会存入源文件或导出网页；父流程也不得把审图舞台保存。该对照只能证明灯位对这条黑带的影响。

仍未解决：两侧斜向灯具及完整灯具布局、品牌/功率、现场色彩与色温、后立面及石雕精度、室内玻璃透射、网页实际夜景配光。几何、材质、临时 Cycles 图、网页灯光的通过情况分别记录。

## 统一保存后的第二轮修正与网页复查

首次合并并导出后，实际 GLB 首命中检查发现旧玻璃 `root/147/5/1` 穿出右侧回折檐口。核对真实旧玻璃几何后，在两条檐口高度 `36.98 m` 与 `37.53 m` 按实体厚度裁掉 20 面重叠玻璃；保留其余窗面、ID 与变换。修正入口为 `trim_glazing_at_returns`，使用独立修订防止重复裁切，并归档原网格。此问题修在模型里，没有扩大探针容差来隐藏穿插。

最终 GLB 的 53 处江海关表面检查全部通过，包括六层回折、玻璃与五个倾斜投光器。`web-customs-day-final.png`、`web-customs-night-final.png` 已在真实网页渲染并打开复查，证据位于 `.tmp/png/space-parallel-20260910/`：回折连续、玻璃色偏减轻、时钟与新增灯具正常；21:00 的基座仍有硬明暗分界，底层与窗带偏暗，不能认定夜景已还原。五盏临时 Cycles 检查灯没有保存或导出。

最终上海工程 122,328,032 字节，GLB 为 310,649,984 字节；备份、哈希、全部稳定 ID 和运行绑定记录见[本批跟踪](../../../docs/space-blender-tracker.md#2026-09-10-三栋细部合并与网页首帧修复)。

## 2026-09-10 网页夜景照明保存与复验

本节是上述几何与玻璃修正后的独立照明记录。先用网页临时参数进行三轮候选对照，主流程随后将第三版保存到 Blender 源工程，正常导出正式 GLB，并重新加载网页复验；最终证据与候选分别保留。

证据位于 `.tmp/png/space-customs-night-20260910/`。候选保持现有 **6 盏聚合投光代理**，调整上部基座、百叶层与底部石柱、夹层的照明分配；并非复刻照片中的实际灯具数量。位置、目标、锥角、软边、强度与色值均为网页 A/B 估算，没有现场测光、IES 或完整配光图。此前五个灯具外形及五盏临时 Cycles 检查灯与这 6 盏网页代理是不同对象。

| 截图 | 实际审图结果与取舍 |
| --- | --- |
| `baseline-night.png`、`upper-off.png` | 基准图的宽基座偏乳白亮板，入口柱与底部石墙偏暗；关闭上部灯的对照图中，基座亮度降低，下部入口没有随之改善。这里只记录网页对照现象，不套用此前临时 Cycles 舞台的遮挡结论 |
| `candidate-1.png` | 入口四柱与夹层石墙显出，门洞保持深色；基座下缘出现两个明显近圆形热点，拒绝作为落地方案 |
| `candidate-2.png` | 双圆斑消失，但基座仍近似一整块均匀浅色亮板，层次偏平，继续调整 |
| `candidate-3.png` | 基座贡献收敛，石纹与檐下暗带保留；入口四柱、夹层石墙清楚，门洞仍深。三版中选此版，接受为本轮候选 |
| `candidate-3-oblique.png` | 已实际打开审图。双圆斑未复发；侧墙、檐下与门洞仍暗，入口柱列可辨，未见明显穿墙光或新增局部热点 |
| `candidate-3-far.png` | 已实际打开审图。钟盘、百叶层、基座和入口仍可区分，没有局部突然过亮或明显脱离邻楼的亮度；石纹与柔和渐变在远景有所合并 |

独立审图认为候选 3 在预设、斜侧和远景均未出现阻断本轮落地的新问题。**这不等于整栋夜景或 1:1 验收通过**：两级塔冠仍偏暗，横向檐线缺少实拍的暖亮层次，基座在远景仍偏整片，斜侧照明较单薄；实际灯具布局、侧后立面、色温与光度仍待核对。三张静态视点也不能证明缩放过程完全没有亮度跳变。

主流程已保存修订 `customs-night-lighting-20260910` 并正常导出，正式 GLB 为 310,655,468 字节。最终正面、斜侧、远景夜图及日图 `final-preset-night.png`、`final-oblique-night.png`、`final-far-night.png`、`final-preset-day.png` 已逐张打开复查：入口与基座的改善保持，双圆斑未复发，日间六灯全零。真实网页确认最终哈希且无候选注入；完整导出合同检查通过。源备份、哈希、保留检查及运行证据见[本轮跟踪](../../../docs/space-blender-tracker.md#2026-09-10-江海关基座与入口夜景配光)。后续单独细化冠部与檐口，以上未达标项继续保留。
