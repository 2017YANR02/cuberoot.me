'use client';

/**
 * /math/god?event=444 — the 4×4×4 (Rubik's Revenge).
 *
 * The 4×4 is the cleanest "bounds, not proven" story in the WCA set: a state
 * space of 7.40×10⁴⁵, no exhaustive diameter, only a lower bound of 35 OBTM
 * from a counting argument and an upper bound of 55 OBTM from Shuang Chen's
 * 2015 refinement of Tsai's 8-step reduction (earlier 57, confirmed by Rokicki
 * — NOT a Kociemba reduction). A 20-move gap remains open.
 *
 *   highlights (|G|, lower 35, upper 55, gap 20)
 *   §1 the group & state space (indistinguishable centres → /24 × 4!⁶)
 *   §2 the bounds + the bespoke number-line bracket (hoverable endpoints)
 *   §3 how the upper bound was reached (reduction-stage slider)
 *   §4 history & the open gap (+ reused N×N growth chart)
 *   references
 */
import { Suspense, lazy, useMemo, useState } from 'react';
import { ArrowRight, Boxes, Ruler } from 'lucide-react';
import Link from '@/components/AppLink';
import {
  EvHighlights, EvSection, EvCallout, EvRefs, EvStatStrip,
  TeX, TeXBlock, MathText, type HighlightCard, type RefItem, type StatItem,
} from './_shared';

const GrowthChart = lazy(() => import('../GrowthChart'));

/* exact |G| — far beyond 2^53, MUST stay a string. */
const STATES_EXACT =
  '7,401,196,841,564,901,869,874,093,974,498,574,336,000,000,000';

const REFS: RefItem[] = [
  {
    url: 'https://en.wikipedia.org/wiki/Rubik%27s_Revenge',
    zh: 'Wikipedia,Rubik\'s Revenge:态空间 7.40×10⁴⁵ 的精确表达式与 24 × 4!⁶ 的中心块不可区分修正。',
    en: 'Wikipedia — Rubik\'s Revenge: the exact 7.40×10⁴⁵ state-count expression and the 24 × 4!⁶ indistinguishable-centre correction.',
  },
  {
    url: 'https://www.speedsolving.com/threads/what-is-gods-number-on-a-4x4-rubiks-cube.35965/',
    zh: 'Speedsolving 讨论串:4×4 上帝之数的上下界 35 / 55 OBTM,Chen 2015 改进 Tsai 八步归约(由 57 降到 55),以及计数论证给出的下界。',
    en: 'Speedsolving thread — the 35 / 55 OBTM bounds for the 4×4, Chen\'s 2015 improvement of Tsai\'s 8-step reduction (57 → 55), and the counting-argument lower bound.',
  },
  {
    url: 'https://www.cube20.org/',
    zh: 'cube20.org:三阶 HTM 直径 = 20 的证明主页,作为「精确解」与本页「只有界」的对照。',
    en: 'cube20.org — the proof that the 3×3 HTM diameter = 20, the "proven exact" foil to this page\'s "bounds only".',
  },
  {
    url: 'https://arxiv.org/abs/1106.5736',
    zh: 'Demaine 等 2011(arXiv:1106.5736):N 阶魔方上帝之数渐近 Θ(N²/log N),下界用合法序列计数(本页 35 下界的同一思路)。',
    en: 'Demaine et al. 2011 (arXiv:1106.5736) — the Θ(N²/log N) asymptotic for the N×N God\'s number; the lower bound uses canonical-sequence counting, the same idea behind the 35 here.',
  },
];

/* ─── reduction-stage model (for the slider) ──────────────────────────── */

interface Stage {
  zh: string; en: string;
  descZh: string; descEn: string;
}
const STAGES: Stage[] = [
  {
    zh: '打乱态',
    en: 'Scrambled',
    descZh: '一个任意的 4×4 态。没有任何已知方法能逐态算出它的最优 OBTM 步数——态空间 7.40×10⁴⁵ 远超任何穷举。',
    descEn: 'An arbitrary 4×4 state. No method computes its optimal OBTM length state-by-state — the 7.40×10⁴⁵ space dwarfs any exhaustive search.',
  },
  {
    zh: '中心块归位',
    en: 'Centres solved',
    descZh: '先把 6 组各 4 个中心块拼回各自的面。同色的 4 个中心块彼此不可区分,这正是态空间里每面除以 4!(连同整体 24 个朝向再除 24)那个除子的来源。',
    descEn: 'First rebuild the six groups of four centre pieces onto their faces. The four like-coloured centres are mutually indistinguishable — exactly the per-face 4! divisor (together with the extra /24 for the cube\'s 24 orientations) in the state count.',
  },
  {
    zh: '配对棱块',
    en: 'Edges paired',
    descZh: '把 24 个外层棱块两两配成 12 个「假棱」。这一步消去了 4×4 相对 3×3 的额外自由度,但会引入只有 4×4 才有的宇称。',
    descEn: 'Pair the 24 outer edge pieces into 12 "dedges". This removes the extra 4×4 freedom over the 3×3, but introduces the parities unique to even cubes.',
  },
  {
    zh: '归约为 3×3',
    en: 'Reduced to 3×3',
    descZh: '中心与棱都就位后,魔方表现得就像一个三阶,只是可能带 OLL / PLL 宇称。Tsai 的八步归约就是把这一整段限定在最多八「步」内完成。',
    descEn: 'With centres and edges fixed, the cube behaves like a 3×3 — possibly carrying OLL/PLL parity. Tsai\'s 8-step reduction caps this whole phase in at most eight "stages".',
  },
  {
    zh: '解 3×3 + 修宇称',
    en: 'Solve 3×3 + parity',
    descZh: '最后像三阶一样收尾,并在需要时插入修复宇称的算法。Chen 2015 通过更紧的归约把整条路径的最坏情形压到 55 OBTM(早先是 57,经 Rokicki 复核)。',
    descEn: 'Finish like a 3×3, inserting parity-fix algorithms where needed. Chen\'s 2015 tighter reduction caps the whole worst-case path at 55 OBTM (the earlier figure was 57, confirmed by Rokicki).',
  },
];

/* ─── bespoke number-line bracket ─────────────────────────────────────── */

type EndKey = 'lower' | 'upper' | null;

function NumberLine({ isZh, hovered, onHover }: {
  isZh: boolean;
  hovered: EndKey;
  onHover: (k: EndKey) => void;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  // domain 25..60 → x; lower 35, upper 55.
  const VW = 680, VH = 150;
  const padL = 44, padR = 44;
  const axisY = 96;
  const dMin = 25, dMax = 60;
  const x = (d: number) => padL + ((d - dMin) / (dMax - dMin)) * (VW - padL - padR);
  const ticks = [25, 30, 35, 40, 45, 50, 55, 60];
  const xLo = x(35), xHi = x(55);

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width="100%"
      style={{ maxWidth: VW, height: 'auto', display: 'block' }}
      role="img"
      aria-label={t('4×4 上帝之数区间数轴', '4×4 God\'s-number bracket number line')}
    >
      {/* gap band between the two bounds */}
      <rect
        x={xLo} y={axisY - 13} width={xHi - xLo} height={26} rx={5}
        fill="var(--god-warn-soft)"
      />
      <text x={(xLo + xHi) / 2} y={axisY - 22} textAnchor="middle"
            fontSize={12} fill="var(--god-warn)" fontWeight={600}>
        {t('20 步未知区间', '20-move open gap')}
      </text>

      {/* axis */}
      <line x1={padL} y1={axisY} x2={VW - padR} y2={axisY}
            stroke="var(--god-border-strong)" strokeWidth={1.5} />
      {ticks.map((d) => (
        <g key={d}>
          <line x1={x(d)} y1={axisY - 5} x2={x(d)} y2={axisY + 5}
                stroke="var(--god-border-strong)" strokeWidth={1} />
          <text x={x(d)} y={axisY + 20} textAnchor="middle"
                fontSize={11} fill="var(--god-text-mute)"
                fontFamily="ui-monospace, monospace">{d}</text>
        </g>
      ))}

      {/* lower endpoint */}
      <g style={{ cursor: 'pointer' }}
         onMouseEnter={() => onHover('lower')}
         onMouseLeave={() => onHover(null)}
         onFocus={() => onHover('lower')} onBlur={() => onHover(null)}
         tabIndex={0}>
        <line x1={xLo} y1={axisY - 30} x2={xLo} y2={axisY + 8}
              stroke="var(--god-warn)" strokeWidth={hovered === 'lower' ? 4 : 2.5} />
        <circle cx={xLo} cy={axisY} r={hovered === 'lower' ? 8 : 6}
                fill="var(--god-warn)" />
        <text x={xLo} y={axisY - 38} textAnchor="middle"
              fontSize={16} fontWeight={700} fill="var(--god-warn)"
              fontFamily="ui-monospace, monospace">35</text>
        <text x={xLo} y={axisY + 38} textAnchor="middle"
              fontSize={10.5} fill="var(--god-text-sub)">
          {t('下界 ≥', 'lower ≥')}
        </text>
      </g>

      {/* upper endpoint */}
      <g style={{ cursor: 'pointer' }}
         onMouseEnter={() => onHover('upper')}
         onMouseLeave={() => onHover(null)}
         onFocus={() => onHover('upper')} onBlur={() => onHover(null)}
         tabIndex={0}>
        <line x1={xHi} y1={axisY - 30} x2={xHi} y2={axisY + 8}
              stroke="var(--god-accent)" strokeWidth={hovered === 'upper' ? 4 : 2.5} />
        <circle cx={xHi} cy={axisY} r={hovered === 'upper' ? 8 : 6}
                fill="var(--god-accent)" />
        <text x={xHi} y={axisY - 38} textAnchor="middle"
              fontSize={16} fontWeight={700} fill="var(--god-accent)"
              fontFamily="ui-monospace, monospace">55</text>
        <text x={xHi} y={axisY + 38} textAnchor="middle"
              fontSize={10.5} fill="var(--god-text-sub)">
          {t('上界 ≤', 'upper ≤')}
        </text>
      </g>
    </svg>
  );
}

export default function Cube444({ isZh }: { isZh: boolean; eventId?: string }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [hovered, setHovered] = useState<EndKey>(null);
  const [stage, setStage] = useState(0);

  const cards: HighlightCard[] = [
    {
      num: <TeX src={String.raw`\ge 35`} />,
      cap: t('OBTM 下界', 'OBTM lower bound'),
      sub: t('计数论证(社区)', 'Counting argument (community)'),
      tone: 'warn',
    },
    {
      num: <TeX src={String.raw`\le 55`} />,
      cap: t('OBTM 上界', 'OBTM upper bound'),
      sub: t('Shuang Chen 2015(Tsai 归约)', 'Shuang Chen 2015 (Tsai reduction)'),
      tone: 'warn',
    },
    {
      num: '20',
      cap: t('未知缝隙(步)', 'Open gap (moves)'),
      sub: t('上下界仍未合拢', 'Bounds not yet met'),
      tone: 'warn',
    },
    {
      num: <TeX src={String.raw`7.40 \times 10^{45}`} />,
      cap: t('态空间', 'State space'),
      sub: t('约 7.4 × 10⁴⁵', '~7.4 × 10⁴⁵'),
      tone: 'wca',
    },
  ];

  const stateItems: StatItem[] = [
    {
      label: t('合法状态数', 'Reachable states'),
      value: <MathText>{'|G| = 7.40 × 10⁴⁵'}</MathText>,
    },
    {
      label: t('精确计数', 'Exact count'),
      value: (
        <span className="god-mono" style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>
          {STATES_EXACT}
        </span>
      ),
    },
    {
      label: t('上帝之数', 'God\'s number'),
      value: <MathText>{'35 ≤ d ≤ 55 (OBTM)'}</MathText>,
    },
  ];

  const cur = STAGES[stage];

  const hoverBox = useMemo(() => {
    if (hovered === 'lower') {
      return {
        head: t('下界 d ≥ 35:计数论证', 'Lower bound d ≥ 35: a counting argument'),
        body: t(
          '这不是穷举,而是一条纯计数的鸽巢论证:在 OBTM 下,长度为 n 的不同走法序列数最多约为某个 b 的 n 次方;若一个深度内能写出的不同序列还没盖住 7.40×10⁴⁵ 个状态,这个深度就不可能是直径。把不等式解出来,得到「至少要 35 步才可能覆盖全部状态」,于是 d ≥ 35。它由社区给出,不归功于 Tronto / Sheu,也不归功于 Norskog。',
          'This is not a search but a pure counting (pigeonhole) argument: in OBTM the number of distinct length-n move sequences grows at most like some base b to the n; if everything writable within a given depth still cannot cover all 7.40×10⁴⁵ states, that depth cannot be the diameter. Solving the inequality forces "at least 35 moves to possibly reach every state", so d ≥ 35. It is a community result — not attributed to Tronto/Sheu, nor to Norskog.',
        ),
      };
    }
    if (hovered === 'upper') {
      return {
        head: t('上界 d ≤ 55:Chen 2015 改进 Tsai 归约', 'Upper bound d ≤ 55: Chen 2015 improves Tsai\'s reduction'),
        body: t(
          '上界靠一个能保证步数封顶的算法:把任意 4×4 归约成带宇称的 3×3 再求解。Hoey / Tsai 的「八步归约」给出最坏情形约 57 步(经 Tomas Rokicki 复核),Shuang Chen 2015 年用更紧的归约把它压到 55 OBTM。注意:这是归约法的上界,不是 Kociemba 两阶段直接套到 4×4 的结果,也不是穷举证明——所以 55 是「目前最好的封顶」,而非精确直径。',
          'The upper bound comes from an algorithm with a guaranteed cap: reduce any 4×4 to a 3×3-with-parity and solve that. The Hoey/Tsai "8-step reduction" gives a worst case around 57 (confirmed by Tomas Rokicki); Shuang Chen tightened it to 55 OBTM in 2015. Note: this is a reduction-method ceiling, not a Kociemba two-phase result transplanted to the 4×4, and not an exhaustive proof — so 55 is "the best ceiling we have", not the exact diameter.',
        ),
      };
    }
    return {
      head: t('把指针悬停在两端', 'Hover either endpoint'),
      body: t(
        '左端 35 是「下到这里都不够」的下界,右端 55 是「上到这里一定够」的上界。真正的上帝之数落在这 20 步宽的红色区间里某一点——至今没人知道是哪一点。',
        'The left endpoint 35 is a lower bound ("you cannot do it in fewer"); the right endpoint 55 is an upper bound ("you can always do it in this many"). The true God\'s number lies somewhere inside this 20-move red band — and nobody knows where.',
      ),
    };
  }, [hovered, isZh]);

  return (
    <>
      <EvHighlights cards={cards} />

      <EvCallout tone="warn" heading={t('只有界,没有精确值', 'Bounds only — no proven value')}>
        {t(
          '和三阶不同,4×4 的上帝之数从未被穷举证明。我们只知道它被夹在 35 与 55 之间(OBTM)。下面把这两个端点各自的来源讲清楚——它们来自完全不同的两种论证。',
          'Unlike the 3×3, the 4×4\'s God\'s number has never been proven by exhaustive search. We only know it is bracketed between 35 and 55 (OBTM). Below, each endpoint is pinned to its source — they come from two completely different kinds of argument.',
        )}
      </EvCallout>

      {/* ── §1 group & state space ──────────────────────────────── */}
      <EvSection
        title={t('壹　魔方与态空间', 'I — The puzzle & its state space')}
        lead={t(
          '4×4×4(Rubik\'s Revenge)没有固定的中心:每面 4 个中心块、24 个外层棱块、8 个角块全可移动,且没有固定面来锚定朝向。',
          'The 4×4×4 (Rubik\'s Revenge) has no fixed centres: four centre pieces per face, 24 outer edge pieces and 8 corners all move, with no fixed face to anchor orientation.',
        )}
      >
        <p>
          <MathText>{t(
            '朴素地把所有块的排列与朝向相乘会高估,因为同一面上 4 个中心块同色、彼此完全不可区分(每面除以 4!),而且四阶没有固定中心、整体有 24 个不可区分的朝向(再除以 24)。把这两重重复计数除掉(即除以 24 × 4!⁶),再乘上角块与棱块的贡献,精确态空间是 7.40 × 10⁴⁵。',
            'Naively multiplying every piece permutation and orientation overcounts: the four like-coloured centres on each face are mutually indistinguishable (divide each face by 4!), and the 4×4 has no fixed centres, so its 24 whole-cube orientations are indistinguishable too (divide by another 24). Removing both redundancies — dividing by 24 × 4!⁶ — and combining with the corner and edge contributions gives the exact state space 7.40 × 10⁴⁵.',
          )}</MathText>
        </p>
        <TeXBlock src={String.raw`|G| \;=\; \frac{8!\cdot 3^{7}\;\cdot\;24!\;\cdot\;24!}{24\;\cdot\;4!^{6}}\;=\;7.40\times10^{45}`} />
        <p className="god-sec-lead" style={{ margin: '0.4rem 0 1.25rem' }}>
          <MathText>{t(
            '其中 4!⁶ 这一项正是「同色中心块不可区分」造成的修正:6 个面各有 4! 种内部排列被算重;额外的 / 24 则来自四阶没有固定中心,整个魔方有 24 个不可区分的朝向。这个 7.40 × 10⁴⁵ 比三阶的 4.33 × 10¹⁹ 大了约 26 个数量级。',
            'The 4!⁶ factor is precisely the "indistinguishable like-coloured centres" correction: each of the 6 faces overcounts by 4! internal arrangements; the extra / 24 comes from the 4×4 having no fixed centres, so the whole cube has 24 indistinguishable orientations. This 7.40 × 10⁴⁵ is about 26 orders of magnitude larger than the 3×3\'s 4.33 × 10¹⁹.',
          )}</MathText>
        </p>
        <EvStatStrip items={stateItems} />
      </EvSection>

      {/* ── §2 the bounds + number line ─────────────────────────── */}
      <EvSection
        title={t('贰　两个界:35 与 55', 'II — The two bounds: 35 and 55')}
        lead={t(
          '4×4 的上帝之数是一个区间,不是一个数。把指针悬停在数轴两端,看每个端点各自靠什么论证站得住。',
          'The 4×4 God\'s number is an interval, not a number. Hover each end of the line to see what argument holds that endpoint up.',
        )}
      >
        <div className="god-chain-wrap">
          <NumberLine isZh={isZh} hovered={hovered} onHover={setHovered} />
          <div className="god-chain-caption" aria-live="polite">
            <strong style={{ color: 'var(--god-text)' }}>{hoverBox.head}</strong>
            <div style={{ marginTop: 6 }}>{hoverBox.body}</div>
          </div>
        </div>

        <EvCallout tone="info" heading={t('为什么用 OBTM 而不是 HTM', 'Why OBTM, not HTM')}>
          {t(
            '4×4 有内外两层切片,既能转外层面也能转内层「宽」面。OBTM(外层块转动度量)把一次外层转和一次相邻的内层宽转都计作 1 步,是 4×4 / 5×5 这类大魔方界文献的标准口径。两个端点 35 与 55 都按 OBTM 计。',
            'The 4×4 has inner and outer slices — you can turn outer faces and inner "wide" faces. OBTM (outer-block turn metric) counts an outer turn and an adjacent inner wide turn each as 1 move; it is the standard metric in the big-cube literature. Both endpoints 35 and 55 are stated in OBTM.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §3 how the upper bound was reached ──────────────────── */}
      <EvSection
        title={t('叁　上界是怎么得到的:归约', 'III — How the upper bound is reached: reduction')}
        lead={t(
          '没人能逐态算 4×4,但可以设计一个保证封顶的算法。主流路线是「归约法」:一步步把 4×4 变回一个带宇称的三阶。拖动滑块看每一阶段。',
          'Nobody can solve the 4×4 state-by-state, but you can design an algorithm with a guaranteed cap. The mainstream route is reduction: step by step, turn the 4×4 back into a 3×3-with-parity. Drag the slider through each stage.',
        )}
      >
        <div className="god-chain-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <Ruler size={18} style={{ color: 'var(--god-accent)', flexShrink: 0 }} />
            <input
              type="range" min={0} max={STAGES.length - 1} step={1}
              value={stage}
              onChange={(e) => setStage(Number(e.target.value))}
              aria-label={t('归约阶段', 'reduction stage')}
              style={{ flex: '1 1 200px', accentColor: 'var(--god-accent)', minWidth: 0 }}
            />
            <span style={{
              fontVariantNumeric: 'tabular-nums', color: 'var(--god-text-mute)',
              fontSize: '0.82rem', fontFamily: 'ui-monospace, monospace', flexShrink: 0,
            }}>
              {stage + 1} / {STAGES.length}
            </span>
          </div>

          {/* stage chips — also clickable controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {STAGES.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`god-metric-tab ${stage === i ? 'is-on' : ''}`}
                onClick={() => setStage(i)}
                style={{ fontSize: '0.8rem' }}
              >
                {t(s.zh, s.en)}
              </button>
            ))}
          </div>

          {/* stage flow indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {STAGES.map((s, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 9px', borderRadius: 6,
                  fontSize: '0.78rem', fontWeight: i === stage ? 700 : 500,
                  background: i <= stage ? 'var(--god-accent-soft)' : 'var(--god-surface-2)',
                  color: i <= stage ? 'var(--god-accent)' : 'var(--god-text-mute)',
                  border: `1px solid ${i === stage ? 'var(--god-accent)' : 'var(--god-border)'}`,
                }}>
                  {i === 1 && <Boxes size={13} />}
                  {t(s.zh, s.en)}
                </span>
                {i < STAGES.length - 1 && (
                  <ArrowRight size={13} style={{ color: 'var(--god-text-mute)' }} />
                )}
              </span>
            ))}
          </div>

          <div className="god-chain-caption">
            <strong style={{ color: 'var(--god-text)' }}>{t(cur.zh, cur.en)}</strong>
            <div style={{ marginTop: 6 }}>{t(cur.descZh, cur.descEn)}</div>
          </div>
        </div>

        <p style={{ marginTop: '1.25rem' }}>
          <MathText>{t(
            '关键是:归约给出的 55 是「这套算法最坏要 55 步」的上界,而真正的上帝之数只会更小或相等。它和三阶的 20 有本质区别——三阶的 20 是上界与下界相遇后被穷举证明的精确直径(见 cube20.org),而 4×4 的上下界还差着整整 20 步没有合拢。',
            'The point: the 55 from reduction is "this algorithm needs at most 55 in the worst case" — the true God\'s number can only be smaller or equal. This is fundamentally unlike the 3×3\'s 20, which is an exact diameter proven once the upper and lower bounds met (see cube20.org); the 4×4\'s bounds are still a full 20 moves apart.',
          )}</MathText>
        </p>
      </EvSection>

      {/* ── §4 history & the open gap ───────────────────────────── */}
      <EvSection
        title={t('肆　历史与未合拢的缝', 'IV — History & the gap that never closed')}
        lead={t(
          '把 4×4 放回 N 阶魔方的大图里:上帝之数随阶数按 Θ(N²/log N) 增长,而精确解只在最小的几个魔方上做到。',
          'Place the 4×4 in the N×N picture: the God\'s number grows like Θ(N²/log N) with cube size, while exact values exist only for the smallest few.',
        )}
      >
        <p>
          <MathText>{t(
            '上界一侧的历史很清晰:Hoey / Tsai 的八步归约给出约 57 OBTM 的最坏情形(由 Tomas Rokicki 复核),Shuang Chen 2015 年改进归约后降到 55。下界一侧则始终是计数论证给出的 35——没有人做出过更高的、被广泛接受的下界。换句话说,从 2015 年起这两个数字基本就钉在那里:35 和 55,中间空着 20 步,等着一个谁也还没找到的精确证明。',
            'The upper-bound history is clean: the Hoey/Tsai 8-step reduction gives a worst case around 57 OBTM (verified by Tomas Rokicki), and Shuang Chen\'s 2015 tighter reduction brought it to 55. The lower-bound side has stayed at the counting-argument 35 — no higher, widely-accepted lower bound has been produced. So since 2015 the two numbers have essentially been pinned: 35 and 55, with 20 moves of emptiness between them, awaiting an exact proof nobody has found.',
          )}</MathText>
        </p>

        <Suspense fallback={<div className="god-loading">…</div>}>
          <GrowthChart isZh={isZh} />
        </Suspense>

        <p style={{ marginTop: '1.25rem' }}>
          {t('对照已被证明的精确直径,看看「有界」与「已证」的差别:', 'For contrast with proven exact diameters — the difference between "bounded" and "proven":')}
          {' '}
          <Link href="/math/god?event=333">{t('三阶 = 20(已证) →', '3×3 = 20 (proven) →')}</Link>
          {'   '}
          <Link href="/math/god?event=555">{t('五阶 52–130(界更宽) →', '5×5 52–130 (even wider) →')}</Link>
        </p>
      </EvSection>

      <EvRefs refs={REFS} />
    </>
  );
}
