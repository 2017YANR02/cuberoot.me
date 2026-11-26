# 任意阶魔方的上帝之数

本项目用 Lean 4.35.0 和 Mathlib（提交 `56a005855ea17e0b0958f73ec801ae140b0a1679`）形式化标准六色 (n × n × n) 魔方的最坏最少步数。Lean 源码由 Codex 于 2026-11-26 在 CubeRoot 本地项目中编写。数学结果归原论文作者。

## 已证明的主定理

记 D(n) 为所有合法局面的最大最短复原步数，L(n) = n²/log₂ n。一次合法操作选一条坐标轴和其中一层，转 90°、−90° 或 180°，均算一步。复原要求六面回到固定的目标配色。[模型与距离](Bounds.lean)

| Lean 定理 | 数学结论 |
| --- | --- |
| [`paper2011`](Main.lean) | D(n) = Θ(L(n))。两侧给出正常数，对所有充分大的整数 n 成立。 |
| [`paper2026`](Main.lean) | 对每个 ε > 0，对所有充分大的整数 n 都有 (C − ε)L(n) ≤ D(n) ≤ (61/2 + ε)L(n)，其中 C = ¼ log₂(24!/(4!)⁶)。 |
| [`almost_all_lower`](Typical.lean) | 从合法彩色局面均匀抽取，对每个 0 < ε < C，最少步数 ≤ (C − ε)L(n) 的概率趋于 0。 |
| [`typical_factor_237`](Typical.lean) | 存在 η > 0，使 (61/2 + η)L(n) 最终足以复原任何局面，且最优步数的 2.37 倍低于这个预算的局面占比趋于 0。 |

2011 年的原始结果出自 Erik D. Demaine、Martin L. Demaine、Sarah Eisenstat、Anna Lubiw 和 Andrew Winslow。2026 年预印本的作者为 Jeremy Mrzyglocki、Tomas Rokicki、Maxine Perroni-Scharf 和 Erik D. Demaine。后者给出 30.5 上界，并列出已知计数下界的系数 C ≈ 12.88。[2011 年论文](https://arxiv.org/abs/1106.5736) · [2026 年论文与附录 F](https://arxiv.org/html/2611.11018v1) · [作者的程序和数据](https://github.com/rokicki/brob-paper-data)

## 证明是怎么连起来的

1. **普通中心轨道如何复原。** 一对有序、不同的浅内层深度决定一条有 24 枚贴纸的轨道，每面四枚。三个子网络分别解决 24 选 8、16 选 8 和 8 选 4。Lean 检查附录 F 的 47 条代表转法、位表证书与实际线号的对应，以及旋转子网络后的六色分组。最后一个子网络使用三个方向，合计 24 + 16 + 3 × 7 = 61 级。[代表转法](Representatives.lean) · [证书](Permnet61.lean) · [集合路由](SetRoutes.lean) · [六色分组](ColorRouting.lean)
2. **为什么步数的系数是 30.5。** 每条代表转法恰有两次列转，至多八次行转、二十次外层转。在 r 个行深度和 c 个与之不相交的列深度上，执行任意交点选择的步数至多为 2c + (20 + 8r)2ʳ。同组的行列深度另行处理。取适当的对数级条带宽度，每级至多消耗 (½ + ε)L(n) 步。61 级累计得到 30.5。[分组步数与作用](StripAction.lean) · [网格分解](GridStage.lean) · [极限估计](StageBound.lean) · [任意合法打乱的普通中心](GenericCenters.lean)
3. **角、棱和特殊中心如何计入。** 本形式化给出统一的存在性证明。在这些贴纸上，任意打乱只需保留公共层和至多一个额外内层深度。把共同的转动抵消后，各个深度可独立处理。每个投影只用固定数量的层，在有限的符号状态空间上可压缩到一个与 n 无关的步数 K，合计至多 (2n + 1)K。Lean 同时证明 61 级中心转法保持这些贴纸的位置。[有界压缩](Compression.lean) · [线性步数](Sparse.lean) · [轨道分类](Surface.lean) · [中心转法的作用范围](NoSpill.lean) · [整魔方拼接](Main.lean)
4. **为什么最坏局面至少要这么多步。** 令 Y = ⌊(n − 2)/2⌋。Y(Y − 1) 个普通轨道可独立指定配色，每个至少有 24!/(4!)⁶ 种。半径 k 的球至多含 (9n + 1)ᵏ 个彩色局面。比较这两个计数并取极限即得到 C。较短的 2011 下界另有一份独立的单文件证明，对每个 n ≥ 16 给出 D(n) ≥ L(n)/128。[合法局面计数](Counting.lean) · [精细下界](SharpLower.lean) · [独立的显式下界](Bounds.lean)

`paper2011` 的上界复用 2026 年的更强结果。上述形式化覆盖三维魔方的直径和均匀局面的步数比较。特殊块的压缩使用有限性与经典选择，K 是存在性常数。作者求解器的实际速度、内存和具体代码属于另外的结论。

## 在本机复核

在项目根目录 `research/cubing-lean/` 运行以下命令。本项目的 `lake-manifest.json` 固定依赖版本。

```sh
lake build
lake env lean -DwarningAsError=true CubeDiameter/Main.lean
lake env lean -DwarningAsError=true CubeDiameter/Typical.lean
lake env leanchecker CubeDiameter.Main
lake env leanchecker CubeDiameter.Typical
lake env lean Audit.lean
```

从新环境获取所需 Mathlib 二进制缓存可运行 `bash cache.sh`。从单文件重新检查较短的 2011 下界可运行 `lake env lean -DwarningAsError=true CubeDiameter/Bounds.lean`。[Audit.lean](../Audit.lean) 输出主定理的类型和传递依赖的公理。计算证书采用 Lean 内核归约。
