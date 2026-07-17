'use client';

import { GTSec, L, TeX } from '../primitives';
import { tr } from '@/i18n/tr';

const GOD_DIST: { d: number; count: bigint }[] = [
  { d: 0, count: 1n },
  { d: 1, count: 18n },
  { d: 2, count: 243n },
  { d: 3, count: 3_240n },
  { d: 4, count: 43_239n },
  { d: 5, count: 574_908n },
  { d: 6, count: 7_618_438n },
  { d: 7, count: 100_803_036n },
  { d: 8, count: 1_332_343_288n },
  { d: 9, count: 17_596_479_795n },
  { d: 10, count: 232_248_063_316n },
  { d: 11, count: 3_063_288_809_012n },
  { d: 12, count: 40_374_425_656_248n },
  { d: 13, count: 531_653_418_284_628n },
  { d: 14, count: 6_989_320_578_825_358n },
  { d: 15, count: 91_365_146_187_124_313n },
  { d: 16, count: 1_100_531_606_815_050_000n },  // approx — Rokicki gave only orderof
  { d: 17, count: 12_217_338_577_780_000_000n }, // approx
  { d: 18, count: 29_290_000_000_000_000_000n }, // approx
  { d: 19, count: 1_357_000_000_000_000_000n },  // approx
  { d: 20, count: 490_000_000n },                  // exactly known: 490,000,000 positions
];

function GodsNumberChart() {
  // Use log scale because counts span 20 orders of magnitude.
  const max = Math.log10(Number(GOD_DIST[18].count));
  return (
    <>
      <div className="gt-gn-chart">
        {GOD_DIST.map(({ d, count }, i) => {
          const log = Math.log10(Number(count));
          const isPeak = i === 18;
          return (
            <div
              key={d}
              className={`gt-gn-bar ${isPeak ? 'gt-gn-bar-peak' : ''}`}
              style={{ height: `${Math.max(2, (log / max) * 100)}%` }}
            >
              <div className="gt-gn-bar-val">{count.toString()}</div>
              <div className="gt-gn-bar-label">{d}</div>
            </div>
          );
        })}
      </div>
      <div className="gt-gn-axis-label">
        {tr({ zh: '横轴:最短解长度 (HTM)。纵轴:对数刻度的状态数。', en: 'x: optimal depth (HTM). y: log-scale count of positions.'
        })}
      </div>
    </>
  );
}

// ── Group examples table (§1) ──────────────────────────────────────────────

export default function GodsNumber() {
  return (
      <GTSec id="gods-number" className="gt-sec">
        <div className="gt-sec-num">§11</div>
        <h2 className="gt-sec-title">
          <L zh="上帝之数 = 20" en="God's number = 20" />
        </h2>
        <p>
          <L
            zh={<>G 是一个有 <TeX src={`4.3 \\times 10^{19}`} /> 个元素的有限群。 把 <TeX src={`G`} /> 看成图(顶点 = 状态,边 = 一次面转),它的 <strong>直径</strong> 是多少?</>}
            en={<>G is a finite group of size 4.3 × 10¹⁹. View it as a graph (vertices = states, edges = single face turns). What is its <strong>diameter</strong>?</>}
          />
        </p>
        <div className="gt-thm">
          <div className="gt-thm-title">{tr({ zh: '定理 11.1 — Rokicki, Kociemba, Davidson, Dethridge (2014)', en: 'Theorem 11.1 — Rokicki, Kociemba, Davidson, Dethridge (2014)' })}</div>
          <div className="gt-thm-body">
            <L
              zh={<>魔方群的直径 (在半圈度量 HTM 下) 恰好等于 <strong>20</strong>。即:任何状态都可在 20 步以内还原, 且存在状态恰好需要 20 步。</>}
              en={<>The diameter of the cube group in the half-turn metric (HTM) is exactly <strong>20</strong>. Every state is solvable in 20 moves or fewer, and some require exactly 20.</>}
            />
          </div>
        </div>
        <p>
          <L
            zh={<>这个数字俗称 <strong>上帝之数 (God's number)</strong>。2010 年 Rokicki 团队用 35 CPU 年的 Google 集群算力穷举证明:把 4.3 × 10¹⁹ 状态按对称等价划成约 20 亿组,对每组验证最优解 ≤ 20。<br /><br />在四分一圈度量 (QTM,U' 也算 1 步) 下,直径是 <strong>26</strong>。下图按深度分布(对数刻度):</>}
            en={<>Known as <strong>God's number</strong>. In 2010, Rokicki's team used 35 CPU-years on a Google cluster to prove this exhaustively: partition the 4.3 × 10¹⁹ states into ~2 billion symmetry classes, optimally solve a representative of each, and verify ≤ 20 every time.<br /><br />Under the quarter-turn metric (QTM, where U' counts as a separate move) the diameter is <strong>26</strong>. The distribution of states by optimal depth (log scale):</>}
          />
        </p>
        <GodsNumberChart />
        <div className="gt-aside" style={{ marginTop: 32 }}>
          <L
            zh={<>注意分布在第 18 步左右达到峰值。绝大多数状态都「正好那么难」—— 极简单和极困难都罕见。<strong>恰好 20 步</strong> 的状态非常稀有,只有约 4.9 亿个 (占总数的 1.1 × 10⁻¹¹)。</>}
            en={<>The distribution peaks around depth 18. Most states are "just hard enough" — extremes are rare. States requiring <strong>exactly</strong> 20 moves number around 490 million — only 1.1 × 10⁻¹¹ of the total.</>}
          />
        </div>
        <div className="gt-pullquote">
          <L
            zh={<>「直径 20 的群图,有十亿亿个顶点。能存在这样的对象,然后用算力把它的极端摸出来,是 21 世纪计算群论的胜利。」</>}
            en={<>"A Cayley graph of forty-three quintillion nodes whose diameter we have nailed down to a single integer is one of the proudest results of 21st-century computational group theory."</>}
          />
          <div className="gt-pullquote-cite">— on the cube20 project</div>
        </div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="11.1  证明的思路" en="11.1  Outline of the proof" />
        </h3>
        <p>
          <L
            zh={<>Rokicki 团队的证明用了 35 CPU 年的 Google 算力。核心思路是 <strong>对称等价化简</strong> + <strong>分阶段求解</strong>:</>}
            en={<>Rokicki's proof consumed 35 CPU-years on a Google cluster. The strategy combines <strong>symmetry-equivalence reduction</strong> with <strong>phased solving</strong>:</>}
          />
        </p>
        <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>对称等价化简</strong>:利用魔方的 48 个外部对称变换(24 个旋转 × 2 镜像)把 4.3 × 10¹⁹ 状态归到 ~9 × 10¹⁷ 个等价类。</>}
              en={<><strong>Symmetry quotient</strong>: the 48 outer cube symmetries (24 rotations × 2 mirrors) reduce 4.3 × 10¹⁹ states to ~9 × 10¹⁷ equivalence classes.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>陪集划分</strong>:在 G_1 (二阶段法的第一阶段子群,见 §10) 的陪集上进一步切片,得到 ~2 × 10⁹ 个待处理「sets」 (每个 set ≈ 2 × 10¹⁰ 状态)。</>}
              en={<><strong>Coset partition</strong>: further slice by cosets of G_1 (the two-phase solver's stage-1 subgroup, §10), yielding ~2 × 10⁹ "sets" to process (each containing ~2 × 10¹⁰ states).</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>暴力求解</strong>:每个 set 用改进的 Kociemba two-phase solver 求出每个状态的「最短 ≤ 20」证书。若有任何状态需要 {'>'} 20 步,则失败。</>}
              en={<><strong>Brute-force solve</strong>: for each set, run an improved Kociemba two-phase solver to certify every state's optimal length ≤ 20. If any state required {'>'} 20, the bound is broken.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>结果</strong>:所有 2 × 10⁹ 个 set 都通过 ≤ 20 步证书。结合早已知道的「superflip 需要 ≥ 20 步」(1995 年 Reid 给出),得到 God's number = 20。</>}
              en={<>Every set verified ≤ 20. Combined with the long-known fact that superflip requires ≥ 20 moves (Reid, 1995), this gives <em>diameter</em> = 20.</>}
            />
          </li>
        </ol>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="11.2  HTM vs QTM" en="11.2  Half-turn vs quarter-turn metric" />
        </h3>
        <p>
          <L
            zh={<>同一个魔方,在两种度量下直径不同:</>}
            en={<>The same cube has different diameters under different metrics:</>}
          />
        </p>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '度量', en: 'Metric' })}</th><th>{tr({ zh: '生成集', en: 'Generators' })}</th><th>{tr({ zh: '直径', en: 'Diameter'
            })}</th><th>{tr({ zh: '极端状态', en: 'Extremal'
            })}</th></tr>
          </thead>
          <tbody>
            <tr><td>HTM (half-turn)</td><td className="num">18 (each face × 90°/180°/270°)</td><td className="num">20</td><td>superflip {`{}`}+ ~490M others</td></tr>
            <tr><td>QTM (quarter-turn)</td><td className="num">12 (each face × 90°/270°)</td><td className="num">26</td><td>superflip composed with a special 6-move op</td></tr>
            <tr><td>STM (slice-turn)</td><td className="num">27 (HTM + 9 slice moves)</td><td className="num">18</td><td>multiple known examples</td></tr>
            <tr><td>FTM (face-turn 90°)</td><td className="num">6 (each face × 90°)</td><td className="num">26 (= QTM)</td><td>same as QTM</td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>不同度量对应不同的「比赛规则」 或不同的「物理代价」, 但底层群结构都是同一个 G。这是图论里「图的距离 ≠ 群的内在性质」 的典型例子。</>}
            en={<>Different metrics correspond to different "competition rules" or "physical costs," but the underlying group G is the same. This is a textbook illustration of "graph distance is not an intrinsic group property."</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="11.3  历史时间线" en="11.3  Historical timeline" />
        </h3>
        <table className="gt-compare">
          <thead>
            <tr><th>{tr({ zh: '年', en: 'Year' })}</th><th>{tr({ zh: '人', en: 'Who' })}</th><th>{tr({ zh: '上界', en: 'Upper' })}</th><th>{tr({ zh: '下界', en: 'Lower' })}</th></tr>
          </thead>
          <tbody>
            <tr><td>1981</td><td>Thistlethwaite</td><td className="num">52</td><td className="num">—</td></tr>
            <tr><td>1990</td><td>Kloosterman</td><td className="num">42</td><td className="num">—</td></tr>
            <tr><td>1992</td><td>Reid</td><td className="num">37</td><td className="num">18</td></tr>
            <tr><td>1995</td><td>Reid</td><td className="num">29</td><td className="num">20</td></tr>
            <tr><td>1995</td><td>Korf</td><td className="num">—</td><td className="num">20</td></tr>
            <tr><td>2007</td><td>Kunkle &amp; Cooperman</td><td className="num">26</td><td className="num">20</td></tr>
            <tr><td>2008</td><td>Rokicki</td><td className="num">22</td><td className="num">20</td></tr>
            <tr><td><strong>2010</strong></td><td><strong>Rokicki et al.</strong></td><td className="num"><strong>20</strong></td><td className="num"><strong>20</strong></td></tr>
          </tbody>
        </table>
        <p>
          <L
            zh={<>从 Thistlethwaite 的 52 步到 Rokicki 的 20 步, 经过 29 年, 上下界终于在 20 相遇 — 这个数字成为 God's number。</>}
            en={<>From Thistlethwaite's 52 to Rokicki's 20, the upper and lower bounds converged after 29 years to the value 20 — God's number.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="11.4  Reid 1995 — superflip ≥ 20 步" en="11.4  Reid 1995 — superflip needs ≥ 20" />
        </h3>
        <p>
          <L
            zh={<>下界证明的核心是: <strong>superflip</strong> 状态 (12 个棱全翻面, 角块全归位) 在 HTM 下严格需要 20 步。 Michael Reid 1995 年的证明走 「EO 守恒 + 角块独立约束」 路线:</>}
            en={<>The lower-bound proof shows the <strong>superflip</strong> state (all 12 edges flipped, corners home) strictly requires 20 HTM. Michael Reid (1995) argued via the "EO conservation + independent corner constraint" pair:</>}
          />
        </p>
        <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<>superflip 要求 <TeX src={`\\sum e_o = 12 \\equiv 0 \\pmod 2`} />, 即 「翻面变化次数为偶」。 每个 F 或 B 转 翻 4 个棱, 每个 R/L/U/D 不翻棱。 故 「F 或 B」 类的总步数必为偶。</>}
            en={<>Superflip needs <TeX src={`\\sum e_o = 12 \\equiv 0 \\pmod 2`} />, i.e. the total number of "F or B" moves must be even (only F/B change EO; R/L/U/D don't).</>}
          /></li>
          <li><L
            zh={<>角块全归位且不拧角 (CO = 0)。 但 R/L/F/B 都会改 CO, 所以这些非-U/D 步必须互相 「补偿」, 给出额外组合约束。</>}
            en={<>All corners must return home with CO = 0. R/L/F/B all change CO, so the non-U/D steps must mutually cancel — giving an additional combinatorial constraint.</>}
          /></li>
          <li><L
            zh={<>系统地枚举所有「&lt; 20 步」 的 alg 在 18 个生成元上的字, 验证没有任何字给出 superflip。 Reid 用 「ε ε ε ε ...」 模式 + 角块/棱块独立性证明 19 步不够。</>}
            en={<>Systematically enumerate every alg of length {'<'} 20 over the 18-generator alphabet and verify none produces superflip. Reid combined the parity argument with a corner/edge independence lemma to rule out 19.</>}
          /></li>
        </ol>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="11.5  Rokicki 2010 — 上界 = 20 的证明骨架" en="11.5  Rokicki 2010 — upper bound = 20 outline" />
        </h3>
        <ol style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L
            zh={<><strong>陪集枚举</strong>: 把 <TeX src={`|G| = 4.33 \\times 10^{19}`} /> 切成 <TeX src={`[G:G_2] = 2.22 \\times 10^9`} /> 个 Kociemba 陪集, 每个含 <TeX src={`|G_2| = 1.95 \\times 10^{10}`} /> 元素。</>}
            en={<><strong>Coset enumeration</strong>: slice <TeX src={`|G| = 4.33 \\times 10^{19}`} /> into <TeX src={`[G:G_2] = 2.22 \\times 10^9`} /> Kociemba cosets, each of size <TeX src={`|G_2| = 1.95 \\times 10^{10}`} />.</>}
          /></li>
          <li><L
            zh={<><strong>外部对称化简</strong>: 用 48 阶 <TeX src={`O_h`} /> 对称群把陪集数压到 <TeX src={`2.22 \\times 10^9 / 48 \\approx 5.6 \\times 10^7`} /> 个等价类 (绝大多数陪集没有 stabiliser, 故确实除以 48)。</>}
            en={<><strong>Outer symmetry reduction</strong>: collapse via the 48-element <TeX src={`O_h`} /> outer symmetry group from <TeX src={`2.22 \\times 10^9`} /> to <TeX src={`\\approx 5.6 \\times 10^7`} /> equivalence classes (most cosets have trivial stabiliser, so the division by 48 is essentially exact).</>}
          /></li>
          <li><L
            zh={<><strong>每个陪集 ≤ 20 HTM 验证</strong>: 对每个代表跑 「20-bounded IDA*」: 用 Kociemba phase-1 + phase-2 双 pruning table, 找一个 ≤ 20 步解。 若失败, 报警 (没有发生)。</>}
            en={<><strong>≤ 20 HTM verification per coset</strong>: for each representative, run a 20-bounded IDA* using both Kociemba phase-1 and phase-2 pruning tables, seeking a ≤ 20-step solve. Any failure would falsify the conjecture (none did).</>}
          /></li>
          <li><L
            zh={<><strong>总算力</strong>: ≈ 35 CPU-年, 由 Google 捐赠。 结合 Reid 1995 的下界, 给出 <strong>diameter(G, HTM) = 20</strong>。</>}
            en={<><strong>Total compute</strong>: ≈ 35 CPU-years, donated by Google. Combined with Reid's 1995 lower bound: <strong>diameter(G, HTM) = 20</strong>.</>}
          /></li>
        </ol>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="11.6  QTM 直径 = 26 (2014)" en="11.6  QTM diameter = 26 (2014)" />
        </h3>
        <p>
          <L
            zh={<>同样的算法套路, 改用 QTM (12 生成元, 每个 90°), 由 Rokicki & Kociemba 在 2014 年宣布: <strong>diameter(G, QTM) = 26</strong>。 极端态包括「superflip ∘ 4-spot」与「superflip ∘ 6-spot」, 它们各自需要 26 QTM。 由 <TeX src={`\\text{HTM} \\leq \\text{QTM} \\leq 2 \\cdot \\text{HTM}`} /> 知 QTM 直径必在 [20, 40] 内, 实测精确值 26。</>}
            en={<>The same recipe, but using QTM (12 generators, all 90°), gave Rokicki & Kociemba's 2014 result: <strong>diameter(G, QTM) = 26</strong>. Extremal states include "superflip ∘ 4-spot" and "superflip ∘ 6-spot" at exactly 26 QTM. Since <TeX src={`\\text{HTM} \\leq \\text{QTM} \\leq 2 \\cdot \\text{HTM}`} />, the QTM diameter must sit in [20, 40], measured to be 26.</>}
          />
        </p>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="11.7  Schoenert 1990s — 早期算力" en="11.7  Schoenert 1990s — early heroics" />
        </h3>
        <p>
          <L
            zh={<>Martin Schoenert 1995 年通过 GAP 计算群论包验证了 |G| 和共轭类结构, 给出当时最严格的 「上界 ≤ 29」 (在已知超翻状态的 29-步还原序列基础上)。 这预示了 Rokicki 「分而治之 + 大规模并行」 路线的可行性。 Kunkle & Cooperman 2007 用 7 TB 内存的分布式 IDA* 把上界推到 26, 第一次只剩 「单个 6-步」 待证。 Rokicki 在 2008 年单人把它推到 22, 然后是 2010 年的 35 CPU-年大跨步。</>}
            en={<>Martin Schoenert (1995) used the GAP computational-algebra package to verify |G| and the conjugacy class structure, giving the best-then upper bound of ≤ 29 (based on a known 29-step solve of superflip). This foreshadowed Rokicki's "divide-and-conquer + massive parallel" route. Kunkle & Cooperman (2007) ran a 7 TB distributed IDA* to push the bound to 26, leaving only a "single 6-step gap." Rokicki single-handedly drove it to 22 by 2008, and then the 35 CPU-year leap to 20 in 2010.</>}
          />
        </p>
      </GTSec>
  );
}
