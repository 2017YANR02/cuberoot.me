'use client';

import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../../_lib/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './algorithm_intro.css';
import './cfop_solver.css';

const ACCENT = '#E879A6';

const FIG_BASE = '/images/algorithms/cfop';

export default function CfopStdSolverPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  useDocumentTitle('CFOP 多阶段求解器', 'CFOP multi-stage solver');

  return (
    <LangCtx.Provider value={lang}>
      <div className="algo-page" style={{ ['--accent' as string]: ACCENT }}>
        <div className="algo-page-bg" />
        <div className="algo-page-inner">
          <div className="algo-page-topbar">
            <Link href="/code/algorithms" className="algo-page-back">← /code/algorithms</Link>
          </div>

          <header className="algo-page-head">
            <div className="algo-page-tag">
              <L zh="自研 · 多阶段" en="Self-built · multi-stage" />
            </div>
            <h1 className="algo-page-title">
              <L zh="CFOP 多阶段求解器" en="CFOP multi-stage solver" />
            </h1>
            <p className="algo-page-sub">
              <L
                zh={
                  <>
                    Cross / XCross / XXCross / XXXCross / F2L 五个阶段全部求最少步。
                    Lehmer 排列编码紧凑表示;共轭变换让 4 个 F2L 槽位共用一份剪枝表;
                    阶段间下界传播跳过低于前置阶段最优的所有无效迭代。
                    1,200,000 条 WCA 历史打乱 × 5 阶段 × 6 视角 = 3,600 万次最优搜索,
                    量化颜色中性的边际收益。
                  </>
                }
                en={
                  <>
                    Optimal move counts for all five CFOP stages: Cross / XCross / XXCross / XXXCross / F2L.
                    Lehmer permutation encoding for compact state;
                    a conjugation trick lets four F2L slots share one prune table;
                    cross-stage lower-bound propagation skips iterations below the previous stage's optimum.
                    1.2M WCA scrambles × 5 stages × 6 orientations = 36M optimal searches —
                    quantifying the marginal value of color neutrality.
                  </>
                }
              />
            </p>
          </header>

          {/* ============================================================ */}
          {/* 01 Problem definition                                         */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">01</span>
              <h2 className="algo-section-title"><L zh="问题定义" en="Problem statement" /></h2>
            </header>

            <p>
              <L
                zh={<>3×3×3 魔方有 8 个角块、12 个棱块和 6 个固定中心块,中心面相对方位固定。排除上层中心三色对应的等价旋转后,合法状态总数为</>}
                en={<>A 3×3×3 cube has 8 corners, 12 edges and 6 fixed centres (centre orientations are constant relative to each other). Quotienting by the equivalent whole-cube rotations of the top-centre triple gives</>}
              />
            </p>
            <code className="algo-eq">|Cube| = 8! · 3<sup>8</sup> · 12! · 2<sup>12</sup> / 12 ≈ 4.3252 × 10<sup>19</sup>.</code>
            <p>
              <L
                zh={<>分母 12 来自"绕上层中心三色的整体方位"等价类:每个魔方状态可绕 z 轴 (4 个 90° 朝向) 配合上下层选择 (3 种垂直定向) 得到 12 个物理上相同但表示不同的拷贝,故除掉。</>}
                en={<>The denominator 12 quotients out the orientation of the top centre triple: each physical state corresponds to 12 representations (4 z-axis rotations × 3 vertical orientations) that are identical to the puzzle but differ in labelling.</>}
              />
            </p>

            <p>
              <L
                zh={<>CFOP (Fridrich method) 把还原分成四步:<strong>C</strong>ross (底层十字)、<strong>F2L</strong> (First Two Layers,前两层完成)、<strong>O</strong>LL (Orientation of Last Layer,顶层色向归一)、<strong>P</strong>LL (Permutation of Last Layer,顶层归位)。前两步是几何性最强、状态空间最大、对解法长度最敏感的部分。CubeRoot 的 std solver 把第一块从底十字到完整 F2L 切成五个最优子目标:</>}
                en={<>The CFOP (Fridrich) method splits a solve into four phases: <strong>C</strong>ross (bottom cross), <strong>F2L</strong> (First Two Layers), <strong>O</strong>LL (Orientation of Last Layer — last-layer top colour aligned), <strong>P</strong>LL (Permutation of Last Layer — last-layer pieces permuted). The first two are the most geometric, have the largest state space, and dominate move count. CubeRoot's std solver decomposes the first block — cross through completed F2L — into five optimal sub-goals:</>}
              />
            </p>
            <ul>
              <li>
                <L
                  zh={<><strong>Cross</strong>:设底面颜色为 D。把 4 条底层棱块各自归位且色向正确,底面呈十字形。完成后该 4 棱状态固定,记作集合 <strong>X₀</strong>。状态空间 |Cross| = 190,080(见 §05)。</>}
                  en={<><strong>Cross</strong>: with bottom-face colour D, place and orient the 4 bottom edges so that the down face shows a cross. The 4-edge state is then fixed; we denote that set as <strong>X₀</strong>. State space |Cross| = 190,080 (see §05).</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>XCross</strong>:Cross 加 1 对 F2L (1 角 + 1 棱),即第一对 F2L 与十字同时完成。</>}
                  en={<><strong>XCross</strong>: Cross plus one solved F2L pair (1 corner + 1 edge), i.e. first pair finished alongside the cross.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>XXCross</strong> / <strong>XXXCross</strong>:Cross 加 2 / 3 对 F2L,槽位组合在 4 选 2 / 4 选 3。</>}
                  en={<><strong>XXCross</strong> / <strong>XXXCross</strong>: Cross plus 2 / 3 F2L pairs, slot subsets chosen 4-choose-2 / 4-choose-3.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>F2L (XXXXCross)</strong>:Cross 加 4 对 F2L,整个底两层完成。</>}
                  en={<><strong>F2L (XXXXCross)</strong>: Cross plus all 4 F2L pairs — the entire first two layers solved.</>}
                />
              </li>
            </ul>

            <p>
              <L
                zh={<>距离度量采用 HTM (Half-Turn Metric):U / U' / U2 都算 1 步。给定打乱 s 和目标集 G,我们要求最小步数</>}
                en={<>The distance metric is HTM (Half-Turn Metric): U / U' / U2 each count as 1 move. Given a scramble s and goal set G, the solver computes the optimal distance</>}
              />
            </p>
            <code className="algo-eq">d(s, G) = min &#123; |alg| : alg(s) ∈ G &#125;</code>

            <div className="algo-callout">
              <div className="algo-callout-tag"><L zh="设计目标" en="Design target" /></div>
              <p>
                <L
                  zh={<>5 个阶段的精确最优、不是近似;6 视角全跑用于颜色中性分析;单解平均 5 ns 摊销,可在一台 PC 上 24 小时内跑完 240 万样本 × 5 阶段 × 6 视角 = 7,200 万次最优搜索。</>}
                  en={<>Exact optimum for every stage, not an approximation; all 6 orientations for color-neutral analysis; ~5 ns amortized per solve, enabling 2.4M samples × 5 stages × 6 views = 72M optimal searches on a single workstation in under a day.</>}
                />
              </p>
            </div>

            <h3 className="algo-subsection-title">
              <L zh="主要工作四项" en="Four core contributions" />
            </h3>
            <ol>
              <li>
                <L
                  zh={<>把 Cross / XCross / F2L 的最少步数问题<strong>建模为子状态空间上的最短路径搜索</strong>,并设计紧凑的整数索引编码方案。</>}
                  en={<>Cast Cross / XCross / F2L optimal-move-count as <strong>shortest-path search on a sub state-space</strong>, with a compact integer-index encoding.</>}
                />
              </li>
              <li>
                <L
                  zh={<>构造移动表与剪枝表的<strong>预计算流水线</strong>,分析 4-bit 紧凑存储与逆向 BFS 填充的具体实现。</>}
                  en={<>Build a <strong>precomputation pipeline</strong> for move tables and prune tables; pin down 4-bit packed storage and reverse-BFS filling.</>}
                />
              </li>
              <li>
                <L
                  zh={<>剖析 std 求解器在多槽位 F2L 阶段的实现细节 —— <strong>共轭变换 (Conjugation)、槽位排序与早退 (Early Exit)、邻接/对角两类 Huge 剪枝表协同使用,以及 5 阶段间的下界传播</strong>。</>}
                  en={<>Dissect the multi-slot F2L implementation: <strong>conjugation, slot ordering with early exit, paired neighbour/diagonal Huge prune tables, and cross-stage lower-bound propagation</strong>.</>}
                />
              </li>
              <li>
                <L
                  zh={<>在 1,200,000 条 WCA 历史打乱 + 1,271,727 条 WY 轴困难子集 (合计 ~240 万样本) 上做大样本统计,<strong>量化颜色中性的边际收益</strong>,并经验上验证立方对称性。</>}
                  en={<>Run large-sample statistics on 1,200,000 WCA historical scrambles + 1,271,727 WY-hard scrambles (~2.4M total), <strong>quantifying the marginal value of color neutrality</strong> and empirically verifying cubic symmetry.</>}
                />
              </li>
            </ol>
          </section>

          {/* ============================================================ */}
          {/* 02 Why brute-force fails                                      */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">02</span>
              <h2 className="algo-section-title"><L zh="为什么暴力搜索不可行" en="Why brute force fails" /></h2>
            </header>

            <p>
              <L
                zh={<>朴素 BFS 在每个节点扩展 18 个动作 (6 面 × 3 旋转)。考虑邻接动作之间的合法性约束 (同面连续动作合并、对面动作排序去重) 后,实际分支因子约 <strong>13 ~ 15</strong>。Cross 的最优步数在 <strong>4 ~ 8</strong> 之间,XCross 在 <strong>5 ~ 9</strong> 之间,F2L 最多可达 15。指数估算:</>}
                en={<>Plain BFS branches by 18 moves (6 faces × 3 rotations) at every node. After legal-move filtering (collapse same-face sequences, force a canonical order between opposite faces) the effective branching factor is roughly <strong>13 ~ 15</strong>. Optimal Cross is <strong>4 ~ 8</strong> moves, XCross <strong>5 ~ 9</strong>, F2L up to 15. Back-of-envelope:</>}
              />
            </p>
            <code className="algo-eq">13<sup>8</sup> ≈ 8.16 × 10<sup>8</sup>,&nbsp;&nbsp;&nbsp;13<sup>12</sup> ≈ 2.33 × 10<sup>13</sup>,&nbsp;&nbsp;&nbsp;13<sup>15</sup> ≈ 5.12 × 10<sup>16</sup>.</code>

            <p>
              <L
                zh={<>深度 12 时已达 <strong>23 万亿</strong> 节点,即使单节点处理只需 1 ns,也要 <strong>6 小时</strong>以上 — 而这只是一条打乱、一个阶段、一个视角的成本。240 万打乱 × 5 阶段 × 6 视角 = 7,200 万次最优搜索的实验规模下纯暴力法不可行。两个杠杆把它压回可行:</>}
                en={<>Depth 12 already hits <strong>~2.3 × 10<sup>13</sup></strong> nodes — at 1 ns per node that's <strong>6+ hours</strong> for a <em>single</em> scramble × stage × orientation. Across 2.4M scrambles × 5 stages × 6 views = 72M searches, brute force is hopeless. Two levers bring it back:</>}
              />
            </p>
            <ol>
              <li>
                <L
                  zh={<>把动作下一步的 <strong>状态转移</strong> 预计算成移动表,运行时 O(1)。</>}
                  en={<>Precompute the <strong>state transition</strong> per move into move tables — runtime is O(1).</>}
                />
              </li>
              <li>
                <L
                  zh={<>把每个状态到目标的 <strong>真实最优下界</strong> 预计算成剪枝表,IDA* 据此剪枝。下界严格 admissible,所以保证返回最优。</>}
                  en={<>Precompute the <strong>true optimal lower bound</strong> from each state to the goal as a prune table. IDA* uses it for cutoffs. The bound is strictly admissible, so the optimum is guaranteed.</>}
                />
              </li>
            </ol>
          </section>

          {/* ============================================================ */}
          {/* 03 State-space graph                                          */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">03</span>
              <h2 className="algo-section-title"><L zh="图论建模" en="Graph-theoretic formulation" /></h2>
            </header>

            <p>
              <L
                zh={<>令动作集合</>}
                en={<>Let the move set be</>}
              />
            </p>
            <code className="algo-eq">
              M = &#123; U, U', U2, D, D', D2, R, R', R2, L, L', L2, F, F', F2, B, B', B2 &#125;.
            </code>

            <p>
              <L
                zh={<>每个合法状态 s ∈ V,边 (s, s') ∈ E 当且仅当存在 m ∈ M 使 m(s) = s'。<strong>18 种基础转动两两形成 9 对互逆</strong>(U 与 U' 互逆,U2 自身互逆,以此类推):从 s 可达 s' 必能反向回到 s,因此 G = (V, E) <strong>可视为无向图,边权全为 1</strong>。求 Cross 最优步数等价于在该图中,从初始状态 s 到目标顶点集 <code>G_cross</code>(所有 Cross 已完成的状态)的最短路径长度。可达性约束在合法子集上 (双面合并、对面动作排序),实际分支降到 12 ~ 15。</>}
                en={<>Each legal state s ∈ V; there is an edge (s, s') ∈ E iff some m ∈ M satisfies m(s) = s'. The 18 basic moves form <strong>9 inverse pairs</strong> (U ↔ U', U2 ↔ U2, etc.): if s can reach s' there is always a return path, so G = (V, E) is an <strong>undirected graph with all edge weights = 1</strong>. Optimal-Cross-distance equals the shortest path from the scramble s to the goal vertex set <code>G_cross</code> (every Cross-solved state). The canonical move ordering (collapse same-face, enforce an order on opposite faces) drops the branching factor to 12 ~ 15.</>}
              />
            </p>

            <p>
              <L
                zh={<>合法分支过滤的源代码 (cube_common.cpp):</>}
                en={<>The legal-move filter (cube_common.cpp):</>}
              />
            </p>
            <pre className="algo-code">
{`// 编号约定: 0:U 1:D 2:L 3:R 4:F 5:B; face = i / 3
// 同面 (i/3 == prev/3) 直接禁掉 — 后一个动作会和前面合并;
// 对面 (axis 相同) 强制 prev 编号大 — 给对面对儿排个序去重。
for (int prev = 0; prev <= 18; ++prev) {
  for (int i = 0; i < 18; ++i) {
    bool bad = (prev < 18) && (
        i/3 == prev/3 ||
        ((i/3)/2 == (prev/3)/2 && (prev/3) % 2 > (i/3) % 2));
    if (!bad) valid_moves_flat[prev][cnt++] = i;
  }
}`}
            </pre>

            <p>
              <L
                zh={<>结果是 <code>valid_moves_count[prev]</code> 落在 12 ~ 15,比朴素 18 节省 17 ~ 33% 的节点扩展;在 IDA* 深度 12 ~ 15 时这是 1 ~ 2 个数量级的整体减少。prev = 18 是"无前驱"哨兵,起始节点直接给 18 个完整选择。</>}
                en={<>The result: <code>valid_moves_count[prev]</code> sits at 12 ~ 15, a 17 ~ 33% expansion saving over plain 18. At IDA* depth 12 ~ 15 that compounds to 1 ~ 2 orders of magnitude overall. <code>prev = 18</code> is the "no predecessor" sentinel, giving the root all 18 choices.</>}
              />
            </p>
          </section>

          {/* ============================================================ */}
          {/* 04 Five analyzer variants                                     */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">04</span>
              <h2 className="algo-section-title"><L zh="五种分析器变体" en="Five analyzer variants" /></h2>
            </header>

            <p>
              <L
                zh={<>同一份移动表 + 剪枝表基础设施,通过修改目标定义产生五种分析器:</>}
                en={<>One shared move-table + prune-table backbone, five variants by re-defining the goal:</>}
              />
            </p>

            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="变体" en="Variant" /></th>
                  <th><L zh="可执行文件" en="Executable" /></th>
                  <th><L zh="Cross 目标" en="Cross goal" /></th>
                  <th><L zh="差异说明" en="Notes" /></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>std</code></td>
                  <td><code>std_analyzer.exe</code></td>
                  <td><L zh="标准 Cross" en="Standard Cross" /></td>
                  <td><L zh="本文主目标(无附加约束),5 阶段精确最优" en="Primary focus (no extra constraint); optimal over all 5 stages" /></td>
                </tr>
                <tr>
                  <td><code>pseudo</code></td>
                  <td><code>pseudo_analyzer.exe</code></td>
                  <td><L zh="伪 Cross" en="Pseudo Cross" /></td>
                  <td><L zh="允许底面 D 层任意转动 (90/180/270°),目标更松" en="D layer may sit at any 90/180/270° offset; looser goal" /></td>
                </tr>
                <tr>
                  <td><code>pair</code></td>
                  <td><code>pair_analyzer.exe</code></td>
                  <td><L zh="Cross + 1 Pair" en="Cross + 1 Pair" /></td>
                  <td><L zh="Cross 同时完成 1 组 F2L,目标更严" en="Cross plus one F2L pair finished together; stricter goal" /></td>
                </tr>
                <tr>
                  <td><code>pseudo_pair</code></td>
                  <td><code>pseudo_pair_analyzer.exe</code></td>
                  <td><L zh="伪 Cross + Pair" en="Pseudo Cross + Pair" /></td>
                  <td><L zh="上述两者结合" en="Both relaxations combined" /></td>
                </tr>
                <tr>
                  <td><code>eo_cross</code></td>
                  <td><code>eo_cross_analyzer.exe</code></td>
                  <td><L zh="EO + Cross" en="EO + Cross" /></td>
                  <td><L zh="Cross 同时使所有 12 棱块色向归零" en="Cross plus full Edge Orientation on all 12 edges" /></td>
                </tr>
              </tbody>
            </table>

            <p>
              <L
                zh={<>本页聚焦 <code>std</code> 求解器:其目标定义最贴近实际竞速场景中的 Cross / XCross 概念,也是其他变体的<strong>基线</strong>。其他变体仅在最后做简要对比 (见下表)。</>}
                en={<>This page focuses on <code>std</code>: its goal is closest to the real-competition Cross / XCross definitions and serves as the <strong>baseline</strong> for the other variants. The others appear only in the comparison table below.</>}
              />
            </p>

            <p>
              <L
                zh={<>WCA 1.2M 样本下五个变体在 Cross / XCross 阶段的均值对比 (BGORWY 完全色中性):</>}
                en={<>Mean move counts on WCA 1.2M, all five variants, Cross / XCross stages (BGORWY full color-neutral):</>}
              />
            </p>
            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="变体" en="Variant" /></th>
                  <th className="num">Cross <L zh="均值" en="mean" /></th>
                  <th className="num">Cross <L zh="中位" en="median" /></th>
                  <th className="num">XCross <L zh="均值" en="mean" /></th>
                  <th className="num">XCross <L zh="中位" en="median" /></th>
                  <th className="num">Δ vs std/Cross</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>std</td><td className="num">4.811</td><td className="num">5</td><td className="num">6.536</td><td className="num">7</td><td className="num">0</td></tr>
                <tr><td>pseudo</td><td className="num">4.308</td><td className="num">4</td><td className="num">5.530</td><td className="num">6</td><td className="num">−0.503</td></tr>
                <tr><td>pseudo_pair</td><td className="num">4.506</td><td className="num">5</td><td className="num">5.806</td><td className="num">6</td><td className="num">−0.305</td></tr>
                <tr><td>pair</td><td className="num">5.371</td><td className="num">5</td><td className="num">7.124</td><td className="num">7</td><td className="num">+0.560</td></tr>
                <tr><td>eo_cross</td><td className="num">6.427</td><td className="num">7</td><td className="num">7.813</td><td className="num">8</td><td className="num">+1.616</td></tr>
              </tbody>
            </table>

            <p>
              <L
                zh={<>变体的应用场景与等价关系:</>}
                en={<>Where the variants come up, and how they relate to std:</>}
              />
            </p>
            <ul>
              <li>
                <L
                  zh={<><strong>pseudo</strong> 把"D 层任意 90/180/270° 转动"算作完成,平均比 std 节省 ~0.5 步。在某些进阶速拧体系 (例如允许 D 层错位的 <strong>EOCross+1</strong>、<strong>转板盲拧</strong>) 中作为预备阶段使用。</>}
                  en={<><strong>pseudo</strong> accepts any 90/180/270° offset on the D layer as solved; ~0.5 moves shorter than std. Used as a setup stage in some advanced methods that allow a D-layer offset, e.g. <strong>EOCross+1</strong> and <strong>roux-blindfold</strong> variants.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>pair</strong> 在 std Cross 基础上还要求同时完成 1 组 F2L 配对 —— 事实上等价于 std 的 XCross 阶段固定槽位的子目标。三元不等式严格成立:<code>std/Cross &lt; pair/Cross &lt; std/XCross</code> (4.811 &lt; 5.371 &lt; 6.536)。</>}
                  en={<><strong>pair</strong> requires one F2L pair simultaneously with the Cross — equivalent to a fixed-slot version of std's XCross sub-goal. The three-way inequality is strict: <code>std/Cross &lt; pair/Cross &lt; std/XCross</code> (4.811 &lt; 5.371 &lt; 6.536).</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>eo_cross</strong> 在 std 基础上额外要求所有 12 棱块色向归零 (Edge Orientation),约束最严,平均步数比 std 多 1.6 步。这是 ZZ 体系 (由 <strong>Zbigniew Zborowski</strong> 提出的速拧体系) 的标准首块定义。</>}
                  en={<><strong>eo_cross</strong> additionally requires all 12 edges fully oriented on top of Cross — the strictest goal; ~1.6 moves longer than std on average. This is the canonical first-block of the ZZ method, the speedsolving system proposed by <strong>Zbigniew Zborowski</strong>.</>}
                />
              </li>
              <li>
                <L
                  zh={<>4 类变体的算法骨架与 std <strong>完全一致</strong>,差异仅在剪枝表的目标状态、状态空间维度,以及部分专用移动表 (例如 EO 涉及 mt_eo12)。同一份 Lehmer / 移动表 / 剪枝表 / IDA* / 共轭 / 阶段间传播的脚手架在四个变体上零修改复用。</>}
                  en={<>The other 4 variants share the std algorithmic skeleton <strong>verbatim</strong> — they differ only in prune-table goal states, sub-state dimensions, and a few EO-specific move tables (e.g. mt_eo12). The Lehmer / move-table / prune-table / IDA* / conjugation / cross-stage-propagation scaffolding works unchanged for all four.</>}
                />
              </li>
            </ul>
          </section>

          {/* ============================================================ */}
          {/* 05 Sub state-space                                            */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">05</span>
              <h2 className="algo-section-title"><L zh="子状态空间精确大小" en="Sub state-space sizes" /></h2>
            </header>

            <p>
              <L
                zh={<>Cross 关注 4 条底棱 (在标准方位下为 E8, E9, E10, E11)。每条棱有 12 个位置 × 2 个朝向 = 24 个 slot/orientation,且 4 条棱互不相同,所以</>}
                en={<>The Cross sub-problem tracks 4 bottom edges (in canonical orientation: E8, E9, E10, E11). Each edge has 12 positions × 2 flips = 24 slot/orientation pairs, distinct between the four edges, so</>}
              />
            </p>
            <code className="algo-eq">|Cross| = 24 · 22 · 20 · 18 = 190,080.</code>

            <p>
              <L
                zh={<>XCross 在 Cross 基础上添加 1 对 F2L 块 (1 角 + 1 棱),分别 24 个状态:</>}
                en={<>XCross adds one F2L pair (1 corner + 1 edge) on top of Cross, each with 24 states:</>}
              />
            </p>
            <code className="algo-eq">|XCross| = 190,080 · 24 · 24 = 109,486,080 ≈ 1.09 × 10<sup>8</sup>.</code>

            <p>
              <L
                zh={<>XXCross 加 2 对 F2L:</>}
                en={<>XXCross adds 2 F2L pairs:</>}
              />
            </p>
            <code className="algo-eq">|XXCross| = 190,080 · 24<sup>2</sup> · 24<sup>2</sup> ≈ 6.30 × 10<sup>10</sup>.</code>

            <p>
              <L
                zh={<>到 XXXCross / F2L 全状态空间已经过大,无法存为单一表。这是为什么后面要引入 "Huge 邻接 / 对角剪枝表" + 共轭变换让 4 个槽位共用一份预计算 (§10 / §12)。</>}
                en={<>By XXXCross / F2L the full product space is too large to materialise as one table. Hence the "Huge neighbour / diagonal prune tables" + a conjugation trick (§10, §12) that lets four slots share a single precomputation.</>}
              />
            </p>
          </section>

          {/* ============================================================ */}
          {/* 06 Lehmer encoding                                            */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">06</span>
              <h2 className="algo-section-title"><L zh="Lehmer 排列编码" en="Lehmer permutation encoding" /></h2>
            </header>

            <h3 className="algo-subsection-title">
              <L zh="单棱、单角的状态值" en="Single-edge / single-corner state values" />
            </h3>
            <p>
              <L
                zh={<>每个棱块的状态由它<strong>当前所在的槽位编号 p</strong> 与<strong>色向 o</strong> 联合决定:</>}
                en={<>Each edge cubie's state combines its <strong>current slot index p</strong> with its <strong>orientation o</strong>:</>}
              />
            </p>
            <code className="algo-eq">v_edge = 2p + o,&nbsp;&nbsp;&nbsp;p ∈ &#123;0, ..., 11&#125;,&nbsp;&nbsp;o ∈ &#123;0, 1&#125;.</code>
            <p>
              <L
                zh={<>这编码下单棱共 12 × 2 = 24 种状态,对应代码常量 <code>StateSpace::EDGE = 24</code>。单角类似:</>}
                en={<>That gives 12 × 2 = 24 states per edge, the constant <code>StateSpace::EDGE = 24</code> in code. Corners likewise:</>}
              />
            </p>
            <code className="algo-eq">v_corn = 3p + o,&nbsp;&nbsp;&nbsp;p ∈ &#123;0, ..., 7&#125;,&nbsp;&nbsp;o ∈ &#123;0, 1, 2&#125;.</code>
            <p>
              <L
                zh={<>同样是 8 × 3 = 24 种状态 (<code>StateSpace::CORNER = 24</code>) — Cross / XCross / F2L 阶段用到的所有单块编码都建立在这两个 24 之上。</>}
                en={<>Also 8 × 3 = 24 states (<code>StateSpace::CORNER = 24</code>). Every per-cubie index used by Cross / XCross / F2L sits on these two 24s.</>}
              />
            </p>

            <h3 className="algo-subsection-title">
              <L zh="多块组合:Lehmer 编码" en="Combining cubies: the Lehmer code" />
            </h3>
            <p>
              <L
                zh={<>稀疏数组直接索引浪费严重:Cross 4 条棱朴素索引 24<sup>4</sup> = 331,776 个槽,实际只有 190,080 个合法状态 (利用率 ~57%)。Lehmer 编码 (factorial number system) 把"从 n 个元素中按顺序选 k 个排列"压成 [0, P(n,k)) 的紧凑整数。对 Cross:</>}
                en={<>Sparse indexing wastes memory: naive 24<sup>4</sup> = 331,776 cells for 4 edges, while only 190,080 are legal (~57% utilization). Lehmer code (factorial number system) maps "ordered choice of k from n" onto [0, P(n,k)) compactly. For Cross:</>}
              />
            </p>
            <code className="algo-eq">|Cross| = P(12, 4) · 2<sup>4</sup> = 11,880 · 16 = 190,080.</code>
            <p>
              <L
                zh={<>具体规则:对长度 n 的部分排列 (a₀, ..., a_{'{'}n−1{'}'}) 按字典序排好,Lehmer 编码就是这段排列在字典里的"页码"。一个最小的例子:从 &#123;0, 1, 2&#125; 中取 2 个元素的有序排列共 P(3, 2) = 6 种,字典序:</>}
                en={<>The rule: list all length-n ordered choices in lexicographic order; the Lehmer code is the row number. A minimal example — pick 2 of &#123;0, 1, 2&#125;, P(3, 2) = 6 permutations sorted lexicographically:</>}
              />
            </p>
            <code className="algo-eq">
              (0,1) → 0,&nbsp;&nbsp;(0,2) → 1,&nbsp;&nbsp;(1,0) → 2,&nbsp;&nbsp;(1,2) → 3,&nbsp;&nbsp;(2,0) → 4,&nbsp;&nbsp;(2,1) → 5.
            </code>
            <p>
              <L
                zh={<>编码无须逐个翻查:对每一位 a_i,先数出"该位左侧已使用、且比 a_i 小"的元素个数 t_i;则 a_i 在"剩余可选元素列表"中的排名是 a_i − t_i,把这一排名乘以"剩余位数对应的阶乘权重",累加即得整数秩。例如对排列 (1, 2):a₀ = 1 排名 1,权重 P(2,1) = 2,得 1×2 = 2;a₁ = 2(左侧已用 1,排名为 2 − 1 = 1),权重 P(1, 0) = 1,得 1;合计 3,与字典序 (1, 2) → 3 一致。</>}
                en={<>Encoding is closed-form, not a table lookup. For each position i: count t_i = "elements to the left of a_i that are smaller". The rank of a_i in "remaining choices" is a_i − t_i; multiply by the factorial weight for the remaining positions and sum. Example for (1, 2): a₀ = 1 has rank 1, weight P(2, 1) = 2 → 1×2 = 2. a₁ = 2 (1 used on the left, rank = 2 − 1 = 1), weight P(1, 0) = 1 → 1. Total 3 — matches the table above.</>}
              />
            </p>

            <p>
              <L
                zh={<>一般形式 (从 n 个元素中选 k 个排列):</>}
                en={<>General form (k-of-n ordered choice):</>}
              />
            </p>
            <code className="algo-eq">
              index = Σᵢ (aᵢ − tᵢ) · P(n − 1 − i, k − 1 − i).
            </code>

            <p>
              <L
                zh={<>实现把"位置编码"与"朝向编码"分开:n 个朝向位 (c = 2 或 3) 直接做 c 进制位编码;然后从原数组里把朝向位除掉,再对剩下的"位置数组"按 Lehmer 累加得到位置编码;最后线性合成。三个参数:</>}
                en={<>The implementation factors out an orientation slice (c = 2 or 3) as a c-ary integer, divides the raw array by c to get a pure permutation, applies the Lehmer formula above to that, then linearly combines them. Three parameters:</>}
              />
            </p>
            <ul>
              <li><L zh={<><code>c</code> = 朝向基数(棱 c = 2,角 c = 3)</>} en={<><code>c</code> = orientation base (edges c = 2, corners c = 3)</>} /></li>
              <li><L zh={<><code>pn</code> = 该类型块的总数(棱 pn = 12,角 pn = 8)</>} en={<><code>pn</code> = total cubies of this type (edges 12, corners 8)</>} /></li>
              <li><L zh={<><code>n</code> = 参与编码的块数(Cross 用 4 条棱,XCross 加 1 角 + 1 棱)</>} en={<><code>n</code> = cubies actually encoded (Cross uses 4 edges, XCross adds 1 corner + 1 edge)</>} /></li>
            </ul>
            <p>
              <L
                zh={<><code>base_array</code> 与 <code>c_array</code> 是预计算的阶乘进制权重表 (在程序启动时初始化),分别给出"剩余位数对应的排列权重"与"剩余位数对应的朝向 c 进制权重"。</>}
                en={<><code>base_array</code> and <code>c_array</code> are factorial-base weight tables, initialised at startup. They hold "remaining-position permutation weight" and "remaining-position orientation c-ary weight" respectively.</>}
              />
            </p>
            <pre className="algo-code">
{`int array_to_index(const vector<int>& a, int n, int c, int pn) {
  int idx_p = 0, idx_o = 0, tmp;
  // (1) orientation: low c-ary digits
  for (int i = 0; i < n; ++i)
    idx_o += (a[i] % c) * c_array[c][n - i - 1];
  // (2) position: Lehmer code over a[i] / c
  vector<int> pa = a;
  for (int i = 0; i < n; ++i) pa[i] /= c;
  for (int i = 0; i < n; ++i) {
    tmp = 0;
    for (int j = 0; j < i; ++j)
      if (pa[j] < pa[i]) tmp++;
    idx_p += (pa[i] - tmp) * base_array[24 / pn][i];
  }
  return idx_p * c_array[c][n] + idx_o;
}`}
            </pre>

            <p>
              <L
                zh={<>解码是逆过程:取出 c 进制朝向位,再用一个递减的"剩余元素列表"按 Lehmer 系数还原原排列。整个编码-解码是双射,因此剪枝表的每一格都对应唯一一个真实状态,无空洞,无碰撞。</>}
                en={<>Decoding inverts: pull out the c-ary orientation digits, then walk a shrinking "remaining values" list driven by the Lehmer coefficients. The map is a bijection, so every prune-table cell corresponds to exactly one real state — no holes, no collisions.</>}
              />
            </p>

            <h3 className="algo-subsection-title">
              <L zh="Cross 的双半组拆分" en="Cross split into two half-groups" />
            </h3>
            <p>
              <L
                zh={<>整体把 4 棱编码 190,080 用作单一索引,剪枝表 ~93 KB 单看可行;但在更高阶搜索中要把它与 Corner / Edge 维度做笛卡尔积,加上 mt_edge4 的 24 步幅形态后体积会迅速膨胀。Cross 求解器换用轻量替代:把 4 棱分成两个互不相交的半组 {'{E8, E9}'} 与 {'{E10, E11}'},各用 EDGE2 编码独立索引:</>}
                en={<>Encoding the 4 cross-edges as a single 190,080-index gives a ~93 KB prune table; but the Cartesian product with Corner / Edge dimensions plus mt_edge4's 24-stride bloats it fast at higher stages. The Cross solver picks a lighter alternative: split the 4 edges into two disjoint half-groups {'{E8, E9}'} and {'{E10, E11}'} and index each by its own EDGE2:</>}
              />
            </p>
            <code className="algo-eq">|S_Edge2| = 24 · 22 = 528,&nbsp;&nbsp;&nbsp;528 · 528 = 278,784 ≈ 140 KB.</code>

            <pre className="algo-code">
{`constexpr int EDGE2          = 528;     // 单半组的状态空间大小
constexpr int EDGE2_A_SOLVED = 416;     // {E8, E9}   的 Lehmer 秩 × 2² = 104×4
constexpr int EDGE2_B_SOLVED = 520;     // {E10, E11} 的 Lehmer 秩 × 2² = 130×4
constexpr int CROSS_SOLVED   = 187520;  // 整 Cross 已解状态的整体索引`}
            </pre>
            <p>
              <L
                zh={<>Cross 阶段的剪枝表 pt_cross 直接以二元索引 (i₁, i₂) 编址:</>}
                en={<>The Cross prune table pt_cross addresses by the pair (i₁, i₂):</>}
              />
            </p>
            <code className="algo-eq">
              idx_cross = i₁ · EDGE2 + i₂,&nbsp;&nbsp;&nbsp;i₁, i₂ ∈ [0, 528).
            </code>
            <p>
              <L
                zh={<>拆分的合理性在于两个半组占据互不相交的槽位集 (E8、E9 vs E10、E11),不存在"位置冲突",所以可以独立编码而不丢失任何信息;同时大幅降低与 Corner / Edge 维度联合时的存储压力。</>}
                en={<>The split is lossless: the two halves occupy disjoint slot sets ({'{E8, E9}'} vs {'{E10, E11}'}) so they never collide; you can encode them independently without losing any information, while drastically reducing storage when combined with Corner / Edge dimensions later.</>}
              />
            </p>
          </section>

          {/* ============================================================ */}
          {/* 07 Move tables                                                */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">07</span>
              <h2 className="algo-section-title"><L zh="移动表 (Move tables)" en="Move tables" /></h2>
            </header>

            <p>
              <L
                zh={<>每次状态转移用物理几何变换计算的复杂度是 O(n)(n 是被追踪的块数),IDA* 深度 12 时累计可达 10¹³ 量级,几何变换在这一规模下不可接受。把"状态索引 + 动作 → 新状态索引"提前打表成数组,<strong>用 O(|S|·|M|) 的额外内存换 O(1) 的转移速度</strong>:</>}
                en={<>A physical-geometry transition costs O(n) per node (n = tracked cubies); at IDA* depth 12 that compounds to ~10¹³ — unacceptable. Tabulate "(state index, move) → next state index" once: <strong>O(|S| · |M|) memory in exchange for O(1) transitions.</strong></>}
              />
            </p>
            <code className="algo-eq">mt[s · |M| + m] = T(s, m).</code>
            <p>
              <L
                zh={<>在 IDA* 内层循环常见的访问模式是"读完表立刻进入下一层":下次查表时 s 是上次 mt[...] 的返回值。若每次都做 s × |M| 乘法,18 这种非 2 的幂数无法位移优化,引入非必要开销。源码 <code>createMultiMoveTable</code> 让移动表存储"<strong>已乘 |M| 的偏移量</strong>"而非原始索引,链式查表只剩加法:</>}
                en={<>In the IDA* inner loop, the typical access pattern is "read the table, descend immediately": next time, s is the returned value. Doing s × |M| each time means a multiplication by 18, which isn't a power of two and can't be shift-optimised. <code>createMultiMoveTable</code> stores the "<strong>pre-multiplied by |M|</strong>" offset instead, so chained lookups need only addition:</>}
              />
            </p>
            <code className="algo-eq">s_next = mt[s_cur + m].</code>
            <p>
              <L
                zh={<>其中 s 始终保持"已乘 |M|"状态。源码 <code>createMultiMoveTable</code> 中 <code>mt[18·tmp + inv[j]] = i</code> (反向填充时使用) 即体现这一约定,每个状态实际占用 18 个数组槽位。</>}
                en={<>s stays in the "already × |M|" form. Source <code>createMultiMoveTable</code> writes <code>mt[18·tmp + inv[j]] = i</code> (the backward-fill path) which respects this convention; each state owns 18 contiguous slots.</>}
              />
            </p>

            <h3 className="algo-subsection-title">
              <L zh="mt_edge4 的特殊步幅" en="mt_edge4: a non-18 stride" />
            </h3>
            <p>
              <L
                zh={<>对 std 求解器的<strong>搜索热路径</strong> (XCross search_1),每个节点需查三张表:Cross 4 棱联合表 mt_edge4 + F2L 1 角 mt_corn + F2L 1 棱 mt_edge。若三者均为 18 步幅,索引合成时还要做几次乘法。源码把 mt_edge4 设计成 <strong>24-步幅</strong>(由 <code>createMultiMoveTable2</code> 而非 <code>createMultiMoveTable</code> 生成):每条 cell 存 <code>next_index × 24</code>。</>}
                en={<>The hottest path (XCross search_1) needs three lookups per node: the 4-edge Cross table mt_edge4 + 1 corner mt_corn + 1 edge mt_edge. If all three used 18 stride, index synthesis would need extra multiplications. The source gives mt_edge4 a <strong>24 stride</strong> (built by <code>createMultiMoveTable2</code> rather than <code>createMultiMoveTable</code>): each cell stores <code>next_index × 24</code>.</>}
              />
            </p>
            <p>
              <L
                zh={<>之所以选 24 这个数字,是因为 <strong>24 恰好等于单角块状态数,也等于单棱块状态数</strong>(见 §06 的 EDGE = 24 / CORNER = 24)。这样在 search_1 中,Cross 状态的下一值 <code>n_i1</code> 已经预乘了 24,可以直接与 [0, 24) 的 Corner 索引相加,得到「Cross_idx × 24 + Corner_idx」的联合坐标;再乘 24 加 Edge 索引,即可得到三维联合索引,<strong>全程仅一次乘法</strong>。代价是 mt_edge4 比同形态的 18 步幅版本多用 (24 − 18) / 18 ≈ 33% 的内存,约 4.3 MB,可以接受。</>}
                en={<>24 is chosen because <strong>24 = single-corner state count = single-edge state count</strong> (see §06: EDGE = CORNER = 24). In search_1 the next Cross-state <code>n_i1</code> is therefore already <code>× 24</code>; we just add the [0, 24) corner index to get "Cross_idx × 24 + corner_idx", then × 24 + edge index → 3-D joint index. <strong>One multiplication for the whole step.</strong> The cost is mt_edge4 using (24 − 18)/18 ≈ 33% more memory than the 18-stride form (~4.3 MB) — acceptable.</>}
              />
            </p>

            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="表" en="Table" /></th>
                  <th><L zh="追踪对象" en="Tracks" /></th>
                  <th className="num">|S|</th>
                  <th className="num"><L zh="步幅" en="Stride" /></th>
                  <th className="num"><L zh="条目数" en="Entries" /></th>
                </tr>
              </thead>
              <tbody>
                <tr><td>mt_edge</td><td><L zh="单棱块" en="single edge" /></td><td className="num">24</td><td className="num">18</td><td className="num">432</td></tr>
                <tr><td>mt_corn</td><td><L zh="单角块" en="single corner" /></td><td className="num">24</td><td className="num">18</td><td className="num">432</td></tr>
                <tr><td>mt_edge2</td><td><L zh="2 棱块组 (Cross 半组)" en="2-edge group (Cross half)" /></td><td className="num">528</td><td className="num">18</td><td className="num">9,504</td></tr>
                <tr><td>mt_edge3</td><td><L zh="3 棱块组" en="3-edge group" /></td><td className="num">10,560</td><td className="num">18</td><td className="num">190,080</td></tr>
                <tr><td>mt_corn2</td><td><L zh="2 角块组" en="2-corner group" /></td><td className="num">504</td><td className="num">18</td><td className="num">9,072</td></tr>
                <tr><td>mt_corn3</td><td><L zh="3 角块组" en="3-corner group" /></td><td className="num">9,072</td><td className="num">18</td><td className="num">163,296</td></tr>
                <tr><td>mt_edge4 (× 24)</td><td><L zh="4 棱块组 (整 Cross)" en="4-edge group (full Cross)" /></td><td className="num">190,080</td><td className="num">24</td><td className="num">4,561,920</td></tr>
                <tr><td>mt_edge6</td><td><L zh="6 棱块组 (Huge 表配合)" en="6-edge group (paired with Huge)" /></td><td className="num">42,577,920</td><td className="num">18</td><td className="num">766,402,560</td></tr>
              </tbody>
            </table>

            <p>
              <L
                zh={<>mt_edge6 单表约 3 GB,运行时通过 mmap 映入只读地址空间,避免一次性塞进 RAM 又能享受 OS 页缓存。<strong>其余 7 张表全部常驻内存</strong>。所有 <code>.bin</code> 文件由 <code>table_generator.exe</code> 离线一次性预生成,存放在 <code>tables/</code> 目录下;搜索器启动时直接 load,无需运行时计算。</>}
                en={<>mt_edge6 alone is ~3 GB; runtime maps it read-only via mmap, avoiding a single big alloc while still benefiting from the OS page cache. <strong>The other 7 tables stay resident in RAM.</strong> All <code>.bin</code> files are produced once offline by <code>table_generator.exe</code> into the <code>tables/</code> directory; the solver just loads them at startup, no runtime computation.</>}
              />
            </p>
          </section>

          {/* ============================================================ */}
          {/* 08 Prune tables                                               */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">08</span>
              <h2 className="algo-section-title"><L zh="剪枝表 (Prune tables)" en="Prune tables" /></h2>
            </header>

            <p>
              <L
                zh={<>对每个 (索引化的) 子状态 s,存"它到目标集的真实最短路径长度" h(s)。在 IDA* 的某次深度 D 迭代里,若已经走了 g 步且 g + h(s) ≥ D,则当前分支不可能在 D 步内到达目标,直接剪枝并回溯。条件叫 <strong>admissibility</strong>:</>}
                en={<>For each (indexed) sub-state s store the true shortest distance to the goal set, h(s). During an IDA* iteration with bound D, if g moves have been made and g + h(s) ≥ D, the branch cannot reach the goal within D moves — prune and backtrack. The required property is <strong>admissibility</strong>:</>}
              />
            </p>
            <code className="algo-eq">∀ s: h(s) ≤ d(s, goal).</code>
            <p>
              <L
                zh={<>若 h 永不高估真实距离 (admissible),IDA* 在第一个找到的解处必为全局最优解;<strong>否则只能保证近似解</strong>。这是本求解器在所有阶段使用"逆向 BFS 算出的精确子状态距离"作为 h 的根本原因 —— 距离值即是该子空间内的真实最短路径,严格 ≤ 真实距离。</>}
                en={<>If h never overestimates (admissible), IDA*'s first solution is globally optimal. <strong>If admissibility fails, only an approximation is guaranteed.</strong> That's why every prune table here uses a reverse-BFS-computed exact distance within its sub-state space: that distance is genuinely shortest in the projection, so it strictly bounds the real distance from above.</>}
              />
            </p>

            <p>
              <L
                zh={<>逆向 BFS 填表 (源码 <code>prune_create.cpp::createPTCrossCE</code>):从目标集开始标 0,每轮把所有"标了 d 且邻居还未标"的 <strong>18 种逆操作</strong>邻居赋 d+1,直到表满。并发用 OpenMP + CAS 写入避免锁,新增计数为 0 时提前终止:</>}
                en={<>Reverse-BFS fill (source: <code>prune_create.cpp::createPTCrossCE</code>): seed goal cells with 0; each round expand <strong>all 18 inverse moves</strong> of cells already at depth d and set unmarked neighbours to d+1, until the table is full. Parallel writes use OpenMP + CAS to avoid locks; early termination when a round adds 0 new cells:</>}
              />
            </p>
            <pre className="algo-code">
{`tmp[start_idx] = 0;
for (int d = 0; d < depth; ++d) {
  int nd = d + 1;
  #pragma omp parallel for reduction(+ : cnt)
  for (long long i = 0; i < total; ++i) {
    if (tmp[i] != d) continue;
    // expand 18 neighbours of i
    for (int j = 0; j < 18; ++j) {
      long long ni = move_table_lookup(i, j);
      unsigned char expected = 255;
      __sync_val_compare_and_swap(&tmp[ni], expected, nd);
    }
  }
}`}
            </pre>

            <p>
              <L
                zh={<>std 各阶段实际最大距离都 ≤ 12 (F2L 也只在 W 视角下能达到 15),4-bit (0 ~ 15) 足够表示,<strong>一个字节存两格,存储减半</strong> — 对动辄数十 MB 到 10 GB 的剪枝表非常关键。源码 <code>prune_tables.h</code> 中的访问宏:</>}
                en={<>Per-stage diameters under std are ≤ 12 (15 only for F2L on single-W); 4 bits (0 ~ 15) suffice, <strong>two cells per byte halves storage</strong> — critical for tables ranging from tens of MB to 10 GB. The macros in <code>prune_tables.h</code>:</>}
              />
            </p>
            <pre className="algo-code">
{`inline int get_prune(const unsigned char* table, long long index) {
  return (table[index >> 1] >> ((index & 1) << 2)) & 0xF;
}

inline void set_prune(vector<unsigned char>& table, long long index, int value) {
  int shift = (index & 1) << 2;
  table[index >> 1] &= ~(0xF << shift);
  table[index >> 1] |= (value & 0xF) << shift;
}`}
            </pre>
            <p>
              <L
                zh={<><code>index &gt;&gt; 1</code> 是字节地址,<code>(index &amp; 1) &lt;&lt; 2</code> 是 0 或 4 的左移量,决定使用低 4 位还是高 4 位;<code>&amp; 0xF</code> 取出 4-bit 值。</>}
                en={<><code>index &gt;&gt; 1</code> is the byte address; <code>(index &amp; 1) &lt;&lt; 2</code> is a shift of 0 or 4, deciding low or high nibble; <code>&amp; 0xF</code> masks out the 4-bit value.</>}
              />
            </p>

            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="剪枝表" en="Prune table" /></th>
                  <th><L zh="子状态" en="Sub-state" /></th>
                  <th className="num"><L zh="索引空间" en="Index space" /></th>
                  <th className="num"><L zh="存储 (4-bit)" en="Storage (4-bit)" /></th>
                  <th><L zh="加载方式" en="Load mode" /></th>
                </tr>
              </thead>
              <tbody>
                <tr><td>pt_cross</td><td>Cross 4 <L zh="条棱" en="edges" /></td><td className="num">278,784</td><td className="num">~ 140 KB</td><td><L zh="常驻内存" en="resident" /></td></tr>
                <tr><td>pt_cross_C4E0</td><td>Cross + 1 <L zh="角 + 1 棱 (XCross)" en="corner + 1 edge (XCross)" /></td><td className="num">1.09 × 10<sup>8</sup></td><td className="num">~ 52 MB</td><td><L zh="常驻内存" en="resident" /></td></tr>
                <tr>
                  <td>pt_cross_C4C5E0E1<br />(Huge NB)</td>
                  <td>Cross + <L zh="邻接 2 角 2 棱" en="2 neighbour pairs" /></td>
                  <td className="num">~ 2.14 × 10<sup>10</sup></td>
                  <td className="num">~ 10 GB</td>
                  <td><L zh="mmap 按需访问" en="mmap on demand" /></td>
                </tr>
                <tr>
                  <td>pt_cross_C4C6E0E2<br />(Huge DG)</td>
                  <td>Cross + <L zh="对角 2 角 2 棱" en="2 diagonal pairs" /></td>
                  <td className="num">~ 2.14 × 10<sup>10</sup></td>
                  <td className="num">~ 10 GB</td>
                  <td><L zh="mmap 按需访问" en="mmap on demand" /></td>
                </tr>
              </tbody>
            </table>

            <h3 className="algo-subsection-title">
              <L zh="Admissibility 与最优性证明" en="Admissibility & the optimality theorem" />
            </h3>
            <p>
              <L
                zh={<>由于剪枝表存储的是<strong>子状态空间内的精确最短距离</strong>,记为 <code>h*</code>。对完整魔方状态 s,投影到子状态空间上得 <code>s_sub</code>,我们使用 <code>h(s) = h*(s_sub)</code> 作为启发值。原空间的最短路径只会比子空间长(因为原空间有<strong>更多</strong>约束 — 子空间忽略了部分块),所以:</>}
                en={<>Because each prune table stores the <strong>exact shortest distance within its sub-state space</strong> (call it <code>h*</code>), we use <code>h(s) = h*(s_sub)</code> where s_sub is the projection of the full cube state s onto the sub-state. Shortest paths in the full space can only be at least as long as in the projection (the full space has <strong>more</strong> constraints — the projection ignores some cubies), so:</>}
              />
            </p>
            <code className="algo-eq">h(s) = h*(s_sub) ≤ d(s, G).</code>
            <p>
              <L
                zh={<>即 h 永不高估,admissibility 严格成立。再结合 IDA* 的迭代加深性质(从初始下界开始,每轮深度上限 +1 重做 DFS),可以证明:<strong>第一次成功找到目标的 D 即为该打乱的最优步数</strong>。这正是本求解器结果可信赖性的数学基石。</>}
                en={<>So h is non-overestimating — admissibility holds strictly. Combined with IDA*'s iterative deepening (DFS bounded by an integer D that grows by 1 per round starting from the initial lower bound), the proof is short: <strong>the first solution found, at some depth D, equals the optimal move count</strong>. This is the mathematical bedrock under all of the solver's numeric claims.</>}
              />
            </p>
          </section>

          {/* ============================================================ */}
          {/* 09 IDA*                                                       */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">09</span>
              <h2 className="algo-section-title"><L zh="IDA* 搜索循环" en="IDA* search loop" /></h2>
            </header>

            <p>
              <L
                zh={<>IDA* (Iterative Deepening A*) 由 Korf 于 1985 年提出,用以解决 A* 算法在大状态空间上内存开销过大的问题。其核心思想是把<strong>深度优先搜索 (DFS) 的线性内存占用</strong>与 <strong>A* 的启发式剪枝</strong>相结合:</>}
                en={<>IDA* (Iterative Deepening A*) was introduced by Korf in 1985 to solve A*'s memory blow-up on large state spaces. The core idea combines <strong>DFS's linear memory</strong> with <strong>A*'s heuristic pruning</strong>:</>}
              />
            </p>
            <ul>
              <li><L zh={<>每轮设定深度上限 D,执行带启发式剪枝的 DFS;</>} en={<>Each round sets a depth bound D and runs a DFS with heuristic pruning;</>} /></li>
              <li><L zh={<>若深度 D 内未找到解,令 D ← D + 1,重新搜索;</>} en={<>If no solution at D, set D ← D + 1 and retry;</>} /></li>
              <li><L zh={<>由于搜索是单链路 DFS,空间复杂度仅 O(D)。</>} en={<>Search is a single-path DFS, so space is just O(D).</>} /></li>
            </ul>
            <p>
              <L
                zh={<>对每个节点 s,递归前先查 h(s),若 g + h(s) ≥ D 则剪枝。表面看每轮 D 都从根重做搜索似乎冗余,<strong>但实际由于搜索深度按指数增长,最深一轮通常占总用时 95% 以上,重做开销可忽略</strong>。</>}
                en={<>For each node s, look up h(s) first; if g + h(s) ≥ D, prune. Restarting from the root each round looks wasteful, <strong>but because the search tree grows exponentially with depth, the deepest round alone usually accounts for 95%+ of total runtime — redo cost is amortised away</strong>.</>}
              />
            </p>

            <h3 className="algo-subsection-title">
              <L zh="算法伪代码" en="Pseudocode" />
            </h3>
            <pre className="algo-code">
{`function IDA_STAR(s_root):
  D ← h(s_root)                     // 初始深度上限
  while True:
    found, new_D ← DFS(s_root, 0, D)
    if found: return D              // 找到解, 即为最优
    if new_D = ∞: return None       // 不可达
    D ← new_D

function DFS(s, g, D):
  if g = D and s ∈ goal: return (True, _)
  f ← g + h(s)
  if f > D: return (False, f)       // 超出深度, 记录下次的最小 f
  next_D ← ∞
  for m in valid_moves[prev]:
    s' ← move_table[s, m]
    found, t ← DFS(s', g + 1, D)
    if found:    return (True, _)
    next_D ← min(next_D, t)
  return (False, next_D)`}
            </pre>
            <p>
              <L
                zh={<>源码中并未显式记录 <code>next_D</code>,而是直接以 <code>D = h(s_root); D ≤ MAX; D++</code> 的 <code>for</code> 循环递增,因为各阶段的最大深度有先验上界 (Cross ≤ 8, XCross ≤ 12, F2L ≤ 15)。这一简化牺牲了"精确跳过中间无效深度"的小优化,换取实现的极度简洁。第一次命中即是最优解,因为剪枝下界 admissible。</>}
                en={<>The source code does not bother to track <code>next_D</code>; it just runs <code>for (D = h(s_root); D ≤ MAX; D++)</code>, since every stage has a known diameter (Cross ≤ 8, XCross ≤ 12, F2L ≤ 15). This trade gives up a small win ("skip the exact next-D") for extreme implementation simplicity. The first hit is optimal because the heuristic is admissible.</>}
              />
            </p>

            <h3 className="algo-subsection-title">
              <L zh="Cross 求解器:cross_solver.h" en="Cross solver: cross_solver.h" />
            </h3>
            <p>
              <L
                zh={<>把上面三件事 (移动表、剪枝表、IDA*) 落到 71 行 C++ 上,就是 std_analyzer 里最简洁的组件 <code>CrossSolver</code>:</>}
                en={<>Wiring move tables + prune tables + IDA* into 71 lines of C++ gives <code>CrossSolver</code>, the cleanest component in std_analyzer:</>}
              />
            </p>
            <pre className="algo-code">
{`struct CrossSolver {
  const int *p_mt_edge2;
  const unsigned char *p_pt;          // Cross 剪枝表

  CrossSolver() {
    p_mt_edge2 = MoveTableManager::getInstance().getMTEdge2Ptr();
    p_pt       = PruneTableManager::getInstance().getCrossPTPtr();
  }

  bool search(int i1, int i2, int depth, int prev) {
    const int *moves = valid_moves_flat[prev];
    const int  count = valid_moves_count[prev];
    for (int k = 0; k < count; ++k) {
      int m    = moves[k];
      int n_i1 = p_mt_edge2[i1 + m];                              // (a)
      int n_i2 = p_mt_edge2[i2 + m];                              // (a)
      long long idx = (long long)n_i1 * StateSpace::EDGE2 + n_i2; // (b)
      if (get_prune(p_pt, idx) >= depth)  continue;               // (c)
      if (depth == 1)                     return true;            // (d)
      if (search(n_i1 * 18, n_i2 * 18, depth - 1, m))             // (e)
        return true;
    }
    return false;
  }
};`}
            </pre>
            <ul>
              <li><strong>(a) <L zh="双查表" en="Two table lookups" /></strong>:
                <L
                  zh={<>i₁、i₂ 已经预乘 18,直接 + m 得新偏移量,无乘法。</>}
                  en={<>i₁ and i₂ are stored pre-multiplied by 18; just add m to step to the next offset — no multiplication.</>}
                />
              </li>
              <li><strong>(b) <L zh="索引合成" en="Index synthesis" /></strong>:
                <L
                  zh={<>idx = n_i₁ × 528 + n_i₂,得到剪枝表的一维偏移。n_i₁ 是除以 18 后的真实索引,这里需要一次乘法。</>}
                  en={<>idx = n_i₁ × 528 + n_i₂ — the 1-D offset into the prune table. Because n_i₁ is the true index (already divided by 18), one multiplication is unavoidable here.</>}
                />
              </li>
              <li><strong>(c) <L zh="启发式剪枝" en="Heuristic prune" /></strong>:
                <L
                  zh={<>若 h(s') ≥ depth,路径不可能在剩余步数内完成,跳过。</>}
                  en={<>If h(s') ≥ depth the branch can't finish in the remaining budget — skip.</>}
                />
              </li>
              <li><strong>(d) <L zh="提前判断" en="Early accept" /></strong>:
                <L
                  zh={<>当 depth = 1 且 h = 0(在 (c) 处即被检测出),意味着当前转动恰好把状态送到 Cross 完成态,直接返回成功。</>}
                  en={<>When depth = 1 and h = 0 (already filtered out by (c)), the current move lands exactly at the Cross-solved state — return success.</>}
                />
              </li>
              <li><strong>(e) <L zh="递归" en="Recurse" /></strong>:
                <L
                  zh={<>状态偏移再乘 18 (变回"已乘步幅"形态),depth 减 1,prev 设为 m。</>}
                  en={<>Re-multiply state offsets by 18 (back to the "pre-strided" form), depth − 1, prev ← m, recurse.</>}
                />
              </li>
            </ul>

            <h3 className="algo-subsection-title">
              <L zh="逆向编码:get_stats 怎么把打乱变成初值" en="Inverse encoding: how get_stats turns a scramble into initial indices" />
            </h3>
            <p>
              <L
                zh={<>调用 <code>search</code> 之前要把打乱公式对应的魔方状态编码为 (i₁, i₂)。最自然的做法是模拟出乱序后的物理状态再编码,但 std_analyzer 用了一个更简洁的逆向技巧:<strong>从已解 Cross 状态 (i₁, i₂) = (EDGE2_A_SOLVED, EDGE2_B_SOLVED) 出发,依次对打乱公式的每一步走移动表</strong> —— 这与"先施加打乱再编码"等价,因为移动表本身就是状态空间内的双射。</>}
                en={<>Before calling <code>search</code>, the scramble must be mapped to (i₁, i₂). The obvious route is to simulate the physical state and then encode it; std_analyzer instead uses a tighter inverse trick: <strong>start from the solved Cross state (i₁, i₂) = (EDGE2_A_SOLVED, EDGE2_B_SOLVED) and apply each scramble move through the move table</strong>. This equals "scramble first, then encode" because move tables are bijections inside the state space.</>}
              />
            </p>
            <pre className="algo-code">
{`vector<int> get_stats(const vector<int>& base_alg,
                      const vector<string>& rots) {
  vector<int> res(rots.size(), 0);
  for (size_t i = 0; i < rots.size(); ++i) {
    auto alg = alg_rotation(base_alg, rots[i]);
    int i1 = StateSpace::EDGE2_A_SOLVED;     // 416
    int i2 = StateSpace::EDGE2_B_SOLVED;     // 520
    for (int m : alg) {                       // 逐步施加打乱
      i1 = p_mt_edge2[i1 * 18 + m];
      i2 = p_mt_edge2[i2 * 18 + m];
    }
    long long idx = (long long)i1 * StateSpace::EDGE2 + i2;
    int d_min = get_prune(p_pt, idx);         // 启发式下界
    if (d_min == 0) continue;                 // Cross 已完成
    for (int d = d_min; d <= 8; ++d) {        // IDA* 迭代加深
      if (search(i1 * 18, i2 * 18, d, 18)) {  // prev=18 表示无上一步
        res[i] = d;
        break;
      }
    }
  }
  return res;
}`}
            </pre>
            <p>
              <L
                zh={<>这一手的好处是<strong>不需要再写"物理状态 → 编码"的转换代码</strong>,整个分析器都可以基于"初始状态 + 打乱序列"这一抽象。rots 参数是颜色中性 6 视角列表 (见 §15)。</>}
                en={<>The payoff: <strong>no "physical state → index" conversion code is needed anywhere</strong>; the whole analyzer runs on the "initial state + scramble sequence" abstraction. The rots parameter feeds the 6 color-neutrality views (see §15).</>}
              />
            </p>

            <h3 className="algo-subsection-title">
              <L zh="search_1:XCross 的三维搜索" en="search_1: three-dimensional XCross search" />
            </h3>
            <p>
              <L
                zh={<>把上面的 Cross 求解器升级到 XCross,需要同时追踪 (i₁ Cross 半组、i₂ Cross 半组、F2L 1 角、F2L 1 棱)。代码里抽象成 search_1,槽位用 s1 表示;(a) 共轭变换、(b) mt_edge4 24 步幅、(c) 三表索引合成 是三个关键点:</>}
                en={<>Stepping up to XCross adds 1 corner + 1 edge of one F2L slot to track. The function is search_1; slot index is s1. Three key tricks: (a) conjugation, (b) mt_edge4's 24-stride, (c) three-table index synthesis.</>}
              />
            </p>
            <pre className="algo-code">
{`bool search_1(int i1, int i2, int i3, int s1, int depth, int prev) {
  const int *moves = valid_moves_flat[prev];
  const int  count = valid_moves_count[prev];
  for (int k = 0; k < count; ++k) {
    int m  = moves[k];
    int m1 = conj_moves_flat[m][s1];                 // (a) 共轭
    int n_i1 = p_mt_edge4[i1 + m1];                  // (b) Edge4: 24-步幅
    int n_i2 = p_mt_corn [i2 + m1];                  //     Corner: 18-步幅
    int n_i3 = p_mt_edge [i3 + m1];                  //     Edge:   18-步幅
    long long idx = (long long)(n_i1 + n_i2) * 24 + n_i3;  // (c)
    if (get_prune(p_pt_cross_C4E0, idx) >= depth) continue;
    if (depth == 1) return true;
    if (search_1(n_i1, n_i2 * 18, n_i3 * 18, s1, depth - 1, m))
      return true;
  }
  return false;
}`}
            </pre>
            <ul>
              <li><strong>(a) <L zh="共轭变换" en="Conjugation" /></strong>:
                <L
                  zh={<>m₁ = conj_moves_flat[m][s₁],把转动 m 在 s₁ 槽位视角下映射为该视角下的等价转动,使全部 4 个 F2L 槽位都可以共用同一份剪枝表。详 §10。</>}
                  en={<>m₁ = conj_moves_flat[m][s₁] maps move m into the s₁-slot's frame, so all 4 F2L slots share one prune table. See §10.</>}
                />
              </li>
              <li><strong>(b) <L zh="三表查询" en="Three table lookups" /></strong>:
                <L
                  zh={<>mt_edge4 是步幅 24 的特殊表,直接返回「下一个 Cross 状态 × 24」;mt_corn 与 mt_edge 都是步幅 18 的标准表,返回原始索引。</>}
                  en={<>mt_edge4 has the 24-stride form: its return value is already "next Cross state × 24". mt_corn and mt_edge use the standard 18-stride and return raw indices.</>}
                />
              </li>
              <li><strong>(c) <L zh="索引合成" en="Index synthesis" /></strong>:
                <L
                  zh={<>n_i₁ 已含 ×24 因子,加 n_i₂ (角 0..23) 即「Cross_idx × 24 + corner_idx」的复合,再乘 24 加 n_i₃ (棱 0..23) 即三维索引,全程仅一次乘法。</>}
                  en={<>n_i₁ already carries the ×24 factor; adding n_i₂ (corner 0..23) builds "Cross_idx × 24 + corner_idx", then × 24 + n_i₃ (edge 0..23) gives the 3-D index — one multiplication total.</>}
                />
              </li>
            </ul>
          </section>

          {/* ============================================================ */}
          {/* 10 Conjugation                                                */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">10</span>
              <h2 className="algo-section-title"><L zh="共轭变换 (conjugation)" en="Conjugation for slot symmetry" /></h2>
            </header>

            <p>
              <L
                zh={<>F2L 有 4 个槽位:BL / BR / FR / FL。如果给每个槽分别建一份剪枝表,Huge 表就要 4 份 × 10 GB = 40 GB。利用 y 轴 90° 旋转把所有槽位映射到同一个"参考槽 (槽 0)":</>}
                en={<>F2L has 4 slots: BL / BR / FR / FL. A separate prune table per slot would need 4 × 10 GB = 40 GB for Huge. Use a y-axis 90° rotation to map every slot back to the same "reference slot" (slot 0):</>}
              />
            </p>
            <code className="algo-eq">m' = conj_moves_flat[m][k],&nbsp;&nbsp;&nbsp;k ∈ &#123;0, 1, 2, 3&#125;.</code>

            <p>
              <L
                zh={<>对槽位 k 求解时不改打乱、不改表,只把走的动作 m 替换成共轭动作 m'。映射规则非常具体:</>}
                en={<>To solve in slot k, the scramble and table stay put; the move m we'd execute is rewritten through conjugation m'. The mapping is concrete:</>}
              />
            </p>
            <ul>
              <li><code>y</code>: F→L→B→R→F (<L zh="侧面循环 90°" en="side faces cycle 90°" />)</li>
              <li><code>y2</code>: <L zh="F↔B,L↔R" en="F↔B, L↔R" /></li>
              <li><code>y'</code>: <L zh="F→R→B→L→F (逆向)" en="F→R→B→L→F (reverse)" /></li>
              <li><L zh="U / D 面动作不变" en="U / D face moves stay put" /></li>
            </ul>

            <p>
              <L
                zh={<>整张 <code>conj_moves_flat</code> 是 18 × 4 的预计算表,在 <code>cube_common.cpp::init_matrix</code> 中通过遍历 18 种 move 配合 y / y² / y' 的转换规则一次性算出。运行时一次索引解决。其几何意义可表述为:<strong>U → U,D → D</strong>(顶 / 底面动作不变),而 <strong>R / L / F / B</strong> 在每次 90° 顶面旋转下按 <strong>R → F → L → B → R</strong> 循环映射,具体保留 <strong>90° / 180° / -90° 后缀类型不变</strong>(例如 R2 映射到 F2 而不是 F)。这是 std 求解器最关键的一个对称性利用,把 4 × Huge 砍到 1 × Huge。</>}
                en={<>The whole <code>conj_moves_flat</code> is an 18 × 4 precomputed table; <code>cube_common.cpp::init_matrix</code> builds it once by enumerating 18 moves × y / y² / y' rules. One indexing at runtime. Geometrically: <strong>U → U, D → D</strong> (top/bottom moves are fixed) while <strong>R / L / F / B</strong> rotate <strong>R → F → L → B → R</strong> per 90° y-rotation, <strong>preserving the 90° / 180° / -90° suffix</strong> (e.g. R2 → F2, never F). This is the single most important symmetry exploit in the std solver — it collapses 4 × Huge into 1 × Huge.</>}
              />
            </p>
          </section>

          {/* ============================================================ */}
          {/* 11 Slot ordering + early exit                                 */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">11</span>
              <h2 className="algo-section-title"><L zh="槽位排序 + 早退" en="Slot ordering + early exit" /></h2>
            </header>

            <p>
              <L
                zh={<>XCross 在 4 个槽位中取最小:实际只想要 min_k h(s, k)。先用 O(1) 的剪枝表查询为每个槽位拿到下界 h_k,把 4 个候选按 h_k 升序排序,然后顺序跑 IDA*:</>}
                en={<>XCross is min over 4 slots: we only want min_k d(s, slot_k). First pull the O(1) prune-table bound h_k per slot, sort the 4 candidates by h_k ascending, then run IDA* in that order:</>}
              />
            </p>

            <pre className="algo-code">
{`sort(tasks, [](auto& a, auto& b){ return a.h < b.h; });
int current_best = 99;
for (auto& t : tasks) {
  if (t.h >= current_best) break;          // (1) 下界已超过现存最优,跳过
  int max_search = min(12, current_best - 1);
  int res = 99;
  if (t.h > 0) {
    for (int d = t.h; d <= max_search; ++d) {
      if (search_1(...)) { res = d; break; }
    }
  } else res = 0;
  if (res < current_best) current_best = res;
}
xc_min[r] = current_best;`}
            </pre>

            <p>
              <L
                zh={<>(1) 行是早退:已经找到某槽 7 步解,后续槽位下界 ≥ 7 就完全跳过。
                数据:WCA XCross 均值 6.54、std 0.69,在 BGORWY 视角下 mode = 7 占 54.20%。<strong>约 50% 的打乱在第 1 个槽位就找到 ≤ 7 的解,后续 3 个槽位的 IDA* 深度被 <code>min(12, current_best - 1)</code> 压到 6,大量节点被排除。</strong>绝大多数样本只跑 1 ~ 2 个槽位就拿到答案。</>}
                en={<>Line (1) is the early exit: once a 7-move XCross is found in one slot, slots with a bound ≥ 7 are skipped entirely. WCA XCross has mean 6.54, std 0.69, mode 7 at 54.20% (BGORWY view). <strong>About 50% of scrambles already hit a ≤ 7 answer in the first slot, capping the remaining 3 slots' IDA* depth at 6 via <code>min(12, current_best - 1)</code> — large fractions of the search tree are pruned.</strong> Most scrambles only touch 1 ~ 2 slots in practice.</>}
              />
            </p>
          </section>

          {/* ============================================================ */}
          {/* 12 Huge tables (NB + DG)                                      */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">12</span>
              <h2 className="algo-section-title"><L zh="Huge 邻接 / 对角剪枝表" en="Huge neighbour / diagonal tables" /></h2>
            </header>

            <p>
              <L
                zh={<>XXCross 在 4 个槽位中两两组合 = 6 对。F2L 4 槽 = 4 选 2 = 6 对;XXXCross 4 选 3 = 4 选 1 (剩下的) 也是 4 种情况。怎样让这"任意一对"都共享一份预计算?根据两槽位的相对几何关系,把所有对儿分成两类:</>}
                en={<>XXCross picks 2 of 4 slots = 6 unordered pairs. F2L's 4 slots = 4-choose-2 = 6 pairs; XXXCross has 4 cases. To share precomputation across "any pair," classify pairs by relative geometry:</>}
              />
            </p>

            <ul>
              <li>
                <L
                  zh={<><strong>Neighbour (邻接, NB)</strong>:两槽相邻 (slot 差为 ±1 mod 4)。例 BL+BR,FR+FL。共 4 对。</>}
                  en={<><strong>Neighbour (NB)</strong>: adjacent slots (slot difference ±1 mod 4). e.g. BL+BR, FR+FL — 4 pairs.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>Diagonal (对角, DG)</strong>:两槽对角 (slot 差为 2 mod 4)。例 BL+FR,BR+FL。共 2 对。</>}
                  en={<><strong>Diagonal (DG)</strong>: opposite slots (slot difference 2 mod 4). e.g. BL+FR, BR+FL — 2 pairs.</>}
                />
              </li>
            </ul>

            <p>
              <L
                zh={<>各做一张 Huge 剪枝表:NB 用 pt_cross_C4C5E0E1 (Cross + 邻接 2 对),DG 用 pt_cross_C4C6E0E2 (Cross + 对角 2 对)。配合共轭变换,每对都能对齐到参考几何。空间:</>}
                en={<>One Huge prune table per class: NB → pt_cross_C4C5E0E1 (Cross + 2 neighbour pairs), DG → pt_cross_C4C6E0E2 (Cross + 2 diagonal pairs). Combined with conjugation, every pair maps to a canonical geometry. Sizes:</>}
              />
            </p>
            <code className="algo-eq">|Huge| = |EDGE6| · |CORNER2| = 42,577,920 · 504 ≈ 2.14 × 10<sup>10</sup>.</code>

            <p>
              <L
                zh={<>4-bit 紧凑存 + mmap 后,每张约 10 GB。<strong>对每条打乱的每个槽位对,先用对应 Huge 表给出一个紧的初始下界,随后 search_2 中每展开一个节点都重新查询该 Huge 表;若返回值 ≥ 当前剩余深度则剪枝。</strong>由于 Huge 表对"整 Cross + 2 槽 F2L 块"联合建模,其给出的<strong>下界比每个槽位单独查 pt_cross_C4E0 之和更紧</strong>,因此能在更浅深度截断大量分支。XXCross 起 search_2 直接走 Huge,后续 XXXCross / F2L 也能复用上界 (作为更弱的下界)。如果机器内存不够,退化到只用 pt_cross_C4E0 也可以,只是剪枝弱,搜索深度变深。</>}
                en={<>4-bit packed + mmap, each ~10 GB. <strong>For each (scramble, slot pair), the corresponding Huge table first supplies a tight initial lower bound, then every node expansion inside search_2 re-queries that Huge table; if the lookup ≥ remaining depth, the branch is pruned.</strong> Because Huge models "full Cross + 2 F2L slot-blocks" jointly, the bound it gives is <strong>tighter than the sum of independent per-slot pt_cross_C4E0 queries</strong>, allowing cutoffs at shallower depths. search_2 reads Huge directly at XXCross; XXXCross / F2L can also reuse it as a weaker bound. If memory is tight, falling back to pt_cross_C4E0 alone still works — at the cost of a weaker prune and deeper search.</>}
              />
            </p>

            {/* search_3 / search_4 — 多槽位 Huge 表的组合扩展 */}
            <h3 className="algo-subsection-title">
              <L
                zh={<><code>search_3</code> 与 <code>search_4</code>:进一步扩展到 3 / 4 槽位</>}
                en={<><code>search_3</code> and <code>search_4</code>: scaling to 3 and 4 slots</>}
              />
            </h3>

            <p>
              <L
                zh={<>XXCross 已经把整 Cross + 2 个 F2L 槽块联合建模。再往下,槽位数继续增加,几何组合数也增加,但每对槽位之间永远只有 NB 与 DG 两种关系,Huge 表本身不需要新建,只需要枚举所有"槽对"配组。</>}
                en={<>search_2 already models the full Cross + two F2L slot-blocks jointly. As slot count grows, the geometric combinations grow too — but every pair of slots is still either neighbour (NB) or diagonal (DG). The Huge tables themselves don't change; only the enumeration of slot-pairs does.</>}
              />
            </p>

            <ul>
              <li>
                <L
                  zh={<><strong><code>search_3</code> (XXXCross, 3 个槽位)</strong>:维护 3 视角的常规 pt_cross_C4E0 剪枝 + <strong>3 对 Huge 表</strong> 查询(C(3,2) = 3 个槽位对)。每对的 NB / DG 类别决定查哪张 Huge。</>}
                  en={<><strong><code>search_3</code> (XXXCross, 3 slots)</strong>: maintains the standard pt_cross_C4E0 prune across 3 perspectives + <strong>3 Huge-table queries</strong> (C(3,2) = 3 slot pairs). Each pair's NB / DG class selects which Huge to query.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong><code>search_4</code> (F2L, 4 个槽位)</strong>:同时维护 <strong>4 对相邻 Huge + 2 对对角 Huge = 6 个槽位对</strong>(C(4,2) = 6),完整覆盖 4 槽间所有几何关系。每个搜索节点共做 4 (基础剪枝) + 6 (Huge) ≈ 14 次查表。</>}
                  en={<><strong><code>search_4</code> (F2L, 4 slots)</strong>: maintains <strong>4 neighbour Huge + 2 diagonal Huge = 6 slot-pair</strong> lookups (C(4,2) = 6), covering every geometric relation across the 4 slots. Each search node performs 4 base-prune + 6 Huge ≈ 14 table queries.</>}
                />
              </li>
            </ul>

            <p>
              <L
                zh={<>从 search_2 到 search_4,每节点的剪枝表查询次数从 <strong>4 张</strong>线性增至 <strong>14 张</strong>;但每加一张更紧的下界,有效剪枝率单调上升,使整体搜索节点数随阶段呈<strong>缓慢增长而非指数爆炸</strong>。这是"用多次精确启发查询换取激进剪枝"的折衷 —— std_analyzer 在 8 核机器上 OpenMP 并行下,几秒钟即可完成单条打乱的 5 阶段 × 6 视角 = 30 次完整最优搜索。</>}
                en={<>From search_2 to search_4 the per-node table query count rises linearly from <strong>4</strong> to <strong>14</strong>; but each extra tight lower bound monotonically raises the effective prune rate, so total node count <strong>grows slowly, not exponentially</strong>, across stages. This is the "many-precise-heuristic-queries for aggressive pruning" trade — under OpenMP on 8 cores, std_analyzer finishes one scramble's 5 stages × 6 orientations = 30 full optimal searches in a few seconds.</>}
              />
            </p>

            <figure className="algo-figure">
              <img src={`${FIG_BASE}/fig09_stage_means.png`} alt="Stage means across the 5 CFOP stages" />
              <figcaption>
                <L
                  zh="5 阶段均值跨越 4.81 / 6.54 / 8.49 / 10.57 / 12.90 步,每对 F2L 平均增加约 2 步"
                  en="Stage means span 4.81 / 6.54 / 8.49 / 10.57 / 12.90 moves — each F2L pair averages about +2"
                />
              </figcaption>
            </figure>
          </section>

          {/* ============================================================ */}
          {/* 13 Lower-bound propagation                                    */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">13</span>
              <h2 className="algo-section-title"><L zh="阶段间下界传播" en="Cross-stage lower-bound propagation" /></h2>
            </header>

            <p>
              <L
                zh={<>关键观察:Cross 是 XCross 的子目标,XCross 又是 XXCross 的子目标,因此</>}
                en={<>Key observation: Cross is a sub-goal of XCross, XCross is a sub-goal of XXCross, so</>}
              />
            </p>
            <code className="algo-eq">d(Cross) ≤ d(XCross) ≤ d(XXCross) ≤ d(XXXCross) ≤ d(F2L).</code>

            <p>
              <L
                zh={<>源码 <code>get_stats</code> 按阶段顺序求解,前一阶段的当前视角最优值保存为 <code>xc_min[r]</code> / <code>xxc_min[r]</code> / <code>xxxc_min[r]</code> 三个数组,在下一阶段中作为搜索起始深度的下界。到 XXCross 阶段时,XCross 最优值已经算出;让 IDA* 起步深度 max(h_prune, xc_min[r]) 而不是 h_prune,直接跳过所有"比上一阶段最优还短"的徒劳迭代。XCross = 7 时,XXCross 从 7 起搜,跳过 0 ~ 6 的全部 7 个轮次;<strong>最坏情况下 (XCross = 3 而 XXCross = 14) 可节省 11 轮</strong>。统计 (WCA 数据)上 XCross 与 XXCross 模差通常 ≤ 2,所以 IDA* 在 95% 样本上只跑 1 ~ 3 轮就命中:</>}
                en={<>The source <code>get_stats</code> solves stages in order and stashes each stage's per-view optimum into <code>xc_min[r]</code> / <code>xxc_min[r]</code> / <code>xxxc_min[r]</code> for the next stage to read. At XXCross, the XCross optimum is known; start IDA* at max(h_prune, xc_min[r]) instead of h_prune, skipping every iteration shorter than the previous stage. If XCross = 7, XXCross starts at 7 — skipping all of 0 ~ 6. <strong>Worst case (XCross = 3 and XXCross = 14) skips 11 rounds.</strong> WCA distributions show stage-to-stage spread is usually ≤ 2, so IDA* nails 95% of samples in 1 ~ 3 rounds:</>}
              />
            </p>

            <pre className="algo-code">
{`// XXCross 起搜深度: 不低于前一阶段最优,也不低于自己的剪枝下界
int startD = std::max(h_prune, xc_min[r]);
for (int d = startD; d <= 14; ++d) {
  if (search_2(..., d, ...)) { res = d; break; }
}`}
            </pre>

            <p>
              <L
                zh={<>整体观感:每多一阶段,IDA* 起步深度都接近终点,迭代次数从经典的 ~D 轮压成 ~2 轮。<strong>即使 IDA* 重做的代价中最深一轮通常占 95% 以上(指数级搜索树压在最后一层),跨阶段传播仍能在中等难度打乱上带来约 30% ~ 40% 的额外加速</strong> — 通过把"最后一层"也压在更高的深度起点。这是 std 求解器在 F2L 阶段也能跑得快的核心原因。</>}
                en={<>Net effect: each stage starts IDA* close to its terminal depth, collapsing the classical ~D iterations down to ~2. <strong>Even though the deepest round of an IDA* re-search typically owns 95%+ of total cost (the search tree is exponential), cross-stage propagation still buys roughly 30% ~ 40% extra speedup on mid-difficulty scrambles</strong> — by raising the floor under which the deepest round itself starts. This is why the std solver stays fast even at F2L depth 14 ~ 15.</>}
              />
            </p>
          </section>

          {/* ============================================================ */}
          {/* 14 Large-sample experiments                                   */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">14</span>
              <h2 className="algo-section-title"><L zh="大样本实验" en="Large-sample experiments" /></h2>
            </header>

            <p>
              <L
                zh={<>两个数据集:</>}
                en={<>Two datasets:</>}
              />
            </p>
            <ul>
              <li>
                <L
                  zh={<><strong>Set 1 (WCA)</strong>:1,200,000 条来自 WCA 历届比赛的 3×3 打乱 (3×3、单手、盲拧、多盲、最少步、脚拧 6 个项目聚合)。代表真实赛场分布。</>}
                  en={<><strong>Set 1 (WCA)</strong>: 1,200,000 official 3×3 scrambles aggregated from 6 events (3×3, OH, BLD, MultiBLD, FMC, Feet). Real competition distribution.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>Set 2 (困难子集)</strong>:1,271,727 条 WY 轴 dual-color XCross 恰好 = 10 步的打乱 (即在白底和黄底都需要满 10 步)。U/D 轴求解器的最坏情况压力测试。</>}
                  en={<><strong>Set 2 (hard subset)</strong>: 1,271,727 scrambles whose WY-axis dual-color XCross is exactly 10 moves (single-W and single-Y both need 10). Worst-case stress test for U/D-axis solvers.</>}
                />
              </li>
            </ul>

            <p>
              <L
                zh={<>每条打乱跑 5 阶段 × 6 视角 = 30 次最优搜索。总搜索次数 (1.20M + 1.27M) × 5 × 6 ≈ 7,400 万次。结果以 CSV 格式输出,<strong>每行 1 (打乱 ID) + 5 (阶段) × 6 (视角) = 31 列</strong>,后续聚合脚本对 6 个底色子集取 min,推导出 14 种色中性配置 (6 单色 + 3 双色 + 3 四色 + 1 全 CN + 1 基线)。</>}
                en={<>Each scramble runs 5 stages × 6 orientations = 30 optimal solves. Total: (1.20M + 1.27M) × 5 × 6 ≈ 74M optimal searches. Output is CSV with <strong>1 (scramble id) + 5 (stages) × 6 (orientations) = 31 columns per row</strong>; downstream aggregation takes min over color subsets to derive 14 CN configurations (6 single + 3 dual + 3 quad + 1 hex + 1 baseline).</>}
              />
            </p>

            <h3 style={{ fontFamily: 'var(--mono)', fontSize: 16, marginTop: 28, color: 'var(--text)' }}>
              <L zh="WCA std 五阶段汇总" en="WCA std five-stage summary" />
            </h3>

            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="阶段" en="Stage" /></th>
                  <th><L zh="子集" en="Subset" /></th>
                  <th className="num">min</th>
                  <th className="num">max</th>
                  <th className="num"><L zh="均值" en="mean" /></th>
                  <th className="num">std</th>
                  <th className="num">p10</th>
                  <th className="num">p50</th>
                  <th className="num">p90</th>
                  <th className="num">p99</th>
                  <th className="num"><L zh="众数 (占比)" en="mode (%)" /></th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Cross</td><td>W</td><td className="num">0</td><td className="num">8</td><td className="num">5.813</td><td className="num">0.83</td><td className="num">5</td><td className="num">6</td><td className="num">7</td><td className="num">7</td><td className="num">6 (51.24)</td></tr>
                <tr><td>Cross</td><td>WY</td><td className="num">0</td><td className="num">8</td><td className="num">5.388</td><td className="num">0.79</td><td className="num">4</td><td className="num">5</td><td className="num">6</td><td className="num">7</td><td className="num">6 (45.27)</td></tr>
                <tr><td>Cross</td><td>BGORWY</td><td className="num">0</td><td className="num">7</td><td className="num">4.811</td><td className="num">0.76</td><td className="num">4</td><td className="num">5</td><td className="num">6</td><td className="num">6</td><td className="num">5 (55.40)</td></tr>
                <tr><td>XCross</td><td>W</td><td className="num">1</td><td className="num">9</td><td className="num">7.355</td><td className="num">0.73</td><td className="num">6</td><td className="num">7</td><td className="num">8</td><td className="num">9</td><td className="num">8 (44.60)</td></tr>
                <tr><td>XCross</td><td>WY</td><td className="num">1</td><td className="num">9</td><td className="num">6.987</td><td className="num">0.71</td><td className="num">6</td><td className="num">7</td><td className="num">8</td><td className="num">8</td><td className="num">7 (58.49)</td></tr>
                <tr><td>XCross</td><td>BGORWY</td><td className="num">1</td><td className="num">8</td><td className="num">6.536</td><td className="num">0.69</td><td className="num">6</td><td className="num">7</td><td className="num">7</td><td className="num">8</td><td className="num">7 (54.20)</td></tr>
                <tr><td>XXCross</td><td>W</td><td className="num">4</td><td className="num">11</td><td className="num">9.233</td><td className="num">0.70</td><td className="num">8</td><td className="num">9</td><td className="num">10</td><td className="num">10</td><td className="num">9 (51.08)</td></tr>
                <tr><td>XXCross</td><td>BGORWY</td><td className="num">3</td><td className="num">10</td><td className="num">8.493</td><td className="num">0.67</td><td className="num">8</td><td className="num">9</td><td className="num">9</td><td className="num">10</td><td className="num">9 (53.00)</td></tr>
                <tr><td>XXXCross</td><td>W</td><td className="num">6</td><td className="num">13</td><td className="num">11.314</td><td className="num">0.68</td><td className="num">11</td><td className="num">11</td><td className="num">12</td><td className="num">12</td><td className="num">11 (48.71)</td></tr>
                <tr><td>XXXCross</td><td>BGORWY</td><td className="num">5</td><td className="num">12</td><td className="num">10.572</td><td className="num">0.65</td><td className="num">10</td><td className="num">11</td><td className="num">11</td><td className="num">12</td><td className="num">11 (57.93)</td></tr>
                <tr><td>F2L</td><td>W</td><td className="num">8</td><td className="num">15</td><td className="num">13.639</td><td className="num">0.63</td><td className="num">13</td><td className="num">14</td><td className="num">14</td><td className="num">15</td><td className="num">14 (61.88)</td></tr>
                <tr><td>F2L</td><td>WY</td><td className="num">8</td><td className="num">15</td><td className="num">13.344</td><td className="num">0.65</td><td className="num">13</td><td className="num">13</td><td className="num">14</td><td className="num">14</td><td className="num">13 (49.03)</td></tr>
                <tr><td>F2L</td><td>BGORWY</td><td className="num">8</td><td className="num">15</td><td className="num">12.900</td><td className="num">0.63</td><td className="num">12</td><td className="num">13</td><td className="num">14</td><td className="num">14</td><td className="num">13 (66.75)</td></tr>
              </tbody>
            </table>

            <figure className="algo-figure">
              <img src={`${FIG_BASE}/fig01_std_cross_wca_W.png`} alt="WCA std Cross single-white distribution" />
              <figcaption>
                <L
                  zh="图 01:WCA 1.2M 样本下,单色白底 Cross 步数分布。众数 6 步占 51.24%,7 步占 18.40%,最大 8 步。"
                  en="Fig 01: WCA 1.2M sample, single-white Cross distribution. Mode 6 (51.24%), 7 at 18.40%, max 8."
                />
              </figcaption>
            </figure>

            <figure className="algo-figure">
              <img src={`${FIG_BASE}/fig02_std_cross_wca_compare.png`} alt="WCA std Cross W vs WY vs BGORWY" />
              <figcaption>
                <L
                  zh="图 02:Cross 同打乱 W / WY / BGORWY 三种视角分布并排对比。颜色组扩大,分布整体左移。"
                  en="Fig 02: Cross W vs WY vs BGORWY side-by-side. Wider colour subsets shift the distribution left."
                />
              </figcaption>
            </figure>

            <figure className="algo-figure">
              <img src={`${FIG_BASE}/fig03_std_xcross_wca_BGORWY.png`} alt="WCA std XCross full CN distribution" />
              <figcaption>
                <L
                  zh="图 03:XCross BGORWY 分布,众数 7 步占 54.20%,上界 8 步。每条打乱 4 个槽位取 min 之后再 6 视角取 min。"
                  en="Fig 03: XCross BGORWY distribution; mode 7 at 54.20%, max 8. min over 4 slots then min over 6 orientations."
                />
              </figcaption>
            </figure>

            <figure className="algo-figure">
              <img src={`${FIG_BASE}/fig04_std_f2l_wca_BGORWY.png`} alt="WCA std F2L full CN distribution" />
              <figcaption>
                <L
                  zh="图 04:F2L (XXXXCross) BGORWY 分布,众数 13 步占 66.75%,长尾延伸到 15。"
                  en="Fig 04: F2L (XXXXCross) BGORWY distribution; mode 13 at 66.75%, tail to 15."
                />
              </figcaption>
            </figure>

            <figure className="algo-figure">
              <img src={`${FIG_BASE}/fig05_std_all_stages_BGORWY.png`} alt="All 5 stages in one panel, BGORWY" />
              <figcaption>
                <L
                  zh="图 05:5 阶段 BGORWY 分布堆叠对比。相邻阶段均值差呈递增 (+1.73 → +1.96 → +2.08 → +2.33),每加一对 F2L 越来越贵。"
                  en="Fig 05: 5 stages stacked, BGORWY view. Stage-to-stage mean gaps grow (+1.73 → +1.96 → +2.08 → +2.33) — each added pair gets more expensive."
                />
              </figcaption>
            </figure>

            <p>
              <L
                zh={<>读图三个观察:</>}
                en={<>Three reads from the plots:</>}
              />
            </p>
            <ul>
              <li>
                <L
                  zh={<><strong>极尖锐的单峰</strong>:45 ~ 67% 样本集中在众数,标准差仅 0.6 ~ 0.8。普通快拧手凭感觉做的"差不多 7 ~ 8 步十字"在统计上是真的 — 但 std 给出的是数学下界。</>}
                  en={<><strong>Tight unimodal peaks</strong>: 45 ~ 67% of samples sit at the mode, std 0.6 ~ 0.8. The speedcuber's intuition "cross is usually 7 ~ 8" is empirically real — but std gives the mathematical lower bound, not a heuristic.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>每阶段平均加 ~2 步</strong>:4.81 → 6.54 → 8.49 → 10.57 → 12.90。每加一对 F2L 都比前一对略贵 (+1.73, +1.96, +2.08, +2.33)。</>}
                  en={<><strong>~2 moves per stage</strong>: 4.81 → 6.54 → 8.49 → 10.57 → 12.90. Each added pair costs slightly more than the last (+1.73, +1.96, +2.08, +2.33).</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>Cross 直径 ≤ 8</strong> (单色)、<strong>F2L 直径 = 15</strong>。Cross 8 是 HTM 的 Cross-完美打乱上界,跟历史文献一致;F2L 长尾比 Cross 宽,因为 4 对独立棋子方差累加。</>}
                  en={<><strong>Cross diameter ≤ 8</strong> (single-color), <strong>F2L diameter = 15</strong>. The Cross-8 bound matches the long-known HTM result; F2L's longer tail reflects independent variance from 4 separate pairs.</>}
                />
              </li>
            </ul>

            <h3 style={{ fontFamily: 'var(--mono)', fontSize: 16, marginTop: 28, color: 'var(--text)' }}>
              <L zh="阶段递增量 (BGORWY)" en="Stage-to-stage mean increments (BGORWY)" />
            </h3>
            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="过渡" en="Transition" /></th>
                  <th className="num"><L zh="均值差" en="Mean Δ" /></th>
                </tr>
              </thead>
              <tbody>
                <tr><td>XCross − Cross</td><td className="num">+1.726</td></tr>
                <tr><td>XXCross − XCross</td><td className="num">+1.957</td></tr>
                <tr><td>XXXCross − XXCross</td><td className="num">+2.078</td></tr>
                <tr><td>F2L − XXXCross</td><td className="num">+2.328</td></tr>
              </tbody>
            </table>
          </section>

          {/* ============================================================ */}
          {/* 15 Color neutrality                                           */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">15</span>
              <h2 className="algo-section-title"><L zh="颜色中性的边际收益" en="Color-neutrality marginal gain" /></h2>
            </header>

            <p>
              <L
                zh={<>颜色中性 (CN) 指"快拧手在 6 个底面颜色里挑最有利的一个开始"。std solver 对每条打乱跑全部 6 视角,然后按子集大小取 min,可量化每加一个轴 / 每加几个颜色具体省多少步。</>}
                en={<>Color neutrality (CN) means the solver can pick the most favourable bottom color at runtime. The std solver runs all 6 orientations per scramble; taking min over subsets quantifies the savings per added axis / colour.</>}
              />
            </p>

            <h3 className="algo-subsection-title">
              <L zh="6 视角的物理意义" en="The six orientations, geometrically" />
            </h3>
            <p>
              <L
                zh={<>"以另一颜色为底"等价于对整个打乱公式做一次立方体旋转。源码 std_analyzer.cpp 的旋转列表为:</>}
                en={<>"Use a different bottom color" is equivalent to a cube-wide rotation applied to the scramble. The list in std_analyzer.cpp:</>}
              />
            </p>
            <code className="algo-eq">rots = &#123; (<L zh="无" en="identity" />), z², z', z, x', x &#125;.</code>
            <p>
              <L
                zh={<>对应输出 CSV 的 6 列后缀 _z0 / _z2 / _z3 / _z1 / _x3 / _x1,底面颜色分别为 <strong>Y、W、O、R、G、B</strong>。同一条打乱在这 6 个视角下分别求最少步,就拿到一个 6 元组,任何颜色中性子集(单色 / 双色 / 四色 / 全 CN)都对此取 min 即可。</>}
                en={<>These map to CSV columns _z0 / _z2 / _z3 / _z1 / _x3 / _x1, with bottom colors <strong>Y, W, O, R, G, B</strong> respectively. One scramble gives a 6-tuple of optimal step counts; any color-neutral subset (single / dual / quad / full) is just min over the relevant cells.</>}
              />
            </p>
            <p>
              <L
                zh={<>在 alg_rotation 函数中,8 种基本旋转按以下规则变换 move 编号(把每一步打乱重映射,无需触碰状态本身):</>}
                en={<>alg_rotation rewrites move indices according to these 8 basic rotations; the state object never changes:</>}
              />
            </p>
            <pre className="algo-code">
{`y  : F→L→B→R→F    (顶面顺时针 90°)
y2 : F↔B,  L↔R
y' : F→R→B→L→F   (逆向)
z  : U→R→D→L→U
z2 : U↔D,  L↔R
z' : U→L→D→R→U
x  : U→F→D→B→U    (右侧顺时针 90°)
x' : U→B→D→F→U`}
            </pre>

            <h3 className="algo-subsection-title">
              <L zh="实现细节:旋转打乱而非旋转状态" en="Implementation: rotate the scramble, not the state" />
            </h3>
            <p>
              <L
                zh={<>两条可能路径:(1) 在状态空间内对索引做对称变换;(2) 直接对输入打乱公式做转动序列变换。后者更易于实现,且与缓存友好 —— std_analyzer 采用后者。<code>alg_rotation(base_alg, rot)</code> 把每个 move 编号 i (0..17) 映射为旋转视角下的等价 move,得到的新公式与 base_alg 等价但底色不同,直接交给 search 即可。整个分析器都基于"初始状态 + 打乱序列"这一抽象,不需要再写"物理状态 → 编码"的转换代码。</>}
                en={<>Two implementation paths: (1) rotate indices inside the state space; (2) rewrite the scramble itself. The latter is simpler and cache-friendly — std_analyzer picks it. <code>alg_rotation(base_alg, rot)</code> remaps every move index i (0..17) to its equivalent under the chosen rotation; the new alg is equivalent to base_alg but viewed from a different bottom color, and feeds straight into <code>search</code>. The whole analyzer runs on the "initial state + scramble sequence" abstraction with no physical-state-to-index converter anywhere.</>}
              />
            </p>

            <h3 className="algo-subsection-title">
              <L zh="6 → 14 个颜色中性配置的派生" en="From 6 views to 14 CN configurations" />
            </h3>
            <p>
              <L
                zh={<>得到 6 元组之后,对 6 个底色子集类型派生 14 种配置:6 个单色 / 3 个双色 (WY, BG, OR) / 3 个四色 (BGOR, ORWY, BGWY) / 1 个三对色 (BGORWY 全 CN) / 还有 1 个保留为基线。每种配置对 6 元组取 min,统计的就是该色中性策略下的真实步数分布。</>}
                en={<>From the 6-tuple we derive 14 CN configurations: 6 singles / 3 duals (WY, BG, OR) / 3 quads (BGOR, ORWY, BGWY) / 1 hex (BGORWY full CN) / plus 1 baseline. Each configuration takes min over its colors, then we plot / aggregate the resulting distribution.</>}
              />
            </p>

            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="子集" en="Subset" /></th>
                  <th className="num"><L zh="基数" en="Cardinality" /></th>
                  <th className="num"><L zh="Cross 均值" en="Cross mean" /></th>
                  <th className="num"><L zh="对 W 节省" en="Savings vs W" /></th>
                </tr>
              </thead>
              <tbody>
                <tr><td>W (<L zh="单色" en="single" />)</td><td className="num">1</td><td className="num">5.813</td><td className="num">0</td></tr>
                <tr><td>WY (<L zh="对色双中性" en="dual U/D" />)</td><td className="num">2</td><td className="num">5.388</td><td className="num">−0.425</td></tr>
                <tr><td>BGOR / ORWY / BGWY (<L zh="四色" en="quad" />)</td><td className="num">4</td><td className="num">~5.020</td><td className="num">−0.793</td></tr>
                <tr><td>BGORWY (<L zh="全 CN" en="full CN" />)</td><td className="num">6</td><td className="num">4.811</td><td className="num">−1.002</td></tr>
              </tbody>
            </table>

            <p>
              <L
                zh={<>边际收益递减:</>}
                en={<>Diminishing returns:</>}
              />
            </p>
            <ul>
              <li>
                <L
                  zh={<>1 → 2 色 (W → WY):省 <strong>0.425</strong> 步。</>}
                  en={<>1 → 2 (W → WY): saves <strong>0.425</strong>.</>}
                />
              </li>
              <li>
                <L
                  zh={<>2 → 4 色 (WY → ORWY):再省 <strong>0.368</strong> 步。</>}
                  en={<>2 → 4 (WY → ORWY): another <strong>0.368</strong>.</>}
                />
              </li>
              <li>
                <L
                  zh={<>4 → 6 色 (ORWY → BGORWY):仅再省 <strong>0.210</strong> 步。</>}
                  en={<>4 → 6 (ORWY → BGORWY): only <strong>0.210</strong> more.</>}
                />
              </li>
            </ul>

            <figure className="algo-figure">
              <img src={`${FIG_BASE}/fig06_cn_savings.png`} alt="Color neutrality savings curve" />
              <figcaption>
                <L
                  zh="图 06:颜色中性节省随子集大小的曲线。第一步增益最大,后续呈典型递减。"
                  en="Fig 06: CN savings vs subset size. First axis dominates; later axes show classic diminishing returns."
                />
              </figcaption>
            </figure>

            <p>
              <L
                zh={<>结论:dual-axis 颜色中性 (任意一对对色,例如 W-Y 或 B-G) 是性价比最高的训练目标 — 单步学习投入只有 1/3,却拿到 4 色总节省的 53%。从 dual 升到 full CN 平均仅再省 0.58 步,但需要把所有 6 视角的肌肉记忆全部建立。</>}
                en={<>Takeaway: dual-axis CN (any opposite pair such as W-Y or B-G) is the best effort/return — about a third of the muscle-memory cost of full CN for ~53% of its mean savings. Going dual → full CN saves an extra ~0.58 moves on average but at the price of training all 6 orientations.</>}
              />
            </p>
          </section>

          {/* ============================================================ */}
          {/* 16 Cubic symmetry empirical check                             */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">16</span>
              <h2 className="algo-section-title"><L zh="立方对称性的经验验证" en="Empirical cubic symmetry" /></h2>
            </header>

            <p>
              <L
                zh={<>理论上 6 个单色底视角 (B / G / O / R / W / Y) 在均匀打乱下应当统计无差。WCA 打乱并非严格均匀 (TNoodle 生成器 + 历史项目加权),所以测出的偏差能用作生成器质量的间接信号。Cross 阶段 6 单色均值:</>}
                en={<>Cubic symmetry predicts the 6 single-color views (B / G / O / R / W / Y) to be statistically indistinguishable under a uniform scramble distribution. WCA scrambles are not strictly uniform (TNoodle plus history-weighted event mix), so any drift is informative. Cross stage 6 single-colour means:</>}
              />
            </p>

            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="底色" en="Bottom" /></th>
                  <th className="num"><L zh="均值" en="Mean" /></th>
                  <th className="num">std</th>
                  <th className="num">p99</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>B</td><td className="num">5.8135</td><td className="num">0.8258</td><td className="num">7</td></tr>
                <tr><td>G</td><td className="num">5.8115</td><td className="num">0.8266</td><td className="num">7</td></tr>
                <tr><td>O</td><td className="num">5.8111</td><td className="num">0.8262</td><td className="num">7</td></tr>
                <tr><td>R</td><td className="num">5.8125</td><td className="num">0.8262</td><td className="num">7</td></tr>
                <tr><td>W</td><td className="num">5.8129</td><td className="num">0.8254</td><td className="num">7</td></tr>
                <tr><td>Y</td><td className="num">5.8123</td><td className="num">0.8261</td><td className="num">7</td></tr>
              </tbody>
            </table>

            <p>
              <L
                zh={<>6 单色均值极差 <strong>0.0025</strong> 步;理论上 3 对对色 (W-Y / B-G / O-R) 也是立方体的轴线,选 W-Y 作双底面与选 B-G、O-R 应当统计上等价。项目对 1,200,000 条 WCA 打乱在 std/Cross 阶段的均值如下 (论文表 10-1):</>}
                en={<>Single-colour mean spread <strong>0.0025</strong> moves. The 3 dual-color axes (W-Y, B-G, O-R) are also cube axes; selecting W-Y vs B-G vs O-R as the dual bottom should be statistically equivalent. On 1.2M WCA scrambles, std/Cross means (paper Table 10-1):</>}
              />
            </p>

            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="双底面子集" en="Dual subset" /></th>
                  <th className="num"><L zh="均值" en="Mean" /></th>
                  <th className="num"><L zh="中位数" en="Median" /></th>
                  <th className="num">p99</th>
                  <th className="num"><L zh="样本" en="N" /></th>
                </tr>
              </thead>
              <tbody>
                <tr><td>WY</td><td className="num">5.388</td><td className="num">5</td><td className="num">7</td><td className="num">1,200,000</td></tr>
                <tr><td>BG</td><td className="num">5.388</td><td className="num">5</td><td className="num">7</td><td className="num">1,200,000</td></tr>
                <tr><td>OR</td><td className="num">5.388</td><td className="num">5</td><td className="num">7</td><td className="num">1,200,000</td></tr>
              </tbody>
            </table>

            <p>
              <L
                zh={<>三组均值偏差不超过 <strong>0.001 步</strong>,在 120 万样本的统计噪声范围之内。这从数据上印证了立方对称性,也说明 WCA 历史打乱在 6 个底色方向上的分布是均匀的。</>}
                en={<>The three means agree within <strong>0.001 moves</strong> — well inside 1.2M-sample noise. Cubic symmetry holds empirically, and the WCA scramble generator's distribution is uniform across the 6 bottom colors.</>}
              />
            </p>

            <figure className="algo-figure">
              <img src={`${FIG_BASE}/fig10_dual_color_pairs.png`} alt="Dual-color pair means: WY vs BG vs OR" />
              <figcaption>
                <L
                  zh="图 10:对色双中性 WY / BG / OR 的 Cross 均值分布。三条曲线几乎完美重合。"
                  en="Fig 10: dual-color WY / BG / OR Cross-mean distributions. Curves nearly coincide."
                />
              </figcaption>
            </figure>
          </section>

          {/* ============================================================ */}
          {/* 17 Hard subset                                                */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">17</span>
              <h2 className="algo-section-title"><L zh="困难子集压力测试" en="Hard-subset stress test" /></h2>
            </header>

            <p>
              <L
                zh={<>第二个数据集 (xcross_2_col_10f) 是定向收集的"WY-极困难"样本:筛选条件为单白 XCross = 10 且单黄 XCross = 10。这逼着仅 U/D 轴中性的求解器在所有 127 万样本上拿满分 10 步;BG / OR 轴并未受限,因此六色全 CN 下还有缓冲。</>}
                en={<>The second dataset (xcross_2_col_10f) is a deliberately collected WY-hard corpus: single-white XCross = 10 AND single-yellow XCross = 10. This pins a U/D-only solver at 10 moves on every one of 1.27M samples; BG / OR axes stay unconstrained, so full CN still has slack.</>}
              />
            </p>

            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="阶段" en="Stage" /></th>
                  <th className="num">WCA <L zh="均值" en="mean" /></th>
                  <th className="num"><L zh="困难均值" en="Hard mean" /></th>
                  <th className="num">Δ</th>
                  <th className="num">WCA min</th>
                  <th className="num"><L zh="困难 min" en="Hard min" /></th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Cross</td><td className="num">4.811</td><td className="num">7.678</td><td className="num">+2.867</td><td className="num">0</td><td className="num">2</td></tr>
                <tr><td>XCross</td><td className="num">6.536</td><td className="num">8.829</td><td className="num">+2.292</td><td className="num">1</td><td className="num">6</td></tr>
                <tr><td>XXCross</td><td className="num">8.493</td><td className="num">10.049</td><td className="num">+1.555</td><td className="num">3</td><td className="num">8</td></tr>
                <tr><td>XXXCross</td><td className="num">10.572</td><td className="num">11.808</td><td className="num">+1.236</td><td className="num">5</td><td className="num">9</td></tr>
                <tr><td>F2L</td><td className="num">12.900</td><td className="num">13.824</td><td className="num">+0.924</td><td className="num">8</td><td className="num">10</td></tr>
              </tbody>
            </table>

            <p>
              <L
                zh={<>有意思的"衰减":过滤条件定义在 XCross,但 Cross 阶段的均值偏移 (+2.87) 反而最大 — 因为强制 W-XCross = 10 几乎也强制 W-Cross 触顶 (单白 Cross = 8 占 1,271,514 / 1,271,727 ≈ 99.98%)。后续阶段越向 F2L 偏移越小;F2L 阶段只剩 +0.92,说明 XCross 阶段的长尾不会等比例传递到 F2L。这是 std 求解器的 admissible 下界在实战中"上界传播"的另一面证据。</>}
                en={<>An interesting decay: the filter is defined at XCross, but the largest Cross-stage shift is +2.87 — because forcing W-XCross = 10 nearly forces W-Cross to its max (single-W Cross = 8 in 1,271,514 / 1,271,727 ≈ 99.98% of hard samples). The shift decays monotonically through later stages, leaving only +0.92 at F2L. The hard-XCross tail does not propagate proportionally into the full F2L; this is the upper-bound flip-side of the admissible-lower-bound machinery.</>}
              />
            </p>

            <figure className="algo-figure">
              <img src={`${FIG_BASE}/fig07_wca_vs_hard.png`} alt="WCA vs hard subset, BGORWY across 5 stages" />
              <figcaption>
                <L
                  zh="图 07:WCA vs 困难子集,BGORWY 视角下 5 阶段并排。困难集相对偏移在 Cross 处最大,F2L 趋零。"
                  en="Fig 07: WCA vs hard subset, BGORWY across 5 stages. The hard-subset shift peaks at Cross and decays toward F2L."
                />
              </figcaption>
            </figure>

            <figure className="algo-figure">
              <img src={`${FIG_BASE}/fig08_hard_subset_xcross.png`} alt="Hard subset XCross histogram in BGORWY" />
              <figcaption>
                <L
                  zh="图 08:WCA XCross 众数 7 步占 54.20% (绿) vs 困难子集 XCross 众数 9 步占 82.91% (红);整体右移 2 步,正好等于表 11-3 中 XCross 行的 Δ = +2.292。"
                  en="Fig 08: WCA XCross mode = 7 at 54.20% (green) vs hard-subset XCross mode = 9 at 82.91% (red); the whole distribution shifts right by 2 moves — matching the XCross Δ = +2.292 in the table above."
                />
              </figcaption>
            </figure>
          </section>

          {/* ============================================================ */}
          {/* 18 A worked example                                           */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">18</span>
              <h2 className="algo-section-title"><L zh="一个具体样本" en="A worked example" /></h2>
            </header>

            <p>
              <L
                zh={<>WCA 历史 ID = 22001 的打乱:</>}
                en={<>A single WCA historical scramble, id = 22001:</>}
              />
            </p>
            <pre className="algo-code">{`B2 U' L2 U F2 L2 D2 L2 U F2 L F2 L D U L' D2 F2' U2 B`}</pre>

            <p>
              <L
                zh={<>std 求解器分别对 6 个底面方位求解,得 5 阶段最优步数:</>}
                en={<>std solver outputs across 6 bottom-color orientations, 5 stages each:</>}
              />
            </p>

            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="阶段" en="Stage" /></th>
                  <th className="num">Y</th>
                  <th className="num">W</th>
                  <th className="num">O</th>
                  <th className="num">R</th>
                  <th className="num">G</th>
                  <th className="num">B</th>
                  <th className="num">min</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Cross</td><td className="num">6</td><td className="num">6</td><td className="num">6</td><td className="num">5</td><td className="num">7</td><td className="num">5</td><td className="num">5</td></tr>
                <tr><td>XCross</td><td className="num">7</td><td className="num">7</td><td className="num">8</td><td className="num">7</td><td className="num">9</td><td className="num">7</td><td className="num">7</td></tr>
                <tr><td>XXCross</td><td className="num">9</td><td className="num">10</td><td className="num">10</td><td className="num">9</td><td className="num">10</td><td className="num">9</td><td className="num">9</td></tr>
                <tr><td>XXXCross</td><td className="num">11</td><td className="num">11</td><td className="num">11</td><td className="num">12</td><td className="num">12</td><td className="num">10</td><td className="num">10</td></tr>
                <tr><td>F2L</td><td className="num">14</td><td className="num">14</td><td className="num">14</td><td className="num">13</td><td className="num">14</td><td className="num">14</td><td className="num">13</td></tr>
              </tbody>
            </table>

            <p>
              <L
                zh={<>全 CN 下五阶段为 5 / 7 / 9 / 10 / 13。R 视角下 Cross 仅需 5 步;G 视角下 Cross 要 7 步,差出 2 步 — 真实赛场上 CN 选手会在 Pre-inspection 阶段挑出 R 底。F2L 整体 13 步,Cross 占其中 5 ~ 8 步;F2L − Cross = 8 步,大约等于"3 个 F2L pair 加 1 个 XCross 收尾"的几何代价。</>}
                en={<>Full-CN stage trace: 5 / 7 / 9 / 10 / 13. From bottom-R the Cross is 5 moves; from bottom-G it is 7 — a 2-move spread that a CN solver would catch during inspection. F2L is 13 total, with Cross taking 5 ~ 8 of those moves. The F2L − Cross gap is 8, roughly matching the "3 F2L pairs + 1 XCross finisher" geometry.</>}
              />
            </p>
          </section>

          {/* ============================================================ */}
          {/* 19 Closing                                                    */}
          {/* ============================================================ */}
          <section className="algo-section">
            <header className="algo-section-head">
              <span className="algo-section-num">19</span>
              <h2 className="algo-section-title"><L zh="工程性能 + 结论" en="Engineering + closing" /></h2>
            </header>

            <p>
              <L
                zh={<>四个设计选择决定了 std 求解器既精确又快:</>}
                en={<>Four design choices keep std fast and exact at once:</>}
              />
            </p>
            <ol>
              <li>
                <L
                  zh={<><strong>移动表 O(1) 查询</strong>:把 5 ns 摊销到每个搜索节点。</>}
                  en={<><strong>O(1) move-table lookup</strong>: ~5 ns amortized per node.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>剪枝表 admissible 下界</strong>:既保证最优,又把 IDA* 起步深度顶到几乎接近解。</>}
                  en={<><strong>Admissible prune-table bound</strong>: guarantees optimality and pushes the IDA* start depth near the answer.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>共轭变换</strong>:把 4 槽位的预计算压成 1 份。</>}
                  en={<><strong>Conjugation trick</strong>: 4 slots share a single precomputation.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>阶段间下界传播</strong>:F2L 的搜索深度被 XXXCross 的最优值顶死,只跑 1 ~ 3 轮。</>}
                  en={<><strong>Cross-stage lower-bound propagation</strong>: F2L's iteration count is pinned by XXXCross's optimum — typically 1 ~ 3 rounds.</>}
                />
              </li>
            </ol>

            <p>
              <L
                zh={<>8 线程 OpenMP 下,std_analyzer 在 1000 条 WCA 打乱上跑完 5 阶段 × 6 视角 ≈ 6 秒;120 万样本约 2 小时 (含 Huge 表 mmap 冷启动)。表预生成阶段约 1 小时,落盘约 25 GB (Huge 表占 20 GB,可在内存吃紧时复制到 SSD 通过 mmap 使用)。<strong>Huge 表通过 mmap 按需载入,绝大部分查询命中操作系统页缓存,不构成瓶颈</strong> — 这是搜索热路径仍能维持 ~5 ns/节点的关键。</>}
                en={<>On 8 OpenMP threads, std_analyzer finishes 1000 WCA scrambles × 5 stages × 6 views in ~6 seconds. 1.2M samples take ~2 hours including Huge-table mmap warm-up. Table precomputation itself is ~1 hour, ~25 GB on disk (Huge alone 20 GB; if RAM is tight, keep it on SSD and mmap into the search loop). <strong>Huge tables are accessed via mmap on demand; the vast majority of queries hit the OS page cache and are not a bottleneck</strong> — that's what keeps the hot search loop near ~5 ns / node despite 10 GB tables.</>}
              />
            </p>

            <div className="algo-callout">
              <div className="algo-callout-tag"><L zh="实验结论(11.8)" en="Experimental conclusions (11.8)" /></div>
              <ol>
                <li>
                  <L
                    zh={<><strong>正确性</strong>:240 余万条打乱 × 5 阶段 × 6 视角 ≈ 7,400 万次最优搜索中未出现失败或精度异常,实现的正确性得到验证。</>}
                    en={<><strong>Correctness</strong>: 2.4M+ scrambles × 5 stages × 6 views ≈ 74M optimal searches finished without a single failure or precision anomaly — the implementation is empirically sound.</>}
                  />
                </li>
                <li>
                  <L
                    zh={<><strong>颜色中性边际收益</strong>:Cross 阶段从单色到全色平均节省 <strong>1.00 步</strong>。其中<strong>第 1 个新增轴贡献 0.43 步</strong>,后续 4 个轴累计仅贡献 <strong>0.59 步</strong> — 呈典型的边际递减。dual-axis CN 是性价比最高的训练目标。</>}
                    en={<><strong>Color-neutrality marginals</strong>: Cross saves <strong>1.00 moves</strong> on average going from single to full CN. <strong>The first axis alone contributes 0.43</strong>; the remaining 4 axes combined only add <strong>0.59</strong> — textbook diminishing returns. Dual-axis CN is the best effort/return point.</>}
                  />
                </li>
                <li>
                  <L
                    zh={<><strong>立方对称性</strong>:120 万样本下 3 对色 (W-Y / B-G / O-R) Cross 均值偏差 &lt; 0.001 步,严格成立。这反过来印证 WCA 打乱生成器在 Cross 子状态空间上经验对称。</>}
                    en={<><strong>Cubic symmetry</strong>: on 1.2M samples the 3 dual-axis Cross means (W-Y / B-G / O-R) differ by &lt; 0.001 moves — strictly within sampling noise. Cubic symmetry holds empirically, and the WCA scramble generator is symmetric on this sub-state space.</>}
                  />
                </li>
                <li>
                  <L
                    zh={<><strong>困难子集表现</strong>:127 万 WY 轴困难样本上,求解器与 WCA 基线的均值差异随阶段单调收窄 (Cross +2.87 → F2L +0.92);5 阶段均给出最优解,搜索时间随难度上升而上升,但 admissibility 不受影响。</>}
                    en={<><strong>Hard-subset behaviour</strong>: on 1.27M WY-hard samples, the mean shift vs WCA baseline narrows monotonically across stages (Cross +2.87 → F2L +0.92). All 5 stages still return optima; search time grows with difficulty but admissibility is unaffected.</>}
                  />
                </li>
              </ol>
            </div>

            <p>
              <L
                zh={<>方法工具箱可平移到其它子目标:把目标集换成"全部 12 棱定向"就得到 EOCross 求解器,只需要再生成一份 mt_eo12 + 配套剪枝表;把目标集放松成"D 层允许 90/180/270° 偏移"就得到 pseudo 系列,与标准 CFOP 比平均省 0.5 步。同一份 Lehmer / 移动表 / 剪枝表 / IDA* / 共轭 / 阶段间传播的脚手架在四个变体上零修改复用。</>}
                en={<>The toolbox ports to other sub-goals. Replace the goal with "all 12 edges oriented" → EOCross solver, just needing a fresh mt_eo12 + matching prune table. Loosen the goal to "D-layer allowed a 90/180/270° offset" → pseudo variant, ~0.5 moves shorter on average. The Lehmer / move-table / prune-table / IDA* / conjugation / cross-stage-propagation scaffolding is shared across all four variants without modification.</>}
              />
            </p>

            <p>
              <L
                zh={<>3×3 求解作为算法练手并不新鲜 — Kociemba 二阶段、Rokicki 的 20-step diameter 证明、Korf 的 pattern database + IDA* 都在这条线上。std solver 的差异化在两点:把"多阶段最优"挂在同一份基础设施上,并用百万级真实 WCA 打乱量化每个阶段的分布尾部和颜色中性边际收益 — 这是过去普遍用 ~10 万样本估计的量。</>}
                en={<>Solving the 3×3 algorithmically is well-trodden — Kociemba's two-phase, Rokicki et al.'s 20-step diameter proof, Korf's pattern-database + IDA*. The std solver's distinguishing bits are two: hanging all 5 stages off one shared infrastructure, and pushing it through 1M+ real WCA scrambles to quantify per-stage distribution tails and color-neutrality marginals — quantities historically estimated on ~100k samples.</>}
              />
            </p>

            <h3 className="algo-subsection-title">
              <L zh="未来可拓展方向" en="Future directions" />
            </h3>
            <p>
              <L zh={<>算法层面:</>} en={<>Algorithm-side:</>} />
            </p>
            <ul>
              <li>
                <L
                  zh={<>探索更激进的 <strong>Pattern Database 剪枝</strong>:把现有 (整 Cross + 2 槽) Huge 表扩展到 (整 Cross + 3 槽) 或加入立方体对称等价类紧缩,进一步压低剪枝表体积同时给出更紧下界。</>}
                  en={<>Push <strong>more aggressive Pattern Databases</strong>: extend the current (Cross + 2 slots) Huge tables to (Cross + 3 slots), or compose them with cube-group automorphism equivalence classes to shrink storage while tightening h.</>}
                />
              </li>
              <li>
                <L
                  zh={<>用 <strong>GPU 加速剪枝表的逆向 BFS 构建</strong>:Huge 表 ~20 GB 单机生成约 1 小时,GPU 上的并行 frontier 算法可降一个数量级。</>}
                  en={<>Use <strong>GPU to accelerate the reverse-BFS prune-table build</strong>: Huge tables (~20 GB) take ~1 hour single-machine; GPU frontier-style BFS can shave an order of magnitude.</>}
                />
              </li>
              <li>
                <L
                  zh={<>用 <strong>神经网络估计非可接受 (non-admissible) 但平均更紧的启发式</strong>:经典 PDB 必须保证 h ≤ d* 才能给出最优解,而平均更紧的 h̃ 可以让 IDA* 在大部分样本上更快收敛,<strong>代价是放弃严格最优性</strong>(回到"近似 + 验证"的 metasolver 框架)。在不要求绝对最优的应用场景(例如训练系统的难度评估)中是有利的折衷。</>}
                  en={<>Use <strong>neural networks for a non-admissible but on-average tighter heuristic</strong>: classical PDBs must satisfy h ≤ d* for optimality; an average-tighter learned h̃ would converge IDA* faster on most samples <strong>at the cost of giving up strict optimality</strong> (back to an "approximate + verify" metasolver). A favourable trade in applications that don't need absolute optima — e.g. training-system difficulty scoring.</>}
                />
              </li>
            </ul>
            <p>
              <L zh={<>应用层面:</>} en={<>Application-side:</>} />
            </p>
            <ul>
              <li>
                <L
                  zh={<>把求解器封装为<strong>实时打乱分析工具</strong>,嵌入选手训练系统,为客观评估打乱难度与训练进度提供数据支撑。</>}
                  en={<>Wrap the solver as a <strong>real-time scramble analysis tool</strong>, embed it into trainer software, and use the output for objective scramble-difficulty / training-progress metrics.</>}
                />
              </li>
              <li>
                <L
                  zh={<>在 5 阶段管线之上构造<strong>解的可视化与 trainer</strong>:逐阶段播放最优解、对比选手输入与最优,作为高强度的 Cross / F2L 训练反馈。</>}
                  en={<>Build <strong>solve-visualisation and trainers</strong> on top of the 5-stage backbone: replay optimal solves stage-by-stage, compare a cuber's input to the optimum, deliver high-density Cross / F2L training feedback.</>}
                />
              </li>
            </ul>
          </section>

          <footer className="algo-page-foot">
            <Link href="/">CubeRoot</Link> · <Link href="/code/algorithms">/code/algorithms</Link> · <Link href="/scramble/stats">/scramble/stats</Link>
          </footer>
        </div>
      </div>
    </LangCtx.Provider>
  );
}
