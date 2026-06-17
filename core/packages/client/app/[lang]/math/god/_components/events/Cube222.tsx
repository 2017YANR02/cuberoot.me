'use client';

/**
 * /math/god?event=222 — the Pocket Cube (2×2×2) God's number write-up.
 *
 *   intro + headline cards (11 HTM / 14 QTM, |G|=3,674,160, antipodes)
 *   §1 the group & state space (7! x 3^6 derivation, fixed-corner gauge)
 *   §2 the two proven diameters + bespoke depth-distribution SVG (HTM/QTM toggle, hover)
 *   §3 how it was computed: full BFS, Jerry Bryan 1993
 *   §4 antipodes & why 2×2 is the textbook God's-number example
 *   live in-browser BFS (reused Bfs2x2Demo) + references
 *
 * Every number is taken from OEIS A079761 (HTM) / A079762 (QTM), both of which
 * sum to 3,674,160; the verified facts list 11/14, antipodes 2644/276,
 * averages 8.7556/10.666, |G| = 7! x 3^6.  No subgroup diameters are presented
 * as the puzzle's God's number.
 */
import { Suspense, lazy, useMemo, useState } from 'react';
import { Boxes, Calculator } from 'lucide-react';
import {
  EvHighlights, EvSection, EvCallout, EvRefs, EvStatStrip,
  TeX, TeXBlock, MathText, tr,
  type HighlightCard, type RefItem, type StatItem,
} from './_shared';

const Bfs2x2Demo = lazy(() => import('../Bfs2x2Demo'));

/* ── verified depth distributions (OEIS A079761 / A079762) ───────────── */
/* index = distance from solved; value = number of positions at that distance. */
const HTM_DIST = [1, 9, 54, 321, 1847, 9992, 50136, 227536, 870072, 1887748, 623800, 2644];
const QTM_DIST = [1, 6, 27, 120, 534, 2256, 8969, 33058, 114149, 360508, 930588, 1350852, 782536, 90280, 276];

type MetricKey = 'htm' | 'qtm';

const METRIC: Record<MetricKey, {
  dist: number[]; diameter: number; antipodes: number; avg: string;
  name: { zh: string; en: string };
}> = {
  htm: {
    dist: HTM_DIST, diameter: 11, antipodes: 2644, avg: '8.7556',
    name: { zh: '半转度量 HTM', en: 'Half-turn metric (HTM)' },
  },
  qtm: {
    dist: QTM_DIST, diameter: 14, antipodes: 276, avg: '10.666',
    name: { zh: '四分之一转度量 QTM', en: 'Quarter-turn metric (QTM)' },
  },
};

const fmt = (n: number) => n.toLocaleString('en-US');

const REFS: RefItem[] = [
  { url: 'https://www.jaapsch.net/puzzles/cube2.htm',
    zh: 'Jaap Scherphuis,Pocket Cube(2×2)主页:态空间 7! × 3⁶ = 3,674,160 的推导、固定角块的规约,以及 HTM = 11 / QTM = 14 两套完整距离分布表。',
    en: 'Jaap Scherphuis — Pocket Cube (2×2) page: derivation of |G| = 7! × 3⁶ = 3,674,160, the fixed-corner gauge, and the full HTM = 11 / QTM = 14 distance-distribution tables.' },
  { url: 'https://oeis.org/A079761',
    zh: 'OEIS A079761:2×2 在半转度量下到复原态距离恰为 n 的位置数(n = 0..11),逐项相加 = 3,674,160,其中距离 11 的对径态有 2644 个。',
    en: 'OEIS A079761 — number of 2×2 positions at exactly distance n in the half-turn metric (n = 0..11); the column sums to 3,674,160, with 2644 antipodes at distance 11.' },
  { url: 'https://oeis.org/A079762',
    zh: 'OEIS A079762:2×2 在四分之一转度量下的距离分布(n = 0..14),同样合计 3,674,160,对径态 276 个。',
    en: 'OEIS A079762 — the same distribution in the quarter-turn metric (n = 0..14); also sums to 3,674,160, with 276 antipodes.' },
  { url: 'https://cube20.org/',
    zh: 'cube20.org:三阶上帝之数 = 20 的官方站点,把 2×2 的完整 BFS 列为"小到可在个人电脑上穷举"的对照案例。',
    en: 'cube20.org — the canonical 3×3 God\'s-number-is-20 site; cites the 2×2 full BFS as the small comparison case fully enumerable on a personal computer.' },
];

export default function Cube222({ isZh }: { isZh: boolean; eventId?: string }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [metric, setMetric] = useState<MetricKey>('htm');
  const [hover, setHover] = useState<number | null>(null);

  const M = METRIC[metric];

  /* ── headline cards ─────────────────────────────────────────────── */
  const cards: HighlightCard[] = [
    { num: '11', cap: t('上帝之数 HTM', "God's number (HTM)"),
      sub: t('已证 Jerry Bryan 1993', 'Proven, Jerry Bryan 1993'), tone: 'accent' },
    { num: '14', cap: t('上帝之数 QTM', "God's number (QTM)"),
      sub: t('已证 同次完整 BFS', 'Proven, same full BFS'), tone: 'accent' },
    { num: <TeX src={String.raw`7!\cdot 3^{6}`} />, cap: t('合法状态数', 'Reachable states'),
      sub: <span className="god-mono">3,674,160</span>, tone: 'wca' },
    { num: '2644', cap: t('对径态 HTM', 'Antipodes (HTM)'),
      sub: t('距离恰为 11 的位置', 'positions at distance 11'), tone: 'accent' },
  ];

  /* ── bespoke SVG geometry ───────────────────────────────────────── */
  const VBW = 720, VBH = 320;
  const padL = 16, padR = 16, padT = 14, padB = 46;
  const plotW = VBW - padL - padR;
  const plotH = VBH - padT - padB;
  const bars = M.dist;
  const maxV = Math.max(...bars);
  const barGap = 6;
  const barW = (plotW - barGap * (bars.length - 1)) / bars.length;
  // log-scaled height so the 1 → 1.8M range stays readable; floor of 1.
  const hOf = (v: number) => {
    const lv = Math.log10(Math.max(v, 1) + 1);
    const lmax = Math.log10(maxV + 1);
    return Math.max(2, (lv / lmax) * plotH);
  };

  const total = useMemo(() => bars.reduce((a, b) => a + b, 0), [bars]);
  const hv = hover != null && hover < bars.length ? hover : null;

  return (
    <>
      <EvHighlights cards={cards} />

      {/* ── §1 group & state space ───────────────────────────────── */}
      <EvSection
        title={t('壹　这个魔方与它的态空间', 'I — The puzzle and its state space')}
        lead={t(
          '2×2(口袋方块)只有 8 个角块,没有棱块、没有中心块——它本质上就是三阶的"八个角"。正因如此,它是上帝之数最干净的教科书例子:整张状态图小到可以在一台普通电脑上几秒内完整 BFS。',
          'The 2×2 (Pocket Cube) is nothing but eight corner cubies — no edges, no centres. It is effectively "the eight corners of a 3×3." That makes it the cleanest textbook example of a God\'s number: the whole state graph is small enough to BFS exhaustively on an ordinary laptop in seconds.',
        )}
      >
        <p>
          <MathText>{t(
            '把任一个角固定当作不动的参照系(2×2 没有中心块,所以整体朝向本身不算"打乱"),剩下 7 个角可以任意排列,得到 7! 种排列;它们各自有 3 种朝向,但末位角的朝向被前 6 个角的朝向之和锁定(角朝向总和守恒,mod 3),所以独立朝向只有 3^6 种。两者相乘:',
            'Pin one corner as a fixed frame of reference (the 2×2 has no centres, so a whole-cube rotation is not a "scramble"). The remaining 7 corners permute freely — 7! arrangements — and each has 3 orientations, but the last corner\'s twist is forced by the other six (corner twist sums to 0 mod 3). So the independent orientations number 3^6, and:',
          )}</MathText>
        </p>
        <TeXBlock src={String.raw`|G| \;=\; 7!\cdot 3^{6} \;=\; 5040 \times 729 \;=\; 3{,}674{,}160`} />
        <EvStatStrip items={[
          { label: t('合法状态数', 'Reachable states'), value: <MathText>{'|G| = 3{,}674{,}160'}</MathText> },
          { label: t('排列部分', 'Permutation part'), value: <TeX src={String.raw`7! = 5040`} /> },
          { label: t('朝向部分', 'Orientation part'), value: <TeX src={String.raw`3^{6} = 729`} /> },
        ] satisfies StatItem[]} />
        <EvCallout tone="info" heading={t('为什么固定一个角', 'Why fix one corner')}>
          {t(
            '如果不固定参照角,同一个"打乱"会因为整体旋转被重复计成 24 份(立方体有 24 种朝向),状态数会虚高到 3,674,160 × 24。固定一个角(连同它周围的取景)消掉这 24 重冗余,得到的才是真正彼此不同的求解局面数——也是上帝之数所基于的图。',
            'Without a fixed reference corner, the same scramble would be counted 24 times over (a cube has 24 orientations), inflating the count to 3,674,160 × 24. Fixing one corner (and the framing around it) removes that 24-fold redundancy, leaving the genuinely distinct solving positions — the graph the God\'s number is measured on.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §2 the two proven diameters + bespoke SVG ────────────── */}
      <EvSection
        title={t('贰　两套已证直径:11 与 14', 'II — Two proven diameters: 11 and 14')}
        lead={t(
          '怎么数步会改变答案。半转度量(HTM)里,任意单层 90° 或 180° 转都算 1 步,直径是 11。四分之一转度量(QTM)里 180° 转拆成两个 90°,所以同一张图的直径变成 14。两套都不是估计:它们是把全部 3,674,160 个状态按距离分桶后,最深那一桶非空时的桶号——上界与下界在同一个数上相遇。',
          'How you count moves changes the answer. In the half-turn metric (HTM) any single-layer 90° or 180° turn counts as 1, and the diameter is 11. In the quarter-turn metric (QTM) a 180° turn is two 90° turns, so the diameter of the same graph becomes 14. Neither is an estimate: bucket all 3,674,160 states by distance and the deepest non-empty bucket gives the diameter exactly — upper and lower bound coincide.',
        )}
      >
        <div className="god-dist-wrap">
          <div className="god-dist-tabs" role="tablist">
            {(['htm', 'qtm'] as MetricKey[]).map((k) => (
              <button key={k} role="tab" aria-selected={metric === k}
                      className={`god-metric-tab ${metric === k ? 'is-on' : ''}`}
                      onClick={() => { setMetric(k); setHover(null); }}>
                {tr(METRIC[k].name)}
              </button>
            ))}
          </div>

          <div className="god-dist-summary">
            <div>
              <div className="god-dist-stat-label">{t('直径', 'Diameter')}</div>
              <div className="god-dist-stat-num">{M.diameter}<span>{metric === 'htm' ? 'HTM' : 'QTM'}</span></div>
            </div>
            <div>
              <div className="god-dist-stat-label">{t('平均距离', 'Average distance')}</div>
              <div className="god-dist-stat-num">{M.avg}</div>
            </div>
            <div>
              <div className="god-dist-stat-label">{t('对径态', 'Antipodes')}</div>
              <div className="god-dist-stat-num">{fmt(M.antipodes)}</div>
            </div>
          </div>

          {/* bespoke responsive bar chart — hover any bar to read its count */}
          <svg className="god-dist-svg" viewBox={`0 0 ${VBW} ${VBH}`}
               width="100%" style={{ maxWidth: VBW }}
               role="img"
               aria-label={t('2×2 距离分布柱状图', '2×2 distance distribution bar chart')}>
            {/* baseline */}
            <line x1={padL} y1={padT + plotH} x2={VBW - padR} y2={padT + plotH}
                  stroke="var(--god-grid)" strokeWidth={1} />
            {bars.map((v, i) => {
              const h = hOf(v);
              const x = padL + i * (barW + barGap);
              const y = padT + plotH - h;
              const on = hv === i;
              const isAnti = i === bars.length - 1;
              return (
                <g key={i}
                   onMouseEnter={() => setHover(i)}
                   onMouseLeave={() => setHover((p) => (p === i ? null : p))}
                   onFocus={() => setHover(i)}
                   onBlur={() => setHover((p) => (p === i ? null : p))}
                   tabIndex={0}
                   style={{ cursor: 'pointer', outline: 'none' }}>
                  {/* full-height hit target */}
                  <rect x={x} y={padT} width={barW} height={plotH} fill="transparent" />
                  <rect x={x} y={y} width={barW} height={h} rx={2}
                        fill={isAnti
                          ? 'var(--god-warn)'
                          : on ? 'var(--god-accent)' : 'var(--god-accent-soft)'}
                        stroke={on ? 'var(--god-accent)' : isAnti ? 'var(--god-warn)' : 'var(--god-border)'}
                        strokeWidth={1} />
                  {/* depth label */}
                  <text x={x + barW / 2} y={padT + plotH + 16} textAnchor="middle"
                        fontSize={12} fill={on ? 'var(--god-accent)' : 'var(--god-text-mute)'}
                        fontWeight={on ? 700 : 400} style={{ fontVariantNumeric: 'tabular-nums' }}>{i}</text>
                </g>
              );
            })}
            {/* axis caption */}
            <text x={padL} y={VBH - 8} fontSize={12} fill="var(--god-text-mute)">
              {t('← 距离复原态的步数(对数高度)', '← moves from solved (log-scaled height)')}
            </text>
          </svg>

          <div className="god-dist-readout">
            {hv != null ? (
              <span>
                <b style={{ color: hv === bars.length - 1 ? 'var(--god-warn)' : 'var(--god-accent)' }}>
                  {fmt(bars[hv])}
                </b>{' '}
                {t(`个状态恰好需要 ${hv} 步(${metric === 'htm' ? 'HTM' : 'QTM'})`,
                   `states are exactly ${hv} ${metric === 'htm' ? 'HTM' : 'QTM'} move${hv === 1 ? '' : 's'} from solved`)}
                {hv === bars.length - 1 && t('——这就是对径态(最难的局面)。', ' — these are the antipodes (the hardest positions).')}
                {'  '}<span style={{ color: 'var(--god-text-mute)' }}>{(100 * bars[hv] / total).toFixed(hv >= bars.length - 1 ? 4 : 1)}%</span>
              </span>
            ) : (
              <span className="god-bfs-stat">
                {t('悬停或聚焦任一柱读取该深度的精确状态数;最右侧高亮柱是对径态。',
                   'Hover or focus any bar to read the exact count at that depth; the highlighted rightmost bar is the antipode set.')}
              </span>
            )}
          </div>

          <p className="god-dist-caption">
            <MathText>{t(
              `数据取自 OEIS ${metric === 'htm' ? 'A079761' : 'A079762'}:逐深度的位置数,合计正好是 3,674,160。注意分布在到达直径前一步达到峰值(${metric === 'htm' ? 'HTM 在距离 9 有 1,887,748 个,占一半以上' : 'QTM 在距离 11 有 1,350,852 个'}),然后陡降——绝大多数局面都"差不多一样难",真正的最难局面少得出奇。`,
              `Counts are from OEIS ${metric === 'htm' ? 'A079761' : 'A079762'}: positions per depth, summing to exactly 3,674,160. The distribution peaks just short of the diameter (${metric === 'htm' ? 'HTM has 1,887,748 at distance 9 — over half the cube' : 'QTM has 1,350,852 at distance 11'}) then collapses — almost every position is "about equally hard," and the genuinely hardest ones are strikingly rare.`,
            )}</MathText>
          </p>
        </div>
      </EvSection>

      {/* ── §3 how it was computed ───────────────────────────────── */}
      <EvSection
        title={t('叁　它是怎么算出来的', 'III — How it was computed')}
        lead={t(
          '不需要陪集、不需要对称压缩、也不需要超算。2×2 的图小到可以直接做一次完整的广度优先搜索(BFS):从复原态出发,逐层扩展,记录每个状态首次被访问时的深度。Jerry Bryan 在 1993 年就这样穷举了全部 3,674,160 个状态,给出 HTM = 11、QTM = 14。',
          'No cosets, no symmetry compression, no supercomputer. The 2×2 graph is small enough for a single complete breadth-first search (BFS): start from solved, expand layer by layer, record each state\'s depth at first visit. Jerry Bryan did exactly this in 1993, enumerating all 3,674,160 states and establishing HTM = 11, QTM = 14.',
        )}
      >
        <p>
          <MathText>{t(
            'BFS 同时给出上界和下界,所以结果是证明而非估计:每个状态都被访问到(图是连通的,7 个角块的偶置换 + mod-3 朝向守恒正好覆盖整个可达群),最深一层的深度就是直径。整张距离分布表(上一节那张图)是这次搜索的副产物——它本身就是"恰好 d 步可解的局面有几个"的完整账本。',
            'BFS gives the upper and lower bound at once, so the result is a proof, not an estimate: every state is reached (the graph is connected — even permutations of 7 corners with mod-3 twist conservation cover the whole reachable group), and the deepest layer\'s depth is the diameter. The full distance table (the chart above) is a by-product of that search — a complete ledger of how many positions are solvable in exactly d moves.',
          )}</MathText>
        </p>
        <EvCallout tone="accent" heading={t('为什么 HTM 和 QTM 直径不同', 'Why HTM and QTM diameters differ')}>
          {t(
            '同一张图,不同的边权。HTM 把每个 90° 和 180° 转都算成一条长度为 1 的边;QTM 只承认 90° 转为 1,180° 转得走两步。少了"免费的半转"这条捷径,最远的状态自然要走更多 90° 步——直径从 11 涨到 14,平均距离从 8.7556 涨到 10.666。两套都是同一次穷举里读出的。',
            'Same graph, different edge weights. HTM makes every 90° and 180° turn an edge of length 1; QTM only grants length 1 to 90° turns, charging a 180° turn two steps. Without the "free half-turn" shortcut, the farthest states need more 90° moves — the diameter rises from 11 to 14, the mean from 8.7556 to 10.666. Both are read off the very same enumeration.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §4 antipodes & live BFS ──────────────────────────────── */}
      <EvSection
        title={t('肆　对径态,以及在你浏览器里重跑一遍', 'IV — Antipodes, and re-running it in your browser')}
        lead={t(
          '"对径态"(antipodes)是距离复原态最远的局面。2×2 在 HTM 下只有 2644 个对径态(全部恰好 11 步),在 QTM 下仅 276 个(恰好 14 步)。它们不到全部状态的千分之一——这也是为什么真正"最难"的打乱在实战里几乎遇不到。下面的演示会在你的浏览器里现场跑一遍这次 BFS,实时画出与上方完全一致的分布,并报出 2644 这个对径数。',
          'The "antipodes" are the positions farthest from solved. The 2×2 has just 2644 of them in HTM (all exactly 11 moves) and only 276 in QTM (exactly 14). That is well under one-tenth of one percent of all states — which is why a genuinely worst-case scramble is almost never seen in practice. The demo below runs that BFS live in your browser, drawing the same distribution and reporting the 2644 antipodes.',
        )}
      >
        <Suspense fallback={<div className="god-loading">{t('加载现场 BFS……', 'Loading live BFS…')}</div>}>
          <Bfs2x2Demo isZh={isZh} />
        </Suspense>

        <EvCallout tone="info" heading={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Boxes size={16} /> {t('和大魔方对比', 'Versus the bigger cubes')}
          </span>
        }>
          {t(
            '2×2 的 367 万状态用 BFS 几秒搞定;三阶的 4.3 × 10¹⁹ 个状态做不到全图 BFS,得靠 Kociemba 陪集 + 对称压缩 + 约 35 CPU-年才证出直径 20。同样是"角块的八个朝向与排列",规模差了十三个数量级——这正是为什么 2×2 成了讲清"上帝之数"概念时的首选例子。',
            'The 2×2\'s 3.67M states fall to BFS in seconds; the 3×3\'s 4.3 × 10¹⁹ states cannot be BFS\'d whole and needed Kociemba cosets + symmetry compression + ~35 CPU-years to prove the diameter is 20. Same eight-corner orientation-and-permutation idea, thirteen orders of magnitude apart — exactly why the 2×2 is the example of choice for explaining what a God\'s number even is.',
          )}{' '}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--god-text-mute)' }}>
            <Calculator size={13} /> 7! × 3⁶ = 3,674,160
          </span>
        </EvCallout>
      </EvSection>

      <EvRefs refs={REFS} />
    </>
  );
}
