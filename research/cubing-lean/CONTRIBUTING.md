# Contributing to Cubing Lean / 参与魔方形式化

Start with [existing discussions](https://github.com/2017YANR02/cuberoot.me/issues?q=is%3Aissue+%22%5BCubing+Lean%5D%22+in%3Atitle). Claim a task by commenting on its issue, or [open a Cubing Lean issue](https://github.com/2017YANR02/cuberoot.me/issues/new?template=cubing_lean.yml) with the statement and model. 欢迎用中文或英文认领题目、提交纸笔证明或指出反例。开始前请先查已有讨论，避免两个人同时做同一个引理。

For research problems with literature and Lean milestones, see the [research questions / 数学研究选题](RESEARCH-QUESTIONS.zh.md).

<a id="one-move"></a>
## First Lean proof / 一步能改变多少距离？

For any legal states s and t related by a single allowed slice turn, prove both d(t) ≤ d(s) + 1 and d(s) ≤ d(t) + 1. 证明任意阶魔方相邻两个合法局面的最短复原步数相差至多一步。沿用 [Move, paint, Position, distance and optimal_word](CubeDiameter/Bounds.lean)。这里的 `paint` 让坐标沿转动序列查回颜色，先核对 `walk_append` 的复合顺序，再用逆转证明第二个方向。

**Deliverable / 验收** — State adjacency on coloured positions, export the two inequalities for arbitrary n, import the module from `CubeDiameter.lean`, and add the theorem to [the audit](Audit.lean). 给出新定理名及本地检查结果，证明应覆盖由不同打乱序列产生的同一配色。

<a id="reachability"></a>
## Model review / 固定中心模型的可达性

Compare the subgroup in [CubeGroup.lean](CubeComm/CubeGroup.lean) with the [classical first law of cubology](https://www.sfu.ca/~jtmulhol/permutationpuzzles/puzzles-rc-cubology.html). 对照固定中心、角扭转和、棱翻转和及角棱置换同奇偶这四项，检查源码的块编号与复合方向。

**Deliverable / 验收** — In an issue, give a source for each condition, point to its Lean definition, and identify the implication still needed to connect the six physical face turns with the coordinate subgroup. 可先交带文献和源码位置的数学审阅，再据此讨论形式化方案。

## Pull requests / 提交证明

1. Name the cube model, the move metric if relevant, the theorem, and the paper or mathematical author. Credit the Lean contributor separately. 写明模型、结论与数学来源，区分原证明作者和形式化贡献者。
2. Work from [the Lean package](README.md). Import a new result from its library and add its public theorem to `Audit.lean` with `#audit_axioms`. Run the build and audit. 对同一定理的不同证明，请说明数学上改进了哪一点。
3. Open a PR to this repository and link the issue. Reviewers can check the model, proof or references individually. 外部贡献者可以 fork 后提 PR，由维护者合并。[Repository workflow / 主仓规则](../../CONTRIBUTING.md)

If you edit a theorem displayed on the website, run `node sync-site.mts` from this package in a full checkout and include the refreshed excerpt. CI compares the displayed Lean code with the proof source. 网页摘录由源码生成，网站可以独立构建。
