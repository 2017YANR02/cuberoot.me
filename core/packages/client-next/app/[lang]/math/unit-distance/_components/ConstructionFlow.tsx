/**
 * ConstructionFlow — 5-stage interactive diagram of the OpenAI construction.
 *
 * Each stage card has: a number, name, one-line summary, a small SVG
 * schematic, and an expandable detail panel with KaTeX. The cards are laid
 * out left-to-right on desktop, stacked on mobile. Clicking a card opens its
 * detail; arrows between cards show the pipeline order.
 */
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { TeX, TeXBlock } from '@/components/math/Tex';

type StageId = 'F' | 'tower' | 'K' | 'lattice' | 'project';

interface Stage {
  id: StageId;
  num: number;
  title: { zh: string; en: string };
  oneLine: { zh: string; en: string };
  detail: { zh: React.ReactNode; en: React.ReactNode };
  Schematic: () => React.ReactElement;
}

// ─── schematics (tiny SVGs, color tokens via CSS vars) ──────────────────────
function SchF() {
  return (
    <svg viewBox="0 0 100 70" className="ud-flow-svg">
      <text x={50} y={18} textAnchor="middle" fontSize="11" fill="var(--ud-text-sub)">cubic</text>
      <line x1={20} y1={45} x2={80} y2={45} stroke="var(--ud-text-mute)" strokeWidth="1" />
      <circle cx={30} cy={45} r={4} fill="var(--ud-pt)" />
      <circle cx={50} cy={45} r={4} fill="var(--ud-pt)" />
      <circle cx={70} cy={45} r={4} fill="var(--ud-pt)" />
      <text x={50} y={62} textAnchor="middle" fontSize="11" fill="var(--ud-text-sub)">3 real embeddings</text>
    </svg>
  );
}

function SchTower() {
  return (
    <svg viewBox="0 0 100 70" className="ud-flow-svg">
      {[5, 18, 31, 44, 56].map((y, i) => (
        <line key={i} x1={20} y1={y + 5} x2={80} y2={y + 5}
          stroke="var(--ud-pt)" strokeWidth={2 - i * 0.25} opacity={1 - i * 0.15} />
      ))}
      <text x={86} y={14} fontSize="9" fill="var(--ud-text-sub)">F₃</text>
      <text x={86} y={27} fontSize="9" fill="var(--ud-text-sub)">F₂</text>
      <text x={86} y={40} fontSize="9" fill="var(--ud-text-sub)">F₁</text>
      <text x={86} y={53} fontSize="9" fill="var(--ud-text-sub)">F₀</text>
      <line x1={14} y1={5} x2={14} y2={68} stroke="var(--ud-text-mute)" strokeWidth="1" markerEnd="url(#ud-arrow)" />
    </svg>
  );
}

function SchK() {
  return (
    <svg viewBox="0 0 100 70" className="ud-flow-svg">
      <line x1={50} y1={10} x2={30} y2={40} stroke="var(--ud-text-mute)" strokeWidth="1" />
      <line x1={50} y1={10} x2={70} y2={40} stroke="var(--ud-text-mute)" strokeWidth="1" />
      <circle cx={50} cy={10} r={5} fill="var(--ud-pt-hover)" />
      <text x={62} y={14} fontSize="10" fill="var(--ud-text)">K = F(i)</text>
      <circle cx={30} cy={45} r={4} fill="var(--ud-pt)" />
      <circle cx={70} cy={45} r={4} fill="var(--ud-pt)" />
      <text x={20} y={55} fontSize="9" fill="var(--ud-text-sub)">F</text>
      <text x={73} y={55} fontSize="9" fill="var(--ud-text-sub)">F</text>
      <text x={50} y={66} textAnchor="middle" fontSize="9" fill="var(--ud-text-sub)">c = conj</text>
    </svg>
  );
}

function SchLattice() {
  const pts: [number, number][] = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) pts.push([i, j]);
  return (
    <svg viewBox="0 0 100 70" className="ud-flow-svg">
      {pts.map(([i, j], k) => (
        <circle key={k} cx={50 + i * 12} cy={35 + j * 10} r={1.8} fill="var(--ud-pt)" />
      ))}
      <text x={50} y={66} textAnchor="middle" fontSize="9" fill="var(--ud-text-sub)">Λⱼ ⊂ ℂ^f</text>
    </svg>
  );
}

function SchProject() {
  return (
    <svg viewBox="0 0 100 70" className="ud-flow-svg">
      {/* a disk with points */}
      <circle cx={32} cy={32} r={20} fill="none" stroke="var(--ud-text-mute)" strokeWidth="1" strokeDasharray="2 2" />
      {[[28, 24], [38, 28], [24, 36], [36, 38], [30, 32], [22, 28]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.8} fill="var(--ud-pt)" />
      ))}
      {/* arrow */}
      <line x1={58} y1={32} x2={70} y2={32} stroke="var(--ud-text)" strokeWidth="1.4" markerEnd="url(#ud-arrow)" />
      {/* projected 1D set */}
      <line x1={75} y1={32} x2={97} y2={32} stroke="var(--ud-text-mute)" strokeWidth="0.8" />
      {[78, 82, 86, 90, 94].map((x, i) => (
        <circle key={i} cx={x} cy={32} r={1.6} fill="var(--ud-pt-hover)" />
      ))}
      <text x={50} y={66} textAnchor="middle" fontSize="9" fill="var(--ud-text-sub)">π₁: Λⱼ ∩ W → ℝ²</text>
    </svg>
  );
}

// ─── stages content ────────────────────────────────────────────────────────
const STAGES: Stage[] = [
  {
    id: 'F',
    num: 1,
    title: { zh: '基场 F', en: 'Base field F' },
    oneLine: {
      zh: '三次循环、全实数域,起点',
      en: 'cyclic cubic, totally real',
    },
    Schematic: SchF,
    detail: {
      zh: (
        <>
          <p>取 ℓ 个素数 <TeX src="r_1, \ldots, r_\ell \equiv 1 \pmod 3" />,每个 <TeX src="r_i" /> 对应 <TeX src="\mathbb{Q}(\zeta_{r_i})" /> 中唯一的三次循环子域 <TeX src="L_i" />。让 <TeX src="\chi_i" /> 是其三次特征,把 <TeX src="\chi_1 \cdots \chi_\ell" /> 切出来的子域记为 <TeX src="F" />。</p>
          <TeXBlock src="\mathrm{Gal}(F/\mathbb{Q}) \cong \mathbb{Z}/3\mathbb{Z}, \quad |D_F| = D^2,\ D = \prod_i r_i." />
          <p>F 是全实的(三次循环 + 不含 <TeX src="\zeta_3" />),根判别式 <TeX src="\log \mathrm{rd}(F) = O(\ell \log \ell)" /> 是温和的。这是后面所有事的"基地"。</p>
        </>
      ),
      en: (
        <>
          <p>Pick ℓ primes <TeX src="r_1, \ldots, r_\ell \equiv 1 \pmod 3" />; each <TeX src="r_i" /> gives a unique cyclic cubic subfield <TeX src="L_i \subset \mathbb{Q}(\zeta_{r_i})" />. Cut out the product character <TeX src="\chi_1 \cdots \chi_\ell" /> to define <TeX src="F" />.</p>
          <TeXBlock src="\mathrm{Gal}(F/\mathbb{Q}) \cong \mathbb{Z}/3\mathbb{Z}, \quad |D_F| = D^2,\ D = \prod_i r_i." />
          <p>F is totally real (cyclic cubic and <TeX src="\zeta_3 \notin F" />) with mild root discriminant <TeX src="\log \mathrm{rd}(F) = O(\ell \log \ell)" />. This is the launchpad.</p>
        </>
      ),
    },
  },
  {
    id: 'tower',
    num: 2,
    title: { zh: '无支 pro-3 塔', en: 'Unramified pro-3 tower' },
    oneLine: {
      zh: '让度数 [Fⱼ : ℚ] → ∞,根判别式保持常数',
      en: 'degrees [Fⱼ : ℚ] → ∞, root discriminant stays constant',
    },
    Schematic: SchTower,
    detail: {
      zh: (
        <>
          <p>关键技术:用 <strong>Golod–Shafarevich 不等式</strong> + Shafarevich 关系秩估计,证明 <TeX src="G = \mathrm{Gal}(F^{\mathrm{ur},3}/F)" /> 这个无支 pro-3 群<em>无穷</em>。</p>
          <TeXBlock src="r(G) \le d(G) + C_0, \quad d(G) \ge \ell - 1." />
          <p>用 Chebotarev 挑出 t ≈ ℓ²/100 个分裂素数,把它们的 Frobenius 杀掉(在 Frattini 子群里,所以不降生成元秩);只增加 3t ≈ d²/100 个关系。仍然 <TeX src="r < d^2/4" />,Golod–Shafarevich 保证商群 <TeX src="\bar G" /> <em>仍然无穷</em>。从中取下降链,得到无穷塔</p>
          <TeXBlock src="F = F_0 \subset F_1 \subset F_2 \subset \cdots,\quad f_j = [F_j : \mathbb{Q}] \to \infty." />
          <p>因为每层无支,根判别式 <TeX src="\mathrm{rd}(F_j) = \mathrm{rd}(F)" /> 恒定;3-群 + 全实 ⇒ 每层仍全实。</p>
        </>
      ),
      en: (
        <>
          <p>The technical heart: <strong>Golod–Shafarevich</strong> + Shafarevich's relation-rank estimate show that <TeX src="G = \mathrm{Gal}(F^{\mathrm{ur},3}/F)" /> is <em>infinite</em>.</p>
          <TeXBlock src="r(G) \le d(G) + C_0, \quad d(G) \ge \ell - 1." />
          <p>Chebotarev supplies t ≈ ℓ²/100 split primes; their Frobenius classes lie in the Frattini subgroup, so killing them adds 3t ≈ d²/100 relations without dropping the generator rank. We still get <TeX src="r < d^2/4" />, and Golod–Shafarevich keeps the quotient <TeX src="\bar G" /> infinite. A descending chain gives</p>
          <TeXBlock src="F = F_0 \subset F_1 \subset F_2 \subset \cdots,\quad f_j = [F_j : \mathbb{Q}] \to \infty." />
          <p>Every layer is unramified ⇒ <TeX src="\mathrm{rd}(F_j) = \mathrm{rd}(F)" /> stays constant. 3-group + totally real ⇒ every layer is totally real.</p>
        </>
      ),
    },
  },
  {
    id: 'K',
    num: 3,
    title: { zh: 'CM 扩张 Kⱼ = Fⱼ(i)', en: 'CM extension Kⱼ = Fⱼ(i)' },
    oneLine: {
      zh: '加入 i,得到复共轭非平凡的 CM 域',
      en: 'adjoin i — get a CM field where complex conjugation is non-trivial',
    },
    Schematic: SchK,
    detail: {
      zh: (
        <>
          <p>每层 Fⱼ 上加 i,得到 <TeX src="K_j = F_j(i)" />,称为 CM 域:全实子域 + 全虚 2-扩张。非平凡自同构 c 在每个复嵌入下都变成<em>普通复共轭</em>。</p>
          <p>核心好处:若 <TeX src="u \in K_j" /> 满足 <TeX src="u \cdot c(u) = 1" />(范数 1),则在每个复嵌入 σ 下:</p>
          <TeXBlock src="|\sigma(u)| = \left|\frac{\sigma(\alpha)}{\overline{\sigma(\alpha)}}\right| = 1." />
          <p>"在所有复嵌入下模长 = 1" 的元素正是我们需要的"单位平移"。</p>
        </>
      ),
      en: (
        <>
          <p>Adjoin <TeX src="i" /> to each layer: <TeX src="K_j = F_j(i)" />, a CM field — totally real subfield with a totally imaginary quadratic extension. The non-trivial automorphism c becomes <em>ordinary complex conjugation</em> under every complex embedding.</p>
          <p>The payoff: if <TeX src="u \in K_j" /> satisfies <TeX src="u \cdot c(u) = 1" /> (norm 1), then under every complex embedding σ:</p>
          <TeXBlock src="|\sigma(u)| = \left|\frac{\sigma(\alpha)}{\overline{\sigma(\alpha)}}\right| = 1." />
          <p>Elements with "modulus 1 under every complex embedding" are exactly the unit translations we need.</p>
        </>
      ),
    },
  },
  {
    id: 'lattice',
    num: 4,
    title: { zh: 'Minkowski 格 Λⱼ', en: 'Minkowski lattice Λⱼ' },
    oneLine: {
      zh: '把 Kⱼ 嵌入 ℂ^fⱼ,得到高维格',
      en: 'embed Kⱼ ↪ ℂ^fⱼ as a high-dim lattice',
    },
    Schematic: SchLattice,
    detail: {
      zh: (
        <>
          <p>取每对共轭嵌入中的一个 σ₁, ..., σ_{'fⱼ'},把 Kⱼ 嵌入 ℂ^fⱼ:</p>
          <TeXBlock src="\Phi: K_j \hookrightarrow \mathbb{C}^{f_j}, \quad \Phi(x) = (\sigma_1(x), \ldots, \sigma_{f_j}(x))." />
          <p>Φ 把分式理想 <TeX src="Q^{-2}\mathcal{O}_{K_j}" /> 映成一个完整的格 <TeX src="\Lambda_j \subset \mathbb{C}^{f_j}" />。利用分裂素数(每个 qb 在 Fⱼ 完全分裂 + qb ≡ 1 mod 4 在 K 也完全分裂)+ 类数 pigeonhole,构造出</p>
          <TeXBlock src="|U_j| \ge \exp(\gamma f_j), \quad \gamma = t \log 2 - \log H_\ell > 0" />
          <p>个满足 <TeX src="u \cdot c(u) = 1" /> 的元素,它们 (Minkowski 像后)每个坐标模长都恰好 1。</p>
        </>
      ),
      en: (
        <>
          <p>Pick one σ from each conjugate pair of complex embeddings, getting <TeX src="\sigma_1, \ldots, \sigma_{f_j}" />:</p>
          <TeXBlock src="\Phi: K_j \hookrightarrow \mathbb{C}^{f_j}, \quad \Phi(x) = (\sigma_1(x), \ldots, \sigma_{f_j}(x))." />
          <p>Φ sends the fractional ideal <TeX src="Q^{-2}\mathcal{O}_{K_j}" /> to a full lattice <TeX src="\Lambda_j \subset \mathbb{C}^{f_j}" />. Using the split primes (each <TeX src="q_b" /> splits completely in Fⱼ, and <TeX src="q_b \equiv 1\pmod 4" /> in <TeX src="K_j" />) + class-group pigeonhole, we get</p>
          <TeXBlock src="|U_j| \ge \exp(\gamma f_j), \quad \gamma = t \log 2 - \log H_\ell > 0" />
          <p>norm-one elements whose Minkowski images have <em>every</em> coordinate of modulus exactly 1.</p>
        </>
      ),
    },
  },
  {
    id: 'project',
    num: 5,
    title: { zh: '多圆盘切 + 投影 → Pⱼ', en: 'Polydisc cut + project → Pⱼ' },
    oneLine: {
      zh: '切出有限子集,投影到第一坐标得 ℝ² 点集',
      en: 'restrict to finite subset, project to first coord → ℝ² point set',
    },
    Schematic: SchProject,
    detail: {
      zh: (
        <>
          <p>取多圆盘 <TeX src="W = \{|z_r| \le R\}^{f_j} \subset \mathbb{C}^{f_j}" />,对随机平移取 <TeX src="X = (a + \Lambda_j) \cap W" />。平均化论证给出某个余集满足</p>
          <TeXBlock src="E_a \ge e^{\gamma f_j / 2} \cdot |X|." />
          <p>这里 E_a 是 X 中差为 Uⱼ 元素的有序对数。再用 π₁ 投到第一复坐标 (其余坐标的代数限制保证 π₁ 在余集上单射):</p>
          <TeXBlock src="\nu(P_j) \ge \tfrac{1}{2} e^{\gamma f_j / 2} \cdot |P_j|." />
          <p>最后 X 的填充估计给 <TeX src="|P_j| \le e^{\mathcal{B} f_j}" />,代入指数比值得</p>
          <TeXBlock src="\boxed{\nu(P_j) \ge n_j^{1+\delta}, \quad \delta = \frac{\gamma}{4 \mathcal{B}} > 0.}" />
          <p>当 j → ∞ 时 nⱼ → ∞,定理 1.1 得证。</p>
        </>
      ),
      en: (
        <>
          <p>Take the polydisc <TeX src="W = \{|z_r| \le R\}^{f_j} \subset \mathbb{C}^{f_j}" /> and a random translate <TeX src="X = (a + \Lambda_j) \cap W" />. An averaging argument gives some coset with</p>
          <TeXBlock src="E_a \ge e^{\gamma f_j / 2} \cdot |X|." />
          <p>where E_a counts ordered pairs in X whose difference lies in Uⱼ. Projecting to the first complex coordinate (other-coordinate algebraic constraints force π₁ injective on the coset):</p>
          <TeXBlock src="\nu(P_j) \ge \tfrac{1}{2} e^{\gamma f_j / 2} \cdot |P_j|." />
          <p>A packing estimate gives <TeX src="|P_j| \le e^{\mathcal{B} f_j}" />, and combining exponent ratios:</p>
          <TeXBlock src="\boxed{\nu(P_j) \ge n_j^{1+\delta}, \quad \delta = \frac{\gamma}{4 \mathcal{B}} > 0.}" />
          <p>As j → ∞, nⱼ → ∞ — Theorem 1.1 is proved.</p>
        </>
      ),
    },
  },
];

export default function ConstructionFlow() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [open, setOpen] = useState<StageId | null>('F');

  return (
    <div className="ud-flow">
      {/* shared arrow marker */}
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <defs>
          <marker id="ud-arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ud-text)" />
          </marker>
        </defs>
      </svg>

      <div className="ud-flow-grid">
        {STAGES.map((s, i) => {
          const isOpen = open === s.id;
          return (
            <div key={s.id} className="ud-flow-step">
              <button
                className={`ud-flow-card ${isOpen ? 'is-open' : ''}`}
                onClick={() => setOpen(isOpen ? null : s.id)}
                aria-expanded={isOpen}
              >
                <div className="ud-flow-card-head">
                  <span className="ud-flow-num">{s.num}</span>
                  <span className="ud-flow-title">{isZh ? s.title.zh : s.title.en}</span>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                <div className="ud-flow-card-schem"><s.Schematic /></div>
                <div className="ud-flow-card-oneline">{isZh ? s.oneLine.zh : s.oneLine.en}</div>
              </button>
              {i < STAGES.length - 1 && <div className="ud-flow-arrow" aria-hidden>→</div>}
            </div>
          );
        })}
      </div>

      {open && (() => {
        const s = STAGES.find(x => x.id === open)!;
        return (
          <div className="ud-flow-detail">
            <div className="ud-flow-detail-head">
              <span className="ud-flow-detail-num">Stage {s.num}</span>
              <span className="ud-flow-detail-title">{isZh ? s.title.zh : s.title.en}</span>
            </div>
            <div className="ud-flow-detail-body">
              {isZh ? s.detail.zh : s.detail.en}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
