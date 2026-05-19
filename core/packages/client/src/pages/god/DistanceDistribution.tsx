/**
 * 三阶 HTM 距离分布 + 最少步分析 (FMC distribution)。
 *
 * 数据来源:cube20.org 已公布 d=0..15 精确,d=16..20 仅总和约束;d=20 的 antipode 总数已知。
 * 交互:
 *   - 鼠标悬停某个深度看精确数字 + 占比
 *   - 切换 "状态数 / 累积概率" 视图
 *   - 标记 FMC WR (16) + 平均人类 (~28) + 上帝之数 (20) 三条标线
 */
import { useMemo, useState } from 'react';
import { MathText } from './Tex';

interface Row {
  d: number;
  /** 精确状态数 (-1 表示只有上下界) */
  count: number;
  /** d=16..20 的近似量级 (只用于绘图) */
  approxCount?: number;
  /** 是否精确 */
  exact: boolean;
}

/** Rokicki / cube20.org 公开数据。0..15 精确;16..19 估算;20 由总和约束反推。 */
const ROWS: Row[] = [
  { d: 0,  count: 1, exact: true },
  { d: 1,  count: 18, exact: true },
  { d: 2,  count: 243, exact: true },
  { d: 3,  count: 3_240, exact: true },
  { d: 4,  count: 43_239, exact: true },
  { d: 5,  count: 574_908, exact: true },
  { d: 6,  count: 7_618_438, exact: true },
  { d: 7,  count: 100_803_036, exact: true },
  { d: 8,  count: 1_332_343_288, exact: true },
  { d: 9,  count: 17_596_479_795, exact: true },
  { d: 10, count: 232_248_063_316, exact: true },
  { d: 11, count: 3_063_288_809_012, exact: true },
  { d: 12, count: 40_374_425_656_248, exact: true },
  { d: 13, count: 531_653_418_284_628, exact: true },
  { d: 14, count: 6_989_320_578_825_358, exact: true },
  // d=15 实际 = 91,365,146,187,124,313 — 超过 Number.MAX_SAFE_INTEGER (2^53 ≈ 9 × 10^15),用 scientific 近似显示
  { d: 15, count: 9.1365146187124313e16, exact: true },
  { d: 16, count: -1, approxCount: 1.10e18, exact: false },
  { d: 17, count: -1, approxCount: 1.21e19, exact: false },
  { d: 18, count: -1, approxCount: 2.49e19, exact: false },
  { d: 19, count: -1, approxCount: 1.50e18, exact: false },
  { d: 20, count: -1, approxCount: 4.9e8, exact: false },
];

const TOTAL = 4.3252003274489856e19; // |G(3×3)|, beyond safe-int

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
      const c = r.exact ? r.count : (r.approxCount ?? 0);
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
      return Math.log10(Math.max(...ROWS.map((r) => r.exact ? r.count : (r.approxCount ?? 1))));
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
          const c = r.exact ? r.count : (r.approxCount ?? 0);
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
          const c = r.exact ? r.count : (r.approxCount ?? 0);
          const pct = (c / TOTAL) * 100;
          return (
            <>
              <strong>d = {r.d}:</strong>{' '}
              {r.exact
                ? <>{fmt(r.count)} {t('个状态', 'states')}</>
                : <>≈ {fmt(c)} {t('个状态(估算)', 'states (estimated)')}</>}
              {' · '}
              {pct < 0.001 ? `< 0.001%` : `${pct.toFixed(3)}%`}
              {r.exact ? ' (✓ 精确, cube20.org)' : ' (上界已证 ≤ 20)'}
            </>
          );
        })() : (
          <span className="god-growth-hint">
            <MathText>{t(
              'hover 某个深度看精确数字。d=0..15 是 Rokicki 团队公开的精确分布;d=16..20 因为总和约束被反推为估算。99% 的随机三阶状态需要 17-19 步最优。',
              'Hover a depth for exact values. d=0..15 are Rokicki\'s published exact counts; d=16..20 are estimates from the total-sum constraint. 99% of random 3×3 states need 17-19 moves optimally.',
            )}</MathText>
          </span>
        )}
      </div>

      <p className="god-dist-caption">
        <MathText>{t(
          '这张表就是"最少步分布":随机抽一个三阶打乱,问它最少几步能解。绝大多数 (>99%) 在 17-19 步。恰好 20 步的"超难"状态约占 ~10⁻¹¹——也就是大约 ~4.9 亿个 antipode 状态,在 4.3 × 10¹⁹ 总状态里几乎找不到。FMC WR 16 步几乎不可能复刻,因为对应的 antipode 集太稀有。',
          'This is the "minimum-solution-length distribution": pick a random 3×3 state, ask how few moves it needs. Over 99% need 17-19. The exact-20 antipodes are about 10⁻¹¹ of all states (~490 million antipodes out of 4.3 × 10¹⁹). The 16-move FMC WR is essentially unreproducible because that antipode class is so rare.',
        )}</MathText>
      </p>
    </div>
  );
}
