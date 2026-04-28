/**
 * HistogramChart — pure-SVG time distribution for a list of solves.
 *
 * Effective time = Solve.timeMs (+2000 if +2 penalty); DNF excluded.
 * Auto-buckets the range [min,max] into `bucketCount` equal-width buckets.
 */

import { useMemo } from 'react';
import type { Solve } from '../types';
import { effectiveMs } from '../types';
import { formatMs } from '../stats';
import './charts.css';

interface HistogramChartProps {
  solves: Solve[];
  isZh: boolean;
  /** Width × height in px. Default 320 × 140. */
  width?: number;
  height?: number;
  /** Number of buckets. Default 12. */
  bucketCount?: number;
  className?: string;
}

interface Bucket {
  lo: number;
  hi: number;
  count: number;
}

/** Build equal-width buckets from finite times. */
function buildBuckets(times: number[], bucketCount: number): Bucket[] {
  if (times.length === 0 || bucketCount <= 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const t of times) {
    if (t < min) min = t;
    if (t > max) max = t;
  }
  // Degenerate case: all values equal — give a small artificial span.
  if (min === max) {
    const pad = Math.max(min * 0.05, 100);
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const w = span / bucketCount;
  const buckets: Bucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({ lo: min + i * w, hi: min + (i + 1) * w, count: 0 });
  }
  for (const t of times) {
    let idx = Math.floor((t - min) / w);
    if (idx >= bucketCount) idx = bucketCount - 1; // include max in last bucket
    if (idx < 0) idx = 0;
    buckets[idx].count++;
  }
  return buckets;
}

export default function HistogramChart({
  solves,
  isZh,
  width = 320,
  height = 140,
  bucketCount = 12,
  className,
}: HistogramChartProps) {
  const { buckets, peakCount, minT, maxT, finiteCount } = useMemo(() => {
    const times: number[] = [];
    for (const s of solves) {
      const e = effectiveMs(s);
      if (Number.isFinite(e)) times.push(e);
    }
    const bs = buildBuckets(times, bucketCount);
    let peak = 0;
    for (const b of bs) if (b.count > peak) peak = b.count;
    return {
      buckets: bs,
      peakCount: peak,
      minT: bs.length > 0 ? bs[0].lo : 0,
      maxT: bs.length > 0 ? bs[bs.length - 1].hi : 0,
      finiteCount: times.length,
    };
  }, [solves, bucketCount]);

  // Empty state — collapse to a tiny one-line hint instead of a full chart frame.
  if (finiteCount < 5) {
    return (
      <div className={`chart-empty-hint ${className ?? ''}`.trim()}>
        {isZh ? '至少 5 次成绩才显示分布' : 'Need 5+ solves to chart distribution'}
      </div>
    );
  }

  // Layout
  const padL = 6;
  const padR = 6;
  const padT = 14;
  const padB = 18;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const barW = innerW / buckets.length;
  const minBarH = 2; // visual presence for non-zero buckets
  const emptyH = 1;  // tiny baseline mark for empty buckets

  const peak = Math.max(peakCount, 1);
  const midT = (minT + maxT) / 2;

  return (
    <svg
      className={`tc-chart tc-hist ${className ?? ''}`.trim()}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={isZh ? '成绩分布直方图' : 'Solve time histogram'}
    >
      {/* Bars */}
      {buckets.map((b, i) => {
        const x = padL + i * barW;
        let h: number;
        let cls: string;
        if (b.count === 0) {
          h = emptyH;
          cls = 'bar-empty';
        } else {
          const ratio = b.count / peak;
          h = Math.max(minBarH, ratio * innerH);
          cls = 'bar';
        }
        const y = padT + innerH - h;
        return (
          <rect
            key={i}
            className={cls}
            x={x + 0.5}
            y={y}
            width={Math.max(1, barW - 1)}
            height={h}
            rx={1}
          >
            <title>
              {`${formatMs(b.lo)} – ${formatMs(b.hi)}: ${b.count}`}
            </title>
          </rect>
        );
      })}

      {/* Peak count label */}
      {peakCount > 0 && (
        <text
          className="peak-label"
          x={width - padR}
          y={padT - 2}
          textAnchor="end"
        >
          {`max ${peakCount}`}
        </text>
      )}

      {/* Bottom axis */}
      <line
        className="axis-line"
        x1={padL}
        y1={padT + innerH + 0.5}
        x2={padL + innerW}
        y2={padT + innerH + 0.5}
      />
      <text
        className="axis-tick"
        x={padL}
        y={height - 4}
        textAnchor="start"
      >
        {formatMs(minT)}
      </text>
      <text
        className="axis-tick"
        x={padL + innerW / 2}
        y={height - 4}
        textAnchor="middle"
      >
        {formatMs(midT)}
      </text>
      <text
        className="axis-tick"
        x={padL + innerW}
        y={height - 4}
        textAnchor="end"
      >
        {formatMs(maxT)}
      </text>
    </svg>
  );
}
