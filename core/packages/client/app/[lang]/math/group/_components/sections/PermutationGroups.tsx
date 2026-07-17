'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { applyAlg, cycleStructure, permSign, identity } from '../cube_state';
import { tr } from '@/i18n/tr';

// ── §21 ParityCalculator — apply an alg, see sgn(cp), sgn(ep), product ────
function ParityCalculator() {
  const [alg, setAlg] = useState('R U2 D B D');
  const state = useMemo(() => applyAlg(identity(), alg), [alg]);
  const sgnCp = permSign(state.cp);
  const sgnEp = permSign(state.ep);
  const product = sgnCp * sgnEp;
  return (
    <div className="gt-parity">
      <input
        className="gt-parity-input"
        value={alg}
        onChange={e => setAlg(e.target.value)}
        spellCheck={false}
        placeholder="e.g. R U R' U'"
      />
      <div className="gt-parity-row">
        <div className="gt-parity-cell">
          <div className="gt-parity-lbl">sgn(cp)</div>
          <div className={`gt-parity-val ${sgnCp === 1 ? 'pos' : 'neg'}`}>
            {sgnCp === 1 ? '+1' : '−1'}
          </div>
          <div className="gt-parity-sub">{sgnCp === 1 ? tr({ zh: '偶置换', en: 'even'
                          }) : tr({ zh: '奇置换', en: 'odd'
                              })}</div>
        </div>
        <div className="gt-parity-cell">
          <div className="gt-parity-lbl">sgn(ep)</div>
          <div className={`gt-parity-val ${sgnEp === 1 ? 'pos' : 'neg'}`}>
            {sgnEp === 1 ? '+1' : '−1'}
          </div>
          <div className="gt-parity-sub">{sgnEp === 1 ? tr({ zh: '偶置换', en: 'even'
                          }) : tr({ zh: '奇置换', en: 'odd'
                              })}</div>
        </div>
        <div className="gt-parity-cell gt-parity-cell-prod">
          <div className="gt-parity-lbl">sgn(cp) · sgn(ep)</div>
          <div className={`gt-parity-val ${product === 1 ? 'pos' : 'neg'}`}>
            {product === 1 ? '+1' : '−1'}
          </div>
          <div className="gt-parity-sub">
            {product === 1
              ? tr({ zh: '✓ 在 G 中可达', en: '✓ reachable in G'
                                      })
              : tr({ zh: '✗ 不可能!(单棱翻转不允许)', en: '✗ impossible! (single-edge flip forbidden)'
                                      })}
          </div>
        </div>
      </div>
      <div className="gt-parity-cycles">
        <div className="gt-parity-cycles-row">
          <span className="gt-parity-cycles-lbl">{tr({ zh: '角块循环', en: 'corner cycles'
        })}</span>
          <span className="gt-mono">[{cycleStructure(state.cp).join(', ') || '·'}]</span>
        </div>
        <div className="gt-parity-cycles-row">
          <span className="gt-parity-cycles-lbl">{tr({ zh: '棱块循环', en: 'edge cycles'
        })}</span>
          <span className="gt-mono">[{cycleStructure(state.ep).join(', ') || '·'}]</span>
        </div>
      </div>
      <div className="gt-aside" style={{ marginTop: 12 }}>
        <L
          zh={<>这就是 §5 第三守恒律的现场:<TeX src={`\\operatorname{sgn}(c_p) = \\operatorname{sgn}(e_p)`} />。在 G 里,角块和棱块的奇偶性必须 <em>一同翻转</em>;sgn 是从 G 到 ℤ/2 的同态,它的核是「双偶」子群。</>}
          en={<>This is the third invariant from §5 in action: <TeX src={`\\operatorname{sgn}(c_p) = \\operatorname{sgn}(e_p)`} />. In G, corner parity and edge parity must flip <em>together</em>; sgn is a homomorphism G → ℤ/2 whose kernel is the "double-even" subgroup.</>}
        />
      </div>
    </div>
  );
}

// ── §22 AlgorithmCompareTable — IDA*/Thistlethwaite/Kociemba/Korf ─────────

export default function PermutationGroups() {
  const lang = useLang();
  return (
      <GTSec id="permutation-groups" className="gt-sec">
        <div className="gt-sec-num">§21</div>
        <h2 className="gt-sec-title">
          <L zh="置换群 Sₙ 与交错群 Aₙ" en="Symmetric & alternating groups" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>置换群是群论里最古老、最具体、也最丰富的家族。 19 世纪 Cauchy、 Cayley、 Galois 创立群论时,「群」几乎就是「置换的集合」 的同义词。 魔方群本质上是两个置换群的乘积:<TeX src={`G \\subset S_8 \\times S_{12}`} />。 理解 <TeX src={`S_n`} /> 和 <TeX src={`A_n`} /> 就理解了魔方一半的代数。</>}
            en={<>Permutation groups are the oldest, most concrete, and most prolific family in group theory. When Cauchy, Cayley, and Galois founded the subject in the 19th century, "group" was essentially synonymous with "permutation set." The cube group lives inside <TeX src={`S_8 \\times S_{12}`} />. Understanding <TeX src={`S_n`} /> and <TeX src={`A_n`} /> is half of cube algebra.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 21.1 — 对称群 Sₙ', en: 'Definition 21.1 — symmetric group Sₙ'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<><TeX src={`S_n`} /> 是 n 元集 {'{1, 2, ..., n}'} 上所有双射的集合,合成是运算。 它有<TeXBlock src={`|S_n| = n!`} />阶。</>}
              en={<><TeX src={`S_n`} /> is the set of all bijections of {'{1, 2, ..., n}'} under composition. Its order is<TeXBlock src={`|S_n| = n!`} /></>}
            />
          </div>
        </div>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 21.2 — 交错群 Aₙ', en: 'Definition 21.2 — alternating group Aₙ'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<><TeX src={`A_n \\subset S_n`} /> 是所有 <em>偶置换</em> (即偶数个对换的乘积) 构成的子群,等价地<TeXBlock src={`A_n = \\ker(\\operatorname{sgn} : S_n \\to \\{\\pm 1\\}).`} /><TeX src={`A_n`} /> 是 <TeX src={`S_n`} /> 的正规子群,阶 <TeX src={`|A_n| = n!/2`} />。</>}
              en={<><TeX src={`A_n \\subset S_n`} /> consists of the <em>even permutations</em> (those decomposable into an even number of transpositions);<TeXBlock src={`A_n = \\ker(\\operatorname{sgn} : S_n \\to \\{\\pm 1\\}).`} /><TeX src={`A_n`} /> is normal in <TeX src={`S_n`} /> with <TeX src={`|A_n| = n!/2`} />.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="21.1  Aₙ 的单纯性 (n ≥ 5)" en="21.1  Simplicity of Aₙ (n ≥ 5)" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定理 21.3 — Galois', en: 'Theorem 21.3 — Galois' })}</div>
          <div className="gt-def-body">
            <L
              zh={<>对所有 <TeX src={`n \\geq 5`} />, <TeX src={`A_n`} /> 是 <strong>单群</strong>: 它没有任何非平凡正规子群。</>}
              en={<>For all <TeX src={`n \\geq 5`} />, <TeX src={`A_n`} /> is a <strong>simple group</strong>: it has no proper non-trivial normal subgroups.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这条定理是 Galois 证明「五次方程没有根式解」的核心。 简单证明思路:</>}
            en={<>This theorem is the heart of Galois's proof that the quintic has no radical solution. Brief proof outline:</>}
          />
        </p>
        <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<>验证 Aₙ 由 3-循环生成 (因为 n ≥ 3 时,任意偶置换可写成 3-循环的乘积)。</>}
            en={<>Verify that Aₙ is generated by 3-cycles (for n ≥ 3, every even permutation is a product of 3-cycles).</>}
          /></li>
          <li><L
            zh={<>设 <TeX src={`N \\triangleleft A_n`} /> 是非平凡正规子群。 证明 N 必含一个 3-循环。</>}
            en={<>Let <TeX src={`N \\triangleleft A_n`} /> be non-trivial. Show N must contain a 3-cycle.</>}
          /></li>
          <li><L
            zh={<>用共轭把任意 3-循环搬进 N。 故 N 含所有 3-循环 = Aₙ 的生成元。 矛盾。</>}
            en={<>Using conjugation, transport every 3-cycle into N. Hence N contains all the generators of Aₙ, forcing N = Aₙ. Contradiction.</>}
          /></li>
        </ol>
        <p>
          <L
            zh={<><strong>A₅ 是阶数最小的非阿贝尔单群</strong> (|A₅| = 60),也是有限单群分类里最低层的代表。 A₆、 A₇、 …… 跟魔方紧密相关:角块置换 <TeX src={`A_8`} /> 和 棱块置换 <TeX src={`A_{12}`} /> 都是非阿贝尔单群。</>}
            en={<><strong>A₅ is the smallest non-Abelian simple group</strong> (|A₅| = 60), and the entry point to the classification of finite simple groups. The cube uses both <TeX src={`A_8`} /> (corner permutations) and <TeX src={`A_{12}`} /> (edges), both non-Abelian simple.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="21.2  互动:Parity Calculator" en="21.2  Interactive: parity calculator" />
        </h3>
        <p>
          <L
            zh={<>给定任意公式,马上算出 sgn(cp)、 sgn(ep) 和它们的乘积。 第三个守恒律说乘积必须是 +1; 公式输入「单棱翻转」之类的不可能状态时, 计算器会显示 −1 —— 这是「不可达」的代数证据。</>}
            en={<>Plug in any alg; the calculator instantly returns sgn(cp), sgn(ep), and their product. The third invariant forces the product to be +1; if you type in an impossible state like a single-edge flip, the calculator shows −1 — algebraic proof of unreachability.</>}
          />
        </p>
        <ParityCalculator />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="21.3  凯莱定理:每个群都是置换群" en="21.3  Cayley's theorem: every group is a permutation group" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定理 21.4 — Cayley (1854)', en: 'Theorem 21.4 — Cayley (1854)' })}</div>
          <div className="gt-def-body">
            <L
              zh={<>每个群 G 都嵌入对称群:<TeXBlock src={`G \\;\\hookrightarrow\\; S_{|G|}.`} />映射 <TeX src={`g \\mapsto L_g`} /> 把 g 看成 G 上的左乘置换 <TeX src={`L_g(x) = gx`} />。 这是单同态。</>}
              en={<>Every group G embeds into a symmetric group:<TeXBlock src={`G \\;\\hookrightarrow\\; S_{|G|}.`} />The map <TeX src={`g \\mapsto L_g`} /> sends g to the left-multiplication permutation <TeX src={`L_g(x) = gx`} />. This is an injection of groups.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对魔方,这是「显然且无用」的:抽象上 <TeX src={`G \\hookrightarrow S_{|G|} = S_{4.3 \\times 10^{19}}`} />,维度比 G 大无穷倍。 实际上 G 嵌入 <TeX src={`S_{48}`} /> (48 个贴纸的置换),这是 <strong>低维表示</strong>。 一般「群在它本身上的左作用」是凯莱定理的灵感来源,但魔方提醒我们 <em>低维忠实表示</em> 才是真正有用的。</>}
            en={<>For the cube this is "obvious and useless": abstractly <TeX src={`G \\hookrightarrow S_{|G|} = S_{4.3 \\times 10^{19}}`} />, which is astronomically large. In practice G embeds into <TeX src={`S_{48}`} /> (permutations of 48 stickers), a much <strong>lower-dimensional representation</strong>. Cayley's theorem inspires the idea; finding minimal faithful representations is the real game.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="21.4  共轭类 ↔ 分拆 — Sₙ 的「形状字母表」" en="21.4  Conjugacy classes ↔ partitions — the shape alphabet of Sₙ" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 21.5 — Sₙ 的共轭类', en: 'Theorem 21.5 — conjugacy classes of Sₙ'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<><TeX src={`S_n`} /> 的两个置换共轭 <em>当且仅当</em> 它们有相同的不交圈型 (cycle type)。 共轭类 ↔ <TeX src={`n`} /> 的 <strong>整数分拆</strong> 一一对应。 一个置换 <TeX src={`\\sigma`} /> 的圈型为 <TeX src={`1^{m_1} 2^{m_2} \\cdots n^{m_n}`} /> 时,它所在共轭类大小为<TeXBlock src={`|[\\sigma]| \\;=\\; \\frac{n!}{\\prod_{k} k^{m_k} \\cdot m_k!}.`} /></>}
              en={<>Two permutations in <TeX src={`S_n`} /> are conjugate <em>iff</em> they share the same disjoint cycle type. Conjugacy classes ↔ <strong>integer partitions</strong> of <TeX src={`n`} /> in one-to-one correspondence. For a permutation with cycle type <TeX src={`1^{m_1} 2^{m_2} \\cdots n^{m_n}`} />, its conjugacy-class size is<TeXBlock src={`|[\\sigma]| \\;=\\; \\frac{n!}{\\prod_{k} k^{m_k} \\cdot m_k!}.`} /></>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>例: <TeX src={`S_8`} /> (角块)。 整数 8 的分拆数 <TeX src={`p(8) = 22`} />,所以 <TeX src={`S_8`} /> 恰有 <strong>22 个共轭类</strong>。 其中最大一类是 「8-循环」 (cycle type = (8)):<TeX src={`|[\\sigma]| = 8!/8 = 5040`} />,占 8! = 40320 的 1/8。</>}
            en={<>Example: <TeX src={`S_8`} /> (corner permutations). The number of partitions <TeX src={`p(8) = 22`} />, so <TeX src={`S_8`} /> has exactly <strong>22 conjugacy classes</strong>. The biggest is the 8-cycle class (cycle type (8)): <TeX src={`|[\\sigma]| = 8!/8 = 5040`} />, accounting for 1/8 of 8! = 40320.</>}
          />
        </p>
        <table className="gt-partition-tbl">
          <thead>
            <tr>
              <th>{tr({ zh: '分拆', en: 'partition' })}</th>
              <th>{tr({ zh: '圈型', en: 'cycle type' })}</th>
              <th>{tr({ zh: '类大小', en: 'class size'
            })}</th>
              <th>{lang === 'zh' ? 'sgn' : 'sgn'}</th>
              <th>{lang === 'zh' ? 'order' : 'order'}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>8</td><td>(a b c d e f g h)</td><td className="num">5,040</td><td className="num">−</td><td className="num">8</td></tr>
            <tr><td>7 + 1</td><td>(a b c d e f g)(h)</td><td className="num">5,760</td><td className="num">+</td><td className="num">7</td></tr>
            <tr><td>6 + 2</td><td>(6)(2)</td><td className="num">3,360</td><td className="num">−</td><td className="num">6</td></tr>
            <tr><td>5 + 3</td><td>(5)(3)</td><td className="num">2,688</td><td className="num">+</td><td className="num">15</td></tr>
            <tr><td>4 + 4</td><td>(4)(4)</td><td className="num">1,260</td><td className="num">+</td><td className="num">4</td></tr>
            <tr><td>3 + 3 + 2</td><td>(3)(3)(2)</td><td className="num">1,120</td><td className="num">−</td><td className="num">6</td></tr>
            <tr><td>2 + 2 + 2 + 2</td><td>(2)<sup>4</sup></td><td className="num">105</td><td className="num">+</td><td className="num">2</td></tr>
            <tr><td>1<sup>8</sup></td><td>(1)<sup>8</sup> {tr({ zh: '(单位元)', en: '(identity)'
            })}</td><td className="num">1</td><td className="num">+</td><td className="num">1</td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: 14 }}>
          <L
            zh={<>校验: Σ 类大小 = 40320 = 8! ✓ (实际上要把全 22 个分拆都算上)。 sgn 由圈数决定: 偶置换 = 偶数个偶长圈; 奇置换 = 奇数个偶长圈。 这也解释为什么 <TeX src={`A_8`} /> 取的是「圈数 + n 偶」一半的类: 当 n = 8 时, 22 个共轭类里恰 13 个属于 <TeX src={`A_8`} /> (有些类在 <TeX src={`A_8`} /> 中会进一步分裂为两个 <TeX src={`A_8`} />-共轭类)。</>}
            en={<>Sanity check: Σ class sizes = 40320 = 8! ✓ (across all 22 partitions). The sgn is determined by the number of even-length cycles: even permutation = even count; odd = odd count. This also explains how <TeX src={`A_8`} /> selects half of these classes: of the 22 in <TeX src={`S_8`} />, exactly 13 sit in <TeX src={`A_8`} /> (some split into two <TeX src={`A_8`} />-conjugacy classes).</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="21.5  Aₙ 的反例:n = 4 时 A₄ 不单" en="21.5  Counterexample: A₄ is not simple" />
        </h3>
        <p>
          <L
            zh={<>Galois 定理 21.3 要求 <TeX src={`n \\ge 5`} />。 <strong><TeX src={`n = 4`} /> 时 <TeX src={`A_4`} /> 不单</strong>:它有一个非平凡正规子群,著名的 <strong>Klein 四群</strong><TeXBlock src={`V_4 \\;=\\; \\{\\,e,\\;(12)(34),\\;(13)(24),\\;(14)(23)\\,\\} \\;\\triangleleft\\; A_4.`} />V₄ 由所有 「两两对换乘积」 构成,阶 4。 共轭闭包: 三个非恒元都属于同一个共轭类 (类型 (2,2)),所以 V₄ 在 <TeX src={`A_4`} /> 下保持不变。</>}
            en={<>Galois's theorem 21.3 requires <TeX src={`n \\ge 5`} />. <strong>For <TeX src={`n = 4`} />, <TeX src={`A_4`} /> is not simple</strong>: it has a non-trivial normal subgroup, the celebrated <strong>Klein four-group</strong><TeXBlock src={`V_4 \\;=\\; \\{\\,e,\\;(12)(34),\\;(13)(24),\\;(14)(23)\\,\\} \\;\\triangleleft\\; A_4.`} />V₄ contains all "products of two disjoint transpositions," has order 4. All three non-identity elements form one conjugacy class (type (2,2)), so V₄ is closed under <TeX src={`A_4`} />-conjugation.</>}
          />
        </p>
        <p>
          <L
            zh={<>商 <TeX src={`A_4 / V_4 \\cong \\mathbb{Z}/3`} />。 这是为什么 「4 个未知数的方程」 (四次方程) 仍有根式解 — 它的 Galois 群 <TeX src={`S_4`} /> 的合成列<TeXBlock src={`S_4 \\triangleright A_4 \\triangleright V_4 \\triangleright \\langle (12)(34)\\rangle \\triangleright \\{e\\}`} />每一个商都是循环群 (ℤ/2, ℤ/3, ℤ/2, ℤ/2) — 这正是 「可解群」 的定义。 而 <TeX src={`n \\ge 5`} /> 时 <TeX src={`A_n`} /> 单, 不可继续分解, <TeX src={`S_n`} /> 因此不可解 — 高次方程没有根式解的代数证据。</>}
            en={<>The quotient <TeX src={`A_4 / V_4 \\cong \\mathbb{Z}/3`} />. This is why quartic equations still have radical solutions — the Galois group <TeX src={`S_4`} /> has composition series<TeXBlock src={`S_4 \\triangleright A_4 \\triangleright V_4 \\triangleright \\langle (12)(34)\\rangle \\triangleright \\{e\\}`} />with all factors cyclic (ℤ/2, ℤ/3, ℤ/2, ℤ/2) — by definition <em>solvable</em>. For <TeX src={`n \\ge 5`} />, <TeX src={`A_n`} /> is simple and cannot be broken down further, so <TeX src={`S_n`} /> is <em>not</em> solvable — the algebraic obstruction to radical solutions of higher-degree equations.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="21.6  Sₙ 的生成元 — 转置一对相邻元素就够" en="21.6  Generators of Sₙ — adjacent transpositions suffice" />
        </h3>
        <p>
          <L
            zh={<>对 <TeX src={`S_n`} />, 三组最常见的生成集合:</>}
            en={<>Three commonly used generating sets for <TeX src={`S_n`} />:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>所有对换</strong> <TeX src={`\\{(i,j) : 1 \\le i < j \\le n\\}`} />: 共 <TeX src={`\\binom{n}{2}`} /> 个。 任意置换可写成对换的乘积。</>} en={<><strong>All transpositions</strong> <TeX src={`\\{(i,j) : 1 \\le i < j \\le n\\}`} />: total <TeX src={`\\binom{n}{2}`} />. Every permutation factors as a product of transpositions.</>} /></li>
          <li><L zh={<><strong>相邻对换</strong> <TeX src={`\\{(i, i+1) : 1 \\le i < n\\}`} />: 仅 <TeX src={`n-1`} /> 个。 这给出 <TeX src={`S_n`} /> 的「冒泡排序」 视角 — 它满足 <TeX src={`s_i s_{i+1} s_i = s_{i+1} s_i s_{i+1}`} /> (Yang–Baxter / 编织关系) 和 <TeX src={`s_i^2 = e`} />, <TeX src={`s_i s_j = s_j s_i`} /> (<TeX src={`|i-j| \\ge 2`} />)。</>} en={<><strong>Adjacent transpositions</strong> <TeX src={`\\{(i, i+1) : 1 \\le i < n\\}`} />: just <TeX src={`n-1`} />. Yields the "bubble sort" view of <TeX src={`S_n`} />, satisfying braid relations <TeX src={`s_i s_{i+1} s_i = s_{i+1} s_i s_{i+1}`} />, <TeX src={`s_i^2 = e`} />, and <TeX src={`s_i s_j = s_j s_i`} /> for <TeX src={`|i-j| \\ge 2`} />.</>} /></li>
          <li><L zh={<><strong>一个对换 + 一个 n-循环</strong>: <TeX src={`\\{(1,2),\\,(1,2,3,\\ldots,n)\\}`} /> 共 <em>2 个元素</em> 就生成 <TeX src={`S_n`} />。 对 <TeX src={`A_n`} /> (<TeX src={`n \\ge 3`} />),<TeX src={`\\{(1,2,3),\\,(1,2,\\ldots,n)\\}`} /> 类似只需 2 个。</>} en={<><strong>One transposition + one n-cycle</strong>: just <em>2 elements</em>, namely <TeX src={`\\{(1,2),\\,(1,2,3,\\ldots,n)\\}`} />, generate <TeX src={`S_n`} />. For <TeX src={`A_n`} /> (<TeX src={`n \\ge 3`} />), the pair <TeX src={`\\{(1,2,3),\\,(1,2,\\ldots,n)\\}`} /> similarly suffices.</>} /></li>
        </ul>
        <div className="gt-aside" style={{ marginTop: 16 }}>
          <L
            zh={<>「相邻对换 + 编织关系」 这套描述把 <TeX src={`S_n`} /> 跟拓扑里的 <strong>编织群</strong> <TeX src={`B_n`} /> 连起来:抛掉 <TeX src={`s_i^2 = e`} /> 这一条关系,就从 <TeX src={`S_n`} /> 升到 <TeX src={`B_n`} />。 编织群是无限群,跟扭结理论、 量子计算 (拓扑量子位) 紧密相关。 魔方在 「相邻面转」 关系下也有类似的 「半编织」 结构 — 但是有限的、 受守恒律约束的。</>}
            en={<>The "adjacent transposition + braid relations" presentation links <TeX src={`S_n`} /> to topology's <strong>braid groups</strong> <TeX src={`B_n`} />: dropping the relation <TeX src={`s_i^2 = e`} /> lifts <TeX src={`S_n`} /> to <TeX src={`B_n`} />. Braid groups are infinite and connect to knot theory and (topological) quantum computing. The cube has its own "half-braid" structure under adjacent-face turns — finite and bounded by the conservation laws.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="21.7  Pólya 循环指数 — 染色计数" en="21.7  Pólya cycle index — counting colourings" />
        </h3>
        <p>
          <L
            zh={<>对 G 作用于 n 元集 X 的情形,Pólya 定义 <strong>循环指数多项式</strong>:</>}
            en={<>For G acting on an n-element set X, Pólya defined the <strong>cycle index polynomial</strong>:</>}
          />
        </p>
        <TeXBlock src={`Z_G(z_1, z_2, \\ldots, z_n) \\;=\\; \\frac{1}{|G|} \\sum_{g \\in G} z_1^{c_1(g)} z_2^{c_2(g)} \\cdots z_n^{c_n(g)},`} />
        <p>
          <L
            zh={<>其中 <TeX src={`c_k(g)`} /> 是 g 中长度 k 的圈数。 Pólya 列举定理: X 用 c 种颜色染色, 在 G 等价下不同的染色数等于<TeXBlock src={`\\#\\,\\text{colourings}/G \\;=\\; Z_G(c, c, \\ldots, c).`} />应用:Rubik's Cube 的 「外部对称」 群 <TeX src={`O_h`} /> (48 阶) 作用于 6 个面,问 「用 6 种颜色染色不同方案多少种」 ——<TeXBlock src={`Z_{O_h}(6, 6, \\ldots, 6) \\;=\\; \\frac{1}{48}\\bigl(\\,6^6 + 3 \\cdot 6^4 + \\ldots\\bigr) \\;=\\; 30.`} />恰好 30 种本质不同的 「6 色立方体」 染法。</>}
            en={<>where <TeX src={`c_k(g)`} /> is the number of length-k cycles in g. Pólya's enumeration theorem: the number of colourings of X with c colours, up to G-equivalence, equals<TeXBlock src={`\\#\\,\\text{colourings}/G \\;=\\; Z_G(c, c, \\ldots, c).`} />Application: the cube's outer symmetry group <TeX src={`O_h`} /> (order 48) acts on 6 faces; "how many essentially different ways to colour the cube with 6 colours?"<TeXBlock src={`Z_{O_h}(6, 6, \\ldots, 6) \\;=\\; \\frac{1}{48}\\bigl(\\,6^6 + 3 \\cdot 6^4 + \\ldots\\bigr) \\;=\\; 30.`} />Exactly 30 essentially distinct 6-coloured cubes.</>}
          />
        </p>
      </GTSec>
  );
}
