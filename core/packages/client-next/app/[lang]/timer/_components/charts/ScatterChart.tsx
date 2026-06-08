'use client';

/**
 * ScatterChart — pure-SVG scatter plot of single-solve times over solve index.
 *
 * Inputs are expected oldest → newest (same convention as TrendChart / stats.ts).
 * X = solve index within the plotted window (1-based).
 * Y = effective ms (post-penalty). DNFs are drawn as open circles pinned to
 * the top of the y-axis. +2 solves get a tinted dot. PB and an ao12 trendline
 * are overlaid for context.
 */

import { useMemo } from 'react';
import type { Solve } from '../../_lib/types';
import { effectiveMs } from '../../_lib/types';
import { averageOfN, formatMs, bestSingle } from '../../_lib/stats';
import './charts.css';
import { tr } from '@/i18n/tr';

interface ScatterChartProps {
  solves: Solve[];
  isZh: boolean;
  /** Last N solves to plot. Default 200. */
  windowSize?: number;
  width?: number;
  height?: number;
  className?: string;
}

interface Point {
  i: number;       // 1-based index within the window
  origIdx: number; // index into the (sliced) `view` array
  ms: number;      // effective ms (Infinity for DNF)
  isDnf: boolean;
  isPlus2: boolean;
}

export default function ScatterChart({
  solves,
  isZh,
  windowSize = 200,
  width = 320,
  height = 160,
  className,
}: ScatterChartProps) {
  const {
    view,
    points,
    pb,
    yLo,
    yHi,
    ao12Series,
    hasAny,
  } = useMemo(() => {
    const start = Math.max(0, solves.length - windowSize);
    const v = solves.slice(start);
    const pts: Point[] = v.map((s, i) => {
      const e = effectiveMs(s);
      const dnf = !Number.isFinite(e);
      return {
        i: i + 1,
        origIdx: i,
        ms: e,
        isDnf: dnf,
        isPlus2: s.penalty === '+2',
      };
    });
    const finite = pts.filter(p => !p.isDnf).map(p => p.ms);
    let lo = Infinity;
    let hi = -Infinity;
    for (const t of finite) {
      if (t < lo) lo = t;
      if (t > hi) hi = t;
    }
    const any = finite.length > 0;

    // Ao12 trendline over the full `solves` history, but only emit values for
    // indices that fall inside the plotted window. This way the early window
    // entries can still show trend if enough prior solves exist.
    const ao12: Array<number | null> = new Array(v.length).fill(null);
    for (let i = 0; i < v.length; i++) {
      const globalIdx = start + i;
      if (globalIdx < 11) continue;
      const slice = solves.slice(globalIdx - 11, globalIdx + 1);
      const a = averageOfN(slice, 12);
      ao12[i] = a !== null && Number.isFinite(a) ? a : null;
    }

    const pbVal = bestSingle(solves);
    const pbFinite = pbVal !== null && Number.isFinite(pbVal) ? pbVal : null;

    return {
      view: v,
      points: pts,
      pb: pbFinite,
      yLo: lo,
      yHi: hi,
      ao12Series: ao12,
      hasAny: any,
    };
  }, [solves, windowSize]);

  // Empty state
  if (view.length < 2 || !hasAny) {
    return (
      <svg
        className={`tc-chart tc-scatter ${className ?? ''}`.trim()}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={tr({ zh: '单次成绩散点图', en: 'Per-solve scatter',
            zhHant: "單次成績散點圖"
        })}
      >
        <text
          className="empty-msg"
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {tr({ zh: '至少 2 次成绩', en: 'Need 2+ solves',
              zhHant: "至少 2 次成績"
        })}
        </text>
      </svg>
    );
  }

  // Layout
  const padL = 40;
  const padR = 8;
  const padT = 16;
  const padB = 18;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  // Y range: include PB if present, pad a bit at top/bottom.
  let lo = yLo;
  let hi = yHi;
  if (pb !== null) {
    if (pb < lo) lo = pb;
    if (pb > hi) hi = pb;
  }
  if (lo === hi) {
    const pad = Math.max(lo * 0.05, 100);
    lo -= pad;
    hi += pad;
  } else {
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
  }
  if (lo < 0) lo = 0;

  const n = view.length;
  const xAt = (i: number) =>
    n <= 1 ? padL + innerW / 2 : padL + ((i - 1) / (n - 1)) * innerW;
  const yAt = (v: number) =>
    padT + innerH - ((v - lo) / (hi - lo)) * innerH;
  const yMid = (lo + hi) / 2;

  // Build ao12 path, breaking on null gaps.
  const ao12Parts: string[] = [];
  let pen = false;
  for (let i = 0; i < ao12Series.length; i++) {
    const v = ao12Series[i];
    if (v === null) { pen = false; continue; }
    const x = xAt(i + 1);
    const y = yAt(v);
    ao12Parts.push(`${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
    pen = true;
  }
  const ao12Path = ao12Parts.join(' ');

  return (
    <svg
      className={`tc-chart tc-scatter ${className ?? ''}`.trim()}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={tr({ zh: '单次成绩散点图', en: 'Per-solve scatter',
          zhHant: "單次成績散點圖"
    })}
    >
      {/* Grid: top, mid, bottom */}
      <line
        className="grid-line"
        x1={padL}
        y1={padT + 0.5}
        x2={padL + innerW}
        y2={padT + 0.5}
      />
      <line
        className="grid-line"
        x1={padL}
        y1={padT + innerH / 2 + 0.5}
        x2={padL + innerW}
        y2={padT + innerH / 2 + 0.5}
      />
      <line
        className="axis-line"
        x1={padL}
        y1={padT + innerH + 0.5}
        x2={padL + innerW}
        y2={padT + innerH + 0.5}
      />

      {/* Y-axis tick labels */}
      <text className="axis-tick" x={padL - 4} y={padT + 3} textAnchor="end">
        {formatMs(hi)}
      </text>
      <text className="axis-tick" x={padL - 4} y={padT + innerH / 2 + 3} textAnchor="end">
        {formatMs(yMid)}
      </text>
      <text className="axis-tick" x={padL - 4} y={padT + innerH + 3} textAnchor="end">
        {formatMs(lo)}
      </text>

      {/* X-axis tick labels: 1, mid, n */}
      <text className="axis-tick" x={padL} y={height - 4} textAnchor="start">
        1
      </text>
      <text className="axis-tick" x={padL + innerW / 2} y={height - 4} textAnchor="middle">
        {Math.ceil(n / 2)}
      </text>
      <text className="axis-tick" x={padL + innerW} y={height - 4} textAnchor="end">
        {n}
      </text>

      {/* Ao12 overlay (faint, drawn before dots so dots paint on top) */}
      {ao12Path && (
        <path
          className="scatter-ao12"
          d={ao12Path}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* PB dashed line */}
      {pb !== null && pb >= lo && pb <= hi && (
        <>
          <line
            className="scatter-pb"
            x1={padL}
            y1={yAt(pb) + 0.5}
            x2={padL + innerW}
            y2={yAt(pb) + 0.5}
          />
          <text
            className="scatter-pb-label"
            x={padL + innerW - 2}
            y={yAt(pb) - 2}
            textAnchor="end"
          >
            {`PB ${formatMs(pb)}`}
          </text>
        </>
      )}

      {/* Dots: DNFs first (open circles at top), then valid solves on top. */}
      {points.map(p => {
        if (p.isDnf) {
          const cx = xAt(p.i);
          const cy = padT + 2;
          return (
            <circle
              key={`dnf-${p.origIdx}`}
              className="scatter-dot-dnf"
              cx={cx}
              cy={cy}
              r={3.5}
            >
              <title>{`#${p.i} · DNF`}</title>
            </circle>
          );
        }
        return null;
      })}
      {points.map(p => {
        if (p.isDnf) return null;
        const cx = xAt(p.i);
        const cy = yAt(p.ms);
        const cls = p.isPlus2 ? 'scatter-dot scatter-dot-plus2' : 'scatter-dot';
        return (
          <circle
            key={`pt-${p.origIdx}`}
            className={cls}
            cx={cx}
            cy={cy}
            r={3}
          >
            <title>
              {`#${p.i} · ${formatMs(p.ms)}${p.isPlus2 ? ' (+2)' : ''}`}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}
