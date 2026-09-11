# 上海环球金融中心顶部参考核查，2026-09-10

本档案记录 SWFC 顶部的已读原始资料、可用尺度、建模约束与候选进度。candidate04 已修复分段 UV，candidate06 已消除旧中央外幕墙遮挡，candidate07 已旋转到文献确认的东北—西南对角。最新 candidate10 已修正 candidate09 的导出变换校验失败，实际导出并通过网页 60 项射线及完整城市合同；97F 玻璃通透性改善，屋架与桥底仍偏蓝灰，97F 夜间照明层次未达标。**精确方位仍为图纸估算，整体视觉及 1:1 仍未通过，本轮候选未保存到正式 `.blend`，正式上海 GLB 未变**；不能把结构检查或局部修复通过记为复原完成。

最明确的顺序是先核对对角收削外壳，再恢复 97F 玻璃顶、100F 观光桥及其上方冠部。只在旧矩形外壳内补一根桥，无法解决平面方向与桥长的矛盾。

## 2026-09-10 候选实施与网页核查进度

本轮由三名子 Agent 分别负责模型修改、实拍审核和来源文档，另由主 Agent 执行导出与浏览器验收，共四名 Agent 协作；**主 Agent 独占 Blender 写入和候选导出**，其余 Agent 不并发操作源工程。实际导出与候选网页验证记录更新至 candidate10；candidate09 的失败保留，后续 candidate10 已修正并实际通过导出与整城合同复验，候选未写入正式资产。

| 阶段 | 已验证结果 | 边界 |
| --- | --- | --- |
| candidate01 | 在匿名 GPU instance ID 保留守卫处失败，日志为 `Existing runtime identities are missing or duplicated` | 首版未通过，不作为成功候选；后续修正守卫对匿名实例标识的处理 |
| candidate02 Blender | 修正守卫后执行成功；候选塔体 **950,442 顶点、238,454 面**；全部原对象与运行 ID、九张内嵌图、三组灯保持 | 报告为 `saved=false`、`officialAssetsWritten=false`；保留检查针对城市源场景，隔离导出仅含候选塔体 |
| candidate02 隔离 GLB | **7 nodes、6 meshes、35,998,448 字节**，成功导出并在网页临时替换原塔 | 不是正式城市 GLB，不在原塔上叠加候选 |
| 网页原模型负对照 | 原有 **4 项洞口检查通过**，新增 **30 个楼面检查点、15 个桥底检查点均缺失** | 旧洞口检查不能证明观光桥楼面和桥底存在 |
| 网页 candidate02 | 按实际材质朝向检查，**49 项全部通过**：4 项洞口、30 个楼面、15 个桥底 | 结构与朝向通过不等于尺寸、材质、精细外观或真实夜景通过 |
| candidate03 Blender 与隔离 GLB | 实际 Blender 执行及导出成功；候选塔体 **98,314 顶点、25,422 面**，GLB 为 **7 nodes、6 meshes、3,467,436 字节** | 报告仍为 `saved=false`、`officialAssetsWritten=false`；几何与文件体积下降不证明视觉问题已修复 |
| 网页 candidate03 | 使用原材质，**49 项检查再次全部通过**；主 Agent 逐张查看沿轴斜侧日景、立面近景、整栋日景和沿轴斜侧夜景 | 当时幕墙细竖线仍有锯齿；隔离对照定位为玻璃分段 UV 断裂，修复结果另记 candidate04 |
| candidate04 Blender 与隔离 GLB | 实际执行并成功导出，**98,314 顶点、25,422 面、7 nodes、6 meshes、3,467,436 字节** | `saved=false`、`officialAssetsWritten=false`，正式资产未写入 |
| 网页 candidate04 | 在真实 `/zh/space` 注入隔离候选后，实际材质朝向的 **49 项检查全部通过**；立面近景、沿轴斜侧日景及 03/04 仅玻璃同机位对照均由主 Agent 逐图查看 | 03 每 2 m 的折线在 04 中成为连续直线，**分段 UV 断裂缺陷已修复**；不代表玻璃整体质感或夜景通过 |
| candidate05 Blender 与网页 | 静态检查后，Blender 成功导出并正常退出；**103,042 顶点、26,612 面、3,633,596 字节**。真实网页 **49 项检查通过**，主 Agent 逐张查看 97F 内部、外部与冠槽三张日景 | `saved=false`、`officialAssetsWritten=false`；**视觉未通过**：旧外幕墙遮挡新棚侧退台，独立审查核出小支撑缝；该版未校正朝向，后续结果另记 candidate07 |
| candidate06 Blender 与网页 | Blender 实际导出并正常退出；**103,222 顶点、26,678 面、3,639,856 字节**；46 项交接检查通过，圆梁与框架重叠约 **0.00704956 m**。真实网页 **60 项检查全部通过**，包括 candidate05 失败的 6 条外侧首命中；主 Agent 已看 97F 内外两张日景 | 旧中央外幕墙遮挡消除，新屋棚和侧退台可见；圆梁接合数值仅为候选几何检查。整体视觉仍未通过，蓝色不透明单面玻璃、下方不可见的 97F 玻璃顶、100F 桥底与精确尺寸仍待处理；本版仍为 `−4.97°`，未旋转、未写正式资产 |
| candidate07 方向候选 | Blender 正常退出，stderr 为空；**103,222 顶点、26,678 面、3,639,872 字节**。mesh-local **85.04°** 对应世界约 **38.191°**，为东北—西南长轴；完整城市临时注入后 **60 项检查全部通过**，主 Agent 已逐张看城市、顶部斜侧、近地面三张日景 | 三件套相对位置保持、开口可见；近地面被既有简模裙楼部分遮挡，裙楼与地面衔接尚未通过准确度核查。精确角度仍为出版图估算；不透明玻璃、单面屋棚与 100F 桥底未修，正式原场景与临时注入候选场景均通过整城合同复验，正式资产未写 |
| candidate09 导出守卫失败 | 生成临时 GLB 后未通过新增细部变换守卫，日志为 `New detail is not an identity-transform direct root child` | 该次失败保留，不作为通过候选；后续 candidate10 已修正导出变换校验并实际通过 |
| candidate10 Blender 与网页 | Blender 正常退出；**107,446 顶点、28,074 面、9 nodes、8 meshes、3,788,588 字节**。八个直接子网格的导出变换及局部顶点精确核对通过；实际材质 **60 项射线及完整城市合同全部通过**，`ok=true`、`errors=[]` | 97F 玻璃已能看到后方结构及天空；屋架与桥底仍偏蓝灰，97F 夜间偏暗，整体视觉及 1:1 未通过。报告仍为 `saved=false`、`officialAssetsWritten=false`，正式资产未写 |

已实际打开 candidate02 的屋顶日景、沿轴斜侧日景、取消俯仰限制后的桥底日景与沿轴斜侧夜景，并与业主项目册、IMA 第 4 张、KPF P3 及 ArcelorMittal 第 34 页实拍对照。洞口贯通、桥底连接两端已可见。以下细部问题来自 candidate02 的实拍对照，截至 candidate04 尚未完成这些项目的精细复验：

- 97F 固定屋架及玻璃顶体量不明确，候选仍读作灰色平台与细网格；实拍中的连续白色主梁、纵向承托和抬高顶棚需补齐。
- 冠部顶边过薄，未表达实拍可见的纵向设备槽、高低边缘与设备；槽深、设备尺寸和准确数量仍需估算。
- 桥底虽有分格，但较亮板区、中央较暗窄带和边框的层级不足；业主“三条玻璃地板”不能直接对应三条黑色桥底带，透光构造仍未核定。
- candidate03 的幕墙细竖线出现锯齿。主 Agent 在同一相机分别只显示玻璃、只显示实体窗框并逐图查看：`candidate03-glass-only-day.png` 有锯齿，`candidate03-frame-only-day.png` 的竖杆连续。审图 Agent 在 482 m 同一共享顶点两侧复算出 **0.614179 m 的 UV 差，约 0.424 个窗格**，定位为玻璃每 2 m 分段的周长映射不连续；这是候选坐标检查，不是实物尺寸。candidate04 的 03/04 仅玻璃同机位对照已确认这些分段折线变为连续直线，该 UV 缺陷已修；玻璃整体质感、机械层共面问题的视觉复验、夜间细部和机械层窗光仍待完成。

candidate05 已实际导出 **97F 浅双坡固定屋架、圆截面长梁、玻璃分格，以及冠部纵向设备槽**，当时旧外幕墙遮挡新棚侧退台，并存在小支撑缝。candidate06 已完成对应裁切与接触修正的实际导出和网页检查；主 Agent 查看内外日景，确认旧中央外幕墙遮挡消除、新屋棚和退台可见，内部框架与圆长梁连接。candidate07 又将 mesh-local `−4.97°` 校正到 **85.04°**，已在完整城市注入并检查全景、顶部斜侧及近地面视图。最新 candidate10 为 97F 顶棚与侧窗分离透射玻璃，后方框架、室内和天空已可见；100F 楼面玻璃仍沿用旧不透明材质。**整体视觉仍未通过**：屋架及桥底仍偏蓝灰，97F 夜间偏暗，裙楼与地面衔接、机械层及准确尺寸待核。未确认光学参数、尺寸、坡度、梁径、分格数量及槽深继续估算，不补无证据的开合机构。Quan 等 2013 年论文确认东北—西南对角，业主图给出的约 38.19° 精确方位仍是出版图形估算；**候选旋转和网页查看已执行，最新 candidate10 已通过整城合同复验，精确方位仍未实测**。

正式 `design/space/scenes/shanghai.blend` 尚未保存本轮候选；正式上海 GLB 仍为 **310,655,468 字节**。候选与报告位于 `.tmp/png/space-swfc-top-20260910/`：`candidate01-error.log`、`candidate02-process.log`、`candidate02/candidate-report.json`、`candidate02/swfc-candidate.glb`，以及 `candidate02-roof-day.png`、`candidate02-axis-oblique-day.png`、`candidate02-underside-unclamped-day.png`、`candidate02-axis-oblique-night.png`。后续仍需修订候选、独立审图，通过后再保存、正常导出并复验正式网页。

candidate03 的证据为同目录 `candidate03-process.log`、`candidate03/candidate-report.json`、`candidate03/swfc-candidate.glb` 及 `candidate03-axis-oblique-day.png`、`candidate03-facade-close-day.png`、`candidate03-whole-day.png`、`candidate03-axis-oblique-night.png`；四张网页图均由主 Agent 实际打开查看。

candidate04 的报告与导出位于 `candidate04/candidate-report.json`、`candidate04/swfc-candidate.glb`；后者 SHA-256 为 `dafdb479038f0603470936c609be97027e02f171f88ad2db7199957e34946ccf`。网页证据为 `candidate04-facade-close-day.png`、`candidate04-axis-oblique-day.png` 及 `candidate03-glass-only-day.png` / `candidate04-glass-only-day.png` 同机位对照。

candidate05 的证据为 `candidate05/candidate-report.json`、`candidate05-runtime.json` 和 `candidate05-process.log`；隔离 GLB SHA-256 为 `3f58044e9195c6e430877d7dc6f4a2766c3a15cb065a8691f5e6ca4656716c19`。主 Agent 已逐张查看 `candidate05-97-interior-day.png`、`candidate05-97-exterior-day.png`、`candidate05-crown-trough-day.png`；运行报告记录 `visualAccepted=false`、`oneToOneAccepted=false`、`cinematicAccepted=false`。

candidate06 的证据为 `candidate06/candidate-report.json`、`candidate06-runtime.json` 与 `candidate06-blender.log`；隔离 GLB SHA-256 为 `d92b26a834aebe7508755f0009b75c0ceaec7e1898c93db2f1c7092481ccf99a`，对应脚本 SHA-256 为 `1d5e3c3ac70847452a87b94f6613f9585099a25cc704f171f7aac1393e62a0ee`。主 Agent 已查看 `candidate06-97-interior-day.png` 与 `candidate06-97-exterior-day.png`；运行报告记录 `saved=false`、`officialAssetsWritten=false`、`visualAccepted=false`、`oneToOneAccepted=false`、`cinematicAccepted=false`。

candidate07 的证据为 `candidate07-direction/candidate-report.json`、`candidate07-runtime.json`、`candidate07-blender.log` 与空的 `candidate07-blender.err.log`；GLB SHA-256 为 `9bf0126e764368d91bd11ec38000126696be8360bc6829d451f7d2e0e5f4fb16`。主 Agent 已逐张查看 `candidate07-city-day.png`、`candidate07-top-oblique-day.png`、`candidate07-base-day.png`，运行报告仍为未保存、未写正式资产及三项视觉验收 false。候选报告的 `siteOrientationConfirmed:false` 是冻结旧元数据；应分别理解为文献已确认东北—西南对角、候选已旋转、精确 bearing 尚未实测，不能用该旧字段否定已核读资料或宣称测绘确认。

candidate09 的失败证据为[导出后错误日志](../../../.tmp/png/space-swfc-top-20260910/candidate09-blender.err.log)。后续 candidate10 的[导出报告](../../../.tmp/png/space-swfc-top-20260910/candidate10/candidate-report.json)记录 `geometryRoundTrip.sourceIdentityBasis=true`、`directRootChildren=8`、`exactExporterTransforms=true`、`exactLocalPositions=true`；约 **0.0974 mm** 是导出浮点数值往返误差界，不是现场尺寸精度。candidate10 GLB SHA-256 为 `c7a3d2911b88f115e34fe73b2227f037205d484267a0bcf359e437ad698bb70d`，Blender 正常退出，stderr 仅有 `Material.use_nodes` 弃用提醒。[网页报告](../../../.tmp/png/space-swfc-top-20260910/candidate10-runtime.json)记录临时替换原六网格、增加顶部玻璃和桥底浅色板两个网格后，实际材质 60 项射线和完整城市合同通过；未叠加旧塔。候选报告仍为 `saved=false`、`officialAssetsWritten=false`，源指纹仍为 `[122841156,1789080267364826700]`，正式资产未变。

candidate10 的[独立审图记录](../../../.tmp/png/space-swfc-top-20260910/candidate10-photo-audit.md)与主 Agent 对[97F 内部日景](../../../.tmp/png/space-swfc-top-20260910/candidate10-97-interior-day.png)、[外部日景](../../../.tmp/png/space-swfc-top-20260910/candidate10-97-exterior-day.png)的查看确认玻璃通透性改善，但固定屋架仍偏蓝灰，需仅对屋架局部校准到实拍浅白色。[桥底仰视日景](../../../.tmp/png/space-swfc-top-20260910/candidate10-bridge-underside-day.png)已由主 Agent 实际查看：两组板带、中央深色缝及网格可见，阴影下仍明显蓝灰，不能判定与实拍匹配。[97F 内部夜景](../../../.tmp/png/space-swfc-top-20260910/candidate10-97-interior-night.png)可见玻璃后的夜空和外围框架，但整个室内偏暗，照明层次未达标。桥底浅色板已用非金属、无自发光材质，参数与真实板材构成仍为估算或未知；未从照片亮度推断真实自发光。**整体视觉、1:1 与电影级验收均未通过**。

`verify.ts` 已支持候选角度解析，并兼容缺失元数据的旧资产。`verify-direction-regression.json` 记录实际源码片段与真实 Three Raycaster 回归通过，涵盖旧场景四条射线、85.04° 等旋转场景、16 种非法或缺失角度及非有限数元数据，以及阻断负对照；主 Agent 已确认相应 typecheck 通过。`candidate07-contract.json` 记录当前验证器对未注入候选的正式原场景，以及加载实际 candidate07 GLB 并临时替换 6 个 Mesh 的完整城市分别复验，**两者均为 `ok=true`、`errors=[]`，其他既有合同全部通过**。候选加载器复制真实 JSON 中的 `bridgeAngleLocalDegrees=85.04`，执行了新方向探针，未误走旧 0° fallback；`formalAssetChanged=false`。这是临时注入场景的合同通过，候选尚未写入正式资产，视觉验收仍未通过。

网页唯一来源 JSON 已更新既有 KPF、SWFC 业主两项并新增五项来源，包含 Quan 等现场论文，本轮累计七项中英文、`space: true` 条目，七条链接已在真实网页 DOM 确认。此前六项来源的 **390 × 844** 展开截图 `sources-candidate-390.png` 已查看，`innerWidth=390`、`scrollWidth=375`，未见横向溢出；该截图不作为新增第七项后的窄屏复验。没有将研究照片作为正式图片或材质发布。本轮仅本地提交脚本、文档与来源，重资产、LFS 配置及发布暂缓。

## 已实际阅读的来源

以下访问及本地审图日期均为 **2026-09-10**。竣工年、网页发布日期、文件生成时间与照片拍摄时间分别记载，不互相替代。资料图片仅作研究参考，本轮没有将它们作为网页图片或材质发布。

| 来源 | 本轮实际读取内容 | 日期、作者及版权边界 |
| --- | --- | --- |
| [KPF 项目页](https://www.kpf.com/project/shanghai-world-financial-center) | 官方项目说明；直接打开 P1 建成外观仰照、P2L 公园方向外观、P2R 双向剖面、P3 洞口仰照及 P4 桥内实拍 | 项目页注明 2008 年竣工，页面和图片未列独立制作/拍摄日期。KPF 为设计建筑师和发布者；未核得单张照片摄影者或开放许可，不能将 KPF 自动写成摄影者 |
| [The Skyscraper Museum：SWFC](https://old.skyscraper.org/EXHIBITIONS/TEN_TOPS/swfc.php) | KPF 提供的逐层平面及剖面、三视角立面图，并读取图注 | 页面明确将两组图归于 Kohn Pedersen Fox Associates, PC；图纸日期未知。三视角图是建成方案的**渲染图**，不是实拍或测绘。页面另一张展柜背景照的 Jacob Montrasio 署名不适用于这些图纸；未见开放许可 |
| [Irie Miyake Architects & Engineers 项目页](https://www.imae.co.jp/en/works/shanghai-world-financial-center) | 项目资料及 6 张照片；重点为第 4 张从 97F 白色框架向上看 100F 桥底及端部连接，第 6 张含中央绿地、金茂及周边街道的高位外观 | 页面注明 2008 年竣工，未列摄影者与拍摄日；图片路径中的 `2008/01` 不能作为拍摄日期。[网站版权说明](https://www.imae.co.jp/en/sitepolicy)将内容版权归于 IMA 或第三方，未提供开放许可 |
| [SWFC 业主中英项目册](https://www.swfc-shanghai.com/pdf/swfc_project_brochure_cn.pdf) | 实际打开 PDF 第 5 页的区位/入口图、第 6 页（印刷页 11–12）的 94/97/100F 图片与文字、第 7 页酒店照片、第 11 页（印刷页 21–22）的标准办公层尺寸与北箭头；读取原 PDF 元数据及相关文字 | 发布者为 SWFC / 森大厦，册内单张图片作者与拍摄日未核得。该文件元数据创建于 **2014-01-16 13:07:14 +08:00**、修改于 13:08:38；这只是文件日期，不是竣工图出图日或照片日期。未见开放许可 |
| [森大厦英文开业新闻资料 PDF](https://www.mori.co.jp/en/img/article/090828e.pdf) | 正文第 1、2、3、10、13 页；实际打开第 2、13 页图像，核对高度定义、观光桥长度与 97F 玻璃顶说明 | 正文发布日 **2008-08-28**，发布者 Mori Building Co., Ltd / Shanghai World Financial Center Co., Ltd。文件元数据为 2008-09-10，URL 的 `090828e` 也不用于推断发布日期。未见开放许可 |
| [森大厦观光厅一周年及认证公告](https://www.mori.co.jp/press/release/post_202/) | 核对 100F 地上高度与海拔的不同定义，以及 55 m 桥、97F 可开启玻璃顶 | **2009-08-27** 发布，森大厦、上海环球金融中心与上海柏悦联合署名；网页保留版权。公告说明当时状态，不能作为 2026 年室内或灯光实测 |
| [ArcelorMittal HISTAR 技术册](https://constructalia.arcelormittal.com/files/5_3_1_HISTAR_web--01d1dbea37a973eac1d0153ef74c1d7e.pdf) | 实际打开第 34 页的 SWFC 清晰建成俯照，能见顶桥、97F 顶棚、冠部设备槽及周边道路；另读取版权页与 PDF 元数据 | 第 3 页版权为 **2020 ArcelorMittal**；PDF 创建时间 2020-09-21 08:54:12 +02:00。第 34 页照片署名原文为 **© Teri Meyer Boake / CTBUH**，拍摄日期未列，嵌入 JP2 无可读取 EXIF 日期，未见开放许可。2020 不是照片拍摄年 |
| [Quan 等现场测风原论文，DOI 10.1155/2013/902643](https://doi.org/10.1155/2013/902643)；[完整 PDF 镜像](https://pdfs.semanticscholar.org/9d06/3ff5a68918084258cfd5e5fcd51159f4f45d.pdf) | 独立准确度 Agent 核读正文并实际查看第 2、3 页：图 2 标明冠部长轴东北/西南两端的仪器，图 5 以北箭头和建筑 X/Y 轴确认同一对角；另区分图 4 的仪器轴 | Yong Quan、Shuai Wang、Ming Gu、Jun Kuang，*Mathematical Problems in Engineering*，**2013**，Article 902643；[出版页](https://onlinelibrary.wiley.com/doi/abs/10.1155/2013/902643)列首次发表 **2013-12-19**，不是照片或测量日期。正文注明 © 2013 Yong Quan et al.、Creative Commons Attribution License，未核得版本号。现场研究示意图可确定对角，不能提供精确测绘方位或观光桥尺寸 |

KPF P3、IMA 第 4 张照片和 KPF P2R、博物馆逐层平面的本地发表版均检查了顶层及嵌套 EXIF，未取得拍摄日期字段；这不证明摄影原始文件也没有 EXIF。没有用白平衡、曝光未知的照片推算玻璃反照率、金属度或灯具光度。

直接图片链接：

- [KPF P2R 双向剖面](https://e1.nmcdn.io/assets/kpf2024/wp-content/uploads/imported-files/Shanghai-World-Financial-Center_P2R-1440x1613.webp)
- [KPF P3 观光桥底实拍](https://e1.nmcdn.io/assets/kpf2024/wp-content/uploads/imported-files/Shanghai-World-Financial-Center_P3.webp)
- [IMA 第 4 张实拍](https://imae.co.jp/wp-content/uploads/2008/01/w_swfc-4.jpg)
- [KPF 逐层平面与剖面，由博物馆发布](https://old.skyscraper.org/EXHIBITIONS/TEN_TOPS/swfcsections.jpg)
- [KPF 立面渲染图，由博物馆发布](https://old.skyscraper.org/EXHIBITIONS/TEN_TOPS/swfcelevations.jpg)

## 尺度锚点及定义

| 数值 | 原始依据 | 可用范围 |
| --- | --- | --- |
| 492 m、地上 101 层 | 开业资料第 1、3 页；KPF / IMA 项目资料 | 建筑总高及层数。不是 100F 屋面高度 |
| 100F 地上高度 474 m | 业主项目册印刷页 11–12；开业资料第 2、13 页；2009 公告 | 观光层/最高使用楼层高度锚点。桥底在楼面以下，**不能把 474 m 直接当桥底或洞口上缘** |
| 100F 海拔 477.96 m | 2009-08-27 公告 | 与地上 474 m 是不同标高基准，不得在一个模型中混用 |
| 100F 观光走廊约 55 m 长 | 业主项目册印刷页 12；开业资料第 13 页 | 用来核查观光桥尺度是否合理；不是整座冠部外宽、桥净宽或洞口净跨度 |
| 97F 地上高度 439 m；94F 为 423 m | 业主项目册印刷页 12 | 楼层高度，不是 97F 玻璃顶最高点或洞口下缘 |
| 97F 至 100F 高差 35 m | 474 − 439 的算术结果 | 仅是上述楼面锚点之差；扣除顶棚、楼板后才可能接近洞口净高，现有资料不足以确定扣除量 |
| 屋顶高度 487 m | 开业资料第 2 页引用当时 CTBUH 的屋顶类别 | 历史高度分类；492 − 487 不能证明有一圈等高 5 m 的女儿墙 |
| 标准办公层约 58 × 58 m | 项目册印刷页 21 有双向尺寸标注；博物馆 KPF 图注说明方形基体 | 下/中部标准层锚点，不能直接套用到顶部；58√2 也不是已核定的顶桥外宽 |

开业英文资料第 10 页的 `58 meters in radius` 与业主带双向尺寸的方形标准层图不一致，**不按半径解释**。本轮没有采用旧圆洞方案、早期 472 m 高度或无原始出处的洞口尺寸。

## 图纸与建成照片给出的形状约束

### 对角包络

博物馆的 KPF 逐层平面从方形逐渐变成两个相对角被削去的六边形，再收成沿另一条对角线的窄长形。其文字说明与 KPF 官方的方形基体、两道弧面相交的设计说明相互支持。由此可以确定**截面拓扑、收削方向和顶部桥长轴与底层方形的相对关系**。[KPF 项目说明](https://www.kpf.com/project/shanghai-world-financial-center)、[博物馆原图及图注](https://old.skyscraper.org/EXHIBITIONS/TEN_TOPS/swfc.php)

合理的建模方法是在原方形局部坐标内，对一组相对角作随高度变化的裁切，保留另一条对角方向为顶桥长轴，再按对应截面连接外壳。裁切曲线、顶部剩余厚度、端部收口及转角截面必须作为拟合参数。这是实现建议，不是从资料恢复出的竣工解析曲面；也不能据图片朝向直接认定模型局部轴的真北方向。

1152 × 1440 的平面/剖面拼图可辨楼层和轮廓，但尺寸与图线精度不足以证明毫米或分米级的曲线、桥厚和腿宽。正面轮廓单独对齐并不足够，仍要检查斜侧和俯视图。

### 世界朝向：对角选择已核定，精确角度仍为估算

业主项目册印刷页 21 的主平面带北箭头：方形边在页面中水平/竖直，北向则相对页面竖直偏右约 **6.8°**。本轮从原 PDF 矢量路径读取北箭头中心 `(465.9955, 391.0516)` 与北端 `(467.0105, 382.5506)`，以页面向下为正的坐标复算 `atan2(1.0150, 8.5010)`；这是**出版图形的方向**，不是建筑测绘精度。主平面右上/左下有成对退槽；同页另一张设备平面旋转了约 90°，其北箭头也随之转向左，不能忽略图间旋转。[业主原 PDF，第 11 页](https://www.swfc-shanghai.com/pdf/swfc_project_brochure_cn.pdf)

Quan、Wang、Gu、Kuang 的 2013 年论文 *Field Measurement of Wind Speeds and Wind-Induced Responses atop the Shanghai World Financial Center under Normal Climate Conditions* 提供一手现场方向依据。独立准确度 Agent 已实际查看原 PDF 第 2、3 页：图 2 将仪器标在冠部长轴的东北、西南两端；图 5 有北箭头，建筑 Y 轴沿长轴、X 轴横向，并再次标注两端。两图确认**顶桥长轴为东北—西南**，排除了此前将无北箭头 KPF 图与业主平面跨图对应所得的西北—东南、约 128°/308° 工作推定。论文图为示意图，只用于核定对角，不从中精确量角。[原论文 PDF，第 2、3 页](https://pdfs.semanticscholar.org/9d06/3ff5a68918084258cfd5e5fcd51159f4f45d.pdf#page=2)

业主北箭头与该东北对角结合，给出的方位角约为 **38.19°/218.19°**（从北顺时针）；OSM 顶部 `building:part` 两长边约为 **40.02°、40.37°**，独立支持同一对角。业主数据来自出版图形，OSM 为众包几何，均未提供测量误差；两者约 2° 的差异**不能视为误差上限**。精确真北/格网基准和出版图形误差仍未知，38.19° 继续标为 `estimated`。[业主项目册](https://www.swfc-shanghai.com/pdf/swfc_project_brochure_cn.pdf#page=11)、[OSM 原始顶部多边形](https://www.openstreetmap.org/way/279942892)

candidate06 的 mesh-local `−4.97°` 对应世界西北—东南；candidate07 已按业主图估算值校正约 **90°**，保留 root yaw `−0.58 rad`，实际导出 mesh-local **85.04°**。报告中 Blender 东/北平面的长轴 U 约为 `(0.618293, 0.785948, 0)`，Three 世界对应 `(0.618293, 0, −0.785948)`，世界方位约 **38.191°**。**对角已由文献核定，候选旋转及网页三视点查看已执行，精确 bearing 仍未实测**。完整城市视图中三件套相对位置保持、开口可见；近地面被既有简模裙楼部分遮挡，未据此确认裙楼和地面衔接准确。KPF、IMA 与 ArcelorMittal 俯照继续用于外观交叉核对，尚未完成摄影机标定。

论文图 4 的仪器 x/y 指北/西，不能混作图 5 的建筑 X/Y。仪器风角 0° 为南风、90° 为东风，东北端有效风角 120–150° 对应来风方位 60–30°，不能据此写成桥轴方位 120–150°；**72 m 是仪器间距，495 m 是仪器安装高度**，均不能替代观光桥尺寸。[原论文 PDF，第 2、3 页](https://pdfs.semanticscholar.org/9d06/3ff5a68918084258cfd5e5fcd51159f4f45d.pdf#page=3)

### 97F、100F 与冠部的连接

逐层图的 98F、99F 为分开的两端空间，100F 则重新连成窄长桥；剖面在 100F 上方继续画有结构/设备冠部。建成仰照中，100F 的连续桥底直接接到两侧塔肢，形成上方洞口边界。因此桥不应作为悬在洞内、上下另留空隙的独立细横梁；也不能将 474–492 m 的所有空间都当作观光室。[KPF 剖面](https://e1.nmcdn.io/assets/kpf2024/wp-content/uploads/imported-files/Shanghai-World-Financial-Center_P2R-1440x1613.webp)、[KPF 实拍](https://e1.nmcdn.io/assets/kpf2024/wp-content/uploads/imported-files/Shanghai-World-Financial-Center_P3.webp)

100F 可分别表达桥底/楼板、狭长侧面玻璃带、端部塔肢和上方冠部，再让洞口内表面与它们闭合相接。不得用一整张面封住洞口，也不应把边框重复叠成第二条桥。

IMA 实拍中，前景 97F 玻璃顶有连续白色构件，较粗的横向框与两侧纵向支承可分辨；上方是 100F 桥底，端部幕墙将两层关系连起来。业主文字确认 97F 玻璃顶可开启，但具体开启分段、机构和顶点标高未核得。[IMA 实拍](https://imae.co.jp/wp-content/uploads/2008/01/w_swfc-4.jpg)、[业主 2009 年公告](https://www.mori.co.jp/press/release/post_202/)

### 可见材料与分格

KPF P3 与 IMA 第 4 张照片均能辨认桥底规则矩形板块和边框，中央有较暗的窄带，两侧有较亮的板块；远侧还有连续玻璃带。照片不能单独证明每块板的透光构造。业主项目册则明确描述 100F 的三条透明玻璃地板，支持保留透明区域，但不足以据此确定桥底每一格的材质对应关系。[业主项目册印刷页 12](https://www.swfc-shanghai.com/pdf/swfc_project_brochure_cn.pdf)

因此可先恢复桥底分格、细金属边及侧面玻璃带，避免整块厚实金属封板的观感。精确分格数量、间距、玻璃透过率和金属颜色均保留估算标记；本轮不作夜景亮度标定。

ArcelorMittal 第 34 页俯照还显示，冠部最上方有沿长轴延伸的设备槽和多组白/浅灰设备，两侧边缘与中间槽存在高度层次，不能用一张平盖完全替代。照片支持这些构件的存在，不足以确定设备型号、准确数量或槽深。[原册第 34 页](https://constructalia.arcelormittal.com/files/5_3_1_HISTAR_web--01d1dbea37a973eac1d0153ef74c1d7e.pdf)

## 已核对的现有实现缺陷

以下是 **2026-09-10 读取到的既有生成代码**，不是对正在编辑的 `.blend` 未保存状态作推断。主流程应先导出当前源工程截面与对象报告，确认目标对象仍采用这些形状后再应用修订，避免覆盖此前成果。

| 位置 | 已核对的现有表达 | 与资料的差异 |
| --- | --- | --- |
| `core/packages/client/app/[lang]/space/space-shanghai-supertalls.ts` 的 `financialCenter()`，约 121–158 行 | `halfWidth` 与 `halfDepth` 生成始终同轴的矩形截面；逐层只缩小宽深 | 不能形成 KPF 平面显示的方形→对角六边形→窄长桥关系 |
| 同函数的 `444..477` 洞口及上下盒面 | 洞口下方 444 m、上方 477 m；上缘是一块厚 0.18 m 的横面 | 这些数值是旧估计。与 100F 楼面 474 m 的锚点结合，旧形状没有正确表达位于洞口顶部的有使用空间的观光桥；不能仅把 477 改成 474 后视为修复 |
| `design/space/scripts/refine_shanghai_landmarks.py` 的 `swfc()`，约 78–120 行 | 重复同一 `width/depth/portal`，在 477.14 m 等位置补细杆和洞口饰条 | 幕墙和薄饰条无法补出真实观光桥、97F 顶框及上方冠部层次；更换外壳时必须同步检查旧杆件是否穿洞、悬空或遮挡 |

按旧生成公式复算，474 m 处外包矩形约为 **50.29 × 16.62 m**，其最长平面对角约 **52.97 m**，无法容纳按 55 m 表达的直线观光走廊。55 m 本身为约数，因此这项检查是恢复正确外壳尺度的强提示，不能单独用来反推冠部外宽或对角包络曲线。

## 尚未核定的项目

- 100F 桥底绝对标高、楼板厚度、观光室净高，以及其上结构/设备层的准确边界。
- 97F 玻璃顶顶点高度、局部坡度、开启分段和外沿尺寸；旧 444 m 仍是估算。
- 顶桥外包长宽、两端塔肢厚度、洞口上下净宽及曲面准确函数。
- 顶桥东北—西南对角已核定，candidate07 旋转和网页三视点查看已执行；精确方位、北箭头基准与出版图形误差未核，约 38.19° 保持估算。
- 裙楼体量、近地面视线遮挡与塔体/地面衔接仍为简模状态，candidate07 近地面截图不构成准确度验收。
- 桥底板块数、透明区与结构层的对应关系、玻璃和金属物理参数。
- 摄影机内参、拍摄位置、实际夜间灯位与光度；现有照片不能提供这些测量。

## 下一轮检查清单

1. 记录当前源工程指纹、SWFC 根变换、累计对象 ID、各高度真实截面和旧杆件归属；只针对实际存在的旧形状修订。
2. 以 candidate07 已旋转的东北—西南长轴继续输出底层、办公中层、97F、98/99F、100F 和冠部俯视截面，对照 KPF 图检查收削与连通关系；继续完善裙楼和地面衔接，独立复核尺寸，并对后续候选重跑全城合同检查。曲线、宽度和约 38.19° 方位继续写入 `estimated`。
3. 用 492 m 总高、423/439/474 m 楼层锚点检验垂直关系；明确楼面、顶棚、桥底和洞口边界分别是什么，海拔 477.96 m 不进入同一地上高度计算。
4. 正面、斜侧、窄侧和从 97F 向上的近景均要实际打开审图：顶部桥连接两端，桥底形成洞口上缘；97F 顶框可见；洞口无错误封面、穿洞幕墙杆或多余中间桥。
5. 检查 100F 侧面玻璃带、桥底分格和上方冠部的厚度层次；不要用放大的金属条掩盖尺度问题。远景另查轮廓及分格摩尔纹。
6. 候选通过后再由主流程保存源工程、正常导出 GLB，并在网页实际日景和夜景复查同一组视角，记录候选/正式状态。当前档案不提前标记该步骤通过。

## 本地证据索引

本轮复用 `.tmp/png/space-lujiazui-audit-20260910/` 已有参考；工作笔记为其中的 `swfc-top-geometry-research.md`。本轮实际打开的文件为：

- 图纸与渲染：`museum-swfcsections.jpg`、`museum-swfcelevations.jpg`、`kpf-p2r.webp`。
- 建成照片：`kpf-p1.webp`、`kpf-p2l.webp`、`kpf-p3.webp`、`kpf-p4.webp`、`ima-swfc-1.jpg` 至 `ima-swfc-6.jpg`。
- 业主原页渲染：`owner-brochure-05.png`、`owner-brochure-06.png`、`owner-brochure-p07.png`、`owner-brochure-p11.png`、`opening-p02.png`、`opening-p13.png`。
- 原文件及文字：`swfc-owner-brochure.pdf`、`swfc-owner-brochure.txt`、`mori-opening-20080828.pdf`、`museum-swfc.html`。

已下载文件的字节数和 SHA-256 记录在同目录 `download-sha256.json`；本轮已复算下列本地文件，并联网核得业主项目册当前响应与本地文件字节摘要一致。关键原文件摘要如下，便于临时目录丢失后核对重下载版本；这些文件未作为正式资产加入仓库。

| 文件 | SHA-256 |
| --- | --- |
| `swfc-owner-brochure.pdf` | `4fede1f295b99e23d2bacd523ce7afe38a3be1e7a94420bca0fffb0af8c9e3dd` |
| `mori-opening-20080828.pdf` | `94138363a6846beef2d54b1ee108dd3bacb927af970d14447e46a0c9d1b3ef04` |
| `museum-swfcsections.jpg` | `9673eb3f7718f213402a337daa6a5d396d0d123a56718a2c423ea6bfe28d4168` |
| `kpf-p2r.webp` | `68a4c539f9bb9bb5cdc31a919ef933b8ad9c783bc2d2a302cb824776d11df0e5` |
| `kpf-p3.webp` | `2735633ff88d93687c566c4202e3fb4bbf30f7deffedb80d88155e38f984290d` |
| `ima-swfc-4.jpg` | `37d91d0d93cf4f5551fcbe367eeeb202ef92e30b70c2b011716f02fbf7cc99da` |

本轮方向补查另存于 `.tmp/png/space-swfc-top-20260910/references/`：

- `owner-standard-plan-north.png`：从同一业主 PDF 第 11 页矢量内容渲染的主平面和北箭头，保留原图方向。
- `owner-web-standard-plan.png`：[业主办公页](https://www.swfc-shanghai.com/building_office.php?l=en)发布的同类标准层图，实际打开确认；该版本没有北箭头，不用于独立定方位。SHA-256 `3dca0b548e9f7e77a8bef1d15a1d9d042771866de25fcfd2f7ad42892bd46019`。
- `arcelormittal-histar-2020.pdf` 与 `arcelormittal-p34.png`：原册及第 34 页本地渲染。原 PDF 为 4,498,715 字节，SHA-256 `f2e3c9df2c0d5d8f7db700637c50746eda3a7e02321053c40fbd76e3d7ba4d0d`。
