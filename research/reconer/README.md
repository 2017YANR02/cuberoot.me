# Reconer：速拧视频自动复盘

目标是从视频恢复**实际执行的动作、时间戳和不确定位置**。采用“可见色块实例与颜色 → 中心/几何对应 → 时序观测 → 魔方物理约束搜索”的路线，详细阶段门槛见 [plan.md](plan.md)。

2026-10-23：数据清点、模型训练/图片推理代码、独立评分已实现；**尚无新模型权重、模型实测或视频自动复盘闭环**。对应原片和独立实例标注未找到，本机训练启动被仓库资源守卫拒绝。[执行记录](reports/2026-10-23-bootstrap.md) 区分代码验证与尚未完成的实验。

## 目录和运行边界

| 入口 | 作用 |
| --- | --- |
| `scripts/research-status.ts` | 只读清点原片、标签、硬件、依赖和资源证据；不加载模型 |
| `scripts/dataset-audit.ts` / `src/dataset-manifest.ts` | 原片清单、来源分组、COCO 契约和稀疏标注请求；不自动制造图像标签 |
| `vision/baseline.py` | 单一 Mask R-CNN 基线：doctor、audit、train、evaluate、predict |
| `scripts/evaluate-reconstruction.ts` / `src/evaluation.ts` | 推理结束后读取答案，按完整视频评分；不调用解码器 |
| `src/cube-state.ts`、现有搜索模块 | 复用的魔方状态与搜索基础；旧诊断入口尚未改造成独立视频推理 |

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

以下计算命令只用于符合仓库本地资源政策的环境，或另行准备的远程计算环境。**当前 Mac 的本地训练条件未满足**：有空闲内存、Swapouts 为零或逐批 RSS 监控，都不能证明系统禁止换出。守卫已登记 train/evaluate/predict；doctor、audit、help 可用于轻量准备。未更改系统设置或配置远程主机。

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

评估输出必须新建；图片推理输出目录必须新/空。保留测试额外用 `--split test --validation-report artifacts/validation-001.json`，冻结相同权重和阈值，并校验与训练/验证的来源、录制组和图像指纹隔离。

模型只输出可见实例掩码、bbox、颜色和未校准的 `detection_score`。`color_distribution`、`is_center` 保留 `null`，尚未完成中心识别、几何对应、自动动作边界和视频解码。图像 precision/recall 不等于动作准确率。训练权重、缓存和本地报告放在被忽略的 `artifacts/`，不提交 Git。

## 独立动作验收

先保存推理输出，再由单独进程读取真值：

```bash
pnpm evaluate --predictions /absolute/path/to/predictions.json \
  --truth /absolute/path/to/truth.json --out artifacts/actions-001.json
pnpm evaluate --help
```

JSON 样例和类型见 CLI help、`src/evaluation.ts`。按视频计算 `1 - editDistance / max(预测长度, 真值长度)` 后宏平均；漏步、多步、替换都计入。失败、拒判、超时和缺失视频记零，空真值单列。原始记号和仅规范拼写的记号分别评分，不消掉 `U U'`、转体或动作事件。已知/未知初态及人工/自动边界分别报告；时间以原片毫秒表示，50 fps 的时间容差为 20 ms。

旧 `real-eval.ts` / `backward-decode.ts` 等含人工边界、GT 推初态、答案候选等诊断条件。LL 排名、可以还原或自洽不能当作视频真实轨迹识别成绩。

## 最小验证

```bash
pnpm typecheck
pnpm exec vitest run test/dataset-manifest.test.ts test/evaluation.test.ts test/reconstruct.test.ts
vision/.venv/bin/python -m unittest discover -s vision -p test_contract.py
```

这些检查覆盖数据契约、防泄漏和评分逻辑，不加载网络、不训练，也不证明检测效果。阶段 A、真实模型训练与验证、几何/时序接入、冻结保留集验收仍待完成。
