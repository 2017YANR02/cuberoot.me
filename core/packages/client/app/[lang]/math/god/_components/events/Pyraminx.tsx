'use client';

/**
 * /math/god?event=pyram — Pyraminx God's number.
 *
 * Ground truth (god_data.ts + god_deep_data.ts, cross-checked jaapsch.net):
 *   - "core" group (ignoring the 4 trivial tips): |G| = 933,120, HTM diameter = 11 (PROVEN,
 *     Jaap Scherphuis exhaustive BFS; metric = single axial 120° layer turn).
 *   - the 4 tips each have 3 orientations, fully independent → full group 933,120 · 3^4 =
 *     75,582,720, diameter 11 + 4 = 15. The "15" is DERIVED: sources state 11 explicitly.
 *
 * Sections:
 *   intro highlight cards (11 proven, 15 derived, 933,120 core states, 75,582,720 full)
 *   §1 the puzzle & two state counts (formula)
 *   §2 the proven diameter 11 + the metric (single axial layer turn)
 *   §3 how it was computed (overnight BFS) + the tips → 15 derivation
 *   §4 a bespoke tetrahedron SVG: toggle tips on/off, watch 11 → 15
 *   references
 */
import { useState, useMemo, Suspense, lazy } from 'react';
import { Layers, Triangle } from 'lucide-react';
import {
  EvHighlights, EvSection, EvCallout, EvRefs, EvStatStrip,
  TeX, TeXBlock, MathText, type HighlightCard, type RefItem, type StatItem,
} from './_shared';

const DistanceDistribution = lazy(() => import('../DistanceDistribution'));

const REFS: RefItem[] = [
  {
    url: 'https://www.jaapsch.net/puzzles/pyraminx.htm',
    zh: 'Jaap Scherphuis,Pyraminx 主页:零件模型、两种态空间计数(核心 933,120 与含 tip 75,582,720)、穷举搜索得到的核心直径 11(单轴层转口径)及完整距离分布。',
    en: 'Jaap Scherphuis — Pyraminx page: piece model, both state counts (core 933,120 and with tips 75,582,720), and the exhaustive-search core diameter 11 (single axial layer-turn metric) with the full distance distribution.',
  },
  {
    url: 'https://en.wikipedia.org/wiki/Pyraminx',
    zh: 'Wikipedia,Pyraminx:态空间 933,120(忽略 tip 朝向)的标准计数与几何约束的说明。',
    en: 'Wikipedia — Pyraminx: the standard 933,120 state count (ignoring tip orientations) and the geometric constraints behind it.',
  },
];

export default function Pyraminx({ isZh }: { isZh: boolean; eventId?: string }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  /* ── tip toggle drives both the headline derivation and the SVG ───── */
  const [tipsOn, setTipsOn] = useState(false);
  const diameter = tipsOn ? 15 : 11;
  const stateLabel = tipsOn ? '75,582,720' : '933,120';

  const cards: HighlightCard[] = [
    {
      num: 11,
      cap: t('核心上帝之数 HTM', 'Core God\'s number HTM'),
      sub: t('已证 Jaap Scherphuis 穷举', 'Proven, Jaap Scherphuis (exhaustive)'),
      tone: 'accent',
    },
    {
      num: 15,
      cap: t('含 4 个 tip 推得', 'With the 4 tips (derived)'),
      sub: t('11 + 4,平凡推论', '11 + 4, a trivial corollary'),
      tone: 'wca',
    },
    {
      num: <span style={{ fontSize: '1.5rem' }}>933,120</span>,
      cap: t('核心态空间', 'Core state space'),
      sub: t('忽略 4 个 tip 朝向', 'ignoring the 4 tip orientations'),
      tone: 'accent',
    },
    {
      num: <span style={{ fontSize: '1.35rem' }}>75,582,720</span>,
      cap: t('完整态空间', 'Full state space'),
      sub: <TeX src={String.raw`933{,}120 \times 3^4`} />,
      tone: 'wca',
    },
  ];

  const stateItems: StatItem[] = [
    {
      label: t('核心合法状态', 'Core reachable states'),
      value: <MathText>{'|G_{\\text{core}}| = 933{,}120'}</MathText>,
    },
    {
      label: t('含 tip 总数', 'States incl. tips'),
      value: <span className="god-mono" style={{ fontSize: '0.95rem' }}>75,582,720</span>,
    },
    {
      label: t('生成元(轴向层转)', 'Generators (axial layers)'),
      value: '4',
    },
  ];

  return (
    <>
      <EvHighlights cards={cards} />

      <EvCallout tone="info" heading={t('两个数字,一个被证、一个被推', 'Two numbers: one proven, one derived')}>
        {t(
          'Pyraminx 的「上帝之数」有两种说法,差在你算不算那 4 个独立旋转的 tip。比赛和文献的标准答案是 11:它是核心群(忽略 tip)在单轴层转口径下被穷举证明的精确直径。把 4 个 tip 算进来,直径平凡地变成 11 + 4 = 15——这是推论,不是新结果,所以本页把 11 标为「已证」,15 标为「推得」。',
          'Pyraminx has two "God\'s number" answers, differing only in whether you count its 4 independently-rotating tips. The standard figure in competition and the literature is 11: the exhaustively-proven exact diameter of the core group (tips ignored) in the single axial layer-turn metric. Adding the 4 tips trivially raises the diameter to 11 + 4 = 15 — a corollary, not a new result, so this page marks 11 as proven and 15 as derived.',
        )}
      </EvCallout>

      {/* ── §1 puzzle & state space ─────────────────────────────── */}
      <EvSection
        title={t('壹　四面体与两种计数', 'I — The tetrahedron and its two counts')}
        lead={t(
          'Pyraminx 是一个正四面体,沿四条轴各切一刀,产生分层旋转。',
          'The Pyraminx is a regular tetrahedron, cut once along each of its four axes, giving layered turns.',
        )}
      >
        <p>
          {t(
            '把它拆成零件:4 个顶点的 tip(可单独旋转的小三角锥)、4 个与 tip 同轴的中心块(corner,带 tip 一起被「层转」带动)、6 个棱块(edge)。一次合法的转动绕某条顶点轴把整层转 120°——这就是本页采用的「单轴层转」度量,每次这样的转计 1 步。',
            'Break it into pieces: 4 vertex tips (small triangular caps that spin on their own), 4 axial centre pieces (the "corners", carried by a layer turn together with their tip), and 6 edges. A legal move turns a whole layer 120° about one vertex axis — this is the single axial layer-turn metric used here, with each such turn counting as one move.',
          )}
        </p>

        <div className="god-primer-grid" style={{ marginTop: '1rem' }}>
          <div className="god-primer-cell">
            <h3>{t('核心计数 933,120', 'Core count 933,120')}</h3>
            <p>
              <MathText>{t(
                '忽略 tip 后,状态由「4 个中心块的朝向」「6 个棱块的位置与翻转」决定:|G| = 3^4 \\cdot \\tfrac{6!}{2} \\cdot 2^5 = 933{,}120。',
                'Ignoring tips, a state is fixed by the 4 centre orientations plus the 6 edges\' positions and flips: |G| = 3^4 \\cdot \\tfrac{6!}{2} \\cdot 2^5 = 933{,}120.',
              )}</MathText>
            </p>
          </div>
          <div className="god-primer-cell">
            <h3>{t('完整计数 75,582,720', 'Full count 75,582,720')}</h3>
            <p>
              <MathText>{t(
                '4 个 tip 各有 3 个朝向且彼此独立,给核心数再乘上 3^4 = 81:933{,}120 \\times 81 = 75{,}582{,}720。',
                'The 4 tips have 3 orientations each and are mutually independent, multiplying the core by 3^4 = 81: 933{,}120 \\times 81 = 75{,}582{,}720.',
              )}</MathText>
            </p>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem' }}>
          <EvStatStrip items={stateItems} />
        </div>

        <TeXBlock src={String.raw`|G_{\text{core}}| = 3^4 \cdot \frac{6!}{2} \cdot 2^5 = 933{,}120, \qquad |G_{\text{full}}| = 933{,}120 \cdot 3^4 = 75{,}582{,}720`} />
      </EvSection>

      {/* ── §2 the proven diameter ──────────────────────────────── */}
      <EvSection
        title={t('贰　直径 11:被穷举证明', 'II — Diameter 11: proven by exhaustion')}
        lead={t(
          '核心群只有 93 万个状态,小到可以把整张图一次性走完。',
          'The core group has under a million states — small enough to walk the entire graph at once.',
        )}
      >
        <p>
          {t(
            '在单轴层转口径下,核心 Pyraminx 群的直径恰好是 11:存在某些状态距离还原态正好 11 步,且不存在任何状态更远。这不是估计,而是穷举证明——Jaap Scherphuis 对全部 933,120 个状态做了一次广度优先搜索(BFS),从还原态出发逐层扩张,直到所有状态都被访问;最深的那一层就是直径。上界(任意状态 ≤ 11 步)与下界(确有状态需要满 11 步)在同一次搜索里相遇,所以是「精确值」。',
            'In the single axial layer-turn metric the core Pyraminx group has diameter exactly 11: some states sit precisely 11 turns from solved, and none lie farther. This is not an estimate but an exhaustive proof — Jaap Scherphuis ran a breadth-first search (BFS) over all 933,120 states, expanding shell by shell from the solved state until every state was reached; the deepest shell is the diameter. The upper bound (every state in ≤ 11) and the lower bound (some state truly needs the full 11) meet inside one search, making 11 exact.',
          )}
        </p>

        <EvCallout tone="accent" heading={t('度量说明:什么算一步', 'Metric note: what counts as a move')}>
          {t(
            '这里一步 = 绕某条顶点轴把一层转 120°(顺或逆)。tip 单独旋转不计入核心度量——因为 tip 不影响任何其他块,正经裁判判还原时也常忽略它们。换一种数法(例如把 tip 转也算进去)会改变答案,这正是 11 与 15 的分野。',
            'One move here = a 120° turn of a layer about a vertex axis (clockwise or counter). A tip spun on its own is not counted in the core metric — a tip affects no other piece, and judging "solved by colour" routinely ignores them. Counting differently (e.g. charging for tip twists) changes the answer, which is exactly the 11-vs-15 split.',
          )}
        </EvCallout>

        <p style={{ marginTop: '1rem' }}>
          {t(
            '下面是同一类「现场 BFS」演示的范例(以 2×2 为对象,因为它和 Pyraminx 同属可整图遍历的小群):你能直观看到搜索如何一层层填满状态空间,直到最后一层定出直径。Pyraminx 的搜索逻辑一模一样,只是生成元换成 4 条顶点轴。',
            'Below is the same "live BFS" idea (shown on the 2×2, a small fully-enumerable group like Pyraminx): you can watch the search fill the state space shell by shell until the last shell fixes the diameter. The Pyraminx search is identical in logic, only the generators become the 4 vertex axes.',
          )}
        </p>
        <Suspense fallback={<div className="god-loading">…</div>}>
          <DistanceDistribution isZh={isZh} />
        </Suspense>
      </EvSection>

      {/* ── §3 tips → 15 derivation ─────────────────────────────── */}
      <EvSection
        title={t('叁　从 11 推到 15', 'III — From 11 to 15')}
        lead={t(
          '4 个 tip 完全独立,所以它们对直径的贡献可以直接相加。',
          'The 4 tips are fully independent, so their contribution to the diameter simply adds.',
        )}
      >
        <p>
          <MathText>{t(
            '完整 Pyraminx 群是核心群与 4 个 tip 群的直积:G_{\\text{full}} = G_{\\text{core}} \\times C_3 \\times C_3 \\times C_3 \\times C_3。直积里各因子之间没有耦合——拧某条层不会动到 tip 的相对朝向,反之亦然。',
            'The full Pyraminx group is the direct product of the core group and the 4 tip groups: G_{\\text{full}} = G_{\\text{core}} \\times C_3 \\times C_3 \\times C_3 \\times C_3. There is no coupling between the factors — a layer turn never changes a tip\'s relative orientation, and vice versa.',
          )}</MathText>
        </p>
        <p>
          {t(
            '直积的直径等于各因子直径之和。每个 tip 群是 C₃(三朝向循环),最远要 1 次扭转即可归位,直径 1;4 个 tip 合计贡献 4。于是完整直径 = 11 + 4 × 1 = 15。注意这里 15 是「上界等于下界」的精确推论:把 4 个 tip 全部错位、同时让核心处于一个需要满 11 步的反极状态,就得到一个恰好需要 15 步的位置;没有更远的。',
            'The diameter of a direct product is the sum of the factor diameters. Each tip group is C₃ (a 3-orientation cycle) whose farthest element is one twist from home, diameter 1; the 4 tips contribute 4 in total. Hence the full diameter = 11 + 4 × 1 = 15. Here 15 is an exact corollary (upper bound = lower bound): mis-twist all 4 tips while the core sits at an 11-move antipode and you get a position needing exactly 15; nothing is farther.',
          )}
        </p>
        <TeXBlock src={String.raw`\operatorname{diam}(G_{\text{full}}) = \operatorname{diam}(G_{\text{core}}) + 4\,\operatorname{diam}(C_3) = 11 + 4\cdot 1 = 15`} />
        <EvCallout tone="info" heading={t('为什么文献说 11', 'Why the literature says 11')}>
          {t(
            'WCA 与多数资料把 Pyraminx 的上帝之数记为 11——因为 tip 在还原判定里是「免费」的,把它们算进去只是给同一个事实加一个平凡的常数。本页两者都给,但把 11 作为被证明的主结果,15 作为推得的衍生值。',
            'The WCA and most references quote Pyraminx\'s God\'s number as 11 — tips are "free" for judging, so counting them just bolts a trivial constant onto the same fact. This page reports both, treating 11 as the proven headline and 15 as the derived value.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §4 bespoke SVG ──────────────────────────────────────── */}
      <EvSection
        title={t('肆　拨动 tip:看着 11 变成 15', 'IV — Toggle the tips: watch 11 become 15')}
        lead={t(
          '点四个角的 tip 开关,直径与态空间会随之在「核心」与「完整」之间切换。',
          'Toggle the four corner tips and watch the diameter and state count flip between "core" and "full".',
        )}
      >
        <TetraDemo isZh={isZh} tipsOn={tipsOn} setTipsOn={setTipsOn} diameter={diameter} stateLabel={stateLabel} />
      </EvSection>

      <EvRefs refs={REFS} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Bespoke tetrahedron visual. A flat (front-face-on) triangular net of the
 * Pyraminx: an outer triangle subdivided into 9 small triangles — 3 tip
 * caps (corners), 3 edge bands, 1 centre, drawn in the 4 Pyraminx colours.
 * Tips are toggleable; turning them off greys them out and the readout
 * switches core ↔ full. All hand-authored SVG, responsive (viewBox + max).
 * ───────────────────────────────────────────────────────────────────── */

type TipKey = 'top' | 'left' | 'right' | 'back';

function TetraDemo({
  isZh, tipsOn, setTipsOn, diameter, stateLabel,
}: {
  isZh: boolean;
  tipsOn: boolean;
  setTipsOn: (v: boolean) => void;
  diameter: number;
  stateLabel: string;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  /* individual-tip state (the 4th "back" tip is shown as a chip only). */
  const [tips, setTips] = useState<Record<TipKey, boolean>>({
    top: false, left: false, right: false, back: false,
  });

  // master toggle keeps the headline + per-tip chips in sync
  const setAll = (v: boolean) => {
    setTips({ top: v, left: v, right: v, back: v });
    setTipsOn(v);
  };
  const toggleOne = (k: TipKey) => {
    const next = { ...tips, [k]: !tips[k] };
    setTips(next);
    setTipsOn(Object.values(next).some(Boolean));
  };

  const anyTip = useMemo(() => Object.values(tips).some(Boolean), [tips]);
  // effective diameter reflects the per-tip count when chips are used directly
  const tipCount = useMemo(() => Object.values(tips).filter(Boolean).length, [tips]);
  const effDiameter = 11 + tipCount;
  const effState = anyTip
    ? `933,120 × 3^${tipCount} = ${(933120 * Math.pow(3, tipCount)).toLocaleString('en-US')}`
    : '933,120';
  void diameter; void stateLabel; void tipsOn;

  /* geometry: an upward triangle, side 300, in a 340-wide viewBox. */
  const W = 340, Hh = 300;
  const A = { x: 170, y: 24 };          // top vertex
  const B = { x: 24, y: 276 };          // bottom-left vertex
  const C = { x: 316, y: 276 };         // bottom-right vertex
  const mid = (p: typeof A, q: typeof A) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const AB = mid(A, B), AC = mid(A, C), BC = mid(B, C);
  const poly = (...pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');

  // Pyraminx face colours (one solid colour per visible face region group)
  const GREEN = '#39b54a', RED = '#e23b2e', BLUE = '#2e6fe2', YELLOW = '#f0c419';

  const tipDefs: { key: TipKey; pts: { x: number; y: number }[]; fill: string; label: string }[] = [
    { key: 'top', pts: [A, AB, AC], fill: GREEN, label: t('上', 'top') },
    { key: 'left', pts: [B, AB, BC], fill: RED, label: t('左', 'left') },
    { key: 'right', pts: [C, AC, BC], fill: BLUE, label: t('右', 'right') },
  ];

  const off = 'color-mix(in srgb, var(--god-text-mute) 22%, transparent)';

  return (
    <div className="god-bfs-wrap">
      {/* master + per-tip chips */}
      <div className="god-bfs-controls">
        <button
          className={anyTip ? 'god-btn-primary' : 'god-btn-secondary'}
          onClick={() => setAll(!(tipCount === 4))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Layers size={16} />
          {tipCount === 4 ? t('全部关闭 tip', 'Turn all tips off') : t('全部开启 tip', 'Turn all tips on')}
        </button>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['top', 'left', 'right', 'back'] as TipKey[]).map((k) => (
            <button
              key={k}
              onClick={() => toggleOne(k)}
              className="god-metric-tab"
              aria-pressed={tips[k]}
              style={{
                border: '1px solid var(--god-border-strong)',
                background: tips[k] ? 'var(--god-accent-soft)' : 'transparent',
                color: tips[k] ? 'var(--god-accent)' : 'var(--god-text-sub)',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}
            >
              <Triangle size={13} fill={tips[k] ? 'currentColor' : 'none'} />
              {t('tip ', 'tip ')}
              {({ top: t('上', 'top'), left: t('左', 'left'), right: t('右', 'right'), back: t('背', 'back') } as Record<TipKey, string>)[k]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 18, alignItems: 'center' }}>
        {/* the SVG */}
        <svg
          viewBox={`0 0 ${W} ${Hh}`}
          width="100%"
          style={{ maxWidth: W, height: 'auto', display: 'block', margin: '0 auto' }}
          role="img"
          aria-label={t('Pyraminx 平面展开图', 'Pyraminx flat net')}
        >
          {/* centre region */}
          <polygon points={poly(AB, BC, AC)} fill={YELLOW} stroke="var(--god-surface)" strokeWidth={2} opacity={0.92} />
          {/* edge bands (between each tip and the centre) — keep neutral-ish tint */}
          <polygon points={poly(AB, AC, BC)} fill="none" />
          {/* three corner tips */}
          {tipDefs.map(({ key, pts, fill, label }) => {
            const on = tips[key];
            const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
            const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;
            return (
              <g key={key} style={{ cursor: 'pointer' }} onClick={() => toggleOne(key)}>
                <polygon
                  points={poly(...pts)}
                  fill={on ? fill : off}
                  stroke="var(--god-surface)"
                  strokeWidth={2}
                  opacity={on ? 0.95 : 1}
                />
                {/* small tip-cap triangle at the outer vertex to signal "tip on" */}
                <polygon
                  points={poly(
                    pts[0],
                    { x: pts[0].x + (pts[1].x - pts[0].x) * 0.32, y: pts[0].y + (pts[1].y - pts[0].y) * 0.32 },
                    { x: pts[0].x + (pts[2].x - pts[0].x) * 0.32, y: pts[0].y + (pts[2].y - pts[0].y) * 0.32 },
                  )}
                  fill={on ? 'var(--god-surface)' : 'none'}
                  stroke={on ? fill : 'var(--god-text-mute)'}
                  strokeWidth={on ? 2.5 : 1.5}
                  strokeDasharray={on ? undefined : '3 3'}
                />
                <text
                  x={cx} y={cy + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill={on ? 'var(--god-surface)' : 'var(--god-text-mute)'}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {label}
                </text>
              </g>
            );
          })}
          {/* outer outline */}
          <polygon points={poly(A, B, C)} fill="none" stroke="var(--god-border-strong)" strokeWidth={2} />
        </svg>

        {/* live readout */}
        <div style={{ minWidth: 0 }}>
          <div className="god-dist-summary" style={{ marginTop: 0, gridTemplateColumns: '1fr' }}>
            <div>
              <div className="god-dist-stat-label">{t('当前口径直径', 'Diameter (current scope)')}</div>
              <div className="god-dist-stat-num">
                {effDiameter}
                <span>{tipCount === 0 ? t('核心 已证', 'core, proven') : t('含 tip 推得', 'with tips, derived')}</span>
              </div>
            </div>
            <div>
              <div className="god-dist-stat-label">{t('态空间', 'State space')}</div>
              <div className="god-dist-stat-num" style={{ fontSize: '1.05rem' }}>
                <MathText>{effState}</MathText>
              </div>
            </div>
          </div>
          <p className="god-bfs-caption">
            {tipCount === 0
              ? t(
                  '没开 tip:这就是「核心」Pyraminx——933,120 个状态,穷举证明的直径 11。',
                  'No tips: this is the "core" Pyraminx — 933,120 states, exhaustively-proven diameter 11.',
                )
              : t(
                  `开了 ${tipCount} 个 tip:每个 tip 独立加 1 步。直径 = 11 + ${tipCount} = ${effDiameter},态空间乘上 3^${tipCount}。`,
                  `${tipCount} tip${tipCount > 1 ? 's' : ''} on: each independent tip adds one move. Diameter = 11 + ${tipCount} = ${effDiameter}, state space multiplied by 3^${tipCount}.`,
                )}
          </p>
          <div style={{ marginTop: 10 }}>
            <TeX src={`11 + ${tipCount} = ${effDiameter}`} />
          </div>
        </div>
      </div>

      <p className="god-bfs-caption" style={{ marginTop: 14 }}>
        {t(
          '注:本图是 Pyraminx 一个面的平面示意——黄色中心、三个彩色角(可拨动的 tip),用来直观传达「tip 独立可拧」这件事;它不是逐步求解动画。',
          'Note: this is a flat schematic of one Pyraminx face — yellow centre, three coloured corners (the toggleable tips) — meant to convey that tips twist independently; it is not a step-by-step solve animation.',
        )}
      </p>
    </div>
  );
}
