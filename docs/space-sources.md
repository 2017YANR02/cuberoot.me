# 魔方空间技术来源索引

更新日期：2026-09-08；下表技术版本核对日期仍分别保留。魔方空间页面底部“本页来源与建模说明”默认展开，直接展示各项目链接、用途及上海轮廓拉伸和高度估算说明，也可收起；“查看全站致谢”进入 `/about`。公开致谢的唯一数据源是 [credits_data.json](../core/packages/client/app/[lang]/about/credits_data.json)，`space: true` 标记本页使用的条目。本文件记录技术版本、实际用途和未接入的边界，不维护第二份产品致谢列表。

| 来源 | 版本与日期证据 | 实际使用及本地位置 |
| --- | --- | --- |
| [Three.js](https://github.com/mrdoob/three.js/tree/r183)，MIT | 当前安装版本 `0.183.2`；本轮核对于 2026-09-07 | 同一个 WebGL 渲染器、OrbitControls、TransformControls、物理材质、Reflector、Water 和后期处理。滚轮与滑块在环绕模式控制相机距离，在无人机和漫游模式控制镜头视角，不改变物件尺寸。江水法线图固定为 r183，来源与 SHA-256 在下方 SOURCE 清单；本站在 Water 材质上增加水色预设和漫反射着色，保留倒影与高光 |
| [ABYSSAL / natural-disasters](https://github.com/Token-Gremlin/natural-disasters/tree/d2bae38301ff43bc1d43bfdfd9477a552ca5420b)，MIT | 本地记录固定提交 `d2bae38301ff43bc1d43bfdfd9477a552ca5420b`；2026-09-07 核对本地来源记录，本轮未重新比对远端整树 | 大气、体积云、雨幕、分叉闪电、龙卷风、FFT 海浪、白沫及 GPU 飞沫。逐项适配及保留范围见 [UPSTREAM.md](../core/packages/client/app/[lang]/space/abyssal/UPSTREAM.md)；许可证在同目录。雪、冰雹、扬尘、泥石流、彩虹、表面湿润和岛屿轮廓为本站实现，未宣称全部来自上游 |
| [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)，ODbL 1.0 | 本地提取日期 2026-09-07；各响应和对象具有各自更新时间 | 黄浦江及双岸、徐家汇方向的水域、建筑轮廓、道路、绿地。原始缓存不发布；[生成脚本](../core/scripts/build-shanghai-space.mjs)和 [SOURCE.json](../core/packages/client/public/assets/space/shanghai-v1/SOURCE.json)记录实际范围、原点、快照、楼高缺失率与水纹来源。使用 WGS84 投影，不混入偏移地图坐标；缺少楼高时使用 12 米默认值 |
| [Poly Haven](https://polyhaven.com/license)，CC0 | 本轮核对现有资产清单于 2026-09-07；此前逐项下载日期未记录，不补写为本轮下载 | 本地 `public/assets/space/v1/`、`v2/` 中的环境光、石材、木地板、织物、沙发、扶手椅、抱枕和植物。资产名见公开致谢的 Poly Haven 条目。运行时不依赖外部 CDN |
| [Car Concept](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept)，CC BY 4.0 | Eric Chadwick / Darmstadt Graphics Group，2024；原下载提交与日期未记录 | 本地 `public/assets/space/v3/car-concept.glb`，用于车库；本站调整尺寸及玻璃渲染，原作者与模型贴图来源保留在公开致谢 |
| [huazhechen/cuber](https://github.com/huazhechen/cuber) | 沿用仓库现有 `/sim` 移植，未在本轮重新下载或复制一份引擎 | `/space` 直接复用 `/sim` 已有魔方模型与转动逻辑。现有移植的精确上游版本未在本轮追溯；本轮时间、地图和缩放改动不更新魔方引擎 |
| [NOAA 太阳位置公式](https://gml.noaa.gov/grad/solcalc/solareqns.PDF) | 查阅于 2026-09-07 | `space-weather.ts` 参考时角、天顶角公式，固定上海纬度、春秋分和地方太阳时，输出太阳方向与昼夜过渡。未接入 NOAA 软件库，也未实现日期、时区、均时差和大气折射校正，不等于上海当天的精确日出日落 |

## 时间与地址核对

- 彩虹为本站的天空着色器，按观察方向与太阳相反方向之间的夹角绘制色带；随相机移动保持视角尺寸，夜间隐藏。黄浦江的七种水色也是本站扩展，随布局保存，风暴会压暗所选水色；没有引入新的第三方天气或水体库。水色预设是视觉外观，不表示实际水质测量或水化学模拟。
- 场景时间保存为 `HH:mm`，允许 00:00–23:59 的全部 1,440 个分钟值；随布局撤销、重做、导出、导入和刷新恢复。原生时间输入的显示格式跟随浏览器设置。时间变更驱动太阳、阴影、天空/镜面环境光和城市窗光，不重置海洋/天气动画。没有自动流逝的日历时间系统。
- 2026-09-07 使用[高德公开地点页](https://www.amap.com/place/B00153A3C8)核对“徐家汇花园”的名称和宛平南路255弄地址；坐标使用 [OSM way/1442066946](https://www.openstreetmap.org/way/1442066946)的住宅边界。未复制高德瓦片、贴图或偏移坐标。用户所写“徐家汇家园”是否指该地点尚待确认；当前机位以“徐家汇”命名，不记录与某位个人的关联。
- 用户提供的公司实拍只作为此前建模参考。个人姓名、具体住宅房号和联系人信息不作为本轮公开地图数据。

## 建筑与桥梁资料

2026-09-07 新增建筑和桥梁研究来源，已进入网页统一来源列表。南浦/卢浦采用上海市土木工程学会公布的主桥尺寸及照片，外白渡采用上海市档案馆的结构形式和尺寸，汤臣一品对照开发商实拍，和平饭店对照上海市政府建筑沿革。具体数值、对象 ID、估算项、尚未下载的模型及逐栋清单见[上海精细复刻跟踪](shanghai-replica-tracker.md)。这是本站几何重建，未移植现成上海模型库，也未把参考照片作为在线贴图。外滩官方建筑名录仅用于待办研究，不代表整组建筑已经完成。

2026-09-07 第二批补充两份建筑资料：新华社 2025-10-01 江海关现场报道提供 79.2 m 总高及钟楼照片；乐游上海图文（2022-01-20 经澎湃号转载）用于汇丰六柱门廊、八角塔楼、穹顶与石材层次的对照。链接、用途和查阅日期已写入唯一致谢数据源并在 `/space` 显示。江海关中间层高与钟径、汇丰暂取的 46.3 m 总高均有未校准部分，不能视为测量结果。

汤臣新增五处裙房使用已有 OSM 轮廓，保留地图中的泳池；立面、层高及四组庭院植栽为本站估算，开发商资料尚不能证明花园 1:1。江海关四面指针复用场景 `HH:mm` 时间，没有接入外部时钟库。参考照片仅用于本地审图，本批没有新增模型、纹理下载依赖或运行时外部 CDN。三轮审图及尺寸边界见[第二批跟踪](shanghai-replica-tracker.md#第二批江海关汇丰与汤臣裙房庭院)。

2026-09-07 第三批继续依据上述两份现场图文，细化汇丰与江海关的正面窗洞、拱门铜格栅、窗楣、窗间板及钟楼百叶；各开间和窗洞深度尚未按测绘校准。新增查阅 [Three.js 官方阴影文档](https://threejs.org/manual/en/shadows.html)，用于缩小近景阴影覆盖、提高相同阴影贴图的空间精度。公开来源条目仍集中在 `credits_data.json`，两种语言的 `/space` 均已实测可见。开洞墙体、程序化石材和夜间洗墙为本站实现，未移植新建筑库或下载运行资产；洗墙没有现场灯具校准，不是物理照明的 1:1 证据。三轮审图和测试见[第三批跟踪](shanghai-replica-tracker.md#第三批外滩窗洞石材与近景阴影)。

2026-09-07 第四批补充设计与夜景资料：SOM 的金茂日夜实拍、摩天楼博物馆引用的分段规则、金茂业主 2014 年招股资料、Gensler 上海中心幕墙设计研究、KPF 与环球金融中心官网，以及上海绿色照明发展报告 2022、2010 年外滩地面四车道改造报道。八项链接、用途和查阅日期加入唯一公开来源数据，`/space` 中英文实测有 24 个外部来源链接；不另建产品来源副本。

三座超高层为本站 Three.js 几何重建，共 13 份 Mesh：金茂总高依据业主资料、分段序列依据设计规则推导；环球顶部开口为真实贯通几何；上海中心参考圆角三角形、120° 扭转及图 4 的收窄比例。Gensler 文件是设计阶段研究，不能称为竣工模型；三塔平面、层高、塔冠、幕墙和灯光仍有估算。SOM 图片上传路径中的年份不能当作照片拍摄日期。

照明报告印刷页 41–42 用于外滩暖色层次、绿色铜顶和金色穹顶的形态参考，不代表当天亮灯状态或现场测得色温。街道复用 OSM 道路、步行线与既有材质管理，附件合并为 6 份 Mesh；路宽、铺装及灯具均为估算。上述照片和 PDF 仅在本地忽略目录用于审图，未作为运行贴图，也未引入新的开源建筑库或在线模型服务。详细实测与限制见[第四批跟踪](shanghai-replica-tracker.md#第四批外滩街道分层夜景与上海三座超高层)。

2026-09-07 第五批对照 [Asisbiz 外滩摄影集](https://www.asisbiz.com/China/The-Bund.html)的 20 栋实物照片，重建此前通用底模的主立面与屋顶；每栋的独立链接、用途、估算边界和查阅日期均加入 `credits_data.json`。图库中的水彩画未作为实拍依据，照片年代也不代表今天的立面或亮灯状态。格林邮船资料收录在北京东路 2 号；英国领事馆用明确标注的旧馆照片并对照上海文旅资料区分主楼与官邸，未采用邻近半岛酒店的照片。

另依[文汇报 2019 年报道](https://wenhui.whb.cn/third/yidian/201911/15/303082.html)的建成实拍补外滩 15-1 号，不采用同图上方未建竞标方案。网页来源区现有 45 个外部链接，中英文 320px 实测可见。新楼共 21 组，合并 103 份 Mesh；本站手工编写 Three.js 几何，OSM 平面加照片估算垂直尺寸，未接入新的 GitHub 建筑库。所有参考照片仅用于本地审图，未复制为产品纹理或在线资源；公开摄影来源说明不等于取得图像再分发授权。逐栋依据、审图截图和剩余准确度缺口见[第五批跟踪](shanghai-replica-tracker.md#第五批外滩逐栋实拍重建)。

2026-09-08 第六批增加[上海市政府转载的外滩日常亮灯报道](https://www.shanghai.gov.cn/nw4411/20260820/f441a5da943447e79613ab4d5dbcc0a5.html)与[新华社王翔 2025-12-31 夜景实拍](https://www.xinhuanet.com/photo/20251231/f4a640207f67437c86c2d5db1b82644c/c.html)，网页来源现有 **47 个外部链接**，中英文 320px 实测可见。约 2000K 日常暖金照明只作为色彩依据，跨年照片的红色活动灯幕不当作常态；未取得现场灯位或光度数据。两份照片仅本地审图，不作为在线贴图。

本批没有新增 GitHub 项目：城市窗光图集、道路光池、江岸设施和夜景参数为本站实现；江面仍复用 Three.js r183 Water / Reflector 及已下载法线图，新增多尺度法线混合、夜间散射和反射分辨率调整。ABYSSAL 天空与场景雾的地平线衔接属于本站适配，记录在其 `UPSTREAM.md`。中央江岸位置来自既有 OSM 水域，断面和灯具为估算。详细审图、47 项回归及仍未通过的游戏级画质要求见[第六批跟踪](shanghai-replica-tracker.md#第六批上海夜景雨夜地平线与江面反射)。

## 外滩实拍招牌与本地字形

2026-09-08。补充[和平饭店实拍照片](https://n.sinaimg.cn/sinakd20119/320/w717h403/20220831/51c5-e438a768e27ecac8115bad5575bd3b71.jpg)、[原汇丰大楼游客实拍](https://you.ctrip.com/sight/shanghai2/1831446.html)及[文泉驿微米黑](https://sourceforge.net/projects/wqy/files/wqy-microhei/)三个来源，并为既有 11 条 Asisbiz 逐栋来源增加招牌文字、用途、日期与精度说明。网页共 50 个外部链接，中英文 320px 已实际查看；来源只维护 `credits_data.json`，没有另建产品数据副本。

当前 16 栋招牌是本站 Three.js 实体几何，复用官方 TTFLoader / FontLoader / ExtrudeGeometry。字体来自仓库已有 `public/fonts/wqy-microhei.ttf`，由 `scripts/build-shanghai-sign-font.mjs` 按 `space-shanghai-signs-data.json` 提取 70 字形，生成 39,734 字节的 `public/assets/space/shanghai-v1/sign-font.json`；原字体作者与 Apache-2.0 元数据保留，完整许可在相邻 `sign-font.LICENSE.txt`。生成命令及所有权已登记 `docs/generated-artifacts.json`，改招牌文字需重跑生成脚本，不能手改生成字形。

同日第二批对照 Asisbiz 6、18、27 号实拍：增加 DOLCE&GABBANA、Cartier、Ermenegildo Zegna、THE HOUSE OF ROOSEVELT 和 ROLEX 文字；6 号底层改为十一处圆拱，18 号底层改为五个橱窗与入口，27 号补绿色下窗。和平饭店的新浪参考照片用于修正弧顶双面灯牌、中英并列竖排以及临江较亮、侧翼较暗的照明分布。橱窗、灯光、尺寸仍为近似，未补品牌专用字体或皇冠等图形。三个摄影页面的实际拍摄日期未确认，公开来源均注明不能据此推断当前租户。

照片只供本地审图，未成为运行贴图或外部加载依赖。字体为通用字体，品牌专用字形、图形商标、招牌尺寸、灯位、夜间亮度和部分位置尚未实测。历史照片也不能证明当前租户或当天亮灯情况；没有从建筑历史名称推断今天的招牌。来源可追溯不表示所有招牌或建筑已 1:1 复刻。逐栋覆盖、三轮审图及验证限制见[第八批跟踪](shanghai-replica-tracker.md#第八批实拍招牌与入口)。

## 调研但尚未接入

[CesiumJS](https://github.com/CesiumGS/cesium)、[MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) 和 [NASA 3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS) 的历史星数、候选用途和取舍在[上海跟踪文档](shanghai-huangpu-space-tracker.md)。当前运行时没有安装它们，也没有获取上海全段摄影测量 tileset。已调研而未成功下载的模型不能列作已集成资产。

当前海浪、粒子和程序化建筑仍有[海洋视觉缺口](cube-space-tracker.md)及[上海建模缺口](shanghai-huangpu-space-tracker.md)。来源可追溯与交互测试通过不等于电影级近景通过。
