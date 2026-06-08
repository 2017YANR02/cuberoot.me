'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { BarChart3, Layers, LayoutDashboard } from 'lucide-react';
import type { EventId, Solve } from '../_lib/types';
import { effectiveMs } from '../_lib/types';
import { EVENTS } from '../_lib/types';
import {
  summarize,
  pbSingleIndex,
  subXBreakdown,
  bestSingle,
  bestAverageOfN,
  bestMeanOfN,
  bestBestOfN,
  eventDefaultFormat,
  sdOfLastN,
  sdOfBestAoN,
  formatMs,
} from '../_lib/stats';
import { bucketStats, bucketBoundaries, type BucketStats } from '../_lib/stats_buckets';
import ScatterChart from './charts/ScatterChart';
import HistogramChart from './charts/HistogramChart';
import HourChart from './charts/HourChart';
import RecordsOverlay from './RecordsOverlay';
import CfopCaseStatsPanel from './CfopCaseStatsPanel';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

interface Props {
  event: EventId;
  solves: Solve[];
  isZh: boolean;
  onClose: () => void;
}

type DateRange = 'all' | '7d' | '30d' | '90d' | '365d';
type StatsTab = 'overview' | 'charts' | 'cases';

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
  const [tab, setTab] = useState<StatsTab>('overview');

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
  const evName = evInfo ? (i18n.language === 'zh-Hant' ? (evInfo.nameZhHant ?? evInfo.nameZh) : (isZh ? evInfo.nameZh : evInfo.nameEn)) : event;
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
  lines.push([tr({ zh: '项目', en: 'Event',
      zhHant: "專案"
}), evName]);
  lines.push([tr({ zh: '次数', en: 'Count',
      zhHant: "次數"
}), String(summary.count)]);
  if (best !== null) lines.push([tr({ zh: '最佳单次', en: 'Best single',
      zhHant: "最佳單次"
}), formatMs(best)]);
  if (pbDate) lines.push([tr({ zh: 'PB 日期', en: 'PB date' }), pbDate.toLocaleDateString()]);
  lines.push([tr({ zh: '平均', en: 'Mean' }), summary.mean]);
  lines.push(['σ', summary.sd]);
  lines.push(['CV', summary.cv]);
  // σ suffix (cstimer-style): the std-dev of the times composing an average.
  const sdSuffix = (ms: number | null): string =>
    (ms === null || !Number.isFinite(ms)) ? '' : ` (σ ${formatMs(Math.round(ms))})`;
  const curSd = (n: number) => sdSuffix(sdOfLastN(solves, n));
  const bestSd = (n: number) => sdSuffix(sdOfBestAoN(solves, n));
  if (fmt.kind === 'mo3' || event === '333fm') {
    lines.push(['mo3', summary.mo3 + curSd(3)]);
    lines.push([tr({ zh: '最佳 mo3', en: 'Best mo3' }), summary.bestMo3]);
  }
  if (fmt.kind === 'bo3') {
    lines.push(['bo3', summary.bo3]);
    lines.push([tr({ zh: '最佳 bo3', en: 'Best bo3' }), summary.bestBo3]);
  }
  lines.push(['ao5', summary.ao5 + curSd(5)]);
  lines.push(['ao12', summary.ao12 + curSd(12)]);
  lines.push(['ao50', summary.ao50 + curSd(50)]);
  lines.push(['ao100', summary.ao100 + curSd(100)]);
  lines.push(['ao1000', summary.ao1000 + curSd(1000)]);
  lines.push([tr({ zh: '最佳 ao5', en: 'Best ao5' }), summary.bestAo5 + bestSd(5)]);
  lines.push([tr({ zh: '最佳 ao12', en: 'Best ao12' }), summary.bestAo12 + bestSd(12)]);
  lines.push([tr({ zh: '最佳 ao50', en: 'Best ao50' }), summary.bestAo50 + bestSd(50)]);
  lines.push([tr({ zh: '最佳 ao100', en: 'Best ao100' }), summary.bestAo100 + bestSd(100)]);
  lines.push([tr({ zh: '最佳 ao1000', en: 'Best ao1000' }), summary.bestAo1000 + bestSd(1000)]);
  if (streak > 0) lines.push([tr({ zh: '最长连续天数', en: 'Longest streak',
      zhHant: "最長連續天數"
}), `${streak} ${tr({ zh: '天', en: 'days' })}`]);

  // Format helper for a single row of period stats (used by JSX + copy text).
  const fmtBucketRow = (b: BucketStats): string =>
    `n=${b.count}  best=${formatMs(b.best)}  ao5=${formatMs(b.ao5)}  ao12=${formatMs(b.ao12)}  mean=${formatMs(b.mean)}`;

  // Period rows in the order shown in the UI.
  const periodRows: Array<{ key: 'today' | 'week' | 'month' | 'year'; label: string; vsLabel: string; cur: BucketStats; prev: BucketStats }> = [
    { key: 'today', label: tr({ zh: '今日', en: 'Today' }),  vsLabel: tr({ zh: '昨日', en: 'yesterday' }), cur: periods.today, prev: periods.yesterday },
    { key: 'week',  label: tr({ zh: '本周', en: 'Week',
        zhHant: "本週"
    }),   vsLabel: tr({ zh: '上周', en: 'last week',
        zhHant: "上週"
    }), cur: periods.week,  prev: periods.prevWeek },
    { key: 'month', label: tr({ zh: '本月', en: 'Month' }),  vsLabel: tr({ zh: '上月', en: 'last month' }), cur: periods.month, prev: periods.prevMonth },
    { key: 'year',  label: tr({ zh: '今年', en: 'Year' }),   vsLabel: tr({ zh: '去年', en: 'last year' }), cur: periods.year,  prev: periods.prevYear },
  ];

  const textVersion = useMemo(() => {
    const header = `${evName} — ${tr({ zh: '统计', en: 'Stats',
        zhHant: "統計"
    })} (n=${summary.count})`;
    const body = lines.map(([k, v]) => `${k}: ${v}`).join('\n');
    const subxBody = subX.length
      ? '\n\n' + (tr({ zh: 'sub-X 分布：', en: 'Sub-X breakdown:',
          zhHant: "sub-X 分佈："
    })) + '\n' +
          subX.map(s => `  ${s.label}: ${s.pct.toFixed(1)}%`).join('\n')
      : '';
    const periodsBody = '\n\n' + (tr({ zh: '时间段：', en: 'Time periods:',
        zhHant: "時間段："
    })) + '\n' +
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
        <h2 id="stats-modal-title">{tr({ zh: '完整统计', en: 'Full stats',
            zhHant: "完整統計"
        })} — {evName}</h2>

        <div className={`stats-modal-body stats-tab-${tab}`}>

        <div className="stats-tab-bar" role="tablist">
          {([
            { id: 'overview' as const, labelZh: '概览', labelEn: 'Overview', Icon: LayoutDashboard,
                labelZhHant: "概覽"
            },
            { id: 'charts'   as const, labelZh: '图表', labelEn: 'Charts',   Icon: BarChart3,
                labelZhHant: "圖表"
            },
            { id: 'cases'    as const, labelZh: '案例', labelEn: 'Cases',    Icon: Layers },
          ]).map(({ id, labelZh, labelEn, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={active ? 'stats-tab active' : 'stats-tab'}
              >
                <Icon size={14} aria-hidden />
                <span>{isZh ? labelZh : labelEn}</span>
              </button>
            );
          })}
        </div>

        <div className="modal-section" data-tab="overview">
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

        <div className="modal-section" data-tab="overview">
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
          <div className="modal-section" data-tab="overview">
            <h3 className="settings-h3">{tr({ zh: 'PB 单次', en: 'PB single',
                zhHant: "PB 單次"
            })}</h3>
            <div className="stats-modal-pb">
              <div>{pbStr}</div>
              <div className="scramble-text">{solves[pbIdx].scramble}</div>
            </div>
          </div>
        )}

        <div className="modal-section" data-tab="overview">
          <h3 className="settings-h3">{tr({ zh: '时间段', en: 'Time periods',
              zhHant: "時間段"
        })}</h3>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.9em', width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444', opacity: 0.75 }}>
                <th style={cellStyle}>{tr({ zh: '段', en: 'Period' })}</th>
                <th style={cellStyle}>n</th>
                <th style={cellStyle}>best</th>
                <th style={cellStyle}>ao5</th>
                <th style={cellStyle}>ao12</th>
                <th style={cellStyle}>mean</th>
                <th style={cellStyle}>{tr({ zh: '对比', en: 'vs prev',
                    zhHant: "對比"
                })}</th>
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

        <div data-tab="overview">
          <RecordsOverlay
            event={event}
            userPbSingleMs={userPbSingleMs}
            userPbAvgMs={userPbAvgMs}
            isZh={isZh}
          />
        </div>

        {event === '333' && (
          <div className="modal-section" data-tab="cases">
            <CfopCaseStatsPanel event={event} solves={solves} isZh={isZh} />
          </div>
        )}

        <div className="modal-section" data-tab="charts">
          <h3 className="settings-h3">{tr({ zh: '图表', en: 'Charts',
              zhHant: "圖表"
        })}</h3>
          <div className="stats-charts">
            <div className="stats-chart-card">
              <p className="stats-chart-title">
                {i18n.language === 'zh-Hant' ? (`單次散點（最近 ${Math.min(solves.length, 200)} 次）`) : (isZh
                                                    ? `单次散点（最近 ${Math.min(solves.length, 200)} 次）`
                                                    : `Per-solve scatter (last ${Math.min(solves.length, 200)})`)}
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
                {tr({ zh: '成绩分布', en: 'Time distribution',
                    zhHant: "成績分佈"
                })}
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

        {solves.filter(s => Number.isFinite(effectiveMs(s))).length >= 10 && (
          <div className="modal-section" data-tab="charts">
            <h3 className="settings-h3">
              {tr({ zh: '什么时候手感最好？', en: 'When are you fastest?',
                  zhHant: "什麼時候手感最好？"
            })}
            </h3>
            <div className="stats-charts">
              <div className="stats-chart-card">
                <HourChart
                  solves={solves}
                  isZh={isZh}
                  width={520}
                  height={160}
                />
              </div>
            </div>
          </div>
        )}

        {subX.length > 0 && (
          <div className="modal-section" data-tab="cases">
            <h3 className="settings-h3">{tr({ zh: 'sub-X 分布', en: 'Sub-X breakdown',
                zhHant: "sub-X 分佈"
            })}</h3>
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

        </div>

        <div className="modal-actions">
          <button onClick={onCopy} className="primary">
            {copied ? (tr({ zh: '已复制', en: 'Copied',
                zhHant: "已複製"
            })) : (tr({ zh: '复制文本', en: 'Copy text',
                zhHant: "複製文字"
            }))}
          </button>
          <button onClick={onClose}>{tr({ zh: '关闭', en: 'Close',
              zhHant: "關閉"
        })}</button>
        </div>
      </div>
    </div>
  );
}
