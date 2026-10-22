# mod M + inv：数学审查与可本地运行的角块原型

**版本说明：本文保留 v1 的基础定义与证明。v2 的新结论、当前实现范围和补丁入口见
[corner96-optimization.md](corner96-optimization.md)，全群紧凑分类见
[corner96-coarsening.md](corner96-coarsening.md)，更强的 ℓ₅ 与独立下界证明见
[corner96-bounds.md](corner96-bounds.md)。本文旧命令中的 corner96.patch 对应 v1；v2 请按新说明选择完整或增量补丁。**

原始交付状态：源码与证明完成静态审查，未执行计算。本文保留外部研究的原始论证；后续本机编译、建表、认证及性能记录以 [本地验证](corner96-validation.md) 为准。

原始问题是当前 Opt8 投影为何不能直接加入取逆后减半。本交付把三个不同问题分开处理：

1. 当前投影能否定义单值的取逆操作；
2. 96 个操作能否作用于另一种坐标或商空间；
3. 一个合法下界能否安全进入现有 NISS、半转剪枝和缓存接口。

代码基于 2017YANR02/cuberoot.me 的 main 提交
**ab94ce76dee2e658e3c6a368f72fa240750f4d16**；原分析首先固定在
**cb02d1d03112330a596d462aaa57a1abd0e2298e**。
v1 没有修改 search.rs；v2 在该文件增加非默认 **corner-research** feature 下的独立距离拒绝入口。
本页关于原型范围的历史说明应与 v2 清单合读。

## 1. 结论与交付范围

| 问题 | 结论 | 状态 |
| --- | --- | --- |
| 现有 Opt8 单元能否直接定义取逆、因此直接减半 | 不能；同单元中的两个状态可有不同逆坐标 | 已证明 |
| 这是否否定所有 mod M + inv 方案 | 不否定；完整角投影给出严格可行构造 | 已证明并写出原型 |
| 保留现有 q 的全部信息，又要求确定性右转移和取逆 | 在本文明确的 corner_class 语义下，必须区分完整 G 状态 | 条件明确的已证明结论 |
| H_C\C 的新坐标 | 420 × 2187 = 918540，转移可分离 | 已证明并写出原型 |
| 完整角块的 96 商空间 | 934778 个轨道，双侧后继可正确 BFS | 已证明并写出原型 |
| 双半转商再模 96 | 907 类；v 必须从 u 取双陪集分量最小值 | 已证明并写出原型 |
| 把 d_C 直接 max 到现有 PruningOracle | 不安全；它没有所需的半转不变性 | 已证明反例 |
| 当前 q 在整个 G 上的最小 96 稳定粗化 | v2 已给 330960 基础类、至多 318480 闭包顶点与计数/补数分类 | 见 v2 附录；实际 snapshot 的最终类数尚未求值 |
| 实际速度、缓存命中率、直径及距离分布 | 本轮没有运行证据 | 待本地验证 |

这里的“完成”是指已给出本原型所依赖的定义、证明、反例、算法、代码和验收入口；不是声称穷尽了所有可能的最优魔方算法。

### 1.1 符号约定

- G：合法三阶完整魔方群。
- S：18 个 HTM 单面动作，S = S^{-1}，每个动作代价 1。
- D(g)：g 到单位元的最短 HTM 长度。
- M：48 个空间对称所诱导的群自同构；均置换 S。
- I(g)=g^{-1}；A=M×〈I〉 是 96 元的集合上的群作用。
- H=〈U²,D²,R²,L²,F²,B²〉：六面半转子群。**不是** Kociemba 两阶段法的第一阶段目标子群。
- C：完整角投影，|C|=8!·3^7=88179840，d_C 为其 HTM 距离。
- H_C：H 在角群中的像，阶 96。
- K_C：零角朝向、分别置换两个 tetrad 的子群，阶 4!²=576。
- q：现有 variant 8 的实际投影，包括固定 corner_class 标架与截断 EO。

本说明把 H_C\C 写作集合 {H_C c}：它是**左乘 H_C 的轨道空间**，按通常陪集命名属于右陪集。代码中的 left-H 指“左乘 H 不变”，不改变左右乘法约定。

源码采用位置到块身份的排列 p(i)，角朝向 o_i 附着在位置上：

\[
p_{gh}(i)=p_g(p_h(i)),\qquad
o_{gh}(i)=o_g(p_h(i))+o_h(i)\pmod3.
\]

边朝向采用相同位置约定，乘法以 xor 合成。

## 2. 对现有 Opt8 不封闭论证的独立审查

### 2.1 严格的可下沉条件

欲存在坐标函数 J 使 J(q(g))=q(g^{-1})，必要且充分的条件是

\[
q(g)=q(h)\Longrightarrow q(g^{-1})=q(h^{-1}).
\]

空间变换 m 要作用于坐标，同样需要

\[
q(g)=q(h)\Longrightarrow q(m(g))=q(m(h)).
\]

这是一条关于投影纤维的条件，不能用 D(g)=D(g^{-1}) 代替。

### 2.2 不依赖旧运行数值的符号反例

在 solved corner 选择的固定规范标架内，取：

- 角全部 solved；
- 边排列 p=(0 1 3)，其余边不动；
- 翻转位置集合 {0,1}。

这是合法状态：三循环为偶排列，翻转数为偶数。

同一边类别内部的三循环不改变 ESEP。Opt8 保留 EO 位置 3…10；位置 0、1、2 和由总翻转约束省去的 11 不直接进入这八位。因此

\[
q(g)=q(e).
\]

取逆将位置翻转移动到其块身份位置；故逆的翻转集合为

\[
p(\{0,1\})=\{1,3\}.
\]

位置 3 现在可见，其他参与打包的量不变，所以

\[
q(g^{-1})=q(e)+512\ne q(e).
\]

若 solved corner 的规范标架不是 identity，把整个构造用该固定空间变换的逆搬回原坐标即可；群取逆与空间自同构交换，反例不受标架选择影响。

新增 verify-opt8-projection 命令只读已有小坐标快照，枚举 48 个标架，复现这个见证；本轮没有执行该命令，也没有读取 Opt8 大 PDB。

同理，把仅有隐藏位置翻转的状态作合适空间变换，可把翻转移到保留位置，因此 q 的纤维也并非普遍 M 稳定。某两个具体样例的所有 48 个像都给相同键，不足以证明全局稳定。

**边界：** q 的两个键不同，不推出旧表解码值一定不同。当前表不能按不存在的单值 inverse-map 配对；某种另外证明了数值一致性的压缩规则，不能仅由这个反例排除。

### 2.3 为什么不能把“补少量坐标”当成免费修复

设某个等价关系同时支持所有确定性右动作，并支持确定性取逆。因 S 生成 G，右动作稳定性扩展为所有右乘；再用取逆，可得所有左乘稳定性。因此它是 G/N，其中 N 是正规子群。

若新坐标还细化 q，则 N⊆q^{-1}(q(e))。在以下明确前提下：

> corner_class 表示文档所称的真正 M 轨道分类，没有未说明的额外合并，

q 的零纤维迫使 N 的角排列落在 S4×S4、边排列落在 S4³、角朝向为零，边翻转只能落在那个四位置隐藏集合中。

G 到 S8、S12 的排列投影均满射，所以 N 的两个排列像分别是 S8、S12 的正规子群。它们被困在上述很小的真子群中，无法包含 A8 或 A12，因此都平凡。剩下若有非零纯 EO 向量，任取合法状态共轭可以置换其翻转位置，把非零位置移出隐藏集合，矛盾。故 N=1。

这证明的是：**同时保留 q 的全部区分能力、所有确定性右转移和确定性取逆，不能再遗忘任何完整状态信息。**它不要求一定采用目前 20 字节 Cube 格式，也不禁止放弃 q 的部分信息、改用角投影、集合值后继或另外的下界。

若从 H_C\C 继续粗化，仍要求所有右转移和取逆，则必须商去 H_C 在 C 中的正规闭包。其排列部分为 A8；把纯双换位与一个零和 twist 向量作交换子可得到 e_i−e_j，生成整个 3^7 朝向子群。因此正规闭包是 3^7⋊A8，最后仅剩排列奇偶两类。这里要求的是“粗化后仍有全部确定性右转移”，比仅要求取逆稳定严格得多。

## 3. 96 操作在完整角投影上成立

π_C:G→C 是群同态，所以

\[
\pi_C(g^{-1})=\pi_C(g)^{-1}.
\]

完整角状态保留角排列及全部受约束朝向，避免了现有 q 的信息缺失。每个角状态都可提升为合法完整魔方：若角排列为奇，只需给边同样的排列奇偶。因此

\[
d_C(\pi_C(g))\le D(g).
\]

而任意角状态的最短动作词本身给出一个完整魔方提升，长度恰为 d_C。故 d_C 是**所有只看完整角投影的可采纳下界中的逐点最大者**。

### 3.1 真实 48 个角空间作用

不能把“角朝向取负”单独当成一个真实空间镜像。

由源码现有动作直接构造 x=R L'、y=U D'，只取它们的角数组。这两个角元素对应整块魔方的正旋转，生成 24 个元素。其边数组不是整块旋转的边数组，代码没有把它们当成完整空间变换。

设

\[
j=[5,4,7,6,1,0,3,2],\qquad
\tau(p,o)=(p,-o).
\]

j 是角的对跖排列，真正中心空间反演是 Ad_j τ。48 个角自同构为

\[
\operatorname{Ad}_r,\quad \operatorname{Ad}_{rj}\tau,
\qquad r\in\langle x,y\rangle.
\]

构造器逐一把 18 个生成器的像与现有 MOVES 比对，并检查 48 个移动置换的唯一性及闭包。原型不依赖旧 small table 的空间对称数组。

### 3.2 完整角块轨道数

Burnside 给出

\[
|C/A|=\frac1{96}\sum_{m\in M}
\bigl(|\operatorname{Fix}(m)|+
|\operatorname{Fix}(mI)|\bigr).
\]

| 空间类 | 重数 | Fix(m) | Fix(mI) |
| --- | ---: | ---: | ---: |
| identity | 1 | 88179840 | 21820 |
| 面轴 90° | 6 | 96 | 108 |
| 所有正旋转 180° | 9 | 10368 | 21820 |
| 体对角 120° | 8 | 486 | 10 |
| 中心反演及三个坐标镜面 | 4 | 31104 | 110484 |
| 六个对角镜面 | 6 | 1728 | 110484 |
| 90° 旋转反射 | 6 | 288 | 36 |
| 120° 旋转反射 | 8 | 54 | 18 |

两个加权和分别是 88414560 与 1324128，故

\[
|C/M|=1841970,\qquad
\boxed{|C/A|=934778}.
\]

这些是解析计数；实现中的同值断言还没有运行。与 48 商相比，加入取逆的轨道数比值约为 1.97，并非恰好 2。它也不是查询成本或运行时间的比值。

计数的一个易错点是体对角旋转的 orientation charge。手乘源码的 xy 得到排列 [0,2,3,1,7,5,4,6] 与朝向 [1,1,1,1,2,2,2,2]；两个固定角的 charge 分别 1、2，两个三周期的 charge 为零。improper 的 2·6 类型又必须在二周期上有非零 alternating charge。忽略这些条件会算错固定点数。

## 4. 后继覆盖、BFS 与解词还原

### 4.1 取逆不是普通右 Cayley 图的自同构

\[
(gm)^{-1}=m^{-1}g^{-1}.
\]

它把右边交换到左边。因此，保留一个 96 轨道代表，只从该代表展开 18 个右邻居，不能直接把该图作为普通从 e 向外 BFS 的商图。

严格反例可取 S4，生成器 a=(12)、b=(23)、c=(34)，只折取逆。轨道 [abc]={abc,cba} 的长度为 3，其长度 2 的入邻轨道仅有 [ab] 和 [cb]。若分别选代表 ba、bc，则两者的右后继都不进入 [abc]，普通向外 BFS 丢失其真实三步路径。

但这个代表图**到目标的有向距离**仍等于真实距离：任一代表都有一个最短右解的第一步，沿它必下降 1；任何右边又不能使真实距离下降超过 1。这两件事不能混为一谈。

### 4.2 原型使用 36 个双侧后继

令

\[
E(c)=\{cm:m\in S\}\cup\{mc:m\in S\}.
\]

M 置换 S，取逆交换左右两族，故这个后继集合在 A 下封闭。保留一个代表后，普通商图 BFS 合法。左右混合长 k 路径可写成 LcR=e，因此 c(RL)=e，普通解 RL 长度不超过 k。反过来，普通右解已包含在双侧图中。于是双侧图到目标的距离仍恰为 d_C。

代码不在这个 BFS 上使用 ALLOWED、同面规则、NISS 历史或根稳定子剪枝。visited 采用完整角 raw rank 位图；只有邻居属于未发现轨道时，才枚举并标记其 96 个像。

### 4.3 规范标架凭证

若规范化给出 r=φ(c^ε)，ε∈{+1,−1}，且 W 解 r，则原状态的角解为

\[
(\phi^{-1}(W))^\epsilon.
\]

词取逆必须同时倒序和逐动作取逆。若每个右动作后重新规范化
r'=φ((rm)^ε)，递归恢复公式是

\[
W=m\,(\phi^{-1}(W'))^\epsilon.
\]

代码保存空间 symmetry ID 与 inverted 标记，并提供 restore_solution。实际 solve_corners 更直接：在调用者原始角状态中查 18 个右邻居，选择 d_C 下降 1 的动作。BFS 的混合左右路径不需要被误当成普通解输出。

返回的 CanonicalCorner.cube 及 transform 的 Cube 只保证角字段是真实变换结果；边字段是满足奇偶的合法占位。不能用它替换完整魔方搜索的原始 Cube。

## 5. H_C 坐标、u 与不建表的四步下界

### 5.1 精确识别 H_C

令 φ:S4→S3 为四个标签的三种完美匹配上的作用，其核为 Klein 四元群 V4。源码的六个角半转生成

\[
H_C=\{(a,b)\in S_4\times S_4:\phi(a)=\phi(b)\}.
\]

对角 S4 与一侧 V4 都由这些半转生成，因此阶为 24·4=96。

K_C 只要求零朝向并保两个 tetrad，H_C 额外限制两 tetrad 在匹配上的相对作用。

### 5.2 420 × 2187 的坐标

对于任一位置到身份排列 p：

1. 记录身份 0…3 所在的四位置集合，共 70 种。
2. 按位置升序取出这四个身份，得 α∈S4。
3. 对另一 tetrad 同样得到 β∈S4，标签减 4。
4. 记录 σ=φ(α)^{-1}φ(β)∈S3，共六种。
5. 记录前七个位置的角朝向，共 3^7 种。

左乘 (a,b)∈H_C 时，α、β 分别变成 aα、bβ，因 φ(a)=φ(b)，σ 不变。反过来，相同 mask、σ、朝向的两个角状态恰相差一个左 H_C 元素。因此这是精确分类，非近似哈希。

序号为

\[
\operatorname{rank}(c)
=(6\operatorname{maskrank}+\operatorname{rank}_{S_3}\sigma)\cdot2187+
\sum_{i=0}^{6}o_i3^i.
\]

右动作的排列部分只依赖排列商；朝向更新
o'_i=o_{p_m(i)}+o_{m,i} 只依赖旧位置朝向和动作，所以转移严格分离为

- 420 × 18 个 u16；
- 2187 × 18 个 u16。

合计 93852 字节的转移载荷；距离表使用每项一字节时为 918540 字节。若以后仅存 cap≤15，可另做四位压缩；本交付没有实现或声称四位压缩版本。

### 5.3 u 的定义与最大性

\[
u(c)=\min_{a\in H_C}d_C(ac).
\]

在 H_C\C 的 18 右动作 Schreier 图从目标 H_C 做 BFS，恰得到 u。u 为左 H_C 不变、M 不变的合法下界；其零点恰为 H_C。

任何只看角、左 H_C 不变的合法函数 f，均有

\[
f(c)=f(ac)\le d_C(ac)\quad\forall a\in H_C,
\]

故 f≤u。u 是这一函数类别的逐点最大者。

取逆没有作为该坐标上的单值操作实现；需要完整角状态时实际求逆，再重新 rank。用两个实际状态分别查 u(c)、u(c^{-1})是合法的。

### 5.4 解析下界 ell4

定义

\[
\ell_4(c)=4\,\mathbf1[c\in K_C\setminus H_C].
\]

任意长度≤3 的 HTM 字，只要角排列保两个 tetrad，就属于 H_C。可用 tetrad 标签 χ(v)=xyz 与变化支持集

\[
B(p)=\{v:\chi(pv)\ne\chi(v)\},\quad
B(pq)=B(q)\triangle q^{-1}B(p)
\]

证明：

- 半转的支持集为空；
- 一个 quarter turn 的支持集是其四角面；
- 两个相邻 quarter turn 若最终保 tetrad，必须在同面，可合并为半转或单位元；
- 两个 quarter turn 中夹一个半转，能消去支持集时只能属于与该半转同面或对面，交换后仍化为半转字；
- 三个 quarter turn 的前两个支持集之和只能为空、全八角、或一个非面的四点集，不能由第三个面支持集消去。

因此 ell4 可采纳。H_C⊆K_C 保证这两个子群的成员资格在左、右 H_C 乘法下均保持；M 正规化两者，取逆也保持两者。所以 ell4 在全状态上左右半转不变，并且 96 不变。

一个严格新信息见证是角三循环 (0 1 2)，角朝向为零、边 solved。它合法，属于 K_C\H_C，故 ell4=4；但其全部 96 个旧 q 投影都等于 q(e)。任意基于这些同一旧键的可采纳非负旧表值都为零。所以该界能提供“再查旧表的所有 96 个像”也得不到的信息。

**没有证明常数 4 是这个集合上的最强常数，也未给出四步达到该集合的最短见证。**代码不把它称为 sharp。对于已精确建出的 u，u 已经支配 ell4；保留 ell4 主要用于无表证明、截断表和接口边界。

## 6. 双陪集、907 类与更弱的 96 下界

定义

\[
v(c)=\min_{a,b\in H_C}d_C(acb)
=\min_{b\in H_C}u(cb).
\]

v 左、右 H_C 不变，M 不变，取逆不变。构造方法是：先建 u，再在 H_C\C 上用六个右半转连通分量，取每分量 u 的最小值。

**不能**把双 H 合并后的任意图做普通 BFS，就宣称得到 v。双 H 等价类一般不提供所有右动作的确定性商图；原型只用连通分量求最小值。

解析计数：

\[
|H_C\backslash C/H_C|=11436,
\]
\[
|(\,H_C\backslash C/H_C\,)/I|=5870,
\]
\[
|(\,H_C\backslash C/H_C\,)/M|=1275,
\]
\[
\boxed{|(\,H_C\backslash C/H_C\,)/A|=907}.
\]

### 6.1 双陪集计数的可复核公式

H_C 中的角排列类型及 C 中中心化子大小如下。所有 H_C 元素角朝向均为零。

| 周期类型 | H_C 中数量 | C 中中心化子 |
| --- | ---: | ---: |
| 1^8 | 1 | 88179840 |
| 1^4 2^2 | 18 | 46656 |
| 2^4 | 9 | 10368 |
| 1^2 2·4 | 24 | 432 |
| 4^2 | 12 | 96 |
| 1^2 3^2 | 32 | 972 |

因此

\[
\frac1{96^2}\sum_\lambda n_\lambda^2z_\lambda
=\frac{105394176}{9216}=11436.
\]

这些六类的平方根数分别为 21820、276、108、0、12、40；加权和除以 96 得 304 个取逆不动的双陪集，所以 (11436+304)/2=5870。

令 t 的角朝向在前 tetrad 为 +1、后 tetrad 为 −1，排列为单位元。N_C(H_C)/H_C≅S3，由 t 与 j 生成。源码 x、y 满足 xyH_C=tH_C、yH_C=jH_C，证明真实正旋转在该商上的像就是 S3。反射 Ad_j τ 加入后，空间作用有效为 12 个；再加取逆有效为 24 个。

| 作用／n | e | t | t² | j | tj | t²j |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Ad_n | 11436 | 372 | 372 | 316 | 316 | 316 |
| Ad_n I | 304 | 46 | 46 | 304 | 304 | 304 |
| Ad_n τ | 356 | 356 | 356 | 948 | 78 | 78 |
| Ad_n τ I | 1280 | 1280 | 1280 | 1280 | 20 | 20 |

总和 21768，除以 24 得 907。τ 单独可用于这个双陪集上的有效作用；它不能替代完整角状态的真实空间镜像。

统一有限求和公式是

\[
F(\psi)=\frac1{96^2}\sum_{a,b\in H_C}
|\{c\in C:c=a\psi(c)b^{-1}\}|.
\]

普通或 twisted conjugation 可按 H_Cn、H_Cnτ 在 C 中的共轭类型 γ 汇总：
F=96^{-2}Σm_γ²|C_C(γ)|。
含取逆时可用

\[
F(\operatorname{Ad}_nI)=96^{-1}\sum_{d\in H_Cn^2}R(d),
\]
\[
F(\operatorname{Ad}_n\tau I)
=96^{-1}\sum_{d\in H_Cn\tau(n)}R_\tau(d).
\]

R 是普通平方根数；R_τ 是 xτ(x)=d 的解数。普通带 charge 的周期型中心化子为
3^{k−1}∏_l l^{m_l}∏_{l,a}m_{l,a}!。
普通平方根中同长、同 charge 的周期配对权为 3l，奇长周期可单独开方、偶长必须配对。
twisted norm 中只有 charge-zero 的奇长周期可独立，权为 3；charge-zero 配对以及 charge 1/2 交叉配对权为 3l，最后除以 3 施加总角朝向约束。因总角数 8 不是 3 的倍数，此最后约束确实独立。

### 6.2 强弱关系与“最大”的不同含义

\[
v(c)\le\min(u(c),u(c^{-1}))
\le\max(u(c),u(c^{-1}))\le d_C(c).
\]

- d_C：最大角块独立的完整距离下界。
- u：最大角块独立、左 H_C 不变的下界函数。
- v：最大角块独立、左 H_C 不变且 96 不变的下界函数；取逆不变加左 H_C 不变自动推出右 H_C 不变。
- w=min(u(c),u(c^{-1}))：最大的角块独立、96 不变、同时逐点不超过两个单侧 H 距离的数值证书；它未必是左右 H 不变的函数。
- h=max(u(c),u(c^{-1}))：96 不变的完整距离下界；不满足现有同侧半转函数契约。

若已查询 u 两侧，v 不会再提高下界。907 路线的意义是研究压缩与证书共享，不是给两次 u 查询追加更强信息。

## 7. 最优性、后继覆盖、NISS 与缓存的准确契约

### 7.1 两种下界证书必须分开

令完整群的同侧半转距离为

\[
d_H^L(g)=\min_{a\in H}D(ag),\qquad
d_H^R(g)=d_H^L(g^{-1}).
\]

角投影给出 u(π_C(g))≤d_H^L(g)，而不是仅仅 u≤D。
从第 6 节的最大性可知，u 是仅保留角信息时对此契约的最佳下界。

当前 **search.rs** 的 PruningOracle 不只询问“这个数是否≤D”。它还以同侧半转不变性为依据，复用不同搜索侧的证书，选择 quarter-turn 相关允许动作及阶段性拒绝。为此需要函数恒等式

\[
b(ag)=b(g),\quad a\in H,
\]

以及原接口的最大值、对称变换、取消与查询语义。只证明一个数可采纳并不够。

例如 c=U² 时，d_C(c)=1，然而 u(c)=u(c^{-1})=v(c)=0。由 e 左乘 U² 即能改变 d_C；这是把 d_C 当成该 oracle 的直接反例。源码还有具体的失败路径：plan_ordered 在某侧 bound 等于 remaining 时删除另一侧所有半转。若在 U²、remaining=1 时直接把 d_C 合入两侧 bound，两侧都得到 1，唯一的一步解 U² 就会被两侧同时删除。

本实现用不同类型表示：

| 量 | 可以证明什么 | 本原型用途 |
| --- | --- | --- |
| 同侧 u、ell4，以及它们与原 oracle 的同侧 max | 左 H 不变的可采纳函数 | 现有 NISS/半转搜索 |
| v | 左右 H 不变且 96 不变的函数 | 同一个数可安全用于两侧 |
| w=min(u,u∘I) | 在当前状态逐点不超过两侧 H 距离 | 仅作为有明确作用范围的双侧数值证书 |
| h=max(u,u∘I)、d_C | 完整距离下界 | 普通距离剪枝；不得冒充同侧 H 函数 |

w 的数值若已经证明满足 w≤d_H^L(g)，可以沿左 H 操作继续使用这个数值证书；若已证明 w≤d_H^R(g)，则可沿右 H 操作继续使用。每次只保留对应**那一侧**的关系；这不等于 w 自身具有 H 不变性，也不等于另一侧的关系继续成立。

**corner_oracle.rs** 中：

- CornerOracle 只返回同侧 max(u,ell4)，并截到接口允许的 13。
- StrengthenedOracle 只把同侧角下界与原 oracle 取 max，再截到原 oracle 的 max_bound；其余原有能力标志、批量、取消和替代标架查询都按原接口传递。
- DoubleCornerOracle 用已经验证的 u 对每个双陪集取最小，再按 96 轨道折叠；同侧查询也可加 ell4。
- FullCornerDistanceOracle 只返回 DistanceBound，**没有实现 PruningOracle**。

exact 模式下 ell4 已被 u 支配。允许 capped u 后，max(min(u,B),ell4) 仍可采纳且 H 不变；其值可能高于 cap B，输出中的 raw_u 与最终剪枝值因此单独列出。raw_u 指表内原值：exact 模式是 u，capped 模式是 min(u,B)，不能把后者当成未截断的精确距离。

### 7.2 NISS 覆盖证明需要记住两端

用 N 表示 normal 侧累积的动作词、I 表示 inverse 侧累积词，剩余状态取

\[
x=I^{-1}gN.
\]

normal 侧添加 m，使 x→xm；inverse 侧添加 m，使 x→m^{-1}x。
若最终 x=e，则

\[
gNI^{-1}=e,
\]

所以返回普通解 NI^{-1}。取逆是一个零成本的**表示切换**，不产生免费物理转动。

要证明任意切换策略不丢失最优解，固定一个最优词 W=PZQ。
已消耗的是左右两段 P、Q，剩余状态是

\[
c=QgP,\qquad cZ=e.
\]

若选择 normal 侧，取 Z 的首字母；若选择 inverse 侧，取 Z 末字母的逆。
两种选择都只消耗 Z 的一个字母，保持这个等式。因此，只要每次允许动作集合保留该见证字母，不论选择哪一侧，都存在一条长度 |W| 的路径。

这给出完整性条件，但不自动证明任意剪枝模板安全：

1. 必须存在满足所选规范形式的最优词。例如同面连续两步可合并；相对面可交换后按固定次序归一。
2. 对 normal 侧要检查左端历史，对 inverse 侧要检查右端历史；两端的信息不能混用。
3. 若状态被空间变换规范化，两端动作、禁用掩码和顺序规范也须按同一空间作用搬运。
4. 若规范化包含取逆，两端必须交换，并逐步取逆、倒序；对于由自动机定义的合法动作语言，需要相应的正向与反向状态。
5. 最后两端相接时，还要满足边界约束，或有完整的归一化论证。

这也是为什么不能把旧 ALLOWED 或 first-move 对称剪枝直接套到新的 96 规范代表上。若一个根反对称满足 φ(g^{-1})=g，它作用于解词的方式为 W→φ(W^{-1})，把末步变成首步；它通常不是旧的“首动作置换”。

本补丁保留原 **search.rs**。接入旧搜索的两种新 oracle 维持旧契约；完整角距离的消费入口另写普通右乘 IDA*，不引入新的 NISS 规范化规则。

### 7.3 失败缓存比距离缓存要求更多

可以按 96 轨道复用纯距离下界，因为 D、d_C 及已证对称不变的 h、v 在轨道上恒定。
更一般地，任意已经证明的数值 L≤D(g)，都可作为同一 96 轨道其他状态的距离下界，即使产生 L 的启发函数本身不对称不变。这只是在搬运距离证书，不能据此断言新状态重新查询的数值相同，也不能继承原函数的 H 不变性、允许动作掩码或路径失败证书。
但一条搜索失败记录必须说清楚究竟排除了哪些后继。

安全的充分条件是：

- 节点确实穷尽了预算 r 内的全部允许续词；
- 缓存键包含影响续词集合的上下文，或者有严格等价的上下文变换；
- 跨状态规范化时，空间标架、取逆位、左右端历史、禁用掩码、根分片等一并搬运；
- 剩余深度的复用方向正确：已完整排除 ≤r，只能直接用于预算≤r；
- 取消、节点预算耗尽、部分遍历、尚未处理的并行分片不写入完整失败记录。

即便某个搜索规则保证“从根至少保留一个最优解”，也不推出每个带上下文子节点的失败都是无条件 D(g)>r。子节点的约束可能排除了另一个进入方向下的合法解。

**corner_distance_search.rs** 的缓存键为完整 Cube 与 previous_face，值为已经完整排除的最大 remaining。
该缓存只断言“这个上一面上下文下的同面归一化续词不存在”，不冒称无条件距离证书。
取消节点不会写入；容量有上限；不使用角轨道作为完整魔方失败键，因为那会丢失边的信息。

普通 IDA* 从可采纳下界开始递增深度，只有一个无副作用的同面相邻归一化约束。完整穷尽所有较小深度后找到的解必最优。节点预算中断则返回 cancelled，不能宣称中断深度已穷尽。CLI 在输出成功前重新作用整个动作词，检查完整魔方或明确标注的“仅角块”目标。

## 8. 表的数学证书、截断与断点

### 8.1 不能只凭文件校验和相信距离

在有限连通无向图中，设根为 e，整数标号 f≥0。若

\[
f(e)=0,\quad f(x)=0\Rightarrow x=e,
\]
\[
|f(x)-f(y)|\le1\quad\text{对每条边 }x\sim y,
\]
\[
f(x)>0\Rightarrow\exists y\sim x,\quad f(y)=f(x)-1,
\]

则 f 就是到根的精确距离。

证明：任意到根路径上的 Lipschitz 条件给 f(x)≤dist(x,e)；不断选择下降邻居，恰好 f(x) 步到唯一零点，给出反向不等式。

若要求 f≤B，只对 0<f<B 的节点要求下降，同样得到

\[
f(x)=\min(\operatorname{dist}(x,e),B).
\]

当 f(x)<B 时下降证明精确；当 f(x)=B 时 Lipschitz 保证真实距离至少 B。因此 capped 表是**确切的截断距离**，并非把未遍历项随意当成某个下界。

**CornerPdb::load** 每次加载都执行上述语义校验；complete exact/capped 文件只能通过受验证的构造器产生。
完整角 96 表则先确认轨道互不重叠并覆盖所有 88,179,840 个角状态，再校验代表的全部 36 个双侧邻居、唯一零点和下降条件。第 4 节已经证明这些代表边覆盖真实商图，因此相同的距离证书适用。

格式标识、模型指纹和 FNV 校验只用于识别不匹配或损坏，不是安全散列，也不是距离正确性的证明。真正的证明由上述图条件及轨道覆盖承担。

### 8.2 部分 BFS 也要验证

u 的断点记录距离数组、队列与处理头。恢复时检查队列唯一性、层序，以及需要扩展的已处理节点的后继完整性；capped 模式到达截断层时无需继续发现外邻居。未知部分暂以当前前沿的下一层为保守标号，再检查全图 Lipschitz 与已知节点下降。这确保已有层的标号有最短路证书。

96 BFS 的断点只保存已发现代表、距离和队列处理头；visited bitset 在恢复时重建。
恢复检查：

- 各轨道的规范代表、互斥性、层序；
- 已知边的 Lipschitz 关系及每个正距离节点的下降邻居；
- 已处理节点的全部双侧后继已经发现；
- 若当前前沿层为 L，则全部小于 L 的层已处理，已发现最大层不超过 L+1。

已知节点有下降路径，所以真实距离不大于标号。若某个已知节点存在更短路，其长度最多 L；沿最短路从根归纳，所有前驱均已处理，它应当更早发现，矛盾。故这些条件足以证明已有标签正确，不要求把部分断点冒充完整表。

未完成断点没有查询接口。完成后再执行全图证书，才发布完整表。

### 8.3 发布和恢复规则

完整表采用“已存在就拒绝”的发布方式；断点替换前检查旧文件的格式、模型、类型及校验和，恢复时再执行第 8.2 节的数学证书检查。替换操作本身不重复验证旧标签的全图语义。临时文件先同步，再原子发布，并在 Unix 同步父目录。guard 的独占锁承担本研究入口的单写者条件；仅有 rename 并不能防止两个独立写者相互覆盖。

u 和 96 BFS 都支持分块进度与断点恢复。双陪集分类构造是规模明确的一次性 DSU 过程，当前没有断点格式；不将它描述为可恢复计算。资源停止后应保留原记录、先处理停止原因，不能删除基线或旧停止记录自动续算。正常中断后的恢复使用原断点与**新的运行 label**，保持旧运行报告。

## 9. 更广的坐标探索：什么已解决，什么尚未闭式化

### 9.1 保留块类别和全部朝向的原始 P

在旧 q 的 corner_class 规范化和 EO 截断之前，可考虑原始 P=K\G：
K 是零 CO、零 EO，角在两个 tetrad 内置换、边在三个四元组内置换，并满足角边共同奇偶的子群。

\[
|K|=\frac{(4!)^2(4!)^3}{2}=3981312.
\]

P 保留角 tetrad 标签、全部 CO、边三类别标签及全部 EO。
P 的纤维支持确定性右乘，但取逆把 K g 变成 g^{-1}K。

**只要求取逆稳定的最小粗化**是双陪集 K g K：原等价关系容许左 K；取逆强迫右 K；两者的传递闭包恰为 K g K。这里没有要求所有右动作在双陪集上仍为单值。

这与补成有序对 (P(g),P(g^{-1})) 是两条不同的路线。
令

\[
c_g=|K\cap gKg^{-1}|,\qquad d_g=|K|/c_g.
\]

一个双陪集含 d_g 个原 P 状态，而有序对在此双陪集中有 d_g² 种。
当 c_g=1 时，该有序对已经在这个双陪集内区分每个完整群元素，相对原 P 在这个双陪集内恰增大 |K| 倍。全局增大比例则是 (Σ_D d_D²)/(Σ_D d_D)，是 d_D 按原 P 状态数加权的均值；存在 c_g=1 的双陪集本身不证明全局比值接近 |K|。因此“可取逆”可能付出很大的信息保留成本，再取逆折叠不一定能补偿；对称有不动点，也不能把后一步写成恒定除以 2。

有序对还不自动给出确定性右转移：P(gs) 可由 P(g) 转移，但 P((gs)^{-1})=P(s^{-1}g^{-1}) 涉及另一侧。
“现在能算 inverse”与“现在能仅用坐标转动”仍是两个要求。

### 9.2 K 双陪集的张量分类及不能漏掉的奇偶位

角张量记录

\[
C_{a,b,t}=
\#\{\text{身份 tetrad 为 }a,\text{位置 tetrad 为 }b,\text{twist 为 }t\},
\]

维度 2×2×3；边张量 E_{a,b,f} 的维度为 3×3×2。
每个身份组和位置组的总数是 4，并满足总 twist=0、总 flip=0。

如果先放宽角边共同奇偶约束，允许两边独立的全部块内置换，那么这些张量完全分类双陪集：每个格内的等价匹配都可被块内左右置换实现。

回到合法 K 后，存在一个必须处理的分裂：

- 只要某一张量格的数量≥2，格内交换给稳定子一个奇排列，从而可以同时修正左右分解的共同奇偶；这一张量对应一个 K 双陪集。
- 如果所有格的数量都≤1，则稳定子平凡，合法状态分成两个 K 双陪集，须再存一个奇偶位。

严格地，设 L 是取消共同奇偶条件的块内置换群，K=kerχ。
给同张量的合法参考状态 g0，写 g=a g0 b，a,b∈L。
合法性强迫 χ(a)=χ(b)。若存在奇稳定子，χ(a) 可以翻转而不改变 g；否则 χ(a) 就是这两类的区分位。
因此

\[
|K\cap gKg^{-1}|=
\begin{cases}
\frac12\prod C_{a,b,t}!\prod E_{a,b,f}!,&\text{某格}\ge2,\\
1,&\text{所有格}\le1.
\end{cases}
\]

所有格≤1 的合法情形确实存在。角的 AA、AB 两格各使用 twist 0、1，BA、BB 两格各使用 0、2；边的每个非对角身份组/位置组格使用 flip 0、1，对角为空。各组总数都是 4，总角朝向和总边翻转也合法，再选具体标签匹配满足共同奇偶即可。

取逆作用为 C_{a,b,t}→C_{b,a,-t} 和 E_{a,b,f}→E_{b,a,f}。若使用上述额外奇偶位，还必须根据参考代表的选择搬运该位；不能只转置张量而宣称所有状态处理完毕。

### 9.3 当前 q 的最小 96 稳定粗化有精确算法，但尚无紧凑全局分类

M 正规化 H，因而置换 H 的角、边轨道。还需检查朝向：H 的所有元素朝向为零，mHm^{-1}=H 迫使空间标架的朝向偏移在这些 H 轨道上分别为常量；K 只在同一轨道内置换，所以这些偏移也被 K 保持。加上共同奇偶不变，可得 M 正规化 K。
实际 q 是 P 的函数，因此它的最小 A 稳定粗化至少包含上述 K 双陪集关系。

下面给出整个 G 上的精确有限规格，不把局部结果冒称全局：

1. 为全部原始 P 枚举规范代表。共有

   \[
   (70\cdot2187)\cdot34650\cdot2048
   =10863756288000
   \]

   个原 P 状态；可以用一个同组标签交换满足角边共同奇偶。
2. 每个代表输出 (q(g), κ(g))，其中 κ(g) 是其 K 双陪集标签；实际实现宜命名 double_class。
3. 同一个 q 桶中的不同双陪集标签用一棵星连接。
4. 对每条连接 (d,d')，加入全部 a∈A 同时作用后的连接 (a·d,a·d')。
5. 求这些连接的无向连通分量。

所得关系恰为包含原 q 碰撞的最小 A 稳定等价关系：它包含所有被迫连接；对每个群作用闭合；而任何满足要求的等价关系必包含全部这些边及其传递闭包。

**不能**在第 4 步直接把 d 与 a·d 合并。对称作用在商空间上有定义，与把同一个对称轨道继续折成一个值，是两步不同的商。

该算法规格是完整且可终止的，但约 10.86 万亿原始 P 状态使它不是本轮的可实用枚举程序。本补丁不实现这个全 G 分类器；如何用上述张量和实际 q 的纤维结构消去枚举，是保留的研究问题。

### 9.4 一个确切的局部闭包结果

令 R={g∈G:π_C(g)∈K_C}，研究限制映射 q|_R 的最小 96 稳定粗化。这个限制问题会消去全部 EO 信息，边部分剩下三组对三组的 3×3 交叉计数矩阵；每行、每列之和都是 4。

为什么 EO 全部消失：一个被截断的同组翻转对已与零键相同，块内置换生成该组全部偶翻转；空间作用把此自由度搬到另外的边组。还可用跨两个组的隐藏翻转对生成组间翻转，故生成全部 11 维偶翻转空间。这里依赖角属于 K_C，使它们的所有空间像仍落入 solved corner 轨道；不能不加证明就推广到任意角状态。

还需证明闭包没有继续合并不同矩阵。在这个子域，原始角坐标恒为 solved，q 采用固定的角规范标架；q 碰撞保留该标架的完整 ESEP，所以保留交叉计数矩阵。空间作用同时置换矩阵行列，取逆转置矩阵：矩阵映射对 A 等变。因此“矩阵相等”本身是包含 q 碰撞的 A 稳定关系，闭包不可能越过它。反方向，同矩阵的状态可由两侧块内标签置换及刚证明可消去的 EO 连通；角在 K_C 内的差异已经属于 q 的纤维，共同奇偶可在块内调整。故闭包恰由这些矩阵分类，而不只是类数至多为 120。

这类矩阵共有 120 个。空间作用为三个组的同时置换，得 31 轨道；取逆再转置矩阵，得 30 轨道。
普通 S3 六作用的不动数为 120、12、12、12、15、15；
加转置的六个作用不动数为 42、42、42、42、3、3。因此

\[
(120+3\cdot12+2\cdot15)/6=31,
\]
\[
(120+3\cdot12+2\cdot15+4\cdot42+2\cdot3)/12=30.
\]

这些数可直接手算。给首行 (a,b,c)，第二行的允许完成数为
15−C(a+1,2)−C(b+1,2)−C(c+1,2)，因为两个列上界不可能同时违约。
首行类型 (4,0,0)、(3,1,0)、(2,2,0)、(2,1,1) 的重数分别为 3、6、3、3，完成数分别为 5、8、9、10，所以总数是 3·5+6·8+3·9+3·10=120。

同时交换两行两列的不动矩阵形如 [[a,b,c],[b,a,c],[c,c,d]]，其中 2c+d=4、a+b=4−c，给 Σ_{c=0}²(5−c)=12。三循环的不动矩阵是 circulant，三个参数和为 4，给 C(6,2)=15。

转置不动的对称矩阵由非对角参数 x,y,z≥0 决定，要求 x+y、x+z、y+z 都≤4；计数为 Σ_{x=0}⁴Σ_{y=0}^{4−x}(5−max(x,y))=15+13+9+4+1=42。若 P 是换位矩阵，A=P AᵀP 经 B=PA 与对称矩阵双射，仍为 42。若 P 是三循环，(Ad_P∘transpose)²=Ad_{P²}，不动矩阵必须同时 circulant 且对称，即对角 a、非对角 b、a+2b=4，共 3 个。

其中，本限制关系里包含单位元的闭包类大小为

\[
|K|\cdot2^{11}=8153726976.
\]

这些是限制映射 q|_R 的明确结果；这里没有以它代替整个 G 的闭包分类。整个 G 的闭包是否也能如此简化，不在已证明结论之列。

## 10. 理论收益与代价：静态规格，不是测量

| 路线 | 值／状态规模 | 本实现主要额外结构 | 数学收益与代价 |
| --- | ---: | --- | --- |
| ell4 | 无距离表 | tetrad、φ、twist 检查 | 能提供旧 q 的全部 96 查询仍看不见的信息；下界很弱 |
| u 的 H_C\C 坐标 | 918540 个一字节值 | 420×18 与 2187×18 的 u16 转移，共 93852 字节 | 可直接维持同侧 H 契约；两次查询后可产生 h 或 w，但两者用途不同 |
| v 的双陪集＋96 | 907 个最终距离值 | 当前分类文件 1905744 字节，另需 u 来生成最小值 | 最终值很小；为兼容 H 双侧而丢失了更多信息，且查类不是免费 |
| 完整角 M 商 | 1841970 个轨道 | 本补丁未写独立 48 版本 | 作为 96 方案的解析比较基数 |
| 完整角 96 商 | 934778 个轨道 | rank+distance 的稀疏有序表；36 后继与规范化 | 保留最大角块距离下界；必须承担反自同构的转移与标架成本 |
| 当前 q 的全 G 稳定粗化 | 未得全局闭式计数 | 参考闭包规格需约 10.86 万亿个 P 代表 | 可以严格定义；当前不主张实用 |

文件规格：

- u：64 字节头＋918540 个 u8，共 **918604 字节**。
- 双陪集分类：含两级分类映射、代表和头，共 **1905744 字节**；“907 字节值表”不代表总存储 907 字节。
- 完整角 96 距离：40 字节头＋934778 条 (u32 rank,u8 distance)，共 **4673930 字节**。
- 96 BFS 原始角 visited bitset：**11022480 字节**。
- 96 完整证书临时按原角 rank 展开的 u8 距离：**88179840 字节**。
- 内存中的 rank/distance 结构通常因对齐为每条 8 字节，还存在 Vec 容量、队列、规范化临时值、文件缓冲和哈希缓存等开销。

这些数来自格式与状态计数，不是峰值 RSS。guard 为小角流程设 512 MiB RSS 预算、完整 96 流程设 1 GiB；这是停止阈值，不是测得消耗。

1841970→934778 的比值不是精确 2，因为存在反对称不动轨道。即使只比较这两个完整角商空间，少约一半代表也不等于查询或搜索快一倍：完整角规范化会试空间像与逆，36 个双侧后继增大工作量，稀疏表二分和格式验证也有成本。

与现有 Opt8 的比较更不能只看表大小。d_C 丢弃所有边信息，可能比原 PDB 弱；u、v 又进一步放松角目标。在固定搜索树、遍历次序和所有控制规则、仅作逐点 max 增强的比较中，新界必须在实际访问节点严格超过旧值，才可能带来额外剪枝。若它同时改变 NISS 选侧或遍历次序，节点数还会受调度影响，须另行分析。减少节点仍不保证总时间更短。本轮没有这方面运行证据。

## 11. 代码结构与本地运行顺序

### 11.1 补丁内容

| 文件 | 作用 |
| --- | --- |
| src/corner_coset.rs | H_C 坐标、独立 ell4、分离转移、exact/capped BFS、断点与距离证书 |
| src/corner_symmetry.rs | 真实 48 作用、96 规范化及解词还原、双陪集 DSU、完整角 96 BFS 和证书 |
| src/corner_oracle.rs | 同侧下界与纯距离证书的类型边界、旧 oracle 包装 |
| src/corner_distance_search.rs | 有界普通 IDA*、带 previous_face 的完整状态失败缓存 |
| src/bin/corner-research.rs | 建表、校验、查询、只解角块、整解与旧 Opt 组合入口 |
| tests/corner_coset_tests.rs | 坐标和真实 Cube 转移、H 生成、取逆反例、ell4 的小规模交叉校验 |
| corner-policy.mts / corner-policy.test.mts | 独立运行参数与预算协议及其测试 |
| Cargo.toml / src/lib.rs | 非默认 feature 和专用 binary 注册 |
| guard.mts | 接入新协议，沿用原独占、基线、压力、换出和余量保护 |
| x86-simd.md / 本文件 | 现有结论的边界与完整证明、规格和运行说明 |

旧 **search.rs、cube.rs、coord.rs** 没有算法修改；没有新增依赖；旧 Opt8/9/10 主表与日常入口不被替换。

### 11.2 应用补丁与静态准备

交付包以 ab94ce76dee2e658e3c6a368f72fa240750f4d16 为源基线。
在你已有的完整仓库中应用 **corner96.patch**；包中的 files/ 是对应改动文件的审阅副本，不是完整仓库。
先保留你本地已有修改；若当前源码已变化，应人工处理上下文，不要强制覆盖。

以下都是**给本地后续执行的命令**。本次交付没有执行其中任何编译、测试、枚举或求解命令。

~~~sh
# 在已有 cuberoot.me 仓库根目录；修改为实际下载位置。
git apply --check /absolute/path/to/corner96.patch
git apply /absolute/path/to/corner96.patch

corner_repo="$PWD"
corner_crate="$corner_repo/solver/experiments/cube48opt-rust"
corner_bin="$corner_crate/target/corner-research/release/corner-research"
corner_out="$corner_repo/.tmp/cubeopt-reverse/corner96"

cd "$corner_crate"
cargo build --release --features corner-research \
  --target-dir target/corner-research --bin corner-research

"$corner_bin" --help
"$corner_bin" inspect
~~~

这里不启用其他候选搜索 feature，也不覆盖历史已验收 binary。

### 11.3 先做不建表的小检查

~~~sh
# 仍在 crate 目录；这些测试不构建距离表。
cargo test --release --features corner-research \
  --target-dir target/corner-research --test corner_coset_tests
cargo test --release --features corner-research \
  --target-dir target/corner-research --lib corner_symmetry::tests
node --test corner-policy.test.mts guard.test.mts

# 回到仓库根；后续实际研究计算统一经过原 guard。
cd "$corner_repo"
CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-small-001 "$corner_bin" verify-small

CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-coordinate-001 "$corner_bin" verify-coordinate
~~~

verify-coordinate 检查全部 918540×18 个右转移与真实 Cube 转动的一致性。
小单元测试是不同数学层的交叉检查，不是完整表的替代品。

有现成 Opt8 小坐标快照时，可选执行：

~~~sh
corner_opt8_small="/absolute/path/to/opt8/small-memory.bin"
CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-projection-001 "$corner_bin" \
  verify-opt8-projection "$corner_opt8_small"
~~~

它核对第 2 节的投影取逆见证，以及 ell4 的正值状态在旧 q 的全部 96 查询中仍映到 solved 键。只读小快照，不加载 Opt8 主 PDB。
该命令通过只能验证这两个有限命题，不证明所有旧表数值在取逆下相等。

### 11.4 首先构造 u 与双陪集类

~~~sh
CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-u-build-001 "$corner_bin" \
  build-u "$corner_out/u-exact.bin" "$corner_out/u-exact.checkpoint" exact 16384

CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-u-verify-001 "$corner_bin" verify-u "$corner_out/u-exact.bin"

CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-double-build-001 "$corner_bin" \
  build-double "$corner_out/double-classes.bin"

CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-double-verify-001 "$corner_bin" \
  verify-double "$corner_out/double-classes.bin"
~~~

若只要截断距离，把 exact 改成 1…254 中的整数，同时使用新文件名，例如 u-cap8.bin 与 u-cap8.checkpoint。
恢复 u 时模式必须相同。
构造时会自动保存初始与分块断点；完整文件存在则拒绝覆盖。普通中断后换一个新 label、保留同样 output/checkpoint 即可恢复；若是资源保护停止，须先按仓库现有规则解决停止原因。

query-v 从 u 的分量最小值导出 v；它不是在 907 类上直接做 BFS。加载双陪集文件会重新构造分类并逐项对照。

### 11.5 先查值、再做浅层完整性校验

输入是一行一个 id、一个真正的制表符、一个 scramble。空 scramble 表示 solved。

~~~sh
printf 'solved\t\nhalf\tU2\nshort\tR U F\n' |
  CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-query-u-001 "$corner_bin" query-u "$corner_out/u-exact.bin"

printf 'solved\t\nhalf\tU2\nshort\tR U F\n' |
  CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-query-v-001 "$corner_bin" \
  query-v "$corner_out/u-exact.bin" "$corner_out/double-classes.bin"

CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-search-small-001 "$corner_bin" \
  verify-search "$corner_out/u-exact.bin" 2
~~~

verify-search 独立构造到指定深度（只允许 0…3）的完整 Cube BFS 球，逐状态检查原 NISS 入口的 contexts=1 与 8、最优长度和解词回放。若传入完整角 96 表，还会比较普通 IDA* 缓存关闭与开启两种情形。它是本地实现验证；第 7 节的证明才是任意深度的数学条件。

### 11.6 完整角 96 建表与完整证书

~~~sh
CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-full-build-001 "$corner_bin" \
  build96 "$corner_out/corner96.bin" "$corner_out/corner96.checkpoint" 1024

CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-full-verify-001 "$corner_bin" verify96 "$corner_out/corner96.bin"

printf 'short\tR U F\n' |
  CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-full-query-001 "$corner_bin" query96 "$corner_out/corner96.bin"

printf 'short\tR U F\n' |
  CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-corners-solve-001 "$corner_bin" solve-corners "$corner_out/corner96.bin"

CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-search-full-001 "$corner_bin" \
  verify-search "$corner_out/u-exact.bin" 2 "$corner_out/corner96.bin"
~~~

solve-corners 只保证角复原及其最短长度，输出 scope 明确标注 corners-only；不能把所得动作误当完整魔方解。
所有加载入口都校验完整表语义，启动开销可能明显；本轮没有设计跳过证书的快速加载缓存。

96 建表恢复同样换新 label、保留 checkpoint 路径。每次恢复都会重建 visited 并验证已有前沿，因此恢复不是常数时间。chunk 太小会提高断点写入成本；默认值只是有限参考值，没有经过性能调优。

### 11.7 三种有界整解入口

先使用短 scramble 和有限节点预算：

~~~sh
printf 'short\tR U F\n' |
  CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-solve-u-001 "$corner_bin" \
  solve-u "$corner_out/u-exact.bin" 10 1000000 1

printf 'short\tR U F\n' |
  CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-solve-v-001 "$corner_bin" \
  solve-v "$corner_out/u-exact.bin" "$corner_out/double-classes.bin" 10 1000000 1

printf 'short\tR U F\n' |
  CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-solve-distance-001 "$corner_bin" \
  solve-distance "$corner_out/corner96.bin" 10 1000000 100000
~~~

前两者用现有 NISS；第三个是普通右乘 IDA*。
解被找到时先回放验证，通过后才输出含 optimal_if_found 的结果；JSON 没有单独的 replay 字段。没有解要区分已穷尽深度和 cancelled。
这些角下界可能较弱，不预言随机完整魔方能在示例节点预算内解出。

最后才考虑与既有 Opt8/9 PDB 联合：

~~~sh
corner_opt_variant=8
corner_opt_small="/absolute/path/to/matching/small-memory.bin"
corner_opt_table="/absolute/path/to/matching/opt-table.dat"

printf 'short\tR U F\n' |
  CUBEOPT_BACKEND=corner node "$corner_crate/guard.mts" \
  corner96-solve-opt-001 "$corner_bin" \
  solve-opt "$corner_out/u-exact.bin" "$corner_opt_variant" \
  "$corner_opt_small" "$corner_opt_table" 10 1000000 1
~~~

档位只允许 8 或 9，小快照必须匹配所选档位；大表在加载时按原格式校验。预算包含相应主表，因此它不是小内存命令。本命令只读取既有主表，不生成它，也不接入 Opt10/H11。

### 11.8 守卫和平台边界

以上运行步骤沿用仓库现有 **macOS guard**，要求完整仓库、Rust 与 Node.js 24+。
Rust 算法本身未用 macOS 专用 API；当前资源监控依赖该仓库的 macOS 系统观察入口，不能据此宣称已提供 Linux/Windows 等价的受保护运行流程。

新 backend 固定为 corner，运行文件只允许专用 binary，研究产物只允许仓库 .tmp/cubeopt-reverse/corner96/ 下的绝对规范路径。
它不接受其他实验的 REVIEW 变量、档位、H 参数或并行设置；内部启动标记由 guard 设置，不能手工用它跳过监控。
如 guard 因已有停止记录拒绝启动，保留记录并按原规则处理；本文没有重置或绕过命令。

### 11.9 本地验收应记录的证据

1. 编译及小测试的实际结果；有失败就先修实现，不以数学论证代替编译验收。
2. 坐标转移与旧 Opt8 投影反例校验的实际结果。
3. u exact/capped 证书、双陪集 11436/5870/1275/907 计数、完整角 934778 轨道覆盖与距离证书。
4. 浅层完整 Cube BFS 对 NISS 和普通 IDA* 的最优长度与解词回放。
5. 仅在上述通过后再做有界样例与对照，分别记录节点数、查询数、构建／加载时间、搜索时间和资源观测。

本交付里的期望计数来自解析证明；不是已经完成上述程序验收的日志。没有保存伪造的测试通过报告或性能报告。

## 12. 已证明、已实现、未验证与仍开放的问题

**已证明且被本原型依赖：** 当前 q 的取逆不封闭；完整角 96 作用；正确双侧商图及最优词还原；H_C 坐标与因子转移；u、v、d_C 的可采纳性与相应最大性；ell4≥4 的严格新信息见证；相关 Burnside 轨道计数；NISS/缓存的充分条件；完整与截断距离证书。

**已写出、尚待本地验证：** Rust 编译兼容性、所有测试、实际小表快照中的规范标架、完整图／轨道覆盖、断点文件恢复、guard 集成以及示例求解。

**已给精确规格但未写实用实现：** 当前 q 在整个 G 上的最小 96 稳定粗化、K 双陪集张量＋分裂奇偶位分类器；没有把万亿规模参考枚举包装成可轻松运行的命令。

**仍开放：**

- 整个 G 的稳定粗化能否用紧凑的全局不变量直接分类，哪些 EO 信息必然丢失；
- 满足旧 oracle 契约时是否能用同等存储取得比当前新坐标更强的边角联合下界；
- 完整角 96 代表是否有实用、低成本的稠密排名，以及更快的规范化；
- 把取逆规范化深度接入现有 NISS 后，能否给出覆盖全部允许动作和两端上下文的简洁实现；
- ell4 的常数 4 对 K_C\H_C 是否可提高，或哪些子类达到它；本文未宣称 4 为精确距离；
- 各距离分布、表直径、缓存命中、总运行时间及内存峰值。

这些未决项不影响本原型已有的正确性证明；它们决定是否值得进一步开发和是否能取得工程收益。不能从本轮结果推出实测提速，也不能把“现有 Opt8 无法直接减半”扩张成“96 对称性数学上不可行”。

## 13. 原始资料与本交付的归属

源码基线：

- [CubeRoot x86 SIMD 分析及 96 对称性边界](https://github.com/2017YANR02/cuberoot.me/blob/ab94ce76dee2e658e3c6a368f72fa240750f4d16/solver/experiments/cube48opt-rust/x86-simd.md#why-96-symmetries-do-not-directly-halve-the-current-opt8-table)
- [Cube 表示、乘法、取逆与 MOVES](https://github.com/2017YANR02/cuberoot.me/blob/ab94ce76dee2e658e3c6a368f72fa240750f4d16/solver/experiments/cube48opt-rust/src/cube.rs)
- [CoordTables、corner_class、对称标架与投影](https://github.com/2017YANR02/cuberoot.me/blob/ab94ce76dee2e658e3c6a368f72fa240750f4d16/solver/experiments/cube48opt-rust/src/coord.rs)
- [PruningOracle、阶段剪枝与 NISS 搜索](https://github.com/2017YANR02/cuberoot.me/blob/ab94ce76dee2e658e3c6a368f72fa240750f4d16/solver/experiments/cube48opt-rust/src/search.rs)
- [本研究起始固定版本的搜索入口](https://github.com/2017YANR02/cuberoot.me/blob/cb02d1d03112330a596d462aaa57a1abd0e2298e/solver/experiments/cube48opt-rust/src/search.rs#L830)

相关一手说明：

- Herbert Kociemba：[Symmetry Reduced Coordinates](https://kociemba.org/math/symcord.htm)。该文说明对子群规范化与坐标纤维一致性的要求，以及稳定子和附加标架的处理。
- Herbert Kociemba：[Antisymmetry and the Cube](https://www.kociemba.org/antisymmetric.html)。其中区分空间对称与群取逆，说明 96 操作与最优长度的关系。
- Morwen Thistlethwaite：[原始分阶段群方法](https://www.jaapsch.net/puzzles/thistle.htm)。本说明中的 H 是六半转子群，不能与其他文献的阶段编号或 H 记号直接互换。

除引用的源码事实和背景定义外，本文件中新的反例、商空间构造、最大性证明、计数推导、证书条件和原型代码属于本次独立分析。程序性验证留给本地后续运行；引用背景文献不代表它们已验证本次代码。
