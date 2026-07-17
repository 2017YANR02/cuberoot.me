'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock } from '../primitives';
import { applyAlg, invariants, identity, CubieState } from '../cube_state';
import { tr } from '@/i18n/tr';

// ── §6 InvariantInspector ──────────────────────────────────────────────────
function InvariantInspector() {
  const [alg, setAlg] = useState("R U R' U'");
  const [breakCo, setBreakCo] = useState(false);
  const [breakEo, setBreakEo] = useState(false);
  const [swapEdges, setSwapEdges] = useState(false);

  const state = useMemo<CubieState>(() => {
    let s = identity();
    try { s = applyAlg(s, alg); } catch { /* fall-through */ }
    if (breakCo) s = { ...s, co: s.co.map((v, i) => i === 0 ? (v + 1) % 3 : v) };
    if (breakEo) s = { ...s, eo: s.eo.map((v, i) => i === 0 ? (v + 1) % 2 : v) };
    if (swapEdges) {
      const ep = s.ep.slice();
      [ep[0], ep[1]] = [ep[1], ep[0]];
      s = { ...s, ep };
    }
    return s;
  }, [alg, breakCo, breakEo, swapEdges]);

  const inv = invariants(state);

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 三个守恒律', en: 'Interactive § Three invariants'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '凡是合法的魔方状态都满足三条约束。手动破坏任何一条,状态就不可达 (即,无法仅靠 6 个面转出来)。', en: 'Every legal cube state satisfies three constraints. Manually break any one and the state is unreachable — no sequence of face turns can produce it.'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>alg</label>
        <input className="gt-input" value={alg} onChange={e => setAlg(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        <span className={`gt-chip ${breakCo ? 'gt-chip-active' : ''}`} onClick={() => setBreakCo(v => !v)}>
          {tr({ zh: '手扭角块 0', en: 'twist corner 0'
        })}
        </span>
        <span className={`gt-chip ${breakEo ? 'gt-chip-active' : ''}`} onClick={() => setBreakEo(v => !v)}>
          {tr({ zh: '手翻棱块 0', en: 'flip edge 0'
        })}
        </span>
        <span className={`gt-chip ${swapEdges ? 'gt-chip-active' : ''}`} onClick={() => setSwapEdges(v => !v)}>
          {tr({ zh: '交换两棱块', en: 'swap two edges'
        })}
        </span>
      </div>

      <div className="gt-inv-grid">
        <div className="gt-inv">
          <div className="gt-inv-label">Σ co (mod 3)</div>
          <div className={`gt-inv-val ${inv.coSum === 0 ? 'gt-inv-ok' : 'gt-inv-bad'}`}>{inv.coSum}</div>
        </div>
        <div className="gt-inv">
          <div className="gt-inv-label">Σ eo (mod 2)</div>
          <div className={`gt-inv-val ${inv.eoSum === 0 ? 'gt-inv-ok' : 'gt-inv-bad'}`}>{inv.eoSum}</div>
        </div>
        <div className="gt-inv">
          <div className="gt-inv-label">sgn(cp)</div>
          <div className={`gt-inv-val ${inv.cpSign === inv.epSign ? 'gt-inv-ok' : 'gt-inv-bad'}`}>{inv.cpSign === 1 ? '+1' : '−1'}</div>
        </div>
        <div className="gt-inv">
          <div className="gt-inv-label">sgn(ep)</div>
          <div className={`gt-inv-val ${inv.cpSign === inv.epSign ? 'gt-inv-ok' : 'gt-inv-bad'}`}>{inv.epSign === 1 ? '+1' : '−1'}</div>
        </div>
      </div>

      <div className={`gt-inv-final ${inv.reachable ? '' : 'gt-inv-final-bad'}`}>
        {inv.reachable
          ? tr({ zh: '✓ 可达 — 该状态是 G 的元素', en: '✓ Reachable — this state is in G'
                          })
          : tr({ zh: '✗ 不可达 — 该状态不在 G 中', en: '✗ Unreachable — this state is not in G'
                          })}
      </div>
    </div>
  );
}

// ── §7 PeriodExplorer ──────────────────────────────────────────────────────

export default function Invariants() {
  return (
      <GTSec id="invariants" className="gt-sec">
        <div className="gt-sec-num">§5</div>
        <h2 className="gt-sec-title">
          <L zh="三个守恒律 (可达性条件)" en="Three invariants (reachability conditions)" />
        </h2>
        <p>
          <L
            zh={<>哪些状态可以仅靠 6 个面转得到?恰好三条:</>}
            en={<>Which states are reachable by face turns alone? Exactly these three constraints determine it:</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 5.1 — 魔方第一定律', en: 'Theorem 5.1 — first law of cubology' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>一个状态 <TeX src={`(c_p, c_o, e_p, e_o)`} /> 可达 (即位于 G 中),当且仅当下面三件事同时成立:</>}
              en={<>A state <TeX src={`(c_p, c_o, e_p, e_o)`} /> is reachable (i.e. lies in G) if and only if all three hold:</>}
            />
            <div className="gt-inv-laws">
              <div className="gt-inv-law">
                <div className="gt-inv-law-num">(1)</div>
                <TeXBlock src={`\\sum_{i=1}^{8} c_o^{(i)} \\;\\equiv\\; 0 \\pmod 3`} />
                <div className="gt-inv-law-desc">{tr({ zh: '总角块拧角守恒', en: 'total corner twist conserved'
                })}</div>
              </div>
              <div className="gt-inv-law">
                <div className="gt-inv-law-num">(2)</div>
                <TeXBlock src={`\\sum_{i=1}^{12} e_o^{(i)} \\;\\equiv\\; 0 \\pmod 2`} />
                <div className="gt-inv-law-desc">{tr({ zh: '总棱块翻面守恒', en: 'total edge flip conserved'
                })}</div>
              </div>
              <div className="gt-inv-law">
                <div className="gt-inv-law-num">(3)</div>
                <TeXBlock src={`\\operatorname{sgn}(c_p) \\;=\\; \\operatorname{sgn}(e_p)`} />
                <div className="gt-inv-law-desc">{tr({ zh: '角棱奇偶联动', en: 'corner-edge parity coupling'
                })}</div>
              </div>
            </div>
          </div>
        </div>
        <p>
          <L
            zh={<>每条约束都直接对应一个被禁掉的物理操作:不能 <strong>单独扭一个角块</strong>(违反 1),不能 <strong>单独翻一个棱块</strong>(违反 2),也不能 <strong>只交换两个棱块</strong> 而不动角块(违反 3)。把魔方撬下来再插上去,就是绕过这些约束 —— 8 个角拧角任意 / 12 个棱翻面任意 / 棱角独立换位,共 12 倍的「平行宇宙」。</>}
            en={<>Each constraint forbids one physically intuitive move. You cannot <strong>twist a single corner</strong> (violates 1), <strong>flip a single edge</strong> (violates 2), or <strong>swap two edges without disturbing corners</strong> (violates 3). Popping the cube apart and reassembling it sidesteps these — 12 parallel "alternate universes" of unreachable states.</>}
          />
        </p>
        <InvariantInspector />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="5.1  CO 守恒律的证明" en="5.1  Proof: corner orientation sum is conserved" />
        </h3>
        <div className="gt-proof">
          <div className="gt-proof-title">{tr({ zh: '证明', en: 'Proof'
        })}</div>
          <L
            zh={<>
              <p style={{ margin: '0 0 12px' }}>要证: 任何面转 <TeX src={`X`} /> 应用后, <TeX src={`\\sum_i c_o^{(i)} \\equiv 0 \\pmod 3`} /> 在 G 中保持。</p>
              <p style={{ margin: '0 0 12px' }}>逐个验证 6 个生成元:</p>
              <ul style={{ paddingLeft: 24, margin: '0 0 12px' }}>
                <li><strong>U, D</strong>: 这两个面转把每个 U/D 层角块的「U/D 色块」继续保持在 U/D 面。所以 <TeX src={`\\Delta c_o^{(i)} = 0`} />,<TeX src={`\\sum \\Delta c_o = 0`} />。 ✓</li>
                <li><strong>R, L</strong>: R 把 4 个角块依次旋转。 URF → UBR: U-色块「上 → 前-上」, <TeX src={`+1 \\pmod 3`} />。 UBR → DRB: 「上 → 右」, <TeX src={`+2 \\pmod 3`} />。 同理 DRB → DFR 为 <TeX src={`+1`} />, DFR → URF 为 <TeX src={`+2`} />。 合计 <TeX src={`1 + 2 + 1 + 2 = 6 \\equiv 0 \\pmod 3`} />。 ✓</li>
                <li><strong>F, B</strong>: 类似地, F 转 4 个角块 CO 偏移之和也是 <TeX src={`6 \\equiv 0 \\pmod 3`} />。 ✓</li>
              </ul>
              <p style={{ margin: '0 0 12px' }}>结论: 每个生成元都让 <TeX src={`\\sum_i c_o^{(i)} \\pmod 3`} /> 不变, 因此其有限乘积 (即 G 中任意元素) 也保持这一不变量。</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Claim: applying any generator <TeX src={`X`} /> preserves <TeX src={`\\sum_i c_o^{(i)} \\pmod 3`} />.</p>
              <p style={{ margin: '0 0 12px' }}>Verify on the 6 generators:</p>
              <ul style={{ paddingLeft: 24, margin: '0 0 12px' }}>
                <li><strong>U, D</strong>: these cycle the four U-layer (or D-layer) corners while keeping the U-coloured sticker on the U/D face. So all four <TeX src={`\\Delta c_o = 0`} />. ✓</li>
                <li><strong>R, L</strong>: R cycles four corners. URF → UBR: U sticker rotates "up" → "front-up", <TeX src={`+1 \\pmod 3`} />. UBR → DRB: "up" → "right", <TeX src={`+2 \\pmod 3`} />. By symmetry DRB → DFR = <TeX src={`+1`} />, DFR → URF = <TeX src={`+2`} />. Total: <TeX src={`1 + 2 + 1 + 2 = 6 \\equiv 0 \\pmod 3`} />. ✓</li>
                <li><strong>F, B</strong>: similarly each contributes <TeX src={`\\Delta(\\sum c_o) = 6 \\equiv 0 \\pmod 3`} />. ✓</li>
              </ul>
              <p style={{ margin: '0 0 12px' }}>So every generator preserves <TeX src={`\\sum_i c_o^{(i)} \\pmod 3`} />, and so does any finite product.</p>
            </>}
          />
          <div className="gt-proof-end">∎</div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="5.2  EO 守恒律的证明" en="5.2  Proof: edge orientation sum is conserved" />
        </h3>
        <div className="gt-proof">
          <div className="gt-proof-title">{tr({ zh: '证明', en: 'Proof'
        })}</div>
          <L
            zh={<>
              <p style={{ margin: '0 0 12px' }}>要证: <TeX src={`\\sum_i e_o^{(i)} \\pmod 2`} /> 在 G 中保持。</p>
              <p style={{ margin: '0 0 12px' }}>U, D, R, L 不影响任何棱块的 EO。 F 和 B 各翻转 4 个棱块的 EO, 总变化 <TeX src={`\\Delta\\!\\sum e_o = 4 \\equiv 0 \\pmod 2`} />。 ✓</p>
              <p style={{ margin: '0 0 8px' }}>每个生成元 <TeX src={`\\Delta(\\sum e_o) \\equiv 0 \\pmod 2`} />, 故 <TeX src={`\\sum e_o \\pmod 2`} /> 是 G 不变量。</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Claim: <TeX src={`\\sum_i e_o^{(i)} \\pmod 2`} /> is preserved.</p>
              <p style={{ margin: '0 0 12px' }}>U, D, R, L do not affect any edge's EO (their stickers stay on the same {`{U/D, L/R}`} pair). F and B each flip 4 edges, contributing <TeX src={`\\Delta(\\sum e_o) = 4 \\equiv 0 \\pmod 2`} />. ✓</p>
              <p style={{ margin: '0 0 8px' }}>Every generator gives <TeX src={`\\equiv 0 \\pmod 2`} />, so <TeX src={`\\sum e_o`} /> is a G-invariant.</p>
            </>}
          />
          <div className="gt-proof-end">∎</div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="5.3  奇偶联动的证明" en="5.3  Proof: corner-edge parity coupling" />
        </h3>
        <div className="gt-proof">
          <div className="gt-proof-title">{tr({ zh: '证明', en: 'Proof'
        })}</div>
          <L
            zh={<>
              <p style={{ margin: '0 0 12px' }}>要证: <TeX src={`\\operatorname{sgn}(c_p) = \\operatorname{sgn}(e_p)`} /> 在 G 中保持 ⇔ 角块置换和棱块置换的奇偶性绑定。</p>
              <p style={{ margin: '0 0 12px' }}>每个面转的角块置换是一个 4-循环。 4-循环 = 3 个相邻 2-循环之积, 故 <TeX src={`\\operatorname{sgn} = (-1)^3 = -1`} />。 同理棱块置换也是 4-循环, <TeX src={`\\operatorname{sgn} = -1`} />。</p>
              <p style={{ margin: '0 0 12px' }}>所以每个生成元同时把 <TeX src={`\\operatorname{sgn}(c_p)`} /> 和 <TeX src={`\\operatorname{sgn}(e_p)`} /> 都翻号。 其乘积保持<TeXBlock src={`\\frac{\\operatorname{sgn}(c_p)}{\\operatorname{sgn}(e_p)} = +1.`} />等价地, <TeX src={`\\operatorname{sgn}(c_p) = \\operatorname{sgn}(e_p)`} />。 ✓</p>
            </>}
            en={<>
              <p style={{ margin: '0 0 12px' }}>Claim: <TeX src={`\\operatorname{sgn}(c_p) = \\operatorname{sgn}(e_p)`} /> is preserved.</p>
              <p style={{ margin: '0 0 12px' }}>Each face turn cycles 4 corners (a 4-cycle in <TeX src={`c_p`} />) and 4 edges (a 4-cycle in <TeX src={`e_p`} />). A 4-cycle factors into 3 transpositions, so <TeX src={`\\operatorname{sgn} = (-1)^3 = -1`} />.</p>
              <p style={{ margin: '0 0 12px' }}>Therefore every generator flips <TeX src={`\\operatorname{sgn}(c_p)`} /> and <TeX src={`\\operatorname{sgn}(e_p)`} /> <em>simultaneously</em>. Their ratio<TeXBlock src={`\\frac{\\operatorname{sgn}(c_p)}{\\operatorname{sgn}(e_p)} = +1`} />stays constant. ✓</p>
            </>}
          />
          <div className="gt-proof-end">∎</div>
        </div>
        <p>
          <L
            zh={<>这三个证明加起来,完全刻画了 G 在「自由组装空间」 <TeX src={`S_8 \\times S_{12} \\times (\\mathbb{Z}/3)^8 \\times (\\mathbb{Z}/2)^{12}`} /> 里的位置。剩下要证的是 <strong>反方向</strong>:满足这三条的状态都是可达的。这部分通常由具体构造性算法 (即一个 solver) 直接给出 —— 任何能解魔方的程序,本身就是「可达性」的证明。</>}
            en={<>Together these three proofs pin G's location inside the free assembly group <TeX src={`S_8 \\times S_{12} \\times (\\mathbb{Z}/3)^8 \\times (\\mathbb{Z}/2)^{12}`} />. The converse — that every state satisfying these three constraints is reachable — is usually established constructively: any working solver is itself a proof of reachability.</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '推论 5.4', en: 'Corollary 5.4'
        })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>「自由组装空间」/ G 是一个 12 元商群:</>}
              en={<>The "free assembly space" / G is a 12-element quotient group:</>}
            />
            <TeXBlock src={`\\bigl(S_8 \\times S_{12} \\times (\\mathbb{Z}/3)^8 \\times (\\mathbb{Z}/2)^{12}\\bigr) \\,/\\, G \\;\\cong\\; \\mathbb{Z}/3 \\times \\mathbb{Z}/2 \\times \\mathbb{Z}/2`} />
            <L
              zh={<>每个商代表一种「拆装才能产生的状态」:角块多余的拧角 (ℤ/3)、棱块多余的翻面 (ℤ/2)、奇置换 (ℤ/2)。这就是为什么撬下来重装的魔方有 12 个不同的「平行宇宙」, 大多数无法用面转还原。</>}
              en={<>Each cell of the quotient is one "disassembly-only" anomaly: extra CO twist (ℤ/3), extra EO flip (ℤ/2), wrong parity (ℤ/2). That is precisely why a popped-and-rebuilt cube falls into one of 12 "parallel universes", most of which cannot be solved by face turns.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="5.4  守恒律即上同调约束" en="5.4  Conservation laws as cohomology constraints" />
        </h3>
        <p>
          <L
            zh={<>从更抽象的角度: 三个守恒律恰是把 「自由组装空间」 <TeX src={`F`} /> 看成一个 Abel 群扩张时, 第一群上同调 <TeX src={`H^1(G, \\mathbb{Z}/n)`} /> 给出的 「障碍类 (obstruction class)」。</>}
            en={<>From a more abstract angle: the three conservation laws are precisely the obstruction classes in the first group cohomology <TeX src={`H^1(G, \\mathbb{Z}/n)`} /> when viewing the "free assembly space" <TeX src={`F`} /> as an Abelian extension.</>}
          />
        </p>
        <TeXBlock src={`H^1\\bigl(G,\\, (\\mathbb{Z}/3)^8\\bigr) \\;\\supseteq\\; \\bigl\\{\\, \\textstyle\\sum c_o \\bmod 3 \\,\\bigr\\}, \\quad H^1\\bigl(G,\\, (\\mathbb{Z}/2)^{12}\\bigr) \\;\\supseteq\\; \\bigl\\{\\, \\textstyle\\sum e_o \\bmod 2 \\,\\bigr\\}`} />
        <p>
          <L
            zh={<>本节我们用纯组合验证, 但同一结论也可以由 「6 个生成元在 ℤ/3 上的求和给出 0 类」 这条上同调消失定理立刻得到。 这是为什么 「魔方守恒律」 与 「平面图染色 / 拓扑指数 / Stiefel–Whitney 类」 在数学上同源。</>}
            en={<>We verified things combinatorially, but the same conclusion drops out of the cohomology-vanishing statement "the six generators all sum to 0 in ℤ/3." This is why "cube invariants," "planar-graph colorings," "topological indices," and "Stiefel–Whitney classes" are siblings in the same abstract family.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="5.5  逐生成元验证表" en="5.5  Per-generator verification table" />
        </h3>
        <p>
          <L
            zh={<>三张表, 一目了然: 每个面转对应三个 「不变量增量」 都是 0 mod 对应模数。</>}
            en={<>Three tables — for each generator, all three invariant increments vanish modulo the relevant base.</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '生成元', en: 'Gen' })}</th><th><TeX src={`\\Delta(\\sum c_o) \\bmod 3`} /></th><th><TeX src={`\\Delta(\\sum e_o) \\bmod 2`} /></th><th><TeX src={`\\operatorname{sgn}(c_p) \\cdot \\operatorname{sgn}(e_p)`} /></th></tr>
          </thead>
          <tbody>
            <tr><td>U</td><td className="num">0</td><td className="num">0</td><td className="num">+1</td></tr>
            <tr><td>D</td><td className="num">0</td><td className="num">0</td><td className="num">+1</td></tr>
            <tr><td>R</td><td className="num">1+2+1+2 = 6 ≡ 0</td><td className="num">0</td><td className="num">(−1)(−1) = +1</td></tr>
            <tr><td>L</td><td className="num">6 ≡ 0</td><td className="num">0</td><td className="num">+1</td></tr>
            <tr><td>F</td><td className="num">6 ≡ 0</td><td className="num">4 ≡ 0</td><td className="num">+1</td></tr>
            <tr><td>B</td><td className="num">6 ≡ 0</td><td className="num">4 ≡ 0</td><td className="num">+1</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>每行都是 「这个面转保持该不变量」 的直接验证。 由 G 是生成元的乘积,所有元素都保持 — 这就是 §5.1–5.3 三个证明的「自动化」 版本。</>}
            en={<>Each row directly verifies "this face turn preserves the invariant." Since G is generated by the six face turns, every element does — an automated form of the proofs in §5.1–5.3.</>}
          />
        </p>
      </GTSec>
  );
}
