# Corner96：独立下界、H 证书与 NISS 余量证明补充

本文补充独立下界、H 证书、NISS 传播及短字排除的严格证明，保留外部研究交付时的推导。后续 `src/corner_oracle/eo.rs` 和 `src/search.rs` 的运行认证及性能记录见 [本地验证](corner96-validation.md)；本文的“认证”仍指构造器检查的数学条件。

## 1. 记号和证书的区别

令 G 为合法三阶魔方群，S 为源码的 18 个 HTM 面转，D(g) 为到单位元的最短长度。令 H=<U2,R2,F2,D2,L2,B2>，定义

\[
d_H(g)=\min_{a\in H}D(ag).
\]

`D` 证书是一个具体数值 L，已证明 L<=D(g)。`H` 证书是一个具体数值 L，已证明 L<=d_H(g)。后者还可在所有 ag、a in H 上原值使用；前者通常不可。

应区分“一个数值可以运输”与“在运输后的状态重新调用同一函数得到相同数值”。数学上，数值 H 证书可沿左 H 运输，即使生成证书的某个自适应算法不是逐点左 H 不变；现有 `PruningOracle` 文档采用更强的逐点不变契约，新的包装器继续遵守它。普通 D 证书可沿全部 96 个空间/取逆操作运输，因为 D 在整个轨道恒定；这不证明源启发式函数在该轨道恒定，也不把 D 证书变成 H 证书。

以下基本不等式直接来自字长：

\[
D(g^{-1})=D(g),\quad |D(gm)-D(g)|\le1,
\quad |D(mg)-D(g)|\le1\quad(m\in S),
\]

\[
d_H(ag)=d_H(g),\quad |d_H(gm)-d_H(g)|\le1.
\]

取逆不是固定右乘 Cayley 图的普通图自同构：`(gm)^-1=m^-1 g^-1` 是左乘。使用 D 的不等式不需要混淆这两个图。

## 2. EO11：2048 个状态的独立同侧 H 下界

### 2.1 从现有 Cube 算法得到闭合坐标

`src/cube.rs` 将 edge identity 放在高位、EO 放在 bit 0。记 p_g(i) 为位置 i 的 edge identity，e_g(i) 为 EO bit。现有乘法给出

\[
e_{gm}(i)=e_g(p_m(i))\mathbin{\oplus} e_m(i).
\]

所以右后继仅依赖 12 个 EO 位和给定 move，不依赖当前 EP。合法状态满足总偶校验，前 11 位唯一确定第 12 位，恰有 2^11=2048 个坐标。

这个结论使用仓库的对称 EO gauge。逐个阅读六个 `QUARTERS` 的 edge 字节可见：每个 quarter 翻转恰好本面的 4 条边，反 quarter 同样如此；half turn EO 全零。因此 e_h=0 对所有 h in H 成立，且

\[
e_{hg}(i)=e_h(p_g(i))\oplus e_g(i)=e_g(i).
\]

从 EO=0 建立精确投影距离 E(e)，有

\[
E(e_g)\le d_H(g)\le D(g).
\]

它逐点左 H 不变，可直接与同侧旧表/u/ell5 取 max 后按原 `max_bound` 截断。完整 EO 本身仍不定义坐标取逆，因为

\[
e_{g^{-1}}(j)=e_g(p_g^{-1}(j))
\]

还需要实际 EP。NISS 必须查询实际的 `Cube` 或实际 inverse `Cube`。

### 2.2 语义认证

构造器由现有 `MOVES` 生成 2048×18 后继，以 BFS 填值，然后检查：唯一零点是 EO=0；每条边的值差绝对值至多 1；每个正值状态有一条值恰减 1 的边。

前两项给 E_table(x)<=真实距离；最后一项和唯一零点给出长为 E_table(x) 的实际下降路径，所以反向不等式也成立。检查 checksum 或“值来自 BFS”这一标签本身不等于语义证书。

源码保存 2048 个 u8 值、已认证 maximum 和下文 7 个 weight minima；临时后继/队列在显式构造后释放。未增加外部文件或默认隐式建表。实际耗时没有测量。

### 2.3 两 flip 的严格新信息与 nu(2)=3

取 solved corners、identity EP，并只翻转旧 Opt8 在 solved-corner frame 下丢弃的两个 EO 位置，必要时用该 frame 的位置置换拉回。这是合法状态且 g=g^-1。旧 normal/inverse 两个 key 都与 solved 相同，corner u/ell5 也都为 0，而完整 EO 下界至少为 3。该比较针对旧的两次查询；不声称优于全部 96 个旧查询的最大值。

下面给“不可能 <=2 步得到重量 2”的完整支持集分类。设 F_A 是面 A 的 4 条边，Q_A 为任意方向 quarter，T_A 为 half。

* HH 的 EO 重量为 0。
* HQ 的 EO 为一个面，重量 4；QH 是一个 4 元集合被置换，重量仍为 4。
* Q_A Q_B 的 EO 支持为 p_B^-1(F_A) △ F_B。
* A=B 时 p_B 保持 F_A，结果重量 0。
* A 与 B 相对时支持不交且 p_B 固定 F_A，结果重量 8。
* A 与 B 相邻时 F_A∩F_B 只有一条边。p_B 保持 F_B 及其补集，故 p_B^-1(F_A)∩F_B 仍恰有一条边，结果重量 4+4-2=6。

加入 0/1 步情形后，<=2 步只可能出现重量 0、4、6、8。

手乘一个 3 步见证。由 `QUARTERS` 的 edge 字节：

\[
F_U=\{0,1,4,7\},\quad F_R=\{4,5,8,11\},
\]

\[
p_U=(0\ 4\ 1\ 7),\quad p_R=(4\ 8\ 5\ 11).
\]

于是

\[
e_{UR}=p_R^{-1}(F_U)\triangle F_R
=\{0,1,11,7\}\triangle\{4,5,8,11\}
=\{0,1,4,5,7,8\},
\]

\[
e_{URU}=p_U^{-1}(e_{UR})\triangle F_U=\{5,8\}.
\]

因此所有重量 2 状态至少距离 3，其中存在距离 3 的状态；下节的 nu(2)=3 已严格证明。这里不声称每一对翻转位置的精确距离都为 3。

## 3. 只有 7 项的 EO-only 96 不变下界

### 3.1 最小取逆稳定粗化恰为 EO 重量

固定任意合法 EO 向量 e，可以任选 EP，随后任选具有相同奇偶性的 CP，得到合法完整 Cube。因此，在同一个 EO 纤维内，取逆后的 EO 可以是 e 被任意 S12 置换后的向量。

任何只依赖 EO、又对完整状态取逆不变的函数 f，必须满足 f(e)=f(pi e) 对所有 pi in S12 成立；它只能依赖重量 k=0,2,...,12。反过来，取逆只置换 EO，故重量确实取逆不变。这同时证明“恰为”，而不只是找到一个可用粗化。

空间 M 不改变重量。更强地，在本 gauge 下空间对称在 EO 上仅为边位置置换：该映射在每个生成 move 上保持“quarter 翻转其整面、half 全零”，与右后继公式交换，并固定 EO=0；由生成字归纳得到全体状态上的结论。这里没有套用通常不对所有空间对称等变的另一种 EO gauge。

定义

\[
\nu(k)=\min_{\operatorname{wt}(e)=k}E(e).
\]

则 nu(wt(e_g))<=E(e_g)<=d_H(g)，且该函数对左 H、右 H、M、inverse 都不变。左 H 不变来自 EO 不变；右 H 的 EO 只是位置置换；后两项保持重量。

这是所有“EO-only、完整状态取逆不变、对 D 可采纳”函数中的最大者。因为 E(e)=min_{g:e_g=e}D(g)，任何此类函数在重量 k 上的常数不能超过每一个 E(e)，从而不能超过 nu(k)。有 7 个数的代价是丢弃同重量内的距离区别；同侧完整 EO 查询必然支配 nu。

### 3.2 nu 不是重量存在边商图的最短距离，也不一致

`nu` 必须从已认证的 EO 距离逐类取 min，不能把重量类任意连边后重新 BFS 并宣称得到相同值。

反例：nu(2)=3，nu(4)=1。取两 flip 支持 {0,1}，F 面支持 {0,3,8,9}，恰交一条边。右乘 F 后重量为 2+4-2=4，所以真实 EO 图有一条从重量 2 到重量 4 的边，但其 nu 值从 3 降至 1。nu 因此不满足 edge Lipschitz/consistency。

重量存在边商图有路径 0→4→2，长度 2，而 nu(2)=3。这条商路径在中间类更换了代表，不能自动提升为 EO 图中从 solved 出发的 2 步路径。该例直接展示“后继类别可列举”不等于“合并后距离精确”。nu 的可采纳和 H 不变证书仍成立；现有 NISS 安全性不能错误地额外要求它一致。

### 3.3 额外解析界：已独立手工复核，未程序核验

已手工证明 nu(0)=0、nu(4)=1、nu(6)=2（UR）、nu(8)=2（UD）、nu(2)=3。以下 nu(10)=4、nu(12)>=5 的支持分类也已完成独立手工复核；7 项实现始终从认证表取 min，不硬编码这些推导的结果。没有执行程序来验证这些数值。

两相邻 quarter 的 6-flip 集合含整个第一个面 A，并含 A 的对面上一条边。因为第二面 quarter 将唯一共享边送到其面上的相邻位置，被 XOR 消去的不是原共享边，也不是 A 对面的那条边。因此每个面都至少与这个 6 集合相交一条边。两相对 quarter 的 8 集合是两个相对整面之并，与每个面至少相交两条边。

三步前缀若前两步重量 <=4，末 quarter 最多加 4，不能达到 10；若前两步重量 6，末 quarter 最多加 4-2=2；若重量 8，末 quarter 最多加 4-4=0；末 half 保持重量。因此 <=3 步不能得到重量 10。

URD 的 EO 手乘为 {0,1,3,4,5,6,7,8}。B 面 {1,2,10,11} 与它交一条边，故 URDB 重量为 8+4-2=10，给 nu(10)=4。

若一个 <=4 步字 uv 的 EO 为全 1，取 |u|,|v|<=2，则乘法和逆元公式给 e_u=1⊕e_(v^-1)。两步可达重量只含 0、4、6、8，因此互补只可能是 4+8 或 6+6。

* 8 集合是两个相对整面之并，其补集是 4 条赤道边；它与任何面交 0 或 2 条边。两步的 4 集合却总是整面，或者经相邻 half 把面上一条边换成对面的一条边，故至少含某面 3 条边。不能互补。
* 每个两步的 6 集合含整面 A 并碰到 A 的对面。因此它与任何面都有交，补集不能含任意整面；而每个两步 6 集合必须含一个整面。也不能互补。

所以全 flip 状态需要 >=5 步。这不是其精确值声明；尚未给出长度 5 的见证。

## 4. 普通 D 证书何时能转换为 H 证书

### 4.1 只有一个标量时的严格限制

若 L<=D(g)，并已知 R>=max_{a in H}D(a)，则

\[
\max(0,L-R)\le d_H(g).
\]

证明：对每个 a，D(ag)>=D(g)-D(a)>=L-R，之后对 a 取 min。

只知道整数 L 时，不能普遍为 L<=R_H=max_{a in H}D(a) 给正值 H 证书。H 内从 e 到某个达到 R_H 的元素有一条 half-turn 生成路径；D 沿每条边至多变 1，必经过 0,...,R_H 每个整数。这样的状态 d_H 恒为 0，却可提供对应的 D 下界 L。直积字长度量的例子也说明仅凭 L 和 subgroup radius，(L-R)_+ 的损失一般无法消除。

把 L “clip 到 remaining 附近”不制造 H 不变性。尤其 half-turn U2 的完整角距离为 1，但 d_H(U2)=0；在 r=1 时把值 1 放进原同侧/反侧 H 栏位，会触发移除 half-turn 的等界掩码，丢失唯一一步解。

### 4.2 完整函数的 H 下包络

若 b(g)<=D(g)，定义

\[
(P_Hb)(g)=\min_{a\in H}b(ag).
\]

它逐点左 H 不变，且 <=d_H(g)。当 b 是完整角距离 d_C 时，P_H b 正好是 u；918540 状态的左 H_C 坐标直接计算它，在线不需要 96 个完整角查询。u 是此角投影内的最强同侧 H 下界。

若 b 本已左 H 不变，则

\[
P_H\max\{b(g),b(g^{-1})\}
=\max\left\{b(g),\min_{a\in H}b(g^{-1}a)\right\}.
\]

对 b=u，第二项是双陪集 v，且 v<=u，所以这个“先 normal/inverse max，再 H-safe 化”的操作不能严格增强 u。对较粗的旧 b，是否增强须另外证明；不能从可采纳性推断一定有收益。

空间 M 归一化 H，因此对任意固定 M 子集取 max b(alpha(g))，若 b 左 H 不变，则结果仍左 H 不变。加入 inverse 不能援引同一句证明。

### 4.3 多个 D 采样证书的覆盖公式

已知 a_i in H、L_i<=D(a_i g)，以及可计算的上界 C(h a_i^-1)>=D(h a_i^-1)。则

\[
F(g)=\min_{h\in H}\max_i\bigl(L_i-C(ha_i^{-1})\bigr)_+
\le d_H(g).
\]

因为对每个 h,i，D(hg)>=L_i-D(h a_i^-1)>=L_i-C(h a_i^-1)。F>r 等价于这些证书球覆盖所有 h：每个 h 至少有一个 i 满足 C(h a_i^-1)<L_i-r。

完整 H_C 只有 96 个元素，但这个缩减仅可用于角域版本：将 D、H、g、C 全部分别换成 D_C、H_C、c、C_C，且 C_C 必须是角字长的上界。所得角覆盖 F_C<=u(c)，不会比精确 u 更强。不能挑 96 个完整 H 元素作为 lifts，就把对完整魔方 H 的最小化替换成对这 96 个元素的最小化；其余 H 元素及完整魔方字长没有因此被覆盖。

对逐点左 H 不变性，只有“采到了全 H”仍不充分：不同标签 a 若使用任意不同的下界生成方法，重新计算的数值可能不协变。一个充分条件是全 H 采样统一使用 L_a(g)=b(ag)，其中 b 是同一个 D 可采纳函数，并统一使用同一个相对元素代价上界 C。对 g'=kg，将旧标签 a,h 同时改为 a k^-1,h k^-1，便有 L_(a k^-1)(kg)=L_a(g)，而相对元素 (h k^-1)(a k^-1)^-1=h a^-1 不变，所以两次 min-max 完全相等。

更一般地，不完整或自适应采样也可以使用，但其标签、数值和代价必须在上述重标记下整体协变，才能满足现有逐点相等的 oracle 契约。即使没有这种函数不变性，每次由覆盖不等式证明的数值仍是合法 H 证书；缓存运输数值与比较新鲜函数值必须分开。

## 5. 不进入旧 H 掩码的独立 D 拒绝

### 5.1 最小接口及插入位置

实验 `corner-research` feature 增加 `PruningOracle::distance_only_bound(cube, remaining)->Option<u8>`，默认 None。返回 Some(L) 只需证明 L<=D(cube)，不要求 H 不变、启发式一致或 L<=旧 max_bound。

搜索 stage1a 先完成 remaining=0 的叶检查；随后在 `live[i]=true` 和所有 H prepare/lookup 之前查询该 hook。传实际 `frame.inverse` 可避免 lazy-normal 物化。若 L>remaining，直接调用 `reject_bound(L-remaining, parent_propagation, stats)` 并 continue。

它不把值写入 normal_bound/inverse_bound，不交给 stage2 的 quarter/axis/backward-coset/coset-chain 推导，不改变根深度、prefix ownership 或旧 max_bound。已知该独立表最大值 max 时，remaining>=max 可完全跳过查询，因为这里只消费严格拒绝。

### 5.2 NISS 任意帧上的 excess 证明

设被拒绝的 child 状态为 c、预算 r、证书 L<=D(c)，delta=L-r>0。NISS 的一个实际树边可能表现为右乘、左乘及取逆后的表示交换；无论采用哪种表示，parent p 与 child c 都满足

\[
D(p)\ge D(c)-1\ge L-1.
\]

parent 预算是 r+1，因此其 excess 至少为 delta-2。向上跨 k 条实际移动边：

\[
D(a_k)\ge L-k,\quad r_k=r+k,\quad
D(a_k)-r_k\ge\delta-2k.
\]

所以可继续拒绝所有满足 delta-2k>0 的祖先，即 k<=floor((delta-1)/2)。这正是 `reject_bound` 在启用 parent propagation 时每删一层 excess 减 2 的依据。NISS side bits/取逆改变表示，不改变这些 D 不等式。

同面兄弟的证明不同：同一 parent 下两个不同非零 face powers 之差仍是一个 HTM move。两个 child（预算都为 r）因此满足 D(sibling)>=L-1，所以 delta>1 时可拒绝同面的其他兄弟。在祖先传播之后，对“最后删掉的节点”的 parent 使用剩余 delta 即可。

这两个操作仅传播局部 D 不可解证书，不要求启发式值本身一致，也不把该数值提升成 H 证书。所有 split context 只修改自己的 owned mask；全局成立的 D 证明当然可剪掉本 context 所拥有的部分，其他 context 的所有权不必改变。

## 6. 耦合角/边信息：严格优于各自 max 的一步增强

令 b(g)=max(u(c_g), E(e_g))。二者都给 d_H 下界并左 H 不变。定义

\[
B(g)=\begin{cases}
0,&b(g)=0,\\
\max\{b(g),\,1+\min_{m\in S}b(gm)\},&b(g)>0.
\end{cases}
\]

若 b(g)>0，则 g 不在 H，任一到 H 的最短字至少有一步。沿该字的第一步 m，有 b(gm)<=d_H(g)-1，因此 B<=d_H。左 H 平移与右后继交换，故 B 逐点左 H 不变。全部 18 后继保证覆盖；若只对当前 move mask 的允许后继取 min，得到的是路径上下文失败证明，不能无条件写回全局 H 表栏位。

严格增强见证：取 corners 为 U 的 corners，edges 为 R 的 edges。两部分排列都为奇，twist/flip 守恒满足，因而这是合法完整 Cube。u=1、E=1。

任何一步使 corners 进入 H_C 的 move 必须在 U 面做 quarter：tetrad 失配支持是 U 的四角，右 half 只置换这个非空支持、保持大小为 4，别的面 quarter 不可能消掉它。具体地，B(Um)=B(m)△p_m^-1(F_U)；quarter 在自己的面 F_A 上转动，归零等价于 F_A=F_U。因此角归入 H_C 的后继恰为 {U,U'}。任何一步使 EO 归零的 move 必须是 R 或 R'，因为当前 EO 恰为 R 的 4 边面支持，而一步 move 的逆 EO 只有对应面的 4 边或 0。两个后继集合不交，所以已经有 B>=2，而原 max=1。

进一步分类给出精确的一步增强值 **B=3**。角 u<=1 的后继恰为 {U,U',U2,D2}：U/U' 给 0，同轴 U2/D2 给 1；其他 quarter 的角排列为偶且不在 K_C，既不在 H_C，也不可能与一个奇排列 quarter 同左 H_C 陪集，故不能有 u=1；其他 half 把 U 面支持变成非面型 saddle，也不可能与一步 quarter 有相同左 K_C 坐标。这里用到 H_C 中所有角排列均为偶，其原因是两个 tetrad 的 matching action 相同，两个排列奇偶也相同。

EO<=1 的后继恰为 {R,R',R2,L2}：R/R' 给 0，同轴 R2/L2 保持原 R 面支持、给 1；其他 quarter 给重量 6 或 8，其他 half 把 R 面的一条共享边换成外边，结果与原 R 面相交 3 条边，不可能是任一整面，故不是一步 EO。

两组四个后继不相交。精确 u、E 一致，而当前二者均为 1，所以每个后继的两项均至多为 2。于是有下表：

| 后继 | u | E |
| --- | ---: | ---: |
| U、U' | 0 | 2 |
| U2、D2 | 1 | 2 |
| R、R' | 2 | 0 |
| R2、L2 | 2 | 1 |
| 其余 10 个动作 | 2 | 2 |

因此全部 18 个后继的 b 恰为 2，B(g)=max(1,1+2)=3。这不声称该完整状态的 d_H 或 D 恰为 3；这里只算出了所定义的一步增强值。

该见证只证明相对于 u 和 E 的独立 max 严格增强，不声称一定优于旧 Opt8 加 u/E 的总 max。完整乘积 PDB 有 918540×2048=1881169920 个状态；一步 18 后继方法避免存整个乘积，付出每个触发节点的查询代价。`coupled_one_step_h_bound` 与 `query-u-eo` 已写出这一算法，尚未被搜索包装器自动调用，未测实际收益。若输入 u 为截断表，算法仍可采纳；上述 B=3 数值需要精确表或至少保留到 2 的截断。

## 7. Lipschitz 传播、成本分摊和 BPMX

### 7.1 普通减路径代价的提升

对任意 b<=d_H、固定右移动字 w，

\[
b(gw)-|w|\le d_H(g).
\]

取一组此类证书的 max 可强化不一致或有损的原界。若 b 本身逐点左 H 不变，固定字集合的 max 才继承这种不变性，因为 (hg)w=h(gw)；自适应字集合还要证明其选择协变。仅有逐点数值 b(g)<=d_H(g)，不保证重新计算的 b(hg) 等于 b(g)。精确 u 和精确 E 都是一致启发式，其 max 也一致，所以 `max_w (max(u,E)(gw)-|w|)` 不可能严格提高原 max。这与上节 `1+min successors` 不同，不能混为同一种 lookahead。

已证明的 ell5 支持集 S=K_C\H_C 在左 H_C 坐标中只有 5 个种子（solved tetrad placement、CO=0、非单位 S3 标记）。若 delta(c,S) 是该 918540 图到种子的距离，则 max(0,5-delta(c,S)) 是有效角 H 下界。可只从 5 种子做半径 4 的多源传播，填充附近的正值；它不会超过精确 u。旧 ell4 同样给 max(0,4-delta)；这些传播尚未实现，也未执行。

### 7.2 成本分摊

对每个 pattern i 和每个 move m，分配非负成本 c_i(m)，要求 sum_i c_i(m)<=1。pattern 目标集包含 H 的投影。其加权精确目标距离 h_i 的和满足 sum_i h_i(g)<=d_H(g)，因为任何实际解字在每个投影中都是合法路径，而总分摊成本不超过字长。

要满足相同 H 契约，pattern 的 H 作用应保持目标集并与后继/成本交换。若希望无向的边证书，须有 c_i(m)=c_i(m^-1)。空间不变性还需要 M 在 pattern 状态上有良定义的作用，并保持目标集及相应后继；在此前提下，成本须随动作的空间像一起运输。也可以让 M 置换整组 pattern，同时运输各自的目标集、后继和成本，使总和保持不变。仅让成本在空间 move 轨道上恒定，而不证明 pattern/目标/后继的这些条件，并不足够；任意 face-specific 成本也不能自动视为 M 不变。

均匀分配 c_i(m)=lambda_i、sum lambda_i<=1 时，总界只是 sum lambda_i h_i^unit，必不超过 max_i h_i^unit，因此不能靠均匀切分严格胜过普通 max。非均匀分配是否在本组合中有严格收益，尚未给出见证；上节后继集合不交已有明确 Cube 见证。

### 7.3 BPMX 的界限

由一条已知单位 move，L_child-1 是 parent 的 D 证书；同样也可由父到子传播。这是三角不等式，不依赖启发式一致。若证书是 H 型且路径始终是相同固定侧的右 move，可以传播为 H 型；若穿过 NISS 反侧 quarter，则不能未经证明保留原 H 型。现有 coset-chain 对反侧 half 的零损运输使用的正是更强的 H 结构，与本轮 generic D gate 的每层损失 1 不同。

## 8. 失败缓存的规范化条件

| 缓存内容 | 可直接运输的对象 | 额外条件 |
|---|---|---|
| L<=D(g) 数值 | 全部 96 轨道 | key 必须标识真实完整状态轨道或有等价证明的完整投影；不继承 H 掩码 |
| L<=d_H(g) 数值 | 左 H、归一化 H 的空间 M | inverse 改成另一侧；只在另证双侧时直接复用 |
| 精确 D(g) | 全部 96 轨道 | 必须真是精确距离，不能用带路径限制的失败深度冒充 |
| 深度 r 的受限 DFS 失败 | 同状态、同允许后继语言/上下文；同条件下更小预算 | 必须完成全部应覆盖分支，未取消、未触发 node/time cap；保留或规范化路径限制 |

最后一种形式化为：给自动机上下文 sigma 及其允许的未来 move 语言 L_sigma，已证明不存在 w in L_sigma、|w|<=r 可解当前 residual。只有 L_sigma 覆盖任一预算内解的代表时，才能提升为全局 D(g)>r 证书。否则只是条件失败，不因 state key 相同就可跨上下文复用。

M 规范化时必须同时变换 last face、normal/inverse move masks、side、root stabilizer/owned prefix 等实际限制。inverse 把右延伸改成左延伸；若缓存仅存一侧右扩展自动机而未变换它，不能用“D(g)=D(g^-1)”证明条件失败可复用。预算方向是已失败 r 可用于 r'<=r，不能反向。取消或不完整 shard 的失败没有覆盖整个搜索语言。

## 9. ell5 定理：已完成独立数学复审，未证明锐性

本节的符号证明已经过另一审阅者独立复核，包括源码 CO 符号、乘法方向、量词和全部两 quarter 类型。没有运行枚举或程序验证。

**定理。** 任意长度不超过 4 的 HTM 字，若其角状态属于 K_C，则该角状态已经属于 H_C。

因此 K_C\H_C 上的常数下界可以取 5。下文另证该结论适用于 u=min_{h in H_C}D_C(hc)，而不仅是 D_C(c)。尚未给出长度 5 的见证，故没有宣称常数 5 锐；原 ell4 下界仍然有效。

### 9.1 几何模型及两个 cocycle

角位置用 (x,y,z) in {+1,-1}^3，x=R、y=U、z=F。源码编号为

0=(+,+,+), 1=(-,+,-), 2=(-,-,+), 3=(+,-,-),
4=(+,-,+), 5=(-,-,-), 6=(-,+,+), 7=(+,+,-)。

记 chi=xyz，两个 tetrad 分别 chi=+1 和 -1。对 permutation p，令 B(p)={v:chi(pv)!=chi(v)}。乘法给

\[
B(pq)=B(q)\triangle q^{-1}B(p).
\]

对 axis a 上任意一面、任意方向 quarter Q，直接由六个 `QUARTERS` 的 corner bytes 读得 twist

\[
t_Q(v)=k_a\chi(v)1_{F_Q}(v)\pmod3,
\quad k_x=-1,\ k_y=0,\ k_z=1.
\]

反 quarter 的同公式由逆元公式和 quarter 在面上翻转 chi 得到：

\[
t_{Q^{-1}}(v)=-t_Q(Q^{-1}v)=k_a\chi(v)1_{F_Q}(v).
\]

所有 H_C 元素 CO=0 且保持 chi。源码的 position→identity 约定给

\[
p_{uv}=p_u\circ p_v,\qquad t_{uv}=t_u\circ p_v+t_v,
\]
\[
p_{uv^{-1}}=p_u\circ p_v^{-1},\qquad
t_{uv^{-1}}=(t_u-t_v)\circ p_v^{-1}.
\]

所以

\[
uv^{-1}\in K_C
\iff B(p_u)=B(p_v)\ \text{且}\ t_u=t_v.
\]

其中 B 相同恰表示 p_u 和 p_v 在每个位置输出相同的 tetrad 标签，等价于 p_u p_v^{-1} 保持 chi；twist 相同恰使乘积 CO 全零。这就是两个角状态属于同一个左 K_C 纤维的充要条件，乘法侧没有颠倒。

以下局部推导可重命名三个坐标轴以描述任意一对相邻面；k_x,k_y,k_z 必须随物理轴一起重命名。需要的性质始终是它们在 F3 中两两不同，不能在重命名时把某个轴的 CO 系数错误地沿用给另一轴。

### 9.2 至多两个 quarter：允许任意多个 half

0 quarter 的字在 H_C；1 quarter 的 B 支持无法被 half 消掉。

2 quarter 的字可写 h0 Q_A h Q_B h2，其中 h0,h,h2 均属于 H_C。左右乘 H_C 元素同时保持“属于 K_C”和“属于 H_C”两种判定。因此可先约去 h0,h2，再左乘 h^-1，把问题化为

\[
c=(h^{-1}Q_Ah)Q_B.
\]

由 B 的 cocycle，B(c)=0 等价于

\[
F_B=Q_B^{-1}h^{-1}(F_A),
\]

又 Q_B 保持 F_B，故 h^-1(F_A)=F_B。h 保持 chi，所以 h^-1 Q_A h 的 permutation 在 F_B 上是沿两正、两负顶点交替的 4-cycle。在四个已标号顶点上，这种无向回路只有 K_{2,2} 本身；两个有向 cycle 互为逆元，恰为 Q_B 或 Q_B^-1 的 permutation。因此 c 的 permutation 是 identity 或 Q_B²。

原状态属于 K_C，约去的 H_C 元素 CO 全零，所以 c 的 CO 也全零。它作为完整角状态必为 identity 或实际面 half Q_B²，属于 H_C。还原约去的 H_C 元素后，原字也属于 H_C。此论证允许两个 quarter 之间及两端有任意多个 half。

### 9.3 三个 quarter 加至多一个 half

把总字的前后两段写成 u v^-1，|u|,|v|<=2；后一段反序取逆仍保持 quarter/half 的类型。由 9.1，要在 K_C，u、v 必有相同 B 与 twist。三 quarter 加一个 half 时，一段为 QQ，另一段为 QH/HQ；只有三步时，另一段为单个 Q。下面仅比较 B，已经足以排除它们相等。

HQ 的 B 支持就是 Q 的 face；QH 的 B 支持是该 face 被 H^-1 置换后的集合。同轴 half 保持这个 face；相邻 half 把其中位于 half 面上的两个顶点送到相对侧，得到 saddle。例如原 face 为 x=epsilon、half 面为 y=delta，新的支持是 xy=-epsilon·delta。因此 spin 1-2·1_B 是单个字符 ±x 或 ±xy。单个 Q 也属于 face 情形。

QQ 若同面则 B 空；若对面则 B 是全体顶点；若相邻，设第一面 x=epsilon、第二面 y=delta，并令 eta 由第二 quarter 方向决定，使第二面内 Q_B^-1(F_A) 为 z=eta。则

\[
X=\{y=\delta,z=-\eta\}\cup\{y=-\delta,x=\epsilon\},
\]

\[
1-2\,1_X={1\over2}\bigl[(\eta z-\epsilon x)
  +\delta y(\eta z+\epsilon x)\bigr].
\]

在八顶点立方体的实 Fourier 字符基中，它在 x,z,xy,yz 上都有非零系数；这四个字符不同，所以不能等于常数或单字符 face/saddle。QQ 同面、对面的支持大小又分别为 0、8，而 QH/HQ/Q 的支持大小为 4。因此三 quarter 情形没有 K_C 状态。

### 9.4 四个 quarter

仍写 u v^-1，其中 u,v 各两个 quarter，比较 B 与 twist。

* B 空：每对都为同面字，各自在 H_C。
* B 全体：每对都为一轴的相对面 quarter。两面支撑不交，各方向 quarter 有相同 twist，所以每对的 twist 为 k_axis·chi。三个 k_axis 两两不同，twist 相同强制轴相同。相对面动作可交换；两个这样的字相除后，各面的指数都是偶数，故乘积属于 H_C。
* B 为上式相邻面 X：Fourier 支持唯一识别 selector axis y（它不在线性项中，且在两个二次项中共有）。同一个 X 的几何表示恰有两类。

下面逐系数证明“两类”确实穷尽，而不只列出两个可能。上式在线性项 x,z 的系数分别为 -epsilon/2、eta/2，在二次项 xy,yz 的系数分别为 delta·epsilon/2、delta·eta/2。selector axis 必为两个二次项的公共轴 y，第一轴只能选 x 或 z。把同一公式的新参数记为 epsilon',delta',eta'，系数比较唯一给出：

| 第一轴 | epsilon' | delta' | eta' |
|---|---|---|---|
| x | epsilon | delta | eta |
| z | -eta | -delta | -epsilon |

第一类以 x 为第一轴、第一面 x=epsilon、第二面 y=delta、相同 eta。给定这三个参数后，第二个 quarter 的方向固定，因为它与逆方向把交线分别送到 z 的相反两侧。第一个 quarter 的方向可以反转，但 Q_A^-1=Q_A² Q_A，故两个字相差左乘同面 half，属于同一个左 H_C 纤维。

第二类交换第一轴 x 与 z，并取第二面 y=-delta、第一面 z=-eta，新的参数为 -epsilon。设 a=1_(x=epsilon)，c=1_(z=eta)。在 F3 中 chi=±1 可逆。由 t_(Q_A Q_B)=t_(Q_A)∘p_(Q_B)+t_(Q_B)，第二面内部 chi 翻转，外部不变。第一类的 twist 除以 chi 后，在 y=delta、y=-delta 两片分别为

\[
k_y-k_x c,\qquad k_x a.
\]

第二类在这两片分别为

\[
k_z(1-c),\qquad k_y-k_z+k_z a.
\]

若两 twist 相同，仅比较第一片的 c=0 和 c=1 就强制 k_y=k_z 且 k_x=k_y，与三个 axis 系数两两不同矛盾。因此这种相同 B 的另一种表示不能有相同 CO。

所以相同相邻型 B 的两类几何表示不能同时具有相同 CO；留在同一 K_C 纤维中的字只能来自第一类的方向选择，已经证明它们属于同一 H_C 纤维。结合 B 空、B 全体两个情形，四 quarter 的证明完成。

长度不超过 4 的字只有 0、1、2、3、4 个 quarter，分别由 9.2、9.3、9.4 穷尽，故定理成立。

### 9.5 从 D_C 的短字排除得到 u 的严格下界

令 c 属于 K_C\H_C。定理先给 D_C(c)>=5。还需检查 u 对整个左 H_C 陪集取最小的量词：对任意 h in H_C，hc 仍属于 K_C；若 hc 属于 H_C，则 c=h^-1(hc) 也属于 H_C，矛盾。因此 hc 始终属于 K_C\H_C，逐个应用定理得到

\[
u(c)=\min_{h\in H_C}D_C(hc)\ge5.
\]

于是 ell5(c)=5·1_(c in K_C\H_C) 是有效的角 H 下界；通过角投影，它也给完整魔方的同侧 d_H 下界。其支持集在左右 H_C、归一化 K_C 和 H_C 的空间作用、取逆之下均保持不变，所以这不是把一个只对 D_C 有效的数值冒充 H 证书。

**已证与未证的界线：** 常数 5 的可采纳性及上述运输性质已经证明；尚未证明存在达到 5 的状态，不能宣称 5 是这个支持集上的最大常数。这里的数学结论不依赖程序是否已经把 ell4 替换为 ell5，接口与接入状态另见交付清单。

## 10. 本轮交付状态

已编写 `src/corner_oracle/eo.rs` 的 2048 EO 表构造/语义证书/7 项 nu，以及 `src/search.rs` 的 feature-gated D-only 拒绝 hook 与少量对应测试源码。`lower_bound5` 已接入研究 oracle，旧 `lower_bound4` 行为保留；一步耦合 helper 与独立查询已写，未自动进入搜索。wrapper 与 CLI 的完整清单见 [corner96-optimization.md](corner96-optimization.md)。未运行任何实现或测试，不能据此报告建表结果、实测表最大值、实测 7 项数组、实际节点数变化或提速。

## 11. 源码与证明依据

具体乘法、EO/CO gauge 与 18 个 move 使用冻结提交
[ab94ce76 的 cube.rs](https://github.com/2017YANR02/cuberoot.me/blob/ab94ce76dee2e658e3c6a368f72fa240750f4d16/solver/experiments/cube48opt-rust/src/cube.rs)。
旧 H 契约和余量传播对照同提交的
[search.rs](https://github.com/2017YANR02/cuberoot.me/blob/ab94ce76dee2e658e3c6a368f72fa240750f4d16/solver/experiments/cube48opt-rust/src/search.rs)。
H_C 的群结构与陪集坐标在 [基础报告](corner96-research.md) 中推导。
本附录的 EO 支持分类、耦合见证与短字 Fourier 分类是本轮手工推导，并非引用外部已运行结果。
