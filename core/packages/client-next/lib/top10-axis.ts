// Shared axis math + tick formatting for Top10HistoryPage and its export render.
// Different from lib/wca-format-result: tick labels use a *compact* style
// (integer seconds, FMC avg without decimals) so the chart axis stays uncluttered.

export type Metric =
  | 'single' | 'average'
  | 'bao5' | 'wao5' | 'mo5' | 'bpa' | 'wpa'
  | 'median' | 'best_counting' | 'worst_counting' | 'worst';

const TIME_BRACKETS: Array<[number, number]> = [
  [1000, 100],       // ≤10s:  1s 步长
  [2500, 500],       // ≤25s:  5s 步长
  [6000, 1000],      // ≤1min: 10s 步长
  [18000, 3000],     // ≤3min: 30s 步长
  [36000, 6000],     // ≤6min: 1min 步长
  [90000, 18000],    // ≤15min: 3min 步长
  [180000, 30000],   // ≤30min: 5min 步长
  [360000, 60000],   // ≤60min: 10min 步长
  [720000, 120000],  // ≤120min: 20min 步长
  [Infinity, 360000],// else: 60min 步长
];

export function axisFor(eventId: string, metric: Metric, maxV: number): { max: number; step: number; hideAxis: boolean } {
  if (eventId === '333mbf' || eventId === '333mbo') {
    return { max: Math.max(maxV * 1.05, 1), step: maxV || 1, hideAxis: true };
  }
  if (eventId === '333fm' && metric === 'single') {
    if (maxV <= 30) return { max: Math.max(20, Math.ceil(maxV / 5) * 5), step: 5, hideAxis: false };
    return { max: Math.ceil(maxV / 10) * 10, step: 10, hideAxis: false };
  }
  const step = TIME_BRACKETS.find(([limit]) => maxV <= limit)![1];
  const max = Math.max(step, Math.ceil(maxV / step) * step);
  return { max, step, hideAxis: false };
}

export function tickLabel(v: number, eventId: string, metric: Metric): string {
  if (eventId === '333mbf' || eventId === '333mbo') return '';
  if (eventId === '333fm') return metric === 'single' ? String(v) : Math.round(v / 100).toString();
  if (v === 0) return '0';
  const sec = v / 100;
  if (sec < 60) return Number.isInteger(sec) ? String(sec) : sec.toFixed(1);
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return s === 0 ? `${m}:00` : `${m}:${String(Math.round(s)).padStart(2, '0')}`;
}
