# Reconer：速拧视频自动复盘

目标是从视频恢复**实际执行的动作、时间戳和不确定位置**。采用“可见色块实例与颜色 → 中心/几何对应 → 时序观测 → 魔方物理约束搜索”的路线，详细阶段门槛见 [plan.md](plan.md)。

完整方案先读 [九条端到端实现路径](implementation-paths.md)：包含产品输入、各路线架构、训练目标、标注需求、代码批次、历史失败改进条件和停止规则。[25 类技术组件](technical-options.md) 是配套的选择依据。推荐 A 可见实例/物理搜索与 F 交互修正组合，C 连续视频转写作为主要备选；方案中的后续模块不等于已经实现。

[solve.vision 技术调查](reports/2026-10-27-solve-vision-investigation.md)区分官网与公开代码能确认的事实、作者回复转述和内部架构推断，并说明动作规范化、转体后处理及时间精度对本项目验收的影响。

智能魔方配对视频的采集与 AI 拉取入口见 [视频采集工作流](../../docs/recon-capture-workflow.md)：在成绩复盘选择原视频，复用私有 Drive 分块上传，绑定打乱、未化简动作与可用的姿态记录；同步锚点另存，采集数据仍待审核。相关 Web/API/CLI 是本地新增实现，尚未做端到端验证或发布，不会自动启动训练。

2026-10-24：已整理 [25 类技术路线及历史失败的重试条件](technical-options.md)，并编写视频提帧、流式实例推理、可见几何投影、时序候选、独立物理搜索和复核队列的接入代码。**本轮按用户要求没有运行测试、typecheck、推理或训练，没有新模型权重，也没有自动复盘成功证据。** 用户回来后再提供 ground truth；当前实现与缺口见 [本轮记录](reports/2026-10-24-design-and-integration.md)。上一轮验证仅覆盖当时版本，见 [2026-10-23 记录](reports/2026-10-23-bootstrap.md)。

## 目录和运行边界

| 入口 | 作用 |
| --- | --- |
| `scripts/research-status.ts` | 只读清点原片、标签、硬件、依赖和资源证据；不加载模型 |
| `scripts/dataset-audit.ts` / `src/dataset-manifest.ts` | 原片清单、来源分组、COCO 契约和稀疏标注请求；不自动制造图像标签 |
| `vision/baseline.py` | 单一 Mask R-CNN 基线：doctor、audit、train、evaluate、predict |
| `scripts/prepare-video-frames.ts` | 有界提取原始 PTS 对应的帧；保留来源指纹、裁剪和显式真实时间映射 |
| `src/visible-geometry.ts` | 将实际可见 mask 支持点投到有来源的面四边形；保留未知格和几何歧义 |
| `src/observation-timeline.ts` | 短时几何关联、稳定观测和变化区间提案；不保证覆盖所有动作 |
| `scripts/reconstruct-observations.ts` / `src/independent-reconstruction.ts` | 连接完成的预测流、独立几何、边界声明和有界搜索，输出候选与复核队列 |
| `scripts/evaluate-reconstruction.ts` / `src/evaluation.ts` | 推理结束后读取答案，按完整视频评分；不调用解码器 |
| `src/rotation-perms.ts` / `src/anchored-search.ts` | 物理转动语义和双端锚定；旧诊断默认行为与新独立入口的持握语义显式区分 |

这是仓库外层的独立研究 package。以下命令均在 `research/reconer/` 执行，不在 `core/`。Python 仅用于 PyTorch 科研基线，数据编排与动作评分使用 TypeScript，例外已登记于 [迁移跟踪](../../docs/python-to-typescript-rust-tracker.md)。

## 先接收素材

```bash
pnpm research:status
pnpm data:audit
```

当前五把旧视频保留 233 个动作段，其中 229 个非转体动作；没有对应 MP4。另一个文件只有 46 段边界，不能当作第六把完整标注。旧 RGB 普查和九宫格读色没有独立实例掩码，不可直接用于本次训练。

拿到原片目录后，创建自己的输出目录，显式指定路径：

```bash
mkdir -p artifacts/intake
pnpm data:audit --media-root /absolute/path/to/videos --probe --hash \
  --manifest-out artifacts/intake/sources.json \
  --coco-template artifacts/intake/visible-instances.json \
  --output artifacts/intake/audit.json
```

输出文件必须是新文件。此命令只读取元数据、流式计算指纹和生成标注请求，不解码视频。`ffprobe` 的帧率不能证明真实时间倍率或没有重复帧，仍需核对 PTS、慢放和目标 1080p50 图像。

清单里的 `source_id`、`recording_group` 和 `split` 必须按实际来源确认。同原片裁剪、转码、邻帧、增广和同次录制不得跨训练/验证/测试；已有五把标为开发数据。没有独立新素材时不宣称盲测泛化。

随后按 plan 阶段 A 冻结 v1/v3 各两段失败片段和 v2 两段对照，先验证修正位置/遮挡/颜色能改善动作判别，再扩大训练。当前未冻结六段时间窗，不能拿新模型训练完成替代这一证据。

## 图像标注契约

使用 COCO polygon 实例标注。颜色类别固定为 `1:W, 2:Y, 3:R, 4:O, 5:B, 6:G`，它不是魔方状态数组的颜色编号。

- 每张图记录来源、录制组、split、原始 PTS、尺寸和图像 SHA-256；相对图像路径以 COCO JSON 所在目录为基准，或通过 `--images-root` 指定。
- 完整审核图必须显式填写 `reviewed: true`、`annotation_complete: true`、`annotation_provenance: "human-visible"` 和 `reviewer`。只标图上实际可见的实例，遮挡部分不从解法或旧网格补全。
- 每个实例保留 polygon、bbox、area、可见性和 `is_center`（不知道则 `null`）。不可读区域使用 `visibility: "unknown"`、`category_id: null`、`ignore: true` 和原因，不当成背景负样本。
- 当前基线拒绝把含未知忽略区域的帧用于训练，以免 Mask R-CNN 将其当成负样本。评估单列固定的忽略区域及被忽略预测，不能根据模型错误事后加忽略区。

审核字段是来源声明，代码无法证明谁看过图。VLM/模型初标应保留自己的 provenance，不能仅改字段冒充人工审核。完整字段定义见 `src/dataset-manifest.ts`；空模板不可训练。

```bash
uv sync --project vision --python 3.12 --frozen
vision/.venv/bin/python vision/baseline.py doctor
vision/.venv/bin/python vision/baseline.py audit \
  --dataset artifacts/intake/visible-instances.json
```

`doctor` 只检查安装元数据，不 import torch；依赖存在不代表模型可运行。`audit` 校验图像字节/尺寸、标注和分组；空数据会返回 blocked。

## 模型训练与图片验证

基线使用 TorchVision Mask R-CNN ResNet50-FPN，训练六类可见色块；结构参考 [官方迁移学习教程](https://docs.pytorch.org/tutorials/intermediate/torchvision_tutorial.html) 和 [模型文档](https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.detection.maskrcnn_resnet50_fpn.html)。必须显式提供本地官方 COCO_V1 权重，代码不会自动下载或退回随机初始化。

以下命令供恢复实验后使用，本轮均未执行。计算环境须符合仓库本地资源政策，或另行准备合适的远程环境。上一轮本机训练被资源守卫拒绝；本轮未重新启动。有空闲内存、Swapouts 为零或逐批 RSS 监控，不能证明系统禁止换出。守卫代码已登记 train/evaluate/predict、视频提帧与观测搜索；doctor、audit、help、两个新 CLI 的 `--plan` 保留轻量准备入口。新规则尚待新会话加载与实际调用验证；未更改系统设置或配置远程主机。

```bash
vision/.venv/bin/python vision/baseline.py train \
  --dataset /absolute/path/to/reviewed.json \
  --pretrained /absolute/path/to/maskrcnn_resnet50_fpn_coco-bf2d0c1e.pth \
  --output artifacts/run-001 --device cpu \
  --epochs 10 --batch-size 1 --threads 2 \
  --max-seconds 3600 --max-rss-mib 8192
```

新训练要求新/空输出目录及有效 train、val 数据。GPU 可显式选择 `cuda`；MPS 检测算子尚未实测，当前明确拒绝，不能自动回退后声称使用了 Apple GPU。

训练保持同一进程，逐批写 `progress.jsonl`（PID、session、loss、耗时、峰值 RSS）；初始化、每 10 批、每 epoch 及可处理的停止边界保存原子 `latest.pt` 和 `run.json`。恢复时改用 `--resume artifacts/run-001/latest.pt`，保留相同数据、代码、配置和 device，恢复优化器、RNG、epoch 内位置，不重新初始化。崩溃恢复到最近检查点；预算触发后不会自动重启。RSS/时限是运行时停止保护，不能阻止单批越限或替代系统防换出保证。

```bash
vision/.venv/bin/python vision/baseline.py evaluate \
  --dataset /absolute/path/to/reviewed.json --split val \
  --checkpoint artifacts/run-001/latest.pt --threshold 0.5 \
  --output artifacts/validation-001.json

vision/.venv/bin/python vision/baseline.py predict \
  --image /absolute/path/to/frame.png \
  --checkpoint artifacts/run-001/latest.pt --threshold 0.5 \
  --output artifacts/prediction-001
```

评估输出必须新建；首次图片/帧序列推理输出目录必须新/空。保留测试额外用 `--split test --validation-report artifacts/validation-001.json`，冻结相同权重和阈值，并校验与训练/验证的来源、录制组和图像指纹隔离。

`predict` 现在写 `predictions.jsonl`、`run.json` 及逐实例 mask。每个实例输出颜色、`detectionScore`、检测框和真实前景像素的面积、质心、可见框、支持点；框本身不作为贴纸几何。`colorDistribution`、`isCenter` 保留 `null`，没有假装训练过中心头或校准概率。图像 precision/recall 不等于动作准确率。训练权重、缓存和本地报告放在被忽略的 `artifacts/`，不提交 Git。

## 从原片到可复核的搜索输入

流程为原片 → `frames.jsonl` → `predictions.jsonl` → 几何/时间观测 → 候选轨迹与复核队列。需要另行提供有来源的面四边形和格位朝向证据；**目前没有从分割结果自动完成这一步的模型**。人工提供这些内容时必须使用 `diagnostic-manual`，由人工证据传播的跟踪也不能改记为自动。

### 原片与时间

下面是后续使用示例，不是已执行记录：

```bash
pnpm video:prepare --video /absolute/path/to/source.mp4 --video-id solve-001 \
  --from-pts-seconds 0 --to-pts-seconds 10 \
  --output artifacts/frames-001 --max-edge 1920 --max-frames 750 --plan
```

去掉 `--plan` 才会解码。可选 `--crop x,y,w,h` 使用未自动旋转的原片坐标；默认保留区间内所有解码帧，不补帧或强制改写 50 fps。源显示旋转保存在配置中，不能把显示坐标当作原始像素坐标。时间来自 `-copyts` 配合 `showinfo` 的整数 PTS 与 time base，`trim` 限定区间且保留时间戳；相关选项见 [FFmpeg 文档](https://ffmpeg.org/ffmpeg.html)、[showinfo](https://ffmpeg.org/ffmpeg-filters.html#showinfo) 与 [trim](https://ffmpeg.org/ffmpeg-filters.html#trim)。

只有核实过真实时间倍率，才通过 `--time-mapping FILE` 提供：

```json
{"ptsOrigin":"0","realTimeOriginMs":0,"realSecondsPerPtsSecond":1,"verified":true}
```

这只是普通实时片源的字段示例，不能原样套到慢放视频。未提供时真实时间为 `null`，后续禁止当成已核实时间使用。代码不证明无重复帧，`duplicatesVerified` 始终为 `false`。原片指纹、帧指纹、整数 PTS、裁剪变换均留存；超时、帧预算、损坏帧或来源变化会保留 partial 产物，不能继续冒充完整输入。`--max-seconds` 限制解码器，文件指纹和产物核验另占耗时。提帧尚无自动断点续提，已有文件保留用于人工恢复。

### 同一模型进程处理帧序列

```bash
vision/.venv/bin/python vision/baseline.py predict \
  --frames-manifest artifacts/frames-001/frames.jsonl \
  --checkpoint artifacts/run-001/latest.pt --threshold 0.5 \
  --output artifacts/video-prediction-001 --device cpu --threads 2 \
  --max-seconds 3600 --max-rss-mib 8192
```

模型在同一 PID 中加载一次并逐帧处理，不将整段 RGB 帧堆进内存。每帧先保存 mask，再提交预测流和原子检查点。手动恢复时使用同一命令加 `--resume`；恢复会核对源清单、权重、代码、配置、依赖版本和已提交流/掩码指纹，累计时限与峰值 RSS。只有未提交的文件尾部可被恢复流程截断，已提交结果不重写；它不会自动重新启动计算，也不能替代全进程防换出机制。

### 几何、边界与搜索

`--geometry` JSON 顶层为 `schemaVersion: 1`、`videoId`、`sourceHash` 和 `frames`。每帧记录 `frameId`、`imageHash` 和 `geometry`。每个可见面包括按图像顺时针排列的四角、`layersAligned`、证据来源，及可选的格位朝向和中心证据；字段定义见 [visible-geometry.ts](src/visible-geometry.ts)。局部四角按上左、上右、下右、下左排列，格位朝向使用已有物理朝向置换；不能用随意旋转九宫格代替真实对应。

`--request` 的严格字段定义见 [independent-reconstruction.ts](src/independent-reconstruction.ts)。它接收独立打乱或未知初态声明、终态声明、几何模式和边界模式，拒绝夹带 `truth`、真实候选等字段。人工边界还须提供独立来源和“覆盖选中区间内所有动作”的声明，每个事件引用前后帧；声明不等于程序验证了所有动作。

```bash
pnpm video:reconstruct --prediction-run artifacts/video-prediction-001 \
  --geometry /absolute/path/to/geometry.json \
  --request /absolute/path/to/request.json \
  --output artifacts/reconstruction-001 --plan
```

去掉 `--plan` 才会投影和搜索。输出 `geometry.json`、`timeline.json`、`reconstruction.json`、供独立评分的 `predictions.json`、`review-queue.json` 和记录输入/代码指纹的 `run.json`。无几何支持、重定位不确定、未知时间和未覆盖变化区间都留在复核队列。

当前搜索仅支持**独立标准配色打乱、打乱后可换持握、已确认复原终态、人工动作边界**的受限情况。中间片段若没有独立起止状态，不能拿整把打乱直接套用；阶段 A 的 GT 片段状态实验应单独标为诊断。未知初态、未知终态及自动边界模式会返回 `abstained`。自动时间模块仅提出变化区间，不能证明区间里只有一步或完整覆盖整把。

搜索保留同状态的多个路径和存活备选，以节点数与耗时限制计算；默认 150 万节点、20 秒，不代表整段总耗时或性能已达标。结果记录词表大小和展开量上界；120 个事件的输入上限不代表预算能搜完 120 个事件。颜色支持、路径分差、先验与几何阈值都未校准。仅一个存活路径、空动作无法解释、视觉支持不足或路径分差不足时均拒判；候选和原因仍保留。`completed` 只是通过当前启发式门槛，始终附带 `qualityVerified: false`，不代表真实轨迹正确。当前不从人工事件端点伪造转动完成时间。

## 独立动作验收

先保存推理输出，再由单独进程读取真值：

```bash
pnpm evaluate --predictions /absolute/path/to/predictions.json \
  --truth /absolute/path/to/truth.json --out artifacts/actions-001.json
pnpm evaluate --help
```

JSON 样例和类型见 CLI help、`src/evaluation.ts`。按视频计算 `1 - editDistance / max(预测长度, 真值长度)` 后宏平均；漏步、多步、替换都计入。失败、拒判、超时和缺失视频记零，空真值单列。原始记号和仅规范拼写的记号分别评分，不消掉 `U U'`、转体或动作事件。已知/未知初态、人工/自动边界及人工/自动几何分别报告；旧结果未记录几何时单独列为 `unspecified`。时间以核实后的真实毫秒表示，50 fps 的时间容差为 20 ms。

旧 `real-eval.ts` / `backward-decode.ts` 等含人工边界、GT 推初态、答案候选等诊断条件。LL 排名、可以还原或自洽不能当作视频真实轨迹识别成绩。

## 恢复实验后的最小验证

本轮用户明确暂不测试，下列检查均未运行；新增代码不能继承上一轮的通过结论。待恢复实验后，先检查新数据契约、物理持握语义、断点一致性与拒判边界，再做真实数据试验。

```bash
pnpm typecheck
pnpm exec vitest run test/dataset-manifest.test.ts test/evaluation.test.ts test/reconstruct.test.ts
vision/.venv/bin/python -m unittest discover -s vision -p test_contract.py
```

既有检查只覆盖各自的数据契约、评分和搜索风险，不证明新增视频链已通过，也不证明检测效果。后续仍需新接口的最小回归、阶段 A、真实模型训练与验证、自动几何/边界研发及冻结保留集验收。
