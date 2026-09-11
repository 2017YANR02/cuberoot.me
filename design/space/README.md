# Space 的 Blender 编辑流程

Blender 是静态场景的编辑源，Three.js 是网页运行引擎。住宅、公司、海岛地形、上海建筑、桥梁和道路从 Blender 导出；可转动魔方、天气、水面、交通、时间与相机保留实时程序。首次迁移保留现有模型，并不等同于完成实测 1:1 建模或电影级美术。

## 文件在哪里

| 内容 | 位置 | Git |
| --- | --- | --- |
| 25 份可编辑原工程 | `design/space/scenes/*.blend` | 后续使用 Git LFS；当前暂缓启用，本地保留并单独备份 |
| 首次导入清单 | `design/space/scenes/*.import.json` | 跟踪首次导入，不代表后续编辑状态 |
| 网页模型、共享纹理 | `core/packages/client/public/assets/space/blender-v1/` | GLB 和纹理单独打包，JSON 清单入库 |
| Blender 软件 | `E:/Apps/Blender/blender.exe` | 仓库外 |
| 首次捕获和导出中间文件 | `E:/CubeRoot-Assets/space/` | 缓存，不是源工程 |
| 检查截图、导出日志 | `.tmp/png/space-blender/` | 临时文件 |

资产名由 8 种风格 `modern / minimal / cyberpunk / vintage / italian / penthouse / japanese / company` 和 3 种环境 `original / island / shanghai` 组成，例如 `italian-island`。另有一份独立的 `shanghai.blend` 城市工程，共 25 份。住宅的 `*-shanghai.blend` 与城市分别加载。

## 日常编辑与查看

1. 用 Blender 打开所需 `.blend`。修改 `AUTHORING` 集合内的模型和材质；`PREVIEW` 是便于编辑的相机、灯光，不导出到网页。若窗口比磁盘文件旧，先确认是否有未保存修改；有修改时另存副本再比较，不直接重新加载或覆盖任一版本。
2. 保存工程。后台导出读取磁盘版本，无法读取尚未保存的界面修改。
3. 在仓库根目录运行指定资产的导出命令：

   ```powershell
   pwsh -NoProfile -File design/space/scripts/batch.ps1 -Asset modern-original
   ```

   导出全部使用 `-Mode all`，仅原环境住宅使用 `-Mode original`，海岛及上海住宅使用 `-Mode variants`，仅城市使用 `-Mode city`。可用 `-Blender` 指定其他安装位置。脚本按顺序运行，最多 14 线程，后台低优先级；不会重新导入或保存覆盖 `.blend`。

4. 刷新 [本地魔方空间](http://localhost:3000/zh/space)，选择对应风格与环境。JSON 清单不缓存，模型 URL 带导出内容哈希；同内容纹理共享文件。
5. 检查外观、室内视角、反射、魔方放置，上海还需检查白天、夜景、交通和水面。文件能导出不代表画面已经合格。

普通网格的移动、缩放、拓扑和 PBR 材质能随导出传入网页。网页专用反射、地形、玻璃和夜景着色由原有 Three.js 材质逻辑接回，Blender 任意节点材质不会自动成为网页 Shader。

## 后台工作，不占用桌面

自动处理默认使用 Blender 后台 Python 和无头浏览器，不激活可见窗口、不发送鼠标键盘输入。批处理隐藏窗口、低优先级，最多 14 线程。预览默认使用 CPU，让显卡留给日常桌面；仍会使用 CPU、内存和磁盘。

保存工程后，可直接渲染某个已有相机：

```powershell
pwsh -NoProfile -File design/space/scripts/batch.ps1 -Asset italian-original -PreviewCamera Bathroom
```

住宅相机可用 `Overview`、`"Living room"`、`Study`、`Bedroom`、`Bathroom`、`Courtyard`、`Garage`、`Cinema`、`Gym`；公司工程预置 `Overview`、`"Living room"`、`Study`、`Courtyard`；城市工程预置 `Overview`、`"Jin Mao"` 和 `"Jin Mao crown"`。图片和日志输出到 `.tmp/png/space-blender/`。预览不会保存修改源工程，也不会导出网页资源。

预览脚本把 `spaceLights` 中的网页面光源转换为临时 Blender Area Light，功率换算用于看清室内，不是现场光度校准。网页反射与专用材质仍需在网页验收，不能用这张 Cycles 图片代表网页画质。

## 场景属性约定

- 保留原对象的 `spaceId`、材质标记、自定义顶点属性与 Scene 的 `space_asset / space_schema / space_contract`。它们标记水面、反射、屋顶、灯光、交通模板及夜景建筑。新增要导出的对象设 `space_export = true`；预览辅助对象不设置。
- 碰撞框和运行灯光分别来自根对象的 `spaceObstacles / spaceLights`；可放置表面由网格的 `spaceSurface` 标记识别。改变房屋布局、墙体或家具占地时，需要同步更新碰撞与灯光数据，并检查表面标记，不能只移动外观网格。改变整个场景坐标会影响网页的预设相机与动态路线。
- 交通模型作为动态实例模板使用；调整其几何后应应用对象变换并检查网页朝向。不要删除动态绑定对象。
- 室内默认相机坐标共用 `core/packages/client/app/[lang]/space/space-room-cameras.json`，Blender 按坐标轴约定转换。`repair_scene_cameras.py` 仅修正首次迁移留下的旧预览相机，保留已被手工修改的位置和朝向；普通模型编辑不需要运行它。
- `capture.ts`、`import_scene.py`、`upgrade_scene.py` 仅用于首次迁移及旧合同升级；日常只使用 `batch.ps1` / `export_scene.py`。不要用旧程序重新生成已手工编辑的工程。

## 验收

### 外滩近景灯光编辑

和平饭店、江海关和汇丰在 `AUTHORING | Bund light rigs (metadata export)` 集合内各有 6 盏原生 SPOT 灯。直接修改灯具的位置、旋转、颜色、Spot Size、Blend 和 Custom Distance；对象自定义属性 `spaceCandela` 控制网页强度，Blender 的 Power 仅用于 Blender 预览，两者没有现场光度标定。灯具是合并多盏现场灯的视觉代理，不能当作实测灯位。

每盏灯保持所属建筑的父子关系及唯一 `spaceFacadeSlot`（0 至 5），不设置 `space_export`。正常导出时 `facade_rig.py` 将当前灯具转换为 Y-up 的 `facadeLighting.lamps`，不保存回源工程；网页复用原有 6 盏带阴影灯。缺灯、重复槽号、错误类型或非法强度会拒绝导出。建筑的 `facadeLighting.centre` 是局部 Y-up 选光中心；`washTop` 控制旧有立面补光退让的高度，0 表示保留绝大部分补光。高处未被近景灯覆盖的石材仍使用原有远景补光。

铜顶材质可用 `spaceRoofWash = { bottom, top, color }` 调整远景补光；高度为网格局部 Y-up 米制坐标，颜色为线性 RGB，必须有限、在 0–1 内且 `top > bottom`。它是网页补光近似，不是 Blender 节点或烘焙结果；改动屋顶顶点或本地原点后同步校准高度。和平饭店当前六灯为四盏绿色坡面代理灯和两盏暖色冠部代理灯，近景屋顶随所属建筑的灯光权重退让，未设置该材质属性的屋顶保持原公式。

镜头转向邻栋时，网页将旧灯和立面补光同步渐变，在近景灯强度归零时换灯位，再渐亮新灯；单程按 0.3 秒计算，低帧率下因帧间隔限幅会延长。过渡使用独立于天气开关的帧时间，完成后停止额外绘制；渐变期间不重复刷新静态阴影。此机制消除整组灯瞬间换位，但没有消除近景灯与远景补光的配光差异，仍须逐栋校准并继续评估烘焙照明。

`author_bund_lighting.py` 仅用于本次首次建立灯组，已有 `spaceFacadeRig` 修订时拒绝覆盖。后续编辑现有灯具并正常导出，务必在网页查看整栋、斜侧、白天和夜间；Blender 预览与网页 PBR 仍有差异。

单栋照明烘焙研究使用 `probe_facade_bake.py`，仅输出到 `.tmp/png/space-light-bake/`，不修改正式城市或网页资产。现已通过单平面数值与 EXR 方向校准；汇丰通过临时焊接副本改善光照 UV 密度，完成 2K / 4K 烘焙及浏览器正面、斜侧、近景对照。4K 明显改善柱身长黑线，但柱头细缝、暗部噪点和阴影边缘仍未通过近景验收。正式接入、反射和完整夜景待验，不能作为正式导出工具使用。复现步骤、技术来源和待验收项见[实验记录](references/facade-baking.md)。

在仓库根运行 `node design/space/scripts/capture-server.mjs`，再用浏览器访问 `http://127.0.0.1:3016/verify`。它检查完整 25 个场景的几何、表面、反射和城市运行绑定，结果在页面和 `window.verification`。单资产可加 `?asset=modern-original`。该检查不需要 GPU，实际光照效果仍须在 `/zh/space` 检查。

打包器检查：`uv run python -m unittest discover -s design/space/scripts -p test_pack_gltf.py`。前端逻辑改动在 `core/` 运行 `pnpm --filter @cuberoot/client typecheck` 及适用的 Space 测试；开发服务器运行时不执行 Next build。

## 备份与发布

2026-09-09 用户确定后续资产版本管理使用 Git LFS，但暂不配置或上传。`.blend` 和必要原始贴图通过 LFS 保存版本，脚本、文档和清单继续普通 Git；`.blend1`、缓存和临时渲染不入库。网页 GLB 和运行贴图按资源发布流程提供，不能把 LFS 当成网页资源地址。恢复资产入库时同步配置 `.gitattributes` 与精确忽略例外，核对 LFS 指针、用量预算及干净检出；不要用 `git add -f` 将大文件塞进普通 Git。

源工程和网页 GLB/纹理被 Git 忽略，提交代码不会备份这些重资产。完整备份需同时包含 `design/space/scenes` 与 `client/public/assets/space/blender-v1`；2026-09-08 迁出的 8 份旧 `.blend1` 备份在 `E:/CubeRoot-Assets/space/backups/20260908/`，随后修正预览相机时生成的 `.blend1` 留在原工程旁。E 盘缓存可重建，不能取代 `.blend` 备份。

本地开发默认加载 Blender 产物。生产默认仍走已有场景生成逻辑；需要先在构建/部署环境提供完整模型、纹理和对应 JSON 清单，核对哈希和资源可达，再在构建时设置 `NEXT_PUBLIC_SPACE_BLENDER=1`。代码提交和 push 不包含被忽略的重资产。上海模型当前为 310,655,468 字节（约 311 MB），正式发布前仍需分区加载、压缩与移动设备验证。

Blender 和 glTF 插件来源已加入网页的“来源与致谢”，统一数据在 `credits_data.json`；建筑及天气等既有资料见 [来源记录](../../docs/space-sources.md)，迁移状态见 [跟踪文档](../../docs/space-blender-tracker.md)。

金茂的实拍对照、首次精修脚本和后续编辑边界见[参考档案](references/jin-mao.md)。已有精修标记的工程禁止用首次建模脚本覆盖；日常继续编辑 `.blend` 并导出。

环球金融中心、上海中心与外滩 24 栋的实拍对照、细部增量及审图见[上海地标档案](references/shanghai-landmarks.md)。`refine_shanghai_landmarks.py` 同样是首次增量工具；已保存版本带修订标记，重复执行会拒绝覆盖。可加 `--review-saved` 只生成检查图，不修改源工程；日常导出仍运行 `batch.ps1 -Asset shanghai`。

亚细亚凹廊与上海总会双亭的增量工具为 `refine_bund_galleries.py`，本地工程已带 `bund-galleries-20260909` 标记。后续审图仅用 `--review-saved --focus 1`（亚细亚）或 `--focus 2`（总会），可加 `--night`；禁止重新运行 `--apply` 覆盖艺术编辑。继续建模应编辑现有工程，再导出。

上海总会窗组与檐口的增量工具为 `refine_bund_windows.py`，已保存 `bund-windows-20260909` 标记。后续使用 `--review-saved` 检查当前工程，可加 `--oblique` 同时渲染侧面、`--night` 检查夜间结构。默认候选和 `--apply` 都会拒绝在已有本批标记的工程上重复建模；继续修改现有工程，再按正常命令导出。参考依据、三轮纠错和未达标项见[第四批参考档案](references/shanghai-landmarks.md#第四批上海总会窗组与檐口)。

汇丰柱廊、江海关铜饰与和平饭店铜顶的增量工具为 `refine_bund_hero_details.py`，当前工程已保存 `bund-hero-details-20260909` 标记。后续审图用 `--review-saved --focus 12`，楼号可选 `12 / 13 / 20`，加 `--close` 看细部、`--night` 看夜间结构，`--suite` 依次生成三栋日夜图。已有本批标记时禁止重复作者操作；继续编辑当前工程，不用首次脚本覆盖。原始实拍来源、程序纹理说明与未完成项见[第五批参考档案](references/shanghai-landmarks.md#第五批汇丰柱廊江海关铜饰与和平饭店铜顶)。

江海关窗带与和平饭店上部立面的增量工具为 `refine_bund_frontages.py`，当前工程已保存 `bund-frontages-20260909` 标记。后续审图用 `--review-saved --focus 13 --close`，楼号可选 `13 / 20`，可加 `--night`；`--review-saved --suite` 生成两栋日夜近景及江海关钟下格栅近景。已有标记时拒绝重复建模，保存前检查磁盘源未被其他编辑器修改。照片依据、三轮修正和剩余项见[第六批参考档案](references/shanghai-landmarks.md#第六批江海关窗带与和平饭店上部立面)。

和平饭店中下部窗带与底层拱窗的增量工具为 `refine_peace_riverfront.py`，当前工程已保存 `peace-riverfront-20260909` 标记。后续仅用 `--review-saved --suite` 渲染日间近景、整栋日景、夜间结构及入口近景；已有标记时拒绝重复建模，保存前核对磁盘源未被其他编辑器修改。继续编辑当前工程并导出，不重复执行首次作者脚本。照片依据、三轮纠错和未达标项见[第七批参考档案](references/shanghai-landmarks.md#第七批和平饭店临江窗带与底层拱窗)。

江海关屋顶侧亭与钟楼基座的增量工具为 `refine_customs_roof.py`，当前工程已保存 `customs-roof-20260910` 标记。后续用 `--review-saved` 渲染近景，`--wide` 看整栋、`--night` 看夜间结构；已有标记时拒绝重复建模，保存前检查磁盘源未变化。审图与作者报告分开命名，临时灯光不保存。实拍依据和剩余问题见[第八批参考档案](references/shanghai-landmarks.md#第八批江海关屋顶侧亭与钟楼基座)。

2026-09-10 已串行合并[和平饭店铜顶](references/peace-crown.md)、[江海关檐口接缝](references/customs-junctions.md)和[汇丰鼓座与穹顶](references/hsbc-drum.md)，对应脚本为 `refine_peace_crown.py`、`refine_customs_junctions.py`、`refine_hsbc_drum.py`。当前工程分别带 `peace-crown-20260910`、`customs-junctions-20260910`、`hsbc-drum-20260910` 标记；江海关另带玻璃收口修订。三份 CLI 均不保存主工程，已有修订禁止重复作者操作；用 `--review-saved` 只读审图，继续修改当前工程后正常导出。最终 GLB 新增 387 处表面检查通过，三栋网页日夜已实际复查；后续已纠正铜顶与石材贴图的颜色编码，真实反照率、穹顶及基座配光仍未达标，不能把结构检查当作 1:1 或电影级完成。

四张既有颜色贴图已通过 `refine_bund_color_encoding.py` 增量修正，工程带 `spaceBundColorEncodingRevision = bund-albedo-srgb-20260910`。该工具默认只生成临时候选，`--apply` 要求同一源文件的候选报告并先备份；已有标记时拒绝重复编码。不要重新运行整栋生成器。Blender 非浮点 sRGB 图像的像素写入需要编码后的颜色，法线等数据贴图保持原值；校准、正式导出与网页证据见[颜色编码记录](references/peace-crown.md#铜顶与三栋石材的颜色编码修正)。

和平饭店铜顶夜间配光已保存 `spacePeaceNightRevision = peace-night-roof-20260910`，六盏既有灯及两份铜材质经正常导出进入网页。`refine_peace_night_lighting.py` 默认只生成候选报告，`--apply` 要求同一源文件的候选报告并先备份；已有修订时拒绝重跑。后续继续编辑当前工程并导出；四轮实拍对照、日夜检查与剩余差距见[夜景档案](references/peace-crown.md#夜间铜顶配光2026-09-10)。

江海关已保存 `spaceCustomsNightRevision = customs-night-lighting-20260910`，四盏下部、两盏上部代理灯及 `washTop=43` 经正常导出进入网页。`refine_customs_night_lighting.py` 与和平饭店脚本共用 `facade_rig.py` 的候选、源漂移和备份检查；已有修订时拒绝重复执行。三轮取舍、正式日夜及三视点检查、仍偏暗的塔冠与待补檐线见[夜景档案](references/customs-junctions.md#2026-09-10-网页夜景照明保存与复验)。

## 2026-09-10 和平饭店中央入口候选，视觉未通过

`refine_peace_central_arch.py` 的 candidate03 已后台导出隔离 GLB，**32 nodes、30 meshes、12,889,748 字节**，SHA-256 为 `b893d694a8611cb1d0a112d6bb5161ff15e03d170c9a26e2d14d35f8fe080761`；[候选报告](../../.tmp/png/space-peace-central-arch-20260910/candidate03/candidate-report.json)记录 `saved=false`、`officialAssetsWritten=false`、源指纹未变。candidate02 已修正 candidate01 遗漏的 `spaceFacadeDetail.stoneMeshes` 计数为 4；candidate03 仅在原 `/1` 石材线脚追加两小盒裁切，清除入口两侧残块，保留其余几何、UV、法线和归档检查。正式上海 GLB 仍为 **310,655,468 字节**。

主 Agent 已在真实 `/zh/space` 临时注入 candidate03：26 个原网格只替换几何并保留现场材质，4 个新增网格复用对应现场材质及适用的灯光属性。[网页报告](../../.tmp/png/space-peace-central-arch-20260910/candidate03-runtime.json)确认 **30 项全部通过**：原 10 条门玻璃与 6 条保留探针，加 8 条残块清除和 6 条邻窗、窗台、拱顶保护检查，未修改实际材质朝向；[candidate02 负对照](../../.tmp/png/space-peace-central-arch-20260910/candidate02-residual-negative.json)的 8 条清除检查全部失败、6 条保护通过。主 Agent 已逐张查看[入口日景](../../.tmp/png/space-peace-central-arch-20260910/web-candidate03-entrance-day.png)、[入口夜景](../../.tmp/png/space-peace-central-arch-20260910/web-candidate03-entrance-night.png)、[斜侧夜景](../../.tmp/png/space-peace-central-arch-20260910/web-candidate03-oblique-night.png)，与[Commons 实照](https://commons.wikimedia.org/wiki/File:Peace_Hotel_20250503.jpg)对照，确认两残块消失。

**整体视觉仍未通过：**中央门夜间仍黑，缺少实拍中的暖色上扇与入口层次；盾饰与尖叶仍是简化轮廓，全部尺寸仍为估算。下一步校准局部门窗材质与夜景、继续核对饰纹，再复查同机位日夜及斜侧。残块清除和射线通过不代表达到 1:1；候选未保存到正式 `.blend`，正式网页资产未写入。

## 2026-09-10 环球金融中心顶部候选

SWFC 已从参考研究进入 Blender 候选和隔离 GLB 网页检查。candidate01 未通过匿名 GPU instance ID 保留守卫；修正后 candidate02 导出成功，为 **7 nodes、6 meshes、35,998,448 字节**，塔体 **950,442 顶点、238,454 面**。全部原对象与运行 ID、九张内嵌图和三组灯保持。candidate03、candidate04 均实际导出成功，各为 **98,314 顶点、25,422 面、7 nodes、6 meshes、3,467,436 字节**；两版字节数相同但 UV 与文件哈希不同，candidate04 的 SHA-256 见参考档案。隔离候选只用于临时替换原塔审图。

原模型旧 4 项洞口检查通过，但新增 30 个楼面与 15 个桥底检查点均缺失；candidate02 至 candidate05 使用实际原材质的 **49 项检查均全部通过**。candidate04 的同机位对照已确认玻璃每 2 m 分段 UV 折线变成连续直线，**该 UV 缺陷已修复**。candidate05 已实际导出 **103,042 顶点、26,612 面、3,633,596 字节**；三张日景与独立审查发现旧外幕墙遮挡新棚侧退台及小支撑缝。candidate06 已实际导出并正常退出，**103,222 顶点、26,678 面、3,639,856 字节**，Blender 46 项交接检查及网页 **60 项检查全部通过**，包含 05 失败的 6 条外侧首命中。主 Agent 已看 97F 内外两张日景，确认旧中央外幕墙遮挡消除，新屋棚和退台可见。

candidate07-direction 已实际导出 **103,222 顶点、26,678 面、3,639,872 字节**，Blender 正常退出且 stderr 为空。mesh-local 已从 `−4.97°` 转为 **85.04°**，对应世界约 **38.191°** 东北—西南方向；文献已核定对角，精确角度仍为图纸估算。真实完整城市中临时替换后 **60 项全部通过**，主 Agent 逐张看城市全景、顶部斜侧、近地面三张日景，三件套相对位置保持、开口可见；近地面被既有简模裙楼部分遮挡，裙楼与地面衔接尚未通过准确度核查。候选报告中的冻结旧元数据 `siteOrientationConfirmed:false` 不代表已核定对角仍未知，也不授予精确方位实测结论。**整体视觉仍未通过**：不透明玻璃、单面屋棚、100F 桥底、机械层及夜景继续待修验，精确尺寸未知，不补开合机构。`verify.ts` 的旧场景、非法 metadata 与旋转场景源码回归及相应 typecheck 已通过。`candidate07-contract.json` 确认当前验证器分别复验正式原场景和临时注入实际 candidate07 GLB 的完整城市，**均为 `ok=true`、`errors=[]`**；候选替换 6 个 Mesh，加载器复制真实 JSON 的 `bridgeAngleLocalDegrees=85.04`，执行新方向探针而非旧 0° fallback，其他既有合同全部通过，`formalAssetChanged=false`。该结果不代表候选已写入正式资产或视觉验收通过。

candidate09 在生成临时 GLB 后未通过新增细部变换守卫，见[错误日志](../../.tmp/png/space-swfc-top-20260910/candidate09-blender.err.log)；该次失败保留。**后续 candidate10 已修正导出变换校验并实际导出成功**，为 **107,446 顶点、28,074 面、9 nodes、8 meshes、3,788,588 字节**。其[导出报告](../../.tmp/png/space-swfc-top-20260910/candidate10/candidate-report.json)确认八个直接子网格的导出变换与局部顶点精确核对通过；约 **0.0974 mm** 是导出数值往返误差界，不是现场尺寸精度。

[candidate10 网页报告](../../.tmp/png/space-swfc-top-20260910/candidate10-runtime.json)确认实际材质的 **60 项射线检查和完整城市合同均通过**（`ok=true`、`errors=[]`）。97F 顶棚与侧窗改用独立透射玻璃；主 Agent 与独立审图已查看内外日景，确认能看到后方框架、室内和天空。主 Agent 另已查看[桥底仰视日景](../../.tmp/png/space-swfc-top-20260910/candidate10-bridge-underside-day.png)，两组板带、中央深色缝及网格可见，但阴影下仍明显蓝灰；[97F 内部夜景](../../.tmp/png/space-swfc-top-20260910/candidate10-97-interior-night.png)可见玻璃后的夜空与外围框架，整个室内仍偏暗。**玻璃可见性已改善，整体视觉仍未通过**：屋架和桥底色感未匹配实拍，97F 照明层次未达标，100F 楼面玻璃仍沿用旧不透明材质，机械层及准确尺寸继续待验。光学参数和构件尺度仍为估算，未达到 1:1。

candidate02 至 candidate07 及最新 candidate10 的报告均为 `saved=false`、`officialAssetsWritten=false`。**正式 `.blend` 尚未保存本轮候选，正式上海 GLB 未变，仍为 310,655,468 字节。** 三名子 Agent 分工模型修改、实拍审核和来源文档，主 Agent 执行导出与浏览器验收，共四人，主 Agent 独占 Blender 写入与导出。新增 Quan 论文后，本轮累计七项来源链接已在真实网页 DOM 确认；此前六项来源的 **390 × 844** 展开截图 `sources-candidate-390.png` 已查看，`innerWidth=390`、`scrollWidth=375`，未见横向溢出，新增第七项后窄屏尚未复验。报告、导出哈希、已查实拍、估算边界及后续保存和复验要求见[顶部参考档案](references/swfc-top.md#2026-09-10-候选实施与网页核查进度)；本轮仅本地提交脚本、文档与来源，重资产、LFS 配置及发布暂缓。
