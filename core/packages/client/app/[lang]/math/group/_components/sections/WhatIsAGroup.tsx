'use client';

import { GTSec, L, TeX, TeXBlock } from '../primitives';
import { tr } from '@/i18n/tr';

// ── §1 What is a group?  axiom table ───────────────────────────────────────
function AxiomTable() {
  return (
    <div className="gt-axioms">
      <div className="gt-axiom">
        <div className="gt-axiom-num">G1</div>
        <div className="gt-axiom-name">
          <L zh="封闭性" en="Closure" />
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 400, marginTop: 4 }}>
            ∀ a, b ∈ G : a · b ∈ G
          </div>
        </div>
        <div className="gt-axiom-cube">
          <L
            zh={<>任何两个魔方操作 <TeX src={`a, b`} /> 复合后,仍然是一个有效操作。<span className="gt-mono">R</span> 接着 <span className="gt-mono">U</span> 还是合法操作。</>}
            en={<>The composition of two cube moves is again a cube move. <span className="gt-mono">R</span> followed by <span className="gt-mono">U</span> is still a legal cube operation.</>}
          />
        </div>
      </div>
      <div className="gt-axiom">
        <div className="gt-axiom-num">G2</div>
        <div className="gt-axiom-name">
          <L zh="结合律" en="Associativity" />
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 400, marginTop: 4 }}>
            (a · b) · c = a · (b · c)
          </div>
        </div>
        <div className="gt-axiom-cube">
          <L
            zh={<>先做 <span className="gt-mono">R U</span> 再做 <span className="gt-mono">F</span>,跟先做 <span className="gt-mono">R</span> 再做 <span className="gt-mono">U F</span>,结果完全一样。每次转面都是物理动作,先后顺序在三元组内任意配对。</>}
            en={<>Doing <span className="gt-mono">R U</span> then <span className="gt-mono">F</span> equals doing <span className="gt-mono">R</span> then <span className="gt-mono">U F</span>. Composing physical moves is associative — bracketing has no semantic effect.</>}
          />
        </div>
      </div>
      <div className="gt-axiom">
        <div className="gt-axiom-num">G3</div>
        <div className="gt-axiom-name">
          <L zh="单位元" en="Identity" />
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 400, marginTop: 4 }}>
            ∃ e ∈ G : e · a = a · e = a
          </div>
        </div>
        <div className="gt-axiom-cube">
          <L
            zh={<>不动魔方 = 单位元 <TeX src={`e`} />。 空操作。 它跟任何操作复合都等于该操作。</>}
            en={<>Doing nothing is the identity element <TeX src={`e`} />. The empty alg. Composing it with any move <TeX src={`a`} /> gives back <TeX src={`a`} />.</>}
          />
        </div>
      </div>
      <div className="gt-axiom">
        <div className="gt-axiom-num">G4</div>
        <div className="gt-axiom-name">
          <L zh="逆元" en="Inverse" />
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 400, marginTop: 4 }}>
            ∀ a : ∃ a⁻¹ : a · a⁻¹ = e
          </div>
        </div>
        <div className="gt-axiom-cube">
          <L
            zh={<>每个操作都能撤销。<span className="gt-mono">R</span> 的逆是 <span className="gt-mono">R′</span>。<span className="gt-mono">R U R′ U′</span> 的逆是 <span className="gt-mono">U R U′ R′</span> —— 反过来逐个取逆。</>}
            en={<>Every move can be undone. The inverse of <span className="gt-mono">R</span> is <span className="gt-mono">R′</span>. The inverse of <span className="gt-mono">R U R′ U′</span> is <span className="gt-mono">U R U′ R′</span> — reverse the sequence and invert each move.</>}
          />
        </div>
      </div>
    </div>
  );
}

// ── §3 Generator demos  six face turns ─────────────────────────────────────

// Davidson, Dethridge (2014, SIAM J. Discrete Math.) — diameter = 20.
function GroupExamplesTable() {
  type Example = {
    name: string;
    op: string;
    order: string;
    abelian: boolean;
    zh: string;
    en: string;
  };
  const examples: Example[] = [
    { name: '(ℤ, +)',         op: '+',  order: '∞',     abelian: true,
      zh: '整数加法 — 最常见的无限阿贝尔群', en: 'integer addition — the prototypical infinite Abelian group'
    },
    { name: '(ℤ/n, +)',       op: '+',  order: 'n',     abelian: true,
      zh: '模 n 加法 — 有限循环群', en: 'addition mod n — the cyclic group of order n'
    },
    { name: '(ℝ \\ {0}, ×)', op: '×',  order: '∞',     abelian: true,
      zh: '非零实数乘法', en: 'nonzero reals under multiplication'
    },
    { name: 'Sₙ',             op: '∘',  order: 'n!',    abelian: false,
      zh: '对称群 — n 个元素的所有置换。n ≥ 3 时非阿贝尔', en: 'symmetric group — all permutations of n. Non-Abelian when n ≥ 3'
    },
    { name: 'D₂ₙ',            op: '∘',  order: '2n',    abelian: false,
      zh: '二面体群 — 正 n 边形对称变换', en: 'dihedral group — symmetries of a regular n-gon'
    },
    { name: 'GL(n, ℝ)',       op: '·',  order: '∞',     abelian: false,
      zh: '可逆 n×n 实矩阵的乘法群', en: 'invertible n×n real matrices under multiplication'
    },
    { name: '(rotations of cube, ∘)', op: '∘', order: '24', abelian: false,
      zh: '魔方整体旋转 (中心固定) — 同构于 S₄', en: 'cube rotations (centres fixed) — isomorphic to S₄'
    },
    { name: 'G (Rubik\'s cube)', op: '∘', order: '4.3 × 10¹⁹', abelian: false,
      zh: '本文的主角', en: 'the subject of this essay' },
  ];

  return (
    <div className="gt-examples">
      <div className="gt-example-row gt-example-head">
        <div>{tr({ zh: '群', en: 'Group' })}</div>
        <div>{tr({ zh: '运算', en: 'Op.'
        })}</div>
        <div>{tr({ zh: '阶', en: 'Order'
        })}</div>
        <div>{tr({ zh: '阿贝尔', en: 'Abel.'
        })}</div>
      </div>
      {examples.map((ex, i) => (
        <div className="gt-example-row" key={i}>
          <div className="gt-example-name">{ex.name}</div>
          <div>
            <span className="gt-mono">{ex.op}</span>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 4 }}>{tr(ex)}</div>
          </div>
          <div className="gt-mono" style={{ fontFamily: 'var(--mono)' }}>{ex.order}</div>
          <div className={`gt-example-abelian ${ex.abelian ? 'gt-example-abelian-yes' : 'gt-example-abelian-no'}`}>
            {ex.abelian ? tr({ zh: '是', en: 'yes' }) : tr({ zh: '否', en: 'no' })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Unfolded cube map (§3) ────────────────────────────────────────────────

export default function WhatIsAGroup() {
  return (
      <GTSec id="what-is-a-group" className="gt-sec">
        <div className="gt-sec-num">§1</div>
        <h2 className="gt-sec-title">
          <L zh="什么是群" en="What is a group?" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>当我们说魔方是「一个群」时,我们不是在打比方。<strong>群</strong> 在现代代数里是有精确定义的数学对象。它的定义只有 <strong>四条公理</strong> —— 而魔方所有 6 个面的全部转法,跟「先做 a 再做 b」这个复合运算放一起,正好满足这四条。</>}
            en={<>When we say the Rubik's Cube "is a group," it is not a metaphor. A <strong>group</strong> in modern algebra is a precise mathematical object defined by <strong>four axioms</strong>. The set of all cube moves, with the operation "do <em>a</em> then do <em>b</em>," satisfies all four exactly.</>}
          />
        </p>
        <AxiomTable />
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 1.1', en: 'Definition 1.1'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>一个 <strong>群</strong> 是一个集合 <TeX src={`G`} />,配上一个二元运算 <TeX src={`\\cdot : G \\times G \\to G`} />,满足上面四条公理。如果同时还满足 <em>交换律</em> <TeX src={`a \\cdot b = b \\cdot a`} />,我们称之为 <strong>阿贝尔群 (Abelian group)</strong>。</>}
              en={<>A <strong>group</strong> is a set <TeX src={`G`} /> equipped with a binary operation <TeX src={`\\cdot : G \\times G \\to G`} /> satisfying the four axioms above. If additionally <TeX src={`a \\cdot b = b \\cdot a`} /> (the <em>commutative law</em>) holds, we call it an <strong>Abelian group</strong>.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>魔方群 <strong>不</strong> 是阿贝尔的:做 <span className="gt-mono">R</span> 然后做 <span className="gt-mono">U</span>,跟做 <span className="gt-mono">U</span> 然后做 <span className="gt-mono">R</span>,得到不一样的状态。整本魔方理论的一半内容,本质上是在量度「这种不交换的程度」—— 换位子 (§9) 就是为此而生。</>}
            en={<>The cube group is <strong>not</strong> Abelian: <span className="gt-mono">R</span> then <span className="gt-mono">U</span> gives a different state from <span className="gt-mono">U</span> then <span className="gt-mono">R</span>. Half of cube theory is, in essence, measuring exactly how far from commutative things are — that is the role of commutators (§9).</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="1.1  其它常见的群" en="1.1  Other common groups" />
        </h3>
        <p>
          <L
            zh={<>群在数学里无处不在。把整数、矩阵、对称变换、置换、复根、几何变换 …… 列出来,几乎所有「自然有逆」的运算结构都是群:</>}
            en={<>Groups are ubiquitous. Listing them — integers, matrices, symmetries, permutations, complex roots, geometric transformations — almost every natural structure with "inverses" forms a group:</>}
          />
        </p>
        <GroupExamplesTable />
        <p>
          <L
            zh={<>注意 <TeX src={`|G| = 4.3 \\times 10^{19}`} /> —— 介于「物理可观察」(地球总人口) 和「物理不可观察」(可观宇宙原子) 之间。这个尺度是魔方让群论既具体又惊人的关键原因。</>}
            en={<>Notice <TeX src={`|G| = 4.3 \\times 10^{19}`} /> sits between "physically observable" (humanity's population) and "physically unimaginable" (atoms in the universe). That scale is exactly why the cube is such a compelling concrete example.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="1.2  阿贝尔 vs 非阿贝尔" en="1.2  Abelian vs non-Abelian" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 1.2', en: 'Definition 1.2'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>一个群 <TeX src={`G`} /> 叫 <strong>阿贝尔群</strong>(Abelian)如果它的运算可交换:对所有 <TeX src={`a, b \\in G`} />, <TeX src={`ab = ba`} />。否则是非阿贝尔的。</>}
              en={<>A group <TeX src={`G`} /> is <strong>Abelian</strong> if its operation commutes: <TeX src={`ab = ba`} /> for all <TeX src={`a, b \\in G`} />. Otherwise it is <em>non-Abelian</em>.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>「Abelian」纪念挪威数学家 Niels Henrik Abel (1802–1829)。他二十几岁就证明了五次方程没有根式解 —— 那个证明的核心,就是阿贝尔群理论。</>}
            en={<>"Abelian" honours the Norwegian mathematician Niels Henrik Abel (1802–1829), who in his early twenties proved that the general quintic equation has no radical solution — a result that relied on the structure of Abelian groups.</>}
          />
        </p>
        <p>
          <L
            zh={<>魔方群非阿贝尔,这件事在解魔方时无处不在:每一个高级技巧都在「绕过非阿贝尔性」(共轭)或「利用非阿贝尔性」(换位子)。如果魔方真的可交换,那本质上就是一个 6 个独立轮子,30 秒不到就解开了,也就不会有比赛。</>}
            en={<>That the cube group is non-Abelian permeates every aspect of solving. Every advanced technique is either "side-stepping non-commutativity" (conjugation) or "exploiting it" (commutators). If the cube were Abelian, it would be six independent dials, solvable in seconds — and there would be no sport.</>}
          />
        </p>
        <div className="gt-pullquote">
          <L
            zh={<>「群论的中心思想是 <em>对称</em>。一个群就是一个对象的所有对称变换的集合 —— 而对称是数学最普遍的概念之一。」</>}
            en={<>"The central idea of group theory is <em>symmetry</em>. A group is the set of symmetries of an object — and symmetry is one of the most general concepts in mathematics."</>}
          />
          <div className="gt-pullquote-cite">— a common opening of any abstract-algebra textbook</div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="1.3  四公理速查表" en="1.3  Axioms in one row each" />
        </h3>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '公理', en: 'Axiom' })}</th><th>{tr({ zh: '公式', en: 'Formula' })}</th><th>{tr({ zh: '魔方含义', en: 'Cube meaning'
            })}</th></tr>
          </thead>
          <tbody>
            <tr><td>{tr({ zh: 'G1 封闭', en: 'G1 closure'
            })}</td><td><TeX src={`a, b \\in G \\Rightarrow ab \\in G`} /></td><td>{tr({ zh: '面转复合仍是面转复合', en: 'composition of moves is a move'
            })}</td></tr>
            <tr><td>{tr({ zh: 'G2 结合', en: 'G2 associativity'
            })}</td><td><TeX src={`(ab)c = a(bc)`} /></td><td>{tr({ zh: '括号无效,序列才有意义', en: 'bracketing irrelevant, sequence is what matters'
            })}</td></tr>
            <tr><td>{tr({ zh: 'G3 单位', en: 'G3 identity'
            })}</td><td><TeX src={`\\exists\\, e:\\; ea = ae = a`} /></td><td>{tr({ zh: '不动魔方就是空操作', en: 'doing nothing is the empty alg'
            })}</td></tr>
            <tr><td>{tr({ zh: 'G4 逆', en: 'G4 inverse' })}</td><td><TeX src={`\\forall a\\, \\exists a^{-1}:\\; aa^{-1} = e`} /></td><td>{tr({ zh: '每个 alg 都可撤销', en: 'every alg can be undone'
            })}</td></tr>
          </tbody>
        </table>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="1.4  非魔方的群例子" en="1.4  Non-cube groups, briefly" />
        </h3>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '群', en: 'Group' })}</th><th>{tr({ zh: '阶', en: 'Order'
            })}</th><th>{tr({ zh: '阿贝尔', en: 'Abelian'
            })}</th><th>{tr({ zh: '与魔方的关系', en: 'Cube analogy'
            })}</th></tr>
          </thead>
          <tbody>
            <tr><td><TeX src={`(\\mathbb{Z}, +)`} /></td><td className="num">∞</td><td>{tr({ zh: '是', en: 'yes' })}</td><td>{tr({ zh: '只考虑 U 转累计角度的「无限版本」', en: 'an infinite analogue of "U turns piling up"'
            })}</td></tr>
            <tr><td><TeX src={`\\mathbb{Z}/n`} /></td><td className="num">n</td><td>{tr({ zh: '是', en: 'yes' })}</td><td><TeX src={`\\langle U\\rangle \\cong \\mathbb{Z}/4`} /></td></tr>
            <tr><td><TeX src={`S_n`} /></td><td className="num">n!</td><td>{tr({ zh: '否 (n≥3)', en: 'no (n≥3)' })}</td><td>{tr({ zh: '魔方角块嵌入 S₈,棱块嵌入 S₁₂', en: 'corners → S₈, edges → S₁₂'
            })}</td></tr>
            <tr><td><TeX src={`A_n`} /></td><td className="num">n!/2</td><td>{tr({ zh: '否 (n≥4)', en: 'no (n≥4)' })}</td><td>{tr({ zh: '换位子子群 [G,G] 内有 A₈ × A₁₂ 投影', en: '[G,G] projects onto A₈ × A₁₂'
            })}</td></tr>
            <tr><td><TeX src={`GL_n(\\mathbb{R})`} /></td><td className="num">∞</td><td>{tr({ zh: '否', en: 'no' })}</td><td>{tr({ zh: '面转可写成 48×48 置换矩阵', en: 'face turns sit inside GL₄₈(ℤ)'
            })}</td></tr>
            <tr><td><TeX src={`Q_8`} /></td><td className="num">8</td><td>{tr({ zh: '否', en: 'no' })}</td><td>{tr({ zh: '四元数群,非阿贝尔最小例之一', en: 'quaternion group — smallest non-Abelian non-dihedral example'
            })}</td></tr>
            <tr><td><TeX src={`F_2 = \\langle a, b \\rangle`} /></td><td className="num">∞</td><td>{tr({ zh: '否', en: 'no' })}</td><td>{tr({ zh: '两元自由群 — 魔方 ⟨R, U⟩ 在前 ~20 步内同自由群难以区分', en: 'rank-2 free group — ⟨R, U⟩ behaves like F₂ until depth ~20'
            })}</td></tr>
          </tbody>
        </table>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="1.5  群作为范畴里的对象" en="1.5  Groups as objects in a category" />
        </h3>
        <p>
          <L
            zh={<>更现代的视角:把 <strong>所有群</strong> 摆在一个范畴 <TeX src={`\\mathbf{Grp}`} /> 里。 对象 = 群, 态射 = 群同态。 <em>子群</em>(§2.3) 是 <TeX src={`H \\hookrightarrow G`} /> 这样的单态射, <em>商群</em>(§7) 是 <TeX src={`G \\twoheadrightarrow G/N`} /> 的满态射, <em>正规子群</em> 是「能造商」的子群。这套语言让 「群论中的所有定理」 都能翻译为 「范畴里的图」: 第一同构定理就是<TeXBlock src={`G \\twoheadrightarrow G/\\ker \\varphi \\xrightarrow{\\;\\sim\\;} \\operatorname{im}\\varphi \\hookrightarrow H.`} /></>}
            en={<>The modern view: gather <strong>all groups</strong> into a category <TeX src={`\\mathbf{Grp}`} />. Objects are groups, morphisms are group homomorphisms. A <em>subgroup</em> (§2.3) is a monomorphism <TeX src={`H \\hookrightarrow G`} />, a <em>quotient</em> (§7) is an epimorphism <TeX src={`G \\twoheadrightarrow G/N`} />, and a <em>normal subgroup</em> is precisely a subgroup admitting a quotient. The First Isomorphism Theorem becomes the diagram<TeXBlock src={`G \\twoheadrightarrow G/\\ker \\varphi \\xrightarrow{\\;\\sim\\;} \\operatorname{im}\\varphi \\hookrightarrow H.`} /></>}
          />
        </p>
        <p>
          <L
            zh={<>这跟魔方求解器实际架构吻合: 每一阶段 <TeX src={`G_i \\to G_{i+1}`} /> 就是 <TeX src={`\\mathbf{Grp}`} /> 里的一个箭头, 整个 Thistlethwaite 链就是链复合 <TeX src={`G_0 \\to G_1 \\to G_2 \\to G_3 \\to \\{e\\}`} />。</>}
            en={<>This matches the architecture of a cube solver: each phase <TeX src={`G_i \\to G_{i+1}`} /> is a single arrow in <TeX src={`\\mathbf{Grp}`} />, and the Thistlethwaite chain is the composite <TeX src={`G_0 \\to G_1 \\to G_2 \\to G_3 \\to \\{e\\}`} />.</>}
          />
        </p>
      </GTSec>
  );
}
