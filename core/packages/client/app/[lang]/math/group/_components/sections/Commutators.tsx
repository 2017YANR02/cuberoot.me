'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { applyAlg, commutator, isSolved, cycleStructure, identity } from '../cube_state';
import { tr } from '@/i18n/tr';
import { TwistyMini } from '../TwistyMini';
import { formatCycle, type FaceLetterChar } from '../gt-helpers';

function CommutatorViewer() {
  const lang = useLang();
  const [a, setA] = useState("R U R'");
  const [b, setB] = useState("D");
  const full = useMemo(() => commutator(a, b), [a, b]);

  const stateResult = useMemo(() => {
    try {
      const s = applyAlg(identity(), full);
      return {
        solved: isSolved(s),
        cornerCycles: cycleStructure(s.cp),
        edgeCycles: cycleStructure(s.ep),
        coTouched: s.co.filter(v => v !== 0).length,
        eoTouched: s.eo.filter(v => v !== 0).length,
      };
    } catch { return null; }
  }, [full]);

  const presets: { a: string; b: string; name: string; zh: string; en: string
 }[] = [
    { a: "R U R'", b: "D",            name: "edge 3-cycle",     zh: '棱块 3-循环', en: 'edge 3-cycle'
    },
    { a: "[R, U]", b: "[U, R]",       name: "wrong (nested)",   zh: '嵌套例', en: 'nested example'
    },
    { a: "U R U'", b: "L'",          name: "corner 3-cycle",   zh: '角块 3-循环', en: 'corner 3-cycle'
    },
    { a: "R",     b: "U",            name: "the sexy",         zh: '小鱼起手', en: 'sexy'
    },
    { a: "M",     b: "U",            name: "M-slice cycle",    zh: 'M 切片循环', en: 'M-slice cycle'
    },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 换位子 [A, B] = A B A⁻¹ B⁻¹', en: 'Interactive § Commutator [A, B] = A B A⁻¹ B⁻¹'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '换位子是高级解法的灵魂。它衡量「A 和 B 互不交换的程度」—— 如果它们交换,[A, B] = e。', en: 'The commutator measures how far A and B fail to commute. If they commute, [A, B] = e.'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>A</label>
        <input className="gt-input" value={a} onChange={e => setA(e.target.value)} />
      </div>
      <div className="gt-panel-input-row">
        <label>B</label>
        <input className="gt-input" value={b} onChange={e => setB(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        {presets.filter(p => !p.a.includes('[')).map((p, i) => (
          <span key={i} className="gt-chip" onClick={() => { setA(p.a); setB(p.b); }}>
            [{p.a}, {p.b}]
          </span>
        ))}
      </div>

      <div className="gt-twisty-inline" style={{ maxWidth: 280, margin: '24px auto 12px' }}>
        <TwistyMini key={full} alg={full} />
      </div>

      {stateResult && (
        <div className="gt-panel-result">
          <div className="gt-result-row">
            <div className="gt-result-label">{tr({ zh: '完整公式', en: 'expanded' })}</div>
            <div className="gt-result-val-strong">{full}</div>
          </div>
          <div className="gt-result-row">
            <div className="gt-result-label">{tr({ zh: '是否单位元', en: 'identity?'
            })}</div>
            <div className="gt-result-val">{stateResult.solved ? tr({ zh: '是 (A, B 互换)', en: 'yes (A and B commute)'
                                  }) : tr({ zh: '否', en: 'no' })}</div>
          </div>
          <div className="gt-result-row">
            <div className="gt-result-label">{tr({ zh: '角块循环型', en: 'corner cycles'
            })}</div>
            <div className="gt-result-val">{formatCycle(stateResult.cornerCycles, lang)}</div>
          </div>
          <div className="gt-result-row">
            <div className="gt-result-label">{tr({ zh: '棱块循环型', en: 'edge cycles'
            })}</div>
            <div className="gt-result-val">{formatCycle(stateResult.edgeCycles, lang)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── §9.3 CentreVerifier — does this alg commute with all 6 face turns? ────

// ── §9.3 CentreVerifier — does this alg commute with all 6 face turns? ────
function CentreVerifier() {
  const lang = useLang();
  const [alg, setAlg] = useState("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");

  const faces: FaceLetterChar[] = ['U', 'D', 'L', 'R', 'F', 'B'];
  const result = useMemo(() => {
    try {
      const checks = faces.map(f => {
        // g X g' X' — if identity, then g and X commute.
        const state = applyAlg(identity(), commutator(alg, f));
        return { face: f, commutes: isSolved(state) };
      });
      const all = checks.every(c => c.commutes);
      return { checks, inCentre: all };
    } catch { return null; }
  }, [alg]);

  const presets: { label: string; alg: string }[] = [
    { label: 'e (identity)', alg: '' },
    { label: 'superflip', alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" },
    { label: 'R', alg: 'R' },
    { label: 'R U R\' U\'', alg: "R U R' U'" },
    { label: 'U2 D2', alg: 'U2 D2' },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 中心验证 — g 是否跟所有面转交换?', en: 'Interactive § Centre check — does g commute with every face turn?'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '逐个验证 [g, X] = e 对 6 个生成元成立 ⇔ g ∈ Z(G)。理论已证 Z(G) = {e, superflip} 阶 2。', en: 'For each face turn X, check [g, X] = e. If all six pass, then g ∈ Z(G). Theory says Z(G) = {e, superflip} of order 2.'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>g</label>
        <input className="gt-input" value={alg} onChange={e => setAlg(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
        {presets.map(p => (
          <span key={p.label} className="gt-chip" onClick={() => setAlg(p.alg)}>{p.label}</span>
        ))}
      </div>
      <div className="gt-centre-grid">
        {result?.checks.map(({ face, commutes }) => (
          <div key={face} className={`gt-centre-cell ${commutes ? 'gt-centre-ok' : 'gt-centre-bad'}`}>
            <div className="gt-centre-face">{face}</div>
            <div className="gt-centre-status">{commutes ? '✓' : '✗'}</div>
            <div className="gt-centre-detail">[g, {face}] {commutes ? '= e' : '≠ e'}</div>
          </div>
        ))}
      </div>
      <div className={`gt-inv-final ${result?.inCentre ? '' : 'gt-inv-final-bad'}`}>
        {result?.inCentre
          ? tr({ zh: '✓ g ∈ Z(G) — 跟全部 6 个面转都交换', en: '✓ g ∈ Z(G) — commutes with every face turn'
                          })
          : (lang === 'zh' ? '✗ g ∉ Z(G)' : '✗ g ∉ Z(G)')}
      </div>
    </div>
  );
}

function CommutatorAtoms() {
  const lang = useLang();
  const examples: { a: string; b: string; nameZh: string; nameEn: string; descZh: string; descEn: string
 }[] = [
    { a: "R U R'", b: 'D', nameZh: '棱块 3-循环 (UD 面)', nameEn: 'Edge 3-cycle (UD-axis)',
      descZh: '只动 3 个棱块, 其它 17 个件不变', descEn: 'moves 3 edges, fixes the other 17 cubies'
    },
    { a: "R'", b: 'D', nameZh: '角块 3-循环', nameEn: 'Corner 3-cycle',
      descZh: '只动 3 个角块', descEn: 'moves 3 corners only'
    },
    { a: "M'", b: 'U', nameZh: 'M 切片棱循环', nameEn: 'M-slice edge cycle',
      descZh: '切片 + U 的复合 3-循环', descEn: 'slice-then-U commutator'
    },
    { a: "F R F'", b: 'U', nameZh: 'F 槽换棱', nameEn: 'F-slot edge swap',
      descZh: '改 F2L pair 的局部 3-循环', descEn: 'a localized 3-cycle near the F2L slot'
    },
  ];
  return (
    <div className="gt-recipes">
      {examples.map((ex, i) => {
        const expansion = commutator(ex.a, ex.b);
        return (
          <div key={i} className="gt-recipe" style={{ padding: '14px 16px' }}>
            <div className="gt-recipe-title">[{ex.a}, {ex.b}]</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 6 }}>{lang === 'zh' ? ex.nameZh : ex.nameEn}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', marginTop: 4 }}>{expansion}</div>
            <div style={{ marginTop: 10, aspectRatio: 1, maxHeight: 120 }}><TwistyMini alg={expansion} /></div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 8, fontStyle: 'italic' }}>{lang === 'zh' ? ex.descZh : ex.descEn}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Cayley walker — interactive BFS on the cube's Cayley graph (§14) ─────
// User clicks 18 generators (U U' U2 D D' D2 ... B2). Each click extends the
// current path g by one generator. Twisty player shows the state and we display:
//   - path length (= upper bound on graph distance from e)
//   - whether g = e currently (back-home indicator)
//   - distance-1 neighbours and which ones revisit cancellation states
// All state computation stays in cube_state.ts; no external solver.

export default function Commutators() {
  return (
      <GTSec id="commutators" className="gt-sec">
        <div className="gt-sec-num">§9</div>
        <h2 className="gt-sec-title">
          <L zh="换位子 [A, B] — 高级解法的灵魂" en="Commutators [A, B] — the soul of advanced solving" />
        </h2>
        <p>
          <L
            zh={<>对两个操作 <TeX src={`A, B`} />,我们定义它们的 <strong>换位子</strong> 为:</>}
            en={<>For two operations <TeX src={`A, B`} />, their <strong>commutator</strong> is defined as:</>}
          />
        </p>
        <TeXBlock src={`[A, B] \\;:=\\; A \\cdot B \\cdot A^{-1} \\cdot B^{-1}`} />
        <p>
          <L
            zh={<>如果 <TeX src={`A`} /> 和 <TeX src={`B`} /> 互换 (<TeX src={`AB = BA`} />),那么 <TeX src={`[A, B] = e`} />。 所以换位子衡量「A 和 B 互不交换的程度」。 在阿贝尔群里所有换位子都是单位元 —— 魔方群当然不是。</>}
            en={<>If <TeX src={`A`} /> and <TeX src={`B`} /> commute, <TeX src={`[A, B] = e`} />. The commutator measures how far they fail to commute. In an Abelian group all commutators are trivial — but the cube group is decisively non-Abelian.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '为什么换位子如此有用?', en: 'Why commutators are so powerful'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>当 <TeX src={`A`} /> 和 <TeX src={`B`} /> 的「影响区域」 <em>大体不重叠</em> 但 <em>有一处接触</em> 时, 换位子 <TeX src={`[A, B]`} /> 把接触点附近一两个块循环, 其他全部完整保留。 这就是 <strong>3-循环</strong>:盲拧、 还原 (FMC) 的核心积木。<br /><br />例如 <TeX src={`[R\\, U\\, R',\\, D]`} /> 是个干净的 3-循环棱块。 从 <TeX src={`8! \\cdot 12! \\cdot 3^8 \\cdot 2^{12}`} /> 这么大的群中, 提取出只动 3 个块的操作 —— 这是换位子做到的近乎魔法般的事。</>}
              en={<>When <TeX src={`A`} /> and <TeX src={`B`} /> <em>nearly</em> overlap — affecting mostly disjoint pieces but sharing one or two — <TeX src={`[A, B]`} /> cycles those few pieces while leaving everything else untouched. This is the <strong>3-cycle</strong>: the elementary atom of blindsolving and FMC.<br /><br />For example, <TeX src={`[R\\, U\\, R',\\, D]`} /> is a clean edge 3-cycle. Extracting an operation that moves only 3 pieces out of a group of size <TeX src={`8! \\cdot 12! \\cdot 3^8 \\cdot 2^{12}`} /> is the near-magical thing commutators do.</>}
            />
          </div>
        </div>
        <CommutatorViewer />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="9.1  换位子原子库" en="9.1  Commutator atom library" />
        </h3>
        <p>
          <L
            zh={<>下面是 4 个典型「3-循环换位子」 —— 都只动 3 个魔方件。盲拧选手把它们当字母表用,任何状态都可由这种 3-循环序列还原。</>}
            en={<>Four typical 3-cycle commutators — each moves exactly 3 cubies. Blindsolvers treat them as an alphabet: any state can be reduced to a sequence of 3-cycles.</>}
          />
        </p>
        <CommutatorAtoms />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="9.2  换位子子群 [G, G]" en="9.2  The commutator subgroup [G, G]" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 9.1', en: 'Definition 9.1'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>群 <TeX src={`G`} /> 的 <strong>换位子子群</strong>(又叫 <em>derived subgroup</em>)是:</>}
              en={<>The <strong>commutator subgroup</strong> (also called <em>derived subgroup</em>) of G is:</>}
            />
            <TeXBlock src={`[G, G] \\;=\\; \\langle\\, \\{\\, [a, b] : a, b \\in G \\,\\} \\,\\rangle`} />
            <L
              zh={<>由所有换位子生成的子群。 商群 <TeX src={`G / [G, G]`} /> 是 G 「最大的阿贝尔商」 — 把所有非阿贝尔性都抹去后剩下的部分。</>}
              en={<>The subgroup generated by all commutators. The quotient <TeX src={`G / [G, G]`} /> is G's <em>largest Abelian quotient</em> — what remains after stripping out all non-commutativity.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对魔方群: <TeX src={`G / [G, G] \\cong \\mathbb{Z}/2`} />。 这告诉我们 G 的 <em>非阿贝尔性几乎是「全部」</em> —— 唯一的阿贝尔信息是「角棱奇偶性」(一个 <TeX src={`\\mathbb{Z}/2`} /> 比特)。 换言之, <TeX src={`[G, G]`} /> 本身阶为 <TeX src={`|G| / 2 \\approx 2.16 \\times 10^{19}`} />。</>}
            en={<>For the cube group: <TeX src={`G / [G, G] \\cong \\mathbb{Z}/2`} />. This means G's <em>non-Abelian structure is almost everything</em> — the only Abelian information is the parity bit. Equivalently, <TeX src={`[G, G]`} /> itself has order <TeX src={`|G| / 2 \\approx 2.16 \\times 10^{19}`} />.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '推论 9.2', en: 'Corollary 9.2'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>偶置换 (sgn = +1) 的所有魔方状态恰好等于 [G, G]。所以 <strong>任何偶置换状态都能写成换位子的有限乘积</strong>。这就是为什么换位子语言对盲拧如此核心 —— 它把所有「无奇偶问题」的状态都拆解为基本积木。</>}
              en={<>The set of all even-parity states (sgn = +1) equals [G, G]. So <strong>every parity-correct state can be written as a finite product of commutators</strong>. This is precisely why the commutator language is so central to blindsolving: it decomposes every reasonable state into elementary atoms.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="9.3  换位子与「中心」" en="9.3  Commutators and the centre" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 9.3 — 中心', en: 'Definition 9.3 — centre'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>群的 <strong>中心</strong>:<TeXBlock src={`Z(G) \\;=\\; \\{\\, z \\in G \\;:\\; zg = gz \\;\\forall\\, g \\in G \\,\\}.`} />即跟所有元素都交换的子集。</>}
              en={<>The <strong>centre</strong> of a group:<TeXBlock src={`Z(G) \\;=\\; \\{\\, z \\in G \\;:\\; zg = gz \\;\\forall\\, g \\in G \\,\\}.`} />The elements that commute with everything.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对阿贝尔群: <TeX src={`Z(G) = G`} />。 对极端非阿贝尔群: <TeX src={`Z(G) = \\{e\\}`} /> (只有单位元)。</>}
            en={<>For Abelian groups: <TeX src={`Z(G) = G`} />. For sharply non-Abelian groups: <TeX src={`Z(G) = \\{e\\}`} /> only.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 9.4', en: 'Theorem 9.4' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>魔方群的中心 <TeX src={`Z(G) = \\{e,\\,\\text{superflip}\\}`} />, 阶为 2。 即 <strong>仅有 superflip 和 identity 跟所有面转都交换</strong>。 superflip 是「12 个棱全翻」那个状态, 它本身是阶 2 元素。</>}
              en={<>The cube group's centre is <TeX src={`Z(G) = \\{e,\\,\\text{superflip}\\}`} />, of order 2. Only the identity and superflip commute with every face turn.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个事实有点不可思议:在 4.3 × 10¹⁹ 个状态里,只有 <strong>两个</strong> 状态跟所有人都「和气共处」, 而其中之一是大家熟悉的 superflip(也是著名的 20 步极限状态之一)。</>}
            en={<>This is a striking fact: among 4.3 × 10¹⁹ states, exactly <strong>two</strong> commute with all face turns — one being the celebrated superflip (also among the famous 20-step extremal positions).</>}
          />
        </p>
        <CentreVerifier />
        <div className="gt-proof">
          <div className="gt-proof-title">{tr({ zh: '为什么 Z(G) 只有 2 个元素?', en: 'Why |Z(G)| = 2'
        })}</div>
          <L
            zh={<>
              <p style={{ margin: '0 0 12px' }}>设 <TeX src={`g \\in Z(G)`} />。 则 g 跟每个面转都交换 ⇔ g 在 cube symmetry group 下不变 ⇔ g 在 48 个外部对称下也不变 (因为 G 由面转生成, 且面转生成的对称变换闭包 = 整个外部对称群)。</p>
              <p style={{ margin: '0 0 12px' }}>反过来, 任何「在 48 个外部对称下不变」的 G 元素必须满足: 角块循环型和棱块循环型均「自共轭于自身」。这只允许两种状态:</p>
              <ul style={{ paddingLeft: 24, margin: '0 0 12px' }}>
                <li>cp = identity, co = 0, ep = identity, eo = 0 → 单位元 e</li>
                <li>cp = identity, co = 0, ep = identity, eo = (1, 1, …, 1) → superflip</li>
              </ul>
              <p style={{ margin: '0 0 0' }}>因此 Z(G) = {`{e, superflip}`}, |Z(G)| = 2。</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Let g ∈ Z(G). Then g commutes with every face turn ⇔ g is invariant under conjugation by the symmetry group generated by face turns ⇔ g is invariant under all 48 outer cube symmetries (since face turns generate the full symmetry closure).</p>
              <p style={{ margin: '0 0 12px' }}>Conversely, any element of G fixed under all 48 outer symmetries must have a cycle type that is "self-symmetric" under all those rotations and reflections. This allows only two states:</p>
              <ul style={{ paddingLeft: 24, margin: '0 0 12px' }}>
                <li>cp = identity, co = 0, ep = identity, eo = 0 — the identity e</li>
                <li>cp = identity, co = 0, ep = identity, eo = (1, 1, …, 1) — superflip</li>
              </ul>
              <p style={{ margin: '0 0 0' }}>So Z(G) = {`{e, superflip}`} and |Z(G)| = 2.</p>
            </>}
          />
          <div className="gt-proof-end">∎</div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="9.4  Hall–Witt 恒等式" en="9.4  The Hall–Witt identity" />
        </h3>
        <p>
          <L
            zh={<>换位子之间有一个非平凡的代数关系, 类似李代数的 Jacobi 恒等式。 设 <TeX src={`a^b := b^{-1} a b`} /> 表共轭:</>}
            en={<>Commutators satisfy a nontrivial algebraic relation analogous to the Jacobi identity for Lie algebras. Write <TeX src={`a^b := b^{-1} a b`} /> for conjugation:</>}
          />
        </p>
        <TeXBlock src={`\\bigl[[a, b^{-1}], c\\bigr]^{b} \\cdot \\bigl[[b, c^{-1}], a\\bigr]^{c} \\cdot \\bigl[[c, a^{-1}], b\\bigr]^{a} \\;=\\; e`} />
        <p>
          <L
            zh={<>这是 Philip Hall 与 Ernst Witt 在 1930s 各自证明的恒等式。 它说: 「三次嵌套的换位子在循环置换 a → b → c → a 下相乘为单位元」。 对魔方,任取 a = R、b = U、c = F,这个恒等式自动成立 — 给出一个 18-token 长的 alg 必然等于 e (虽然它通常不简化为可读的形式)。</>}
            en={<>Independently proven by Philip Hall and Ernst Witt in the 1930s. It says "three nested commutators, cycled a → b → c → a, multiply to the identity." For the cube, plug a = R, b = U, c = F: the identity holds automatically, giving an 18-token alg that necessarily equals e (though typically without a clean reduction).</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="9.5  Derived series — [G, G] 之后是什么?" en="9.5  Derived series — what's after [G, G]?" />
        </h3>
        <p>
          <L
            zh={<>定义 <strong>derived series</strong>: <TeX src={`G^{(0)} = G`} />, <TeX src={`G^{(k+1)} = [G^{(k)}, G^{(k)}]`} />。 它给出一条递降链 <TeX src={`G \\supseteq G' \\supseteq G'' \\supseteq \\cdots`} />。 一个群叫 <strong>可解</strong> 若这条链有限地达到 <TeX src={`\\{e\\}`} />。</>}
            en={<>Define the <strong>derived series</strong>: <TeX src={`G^{(0)} = G`} />, <TeX src={`G^{(k+1)} = [G^{(k)}, G^{(k)}]`} />, giving a descending chain <TeX src={`G \\supseteq G' \\supseteq G'' \\supseteq \\cdots`} />. A group is <strong>solvable</strong> if this chain reaches <TeX src={`\\{e\\}`} /> in finitely many steps.</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '层', en: 'Term'
            })}</th><th>{tr({ zh: '定义', en: 'Definition'
            })}</th><th>{tr({ zh: '阶 (魔方)', en: 'Cube order'
            })}</th></tr>
          </thead>
          <tbody>
            <tr><td><TeX src={`G^{(0)} = G`} /></td><td>{tr({ zh: '魔方群', en: 'cube group' })}</td><td className="num">4.33 × 10¹⁹</td></tr>
            <tr><td><TeX src={`G^{(1)} = [G, G]`} /></td><td>{tr({ zh: '偶置换状态', en: 'even-parity states'
            })}</td><td className="num">|G|/2 ≈ 2.16 × 10¹⁹</td></tr>
            <tr><td><TeX src={`G^{(2)} = [G', G']`} /></td><td>{tr({ zh: 'CO+EO=0 的偶状态 (A₈ × A₁₂ 投影)', en: 'even states with CO=EO=0 (A₈ × A₁₂ projection)'
            })}</td><td className="num">≈ 9.65 × 10¹⁵</td></tr>
            <tr><td><TeX src={`G^{(3)}`} /></td><td>{tr({ zh: 'A₈ 与 A₁₂ 各自的换位子子群 (它们是单群,自换位 = 自身)', en: 'commutator subgroups of A₈ and A₁₂ — both simple, so equal themselves'
            })}</td><td className="num">≈ 9.65 × 10¹⁵</td></tr>
            <tr><td><TeX src={`G^{(k)}, k \\geq 3`} /></td><td>{tr({ zh: '不再下降', en: 'stabilises (no further descent)' })}</td><td className="num">≈ 9.65 × 10¹⁵</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>因为 A₈ 和 A₁₂ 都是单非 Abel 群 (Jordan 1875), 它们都满足 <TeX src={`[A_n, A_n] = A_n`} /> (n ≥ 5)。 derived series 在 <TeX src={`G^{(2)}`} /> 后稳定, 所以<strong>魔方群不是可解群</strong>。 这个事实非平凡: 它意味着无法用 「迭代换位子打到 0」 的方式构造一个 「单 Abelian 步」 的求解器 — 必须依靠 §10 的多阶段子群链或 §22 的全局搜索。</>}
            en={<>Since A₈ and A₁₂ are simple non-Abelian groups (Jordan 1875), <TeX src={`[A_n, A_n] = A_n`} /> for n ≥ 5. The derived series stabilises at <TeX src={`G^{(2)}`} />, so <strong>the cube group is not solvable</strong>. This is significant: there is no "iteratively kill the commutator" path to a one-stage Abelian solver — one must invoke the §10 subgroup chain or the §22 global search.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="9.6  Lower central series 与 nilpotent" en="9.6  Lower central series & nilpotency" />
        </h3>
        <p>
          <L
            zh={<>另一条相关的链是 <strong>lower central series</strong>: <TeX src={`\\gamma_1(G) = G`} />, <TeX src={`\\gamma_{k+1}(G) = [G, \\gamma_k(G)]`} />。 一个群叫 <strong>nilpotent</strong> 若这条链有限地达到 <TeX src={`\\{e\\}`} />。 nilpotent ⇒ solvable, 但反之不然。</>}
            en={<>The <strong>lower central series</strong>: <TeX src={`\\gamma_1(G) = G`} />, <TeX src={`\\gamma_{k+1}(G) = [G, \\gamma_k(G)]`} />. A group is <strong>nilpotent</strong> if this chain reaches <TeX src={`\\{e\\}`} /> in finitely many steps. Nilpotent ⇒ solvable, but not conversely.</>}
          />
        </p>
        <p>
          <L
            zh={<>魔方群 <strong>不是 nilpotent</strong>: 由 9.5 它甚至不是可解,更不可能 nilpotent。 直观地看: nilpotent 群 「换位子塔」 越爬越扁;而 G 的 lower central series 在 <TeX src={`\\gamma_2 = [G,G]`} /> 之后基本不再下降 (因为商投影到 A₈ × A₁₂)。 nilpotent 群最典型的例子是有限 p-群; 魔方群因为同时含 ℤ/3 和 ℤ/2 块,以及 A_n 的非可解部分, 跟 p-群相去甚远。</>}
            en={<>The cube group is <strong>not nilpotent</strong>: by 9.5 it is not even solvable, let alone nilpotent. Intuitively, nilpotent groups have a "commutator tower" that flattens out; the cube's lower central series barely descends past <TeX src={`\\gamma_2 = [G,G]`} /> because the quotient sits in A₈ × A₁₂. The archetypal nilpotent groups are finite p-groups — and G, mixing ℤ/3, ℤ/2 blocks with a non-solvable A_n core, is the opposite of a p-group.</>}
          />
        </p>
      </GTSec>
  );
}
