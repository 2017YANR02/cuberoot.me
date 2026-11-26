---
name: math-paper-lean
description: 协助撰写、修订英文 LaTeX 数学论文，并将主定理和推论与可复验的 Lean 形式化证明对齐。用于数学预印本、arXiv 源码包、论文配套证明、网页全文和成果发布。
---

# 数学论文与 Lean 证明

**先钉住命题。** 写出模型、对象、量词、条件和精确结论。对照原论文的定理编号，检查符号、运算方向与适用范围。分别说明前人已经证明什么、本稿加强了什么、自己的证明用了谁的引理。优先权要有文献证据；Lean 核验能支持的是命题在指定模型内成立。

**让论文和 Lean 对得上。** 为每个主要结论找到或写出具名的 Lean 声明，逐项对照假设与结论。列明哪些桥接结果仍靠文献，例如块坐标与实际面转可达性的等价。正文若采用另一条证明路线，明确 Lean 检查的是哪一条。较弱的已知结论可以从强定理写成可核验的推论。

**把核验跑一遍。** 固定 Lean 和 mathlib 版本，在本地从源码构建对应模块，检查主定理及其推论的传递公理，并用匹配版本的内核检查器重检。检查占位证明、自定义公理和额外信任依赖。计算机辅助证明要交代见证怎么产生、谁检查它们、为什么覆盖所有情况。报告实际通过的检查及尚未形式化的部分。

**写给读者。** 本项目的预印本默认全英文 LaTeX，使用作者确认过的署名。摘要写具体结果和证明方法；引言尽早给出主定理，正文解释关键难点，可用一个小例子说明。注明文献和 AI 的实际参与。用户给了排版样本时，先量纸张、版心和字号，再检查公式、分页和引用。

**判断成果性质。** 按同一模型、度量和阈值列出前人最好结果、证据方法、本稿精确定理和对应 Lean 声明。标出首次性查重的日期、范围与最近的原始文献。较弱数值的确定性证明可以作为方法贡献。把优先权待核实的稿件标为审阅稿或预印本，说明是否同行评审。

**打包与发布。** 本地保留规范英文 LaTeX，从同一源生成可在线阅读的全文、PDF 和可下载的 LaTeX＋Lean 源码包，包含依赖锁、验证命令和所需证书。解包复编并核对文件。确认有超出前人的成果时，在当次授权范围内正式发布到网站，在对应定理旁提供全文、PDF 和 GitHub 下载直链。GitHub 文件或 Release 绑定同一提交或版本。在公开环境打开全文、下载 PDF 和 ZIP 并核对内容后，才报“已上线”。用户要求本地暂存或统一提交时，完成本地交付，保留待发布状态。网站发布与 arXiv 投稿分别处理。

**本仓库的例子。** [换位子论文](../../../research/cubing-lean/papers/full-cycle-commutators/main.tex) 的验证可在 `research/cubing-lean/` 依次运行 `lake build CubeComm`、`lake env lean -DwarningAsError=true papers/full-cycle-commutators/AuditPaper.lean`、`lake env leanchecker CubeComm`。其他论文换成自己的模块、[审计声明](../../../research/cubing-lean/papers/full-cycle-commutators/AuditPaper.lean)和假设。要同步生成网页、PDF 和源码包，把 `pdflatex`、`latexmlc` 和 Python 3.11+ 加入 `PATH`，在同一目录运行 `node papers/full-cycle-commutators/render-web.mts`。
