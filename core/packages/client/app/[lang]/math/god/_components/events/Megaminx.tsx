'use client';

/**
 * /math/god?event=minx — Megaminx God's number (bounds only, exact unknown).
 *
 * Ground truth (god_data.ts `minx` + god_deep_data.ts `minx`):
 *   |G| = 20! x 3^19 x 30! x 2^27 ≈ 1.01 × 10^68
 *   lower bound 48 HTM  — Tomas Rokicki 2016, refining Kociemba 2012's 45
 *   upper bound 194     — OLD loose community estimate (since lowered by
 *                          subgroup-chain / two-phase solvers, but the metric
 *                          of the ~110s figures is NOT publicly confirmed —
 *                          we do NOT publish "116 HTM" as a fact)
 *   exact diameter      — UNKNOWN
 *
 * The lower bound is a commuting-faces canonical-sequence count: with 48 face
 * moves and the recurrence  t(n+1) = 36 t(n) − 240 t(n−1) − 320 t(n−2)  the
 * cumulative number of distinct sequences first exceeds |G| at depth 48, so no
 * algorithm can reach every state in fewer. The bespoke SVG below animates that
 * crossover under a depth slider.
 *
 * NOT the same number: the ⟨U,R⟩ 2-generator subgroup diameter (26 HTM, Ben
 * Whitmore 2024) is a SUBGROUP figure, never the full-puzzle God's number.
 */
import { Suspense, lazy, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { ArrowDownToLine, Ruler, Gauge } from 'lucide-react';
import {
  EvHighlights, EvSection, EvCallout, EvRefs, EvStatStrip,
  TeX, TeXBlock, MathText,
  type HighlightCard, type RefItem, type StatItem,
} from './_shared';

const SubgroupChain = lazy(() => import('../SubgroupChain'));

const REFS: RefItem[] = [
  {
    url: 'https://www.speedsolving.com/threads/lower-bound-for-megaminx-in-htm-and-qtm.35724/',
    zh: 'Speedsolving 论坛「Megaminx HTM/QTM 下界」帖:对易面计数论证。Kociemba 2012 给 45 HTM,Tomas Rokicki 2016 改进同一论证得到 48 HTM 下界。',
    en: 'Speedsolving thread "Lower bound for Megaminx in HTM and QTM": the commuting-faces counting argument. Kociemba 2012 gave 45 HTM; Tomas Rokicki refined it in 2016 to a 48 HTM lower bound.',
  },
  {
    url: 'https://www.jaapsch.net/puzzles/megaminx.htm',
    zh: 'Jaap Scherphuis,Megaminx 页:零件模型与态空间公式 20! × 3¹⁹ × 30! × 2²⁷ 的推导。',
    en: 'Jaap Scherphuis — Megaminx page: piece model and the derivation of the state-space order 20! × 3¹⁹ × 30! × 2²⁷.',
  },
  {
    url: 'https://www.cube20.org/',
    zh: 'cube20.org:三阶上帝之数 = 20 HTM 的官方记录,以及陪集 / 对称压缩这套对 Megaminx 仍力所不及的方法学背景。',
    en: 'cube20.org — the canonical record of the 3×3 result (20 HTM) and the coset / symmetry-compression methodology that, for Megaminx, remains out of reach.',
  },
];

/* ─── exact state count via BigInt (never a JS number literal > 2^53) ─── */
function megaminxOrder(): bigint {
  let f20 = 1n;
  for (let i = 2n; i <= 20n; i++) f20 *= i; // 20!
  let f30 = 1n;
  for (let i = 2n; i <= 30n; i++) f30 *= i; // 30!
  const p3 = 3n ** 19n;
  const p2 = 2n ** 27n;
  return f20 * p3 * f30 * p2;
}

/* ─── commuting-faces recurrence, in log10 space for plotting ───────────
 * t(n+1) = 36 t(n) − 240 t(n−1) − 320 t(n−2), seeds t0 = 1, t1 = 48,
 * t2 = 36 t1 − 240 t0. CUM(d) = Σ_{k≤d} t(k) is the count of distinct
 * canonical sequences of length ≤ d; the lower bound is the smallest d with
 * CUM(d) ≥ |G|. Carry exact BigInt then convert to log10 for the chart. */
function buildSequenceTable(maxDepth: number): { d: number; logCum: number }[] {
  const t: bigint[] = [1n, 48n];
  t.push(36n * t[1] - 240n * t[0]);
  for (let n = 2; n < maxDepth; n++) {
    t.push(36n * t[n] - 240n * t[n - 1] - 320n * t[n - 2]);
  }
  const log10 = (b: bigint): number => {
    if (b <= 0n) return 0;
    const s = b.toString();
    const lead = Number(s.slice(0, 15));
    return Math.log10(lead) + (s.length - Math.min(15, s.length));
  };
  const out: { d: number; logCum: number }[] = [];
  let cum = 0n;
  for (let d = 0; d <= maxDepth && d < t.length; d++) {
    cum += t[d];
    out.push({ d, logCum: log10(cum) });
  }
  return out;
}

const MAX_D = 60;          // chart x-range
const CROSS_D = 48;        // proven lower bound: smallest d with CUM ≥ |G|

export default function Megaminx({ isZh }: { isZh: boolean; eventId?: string }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const exact = useMemo(() => megaminxOrder().toString(), []);
  const logG = useMemo(() => {
    const s = megaminxOrder().toString();
    return Math.log10(Number(s.slice(0, 15))) + (s.length - 15);
  }, []);
  const table = useMemo(() => buildSequenceTable(MAX_D), []);

  const [depth, setDepth] = useState<number>(CROSS_D);
  const here = table[Math.min(depth, table.length - 1)];
  const reached = here.logCum >= logG;

  /* ── SVG geometry ── */
  const W = 560, H = 320, PL = 52, PR = 18, PT = 22, PB = 38;
  const iW = W - PL - PR, iH = H - PT - PB;
  const yTop = 80; // log10 axis top
  const xOf = (d: number) => PL + (d / MAX_D) * iW;
  const yOf = (lg: number) => PT + iH - (Math.min(lg, yTop) / yTop) * iH;
  const curve = table.map((r, i) => `${i === 0 ? 'M' : 'L'}${xOf(r.d).toFixed(1)},${yOf(r.logCum).toFixed(1)}`).join(' ');

  const cards: HighlightCard[] = [
    { num: <TeX src={String.raw`\ge 48`} />, cap: t('HTM 下界(已证)', 'HTM lower bound (proven)'),
      sub: t('Rokicki 2016,改进 Kociemba 2012 的 45', 'Rokicki 2016, refining Kociemba 2012’s 45'), tone: 'warn' },
    { num: <TeX src={String.raw`\le 194`} />, cap: t('HTM 上界(粗估)', 'HTM upper bound (loose)'),
      sub: t('较早社区估计,此后被求解器改进', 'older community estimate, since improved by solvers'), tone: 'warn' },
    { num: '?', cap: t('精确直径', 'Exact diameter'),
      sub: t('从未被计算', 'never computed'), tone: 'warn' },
    { num: <TeX src={String.raw`1.01\times10^{68}`} />, cap: t('态空间', 'State space'),
      sub: <TeX src={String.raw`20!\cdot 3^{19}\cdot 30!\cdot 2^{27}`} />, tone: 'wca' },
  ];

  const stats: StatItem[] = [
    { label: t('面 / 转轴', 'Faces / axes'), value: '12' },
    { label: t('每面合法转动', 'Turns per face'), value: '4' },
    { label: t('HTM 生成元', 'HTM generators'), value: <TeX src={String.raw`12\times4=48`} /> },
    { label: t('已证下界', 'Proven lower'), value: <span><TeX src={String.raw`48`} /> HTM</span> },
  ];

  return (
    <>
      <EvHighlights cards={cards} />

      <EvCallout tone="warn" heading={t('先说清楚:这是一道未解之题', 'Up front: this is an open problem')}>
        {t(
          'Megaminx 的上帝之数至今没有被算出来。我们只有一个已被证明的下界(48 HTM)和一些上界估计;精确直径未知。下文出现的任何「上界」都不是已证精确值。',
          'Megaminx’s God’s number has never been computed. We have one proven lower bound (48 HTM) and some upper-bound estimates; the exact diameter is unknown. Any "upper bound" below is an estimate, not a proven exact value.',
        )}
      </EvCallout>

      {/* ── §1 group & state space ───────────────────────────────── */}
      <EvSection
        title={t('壹　群与态空间', 'I — The group and its state space')}
        lead={t(
          '十二面体,12 个正五边形面,每个面绕自身轴转。块多、约束多,群序爆炸到 10⁶⁸。',
          'A dodecahedron with twelve pentagonal faces, each turning about its own axis. More pieces, more constraints — the group order explodes to 10⁶⁸.',
        )}
      >
        <p>
          <MathText>{t(
            'Megaminx 有 20 个角块和 30 个棱块。角块的排列贡献 20!,朝向贡献 3¹⁹(最后一个角的朝向被前 19 个决定);棱块排列贡献 30!,朝向贡献 2²⁷(后三位被棱朝向与排列宇称联合约束)。十二个面的中心固定,不进入计数。',
            'Megaminx has 20 corner pieces and 30 edge pieces. Corner permutation contributes 20!, corner orientation 3¹⁹ (the last corner’s twist is fixed by the other 19); edge permutation contributes 30!, edge orientation 2²⁷ (the final three are pinned by the orientation-and-permutation parity constraints). The twelve face centres are fixed and do not enter the count.',
          )}</MathText>
        </p>
        <div className="god-formula-block">
          <TeXBlock src={String.raw`|G| \;=\; 20!\,\cdot\,3^{19}\,\cdot\,30!\,\cdot\,2^{27}\;\approx\;1.01\times10^{68}`} />
          <div className="god-formula-cap">
            {t('五魔方的合法状态数,与计步口径无关。', 'The reachable-state count of the Megaminx, independent of any move metric.')}
          </div>
        </div>
        <EvStatStrip items={stats} />
        <EvCallout tone="info" heading={t('量级直觉', 'A sense of scale')}>
          <MathText>{t(
            '10⁶⁸ 比三阶 (4.3 × 10¹⁹) 大约 49 个数量级,比四阶 (7.4 × 10⁴⁵) 还大约 23 个数量级。三阶能被穷举到「直径 = 20」的那套陪集 + 对称压缩方法,在 Megaminx 这个量级上完全无能为力。',
            'That 10⁶⁸ is about 49 orders of magnitude beyond the 3×3 (4.3 × 10¹⁹) and still 23 orders beyond the 4×4 (7.4 × 10⁴⁵). The coset + symmetry-compression machine that pinned the 3×3 at diameter 20 is hopelessly outmatched at this scale.',
          )}</MathText>
        </EvCallout>
        <div className="god-mono" style={{ fontSize: '0.82rem', wordBreak: 'break-all', color: 'var(--god-text-mute)', marginTop: '0.75rem' }}>
          {t('精确值:', 'Exact value: ')}{exact}
        </div>
      </EvSection>

      {/* ── §2 lower bound 48 + bespoke SVG ──────────────────────── */}
      <EvSection
        title={t('贰　下界 48:对易面计数', 'II — The lower bound 48: commuting-faces counting')}
        lead={t(
          '不需要解开任何一个魔方,只需数清「最多能有多少种不同的步序」。当这个数追上 |G|,你就得到了下界。',
          'No puzzle needs solving — you just count how many distinct move-sequences can possibly exist. When that count catches up to |G|, you have a lower bound.',
        )}
      >
        <p>
          <MathText>{t(
            'Megaminx 在 HTM 下有 48 个生成元:12 个面,每面 4 种合法转动(两个方向各两档,记作 R、R²、R′、R′²)。若每一步都自由,长度 d 的序列有 48ᵈ 种;但相邻同面、以及彼此不相邻(因此可对易)的面之间会产生大量重复,真正不同的「典范序列」数远少于 48ᵈ。把这种独立性精确编码,得到一个线性递推:',
            'In HTM, Megaminx has 48 generators: 12 faces × 4 legal turns each (two directions, two amounts, written R, R², R′, R′²). If every move were free there would be 48ᵈ sequences of length d; but consecutive same-face moves, and the many non-adjacent (hence commuting) face pairs, create huge redundancy, so the number of distinct canonical sequences is far below 48ᵈ. Encoding that independence exactly yields a linear recurrence:',
          )}</MathText>
        </p>
        <div className="god-formula-block">
          <TeXBlock src={String.raw`t(n{+}1) \;=\; 36\,t(n)\;-\;240\,t(n{-}1)\;-\;320\,t(n{-}2)`} />
          <div className="god-formula-cap">
            {t('典范步序的递推:t(n) 是长度恰好 n 的不同序列数;主特征根约为 36。', 'Recurrence for canonical sequences: t(n) is the count of distinct length-n sequences; the dominant root is ≈ 36.')}
          </div>
        </div>
        <p>
          <MathText>{t(
            '累加到深度 d 得到长度 ≤ d 的序列总数 CUM(d)。只要 CUM(d) < |G|,长度 ≤ d 的所有解法根本不够「指向」每一个状态,因此一定存在需要更多步的状态。第一个使 CUM(d) ≥ |G| 的深度,就是直径的下界——计算给出 d = 48。Kociemba 2012 年用这套论证得到 45 HTM;Tomas Rokicki 2016 年收紧同一论证,把下界提到 48 HTM。',
            'Summing to depth d gives CUM(d), the number of sequences of length ≤ d. Whenever CUM(d) < |G|, there simply aren’t enough length-≤ d solutions to reach every state, so some state must need more moves. The first depth with CUM(d) ≥ |G| is a lower bound on the diameter — and the count gives d = 48. Kociemba’s 2012 argument produced 45 HTM; Tomas Rokicki tightened the same argument in 2016 to 48 HTM.',
          )}</MathText>
        </p>

        {/* bespoke responsive SVG: CUM(d) vs |G| with depth slider */}
        <div className="god-growth-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="god-growth-svg" width="100%"
               style={{ maxWidth: W }} preserveAspectRatio="xMidYMid meet" role="img"
               aria-label={t('对易面计数与态空间的交点', 'commuting-faces count vs state space crossover')}>
            {/* horizontal gridlines (log10 decades) */}
            {[0, 20, 40, 60, 80].map((v) => (
              <g key={v}>
                <line x1={PL} x2={W - PR} y1={yOf(v)} y2={yOf(v)} stroke="var(--god-grid)" strokeDasharray="3 4" />
                <text x={PL - 8} y={yOf(v) + 3} fontSize="9.5" textAnchor="end" fill="var(--god-text-sub)">10^{v}</text>
              </g>
            ))}
            {/* x ticks */}
            {[0, 12, 24, 36, 48, 60].map((d) => (
              <text key={d} x={xOf(d)} y={H - PB + 16} fontSize="10" textAnchor="middle" fill="var(--god-text-sub)">{d}</text>
            ))}
            <text x={(PL + W - PR) / 2} y={H - 4} fontSize="10" textAnchor="middle" fill="var(--god-text-mute)">
              {t('深度 d(HTM)', 'depth d (HTM)')}
            </text>

            {/* |G| target line */}
            <line x1={PL} x2={W - PR} y1={yOf(logG)} y2={yOf(logG)} stroke="var(--god-wca)" strokeWidth="1.6" strokeDasharray="6 4" />
            <text x={W - PR} y={yOf(logG) - 5} fontSize="10" textAnchor="end" fill="var(--god-wca)">
              |G| ≈ 10^68
            </text>

            {/* crossover marker at d = 48 */}
            <line x1={xOf(CROSS_D)} x2={xOf(CROSS_D)} y1={PT} y2={PT + iH} stroke="var(--god-warn)" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
            <text x={xOf(CROSS_D)} y={PT - 6} fontSize="10" textAnchor="middle" fill="var(--god-warn)">d = 48</text>

            {/* CUM(d) curve */}
            <path d={curve} stroke="var(--god-accent)" strokeWidth="2.2" fill="none" />

            {/* selected-depth readout: vertical line + dot */}
            <line x1={xOf(depth)} x2={xOf(depth)} y1={PT} y2={PT + iH} stroke="var(--god-text-sub)" strokeDasharray="2 3" />
            <circle cx={xOf(depth)} cy={yOf(here.logCum)} r="5"
                    fill={reached ? 'var(--god-accent)' : 'var(--god-text-sub)'}
                    stroke="var(--god-surface)" strokeWidth="1.5" />
          </svg>

          <div className="god-growth-readout">
            <strong>d = {depth}:</strong>{' '}
            <MathText>{t(`累计序列数 ≈ 10^${here.logCum.toFixed(1)}`, `cumulative sequences ≈ 10^${here.logCum.toFixed(1)}`)}</MathText>
            {'  —  '}
            {reached
              ? <span style={{ color: 'var(--god-accent)' }}>{t('已 ≥ |G| → 这个深度足以覆盖所有状态', 'already ≥ |G| → enough sequences to reach every state')}</span>
              : <span style={{ color: 'var(--god-warn)' }}>{t('仍 < |G| → 一定有状态需要更多步', 'still < |G| → some state must need more')}</span>}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', marginTop: '0.4rem' }}>
            <Ruler size={15} style={{ color: 'var(--god-text-sub)', flex: '0 0 auto' }} aria-hidden />
            <input type="range" min={0} max={MAX_D} value={depth}
                   onChange={(e) => setDepth(Number(e.target.value))}
                   aria-label={t('深度滑块', 'depth slider')}
                   style={{ flex: '1 1 160px', maxWidth: 320, accentColor: 'var(--god-accent)' }} />
            <span className="god-mono" style={{ fontSize: '0.85rem', color: 'var(--god-text-sub)', flex: '0 0 auto' }}>
              {t('深度', 'depth')} {depth}
            </span>
          </div>

          <div className="god-growth-legend">
            <span><i style={{ background: 'var(--god-accent)' }} /> {t('累计典范序列数 CUM(d)', 'cumulative canonical sequences CUM(d)')}</span>
            <span><i style={{ background: 'var(--god-wca)' }} /> {t('态空间 |G|', 'state space |G|')}</span>
            <span><i style={{ background: 'var(--god-warn)' }} /> {t('交点 d = 48(下界)', 'crossover d = 48 (lower bound)')}</span>
          </div>
        </div>

        <EvCallout tone="info" heading={t('为什么这只是下界,不是直径', 'Why this is only a lower bound, not the diameter')}>
          {t(
            '计数论证只说「步数不够就覆盖不全」,反过来并不保证「步数够了就真能解」。CUM(48) 略大于 |G| 仅意味着「48 步以内的序列在数量上刚够」;它们当中会有大量解到同一个状态,真正能否每个状态都 ≤ 48 步,计数完全不知道。所以 48 是地板,天花板要靠真正的求解器去够。',
            'A counting argument only says "too few moves can’t cover everything"; it never guarantees "enough moves actually solve everything". CUM(48) barely exceeding |G| only means the supply of length-≤ 48 sequences is numerically just sufficient; many of them collide on the same state, and counting says nothing about whether every state is truly within 48. So 48 is a floor — the ceiling has to be reached by an actual solver.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §3 upper bound ───────────────────────────────────────── */}
      <EvSection
        title={t('叁　上界:从 194 往下啃', 'III — The upper bound: chipping down from 194')}
        lead={t(
          '上界来自「能找到一套总是有效的解法」。它在不断变小,但没有一个公开数字被当作精确直径。',
          'An upper bound comes from "exhibiting a method that always works." It keeps shrinking, yet no published figure stands as the exact diameter.',
        )}
      >
        <p>
          <MathText>{t(
            '最常被引用的 194 HTM 是一个较早的社区粗略估计,本质是某套归约式(reduction)解法的最坏情形:把 Megaminx 拆成若干阶段逐段还原,把各阶段最坏步数加起来。它显然很松。此后,子群链 / 两阶段(Kociemba 式)求解器把可达到的最坏步数大幅压低——社区报告过 110 多步量级的数字。',
            'The most-quoted 194 HTM is an older, loose community estimate — essentially the worst case of some reduction-style method: split Megaminx into stages, solve each, and sum the per-stage worst cases. It is plainly slack. Since then, subgroup-chain / two-phase (Kociemba-style) solvers have pushed the attainable worst case far lower — figures in the 110s have been reported.',
          )}</MathText>
        </p>
        <EvCallout tone="warn" heading={t('我们不把那个「110 多」当作事实', 'We do not state the "110s" figure as a fact')}>
          {t(
            '那些报告的具体数字所用的计步口径(HTM?STM?是否含宽转?)没有公开核实过。把它当成确定的「上帝之数上界 = 116 HTM」会是错误的。本页只声明:上界仍是一个被持续改进、但尚未公开确证口径的估计区间,牢牢压在 194 以下、48 以上。',
            'The exact metric behind those reported numbers (HTM? STM? wide turns?) has not been publicly verified. Reporting a definite "upper bound = 116 HTM" would be wrong. This page states only that the upper bound remains an estimate — actively improved, but with an unconfirmed metric — sitting well below 194 and above 48.',
          )}
        </EvCallout>
        <div className="god-formula-block">
          <TeXBlock src={String.raw`48\;\le\;D_{\text{minx}}^{\text{HTM}}\;\le\;194\qquad(\text{真实上界估计已远低于 }194)`} />
          <div className="god-formula-cap">
            {t('已证下界 48,松上界 194;两端之间隔着上百步,精确直径仍未知。', 'Proven lower bound 48, loose upper bound 194; over a hundred moves separate them, and the exact diameter is unknown.')}
          </div>
        </div>
      </EvSection>

      {/* ── §4 do not confuse the subgroup diameter ──────────────── */}
      <EvSection
        title={t('肆　别把子群直径当成上帝之数', 'IV — Don’t mistake a subgroup diameter for God’s number')}
        lead={t(
          '一个常见误读:把「只用两个面」的子群直径当成整只 Megaminx 的上帝之数。它们是两回事。',
          'A common misreading: taking the "two-faces-only" subgroup diameter for the whole Megaminx God’s number. They are different things.',
        )}
      >
        <p>
          <MathText>{t(
            '把生成元限制成只有两个相邻面(记 ⟨U, R⟩),你得到的是 Megaminx 的一个小得多的子群。Ben Whitmore 在 2024 年精确算出这个 2-生成子群的直径为 26 HTM——这是一个干净、已证、可穷举的结果。但它衡量的是「只用两个面能走多远」,不是「任意打乱最少几步」。整只 Megaminx 的上帝之数远在其上,且仍未知。',
            'Restrict the generators to just two adjacent faces (write ⟨U, R⟩) and you get a far smaller subgroup of Megaminx. Ben Whitmore computed the diameter of this 2-generator subgroup exactly as 26 HTM in 2024 — a clean, proven, exhaustible result. But it measures "how far you can get using only two faces," not "the fewest moves for any scramble." The full-puzzle God’s number is far above it, and still unknown.',
          )}</MathText>
        </p>
        <EvCallout tone="warn" heading={t('两个数字,两个对象', 'Two numbers, two objects')}>
          <MathText>{t(
            '子群 ⟨U, R⟩ 直径 = 26 HTM(Whitmore 2024,已证);整只 Megaminx 上帝之数 = 未知,仅知 ∈ [48, 194]。前者是后者的一个真子结构,数字不可互换。',
            'Subgroup ⟨U, R⟩ diameter = 26 HTM (Whitmore 2024, proven); full-puzzle Megaminx God’s number = unknown, only known to lie in [48, 194]. The former is a proper substructure of the latter; the numbers are not interchangeable.',
          )}</MathText>
        </EvCallout>
      </EvSection>

      {/* ── §5 method context: why coset machinery doesn't reach ─── */}
      <EvSection
        title={t('伍　方法学:为什么三阶那套够不着', 'V — Methodology: why the 3×3 machine can’t reach')}
        lead={t(
          '三阶靠陪集 + 对称把 4.3 × 10¹⁹ 压到可计算规模。Megaminx 大了 49 个数量级,同一思路在这里只能做求解器,做不了证明。',
          'The 3×3 win used cosets + symmetry to crush 4.3 × 10¹⁹ to a computable size. Megaminx is 49 orders larger; the same idea yields solvers here, not proofs.',
        )}
      >
        <p>
          <MathText>{t(
            '回顾三阶:用 Kociemba 子群 G₁ = ⟨U, D, L², R², F², B²⟩ 把全群切成 2.2 × 10⁹ 个陪集,再用 48 元对称群压到 5588 万,Google 集群 ~35 CPU-年穷举,得直径 = 20。Megaminx 的对称群更大(十二面体 60 个旋转),但被压缩的对象是 10⁶⁸——即便再压几个数量级也远超任何存储。所以 Megaminx 只能用同源的两阶段思想做近最优求解器(给上界),无法做完整 BFS(给精确值)。',
            'Recall the 3×3: the Kociemba subgroup G₁ = ⟨U, D, L², R², F², B²⟩ split the full group into 2.2 × 10⁹ cosets; the 48-element symmetry group crushed that to 55.88M; a ~35 CPU-year exhaustive search on Google’s cluster gave diameter 20. Megaminx has a larger symmetry group (60 dodecahedral rotations), but the object being compressed is 10⁶⁸ — even several more orders of compression dwarf any storage. So Megaminx admits only the same two-phase idea as a near-optimal solver (giving an upper bound), never a full BFS (giving an exact value).',
          )}</MathText>
        </p>
        <p>
          {t(
            '下面这张三阶子群链可视化,正是「为什么三阶能、Megaminx 不能」的根源——同一套陪集思想,在态空间小三十几个数量级时是证明,在 10⁶⁸ 时只剩下启发式求解。',
            'The 3×3 subgroup-chain visualization below is exactly the reason "the 3×3 can, Megaminx can’t" — the same coset idea is a proof when the state space is thirty-odd orders smaller, and only a heuristic solver at 10⁶⁸.',
          )}
        </p>
        <Suspense fallback={<div className="god-loading">…</div>}>
          <SubgroupChain isZh={isZh} />
        </Suspense>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.25rem' }}>
          <Link href="/scramble/solver?event=minx" className="god-card-refs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--god-accent)' }}>
            <Gauge size={16} aria-hidden />
            {t('在线试 Megaminx 近最优求解器', 'Try the Megaminx near-optimal solver online')}
          </Link>
          <Link href="/math/god?event=333" className="god-card-refs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--god-accent)' }}>
            <ArrowDownToLine size={16} aria-hidden />
            {t('对照三阶:上帝之数 = 20 是怎么证出来的', 'Compare 3×3: how diameter = 20 was actually proven')}
          </Link>
        </div>
      </EvSection>

      <EvRefs refs={REFS} />
    </>
  );
}
