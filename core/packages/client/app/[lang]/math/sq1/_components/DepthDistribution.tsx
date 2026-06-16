'use client';

/**
 * SQ1 最优步分布:扭转口径(Masonjones 2005,0..13)与面转口径(Chen 2017,0..31)
 * 两套**穷举**分布切换。第三套 WCA 12c4 没有分布——因为它的上帝之数还没人算过。
 */
import { useMemo, useState } from 'react';
import { TWIST_DIST, FACE_DIST, METRICS, sci, type DepthRow } from './sq1_data';

interface Props { isZh: boolean; }
type MetricKey = 'twist' | 'face';
type View = 'count' | 'cum';

const DATA: Record<MetricKey, DepthRow[]> = { twist: TWIST_DIST, face: FACE_DIST };

export default function DepthDistribution({ isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [metric, setMetric] = useState<MetricKey>('face');
  const [view, setView] = useState<View>('count');
  const [hover, setHover] = useState<number | null>(null);

  const rows = DATA[metric];
  const info = METRICS[metric];

  const stats = useMemo(() => {
    const total = rows[rows.length - 1].cum;
    let weighted = 0;
    for (const r of rows) weighted += r.count * r.d;
    const half = total / 2;
    let median = 0;
    for (const r of rows) { if (r.cum >= half) { median = r.d; break; } }
    const peak = rows.reduce((a, b) => (b.count > a.count ? b : a), rows[0]);
    const antipode = rows[rows.length - 1];
    return { total, avg: weighted / total, median, peak, antipode };
  }, [rows]);

  const maxLog = useMemo(() => Math.log10(Math.max(...rows.map((r) => r.count))), [rows]);

  const W = 660, H = 290, PAD_L = 48, PAD_R = 16, PAD_T = 26, PAD_B = 42;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const barW = innerW / rows.length;

  const accent = metric === 'twist' ? 'var(--sq1-proven)' : 'var(--sq1-info)';

  return (
    <div className="sq1-panel">
      <div className="sq1-panel-title">{t('最优步分布(穷举)', 'Optimal-length distribution (exhaustive)')}</div>
      <div className="sq1-panel-sub">
        {t('每个深度有多少个状态恰好需要这么多步——整张表都是穷举出来的,不是抽样。',
           'How many states need exactly this many moves — the whole table is exhaustive, not sampled.')}
      </div>

      <div className="sq1-tabs">
        <button className={`sq1-tab ${metric === 'twist' ? 'is-on' : ''}`} onClick={() => { setMetric('twist'); setHover(null); }}>
          {t('扭转口径 上帝之数 13', 'Twist, God 13')}
        </button>
        <button className={`sq1-tab ${metric === 'face' ? 'is-on' : ''}`} onClick={() => { setMetric('face'); setHover(null); }}>
          {t('面转口径 上帝之数 31', 'Face-turn, God 31')}
        </button>
        <span style={{ flex: 1 }} />
        <button className={`sq1-tab ${view === 'count' ? 'is-on' : ''}`} onClick={() => setView('count')}>
          {t('状态数 (log)', 'Count (log)')}
        </button>
        <button className={`sq1-tab ${view === 'cum' ? 'is-on' : ''}`} onClick={() => setView('cum')}>
          {t('累积 %', 'Cumulative %')}
        </button>
      </div>

      <div className="sq1-stats">
        <div><div className="sq1-stat-label">{t('平均最优步', 'Mean optimal')}</div><div className="sq1-stat-num">{info.avg?.toFixed(3)}</div></div>
        <div><div className="sq1-stat-label">{t('中位数', 'Median')}</div><div className="sq1-stat-num">{stats.median}</div></div>
        <div><div className="sq1-stat-label">{t('峰值在', 'Peak at')}</div><div className="sq1-stat-num">{stats.peak.d}</div></div>
        <div><div className="sq1-stat-label">{t('上帝之数(对径)', 'God / antipode')}</div><div className="sq1-stat-num">{stats.antipode.d}</div></div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="sq1-svg" style={{ maxWidth: W }} preserveAspectRatio="xMidYMid meet"
           role="img" aria-label={t('SQ1 最优步分布', 'SQ1 optimal-length distribution')}>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = PAD_T + innerH * (1 - p);
          return (
            <g key={p}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="var(--sq1-grid)" strokeDasharray="3 4" />
              <text x={PAD_L - 6} y={y + 3} fontSize="9" textAnchor="end" fill="var(--sq1-text-mute)">
                {view === 'count' ? `10^${(maxLog * p).toFixed(0)}` : `${(p * 100).toFixed(0)}%`}
              </text>
            </g>
          );
        })}
        {rows.map((r, i) => {
          let h: number;
          if (view === 'count') h = r.count > 0 ? (Math.log10(r.count) / maxLog) * innerH : 0;
          else h = (r.cum / stats.total) * innerH;
          const x = PAD_L + i * barW + barW * 0.12;
          const w = barW * 0.76;
          const y = PAD_T + innerH - h;
          const isHot = hover === r.d;
          const isAntipode = r.d === stats.antipode.d;
          return (
            <g key={r.d} onMouseEnter={() => setHover(r.d)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y={y} width={w} height={h} rx={1.5}
                    fill={isAntipode ? 'var(--sq1-open)' : accent}
                    opacity={isHot ? 1 : (isAntipode ? 0.95 : 0.8)} />
              <rect x={PAD_L + i * barW} y={PAD_T} width={barW} height={innerH} fill="transparent" />
              {(metric === 'twist' || r.d % 2 === 0 || isHot || isAntipode) && (
                <text x={x + w / 2} y={H - PAD_B + 13} fontSize="9" textAnchor="middle"
                      fill={isHot ? accent : 'var(--sq1-text-mute)'} fontWeight={isHot ? 700 : 400}>
                  {r.d}
                </text>
              )}
            </g>
          );
        })}
        <text x={(PAD_L + W - PAD_R) / 2} y={H - 5} fontSize="10.5" textAnchor="middle" fill="var(--sq1-text-sub)">
          {t('最优步数 d', 'optimal length d')} {t(info.name.zh, info.name.en)}
        </text>
      </svg>

      <div className="sq1-readout">
        {hover != null ? (() => {
          const r = rows.find((x) => x.d === hover)!;
          const pct = (r.count / stats.total) * 100;
          return (
            <>
              <strong>d = {r.d}:</strong>{' '}
              {sci(r.count)} {t('个状态', 'states')}
              {', '}{pct < 0.0001 ? '< 0.0001%' : `${pct.toFixed(4)}%`}
              {r.d === stats.antipode.d && t('(对径 / 上帝之数)', ' (antipode / God\'s number)')}
            </>
          );
        })() : (
          <span className="sq1-hint">
            {t(
              `hover 看每个深度的精确状态数。${info.name.zh}:${info.who.zh}。`,
              `Hover for the exact count at each depth. ${info.name.en}: ${info.who.en}.`,
            )}
          </span>
        )}
      </div>

      <p className="sq1-caption">
        {metric === 'face'
          ? t(
              '面转口径整张分布共 11,958,666,854,400 个可切状态,峰在 26 步,只有 376 个状态需要满 31 步(且都「顶层 4 角」)。这是一次完整 BFS:搜到 31 步时所有状态都被访问到,所以 31 是被证明的精确值。',
              'The full face-turn distribution covers 11,958,666,854,400 twistable states, peaks at 26, and only 376 states need the full 31 (all with "4 corners on top"). This was a complete BFS — every state was reached by depth 31, so 31 is a proven exact value.',
            )
          : t(
              '扭转口径只数切片、层转免费,所以态空间折叠成 435,891,456,000,上帝之数只有 13(对径 157,452,752 个)。Masonjones 2005 在一台 800MHz 机器上穷举跑了约一年。',
              'The twist metric counts only slices (layer turns free), folding the space to 435,891,456,000 with God\'s number just 13 (157,452,752 antipodes). Masonjones ran this exhaustively for ~a year on an 800 MHz machine in 2005.',
            )}
        {' '}
        <strong>{t('注意:WCA 12c4 口径没有这张图——它的上帝之数从没被算出来。', 'Note: the WCA 12c4 metric has no such chart — its God\'s number has never been computed.')}</strong>
      </p>
    </div>
  );
}
