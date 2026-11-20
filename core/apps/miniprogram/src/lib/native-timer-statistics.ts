import { rollingStatBest, rollingStatCurrent, type RollingStatKey } from '@cuberoot/shared/timer/rolling-stats';
import {
  bestMbldSolve, bestSingle, buildTimerHistogramBuckets, eventDefaultFormat, formatEventMs, formatMs,
  formatMbldResult, formatSolveResult, pbSingleIndex, sdOfBestAoN, sdOfLastN, subXBreakdown,
  summarize, timerStatsCfopCases, timerStatsScatterSeries,
} from '@cuberoot/shared/timer/stats';
import {
  TIMER_STATS_DATE_RANGES, filterSolvesByStatsDateRange, longestSolveDayStreak, timerStatsDaily,
  timerStatsPeriodPairs, timerStatsPracticeTimes, type TimerBucketStats, type TimerStatsDateRange,
} from '@cuberoot/shared/timer/stats-buckets';
import { effectiveMs, eventInfo, type EventId, type Solve } from '@cuberoot/shared/timer/types';
import { getMiniProgramLocale, tr, type MiniProgramLocale } from './i18n';

const tabs = {
  overview: { en: 'Overview', zh: '概览', icon: 'layout-dashboard' },
  daily: { en: 'By day', zh: '按天', icon: 'calendar-days' },
  charts: { en: 'Charts', zh: '图表', icon: 'bar-chart-3' },
  cases: { en: 'Cases', zh: '案例', icon: 'layers' },
} as const;
export const NATIVE_TIMER_STATISTICS_COMPACT_WIDTH = 768;
export type NativeTimerStatisticsTab = keyof typeof tabs;
export function isNativeTimerStatisticsTab(value: unknown): value is NativeTimerStatisticsTab {
  return typeof value === 'string' && Object.hasOwn(tabs, value);
}

const rangeLabels = {
  all: { en: 'All', zh: '全部' }, '7d': { en: '7d', zh: '近7天' }, '30d': { en: '30d', zh: '近30天' },
  '90d': { en: '90d', zh: '近90天' }, '365d': { en: '365d', zh: '近一年' },
} as const;
const periodLabels = {
  today: [{ en: 'Today', zh: '今日' }, { en: 'yesterday', zh: '昨日' }],
  week: [{ en: 'Week', zh: '本周' }, { en: 'last week', zh: '上周' }],
  month: [{ en: 'Month', zh: '本月' }, { en: 'last month', zh: '上月' }],
  year: [{ en: 'Year', zh: '今年' }, { en: 'last year', zh: '去年' }],
} as const;
const weekdays = { en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], zh: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] };
const summaryColumns: readonly RollingStatKey[] = ['mo3', 'ao5', 'ao12', 'ao25', 'ao50', 'ao100'];
const averageSizes = [5, 12, 50, 100, 1000] as const;
const plotHeight = 38;

function periodRows(solves: Solve[], format: (ms: number | null) => string, now: Date, language: MiniProgramLocale) {
  const display = (stats: TimerBucketStats) => ({ count: stats.count, best: format(stats.best), ao5: format(stats.ao5),
    ao12: format(stats.ao12), mean: format(stats.mean) });
  const delta = (a: number | null, b: number | null) => a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)
    ? null : { better: a === b ? null : a < b, label: a === b ? '=' : `${a < b ? '▲' : '▼'} ${format(Math.abs(a - b))}` };
  return timerStatsPeriodPairs(solves, now).map(({ key, current, previous }) => ({
    key, label: tr(periodLabels[key][0], language), previousLabel: tr(periodLabels[key][1], language),
    current: display(current), previous: display(previous),
    bestDelta: delta(current.best, previous.best), ao5Delta: delta(current.ao5, previous.ao5),
  }));
}

function overview(solves: Solve[], event: EventId, name: string, now: Date, language: MiniProgramLocale) {
  const t = (copy: { en: string; zh: string }) => tr(copy, language);
  const f = (value: number | null) => formatEventMs(event, value);
  const summary = summarize(solves, event);
  const best = bestSingle(solves, event);
  const pbIndex = pbSingleIndex(solves, event);
  const pbSolve = solves[pbIndex];
  const pb = pbSolve ? { result: formatSolveResult(pbSolve), date: new Date(pbSolve.ts).toLocaleDateString(), scramble: pbSolve.scramble } : null;
  const last = solves.at(-1);
  const bestMbld = event === '333mbld' ? bestMbldSolve(solves) : null;
  const rows = [{ key: 'time', label: t({ en: 'time', zh: '单次' }), current: last ? formatSolveResult(last) : '-',
    best: event === '333mbld' ? bestMbld ? formatMbldResult(bestMbld) : '—' : f(best) }];
  if (event !== '333mbld') for (const key of summaryColumns) rows.push({
    key, label: key, current: f(rollingStatCurrent(solves, key)), best: f(rollingStatBest(solves, key)),
  });
  const metrics = [
    { label: t({ en: 'Event', zh: '项目' }), value: name },
    { label: t({ en: 'Count', zh: '次数' }), value: String(summary.count) },
  ];
  if (best !== null) metrics.push({ label: t({ en: 'Best single', zh: '最佳单次' }), value: f(best) });
  if (pb) metrics.push({ label: t({ en: 'PB date', zh: 'PB 日期' }), value: pb.date });
  metrics.push({ label: t({ en: 'Mean', zh: '平均' }), value: summary.mean }, { label: 'σ', value: summary.sd });
  const suffix = (value: number | null) => value === null || !Number.isFinite(value) ? '' : ` (σ ${f(Math.round(value))})`;
  const format = eventDefaultFormat(event).kind;
  if (format === 'mo3' || event === '333fm') metrics.push(
    { label: 'mo3', value: summary.mo3 + suffix(sdOfLastN(solves, 3)) },
    { label: t({ en: 'Best mo3', zh: '最佳 mo3' }), value: summary.bestMo3 },
  );
  if (format === 'bo3') metrics.push({ label: 'bo3', value: summary.bo3 },
    { label: t({ en: 'Best bo3', zh: '最佳 bo3' }), value: summary.bestBo3 });
  for (const size of averageSizes) metrics.push({ label: `ao${size}`, value: summary[`ao${size}`] + suffix(sdOfLastN(solves, size)) });
  for (const size of averageSizes) metrics.push({
    label: t({ en: `Best ao${size}`, zh: `最佳 ao${size}` }), value: summary[`bestAo${size}`] + suffix(sdOfBestAoN(solves, size)),
  });
  const streak = longestSolveDayStreak(solves);
  if (streak > 0) metrics.push({ label: t({ en: 'Longest streak', zh: '最长连续天数' }), value: `${streak} ${t({ en: 'days', zh: '天' })}` });
  const subX = subXBreakdown(solves);
  const parts = [
    `${name} — ${t({ en: 'Stats', zh: '统计' })} (n=${summary.count})\n${metrics.map(item => `${item.label}: ${item.value}`).join('\n')}`,
  ];
  if (subX.length) parts.push(`${t({ zh: 'sub-X 分布：', en: 'Sub-X breakdown:' })}\n${subX.map(item => `  ${item.label}: ${item.pct.toFixed(1)}%`).join('\n')}`);
  parts.push(`${t({ zh: '时间段：', en: 'Time periods:' })}\n${periodRows(solves, f, now, language).map(({ label, current }) =>
    `  ${label}: n=${current.count}  best=${current.best}  ao5=${current.ao5}  ao12=${current.ao12}  mean=${current.mean}`).join('\n')}`);
  return { rows, metrics, summary, pb, reportText: parts.join('\n\n') };
}

function daily(solves: Solve[], event: EventId, now: Date, total: boolean, offset: number, language: MiniProgramLocale) {
  const f = (value: number | null) => formatEventMs(event, value);
  const view = timerStatsDaily(solves, event, total, offset);
  const { current: c, previous: p } = view;
  const row = (key: string, copy: { en: string; zh: string }, value: number | null, previous: number | null,
    format: (value: number) => string, lowerIsBetter = true) => {
    const valid = value !== null && Number.isFinite(value);
    const delta = valid && previous !== null && Number.isFinite(previous) ? value - previous : 0;
    return { key, label: tr(copy, language), value: valid ? format(value) : '—',
      delta: delta === 0 ? '' : `${delta > 0 ? '▲' : '▼'} ${format(Math.abs(delta))}`, better: delta === 0 ? null : (delta < 0) === lowerIsBetter };
  };
  return {
    periods: periodRows(solves, f, now, language),
    practice: {
      days: view.days, day: view.day, offset: view.offset, canPrevious: view.canPrevious, canNext: view.canNext, total,
      title: total ? tr({ en: `All ${view.days} days`, zh: `全部 ${view.days} 天` }, language) : view.day ?? '',
      rows: [
        row('mean', { en: 'Mean', zh: '平均成绩' }, c.mean, p?.mean ?? null, f),
        row('best', { en: 'Best', zh: '最佳成绩' }, c.best, p?.best ?? null, f),
        row('count', { en: 'Solves', zh: '练习次数' }, c.count, p?.count ?? null, String, false),
        { ...row('stm', { en: 'Mean STM', zh: '平均步数' }, c.metrics.stm, p?.metrics.stm ?? null, n => n.toFixed(1)),
          note: c.metrics.n > 0 && c.metrics.n !== c.count ? tr({ en: `${c.metrics.n} with a move log`, zh: `${c.metrics.n} 把有动作流` }, language) : '' },
        row('tps', { en: 'Mean TPS', zh: '平均 TPS' }, c.metrics.tps, p?.metrics.tps ?? null, n => n.toFixed(2), false),
        row('fluency', { en: 'Mean fluency', zh: '平均流畅' }, c.metrics.fluency, p?.metrics.fluency ?? null, n => `${n.toFixed(0)}%`, false),
      ],
    },
  };
}

function percent(value: number, min: number, max: number): number {
  return max === min ? 50 : Math.max(0, Math.min(100, (value - min) * 100 / (max - min)));
}

function charts(solves: Solve[], event: EventId, language: MiniProgramLocale) {
  const t = (copy: { en: string; zh: string }) => tr(copy, language);
  const series = timerStatsScatterSeries(solves);
  const n = series.points.length;
  const y = (value: number) => 100 - percent(value, series.min ?? 0, series.max ?? 1);
  const points = series.points.map(({ solve, index, value, ao12 }) => ({
    index, id: solve.id, x: percent(index, 1, n), y: value === null ? 0 : y(value),
    ao12Y: ao12 === null ? null : y(ao12), ao12, isDnf: value === null, isPlus2: solve.penalty === '+2',
    label: `#${index} · ${formatSolveResult(solve)}`,
  }));
  const trend = points.flatMap((point, index) => {
    const previous = points[index - 1];
    if (!previous || previous.ao12Y === null || point.ao12Y === null) return [];
    const dx = point.x - previous.x;
    const dy = (point.ao12Y - previous.ao12Y) * plotHeight / 100;
    return [{ index, left: previous.x, top: previous.ao12Y, width: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) * 180 / Math.PI }];
  });
  const finite = solves.map(effectiveMs).filter(Number.isFinite);
  const bins = finite.length >= 5 ? buildTimerHistogramBuckets(finite, 20) : [];
  const peak = Math.max(1, ...bins.map(bin => bin.count));
  const when = timerStatsPracticeTimes(solves);
  const bars = (rows: typeof when.hours, label: (index: number) => string) => {
    const highest = Math.max(1, ...rows.map(row => row.count));
    const medians = rows.flatMap(row => row.median === null ? [] : [row.median]);
    const lo = medians.length ? Math.min(...medians) : 0;
    const hi = medians.length ? Math.max(...medians) : 1;
    const pad = lo === hi ? Math.max(lo * .10, 100) : (hi - lo) * .15;
    const min = Math.max(0, lo - pad), max = hi + pad;
    return {
      axis: { count: highest, min: formatMs(min), max: formatMs(max) },
      bars: rows.map(row => ({ ...row, label: label(row.index), height: row.count / highest * 100,
        medianY: row.median === null ? null : 100 - percent(row.median, min, max),
        medianText: row.median === null ? '—' : formatMs(row.median) })),
    };
  };
  return {
    scatter: {
      visible: n >= 2 && series.min !== null, title: t({ en: `Per-solve scatter (last ${n})`, zh: `单次散点（最近 ${n} 次）` }),
      empty: t({ en: 'Need 2+ solves', zh: '至少 2 次成绩' }), min: formatMs(series.min), max: formatMs(series.max),
      mid: series.min !== null && series.max !== null ? formatMs((series.min + series.max) / 2) : '',
      best: series.best === null ? null : { value: series.best, label: formatMs(series.best), y: y(series.best) },
      points, trend, plotHeight, attempts: [1, Math.ceil(n / 2), n],
    },
    distribution: {
      title: t({ en: 'Time distribution', zh: '成绩分布' }),
      empty: t({ en: 'Need 5+ solves to chart distribution', zh: '至少 5 次成绩才显示分布' }),
      min: bins.length ? formatMs(bins[0].lo) : '', max: bins.length ? formatMs(bins[bins.length - 1].hi) : '',
      mid: bins.length ? formatMs((bins[0].lo + bins[bins.length - 1].hi) / 2) : '', peak,
      bins: bins.map((bin, index) => ({ ...bin, index, height: bin.count / peak * 100,
        label: `${formatMs(bin.lo)} – ${formatMs(bin.hi)}: ${bin.count}` })),
    },
    practiceTimes: when.count >= 10 ? {
      title: t({ zh: '什么时候手感最好？', en: 'When are you fastest?' }),
      hourLabel: t({ zh: '按小时（0-23）', en: 'By hour (0-23)' }), dayLabel: t({ zh: '按星期', en: 'By day of week' }),
      countLabel: t({ zh: '次数', en: 'Count' }), medianLabel: t({ zh: '中位数', en: 'Median' }),
      hours: bars(when.hours, String), weekdays: bars(when.weekdays, index => weekdays[language][index]),
    } : null,
    event,
  };
}

function cases(solves: Solve[], event: EventId, showAll: NativeTimerStatisticsOptions['showAllCases'], language: MiniProgramLocale) {
  const group = (stage: 'oll' | 'pll') => {
    const rows = timerStatsCfopCases(solves, stage);
    const display = (value: typeof rows[number]) => ({ id: value.id, count: value.count,
      avg: formatMs(value.avg), best: formatMs(value.best), worst: formatMs(value.worst) });
    const slowest = rows.filter(row => row.count >= 3).sort((a, b) => b.avg - a.avg).slice(0, 3).map(display);
    const expanded = showAll?.[stage] ?? false;
    const remaining = Math.max(0, rows.length - 20);
    const name = stage.toUpperCase();
    return { stage, title: tr({ zh: `${name} Case 统计`, en: `${name} case stats` }, language),
      rows: (expanded ? rows : rows.slice(0, 20)).map(display), remaining, expanded, slowest,
      expandLabel: tr({ zh: `展开剩余 ${remaining} 项`, en: `Show ${remaining} more` }, language) };
  };
  return {
    title: tr({ zh: 'sub-X 分布', en: 'Sub-X breakdown' }, language),
    thresholds: subXBreakdown(solves).map(item => ({ ...item, text: `${item.pct.toFixed(1)}%` })),
    cfop: event === '333' ? [group('oll'), group('pll')] : [],
  };
}

export interface NativeTimerStatisticsOptions {
  tab?: NativeTimerStatisticsTab;
  wide?: boolean;
  range?: TimerStatsDateRange;
  total?: boolean;
  dayOffset?: number;
  showAllCases?: Partial<Record<'oll' | 'pll', boolean>>;
  now?: number;
  language?: MiniProgramLocale;
}

/** Filter once and prepare only the visible sections. */
export function nativeTimerStatistics(rawSolves: readonly Solve[], event: EventId, options: NativeTimerStatisticsOptions = {}) {
  const { tab = 'overview', wide = false, range = 'all', total = false, dayOffset = 0, showAllCases,
    language = getMiniProgramLocale(), now = Date.now() } = options;
  const solves = filterSolvesByStatsDateRange(rawSolves, range, now);
  const info = eventInfo(event);
  const name = language === 'zh' ? info.nameZh : info.nameEn;
  const t = (copy: { en: string; zh: string }) => tr(copy, language);
  return {
    title: `${t({ en: 'Full stats', zh: '完整统计' })} — ${name}`,
    tab, wide, range, count: solves.length,
    tabs: Object.entries(tabs).map(([id, copy]) => ({ id, label: t(copy), icon: copy.icon, selected: id === tab })),
    ranges: TIMER_STATS_DATE_RANGES.map(id => ({ id, label: t(rangeLabels[id]), selected: id === range })),
    copy: {
      current: t({ en: 'current', zh: '当前' }), best: t({ en: 'best', zh: '最佳' }),
      fewer: t({ en: 'Fewer metrics', zh: '收起指标' }), more: t({ en: 'More metrics', zh: '更多指标' }),
      pb: t({ en: 'PB single', zh: 'PB 单次' }), copy: t({ en: 'Copy text', zh: '复制文本' }),
      periods: t({ en: 'Time periods', zh: '时间段' }),
      modes: [t({ en: 'Day', zh: '日' }), t({ en: 'All', zh: '总' })],
      dayMode: t({ en: 'Per day or all-time', zh: '按天看还是看全部' }),
      prevDay: t({ en: 'Previous day with solves', zh: '上一次练的那天' }), nextDay: t({ en: 'Next day with solves', zh: '下一次练的那天' }),
      vsLast: t({ en: 'vs last', zh: '较上次' }), vsPrev: t({ en: 'vs prev', zh: '对比' }),
      period: t({ en: 'Period', zh: '段' }), count: t({ en: 'Count', zh: '次数' }),
      mean: t({ en: 'Mean', zh: '平均' }), stat: t({ en: 'Stat', zh: '统计项' }), value: t({ en: 'Value', zh: '统计数据' }),
      copied: t({ en: 'Copied', zh: '已复制' }), caseDetails: t({ en: 'OLL / PLL case stats', zh: 'OLL / PLL Case 统计' }),
      case: t({ en: 'Case', zh: '案例' }), worst: t({ en: 'Worst', zh: '最差' }),
      emptyCases: t({ en: 'No solves with stage analysis yet', zh: '暂无含阶段分析的成绩' }),
      slowest: t({ en: 'Top 3 slowest (drill candidates):', zh: '最慢 Top 3（建议刷）：' }),
      hideCases: t({ en: 'Collapse', zh: '收起' }), noThresholds: t({ en: 'No threshold breakdown yet', zh: '暂无阈值分布' }),
    },
    overview: wide || tab === 'overview' ? overview(solves, event, name, new Date(now), language) : null,
    daily: wide || tab === 'daily' ? daily(solves, event, new Date(now), total, dayOffset, language) : null,
    charts: wide || tab === 'charts' ? charts(solves, event, language) : null,
    cases: wide || tab === 'cases' ? cases(solves, event, showAllCases, language) : null,
  };
}
