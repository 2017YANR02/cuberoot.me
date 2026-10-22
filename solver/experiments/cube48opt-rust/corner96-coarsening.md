# 实际 Opt8 投影的全局最小 96 稳定粗化：330,960 状态的精确符号规格

状态：纯数学推导及源码静读；未编译、未运行求解器、未建表、未执行数学枚举或测试。

本附录的全局粗化类数仍未求值；另行完成的角块辅助表计算见 [本地验证](corner96-validation.md)，不能用它代替本附录的全局闭包枚举。

这份附录给出 `corner96-research.md` §9.3 的全局符号闭包。它替代约 10.86 万亿个原始 P 代表的参考枚举，但不宣称已经算出实际 small snapshot 的最终闭包类数，也不宣称全局 EO 必然全部消失。

## 1. 要计算的对象与源码前提

设 G 是合法三阶魔方群，M 是 48 个真实空间共轭，I(g)=g⁻¹，A=M×⟨I⟩。令 q 是现有 Opt8 的完整键。目标关系 E 是包含 q 相等关系的最小 A 稳定等价关系：

    q(g)=q(h) ⇒ g E h；
    g E h ⇒ a(g) E a(h)，a∈A。

“稳定”不要求 g E a(g)。把一个稳定商中的对称轨道继续合并，是另一项操作。

源码的关键事实如下：

- `src/coord.rs:498–510` 的 raw corner 只保留八角的 tetrad 身份类别及七个独立 CO，共 70×2187=153090 个 raw 值。
- `src/coord.rs:543–572` 用该 raw 值查出角类 O 和一个 frame α，然后保留 α(g) 的完整边身份类别位置数组 z，以及 EO。
- `src/coord.rs:390–404` 和 `pack_index` 的 Opt8 打包只保留规范位置 3,…,10 的 EO。因此四个隐藏位置是 T₀={0,1,2,11}。
- 三个边组依次是 {0,1,2,3}、{4,5,6,7}、{8,9,10,11}，编号 0、1、2。T₀ 分别在三组中占 3、0、1 个位置。
- `src/coord.rs:717–737` 给出了 frame 的完整角、边共轭约定。边 EO 偏移不能在未证明前擅自置零。
- 合法 separation ranks 的单射性由 `CoordTables::from_variant_bytes` 检查；打包的 class、ESEP、EO 字段不重叠。

本定理只用 q 的上述字面语义。它不需要先假定 O 恰好是 raw corner 的真实 M 轨道分类，也不需要假定 frame 按最小值或字典序选择。若 corner_class 有额外合并，下面按实际 O 分桶的算法也会包含这些合并。所需的几何前提是 snapshot 中选用的 frames 确为给定 M 的真实作用、并正常化下面的块内置换群；这一点应与 snapshot 的边界校验分开验证。

## 2. 块内置换、角张量和边交叉矩阵

K_C 是零 CO、分别置换两个角 tetrad 的 S₄×S₄。K_E 是零 EO、分别置换三个边组的 S₄³。

K={(k_C,k_E)∈K_C×K_E: sign(k_C)=sign(k_E)}。

M 正常化 K_C、K_E、K：半转群 H 的角、边位置轨道恰是这些 tetrad/边组；H 的朝向全零且 M 正常化 H，所以空间 frame 的朝向偏移在每个 H 轨道上为常量。任意同组标签置换保持这些偏移；共同奇偶条件也被共轭保持。

记 D 为一个 K_C 双陪集。它由角张量完全分类：

    C[a,b,t] = #{位置 i：身份 tetrad=a，位置 tetrad=b，CO=t}，
    a,b∈{0,1}，t∈F₃。

每行、每列总数均为 4，总 twist 为 0。角处没有角边共同奇偶限制，因此无需额外奇偶位。

对边只先记录未着色矩阵

    N[a,b] = #{位置 i：身份边组=a，位置边组=b}，a,b∈{0,1,2}。

每行、每列总数均为 4。这类 N 共 120 个。

q 对左 K 恒定，所以 E 包含所有左 K 关系。取逆稳定性进一步使 E 包含所有右 K 关系。因此 E 至少包含 K 双陪集关系。但原 K 双陪集的“所有彩色格至多 1 时多一个奇偶位”尚不能直接丢弃；第 5 节专门证明本构造为何可以消掉它。

## 3. 每个角双陪集选择一个保护组

对每个角张量 D，任选并固定一个角代表 c_D。可以按位置顺序给各 C[a,b,t] 分配位置，再在各身份 tetrad 内按升序分配标签；无需枚举完整角排列。

读实际 corner_class 在 c_D raw 值上的 frame α_D。令 σ_D 是此 frame 从物理输入边组到规范边组的置换。定义

    b(D)=σ_D⁻¹(1)，
    a(D)=b(D⁻¹)，
    P(D)=(a(D),b(D))。

P(D) 是一个“保护格”：第一坐标是身份组，第二坐标是位置组。b(D) 是在 α_D 下变成完全保留的规范边组 1 的物理位置组。

这里 c_D⁻¹ 不必等于所选 c_{D⁻¹}。这不会造成 gauge 漏洞。两者在同一 K_C 双陪集，可用左右 K_C 变换相互搬运；每个 K_C 元素都能用相同奇偶的边块内置换补成合法 K 元素。这样的边变换只在各组内置换，不改变三个组的标签。因此下面在所选代表上证明的 EO 自由，会搬运到同一角双陪集的每个角状态，包括任意 g⁻¹ 的角状态。

## 4. 必然遗忘的 EO 子空间

对位置集合 S，记 W(S) 为支撑包含于 S 的偶翻转向量空间。

### 引理 4.1：两个位置组上的全部偶翻转已经属于 E

固定角为 c_D。α_D 的隐藏位置集合 T=α_D⁻¹(T₀) 在两个边组中分别有 3、1 个点，在第三组 b(D) 中没有点。q 不能区分在 T 上的任何偶翻转。

E 又包含右 K。取只作用在边上的 r∈A₄³；它是合法 K 元素，且不改变角。由

    g E g r E g r w E g r w r⁻¹

可知所有 r w r⁻¹ 也是 E 允许的右翻转。T 中有一个跨这两个组的翻转对；A₄ 在四个位置上传递，三个 A₄ 可独立作用，因此得到两个组之间的所有跨组翻转对。完整二部图连通，其边向量生成这八个位置上的全部偶翻转。

所以对任何角属于 D 的 g，E 允许右乘

    W(S_D)，S_D={i: position_group(i)≠b(D)}，|S_D|=8。

从 c_D 搬运到任意同双陪集角状态时，右 K 的边部分只在各组内置换，故 W(S_D) 保持不变；左 K 不影响右翻转的组支撑。这证明了“任何角属于 D”的量词，而非仅证明所选代表。

### 引理 4.2：取逆给出身份组上的自由

对 g⁻¹ 应用引理 4.1，再取逆，得到对 g 的左翻转自由：可以偶翻转所有身份组不等于 a(D)=b(D⁻¹) 的边。

若 g 的边排列为 p（位置→身份），换成右翻转时其支撑是

    U_D(p)={i: identity_group(p(i))≠a(D)}，|U_D(p)|=8。

S_D 与 U_D(p) 至少交于 4 个位置。两个偶翻转空间在非空交集下满足

    W(S_D)+W(U_D(p))=W(S_D∪U_D(p))。

该等式可由两张完全图的并仍连通来证明。其补集恰好是 P(D) 格中的边。

因此，对固定角和固定边排列，除保护格外的一切偶 EO 改变均已属于 E。保护格大小 n=N[a(D),b(D)]≤4；外部至少有 8 个位置。

这是全 G 的严格结论。它还没有断言保护格里的 EO 信息也会消失。

## 5. 精确基础关系 B₀：仅剩 (D,N,k)，无分裂奇偶位

定义 B₀ 为左右 K 及第 4 节两侧 EO 自由生成的等价关系。每个生成关系都已证明属于 E，故 B₀⊂E。

令

    k=#{保护格 P(D) 中 EO=1 的边}，0≤k≤N[P(D)]。

### 定理 5.1

B₀ 的类恰由三元组 (D,N,k) 分类。

**必要性。** 左右 K 保持 D、N、保护格内的 EO 数；第 4 节的翻转不触及保护格，所以保持 k。

**充分性与奇偶修补。** 对同一 D、N、k 的任意合法状态，使用外部偶翻转，把保护格外 EO 变成一个共同指定的彩色计数：若 k 为偶数，外部全零；若 k 为奇数，外部恰留一个 1。保护格内只需保留 k 个 1 的计数，具体位置无需相同。原外部 EO 奇偶本来就等于 k mod 2，所以这种修改属于允许的偶翻转。

还要把那个外部单 1 的位置选好。两个非保护位置组有 8 条边，分布在 3×2=6 个未着色 N 格中，因此某格至少有两条边。选其中两条并令它们 EO 相同，必要的外部单 1 放到其余位置；至少还有 6 个位置可选。这得到一个大小至少 2 的彩色边格。

取消角边共同奇偶条件，记 L=K_C×K_E。角张量 C 与完整彩色边张量 E 完全分类 L 左右轨道，因此这两个状态可写成 y=l x r，l,r∈L。合法性强迫 χ(l)=χ(r)，其中 χ=sign(corner)sign(edge)。如果两者均为 −1，就利用刚才那个大小至少 2 的彩色边格：同时交换其两条边的位置和对应身份，是 x 的左右稳定子，左右 χ 都是 −1。将该稳定子插入 l x r，两侧 χ 同时变成 +1，于是得到合法 K×K 变换。

所以原始 K 双陪集有时需要的分裂奇偶位，在 B₀ 中一律被这些 EO 自由消掉。也没有额外 EO charge：全局偶翻转只决定保护格外的奇偶，外部至少 8 个位置足以实现它。

### 定理 5.2：B₀ 恰有 330,960 类

角张量的未着色 2×2 矩阵必为 [[m,4−m],[4−m,m]]，m=0,…,4。一个大小 n 的格有 binom(n+2,2) 个三色计数。忽略总 twist 的张量总数为

    Σ_m binom(m+2,2)² binom(6−m,2)²
    =225+900+1296+900+225=3546。

每个 m 都有某格大小为 1、2 或 4。循环该格的三种颜色，使总 twist 循环遍历 F₃，所以总 twist=0 的张量恰占三分之一。角 D 总数为 1182；按 m 分别为 75、300、432、300、75。

对任意固定边格 (a,b)，120 个 N 在行列置换下对称，且每张矩阵总和为 12。因此

    Σ_N N[a,b]=120×12/9=160，
    Σ_N (N[a,b]+1)=280。

每个 (D,N,k) 都有合法实现：保护格内放 k 个 1，外部补 EO 奇偶；角或边同组标签交换可补共同排列奇偶，不改变 D、N、k。故

    |G/B₀|=1182×280=330960。

这是基础关系 B₀ 的精确类数，不是最终 E 的类数，也不是再把 A 轨道合并后的类数。最终 E 至多有 330960 类。无论最终如何合并，任何尚存 EO 信息都已经是某个至多 4 条边的保护格中一个计数 k∈{0,…,4} 的函数；无需保留原来的 2048 EO 模式、额外 charge 或分裂奇偶位。

## 6. 先把 B₀ 做成真正 A 稳定的关系 B₁

空间作用 m∈M 在 N 上同时置换身份组和位置组。因其正常化 K_E，其 EO frame 偏移在每个输入格上是常数 η_m(a,b)∈F₂；因此一个格内的 EO 数只会保持 k 或变成 n−k。取逆则转置格并保持 EO 数。

可以直接从 `CoordTables::conjugate` 的 source/inverse arrays 读取组置换和 η；不应预先假设 η=0。角 D 的作用可直接对其选定代表作共轭后重新形成角张量，或用同样的块内常量偏移公式。

对生成元 h∈A，令 ρ_h 是边格的置换（空间作用为同时行列置换，I 为转置）。比较

    ρ_h(P(D)) 与 P(hD)。

如果二者不同，给角层 hD 作标记；再沿角 D 上的 A 作用传播全部标记。

### 定理 6.1

B₀ 的最小 A 稳定粗化 B₁ 恰是：

- 未标记 D：仍用 (D,N,k)；
- 已标记 D：用 (D,N)，该层全部 EO 已经消失。

**为什么失配强迫所有 k 合并。** h 把原保护格送到与目标保护格不同的格。这两个格不相交，每格最多 4 条边，至少还剩 4 条边可补 EO 奇偶。因此在同一个 B₀ 类的 h 像内，目标保护格的 EO 数可任取 0,…,n，而原保护格 EO 数保持固定。A 稳定性强迫这些 k 类全并。一个已完全忘掉 EO 的层的 A 像也完全忘掉 EO，所以须传播标记。

**为什么没有更多合并。** D 和 N 本身对 A 等变；上面的生成关系不能合并不同 D 或 N。对于未标记的层，保护格必沿每个生成元协变，并且不会映到已标记层，故 k→k 或 n−k 给出确定性作用。因此所述关系自身 A 稳定，达到最小性。

因 a(D)=b(D⁻¹)，P(D⁻¹)=P(D)ᵀ，I 的直接失配实际不会发生；但 M 引起的标记仍应沿 I 传播。

如果 r 个角 D 被标记，则 B₁ 类数精确为 330960−160r。这里只是一个可执行的公式，尚未读取实际表并计算 r。

可选的更早消去规则：扫描全部 raw corner 时，对同一 D 收集各 frame 的物理完全保留组 b_x。若出现两个不同组，则两个八位置自由子空间的并已经覆盖全部 12 个位置，故该 D 无需等 M 闭包就可标记为 EO 全消失；其逆层及 A 像也可标记。这是第 4 节证明的直接推论，最终结果不会改变。若使用这项优化，应把加强后的中间关系称为 B₁⁺：它仍包含于 E，但用到了 B₀ 以外的 q 纤维信息，不能继续称它为“B₀ 仅凭 A 稳定所需的最小粗化”。

### 推论 6.2：至少 78 个角层必然全部消去 EO

这项结论不需要读取实际 frame 的选法。取真实体对角 120° 旋转。在 K_C 双陪集上的作用等效于 Ad_t，其中 t 在第一个 tetrad 的四角上 twist=+1，在第二个 tetrad 上 twist=−1。其排列部分属于 H_C⊂K_C，因此在双陪集上可以消去。这个真实旋转同时把三个边组作一个 3-cycle。

Ad_t 在角张量的两个对角格 C[0,0,*]、C[1,1,*] 上不改变颜色，在两个非对角格上分别循环三种 twist 颜色。因此 D 被它固定，当且仅当两个非对角格都三色等量。若每个对角格的总数是 m，则非对角格总数是 4−m；只能是 m=4 或 m=1。

- m=4：非对角格为空，该 m 的全部 75 个合法角张量都固定。
- m=1：两个非对角格各为 (1,1,1)；两个对角格各有一个角，其 twist 必须相反以满足总 twist=0，恰有 3 个张量。

共 78 个 D 被这个真实旋转固定。对每一个这样的 D，三个边组的 3-cycle 不可能固定任何边格 P(D)，所以保护格失配，整层 EO 必被第 6 节消去。故无论实际 frame 如何选择，r≥78，并有

    |G/B₁|≤330960−78×160=318480。

330960 仍然是基础关系 B₀ 的精确类数；318480 是 B₁ 的解析上界，不能写成实际 B₁ 的已计算精确类数，更不能写成最终 E 或其 A 轨道商的类数。

## 7. 不枚举边排列或 256 个可见 EO 的 q 纤维连接

只扫描 153090 个 raw corner。每个 raw x 产生描述符

    d_x=(O_x,D_x,σ_x,η_x)，

其中 O_x、frame 从真实 corner_class 读取，D_x 从 raw 的 tetrad 标签和 CO 直接形成，σ_x、η_x 从 frame 读取。按 O 分桶，并可去掉同桶内重复描述符。

固定一个桶 O 和一个规范边交叉矩阵 B（120 种之一）。对描述符 d，输入物理矩阵唯一为

    N_d=σ_d⁻¹ B σ_d。

若 D_d 未标记，其物理保护格在规范 frame 中变成 J_d=σ_d(P(D_d))，大小 n=B[J_d]。物理 k 与规范该格翻转数 ℓ 的关系是

    ℓ=k，η_d(P)=0；
    ℓ=n−k，η_d(P)=1。

若 D_d 已标记，则该描述符在 B₁ 中仅有一个顶点 (D_d,N_d)。

### q 纤维星连接规则

**保留计数的唯一情形：** 所有描述符都未标记，所有 J_d 是同一个格 J，且 J 的位置列是规范完全保留组 1（列编号 1）。这时对每个 ℓ=0,…,B[J] 单独建一棵星，把所有描述符对应的顶点连起来，按各自 η 选择 k=ℓ 或 n−ℓ。

**其他情形：** 把该 (O,B) 的全部描述符、全部允许 k 对应的顶点连成一棵星。

这条规则给出的边不一定每条都直接是一次 q 碰撞，但恰好生成 q 碰撞在这些 B₁ 顶点上的等价闭包。

### 规则的证明

q 相等表示 O 相等、规范 ESEP 位置数组 z 相等，以及规范位置 3,…,10 的 EO 相等。它当然强迫规范交叉矩阵 B 相等。

1. 若共同 J 完全处于规范列 1，其全部四个位置都是可见位置。相同 z 和可见 EO 必须给相同 ℓ；反过来，任意给定 ℓ 都可选一组共同的 z、完整 EO，分别逆变换到各描述符，得到该星的直接 q 碰撞。边身份组内标签交换可修复与角的共同排列奇偶，不改变任何所记录量。

2. 若有一个已标记描述符，它的 B₁ 顶点允许任意合法 EO，可作为所有其余计数之间的中介。因此全部顶点连通。

3. 若出现两个不同的 J，它们是不相交的格，每格至多 4 条边。任意指定两格的翻转数，都可用同一个完整规范 EO 实现，且至少余下 4 条边补偶奇约束。这给两描述符的任意计数之间的 q 碰撞。其他描述符可借其中一个保护格不同的描述符连接，故全部连通。

4. 若所有 J 相同，但其位置列为 0 或 2，当 n>0 时可选择一个同矩阵 B 的 ESEP 数组 z，使 J 中至少一条边落在隐藏位置。T₀ 总有另一个隐藏位置在 J 外：列 0 最多包含隐藏的 0、1、2，仍有列 2 的 11；列 2 最多包含 11，仍有列 0 的三个隐藏点。同时翻转这两个隐藏位置保持 q，却可使该格计数从 ℓ 变成 ℓ+1（选择其中受翻转的保护格位原先为 0）。对 ℓ=0,…,n−1 都可这样构造，故全部计数相连。不同 z 不妨碍连接：B₁ 已经忘掉同一 N 内的具体 ESEP 排列。n=0 时只有一个计数，结论仍成立。

以上同时证明了必要性和构造性充分性。无需枚举 34650 个 ESEP 数组，也无需枚举 256 个保留 EO 模式。每个描述符最多输出 5 个符号顶点。

## 8. 最终精确算法

输入只需实际 small snapshot 的 corner_class、48 frames/inverses、合法 rank 约定，以及真实空间作用的生成元。

1. 用整数成分构造 1182 个角张量 D 和 120 个 N。为各 D 构造 c_D，读取 b(D)，再令 a(D)=b(D⁻¹)。
2. 构造 330960 个 (D,N,k) 基础顶点；此步的数量已经解析证明。
3. 按第 6 节标记失配层并传播，构造 B₁ 顶点及 A 生成元在 B₁ 上的确定性映射。可用两个正旋转、一个反射、I；若不想依赖具体生成元编号，也可使用全部 48 空间作用及 I。
4. 扫描 153090 个 raw，建立按实际 O 分桶的描述符。对每个 O 和 120 个 B，按第 7 节流式输出星边。
5. 并查集作关系闭包。每次接受一个新的合并 u~v，同时将 h(u)~h(v) 对每个 A 生成元加入工作队列。已经连通的边可跳过。每个成功合并最多发生一次，因此成功合并少于顶点数。
6. 最终分量就是 E 的类。若还需要 mod A 的轨道商，再另行合并各分量与其 A 像；不能把这一步混入稳定闭包。

伪代码：

    make_symbolic_vertices_B1()
    make_generator_maps_on_B1()
    dsu = discrete_partition(B1)
    for edge in stream_q_stars():
        queue.push(edge)
        while queue is not empty:
            (u,v) = queue.pop()
            if dsu.same(u,v): continue
            dsu.union(u,v)
            for h in generators:
                queue.push((h[u],h[v]))
    return dsu

正确性：B₁⊂E；星边均由 q 碰撞与 B₁ 关系组成，因此整个构造 F⊂E。反过来，F 包含全部 q 碰撞，并对每个 A 生成元稳定，所以由 E 的最小性 E⊂F。故 F=E。接受的合并边生成整张等价图，其生成元像也都被处理；跳过已经连通的边不会漏掉稳定性，因为其连接路径的边像已在队列中或已经处理。

顶点数不超过 330960；生成元映射和并查集只依赖这个数。描述符原始总数为 153090。一个粗略的星生成上界为 120×5×153090=91854000 次顶点访问，实际可以先去重描述符并流式合并。这个上界只是算法规模说明，不是已测运行时间或提速结论。

## 9. 已证明与尚未执行/尚未知

已证明：

- 实际 q 的最小 A 稳定粗化是一个至多 330960 状态的已明确坐标的粗化。
- 330960 是 B₀ 的精确类数；B₀ 无需额外分裂奇偶位或 EO charge。
- 所有尚存 EO 信息至多是一个 0,…,4 的格内翻转数。
- B₀ 的最小 A 稳定化可由保护格协变/失配规则精确完成。
- q 纤维可用每角类×120 矩阵的计数星精确连接，不需要枚举可见 EO 或全部 ESEP 排列。
- 工作队列给出整个 G 上 E 的有限精确算法，避开约 10.86 万亿 P 状态枚举。

尚未执行，也不应虚称已知：

- 实际 snapshot 的 b(D)、标记层数、最终 E 类数及其 A 轨道数。
- 实际 q 是否最终消去所有 EO，哪些未标记层的 k 会在后续 q/A 连接中消失。
- 任何本地运行时间、内存峰值、正确性程序交叉校验或实际求解提速。

该坐标只保证 A 作用单值；它不自动保证 18 个右动作在坐标上单值。若用它定义独立下界，须明确采用完整诱导后继覆盖或取纤维最小距离；若要复用现有 q 解码值，还须验证该值在新合并类上恒定，或采取保持 admissibility 的下包络。对旧 q 纤维不封闭的反例与这里的有限粗化定理并不矛盾。

## 10. 可直接编码的 metadata 及参考闭包核心

以下是实现规格和未运行的参考 Rust，不是已通过编译或测试的模块。

### 10.1 编号和记录

| 对象 | 建议表示 | 约束 |
|---|---|---|
| 角张量 | `[u8; 12]`，索引 `(a*2+b)*3+t` | 行列总数 4，总 twist 0 |
| `CornerId` | `u16` | 0,…,1181；张量字典序编号 |
| 边矩阵 | `[u8; 9]`，索引 `a*3+b` | 行列总数 4 |
| `MatrixId` | `u8` | 0,…,119；矩阵字典序编号 |
| raw corner | `u32` | 0,…,153089；严格使用现有 rank/unrank 约定 |
| 角类 O | `u16` | 来自实际 `entry >> 6` |
| frame | `u8` | 来自实际 `entry & 63` |
| `VertexId` | `u32` | 少于 330960；实际 B₁ 可能更少 |

对每个 frame 保存：

    sigma[3]             // 物理输入边组 -> 此 frame 中的规范边组
    edge_xor[3][3]       // 输入格 (身份组,位置组) 的 EO xor 常量

从 `coord.rs` 的 source/inverse 约定读取它们。对输入格 (a,b)，任选规范第 sigma[b] 组内的位置 j 和物理第 a 组内的身份 i，则

    edge_xor[a][b] = (symmetry[8+j] ^ inverse[8+i]) & 1。

必须验证这个值在所有四个 j、四个 i 的选择上相同，并验证 sigma 是三个组的置换；这正是该 frame 正常化 K_E 的所需契约。角 tensor 的 frame 作用可对每个 c_D 调用既有 `conjugate` 后重新形成 tensor；无需另写镜像 CO 的号约定。

对每个角 D 保存：

    inverse_corner[D]
    chosen_frame[D]
    b[D] = inverse_sigma(chosen_frame[D])[1]
    a[D] = b[inverse_corner[D]]
    marked[D]

各 A 生成元保存角张量的像 `corner_image[h][D]`。对 M 生成元，边矩阵像由 sigma 同时置换行列；对 I，角张量转置并将 t 取负，边矩阵转置。

### 10.2 构造 B₁ 顶点和作用表

```text
for D in corner_ids:
    for N in matrix_ids:
        start[D][N] = vertices.length
        n = N[a[D], b[D]]
        width[D][N] = 1 if marked[D] else n + 1
        append width[D][N] vertices
```

未标记层的顶点 `start[D][N]+k` 表示其 k 值。已标记层只有 `start[D][N]`；不把它的 0 当成真实 EO 数。

```text
for generator h:
    for vertex (D,N,k_or_collapsed):
        D1 = corner_image[h][D]
        N1 = matrix_image[h][N]
        if marked[D]:
            require marked[D1]
            image[h][vertex] = start[D1][N1]
        else:
            require not marked[D1]
            require cell_image[h](P(D)) == P(D1)
            require N1[P(D1)] == N[P(D)]
            k1 = k if edge_xor[h][P(D)] == 0 else N[P(D)] - k
            image[h][vertex] = start[D1][N1] + k1
```

I 的 `edge_xor` 为零。每张 `image[h]` 都必须是完整顶点集合上的置换；仅有合法索引不够。

### 10.3 raw 描述符、去重和星生成

一个 q 描述符只需存

    { corner_id: D, sigma: [u8;3], protected_xor: u8 }

并按实际 O 分桶。`protected_xor` 是 frame 在 P(D) 格上的偏移；已标记层可将其固定为 0 以去重。其余 EO 偏移不影响第 7 节的星连接证明，所以同桶内可按上述字段精确去重。

对每个规范矩阵 B 和描述符 d：

```text
N[a,b] = B[d.sigma[a], d.sigma[b]]
J = (d.sigma[a[D]], d.sigma[b[D]])
n = B[J]

vertex_at_canonical_count(ell):
    if marked[D]: return start[D][N]
    k = ell if protected_xor == 0 else n - ell
    return start[D][N] + k
```

若第 7 节的唯一保留情形成立，对每个 `ell=0..n`，取第一个描述符的顶点为锚，连接其他描述符的 `vertex_at_canonical_count(ell)`。否则取任意锚，连接每个描述符的全部 `width[D][N]` 顶点。边可立即送入闭包核心，无需保存所有星。

### 10.4 通用有限 A 稳定关系闭包

以下函数只承担关系闭包。它不解析 snapshot，不证明传入的 maps 来自真实 A，不将顶点与其对称像自动合并；调用方必须依照上面的数学契约构造地图和初始星边。

```rust
use std::collections::VecDeque;

/// Returns dense equivalence-class IDs.
///
/// `images[g][v]` must describe a generator permutation on the same vertices.
/// `edges` may be a streaming iterator of the proven q-star edges.
/// This reference implementation has not been compiled or run here.
pub fn stable_closure(
    vertex_count: usize,
    images: &[Vec<usize>],
    edges: impl IntoIterator<Item = (usize, usize)>,
) -> Result<Vec<usize>, String> {
    for (generator, map) in images.iter().enumerate() {
        if map.len() != vertex_count {
            return Err(format!("generator {generator}: wrong domain size"));
        }
        let mut seen = vec![false; vertex_count];
        for &to in map {
            if to >= vertex_count || seen[to] {
                return Err(format!("generator {generator}: not a permutation"));
            }
            seen[to] = true;
        }
    }

    fn root(parent: &mut [usize], mut vertex: usize) -> usize {
        while parent[vertex] != vertex {
            let above = parent[vertex];
            let twice_above = parent[above];
            parent[vertex] = twice_above;
            vertex = twice_above;
        }
        vertex
    }

    let mut parent: Vec<usize> = (0..vertex_count).collect();
    let mut size = vec![1usize; vertex_count];
    let mut pending = VecDeque::<(usize, usize)>::new();

    for (u, v) in edges {
        if u >= vertex_count || v >= vertex_count {
            return Err("initial edge outside vertex domain".into());
        }
        pending.push_back((u, v));

        while let Some((a, b)) = pending.pop_front() {
            let mut ra = root(&mut parent, a);
            let mut rb = root(&mut parent, b);
            if ra == rb {
                continue;
            }
            if size[ra] < size[rb] {
                std::mem::swap(&mut ra, &mut rb);
            }
            parent[rb] = ra;
            size[ra] += size[rb];

            // Images of the accepted original endpoints, not a direct
            // identification of a vertex with its own symmetry image.
            for map in images {
                pending.push_back((map[a], map[b]));
            }
        }
    }

    let mut id_by_root = vec![usize::MAX; vertex_count];
    let mut result = Vec::with_capacity(vertex_count);
    let mut next_id = 0usize;
    for vertex in 0..vertex_count {
        let representative = root(&mut parent, vertex);
        if id_by_root[representative] == usize::MAX {
            id_by_root[representative] = next_id;
            next_id += 1;
        }
        result.push(id_by_root[representative]);
    }
    Ok(result)
}
```

终止性来自成功合并最多 `vertex_count−1` 次；每次只添加固定数量的生成元像。正确性来自第 8 节的双向包含证明。输入 permutation 检查是结构完整性检查，不能替代 frame 几何、q 描述符或星边正确性的证明。

## 11. 进一步的结构定理：残余 EO 只有计数与补数配对

第 7 节还有一个可解析的推论。它不需要运行闭包，但能精确限定最终残余 EO 的形式。

先只取几何顶点 v=(D,N)，共 1182×120=141840 个。这个数是下面的解码图顶点数，**不是 E 类数的上界**；同一个几何顶点仍可能有多个 k 类。

把第 7 节的连接分成两种：

1. 全计数星：标记所有涉及的几何顶点为 `collapsed`，并用普通无向星把这些几何顶点连接。
2. 保留计数星：每条边 u—v 的两端有相同 n，并记录一位 s∈F₂，表示 k_v=k_u（s=0）或 k_v=n−k_u（s=1）。s 就是两描述符的 `protected_xor` 之和。

B₁ 已标记的角层，也给其每个几何顶点一个 `collapsed` 标记。然后加入上述标记和边的全部 A 像。对于未标记角层，令 e_h(v) 表示 h 在其保护格上是否补 EO；带符号边的像为

    (u,v,s) ↦ (h(u),h(v), s ⊕ e_h(u) ⊕ e_h(v))。

普通全计数边及 `collapsed` 标记直接搬运到其几何像。取全部 A 像是一个有限定义；实现可以用工作队列避免一次性存下全部像。

### 定理 11.1

对这张几何图的每个连通分量 Q：

- 若 Q 接触任意 `collapsed` 顶点，则其所有计数合成一个 E 类。
- 否则，分量内 n 恒定；如果每个闭合回路的符号和均为 0，则该分量贡献 n+1 个 E 类。
- 否则，某个回路符号和为 1，且唯一新增关系就是 k∼n−k；该分量贡献 floor(n/2)+1 个 E 类。

证明：没有 `collapsed` 的分量只有带符号的完美匹配边，每条边都保持同一个 n。沿路径搬运 k，只可能得到 k 或 n−k。所有闭路都偶时，选一个根及树路径后，每个顶点的相对补数位确定，n+1 个根计数互不连接。若有奇闭路，走该闭路恰好把 k 变成 n−k；所有路径的效果仍只有这两种，不可能再产生别的计数等同。若出现一个全计数顶点，则完整匹配把“所有计数已相等”沿整个连通分量传播。

因此可直接给出一个精确的最终坐标：

- `collapsed` 分量：只存分量 ID；
- 无奇回路分量：存分量 ID，以及按树路径补数位搬运到根的 k；
- 有奇回路分量：存分量 ID，以及 min(k,n−k)。

这是对实际输入表的有限图形式分类。数值上的分量、哪些层被消去、最终类数仍须由本地程序读取 snapshot 后计算。本轮没有把这些待算值冒充已知。

若实现进一步的带奇偶并查集，要注意：同一个几何根之间的新边仍可能构成奇符号回路，不能像普通无标记并查集那样一律跳过；新的奇回路约束及其 A 像都须传播。第 10 节直接对最多 330960 个完整 (D,N,k) 顶点作闭包的参考代码没有这个陷阱，因此可先作为更容易审查的基准实现。
