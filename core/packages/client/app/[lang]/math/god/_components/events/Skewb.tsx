'use client';

/**
 * /math/god?event=skewb — Skewb God's number deep-dive.
 *
 * Verified facts only (god_data.ts + god_deep_data.ts, cross-checked against
 * jaapsch.net/puzzles/skewb.htm):
 *   - |G| = 3,149,280  (exact)
 *   - HTM diameter = 11, PROVEN by exhaustive BFS (Jaap Scherphuis), metric =
 *     corner-axis twist.
 *   - Skewb / Pyraminx(no tips) / 2×2 all hit diameter 11 — a coincidence.
 * Do NOT over-claim: no per-depth distribution, no antipode count, no year
 * beyond what is in the fact file.
 *
 *   intro (3 highlight cards)
 *   §1  the puzzle & its four turning axes
 *   §2  |G| = 3,149,280 — the state-space decomposition
 *   §3  diameter 11, proven by full BFS (bespoke depth-ruler SVG + slider)
 *   §4  the 11-coincidence (2×2 / Pyraminx / Skewb), cross-event links
 *   references
 */
import { useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { Layers, GitCompareArrows } from 'lucide-react';
import {
  EvHighlights, EvSection, EvCallout, EvRefs, EvStatStrip,
  TeX, TeXBlock, type HighlightCard, type RefItem, type StatItem,
} from './_shared';

/* ── bespoke SVG: Skewb net (cross unfolding) ──────────────────────────
   A Skewb is cut along the 4 body diagonals, so each face shows the classic
   "X" split: a central diamond (the face centre) + 4 corner triangles. We draw
   a cross net (U on top, L F R B in a row, D at the bottom). Clicking toggles
   between highlighting the four *independent* axis corners and the four
   parity-bound corners. */

const NET_W = 360;
const NET_H = 270;
const S = 90; // face side

/** layout origins for the 6 faces of a cross net within NET_W x NET_H */
const FACES: { id: string; ox: number; oy: number }[] = [
  { id: 'U', ox: S, oy: 0 },
  { id: 'L', ox: 0, oy: S },
  { id: 'F', ox: S, oy: S },
  { id: 'R', ox: 2 * S, oy: S },
  { id: 'D', ox: S, oy: 2 * S },
];

function SkewbNet({ mode, accent, warn, mute, border, surface }: {
  mode: 'axis' | 'parity';
  accent: string; warn: string; mute: string; border: string; surface: string;
}) {
  // 4 corner triangles per face: TL, TR, BR, BL. We tint the "axis" set vs the
  // "parity" set so the viewer can see the two interlocking orbits of 4.
  // (which physical corners are which is a labelling choice; the point is the
  //  8 corners split into two interlocking tetrahedra of 4.)
  const axisTris = new Set(['U-TL', 'U-BR', 'F-TR', 'F-BL', 'R-TL', 'R-BR', 'L-TR', 'L-BL', 'D-TR', 'D-BL']);
  const cornerFill = (faceCornerKey: string) => {
    const isAxis = axisTris.has(faceCornerKey);
    if (mode === 'axis') return isAxis ? accent : surface;
    return isAxis ? surface : warn;
  };
  return (
    <svg viewBox={`0 0 ${NET_W} ${NET_H}`} width="100%"
         style={{ maxWidth: NET_W, display: 'block', margin: '0 auto' }}
         role="img" aria-label="Skewb net">
      {FACES.map((f) => {
        const cx = f.ox + S / 2, cy = f.oy + S / 2;
        const corners = [
          { k: 'TL', tri: `${f.ox},${f.oy} ${f.ox + S},${f.oy} ${cx},${cy}` },
          { k: 'TR', tri: `${f.ox + S},${f.oy} ${f.ox + S},${f.oy + S} ${cx},${cy}` },
          { k: 'BR', tri: `${f.ox + S},${f.oy + S} ${f.ox},${f.oy + S} ${cx},${cy}` },
          { k: 'BL', tri: `${f.ox},${f.oy + S} ${f.ox},${f.oy} ${cx},${cy}` },
        ];
        return (
          <g key={f.id}>
            {/* face background */}
            <rect x={f.ox} y={f.oy} width={S} height={S} fill={surface} stroke={border} strokeWidth={1.5} />
            {/* 4 corner triangles meeting at the centre diamond */}
            {corners.map((c) => (
              <polygon key={c.k} points={c.tri}
                       fill={cornerFill(`${f.id}-${c.k}`)} stroke={border} strokeWidth={1} />
            ))}
            {/* centre dot marks the rotatable face centre */}
            <circle cx={cx} cy={cy} r={6} fill={mute} stroke={border} strokeWidth={1} />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fontWeight={700}
                  fill={surface} style={{ pointerEvents: 'none' }}>{f.id}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── bespoke SVG: depth ruler 0..11 with a draggable slider ─────────────
   No per-depth counts are published in our fact file, so this ruler is a pure
   schematic: it shows the closed interval [0, 11] and marks where the chosen
   depth sits relative to the proven diameter. */
function DepthRuler({ depth, accent, warn, mute, border, text }: {
  depth: number; accent: string; warn: string; mute: string; border: string; text: string;
}) {
  const W = 360, H = 70, pad = 18;
  const D = 11;
  const span = W - 2 * pad;
  const xAt = (d: number) => pad + (d / D) * span;
  const ticks = Array.from({ length: D + 1 }, (_, i) => i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%"
         style={{ maxWidth: W, display: 'block' }} role="img" aria-label="depth ruler 0 to 11">
      {/* baseline */}
      <line x1={pad} y1={40} x2={W - pad} y2={40} stroke={border} strokeWidth={2} />
      {/* covered-so-far track */}
      <line x1={pad} y1={40} x2={xAt(depth)} y2={40} stroke={accent} strokeWidth={4} strokeLinecap="round" />
      {ticks.map((d) => (
        <g key={d}>
          <line x1={xAt(d)} y1={34} x2={xAt(d)} y2={46}
                stroke={d === D ? warn : d <= depth ? accent : mute} strokeWidth={d === D ? 3 : 1.5} />
          <text x={xAt(d)} y={60} textAnchor="middle" fontSize={9}
                fill={d === D ? warn : mute}>{d}</text>
        </g>
      ))}
      {/* current-depth knob */}
      <circle cx={xAt(depth)} cy={40} r={7} fill={accent} stroke={border} strokeWidth={1.5} />
      {/* diameter flag at 11 */}
      <text x={xAt(D)} y={22} textAnchor="middle" fontSize={10} fontWeight={700} fill={warn}>D = 11</text>
      <text x={pad} y={22} textAnchor="start" fontSize={9} fill={text}>0</text>
    </svg>
  );
}

const REFS: RefItem[] = [
  {
    url: 'https://www.jaapsch.net/puzzles/skewb.htm',
    zh: 'Jaap Scherphuis,Skewb 主页:零件模型、四条体对角转轴、态空间计数 |G| = 3,149,280,以及穷举 BFS 证出的 HTM 直径 11。',
    en: 'Jaap Scherphuis — Skewb page: piece model, the four body-diagonal axes, state count |G| = 3,149,280, and the HTM diameter 11 proven by exhaustive BFS.',
  },
  {
    url: 'https://www.jaapsch.net/puzzles/pyraminx.htm',
    zh: 'Jaap Scherphuis,Pyraminx 主页:无 tip 群直径同为 11,用于对照本页的「11 巧合」。',
    en: 'Jaap Scherphuis — Pyraminx page: the no-tip group also has diameter 11, the comparison for this page\'s "11 coincidence".',
  },
  {
    url: 'https://www.jaapsch.net/puzzles/cube2.htm',
    zh: 'Jaap Scherphuis,2×2 主页:HTM 直径 11(固定一角作锚点),三者中第三个 11。',
    en: 'Jaap Scherphuis — 2×2 page: HTM diameter 11 (fixing one corner as anchor), the third of the three 11s.',
  },
];

export default function Skewb({ isZh }: { isZh: boolean; eventId?: string }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [mode, setMode] = useState<'axis' | 'parity'>('axis');
  const [depth, setDepth] = useState(7);
  const [coincTab, setCoincTab] = useState<'skewb' | 'pyram' | '222'>('skewb');

  const cards: HighlightCard[] = [
    {
      num: '11',
      cap: t('上帝之数 (HTM)', "God's number (HTM)"),
      sub: t('已证 — 穷举 BFS (Jaap Scherphuis)', 'Proven — exhaustive BFS (Jaap Scherphuis)'),
      tone: 'accent',
    },
    {
      num: <span className="god-mono" style={{ fontSize: '1.15rem' }}>3,149,280</span>,
      cap: t('合法状态数 |G|', 'Reachable states |G|'),
      sub: t('精确 — 几秒就能 BFS 完整张图', 'Exact — the whole graph BFS-es in seconds'),
      tone: 'accent',
    },
    {
      num: '4',
      cap: t('独立转轴 (体对角)', 'Independent axes (body diagonals)'),
      sub: t('每轴 ±120°', 'Each turns ±120°'),
      tone: 'wca',
    },
  ];

  const stateItems: StatItem[] = useMemo(() => [
    { label: t('精确计数', 'Exact count'), value: <span className="god-mono">3,149,280</span> },
    { label: t('质因数分解', 'Prime factorisation'), value: <TeX src={String.raw`2^{5}\cdot 3^{9}\cdot 5`} /> },
    { label: t('面中心排列', 'Face-centre perms'), value: <TeX src={String.raw`6!/2 = 360`} /> },
    { label: t('直径 (HTM)', 'Diameter (HTM)'), value: '11' },
  ], [isZh]);

  const coinc = {
    skewb: { name: t('斜转 (Skewb)', 'Skewb'), states: '3,149,280', sci: '3.15 \\times 10^{6}', id: 'skewb' },
    pyram: { name: t('金字塔 (无 tip)', 'Pyraminx (no tips)'), states: '933,120', sci: '9.33 \\times 10^{5}', id: 'pyram' },
    '222': { name: t('二阶 (2×2)', '2×2'), states: '3,674,160', sci: '3.67 \\times 10^{6}', id: '222' },
  } as const;
  const c = coinc[coincTab];

  // theme vars resolved through CSS custom properties
  const V = {
    accent: 'var(--god-accent)',
    warn: 'var(--god-warn)',
    mute: 'var(--god-text-mute)',
    border: 'var(--god-border)',
    surface: 'var(--god-surface-2)',
    text: 'var(--god-text)',
  };

  return (
    <>
      <EvHighlights cards={cards} />

      {/* ── §1 the puzzle & its axes ──────────────────────────────── */}
      <EvSection
        title={t('一　四条体对角转轴', 'I — Four body-diagonal axes')}
        lead={t(
          'Skewb 不是按面切,而是沿立方体的四条体对角线斜切——这正是它名字的由来。',
          'The Skewb is not cut along its faces but along the cube\'s four body diagonals — hence the name.',
        )}
      >
        <p>
          {t(
            '每一刀都把魔方一分为二,旋转其中半边 120°。结果是:每个面被切成一个中心菱形(可旋转的面中心块)加上四个角三角。整颗魔方有 8 个角块、6 个面中心块。它只有四条独立转轴(立方体的四条体对角线,每条 ±120°),所以打乱与求解的"步"就是绕某条体对角线的一次 120° 扭转——这就是本页所用的度量。',
            'Each cut bisects the puzzle, turning one half by 120°. The effect: every face splits into a central diamond (a rotatable face-centre piece) plus four corner triangles. The whole puzzle has 8 corner pieces and 6 face centres. It has just four independent axes — the cube\'s four body diagonals, each turning ±120° — so a "move" in scrambling and solving is one 120° twist about a body diagonal. That is the metric used throughout this page.',
          )}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <SkewbNet mode={mode} accent={V.accent} warn={V.warn} mute={V.mute} border={V.border} surface={V.surface} />
          </div>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div className="god-chain-tabs" style={{ marginBottom: '0.5rem' }}>
              <button className={`god-metric-tab ${mode === 'axis' ? 'is-on' : ''}`} onClick={() => setMode('axis')}>
                {t('独立的 4 角', 'The 4 independent corners')}
              </button>
              <button className={`god-metric-tab ${mode === 'parity' ? 'is-on' : ''}`} onClick={() => setMode('parity')}>
                {t('被奇偶约束的 4 角', 'The 4 parity-bound corners')}
              </button>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--god-text-sub)', margin: 0 }}>
              {mode === 'axis'
                ? t(
                    '8 个角分成两组交错的 4 个(两个相互嵌套的正四面体)。高亮的这 4 个角可以自由定向,撑起 3⁴ 的朝向自由度;它们决定了魔方的"骨架"。',
                    'The 8 corners split into two interlocking sets of 4 (two nested tetrahedra). The highlighted 4 corners orient freely, contributing the 3⁴ orientation freedom; they form the skeleton.',
                  )
                : t(
                    '另外这 4 个角不是独立的:一旦前 4 个角和面中心定下来,它们的朝向就被整体奇偶性钉死了。这正是 |G| 远小于"所有角随便转"的原因。',
                    'These other 4 corners are not free: once the first 4 corners and the centres are fixed, their orientation is pinned by an overall parity. This is exactly why |G| is far smaller than "every corner spins freely".',
                  )}
            </p>
          </div>
        </div>
        <p className="god-dist-caption" style={{ marginTop: '0.6rem' }}>
          {t(
            '网格图:六面展开,每面中心圆点是可旋转的面中心块,四个三角是角块。点上方按钮切换两组角块的高亮。',
            'Net: the six faces unfolded. Each centre dot is a rotatable face-centre piece; the four triangles are corner pieces. Use the buttons above to highlight each set of corners.',
          )}
        </p>
      </EvSection>

      {/* ── §2 state space ────────────────────────────────────────── */}
      <EvSection
        title={t('二　态空间:精确 3,149,280', 'II — State space: exactly 3,149,280')}
        lead={t(
          'Skewb 的群很小——比 2×2 略小,远小于三阶,所以可以被完整枚举。',
          'The Skewb group is small — a touch smaller than the 2×2 and dwarfed by the 3×3 — so it can be enumerated in full.',
        )}
      >
        <p>
          {t(
            '计数拆成两部分相乘。其一,6 个面中心块只能做偶置换,贡献 6!/2 = 360。其二,角块:4 个独立角各有 3 种朝向(3⁴),其余角块的位置与朝向都被奇偶性绑定,角块整体的合法配置数为 8748。两者相乘正好给出群序:',
            'The count factors into two pieces. First, the 6 face-centre pieces admit only even permutations, contributing 6!/2 = 360. Second, the corners: the 4 independent corners each have 3 orientations (3⁴), while the rest are tied down by parity, leaving 8748 legal corner configurations in total. Their product is exactly the group order:',
          )}
        </p>
        <TeXBlock src={String.raw`|G| \;=\; \underbrace{\tfrac{6!}{2}}_{360\ \text{(centres)}} \;\times\; \underbrace{8748}_{\text{(corners)}} \;=\; 3{,}149{,}280 \;=\; 2^{5}\cdot 3^{9}\cdot 5`} />
        <EvStatStrip items={stateItems} />
        <EvCallout tone="info" heading={t('为什么"被动"的角块重要', 'Why the "passive" corners matter')}>
          {t(
            '如果 8 个角都能独立定向,数字会膨胀到 3⁸ = 6561 倍朝向;实际只有 3⁴。这个"四自由、四被动"的结构,以及面中心的偶置换约束,把态空间压到三百多万——小到一台普通电脑几秒就能广度优先遍历整张图。',
            'If all 8 corners oriented independently the count would blow up by 3⁸ = 6561; in reality it is only 3⁴. This "four free, four passive" structure, together with the even-permutation constraint on the centres, squeezes the state space down to a few million — small enough that an ordinary computer can breadth-first traverse the entire graph in seconds.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §3 diameter 11, proven ────────────────────────────────── */}
      <EvSection
        title={t('三　直径 11:穷举 BFS 证毕', 'III — Diameter 11: proven by exhaustive BFS')}
        lead={t(
          '因为整张图小到能装进内存,直径不是估计,而是被完整搜索出来的精确值。',
          'Because the whole graph fits in memory, the diameter is not an estimate but an exact value found by complete search.',
        )}
      >
        <p>
          {t(
            'Jaap Scherphuis 对 Skewb 群做了完整的广度优先搜索:从已还原状态出发,逐层展开所有可达状态,直到没有新状态出现。最远的状态出现在第 11 层,之后图就被穷尽——这意味着任意 Skewb 打乱都能在 11 步(每步一次 120° 体对角扭转)以内还原,而且确实存在需要满 11 步的状态。上界等于下界,所以这是一个被证明的精确直径,不是上界或经验估计。',
            'Jaap Scherphuis ran a complete breadth-first search over the Skewb group: starting from the solved state, expanding every reachable state layer by layer until no new state appears. The farthest states sit at layer 11, after which the graph is exhausted — meaning every Skewb scramble is solvable in at most 11 moves (one 120° body-diagonal twist each), and states genuinely requiring the full 11 do exist. Upper bound equals lower bound, so this is a proven exact diameter, not a bound or an empirical estimate.',
          )}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <DepthRuler depth={depth} accent={V.accent} warn={V.warn} mute={V.mute} border={V.border} text={V.text} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
              <Layers size={16} style={{ color: 'var(--god-accent)' }} />
              <input
                type="range" min={0} max={11} step={1} value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="god-ida-slider"
                style={{ flex: '1 1 140px', minWidth: 0 }}
                aria-label={t('BFS 深度', 'BFS depth')}
              />
              <span className="god-mono" style={{ minWidth: 110, color: 'var(--god-text)' }}>
                {t(`深度 ${depth} / 11`, `depth ${depth} / 11`)}
              </span>
            </div>
          </div>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <p style={{ margin: 0, color: 'var(--god-text-sub)', fontSize: '0.92rem' }}>
              {depth < 11
                ? t(
                    `BFS 已经展开到第 ${depth} 层。还有更深的状态没被访问到——把滑块推到 11 看看遍历在哪里停下。`,
                    `BFS has expanded through layer ${depth}. Deeper states remain unvisited — push the slider to 11 to see where the traversal halts.`,
                  )
                : t(
                    '第 11 层。再展开一层不会产生任何新状态:全部 3,149,280 个状态都已访问。这就是直径的"证明时刻"——图被穷尽,最大距离就是 11。',
                    'Layer 11. Expanding one more layer yields no new state: all 3,149,280 states are now visited. This is the "proof moment" for the diameter — the graph is exhausted and the maximum distance is exactly 11.',
                  )}
            </p>
          </div>
        </div>

        <EvCallout tone={depth >= 11 ? 'accent' : 'warn'} heading={t('度量说明', 'Metric note')}>
          {t(
            '这里的"步"是一次 120° 的体对角扭转(角轴扭转)。Skewb 没有像三阶那样的多种主流度量之争,这个度量就是通行口径,直径 11 即对应它。',
            'A "move" here is one 120° body-diagonal twist (a corner-axis twist). The Skewb has no competing mainstream metrics like the 3×3 does; this is the standard convention, and diameter 11 is stated against it.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §4 the 11 coincidence ─────────────────────────────────── */}
      <EvSection
        title={t('四　三个 11 的巧合', 'IV — The coincidence of three 11s')}
        lead={t(
          '斜转、无 tip 的金字塔、二阶——三个结构完全不同的小群,上帝之数都恰好是 11。',
          'Skewb, the no-tip Pyraminx, and the 2×2 — three structurally unrelated small groups, all with God\'s number exactly 11.',
        )}
      >
        <p>
          {t(
            '这三个项目的群没有任何同构关系:Skewb 是角轴斜切,Pyraminx 是四面体的面转,2×2 是立方体的角块魔方。它们的态空间也在不同量级(93 万到 367 万)。但在各自的标准度量下,直径都落在 11。与其说神秘,不如说是一个统计现象:量级在 10⁶–10⁷、生成元 6–9 个的小型置换群,其 BFS 深度尺度大体就落在 10–12 这一带。',
            'These three puzzles\' groups share no isomorphism: the Skewb is a corner-axis cut, the Pyraminx is face turns of a tetrahedron, the 2×2 is the corners-only cube. Their state spaces span different magnitudes (0.93M to 3.67M). Yet under each puzzle\'s standard metric the diameter lands on 11. Rather than mysterious, it is a statistical artifact: small permutation groups of order 10⁶–10⁷ with 6–9 generators tend to have a BFS depth scale right around 10–12.',
          )}
        </p>

        <div className="god-dist-tabs" style={{ marginBottom: '0.5rem' }}>
          {(['skewb', 'pyram', '222'] as const).map((k) => (
            <button key={k}
                    className={`god-metric-tab ${coincTab === k ? 'is-on' : ''}`}
                    onClick={() => setCoincTab(k)}>
              {coinc[k].name}
            </button>
          ))}
        </div>
        <div className="god-dist-summary" style={{ marginTop: 0 }}>
          <div>
            <div className="god-dist-stat-label">{t('合法状态数', 'Reachable states')}</div>
            <div className="god-dist-stat-num"><span className="god-mono">{c.states}</span></div>
          </div>
          <div>
            <div className="god-dist-stat-label">{t('量级', 'Magnitude')}</div>
            <div className="god-dist-stat-num"><TeX src={c.sci} /></div>
          </div>
          <div>
            <div className="god-dist-stat-label">{t('上帝之数', "God's number")}</div>
            <div className="god-dist-stat-num" style={{ color: 'var(--god-accent)' }}>11</div>
          </div>
        </div>
        <p style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <GitCompareArrows size={16} style={{ color: 'var(--god-text-mute)', flexShrink: 0 }} />
          <span style={{ color: 'var(--god-text-sub)' }}>
            {t('对照另两个 11:', 'Compare the other two 11s:')}{' '}
            <Link href="/math/god?event=pyram">{t('金字塔', 'Pyraminx')}</Link>
            {'   '}
            <Link href="/math/god?event=222">{t('二阶', '2×2')}</Link>
          </span>
        </p>
        <EvCallout tone="info" heading={t('注意区分', 'A distinction worth keeping')}>
          {t(
            '11 是 Skewb 整个魔方群的直径,不是某个子步骤或子群的直径。对照金字塔:它的"无 tip"群直径是 11,但把 4 个彼此独立的 tip 转轴也算进去,直径平凡地变成 15。Skewb 没有这种额外的平凡转轴,11 就是它的全部。',
            '11 is the diameter of the whole Skewb group, not of some sub-step or subgroup. Contrast the Pyraminx: its "no-tip" group has diameter 11, but adding the 4 independent tip turns bumps the diameter trivially to 15. The Skewb has no such extra trivial axes — 11 is the whole story.',
          )}
        </EvCallout>
      </EvSection>

      <EvRefs refs={REFS} />
    </>
  );
}
