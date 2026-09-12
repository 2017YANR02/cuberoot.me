# 阿里巴巴徐汇滨江园区 Y 区

本轮重建 Foster + Partners 设计的 Y 区主楼。X 区（SANAA）和 Z 区（SOM）是不同项目，不把它们的照片或建模进度混入这栋楼。版本 `alibaba-xuhui-y-20260912`，查阅日期 2026-09-12。

## 实拍与尺寸依据

| 来源 | 日期 | 用途与限制 |
| --- | --- | --- |
| [ArchDaily 竣工项目 / Foster + Partners](https://www.archdaily.com/1020980/alibaba-shanghai-campus-foster-plus-partners) | 发布 2024-09-10，项目标注 2024，拍摄日期未单列 | Fangfang Tian 摄影；对照东南转角、临江立面、底层入口、中庭、屋顶俯拍。银灰铝框、四道水平遮阳、阶梯形空洞、悬挑连廊、屋顶网架、绿化、Alibaba 字样和 D3/D4 入口标识以建成照片为准 |
| [Alizila 设计师访谈](https://www.alizila.com/podcast/redefining-the-workplace-inside-alibabas-new-shanghai-campus/) | 2024-12-11 | 阿里巴巴官方；核对模块化开间、室外协作空间、立面与屋顶开口，非测绘数据 |
| [高层总部办公建筑生态共享空间设计研究](https://journals.nassg.org/index.php/edc/article/download/7859/pdf) | 2025 年，第 5.1 节 | 魏倩、韩贵红；11 层、约 56 m 总高、前两层 5.5 m、其余 4.5 m。案例论文不是竣工测绘或官方 BIM |
| [OpenStreetMap way 792384120](https://www.openstreetmap.org/way/792384120) | 本地已有数据快照，核对于 2026-09-12 | 使用真实建筑平面定位、朝向；原 12 m 高度为 fallback，不能作为主楼真实高度 |
| [Foster + Partners 竞赛方案](https://www.fosterandpartners.com/news/foster-plus-partners-wins-competition-to-design-alibaba-s-new-offices-in-shanghai) | 2020-01-08 | 只用于设计背景，不用早期效果图取代 2024 年竣工实拍 |

照片仅作本地参考，没有复制到运行贴图。下载清单、11 张参考、地图定位及审查产物在 `.tmp/png/space-alibaba-20260912/`；网页来源统一维护在 `credits_data.json`，在 Space 的来源列表和关于页展示。

## 空间与模型

- 原点沿用上海场景 WGS84 `[121.4991, 31.2534]`；Blender 中心 `(-3980.2, -9594.0, 0.12)`，绕 Z 轴约 8.44°。Web 坐标转换为 `(X, Z, -Y)`。
- 平面约 108 × 84 m，8 × 8 个主要开间；层高按论文，屋面与机房轮廓结合航拍估算。开口的精确跨度、幕墙分格、遮阳尺寸、入口字形、机房和灯光参数仍是照片估算，不能称为测绘 1:1。
- 真实几何空洞包括两条中央屋顶槽、底层公共通道、东侧和南侧阶梯形空中花园。幕墙包含深框、薄竖梃、水平遮阳、凹入的玻璃及板缝；屋顶加入机房百叶、通风口、格架和种植。保留原街区、滨江油罐和邻近建筑。
- 原简模属于批量网格 `root/62`。仅按 OSM 九个平面顶点与两层高度匹配并移除 32 个三角形（顶 7、底 7、墙 18）；原网格副本放入不导出的归档集合，其他街区及对象身份保留。
- `spaceId=authored/alibaba-xuhui-y`，按材质合并网格。窗光、线性灯具和招牌复用现有 `shanghai-illumination-uniform-v1` 昼夜系统，不新增独立天气或灯光时钟。

## 后续编辑

`refine_alibaba_campus.py` 是首次增量建模脚本，默认只生成候选；`--apply` 会先备份并校验磁盘源未被他人修改，再保存规范工程。工程已有园区修订时拒绝重建，避免覆盖人工编辑。日常继续编辑当前 `design/space/scenes/shanghai.blend`，然后运行 `batch.ps1 -Asset shanghai`。

Blender 预设相机为 `Alibaba campus`、`Alibaba courtyard`；网页为“阿里巴巴园区”“阿里中庭”。实际保存、导出和审查结果以 [迁移跟踪](../../../docs/space-blender-tracker.md) 本轮记录为准。

剩余精度项：真实室内与玻璃透射、下沉庭院完整楼梯、准确招牌字体、灯具实测配光、现场贴图、道路与行道树细节；相邻 X/Z 区尚待分别建模。没有这些证据前不标记整个园区 1:1 完成。
