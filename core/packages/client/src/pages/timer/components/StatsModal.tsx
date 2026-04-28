import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { EventId, Solve } from '../types';
import { effectiveMs } from '../types';
import { EVENTS } from '../types';
import {
  summarize,
  pbSingleIndex,
  subXBreakdown,
  bestSingle,
  bestAverageOfN,
  bestMeanOfN,
  bestBestOfN,
  eventDefaultFormat,
  formatMs,
} from '../stats';
import { bucketStats, bucketBoundaries, type BucketStats } from '../stats_buckets';
import ScatterChart from './ScatterChart';
import HistogramChart from './HistogramChart';
import RecordsOverlay from './RecordsOverlay';
import CfopCaseStatsPanel from './CfopCaseStatsPanel';

interface Props {
  event: EventId;
  solves: Solve[];
  isZh: boolean;
  onClose: () => void;
}

type DateRange = 'all' | '7d' | '30d' | '90d' | '365d';

const RANGE_DAYS: Record<Exclude<DateRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

/** Largest run of consecutive calendar days containing ≥1 solve. */
function longestStreak(solves: Solve[]): number {
  if (solves.length === 0) return 0;
  const days = new Set<string>();
  for (const s of solves) {
    const d = new Date(s.ts);
    days.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  }
  const sorted = Array.from(days).map(k => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }).sort((a, b) => a - b);
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (sorted[i] - sorted[i - 1]) / 86400000;
    if (Math.round(diff) === 1) { cur++; if (cur > best) best = cur; }
    else cur = 1;
  }
  return best;
}

export default function StatsModal({ event, solves: rawSolves, isZh, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [range, setRange] = useState<DateRange>('all');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Apply date-range filter before any aggregate computation.
  const solves = useMemo(() => {
    if (range === 'all') return rawSolves;
    const cutoff = Date.now() - RANGE_DAYS[range] * 86400000;
    return rawSolves.filter(s => s.ts >= cutoff);
  }, [rawSolves, range]);

  const evInfo = EVENTS.find(e => e.id === event);
  const evName = evInfo ? (isZh ? evInfo.nameZh : evInfo.nameEn) : event;
  const fmt = eventDefaultFormat(event);

  const summary = useMemo(() => summarize(solves), [solves]);
  const pbIdx = useMemo(() => pbSingleIndex(solves), [solves]);
  const pbDate = pbIdx >= 0 ? new Date(solves[pbIdx].ts) : null;
  const pbStr = pbIdx >= 0 ? formatMs(effectiveMs(solves[pbIdx])) : '—';
  const subX = useMemo(() => subXBreakdown(solves), [solves]);
  const streak = useMemo(() => longestStreak(solves), [solves]);
  const best = bestSingle(solves);

  // Numeric ms values for the WCA records overlay. We can't reuse the
  // formatted strings on `summary` because the overlay needs to compute
  // a numeric gap against the WR.
  const userPbSingleMs = useMemo<number | null>(() => {
    const v = bestSingle(solves);
    return v !== null && Number.isFinite(v) ? v : null;
  }, [solves]);
  const userPbAvgMs = useMemo<number | null>(() => {
    let v: number | null;
    if (fmt.kind === 'ao5')      v = bestAverageOfN(solves, fmt.n);
    else if (fmt.kind === 'mo3') v = bestMeanOfN(solves, fmt.n);
    else if (fmt.kind === 'bo3') v = bestBestOfN(solves, fmt.n);
    else                          v = bestSingle(solves);
    return v !== null && Number.isFinite(v) ? v : null;
  }, [solves, fmt.kind, fmt.n]);

  // Time-period buckets — current and previous period, computed once per render.
  const periods = useMemo(() => {
    const b = bucketBoundaries(new Date());
    return {
      today:     bucketStats(solves, b.todayStart, b.tomorrowStart),
      yesterday: bucketStats(solves, b.yesterdayStart, b.todayStart),
      week:      bucketStats(solves, b.weekStart, b.nextWeekStart),
      prevWeek:  bucketStats(solves, b.prevWeekStart, b.weekStart),
      month:     bucketStats(solves, b.monthStart, b.nextMonthStart),
      prevMonth: bucketStats(solves, b.prevMonthStart, b.monthStart),
      year:      bucketStats(solves, b.yearStart, b.nextYearStart),
      prevYear:  bucketStats(solves, b.prevYearStart, b.yearStart),
    };
  }, [solves]);

  // Build the lines for both display and copy. Order mimics cstimer's BUTTON_OPTIONS.
  const lines: Array<[string, string]> = [];
  lines.push([isZh ? '项目' : 'Event', evName]);
  lines.push([isZh ? '次数' : 'Count', String(summary.count)]);
  if (best !== null) lines.push([isZh ? '最佳单次' : 'Best single', formatMs(best)]);
  if (pbDate) lines.push([isZh ? 'PB 日期' : 'PB date', pbDate.toLocaleDateString()]);
  lines.push([isZh ? '平均' : 'Mean', summary.mean]);
  lines.push(['σ', summary.sd]);
  lines.push(['CV', summary.cv]);
  if (fmt.kind === 'mo3' || event === '333fm') {
    lines.push(['mo3', summary.mo3]);
    lines.push([isZh ? '最佳 mo3' : 'Best mo3', summary.bestMo3]);
  }
  if (fmt.kind === 'bo3') {
    lines.push(['bo3', summary.bo3]);
    lines.push([isZh ? '最佳 bo3' : 'Best bo3', summary.bestBo3]);
  }
  lines.push(['ao5', summary.ao5]);
  lines.push(['ao12', summary.ao12]);
  lines.push(['ao50', summary.ao50]);
  lines.push(['ao100', summary.ao100]);
  lines.push(['ao1000', summary.ao1000]);
  lines.push([isZh ? '最佳 ao5' : 'Best ao5', summary.bestAo5]);
  lines.push([isZh ? '最佳 ao12' : 'Best ao12', summary.bestAo12]);
  lines.push([isZh ? '最佳 ao50' : 'Best ao50', summary.bestAo50]);
  lines.push([isZh ? '最佳 ao100' : 'Best ao100', summary.bestAo100]);
  lines.push([isZh ? '最佳 ao1000' : 'Best ao1000', summary.bestAo1000]);
  if (streak > 0) lines.push([isZh ? '最长连续天数' : 'Longest streak', `${streak} ${isZh ? '天' : 'days'}`]);

  // Format helper for a single row of period stats (used by JSX + copy text).
  const fmtBucketRow = (b: BucketStats): string =>
    `n=${b.count}  best=${formatMs(b.best)}  ao5=${formatMs(b.ao5)}  ao12=${formatMs(b.ao12)}  mean=${formatMs(b.mean)}`;

  // Period rows in the order shown in the UI.
  const periodRows: Array<{ key: 'today' | 'week' | 'month' | 'year'; label: string; vsLabel: string; cur: BucketStats; prev: BucketStats }> = [
    { key: 'today', label: isZh ? '今日' : 'Today',  vsLabel: isZh ? '昨日' : 'yesterday', cur: periods.today, prev: periods.yesterday },
    { key: 'week',  label: isZh ? '本周' : 'Week',   vsLabel: isZh ? '上周' : 'last week', cur: periods.week,  prev: periods.prevWeek },
    { key: 'month', label: isZh ? '本月' : 'Month',  vsLabel: isZh ? '上月' : 'last month', cur: periods.month, prev: periods.prevMonth },
    { key: 'year',  label: isZh ? '今年' : 'Year',   vsLabel: isZh ? '去年' : 'last year', cur: periods.year,  prev: periods.prevYear },
  ];

  const textVersion = useMemo(() => {
    const header = `${evName} — ${isZh ? '统计' : 'Stats'} (n=${summary.count})`;
    const body = lines.map(([k, v]) => `${k}: ${v}`).join('\n');
    const subxBody = subX.length
      ? '\n\n' + (isZh ? 'sub-X 分布：' : 'Sub-X breakdown:') + '\n' +
          subX.map(s => `  ${s.label}: ${s.pct.toFixed(1)}%`).join('\n')
      : '';
    const periodsBody = '\n\n' + (isZh ? '时间段：' : 'Time periods:') + '\n' +
      periodRows.map(r => `  ${r.label}: ${fmtBucketRow(r.cur)}`).join('\n');
    return header + '\n' + body + subxBody + periodsBody;
    // `lines` is rebuilt every render but its content is fully determined by
    // (summary, subX, best, streak, pbDate, fmt.kind, event, isZh). `periodRows`
    // is determined by `periods` + isZh; `periods` is memoized on `solves`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    evName, isZh, event, fmt.kind,
    summary, subX, best, streak,
    pbDate ? pbDate.getTime() : 0,
    periods,
  ]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(textVersion);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  // Delta on time stats: lower is better (so cur < prev → improvement).
  // Returns null when either side lacks the metric (no comparison possible).
  const renderDelta = (cur: number | null, prev: number | null) => {
    if (cur === null || prev === null) return null;
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
    if (cur === prev) {
      return <span style={{ color: '#888', marginLeft: 4 }}>=</span>;
    }
    const better = cur < prev;
    const diff = Math.abs(cur - prev);
    return (
      <span style={{ color: better ? '#3aa757' : '#d04848', marginLeft: 4 }}>
        {better ? '▲' : '▼'} {formatMs(diff)}
      </span>
    );
  };

  // Inline styles for the period table — kept here so we don't have to touch
  // timer.css (cross-agent: another agent owns recon, avoid CSS file conflict).
  const cellStyle: CSSProperties = { padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' };
  const numCellStyle: CSSProperties = { ...cellStyle, fontVariantNumeric: 'tabular-nums' };

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        className="timer-modal stats-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-modal-title"
      >
        <h2 id="stats-modal-title">{isZh ? '完整统计' : 'Full stats'} — {evName}</h2>

        <div className="modal-section">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {(['all', '7d', '30d', '90d', '365d'] as const).map(r => {
              const labelZh: Record<DateRange, string> = {
                all: '全部', '7d': '近7天', '30d': '近30天', '90d': '近90天', '365d': '近一年',
              };
              const labelEn: Record<DateRange, string> = {
                all: 'All', '7d': '7d', '30d': '30d', '90d': '90d', '365d': '365d',
              };
              const active = range === r;
              return (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={active ? 'primary' : 'hint-btn'}
                  aria-pressed={active}
                >
                  {isZh ? labelZh[r] : labelEn[r]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="modal-section">
          <div className="stats-modal-grid">
            {lines.map(([k, v]) => (
              <div className="stats-modal-row" key={k}>
                <span className="stats-modal-lbl">{k}</span>
                <span className="stats-modal-val">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {pbIdx >= 0 && (
          <div className="modal-section">
            <h3 className="settings-h3">{isZh ? 'PB 单次' : 'PB single'}</h3>
            <div className="stats-modal-pb">
              <div>{pbStr}</div>
              <div className="scramble-text">{solves[pbIdx].scramble}</div>
            </div>
          </div>
        )}

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '时间段' : 'Time periods'}</h3>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.9em', width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444', opacity: 0.75 }}>
                <th style={cellStyle}>{isZh ? '段' : 'Period'}</th>
                <th style={cellStyle}>n</th>
                <th style={cellStyle}>best</th>
                <th style={cellStyle}>ao5</th>
                <th style={cellStyle}>ao12</th>
                <th style={cellStyle}>mean</th>
                <th style={cellStyle}>{isZh ? '对比' : 'vs prev'}</th>
              </tr>
            </thead>
            <tbody>
              {periodRows.map(r => (
                <tr key={r.key}>
                  <td style={cellStyle}>{r.label}</td>
                  <td style={numCellStyle}>{r.cur.count}</td>
                  <td style={numCellStyle}>{formatMs(r.cur.best)}</td>
                  <td style={numCellStyle}>{formatMs(r.cur.ao5)}</td>
                  <td style={numCellStyle}>{formatMs(r.cur.ao12)}</td>
                  <td style={numCellStyle}>{formatMs(r.cur.mean)}</td>
                  <td style={{ ...cellStyle, fontSize: '0.85em' }}>
                    <span style={{ opacity: 0.6, marginRight: 4 }}>vs {r.vsLabel}:</span>
                    <span style={{ marginRight: 8 }}>
                      <span style={{ opacity: 0.7 }}>best</span>
                      {renderDelta(r.cur.best, r.prev.best)}
                    </span>
                    <span>
                      <span style={{ opacity: 0.7 }}>ao5</span>
                      {renderDelta(r.cur.ao5, r.prev.ao5)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RecordsOverlay
          event={event}
          userPbSingleMs={userPbSingleMs}
          userPbAvgMs={userPbAvgMs}
          isZh={isZh}
        />

        {event === '333' && (
          <div className="modal-section">
            <CfopCaseStatsPanel event={event} solves={solves} isZh={isZh} />
          </div>
        )}

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '图表' : 'Charts'}</h3>
          <div className="stats-charts">
            <div className="stats-chart-card">
              <p className="stats-chart-title">
                {isZh
                  ? `单次散点（最近 ${Math.min(solves.length, 200)} 次）`
                  : `Per-solve scatter (last ${Math.min(solves.length, 200)})`}
              </p>
              <ScatterChart
                solves={solves}
                isZh={isZh}
                windowSize={200}
                width={520}
                height={180}
              />
            </div>
            <div className="stats-chart-card">
              <p className="stats-chart-title">
                {isZh ? '成绩分布' : 'Time distribution'}
              </p>
              <HistogramChart
                solves={solves}
                isZh={isZh}
                width={520}
                height={160}
                bucketCount={20}
              />
            </div>
          </div>
        </div>

        {subX.length > 0 && (
          <div className="modal-section">
            <h3 className="settings-h3">{isZh ? 'sub-X 分布' : 'Sub-X breakdown'}</h3>
            <div className="subx-list">
              {subX.map(s => (
                <div className="subx-row" key={s.threshold}>
                  <span className="subx-lbl">{s.label}</span>
                  <div className="subx-bar"><div className="subx-fill" style={{ width: `${s.pct}%` }} /></div>
                  <span className="subx-pct">{s.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onCopy} className="primary">
            {copied ? (isZh ? '已复制' : 'Copied') : (isZh ? '复制文本' : 'Copy text')}
          </button>
          <button onClick={onClose}>{isZh ? '关闭' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}
