# TypeScript 重构进度

Python 研究原型 → TypeScript 的移植记录。原始 Python 仍保留在仓库根 (live 流水线),
TS 端口在 `src/`。每步都对原始 Python 做了差分验证。

## 已移植 (src/) — 纯逻辑 + Step 1/3

| TS 模块 | 对应 Python | 验证 |
|---------|------------|------|
| `cube-state.ts` | `cube_state.py` | 500/500 随机 scramble 与 Python 逐 sticker 一致 (`parity.ts`) |
| `notation.ts` | `greedy_reverse.py` / `template_cnn.py` 的 token 工具 | 单测 |
| `splits.ts` | `parseGT`/`parseSegMoves`/`parseSplitFrames` | 5/5 GT 文件逐 token 一致 (`parity-parse.ts`) |
| `motion-detect.ts` | `motion_detect.py` (Step 1 分段) | 状态机 24/24 段与 Python 逐值一致 (`parity-motion.ts`); 修了空输入 IndexError |
| `reconstruct.ts` | `greedy_reverse.py` 逆推引擎 (纯逻辑) | 25 步解法往返 (CubeState 作预言机) |
| `bface-color.ts` | `extract_b_face_colors`/`get_roi_color` | `rgbToHsvCv` 与 cv2 逐值一致 (ΔH=0, ΔS≤1, ΔV=0) |
| `video-frames.ts` | `cv2.VideoCapture` 抽帧 | ffmpeg 单 pass |
| `cli.ts` | `greedy_reverse.py` main | 见下 |

**测试**: `pnpm test` → 40/40。**类型**: `pnpm typecheck` (tsgo) → 0 error。

## 端到端保真 (video 3, Step 3 视觉模式)

| | Python (cv2) | TS (ffmpeg) |
|---|---|---|
| Full 准确率 | 3/45 (6.7%) | 3/45 (6.7%) — 相同 |
| Face 准确率 | 22/45 | 21/45 (差 1 段) |

差 1 段完全来自 **ffmpeg 与 OpenCV 对 H.264 的解码差异** (B 面 3×3 逐格主色一致率
~87.5%, 集中在红/橙边界), 而非端口逻辑 —— HSV 转换已逐值验证。CLAUDE.md 记载的
Step-3 视觉评分本就"粗糙/早期", 两端一致地未能提升 Full 准确率。

> 附注: Python 的 `Verification` 打印 `False` (它把 solve 应用到 *已还原* 的魔方,
> 是个失效的 canary)。TS 改用自洽校验 (finalState + predicted + tail → Solved),
> 正确打印 `True`。

## Step 1 分段 (已移植)

`motion-detect.ts` 两层: `segmentFromDiffs(diffs, fps)` 纯状态机 (阈值+回滞→聚合→
过滤短段→合并), 与 Python 逐值一致且修了空输入 IndexError; `computeFrameDiffs()` 用
ffmpeg 单 pass 流式算 ROI 灰度帧差 (仅驻留 2 帧, 支持长 4K 视频)。端到端在 video 3 上
TS(ffmpeg) 与 Python(cv2) 都切出 **12 个 MOVING 段** (回滞吸收了解码幅值差)。
> 未移植 `saveDiffPlot`/`saveStableFrames` (纯 cv2 调试产物, 非流水线一环)。

## scope 决策: ① 桥接 (已定)

Step 2 的 ResNet/ML 在 TS 生态无对等成熟实现, 用户选定**方向 ①**:

- **Step 1 + Step 3 全进 TS** — 已完成 (见上)。
- **Step 2 桥接**: 保留 `template_cnn.py` 作批处理产 `*.probs.json`, TS 的 Step-3
  (`cli.ts`) 直接消费。桥已通, 无需新代码。
  > `template_cnn.py main()` 是**整批**流水线 (一次为所有视频写 probs.json, 依赖
  > torch/sklearn + `features_cache.npz`), 无单视频推理 CLI, 本机也无 torch 跑不了。
  > 未来若要 TS 化特征提取: 导出 ResNet 为 ONNX 用 onnxruntime-node (需先在有 torch
  > 的机器上导出), PCA/KNN 属数据集拟合仍宜留 Python — 收益低、无法在本机验证, 暂不做。

- **Step 2 分类** (`template_cnn.py`) 及评估脚本 `lovo_test.py` / `quick_mlp_test.py`
  仍在 Python (需 torch/sklearn)。

若要 Step-3 视频层与 cv2 逐像素一致 (而非 ~87.5%), 可给抽帧单独加一个 cv2 Python 桥,
其余保持 TS。

## 运行

```bash
pnpm install
pnpm test                                              # 40 单测
pnpm typecheck                                         # tsgo
npx tsx src/motion-detect.ts "videos/3 4.375.MP4"      # Step-1 分段时间线 (需 ffmpeg+ffprobe)
npx tsx src/cli.ts "videos/3 4.375.MP4.splits.txt"     # Step-3 复盘 (有视频则视觉评分)
npx tsx src/cli.ts "videos/3 4.375.MP4.splits.txt" --prob-only
# 差分测试 (需 python):
npx tsx scripts/parity.ts                              # cube_state (需 python)
npx tsx scripts/parity-parse.ts                        # splits 解析 (需 python+cv2)
npx tsx scripts/parity-motion.ts "videos/3 4.375.MP4"          # Step-1 状态机 (需 python+cv2, 慢)
npx tsx scripts/parity-motion.ts "videos/3 4.375.MP4" --ffmpeg # 再验 TS ffmpeg 链路 (更慢)
npx tsx scripts/parity-bface.ts                        # B 面网格 (需 python+cv2+ffmpeg, 慢)
```

依赖 (运行期): ffmpeg + ffprobe (抽帧/探测)。差分脚本另需 python + cv2。
