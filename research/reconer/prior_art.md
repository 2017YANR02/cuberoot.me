# Prior art: 从视频恢复魔方转动 (2026-07-06 调研)

> 结论先行: **端到端现成方案不存在** — 本项目没有竞品。最有希望的观测层架构是
> 模型基 6-DoF 跟踪 (region + 状态假设动态渲染纹理) + 手部关键点序列作第二证据通道,
> 与现有"面概率 + 已知打乱约束波束搜索"贝叶斯融合。以下按方向归档。

## 1. 模型基 6-DoF 姿态跟踪 (学术成熟, 无魔方专用方案)

| 项目/论文 | 方法 | 成熟度 |
|---|---|---|
| [DLR-RM/3DObjectTracking](https://github.com/DLR-RM/3DObjectTracking) (Stoiber 系: RBGT→SRT3D→ICG→**M3T**) | region-based: 轮廓两侧颜色统计做稀疏对应; M3T 融合纹理/深度/多区域, 只需 CAD mesh, 数百 Hz | 高, C++/MIT, DLR 维护, 同类最强开源 |
| [DeepAC](https://github.com/WangLongZJU/DeepAC) (ICCV 2023, ZJU) | 学习版主动轮廓: 投影 CAD 轮廓 + 轻量网络预测位移, 纯 RGB 手机实时 | 高, 开源, RBOT/BCOT/OPT SOTA |
| [MegaPose](https://github.com/megapose6d/megapose6d) (CoRL 2022) | novel object render & compare 粗估+精化, 纯 RGB, 抗严重遮挡 | 高, 开源, 慢 (离线可接受) |
| [FoundationPose](https://github.com/NVlabs/FoundationPose) (CVPR 2024, NVIDIA) | 统一 6D 估计+跟踪基础模型, 给 CAD 即用 | 很高; **需 RGBD**, 普通视频无深度是硬伤 |
| [Seibold et al. 2017, CVIU](https://www.sciencedirect.com/science/article/pii/S1077314217300590) | 已知几何 + analysis-by-synthesis, **显式建模运动模糊, 把 blur 当曝光内运动的信息源** | 老, 无维护代码, 但思路与本场景严丝合缝 |
| 事件相机系 (EDOPT / Event6D CVPR 2026) | 事件相机天然无模糊跟快速物体 | 不适用 (普通 RGB), 仅换传感器时参考 |

魔方特有难点: ① 裸立方体轮廓 90° 旋转对称 → 纯轮廓法姿态歧义, 必须用贴纸纹理消歧;
② 贴纸纹理随每步转动变化 → **纹理模板应由波束搜索的状态假设动态渲染** (render & compare
残差 = 该假设的观测似然, 与搜索天然耦合); ③ 遮挡用 M3T 类 occlusion-aware 降权。
利好: 100fps 帧间位移极小, 局部优化型跟踪器最吃这个; 离线处理不用实时。

## 2. 现成"魔方视频自动 recon"工具: 空白

社区 recon ([reco.nz](https://reco.nz/), speedcubing.com) 全人工逐帧; 自动化全走智能魔方硬件
([Cubeast](https://www.cubeast.com/), csTimer 蓝牙), 不走视频。最接近的原型:

- **[felikemath/Rubik-s-Cube-Move-Detection](https://github.com/felikemath/Rubik-s-Cube-Move-Detection)**
  (UCLA 学位论文, 最相关): YOLOv8 检测 + 序列分类; LSTM(42 手部关键点) 82.4%,
  ConvLSTM(魔方图像时空) 91.8%, **融合 94.1%**。只认 R/U/F 三种转动、非速拧速度、~40 序列。
  启示: **手部关键点序列是 move 分类的强特征** (可作面概率之外的独立证据源)。
- [CubeLabsNZ/CubeCV](https://github.com/CubeLabsNZ/CubeCV): DINO+LangSAM 扫面录入, 手挡即挂。
- 其余 (dwalton76/rubiks-cube-tracker, kkoomen/qbr 等) 全是静态扫面工具。

## 3. 手部遮挡下的物体状态估计 (相邻领域)

- **[OpenAI Rubik's Cube Robot Hand](https://arxiv.org/abs/1910.07113)** (2019): 3 相机 CNN + ADR
  纯视觉估计姿态与 face angles; **真机仍主要靠改装 Giiker 内置传感器** — "面被遮挡时从外部
  很难知道魔方状态"。反面支持本项目路线: 逐帧硬读不可靠, 要靠已知打乱 + 群论约束 + 序列融合
  把观测要求降到"弱证据也够用"。
- **[ComPose](https://arxiv.org/abs/2605.23523)** (2026-06): 把手从遮挡物翻转为互补线索 —
  foundation model 同时取物体+手部线索联合优化, 纯 RGB 无 CAD。思想可搬:
  **手指捏层转动时, 手的运动就是层转动的代理观测**。
- [HOT3D](https://facebookresearch.github.io/hot3d/) (Meta): 370 万帧手物交互数据集, 可作评估参照。
- 视觉-触觉融合系: 都要触觉传感器, 不适用。

## 4. 对本项目的三点结论

1. 没有轮子可抄; "逐段面概率 + 已知打乱约束搜索"的自研架构方向没走偏。
2. 观测层三路证据融合蓝图: 模型基 6-DoF 跟踪 (状态假设渲染纹理) + 手部 landmark 序列
   (MediaPipe hands 级) + 现有面概率分类器, 全部喂进约束搜索。
3. 运动模糊走 Seibold 2017 "blur 即信息"思路, 不要盲目去模糊; 大面积手遮挡没有任何方法能
   逐帧硬解 — 所有成功案例本质都是引入额外先验/通道, 本项目的贝叶斯式融合正是共识解法。
