'use client';

/**
 * /math/god?event=333fm — Fewest Moves Challenge (FMC).
 *
 * FMC lives in the *same* group as the 3×3, so its hard ceiling is exactly the
 * 3×3 God's number: 20 HTM (cube20.org, 2010). The article reframes that proven
 * diameter as a *human* problem — a solver gets one hour and (almost) never finds
 * the optimum. We reuse the 3×3 optimal-length distribution (which IS the FMC
 * difficulty curve) and add a bespoke slider that places "your move count" on the
 * percentile of random optimal solutions, against the FMC record landmarks.
 *
 *   highlights: 20 ceiling, single WR 16, mean-of-3 WR, 4.3×10¹⁹ states
 *   §1 same group, hard ceiling 20
 *   §2 the distribution IS the FMC curve  → DistanceDistribution (reused)
 *   §3 your move count vs the optimum     → bespoke SVG slider
 *   §4 why humans miss it (the 1-hour gap)
 *   references
 */
import { Suspense, lazy, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { Trophy, Hand, Clock, Target } from 'lucide-react';
import {
  EvHighlights, EvSection, EvCallout, EvRefs, EvStatStrip,
  TeX, TeXBlock, MathText, type HighlightCard, type RefItem, type StatItem,
} from './_shared';

const DistanceDistribution = lazy(() => import('../DistanceDistribution'));

/* ── ground-truth optimal-length distribution (cube20.org) ────────────
   d=0..15 exact counts, d=16..19 sum-constrained estimates, d=20 the
   antipode count. Mirrors DistanceDistribution.ROWS — used here only to
   compute the cumulative percentile for the slider. */
const DIST: { d: number; count: number }[] = [
  { d: 0, count: 1 },
  { d: 1, count: 18 },
  { d: 2, count: 243 },
  { d: 3, count: 3_240 },
  { d: 4, count: 43_239 },
  { d: 5, count: 574_908 },
  { d: 6, count: 7_618_438 },
  { d: 7, count: 100_803_036 },
  { d: 8, count: 1_332_343_288 },
  { d: 9, count: 17_596_479_795 },
  { d: 10, count: 232_248_063_316 },
  { d: 11, count: 3_063_288_809_012 },
  { d: 12, count: 40_374_425_656_248 },
  { d: 13, count: 531_653_418_284_628 },
  { d: 14, count: 6_989_320_578_825_358 },
  { d: 15, count: 9.1365146187124313e16 },
  { d: 16, count: 1.1e18 },
  { d: 17, count: 1.2e19 },
  { d: 18, count: 2.9e19 },
  { d: 19, count: 1.5e18 },
  { d: 20, count: 4.9e8 },
];
const TOTAL = 4.3252003274489856e19;

/** Cumulative fraction of random states whose optimal length is ≤ d. */
function cumLeq(d: number): number {
  let acc = 0;
  for (const r of DIST) { if (r.d <= d) acc += r.count; }
  return Math.min(1, acc / TOTAL);
}

export default function Fmc({ isZh }: { isZh: boolean; eventId?: string }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  /* slider: a hypothetical human FMC result, 16..40 HTM */
  const [moves, setMoves] = useState(28);

  const cards: HighlightCard[] = [
    {
      num: 20,
      cap: t('HTM 上帝之数(硬上限)', "God's number (hard ceiling), HTM"),
      sub: t('已证 2010', 'Proven 2010'),
      tone: 'accent',
    },
    {
      num: 16,
      cap: t('FMC 单次世界纪录', 'FMC single world record'),
      sub: t('人类极限,非典型', 'Human peak, atypical'),
      tone: 'wca',
    },
    {
      num: <TeX src={String.raw`\approx 17\text{–}19`} />,
      cap: t('随机态最优步数(>99%)', 'Optimal length of a random state (>99%)'),
      sub: t('真实 FMC 打乱难度', 'The real FMC scramble difficulty'),
      tone: 'warn',
    },
    {
      num: <TeX src={String.raw`4.3252 \times 10^{19}`} />,
      cap: t('合法状态数(与三阶同群)', 'Reachable states (same group as 3×3)'),
      sub: t('43,252,003,274,489,856,000', '43,252,003,274,489,856,000'),
      tone: 'accent',
    },
  ];

  /* slider derived values */
  const slider = useMemo(() => {
    // fraction of random states solvable in <= moves moves
    const m = Math.min(20, moves);
    const frac = cumLeq(m);
    // headroom above the proven ceiling
    const overCeiling = moves - 20;
    return { frac, overCeiling };
  }, [moves]);

  const refs: RefItem[] = [
    {
      url: 'https://www.cube20.org/',
      zh: 'cube20.org(Rokicki, Kociemba, Davidson, Dethridge):三阶 HTM 直径 = 20 的证明主页,陪集框架、约 35 CPU-年、Google 算力。',
      en: 'cube20.org (Rokicki, Kociemba, Davidson, Dethridge): the proof that the 3×3 HTM diameter = 20 — coset framework, ~35 CPU-years on Google hardware.',
    },
    {
      url: 'https://www.cube20.org/qtm/',
      zh: 'cube20.org/qtm:四分之一转(QTM)度量下直径 = 26 的证明(2014,Ohio 超算 ~29 CPU-年);FMC 比赛计的是 HTM,故上限仍是 20。',
      en: 'cube20.org/qtm: the QTM diameter = 26 proof (2014, ~29 CPU-years at the Ohio Supercomputer Center). FMC is scored in HTM, so its ceiling stays 20.',
    },
    {
      url: 'https://epubs.siam.org/doi/abs/10.1137/120867366',
      zh: 'Rokicki, Kociemba, Davidson, Dethridge,“The Diameter of the Rubik’s Cube Group Is Twenty”, SIAM J. Discrete Math. (2013/2014):同行评审的完整论证。',
      en: 'Rokicki, Kociemba, Davidson, Dethridge, "The Diameter of the Rubik\'s Cube Group Is Twenty", SIAM J. Discrete Math. (2013/2014): the peer-reviewed write-up.',
    },
    {
      url: 'https://www.worldcubeassociation.org/results/rankings/333fm/single',
      zh: 'WCA 333fm 官方排行:FMC 单次 / 三次平均的世界纪录与全部正式成绩(成绩即解的 HTM 步数)。',
      en: 'WCA 333fm official rankings: the FMC single and mean-of-3 records and all official results (a result is just the HTM length of the solution).',
    },
  ];

  return (
    <>
      <EvHighlights cards={cards} />

      <EvCallout tone="info" heading={t('与三阶完全同群', 'Exactly the same group as the 3×3')}>
        {t(
          'FMC 不是另一个魔方:它就是标准三阶,只是规则不同——给你 1 小时纸笔,要求写下尽可能短的解,成绩按 HTM 步数计。因此它的上帝之数和三阶逐字相同:任意 WCA 打乱都存在 ≤20 步(HTM)的解。',
          'FMC is not a different puzzle: it is the standard 3×3 with different rules — one hour, pencil and paper, write down the shortest solution you can, scored in HTM moves. So its God\'s number is literally the 3×3 one: every WCA scramble has a solution of ≤20 HTM.',
        )}{' '}
        <Link href="/math/god?event=333">
          {t('查看「三阶」上帝之数详解 →', 'See the 3×3 God\'s-number write-up →')}
        </Link>
      </EvCallout>

      {/* ── §1 the hard ceiling ──────────────────────────────────────── */}
      <EvSection
        title={t('一　硬上限就是 20', 'I — The hard ceiling is 20')}
        lead={t(
          '群没变,直径就没变。FMC 唯一的“数学天花板”是三阶 HTM 直径,2010 年被证明恰好等于 20。',
          'Same group, same diameter. FMC\'s only mathematical ceiling is the 3×3 HTM diameter, proven in 2010 to be exactly 20.',
        )}
      >
        <p>
          <MathText>{t(
            '三阶魔方群有 |G| = 43,252,003,274,489,856,000 ≈ 4.3252 × 10¹⁹ 个状态。Rokicki、Kociemba、Davidson、Dethridge 把它们按 Kociemba 阶段 1 的子群 G₁ = ⟨U,D,L²,R²,F²,B²⟩ 分成 2,217,093,120 个陪集,再用立方体的 48 重对称 + 集合覆盖把待解陪集压到约 5588 万个,在 Google 的机器上跑了约 35 CPU-年。',
            'The 3×3 group has |G| = 43,252,003,274,489,856,000 ≈ 4.3252 × 10¹⁹ states. Rokicki, Kociemba, Davidson and Dethridge partitioned them into 2,217,093,120 cosets of the Kociemba phase-1 subgroup G₁ = ⟨U,D,L²,R²,F²,B²⟩, then used the cube\'s 48-fold symmetry + a set-cover argument to shrink the cosets still to solve to about 55.88 million, running ~35 CPU-years on Google hardware.',
          )}</MathText>
        </p>
        <p>
          {t(
            '两端在 20 相遇:上界来自实际求出每个陪集里所有状态的 ≤20 步解;下界早就有了——superflip(12 个棱块全翻、什么都不错位)的最优解恰好需要 20 HTM。上界 = 下界,直径 = 20,这是证明,不是估计。',
            'Both ends meet at 20: the upper bound comes from actually solving every state in every coset in ≤20; the lower bound was already known — superflip (all 12 edges flipped, nothing else out of place) needs exactly 20 HTM optimally. Upper bound = lower bound, so the diameter is 20 — a proof, not an estimate.',
          )}
        </p>
        <TeXBlock src={String.raw`D_{\mathrm{HTM}}(3\times3) = 20 \quad(\text{proven, 2010})\qquad D_{\mathrm{QTM}} = 26 \;\;(2014)`} />
        <EvCallout tone="warn" heading={t('注意度量', 'Mind the metric')}>
          {t(
            'FMC 成绩计 HTM(任意单层转算 1 步,含 180°)。在四分之一转度量(QTM)下直径是 26,在切片转度量(STM)下只知道夹在 18 与 20 之间——但这些都与 FMC 计分无关,FMC 只看 HTM。',
            'FMC is scored in HTM (any single-layer turn counts 1, including 180°). The diameter is 26 in the quarter-turn metric (QTM) and only known to lie between 18 and 20 in the slice-turn metric (STM) — but none of those affect FMC scoring, which is HTM only.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §2 the distribution is the FMC curve ─────────────────────── */}
      <EvSection
        title={t('二　这条分布就是 FMC 的难度曲线', 'II — That distribution is the FMC difficulty curve')}
        lead={t(
          '随机抽一个 WCA 打乱,它的最优解长度服从一条极其集中的分布——这正是裁判发给你的题目难度。',
          'Pick a random WCA scramble; its optimal length follows an extremely concentrated distribution — that is precisely the difficulty of the scramble you are handed.',
        )}
      >
        <p>
          {t(
            '下面这张最少步分布把每个最优长度 d 对应的状态数画出来。重点不是“最坏 20 步”,而是“绝大多数题目都贴着上限”:超过 99% 的随机态最优解落在 17、18、19 步,平均约 17.7 步。换句话说,你拿到的几乎每一道 FMC 题,理论最短解都在 17-19 之间。',
            'The minimum-solution distribution below plots how many states have each optimal length d. The point is not the worst case of 20 — it is that almost every scramble sits right against the ceiling: over 99% of random states are optimal at 17, 18 or 19 moves, averaging about 17.7. In other words, nearly every FMC scramble you are dealt has a theoretical optimum somewhere in 17-19.',
          )}
        </p>
        <Suspense fallback={<div className="god-loading">{t('加载分布图…', 'Loading distribution…')}</div>}>
          <DistanceDistribution isZh={isZh} />
        </Suspense>
        <EvStatStrip items={statRow(t)} />
        <p className="god-sec-lead" style={{ marginTop: '1rem', marginBottom: 0 }}>
          {t(
            '恰好需要满 20 步的“对径态”(antipode)只有约 4.9 亿个,在 4.3 × 10¹⁹ 里占 ~10⁻¹¹——稀有到几乎遇不到。这就是为什么 16 步那次世界纪录基本不可复刻:它要求一个本就极短最优解的幸运打乱,再加上选手当场把它找出来。',
            'The "antipodes" that genuinely require the full 20 number only about 490 million — a ~10⁻¹¹ slice of 4.3 × 10¹⁹, so rare you essentially never see one. This is why the 16-move world record is effectively unreproducible: it needs a lucky scramble with an unusually short optimum AND a solver who actually finds it on the day.',
          )}
        </p>
      </EvSection>

      {/* ── §3 bespoke slider: your move count vs the optimum ────────── */}
      <EvSection
        title={t('三　你的步数,落在哪一档', 'III — Where your move count lands')}
        lead={t(
          '拖动滑块设一个假想的 FMC 成绩,看它离 20 步上限有多远,以及它能解出多大比例的随机打乱。',
          'Drag the slider to set a hypothetical FMC result and see how far it is from the 20-move ceiling — and what share of random scrambles a solver of that level could optimally reach.',
        )}
      >
        <MoveGauge t={t} moves={moves} setMoves={setMoves} frac={slider.frac} overCeiling={slider.overCeiling} />
      </EvSection>

      {/* ── §4 why humans miss it ────────────────────────────────────── */}
      <EvSection
        title={t('四　为什么人类找不到最优', 'IV — Why humans miss the optimum')}
        lead={t(
          '机器枚举整个群只需算力;人在 1 小时里靠的是结构化的“路线规划”,而最短解通常没有结构可循。',
          'A machine enumerates the whole group with raw compute; a human in one hour relies on structured route-planning, and the shortest solution usually has no structure to follow.',
        )}
      >
        <p>
          {t(
            '顶尖 FMC 选手不会去枚举 20 步;他们用 NISS(从正反两个方向逼近)、insertion(在骨架解里插入交换子消角/棱)、以及大量的 EO/DR/HTR 阶段化技巧,把一个 ~17-19 步的最优解“凑”到 21-30 步。当前 FMC 三次平均的世界纪录约 21-22 步,而最优解平均 17.7——这 3-5 步的差距,就是“可计算的最优”和“一小时内人类能想到的最优”之间的鸿沟。',
            'Top FMC solvers don\'t enumerate 20-move solutions; they use NISS (attacking from both the scramble and its inverse), insertions (splicing commutators into a skeleton to cancel last corners/edges), and staged EO/DR/HTR techniques to land a ~17-19-move optimum somewhere around 21-30. The mean-of-3 world record is about 21-22, while the optimum averages 17.7 — that 3-5-move gap is the chasm between "the computable optimum" and "the best a human can reason out in an hour".',
          )}
        </p>
        <div className="god-algo-grid" style={{ marginTop: '1rem' }}>
          <div className="god-algo-cell">
            <div className="god-algo-name"><Hand size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />{t('单次 16 步', 'Single 16')}</div>
            <div className="god-algo-desc">{t('人类峰值,需要一个最优解本就极短的幸运打乱,几乎贴着 20 步上限以下的稀有低尾。', 'The human peak: needs a lucky scramble whose own optimum is unusually short — the rare low tail well under the 20-move ceiling.')}</div>
          </div>
          <div className="god-algo-cell">
            <div className="god-algo-name"><Trophy size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />{t('三次平均 ~21-22', 'Mean-of-3 ~21-22')}</div>
            <div className="god-algo-desc">{t('稳定的世界级水平,比最优(均值 17.7)高约 3-5 步,体现“可规划的解”相对“最短解”的固有代价。', 'Stable world-class level — about 3-5 moves above the optimum (mean 17.7), the inherent cost of a plannable solution over the absolute shortest.')}</div>
          </div>
          <div className="god-algo-cell">
            <div className="god-algo-name"><Clock size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />{t('典型单次 25-30', 'Typical single 25-30')}</div>
            <div className="god-algo-desc">{t('多数正式 FMC 成绩落在此区间,离 20 步上限还有 5-10 步,说明“最优”在 1 小时里基本可望不可及。', 'Most official FMC results sit here, 5-10 above the 20-move ceiling — the optimum is essentially out of reach within the hour.')}</div>
          </div>
        </div>
        <EvCallout tone="accent" heading={t('一句话总结', 'In one line')}>
          {t(
            'FMC 是 WCA 里唯一一个“上帝之数早就被证明、而且就是比赛理论最优值”的项目——只不过那个 20 步是机器的成绩单,不是人的。',
            'FMC is the one WCA event whose God\'s number is both proven and literally the theoretical best result — except that 20 is the machine\'s scorecard, not a human\'s.',
          )}
        </EvCallout>
        <p style={{ marginTop: '1rem' }}>
          <Link href="/scramble/solver?event=333">
            <Target size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
            {t('用最优求解器看任意打乱的真实最短解 →', 'Get the true shortest solution for any scramble with the optimal solver →')}
          </Link>
        </p>
      </EvSection>

      <EvRefs refs={refs} />
    </>
  );
}

/* ── §2 stat strip ─────────────────────────────────────────────────── */
function statRow(t: (zh: string, en: string) => string): StatItem[] {
  return [
    { label: t('平均最优步数', 'Mean optimal length'), value: <span>17.7 <span style={{ fontSize: '0.6em', color: 'var(--god-text-mute)' }}>HTM</span></span> },
    { label: t('中位数', 'Median'), value: <span>18 <span style={{ fontSize: '0.6em', color: 'var(--god-text-mute)' }}>HTM</span></span> },
    { label: t('17-19 步占比', 'Share at 17-19'), value: <span>&gt;99%</span> },
    { label: t('满 20 步对径态', '20-move antipodes'), value: <TeX src={String.raw`\approx 4.9 \times 10^{8}`} /> },
  ];
}

/* ── §3 bespoke responsive SVG gauge ───────────────────────────────── */
function MoveGauge({
  t, moves, setMoves, frac, overCeiling,
}: {
  t: (zh: string, en: string) => string;
  moves: number;
  setMoves: (n: number) => void;
  frac: number;
  overCeiling: number;
}) {
  const MIN = 16, MAX = 40;
  const W = 620, H = 150, PAD_L = 16, PAD_R = 16, TRACK_Y = 70;
  const innerW = W - PAD_L - PAD_R;
  const xOf = (m: number) => PAD_L + ((m - MIN) / (MAX - MIN)) * innerW;

  // landmark records on the human side
  const marks: { m: number; zh: string; en: string }[] = [
    { m: 16, zh: '单次 WR', en: 'Single WR' },
    { m: 20, zh: '上帝之数', en: "God's #" },
    { m: 22, zh: '平均 WR', en: 'Mean WR' },
    { m: 28, zh: '典型', en: 'Typical' },
  ];

  const handleX = xOf(moves);
  const pct = frac * 100;
  const pctLabel = moves >= 20
    ? '100%'
    : pct < 0.001 ? '< 0.001%' : pct < 1 ? `${pct.toFixed(3)}%` : `${pct.toFixed(1)}%`;

  return (
    <div className="god-dist-wrap">
      <div className="god-bfs-controls" style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: '0.9rem', color: 'var(--god-text-sub)', width: '100%' }}>
          <span style={{ minWidth: 0 }}>{t('你的 FMC 成绩(HTM)', 'Your FMC result (HTM)')}</span>
          <input
            type="range" min={MIN} max={MAX} step={1} value={moves}
            onChange={(e) => setMoves(Number(e.target.value))}
            aria-label={t('FMC 步数滑块', 'FMC move-count slider')}
            style={{ flex: '1 1 200px', minWidth: 140, accentColor: 'var(--god-accent)' }}
          />
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: '1.25rem', color: 'var(--god-accent)' }}>{moves}</span>
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, height: 'auto', display: 'block' }}
           preserveAspectRatio="xMidYMid meet" role="img"
           aria-label={t('FMC 步数标尺', 'FMC move-count scale')}>
        {/* the proven-optimal band 17..19 (where >99% of scrambles live) */}
        <rect x={xOf(17)} y={TRACK_Y - 18} width={xOf(19) - xOf(17)} height={36}
              fill="var(--god-accent)" opacity={0.14} rx={5} />
        <text x={(xOf(17) + xOf(19)) / 2} y={TRACK_Y - 24} fontSize="9.5" textAnchor="middle"
              fill="var(--god-accent)" fontWeight={600}>
          {t('随机态最优 17-19', 'random optima 17-19')}
        </text>
        {/* ceiling region marker at 20 */}
        <line x1={xOf(20)} x2={xOf(20)} y1={TRACK_Y - 22} y2={TRACK_Y + 30}
              stroke="var(--god-warn)" strokeWidth={1.5} strokeDasharray="3 3" />

        {/* track */}
        <line x1={PAD_L} x2={W - PAD_R} y1={TRACK_Y} y2={TRACK_Y}
              stroke="var(--god-grid)" strokeWidth={4} strokeLinecap="round" />
        {/* filled portion up to handle */}
        <line x1={PAD_L} x2={handleX} y1={TRACK_Y} y2={TRACK_Y}
              stroke="var(--god-accent)" strokeWidth={4} strokeLinecap="round" opacity={0.7} />

        {/* tick labels */}
        {[16, 20, 24, 28, 32, 36, 40].map((m) => (
          <g key={m}>
            <line x1={xOf(m)} x2={xOf(m)} y1={TRACK_Y + 4} y2={TRACK_Y + 10}
                  stroke="var(--god-text-mute)" strokeWidth={1} />
            <text x={xOf(m)} y={TRACK_Y + 24} fontSize="9.5" textAnchor="middle" fill="var(--god-text-sub)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}>{m}</text>
          </g>
        ))}

        {/* landmark records (above track) */}
        {marks.map((mk) => (
          <g key={mk.m}>
            <circle cx={xOf(mk.m)} cy={TRACK_Y} r={3.2}
                    fill={mk.m === 20 ? 'var(--god-warn)' : 'var(--god-wca)'} />
            <text x={xOf(mk.m)} y={TRACK_Y - 30} fontSize="9.5" textAnchor="middle"
                  fill="var(--god-text-sub)">{t(mk.zh, mk.en)}</text>
          </g>
        ))}

        {/* handle */}
        <g>
          <line x1={handleX} x2={handleX} y1={TRACK_Y - 14} y2={TRACK_Y + 14}
                stroke="var(--god-accent)" strokeWidth={2} />
          <circle cx={handleX} cy={TRACK_Y} r={7} fill="var(--god-accent)"
                  stroke="var(--god-surface)" strokeWidth={2} />
        </g>
      </svg>

      <div className="god-dist-summary" style={{ marginTop: 14 }}>
        <div>
          <div className="god-dist-stat-label">{t('离上帝之数(20)', 'Above God\'s number (20)')}</div>
          <div className="god-dist-stat-num">
            {overCeiling <= 0 ? <TeX src={String.raw`\le 0`} /> : `+${overCeiling}`}
            <span>HTM</span>
          </div>
        </div>
        <div>
          <div className="god-dist-stat-label">{t('该水平能最优解出的打乱占比', 'Scrambles this level reaches optimally')}</div>
          <div className="god-dist-stat-num">{pctLabel}</div>
        </div>
      </div>

      <p className="god-dist-caption">
        <MathText>{
          moves <= 16
            ? t(
                '16 步是 FMC 单次世界纪录——比绝大多数随机态的最优长度(17-19)还短,只有遇到罕见的“低尾”打乱才可能。这不是稳定水平,而是天才加运气的一次性闪光。',
                '16 is the FMC single world record — shorter than the optimum of almost every random state (17-19), only possible on a rare low-tail scramble. Not a sustainable level, but a one-off flash of insight and luck.',
              )
            : moves < 20
            ? t(
                '低于 20 步意味着你逼近甚至触及了大多数打乱的真实最优。这已是世界顶尖 FMC 单次水平,只有少数选手在少数打乱上做到。',
                'Below 20 means you are approaching or hitting the true optimum of most scrambles. This is world-class FMC single territory — only a handful of solvers on a handful of scrambles.',
              )
            : moves === 20
            ? t(
                '20 步恰好是硬上限:理论上,任何打乱都存在 ≤20 步的解,所以“20 步”能最优(或更好地)解出全部 4.3 × 10¹⁹ 个状态。现实里,1 小时内稳定做到 20 的人极少。',
                '20 is exactly the hard ceiling: in theory every scramble has a ≤20-move solution, so "20" can optimally (or better) reach all 4.3 × 10¹⁹ states. In practice, almost nobody hits 20 reliably within the hour.',
              )
            : t(
                `比上帝之数(20)多 ${overCeiling} 步。这是绝大多数正式 FMC 成绩所在的区间:你给出的是一个能解、但远非最短的解。机器能枚举到的“最优”,人在 1 小时内通常凑不出来。`,
                `That is ${overCeiling} above God\'s number (20). This is where most official FMC results live: a valid but far-from-shortest solution. The "optimum" a machine can enumerate is usually unreachable for a human in one hour.`,
              )
        }</MathText>
      </p>
    </div>
  );
}
