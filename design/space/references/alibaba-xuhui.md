# 阿里巴巴徐汇滨江园区 X / Y / Z

三个地块分别建模：南侧 X 区艺岛为七栋倾斜塔楼，中部 Y 区为 Foster + Partners 已建主楼，北侧 Z 区依据 SOM 于 2022 年公布的方案。X/Y 使用建成照片，Z 尚未核实当前竣工状态，网页明确标为“Z 区方案”，不能把设计渲染称为实物复刻。版本为 `alibaba-xuhui-y-20260912` 与 `alibaba-xz-20260912`，查阅日期 2026-09-12。

## 实拍与尺寸依据

| 来源 | 日期 | 用途与限制 |
| --- | --- | --- |
| [上海徐汇官方：西岸艺岛亮相](https://m.thepaper.cn/baijiahao_9917546) | 2020-11-09 | 龙耀路 8 号；七栋不同倾斜程度的塔楼。对照已建地面照片和航拍的七翼关系、折线轮廓、密集水平金属遮阳和中央室外空间；未提供测绘层高 |
| [SOM 官方：Alibaba Shanghai Campus](https://www.som.com/news/som-designs-dynamic-user-controlled-headquarters-for-alibabas-shanghai-campus/) | 2022-07-25 | Z 区设计说明：交错体块、悬挑、绿化露台、中央庭院、连廊；公布面积约 75,000 ㎡。这是方案资料，不是竣工照片 |
| [SOM 提供的设计图与剖面](https://www.gooood.cn/som-designs-headquarters-for-alibabas-shanghai-campus.htm) | 2022-07-26 | 对照 Z 区鸟瞰、临街立面、中庭与剖面；玻璃竖梃、木色悬挑底面、光伏屋顶、露台种植与中庭 Alibaba 标识。方案图没有实拍日期 |
| [上海市规划资源局：徐汇滨江人工智能产业集聚区](https://ghzyj.sh.gov.cn/sj/20221008/f0f0cd851f8c4708835dac11d2dad17c.html) | 页面标注 2022-08-30 | Y 区四至和 Z 位于 Y 北侧的地块关系；Z 建设工程规划许可证核发于 2022-08-23。URL 目录日期不是正文发布日期；不据此推断现在已竣工 |
| [ArchDaily 竣工项目 / Foster + Partners](https://www.archdaily.com/1020980/alibaba-shanghai-campus-foster-plus-partners) | 发布 2024-09-10，项目标注 2024，拍摄日期未单列 | Fangfang Tian 摄影；对照东南转角、临江立面、底层入口、中庭、屋顶俯拍。银灰铝框、四道水平遮阳、阶梯形空洞、悬挑连廊、屋顶网架、绿化、Alibaba 字样和 D3/D4 入口标识以建成照片为准 |
| [Alizila 设计师访谈](https://www.alizila.com/podcast/redefining-the-workplace-inside-alibabas-new-shanghai-campus/) | 2024-12-11 | 阿里巴巴官方；核对模块化开间、室外协作空间、立面与屋顶开口，非测绘数据 |
| [高层总部办公建筑生态共享空间设计研究](https://journals.nassg.org/index.php/edc/article/download/7859/pdf) | 2025 年，第 5.1 节 | 魏倩、韩贵红；11 层、约 56 m 总高、前两层 5.5 m、其余 4.5 m。案例论文不是竣工测绘或官方 BIM |
| [OpenStreetMap way 792384120](https://www.openstreetmap.org/way/792384120) | 本地已有数据快照，核对于 2026-09-12 | 使用真实建筑平面定位、朝向；原 12 m 高度为 fallback，不能作为主楼真实高度 |
| [Foster + Partners 竞赛方案](https://www.fosterandpartners.com/news/foster-plus-partners-wins-competition-to-design-alibaba-s-new-offices-in-shanghai) | 2020-01-08 | 只用于设计背景，不用早期效果图取代 2024 年竣工实拍 |

照片和设计图仅作本地参考，没有复制到运行贴图。Y 区参考与审查在 `.tmp/png/space-alibaba-20260912/`，X/Z 在 `.tmp/png/space-alibaba-full-20260912/`；网页来源统一维护在 `credits_data.json`，在 Space 的来源列表和关于页展示。六个待替换的 X/Z 旧轮廓单独保留在 [footprints JSON](alibaba-xuhui-footprints.json)。

## Y 区空间与模型

- 原点沿用上海场景 WGS84 `[121.4991, 31.2534]`；Blender 中心 `(-3980.2, -9594.0, 0.12)`，绕 Z 轴约 8.44°。Web 坐标转换为 `(X, Z, -Y)`。
- 平面约 108 × 84 m，8 × 8 个主要开间；层高按论文，屋面与机房轮廓结合航拍估算。开口的精确跨度、幕墙分格、遮阳尺寸、入口字形、机房和灯光参数仍是照片估算，不能称为测绘 1:1。
- 真实几何空洞包括两条中央屋顶槽、底层公共通道、东侧和南侧阶梯形空中花园。幕墙包含深框、薄竖梃、水平遮阳、凹入的玻璃及板缝；屋顶加入机房百叶、通风口、格架和种植。保留原街区、滨江油罐和邻近建筑。
- 原简模属于批量网格 `root/62`。仅按 OSM 九个平面顶点与两层高度匹配并移除 32 个三角形（顶 7、底 7、墙 18）；原网格副本放入不导出的归档集合，其他街区及对象身份保留。
- `spaceId=authored/alibaba-xuhui-y`，按材质合并网格。窗光、线性灯具和招牌复用现有 `shanghai-illumination-uniform-v1` 昼夜系统，不新增独立天气或灯光时钟。

## X/Z 区空间与模型

- X 区 Blender 中心 `(-3955, -9730, 0.12)`、`spaceId=authored/alibaba-xuhui-x`。七栋翼楼各有可编辑父对象，依据 OSM 外轮廓与官方航拍估算内部划分；10–14 层、最高约 60.1 m 是建模估算，不是已核实高度。逐层折线倾斜、密集水平铝翼、竖梃、窗面和百叶分别建模，屋顶栏杆与设备均为参考补充。
- Z 区 Blender 中心 `(-3986, -9479, 0.12)`、绕 Z 轴 -2°、`spaceId=authored/alibaba-xuhui-z`。平面约 128 × 78 m、10 层和 4.9 m 层高为图像估算。模型有 472 个外露幕墙开间、52 格露台；包含贯通庭院、地面通道、悬挑和跨庭连廊、木色底面、玻璃栏板、光伏、种植、座椅、铺地、廊架及 Alibaba 中庭标识。
- Z 窗面使用 Principled transmission、细竖梃及退后约 4.1 m 的简化室内背景，局部桌面与窗帘提供层次；它们不是依据室内施工图重建。照明仍接入同一上海昼夜系统，新增庭院花池边线灯与桥底灯；灯具位置和亮度不是现场标定。
- X/Z 共 67 个材质网格、1,082,375 顶点、318,459 面。按六个旧 OSM footprint 的原顶点和高度精确匹配，仅过滤 `root/13`、`root/14`、`root/63` 的 148 个旧面；原网格副本隐藏归档、不导出。邻近独立建筑、油罐和既有 Y 模型保留，Y 几何摘要在新增前后相同。
- 四条射线分别验证 Z 区中庭和入口无实体堵塞、连廊和悬挑确实存在。它们只证明几何开闭，不能证明实物尺寸或审美达标。

## Z 中庭夜景增量

实际网页近景发现庭院地面偏暗、标识被玻璃遮挡。`alibaba-z-court-light-20260912` 保留原招牌网格与字形，将其移至中庭玻璃前、廊架上方；在 Blender 增加四盏 1,200 cd 庭院灯及两盏 500 cd 标识灯，候选中 2,800 cd 的地面过亮方案未采用。灯具通过既有 `facade_rig.py` 导出，网页按相机选择四组作者灯之一，仍共用六盏近景灯；三组外滩原灯及其他几何、对象身份保持不变。

正式导出后的 21:00 网页已查看，地面和标识可辨，但玻璃、植物、整片园区远景仍需校准。这些灯位和强度是视觉估算，不是竣工灯具资料或现场光度测量。`refine_alibaba_courtyard_lighting.py` 已完成候选核对、备份与保存；已有灯组时拒绝重复应用。

## 玻璃、室内、植物与 Y 中庭增量

2026-09-12 再次对照上述 2024 年 Y 竣工项目中的 [Fangfang Tian 玻璃与室内照片](https://images.adsttc.com/media/images/66df/6202/3b3d/046f/5660/b2d1/medium_jpg/alibaba-shanghai-campus-foster-plus-partners_11.jpg?1725915668)（本地 `reference-7.jpg`，拍摄日期未知）和 SOM 2022 年 Z 方案图（本地 `z-3.jpg`）。可见玻璃后的办公层次、百叶及庭院种植用于调整画面，不据此虚构完整工位平面或灯具测量数据。

- Y 区 496 个外露开间的简化后墙退后约 4 m，2,112 段室内顶灯后移 1.68 m，加入 992 张简化桌面、座椅、屏幕与局部百叶。三块地的 675 个原树冠改为每冠 140 个折叠叶簇，六个对象身份、树位和树干保留；叶簇仍是有折面的简化几何，新增面数与资产体积需要后续分级优化。
- 首轮网页玻璃仍偏乳白，第二轮将 Y 玻璃粗糙度调为 0.012、透射 0.98、IOR 1.45 并剔除背面；Z 玻璃粗糙度 0.045、透射 0.94。第三轮将 Y/Z 室内背景昼夜照明倍率降至 0.2，使其与檐底灯带区分。以上为视觉调校参数，不是实测物理材料。
- 第四轮补 Y 中庭六盏 850 cd 庭院灯，原生作者灯随 `alibaba-y-court-light-20260912` 保存；既有四组作者灯保持不变，现共五组，仍复用同一六灯池。正式网页核对 Y/Z 近景切换和白天关灯，并逐张查看最终近景与全景。灯具位置和照度尚未按实物校准。

`refine_alibaba_glazing.py` 的首轮预览与 `--apply` 完成后，依次运行 `--polish-glass` 预览/保存、`--balance-night` 预览/保存；随后使用既有 `refine_alibaba_courtyard_lighting.py --district y` 预览/保存。该灯脚本默认仍为原 Z 轮次。**当前四步已应用，不要重新运行**；既有修订、候选报告和源指纹守卫会拒绝重复或基于旧工程保存。后续继续从当前规范工程增量编辑。

四轮报告、备份和最终网页截图位于 `.tmp/png/space-alibaba-refinement-20260912/`，保存结果及资产版本见[迁移跟踪最新记录](../../../docs/space-blender-tracker.md)。照片仍仅作参考，没有新增运行贴图或第三方代码来源。

## 树冠与硬质景观材质增量

2026-09-12 使用下列原始 PBR 资源替换三块园区的粗大叶片，并细化树干、树池和铺地；查阅与下载日期均为 2026-09-12。资源页未核实精确发布日期，不把下载日期写成拍摄日期。两项来源已加入网页“来源与致谢”，没有引入第三方建模代码。

| 来源 | 作者、许可 | 实际用途与限制 |
| --- | --- | --- |
| [Poly Haven Tree Small 02](https://polyhaven.com/a/tree_small_02) | Rico Cilliers，CC0 | 原始叶片颜色、透明遮罩、OpenGL 法线、树皮颜色。该树为 Burkea africana，不是已经确认的园区树种；树皮另作树池覆盖物代理，没有宣称为现场土壤扫描 |
| [Poly Haven Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02) | Rob Tuytel，CC0 | 仅使用法线与粗糙度，按 2 m 尺度重复，保留园区原有石材底色；不是现场铺地采样，未采用其带苔藓的颜色贴图 |

下载清单来自 [树模型 API](https://api.polyhaven.com/files/tree_small_02) 和 [混凝土地面 API](https://api.polyhaven.com/files/concrete_floor_02)。以下原始 PNG 保持不变，候选脚本按 MD5 验证内容；保存时打包进 `.blend`，日常导出不依赖临时下载目录。

| 临时目录内文件 | 上游 1K 文件 | MD5 |
| --- | --- | --- |
| `leaves_diff.png` | `tree_small_02_leaves_diff_1k.png` | `2c667193084725e8553062ddbdc73c7d` |
| `leaves_alpha.png` | `tree_small_02_leaves_alpha_1k.png` | `63199ba87a9e8928424bd8c3b8017bd0` |
| `leaves_normal.png` | `tree_small_02_leaves_nor_gl_1k.png` | `e81c5d7e7fc09af321e8c5ac5b4948f2` |
| `branch_diff.png` | `tree_small_02_branch_diff_1k.png` | `2da9ea379228636c4fda2fde9a11d760` |
| `concrete_rough.png` | `concrete_floor_02_rough_1k.png` | `1828b2884b6dc899704410f74b35b2be` |
| `concrete_nor_gl.png` | `concrete_floor_02_nor_gl_1k.png` | `fe71a8ff06acc83aadfdd694a42acfd6` |

- 六个原树冠对象、675 个树冠的位置保留；每冠 140 片四边形枝叶面，透明阈值 0.45。UV 只用图集左侧枝叶，排除右侧树皮；叶面法线强度 0.32，粗糙度 0.78，不增加自发光。三角面从 378,000 降为 189,000。
- 首轮检查叶片轮廓与贴图；第二轮将枝叶面放大 15%，增加树池内凹和地面细节；第三次候选修正树冠圆滑法线，再查看 Y 日夜与 Z 中庭。预览工具曾遗漏拷贝材质底色，已纠正后复看，临时预览结果不替代正式资产验证。
- 79 个原实心树池改为有壁厚的开口，X/Y/Z 分别 3/44/32 个；外轮廓保持，种植面低于边沿 0.12 m。覆盖物面复用树干网格，未增加运行对象或作者灯组。14 个景观对象补 UV，铺地法线强度 0.18；树皮按 0.65 m 尺度重复。
- 暗部树冠仍偏暗，缺少叶片透光和枝干细节；树种、树池壁厚、种植层、铺地纹理与尺度仍是视觉近似。没有将本轮记为测绘 1:1 或电影级完成。

首次增量脚本为 `refine_alibaba_landscape.py`。原始资源放到 `.tmp/png/space-alibaba-leaf-20260912/` 后，在旧规范工程上依次以 `--round 1`、`--round 2` 生成临时候选；审图通过后用同一源指纹与脚本的 `--round 2 --apply` 备份并保存。**本批已应用后不得再次应用**；`spaceAlibabaLandscapeRevision=alibaba-landscape-20260912` 阻止重复。后续编辑当前工程并正常导出，保存、文件大小与正式网页证据见跟踪文档最新记录。

## 后续编辑

`refine_alibaba_campus.py` 是 Y 区首次增量脚本，`refine_alibaba_districts.py` 是 X/Z 首次增量脚本，默认只生成候选；`--apply` 先备份并校验磁盘源未被他人修改，再保存规范工程。工程已有对应修订时拒绝重建，避免覆盖人工编辑。X/Z 脚本还要求 Y 已存在并校验其几何未变。日常继续编辑当前 `design/space/scenes/shanghai.blend`，然后运行 `batch.ps1 -Asset shanghai`；不要回用新增园区之前的整城候选覆盖现有工程。

Blender 预设相机：`Alibaba whole campus`、`Alibaba X Art Tower`、`Alibaba campus`、`Alibaba courtyard`、`Alibaba Z campus`、`Alibaba Z courtyard`。网页对应“阿里园区全景”“X 区艺岛”“Y 区主楼”“Y 区中庭”“Z 区方案”“Z 区中庭”。实际保存、导出和网页审查结果以 [迁移跟踪](../../../docs/space-blender-tracker.md) 最新记录为准。

剩余精度项：X 的测绘高度和准确折线、Z 的竣工状态与现场照片、完整下沉庭院和地下楼梯、真实室内、招牌字体、灯具实测配光、现场贴图、道路与植物细节。当前覆盖三个地块及公共空间，但这些构件仍有估算，不标记测绘 1:1 或电影级完成。
