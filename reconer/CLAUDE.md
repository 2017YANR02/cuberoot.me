# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目目标

魔方速拧视频自动复盘工具：输入第三人称速拧视频，输出标准 WCA notation 复盘公式（`F L2 D' L' U R' ...`）。准确率目标 ≥80%，允许人工修正剩余部分。设计与实验记录见 `plan.md` / `roadmap.md` / `human.md`（均为中文，是理解本项目的必读背景）。

## 相机几何（最关键的非直觉前提）

第三人称机位与选手视角是**镜像**关系。相机主要看到的是 **B 面**（正对、大面积），不是 F 面：

| 相机中位置 | 实际面名 | 可见度 |
|-----------|---------|--------|
| 正对（最大） | B | ★★★★★ |
| 画面右侧 | L | ★★★ |
| 画面左侧 | R | ★★ |
| 顶/底边缘 | U / D | ★★ / ★ |
| 远侧 | F | 不可见 |

推论：相机的左 = B 面的右列（索引 47,50,53），相机的右 = B 面的左列（索引 45,48,51）。`greedy_reverse.py` 里 B 面 3×3 提取做了这个镜像重排。**L/R 混淆 + 数据不平衡（R:81, L:29）是准确率的头号瓶颈。**

## 三步流水线

```
视频 → [motion_detect] 分段 → [template_cnn] 分类出概率分布 → [greedy_reverse] 逆推 → 复盘公式
       Step 1              Step 2                          Step 3
```

开发时用手工标注的 `*.splits.txt` 替代 Step 1 输出，隔离误差。核心洞察（`human.md`）：**从 Solved 态逆序倒推**，因为末帧状态唯一确定，每一步都可与视频对照验证 —— 逆向搜索优于正向逐帧猜测。

## 核心文件

| 文件 | 作用 |
|------|------|
| `cube_state.py` | 54-sticker 置换魔方状态机，完整 WCA 符号。**置换表移植自 `functions.cpp`（该文件不在本仓库）**。`python cube_state.py` 跑内置测试。 |
| `template_cnn.py` | Step 2 主流水线：ResNet18(512d)+HS 直方图差分(96d)=608d → PCA+KNN / MLP → 写 `*.probs.json` |
| `greedy_reverse.py` | Step 3 逆推引擎：读 probs.json + 视频帧，从 Solved 逆推每步。当前为贪心单路径，roadmap 计划升级为 beam search |
| `motion_detect.py` | Step 1 运动检测分段：`python motion_detect.py <video.mp4>` |
| `lovo_test.py` / `quick_mlp_test.py` | 评估/调参脚本，从 `features_cache.npz` 加载（不重读视频） |

其余 `*_analyze.py` / `*_debug.py` / `template_match*.py` / `optical_flow.py` / `facelet_track.py` 等是实验性脚本，多数已验证无效（见 `roadmap.md` §11 实验记录），改动前先确认是否是死路。

## 数据格式（`videos/`）

- `*.MP4` — 原始 4K/100fps 视频，单个 500–800MB，已 gitignore
- `*.splits.txt` — **Ground Truth**。首行 `Splits:679:686:...`（帧号，N+1 个点对应 N 段）+ 复盘 notation 行（每个 token 是一段的标签）。`template_cnn.py` 和 `greedy_reverse.py` 都靠这个文件对齐
- `*.probs.json` — 每段的 Top-K 面概率分布（Step 2 输出，Step 3 输入）
- `features_cache.npz` — 608d 特征缓存。**改视频/改 ROI 后必须手动删除重建**，否则用的是过期特征

## Notation 约定（见 `plan.md` 末尾「复盘说明」）

- 涉及：U D L R F r f x y；**不涉及 B E M S z**
- CubeState facelet 顺序：U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53)；颜色 id：U=0 R=1 F=2 D=3 L=4 B=5
- `x` 转体不单独分段（与前一动作捆绑，如 `L2'x'` 算 1 段）；`y` 单独分段
- `x y` 转体不计入步数
- `UD'`（中间无空格）= 同时开始/完成，属同一段但算 2 个转动
- `↑↓·` 是指法记号，`...` 是卡顿，解析时都要剥离（`splitByFingering`）
- splits.txt 末尾的 `y2` / `z2` 等是用户加的朝向校正，不对应视频段（`greedy_reverse.parseGT` 里作为 `tailRotations` 分离）

## 常用命令

```bash
python cube_state.py                                    # 跑状态机单元测试
python template_cnn.py                                  # 完整分类流水线（首次~3min 提特征，之后读缓存）
python greedy_reverse.py "videos/3 4.375.MP4.splits.txt" # 单视频逆推复盘 + 与 GT 对比
python lovo_test.py                                     # Leave-One-Video-Out 评估（需先有 features_cache.npz）
python quick_mlp_test.py                                # MLP 超参搜索
```

无 `pyproject.toml` / `requirements.txt`；依赖：`opencv-python`(cv2) `numpy` `torch` `torchvision` `scikit-learn`。脚本从仓库根运行，硬编码相对路径 `videos/`。

## 当前状态与陷阱

- Step 2 分类已到 ~60–63% 逐段准确率并撞天花板；根本瓶颈是 229 样本 + 极端不平衡，特征工程收效甚微（`roadmap.md` §11 有完整失败实验清单，别重复踩）
- Step 3 逆推是早期版本（贪心、单路径、视觉评分粗糙），是主要开发方向
- ROI 坐标（`template_cnn.py` 顶部 `ROI_X1..` / `greedy_reverse.py` 的 `ROI_B_FACE`）为 4K 硬编码；`roadmap.md` §12 计划迁移到 1080p30fps，届时需重标 splits + 调 ROI + 删缓存
