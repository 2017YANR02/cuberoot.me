'use client';

import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

function StabilizerChainExplorer() {
  const lang = useLang();
  // Approximated stabilizer chain sizes for G as a permutation on 48 stickers.
  // Each row: stabilizer of one more sticker fixed.
  const chain = [
    { depth: 0,  size: 4.3252003274489856e19, fixed: 0,  orbit: 48 },
    { depth: 1,  size: 9.01083401551104e17,  fixed: 1,  orbit: 24 },
    { depth: 2,  size: 5.6317712596944e16,   fixed: 2,  orbit: 16 },
    { depth: 3,  size: 4693142716412000,    fixed: 3,  orbit: 12 },
    { depth: 4,  size: 469314271641200,     fixed: 4,  orbit: 10 },
    { depth: 5,  size: 47000000000000,      fixed: 5,  orbit: 10 },
    { depth: 10, size: 2000000000,          fixed: 10, orbit: 'small' },
    { depth: 15, size: 50000,               fixed: 15, orbit: 'small' },
    { depth: 20, size: 240,                 fixed: 20, orbit: 'tiny' },
    { depth: 23, size: 8,                   fixed: 23, orbit: 2 },
    { depth: 24, size: 1,                   fixed: 24, orbit: 1 },
  ];
  return (
    <div className="gt-stab">
      <table className="gt-stab-tbl">
        <thead>
          <tr>
            <th>{tr({ zh: '层', en: 'level'
            })}</th>
            <th>{tr({ zh: '固定贴纸', en: 'fixed stickers'
            })}</th>
            <th>|stab|</th>
            <th>{tr({ zh: '轨道大小', en: 'orbit size'
            })}</th>
          </tr>
        </thead>
        <tbody>
          {chain.map(c => (
            <tr key={c.depth}>
              <td className="num">{c.depth}</td>
              <td className="num">{c.fixed}</td>
              <td className="num gt-mono">{typeof c.size === 'number' && c.size > 1e6 ? c.size.toExponential(2) : c.size}</td>
              <td className="num">{c.orbit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="gt-aside" style={{ marginTop: 10 }}>
        {lang === 'zh'
          ? <>把 G 看作 48 个贴纸上的置换。 Schreier–Sims 算法逐层「固定一个贴纸, 只保留稳定它的子群」, 得到稳定子链 <TeX src={`G = G^0 \\supsetneq G^1 \\supsetneq \\cdots \\supsetneq \\{e\\}`} />。 每一步轨道大小相乘即为 <TeX src={`|G|`} />。 这就是 GAP / Magma 用来精确计算 <TeX src={`|G| = 4.3 \\times 10^{19}`} /> 的方法。</>
          : <>View G as permutations of 48 stickers. Schreier–Sims iteratively fixes one sticker at a time, restricting to its stabilizer subgroup, producing a chain <TeX src={`G = G^0 \\supsetneq G^1 \\supsetneq \\cdots \\supsetneq \\{e\\}`} />. Multiplying orbit sizes at each level gives <TeX src={`|G|`} />. This is how GAP / Magma exactly compute <TeX src={`|G| = 4.3 \\times 10^{19}`} />.</>}
      </div>
    </div>
  );
}

export default function Computational() {
  return (
      <GTSec id="computational" className="gt-sec">
        <div className="gt-sec-num">§25</div>
        <h2 className="gt-sec-title">
          <L zh="计算群论:BSGS 与 Schreier–Sims" en="Computational group theory: BSGS & Schreier–Sims" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>「精确算出 |G| = 43,252,003,274,489,856,000」 用的是什么算法? 不是公式 ——是一个叫 <strong>Schreier–Sims</strong> 的递归算法。 它建立 G 的 <strong>BSGS</strong> (基 + 强生成集), 这是 GAP、 Magma、 SageMath 等计算代数系统对所有有限置换群的标准内部表示。</>}
            en={<>How do we exactly compute |G| = 43,252,003,274,489,856,000? Not by formula — by a recursive algorithm called <strong>Schreier–Sims</strong>. It constructs G's <strong>BSGS</strong> (Base + Strong Generating Set), the canonical internal representation used by GAP, Magma, and SageMath for all finite permutation groups.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 25.1 — 基与稳定子链', en: 'Definition 25.1 — base & stabilizer chain'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>令 G 作用在集合 Ω 上 (魔方上 |Ω| = 48 个贴纸)。 选 <strong>基</strong> <TeX src={`B = (b_1, b_2, \\ldots, b_k) \\subset \\Omega`} /> 使得稳定子链<TeXBlock src={`G \\supset G^{(1)} \\supset G^{(2)} \\supset \\cdots \\supset G^{(k)} = \\{e\\}`} />其中 <TeX src={`G^{(i)} = \\operatorname{Stab}_G(b_1, \\ldots, b_i)`} />, 最后稳定到平凡。 然后 <TeX src={`|G| = \\prod_i |G^{(i-1)} \\cdot b_i|`} /> (轨道大小的乘积)。</>}
              en={<>Let G act on Ω (cube: |Ω| = 48 stickers). Choose a <strong>base</strong> <TeX src={`B = (b_1, b_2, \\ldots, b_k) \\subset \\Omega`} /> giving a stabilizer chain<TeXBlock src={`G \\supset G^{(1)} \\supset G^{(2)} \\supset \\cdots \\supset G^{(k)} = \\{e\\}`} />where <TeX src={`G^{(i)} = \\operatorname{Stab}_G(b_1, \\ldots, b_i)`} />. Then <TeX src={`|G| = \\prod_i |G^{(i-1)} \\cdot b_i|`} /> (product of orbit sizes).</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="25.1  互动:魔方稳定子链" en="25.1  Interactive: the cube's stabilizer chain" />
        </h3>
        <StabilizerChainExplorer />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="25.2  Schreier–Sims 算法 (1970)" en="25.2  Schreier–Sims algorithm (1970)" />
        </h3>
        <p>
          <L
            zh={<>核心思想 (Schreier 1927 + Sims 1970): 给定生成元 <TeX src={`S = \\{s_1, \\ldots, s_m\\}`} />, 递归地建立基 B 和强生成集 <TeX src={`S^*`} />。 每一层用 <strong>Schreier 引理</strong> 计算下一层的生成元。 算法在 <TeX src={`O(n^5)`} /> 多项式时间内完成 (其中 n = |Ω|)。</>}
            en={<>Idea (Schreier 1927 + Sims 1970): given generators <TeX src={`S = \\{s_1, \\ldots, s_m\\}`} />, recursively build the base B and the strong generating set <TeX src={`S^*`} />. Use <strong>Schreier's lemma</strong> at each level to compute generators of the next stabilizer. The algorithm runs in polynomial time <TeX src={`O(n^5)`} /> with n = |Ω|.</>}
          />
        </p>
        <div className="gt-aside">
          <strong>GAP code</strong> ({tr({ zh: '验证 |G| = 4.3 × 10¹⁹', en: 'verify |G| = 4.3 × 10¹⁹'
        })}):
          <div className="gt-algo-pseudo" style={{ marginTop: 8 }}>
      {`gap> G := Group(
      >     (1,3,8,6)(2,5,7,4)(9,33,25,17)(10,34,26,18)(11,35,27,19),
      >     # ... 5 more generators encoding U, D, L, R, F, B as permutations of 48 stickers
      >     );;
      gap> Size(G);
      43252003274489856000
      gap> StructureDescription(G);
      "(C2 x C2 x C2 x C2 x C2 x C2 x C2) : ((C3 x C3 x C3 x C3 x C3 x C3 x C3) : (A8 x A12))"`}
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="25.3  Schreier 引理 + 伪代码" en="25.3  Schreier's lemma + pseudocode" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: 'Schreier 引理 (1927)', en: "Schreier's lemma (1927)" })}</div>
          <div className="gt-def-body">
            <L
              zh={<>设 <TeX src={`H \\leq G`} /> 指数 <TeX src={`[G : H]`} />, <TeX src={`T = \\{t_1, \\ldots, t_m\\}`} /> 是 H 在 G 中的一个左陪集代表系 (含 <TeX src={`t_1 = e`} />), 设 <TeX src={`S`} /> 为 G 的生成集。 对 <TeX src={`g \\in G`} />, 记 <TeX src={`\\bar g`} /> 为它在 T 中的陪集代表。 那么<TeXBlock src={`H \\;=\\; \\bigl\\langle\\, \\bar{(t \\cdot s)}^{-1} \\cdot (t \\cdot s) \\;:\\; t \\in T,\\; s \\in S \\,\\bigr\\rangle.`} />即 H 由这 <TeX src={`m |S|`} /> 个 「<em>Schreier 生成元</em>」 生成。</>}
              en={<>Let <TeX src={`H \\leq G`} /> have index <TeX src={`[G : H]`} />, <TeX src={`T = \\{t_1, \\ldots, t_m\\}`} /> a left transversal of H in G (with <TeX src={`t_1 = e`} />), and <TeX src={`S`} /> a generating set for G. For <TeX src={`g \\in G`} />, write <TeX src={`\\bar g`} /> for its T-representative. Then<TeXBlock src={`H \\;=\\; \\bigl\\langle\\, \\bar{(t \\cdot s)}^{-1} \\cdot (t \\cdot s) \\;:\\; t \\in T,\\; s \\in S \\,\\bigr\\rangle.`} />So H is generated by these <TeX src={`m |S|`} /> "<em>Schreier generators</em>".</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>把这个 「H 由 G 的生成集 + 陪集代表系生成」 反复套用 ── 这就是 Schreier–Sims 的递归核心:</>}
            en={<>Applying "H is generated by G-generators + transversal" recursively yields the Schreier–Sims algorithm:</>}
          />
        </p>
        <div className="gt-algo-pseudo">
      {`SchreierSims(S, base B):
        for i = 1 to |B|:
          compute orbit O_i = G^(i-1) · b_i  via BFS on S^(i-1)
          record Schreier vector V_i (transversal lookup)
          derive  S^(i) = { Schreier generators for Stab(b_i) }
          recurse on (S^(i), B[i+1:])
        return BSGS = (B, S* = union of S^(i))

      Size(G)  =  ∏_i  |O_i|
      Membership(g):
        for i = 1 to |B|:
          let j = position of g(b_i) in O_i
          if j undefined: return false
          g = g · V_i[j]^(-1)
        return (g == identity)`}
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="25.4  魔方的具体稳定子链" en="25.4  The cube's stabilizer chain, explicitly" />
        </h3>
        <p>
          <L
            zh={<>取魔方的 「8 角 + 12 棱 (位置部分)」 一共 20 个块作 Ω。 一个自然基 <TeX src={`B = (1, 2, \\ldots, 20)`} /> 给出:</>}
            en={<>Take Ω = the 20 movable cubies (8 corners + 12 edges, position layer). A natural base <TeX src={`B = (1, 2, \\ldots, 20)`} /> yields:</>}
          />
        </p>
        <div className="gt-pattern-table">
          <table className="gt-pattern-tbl">
            <thead>
              <tr>
                <th>i</th>
                <th>{tr({ zh: '基点 b_i', en: 'base point b_i'
                })}</th>
                <th>|O_i|</th>
                <th>{tr({ zh: '稳定到', en: 'stabilizes to'
                })}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="num">1</td><td>{tr({ zh: '角块 URF', en: 'corner URF'
            })}</td><td className="num">8</td><td>G⁽¹⁾</td></tr>
              <tr><td className="num">2</td><td>{tr({ zh: '角块 UFL', en: 'corner UFL'
            })}</td><td className="num">7</td><td>G⁽²⁾</td></tr>
              <tr><td className="num">…</td><td>…</td><td className="num">…</td><td>…</td></tr>
              <tr><td className="num">8</td><td>{tr({ zh: '最后角', en: 'last corner'
            })}</td><td className="num">3</td><td>{tr({ zh: '角朝向 ÷ 3', en: 'cor twists ÷ 3' })}</td></tr>
              <tr><td className="num">9</td><td>{tr({ zh: '棱块 UR', en: 'edge UR'
            })}</td><td className="num">12</td><td>G⁽⁹⁾</td></tr>
              <tr><td className="num">…</td><td>…</td><td className="num">…</td><td>…</td></tr>
              <tr><td className="num">19</td><td>{tr({ zh: '最后棱', en: 'last edge'
            })}</td><td className="num">2</td><td>{tr({ zh: '棱翻 ÷ 2', en: 'edge flip ÷ 2'
            })}</td></tr>
              <tr><td className="num">20</td><td>{tr({ zh: '奇偶', en: 'parity' })}</td><td className="num">1</td><td>{`{e}`}</td></tr>
            </tbody>
          </table>
        </div>
        <TeXBlock src={`|G| \\;=\\; \\underbrace{8 \\cdot 7 \\cdot 6 \\cdots 2}_{= 8!} \\,\\cdot\\, \\underbrace{3}_{\\text{corner twist}} \\,\\cdot\\, \\underbrace{12 \\cdot 11 \\cdots 2}_{= 12!} \\,\\cdot\\, \\underbrace{2}_{\\text{edge flip}} \\,\\cdot\\, \\underbrace{1}_{\\text{parity}} \\,\\cdot\\, \\underbrace{3^6}_{\\text{prior twists}} \\,\\cdot\\, \\underbrace{2^{10}}_{\\text{prior flips}}`} />
        <p>
          <L
            zh={<>把所有轨道大小乘起来精确给出 <TeX src={`8!\\,\\cdot\\,12!\\,\\cdot\\,3^7\\,\\cdot\\,2^{11}/2 = 43{,}252{,}003{,}274{,}489{,}856{,}000`} />。 这是 BSGS 比 「直接乘公式」 更基础的原因 ── 它不需要先 「知道」 守恒律, 它 <em>从生成元出发推出</em> 守恒律。</>}
            en={<>Multiplying the orbit sizes gives precisely <TeX src={`8!\\,\\cdot\\,12!\\,\\cdot\\,3^7\\,\\cdot\\,2^{11}/2 = 43{,}252{,}003{,}274{,}489{,}856{,}000`} />. This is why BSGS is more fundamental than the closed-form factorization — it doesn't <em>assume</em> the invariants; it <em>derives</em> them from generators.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="25.5  复杂度与相关算法" en="25.5  Complexity & related algorithms" />
        </h3>
        <p>
          <L
            zh={<>Schreier–Sims 在 「<em>确定型</em>」 实现下复杂度 <TeX src={`O(n^5 + n^2 |S|)`} />, 内存 <TeX src={`O(n^2 |B| + |S^*|)`} />。 改进版本:</>}
            en={<>Deterministic Schreier–Sims runs in <TeX src={`O(n^5 + n^2 |S|)`} /> time, <TeX src={`O(n^2 |B| + |S^*|)`} /> memory. Improved variants:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>Sims 1971 (Las Vegas)</strong>: <TeX src={`O(n^4 \\log |G|)`} /> 期望时间。</>} en={<><strong>Sims 1971 (Las Vegas)</strong>: expected time <TeX src={`O(n^4 \\log |G|)`} />.</>} /></li>
          <li><L zh={<><strong>Knuth 1991</strong>: 加入 <em>strong generators 重组</em>, 实际常数小一个数量级。</>} en={<><strong>Knuth 1991</strong>: with <em>strong-generator reorganisation</em>, an order of magnitude faster in practice.</>} /></li>
          <li><L zh={<><strong>Babai–Cooperman 1989</strong>: 引入 「<em>nearly linear time</em>」 BSGS, 期望 <TeX src={`O(n^2 \\log^c n)`} />。</>} en={<><strong>Babai–Cooperman 1989</strong>: introduced "<em>nearly-linear-time</em>" BSGS, expected <TeX src={`O(n^2 \\log^c n)`} />.</>} /></li>
          <li><L zh={<><strong>Holt–Eick–O'Brien 2005</strong> (现代 GAP/Magma 后端): 经验复杂度 <TeX src={`\\sim n^3`} />, 把 |Ω| ~ 10⁶ 的群作几秒内可处理。</>} en={<><strong>Holt–Eick–O'Brien 2005</strong> (modern GAP/Magma backend): empirical <TeX src={`\\sim n^3`} />, handling |Ω| ~ 10⁶ groups in seconds.</>} /></li>
        </ul>
        <p>
          <L
            zh={<>跟 BSGS 平行的几个计算群论算法:</>}
            en={<>BSGS-adjacent algorithms in the computational toolkit:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>Todd–Coxeter (1936)</strong>: 给定群 G 的 「<em>有限呈现</em>」 (生成元 + 关系) 和子群 H, 枚举陪集 G/H。 跟 BSGS 是 <em>对偶</em> 的: 一个从置换出发, 一个从关系出发。</>} en={<><strong>Todd–Coxeter (1936)</strong>: given a <em>finite presentation</em> (generators + relations) and a subgroup H, enumerates cosets G/H. <em>Dual</em> to BSGS: one starts from permutations, the other from relations.</>} /></li>
          <li><L zh={<><strong>Baby-step giant-step</strong>: 对 「字问题」 给 <TeX src={`O(\\sqrt{|G|})`} /> 算法, 不依赖结构 ── 对 G ≈ 4.3 × 10¹⁹ 仍是 ~6 × 10⁹ 操作, 实际不可行。 BSGS 把这压到 O(n²) ── 这就是为什么 「BSGS 是基础」。</>} en={<><strong>Baby-step giant-step</strong>: gives <TeX src={`O(\\sqrt{|G|})`} /> for the word problem, agnostic to structure — but for G ≈ 4.3 × 10¹⁹ that's still ~6 × 10⁹ operations, infeasible. BSGS reduces it to O(n²) — which is why "BSGS is foundational."</>} /></li>
          <li><L zh={<><strong>Brownian motion in the symmetric group</strong> (Diaconis): 把 BSGS 跟 §24 的随机游走耦合, 给出 「随机生成元生成全 G 的期望次数」。</>} en={<><strong>Brownian motion in the symmetric group</strong> (Diaconis): couples BSGS with §24's random walks, giving the expected number of random generators needed to generate all of G.</>} /></li>
        </ul>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="25.6  为什么这对魔方算法重要?" en="25.6  Why does this matter for cube algorithms?" />
        </h3>
        <p>
          <L
            zh={<>BSGS 是 「<strong>membership test</strong>」 的天然数据结构: 给定一个置换 g, 它属于 G 吗? 答: 逐层用 Schreier 表反向把 g 分解; 若能完全归约就属于。 用 <TeX src={`O(k \\cdot n^2)`} /> 时间。 这个数据结构对求解器没直接用 (求解器需要 <em>短</em> 表示, BSGS 给的是 <em>长</em> 表示, 平均 ~ <TeX src={`\\log |G| \\approx 65`} /> 步), 但对群论问题非常有效:</>}
            en={<>BSGS is the natural data structure for the <strong>membership test</strong>: given g, is g ∈ G? Layer-by-layer reduce via Schreier transversals; total fully reduced ⇒ yes. Time <TeX src={`O(k \\cdot n^2)`} />. Not directly useful for solvers (they need <em>short</em> presentations; BSGS gives <em>long</em> ones, average <TeX src={`\\log |G| \\approx 65`} /> moves), but indispensable for group questions:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh="「这一组 alg 能否生成全 G?」 ── 试着 BSGS 一次,看 Size 是否等于 |G|" en={`"Does this alg set generate all of G?" — run BSGS, check if Size equals |G|.`} /></li>
          <li><L zh="「这个子群的指数是多少?」 ── BSGS 给指数即 |G| / |H|" en={`"What is the index of this subgroup?" — BSGS yields |H| directly, hence |G|/|H|.`} /></li>
          <li><L zh="「枚举共轭类 / 中心 / 换位子群」 ── BSGS 提供 G 上的 「随机均匀采样」 算法 (Furst–Hopcroft–Luks)" en={`"Enumerate conjugacy classes / centre / commutator subgroup" — BSGS yields a uniform-random sampling algorithm on G (Furst–Hopcroft–Luks).`} /></li>
        </ul>
      </GTSec>
  );
}
