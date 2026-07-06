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

### 引擎 (物理语义, 2026-07-06 完成, 已验证)

- **`src/rotation-perms.ts` + `src/anchored-search.ts`**: 三种语义并存, 辨析见 rotation-perms.ts 头注 — ① canonical (cube-state 逐 token apply, 转体=恒等, r≡L); ② conjugated (cube-state 整串 apply); ③ **physical (转体是真实贴纸置换, 中心块动) — 搜索/回放/观测一律用这套**。转体置换经 162 条共轭恒等式对 functions.cpp 面映射表验证。
- **oracle 结论 (5 GT 视频, 仿真观测)**: 物理语义 + 逐段 B 面观测 (噪声 12.5%) → **5/5 锚定, 逐段 99.1%, 4/5 编辑距离 0**(Phase-1 canonical 只有 87.3%): 中途 y'、宽转、U'D、x 捆绑全部精确还原。跑法: `npx tsx scripts/oracle-eval.ts --beam 2048 --mode vis`; 面身份边缘化 + 随机 κ + B/U 漂移版: `--mode visface` (B/U 限面 **5/5 锚定 92.1%**, `--allfaces` 关限面对照 65.9%)
- **敏感性包络 (定提取器 KPI)**: 噪声 0.25 → 5/5 99.1%; 0.35 → 1/5 崩。**整段丢观测是头号杀手**: dropout 0.4 → 0/5 (哪怕格子全对); 每段只见 5/9 格但全覆盖 → 3/5 90%。→ **提取器 KPI: 每边界覆盖率 > 单格准确率 (但准确率也要 ≥75%)**。
- 锚定 ≠ 正确: 短序列存在"另解"碰巧锚定 (如 R F2x' F2x' u'), 靠观测得分区分。y+U/D 同轴组合有等价写法 (R U y' R U ≡ R d R U), 搜索可能输出更紧凑的宽转写法。

### 相机约定 (2026-07-06 金标验证 + 共轭语义修正, 单测锁死)

- **无列镜像**: 相机 3×3 行主序直接对应 B 面 facelet 45..53 同序 (video3 帧 681 逐贴纸金标)。`bface-color.ts` 的列镜像是 Python 旧布局的约定, **勿沿用**。
- **共轭分解 (最关键)**: 相机态 = ρ⁻¹∘R_t∘ρ (GT 系与相机系差常数旋转 ρ)。拆两半:
  - **内侧 (位置重排)**: 被"指派边缘化"吸收 — 合法指派集 = **24 个朝向 ρ 的 B 窗口回拉** `assign[i]=ρ[45+i]` (`FACE_ROT_ASSIGN`)。**勿用 facelet 下标网格 rot90 硬造** — 各面下标布局从外侧看未必行主序, 硬造过一次, 真实数据得分≈随机才查出来 (两种指派集在本状态机布局下恰好数值等价, 但推导必须走窗口回拉)。
  - **外侧 (常数颜色重标 κ, video3 = y2: G↔B/O↔R)**: **不被指派吸收**! 搜索靠 24 朝向初始 beam 吸收 (真路径 S'_t = ω∘R_t, ω=κ), 因此**锚集必须左复合 {ω∘打乱态}** — 右复合 {打乱态∘o} 只在 κ=id 的纯仿真里与之相交, 真实数据下不含真路径 (潜伏 bug 已修, `test/anchored-search.test.ts` κ≠id 用例锁死)。离线指标里 κ 按视频拟合 (24 候选全局最优, `real-eval.ts bestAssign`)。
- **面身份随持握漂移**: 起手慢速期相机看 B 面, 从第 2-3 步起选手前倾, 相机主要看 U 面 (斜视角)。观测模型**面身份边缘化** (`RawFaceObs`/`logRawObs`, 指派集可 `rawFaces` 限面)。oracle `--mode visface` 仿真此设定 (含随机 κ + B/U 漂移)。
- **限面收益 (oracle, 12.5% 噪声, 随机 κ)**: 全 24 指派边缘化 65.9% → B/U 限面 (8 指派) **92.1%, 5/5 锚定** — 边缘化的证据稀释大部分可由持握先验收回。

### 真实提取 (WIP, `src/sticker-blobs.ts` + `scripts/dump-frames.ts` / `real-eval.ts` / `debug-blobs.ts` / `diag-*.ts`)

- 管线: 全程连续 framedump (960×540) → `activityMask` (跨帧稳定性掩码) → 同色连通域色块 → 反光环带重标 (W 块 1.25× 壳层放宽饱和色相投票) → 多色簇 + 尺寸一致性过滤 → RANSAC 仿射基网格 (斜面门槛: |sin|>0.4, det>0.12·medNN²) + **Gauss 基约减** (幺模歧义, 不约减 3×3 窗口会斜) → 顺序多晶格 (≤2 面/帧, 拟合后移除内点再拟合) → 格心采样 → **静止区间检测** (跨帧网格一致 ≥2 帧成链, 空帧桥接 ≤2; 中动作模糊帧成不了链, 从源头挡毒观测) → 区间共识网格归属最近 split。
- **观测按静止区间而非逐边界强读的原因 (踩过的坑)**: 标注 split 是手部动作起点, 实际拧转滞后 0~8 帧不等; 逐边界就近强读会把**邻段状态**当本段观测 (同一可读帧被归到多个边界), 对搜索是毒药 (比 dropout 更狠)。归属规则 (区间就近/终点锚定) 命中率都只有 ~1/3, 时间归属本质不可靠 — 后续要靠状态匹配对齐 (搜索侧)。
- **现状数字 (2026-07-06, 诚实)**: 逐帧提取成功率 ~25% (115/446, 双面帧仅 1); 边界覆盖 18.3% (42/229); 读格边缘化准确率 61.1% (乱态对照底噪 45.9%); 软覆盖天花板 12% (±12 帧内 ≥75% 匹配区间); **帧级软覆盖 ±12: 24% / ±25: 33%** (不要求成链, 状态对齐方案上限) — 对照 dropout 包络 (40% 丢失即 0/5), **静止区间模型对 4-4.6s 快速还原覆盖不够, 端到端 0/5 (逐段 17.5%) 是结构性的**。慢速段读数很好 (起手 88-100%), 中盘快速段是盲区 (斜持 + 手遮挡 + 运动模糊, 单面可见贴纸仅 4-6 块)。
- **已证伪的微调**: minArea 220→130 (小噪声块搅碎晶格, 覆盖反降); GT 最优选帧天花板也只有 57-66% (选帧策略不是瓶颈)。
- **陷阱**: ① 背景中位数**不能**从边界帧建 (魔方整场悬在画面中央, 中位被魔方色污染, 会吃掉同色贴纸) — 用 activityMask; ② 反光核心到饱和色间有去饱和过渡带 (s 25~110), 环带投票必须放宽饱和阈; ③ 选手穿亮绿外套 + 计时器黄 logo + 垫角魔方图案, 全靠 activityMask + 多色簇滤掉; ④ `*.framedump.*` gitignored (~700MB/视频), 重建跑 `npx tsx scripts/dump-frames.ts`; ⑤ ffmpeg select 表达式 ~100 项解析崩 ("Cannot allocate memory") — 现用单一 between 区间已规避。
- **下一步方向 (按杠杆排序)**: ① **中动作部分证据** — 大多数帧在转动中, 非转动层 2/3 贴纸静止可读; 评分按 token 转动层掩码对段两端态分位置比对 (提取端已支持部分格, 改评分端); ② **模型基 3D 姿态跟踪** (6-DoF + 已知配色, 一帧读 3 面, 抗模糊) — 大建设, 动手前先 WebSearch prior art; ③ 搜索侧状态对齐取代时间归属 (区间集合喂搜索, 边界从邻近区间挑与路径态最匹配者); ④ 新标注视频拍摄建议: 机位稍高俯拍 (正对顶面), 避免顶面反光。

### 旧 Python 链 (冻结存档)

- Step 2 分类 ~60–63% 逐段准确率撞天花板; 根本瓶颈是 229 样本 + 极端不平衡（`roadmap.md` §11 有完整失败实验清单，别重复踩）
- Step 1 自动分段与手标差距大（video 3: 自动 12 段 vs 手标 45 段），oracle 实验全部基于手标分段；生产化需分段容错（搜索已支持空段/复合段候选）
- ROI 坐标（`template_cnn.py` / `greedy_reverse.py`）为 4K 硬编码且**固定 ROI 已被目检否决**(魔方大范围移动), TS 侧一律整帧降采样 + 逐帧定位
