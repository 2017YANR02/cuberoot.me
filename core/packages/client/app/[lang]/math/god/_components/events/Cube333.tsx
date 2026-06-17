'use client';

/**
 * /math/god?event=333 — the 3×3×3, the crown jewel of God's-number research.
 *
 *   intro          → headline cards (20 HTM proven, 26 QTM proven, STM bounds, |G|)
 *   §1 the group   → |G| derivation (8! x 3^7 x 12!/2 x 2^11, with the /2 explicit)
 *   §2 the metrics → HTM/QTM/STM toggle (proven vs bounds) + bespoke SVG bar chart
 *   §3 the proof   → coset framework: 2.217B cosets → 55.88M via S48 → 35 CPU-yr Google
 *   §4 antipodes   → SuperflipShowcase (reused)
 *   §5 distribution→ DistanceDistribution (reused) + same-group cross-links
 *   references
 *
 * Ground truth: god_data.ts ('333') + god_deep_data.ts ('333'). STM is BOUNDS ONLY
 * (18–20), never published as an exact value — kept as a bound everywhere.
 */
import { Suspense, lazy, useState } from 'react';
import Link from '@/components/AppLink';
import { Cog, Layers, Sparkles, CheckCircle2, CircleDashed } from 'lucide-react';
import {
  EvHighlights, EvSection, EvCallout, EvRefs, EvStatStrip,
  TeX, TeXBlock, MathText, tr,
  type HighlightCard, type RefItem, type StatItem,
} from './_shared';

const SuperflipShowcase = lazy(() => import('../SuperflipShowcase'));
const DistanceDistribution = lazy(() => import('../DistanceDistribution'));

const Loading = () => <div className="god-loading">…</div>;

/* ── the three move metrics ──────────────────────────────────────────── */

type MetricKey = 'HTM' | 'QTM' | 'STM';

interface MetricRow {
  key: MetricKey;
  /** displayed diameter value (string so STM can be "18–20") */
  value: string;
  proven: boolean;
  /** numeric extent used for the bespoke SVG bar (lower..upper) */
  lo: number;
  hi: number;
  name: { zh: string; en: string };
  defn: { zh: string; en: string };
  status: { zh: string; en: string };
}

const METRICS: MetricRow[] = [
  {
    key: 'HTM',
    value: '20',
    proven: true,
    lo: 20, hi: 20,
    name: { zh: '半转度量 HTM', en: 'Half-Turn Metric (HTM)' },
    defn: {
      zh: '任意一个外层面转(90° 或 180°,如 R、R2、R\')都算 1 步。这是最常引用的口径,也是「上帝之数 = 20」里那个 20 的归属。',
      en: 'Any single outer-face turn (90° or 180°, e.g. R, R2, R\') counts as 1 move. This is the most-quoted metric and the home of the famous "God\'s number = 20".',
    },
    status: { zh: '已证精确值 20(Rokicki 等 2010)', en: 'Proven exact 20 (Rokicki et al. 2010)' },
  },
  {
    key: 'QTM',
    value: '26',
    proven: true,
    lo: 26, hi: 26,
    name: { zh: '四分之一转度量 QTM', en: 'Quarter-Turn Metric (QTM)' },
    defn: {
      zh: '只有 90° 转算 1 步,180° 转(R2)算 2 步。把每一步限制成最基本的扭动,直径随之升到 26。',
      en: 'Only 90° turns count as 1 move; a 180° turn (R2) counts as 2. Restricting moves to the most elementary twist raises the diameter to 26.',
    },
    status: { zh: '已证精确值 26(Rokicki & Davidson 2014)', en: 'Proven exact 26 (Rokicki & Davidson 2014)' },
  },
  {
    key: 'STM',
    value: '18–20',
    proven: false,
    lo: 18, hi: 20,
    name: { zh: '切片度量 STM', en: 'Slice-Turn Metric (STM)' },
    defn: {
      zh: '在 HTM 的基础上额外把中层切片转(M、E、S)也算作 1 步。多出的生成元理论上能缩短解,但它的上帝之数至今没被合拢——只知道夹在 18 与 20 之间。',
      en: 'On top of HTM, a middle-slice turn (M, E, S) also counts as 1 move. The extra generators could in principle shorten solutions, but its God\'s number is still unresolved — only known to lie between 18 and 20.',
    },
    status: { zh: '仅有上下界 18–20,尚未证出精确值', en: 'Bounds only, 18–20 — no proven exact value' },
  },
];

/* ── bespoke SVG: the three metrics side by side ─────────────────────── */
/** A hand-authored, hoverable bar chart of the three diameters: two proven
 *  points, one open interval. Width=100% but capped at the viewBox width. */
function MetricChart({ isZh, active, onPick }: {
  isZh: boolean;
  active: MetricKey;
  onPick: (k: MetricKey) => void;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const W = 560, H = 240;
  const PAD_L = 48, PAD_R = 18, PAD_T = 22, PAD_B = 46;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const MAX = 28; // axis top, a bit above 26
  const y = (v: number) => PAD_T + innerH * (1 - v / MAX);
  const slot = innerW / METRICS.length;
  const barW = Math.min(74, slot * 0.5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, height: 'auto', display: 'block' }}
         role="img" aria-label={t('三套度量下的三阶直径', '3×3 diameter under three metrics')}>
      {/* gridlines */}
      {[0, 7, 14, 21, 28].map((v) => (
        <g key={v}>
          <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)}
                stroke="var(--god-grid)" strokeDasharray="3 4" />
          <text x={PAD_L - 7} y={y(v) + 3} fontSize="9.5" textAnchor="end" fill="var(--god-text-sub)">{v}</text>
        </g>
      ))}
      {METRICS.map((m, i) => {
        const cx = PAD_L + slot * (i + 0.5);
        const x = cx - barW / 2;
        const isActive = m.key === active;
        const col = m.proven ? 'var(--god-accent)' : 'var(--god-warn)';
        const topY = y(m.hi);
        const botY = y(m.lo);
        return (
          <g key={m.key} onClick={() => onPick(m.key)} style={{ cursor: 'pointer' }}>
            {/* full-slot hit area */}
            <rect x={PAD_L + slot * i} y={PAD_T} width={slot} height={innerH} fill="transparent" />
            {/* proven = solid bar to its value; bounds = hatched interval band */}
            {m.proven ? (
              <rect x={x} y={topY} width={barW} height={PAD_T + innerH - topY}
                    fill={col} opacity={isActive ? 0.92 : 0.6} rx={3} />
            ) : (
              <>
                {/* faint full bar up to the lower bound */}
                <rect x={x} y={y(m.lo)} width={barW} height={PAD_T + innerH - y(m.lo)}
                      fill={col} opacity={isActive ? 0.55 : 0.32} rx={3} />
                {/* uncertainty band 18..20 */}
                <rect x={x} y={topY} width={barW} height={botY - topY}
                      fill={col} opacity={isActive ? 0.3 : 0.18} />
                <line x1={x} x2={x + barW} y1={topY} y2={topY} stroke={col} strokeWidth="2" strokeDasharray="4 3" />
                <line x1={x} x2={x + barW} y1={botY} y2={botY} stroke={col} strokeWidth="2" />
              </>
            )}
            {/* value label */}
            <text x={cx} y={topY - 8} fontSize="15" fontWeight={700} textAnchor="middle" fill={col}>
              {m.value}
            </text>
            {/* metric name + status under axis */}
            <text x={cx} y={H - PAD_B + 18} fontSize="11" fontWeight={isActive ? 700 : 500}
                  textAnchor="middle" fill={isActive ? 'var(--god-text)' : 'var(--god-text-sub)'}>
              {m.key}
            </text>
            <text x={cx} y={H - PAD_B + 32} fontSize="9" textAnchor="middle"
                  fill={m.proven ? 'var(--god-accent)' : 'var(--god-warn)'}>
              {m.proven ? t('已证', 'proven') : t('上下界', 'bounds')}
            </text>
          </g>
        );
      })}
      <text x={(PAD_L + W - PAD_R) / 2} y={14} fontSize="10.5" textAnchor="middle" fill="var(--god-text-mute)">
        {t('直径(步数)', 'diameter (moves)')}
      </text>
    </svg>
  );
}

/* ── references (primary sources from the fact data) ─────────────────── */

const REFS: RefItem[] = [
  { url: 'https://www.cube20.org/',
    zh: 'cube20.org — Rokicki、Kociemba、Davidson、Dethridge:HTM 上帝之数 = 20 的官方证明站,含陪集框架、Google 算力、distance-20 分布。',
    en: 'cube20.org — Rokicki, Kociemba, Davidson, Dethridge: the official proof site for HTM God\'s number = 20, with the coset framework, Google compute, and distance-20 distribution.' },
  { url: 'https://www.cube20.org/qtm/',
    zh: 'cube20.org/qtm — QTM 上帝之数 = 26 的证明(2014,Rokicki & Davidson),同套陪集方法。',
    en: 'cube20.org/qtm — proof that the QTM God\'s number = 26 (2014, Rokicki & Davidson) using the same coset method.' },
  { url: 'https://epubs.siam.org/doi/abs/10.1137/120867366',
    zh: 'Rokicki, Kociemba, Davidson, Dethridge,《The Diameter of the Rubik\'s Cube Group Is Twenty》,SIAM J. Discrete Math. (2013):20 的同行评审版本。',
    en: 'Rokicki, Kociemba, Davidson, Dethridge, "The Diameter of the Rubik\'s Cube Group Is Twenty", SIAM J. Discrete Math. (2013): the peer-reviewed account of the 20 result.' },
];

export default function Cube333({ isZh }: { isZh: boolean; eventId?: string }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [metric, setMetric] = useState<MetricKey>('HTM');
  const sel = METRICS.find((m) => m.key === metric)!;

  const cards: HighlightCard[] = [
    {
      num: '20',
      cap: t('HTM 上帝之数(已证)', "HTM God's number (proven)"),
      sub: t('Rokicki 等 2010', 'Rokicki et al. 2010'),
      tone: 'accent',
    },
    {
      num: '26',
      cap: t('QTM 上帝之数(已证)', "QTM God's number (proven)"),
      sub: t('Rokicki & Davidson 2014', 'Rokicki & Davidson 2014'),
      tone: 'accent',
    },
    {
      num: <TeX src={String.raw`18\!-\!20`} />,
      cap: t('STM 上下界(未解)', 'STM bounds (open)'),
      sub: t('尚无精确值', 'no exact value yet'),
      tone: 'warn',
    },
    {
      num: <span style={{ fontSize: '1.15rem' }}><MathText>{'4.3252 × 10¹⁹'}</MathText></span>,
      cap: t('合法状态数', 'Reachable states'),
      sub: t('约 4325 亿亿', '~43 quintillion'),
      tone: 'wca',
    },
  ];

  const stateStats: StatItem[] = [
    {
      label: t('合法状态数', 'Reachable states'),
      value: <span style={{ fontFamily: "'LiberationMono', ui-monospace, monospace", fontSize: '0.92rem', wordBreak: 'break-all' }}>43,252,003,274,489,856,000</span>,
    },
    { label: t('科学计数', 'Scientific'), value: <MathText>{'4.3252 × 10¹⁹'}</MathText> },
    { label: t('陪集数(P1 子群)', 'Cosets (P1 subgroup)'), value: <span style={{ fontFamily: "'LiberationMono', ui-monospace, monospace" }}>2,217,093,120</span> },
  ];

  return (
    <>
      <EvHighlights cards={cards} />

      <EvCallout tone="info" heading={t('一群,五个 WCA 项目', 'One group, five WCA events')}>
        {t(
          '三阶(333)、单手(333oh)、三盲(333bf)、最少步(333fm)、多盲(333mbf)用的是同一个魔方,因此同一个群,上帝之数完全相同——20 步 HTM。它们的「难」来自规则与执行方式,不来自群结构。',
          'Standard (333), one-handed (333oh), blindfolded (333bf), fewest moves (333fm) and multi-blind (333mbf) are the same physical puzzle — the same group — so their God\'s number is identical: 20 HTM. Their difficulty comes from the rules and execution, not from the group structure.',
        )}{' '}
        <Link href="/math/god?event=333oh">{t('单手 →', 'OH →')}</Link>{'   '}
        <Link href="/math/god?event=333bf">{t('三盲 →', 'BLD →')}</Link>{'   '}
        <Link href="/math/god?event=333fm">{t('最少步 →', 'FMC →')}</Link>{'   '}
        <Link href="/math/god?event=333mbf">{t('多盲 →', 'MBLD →')}</Link>
      </EvCallout>

      {/* ── §1 the group & its order ───────────────────────────────── */}
      <EvSection
        title={<><Cog size={20} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 8, color: 'var(--god-accent)' }} />{t('魔方群与它的阶', 'The cube group and its order')}</>}
        lead={t(
          '三阶魔方的所有可达状态构成一个有限群 G。它的阶——也就是合法状态数——是上帝之数研究里第一个要钉死的数字。',
          'All reachable states of the 3×3 form a finite group G. Its order — the number of reachable states — is the first number any God\'s-number study must pin down.',
        )}
      >
        <p>
          {t(
            '把 8 个角块、12 个棱块各自的位置与朝向乘起来,再除掉物理上达不到的那一半构型,就得到 G 的阶。关键的那个 ÷2 来自一条守恒律:角块的整体置换奇偶必须等于棱块的整体置换奇偶,所以单独翻一个棱、或单独转一个角、或只对换两块,都是拼不出来的。',
            'Multiplying the placements and orientations of the 8 corners and 12 edges, then dividing out the half of configurations that are physically unreachable, gives the order of G. That crucial ÷2 comes from a conservation law: the parity of the corner permutation must equal the parity of the edge permutation, so flipping a single edge, twisting a single corner, or swapping just two pieces is impossible.',
          )}
        </p>
        <TeXBlock src={String.raw`|G| = 8!\cdot 3^{7}\cdot \frac{12!}{2}\cdot 2^{11} = 43{,}252{,}003{,}274{,}489{,}856{,}000`} />
        <EvCallout heading={t('为什么是 3⁷ 和 2¹¹,不是 3⁸ 和 2¹²', 'Why 3⁷ and 2¹¹, not 3⁸ and 2¹²')}>
          {t(
            '8 个角块各有 3 种朝向,但最后一个角的朝向被前 7 个锁死(角朝向之和模 3 守恒),所以是 3⁷ 而非 3⁸。同理 12 个棱块各有 2 种朝向,最后一个被前 11 个锁死(棱翻转之和模 2 守恒),所以是 2¹¹。把朴素乘积 8!×3⁸×12!×2¹² 写成裸积会得到真实阶的 12 倍——务必把朝向约束与那条 ÷2 的排列约束都写出来。',
            'Each of the 8 corners has 3 orientations, but the last corner is fixed by the first 7 (corner twists sum to 0 mod 3), giving 3⁷ not 3⁸. Likewise the 12 edges each have 2 orientations and the last is fixed by the first 11 (edge flips sum to 0 mod 2), giving 2¹¹. Writing the naive product 8!×3⁸×12!×2¹² overshoots the true order by a factor of 12 — always spell out the orientation constraints and that permutation ÷2.',
          )}
        </EvCallout>
        <EvStatStrip items={stateStats} />
      </EvSection>

      {/* ── §2 the three metrics (toggle + bespoke SVG) ────────────── */}
      <EvSection
        title={<><Layers size={20} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 8, color: 'var(--god-accent)' }} />{t('一个魔方,三套度量', 'One puzzle, three metrics')}</>}
        lead={t(
          '「最少几步」完全取决于你怎么数步。三阶有三套常用度量,其中两套的上帝之数已被穷举证明,第三套只有上下界。点下面的钮或柱子切换。',
          'How few moves depends entirely on how you count a move. The 3×3 has three common metrics: two have proven God\'s numbers, the third has only bounds. Tap a button or a bar below to switch.',
        )}
      >
        <div className="god-metric-tabs" style={{ marginBottom: 16 }}>
          {METRICS.map((m) => (
            <button key={m.key}
                    className={`god-metric-tab ${metric === m.key ? 'is-on' : ''}`}
                    onClick={() => setMetric(m.key)}>
              {m.key}
            </button>
          ))}
        </div>

        <div className="god-metric-wrap">
          <MetricChart isZh={isZh} active={metric} onPick={setMetric} />
          <div className="god-metric-defn" style={{ marginTop: 14, marginBottom: 8 }}>
            <strong style={{ color: 'var(--god-text)' }}>{tr(sel.name)}</strong>
            {' — '}
            {tr(sel.defn)}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            fontSize: '0.85rem', fontWeight: 600,
            color: sel.proven ? 'var(--god-accent)' : 'var(--god-warn)',
          }}>
            {sel.proven
              ? <CheckCircle2 size={16} />
              : <CircleDashed size={16} />}
            {tr(sel.status)}
          </div>
        </div>

        <EvCallout tone="warn" heading={t('STM 不是已证值', 'STM is not a proven value')}>
          {t(
            '请勿把 STM 报成「20」或任何精确数字:切片度量的上帝之数从未被证出,公开结果只是区间 [18, 20]。把它当成与 HTM 20、QTM 26 同级的「已证精确值」是错误的。',
            'Do not report STM as "20" or any exact figure: the slice-turn God\'s number has never been proven, and the published result is only the interval [18, 20]. Treating it as a proven exact value on par with HTM 20 or QTM 26 is wrong.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §3 how it was proved ───────────────────────────────────── */}
      <EvSection
        title={<><Sparkles size={20} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 8, color: 'var(--god-accent)' }} />{t('20 是怎么证出来的', 'How 20 was actually proved')}</>}
        lead={t(
          '直接对 4.3 × 10¹⁹ 个状态做 BFS 完全不可行——光是给每个状态存一个「距离」就要 EB 级存储。Tomas Rokicki 团队 2010 年的胜利靠三件武器:陪集分解、对称压缩、集合覆盖。',
          'A direct BFS over 4.3 × 10¹⁹ states is impossible — even one distance byte per state would need exabytes. Tomas Rokicki\'s 2010 victory came from three weapons: coset decomposition, symmetry compression, and set cover.',
        )}
      >
        <p>
          {t(
            '关键子群是 H = ⟨U, D, L², R², F², B²⟩——Kociemba 1992 年发明的「P1 / G1」子群,只允许 U、D 两个面 90° 转,其余四个面只能 180° 转。',
            'The key subgroup is H = ⟨U, D, L², R², F², B²⟩ — Kociemba\'s 1992 "P1 / G1" group, which allows quarter turns only on U and D and half turns on the other four faces.',
          )}{' '}
          <MathText>{t(
            '它的阶 |H| = 19,508,428,800,因此陪集数 |G|/|H| = 2,217,093,120。每个陪集是一组在 H 内可互达的等价状态,只需对每个陪集求一次「代表元最优解」,就把 4.3 × 10¹⁹ 维的图缩成约 22 亿维。',
            'Its order |H| = 19,508,428,800, so the number of cosets |G|/|H| = 2,217,093,120. Each coset is a set of states mutually reachable inside H; solving one optimal representative per coset shrinks a 4.3 × 10¹⁹-vertex graph to about 2.2 billion.',
          )}</MathText>
        </p>
        <TeXBlock src={String.raw`\frac{|G|}{|H|} = \frac{43{,}252{,}003{,}274{,}489{,}856{,}000}{19{,}508{,}428{,}800} = 2{,}217{,}093{,}120 \;\text{cosets}`} />
        <p>
          {t(
            '再用立方体的对称群 S₄₈(24 个旋转 + 镜像共 48 个)把陪集压成约 5588 万个对称类;然后用贪心「集合覆盖」把相邻陪集吞进约 80 个 super-coset,最终只对这些 super-coset 实际求解。',
            'Then the cube\'s symmetry group S₄₈ (24 rotations plus reflections, 48 in all) crushes the cosets to about 55.88 million symmetry classes; a greedy set cover absorbs neighbouring cosets into roughly 80 super-cosets that are actually solved.',
          )}
        </p>
        <p>
          {t(
            'Google 的集群为此跑了约 35 CPU-年。2010-07-13 团队宣布:任意三阶状态都能在 ≤ 20 步 HTM 内还原,且确实存在需要满 20 步的状态(superflip 是其中之一)。上界(每个状态都 ≤ 20)与下界(superflip ≥ 20,Reid 1995 已证)在 20 处相合——上帝之数 = 20,证毕。',
            'Google\'s cluster spent about 35 CPU-years. On 2010-07-13 the team announced: every 3×3 state is solvable in ≤ 20 HTM, and some states genuinely need the full 20 (superflip among them). The upper bound (every state ≤ 20) and the lower bound (superflip ≥ 20, proven by Reid in 1995) meet at 20 — God\'s number = 20, QED.',
          )}
        </p>
        <EvCallout heading={t('QTM = 26 是同一套框架', 'QTM = 26 reuses the same framework')}>
          {t(
            '四分之一转度量下的直径 26 是 Rokicki 与 Davidson 在 2014 年用同一套陪集 + 对称方法证出的,算力换成了 Ohio 超算中心、约 29 CPU-年。切片度量(STM)则没有这样的合拢结果——它至今只有 18–20 的区间。',
            'The quarter-turn diameter of 26 was proven by Rokicki and Davidson in 2014 with the same coset-plus-symmetry method, run on the Ohio Supercomputer Center for about 29 CPU-years. The slice-turn metric (STM) has no such closure — it remains an interval of 18–20.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §4 the antipodes / superflip (reused interactive) ──────── */}
      <EvSection
        title={t('最难的状态:Superflip 与它的同类', 'The hardest states: superflip and its kin')}
        lead={t(
          '需要满 20 步的状态被称为 antipode(对径点)。Superflip——12 棱全翻、8 角不动——是 1995 年第一个被证为 distance-20 的状态,也是上帝之数下界的奠基。',
          'States needing the full 20 are called antipodes. Superflip — all 12 edges flipped, all 8 corners fixed — was the first state proven to be distance-20 (1995) and is the cornerstone of the lower bound.',
        )}
      >
        <Suspense fallback={<Loading />}>
          <SuperflipShowcase isZh={isZh} />
        </Suspense>
      </EvSection>

      {/* ── §5 the FMC / minimum-solution distribution (reused) ────── */}
      <EvSection
        title={t('最少步分布', 'The minimum-solution distribution')}
        lead={t(
          '随机抽一个三阶打乱,它的最优解长度服从一个极其偏斜的分布:超过 99% 落在 17–19 步,恰好 20 步的 antipode 稀有到约 10⁻¹¹。这就是为什么 FMC 选手即便有一小时也几乎凑不出 20 步、更别提 16 步纪录。',
          'Pick a random 3×3 scramble and its optimal length follows a sharply skewed distribution: over 99% lands in 17–19 moves, and exact-20 antipodes are as rare as about 10⁻¹¹. That is why FMC competitors, even with an hour, can barely contrive a 20-move solution — let alone the 16-move record.',
        )}
      >
        <Suspense fallback={<Loading />}>
          <DistanceDistribution isZh={isZh} />
        </Suspense>
      </EvSection>

      <EvRefs refs={REFS} />
    </>
  );
}
