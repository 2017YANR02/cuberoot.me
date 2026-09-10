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

在仓库根运行 `node design/space/scripts/capture-server.mjs`，再用浏览器访问 `http://127.0.0.1:3016/verify`。它检查完整 25 个场景的几何、表面、反射和城市运行绑定，结果在页面和 `window.verification`。单资产可加 `?asset=modern-original`。该检查不需要 GPU，实际光照效果仍须在 `/zh/space` 检查。

打包器检查：`uv run python -m unittest discover -s design/space/scripts -p test_pack_gltf.py`。前端逻辑改动在 `core/` 运行 `pnpm --filter @cuberoot/client typecheck` 及适用的 Space 测试；开发服务器运行时不执行 Next build。

## 备份与发布

2026-09-09 用户确定后续资产版本管理使用 Git LFS，但暂不配置或上传。`.blend` 和必要原始贴图通过 LFS 保存版本，脚本、文档和清单继续普通 Git；`.blend1`、缓存和临时渲染不入库。网页 GLB 和运行贴图按资源发布流程提供，不能把 LFS 当成网页资源地址。恢复资产入库时同步配置 `.gitattributes` 与精确忽略例外，核对 LFS 指针、用量预算及干净检出；不要用 `git add -f` 将大文件塞进普通 Git。

源工程和网页 GLB/纹理被 Git 忽略，提交代码不会备份这些重资产。完整备份需同时包含 `design/space/scenes` 与 `client/public/assets/space/blender-v1`；2026-09-08 迁出的 8 份旧 `.blend1` 备份在 `E:/CubeRoot-Assets/space/backups/20260908/`，随后修正预览相机时生成的 `.blend1` 留在原工程旁。E 盘缓存可重建，不能取代 `.blend` 备份。

本地开发默认加载 Blender 产物。生产默认仍走已有场景生成逻辑；需要先在构建/部署环境提供完整模型、纹理和对应 JSON 清单，核对哈希和资源可达，再在构建时设置 `NEXT_PUBLIC_SPACE_BLENDER=1`。代码提交和 push 不包含被忽略的重资产。上海模型当前为 304,835,044 字节（约 305 MB），正式发布前仍需分区加载、压缩与移动设备验证。

Blender 和 glTF 插件来源已加入网页的“来源与致谢”，统一数据在 `credits_data.json`；建筑及天气等既有资料见 [来源记录](../../docs/space-sources.md)，迁移状态见 [跟踪文档](../../docs/space-blender-tracker.md)。

金茂的实拍对照、首次精修脚本和后续编辑边界见[参考档案](references/jin-mao.md)。已有精修标记的工程禁止用首次建模脚本覆盖；日常继续编辑 `.blend` 并导出。

环球金融中心、上海中心与外滩 24 栋的实拍对照、细部增量及审图见[上海地标档案](references/shanghai-landmarks.md)。`refine_shanghai_landmarks.py` 同样是首次增量工具；已保存版本带修订标记，重复执行会拒绝覆盖。可加 `--review-saved` 只生成检查图，不修改源工程；日常导出仍运行 `batch.ps1 -Asset shanghai`。

亚细亚凹廊与上海总会双亭的增量工具为 `refine_bund_galleries.py`，本地工程已带 `bund-galleries-20260909` 标记。后续审图仅用 `--review-saved --focus 1`（亚细亚）或 `--focus 2`（总会），可加 `--night`；禁止重新运行 `--apply` 覆盖艺术编辑。继续建模应编辑现有工程，再导出。

上海总会窗组与檐口的增量工具为 `refine_bund_windows.py`，已保存 `bund-windows-20260909` 标记。后续使用 `--review-saved` 检查当前工程，可加 `--oblique` 同时渲染侧面、`--night` 检查夜间结构。默认候选和 `--apply` 都会拒绝在已有本批标记的工程上重复建模；继续修改现有工程，再按正常命令导出。参考依据、三轮纠错和未达标项见[第四批参考档案](references/shanghai-landmarks.md#第四批上海总会窗组与檐口)。

汇丰柱廊、江海关铜饰与和平饭店铜顶的增量工具为 `refine_bund_hero_details.py`，当前工程已保存 `bund-hero-details-20260909` 标记。后续审图用 `--review-saved --focus 12`，楼号可选 `12 / 13 / 20`，加 `--close` 看细部、`--night` 看夜间结构，`--suite` 依次生成三栋日夜图。已有本批标记时禁止重复作者操作；继续编辑当前工程，不用首次脚本覆盖。原始实拍来源、程序纹理说明与未完成项见[第五批参考档案](references/shanghai-landmarks.md#第五批汇丰柱廊江海关铜饰与和平饭店铜顶)。

江海关窗带与和平饭店上部立面的增量工具为 `refine_bund_frontages.py`，当前工程已保存 `bund-frontages-20260909` 标记。后续审图用 `--review-saved --focus 13 --close`，楼号可选 `13 / 20`，可加 `--night`；`--review-saved --suite` 生成两栋日夜近景及江海关钟下格栅近景。已有标记时拒绝重复建模，保存前检查磁盘源未被其他编辑器修改。照片依据、三轮修正和剩余项见[第六批参考档案](references/shanghai-landmarks.md#第六批江海关窗带与和平饭店上部立面)。
