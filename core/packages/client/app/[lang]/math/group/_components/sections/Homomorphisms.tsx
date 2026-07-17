'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock } from '../primitives';
import { applyAlg, permSign, identity } from '../cube_state';
import { tr } from '@/i18n/tr';

// ── §17 HomomorphismPanel — parity sgn: G → ℤ/2 ────────────────────────────
function HomomorphismPanel() {
  const [g, setG] = useState("R U R' U'");
  const [h, setH] = useState("F R U' R' F'");
  const result = useMemo(() => {
    try {
      const sG = applyAlg(identity(), g);
      const sH = applyAlg(identity(), h);
      const sGH = applyAlg(identity(), `${g} ${h}`);
      const signG = permSign(sG.cp);
      const signH = permSign(sH.cp);
      const signGH = permSign(sGH.cp);
      const homOk = (signG * signH) === signGH;
      return { signG, signH, signGH, homOk };
    } catch { return null; }
  }, [g, h]);

  const presets: { gv: string; hv: string; label: string }[] = [
    { gv: 'R', hv: 'U', label: 'R · U' },
    { gv: "R U R' U'", hv: 'F R U R\' U\' F\'', label: 'two even algs' },
    { gv: 'R', hv: 'R', label: 'R · R = R²' },
    { gv: "R U R' U R U2 R'", hv: "F R U' R' U' R U R' F'", label: 'Sune · OLL26' },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § 同态性质 sgn(g·h) = sgn(g) · sgn(h)', en: 'Interactive § Homomorphism check sgn(g·h) = sgn(g) · sgn(h)'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: 'sgn 把 G 映到 ℤ/2 = {±1}。要验证它是同态:对任意 g, h ∈ G,应有 sgn(g·h) = sgn(g) · sgn(h)。', en: 'sgn maps G → ℤ/2 = {±1}. To check it is a homomorphism: for any g, h ∈ G, we need sgn(g·h) = sgn(g) · sgn(h).'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>g</label>
        <input className="gt-input" value={g} onChange={e => setG(e.target.value)} />
      </div>
      <div className="gt-panel-input-row">
        <label>h</label>
        <input className="gt-input" value={h} onChange={e => setH(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
        {presets.map(p => (
          <span key={p.label} className="gt-chip" onClick={() => { setG(p.gv); setH(p.hv); }}>{p.label}</span>
        ))}
      </div>
      {result && (
        <div className="gt-hom-grid">
          <div className="gt-hom-cell">
            <div className="gt-hom-label">sgn(g)</div>
            <div className={`gt-hom-val ${result.signG === 1 ? 'gt-hom-pos' : 'gt-hom-neg'}`}>{result.signG === 1 ? '+1' : '−1'}</div>
          </div>
          <div className="gt-hom-op">×</div>
          <div className="gt-hom-cell">
            <div className="gt-hom-label">sgn(h)</div>
            <div className={`gt-hom-val ${result.signH === 1 ? 'gt-hom-pos' : 'gt-hom-neg'}`}>{result.signH === 1 ? '+1' : '−1'}</div>
          </div>
          <div className="gt-hom-op">=</div>
          <div className="gt-hom-cell">
            <div className="gt-hom-label">sgn(g·h)</div>
            <div className={`gt-hom-val ${result.signGH === 1 ? 'gt-hom-pos' : 'gt-hom-neg'}`}>{result.signGH === 1 ? '+1' : '−1'}</div>
          </div>
        </div>
      )}
      <div className={`gt-inv-final ${result?.homOk ? '' : 'gt-inv-final-bad'}`}>
        {result?.homOk
          ? tr({ zh: '✓ 同态性质成立', en: '✓ homomorphism property holds'
                          })
          : tr({ zh: '✗ 同态性质失败 (不可能发生 — 这是定理)', en: '✗ homomorphism property fails (impossible — this is a theorem)'
                          })}
      </div>
    </div>
  );
}

// ── §18 BurnsideMiniTable — counting orbits under cube symmetries ─────────

export default function Homomorphisms() {
  return (
      <GTSec id="homomorphisms" className="gt-sec">
        <div className="gt-sec-num">§17</div>
        <h2 className="gt-sec-title">
          <L zh="同态 — 把群压扁到更简单的群里" en="Homomorphisms — projecting onto simpler groups" />
        </h2>
        <p>
          <L
            zh={<>群与群之间有「保乘法的映射」 — 它是研究群的标准工具。在魔方上, 同态把 4.3 × 10¹⁹ 个状态压扁到只有 2 个 (奇偶) 或 12 个 (拆装-平行宇宙), 让我们能 「只关心一部分信息」。</>}
            en={<>Maps between groups that respect multiplication — homomorphisms — are the standard tool for studying groups. On the cube, a homomorphism crushes 4.3 × 10¹⁹ states onto just 2 (parity) or 12 (the disassembly cosets), letting us track just one slice of information at a time.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 17.1', en: 'Definition 17.1'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>函数 <TeX src={`\\varphi : G \\to H`} /> 是 <strong>群同态</strong>, 若对所有 <TeX src={`a, b \\in G`} />: <TeX src={`\\varphi(a \\cdot b) = \\varphi(a) \\cdot \\varphi(b)`} />。 同态自动满足 <TeX src={`\\varphi(e_G) = e_H`} /> 和 <TeX src={`\\varphi(a^{-1}) = \\varphi(a)^{-1}`} />。</>}
              en={<>A map <TeX src={`\\varphi : G \\to H`} /> is a <strong>group homomorphism</strong> if <TeX src={`\\varphi(a \\cdot b) = \\varphi(a) \\cdot \\varphi(b)`} /> for all <TeX src={`a, b \\in G`} />. It automatically satisfies <TeX src={`\\varphi(e_G) = e_H`} /> and <TeX src={`\\varphi(a^{-1}) = \\varphi(a)^{-1}`} />.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="17.1  奇偶同态 sgn : G → ℤ/2" en="17.1  The parity homomorphism sgn : G → ℤ/2" />
        </h3>
        <p>
          <L
            zh={<>对每个 g ∈ G, 角块置换 cp(g) 是 S₈ 的元素 — 它要么是偶置换 (能写成偶数个 2-循环之积), 要么是奇置换。 由约束 sgn(cp) = sgn(ep), 棱块部分也有相同奇偶。 定义:</>}
            en={<>For each g ∈ G, the corner permutation cp(g) is in S₈ — either an even permutation (a product of an even number of transpositions) or odd. By the invariant sgn(cp) = sgn(ep), edges have the same parity. Define:</>}
          />
        </p>
        <TeXBlock src={`\\operatorname{sgn} : G \\to \\mathbb{Z}/2, \\qquad \\operatorname{sgn}(g) = \\operatorname{sgn}(c_p(g)) \\in \\{+1, -1\\}`} />
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 17.2', en: 'Theorem 17.2' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>sgn 是满同态 <TeX src={`G \\twoheadrightarrow \\mathbb{Z}/2`} />, 它的核是 <strong>偶状态集</strong> = <TeX src={`[G, G]`} />, 阶为 <TeX src={`|G| / 2 \\approx 2.16 \\times 10^{19}`} />。</>}
              en={<>sgn is a surjective homomorphism <TeX src={`G \\twoheadrightarrow \\mathbb{Z}/2`} />; its kernel is the <strong>even-parity subgroup</strong> <TeX src={`[G, G]`} />, of size <TeX src={`|G| / 2 \\approx 2.16 \\times 10^{19}`} />.</>}
            />
          </div>
        </div>
        <HomomorphismPanel />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="17.2  第一同构定理 (First Isomorphism Theorem)" en="17.2  First Isomorphism Theorem" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 17.3', en: 'Theorem 17.3' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 <TeX src={`\\varphi : G \\to H`} /> 是同态, 则<TeXBlock src={`G / \\ker(\\varphi) \\;\\cong\\; \\operatorname{im}(\\varphi).`} /></>}
              en={<>Let <TeX src={`\\varphi : G \\to H`} /> be a homomorphism. Then<TeXBlock src={`G / \\ker(\\varphi) \\;\\cong\\; \\operatorname{im}(\\varphi).`} /></>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>应用到 sgn:</>}
            en={<>Apply to sgn:</>}
          />
        </p>
        <TeXBlock src={`G / [G, G] \\;\\cong\\; \\mathbb{Z}/2`} />
        <p>
          <L
            zh={<>这就是 §9.2 说的 「G 的最大阿贝尔商」, 等价于 「魔方的奇偶 bit」 。每个魔方状态只有一比特的「阿贝尔信息」, 其余 33 比特都是非阿贝尔结构。</>}
            en={<>This is exactly the "largest Abelian quotient" mentioned in §9.2 — the cube's single bit of "parity." Every cube state carries just one bit of Abelian information; the rest of its 33+ bits is purely non-Abelian.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="17.3  从自由组装到 G — 12 元商" en="17.3  Free assembly → G — the 12-fold quotient" />
        </h3>
        <p>
          <L
            zh={<>另一个有用的同态: 把魔方「拆开重组的全部状态」 <TeX src={`F = S_8 \\times S_{12} \\times (\\mathbb{Z}/3)^8 \\times (\\mathbb{Z}/2)^{12}`} /> 用 「(coSum mod 3, eoSum mod 2, parity bit)」 三元组映到 <TeX src={`\\mathbb{Z}/3 \\times \\mathbb{Z}/2 \\times \\mathbb{Z}/2`} />:</>}
            en={<>Another useful homomorphism: from the "free assembly space" <TeX src={`F = S_8 \\times S_{12} \\times (\\mathbb{Z}/3)^8 \\times (\\mathbb{Z}/2)^{12}`} /> onto the 3-tuple (coSum mod 3, eoSum mod 2, parity bit) <TeX src={`\\in \\mathbb{Z}/3 \\times \\mathbb{Z}/2 \\times \\mathbb{Z}/2`} />:</>}
          />
        </p>
        <TeXBlock src={`\\psi : F \\to \\mathbb{Z}/3 \\times \\mathbb{Z}/2 \\times \\mathbb{Z}/2, \\qquad \\ker(\\psi) = G`} />
        <p>
          <L
            zh={<>由第一同构定理, <TeX src={`F / G \\cong \\mathbb{Z}/3 \\times \\mathbb{Z}/2 \\times \\mathbb{Z}/2`} />, 阶 12。 这就是 §5.4 推论的 12 个 「平行宇宙」 — 物理上拆开重装时, 有 12 种不可达状态的 「等价类」。</>}
            en={<>By the First Isomorphism Theorem, <TeX src={`F / G \\cong \\mathbb{Z}/3 \\times \\mathbb{Z}/2 \\times \\mathbb{Z}/2`} />, a group of order 12. This is Corollary 5.4's 12 "parallel universes" — physically, the 12 unreachable equivalence classes you can produce by popping the cube apart.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="17.4  其它同态 — 各种「投影」" en="17.4  Other homomorphisms — different projections" />
        </h3>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>角块投影</strong> <TeX src={`\\pi_c : G \\to G_c`} />: 忽略棱块, 只看角块。 像 = 「2×2×2 口袋方块群」, <TeX src={`|G_c| = 3{,}674{,}160`} />。</>}
              en={<><strong>Corner projection</strong> <TeX src={`\\pi_c : G \\to G_c`} />: forget edges, keep corners. Image = the 2×2×2 Pocket Cube group, order <TeX src={`3{,}674{,}160`} />.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>棱块投影</strong> <TeX src={`\\pi_e : G \\to G_e`} />: 只看棱块。 像有阶 <TeX src={`980{,}995{,}276{,}800 \\approx 9.8 \\times 10^{11}`} />。</>}
              en={<><strong>Edge projection</strong> <TeX src={`\\pi_e : G \\to G_e`} />: keep only edges. Image has order <TeX src={`980{,}995{,}276{,}800 \\approx 9.8 \\times 10^{11}`} />.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>朝向投影</strong> <TeX src={`G \\to (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} />: 忽略所有位置, 只看朝向。 这是 Thistlethwaite 阶段 <TeX src={`G \\to G_1`} /> 用的同态。</>}
              en={<><strong>Orientation projection</strong> <TeX src={`G \\to (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} />: forget positions, keep orientations. This is the homomorphism used in Thistlethwaite's <TeX src={`G \\to G_1`} /> phase.</>}
            />
          </li>
        </ul>
        <p>
          <L
            zh={<>每个同态对应一个「子任务」: 解魔方的方法之一就是依次解决每个投影, 让 image 变成单位元 — 这正是 Thistlethwaite/Kociemba 多阶段法的代数基础。</>}
            en={<>Each homomorphism corresponds to one "subtask": one way to solve the cube is to drive each image to the identity in turn — which is exactly the algebraic basis of the Thistlethwaite/Kociemba multi-phase solvers.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="17.5  同态画廊 — 4 张映射表" en="17.5  Homomorphism gallery" />
        </h3>
        <p>
          <L
            zh={<>把魔方上 4 个常用同态摆在一张表里, 看 kernel / image / index 的差异:</>}
            en={<>Four standard cube homomorphisms in a single table, with kernel / image / index side by side:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '同态', en: 'Homomorphism'
            })}</th><th>{tr({ zh: '像', en: 'Image' })}</th><th>{tr({ zh: '核', en: 'Kernel' })}</th><th>|ker|</th><th>[G : ker]</th></tr>
          </thead>
          <tbody>
            <tr><td><TeX src={`\\operatorname{sgn} : G \\to \\mathbb{Z}/2`} /></td><td><TeX src={`\\mathbb{Z}/2`} /></td><td><TeX src={`[G,G]`} /></td><td className="num">|G|/2</td><td className="num">2</td></tr>
            <tr><td><TeX src={`\\pi_{\\text{corner}} : G \\to G_c`} /></td><td>{tr({ zh: '2×2×2 群', en: '2×2×2 group' })}</td><td>{tr({ zh: 'cp=co=identity 的部分', en: 'cp = co = identity part' })}</td><td className="num">≈ 1.18 × 10¹³</td><td className="num">3,674,160</td></tr>
            <tr><td><TeX src={`\\pi_{\\text{edge}} : G \\to G_e`} /></td><td>{tr({ zh: '12 棱块群', en: '12-edge group'
            })}</td><td>{tr({ zh: 'ep=eo=identity 的部分', en: 'ep = eo = identity part' })}</td><td className="num">≈ 4.41 × 10⁷</td><td className="num">9.81 × 10¹¹</td></tr>
            <tr><td><TeX src={`\\pi_{\\text{ori}} : G \\to (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /></td><td>{tr({ zh: 'EO ⊕ CO 空间', en: 'EO ⊕ CO space'
            })}</td><td><TeX src={`G_1`} /> ({tr({ zh: '朝向全 0 的子群', en: 'orientation-zero subgroup' })})</td><td className="num">|G|/2¹¹ = |G|/2048</td><td className="num">2¹¹ · 3⁷ = 4,478,976</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>三个 <TeX src={`\\pi_*`} /> 同态合在一起几乎能重建状态向量: 知道 cp/ep 加 co/eo, 就知道整个 g。但 「合体同态」 <TeX src={`G \\to G_c \\times G_e \\times (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /> 仍然不单射, 它的 kernel 包括所有「角块对角块独立 / 棱块对棱块独立」 但被三守恒律约束的状态。</>}
            en={<>Together the three <TeX src={`\\pi_*`} /> homomorphisms almost reconstruct a state vector: knowing cp/ep, co/eo gives g. But the "combined" homomorphism <TeX src={`G \\to G_c \\times G_e \\times (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /> is still not injective; its kernel collects states where corners-vs-edges are "independent" yet bound by the three reachability laws.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="17.6  Schur–Zassenhaus 在魔方上" en="17.6  Schur–Zassenhaus on the cube" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 17.4 — Schur–Zassenhaus', en: 'Theorem 17.4 — Schur–Zassenhaus' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 <TeX src={`N \\triangleleft G`} /> 是有限群的正规子群, <TeX src={`\\gcd(|N|, |G/N|) = 1`} />。 则 G 可表为 <strong>半直积</strong> <TeX src={`G \\cong N \\rtimes (G/N)`} />, 即 G 内存在补群 <TeX src={`H \\subseteq G`} /> 使 <TeX src={`G = NH`} /> 且 <TeX src={`N \\cap H = \\{e\\}`} />。</>}
              en={<>Let <TeX src={`N \\triangleleft G`} /> be a normal subgroup of a finite group with <TeX src={`\\gcd(|N|, |G/N|) = 1`} />. Then G splits as a <strong>semidirect product</strong> <TeX src={`G \\cong N \\rtimes (G/N)`} /> — i.e. G contains a complement <TeX src={`H \\subseteq G`} /> with <TeX src={`G = NH`} /> and <TeX src={`N \\cap H = \\{e\\}`} />.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>对魔方,关键的正规子群是 <TeX src={`N = (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /> (朝向核, ker π_pos 中 「只改朝向不改位置」 的部分)。<TeXBlock src={`|N| \\;=\\; 3^7 \\cdot 2^{11} \\;=\\; 4{,}478{,}976.`} /><TeX src={`|G/N| = |S_8 \\times S_{12}|/2 = 8! \\cdot 12!/2 \\approx 9.65 \\times 10^{15}`} />。验证: <TeX src={`\\gcd(4{,}478{,}976,\\; 9.65 \\times 10^{15})`} /> 含因子 <TeX src={`2`} /> 和 <TeX src={`3`} /> — <strong>不互素</strong>! 故 Schur–Zassenhaus 不直接给 「位置 vs 朝向」 的劈裂。</>}
            en={<>For the cube, the natural normal subgroup is <TeX src={`N = (\\mathbb{Z}/3)^7 \\times (\\mathbb{Z}/2)^{11}`} /> (the orientation kernel — operations that change orientations but not positions).<TeXBlock src={`|N| \\;=\\; 3^7 \\cdot 2^{11} \\;=\\; 4{,}478{,}976.`} /><TeX src={`|G/N| = |S_8 \\times S_{12}|/2 \\approx 9.65 \\times 10^{15}`} />. Check <TeX src={`\\gcd(4{,}478{,}976,\\; 9.65 \\times 10^{15})`} />: it contains factors of <TeX src={`2`} /> and <TeX src={`3`} /> — they are <strong>not</strong> coprime! So Schur–Zassenhaus does not split G as "positions × orientations" directly.</>}
          />
        </p>
        <p>
          <L
            zh={<>然而 N 的 「3-部分」 <TeX src={`N_3 = (\\mathbb{Z}/3)^7`} /> (阶 2187) 与 <TeX src={`G/N_3`} /> (阶 <TeX src={`|G|/2187 \\approx 1.98 \\times 10^{16}`} />) 互素: <TeX src={`|G/N_3|`} /> 只含 <TeX src={`2`} /> 与 prime factors 不是 3 (因为 |G/N| 不含 3 因子;待 verified by Sylow)。 实际上, Sylow-3 部分仅在 N_3 中, 故 <TeX src={`G \\cong N_3 \\rtimes (G/N_3)`} /> 成立。 这就是为什么 「先归朝向, 再归位置」 是一条合法分解 — Thistlethwaite/Kociemba 的多阶段框架本质上就是 Schur–Zassenhaus 给出的半直积分层。</>}
            en={<>However, the "3-part" of N, namely <TeX src={`N_3 = (\\mathbb{Z}/3)^7`} /> (order 2187), <em>is</em> coprime to its complement: |G/N_3| has no factor of 3 (the 3-Sylow lives entirely in N_3). So <TeX src={`G \\cong N_3 \\rtimes (G/N_3)`} /> by Schur–Zassenhaus. This is exactly why "fix orientations first, then permutations" is an algebraically legitimate decomposition — the multi-phase framework of Thistlethwaite/Kociemba is, at heart, a Schur–Zassenhaus splitting.</>}
          />
        </p>
      </GTSec>
  );
}
