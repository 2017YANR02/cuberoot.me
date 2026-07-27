'use client';

/**
 * 三阶 HTM 距离分布 + 最少步分析 (FMC distribution)。
 *
 * 数据来源:全站单一源 lib/god-distance-333(cube20.org)。d=0..15 穷举精确,d=16..19 只公布
 * 两位有效数字,d=20 的 4.9 亿是「已找到」的下界。画图与占比用归一化档(Σ 恰为 |G|),
 * 读数里显示的仍是公布的原值 —— 别把归一化产生的十几位数字当成真精度。
 * 交互:
 *   - 鼠标悬停某个深度看精确数字 + 占比
 *   - 切换 "状态数 / 累积概率" 视图
 *   - 标记 FMC WR (16) + 平均人类 (~28) + 上帝之数 (20) 三条标线
 */
import { useMemo, useState } from 'react';
import {
  CUBE3_STATES, GOD_DIST_333, GOD_DIST_333_NORMALIZED, type GodBinKind,
} from '@/lib/god-distance-333';
import { MathText } from './Tex';

interface Row {
  d: number;
  /** 画图/占比用的归一化状态数。d ≥ 14 超出 Number.MAX_SAFE_INTEGER,只用于绘制,故转 number。 */
  count: number;
  /** cube20.org 的公布值 —— 读数里显示的是它,免得把归一化产生的十几位数字当成真精度。 */
  raw: number;
  kind: GodBinKind;
  /** 是否穷举精确值(false = cube20.org 的估计,或 d=20 的「已找到」下界)。 */
  exact: boolean;
}

/** 全站单一源 lib/god-distance-333.ts。用归一化档,占比与均值才不会加起来超 100%。 */
const ROWS: Row[] = GOD_DIST_333.map((b, i) => ({
  d: b.d,
  count: Number(GOD_DIST_333_NORMALIZED[i]),
  raw: Number(b.count),
  kind: b.kind,
  exact: b.kind === 'exact',
}));

const TOTAL = Number(CUBE3_STATES); // |G(3×3)|, beyond safe-int

/** 把 Number-or-BigInt 安全格式化(科学计数或本地千位)。 */
function fmt(n: number): string {
  if (n < 1e7) return n.toLocaleString();
  return n.toExponential(2).replace('e+', ' × 10^');
}

interface Props { isZh: boolean; }

export default function DistanceDistribution({ isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [mode, setMode] = useState<'count' | 'cum'>('count');
  const [hover, setHover] = useState<number | null>(null);

  // 计算 cumulative + average + median
  const stats = useMemo(() => {
    let sum = 0, weighted = 0;
    const cum: number[] = [];
    let acc = 0;
    for (const r of ROWS) {
      const c = r.count;
      sum += c;
      weighted += c * r.d;
      acc += c;
      cum.push(acc);
    }
    const avg = weighted / TOTAL;
    // 找中位数:cumulative 第一次 ≥ TOTAL/2 的 d
    const half = TOTAL / 2;
    let median = 0;
    for (let i = 0; i < cum.length; i++) {
      if (cum[i] >= half) { median = ROWS[i].d; break; }
    }
    return { sum, avg, median, cum };
  }, []);

  const maxBar = useMemo(() => {
    if (mode === 'count') {
      // log scale on counts;use log of max(count or approx)
      return Math.log10(Math.max(...ROWS.map((r) => r.count)));
    }
    return 1; // cumulative 是 0..1
  }, [mode]);

  const W = 620, H = 280, PAD_L = 50, PAD_R = 18, PAD_T = 28, PAD_B = 42;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const barW = innerW / ROWS.length;

  return (
    <div className="god-dist-wrap">
      <div className="god-dist-tabs">
        <button className={`god-metric-tab ${mode === 'count' ? 'is-on' : ''}`} onClick={() => setMode('count')}>
          {t('状态数 (log)', 'Count (log)')}
        </button>
        <button className={`god-metric-tab ${mode === 'cum' ? 'is-on' : ''}`} onClick={() => setMode('cum')}>
          {t('累积占比', 'Cumulative %')}
        </button>
      </div>

      <div className="god-dist-summary">
        <div>
          <div className="god-dist-stat-label">{t('平均最少步', 'Mean optimal length')}</div>
          <div className="god-dist-stat-num">{stats.avg.toFixed(2)} <span>HTM</span></div>
        </div>
        <div>
          <div className="god-dist-stat-label">{t('中位数', 'Median')}</div>
          <div className="god-dist-stat-num">{stats.median} <span>HTM</span></div>
        </div>
        <div>
          <div className="god-dist-stat-label">{t('FMC 当前 WR', 'Current FMC WR')}</div>
          <div className="god-dist-stat-num">16 <span>HTM</span></div>
        </div>
        <div>
          <div className="god-dist-stat-label">{t('上帝之数 (上限)', "God's number (ceiling)")}</div>
          <div className="god-dist-stat-num">20 <span>HTM</span></div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="god-dist-svg" preserveAspectRatio="xMidYMid meet" role="img"
           aria-label={t('三阶距离分布', '3×3 distance distribution')}>
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = PAD_T + innerH * (1 - p);
          return (
            <g key={p}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y}
                    stroke="var(--god-grid)" strokeDasharray="3 4" />
              <text x={PAD_L - 6} y={y + 3} fontSize="9.5" textAnchor="end" fill="var(--god-text-sub)">
                {mode === 'count' ? `10^${(maxBar * p).toFixed(0)}` : `${(p * 100).toFixed(0)}%`}
              </text>
            </g>
          );
        })}
        {/* bars */}
        {ROWS.map((r, i) => {
          const c = r.count;
          let h: number;
          if (mode === 'count') {
            h = c > 0 ? (Math.log10(c) / maxBar) * innerH : 0;
          } else {
            const ratio = stats.cum[i] / TOTAL;
            h = ratio * innerH;
          }
          const x = PAD_L + i * barW + barW * 0.15;
          const w = barW * 0.7;
          const y = PAD_T + innerH - h;
          const color = r.exact ? 'var(--god-accent)' : 'var(--god-warn)';
          return (
            <g key={r.d}
               onMouseEnter={() => setHover(r.d)}
               onMouseLeave={() => setHover(null)}>
              <rect x={x} y={y} width={w} height={h} fill={color}
                    opacity={r.exact ? 0.85 : 0.55}
                    rx={2} />
              <rect x={PAD_L + i * barW} y={PAD_T} width={barW} height={innerH}
                    fill="transparent" />
              <text x={x + w/2} y={H - PAD_B + 14} fontSize="10" textAnchor="middle"
                    fill={hover === r.d ? 'var(--god-accent)' : 'var(--god-text-sub)'}
                    fontWeight={hover === r.d ? 600 : 400}>
                {r.d}
              </text>
            </g>
          );
        })}
        {/* milestone lines */}
        {[
          { x: 16, label: 'FMC WR' },
          { x: 20, label: t("上帝之数", "God's #") },
        ].map((m) => {
          const i = ROWS.findIndex((r) => r.d === m.x);
          const x = PAD_L + (i + 0.5) * barW;
          return (
            <g key={m.x}>
              <line x1={x} x2={x} y1={PAD_T - 6} y2={PAD_T + innerH}
                    stroke="var(--god-text-mute)" strokeDasharray="2 3" strokeWidth="1" />
              <text x={x} y={PAD_T - 10} fontSize="9.5" textAnchor="middle" fill="var(--god-text-sub)">
                {m.label}
              </text>
            </g>
          );
        })}
        {/* axis label */}
        <text x={(PAD_L + W - PAD_R) / 2} y={H - 6} fontSize="11" textAnchor="middle" fill="var(--god-text-sub)">
          {t('最少步数 d (HTM)', 'minimum solution length d (HTM)')}
        </text>
      </svg>

      <div className="god-dist-readout">
        {hover != null ? (() => {
          const r = ROWS.find((x) => x.d === hover)!;
          const c = r.count;
          const pct = (c / TOTAL) * 100;
          return (
            <>
              <strong>d = {r.d}:</strong>{' '}
              {r.kind === 'exact' && <>{fmt(r.raw)} {t('个状态', 'states')}</>}
              {r.kind === 'approx' && <>≈ {fmt(r.raw)} {t('个状态(估算)', 'states (estimated)')}</>}
              {r.kind === 'atLeast' && <>≥ {fmt(r.raw)} {t('个状态(已找到这么多)', 'states found so far')}</>}
              {' · '}
              {pct < 0.001 ? `< 0.001%` : `${pct.toFixed(3)}%`}
              {r.kind === 'exact' && t(' (✓ 穷举精确, cube20.org)', ' (✓ exact, cube20.org)')}
              {r.kind === 'approx' && t(' (cube20.org 只给两位有效数字)', ' (cube20.org gives two significant digits)')}
              {r.kind === 'atLeast' && t(' (下界,不是计数)', ' (a lower bound, not a count)')}
            </>
          );
        })() : (
          <span className="god-growth-hint">
            <MathText>{t(
              'hover 某个深度看数字。d=0..15 是 Rokicki 团队穷举出的精确分布;d=16..19 只公布到两位有效数字;d=20 的 4.9 亿是「已找到这么多」的下界。约 97% 的随机三阶状态最优解落在 17-19 步。',
              'Hover a depth for the numbers. d=0..15 are Rokicki\'s exhaustive exact counts; d=16..19 are published to two significant figures only; the 490 million at d=20 is a lower bound on what has been found. About 97% of random 3×3 states are optimal at 17-19 moves.'
            )}</MathText>
          </span>
        )}
      </div>

      <p className="god-dist-caption">
        <MathText>{t(
          '这张表就是"最少步分布":随机抽一个三阶打乱,问它最少几步能解。约 97% 落在 17-19 步,16-19 步合起来超过 99.7%。恰好 20 步的"超难"状态约占 10⁻¹¹ —— 大约 4.9 亿个 antipode,在 4.3 × 10¹⁹ 总状态里几乎撞不到。反过来,FMC 世界纪录 16 步难的不是遇上一个 ≤16 步就能解的打乱(那有约 2.7%),而是人要在一小时里真把那条最优解找出来。',
          'This is the "minimum-solution-length distribution": pick a random 3×3 state, ask how few moves it needs. About 97% land at 17-19; 16-19 together is over 99.7%. The exact-20 antipodes are about 10⁻¹¹ of all states (~490 million out of 4.3 × 10¹⁹) — you will essentially never draw one. Conversely, the hard part of a 16-move FMC world record is not drawing a scramble whose optimal is ≤16 (about 2.7% are), but actually finding that optimal solution within the hour.'
        )}</MathText>
      </p>
    </div>
  );
}
