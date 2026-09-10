# 江海关屋顶接缝与钟楼基座检查

调查日期：2026-09-10。范围为外滩 13 号现有工程的局部修正，不能据此宣称整栋 1:1 或电影级验收通过。

## 参考与日期

- 原始实拍来源：[Asisbiz 外滩 13 号江海关](https://www.asisbiz.com/China/13-Zhongshan-Rd.html)及[对应原图页面](https://www.asisbiz.com/China/13-Zhongshan-Rd/pages/13-Zhongshan-Rd-Shanghai-Customs-House-The-Bund-Huangpu-District-Shanghai-China-built-1927-01.html)，原图页面署名摄影师 **Matthew Laird Acred**。本轮查看了本地原图 `.tmp/png/bund-hero-details/13-Zhongshan-Rd-Shanghai-Customs-House-The-Bund-Huangpu-District-Shanghai-China-built-1927-01.jpg`，沿用[第八批参考档案](shanghai-landmarks.md)的同一照片。
- **拍摄日期无法确认**。本地 JPEG 没有可读取的 `DateTime`、`DateTimeOriginal`、`DateTimeDigitized` EXIF 字段；2026-09-10 重新访问来源及原图页面后，确认页面更新时间均为 **2020-01-27**，未给出此照片拍摄日期。文件名中的 1927 是建筑建造年；汇总页另一位摄影师邮件提及的 1994 年也不能套用到这张图，更不能据照片断言 2026 年的实际灯位。原始 HTML 已保存在本次证据目录的 `source-page.html` 与 `source-photo-page.html`。
- 照片能支持前方双阁楼的连续转折檐口、钟楼下部完整石墙及基座檐上朝上的投光器。正面可辨识五盏投光器，原图横向像素中心约为 `484/578/669/764/861`；两侧另有斜向灯具，本次未复刻。檐口细部尺寸、灯具间距及材质参数仍为估算；没有测绘或现场色卡。
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
