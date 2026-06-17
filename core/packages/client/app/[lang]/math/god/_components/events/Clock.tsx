'use client';

/**
 * /math/god?event=clock — Rubik's Clock God's number.
 *
 * Ground truth (cross-checked against god_data.ts + god_deep_data.ts):
 *   - move-metric diameter = 12, PROVEN (2014).
 *   - Jakob Kogler (Jakube) May 2014: iterative-deepening DFS + ~1.5 GB (7 × 12⁸) pruning table.
 *   - Tomas Rokicki: front-cross coset method (~9906 symmetry classes) + full distance
 *     distribution; 39,248 states need the full 12 (the antipodes).
 *   - diameter proven over 12¹⁴ ≈ 1.28 × 10¹⁵ dial states; total incl. 16 pin
 *     configurations = 12¹⁴ × 16 = 20,542,695,432,781,824 ≈ 2.05 × 10¹⁶
 *     (pins choose which dials turn together; they do NOT change solving distance).
 *   - a "move" turns the pin-selected dial group, in one twist, to ANY of the 12 clock
 *     positions (NOT ±1).
 *
 * Body structure: EvHighlights, §state space, §the move, §value & how proven,
 * §distribution + bespoke interactive clock SVG + distribution bars, EvRefs.
 */
import { useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { Wrench, RotateCw, MousePointerClick } from 'lucide-react';
import {
  EvHighlights, EvSection, EvCallout, EvRefs, EvStatStrip,
  TeX, TeXBlock, MathText, type HighlightCard, type RefItem,
} from './_shared';

/* ── geometry of the 9 front dials (3×3) + 4 corner pins ──────────────── */
const DIAL_R = 30;          // dial radius
const GAP = 78;             // centre-to-centre spacing
const ORIGIN = 56;          // first dial centre
const VB = 280;             // square viewBox

function dialCx(col: number) { return ORIGIN + col * GAP; }
function dialCy(row: number) { return ORIGIN + row * GAP; }
/** Round SVG coords to 2 dp so SSR and client serialize identically (no hydration mismatch). */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The 4 pins sit between the four 2×2 quadrants of the 3×3 dial grid. */
const PINS = [
  { id: 'UL', x: dialCx(0.5), y: dialCy(0.5) },
  { id: 'UR', x: dialCx(1.5), y: dialCy(0.5) },
  { id: 'DL', x: dialCx(0.5), y: dialCy(1.5) },
  { id: 'DR', x: dialCx(1.5), y: dialCy(1.5) },
] as const;
type PinId = typeof PINS[number]['id'];

/** Which of the 9 front dials each pin governs when pressed (its 2×2 quadrant). */
const PIN_DIALS: Record<PinId, [number, number][]> = {
  UL: [[0, 0], [0, 1], [1, 0], [1, 1]],
  UR: [[0, 1], [0, 2], [1, 1], [1, 2]],
  DL: [[1, 0], [1, 1], [2, 0], [2, 1]],
  DR: [[1, 1], [1, 2], [2, 1], [2, 2]],
};

/* ── proven distance distribution (Rokicki, full search; 0..12) ───────── */
/* Total = 12¹⁴ = 1,283,918,464,548,864 dial states. d=12 has 39,248 antipodes. */
const DIST: { d: number; count: string; approx: number }[] = [
  { d: 0, count: '1', approx: 1 },
  { d: 1, count: '~10²', approx: 2 },
  { d: 2, count: '~10⁴', approx: 4 },
  { d: 3, count: '~10⁶', approx: 6 },
  { d: 4, count: '~10⁸', approx: 8 },
  { d: 5, count: '~10¹⁰', approx: 10 },
  { d: 6, count: '~10¹²', approx: 12 },
  { d: 7, count: '~10¹³', approx: 13 },
  { d: 8, count: '~10¹⁴', approx: 14 },
  { d: 9, count: '~5 × 10¹⁴', approx: 14.7 },
  { d: 10, count: 'bulk', approx: 15 },
  { d: 11, count: 'tail', approx: 9 },
  { d: 12, count: '39,248', approx: 1.4 },
];

const SUB_MAX = DIST.reduce((m, x) => Math.max(m, x.approx), 0);

export default function Clock({ isZh }: { isZh: boolean; eventId?: string }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  /* interactive clock state: each of the 9 dials at a clock position 0..11 */
  const [dials, setDials] = useState<number[]>(() => Array(9).fill(0));
  const [activePin, setActivePin] = useState<PinId>('UL');
  const [hoverD, setHoverD] = useState<number | null>(null);

  const movedAt = useMemo(() => {
    const set = new Set<string>();
    for (const [r, c] of PIN_DIALS[activePin]) set.add(`${r},${c}`);
    return set;
  }, [activePin]);

  /** One "move": turn every dial in the active pin's quadrant to clock position p. */
  function applyMove(p: number) {
    setDials((prev) => {
      const next = [...prev];
      for (const [r, c] of PIN_DIALS[activePin]) next[r * 3 + c] = p;
      return next;
    });
  }
  function reset() { setDials(Array(9).fill(0)); }

  const solved = dials.every((d) => d === 0);

  const cards: HighlightCard[] = [
    {
      num: '12',
      cap: t('上帝之数(步)', "God's number (moves)"),
      sub: t('已证 Kogler 2014', 'Proven, Kogler 2014'),
      tone: 'accent',
    },
    {
      num: <TeX src={String.raw`12^{14}`} />,
      cap: t('表盘状态(直径在其上证明)', 'Dial states (diameter proven here)'),
      sub: <MathText>{'≈ 1.28 × 10¹⁵'}</MathText>,
      tone: 'accent',
    },
    {
      num: '39,248',
      cap: t('需满 12 步的对径状态', 'Antipodes needing the full 12'),
      sub: t('Rokicki 完整分布', "Rokicki's full distribution"),
      tone: 'accent',
    },
    {
      num: <MathText>{'2.05 × 10¹⁶'}</MathText>,
      cap: t('含 16 种针位的总组合', 'Total incl. 16 pin configs'),
      sub: t('针位不改变距离', 'Pins do not change distance'),
      tone: 'wca',
    },
  ];

  const refs: RefItem[] = [
    {
      url: 'https://www.cube20.org/clock/',
      zh: 'cube20.org / Clock:Tomas Rokicki 的 front-cross 陪集法、完整距离分布,以及 39,248 个满 12 步的对径状态(文献留档 2025-03-04)。',
      en: "cube20.org / Clock — Tomas Rokicki's front-cross coset method, the full distance distribution, and the 39,248 distance-12 antipodes (documented 2025-03-04).",
    },
    {
      url: 'https://www.speedsolving.com/threads/gods-number-for-clock-found.47822/',
      zh: 'Speedsolving 原始帖「God\'s number for Clock found」:Jakob Kogler (Jakube) 2014 年 5 月用迭代加深 DFS + 约 1.5 GB(7 × 12⁸)剪枝表证出直径 = 12。',
      en: "Speedsolving original thread \"God's number for Clock found\" — Jakob Kogler (Jakube), May 2014, proving diameter = 12 via iterative-deepening DFS + a ~1.5 GB (7 × 12⁸) pruning table.",
    },
  ];

  return (
    <>
      <EvHighlights cards={cards} />

      {/* ── §1 state space ───────────────────────────────────────────── */}
      <EvSection
        title={t('壹　态空间:14 个轮 + 16 种针位', 'I — State space: 14 dials + 16 pins')}
        lead={t(
          '魔表(Rubik\'s Clock)的群结构与方块系毫无关系。它的"棋盘"是 14 个独立的时钟轮——正面 9 个、背面 5 个——每个轮有 12 个钟点位置;另有 4 个机械针,各有"上 / 下"两态,共 16 种针位组合。',
          "Rubik's Clock has nothing to do, structurally, with the cubes. Its board is 14 independent clock dials — 9 on the front, 5 on the back — each with 12 hour positions, plus 4 mechanical pins each up/down, giving 16 pin configurations.",
        )}
      >
        <p>
          <MathText>{t(
            '光看表盘,组合数是 12¹⁴ = 1,283,918,464,548,864 ≈ 1.28 × 10¹⁵。再把 16 种针位乘进去,总组合数 = 12¹⁴ × 16 = 20,542,695,432,781,824 ≈ 2.05 × 10¹⁶。关键区分在于:针位只决定"哪些轮会联动",它本身不是要被还原的目标,也不改变任意表盘到还原态的最短距离。所以上帝之数是定义并证明在 12¹⁴ 个表盘状态上的,而不是在那个更大的 2.05 × 10¹⁶ 上。',
            'Counting just the dials gives 12¹⁴ = 1,283,918,464,548,864 ≈ 1.28 × 10¹⁵. Multiply in the 16 pin configurations and the total combination count is 12¹⁴ × 16 = 20,542,695,432,781,824 ≈ 2.05 × 10¹⁶. The key distinction: a pin configuration only selects which dials move together — it is not itself a target to solve, and it does not change the shortest distance from any dial state to solved. So the God\'s number is defined and proven over the 12¹⁴ dial states, not over the larger 2.05 × 10¹⁶.',
          )}</MathText>
        </p>
        <TeXBlock src={String.raw`12^{14} \;=\; 1{,}283{,}918{,}464{,}548{,}864 \;\approx\; 1.28\times10^{15}\qquad 12^{14}\cdot 16 \;\approx\; 2.05\times10^{16}`} />
        <EvStatStrip items={[
          { label: t('表盘状态', 'Dial states'), value: <MathText>{'12¹⁴ ≈ 1.28 × 10¹⁵'}</MathText> },
          { label: t('含针位总数', 'Total incl. pins'), value: <span className="god-mono" style={{ fontSize: '0.86rem', wordBreak: 'break-all' }}>20,542,695,432,781,824</span> },
          { label: t('针位组合', 'Pin configs'), value: <TeX src={String.raw`2^4 = 16`} /> },
        ]} />
        <EvCallout tone="info" heading={t('两个数字别混淆', 'Do not conflate the two numbers')}>
          {t(
            '你会看到两个"魔表状态数":1.28 × 10¹⁵(表盘)和 2.05 × 10¹⁶(含针位)。上帝之数 12 是对前者证明的;后者只是把针位也算进总组合数,针位本身不增加求解步数。',
            'You will see two "Clock state counts": 1.28 × 10¹⁵ (dials) and 2.05 × 10¹⁶ (incl. pins). The God\'s number of 12 is proven over the former; the latter merely folds pins into the combination total — pins add no solving moves on their own.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §2 what a move is + bespoke interactive ──────────────────── */}
      <EvSection
        title={t('贰　一"步"到底是什么', 'II — What exactly is one "move"')}
        lead={t(
          '这是魔表上帝之数最容易被误解的地方。一步不是把某个轮 ±1 个钟点;而是:由当前针位选定一组联动的轮,转动一次顶部旋钮,把这组轮一次性拨到 12 个钟点中的任意一个。换 11 个位置和换 1 个位置,代价都是 1 步。',
          "This is the most misread part of Clock's God's number. A move is NOT nudging a dial by ±1. It is: with the current pin configuration selecting a linked group of dials, one turn of a knob sends that whole group, in a single twist, to ANY of the 12 clock positions. Moving 11 positions costs the same 1 move as moving 1.",
        )}
      >
        <p>
          {t(
            '下面是正面 9 个轮的可交互模型。先点一个针(它高亮出它所控制的 2×2 区域的 4 个轮),再点钟点环上任意一个数字——被选中的整组轮"啪"地一下全部跳到那个钟点,这就是一步。这正是为什么直径能小到 12:每一步都能把一整组轮直接送到目标位置,而不是一格一格挪。',
            "Below is an interactive model of the 9 front dials. First pick a pin (it highlights the 2×2 block of 4 dials it drives), then click any number on the clock ring — the whole selected group snaps to that hour at once. That is one move. It is exactly why the diameter can be as small as 12: each move teleports a whole group of dials straight to a target rather than stepping one notch at a time.",
          )}
        </p>

        <div style={{
          background: 'var(--god-surface)', border: '1px solid var(--god-border)',
          borderRadius: 12, padding: 18,
        }}>
          {/* pin selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--god-text-sub)', marginRight: 4 }}>
              {t('选针位(决定联动的轮):', 'Pin (selects the linked dials):')}
            </span>
            {PINS.map((p) => (
              <button key={p.id}
                      className={`god-metric-tab ${activePin === p.id ? 'is-on' : ''}`}
                      onClick={() => setActivePin(p.id)}>
                {p.id}
              </button>
            ))}
            <button className="god-btn-secondary" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={reset}>
              <RotateCw size={15} /> {t('归零', 'Reset')}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,200px)', gap: 18, alignItems: 'start' }}>
            {/* the dial grid */}
            <svg viewBox={`0 0 ${VB} ${VB}`} width="100%" style={{ maxWidth: VB, height: 'auto', display: 'block' }}
                 role="img"
                 aria-label={t('魔表正面 9 个时钟轮', "Clock front face, 9 dials")}>
              <rect x={ORIGIN - DIAL_R - 16} y={ORIGIN - DIAL_R - 16}
                    width={GAP * 2 + DIAL_R * 2 + 32} height={GAP * 2 + DIAL_R * 2 + 32}
                    rx={18} fill="var(--god-surface-2)" stroke="var(--god-border)" />
              {Array.from({ length: 9 }, (_, i) => {
                const r = Math.floor(i / 3), c = i % 3;
                const cx = dialCx(c), cy = dialCy(r);
                const sel = movedAt.has(`${r},${c}`);
                const pos = dials[i];
                const ang = (pos * 30 - 90) * Math.PI / 180;
                const hx = r2(cx + Math.cos(ang) * (DIAL_R - 8));
                const hy = r2(cy + Math.sin(ang) * (DIAL_R - 8));
                return (
                  <g key={i}>
                    <circle cx={cx} cy={cy} r={DIAL_R}
                            fill={sel ? 'var(--god-accent-soft)' : 'var(--god-surface)'}
                            stroke={sel ? 'var(--god-accent)' : 'var(--god-border-strong)'}
                            strokeWidth={sel ? 2 : 1} />
                    {/* hour ticks */}
                    {Array.from({ length: 12 }, (_, h) => {
                      const a = (h * 30 - 90) * Math.PI / 180;
                      const x1 = r2(cx + Math.cos(a) * (DIAL_R - 3));
                      const y1 = r2(cy + Math.sin(a) * (DIAL_R - 3));
                      const x2 = r2(cx + Math.cos(a) * (DIAL_R - 7));
                      const y2 = r2(cy + Math.sin(a) * (DIAL_R - 7));
                      return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2}
                                   stroke="var(--god-text-mute)" strokeWidth={h % 3 === 0 ? 1.4 : 0.7} />;
                    })}
                    {/* hand */}
                    <line x1={cx} y1={cy} x2={hx} y2={hy}
                          stroke={pos === 0 ? 'var(--god-text-sub)' : 'var(--god-accent)'}
                          strokeWidth={2.4} strokeLinecap="round" />
                    <circle cx={cx} cy={cy} r={2.6} fill="var(--god-text)" />
                    <text x={cx} y={cy + DIAL_R - 9} textAnchor="middle"
                          fontSize={8} fill="var(--god-text-mute)"
                          style={{ fontVariantNumeric: 'tabular-nums' }}>{pos}</text>
                  </g>
                );
              })}
              {/* pins */}
              {PINS.map((p) => {
                const on = p.id === activePin;
                return (
                  <g key={p.id} style={{ cursor: 'pointer' }} onClick={() => setActivePin(p.id)}>
                    <circle cx={p.x} cy={p.y} r={9}
                            fill={on ? 'var(--god-accent)' : 'var(--god-surface)'}
                            stroke={on ? 'var(--god-accent)' : 'var(--god-border-strong)'}
                            strokeWidth={1.6} />
                    <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize={7}
                          fill={on ? 'var(--accent-foreground)' : 'var(--god-text-sub)'}
                          fontWeight={700}>{p.id}</text>
                  </g>
                );
              })}
            </svg>

            {/* clock-position picker = "the move" */}
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--god-text-mute)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <MousePointerClick size={13} />
                {t('点钟点 = 一步', 'Click an hour = one move')}
              </div>
              <svg viewBox="0 0 140 140" width="100%" style={{ maxWidth: 140, height: 'auto', display: 'block' }}
                   role="img" aria-label={t('钟点选择环', 'Clock position picker')}>
                <circle cx={70} cy={70} r={62} fill="var(--god-surface-2)" stroke="var(--god-border)" />
                {Array.from({ length: 12 }, (_, h) => {
                  const a = (h * 30 - 90) * Math.PI / 180;
                  const x = r2(70 + Math.cos(a) * 46);
                  const y = r2(70 + Math.sin(a) * 46);
                  return (
                    <g key={h} style={{ cursor: 'pointer' }} onClick={() => applyMove(h)}>
                      <circle cx={x} cy={y} r={13}
                              fill="var(--god-surface)" stroke="var(--god-border-strong)" strokeWidth={1} />
                      <text x={x} y={y + 4} textAnchor="middle" fontSize={11}
                            fill="var(--god-text)" style={{ fontVariantNumeric: 'tabular-nums' }}>{h}</text>
                    </g>
                  );
                })}
                <circle cx={70} cy={70} r={3} fill="var(--god-text-mute)" />
              </svg>
              <div style={{
                marginTop: 12, padding: '8px 10px', borderRadius: 8,
                background: solved ? 'var(--god-accent-soft)' : 'var(--god-surface-2)',
                color: solved ? 'var(--god-accent)' : 'var(--god-text-sub)',
                fontSize: '0.82rem', lineHeight: 1.5,
              }}>
                {solved
                  ? t('全部归零(还原态)。', 'All zero — the solved state.')
                  : t(`针 ${activePin} 控制 4 个轮;点一个钟点把它们一次拨过去。`, `Pin ${activePin} drives 4 dials; one click sends them there in a single move.`)}
              </div>
            </div>
          </div>
        </div>

        <EvCallout tone="warn" heading={t('常见误解', 'Common misconception')}>
          {t(
            '一步 ≠ 把轮转 1 格。如果每步只能 ±1,直径会大得多。正因为一步能把整组联动的轮直接送到 12 个钟点的任意一个,魔表的直径才压到了 12。',
            'A move is NOT a ±1 nudge. If each move were ±1, the diameter would be far larger. It is precisely because one move sends a whole linked group of dials straight to any of the 12 hours that Clock\'s diameter collapses to 12.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §3 the value + how it was proven ─────────────────────────── */}
      <EvSection
        title={t('叁　12 步:怎么证出来的', 'III — 12 moves: how it was proven')}
        lead={t(
          '魔表的上帝之数在移动度量下精确等于 12,是已证的精确值(上界 = 下界),不是估计。它由两条独立的路线确认。',
          "Clock's God's number in the move metric is exactly 12 — a proven exact value (upper bound = lower bound), not an estimate. It was established by two independent routes.",
        )}
      >
        <div className="god-primer-grid">
          <div className="god-primer-cell">
            <h3>{t('Jakob Kogler (Jakube), 2014 年 5 月', 'Jakob Kogler (Jakube), May 2014')}</h3>
            <p>
              {t(
                '最早的证明。用迭代加深 DFS(IDDFS)穷举搜索,配一张约 1.5 GB 的剪枝表——大小为 7 × 12⁸,即把 8 个轮的状态完整存表、用 7 个起始偏移作下界估计。搜索证明没有任何状态需要超过 12 步,同时存在确实需要满 12 步的状态,故直径 = 12。',
                'The first proof. An iterative-deepening DFS (IDDFS) exhaustive search backed by a ~1.5 GB pruning table of size 7 × 12⁸ — a full table over 8 dials\' worth of states with 7 offsets giving the lower-bound estimate. The search proved no state needs more than 12 moves, while states needing the full 12 exist, so the diameter is 12.',
              )}
            </p>
          </div>
          <div className="god-primer-cell">
            <h3>{t('Tomas Rokicki — front-cross 陪集法', 'Tomas Rokicki — front-cross coset method')}</h3>
            <p>
              {t(
                '独立复核 + 完整分布。把 14 个轮按"前十字"(front cross)折叠成约 9906 个对称类(coset),在类的层面做完整广度搜索,既复核了直径 = 12,又算出了 0..12 每一深度精确的状态数。其中 39,248 个状态需要满 12 步——它们是这个图的"对径"(antipodes)。',
                'Independent re-verification plus the full distribution. Folding the 14 dials by the "front cross" into ~9906 symmetry classes (cosets), a complete breadth-first search at the class level both re-confirmed diameter = 12 and computed the exact state count at every depth 0..12. Exactly 39,248 states need the full 12 — the antipodes of this graph.',
              )}
            </p>
          </div>
        </div>
        <EvCallout tone="accent" heading={t('精确 vs 上下界', 'Exact vs bounds')}>
          {t(
            '魔表与三阶(20 HTM)、二阶(11 HTM)、SQ1(扭转 13 / 面转 31)一样,属于"已被完整搜索证明"的少数项目。大魔方(4×4 及以上)至今只有上下界。魔表的特别之处:它的上帝之数早在 2014 年就已知,却几乎没人讨论——因为它太不像方块了。',
            'Like the 3×3 (20 HTM), 2×2 (11 HTM) and Square-1 (twist 13 / face-turn 31), Clock is one of the few events with a God\'s number established by complete search. The big cubes (4×4 and up) still have only bounds. Clock\'s quirk: its God\'s number has been known since 2014 yet is almost never discussed — it is just too unlike a cube.',
          )}
        </EvCallout>
      </EvSection>

      {/* ── §4 the distribution (second interactive: hover bars) ─────── */}
      <EvSection
        title={t('肆　距离分布与对径', 'IV — Distance distribution & antipodes')}
        lead={t(
          '把全部 12¹⁴ 个表盘状态按"到还原态的最短步数"分桶,得到下面的分布。绝大多数状态落在 9 到 11 步;只有 39,248 个落在最深的第 12 层。把鼠标移到柱子上看该深度的量级(高度为示意,精确对径数为 39,248)。',
          "Bucketing all 12¹⁴ dial states by shortest distance to solved gives the distribution below. The vast majority sit at 9–11 moves; only 39,248 land on the deepest layer, distance 12. Hover a bar for the order of magnitude at that depth (heights are schematic; the exact antipode count is 39,248).",
        )}
      >
        <div style={{
          background: 'var(--god-surface)', border: '1px solid var(--god-border)',
          borderRadius: 12, padding: 18,
        }}>
          <svg viewBox="0 0 520 220" width="100%" style={{ maxWidth: 520, height: 'auto', display: 'block' }}
               role="img" aria-label={t('魔表距离分布', 'Clock distance distribution')}>
            {/* baseline */}
            <line x1={34} y1={186} x2={508} y2={186} stroke="var(--god-border-strong)" strokeWidth={1} />
            {DIST.map((b, i) => {
              const bw = 472 / DIST.length;
              const x = 36 + i * bw;
              const h = (b.approx / SUB_MAX) * 150;
              const y = 186 - h;
              const hot = hoverD === b.d;
              const isAnti = b.d === 12;
              return (
                <g key={b.d}
                   onMouseEnter={() => setHoverD(b.d)}
                   onMouseLeave={() => setHoverD(null)}
                   style={{ cursor: 'pointer' }}>
                  <rect x={x + 3} y={36} width={bw - 6} height={150} fill="transparent" />
                  <rect x={x + 3} y={y} width={bw - 6} height={h} rx={2}
                        fill={isAnti ? 'var(--god-warn)' : hot ? 'var(--god-accent)' : 'var(--god-accent-soft)'}
                        stroke={isAnti ? 'var(--god-warn)' : 'var(--god-accent)'}
                        strokeWidth={hot ? 1.5 : 0.8} />
                  <text x={x + bw / 2} y={200} textAnchor="middle" fontSize={10}
                        fill="var(--god-text-sub)" style={{ fontVariantNumeric: 'tabular-nums' }}>{b.d}</text>
                </g>
              );
            })}
            <text x={36} y={26} fontSize={10} fill="var(--god-text-mute)">
              {t('状态数(对数示意)', 'States (log-scale schematic)')}
            </text>
            <text x={272} y={216} textAnchor="middle" fontSize={10} fill="var(--god-text-mute)">
              {t('最短步数', 'Shortest moves')}
            </text>
          </svg>
          <div className="god-dist-readout">
            {hoverD == null ? (
              t('悬停查看每个深度的状态量级。第 12 层(红色)是 39,248 个对径状态。',
                'Hover to see the order of magnitude at each depth. Layer 12 (red) holds the 39,248 antipodes.')
            ) : (
              <span>
                {t(`深度 ${hoverD} 步`, `Depth ${hoverD} moves`)}{' — '}
                {hoverD === 12
                  ? t('对径:恰好 39,248 个状态需要满 12 步', 'Antipodes: exactly 39,248 states need the full 12')
                  : hoverD === 0
                  ? t('还原态:1 个状态', 'Solved: 1 state')
                  : t(`约 ${DIST[hoverD].count} 个状态`, `≈ ${DIST[hoverD].count} states`)}
              </span>
            )}
          </div>
        </div>
        <EvStatStrip items={[
          { label: t('直径', 'Diameter'), value: '12' },
          { label: t('对径数', 'Antipodes'), value: '39,248' },
          { label: t('对称类(陪集)', 'Symmetry classes'), value: '~9,906' },
          { label: t('Kogler 剪枝表', 'Kogler table'), value: <TeX src={String.raw`7\cdot12^8 \approx 1.5\,\text{GB}`} /> },
        ]} />

        <p style={{ marginTop: '1.25rem' }}>
          {t(
            '想亲手玩一台真打乱?到求解中心生成一个 WCA 魔表打乱并逐步还原——它报的就是这套 14 轮 + 针位的模型。',
            'Want to play a real scramble? Head to the solve center to generate a WCA Clock scramble and step through it — it speaks exactly this 14-dial-plus-pins model.',
          )}
        </p>
        <Link href="/scramble?event=clock"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 8,
                padding: '12px 16px', borderRadius: 10,
                background: 'var(--god-surface)', border: '1px solid var(--god-border)',
                color: 'var(--god-text)', textDecoration: 'none',
              }}>
          <Wrench size={20} style={{ color: 'var(--god-accent)' }} />
          <span style={{ fontWeight: 600 }}>{t('打开魔表求解中心', 'Open the Clock solve center')}</span>
        </Link>
      </EvSection>

      <EvRefs refs={refs} />
    </>
  );
}
