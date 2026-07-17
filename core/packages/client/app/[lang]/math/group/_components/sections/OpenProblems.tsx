'use client';

import { GTSec, L, TeX, TeXBlock, useLang } from '../primitives';
import { tr } from '@/i18n/tr';

// §open-problems — self-contained prose section, lazy-loaded per slug from page.tsx's
// EXT_COMPONENTS map (see the section-extraction note there).
export default function OpenProblems() {
  const lang = useLang();
  return (
      <GTSec id="open-problems" className="gt-sec">
        <div className="gt-sec-num">§16</div>
        <h2 className="gt-sec-title">
          <L zh="未解问题 — 群论的开放前线" en="Open problems — frontiers of group theory" />
        </h2>
        <p className="gt-lede">
          <L
            zh={<>魔方群本身的 「基本不变量」 (阶、 直径、 结构定理) 都 <em>完全确定</em>。 但 「拓宽一步」 立即就出现了几个数学社区目前还回答不上来的问题。 这些问题横跨组合、 几何、 计算复杂度、 量子算法 —— 都是经过 50 年研究仍然敞开的。</>}
            en={<>The "basic invariants" of the cube group (order, diameter, structure theorem) are <em>completely settled</em>. But step out by even one notch and several problems still resist the mathematical community after 50 years — spanning combinatorics, geometry, complexity, and quantum algorithms.</>}
          />
        </p>

        <div className="gt-open-summary">
          <div className="gt-open-summary-head">{tr({ zh: '开放问题速览', en: 'open problems at a glance'
        })}</div>
          <table className="gt-pattern-tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>{tr({ zh: '问题', en: 'problem'
                })}</th>
                <th>{tr({ zh: '最佳已知', en: 'best known' })}</th>
                <th>{tr({ zh: '难度', en: 'difficulty'
                })}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="num">1</td><td>{lang === 'zh' ? '4×4 God\'s number' : '4×4 God\'s number'}</td><td className="num">[22, 36] HTM</td><td>{tr({ zh: '中等 (需算法)', en: 'medium (algorithmic)'
            })}</td></tr>
              <tr><td className="num">2</td><td>{tr({ zh: 'n×n 渐近常数', en: 'n×n asymptotic constant'
            })}</td><td>Θ(n²/log n)</td><td>{tr({ zh: '困难 (理论)', en: 'hard (theoretical)'
            })}</td></tr>
              <tr><td className="num">3</td><td>{tr({ zh: '平均最优解长度', en: 'average optimal length'
            })}</td><td className="num">17.97 HTM</td><td>{tr({ zh: '简单 (统计)', en: 'easy (statistical)'
            })}</td></tr>
              <tr><td className="num">4</td><td>{tr({ zh: '非阿贝尔 HSP', en: 'non-Abelian HSP'
            })}</td><td>{tr({ zh: '无量子加速', en: 'no quantum speedup'
            })}</td><td>{tr({ zh: '极困难 (量子)', en: 'very hard (quantum)'
            })}</td></tr>
              <tr><td className="num">5</td><td>{tr({ zh: 'Cutoff 临界值', en: 'mixing-time cutoff'
            })}</td><td>≈ 22 ± 3</td><td>{tr({ zh: '困难 (概率)', en: 'hard (probabilistic)'
            })}</td></tr>
            </tbody>
          </table>
        </div>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="16.1  4×4×4 的 God's Number" en="16.1  4×4×4's God's number" />
        </h3>
        <p>
          <L
            zh={<>4×4×4 群的直径目前只知道在 <strong>[22, 36] HTM</strong> 区间内。 给定群阶 <TeX src={`|G_4| \\approx 7.4 \\times 10^{45}`} />, 完整枚举是 <em>不可能</em> 的 ── 比可观宇宙的原子数还多 27 个数量级。 现有的最强算法基于:</>}
            en={<>The 4×4×4's diameter is bounded only to <strong>[22, 36] HTM</strong>. With order <TeX src={`|G_4| \\approx 7.4 \\times 10^{45}`} />, exhaustive enumeration is <em>impossible</em> — 27 orders of magnitude beyond the atom count of the observable universe. The strongest approaches use:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li>
            <L
              zh={<><strong>子群链分解</strong> ── 类似 Thistlethwaite 4-阶段, 但 4×4×4 缺乏中心固定, 所以需要先解 「reduction」 (3 步将拼图缩成 3×3×3 等效物), 然后转 3×3×3 算法。 总步数估计 35–45 HTM。</>}
              en={<><strong>Subgroup-chain reduction</strong> — Thistlethwaite-style but the 4×4×4 lacks fixed centres, so reduction (3 phases to bring the puzzle to 3×3×3-equivalent) precedes the 3×3×3 algorithm. Total estimate 35–45 HTM.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>对称约简</strong> ── 利用 48 个外部立方对称把状态空间压缩到 1/48。 仍然太大。</>}
              en={<><strong>Symmetry reduction</strong> — collapse by the 48 outer cube symmetries, leaving |G|/48. Still far too large.</>}
            />
          </li>
          <li>
            <L
              zh={<><strong>深度学习引导搜索</strong> ── DeepCubeA (UCI, 2019) 用强化学习近似 「最优步数估计函数」, 已能在合理时间内解几乎所有状态, 但不能给数学下界。</>}
              en={<><strong>Learning-guided search</strong> — DeepCubeA (UCI, 2019) uses RL to approximate an optimal-distance heuristic, solving most states in feasible time but not proving lower bounds.</>}
            />
          </li>
        </ul>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="16.2  n×n×n 的渐近行为" en="16.2  Asymptotics of n×n×n" />
        </h3>
        <p>
          <L
            zh={<>对一般 n × n × n 立方体, Demaine, Demaine, Eisenstat, Lubiw, Winslow (2018) 证明 「求解的最短公式」 在 n ≥ 2 时是 <strong>NP-完备</strong>。 同一篇论文给出了渐近上下界:</>}
            en={<>For general n × n × n, Demaine, Demaine, Eisenstat, Lubiw, Winslow (2018) proved that finding the optimal alg is <strong>NP-complete</strong> for n ≥ 2. The same paper established asymptotic bounds:</>}
          />
        </p>
        <TeXBlock src={`\\Omega\\!\\left(\\dfrac{n^{2}}{\\log n}\\right) \\;\\leq\\; \\mathrm{diam}(G_n) \\;\\leq\\; O\\!\\left(\\dfrac{n^{2}}{\\log n}\\right)`} />
        <p>
          <L
            zh={<>两端的 Θ 框架是 <em>紧的</em>, 但内部的 <strong>精确常数仍未知</strong>。 已知 <TeX src={`c_1 \\leq c_2`} /> 满足 <TeX src={`c_1 n^2/\\log n \\leq \\mathrm{diam}(G_n) \\leq c_2 n^2/\\log n`} />, 但 <TeX src={`c_1, c_2`} /> 的具体值是开放问题。 这是 「拼图复杂度」 的标志性未解问题之一。</>}
            en={<>The Θ-bracket is <em>tight</em>, but the <strong>exact constant inside is unknown</strong>. We have <TeX src={`c_1 \\leq c_2`} /> with <TeX src={`c_1 n^2/\\log n \\leq \\mathrm{diam}(G_n) \\leq c_2 n^2/\\log n`} />, but the explicit values of <TeX src={`c_1, c_2`} /> are open. This is a flagship problem in "puzzle complexity."</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="16.3  最优解法的统计性质" en="16.3  Statistical properties of optimal solutions" />
        </h3>
        <p>
          <L
            zh={<>3×3 的 HTM 直径已经 = 20。 但 「<em>平均最优解长度</em>」 是多少? Rokicki 实测全 4.3 × 10¹⁹ 状态的平均 HTM 最优长度为 <TeX src={`\\bar{d} \\approx 17.97`} />。 这意味着 <strong>近 99% 的状态需要 16–20 步</strong>, 距离分布高度集中。 但下面这些子问题仍是开放:</>}
            en={<>The 3×3 HTM diameter = 20 is settled. But what is the <em>average optimal solve length</em>? Rokicki measured over all 4.3 × 10¹⁹ states an average <TeX src={`\\bar{d} \\approx 17.97`} /> HTM. So <strong>nearly 99% of states need 16–20 moves</strong> — the distance distribution is highly concentrated. The following sub-questions remain open:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh="状态距离分布是否「精确高斯」?(实测形状非常接近 Gaussian, 但理论解释缺失)" en="Is the distance distribution exactly Gaussian? (Empirically near-Gaussian, but no theoretical reason)" /></li>
          <li><L zh="距离 = d 的状态数 N(d) 是否服从 logconcave 性质?" en="Is the count N(d) of states at distance d log-concave?" /></li>
          <li><L zh="QTM 与 HTM 直径之比 26/20 = 1.3 是否是某个通用比率?" en="Is the QTM/HTM ratio 26/20 = 1.3 a universal constant?" /></li>
        </ul>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="16.4  最佳算法之争" en="16.4  Which solver is best?" />
        </h3>
        <p>
          <L
            zh={<>Thistlethwaite (1981) 和 Kociemba two-phase (1992) 都是 「子群链下降」 算法, 把状态空间切成查表层。 但还有几个截然不同的方法:</>}
            en={<>Thistlethwaite (1981) and Kociemba's two-phase (1992) are subgroup-chain descent algorithms, slicing state space into lookup layers. But several entirely different approaches exist:</>}
          />
        </p>
        <ul style={{ paddingLeft: 26, lineHeight: 1.9 }}>
          <li><L zh={<><strong>Korf's IDA*</strong> (1997) ── iterative deepening A* 直接在 Cayley 图上搜, 启发式来自三种 pattern database 的最大值。 第一个证明 「确实存在 20 步上界」 的算法。</>} en={<><strong>Korf's IDA*</strong> (1997) — iterative-deepening A* directly on the Cayley graph with three pattern-database heuristics. First algorithm shown to be provably optimal.</>} /></li>
          <li><L zh={<><strong>Rokicki's symmetry-augmented BFS</strong> (2010) ── 利用 48 个对称把状态空间减半再做 BFS, 是证明 「上帝之数 = 20」 的算法。</>} en={<><strong>Rokicki's symmetry-augmented BFS</strong> (2010) — halves state space via the 48 cube symmetries before BFS, the algorithm used to prove God's number = 20.</>} /></li>
          <li><L zh={<><strong>DeepCubeA</strong> (UCI, 2019) ── 学习 Q-function, 不保证最优但平均接近最优。</>} en={<><strong>DeepCubeA</strong> (UCI, 2019) — learns a Q-function; not provably optimal but consistently near-optimal in practice.</>} /></li>
          <li><L zh={<><strong>min2phase / cube20.org</strong> ── 工业级 two-phase 实现, 平均 {'<'} 20 步, 速度比 IDA* 快几个数量级。</>} en={<><strong>min2phase / cube20.org</strong> — production-grade two-phase implementations, averaging well under 20 moves with constant-factor speedups.</>} /></li>
        </ul>
        <p>
          <L
            zh={<>哪一种在 「平均最短解长度 + 算时间」 上 <em>帕累托最优</em>? 这跟 G 的具体结构 (生成集对称、 子群链可分性) 紧密耦合, 是个长期研究问题。</>}
            en={<>Which method is <em>Pareto-optimal</em> in "average optimal length × runtime"? Tied tightly to G's structure (generator symmetry, subgroup-chain decomposability), this remains a long-running research question.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="16.5  量子算法?" en="16.5  Quantum algorithms?" />
        </h3>
        <p>
          <L
            zh={<>量子计算机能否在 「亚指数时间」 内解魔方? 这是 「<em>黑盒群论</em>」 (black-box group theory) 与量子算法的接壤。 已知 Shor 算法处理阿贝尔群 (整数因式分解, 离散对数); 非阿贝尔情形 ── <em>Hidden Subgroup Problem</em> (HSP) ── 仍是开放领域:</>}
            en={<>Can a quantum computer solve the cube in subexponential time? This sits at the intersection of <em>black-box group theory</em> and quantum algorithms. Shor's algorithm handles Abelian groups (integer factorization, discrete log); the non-Abelian <em>Hidden Subgroup Problem</em> (HSP) — open:</>}
          />
        </p>
        <TeXBlock src={`\\text{Given }f : G \\to S \\text{ constant on cosets of a hidden } H \\leq G,\\quad \\text{find } H.`} />
        <p>
          <L
            zh={<>对 G 阿贝尔, 有 <TeX src={`O(\\mathrm{poly}\\log |G|)`} /> 量子算法; 对一般非阿贝尔 G, 已知次指数 (<TeX src={`2^{O(\\sqrt{\\log |G|})}`} />) 算法只对部分类型存在 (二面体群, 一些可分群)。 <strong>魔方群 G 是一个完美的非阿贝尔 HSP 测试对象</strong> ── 任何在 G 上的多项式量子算法都是重大突破。</>}
            en={<>For Abelian G there is an <TeX src={`O(\\mathrm{poly}\\log |G|)`} /> quantum algorithm; for general non-Abelian G, subexponential <TeX src={`2^{O(\\sqrt{\\log |G|})}`} /> is known only for some classes (dihedral groups, certain solvable groups). <strong>The cube group is a perfect non-Abelian HSP testbed</strong> — any polynomial quantum algorithm on G would be a major breakthrough.</>}
          />
        </p>

        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 14, color: 'var(--ink)' }}>
          <L zh="16.6  随机游走的 cutoff 临界值" en="16.6  Random-walk cutoff threshold" />
        </h3>
        <p>
          <L
            zh={<>Diaconis (1980s) 提出 「<strong>cutoff 现象</strong>」: 对许多自然群上的随机游走, <TeX src={`d_{TV}(t)`} /> 在很长时间内接近 1, 然后在 <em>非常窄</em> 的 t 区间内突然降到接近 0 (§24)。 经典样本: Bayer–Diaconis (1992) 证明 52 张牌需要 <TeX src={`\\tfrac{3}{2} \\log_2 52 \\approx 8.5`} /> 次 riffle shuffle 才 「彻底打乱」。 对魔方:</>}
            en={<>Diaconis (1980s) introduced the <strong>cutoff phenomenon</strong>: for many natural random walks on groups, <TeX src={`d_{TV}(t)`} /> sits near 1 for a long time and then drops sharply within a <em>narrow window</em> (§24). The classic example: Bayer–Diaconis (1992) proved 52 cards need <TeX src={`\\tfrac{3}{2} \\log_2 52 \\approx 8.5`} /> riffle shuffles to mix. For the cube:</>}
          />
        </p>
        <TeXBlock src={`t_{\\mathrm{cutoff}}(G) \\;\\overset{?}{\\sim}\\; \\tfrac{1}{2} \\log_{|S|} |G| \\;\\approx\\; 22\\text{ HTM moves}`} />
        <p>
          <L
            zh={<>下界 ~18 上界 ~30, 精确临界值未严格证明。 WCA 用 25-步 scramble 不是偶然 ── 它在 <em>估计的</em> cutoff 之上, 在 <em>已确认</em> God\'s number (20) 之上, 但不至于触及 known extremal。</>}
            en={<>Lower bound ~18, upper ~30, exact threshold unproven. WCA's 25-move scramble is no accident — above the <em>estimated</em> cutoff, above the <em>proven</em> God's number (20), without hitting known extremal positions.</>}
          />
        </p>

        <div className="gt-pullquote">
          <L
            zh={<>「魔方群的开放问题不是 『太难没人会』, 而是 『太具体没人能简化』。 算法、 几何、 表示论, 都遇到了 G 的具体结构。」</>}
            en={<>"The cube's open problems are not 'too hard nobody knows'; they are 'too specific nobody has reduced'. Algorithms, geometry, representation theory all crash into G's concrete structure."</>}
          />
          <div className="gt-pullquote-cite">— Joyner & Frey, on group theory in the cube</div>
        </div>
      </GTSec>
  );
}
