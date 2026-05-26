'use client';

/**
 * TrendChart — pure-SVG line chart of single + aoN curves over solve index.
 * DNFs produce gaps. Pre-computes series outside JSX so 5000+ solves render fine.
 */

import { useMemo } from 'react';
import type { Solve } from '../timer-db';
import { effectiveMs } from '../timer-db';
import { averageOfN, formatMs } from '../timer-stats';
import './charts.css';

type CurveKind = 'single' | 'ao5' | 'ao12' | 'ao100';

interface Props {
  solves: Solve[];
  isZh: boolean;
  width?: number;
  height?: number;
  curves?: CurveKind[];
  className?: string;
}

const CURVE_LABEL: Record<CurveKind, string> = {
  single: 'single', ao5: 'Ao5', ao12: 'Ao12', ao100: 'Ao100',
};
const CURVE_LABEL_ZH: Record<CurveKind, string> = {
  single: '单次', ao5: 'Ao5', ao12: 'Ao12', ao100: 'Ao100',
};
const CURVE_N: Record<CurveKind, number> = {
  single: 1, ao5: 5, ao12: 12, ao100: 100,
};

function buildSeries(solves: Solve[], kind: CurveKind): Array<number | null> {
  const out: Array<number | null> = new Array(solves.length).fill(null);
  if (kind === 'single') {
    for (let i = 0; i < solves.length; i++) {
      const e = effectiveMs(solves[i]);
      out[i] = Number.isFinite(e) ? e : null;
    }
    return out;
  }
  const n = CURVE_N[kind];
  for (let i = n - 1; i < solves.length; i++) {
    const window = solves.slice(i - n + 1, i + 1);
    const v = averageOfN(window, n);
    out[i] = v !== null && Number.isFinite(v) ? v : null;
  }
  return out;
}

function seriesToPath(
  series: Array<number | null>,
  xAt: (i: number) => number,
  yAt: (v: number) => number,
): string {
  const parts: string[] = [];
  let pen = false;
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (v === null) { pen = false; continue; }
    const x = xAt(i);
    const y = yAt(v);
    parts.push(`${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
    pen = true;
  }
  return parts.join(' ');
}

export default function TrendChart({
  solves, isZh, width = 320, height = 140, curves = ['single', 'ao5', 'ao12'], className,
}: Props) {
  const { seriesMap, yMin, yMax, hasAny } = useMemo(() => {
    const map = new Map<CurveKind, Array<number | null>>();
    let lo = Infinity;
    let hi = -Infinity;
    let any = false;
    for (const k of curves) {
      const s = buildSeries(solves, k);
      map.set(k, s);
      for (const v of s) {
        if (v === null) continue;
        any = true;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    return { seriesMap: map, yMin: lo, yMax: hi, hasAny: any };
  }, [solves, curves]);

  if (solves.length < 5 || !hasAny) {
    return (
      <div className={`chart-empty-hint ${className ?? ''}`.trim()}>
        {isZh ? '至少 5 次成绩才显示趋势' : 'Need 5+ solves to chart trend'}
      </div>
    );
  }

  const padL = 36, padR = 8, padT = 18, padB = 16;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  let lo = yMin;
  let hi = yMax;
  if (lo === hi) {
    const pad = Math.max(lo * 0.05, 100);
    lo -= pad;
    hi += pad;
  } else {
    const pad = (hi - lo) * 0.06;
    lo -= pad;
    hi += pad;
  }
  if (lo < 0) lo = 0;

  const n = solves.length;
  const xAt = (i: number) => (n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - ((v - lo) / (hi - lo)) * innerH;
  const yMid = (lo + hi) / 2;
  const labelMap = isZh ? CURVE_LABEL_ZH : CURVE_LABEL;

  return (
    <svg
      className={`tc-chart tc-trend ${className ?? ''}`.trim()}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={isZh ? '成绩趋势图' : 'Solve time trend'}
    >
      <line className="grid-line" x1={padL} y1={padT + 0.5} x2={padL + innerW} y2={padT + 0.5} />
      <line className="grid-line" x1={padL} y1={padT + innerH / 2 + 0.5} x2={padL + innerW} y2={padT + innerH / 2 + 0.5} />
      <line className="axis-line" x1={padL} y1={padT + innerH + 0.5} x2={padL + innerW} y2={padT + innerH + 0.5} />

      <text className="axis-tick" x={padL - 4} y={padT + 3} textAnchor="end">{formatMs(hi)}</text>
      <text className="axis-tick" x={padL - 4} y={padT + innerH / 2 + 3} textAnchor="end">{formatMs(yMid)}</text>
      <text className="axis-tick" x={padL - 4} y={padT + innerH + 3} textAnchor="end">{formatMs(lo)}</text>

      <text className="axis-tick" x={padL} y={height - 4} textAnchor="start">1</text>
      <text className="axis-tick" x={padL + innerW / 2} y={height - 4} textAnchor="middle">{Math.ceil(n / 2)}</text>
      <text className="axis-tick" x={padL + innerW} y={height - 4} textAnchor="end">{n}</text>

      {(['single', 'ao5', 'ao12', 'ao100'] as CurveKind[])
        .filter(k => curves.includes(k))
        .map(k => {
          const s = seriesMap.get(k);
          if (!s) return null;
          const d = seriesToPath(s, xAt, yAt);
          if (!d) return null;
          return <path key={k} className={`curve curve-${k}`} d={d} strokeLinejoin="round" strokeLinecap="round" />;
        })}

      <g transform={`translate(${padL}, 4)`}>
        {curves.map((k, idx) => (
          <g key={k} transform={`translate(${idx * 56}, 0)`}>
            <line className={`curve curve-${k}`} x1={0} y1={6} x2={14} y2={6} />
            <text className="legend-text" x={18} y={9}>{labelMap[k]}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
