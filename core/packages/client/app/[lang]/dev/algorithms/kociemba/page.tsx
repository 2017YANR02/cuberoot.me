'use client';

import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../../_lib/Lang';
import './algorithm_intro.css';
import { tr } from '@/i18n/tr';

const ACCENT = '#7BD389';

export default function KociembaPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  return (
    <LangCtx.Provider value={lang}>
      <div className="algo-page" style={{ ['--accent' as string]: ACCENT }}>
        <div className="algo-page-bg" />
        <div className="algo-page-inner">
          <div className="algo-page-topbar">
            <Link href="/dev/algorithms" className="algo-page-back">← /dev/algorithms</Link>
          </div>

          <header className="algo-page-head">
            <div className="algo-page-tag">{tr({ zh: '经典分治', en: 'Classic D&C'
            })}</div>
            <h1 className="algo-page-title">Kociemba 二阶段</h1>
            <p className="algo-page-sub">
              {tr({ zh: '1992 年 Herbert Kociemba 提出的二阶段算法:先把任意状态降到 G1 = ⟨U, D, L², R², F², B²⟩ 子群,再在 G1 内完成归位。两阶段各自跑 IDA*,使用各自坐标的剪枝表。解的长度与耗时取决于实现、搜索预算和运行环境,并非固定平均 22 步:LK Forge 的 JavaScript min2phase 测试在 25–40 次随机转动后得到平均约 20.5 步 (HTM),平均求解耗时低于 1 毫秒,不含初始化。', en: 'The 1992 two-phase algorithm by Herbert Kociemba: drop any state into the subgroup G1 = ⟨U, D, L², R², F², B²⟩ first, then solve inside G1. Each phase runs IDA* with pruning tables over its own coordinates. Solution length and runtime depend on the implementation, search budget and environment, rather than a fixed average of 22 moves: LK Forge reports about 20.5 moves (HTM) after 25–40 random turns with its JavaScript min2phase build, averaging under 1 ms per solve excluding initialization.'
            })}
            </p>
          </header>

          {/* ────────────────────────── 1 历史背景 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">01</span>
              <h2 className="algo-section-title"><L zh="历史背景" en="Historical context" /></h2>
            </div>
            <p>
              <L
                zh={<>1981 年 Morwen Thistlethwaite 提出了著名的<strong>四阶段算法</strong>:把求解过程分成 <code>G0 ⊃ G1 ⊃ G2 ⊃ G3 ⊃ G4 = {'{e}'}</code> 四层子群,每一层只用前一层允许的转动里更受限的一部分,逐层归约。这个方法第一次把"求解魔方"和"群论"严肃地连起来,但平均步数大约在 <code>52</code> 步左右 — 在数学上漂亮,实际上太长。</>}
                en={<>In 1981 Morwen Thistlethwaite published his famous <strong>four-phase algorithm</strong>: solve the cube through a chain of subgroups <code>G0 ⊃ G1 ⊃ G2 ⊃ G3 ⊃ G4 = {'{e}'}</code>, each phase restricting the move set further than the last. It was the first algorithm to seriously tie cube-solving to group theory, but it averaged about <code>52</code> moves — mathematically elegant, practically long.</>}
              />
            </p>
            <p>
              <L
                zh={<>1992 年,德国的中学数学老师 <strong>Herbert Kociemba</strong> 把四阶段砍成两阶段,后来在他自己写的 GUI 工具 <em>Cube Explorer</em> 里发布。他的关键洞察是:<strong>Thistlethwaite 的 G1 已经足够特殊</strong> — 一旦进入 G1,剩下的归位完全可以在一个相对小的状态空间里直接搜,不需要继续细分。减少中间子群能显著缩短解,实际平均步数还取决于实现与搜索预算。</>}
                en={<>In 1992, German maths schoolteacher <strong>Herbert Kociemba</strong> collapsed the four phases into two and published the result in his own GUI tool, <em>Cube Explorer</em>. His key insight: <strong>Thistlethwaite's G1 is already special enough</strong> — once you reach G1, the remaining puzzle lives in a small enough state space to be searched directly, with no need to subdivide further. Reducing the intermediate subgroups substantially shortens solutions; the actual mean still depends on the implementation and search budget.</>}
              />
            </p>
            <div className="algo-callout">
              <div className="algo-callout-tag"><L zh="人物" en="Bio" /></div>
              <p>
                <L
                  zh={<>Herbert Kociemba(生于 1953 年,德国)长期在 Gymnasium(德国文理中学)教数学,业余写魔方求解器。Cube Explorer 从 1990 年代末持续维护到今天,kociemba.org 是关于二阶段算法最权威的一手资料;他从来没有把这套东西商业化,所有代码 + 文档常年公开。</>}
                  en={<>Herbert Kociemba (b. 1953, Germany) spent his career teaching maths at a Gymnasium (German academic high school), writing cube solvers on the side. Cube Explorer has been maintained since the late 1990s; kociemba.org remains the canonical first-party reference on the two-phase algorithm. He never commercialised any of it — the code and documentation have been open for decades.</>}
                />
              </p>
            </div>
          </section>

          {/* ────────────────────────── 2 核心想法 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">02</span>
              <h2 className="algo-section-title"><L zh="核心想法" en="The core idea" /></h2>
            </div>
            <p>
              <L
                zh={<>三阶魔方有大约 <code>4.3 × 10¹⁹</code> 个状态,直接对这么大的图做 IDA* 是不现实的(剪枝表存不下,启发式不够紧)。Kociemba 的策略是<strong>分而治之</strong>:先用<em>一部分约束</em>把状态降到一个更小的中转子群 G1,再在 G1 内部用<em>剩下的约束</em>归位。两个子问题各自的搜索空间都足够小,可以靠预计算的剪枝表跑得极快。</>}
                en={<>The 3×3 has about <code>4.3 × 10¹⁹</code> states; running plain IDA* on a graph that size is hopeless (prune tables don't fit, heuristics aren't tight enough). Kociemba's strategy is classical <strong>divide and conquer</strong>: use <em>one set of constraints</em> to drop the state into a smaller intermediate subgroup G1, then use <em>the remaining constraints</em> to finish inside G1. Both sub-problems have small enough state spaces to drive with precomputed prune tables.</>}
              />
            </p>
            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="算法" en="Algorithm" /></th>
                  <th><L zh="年" en="Year" /></th>
                  <th className="num"><L zh="阶段数" en="Phases" /></th>
                  <th className="num"><L zh="平均步数 (HTM)" en="Avg moves (HTM)" /></th>
                  <th className="num"><L zh="最坏" en="Worst" /></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Thistlethwaite</td>
                  <td>1981</td>
                  <td className="num">4</td>
                  <td className="num">~52</td>
                  <td className="num">≤ 52</td>
                </tr>
                <tr>
                  <td>Kociemba</td>
                  <td>1992</td>
                  <td className="num">2</td>
                  <td className="num"><L zh="取决于配置" en="Configuration-dependent" /></td>
                  <td className="num"><L zh="取决于搜索限制" en="Search-dependent" /></td>
                </tr>
                <tr>
                  <td>Rokicki (optimal)</td>
                  <td>2010</td>
                  <td className="num">—</td>
                  <td className="num">~18</td>
                  <td className="num">20 (God's #)</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ────────────────────────── 3 G1 子群 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">03</span>
              <h2 className="algo-section-title"><L zh="G1 子群定义" en="The subgroup G1" /></h2>
            </div>
            <p>
              <L
                zh={<>G1 是只用 <code>U, D, L², R², F², B²</code> 这 10 种转动能到达的所有状态(把转动当生成元、生成出来的子群)。一个状态 <em>S</em> 属于 G1 当且仅当三件事同时成立:</>}
                en={<>G1 is the set of all states reachable using only the 10 moves <code>U, D, L², R², F², B²</code> (i.e. the subgroup generated by those moves). A state <em>S</em> lies in G1 iff three conditions hold simultaneously:</>}
              />
            </p>
            <ul>
              <li><L zh={<>所有 <strong>角块朝向归零</strong>(每个角块都"正面朝上"或"正面朝下")。</>} en={<>All <strong>corner orientations are zero</strong> (every corner is "upright").</>} /></li>
              <li><L zh={<>所有 <strong>棱块朝向归零</strong>(从原色面经偶数次 F/B 翻转后能回到原朝向)。</>} en={<>All <strong>edge orientations are zero</strong> (each edge can be returned to its home orientation via an even number of F/B turns).</>} /></li>
              <li><L zh={<>四个 <strong>中层(UD slice)棱块</strong>都待在中层 — 也就是 FR, FL, BR, BL 那四条边在 E 层里(顺序可以任意)。</>} en={<>The four <strong>UD-slice edges</strong> (FR, FL, BR, BL) sit in the middle (E) layer, in any order.</>} /></li>
            </ul>
            <p>
              <L
                zh={<>G1 自己的大小是 <code>8! · 8! · 4! / 2 ≈ 1.95 × 10¹⁰</code>(角块 8 个全排列,U/D 层棱块 8 个全排列,中层棱 4! 排列,再除以一个奇偶性约束),相比整组 <code>4.3 × 10¹⁹</code> 已经小了一个量级以上。这就是 Kociemba 选 G1 当中转点的原因:它一边足够大(常见状态都能"快速"到达),一边足够小(在里面跑 IDA* 还撑得住)。</>}
                en={<>G1 itself has about <code>8! · 8! · 4! / 2 ≈ 1.95 × 10¹⁰</code> states (corner permutations × U/D-layer edge perms × slice perm, divided by a parity constraint) — already an order of magnitude smaller than the full <code>4.3 × 10¹⁹</code>. That balance is why Kociemba picked G1 as the rendezvous point: large enough that most cubes get there cheaply, small enough that IDA* inside it still fits in cache.</>}
              />
            </p>
          </section>

          {/* ────────────────────────── 4 三种坐标 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">04</span>
              <h2 className="algo-section-title"><L zh="三种坐标" en="The three coordinates" /></h2>
            </div>
            <p>
              <L
                zh={<>不能把每个状态当一个 int 来索引(数太大),但可以把上面三个 G1 条件分别量化成小整数 — 这就是 Kociemba 的<strong>坐标 (coordinate)</strong>。一个坐标只描述状态的一个"切片",取值范围都不大:</>}
                en={<>You can't index every state with a single integer (too many), but you can quantify each of the three G1 conditions as a small integer — these are Kociemba's <strong>coordinates</strong>. Each coord captures one "slice" of the state and lives in a small range:</>}
              />
            </p>
            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="坐标" en="Coord" /></th>
                  <th><L zh="含义" en="Meaning" /></th>
                  <th className="num"><L zh="取值数" en="Range" /></th>
                  <th><L zh="公式" en="Size" /></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>twist</code> (CO)</td>
                  <td><L zh="角块朝向" en="Corner orientation" /></td>
                  <td className="num">2187</td>
                  <td><code>3⁷</code></td>
                </tr>
                <tr>
                  <td><code>flip</code> (EO)</td>
                  <td><L zh="棱块朝向" en="Edge orientation" /></td>
                  <td className="num">2048</td>
                  <td><code>2¹¹</code></td>
                </tr>
                <tr>
                  <td><code>slice</code> (UD)</td>
                  <td><L zh="UD 中层棱位置" en="UD-slice edge positions" /></td>
                  <td className="num">495</td>
                  <td><code>C(12, 4)</code></td>
                </tr>
                <tr>
                  <td><code>cperm</code></td>
                  <td><L zh="角块排列 (phase 2)" en="Corner permutation (phase 2)" /></td>
                  <td className="num">40320</td>
                  <td><code>8!</code></td>
                </tr>
                <tr>
                  <td><code>eperm</code></td>
                  <td><L zh="UD 层棱排列 (phase 2)" en="U/D edge permutation (phase 2)" /></td>
                  <td className="num">40320</td>
                  <td><code>8!</code></td>
                </tr>
                <tr>
                  <td><code>sperm</code></td>
                  <td><L zh="中层棱排列 (phase 2)" en="Slice edge permutation (phase 2)" /></td>
                  <td className="num">24</td>
                  <td><code>4!</code></td>
                </tr>
              </tbody>
            </table>
            <p>
              <L
                zh={<><strong>关键事实</strong>:状态 <em>S</em> 属于 G1 <em>等价于</em> <code>twist(S) = 0</code> 且 <code>flip(S) = 0</code> 且 <code>slice(S) = 0</code>。所以 Phase 1 的目标可以直接写成"把这三个坐标同时清零"。Phase 2 假设已经在 G1 里、CO/EO/slice 都为 0,只剩下排列要归位。</>}
                en={<><strong>Key fact</strong>: a state <em>S</em> lies in G1 <em>iff</em> <code>twist(S) = 0</code>, <code>flip(S) = 0</code>, and <code>slice(S) = 0</code>. So Phase 1's goal is literally "zero these three coords simultaneously." Phase 2 assumes we're already in G1 with CO/EO/slice = 0, and only the permutations remain.</>}
              />
            </p>
            <p>
              <L
                zh={<>每个坐标都有显式的编码 / 解码函数。比如角块朝向 <code>twist</code>:7 个角的朝向(每个 ∈ {'{0, 1, 2}'})做 3 进制混合 — 第 8 个角的朝向由前 7 个决定(总朝向必须 mod 3 = 0),所以只编码 7 个就够。本仓库 <code>pages/timer/scramble/kociemba/coords.ts</code> 里就是这么写的。</>}
                en={<>Each coord has explicit encoder/decoder functions. Take corner-orientation <code>twist</code>: 7 corner twists (each ∈ {'{0, 1, 2}'}) packed as a base-3 number — the 8th corner's twist is determined by the others (total twist must be ≡ 0 mod 3), so 7 digits suffice. That's how it's written in this repo's <code>pages/timer/scramble/kociemba/coords.ts</code>.</>}
              />
            </p>
            <pre className="algo-code"><code>{`// twist  ∈ [0, 3^7)       = 2187    corner orientation
// flip   ∈ [0, 2^11)      = 2048    edge orientation
// slice  ∈ [0, C(12,4))   = 495     UD-slice edges presence (unsorted)
// cperm  ∈ [0, 8!)        = 40320   corner permutation
// eperm  ∈ [0, 8!)        = 40320   permutation of UD-face edges
// sperm  ∈ [0, 4!)        = 24      permutation of slice edges`}</code></pre>
          </section>

          {/* ────────────────────────── 5 Phase 1 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">05</span>
              <h2 className="algo-section-title"><L zh="Phase 1 — 降到 G1" en="Phase 1 — drop into G1" /></h2>
            </div>
            <p>
              <L
                zh={<>Phase 1 用全部 18 个 face turn(<code>U U' U2</code>, <code>R R' R2</code>, ..., <code>B B' B2</code>),目标是同时让 <code>twist, flip, slice</code> 三个坐标都变 0。状态空间是三者笛卡尔积:<code>2187 × 2048 × 495 ≈ 2.2 × 10⁹</code>。直接存这么大一张表不行,但搜索时只用做<em>查询</em>,可以把表拆成两两组合(见 §8)。</>}
                en={<>Phase 1 uses all 18 face turns (<code>U U' U2</code>, <code>R R' R2</code>, ..., <code>B B' B2</code>); the goal is to drive <code>twist</code>, <code>flip</code>, <code>slice</code> all to zero simultaneously. The state space is the Cartesian product: <code>2187 × 2048 × 495 ≈ 2.2 × 10⁹</code>. We can't store that whole table, but for searching we only need <em>lookups</em>, so we factor it into pairwise sub-tables (see §8).</>}
              />
            </p>
            <p>
              <L
                zh={<>Phase 1 最优解的分布很集中:平均约 <code>10</code> 步,最大 <code>12</code> 步 — 这是 Kociemba 后来证明的。换句话说,<strong>从任何状态出发,最多 12 步就能进 G1</strong>。这是第一阶段的距离上界,不能据此推出完整解的平均长度。</>}
                en={<>Phase-1 optimum distance distributes very tightly: about <code>10</code> moves on average, with a proven maximum of <code>12</code>. In other words, <strong>any cube can reach G1 in at most 12 moves</strong>. This bounds the phase-1 distance; it does not determine the mean length of a complete solution.</>}
              />
            </p>
          </section>

          {/* ────────────────────────── 6 Phase 2 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">06</span>
              <h2 className="algo-section-title"><L zh="Phase 2 — 在 G1 内归位" en="Phase 2 — solve inside G1" /></h2>
            </div>
            <p>
              <L
                zh={<>进入 G1 之后,只能用 10 种 G1 转动:<code>U U' U2 D D' D2 L2 R2 F2 B2</code>。状态由三个排列描述:<code>cperm</code>(角块 8!)、<code>eperm</code>(U/D 棱 8!)、<code>sperm</code>(中层棱 4!)。注意:这里没有方块的朝向坐标 — 在 G1 里朝向自动保持为 0,因为半圈和 U/D 转都不会破坏 CO/EO。</>}
                en={<>Once inside G1, only 10 moves are legal: <code>U U' U2 D D' D2 L2 R2 F2 B2</code>. State is described by three permutations: <code>cperm</code> (corners, 8!), <code>eperm</code> (U/D edges, 8!), <code>sperm</code> (slice edges, 4!). No orientation coords here — inside G1, half-turns and U/D quarter-turns preserve CO/EO automatically.</>}
              />
            </p>
            <p>
              <L
                zh={<>Phase 2 的状态空间 <code>40320 × 40320 × 24 / 2 ≈ 1.95 × 10¹⁰</code>(除以 2 来自一个全局奇偶性约束),最大归位距离 <strong>18</strong> 步。所以从任意状态出发,(phase1 ≤ 12) + (phase2 ≤ 18) ≤ 30 总是有解;但绝大多数 cube 的最优 phase1 + phase2 加起来都在 22 附近。</>}
                en={<>Phase 2's state space is <code>40320 × 40320 × 24 / 2 ≈ 1.95 × 10¹⁰</code> (the /2 comes from a global parity constraint), with a max distance of <strong>18</strong> moves. So from any state, (phase1 ≤ 12) + (phase2 ≤ 18) ≤ 30 is always achievable; in practice the optimal phase1 + phase2 sum sits around 22.</>}
              />
            </p>
            <div className="algo-callout">
              <div className="algo-callout-tag"><L zh="证明梗概" en="Proof sketch" /></div>
              <p>
                <L
                  zh={<>"phase 1 最坏 12 步、phase 2 最坏 18 步" 都是 Kociemba 在 1990 年代用穷举式 BFS 验证的 — 状态空间够小,可以在大几小时到几天内把每个 phase 的整张距离表跑出来。这两个数字是常数,不是估计。</>}
                  en={<>The "phase 1 ≤ 12, phase 2 ≤ 18" bounds were both verified by Kociemba via exhaustive BFS in the 1990s — both phase state spaces are small enough that the full distance table can be built in a matter of hours to days. They're constants, not estimates.</>}
                />
              </p>
            </div>
          </section>

          {/* ────────────────────────── 7 移动表 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">07</span>
              <h2 className="algo-section-title"><L zh="移动表 (Move tables)" en="Move tables" /></h2>
            </div>
            <p>
              <L
                zh={<>搜索时不能每一步都把整个 cube 状态过一遍,只需要更新坐标。<strong>移动表</strong>就是预计算的"输入坐标 + 转动 → 新坐标"的 2D 数组:</>}
                en={<>During search we shouldn't reapply moves to the whole cube state — we only need to update coords. The <strong>move tables</strong> are precomputed 2-D arrays of "input coord + move → new coord":</>}
              />
            </p>
            <pre className="algo-code"><code>{`twistMove [2187][18]   // CO     after  any of 18 face turns
flipMove  [2048][18]   // EO     after  any of 18 face turns
sliceMove  [495][18]   // UD     after  any of 18 face turns

cpermMove [40320][10]  // corner perm   after  10 G1 moves
epermMove [40320][10]  // U/D edge perm after  10 G1 moves
spermMove    [24][10]  // slice perm    after  10 G1 moves`}</code></pre>
            <p>
              <L
                zh={<>构造方法:对每个坐标值,把它解码成对应的"局部状态"(比如 <code>twist=42</code> 解码成一组角块朝向数组),应用一次转动,再编码回坐标。所有移动表加起来不到 <code>10 MB</code>,可以一次性放进内存。</>}
                en={<>Construction is simple: for each coord value, decode to its partial state (e.g. <code>twist=42</code> → a corner-twist array), apply the move, re-encode. All move tables together are under <code>10 MB</code> and fit comfortably in memory.</>}
              />
            </p>
          </section>

          {/* ────────────────────────── 8 剪枝表 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">08</span>
              <h2 className="algo-section-title"><L zh="剪枝表 (Pruning tables)" en="Pruning tables" /></h2>
            </div>
            <p>
              <L
                zh={<>IDA* 要一个 <strong>admissible heuristic</strong> <code>h(s) ≤ d*(s)</code> — 估计从状态 <em>s</em> 到目标的真实最少步数下界。Kociemba 用<strong>坐标对</strong>的 BFS 距离表:把两个坐标配对组成一张二维表,每个 (a, b) 存"<em>同时让 a → 0 和 b → 0</em> 的最少步数"。</>}
                en={<>IDA* needs an <strong>admissible heuristic</strong> <code>h(s) ≤ d*(s)</code> — a lower bound on the true minimum distance from <em>s</em> to the goal. Kociemba uses BFS distance tables over <strong>coordinate pairs</strong>: a 2-D table whose entry at (a, b) is "the min moves required to zero both a and b simultaneously."</>}
              />
            </p>
            <table className="algo-table">
              <thead>
                <tr>
                  <th><L zh="阶段" en="Phase" /></th>
                  <th><L zh="剪枝表" en="Prune table" /></th>
                  <th className="num"><L zh="条目数" en="Entries" /></th>
                  <th><L zh="存储 (4-bit / 条目)" en="Storage (4-bit / entry)" /></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td><code>twist × slice</code></td>
                  <td className="num">2187 × 495 ≈ 1.08 M</td>
                  <td className="num">~540 KB</td>
                </tr>
                <tr>
                  <td>1</td>
                  <td><code>flip × slice</code></td>
                  <td className="num">2048 × 495 ≈ 1.01 M</td>
                  <td className="num">~510 KB</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td><code>cperm × sperm</code></td>
                  <td className="num">40320 × 24 = 967 680</td>
                  <td className="num">~485 KB</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td><code>eperm × sperm</code></td>
                  <td className="num">40320 × 24 = 967 680</td>
                  <td className="num">~485 KB</td>
                </tr>
              </tbody>
            </table>
            <p>
              <L
                zh={<>搜索时:<code>h_phase1(s) = max(prune[twist, slice], prune[flip, slice])</code>;两张表都是<strong>真实距离的下界</strong>(因为它们只用了局部信息),取 max 仍然是下界。把 4-bit 打包每条目 — 实际最坏距离不到 13,4 位刚好够装。</>}
                en={<>During search: <code>h_phase1(s) = max(prune[twist, slice], prune[flip, slice])</code>; both tables are <strong>true lower bounds</strong> (since each only uses partial information), and taking the max is still admissible. Entries fit in 4 bits each (max distance &lt; 13), so storage is halved by packing.</>}
              />
            </p>
          </section>

          {/* ────────────────────────── 9 IDA* 搜索循环 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">09</span>
              <h2 className="algo-section-title"><L zh="IDA* 搜索循环" en="The IDA* loop" /></h2>
            </div>
            <p>
              <L
                zh={<>IDA*(iterative-deepening A*)用一个不断增长的<strong>深度阈值</strong> <em>bound</em> 做 DFS:某一次 DFS 里只要 <code>g + h ≤ bound</code> 就继续扩展,否则记下"超过部分"的最小值作为下一轮 bound。空间复杂度只跟当前路径长度成正比 — 比纯 A* 省内存。Phase 1 的伪代码:</>}
                en={<>IDA* (iterative-deepening A*) does a sequence of bounded DFS searches: in each pass it expands as long as <code>g + h ≤ bound</code>, otherwise records the minimum over-bound value as the next iteration's threshold. Space is proportional to current depth only — no priority queue, unlike plain A*. Phase-1 pseudocode:</>}
              />
            </p>
            <pre className="algo-code"><code>{`function phase1Solve(s0):
  bound = h(s0)                         // initial threshold
  loop:
    (found, next) = dfs(s0, g=0, bound, path=[])
    if found:    return path
    if next = ∞: return UNSOLVABLE      // (impossible for a valid cube)
    bound = next

function dfs(s, g, bound, path):
  f = g + h(s)                          // h = max(prune_ts, prune_fs)
  if f > bound:        return (false, f)
  if h(s) = 0:         return (true,  g)        // reached G1
  minOver = ∞
  for m in 18 moves:
    if disallowedAfter(path.last, m):  continue  // canonical-form filter
    s' = applyMove(s, m)
    (found, t) = dfs(s', g+1, bound, path + [m])
    if found:          return (true,  t)
    if t < minOver:    minOver = t
  return (false, minOver)`}</code></pre>
            <p>
              <L
                zh={<>关键优化:<code>disallowedAfter</code> 过滤掉<strong>同面连转</strong>(<code>R R'</code>)和<strong>同轴交换序冗余</strong>(枚举 <code>R L</code> 但禁止再来一个 <code>L</code>)。这一步把分支因子从 18 砍到约 13,几乎是无成本的剪枝。</>}
                en={<>Key optimisation: <code>disallowedAfter</code> rejects <strong>same-face follow-ups</strong> (<code>R R'</code>) and <strong>same-axis canonical-form duplicates</strong> (allow <code>R L</code> but ban a trailing same-axis repeat). This cuts the branching factor from 18 down to about 13, almost free.</>}
              />
            </p>
          </section>

          {/* ────────────────────────── 10 phase1 多解 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">10</span>
              <h2 className="algo-section-title"><L zh="Phase 1 多解优化" en="Iterating over phase-1 solutions" /></h2>
            </div>
            <p>
              <L
                zh={<>朴素版本是:找一条<strong>最优</strong> phase 1 → 进 G1 → 找一条<strong>最优</strong> phase 2 → 拼起来。但是 phase 1 最短 ≠ phase1 + phase2 最短。一条 11 步 phase 1 拼上一条 14 步 phase 2(= 25 步)可能比一条 10 步最优 phase 1 拼 17 步 phase 2(= 27 步)还好。</>}
                en={<>The naive version is: find the <strong>optimal</strong> phase 1 → enter G1 → find the <strong>optimal</strong> phase 2 → concatenate. But shortest phase 1 ≠ shortest phase1 + phase2. An 11-move phase 1 followed by a 14-move phase 2 (= 25) can easily beat a 10-move optimal phase 1 followed by a 17-move phase 2 (= 27).</>}
              />
            </p>
            <p>
              <L
                zh={<>所以 Kociemba 的真正做法是<strong>枚举多条 phase 1 解</strong>(从短到长),每条都试着接 phase 2,持续更新 <em>best total</em>;一旦 phase 1 的剩余下界已经 ≥ best total,就可以放心退出(剪掉剩下的整片子树)。这个交错搜索几乎不增加额外代价 — phase 2 的状态空间小、剪枝紧、平均几十微秒。</>}
                en={<>So Kociemba's real procedure is to <strong>enumerate phase-1 solutions</strong> in increasing length, run phase 2 on each, and keep the running <em>best total</em>. As soon as the phase-1 lower bound itself ≥ best total, we can safely cut the rest of the search. The interleaving is nearly free — phase 2 has a tiny state space and tight prune, costing tens of microseconds.</>}
              />
            </p>
            <p>
              <L
                zh={<>这个"phase 1 多解" hook 后来被 <strong>Shuang Chen 的 min2phase</strong>(本站另写一篇)做到极致 — 在 phase 1 还没完时就 peek phase 2 的距离表、用 phase 2 的下界反过来剪枝 phase 1。</>}
                en={<>This "iterate phase-1 solutions" hook was later pushed to its limit by <strong>Shuang Chen's min2phase</strong> (a separate page on this site) — peeking phase-2 prune tables before phase 1 has even finished, and using the phase-2 lower bound to prune phase 1 in reverse.</>}
              />
            </p>
          </section>

          {/* ────────────────────────── 11 实际数字 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">11</span>
              <h2 className="algo-section-title"><L zh="min2phase 实测示例" en="A min2phase benchmark" /></h2>
            </div>
            <p>
              <L
                zh={<>LK Forge 于 2026-09-13 发布了一组 JavaScript min2phase 测试:从还原状态应用带种子的随机转动,每种打乱长度测试 200 个状态,共 1,200 个。下表转录其公开数据;HTM 中一次 90° 或 180° 面转都计为一步。</>}
                en={<>LK Forge published a JavaScript min2phase benchmark on 2026-09-13: seeded random turns applied to the solved cube, with 200 states at each scramble length and 1,200 in total. The table reproduces its published aggregates. In HTM, a 90° or 180° face turn counts as one move.</>}
              />
            </p>
            <table className="algo-table">
              <thead>
                <tr>
                  <th className="num"><L zh="随机转动次数" en="Random turns" /></th>
                  <th className="num"><L zh="平均解长 (HTM)" en="Mean length (HTM)" /></th>
                  <th className="num"><L zh="样本最大解长" en="Sample max length" /></th>
                  <th className="num"><L zh="平均求解耗时 (ms)" en="Mean solve time (ms)" /></th>
                </tr>
              </thead>
              <tbody>
                {[
                  [10, 12.4, 21, 0.10],
                  [15, 19.2, 21, 0.29],
                  [20, 20.4, 21, 0.50],
                  [25, 20.5, 21, 0.56],
                  [30, 20.5, 21, 0.47],
                  [40, 20.5, 21, 0.46],
                ].map(([depth, mean, max, time]) => (
                  <tr key={depth}>
                    <td className="num">{depth}</td>
                    <td className="num">{mean.toFixed(1)}</td>
                    <td className="num">{max}</td>
                    <td className="num">{time.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              <L
                zh={<>来源:<a href="https://huggingface.co/datasets/LKForge/rubik-cube-solver-benchmark" target="_blank" rel="noopener noreferrer">LK Forge 测试方法与数据集</a>、<a href="https://huggingface.co/datasets/LKForge/rubik-cube-solver-benchmark/blob/main/data/rubik-benchmark.json" target="_blank" rel="noopener noreferrer">汇总 JSON</a>。该构建将解长限制为 21 步,一次性初始化另耗时 78 ms。这里的亚毫秒数字是各组平均值,不代表每次求解都低于 1 ms,也不是本站求解器的测速结果。</>}
                en={<>Sources: <a href="https://huggingface.co/datasets/LKForge/rubik-cube-solver-benchmark" target="_blank" rel="noopener noreferrer">LK Forge methodology and dataset</a> and <a href="https://huggingface.co/datasets/LKForge/rubik-cube-solver-benchmark/blob/main/data/rubik-benchmark.json" target="_blank" rel="noopener noreferrer">aggregate JSON</a>. This build caps solutions at 21 moves; one-time initialization took a separate 78 ms. The sub-millisecond figures are group means, not a guarantee for every solve or a measurement of this site's solver.</>}
              />
            </p>
            <p>
              <L
                zh={<>这组样本在约 20 次随机转动后出现平台,25–40 次时平均约 20.5 步。这是特定采样方法和求解器配置下的观察,不能证明 20 次随机转动已产生均匀随机状态。公开文件只有汇总值,没有逐次记录、测试脚本或完整运行环境,因此这里作为作者报告的测试结果引用。</>}
                en={<>These samples plateau after roughly 20 random turns, averaging about 20.5 moves at 25–40 turns. This is an observation for a particular sampler and solver configuration, not proof that 20 random turns produce uniformly random states. The public files contain aggregates, without per-solve records, the benchmark script or a complete runtime environment, so these figures are cited as the author's reported results.</>}
              />
            </p>
          </section>

          {/* ────────────────────────── 12 离上帝之数 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">12</span>
              <h2 className="algo-section-title"><L zh="与上帝之数的距离" en="Distance to God's number" /></h2>
            </div>
            <p>
              <L
                zh={<>2010 年 Tomas Rokicki、Herbert Kociemba、Morley Davidson、John Dethridge 证明三阶魔方的上帝之数为 <strong>20 (HTM)</strong>:每个合法状态都存在不超过 20 步的解,并且有些状态恰好需要 20 步。这是所有状态的<strong>最优解长度的最大值</strong>,不是平均值,也不是任意求解器输出的上限。参见 <a href="https://www.cube20.org/" target="_blank" rel="noopener noreferrer">原始证明项目</a>。</>}
                en={<>In 2010 Tomas Rokicki, Herbert Kociemba, Morley Davidson and John Dethridge proved that God's number for the 3×3 is <strong>20 (HTM)</strong>: every legal state has a solution of at most 20 moves, and some require exactly 20. This is the <strong>maximum optimal solution length</strong> over all states, not an average or a bound on every solver's output. See the <a href="https://www.cube20.org/" target="_blank" rel="noopener noreferrer">original proof project</a>.</>}
              />
            </p>
            <p>
              <L
                zh={<>二阶段求解器可以找到最优解,但通常<strong>不保证最优</strong>;输出 21 步或平均 20.5 步都不与上帝之数矛盾。随机转动次数增加后解长趋于稳定,也不是上帝之数为 20 的证明或直接推论。比较求解器时,应在相同状态样本、搜索预算和运行环境下分别测量解长与耗时。参见 <a href="https://kociemba.org/math/imptwophase.htm" target="_blank" rel="noopener noreferrer">Kociemba 的算法说明</a>。</>}
                en={<>A two-phase solver can find optimal solutions but generally <strong>does not guarantee optimality</strong>; a 21-move result or a mean of 20.5 does not contradict God's number. A plateau as random-turn counts increase is neither a proof nor a direct consequence of God's number being 20. Solver comparisons should measure length and runtime on the same states with matched search budgets and environments. See <a href="https://kociemba.org/math/imptwophase.htm" target="_blank" rel="noopener noreferrer">Kociemba's algorithm notes</a>.</>}
              />
            </p>
          </section>

          {/* ────────────────────────── 13 延伸 ────────────────────────── */}
          <section className="algo-section">
            <div className="algo-section-head">
              <span className="algo-section-num">13</span>
              <h2 className="algo-section-title"><L zh="后续与延伸" en="Descendants and extensions" /></h2>
            </div>
            <ul>
              <li>
                <L
                  zh={<><strong>Cube Explorer</strong> — Kociemba 自己写的 Windows GUI,1990s 末持续维护到今天。第一手参考实现,kociemba.org 上免费下载。</>}
                  en={<><strong>Cube Explorer</strong> — Kociemba's own Windows GUI, maintained since the late 1990s. The canonical first-party implementation, free on kociemba.org.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>min2phase</strong> — Shuang Chen (cs0x7f) 的 Java 实现。通过对称压缩、剪枝表和搜索优化加速求解;步数与耗时取决于版本、配置和运行环境,上面的测试针对其 JavaScript 移植版。csTimer、TNoodle 用的就是它。详见 <Link href="/dev/algorithms/min2phase">/dev/algorithms/min2phase</Link>。</>}
                  en={<><strong>min2phase</strong> — Shuang Chen (cs0x7f)'s Java implementation. Symmetry reduction, pruning tables and search optimizations accelerate solving; lengths and timings depend on the version, configuration and environment. The benchmark above uses its JavaScript port. csTimer and TNoodle ship it. See <Link href="/dev/algorithms/min2phase">/dev/algorithms/min2phase</Link>.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>cube20.org / Rokicki</strong> — 最优解 + 上帝之数证明的主页。"two-phase + cosets" 的工程化巅峰。</>}
                  en={<><strong>cube20.org / Rokicki</strong> — home of the optimal solver and the God's-number proof. Engineering peak of "two-phase + cosets."</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>kociemba (Python / Go / Rust)</strong> — 社区把二阶段算法移植到各种语言,在 npm/PyPI/crates.io 上都能找到。多数是 Kociemba 1992 原版的直译,没有 min2phase 的对称压缩。</>}
                  en={<><strong>kociemba (Python / Go / Rust)</strong> — community ports of the two-phase algorithm to every language; findable on npm/PyPI/crates.io. Most are direct ports of Kociemba 1992, without min2phase's symmetry compression.</>}
                />
              </li>
              <li>
                <L
                  zh={<><strong>5×5 / 6×6 / 7×7 类似的子群链</strong> — Kociemba 的"两阶段"思路推广到更大魔方:先把"reduced cube"状态(中心 + 棱条配对)解掉,降为等价的 3×3 问题,再用 Kociemba。这是大魔方 solver 的通用骨架。</>}
                  en={<><strong>5×5 / 6×6 / 7×7 analogues</strong> — Kociemba's two-phase idea generalises: first reduce the big-cube (centres + edge-pairing) into an effective 3×3, then run Kociemba. This is the standard skeleton for big-cube solvers.</>}
                />
              </li>
            </ul>
          </section>

          <footer className="algo-page-foot">
            <Link href="/">CubeRoot</Link> · <Link href="/dev/algorithms">/dev/algorithms</Link> · <Link href="/dev/algorithms/min2phase">min2phase →</Link>
          </footer>
        </div>
      </div>
    </LangCtx.Provider>
  );
}
