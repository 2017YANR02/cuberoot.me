# 汇丰大楼鼓座与穹顶精修

修订 `hsbc-drum-20260910`，2026-09-10。对象为外滩 12 号原汇丰银行大楼，当前浦发银行。此次是在现有 Blender 模型上按照片修正外部形态，尚不能证明测绘级 1:1。

## 实拍来源

| 来源 | 实际查看内容 | 证据与使用边界 |
| --- | --- | --- |
| [Asisbiz 外滩 12 号实拍档案](https://www.asisbiz.com/China/12-Zhongshan-Rd.html) | 白天临江全立面、两级八角鼓座、两根圆柱的中央小门廊、上层窗前石栏、穹顶底部连续石栏、矩形窗亭、浅灰穹顶 | 使用仓库此前保存的原图 `12-Zhongshan-Rd-Shanghai-Pudong-Development-Bank-The-Bund-Huangpu-District-Shanghai-China-built-1923-01.jpg`，本轮再次实际查看，并复制到独占证据目录。照片拍摄日期未核实；不据此断言 2026 年现场灯具状态。 |
| [Hermann Luyken：2014 年夜间外部穹顶特写](https://commons.wikimedia.org/wiki/File:2014.11.15.192101_Dome_HSBC_Building_Bund_night_Shanghai.jpg) | 穹顶浅色外皮、底部水平细线、石栏杆的转体形态、矩形窗亭、成组投光灯、顶端圆环和尖顶 | 2014-11-15 19:21:01，自摄，CC0；本轮下载并实际查看 2736 × 1824 原图。可证明照片中的形状，不能把夜景照片颜色直接当成白天材质色或当前灯光配光测量。 |

第二张原图：[Wikimedia 原文件](https://upload.wikimedia.org/wikipedia/commons/a/a1/2014.11.15.192101_Dome_HSBC_Building_Bund_night_Shanghai.jpg)。本轮还查看了 2024 年的汇丰“穹顶”照片，但发现它拍摄的是室内马赛克天花，因此没有用作外部穹顶依据。

实拍副本位于 `.tmp/png/space-parallel-20260910/hsbc/`，不作为网页运行时贴图，也不加入普通 Git。

## 观察到的错误与修改范围

现有模型把两级鼓座都做成重复的小三角窗头，并用 16 条明显竖肋表现圆顶。已查看的白天全立面和夜间特写支持不同的形态：下层临江中央是两根圆柱支承的较宽门廊，上层是平头凹窗和石栏，圆顶底部还有一道连续石栏及矩形窗亭，圆顶表皮以平滑曲面为主。

增量脚本 [refine_hsbc_drum.py](../scripts/refine_hsbc_drum.py) 复用现有 `refine_bund_frontages`、`refine_bund_galleries`、`refine_bund_hero_details`、`refine_bund_entrances` 和 `Mesh` 工具；没有引入新的建模或纹理来源。

- 只裁切原有汇丰 `/0`、`/1`、`/2`、`/4` 四份材质网格中局部高度 29.401–43.52 m 的鼓座旧外皮；原有圆顶是单独的 `/5` 网格，归档后原位替换它的 mesh data，保留原对象、ID 和变换。主楼窗框 `/3` 不改。归档副本不导出。
- 重建临江鼓座双圆柱门廊、较宽三角山花、八角石质檐口；背面保留单窗解释，没有凭空复制临江门廊。
- 重建上层四个主要方向的凹窗阳台、四个斜角的实心饰板石墩、较厚壁柱和穹顶底部连续转体石栏。
- 加入平头矩形窗亭、角部石墩和投光灯外壳；圆顶改为平滑旋转面、细水平裙线与顶端圆环。窗亭在曲面和裙线中真正开洞，避免曲面遮挡内凹玻璃。
- 保留主楼六根大柱、入口、现有招牌、地理位置、所有旧稳定 ID 和变换；原尖顶、星形顶饰及模型最高点继续保留。

八面尺寸、背面窗式、四向窗亭重复、32 个投光灯的全圈布置及全部细部尺寸均含照片估算，不能视为已核实的实际总数量。既有模型约 46.3 m 的最高点仅是此次不改变的模型约束，也不是新增的测绘结论。照片中的雕像、人物雕塑、精确柱头花饰、真实石材污渍和现场灯光配光尚未复刻。

## 安全应用与检查入口

脚本不能保存 `design/space/scenes/shanghai.blend`。CLI 可以只读检查主工程，或把候选工程保存到独占 `.tmp` 目录；父进程导入 `author(root, archive)` 后串行合并。重复修订、缺少既有细节修订、旧 ID 或变换改变、模型最高点改变都会拒绝执行。候选保存前核对主文件大小与修改时间，拒绝覆盖已有候选。

```powershell
# 只读整栋基线：先检查体量，再检查近景。
& 'E:/Apps/Blender/blender.exe' -b 'design/space/scenes/shanghai.blend' -t 8 --python 'design/space/scripts/refine_hsbc_drum.py' -- --baseline --wide --label baseline-wide

# 候选只保存到独占临时目录；主文件不会被保存。
& 'E:/Apps/Blender/blender.exe' -b 'design/space/scenes/shanghai.blend' -t 8 --python 'design/space/scripts/refine_hsbc_drum.py' -- --save-candidate --wide --label candidate-wide

# 读取已保存候选、只渲染近景。
& 'E:/Apps/Blender/blender.exe' -b '.tmp/png/space-parallel-20260910/hsbc/candidate-wide.blend' -t 8 --python 'design/space/scripts/refine_hsbc_drum.py' -- --review-saved --label candidate-close
```

实际运行需通过低优先级、隐藏窗口的 `Start-Process` 包装串行启动；本任务渲染上限 8 线程。复用的检查舞台、相机与灯光不进入候选保存；这些渲染也不等于网页运行时的最终灯光。

父进程在已打开并核对版本的主场景内可使用：

```python
import refine_hsbc_drum as hsbc
root = next(o for o in bpy.context.scene.objects if o.get('space_export') and o.get('spaceId') == hsbc.BUILDING_ID)
details = hsbc.author(root, archive_collection)
surface_probes = hsbc.verify(root)
```

## 验证记录

证据目录为 `.tmp/png/space-parallel-20260910/hsbc/`。以下图片均由本机 Blender 5.2.1 LTS Cycles CPU 实际渲染并打开检查，1200 × 1200，24 samples，降噪；各次日志均记录 `HSBC_RENDER_THREADS 8`。

| 检查 | 证据 | 结论 |
| --- | --- | --- |
| 整栋同机位日景基线与候选 | `baseline-wide-12-day.png`、`round1-wide-12-day.png` | 先审体量，再审细部；候选移除原有重复三角窗头与明显竖肋，保留整栋外包围和既有主楼。 |
| 旧曲面遮窗诊断 | `round1-wide-retry.log`、`inspect.log` | 实际首命中为原 `/5` 独立圆顶，深度 1.8152 m，遮住应在 1.87 m 的窗亭玻璃；核对真实材质网格后，归档并原位替换 `/5`，不再遗漏该曲面。 |
| 日景近景第一轮 | `round1-close-12-day-close.png` | 双层石栏、平滑穹顶、窗亭凹窗可见；发现两根小圆柱中段黑色细纹。 |
| 日景近景第二轮 | `round2-close-12-day-close.png` | 修正圆柱和贯穿柱身 lathe 的重叠，整根柱身仅保留一个轮廓；同机位复查黑纹消失，门廊和栏杆遮挡正常。 |
| 第二轮同机位夜景 | `round2-night-12-night-close.png` | 灯具镜片、石栏、窗亭及门廊均可见，没有重现圆柱黑纹；但既有检查舞台的单盏 crown wash 只照亮穹顶下半部，未达到实拍的整体金色照明，列为未通过的夜景配光项。 |

第二轮候选为 `round2-close.blend`，保存发生在临时检查舞台创建前。`round2-close-report.json` 记录：14 / 14 实际表面首命中探针通过，覆盖八个上层面、四个窗亭、下层门廊和曲面；保留 619 个既有全场景导出 ID，新增五份汇丰材质网格，原圆顶 ID 原位复用；最高点仍为 46.299999 m。保存前核对的主文件为 118,475,772 bytes、`mtimeNs=1789039213528978700`，本脚本没有保存主文件。

窗亭水平探针高度采用 38.72 m，以避开确实存在的顶部栏杆；低于栏杆的射线被栏杆挡住是合理遮挡，不作为“缺失玻璃”错误。Blender 首命中通过仍需父流程对导出的 GLB 和网页做独立复查。

2026-09-10 协调流程已合并第二轮修改到主工程并导出最终 GLB，14 处独立表面首命中检查全部通过，旧圆顶遮窗未重现。实际网页 `web-hsbc-day-new.png`、`web-hsbc-night-new.png` 已打开复查，保存在 `.tmp/png/space-parallel-20260910/`；白天双层鼓座、平滑穹顶及窗亭可见，21:00 的穹顶仍偏灰白、上部配光不均，柱廊和冠部亮度关系与实拍不符。结构检查通过，网页夜景不通过；完整导出信息见[本批跟踪](../../../docs/space-blender-tracker.md#2026-09-10-三栋细部合并与网页首帧修复)。

精度未闭合项：背面资料不足，圆顶曲率与鼓座各尺寸尚未测绘；上部雕塑和复杂花饰未补齐，石面老化仍为既有程序纹理；尖顶与顶端星饰保留旧形态，尚需专门纠正；当前灯具是可见几何，夜景配光已在实际审图中确认不一致，不能据此宣称完成现场夜景或电影级画质。后续需把真实方向与分组的灯光接入共享运行时灯池，并对实际 GLB、网页白天和夜晚分别复查，不能只调一个不导出的 Blender 检查舞台来掩盖运行时差距。
