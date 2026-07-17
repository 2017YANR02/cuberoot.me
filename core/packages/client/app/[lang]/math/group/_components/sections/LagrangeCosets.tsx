'use client';

import { useState, useMemo } from 'react';
import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { applyAlg, identity, CubieState } from '../cube_state';
import { tr } from '@/i18n/tr';

// "fabric" panel that shows how G splits.
const COSET_SUBGROUPS = [
  { id: 'U',    gens: ['U'],                  name: '⟨U⟩',          orderApprox: 4,            zh: '只转 U', en: 'only U'
},
  { id: 'U2',   gens: ['U2'],                 name: '⟨U²⟩',         orderApprox: 2,            zh: '只 180° U', en: 'only U2' },
  { id: 'UD',   gens: ['U', 'D'],             name: '⟨U,D⟩',        orderApprox: 16,           zh: '上下面', en: 'U, D faces' },
  { id: 'RU',   gens: ['R', 'U'],             name: '⟨R,U⟩',        orderApprox: 73483200,     zh: 'R, U (2 面群)', en: 'R, U (2-gen)' },
  { id: 'half', gens: ['U2','D2','L2','R2','F2','B2'], name: '⟨U²,D²,L²,R²,F²,B²⟩', orderApprox: 663552, zh: '半圈群 (G₃)', en: 'half-turn G₃' },
] as const;

function stateKey(s: CubieState): string {
  return s.cp.join(',') + '|' + s.co.join(',') + '|' + s.ep.join(',') + '|' + s.eo.join(',');
}

function bfsSubgroupSize(genTokens: string[], cap: number): { size: number; capped: boolean } {
  const start = identity();
  const visited = new Set<string>([stateKey(start)]);
  const queue: CubieState[] = [start];
  while (queue.length > 0 && visited.size < cap) {
    const cur = queue.shift()!;
    for (const g of genTokens) {
      const nxt = applyAlg(cur, g);
      const k = stateKey(nxt);
      if (!visited.has(k)) {
        visited.add(k);
        queue.push(nxt);
        if (visited.size >= cap) break;
      }
    }
  }
  return { size: visited.size, capped: visited.size >= cap };
}

function formatBig(n: number): string {
  if (n < 1e6) return n.toLocaleString('en-US');
  if (n < 1e12) return (n / 1e6).toFixed(2) + ' × 10⁶';
  if (n < 1e15) return (n / 1e9).toFixed(2) + ' × 10⁹';
  return n.toExponential(3).replace('e+', ' × 10');
}

function CosetVisualizer() {
  const lang = useLang();
  const [picked, setPicked] = useState<typeof COSET_SUBGROUPS[number]['id']>('UD');
  const sub = COSET_SUBGROUPS.find(s => s.id === picked)!;
  // Cap small subgroups at exact, big ones at known order.
  const measured = useMemo(() => {
    if (sub.orderApprox <= 256) return bfsSubgroupSize(sub.gens as unknown as string[], 1024);
    return { size: sub.orderApprox, capped: true };
  }, [sub]);
  const G_ORDER = 4.3252003274489856e19;
  const numCosets = G_ORDER / measured.size;
  return (
    <div className="gt-coset-viz">
      <div className="gt-coset-pickrow">
        {COSET_SUBGROUPS.map(s => (
          <button
            key={s.id}
            className={`gt-coset-chip ${picked === s.id ? 'active' : ''}`}
            onClick={() => setPicked(s.id)}
          >
            <span className="gt-mono" style={{ fontWeight: 600 }}>{s.name}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 8 }}>{tr(s)}</span>
          </button>
        ))}
      </div>
      <div className="gt-coset-stats">
        <div className="gt-coset-stat">
          <div className="gt-coset-stat-lbl">{tr({ zh: '子群阶 |H|', en: '|H|'
        })}</div>
          <div className="gt-coset-stat-val">{measured.size <= 65536 ? measured.size.toLocaleString() : formatBig(measured.size)}</div>
        </div>
        <div className="gt-coset-stat">
          <div className="gt-coset-stat-lbl">{tr({ zh: '陪集数 [G:H]', en: '[G:H]'
        })}</div>
          <div className="gt-coset-stat-val">{formatBig(numCosets)}</div>
        </div>
        <div className="gt-coset-stat">
          <div className="gt-coset-stat-lbl">{tr({ zh: '整除性', en: 'divides |G|?' })}</div>
          <div className="gt-coset-stat-val gt-coset-stat-ok">
            {Number.isInteger(numCosets) ? '✓' : '✗'}
          </div>
        </div>
      </div>
      <div className="gt-coset-eqn">
        <TeXBlock src={`|G| = ${measured.size <= 65536 ? measured.size : sub.orderApprox.toExponential(2)} \\cdot ${numCosets.toExponential(3).replace('e+', ' \\times 10^{') + '}'} = 43{,}252{,}003{,}274{,}489{,}856{,}000`} />
      </div>
      <div className="gt-coset-fabric">
        {/* Visual: each cell = one coset gH. Cap at 144 cells for display. */}
        {Array.from({ length: Math.min(144, Math.max(4, Math.round(Math.log2(numCosets)) * 12)) }, (_, i) => (
          <div key={i} className="gt-coset-cell" style={{ background: `hsl(${(i * 37) % 360}, 30%, var(--coset-l, 55%))` }}>
            <span className="gt-mono" style={{ fontSize: 9 }}>g{i}H</span>
          </div>
        ))}
      </div>
      <div className="gt-aside" style={{ marginTop: 12, fontSize: 13 }}>
        {lang === 'zh'
          ? <>每个色块代表一个陪集 <span className="gt-mono">gH</span>。所有陪集互不相交,大小都等于 <span className="gt-mono">|H|</span>,合起来等于整个 <span className="gt-mono">G</span>。 这就是 <strong>拉格朗日定理</strong>。</>
          : <>Each tile is one coset <span className="gt-mono">gH</span>. Cosets are pairwise disjoint, each of size <span className="gt-mono">|H|</span>; together they exhaust <span className="gt-mono">G</span>. This is <strong>Lagrange's theorem</strong>.</>}
      </div>
    </div>
  );
}

// ── §20 QuotientGroupBuilder — pick a normal subgroup, view G/N ───────────

export default function LagrangeCosets() {
  const lang = useLang();
  return (
      <GTSec id="lagrange" className="gt-sec">
        <div className="gt-sec-num">§19</div>
        <h2 className="gt-sec-title">
          <L zh="拉格朗日定理与陪集" en="Lagrange's theorem & cosets" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>「子群有多大」是描述 G 内部结构最基础的问题之一。拉格朗日定理把这件事完全钉死:<strong>每个子群的阶 必须整除整个群的阶</strong>。这一条把 G 内可能的子群限制得非常严格。</>}
            en={<>"How big can a subgroup be?" is one of the most basic structural questions about G. Lagrange's theorem nails it down: <strong>the order of every subgroup must divide the order of the whole group</strong>. A single divisibility constraint that severely restricts what subgroups can exist.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 19.1 — 陪集', en: 'Definition 19.1 — coset'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>令 <span className="gt-math">H</span> 是群 <span className="gt-math">G</span> 的子群。 对任意 <span className="gt-math">g ∈ G</span>,记<TeXBlock src={`gH \\;=\\; \\{\\, gh \\;:\\; h \\in H \\,\\}`} />为 <strong>g 的左陪集</strong>。 类似地有右陪集 <TeX src={`Hg`} />。 两个陪集要么 <em>完全相等</em> 要么 <em>不相交</em>。</>}
              en={<>Let <span className="gt-math">H</span> be a subgroup of <span className="gt-math">G</span>. For any <span className="gt-math">g ∈ G</span>, the <strong>left coset</strong> of g is<TeXBlock src={`gH \\;=\\; \\{\\, gh \\;:\\; h \\in H \\,\\}.`} />Right cosets <TeX src={`Hg`} /> are defined similarly. Any two cosets are either <em>identical</em> or <em>disjoint</em>.</>}
            />
          </div>
        </div>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定理 19.2 — 拉格朗日 (1771)', en: 'Theorem 19.2 — Lagrange (1771)' })}</div>
          <div className="gt-def-body">
            <L
              zh={<><TeXBlock src={`|G| \\;=\\; [G : H] \\cdot |H|`} />其中 <TeX src={`[G:H]`} /> 是 <em>陪集数</em> (也叫指数)。 推论:<TeX src={`|H| \\mid |G|`} />。 任何 H 的阶都整除 |G|。</>}
              en={<><TeXBlock src={`|G| \\;=\\; [G : H] \\cdot |H|`} />where <TeX src={`[G:H]`} /> is the <em>number of cosets</em> (the index). Corollary: <TeX src={`|H| \\mid |G|`} />. Any subgroup's order divides the order of the whole group.</>}
            />
          </div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="19.1  证明概要" en="19.1  Proof sketch" />
        </h3>
        <p>
          <L
            zh={<>定义 <span className="gt-math">a ∼ b ⇔ a⁻¹b ∈ H</span>。验证这是 G 上的等价关系 (自反、对称、传递)。等价类就是左陪集 <TeX src={`gH`} />。所以 G 被分成不相交的等价类。每个类大小都等于 |H|: 因为映射 <TeX src={`h \\mapsto gh`} /> 是从 H 到 gH 的双射。所以总元素数 = (类数) × (每类大小)。 ∎</>}
            en={<>Define <span className="gt-math">a ∼ b ⇔ a⁻¹b ∈ H</span>. This is an equivalence relation on G; its classes are the left cosets <TeX src={`gH`} />, so G partitions into disjoint classes. Each class has size |H| because the map <TeX src={`h \\mapsto gh`} /> is a bijection H → gH. Hence total = (# classes) × (size per class). ∎</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="19.2  互动:选一个子群,看陪集分布" en="19.2  Interactive: pick a subgroup, see its cosets" />
        </h3>
        <CosetVisualizer />
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="19.3  关键推论" en="19.3  Key corollaries" />
        </h3>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><strong>元素阶整除群阶</strong>: 因为 <TeX src={`\\langle g \\rangle`} /> 是子群,而它的阶就是 g 的阶。 故 <TeX src={`\\operatorname{ord}(g) \\mid |G|`} />。</>}
            en={<><strong>Element order divides group order</strong>: since <TeX src={`\\langle g \\rangle`} /> is a subgroup of order = ord(g), Lagrange gives <TeX src={`\\operatorname{ord}(g) \\mid |G|`} />.</>}
          /></li>
          <li><L
            zh={<><strong>魔方上元素阶最大 1260</strong>: 因为 |G| = 2²⁷ · 3¹⁴ · 5³ · 7² · 11,任何元素阶都必须整除 |G|;在这个约束下,1260 = 2² · 3² · 5 · 7 是实际能构造的最大阶。</>}
            en={<><strong>The max element order on the cube is 1260</strong>: because |G| = 2²⁷ · 3¹⁴ · 5³ · 7² · 11, every element order must divide |G|; subject to that constraint, 1260 = 2² · 3² · 5 · 7 is the largest constructible order.</>}
          /></li>
          <li><L
            zh={<><strong>素数阶群一定循环</strong>: 若 |G| = p (素),G 只有平凡子群和自身。任一非单位元 g 生成 G。所以 G ≅ ℤ/p。</>}
            en={<><strong>Groups of prime order are cyclic</strong>: if |G| = p (prime), the only subgroups are {'{e}'} and G; so any non-identity g generates G. Hence G ≅ ℤ/p.</>}
          /></li>
        </ul>
        <div className="gt-aside" style={{ marginTop: 16 }}>
          <L
            zh={<>注意拉格朗日定理是 <strong>必要不充分</strong> 的: 整除并不蕴含「存在该阶的子群」。 例如 A₄ (12 阶) 没有阶 6 的子群,虽然 6 | 12。 充分性需要的额外条件由 <strong>Sylow 定理</strong> 给出。</>}
            en={<>Lagrange is <strong>necessary but not sufficient</strong>: divisibility doesn't guarantee a subgroup of that order exists. For example, A₄ (order 12) has no subgroup of order 6, even though 6 | 12. The sufficient direction requires <strong>Sylow's theorems</strong>.</>}
          />
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="19.4  Cauchy 定理 — 拉格朗日的部分逆" en="19.4  Cauchy's theorem — partial converse to Lagrange" />
        </h3>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 19.4 — Cauchy (1845)', en: 'Theorem 19.4 — Cauchy (1845)' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>若 <strong>素数</strong> <TeX src={`p`} /> 整除 <TeX src={`|G|`} />,则 G 中存在阶 <em>恰好</em> 为 <TeX src={`p`} /> 的元素 (从而存在阶 p 的子群 <TeX src={`\\langle g \\rangle`} />)。</>}
              en={<>If a <strong>prime</strong> <TeX src={`p`} /> divides <TeX src={`|G|`} />, then G contains an element of order <em>exactly</em> <TeX src={`p`} /> (hence a subgroup of order p, namely <TeX src={`\\langle g \\rangle`} />).</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>魔方上,|G| 的素因子是 <TeX src={`\\{\\,2,\\,3,\\,5,\\,7,\\,11\\,\\}`} />。 Cauchy 保证 G 中存在阶恰好 2, 3, 5, 7, 11 的元素:</>}
            en={<>For the cube, the prime divisors of |G| are <TeX src={`\\{\\,2,\\,3,\\,5,\\,7,\\,11\\,\\}`} />. Cauchy guarantees that G contains elements of order exactly 2, 3, 5, 7, 11:</>}
          />
        </p>
        <table className="gt-cauchy-tbl">
          <thead>
            <tr>
              <th>p</th>
              <th>{tr({ zh: '阶 p 的元素 (示例)', en: 'element of order p (example)'
            })}</th>
              <th>{tr({ zh: '解释', en: 'why'
            })}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="num">2</td>
              <td><span className="gt-mono">U<sup>2</sup></span></td>
              <td><L zh="任一半圈" en="any half-turn" /></td>
            </tr>
            <tr>
              <td className="num">3</td>
              <td><span className="gt-mono">U</span></td>
              <td><L zh="四分之一圈,阶 4 = 2² ≠ 3。 真正阶 3:[R, U][R, U]" en="quarter-turn has order 4 = 2². For order 3: a corner-3-cycle, e.g. [R, U] applied twice." /></td>
            </tr>
            <tr>
              <td className="num">5</td>
              <td><span className="gt-mono">R U R' U R U<sup>2</sup> R'</span><L zh="(部分变体)" en=" (Sune variant)" /></td>
              <td><L zh="角块 3 旋转构成 5-循环时" en="a permutation containing a 5-cycle in the corner or edge sector" /></td>
            </tr>
            <tr>
              <td className="num">7</td>
              <td><L zh="任何含 7-循环的状态" en="any state with a 7-cycle"/></td>
              <td><L zh="如 7 棱构成单循环" en="e.g. a single 7-cycle on edges"/></td>
            </tr>
            <tr>
              <td className="num">11</td>
              <td><L zh="11-循环 (角或棱)" en="an 11-cycle (corner or edge sector)" /></td>
              <td><L zh="11 整除 12!,所以 S₁₂ 含 11-循环" en="11 divides 12!, so S₁₂ contains 11-cycles" /></td>
            </tr>
          </tbody>
        </table>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 36, marginBottom: 12, color: 'var(--ink)' }}>
          <L zh="19.5  Sylow 定理 — Cauchy 的强化" en="19.5  Sylow theorems — Cauchy's full strengthening" />
        </h3>
        <p>
          <L
            zh={<>拉格朗日定理只给「必要」 条件; Cauchy 给出素数阶的「存在性」; <strong>Sylow 定理</strong> (1872) 给出 <em>所有素数幂阶</em> 子群的精确刻画。 写 <TeX src={`|G| = p^a \\cdot m`} />,其中 <TeX src={`\\gcd(p, m) = 1`} />。</>}
            en={<>Lagrange gives only necessity; Cauchy provides existence at prime order; <strong>Sylow's theorems</strong> (1872) precisely describe <em>all prime-power-order subgroups</em>. Write <TeX src={`|G| = p^a \\cdot m`} /> with <TeX src={`\\gcd(p, m) = 1`} />.</>}
          />
        </p>
        <div className="gt-def">
          <div className="gt-def-title">{tr({ zh: '定义 19.5 — Sylow p-子群', en: 'Definition 19.5 — Sylow p-subgroup'
        })}</div>
          <div className="gt-def-body">
            <L
              zh={<>子群 <TeX src={`P \\subseteq G`} /> 的阶恰为 <TeX src={`p^a`} /> (即 |G| 中 p 的最高次幂) 时, 称 P 为 G 的 <strong>Sylow p-子群</strong>。 记 <TeX src={`n_p`} /> 为 G 中 Sylow p-子群的个数。</>}
              en={<>A subgroup <TeX src={`P \\subseteq G`} /> with order exactly <TeX src={`p^a`} /> (the maximal p-power dividing |G|) is called a <strong>Sylow p-subgroup</strong> of G. Let <TeX src={`n_p`} /> denote the number of Sylow p-subgroups.</>}
            />
          </div>
        </div>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 19.6 — Sylow 三条', en: 'Theorem 19.6 — the three Sylow theorems'
        })}</div>
          <div className="gt-thm-body">
            <ol style={{ paddingLeft: 22, lineHeight: 1.95, margin: 0 }}>
              <li><L zh={<><strong>存在</strong>: G 至少含有一个 Sylow p-子群 (即 <TeX src={`n_p \\ge 1`} />)。</>} en={<><strong>Existence</strong>: G has at least one Sylow p-subgroup (so <TeX src={`n_p \\ge 1`} />).</>} /></li>
              <li><L zh={<><strong>共轭</strong>: 任意两个 Sylow p-子群在 G 中共轭, 因而相互同构。 G 的任一阶为 p 的幂的子群都包含在某个 Sylow p-子群里。</>} en={<><strong>Conjugacy</strong>: any two Sylow p-subgroups of G are conjugate (hence isomorphic). Every subgroup of G of p-power order is contained in some Sylow p-subgroup.</>} /></li>
              <li><L zh={<><strong>计数</strong>: <TeX src={`n_p \\,\\bigm|\\, m`} /> 且 <TeX src={`n_p \\equiv 1 \\pmod{p}`} />。</>} en={<><strong>Counting</strong>: <TeX src={`n_p \\,\\bigm|\\, m`} /> and <TeX src={`n_p \\equiv 1 \\pmod{p}`} />.</>} /></li>
            </ol>
          </div>
        </div>
        <p>
          <L
            zh={<>魔方上 |G| = 2<sup>27</sup> · 3<sup>14</sup> · 5<sup>3</sup> · 7<sup>2</sup> · 11。 Sylow p-子群的阶分别是:</>}
            en={<>For the cube, |G| = 2<sup>27</sup> · 3<sup>14</sup> · 5<sup>3</sup> · 7<sup>2</sup> · 11. Sylow subgroup orders are:</>}
          />
        </p>
        <table className="gt-sylow-tbl">
          <thead>
            <tr>
              <th>p</th>
              <th>{tr({ zh: 'Sylow 阶', en: 'Sylow order'
            })}</th>
              <th>{tr({ zh: '十进制', en: 'decimal'
            })}</th>
              <th>{lang === 'zh' ? 'm = |G|/p^a' : 'm = |G|/p^a'}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="num">2</td><td className="num">2<sup>27</sup></td><td className="num">134,217,728</td><td className="num">3<sup>14</sup> · 5<sup>3</sup> · 7<sup>2</sup> · 11</td></tr>
            <tr><td className="num">3</td><td className="num">3<sup>14</sup></td><td className="num">4,782,969</td><td className="num">2<sup>27</sup> · 5<sup>3</sup> · 7<sup>2</sup> · 11</td></tr>
            <tr><td className="num">5</td><td className="num">5<sup>3</sup></td><td className="num">125</td><td className="num">2<sup>27</sup> · 3<sup>14</sup> · 7<sup>2</sup> · 11</td></tr>
            <tr><td className="num">7</td><td className="num">7<sup>2</sup></td><td className="num">49</td><td className="num">2<sup>27</sup> · 3<sup>14</sup> · 5<sup>3</sup> · 11</td></tr>
            <tr><td className="num">11</td><td className="num">11</td><td className="num">11</td><td className="num">2<sup>27</sup> · 3<sup>14</sup> · 5<sup>3</sup> · 7<sup>2</sup></td></tr>
          </tbody>
        </table>
        <div className="gt-aside" style={{ marginTop: 14 }}>
          <L
            zh={<>魔方的 Sylow 2-子群 (阶 ~1.3 亿) 是最大的, 反映 G 中 「翻转 / 半圈 / 偶奇」 这些 2-周期结构占据了大量自由度。 Sylow 11-子群只有 11 个元素, 但根据定理 19.6 第三条, <TeX src={`n_{11} \\equiv 1 \\pmod{11}`} /> 且 <TeX src={`n_{11} \\,\\bigm|\\, 2^{27} \\cdot 3^{14} \\cdot 5^3 \\cdot 7^2`} />, 把可能的 <TeX src={`n_{11}`} /> 限制到一个非常小的数集。</>}
            en={<>The cube's Sylow 2-subgroup (order ~1.3 × 10<sup>8</sup>) is by far the largest, reflecting that G is dominated by 2-periodic structure (flips, half-turns, parity). The Sylow 11-subgroup has only 11 elements; by 19.6.3, <TeX src={`n_{11} \\equiv 1 \\pmod{11}`} /> and <TeX src={`n_{11} \\,\\bigm|\\, 2^{27} \\cdot 3^{14} \\cdot 5^3 \\cdot 7^2`} />, which severely restricts the possible counts.</>}
          />
        </div>
      </GTSec>
  );
}
