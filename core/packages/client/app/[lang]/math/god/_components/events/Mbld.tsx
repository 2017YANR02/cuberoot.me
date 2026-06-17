'use client';

/**
 * /math/god?event=333mbf — Multi-Blind (MBLD) God's number.
 *
 * MBLD is the rare WCA event with NOTHING new to prove group-theoretically:
 * it is k independent 3×3 cubes, so the puzzle group is G^k where G is the
 * 3×3 group, the state space is (4.3252×10¹⁹)^k, and the diameter is trivially
 * 20k HTM — each cube is solved in ≤ 20 (Rokicki et al. 2010) and the cubes do
 * not interact. The whole challenge is memory + blind execution.
 *
 *   intro (parametric diameter 20k + state-space tower + WR cards)
 *   §1  the product group G^k        → derivation, why diameter is 20k
 *   §2  20 HTM per cube              → the one borrowed proven fact (link to 333)
 *   §3  no new group theory          → where the difficulty actually lives + WR
 *   §4  a k-explorer                 → bespoke SVG: 20k line + |G|^k tower
 *   references
 */
import { Suspense, lazy, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { Brain, Layers, Timer } from 'lucide-react';
import {
  EvHighlights, EvSection, EvCallout, EvRefs, EvStatStrip,
  TeX, TeXBlock, type HighlightCard, type RefItem,
} from './_shared';

const Bfs2x2Demo = lazy(() => import('../Bfs2x2Demo'));

/* 3×3 single-cube ground truth (from god_data.ts / cube20.org). */
const SINGLE_STATES_EXACT = '43,252,003,274,489,856,000';
const SINGLE_STATES_SCI = String.raw`4.3252 \times 10^{19}`;

const REFS: RefItem[] = [
  { url: 'https://www.cube20.org/',
    zh: 'cube20.org:三阶 HTM 上帝之数 = 20 的证明(Rokicki, Kociemba, Davidson, Dethridge,2010),即本页每个魔方 ≤ 20 步的依据。',
    en: 'cube20.org — proof that the 3×3 HTM God\'s number = 20 (Rokicki, Kociemba, Davidson, Dethridge, 2010); the per-cube ≤ 20 fact this page rests on.' },
  { url: 'https://epubs.siam.org/doi/abs/10.1137/120867366',
    zh: 'Rokicki 等,《The Diameter of the Rubik\'s Cube Group Is Twenty》,SIAM J. Discrete Math. (2013):正式发表的直径 = 20 论文。',
    en: 'Rokicki et al., "The Diameter of the Rubik\'s Cube Group Is Twenty," SIAM J. Discrete Math. (2013) — the formal diameter = 20 paper.' },
  { url: 'https://www.worldcubeassociation.org/regulations/#H',
    zh: 'WCA 规则附则 H(盲拧):多盲一次尝试在 1 小时内还原多个魔方,成绩按「还原数 − 未还原数」记分。',
    en: 'WCA Regulations Appendix H (Blindfolded): Multi-Blind solves several cubes in one ≤ 1-hour attempt, scored as (solved − unsolved).' },
  { url: 'https://www.worldcubeassociation.org/results/rankings/333mbf/single',
    zh: 'WCA 333mbf 官方排名:多盲单次世界纪录与历史榜(本页所引 62/65 纪录可在此核对)。',
    en: 'WCA 333mbf official rankings — the Multi-Blind single world record and history (verify the 62/65 record here).' },
];

export default function Mbld({ isZh }: { isZh: boolean; eventId?: string }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  /* k-explorer state (deterministic initial render: k = 62, the WR). */
  const [k, setK] = useState(62);

  const cards: HighlightCard[] = [
    {
      num: <TeX src={String.raw`20\,k`} />,
      cap: t('HTM 直径(平凡 / 参数化)', 'HTM diameter (trivial / parametric)'),
      sub: t('k 个独立三阶,每个 ≤ 20', 'k independent 3×3 cubes, each ≤ 20'),
      tone: 'wca',
    },
    {
      num: 20,
      cap: t('每个魔方的 HTM 上帝之数', "HTM God's number per cube"),
      sub: t('已证 Rokicki 等 2010', 'Proven, Rokicki et al. 2010'),
      tone: 'accent',
    },
    {
      num: <TeX src={String.raw`(4.3{\times}10^{19})^{k}`} />,
      cap: t('态空间(笛卡尔积)', 'State space (Cartesian product)'),
      sub: <TeX src={String.raw`|G|^{k}`} />,
      tone: 'wca',
    },
    {
      num: '62/65',
      cap: t('多盲单次世界纪录', 'Multi-Blind single WR'),
      sub: t('Graham Siggins 2020,1 小时内', 'Graham Siggins, 2020 — within 1 hour'),
      tone: 'accent',
    },
  ];

  return (
    <>
      <EvHighlights cards={cards} />

      <div className="god-formula-block" style={{ display: 'block', maxWidth: '100%' }}>
        <TeXBlock src={String.raw`G_{\text{MBLD}} = \underbrace{G \times G \times \cdots \times G}_{k\ \text{copies}} = G^{k}, \qquad \operatorname{diam}\bigl(G^{k}\bigr) = 20\,k`} />
        <div className="god-formula-cap">
          {t(
            'MBLD 的群就是 k 个三阶群的直积,直径直接等于 20k 步 —— 没有任何新的群论。',
            "MBLD's group is just the direct product of k copies of the 3×3 group; its diameter is exactly 20k — no new group theory at all.",
          )}
        </div>
      </div>

      {/* ── §1 the product group ──────────────────────────────────── */}
      <EvSection
        title={t('壹　直积群 Gᵏ', 'I — The product group Gᵏ')}
        lead={t(
          '多盲不是一个新魔方,而是 k 个互不影响的三阶魔方摆在一起。它们的状态、它们的转动彼此独立,所以整体的群就是单魔方群的直积。',
          'Multi-Blind is not a new puzzle — it is k ordinary 3×3 cubes that never interact. Their states and their moves are mutually independent, so the overall group is just the direct product of the single-cube group.',
        )}
      >
        <p>
          {t(
            '设 G 是三阶魔方群,|G| = ',
            'Let G be the 3×3 cube group with |G| = ',
          )}
          <span className="god-mono" style={{ wordBreak: 'break-all' }}>{SINGLE_STATES_EXACT}</span>
          {t(' ≈ ', ' ≈ ')}
          <TeX src={SINGLE_STATES_SCI} />
          {t(
            '。把 k 个魔方编号 1…k,任意一个整体状态就是一个 k 元组 (g₁, …, gₖ),每个分量各自取遍 G。状态总数因此是各因子相乘:',
            '. Numbering the k cubes 1…k, any global state is a k-tuple (g₁, …, gₖ) with each component ranging independently over G. The total count is therefore the product of the factors:',
          )}
        </p>
        <TeXBlock src={String.raw`\bigl|G^{k}\bigr| \;=\; |G|^{k} \;=\; \bigl(4.3252 \times 10^{19}\bigr)^{k}.`} />
        <EvCallout tone="info" heading={t('为什么直径恰好是 20k', 'Why the diameter is exactly 20k')}>
          {t(
            '在直积群里,一次转动只作用在某一个魔方上(转第 i 个魔方不会动到其它任何一个)。要把所有 k 个魔方都还原,你必须分别把每个还原 —— 它们之间没有「顺手解决」的捷径。每个魔方最坏要 20 步(三阶 HTM 上帝之数),而且存在一种打乱让 k 个魔方同时都落在各自的 20 步最坏点上,于是整体最坏 = 20 + 20 + … + 20 = 20k。上界(总能在 20k 内解完)与下界(存在需要满 20k 的状态)在此重合,这就是「平凡」的含义:答案是从三阶直接推出来的,不需要再跑一次搜索。',
            'In a direct product, a single move acts on exactly one cube (turning cube i never touches any other). To solve all k cubes you must solve each one separately — there is no "two birds, one move" shortcut between them. Each cube needs up to 20 moves (the 3×3 HTM God\'s number), and there exist scrambles placing all k cubes simultaneously at their own 20-move worst case, so the global worst case is 20 + 20 + … + 20 = 20k. The upper bound (always solvable within 20k) meets the lower bound (a state genuinely needing the full 20k). That coincidence is what "trivial" means here: the answer drops straight out of the 3×3 result, with no new search required.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §2 the one borrowed fact ──────────────────────────────── */}
      <EvSection
        title={t('贰　唯一借来的硬事实:20', 'II — The one borrowed hard fact: 20')}
        lead={t(
          'MBLD 把整个数学重担都外包给了三阶。它需要、也只需要一个已证结论:任意三阶打乱都能在 20 步 HTM 内还原。',
          'MBLD outsources all of its mathematics to the 3×3. It needs — and only needs — one proven result: every 3×3 scramble is solvable in at most 20 HTM.',
        )}
      >
        <p>
          {t(
            '三阶的 HTM 上帝之数等于 20,这是 2010 年由 Rokicki、Kociemba、Davidson、Dethridge 把 4.3 × 10¹⁹ 个状态按 2,217,093,120 个陪集分组、再用对称性 + 集合覆盖压到约 5588 万个陪集,在 Google 的机器上跑了约 35 CPU-年证明的:既给出每个状态 ≤ 20 步的上界,又证明存在恰好需要 20 步的状态(如著名的 superflip)。MBLD 把这个 20 当作砖块,叠 k 次就完事。',
            'The 3×3 HTM God\'s number is 20, proven in 2010 by Rokicki, Kociemba, Davidson and Dethridge: they partitioned the 4.3 × 10¹⁹ states into 2,217,093,120 cosets, shrank that to ~55.88M via symmetry + set cover, and ran ~35 CPU-years on Google\'s machines — establishing both the ≤ 20 upper bound for every state and the existence of states (such as the superflip) that need exactly 20. MBLD treats that 20 as a single brick and simply stacks it k times.',
          )}
        </p>
        <EvStatStrip items={[
          { label: t('每个魔方最坏', 'Worst case per cube'), value: <><span style={{ color: 'var(--god-accent)' }}>20</span> HTM</> },
          { label: t('k 个魔方最坏', 'Worst case, k cubes'), value: <TeX src={String.raw`20\,k`} /> },
          { label: t('每个魔方态数', 'States per cube'), value: <TeX src={SINGLE_STATES_SCI} /> },
        ]} />
        <EvCallout heading={t('它和三阶 / 三盲 / 单手是同一个群', 'Same group as 3×3, 3BLD and OH')}>
          {t(
            '三阶、单手、三盲、最少步、以及多盲里的每一个魔方,共享同一个群,因此共享同一个上帝之数 20。不同的只是规则与执行方式,与群结构无关。',
            'The 3×3, One-Handed, 3×3-Blindfolded, Fewest-Moves, and every single cube inside Multi-Blind share one group and therefore one God\'s number, 20. Only the rules and execution differ — never the group structure.',
          )}{' '}
          <Link href="/math/god?event=333">
            {t('查看「三阶」直径 = 20 的完整证明 →', 'See the full 3×3 diameter = 20 proof →')}
          </Link>
        </EvCallout>
      </EvSection>

      {/* ── §3 where the difficulty lives ─────────────────────────── */}
      <EvSection
        title={t('叁　难度不在群里,在脑子里', 'III — The difficulty is in the brain, not the group')}
        lead={t(
          '群论说 MBLD 平凡;现实说它是 WCA 最残酷的项目之一。两者不矛盾 —— 难的从来不是「该怎么转」,而是「闭着眼记住并执行几十个魔方」。',
          'Group theory calls MBLD trivial; reality calls it one of the WCA\'s most brutal events. No contradiction — the hard part was never "which moves," but "memorize and execute dozens of cubes blindfolded."',
        )}
      >
        <p>
          {t(
            'WCA 规则:选手有最多 1 小时,先睁眼记忆全部魔方,再戴上眼罩逐个还原,全程不能再看。成绩按「还原数 − 未还原数」记分,且至少要还原一半以上才算有效。所以选手挑战的是记忆容量、记忆保持时间、以及盲拧执行的稳定性 —— 一个魔方的字母编码、一段会忘的回忆、一次手滑,都会让那个魔方报废。20k 这个直径在赛场上毫无意义:没有人按最优步数解多盲,真正稀缺的是注意力和时间。',
            'WCA rules: a competitor has up to 1 hour to first memorize every cube with eyes open, then don a blindfold and solve them one by one without ever looking again. The score is (solved − unsolved), and a majority must be solved to count. What is being tested is memory capacity, memory retention over time, and the reliability of blind execution — one cube\'s letter-pair encoding, one decayed memory, one slip of the hand, and that cube is lost. The 20k diameter is irrelevant on the floor: nobody solves Multi-Blind move-optimally; the scarce resources are attention and time.',
          )}
        </p>
        <div className="god-primer-grid" style={{ marginTop: '1rem' }}>
          <div className="god-primer-cell">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Brain size={16} /> {t('记忆,不是转动', 'Memory, not turning')}
            </h3>
            <p>{t(
              '每个魔方编码成一串字母对(角块 + 棱块),几十个魔方就是几百个待记的符号。瓶颈是脑容量与保持时间,不是手速。',
              'Each cube is encoded as letter-pairs (corners + edges); dozens of cubes mean hundreds of symbols to hold. The bottleneck is mental capacity and retention, not finger speed.',
            )}</p>
          </div>
          <div className="god-primer-cell">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Timer size={16} /> {t('一小时的硬墙', 'A one-hour hard wall')}
            </h3>
            <p>{t(
              '记忆 + 还原必须都塞进 60 分钟。攻几十个魔方意味着每个只剩一分钟出头去记和解,先记的还得撑到最后。',
              'Memorizing and solving must both fit in 60 minutes. Attempting dozens leaves barely a minute per cube to encode and solve — and the earliest memories must survive to the end.',
            )}</p>
          </div>
        </div>
        <EvCallout tone="accent" heading={t('世界纪录:62/65', 'World record: 62 out of 65')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Layers size={16} />
            {t(
              'Graham Siggins 在 2020 年尝试了 65 个魔方,在 1 小时内成功还原 62 个(分值 62 − 3 = 59),创下多盲单次世界纪录。请注意这衡量的全是人类记忆与执行的极限 —— 群论早就保证「这 65 个魔方理论上 20×65 = 1300 步 HTM 之内就能解完」,真正难的从来是闭眼记住它们。',
              'Graham Siggins attempted 65 cubes in 2020 and correctly solved 62 within one hour (score 62 − 3 = 59), setting the Multi-Blind single world record. Note this measures the limits of human memory and execution alone — group theory long ago guaranteed those 65 cubes are solvable in at most 20×65 = 1300 HTM; the genuinely hard part is memorizing them blind.',
            )}
          </span>
        </EvCallout>
      </EvSection>

      {/* ── §4 the k-explorer ─────────────────────────────────────── */}
      <EvSection
        title={t('肆　k 探索器', 'IV — The k-explorer')}
        lead={t(
          '拖动滑块改变魔方数量 k,看直径 20k 线性增长、而态空间 |G|ᵏ 以天文速度爆炸 —— 哪怕直径只是线性。',
          'Drag the slider to change the number of cubes k. Watch the diameter 20k grow linearly while the state space |G|ᵏ explodes astronomically — even though the diameter stays linear.',
        )}
      >
        <KExplorer isZh={isZh} k={k} setK={setK} />
        <p style={{ marginTop: '1rem' }}>
          {t(
            '一个对比:k = 62(现世界纪录),态空间已经是 (4.3 × 10¹⁹)⁶² ≈ 10¹²¹⁷ 这个量级 —— 远超可观测宇宙原子数(~10⁸²)的十几倍数量级幂塔。然而它的「上帝之数」不过 20 × 62 = 1240 步:态空间的爆炸完全没有反映在求解难度上,因为这些魔方彼此独立。这正是直积群的特征,也是 MBLD 在群论意义上「平凡」的根本原因。',
            'A contrast: at k = 62 (today\'s WR), the state space is already on the order of (4.3 × 10¹⁹)⁶² ≈ 10¹²¹⁷ — a tower of magnitudes far past the atoms in the observable universe (~10⁸²). Yet its "God\'s number" is merely 20 × 62 = 1240 moves: the explosion of the state space is completely invisible to solving difficulty, because the cubes are independent. That is the signature of a direct product, and the root reason MBLD is "trivial" in the group-theoretic sense.',
          )}
        </p>
      </EvSection>

      {/* ── §5 reuse: a single-cube BFS as the building block ─────── */}
      <EvSection
        title={t('伍　砖块本身:一个魔方的搜索', 'V — The brick itself: searching one cube')}
        lead={t(
          'MBLD 的全部数学就是「一个魔方」重复 k 次。下面这个二阶现场 BFS 让你直观感受「搜遍一个魔方的全部状态、读出它的直径」是什么意思 —— 三阶把同一件事做到了 20。',
          "All of MBLD's mathematics is just \"one cube\" repeated k times. The live 2×2 BFS below lets you feel what it means to search every state of a single puzzle and read off its diameter — the 3×3 did the same thing all the way to 20.",
        )}
      >
        <Suspense fallback={<div className="god-loading">…</div>}>
          <Bfs2x2Demo isZh={isZh} />
        </Suspense>
      </EvSection>

      <EvRefs refs={REFS} />
    </>
  );
}

/* ── bespoke SVG: k → (20k line, |G|^k tower) ───────────────────────── */

interface KProps { isZh: boolean; k: number; setK: (k: number) => void }

function KExplorer({ isZh, k, setK }: KProps) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const K_MAX = 65;
  // viewBox geometry — natural width 540, fully responsive.
  const W = 540, H = 240, PAD_L = 46, PAD_R = 22, PAD_T = 22, PAD_B = 36;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;

  const xOf = (kk: number) => PAD_L + ((kk - 1) / (K_MAX - 1)) * innerW;
  const D_MAX = 20 * K_MAX; // 1300
  const yOfD = (d: number) => PAD_T + innerH - (d / D_MAX) * innerH;

  const diameterPath = useMemo(() => {
    // straight line through 20*k for k = 1..K_MAX
    return `M${xOf(1)},${yOfD(20)} L${xOf(K_MAX)},${yOfD(20 * K_MAX)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const diameter = 20 * k;
  // log10 of |G|^k = k * log10(4.3252e19) ~= k * 19.6360
  const log10States = k * 19.636;
  const log10Display = log10States.toFixed(0);

  return (
    <div className="god-growth-wrap">
      {/* control row — flexWrap so it never overflows on mobile */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 240px', minWidth: 220 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--god-text-sub)', whiteSpace: 'nowrap' }}>
            {t('魔方数', 'Cubes')} <b style={{ color: 'var(--god-text)', fontVariantNumeric: 'tabular-nums' }}>k = {k}</b>
          </span>
          <input
            type="range" min={1} max={K_MAX} value={k}
            onChange={(e) => setK(Number(e.target.value))}
            style={{ flex: 1, minWidth: 120, accentColor: 'var(--god-accent)' }}
            aria-label={t('魔方数量 k', 'number of cubes k')}
          />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[1, 10, 48, 62, 65].map((preset) => (
            <button
              key={preset}
              type="button"
              className={`god-metric-tab ${k === preset ? 'is-on' : ''}`}
              style={{ padding: '4px 12px' }}
              onClick={() => setK(preset)}
            >
              {preset === 62 ? t('62 (WR)', '62 (WR)') : preset}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, height: 'auto', display: 'block' }}
           preserveAspectRatio="xMidYMid meet" role="img"
           aria-label={t('MBLD 直径 20k 随魔方数 k 的线性增长', 'MBLD diameter 20k growing linearly with cube count k')}>
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line key={p} x1={PAD_L} x2={W - PAD_R}
                y1={PAD_T + innerH * p} y2={PAD_T + innerH * p}
                stroke="var(--god-grid)" strokeDasharray="3 4" />
        ))}
        {/* y-axis labels (diameter HTM) */}
        {[0, 325, 650, 975, 1300].map((v) => (
          <text key={v} x={PAD_L - 8} y={yOfD(v) + 3} fontSize="9.5" textAnchor="end" fill="var(--god-text-sub)">
            {v}
          </text>
        ))}
        {/* x-axis ticks */}
        {[1, 13, 26, 39, 52, 65].map((kk) => (
          <text key={kk} x={xOf(kk)} y={H - PAD_B + 16} fontSize="10" textAnchor="middle" fill="var(--god-text-sub)">
            {kk}
          </text>
        ))}
        <text x={PAD_L + innerW / 2} y={H - 4} fontSize="9.5" textAnchor="middle" fill="var(--god-text-mute)">
          {t('魔方数 k', 'cubes k')}
        </text>
        {/* the 20k line */}
        <path d={diameterPath} stroke="var(--god-wca)" strokeWidth="2.2" fill="none" />
        {/* selected-k guide + marker */}
        <line x1={xOf(k)} x2={xOf(k)} y1={PAD_T} y2={PAD_T + innerH}
              stroke="var(--god-accent)" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
        <circle cx={xOf(k)} cy={yOfD(diameter)} r="5.5"
                fill="var(--god-accent)" stroke="var(--god-surface)" strokeWidth="1.6" />
        <text x={xOf(k)} y={yOfD(diameter) - 10} fontSize="11" fontWeight="700"
              textAnchor={k > K_MAX * 0.8 ? 'end' : 'middle'} fill="var(--god-accent)">
          {diameter} HTM
        </text>
      </svg>

      <div className="god-growth-legend">
        <span><i style={{ background: 'var(--god-wca)' }} /> <TeX src={String.raw`\operatorname{diam} = 20\,k`} /> {t('(线性,HTM)', '(linear, HTM)')}</span>
        <span><i style={{ background: 'var(--god-accent)' }} /> {t('当前选中的 k', 'currently selected k')}</span>
      </div>

      <div className="god-growth-readout">
        <strong>k = {k}{t(' 个魔方', ' cubes')}:</strong>{' '}
        {t('直径', 'diameter')} = <span style={{ color: 'var(--god-accent)' }}>20 × {k} = {diameter}</span> HTM
        <span style={{ margin: '0 0.5em', color: 'var(--god-text-mute)' }}>|</span>
        {t('态空间', 'state space')}{' '}
        <TeX src={String.raw`(4.3252 \times 10^{19})^{${k}} \approx 10^{${log10Display}}`} />
      </div>
    </div>
  );
}
