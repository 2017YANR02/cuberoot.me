/**
 * /scramble/god — 上帝之数 (God's Number) 全 WCA 项目总览。
 *
 * 结构:
 *   1. 头部 + 群论简介
 *   2. 上帝之数定义 + 度量对照 (interactive MetricExplainer)
 *   3. 17 项目卡片网格(VisualCube 缩略图 + 直径 + 状态空间)
 *   4. NxN 增长可视化 (interactive GrowthChart)
 *   5. 2x2 现场 BFS 演示 (interactive Bfs2x2Demo)
 *   6. 历史时间线
 *   7. 算法 / 参考资料
 */
import { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { VisualCube } from '../../components/VisualCube';
import { EventIcon } from '../../components/EventIcon';
import { PUZZLES, primaryDiameter, WCA_EVENT_ORDER, type PuzzleEntry } from './god_data';
import { DEEP } from './god_deep_data';
import './god.css';

const GrowthChart = lazy(() => import('./GrowthChart'));
const Bfs2x2Demo = lazy(() => import('./Bfs2x2Demo'));
const MetricExplainer = lazy(() => import('./MetricExplainer'));
const DistanceDistribution = lazy(() => import('./DistanceDistribution'));
const SubgroupChain = lazy(() => import('./SubgroupChain'));
const SuperflipShowcase = lazy(() => import('./SuperflipShowcase'));
const OpenProblems = lazy(() => import('./OpenProblems'));
const FaqSection = lazy(() => import('./FaqSection'));

/* ───── helpers ────────────────────────────────────────────────────── */

function formatDiameter(p: PuzzleEntry, isZh: boolean): string {
  const d = primaryDiameter(p);
  if (d.status === 'exact') return `${d.upper}`;
  if (d.status === 'parametric') return isZh ? `20·k` : `20·k`;
  if (d.lower != null && d.upper != null) return `${d.lower}–${d.upper}`;
  return `≤ ${d.upper}`;
}

function statusBadge(p: PuzzleEntry, isZh: boolean): { label: string; cls: string } {
  const d = primaryDiameter(p);
  if (d.status === 'exact') return { label: isZh ? '已证' : 'Proven', cls: 'is-exact' };
  if (d.status === 'parametric') return { label: isZh ? '平凡' : 'Trivial', cls: 'is-trivial' };
  return { label: isZh ? '上下界' : 'Bounds', cls: 'is-bounds' };
}

/* ───── card ───────────────────────────────────────────────────────── */

function PuzzleCard({ p, isZh, expanded, onToggle }: {
  p: PuzzleEntry; isZh: boolean; expanded: boolean; onToggle: () => void;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const d = primaryDiameter(p);
  const badge = statusBadge(p, isZh);

  return (
    <article className={`god-card ${expanded ? 'is-expanded' : ''}`}>
      <header className="god-card-head" onClick={onToggle}>
        <div className="god-card-icon">
          {p.puzzleSize ? (
            <VisualCube algorithm="" view="iso" puzzleSize={p.puzzleSize} size={56} alt={p.name.en} />
          ) : (
            <EventIcon event={p.id} className="god-card-cubing-icon" />
          )}
        </div>
        <div className="god-card-titleblock">
          <div className="god-card-title">
            <EventIcon event={p.id} className="god-card-eventicon" />
            <span>{isZh ? p.name.zh : p.name.en}</span>
          </div>
          <div className="god-card-states">|G| = {p.states.sci}{p.states.pretty && (
            <span className="god-card-states-extra"> · {isZh ? p.states.pretty.zh : p.states.pretty.en}</span>
          )}</div>
        </div>
        <div className="god-card-d-block">
          <div className={`god-card-badge ${badge.cls}`}>{badge.label}</div>
          <div className="god-card-d-num">
            {formatDiameter(p, isZh)}
            <span className="god-card-d-metric">{d.metric}</span>
          </div>
        </div>
      </header>

      {expanded && (
        <div className="god-card-body">
          <p className="god-card-blurb">{isZh ? p.blurb.zh : p.blurb.en}</p>

          {DEEP[p.id] && (
            <div className="god-card-deep">
              {DEEP[p.id].heading && (
                <h4 className="god-card-deep-h">{isZh ? DEEP[p.id].heading!.zh : DEEP[p.id].heading!.en}</h4>
              )}
              {DEEP[p.id].paragraphs.map((para, i) => (
                <p key={i} className="god-card-deep-p">{isZh ? para.zh : para.en}</p>
              ))}
            </div>
          )}

          {p.diameters.length > 1 && (
            <div className="god-card-metrics">
              <div className="god-card-metrics-h">{t('其它度量', 'Other metrics')}</div>
              <ul className="god-card-metrics-list">
                {p.diameters.slice(1).map((m, i) => (
                  <li key={i}>
                    <span className="god-card-metric-tag">{m.metric}</span>
                    <span className="god-card-metric-val">
                      {m.status === 'exact'
                        ? m.upper
                        : (m.lower != null ? `${m.lower}–${m.upper}` : `≤ ${m.upper}`)}
                    </span>
                    {m.note && <span className="god-card-metric-note">— {isZh ? m.note.zh : m.note.en}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.by && (
            <div className="god-card-meta">
              <span className="god-card-meta-l">{t('证明 / 估算者', 'Proved / estimated by')}:</span>
              <span>{d.by}</span>
              {d.year && <span className="god-card-year"> · {d.year}</span>}
            </div>
          )}

          <ul className="god-card-refs">
            {p.refs.map((r, i) => (
              <li key={i}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={13} />
                  <span>{r.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/* ───── timeline ───────────────────────────────────────────────────── */

interface Milestone { year: number; zh: string; en: string; cls?: string }
const MILESTONES: Milestone[] = [
  { year: 1974, zh: 'Ernő Rubik 在布达佩斯发明"魔方"。最初用作教学具,演示三维结构、空间想象与组合学。', en: 'Ernő Rubik invents the Magic Cube in Budapest as a teaching aid for 3-D structure, spatial reasoning, and combinatorics.' },
  { year: 1979, zh: '魔方上市为大众玩具;西方数学家立刻意识到它是"4.3 × 10¹⁹ 阶的有限群"。', en: 'Cube hits commercial shelves; Western mathematicians immediately recognise it as a finite group of order 4.3 × 10¹⁹.' },
  { year: 1981, zh: 'David Singmaster 出版《Notes on Rubik\'s Magic Cube》——首次系统化记号(URFDLB) + 群论术语,为后来所有研究奠基。', en: 'David Singmaster publishes Notes on Rubik\'s Magic Cube — the first systematic notation (URFDLB) and group-theoretic terminology underpinning everything since.' },
  { year: 1981, zh: '2×2 / Pyraminx / Skewb 的 BFS 在第一代 PC 上跑通 ⇒ 各自直径 11(三个不同群恰好同直径)。', en: '2×2 / Pyraminx / Skewb BFS feasible on early PCs ⇒ each diameter is 11 (a coincidence across three different groups).', cls: 'is-multi' },
  { year: 1982, zh: 'Morwen Thistlethwaite 公布 4-phase 算法:G₀ → G₁ → G₂ → G₃ → {e},每阶段查预计算表,上界 ≤ 52 HTM。', en: 'Morwen Thistlethwaite publishes the 4-phase algorithm: G₀ → G₁ → G₂ → G₃ → {e}, each phase from a precomputed table, capping 3×3 at ≤ 52 HTM.' },
  { year: 1990, zh: 'Hans Kloosterman 把上界压到 42 步;同年多位作者将其压到 40-37。', en: 'Hans Kloosterman tightens the upper bound to 42; several authors that year reach 40-37.' },
  { year: 1992, zh: 'Herbert Kociemba 发表 2-phase 算法,引入子群 H = ⟨U,D,L²,R²,F²,B²⟩(他叫 P1 或 G₁);把 3×3 切成 22 亿陪集,每个陪集 ≤ 30 HTM,合计上界 ≤ 30。', en: 'Herbert Kociemba publishes the 2-phase algorithm with H = ⟨U,D,L²,R²,F²,B²⟩ (his "P1" / "G₁"): 2.2 billion cosets, each ≤ 30 HTM, total ≤ 30.' },
  { year: 1995, zh: 'Michael Reid 用计算机辅助穷举证明 superflip 需 ≥ 20 步 ⇒ 3×3 下界跳到 20,并证 Kociemba 上界 ≤ 22。下界 20 / 上界 22 这个 2-步缝隙将持续 15 年。', en: 'Michael Reid uses computer-assisted enumeration to prove superflip needs ≥ 20 ⇒ 3×3 lower bound = 20; also proves Kociemba\'s bound ≤ 22. The 20/22 gap stands for 15 years.' },
  { year: 2005, zh: 'Mike Masonjones 用 BFS 证 Square-1 twist metric 直径 = 13。', en: 'Mike Masonjones BFS-proves Square-1 twist-metric diameter = 13.' },
  { year: 2006, zh: 'Silviu Radu 把三阶上界压到 27;次年(2007)Rokicki 加入研究,压到 26。', en: 'Silviu Radu pushes 3×3 upper bound to 27; Rokicki joins in 2007 and gets it to 26.' },
  { year: 2008, zh: 'Tomas Rokicki 用 Sun 的 8GB 集群把上界一路压到 22 步 —— Reid 1995 的目标终于达到,但还没合拢。', en: 'Tomas Rokicki uses Sun\'s 8-GB cluster to drop the upper bound to 22 — finally reaching Reid\'s 1995 target, but the gap is not closed.' },
  { year: 2010, zh: 'Rokicki · Kociemba · Davidson · Dethridge 在 Google 跑 35 CPU-年,把 22 亿陪集用对称压到 5588 万,再用集合覆盖压到 ~80 个 super-cosets。每个 super-coset 实际求解,无反例。2010-07-13 宣布:3×3 HTM 直径 = 20。', en: 'Rokicki · Kociemba · Davidson · Dethridge spend 35 CPU-years on Google: symmetry compresses 2.2B cosets to 55.88M, set-cover absorbs neighbours into ~80 super-cosets, each actually solved. No counterexample. 2010-07-13: 3×3 HTM diameter = 20.', cls: 'is-major' },
  { year: 2011, zh: 'Erik Demaine 等人 (arXiv:1106.5736 "Algorithms for Solving Rubik\'s Cubes") 证 N×N 魔方上帝之数 = Θ(N²/log N),通过并行子算法 + cubie 对易类划分。这是 NxN 渐近的严格证明。', en: 'Erik Demaine et al. (arXiv:1106.5736 "Algorithms for Solving Rubik\'s Cubes") prove N×N God\'s number is Θ(N²/log N) via parallel sub-algorithms + cubie commuting-class partitioning. The rigorous N×N asymptotic.' },
  { year: 2012, zh: 'Herbert Kociemba 用对易面计数证 Megaminx 下界 = 48 HTM。', en: 'Herbert Kociemba proves Megaminx lower bound = 48 HTM via commuting-faces counting.' },
  { year: 2014, zh: 'Rokicki & Davidson 用同套陪集框架证 3×3 QTM 直径 = 26;Jakob Kogler 用 front-cross 陪集证 Rubik\'s Clock 直径 = 12;Rokicki 单独证 3×3 STM 直径 = 18。一年三个新精确直径。', en: 'Rokicki & Davidson prove 3×3 QTM diameter = 26 with the same coset framework; Jakob Kogler proves Rubik\'s Clock diameter = 12 via front-cross cosets; Rokicki separately proves 3×3 STM diameter = 18. Three new exact diameters in one year.', cls: 'is-major' },
  { year: 2017, zh: 'Shuang Chen (WCA 2008CHEN27) 用 722 GB 磁盘 BFS + 3816 对称陪集,证 Square-1 face-turn 直径 = 31。磁盘 BFS 第一次在 cube 领域达到这种规模。', en: 'Shuang Chen (WCA 2008CHEN27) uses 722 GB disk BFS + 3816 symmetry cosets to prove Square-1 face-turn diameter = 31. The first cubing-domain disk-BFS at this scale.' },
  { year: 2018, zh: 'Sebastiano Tronto 与 Vincent Sheu 在 SpeedSolving 公布 4×4 OBTM 下界 ≥ 35。', en: 'Sebastiano Tronto and Vincent Sheu publish the 4×4 OBTM lower bound ≥ 35 on SpeedSolving.' },
  { year: 2020, zh: 'Graham Siggins 创下 MBLD 世界纪录 62/65。MBLD 群论上完全平凡(20·k 直径),记录是记忆 + 体力的极限。', en: 'Graham Siggins sets the MBLD world record 62/65. MBLD is group-theoretically trivial (diameter 20·k); the record is a memory + endurance limit.' },
  { year: 2022, zh: 'Yusheng Du 三阶 4.86s WR(已被 Yiheng Wang 4.86 平 + 后续超越),平均解 ~40 HTM,远高于 20 的理论最优。', en: 'Yusheng Du sets 3×3 WR at 4.86s (later tied / surpassed by Yiheng Wang), avg solution ~40 HTM, far above the 20 theoretical optimum.' },
  { year: 2024, zh: 'Merino & Subercaseaux (arXiv:2501.00144) 提出"Demigod\'s number" —— 用 36 HTM "高概率近似 oracle" 解三阶,不替代 Rokicki 20,但展示了用更少算力获得"近似上帝"的方法。', en: 'Merino & Subercaseaux (arXiv:2501.00144) propose a "Demigod\'s number" — a 36-HTM probabilistic oracle for 3×3. Doesn\'t replace Rokicki\'s 20 but demonstrates "approximate God" with less compute.' },
  { year: 2025, zh: 'cube20.org 发布 Rubik\'s Clock 完整距离分布,作为 2014 Kogler 证明的 11 年后独立复核。', en: 'cube20.org publishes Rubik\'s Clock full distance distribution as an independent re-verification of Kogler\'s 2014 proof, 11 years on.' },
];

/* ───── page ───────────────────────────────────────────────────────── */

export default function GodNumberPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['333', '222']));
  const toggle = (id: string) => setExpanded((s) => {
    const ns = new Set(s);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    return ns;
  });

  const orderedPuzzles = useMemo(() => {
    const map = new Map(PUZZLES.map((p) => [p.id, p]));
    return WCA_EVENT_ORDER.map((id) => map.get(id)).filter(Boolean) as PuzzleEntry[];
  }, []);

  return (
    <div className="god-page">
      <header className="god-header">
        <Link to="/scramble" className="god-back">
          <ArrowLeft size={16} />
          <span>{t('返回打乱中心', 'Back to scramble hub')}</span>
        </Link>
        <div className="god-header-right">
          <LangToggle variant="inline" />
          <ThemeToggle />
        </div>
      </header>

      <main className="god-main">
        {/* ────────────── HERO ────────────── */}
        <section className="god-hero">
          <div className="god-hero-eyebrow">{t('数学:扭计群论', 'Mathematics: combinatorial group theory')}</div>
          <h1 className="god-title">
            {t('上帝之数 ', "God's Number ")}
            <span className="god-title-zh">{t('— 全 WCA 项目', '— across every WCA puzzle')}</span>
          </h1>
          <p className="god-lead">
            {t(
              '"上帝之数"是一个魔方解魔方所需的最少步数中最大的那个 —— 也就是这个魔方"最难的状态"。形式化讲,它就是 Cayley 图的直径:在群 G 与生成元集 S 下,起点 e 到任意点 g 的最短路径长度的最大值。下面把 17 个 WCA 项目的直径(精确或上下界)一一列出。',
              "God's number is the maximum, over all states, of the minimum moves to solve. Formally it is the diameter of the Cayley graph of the puzzle group G with generator set S. Below, every WCA puzzle is listed with its exact diameter or current bounds.",
            )}
          </p>

          {/* 关键公式 */}
          <div className="god-formula-block">
            <div className="god-formula">
              D(G, S) = max<sub>g ∈ G</sub> min<sub>w ∈ S*, w·e = g</sub> |w|
            </div>
            <div className="god-formula-cap">
              {t(
                'G = 魔方群, S = 合法转动生成元, |w| = 步数(按所选度量)',
                'G = puzzle group, S = legal generating moves, |w| = word length (under the chosen metric)',
              )}
            </div>
          </div>
        </section>

        {/* ────────────── HIGHLIGHTS ────────────── */}
        <section className="god-highlights">
          <div className="god-hl-card">
            <div className="god-hl-num">20</div>
            <div className="god-hl-cap">{t('三阶 HTM 直径(精确)', '3×3 HTM diameter (exact)')}</div>
            <div className="god-hl-sub">Rokicki et al. 2010</div>
          </div>
          <div className="god-hl-card">
            <div className="god-hl-num">26</div>
            <div className="god-hl-cap">{t('三阶 QTM 直径(精确)', '3×3 QTM diameter (exact)')}</div>
            <div className="god-hl-sub">Rokicki & Davidson 2014</div>
          </div>
          <div className="god-hl-card">
            <div className="god-hl-num">35 CPU·yr</div>
            <div className="god-hl-cap">{t('Google 集群跑掉的算力', 'Google compute spent on the proof')}</div>
            <div className="god-hl-sub">55.88M cosets · 4.3 × 10¹⁹ states</div>
          </div>
          <div className="god-hl-card">
            <div className="god-hl-num">Θ(N²/log N)</div>
            <div className="god-hl-cap">{t('NxN 上帝之数渐近 (Demaine 2011)', 'N×N God\'s number asymptotic (Demaine 2011)')}</div>
            <div className="god-hl-sub">arXiv:1106.5736</div>
          </div>
        </section>

        {/* ────────────── GROUP-THEORY PRIMER ────────────── */}
        <section className="god-section">
          <h2>{t('两分钟群论速通', 'Two-minute group-theory primer')}</h2>
          <div className="god-primer-grid">
            <div className="god-primer-cell">
              <h3>{t('1. 魔方是一个群', '1. A cube is a group')}</h3>
              <p>{t(
                '每个合法状态对应一个置换:把 8 个角块的位置 + 朝向、12 个棱块的位置 + 朝向打散重排。乘法 = 把两个操作依次施加。单位元 = "还原态"。逆元 = "反演"。三阶魔方的所有状态构成群 G,阶 |G| = 4.3 × 10¹⁹。',
                'Every legal state is a permutation: 8 corners (pos + orientation) and 12 edges (pos + orientation) reshuffled. Multiplication = compose two operations. Identity = solved state. Inverse = invert the sequence. All 3×3 states form a group G with |G| = 4.3 × 10¹⁹.',
              )}</p>
            </div>
            <div className="god-primer-cell">
              <h3>{t('2. 生成元 = "你能转的"', '2. Generators = "what you can turn"')}</h3>
              <p>{t(
                '六个 90° 面转 {U, D, L, R, F, B} 与它们的 180° / 反转构成生成元集 S。任何状态都能写成 S 中元素的有限乘积 —— 这就是 G 由 S 生成。',
                'The six 90° face turns {U, D, L, R, F, B} plus their inverses / doubles form generator set S. Every state is a finite product of elements of S — that\'s "G is generated by S".',
              )}</p>
            </div>
            <div className="god-primer-cell">
              <h3>{t('3. Cayley 图', '3. The Cayley graph')}</h3>
              <p>{t(
                '把每个状态当一个顶点,两个状态相差一个生成元就连一条边。这张图叫 Cayley 图 Γ(G, S)。"解魔方" = 找一条从打乱状态到单位元的路径。',
                'Make a vertex for each state; draw an edge between two states differing by one generator. This is the Cayley graph Γ(G, S). "Solving" = finding a path from your state to the identity.',
              )}</p>
            </div>
            <div className="god-primer-cell">
              <h3>{t('4. 直径 = 上帝之数', '4. Diameter = God\'s number')}</h3>
              <p>{t(
                'Cayley 图里"最短路径的最大值"就是直径 D(G, S)。也就是 —— 最坏情况下,最少要几步才能还原。这就是上帝之数。',
                'The maximum, over all pairs of vertices, of the shortest-path length: that\'s the diameter D(G, S). In other words, worst-case minimum-move count. That\'s God\'s number.',
              )}</p>
            </div>
            <div className="god-primer-cell">
              <h3>{t('5. Lagrange 定理 ⇒ 陪集分解', '5. Lagrange ⇒ coset decomposition')}</h3>
              <p>{t(
                '任何子群 H ⊂ G 都把 G 切成 |G|/|H| 个互不相交的等价类(陪集)。Kociemba 算法用 H = ⟨U,D,L²,R²,F²,B²⟩(|H| ≈ 1.95 × 10¹⁰)把 4.3 × 10¹⁹ 状态划成 2,217,093,120 个陪集——每个陪集只需求一次解,数量减少 10 个数量级。',
                'Any subgroup H ⊂ G partitions G into |G|/|H| disjoint cosets. Kociemba\'s H = ⟨U,D,L²,R²,F²,B²⟩ (|H| ≈ 1.95 × 10¹⁰) splits 4.3 × 10¹⁹ states into 2,217,093,120 cosets — solve each once, 10 orders of magnitude saved.',
              )}</p>
            </div>
            <div className="god-primer-cell">
              <h3>{t('6. 对称群 S₄₈ ⇒ 进一步压缩', '6. Symmetry group S₄₈ ⇒ further squeeze')}</h3>
              <p>{t(
                '立方体本身有 48 个对称(24 个旋转 × 2 镜像)。两个状态若在对称下等价,其上帝之数相同。三阶 22 亿陪集模掉 S₄₈ 剩 ~5588 万——这是 2010 证明的可行规模。',
                'The cube itself has 48 symmetries (24 rotations × 2 mirror). Two states equivalent under symmetry share a diameter. Quotienting the 2.2B cosets by S₄₈ leaves ~55.88M — the feasibility threshold that made the 2010 proof possible.',
              )}</p>
            </div>
          </div>
        </section>

        {/* ────────────── SUBGROUP CHAIN ────────────── */}
        <section className="god-section">
          <h2>{t('阶段算法 — 互动:Kociemba vs Thistlethwaite', 'Phase algorithms — interactive: Kociemba vs Thistlethwaite')}</h2>
          <p className="god-sec-lead">{t(
            '陪集分解的实现方式有两套主流。Thistlethwaite (1981) 把求解切成 4 个阶段,每个阶段冻结一个对称性;Kociemba (1992) 简化为 2 个阶段。下面是两套子群链的对比:每一层显示 |Gi| + 到下一层的陪集数 + 该阶段的最坏步数。',
            'Two main flavours of coset decomposition. Thistlethwaite (1981) splits solving into 4 phases, each freezing one symmetry. Kociemba (1992) simplifies to 2. Below: the subgroup chains side by side, each layer showing |Gi| + coset count to next + phase worst-case moves.',
          )}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <SubgroupChain isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── METRIC ────────────── */}
        <section className="god-section">
          <h2>{t('度量决定数字 — 互动:HTM / QTM / STM', 'The metric decides the number — interactive: HTM / QTM / STM')}</h2>
          <p className="god-sec-lead">{t(
            '上帝之数永远是 "图的直径",但图的边怎么连取决于"一步等于什么"。下面这三种度量是文献中最常见的:点 tab 切换,例子里的步会重新计数。',
            'God\'s number is always "graph diameter", but what edges exist depends on what counts as "one move". The three metrics below are the ones you\'ll see in the literature — click to switch, the example re-counts itself.',
          )}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <MetricExplainer isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── PUZZLES GRID ────────────── */}
        <section className="god-section">
          <h2>{t('全 WCA 项目的上帝之数', "God's number for every WCA event")}</h2>
          <p className="god-sec-lead">{t(
            '点任意卡片展开详情(算法、证明者、参考资料)。"已证"卡片有精确值;"上下界"卡片只有当前最好的上下界 —— 它们之间还存在缝隙,等待被合上。',
            'Click any card to expand details (algorithm, prover, references). "Proven" cards have exact values; "Bounds" cards show the best known gap, waiting to be closed.',
          )}</p>
          <div className="god-grid">
            {orderedPuzzles.map((p) => (
              <PuzzleCard key={p.id}
                          p={p}
                          isZh={isZh}
                          expanded={expanded.has(p.id)}
                          onToggle={() => toggle(p.id)} />
            ))}
          </div>
          <div className="god-grid-legend">
            <span><i className="god-dot is-exact" /> {t('已证精确值', 'Proven exact')}</span>
            <span><i className="god-dot is-bounds" /> {t('只有上下界', 'Bounds only')}</span>
            <span><i className="god-dot is-trivial" /> {t('平凡 / 参数化', 'Trivial / parametric')}</span>
          </div>
        </section>

        {/* ────────────── 3×3 DISTANCE DISTRIBUTION ────────────── */}
        <section className="god-section">
          <h2>{t('三阶最少步分布 — 互动:FMC 的天花板', '3×3 minimum-solution distribution — interactive: the FMC ceiling')}</h2>
          <p className="god-sec-lead">{t(
            '把"距离 d (HTM) 处有多少个三阶状态"画出来,就是 FMC 选手实质要面对的"最少步分布"。Rokicki 团队公布了 d=0..15 的精确值;d=16..20 因总和被 4.3 × 10¹⁹ 约束,只有估算。',
            'Plot "how many 3×3 states are at distance d (HTM)" and you get the distribution every FMC solver implicitly faces. Rokicki has published exact counts for d=0..15; d=16..20 are estimates constrained by the total sum 4.3 × 10¹⁹.',
          )}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <DistanceDistribution isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── SUPERFLIP ────────────── */}
        <section className="god-section">
          <h2>{t('Superflip — 三阶上"最难"的状态', 'Superflip — the "hardest" 3×3 state')}</h2>
          <p className="god-sec-lead">{t(
            '1995 年 Michael Reid 证明 superflip 需要恰好 20 HTM,把三阶下界推到 20;2010 年 Rokicki 团队证上界也是 20,合拢。下面渲染 superflip 的三维状态,给出两条最优解,并列出另外几个 distance-20 antipode 的代表。',
            'In 1995 Michael Reid proved superflip needs exactly 20 HTM, pushing the 3×3 lower bound to 20; in 2010 Rokicki\'s team proved the upper bound is also 20, closing the gap. Below: the 3-D superflip state, two optimal solutions, and a few other distance-20 antipode representatives.',
          )}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <SuperflipShowcase isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── GROWTH ────────────── */}
        <section className="god-section">
          <h2>{t('NxN 增长 — 互动:状态空间 vs 上帝之数', 'N×N growth — interactive: state space vs diameter')}</h2>
          <p className="god-sec-lead">{t(
            '左轴 |G(N)| 走双指数级 (~10^(N²)),右轴上帝之数走多项式 / 多项式·对数。两者的比就是"难度密度"。鼠标悬停某个 N 看具体值。',
            'Left axis grows double-exponentially (~10^(N²)); right axis grows polynomially with a log shave. Their ratio is the "difficulty density". Hover an N for exact values.',
          )}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <GrowthChart isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── BFS ────────────── */}
        <section className="god-section">
          <h2>{t('2×2 现场 BFS — 你来证一遍 "直径 = 11"', '2×2 live BFS — re-prove "diameter = 11" yourself')}</h2>
          <p className="god-sec-lead">{t(
            '2×2 群只有 367 万状态,一台笔记本几秒内 BFS 完整张图,无需对称压缩 / 陪集 / GPU。下面这个按钮在你浏览器里 spawn 一个 worker 跑完所有 9 个 HTM 生成元 (U U2 U\' R R2 R\' F F2 F\') 的广搜,并实时画距离分布。',
            'The 2×2 group has only 3.67M states — a laptop BFSes the whole graph in seconds without symmetry / cosets / GPU. The button below spawns a worker that runs full BFS over the 9 HTM generators (U U2 U\' R R2 R\' F F2 F\') and streams the distance distribution to the chart.',
          )}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <Bfs2x2Demo isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── ALGO ────────────── */}
        <section className="god-section">
          <h2>{t('它们是怎么算出来的?', 'How are these numbers actually computed?')}</h2>
          <p className="god-sec-lead">{t(
            '8 种实战技术,从最简单的"扫一遍"到最大的"用对称结构吞掉对称等价类"。每种适合的群规模不同,下面按规模排:',
            'Eight real-world techniques, ordered by group size — from "BFS the lot" to "symmetry-quotient your way to feasibility".',
          )}</p>
          <div className="god-algo-grid">
            <div className="god-algo-cell">
              <div className="god-algo-name">BFS</div>
              <div className="god-algo-desc">{t(
                '小群 (≤ 10⁸) 直接广搜整张图,1 字节/state 存距离,几秒-几分钟内得到完整分布 + 直径。本页 "2×2 现场 BFS" 就是浏览器跑这个,Pyraminx / Skewb / Sq-1 (twist) 也都这么算。',
                'Tiny groups (≤ 10⁸): plain BFS over the whole graph, 1 byte/state for distance, full distribution + diameter in seconds-to-minutes. The "2×2 live BFS" above is exactly this. Pyraminx, Skewb, Sq-1 (twist) too.',
              )}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('双向 BFS', 'Bidirectional BFS')}</div>
              <div className="god-algo-desc">{t(
                '从起点和终点同时 BFS,在中点会合 ⇒ 总搜索空间从 b^d 降到 2·b^(d/2)。Sq-1 twist 用过;通用 IDA* 求解器也用类似思路。',
                'BFS from both ends, meet in the middle ⇒ search space drops from b^d to 2·b^(d/2). Used for Sq-1 twist; the same trick powers many general IDA* solvers.',
              )}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">IDA* + Pattern Database</div>
              <div className="god-algo-desc">{t(
                '中型群 (10⁹-10¹²):预计算某一组 cubie (e.g. "所有 corner") 的最短解距离表(占几百 MB),作为整体解的 admissible 下界 (heuristic h(s) ≤ d*(s))。主搜索用 Iterative Deepening A* + 这个 h,效果碾压纯 BFS。Kociemba\'s P1/P2 表就是 PDB 的经典例子。',
                'Mid-sized groups (10⁹-10¹²): precompute the shortest-solution table for a subset of cubies (e.g. all corners) — a few hundred MB — and use it as an admissible heuristic h(s) ≤ d*(s) for the full problem. Iterative Deepening A* + this h crushes plain BFS. Kociemba\'s P1/P2 tables are the canonical example.',
              )}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('陪集分解 + 集合覆盖', 'Coset partition + set cover')}</div>
              <div className="god-algo-desc">{t(
                '大群 (10¹⁹+):按子群 H 把 G 划成 |G|/|H| 个陪集,每个陪集独立求解。三阶用 H = ⟨U,D,L²,R²,F²,B²⟩,|G|/|H| = 22 亿。再用 set cover 贪心选 ~80 个 super-cosets(每个含若干相邻陪集),实际只对 super-coset 求解。',
                'Huge groups (10¹⁹+): split G into |G|/|H| cosets of a subgroup H, solve each independently. 3×3 uses H = ⟨U,D,L²,R²,F²,B²⟩, |G|/|H| = 2.2B. Then a greedy set-cover packs neighbouring cosets into ~80 super-cosets and you actually solve only those.',
              )}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('对称 / 反对称压缩', 'Symmetry / antisymmetry reduction')}</div>
              <div className="god-algo-desc">{t(
                '立方体 48 个对称(24 旋转 × 2 镜像)+ 反对称(逆元等价)总 96 个等价。两个等价状态的最优解长度必相等 ⇒ 一次解全。三阶 22 亿陪集模掉对称剩 5588 万 —— 这 40 倍压缩是 2010 证明的 enabler。',
                'The cube has 48 symmetries (24 rotations × 2 mirrors) plus antisymmetry (inverses are equivalent), 96 total. Equivalent states share their optimal solution length ⇒ solve once, propagate. The 3×3\'s 2.2B cosets shrink to 55.88M under symmetry — that 40× squeeze is the 2010 proof\'s enabler.',
              )}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('磁盘 BFS', 'Disk-based BFS')}</div>
              <div className="god-algo-desc">{t(
                '当 |G| 超过内存时,把"前沿"按层批量写到 SSD,用外存 sort + uniq 跨层去重。Sq-1 face-turn (Shuang Chen 2017) 用了 722 GB——每个状态压到 2 bits 才装得下 1.2 × 10¹³ 个 twistable states。',
                'When |G| outgrows RAM, batch-write each frontier layer to SSD; cross-layer dedup via external sort + uniq. Sq-1 face-turn (Shuang Chen 2017) used 722 GB — 2 bits/state to fit 1.2 × 10¹³ twistable states.',
              )}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('Canonical-sequence 计数 (下界)', 'Canonical-sequence counting (lower bound)')}</div>
              <div className="god-algo-desc">{t(
                '不求解,只数 canonical 序列:深度 d 的合法序列数 ≤ N·M^(d-1)(同轴排除后)。Megaminx 用对易面递推 total(n+1) = 36t(n) - 240t(n-1) - 320t(n-2);让 total ≥ |G| 反推 d 下界。Megaminx 48 / 4×4 35 都是这么来的。',
                'Don\'t solve, just count: legal canonical sequences at depth d ≤ N·M^(d-1) (after rejecting same-axis-as-previous). Megaminx uses a commuting-faces recurrence total(n+1) = 36t(n) − 240t(n−1) − 320t(n−2); set total ≥ |G| ⇒ lower bound on d. Megaminx 48, 4×4 35 came from here.',
              )}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('渐近构造 (Demaine)', 'Asymptotic construction (Demaine)')}</div>
              <div className="god-algo-desc">{t(
                'Demaine 等 2011:把 N×N 上的所有 cubie 分成 O(N²/log N) 个 commuting class,每个用并行子算法 O(log N) 步内解决。配合 canonical-sequence Ω(N²/log N) 下界,得到 Θ(N²/log N) 的严证。常数很大,只是渐近正确。',
                'Demaine et al. 2011: partition N×N cubies into O(N²/log N) commuting classes; solve each in O(log N) parallel moves. Match with the canonical-sequence Ω(N²/log N) lower bound ⇒ Θ(N²/log N), rigorous. Constants are big; only asymptotic.',
              )}</div>
            </div>
          </div>

          {/* IDA* pseudo-code */}
          <div className="god-algo-pseudo">
            <h3>{t('IDA* + Pattern Database 伪代码', 'IDA* + Pattern Database pseudocode')}</h3>
            <pre className="god-pseudo-code">{`function solve(start):
  for depth = 0, 1, 2, ..., 20:
    if dfs(start, depth, 0) is not None: return solution
  return None  // unreachable for 3×3 (we know depth ≤ 20)

function dfs(state, max_depth, g):
  h = pattern_db.lookup(state)        // admissible: h ≤ true distance
  if g + h > max_depth: return None
  if state == identity:  return []    // solved
  for move in legal_moves(state):
    if same_axis_as_previous(move): continue
    sub = dfs(apply(state, move), max_depth, g + 1)
    if sub is not None: return [move] + sub
  return None`}</pre>
            <p className="god-algo-pseudo-cap">{t(
              '一次 IDA* 求解一个状态 (毫秒级)。如果对所有 ~5588 万 super-cosets 都跑一次 IDA* 并保证 ≤ 20 步,直径就被压实 = 20。',
              'One IDA* call solves one state (milliseconds). Run it on all ~55.88M super-cosets with the assertion ≤ 20 holds — and the diameter is nailed at 20.',
            )}</p>
          </div>
        </section>

        {/* ────────────── OPEN PROBLEMS ────────────── */}
        <section className="god-section">
          <h2>{t('未解之谜', 'Open problems')}</h2>
          <p className="god-sec-lead">{t(
            '4 个 / 5 个项目精确直径至今未知。下面把每个未合拢的 gap 拆开来看:为什么难、怎么合拢、估算工作量。',
            "Four/five puzzles have no exact diameter to date. For each unfinished gap: why it's hard, what would close it, rough effort estimate.",
          )}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <OpenProblems isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── TIMELINE ────────────── */}
        <section className="god-section">
          <h2>{t('历史时间线', 'Timeline')}</h2>
          <ol className="god-timeline">
            {MILESTONES.map((m, i) => (
              <li key={i} className={`god-tl-item ${m.cls || ''}`}>
                <div className="god-tl-year">{m.year}</div>
                <div className="god-tl-dot" />
                <div className="god-tl-body">{isZh ? m.zh : m.en}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* ────────────── FAQ ────────────── */}
        <section className="god-section">
          <h2>{t('常见问题 + 词汇表', 'FAQ + glossary')}</h2>
          <p className="god-sec-lead">{t(
            '10 个常被问到的问题(为什么叫"上帝之数"、WCA 打乱跟它什么关系、CFOP 能达到吗、cube20.org 35 CPU 年放到今天怎么算……)+ 群论 / 算法术语速查表。',
            'Ten common questions ("why this nickname?", "are WCA scrambles near it?", "can CFOP reach 20?", "how much compute is 35 CPU-years today?"…) plus a group-theory / algorithm glossary.',
          )}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <FaqSection isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── REFERENCES ────────────── */}
        <section className="god-section">
          <h2>{t('参考资料', 'References')}</h2>
          <ul className="god-refs">
            <li><a href="https://www.cube20.org/" target="_blank" rel="noopener noreferrer">cube20.org</a> — {t('Rokicki 团队的总站,所有三阶 / 魔表证明数据 + 完整距离分布', 'Rokicki team\'s hub: 3×3 / Clock proof data + full distance distributions')}</li>
            <li><a href="https://www.cube20.org/qtm/" target="_blank" rel="noopener noreferrer">cube20.org / QTM</a> — {t('三阶 QTM 直径 = 26 证明数据 (2014)', '3×3 QTM diameter = 26 proof data (2014)')}</li>
            <li><a href="https://www.cube20.org/clock/" target="_blank" rel="noopener noreferrer">cube20.org / Clock</a> — {t('Rubik\'s Clock 直径 = 12 与完整分布 (2025-03-04)', 'Rubik\'s Clock diameter = 12 and full distribution (2025-03-04)')}</li>
            <li><a href="https://epubs.siam.org/doi/abs/10.1137/120867366" target="_blank" rel="noopener noreferrer">Rokicki et al., SIAM J. Discrete Math 2014</a> — {t('同行评议版 "The Diameter of the Rubik\'s Cube Group Is Twenty"', 'Peer-reviewed paper "The Diameter of the Rubik\'s Cube Group Is Twenty"')}</li>
            <li><a href="https://arxiv.org/abs/1106.5736" target="_blank" rel="noopener noreferrer">Demaine et al. 2011 — arXiv:1106.5736</a> — {t('"Algorithms for Solving Rubik\'s Cubes",NxN 上帝之数 Θ(N²/log N) 严证', '"Algorithms for Solving Rubik\'s Cubes", rigorous Θ(N²/log N) for N×N')}</li>
            <li><a href="https://kociemba.org/cube.htm" target="_blank" rel="noopener noreferrer">Herbert Kociemba — Two-phase algorithm</a> — {t('Kociemba 自己的算法描述与实现指南', 'Algorithm description + implementation guide by the author')}</li>
            <li><a href="https://kociemba.org/themen/megaminx/megasol.html" target="_blank" rel="noopener noreferrer">Kociemba — Megaminx lower bound</a> — {t('Megaminx 下界 48 的对易面计数证明', 'Megaminx 48 lower bound via commuting-faces counting')}</li>
            <li><a href="https://www.jaapsch.net/puzzles/" target="_blank" rel="noopener noreferrer">Jaap Scherphuis\' puzzle pages</a> — {t('2×2 / Skewb / Pyraminx / Square-1 / Clock 的状态数 + BFS 数据', 'state counts + BFS data for 2×2, Skewb, Pyraminx, Square-1, Clock')}</li>
            <li><a href="https://www.speedsolving.com/threads/square-one-can-be-solved-in-31-moves-in-face-turn-metric.67363/" target="_blank" rel="noopener noreferrer">Shuang Chen — Sq-1 face-turn = 31</a> — {t('722 GB 磁盘 BFS 求解过程帖 (2017-12)', '722 GB disk-BFS write-up (2017-12)')}</li>
            <li><a href="https://www.speedsolving.com/threads/gods-number-for-clock-found.47822/" target="_blank" rel="noopener noreferrer">Jakob Kogler — Clock = 12</a> — {t('2014-05 原始证明帖', 'Original 2014-05 proof thread')}</li>
            <li><a href="https://www.speedsolving.com/threads/lower-bound-for-megaminx-in-htm-and-qtm.35724/" target="_blank" rel="noopener noreferrer">Speedsolving — Megaminx bound</a> — {t('Megaminx HTM/QTM 下界讨论合集', 'Megaminx HTM/QTM bound discussion thread')}</li>
            <li><a href="https://arxiv.org/abs/2501.00144" target="_blank" rel="noopener noreferrer">Merino & Subercaseaux 2024 — arXiv:2501.00144</a> — {t('"Demigod\'s number" 36 HTM 概率近似 oracle', '"Demigod\'s number" — 36 HTM probabilistic oracle')}</li>
            <li><a href="https://web.mit.edu/sp.268/www/rubik.pdf" target="_blank" rel="noopener noreferrer">Tom Davis — Group Theory via Rubik\'s Cube</a> — {t('MIT 入门讲义,把魔方当群论教材', 'MIT primer treating the cube as a group-theory textbook')}</li>
            <li><a href="https://en.wikipedia.org/wiki/God%27s_algorithm" target="_blank" rel="noopener noreferrer">Wikipedia — God\'s algorithm</a> — {t('上帝之数与上帝算法的标准百科词条', 'Encyclopedic article on God\'s number / God\'s algorithm')}</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
