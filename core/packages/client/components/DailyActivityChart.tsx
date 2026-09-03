'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import './daily-activity-chart.css';

export type DailyActivityTone = 'accent' | 'success' | 'info';

export interface DailyActivitySeries {
  key: string;
  label: string;
  tone: DailyActivityTone;
}

export interface DailyActivityPoint {
  date: string;
  values: Record<string, number>;
  available?: boolean;
}

export interface DailyActivityChartProps {
  data: DailyActivityPoint[];
  series: DailyActivitySeries[];
  ariaLabel: string;
  emptyLabel: string;
  from?: string;
  to?: string;
}

const HEIGHT = 252;
const MARGIN = { top: 18, right: 16, bottom: 30, left: 38 };

function readableMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function dataAcrossRange(data: DailyActivityPoint[], from?: string, to?: string): DailyActivityPoint[] {
  if (!data.length || !from || !to || from > to) return data;
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return data;

  const byDate = new Map(data.map((point) => [point.date, point]));
  const result: DailyActivityPoint[] = [];
  for (let cursor = start; cursor <= end; cursor += 86400000) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    result.push(byDate.get(date) ?? { date, values: {}, available: false });
  }
  return result;
}

export function DailyActivityChart({ data, series, ariaLabel, emptyLabel, from, to }: DailyActivityChartProps) {
  const chartData = useMemo(() => dataAcrossRange(data, from, to), [data, from, to]);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, chartData.length - 1));
  const dayRefs = useRef<Array<SVGGElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setSelectedIndex(Math.max(0, chartData.length - 1));
    requestAnimationFrame(() => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      scroll.scrollLeft = window.matchMedia('(max-width: 479px)').matches
        ? scroll.scrollWidth - scroll.clientWidth
        : 0;
    });
  }, [chartData]);

  const width = Math.max(880, MARGIN.left + MARGIN.right + chartData.length * (series.length > 1 ? 24 : 18));
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxValue = readableMax(Math.max(0, ...chartData.flatMap((point) => series.map((item) => point.values[item.key] ?? 0))));
  const step = chartData.length ? plotWidth / chartData.length : plotWidth;
  const groupWidth = Math.min(step * 0.72, series.length > 1 ? 20 : 13);
  const gap = series.length > 1 ? 2 : 0;
  const barWidth = Math.max(1, (groupWidth - gap * (series.length - 1)) / Math.max(1, series.length));
  const labelEvery = Math.max(1, Math.ceil(chartData.length / 7));
  const selected = chartData[Math.min(selectedIndex, Math.max(0, chartData.length - 1))];
  const hasUnavailableDays = chartData.some((point) => point.available === false);

  const totalBySeries = useMemo(() => new Map(series.map((item) => [
    item.key,
    data.reduce((sum, point) => sum + (point.values[item.key] ?? 0), 0),
  ])), [data, series]);

  const moveSelection = (event: KeyboardEvent<SVGGElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (event.key === 'ArrowRight') next = Math.min(chartData.length - 1, index + 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = data.length - 1;
    else return;
    event.preventDefault();
    setSelectedIndex(next);
    requestAnimationFrame(() => {
      const day = dayRefs.current[next];
      const scroll = scrollRef.current;
      day?.focus();
      if (!day || !scroll) return;
      const dayBounds = day.getBoundingClientRect();
      const scrollBounds = scroll.getBoundingClientRect();
      if (dayBounds.left < scrollBounds.left) scroll.scrollLeft -= scrollBounds.left - dayBounds.left + 12;
      else if (dayBounds.right > scrollBounds.right) scroll.scrollLeft += dayBounds.right - scrollBounds.right + 12;
    });
  };

  if (!data.length) return <p className="daily-activity-chart__empty">{emptyLabel}</p>;

  return (
    <div className="daily-activity-chart" aria-label={ariaLabel}>
      <div className="daily-activity-chart__readout" aria-live="polite">
        <time dateTime={selected?.date}>{selected?.date}</time>
        {series.map((item) => (
          <span key={item.key} className={`daily-activity-chart__readout-value is-${item.tone}`}>
            <i aria-hidden="true" />
            {item.label}
            <strong>{selected?.available === false ? '—' : (selected?.values[item.key] ?? 0)}</strong>
          </span>
        ))}
      </div>

      <div ref={scrollRef} className="daily-activity-chart__scroll" tabIndex={0}>
        <svg
          className="daily-activity-chart__canvas"
          style={{ '--daily-chart-width': `${width}px` } as CSSProperties}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={ariaLabel}
          preserveAspectRatio="none"
        >
          {[0, 1, 2, 3, 4].map((tick) => {
            const y = MARGIN.top + plotHeight * tick / 4;
            const value = Math.round(maxValue * (1 - tick / 4));
            return (
              <g key={tick} className="daily-activity-chart__grid">
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y} y2={y} />
                <text x={MARGIN.left - 8} y={y + 4}>{value}</text>
              </g>
            );
          })}

          {chartData.map((point, index) => {
            const center = MARGIN.left + step * index + step / 2;
            const startX = center - groupWidth / 2;
            const selectedPoint = index === selectedIndex;
            const pointLabel = `${point.date}: ${series.map((item) => `${item.label} ${point.available === false ? '—' : (point.values[item.key] ?? 0)}`).join(', ')}`;
            return (
              <g
                key={point.date}
                ref={(node) => { dayRefs.current[index] = node; }}
                className={`daily-activity-chart__day${selectedPoint ? ' is-selected' : ''}`}
                role="button"
                tabIndex={selectedPoint ? 0 : -1}
                aria-label={pointLabel}
                onFocus={() => setSelectedIndex(index)}
                onPointerEnter={() => setSelectedIndex(index)}
                onPointerDown={() => setSelectedIndex(index)}
                onKeyDown={(event) => moveSelection(event, index)}
              >
                {selectedPoint && (
                  <line className="daily-activity-chart__guide" x1={center} x2={center} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} />
                )}
                {series.map((item, seriesIndex) => {
                  if (point.available === false) return null;
                  const value = Math.max(0, point.values[item.key] ?? 0);
                  const height = value / maxValue * plotHeight;
                  return (
                    <rect
                      key={item.key}
                      className={`daily-activity-chart__bar is-${item.tone}`}
                      x={startX + seriesIndex * (barWidth + gap)}
                      y={MARGIN.top + plotHeight - height}
                      width={barWidth}
                      height={height}
                      rx={Math.min(2, barWidth / 3)}
                    />
                  );
                })}
                <rect
                  className="daily-activity-chart__hit"
                  x={MARGIN.left + step * index}
                  y={MARGIN.top}
                  width={step}
                  height={plotHeight}
                />
                {(index === 0 || index === chartData.length - 1 || index % labelEvery === 0) && (
                  <text className="daily-activity-chart__date" x={center} y={HEIGHT - 9}>{point.date.slice(5)}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="daily-activity-chart__totals">
        {series.map((item) => (
          <span key={item.key}>
            {item.label}
            <strong>{hasUnavailableDays ? '—' : (totalBySeries.get(item.key) ?? 0)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
