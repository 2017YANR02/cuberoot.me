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
import './god.css';

const GrowthChart = lazy(() => import('./GrowthChart'));
const Bfs2x2Demo = lazy(() => import('./Bfs2x2Demo'));
const MetricExplainer = lazy(() => import('./MetricExplainer'));

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
  { year: 1981, zh: '匈牙利 Rubik 的魔方在西方爆红;David Singmaster 出版第一本系统魔方理论书', en: 'Rubik\'s Cube hits Western markets; Singmaster\'s Notes on Rubik\'s Magic Cube formalises notation' },
  { year: 1981, zh: '2×2 / Pyraminx / Skewb 的 BFS 在第一代 PC 上跑通 ⇒ 各自直径 11', en: '2×2, Pyraminx, Skewb BFS feasible on early PCs ⇒ each diameter is 11', cls: 'is-multi' },
  { year: 1982, zh: 'Morwen Thistlethwaite 公布 4-phase 算法,把 3×3 上界压到 52', en: 'Thistlethwaite\'s 4-phase algorithm caps 3×3 at 52' },
  { year: 1992, zh: 'Herbert Kociemba 发表 2-phase 算法,引入 P1 cosets (G1 = ⟨U,D,L2,R2,F2,B2⟩),上界 ≤ 22', en: 'Kociemba publishes the two-phase algorithm with G1 coset (⟨U,D,L2,R2,F2,B2⟩), bound ≤ 22' },
  { year: 1995, zh: 'Michael Reid 把 superflip 证为需 ≥ 20 步 ⇒ 下界跳到 20', en: 'Michael Reid proves "superflip" needs ≥ 20 ⇒ lower bound = 20' },
  { year: 2005, zh: 'Square-1 twist metric 直径 = 13 (Mike Masonjones)', en: 'Square-1 twist-metric diameter = 13 (Mike Masonjones)' },
  { year: 2008, zh: 'Tomas Rokicki 把 3×3 上界一路压到 22', en: 'Tomas Rokicki tightens 3×3 upper bound to 22' },
  { year: 2010, zh: 'Rokicki·Kociemba·Davidson·Dethridge 完成 5588 万对称陪集求解,证明 3×3 HTM 直径 = 20 ⇒ 上下界相等', en: 'Rokicki·Kociemba·Davidson·Dethridge complete 55.88M symmetry cosets, prove 3×3 HTM diameter = 20', cls: 'is-major' },
  { year: 2011, zh: 'Demaine 等人 (arXiv:1106.5736) 证 NxN 上帝之数为 Θ(N²/log N)', en: 'Demaine et al. (arXiv:1106.5736) prove N×N God\'s number is Θ(N²/log N)' },
  { year: 2014, zh: 'Rokicki·Davidson 证 3×3 QTM 直径 = 26;Kogler 证魔表直径 = 12;Rokicki 证 3×3 STM 直径 = 18', en: 'Rokicki·Davidson: 3×3 QTM diameter = 26; Kogler: Clock diameter = 12; Rokicki: 3×3 STM diameter = 18', cls: 'is-major' },
  { year: 2017, zh: 'Shuang Chen 证 Square-1 face-turn 直径 = 31 (722 GB 磁盘 BFS)', en: 'Shuang Chen: Square-1 face-turn diameter = 31 (722 GB disk BFS)' },
  { year: 2025, zh: 'cube20.org 发布魔表完整距离分布,作为 2014 证明的独立复核', en: 'cube20.org publishes full Clock distance distribution as independent re-verification of 2014 proof' },
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
          </div>
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
          <div className="god-algo-grid">
            <div className="god-algo-cell">
              <div className="god-algo-name">BFS</div>
              <div className="god-algo-desc">{t(
                '小群 (≤ 10⁸) 直接广搜整张图。2×2 / Pyraminx / Skewb / Sq-1 (twist) 都用这个。',
                'Tiny groups (≤ 10⁸): plain BFS over the whole graph. 2×2, Pyraminx, Skewb, Sq-1 (twist) all done this way.',
              )}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">IDA* + 剪枝表</div>
              <div className="god-algo-desc">{t(
                '中型群 (10⁹–10¹²):用 pattern database 做 admissible 启发,迭代加深 A* 求每个状态最短解。Kociemba 的 P1/P2 表是经典。',
                'Mid-sized groups (10⁹–10¹²): pattern-database heuristic + iterative-deepening A*. Kociemba\'s P1/P2 tables are the classic.',
              )}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('陪集分解 + 集合覆盖', 'Coset partition + set cover')}</div>
              <div className="god-algo-desc">{t(
                '大群 (10¹⁹+):按子群 H 把 G 划成 |G|/|H| 个陪集,每个陪集独立求解。三阶用 H = ⟨U,D,L2,R2,F2,B2⟩,|G|/|H| = 22 亿;再用对称 + 集合覆盖压到 5588 万。',
                'Huge groups (10¹⁹+): split G into |G|/|H| cosets of a subgroup H, solve each independently. 3×3 uses H = ⟨U,D,L2,R2,F2,B2⟩, giving 2.2B cosets; symmetry + set cover compress to 55.88M.',
              )}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('磁盘 BFS', 'Disk-based BFS')}</div>
              <div className="god-algo-desc">{t(
                '当 |G| 超过内存时,把距离表存到 SSD,按层流式 sort + uniq。Sq-1 face-turn (Shuang Chen 2017) 用了 722 GB。',
                'When |G| exceeds RAM, stream the frontier through sort + uniq on SSD. Sq-1 face-turn (Shuang Chen 2017) used 722 GB.',
              )}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('计数 (Counting bound)', 'Counting bound')}</div>
              <div className="god-algo-desc">{t(
                '不算解,只数 canonical 序列:深度 d 的合法序列数 ≤ N·M^(d-1)。让它 ≥ |G| 就得到 D 的下界。Megaminx 48 / 4×4 35 都是这么来的。',
                'No solver — just count canonical sequences: at depth d there are ≤ N·M^(d-1). Force this ≥ |G| and you get a lower bound on D. Megaminx 48, 4×4 35 come from here.',
              )}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('渐近构造', 'Asymptotic construction')}</div>
              <div className="god-algo-desc">{t(
                'Demaine 等 2011:把 NxN 上的所有 cubie 分成 O(N²/log N) 个对易类,每类用并行子算法在 O(log N) 步解决。这是 Θ(N²/log N) 的严格证明,但具体常数很大。',
                'Demaine et al. 2011: partition N×N cubies into O(N²/log N) commuting classes, solve each in O(log N) parallel steps. Rigorous Θ(N²/log N), though the constants are large.',
              )}</div>
            </div>
          </div>
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

        {/* ────────────── REFERENCES ────────────── */}
        <section className="god-section">
          <h2>{t('参考资料', 'References')}</h2>
          <ul className="god-refs">
            <li><a href="https://www.cube20.org/" target="_blank" rel="noopener noreferrer">cube20.org</a> — {t('Rokicki 团队的总站,所有三阶 / 魔表证明数据', 'Rokicki team\'s hub for all 3×3 / Clock proof data')}</li>
            <li><a href="https://epubs.siam.org/doi/abs/10.1137/120867366" target="_blank" rel="noopener noreferrer">Rokicki et al., SIAM J. Discrete Math 2014</a> — {t('"The Diameter of the Rubik\'s Cube Group Is Twenty" 同行评议版', 'Peer-reviewed paper "The Diameter of the Rubik\'s Cube Group Is Twenty"')}</li>
            <li><a href="https://arxiv.org/abs/1106.5736" target="_blank" rel="noopener noreferrer">Demaine, Demaine, Eisenstat, Lubiw, Winslow 2011</a> — {t('"Algorithms for Solving Rubik\'s Cubes", NxN 上帝之数 Θ(N²/log N) 严证', '"Algorithms for Solving Rubik\'s Cubes", rigorous Θ(N²/log N) for N×N')}</li>
            <li><a href="https://www.jaapsch.net/puzzles/" target="_blank" rel="noopener noreferrer">Jaap Scherphuis\' puzzle pages</a> — {t('2×2 / Skewb / Pyraminx / Square-1 / Clock 的状态数 + BFS 数据', 'state counts + BFS data for 2×2, Skewb, Pyraminx, Square-1, Clock')}</li>
            <li><a href="https://kociemba.org/" target="_blank" rel="noopener noreferrer">Herbert Kociemba — kociemba.org</a> — {t('two-phase 算法主页与 Megaminx 下界证明', 'two-phase algorithm reference and Megaminx lower-bound proof')}</li>
            <li><a href="https://www.speedsolving.com/threads/square-one-can-be-solved-in-31-moves-in-face-turn-metric.67363/" target="_blank" rel="noopener noreferrer">Shuang Chen — Sq-1 face-turn = 31</a> — {t('722 GB 磁盘 BFS 求解过程贴', '722 GB disk-BFS write-up')}</li>
            <li><a href="https://www.speedsolving.com/threads/gods-number-for-clock-found.47822/" target="_blank" rel="noopener noreferrer">Jakob Kogler — Clock = 12</a> — {t('2014 原始证明帖', 'Original 2014 proof thread')}</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
