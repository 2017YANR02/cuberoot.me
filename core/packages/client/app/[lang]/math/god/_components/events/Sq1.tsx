'use client';

/**
 * /math/god?event=sq1 — Square-1 God's number (migrated from the old /math/sq1).
 *
 * Faithful port of the former page body, embedded under a .god-sq1 token wrapper
 * (sq1.css now scopes its --sq1-* vars there instead of a full-page .sq1-page).
 * Identity hero (icon + name) is provided by EventDetail; this is the article body.
 *
 *   intro (3-metric formula + 4 highlight cards)
 *   §1 puzzle & state space      → StateSpaceCalculator
 *   §2 three move metrics         → MoveCountCalculator
 *   §3 the two proven diameters   → DepthDistribution
 *   §4 the open WCA-12c4 mystery  → OpenProblemBracket
 *   §5 how it gets solved + solver CTA
 *   references
 */
import { Suspense, lazy } from 'react';
import Link from '@/components/AppLink';
import { ExternalLink, Wrench } from 'lucide-react';
import { TeXBlock } from '../sq1/Tex';
import { METRICS, STATE_SPACE } from '../sq1/sq1_data';
import '../sq1/sq1.css';

const StateSpaceCalculator = lazy(() => import('../sq1/StateSpaceCalculator'));
const MoveCountCalculator = lazy(() => import('../sq1/MoveCountCalculator'));
const DepthDistribution = lazy(() => import('../sq1/DepthDistribution'));
const OpenProblemBracket = lazy(() => import('../sq1/OpenProblemBracket'));

const Loading = () => <div className="sq1-readout sq1-hint">…</div>;

const REFS: { url: string; zh: string; en: string }[] = [
  { url: 'https://www.jaapsch.net/puzzles/square1.htm',
    zh: 'Jaap Scherphuis,Square-1 主页:零件模型、记号、态空间公式、两套上帝之数(扭转 13 / 面转 31)及出处。',
    en: 'Jaap Scherphuis — Square-1 page: piece model, notation, state-space formulas, both God\'s numbers (twist 13 / face-turn 31).' },
  { url: 'https://www.jaapsch.net/puzzles/square1t.htm',
    zh: 'Jaap / Masonjones 2005,扭转口径上帝算法完整分布表(0..13,共 435,891,456,000)。',
    en: 'Jaap / Masonjones 2005 — full twist-metric God\'s-algorithm distribution (0..13, total 435,891,456,000).' },
  { url: 'https://www.jaapsch.net/puzzles/square1p.htm',
    zh: 'Mike Godfrey,15!/3 计数公式的单环双射证明,通式 8(C+E−1)!/(2C+E)。',
    en: 'Mike Godfrey — proof of the 15!/3 count via the single-circle bijection, general formula 8(C+E−1)!/(2C+E).' },
  { url: 'https://www.speedsolving.com/threads/square-one-can-be-solved-in-31-moves-in-face-turn-metric.67363/',
    zh: 'Shuang Chen(cs0x7f)2017-12-28,面转口径上帝之数 = 31 的穷举证明:完整分布、722GB 磁盘 BFS、对径 376 个。',
    en: 'Shuang Chen (cs0x7f) 2017-12-28 — proof that the face-turn God\'s number = 31: full distribution, 722 GB disk BFS, 376 antipodes.' },
  { url: 'https://github.com/cs0x7f/sq12phase',
    zh: 'Chen Shuang,sq12phase 参考求解器(Java,两阶段近最优 + 内置单阶段 IDA* 最优,~50 态/s)。',
    en: 'Chen Shuang — sq12phase reference solver (Java, two-phase near-optimal + embedded single-phase IDA* optimal, ~50 states/s).' },
  { url: 'https://github.com/thewca/wca-regulations/issues/364',
    zh: 'WCA 规则 issue #364:记录 TNoodle((5,2)=1)与 sq12phase((5,2)=2)的口径分歧,即本页 12c4 vs 面转之分。',
    en: 'WCA regulations issue #364: documents the TNoodle ((5,2)=1) vs sq12phase ((5,2)=2) metric discrepancy — the 12c4-vs-face-turn split.' },
  { url: 'https://www.worldcubeassociation.org/regulations/',
    zh: 'WCA 规则:12c4「(X,Y) 计 1,/ 计 1」、记号、≥11 步打乱,以及独立的 10f4+ 收尾错位口径。',
    en: 'WCA Regulations: 12c4 "(X,Y) = 1, / = 1", notation, ≥11-move scramble, and the separate 10f4+ misalignment metric.' },
  { url: 'https://www.speedsolving.com/threads/2gen-square-1-solver-by-ben1996123.49139/',
    zh: 'ben1996123,2-生成子群直径 43 / 44(turn 口径),注意:这不是整体上帝之数。',
    en: 'ben1996123 — 2-generator subgroup diameter 43 / 44 (turn metric). NOT the full-puzzle God\'s number.' },
];

export default function Sq1({ isZh }: { isZh: boolean; eventId?: string }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const metricRows: { m: typeof METRICS[keyof typeof METRICS]; single: string; dbl: string; slice: string }[] = [
    { m: METRICS.twist, single: '0', dbl: '0', slice: '1' },
    { m: METRICS.wca, single: '1', dbl: '1', slice: '1' },
    { m: METRICS.face, single: '1', dbl: '2', slice: '1' },
  ];

  return (
    <div className="god-sq1">
      {/* ── intro ──────────────────────────────────────────────── */}
      <p className="sq1-lead">
        {t(
          'Square-1 是 WCA 里唯一会变形的魔方。问「任意打乱最少几步能解」时,答案完全取决于你怎么数步——而它有三套计步口径。其中两套的上帝之数早已被穷举证明;第三套——偏偏是计时器和打乱程序实际用的那套——至今没被精确算出,但本站已把它从「夹在 13 与 31 之间」收窄到 26–27(只差 1)。',
          'Square-1 is the only shape-shifting puzzle in the WCA. Asking "how few moves solves any scramble" depends entirely on how you count moves — and it has three metrics. Two have God\'s numbers proven by exhaustive search; the third — the very one timers and scramblers actually use — has never been computed exactly, but this site has narrowed it from "somewhere between 13 and 31" down to 26–27 (just 1 apart).',
        )}
      </p>
      <div className="sq1-formula-block">
        <TeXBlock src={String.raw`D_{\text{twist}} = 13, \quad D_{\text{face}} = 31, \quad 26 \le D_{\text{WCA\,12c4}} \le 27`} />
        <div className="sq1-formula-cap">
          {t('三套度量下的直径:两套已证,第三套已收窄到 26–27。', 'Diameter under three metrics: two proven, the third narrowed to 26–27.')}
        </div>
      </div>

      <div className="sq1-highlights">
        <div className="sq1-hl-card">
          <div className="sq1-hl-num">13</div>
          <div className="sq1-hl-cap">{t('扭转口径上帝之数', "Twist-metric God's number")}</div>
          <div className="sq1-hl-sub">{t('已证 Masonjones 2005', 'Proven, Masonjones 2005')}</div>
        </div>
        <div className="sq1-hl-card">
          <div className="sq1-hl-num">31</div>
          <div className="sq1-hl-cap">{t('面转口径上帝之数', "Face-turn God's number")}</div>
          <div className="sq1-hl-sub">{t('已证 Chen 2017', 'Proven, Chen 2017')}</div>
        </div>
        <div className="sq1-hl-card is-open">
          <div className="sq1-hl-num" style={{ fontSize: '2.2rem' }}>26–27</div>
          <div className="sq1-hl-cap">{t('WCA 12c4 上帝之数', "WCA 12c4 God's number")}</div>
          <div className="sq1-hl-sub">{t('已收窄,精确值未解', 'Narrowed, exact value open')}</div>
        </div>
        <div className="sq1-hl-card is-neutral">
          <div className="sq1-hl-num" style={{ fontSize: '1.25rem' }}>15!/3</div>
          <div className="sq1-hl-cap">{t('态空间', 'State space')}</div>
          <div className="sq1-hl-sub">{STATE_SPACE.distinct}</div>
        </div>
      </div>

      {/* ── §1 puzzle & state space ────────────────────────────── */}
      <section className="sq1-section">
        <div className="sq1-section-num">{t('壹　魔方与态空间', 'I — The puzzle & its state space')}</div>
        <h2>{t('一个会变形的魔方', 'A puzzle that changes shape')}</h2>
        <p>
          {t(
            'Square-1 顶层和底层各被切成 8 块楔形:4 个 60° 的角块(像风筝)和 4 个 30° 的棱块。整个魔方共 8 角 8 棱,它们在上下层之间自由流动——这正是它变形的根源。中层只切成两半(一个二值翻转)。它只有两个转轴:顶/底层绕竖轴转,右半绕横轴翻 180°(记作 "/")。',
            'Each of Square-1\'s top and bottom layers is cut into 8 wedges: four 60° corners (kite-shaped) and four 30° edges. Across the puzzle there are 8 corners and 8 edges that flow freely between the layers — the source of its shape-shifting. The middle layer splits into just two halves (a binary flip). It has only two axes: top/bottom turn about the vertical axis; the right half flips 180° (written "/").',
          )}
        </p>
        <div className="sq1-callout">
          {t(
            '关键约束:"/" 切片只有在没有角块横跨切缝时才合法。因为角块有 60° 宽,任意层转常会让某个角挡住切缝——这就把「形状」(每层的楔形排布)和「排列」(每个槽里具体是哪块)清晰地分了开,所有正经求解器都吃这个结构。',
            'Key constraint: the "/" slice is legal only when no corner straddles the cut. Since a corner is 60° wide, an arbitrary turn often leaves a corner blocking the seam — cleanly separating "shape" (the wedge pattern of each layer) from "permutation" (which piece sits in each slot). Every serious solver exploits this.',
          )}
        </div>
        <p>
          {t(
            '因为角棱混流,态空间的数法比三阶微妙。最常引用的「真实位置数」是 15!/3 = 435,891,456,000——这是个与计步无关的纯计数。Godfrey 的优雅证明把所有块摆进一个 2C+E 槽的大圆环里,得到通式 8(C+E−1)!/(2C+E)。下面这个面板可以现算:',
            'Because corners and edges intermingle, counting is subtler than the 3×3. The most-quoted "true" count is 15!/3 = 435,891,456,000 — a metric-independent number. Godfrey\'s elegant proof lays every piece into one big ring of 2C+E slots, giving the general formula 8(C+E−1)!/(2C+E). Compute it live below:',
          )}
        </p>
        <Suspense fallback={<Loading />}><StateSpaceCalculator isZh={isZh} /></Suspense>
      </section>

      {/* ── §2 three move metrics ──────────────────────────────── */}
      <section className="sq1-section">
        <div className="sq1-section-num">{t('贰　三套计步口径', 'II — The three move metrics')}</div>
        <h2>{t('同一段解,三个步数', 'One solution, three move-counts')}</h2>
        <p>
          {t(
            '这是所有 SQ1 步数混乱的根源。记号大家通用:(x,y) 是顶层转 x 个 30° 单位、底层转 y 个,"/" 是右半 180° 翻。分歧只在层转怎么数——有一条铁律:"/" 在任何口径都恒计 1。',
            'This is the root of all SQ1 move-count confusion. The notation is shared: (x,y) turns the top layer x units of 30° and the bottom y, "/" flips the right half 180°. The disagreement is only about counting layer turns — with one invariant: "/" always counts 1 in every metric.',
          )}
        </p>
        <div className="sq1-table-wrap">
          <table className="sq1-table">
            <thead>
              <tr>
                <th>{t('口径', 'Metric')}</th>
                <th>{t('单层 (x,0)', 'Single (x,0)')}</th>
                <th>{t('双层 (x,y)', 'Double (x,y)')}</th>
                <th>{t('切片 /', 'Slice /')}</th>
                <th>{t('上帝之数', "God's #")}</th>
                <th>{t('状态', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {metricRows.map(({ m, single, dbl, slice }) => (
                <tr key={m.key}>
                  <td className="sq1-td-strong">{t(m.name.zh, m.name.en)}</td>
                  <td>{single}</td>
                  <td>{dbl}</td>
                  <td>{slice}</td>
                  <td className="sq1-td-strong">{m.god ?? m.godText ?? '?'}</td>
                  <td>
                    <span className={m.status === 'proven' ? 'sq1-badge-proven' : 'sq1-badge-open'}>
                      {m.status === 'proven' ? t('已证', 'Proven') : t('未解', 'Open')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sq1-callout">
          {t(
            '命名提醒:「12c4」只是 WCA 规则的条目号(第 12c4 条),指的就是「(X,Y) 计 1,/ 计 1」这套口径,不是某个算法。著名的「43/44」是 2-生成子群直径,也不是整体上帝之数。',
            'Naming note: "12c4" is just the WCA regulation number (clause 12c4) for the "(X,Y)=1, /=1" metric — not an algorithm. The famous "43/44" is a 2-generator subgroup diameter, also not the full God\'s number.',
          )}
        </div>
        <Suspense fallback={<Loading />}><MoveCountCalculator isZh={isZh} /></Suspense>
      </section>

      {/* ── §3 the two proven diameters ────────────────────────── */}
      <section className="sq1-section">
        <div className="sq1-section-num">{t('叁　已证的两套上帝之数', 'III — The two proven diameters')}</div>
        <h2>{t('13 与 31:都被穷举证明', '13 and 31: both proven exhaustively')}</h2>
        <p>
          {t(
            '扭转口径(只数切片)下,直径 = 13(不算中层 12),平均 10.615 步——Mike Masonjones 2005 年在一台 800MHz 机器上跑了约一年穷举出来。面转口径下,直径 = 31,平均 25.134 步——Shuang Chen(csTimer 作者)2017 年用 722GB 磁盘 BFS 完整搜索了 11,958,666,854,400 个可切状态,只有 376 个需要满 31 步。两套都是「搜到那个深度时所有状态都已被访问」,即上界 = 下界,是证明不是估计。',
            'In the twist metric (slices only) the diameter is 13 (12 ignoring the middle), average 10.615 — Mike Masonjones computed this exhaustively over ~a year on an 800 MHz machine in 2005. In the face-turn metric the diameter is 31, average 25.134 — Shuang Chen (csTimer\'s author) ran a complete 722 GB disk BFS over all 11,958,666,854,400 twistable states in 2017; only 376 need the full 31. Both are "every state reached by that depth" — upper bound equals lower bound, a proof not an estimate.',
          )}
        </p>
        <Suspense fallback={<Loading />}><DepthDistribution isZh={isZh} /></Suspense>
      </section>

      {/* ── §4 the open mystery ────────────────────────────────── */}
      <section className="sq1-section">
        <div className="sq1-section-num">{t('肆　未解之谜', 'IV — The unsolved mystery')}</div>
        <h2>{t('WCA 12c4 口径:已收窄到 26–27', 'WCA 12c4 metric: narrowed to 26–27')}</h2>
        <p>
          {t(
            '偏偏是最实用的那套口径——(X,Y) 计 1、/ 计 1,也就是计时器和打乱程序报的打乱长度——至今没有覆盖全状态空间的穷举结果。但它的区间已经被夹得很紧。上界 27 来自一个初等换算:任意态的 WCA 最优解 ≤ 2×(扭转最优)+ 1 ≤ 2×13 + 1 = 27(借 Masonjones 已证的扭转 13)。下界 26 是本站实证:我们对全部 125,605 条真实比赛打乱跑了可证 WCA 12c4 最优,最难的整整需要 26 步(仅凭纯理论的交替论证只能证到 25,真实见证把它顶到 26)。于是 26 ≤ D ≤ 27,只差 1。精确值是 26 还是 27 仍未解:要么找到一个真需 27 步的态(→ 27),要么对全状态空间跑一遍 BFS 证明它不存在(→ 26)。两端来源强度不同——下界是本站全量实证,上界是借来的已知结果加初等换算。',
            'The most practical metric — (X,Y)=1, /=1, the scramble length your timer reports — still has no whole-space exhaustive result. But its range is now pinned tight. The upper bound 27 comes from an elementary argument: any state\'s WCA-optimal solution is ≤ 2×(twist-optimal) + 1 ≤ 2×13 + 1 = 27 (borrowing Masonjones\' proven twist 13). The lower bound 26 is established here: we ran provably-WCA-12c4-optimal solves on all 125,605 real competition scrambles, and the hardest needs a full 26 (a purely theoretical alternation argument only reaches 25; a real witness pushes it to 26). So 26 ≤ D ≤ 27 — just 1 apart. Whether it is exactly 26 or 27 is still open: either find a state truly needing 27 (→ 27), or run a whole-space BFS proving none exists (→ 26). The two ends differ in strength — the lower bound is our full empirical result, the upper bound is a borrowed known result plus an elementary conversion.',
          )}
        </p>
        <Suspense fallback={<Loading />}><OpenProblemBracket isZh={isZh} /></Suspense>
      </section>

      {/* ── §5 how it gets solved ──────────────────────────────── */}
      <section className="sq1-section">
        <div className="sq1-section-num">{t('伍　怎么求解', 'V — How it gets solved')}</div>
        <h2>{t('两阶段近最优 vs 真最优', 'Two-phase near-optimal vs true optimal')}</h2>
        <p>
          {t(
            '实战引擎是 Chen 的 sq12phase:Kociemba 式两阶段——先把魔方归到方块形并修正宇称,再解排列。它快(约 50 态/s),但是近最优,不保证全局最少,因为最优路线未必恰好在「方块形」这个相位边界穿过。真最优要单阶段 IDA* 配大剪枝表,只有浅打乱在浏览器里可行。cubing.js、csTimer、TNoodle 用的都是这族两阶段引擎做随机态打乱。本站则专门为上帝之数造了一个 WCA 12c4 可证最优求解器(IDA* + 13GB 精确 phase-2 查表),对全部真实比赛打乱都能给出可证最少步——正是它把上面的下界顶到了 26。',
            'The workhorse is Chen\'s sq12phase: a Kociemba-style two-phase solver — first reduce to cube shape and fix parity, then solve the permutation. It is fast (~50 states/s) but near-optimal, not guaranteed minimal, because the optimal route need not pass through cube shape at the phase boundary. True optimal needs single-phase IDA* with a large pruning table, feasible in-browser only for shallow scrambles. cubing.js, csTimer and TNoodle all use this two-phase family for random-state scrambles. For the God\'s-number question this site built a dedicated provably-WCA-12c4-optimal solver (IDA* with a 13 GB exact phase-2 table) that returns the proven minimum for every real competition scramble — it is what pushed the lower bound above to 26.',
          )}
        </p>
        <Link href="/scramble/solver?event=sq1" className="sq1-cta">
          <Wrench size={22} />
          <div className="sq1-cta-body">
            <div className="sq1-cta-title">{t('在线试 SQ1 求解器', 'Try the SQ1 solver online')}</div>
            <div className="sq1-cta-desc">
              {t('粘贴打乱,得到近最优解,并同时显示三套口径的步数。', 'Paste a scramble, get a near-optimal solution with all three metric counts.')}
            </div>
          </div>
          <ExternalLink size={16} />
        </Link>
      </section>

      {/* ── references ─────────────────────────────────────────── */}
      <section className="sq1-section">
        <div className="sq1-section-num">{t('参考资料', 'References')}</div>
        <h2>{t('一手来源', 'Primary sources')}</h2>
        <ul className="sq1-refs">
          {REFS.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                {t(r.zh, r.en)} <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
