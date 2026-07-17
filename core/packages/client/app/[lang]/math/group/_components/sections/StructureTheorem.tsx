'use client';

import { GTSec, L, TeX, TeXBlock } from '../primitives';
import { tr } from '@/i18n/tr';

// §structure — self-contained prose section, lazy-loaded per slug from page.tsx's
// EXT_COMPONENTS map (see the section-extraction note there).
export default function StructureTheorem() {
  return (
      <GTSec id="structure" className="gt-sec">
        <div className="gt-sec-num">§6</div>
        <h2 className="gt-sec-title">
          <L zh="结构定理 — G 的代数解剖" en="Structure theorem — anatomy of G" />
        </h2>
        <p>
          <L
            zh={<>把上述守恒律翻译成代数语言,G 就是「自由组合空间」的一个 <em>指数 12 子群</em>:</>}
            en={<>Translated into algebra, the three invariants make G a subgroup of index 12 inside the free assembly space:</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 6.1 — Singmaster', en: 'Theorem 6.1 — Singmaster' })}</div>
          <div className="gt-thm-body">
            <TeXBlock src={`G \\;\\cong\\; \\bigl\\{\\, (\\sigma, x, \\tau, y) \\in S_8 \\times (\\mathbb{Z}/3)^8 \\times S_{12} \\times (\\mathbb{Z}/2)^{12} \\;\\bigm|\\; \\textstyle\\sum x_i \\equiv 0,\\; \\sum y_i \\equiv 0,\\; \\operatorname{sgn}(\\sigma) = \\operatorname{sgn}(\\tau) \\,\\bigr\\}`} />
            <L
              zh={<>更精炼地:G 包含两个 <strong>半直积</strong> ("圈积") 作为子群:</>}
              en={<>More compactly, G contains two <strong>semidirect products</strong> ("wreath products") as subgroups:</>}
            />
            <TeXBlock src={`\\underbrace{\\mathbb{Z}/3 \\,\\wr\\, S_8}_{\\text{corner sector}} \\;\\;\\times\\;\\; \\underbrace{\\mathbb{Z}/2 \\,\\wr\\, S_{12}}_{\\text{edge sector}}`} />
            <span style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
              {tr({ zh: '角块部分 ≅ 81 万 7,920,且与棱块部分通过 sgn(cp)=sgn(ep) 这一条「相位锁」耦合。', en: 'The corner sector has 88,179,840 elements; it is coupled to the edge sector by the single parity lock sgn(cp) = sgn(ep).'
            })}
            </span>
          </div>
        </div>
        <div className="gt-aside">
          <L
            zh={<>圈积 <TeX src={`A \\wr B`} /> 直观理解:你有 B 个「位置」,每个位置上挂一份 A 的副本。 B 在外部置换位置 (打乱角块位置),A 在每个位置内部独立旋转 (拧那个角块)。 在魔方上, <TeX src={`B = S_8,\\; A = \\mathbb{Z}/3`} />。</>}
            en={<>The wreath product <TeX src={`A \\wr B`} />: B "positions" each carrying their own copy of A. B permutes positions (shuffles corners around), A independently rotates within each (twists each corner). For the cube, <TeX src={`B = S_8`} /> and <TeX src={`A = \\mathbb{Z}/3`} />.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="6.1  短正合列" en="6.1  Short exact sequence" />
        </h3>
        <p>
          <L
            zh={<>魔方群可以用 <em>短正合列</em> 精确表述。 设 <TeX src={`N = (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /> 是「方向自由度」(去掉两个 dependent 之后), <TeX src={`P`} /> 是「奇偶联动的角棱置换对」(<TeX src={`S_8 \\times S_{12}`} /> 的指数 2 子群):</>}
            en={<>The cube group fits into a <em>short exact sequence</em>. Let <TeX src={`N = (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /> (orientations with the two dependent ones removed), and <TeX src={`P`} /> the parity-linked permutation pair (the index-2 subgroup of <TeX src={`S_8 \\times S_{12}`} />):</>}
          />
        </p>
        <TeXBlock src={`1 \\;\\longrightarrow\\; N \\;\\longrightarrow\\; G \\;\\longrightarrow\\; P \\;\\longrightarrow\\; 1`} />
        <p>
          <L
            zh={<>这说: G 在 N 上是一个 P-扩张 (P-extension), 即 G/N ≅ P。 用阶来验证: |N| = 3⁷ × 2¹¹ = 4,478,976, |P| = 8! · 12! / 2 = 9,656,672,256,000。乘积 = 4.3 × 10¹⁹ = |G|。✓</>}
            en={<>This says G is a P-extension of N — i.e. G/N ≅ P. Sanity check: |N| = 3⁷ · 2¹¹ = 4,478,976; |P| = 8! · 12! / 2 = 9,656,672,256,000; product = 4.3 × 10¹⁹ = |G|. ✓</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="6.2  分裂吗?" en="6.2  Does it split?" />
        </h3>
        <p>
          <L
            zh={<>群论里一个自然问题: 上面这个扩张是否「分裂」(split)? 即, P 有没有同构嵌入到 G 中?答案:<strong>是</strong>。「permute pieces with all CO/EO at 0」就是 P 的一个具体 embedding(对应的代数操作: 任何能保持 CO=0, EO=0 的操作组合)。所以扩张分裂, G 是半直积:</>}
            en={<>A natural follow-up: does the extension <em>split</em>? i.e. is there an embedding of P into G? Answer: <strong>yes</strong>. The set "permute cubies while keeping CO = 0 and EO = 0" is an embedded copy of P. The extension splits, so G is a semidirect product:</>}
          />
        </p>
        <TeXBlock src={`G \\;\\cong\\; N \\rtimes P`} />
        <p>
          <L
            zh={<>这正是物理上「先置换, 再扭」的代数化:任何 G 中的元素都能唯一写成 (扭法) · (置换)的乘积。这是 cube state 4-tuple 编码的代数基础。</>}
            en={<>This is the algebraic counterpart of "first permute, then twist": every element of G factors uniquely as (orientation) · (permutation). This is the algebraic foundation of the (cp, co, ep, eo) state encoding.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="6.3  直积 vs 半直积 — Klein 4 对比" en="6.3  Direct vs semidirect — the Klein 4 contrast" />
        </h3>
        <p>
          <L
            zh={<>要看 <em>半直积</em> 跟 <em>直积</em> 的差别,Klein 4-group 是最干净的例子。 考虑 <TeX src={`\\mathbb{Z}/2 \\times \\mathbb{Z}/2`} />:这是直积,两个 ℤ/2 完全独立。 现在比较:</>}
            en={<>To see the difference between a <em>semidirect</em> product and a <em>direct</em> product, the Klein 4-group is the cleanest example. Consider <TeX src={`\\mathbb{Z}/2 \\times \\mathbb{Z}/2`} />: this is direct — two independent ℤ/2 factors. Compare against:</>}
          />
        </p>
        <table className="gt-product-tbl">
          <thead>
            <tr>
              <th>{tr({ zh: '运算结构', en: 'Structure'
            })}</th>
              <th>{tr({ zh: '乘法律', en: 'Multiplication' })}</th>
              <th>{tr({ zh: '阿贝尔?', en: 'Abelian?'
            })}</th>
              <th>{tr({ zh: '魔方实例', en: 'Cube instance'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>{tr({ zh: '直积', en: 'Direct product'
            })}</strong> <TeX src={`A \\times B`} /></td>
              <td><TeX src={`(a_1, b_1)(a_2, b_2) = (a_1 a_2, b_1 b_2)`} /></td>
              <td className="num">{tr({ zh: 'A, B 均阿贝尔则是', en: 'iff A, B abelian'
            })}</td>
              <td><L zh={<><em>无</em>: 角棱实际有奇偶耦合, 非独立</>} en={<><em>none</em>: corners/edges parity-coupled</>} /></td>
            </tr>
            <tr>
              <td><strong>{tr({ zh: '半直积', en: 'Semidirect'
            })}</strong> <TeX src={`A \\rtimes_\\varphi B`} /></td>
              <td><TeX src={`(a_1, b_1)(a_2, b_2) = (a_1\\,\\varphi_{b_1}(a_2),\\; b_1 b_2)`} /></td>
              <td className="num">{tr({ zh: 'φ 平凡时才是', en: 'iff φ trivial'
            })}</td>
              <td><TeX src={`G \\cong N \\rtimes P`} />,P {tr({ zh: '通过共轭作用于方向', en: 'acts on orientations by conjugation'
            })}</td>
            </tr>
            <tr>
              <td><strong>{tr({ zh: '圈积', en: 'Wreath product'
            })}</strong> <TeX src={`A \\wr B`} /></td>
              <td><TeX src={`A^B \\rtimes B`} /> <L zh="(B 置换 |B| 份 A)" en=" (B permutes |B| copies of A)" /></td>
              <td className="num">{tr({ zh: '通常不是', en: 'usually not' })}</td>
              <td><TeX src={`\\mathbb{Z}/3 \\wr S_8`} /> {tr({ zh: '为角块部分', en: 'is the corner sector'
            })}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 18 }}>
          <L
            zh={<>关键区别:在直积里,B 部分的操作 <em>不影响</em> A 部分。 在半直积里,B 通过共轭 <em>重新解释</em> A —— 这正是魔方上 「先转 U, 角块朝向被相对地重新标号」 的代数化。</>}
            en={<>Key distinction: in a direct product, B's operations <em>do not affect</em> A. In a semidirect product, B <em>re-interprets</em> A by conjugation — algebraically capturing the cube's "after a U turn, corner orientations are re-labelled relative to the new positions."</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="6.4  生成元 — 18 个面转构成 G" en="6.4  Generators — 18 face turns generate G" />
        </h3>
        <p>
          <L
            zh={<>魔方群 G 由 18 个面转生成 (6 面 × 3 角度: 90°, 180°, 270°)。 但实际上, <strong>6 个生成元就足够</strong>:<TeX src={`S = \\{\\,U, D, F, B, L, R\\,\\}`} /> (即只用 90° 顺转),因为 <TeX src={`U^2, U^3, U^{-1} = U^3`} /> 都从 U 推出。 进一步:</>}
            en={<>The cube group G is generated by the 18 face turns (6 faces × 3 angles: 90°, 180°, 270°). But <strong>6 generators suffice</strong>: <TeX src={`S = \\{\\,U, D, F, B, L, R\\,\\}`} /> (clockwise quarter-turns only), since <TeX src={`U^2`} /> and <TeX src={`U^{-1} = U^3`} /> follow from U. Going further:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>最少 2 个生成元就够</strong>:有定理表明 G 可由 2 个特定元素生成 (例如 <TeX src={`R, U`} /> 一起)。 严格证明需要分析子群链。</>} en={<><strong>Just 2 generators suffice</strong>: it is known that G can be generated by 2 specific elements (e.g. <TeX src={`R`} /> and <TeX src={`U`} /> together). The proof analyses subgroup chains.</>} /></li>
          <li><L zh={<><strong>G 不是循环群</strong>:1 个生成元绝不够,因为 G 非阿贝尔。</>} en={<><strong>G is not cyclic</strong>: 1 generator is never enough, because G is non-abelian.</>} /></li>
          <li><L zh={<><strong>"对边等价"</strong>:U 和 D 在 G 内通过 cube 整体旋转共轭 — 但旋转 <em>不在</em> G 里 (G 仅是面转 group),所以严格说 U 和 D 不共轭。</>} en={<><strong>"Opposite-face equivalence"</strong>: U and D are conjugate <em>via cube rotation</em>, but the rotation itself is not in G (G is only face-turns), so strictly speaking U and D are <em>not</em> conjugate within G.</>} /></li>
        </ul>
        <div className="gt-aside" style={{ marginTop: 16 }}>
          <L
            zh={<>这跟 §3 的「state vector」编码呼应:由生成元产生的「字 (word)」就是一条解的序列。 字的最短长度 = §11 上帝之数 = G 在 S 上的 <em>直径</em>。</>}
            en={<>This dovetails with the state-vector encoding in §3: a "word" in the generators is a solve sequence. The minimum word length is exactly God's number (§11) — the <em>diameter</em> of G under the generating set S.</>}
          />
        </div>
      </GTSec>
  );
}
