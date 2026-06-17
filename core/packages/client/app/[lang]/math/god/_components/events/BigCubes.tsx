'use client';

/**
 * /math/god?event={555|666|777} — God's number for the big cubes.
 *
 * One article specialized by eventId: the headline numbers, the state-space
 * formula, the bound table and the prose all switch on which N the reader
 * arrived at. The over-arching truth they share is asymptotic:
 *   Θ(N²/log N)  (Demaine, Demaine, Eisenstat, Lubiw, Winslow 2011).
 *
 * ACCURACY (verified against god_data.ts):
 *   5×5  |G| = 2.83×10⁷⁴   OBTM bounds 52 / 130  — community ESTIMATES
 *                          (lower: counting; upper: worst-case algorithm), NOT proven.
 *   6×6  |G| = 1.57×10¹¹⁶  OBTM ≥ 75 only        — no published upper bound.
 *   7×7  |G| = 1.95×10¹⁶⁰  OBTM ≥ 99 only        — no published upper bound.
 * Never invent an upper bound for 6×6 / 7×7. 7×7 has 218 total surface cubies
 * (212 movable). No exact diameter is known for ANY cube larger than 3×3.
 */
import { Suspense, lazy, useState } from 'react';
import Link from '@/components/AppLink';
import { Layers, AlertTriangle } from 'lucide-react';
import {
  EvHighlights, EvSection, EvCallout, EvRefs, EvStatStrip,
  TeX, TeXBlock, MathText, type HighlightCard, type RefItem, type StatItem,
} from './_shared';

const GrowthChart = lazy(() => import('../GrowthChart'));

/* ── per-N verified facts (ground truth = god_data.ts) ─────────────────── */

interface Spec {
  n: number;
  zh: string; en: string;
  states: string;          // scientific, render-safe string
  lower: number;           // OBTM lower bound (always present)
  upper: number | null;    // OBTM upper bound — null = none published
  metric: 'OBTM';
  /** cubie bookkeeping for the state-space prose */
  surface: number;         // total visible cubies on the surface
  movable: number;         // pieces that actually move (exclude fixed centres)
  /** Demaine band endpoints at this N (c * N^2 / log N, matching GrowthChart). */
  demaineLow: number;
  demaineHigh: number;
}

const SPECS: Record<string, Spec> = {
  '555': {
    n: 5, zh: '五阶', en: '5×5×5',
    states: '2.83 \\times 10^{74}',
    lower: 52, upper: 130, metric: 'OBTM',
    surface: 98, movable: 92,
    demaineLow: 15.54, demaineHigh: 31.07,
  },
  '666': {
    n: 6, zh: '六阶', en: '6×6×6',
    states: '1.57 \\times 10^{116}',
    lower: 75, upper: null, metric: 'OBTM',
    surface: 152, movable: 152,
    demaineLow: 20.10, demaineHigh: 40.19,
  },
  '777': {
    n: 7, zh: '七阶', en: '7×7×7',
    states: '1.95 \\times 10^{160}',
    lower: 99, upper: null, metric: 'OBTM',
    surface: 218, movable: 212,
    demaineLow: 25.18, demaineHigh: 50.36,
  },
};

const ALL_N: Spec[] = [SPECS['555'], SPECS['666'], SPECS['777']];

export default function BigCubes({ isZh, eventId }: { isZh: boolean; eventId?: string }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  // Specialize on eventId; default to 5×5 if an unexpected id slips through.
  const spec = (eventId && SPECS[eventId]) || SPECS['555'];

  /* ── headline cards ──────────────────────────────────────────────── */
  const cards: HighlightCard[] = [];
  if (spec.upper != null) {
    // 5×5 only: both bounds, both ESTIMATES (not proven).
    cards.push({
      num: <TeX src={String.raw`${spec.lower}\,\text{--}\,${spec.upper}`} />,
      cap: t(`${spec.metric} 上下界(估算)`, `${spec.metric} bounds (estimate)`),
      sub: t('下界:计数;上界:最坏情形算法', 'lower: counting; upper: worst-case algorithm'),
      tone: 'warn',
    });
  } else {
    // 6×6 / 7×7: lower bound only.
    cards.push({
      num: <TeX src={String.raw`\ge ${spec.lower}`} />,
      cap: t(`${spec.metric} 下界`, `${spec.metric} lower bound`),
      sub: t('计数论证;无公开上界', 'counting argument; no published upper'),
      tone: 'warn',
    });
  }
  cards.push({
    num: <TeX src={spec.states} />,
    cap: t('合法状态数 |G|', 'Reachable states |G|'),
    sub: t('精确直径未知', 'exact diameter unknown'),
    tone: 'wca',
  });
  cards.push({
    num: <TeX src={String.raw`\Theta\!\left(\tfrac{N^{2}}{\log N}\right)`} />,
    cap: t('N 阶渐近增长(已证)', 'N×N asymptotic (proven)'),
    sub: 'Demaine et al. 2011',
    tone: 'accent',
  });

  /* ── state-space strip ───────────────────────────────────────────── */
  const stateItems: StatItem[] = [
    { label: t('合法状态数', 'Reachable states'), value: <MathText>{`|G| = ${displayStates(spec)}`}</MathText> },
    { label: t('表面块总数', 'Surface cubies'), value: <span className="god-mono">{spec.surface}</span> },
    { label: t('可动块数', 'Movable pieces'), value: <span className="god-mono">{spec.movable}</span> },
  ];

  return (
    <>
      <EvHighlights cards={cards} />

      <EvCallout tone="warn" heading={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={15} />
          {t('先说清楚:没有精确解', 'Up front: there is no exact answer')}
        </span>
      }>
        {t(
          `三阶的上帝之数 20 是被穷举证明的;${spec.n} 阶不是。比三阶大的魔方,至今没有任何一个被算出过精确直径——状态太多,陪集框架在这个量级下不再可行。下面给出的全部是界(bounds),不是已证的等号。`,
          `The 3×3 God's number (20) was proven by exhaustive search; the ${spec.n}×${spec.n} has not been. No cube larger than 3×3 has ever had its exact diameter computed — there are simply too many states for the coset framework to scale. Everything below is a bound, not a proven equality.`,
        )}
      </EvCallout>

      {/* ── §1 group & state space ───────────────────────────────────── */}
      <EvSection
        title={t(`${spec.n} 阶的态空间`, `The ${spec.n}×${spec.n} state space`)}
        lead={t(
          `${spec.n} 阶有 ${spec.surface} 个表面小块,其中 ${spec.movable} 个真正参与置换;合法状态约 ${plainStates(spec)} 个。`,
          `The ${spec.n}×${spec.n} has ${spec.surface} surface cubies, ${spec.movable} of which actually permute; about ${plainStates(spec)} reachable states.`,
        )}
      >
        <EvStatStrip items={stateItems} />
        <p style={{ marginTop: '1rem' }}>
          {t(
            'NxN 魔方的群序按角块、棱块组、面心块分别计数后相乘,再除掉无法独立到达的朝向/置换约束。块的种类随 N 平方增长,所以状态数随 N 急剧暴涨:',
            'The N×N group order is the product of separate counts for corners, edge orbits and centre orbits, divided by the orientation/permutation parities that cannot be reached independently. The number of piece types grows like N², so the state count explodes:',
          )}
        </p>
        <TeXBlock src={String.raw`|G(2)| \approx 10^{6} \;\to\; |G(3)| \approx 10^{19} \;\to\; |G(${spec.n})| \approx ${spec.states}`} />
        <p>
          {t(
            `要有点感觉:可观测宇宙的原子数大约是 10^82。`,
            'For scale: the observable universe holds roughly 10^82 atoms.',
          )}{' '}
          {spec.n === 5 ? (
            <MathText>{t(
              '五阶的 2.83 × 10⁷⁴ 比那还少几个数量级,勉强算「亚宇宙」;',
              "The 5×5's 2.83 × 10⁷⁴ is a few orders short of that — barely sub-universal;",
            )}</MathText>
          ) : (
            <MathText>{t(
              `${spec.n} 阶的 ${spec.states.replace('\\times', '×').replace(/\^\{(\d+)\}/, '^$1')} 早已把这个数字远远甩在身后。`,
              `the ${spec.n}×${spec.n} long ago blew past it.`,
            )}</MathText>
          )}
        </p>
      </EvSection>

      {/* ── §2 the bounds & the move metric ─────────────────────────── */}
      <EvSection
        title={t('上帝之数:界,而非等号', "God's number: bounds, not equalities")}
        lead={t(
          '大魔方上界与下界各自的来历完全不同,理解它们就是理解「为什么没算出来」。',
          'For big cubes the upper and lower bounds come from completely different arguments — understanding them is understanding why no exact value exists.',
        )}
      >
        <p>
          {t(
            '度量用 OBTM(outer block turn metric / 外层块转):任意一次「拧某一组相邻外层」算 1 步——这是大魔方社区计步的通行口径,也是这些界引用的口径。',
            'The metric is OBTM (outer block turn metric): one turn of any group of adjacent outer layers counts as a single move — the convention big-cube counting uses, and the metric these bounds are quoted in.',
          )}
        </p>

        <div className="god-open-wrap" style={{ marginTop: '1rem' }}>
          {/* lower-bound card */}
          <div className="god-open-card">
            <div className="god-open-head">
              <h3>{t('下界', 'Lower bound')}</h3>
              <span className="god-open-bounds">
                <span className="god-open-lower">{spec.lower}</span>
                <span className="god-open-metric">{spec.metric}</span>
              </span>
            </div>
            <div className="god-open-row">
              <span className="god-open-row-label">{t('方法', 'Method')}</span>
              <span className="god-open-row-body">
                {t('计数论证', 'Counting argument')}
              </span>
            </div>
            <div className="god-open-row">
              <span className="god-open-row-label">{t('原理', 'Idea')}</span>
              <span className="god-open-row-body">
                {t(
                  '每个深度 d 内,合法的不同走法序列数有上限。若到深度 d 累积的序列数仍少于状态总数,就有状态够不着——于是直径必须 > d。把这个不等式推到极限,得到下界。',
                  'At each depth d the number of distinct legal sequences is capped. If the sequences reachable within depth d still number fewer than the states, some state is unreachable — so the diameter must exceed d. Pushing that inequality to its limit yields the lower bound.',
                )}
              </span>
            </div>
            <div className="god-open-row">
              <span className="god-open-row-label">{t('地位', 'Status')}</span>
              <span className="god-open-row-body">
                {spec.upper != null
                  ? t('社区估算(下界靠计数)', 'community estimate (counting)')
                  : t('社区计数下界', 'community counting bound')}
              </span>
            </div>
          </div>

          {/* upper-bound card — present ONLY for 5×5 */}
          {spec.upper != null ? (
            <div className="god-open-card">
              <div className="god-open-head">
                <h3>{t('上界', 'Upper bound')}</h3>
                <span className="god-open-bounds">
                  <span className="god-open-upper">{spec.upper}</span>
                  <span className="god-open-metric">{spec.metric}</span>
                </span>
              </div>
              <div className="god-open-row">
                <span className="god-open-row-label">{t('方法', 'Method')}</span>
                <span className="god-open-row-body">
                  {t('最坏情形算法', 'Worst-case algorithm')}
                </span>
              </div>
              <div className="god-open-row">
                <span className="god-open-row-label">{t('原理', 'Idea')}</span>
                <span className="god-open-row-body">
                  {t(
                    '取一个能解任意五阶的固定方法(归约成 3×3 再求解),统计它在最坏打乱下需要多少步。这给出「保证够用」的上界,但远非最优——真直径几乎肯定比 130 小得多。',
                    'Take a fixed method that solves any 5×5 (reduce to a 3×3 then solve), and bound how many moves it needs on the worst scramble. This gives an "always enough" ceiling, far from tight — the true diameter is almost certainly well below 130.',
                  )}
                </span>
              </div>
              <div className="god-open-row">
                <span className="god-open-row-label">{t('地位', 'Status')}</span>
                <span className="god-open-row-body">
                  {t('社区估算(上界靠算法)', 'community estimate (algorithm)')}
                </span>
              </div>
            </div>
          ) : (
            <div className="god-open-card" style={{ borderLeftColor: 'var(--god-text-mute)' }}>
              <div className="god-open-head">
                <h3>{t('上界', 'Upper bound')}</h3>
                <span className="god-open-bounds">
                  <span className="god-open-upper" style={{ fontSize: '1rem' }}>
                    {t('无', 'none')}
                  </span>
                </span>
              </div>
              <div className="god-open-row">
                <span className="god-open-row-label">{t('地位', 'Status')}</span>
                <span className="god-open-row-body">
                  {t(
                    `${spec.n} 阶没有公开的上帝之数上界。能找到的「200 多步」之类数字是某种具体方法的步数上限,不是被引用的 ${spec.metric} 直径界,本文不予采信。`,
                    `No upper bound on the ${spec.n}×${spec.n} God's number has been published. Figures like "200-something moves" you may find online are the move ceiling of one particular solving method, not a cited ${spec.metric} diameter bound — this article does not assert one.`,
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        {spec.upper != null && (
          <EvCallout tone="warn" heading={t('这是估算,不是证明', 'These are estimates, not a proof')}>
            <MathText>{t(
              '五阶的 52 / 130 都是社区计算出的估算值:52 来自计数下界,130 来自最坏情形算法上界。两者之间是 78 步的巨大缝隙,真实直径落在缝中的某处,但没人证明过它到底是几。',
              'The 5×5 values 52 / 130 are both community computational estimates: 52 from a counting lower bound, 130 from a worst-case algorithmic upper bound. The 78-move gap between them hides the true diameter somewhere inside — but nobody has proven what it is.',
            )}</MathText>
          </EvCallout>
        )}
      </EvSection>

      {/* ── §3 bespoke SVG: bounds per N + Demaine band ──────────────── */}
      <EvSection
        title={t('为什么大魔方算不动', "Why big cubes are out of reach")}
        lead={t(
          'Rokicki 在三阶上用的陪集 + 对称 + 集合覆盖框架,本质是把 4.3 × 10¹⁹ 个状态压进可枚举的陪集再逐个深搜。当状态数跳到 10⁷⁴、10¹¹⁶、10¹⁶⁰,任何陪集划分依然天文数字,磁盘 BFS 也无从落脚——所以四阶以上只剩两件事可做:卡界,和证渐近。',
          "Rokicki's coset + symmetry + set-cover framework for the 3×3 squeezes 4.3 × 10¹⁹ states into enumerable cosets, then deep-searches each. When the state count jumps to 10⁷⁴, 10¹¹⁶, 10¹⁶⁰, any coset partition is still astronomical and a disk BFS has nowhere to land — so above 4×4 only two things remain: tightening bounds, and proving the asymptotic.",
        )}
      >
        <BoundsByN isZh={isZh} focusN={spec.n} />

        <p style={{ marginTop: '1.25rem' }}>
          <MathText>{t(
            'Demaine、Demaine、Eisenstat、Lubiw 与 Winslow 在 2011 年(arXiv:1106.5736)证明:N 阶魔方的上帝之数渐近为 Θ(N²/log N)。上界来自一个能并行求解多个小块的算法,下界来自合法序列的计数——两端在量级上相遇,首次给出了对所有 N 都成立的紧渐近。注意这是「增长阶」的严证,不是任何具体 N 的精确直径。',
            'Demaine, Demaine, Eisenstat, Lubiw and Winslow (2011, arXiv:1106.5736) proved that the N×N God\'s number is asymptotically Θ(N²/log N). The upper bound comes from an algorithm that solves many small pieces in parallel; the lower bound from counting legal sequences — the two ends meet in order of magnitude, giving the first tight asymptotic valid for all N. Crucially this pins the growth rate, not the exact diameter at any single N.',
          )}</MathText>
        </p>
        <p>
          {t(
            `上图里 ${spec.n} 阶的渐近带覆盖约 ${spec.demaineLow.toFixed(0)}–${spec.demaineHigh.toFixed(0)}——这只是用示意常数画出的「增长形状」,锁的是量级而非具体数值;实际已知下界 ${spec.lower} 落在带子上方,提醒我们渐近只定增长阶,不定常数。`,
            `In the chart the ${spec.n}×${spec.n} asymptotic band spans about ${spec.demaineLow.toFixed(0)}–${spec.demaineHigh.toFixed(0)} — but that is only the growth shape drawn with illustrative constants; it pins the order of magnitude, not the value. The known lower bound ${spec.lower} actually sits above the band, a reminder that the asymptotic fixes the growth rate, not the constant.`,
          )}
        </p>
      </EvSection>

      {/* ── §4 NxN growth (reused interactive) ───────────────────────── */}
      <EvSection
        title={t('N 阶全景:状态与直径一起增长', 'The full N×N picture: states and diameter together')}
        lead={t(
          '把所有 N 放在一张图里:左轴是状态数(log₁₀),右轴是 OBTM 步数。已证直径只有 2、3 阶两个实心点,4–7 阶是界,8 阶往上纯属渐近外推。',
          'All N on one chart: left axis state count (log₁₀), right axis OBTM moves. Only N=2 and 3 have proven diameters (solid dots); 4–7 are bounds; 8 and up are pure asymptotic extrapolation.',
        )}
      >
        <Suspense fallback={<div className="god-loading">…</div>}>
          <GrowthChart isZh={isZh} />
        </Suspense>
        <p style={{ marginTop: '1rem' }}>
          {t('想看其它大魔方?', 'Want another big cube?')}{' '}
          {ALL_N.filter((s) => s.n !== spec.n).map((s, i, arr) => (
            <span key={s.n}>
              <Link href={`/math/god?event=${idOf(s.n)}`}>{t(`${s.zh}详解`, `${s.en} write-up`)}</Link>
              {i < arr.length - 1 ? t('、', ', ') : ''}
            </span>
          ))}
          {t('。三阶的精确直径见 ', '. For the proven 3×3 diameter see ')}
          <Link href="/math/god?event=333">{t('三阶详解', 'the 3×3 write-up')}</Link>
          {t('。', '.')}
        </p>
      </EvSection>

      <EvRefs refs={REFS(spec)} />
    </>
  );
}

/* ── bespoke responsive SVG: lower bar always, upper only for 5×5,
 *    plus the Demaine band, with a focused-N control ─────────────────── */
function BoundsByN({ isZh, focusN }: { isZh: boolean; focusN: number }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [focus, setFocus] = useState<number>(focusN);

  const W = 540, H = 300, PAD_L = 40, PAD_R = 16, PAD_T = 22, PAD_B = 40;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;

  // y scale fixed so 5×5's 130 fits with headroom; deterministic, no data deps.
  const yMax = 140;
  const yOf = (v: number) => PAD_T + innerH - (v / yMax) * innerH;
  const cols = ALL_N.length;
  const slot = innerW / cols;
  const xOf = (i: number) => PAD_L + slot * (i + 0.5);
  const barW = Math.min(46, slot * 0.42);

  const active = ALL_N.find((s) => s.n === focus) ?? ALL_N[0];

  return (
    <div className="god-growth-wrap">
      {/* focused-N control (chips) */}
      <div className="god-metric-tabs" style={{ marginBottom: 14 }}>
        {ALL_N.map((s) => (
          <button
            key={s.n}
            className={`god-metric-tab ${focus === s.n ? 'is-on' : ''}`}
            onClick={() => setFocus(s.n)}
            aria-pressed={focus === s.n}
          >
            {s.n}×{s.n}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxWidth: W, height: 'auto', display: 'block' }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t('5/6/7 阶 OBTM 上下界与 Demaine 渐近带', '5/6/7 OBTM bounds and Demaine asymptotic band')}
      >
        {/* horizontal gridlines + labels */}
        {[0, 35, 70, 105, 140].map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yOf(v)} y2={yOf(v)}
                  stroke="var(--god-grid)" strokeDasharray="3 4" />
            <text x={PAD_L - 6} y={yOf(v) + 3} fontSize="9.5" textAnchor="end" fill="var(--god-text-sub)">{v}</text>
          </g>
        ))}

        {/* Demaine band as a per-column shaded range */}
        {ALL_N.map((s, i) => (
          <rect key={`band-${s.n}`}
                x={xOf(i) - barW / 2 - 6} width={barW + 12}
                y={yOf(s.demaineHigh)} height={Math.max(2, yOf(s.demaineLow) - yOf(s.demaineHigh))}
                fill="var(--god-accent)" opacity={s.n === focus ? 0.18 : 0.08} rx="3" />
        ))}

        {/* lower-bound bars (always) */}
        {ALL_N.map((s, i) => {
          const isFocus = s.n === focus;
          return (
            <g key={`bar-${s.n}`}
               onClick={() => setFocus(s.n)} style={{ cursor: 'pointer' }}>
              {/* full-height hit target */}
              <rect x={xOf(i) - slot / 2} y={PAD_T} width={slot} height={innerH} fill="transparent" />
              {/* lower bound bar */}
              <rect x={xOf(i) - barW / 2} width={barW}
                    y={yOf(s.lower)} height={PAD_T + innerH - yOf(s.lower)}
                    fill="var(--god-warn)" opacity={isFocus ? 0.95 : 0.45} rx="2" />
              {/* lower value */}
              <text x={xOf(i)} y={yOf(s.lower) - 6} fontSize="12" fontWeight="700"
                    textAnchor="middle" fill="var(--god-warn)">
                ≥{s.lower}
              </text>
              {/* upper bound — ONLY when published (5×5) */}
              {s.upper != null && (
                <>
                  <line x1={xOf(i) - barW / 2 - 4} x2={xOf(i) + barW / 2 + 4}
                        y1={yOf(s.upper)} y2={yOf(s.upper)}
                        stroke="var(--god-text-sub)" strokeWidth="2.5" />
                  <line x1={xOf(i)} x2={xOf(i)}
                        y1={yOf(s.lower)} y2={yOf(s.upper)}
                        stroke="var(--god-text-sub)" strokeWidth="1" strokeDasharray="2 3" opacity="0.8" />
                  <text x={xOf(i)} y={yOf(s.upper) - 6} fontSize="11"
                        textAnchor="middle" fill="var(--god-text-sub)">
                    ≤{s.upper}
                  </text>
                </>
              )}
              {/* x label */}
              <text x={xOf(i)} y={H - PAD_B + 16} fontSize="11" textAnchor="middle"
                    fill={isFocus ? 'var(--god-text)' : 'var(--god-text-sub)'}
                    fontWeight={isFocus ? 700 : 400}>
                {s.n}×{s.n}
              </text>
              {/* "no upper" annotation */}
              {s.upper == null && (
                <text x={xOf(i)} y={H - PAD_B + 28} fontSize="8.5" textAnchor="middle" fill="var(--god-text-mute)">
                  {t('无上界', 'no upper')}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="god-growth-legend">
        <span><i style={{ background: 'var(--god-warn)' }} /> {t('已知 OBTM 下界', 'known OBTM lower bound')}</span>
        <span><i style={{ background: 'var(--god-text-sub)' }} /> {t('已发布上界(仅五阶)', 'published upper (5×5 only)')}</span>
        <span className="dashed"><i /> <TeX src={String.raw`\Theta(N^{2}/\log N)`} /> {t('渐近带', 'band')}</span>
      </div>

      <div className="god-growth-readout">
        <strong>{active.n}×{active.n}:</strong>{' '}
        {active.upper != null ? (
          <><TeX src={String.raw`D \in [${active.lower},\, ${active.upper}]`} /> {active.metric}
            {' — '}{t('两端皆估算', 'both ends estimated')}</>
        ) : (
          <><TeX src={String.raw`D \ge ${active.lower}`} /> {active.metric}
            {' — '}{t('无公开上界', 'no published upper bound')}</>
        )}
        {' — '}{t('Demaine 渐近', 'Demaine asymptotic')} ≈ {active.demaineLow.toFixed(0)}–{active.demaineHigh.toFixed(0)}
      </div>

      <p className="god-growth-readout" style={{ background: 'transparent', padding: '8px 0 0', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--god-text-mute)', fontSize: '0.8rem' }}>
        <Layers size={13} />
        {t('点击任一组切换焦点。六阶/七阶没有上界栏,因为从未有人公开过。', 'Click any group to switch focus. 6×6/7×7 show no upper cap because none has ever been published.')}
      </p>
    </div>
  );
}

/* ── helpers (all local, deterministic) ────────────────────────────── */

function idOf(n: number): string {
  return n === 5 ? '555' : n === 6 ? '666' : '777';
}

/** TeX-safe state string for inline KaTeX. */
function displayStates(s: Spec): string {
  return s.states;
}

/** Plain-text (MathText-parsable) state string for prose leads. */
function plainStates(s: Spec): string {
  // e.g. "2.83 \\times 10^{74}" -> "2.83 × 10⁷⁴"
  const supMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  };
  return s.states
    .replace('\\times', '×')
    .replace(/\^\{(\d+)\}/, (_m, d: string) => d.split('').map((c) => supMap[c] ?? c).join(''))
    .replace(/\s+/g, ' ')
    .trim();
}

function REFS(spec: Spec): RefItem[] {
  const base: RefItem[] = [
    {
      url: 'https://arxiv.org/abs/1106.5736',
      zh: 'Demaine, Demaine, Eisenstat, Lubiw, Winslow 2011:证明 N 阶魔方上帝之数渐近为 Θ(N²/log N)(上界用并行求解算法,下界用合法序列计数)。',
      en: 'Demaine, Demaine, Eisenstat, Lubiw, Winslow 2011 — proof that the N×N God\'s number is Θ(N²/log N) (upper via a parallel solving algorithm, lower via legal-sequence counting).',
    },
  ];
  if (spec.n === 5) {
    base.unshift({
      url: 'https://en.wikipedia.org/wiki/Professor%27s_Cube',
      zh: '维基百科「Professor\'s Cube」:五阶状态数 2.83 × 10⁷⁴,以及社区给出的 OBTM 上下界 52 / 130(估算,非已证直径)。',
      en: 'Wikipedia — Professor\'s Cube: 5×5 state count 2.83 × 10⁷⁴ and the community OBTM bounds 52 / 130 (estimates, not a proven diameter).',
    });
  } else if (spec.n === 6) {
    base.unshift({
      url: 'https://en.wikipedia.org/wiki/V-Cube_6',
      zh: '维基百科「V-Cube 6」:六阶状态数 1.57 × 10¹¹⁶,以及社区计数得到的 OBTM 下界 75(无公开上界)。',
      en: 'Wikipedia — V-Cube 6: 6×6 state count 1.57 × 10¹¹⁶ and the community OBTM lower bound 75 (no published upper bound).',
    });
  } else {
    base.unshift({
      url: 'https://en.wikipedia.org/wiki/V-Cube_7',
      zh: '维基百科「V-Cube 7」:七阶状态数 1.95 × 10¹⁶⁰,以及社区计数得到的 OBTM 下界 99(无公开上界)。',
      en: 'Wikipedia — V-Cube 7: 7×7 state count 1.95 × 10¹⁶⁰ and the community OBTM lower bound 99 (no published upper bound).',
    });
  }
  base.push({
    url: 'https://www.cube20.org/',
    zh: 'cube20.org:三阶上帝之数 = 20 的证明主页,可对照大魔方为何无法套用同一陪集框架。',
    en: 'cube20.org — the proof that the 3×3 God\'s number is 20; useful for contrasting why the same coset framework does not scale to big cubes.',
  });
  return base;
}
