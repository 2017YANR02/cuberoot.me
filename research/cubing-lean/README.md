# Cubing Lean

Machine-checked mathematics of the Rubik’s Cube, developed in Lean 4 with mathlib. 魔方数学的 Lean 形式化证明。

[Theorems on CubeRoot](https://cuberoot.me/math/cubing-lean) · [网站中文版](https://cuberoot.me/zh/math/cubing-lean) · [Contribute / 认领题目](CONTRIBUTING.md)

| Theorem / 定理 | Model and result / 模型与结论 |
| --- | --- |
| [`CubeDiameter.paper2011`](CubeDiameter/Main.lean#L97) | **Diameter / 上帝之数**. On a six-colour n × n × n cube, any single-layer quarter or half turn costs one move. The worst optimal distance grows as Θ(n²/log₂ n). 单层转 90°、−90° 或 180° 均算一步。 |
| [`CubeDiameter.paper2026`](CubeDiameter/Main.lean#L90) | For every ε > 0 and all sufficiently large n, D(n)/(n²/log₂ n) lies between C − ε and 30.5 + ε, where C = log₂(24!/(4!)⁶)/4. 对所有充分大的阶数成立。 [Exact statements / 完整命题](CubeDiameter/Targets.lean) |
| [`CubeComm.every_even_cube`](CubeComm/Universal.lean#L29) | **Commutators / 换位子**. In fixed-centre 3 × 3 × 3 cubie coordinates, every legal state with even corner and edge permutations is ABA⁻¹B⁻¹ with both factors of order 24. 角、棱位置置换均为偶时，两个因子都可以取为 24 阶。 |
| [`CubeKernel.Physical.physical_kernel`](CubeKernel/Main.lean) | **Short solutions / 高阶魔方短解**. For a legal six-colour cube of order n ≥ 2 and a budget k in the single-layer turn metric, the algorithm certifies a negative answer or returns an equivalent cube of the same parity and order at most 4k+7. The [dense kernel](CubeKernel/Packed.lean) stores at most 6(4k+7)² stickers. The same reduction works for a fixed target colouring and for [six distinctly coloured monochromatic faces](CubeKernel/Monochrome.lean). |
| [`CubeMixing.mixing_time_at_least_25`](CubeMixing/Main.lean) | **Mixing / 随机转动**. Starting from solved, choose independently and uniformly among 18 outer face turns of the fixed-centre 3 × 3 × 3 cube. After 24 moves the total variation distance from uniform is at least 0.2549065932, so the mixing time at threshold ¼ is at least 25. [Exact rational bound](CubeMixing/Bound.lean) |

**Sources and scope / 来源与范围.** The [2011 paper](https://arxiv.org/abs/1106.5736) is by E. D. Demaine, M. L. Demaine, S. Eisenstat, A. Lubiw and A. Winslow. The [2026 preprint](https://arxiv.org/abs/2611.11018) is by J. Mrzyglocki, T. Rokicki, M. Perroni-Scharf and E. D. Demaine. Codex wrote the local diameter formalization for CubeRoot. Its 2011 upper bound reuses the stronger 2026 bound. The commutator theorem is stated in the coordinate subgroup defined by parity and orientation constraints. Its identification with physical face-turn reachability uses the classical cubology theorem described in the project notes. [直径证明与作者归属](CubeDiameter/README.md) · [换位子证明、模型与文献](CubeComm/README.md)

The short-solution and mixing proofs were developed in this repository. Mathematical priority remains open. Demaine, Eisenstat and Rudoy prove NP-completeness with the budget supplied as input. Their six-colour STM problem allows any assignment of six different colours to the six solved faces. The reduced instance here works simultaneously for all those targets. Qu, Rokicki and Yang report a mixing lower bound of 26 using sampling at step 25. The formalized bound of 25 uses exact word counts at step 24. [STACS 2018, Problem 2](https://erikdemaine.org/papers/Rubik_STACS2018/paper.pdf) · [Qu, Rokicki and Yang, §3](https://arxiv.org/html/2410.20630#S3) · [证明思路与待解决问题](RESEARCH-QUESTIONS.zh.md)

For a dense six-face input and a fixed target, `CubeKernel.Physical.PackedCube.findShort` returns a solving word in the **original** layer indices when one exists within the budget. The full search on the reduced cube considers at most (9(4k+7)+1)ᵏ candidate words per target. The monochromatic decision procedure checks up to 720 assignments on the same reduced cube. The mixing result applies to the six colours actually seen on the 54 facelets. [Solving word](CubeKernel/Solution.lean) · [Search bound](CubeKernel/Cost.lean) · [Colour assignments](CubeKernel/ColorTargets.lean) · [Visible-state law](CubeMixing/ColorLaw.lean)

The English working manuscript for the short-solution theorem is available as [LaTeX](papers/short-solution-kernel/main.tex), with a [paper-specific axiom audit](papers/short-solution-kernel/AuditPaper.lean). To regenerate the web edition, PDF and downloadable source bundle in the full checkout, run `node papers/short-solution-kernel/render-web.mts` from this directory with LaTeXML, pdfLaTeX and Python 3 on the path.

## Verify locally / 本地复核

Install [elan](https://lean-lang.org/install/), which selects the compiler from [lean-toolchain](lean-toolchain). Only this directory is needed to build the proofs. 已有本仓库的贡献者在仓库根目录运行 `cd research/cubing-lean`，然后从 `bash cache.sh` 开始。首次安装需联网，验证不依赖网站、Node.js 或数据库。

```sh
git clone --filter=blob:none --sparse https://github.com/2017YANR02/cuberoot.me.git
git -C cuberoot.me sparse-checkout set research/cubing-lean
cd cuberoot.me/research/cubing-lean
bash cache.sh
lake build
lake env lean -DwarningAsError=true Audit.lean
LEAN_NUM_THREADS=2 lake env leanchecker --verbose CubeDiameter CubeComm CubeKernel CubeMixing CubingLean
```

In an existing checkout, run `cd research/cubing-lean` from the repository root. Each topic has its own build target, such as `lake build CubeKernel` or `lake build CubeMixing`. Use `import CubingLean` for the full library. The [audit](Audit.lean) checks transitive dependencies of the listed declarations against `propext`, `Classical.choice` and `Quot.sound`. The final command replays the project modules with Lean’s kernel. [CI](../../.github/workflows/cubing_lean.yml) runs the same commands on proof changes.

只做一个专题时可单独构建。公理审计会拒绝清单以外的公理，包括证明占位符 `sorryAx`。最后一条命令让内核重检四个专题和公共入口。[License / 许可证](../../LICENSE)
