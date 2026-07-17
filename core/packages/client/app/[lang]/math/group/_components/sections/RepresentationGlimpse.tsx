'use client';

import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

function CharacterTableHint() {
  const lang = useLang();
  // The abelianization G/[G,G] ≅ Z/2 — so G has only TWO 1-dim'l reps (the
  // trivial rep and the sign rep). All other irreducibles are higher-dim.
  return (
    <div className="gt-chartable">
      <table className="gt-chartable-tbl">
        <thead>
          <tr>
            <th>χ</th>
            <th>1</th>
            <th>R</th>
            <th>R²</th>
            <th>{tr({ zh: '其它共轭类...', en: 'other conj. classes...'
            })}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>χ_triv</th>
            <td className="num">1</td>
            <td className="num">1</td>
            <td className="num">1</td>
            <td className="num">1 ...</td>
          </tr>
          <tr>
            <th>χ_sgn</th>
            <td className="num">1</td>
            <td className="num">−1</td>
            <td className="num">1</td>
            <td className="num">±1 ...</td>
          </tr>
          <tr>
            <th>χ_3, χ_4, ...</th>
            <td className="num">d</td>
            <td className="num">tr(ρ(R))</td>
            <td className="num">tr(ρ(R²))</td>
            <td className="num">...</td>
          </tr>
        </tbody>
      </table>
      <div className="gt-aside" style={{ marginTop: 10 }}>
        {lang === 'zh'
          ? <>G 的 <strong>1 维表示</strong> 只有两个:平凡表示 (永远等于 1) 和 sgn 表示 (奇置换 → −1)。这跟 G^ab = ℤ/2 一致。<strong>其它所有不可约表示都是高维的 (≥ 2)</strong>,反映了 G 的强烈非阿贝尔性。</>
          : <>G has exactly <strong>two 1-dimensional irreducible representations</strong>: the trivial rep and the sign rep (mapping odd permutations to −1). This matches G^ab = ℤ/2. <strong>All other irreducibles are higher-dimensional (≥ 2)</strong>, reflecting how strongly non-Abelian G is.</>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §27 Lights Out — GF(2) linear algebra
// §28 Peg Solitaire — 3-coloring invariant + SAX
// §29 Hamiltonian Paths/Cycles — Gray codes, Cayley conjecture
// §30 Two-Face Corner Group — PGL(2, F_5) ≅ S_5 on 6 points
// §31 Rotational Puzzles on Graphs — (x, y, z) classifier
// ═══════════════════════════════════════════════════════════════════════════

// ── GF(2) linear algebra primitives ─────────────────────────────────────────

export default function RepresentationGlimpse() {
  return (
      <GTSec id="representations" className="gt-sec">
        <div className="gt-sec-num">§26</div>
        <h2 className="gt-sec-title">
          <L zh="表示论一瞥" en="A glimpse of representation theory" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>把一个有限群 G 「线性化」 —— 找一个忠实的群同态 <TeX src={`\\rho : G \\to GL_n(\\mathbb{C})`} /> —— 是表示论的入门。 把群论问题翻译成 <strong>线性代数问题</strong> 是 19 世纪以来代数学的核心发明之一 (Frobenius, Schur)。</>}
            en={<>To "linearize" a finite group G — find a faithful homomorphism <TeX src={`\\rho : G \\to GL_n(\\mathbb{C})`} /> — is the entrance to representation theory. Translating group questions into <strong>linear algebra</strong> is one of the great inventions of late-19th-century mathematics (Frobenius, Schur).</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 26.1 — 表示', en: 'Definition 26.1 — representation'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>群 G 的一个 <strong>表示</strong> 是同态 <TeX src={`\\rho : G \\to GL_n(\\mathbb{C})`} />, 把 g 映为可逆 n × n 复矩阵。 n 称为 <strong>维数</strong>。 表示叫 <strong>不可约</strong> 如果只有平凡子空间在所有 ρ(g) 下不变。 有限群的每个表示都是不可约表示的 <em>直和</em> (Maschke 定理)。</>}
              en={<>A <strong>representation</strong> of G is a homomorphism <TeX src={`\\rho : G \\to GL_n(\\mathbb{C})`} /> sending g to an invertible complex matrix. n is the <strong>dimension</strong>. ρ is <strong>irreducible</strong> if no non-trivial subspace is invariant under all ρ(g). Every representation of a finite group is a <em>direct sum</em> of irreducibles (Maschke's theorem).</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="26.1  特征" en="26.1  Characters" />
        </h3>
        <p>
          <L
            zh={<>特征 <TeX src={`\\chi_\\rho(g) = \\operatorname{tr}\\rho(g)`} /> 是 G 上的类函数 (只依赖共轭类)。 不可约特征构成 G 上 <em>正交基</em>:<TeXBlock src={`\\langle \\chi_\\rho, \\chi_{\\rho'} \\rangle = \\tfrac{1}{|G|} \\sum_{g \\in G} \\chi_\\rho(g) \\overline{\\chi_{\\rho'}(g)} = \\delta_{\\rho \\rho'}.`} />这是 G 上的「Fourier 分析」, 完全类比于 <TeX src={`\\mathbb{R}/\\mathbb{Z}`} /> 上的 Fourier 级数。</>}
            en={<>The character <TeX src={`\\chi_\\rho(g) = \\operatorname{tr}\\rho(g)`} /> is a class function on G (depends only on conjugacy class). Irreducible characters form an <em>orthonormal basis</em>:<TeXBlock src={`\\langle \\chi_\\rho, \\chi_{\\rho'} \\rangle = \\tfrac{1}{|G|} \\sum_{g \\in G} \\chi_\\rho(g) \\overline{\\chi_{\\rho'}(g)} = \\delta_{\\rho \\rho'}.`} />This is "Fourier analysis on G", perfectly analogous to Fourier series on <TeX src={`\\mathbb{R}/\\mathbb{Z}`} />.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="26.2  魔方群的 1 维表示" en="26.2  1-dimensional representations of G" />
        </h3>
        <CharacterTableHint />
        <p style={{ marginTop: 16 }}>
          <L
            zh={<>1 维不可约表示 <TeX src={`\\rho : G \\to \\mathbb{C}^*`} /> 必然穿过 <TeX src={`G^{\\mathrm{ab}}`} />, 因为 <TeX src={`\\mathbb{C}^*`} /> 阿贝尔。 故 <strong>1 维不可约表示数 = |G^ab|</strong>。 对魔方 G^ab = ℤ/2, 所以恰好两个 1 维表示。</>}
            en={<>Any 1-dim irreducible <TeX src={`\\rho : G \\to \\mathbb{C}^*`} /> factors through <TeX src={`G^{\\mathrm{ab}}`} /> since <TeX src={`\\mathbb{C}^*`} /> is Abelian. So the <strong>number of 1-dim irreducibles = |G^ab|</strong>. For the cube, G^ab = ℤ/2, giving exactly two.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="26.3  Maschke + Schur — 表示论的两个支柱" en="26.3  Maschke + Schur — the two pillars" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: 'Maschke 定理 (1899)', en: "Maschke's theorem (1899)" })}</div>
          <div className="gt-def-body">
            <L
              zh={<>有限群 G 的任意 (有限维) 复表示都 <strong>完全可约</strong>:它是不可约表示的直和。 关键: 对任何 G-不变子空间 W ⊆ V, 存在 G-不变补 W'。 用平均化技巧 (averaging) 构造投影 <TeX src={`P = \\tfrac{1}{|G|} \\sum_{g \\in G} \\rho(g) P_0 \\rho(g)^{-1}`} />。</>}
              en={<>Every (finite-dim) complex representation of a finite group G is <strong>completely reducible</strong>: it decomposes as a direct sum of irreducibles. Key step: given a G-invariant subspace W ⊆ V, construct an invariant complement via the averaging projector <TeX src={`P = \\tfrac{1}{|G|} \\sum_{g \\in G} \\rho(g) P_0 \\rho(g)^{-1}`} />.</>}
            />
          </div>
        </div>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: 'Schur 引理 (1905)', en: "Schur's lemma (1905)" })}</div>
          <div className="gt-def-body">
            <L
              zh={<>设 <TeX src={`\\rho_1, \\rho_2`} /> 是 G 的两个不可约表示, <TeX src={`T : V_1 \\to V_2`} /> 是 G-等变线性映射 (<TeX src={`T \\rho_1(g) = \\rho_2(g) T`} />)。 那么:<br />(a) 若 <TeX src={`\\rho_1 \\not\\cong \\rho_2`} />, 必 <TeX src={`T = 0`} />;<br />(b) 若 <TeX src={`\\rho_1 = \\rho_2`} />, 必 <TeX src={`T = \\lambda I`} /> (复数倍单位)。</>}
              en={<>Let <TeX src={`\\rho_1, \\rho_2`} /> be irreducible representations of G and <TeX src={`T : V_1 \\to V_2`} /> a G-equivariant linear map (<TeX src={`T \\rho_1(g) = \\rho_2(g) T`} />). Then:<br />(a) if <TeX src={`\\rho_1 \\not\\cong \\rho_2`} />, then <TeX src={`T = 0`} />;<br />(b) if <TeX src={`\\rho_1 = \\rho_2`} />, then <TeX src={`T = \\lambda I`} /> (a scalar).</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这两条 「<em>朴素得不像定理</em>」 的结论, 推出表示论几乎所有的核心结果:</>}
            en={<>These two deceptively simple statements imply nearly every key result in finite-group representation theory:</>}
          />
        </p>
        <TeXBlock src={`\\sum_{\\rho \\in \\widehat{G}} d_\\rho^{\\,2} \\;=\\; |G|,\\qquad |\\widehat{G}| = \\#\\{\\text{conj.\\ classes}\\}`} />
        <p>
          <L
            zh={<>左边:每个不可约维数平方和 = |G|。 右边:不可约表示个数 = 共轭类个数。 对魔方:</>}
            en={<>Left: sum of squares of irreducible dimensions equals |G|. Right: the number of irreducibles equals the number of conjugacy classes. For the cube:</>}
          />
        </p>
        <TeXBlock src={`\\sum_{\\rho} d_\\rho^{\\,2} \\;=\\; 43{,}252{,}003{,}274{,}489{,}856{,}000 \\quad\\text{with}\\quad |\\widehat{G}| \\approx 81{,}120`} />
        <p>
          <L
            zh={<>这给了 81,120 个非负整数 <TeX src={`d_1^2, d_2^2, \\ldots`} /> 求和 = 4.3 × 10¹⁹ 的非平凡约束。 G^ab = ℤ/2 锁定其中 2 个 d_i = 1; 剩 81,118 个全部 ≥ 2, 平均维度 <TeX src={`\\sqrt{|G|/|\\widehat{G}|} \\approx 23{,}000`} />。</>}
            en={<>This puts a non-trivial constraint on 81,120 non-negative integers <TeX src={`d_1^2, d_2^2, \\ldots`} /> summing to 4.3 × 10¹⁹. The abelianization G^ab = ℤ/2 forces two of them to be 1; the remaining 81,118 are all ≥ 2, with average dimension <TeX src={`\\sqrt{|G|/|\\widehat{G}|} \\approx 23{,}000`} />.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="26.4  正交关系 (orthogonality)" en="26.4  Orthogonality relations" />
        </h3>
        <p>
          <L
            zh={<>不可约特征构成 G 上类函数空间的正交基。 两条核心等式 (相互对偶):</>}
            en={<>Irreducible characters form an orthonormal basis of the space of class functions on G. The two dual orthogonality relations:</>}
          />
        </p>
        <TeXBlock src={`\\sum_{g \\in G} \\chi_\\rho(g) \\overline{\\chi_{\\rho'}(g)} \\;=\\; |G| \\cdot \\delta_{\\rho \\rho'} \\qquad (\\text{first orthogonality})`} />
        <TeXBlock src={`\\sum_{\\rho \\in \\widehat{G}} \\chi_\\rho(g) \\overline{\\chi_\\rho(h)} \\;=\\; \\begin{cases} |C_G(g)| & g \\sim h \\\\ 0 & g \\not\\sim h \\end{cases} \\qquad (\\text{second orthogonality})`} />
        <p>
          <L
            zh={<>第一条:不可约特征互相正交。 第二条:特征表的 「<em>列正交</em>」, 给出 <TeX src={`|C_G(g)| = |G| / |\\mathrm{class}(g)|`} /> (中心化子大小 × 共轭类大小 = |G|, §8.1 已用过)。 这两条把 「特征表」 变成 G 的一个不变量, 完全等价于 G 的代数结构 (对 abelian 群完全等价于 G 本身; 对非阿贝尔群是 「几乎完全」)。</>}
            en={<>The first says irreducible characters are orthonormal. The second is "<em>column orthogonality</em>", giving <TeX src={`|C_G(g)| = |G| / |\\mathrm{class}(g)|`} /> (centralizer × class = |G|, §8.1). Together, the character table is a strong group invariant, equivalent to G for Abelian groups and almost equivalent in the non-Abelian case.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="26.5  Fourier 分析与随机游走" en="26.5  Fourier analysis & random walks" />
        </h3>
        <p>
          <L
            zh={<>§24 的随机游走上界来自表示论。 给定 G 上一个概率测度 μ (一步的转移分布), 它的 <em>群 Fourier 变换</em> 是</>}
            en={<>The §24 random-walk bound comes from representation theory. Given a probability measure μ on G (the one-step distribution), its <em>group Fourier transform</em> is</>}
          />
        </p>
        <TeXBlock src={`\\hat\\mu(\\rho) \\;=\\; \\sum_{g \\in G} \\mu(g) \\, \\rho(g) \\;\\in\\; M_{d_\\rho}(\\mathbb{C}).`} />
        <p>
          <L
            zh={<>「t 步的转移分布」 = μ 的 t 次卷积, 而卷积在 Fourier 下变乘积: <TeX src={`\\widehat{\\mu^t}(\\rho) = \\hat\\mu(\\rho)^t`} />。 套用 Parseval 等式:</>}
            en={<>"t-step distribution" = t-fold convolution of μ, and convolution becomes multiplication under Fourier: <TeX src={`\\widehat{\\mu^t}(\\rho) = \\hat\\mu(\\rho)^t`} />. Applying Parseval:</>}
          />
        </p>
        <TeXBlock src={`d_{TV}^2(\\mu^t, \\mathrm{Unif}) \\;\\leq\\; \\tfrac{1}{4} \\sum_{\\rho \\neq \\mathrm{triv}} d_\\rho^2 \\, \\bigl\\| \\hat\\mu(\\rho)^{\\,t} \\bigr\\|_{\\mathrm{op}}^{\\,2}.`} />
        <p>
          <L
            zh={<>每个 <TeX src={`\\hat\\mu(\\rho)`} /> 的算子范数 ≤ 1, 等于 1 仅在 ρ = triv。 所以非平凡 ρ 上是严格收缩, 而衰减率 = max 第二特征值。 这就是 Diaconis 1980s 革命的洗牌分析框架的群论核心: <strong>混合速率由非平凡不可约表示的最坏算子范数决定</strong>。</>}
            en={<>Each <TeX src={`\\hat\\mu(\\rho)`} /> has operator norm ≤ 1, with equality only at ρ = trivial. So on non-trivial ρ this is a strict contraction whose rate equals the largest second eigenvalue. This is the group-theoretic heart of Diaconis's 1980s shuffle revolution: <strong>mixing rate = worst operator norm over non-trivial irreducibles</strong>.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="26.6  魔方群的特征表 — 一个开放对象" en="26.6  G's character table — an open object" />
        </h3>
        <p>
          <L
            zh={<>魔方群 G 的 <strong>完整</strong> 不可约表示分类 (即所有不可约 ρ 的列表 + 特征值) 至今没有完整算出。 已知:</>}
            en={<>The <strong>complete</strong> classification of G's irreducibles (full list of ρ's plus character values) has never been written out. Known facts:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<>不可约表示数 = 共轭类数 <TeX src={`\\approx 81{,}120`} /> (Frobenius 等式)</>} en={<>Number of irreducibles = number of conjugacy classes <TeX src={`\\approx 81{,}120`} /> (Frobenius identity)</>} /></li>
          <li><L zh={<>1 维不可约表示恰好 2 个 (平凡 + sgn), 因为 <TeX src={`G^{\\mathrm{ab}} = \\mathbb{Z}/2`} /></>} en={<>Exactly 2 one-dim irreducibles (trivial + sign), since <TeX src={`G^{\\mathrm{ab}} = \\mathbb{Z}/2`} /></>} /></li>
          <li><L zh={<>最大不可约表示维度未知 (估计 ~ <TeX src={`10^5`} />), 来自 <TeX src={`A_8 \\times A_{12}`} /> 的非平凡 induced 表示</>} en={<>Largest irreducible dimension is unknown (estimated <TeX src={`\\sim 10^5`} />), arising from non-trivial induced representations of <TeX src={`A_8 \\times A_{12}`} /></>} /></li>
          <li><L zh="计算代数系统 (GAP, Magma, SageMath) 在算 G 完整特征表时全部超时 (内存 + CPU)" en="All major CAS (GAP, Magma, SageMath) time out / run out of memory on the full character table" /></li>
        </ul>
        <div className="gt-pullquote">
          <L
            zh={<>「魔方群的特征表是一个完美的 <em>计算挑战</em>: 群结构已知, 算法已知 (Burnside, Brauer, Dixon-Schneider), 但具体执行超过现代计算资源。」</>}
            en={<>"G's character table is a perfect <em>computational challenge</em>: the group structure is known, the algorithms are known (Burnside, Brauer, Dixon-Schneider), but the computation exceeds present-day resources."</>}
          />
          <div className="gt-pullquote-cite">— Joyner, on computational limits</div>
        </div>
      </GTSec>
  );
}
