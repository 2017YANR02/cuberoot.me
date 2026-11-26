# 每个三阶魔方偶局面都是两个 24 阶局面的交换子

对于标准固定中心三阶魔方的每个合法偶局面 `g`，存在合法局面 `A` 和 `B`，满足

```text
A B A⁻¹ B⁻¹ = g
order(A) = order(B) = 24
```

每个因子都让 8 个角块组成一个循环、12 个棱块组成一个循环。“偶”指角块位置置换和棱块位置置换均为偶置换。单位元、纯翻棱、superflip 和任意编号的混合局面都包括在定理内。复合从右向左读。

总定理是 [CubeComm.every_even_cube](Universal.lean)。其中 `A B : cubeGroup` 保证两个因子本身合法，`FullCycles` 给出循环结构，Mathlib 的 `orderOf` 给出精确阶数。

## 在本地复验

这份源码包固定使用 Lean 4.35.0，Mathlib 固定到提交 `56a005855ea17e0b0958f73ec801ae140b0a1679`。装有 elan 的机器从项目根目录 `research/cubing-lean/` 运行

```sh
bash cache.sh
lake build
lake env lean -DwarningAsError=true Audit.lean
```

第一条准备依赖的编译缓存，首次安装需要联网。第二条构建两个专题。第三条检查列出的定理及其传递公理。总定理的依赖清单为 `propext`、`Classical.choice` 和 `Quot.sound`。项目证明没有使用 `sorry`、自定义公理或 `native_decide`。

另可用 `lake env leanchecker CubeComm` 对项目各模块的声明做内核重检。复验不需要运行 Python。两个证书表和循环类型标签均随源码提供；可选的 `python3 generate.py` 用固定种子重新生成它们，Lean 会独立核对每份见证和每个标签。

## 证明如何覆盖所有局面

1. **标准代表与朝向。** 角块有 12 种偶置换循环类型，棱块有 39 种非恒等偶置换循环类型。为每个标准代表构造两个全长循环，并用角朝向模 3、棱朝向模 2 的方程核验 513 个基向量见证。任意合法朝向可分解为这些基向量的组合。[证书数据](Rows.lean) · [朝向组合证明](Certificate.lean)
2. **棱位置不动的情形。** 对翻转向量的三个六元素子集取奇偶校验。第三个校验值是前两个之和，故总有一个校验值为零。对应的 12 循环给出合法因子，覆盖全部 2,048 种偶数翻棱模式。[纯翻棱](PureFlips.lean)
3. **从代表回到实际编号。** Lean 直接计算每一行代表的 Mathlib 循环类型，并证明目录覆盖任意偶置换可能的类型。利用同循环类型置换共轭，将目标朝向带入代表的编号，再把两个因子带回原编号；每一步都保留朝向总和和交换子等式。[分类](Classification.lean) · [目录核验](Catalog.lean) · [重新编号](Transport.lean)
4. **合法性与精确阶数。** 角、棱两个位置循环的置换符号都是 −1，且各自的朝向增量总和为零。走完单个位置循环时，已恰好累加全部朝向增量；在此之前位置尚未复原。因此角作用的阶为 8，棱作用的阶为 12，组合动作的阶为二者的最小公倍数 24。[单循环阶数](Oriented.lean) · [合法魔方子群](CubeGroup.lean)
5. **组合交换子。** 分别把角、棱的第一因子配成 A，第二因子配成 B，得到合法魔方子群内的等式。superflip 另有一对显式因子，可单独核验两侧逆元、交换子和精确阶数。[总定理](Universal.lean) · [superflip 例子](Superflip.lean)

## 模型与文献

`cubeGroup` 使用固定中心的标准块坐标。一个块从位置 `i` 到达 `p i` 时，朝向增加 `v i`。合法性由三条条件刻画：角、棱位置置换同奇偶，角扭转和模 3 为零，棱翻转和模 2 为零。Lean 证明这些作用构成子群，并在其中证明总定理。该坐标刻画与六面转动可达性之间的等价采用经典魔方基本定理。[Simon Fraser University 的块坐标与可达性定理](https://www.sfu.ca/~jtmulhol/permutationpuzzles/puzzles-rc-cubology.html)

既有研究已经证明每个合法偶局面都能写成单个交换子。这里形式化的命题进一步指定两个因子的循环结构与精确阶数。相关的带符号长循环工作也研究了棱块所涉及的群论问题。现有文献核对不足以判定这个加强命题或其形式化的首创性。[Commutators in the Rubik’s Cube Group](https://doi.org/10.1080/00029890.2023.2263158) · [Commutators of signed n-cycles](https://arxiv.org/html/2609.24518v1)
