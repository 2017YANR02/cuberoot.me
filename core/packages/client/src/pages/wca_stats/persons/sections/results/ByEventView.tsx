// 按项目:单项目详情.三块:
//   1. 最佳成绩 折线 (single + average,X = comp index)
//   2. 单次成绩分布 直方图
//   3. 历史成绩排名曲线 (年度 NR / WR × single / avg)

import { useState, useEffect } from 'react';
import { formatWcaResult } from '../../../../../utils/wca_format_result';
import { localizeCompName } from '../../../../../utils/comp_localize';
import { fetchPersonRankHistory, type PersonRankHistoryResponse, type WcaPersonProfile, type WcaResultRow, type WcaCompetition } from '../../wca_api';

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  eventId: string;
  isZh: boolean;
}

type SubSub = 'best' | 'dist';

export default function ByEventView({ profile, results, comps, eventId, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [view, setView] = useState<SubSub>('best');
  const [hist, setHist] = useState<PersonRankHistoryResponse | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    setHist(null);
    setHistLoading(true);
    fetchPersonRankHistory(profile.person.wca_id, eventId)
      .then((j) => setHist(j))
      .catch(() => { /* server endpoint may not exist yet — chart will simply hide */ })
      .finally(() => setHistLoading(false));
  }, [profile.person.wca_id, eventId]);

  if (!results || !comps) return <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;

  const compById = new Map(comps.map((c) => [c.id, c]));
  const eventResults = results
    .filter((r) => r.event_id === eventId)
    .slice()
    .sort((a, b) => {
      const da = compById.get(a.competition_id)?.start_date ?? '';
      const db = compById.get(b.competition_id)?.start_date ?? '';
      return da.localeCompare(db) || a.id - b.id;
    });

  return (
    <div className="wp-byevent">
      <div className="wp-subsubtab-bar">
        <button
          className={`wp-subsubtab-btn ${view === 'best' ? 'is-active' : ''}`}
          onClick={() => setView('best')}
        >{t('最佳成绩', 'Best Times')}</button>
        <button
          className={`wp-subsubtab-btn ${view === 'dist' ? 'is-active' : ''}`}
          onClick={() => setView('dist')}
        >{t('单次成绩分布', 'Single Distribution')}</button>
      </div>

      {view === 'best' && (
        <BestChart
          eventId={eventId}
          rows={eventResults}
          compById={compById}
          isZh={isZh}
        />
      )}
      {view === 'dist' && (
        <DistChart eventId={eventId} rows={eventResults} isZh={isZh} />
      )}

      <h3 className="wp-section-h">{t('历史成绩排名曲线', 'Historical Rank History')}</h3>
      {histLoading && <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>}
      {!histLoading && hist && hist.rows.length > 0 && (
        <RankChart hist={hist} isZh={isZh} />
      )}
      {!histLoading && hist && hist.rows.length === 0 && (
        <div className="wp-empty">{t('暂无年度排名数据', 'No yearly rank data')}</div>
      )}
      {!histLoading && !hist && (
        <div className="wp-empty wp-text-mute">{t('排名数据暂未生成(服务端 stats-build 数据未就绪)', 'Rank history not yet built on server')}</div>
      )}
    </div>
  );
}

// ─── 最佳成绩 折线图 ─────────────────────────────────────────────────
function BestChart({
  eventId, rows, compById, isZh,
}: {
  eventId: string;
  rows: WcaResultRow[];
  compById: Map<string, WcaCompetition>;
  isZh: boolean;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [hover, setHover] = useState<number | null>(null);
  const W = 760, H = 320, P = { l: 56, r: 16, t: 16, b: 36 };

  // 把 result.best / .average 抽出来,转秒(FMC: moves;MBLD: score 不参与曲线).
  const isMbld = eventId === '333mbf';
  const isFmc = eventId === '333fm';

  const points = rows.map((r, i) => {
    const single = r.best > 0 ? toAxisValue(r.best, eventId, 'single') : null;
    const avg = r.average > 0 ? toAxisValue(r.average, eventId, 'average') : null;
    return { i, r, single, avg };
  }).filter((p) => p.single !== null || p.avg !== null);

  if (points.length === 0) {
    return <div className="wp-empty">{t('暂无成绩', 'No data')}</div>;
  }

  const yVals: number[] = [];
  for (const p of points) {
    if (p.single !== null) yVals.push(p.single);
    if (p.avg !== null) yVals.push(p.avg);
  }
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);
  const yPad = (yMax - yMin) * 0.06 || 1;
  const yLo = yMin - yPad, yHi = yMax + yPad;
  const xN = points.length;

  const xScale = (i: number) => P.l + (i / Math.max(1, xN - 1)) * (W - P.l - P.r);
  const yScale = (v: number) => P.t + (1 - (v - yLo) / (yHi - yLo)) * (H - P.t - P.b);

  const linePath = (key: 'single' | 'avg') => {
    let path = '';
    let pen = false;
    for (const p of points) {
      const v = p[key];
      if (v === null) { pen = false; continue; }
      const x = xScale(p.i), y = yScale(v);
      path += (pen ? ' L' : ' M') + x.toFixed(1) + ',' + y.toFixed(1);
      pen = true;
    }
    return path.trim();
  };

  // y-axis ticks: 5 evenly spaced
  const ticks: number[] = [];
  for (let k = 0; k <= 4; k++) ticks.push(yLo + (yHi - yLo) * (k / 4));

  const yLabel = (v: number) => {
    if (isFmc) return v.toFixed(0);
    if (isMbld) return v.toFixed(0);
    return formatTime(v);
  };

  return (
    <div className="wp-chart-wrap" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="wp-chart-svg">
        {/* y grid + labels */}
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={P.l} y1={yScale(tv)} x2={W - P.r} y2={yScale(tv)} className="wp-chart-grid" />
            <text x={P.l - 8} y={yScale(tv) + 3} className="wp-chart-axis" textAnchor="end">{yLabel(tv)}</text>
          </g>
        ))}
        {/* x axis */}
        <line x1={P.l} y1={H - P.b} x2={W - P.r} y2={H - P.b} className="wp-chart-grid" />

        {/* lines */}
        <path d={linePath('single')} className="wp-chart-line wp-chart-line-single" />
        <path d={linePath('avg')} className="wp-chart-line wp-chart-line-avg" />

        {/* dots */}
        {points.map((p) => (
          <g key={p.i}>
            {p.single !== null && (
              <circle cx={xScale(p.i)} cy={yScale(p.single)} r={2.5} className="wp-chart-dot wp-chart-dot-single" />
            )}
            {p.avg !== null && (
              <circle cx={xScale(p.i)} cy={yScale(p.avg)} r={2.5} className="wp-chart-dot wp-chart-dot-avg" />
            )}
            {/* hover hit area */}
            <rect
              x={xScale(p.i) - 6} y={P.t} width={12} height={H - P.t - P.b}
              fill="transparent"
              onMouseEnter={() => setHover(p.i)}
            />
          </g>
        ))}

        {/* hover marker */}
        {hover !== null && (() => {
          const p = points.find((q) => q.i === hover);
          if (!p) return null;
          const cx = xScale(p.i);
          return (
            <g>
              <line x1={cx} y1={P.t} x2={cx} y2={H - P.b} className="wp-chart-hover-line" />
            </g>
          );
        })()}

        {/* legend */}
        <g>
          <rect x={P.l + 8} y={P.t + 4} width={10} height={2} className="wp-chart-line-single" rx={1} />
          <text x={P.l + 22} y={P.t + 9} className="wp-chart-legend">{t('单次', 'Single')}</text>
          <rect x={P.l + 80} y={P.t + 4} width={10} height={2} className="wp-chart-line-avg" rx={1} />
          <text x={P.l + 94} y={P.t + 9} className="wp-chart-legend">{t('平均', 'Average')}</text>
        </g>
      </svg>
      {hover !== null && (() => {
        const p = points.find((q) => q.i === hover);
        if (!p) return null;
        const cmp = compById.get(p.r.competition_id);
        const cx = xScale(p.i);
        const place = cx > W / 2 ? 'left' : 'right';
        return (
          <div className={`wp-chart-tip wp-chart-tip-${place}`} style={{ left: `${(cx / W) * 100}%` }}>
            {cmp && <div className="wp-chart-tip-title">{localizeCompName(cmp.id, cmp.name, isZh)}</div>}
            {p.single !== null && (
              <div><span className="wp-chart-tip-k">{t('单次', 'Single')}:</span> {formatWcaResult(p.r.best, eventId, 'single')}</div>
            )}
            {p.avg !== null && (
              <div><span className="wp-chart-tip-k">{t('平均', 'Avg')}:</span> {formatWcaResult(p.r.average, eventId, 'average')}</div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// 把 raw 值映射到 chart Y 轴(秒为主).
// FMC single = 步数;FMC avg = moves×100 → 步数;MBLD = points (越高越好,反向).
function toAxisValue(v: number, eventId: string, kind: 'single' | 'average'): number {
  if (eventId === '333fm') {
    if (kind === 'single') return v;
    return v / 100;
  }
  if (eventId === '333mbf') {
    // 0DDTTTTTMM: diff = 99 - DD, score = solved - missed = diff
    const s = String(v).padStart(10, '0');
    const dd = parseInt(s.slice(1, 3), 10);
    const diff = 99 - dd;
    // chart Y 轴用"被减分"作为时间替代:轴反向时不爽 — 直接 100 - score 让"越往下越好"
    return 100 - diff;
  }
  return v / 100; // centiseconds → seconds
}

function formatTime(sec: number): string {
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return `${m}:${s.toFixed(2).padStart(5, '0')}`;
  }
  return sec.toFixed(2);
}

// ─── 单次成绩分布 直方图 ──────────────────────────────────────────────
function DistChart({ eventId, rows, isZh }: { eventId: string; rows: WcaResultRow[]; isZh: boolean }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const W = 760, H = 220, P = { l: 36, r: 12, t: 12, b: 28 };

  const samples: number[] = [];
  for (const r of rows) {
    for (const a of r.attempts) {
      if (a > 0) samples.push(toAxisValue(a, eventId, 'single'));
    }
  }
  if (samples.length === 0) return <div className="wp-empty">{t('暂无样本', 'No samples')}</div>;

  const min = Math.min(...samples), max = Math.max(...samples);
  const nBins = Math.min(20, Math.max(6, Math.round(Math.sqrt(samples.length))));
  const bw = (max - min) / nBins || 1;
  const bins = Array.from({ length: nBins }, () => 0);
  for (const v of samples) {
    let i = Math.floor((v - min) / bw);
    if (i >= nBins) i = nBins - 1;
    if (i < 0) i = 0;
    bins[i]!++;
  }
  const peak = Math.max(...bins);
  const xScale = (i: number) => P.l + (i / nBins) * (W - P.l - P.r);
  const yScale = (n: number) => P.t + (1 - n / peak) * (H - P.t - P.b);

  return (
    <div className="wp-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="wp-chart-svg">
        <line x1={P.l} y1={H - P.b} x2={W - P.r} y2={H - P.b} className="wp-chart-grid" />
        {bins.map((n, i) => {
          const x = xScale(i);
          const x2 = xScale(i + 1);
          const y = yScale(n);
          return n > 0 ? (
            <g key={i}>
              <rect x={x + 1} y={y} width={Math.max(1, x2 - x - 2)} height={(H - P.b) - y} className="wp-dist-bar" />
              {peak <= 30 && <text x={(x + x2) / 2} y={y - 3} className="wp-chart-axis" textAnchor="middle">{n}</text>}
            </g>
          ) : null;
        })}
        {/* x ticks: 5 labels */}
        {[0, 1, 2, 3, 4].map((k) => {
          const v = min + (max - min) * (k / 4);
          return (
            <text key={k} x={xScale((nBins * k) / 4)} y={H - P.b + 14} className="wp-chart-axis" textAnchor="middle">
              {eventId === '333fm' || eventId === '333mbf' ? v.toFixed(0) : formatTime(v)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── 历史成绩排名 折线图 ──────────────────────────────────────────────
function RankChart({ hist, isZh }: { hist: PersonRankHistoryResponse; isZh: boolean }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const W = 760, H = 280, P = { l: 48, r: 16, t: 24, b: 32 };

  const rows = hist.rows.slice().sort((a, b) => a.year - b.year);
  if (rows.length === 0) return null;
  const xMin = rows[0]!.year, xMax = rows[rows.length - 1]!.year;
  const allRanks: number[] = [];
  for (const r of rows) {
    for (const k of [r.singleWorldRank, r.singleCountryRank, r.avgWorldRank, r.avgCountryRank]) {
      if (k !== null && k > 0) allRanks.push(k);
    }
  }
  if (allRanks.length === 0) return <div className="wp-empty">{t('暂无排名数据', 'No rank data')}</div>;
  const yMax = Math.max(...allRanks);

  const xScale = (yr: number) => xMax === xMin
    ? (P.l + W) / 2
    : P.l + ((yr - xMin) / (xMax - xMin)) * (W - P.l - P.r);
  // Rank 越小越好 → 顶部画 1,底部画 yMax (反向)
  const yScale = (rk: number) => P.t + ((rk - 1) / Math.max(1, yMax - 1)) * (H - P.t - P.b);

  const series: { key: keyof typeof rows[0]; label: string; cls: string }[] = [
    { key: 'singleCountryRank', label: t('单次-NR', 'Single-NR'), cls: 'wp-rank-line-snr' },
    { key: 'singleWorldRank',   label: t('单次-WR', 'Single-WR'), cls: 'wp-rank-line-swr' },
    { key: 'avgCountryRank',    label: t('平均-NR', 'Avg-NR'),    cls: 'wp-rank-line-anr' },
    { key: 'avgWorldRank',      label: t('平均-WR', 'Avg-WR'),    cls: 'wp-rank-line-awr' },
  ];

  const linePath = (key: keyof typeof rows[0]) => {
    let path = '';
    let pen = false;
    for (const r of rows) {
      const v = r[key];
      if (v === null || (typeof v === 'number' && v <= 0)) { pen = false; continue; }
      const x = xScale(r.year);
      const y = yScale(v as number);
      path += (pen ? ' L' : ' M') + x.toFixed(1) + ',' + y.toFixed(1);
      pen = true;
    }
    return path.trim();
  };

  // y ticks
  const ticks = [1, Math.ceil(yMax / 4), Math.ceil(yMax / 2), Math.ceil((3 * yMax) / 4), yMax];

  return (
    <div className="wp-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="wp-chart-svg">
        {ticks.map((rk) => (
          <g key={rk}>
            <line x1={P.l} y1={yScale(rk)} x2={W - P.r} y2={yScale(rk)} className="wp-chart-grid" />
            <text x={P.l - 6} y={yScale(rk) + 3} className="wp-chart-axis" textAnchor="end">{rk}</text>
          </g>
        ))}
        {/* x ticks */}
        {Array.from({ length: Math.min(rows.length, 8) }, (_, k) => {
          const idx = Math.round((k * (rows.length - 1)) / Math.max(1, Math.min(rows.length, 8) - 1));
          const r = rows[idx]!;
          return (
            <text key={k} x={xScale(r.year)} y={H - P.b + 14} className="wp-chart-axis" textAnchor="middle">{r.year}</text>
          );
        })}
        {series.map((s, i) => (
          <g key={s.key}>
            <path d={linePath(s.key)} className={`wp-chart-line ${s.cls}`} />
            <rect x={P.l + 8 + i * 100} y={P.t - 12} width={10} height={2} className={s.cls} rx={1} />
            <text x={P.l + 22 + i * 100} y={P.t - 9} className="wp-chart-legend">{s.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
