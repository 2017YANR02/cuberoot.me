'use client';

/**
 * HourChart — pure-SVG bar chart pair showing when the user is fastest.
 *
 * Two side-by-side panels:
 *   1. Hour-of-day (24 buckets, 0..23)
 *   2. Day-of-week (7 buckets, Mon..Sun)
 *
 * Each bucket renders a count bar (left Y axis) with a median-time dot
 * overlay (right Y axis). Bucketization uses local timezone via getHours()
 * / getDay(). DNFs are excluded from median; +2 penalties are folded into
 * effective time. Buckets with no valid solves still render an empty slot
 * so x-axis spacing stays uniform.
 */

import { useMemo } from 'react';
import type { Solve } from '../../_lib/types';
import { effectiveMs } from '../../_lib/types';
import { formatMs } from '../../_lib/stats';
import './charts.css';
import { tr } from '@/i18n/tr';

interface HourChartProps {
  solves: Solve[];
  isZh: boolean;
  width?: number;
  height?: number;
  className?: string;
}

interface Bucket {
  label: string;
  count: number;
  median: number | null; // ms; null when no valid solves
}

/** Median of a sorted ascending number array. */
function medianSorted(arr: number[]): number | null {
  const n = arr.length;
  if (n === 0) return null;
  if (n % 2 === 1) return arr[(n - 1) >> 1];
  return (arr[n / 2 - 1] + arr[n / 2]) / 2;
}

function buildBuckets(
  solves: Solve[],
  size: number,
  keyOf: (d: Date) => number,
  labelOf: (i: number) => string,
): Bucket[] {
  const slots: number[][] = Array.from({ length: size }, () => []);
  for (const s of solves) {
    const e = effectiveMs(s);
    if (!Number.isFinite(e)) continue;
    const k = keyOf(new Date(s.ts));
    if (k < 0 || k >= size) continue;
    slots[k].push(e);
  }
  return slots.map((arr, i) => {
    arr.sort((a, b) => a - b);
    return {
      label: labelOf(i),
      count: arr.length,
      median: medianSorted(arr),
    };
  });
}

interface PanelProps {
  buckets: Bucket[];
  isZh: boolean;
  title: string;
  width: number;
  height: number;
}

function Panel({ buckets, isZh, title, width, height }: PanelProps) {
  const padL = 32;
  const padR = 32;
  const padT = 20;
  const padB = 26;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const n = buckets.length;
  const maxCount = buckets.reduce((m, b) => (b.count > m ? b.count : m), 0);

  const finiteMedians = buckets.map(b => b.median).filter((v): v is number => v !== null);
  let mLo = Infinity;
  let mHi = -Infinity;
  for (const v of finiteMedians) {
    if (v < mLo) mLo = v;
    if (v > mHi) mHi = v;
  }
  if (!Number.isFinite(mLo) || !Number.isFinite(mHi)) {
    mLo = 0;
    mHi = 1;
  } else if (mLo === mHi) {
    const pad = Math.max(mLo * 0.1, 100);
    mLo -= pad;
    mHi += pad;
    if (mLo < 0) mLo = 0;
  } else {
    const pad = (mHi - mLo) * 0.15;
    mLo -= pad;
    mHi += pad;
    if (mLo < 0) mLo = 0;
  }

  const slotW = innerW / n;
  const barW = Math.max(2, slotW * 0.7);
  const xCenter = (i: number) => padL + slotW * (i + 0.5);
  const yCount = (c: number) =>
    maxCount === 0
      ? padT + innerH
      : padT + innerH - (c / maxCount) * innerH;
  const yMedian = (m: number) =>
    padT + innerH - ((m - mLo) / (mHi - mLo)) * innerH;

  const medianLabelTop = formatMs(mHi);
  const medianLabelBot = formatMs(mLo);

  return (
    <svg
      className="tc-chart tc-hour"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title}
    >
      <text
        className="tc-hour-title"
        x={width / 2}
        y={12}
        textAnchor="middle"
      >
        {title}
      </text>

      {/* Grid lines: top, mid, bottom */}
      <line className="grid-line" x1={padL} y1={padT + 0.5} x2={padL + innerW} y2={padT + 0.5} />
      <line className="grid-line" x1={padL} y1={padT + innerH / 2 + 0.5} x2={padL + innerW} y2={padT + innerH / 2 + 0.5} />
      <line className="axis-line" x1={padL} y1={padT + innerH + 0.5} x2={padL + innerW} y2={padT + innerH + 0.5} />

      {/* Left Y axis (count) */}
      <text className="axis-tick" x={padL - 4} y={padT + 3} textAnchor="end">
        {maxCount}
      </text>
      <text className="axis-tick" x={padL - 4} y={padT + innerH + 3} textAnchor="end">
        0
      </text>

      {/* Right Y axis (median ms) */}
      {finiteMedians.length > 0 && (
        <>
          <text className="tc-hour-median-tick" x={padL + innerW + 4} y={padT + 3} textAnchor="start">
            {medianLabelTop}
          </text>
          <text className="tc-hour-median-tick" x={padL + innerW + 4} y={padT + innerH + 3} textAnchor="start">
            {medianLabelBot}
          </text>
        </>
      )}

      {/* Bars */}
      {buckets.map((b, i) => {
        const cx = xCenter(i);
        const x = cx - barW / 2;
        const yTop = yCount(b.count);
        const h = padT + innerH - yTop;
        const tooltip = b.median !== null
          ? `${b.label} · n=${b.count} · ${tr({ zh: '中位', en: 'median' })} ${formatMs(b.median)}`
          : `${b.label} · n=${b.count}`;
        return (
          <g key={`bar-${i}`}>
            {b.count > 0 ? (
              <rect className="tc-hour-bar" x={x} y={yTop} width={barW} height={h}>
                <title>{tooltip}</title>
              </rect>
            ) : (
              <rect className="tc-hour-bar-empty" x={x} y={padT + innerH - 1} width={barW} height={1}>
                <title>{tooltip}</title>
              </rect>
            )}
          </g>
        );
      })}

      {/* Median dots */}
      {buckets.map((b, i) => {
        if (b.median === null) return null;
        const cx = xCenter(i);
        const cy = yMedian(b.median);
        return (
          <circle
            className="tc-hour-median-dot"
            key={`dot-${i}`}
            cx={cx}
            cy={cy}
            r={2.8}
          >
            <title>{`${b.label} · ${tr({ zh: '中位', en: 'median' })} ${formatMs(b.median)} · n=${b.count}`}</title>
          </circle>
        );
      })}

      {/* X-axis tick labels */}
      {buckets.map((b, i) => {
        // For 24-hour panel, show every 3rd label to avoid overlap.
        const showEvery = n > 12 ? 3 : 1;
        if (i % showEvery !== 0) return null;
        return (
          <text
            key={`xt-${i}`}
            className="axis-tick"
            x={xCenter(i)}
            y={height - 8}
            textAnchor="middle"
          >
            {b.label}
          </text>
        );
      })}
    </svg>
  );
}

export default function HourChart({
  solves,
  isZh,
  width = 520,
  height = 160,
  className,
}: HourChartProps) {
  const { hourBuckets, dowBuckets, validCount } = useMemo(() => {
    const hours = buildBuckets(
      solves,
      24,
      d => d.getHours(),
      i => String(i),
    );
    // JS getDay(): 0=Sun..6=Sat. Reorder to Mon..Sun.
    const dowEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dowZh = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const labels = isZh ? dowZh : dowEn;
    const dow = buildBuckets(
      solves,
      7,
      d => {
        const js = d.getDay();
        return js === 0 ? 6 : js - 1;
      },
      i => labels[i],
    );
    let total = 0;
    for (const b of hours) total += b.count;
    return { hourBuckets: hours, dowBuckets: dow, validCount: total };
  }, [solves, isZh]);

  if (validCount < 10) {
    return (
      <div className={`tc-hour-wrap ${className ?? ''}`.trim()}>
        <svg
          className="tc-chart tc-hour"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={tr({ zh: '时段分布', en: 'When-fastest chart'
        })}
        >
          <text
            className="empty-msg"
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {tr({ zh: '至少需 10 次有效成绩', en: 'Need 10+ solves'
            })}
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className={`tc-hour-wrap ${className ?? ''}`.trim()}>
      <Panel
        buckets={hourBuckets}
        isZh={isZh}
        title={tr({ zh: '按小时（0-23）', en: 'By hour (0-23)'
        })}
        width={width}
        height={height}
      />
      <Panel
        buckets={dowBuckets}
        isZh={isZh}
        title={tr({ zh: '按星期', en: 'By day of week' })}
        width={width}
        height={height}
      />
    </div>
  );
}
