'use client';

// Per-event scramble move-length distribution. Reads the histogram-per-event
// JSON produced by stats-build/bin/build_scramble_lengths.ts. Many events are
// fixed-length (4x4–7x7 / megaminx / clock) so their chart is a single bar;
// the spread lives in 333-family / 222 / pyram / skewb / sq1.

import { useEffect, useMemo, useState } from 'react';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import WcaEventSelector from '@/components/WcaEventSelector';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { ALL_EVENT_IDS, EVENT_ZH, EVENT_EN } from '@/lib/event-constants';
import { statsUrl } from '@/lib/stats-base';

interface EventLen {
  unit: 'moves' | 'twists';
  samples: number;
  counts: Record<string, number>;
}
interface EventLengthsJson {
  meta: { generated_at: string; total_scrambles: number; total_samples: number };
  events: Record<string, EventLen>;
}

const BAR = '#8B7D72'; // neutral warm — no color dimension here

function summarize(counts: Record<string, number>) {
  const entries = Object.entries(counts)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return null;
  let total = 0, sum = 0, mode = entries[0][0], modeN = 0;
  for (const [x, v] of entries) {
    total += v;
    sum += x * v;
    if (v > modeN) { modeN = v; mode = x; }
  }
  const pct = (p: number) => {
    const target = total * p;
    let cum = 0;
    for (const [x, v] of entries) { cum += v; if (cum >= target) return x; }
    return entries[entries.length - 1][0];
  };
  return {
    total,
    mean: sum / total,
    mode,
    median: pct(0.5),
    min: entries[0][0],
    max: entries[entries.length - 1][0],
  };
}

const eventName = (id: string, isZh: boolean) => (isZh ? EVENT_ZH[id] : EVENT_EN[id]) || id;
const unitLabel = (unit: string, isZh: boolean) =>
  unit === 'twists' ? (isZh ? '拧次' : 'twists') : (isZh ? '步' : 'moves');

export default function ScrambleLengthView({ isZh }: { isZh: boolean }) {
  const [data, setData] = useState<EventLengthsJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState('333');
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');

  useEffect(() => {
    fetch(statsUrl('/stats/scramble/event_lengths.json'))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const available = useMemo(
    () => new Set(data ? Object.keys(data.events) : []),
    [data],
  );

  // Keep the selection on an event that actually has data.
  useEffect(() => {
    if (data && !data.events[event]) {
      const first = ALL_EVENT_IDS.find((id) => data.events[id]);
      if (first) setEvent(first);
    }
  }, [data, event]);

  const cur = data?.events[event] ?? null;
  const stats = useMemo(() => (cur ? summarize(cur.counts) : null), [cur]);
  const series = useMemo<HistSeries[]>(
    () => (cur ? [{ name: eventName(event, isZh), fillColors: [BAR], counts: cur.counts }] : []),
    [cur, event, isZh],
  );

  const overview = useMemo(() => {
    if (!data) return [];
    return ALL_EVENT_IDS
      .filter((id) => data.events[id])
      .map((id) => ({ id, ...data.events[id], stats: summarize(data.events[id].counts) }));
  }, [data]);

  if (error) {
    return <div className="scramble-stats-error">{isZh ? '加载失败' : 'Load failed'}: {error}</div>;
  }
  if (!data) {
    return <div className="scramble-stats-loading">{isZh ? '加载中…' : 'Loading…'}</div>;
  }

  const totalN = data.meta.total_scrambles.toLocaleString();
  const isBootstrap = !!(data.meta as { bootstrap?: boolean }).bootstrap;
  const unitNote = isZh ? '步数;SQ1 计拧次,多盲每方块单独计' : 'moves; Square-1 in twists, multi-blind counted per cube';
  const source = isBootstrap
    ? (isZh
      ? `示例样本 ${totalN} 条打乱(取自部分比赛,完整全时段数据每日刷新后生效);按项目统计打乱记号长度(${unitNote})。`
      : `Sample of ${totalN} scrambles (a few competitions; full all-time data lands on the next daily refresh); scramble notation length per event (${unitNote}).`)
    : (isZh
      ? `来源: WCA 历史比赛全部 ${totalN} 条打乱原文;按项目统计打乱记号长度(${unitNote})。`
      : `Source: all ${totalN} historical WCA competition scrambles; scramble notation length per event (${unitNote}).`);

  return (
    <>
      <p className="scramble-stats-note">{source}</p>

      <div className="scramble-len-events">
        <WcaEventSelector
          availableEvents={available}
          selectedEvent={event}
          onSelect={setEvent}
          isZh={isZh}
        />
      </div>

      {cur && (
        <>
          <div className="scramble-stats-chart-wrapper">
            <DiscreteHistogram
              series={series}
              isZh={isZh}
              yMode={yMode}
              chartMode={chartMode}
              hideLegendColors
              onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
              onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
              yModeLabel={yMode === 'percent' ? (isZh ? '百分比' : '%') : (isZh ? '数量' : 'count')}
            />
          </div>

          {stats && (
            <div className="scramble-stats-panel">
              <div className="scramble-stats-panel-title">
                {eventName(event, isZh)} · {isZh ? '摘要统计' : 'Summary stats'}
                <span className="scramble-len-unit">({unitLabel(cur.unit, isZh)})</span>
              </div>
              <div className="scramble-stats-stat-grid">
                <Cell label={isZh ? '均值' : 'mean'} value={stats.mean.toFixed(2)} />
                <Cell label={isZh ? '中位数' : 'median'} value={String(stats.median)} />
                <Cell label={isZh ? '众数' : 'mode'} value={String(stats.mode)} />
                <Cell label={isZh ? '范围' : 'range'} value={`${stats.min}–${stats.max}`} />
                <Cell label={isZh ? '样本' : 'samples'} value={stats.total.toLocaleString()} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="scramble-stats-panel">
        <div className="scramble-stats-panel-title">{isZh ? '全部项目一览' : 'All events'}</div>
        <div className="scramble-len-overview">
          {overview.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`scramble-len-row${o.id === event ? ' active' : ''}`}
              onClick={() => setEvent(o.id)}
            >
              <EventIcon event={o.id} className="scramble-len-row-icon" title={eventName(o.id, isZh)} />
              {o.stats && (
                <>
                  <span className="scramble-len-row-median">
                    {o.stats.min === o.stats.max ? o.stats.min : `${o.stats.min}–${o.stats.max}`}
                    <span className="scramble-len-row-unit"> {unitLabel(o.unit, isZh)}</span>
                  </span>
                  <span className="scramble-len-row-n">{o.samples.toLocaleString()}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="scramble-stats-meta">
        <span>{isZh ? '生成时间' : 'Generated'}: {new Date(data.meta.generated_at).toLocaleString()}</span>
      </div>
    </>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="scramble-stats-stat-cell">
      <div className="scramble-stats-stat-label">{label}</div>
      <div className="scramble-stats-stat-value">{value}</div>
    </div>
  );
}
