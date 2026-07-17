'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { applyAlg, thistlethwaiteStage, identity } from '../cube_state';
import { tr } from '@/i18n/tr';
import { TwistyMini } from '../TwistyMini';

// ── §10 SubgroupClimber (Thistlethwaite) ───────────────────────────────────
function SubgroupClimber() {
  const lang = useLang();
  const [alg, setAlg] = useState("F R U' R' U' R U R' F'");
  const stage = useMemo(() => {
    try { return thistlethwaiteStage(applyAlg(identity(), alg)); } catch { return 0; }
  }, [alg]);

  const stages: { i: 0 | 1 | 2 | 3 | 4; name: string; gens: string }[] = [
    { i: 0, name: 'G₀ = G', gens: '⟨U,D,L,R,F,B⟩' },
    { i: 1, name: 'G₁',     gens: '⟨U,D,L,R,F2,B2⟩' },
    { i: 2, name: 'G₂',     gens: '⟨U,D,L2,R2,F2,B2⟩' },
    { i: 3, name: 'G₃',     gens: '⟨U2,D2,L2,R2,F2,B2⟩' },
    { i: 4, name: 'G₄ = {e}', gens: '⟨⟩' },
  ];

  return (
    <div className="gt-panel">
      <div className="gt-panel-title">{tr({ zh: '互动 § Thistlethwaite 子群链', en: 'Interactive § Thistlethwaite subgroup chain'
    })}</div>
      <p className="gt-panel-sub">
        {tr({ zh: '从 G 一路降到 {e},中间穿过四个固定子群。输入打乱,看它「位于哪一阶」。', en: 'Climb from G down to {e} through four fixed subgroups. Input an alg, see what depth its state is "inside".'
        })}
      </p>
      <div className="gt-panel-input-row">
        <label>alg</label>
        <input className="gt-input" value={alg} onChange={e => setAlg(e.target.value)} />
      </div>
      <div className="gt-panel-input-row" style={{ marginTop: 4 }}>
        {[
          ['', 'identity'],
          ['R2', 'R2'],
          ['U R2', 'U R2'],
          ["R U R'", "R U R'"],
          ["F R U' R' U' R U R' F'", 'OLL 26'],
          ["U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2", 'superflip'],
        ].map(([a, lbl]) => (
          <span key={lbl} className="gt-chip" onClick={() => setAlg(a)}>{lbl}</span>
        ))}
      </div>
      <div className="gt-twisty-inline" style={{ maxWidth: 280, margin: '20px auto' }}>
        <TwistyMini alg={alg} />
      </div>
      <div className="gt-sub-membership">
        {stages.map(s => (
          <div
            key={s.i}
            className={`gt-sub-stage ${s.i >= stage ? 'gt-sub-stage-active' : ''} ${s.i === stage ? 'gt-sub-stage-current' : ''}`}
          >
            <div style={{ fontFamily: 'var(--math)', fontStyle: 'italic', fontSize: 16, marginBottom: 4 }}>{s.name}</div>
            <div style={{ fontSize: 9, lineHeight: 1.4, opacity: .9 }}>{s.gens}</div>
          </div>
        ))}
      </div>
      <div className="gt-aside">
        {lang === 'zh'
          ? `当前状态位于 G${stage}。从这里可以只用 G${stage} 的生成元解开 (或保持)。`
          : `Current state is in G${stage}. From here, the cube can be solved using only G${stage}'s generators.`}
      </div>
    </div>
  );
}

// ── God's number distribution chart  Rokicki et al. 2010 ───────────────────
// HTM (half-turn metric) position counts at each depth. Rokicki, Kociemba,

// ── |G| scale comparison (§4) ─────────────────────────────────────────────
function QuotientChart() {
  // [G:G₁] = 2^11 = 2048
  // [G₁:G₂] = 3^7 · (12 choose 4) = 2187 · 495 = 1,082,565
  // [G₂:G₃] = 8C4 · 4! · 4! / 2 = 70 · 24 · 24 / 2 ... actually = 29400 from references
  // [G₃:G₄] = |G₃| = (4!)³ / 2 = 1,824 ... actually 663,552 = 2 · (4!)² · (4!)² / something
  const data: { label: string; size: number; zh: string; en: string
 }[] = [
    { label: '[G : G₁]',  size: 2_048,      zh: '修棱朝向: 12 个棱块每个 0/1 flip,但 Σeo=0',        en: 'orient edges: 12 binary flips constrained by Σeo=0'
    },
    { label: '[G₁: G₂]', size: 1_082_565,  zh: '修角朝向 + 棱归 UD 切片: 3⁷ × (12 choose 4)',         en: 'orient corners + UD slice: 3⁷ × (12 choose 4)'
    },
    { label: '[G₂: G₃]', size: 29_400,     zh: '角棱归各自的 G₃ 轨道',                              en: 'corners and edges into G₃ orbits'
    },
    { label: '[G₃: G₄]', size: 663_552,    zh: '只用半圈还原 — 多米诺群',                          en: 'solve with half-turns only — the "domino" group'
    },
  ];
  const max = Math.log10(Math.max(...data.map(d => d.size)));
  return (
    <div className="gt-quotients">
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 12 }}>
        {tr({ zh: 'Thistlethwaite 链各级商群大小', en: 'sizes of consecutive Thistlethwaite quotients'
        })}
      </div>
      {data.map((d, i) => (
        <div key={i} className="gt-quotient-row">
          <div className="gt-quotient-label">{d.label}</div>
          <div>
            <div className="gt-quotient-track">
              <div className="gt-quotient-fill" style={{ width: `${(Math.log10(d.size) / max) * 100}%` }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 6 }}>{tr(d)}</div>
          </div>
          <div className="gt-quotient-val">{d.size.toLocaleString()}</div>
        </div>
      ))}
      <div className="gt-aside" style={{ marginTop: 16 }}>
        {tr({ zh: '验证: 2048 × 1,082,565 × 29,400 × 663,552 = 4.3 × 10¹⁹ = |G| ✓', en: 'Sanity check: 2048 × 1,082,565 × 29,400 × 663,552 = 4.3 × 10¹⁹ = |G| ✓'
        })}
      </div>
    </div>
  );
}

export default function Thistlethwaite() {
  return (
      <GTSec id="thistlethwaite" className="gt-sec">
        <div className="gt-sec-num">§10</div>
        <h2 className="gt-sec-title">
          <L zh="子群链 — Thistlethwaite 的解法" en="Subgroup chain — Thistlethwaite's solver" />
        </h2>
        <p>
          <L
            zh={<>1981 年,数学家 Morwen Thistlethwaite 发现:与其试图直接还原 G,不如把它拆成 <strong>4 个嵌套子群</strong>,每一步只解决一个「难题」:</>}
            en={<>In 1981, the mathematician Morwen Thistlethwaite realised: rather than directly solving G, decompose it into a chain of <strong>four nested subgroups</strong>, each phase solving one constraint at a time:</>}
          />
        </p>
        <div className="gt-sgc">
          <div className="gt-sgc-cell">
            <div className="gt-sgc-name">G₀</div>
            <div className="gt-sgc-gens">⟨U, D, L, R, F, B⟩</div>
            <div className="gt-sgc-size">|G| = 4.3 × 10¹⁹</div>
            <span className="gt-sgc-arrow">⊃</span>
          </div>
          <div className="gt-sgc-cell">
            <div className="gt-sgc-name">G₁</div>
            <div className="gt-sgc-gens">⟨U, D, L, R, F2, B2⟩</div>
            <div className="gt-sgc-size">[G:G₁] = 2¹¹</div>
            <span className="gt-sgc-arrow">⊃</span>
          </div>
          <div className="gt-sgc-cell">
            <div className="gt-sgc-name">G₂</div>
            <div className="gt-sgc-gens">⟨U, D, L2, R2, F2, B2⟩</div>
            <div className="gt-sgc-size">[G₁:G₂] = 1,082,565</div>
            <span className="gt-sgc-arrow">⊃</span>
          </div>
          <div className="gt-sgc-cell">
            <div className="gt-sgc-name">G₃</div>
            <div className="gt-sgc-gens">⟨U2, D2, L2, R2, F2, B2⟩</div>
            <div className="gt-sgc-size">[G₂:G₃] = 29,400</div>
            <span className="gt-sgc-arrow">⊃</span>
          </div>
          <div className="gt-sgc-cell">
            <div className="gt-sgc-name" style={{ fontSize: 18 }}>G₄ = {'{e}'}</div>
            <div className="gt-sgc-gens">⟨⟩</div>
            <div className="gt-sgc-size">[G₃:G₄] = 663,552</div>
          </div>
        </div>
        <p>
          <L
            zh={<>每一阶都对应一个「打补丁」:<br />
              <strong>G → G₁</strong>:修棱块朝向 (EO=0)。<br />
              <strong>G₁ → G₂</strong>:修角块朝向 (CO=0) 并把 UD 切片棱块归位。<br />
              <strong>G₂ → G₃</strong>:把角块和棱块各自归到 4-轨道里 (减少剩余偶置换)。<br />
              <strong>G₃ → G₄</strong>:仅用半圈完成。
            </>}
            en={<>Each step "patches" one defect:<br />
              <strong>G → G₁</strong>: orient edges (EO = 0).<br />
              <strong>G₁ → G₂</strong>: orient corners (CO = 0) and bring UD-slice edges home.<br />
              <strong>G₂ → G₃</strong>: corners and edges in their G₃-orbits.<br />
              <strong>G₃ → G₄</strong>: finish using only half-turns.
            </>}
          />
        </p>
        <p>
          <L
            zh={<>Thistlethwaite 当年算出每阶最多 7 / 13 / 15 / 17 步, 加起来 <strong>52 步</strong> 必能还原任何状态。后来 Kociemba 把它精简为只用 2 阶: G → G₁ → {'{e}'},每阶最多 12 步, 上界 <strong>24 步</strong> —— 这就是 <em>two-phase</em> solver,至今每个有名的快速求解器都基于它。</>}
            en={<>Thistlethwaite originally bounded each phase at 7 / 13 / 15 / 17 moves, totalling <strong>52 moves</strong> for any state. Kociemba later collapsed this into a 2-phase chain G → G₁ → {'{e}'}, each phase ≤ 12 moves, total ≤ <strong>24</strong>. This is the famous <em>two-phase algorithm</em> behind every modern fast solver.</>}
          />
        </p>
        <SubgroupClimber />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="10.1  各级商群大小" en="10.1  Sizes of the quotients" />
        </h3>
        <p>
          <L
            zh={<>Thistlethwaite 链中, 每一级 <TeX src={`[G_i : G_{i+1}]`} /> 就是「这一阶段需要查表的状态数」。 这些数直接决定了 solver 的内存开销:</>}
            en={<>Each Thistlethwaite step's quotient size <TeX src={`[G_i : G_{i+1}]`} /> equals the number of states to look up at that phase. These numbers directly drive a solver's memory footprint:</>}
          />
        </p>
        <QuotientChart />
        <p>
          <L
            zh={<>Kociemba 把这 4 阶合并为 2 阶: G → G_1 → {`{e}`}, 商大小分别是 2 × 10⁹ 和 1.95 × 10¹⁰。这两个查表 (pruning tables) 共占用约 100 MB 内存, 但能在毫秒内求解任何状态 (typically 24 步以内)。每个魔方应用 (Cube Explorer, csTimer 内置 solver) 都在背后使用这套结构。</>}
            en={<>Kociemba consolidated this 4-phase chain into a 2-phase one: G → G_1 → {`{e}`}, with quotient sizes 2 × 10⁹ and 1.95 × 10¹⁰. The two pruning tables fit in ~100 MB, and solve any state in milliseconds (typically ≤ 24 moves). Every cube app (Cube Explorer, csTimer's built-in solver, ...) is powered by this structure.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="10.2  陪集 (Cosets)" en="10.2  Cosets" />
        </h3>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 10.1', en: 'Definition 10.1'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>设 <TeX src={`H \\subseteq G`} /> 是子群, <TeX src={`g \\in G`} />。 <strong>左陪集</strong>: <TeX src={`gH = \\{gh : h \\in H\\}`} />。 陪集大小都等于 <TeX src={`|H|`} />, 且 G 被陪集划分为 <TeX src={`[G:H]`} /> 个互不相交的集合。</>}
              en={<>Let <TeX src={`H \\subseteq G`} /> be a subgroup, <TeX src={`g \\in G`} />. The <strong>left coset</strong> is <TeX src={`gH = \\{gh : h \\in H\\}`} />. All cosets have size <TeX src={`|H|`} />, and G partitions into <TeX src={`[G:H]`} /> disjoint cosets.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>Thistlethwaite solver 的核心想法: <em>把魔方状态映射到陪集</em>, 不关心同一陪集内的具体「微调」, 只关心 「现在位于哪个陪集」。每一阶的工作是「跳到下一个 (更小的) 陪集」, 直到落到 G_4 = {`{e}`}。陪集化是让指数级问题变成多项式级的关键技巧。</>}
            en={<>The Thistlethwaite solver's key idea: <em>map cube states to cosets</em>, ignoring the fine structure within a coset. Each phase moves to the next (smaller) coset until reaching G_4 = {`{e}`}. Cosets are the trick that turns an exponential problem into a polynomial one.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="10.3  Lagrange 定理" en="10.3  Lagrange's theorem" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 10.2 — Lagrange', en: 'Theorem 10.2 — Lagrange' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>设 <TeX src={`H \\subseteq G`} /> 是有限群的子群, 则 <TeX src={`|H| \\,\\bigm|\\, |G|`} /> (即 <TeX src={`|H|`} /> 整除 <TeX src={`|G|`} />), 且 <TeX src={`|G| = |H| \\cdot [G:H]`} />。</>}
              en={<>Let <TeX src={`H \\subseteq G`} /> be a subgroup of a finite group. Then <TeX src={`|H| \\,\\bigm|\\, |G|`} /> (i.e. <TeX src={`|H|`} /> divides <TeX src={`|G|`} />), and <TeX src={`|G| = |H| \\cdot [G:H]`} />.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个最基本的群论定理在魔方上的意义:任何子群的阶都必须整除 4.3 × 10¹⁹。所以 ⟨R, U⟩ 的阶 73,483,200 整除 |G|, ⟨U⟩ 阶 4 整除, |G_3| = 663,552 整除 — 都自动成立。</>}
            en={<>The most basic theorem in group theory says: any subgroup's order must divide 4.3 × 10¹⁹. So ⟨R, U⟩ has order 73,483,200 | |G|, ⟨U⟩ has order 4 | |G|, |G_3| = 663,552 | |G| — all automatic.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="10.4  各阶状态空间与直径" en="10.4  State-space size and diameter per phase" />
        </h3>
        <p>
          <L
            zh={<>四阶段每阶段需要查的「状态」(陪集) 数量, 以及在该陪集图上的 BFS 直径:</>}
            en={<>For each phase, the number of states (cosets) and the BFS diameter on that coset graph:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '阶段', en: 'Phase'
            })}</th><th>{tr({ zh: '陪集大小', en: 'Coset size' })}</th><th>{tr({ zh: '直径 (HTM)', en: 'Diameter (HTM)'
            })}</th><th>{tr({ zh: '坐标含义', en: 'Coordinate'
            })}</th></tr>
          </thead>
          <tbody>
            <tr><td><TeX src={`G \\to G_1`} /></td><td className="num">2¹¹ = 2,048</td><td className="num">7</td><td>{tr({ zh: '12 棱朝向 (mod 11 自由)', en: '12-edge orientation (11 free)'
            })}</td></tr>
            <tr><td><TeX src={`G_1 \\to G_2`} /></td><td className="num">3⁷ · <TeX src={`\\binom{12}{4}`} /> = 2187 · 495 = 1,082,565</td><td className="num">10</td><td>{tr({ zh: '7 角朝向 + UD-slice 棱位置', en: '7-corner orient. + UD-slice edge placement'
            })}</td></tr>
            <tr><td><TeX src={`G_2 \\to G_3`} /></td><td className="num">29,400</td><td className="num">13</td><td>{tr({ zh: '角块进 4-轨道 + 棱块进 4-轨道', en: 'corners and edges into 4-orbits'
            })}</td></tr>
            <tr><td><TeX src={`G_3 \\to \\{e\\}`} /></td><td className="num">663,552</td><td className="num">15</td><td>{tr({ zh: '半圈子群,domino group', en: 'half-turn-only "domino" group' })}</td></tr>
            <tr><td>{tr({ zh: '总上界', en: 'Total upper bound'
            })}</td><td colSpan={2} className="num"><strong>7 + 10 + 13 + 15 = 45</strong></td><td>{tr({ zh: '原 Thistlethwaite 1981 给的是 52,后人收紧', en: 'original 1981 Thistlethwaite gave 52; later refined'
            })}</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>Reid (1995) 把上界收紧到 <strong>≤ 52</strong> HTM (即原 Thistlethwaite 给的同值); Korf 等人后续工作的实验上界为 <strong>≤ 38</strong>。 Rokicki 2010 用 §11 介绍的 「合并 G → G₂」 直接搜把 worst case 推到精确的 20。</>}
            en={<>Reid (1995) tightened the upper bound to <strong>≤ 52</strong> HTM (matching Thistlethwaite's original); Korf's later experiments showed <strong>≤ 38</strong> empirically. Rokicki (2010) then merged "G → G₂ direct search" — described in §11 — to drive the worst case to exactly 20.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="10.5  Kociemba 「合并 G → G₂」 改进思路" en={`10.5  Kociemba's "merge G → G₂"`} />
        </h3>
        <p>
          <L
            zh={<>Thistlethwaite 用 4 阶段是因为每阶段陪集表都能放入 1980 年代的内存 (≤ 10⁶)。 1990 年代 Kociemba 注意到, <TeX src={`G \\to G_2`} /> 这一大跳跃的陪集数恰好是<TeXBlock src={`[G : G_2] \\;=\\; 2{,}217{,}093{,}120 \\;=\\; 2^{11} \\cdot 3^7 \\cdot \\tbinom{12}{4} \\cdot \\text{(more)}`} /></>}
            en={<>Thistlethwaite used 4 stages because each coset table had to fit into 1980s RAM (≤ 10⁶). Kociemba (1990s) noticed that the <em>combined</em> jump <TeX src={`G \\to G_2`} /> has<TeXBlock src={`[G : G_2] \\;=\\; 2{,}217{,}093{,}120 \\;=\\; 2^{11} \\cdot 3^7 \\cdot \\tbinom{12}{4} \\cdot \\text{(more)}`} /></>}
          />
        </p>
        <p>
          <L
            zh={<>由 Lagrange, <TeX src={`|G| = [G:G_2] \\cdot |G_2|`} />, 验证 <TeX src={`|G_2| = |G| / 2{,}217{,}093{,}120 \\approx 1.95 \\times 10^{10}`} /> — 与已知值一致。 用 IDA* 加大小约 2 GB 的 pruning table 直接搜 G → G₂, 配合 G₂ 内部的快速 BFS, 这就是现代 two-phase 求解器 (Kociemba 1992; Reid 优化版 cube20)。 平均 ~21 HTM, worst case 20 HTM。</>}
            en={<>By Lagrange, <TeX src={`|G| = [G:G_2] \\cdot |G_2|`} />, so <TeX src={`|G_2| = |G| / 2{,}217{,}093{,}120 \\approx 1.95 \\times 10^{10}`} /> — matching the known value. IDA* with a ~2 GB pruning table searches G → G₂, then BFS finishes within G₂ — the modern two-phase solver (Kociemba 1992; Reid's cube20 refinements). Average ~21 HTM, worst case 20.</>}
          />
        </p>
      </GTSec>
  );
}
